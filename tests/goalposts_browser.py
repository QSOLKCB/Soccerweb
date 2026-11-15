"""Actual keys, goals, stage buttons, replay worker/playback and offline mode. No score/state injection."""
import functools,http.server,json,os,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'work'/'goalposts-browser'/os.environ.get('BROWSER','chromium');OUT.mkdir(parents=True,exist_ok=True)
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT.parent)))
threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/{ROOT.name}/'
def snap(p):return p.evaluate('soccerDiagnostics()')
def clock(p,t):p.wait_for_function('(t)=>soccerDiagnostics().state.goalposts.clock>=t',arg=t)
def install(p):p.evaluate("async()=>{window.soccerDiagnostics=(await import('./app.mjs')).diagnostics;window.goalGeometry=(await import('./modes/goalposts.mjs')).goalGeometry}")
try:
 with sync_playwright() as pw:
  browser=getattr(pw,os.environ.get('BROWSER','chromium')).launch();context=browser.new_context(viewport={'width':1365,'height':1000},accept_downloads=True)
  p=context.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  p.goto(url);p.wait_for_function("document.querySelector('#home-team').options.length===8");install(p)
  # Generic SNES USB preset, live test display, remapping and local persistence.
  p.evaluate("window.testPads=[{id:'Virtual generic USB SNES (test boundary)',axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false}))}];navigator.getGamepads=()=>testPads")
  p.click('#options-button');p.click('#controller-button');p.select_option('#pad-preset','snes')
  p.locator('#pad-bindings button').first.click();p.wait_for_timeout(80);p.evaluate('testPads[0].buttons[2].pressed=true');p.wait_for_function("document.querySelector('#pad-message').textContent.startsWith('Assigned')")
  p.evaluate('testPads[0].axes=[-1,-1]');p.wait_for_function("document.querySelector('#pad-direction').textContent.includes('↑←')")
  assert 'Kick' in p.locator('#pad-actions').inner_text();p.screenshot(path=str(OUT/'controller-calibration.png'),full_page=True)
  p.evaluate('testPads[0].axes=[0,0];testPads[0].buttons[2].pressed=false');p.click('#controller-dialog .close');p.click('#options-dialog .close')
  profile=p.evaluate("localStorage.getItem('soccerweb.controllers.v1')");assert json.loads(profile)['profiles'][0]['buttons']['fire']==2
  # Controller-only focus navigation and activation of a clubhouse button.
  p.locator('#kickoff').focus();p.evaluate('testPads[0].axes[1]=1');p.wait_for_function("document.activeElement.id==='goalposts-button'");p.evaluate('testPads[0].axes[1]=0');p.wait_for_timeout(60)
  p.evaluate('testPads[0].buttons[2].pressed=true');p.wait_for_function("document.querySelector('#goalposts-dialog').open");p.evaluate('testPads[0].buttons[2].pressed=false');p.click('#goalposts-dialog .close')
  p.reload();install(p);assert p.evaluate("localStorage.getItem('soccerweb.controllers.v1')")==profile
  p.evaluate("window.testPads=[];navigator.getGamepads=()=>testPads")
  p.click('#options-button');p.fill('#seed','731');p.locator('#seed').dispatch_event('change');p.click('#options-dialog .close')
  p.click('[data-mode="cup"]');p.click('#kickoff');p.keyboard.press('Escape');p.click('#pause-quit')
  cup=p.evaluate("localStorage.getItem('soccerweb.competition.v1')");prefs=p.evaluate("localStorage.getItem('soccerweb.preferences.v1')")
  p.click('#goalposts-button');assert 'Outdoor' in p.locator('#goalposts-dialog').inner_text();p.screenshot(path=str(OUT/'menu.png'),full_page=True);p.click('#goalposts-start')
  # The actual mode supports the same keyboard and virtual standard-gamepad pause semantics.
  p.keyboard.press('Escape');frozen=snap(p)['hash'];p.wait_for_timeout(120);assert snap(p)['hash']==frozen
  p.keyboard.press('Tab');assert p.evaluate('document.activeElement.id')=='pause-save';p.keyboard.press('Escape')
  p.evaluate("window.testPads=[{axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false}))}];navigator.getGamepads=()=>testPads;testPads[0].buttons[9].pressed=true")
  p.wait_for_function('soccerDiagnostics().paused');p.evaluate('testPads[0].buttons[9].pressed=false');p.wait_for_timeout(80);p.evaluate('testPads[0].buttons[9].pressed=true');p.wait_for_function('!soccerDiagnostics().paused');p.evaluate('testPads=[]')
  stages=[]
  for stage in range(3):
   p.wait_for_function('(stage)=>soccerDiagnostics().state.goalposts.stage===stage&&soccerDiagnostics().state.phase==="play"',arg=stage)
   p.wait_for_function("soccerDiagnostics().audio.state==='running'");assert snap(p)['audio']['mode']=='goalposts';assert snap(p)['audio']['voices']<=64
   initial=p.evaluate('goalGeometry(soccerDiagnostics().state,0)')
   if stage==0:clock(p,90)
   if stage==2:p.evaluate("testPads=[{axes:[1,-1],buttons:Array.from({length:16},(_,i)=>({pressed:i===2}))}]")
   else:p.keyboard.down('w');p.keyboard.down('d');p.keyboard.down('Space')
   # Read-only active clock determines when to release real keys; no simulation mutation.
   release=150 if stage==0 else 45
   clock(p,release)
   if stage==2:p.evaluate('testPads[0].axes[0]=0;testPads[0].buttons[4].pressed=true;testPads[0].buttons[2].pressed=false')
   else:p.keyboard.up('d');p.keyboard.down('q');p.keyboard.up('Space')
   # Keep up through one real tick so aiming follows the same control path as a person.
   p.wait_for_timeout(35)
   if stage==2:p.evaluate('testPads[0].axes[1]=0')
   else:p.keyboard.up('w')
   p.screenshot(path=str(OUT/f'stage-{stage+1}.png'),full_page=True)
   if stage==0:
    p.wait_for_function("soccerDiagnostics().state.phase==='goal'");p.keyboard.down('Space')
   if stage<2:p.wait_for_selector('#stage-overlay:not([hidden])',timeout=25000)
   else:p.wait_for_selector('#result-overlay:not([hidden])',timeout=25000)
   p.keyboard.up('q');p.evaluate('testPads=[]');s=snap(p);geometry=p.evaluate('goalGeometry(soccerDiagnostics().state,0)')
   assert s['state']['score'][0]==stage+1,s
   assert p.evaluate("localStorage.getItem('soccerweb.competition.v1')")==cup
   assert p.evaluate("localStorage.getItem('soccerweb.preferences.v1')")==prefs
   if stage==0:assert geometry['center']!=initial['center']
   stages.append({'stage':stage,'geometryBefore':initial,'geometryAfter':geometry,'history':s['state']['goalposts']['history'],'score':s['state']['score'],'hash':s['hash']})
   if stage<2:
    if stage==0:assert s['state']['previous'][0]['fire'], 'hold kick through the celebration'
    assert p.evaluate('document.activeElement.id')=='stage-next'
    p.keyboard.press('Tab');assert p.evaluate('document.activeElement.id')=='stage-retry';p.keyboard.press('Tab');assert p.evaluate('document.activeElement.id')=='stage-export'
    p.click('#stage-next')
    p.wait_for_function('(stage)=>soccerDiagnostics().state.goalposts.stage===stage+1',arg=stage)
    if stage==0:p.keyboard.up('Space')
  assert snap(p)['state']['goalposts']['status']=='won';p.screenshot(path=str(OUT/'victory.png'),full_page=True)
  best=p.evaluate("localStorage.getItem('soccerweb.goalposts.v1')");assert json.loads(best)['runs'][0]['difficulty']==1
  with p.expect_download() as dl:p.click('#result-export')
  replay_path=OUT/'goalposts-replay.json';dl.value.save_as(str(replay_path));replay=json.loads(replay_path.read_text());assert replay['version']==5;assert replay['config']['mode']=='goalposts'
  p.click('#result-home');p.click('#replays-button');p.set_input_files('#replay-file',str(replay_path));p.wait_for_selector('#watch-replay:not([hidden])',timeout=30000);p.click('#watch-replay')
  p.wait_for_selector('#result-overlay:not([hidden])',timeout=90000);assert snap(p)['hash']==replay['finalHash'];assert p.evaluate("localStorage.getItem('soccerweb.goalposts.v1')")==best
  p.click('#result-home');p.click('#goalposts-button');p.select_option('#goalposts-difficulty','3');p.click('#goalposts-start')
  # An unattended real run must terminate. This is failure-loop coverage, not balance evidence.
  p.wait_for_selector('#result-overlay:not([hidden])',timeout=120000);assert snap(p)['state']['goalposts']['status']=='failed';p.screenshot(path=str(OUT/'failure.png'),full_page=True)
  p.click('#result-next');assert snap(p)['state']['goalposts']['stage']==0;assert snap(p)['state']['score']==[0,0]
  p.keyboard.press('Escape');p.click('#pause-quit');assert p.locator('#menu').is_visible()
  assert p.evaluate("localStorage.getItem('soccerweb.competition.v1')")==cup
  # Cache includes the new mode; a full reload under the repository subpath works offline.
  p.evaluate('navigator.serviceWorker.ready');p.wait_for_function('!!navigator.serviceWorker.controller');context.set_offline(True);p.reload();install(p)
  p.click('#goalposts-button');p.click('#goalposts-start');p.wait_for_function("soccerDiagnostics().state.phase==='play'")
  clock(p,180);assert p.evaluate('goalGeometry(soccerDiagnostics().state,0).center')!=snap(p)['state']['w']/2
  p.screenshot(path=str(OUT/'offline.png'),full_page=True);assert not errors,errors
  (OUT/'report.json').write_text(json.dumps({'status':'PASS','browser':os.environ.get('BROWSER','chromium'),'userAgent':p.evaluate('navigator.userAgent'),'stages':stages,'replayHash':replay['finalHash'],'replayTicks':len(replay['frames']),'failureRetry':True,'offline':True,'physicalGamepad':'NOT RUN','manualPlaytesting':'NOT RUN'},indent=2))
  print('GOALPOSTS PASS',os.environ.get('BROWSER','chromium'),replay['finalHash'],flush=True);browser.close()
finally:server.shutdown()
