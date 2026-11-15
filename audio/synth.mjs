import { random, clamp } from '../simulation/math.mjs';
import { musicEvents, THEMES, themeName } from './score.mjs';
import { effectRecipe } from './effects.mjs';
export { musicEvents } from './score.mjs';
export { referencePCM } from './reference.mjs';
export { effectRecipe } from './effects.mjs';
const frequency=note=>440*2**((note-69)/12);
export class AudioEngine {
  constructor(){
    this.ctx=null;this.master=.65;this.music=.35;this.sfx=.7;this.mode='menu';this.seed=1988;
    this.cursor=0;this.weather=false;this.paused=false;this.voices=new Set();this.transition=Promise.resolve();
    this.setMode('menu');
  }
  async start(){
    if(!this.ctx){
      const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;
      this.ctx=new Context();this.bus=this.ctx.createGain();this.musicBus=this.ctx.createGain();this.sfxBus=this.ctx.createGain();
      const limiter=this.ctx.createDynamicsCompressor();limiter.threshold.value=-12;limiter.knee.value=16;limiter.ratio.value=4;limiter.attack.value=.005;limiter.release.value=.15;
      this.musicBus.connect(limiter);this.sfxBus.connect(limiter);limiter.connect(this.bus);this.bus.connect(this.ctx.destination);
      this.bus.gain.value=this.master;this.musicBus.gain.value=this.music;this.sfxBus.gain.value=this.sfx;this.next=this.ctx.currentTime+.05;
    }
    if(this.ctx.state==='suspended'&&!this.paused)await this.ctx.resume();
  }
  setPaused(paused){
    this.paused=paused;if(!this.ctx)return;
    // Request resumption inside the user gesture as well as serializing the final desired state.
    if(!paused&&this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});
    // Serialize state transitions and re-read desired state, so rapid pause/resume cannot leave stale suspension.
    this.transition=this.transition.catch(()=>{}).then(async()=>{
      if(this.ctx.state==='closed')return;
      if(this.paused)await this.ctx.suspend();else {await this.ctx.resume();this.next=this.ctx.currentTime+.05;}
    });
  }
  setMode(mode,weather=false,seed=this.seed){
    this.mode=themeName(mode);this.seed=(seed>>>0)||1988;this.weather=weather;
    this.sequence=musicEvents(this.seed,32,this.mode);this.bars=32;this.loopTicks=THEMES[this.mode].bar*this.bars;
    this.buckets=new Map();for(const e of this.sequence){if(!this.buckets.has(e.tick))this.buckets.set(e.tick,[]);this.buckets.get(e.tick).push(e);}
    this.cursor=0;
    if(this.ctx){for(const voice of this.voices)if(voice.channel==='music')voice.release();this.next=this.ctx.currentTime+.06;}
  }
  volumes(master,music,sfx){
    this.master=clamp(master,0,1);this.music=clamp(music,0,1);this.sfx=clamp(sfx,0,1);
    if(this.ctx){const t=this.ctx.currentTime;this.bus.gain.setTargetAtTime(this.master,t,.025);this.musicBus.gain.setTargetAtTime(this.music,t,.025);this.sfxBus.gain.setTargetAtTime(this.sfx,t,.025);}
  }
  envelope(source,nodes,gain,duration,when,channel,pan=0,attack=.006){
    if(this.voices.size>=64){for(const node of nodes){try{node.disconnect();}catch{}}return false;}
    const ctx=this.ctx,t=Math.max(ctx.currentTime,when),v=ctx.createGain(),stereo=ctx.createStereoPanner();
    stereo.pan.value=pan;v.gain.setValueAtTime(0,t);v.gain.linearRampToValueAtTime(Math.max(.0001,gain),t+attack);v.gain.exponentialRampToValueAtTime(.0001,t+duration);
    source.connect(v);v.connect(stereo);stereo.connect(channel==='music'?this.musicBus:this.sfxBus);
    let released=false;
    const token={channel,release:()=>{
      if(released)return;released=true;
      const now=ctx.currentTime;
      if(typeof v.gain.cancelAndHoldAtTime==='function')v.gain.cancelAndHoldAtTime(now);
      else {
        // Firefox versions without cancelAndHoldAtTime still release from the envelope's current level.
        const age=now-t,level=age<=0?0:age<attack?gain*age/attack:Math.max(.0001,gain)*(.0001/Math.max(.0001,gain))**Math.min(1,(age-attack)/Math.max(.001,duration-attack));
        v.gain.cancelScheduledValues(now);v.gain.setValueAtTime(Math.max(.0001,level),now);
      }
      v.gain.setTargetAtTime(.0001,now,.012);
      for(const n of nodes)if(typeof n.stop==='function')try{n.stop(now+.065);}catch{}
    }};
    this.voices.add(token);
    source.onended=()=>{this.voices.delete(token);for(const n of [...nodes,v,stereo])try{n.disconnect();}catch{}};
    return true;
  }
  tone(recipe,when,channel='sfx'){
    if(!this.ctx)return;
    const {freq,end=freq,duration,gain,wave='triangle',pan=0,fm=0}=recipe;
    const t=Math.max(this.ctx.currentTime,when),o=this.ctx.createOscillator(),nodes=[o];o.type=wave;
    o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);
    if(fm){const mod=this.ctx.createOscillator(),amount=this.ctx.createGain();mod.frequency.value=fm<.1?8:freq*fm;amount.gain.value=fm<.1?freq*fm:freq*.45;mod.connect(amount);amount.connect(o.frequency);nodes.push(mod,amount);}
    if(!this.envelope(o,nodes,gain,duration,t,channel,pan,wave==='sine'?.012:.006))return;
    for(const n of nodes)if(typeof n.start==='function'){n.start(t);n.stop(t+duration+.025);}
  }
  noise(recipe,when,channel='sfx'){
    if(!this.ctx)return;
    const {duration,gain,seed=1,cutoff=1800,pan=0}=recipe,ctx=this.ctx,n=Math.floor(ctx.sampleRate*duration);
    const buffer=ctx.createBuffer(1,n,ctx.sampleRate),data=buffer.getChannelData(0),rng={rng:seed>>>0||1};
    for(let i=0;i<n;i++)data[i]=(random(rng)/2147483648-1);
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=cutoff;source.connect(filter);
    const t=Math.max(ctx.currentTime,when);
    // Envelope terminates on the source while the filter is the audible output.
    if(!this.envelope(filter,[source,filter],gain,duration,t,channel,pan,.012))return;
    source.onended=filter.onended;source.start(t);source.stop(t+duration+.025);
  }
  note(e,when){
    if(e.voice==='kick'){this.tone({freq:130,end:38,duration:.15,gain:e.gain,wave:'sine'},when,'music');return;}
    if(['snare','hat','clap'].includes(e.voice)){
      this.noise({duration:e.voice==='hat'?.035:.12,gain:e.gain,seed:(this.seed+e.tick*997+e.note)>>>0,cutoff:e.voice==='hat'?9500:2900,pan:e.pan},when,'music');
      if(e.voice==='snare')this.tone({freq:175,end:70,duration:.09,gain:e.gain*.5},when,'music');return;
    }
    const freq=frequency(e.note),harmony=e.voice==='harmony';
    this.tone({freq,duration:Math.max(.05,e.length/60),gain:e.gain,wave:harmony?'sine':e.voice==='bass'?'triangle':'triangle',pan:e.pan,fm:e.voice==='arp'?2:0},when,'music');
  }
  update(){
    if(!this.ctx||this.ctx.state!=='running'||this.paused||this.master===0)return;
    if(this.next<this.ctx.currentTime-.2)this.next=this.ctx.currentTime+.04;
    let scheduled=0;
    while(this.next<this.ctx.currentTime+.12&&scheduled++<16){
      for(const e of this.buckets.get(this.cursor%this.loopTicks)||[])this.note(e,this.next);
      if(this.cursor%180===0&&['outdoor','indoor'].includes(this.mode))this.event({type:'crowd',speed:3},this.next);
      if(this.cursor%90===0&&this.weather)this.event({type:'rain'},this.next);
      this.cursor++;this.next+=1/60;
    }
  }
  event(e,when=this.ctx?.currentTime||0){
    if(!this.ctx||this.paused)return;
    for(const recipe of effectRecipe({...e,indoor:this.mode==='indoor'},this.seed)){
      if(recipe.kind==='noise')this.noise(recipe,when+recipe.at);
      else this.tone(recipe,when+recipe.at);
    }
  }
}
