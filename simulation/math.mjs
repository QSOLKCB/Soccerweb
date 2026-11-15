// Q8 positions and velocities. All authoritative calculations round toward zero.
export const Q = 256;
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const mul = (a, b, scale = Q) => Math.trunc(a * b / scale);
export function isqrt(n) {
  if (n <= 0) return 0;
  let x = n, y = Math.floor((x + 1) / 2);
  while (y < x) { x = y; y = Math.floor((x + Math.floor(n / x)) / 2); }
  return x;
}
export const length = (x, y) => isqrt(x * x + y * y);
export const distance = (a, b) => length(a.x - b.x, a.y - b.y);
export function vector(x, y, speed) {
  const d = length(x, y);
  return d ? [Math.trunc(x * speed / d), Math.trunc(y * speed / d)] : [0, 0];
}
export function random(s) {
  let x = s.rng | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  s.rng = x >>> 0; return s.rng;
}
export function hash(value) {
  const str = JSON.stringify(value); let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}
