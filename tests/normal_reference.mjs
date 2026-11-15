// Same tick streams on merged Phase 3 and this checkout; normalize only the declared version.
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
export async function normalReference(directory='.') {
const root=pathToFileURL(resolve(directory)+'/');
const {createState,EMPTY}=await import(new URL('game/state.mjs',root));
const {step}=await import(new URL('game/match.mjs',root));
const {hash}=await import(new URL('simulation/math.mjs',root));
const reports=[];
for(const indoor of [false,true])for(const difficulty of [1,2,3])for(const seed of [42,731]){
 const s=createState({indoor,difficulty,seed,seconds:60,weather:'rain',aftertouch:2}),checkpoints=[];
 for(let t=0;t<4000;t++){
  step(s,[{...EMPTY,x:t%170<80?1:-1,y:-1,fire:t%90<50,curve:t%190<95?1:-1},EMPTY]);
  if(t%300===299){const {events,...state}=s;checkpoints.push(hash({...state,version:4}));}
 }
 const {events,...state}=s;reports.push({indoor,difficulty,seed,score:s.score,stats:s.stats,checkpoints,normalizedHash:hash({...state,version:4})});
}
return reports;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(JSON.stringify(await normalReference(process.argv[2]),null,2));
