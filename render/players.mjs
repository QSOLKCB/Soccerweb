import { Q } from '../simulation/math.mjs';
import { TEAMS } from '../game/teams.mjs';
// Pose selection is a pure observation of authoritative state, not an animation state machine in physics.
export function playerPose(s, p, previous = p, reduced = false) {
  const speed = Math.hypot(p.vx, p.vy) / Q;
  const celebrating = s.phase === 'goal' && p.team === 1 - s.restartTeam;
  let state = 'idle';
  if (celebrating) state = 'celebrate';
  else if (p.slip) state = 'fall';
  else if (p.slide) state = 'slide';
  else if (p.dive) state = 'dive';
  else if (p.keeper && s.ball.owner === p.id) state = 'catch';
  else if (p.charge) state = 'windup';
  else if (s.ball.kicker === p.id && p.cooldown > 0 && p.cooldown <= 18) state = s.ball.kind === 'pass' ? 'pass' : 'kick';
  else if (Math.abs(p.fx - previous.fx) + Math.abs(p.fy - previous.fy) > 100 && speed > .5) state = 'turn';
  else if (speed > 2.8 && s.ball.owner !== p.id) state = 'sprint';
  else if (speed > .3) state = 'run';
  const moving = ['run','sprint','turn','windup'].includes(state) && speed > .3;
  const phase = (s.tick * (state === 'sprint' ? .42 : .32) + p.id * 1.7);
  return { state, speed, facingX:p.fx/Q, facingY:p.fy/Q,
    stride: moving && !reduced ? Math.sin(phase) : 0,
    bounce: reduced ? 0 : celebrating ? Math.abs(Math.sin(s.tick*.2+p.id))*4 : moving ? Math.abs(Math.sin(phase))*1.2 : 0,
    strike:['kick','pass'].includes(state) ? Math.sin((18-p.cooldown)/18*Math.PI) : 0 };
}
function limb(c, x1,y1,x2,y2,x3,y3,skin,cloth,boot=false) {
  c.lineCap='round';c.lineJoin='round';
  c.strokeStyle='#10252c';c.lineWidth=5;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.lineTo(x3,y3);c.stroke();
  c.strokeStyle=cloth;c.lineWidth=3;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();
  c.strokeStyle=skin;c.lineWidth=2.6;c.beginPath();c.moveTo(x2,y2);c.lineTo(x3,y3);c.stroke();
  if(boot){c.fillStyle='#14232b';c.fillRect(x3-2,y3-1,5,3);c.fillStyle='#f1f0d9';c.fillRect(x3+1,y3-1,2,1);}
}
export function drawPlayer(c,s,p,old,x,y,{demo=false,reduced=false,effects=true}={}) {
  const pose=playerPose(s,p,old,reduced),kit=TEAMS[s.config.teams[p.team]];
  const shirt=p.keeper?(p.team===0?'#76dfcb':'#b9a2ff'):kit.color;
  const dark=p.keeper?'#233b45':kit.dark;
  const skin=['#e7b68a','#c88e68','#92583e','#ddab83'][p.id%4];
  c.fillStyle='#0a292c55';c.beginPath();c.ellipse(x+5,y+4,pose.state==='dive'?17:11,4,0,0,Math.PI*2);c.fill();
  if(s.ball.owner===p.id){c.strokeStyle='#f9f3c480';c.lineWidth=1.2;c.beginPath();c.ellipse(x,y+2,11,5,0,0,Math.PI*2);c.stroke();}
  const selected=!demo&&s.config.humans[p.team]&&s.selected[p.team]===p.id;
  if(selected){
    c.strokeStyle=p.team===0?'#ffda65':'#85e8ff';c.lineWidth=2;c.beginPath();c.ellipse(x,y+3,16,7,0,0,Math.PI*2);c.stroke();
    c.fillStyle='#132b36';c.fillRect(x-11,y-47,22,12);c.fillStyle=c.strokeStyle;
    c.font='bold 9px monospace';c.textAlign='center';c.fillText(`P${p.team+1}`,x,y-38);
    c.beginPath();c.moveTo(x-4,y-32);c.lineTo(x+4,y-32);c.lineTo(x,y-27);c.fill();
    if(s.ball.owner===p.id){c.strokeStyle='#fff5b480';c.lineWidth=1;c.beginPath();c.moveTo(x+p.fx/Q*18,y+p.fy/Q*18);c.lineTo(x+p.fx/Q*26,y+p.fy/Q*26);c.stroke();}
  }
  c.save();c.translate(x,y-pose.bounce);c.scale(1.12,1.12);
  const lying=['slide','fall','dive'].includes(pose.state);
  if(lying){c.translate(0,-3);c.rotate(pose.facingX>=0?1.05:-1.05);}
  const lean=pose.state==='turn'?pose.facingX*2:pose.facingX*.8;
  const step=pose.stride*4, strike=pose.strike*8;
  limb(c,-3,-5,-4,-1+step*.35,-4-pose.facingX*strike,4+step-pose.facingY*strike,shirt,dark,true);
  limb(c,3,-5,4,-1-step*.35,4,4-step,shirt,dark,true);
  const armsUp=['celebrate','catch','dive'].includes(pose.state);
  const armSwing=pose.stride*3;
  limb(c,-6+lean,-16,-9,-11+armSwing,-9-(armsUp?3:0),armsUp?-25:-6+armSwing,p.keeper?'#e7f8ed':skin,shirt);
  limb(c,6+lean,-16,9,-11-armSwing,9+(armsUp?3:0),armsUp?-25:-6-armSwing,p.keeper?'#e7f8ed':skin,shirt);
  c.fillStyle='#102630';c.beginPath();c.moveTo(-6+lean,-18);c.lineTo(6+lean,-18);c.lineTo(5,-6);c.lineTo(-5,-6);c.closePath();c.fill();
  c.fillStyle=shirt;c.beginPath();c.moveTo(-5+lean,-17);c.lineTo(5+lean,-17);c.lineTo(4,-7);c.lineTo(-4,-7);c.closePath();c.fill();
  c.fillStyle=kit.accent;c.fillRect(-5+lean,-16,2,8);c.fillStyle='#ffffff35';c.fillRect(-2+lean,-17,5,2);
  c.fillStyle=dark;c.fillRect(-4,-7,8,4);c.fillStyle=skin;c.fillRect(-2+lean,-21,4,4);
  c.fillStyle='#13262c';c.beginPath();c.ellipse(lean,-24,5,5.6,0,0,Math.PI*2);c.fill();
  c.fillStyle=skin;c.beginPath();c.ellipse(lean,-23.6,4,4.6,0,0,Math.PI*2);c.fill();
  c.fillStyle=p.id%3===0?'#302b29':'#62452f';c.beginPath();c.ellipse(lean,-26,4.4,2.7,0,Math.PI,Math.PI*2);c.fill();c.fillRect(lean-4,-26,8,2);
  if(pose.facingY>=0){c.fillStyle='#233035';c.fillRect(lean-2+pose.facingX,-24,1,1);c.fillRect(lean+1+pose.facingX,-24,1,1);c.fillStyle='#efc5a0';c.fillRect(lean+pose.facingX,-22,1,2);}
  else{c.fillStyle=kit.accent;c.font='bold 7px monospace';c.textAlign='center';c.fillText(String(p.number),lean,-9);}
  if(pose.state==='windup'){c.strokeStyle='#fff1b8';c.lineWidth=1;c.beginPath();c.arc(0,-2,10,Math.PI*.2,Math.PI*.8);c.stroke();}
  c.restore();
  if(effects&&lying&&s.config.weather!=='rain'){c.fillStyle='#e0d9a64a';for(let i=0;i<3;i++)c.fillRect(x-p.vx/Q*(i+2)+i*3,y-p.vy/Q*(i+2),3,2);}
  if(p.charge){c.fillStyle='#10252d';c.fillRect(x-19,y+13,38,7);c.fillStyle=p.charge>42?'#ff9576':'#f6d26b';c.fillRect(x-18,y+14,36*p.charge/60,5);c.fillStyle='#ffffff66';c.fillRect(x-18+36*12/60,y+14,1,5);}
}
