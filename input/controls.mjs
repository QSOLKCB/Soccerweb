import {connectedPads,padInput,readPadProfiles} from './gamepads.mjs';
import { EMPTY } from '../game/state.mjs';
export const DEFAULT_MAPS = [
  { up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD',fire:'Space',pass:'KeyF',chip:'KeyR',switch:'Tab',curveLeft:'KeyQ',curveRight:'KeyE' },
  { up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',fire:'Enter',pass:'ShiftRight',chip:'ControlRight',switch:'Backslash',curveLeft:'BracketLeft',curveRight:'BracketRight' }
];
export const keyLabel = code => ({Space:'Space',Tab:'Tab',Enter:'Enter',ShiftRight:'R Shift',ControlRight:'R Ctrl',Backslash:'\\',BracketLeft:'[',BracketRight:']',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→'}[code]||code.replace('Key','').replace('Digit',''));
export class Controls {
  constructor(onPause, maps = DEFAULT_MAPS) {
    this.keys=new Set();this.taps=new Set();this.maps=structuredClone(maps);this.active=false;this.gameplayEnabled=true;this.onPause=onPause;this.capture=null;this.padProfiles=readPadProfiles(null);this.blockPadActions=false;this.menuPrevious={};
    window.addEventListener('keydown',e=>{
      if(this.capture){e.preventDefault();const cb=this.capture;this.capture=null;cb(e.code);return;}
      if(!this.active)return;
      if(e.code==='Escape'||e.code==='KeyP'){e.preventDefault();if(!e.repeat)onPause();return;}
      if(!this.gameplayEnabled)return;
      if(this.maps.some(m=>Object.values(m).includes(e.code))){e.preventDefault();this.keys.add(e.code);if(!e.repeat&&this.maps.some(m=>['fire','pass','chip','switch'].some(a=>m[a]===e.code)))this.taps.add(e.code);}
    });
    window.addEventListener('keyup',e=>this.keys.delete(e.code));
    window.addEventListener('blur',()=>{this.clear();if(this.active)onPause(true);});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.clear();if(this.active)onPause(true);}});
    window.addEventListener('gamepaddisconnected',()=>{this.clear();if(this.active)onPause(true);});
    this.padPause=false;this.cancelPending=false;
  }
  clear(){this.keys.clear();this.taps.clear();}
  setGameplayEnabled(enabled){if(!enabled)this.cancelPending=true;this.gameplayEnabled=enabled;this.clear();}
  sample(){
    const wasPlaying=this.active&&this.gameplayEnabled;
    const pads=connectedPads(),padInputs=this.padProfiles.map((profile,t)=>padInput(pads[t],profile));
    const pause=padInputs.some(p=>p.pause);if(pause&&!this.padPause&&this.active)this.onPause();this.padPause=pause;
    if(!wasPlaying||!this.active||!this.gameplayEnabled)return [{...EMPTY},{...EMPTY}];
    if(this.blockPadActions&&!padInputs.some(p=>p.fire||p.pass||p.chip||p.switch||p.curve))this.blockPadActions=false;
    const result=this.maps.map((m,t)=>{
      const down=a=>this.keys.has(m[a])||this.taps.has(m[a]),pad=padInputs[t],p=this.blockPadActions?{}:pad;
      return { ...EMPTY,cancel:this.cancelPending,x:(+down('right')-down('left'))||pad.x,y:(+down('down')-down('up'))||pad.y,
        fire:down('fire')||!!p.fire,pass:down('pass')||!!p.pass,chip:down('chip')||!!p.chip,switch:down('switch')||!!p.switch,curve:(+down('curveRight')-down('curveLeft'))||(p.curve||0) };
    });
    this.taps.clear();this.cancelPending=false;return result;
  }
  menuAction(enabled){
    const p=padInput(connectedPads()[0],this.padProfiles[0]),old=this.menuPrevious;this.menuPrevious=p;
    if(this.blockPadActions){if(p.fire||p.chip||p.pass||p.switch||p.curve)return null;this.blockPadActions=false;}
    if(!enabled)return null;
    if(p.fire&&!old.fire){this.blockPadActions=true;return 'confirm';}
    if(p.chip&&!old.chip){this.blockPadActions=true;return 'back';}
    if(p.y!==old.y&&p.y)return p.y<0?'up':'down';
    if(p.x!==old.x&&p.x)return p.x<0?'left':'right';
    return null;
  }
  remap(player,action,code){
    if(['Escape','KeyP','Unidentified'].includes(code))throw new Error('That key is reserved.');
    if(this.maps.some((m,t)=>Object.entries(m).some(([a,c])=>c===code&&(t!==player||a!==action))))throw new Error('That key is already assigned.');
    this.maps[player][action]=code;
  }
}
