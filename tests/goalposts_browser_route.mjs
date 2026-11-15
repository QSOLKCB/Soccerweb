import {EMPTY} from '../game/state.mjs';
// Authored winning inputs for the browser's held-kick/Next Stage path at seed 731.
// Its extra recorded release tick changes AI timing, so this is deliberately a
// separate fixture from the neutral-celebration route in goalposts_route.mjs.
export function browserShot(s){
 const i={...EMPTY},g=s.goalposts,t=g.clock,wait=[90,1,0][g.stage],release=g.stage===0?150:45;
 if(s.phase==='play')Object.assign(i,{x:t>=wait&&t<release?1:0,y:t>=wait&&t<=release?-1:0,fire:t>=wait&&t<release,curve:t>=release?-1:0});
 else if(s.phase==='goal'&&g.stage===0)i.fire=true;
 return i;
}
