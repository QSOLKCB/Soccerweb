import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {schedule,partition,parseSeeds,settings,runFixture,BudgetExceeded} from '../tools/tournament_core.mjs';
import {digest,seal,atomic,readJSON,readRows,validateRow,loadRun,loadReceipt,mergeRuns} from '../tools/tournament_io.mjs';
import {parseArgs,verificationSample} from '../tools/tournament_lab.mjs';
import {analyze,selectCaptures,escapeHTML,writeReport} from '../tools/tournament_report.mjs';
import {provision,validateVision,promptFor,audit} from '../tools/vision_audit.mjs';
const source={sha:'a'.repeat(40),dirty:false,codeSHA256:'b'.repeat(64)};
const options=settings({count:4,seconds:20}),fixtures=schedule(options);
const rows=fixtures.map(f=>seal({...runFixture(f),source}));
function temp(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'soccer-lab-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
function shard(dir,index,count,subset=rows){
 fs.mkdirSync(dir);const manifest={schema:1,simulationVersion:5,source,options,shard:{index,count},scheduleSHA256:digest(fixtures)};
 atomic(path.join(dir,'manifest.json'),manifest);atomic(path.join(dir,'fixtures.ndjson'),subset.filter(r=>r.fixture.id%count===index).map(r=>JSON.stringify(r)+'\n').join(''));return manifest;
}
test('canonical golden schedule: exact legacy orientation order and seeded configs',()=>{
 const golden=JSON.parse(fs.readFileSync(new URL('../docs/evidence/tournament-lab/golden-season.json',import.meta.url)));
 const full=schedule();assert.equal(full.length,96);
 for(const [i,f] of full.entries()){const m=golden.matches[i];assert.deepEqual([f.config.indoor,f.config.difficulty,f.config.seed,f.config.teams,f.reverse],[m.indoor,m.difficulty,m.seed,m.teams,m.reverse]);}
 for(let i=0;i<96;i+=2){assert.deepEqual(full[i].config.teams,[...full[i+1].config.teams].reverse());assert.equal(full[i].config.seed,full[i+1].config.seed);}
});
test('all shards form one schedule, independent of count/order; expanded weather and opposition',()=>{
 const full=schedule({preset:'medium'});assert.equal(full.length,1000);assert.equal(new Set(full.map(f=>f.config.weather)).size,2);
 for(const count of [1,2,3,7,32]){const merged=Array.from({length:count},(_,i)=>partition(full,i,count)).reverse().flat().sort((a,b)=>a.id-b.id);assert.deepEqual(merged,full);}
 assert.ok(full.every(f=>f.config.teams[0]!==f.config.teams[1]));
 assert.equal(schedule({preset:'large'}).length,10000);
});
test('CLI bounds, seeds/ranges, malformed and duplicate options',()=>{
 assert.deepEqual(parseSeeds('1:3,42'),[1,2,3,42]);
 for(const s of ['0','1,1','1:999','-1','3:1','1.5','1,','4294967296'])assert.throws(()=>parseSeeds(s));
 for(const args of [['--out','x','--max-fixtures','10002'],['--out','x','--max-fixtures','3'],['--out','x','--mode','goalposts'],['--out','x','--shard-index','2','--shard-count','2'],['--out','x','--seconds','NaN'],['--out','x','--out','y'],['merge','--out','x','--inputs','y','--verify']])assert.throws(()=>parseArgs(args));
 assert.equal(parseArgs(['--help']).help,true);assert.throws(()=>settings({preset:'constructor',count:4}));
});
test('full fixture reruns match every metric and anomaly; bounded work preserves partial state contract',()=>{
 assert.deepEqual(runFixture(fixtures[0]),(({source,checksum,...r})=>r)(rows[0]));
 assert.throws(()=>runFixture(fixtures[0],{deadline:performance.now()-1}),BudgetExceeded);
 const failed=runFixture(fixtures[0],{fixtureMs:-1});assert.equal(failed.status,'FAILED');assert.equal(failed.error,'Fixture wall-time limit');
 assert.equal(verificationSample(rows).length,1);
});
test('schema and checksum detect corrupted results and wrong provenance',()=>{
 validateRow(rows[0],fixtures[0],source);
 const bad=structuredClone(rows[0]);bad.metrics.score[0]++;assert.throws(()=>validateRow(bad),/checksum/);
 assert.throws(()=>validateRow(seal({...rows[0],checksum:undefined,simulationVersion:4}))); // invalid version/checksum
 const {checksum,...payload}=rows[0];assert.throws(()=>validateRow(seal({...payload,metrics:{...payload.metrics,shots:[-1,0]}})),/metric/);
 assert.throws(()=>validateRow(rows[0],fixtures[1],source),/schedule/);
 assert.throws(()=>validateRow(rows[0],fixtures[0],{...source,sha:'c'.repeat(40)}),/Source/);
});
test('journal rejects duplicates/corruption; interrupted last append can be salvaged only explicitly',t=>{
 const dir=temp(t),file=path.join(dir,'fixtures.ndjson'),line=JSON.stringify(rows[0])+'\n';fs.writeFileSync(file,line+'{"schema":');
 assert.throws(()=>readRows(file),/Truncated/);assert.deepEqual(readRows(file,{repairTail:true}),[rows[0]]);assert.equal(fs.readFileSync(file,'utf8'),line);assert.equal(fs.readFileSync(file+'.torn-tail','utf8'),'{"schema":');
 fs.appendFileSync(file,line);assert.throws(()=>readRows(file),/Duplicate/);
 fs.writeFileSync(file,'broken\n');assert.throws(()=>readRows(file,{repairTail:true}));
});
test('merge canonical order, missing shards, duplicates, mismatched source and explicit failed results',t=>{
 const dir=temp(t),a=path.join(dir,'a'),b=path.join(dir,'b');shard(a,0,2);shard(b,1,2);
 assert.deepEqual(mergeRuns([b,a]).rows,rows);assert.equal(mergeRuns([a,b]).status,'PASS');assert.equal(mergeRuns([a]).status,'PARTIAL');assert.throws(()=>mergeRuns([a,a]),/Duplicate shard/);
 const manifest=JSON.parse(fs.readFileSync(path.join(b,'manifest.json')));manifest.source.sha='c'.repeat(40);atomic(path.join(b,'manifest.json'),manifest);assert.throws(()=>mergeRuns([a,b]),/Source/);
 const fail=path.join(dir,'fail');shard(fail,0,1,[seal({...runFixture(fixtures[0],{fixtureMs:-1}),source})]);assert.equal(mergeRuns([fail]).status,'FAIL');
});
test('known scores produce expected aggregates, paired bias, spells and escaped offline report',t=>{
 const scripted=rows.map((r,i)=>({...r,metrics:{...r.metrics,score:i%2?[0,2]:[3,0]}}));const a=analyze(scripted);
 assert.equal(a.goals,10);assert.equal(a.side0Wins,2);assert.equal(a.pairedOrientation.pairs,2);assert.equal(a.pairedOrientation.meanSlot0Margin,.5);
 const club=a.groups.find(g=>g.dimension==='club'&&g.value===0);assert.equal(club.wins,2);assert.equal(club.goalDifference,5);
 assert.equal(a.possession.histogram.reduce((x,y)=>x+y,0),rows.reduce((n,r)=>n+r.metrics.spells,0));
 assert.equal(escapeHTML('<script>"&'),'&lt;script&gt;&quot;&amp;');const dir=temp(t);writeReport(dir,{options,source,shard:{index:0,count:1}},rows,'PARTIAL');const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');assert.match(html,/PARTIAL/);assert.doesNotMatch(html,/<script/);
});
test('capture selection is reproducible and sparse with independent controls',()=>{
 const a=selectCaptures(rows,{limit:2,controls:1});assert.deepEqual(a,selectCaptures([...rows].reverse(),{limit:2,controls:1}));assert.ok(a.captures.length<=2);assert.ok(a.captures.some(s=>s.reason==='pseudorandom-control'));assert.equal(new Set(a.captures.map(s=>s.fixture.id)).size,a.captures.length);assert.ok(a.captures.every(s=>s.ticks.length<=3));assert.throws(()=>selectCaptures(rows,{limit:9}));
});
test('local vision absent/missing provisioning is SKIPPED; strict JSON and evidence identity',async t=>{
 assert.equal((await provision(null)).status,'SKIPPED');
 const item={path:'/definitely-missing-local-model',identity:'test',sha256:'a'.repeat(64),license:'test',provenance:'test'};
 assert.equal((await provision({schema:1,runtime:{...item,kind:'llama-mtmd-cli'},model:item,projector:item})).status,'SKIPPED');
 const result={schema:1,image:'f0-t300.png',tick:300,verdict:'UNCERTAIN',observations:[{category:'uncertain',description:'Ball may be outside frame',uncertainty:'Single frame cannot prove absence'}]};
 assert.deepEqual(validateVision(JSON.stringify(result),result.image,300),result);
 for(const text of ['```json\n{}\n```','{}',JSON.stringify({...result,tick:301}),JSON.stringify({...result,execute:'rm -rf'}),JSON.stringify({...result,observations:[{...result.observations[0],category:'scores-incorrect'}]})])assert.throws(()=>validateVision(text,result.image,300));
 assert.match(promptFor(result.image,300),/cannot establish freezing/);
 const dir=temp(t);assert.equal((await audit({out:path.join(dir,'audit')})).status,'SKIPPED');assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'audit/audit.json'))).advisory,true);
});
test('CLI interruption receipt resumes without duplicates; incompatible resume and overwrite are refused',t=>{
 const dir=temp(t),out=path.join(dir,'run');const args=['tools/tournament_lab.mjs','--out',out,'--max-fixtures','24','--seconds','20'];
 const partial=spawnSync(process.execPath,[...args,'--budget-seconds','1'],{encoding:'utf8'});assert.equal(partial.status,2,partial.stderr);assert.equal(JSON.parse(fs.readFileSync(path.join(out,'receipt.json'))).status,'PARTIAL');
 const resumed=spawnSync(process.execPath,[...args,'--resume','--verify'],{encoding:'utf8'});assert.equal(resumed.status,0,resumed.stderr);assert.equal(loadRun(out).rows.length,24);
 const prior=fs.readFileSync(path.join(out,'receipt.json'),'utf8');const bad=spawnSync(process.execPath,[...args,'--resume','--mode','indoor'],{encoding:'utf8'});assert.equal(bad.status,1);assert.equal(fs.readFileSync(path.join(out,'receipt.json'),'utf8'),prior);
 assert.equal(spawnSync(process.execPath,args).status,1);assert.equal(fs.readFileSync(path.join(out,'receipt.json'),'utf8'),prior);
});
test('mocked local vision retains valid JSON and invalid raw responses without executing model text',async t=>{
 const dir=temp(t),captures=path.join(dir,'captures');fs.mkdirSync(captures);
 const bin=path.join(dir,'runtime'),model=path.join(dir,'model.gguf'),projector=path.join(dir,'projector.gguf');
 for(const f of [bin,model,projector])fs.writeFileSync(f,'mock artifact');fs.chmodSync(bin,0o755);
 const item=f=>({identity:'mock-only',path:f,sha256:digest('mock artifact'),license:'test fixture',provenance:'unit test'});
 const config={schema:1,runtime:{...item(bin),kind:'llama-mtmd-cli',version:'mock-v1'},model:{...item(model),quantization:'mock-Q4'},projector:item(projector),resources:{minimumRAMGiB:2,threads:1}};
 const image='f0-t300.png';fs.writeFileSync(path.join(captures,image),'mock PNG');atomic(path.join(captures,'report.json'),{schema:1,status:'PASS',frames:[{image,tick:300,sha256:digest('mock PNG'),source}]});
 let calls=0;
 const invoke=async(file,args,options)=>{calls++;assert.equal(file,bin);assert.equal(options.shell,false);assert.equal(options.timeout,60000);assert.ok(args.includes('-ngl'));return{stdout:JSON.stringify({schema:1,image,tick:300,verdict:'UNCERTAIN',observations:[]}),stderr:'mock runtime'};};
 const valid=await audit({captureDir:captures,out:path.join(dir,'valid'),config,invoke});assert.equal(valid.status,'ADVISORY');assert.equal(valid.images[0].status,'VALIDATED');assert.equal(calls,1);
 const invalid=await audit({captureDir:captures,out:path.join(dir,'invalid'),config,invoke:async()=>({stdout:'$(do not execute)',stderr:''})});assert.equal(invalid.images[0].status,'ERROR');assert.equal(invalid.images[0].raw,'$(do not execute)');assert.equal(invalid.advisory,true);
 const wrong=structuredClone(config);wrong.model.sha256='0'.repeat(64);await assert.rejects(()=>provision(wrong),/Checksum/);
});
test('merge rejects receipt tampering and carries incomplete verification as PARTIAL',t=>{
 const dir=temp(t),a=path.join(dir,'a'),b=path.join(dir,'b');
 for(const [index,d] of [a,b].entries()){
  shard(d,index,2);atomic(path.join(d,'receipt.json'),{schema:1,source,status:index?'PARTIAL':'PASS',fixtures:2,expected:2,journalSHA256:digest(fs.readFileSync(path.join(d,'fixtures.ndjson'))),verification:index?[]:[{status:'PASS'}]});
 }
 const out=path.join(dir,'merged'),cmd=['tools/tournament_lab.mjs','merge','--inputs',`${b},${a}`,'--out',out];const merged=spawnSync(process.execPath,cmd,{encoding:'utf8'});assert.equal(merged.status,2,merged.stderr);assert.equal(JSON.parse(fs.readFileSync(path.join(out,'receipt.json'))).status,'PARTIAL');
 const receipt=JSON.parse(fs.readFileSync(path.join(b,'receipt.json')));receipt.journalSHA256='0'.repeat(64);atomic(path.join(b,'receipt.json'),receipt);
 assert.equal(spawnSync(process.execPath,[...cmd.slice(0,-1),path.join(dir,'bad')]).status,1);assert.equal(fs.existsSync(path.join(dir,'bad')),false);
});

test('required representative verification cannot be omitted from a PASS receipt',t=>{
 const dir=temp(t),out=path.join(dir,'run');const manifest=shard(out,0,1);manifest.verificationRequired=true;atomic(path.join(out,'manifest.json'),manifest);
 const receipt={schema:1,source,status:'PASS',fixtures:4,journalSHA256:digest(fs.readFileSync(path.join(out,'fixtures.ndjson'))),verification:[]};atomic(path.join(out,'receipt.json'),receipt);
 assert.throws(()=>loadReceipt(out),/verification/);receipt.verification=verificationSample(rows).map(r=>({id:r.fixture.id,hash:r.metrics.hash,status:'PASS'}));atomic(path.join(out,'receipt.json'),receipt);assert.equal(loadReceipt(out).status,'PASS');
});

test('metadata is size-bounded, receipts require provenance and shard reports show assigned counts',t=>{
 const dir=temp(t),big=path.join(dir,'big.json');fs.writeFileSync(big,' '.repeat(1024*1024+1));assert.throws(()=>readJSON(big),/1 MiB/);
 const out=path.join(dir,'shard');const manifest=shard(out,1,2);const subset=rows.filter(r=>r.fixture.id%2===1);
 atomic(path.join(out,'receipt.json'),{schema:1,status:'PASS',fixtures:2,journalSHA256:digest(fs.readFileSync(path.join(out,'fixtures.ndjson')))});assert.throws(()=>loadReceipt(out),/source/);
 writeReport(out,manifest,subset,'PASS');const html=fs.readFileSync(path.join(out,'index.html'),'utf8');assert.match(html,/2\/2 assigned fixtures completed \(4 scheduled overall; shard 2\/2\)/);assert.match(html,/SOLAR ATHLETIC/);
});

test('a report write failure retains diagnostics and cannot leave a PASS receipt',t=>{
 const dir=temp(t),out=path.join(dir,'run'),args=['tools/tournament_lab.mjs','--out',out,'--max-fixtures','4','--seconds','20'];
 assert.equal(spawnSync(process.execPath,args).status,0);fs.unlinkSync(path.join(out,'analysis.json'));fs.mkdirSync(path.join(out,'analysis.json'));
 assert.equal(spawnSync(process.execPath,[...args,'--resume']).status,1);const receipt=readJSON(path.join(out,'receipt.json'));assert.equal(receipt.status,'FAIL');assert.ok(receipt.diagnostic);assert.equal(loadRun(out).rows.length,4);
});
test('regenerating a completed individual shard report preserves assignment and PASS',t=>{
 const dir=temp(t),input=path.join(dir,'input'),out=path.join(dir,'report');const manifest=shard(input,1,2);
 const receipt={schema:1,source,status:'PASS',fixtures:2,expected:2,journalSHA256:digest(fs.readFileSync(path.join(input,'fixtures.ndjson')))};atomic(path.join(input,'receipt.json'),receipt);
 const result=spawnSync(process.execPath,['tools/tournament_lab.mjs','report','--inputs',input,'--out',out],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 assert.deepEqual(readJSON(path.join(out,'manifest.json')),manifest);assert.equal(loadReceipt(out).status,'PASS');assert.match(fs.readFileSync(path.join(out,'index.html'),'utf8'),/2\/2 assigned fixtures completed \(4 scheduled overall; shard 2\/2\)/);
});
test('regenerated reports checksum the normalized journal and preserve CRLF input provenance',t=>{
 const dir=temp(t),input=path.join(dir,'input'),out=path.join(dir,'report');
 assert.equal(spawnSync(process.execPath,['tools/tournament_lab.mjs','--out',input,'--max-fixtures','2','--seconds','20','--verify']).status,0);
 const journal=path.join(input,'fixtures.ndjson'),receiptFile=path.join(input,'receipt.json');
 const lf=fs.readFileSync(journal,'utf8'),crlf=lf.replaceAll('\n','\r\n');fs.writeFileSync(journal,crlf);
 const receipt=readJSON(receiptFile);receipt.journalSHA256=digest(crlf);atomic(receiptFile,receipt);
 assert.equal(loadReceipt(input).status,'PASS');
 const result=spawnSync(process.execPath,['tools/tournament_lab.mjs','report','--inputs',input,'--out',out],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 assert.equal(fs.readFileSync(path.join(out,'fixtures.ndjson'),'utf8'),lf);
 const outputReceipt=loadReceipt(out);assert.equal(outputReceipt.status,'PASS');assert.equal(outputReceipt.journalSHA256,digest(lf));
 assert.equal(outputReceipt.report.inputJournalSHA256,digest(crlf));assert.notEqual(outputReceipt.journalSHA256,outputReceipt.report.inputJournalSHA256);
 assert.equal(fs.readFileSync(journal,'utf8'),crlf);assert.equal(loadReceipt(input).status,'PASS');
 const capture=spawnSync(process.execPath,['tools/tournament_capture_plan.mjs',out,'1','1'],{encoding:'utf8'});assert.equal(capture.status,0,capture.stderr);assert.equal(JSON.parse(capture.stdout).captures.length,1);
});
test('capture planning rejects missing, partial and failed native verification receipts',t=>{
 const dir=temp(t),out=path.join(dir,'run');
 assert.equal(spawnSync(process.execPath,['tools/tournament_lab.mjs','--out',out,'--max-fixtures','4','--seconds','20','--verify']).status,0);
 const command=['tools/tournament_capture_plan.mjs',out,'2','1'],file=path.join(out,'receipt.json'),receipt=readJSON(file);
 assert.equal(spawnSync(process.execPath,command).status,0);
 fs.unlinkSync(file);assert.equal(spawnSync(process.execPath,command).status,1);
 atomic(file,{...receipt,status:'PARTIAL'});assert.equal(spawnSync(process.execPath,command).status,1);
 atomic(file,{...receipt,verification:[]});assert.equal(spawnSync(process.execPath,command).status,1);
 atomic(file,{...receipt,status:'FAIL',verification:receipt.verification.map(v=>({...v,status:'FAIL'}))});assert.equal(spawnSync(process.execPath,command).status,1);
});
test('a clean checkout resumes with its own unignored output without changing code provenance',t=>{
 const dir=temp(t),repo=path.join(dir,'repo');fs.mkdirSync(repo);
 for(const folder of ['game','ai','simulation','modes','replay','render','tools'])fs.cpSync(new URL('../'+folder,import.meta.url),path.join(repo,folder),{recursive:true});
 const git=(...args)=>execFileSync('git',args,{cwd:repo,stdio:'ignore'});git('init');git('add','.');git('-c','user.name=Lab Test','-c','user.email=lab@example.invalid','commit','-m','Clean test source');
 const args=['tools/tournament_lab.mjs','--out','results','--max-fixtures','4','--seconds','20'];
 const first=spawnSync(process.execPath,args,{cwd:repo,encoding:'utf8'});assert.equal(first.status,0,first.stderr);const manifest=readJSON(path.join(repo,'results/manifest.json'));assert.equal(manifest.source.dirty,false);
 const resumed=spawnSync(process.execPath,[...args,'--resume'],{cwd:repo,encoding:'utf8'});assert.equal(resumed.status,0,resumed.stderr);assert.deepEqual(readJSON(path.join(repo,'results/manifest.json')).source,manifest.source);
});
