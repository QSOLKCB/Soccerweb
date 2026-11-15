import {goalGeometry} from '../modes/goalposts.mjs';
import { Q, clamp, distance, vector, random, length } from '../simulation/math.mjs';
import { attack, goalY, nearest } from '../game/state.mjs';
import { TEAMS } from '../game/teams.mjs';

// Pixel-quantized segment projection keeps utility intermediates exact and below 2^53.
export function laneClearance(s, from, to, team) {
  const dx=Math.trunc((to.x-from.x)/Q),dy=Math.trunc((to.y-from.y)/Q),den=dx*dx+dy*dy;
  let gap=180;
  if(!den)return 0;
  for(const foe of s.players)if(foe.team!==team){
    const ex=Math.trunc((foe.x-from.x)/Q),ey=Math.trunc((foe.y-from.y)/Q);
    const dot=ex*dx+ey*dy;
    if(dot<0||dot>den)continue;
    const px=ex-Math.trunc(dx*dot/den),py=ey-Math.trunc(dy*dot/den);
    gap=Math.min(gap,length(px,py));
  }
  return gap;
}
export function passTarget(s,p,dx=0,dy=0) {
  let best=null,utility=-Infinity;
  for(const mate of s.players)if(mate.team===p.team&&mate.id!==p.id&&!mate.keeper){
    const d=Math.trunc(distance(p,mate)/Q);if(d<40||d>(s.config.indoor?310:440))continue;
    const forward=Math.trunc((mate.y-p.y)/Q)*attack(s,p.team);
    const aim=dx||dy?Math.trunc(((mate.x-p.x)*dx+(mate.y-p.y)*dy)/(d*Q)*120):0;
    let space=130;
    for(const foe of s.players)if(foe.team!==p.team)space=Math.min(space,Math.trunc(distance(mate,foe)/Q));
    const lane=laneClearance(s,p,mate,p.team);
    const score=forward+space+aim-Math.trunc(Math.abs(d-150)/3)-(lane<23?(23-lane)*12:0);
    if(score>utility){utility=score;best=mate;}
  }
  return best;
}
function steer(s,p,tx,ty,separate=true) {
  let dx=tx-p.x,dy=ty-p.y;
  if(separate)for(const mate of s.players)if(mate.team===p.team&&mate.id!==p.id&&!mate.keeper){
    const d=distance(p,mate);
    if(d<52*Q){const [x,y]=vector(p.x-mate.x||((p.id&1)?Q:-Q),p.y-mate.y,Math.trunc((52*Q-d)*.8));dx+=x;dy+=y;}
  }
  if(length(dx,dy)<5*Q)return{x:0,y:0};
  const [x,y]=vector(dx,dy,Q);return{x,y};
}
export function aiIntent(s,p) {
  const b=s.ball,dir=attack(s,p.team),difficulty=s.config.difficulty;
  const own=b.owner>=0?s.players[b.owner]:null,team=TEAMS[s.config.teams[p.team]];
  if(p.keeper){
    const gy=dir<0?s.h:0,g=goalGeometry(s,gy);
    if(own?.id===p.id){p.intent='distribute';return p.control<18?{x:0,y:0}:{x:0,y:dir*Q,kick:'pass',power:36,target:passTarget(s,p)};}
    // Reaction intervals change with difficulty; neither running speed nor reach is secretly boosted.
    const reaction=s.config.indoor?8-difficulty:15-difficulty*3;
    if(s.tick%reaction===p.id%reaction||!p.ty){
      const incoming=b.vy*dir<-2*Q;
      const line=gy+dir*24*Q;
      const time=incoming?clamp(Math.trunc((line-b.y)/b.vy),0,35):0;
      const predicted=b.x+b.vx*time;
      p.tx=clamp(incoming?predicted:b.x,g.left+10*Q,g.right-10*Q);
      p.ty=gy+dir*(Math.abs(b.y-gy)<230*Q?31:20)*Q;
      if(incoming&&time>0&&time<19&&Math.abs(predicted-g.center)<g.width/2+12*Q&&b.z<35*Q&&p.cooldown===0){p.dive=18;p.cooldown=60;}
    }
    p.intent=p.dive?'dive':'guard';return steer(s,p,p.tx,p.ty,false);
  }
  if(own?.id===p.id){
    p.intent='attack';const targetGoal=goalGeometry(s,goalY(s,p.team));
    const goalDist=Math.abs(goalY(s,p.team)-p.y)/Q,alignment=Math.abs(p.x-s.w/2)/Q;
    if(--p.think<=0&&p.control>=(s.config.indoor?16:8)){
      p.think=40-difficulty*7;
      const keeper=s.players.find(q=>q.team!==p.team&&q.keeper);
      const side=keeper.x>=targetGoal.center?-1:1;
      const target={x:targetGoal.center+side*Math.min(43*Q,targetGoal.width/2-18*Q),y:goalY(s,p.team)};
      const shotLane=laneClearance(s,p,target,p.team);
      if(goalDist<260+team.attack&&alignment<s.w/Q*.33&&(shotLane>12||goalDist<145)){
        const error=(random(s)%(39-difficulty*9)-Math.floor((39-difficulty*9)/2))*Q;
        return{x:0,y:dir*Q,kick:'shot',power:36+difficulty*7,aimX:target.x+error,aimY:target.y};
      }
      let pressure=1000*Q;
      for(const foe of s.players)if(foe.team!==p.team)pressure=Math.min(pressure,distance(foe,p));
      const mate=passTarget(s,p),progress=mate?(mate.y-p.y)*dir:0;
      // Don't turn every possession into an immediate sideways pass. A clear forward lane is valuable.
      if(mate&&laneClearance(s,p,mate,p.team)>17&&p.control>=(s.config.indoor?18:14)&&
          (pressure<48*Q||(progress>80*Q&&random(s)%100<team.pass)))
        return{x:0,y:dir*Q,kick:'pass',power:25,target:mate};
    }
    let tx=s.w/2+Math.trunc((p.x-s.w/2)/3);
    for(const foe of s.players)if(foe.team!==p.team&&!foe.keeper&&distance(foe,p)<70*Q&&(foe.y-p.y)*dir>0){tx+=(p.x>=foe.x?1:-1)*65*Q;break;}
    return steer(s,p,clamp(tx,35*Q,s.w-35*Q),p.y+dir*200*Q);
  }
  const receiver=b.owner<0&&b.kind==='pass'&&b.last===p.team&&b.receiver>=0?b.receiver:-1;
  const chaser=receiver>=0?receiver:nearest(s,p.team);
  // A teammate carrying the ball needs passing options, not a second player chasing their feet.
  if(own?.team!==p.team&&chaser===p.id){
    p.intent='chase';const ahead=difficulty*3;
    const action=steer(s,p,clamp(b.x+b.vx*ahead,10*Q,s.w-10*Q),clamp(b.y+b.vy*ahead,10*Q,s.h-10*Q));
    action.tackle=own&&own.team!==p.team&&distance(p,b)<(25+difficulty*3)*Q&&p.control===0&&s.tick%(75-difficulty*10)===p.id%(75-difficulty*10);
    return action;
  }
  const base=Math.trunc(s.h*p.hy/Q),homeY=dir<0?s.h-base:base;
  let tx=Math.trunc(s.w*p.hx/Q)+Math.trunc((b.x-s.w/2)/5);
  let ty=homeY+Math.trunc((b.y-s.h/2)/2);
  if(own?.team===p.team){
    p.intent='support';ty+=dir*(110+team.attack)*Q;
    if(distance(p,own)<310*Q&&!own.keeper){
      const wing=p.hx<128?-1:1,role=p.number%3;
      tx=own.x+wing*(role===0?105:145)*Q;ty=own.y+dir*(role===0?-65:role===1?95:165)*Q;
    }
  }else{
    p.intent='mark';
    if(p.number<=(s.config.indoor?3:5)){
      let threat=null,best=Infinity;
      for(const foe of s.players)if(foe.team!==p.team&&!foe.keeper){const d=distance(foe,{x:tx,y:ty});if(d<best){best=d;threat=foe;}}
      if(threat&&best<210*Q){tx+=Math.trunc((threat.x-tx)*(difficulty+1)/6);ty+=Math.trunc((threat.y-dir*27*Q-ty)*(difficulty+1)/6);}
    }
  }
  // In the small court, keep two outlets behind possession instead of sending everyone at goal.
  if(s.config.indoor&&own?.team===p.team&&p.number<=3){
    const end=dir<0?s.h:0,depth=clamp(Math.trunc(Math.abs(own.y-end)*.4),85*Q,230*Q);
    tx=s.w/2+(p.number===2?-80:80)*Q+Math.trunc((b.x-s.w/2)/6);ty=end+dir*depth;p.intent='cover';
  }
  p.tx=clamp(tx,28*Q,s.w-28*Q);p.ty=clamp(ty,55*Q,s.h-55*Q);
  return steer(s,p,p.tx,p.ty);
}
