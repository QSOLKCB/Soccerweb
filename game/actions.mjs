import {Q,clamp,distance,vector} from '../simulation/math.mjs';
import {attack} from './state.mjs';
import {kick,tackle} from '../simulation/physics.mjs';
// Each press is one gesture. A tackle/dedicated kick consumes it until release.
export function humanAction(s,p,i,prev){
 const [x,y]=vector(i.x*Q,i.y*Q,Q);if(x||y){p.fx=x;p.fy=y;}
 if(i.fire&&!prev.fire){
  p.charge=0;p.pending=null;p.fireMode='kick';
  if(s.ball.z<12*Q&&distance(p,s.ball)<42*Q&&s.ball.owner>=0&&s.players[s.ball.owner].team!==p.team){tackle(s,p);p.fireMode='tackle';}
 }
 if(i.fire&&p.fireMode==='kick')p.charge=Math.min(60,p.charge+1);
 const dedicated=i.chip&&!prev.chip?'chip':i.pass&&!prev.pass?'pass':null;
 const release=!i.fire&&prev.fire&&p.fireMode==='kick';
 if(dedicated||release){
  let kind=dedicated||(p.charge<12?'pass':'shot');
  if(s.ball.z>15*Q&&i.y===-attack(s,p.team))kind='overhead';
  const power=p.charge||25,curve=i.curve*(1+s.config.aftertouch);
  const available=s.ball.owner<0||s.ball.owner===p.id;
  const succeeded=available&&kick(s,p,kind,power,null,curve);
  // Brief physical first-time window; never queue a remote shot or retry through a tackle cooldown.
  p.pending=available&&!succeeded&&!p.cooldown&&distance(p,s.ball)<=60*Q?{kind,power,curve,ticks:6,fx:p.fx,fy:p.fy}:null;
  p.charge=0;p.fireMode=i.fire?'consumed':'idle';
 }
 if(!i.fire)p.fireMode='idle';
 if(p.pending){const a=p.pending;if(--a.ticks<0||(s.ball.owner>=0&&s.ball.owner!==p.id))p.pending=null;else{
  const fx=p.fx,fy=p.fy;p.fx=a.fx;p.fy=a.fy;
  if(kick(s,p,a.kind,a.power,null,a.curve))p.pending=null;
  p.fx=fx;p.fy=fy;
 }}
 if(s.ball.kicker===p.id&&s.ball.flight&&s.ball.owner<0)s.ball.spin=clamp(s.ball.spin+(i.curve||i.x)*s.config.aftertouch,-18,18);
 return{x,y};
}
