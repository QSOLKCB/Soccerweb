"""Paired real-browser production renders at identical source-derived ticks and viewports."""
import functools,hashlib,http.server,json,os,subprocess,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
BASE='b9db46ab9b42cb2c3e98d2af82c10eed0b309128'
OUT=ROOT/'work'/'goalposts-browser'/os.environ.get('BROWSER','chromium')/'comparison';OUT.mkdir(parents=True,exist_ok=True)
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT.parent)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/{ROOT.name}/tests/standards_probe.html'
cases=[(f'stage-{stage+1}',stage,1365,1000,1,'no-preference',{}) for stage in range(3)]
cases += [('narrow-reduced',2,390,720,1,'reduce',{}),('dpr2',2,900,900,2,'no-preference',{}),('pixel',2,1365,1000,1,'no-preference',{'pixel':True}),('wide-minimal',2,1920,1080,1,'no-preference',{'wide':True,'minimal':True})]
captures=[];errors=[]
try:
 with sync_playwright() as pw:
  browser=getattr(pw,os.environ.get('BROWSER','chromium')).launch()
  for name,stage,width,height,dpr,motion,options in cases:
   context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=dpr,reduced_motion=motion)
   page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto(url);page.wait_for_function('!!window.captureStandard')
   pair=[]
   for baseline in [True,False]:
    data=page.evaluate('(o)=>captureStandard(o)',{'baseline':baseline,'stage':stage,**options})
    assert data['hash']==['61523316','9be956cb','e3ade08c'][stage],data
    if not baseline:
     b=data['bounds'];assert b['left']>=0 and b['top']>=0 and b['right']<=width and b['bottom']<=height,b
     assert data['sign']['center']==data['geometry']['center']/256
     assert data['sign']['bottom']<data['geometry']['plane']/256-data['geometry']['height']/256
     assert data['sign']['font']*data['camera']['scale']>=11
    filename=f'{name}-{"before" if baseline else "after"}.png';page.screenshot(path=str(OUT/filename))
    data.update({'file':filename,'source':BASE if baseline else subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'pngSHA256':hashlib.sha256((OUT/filename).read_bytes()).hexdigest()})
    pair.append(data);captures.append(data)
   for key in ['hash','tick','clock','geometry','camera','players','viewport']:
    assert pair[0][key]==pair[1][key],(name,key)
   context.close()
  assert not errors,errors
  (OUT/'report.json').write_text(json.dumps({'status':'PASS','browser':os.environ.get('BROWSER','chromium'),'version':browser.version,'method':'Identical legitimate input streams and 120 production-renderer warmup frames; paired Canvas-only captures. Full-app live captures are separate.','captures':captures,'errors':errors},indent=2))
  print('Standards paired captures PASS',os.environ.get('BROWSER','chromium'),len(captures),flush=True);browser.close()
finally:server.shutdown()
