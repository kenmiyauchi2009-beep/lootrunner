// 追加の敵とボスの絵（foes.js の look / shape）。x：中心、y：足もと、左（主人公の方）を向く
import { FOES2 } from './foes.js';
import { BOSSES } from './data.js';

let c, T = {};   // c：描く先、T：render.js の道具（glow・bang）
const rr = (x, y, w, h, r, col) => { c.fillStyle = col; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); };
const circ = (x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI*2); c.fill(); };
const ell = (x, y, rx, ry, col, rot = 0) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI*2); c.fill(); };
const poly = (pts, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); c.fill(); };
const line = (x1, y1, x2, y2, col, w = 2) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };
const eye = (x, y, r = 2.2, pupil = '#123', white = '#fff') => { circ(x, y, r, white); circ(x - r*0.35, y, r*0.5, pupil); };

// ---------- 追加の敵 ----------
export function drawFoe2(ctx, e, F, tools){
  c = ctx; T = tools;
  const G = FOES2[e.type], L = G.look, x = e.x, y = e.y, w = e.w, h = e.h, t = e.t;
  const C = F || L.c, C2 = F || L.c2;
  if (e.solid === false) c.globalAlpha = 0.28;   // 透けている（攻撃が当たらない）
  switch (L.shape){
    case 'insect': {
      const cy = y - h/2, fl = Math.sin(t*28)*5;
      if (L.wing){ c.globalAlpha *= 0.6; ell(x + 2, cy - 6 - fl*0.3, 7, 4, '#e8f6ff', -0.4); ell(x + 6, cy - 5 + fl*0.3, 6, 3.5, '#e8f6ff', 0.3); c.globalAlpha = e.solid === false ? 0.28 : 1; }
      ell(x + 4, cy, w*0.32, h*0.38, C);                // 腹
      if (L.c2 && !L.crystal) for (let k = 0; k < 2; k++) rr(x + 1 + k*5, cy - h*0.35, 2.4, h*0.7, 1, C2);
      ell(x - w*0.25, cy, w*0.22, h*0.34, C);           // 頭
      if (L.crystal){ poly([x - 2, cy - h*0.3, x + 4, cy - h*0.9, x + 8, cy - h*0.3], C2); poly([x + 6, cy - h*0.3, x + 11, cy - h*0.75, x + 13, cy - h*0.25], C2); }
      if (L.tail){ c.strokeStyle = C; c.lineWidth = 3; c.beginPath(); c.moveTo(x + w*0.35, cy); c.quadraticCurveTo(x + w*0.55, cy - h*1.2, x + w*0.15, cy - h*1.1); c.stroke(); poly([x + w*0.15, cy - h*1.25, x + w*0.05, cy - h*0.95, x + w*0.22, cy - h*0.98], C2); }
      if (!L.wing) for (let k = 0; k < 3; k++){ const lx = x - 6 + k*7, ph = Math.sin(t*16 + k)*2; line(lx, cy + 2, lx - 3 + ph, y, C2, 1.5); }
      eye(x - w*0.33, cy - 1, 1.6, '#000', '#fff');
      break;
    }
    case 'mushroom': {
      const puff = e.wind ? 1.1 : 1;
      rr(x - 5, y - h*0.55, 10, h*0.55, 3, '#f3ead2');
      ell(x, y - h*0.6, w/2*puff, h*0.38*puff, C);
      for (const [dx, dy, r] of [[-5, -0.72, 2.5], [4, -0.8, 2], [7, -0.58, 1.8]]) circ(x + dx, y + h*dy, r, C2);
      eye(x - 3, y - h*0.3, 1.6); eye(x + 2.5, y - h*0.3, 1.6);
      break;
    }
    case 'beast': {
      const run = Math.sin(t*14)*3, cy = y - h*0.55, tele = e.phase === 'tele';
      for (const dx of [-8, -3, 4, 9]) line(x + dx, cy + 3, x + dx + (dx % 2 ? run : -run), y, F || shade(L.c, -30), 3);
      ell(x + 2, cy, w*0.42, h*0.36, C);
      ell(x - w*0.38, cy - h*0.2 + (tele ? 2 : 0), w*0.2, h*0.26, C);
      if (L.horn) poly([x - w*0.42, cy - h*0.4, x - w*0.32, cy - h*1.05, x - w*0.28, cy - h*0.38], '#fff2c0');
      else poly([x - w*0.28, cy - h*0.4, x - w*0.22, cy - h*0.75, x - w*0.16, cy - h*0.36], C);   // 耳
      circ(x - w*0.45, cy - h*0.22, 1.6, L.c2 && !L.horn ? C2 : '#222');
      if (L.horn) ell(x + w*0.42, cy - h*0.1, 3, 3, C2);   // しっぽ
      break;
    }
    case 'bird': {
      const cy = y - h/2, fl = Math.sin(t*(L.bat ? 24 : 14))*7, dive = e.phase === 'dive';
      const wing = (sx, col) => poly([x + sx, cy, x + sx + 14, cy - 4 - fl, x + sx + 6, cy + 4], col);
      if (L.bat){ poly([x - 3, cy, x - 15, cy - 4 - fl, x - 9, cy + 3], C); poly([x + 3, cy, x + 15, cy - 4 - fl, x + 9, cy + 3], C); circ(x, cy, 6, C2 === '#ffffff' ? C : C2); circ(x - 2.5, cy - 1, 1.4, '#fff'); break; }
      wing(-2, F || shade(L.c, -20));
      ell(x + 2, cy, w*0.36, h*0.36, C, dive ? -0.5 : 0);
      if (L.harpy){ circ(x - w*0.3, cy - h*0.35, 5.5, F || '#f6d2a8'); c.fillStyle = C; c.beginPath(); c.arc(x - w*0.3, cy - h*0.42, 6, Math.PI, 0); c.fill(); circ(x - w*0.38, cy - h*0.35, 1.2, '#222'); }
      else if (L.owl){ circ(x - w*0.2, cy - h*0.25, 7, C); eye(x - w*0.3, cy - h*0.3, 2.6, '#000', C2); eye(x - w*0.1, cy - h*0.3, 2.6, '#000', C2); poly([x - w*0.22, cy - h*0.18, x - w*0.2, cy - h*0.02, x - w*0.15, cy - h*0.15], '#d8a040'); }
      else { circ(x - w*0.35, cy - h*0.2, 5, F || shade(L.c, 15)); poly([x - w*0.5, cy - h*0.25, x - w*0.68, cy - h*0.12, x - w*0.5, cy - h*0.08], '#e8b040'); circ(x - w*0.4, cy - h*0.28, 1.3, '#222'); }
      if (L.c2 && !L.harpy && !L.owl) rr(x + 4, cy - 2, w*0.3, 3, 1.5, C2);
      wing(4, C);
      if (e.phase === 'tele') T.bang(x, cy - h - 4, 16);
      break;
    }
    case 'cactus': {
      rr(x - 6, y - h, 12, h, 6, C);
      rr(x - 13, y - h*0.7, 6, 12, 3, C); rr(x - 13, y - h*0.5, 9, 5, 2.5, C);
      rr(x + 7, y - h*0.8, 6, 12, 3, C); rr(x + 4, y - h*0.6, 9, 5, 2.5, C);
      c.fillStyle = '#e8f0d0'; for (let k = 0; k < 6; k++) c.fillRect(x - 6 + (k % 2)*10, y - h + 4 + k*4, 2, 1);
      circ(x, y - h, 3, C2); eye(x - 3, y - h*0.65, 1.5); eye(x + 2, y - h*0.65, 1.5);
      break;
    }
    case 'tree': {
      const sw = Math.sin(t*3)*1.5;
      rr(x - 7, y - h*0.65, 14, h*0.65, 3, C);
      line(x - 5, y - 2, x - 9 + sw, y, C, 4); line(x + 5, y - 2, x + 9 - sw, y, C, 4);
      circ(x + sw, y - h*0.78, w*0.45, C2); circ(x - 8 + sw, y - h*0.68, w*0.3, C2); circ(x + 9 + sw, y - h*0.66, w*0.3, C2);
      eye(x - 4, y - h*0.45, 1.8, '#000', '#ffd36b'); eye(x + 2, y - h*0.45, 1.8, '#000', '#ffd36b');
      break;
    }
    case 'lizard': {
      const run = Math.sin(t*18)*2.5, cy = y - h*0.5;
      ell(x + 2, cy, w*0.4, h*0.45, C);
      ell(x - w*0.42, cy - 1, w*0.16, h*0.38, C);
      poly([x + w*0.38, cy - 2, x + w*0.72, cy + 2 + run, x + w*0.38, cy + 3], C);
      for (const dx of [-6, 6]) line(x + dx, cy + 3, x + dx + run, y, C, 2.5);
      if (L.c2){ c.fillStyle = C2; for (let k = 0; k < 3; k++) c.fillRect(x - 6 + k*6, cy - h*0.45, 3, 2); }
      circ(x - w*0.48, cy - 2, 1.3, L.c2 === '#ff3a5a' ? C2 : '#222');
      if (e.phase === 'tele'){ T.glow(x, y, 16, '#ff3a3a', 0.6); }
      break;
    }
    case 'orb': {
      const cy = y - h/2, r = w/2 - 1;
      if (L.tailFx){ for (let k = 1; k <= 3; k++){ c.globalAlpha = 0.35/k; circ(x + k*8, cy, r*(1 - k*0.15), C); } c.globalAlpha = 1; }
      if (L.fire) T.glow(x, cy, r*2, '#ff6a2a', 0.5);
      c.save(); c.translate(x, cy); c.rotate(-(e.rot || 0) - (e.vy ? t*4 : 0));
      if (FOES2[e.type].traits && FOES2[e.type].traits.includes('spiky')) for (let k = 0; k < 7; k++){ const a = k/7*Math.PI*2; poly([Math.cos(a - 0.3)*r, Math.sin(a - 0.3)*r, Math.cos(a)*(r + 5), Math.sin(a)*(r + 5), Math.cos(a + 0.3)*r, Math.sin(a + 0.3)*r], C2); }
      circ(0, 0, r, C); circ(-r*0.3, -r*0.3, r*0.35, 'rgba(255,255,255,.4)');
      c.restore();
      break;
    }
    case 'imp': {
      const cy = y - h/2, fl = Math.sin(t*20)*4;
      poly([x + 2, cy - 2, x + 13, cy - 8 - fl, x + 9, cy + 3], F || '#5a1a2a');
      ell(x, cy, w*0.34, h*0.4, C);
      poly([x - 6, cy - h*0.3, x - 8, cy - h*0.62, x - 2, cy - h*0.36], C2); poly([x + 4, cy - h*0.3, x + 6, cy - h*0.62, x + 1, cy - h*0.36], C2);
      eye(x - 4, cy - 2, 1.6, '#000', '#ffd36b'); line(x + 5, cy + 4, x + 10, cy + 10, C, 1.5);
      if (e.wind) T.glow(x - 8, cy, 9, '#ff8a3a', 0.8);
      break;
    }
    case 'golem': {
      rr(x - w/2, y - h*0.75, w, h*0.6, 4, C);
      rr(x - w*0.3, y - h, w*0.6, h*0.3, 3, F || shade(L.c, 15));
      rr(x - w/2 - 5, y - h*0.7, 7, h*0.45, 3, C); rr(x + w/2 - 2, y - h*0.7, 7, h*0.45, 3, C);
      rr(x - w*0.35, y - h*0.18, w*0.25, h*0.18, 2, C); rr(x + w*0.1, y - h*0.18, w*0.25, h*0.18, 2, C);
      for (const [dx, dy] of [[-6, -0.55], [5, -0.45], [-1, -0.35]]){ poly([x + dx, y + h*dy - 4, x + dx + 3, y + h*dy, x + dx, y + h*dy + 4, x + dx - 3, y + h*dy], C2); }
      eye(x - 5, y - h*0.85, 1.8, '#000', C2 === F ? '#fff' : '#ffe0f4');
      break;
    }
    case 'crystal': {
      const cy = y - h/2, s = Math.sin(t*3)*2;
      T.glow(x, cy, w, L.c2, 0.4);
      poly([x, cy - h/2 + s, x + w*0.45, cy, x, cy + h/2 - 2, x - w*0.45, cy], C);
      poly([x, cy - h/2 + s, x + w*0.45, cy, x, cy], 'rgba(255,255,255,.35)');
      eye(x - 3, cy - 2, 1.5, '#2a3a6a', '#fff');
      break;
    }
    case 'humanoid': {
      const walk = Math.sin(t*10)*2.5, tele = e.phase === 'tele' || e.wind;
      line(x - 3, y - h*0.3, x - 3 + walk, y, F || shade(L.c, -30), 3); line(x + 3, y - h*0.3, x + 3 - walk, y, F || shade(L.c, -30), 3);
      rr(x - w*0.38, y - h*0.72, w*0.76, h*0.45, 4, L.hood ? C : L.wrap ? C : C);
      if (L.wrap){ c.fillStyle = 'rgba(0,0,0,.15)'; for (let k = 0; k < 4; k++) c.fillRect(x - w*0.38, y - h*0.68 + k*4, w*0.76, 1.2); }
      if (L.skull){ circ(x, y - h*0.82, 7, C); circ(x - 3, y - h*0.84, 1.8, '#111'); circ(x + 2, y - h*0.84, 1.8, '#111'); rr(x - 3, y - h*0.76, 6, 2, 1, '#111'); }
      else if (L.hood){ poly([x - 8, y - h*0.72, x, y - h*1.02, x + 8, y - h*0.72], C); circ(x - 1, y - h*0.8, 4, '#120a20'); circ(x - 3, y - h*0.8, 1.2, C2); circ(x + 0.5, y - h*0.8, 1.2, C2); }
      else { circ(x, y - h*0.82, 6.5, L.stone ? C : '#e8dcb8'); circ(x - 3, y - h*0.83, 1.3, L.stone ? (tele ? '#ff4a3a' : '#3a3020') : '#3a3020'); }
      if (L.shield) rr(x - w*0.62, y - h*0.7, 8, h*0.5, 3, F || C2);
      if (L.hood && e.wind){ T.glow(x - 10, y - h*0.6, 10, L.c2, 0.9); }
      if (L.stone && e.phase === 'idle'){ c.globalAlpha = 0.25; rr(x - w/2, y - h, w, h, 3, '#000'); c.globalAlpha = 1; }
      break;
    }
    case 'ghost': {
      const cy = y - h/2, wv = Math.sin(t*6)*2;
      if (e.under){ ell(x, GY_LINE(y), w*0.5, 3, e.phase === 'tele' ? '#ff4a3a' : C2); break; }
      c.fillStyle = C; c.beginPath(); c.arc(x, cy - h*0.1, w/2, Math.PI, 0); c.lineTo(x + w/2, cy + h*0.4);
      for (let k = 0; k < 4; k++) c.lineTo(x + w/2 - (k + 0.5)*w/4, cy + h*0.3 + (k % 2 ? wv : -wv)); c.lineTo(x - w/2, cy + h*0.4); c.fill();
      eye(x - 4, cy - h*0.12, 1.8, '#000', C2); eye(x + 3, cy - h*0.12, 1.8, '#000', C2);
      break;
    }
    case 'cloud': {
      const cy = y - h/2;
      if (L.star) T.glow(x, cy, w*0.9, L.c2, 0.4);
      for (const [dx, dy, r] of [[-w*0.25, 2, h*0.38], [w*0.2, 2, h*0.4], [0, -h*0.15, h*0.48]]) circ(x + dx, cy + dy, r, C);
      eye(x - 4, cy, 1.6, '#3a4a6a', '#fff'); eye(x + 3, cy, 1.6, '#3a4a6a', '#fff');
      if (L.star){ c.fillStyle = '#fff'; for (let k = 0; k < 4; k++) c.fillRect(x - w*0.3 + k*6, cy - h*0.3 + (k % 2)*6, 1.5, 1.5); }
      break;
    }
    case 'wisp': {
      const cy = y - h/2;
      T.glow(x, cy, w, L.c2, 0.5);
      poly([x - w/2, cy, x + w*0.6, cy - h*0.35 + Math.sin(t*10)*2, x + w*0.6, cy + h*0.35 - Math.sin(t*10)*2], C);
      circ(x - w*0.2, cy, h*0.32, C); eye(x - w*0.28, cy - 1, 1.3, '#1a4030', '#fff');
      break;
    }
    case 'eye': {
      const cy = y - h/2, look = e.wind ? -2 : Math.sin(t*2)*2;
      T.glow(x, cy, w*0.9, L.c2, e.wind ? 0.6 : 0.25);
      circ(x, cy, w/2, C);
      circ(x - 3 + look, cy, w*0.25, C2); circ(x - 4 + look, cy, w*0.11, '#000');
      c.strokeStyle = F || '#c8a0a0'; c.lineWidth = 1; for (let k = 0; k < 3; k++){ c.beginPath(); c.moveTo(x + w*0.4, cy - 3 + k*3); c.lineTo(x + w*0.7, cy - 6 + k*6 + Math.sin(t*6 + k)*2); c.stroke(); }
      break;
    }
    case 'star': {
      const cy = y - h/2, s = 1 + Math.sin(t*12)*0.08, dive = e.phase === 'dive';
      if (dive || e.phase === 'tele'){ for (let k = 1; k <= 3; k++){ c.globalAlpha = 0.3/k; circ(x + k*7, cy - k*4, 6, L.c2); } c.globalAlpha = 1; }
      c.save(); c.translate(x, cy); c.rotate(t*3); c.scale(s, s);
      const pts = []; for (let k = 0; k < 10; k++){ const r = k % 2 ? w*0.22 : w*0.5, a = k/10*Math.PI*2 - Math.PI/2; pts.push(Math.cos(a)*r, Math.sin(a)*r); }
      poly(pts, C); c.restore();
      eye(x - 2, cy, 1.4, '#6a3a1a', '#fff');
      if (e.phase === 'tele') T.bang(x, cy - h - 4, 16);
      break;
    }
    default: rr(x - w/2, y - h, w, h, 4, C);
  }
  c.globalAlpha = 1;
  // 予告：突進・飛び出し・弾
  if ((G.ai === 'charge' || G.ai === 'statue') && e.phase === 'tele') T.bang(x, y - h - 8, 16);
  if (G.ai === 'burrow' && e.phase === 'tele') T.bang(x, y - 22, 16);
}
const GY_LINE = y => y;   // 地中の敵は足もとの高さに土の盛り上がりを描く

// 色を明るく・暗くする（#rrggbb）
function shade(hex, d){
  const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, v + d));
  return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map(v => v.toString(16).padStart(2, '0')).join('');
}

// ---------- 追加のボス ----------
export function drawBossGeneric(ctx, e, F, tools, o){
  c = ctx; T = tools;
  const B = BOSSES[e.boss], x = e.x, y = e.y + (o.lift || 0), w = e.w, h = e.h, t = e.t;
  const hot = o.hot, flashT = o.tele;
  const C = F || (flashT ? shade(B.c, 40) : hot ? shade(B.c, -15) : B.c), C2 = F || (hot ? shade(B.c2, 25) : B.c2);
  const cy = y - h/2;
  if (hot) T.glow(x, cy, Math.max(w, h)*0.9, e.rage ? '#ff3a2a' : B.c2, 0.3);
  switch (B.shape){
    case 'queen': {   // 女王蜂：大きな羽・縞の腹・冠
      const fl = Math.sin(t*26)*8;
      c.globalAlpha = 0.6; ell(x + 6, cy - h*0.35 - fl*0.3, w*0.3, h*0.18, '#e8f6ff', -0.5); ell(x + 14, cy - h*0.3 + fl*0.3, w*0.26, h*0.15, '#e8f6ff', 0.4); c.globalAlpha = 1;
      ell(x + w*0.15, cy + h*0.1, w*0.35, h*0.3, C);
      for (let k = 0; k < 3; k++) rr(x + w*0.02 + k*w*0.12, cy - h*0.15, w*0.05, h*0.5, 3, C2);
      poly([x + w*0.48, cy + h*0.1, x + w*0.62, cy + h*0.2, x + w*0.48, cy + h*0.25], C2);
      ell(x - w*0.2, cy - h*0.05, w*0.2, h*0.25, C);
      poly([x - w*0.3, cy - h*0.28, x - w*0.25, cy - h*0.45, x - w*0.2, cy - h*0.3, x - w*0.15, cy - h*0.45, x - w*0.1, cy - h*0.28], '#ffd36b');
      eye(x - w*0.28, cy - h*0.05, 3.2, '#000', '#ffeaa0');
      break;
    }
    case 'worm': {   // 大砂虫：地面から出た体の節・大きな口
      for (let k = 4; k >= 0; k--){ const sx = x + k*w*0.14, sy = y - h*0.25 - k*h*0.1 + Math.sin(t*3 + k)*3; circ(sx, sy, w*0.28 - k*2, k % 2 ? C2 : C); }
      const hx = x - w*0.1, hy = y - h*0.7 + Math.sin(t*3)*3;
      circ(hx, hy, w*0.32, C);
      c.fillStyle = '#2a0a0a'; c.beginPath(); c.arc(hx - w*0.12, hy + 2, w*0.18, -1.2, 1.2, true); c.fill();
      for (let k = 0; k < 5; k++) poly([hx - w*0.22 + k*4, hy - 6, hx - w*0.2 + k*4, hy - 1, hx - w*0.18 + k*4, hy - 6], '#f3ead2');
      eye(hx, hy - w*0.18, 2.8, '#000', '#ffd36b');
      break;
    }
    case 'treeboss': {   // 森の古木：太い幹・大きな冠・目と口
      const sw = Math.sin(t*2)*2;
      rr(x - w*0.25, y - h*0.65, w*0.5, h*0.65, 6, C);
      for (const dx of [-w*0.3, w*0.3]) line(x + dx*0.6, y - 4, x + dx, y, C, 6);
      circ(x + sw, y - h*0.8, w*0.42, C2); circ(x - w*0.3 + sw, y - h*0.65, w*0.28, C2); circ(x + w*0.32 + sw, y - h*0.68, w*0.28, C2);
      c.fillStyle = shade(B.c2, 30); for (let k = 0; k < 5; k++) circ(x - w*0.3 + k*w*0.15 + sw, y - h*0.85 + (k % 2)*8, 3, shade(B.c2, 30));
      eye(x - 8, y - h*0.45, 3, '#000', '#ffd36b'); eye(x + 6, y - h*0.45, 3, '#000', '#ffd36b');
      rr(x - 8, y - h*0.3, 14, 4, 2, '#2a1a0a');
      break;
    }
    case 'phoenix': {   // 不死鳥：炎の翼と尾
      const fl = Math.sin(t*10)*10;
      T.glow(x, cy, w*0.8, '#ff8a3a', 0.45);
      for (let k = 0; k < 3; k++) poly([x + w*0.2, cy, x + w*0.6 + k*6, cy + h*0.3 + k*6 + Math.sin(t*8 + k)*3, x + w*0.3, cy + h*0.1], k % 2 ? C2 : C);
      poly([x, cy - 4, x + w*0.45, cy - h*0.55 - fl, x + w*0.25, cy + 2], C2);
      ell(x, cy, w*0.3, h*0.3, C);
      poly([x - w*0.05, cy - 4, x + w*0.35, cy - h*0.45 + fl*0.6, x + w*0.15, cy + 4], C);
      circ(x - w*0.28, cy - h*0.2, w*0.13, C);
      poly([x - w*0.4, cy - h*0.22, x - w*0.55, cy - h*0.12, x - w*0.4, cy - h*0.1], '#ffd36b');
      poly([x - w*0.28, cy - h*0.32, x - w*0.2, cy - h*0.6, x - w*0.18, cy - h*0.3], C2);
      eye(x - w*0.31, cy - h*0.22, 2, '#000', '#fff');
      break;
    }
    case 'crystalq': {   // 結晶の女王：結晶のドレスと冠
      T.glow(x, cy, w, B.c2, 0.4);
      poly([x - w*0.5, y, x - w*0.1, cy - h*0.1, x + w*0.1, cy - h*0.1, x + w*0.5, y], C);
      poly([x - w*0.1, cy - h*0.1, x, y, x + w*0.1, cy - h*0.1], 'rgba(255,255,255,.3)');
      circ(x, cy - h*0.3, w*0.18, F || '#e8dcff');
      for (let k = 0; k < 5; k++) poly([x - w*0.2 + k*w*0.1, cy - h*0.42, x - w*0.15 + k*w*0.1, cy - h*0.62 - (k === 2 ? 8 : 0), x - w*0.1 + k*w*0.1, cy - h*0.42], C2);
      for (const s of [-1, 1]) poly([x + s*w*0.15, cy - h*0.15, x + s*w*0.6, cy - h*0.4 + Math.sin(t*3)*4, x + s*w*0.3, cy], C);
      eye(x - 4, cy - h*0.3, 2, '#4a2a8a', '#fff'); eye(x + 3, cy - h*0.3, 2, '#4a2a8a', '#fff');
      break;
    }
    case 'pharaoh': {   // ファラオ：金の頭巾と杖
      rr(x - w*0.3, y - h*0.65, w*0.6, h*0.65, 5, F || '#f3ead2');
      rr(x - w*0.3, y - h*0.45, w*0.6, 5, 2, C);
      poly([x - w*0.4, y - h*0.65, x - w*0.28, y - h, x + w*0.28, y - h, x + w*0.4, y - h*0.65], C2);
      for (let k = 0; k < 4; k++) rr(x - w*0.38, y - h*0.92 + k*7, w*0.76, 2.5, 1, C);
      circ(x, y - h*0.78, w*0.2, F || '#c8a070');
      eye(x - 5, y - h*0.8, 2.2, '#000', '#fff'); eye(x + 4, y - h*0.8, 2.2, '#000', '#fff');
      line(x - w*0.5, y, x - w*0.45, y - h*0.85, C, 4); circ(x - w*0.45, y - h*0.88, 6, C2);
      if (o.tele) T.glow(x - w*0.45, y - h*0.88, 14, '#9fe3ff', 0.8);
      break;
    }
    case 'storm': {   // 嵐の王：雷雲の体と稲妻
      for (const [dx, dy, r] of [[-w*0.25, 0, h*0.35], [w*0.2, h*0.05, h*0.38], [0, -h*0.2, h*0.45], [w*0.35, -h*0.15, h*0.3]]) circ(x + dx, cy + dy, r, C);
      eye(x - 9, cy - 4, 3.2, '#000', C2); eye(x + 5, cy - 4, 3.2, '#000', C2);
      if (Math.sin(t*7) > 0.6 || o.tele){ c.strokeStyle = C2; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x - 8, cy + h*0.3); c.lineTo(x - 2, cy + h*0.45); c.lineTo(x - 7, cy + h*0.5); c.lineTo(x, cy + h*0.7); c.stroke(); T.glow(x, cy + h*0.5, 14, B.c2, 0.6); }
      break;
    }
    case 'bigeye': {   // 深淵の瞳：巨大な目と触手
      for (let k = 0; k < 6; k++){ const a = Math.PI*0.2 + k*0.32; c.strokeStyle = F || shade(B.c2, -40); c.lineWidth = 4; c.beginPath(); c.moveTo(x + Math.cos(a)*w*0.35, cy + Math.sin(a)*h*0.35); c.quadraticCurveTo(x + Math.cos(a)*w*0.6, cy + Math.sin(a)*h*0.7, x + Math.cos(a + Math.sin(t*3 + k)*0.3)*w*0.7, cy + Math.sin(a)*h*0.85); c.stroke(); }
      circ(x, cy, w*0.45, C);
      c.strokeStyle = 'rgba(200,58,74,.5)'; c.lineWidth = 1.2; for (let k = 0; k < 5; k++){ const a = k*1.3; c.beginPath(); c.moveTo(x + Math.cos(a)*w*0.44, cy + Math.sin(a)*w*0.44); c.lineTo(x + Math.cos(a + 0.2)*w*0.25, cy + Math.sin(a + 0.2)*w*0.25); c.stroke(); }
      const lk = o.tele ? -4 : Math.sin(t*1.5)*3;
      circ(x - 4 + lk, cy, w*0.22, C2); circ(x - 5 + lk, cy, w*0.1, '#000'); circ(x - 8 + lk, cy - 4, 2.5, '#fff');
      break;
    }
    case 'knight': {   // 虚無の騎士：鎧・兜・大剣
      const walk = Math.sin(t*4)*1.5;
      rr(x - w*0.3, y - h*0.25, w*0.22, h*0.25, 3, C); rr(x + w*0.08, y - h*0.25, w*0.22, h*0.25, 3, C);
      rr(x - w*0.4, y - h*0.7, w*0.8, h*0.48, 6, C);
      rr(x - w*0.4, y - h*0.5, w*0.8, 4, 2, C2);
      rr(x - w*0.28, y - h*0.95, w*0.56, h*0.28, 8, C);
      rr(x - w*0.25, y - h*0.85, w*0.3, 4, 2, '#0a0614'); circ(x - w*0.15, y - h*0.83, 2.2, C2);
      poly([x - w*0.1, y - h*0.95, x, y - h*1.12, x + w*0.1, y - h*0.95], C2);
      c.save(); c.translate(x - w*0.45, y - h*0.5 + walk); c.rotate(o.tele ? -0.9 : -0.2); rr(-3, -h*0.6, 6, h*0.6, 2, F || '#cfd3e8'); rr(-8, -4, 16, 4, 2, C2); c.restore();
      if (o.tele) T.glow(x - w*0.5, y - h*0.9, 14, B.c2, 0.8);
      break;
    }
    case 'chimera': {   // キマイラ：獅子の頭・山羊の角・蛇の尾
      const run = Math.sin(t*6)*3;
      for (const dx of [-0.3, -0.12, 0.15, 0.32]) line(x + dx*w, cy + h*0.15, x + dx*w + run, y, F || shade(B.c, -30), 6);
      ell(x + w*0.05, cy, w*0.42, h*0.3, C);
      c.strokeStyle = C2; c.lineWidth = 5; c.beginPath(); c.moveTo(x + w*0.42, cy); c.quadraticCurveTo(x + w*0.7, cy - h*0.5, x + w*0.5, cy - h*0.6); c.stroke();
      circ(x + w*0.5, cy - h*0.62, 6, C2); circ(x + w*0.47, cy - h*0.64, 1.4, '#ff3a2a');
      circ(x - w*0.35, cy - h*0.15, w*0.22, F || '#d8a050');
      circ(x - w*0.38, cy - h*0.1, w*0.15, C);
      poly([x - w*0.3, cy - h*0.35, x - w*0.15, cy - h*0.7, x - w*0.18, cy - h*0.3], '#e8dcc0');
      eye(x - w*0.45, cy - h*0.15, 2.4, '#000', '#ffd36b');
      if (o.tele) T.glow(x - w*0.55, cy - h*0.05, 12, '#ff8a3a', 0.8);
      break;
    }
    case 'starbeast': {   // 星喰い：星空の体・光る角・たくさんの目
      T.glow(x, cy, Math.max(w, h)*0.9, '#6a4ac8', 0.5);
      ell(x, cy + h*0.05, w*0.48, h*0.42, C);
      c.fillStyle = '#fff'; for (let k = 0; k < 14; k++){ const a = k*2.4, r = (k*7 % 10)/10*w*0.4; c.globalAlpha = 0.5 + 0.5*Math.sin(t*3 + k); c.fillRect(x + Math.cos(a)*r, cy + Math.sin(a)*r*0.8, 1.8, 1.8); } c.globalAlpha = 1;
      for (const s of [-1, 1]) poly([x + s*w*0.15, cy - h*0.3, x + s*w*0.35, cy - h*0.75 + Math.sin(t*2)*3, x + s*w*0.28, cy - h*0.25], C2);
      for (const [dx, dy] of [[-0.22, -0.08], [-0.05, -0.15], [0.12, -0.05], [-0.12, 0.08]]) eye(x + dx*w, cy + dy*h, 3, '#2a1a6a', C2);
      poly([x - w*0.3, cy + h*0.25, x - w*0.2, cy + h*0.4, x - w*0.1, cy + h*0.25], '#f3ead2');
      break;
    }
    default: rr(x - w/2, y - h, w, h, 6, C);
  }
}
