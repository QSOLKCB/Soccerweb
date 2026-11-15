import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createState,EMPTY} from '../game/state.mjs';
import {step} from '../game/match.mjs';
import {Q} from '../simulation/math.mjs';
import {ballPhysics} from '../simulation/physics.mjs';
import {aiIntent} from '../ai/team.mjs';
import {goalGeometry,shiftNotice,setupStage,stageLimit,validBests,updateBest} from '../modes/goalposts.mjs';
import {Recorder,verifyReplay,stateHash,validateReplay} from '../replay/replay.mjs';
import {normalReference} from './normal_reference.mjs';
export function routeInput(s){
 const t=s.goalposts.clock,i={...EMPTY},wait=s.goalposts.stage===0?90:0,charge=s.goalposts.stage===0?60:45;
 if(s.phase==='stageclear')i.fire=true;
 else if(s.phase==='play'){if(t>=wait&&t<wait+charge)Object.assign(i,{x:1,y:-1,fire:true});else if(t>=wait+charge)Object.assign(i,{y:t===wait+charge?-1:0,curve:-1});}
 return [i,{...EMPTY}];
}
function isolated(stage=0){const s=createState({mode:'goalposts',difficulty:1,seed:731});s.goalposts.stage=stage;setupStage(s);s.phase='play';for(const p of s.players){p.x=20*Q;p.y=400*Q;}return s;}
test('normal football matches merged Phase 3 at every checkpoint, excluding version only',async()=>{
 const before=JSON.parse(fs.readFileSync(new URL('../docs/evidence/goalposts/normal-before.json',import.meta.url)));
 assert.deepEqual(await normalReference(),before);
});
test('mode configuration enforces outdoor solo play without changing ordinary options',()=>{
 const s=createState({mode:'goalposts',indoor:true,humans:[false,true],knockout:true});assert.equal(s.config.indoor,false);assert.deepEqual(s.config.humans,[true,false]);assert.equal(s.config.knockout,false);assert.equal(s.players.length,10);
 assert.equal(createState({indoor:true}).players.length,12);assert.equal(createState().goalposts,undefined);
});
test('three stages use bounded continuous geometry, two-second warnings and finite width',()=>{
 for(const difficulty of [1,2,3])for(const stage of [0,1,2]){
  const s=isolated(stage);s.config.difficulty=difficulty;let prior=goalGeometry(s,0),changed=false;
  for(let tick=0;tick<1500;tick++){
   s.goalposts.previousClock=Math.max(0,tick-1);s.goalposts.clock=tick;const g=goalGeometry(s,0);
   assert.ok(g.left>=s.w/2-220*Q&&g.right<=s.w/2+220*Q);assert.ok(g.width>=(150-difficulty*10)*Q&&g.width<=180*Q);
   assert.ok(Math.abs(g.center-prior.center)<3*Q&&Math.abs(g.width-prior.width)<Q);
   assert.deepEqual(goalGeometry(s,s.h),{center:s.w/2,width:s.goal,left:s.w/2-s.goal/2,right:s.w/2+s.goal/2,height:36*Q,plane:s.h,minCenter:s.w/2-130*Q,maxCenter:s.w/2+130*Q,stage});
   changed ||=g.center!==prior.center||g.width!==prior.width;
   if(tick<120){assert.equal(g.center,s.w/2);assert.equal(shiftNotice(s).warning,true);}
   if(tick===120)assert.equal(shiftNotice(s).warning,false);prior=g;
  }assert.ok(changed);
 }
});
test('current mouth scores, old static location misses, and awarded score survives later motion',()=>{
 for(const atCurrent of [false,true]){
  const s=isolated();s.goalposts.clock=s.goalposts.previousClock=420;const g=goalGeometry(s,0);
  Object.assign(s.ball,{owner:-1,x:atCurrent?g.center:s.w/2,y:Q,vy:-8*Q,vx:0});ballPhysics(s);
  assert.equal(s.score[0],atCurrent?1:0);assert.equal(s.phase,atCurrent?'goal':'restart');
  if(atCurrent){s.goalposts.clock=840;step(s);assert.equal(s.score[0],1);}
 }
});
test('swept crossing interpolates moving frame before frame contact and scoring',()=>{
 const s=isolated(2);s.goalposts.previousClock=230;s.goalposts.clock=231;const a=goalGeometry(s,0,0,1),b=goalGeometry(s,0),mid=goalGeometry(s,0,1,2);
 assert.equal(mid.center,a.center+Math.trunc((b.center-a.center)/2));assert.equal(mid.width,a.width+Math.trunc((b.width-a.width)/2));
 Object.assign(s.ball,{owner:-1,x:mid.left+7*Q,y:4*Q,vy:-8*Q,vx:0});ballPhysics(s);assert.equal(s.score[0],0);assert.equal(s.events.at(-1).type,'post');
});
test('dynamic/static end post and crossbar precedence, clear and high shots',()=>{
 for(const end of [0,1120*Q])for(const [offset,z,expected] of [['left',0,'post'],['right',0,'post'],['center',35,'post'],['center',60,'miss'],['center',20,'goal']]){
  const s=isolated(2);s.goalposts.clock=s.goalposts.previousClock=300;const g=goalGeometry(s,end);
  Object.assign(s.ball,{owner:-1,x:g[offset],y:end===0?Q:end-Q,z:z*Q,vx:0,vy:(end===0?-8:8)*Q,vz:0});ballPhysics(s);
  assert.equal(s.score[0]+s.score[1],expected==='goal'?1:0);
  if(expected==='post'){assert.ok(s.events.some(e=>e.type==='post'));assert.ok(end===0?s.ball.vy>0:s.ball.vy<0);}
  if(expected==='miss')assert.equal(s.phase,'restart');
 }
});
test('keeper guards present moving mouth, never an unannounced future position',()=>{
 const s=isolated();s.goalposts.clock=s.goalposts.previousClock=420;const p=s.players[5],g=goalGeometry(s,0);Object.assign(p,{x:g.center,y:25*Q,ty:0});Object.assign(s.ball,{x:s.w/2,y:250*Q,vx:0,vy:0,owner:-1});aiIntent(s,p);assert.equal(p.tx,g.left+10*Q);
});
test('stoppages and stage waiting freeze motion and clocks; restart resumes one tick at a time',()=>{
 const s=createState({mode:'goalposts'}),g=s.goalposts;for(let i=0;i<120;i++)step(s);assert.equal(g.clock,0);step(s);assert.equal(g.clock,1);
 s.phase='restart';s.timer=3;const before=g.clock;for(let i=0;i<3;i++)step(s);assert.equal(g.clock,before);step(s);assert.equal(g.clock,before+1);
 s.phase='stageclear';s.goalposts.status='cleared';for(let i=0;i<90;i++)step(s);assert.equal(g.clock,before+1);step(s,[{...EMPTY,fire:true},EMPTY]);assert.equal(g.stage,1);assert.equal(g.clock,0);assert.equal(s.phase,'kickoff');
});
for(const difficulty of [1,2,3])test(`all stages complete with genuine shots and recorded inputs at difficulty ${difficulty}`,()=>{
 const s=createState({mode:'goalposts',difficulty,aftertouch:2,seed:731}),r=new Recorder(s);let goals=0,shifts=0;
 while(s.phase!=='fulltime'&&s.tick<12000){const input=routeInput(s);step(s,input);r.record(s,input);goals+=s.events.filter(e=>e.type==='goal'&&e.team===0).length;shifts+=s.events.filter(e=>e.type==='shift').length;}
 assert.equal(s.goalposts.status,'won');assert.equal(goals,3);assert.equal(s.score[0],3);assert.equal(s.goalposts.total,4);assert.equal(s.goalposts.history.length,3);assert.ok(shifts>=1);
 const replay=r.export(s);assert.equal(stateHash(verifyReplay(JSON.parse(JSON.stringify(replay)))),stateHash(s));assert.throws(()=>validateReplay({...replay,version:4}));
 console.log('GOALPOSTS fixture',difficulty,s.tick,stateHash(s));
});
test('finite time or two concessions ends the run, and a retry starts clean',()=>{
 const s=isolated();s.goalposts.clock=stageLimit(s)-1;step(s);assert.equal(s.phase,'fulltime');assert.equal(s.goalposts.status,'failed');
 const c=isolated();c.goalposts.conceded=1;Object.assign(c.ball,{owner:-1,x:c.w/2,y:c.h-Q,vy:8*Q});ballPhysics(c);for(let i=0;i<150;i++)step(c);assert.equal(c.goalposts.status,'failed');assert.equal(createState(c.config).goalposts.stage,0);
});
test('separate best schema rejects unbounded/malformed history and keeps only faster completed runs',()=>{
 assert.equal(validBests({version:1,runs:Array(4).fill({})}),false);assert.equal(validBests({version:1,runs:[{difficulty:1,ticks:-1,points:4}]}),false);
 const s=createState({mode:'goalposts'});assert.deepEqual(updateBest(null,s),{version:1,runs:[]});s.goalposts.status='won';s.goalposts.spent=500;s.goalposts.total=4;
 const best=updateBest(null,s);assert.ok(validBests(best));s.goalposts.spent=600;assert.deepEqual(updateBest(best,s),best);s.goalposts.spent=400;assert.equal(updateBest(best,s).runs[0].ticks,400);assert.equal(best.runs[0].ticks,500);
});
