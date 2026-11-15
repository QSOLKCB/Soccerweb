import {goalGeometry} from '../modes/goalposts.mjs';
// Static world layer is drawn once per ground/weather/palette change, not once per frame.
export function drawStadium(c,s,palette='classic') {
  const w=s.w/256,h=s.h/256,indoor=s.config.indoor,wet=s.config.weather==='rain'&&!indoor;
  c.fillStyle=indoor?'#101f37':'#112b31';c.fillRect(-180,-180,w+360,h+360);
  const crowd=['#dbb175','#7398b2','#bf6b7f','#b8cbb5','#577c7b','#d0cfb8'];
  for(let side=0;side<2;side++)for(let row=0;row<6;row++){
    c.fillStyle=row%2?'#182f39':'#1b333d';c.fillRect(side?w+59+row*13:-72-row*13,-150,13,h+300);
    for(let seat=-6;seat<Math.ceil(h/12)+6;seat++){
      const x=side?w+63+row*13:-68-row*13,y=seat*12+(row%2)*5;
      c.fillStyle='#0b1c29';c.fillRect(x-2,y+4,9,6);
      c.fillStyle=crowd[((seat*7+row*5+side+999)%crowd.length)];c.fillRect(x,y,5,6);
      c.fillStyle='#cfaa80';c.fillRect(x+1,y-2,3,3);
    }
  }
  for(const top of [true,false])for(let row=0;row<6;row++)for(let seat=-7;seat<w/12+7;seat++){
    const x=seat*12+row%2*5,y=top?-70-row*13:h+64+row*13;
    c.fillStyle=crowd[(seat*7+row*5+999)%crowd.length];c.fillRect(x,y,6,6);c.fillStyle='#cdab86';c.fillRect(x+1,y-3,4,3);
  }
  c.fillStyle='#071a23';c.fillRect(-49,-47,w+98,h+94);
  c.fillStyle=indoor?'#5a7e93':'#d1c9a2';c.fillRect(-35,-29,w+70,h+58);
  c.fillStyle=indoor?'#183b55':'#264838';c.fillRect(-28,-23,w+56,h+46);
  const colors=indoor?['#2c6e83','#30758a']:palette==='mint'?['#408d6c','#459573']:wet?['#2d6e5d','#327763']:['#32764e','#398254'];
  for(let i=0;i<16;i++){c.fillStyle=colors[i%2];c.fillRect(0,i*h/16,w,h/16+1);}
  // Original deterministic grass blades / arena floor grain, independent of match RNG.
  for(let i=0;i<(indoor?1800:6500);i++){
    c.fillStyle=i%3===0?'#c3da8c12':'#0c332a12';c.fillRect((i*137)%w,(i*211+Math.floor(i/7)*17)%h,indoor?5:1,indoor?1:2);
  }
  if(indoor){c.strokeStyle='#77b0bc18';c.lineWidth=1;for(let x=0;x<w;x+=24){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}}
  if(wet){c.fillStyle='#c5e6e810';for(let i=0;i<22;i++){c.beginPath();c.ellipse((i*137+35)%w,(i*251+19)%h,18+i%4*9,4,0,0,Math.PI*2);c.fill();}}
  c.strokeStyle=indoor?'#cce4e3ba':'#e2edc5bd';c.lineWidth=2;
  c.strokeRect(2,2,w-4,h-4);c.beginPath();c.moveTo(0,h/2);c.lineTo(w,h/2);c.stroke();
  c.beginPath();c.arc(w/2,h/2,indoor?63:82,0,Math.PI*2);c.stroke();c.fillStyle='#f0edd3';c.fillRect(w/2-2,h/2-2,4,4);
  for(const top of [true,false]){
    const d=indoor?112:166,bw=indoor?280:360;
    c.strokeRect((w-bw)/2,top?0:h-d,bw,d);c.strokeRect(w/2-99,top?0:h-56,198,56);
    c.beginPath();c.arc(w/2,top?114:h-114,64,top?.3:Math.PI+.3,top?Math.PI-.3:2*Math.PI-.3);c.stroke();
    c.fillRect(w/2-2,top?113:h-115,4,4);
    if(s.goalposts)continue; // Moving mode draws both frames outside the cached layer.
    const gy=top?-31:h,gw=s.goal/256;
    c.fillStyle='#061a2a75';c.fillRect(w/2-gw/2+6,gy+4,gw,30);
    c.fillStyle='#cce9e91b';c.fillRect(w/2-gw/2,gy,gw,31);
    c.strokeStyle='#d5eaeb70';c.lineWidth=.8;
    for(let x=w/2-gw/2;x<=w/2+gw/2;x+=8){c.beginPath();c.moveTo(x,gy);c.lineTo(x+4,gy+31);c.stroke();}
    for(let y=gy;y<=gy+31;y+=6){c.beginPath();c.moveTo(w/2-gw/2,y);c.lineTo(w/2+gw/2,y);c.stroke();}
    c.strokeStyle='#f2f0de';c.lineWidth=4;c.strokeRect(w/2-gw/2,gy,gw,31);c.strokeStyle='#d8e9caaf';c.lineWidth=2;
  }
  if(indoor){
    c.strokeStyle='#0b1e34';c.lineWidth=14;c.strokeRect(-7,-7,w+14,h+14);
    c.strokeStyle='#a1dce1';c.lineWidth=6;c.strokeRect(-5,-5,w+10,h+10);
    c.strokeStyle='#3da3c2';c.lineWidth=2;c.strokeRect(-11,-11,w+22,h+22);
    for(let y=20;y<h;y+=65){c.fillStyle='#b6e0e34a';c.fillRect(-24,y,12,38);c.fillRect(w+12,y,12,38);}
  }else for(const [x,y]of[[0,0],[w,0],[0,h],[w,h]]){
    c.fillStyle='#eff1d3';c.fillRect(x-1,y-16,2,16);c.fillStyle='#edbe55';c.beginPath();c.moveTo(x+1,y-16);c.lineTo(x+11,y-13);c.lineTo(x+1,y-10);c.fill();
    c.strokeStyle='#e1eac4';c.lineWidth=1;c.beginPath();c.arc(x,y,12,0,Math.PI*2);c.stroke();
  }
  c.font='bold 10px monospace';c.textAlign='center';
  for(let y=80;y<h;y+=205)for(const side of [false,true]){
    c.save();c.translate(side?w+22:-17,y);c.rotate(side?Math.PI/2:-Math.PI/2);
    c.fillStyle=indoor?'#8de6e8':'#ebca69';c.fillText(indoor?'NIGHT COURT · SIX A SIDE':'SOCCERWEB · THE BEAUTIFUL GAME',0,0);c.restore();
  }
  const light=c.createLinearGradient(0,0,w,h);light.addColorStop(0,'#e7efbf0b');light.addColorStop(.45,'#ffffff00');light.addColorStop(1,'#031a2924');c.fillStyle=light;c.fillRect(0,0,w,h);
}
export function drawStadiumMotion(c,s,reduced,effects) {
  const w=s.w/256,h=s.h/256;
  if(!effects)return;
  if(s.phase==='goal'&&!reduced){
    const t=150-s.timer,atTop=s.ball.y<s.h/2,gy=atTop?-25:h+5;
    c.strokeStyle='#eefcff99';c.lineWidth=1;
    for(let i=0;i<(s.goalposts?0:8);i++){const x=w/2-70+i*20;const sway=Math.sin(t*.6+i)*Math.max(0,1-t/100)*6;c.beginPath();c.moveTo(x,gy);c.quadraticCurveTo(x+sway,gy+15,x,gy+28);c.stroke();}
    for(let i=0;i<65;i++){const x=(i*83+t*(i%3-1))%(w+60)-30,y=(i*79+t*3)%(h+60)-30;c.fillStyle=['#f0ca58','#f6f2d9','#91ddcb','#ef839a'][i%4];c.fillRect(x,y,3,5);}
    for(let i=0;i<35;i++){const x=(i*23)%w,hop=Math.sin(t*.4+i)*3;c.fillStyle='#f0c58c';c.fillRect(x,atTop?-70+hop:h+64+hop,3,6);}
  }
  if(s.config.weather==='rain'&&!s.config.indoor){
    c.strokeStyle='#c1e0de35';c.lineWidth=1;
    for(let i=0;i<18;i++){const x=(i*131+27)%w,y=(i*239+71)%h;c.beginPath();c.ellipse(x,y,reduced?4:((s.tick+i*3)%28)/4,2,0,0,Math.PI*2);c.stroke();}
  }
}

// Actual frame geometry remains visible even with minimal effects / reduced motion.
export function drawGoalposts(c,s){
 if(!s.goalposts)return;
 for(const end of [0,s.h]){
  const g=goalGeometry(s,end),l=g.left/256,r=g.right/256,y=end/256,h=g.height/256,depth=end===0?-22:22;
  c.fillStyle='#b9eee426';c.strokeStyle='#a7e5dc88';c.lineWidth=1;
  c.beginPath();c.moveTo(l,y);c.lineTo(l,y-h);c.lineTo(r,y-h);c.lineTo(r,y);c.closePath();c.fill();
  for(let x=l;x<=r;x+=10){c.beginPath();c.moveTo(x,y);c.lineTo(x,y-h);c.lineTo(x,y-h+depth);c.stroke();}
  for(let z=0;z<=h;z+=8){c.beginPath();c.moveTo(l,y-z);c.lineTo(r,y-z);c.stroke();}
  c.strokeStyle=end===0?'#ffe074':'#f4f1df';c.lineWidth=4;
  c.beginPath();c.moveTo(l,y);c.lineTo(l,y-h);c.lineTo(r,y-h);c.lineTo(r,y);c.stroke();
  c.lineWidth=2;c.strokeStyle='#f4ce6577';c.beginPath();c.moveTo(l,y);c.lineTo(r,y);c.stroke();
  if(end===0){c.fillStyle='#ffe074';c.font='bold 11px monospace';c.textAlign='center';c.fillText(s.goalposts.stage===2?'GOAL = 1 · CURVED SHOT = 2':'CURRENT STANDARD',g.center/256,y-h-12);}
 }
}
