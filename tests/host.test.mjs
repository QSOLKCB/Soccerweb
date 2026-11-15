import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {EMPTY} from '../game/state.mjs';
import {routeInput} from './goalposts_route.mjs';
import {verifyReplay,stateHash} from '../replay/replay.mjs';

// Execute the actual browser host with a small DOM boundary and deferred fixture work.
// Only test code exposes lifecycle entry points; no mutable test hooks ship in the app.
async function host() {
  const appURL = new URL('../app.mjs', import.meta.url);
  let source = fs.readFileSync(appURL, 'utf8');
  const imports = {};
  for (const match of source.matchAll(/^import \{([^}]+)\} from '([^']+)';$/gm)) {
    const module = await import(new URL(match[2], appURL));
    for (const name of match[1].split(',').map(s => s.trim())) imports[name] = module[name];
  }
  const elements = new Map(), storage = new Map(), pending = [];
  let document;
  class Element extends EventTarget {
    constructor(id = '') {
      super(); this.id = id; this.value = ''; this.hidden = true; this.disabled = false;
      this.children = []; this.style = {setProperty() {}}; this.classList = {toggle() {}};
      this.textContent = ''; this.innerHTML = '';
    }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    focus() { if (!this.disabled) document.activeElement = this; }
    getContext() { return {}; }
  }
  document = Object.assign(new EventTarget(), {
    getElementById(id) { if (!elements.has(id)) elements.set(id, new Element(id)); return elements.get(id); },
    createElement() { return new Element(); }, createTextNode(text) { return {textContent: text}; },
    querySelectorAll() { return []; }, activeElement: null
  });
  const values = {'home-team':'0','away-team':'1',ground:'outdoor',difficulty:'2',duration:'60',weather:'clear',
    'master-volume':'65','music-volume':'35','sfx-volume':'70',aftertouch:'2',selection:'auto',visual:'clean',seed:'1988'};
  for (const [id, value] of Object.entries(values)) document.getElementById(id).value = value;
  const window = Object.assign(new EventTarget(), {scrollTo() {}});
  const navigator = {getGamepads: () => []};
  globalThis.window = window; globalThis.document = document;
  Object.defineProperty(globalThis, 'navigator', {value: navigator, configurable: true});
  imports.readSaved = (_, fallback) => fallback;
  imports.save = (key, value) => { storage.set(key, structuredClone(value)); return true; };
  imports.finishFixture = (competition, score, config) => new Promise((resolve, reject) => {
    pending.push({competition, score, config, resolve, reject});
  });
  const context = vm.createContext({...imports, document, window, navigator, structuredClone, URL,
    location: {protocol:'file:'}, requestAnimationFrame() {}, setTimeout() {}, clearTimeout() {}});
  source = source.replace(/^import .*;\n/gm, '').replaceAll('import.meta.url', JSON.stringify(appURL.href))
    .replace('export function diagnostics', 'function diagnostics');
  vm.runInContext(source + `\nglobalThis.testHost = {
    startMatch, startPractice, startGoalposts, diagnostics, home, setMode, showResult, togglePause, controls,
    // Drive the actual host tick/record path, omitting only cosmetic replay wall-time delays.
    runTick(input) { if(paused||stageWaiting||finished)return false;controls.sample=()=>input;tick();return true; },
    replay() { return recorder.export(state); },
    finish() { state.phase='fulltime'; state.score=[2,1]; return showResult(); },
    read() { return structuredClone({competition, activeCompetition, playing, finished, paused}); }
  };`, context, {filename:'app.mjs'});
  return {app:context.testHost, elements, storage, pending, document};
}
function nextRound(pending) {
  const result = structuredClone(pending.competition);
  result.round = 1; result.field = result.field.slice(0, 4);
  return result;
}
const snapshot = h => JSON.stringify({host:h.app.read(), storage:[...h.storage],
  title:h.elements.get('result-title').textContent, next:h.elements.get('result-next').textContent,
  disabled:h.elements.get('result-next').disabled, toast:h.document.getElementById('toast').textContent,
  focus:h.document.activeElement?.id});

for (const destination of ['clubhouse','quick','cup']) for (const outcome of ['success','failure']) {
  test(`old fixture ${outcome} cannot change ${destination} after leaving its match`, async () => {
    const h = await host(); h.app.setMode('cup'); h.app.startMatch();
    const completion = h.app.finish(); assert.equal(h.pending.length, 1);
    h.app.home();
    if (destination !== 'clubhouse') {
      h.app.setMode(destination); h.elements.get('home-team').value = '2'; h.app.startMatch();
      // Also cover a newer results screen while the previous result is unresolved.
      if (destination === 'cup') h.app.finish();
    }
    const before = snapshot(h), handler = h.elements.get('result-next').onclick;
    if (outcome === 'success') h.pending[0].resolve(nextRound(h.pending[0]));
    else h.pending[0].reject(new Error('stale failure'));
    await completion;
    assert.equal(snapshot(h), before);
    assert.equal(h.elements.get('result-next').onclick, handler);
    if (destination === 'quick') assert.equal(h.app.read().activeCompetition, null);
  });
}
test('current fixture completion advances and persists its own cup', async () => {
  const h = await host(); h.app.setMode('cup'); h.app.startMatch(); const completion = h.app.finish();
  assert.equal(h.document.activeElement.id, 'result-export');
  h.pending[0].resolve(nextRound(h.pending[0])); await completion;
  assert.equal(h.app.read().activeCompetition.round, 1);
  assert.equal(h.storage.get('soccerweb.competition.v1').round, 1);
  assert.equal(h.elements.get('result-next').disabled, false);
  assert.match(h.elements.get('result-next').textContent, /SEMI FINAL/);
});
test('current fixture failure offers retry without advancing saved progress', async () => {
  const h = await host(); h.app.setMode('cup'); h.app.startMatch(); const completion = h.app.finish();
  h.pending[0].reject(new Error('fixture failed')); await completion;
  assert.equal(h.storage.get('soccerweb.competition.v1').round, 0);
  assert.equal(h.elements.get('result-next').disabled, false);
  assert.match(h.elements.get('result-next').textContent, /RETRY/);
});
test('host suspends gameplay on overlays, restores it on resume, and focuses results', async () => {
  const h = await host(); h.app.startMatch(); assert.equal(h.app.controls.gameplayEnabled, true);
  h.app.controls.keys.add('Space'); h.app.togglePause();
  assert.equal(h.app.controls.gameplayEnabled, false); assert.equal(h.app.controls.active, true);
  assert.equal(h.app.controls.keys.size, 0); assert.equal(h.document.activeElement.id, 'resume');
  h.app.togglePause(); assert.equal(h.app.controls.gameplayEnabled, true); assert.equal(h.document.activeElement.id, 'game');
  await h.app.finish(); assert.equal(h.app.controls.gameplayEnabled, false); assert.equal(h.app.controls.active, false);
  assert.equal(h.document.activeElement.id, 'result-next');
  h.app.home(); h.app.startMatch(); assert.equal(h.app.controls.gameplayEnabled, true);
});

test('practice invalidates an old cup result and never records or persists a fixture',async()=>{
 const h=await host();h.app.setMode('cup');h.app.startMatch();const completion=h.app.finish();
 const saved=structuredClone([...h.storage]);h.app.startPractice(3);
 assert.equal(h.app.diagnostics().recordedTicks,0);assert.equal(h.app.diagnostics().practice.index,3);
 assert.equal(h.elements.get('pause-save').hidden,true);assert.equal(h.app.read().activeCompetition,null);
 h.pending[0].resolve(nextRound(h.pending[0]));await completion;assert.deepEqual([...h.storage],saved);
 h.app.home();h.app.setMode('quick');h.app.startMatch();assert.equal(h.app.diagnostics().practice,null);assert.equal(h.elements.get('pause-save').hidden,false);
});

test('GOALPOSTS invalidates pending cup results and leaves preferences, cup and practice isolated',async()=>{
 const h=await host();h.app.setMode('cup');h.app.startMatch();const completion=h.app.finish(),saved=structuredClone([...h.storage]);
 h.app.startGoalposts({difficulty:1});assert.equal(h.app.diagnostics().state.config.mode,'goalposts');assert.equal(h.app.read().activeCompetition,null);assert.equal(h.app.diagnostics().practice,null);
 h.pending[0].resolve(nextRound(h.pending[0]));await completion;assert.deepEqual([...h.storage],saved);
 h.app.home();h.app.startPractice(2);assert.equal(h.app.diagnostics().state.goalposts,undefined);assert.deepEqual([...h.storage],saved);
});

for(const held of [false,true])test(`Next Stage records a rising edge when kick ends the celebration ${held?'held':'released'}`,async()=>{
 const h=await host();h.app.startGoalposts({difficulty:1,aftertouch:2,seed:731});
 while(h.app.diagnostics().state.phase!=='stageclear'){
  const s=h.app.diagnostics().state;assert.ok(s.tick<1000);
  const input=s.phase==='goal'?[{...EMPTY,fire:held},{...EMPTY}]:routeInput(s);
  assert.equal(h.app.runTick(input),true);
 }
 const before=h.app.diagnostics();assert.equal(before.state.previous[0].fire,held);
 h.elements.get('stage-next').onclick();
 const physical=[{...EMPTY,fire:held},{...EMPTY}];
 assert.equal(h.app.runTick(physical),true);
 if(held){
  const released=h.app.diagnostics();assert.equal(released.state.phase,'stageclear');assert.equal(released.state.previous[0].fire,false);
  assert.equal(h.elements.get('stage-overlay').hidden,true,'neutral tick must not reopen the overlay');
  assert.equal(h.app.runTick(physical),true,'queued press must receive a second tick');
 }
 const after=h.app.diagnostics();assert.equal(after.state.goalposts.stage,1);assert.equal(after.state.phase,'kickoff');
 assert.equal(after.recordedTicks-before.recordedTicks,held?2:1);
 const replay=JSON.parse(JSON.stringify(h.app.replay()));
 assert.equal(replay.frames.at(-1)[0][2],1);if(held)assert.equal(replay.frames.at(-2)[0][2],0);
 assert.equal(stateHash(verifyReplay(replay)),after.hash,'release and press must both replay deterministically');
});

test('complete GOALPOSTS host presents the committee finale, keeps all scores and resets cleanly',async()=>{
 const h=await host();h.app.startGoalposts({difficulty:1,aftertouch:2,seed:731});
 while(!h.app.diagnostics().finished){
  const s=h.app.diagnostics().state;assert.ok(s.tick<2000);
  if(s.phase==='stageclear'){
   assert.equal(h.document.activeElement.id,'stage-next');
   assert.match(h.elements.get('stage-rule').textContent,/NEXT STANDARD:/);
   h.elements.get('stage-next').onclick();
  }
  assert.equal(h.app.runTick(routeInput(s)),true);
 }
 const result=h.app.diagnostics();assert.equal(result.state.goalposts.status,'won');assert.deepEqual(result.state.score,[3,0]);
 assert.equal(h.elements.get('result-title').textContent,'YOU HAVE SUCCESSFULLY MET EVERY STANDARD.');
 assert.equal(h.elements.get('result-review').textContent,'A NEW STANDARD IS NOW UNDER REVIEW.');
 assert.equal(h.elements.get('result-standards').children.length,3);assert.equal(h.document.activeElement.id,'result-next');
 assert.equal(stateHash(verifyReplay(JSON.parse(JSON.stringify(h.app.replay())))),result.hash);
 assert.ok(h.storage.has('soccerweb.goalposts.v1'));assert.equal(h.storage.has('soccerweb.competition.v1'),false);
 h.elements.get('result-next').onclick();assert.equal(h.app.diagnostics().state.goalposts.stage,0);assert.equal(h.app.diagnostics().standards.revision,0);
 h.app.home();h.app.setMode('quick');h.app.startMatch();await h.app.finish();
 assert.equal(h.elements.get('result-review').hidden,true);assert.equal(h.elements.get('result-standards').hidden,true);
});
