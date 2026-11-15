import {StandardAnnouncements,standardRule,STANDARD_VICTORY,STANDARD_REVIEW} from './modes/goalposts_presentation.mjs';
import {PAD_KEY,PAD_ACTIONS,padPreset,readPadProfiles,connectedPads,bindPadButton,padInput} from './input/gamepads.mjs';
import {STAGES,stageTarget,stageLimit,shiftNotice,BEST_KEY,validBests,updateBest} from './modes/goalposts.mjs';
import { createPractice, observePractice, practiceCopy, DRILL_NAMES } from './modes/practice.mjs';
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
controls.padProfiles=readPadProfiles(readSaved(PAD_KEY,null));
let padCapture=null;
const standards=new StandardAnnouncements();
let matchRun=0,practice=null,stageWaiting=false,advanceStage=false;
let mode='quick',state=null,previous=null,recorder=null,playing=false,paused=false,finished=false,activeCompetition=null;
let demo=createState({humans:[false,false],seed:1988,seconds:120,difficulty:2}),demoPrev=demo;
let accumulator=0,last=0,demoAccumulator=0,goalFrames=[],goalPlayback=null,verifiedReplay=null,playback=null,playbackIndex=0,toastTimer;
let muted=saved.muted===true,importWorker=null;
const optionIDs=['home-team','away-team','ground','difficulty','duration','weather','master-volume','music-volume','sfx-volume','aftertouch','selection','visual','camera','effects','seed'];
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
function savePreferences(){const prefs={maps:controls.maps,muted};for(const id of optionIDs)prefs[id]=$(id).value;if(!save('soccerweb.preferences.v1',prefs))toast('Browser storage is unavailable. Settings last for this session.');applyOptions();}
function applyOptions(){
  audio.volumes(muted?0:Number($('master-volume').value)/100,Number($('music-volume').value)/100,Number($('sfx-volume').value)/100);
  for(const r of [renderer,preview]){r.retro=$('visual').value==='crt';r.palette=$('visual').value==='mint'?'mint':'classic';r.pixelated=$('visual').value==='pixel';r.zoom=$('camera').value;r.effects=$('effects').value;}
  $('weather').disabled=$('ground').value==='indoor';
  $('match').classList.toggle('quiet-announcements',$('effects').value==='minimal');
}
function updateTeams(){
  if($('home-team').value===$('away-team').value)$('away-team').value=String((Number($('home-team').value)+1)%TEAMS.length);
  for(const [prefix,id] of [['home','home-team'],['away','away-team']]){const t=TEAMS[Number($(id).value)];const b=$(prefix+'-badge');b.style.setProperty('--kit',t.color);b.replaceChildren(document.createTextNode(t.short[0]));const n=document.createElement('span');n.textContent=String(Number($(id).value)+1).padStart(2,'0');b.append(n);$(prefix+'-style').textContent=t.style;}
}
for(const id of optionIDs)$(id).addEventListener('change',()=>{updateTeams();savePreferences();});
for(const id of ['master-volume','music-volume','sfx-volume'])$(id).addEventListener('input',()=>{muted=false;audio.start();savePreferences();$('sound-toggle').innerHTML='♫ <span>SOUND ON</span>';});
function setMode(next){mode=next;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  $('mode-description').textContent={quick:'Your club. Your moment. Take on the computer.',local:'One screen. Two rivals. Settle it on the pitch.',cup:'Eight clubs. Three rounds. One trophy. Golden goal breaks ties.',challenge:'Seven opponents. A rising challenge. Win to keep your run alive.'}[mode];
  $('away-team').disabled=['cup','challenge'].includes(mode);$('difficulty').disabled=mode==='local'||['cup','challenge'].includes(mode);audio.event({type:'menu'});
}
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
$('swap-teams').onclick=()=>{const a=$('home-team').value;$('home-team').value=$('away-team').value;$('away-team').value=a;updateTeams();savePreferences();audio.event({type:'menu'});};
$('sound-toggle').onclick=async()=>{if(!audio.ctx){muted=false;await audio.start();}else muted=!muted;savePreferences();$('sound-toggle').innerHTML=muted?'♫ <span>SOUND OFF</span>':'♫ <span>SOUND ON</span>';};
function matchConfig(){return {seed:Number($('seed').value),indoor:$('ground').value==='indoor',weather:$('weather').value,seconds:Number($('duration').value),difficulty:Number($('difficulty').value),teams:[Number($('home-team').value),Number($('away-team').value)],humans:[true,mode==='local'],aftertouch:Number($('aftertouch').value),auto:$('selection').value==='auto'};}
function updateContinue(){ $('continue').hidden=!competition||competition.complete; }
function enterMatch(s,label){
  standards.reset();standards.update(s);$('match').classList.toggle('standards-mode',!!s.goalposts);
  matchRun++;stageWaiting=false;advanceStage=false;$('stage-overlay').hidden=true;$('goalposts-panel').hidden=!s.goalposts;
  state=s;previous=structuredClone(s);recorder=s.training?null:new Recorder(s);playing=true;paused=false;finished=false;controls.setGameplayEnabled(true);controls.cancelPending=false;controls.active=true;
  accumulator=0;goalFrames=[];goalPlayback=null;renderer.reset();$('menu').hidden=true;$('match').hidden=false;$('pause-overlay').hidden=true;$('result-overlay').hidden=true;$('replay-tag').hidden=true;
  $('pause-button').textContent='Ⅱ PAUSE';$('action-hint').textContent='FIND THE SPACE. PLAY THE PASS.';$('match-kind').textContent=label;$('pause-save').hidden=!!s.training;$('practice-retry').hidden=!s.training;$('practice-next').hidden=!s.training;$('practice-panel').hidden=!s.training;
  $('record-status').textContent=s.training?'PRACTICE · SKILLS SESSION':playback?'▶ VERIFIED PLAYBACK':'● RECORDING';
  $('game').focus();audio.start();applyOptions();$('sound-toggle').innerHTML=muted?'♫ <span>SOUND OFF</span>':'♫ <span>SOUND ON</span>';
  audio.setPaused(false);audio.setMode(s.goalposts?'goalposts':s.config.indoor?'indoor':'outdoor',s.config.weather==='rain'&&!s.config.indoor,s.config.seed);audio.event({type:'whistle'});updateHUD();window.scrollTo({top:0});
}
function startMatch({continueCup=false,demoMode=false}={}){
  practice=null;playback=null;playbackIndex=0;activeCompetition=null;const conf=matchConfig();
  if(demoMode){conf.humans=[false,false];enterMatch(createState(conf),'ATTRACT MODE / CPU VS CPU');return;}
  if(continueCup&&competition&&!competition.complete)activeCompetition=structuredClone(competition);
  else if(['cup','challenge'].includes(mode)){activeCompetition=createCompetition(mode,conf.teams[0],conf.seed);competition=structuredClone(activeCompetition);save('soccerweb.competition.v1',competition);}
  if(activeCompetition){const f=nextFixture(activeCompetition);Object.assign(conf,{teams:f.teams,difficulty:f.difficulty,knockout:true,humans:[true,false],seed:activeCompetition.seed+activeCompetition.round*17});enterMatch(createState(conf),`${conf.indoor?'INDOOR':'OUTDOOR'} / ${f.round}`);}
  else enterMatch(createState(conf),`${conf.indoor?'INDOOR · 6 V 6':'OUTDOOR · 11 V 11'} / ${mode==='local'?'LOCAL 2 PLAYER':'QUICK MATCH'}`);
}
function startPractice(index=0){
  playback=null;playbackIndex=0;activeCompetition=null;practice=createPractice(index,matchConfig());
  enterMatch(practice.state,`PRACTICE / ${DRILL_NAMES[practice.index].toUpperCase()}`);
}
function startGoalposts(options=null){
  practice=null;playback=null;playbackIndex=0;activeCompetition=null;
  const conf=options||{...matchConfig(),difficulty:Number($('goalposts-difficulty').value)};
  enterMatch(createState({...conf,mode:'goalposts'}),'GOALPOSTS / OUTDOOR · 5 V 5');
}
function resumeStage(){
  if(!stageWaiting)return;stageWaiting=false;advanceStage=true;controls.setGameplayEnabled(true);$('stage-overlay').hidden=true;accumulator=0;$('game').focus();
}
$('goalposts-button').onclick=()=>{
  const best=readSaved(BEST_KEY,null);$('goalposts-best').textContent=validBests(best)&&best.runs.length?best.runs.map(r=>`${['Club','Pro','Elite'][r.difficulty-1]}: ${(r.ticks/60).toFixed(1)}s`).join(' · '):'No standards conquered yet.';
  $('goalposts-dialog').showModal();
};
$('goalposts-start').onclick=()=>{$('goalposts-dialog').close();startGoalposts();};
$('stage-next').onclick=resumeStage;$('stage-retry').onclick=()=>startGoalposts(state.config);$('stage-home').onclick=home;
$('practice-button').onclick=()=>{$('practice-dialog').showModal();};
$('practice-start').onclick=()=>{$('practice-dialog').close();startPractice(Number($('practice-drill').value));};
$('practice-retry').onclick=()=>startPractice(practice?.index||0);
$('practice-next').onclick=()=>startPractice(((practice?.index||0)+1)%DRILL_NAMES.length);
$('kickoff').onclick=()=>startMatch();$('continue').onclick=()=>startMatch({continueCup:true});$('watch-demo').onclick=()=>startMatch({demoMode:true});
function togglePause(force=false){
  if(stageWaiting){if(!force)resumeStage();return;}
  if(!playing||finished)return;if(force&&paused)return;paused=force||!paused;audio.setPaused(paused);controls.setGameplayEnabled(!paused);accumulator=0;$('pause-overlay').hidden=!paused;$('pause-button').textContent=paused?'▶ RESUME':'Ⅱ PAUSE';
  if(paused)$('resume').focus();else $('game').focus();
}
$('pause-button').onclick=()=>togglePause();$('resume').onclick=()=>togglePause();
$('exit-match').onclick=()=>togglePause(true);
function home(){standards.reset();matchRun++;stageWaiting=false;advanceStage=false;practice=null;playing=false;paused=false;controls.active=false;controls.setGameplayEnabled(false);state=null;goalPlayback=null;playback=null;activeCompetition=null;$('match').hidden=true;$('menu').hidden=false;updateContinue();audio.setPaused(false);audio.setMode('menu');preview.reset();$('kickoff').focus();}
$('pause-quit').onclick=home;$('result-home').onclick=home;
function exportReplay(){
  if(!state||!recorder)return;const data=playback||recorder.export(state),blob=new Blob([JSON.stringify(data)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`soccerweb-${data.config.seed}-${data.frames.length}-ticks.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast(`Exported ${data.frames.length.toLocaleString()} ticks · hash ${data.finalHash}`);
}
for(const id of ['pause-save','result-export','stage-export'])$(id).onclick=exportReplay;
function textIfChanged(id,text){if($(id).textContent!==text)$(id).textContent=text;}
function updateHUD(){
  if(!state)return;
  if(practice){$('practice-title').textContent=DRILL_NAMES[practice.index];$('practice-copy').textContent=practiceCopy(practice,controls.maps[0]);}
  if(state.goalposts){
    const g=state.goalposts,notice=shiftNotice(state),view=standards.view;
    textIfChanged('goalposts-title',`${g.stage+1}/3 · ${STAGES[g.stage]}`);
    textIfChanged('goalposts-revision',`STANDARD ${String(g.stage+1).padStart(2,'0')} / REV ${String(view.revision).padStart(2,'0')}`);
    textIfChanged('goalposts-stamp',view.stamp);
    textIfChanged('goalposts-announcement-title',view.headline);textIfChanged('goalposts-announcement-detail',view.detail);
    $('goalposts-panel').classList.toggle('criteria-revised',view.flash);
    $('goalposts-rule').textContent=`${g.points}/${stageTarget(g.stage)} POINTS · ${Math.ceil(Math.max(0,stageLimit(state)-g.clock)/60)}s LEFT · CONCEDED ${g.conceded}/2 · ${g.stage===2?'Any goal = 1; curved shot = 2.':'Every goal = 1 point.'}`;
    textIfChanged('goalposts-notice',state.phase==='play'?notice.text:state.phase==='goal'?'CLOCK & POSTS HELD · GOAL RECORDED':'CLOCK & POSTS HELD · '+notice.text);
    $('goalposts-tip').textContent=`Try moving diagonally toward goal while charging ${keyLabel(controls.maps[0].fire)}, then face up and release. Bend with ${keyLabel(controls.maps[0].curveLeft)}/${keyLabel(controls.maps[0].curveRight)}. Your own goal stays fixed.`;
  }
  const selected=state.players[state.selected[0]];
  const charge=selected.fireMode==='tackle'?'TACKLE · RELEASE TO REARM':selected.fireMode==='consumed'?'KICK SENT · RELEASE TO REARM':selected.charge?`${selected.charge<12?'TAP PASS':'SHOT'} · ${Math.round(selected.charge/60*100)}% POWER`:'';
  $('charge-hint').textContent=charge;
  const owner=state.ball.owner<0?null:state.players[state.ball.owner];
  const ownership=owner?`${TEAMS[state.config.teams[owner.team]].short} · ${owner.keeper?'KEEPER':'#'+owner.number} IN CONTROL`:state.ball.z>12*256?'BALL IN THE AIR':'LOOSE BALL';
  if($('possession-hint').textContent!==ownership)$('possession-hint').textContent=ownership;
  const a=TEAMS[state.config.teams[0]],b=TEAMS[state.config.teams[1]];
  $('score-home').textContent=a.short;$('score-home').style.borderColor=a.color;$('score-away').textContent=b.short;$('score-away').style.borderColor=b.color;
  const scoreHTML=`${state.score[0]} <i>:</i> ${state.score[1]}`;if($('score').innerHTML!==scoreHTML)$('score').innerHTML=scoreHTML;
  const seconds=Math.floor(state.elapsed/60);const clockText=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')} · ${state.goalposts?'STAGE '+(state.goalposts.stage+1)+'/3':state.sudden?'GOLDEN GOAL':state.half===1?'1ST':'2ND'}`;if($('clock').textContent!==clockText)$('clock').textContent=clockText;
  const banner=$('match-banner');
  if(goalPlayback){banner.textContent='';$('replay-tag').textContent=`GOAL REPLAY · ${state.score[0]} — ${state.score[1]}`;return;}
  if(state.phase==='kickoff')banner.innerHTML=`${state.restartType}<small>${TEAMS[state.config.teams[state.restartTeam]].name} · P1 ATTACK ${attack(state,0)<0?'↑':'↓'}</small>`;
  else if(state.phase==='goal')banner.innerHTML=`GOOOAL!<small>${TEAMS[state.config.teams[1-state.restartTeam]].name}</small>`;
  else if(state.phase==='halftime')banner.innerHTML='HALF TIME<small>SWITCH ENDS. GO AGAIN.</small>';
  else if(state.phase==='restart')banner.innerHTML=`${state.restartType}<small>${TEAMS[state.config.teams[state.restartTeam]].name}</small>`;
  else banner.textContent='';
}
async function showResult(replayEnd=false){
  const resultRun=matchRun;
  finished=true;controls.active=false;controls.setGameplayEnabled(false);$('result-overlay').hidden=false;$('result-label').textContent=replayEnd?'REPLAY COMPLETE':'FULL TIME';
  const score=state.score;const winner=score[0]===score[1]?-1:score[0]>score[1]?0:1;audio.setMode(!replayEnd&&winner>=0&&state.config.humans[winner]?'victory':'menu');$('result-title').textContent=replayEnd?'EVERY TICK VERIFIED.':score[0]===score[1]?'HONOURS EVEN.':score[0]>score[1]?'THAT’S A WIN.':'NEXT TIME, CHAMP.';
  $('result-score').textContent=`${TEAMS[state.config.teams[0]].short} ${score[0]} — ${score[1]} ${TEAMS[state.config.teams[1]].short}`;
  $('result-stats').replaceChildren();for(const [key,label] of [['shots','SHOTS'],['saves','SAVES'],['passes','PASSES']]){const div=document.createElement('div');div.textContent=state.stats[key].join(' — ');const small=document.createElement('small');small.textContent=label;div.append(small);$('result-stats').append(div);}
  const next=$('result-next');next.disabled=false;next.textContent=replayEnd?'RETURN TO CLUBHOUSE →':'PLAY AGAIN →';next.onclick=replayEnd?home:()=>startMatch();
  $('result-review').hidden=true;$('result-standards').hidden=true;
  if(state.goalposts){
    const won=state.goalposts.status==='won',failed=state.goalposts.status==='failed';audio.setMode(won?'victory':'goalposts');$('result-label').textContent=(replayEnd?'VERIFIED REPLAY / ':'GOALPOSTS / ')+(won?'ALL THREE STANDARDS MET':failed?'RUN ENDED':'RECORDING ENDED');
    $('result-title').textContent=won?STANDARD_VICTORY:failed?'THE STANDARD SURVIVES.':'REPLAY COMPLETE.';
    $('result-review').hidden=false;$('result-review').textContent=won?STANDARD_REVIEW:failed?'A FRESH SUBMISSION IS ALWAYS WELCOME.':'THIS RECORDING ENDS BEFORE THE RUN IS FINISHED.';
    $('result-standards').hidden=false;$('result-standards').replaceChildren();
    for(const record of state.goalposts.history){const line=document.createElement('li');line.textContent=`STANDARD ${record.stage+1} · APPROVED · ${record.points} ${record.points===1?'point':'points'} · ${(record.ticks/60).toFixed(1)}s`;$('result-standards').append(line);}
    $('result-score').textContent=`${state.goalposts.total} points · ${(state.goalposts.spent/60).toFixed(1)} active seconds · ${won?'Every valid goal remains on the record.':!failed?'Recorded progress only; the run had not ended.':state.goalposts.conceded>=2?'Two goals conceded in this stage. Try again.':'The active-time allowance expired. Try again.'}`;
    next.textContent=replayEnd?'RETURN TO CLUBHOUSE →':'RETRY THREE-STAGE RUN →';next.onclick=replayEnd?home:()=>startGoalposts(state.config);
    if(won&&!replayEnd){if(!save(BEST_KEY,updateBest(readSaved(BEST_KEY,null),state)))toast('Best time could not be saved.');}
    next.focus();return;
  }
  if(activeCompetition&&!replayEnd){
    next.disabled=true;next.textContent='FINISHING OTHER FIXTURES…';$('result-export').focus();
    try{
      const completed=await finishFixture(structuredClone(activeCompetition),score,state.config);
      // Leaving or starting another match invalidates this asynchronous result.
      if(resultRun!==matchRun)return;
      competition=completed;save('soccerweb.competition.v1',competition);activeCompetition=structuredClone(completed);
      if(completed.complete){$('result-title').textContent=completed.champion===completed.team?(completed.type==='cup'?'CUP CHAMPIONS!':'CHALLENGE CONQUERED!'):'A RUN TO REMEMBER.';next.textContent='BACK TO CLUBHOUSE →';next.onclick=home;}
      else{next.textContent=`NEXT: ${nextFixture(completed).round} →`;next.onclick=()=>startMatch({continueCup:true});}
    }catch(e){if(resultRun!==matchRun)return;toast(e.message);next.textContent='RETRY ROUND →';next.onclick=()=>startMatch({continueCup:true});}
    next.disabled=false;
  }else next.focus();
}
function tick(){
  previous=structuredClone(state);const inputs=playback?playback.frames[playbackIndex].map(unpack):controls.sample();
  if(paused)return;
  if(advanceStage&&!playback){
    // A held kick needs a recorded release before the stage's rising-edge press.
    const release=state.previous[0].fire;inputs[0]={...EMPTY,fire:!release};advanceStage=release;
  }
  step(state,inputs);const standardSounds=state.goalposts?standards.update(state):[];if(!playback)recorder?.record(state,inputs);else playbackIndex++;
  if(state.phase==='stageclear'&&!playback&&!advanceStage){
    stageWaiting=true;controls.setGameplayEnabled(false);$('stage-overlay').hidden=false;$('stage-title').textContent=STAGES[state.goalposts.stage]+' — approved!';$('stage-copy').textContent=standards.view.headline;$('stage-rule').textContent=`NEXT STANDARD: ${standardRule(state.goalposts.stage+1)}`;$('stage-next').textContent=`NEXT: ${STAGES[state.goalposts.stage+1]} →`;$('stage-next').focus();
  }
  if(practice&&observePractice(practice)){togglePause(true);$('practice-next').focus();}
  for(const event of state.events){if(event.type==='goal')audio.setMode('goal',false,state.config.seed);if(!state.goalposts||!['revision','shift','nearmiss','challengewin','post'].includes(event.type))audio.event(event);if(event.type==='kick')$('action-hint').textContent=`${TEAMS[state.config.teams[event.team]].short} · ${event.kind.toUpperCase()}${event.power>40?' · FULL POWER':''}`;else if(event.type==='save')$('action-hint').textContent=event.caught?'KEEPER HOLDS IT.':'PARRIED! CHASE THE REBOUND.';else if(event.type==='post')$('action-hint').textContent='OFF THE FRAME!';else if(event.type==='receive')$('action-hint').textContent=event.passed?'PASS COMPLETE · FIND THE NEXT RUN':'FIRST TOUCH · BALL CONTROLLED';else if(event.type==='intercept')$('action-hint').textContent='INTERCEPTED · CHANGE OF POSSESSION';else if(event.type==='tackle')$('action-hint').textContent='TACKLE WON · CHASE THE LOOSE BALL';}
  for(const event of standardSounds)audio.event(event);
  if(state.phase==='play'&&audio.mode==='goal')audio.setMode(state.goalposts?'goalposts':state.config.indoor?'indoor':'outdoor',state.config.weather==='rain'&&!state.config.indoor,state.config.seed);
  if(!practice&&state.tick%3===0){goalFrames.push(structuredClone(state));if(goalFrames.length>100)goalFrames.shift();}
  if(!practice&&state.events.some(e=>e.type==='goal')&&goalFrames.length>12){goalPlayback={frames:goalFrames.slice(),time:0};$('replay-tag').hidden=false;}
  if(playback&&playbackIndex>=playback.frames.length){
    if(stateHash(state)!==playback.finalHash)toast('Playback mismatch: the final state changed.');
    goalPlayback=null;$('replay-tag').hidden=true;showResult(true);
  }else if(state.phase==='fulltime'){if(practice){togglePause(true);practice.message='Session finished. Choose Retry or the next drill.';}else showResult();}
  updateHUD();
}
function frame(now){
  const wasCapturing=!!padCapture;pollControllerSetup();
  navigateController(controls.menuAction(!$('controller-dialog').open&&!wasCapturing&&!padCapture&&(!playing||paused||finished||stageWaiting)));
  const dt=Math.min(.1,(now-last)/1000||0);last=now;
  if(!paused)audio.update();
  if(playing){
    // Poll gamepad pause even while simulation is stopped.
    if(paused||stageWaiting)controls.sample();
    if(!paused&&!finished&&!stageWaiting){
      if(goalPlayback){
        goalPlayback.time+=dt;const index=Math.floor(goalPlayback.time*20);
        if(index>=goalPlayback.frames.length){goalPlayback=null;goalFrames=[];$('replay-tag').hidden=true;renderer.reset();updateHUD();}
      }else{
        accumulator+=dt;while(accumulator>=1/60&&!finished&&!paused&&!stageWaiting&&!goalPlayback){if(playback&&playbackIndex>=playback.frames.length){showResult(true);break;}tick();accumulator-=1/60;}
      }
    }
    if(goalPlayback){const index=Math.min(goalPlayback.frames.length-1,Math.floor(goalPlayback.time*20));renderer.draw(goalPlayback.frames[index],goalPlayback.frames[index],1,false,dt);}
    else if(state)renderer.draw(state,previous,Math.min(1,accumulator*60),false,dt);
  }else{
    demoAccumulator+=dt;while(demoAccumulator>=1/60){demoPrev=structuredClone(demo);step(demo);demoAccumulator-=1/60;if(demo.phase==='fulltime'){demo=createState({...demo.config,seed:demo.config.seed+1});demoPrev=demo;preview.reset();}}
    preview.draw(demo,demoPrev,demoAccumulator*60,true,dt);$('demo-score').textContent=`SOL ${demo.score[0]} : ${demo.score[1]} NEO`;
  }
  requestAnimationFrame(frame);
}
function saveControllers(){
  if(!save(PAD_KEY,{version:1,profiles:controls.padProfiles}))toast('Controller profile could not be saved.');
  renderControllers();
}
function renderControllers(){
  const player=Number($('pad-player').value)||0,p=controls.padProfiles[player];
  $('pad-preset').value=p.name;$('pad-movement').value=p.movement;
  $('pad-axis-x').value=p.axes[0];$('pad-axis-y').value=p.axes[1];
  const table=document.createElement('table');
  for(const [action,label] of Object.entries(PAD_ACTIONS)){
    const row=document.createElement('tr'),name=document.createElement('td'),cell=document.createElement('td'),button=document.createElement('button');
    name.textContent=label;button.className='key-button';button.textContent=p.buttons[action]<0?'UNASSIGNED':`BUTTON ${p.buttons[action]}`;
    button.onclick=()=>{padCapture={player,action,ready:false};$('pad-message').textContent=`Release all buttons, then press ${label}.`;$('pad-cancel').hidden=false;};
    cell.append(button);row.append(name,cell);table.append(row);
  }
  $('pad-bindings').replaceChildren(table);
}
function pollControllerSetup(){
  if(!$('controller-dialog').open){padCapture=null;return;}
  const pads=connectedPads(),player=Number($('pad-player').value)||0,p=pads[player];
  const pressed=p?Array.from(p.buttons).flatMap((b,i)=>b.pressed||b.value>.5?[i]:[]):[];
  $('pad-status').textContent=p?`P${player+1}: ${p.id} · buttons ${pressed.join(', ')||'released'} · axes ${Array.from(p.axes).map(n=>n.toFixed(2)).join(', ')}`:'Connect the controller and press a button to let Chrome detect it.';
  const logical=padInput(p,controls.padProfiles[player]);$('pad-direction').textContent='D-PAD · '+(logical.y<0?'↑':logical.y>0?'↓':'')+(logical.x<0?'←':logical.x>0?'→':'')+(!logical.x&&!logical.y?'CENTRED':'');
  $('pad-actions').textContent='ACTIONS · '+(Object.entries(PAD_ACTIONS).filter(([a])=>logical[a]).map(([,label])=>label).join(' · ')||'released');
  if(!padCapture)return;
  if(!pressed.length){padCapture.ready=true;return;}
  if(padCapture.ready){
    try{controls.padProfiles[padCapture.player]=bindPadButton(controls.padProfiles[padCapture.player],padCapture.action,pressed[0]);saveControllers();$('pad-message').textContent='Assigned. Existing conflicting buttons were swapped.';}catch(e){$('pad-message').textContent=e.message;}
    padCapture=null;$('pad-cancel').hidden=true;controls.blockPadActions=true;
  }
}
$('controller-button').onclick=()=>{renderControllers();$('controller-dialog').showModal();};
$('pad-cancel').onclick=()=>{padCapture=null;$('pad-cancel').hidden=true;$('pad-message').textContent='Assignment cancelled.';};
$('pad-player').onchange=()=>{padCapture=null;renderControllers();};
$('pad-preset').onchange=()=>{if($('pad-preset').value==='custom')return;controls.padProfiles[Number($('pad-player').value)||0]=padPreset($('pad-preset').value);padCapture=null;saveControllers();};
for(const id of ['pad-movement','pad-axis-x','pad-axis-y'])$(id).onchange=()=>{
  const p=controls.padProfiles[Number($('pad-player').value)||0],x=Number($('pad-axis-x').value),y=Number($('pad-axis-y').value);
  if(x===y){$('pad-message').textContent='Horizontal and vertical axes must differ.';renderControllers();return;}
  Object.assign(p,{name:'custom',movement:$('pad-movement').value,axes:[x,y]});saveControllers();
};
function navigateController(action){
  if(!action)return;
  const dialog=Array.from(document.querySelectorAll('dialog[open]')).at(-1),scope=dialog||(!playing?$('menu'):stageWaiting?$('stage-overlay'):finished?$('result-overlay'):$('pause-overlay'));
  const items=Array.from(scope.querySelectorAll('button,select,input,summary')).filter(el=>!el.disabled&&!el.hidden&&el.getClientRects().length);
  if(!items.length)return;
  let focus=document.activeElement,index=items.indexOf(focus);
  if(action==='back'){if(dialog)dialog.close();else if(paused)togglePause();return;}
  if(index<0){items[0].focus();return;}
  if(action==='confirm'){focus.click();return;}
  if(['left','right'].includes(action)&&focus.tagName==='SELECT'){
    const d=action==='right'?1:-1;focus.selectedIndex=Math.max(0,Math.min(focus.options.length-1,focus.selectedIndex+d));focus.dispatchEvent(new Event('change',{bubbles:true}));return;
  }
  if(['left','right'].includes(action)&&focus.type==='range'){
    focus.value=Number(focus.value)+(action==='right'?5:-5);focus.dispatchEvent(new Event('input',{bubbles:true}));return;
  }
  index=(index+(['up','left'].includes(action)?-1:1)+items.length)%items.length;items[index].focus();items[index].scrollIntoView({block:'nearest'});
}
renderControllers();
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
for(const [button,dialog] of [['help-button','help-dialog'],['options-button','options-dialog'],['replays-button','replays-dialog']])$(button).onclick=()=>{if(dialog==='replays-dialog')renderRecord();$(dialog).showModal();audio.start();$('sound-toggle').innerHTML=muted?'♫ <span>SOUND OFF</span>':'♫ <span>SOUND ON</span>';audio.event({type:'menu'});};
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
$('watch-replay').onclick=()=>{if(!verifiedReplay)return;practice=null;activeCompetition=null;playback=verifiedReplay;playbackIndex=0;$('replays-dialog').close();enterMatch(createState(playback.config),'REPLAY STUDIO / VERIFIED INPUT STREAM');if(playback.frames.length===0)showResult(true);};
document.addEventListener('visibilitychange',()=>audio.setPaused(document.hidden||paused));
applyOptions();updateTeams();updateContinue();renderMappings();requestAnimationFrame(frame);
if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').then(async registration=>{
  const ready=await navigator.serviceWorker.ready;if(ready.active)$('offline-status').textContent='OFFLINE READY · V3.1';
  if(registration.waiting)toast('A game update is ready. Close other Soccerweb tabs and reopen to update.');
}).catch(()=>$('offline-status').textContent='ONLINE MODE · CACHE UNAVAILABLE');
// Read-only diagnostics used by the browser smoke suite; never exposes mutable simulation objects.
export function diagnostics(){return state?{state:structuredClone(state),paused,playing,finished,hash:stateHash(state),recordedTicks:recorder?.frames.length||0,standards:state.goalposts?structuredClone(standards.view):null,practice:practice?{index:practice.index,progress:practice.progress,complete:practice.complete}:null,audio:{mode:audio.mode,state:audio.ctx?.state||'uninitialized',voices:audio.voices.size,cursor:audio.cursor,paused:audio.paused}}:null;}
