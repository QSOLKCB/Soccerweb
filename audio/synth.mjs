import { random } from '../simulation/math.mjs';
const SCALE=[0,3,5,7,10,12,15,17];
export function musicEvents(seed, bars=8, mode='menu'){
  const rng={rng:seed>>>0||1},out=[];
  for(let bar=0;bar<bars;bar++)for(let beat=0;beat<8;beat++){
    const note=SCALE[(random(rng)%5+bar)%SCALE.length];
    out.push({tick:bar*120+beat*15,note:48+note+(mode==='menu'?12:0),length:beat%2?9:13,voice:'lead',gain:beat%2?.035:.05});
    if(beat%2===0)out.push({tick:bar*120+beat*15,note:36+SCALE[bar%4],length:23,voice:'bass',gain:.08});
    out.push({tick:bar*120+beat*15,note:beat%4===0?42:85,length:4,voice:beat%4===0?'kick':'hat',gain:.03});
  }
  return out;
}
// Integer-only reference square-wave PCM, 16 kHz mono. Frequencies are integer millihertz.
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
export class AudioEngine {
  constructor(){this.ctx=null;this.master=.65;this.music=.35;this.sfx=.7;this.mode='menu';this.cursor=0;this.sequence=musicEvents(1988);this.weather=false;}
  async start(){
    if(!this.ctx){const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;this.ctx=new Context();this.bus=this.ctx.createGain();this.bus.connect(this.ctx.destination);this.bus.gain.value=this.master;this.next=this.ctx.currentTime+.1;}
    if(this.ctx.state==='suspended')await this.ctx.resume();
  }
  setMode(mode,weather=false){this.mode=mode;this.weather=weather;this.sequence=musicEvents(1988,8,mode);this.cursor=0;if(this.ctx)this.next=this.ctx.currentTime+.1;}
  volumes(master,music,sfx){this.master=master;this.music=music;this.sfx=sfx;if(this.bus)this.bus.gain.value=master;}
  tone(freq,duration,gain,type='square',when=0,slide=1){
    if(!this.ctx||gain===0)return;const t=Math.max(this.ctx.currentTime,when),o=this.ctx.createOscillator(),v=this.ctx.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,freq*slide),t+duration);
    v.gain.setValueAtTime(0,t);v.gain.linearRampToValueAtTime(gain,t+.008);v.gain.exponentialRampToValueAtTime(.0001,t+duration);
    o.connect(v);v.connect(this.bus);o.start(t);o.stop(t+duration+.02);
  }
  noise(duration,gain,seed=1,filter=1800){
    if(!this.ctx||gain===0)return;const n=Math.floor(this.ctx.sampleRate*duration),buffer=this.ctx.createBuffer(1,n,this.ctx.sampleRate),data=buffer.getChannelData(0),rng={rng:seed};
    for(let i=0;i<n;i++)data[i]=((random(rng)/4294967296)*2-1)*(1-i/n);
    const source=this.ctx.createBufferSource(),v=this.ctx.createGain(),f=this.ctx.createBiquadFilter();source.buffer=buffer;f.type='lowpass';f.frequency.value=filter;v.gain.value=gain;source.connect(f);f.connect(v);v.connect(this.bus);source.start();
  }
  update(){
    if(!this.ctx||this.ctx.state!=='running')return;
    if(this.next<this.ctx.currentTime-.3)this.next=this.ctx.currentTime+.05;
    while(this.next<this.ctx.currentTime+.15){
      const tick=this.cursor%960;
      for(const e of this.sequence)if(e.tick===tick){
        if(e.voice==='kick')this.tone(100,.10,this.music*.09,'sine',this.next,.3);
        else if(e.voice==='hat')this.tone(6800,.025,this.music*.018,'triangle',this.next,.4);
        else this.tone(440*2**((e.note-69)/12),e.length/60,this.music*e.gain,e.voice==='bass'?'triangle':'square',this.next);
      }
      if(this.cursor%120===0&&this.mode!=='menu')this.noise(2,this.sfx*.028,1988+this.cursor,500);
      if(this.cursor%60===0&&this.weather)this.noise(1.1,this.sfx*.03,4000+this.cursor,4500);
      this.cursor++;this.next+=1/60;
    }
  }
  event(e){
    const v=this.sfx;
    if(e.type==='kick')this.tone(e.kind==='pass'?170:100,.12,v*.16,'triangle',0,.35);
    else if(e.type==='goal'){[523,659,784,1046].forEach((f,i)=>this.tone(f,.5,v*.13,'square',(this.ctx?.currentTime||0)+i*.12));this.noise(1.5,v*.22,912,2500);}
    else if(e.type==='whistle'||e.type==='goldengoal')this.tone(2200,.3,v*.09,'sine',0,1.15);
    else if(e.type==='menu')this.tone(660,.07,v*.07,'square',0,1.5);
    else if(['save','post','wall','bounce'].includes(e.type))this.tone(e.type==='post'?440:95,.10,v*.10,'triangle',0,.6);
    else if(['slide','slip'].includes(e.type))this.noise(.2,v*.06,12,1100);
  }
}
