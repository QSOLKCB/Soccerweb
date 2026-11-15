import { Q, clamp, mul, distance, vector, length } from './math.mjs';
import { attack, goalY } from '../game/state.mjs';
import { passTarget } from '../ai/team.mjs';
export function kick(s, p, kind = 'shot', power = 30, aim = null, curve = 0) {
  const b = s.ball;
  if (distance(p, b) > 30 * Q || b.z > 55 * Q || p.cooldown > 0) return false;
  let dx = p.fx, dy = p.fy;
  const target = kind === 'pass' ? (aim || passTarget(s, p, dx / Q, dy / Q)) : aim;
  if (target) { dx = target.x - b.x; dy = target.y - b.y; }
  if (!dx && !dy) dy = attack(s, p.team) * Q;
  const aerial = b.z > 12 * Q;
  const speed = kind === 'pass' ? (7 * Q + Math.min(3 * Q, Math.trunc((target ? distance(p, target) : 0) / 100))) : (7 * Q + Math.trunc(clamp(power, 0, 60) * Q / 7));
  [b.vx, b.vy] = vector(dx, dy, speed + (aerial ? Q : 0));
  b.vz = kind === 'chip' ? 5 * Q + Math.trunc(power * Q / 30) : kind === 'pass' ? (power > 42 ? 4 * Q : Q / 4) : Q + Math.trunc(power * Q / 65);
  if (kind === 'overhead') { [b.vx, b.vy] = vector(s.w / 2 - b.x, goalY(s, p.team) - b.y, 13 * Q); b.vz = 3 * Q; }
  b.spin = clamp(curve * 6, -18, 18); b.owner = -1; b.last = p.team; b.kicker = p.id; b.immunity = 14; b.flight = 65;
  p.cooldown = 18; p.charge = 0;
  s.stats[kind === 'pass' ? 'passes' : 'shots'][p.team]++;
  s.events.push({ type: 'kick', kind: kind === 'overhead' ? 'overhead' : aerial ? 'volley' : kind, team: p.team }); return true;
}
export function tackle(s, p) {
  if (p.cooldown || p.slip || p.slide) return;
  p.slide = 18; p.cooldown = 55; p.vx += mul(p.fx, 3 * Q); p.vy += mul(p.fy, 3 * Q);
  s.events.push({ type: 'slide', team: p.team });
}
export function ballPhysics(s) {
  const b = s.ball, old = { x: b.x, y: b.y, z: b.z };
  if (b.immunity > 0) b.immunity--;
  if (b.flight > 0) b.flight--;
  const vx = b.vx;
  b.vx -= mul(b.vy, b.spin, 4096); b.vy += mul(vx, b.spin, 4096);
  b.x += b.vx; b.y += b.vy; b.z += b.vz;
  b.vz -= 36;
  if (b.z < 0) {
    b.z = 0;
    b.vz = Math.abs(b.vz) > 90 ? -mul(b.vz, 118) : 0;
    if (b.vz > 160) s.events.push({ type: 'bounce' });
  }
  const friction = b.z > 0 ? 255 : s.config.indoor ? 253 : s.config.weather === 'rain' ? 254 : 251;
  b.vx = mul(b.vx, friction); b.vy = mul(b.vy, friction);
  if (Math.abs(b.vx) + Math.abs(b.vy) < 24) b.vx = b.vy = 0;
  // Swept crossing at the goal plane, rather than an endpoint-only goal test.
  if ((old.y >= 0 && b.y < 0) || (old.y <= s.h && b.y > s.h)) {
    const end = b.y < 0 ? 0 : s.h, den = b.y - old.y;
    const crossX = old.x + Math.trunc((b.x - old.x) * (end - old.y) / den);
    const crossZ = old.z + Math.trunc((b.z - old.z) * (end - old.y) / den);
    if (Math.abs(crossX - s.w / 2) < s.goal / 2 - 4 * Q && crossZ < 36 * Q) {
      const scoring = goalY(s, 0) === end ? 0 : 1;
      s.score[scoring]++; s.phase = 'goal'; s.timer = 150; s.restartTeam = 1 - scoring;
      s.events.push({ type: 'goal', team: scoring }); return;
    }
    // Posts and crossbar rebound instead of awarding a goal.
    if (Math.abs(Math.abs(crossX - s.w / 2) - s.goal / 2) < 8 * Q && crossZ < 40 * Q || Math.abs(crossX - s.w / 2) < s.goal / 2 && Math.abs(crossZ - 36 * Q) < 5 * Q) {
      b.y = clamp(b.y, 2 * Q, s.h - 2 * Q); b.vy = -mul(b.vy, 205); b.owner = -1;
      s.events.push({ type: 'post' }); return;
    }
  }
  if (s.config.indoor) {
    if (b.x < 4 * Q || b.x > s.w - 4 * Q) { b.x = clamp(b.x, 4 * Q, s.w - 4 * Q); b.vx = -mul(b.vx, 230); b.owner = -1; s.events.push({ type: 'wall' }); }
    if (b.y < 0 || b.y > s.h) { b.y = clamp(b.y, 2 * Q, s.h - 2 * Q); b.vy = -mul(b.vy, 230); b.owner = -1; s.events.push({ type: 'wall' }); }
  } else if (b.x < 0 || b.x > s.w || b.y < 0 || b.y > s.h) {
    let team = 1 - b.last, type = 'THROW IN';
    if (b.y < 0 || b.y > s.h) {
      const end = b.y < 0 ? 0 : s.h, defending = goalY(s, 0) === end ? 1 : 0;
      if (b.last === defending) { type = 'CORNER'; b.x = b.x < s.w / 2 ? 6 * Q : s.w - 6 * Q; b.y = end === 0 ? 6 * Q : s.h - 6 * Q; }
      else { type = 'GOAL KICK'; team = defending; b.x = s.w / 2; b.y = end === 0 ? 60 * Q : s.h - 60 * Q; }
    } else { b.x = clamp(b.x, 6 * Q, s.w - 6 * Q); b.y = clamp(b.y, 15 * Q, s.h - 15 * Q); }
    b.vx = b.vy = b.vz = b.z = b.spin = 0; b.owner = -1;
    s.phase = 'restart'; s.timer = 65; s.restartTeam = team; s.restartType = type;
    s.events.push({ type: 'whistle' }); return;
  }
  if (b.owner >= 0) {
    const owner = s.players[b.owner];
    if (distance(owner, b) > 34 * Q || b.z > 12 * Q || owner.slip || owner.slide) b.owner = -1;
  }
  for (const p of s.players) {
    const d = distance(p, b), speed = length(b.vx, b.vy);
    const ownEnd = attack(s, p.team) < 0 ? s.h : 0;
    const keeper = p.keeper && Math.abs(p.y - ownEnd) < 165 * Q;
    const radius = (keeper && p.dive ? 27 : keeper ? 19 : p.slide ? 23 : 12) * Q;
    if (b.immunity && b.kicker === p.id || p.slip || d > radius || b.z > (keeper ? 36 : p.slide ? 8 : 13) * Q) continue;
    if (keeper && b.owner !== p.id && b.last !== p.team && speed > 2 * Q) {
      s.stats.saves[p.team]++; s.events.push({ type: 'save', team: p.team });
      if (speed > 11 * Q && !p.dive) {
        b.vy = attack(s, p.team) * Math.abs(mul(b.vy, 155)); b.vx += Math.trunc((b.x - p.x) / 6); b.vz = 2 * Q;
        b.last = p.team; b.kicker = p.id; b.immunity = 14; b.owner = -1; continue;
      }
      b.vx = b.vy = b.vz = 0; b.z = 0; b.owner = p.id; b.last = p.team;
    } else if (p.slide && b.owner !== p.id) {
      b.owner = -1; b.vx = p.vx + mul(p.fx, 4 * Q); b.vy = p.vy + mul(p.fy, 4 * Q);
      b.last = p.team; b.kicker = p.id; b.immunity = 10; s.stats.tackles[p.team]++;
    } else if (b.owner < 0 && (speed < 9 * Q || keeper)) { b.owner = p.id; b.last = p.team; }
    else if (b.owner >= 0 && s.players[b.owner].team !== p.team && d < 9 * Q) { b.owner = p.id; b.last = p.team; }
    else if (b.owner < 0 && d < 10 * Q) {
      const [nx, ny] = vector(b.x - p.x || Q, b.y - p.y, Q);
      const dot = mul(b.vx, nx) + mul(b.vy, ny);
      if (dot < 0) { b.vx -= mul(nx, dot * 2); b.vy -= mul(ny, dot * 2); b.vx = mul(b.vx, 160); b.vy = mul(b.vy, 160); b.last = p.team; }
    }
  }
  // A dribble is a spring impulse toward the runner's leading foot. The ball remains free.
  if (b.owner >= 0) {
    const p = s.players[b.owner];
    const dx = p.x + mul(p.fx, 15 * Q) - b.x, dy = p.y + mul(p.fy, 15 * Q) - b.y;
    b.vx = mul(b.vx, 160) + Math.trunc(dx / 5) + Math.trunc(p.vx / 3);
    b.vy = mul(b.vy, 160) + Math.trunc(dy / 5) + Math.trunc(p.vy / 3);
    b.spin = 0; b.flight = 0; s.stats.possession[p.team]++;
  }
}
