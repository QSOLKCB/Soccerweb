import { clamp, random } from '../simulation/math.mjs';
// A recipe is deterministic data. Web Audio is only one possible output renderer.
export function effectRecipe(event,seed=1988){
  const rng={rng:((seed>>>0)^(event.player||0)*2654435761)>>>0||1};
  const speed=clamp(Number(event.speed)||4,0,22),strength=clamp(speed/16,.15,1);
  const pan=clamp(Number(event.pan)||0,-.7,.7),out=[];
  const tone=(freq,end,duration,gain,wave='triangle',at=0,fm=0)=>out.push({kind:'tone',freq,end,duration,gain,wave,at,pan,fm});
  const noise=(duration,gain,cutoff,at=0)=>out.push({kind:'noise',duration,gain,cutoff,at,pan,seed:random(rng)});
  switch(event.type){
    case 'kick':
      tone(event.kind==='pass'?185:125,43,.12,.15+strength*.09);noise(.045,.025+strength*.035,2100);
      if(event.kind==='chip'||event.kind==='overhead')tone(320,600,.13,.035,'sine',.025);
      break;
    case 'slide':case 'slip':noise(.22,.08,1400);tone(75,35,.18,.035);break;
    case 'post':tone(420+speed*12,390,.4,.13,'sine',0,1.41);tone(910,875,.27,.04,'sine');noise(.035,.045,4000);break;
    case 'wall':tone(135,50,.13,.09+strength*.07);noise(.075,.05,1500);break;
    case 'bounce':tone(150,55,.07,.025+strength*.06);break;
    case 'save':noise(event.caught?.12:.07,.07+strength*.07,1100);tone(event.caught?90:150,45,.12,.075);break;
    case 'whistle':case 'goldengoal':tone(2150,2300,.24,.065,'sine',0,.025);tone(2350,2100,.15,.045,'sine',.18,.02);break;
    case 'goal':noise(1.6,.20,2200);for(let i=0;i<4;i++)tone([523,659,784,1046][i],[523,659,784,1046][i],.36,.055,'triangle',i*.12);break;
    case 'crowd':noise(2.1,.025+strength*.018,650);break;
    case 'rain':noise(1.4,.027,4900);break;
    case 'menu':tone(660,990,.065,.055,'triangle');break;
    default:break;
  }
  return out;
}
