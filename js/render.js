// 冒険の描画
import { fmt } from './util.js';
import { RAR, DROP_FX, ELITE_MODS, BOSSES, ZONES } from './data.js';
import { drawCape, drawHelmet, drawTrim } from './hero.js';
import { drawSkillIcon } from './skillart.js';
import { drawFoe2, drawBossGeneric } from './foeart.js';
import { FOES2 } from './foes.js';
import { SAVE } from './save.js';
import { GY, PX, R, ctx, VW, SCALE, DPR, OY, VTOP, VBOT, zone, zoneIdx, zoneAt, bossName, bossTotal, elv, BOSS_LIMIT, ORB, PILLAR, VENT, ventState, BEAM, CHARGE, WARD } from './run.js';
import { ACTIVES, PASSIVES } from './skills.js';

// 見た目だけに使う乱数（ゲームの乱数 Math.random を消費しない）
let vs = 1;
const vr = (a, b) => { vs = (vs * 16807) % 2147483647; return a + (vs / 2147483647) * (b - a); };

// 光のぼかしは shadowBlur が重いので、あらかじめ描いた画像を使い回す
const glowCache = new Map();
function glowImg(c){
  let g = glowCache.get(c);
  if (!g){
    g = document.createElement('canvas'); g.width = g.height = 64;
    const x = g.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, c); gr.addColorStop(0.35, c + '99'); gr.addColorStop(1, c + '00');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    glowCache.set(c, g);
  }
  return g;
}
// L0：見えている左端（ゲーム内の x）。横持ちのボス戦で手前をずらしたとき（R.camX）に左へ広がる
let L0 = -10;
// bgA：背景を切り替えるとき（前のエリアの景色を薄く重ねる）の不透明度
let bgA = 1;
function glow(x, y, r, c, a = 1){ ctx.globalAlpha = a*bgA; ctx.drawImage(glowImg(c), x - r, y - r, r*2, r*2); ctx.globalAlpha = bgA; }

function hills(col, off, base, amp, f){
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-10, GY);
  for (let x=-10; x<=VW+10; x+=10){ const wx = x + off; ctx.lineTo(x, base - amp*(0.6*Math.sin(wx*f) + 0.4*Math.sin(wx*f*2.3 + 1.7))); }
  ctx.lineTo(VW+10, GY); ctx.closePath(); ctx.fill();
}
function rr(x, y, w, h, r, c){ ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
function circ(x, y, r, c){ ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill(); }
function outlined(txt, x, y, c){ ctx.strokeText(txt, x, y); ctx.fillStyle = c; ctx.fillText(txt, x, y); }

// 背景：空・雲・エリアごとの遠景・丘・地面。a：不透明度（切り替えのとき）
function drawBg(Z, a){
  bgA = a; ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(0, Math.min(0, VTOP), 0, GY);
  g.addColorStop(0, Z.sky[0]); g.addColorStop(1, Z.sky[1]);
  ctx.fillStyle = g; ctx.fillRect(-10, VTOP - 10, VW + 20, GY - VTOP + 10);
  drawDeco(Z, a);
  // 雲（ゆっくり流れる）
  ctx.fillStyle = Z.cloud || 'rgba(255,255,255,.45)';
  for (let i=0;i<5;i++){
    const span = VW + 160, cx = ((i*173 - R.px*0.05*(1 + i*0.15)) % span + span) % span - 80;
    const cy = VTOP + 50 + ((i*3) % 5) * (115 - VTOP - 50) / 5;   // 画面上端から遠くの山の上まで
    ctx.beginPath(); ctx.ellipse(cx, cy, 26 + (i%3)*8, 8, 0, 0, Math.PI*2); ctx.ellipse(cx + 14, cy - 6, 16, 9, 0, 0, Math.PI*2); ctx.fill();
  }
  hills(Z.far, R.px*0.15, 160, 40, 0.012);
  drawMid(Z);
  hills(Z.near, R.px*0.45, 205, 26, 0.02);
  ctx.fillStyle = Z.ground; ctx.fillRect(-10, GY, VW + 20, VBOT - GY + 10);
  ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(-10, GY, VW + 20, 3);
  ctx.fillStyle = Z.dirt; const off = R.px % 40;
  for (let x=-off; x<VW; x+=40) ctx.fillRect(x, GY+12, 18, 4);
  if (VBOT - GY > 70){
    // 縦持ちのときの地中（ログ欄の背景）
    const ug = ctx.createLinearGradient(0, GY + 26, 0, VBOT);
    ug.addColorStop(0, Z.dirt); ug.addColorStop(0.35, 'rgba(8,12,14,.92)'); ug.addColorStop(1, '#0b0f12');
    ctx.fillStyle = ug; ctx.fillRect(-10, GY + 26, VW + 20, VBOT - GY - 16);
  }
  bgA = 1; ctx.globalAlpha = 1;
}
const wrapX = (x, span) => ((x % span) + span) % span;
// いちばん奥の景色（空のすぐ前）：太陽・月・星・火山
function drawDeco(Z, a){
  const d = Z.deco, t = R.t;
  if (d === 'meadow'){
    glow(VW*0.78, VTOP + 46, 40, '#fff6c0', 0.7); circ(VW*0.78, VTOP + 46, 13, '#fffbe0');
  } else if (d === 'mesa'){
    glow(VW*0.3, 138, 70, '#ffd08a', 0.8); circ(VW*0.3, 138, 20, '#ffe2a8');
  } else if (d === 'forest'){
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 26; i++){ const x = wrapX(i*61.7 - R.px*0.01, VW + 20) - 10, y = VTOP + 8 + (i*37.3) % 110; ctx.globalAlpha = a*(0.35 + 0.35*Math.sin(t*2 + i)); ctx.fillRect(x, y, 1.4, 1.4); }
    ctx.globalAlpha = a;
    glow(VW*0.72, VTOP + 50, 36, '#dfe8ff', 0.5); circ(VW*0.72, VTOP + 50, 14, '#eef2ff'); circ(VW*0.72 + 5, VTOP + 46, 12, Z.sky[0]);
  } else if (d === 'volcano'){
    const vx = wrapX(VW*0.62 - R.px*0.012, VW + 200) - 70;
    ctx.fillStyle = '#4a1a14'; ctx.beginPath(); ctx.moveTo(vx - 110, 160); ctx.lineTo(vx - 22, 72); ctx.lineTo(vx + 22, 72); ctx.lineTo(vx + 110, 160); ctx.fill();
    glow(vx, 72, 34, '#ff6a2a', 0.6 + 0.2*Math.sin(t*3));
    ctx.fillStyle = '#ff7a2a'; ctx.beginPath(); ctx.moveTo(vx - 22, 72); ctx.lineTo(vx + 22, 72); ctx.lineTo(vx + 12, 90); ctx.lineTo(vx + 4, 80); ctx.lineTo(vx - 8, 96); ctx.fill();
    // 煙と火の粉
    for (let i = 0; i < 5; i++){ const q = (t*0.12 + i/5) % 1; ctx.globalAlpha = a*0.35*(1 - q); circ(vx + q*30 + Math.sin(q*6 + i)*6, 66 - q*80, 8 + q*18, '#3a2424'); }
    for (let i = 0; i < 10; i++){ const q = (t*0.4 + i/10) % 1; ctx.globalAlpha = a*(1 - q); ctx.fillStyle = '#ffb36a'; ctx.fillRect(vx + Math.sin(i*7.1)*20 + q*14, 72 - q*90, 1.6, 1.6); }
  }
  else if (d === 'crystal'){   // 結晶の洞窟：天井から下がる結晶・光る粒
    ctx.fillStyle = '#120a24';
    ctx.beginPath(); ctx.moveTo(-10, VTOP - 10);
    for (let x = -10; x <= VW + 20; x += 18){ const wx = x + R.px*0.04; ctx.lineTo(x, VTOP + 18 + 14*Math.abs(Math.sin(wx*0.05)) + 8*Math.sin(wx*0.13)); }
    ctx.lineTo(VW + 20, VTOP - 10); ctx.fill();
    for (let i = 0; i < 7; i++){
      const x = wrapX(i*83 - R.px*0.06, VW + 80) - 40, len = 26 + (i*13) % 30, c = i % 2 ? '#8a6cff' : '#c8a6ff';
      ctx.fillStyle = c; ctx.globalAlpha = a*0.8; ctx.beginPath(); ctx.moveTo(x - 6, VTOP + 20); ctx.lineTo(x, VTOP + 20 + len); ctx.lineTo(x + 6, VTOP + 20); ctx.fill();
      glow(x, VTOP + 20 + len, 10, c, 0.4 + 0.2*Math.sin(t*2 + i));
    }
    ctx.globalAlpha = a;
    for (let i = 0; i < 16; i++){ const x = wrapX(i*47 - R.px*0.02, VW + 20) - 10, y = VTOP + 60 + (i*37) % 110; glow(x, y + Math.sin(t + i)*4, 3, '#d8c8ff', 0.5); }
  } else if (d === 'ruins'){   // 古代の遺跡：大きな夕日と、崩れた柱の影
    glow(VW*0.66, 120, 60, '#ffe2a0', 0.8); circ(VW*0.66, 120, 22, '#fff0c8');
    ctx.fillStyle = 'rgba(120,80,40,.35)';
    for (let i = 0; i < 5; i++){ const x = wrapX(i*130 - R.px*0.05, VW + 150) - 60, hgt = 50 + (i*29) % 40; ctx.fillRect(x, 160 - hgt, 14, hgt); ctx.fillRect(x - 4, 160 - hgt - 6, 22, 6); }
  } else if (d === 'sky'){   // 天空の島：浮かぶ島と、下に広がる雲
    for (let i = 0; i < 3; i++){
      const x = wrapX(i*220 - R.px*0.04, VW + 260) - 120, y = VTOP + 70 + i*28 + Math.sin(t*0.6 + i)*4;
      ctx.fillStyle = '#8fc27a'; ctx.beginPath(); ctx.ellipse(x, y, 44, 9, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#a58a6a'; ctx.beginPath(); ctx.moveTo(x - 40, y); ctx.lineTo(x, y + 34); ctx.lineTo(x + 40, y); ctx.fill();
      circ(x - 12, y - 10, 8, '#6aa760'); circ(x + 10, y - 12, 10, '#5f9d58');
    }
  } else if (d === 'abyss'){   // 深淵：暗闇に浮かぶ赤い目
    for (let i = 0; i < 6; i++){
      const x = wrapX(i*111 - R.px*0.03, VW + 120) - 60, y = VTOP + 40 + (i*53) % 120, open = Math.max(0, Math.sin(t*0.8 + i*1.7));
      if (open < 0.1) continue;
      ctx.globalAlpha = a*open; ctx.fillStyle = '#ff3a5a';
      ctx.beginPath(); ctx.ellipse(x, y, 5, 2.2*open, 0, 0, Math.PI*2); ctx.ellipse(x + 14, y, 5, 2.2*open, 0, 0, Math.PI*2); ctx.fill();
      glow(x + 7, y, 16, '#ff3a5a', 0.35*open);
    }
    ctx.globalAlpha = a;
  } else if (d === 'stars'){   // 星の海：星雲と、たくさんの星
    glow(VW*0.3, VTOP + 70, 90, '#6a4ac8', 0.35); glow(VW*0.75, VTOP + 110, 70, '#c84a9a', 0.25);
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 50; i++){ const x = wrapX(i*37.3 - R.px*0.008, VW + 20) - 10, y = VTOP + 5 + (i*29.7) % 170; ctx.globalAlpha = a*(0.3 + 0.5*Math.abs(Math.sin(t*1.5 + i))); ctx.fillRect(x, y, i % 7 ? 1.3 : 2.2, i % 7 ? 1.3 : 2.2); }
    ctx.globalAlpha = a;
    const sx = wrapX(-R.t*120, VW + 300) - 100; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx, VTOP + 30); ctx.lineTo(sx + 30, VTOP + 42); ctx.stroke();
  }
  ctx.globalAlpha = a;
}
// 遠い丘と近い丘のあいだの景色：木・岩山とサボテン・針葉樹・岩
function drawMid(Z){
  const d = Z.deco, off = R.px*0.3;
  if (d === 'meadow'){
    for (let i = 0; i < 6; i++){
      const x = wrapX(i*97 - off, VW + 120) - 60, y = 186 - (i % 3)*4;
      ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x - 1.5, y - 10, 3, 12);
      circ(x, y - 16, 10 - (i % 2)*2, '#4f8f5a'); circ(x - 6, y - 12, 7, '#5a9d64'); circ(x + 6, y - 12, 7, '#4a8752');
    }
    // 風車
    const wx = wrapX(260 - off*0.7, VW + 300) - 120;
    ctx.fillStyle = '#e8e0d0'; ctx.beginPath(); ctx.moveTo(wx - 7, 190); ctx.lineTo(wx - 4, 150); ctx.lineTo(wx + 4, 150); ctx.lineTo(wx + 7, 190); ctx.fill();
    ctx.strokeStyle = '#f6f2e8'; ctx.lineWidth = 2.5;
    for (let k = 0; k < 4; k++){ const ang = R.t*1.2 + k*Math.PI/2; ctx.beginPath(); ctx.moveTo(wx, 152); ctx.lineTo(wx + Math.cos(ang)*20, 152 + Math.sin(ang)*20); ctx.stroke(); }
  } else if (d === 'mesa'){
    ctx.fillStyle = '#b87a58';
    for (let i = 0; i < 3; i++){
      const x = wrapX(i*190 - off, VW + 260) - 120, w = 70 + (i % 2)*40, h = 34 + (i*13) % 24;
      ctx.beginPath(); ctx.moveTo(x - w/2 - 12, 200); ctx.lineTo(x - w/2, 200 - h); ctx.lineTo(x + w/2, 200 - h); ctx.lineTo(x + w/2 + 12, 200); ctx.fill();
    }
    ctx.fillStyle = '#5f7a44';
    for (let i = 0; i < 4; i++){
      const x = wrapX(i*131 + 60 - off*1.2, VW + 120) - 60, y = 204;
      ctx.fillRect(x - 2.5, y - 22, 5, 22); ctx.fillRect(x - 9, y - 14, 4, 8); ctx.fillRect(x - 9, y - 10, 8, 3); ctx.fillRect(x + 5, y - 18, 4, 8); ctx.fillRect(x + 2, y - 12, 7, 3);
    }
  } else if (d === 'forest'){
    for (let i = 0; i < 9; i++){
      const x = wrapX(i*57 - off, VW + 80) - 40, h = 40 + (i*17) % 22, y = 200;
      ctx.fillStyle = i % 2 ? '#1a2a45' : '#16243d';
      ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + 13, y - h*0.45); ctx.lineTo(x + 7, y - h*0.45); ctx.lineTo(x + 16, y); ctx.lineTo(x - 16, y); ctx.lineTo(x - 7, y - h*0.45); ctx.lineTo(x - 13, y - h*0.45); ctx.fill();
    }
    // 蛍
    for (let i = 0; i < 6; i++){ const x = wrapX(i*83 - off*1.3 + Math.sin(R.t + i)*10, VW + 40) - 20, y = 175 + Math.sin(R.t*1.3 + i*2)*12; glow(x, y, 5, '#d8ff8a', 0.5 + 0.4*Math.sin(R.t*3 + i)); }
  } else if (d === 'volcano'){
    ctx.fillStyle = '#2a1210';
    for (let i = 0; i < 5; i++){
      const x = wrapX(i*120 - off, VW + 160) - 80, h = 24 + (i*11) % 20;
      ctx.beginPath(); ctx.moveTo(x - 30, 205); ctx.lineTo(x - 8, 205 - h); ctx.lineTo(x + 4, 205 - h*0.8); ctx.lineTo(x + 30, 205); ctx.fill();
    }
    ctx.fillStyle = '#ff7a2a';
    for (let i = 0; i < 4; i++){ const x = wrapX(i*150 + 40 - off, VW + 160) - 80; ctx.globalAlpha = bgA*(0.5 + 0.3*Math.sin(R.t*4 + i)); ctx.fillRect(x - 10, 203, 20, 2); }
    ctx.globalAlpha = bgA;
  } else if (d === 'crystal'){   // 地面から生える結晶
    for (let i = 0; i < 6; i++){
      const x = wrapX(i*101 - off, VW + 120) - 60, hgt = 20 + (i*17) % 22, c = i % 2 ? '#7a5ae0' : '#a98aff';
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - 8, 204); ctx.lineTo(x - 3, 204 - hgt); ctx.lineTo(x + 3, 204 - hgt - 6); ctx.lineTo(x + 8, 204); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.moveTo(x - 3, 204 - hgt); ctx.lineTo(x + 3, 204 - hgt - 6); ctx.lineTo(x, 204); ctx.fill();
    }
  } else if (d === 'ruins'){   // 石の柱とアーチ
    ctx.fillStyle = '#c8a878';
    for (let i = 0; i < 4; i++){
      const x = wrapX(i*160 - off, VW + 200) - 100, broken = i % 2;
      ctx.fillRect(x, 160 + (broken ? 18 : 0), 12, 44 - (broken ? 18 : 0)); ctx.fillRect(x + 40, 160, 12, 44);
      if (!broken){ ctx.fillRect(x - 4, 154, 60, 8); }
      ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(x + 8, 160, 4, 44); ctx.fillStyle = '#c8a878';
    }
  } else if (d === 'sky'){   // 雲の海
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 8; i++){ const x = wrapX(i*70 - off*0.8, VW + 100) - 50; ctx.beginPath(); ctx.ellipse(x, 200 + (i % 3)*3, 36, 12, 0, 0, Math.PI*2); ctx.fill(); }
  } else if (d === 'abyss'){   // ねじれた枯れ木
    ctx.strokeStyle = '#2a1a2e'; ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++){
      const x = wrapX(i*117 - off, VW + 140) - 70;
      ctx.beginPath(); ctx.moveTo(x, 205); ctx.quadraticCurveTo(x - 6, 180, x + 4, 160); ctx.moveTo(x + 1, 178); ctx.lineTo(x + 14, 168); ctx.moveTo(x - 2, 188); ctx.lineTo(x - 14, 176); ctx.stroke();
    }
  } else if (d === 'stars'){   // 浮かぶ光の欠片
    for (let i = 0; i < 8; i++){ const x = wrapX(i*67 - off, VW + 80) - 40, y = 185 + Math.sin(R.t*1.5 + i)*8; glow(x, y, 6, i % 2 ? '#ffe9a8' : '#a8c8ff', 0.6); }
  }
}

export function draw(){
  if (!R) return;
  const amp = R.shake > 0 ? R.shakeAmp : 0;
  const sx = amp ? vr(-amp, amp) : 0, sy = amp ? vr(-amp, amp) : 0;
  const k = DPR*SCALE;
  ctx.setTransform(k, 0, 0, k, sx*k, (OY + sy)*k);
  const Z = zone();

  // 空・遠景・地面（エリアが変わるときは、前のエリアの景色を少しずつ消して切り替える）
  drawBg(Z, 1);
  const zc = R.zoneCard;
  if (zc && zc.from){
    const age = zc.max - zc.t - (zc.delay || 0);
    const a = age < 0 ? 1 : Math.max(0, 1 - age/1.4);
    if (a > 0) drawBg(zc.from, a);
  }
  // 横持ちのボス戦：主人公とボスのまん中が画面の中央に来るよう、景色より手前を右へずらす（R.camX。背景はずらさない）
  const camT = R.boss && VW > 360 ? Math.max(0, VW/2 - (PX + (R.boss.stopX ?? R.boss.x))/2) : 0;
  R.camX = (R.camX || 0) + (camT - (R.camX || 0)) * 0.08;
  if (Math.abs(R.camX) < 0.5 && !camT) R.camX = 0;
  L0 = -10 - R.camX;
  ctx.translate(R.camX, 0);
  // ドロップの光の柱
  for (const f of R.fx) if (f.kind==='pillar'){
    const F = DROP_FX[f.r], c = RAR[f.r].c, a = Math.min(1, f.t/f.max * 1.6);
    const top = F.h ? GY - F.h : VTOP;
    const pg = ctx.createLinearGradient(0, top, 0, GY);
    pg.addColorStop(0, c + '00'); pg.addColorStop(1, c);
    ctx.globalAlpha = a*0.75; ctx.fillStyle = pg; ctx.fillRect(f.x - F.w/2, top, F.w, GY - top);
    ctx.globalAlpha = a*0.9; ctx.fillStyle = '#ffffffaa'; ctx.fillRect(f.x - F.w*0.15, top + (GY - top)*0.3, F.w*0.3, (GY - top)*0.7);
    ctx.globalAlpha = 1;
    glow(f.x, GY - 4, 10 + F.w, c, a);
  }

  // エリアの仕掛け（流砂・火柱の噴き出し口）
  drawHazards();
  // 予告：ボスの攻撃・岩の落下地点
  if (R.boss) drawBossTele(R.boss);
  for (const s of R.eshots) if (s.kind==='rock' && !s.rolling){
    const q = Math.max(0, s.t / s.T);   // 1→0 で着弾
    const r = 7 + 20*q;
    ctx.strokeStyle = `rgba(255,80,60,${0.35 + 0.6*(1-q)})`; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(s.tx, GY + 1, r, r*0.32, 0, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = `rgba(255,80,60,${0.15 + 0.35*(1-q)})`;
    ctx.beginPath(); ctx.ellipse(s.tx, GY + 1, 7, 2.4, 0, 0, Math.PI*2); ctx.fill();
  }

  // 燃える地面（火炎瓶）
  for (const f of R.sk.patches){
    const a = Math.min(1, f.t / 0.4), fl = 0.75 + 0.25*Math.sin(R.t*20 + f.x);
    ctx.globalAlpha = 0.55*a; ctx.fillStyle = '#ff6a1a'; ctx.fillRect(f.x - f.w/2, GY - 3, f.w, 6); ctx.globalAlpha = 1;
    for (let x = f.x - f.w/2 + 6; x < f.x + f.w/2; x += 12){
      const h = (10 + 8*Math.sin(R.t*14 + x)) * fl * a;
      glow(x, GY - h*0.5, h*0.8, '#ff8a3a', 0.8*a);
    }
  }

  // 影（高さが読めるように）
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  for (const e of R.enemies){
    const hgt = GY - e.y, s = Math.max(0.35, 1 - hgt/140);
    ctx.beginPath(); ctx.ellipse(e.x, GY + 1, e.w*0.5*s, 3*s, 0, 0, Math.PI*2); ctx.fill();
  }
  { const s = Math.max(0.35, 1 - (GY - R.p.y)/140); ctx.beginPath(); ctx.ellipse(PX, GY + 1, 10*s, 3*s, 0, 0, Math.PI*2); ctx.fill(); }

  for (const e of R.enemies) drawEnemy(e);
  drawPlayer();
  drawSkills();

  // 自分の弾
  for (const s of R.shots){
    if (s.kind==='arrow'){
      const a = Math.atan2(s.vy, s.vx), ca = Math.cos(a), sa = Math.sin(a);
      // 残像
      for (let i=3;i>=1;i--){
        ctx.strokeStyle = `rgba(243,234,210,${0.32/i})`; ctx.lineWidth = 2;
        const bx = s.x - s.vx*0.016*i, by = s.y - s.vy*0.016*i;
        ctx.beginPath(); ctx.moveTo(bx - ca*12, by - sa*12); ctx.lineTo(bx, by); ctx.stroke();
      }
      ctx.strokeStyle = '#f3ead2'; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(s.x - ca*13, s.y - sa*13); ctx.lineTo(s.x, s.y); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.beginPath();
      ctx.moveTo(s.x + ca*4, s.y + sa*4); ctx.lineTo(s.x - ca*2 - sa*3, s.y - sa*2 + ca*3); ctx.lineTo(s.x - ca*2 + sa*3, s.y - sa*2 - ca*3); ctx.fill();
    } else if (s.kind==='orb'){
      glow(s.x - s.vx*0.03, s.y - s.vy*0.03, 9, '#8fd8ff', 0.45);
      glow(s.x, s.y, 15, '#8fd8ff', 0.9);
      circ(s.x, s.y, 4.5, '#e6f8ff');
    } else if (s.kind==='missile'){
      glow(s.x - s.vx*0.025, s.y - s.vy*0.025, 8, '#d08bff', 0.5);
      glow(s.x, s.y, 11, '#d08bff', 0.9);
      circ(s.x, s.y, 3, '#f6e6ff');
    } else if (s.kind==='wave'){
      glow(s.x - 6, s.y, 18, '#bfe6ff', 0.5);
      ctx.strokeStyle = 'rgba(210,240,255,.9)'; ctx.lineWidth = 3; ctx.beginPath();
      ctx.arc(s.x - 10, s.y, 16, -1.1, 1.1); ctx.stroke();
    }
  }
  // 敵の弾
  for (const s of R.eshots){
    if (s.kind==='rock'){
      circ(s.x, s.y, s.r, s.big ? '#7d756a' : '#8b8378');
      const sp = s.spin || 0, k = s.r / 7;
      circ(s.x + Math.cos(sp)*3*k, s.y + Math.sin(sp)*3*k, 2*k, '#a9a197'); circ(s.x - Math.cos(sp)*2.5*k, s.y - Math.sin(sp)*2.5*k, 1.5*k, '#6f685e');
    } else if (s.kind==='orb'){
      const c = s.fire ? '#ff8a3a' : s.hi ? '#7ab8ff' : '#ff6a9a';
      glow(s.x + 8, s.y, s.r*1.6, c, 0.35); glow(s.x, s.y, s.r*2.4, c, 0.9); circ(s.x, s.y, s.r*0.6, '#fff');
    } else if (s.kind==='beam'){
      const q = s.t / s.max, c = s.hi ? '#9cc8ff' : '#ff8ab0', th = BEAM.th * (0.6 + 0.4*Math.sin(R.t*40)*0.5 + 0.4);
      ctx.globalAlpha = 0.5*Math.min(1, q*3); ctx.fillStyle = c; ctx.fillRect(L0, s.y - th, s.x1 - L0, th*2);
      ctx.globalAlpha = Math.min(1, q*3); ctx.fillStyle = '#ffffff'; ctx.fillRect(L0, s.y - th*0.3, s.x1 - L0, th*0.6);
      ctx.globalAlpha = 1; glow(s.x1, s.y, 18, c, 0.9);
    } else if (s.kind==='pillar'){
      if (s.tele > 0){
        const q = 1 - s.tele / PILLAR.tele, bl = Math.sin(R.t*30) > 0;
        ctx.fillStyle = `rgba(255,${bl ? 90 : 140},40,${0.35 + 0.5*q})`;
        ctx.beginPath(); ctx.ellipse(s.x, GY + 1, PILLAR.w/2 + 4, 3 + 2*q, 0, 0, Math.PI*2); ctx.fill();
        glow(s.x, GY - 2, 10 + 10*q, '#ff6a2a', 0.4 + 0.5*q);
      } else drawFlame(s.x, PILLAR.w, PILLAR.h, s.act / PILLAR.act);
    } else { const wg = ctx.createLinearGradient(0, GY - s.h, 0, GY); wg.addColorStop(0,'rgba(255,200,90,0)'); wg.addColorStop(1,'#ffb347');
      ctx.fillStyle = wg; ctx.fillRect(s.x - s.w/2, GY - s.h, s.w, s.h); }
  }
  // 霧（森）。予告の「！」は霧の上に描く
  if (R.fog > 0.02) drawFog();

  // 演出
  for (const f of R.fx){
    const a = Math.max(0, f.t/(f.max||1));
    if (f.kind==='slash') drawSlash(f, a);
    else if (f.kind==='boom'){
      glow(f.x, f.y, f.r*1.2, f.c || '#a0dcff', a*0.7);
      ctx.strokeStyle = f.c ? `rgba(255,150,100,${a})` : `rgba(170,225,255,${a})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, f.r*(1.1 - a*0.5), 0, Math.PI*2); ctx.stroke();
    } else if (f.kind==='skybolt'){
      ctx.strokeStyle = `rgba(255,250,190,${a})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(f.x + vr(-10,10), VTOP);
      for (let y = VTOP + 30; y < f.y; y += 30) ctx.lineTo(f.x + vr(-9,9), y);
      ctx.lineTo(f.x, f.y); ctx.stroke();
      glow(f.x, f.y, 22, '#fff27a', a);
    } else if (f.kind==='frost'){
      glow(f.x, f.y, f.r, '#9fe3ff', a*0.35);
      ctx.strokeStyle = `rgba(200,240,255,${a})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(f.x, f.y, f.r*(1.05 - a*0.35), 0, Math.PI*2); ctx.stroke();
    } else if (f.kind==='quake'){
      ctx.strokeStyle = `rgba(240,210,150,${a})`; ctx.lineWidth = 4; ctx.beginPath();
      ctx.ellipse(f.x, GY, f.r*(1.1 - a*0.6), 7*(1.1 - a*0.5), 0, 0, Math.PI*2); ctx.stroke();
    } else if (f.kind==='ring'){
      ctx.strokeStyle = `rgba(${f.c},${a})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(f.x, f.y, f.r*(1.3 - a*0.6), 0, Math.PI*2); ctx.stroke();
    } else if (f.kind==='bolt'){
      ctx.strokeStyle = `rgba(200,235,255,${a})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(...f.pts[0]);
      for (let i=1;i<f.pts.length;i++){ const [x0,y0] = f.pts[i-1], [x1,y1] = f.pts[i];
        ctx.lineTo((x0+x1)/2 + vr(-8,8), (y0+y1)/2 + vr(-8,8)); ctx.lineTo(x1, y1); }
      ctx.stroke();
    } else if (f.kind==='part'){
      ctx.globalAlpha = a; ctx.fillStyle = f.c; ctx.fillRect(f.x-2, f.y-2, 4, 4); ctx.globalAlpha = 1;
    } else if (f.kind==='coin'){   // 金貨（くるくる回る）
      const w = Math.abs(Math.cos(R.t*12 + f.vx)) * 3.5 + 0.6;
      ctx.globalAlpha = Math.min(1, a*2); ctx.fillStyle = '#ffd36b'; ctx.beginPath(); ctx.ellipse(f.x, f.y, w, 3.6, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff3c0'; ctx.fillRect(f.x - 0.6, f.y - 2, 1.2, 1.6); ctx.globalAlpha = 1;
    } else if (f.kind==='beam'){   // 光線
      const w = f.w * (0.4 + a*0.6);
      ctx.globalAlpha = a*0.45; ctx.fillStyle = '#fff6c8'; ctx.fillRect(f.x, f.y - w, VW - f.x + 20, w*2);
      ctx.globalAlpha = a; ctx.fillStyle = '#ffffff'; ctx.fillRect(f.x, f.y - w*0.3, VW - f.x + 20, w*0.6);
      ctx.globalAlpha = 1; glow(f.x, f.y, 16, '#fff6c8', a);
    }
  }
  if (R.bossFx) drawBossKill(R.bossFx);
  // 時の砂：画面を少し紫に
  if (R.sk.slowT > 0){ ctx.globalAlpha = Math.min(0.18, R.sk.slowT*0.3) * (R.sk.slowF < 0.3 ? 1.5 : 1); ctx.fillStyle = '#9a7dff'; ctx.fillRect(L0, VTOP, VW + 20, VBOT - VTOP); ctx.globalAlpha = 1; }
  // ダメージ数字（会心は大きく、出た瞬間に弾む）
  ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.6)';
  for (const t of R.texts){
    const a = t.t/t.max, age = t.max - t.t;
    const pop = t.big ? 1 + 0.7*Math.max(0, 1 - age/0.12) : 1;
    ctx.globalAlpha = Math.min(1, a*1.5);
    ctx.font = `bold ${Math.round((t.big ? 17 : t.small ? 9 : 12) * pop)}px -apple-system, sans-serif`;
    outlined(t.txt, t.x, t.y - (1-a)*24, t.c);
  }
  ctx.globalAlpha = 1;

  // ここから画面座標
  ctx.setTransform(k, 0, 0, k, 0, 0);
  const H = VBOT - VTOP;
  if (R.flash){ ctx.globalAlpha = 0.45 * R.flash.t / R.flash.max; ctx.fillStyle = R.flash.c; ctx.fillRect(0, 0, VW, H); ctx.globalAlpha = 1; }
  if (R.hurtFx > 0){
    ctx.strokeStyle = `rgba(255,40,40,${0.5 * R.hurtFx / 0.3})`; ctx.lineWidth = 22;
    ctx.strokeRect(0, 0, VW, H);
  }
  drawHUD(H);
}

function drawSkills(){
  const S = R.sk;
  // 聖域（足元の光の輪）
  if (S.auraR){
    const r = S.auraR, pulse = 0.5 + 0.5*Math.sin(R.t*6), cy = R.p.y - 15;
    glow(PX, cy, r, S.evo.aura ? '#fff0a8' : '#fff6d0', 0.16 + 0.06*pulse);
    ctx.strokeStyle = `rgba(255,240,170,${0.35 + 0.2*pulse})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(PX, cy, r, 0, Math.PI*2); ctx.stroke();
  }
  // 地雷
  for (const m of S.mines){
    const blink = m.arm > 0 ? 0.4 : Math.sin(R.t*10 + m.x) > 0 ? 1 : 0.5;
    rr(m.x - 7, GY - 4, 14, 5, 2, '#4a3a33');
    circ(m.x, GY - 4, 2.2, `rgba(255,120,80,${blink})`);
  }
  // ブーメラン
  for (const b of S.booms){
    if (b.t < 0) continue;
    glow(b.x, b.y, b.r*1.6, b.big ? '#ffe08a' : '#ffc46b', 0.5);
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.spin);
    ctx.strokeStyle = b.big ? '#fff0b0' : '#ffc46b'; ctx.lineWidth = b.big ? 4 : 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, b.r*0.8, 0.3, Math.PI - 0.3); ctx.stroke();
    ctx.restore();
  }
  // 障壁（自分を包む泡）
  if (S.shield > 0){
    const cy = R.p.y - 15, pulse = 0.5 + 0.5*Math.sin(R.t*5);
    ctx.strokeStyle = `rgba(143,216,255,${0.55 + 0.3*pulse})`; ctx.lineWidth = S.shield > 1 ? 3 : 2;
    ctx.beginPath(); ctx.arc(PX, cy, 22, 0, Math.PI*2); ctx.stroke();
    glow(PX, cy, 26, '#8fd8ff', 0.18);
  }
  // 回転刃
  const ev = S.evo.blade;
  for (const [x, y, a] of S.blades){
    glow(x, y, ev ? 13 : 10, ev ? '#ffe9a8' : '#cfe8ff', 0.6);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a*3);
    ctx.fillStyle = ev ? '#fff3c8' : '#e8f4ff';
    ctx.beginPath(); for (let i=0;i<3;i++){ const b = i*2.094; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(b)*7, Math.sin(b)*7); ctx.lineTo(Math.cos(b + 0.9)*3, Math.sin(b + 0.9)*3); } ctx.fill();
    ctx.restore();
  }
  // 火炎瓶・流星
  for (const f of S.flasks){ circ(f.x, f.y, 3.5, '#ffb07a'); glow(f.x, f.y, 8, '#ff8a3a', 0.6); }
  for (const m of S.meteors){
    ctx.strokeStyle = 'rgba(255,190,120,.5)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(m.x - 10, m.y - 40); ctx.lineTo(m.x, m.y); ctx.stroke();
    glow(m.x, m.y, 14, '#ffb070', 1); circ(m.x, m.y, 4, '#fff0d8');
  }
  // 経験値の結晶
  for (const g of S.gems){
    const r = g.v >= 4 ? 4.5 : g.v >= 2 ? 3.5 : 2.8, c = g.v >= 4 ? '#7affc8' : '#6fd3ff';
    glow(g.x, g.y, r*2.6, c, 0.5);
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(g.x, g.y - r); ctx.lineTo(g.x + r*0.7, g.y); ctx.lineTo(g.x, g.y + r); ctx.lineTo(g.x - r*0.7, g.y); ctx.fill();
  }
}

function drawSlash(f, a){
  // 弧を描く斬撃。範囲の付与効果で大きく、攻撃速度で速くなる
  const prog = 1 - a, r = f.r;
  if (f.thin){   // 短剣：細い突きの線
    ctx.strokeStyle = f.c; ctx.globalAlpha = Math.min(1, a*2); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(PX + 10, R.p.y - 17); ctx.lineTo(PX + 10 + r*(0.4 + prog*0.6), R.p.y - 17 + (f.flip ? -4 : 4)); ctx.stroke();
    ctx.globalAlpha = 1; return;
  }
  const a0 = f.flip ? 1.25 : -1.45, dir = f.flip ? -1 : 1;
  const sweep = 2.7 * Math.min(1, prog*2.2);
  const s0 = a0 + dir*Math.max(0, sweep - 1.3), s1 = a0 + dir*sweep;
  ctx.save(); ctx.translate(PX + 2, R.p.y - 15);
  const lo = Math.min(s0,s1), hi = Math.max(s0,s1);
  const sg = ctx.createRadialGradient(0, 0, r*0.25, 0, 0, r);
  sg.addColorStop(0, f.c + '00'); sg.addColorStop(0.75, f.c + '88'); sg.addColorStop(1, f.c + 'dd');
  ctx.globalAlpha = Math.min(1, a*1.8);
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(0, 0, r, lo, hi); ctx.arc(0, 0, r*0.3, hi, lo, true); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = Math.min(1, a*1.8);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, 0, r, lo, hi); ctx.stroke();
  ctx.restore(); ctx.globalAlpha = 1;
}

function drawPlayer(){
  const p = R.p, x = PX, y = p.y;
  if (p.inv > 0 && Math.floor(p.inv*16) % 2) return;
  const air = y < GY, run = R.t*15;
  ctx.strokeStyle = '#2b2f3a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  drawCape(ctx, x, y, R.t, air ? 1.2 : 1);
  const legs = air ? [0.6, -0.4] : [Math.sin(run)*0.8, -Math.sin(run)*0.8];
  for (const [i,a] of legs.entries()){ ctx.beginPath(); ctx.moveTo(x - 2 + i*4, y - 10); ctx.lineTo(x - 2 + i*4 + Math.sin(a)*8, y - 1); ctx.stroke(); }
  rr(x - 8, y - 27, 16, 18, 4, SAVE.equip.body ? RAR[SAVE.equip.body.r].c : '#3d8bd9');
  rr(x - 8, y - 15, 16, 3, 1, 'rgba(0,0,0,.25)');
  drawTrim(ctx, x, y, R.t);
  circ(x + 1, y - 32, 7, '#f6d2a8');
  ctx.fillStyle = '#5a3a22'; ctx.beginPath(); ctx.arc(x, y - 34, 7.5, Math.PI*1.05, Math.PI*2.05); ctx.fill();
  circ(x + 4, y - 32, 1.3, '#222');
  drawHelmet(ctx, x, y);
  // 武器
  const w = SAVE.equip.weapon, c = w ? RAR[w.r].c : '#ccc', hx = x + 7, hy = y - 18;
  if (w && w.r >= 3) glow(hx + 6, hy - 8, 16, c, 0.55);
  ctx.strokeStyle = c; ctx.lineCap = 'round';
  const t = p.swing > 0 ? 1 - p.swing/p.swingMax : 0;
  if (R.st.type==='sword'){
    const a = p.swing > 0 ? -1.9 + t*2.9 : -1.0;
    const len = 18 + (w ? w.up : 0)*0.6 + R.st.rangeP*0.1;
    ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(a)*len, hy + Math.sin(a)*len); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#6b5a3a'; ctx.beginPath();
    ctx.moveTo(hx + Math.cos(a+1.57)*4, hy + Math.sin(a+1.57)*4); ctx.lineTo(hx - Math.cos(a+1.57)*4, hy - Math.sin(a+1.57)*4); ctx.stroke();
  } else if (R.st.type==='axe'){
    // 斧：柄と大きな刃
    const a = p.swing > 0 ? -2.2 + t*3.4 : -1.2, len = 20 + (w ? w.up : 0)*0.5;
    const ex = hx + Math.cos(a)*len, ey = hy + Math.sin(a)*len;
    ctx.lineWidth = 3; ctx.strokeStyle = '#7a5a3a'; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(ex, ey, 7, a - 1.9, a + 0.2); ctx.lineTo(ex, ey); ctx.fill();
  } else if (R.st.type==='dagger'){
    // 短剣：短く素早い突き
    const a = p.swing > 0 ? -0.3 + Math.sin(t*Math.PI)*0.2 : -0.6, len = 11 + (p.swing > 0 ? Math.sin(t*Math.PI)*6 : 0);
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(a)*len, hy + Math.sin(a)*len); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = '#6b5a3a'; ctx.beginPath(); ctx.moveTo(hx - 2, hy - 3); ctx.lineTo(hx + 2, hy + 3); ctx.stroke();
  } else if (R.st.type==='bow'){
    ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(hx, hy, 11, -1.2, 1.2); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = '#eee'; ctx.beginPath();
    ctx.moveTo(hx + Math.cos(-1.2)*11, hy + Math.sin(-1.2)*11); ctx.lineTo(hx - (p.swing > 0 ? 0 : 3), hy);
    ctx.lineTo(hx + Math.cos(1.2)*11, hy + Math.sin(1.2)*11); ctx.stroke();
  } else {
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#7a5a3a'; ctx.beginPath(); ctx.moveTo(hx, hy + 9); ctx.lineTo(hx + 3, hy - 14); ctx.stroke();
    glow(hx + 3, hy - 17, p.swing > 0 ? 14 : 9, '#8fd8ff', p.swing > 0 ? 0.9 : 0.5);
    circ(hx + 3, hy - 17, p.swing > 0 ? 5.5 : 4.5, c);
  }
}

// 炎の柱（火柱・噴き出し口）。a：残りの割合（1→0）
function drawFlame(x, w, h, a){
  const fl = 0.85 + 0.15*Math.sin(R.t*40 + x), hh = h * fl * Math.min(1, a*3);
  const g = ctx.createLinearGradient(0, GY - hh, 0, GY);
  g.addColorStop(0, 'rgba(255,220,120,0)'); g.addColorStop(0.3, '#ffb347'); g.addColorStop(1, '#ff5a1a');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - w/2, GY); ctx.quadraticCurveTo(x - w/2 - 2, GY - hh*0.6, x, GY - hh);
  ctx.quadraticCurveTo(x + w/2 + 2, GY - hh*0.6, x + w/2, GY); ctx.fill();
  glow(x, GY - hh*0.4, w*1.3, '#ff7a2a', 0.7);
}
function drawHazards(){
  for (const h of R.haz){
    if (h.kind === 'sand'){
      // 流砂：渦を巻く暗い砂
      ctx.fillStyle = h.sank > 0 ? '#5a3a24' : '#6e4a30';
      ctx.beginPath(); ctx.ellipse(h.x, GY + 2, h.w/2, 5, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,220,170,.35)'; ctx.lineWidth = 1.2;
      for (let k = 0; k < 2; k++){ ctx.beginPath(); ctx.ellipse(h.x, GY + 2, h.w/2*(0.35 + 0.3*k) + Math.sin(R.t*4 + k)*2, 2 + k, 0, 0, Math.PI*2); ctx.stroke(); }
      if (h.sank > 0) for (let k = 0; k < 3; k++) circ(h.x + vr(-h.w/3, h.w/3), GY - vr(0, 6), 1.5, '#c9a27a');
    } else if (h.kind === 'vent'){
      const st = ventState(h), c = h.c % VENT.cycle;
      ctx.fillStyle = '#1a0d0a'; ctx.fillRect(h.x - h.w/2, GY - 1, h.w, 4);
      if (st === 'glow'){
        const q = (c - VENT.glow[0]) / (VENT.glow[1] - VENT.glow[0]);
        ctx.fillStyle = `rgba(255,${120 + 80*q},40,${0.5 + 0.5*q})`; ctx.fillRect(h.x - h.w/2, GY - 1, h.w, 4);
        glow(h.x, GY - 2, 8 + 12*q, '#ff6a2a', 0.3 + 0.6*q);
        if (Math.sin(R.t*25) > 0) circ(h.x + vr(-6, 6), GY - vr(3, 12), 1.5, '#ffcf6a');
      } else if (st === 'erupt') drawFlame(h.x, h.w, VENT.h, (VENT.erupt[1] - c) / (VENT.erupt[1] - VENT.erupt[0]));
      else glow(h.x, GY, 7, '#ff4a1a', 0.25);
    }
  }
}
// ボスの予告
function drawBossTele(b){
  const a = 0.6 + 0.35*Math.sin(R.t*30);
  if (b.tele > 0){
    if (b.next === 'hop' || b.next === 'bighop' || b.next === 'quake3'){
      ctx.fillStyle = `rgba(255,60,40,${a})`; ctx.fillRect(L0, GY-5, b.x - L0, 8);
      ctx.fillStyle = `rgba(255,220,200,${a})`;   // 衝撃波が来る向き
      for (let x = b.x - 50; x > L0; x -= 34){ ctx.beginPath(); ctx.moveTo(x, GY - 1); ctx.lineTo(x + 9, GY - 6); ctx.lineTo(x + 9, GY + 4); ctx.fill(); }
    }
    if (b.next === 'breath') orbLine(GY - 12, '#ff8a3a', b.x - b.w/2, a);
    // 突進：体の高さの帯と矢印（長押しで高く跳ぶ）
    if (b.next === 'charge'){
      const top = GY - b.fly - b.h*CHARGE.hitH;
      ctx.fillStyle = `rgba(255,60,40,${0.18 + 0.15*a})`; ctx.fillRect(L0, top, b.x - b.w/2 - L0, GY - top);
      ctx.fillStyle = `rgba(255,220,200,${a})`;
      for (let x = b.x - b.w/2 - 30; x > L0; x -= 40){ const y = (top + GY)/2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 12, y - 8); ctx.lineTo(x + 12, y + 8); ctx.fill(); }
    }
    // 光線：出る高さに太い点線（赤＝低い：跳んで空中に／青＝高い：跳ばない）
    if (b.next === 'beam'){
      const y = BEAM[b.beamH], c = b.beamH === 'high' ? '#7ab8ff' : '#ff6a9a';
      ctx.strokeStyle = c; ctx.globalAlpha = 0.4 + 0.5*a; ctx.lineWidth = 4; ctx.setLineDash([10, 6]);
      ctx.beginPath(); ctx.moveTo(L0, y); ctx.lineTo(b.x - b.w/2, y); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      glow(b.x - b.w/2, y, 12 + 10*(1 - Math.max(0, b.tele)/0.85), c, 0.9);
    }
  }
  // 弾の高さ：もうすぐ撃つ弾の高さに線を出す（赤＝低い：跳ぶ／青＝高い：くぐる）
  let soon = null;
  if (b.tele > 0 && (b.next === 'orbs' || b.next === 'volley') && b.tele < 0.5) soon = b.orbH[0];
  else if (!b.tele && b.q.length && b.q[0].a === 'orb' && b.q[0].at - b.qt < 0.45) soon = b.q[0].h;
  if (soon) orbLine(ORB[soon], soon === 'high' ? '#7ab8ff' : '#ff6a9a', b.x - b.w/2, a);
}
function orbLine(y, c, x1, a){
  ctx.strokeStyle = c; ctx.globalAlpha = 0.45 + 0.4*a; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
  ctx.beginPath(); ctx.moveTo(PX - 20, y); ctx.lineTo(x1, y); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;
}
// 霧：自分のまわりだけ見える
function drawFog(){
  const cx = PX + 30, cy = GY - 40;
  const g = ctx.createRadialGradient(cx, cy, 40, cx, cy, 165);
  g.addColorStop(0, 'rgba(10,16,32,0)'); g.addColorStop(1, `rgba(10,16,32,${0.88*R.fog})`);
  ctx.fillStyle = g; ctx.fillRect(L0, VTOP - 10, VW + 20, GY + 30 - VTOP);
  // 霧の中でも危ないものは「！」で分かる
  for (const e of R.enemies) if (warnOf(e)) bang(e.x, (e.under || e.phase === 'tele' && e.type === 'mole') ? GY - 22 : e.y - e.h - 10, 16);
  if (R.boss && R.boss.tele > 0) bang(R.boss.x, R.boss.y - R.boss.h - 10, 22);
}
const warnOf = e => !e.dead && (e.phase === 'tele' || e.phase === 'fuse' || (e.type === 'thrower' && e.wind));
function bang(x, y, size, c = '#ff4b3a'){ ctx.fillStyle = c; ctx.font = `bold ${size}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('!', x, y); }

function drawEnemy(e){
  const flash = e.hitFlash > 0, F = flash ? '#fff' : null;
  const x = e.x, y = e.y, sc = e.scale || 1, w = e.w / sc, h = e.h / sc;
  if (e.elite) glow(x, y - e.h/2, e.w*0.95, '#ffd36b', 0.45 + 0.15*Math.sin(R.t*6));
  if (sc !== 1){ ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.translate(-x, -y); }
  switch (e.type){
    case 'slime': case 'mini': case 'bigslime': {
      // 小さいスライム（群れ）は明るい黄緑、大スライムは青。大きさに合わせて目も縮める
      const sq = 1 + Math.sin(e.t*(e.type==='mini' ? 11 : e.type==='bigslime' ? 6 : 8))*0.1, k = w / 24;
      ctx.fillStyle = F || (e.type==='mini' ? '#a6e35a' : e.type==='bigslime' ? '#5fb6e8' : '#6ccf5e');
      ctx.beginPath(); ctx.ellipse(x, y - h/2*sq + 1, w/2/sq*1.05, h/2*sq, 0, 0, Math.PI*2); ctx.fill();
      if (e.type==='bigslime'){ ctx.globalAlpha = 0.35; circ(x + 4*k, y - h*0.45, 3.2*k, '#e8f6ff'); ctx.globalAlpha = 1; }
      circ(x - 5*k, y - h*0.6, 2.6*k, '#fff'); circ(x - 6*k, y - h*0.6, 1.3*k, '#123');
      circ(x + 2*k, y - h*0.6, 2.6*k, '#fff'); circ(x + 1*k, y - h*0.6, 1.3*k, '#123');
      break;
    }
    case 'bat': {
      const fl = Math.sin(e.t*22)*6, cy = y - h/2;
      ctx.fillStyle = F || '#7e52b8';
      ctx.beginPath(); ctx.moveTo(x - 3, cy); ctx.lineTo(x - 15, cy - 4 - fl); ctx.lineTo(x - 9, cy + 3); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + 3, cy); ctx.lineTo(x + 15, cy - 4 - fl); ctx.lineTo(x + 9, cy + 3); ctx.closePath(); ctx.fill();
      circ(x, cy, 6.5, F || '#9a6fd6'); circ(x - 2.5, cy - 1, 1.4, '#ffdf6b');
      break;
    }
    case 'thrower': {
      rr(x - w/2, y - h + 8, w, h - 8, 4, F || '#a0703f');
      circ(x, y - h + 4, 7, F || '#c79361');
      circ(x - 3, y - h + 3, 1.4, '#222');
      const up = e.phase==='stand' && e.wind;
      ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 4, y - h + 14);
      ctx.lineTo(x - 4 + (up ? 4 : -8), y - h + (up ? -2 : 22)); ctx.stroke();
      if (up){ circ(x, y - h - 6, 5, '#8b8378'); bang(x + 10, y - h - 8, 14); }
      break;
    }
    case 'shield': {
      // 盾兵：左（こちら向き）に大きな盾
      rr(x - w/2 + 5, y - h + 9, w - 8, h - 9, 4, F || '#56657a');
      circ(x + 3, y - h + 6, 6.5, F || '#d9b38c');
      rr(x - 3, y - h - 2, 13, 6, 3, '#8a98a6');
      circ(x - 1, y - h + 6, 1.3, '#222');
      rr(x - w/2 - 3, y - h + 5, 10, h - 6, 3, F || '#c8d2da');
      rr(x - w/2 - 1, y - h + 9, 2.5, h - 14, 1, '#8d9aa6');
      circ(x - w/2 + 2, y - h/2, 2.2, '#ffd36b');
      ctx.strokeStyle = '#4a4036'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x + w/2 - 2, y - h + 12); ctx.lineTo(x + w/2 + 2, y - h - 4); ctx.stroke();
      break;
    }
    case 'boar': {
      const tele = e.phase==='tele', ch = e.phase==='charge';
      const bob = ch ? Math.sin(e.t*40)*1.5 : tele ? Math.sin(e.t*30) : Math.sin(e.t*12);
      ctx.fillStyle = F || (tele && Math.sin(R.t*30) > 0 ? '#c0603a' : '#7a5232');
      ctx.beginPath(); ctx.ellipse(x + 2, y - h*0.55 + bob, w/2, h*0.42, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x - w/2 + 3, y - h*0.45 + bob, 7, 6, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#f3ead2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - w/2, y - h*0.3 + bob); ctx.lineTo(x - w/2 - 5, y - h*0.55 + bob); ctx.stroke();
      circ(x - w/2 + 2, y - h*0.58 + bob, 1.4, '#ffdf6b');
      ctx.strokeStyle = '#4a3220'; ctx.lineWidth = 3;
      for (const lx of [-8, -2, 6, 12]){ const s = ch ? Math.sin(e.t*40 + lx)*3 : 0; ctx.beginPath(); ctx.moveTo(x + lx, y - 5); ctx.lineTo(x + lx + s, y); ctx.stroke(); }
      if (tele){ bang(x, y - h - 8, 16); circ(x + w/2 + vr(0, 6), y - vr(1, 5), 2, '#c9b08a'); }
      if (ch){ ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5; for (const dy of [6, 12]){ ctx.beginPath(); ctx.moveTo(x + w/2 + 4, y - dy); ctx.lineTo(x + w/2 + 18, y - dy); ctx.stroke(); } }
      break;
    }
    case 'mole': {
      if (e.under || e.phase === 'tele'){
        const tele = e.phase === 'tele', bl = tele && Math.sin(R.t*30) > 0;
        ctx.fillStyle = bl ? '#d0503a' : '#7a5a3a';
        ctx.beginPath(); ctx.ellipse(x, GY + 1, 13, tele ? 7 + (0.6 - e.tele)*7 : 6, 0, Math.PI, 0); ctx.fill();
        circ(x + vr(-9, 9), GY - vr(2, 8), 1.5, '#9a7a5a');
        if (tele) bang(x, GY - 20, 16);
      } else {
        if (e.popT > 0){   // 飛び出した瞬間の土の柱
          ctx.fillStyle = '#a08060'; ctx.beginPath(); ctx.moveTo(x - 11, GY); ctx.lineTo(x, GY - 34 * Math.min(1, (0.3 - e.popT)*8 + 0.3)); ctx.lineTo(x + 11, GY); ctx.fill();
        }
        rr(x - w/2, y - h, w, h, 8, F || '#6b4a35');
        rr(x - w/2 + 4, y - h + 9, w - 8, h - 9, 5, '#8a6a52');
        circ(x - 4, y - h + 6, 1.4, '#111'); circ(x + 3, y - h + 6, 1.4, '#111'); circ(x - w/2 + 2, y - h + 9, 2.2, '#ff9aa8');
      }
      break;
    }
    case 'bomber': {
      const fuse = e.phase === 'fuse', bl = fuse && Math.sin(R.t*(30 + (0.6 - e.tele)*40)) > 0;
      if (fuse){   // 爆発の範囲
        ctx.strokeStyle = `rgba(255,80,50,${0.4 + 0.4*(1 - e.tele/0.6)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(x, GY + 1, 44, 7, 0, 0, Math.PI*2); ctx.stroke();
      }
      ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 2.5;
      for (const lx of [-4, 4]){ ctx.beginPath(); ctx.moveTo(x + lx, y - 6); ctx.lineTo(x + lx + Math.sin(e.t*20 + lx)*2, y); ctx.stroke(); }
      circ(x, y - h/2 - 2, 9, F || (bl ? '#ff5b3a' : '#2e2e36'));
      circ(x - 3, y - h/2 - 5, 2.5, 'rgba(255,255,255,.25)');
      ctx.strokeStyle = '#8a7a5a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 3, y - h + 2); ctx.quadraticCurveTo(x + 7, y - h - 4, x + 5, y - h - 7); ctx.stroke();
      glow(x + 5, y - h - 7, fuse ? 9 : 5, '#ffcf6a', 0.9);
      if (fuse) bang(x, y - h - 12, 16);
      break;
    }
    case 'ghost': {
      ctx.globalAlpha = flash ? 1 : 0.82;
      ctx.fillStyle = F || '#e6ecff';
      ctx.beginPath(); ctx.arc(x, y - h + 9, 9, Math.PI, 0);
      ctx.lineTo(x + 9, y - 3);
      for (let k = 0; k < 4; k++){ const bx = x + 9 - (k + 0.5)*4.5; ctx.lineTo(bx, y - 3 + (k % 2 ? -3 : 3) + Math.sin(e.t*8 + k)); }
      ctx.lineTo(x - 9, y - 3); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      circ(x - 4, y - h + 9, 1.8, '#223'); circ(x + 1, y - h + 9, 1.8, '#223');
      glow(x, y - h/2, 14, '#bcd0ff', 0.25);
      break;
    }
    case 'chest': {
      rr(x - w/2, y - h, w, h, 3, F || '#9a6a3a');
      rr(x - w/2, y - h, w, 6, 3, F || '#b8844a');
      rr(x - w/2, y - h + 6, w, 2.5, 0, '#ffd36b');
      rr(x - 2.5, y - h + 5, 5, 6, 1, '#ffd36b');
      glow(x, y - h/2, 14, '#ffd36b', 0.25 + 0.15*Math.sin(R.t*4));
      break;
    }
    case 'frog': {
      // 跳ねガエル：跳ぶ前に少し縮む
      const sit = e.y >= GY && e.hopT < 0.25 ? 0.85 : 1, by = y;
      ctx.fillStyle = F || '#5fae4e'; ctx.beginPath(); ctx.ellipse(x, by - h*0.45*sit, w/2, h*0.48*sit, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = F || '#8fd47a'; ctx.beginPath(); ctx.ellipse(x - 2, by - h*0.3*sit, w*0.32, h*0.25*sit, 0, 0, Math.PI*2); ctx.fill();
      circ(x - 6, by - h*0.9*sit, 3.6, F || '#5fae4e'); circ(x + 3, by - h*0.9*sit, 3.6, F || '#5fae4e');
      circ(x - 6, by - h*0.92*sit, 2, '#fff'); circ(x - 6.5, by - h*0.92*sit, 1, '#123');
      circ(x + 3, by - h*0.92*sit, 2, '#fff'); circ(x + 2.5, by - h*0.92*sit, 1, '#123');
      if (e.y < GY){ ctx.strokeStyle = F || '#4a8a3c'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x + 6, by - 4); ctx.lineTo(x + 12, by + 3); ctx.stroke(); }
      break;
    }
    case 'cannon': {
      // 砲台：光ったら撃つ。次の弾の高さに線を出す（赤＝低い・青＝高い）
      rr(x - w/2, y - 12, w, 12, 3, F || '#5a5f68');
      const ang = e.nextHi ? -0.45 : -0.05;
      ctx.save(); ctx.translate(x, y - 12); ctx.rotate(ang); rr(-20, -5, 22, 10, 3, F || '#7a7f8a'); ctx.restore();
      circ(x, y - 12, 7, F || '#8a909a');
      if (e.wind){
        bang(x, y - h - 10, 16);
        const yy = e.nextHi ? ORB.high : ORB.low, c = e.nextHi ? '#7ab8ff' : '#ff6a9a';
        ctx.strokeStyle = c; ctx.globalAlpha = 0.7; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.moveTo(PX - 20, yy); ctx.lineTo(x - w/2, yy); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
        glow(x - 18, y - 14 + (e.nextHi ? -8 : 0), 10, c, 0.8);
      }
      break;
    }
    case 'spikeball': {
      const cx = x, cy = y - h/2, r = w/2 - 2;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-(e.rot || 0));
      ctx.fillStyle = F || '#c9ced6';
      for (let k = 0; k < 8; k++){ const a = k/8*Math.PI*2; ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.25)*r, Math.sin(a - 0.25)*r); ctx.lineTo(Math.cos(a)*(r + 7), Math.sin(a)*(r + 7)); ctx.lineTo(Math.cos(a + 0.25)*r, Math.sin(a + 0.25)*r); ctx.fill(); }
      circ(0, 0, r, F || '#7a808a'); circ(-3, -3, r*0.35, 'rgba(255,255,255,.35)');
      ctx.restore();
      break;
    }
    case 'wisp': {
      const cy = y - h/2, pulse = 0.8 + 0.2*Math.sin(e.t*5);
      glow(x, cy, 20*pulse, '#9fffc8', 0.6);
      circ(x, cy, 7*pulse, F || '#dfffee');
      ctx.fillStyle = F || '#7fe8a8'; ctx.beginPath(); ctx.moveTo(x - 6, cy + 3); ctx.quadraticCurveTo(x, cy + 16 + Math.sin(e.t*7)*3, x + 6, cy + 3); ctx.fill();
      circ(x - 2.5, cy - 1, 1.3, '#1a4030'); circ(x + 2, cy - 1, 1.3, '#1a4030');
      if (e.healT < 0.5){ ctx.strokeStyle = 'rgba(140,255,190,.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, cy, 12 + (0.5 - e.healT)*20, 0, Math.PI*2); ctx.stroke(); }
      break;
    }
    case 'boss': drawBoss(e, F); break;
    default:
      if (FOES2[e.type]){ drawFoe2(ctx, e, F, {glow, bang}); break; }   // 追加の敵（foeart.js）
      // 絵がまだない種類でも見えなくならないように（気づけるよう派手な色）
      rr(x - w/2, y - h, w, h, 4, F || '#ff3dc8');
  }
  if (sc !== 1) ctx.restore();
  // トゲ（エリート）
  if (has(e, 'spiky')){
    ctx.fillStyle = '#e8e0d0';
    for (let k = -2; k <= 2; k++){ const sx = x + k*e.w/5; ctx.beginPath(); ctx.moveTo(sx - 3, e.y - e.h + 2); ctx.lineTo(sx, e.y - e.h - 6); ctx.lineTo(sx + 3, e.y - e.h + 2); ctx.fill(); }
  }
  if (e.poisonT > 0){ ctx.globalAlpha = 0.75; circ(x + vr(-5,5), y - e.h*0.6 + vr(-3,3), 2.5, '#8fe36a'); ctx.globalAlpha = 1; }
  if (e.burnT > 0){ ctx.globalAlpha = 0.7; circ(x + vr(-4,4), y - e.h - 2 + vr(-2,2), 3, '#ff8a3a'); ctx.globalAlpha = 1; }
  if (e.type!=='boss' && !e.under && (e.hp < e.maxHp || e.elite)){
    const bw = e.elite ? 30 : 24, top = y - e.h - (has(e, 'spiky') ? 13 : 7);
    rr(x - bw/2, top, bw, 3, 1, 'rgba(0,0,0,.5)');
    rr(x - bw/2, top, bw*Math.max(0, e.hp/e.maxHp), 3, 1, e.elite ? '#ffd36b' : '#ff5d5d');
    if (e.elite){
      ctx.font = 'bold 7px -apple-system, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,.6)';
      outlined(e.elite.map(m => ELITE_MODS[m].n).join('・'), x, top - 3, '#ffd36b');
    }
  }
}
const has = (e, m) => e.elite && e.elite.includes(m);

// ボス4体
function drawBoss(e, F){
  if (e.aura) glow(e.x, e.y - e.h/2, Math.max(e.w, e.h)*1.1, e.aura, 0.4 + 0.15*Math.sin(R.t*3));   // 深層のボスはエリアの光をまとう
  const {x, y, w, h} = e, tele = e.tele > 0 && Math.sin(R.t*30) > 0;
  const lift = e.tele > 0 && (e.next === 'hop' || e.next === 'bighop') ? -8 * Math.min(1, (0.85 - e.tele) * 3) : 0;
  const hot = e.rage || e.p2;
  if (BOSSES[e.boss].shape){   // 追加のボス（foeart.js）
    const lift2 = e.tele > 0 && (e.next === 'hop' || e.next === 'bighop' || e.next === 'quake3') ? -8 * Math.min(1, (0.85 - e.tele) * 3) : 0;
    drawBossGeneric(ctx, e, F, {glow, bang}, {lift:lift2, hot, tele});
  } else if (e.boss === 'kingslime'){
    const sq = 1 + Math.sin(e.t*5)*0.05 - (lift ? 0.08 : 0), by = y + lift;
    ctx.fillStyle = F || (tele ? '#a8e08a' : hot ? '#4fae5a' : '#5cc96a');
    ctx.beginPath(); ctx.ellipse(x, by - h/2*sq, w/2/sq, h/2*sq, 0, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 0.3; circ(x + 12, by - h*0.65, 7, '#eaffea'); ctx.globalAlpha = 1;
    // 王冠
    const ct = by - h*sq + 2;
    ctx.fillStyle = '#ffd36b'; ctx.beginPath(); ctx.moveTo(x - 14, ct + 2); ctx.lineTo(x - 14, ct - 8); ctx.lineTo(x - 7, ct - 3); ctx.lineTo(x, ct - 11); ctx.lineTo(x + 7, ct - 3); ctx.lineTo(x + 14, ct - 8); ctx.lineTo(x + 14, ct + 2); ctx.fill();
    circ(x, ct - 3, 2, '#ff5b8a');
    for (const ex of [-12, 4]){ circ(x + ex, by - h*0.55, 5, '#fff'); circ(x + ex - 1.5, by - h*0.55, 2.4, hot ? '#c0202a' : '#123'); }
    if (hot){ ctx.strokeStyle = '#123'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 18, by - h*0.72); ctx.lineTo(x - 7, by - h*0.66); ctx.moveTo(x + 9, by - h*0.66); ctx.lineTo(x - 1, by - h*0.72); ctx.stroke(); }
  } else if (e.boss === 'golem'){
    const by = y + lift;
    rr(x - w/2 - 8, by - h + 30, 12, 32, 5, F || '#6f6a64'); rr(x + w/2 - 4, by - h + 30, 12, 32, 5, F || '#6f6a64');   // 腕
    rr(x - w/2, by - h + 18, w, h - 18, 10, F || (tele ? '#a08a7a' : '#8a847c'));
    rr(x - 16, by - h, 32, 24, 7, F || '#9a948c');
    for (const [cx, cy, r] of [[-12, 34, 4], [10, 46, 5], [-4, 56, 3]]) circ(x + cx, by - h + cy, r, 'rgba(0,0,0,.15)');
    const ec = hot ? '#ff5b3a' : '#7affc8';
    glow(x - 7, by - h + 11, 8, ec, 0.8); glow(x + 6, by - h + 11, 8, ec, 0.8);
    circ(x - 7, by - h + 11, 2.6, '#fff'); circ(x + 6, by - h + 11, 2.6, '#fff');
    if (e.tele > 0 && e.next === 'boulder') circ(x, by - h - 16, 13, '#7d756a');
  } else if (e.boss === 'witch'){
    // 浮かぶ魔女：長い衣・とんがり帽子・杖
    ctx.fillStyle = F || (tele ? '#9a6ad0' : hot ? '#5a2a7a' : '#4a3270');
    ctx.beginPath(); ctx.moveTo(x - w/2 - 2, y); ctx.lineTo(x - 7, y - h + 16); ctx.lineTo(x + 7, y - h + 16); ctx.lineTo(x + w/2 + 2, y); ctx.closePath(); ctx.fill();
    circ(x, y - h + 12, 7.5, F || '#d8c8e8');
    ctx.fillStyle = '#2a1a40'; ctx.beginPath(); ctx.moveTo(x - 13, y - h + 7); ctx.lineTo(x + 13, y - h + 7); ctx.lineTo(x + 3, y - h - 16); ctx.closePath(); ctx.fill();
    circ(x - 3, y - h + 12, 1.5, hot ? '#ff5b8a' : '#7affc8'); circ(x + 2, y - h + 12, 1.5, hot ? '#ff5b8a' : '#7affc8');
    ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - w/2 - 4, y - 4); ctx.lineTo(x - w/2 - 8, y - h + 10); ctx.stroke();
    glow(x - w/2 - 8, y - h + 8, e.tele > 0 ? 14 : 9, '#c58bff', 0.9);
    glow(x, y + 4, 16, '#c58bff', 0.25);
  } else if (e.boss === 'dragon'){
    const flap = Math.sin(e.t*(hot ? 7 : 5)) * 10;
    ctx.fillStyle = F || '#6a1f1f';
    ctx.beginPath(); ctx.moveTo(x + 4, y - h + 18); ctx.lineTo(x + 30, y - h - 10 - flap); ctx.lineTo(x + 36, y - h + 26); ctx.closePath(); ctx.fill();
    ctx.fillStyle = F || (tele ? '#d0503a' : hot ? '#b02a1a' : '#a02a22');
    ctx.beginPath(); ctx.ellipse(x + 6, y - h*0.42, w/2 - 4, h*0.36, 0, 0, Math.PI*2); ctx.fill();   // 胴
    rr(x - w/2 + 2, y - h + 6, 18, 30, 7, F || '#a02a22');   // 首
    rr(x - w/2 - 10, y - h + 2, 26, 16, 6, F || '#b8352a');   // 頭
    ctx.fillStyle = '#f3ead2'; ctx.beginPath(); ctx.moveTo(x - w/2 - 8, y - h + 18); ctx.lineTo(x - w/2 - 5, y - h + 23); ctx.lineTo(x - w/2 - 2, y - h + 18); ctx.fill();
    glow(x - w/2 + 4, y - h + 8, 7, '#ffd36b', 0.9); circ(x - w/2 + 4, y - h + 8, 2, '#fff');
    if (e.tele > 0 && (e.next === 'breath' || e.next === 'pillars')) glow(x - w/2 - 12, y - h + 12, 12, '#ff8a3a', 0.9);
    rr(x - 8, y - 12, 9, 12, 3, '#6a1f1f'); rr(x + 14, y - 12, 9, 12, 3, '#6a1f1f');
  }
  if (e.tele > 0) bang(x, y - h - (e.boss === 'witch' ? 22 : e.boss === 'kingslime' ? 16 : 10) + lift, 22);
  // 結界：青い泡と、あと何回たたけば割れるか
  if (e.ward){
    const cx = x, cy = y - h/2, r = Math.max(w, h)*0.75, a = Math.min(1, e.ward.t*2);
    glow(cx, cy, r*1.3, '#8fd8ff', 0.35*a);
    ctx.strokeStyle = `rgba(160,225,255,${0.8*a})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, r + Math.sin(R.t*6)*1.5, 0, Math.PI*2); ctx.stroke();
    for (let k = 0; k < WARD.hits; k++){ ctx.fillStyle = k < e.ward.hits ? '#bfe8ff' : 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.arc(cx - (WARD.hits - 1)*5 + k*10, cy - r - 8, 3.2, 0, Math.PI*2); ctx.fill(); }
  }
  if (e.exposed > 0 && Math.sin(R.t*20) > 0){ ctx.fillStyle = '#fff6c8'; ctx.fillRect(x - w/2 + Math.random()*w, y - h*Math.random(), 2.5, 2.5); }
}


function drawHUD(H){
  const p = R.p;
  const maxHp = Math.ceil(p.maxHp), hp = Math.min(maxHp, Math.ceil(Math.max(0, p.hp)));
  const bw = Math.min(110, VW*0.3);   // 縦持ち（幅が狭い）では距離表示と重ならないよう短く
  rr(10, 10, bw, 12, 6, 'rgba(0,0,0,.45)');
  rr(11, 11, (bw - 2)*Math.max(0, p.hp/p.maxHp), 10, 5, p.hp/p.maxHp > 0.3 ? '#5fd17a' : '#ff6b6b');
  ctx.font = 'bold 9px -apple-system, sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
  ctx.fillText(`HP ${hp}/${maxHp}`, 15, 19.5);
  ctx.textAlign = 'center'; ctx.font = 'bold 16px -apple-system, sans-serif';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.45)';
  const b = R.boss;
  if (b){ ctx.font = 'bold 13px -apple-system, sans-serif'; outlined(bossName(b), VW/2, 22, b.p2 ? '#ff8a8a' : '#ffd0c8'); }
  else outlined(`${Math.floor(R.dist)} m`, VW/2, 22, '#fff');
  ctx.font = '10px -apple-system, sans-serif';
  if (b){
    rr(VW/2 - 70, 30, 140, 7, 3, 'rgba(0,0,0,.5)');
    rr(VW/2 - 70, 30, 140*Math.max(0, b.hp/b.maxHp), 7, 3, b.rage ? '#ff3b2f' : b.p2 ? '#ff6a4a' : '#e0507a');
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(VW/2 - 0.5, 29, 1, 9);   // 50%（第2形態になるところ）
    // 残り時間（怒ってからは赤く点滅）
    const left = Math.max(0, BOSS_LIMIT - (b.fightT || 0));
    if (b.fightT){
      ctx.textAlign = 'center'; ctx.font = `bold ${b.rage ? 11 : 9}px -apple-system, sans-serif`;
      outlined((b.p2 ? '第2形態 ・ ' : '') + (b.rage ? `怒り！ あと${Math.ceil(left)}秒` : `残り ${Math.ceil(left)}秒`), VW/2, 48, b.rage && Math.sin(R.t*10) > 0 ? '#ff5b4a' : '#ffd0c8');
    }
  } else if (R.clearT > 0){
    outlined('踏破！', VW/2, 36, '#ffd36b');
  } else {
    outlined(`ボス${R.nextBoss/500}/${bossTotal()}まで ${Math.ceil(R.nextBoss - R.dist)}m ・ 敵Lv${elv()}`, VW/2, 36, '#fff');
  }
  ctx.textAlign = 'right'; ctx.font = 'bold 12px -apple-system, sans-serif';
  outlined(`${fmt(R.gold)} G`, VW - 10, 20, '#ffd36b');
  if (R.daily || R.deep || R.diff > 1){ ctx.font = 'bold 9px -apple-system, sans-serif'; outlined(`${R.daily ? '日替わり ' : ''}${R.deep ? '深層' : ''}${R.deep || R.diff > 1 ? `難易度${R.diff}` : ''}`, VW - 10, 34, R.daily ? '#7fe8ff' : R.deep ? '#c9a6ff' : '#ff9a7a'); }
  // 経験値バー（画面の一番上）とレベル
  const S = R.sk;
  rr(0, 0, VW, 4, 0, 'rgba(0,0,0,.4)');
  rr(0, 0, VW * Math.min(1, S.xp / S.need), 4, 0, '#6fd3ff');
  ctx.textAlign = 'left'; ctx.font = 'bold 9px -apple-system, sans-serif';
  outlined(`Lv ${S.lv}`, 10, 34, '#9fe6ff');
  if (R.threat){   // 脅威度：右上（ゴールドと難易度の下）
    ctx.textAlign = 'right'; ctx.font = 'bold 9px -apple-system, sans-serif';
    outlined(`脅威 Lv${R.threat}`, VW - 10, R.daily || R.deep || R.diff > 1 ? 46 : 34, '#ff8a7a');
    ctx.textAlign = 'left';
  }
  // 持っているスキル（絵のアイコン。攻撃は丸い枠、強化は四角い枠。進化は塗りつぶし）
  let ix = 10;
  const icon = (id, c, lv, evo, round) => {
    if (round){ ctx.fillStyle = evo ? c : 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.arc(ix + 8, 49, 8, 0, Math.PI*2); ctx.fill(); }
    else rr(ix, 41, 16, 16, 3, 'rgba(0,0,0,.5)');
    if (!evo){ ctx.strokeStyle = c; ctx.globalAlpha = 0.55; ctx.lineWidth = 1; ctx.beginPath(); if (round) ctx.arc(ix + 8, 49, 7.5, 0, Math.PI*2); else ctx.roundRect(ix + 0.5, 41.5, 15, 15, 3); ctx.stroke(); ctx.globalAlpha = 1; }
    drawSkillIcon(ctx, id, ix + 2.5, 43.5, 11, evo ? '#1a1a1a' : c);
    if (!evo){ ctx.textAlign = 'center'; ctx.font = 'bold 7px -apple-system, sans-serif'; ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,.8)'; outlined(String(lv), ix + 14, 58, '#fff'); }
    ix += 18;
  };
  for (const [id, lv] of Object.entries(S.act)) icon(id, ACTIVES[id].c, lv, S.evo[id], true);
  for (const [id, lv] of Object.entries(S.pas)) icon(id, PASSIVES[id].c, lv, false, false);
  if (R.zoneCard) drawZoneCard(R.zoneCard);
  if (R.banner.t > 0){
    ctx.globalAlpha = Math.min(1, R.banner.t*2);
    ctx.textAlign = 'center'; ctx.font = 'bold 18px -apple-system, sans-serif';
    outlined(R.banner.txt, VW/2, 78, R.banner.c || '#fff');
    ctx.globalAlpha = 1;
  }
  // 初めて会った敵の説明
  if (R.hint){
    const t = R.hint, a = Math.min(1, t.t*2, (3.4 - t.t)*4);
    ctx.globalAlpha = a; ctx.textAlign = 'center';
    ctx.font = '10px -apple-system, sans-serif';
    const tw = Math.min(VW - 16, Math.max(ctx.measureText(t.b).width, 60) + 20);
    rr(VW/2 - tw/2, 90, tw, 34, 8, 'rgba(0,0,0,.55)');
    ctx.font = 'bold 11px -apple-system, sans-serif'; ctx.fillStyle = '#ffd36b'; ctx.fillText(t.a, VW/2, 104);
    ctx.font = '10px -apple-system, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(t.b, VW/2, 118, VW - 24);
    ctx.globalAlpha = 1;
  }
  if (R.paused){ ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, VW, H); }
}

// ボス撃破：光の筋が回り、衝撃波が広がり、「撃破！」の文字が押される
function drawBossKill(f){
  const age = f.max - f.t, a = Math.min(1, f.t/0.6);
  ctx.save();
  ctx.beginPath(); ctx.rect(L0, VTOP - 10, VW + 20, GY - VTOP + 12); ctx.clip();   // 光は地面の上だけ（下のログを読みやすく）
  ctx.translate(f.x, f.y);
  ctx.globalAlpha = 0.35*a; ctx.fillStyle = '#fff4c8';
  for (let i = 0; i < 10; i++){
    const ang = i/10*Math.PI*2 + age*0.8, w = 0.12;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang - w)*400, Math.sin(ang - w)*400); ctx.lineTo(Math.cos(ang + w)*400, Math.sin(ang + w)*400); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (let k = 0; k < 3; k++){
    const q = Math.min(1, Math.max(0, (age - k*0.15)/0.9));
    if (q <= 0 || q >= 1) continue;
    ctx.strokeStyle = `rgba(255,230,160,${1 - q})`; ctx.lineWidth = 6*(1 - q) + 1;
    ctx.beginPath(); ctx.arc(0, 0, 20 + q*170, 0, Math.PI*2); ctx.stroke();
  }
  ctx.restore();
  // 文字（大きく出てから縮んで止まる）
  const pop = age < 0.18 ? 2.2 - age/0.18*1.2 : 1;
  ctx.globalAlpha = Math.min(1, f.t*1.5);
  ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(60,20,0,.8)';
  ctx.font = `900 ${Math.round(30*pop)}px -apple-system, sans-serif`;
  outlined('撃破！', VW/2, 118, '#ffd36b');
  ctx.font = 'bold 12px -apple-system, sans-serif'; ctx.lineWidth = 3;
  outlined(f.n, VW/2, 136, '#fff');
  ctx.globalAlpha = 1;
}
// エリア名のカード（右から滑り込んで、少し止まって、左へ抜ける）
function drawZoneCard(z){
  const age = z.max - z.t - (z.delay || 0);
  if (age < 0) return;
  const dur = z.max - (z.delay || 0), Z = zoneAt(z.i);
  const inT = Math.min(1, age/0.35), outT = Math.max(0, (age - (dur - 0.4))/0.4);
  const ease = q => 1 - Math.pow(1 - q, 3);
  const dx = (1 - ease(inT))*VW - ease(outT)*VW;
  const y = 98, h = 46;
  ctx.save(); ctx.translate(dx, 0);
  ctx.globalAlpha = 0.82; ctx.fillStyle = 'rgba(8,12,16,.85)'; ctx.fillRect(0, y, VW, h);
  ctx.globalAlpha = 1; ctx.fillStyle = Z.sky[0]; ctx.fillRect(0, y, VW, 2); ctx.fillRect(0, y + h - 2, VW, 2);
  ctx.textAlign = 'center';
  ctx.font = 'bold 9px -apple-system, sans-serif'; ctx.fillStyle = Z.sky[1];
  ctx.fillText(`${R.deep ? '深層 ' : ''}エリア ${z.i + 1}${z.sub ? ' ・ ' + z.sub : ''}`, VW/2, y + 14);
  ctx.font = '800 20px -apple-system, sans-serif'; ctx.fillStyle = '#fff';
  ctx.fillText(Z.n, VW/2, y + 37);
  ctx.restore();
}
