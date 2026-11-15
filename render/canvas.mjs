import { Q } from '../simulation/math.mjs';
import { TEAMS } from '../game/teams.mjs';
import { attack } from '../game/state.mjs';
import { cameraFrame } from './camera.mjs';
import { drawPlayer } from './players.mjs';
import { drawStadium, drawStadiumMotion, drawGoalposts } from './stadium.mjs';
const lerp=(a,b,t)=>a+(b-a)*t;
export class Renderer {
  constructor(canvas) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});
    this.retro=false;this.palette='classic';this.zoom='follow';this.effects='balanced';this.pixelated=false;
    this.motionQuery=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.layer=null;this.layerKey='';this.order=[];this.trail=Array.from({length:8},()=>({x:0,y:0,z:0}));this.reset();
  }
  reset(){this.camera=null;this.lastTick=-1;this.trailCount=0;}
  ground(s){
    const key=[s.w,s.h,s.config.indoor,s.config.weather,!!s.goalposts,this.palette].join(':');
    if(key!==this.layerKey){
      const layer=document.createElement('canvas');layer.width=s.w/Q+360;layer.height=s.h/Q+360;
      const c=layer.getContext('2d');c.translate(180,180);drawStadium(c,s,this.palette);
      this.layer=layer;this.layerKey=key;
    }
    this.ctx.drawImage(this.layer,-180,-180);
  }
  draw(s,previous=s,alpha=1,demo=false,dt=1/60){
    const canvas=this.canvas,c=this.ctx,w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
    const ratio=this.pixelated?.65:Math.min(globalThis.devicePixelRatio||1,2);
    if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);}
    canvas.style.imageRendering=this.pixelated?'pixelated':'auto';c.setTransform(ratio,0,0,ratio,0,0);c.imageSmoothingEnabled=false;
    const reduced=!!this.motionQuery?.matches||this.effects==='minimal',effects=this.effects!=='minimal';
    if(s.tick<this.lastTick)this.reset();
    this.camera=cameraFrame(s,w,h,{zoom:this.zoom,reduced,demo},this.camera,dt);
    const view=this.camera;
    c.fillStyle='#0f2330';c.fillRect(0,0,w,h);c.save();c.translate(w/2,h/2);c.scale(view.scale,view.scale);c.translate(-view.x,-view.y);
    this.ground(s);if(s.training?.drill==='move'){const t=s.training.target;c.strokeStyle='#ffdc68';c.lineWidth=3;c.beginPath();c.ellipse(t.x/Q,t.y/Q,35,22,0,0,Math.PI*2);c.stroke();c.font='bold 12px monospace';c.textAlign='center';c.fillStyle='#fff3bf';c.fillText('DRIBBLE HERE',t.x/Q,t.y/Q-30);}drawStadiumMotion(c,s,reduced,effects);
    if(s.goalposts){
      const interpolateGoal=previous.goalposts?.stage===s.goalposts.stage&&s.phase==='play'&&previous.goalposts.clock===s.goalposts.previousClock&&s.goalposts.clock>previous.goalposts.clock;
      drawGoalposts(c,s,{scale:view.scale,numerator:interpolateGoal?Math.round(Math.max(0,Math.min(1,alpha))*65536):1,denominator:interpolateGoal?65536:1});
    }
    if(this.order.length!==s.players.length)this.order=s.players.map(p=>p.id);
    this.order.sort((a,b)=>s.players[a].y-s.players[b].y||a-b);
    for(const id of this.order){
      const p=s.players[id],old=previous.players[id]||p;
      const x=lerp(old.x,p.x,alpha)/Q,y=lerp(old.y,p.y,alpha)/Q;
      drawPlayer(c,s,p,old,x,y,{demo,reduced,effects});
    }
    this.ball(s,previous,alpha,effects&&!reduced);
    c.restore();
    if(s.config.weather==='rain'&&!s.config.indoor&&effects){
      c.strokeStyle='#c5edf244';c.lineWidth=1;
      for(let i=0;i<65;i++){const x=(i*139+(reduced?0:s.tick*3))%w,y=(i*199+(reduced?0:s.tick*8))%h;c.beginPath();c.moveTo(x,y);c.lineTo(x-4,y+10);c.stroke();}
    }
    if(!demo)this.minimap(s,w,h);
    if(this.retro){c.fillStyle='#05111921';for(let y=0;y<h;y+=4)c.fillRect(0,y,w,1);}
    this.lastTick=s.tick;
  }
  ball(s,previous,alpha,streaks){
    const c=this.ctx,b=s.ball,old=previous.ball;
    const x=lerp(old.x,b.x,alpha)/Q,y=lerp(old.y,b.y,alpha)/Q,z=lerp(old.z,b.z,alpha)/Q;
    if(s.tick!==this.lastTick){
      for(let i=this.trail.length-1;i>0;i--)Object.assign(this.trail[i],this.trail[i-1]);
      Object.assign(this.trail[0],{x,y,z});this.trailCount=Math.min(this.trail.length,this.trailCount+1);
    }
    const speed=Math.hypot(b.vx,b.vy)/Q;
    if(streaks&&speed>6){
      for(let i=this.trailCount-1;i>0;i--){const a=this.trail[i],v=this.trail[i-1];c.strokeStyle=`rgba(255,243,183,${.32*(1-i/this.trail.length)})`;c.lineWidth=4*(1-i/this.trail.length)+1;c.beginPath();c.moveTo(a.x,a.y-a.z);c.lineTo(v.x,v.y-v.z);c.stroke();}
    }
    c.fillStyle=`rgba(7,24,30,${Math.max(.16,.4-z/300)})`;c.beginPath();c.ellipse(x+4+z*.05,y+4,6+z/24,3+z/60,0,0,Math.PI*2);c.fill();
    if(z>12){c.strokeStyle='#e5f5d665';c.lineWidth=1;c.beginPath();c.ellipse(x,y+1,7,3,0,0,Math.PI*2);c.stroke();}
    c.save();c.translate(x,y-z-3);c.rotate(s.tick*.09*(Math.sign(b.vx)||1)+speed*.1);
    const shine=c.createRadialGradient(-2,-2,1,0,0,6);shine.addColorStop(0,'#ffffff');shine.addColorStop(.65,'#f2f1de');shine.addColorStop(1,'#91a6ac');
    c.fillStyle=shine;c.strokeStyle='#122e38';c.lineWidth=1.3;c.beginPath();c.arc(0,0,5.6,0,Math.PI*2);c.fill();c.stroke();
    c.fillStyle='#203744';c.beginPath();for(let i=0;i<5;i++){const a=i*Math.PI*2/5-Math.PI/2;const px=Math.cos(a)*2.2,py=Math.sin(a)*2.2;if(i)c.lineTo(px,py);else c.moveTo(px,py);}c.closePath();c.fill();
    for(let i=0;i<3;i++){const a=i*Math.PI*2/3;c.fillRect(Math.cos(a)*4-1,Math.sin(a)*4-1,2,2);}c.restore();
    if(b.immunity>9&&streaks){c.strokeStyle='#fff2c780';c.lineWidth=1;c.beginPath();c.arc(x,y-z-3,8+(14-b.immunity)*1.2,0,Math.PI*2);c.stroke();}
  }
  minimap(s,w,h){
    const c=this.ctx,mw=w<500?60:78,mh=mw*s.h/s.w,x=w-mw-18,y=h-mh-18;
    c.fillStyle='#0b202be8';c.fillRect(x-7,y-20,mw+14,mh+27);c.strokeStyle='#b9d4c966';c.lineWidth=1;c.strokeRect(x,y,mw,mh);
    c.beginPath();c.moveTo(x,y+mh/2);c.lineTo(x+mw,y+mh/2);c.stroke();
    const view=this.camera;c.save();c.beginPath();c.rect(x,y,mw,mh);c.clip();c.strokeStyle='#c3e4df33';c.strokeRect(x+(view.x-view.vw/2)/ (s.w/Q)*mw,y+(view.y-view.vh/2)/(s.h/Q)*mh,view.vw/(s.w/Q)*mw,view.vh/(s.h/Q)*mh);c.restore();
    for(const p of s.players){c.fillStyle=TEAMS[s.config.teams[p.team]].color;const px=x+p.x/s.w*mw,py=y+p.y/s.h*mh;c.fillRect(px-1,py-1,3,3);if(s.config.humans[p.team]&&s.selected[p.team]===p.id){c.strokeStyle=c.fillStyle;c.beginPath();c.arc(px,py,3.5,0,Math.PI*2);c.stroke();}}
    c.fillStyle='#fff8d8';c.beginPath();c.arc(x+s.ball.x/s.w*mw,y+s.ball.y/s.h*mh,2.5,0,Math.PI*2);c.fill();
    c.font='bold 9px monospace';c.textAlign='center';c.fillStyle='#d7e2d7';c.fillText(attack(s,0)<0?'P1 ↑ ATTACK':'P1 ↓ ATTACK',x+mw/2,y-7);
  }
}
