import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createState,VERSION} from '../game/state.mjs';
import {SCHEMA,settings,schedule,partition} from './tournament_core.mjs';
export const ROOT=fileURLToPath(new URL('../',import.meta.url));
export const digest=value=>crypto.createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
export const seal=row=>({...row,checksum:digest(row)});
export function readJSON(file){if(fs.statSync(file).size>1024*1024)throw Error('JSON metadata exceeds 1 MiB');return JSON.parse(fs.readFileSync(file,'utf8'));}
export function atomic(file,value){
 const temp=`${file}.tmp-${process.pid}`;const fd=fs.openSync(temp,'w');
 try{fs.writeFileSync(fd,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 fs.renameSync(temp,file);
}
export function source(){
 const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
 const files=[];
 for(const dir of ['game','ai','simulation','modes','replay','render','tools'])for(const f of fs.readdirSync(path.join(ROOT,dir)))if(/\.(mjs|py|html)$/.test(f)&&fs.statSync(path.join(ROOT,dir,f)).isFile())files.push(`${dir}/${f}`);
 files.sort();
 return {sha:git('rev-parse','HEAD'),dirty:!!git('status','--porcelain','--untracked-files=all','--',...files),codeSHA256:digest(files.map(f=>[f,digest(fs.readFileSync(path.join(ROOT,f)))]))};
}
export function validateSource(s){if(!s||!/^[a-f0-9]{40}$/.test(s.sha)||!/^[a-f0-9]{64}$/.test(s.codeSHA256)||typeof s.dirty!=='boolean')throw Error('Invalid source provenance');}
export function validateRow(row,expected,provenance){
 const {checksum,...payload}=row; if(checksum!==digest(payload))throw Error('Row checksum mismatch');
 if(row.schema!==SCHEMA||row.simulationVersion!==VERSION||!['COMPLETE','FAILED'].includes(row.status))throw Error('Unsupported row schema/status');
 validateSource(row.source);
 if(provenance&&JSON.stringify(row.source)!==JSON.stringify(provenance))throw Error('Source mismatch');
 const f=row.fixture,m=row.metrics;
 if(!f||!Number.isInteger(f.id)||f.id<0||f.id>=10000||typeof f.reverse!=='boolean'||f.pair!==Math.floor(f.id/2))throw Error('Invalid fixture');
 if(JSON.stringify(f.config)!==JSON.stringify(createState(f.config).config)||f.config.humans.some(Boolean)||f.config.knockout||f.config.mode)throw Error('Invalid AI fixture config');
 if(expected&&JSON.stringify(f)!==JSON.stringify(expected))throw Error('Fixture schedule mismatch');
 if(!m||!/^[a-f0-9]{8}$/.test(m.hash)||!Number.isInteger(m.ticks)||m.ticks<(row.status==='COMPLETE'?1:0)||m.ticks>120000||row.status==='COMPLETE'&&m.phase!=='fulltime')throw Error('Invalid match result');
 for(const key of ['score','shots','saves','passes','tackles','completedPasses','possession','interceptions','firstTouchLosses'])if(!Array.isArray(m[key])||m[key].length!==2||m[key].some(n=>!Number.isSafeInteger(n)||n<0))throw Error(`Invalid metric ${key}`);
 for(const key of ['directTurnovers','spells','shortSpells','meanPossessionTicks','p50PossessionTicks','p90PossessionTicks','looseTicks','crowdedPairsPerSample','goalShotRatio'])if(!Number.isFinite(m[key])||m[key]<0)throw Error(`Invalid metric ${key}`);
 if(m.seed!==f.config.seed||m.indoor!==f.config.indoor||m.difficulty!==f.config.difficulty||m.reverse!==f.reverse||JSON.stringify(m.teams)!==JSON.stringify(f.config.teams))throw Error('Metric config mismatch');
 if(!row.telemetry||!Array.isArray(row.telemetry.flags)||row.telemetry.flags.length>16||!Array.isArray(row.telemetry.events)||row.telemetry.events.length>24)throw Error('Invalid telemetry');
 if(!Array.isArray(row.telemetry.spellHistogram)||row.telemetry.spellHistogram.length!==4||row.telemetry.spellHistogram.some(n=>!Number.isSafeInteger(n)||n<0)||row.telemetry.spellHistogram.reduce((a,b)=>a+b,0)!==m.spells)throw Error('Invalid spell histogram');
 if(row.status==='FAILED'&&(typeof row.error!=='string'||!row.error)||row.status==='COMPLETE'&&row.error!==null)throw Error('Invalid failure diagnostic');
 for(const flag of row.telemetry.flags)if(!/^[a-z0-9-]+$/.test(flag.id)||!Number.isInteger(flag.tick)||flag.tick<0||flag.tick>m.ticks||!/^[a-f0-9]{8}$/.test(flag.hash)||!Number.isInteger(flag.priority)||typeof flag.detail!=='string'||flag.detail.length>512)throw Error('Invalid anomaly');
 return row;
}
// Read at most 10k small rows; reject huge/corrupt artifacts before parsing or rendering.
export function readRows(file,{repairTail=false}={}){
 if(!fs.existsSync(file))return [];
 if(fs.statSync(file).size>128*1024*1024)throw Error('Journal exceeds 128 MiB');
 let text=fs.readFileSync(file,'utf8');
 if(text&&!text.endsWith('\n')){
  if(!repairTail)throw Error('Truncated journal');
  const end=text.lastIndexOf('\n')+1;fs.writeFileSync(file+'.torn-tail',text.slice(end));fs.truncateSync(file,Buffer.byteLength(text.slice(0,end)));text=text.slice(0,end);
 }
 const lines=text.trim()?text.trimEnd().split('\n'):[];
 if(lines.length>10000)throw Error('Too many rows');
 const seen=new Set();return lines.map(line=>{if(line.length>32768)throw Error('Oversized row');const r=validateRow(JSON.parse(line));if(seen.has(r.fixture.id))throw Error('Duplicate fixture');seen.add(r.fixture.id);return r;});
}
export function loadRun(dir,{repairTail=false}={}){
 const manifest=readJSON(path.join(dir,'manifest.json'));
 if(manifest.schema!==SCHEMA||manifest.simulationVersion!==VERSION)throw Error('Unsupported manifest');
 validateSource(manifest.source);
 const options=settings(manifest.options);if(JSON.stringify(options)!==JSON.stringify(manifest.options))throw Error('Noncanonical options');
 const fixtures=partition(schedule(options),manifest.shard.index,manifest.shard.count);
 if(manifest.scheduleSHA256!==digest(schedule(options)))throw Error('Schedule checksum mismatch');
 const map=new Map(fixtures.map(f=>[f.id,f]));
 const rows=readRows(path.join(dir,'fixtures.ndjson'),{repairTail});
 for(const row of rows){const expected=map.get(row.fixture.id);if(!expected)throw Error('Fixture outside shard');validateRow(row,expected,manifest.source);}
 return {manifest,rows,fixtures};
}
export function mergeRuns(directories){
 if(!directories.length||directories.length>32)throw Error('Merge needs 1..32 shards');
 const runs=directories.map(d=>loadRun(d)),first=runs[0].manifest,rows=[],seen=new Set(),indices=new Set();
 for(const run of runs){
  const m=run.manifest;
  if(JSON.stringify(m.source)!==JSON.stringify(first.source)||m.scheduleSHA256!==first.scheduleSHA256||m.shard.count!==first.shard.count)throw Error('Incompatible shard provenance');
  if(indices.has(m.shard.index))throw Error('Duplicate shard');indices.add(m.shard.index);
  for(const row of run.rows){if(seen.has(row.fixture.id))throw Error('Duplicate fixture');seen.add(row.fixture.id);rows.push(row);}
 }
 rows.sort((a,b)=>a.fixture.id-b.fixture.id);
 const complete=rows.length===first.options.count;
 return {manifest:{...first,shard:{index:0,count:1},mergedShards:[...indices].sort((a,b)=>a-b)},rows,status:rows.some(r=>r.status==='FAILED')?'FAIL':complete?'PASS':'PARTIAL'};
}

export function loadReceipt(dir){
 const {manifest,rows,fixtures}=loadRun(dir);const r=readJSON(path.join(dir,'receipt.json'));
 if(r.schema!==SCHEMA||!['PASS','FAIL','PARTIAL','RUNNING'].includes(r.status)||r.fixtures!==rows.length||r.journalSHA256!==digest(fs.readFileSync(path.join(dir,'fixtures.ndjson'))))throw Error('Receipt journal/status mismatch');
 if(JSON.stringify(r.source)!==JSON.stringify(manifest.source))throw Error('Receipt source mismatch');
 if(r.status==='PASS'&&(rows.length!==fixtures.length||rows.some(v=>v.status!=='COMPLETE')))throw Error('False PASS receipt');
 if(r.status==='PASS'&&manifest.verificationRequired&&!manifest.mergedShards){
  const representatives=new Map();for(const row of rows){const c=row.fixture.config,key=`${c.indoor}/${c.difficulty}/${c.weather}`;if(!representatives.has(key))representatives.set(key,row);}
  const expected=[...representatives.values()].slice(0,12);
  if(!Array.isArray(r.verification)||r.verification.length!==expected.length||expected.some((row,i)=>r.verification[i].status!=='PASS'||r.verification[i].id!==row.fixture.id||r.verification[i].hash!==row.metrics.hash))throw Error('Missing or failed required verification');
 }
 return r;
}
