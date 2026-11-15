import { createState } from '../game/state.mjs';
import { step } from '../game/match.mjs';
import { random } from '../simulation/math.mjs';
export function createCompetition(type, team, seed=1988){
  seed=(Number(seed)>>>0)||1988;
  const opponents=Array.from({length:8},(_,i)=>i).filter(i=>i!==team),rng={rng:seed};
  for(let i=opponents.length-1;i>0;i--){const j=random(rng)%(i+1);[opponents[i],opponents[j]]=[opponents[j],opponents[i]];}
  return {version:1,type,team,seed,round:0,field:[team,...opponents],history:[],complete:false,champion:null,eliminated:false};
}
export function nextFixture(c){
  if(c.complete)return null;
  if(c.type==='challenge')return {teams:[c.team,c.field[c.round+1]],difficulty:Math.min(3,1+Math.floor(c.round/2)),round:`CHALLENGE ${c.round+1} / 7`};
  const index=c.field.indexOf(c.team),opponent=c.field[index%2===0?index+1:index-1];
  return {teams:[c.team,opponent],difficulty:Math.min(3,c.round+1),round:['QUARTER FINAL','SEMI FINAL','CUP FINAL'][c.round]};
}
export async function finishFixture(c,score,base={}){
  if(c.complete||score[0]===score[1])throw new Error('Competition needs a decisive result.');
  const f=nextFixture(c),winner=score[0]>score[1]?c.team:f.teams[1];
  c.history.push({round:c.round,teams:f.teams,score:[...score],winner});
  if(c.type==='challenge'){
    if(winner!==c.team){c.complete=true;c.eliminated=true;c.champion=winner;}
    else if(++c.round===7){c.complete=true;c.champion=c.team;}
    return c;
  }
  let winners=[];
  for(let i=0;i<c.field.length;i+=2){
    const teams=c.field.slice(i,i+2);
    if(teams.includes(c.team)){winners.push(winner);continue;}
    // Other fixtures use precisely the same football simulation, including golden goal.
    const s=createState({...base,seconds:40,teams,humans:[false,false],seed:c.seed+c.round*100+i,knockout:true});
    while(s.phase!=='fulltime'&&s.tick<120000){step(s);if(s.tick%4000===0)await new Promise(resolve=>setTimeout(resolve,0));}
    if(s.phase!=='fulltime')throw new Error('A CPU fixture exceeded the replay limit. Retry this round.');
    const won=s.score[0]>s.score[1]?teams[0]:teams[1];winners.push(won);c.history.push({round:c.round,teams,score:s.score,winner:won});
  }
  c.field=winners;c.round++;
  if(!winners.includes(c.team)){c.eliminated=true;c.complete=true;}
  if(winners.length===1){c.complete=true;c.champion=winners[0];}
  return c;
}
export function validCompetition(c) {
  const team = t => Number.isInteger(t) && t >= 0 && t < 8;
  if (!c || c.version !== 1 || !['cup', 'challenge'].includes(c.type) || !team(c.team)) return false;
  if (!Number.isInteger(c.seed) || c.seed < 0 || c.seed > 4294967295) return false;
  if (!Number.isInteger(c.round) || c.round < 0 || c.round > (c.type === 'cup' ? 3 : 7)) return false;
  if (!Array.isArray(c.field) || !c.field.every(team) || new Set(c.field).size !== c.field.length) return false;
  if (c.field.length !== (c.type === 'cup' ? 8 >> c.round : 8)) return false;
  if (typeof c.complete !== 'boolean' || typeof c.eliminated !== 'boolean') return false;
  if (!c.complete && (!c.field.includes(c.team) || c.round === (c.type === 'cup' ? 3 : 7))) return false;
  if (c.champion !== null && !team(c.champion)) return false;
  return Array.isArray(c.history) && c.history.length <= 30 && c.history.every(h =>
    Array.isArray(h.teams) && h.teams.length === 2 && h.teams.every(team) && team(h.winner) &&
    Array.isArray(h.score) && h.score.length === 2 && h.score.every(n => Number.isInteger(n) && n >= 0 && n < 1000));
}
export const readSaved=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
export function save(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
