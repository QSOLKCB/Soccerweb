// USB adapters do not agree on button order. Explicit per-player profiles, never an ID guess.
export const PAD_KEY='soccerweb.controllers.v1';
export const PAD_ACTIONS={fire:'Kick / confirm (B)',pass:'Pass (Y)',chip:'Chip / back (A)',switch:'Switch (X)',curveLeft:'Curve left (L)',curveRight:'Curve right (R)',pause:'Pause / resume (Start)',alternateSwitch:'Switch (Select)',up:'D-pad up',down:'D-pad down',left:'D-pad left',right:'D-pad right'};
export function padPreset(name='standard'){
 const snes=name==='snes';return{name:snes?'snes':'standard',movement:'axes',axes:[0,1],deadzone:.28,buttons:{fire:snes?1:0,pass:snes?0:2,chip:snes?2:1,switch:3,curveLeft:4,curveRight:5,pause:9,alternateSwitch:snes?8:-1,up:12,down:13,left:14,right:15}};
}
export function validPadProfile(p){
 if(!p||!['standard','snes','custom'].includes(p.name)||!['axes','buttons'].includes(p.movement)||!Array.isArray(p.axes)||p.axes.length!==2||!p.axes.every(n=>Number.isInteger(n)&&n>=0&&n<16)||p.axes[0]===p.axes[1]||!Number.isFinite(p.deadzone)||p.deadzone<.1||p.deadzone>.8)return false;
 const values=Object.keys(PAD_ACTIONS).map(k=>p.buttons?.[k]);
 return values.every((n,i)=>Number.isInteger(n)&&n>=(i<7?0:-1)&&n<32)&&new Set(values.filter(n=>n>=0)).size===values.filter(n=>n>=0).length;
}
export function readPadProfiles(value){return value?.version===1&&Array.isArray(value.profiles)&&value.profiles.length===2&&value.profiles.every(validPadProfile)?structuredClone(value.profiles):[padPreset(),padPreset()];}
export const connectedPads=()=>Array.from(globalThis.navigator?.getGamepads?.()||[]).filter(p=>p&&p.connected!==false).slice(0,2);
export function padInput(p,profile){
 const button=n=>n>=0&&!!(p?.buttons[n]?.pressed||p?.buttons[n]?.value>.5),pressed=Object.fromEntries(Object.entries(profile.buttons).map(([k,n])=>[k,button(n)]));
 const axis=n=>{const v=p?.axes[n];return Number.isFinite(v)&&Math.abs(v)>profile.deadzone?Math.sign(v):0;};
 const x=+pressed.right-pressed.left,y=+pressed.down-pressed.up;
 return{...pressed,x:x||(profile.movement==='axes'?axis(profile.axes[0]):0),y:y||(profile.movement==='axes'?axis(profile.axes[1]):0),switch:pressed.switch||pressed.alternateSwitch,curve:+pressed.curveRight-pressed.curveLeft};
}
export function bindPadButton(profile,action,button){
 if(!Object.hasOwn(PAD_ACTIONS,action)||!Number.isInteger(button)||button<0||button>31)throw new Error('Choose a button from 0 to 31.');
 const next=structuredClone(profile),old=next.buttons[action];
 for(const a of Object.keys(PAD_ACTIONS))if(a!==action&&next.buttons[a]===button)next.buttons[a]=old;
 next.buttons[action]=button;next.name='custom';
 if(!validPadProfile(next))throw new Error('That assignment would remove a required action. Assign Select/D-pad buttons to unused buttons.');return next;
}
