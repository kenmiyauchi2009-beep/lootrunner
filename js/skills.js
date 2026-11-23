// 出撃中のスキル。経験値でレベルが上がるたびに3択で選び、出撃が終わると消える。
// 役割の分担：
//   スキル＝群れを倒す力。威力は装備と関係なく、敵のレベルに合わせて伸びる。投石兵には効きにくく、ボスには効かない
//   装備　＝本体の強さ。武器の攻撃・踏みつけ・会心・HP・防御。大きい敵を倒し、深いところで耐えるのに必要
import { $ } from './util.js';
import { SAVE } from './save.js';
import { R, PX, GY, VW, VTOP, hit, explode, burst, shake, ecenter, resumeClock, elv, hpScale } from './run.js';
import { dialog, closeDialog } from './ui.js';
import { sfx } from './audio.js';

// 攻撃スキル（最大4つ・各Lv5）。evo：Lv5＋対の強化スキルで進化
export const ACTIVES = {
  blade:  {n:'回転刃',   ic:'刃', c:'#cfe8ff', count:[1,2,2,3,4], dmg:[0.5,0.6,0.7,0.8,1.0],
           evo:{need:'vigor',  n:'守護の円環', desc:'刃が6枚・大きな円に。飛んでくる岩も弾く'}},
  bolt:   {n:'落雷',     ic:'雷', c:'#fff27a', cd:[2.2,2.0,1.8,1.6,1.4], count:[1,1,2,2,3], dmg:[1.6,2.0,2.4,2.8,3.4],
           evo:{need:'haste',  n:'雷雲',       desc:'0.8秒ごとに5体へ落雷'}},
  fire:   {n:'火炎瓶',   ic:'炎', c:'#ff8a3a', cd:[3.0,2.8,2.6,2.4,2.2], width:[50,55,60,70,80], dmg:[0.35,0.4,0.45,0.5,0.6],
           evo:{need:'area',   n:'業火',       desc:'燃える地面が2か所・幅140・4秒に'}},
  quake:  {n:'着地衝撃', ic:'震', c:'#e0c08a', radius:[55,65,75,85,100], dmg:[1.2,1.5,1.8,2.1,2.6],
           evo:{need:'spring', n:'大地割り',   desc:'着地で広い範囲を揺らし、敵を足止めする'}},
  missile:{n:'魔弾',     ic:'弾', c:'#d08bff', cd:[1.4,1.3,1.2,1.1,1.0], count:[1,2,2,3,3], dmg:[0.9,1.0,1.1,1.3,1.5],
           evo:{need:'multi',  n:'流星群',     desc:'0.9秒ごとに空から隕石が6つ降る'}},
  frost:  {n:'冷気',     ic:'氷', c:'#9fe3ff', cd:[3.0,2.8,2.6,2.4,2.2], radius:[60,65,70,80,90], dmg:[0.6,0.7,0.8,0.9,1.1],
           evo:{need:'might',  n:'絶対零度',   desc:'広い範囲の敵を凍らせて止める'}},
};
// 強化スキル（最大4つ・各Lv5）
export const PASSIVES = {
  might: {n:'力',   ic:'力', c:'#ff8a6b', desc:'スキルのダメージ +12%'},
  haste: {n:'連射', ic:'速', c:'#7fe0a8', desc:'スキルの間隔 -8%'},
  area:  {n:'範囲', ic:'広', c:'#7fb8ff', desc:'スキルの範囲 +12%'},
  vigor: {n:'生命', ic:'命', c:'#ff7a9a', desc:'敵を倒すたびにHPが最大の0.2%回復'},
  multi: {n:'多重', ic:'多', c:'#ffd36b', desc:'刃・落雷・魔弾の数 +1（Lv1・3・5で増える）'},
  spring:{n:'跳躍', ic:'跳', c:'#b8e07a', desc:'踏みつけ +40%・着地衝撃 +15%'},
};
const MAX_SLOTS = 4;
export const xpNeed = lv => Math.round(5 + lv*3 + Math.pow(lv, 1.8));
// 敵ごとの経験値
export const XP = {mini:1, slime:2, bat:2, thrower:4, boss:30};

export function initSkills(){
  R.sk = {lv:1, xp:0, need:xpNeed(1), act:{}, pas:{}, evo:{}, cd:{}, ang:0, blades:[], patches:[], flasks:[], meteors:[], gems:[], pending:0, choices:null};
}
function mods(){
  const P = R.sk.pas;
  return {haste:1 - 0.08*(P.haste||0), area:1 + 0.12*(P.area||0), multi:[0,1,1,2,2,3][P.multi||0], spring:P.spring||0};
}
// スキルの基本ダメージ。装備ではなく敵のレベルに合わせて伸びる（群れの敵を数発で倒せる強さ）
export const SKILL_BASE = 8;
export const skillDmg = () => SKILL_BASE * hpScale(elv()) * (1 + 0.12*(R.sk.pas.might||0));
// 強化スキルのうち、本体（装備側）に関わるのは踏みつけだけ
export function applyPassives(){
  R.st.stompMul = 1 + 0.4*(R.sk.pas.spring||0);
}

// ---------- 経験値 ----------
export function dropGem(x, y, v){
  R.sk.gems.push({x, y, v, t:0, vx:(Math.random() - 0.5)*80, vy:-120 - Math.random()*60});
}
export function gainXp(v){
  const S = R.sk;
  S.xp += v * (1 + (R.st.xpGain || 0)/100);   // 装備の「経験値」・賢者の冠
  while (S.xp >= S.need){ S.xp -= S.need; S.lv++; S.need = xpNeed(S.lv); S.pending++; }
}
function updateGems(dt){
  const S = R.sk, tx = PX, ty = R.p.y - 15;
  for (const g of S.gems){
    g.t += dt;
    if (g.t < 0.25){ g.vy += 600*dt; }   // ぽんと跳ねてから
    else {                                // 自分に吸い寄せられる
      const dx = tx - g.x, dy = ty - g.y, d = Math.hypot(dx, dy) || 1, sp = 200 + g.t*900;
      g.vx = dx/d*sp; g.vy = dy/d*sp;
      if (d < 14){ g.dead = true; gainXp(g.v); sfx('gem'); continue; }
    }
    g.x += g.vx*dt; g.y += g.vy*dt;
  }
  S.gems = S.gems.filter(g => !g.dead);
}

// ---------- 毎フレームの処理 ----------
const lvOf = id => R.sk.act[id] - 1;
function cdOf(id){
  const ev = R.sk.evo[id];
  if (id==='bolt') return ev ? 0.8 : ACTIVES.bolt.cd[lvOf(id)];
  if (id==='missile') return ev ? 0.9 : ACTIVES.missile.cd[lvOf(id)];
  if (id==='fire') return ev ? 2.4 : ACTIVES.fire.cd[lvOf(id)];
  if (id==='frost') return ev ? 2.0 : ACTIVES.frost.cd[lvOf(id)];
  return 1;
}
const alive = e => !e.dead && e.hp > 0;
const onGround = e => GY - e.y < 35;

export function updateSkills(dt, scroll){
  const S = R.sk, A = S.act, M = mods(), D = skillDmg(), p = R.p;
  updateGems(dt);
  // 回転刃
  S.blades.length = 0;
  if (A.blade){
    const ev = S.evo.blade, n = (ev ? 6 : ACTIVES.blade.count[lvOf('blade')]) + M.multi;
    const r = (ev ? 54 : 38) * M.area, dmg = D * (ev ? 1.4 : ACTIVES.blade.dmg[lvOf('blade')]);
    S.ang += dt * (ev ? 5 : 4);
    const cx = PX, cy = p.y - 15;
    for (let i=0;i<n;i++){
      const a = S.ang + i*Math.PI*2/n, bx = cx + Math.cos(a)*r, by = cy + Math.sin(a)*r;
      S.blades.push([bx, by, a]);
      for (const e of R.enemies){
        if (!alive(e) || R.t - (e.bladeT ?? -9) < 0.35) continue;
        const [ex, ey] = ecenter(e);
        if (Math.abs(bx - ex) < e.w/2 + 7 && Math.abs(by - ey) < e.h/2 + 7){ e.bladeT = R.t; hit(e, dmg, true, true); }
      }
      if (ev) for (const s of R.eshots) if (s.kind==='rock' && Math.hypot(s.x - bx, s.y - by) < s.r + 9){ s.dead = true; burst(s.x, s.y, '#8b8378', 5); }
    }
  }
  // 間隔ごとに撃つスキル
  for (const id of ['bolt', 'fire', 'missile', 'frost']){
    if (!A[id]) continue;
    S.cd[id] = (S.cd[id] ?? 0.3) - dt;
    if (S.cd[id] > 0) continue;
    S.cd[id] = cdOf(id) * M.haste;
    FIRE[id](D, M);
  }
  // 火炎瓶：飛んでいる瓶 → 燃える地面
  for (const f of S.flasks){
    f.t -= dt;
    const q = 1 - Math.max(0, f.t)/f.T;
    f.x = f.sx + (f.tx - f.sx)*q; f.y = f.sy + (GY - f.sy)*q - Math.sin(q*Math.PI)*45;
    if (f.t <= 0){ f.dead = true; S.patches.push({x:f.tx, w:f.w, t:f.dur, max:f.dur, tick:0, dmg:f.dmg}); sfx('fire'); }
  }
  S.flasks = S.flasks.filter(f => !f.dead);
  for (const f of S.patches){
    f.x -= scroll*dt; f.t -= dt; f.tick -= dt;
    if (f.tick > 0) continue;
    f.tick = 0.3;
    for (const e of R.enemies) if (alive(e) && onGround(e) && Math.abs(e.x - f.x) < f.w/2 + e.w/2) hit(e, f.dmg, true, true);
  }
  S.patches = S.patches.filter(f => f.t > 0);
  // 流星
  for (const m of S.meteors){
    m.y += 650*dt;
    if (m.y >= m.ty){ m.dead = true; explode(m.x, m.ty, m.r, m.dmg, true, true); shake(0.06, 1.5); }
  }
  S.meteors = S.meteors.filter(m => !m.dead);
}

function targets(n){
  const list = R.enemies.filter(e => alive(e) && e.x > PX - 20 && e.x < VW + 10);
  for (let i = list.length - 1; i > 0; i--){ const j = Math.floor(Math.random()*(i+1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list.slice(0, n);
}
const FIRE = {
  bolt(D, M){
    const ev = R.sk.evo.bolt, L = lvOf('bolt');
    const ts = targets((ev ? 5 : ACTIVES.bolt.count[L]) + M.multi);
    if (!ts.length){ R.sk.cd.bolt = 0.2; return; }
    for (const e of ts){
      const [x, y] = ecenter(e);
      explode(x, y, 18*M.area*(ev ? 1.6 : 1), D*(ev ? 3.5 : ACTIVES.bolt.dmg[L]), true, true, 'bolt');
      R.fx.push({kind:'skybolt', x, y, t:0.2, max:0.2});
    }
    sfx('zap');
  },
  fire(D, M){
    const ev = R.sk.evo.fire, L = lvOf('fire');
    const n = ev ? 2 : 1;
    for (let i=0;i<n;i++){
      const tx = PX + 100 + i*90 + Math.random()*30;
      R.sk.flasks.push({sx:PX + 6, sy:R.p.y - 28, x:PX + 6, y:R.p.y - 28, tx, t:0.45, T:0.45,
        w:(ev ? 140 : ACTIVES.fire.width[L]) * M.area, dur:ev ? 4 : 2.5, dmg:D*(ev ? 0.7 : ACTIVES.fire.dmg[L])});
    }
  },
  missile(D, M){
    const ev = R.sk.evo.missile, L = lvOf('missile');
    if (ev){
      const ts = targets(6);
      if (!ts.length){ R.sk.cd.missile = 0.2; return; }
      for (const e of ts){ const [x, y] = ecenter(e); R.sk.meteors.push({x, y:Math.min(VTOP, 0) - 20 - Math.random()*60, ty:y, r:30*M.area, dmg:D*2.2}); }
      sfx('orb');
      return;
    }
    const n = ACTIVES.missile.count[L] + M.multi, cy = R.p.y - 20;
    if (!R.enemies.some(alive)){ R.sk.cd.missile = 0.2; return; }
    for (let i=0;i<n;i++){
      const a = -0.6 - i*0.35;
      R.shots.push({kind:'missile', home:true, x:PX, y:cy, vx:Math.cos(a)*300, vy:Math.sin(a)*300, dmg:D*ACTIVES.missile.dmg[L], pierce:0, hit:[], life:2.2, r:5, noProc:true, quiet:true});
    }
    sfx('orb');
  },
  frost(D, M){
    const ev = R.sk.evo.frost, L = lvOf('frost');
    const r = (ev ? 120 : ACTIVES.frost.radius[L]) * M.area, cx = PX, cy = R.p.y - 15;
    for (const e of R.enemies){
      if (!alive(e)) continue;
      const [ex, ey] = ecenter(e);
      if (Math.hypot(ex - cx, ey - cy) > r + e.w/2) continue;
      hit(e, D*(ev ? 1.8 : ACTIVES.frost.dmg[L]), true, true);
      if (e.type !== 'boss'){ if (ev) e.stun = Math.max(e.stun || 0, 1.2); else e.slow = Math.max(e.slow || 0, 1.5); }
    }
    R.fx.push({kind:'frost', x:cx, y:cy, r, t:0.35, max:0.35});
    sfx('frost');
  },
};
// 着地したとき（run.js から呼ぶ）
export function onLand(){
  const S = R.sk;
  if (!S.act.quake) return;
  const ev = S.evo.quake, M = mods(), L = lvOf('quake');
  const r = (ev ? 170 : ACTIVES.quake.radius[L]) * M.area;
  const dmg = skillDmg() * (ev ? 3.5 : ACTIVES.quake.dmg[L]) * (1 + 0.15*M.spring);
  for (const e of R.enemies){
    if (!alive(e) || !onGround(e) || Math.abs(e.x - PX) > r) continue;
    hit(e, dmg, true, true);
    if (e.type !== 'boss'){ e.x += 18 * Math.sign(e.x - PX || 1); if (ev) e.stun = Math.max(e.stun || 0, 0.8); }
  }
  R.fx.push({kind:'quake', x:PX, r, t:0.3, max:0.3});
  shake(0.1, ev ? 3.5 : 2);
  sfx('stomp');
}

// ---------- レベルアップの3択 ----------
function options(){
  const S = R.sk, A = S.act, P = S.pas, out = [];
  const nA = Object.keys(A).length, nP = Object.keys(P).length;
  for (const id in ACTIVES){
    const ev = ACTIVES[id].evo;
    if (A[id] === 5 && !S.evo[id] && P[ev.need]) out.push({k:'evo', id, w:100});
    else if (A[id] && A[id] < 5) out.push({k:'act', id, w:1.3});
    else if (!A[id] && nA < MAX_SLOTS) out.push({k:'act', id, w:1});
  }
  for (const id in PASSIVES){
    if (P[id] && P[id] < 5) out.push({k:'pas', id, w:1});
    else if (!P[id] && nP < MAX_SLOTS) out.push({k:'pas', id, w:0.9});
  }
  // 最初のレベルアップは攻撃スキルから
  const pool = nA === 0 ? out.filter(o => o.k === 'act') : out;
  const picks = [];
  while (picks.length < 3 && pool.length){
    let r = Math.random() * pool.reduce((s, o) => s + o.w, 0), i = 0;
    while ((r -= pool[i].w) > 0 && i < pool.length - 1) i++;
    picks.push(pool.splice(i, 1)[0]);
  }
  if (picks.length < 3) picks.push({k:'heal'}, {k:'gold'});
  return picks.slice(0, 3);
}
function actText(id, lv){
  // 威力：スキル同士で比べるための数字（100＝群れの小さいスライムをほぼ1発）
  const A = ACTIVES[id], i = lv - 1, pw = v => `威力${Math.round(v*100)}`;
  switch (id){
    case 'blade':   return `刃${A.count[i]}枚が周りを回る（${pw(A.dmg[i])}）`;
    case 'bolt':    return `${A.cd[i]}秒ごとに${A.count[i]}体へ落雷（${pw(A.dmg[i])}）`;
    case 'fire':    return `${A.cd[i]}秒ごとに前の地面を燃やす（幅${A.width[i]}・0.3秒ごとに${pw(A.dmg[i])}）`;
    case 'quake':   return `着地すると周り${A.radius[i]}の地上の敵に${pw(A.dmg[i])}`;
    case 'missile': return `${A.cd[i]}秒ごとに追尾弾${A.count[i]}発（${pw(A.dmg[i])}）`;
    case 'frost':   return `${A.cd[i]}秒ごとに周り${A.radius[i]}へ冷気（${pw(A.dmg[i])}・敵が遅くなる）`;
  }
}
function card(o, i){
  const S = R.sk;
  let ic, c, name, badge, desc, cls = o.k;
  if (o.k === 'act'){
    const A = ACTIVES[o.id], cur = S.act[o.id] || 0;
    ({ic, c} = A); name = A.n; badge = cur ? `Lv${cur}→${cur + 1}` : 'NEW';
    desc = actText(o.id, cur + 1) + `<span class="evohint">進化：Lv5＋${PASSIVES[A.evo.need].n}</span>`;
  } else if (o.k === 'pas'){
    const P = PASSIVES[o.id], cur = S.pas[o.id] || 0;
    ({ic, c} = P); name = P.n; badge = cur ? `Lv${cur}→${cur + 1}` : 'NEW';
    const evoOf = Object.values(ACTIVES).filter(a => a.evo.need === o.id).map(a => a.n);
    desc = P.desc + `<span class="evohint">${evoOf.join('・')}の進化に必要</span>`;
  } else if (o.k === 'evo'){
    const A = ACTIVES[o.id];
    ic = A.ic; c = A.c; name = `${A.n} → ${A.evo.n}`; badge = '進化'; desc = A.evo.desc;
  } else if (o.k === 'heal'){ ic = '癒'; c = '#5fd17a'; name = '回復'; badge = ''; desc = 'HPを30%回復する'; }
  else { ic = '金'; c = '#ffd36b'; name = 'ゴールド'; badge = ''; desc = `${goldBonus()}G を手に入れる`; }
  return `<button class="lvcard ${cls}" data-i="${i}" style="--c:${c}"><span class="lvic">${ic}</span>
    <span class="lvt"><b>${name}</b>${badge ? `<em>${badge}</em>` : ''}<small>${desc}</small></span></button>`;
}
const goldBonus = () => 20 * R.sk.lv;

export function openLevelUp(){
  const S = R.sk;
  S.choices = options();
  R.levelup = true; R.p.hold = false;
  sfx('lvup');
  dialog(`<h2>レベルアップ！</h2><p class="lvsub">Lv ${S.lv - S.pending + 1}${S.pending > 1 ? `（あと${S.pending - 1}回）` : ''} ・ 1つ選ぶ<br>
    <small>スキルは群れに強い。投石兵には効きにくく、ボスには効かない（ボスは装備の武器で倒す）</small></p>
    <div class="lvcards arming">${S.choices.map(card).join('')}</div>`);
  const box = $('dcard').querySelector('.lvcards');
  setTimeout(() => box.classList.remove('arming'), 350);   // 表示直後のタップ（ジャンプのつもり）で選ばないように
  box.querySelectorAll('.lvcard').forEach(b => b.onclick = () => pickSkill(Number(b.dataset.i)));
}
export function pickSkill(i){
  const S = R.sk, o = S.choices && S.choices[i];
  if (!o) return;
  if (o.k === 'act'){ S.act[o.id] = (S.act[o.id] || 0) + 1; S.cd[o.id] = Math.min(S.cd[o.id] ?? 0.3, 0.3); }
  else if (o.k === 'pas'){ S.pas[o.id] = (S.pas[o.id] || 0) + 1; applyPassives(); }
  else if (o.k === 'evo'){ S.evo[o.id] = true; R.banner = {t:2, txt:`進化！ ${ACTIVES[o.id].evo.n}`, c:ACTIVES[o.id].c}; R.flash = {c:ACTIVES[o.id].c, t:0.3, max:0.3}; }
  else if (o.k === 'heal') R.p.hp = Math.min(R.p.maxHp, R.p.hp + R.p.maxHp*0.3);
  else { const g = goldBonus(); SAVE.gold += g; R.gold += g; }
  S.pending--; S.choices = null;
  if (S.pending > 0){ openLevelUp(); return; }
  closeDialog();
  R.levelup = false;
  R.p.inv = Math.max(R.p.inv, 0.5);
  resumeClock();
}

// 結果画面・一時停止画面に出す一覧
export function skillSummary(){
  const S = R.sk;
  const a = Object.entries(S.act).map(([id, lv]) => S.evo[id] ? `<b style="color:${ACTIVES[id].c}">${ACTIVES[id].evo.n}</b>` : `${ACTIVES[id].n} Lv${lv}`);
  const p = Object.entries(S.pas).map(([id, lv]) => `${PASSIVES[id].n} Lv${lv}`);
  return `Lv ${S.lv}${a.length || p.length ? ' ・ ' + [...a, ...p].join('、') : ''}`;
}
