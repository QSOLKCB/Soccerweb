"""CI audio-device preflight, separate from game/mix validation. No autoplay overrides."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
reports=[]
with sync_playwright() as pw:
 for name in ['chromium','firefox']:
  browser=getattr(pw,name).launch();page=browser.new_page()
  page.on('console',lambda message:print(message.text,flush=True) if message.type in ['warning','error'] else None)
  page.set_content('<button onclick="window.audioContext=new AudioContext();audioContext.resume()">Start audio</button>')
  page.click('button');page.wait_for_function("window.audioContext?.state==='running'",timeout=10000)
  reports.append(page.evaluate("({state:audioContext.state,sampleRate:audioContext.sampleRate,userAgent:navigator.userAgent})"));browser.close()
root=Path(__file__).resolve().parents[1]/'work/browser';root.mkdir(parents=True,exist_ok=True)
(root/'audio-device.json').write_text(json.dumps(reports,indent=2));print(json.dumps(reports))
