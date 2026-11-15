import { Q, clamp, distance, vector, random } from '../simulation/math.mjs';
import { attack, goalY, nearest } from '../game/state.mjs';
import { TEAMS } from '../game/teams.mjs';
export function passTarget(s, p, dx = 0, dy = 0) {
  let best = null, utility = -Infinity;
  for (const mate of s.players) if (mate.team === p.team && mate.id !== p.id && !mate.keeper) {
    const d = distance(p, mate) / Q; if (d < 35 || d > 470) continue;
    const forward = (mate.y - p.y) / Q * attack(s, p.team);
    const aim = dx || dy ? ((mate.x - p.x) * dx + (mate.y - p.y) * dy) / (d * Q) * 150 : 0;
    let space = 150;
    for (const foe of s.players) if (foe.team !== p.team) space = Math.min(space, distance(mate, foe) / Q);
    const score = forward * .6 + space + aim - Math.abs(d - 150) * .3;
    if (score > utility) { utility = score; best = mate; }
  }
  return best;
}
export function aiIntent(s, p) {
  const b = s.ball, dir = attack(s, p.team), difficulty = s.config.difficulty;
  const own = b.owner >= 0 ? s.players[b.owner] : null, team = TEAMS[s.config.teams[p.team]];
  if (p.keeper) {
    const gy = dir < 0 ? s.h : 0;
    const danger = Math.abs(b.y - gy) < 300 * Q;
    const intercept = clamp(b.x + b.vx * 10, s.w / 2 - s.goal / 2 + 8 * Q, s.w / 2 + s.goal / 2 - 8 * Q);
    let ty = gy + dir * (danger ? 38 : 22) * Q;
    if (own?.id === p.id) return { x: 0, y: dir, kick: 'pass', power: 36 };
    if (danger && b.z < 35 * Q && b.vy * dir < -5 * Q && p.cooldown === 0) { p.dive = 20; p.cooldown = 70; }
    const [x, y] = vector(intercept - p.x, ty - p.y, Q);
    return { x, y };
  }
  if (own?.id === p.id) {
    const goalDist = Math.abs(goalY(s, p.team) - p.y) / Q;
    const alignment = Math.abs(p.x - s.w / 2) / Q;
    p.intent = 'attack';
    if (--p.think <= 0) {
      p.think = 38 - difficulty * 8;
      if (goalDist < 270 + team.attack && alignment < s.w / Q * .35) {
        const offset = ((random(s) % (55 - difficulty * 10)) - (27 - difficulty * 5)) * Q;
        return { x: 0, y: dir * Q, kick: 'shot', power: 32 + difficulty * 9, aimX: s.w / 2 + offset, aimY: goalY(s, p.team) };
      }
      let pressure = 1000 * Q;
      for (const f of s.players) if (f.team !== p.team) pressure = Math.min(pressure, distance(f, p));
      const mate = passTarget(s, p);
      if (mate && (pressure < (45 + difficulty * 10) * Q || random(s) % 100 < team.pass / 3))
        return { x: 0, y: dir * Q, kick: 'pass', power: 25, target: mate };
    }
    const [x, y] = vector(s.w / 2 - p.x, dir * 200 * Q, Q); return { x, y };
  }
  const chaser = nearest(s, p.team);
  if (chaser === p.id || (!own && distance(p, b) < 80 * Q)) {
    p.intent = 'chase';
    const anticipation = difficulty * 4;
    const [x, y] = vector(b.x + b.vx * anticipation - p.x, b.y + b.vy * anticipation - p.y, Q);
    return { x, y, tackle: own && own.team !== p.team && distance(p, b) < (22 + difficulty * 6) * Q && s.tick % (65 - difficulty * 10) === p.id % (65 - difficulty * 10) };
  }
  p.intent = own?.team === p.team ? 'support' : 'defend';
  const base = Math.trunc(s.h * p.hy / Q);
  const homeY = dir < 0 ? s.h - base : base;
  const advance = own?.team === p.team ? dir * (160 + team.attack) * Q : 0;
  const tx = clamp(Math.trunc(s.w * p.hx / Q) + Math.trunc((b.x - s.w / 2) * (difficulty + 1) / 12), 25 * Q, s.w - 25 * Q);
  const ty = clamp(homeY + Math.trunc((b.y - s.h / 2) * (3 + difficulty) / 10) + advance, 65 * Q, s.h - 65 * Q);
  p.tx = tx; p.ty = ty;
  if (distance(p, { x: tx, y: ty }) < 10 * Q) return { x: 0, y: 0 };
  const [x, y] = vector(tx - p.x, ty - p.y, Q); return { x, y };
}
