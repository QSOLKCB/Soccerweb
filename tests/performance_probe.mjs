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
