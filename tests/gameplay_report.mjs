// Reproducible whole-match measurements; no outcome is prescribed or injected.
import { createState } from '../game/state.mjs';
import { step } from '../game/match.mjs';
import { Q, distance } from '../simulation/math.mjs';
import { stateHash } from '../replay/replay.mjs';
const matches=[];
for(const indoor of [false,true])for(const difficulty of [1,2,3])for(const seed of [1988,42]){
  const s=createState({indoor,difficulty,seed,seconds:120,humans:[false,false]});
  let crowdedPairs=0,samples=0,owners=0,shortPossessions=0,held=0,last=-1;
  while(s.phase!=='fulltime'&&s.tick<24000){
    step(s);
    if(s.phase==='play'){
      if(s.ball.owner===last&&last>=0)held++;
      else {if(last>=0){owners++;if(held<20)shortPossessions++;}held=0;last=s.ball.owner;}
      if(s.tick%30===0){
        samples++;
        for(let i=0;i<s.players.length;i++)for(let j=i+1;j<s.players.length;j++)
          if(s.players[i].team===s.players[j].team&&distance(s.players[i],s.players[j])<30*Q)crowdedPairs++;
      }
    }
  }
  matches.push({indoor,difficulty,seed,score:s.score,shots:s.stats.shots,passes:s.stats.passes,saves:s.stats.saves,
    crowdedTeammatePairsPerSample:Number((crowdedPairs/Math.max(1,samples)).toFixed(3)),
    shortPossessionPercent:Math.round(shortPossessions/Math.max(1,owners)*100),phase:s.phase,ticks:s.tick,hash:stateHash(s)});
}
console.log(JSON.stringify({simulationVersion:createState().version,seconds:120,matches},null,2));
