import test from 'node:test';
import assert from 'node:assert/strict';
import { musicEvents, referencePCM } from '../audio/synth.mjs';
import { hash } from '../simulation/math.mjs';
test('music event sequences repeat exactly for a seed and differ across seeds',()=>{
  assert.deepEqual(musicEvents(1988),musicEvents(1988));assert.notDeepEqual(musicEvents(1988),musicEvents(1989));
  assert.notDeepEqual(musicEvents(1988,8,'menu'),musicEvents(1988,8,'match'));
});
test('integer reference PCM has repeatable non-silent bounded output',()=>{
  const a=referencePCM(musicEvents(1988),120),b=referencePCM(musicEvents(1988),120);
  assert.deepEqual(a,b);assert.equal(a.length,32000);assert.equal(hash(Array.from(a)),'7787ba01','New score, unchanged integer reference DSP');assert.ok(a.some(n=>n!==0));assert.ok(a.every(n=>n>=-32768&&n<=32767));
  console.log(`Audio reference: 32000 mono samples at 16 kHz, hash ${hash(Array.from(a))}`);
});

import { effectRecipe, AudioEngine } from '../audio/synth.mjs';
import { THEMES } from '../audio/score.mjs';
test('all five themes have stable distinct traces with rhythm, bass, lead and harmony',()=>{
  const hashes=new Set(),expected={menu:'8a3060ba',outdoor:'ea10d607',indoor:'0016a47e',goal:'fab6f8a6',victory:'3ee0c6e0'};
  for(const mode of Object.keys(THEMES)){
    const events=musicEvents(1988,32,mode);assert.deepEqual(events,musicEvents(1988,32,mode));hashes.add(hash(events));assert.equal(hash(events),expected[mode]);
    for(const voice of ['lead','bass','harmony','kick','hat'])assert.ok(events.some(e=>e.voice===voice));
    assert.ok(events.every((e,i)=>Number.isInteger(e.tick)&&e.length>0&&(!i||e.tick>=events[i-1].tick)));
    const bar=THEMES[mode].bar;const intro=events.filter(e=>e.tick<bar*2),lift=events.filter(e=>e.tick>=bar*16&&e.tick<bar*18);
    assert.ok(lift.length>intro.length);
  }
  assert.equal(hashes.size,5);
});
test('SFX recipes are deterministic, strength-sensitive, bounded and do not consume game RNG',()=>{
  const game={rng:42},before=JSON.stringify(game);
  for(const type of ['kick','slide','slip','post','save','bounce','wall','whistle','goal','crowd','rain','menu']){
    const e={type,kind:'shot',speed:12,power:45,player:9,caught:true},r=effectRecipe(e,1988);
    assert.ok(r.length);assert.deepEqual(r,effectRecipe(e,1988));assert.ok(r.every(n=>n.duration>0&&n.duration<3&&n.gain<=.3&&n.at>=0));
  }
  assert.notDeepEqual(effectRecipe({type:'kick',speed:3}),effectRecipe({type:'kick',speed:15}));assert.equal(JSON.stringify(game),before);
});
class Param {setValueAtTime(){}exponentialRampToValueAtTime(){}linearRampToValueAtTime(){}setTargetAtTime(){}cancelAndHoldAtTime(){}}
class AudioNode {
  constructor(ctx){this.ctx=ctx;for(const name of ['gain','frequency','pan','threshold','knee','ratio','attack','release'])this[name]=new Param();}
  connect(){}disconnect(){this.disconnected=true;}start(at){this.startAt=at;this.ctx.sources.add(this);}stop(at){this.stopAt=at;}
}
class FakeContext {
  constructor(){this.currentTime=0;this.sampleRate=8000;this.state='running';this.destination={};this.sources=new Set();}
  createGain(){const n=new AudioNode(this);n.start=n.stop=undefined;return n;}
  createStereoPanner(){return this.createGain();}createDynamicsCompressor(){return this.createGain();}createBiquadFilter(){return this.createGain();}
  createOscillator(){return new AudioNode(this);}createBufferSource(){return new AudioNode(this);}
  createBuffer(_,n){return{getChannelData:()=>new Float32Array(n)};}
  async suspend(){this.state='suspended';}async resume(){this.state='running';}
  advance(t){this.currentTime+=t;for(const node of this.sources)if(node.stopAt<=this.currentTime){this.sources.delete(node);node.onended?.();}}
}
test('audio scheduler stays bounded, cleans up nodes and serializes pause/resume',async()=>{
  globalThis.window={AudioContext:FakeContext};const audio=new AudioEngine();await audio.start();
  audio.setMode('indoor',true,42);let peak=0;
  for(let i=0;i<300;i++){audio.ctx.advance(1/60);audio.update();peak=Math.max(peak,audio.voices.size);}
  assert.ok(peak>5&&peak<=64);const cursor=audio.cursor;audio.ctx.advance(200);audio.update();assert.ok(audio.cursor-cursor<=16);
  audio.setPaused(true);await audio.transition;assert.equal(audio.ctx.state,'suspended');const paused=audio.cursor;audio.update();assert.equal(audio.cursor,paused);
  audio.setPaused(true);audio.setPaused(false);await audio.transition;assert.equal(audio.ctx.state,'running');
  audio.setMode('menu');audio.ctx.advance(4);assert.equal(audio.voices.size,0);assert.equal(audio.ctx.sources.size,0);
});
