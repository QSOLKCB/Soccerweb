import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

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
    startMatch, home, setMode, showResult, togglePause, controls,
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
