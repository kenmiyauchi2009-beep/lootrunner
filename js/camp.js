// 拠点の村の絵：施設が建物として並び、レベルで育つ（空き地→テント→小屋→家→石造り）。主人公は装備・マントを着て立つ。
// 動き（たき火・旗・煙）は拠点の画面が見えているときだけ、1秒に10回描く。省電力モードでは止める。
import { RAR } from './data.js';
import { SAVE } from './save.js';
import { FACILITIES, facLv, canUpgradeFac } from './meta.js';
import { drawCape, drawHelmet, drawTrim } from './hero.js';

const FAC_IDS = Object.keys(FACILITIES);
// 施設ごとの色（屋根・布）
export const FAC_C = {train:'#c8743c', smith:'#6f7684', store:'#a07a48', dojo:'#b8423c', vault:'#d9a93a'};
// 見た目の段階（0：空き地 1：テント 2：小屋 3：家 4：石造り）
export const stageOf = (id, l = facLv(id)) => l <= 0 ? 0 : Math.max(1, Math.ceil(l / FACILITIES[id].max * 4));
export const STAGE_N = ['空き地', 'テント', '小屋', '家', '石造り'];

function rr(c, x, y, w, h, r, col){ c.fillStyle = col; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); }
function circ(c, x, y, r, col){ c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI*2); c.fill(); }
function tri(c, x1, y1, x2, y2, x3, y3, col){ c.fillStyle = col; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x3, y3); c.fill(); }

// 時刻で空の色を変える（朝・昼・夕・夜）
export function skyNow(h = new Date().getHours()){
  if (h >= 5 && h < 8)   return {k:'dawn',  sky:['#f6b48a', '#fde2c0'], hill:'#9fb79a', ground:'#6c9a55', night:false};
  if (h >= 8 && h < 16)  return {k:'day',   sky:['#7fc8f0', '#d4efff'], hill:'#9cc9b0', ground:'#5f9a4c', night:false};
  if (h >= 16 && h < 19) return {k:'eve',   sky:['#e5794c', '#ffc98e'], hill:'#b0866e', ground:'#5d7f42', night:false};
  return {k:'night', sky:['#0f1a38', '#2d3f6e'], hill:'#24345a', ground:'#2e4a36', night:true};
}

// 1つの建物。x：中心、gy：地面、s：縮尺、t：時間、night：夜は窓が灯る
export function drawBuilding(c, id, l, x, gy, s = 1, t = 0, night = false){
  const st = stageOf(id, l), col = FAC_C[id], max = l >= FACILITIES[id].max;
  c.save(); c.translate(x, gy); c.scale(s, s);
  // 地面の影
  c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(0, 1, 26, 3.5, 0, 0, Math.PI*2); c.fill();
  const win = night ? '#ffd98a' : '#3b4a5a';
  if (st === 0){
    // 空き地：杭と縄、立て札
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.setLineDash([3, 3]); c.lineWidth = 1;
    c.strokeRect(-20, -14, 40, 14); c.setLineDash([]);
    for (const px of [-20, 20]){ rr(c, px - 1.2, -9, 2.4, 9, 1, '#8a6440'); }
    rr(c, -1, -18, 2, 18, 1, '#8a6440'); rr(c, -9, -24, 18, 10, 2, '#b08a5a');
    c.fillStyle = '#4a3420'; c.font = 'bold 8px sans-serif'; c.textAlign = 'center'; c.fillText('?', 0, -16.5);
  } else if (st === 1){
    // テント
    tri(c, -18, 0, 0, -26, 18, 0, col);
    tri(c, 0, -26, 18, 0, 6, 0, 'rgba(0,0,0,.18)');
    tri(c, -5, 0, 0, -12, 5, 0, '#2a2018');
    rr(c, -0.8, -30, 1.6, 6, 0.5, '#8a6440');
  } else if (st === 2){
    // 小屋
    rr(c, -17, -20, 34, 20, 1, '#9a7148');
    c.fillStyle = 'rgba(0,0,0,.12)'; for (let i = 0; i < 4; i++) c.fillRect(-17, -16 + i*5, 34, 0.8);
    tri(c, -21, -19, 0, -34, 21, -19, col);
    rr(c, -4, -12, 8, 12, 1, '#4a3420');
    rr(c, 8, -15, 6, 5, 1, win);
  } else if (st === 3){
    // 家
    rr(c, -21, -28, 42, 28, 1.5, '#c9b08a');
    c.fillStyle = 'rgba(0,0,0,.1)'; c.fillRect(-21, -28, 42, 3);
    tri(c, -25, -27, 0, -45, 25, -27, col);
    tri(c, 0, -45, 25, -27, 8, -27, 'rgba(0,0,0,.15)');
    rr(c, -5, -15, 10, 15, 1.5, '#5a3e26');
    for (const wx of [-15, 9]){ rr(c, wx, -22, 7, 7, 1, win); c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(wx + 3, -22, 1, 7); }
  } else {
    // 石造り
    rr(c, -25, -34, 50, 34, 1.5, '#a9aeb4');
    c.fillStyle = 'rgba(0,0,0,.1)';
    for (let r = 0; r < 5; r++) for (let k = 0; k < 6; k++) c.fillRect(-25 + k*9 + (r % 2)*4, -32 + r*7, 0.8, 6);
    for (let r = 0; r < 5; r++) c.fillRect(-25, -27 + r*7, 50, 0.8);
    tri(c, -29, -33, 0, -52, 29, -33, col);
    tri(c, 0, -52, 29, -33, 10, -33, 'rgba(0,0,0,.15)');
    rr(c, -6, -18, 12, 18, 6, '#4a3420');
    for (const wx of [-19, 11]){ rr(c, wx, -27, 8, 9, 3, win); }
    // 旗
    rr(c, -0.8, -66, 1.6, 15, 0.5, '#6b5a3a');
    const wv = Math.sin(t*4)*1.5;
    c.fillStyle = max ? '#ffd36b' : col;
    c.beginPath(); c.moveTo(0.8, -66); c.quadraticCurveTo(7, -64 + wv, 12, -63 + wv); c.lineTo(0.8, -59); c.fill();
  }
  // 施設ごとの小物（段階で大きくなる）
  if (st > 0) drawProp(c, id, st, t);
  if (night && st >= 2){   // 窓の明かり
    c.globalAlpha = 0.18; circ(c, st === 2 ? 11 : 0, st === 2 ? -12 : -20, st === 2 ? 9 : 18, '#ffcf70'); c.globalAlpha = 1;
  }
  c.restore();
}
function drawProp(c, id, st, t){
  const k = 0.6 + st*0.13;
  c.save();
  if (id === 'train'){   // 的
    c.translate(26, 0); c.scale(k, k);
    rr(c, -1, -18, 2, 18, 1, '#8a6440');
    circ(c, 0, -20, 8, '#f3ead2'); circ(c, 0, -20, 5.5, '#c8403c'); circ(c, 0, -20, 3, '#f3ead2'); circ(c, 0, -20, 1.3, '#c8403c');
  } else if (id === 'smith'){   // 金床と火
    c.translate(-27, 0); c.scale(k, k);
    rr(c, -7, -9, 14, 4, 1, '#55595f'); rr(c, -3, -5, 6, 5, 1, '#45484d');
    const f = 0.7 + 0.3*Math.sin(t*12);
    c.globalAlpha = 0.5*f; circ(c, -10, -4, 6, '#ff8a3a'); c.globalAlpha = 1;
    circ(c, -10, -3, 2.5*f, '#ffd36b');
    // 煙突の煙（大きい建物から）
    if (st >= 3){
      for (let i = 0; i < 3; i++){
        const p = (t*0.4 + i/3) % 1;
        c.globalAlpha = 0.35*(1 - p); circ(c, 38 + p*6, -58 - p*26, 3 + p*5, '#cfd3d8');
      }
      c.globalAlpha = 1;
    }
  } else if (id === 'store'){   // 木箱
    c.translate(25, 0); c.scale(k, k);
    const n = Math.min(4, st);
    const pos = [[-6, 0], [5, 0], [0, -10], [-6, -20]];
    for (let i = 0; i < n; i++){ const [px, py] = pos[i]; rr(c, px - 5, py - 10, 10, 10, 1, '#b08a5a'); c.strokeStyle = '#6a4e30'; c.lineWidth = 1; c.strokeRect(px - 5, py - 10, 10, 10); c.beginPath(); c.moveTo(px - 5, py - 10); c.lineTo(px + 5, py); c.stroke(); }
  } else if (id === 'dojo'){   // のぼり旗
    c.translate(-26, 0); c.scale(k, k);
    rr(c, -0.8, -34, 1.6, 34, 0.5, '#6b5a3a');
    const wv = Math.sin(t*3)*1.2;
    c.fillStyle = '#f3ead2'; c.beginPath(); c.moveTo(1, -33); c.lineTo(9 + wv, -32); c.lineTo(9 + wv*0.5, -12); c.lineTo(1, -12); c.fill();
    c.fillStyle = '#b8423c'; c.font = 'bold 7px sans-serif'; c.textAlign = 'center'; c.fillText('道', 5 + wv*0.4, -19);
  } else if (id === 'vault'){   // 金貨の山
    c.translate(26, 0); c.scale(k, k);
    c.fillStyle = '#d9a93a'; c.beginPath(); c.ellipse(0, 0, 10, 6 + st, 0, Math.PI, 0); c.fill();
    c.fillStyle = '#ffe08a'; for (let i = 0; i < 5; i++) c.fillRect(-7 + i*3.2, -3 - (i % 2)*3 - st, 2, 1.4);
    if (Math.sin(t*4) > 0.4){ c.fillStyle = '#fff'; c.fillRect(3, -8 - st, 1.5, 1.5); }
  }
  c.restore();
}

// 立っている主人公（拠点用）
export function drawStandingHero(c, x, y, t){
  const breathe = Math.sin(t*2)*0.6;
  drawCape(c, x, y, t, 0.25);
  c.strokeStyle = '#2b2f3a'; c.lineWidth = 4; c.lineCap = 'round';
  for (const dx of [-2.5, 2.5]){ c.beginPath(); c.moveTo(x + dx, y - 10); c.lineTo(x + dx, y - 1); c.stroke(); }
  const b = SAVE.equip.body;
  rr(c, x - 8, y - 27 + breathe, 16, 18 - breathe, 4, b ? RAR[b.r].c : '#3d8bd9');
  rr(c, x - 8, y - 15, 16, 3, 1, 'rgba(0,0,0,.25)');
  drawTrim(c, x, y + breathe, t);
  circ(c, x + 1, y - 32 + breathe, 7, '#f6d2a8');
  c.fillStyle = '#5a3a22'; c.beginPath(); c.arc(x, y - 34 + breathe, 7.5, Math.PI*1.05, Math.PI*2.05); c.fill();
  circ(c, x + 4, y - 32 + breathe, 1.3, '#222');
  drawHelmet(c, x, y + breathe);
  // 武器（右手に持つ）
  const w = SAVE.equip.weapon, col = w ? RAR[w.r].c : '#ccc', hx = x + 8, hy = y - 17;
  c.lineCap = 'round';
  if (!w || w.type === 'sword' || w.type === 'dagger'){
    const len = w && w.type === 'dagger' ? 10 : 18;
    c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + 2, hy - len); c.stroke();
    c.strokeStyle = '#6b5a3a'; c.lineWidth = 2; c.beginPath(); c.moveTo(hx - 3.5, hy - 1); c.lineTo(hx + 3.5, hy - 1); c.stroke();
  } else if (w.type === 'axe'){
    c.strokeStyle = '#7a5a3a'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(hx, hy + 4); c.lineTo(hx + 1, hy - 18); c.stroke();
    c.fillStyle = col; c.beginPath(); c.arc(hx + 1, hy - 16, 7, -0.4, 1.6); c.lineTo(hx + 1, hy - 16); c.fill();
  } else if (w.type === 'bow'){
    c.strokeStyle = col; c.lineWidth = 2.5; c.beginPath(); c.arc(hx - 2, hy - 2, 11, -1.3, 1.3); c.stroke();
    c.strokeStyle = '#eee'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(hx - 2 + Math.cos(-1.3)*11, hy - 2 + Math.sin(-1.3)*11); c.lineTo(hx - 2 + Math.cos(1.3)*11, hy - 2 + Math.sin(1.3)*11); c.stroke();
  } else {
    c.strokeStyle = '#7a5a3a'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(hx, hy + 8); c.lineTo(hx + 2, hy - 16); c.stroke();
    c.globalAlpha = 0.35 + 0.15*Math.sin(t*3); circ(c, hx + 2, hy - 19, 8, '#8fd8ff'); c.globalAlpha = 1;
    circ(c, hx + 2, hy - 19, 4, col);
  }
  if (w && w.r >= 3){ c.globalAlpha = 0.2 + 0.08*Math.sin(t*4); circ(c, hx + 5, hy - 14, 7, col); c.globalAlpha = 1; }
}

// ---------- 拠点の村（canvas） ----------
let cv = null, cx = null, W = 0, H = 0, timer = 0, lastDraw = 0, t0 = performance.now();
let hits = [];          // タップの当たり判定 {id, x0, x1, y0, y1}
let fx = null;          // 強化したときのきらめき {id, t}
let active = () => false;   // 動かしてよいか（拠点のタブが見えているか）は base.js から渡す

export function setupCamp(canvas, isActive){
  cv = canvas; cx = cv.getContext('2d'); active = isActive;
  window.addEventListener('resize', () => { if (active()) drawCamp(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kickCamp(); });
}
export function campHit(px, py){
  for (const h of hits) if (px >= h.x0 && px <= h.x1 && py >= h.y0 && py <= h.y1) return h.id;
  return null;
}
export function campFx(id){ fx = {id, t:2.2}; kickCamp(); }

function size(){
  const r = cv.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1) * (SAVE.settings.eco ? 0.75 : 1);
  W = Math.max(1, r.width); H = Math.max(1, r.height);
  const w = Math.round(W*dpr), h = Math.round(H*dpr);
  if (cv.width !== w || cv.height !== h){ cv.width = w; cv.height = h; }
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function drawCamp(){
  if (!cv || !cv.isConnected || !cv.offsetParent) return;
  size();
  const c = cx, t = (performance.now() - t0)/1000, S = skyNow();
  const gy = H*0.58;
  // 空
  const g = c.createLinearGradient(0, 0, 0, gy);
  g.addColorStop(0, S.sky[0]); g.addColorStop(1, S.sky[1]);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  if (S.night){
    c.fillStyle = '#fff';
    for (let i = 0; i < 40; i++){ const sx = (i*97.3) % W, sy = (i*53.7) % (gy*0.8); c.globalAlpha = 0.4 + 0.4*Math.sin(t*1.5 + i); c.fillRect(sx, sy, 1.2, 1.2); }
    c.globalAlpha = 1; circ(c, W*0.62, gy*0.22, 11, '#f3ecd0'); circ(c, W*0.62 + 4, gy*0.22 - 3, 10, S.sky[0]);
  } else {
    circ(c, W*0.62, gy*0.24, 13, S.k === 'eve' ? '#ffe0a0' : '#fff6d0');
    c.fillStyle = 'rgba(255,255,255,.5)';
    for (let i = 0; i < 3; i++){ const x = ((i*160 + t*4) % (W + 80)) - 40, y = 18 + i*16; c.beginPath(); c.ellipse(x, y, 22, 6, 0, 0, Math.PI*2); c.ellipse(x + 12, y - 4, 12, 6, 0, 0, Math.PI*2); c.fill(); }
  }
  // 遠くの山
  c.fillStyle = S.hill; c.beginPath(); c.moveTo(0, gy);
  for (let x = 0; x <= W + 10; x += 10) c.lineTo(x, gy - 26 - 14*Math.sin(x*0.018 + 1) - 8*Math.sin(x*0.047));
  c.lineTo(W, gy); c.fill();
  // 地面と道
  c.fillStyle = S.ground; c.fillRect(0, gy, W, H - gy);
  c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(0, gy, W, 2);
  c.fillStyle = S.night ? '#5a4a36' : '#c9a774';
  c.beginPath(); c.moveTo(0, H*0.86); c.quadraticCurveTo(W*0.5, H*0.76, W, H*0.88); c.lineTo(W, H*0.98); c.quadraticCurveTo(W*0.5, H*0.88, 0, H*0.97); c.fill();
  // 建物（奥の列）
  hits = [];
  const n = FAC_IDS.length, sc = Math.min(1.45, W / 330, H / 215) * 0.95;   // 幅と高さの両方に合わせて大きくする
  FAC_IDS.forEach((id, i) => {
    const x = W*(i + 0.5)/n, l = facLv(id);
    drawBuilding(c, id, l, x, gy, sc, t + i, S.night);
    // 名前とLv
    const up = canUpgradeFac(id);
    c.font = `bold ${Math.round(10*Math.max(0.9, sc))}px -apple-system, sans-serif`; c.textAlign = 'center';
    const label = `${FACILITIES[id].n} ${l ? 'Lv' + l : ''}`.trim();
    const tw = c.measureText(label).width + 10;
    rr(c, x - tw/2, gy + 4, tw, 15, 7.5, 'rgba(0,0,0,.45)');
    c.fillStyle = '#fff'; c.fillText(label, x, gy + 15);
    if (up){   // 強化できる：小さな矢印が上下する（点滅はしない）
      const by = gy - 62*sc - 6 + Math.sin(t*3)*2;
      c.fillStyle = '#ffb547'; c.beginPath(); c.moveTo(x, by - 6); c.lineTo(x + 5, by); c.lineTo(x - 5, by); c.fill();
      c.fillRect(x - 1.6, by, 3.2, 4);
    }
    hits.push({id, x0:x - W/n/2, x1:x + W/n/2, y0:gy - 70*sc, y1:gy + 20});
  });
  // 主人公とたき火（手前）。建物と同じ割合で大きくする
  const hs = sc/0.95, hx = W*0.5 - 16*hs, hy = H*0.94;
  c.save(); c.translate(W*0.5, hy); c.scale(hs, hs);
  const fxX = 22, x0 = -16;
  c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(x0, 1, 10, 3, 0, 0, Math.PI*2); c.fill();
  for (const a of [-0.5, 0.5]){ c.save(); c.translate(fxX, 0); c.rotate(a); rr(c, -9, -2, 18, 4, 2, '#6a4a2a'); c.restore(); }
  const fl = 0.75 + 0.25*Math.sin(t*11) + 0.1*Math.sin(t*17);
  c.globalAlpha = 0.35; circ(c, fxX, -6, 16*fl, '#ff9a3a'); c.globalAlpha = 1;
  tri(c, fxX - 6, 0, fxX, -15*fl, fxX + 6, 0, '#ff7a2a');
  tri(c, fxX - 3, 0, fxX, -9*fl, fxX + 3, 0, '#ffd36b');
  c.translate(x0, 0); c.scale(1.2, 1.2); drawStandingHero(c, 0, 0, t);
  c.restore();
  hits.push({id:'hero', x0:hx - 20*hs, x1:hx + 20*hs, y0:hy - 54*hs, y1:hy + 4});
  // 強化したときのきらめき
  if (fx){
    const i = FAC_IDS.indexOf(fx.id), x = W*(i + 0.5)/n, a = Math.min(1, fx.t);
    for (let k = 0; k < 10; k++){
      const ang = k/10*Math.PI*2 + t*2, r = 18 + (2.2 - fx.t)*16;
      c.globalAlpha = a; c.fillStyle = '#ffe9a8'; c.fillRect(x + Math.cos(ang)*r, gy - 28*sc + Math.sin(ang)*r*0.6, 2.5, 2.5);
    }
    c.font = 'bold 13px -apple-system, sans-serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.5)';
    const ty = gy - 64*sc - (2.2 - fx.t)*12;
    c.strokeText('Lv UP!', x, ty); c.fillStyle = '#ffd36b'; c.fillText('Lv UP!', x, ty);
    c.globalAlpha = 1;
  }
}

// 1秒に10回だけ描く（requestAnimationFrame は1秒に60回起きるので、タイマーで間引く）。
// 見えていないとき・省電力モードでは止まる（強化のきらめきの間だけは動かす）
const animate = () => !SAVE.settings.eco || fx;
function tick(){
  timer = 0;
  if (!active() || document.hidden) return;
  const now = performance.now(), dt = Math.min(0.2, (now - lastDraw)/1000);
  lastDraw = now;
  if (fx && (fx.t -= dt) <= 0) fx = null;
  drawCamp();
  if (animate()) timer = setTimeout(tick, 100);
}
export function kickCamp(){
  if (!cv) return;
  if (!active() || document.hidden){ stopCamp(); return; }
  drawCamp();
  if (!timer && animate()){ lastDraw = performance.now(); timer = setTimeout(tick, 100); }
}
export function stopCamp(){ if (timer){ clearTimeout(timer); timer = 0; } }
