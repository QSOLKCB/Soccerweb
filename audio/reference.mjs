// Unchanged integer reference DSP from Phase 1. New composition changes its input events, not arithmetic.
const FREQ=[261626,277183,293665,311127,329628,349228,369994,391995,415305,440000,466164,493883];
export function referencePCM(events,ticks=120){
  const rate=16000,out=new Int16Array(Math.floor(ticks*rate/60));
  for(const e of events){
    const start=Math.floor(e.tick*rate/60),end=Math.min(out.length,start+Math.floor(e.length*rate/60));
    const octave=Math.floor((e.note-60)/12),idx=((e.note-60)%12+12)%12;
    const freq=Math.trunc(FREQ[idx]*(2**octave)),step=Math.trunc(freq*65536/(rate*1000));let phase=0;
    for(let n=start;n<end;n++){
      phase=(phase+step)&65535;const envelope=Math.trunc((end-n)*1800/Math.max(1,end-start));
      out[n]=Math.max(-32768,Math.min(32767,out[n]+(phase<32768?envelope:-envelope)));
    }
  }
  return out;
}
