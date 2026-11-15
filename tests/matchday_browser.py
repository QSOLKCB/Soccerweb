"""Sustained real inputs and CPU stage measurements; no simulation-state injection."""
import base64, functools, http.server, json, os, threading
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'work'/'matchday'/os.environ.get('BROWSER','chromium');OUT.mkdir(parents=True,exist_ok=True)
class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT.parent)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/{ROOT.name}/'
def snapshot(page): return page.evaluate('soccerDiagnostics()')
try:
 with sync_playwright() as pw:
    browser=getattr(pw,os.environ.get('BROWSER','chromium')).launch()
    context=browser.new_context(viewport={'width':1365,'height':1000})
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    routes=[]
    for ground in ['outdoor','indoor']:
      for difficulty in ['1','2','3']:
        page.goto(url);page.wait_for_function("document.querySelector('#home-team').options.length===8")
        page.evaluate("async()=>{window.soccerDiagnostics=(await import('./app.mjs')).diagnostics}")
        page.select_option('#ground',ground);page.select_option('#difficulty',difficulty);page.click('#kickoff')
        page.wait_for_function("soccerDiagnostics()?.state.phase==='play'");start=snapshot(page);events=[]
        # 48 decisions over ~8 active seconds: approach ball, dribble toward goal, pass/charge/chip/switch.
        held=set()
        for n in range(48):
          s=snapshot(page)['state'];p=s['players'][s['selected'][0]];b=s['ball'];own=b['owner']==p['id']
          target_x=s['w']/2 if own else b['x'];target_y=0 if own else b['y']
          keys=set();dx=target_x-p['x'];dy=target_y-p['y']
          if abs(dx)>6*256:keys.add('d' if dx>0 else 'a')
          if abs(dy)>6*256:keys.add('s' if dy>0 else 'w')
          if n%18 in range(3,9):keys.add('Space')
          if n%18==8:keys.add('q')
          if n%18==12:keys.add('f')
          if n==30:keys.add('r')
          for k in held-keys:page.keyboard.up(k)
          for k in keys-held:page.keyboard.down(k)
          held=keys;page.wait_for_timeout(160);events.extend(snapshot(page)['state']['events'])
        for k in held:page.keyboard.up(k)
        end=snapshot(page)
        # Goal replays intentionally suspend simulation; wall time is not active ticks.
        assert end['state']['tick']>start['state']['tick']+90
        assert sum(end['state']['stats']['passes'])+sum(end['state']['stats']['shots'])>0
        routes.append({'ground':ground,'difficulty':difficulty,'ticks':end['state']['tick'],'stats':end['state']['stats'],'score':end['state']['score'],'observedEvents':events,'hash':end['hash']})
        page.screenshot(path=str(OUT/f'{ground}-{difficulty}.png'),full_page=True)
        (OUT/'routes.json').write_text(json.dumps(routes,indent=2))
    (OUT/'routes.json').write_text(json.dumps(routes,indent=2))
    # Separate P1/P2 key holds and focus loss on actual host.
    page.keyboard.press('Escape');page.click('#pause-quit');page.click('[data-mode="local"]');page.click('#kickoff')
    page.wait_for_function("soccerDiagnostics()?.state.phase==='play'");before=snapshot(page)
    for k in ['a','ArrowRight']:page.keyboard.down(k)
    page.wait_for_timeout(400)
    for k in ['a','ArrowRight']:page.keyboard.up(k)
    after=snapshot(page)
    for t,direction in [(0,-1),(1,1)]:
      id=before['state']['selected'][t];assert (after['state']['players'][id]['x']-before['state']['players'][id]['x'])*direction>256
    page.evaluate("window.dispatchEvent(new Event('blur'))");assert snapshot(page)['paused']
    # Standard Gamepad API boundary in a real browser; virtual devices, not physical hardware.
    page.keyboard.press('Escape')
    page.evaluate("window.testPads=[{axes:[1,0],buttons:Array.from({length:16},()=>({pressed:false}))}];navigator.getGamepads=()=>testPads")
    page.wait_for_timeout(300);page.evaluate("window.dispatchEvent(new Event('gamepaddisconnected'));testPads=[]")
    assert snapshot(page)['paused'];page.keyboard.press('Escape')
    assert not errors,errors
    # Practice is exercised only on the Phase 3 runtime; baseline has no practice entry.
    if page.locator('#practice-button').count():
      page.keyboard.press('Escape');page.click('#pause-quit');page.click('[data-mode="cup"]');page.click('#kickoff')
      page.keyboard.press('Escape');page.click('#pause-quit')
      saved=page.evaluate("localStorage.getItem('soccerweb.competition.v1')")
      practice_results=[]
      for index in range(6):
        page.click('#practice-button');page.select_option('#practice-drill',str(index));page.click('#practice-start')
        page.wait_for_function('soccerDiagnostics()?.practice !== null')
        if index==0:
          page.keyboard.down('w');page.keyboard.down('d');page.wait_for_timeout(900);page.keyboard.up('w');page.keyboard.up('d')
        elif index==1:
          for _ in range(3):page.keyboard.press('f');page.wait_for_timeout(1300)
        elif index==4:page.keyboard.press('Space')
        else:
          page.keyboard.down('Space');page.wait_for_timeout(500)
          if index==3:page.keyboard.down('e')
          page.keyboard.up('Space')
        page.wait_for_function('soccerDiagnostics()?.practice.complete',timeout=12000)
        if index==3:page.keyboard.up('e')
        result=snapshot(page);assert result['recordedTicks']==0;assert result['paused']
        assert page.locator('#pause-save').is_hidden()
        practice_results.append({'drill':index,'hash':result['hash'],'score':result['state']['score'],'stats':result['state']['stats']})
        page.screenshot(path=str(OUT/f'practice-{index}.png'),full_page=True)
        assert page.evaluate("localStorage.getItem('soccerweb.competition.v1')")==saved
        page.click('#pause-quit')
      (OUT/'practice.json').write_text(json.dumps(practice_results,indent=2))
      page.click('#options-button');page.locator('#key-mappings .key-button').first.click();page.keyboard.press('i')
      assert page.locator('#key-mappings .key-button').first.inner_text()=='I'
      page.click('#options-dialog .close');page.click('#practice-button');page.select_option('#practice-drill','0');page.click('#practice-start')
      assert 'I/' in page.locator('#practice-copy').inner_text()
      before=snapshot(page);page.keyboard.down('i');page.wait_for_timeout(300);page.keyboard.up('i');after=snapshot(page)
      id=before['state']['selected'][0];assert after['state']['players'][id]['y']<before['state']['players'][id]['y']-256
      page.keyboard.press('Escape');page.click('#pause-quit');page.click('#options-button');page.click('#reset-keys');page.click('#options-dialog .close')
      page.click('#practice-button');page.select_option('#practice-drill','2');page.click('#practice-start')
      page.evaluate("testPads=[{axes:[0,0],buttons:Array.from({length:16},(_,i)=>({pressed:i===0}))}]")
      page.wait_for_timeout(500);page.evaluate('testPads[0].buttons[0].pressed=false')
      page.wait_for_function('soccerDiagnostics()?.practice.complete',timeout=12000)
      assert snapshot(page)['state']['stats']['shots'][0]==1
      page.evaluate('testPads=[]')
    perf=[]
    for dpr,opts in [(1,{'camera':'wide','weather':'clear'}),(1,{'camera':'close','weather':'rain'}),(1,{'camera':'wide','indoor':True}),(2,{'camera':'close','indoor':True})]:
      ctx=browser.new_context(viewport={'width':1365 if dpr==1 else 900,'height':1000 if dpr==1 else 900},device_scale_factor=dpr)
      p=ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.goto(url+'tests/probe.html')
      perf.append(p.evaluate("async options=>(await import('./performance_probe.mjs')).measure(options)",opts));ctx.close()
    (OUT/'performance.json').write_text(json.dumps(perf,indent=2));assert not errors,errors
    # Trusted click starts a separate instance of the production live synth for auditable capture.
    p=context.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.goto(url+'tests/probe.html')
    p.evaluate("async()=>{const {captureLive}=await import('./live_audio_probe.mjs');document.body.onclick=()=>{document.body.onclick=null;captureLive().then(r=>window.captureResult=r).catch(e=>window.captureError=String(e))}}")
    p.locator('p').click();p.wait_for_function('window.captureResult||window.captureError',timeout=30000)
    assert not p.evaluate('window.captureError||null')
    capture=p.evaluate('window.captureResult');report=capture['report']
    assert report['rms']>.0001 and report['clippedSamples']==0 and report['peakVoices']<=64,report
    (OUT/'live-mix.wav').write_bytes(base64.b64decode(capture['wav']));(OUT/'live-audio.json').write_text(json.dumps(report,indent=2))
    assert not errors,errors
    print(json.dumps({'status':'PASS','browser':os.environ.get('BROWSER','chromium'),'routes':len(routes),'performanceCases':len(perf),'virtualGamepad':True,'physicalGamepad':'NOT RUN'}))
    browser.close()
finally: server.shutdown()
