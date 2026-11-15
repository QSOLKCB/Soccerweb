import { createState, EMPTY, attack } from './game/state.mjs';
import { step } from './game/match.mjs';
import { TEAMS } from './game/teams.mjs';
import { Renderer } from './render/canvas.mjs';
import { Controls, DEFAULT_MAPS, keyLabel } from './input/controls.mjs';
import { AudioEngine } from './audio/synth.mjs';
import { Recorder, unpack, stateHash } from './replay/replay.mjs';
import { createCompetition, nextFixture, finishFixture, validCompetition, readSaved, save } from './modes/competition.mjs';
const $=id=>document.getElementById(id);
const audio=new AudioEngine(),controls=new Controls(togglePause),renderer=new Renderer($('game')),preview=new Renderer($('preview'));
let saved=readSaved('soccerweb.preferences.v1',{}),competition=readSaved('soccerweb.competition.v1',null);
if(!saved||typeof saved!=='object')saved={};if(!validCompetition(competition))competition=null;
let mode='quick',state=null,previous=null,recorder=null,playing=false,paused=false,finished=false,activeCompetition=null;
let demo=createState({humans:[false,false],seed:1988,seconds:120,difficulty:2}),demoPrev=demo;
let accumulator=0,last=0,demoAccumulator=0,goalFrames=[],goalPlayback=null,verifiedReplay=null,playback=null,playbackIndex=0,toastTimer;
let muted=true,importWorker=null;
const optionIDs=['home-team','away-team','ground','difficulty','duration','weather','master-volume','music-volume','sfx-volume','aftertouch','selection','visual','seed'];
for(const id of ['home-team','away-team'])for(let i=0;i<TEAMS.length;i++){
  const option=document.createElement('option');option.value=i;option.textContent=TEAMS[i].name;$(id).append(option);
}
$('away-team').value='1';
for(const id of optionIDs)if(saved[id]!==undefined){$(id).value=String(saved[id]);if($(id).tagName==='SELECT'&&$(id).selectedIndex<0)$(id).selectedIndex=0;}
if(saved.maps&&Array.isArray(saved.maps)&&saved.maps.length===2){
  const expected=Object.keys(DEFAULT_MAPS[0]);
  const codes=saved.maps.flatMap(m=>expected.map(k=>m?.[k]));
  if(codes.every(c=>typeof c==='string'&&/^[A-Za-z0-9]+$/.test(c)&&!['Escape','KeyP'].includes(c))&&new Set(codes).size===20)controls.maps=structuredClone(saved.maps);
}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5000);}
function savePreferences(){const prefs={maps:controls.maps};for(const id of optionIDs)prefs[id]=$(id).value;if(!save('soccerweb.preferences.v1',prefs))toast('Browser storage is unavailable. Settings last for this session.');applyOptions();}
function applyOptions(){
  audio.volumes(muted?0:Number($('master-volume').value)/100,Number($('music-volume').value)/100,Number($('sfx-volume').value)/100);
  for(const r of [renderer,preview]){r.retro=$('visual').value==='crt';r.palette=$('visual').value==='mint'?'mint':'classic';}
  $('weather').disabled=$('ground').value==='indoor';
}
function updateTeams(){
  for(const [prefix,id] of [['home','home-team'],['away','away-team']]){const t=TEAMS[Number($(id).value)];const b=$(prefix+'-badge');b.style.setProperty('--kit',t.color);b.replaceChildren(document.createTextNode(t.short[0]));const n=document.createElement('span');n.textContent=String(Number($(id).value)+1).padStart(2,'0');b.append(n);$(prefix+'-style').textContent=t.style;}
}
for(const id of optionIDs)$(id).addEventListener('change',()=>{savePreferences();updateTeams();});
for(const id of ['master-volume','music-volume','sfx-volume'])$(id).addEventListener('input',()=>{muted=false;audio.start();savePreferences();$('sound-toggle').innerHTML='♫ <span>SOUND ON</span>';});
function setMode(next){mode=next;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  $('mode-description').textContent={quick:'Your club. Your moment. Take on the computer.',local:'One screen. Two rivals. Settle it on the pitch.',cup:'Eight clubs. Three rounds. One trophy. Golden goal breaks ties.',challenge:'Seven opponents. A rising challenge. Win to keep your run alive.'}[mode];
  $('away-team').disabled=['cup','challenge'].includes(mode);$('difficulty').disabled=mode==='local'||['cup','challenge'].includes(mode);audio.event({type:'menu'});
}
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
$('swap-teams').onclick=()=>{const a=$('home-team').value;$('home-team').value=$('away-team').value;$('away-team').value=a;updateTeams();savePreferences();audio.event({type:'menu'});};
$('sound-toggle').onclick=async()=>{muted=!muted;await audio.start();applyOptions();$('sound-toggle').innerHTML=muted?'♫ <span>SOUND OFF</span>':'♫ <span>SOUND ON</span>';};
function matchConfig(){return {seed:Number($('seed').value),indoor:$('ground').value==='indoor',weather:$('weather').value,seconds:Number($('duration').value),difficulty:Number($('difficulty').value),teams:[Number($('home-team').value),Number($('away-team').value)],humans:[true,mode==='local'],aftertouch:Number($('aftertouch').value),auto:$('selection').value==='auto'};}
function updateContinue(){ $('continue').hidden=!competition||competition.complete; }
function enterMatch(s,label){
  state=s;previous=structuredClone(s);recorder=new Recorder(s);playing=true;paused=false;finished=false;controls.clear();controls.active=true;
  accumulator=0;goalFrames=[];goalPlayback=null;renderer.reset();$('menu').hidden=true;$('match').hidden=false;$('pause-overlay').hidden=true;$('result-overlay').hidden=true;$('replay-tag').hidden=true;
  $('match-kind').textContent=label;$('record-status').textContent=playback?'▶ VERIFIED PLAYBACK':'● RECORDING';
  $('game').focus();audio.start();if(muted){muted=false;applyOptions();$('sound-toggle').innerHTML='♫ <span>SOUND ON</span>';}
  audio.setMode('match',s.config.weather==='rain'&&!s.config.indoor);audio.event({type:'whistle'});updateHUD();window.scrollTo({top:0});
}
function startMatch({continueCup=false,demoMode=false}={}){
  playback=null;playbackIndex=0;activeCompetition=null;const conf=matchConfig();
  if(demoMode){conf.humans=[false,false];enterMatch(createState(conf),'ATTRACT MODE / CPU VS CPU');return;}
  if(continueCup&&competition&&!competition.complete)activeCompetition=structuredClone(competition);
  else if(['cup','challenge'].includes(mode)){activeCompetition=createCompetition(mode,conf.teams[0],conf.seed);competition=structuredClone(activeCompetition);save('soccerweb.competition.v1',competition);}
  if(activeCompetition){const f=nextFixture(activeCompetition);Object.assign(conf,{teams:f.teams,difficulty:f.difficulty,knockout:true,humans:[true,false],seed:activeCompetition.seed+activeCompetition.round*17});enterMatch(createState(conf),`${conf.indoor?'INDOOR':'OUTDOOR'} / ${f.round}`);}
  else enterMatch(createState(conf),`${conf.indoor?'INDOOR · 6 V 6':'OUTDOOR · 11 V 11'} / ${mode==='local'?'LOCAL 2 PLAYER':'QUICK MATCH'}`);
}
$('kickoff').onclick=()=>startMatch();$('continue').onclick=()=>startMatch({continueCup:true});$('watch-demo').onclick=()=>startMatch({demoMode:true});
function togglePause(force=false){
  if(!playing||finished)return;if(force&&paused)return;paused=force||!paused;controls.clear();accumulator=0;$('pause-overlay').hidden=!paused;$('pause-button').textContent=paused?'▶ RESUME':'Ⅱ PAUSE';
  if(paused)$('resume').focus();else $('game').focus();
}
$('pause-button').onclick=()=>togglePause();$('resume').onclick=()=>togglePause();
$('exit-match').onclick=()=>togglePause(true);
function home(){playing=false;paused=false;controls.active=false;controls.clear();state=null;goalPlayback=null;playback=null;activeCompetition=null;$('match').hidden=true;$('menu').hidden=false;updateContinue();audio.setMode('menu');preview.reset();$('kickoff').focus();}
$('pause-quit').onclick=home;$('result-home').onclick=home;
function exportReplay(){
  if(!state||!recorder)return;const data=playback||recorder.export(state),blob=new Blob([JSON.stringify(data)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`soccerweb-${data.config.seed}-${data.frames.length}-ticks.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast(`Exported ${data.frames.length.toLocaleString()} ticks · hash ${data.finalHash}`);
}
for(const id of ['pause-save','result-export'])$(id).onclick=exportReplay;
function updateHUD(){
  if(!state)return;const a=TEAMS[state.config.teams[0]],b=TEAMS[state.config.teams[1]];
  $('score-home').textContent=a.short;$('score-home').style.borderColor=a.color;$('score-away').textContent=b.short;$('score-away').style.borderColor=b.color;
  $('score').innerHTML=`${state.score[0]} <i>:</i> ${state.score[1]}`;
  const seconds=Math.floor(state.elapsed/60);$('clock').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')} · ${state.sudden?'GOLDEN GOAL':state.half===1?'1ST':'2ND'}`;
  const banner=$('match-banner');
  if(goalPlayback){banner.textContent='';return;}
  if(state.phase==='kickoff')banner.innerHTML=`${state.restartType}<small>${TEAMS[state.config.teams[state.restartTeam]].name} · P1 ATTACK ${attack(state,0)<0?'↑':'↓'}</small>`;
  else if(state.phase==='goal')banner.innerHTML=`GOOOAL!<small>${TEAMS[state.config.teams[1-state.restartTeam]].name}</small>`;
  else if(state.phase==='halftime')banner.innerHTML='HALF TIME<small>SWITCH ENDS. GO AGAIN.</small>';
  else if(state.phase==='restart')banner.innerHTML=`${state.restartType}<small>${TEAMS[state.config.teams[state.restartTeam]].name}</small>`;
  else banner.textContent='';
}
async function showResult(replayEnd=false){
  finished=true;controls.clear();$('result-overlay').hidden=false;$('result-label').textContent=replayEnd?'REPLAY COMPLETE':'FULL TIME';
  const score=state.score;$('result-title').textContent=replayEnd?'EVERY TICK VERIFIED.':score[0]===score[1]?'HONOURS EVEN.':score[0]>score[1]?'THAT’S A WIN.':'NEXT TIME, CHAMP.';
  $('result-score').textContent=`${TEAMS[state.config.teams[0]].short} ${score[0]} — ${score[1]} ${TEAMS[state.config.teams[1]].short}`;
  $('result-stats').replaceChildren();for(const [key,label] of [['shots','SHOTS'],['saves','SAVES'],['passes','PASSES']]){const div=document.createElement('div');div.textContent=state.stats[key].join(' — ');const small=document.createElement('small');small.textContent=label;div.append(small);$('result-stats').append(div);}
  const next=$('result-next');next.disabled=false;next.textContent=replayEnd?'RETURN TO CLUBHOUSE →':'PLAY AGAIN →';next.onclick=replayEnd?home:()=>startMatch();
  if(activeCompetition&&!replayEnd){
    next.disabled=true;next.textContent='FINISHING OTHER FIXTURES…';
    try{
      const completed=await finishFixture(structuredClone(activeCompetition),score,state.config);competition=completed;save('soccerweb.competition.v1',competition);activeCompetition=structuredClone(completed);
      if(completed.complete){$('result-title').textContent=completed.champion===completed.team?(completed.type==='cup'?'CUP CHAMPIONS!':'CHALLENGE CONQUERED!'):'A RUN TO REMEMBER.';next.textContent='BACK TO CLUBHOUSE →';next.onclick=home;}
      else{next.textContent=`NEXT: ${nextFixture(completed).round} →`;next.onclick=()=>startMatch({continueCup:true});}
    }catch(e){toast(e.message);next.textContent='RETRY ROUND →';next.onclick=()=>startMatch({continueCup:true});}
    next.disabled=false;
  }
}
function tick(){
  previous=structuredClone(state);const inputs=playback?playback.frames[playbackIndex].map(unpack):controls.sample();
  if(paused)return;
  step(state,inputs);if(!playback)recorder.record(state,inputs);else playbackIndex++;
  for(const event of state.events)audio.event(event);
  if(state.tick%3===0){goalFrames.push(structuredClone(state));if(goalFrames.length>100)goalFrames.shift();}
  if(state.events.some(e=>e.type==='goal')&&goalFrames.length>12){goalPlayback={frames:goalFrames.slice(),time:0};$('replay-tag').hidden=false;}
  if(playback&&playbackIndex>=playback.frames.length){
    if(stateHash(state)!==playback.finalHash)toast('Playback mismatch: the final state changed.');
    goalPlayback=null;$('replay-tag').hidden=true;showResult(true);
  }else if(state.phase==='fulltime')showResult();
  updateHUD();
}
function frame(now){
  const dt=Math.min(.1,(now-last)/1000||0);last=now;
  if(!paused)audio.update();
  if(playing){
    // Poll gamepad pause even while simulation is stopped.
    if(paused)controls.sample();
    if(!paused&&!finished){
      if(goalPlayback){
        goalPlayback.time+=dt;const index=Math.floor(goalPlayback.time*20);
        if(index>=goalPlayback.frames.length){goalPlayback=null;goalFrames=[];$('replay-tag').hidden=true;renderer.reset();updateHUD();}
      }else{
        accumulator+=dt;while(accumulator>=1/60&&!finished&&!paused&&!goalPlayback){if(playback&&playbackIndex>=playback.frames.length){showResult(true);break;}tick();accumulator-=1/60;}
      }
    }
    if(goalPlayback){const index=Math.min(goalPlayback.frames.length-1,Math.floor(goalPlayback.time*20));renderer.draw(goalPlayback.frames[index]);}
    else if(state)renderer.draw(state,previous,Math.min(1,accumulator*60));
  }else{
    demoAccumulator+=dt;while(demoAccumulator>=1/60){demoPrev=structuredClone(demo);step(demo);demoAccumulator-=1/60;if(demo.phase==='fulltime'){demo=createState({...demo.config,seed:demo.config.seed+1});demoPrev=demo;preview.reset();}}
    preview.draw(demo,demoPrev,demoAccumulator*60,true);$('demo-score').textContent=`SOL ${demo.score[0]} : ${demo.score[1]} NEO`;
  }
  requestAnimationFrame(frame);
}
function controlsTable(remap=false){
  const table=document.createElement('table');const head=document.createElement('tr');for(const text of ['ACTION','PLAYER 1','PLAYER 2']){const th=document.createElement('th');th.textContent=text;head.append(th);}table.append(head);
  const names={up:'Move up',down:'Move down',left:'Move left',right:'Move right',fire:'Pass / charge shot / tackle',pass:'Pass / first-time pass',chip:'Chip / lofted kick',switch:'Switch player',curveLeft:'Curve left',curveRight:'Curve right'};
  for(const [action,label] of Object.entries(names)){
    const row=document.createElement('tr'),name=document.createElement('td');name.textContent=label;row.append(name);
    for(let player=0;player<2;player++){
      const td=document.createElement('td'),key=document.createElement(remap?'button':'kbd');key.textContent=keyLabel(controls.maps[player][action]);
      if(remap){key.className='key-button';key.onclick=()=>{
        key.textContent='PRESS KEY';$('mapping-message').textContent='Press a new key. Escape cancels.';
        controls.capture=code=>{if(code!=='Escape')try{controls.remap(player,action,code);savePreferences();$('mapping-message').textContent='Mapping saved.';}catch(e){$('mapping-message').textContent=e.message;}else $('mapping-message').textContent='Cancelled.';renderMappings();};
      };}td.append(key);row.append(td);
    }table.append(row);
  }return table;
}
function renderMappings(){$('key-mappings').replaceChildren(controlsTable(true));$('help-controls').replaceChildren(controlsTable());}
for(const [button,dialog] of [['help-button','help-dialog'],['options-button','options-dialog'],['replays-button','replays-dialog']])$(button).onclick=()=>{if(dialog==='replays-dialog')renderRecord();$(dialog).showModal();audio.start();audio.event({type:'menu'});};
document.querySelectorAll('dialog .close').forEach(b=>b.onclick=()=>b.closest('dialog').close());
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('close',()=>{controls.capture=null;renderMappings();}));
$('reset-keys').onclick=()=>{controls.maps=structuredClone(DEFAULT_MAPS);savePreferences();renderMappings();};
function renderRecord(){
  const root=$('competition-record');root.replaceChildren();if(!competition){root.textContent='No competition started yet.';return;}
  const p=document.createElement('p');p.textContent=`${competition.type.toUpperCase()} · ${TEAMS[competition.team].name} · ${competition.complete?(competition.champion===competition.team?'CHAMPION':'RUN ENDED'):nextFixture(competition).round}`;root.append(p);
  for(const match of competition.history){const row=document.createElement('p');row.textContent=`Round ${match.round+1}: ${TEAMS[match.teams[0]].short} ${match.score[0]} – ${match.score[1]} ${TEAMS[match.teams[1]].short}`;root.append(row);}
}
$('replay-file').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;$('watch-replay').hidden=true;verifiedReplay=null;
  if(file.size>12*1024*1024){$('replay-message').textContent='Replay is too large (12 MB maximum).';return;}
  $('replay-message').textContent='Verifying inputs and state hashes…';
  importWorker?.terminate();const worker=new Worker(new URL('./replay/verify-worker.mjs',import.meta.url),{type:'module'});importWorker=worker;
  worker.onmessage=({data})=>{worker.terminate();if(data.error){$('replay-message').textContent=data.error;return;}verifiedReplay=data.replay;$('replay-message').textContent=`Verified ${data.replay.frames.length.toLocaleString()} ticks · ${data.replay.checkpoints.length} checkpoints · hash ${data.replay.finalHash}`;$('watch-replay').hidden=false;};
  worker.onerror=()=>{$('replay-message').textContent='Replay verification could not run in this browser.';worker.terminate();};
  worker.postMessage(await file.text());
};
$('watch-replay').onclick=()=>{if(!verifiedReplay)return;activeCompetition=null;playback=verifiedReplay;playbackIndex=0;$('replays-dialog').close();enterMatch(createState(playback.config),'REPLAY STUDIO / VERIFIED INPUT STREAM');if(playback.frames.length===0)showResult(true);};
applyOptions();updateTeams();updateContinue();renderMappings();requestAnimationFrame(frame);
if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').then(async registration=>{
  const ready=await navigator.serviceWorker.ready;if(ready.active)$('offline-status').textContent='OFFLINE READY · V1.0';
  if(registration.waiting)toast('A game update is ready. Close other Soccerweb tabs and reopen to update.');
}).catch(()=>$('offline-status').textContent='ONLINE MODE · CACHE UNAVAILABLE');
// Read-only diagnostics used by the browser smoke suite; never exposes mutable simulation objects.
export function diagnostics(){return state?{state:structuredClone(state),paused,playing,finished,hash:stateHash(state),recordedTicks:recorder?.frames.length||0}:null;}
