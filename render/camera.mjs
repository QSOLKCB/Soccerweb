import {goalGeometry} from '../modes/goalposts.mjs';
import { Q, clamp } from '../simulation/math.mjs';
// Camera coordinates are cosmetic pixels. Never pass them back into the simulation.
export function cameraFrame(s, width, height, options = {}, prior = null, dt = 1 / 60) {
  const pw = s.w / Q, ph = s.h / Q;
  const zoom = options.zoom === 'wide' ? .82 : options.zoom === 'close' ? 1.12 : 1;
  let scale = Math.max(.2, Math.min(1.32, width / (options.demo ? 850 : 800), height / 620) * zoom);
  let vw = width / scale, vh = height / scale;
  const ballX = s.ball.x / Q, ballY = (s.ball.y - s.ball.z) / Q;
  const anticipation = options.reduced ? 0 : 9;
  const selected = s.players[s.selected[0]];
  let x = ballX * .86 + selected.x / Q * .14 + s.ball.vx / Q * anticipation;
  let y = ballY * .86 + selected.y / Q * .14 + s.ball.vy / Q * anticipation;
  const bounds = (n, size, view) => view >= size + 110 ? size / 2 : clamp(n, view / 2 - 65, size - view / 2 + 65);
  x = bounds(x, pw, vw); y = bounds(y, ph, vh);
  const blend = options.reduced ? 1 : 1 - Math.exp(-Math.min(.1, Math.max(0, dt)) * 9);
  if (prior) { x = prior.x + (x - prior.x) * blend; y = prior.y + (y - prior.y) * blend; }
  // Hard visibility guard: a fast shot or aerial ball may outrun the smoothed target.
  x = clamp(x, ballX - vw / 2 + 45, ballX + vw / 2 - 45);
  y = clamp(y, ballY - vh / 2 + 55, ballY + vh / 2 - 55);
  if(s.goalposts){
    const g=goalGeometry(s,0),left=Math.min(g.left/Q,ballX),right=Math.max(g.right/Q,ballX),top=Math.min(-65,ballY),bottom=Math.max(30,ballY);
    scale=Math.min(scale,width/(right-left+130),height/(bottom-top+130));vw=width/scale;vh=height/scale;
    x=clamp(x,right-vw/2+60,left+vw/2-60);y=clamp(y,bottom-vh/2+60,top+vh/2-60);
  }
  return { x, y, scale, vw, vh };
}
