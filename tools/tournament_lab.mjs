#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {setImmediate} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {VERSION} from '../game/state.mjs';
import {SCHEMA,settings,parseSeeds,schedule,partition,runFixture,integer,BudgetExceeded} from './tournament_core.mjs';
import {ROOT,digest,seal,atomic,source,loadRun,loadReceipt,mergeRuns} from './tournament_io.mjs';
import {writeReport} from './tournament_report.mjs';
export const HELP=`SOCCERWEB tournament lab (development only; no model/browser in sweep)
node tools/tournament_lab.mjs [run|merge|report] --out DIRECTORY [options]
  --preset quick|medium|large   96 / 1000 / 10000 fixtures (default quick)
  --max-fixtures N             even count, 2..10000, canonical prefix
  --seeds 42,731 or 1:16        1..256 distinct uint32 seeds, no zero
  --mode both|outdoor|indoor    default both; regulation AI only
  --seconds N                  active seconds per fixture, 20..720 (120)
  --shard-index N --shard-count N  index 0..count-1, count 1..32
  --budget-seconds N           wall budget 1..7200 (600)
  --fixture-ms N               per-fixture timeout 1..60000 (60000)
  --resume                     same source/config/shard only; repair torn tail
  --verify                     rerun up to 12 stratified completed fixtures
  --inputs DIR,DIR             merge/report input directories (max 32)
  --help                       no simulation
Exit 0 PASS, 2 PARTIAL/work budget/interruption, 1 failure/invalid arguments.
Fresh output directories required. Outputs are never silently overwritten.
Examples:
 node tools/tournament_lab.mjs --out work/quick --verify
 node tools/tournament_lab.mjs --preset medium --budget-seconds 1200 --out work/1k
 node tools/tournament_lab.mjs merge --inputs work/s0,work/s1 --out work/merged
 node tools/tournament_lab.mjs report --inputs work/quick --out work/report
`;
export function parseArgs(args){
 const values={},flags=new Set(),known=new Set(['out','preset','max-fixtures','seeds','mode','seconds','shard-index','shard-count','budget-seconds','fixture-ms','inputs']);
 let command='run';if(args[0]&&!args[0].startsWith('--'))command=args.shift();
 if(!['run','merge','report'].includes(command))throw Error('Unknown command');
 for(let i=0;i<args.length;i++){
  const key=args[i].slice(2);if(!args[i].startsWith('--')||key in values||flags.has(key))throw Error('Invalid/duplicate argument');
  if(['help','verify','resume'].includes(key)){flags.add(key);continue;}
  if(!known.has(key)||!args[i+1]||args[i+1].startsWith('--'))throw Error(`Invalid option ${args[i]}`);values[key]=args[++i];
 }
 if(flags.has('help'))return{help:true};
 if(!values.out)throw Error('--out is required');
 if(command!=='run'&&(flags.size||Object.keys(values).some(k=>!['out','inputs'].includes(k))))throw Error('merge/report accept only --out and --inputs');
 if(command==='run'&&values.inputs)throw Error('--inputs is only for merge/report');
 const options=settings({preset:values.preset??'quick',count:values['max-fixtures'],...(values.seeds?{seeds:parseSeeds(values.seeds)}:{}),mode:values.mode??'both',seconds:values.seconds??120});
 const shard={index:integer(values['shard-index']??0,0,31,'shard index'),count:integer(values['shard-count']??1,1,32,'shard count')};if(shard.index>=shard.count)throw Error('Shard index out of range');
 const inputs=values.inputs?.split(',');if(command!=='run'&&(!inputs?.length||inputs.length>32||command==='report'&&inputs.length!==1))throw Error('Invalid input directories');
 return {command,out:path.resolve(values.out),options,shard,budget:integer(values['budget-seconds']??600,1,7200,'budget'),fixtureMs:integer(values['fixture-ms']??60000,1,60000,'fixture timeout'),resume:flags.has('resume'),verify:flags.has('verify'),inputs};
}
export function verificationSample(rows){
 const selected=new Map();for(const r of rows.filter(r=>r.status==='COMPLETE')){const c=r.fixture.config,key=`${c.indoor}/${c.difficulty}/${c.weather}`;if(!selected.has(key))selected.set(key,r);}
 return [...selected.values()].slice(0,12);
}
function lock(dir){
 const file=path.join(dir,'.lock');
 if(fs.existsSync(file)){
  const old=JSON.parse(fs.readFileSync(file,'utf8'));
  if(old.host!==os.hostname())throw Error('Output locked by another host');
  try{process.kill(old.pid,0);throw Error('Output already in use');}catch(e){if(e.code!=='ESRCH')throw e;fs.unlinkSync(file);}
 }
 fs.writeFileSync(file,JSON.stringify({pid:process.pid,host:os.hostname()}),{flag:'wx'});return()=>fs.unlinkSync(file);
}
export async function execute(o){
 if(o.command!=='run'){
  const merged=mergeRuns(o.inputs),receipts=o.inputs.map(d=>loadReceipt(d));fs.mkdirSync(o.out,{recursive:false});
  atomic(path.join(o.out,'manifest.json'),merged.manifest);
  atomic(path.join(o.out,'fixtures.ndjson'),merged.rows.map(r=>JSON.stringify(r)+'\n').join(''));
  // A merge cannot promote a shard with missing/failed verification to PASS.
  const status=receipts.some(r=>r.status==='FAIL')?'FAIL':merged.status==='PASS'&&receipts.every(r=>r.status==='PASS')?'PASS':merged.status==='FAIL'?'FAIL':'PARTIAL';
  atomic(path.join(o.out,'receipt.json'),{schema:SCHEMA,status,source:merged.manifest.source,command:o.command,inputs:receipts,fixtures:merged.rows.length,journalSHA256:digest(fs.readFileSync(path.join(o.out,'fixtures.ndjson')))});
  writeReport(o.out,merged.manifest,merged.rows,status);return status==='PASS'?0:status==='FAIL'?1:2;
 }
 const provenance=source(),all=schedule(o.options),fixtures=partition(all,o.shard.index,o.shard.count);
 if(!fixtures.length)throw Error('Empty shard');
 if(!o.resume)fs.mkdirSync(o.out,{recursive:false});else if(!fs.existsSync(o.out))throw Error('Resume directory missing');
 const unlock=lock(o.out);let fd,stopped=false;const stop=()=>{stopped=true;};process.on('SIGINT',stop);process.on('SIGTERM',stop);
 const started=performance.now(),cpu=process.cpuUsage(),deadline=started+o.budget*1000;
 let rows=[],manifest,previousSessions=[],status='PARTIAL',diagnostic=null,verification=[];
 const measurement=()=>{const wallSeconds=(performance.now()-started)/1000,cpuTime=process.cpuUsage(cpu),sessionRows=rows.length-initialCount,sessionTicks=rows.slice(initialCount).reduce((a,r)=>a+r.metrics.ticks,0);return{wallSeconds,cpuSeconds:(cpuTime.user+cpuTime.system)/1e6,peakRSSKiB:process.resourceUsage().maxRSS,fixtures:sessionRows,ticks:sessionTicks,matchesPerSecond:sessionRows/wallSeconds,ticksPerSecond:sessionTicks/wallSeconds};};
 let initialCount=0;
 const receipt=()=>({schema:SCHEMA,status,source:provenance,fixtures:rows.length,expected:fixtures.length,diagnostic,verification,
  invocation:process.argv,environment:{node:process.version,platform:os.platform(),release:os.release(),arch:os.arch(),cpu:os.cpus()[0]?.model,logicalCPUs:os.cpus().length,ramBytes:os.totalmem(),runner:process.env.GITHUB_ACTIONS?'GitHub Actions':'local',gpu:'NOT USED'},sessions:[...previousSessions,measurement()],journalSHA256:digest(fs.readFileSync(path.join(o.out,'fixtures.ndjson')))});
 try{
  if(o.resume){
   manifest=JSON.parse(fs.readFileSync(path.join(o.out,'manifest.json'),'utf8'));
   if(JSON.stringify(manifest.source)!==JSON.stringify(provenance)||JSON.stringify(manifest.options)!==JSON.stringify(o.options)||JSON.stringify(manifest.shard)!==JSON.stringify(o.shard))throw Error('Resume requires identical source/config/shard');
   const loaded=loadRun(o.out,{repairTail:true});rows=loaded.rows;
   if(JSON.stringify(manifest.source)!==JSON.stringify(provenance)||JSON.stringify(manifest.options)!==JSON.stringify(o.options)||JSON.stringify(manifest.shard)!==JSON.stringify(o.shard))throw Error('Resume requires identical source/config/shard');
   if(fs.existsSync(path.join(o.out,'receipt.json')))previousSessions=JSON.parse(fs.readFileSync(path.join(o.out,'receipt.json'))).sessions??[];
   if(previousSessions.length>=32)throw Error('At most 32 sessions per run');
  }else{
   manifest={schema:SCHEMA,simulationVersion:VERSION,source:provenance,options:o.options,shard:o.shard,scheduleSHA256:digest(all),verificationRequired:!!o.verify,metricDefinitions:'season_report.mjs; schema 1 extensions documented in docs/TOURNAMENT-LAB-001.md'};
   atomic(path.join(o.out,'manifest.json'),manifest);
  }
  if(o.verify&&!manifest.verificationRequired){manifest.verificationRequired=true;atomic(path.join(o.out,'manifest.json'),manifest);}
  initialCount=rows.length;fd=fs.openSync(path.join(o.out,'fixtures.ndjson'),'a');
  const done=new Set(rows.map(r=>r.fixture.id));
  status='RUNNING';atomic(path.join(o.out,'receipt.json'),receipt());
  for(const fixture of fixtures){
   await setImmediate();if(done.has(fixture.id))continue;
   if(stopped||performance.now()>=deadline){diagnostic=stopped?'Interrupted':'Run wall budget';break;}
   try{
    const row=seal({...runFixture(fixture,{deadline,fixtureMs:o.fixtureMs}),source:provenance});
    fs.writeSync(fd,JSON.stringify(row)+'\n');fs.fsyncSync(fd);rows.push(row);
    if(rows.length%10===0){atomic(path.join(o.out,'receipt.json'),receipt());console.log(`${rows.length}/${fixtures.length} fixtures`);}
   }catch(e){
    diagnostic=e.message;fs.appendFileSync(path.join(o.out,'attempts.ndjson'),JSON.stringify({fixture,source:provenance,error:e.message})+'\n');
    if(!(e instanceof BudgetExceeded))status='FAIL';break;
   }
  }
  if(status!=='FAIL')status=rows.some(r=>r.status==='FAILED')?'FAIL':rows.length===fixtures.length?'PASS':'PARTIAL';
  if(manifest.verificationRequired&&status==='PASS'){
   for(const r of verificationSample(rows)){
    if(stopped||performance.now()>=deadline){status='PARTIAL';diagnostic='Verification interrupted/budget';break;}
    try{const repeat=seal({...runFixture(r.fixture,{deadline,fixtureMs:o.fixtureMs}),source:provenance});if(repeat.checksum!==r.checksum)throw Error(`Verification divergence ${r.fixture.id}`);verification.push({id:r.fixture.id,hash:r.metrics.hash,status:'PASS'});}
    catch(e){status=e instanceof BudgetExceeded?'PARTIAL':'FAIL';diagnostic=e.message;verification.push({id:r.fixture.id,status,error:e.message});break;}
   }
  }
  atomic(path.join(o.out,'receipt.json'),receipt());writeReport(o.out,manifest,rows,status);
  console.log(JSON.stringify({status,fixtures:rows.length,...measurement(),output:o.out}));return status==='PASS'?0:status==='FAIL'?1:2;
 }finally{if(fd!==undefined)fs.closeSync(fd);unlock();process.off('SIGINT',stop);process.off('SIGTERM',stop);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const o=parseArgs(process.argv.slice(2));if(o.help)console.log(HELP);else process.exitCode=await execute(o);}catch(e){console.error(e.stack);process.exitCode=1;}
}
