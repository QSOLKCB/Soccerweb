// Read-only browser inspection harness. Production simulation and Canvas renderer only.
import {createState} from '../game/state.mjs';
import {step} from '../game/match.mjs';
import {stateHash} from '../replay/replay.mjs';
import {Renderer} from '../render/canvas.mjs';
export function inspect(config){
 const state=createState(config);
 if(state.config.mode||state.config.humans.some(Boolean)||state.config.knockout)throw Error('Regulation AI only');
 const canvas=document.querySelector('canvas'),renderer=new Renderer(canvas);renderer.zoom='wide';
 let previous=structuredClone(state);
 return {
  advance(tick){
   if(!Number.isInteger(tick)||tick<state.tick||tick>120000)throw Error('Invalid target tick');
   // Warm camera/trails for 120 ticks before each sparse event window. Not live RAF pacing.
   while(state.tick<tick&&state.phase!=='fulltime'){
    previous=structuredClone(state);step(state);
    if(state.tick>=tick-120)renderer.draw(state,previous,1,false,1/60);
   }
   if(state.tick!==tick)throw Error('Capture past full time');
   const hash=stateHash(state);renderer.draw(state,previous,1,false,1/60);
   if(stateHash(state)!==hash)throw Error('Renderer mutated simulation');
   const pixels=renderer.ctx.getImageData(0,0,canvas.width,canvas.height).data;
   const colors=new Set();let sum=0,sum2=0;
   // Objective, bounded pixel baseline: blank/flat canvas, plus sequence pixel change in Python.
   for(let i=0;i<pixels.length;i+=64){const v=(pixels[i]+pixels[i+1]+pixels[i+2])/3;sum+=v;sum2+=v*v;colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);}
   const n=Math.ceil(pixels.length/64),variance=sum2/n-(sum/n)**2;
   const view=renderer.camera,b=state.ball,ballScreen={x:canvas.clientWidth/2+(b.x/256-view.x)*view.scale,y:canvas.clientHeight/2+(b.y/256-b.z/256-3-view.y)*view.scale};
   return {tick:state.tick,activeSeconds:state.elapsed/60,hash,score:[...state.score],phase:state.phase,events:structuredClone(state.events),canvas:[canvas.width,canvas.height],camera:{...view},ballScreen,
    cv:{sampledColors:colors.size,variance,nonblank:colors.size>32&&variance>10},renderContract:'Production Canvas; inspection page has no app HUD/audio/RAF. No authored state or score injection. 120-tick camera warmup.'};
  },
  finish(){while(state.phase!=='fulltime'&&state.tick<120000)step(state);return{tick:state.tick,hash:stateHash(state),phase:state.phase};}
 };
}
