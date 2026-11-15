import test from 'node:test';
import assert from 'node:assert/strict';
import { Q, hash } from '../simulation/math.mjs';
import { createState, EMPTY, nearest } from '../game/state.mjs';
import { step } from '../game/match.mjs';
import { kick, ballPhysics, tackle } from '../simulation/physics.mjs';
import { Recorder, verifyReplay, stateHash, validateReplay } from '../replay/replay.mjs';
const empty = () => [{ ...EMPTY }, { ...EMPTY }];
function isolated(options = {}) {
  const s = createState(options); s.phase = 'play';
  s.players.forEach((p, i) => { p.x = 25 * Q; p.y = (80 + i * 25) * Q; });
  return s;
}
function possession() {
  const s = isolated(), p = s.players[9]; p.x = s.w / 2; p.y = s.h / 2;
  p.fx = 0; p.fy = -Q; s.ball.x = p.x; s.ball.y = p.y - 10 * Q; s.ball.owner = p.id;
  return { s, p };
}
test('fixed timestep determinism and recorded tick inputs', () => {
  const run = () => {
    const s = createState({ seed: 731, weather: 'rain', aftertouch: 2 }), r = new Recorder(s);
    for (let i = 0; i < 4000; i++) {
      const input = empty(); input[0] = { ...EMPTY, x: i % 170 < 80 ? 1 : -1, y: -1, fire: i % 90 < 50, curve: i % 190 < 95 ? 1 : -1 };
      step(s, input); r.record(s, input);
    }
    return { s, data: r.export(s) };
  };
  const a = run(), b = run(); assert.equal(stateHash(a.s), stateHash(b.s));
  assert.equal(stateHash(a.s), '7f1ba5f7', 'Release v3 numerical regression fixture');
  const replay = verifyReplay(JSON.parse(JSON.stringify(a.data))); assert.equal(stateHash(replay), stateHash(a.s));
  console.log(`Replay evidence: 4000 ticks, seed 731, final hash ${stateHash(a.s)}, ${a.data.checkpoints.length} verified checkpoints`);
});
test('charged shots travel faster than tap shots, chips rise', () => {
  const a = possession(), b = possession(), c = possession();
  kick(a.s, a.p, 'shot', 5); kick(b.s, b.p, 'shot', 60); kick(c.s, c.p, 'chip', 40);
  assert.ok(Math.abs(b.s.ball.vy) > Math.abs(a.s.ball.vy)); assert.ok(c.s.ball.vz > b.s.ball.vz);
});
test('banana spin changes lateral trajectory', () => {
  const a = possession(), b = possession(); kick(a.s, a.p, 'shot', 45, null, 2); kick(b.s, b.p, 'shot', 45);
  for (let i = 0; i < 25; i++) { ballPhysics(a.s); ballPhysics(b.s); }
  assert.ok(a.s.ball.x > b.s.ball.x + 10 * Q);
});
test('goal line crossing scores once; high balls do not score', () => {
  const s = isolated(); Object.assign(s.ball, { x: s.w / 2, y: 2 * Q, vy: -8 * Q }); ballPhysics(s);
  assert.deepEqual(s.score, [1, 0]); assert.equal(s.phase, 'goal'); step(s); assert.equal(s.score[0], 1);
  const high = isolated(); Object.assign(high.ball, { x: high.w / 2, y: 2 * Q, vy: -8 * Q, z: 80 * Q }); ballPhysics(high);
  assert.deepEqual(high.score, [0, 0]); assert.equal(high.phase, 'restart');
});
test('swept goal plane uses crossing position, not endpoint', () => {
  const s = isolated(); Object.assign(s.ball, { x: s.w / 2 + s.goal / 2 - 10 * Q, y: Q, vx: 20 * Q, vy: -20 * Q });
  ballPhysics(s); assert.equal(s.score[0], 1);
});
test('pitch boundaries award throw-ins, corners and goal kicks', () => {
  const s = isolated(); Object.assign(s.ball, { x: -Q, y: s.h / 2, last: 0 }); ballPhysics(s);
  assert.equal(s.restartType, 'THROW IN'); assert.equal(s.restartTeam, 1);
  const c = isolated(); Object.assign(c.ball, { x: 20 * Q, y: Q, vy: -3 * Q, last: 1 }); ballPhysics(c); assert.equal(c.restartType, 'CORNER');
  const g = isolated(); Object.assign(g.ball, { x: 20 * Q, y: Q, vy: -3 * Q, last: 0 }); ballPhysics(g); assert.equal(g.restartType, 'GOAL KICK');
});
test('indoor side walls rebound without a stoppage', () => {
  const s = isolated({ indoor: true }); Object.assign(s.ball, { x: 5 * Q, y: s.h / 2, vx: -10 * Q }); ballPhysics(s);
  assert.ok(s.ball.vx > 0); assert.equal(s.phase, 'play'); assert.equal(s.players.length, 12);
});
test('ground bounce loses vertical energy and friction slows the ball', () => {
  const s = isolated(); Object.assign(s.ball, { x: s.w / 2, y: s.h / 2, vx: 2 * Q, z: Q, vz: -2 * Q }); ballPhysics(s);
  assert.ok(s.ball.vz > 0 && s.ball.vz < 2 * Q); assert.ok(s.ball.vx < 2 * Q);
});
test('goalkeepers catch controlled shots and rebound hard shots', () => {
  for (const speed of [7, 15]) {
    const s = isolated(), p = s.players[11]; p.x = s.w / 2; p.y = 22 * Q;
    Object.assign(s.ball, { x: p.x, y: p.y + speed * Q, vy: -speed * Q, last: 0, kind: 'shot' }); ballPhysics(s);
    assert.equal(s.stats.saves[1], 1);
    if (speed === 7) assert.equal(s.ball.owner, p.id); else assert.ok(s.ball.vy > 0);
  }
});
test('possession applies physical impulses instead of attaching the ball', () => {
  const {s,p} = possession(); const before = s.ball.y; ballPhysics(s);
  assert.equal(s.ball.y, before); assert.notEqual(s.ball.vy, 0); assert.equal(s.ball.owner, p.id);
});
test('manual selection switches to an eligible outfielder', () => {
  const s = createState({ auto: false }); s.phase = 'play'; const old = s.selected[0];
  const i = empty(); i[0].switch = true; step(s, i);
  assert.notEqual(s.selected[0], old); assert.equal(s.players[s.selected[0]].team, 0); assert.equal(s.players[s.selected[0]].keeper, false);
});
test('sliding tackles dislodge the ball', () => {
  const {s,p} = possession(), foe = s.players[12]; foe.x = s.ball.x; foe.y = s.ball.y; foe.fy = Q;
  tackle(s, foe); ballPhysics(s); assert.equal(s.ball.last, 1); assert.equal(s.ball.owner, -1);
});
test('wet turf retains more ball speed than dry turf', () => {
  const a = isolated(), b = isolated({ weather: 'rain' }); a.ball.vx = b.ball.vx = 6 * Q;
  ballPhysics(a); ballPhysics(b); assert.ok(b.ball.vx > a.ball.vx);
});
test('AI match reaches valid full time and produces real football actions', () => {
  const s = createState({ humans: [false, false], seed: 42, seconds: 120 });
  while (s.phase !== 'fulltime' && s.tick < 20000) step(s);
  assert.equal(s.phase, 'fulltime'); assert.equal(s.elapsed, 7200); assert.equal(s.half, 2);
  assert.ok(s.stats.shots[0] + s.stats.shots[1] > 0); assert.ok(s.stats.passes[0] > 0); assert.ok(s.score[0] + s.score[1] > 0);
});
test('paused host makes no simulation calls; full time is immutable', () => {
  const s = createState(); const before = stateHash(s); let paused = true;
  for (let i = 0; i < 60; i++) if (!paused) step(s);
  assert.equal(stateHash(s), before); paused = false; if (!paused) step(s); assert.equal(s.tick, 1);
  s.phase = 'fulltime'; const end = stateHash(s); step(s); assert.equal(stateHash(s), end);
});
test('replay rejects malformed input, bad checksums and unsupported versions', () => {
  const s = createState(), r = new Recorder(s); step(s); r.record(s, empty()); const data = r.export(s);
  assert.throws(() => validateReplay({...data, version: 99}));
  for(const version of [1,2])assert.throws(() => validateReplay({...data, version}), /Unsupported/, 'Reject recordings from earlier simulation rules');
  assert.throws(() => validateReplay({...data, frames: [[[99,0,0,0],[0,0,0,0]]]}));
  assert.throws(() => verifyReplay({...data, finalHash: 'deadbeef'}));
});
test('eight-direction movement has no diagonal speed advantage',()=>{
  const run=(x,y)=>{const {s,p}=possession();s.config.auto=false;s.selected[0]=p.id;for(let n=0;n<30;n++)step(s,[{...EMPTY,x,y},EMPTY]);return Math.hypot(p.vx,p.vy);};
  const cardinal=run(1,0),diagonal=run(1,-1);assert.ok(Math.abs(cardinal-diagonal)<8,`${cardinal} vs ${diagonal}`);
});
test('airborne contact supports volleys and overheads',()=>{
  const a=possession(),b=possession();a.s.ball.z=b.s.ball.z=25*Q;
  assert.ok(kick(a.s,a.p,'shot',40));assert.equal(a.s.events.at(-1).kind,'volley');
  assert.ok(kick(b.s,b.p,'overhead',40));assert.equal(b.s.events.at(-1).kind,'overhead');assert.ok(b.s.ball.vy<0);
});
test('charged long passes loft the ball while short passes stay low',()=>{
  const a=possession(),b=possession();kick(a.s,a.p,'pass',5);kick(b.s,b.p,'pass',55);
  assert.ok(b.s.ball.vz>a.s.ball.vz);assert.equal(b.s.stats.passes[0],1);
});
test('halftime swaps ends and knockout draws continue until a genuine goal',()=>{
  const s=isolated({seconds:20,knockout:true});s.elapsed=599;step(s);assert.equal(s.phase,'halftime');
  const oldFacing=s.players[0].fy;for(let i=0;i<150;i++)step(s);assert.equal(s.half,2);assert.equal(s.players[0].fy,-oldFacing);
  s.phase='play';s.elapsed=1199;step(s);assert.equal(s.sudden,true);assert.equal(s.phase,'play');
  s.players.forEach(p=>{p.x=25*Q;p.y=250*Q;});Object.assign(s.ball,{owner:-1,x:s.w/2,y:s.h-Q,vx:0,vy:5*Q,z:0,vz:0});ballPhysics(s);
  assert.deepEqual(s.score,[1,0]);for(let i=0;i<150;i++)step(s);assert.equal(s.phase,'fulltime');
});
test('post and crossbar contacts rebound before any goal can be awarded at either end',()=>{
  for(const end of ['top','bottom'])for(const [offset,z] of [[0,35],[-69,0],[69,0]]){
    const s=isolated(),bottom=end==='bottom';
    Object.assign(s.ball,{x:s.w/2+offset*Q,y:bottom?s.h-Q:Q,z:z*Q,vx:0,vy:(bottom?8:-8)*Q,vz:0});
    ballPhysics(s);
    assert.deepEqual(s.score,[0,0],`${end}, offset ${offset}, z ${z}`);
    assert.equal(s.phase,'play');assert.equal(s.events.at(-1).type,'post');
    assert.ok(bottom?s.ball.vy<0:s.ball.vy>0);
  }
});
test('clear shots just inside the frame still score at either end',()=>{
  for(const end of ['top','bottom'])for(const [offset,z] of [[0,30],[-66,0],[66,0]]){
    const s=isolated(),bottom=end==='bottom';
    Object.assign(s.ball,{x:s.w/2+offset*Q,y:bottom?s.h-Q:Q,z:z*Q,vx:0,vy:(bottom?8:-8)*Q,vz:0});
    ballPhysics(s);assert.deepEqual(s.score,bottom?[0,1]:[1,0]);assert.equal(s.phase,'goal');
  }
});
