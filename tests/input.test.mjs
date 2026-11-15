import test from 'node:test';
import assert from 'node:assert/strict';
import { Controls } from '../input/controls.mjs';
function setup(){
  const window=new EventTarget(),document=new EventTarget();let pads=[],pauses=[];
  globalThis.window=window;globalThis.document=document;Object.defineProperty(globalThis,'navigator',{value:{getGamepads:()=>pads},configurable:true});
  const controls=new Controls(force=>pauses.push(force));controls.active=true;
  const key=(type,code)=>{const event=new Event(type,{cancelable:true});Object.assign(event,{code,repeat:false});window.dispatchEvent(event);return event;};
  return {window,document,controls,pauses,key,pads:p=>pads=p};
}
test('independent keyboard mappings retain simultaneous keys and release correctly',()=>{
  const {controls,key}=setup();key('keydown','KeyW');key('keydown','KeyD');key('keydown','ArrowLeft');key('keydown','Space');
  const [a,b]=controls.sample();assert.deepEqual([a.x,a.y,a.fire],[1,-1,true]);assert.deepEqual([b.x,b.y,b.fire],[-1,0,false]);
  key('keyup','KeyD');assert.equal(controls.sample()[0].x,0);
});
test('blur and controller disconnect clear input and request pause',()=>{
  const {controls,key,window,pauses}=setup();key('keydown','Space');window.dispatchEvent(new Event('blur'));
  assert.equal(controls.sample()[0].fire,false);assert.equal(pauses[0],true);window.dispatchEvent(new Event('gamepaddisconnected'));assert.equal(pauses.length,2);
});
test('two gamepads map independently and start pauses only on an edge',()=>{
  const {controls,pads,pauses}=setup();const a={axes:[1,0],buttons:Array.from({length:16},()=>({pressed:false}))};a.buttons[0].pressed=true;a.buttons[9].pressed=true;
  const b={axes:[0,-1],buttons:Array.from({length:16},()=>({pressed:false}))};b.buttons[1].pressed=true;pads([a,b]);
  const i=controls.sample();controls.sample();assert.equal(i[0].fire,true);assert.equal(i[1].chip,true);assert.equal(i[1].y,-1);assert.equal(pauses.length,1);
});
test('remapping refuses reserved and conflicting keys',()=>{
  const {controls}=setup();assert.throws(()=>controls.remap(0,'fire','Escape'));assert.throws(()=>controls.remap(0,'fire','Enter'));
  controls.remap(0,'fire','KeyZ');assert.equal(controls.maps[0].fire,'KeyZ');
});
test('overlay mode releases browser navigation keys but preserves keyboard and gamepad resume',()=>{
  const {controls,key,pads,pauses}=setup();key('keydown','Space');controls.setGameplayEnabled(false);
  for(const code of ['Tab','Enter','Space','KeyW'])assert.equal(key('keydown',code).defaultPrevented,false,code);
  assert.equal(controls.keys.size,0);assert.equal(controls.sample()[0].fire,false);
  assert.equal(key('keydown','Escape').defaultPrevented,true);assert.equal(pauses.length,1);
  assert.equal(key('keydown','KeyP').defaultPrevented,true);assert.equal(pauses.length,2);
  const pad={axes:[1,0],buttons:Array.from({length:16},()=>({pressed:false}))};pad.buttons[0].pressed=true;pad.buttons[9].pressed=true;pads([pad]);
  const input=controls.sample();assert.equal(pauses.length,3);assert.equal(input[0].fire,false);assert.equal(input[0].x,0);
  controls.setGameplayEnabled(true);assert.equal(key('keydown','Tab').defaultPrevented,true);
});
