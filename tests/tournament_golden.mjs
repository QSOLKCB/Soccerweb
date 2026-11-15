// Full golden gate: deliberately separate from fast unit tests. No baseline regeneration.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {schedule,runFixture} from '../tools/tournament_core.mjs';
import {source,digest,atomic} from '../tools/tournament_io.mjs';
const file=new URL('../docs/evidence/tournament-lab/golden-season.json',import.meta.url);
const golden=JSON.parse(fs.readFileSync(file)),started=performance.now(),cpu=process.cpuUsage();
const fixtures=schedule();assert.equal(fixtures.length,golden.matches.length);
for(const [i,f] of fixtures.entries())assert.deepEqual(runFixture(f).metrics,golden.matches[i],`Legacy fixture ${i} diverged`);
const time=process.cpuUsage(cpu),report={status:'PASS',source:source(),baselineSource:'4d67655ce6b5dcb1f071118b03f7e6d80d7ba10b',baselineSHA256:digest(fs.readFileSync(file)),command:'node tests/tournament_golden.mjs',fixtures:96,checks:'Exact order and every legacy metric including final hash',wallSeconds:(performance.now()-started)/1000,cpuSeconds:(time.user+time.system)/1e6,peakRSSKiB:process.resourceUsage().maxRSS,exitCode:0};
console.log(JSON.stringify(report));if(process.argv[2])atomic(process.argv[2],report);
