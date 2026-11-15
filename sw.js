// Bump VERSION when any app asset changes. A new worker waits for all old tabs to close.
const VERSION='soccerweb-v3.1.1-2';
const ROOT=new URL('./',self.location).href;
const CACHE=VERSION+'-'+ROOT;
const ASSETS=['./','./index.html','./style.css','./app.mjs','./icon.svg','./manifest.webmanifest',
  './game/state.mjs','./game/match.mjs','./game/actions.mjs','./game/teams.mjs','./simulation/math.mjs','./simulation/physics.mjs',
  './ai/team.mjs','./input/controls.mjs','./input/gamepads.mjs','./render/canvas.mjs','./render/camera.mjs','./render/players.mjs','./render/stadium.mjs','./audio/synth.mjs','./audio/score.mjs','./audio/effects.mjs','./audio/reference.mjs','./modes/competition.mjs','./modes/practice.mjs','./modes/goalposts.mjs','./modes/goalposts_presentation.mjs',
  './replay/replay.mjs','./replay/verify-worker.mjs'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(a=>new URL(a,ROOT).href)))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const name of await caches.keys())if(name.startsWith('soccerweb-')&&name.endsWith('-'+ROOT)&&name!==CACHE)await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(ROOT))return;
  // Serve one coherent application version; the browser revalidates the worker on navigation.
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE),hit=await cache.match(event.request,{ignoreSearch:true});
    if(hit)return hit;
    try{return await fetch(event.request);}catch(error){if(event.request.mode==='navigate')return await cache.match(new URL('./index.html',ROOT).href);throw error;}
  })());
});
