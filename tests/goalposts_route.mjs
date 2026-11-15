import {EMPTY} from '../game/state.mjs';
export function routeInput(s){
 const t=s.goalposts.clock,i={...EMPTY},wait=s.goalposts.stage===0?90:0,charge=s.goalposts.stage===0?60:45;
 if(s.phase==='stageclear')i.fire=true;
 else if(s.phase==='play'){if(t>=wait&&t<wait+charge)Object.assign(i,{x:1,y:-1,fire:true});else if(t>=wait+charge)Object.assign(i,{y:t===wait+charge?-1:0,curve:-1});}
 return [i,{...EMPTY}];
}
