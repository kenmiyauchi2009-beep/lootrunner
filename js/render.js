// 冒険の描画
import { fmt } from './util.js';
import { RAR, DROP_FX } from './data.js';
import { SAVE } from './save.js';
import { GY, PX, R, ctx, VW, SCALE, DPR, OY, VTOP, VBOT, zone, elv, BOSS_LIMIT } from './run.js';
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
function glow(x, y, r, c, a = 1){ ctx.globalAlpha = a; ctx.drawImage(glowImg(c), x - r, y - r, r*2, r*2); ctx.globalAlpha = 1; }

function hills(col, off, base, amp, f){
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-10, GY);
  for (let x=-10; x<=VW+10; x+=10){ const wx = x + off; ctx.lineTo(x, base - amp*(0.6*Math.sin(wx*f) + 0.4*Math.sin(wx*f*2.3 + 1.7))); }
  ctx.lineTo(VW+10, GY); ctx.closePath(); ctx.fill();
}
function rr(x, y, w, h, r, c){ ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
function circ(x, y, r, c){ ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill(); }
function outlined(txt, x, y, c){ ctx.strokeText(txt, x, y); ctx.fillStyle = c; ctx.fillText(txt, x, y); }

export function draw(){
  if (!R) return;
  const amp = R.shake > 0 ? R.shakeAmp : 0;
  const sx = amp ? vr(-amp, amp) : 0, sy = amp ? vr(-amp, amp) : 0;
  const k = DPR*SCALE;
  ctx.setTransform(k, 0, 0, k, sx*k, (OY + sy)*k);
  const Z = zone();

  // 空・遠景・地面
  const g = ctx.createLinearGradient(0, Math.min(0, VTOP), 0, GY);
  g.addColorStop(0, Z.sky[0]); g.addColorStop(1, Z.sky[1]);
  ctx.fillStyle = g; ctx.fillRect(-10, VTOP - 10, VW + 20, GY - VTOP + 10);
  // 雲（ゆっくり流れる）
  ctx.fillStyle = Z.cloud || 'rgba(255,255,255,.45)';
  for (let i=0;i<5;i++){
    const span = VW + 160, cx = ((i*173 - R.px*0.05*(1 + i*0.15)) % span + span) % span - 80;
    const cy = VTOP + 50 + ((i*3) % 5) * (115 - VTOP - 50) / 5;   // 画面上端から遠くの山の上まで
    ctx.beginPath(); ctx.ellipse(cx, cy, 26 + (i%3)*8, 8, 0, 0, Math.PI*2); ctx.ellipse(cx + 14, cy - 6, 16, 9, 0, 0, Math.PI*2); ctx.fill();
  }
  hills(Z.far, R.px*0.15, 160, 40, 0.012);
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

  // 予告：ボスの踏みつけ・岩の落下地点
  if (R.boss && R.boss.tele > 0){
    const b = R.boss, a = 0.6 + 0.35*Math.sin(R.t*30);
    if (b.next==='stomp'){
      ctx.fillStyle = `rgba(255,60,40,${a})`; ctx.fillRect(-10, GY-5, b.x + 10, 8);
      ctx.fillStyle = `rgba(255,220,200,${a})`;   // 衝撃波が来る向き
      for (let x = b.x - 50; x > 0; x -= 34){ ctx.beginPath(); ctx.moveTo(x, GY - 1); ctx.lineTo(x + 9, GY - 6); ctx.lineTo(x + 9, GY + 4); ctx.fill(); }
    }
    ctx.fillStyle = '#ff4b3a'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('!', b.x, b.y - b.h - 10);
  }
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
      circ(s.x, s.y, s.r, '#8b8378');
      const sp = s.spin || 0;
      circ(s.x + Math.cos(sp)*3, s.y + Math.sin(sp)*3, 2, '#a9a197'); circ(s.x - Math.cos(sp)*2.5, s.y - Math.sin(sp)*2.5, 1.5, '#6f685e');
    }
    else { const wg = ctx.createLinearGradient(0, GY - s.h, 0, GY); wg.addColorStop(0,'rgba(255,200,90,0)'); wg.addColorStop(1,'#ffb347');
      ctx.fillStyle = wg; ctx.fillRect(s.x - s.w/2, GY - s.h, s.w, s.h); }
  }

  // 演出
  for (const f of R.fx){
    const a = Math.max(0, f.t/(f.max||1));
    if (f.kind==='slash') drawSlash(f, a);
    else if (f.kind==='boom'){
      glow(f.x, f.y, f.r*1.2, '#a0dcff', a*0.7);
      ctx.strokeStyle = `rgba(170,225,255,${a})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, f.r*(1.1 - a*0.5), 0, Math.PI*2); ctx.stroke();
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
    }
  }
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
  const legs = air ? [0.6, -0.4] : [Math.sin(run)*0.8, -Math.sin(run)*0.8];
  for (const [i,a] of legs.entries()){ ctx.beginPath(); ctx.moveTo(x - 2 + i*4, y - 10); ctx.lineTo(x - 2 + i*4 + Math.sin(a)*8, y - 1); ctx.stroke(); }
  rr(x - 8, y - 27, 16, 18, 4, SAVE.equip.body ? RAR[SAVE.equip.body.r].c : '#3d8bd9');
  rr(x - 8, y - 15, 16, 3, 1, 'rgba(0,0,0,.25)');
  circ(x + 1, y - 32, 7, '#f6d2a8');
  ctx.fillStyle = '#5a3a22'; ctx.beginPath(); ctx.arc(x, y - 34, 7.5, Math.PI*1.05, Math.PI*2.05); ctx.fill();
  circ(x + 4, y - 32, 1.3, '#222');
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

function drawEnemy(e){
  const flash = e.hitFlash > 0;
  const {x, y, w, h} = e;
  if (e.type==='slime' || e.type==='mini'){
    // 小さいスライム（群れ）は明るい黄緑で、大きさに合わせて目も縮める
    const sq = 1 + Math.sin(e.t*(e.type==='mini' ? 11 : 8))*0.1, k = w / 24;
    ctx.fillStyle = flash ? '#fff' : e.type==='mini' ? '#a6e35a' : '#6ccf5e';
    ctx.beginPath(); ctx.ellipse(x, y - h/2*sq + 1, w/2/sq*1.05, h/2*sq, 0, 0, Math.PI*2); ctx.fill();
    circ(x - 5*k, y - h*0.6, 2.6*k, '#fff'); circ(x - 6*k, y - h*0.6, 1.3*k, '#123');
    circ(x + 2*k, y - h*0.6, 2.6*k, '#fff'); circ(x + 1*k, y - h*0.6, 1.3*k, '#123');
  } else if (e.type==='bat'){
    const fl = Math.sin(e.t*22)*6, cy = y - h/2;
    ctx.fillStyle = flash ? '#fff' : '#7e52b8';
    ctx.beginPath(); ctx.moveTo(x - 3, cy); ctx.lineTo(x - 15, cy - 4 - fl); ctx.lineTo(x - 9, cy + 3); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 3, cy); ctx.lineTo(x + 15, cy - 4 - fl); ctx.lineTo(x + 9, cy + 3); ctx.closePath(); ctx.fill();
    circ(x, cy, 6.5, flash ? '#fff' : '#9a6fd6'); circ(x - 2.5, cy - 1, 1.4, '#ffdf6b');
  } else if (e.type==='thrower'){
    rr(x - w/2, y - h + 8, w, h - 8, 4, flash ? '#fff' : '#a0703f');
    circ(x, y - h + 4, 7, flash ? '#fff' : '#c79361');
    circ(x - 3, y - h + 3, 1.4, '#222');
    const up = e.phase==='stand' && e.wind;
    ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 4, y - h + 14);
    ctx.lineTo(x - 4 + (up ? 4 : -8), y - h + (up ? -2 : 22)); ctx.stroke();
    if (up){ circ(x, y - h - 6, 5, '#8b8378'); ctx.fillStyle = '#ff4b3a'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', x + 10, y - h - 8); }
  } else if (e.type==='boss'){
    const tele = e.tele > 0 && Math.sin(R.t*30) > 0;
    const lift = e.tele > 0 && e.next==='stomp' ? -6 * Math.min(1, (0.8 - e.tele) * 3) : 0;
    rr(x - w/2, y - h + lift, w, h, 10, flash ? '#fff' : tele ? '#a04a5a' : e.rage ? '#7a3550' : '#5b4a6e');
    rr(x - w/2 + 6, y - h + 6 + lift, w - 12, 10, 4, 'rgba(255,255,255,.08)');
    glow(x - 12, y - h + 26 + lift, 9, '#ff5b4a', 0.8); glow(x + 4, y - h + 26 + lift, 9, '#ff5b4a', 0.8);
    circ(x - 12, y - h + 26 + lift, 4, '#ff8a6b'); circ(x + 4, y - h + 26 + lift, 4, '#ff8a6b');
    rr(x - w/2 - 8, y - h + 34, 10, 26, 4, '#4a3b5c'); rr(x + w/2 - 2, y - h + 34, 10, 26, 4, '#4a3b5c');
  } else {
    // 絵がまだない種類でも見えなくならないように（気づけるよう派手な色）
    rr(x - w/2, y - h, w, h, 4, flash ? '#fff' : '#ff3dc8');
  }
  if (e.poisonT > 0){ ctx.globalAlpha = 0.75; circ(x + vr(-5,5), y - h*0.6 + vr(-3,3), 2.5, '#8fe36a'); ctx.globalAlpha = 1; }
  if (e.burnT > 0){ ctx.globalAlpha = 0.7; circ(x + vr(-4,4), y - h - 2 + vr(-2,2), 3, '#ff8a3a'); ctx.globalAlpha = 1; }
  if (e.type!=='boss' && e.hp < e.maxHp){
    rr(x - 12, y - h - 7, 24, 3, 1, 'rgba(0,0,0,.5)');
    rr(x - 12, y - h - 7, 24*Math.max(0, e.hp/e.maxHp), 3, 1, '#ff5d5d');
  }
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
  outlined(`${Math.floor(R.dist)} m`, VW/2, 22, '#fff');
  ctx.font = '10px -apple-system, sans-serif';
  if (R.boss){
    const b = R.boss;
    rr(VW/2 - 70, 30, 140, 7, 3, 'rgba(0,0,0,.5)');
    rr(VW/2 - 70, 30, 140*Math.max(0, b.hp/b.maxHp), 7, 3, b.rage ? '#ff3b2f' : '#e0507a');
    // 残り時間（怒ってからは赤く点滅）
    const left = Math.max(0, BOSS_LIMIT - (b.fightT || 0));
    if (b.fightT){
      ctx.textAlign = 'center'; ctx.font = `bold ${b.rage ? 11 : 9}px -apple-system, sans-serif`;
      outlined(b.rage ? `怒り！ あと${Math.ceil(left)}秒` : `残り ${Math.ceil(left)}秒`, VW/2, 48, b.rage && Math.sin(R.t*10) > 0 ? '#ff5b4a' : '#ffd0c8');
    }
  } else {
    outlined(`ボスまで ${Math.ceil(R.nextBoss - R.dist)}m ・ 敵Lv${elv()}`, VW/2, 36, '#fff');
  }
  ctx.textAlign = 'right'; ctx.font = 'bold 12px -apple-system, sans-serif';
  outlined(`${fmt(R.gold)} G`, VW - 10, 20, '#ffd36b');
  // 経験値バー（画面の一番上）とレベル
  const S = R.sk;
  rr(0, 0, VW, 4, 0, 'rgba(0,0,0,.4)');
  rr(0, 0, VW * Math.min(1, S.xp / S.need), 4, 0, '#6fd3ff');
  ctx.textAlign = 'left'; ctx.font = 'bold 9px -apple-system, sans-serif';
  outlined(`Lv ${S.lv}`, 10, 34, '#9fe6ff');
  // 持っているスキル
  let ix = 10;
  const icon = (ic, c, lv, evo) => {
    rr(ix, 41, 13, 13, 3, evo ? c : 'rgba(0,0,0,.45)');
    ctx.fillStyle = evo ? '#1a1a1a' : c; ctx.font = 'bold 8px -apple-system, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(ic, ix + 6.5, 50.5);
    if (!evo){ ctx.fillStyle = '#fff'; ctx.font = 'bold 6px -apple-system, sans-serif'; ctx.fillText(lv, ix + 11, 54); }
    ix += 15;
  };
  for (const [id, lv] of Object.entries(S.act)) icon(ACTIVES[id].ic, ACTIVES[id].c, lv, S.evo[id]);
  for (const [id, lv] of Object.entries(S.pas)) icon(PASSIVES[id].ic, PASSIVES[id].c, lv, false);
  if (R.banner.t > 0){
    ctx.globalAlpha = Math.min(1, R.banner.t*2);
    ctx.textAlign = 'center'; ctx.font = 'bold 18px -apple-system, sans-serif';
    outlined(R.banner.txt, VW/2, 78, R.banner.c || '#fff');
    ctx.globalAlpha = 1;
  }
  if (R.paused){ ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, VW, H); }
}
