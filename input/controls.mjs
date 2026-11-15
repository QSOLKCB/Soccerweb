import { EMPTY } from '../game/state.mjs';
export const DEFAULT_MAPS = [
  { up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD',fire:'Space',pass:'KeyF',chip:'KeyR',switch:'Tab',curveLeft:'KeyQ',curveRight:'KeyE' },
  { up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',fire:'Enter',pass:'ShiftRight',chip:'ControlRight',switch:'Backslash',curveLeft:'BracketLeft',curveRight:'BracketRight' }
];
export const keyLabel = code => ({Space:'Space',Tab:'Tab',Enter:'Enter',ShiftRight:'R Shift',ControlRight:'R Ctrl',Backslash:'\\',BracketLeft:'[',BracketRight:']',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→'}[code]||code.replace('Key','').replace('Digit',''));
export class Controls {
  constructor(onPause, maps = DEFAULT_MAPS) {
    this.keys=new Set();this.maps=structuredClone(maps);this.active=false;this.gameplayEnabled=true;this.onPause=onPause;this.capture=null;
    window.addEventListener('keydown',e=>{
      if(this.capture){e.preventDefault();const cb=this.capture;this.capture=null;cb(e.code);return;}
      if(!this.active)return;
      if(e.code==='Escape'||e.code==='KeyP'){e.preventDefault();if(!e.repeat)onPause();return;}
      if(!this.gameplayEnabled)return;
      if(this.maps.some(m=>Object.values(m).includes(e.code))){e.preventDefault();this.keys.add(e.code);}
    });
    window.addEventListener('keyup',e=>this.keys.delete(e.code));
    window.addEventListener('blur',()=>{this.clear();if(this.active)onPause(true);});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.clear();if(this.active)onPause(true);}});
    window.addEventListener('gamepaddisconnected',()=>{this.clear();if(this.active)onPause(true);});
    this.padPause=false;
  }
  clear(){this.keys.clear();}
  setGameplayEnabled(enabled){this.gameplayEnabled=enabled;this.clear();}
  sample(){
    const pads=navigator.getGamepads?Array.from(navigator.getGamepads()).filter(Boolean):[];
    const pause=pads.some(p=>p.buttons[9]?.pressed);if(pause&&!this.padPause&&this.active)this.onPause();this.padPause=pause;
    if(!this.active||!this.gameplayEnabled)return [{...EMPTY},{...EMPTY}];
    return this.maps.map((m,t)=>{
      const down=a=>this.keys.has(m[a]),p=pads[t],button=n=>!!p?.buttons[n]?.pressed;
      const axis=n=>Math.abs(p?.axes[n]||0)>.28?Math.sign(p.axes[n]):0;
      return { ...EMPTY,x:(+down('right')-down('left'))||axis(0)||(+button(15)-button(14)),y:(+down('down')-down('up'))||axis(1)||(+button(13)-button(12)),
        fire:down('fire')||button(0),pass:down('pass')||button(2),chip:down('chip')||button(1),switch:down('switch')||button(3),curve:(+down('curveRight')-down('curveLeft'))||(+button(5)-button(4)) };
    });
  }
  remap(player,action,code){
    if(['Escape','KeyP','Unidentified'].includes(code))throw new Error('That key is reserved.');
    if(this.maps.some((m,t)=>Object.entries(m).some(([a,c])=>c===code&&(t!==player||a!==action))))throw new Error('That key is already assigned.');
    this.maps[player][action]=code;
  }
}
