import {createState,EMPTY} from '../game/state.mjs';
import {step} from '../game/match.mjs';
import {Renderer} from '../render/canvas.mjs';
const summary=a=>{const s=[...a].sort((x,y)=>x-y);return{samples:s.length,meanMs:s.reduce((x,y)=>x+y,0)/s.length,p95Ms:s[Math.floor(s.length*.95)],maxMs:s.at(-1)};};
export async function measure(options={}){
 const canvas=document.createElement('canvas');canvas.style.cssText='width:100vw;height:90vh;display:block';document.body.replaceChildren(canvas);
 const renderer=new Renderer(canvas);renderer.zoom=options.camera||'follow';
 const state=createState({humans:[false,false],seed:731,seconds:120,...options});
 const samples={update:[],snapshot:[],render:[],raf:[]};let last;
 for(let i=0;i<330;i++){
  const now=await new Promise(requestAnimationFrame);let t=performance.now();const previous=structuredClone(state);const clone=performance.now()-t;
  t=performance.now();step(state,[EMPTY,EMPTY]);const update=performance.now()-t;
  t=performance.now();renderer.draw(state,previous,1,false,1/60);const render=performance.now()-t;
  if(i>=30){samples.snapshot.push(clone);samples.update.push(update);samples.render.push(render);samples.raf.push(now-last);}last=now;
 }
 return{options,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,userAgent:navigator.userAgent,logicalCPUs:navigator.hardwareConcurrency,
  stages:Object.fromEntries(Object.entries(samples).map(([k,v])=>[k,summary(v)])),longRAF:samples.raf.filter(n=>n>33.4).length,
  heap:performance.memory?{usedBytes:performance.memory.usedJSHeapSize,totalBytes:performance.memory.totalJSHeapSize}:null};
}

import {Recorder,verifyReplay,stateHash} from '../replay/replay.mjs';
export function fixedReplayProbe(){
 const s=createState({seed:731,weather:'rain',aftertouch:2}),r=new Recorder(s);
 for(let i=0;i<4000;i++){
  const input=[{...EMPTY,x:i%170<80?1:-1,y:-1,fire:i%90<50,curve:i%190<95?1:-1},{...EMPTY}];
  step(s,input);r.record(s,input);
 }
 const data=r.export(s),verified=verifyReplay(JSON.parse(JSON.stringify(data)));
 return{version:s.version,ticks:s.tick,checkpoints:data.checkpoints.length,hash:stateHash(s),verifiedHash:stateHash(verified)};
}
