import {AudioEngine} from '../audio/synth.mjs';
// Captures the actual running Web Audio graph through MediaRecorder, then decodes to PCM WAV.
// This is neither the integer reference renderer nor a claim of headphone/listening QA.
export async function captureLive(){
 const engine=new AudioEngine();await engine.start();engine.volumes(.65,.35,.7);
 const destination=engine.ctx.createMediaStreamDestination();engine.bus.connect(destination);
 const mime=['audio/webm;codecs=opus','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));
 const recorder=new MediaRecorder(destination.stream,mime?{mimeType:mime}:{}),chunks=[];
 recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
 const done=new Promise(resolve=>recorder.onstop=resolve),wait=ms=>new Promise(r=>setTimeout(r,ms));
 const transitions=[];let peakVoices=0;
 const interval=setInterval(()=>{engine.update();peakVoices=Math.max(peakVoices,engine.voices.size);},16);
 recorder.start();
 for(const mode of ['menu','outdoor','indoor','goal','victory']){
  engine.setMode(mode,mode==='outdoor',1988);transitions.push({mode,at:engine.ctx.currentTime});
  engine.event({type:mode==='goal'?'goal':mode==='indoor'?'wall':'kick',kind:'shot',speed:12});
  await wait(700);engine.event({type:'save',caught:true,speed:8});await wait(500);
 }
 engine.setPaused(true);await engine.transition;const paused=engine.ctx.state,cursor=engine.cursor;await wait(120);
 if(engine.cursor!==cursor||paused!=='suspended')throw Error('Audio pause did not stop scheduling');
 engine.setPaused(false);await engine.transition;await wait(250);
 recorder.stop();await done;clearInterval(interval);
 const blob=new Blob(chunks,{type:recorder.mimeType}),decoded=await engine.ctx.decodeAudioData(await blob.arrayBuffer());
 const channels=decoded.numberOfChannels,n=decoded.length,bytes=new ArrayBuffer(44+n*channels*2),view=new DataView(bytes),data=Array.from({length:channels},(_,i)=>decoded.getChannelData(i));
 const word=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));};
 word(0,'RIFF');view.setUint32(4,bytes.byteLength-8,true);word(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,decoded.sampleRate,true);view.setUint32(28,decoded.sampleRate*channels*2,true);view.setUint16(32,channels*2,true);view.setUint16(34,16,true);word(36,'data');view.setUint32(40,n*channels*2,true);
 let peak=0,squares=0,clipped=0,maxDelta=0;
 for(let i=0;i<n;i++)for(let c=0;c<channels;c++){const v=data[c][i];peak=Math.max(peak,Math.abs(v));squares+=v*v;if(Math.abs(v)>=.999)clipped++;if(i)maxDelta=Math.max(maxDelta,Math.abs(v-data[c][i-1]));view.setInt16(44+(i*channels+c)*2,Math.round(Math.max(-1,Math.min(1,v))*32767),true);}
 await engine.ctx.close();const array=new Uint8Array(bytes);let binary='';for(let i=0;i<array.length;i+=8192)binary+=String.fromCharCode(...array.subarray(i,i+8192));
 return{wav:btoa(binary),report:{source:'Live AudioEngine -> MediaStreamDestination -> MediaRecorder Opus -> decoded PCM WAV',mime:recorder.mimeType,transitions,sampleRate:decoded.sampleRate,channels,samples:n,peak,rms:Math.sqrt(squares/(n*channels)),clippedSamples:clipped,maxSampleDelta:maxDelta,peakVoices,pause:paused,resume:'running',listening:'NOT RUN',userAgent:navigator.userAgent}};
}
