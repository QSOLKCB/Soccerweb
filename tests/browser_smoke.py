"""Real Chromium smoke tests. Test dependency only: pip install playwright==1.56.0.
Run `python -m playwright install chromium` once, then `python tests/browser_smoke.py`.
Serves the checkout beneath a repository subpath. No production test hooks mutate state.
"""
import functools
import http.server
import json
from pathlib import Path
import tempfile
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

handler = functools.partial(QuietHandler, directory=str(ROOT.parent))
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_port}/{ROOT.name}/'
artifacts = ROOT / 'work' / 'browser'
artifacts.mkdir(parents=True, exist_ok=True)

def snapshot(page):
    return page.evaluate("async () => (await import('./app.mjs')).diagnostics()")

try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        context = browser.new_context(viewport={'width': 1365, 'height': 1000}, accept_downloads=True)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(url)
        page.wait_for_function("document.querySelector('#home-team').options.length === 8")
        page.evaluate("async () => { window.soccerDiagnostics = (await import('./app.mjs')).diagnostics; }")
        assert page.title() == 'SOCCERWEB — The beautiful game.'
        page.screenshot(path=str(artifacts / 'clubhouse.png'), full_page=True)
        # Canvas contains actual pitch colours, rather than a blank successful load.
        colors = page.locator('#preview').evaluate("c => new Set(c.getContext('2d').getImageData(0,0,c.width,c.height).data).size")
        assert colors > 30
        page.select_option('#duration', '60')
        page.click('#kickoff')
        page.wait_for_function("() => window.soccerDiagnostics()?.state.phase === 'play'")
        before = snapshot(page)
        selected = before['state']['selected'][0]
        page.bring_to_front()
        page.locator('#game').focus()
        page.keyboard.down('w')
        page.keyboard.down('Space')
        page.wait_for_timeout(400)
        page.keyboard.up('Space')
        page.keyboard.up('w')
        page.wait_for_timeout(100)
        after = snapshot(page)
        print('Movement evidence:', json.dumps({'ticks':[before['state']['tick'],after['state']['tick']], 'y':[before['state']['players'][selected]['y'],after['state']['players'][selected]['y']]}), flush=True)
        page.screenshot(path=str(artifacts / 'movement.png'), full_page=True)
        assert after['state']['players'][selected]['y'] < before['state']['players'][selected]['y'] - 256
        assert snapshot(page)['state']['stats']['shots'][0] >= 1
        page.keyboard.press('Escape')
        assert page.locator('#pause-overlay').is_visible()
        paused = snapshot(page)
        page.wait_for_timeout(300)
        assert snapshot(page)['hash'] == paused['hash']
        page.click('#resume')
        page.screenshot(path=str(artifacts / 'match.png'), full_page=True)
        # Complete a live 60-second match with the normal animation/input loop.
        page.wait_for_selector('#result-overlay:not([hidden])', timeout=240000)
        result = snapshot(page)
        assert result['state']['phase'] == 'fulltime'
        assert result['state']['elapsed'] == 3600
        assert result['recordedTicks'] == result['state']['tick']
        assert page.locator('#result-score').inner_text()
        with page.expect_download() as download_info:
            page.click('#result-export')
        replay_path = artifacts / 'match-replay.json'
        download_info.value.save_as(str(replay_path))
        replay = json.loads(replay_path.read_text())
        assert replay['finalHash'] == result['hash']
        page.click('#result-home')
        page.click('#replays-button')
        page.set_input_files('#replay-file', str(replay_path))
        page.wait_for_selector('#watch-replay:not([hidden])', timeout=60000)
        assert 'Verified' in page.locator('#replay-message').inner_text()
        page.click('#watch-replay')
        page.wait_for_timeout(500)
        assert 'VERIFIED PLAYBACK' in page.locator('#record-status').inner_text()
        page.keyboard.press('Escape')
        page.click('#pause-quit')
        # Exercise independent P2 mappings in the indoor ruleset.
        page.click('[data-mode="local"]')
        page.select_option('#ground', 'indoor')
        page.click('#kickoff')
        page.wait_for_function("() => window.soccerDiagnostics()?.state.phase === 'play'")
        before = snapshot(page)
        assert len(before['state']['players']) == 12
        p2 = before['state']['selected'][1]
        page.keyboard.down('ArrowRight')
        page.wait_for_timeout(400)
        page.keyboard.up('ArrowRight')
        assert snapshot(page)['state']['players'][p2]['x'] > before['state']['players'][p2]['x'] + 256
        page.keyboard.press('Escape')
        page.click('#pause-quit')
        page.click('#options-button')
        page.select_option('#aftertouch', '3')
        page.click('#options-dialog .close')
        # Wait for the actual worker, then reload without network at a Pages-style subpath.
        page.evaluate('() => navigator.serviceWorker.ready')
        page.wait_for_function('navigator.serviceWorker.controller !== null')
        context.set_offline(True)
        page.reload()
        page.evaluate("async () => { window.soccerDiagnostics = (await import('./app.mjs')).diagnostics; }")
        page.wait_for_function("document.querySelector('#home-team').options.length === 8")
        page.click('#options-button')
        assert page.locator('#aftertouch').input_value() == '3'
        page.click('#options-dialog .close')
        page.click('#kickoff')
        page.wait_for_function("() => window.soccerDiagnostics()?.state.tick > 10")
        assert snapshot(page)['playing']
        assert not errors, errors
        print(json.dumps({'status':'PASS','browser':'Chromium','ticks':result['state']['tick'],
            'replay_hash':result['hash'],'score':result['state']['score'],
            'checks':['menu rendering','keyboard movement','charged shot','pause/resume','full time',
                      'replay export/import verification','replay playback','indoor local P2',
                      'saved settings','offline reload and match','GitHub Pages subpath','no JS errors']}, indent=2))
        browser.close()
finally:
    server.shutdown()
