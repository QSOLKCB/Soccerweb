import fs from 'node:fs';
import {createState} from '../game/state.mjs';
import {step} from '../game/match.mjs';
import {Recorder,verifyReplay,stateHash} from '../replay/replay.mjs';
import {routeInput} from './goalposts_route.mjs';
const dir=process.argv[2]||'work/goalposts-report';fs.mkdirSync(dir,{recursive:true});const runs=[];
for(const seed of [731,42])for(const difficulty of [1,2,3]){
 const s=createState({mode:'goalposts',difficulty,aftertouch:2,seed}),r=new Recorder(s);
 while(s.phase!=='fulltime'&&s.tick<12000){const inputs=routeInput(s);step(s,inputs);r.record(s,inputs);}
 if(s.goalposts.status!=='won')throw Error(`Route failed: ${seed}/${difficulty}`);
 const replay=r.export(s),verified=verifyReplay(replay);if(stateHash(verified)!==stateHash(s))throw Error('Replay mismatch');
 fs.writeFileSync(`${dir}/${seed}-${difficulty}.json`,JSON.stringify(replay));runs.push({seed,difficulty,ticks:s.tick,hash:stateHash(s),checkpoints:replay.checkpoints,score:s.score,stages:s.goalposts.history});
}
fs.writeFileSync(`${dir}/report.json`,JSON.stringify(runs,null,2));console.log(JSON.stringify(runs));
