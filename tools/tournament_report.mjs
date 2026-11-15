import {digest,atomic} from './tournament_io.mjs';
import {percentile,integer} from './tournament_core.mjs';
import path from 'node:path';
export const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const total=a=>a.reduce((x,y)=>x+y,0);
export function wilson(w,n){if(!n)return [0,0];const z=1.96,d=1+z*z/n,c=(w/n+z*z/(2*n))/d,r=z*Math.sqrt(w/n*(1-w/n)/n+z*z/(4*n*n))/d;return[c-r,c+r];}
export function analyze(rows){
 const groups=new Map(),pairs=new Map(),rankGroups=new Map(),anomalies=[];
 let goals=0,ticks=0,blowouts=0,draws=0,side0=0;
 const complete=rows.filter(r=>r.status==='COMPLETE');
 for(const r of rows)for(const flag of r.telemetry.flags)anomalies.push({...flag,fixture:r.fixture,finalHash:r.metrics.hash,status:r.status});
 for(const r of complete){
  const m=r.metrics,c=r.fixture.config;goals+=total(m.score);ticks+=m.ticks;blowouts+=Math.abs(m.score[0]-m.score[1])>=5;draws+=m.score[0]===m.score[1];side0+=m.score[0]>m.score[1];
  const pair=pairs.get(r.fixture.pair)||[];pair.push(r);pairs.set(r.fixture.pair,pair);
  const seedGroup=`${c.seed}/${c.difficulty}/${c.indoor}/${c.weather}`;
  const rank=rankGroups.get(seedGroup)||new Map();rankGroups.set(seedGroup,rank);
  for(let side=0;side<2;side++){
   const w=m.score[side]>m.score[1-side],d=m.score[side]===m.score[1-side];
   const dims={club:c.teams[side],difficulty:c.difficulty,ground:c.indoor?'indoor':'outdoor',weather:c.weather,side,seed:c.seed};
   for(const [dimension,value] of Object.entries(dims)){
    const key=`${dimension}:${value}`,g=groups.get(key)||{dimension,value,played:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,shots:0,passes:0,completedPasses:0,possessionTicks:0,saves:0,tackles:0,interceptions:0};
    g.played++;g.wins+=w;g.draws+=d;g.losses+=!w&&!d;g.goalsFor+=m.score[side];g.goalsAgainst+=m.score[1-side];
    for(const k of ['shots','passes','completedPasses','saves','tackles','interceptions'])g[k]+=m[k][side];g.possessionTicks+=m.possession[side];groups.set(key,g);
   }
   const v=rank.get(c.teams[side])||{club:c.teams[side],played:0,points:0,margin:0};v.played++;v.points+=w?3:d?1:0;v.margin+=m.score[side]-m.score[1-side];rank.set(v.club,v);
  }
 }
 const paired=[...pairs.values()].filter(a=>a.length===2).map(a=>({pair:a[0].fixture.pair,slot0MeanMargin:total(a.map(r=>r.metrics.score[0]-r.metrics.score[1]))/2}));
 const ranks=Array.from({length:8},(_,club)=>({club,ranks:[]}));
 for(const group of rankGroups.values()){
  const list=[...group.values()].sort((a,b)=>b.points/b.played-a.points/a.played||b.margin/b.played-a.margin/a.played||a.club-b.club);
  for(const [i,v] of list.entries())ranks[v.club].ranks.push(i+1);
 }
 return {schema:1,total:rows.length,completed:complete.length,failed:rows.length-complete.length,goals,ticks,blowouts,draws,side0Wins:side0,
  side0WinFractionWilson95:wilson(side0,complete.length),pairedOrientation:{pairs:paired.length,meanSlot0Margin:paired.length?total(paired.map(p=>p.slot0MeanMargin))/paired.length:null,distribution:paired},
  groups:[...groups.values()].map(g=>({...g,goalDifference:g.goalsFor-g.goalsAgainst,conversion:g.shots?g.goalsFor/g.shots:null,passCompletion:g.passes?g.completedPasses/g.passes:null})),
  possession:{histogram:complete.reduce((a,r)=>a.map((v,i)=>v+r.telemetry.spellHistogram[i]),[0,0,0,0]),bins:['<3','3–19','20–59','60+'],directTurnovers:total(complete.map(r=>r.metrics.directTurnovers)),medianOfMatchP50:percentile(complete.map(r=>r.metrics.p50PossessionTicks),.5)},
  rankingDistributions:ranks.map(({club,ranks})=>({club,groups:ranks.length,p10:percentile(ranks,.1),median:percentile(ranks,.5),p90:percentile(ranks,.9)})),
  anomalies:anomalies.sort((a,b)=>a.priority-b.priority||a.fixture.id-b.fixture.id||a.tick-b.tick),
  caveat:'AI-v-AI diagnostics do not establish human fun, fairness or causation. Fixed paired seeds are dependent; the Wilson interval is descriptive, not a population confidence guarantee. Rankings are per seed/difficulty/ground/weather using points per played match, then margin, then club ID; schedules need not be round robins. Flags are review candidates. No fouls are simulated. GOALPOSTS authored routes remain a separate existing suite.'};
}
export function selectCaptures(rows,{limit=4,controls=1}={}){
 integer(limit,1,8,'capture limit');integer(controls,1,limit,'random controls');
 const eligible=rows.filter(r=>r.status==='COMPLETE'),selected=[],used=new Set();
 const add=(r,reason,tick)=>{used.add(r.fixture.id);const center=Math.min(r.metrics.ticks,Math.max(1,tick));selected.push({source:r.source,fixture:r.fixture,checksum:r.checksum,finalHash:r.metrics.hash,finalTick:r.metrics.ticks,reason,ticks:[...new Set([Math.max(1,center-30),center,Math.min(r.metrics.ticks,center+30)])]});};
 const flagged=eligible.flatMap(r=>r.telemetry.flags.map(flag=>({r,flag}))).sort((a,b)=>a.flag.priority-b.flag.priority||a.r.fixture.id-b.r.fixture.id);
 for(const {r,flag} of flagged){if(selected.length>=limit-controls)break;if(!used.has(r.fixture.id))add(r,flag.id,flag.tick);}
 // Hash-ranked deterministic pseudorandom controls, not runtime Math.random.
 const random=eligible.filter(r=>!used.has(r.fixture.id)).sort((a,b)=>digest(`control-v1:${a.fixture.id}`).localeCompare(digest(`control-v1:${b.fixture.id}`)));
 for(const r of random.slice(0,Math.min(controls,limit-selected.length)))add(r,'pseudorandom-control',Math.min(r.metrics.ticks-1,300+parseInt(digest(r.fixture).slice(0,6),16)%Math.max(1,r.metrics.ticks-301)));
 return {schema:1,maxFixtures:limit,maxImages:limit*3,sampling:'priority flags + SHA256-ranked controls v1',captures:selected};
}
function table(rows,keys){return `<div class="scroll"><table><thead><tr>${keys.map(k=>`<th>${escapeHTML(k)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${keys.map(k=>`<td>${escapeHTML(typeof r[k]==='number'?Number(r[k].toFixed(3)):r[k]??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
export function writeReport(dir,manifest,rows,status){
 const a=analyze(rows);atomic(path.join(dir,'analysis.json'),a);atomic(path.join(dir,'capture-plan.json'),selectCaptures(rows));
 const grouped=['club','difficulty','ground','weather','side','seed'].map(d=>`<details ${d==='club'?'open':''}><summary>By ${d}</summary>${table(a.groups.filter(g=>g.dimension===d),['value','played','wins','draws','losses','goalDifference','shots','conversion','passes','passCompletion','possessionTicks','saves','tackles','interceptions'])}</details>`).join('');
 const top=a.anomalies.slice(0,100).map(f=>`<details><summary>${escapeHTML(f.id)} · tick ${f.tick} · priority ${f.priority}</summary><p>${escapeHTML(f.detail)}</p><pre>${escapeHTML(JSON.stringify(f,null,2))}</pre></details>`).join('');
 atomic(path.join(dir,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:"><title>SOCCERWEB tournament evidence</title><style>body{font:16px system-ui;background:#101e2c;color:#e4f3eb;margin:auto;padding:2rem;max-width:1200px}a{color:#87e8bb}h1{color:#ffdf84}details{background:#182c3b;padding:1rem;margin:1rem 0}summary{cursor:pointer}.scroll{overflow:auto}table{border-collapse:collapse;font-size:14px}td,th{padding:.6rem;border-bottom:1px solid #35505d;text-align:right}pre{white-space:pre-wrap;overflow-wrap:anywhere}small{color:#b3c7c4}</style><h1>SOCCERWEB / Tournament Lab</h1><p><b>${escapeHTML(status)}</b> · ${a.completed}/${manifest.options.count} completed · ${a.failed} failed · ${a.goals} goals · ${a.ticks.toLocaleString()} ticks</p><p>Source <code>${escapeHTML(manifest.source.sha)}</code>${manifest.source.dirty?' (dirty tree; inspect code digest)':''}<br>Code SHA256: <small>${manifest.source.codeSHA256}</small></p><p><a href="fixtures.ndjson">Raw fixtures</a> · <a href="manifest.json">Provenance</a> · <a href="receipt.json">Run receipt</a> · <a href="analysis.json">All analytics</a> · <a href="capture-plan.json">Bounded capture plan</a></p><p>${escapeHTML(a.caveat)}</p><h2>Results</h2>${grouped}<h2>Paired orientation & possession</h2><p>${a.pairedOrientation.pairs} complete reversed pairs; mean first-slot margin ${a.pairedOrientation.meanSlot0Margin??'unavailable'}. First-slot wins ${a.side0Wins}; draws ${a.draws}; margins ≥5: ${a.blowouts}. Descriptive Wilson 95% interval for first-slot wins: ${a.side0WinFractionWilson95.map(v=>v.toFixed(3)).join(' – ')}.</p><p>Spell bins ${a.possession.bins.join(' / ')} ticks: ${a.possession.histogram.join(' / ')}. Direct turnovers: ${a.possession.directTurnovers}. Median of per-match median spell: ${a.possession.medianOfMatchP50} ticks.</p><h2>Ranking distributions</h2>${table(a.rankingDistributions,['club','groups','p10','median','p90'])}<h2>Review queue</h2><p>First 100 of ${a.anomalies.length} flags; all retained in analysis.json. Every fixture uses neutral external inputs and the production AI. Recreate from config with createState/step up to the named tick. Match hash is not a screenshot checksum.</p>${top||'<p>No thresholds crossed.</p>'}</html>`);
 return a;
}
