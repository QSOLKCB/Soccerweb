import { Q, clamp } from '../simulation/math.mjs';
import { TEAMS } from '../game/teams.mjs';
import { attack } from '../game/state.mjs';
const lerp = (a, b, t) => a + (b - a) * t;
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false }); this.cx = null; this.cy = null;
    this.retro = false; this.palette = 'classic';
  }
  reset() { this.cx = this.cy = null; }
  draw(s, previous = s, alpha = 1, demo = false) {
    const canvas = this.canvas, ctx = this.ctx;
    const w = Math.max(320, canvas.clientWidth), h = Math.max(280, canvas.clientHeight);
    const ratio = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) { canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio); }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.imageSmoothingEnabled = false;
    const pitchW = s.w / Q, pitchH = s.h / Q;
    const scale = Math.max(.42, Math.min(1.25, w / (demo ? 880 : 830), h / (demo ? 750 : 630)));
    const vw = w / scale, vh = h / scale;
    const focus = s.players[s.selected[0]];
    let tx = s.ball.x / Q * .8 + focus.x / Q * .2, ty = s.ball.y / Q * .8 + focus.y / Q * .2;
    tx = vw > pitchW + 90 ? pitchW / 2 : clamp(tx, vw / 2 - 45, pitchW - vw / 2 + 45);
    ty = clamp(ty, vh / 2 - 80, pitchH - vh / 2 + 80);
    this.cx = this.cx === null ? tx : lerp(this.cx, tx, .10); this.cy = this.cy === null ? ty : lerp(this.cy, ty, .10);
    ctx.fillStyle = '#101f29'; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.scale(scale, scale); ctx.translate(-this.cx, -this.cy);
    this.pitch(s);
    // Rendering order follows depth; sorting a copied array cannot change authoritative order.
    const players = [...s.players].sort((a, b) => a.y - b.y);
    for (const p of players) {
      const old = previous.players[p.id] || p;
      this.player(s, p, lerp(old.x, p.x, alpha) / Q, lerp(old.y, p.y, alpha) / Q, demo);
    }
    const b = s.ball, oldB = previous.ball;
    const bx = lerp(oldB.x, b.x, alpha) / Q, by = lerp(oldB.y, b.y, alpha) / Q, bz = lerp(oldB.z, b.z, alpha) / Q;
    ctx.fillStyle = '#08271d80'; ctx.beginPath(); ctx.ellipse(bx + 3, by + 3, 6 + bz / 20, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#091b25'; ctx.fillRect(bx - 5, by - bz - 5, 10, 10);
    ctx.fillStyle = '#f8f6de'; ctx.fillRect(bx - 4, by - bz - 4, 8, 8);
    ctx.fillStyle = '#637d83'; ctx.fillRect(bx - 1, by - bz - 2, 3, 3); ctx.fillRect(bx + 2, by - bz + 2, 2, 2);
    if (bz > 20) { ctx.strokeStyle = '#ffffff60'; ctx.beginPath(); ctx.arc(bx, by, 8, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
    if (s.config.weather === 'rain' && !s.config.indoor) {
      ctx.strokeStyle = '#bcecf544'; ctx.lineWidth = 1;
      for (let i = 0; i < 90; i++) { const x = (i * 139 + s.tick * 3) % w, y = (i * 199 + s.tick * 8) % h; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 14); ctx.stroke(); }
    }
    if (!demo) this.minimap(s, w, h);
    if (this.retro) { ctx.fillStyle = '#05111929'; for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1); }
    // Soft frame, kept away from the playing field.
    const vignette = ctx.createRadialGradient(w/2,h/2,h*.3,w/2,h/2,w*.7);
    vignette.addColorStop(0,'#00000000'); vignette.addColorStop(1,'#020d194a'); ctx.fillStyle=vignette; ctx.fillRect(0,0,w,h);
  }
  pitch(s) {
    const c = this.ctx, w = s.w / Q, h = s.h / Q, indoor = s.config.indoor;
    c.fillStyle = indoor ? '#173447' : '#172b30'; c.fillRect(-180, -170, w + 360, h + 340);
    // Deterministic tiny crowd sprites, generated from the row and seat number.
    const crowd = ['#d09d65', '#7098ad', '#b16672', '#c2c9a6', '#627d7e'];
    for (let row = 0; row < 5; row++) {
      for (let i = -4; i < Math.floor(w / 12) + 5; i++) {
        c.fillStyle = crowd[Math.abs(i * 7 + row * 3) % crowd.length];
        for (const yy of [-66 - row * 16, h + 61 + row * 16]) { c.fillRect(i * 12 + row % 2 * 6, yy, 5, 5); c.fillRect(i * 12 - 1 + row % 2 * 6, yy + 5, 7, 4); }
      }
    }
    for (let y = -30; y < h + 30; y += 13) for (let row = 0; row < 5; row++) {
      c.fillStyle = crowd[(y + row * 2 + 1000) % 5]; c.fillRect(-66 - row * 13, y, 6, 8); c.fillRect(w + 61 + row * 13, y + 4, 6, 8);
    }
    c.fillStyle = '#0d1c24'; c.fillRect(-47,-42,w+94,h+84);
    c.fillStyle = '#e9d7ad'; c.fillRect(-38,-31,w+76,h+62);
    c.fillStyle = '#193d35'; c.fillRect(-32,-25,w+64,h+50);
    const wet = s.config.weather === 'rain';
    const colors = indoor ? ['#3d8181','#40898a'] : this.palette === 'mint' ? ['#41966e','#469e74'] : wet ? ['#2b7564','#307e6b'] : ['#36835b','#3b8d62'];
    for (let i = 0; i < 14; i++) { c.fillStyle = colors[i % 2]; c.fillRect(0, i*h/14, w, h/14 + 1); }
    c.fillStyle = '#efffd909';
    for(let i=0;i<950;i++) c.fillRect((i*137)%w,(i*211)%h,2,1);
    c.strokeStyle = indoor ? '#d8ebe4aa' : '#e4efcbb5'; c.lineWidth = 2;
    c.strokeRect(2,2,w-4,h-4); c.beginPath(); c.moveTo(0,h/2);c.lineTo(w,h/2);c.stroke();
    c.beginPath();c.arc(w/2,h/2,indoor?63:82,0,Math.PI*2);c.stroke();
    c.fillStyle='#e4efcb';c.fillRect(w/2-2,h/2-2,4,4);
    for(const top of [true,false]) {
      const depth=indoor?112:166, boxW=indoor?280:360;
      c.strokeRect((w-boxW)/2,top?0:h-depth,boxW,depth);
      c.strokeRect(w/2-99,top?0:h-56,198,56);
      c.beginPath();c.arc(w/2,top?114:h-114,64,top?.3:Math.PI+.3,top?Math.PI-.3:Math.PI*2-.3);c.stroke();
      c.fillRect(w/2-2,top?113:h-115,4,4);
      const gy=top?-25:h, gw=s.goal/Q;
      c.fillStyle='#c8e6e51a';c.fillRect(w/2-gw/2,gy,gw,25);
      c.strokeStyle='#b8ceca66';c.lineWidth=1;
      for(let x=w/2-gw/2;x<=w/2+gw/2;x+=10){c.beginPath();c.moveTo(x,gy);c.lineTo(x,gy+25);c.stroke();}
      for(let y=gy;y<=gy+25;y+=6){c.beginPath();c.moveTo(w/2-gw/2,y);c.lineTo(w/2+gw/2,y);c.stroke();}
      c.strokeStyle='#f2f0d7';c.lineWidth=4;c.strokeRect(w/2-gw/2,gy,gw,25);c.strokeStyle='#e4efcbb5';c.lineWidth=2;
    }
    c.font='bold 11px monospace'; c.textAlign='center';
    for(let y=80;y<h;y+=220) {
      c.save();c.translate(-17,y);c.rotate(-Math.PI/2);c.fillStyle='#f0c74f';c.fillText('SOCCERWEB',0,0);c.restore();
      c.save();c.translate(w+22,y);c.rotate(Math.PI/2);c.fillStyle='#a4d3c9';c.fillText('PURE WEB • PURE FOOTBALL',0,0);c.restore();
    }
    if(indoor){c.strokeStyle='#6db2bd';c.lineWidth=6;c.strokeRect(-4,-4,w+8,h+8);}
    else for(const [x,y] of [[0,0],[w,0],[0,h],[w,h]]){c.fillStyle='#e5e7c3';c.fillRect(x-1,y-14,2,14);c.fillStyle='#edb553';c.fillRect(x+1,y-14,9,6);}
  }
  player(s,p,x,y,demo) {
    const c=this.ctx, kit=TEAMS[s.config.teams[p.team]];
    const phase=Math.floor(s.tick/7+p.id)%2, moving=Math.abs(p.vx)+Math.abs(p.vy)>150;
    c.fillStyle='#102d2880'; c.beginPath();c.ellipse(x+3,y+4,p.slide||p.dive?13:9,4,0,0,Math.PI*2);c.fill();
    if(!demo&&s.config.humans[p.team]&&s.selected[p.team]===p.id){
      c.strokeStyle=p.team===0?'#ffdc65':'#6fe7ff';c.lineWidth=2;c.beginPath();c.ellipse(x,y+2,13,6,0,0,Math.PI*2);c.stroke();
      c.fillStyle=c.strokeStyle;c.beginPath();c.moveTo(x-5,y-31);c.lineTo(x+5,y-31);c.lineTo(x,y-25);c.fill();
      c.font='bold 9px monospace';c.textAlign='center';c.fillText(`P${p.team+1}`,x,y-36);
    }
    c.save();c.translate(Math.round(x),Math.round(y));
    if(p.slide||p.slip) c.rotate(p.fx>=0?.95:-.95);
    else if(p.dive)c.rotate(p.vx>=0?.8:-.8);
    c.fillStyle='#112831';c.fillRect(-7,-16,14,19);
    c.fillStyle=p.keeper?'#e7e6c5':kit.color;c.fillRect(-6,-15,12,10);
    c.fillStyle=p.keeper?'#6b8873':kit.accent;c.fillRect(-6,-13,3,7);c.fillRect(3,-13,3,7);
    c.fillStyle='#b87550';c.fillRect(-9,-12,3,7);c.fillRect(6,-12,3,7);
    c.fillStyle=kit.dark;c.fillRect(-5,-5,10,5);
    c.fillStyle='#e5c4a0';c.fillRect(-4,-23,8,8);c.fillStyle=p.id%3===0?'#342a29':'#604432';c.fillRect(-4,-24,8,3);c.fillRect(-5,-22,2,4);
    c.fillStyle=kit.color;c.fillRect(-5,0,4,moving&&phase?6:4);c.fillRect(1,0,4,moving&&!phase?6:4);
    c.fillStyle='#0d2330';c.fillRect(-6,moving&&phase?6:4,5,3);c.fillRect(1,moving&&!phase?6:4,5,3);
    c.fillStyle=kit.dark;c.fillRect(-1,-12,2,4);
    c.restore();
    if(p.charge){c.fillStyle='#142931';c.fillRect(x-15,y+13,30,5);c.fillStyle=p.charge>40?'#ff916b':'#f2cf5b';c.fillRect(x-14,y+14,28*p.charge/60,3);}
  }
  minimap(s,w,h){
    const c=this.ctx,mw=76,mh=mw*s.h/s.w,x=w-mw-18,y=h-mh-18;
    c.fillStyle='#0c2026cc';c.fillRect(x-7,y-7,mw+14,mh+14);c.strokeStyle='#a2bcb355';c.lineWidth=1;c.strokeRect(x,y,mw,mh);
    c.beginPath();c.moveTo(x,y+mh/2);c.lineTo(x+mw,y+mh/2);c.stroke();
    for(const p of s.players){c.fillStyle=TEAMS[s.config.teams[p.team]].color;c.fillRect(x+p.x/s.w*mw-1,y+p.y/s.h*mh-1,3,3);}
    c.fillStyle='white';c.fillRect(x+s.ball.x/s.w*mw-2,y+s.ball.y/s.h*mh-2,4,4);
    c.font='9px monospace';c.textAlign='center';c.fillStyle='#c7d6cf';c.fillText(attack(s,0)<0?'P1 ATTACK ↑':'P1 ATTACK ↓',x+mw/2,y-13);
  }
}
