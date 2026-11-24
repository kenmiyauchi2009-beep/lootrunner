// タイトル画面（起動したときだけ）。タップで音を有効にして拠点へ。
// 背景は主人公が丘を走り続ける絵。1秒に30回だけ描き、閉じたら止める。
import { $ } from './util.js';
import { RAR } from './data.js';
import { SAVE } from './save.js';
import { unlockAudio, playBgm } from './audio.js';
import { drawCape, drawHelmet, drawTrim } from './hero.js';
import { kickCamp } from './camp.js';

let timer = 0, t0 = 0, cv, c, W, H;

function circ(x, y, r, col){ c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI*2); c.fill(); }
function hills(col, off, base, amp, f){
  c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
  for (let x = 0; x <= W + 10; x += 10){ const wx = x + off; c.lineTo(x, base - amp*(0.6*Math.sin(wx*f) + 0.4*Math.sin(wx*f*2.3 + 1.7))); }
  c.lineTo(W, H); c.fill();
}
function frame(){
  const t = (performance.now() - t0)/1000, px = t*150;
  const gy = H*0.74;
  const g = c.createLinearGradient(0, 0, 0, gy);
  g.addColorStop(0, '#2a3a78'); g.addColorStop(0.55, '#e8875a'); g.addColorStop(1, '#ffd6a0');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.globalAlpha = 0.5; circ(W*0.5, gy - 30, 90, '#ffcf8a'); c.globalAlpha = 1; circ(W*0.5, gy - 30, 46, '#fff0c8');
  c.fillStyle = '#fff';
  for (let i = 0; i < 30; i++){ c.globalAlpha = 0.3 + 0.3*Math.sin(t*2 + i); c.fillRect((i*97.3) % W, (i*41.7) % (H*0.3), 1.5, 1.5); }
  c.globalAlpha = 1;
  hills('#8a5a6a', px*0.12, gy - 50, 40, 0.008);
  hills('#5a4058', px*0.3, gy - 14, 26, 0.014);
  c.fillStyle = '#3c3046'; c.fillRect(0, gy, W, H - gy);
  c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(0, gy, W, 3);
  c.fillStyle = '#2c2436'; for (let x = -(px % 40); x < W; x += 40) c.fillRect(x, gy + 12, 18, 4);
  // 走る主人公（大きめ）
  const s = Math.min(3, Math.max(2, W/180)), hx = W*0.32, run = t*15, bob = Math.abs(Math.sin(run))*2;
  c.save(); c.translate(hx, gy - bob*s*0.3); c.scale(s, s);
  drawCape(c, 0, 0, t, 1);
  c.strokeStyle = '#1e1a28'; c.lineWidth = 4; c.lineCap = 'round';
  for (const [i, a] of [Math.sin(run)*0.8, -Math.sin(run)*0.8].entries()){ c.beginPath(); c.moveTo(-2 + i*4, -10); c.lineTo(-2 + i*4 + Math.sin(a)*8, -1); c.stroke(); }
  const b = SAVE.equip.body;
  c.fillStyle = b ? RAR[b.r].c : '#3d8bd9'; c.beginPath(); c.roundRect(-8, -27, 16, 18, 4); c.fill();
  drawTrim(c, 0, 0, t);
  circ(1, -32, 7, '#f6d2a8');
  c.fillStyle = '#5a3a22'; c.beginPath(); c.arc(0, -34, 7.5, Math.PI*1.05, Math.PI*2.05); c.fill();
  circ(4, -32, 1.3, '#222');
  drawHelmet(c, 0, 0);
  const w = SAVE.equip.weapon;
  c.strokeStyle = w ? RAR[w.r].c : '#ddd'; c.lineWidth = 3.5; c.beginPath(); c.moveTo(7, -18); c.lineTo(7 + Math.cos(-1)*18, -18 + Math.sin(-1)*18); c.stroke();
  c.restore();
  // 跳ねるスライムと金貨
  for (let i = 0; i < 3; i++){
    const x = ((W + 200) - ((px*1.0 + i*260) % (W + 200))) - 60, j = Math.abs(Math.sin(t*4 + i))*10*s/2.5;
    c.fillStyle = '#6ccf5e'; c.beginPath(); c.ellipse(x, gy - 8*s/2.5 - j, 11*s/2.5, 9*s/2.5, 0, 0, Math.PI*2); c.fill();
    circ(x - 3*s/2.5, gy - 10*s/2.5 - j, 1.6*s/2.5, '#123');
  }
  for (let i = 0; i < 6; i++){
    const x = ((W + 100) - ((px + i*90) % (W + 100))) - 20, y = gy - 70 - Math.sin(i*1.7)*30;
    const ww = Math.abs(Math.cos(t*6 + i))*5 + 1;
    c.fillStyle = '#ffd36b'; c.beginPath(); c.ellipse(x, y, ww, 5.5, 0, 0, Math.PI*2); c.fill();
  }
}
function size(){
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  W = cv.clientWidth; H = cv.clientHeight;
  cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr);
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function tick(){ timer = 0; if ($('title').classList.contains('hidden') || document.hidden) return; frame(); timer = setTimeout(tick, 33); }

export function showTitle(version){
  const el = $('title');
  cv = $('titleCv'); c = cv.getContext('2d'); t0 = performance.now();
  el.classList.remove('hidden');
  $('titleVer').textContent = version ? `版 ${version}` : '';
  size(); frame();
  if (!SAVE.settings.eco) tick();
  const re = () => { if (!el.classList.contains('hidden')){ size(); frame(); } };
  window.addEventListener('resize', () => { re(); setTimeout(re, 250); setTimeout(re, 700); });
  if (window.ResizeObserver) new ResizeObserver(re).observe(cv);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !el.classList.contains('hidden') && !timer && !SAVE.settings.eco) tick(); });
  el.addEventListener('pointerdown', start, {once:true});
  document.addEventListener('keydown', start, {once:true});
}
function start(){
  const el = $('title');
  if (el.classList.contains('hidden')) return;
  unlockAudio(); playBgm('base');
  el.classList.add('out');
  setTimeout(() => { el.classList.add('hidden'); el.classList.remove('out'); clearTimeout(timer); timer = 0; kickCamp(); }, 350);
}
export function hideTitle(){ const el = $('title'); if (!el.classList.contains('hidden')){ el.classList.add('hidden'); clearTimeout(timer); timer = 0; } }
