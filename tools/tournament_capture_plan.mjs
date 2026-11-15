// Validate the complete receipt before emitting a bounded plan for the Python browser adapter.
import fs from 'node:fs';
import {loadRun,loadReceipt,source,digest} from './tournament_io.mjs';
import {selectCaptures} from './tournament_report.mjs';
const [dir,limit='4',controls='1']=process.argv.slice(2);
const {manifest,rows}=loadRun(dir);
const receipt=loadReceipt(dir);
if(receipt.status!=='PASS')throw Error('Browser capture requires a completed PASS receipt, including requested verification');
const current=source();
if(manifest.source.sha!==current.sha||manifest.source.codeSHA256!==current.codeSHA256)throw Error('Capture checkout does not match fixture provenance');
const plan=selectCaptures(rows,{limit:Number(limit),controls:Number(controls)});
plan.journalSHA256=digest(fs.readFileSync(`${dir}/fixtures.ndjson`));
console.log(JSON.stringify(plan));
