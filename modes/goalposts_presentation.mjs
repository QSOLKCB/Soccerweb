// Cosmetic state only. Never writes to the match, consumes its RNG, or changes a replay.
import {goalGeometry,shiftNotice,stageTarget} from './goalposts.mjs';
export const ANNOUNCEMENT_COOLDOWN=90, ANNOUNCEMENT_TICKS=180;
export const STANDARD_VICTORY='YOU HAVE SUCCESSFULLY MET EVERY STANDARD.';
export const STANDARD_REVIEW='A NEW STANDARD IS NOW UNDER REVIEW.';
export function standardRule(stage){
 return ['Score once. The 180-pixel opening slides; your own goal stays fixed.',
  'Score once. The opening resizes; watch the current gold posts.',
  'Earn 2 points. Any goal = 1; a shot curved at release = 2. Sliding + resizing.'][stage];
}
const COPY={
 warning:['THE STANDARD IS SCHEDULED FOR REVISION.','PLEASE PREPARE FOR UPDATED EXPECTATIONS.'],
 relocate:['THE STANDARD HAS BEEN REVISED.','THE TARGET HAS RECEIVED A NEW ADDRESS.'],
 narrow:['THE ACCEPTABLE OUTCOME WINDOW HAS NARROWED.','A SMALLER OPENING. AN EQUALLY LARGE COMMITTEE.'],
 widen:['THE ACCEPTABLE OUTCOME WINDOW HAS EXPANDED.','ADDITIONAL ROOM FOR COMPLIANCE HAS BEEN GRANTED.'],
 goal:['A SPLENDID GOAL. ENTERED INTO THE RECORD.','APPROVED. THE SCOREKEEPER HAS KEPT THE RECEIPT.'],
 post:['FRAMEWORK CONSULTATION IN PROGRESS.','THE FRAME HAS REQUESTED A SECOND OPINION.'],
 miss:['SUBMISSION RETURNED. PLEASE TRY AGAIN.','THE COMMITTEE WOULD LIKE TO SEE ANOTHER ATTEMPT.']
};
export class StandardAnnouncements{
 constructor(){this.reset();}
 reset(){this.stage=-1;this.revision=0;this.lastTick=-1;this.lastMessage=-Infinity;this.lastPost=-Infinity;this.wasWarning=false;this.motionSeen=false;this.geometry=null;this.phase=null;this.current=null;this.counts={};this.serial=0;}
 get view(){return {stage:this.stage,revision:this.revision,serial:this.serial,headline:this.current?.headline||'',detail:this.current?.detail||'',stamp:this.current?.stamp||'IN FORCE',kind:this.current?.kind||'idle',flash:!!this.current&&['relocate','narrow','widen'].includes(this.current.kind)&&this.lastTick-this.current.tick<24};}
 update(s){
  if(!s.goalposts){this.reset();return [];}
  const g=s.goalposts;if(s.tick===this.lastTick&&g.stage===this.stage)return [];
  if(s.tick<this.lastTick)this.reset();
  const fresh=g.stage!==this.stage,notice=shiftNotice(s),geometry=goalGeometry(s,0),sounds=[];
  let candidate=null;
  const offer=(kind,priority,detail,stamp='FILED',headline=null,sound=null)=>{if(!candidate||priority>candidate.priority)candidate={kind,priority,detail,stamp,headline,sound};};
  if(fresh){this.stage=g.stage;this.revision=0;this.motionSeen=false;this.current=null;this.lastMessage=-Infinity;offer('stage',3,standardRule(g.stage),'IN FORCE',`STANDARD ${String(g.stage+1).padStart(2,'0')} IS NOW IN FORCE.`,'standardrevision');}
  else if(notice.warning&&!this.wasWarning){
   this.motionSeen=false;
   offer('warning',1,notice.text,'NOTICE',notice.text.includes('WIDTH HOLDS')?'THE CURRENT STANDARD REMAINS CURRENT.':null,'standardrevision');
  }
  // Announce the first ACTUAL geometry change, not merely the end of the warning timer.
  if(!fresh&&s.phase==='play'&&!notice.warning&&!this.motionSeen&&this.geometry&&(geometry.center!==this.geometry.center||geometry.width!==this.geometry.width)){
   this.motionSeen=true;this.revision++;
   const kind=geometry.width<this.geometry.width?'narrow':geometry.center!==this.geometry.center?'relocate':'widen';
   offer(kind,3,standardRule(g.stage),'REVISED',null,kind==='narrow'?'standardnarrow':kind==='relocate'?'standardrelocate':'standardrevision');
  }
  for(const e of s.events){
   if(e.type==='standardgoal')offer('goal',6,`${e.points} ${e.points===1?'point':'points'} recorded. ${g.points}/${stageTarget(g.stage)} required. Valid goals are never withdrawn.`,'APPROVED',null,'standardstamp');
   if(e.type==='post'){
    offer('post',1,'Post or crossbar. Play continues.','REFERRED');
    if(s.tick-this.lastPost>=12){sounds.push({type:'standardpost',speed:e.speed});this.lastPost=s.tick;}
   }
   if(e.type==='nearmiss')offer('miss',1,'No goal awarded. The current rules still apply.','RETURNED',null,'standardmiss');
  }
  if(s.phase==='stageclear'&&this.phase!=='stageclear')offer('cleared',8,`Next: ${standardRule(g.stage+1)} Your recorded goals remain valid.`,'APPROVED',g.stage===1?'CONGRATULATIONS. THE CRITERIA HAVE CHANGED.':'A SPLENDID GOAL. THE CRITERIA HAVE EVOLVED.','standardrevision');
  if(s.phase==='fulltime'&&this.phase!=='fulltime')offer(g.status==='won'?'victory':'failed',9,g.status==='won'?STANDARD_REVIEW:g.conceded>=2?'Two goals conceded in this standard. Retry the whole run.':'The active-time allowance has expired. Retry the whole run.',g.status==='won'?'APPROVED':'RESUBMIT',g.status==='won'?STANDARD_VICTORY:'THIS SUBMISSION REQUIRES ANOTHER ATTEMPT.',g.status==='won'?'standardreview':'standardmiss');
  if(candidate&&(s.tick-this.lastMessage>=ANNOUNCEMENT_COOLDOWN||candidate.priority>=6&&candidate.priority>(this.current?.priority??0))){
   const n=this.counts[candidate.kind]||0;this.counts[candidate.kind]=n+1;
   const choices=COPY[candidate.kind];candidate.headline??=choices[(s.config.seed+g.stage+n)%choices.length];
   this.current={...candidate,tick:s.tick};this.lastMessage=s.tick;this.serial++;
   if(candidate.sound)sounds.push({type:candidate.sound});
  }else if(this.current&&s.tick-this.current.tick>=ANNOUNCEMENT_TICKS&&s.phase!=='stageclear'&&s.phase!=='fulltime')this.current=null;
  this.geometry={center:geometry.center,width:geometry.width};this.wasWarning=notice.warning;this.phase=s.phase;this.lastTick=s.tick;
  return sounds;
 }
}
