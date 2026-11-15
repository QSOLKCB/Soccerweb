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
  assert.deepEqual(a,b);assert.equal(a.length,32000);assert.ok(a.some(n=>n!==0));assert.ok(a.every(n=>n>=-32768&&n<=32767));
  console.log(`Audio reference: 32000 mono samples at 16 kHz, hash ${hash(Array.from(a))}`);
});
