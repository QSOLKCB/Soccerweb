import { Q, clamp, mul, vector, random, distance } from '../simulation/math.mjs';
import { EMPTY, attack, resetPositions, nearest } from './state.mjs';
import { aiIntent } from '../ai/team.mjs';
import { kick, tackle, ballPhysics } from '../simulation/physics.mjs';
export function normalizeInput(i = EMPTY) {
  return { x: clamp(Math.trunc(i.x || 0), -1, 1), y: clamp(Math.trunc(i.y || 0), -1, 1),
    fire: !!i.fire, pass: !!i.pass, chip: !!i.chip, switch: !!i.switch, curve: clamp(Math.trunc(i.curve || 0), -1, 1) };
}
function restart(s) {
  if (s.phase === 'goal') {
    if (s.sudden) { s.phase = 'fulltime'; s.events.push({ type: 'whistle' }); return; }
    resetPositions(s, s.restartTeam); s.phase = 'kickoff'; s.restartType = 'KICK OFF'; s.timer = 70;
  } else if (s.phase === 'halftime') {
    s.half = 2; resetPositions(s, 1); s.phase = 'kickoff'; s.restartType = 'SECOND HALF'; s.timer = 70;
  } else if (s.phase === 'restart') {
    const id = nearest(s, s.restartTeam), p = s.players[id];
    p.x = s.ball.x; p.y = clamp(s.ball.y - attack(s, p.team) * 13 * Q, 5 * Q, s.h - 5 * Q);
    p.fx = s.ball.x < 15 * Q ? Q : s.ball.x > s.w - 15 * Q ? -Q : 0; p.fy = attack(s, p.team) * Q;
    s.ball.owner = id; s.ball.last = p.team; s.selected[p.team] = id; s.phase = 'play';
  } else s.phase = 'play';
}
export function step(s, inputs = [EMPTY, EMPTY]) {
  if (s.phase === 'fulltime') return s;
  const ins = inputs.map(normalizeInput); s.events = []; s.tick++;
  if (s.phase !== 'play') {
    if (--s.timer <= 0) restart(s);
    s.previous = ins; return s;
  }
  s.elapsed++;
  if (s.half === 1 && s.elapsed >= s.config.seconds * 30) { s.phase = 'halftime'; s.timer = 150; s.events.push({ type: 'whistle' }); return s; }
  if (s.elapsed >= s.config.seconds * 60 && !s.sudden) {
    if (s.config.knockout && s.score[0] === s.score[1]) { s.sudden = true; s.events.push({ type: 'goldengoal' }); }
    else { s.phase = 'fulltime'; s.events.push({ type: 'whistle' }); return s; }
  }
  for (let t = 0; t < 2; t++) if (s.config.humans[t]) {
    const input = ins[t], prev = s.previous[t], selected = s.players[s.selected[t]];
    if (input.switch && !prev.switch) s.selected[t] = nearest(s, t, s.selected[t]);
    else if (s.config.auto && !selected.charge && !input.fire) {
      if (s.ball.owner >= 0 && s.players[s.ball.owner].team === t && !s.players[s.ball.owner].keeper) s.selected[t] = s.ball.owner;
      else if (s.tick % 30 === 0 && distance(selected, s.ball) > 160 * Q) s.selected[t] = nearest(s, t);
    }
  }
  for (const p of s.players) {
    p.cooldown = Math.max(0, p.cooldown - 1); p.dive = Math.max(0, p.dive - 1);
    const human = s.config.humans[p.team] && s.selected[p.team] === p.id;
    let action;
    if (human) {
      const i = ins[p.team], prev = s.previous[p.team];
      const [x, y] = vector(i.x, i.y, Q); action = { x, y };
      if (i.fire) p.charge = Math.min(60, p.charge + 1);
      if (i.fire && !prev.fire && (s.ball.owner >= 0 && s.players[s.ball.owner].team !== p.team || distance(p, s.ball) > 32 * Q)) tackle(s, p);
      if ((!i.fire && prev.fire) || i.pass && !prev.pass || i.chip && !prev.chip) {
        let kind = i.pass ? 'pass' : i.chip ? 'chip' : p.charge < 12 ? 'pass' : 'shot';
        if (s.ball.z > 15 * Q && i.y === -attack(s, p.team)) kind = 'overhead';
        kick(s, p, kind, p.charge || 25, null, i.curve * (1 + s.config.aftertouch)); p.charge = 0;
      }
      if (s.ball.kicker === p.id && s.ball.flight && s.ball.owner < 0) s.ball.spin = clamp(s.ball.spin + (i.curve || i.x) * s.config.aftertouch, -18, 18);
    } else {
      action = aiIntent(s, p);
      if (action.kick) kick(s, p, action.kick, action.power, action.target || (action.aimX !== undefined ? { x: action.aimX, y: action.aimY } : null));
      if (action.tackle) tackle(s, p);
    }
    if (p.slide > 0) { p.slide--; p.vx = mul(p.vx, 245); p.vy = mul(p.vy, 245); }
    else if (p.slip > 0) { p.slip--; p.vx = mul(p.vx, 250); p.vy = mul(p.vy, 250); }
    else {
      const speed = p.keeper ? (p.dive ? 5 * Q : 3 * Q) : s.config.indoor ? 900 : 790;
      const ax = action.x || 0, ay = action.y || 0;
      const traction = s.config.weather === 'rain' && !s.config.indoor ? 35 : 58;
      const turn = p.vx * ax + p.vy * ay;
      if (s.config.weather === 'rain' && !s.config.indoor && turn < -100000 && random(s) % 180 === 0) { p.slip = 18; s.events.push({ type: 'slip' }); }
      p.vx += mul(mul(ax, speed) - p.vx, traction);
      p.vy += mul(mul(ay, speed) - p.vy, traction);
      if (ax || ay) { p.fx = ax; p.fy = ay; }
    }
    p.x = clamp(p.x + p.vx, 7 * Q, s.w - 7 * Q); p.y = clamp(p.y + p.vy, 7 * Q, s.h - 7 * Q);
  }
  // Resolve overlapping bodies with stable ID order; neither team gets iteration-dependent randomness.
  for (let a = 0; a < s.players.length; a++) for (let b = a + 1; b < s.players.length; b++) {
    const p = s.players[a], q = s.players[b], d = distance(p, q);
    if (d < 15 * Q && !p.slide && !q.slide) {
      const [x, y] = vector(p.x - q.x || Q, p.y - q.y, Math.trunc((15 * Q - d) / 2));
      p.x = clamp(p.x + x, 7 * Q, s.w - 7 * Q); p.y = clamp(p.y + y, 7 * Q, s.h - 7 * Q);
      q.x = clamp(q.x - x, 7 * Q, s.w - 7 * Q); q.y = clamp(q.y - y, 7 * Q, s.h - 7 * Q);
    }
  }
  ballPhysics(s); s.previous = ins; return s;
}
