// Paired fixtures cover every club, both ends, three difficulties and eight published seeds.
import {createState} from '../game/state.mjs';
import {step} from '../game/match.mjs';
import {distance,Q} from '../simulation/math.mjs';
import {stateHash} from '../replay/replay.mjs';
const seeds=[42,1988,731,19,2026,805,99,31415],matches=[];
const percentile=(a,p)=>a.length?[...a].sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*p))]:0;
for(const indoor of [false,true])for(const difficulty of [1,2,3])for(let i=0;i<seeds.length;i++)for(const reverse of [false,true]){
 const teams=reverse?[(i+3)%8,i]:[i,(i+3)%8];
 const s=createState({indoor,difficulty,teams,seed:seeds[i],seconds:120,humans:[false,false]});
 const spells=[],firstTouchLosses=[0,0],interceptions=[0,0];let owner=-1,held=0,loose=0,crowded=0,samples=0,changes=0;
 const finish=()=>{if(owner>=0&&held){spells.push(held);if(held<3)firstTouchLosses[s.players[owner].team]++;}held=0;};
 while(s.phase!=='fulltime'&&s.tick<24000){
  const prior={kind:s.ball.kind,last:s.ball.last};step(s);
  if(s.phase!=='play'){finish();owner=-1;continue;}
  if(s.ball.owner!==owner){finish();if(owner>=0&&s.ball.owner>=0&&s.players[owner].team!==s.players[s.ball.owner].team)changes++;owner=s.ball.owner;}
  if(owner>=0)held++;else loose++;
  if(prior.kind==='pass'&&s.ball.last!==prior.last)interceptions[s.ball.last]++;
  if(s.tick%30===0){samples++;for(let a=0;a<s.players.length;a++)for(let b=a+1;b<s.players.length;b++)if(s.players[a].team===s.players[b].team&&distance(s.players[a],s.players[b])<30*Q)crowded++;}
 }
 finish();const count=spells.length,goals=s.score.reduce((a,b)=>a+b,0),shots=s.stats.shots.reduce((a,b)=>a+b,0);
 matches.push({indoor,difficulty,seed:seeds[i],teams,reverse,score:s.score,...s.stats,interceptions,firstTouchLosses,directTurnovers:changes,
  spells:count,shortSpells:spells.filter(n=>n<20).length,meanPossessionTicks:count?spells.reduce((a,b)=>a+b,0)/count:0,p50PossessionTicks:percentile(spells,.5),p90PossessionTicks:percentile(spells,.9),
  looseTicks:loose,crowdedPairsPerSample:crowded/Math.max(1,samples),goalShotRatio:goals/Math.max(1,shots),phase:s.phase,ticks:s.tick,hash:stateHash(s)});
}
const summary=[];
for(const indoor of [false,true])for(const difficulty of [1,2,3]){
 const ms=matches.filter(m=>m.indoor===indoor&&m.difficulty===difficulty),sum=key=>ms.reduce((a,m)=>a+(Array.isArray(m[key])?m[key].reduce((x,y)=>x+y,0):m[key]),0);
 summary.push({indoor,difficulty,fixtures:ms.length,goals:sum('score'),shots:sum('shots'),passes:sum('passes'),completedPasses:sum('completedPasses'),saves:sum('saves'),interceptions:sum('interceptions'),firstTouchLosses:sum('firstTouchLosses'),
 shortPossessionPercent:100*sum('shortSpells')/sum('spells'),meanPossessionTicks:ms.reduce((a,m)=>a+m.meanPossessionTicks*m.spells,0)/sum('spells'),
 meanGoalMargin:ms.reduce((a,m)=>a+Math.abs(m.score[0]-m.score[1]),0)/ms.length,blowouts:ms.filter(m=>Math.abs(m.score[0]-m.score[1])>=5).length,
 sideWins:[ms.filter(m=>m.score[0]>m.score[1]).length,ms.filter(m=>m.score[1]>m.score[0]).length],draws:ms.filter(m=>m.score[0]===m.score[1]).length,crowdedPairsPerSample:sum('crowdedPairsPerSample')/ms.length});
}
console.log(JSON.stringify({version:createState().version,seeds,seconds:120,definitions:{possession:'Consecutive active ticks with the same player owning the ball; stopped play closes a spell.',short:'Spell <20 ticks.',firstTouchLoss:'Spell <3 ticks, including kicks and losses; not necessarily a turnover.',interception:'Pass changes last-touch team, including deflections.',blowout:'Absolute final goal margin >=5.',conversion:'Goals / shot attempts; descriptive, not shot-level xG.'},summary,matches},null,2));
if(matches.some(m=>m.phase!=='fulltime'))process.exitCode=1;
