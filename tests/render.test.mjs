import test from 'node:test';
import assert from 'node:assert/strict';
import { Renderer } from '../render/canvas.mjs';
import { cameraFrame } from '../render/camera.mjs';
import { playerPose } from '../render/players.mjs';
import { createState } from '../game/state.mjs';
import { Q } from '../simulation/math.mjs';
import { stateHash } from '../replay/replay.mjs';
function canvas(width=1280,height=720){
  const counts={};const ctx=new Proxy({}, {get(target,key){if(key in target)return target[key];if(key==='createLinearGradient'||key==='createRadialGradient')return()=>({addColorStop(){}});return(...args)=>{counts[key]=(counts[key]||0)+1;};}});
  return{clientWidth:width,clientHeight:height,width:0,height:0,style:{},getContext:()=>ctx,counts};
}
test('renderer leaves simulation and previous snapshot untouched, reuses static ground, supports resize/DPI',()=>{
  let layers=0;globalThis.document={createElement:()=>{layers++;return canvas();}};globalThis.devicePixelRatio=2;
  const s=createState(),prev=structuredClone(s),before=stateHash(s),old=stateHash(prev),screen=canvas(),r=new Renderer(screen);
  r.draw(s,prev,.5);r.draw(s,prev,.8);
  assert.equal(stateHash(s),before);assert.equal(stateHash(prev),old);assert.equal(layers,1);
  assert.equal(screen.width,2560);assert.equal(screen.height,1440);
  screen.clientWidth=390;screen.clientHeight=620;r.draw(s);assert.equal(screen.width,780);assert.equal(layers,1);
  r.palette='mint';r.draw(s);assert.equal(layers,2);
  r.pixelated=true;r.draw(s);assert.equal(screen.width,254);assert.equal(screen.style.imageRendering,'pixelated');
  assert.ok(screen.counts.drawImage>=5);
});
test('camera keeps fast elevated balls visible at every corner and zoom on narrow/wide screens',()=>{
  for(const [w,h]of[[390,620],[1365,760],[800,300]])for(const zoom of ['follow','wide','close'])for(const [x,y]of[[8,8],[712,8],[8,1112],[712,1112]]){
    const s=createState();Object.assign(s.ball,{x:x*Q,y:y*Q,z:150*Q,vx:15*Q,vy:-15*Q});
    const v=cameraFrame(s,w,h,{zoom},{x:360,y:560},1/60);
    const px=w/2+(x-v.x)*v.scale,py=h/2+(y-150-v.y)*v.scale;
    assert.ok(px>=0&&px<=w&&py>=0&&py<=h,JSON.stringify({w,h,zoom,px,py}));
  }
});
test('cosmetic poses distinguish actions without adding authoritative animation fields',()=>{
  const states={idle:{},run:{vx:Q},sprint:{vx:3*Q},windup:{charge:30},slide:{slide:8},fall:{slip:8},dive:{dive:10}};
  for(const [name,fields]of Object.entries(states)){const s=createState();s.phase='play';const p=s.players[9];Object.assign(p,fields);assert.equal(playerPose(s,p).state,name);}
  const s=createState();s.phase='play';const p=s.players[9];p.vx=Q;p.fx=Q;assert.equal(playerPose(s,p,{...p,fx:-Q}).state,'turn');
  p.cooldown=10;s.ball.kicker=p.id;s.ball.kind='pass';assert.equal(playerPose(s,p).state,'pass');s.ball.kind='shot';assert.equal(playerPose(s,p).state,'kick');
  const k=s.players[0];s.ball.owner=k.id;assert.equal(playerPose(s,k).state,'catch');
  s.phase='goal';s.restartTeam=1;assert.equal(playerPose(s,p).state,'celebrate');
  const reduced=playerPose(s,p,p,true);assert.equal(reduced.stride,0);assert.equal(reduced.bounce,0);
});

test('GOALPOSTS frames remain uncached and visible with reduced motion, all cameras and DPR',()=>{
 let layers=0;globalThis.document={createElement:()=>{layers++;return canvas();}};globalThis.devicePixelRatio=2;
 const s=createState({mode:'goalposts'}),screen=canvas(900,900),r=new Renderer(screen);r.effects='minimal';
 const before=stateHash(s);r.draw(s);assert.equal(stateHash(s),before);const original=layers;
 s.goalposts.clock=420;s.goalposts.previousClock=419;r.draw(s);assert.equal(layers,original);
 for(const zoom of ['follow','wide','close'])for(const y of [0,400,1110]){
  Object.assign(s.ball,{x:650*Q,y:y*Q,z:50*Q});const view=cameraFrame(s,900,900,{zoom,reduced:true});
  for(const [x,py] of [[490-90,-65],[490+90,-65],[650,y-50]]){
   assert.ok(450+(x-view.x)*view.scale>=0&&450+(x-view.x)*view.scale<=900);
   assert.ok(450+(py-view.y)*view.scale>=0&&450+(py-view.y)*view.scale<=900);
  }
 }
 r.draw(createState());assert.equal(layers,original+1,'normal pitch has a different cached frame layer');
});
