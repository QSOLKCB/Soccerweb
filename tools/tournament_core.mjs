// Development only. Schema 1 preserves the season_report.mjs possession definitions.
import {createState, VERSION} from '../game/state.mjs';
import {step} from '../game/match.mjs';
import {distance,Q} from '../simulation/math.mjs';
import {stateHash} from '../replay/replay.mjs';
export const SCHEMA=1, MAX_FIXTURES=10000;
export const SEEDS=[42,1988,731,19,2026,805,99,31415];
export const PRESETS={quick:96,medium:1000,large:10000};
export function integer(value,min,max,label){
 if(!Number.isSafeInteger(Number(value))||Number(value)<min||Number(value)>max)throw Error(`Invalid ${label}: expected integer ${min}..${max}`);
 return Number(value);
}
export function parseSeeds(text){
 const seeds=[];
 for(const part of text.split(',')){
  if(!/^\d+(:\d+)?$/.test(part))throw Error('Seeds must be integers or inclusive start:end ranges');
  const [lo,hi=lo]=part.split(':').map(Number);integer(lo,1,0xffffffff,'seed');integer(hi,lo,0xffffffff,'seed');
  if(seeds.length+hi-lo+1>256)throw Error('At most 256 seeds');
  for(let seed=lo;seed<=hi;seed++)seeds.push(seed);
 }
 if(new Set(seeds).size!==seeds.length)throw Error('Duplicate seeds');
 return seeds;
}
export function settings(input={}){
 const o={preset:'quick',count:undefined,seeds:SEEDS,mode:'both',seconds:120,...input};
 if(!Object.hasOwn(PRESETS,o.preset)||!['both','outdoor','indoor'].includes(o.mode))throw Error('Invalid preset or mode');
 o.count=integer(o.count??PRESETS[o.preset],2,MAX_FIXTURES,'fixture count');
 if(o.count%2)throw Error('Fixture count must be even for mirrored pairs');
 o.seconds=integer(o.seconds,20,720,'duration');
 if(!Array.isArray(o.seeds)||!o.seeds.length)throw Error('Seeds required');o.seeds=parseSeeds(o.seeds.join(','));
 return o;
}
export function schedule(input={}){
 const o=settings(input), fixtures=[];
 // quick is EXACTLY the historical 96-fixture order with default options.
 const grounds=o.mode==='both'?[false,true]:[o.mode==='indoor'];
 const span=grounds.length*3*o.seeds.length;
 for(let id=0;id<o.count;id++){
  const pair=Math.floor(id/2),cycle=Math.floor(pair/span),within=pair%span;
  const seedIndex=within%o.seeds.length,difficulty=1+Math.floor(within/o.seeds.length)%3;
  const indoor=grounds[Math.floor(within/(3*o.seeds.length))],reverse=!!(id%2);
  const club=seedIndex%8,opponent=(club+1+(2+Math.floor(cycle/2))%7)%8;
  const teams=reverse?[opponent,club]:[club,opponent];
  // New cycles alternate weather, then rotate opposition. quick cycle 0 stays clear.
  const weather=cycle%2?'rain':'clear';
  const seed=o.seeds[seedIndex]+Math.floor(cycle/14);
  if(seed>0xffffffff)throw Error('Expanded seed exceeds uint32');
  fixtures.push({id,pair,reverse,config:createState({seed,indoor,difficulty,teams,weather,seconds:o.seconds,humans:[false,false]}).config});
 }
 return fixtures;
}
export function partition(fixtures,index=0,count=1){
 integer(count,1,32,'shard count');integer(index,0,count-1,'shard index');return fixtures.filter(f=>f.id%count===index);
}
export const percentile=(a,p)=>a.length?[...a].sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*p))]:0;
export class BudgetExceeded extends Error {}
export function runFixture(fixture,{deadline=Infinity,fixtureMs=60000}={}){
 const started=performance.now(),s=createState(fixture.config);
 const spells=[],firstTouchLosses=[0,0],interceptions=[0,0];
 let owner=-1,held=0,loose=0,crowded=0,samples=0,changes=0;
 let keeperTicks=0,idleTicks=0,passRun=0,lastPost=-9999,anchor=null,nonprogress=0;
 const flags=[],events=[],counts={post:0,goal:0,kick:0,save:0};
 const flag=(kind,priority,detail)=>{
  if(flags.some(f=>f.kind===kind)||flags.length>=16)return;
  flags.push({id:`f${fixture.id}-${kind}`,kind,priority,tick:s.tick,hash:stateHash(s),detail});
 };
 const finish=()=>{if(owner>=0&&held){spells.push(held);if(held<3)firstTouchLosses[s.players[owner].team]++;}held=0;};
 let error=null;
 while(s.phase!=='fulltime'&&s.tick<120000){
  if(s.tick%256===0){
   if(performance.now()>=deadline)throw new BudgetExceeded(`Run budget at fixture ${fixture.id}, tick ${s.tick}`);
   if(performance.now()-started>fixtureMs){error='Fixture wall-time limit';break;}
  }
  const prior={phase:s.phase,kind:s.ball.kind,last:s.ball.last};step(s);
  for(const e of s.events){
   if(e.type in counts)counts[e.type]++;
   if(['goal','post','save'].includes(e.type)&&events.length<24)events.push({tick:s.tick,type:e.type,team:e.team??null});
   if(e.type==='post'){if(s.tick-lastPost<60)flag('repeated-frame-contact',2,'Two frame contacts within 60 ticks; review rebound sequence');lastPost=s.tick;}
   if(e.type==='goal'&&s.tick-lastPost<2)flag('frame-goal-adjacent',1,'Goal within one tick of frame contact; review, not a rule verdict');
   if(e.type==='kick'){passRun=e.kind==='pass'?passRun+1:0;if(passRun>=24)flag('pass-chain',3,'24 pass attempts without a shot or stopped play');}
  }
  if(s.phase!=='play'){finish();owner=-1;keeperTicks=idleTicks=nonprogress=passRun=0;anchor=null;continue;}
  // Keep this block equivalent to tests/season_report.mjs. New telemetry is separate.
  if(s.ball.owner!==owner){finish();if(owner>=0&&s.ball.owner>=0&&s.players[owner].team!==s.players[s.ball.owner].team)changes++;owner=s.ball.owner;}
  if(owner>=0)held++;else loose++;
  if(prior.phase==='play'&&prior.kind==='pass'&&s.ball.last!==prior.last)interceptions[s.ball.last]++;
  if(s.tick%30===0){samples++;for(let a=0;a<s.players.length;a++)for(let b=a+1;b<s.players.length;b++)if(s.players[a].team===s.players[b].team&&distance(s.players[a],s.players[b])<30*Q)crowded++;}
  keeperTicks=owner>=0&&s.players[owner].keeper?keeperTicks+1:0;
  idleTicks=Math.abs(s.ball.vx)+Math.abs(s.ball.vy)<Q/4?idleTicks+1:0;
  if(!anchor||distance(anchor,s.ball)>40*Q){anchor={x:s.ball.x,y:s.ball.y};nonprogress=0;}else nonprogress++;
  if(keeperTicks===180)flag('keeper-hold',2,'Keeper-owned ball for 180 consecutive active ticks (owner may change)');
  if(idleTicks===300)flag('idle-ball',2,'Ball planar speed below 0.25 px/tick for 300 active ticks');
  if(nonprogress===600)flag('nonprogress-ball',2,'Ball remained within 40 px of anchor for 600 active ticks');
 }
 finish();
 if(s.phase!=='fulltime'){error??='Tick limit';flag('incomplete',0,error);}
 if(Math.abs(s.score[0]-s.score[1])>=5)flag('blowout',3,'Absolute goal margin >=5');
 if(s.score[0]+s.score[1]===0)flag('scoreless',4,'No goals; not proof of an AI stall');
 if(crowded/Math.max(1,samples)>3)flag('crowding',3,'Mean >3 same-team pairs within 30 px at 30-tick sampling');
 const count=spells.length,goals=s.score[0]+s.score[1],shots=s.stats.shots[0]+s.stats.shots[1];
 const metrics={indoor:s.config.indoor,difficulty:s.config.difficulty,seed:s.config.seed,teams:s.config.teams,reverse:fixture.reverse,score:s.score,...s.stats,interceptions,firstTouchLosses,directTurnovers:changes,
  spells:count,shortSpells:spells.filter(n=>n<20).length,meanPossessionTicks:count?spells.reduce((a,b)=>a+b,0)/count:0,p50PossessionTicks:percentile(spells,.5),p90PossessionTicks:percentile(spells,.9),
  looseTicks:loose,crowdedPairsPerSample:crowded/Math.max(1,samples),goalShotRatio:goals/Math.max(1,shots),phase:s.phase,ticks:s.tick,hash:stateHash(s)};
 return {schema:SCHEMA,simulationVersion:VERSION,fixture,status:error?'FAILED':'COMPLETE',error,metrics,
  telemetry:{flags,events,counts,spellHistogram:[spells.filter(n=>n<3).length,spells.filter(n=>n>=3&&n<20).length,spells.filter(n=>n>=20&&n<60).length,spells.filter(n=>n>=60).length],input:'Two neutral human inputs each tick; both teams use production deterministic AI'}};
}
