import { createState, VERSION } from '../game/state.mjs';
import { step, normalizeInput } from '../game/match.mjs';
import { hash } from '../simulation/math.mjs';
export const pack = i => [i.x, i.y, +i.fire | +i.pass << 1 | +i.chip << 2 | +i.switch << 3, i.curve];
export const unpack = a => ({ x: a[0], y: a[1], fire: !!(a[2] & 1), pass: !!(a[2] & 2), chip: !!(a[2] & 4), switch: !!(a[2] & 8), curve: a[3] });
export function stateHash(s) { const { events, ...state } = s; return hash(state); }
export class Recorder {
  constructor(s) { this.config = structuredClone(s.config); this.frames = []; this.checkpoints = []; }
  record(s, inputs) {
    this.frames.push(inputs.map(i => pack(normalizeInput(i))));
    if (s.tick % 300 === 0) this.checkpoints.push([s.tick, stateHash(s)]);
  }
  export(s) { return { format: 'SOCCERWEB', version: VERSION, config: this.config, frames: this.frames, checkpoints: this.checkpoints, finalHash: stateHash(s) }; }
}
export function validateReplay(data) {
  if (!data || data.format !== 'SOCCERWEB' || data.version !== VERSION || !data.config || !Array.isArray(data.frames) || data.frames.length > 120000 || !/^[a-f0-9]{8}$/.test(data.finalHash)) throw new Error('Unsupported or invalid replay.');
  if (JSON.stringify(data.config) !== JSON.stringify(createState(data.config).config)) throw new Error('Replay settings are invalid.');
  for (const frame of data.frames) {
    if (!Array.isArray(frame) || frame.length !== 2) throw new Error('Invalid frame.');
    for (const a of frame) if (!Array.isArray(a) || a.length !== 4 || !a.every(Number.isInteger) || Math.abs(a[0]) > 1 || Math.abs(a[1]) > 1 || a[2] < 0 || a[2] > 15 || Math.abs(a[3]) > 1) throw new Error('Invalid input.');
  }
  if (!Array.isArray(data.checkpoints) || data.checkpoints.length > 400 || data.checkpoints.some((p, i) => !Array.isArray(p) || p.length !== 2 || p[0] !== (i + 1) * 300 || p[0] > data.frames.length || !/^[a-f0-9]{8}$/.test(p[1]))) throw new Error('Invalid checkpoints.');
  return data;
}
export function verifyReplay(data) {
  validateReplay(data); const s = createState(data.config); let ci = 0;
  for (const frame of data.frames) {
    if (s.phase === 'fulltime') throw new Error('Replay continues beyond full time.');
    step(s, frame.map(unpack));
    if (data.checkpoints[ci]?.[0] === s.tick && data.checkpoints[ci++][1] !== stateHash(s)) throw new Error(`Replay diverged at tick ${s.tick}.`);
  }
  if (stateHash(s) !== data.finalHash) throw new Error('Replay final hash does not match.');
  return s;
}
