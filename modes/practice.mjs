import {createState} from '../game/state.mjs';
import {Q,distance} from '../simulation/math.mjs';
import {keyLabel} from '../input/controls.mjs';
export const DRILLS=['move','pass','shot','curve','tackle','keeper'];
export const DRILL_NAMES=['First touch & movement','Three passes','Charge & release','Bend a goal','Win the ball','Read the goalkeeper'];
export function createPractice(index=0,options={}){
 index=Math.max(0,Math.min(DRILLS.length-1,Math.trunc(index)||0));
 const s=createState({...options,humans:[true,false],seconds:720,auto:true,aftertouch:2,knockout:false}),drill=DRILLS[index];
 s.phase='play';s.timer=0;
 // Authored drill setup, isolated from all match saves/recorders. Subsequent play uses the real simulation.
 for(const p of s.players){p.x=(30+p.number*25)*Q;p.y=s.h-80*Q;p.vx=p.vy=0;}
 const p=s.players[s.selected[0]],mate=s.players.find(q=>q.team===0&&!q.keeper&&q.id!==p.id),keeper=s.players.find(q=>q.team===1&&q.keeper),foe=s.players.find(q=>q.team===1&&!q.keeper);
 p.x=s.w/2;p.y=drill==='move'||drill==='pass'?s.h/2:260*Q;p.fx=0;p.fy=-Q;
 if(drill==='curve'){p.x=s.w/2-72*Q;p.y=300*Q;}
 if(drill==='pass'){mate.x=p.x+110*Q;mate.y=p.y-130*Q;}
 if(drill==='keeper'){keeper.x=s.w/2;keeper.y=25*Q;}
 Object.assign(s.ball,{x:p.x,y:p.y-12*Q,owner:p.id,last:0,kind:'held'});
 if(drill==='tackle'){
  foe.x=p.x;foe.y=p.y-40*Q;foe.fx=0;foe.fy=Q;
  Object.assign(s.ball,{x:foe.x,y:foe.y+12*Q,owner:foe.id,last:1});
 }
 s.training={drill,active:drill==='keeper'?[keeper.id]:[],target:{x:p.x+95*Q,y:p.y-110*Q},start:{x:p.x,y:p.y},player:p.id};
 return{index,state:s,complete:false,progress:0,attempt:false,curved:false,message:''};
}
export function observePractice(practice){
 const s=practice.state,drill=s.training.drill,p=s.players[s.selected[0]];
 if(practice.complete)return false;
 for(const e of s.events){if(e.type==='kick'&&e.team===0&&e.kind!=='pass'){practice.attempt=true;if(Math.abs(s.ball.spin)>0)practice.curved=true;}}
 const goals=s.score[0]>0;
 if(drill==='move'){practice.progress=Math.min(100,Math.floor(distance(p,s.training.start)/(150*Q)*100));practice.complete=distance(p,s.training.target)<35*Q;}
 if(drill==='pass'){practice.progress=s.stats.completedPasses[0];practice.complete=practice.progress>=3;}
 if(drill==='shot')practice.complete=practice.attempt&&goals;
 if(drill==='curve')practice.complete=practice.curved&&goals;
 if(drill==='tackle')practice.complete=s.stats.tackles[0]>0;
 if(drill==='keeper')practice.complete=practice.attempt&&(goals||s.stats.saves[1]>0);
 if(practice.complete){practice.message=drill==='keeper'&&s.stats.saves[1]?'Saved! You found the keeper. Retry and aim across their body.':'Skill complete. Repeat it, or try the next drill.';return true;}
 if(s.phase==='goal'||s.phase==='restart')practice.message='Use Pause → Retry drill to reset the setup.';
 return false;
}
export function practiceCopy(practice,map){
 const key=a=>keyLabel(map[a]),copy={
 move:`Move with ${key('up')}/${key('left')}/${key('down')}/${key('right')}. Dribble into the ring.`,
 pass:`Tap ${key('fire')} or press ${key('pass')} to pass. Selection follows the receiver. Complete three passes: ${practice.progress}/3.`,
 shot:`Aim up. Hold ${key('fire')} until SHOT appears, then release. Score a goal; more charge adds speed.`,
 curve:`Aim up from this wide position. Hold ${key('fire')} for half a second, then hold ${key('curveRight')} as you release. Bend inside the near post.`,
 tackle:`Approach the opponent. Press ${key('fire')} within tackling range. A tackle consumes this press; release before kicking again.`,
 keeper:`The keeper guards the centre. Aim diagonally or bend with ${key('curveLeft')}/${key('curveRight')}. Take a shot and read the save or goal.`};
 return practice.message||copy[practice.state.training.drill];
}
