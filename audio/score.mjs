import { random } from '../simulation/math.mjs';
// Original authored motifs with seeded fills/voicings. Notes are MIDI numbers; times are 60 Hz score ticks.
export const THEMES = Object.freeze({
  menu: {root:50,bar:160,minor:true,progression:[0,5,3,7],motif:[0,7,3,10,7,5,2,3]},
  outdoor: {root:50,bar:144,minor:false,progression:[0,7,9,5],motif:[0,4,7,9,7,2,4,12]},
  indoor: {root:45,bar:112,minor:true,progression:[0,5,8,7],motif:[0,7,12,3,10,7,5,2]},
  goal: {root:62,bar:96,minor:false,progression:[0,5,7,0],motif:[0,4,7,12,9,7,12,16]},
  victory: {root:57,bar:144,minor:false,progression:[0,5,9,7],motif:[0,7,9,12,7,4,2,0]}
});
export function themeName(mode){return mode==='match'?'outdoor':Object.hasOwn(THEMES,mode)?mode:'menu';}
export function musicEvents(seed,bars=32,mode='menu') {
  mode=themeName(mode);const t=THEMES[mode],rng={rng:(seed>>>0)||1},events=[];
  const put=(tick,note,length,voice,gain,pan=0)=>events.push({tick,note,length,voice,gain,pan});
  for(let bar=0;bar<bars;bar++){
    const section=Math.floor(bar/8)%4,step=t.bar/8,root=t.root+t.progression[Math.floor(bar/2)%4];
    const third=t.minor?3:t.progression[Math.floor(bar/2)%4]===9?3:4;
    const phrase=bar%4,variation=random(rng)%3,chorus=section===2||mode==='goal'||mode==='victory';
    // Intro / verse / lift / turnaround have different density, register and percussion.
    for(let beat=0;beat<8;beat++){
      const tick=bar*t.bar+beat*step;
      if(!(section===0&&bar<2&&beat%2===1)&&!(section===3&&beat===7)){
        const motif=t.motif[(beat+phrase*2)%8],octave=chorus?12:0;
        const ornament=bar%8===7&&beat>=6?variation*2:0;
        put(tick,root+motif+octave+ornament,Math.round(step*(beat%2?.65:.9)),'lead',chorus?.047:.034,Math.sin(phrase)*.12);
      }
      if(beat%2===0||mode==='indoor'&&beat===7)put(tick,root-12+(beat===6?7:0),Math.round(step*1.3),'bass',.08);
      if(beat===0||beat===4||mode==='indoor'&&(beat===3||beat===6))put(tick,36,8,'kick',.15);
      if(beat===2||beat===6)put(tick,38,9,mode==='indoor'?'clap':'snare',.055);
      if(section!==0||beat%2===0)put(tick+(mode==='indoor'&&beat%2?1:0),84,3,'hat',beat%2?.018:.027,beat%2?.35:-.35);
      if(mode==='indoor'&&section!==0&&beat%2===1)put(tick+Math.round(step/2),root+12+[0,third,7][beat%3],Math.round(step*.4),'arp',.022,beat%4<2?-.5:.5);
    }
    for(const note of [root,root+third,root+7])put(bar*t.bar,note,Math.round(t.bar*(mode==='indoor'?.45:.85)),'harmony',.014,note===root?-.45:.45);
    if(chorus)put(bar*t.bar+t.bar/2,root+19,Math.round(t.bar*.4),'harmony',.012,.35);
    if(bar%8===7)for(let n=0;n<3;n++)put((bar+1)*t.bar-(3-n)*Math.round(step/2),38,5,'snare',.035+n*.006,(n-1)*.25);
  }
  // Explicit tie order makes the event trace stable even on hosts with different sort implementations.
  return events.map((e,i)=>({...e,order:i})).sort((a,b)=>a.tick-b.tick||a.order-b.order).map(({order,...e})=>e);
}
