// Review artifacts only: reference WAVs deliberately do NOT claim to be the live Web Audio mix.
import fs from 'node:fs';
import path from 'node:path';
import { musicEvents, referencePCM, effectRecipe } from '../audio/synth.mjs';
import { THEMES } from '../audio/score.mjs';
import { hash } from '../simulation/math.mjs';
const directory=new URL('../work/browser/audio/',import.meta.url);fs.mkdirSync(directory,{recursive:true});
const report={seed:1988,reference:'Integer square-wave reference, 16 kHz mono, not the live Web Audio mix',themes:[]};
for(const mode of Object.keys(THEMES)){
  const events=musicEvents(1988,32,mode),pcm=referencePCM(events,THEMES[mode].bar*8),buffer=Buffer.alloc(44+pcm.length*2);
  buffer.write('RIFF',0);buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(16000,24);buffer.writeUInt32LE(32000,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(pcm.length*2,40);
  for(let i=0;i<pcm.length;i++)buffer.writeInt16LE(pcm[i],44+i*2);
  fs.writeFileSync(new URL(`reference-${mode}.wav`,directory),buffer);
  fs.writeFileSync(new URL(`${mode}-events.json`,directory),JSON.stringify({seed:1988,mode,bars:32,events},null,2));
  report.themes.push({mode,events:events.length,eventHash:hash(events),samples:pcm.length,pcmHash:hash(Array.from(pcm))});
}
const events=['kick','slide','post','save','bounce','wall','whistle','crowd','rain','goal'].map(type=>({type,speed:12,power:45,kind:'shot',caught:true}));
fs.writeFileSync(new URL('sfx-recipes.json',directory),JSON.stringify(events.map(event=>({event,recipe:effectRecipe(event,1988)})),null,2));
fs.writeFileSync(new URL('manifest.json',directory),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
