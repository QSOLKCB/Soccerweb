import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()&&!['.git','work','.openai'].includes(e.name)?files(path.join(dir,e.name)):e.isFile()?[path.join(dir,e.name)]:[]);}
test('all runtime imports resolve locally and work under a Pages subpath',()=>{
  for(const file of files(root.pathname).filter(f=>f.endsWith('.mjs')&&!f.includes('/tests/'))){
    const src=fs.readFileSync(file,'utf8');for(const [,ref]of src.matchAll(/(?:from\s+|new URL\()['"]([^'"]+)['"]/g)){
      assert.ok(ref.startsWith('.'),`External runtime import: ${ref}`);assert.ok(fs.existsSync(path.resolve(path.dirname(file),ref)),`${file}: ${ref}`);
      const url=new URL(ref,'https://example.github.io/Soccerweb/'+path.relative(root.pathname,file));assert.ok(url.pathname.startsWith('/Soccerweb/'));
    }
    assert.ok(!src.includes('Math.random('));
  }
  const html=fs.readFileSync(new URL('index.html',root),'utf8');for(const [,ref]of html.matchAll(/(?:href|src)="([^"#]+)"/g))assert.ok(ref.startsWith('./'),`Non-relative asset: ${ref}`);
});
test('offline precache covers every executable runtime module and HTML asset',()=>{
  const source=fs.readFileSync(new URL('sw.js',root),'utf8');const refs=[...source.matchAll(/'\.\/([^']*)'/g)].map(m=>m[1]);
  for(const ref of refs)if(ref)assert.ok(fs.existsSync(new URL(ref,root)),`Missing cache asset ${ref}`);
  for(const file of files(root.pathname).filter(f=>f.endsWith('.mjs')&&!f.includes('/tests/')))assert.ok(refs.includes(path.relative(root.pathname,file)),`Uncached module ${file}`);
  for(const file of ['index.html','style.css','icon.svg','manifest.webmanifest'])assert.ok(refs.includes(file));
  const manifest=JSON.parse(fs.readFileSync(new URL('manifest.webmanifest',root),'utf8'));assert.equal(manifest.scope,'./');assert.equal(manifest.start_url,'./');
});
test('service worker installs and serves cached content offline, scoped to its own app',async()=>{
  const handlers={},stored=new Map(),removed=[];let claimed=false;
  const scope='https://example.github.io/Soccerweb/';
  const cache={addAll:async refs=>refs.forEach(url=>stored.set(url,{url})),match:async(request,opts)=>{
    let url=typeof request==='string'?request:request.url;if(opts?.ignoreSearch)url=url.split('?')[0];return stored.get(url);
  }};
  const caches={open:async()=>cache,keys:async()=>['soccerweb-v0-'+scope,'soccerweb-v0-https://example.github.io/Other/'],delete:async name=>removed.push(name)};
  const location=new URL(scope+'sw.js');const self={location,clients:{claim:async()=>{claimed=true;}},addEventListener:(name,fn)=>handlers[name]=fn};
  vm.runInNewContext(fs.readFileSync(new URL('sw.js',root),'utf8'),{self,caches,URL,fetch:async()=>{throw new Error('Offline');}});
  let promise;handlers.install({waitUntil:p=>promise=p});await promise;handlers.activate({waitUntil:p=>promise=p});await promise;
  assert.ok(claimed);assert.deepEqual(removed,['soccerweb-v0-'+scope]);
  handlers.fetch({request:{url:scope+'app.mjs',method:'GET',mode:'cors'},respondWith:p=>promise=p});assert.equal((await promise).url,scope+'app.mjs');
  handlers.fetch({request:{url:scope+'unknown',method:'GET',mode:'navigate'},respondWith:p=>promise=p});assert.equal((await promise).url,scope+'index.html');
});
