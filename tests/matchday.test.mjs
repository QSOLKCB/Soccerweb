import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,EMPTY} from '../game/state.mjs';
import {step} from '../game/match.mjs';
import {humanAction} from '../game/actions.mjs';
import {ballPhysics,kick} from '../simulation/physics.mjs';
import {createPractice,observePractice,practiceCopy} from '../modes/practice.mjs';
import {DEFAULT_MAPS} from '../input/controls.mjs';
import {Q,distance} from '../simulation/math.mjs';
function scene(index=2){const practice=createPractice(index);return{practice,s:practice.state,p:practice.state.players[practice.state.selected[0]]};}
test('dedicated pass consumes a held kick until a fresh press',()=>{
 const {s,p}=scene(1);humanAction(s,p,{...EMPTY,fire:true},EMPTY);
 humanAction(s,p,{...EMPTY,fire:true,pass:true},{...EMPTY,fire:true});assert.equal(s.stats.passes[0],1);
 p.cooldown=0;Object.assign(s.ball,{x:p.x,y:p.y,owner:p.id});
 for(let i=0;i<30;i++)humanAction(s,p,{...EMPTY,fire:true},{...EMPTY,fire:true});
 humanAction(s,p,EMPTY,{...EMPTY,fire:true});assert.equal(s.stats.passes[0],1);assert.equal(s.stats.shots[0],0);assert.equal(p.charge,0);
});
test('tackle gesture cannot become a shot after possession changes',()=>{
 const {s,p}=scene(4);humanAction(s,p,{...EMPTY,fire:true},EMPTY);assert.equal(p.fireMode,'tackle');
 p.cooldown=0;s.ball.owner=p.id;s.ball.x=p.x;s.ball.y=p.y;
 for(let i=0;i<40;i++)humanAction(s,p,{...EMPTY,fire:true},{...EMPTY,fire:true});
 humanAction(s,p,EMPTY,{...EMPTY,fire:true});assert.equal(s.stats.shots[0],0);assert.equal(s.stats.passes[0],0);
});
test('first-time pass buffer waits only a few ticks for physical reach',()=>{
 const {s,p}=scene(1);s.ball.x=p.x;s.ball.y=p.y-40*Q;s.ball.owner=-1;
 humanAction(s,p,{...EMPTY,pass:true},EMPTY);assert.ok(p.pending);assert.equal(s.stats.passes[0],0);
 s.ball.y=p.y-25*Q;humanAction(s,p,EMPTY,{...EMPTY,pass:true});assert.equal(s.stats.passes[0],1);assert.equal(p.pending,null);
 const b=scene(1);b.s.ball.y=b.p.y-50*Q;b.s.ball.owner=-1;humanAction(b.s,b.p,{...EMPTY,pass:true},EMPTY);
 for(let i=0;i<8;i++)humanAction(b.s,b.p,EMPTY,EMPTY);assert.equal(b.p.pending,null);assert.equal(b.s.stats.passes[0],0);
});
test('switching away cancels charge instead of transferring it to another player',()=>{
 const {s,p}=scene();step(s,[{...EMPTY,fire:true},EMPTY]);step(s,[{...EMPTY,fire:true,switch:true},EMPTY]);
 assert.notEqual(s.selected[0],p.id);assert.equal(p.charge,0);step(s,[EMPTY,EMPTY]);assert.equal(s.stats.shots[0],0);
});
test('closer owner cannot be pickpocketed by a farther stationary opponent',()=>{
 const s=createState({humans:[true,true]});s.phase='play';for(const p of s.players){p.x=20*Q;p.y=20*Q;}
 const owner=s.players[9],foe=s.players[20];Object.assign(owner,{x:350*Q,y:500*Q});Object.assign(foe,{x:358*Q,y:500*Q});
 Object.assign(s.ball,{x:351*Q,y:500*Q,owner:owner.id,last:0,vx:0,vy:0});ballPhysics(s);assert.equal(s.ball.owner,owner.id);
});
test('keeper caught ball is protected from taps, kicks and slides until distribution',()=>{
 const s=createState({indoor:true});s.phase='play';s.players.forEach(p=>{p.x=20*Q;p.y=500*Q;});
 const keeper=s.players[6],foe=s.players[5];Object.assign(keeper,{x:s.w/2,y:25*Q});Object.assign(foe,{x:s.w/2+30*Q,y:27*Q});
 Object.assign(s.ball,{x:keeper.x,y:keeper.y+8*Q,vx:0,vy:-6*Q,owner:-1,last:0,kind:'shot'});ballPhysics(s);assert.equal(s.ball.kind,'caught');
 Object.assign(foe,{x:s.ball.x,y:s.ball.y,slide:10});assert.equal(kick(s,foe,'shot',60),false);
 for(let i=0;i<10;i++)ballPhysics(s);assert.equal(s.ball.owner,keeper.id);assert.equal(s.stats.saves[1],1);
 assert.equal(kick(s,keeper,'pass',25),true);assert.equal(s.ball.owner,-1);
});
test('first touch damps incoming velocity without moving the ball onto the player',()=>{
 const {s,p}=scene(1);Object.assign(s.ball,{x:p.x-9*Q,y:p.y,vx:7*Q,vy:0,owner:-1,kind:'pass',last:0,kicker:1});
 ballPhysics(s);assert.equal(s.ball.owner,p.id);assert.notEqual(s.ball.x,p.x);assert.ok(Math.abs(s.ball.vx)<4*Q);
});
for(const indoor of [false,true])for(let index=0;index<6;index++)test(`practice ${index} completes through real inputs (${indoor?'indoor':'outdoor'})`,()=>{
 const practice=createPractice(index,{indoor}),s=practice.state;
 for(let t=0;t<400&&!practice.complete;t++){
  const i={...EMPTY};if(index===0){i.x=1;i.y=-1;}if(index===1&&t%100===1)i.pass=true;
  if([2,3,5].includes(index)){i.fire=t<30;if(index===3&&t>=30)i.curve=1;}if(index===4)i.fire=t===1;
  step(s,[i,EMPTY]);observePractice(practice);
 }
 assert.equal(practice.complete,true);if(index===1)assert.equal(s.stats.completedPasses[0],3);
 if(index===3)assert.equal(s.score[0],1);if(index===5)assert.ok(s.stats.saves[1]>0||s.score[0]>0);
});
test('curve drill distinguishes a bent goal from a straight shot hitting the frame',()=>{
 const shoot=curve=>{const {s}=scene(3);let post=false;for(let t=0;t<150&&s.phase==='play';t++){step(s,[{...EMPTY,fire:t<30,curve:t>=30?curve:0},EMPTY]);post ||=s.events.some(e=>e.type==='post');}return{s,post};};
 assert.equal(shoot(1).s.score[0],1);const straight=shoot(0);assert.equal(straight.s.score[0],0);assert.equal(straight.post,true);
});
test('practice instructions reflect remapped keys and leave independent matches untouched',()=>{
 const normal=createState(),before=structuredClone(normal),practice=createPractice();const map={...DEFAULT_MAPS[0],up:'KeyI'};
 assert.match(practiceCopy(practice,map),/I\//);step(practice.state,[{...EMPTY,y:-1},EMPTY]);assert.deepEqual(normal,before);
});

test('aimed wide shot misses without homing and awards a goal kick',()=>{
 const {s}=scene();for(let t=0;t<150&&s.phase==='play';t++)step(s,[{...EMPTY,fire:t<30,x:t===30?1:0,y:t===30?-1:0},EMPTY]);
 assert.equal(s.score[0],0);assert.equal(s.phase,'restart');assert.equal(s.restartType,'GOAL KICK');
});
test('an aerial kick press arms the kick without starting a ground tackle',()=>{
 const {s,p}=scene(4);s.ball.z=22*Q;humanAction(s,p,{...EMPTY,fire:true},EMPTY);assert.equal(p.slide,0);assert.equal(p.fireMode,'kick');
});

test('losing possession during charge cannot shoot through the new carrier',()=>{
 const {s,p}=scene();humanAction(s,p,{...EMPTY,fire:true},EMPTY);p.charge=40;
 s.ball.owner=s.players.find(q=>q.team===1&&!q.keeper).id;
 humanAction(s,p,EMPTY,{...EMPTY,fire:true});assert.equal(s.stats.shots[0],0);assert.equal(p.pending,null);assert.equal(p.charge,0);
});
