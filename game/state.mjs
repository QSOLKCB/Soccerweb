import { Q, clamp, distance } from '../simulation/math.mjs';
export const EMPTY = Object.freeze({ x: 0, y: 0, fire: false, pass: false, chip: false, switch: false, curve: 0, cancel: false });
// v4 changes action gestures, first touch, contested possession and indoor defensive decisions.
export const VERSION = 4;
export function config(options = {}) {
  return { seed: (Number(options.seed) >>> 0) || 1988, indoor: !!options.indoor,
    weather: options.weather === 'rain' ? 'rain' : 'clear', seconds: clamp(Math.trunc(Number(options.seconds) || 120), 20, 720),
    difficulty: clamp(Math.trunc(Number(options.difficulty) || 1), 1, 3),
    teams: [clamp(Math.trunc(options.teams?.[0] || 0), 0, 7), clamp(Math.trunc(options.teams?.[1] ?? 1), 0, 7)],
    humans: [options.humans?.[0] !== false, !!options.humans?.[1]], auto: options.auto !== false,
    aftertouch: clamp(Math.trunc(Number(options.aftertouch) || 0), 0, 3), knockout: !!options.knockout };
}
export const attack = (s, team) => (team === 0 ? -1 : 1) * (s.half === 1 ? 1 : -1);
export const goalY = (s, team) => attack(s, team) < 0 ? 0 : s.h;
export function createState(options = {}) {
  const c = config(options), w = (c.indoor ? 540 : 720) * Q, h = (c.indoor ? 800 : 1120) * Q;
  const s = { version: VERSION, config: c, rng: c.seed, tick: 0, elapsed: 0, half: 1, w, h, goal: 150 * Q,
    phase: 'kickoff', timer: 90, restartTeam: 0, restartType: 'KICK OFF', score: [0, 0],
    players: [], selected: [1, 1], previous: [{...EMPTY}, {...EMPTY}], ball: {}, events: [],
    stats: { shots: [0, 0], saves: [0, 0], passes: [0, 0], tackles: [0, 0], completedPasses: [0, 0], possession: [0, 0] }, sudden: false };
  const count = c.indoor ? 6 : 11;
  for (let t = 0; t < 2; t++) for (let i = 0; i < count; i++) {
    const row = c.indoor ? (i <= 2 ? .25 : .43) : (i <= 4 ? .23 : i <= 8 ? .37 : .46);
    const col = c.indoor ? (i <= 2 ? (i - 1) / 1 : (i - 3) / 2) : i <= 4 ? (i - 1) / 3 : i <= 8 ? (i - 5) / 3 : (i - 9);
    s.players.push({ id: t * count + i, team: t, number: i + 1, keeper: i === 0,
      hx: i === 0 ? 128 : Math.round((.18 + col * .64) * Q), hy: i === 0 ? 14 : Math.round(row * Q),
      x: 0, y: 0, vx: 0, vy: 0, fx: 0, fy: attack(s, t) * Q,
      fireMode: 'idle', pending: null, charge: 0, cooldown: 0, slide: 0, slip: 0, dive: 0, control: 0, think: 0, tx: 0, ty: 0, intent: 'shape' });
  }
  s.selected = [1, count + 1]; resetPositions(s, 0); return s;
}
export function resetPositions(s, team) {
  for (const p of s.players) {
    p.x = Math.trunc(s.w * p.hx / Q);
    const fromEnd = Math.trunc(s.h * p.hy / Q);
    p.y = attack(s, p.team) < 0 ? s.h - fromEnd : fromEnd;
    p.vx = p.vy = p.charge = p.slide = p.slip = p.cooldown = p.dive = p.control = 0;
    p.fireMode='idle'; p.pending=null; p.fx = 0; p.fy = attack(s, p.team) * Q; p.tx=p.x; p.ty=p.y;
  }
  s.ball = { x: s.w / 2, y: s.h / 2, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, owner: -1, last: team,
    kicker: -1, immunity: 0, flight: 0, kind: 'loose', receiver: -1 };
  const p = s.players.find(p => p.team === team && p.number === (s.config.indoor ? 6 : 10));
  p.x = s.w / 2; p.y = s.h / 2 - attack(s, team) * 15 * Q; s.selected[team] = p.id;
  s.restartTeam = team;
}
export function nearest(s, team, exclude = -1) {
  let best = -1, d = Infinity;
  for (const p of s.players) if (p.team === team && !p.keeper && p.id !== exclude) {
    const n = distance(p, s.ball); if (n < d) { d = n; best = p.id; }
  }
  return best;
}
