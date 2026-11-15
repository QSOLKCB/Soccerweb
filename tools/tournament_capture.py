"""Sparse genuine Chromium/Firefox Canvas frames. Dev dependency: playwright==1.56.0.
Run on a supported browser host/CI, not inside the headless simulation sweep.
"""
import argparse, functools, hashlib, html, http.server, json, subprocess, threading, time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--run', required=True); p.add_argument('--out', required=True)
p.add_argument('--limit', type=int, choices=range(1, 9), default=4)
p.add_argument('--controls', type=int, choices=range(1, 9), default=1)
p.add_argument('--browser', choices=['chromium', 'firefox'], default='chromium')
a = p.parse_args()
if a.controls > a.limit: p.error('controls must not exceed limit')
plan = json.loads(subprocess.check_output(['node', str(ROOT/'tools/tournament_capture_plan.mjs'), str(Path(a.run).resolve()), str(a.limit), str(a.controls)], cwd=ROOT, timeout=30))
out = Path(a.out).resolve(); out.mkdir(parents=True, exist_ok=False)
(out/'plan.json').write_text(json.dumps(plan, indent=2))
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
start = time.monotonic(); frames = []; errors = []; status = 'FAIL'
try:
    with sync_playwright() as pw:
        browser = getattr(pw, a.browser).launch()
        context = browser.new_context(viewport={'width': 1280, 'height': 900}, device_scale_factor=1, service_workers='block')
        # Only local checkout resources; no page-level external network traffic.
        origin = f'http://127.0.0.1:{server.server_port}'
        context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(origin+'/') else route.abort())
        page = context.new_page(); page.set_default_timeout(30000)
        page.on('pageerror', lambda e: errors.append(str(e)))
        for sample in plan['captures']:
            if time.monotonic()-start > 240: raise RuntimeError('Capture wall budget exceeded')
            page.goto(origin+'/tools/tournament_capture.html')
            page.evaluate("async config => { const {inspect}=await import('./tournament_capture.mjs'); window.inspection=inspect(config); }", sample['fixture']['config'])
            prior_pixels = None
            for tick in sample['ticks']:
                result = page.evaluate('(tick)=>inspection.advance(tick)', tick)
                assert result['cv']['nonblank'], 'Objective blank/flat Canvas check failed'
                # Downsample real canvas pixels; deterministic overlap diagnostic, no VLM.
                pixels = page.locator('canvas').evaluate("c=>{const x=document.createElement('canvas');x.width=64;x.height=45;const g=x.getContext('2d');g.drawImage(c,0,0,64,45);return Array.from(g.getImageData(0,0,64,45).data);}")
                result['cv']['changedChannelsFraction'] = None if prior_pixels is None else sum(x!=y for x,y in zip(pixels,prior_pixels))/len(pixels)
                prior_pixels = pixels
                name = f"f{sample['fixture']['id']}-t{tick}.png"; file = out/name
                page.locator('canvas').screenshot(path=str(file))
                frames.append({**result,'image':name,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(), 'bytes':file.stat().st_size,
                               'fixtureId':sample['fixture']['id'],'source':sample['source'],'fixtureChecksum':sample['checksum'],
                               'reason':sample['reason'],'browser':a.browser,'browserVersion':browser.version,'viewport':[1280,900],'dpr':1})
                if sum(f['bytes'] for f in frames)>32*1024*1024: raise RuntimeError('32 MiB image budget exceeded')
            final = page.evaluate('inspection.finish()')
            assert final['hash']==sample['finalHash'] and final['tick']==sample['finalTick'] and final['phase']=='fulltime', 'Browser/native replay divergence'
        assert not errors, errors
        status = 'PASS'; browser.close()
finally:
    server.shutdown()
    report = {'schema':1,'status':status,'wallSeconds':time.monotonic()-start,'sampling':plan['sampling'],'journalSHA256':plan['journalSHA256'],
              'frames':frames,'pageErrors':errors,'scope':'Genuine Canvas frames from deterministic AI re-simulation. No app HUD, audio, human inputs, physical display or frame-pacing claims. VLM NOT RUN.'}
    (out/'report.json').write_text(json.dumps(report,indent=2))
    cards=''.join(f'<figure><a href="{f["image"]}"><img width="640" src="{f["image"]}" alt="Fixture {f["fixtureId"]}, tick {f["tick"]}"></a><figcaption>{html.escape(f["reason"])} · tick {f["tick"]} / {f["activeSeconds"]:.2f} active seconds · state {f["hash"]}<br>PNG SHA256 {f["sha256"]}</figcaption></figure>' for f in frames)
    (out/'index.html').write_text(f'<!doctype html><html lang="en"><meta charset="utf-8"><title>SOCCERWEB sampled frames</title><h1>Sampled Canvas evidence — {status}</h1><p>{html.escape(report["scope"])}</p><p><a href="report.json">Provenance, CV checks and timeline</a> · <a href="plan.json">Sampling plan</a></p>{cards}</html>')
print(json.dumps({'status':status,'frames':len(frames),'out':str(out)}))
