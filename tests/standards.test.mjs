import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createState,EMPTY} from '../game/state.mjs';
import {step} from '../game/match.mjs';
import {stateHash,Recorder,verifyReplay} from '../replay/replay.mjs';
import {advanceGoalposts,goalGeometry,setupStage,shiftNotice} from '../modes/goalposts.mjs';
import {StandardAnnouncements,ANNOUNCEMENT_COOLDOWN,STANDARD_VICTORY,STANDARD_REVIEW} from '../modes/goalposts_presentation.mjs';
import {standardSign,drawGoalposts} from '../render/stadium.mjs';
import {cameraFrame} from '../render/camera.mjs';
import {effectRecipe} from '../audio/effects.mjs';
import {routeInput} from './goalposts_route.mjs';
import {standardsReference} from './standards_reference.mjs';

test('exact pre-polish v5 normal and GOALPOSTS hashes/checkpoints/replays are preserved',async()=>{
 const before=JSON.parse(fs.readFileSync(new URL('../docs/evidence/standards-polish/native-before.json',import.meta.url)));
 assert.deepEqual(await standardsReference(),before);
});
test('announcements follow real geometry after the warning, count revisions and never mutate state',()=>{
 for(const stage of [0,1,2]){
  const s=createState({mode:'goalposts',seed:731});s.goalposts.stage=stage;setupStage(s);s.phase='play';const presenter=new StandardAnnouncements();presenter.update(s);
  let firstMotion=null,warningSeen=false,motionEvents=0;
  for(let i=0;i<800;i++){
   s.tick++;s.events=[];advanceGoalposts(s);const before=structuredClone(s),g=goalGeometry(s,0),old=goalGeometry(s,0,0,1),sound=presenter.update(s);
   assert.deepEqual(s,before);
   if(presenter.view.kind==='warning')warningSeen=true;
   if(sound.some(e=>['standardrelocate','standardnarrow'].includes(e.type))){
    motionEvents++;firstMotion??=s.goalposts.clock;assert.equal(shiftNotice(s).warning,false);assert.ok(g.center!==old.center||g.width!==old.width);
   }
   if(s.goalposts.clock<=120)assert.equal(presenter.view.revision,0);
   const view=presenter.view;assert.deepEqual(presenter.update(s),[]);assert.deepEqual(presenter.view,view,'RAF cannot retrigger a tick');
  }
  assert.ok(firstMotion>120);assert.ok(warningSeen);assert.ok(motionEvents>=1);assert.ok(presenter.view.revision>=2);
 }
});
test('stopped clocks and repeated render calls cannot create new physical revisions',()=>{
 const s=createState({mode:'goalposts'}),p=new StandardAnnouncements();p.update(s);s.phase='play';
 for(let i=0;i<180;i++){s.tick++;s.events=[];advanceGoalposts(s);p.update(s);}
 const rev=p.view.revision;s.phase='goal';
 for(let i=0;i<150;i++){s.tick++;s.events=[];p.update(s);}assert.equal(p.view.revision,rev);
 const view=p.view;for(let i=0;i<1000;i++)assert.deepEqual(p.update(s),[]);assert.deepEqual(p.view,view);
});
test('cooldowns bound repeated announcements and post sounds without growing a queue',()=>{
 const s=createState({mode:'goalposts'}),p=new StandardAnnouncements();p.update(s);let messages=0,sounds=0;
 for(let tick=1;tick<=5000;tick++){
  s.tick=tick;s.events=[{type:'post',speed:8},{type:'nearmiss'}];const serial=p.view.serial;
  sounds+=p.update(s).filter(e=>e.type==='standardpost').length;messages+=p.view.serial!==serial;
 }
 assert.ok(messages<=Math.ceil(5000/ANNOUNCEMENT_COOLDOWN));assert.ok(sounds<=Math.ceil(5000/12));assert.ok(Object.keys(p.counts).length<=3);
 const trace=seed=>{const state=createState({mode:'goalposts',seed}),out=[],ui=new StandardAnnouncements();for(let t=0;t<500;t++){state.tick=t;state.events=t%100===0?[{type:'nearmiss'}]:[];ui.update(state);out.push(ui.view);}return out;};
 assert.deepEqual(trace(42),trace(42));assert.notDeepEqual(trace(42),trace(731));
});
test('cosmetic scoring, stage review and victory retain all goals and verify as v5',()=>{
 const s=createState({mode:'goalposts',seed:731,aftertouch:2}),p=new StandardAnnouncements(),r=new Recorder(s),messages=[];p.update(s);
 while(s.phase!=='fulltime'&&s.tick<12000){
  const input=routeInput(s);step(s,input);r.record(s,input);const hash=stateHash(s),rng=s.rng,serial=p.view.serial;
  for(const event of p.update(s))effectRecipe(event,s.config.seed);
  assert.equal(stateHash(s),hash);assert.equal(s.rng,rng);if(p.view.serial!==serial)messages.push(p.view);
 }
 assert.equal(s.goalposts.status,'won');assert.deepEqual(s.score,[3,0]);assert.equal(s.goalposts.total,4);
 assert.ok(messages.some(m=>m.kind==='goal'&&m.detail.includes('Valid goals are never withdrawn')));
 assert.ok(messages.some(m=>m.headline==='CONGRATULATIONS. THE CRITERIA HAVE CHANGED.'));
 assert.equal(p.view.headline,STANDARD_VICTORY);assert.equal(p.view.detail,STANDARD_REVIEW);
 const replay=r.export(s);assert.equal(replay.version,5);assert.equal(stateHash(verifyReplay(replay)),'c5a03750');
 p.reset();assert.equal(p.view.serial,0);assert.equal(p.view.revision,0);assert.equal(p.view.headline,'');
});
test('failure tells the actual rule and offers resubmission without claiming victory',()=>{
 const s=createState({mode:'goalposts'}),p=new StandardAnnouncements();p.update(s);
 s.tick++;s.phase='fulltime';s.goalposts.status='failed';s.goalposts.conceded=2;p.update(s);
 assert.match(p.view.detail,/Two goals conceded/);assert.equal(p.view.stamp,'RESUBMIT');assert.notEqual(p.view.headline,STANDARD_VICTORY);
});
test('CURRENT STANDARD stays above and centred on every authoritative opening at real camera sizes',()=>{
 for(const [w,h]of[[390,420],[900,900],[1365,760],[1920,1080]])for(const stage of [0,1,2])for(const clock of [0,120,180,420,700])for(const y of [0,500,1110]){
  const s=createState({mode:'goalposts'});Object.assign(s.goalposts,{stage,clock,previousClock:Math.max(0,clock-1)});Object.assign(s.ball,{x:650*256,y:y*256});
  const view=cameraFrame(s,w,h,{zoom:'wide',reduced:true}),g=goalGeometry(s,0),sign=standardSign(g,view.scale);
  assert.equal(sign.text,'CURRENT STANDARD');assert.equal(sign.center,g.center/256);assert.ok(sign.bottom<-g.height/256);
  assert.ok(sign.font*view.scale>=11-.001);assert.ok(h/2+(sign.top-view.y)*view.scale>=0);
  assert.ok(w/2+(sign.left-view.x)*view.scale>=0);assert.ok(w/2+(sign.right-view.x)*view.scale<=w);
 }
});
test('moving goal and signage use the same interpolated geometry with no cached ghost target',()=>{
 const s=createState({mode:'goalposts'});Object.assign(s.goalposts,{stage:2,clock:230,previousClock:229});
 const labels=[],paths=[],ctx=new Proxy({}, {get:(_,key)=>key==='fillText'?(...a)=>labels.push(a):key==='moveTo'?(...a)=>paths.push(a):()=>{}}),before=stateHash(s);
 const options={scale:.8,numerator:1,denominator:2};drawGoalposts(ctx,s,options);assert.equal(stateHash(s),before);
 const g=goalGeometry(s,0,1,2);assert.equal(labels[0][0],'CURRENT STANDARD');assert.equal(labels[0][1],g.center/256);assert.ok(paths.some(([x,y])=>x===g.left/256&&y===0));
});
test('committee SFX are original deterministic bounded recipes with restrained levels',()=>{
 const recipes=[];for(const type of ['standardrevision','standardrelocate','standardnarrow','standardstamp','standardpost','standardmiss','standardreview']){
  const e={type,speed:12},r=effectRecipe(e,731);assert.deepEqual(r,effectRecipe(e,731));assert.ok(r.length>0&&r.length<=5);
  assert.ok(r.every(n=>n.gain<=.045&&n.duration<=.2&&n.at+n.duration<=.7));recipes.push(JSON.stringify(r));
 }assert.equal(new Set(recipes).size,recipes.length);
});
