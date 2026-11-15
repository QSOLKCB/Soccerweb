import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, EMPTY } from '../game/state.mjs';
import { step } from '../game/match.mjs';
import { Q, distance } from '../simulation/math.mjs';
import { kick, ballPhysics } from '../simulation/physics.mjs';
import { passTarget, laneClearance, aiIntent } from '../ai/team.mjs';
function scenario(options={}) {
  const s=createState({seed:42,auto:false,...options});s.phase='play';
  for(const p of s.players){p.x=20*Q;p.y=(60+p.id*12)*Q;p.vx=p.vy=0;}
  const p=s.players[9];p.x=s.w/2;p.y=s.h/2;p.fx=0;p.fy=-Q;s.selected[0]=p.id;
  Object.assign(s.ball,{x:p.x,y:p.y-12*Q,owner:p.id,last:0});return{s,p};
}
test('clear-goal scenario: aimed charged kick reaches a valid goal without a scripted outcome',()=>{
  const {s,p}=scenario();p.y=200*Q;s.ball.y=p.y-12*Q;kick(s,p,'shot',55,{x:s.w/2,y:0});
  for(let i=0;i<60&&s.phase==='play';i++)ballPhysics(s);
  assert.equal(s.score[0],1);assert.equal(s.phase,'goal');
});
test('pass sequence: two physical deliveries reach distinct intended receivers',()=>{
  const {s,p}=scenario(),mate=s.players[10];mate.x=p.x;mate.y=p.y-155*Q;
  assert.ok(kick(s,p,'pass',25,mate));
  for(let i=0;i<60&&s.ball.owner!==mate.id;i++)ballPhysics(s);
  assert.equal(s.ball.owner,mate.id);assert.equal(s.stats.completedPasses[0],1);
  assert.ok(kick(s,mate,'pass',25,p));
  for(let i=0;i<60&&s.ball.owner!==p.id;i++)ballPhysics(s);
  assert.equal(s.ball.owner,p.id);assert.equal(s.stats.completedPasses[0],2);
});
test('pass utility avoids an occupied lane when a comparable open option exists',()=>{
  const {s,p}=scenario(),blocked=s.players[10],open=s.players[8],foe=s.players[12];
  Object.assign(blocked,{x:p.x,y:p.y-180*Q});Object.assign(open,{x:p.x+145*Q,y:p.y-145*Q});
  Object.assign(foe,{x:p.x,y:p.y-90*Q});
  assert.equal(laneClearance(s,p,blocked,0),0);assert.ok(laneClearance(s,p,open,0)>30);
  assert.equal(passTarget(s,p,0,-1).id,open.id);
});
test('contact priority is distance-based, not the last player in the array',()=>{
  const {s,p}=scenario(),near=s.players[12],far=s.players[20];s.ball.owner=-1;p.x=30*Q;
  Object.assign(near,{x:s.ball.x+3*Q,y:s.ball.y});Object.assign(far,{x:s.ball.x+9*Q,y:s.ball.y});
  ballPhysics(s);assert.equal(s.ball.owner,near.id);
});
test('braking settles promptly while wet turf retains a longer stopping distance',()=>{
  const run=weather=>{const {s,p}=scenario({weather});for(let i=0;i<30;i++)step(s,[{...EMPTY,y:-1},EMPTY]);const y=p.y;for(let i=0;i<10;i++)step(s);return{speed:Math.abs(p.vy),travel:Math.abs(p.y-y)/Q};};
  const dry=run('clear'),wet=run('rain');assert.ok(dry.speed<20);assert.ok(dry.travel<7);assert.ok(wet.travel>dry.travel);
});
test('off-ball teammate supports the carrier rather than chasing their ball',()=>{
  const {s,p}=scenario(),mate=s.players[8];mate.x=p.x+30*Q;mate.y=p.y+20*Q;
  const action=aiIntent(s,mate);assert.equal(mate.intent,'support');assert.ok(action.x!==0||action.y!==0);
  assert.ok(distance({x:mate.tx,y:mate.ty},p)>80*Q);
});
test('keeper-versus-attacker scenario: central shot is saved with reaction and physical contact',()=>{
  const {s,p}=scenario({difficulty:2}),keeper=s.players[11];keeper.x=s.w/2;keeper.y=25*Q;
  p.y=145*Q;s.ball.y=p.y-12*Q;kick(s,p,'shot',45,{x:s.w/2,y:0});
  for(let i=0;i<40&&s.stats.saves[1]===0&&s.phase==='play';i++)step(s);
  assert.equal(s.score[0],0);assert.ok(s.stats.saves[1]>0);
});
test('indoor walls preserve fast play while losing energy on each rebound',()=>{
  const s=createState({indoor:true});s.phase='play';s.players.forEach(p=>{p.x=100*Q;p.y=80*Q;});
  Object.assign(s.ball,{x:5*Q,y:s.h/2,vx:-12*Q,owner:-1});ballPhysics(s);
  assert.equal(s.phase,'play');assert.ok(s.ball.vx>9*Q&&s.ball.vx<11*Q);
});
test('Elite outdoor seed 42 creates shooting chances instead of an endless passing loop',()=>{
  const s=createState({humans:[false,false],difficulty:3,seed:42,seconds:120});
  while(s.phase!=='fulltime'&&s.tick<24000)step(s);
  assert.equal(s.phase,'fulltime');assert.ok(s.stats.shots[0]+s.stats.shots[1]>=4);
  assert.ok(s.stats.completedPasses[0]+s.stats.completedPasses[1]>0);
});
test('shot release aims in the current input direction without a one-tick lag',()=>{
  const {s,p}=scenario();p.charge=30;s.previous[0]={...EMPTY,fire:true};
  step(s,[{...EMPTY,x:1},EMPTY]);assert.ok(s.ball.vx>6*Q);assert.ok(Math.abs(s.ball.vy)<Q);
});
