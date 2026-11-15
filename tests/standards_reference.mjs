// Exact v5 reference: no metadata normalization, injected goals, or changed physics.
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
export async function standardsReference(directory='.'){
 const root=pathToFileURL(resolve(directory)+'/');
 const {createState,EMPTY}=await import(new URL('game/state.mjs',root));
 const {step}=await import(new URL('game/match.mjs',root));
 const {stateHash,Recorder,verifyReplay}=await import(new URL('replay/replay.mjs',root));
 const {routeInput}=await import(new URL('tests/goalposts_route.mjs',root));
 const normal=[],goalposts=[];
 for(const indoor of [false,true])for(const difficulty of [1,2,3])for(const seed of [42,731]){
  const s=createState({indoor,difficulty,seed,seconds:60,weather:'rain',aftertouch:2}),r=new Recorder(s);
  for(let t=0;t<4000&&s.phase!=='fulltime';t++){const inputs=[{...EMPTY,x:t%170<80?1:-1,y:-1,fire:t%90<50,curve:t%190<95?1:-1},EMPTY];step(s,inputs);r.record(s,inputs);}
  const replay=r.export(s);verifyReplay(replay);normal.push({config:s.config,ticks:s.tick,hash:stateHash(s),checkpoints:replay.checkpoints,score:s.score,stats:s.stats});
 }
 for(const seed of [731,42])for(const difficulty of [1,2,3]){
  const s=createState({mode:'goalposts',seed,difficulty,aftertouch:2}),r=new Recorder(s);
  while(s.phase!=='fulltime'&&s.tick<12000){const inputs=routeInput(s);step(s,inputs);r.record(s,inputs);}
  if(s.goalposts.status!=='won')throw Error('Reference route failed');
  const replay=r.export(s);verifyReplay(replay);goalposts.push({config:s.config,ticks:s.tick,hash:stateHash(s),checkpoints:replay.checkpoints,score:s.score,history:s.goalposts.history});
 }
 return {version:5,normal,goalposts};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(JSON.stringify(await standardsReference(process.argv[2]),null,2));
