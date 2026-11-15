import {Q,clamp} from '../simulation/math.mjs';
export const STAGES=['Moving the Goalposts','Raising the Standard','The Rules Have Changed'];
export const BEST_KEY='soccerweb.goalposts.v1';
export const stageTarget=stage=>stage===2?2:1;
export const stageLimit=s=>(105-s.config.difficulty*15)*60;
const span=s=>480-s.config.difficulty*60;
// Q12 smoothstep, bounded integer arithmetic (largest intermediate < 2^39).
function ease(n,d){const u=Math.trunc(clamp(n,0,d)*4096/d);return Math.trunc(u*u*(12288-2*u)/16777216);}
function shape(s,clock){
 const g=s.goalposts,period=span(s),part=Math.floor(clock/period)%3,t=clock%period;
 const f=ease(t-120,period-120),offset=[0,130,-130,0],minimum=150-s.config.difficulty*10,widths=[180,minimum,180,180];
 const mix=(a,b)=>a*Q+Math.trunc((b-a)*Q*f/4096);
 return{center:s.w/2+(g.stage===1?0:mix(offset[part],offset[part+1])),width:g.stage===0?180*Q:mix(widths[part],widths[part+1])};
}
// Shared contract: end is y=0 or h; fraction is the swept crossing within this active tick.
// Both endpoints are Q8; each interpolated delta truncates toward zero. Normal geometry is unchanged.
export function goalGeometry(s,end,numerator=1,denominator=1){
 let center=s.w/2,width=s.goal;
 if(s.goalposts&&end===0){
  const g=s.goalposts,a=shape(s,g.previousClock),b=shape(s,g.clock),f=clamp(numerator/denominator,0,1);
  center=a.center+Math.trunc((b.center-a.center)*f);width=a.width+Math.trunc((b.width-a.width)*f);
 }
 return{center,width,left:center-width/2,right:center+width/2,height:36*Q,plane:end,minCenter:s.w/2-130*Q,maxCenter:s.w/2+130*Q,stage:s.goalposts?.stage??-1};
}
export function shiftNotice(s){
 const g=s.goalposts,t=g.clock%span(s),left=120-t;
 return t<120?{warning:true,ticks:left,text:`SHIFT IN ${Math.ceil(left/60)}s · ${g.stage===0?'SLIDE':g.stage===1?'RESIZE':'SLIDE + RESIZE'}`}:{warning:false,ticks:span(s)-t,text:'SHIFT IN MOTION · WATCH THE OPENING'};
}
export function initGoalposts(s){
 s.goalposts={stage:0,clock:0,previousClock:0,spent:0,points:0,total:0,conceded:0,status:'playing',curved:false,history:[]};
 setupStage(s);
}
export function setupStage(s){
 const g=s.goalposts;g.clock=g.previousClock=g.points=g.conceded=0;g.curved=false;g.status='playing';
 s.phase='kickoff';s.timer=120;s.restartType='STANDARD ANNOUNCED';s.restartTeam=0;
 for(const p of s.players){
  Object.assign(p,{x:(120+p.number*85)*Q,y:(p.team===0?650:490+p.number*23)*Q,vx:0,vy:0,fx:0,fy:p.team===0?-Q:Q,charge:0,slide:0,slip:0,cooldown:0,dive:0,control:0,think:0,fireMode:'idle',pending:null});
  if(p.keeper){p.x=s.w/2;p.y=p.team===0?s.h-25*Q:25*Q;}
  p.tx=p.x;p.ty=p.y;
 }
 const p=s.players[4];p.x=s.w/2-65*Q;p.y=(170+s.config.difficulty*20)*Q;s.selected=[p.id,9];
 s.ball={x:p.x,y:p.y-12*Q,z:0,vx:0,vy:0,vz:0,spin:0,owner:p.id,last:0,kicker:-1,immunity:0,flight:0,kind:'held',receiver:-1};
 s.events.push({type:'revision',stage:g.stage});
}
// Called only by the fixed simulation step. Stoppages/host pause/replays never advance this clock.
export function advanceGoalposts(s){
 const g=s.goalposts;g.previousClock=g.clock;g.clock++;g.spent++;
 if(g.clock%span(s)===1)s.events.push({type:'revision',stage:g.stage});
 if(g.clock%span(s)===120)s.events.push({type:'shift'});
 if(g.clock>=stageLimit(s)){g.status='failed';s.phase='fulltime';s.events.push({type:'whistle'});return false;}return true;
}
export function goalpostsGoal(s,team){
 const g=s.goalposts;
 if(team===0){const points=g.stage===2&&g.curved?2:1;g.points+=points;g.total+=points;s.events.push({type:'standardgoal',points});}
 else g.conceded++;
}
export function finishGoalpostsGoal(s){
 const g=s.goalposts;
 if(g.points>=stageTarget(g.stage)){
  g.history.push({stage:g.stage,ticks:g.clock,points:g.points,conceded:g.conceded});
  if(g.stage===2){g.status='won';s.phase='fulltime';s.events.push({type:'challengewin'});}
  else {g.status='cleared';s.phase='stageclear';}
  return true;
 }
 if(g.conceded>=2){g.status='failed';s.phase='fulltime';return true;}return false;
}
export function validBests(value){
 if(!value||value.version!==1||!Array.isArray(value.runs)||value.runs.length>3)return false;
 const seen=new Set();return value.runs.every(r=>r&&Number.isInteger(r.difficulty)&&r.difficulty>=1&&r.difficulty<=3&&!seen.has(r.difficulty)&&seen.add(r.difficulty)&&Number.isInteger(r.ticks)&&r.ticks>0&&r.ticks<=16200&&Number.isInteger(r.points)&&r.points>=4&&r.points<=5);
}
export function updateBest(value,s){
 if(!s.goalposts||s.goalposts.status!=='won')return validBests(value)?value:{version:1,runs:[]};
 const out=validBests(value)?structuredClone(value):{version:1,runs:[]};
 const run={difficulty:s.config.difficulty,ticks:s.goalposts.spent,points:s.goalposts.total},i=out.runs.findIndex(r=>r.difficulty===run.difficulty);
 if(i<0)out.runs.push(run);else if(run.ticks<out.runs[i].ticks)out.runs[i]=run;
 return out;
}
