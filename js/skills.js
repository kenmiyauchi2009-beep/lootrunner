// 出撃中のスキル。経験値でレベルが上がるたびに3択で選び、出撃が終わると消える。
// 役割の分担：
//   スキル＝群れを倒す力。威力は装備と関係なく、敵のレベルに合わせて伸びる。投石兵には効きにくく、ボスには効かない
//           （障壁・時の砂のような補助スキルはボス戦でも役に立つ）
//   装備　＝本体の強さ。武器の攻撃・踏みつけ・会心・HP・防御。大きい敵を倒し、深いところで耐えるのに必要
// lock：訓練所のこのレベルで解放される（0＝最初から）
import { $ } from './util.js';
import { SAVE } from './save.js';
import { R, PX, GY, VW, VTOP, hit, burst, shake, ecenter, resumeClock, foeHp } from './run.js';
import { skillSvg } from './skillart.js';
import { dialog, closeDialog } from './ui.js';
import { sfx } from './audio.js';
import { trainPerks } from './meta.js';

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
  // ---- 訓練所で解放 ----
  barrier:{n:'障壁',     ic:'壁', c:'#8fd8ff', lock:1, cd:[12,11,10,9,8], dmg:[1.0,1.3,1.6,2.0,2.5], util:1,
           evo:{need:'guard',  n:'聖盾',       desc:'障壁を2枚まで張れる・5秒ごと。割れると周りに大きな衝撃'}},
  boomer: {n:'ブーメラン', ic:'環', c:'#ffc46b', lock:3, cd:[2.0,1.9,1.8,1.7,1.5], count:[1,1,2,2,3], dmg:[1.0,1.2,1.4,1.6,2.0],
           evo:{need:'edge',   n:'双月輪',     desc:'大きな輪が4つ・行きと帰りで2回当たる'}},
  aura:   {n:'聖域',     ic:'聖', c:'#fff0a8', lock:5, radius:[45,50,55,62,70], dmg:[0.35,0.42,0.5,0.58,0.7],
           evo:{need:'magnet', n:'祝福の地',   desc:'範囲が110に広がり、中の敵が遅くなる'}},
  mine:   {n:'地雷',     ic:'地', c:'#ff9d6b', lock:7, cd:[2.6,2.4,2.2,2.0,1.8], radius:[40,44,48,52,60], dmg:[1.6,1.9,2.2,2.6,3.2],
           evo:{need:'blast',  n:'連鎖地雷',   desc:'1秒ごとに設置・爆発が大きくなり、小さな地雷が飛び散る'}},
  lance:  {n:'光線',     ic:'光', c:'#ffffff', lock:8, cd:[2.8,2.6,2.4,2.2,2.0], width:[14,16,18,20,24], dmg:[1.6,2.0,2.4,2.8,3.4],
           evo:{need:'focus',  n:'天の裁き',   desc:'高さの違う3本の光線を1.6秒ごとに放つ'}},
  time:   {n:'時の砂',   ic:'時', c:'#c9b6ff', lock:9, cd:[12,11,10,9,8], dur:[2.0,2.4,2.8,3.2,3.6], util:1,
           evo:{need:'luck',   n:'運命の砂時計', desc:'8秒ごとに3秒、時がほぼ止まる。受けるダメージ +40%・倒した敵は装備を落としやすい'}},
};
// 強化スキル（最大4つ・各Lv5）
export const PASSIVES = {
  might: {n:'力',   ic:'力', c:'#ff8a6b', desc:'スキルのダメージ +12%'},
  haste: {n:'連射', ic:'速', c:'#7fe0a8', desc:'スキルの間隔 -8%'},
  area:  {n:'範囲', ic:'広', c:'#7fb8ff', desc:'スキルの範囲 +12%'},
  vigor: {n:'生命', ic:'命', c:'#ff7a9a', desc:'敵を倒すたびにHPが最大の0.2%回復'},
  multi: {n:'多重', ic:'多', c:'#ffd36b', desc:'刃・落雷・魔弾・ブーメランの数 +1（Lv1・3・5で増える）'},
  spring:{n:'跳躍', ic:'跳', c:'#b8e07a', desc:'踏みつけ +40%・着地衝撃 +15%'},
  // ---- 訓練所で解放 ----
  guard: {n:'守り', ic:'守', c:'#8fb8d8', lock:1, desc:'受けるダメージ -5%（ボスの攻撃にも効く）'},
  edge:  {n:'鋭さ', ic:'鋭', c:'#ffe14d', lock:3, desc:'スキルが6%で会心（2倍）'},
  magnet:{n:'引力', ic:'引', c:'#7fe8ff', lock:5, desc:'経験値 +8%・結晶を遠くから吸い寄せる'},
  blast: {n:'爆薬', ic:'爆', c:'#ff9d6b', lock:7, desc:'爆発（落雷・地雷・流星・着地衝撃）の範囲 +12%・威力 +8%'},
  focus: {n:'集中', ic:'集', c:'#ffffff', lock:8, desc:'投石兵・盾兵・大スライム・エリートへのスキルダメージ +20%'},
  luck:  {n:'幸運', ic:'運', c:'#7fe0a8', lock:9, desc:'装備のドロップ率 +10%'},
};
export const ALL_SKILLS = {...ACTIVES, ...PASSIVES};
export const unlocked = id => (ALL_SKILLS[id].lock || 0) <= (SAVE.fac?.train || 0);
// 訓練所で「出さない」にしたスキルはカードに出ない（攻撃・強化それぞれ最低6種は残す）
export const offered = id => unlocked(id) && !SAVE.skill.off[id];
export const MIN_ON = 6;
const MAX_SLOTS = 4;
export const xpNeed = lv => Math.round(5 + lv*3 + Math.pow(lv, 1.8));
// 敵ごとの経験値
export const XP = {mini:1, slime:2, bat:2, thrower:4, shield:3, boar:3, bigslime:3, mole:3, bomber:2, ghost:2, chest:0, boss:30};

export function initSkills(){
  const T = trainPerks();
  R.sk = {lv:1, xp:0, need:xpNeed(1), act:{}, pas:{}, evo:{}, cd:{}, ang:0, blades:[], patches:[], flasks:[], meteors:[], gems:[],
    booms:[], mines:[], shield:0, slowT:0, slowF:1, auraT:0, pending:0, choices:null, rerolls:T.rerolls, picks:0};
  // 訓練所：最初のスキルを持って出る
  const s = SAVE.skill.start;
  if (T.startPick && s && ACTIVES[s] && unlocked(s)){ R.sk.act[s] = 1; R.sk.cd[s] = 0.3; }
}
function mods(){
  const P = R.sk.pas;
  return {haste:1 - 0.08*(P.haste||0), area:1 + 0.12*(P.area||0), multi:[0,1,1,2,2,3][P.multi||0], spring:P.spring||0,
    blastR:1 + 0.12*(P.blast||0), blastD:1 + 0.08*(P.blast||0)};
}
// スキルの基本ダメージ。装備ではなく敵のレベルに合わせて伸びる（群れの敵を数発で倒せる強さ）
export const SKILL_BASE = 8;
export const skillDmg = () => SKILL_BASE * foeHp() * (1 + 0.12*(R.sk.pas.might||0));
// 強化スキルのうち、本体（装備側）に関わるもの：踏みつけ・受けるダメージ・ドロップ率
export function applyPassives(){
  const P = R.sk.pas;
  R.st.stompMul = 1 + 0.4*(P.spring||0);
  R.st.taken = 1 - 0.05*(P.guard||0);
  R.st.drop = R.base.drop + 10*(P.luck||0);
}
// スキルの命中：集中（大物に強く）・鋭さ（会心）
const BIG = {thrower:1, shield:1, bigslime:1};
function sHit(e, d){
  const P = R.sk.pas;
  let m = 1, crit = false;
  if (P.focus && (BIG[e.type] || e.elite)) m *= 1 + 0.2*P.focus;
  if (P.edge && Math.random() < 0.06*P.edge){ m *= 2; crit = true; }
  return hit(e, d*m, true, true, crit);
}
export const skillHit = sHit;
function sExplode(x, y, r, d){
  for (const e of R.enemies){
    if (!alive(e)) continue;
    const [ex, ey] = ecenter(e);
    if (Math.hypot(ex - x, ey - y) < r + e.w/2) sHit(e, d);
  }
}

// ---------- 経験値 ----------
export function dropGem(x, y, v){
  R.sk.gems.push({x, y, v, t:0, vx:(Math.random() - 0.5)*80, vy:-120 - Math.random()*60});
}
// チェックポイントから出撃したとき：lv までのレベルアップをまとめて選ぶ
export function catchUp(lv){
  const S = R.sk;
  while (S.lv < lv){ S.lv++; S.pending++; }
  S.need = xpNeed(S.lv);
}
export function gainXp(v){
  const S = R.sk;
  S.xp += v * (1 + (R.st.xpGain || 0)/100 + 0.08*(S.pas.magnet || 0)) * (R.xpMul || 1);   // 装備の「経験値」・賢者の冠・引力・日替わり
  while (S.xp >= S.need){ S.xp -= S.need; S.lv++; S.need = xpNeed(S.lv); S.pending++; }
}
function updateGems(dt){
  const S = R.sk, tx = PX, ty = R.p.y - 15, pull = S.pas.magnet ? 0.12 : 0.25;
  for (const g of S.gems){
    g.t += dt;
    if (g.t < pull){ g.vy += 600*dt; }   // ぽんと跳ねてから
    else {                                // 自分に吸い寄せられる
      const dx = tx - g.x, dy = ty - g.y, d = Math.hypot(dx, dy) || 1, sp = 200 + g.t*(S.pas.magnet ? 1600 : 900);
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
  const ev = R.sk.evo[id], A = ACTIVES[id], L = lvOf(id);
  const evCd = {bolt:0.8, missile:0.9, fire:2.4, frost:2.0, boomer:1.6, mine:1.0, lance:1.6, barrier:5, time:8};
  return ev && evCd[id] ? evCd[id] : A.cd ? A.cd[L] : 1;
}
const alive = e => !e.dead && e.hp > 0 && !e.under;
const onGround = e => GY - e.y < 35;
const TIMED = ['bolt', 'fire', 'missile', 'frost', 'boomer', 'mine', 'lance', 'barrier', 'time'];

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
        if (Math.abs(bx - ex) < e.w/2 + 7 && Math.abs(by - ey) < e.h/2 + 7){ e.bladeT = R.t; sHit(e, dmg); }
      }
      if (ev) for (const s of R.eshots) if (s.kind==='rock' && Math.hypot(s.x - bx, s.y - by) < s.r + 9){ s.dead = true; burst(s.x, s.y, '#8b8378', 5); }
    }
  }
  // 聖域：周りの敵に0.5秒ごと
  if (A.aura){
    const ev = S.evo.aura, r = (ev ? 110 : ACTIVES.aura.radius[lvOf('aura')]) * M.area;
    S.auraR = r;
    if ((S.auraT -= dt) <= 0){
      S.auraT = 0.5;
      const dmg = D * (ev ? 0.9 : ACTIVES.aura.dmg[lvOf('aura')]);
      for (const e of R.enemies){
        if (!alive(e)) continue;
        const [ex, ey] = ecenter(e);
        if (Math.hypot(ex - PX, ey - (p.y - 15)) > r + e.w/2) continue;
        sHit(e, dmg);
        if (ev && e.type !== 'boss') e.slow = Math.max(e.slow || 0, 0.6);
      }
    }
  } else S.auraR = 0;
  // 間隔ごとに撃つスキル
  for (const id of TIMED){
    if (!A[id]) continue;
    if (id === 'barrier' && S.shield >= (S.evo.barrier ? 2 : 1)){ S.cd[id] = cdOf(id) * M.haste; continue; }   // 張っているあいだは数えない
    S.cd[id] = (S.cd[id] ?? 0.3) - dt;
    if (S.cd[id] > 0) continue;
    S.cd[id] = cdOf(id) * M.haste;
    FIRE[id](D, M);
  }
  // 時の砂
  if (S.slowT > 0){ S.slowT -= dt; if (S.slowT <= 0){ S.slowF = 1; S.dropMul = 1; } }
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
    for (const e of R.enemies) if (alive(e) && onGround(e) && Math.abs(e.x - f.x) < f.w/2 + e.w/2) sHit(e, f.dmg);
  }
  S.patches = S.patches.filter(f => f.t > 0);
  // 流星
  for (const m of S.meteors){
    m.y += 650*dt;
    if (m.y >= m.ty){ m.dead = true; R.fx.push({kind:'boom', x:m.x, y:m.ty, r:m.r, t:0.3, max:0.3}); sExplode(m.x, m.ty, m.r, m.dmg); shake(0.06, 1.5); }
  }
  S.meteors = S.meteors.filter(m => !m.dead);
  // ブーメラン：前へ飛んで戻ってくる。行き・帰りで1回ずつ当たる
  for (const b of S.booms){
    b.t += dt;
    const q = Math.min(1, b.t / b.T), back = q > 0.5;
    b.x = PX + 8 + b.range * Math.sin(q*Math.PI);
    b.y = b.y0 + (p.y - 15 - b.y0) * q;   // 戻りは自分の高さへ
    b.spin += dt*16;
    if (back && !b.back){ b.back = true; b.hit = []; }
    for (const e of R.enemies){
      if (!alive(e) || b.hit.includes(e.id)) continue;
      const [ex, ey] = ecenter(e);
      if (Math.abs(b.x - ex) < e.w/2 + b.r && Math.abs(b.y - ey) < e.h/2 + b.r){ b.hit.push(e.id); sHit(e, b.dmg); }
    }
    if (q >= 1) b.dead = true;
  }
  S.booms = S.booms.filter(b => !b.dead);
  // 地雷：地面と一緒に流れ、地上の敵が乗ると爆発
  for (const m of S.mines){
    m.x -= scroll*dt; m.t -= dt; if (m.arm > 0) m.arm -= dt;
    if (m.x < -20 || m.t <= 0){ m.dead = true; continue; }
    if (m.arm > 0) continue;
    if (R.enemies.some(e => alive(e) && onGround(e) && e.type !== 'boss' && Math.abs(e.x - m.x) < e.w/2 + 6)){
      m.dead = true;
      R.fx.push({kind:'boom', x:m.x, y:GY - 6, r:m.r, t:0.3, max:0.3, c:'#ff9d6b'});
      sExplode(m.x, GY - 8, m.r, m.dmg); shake(0.08, 2); sfx('stomp');
      if (m.cluster) for (const dx of [-34, 30, 64]) S.mines.push({x:m.x + dx, t:3, arm:0.25, r:m.r*0.6, dmg:m.dmg*0.5});
    }
  }
  S.mines = S.mines.filter(m => !m.dead);
}

function targets(n){
  const list = R.enemies.filter(e => alive(e) && e.x > PX - 20 && e.x < VW + 10);
  for (let i = list.length - 1; i > 0; i--){ const j = Math.floor(Math.random()*(i+1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list.slice(0, n);
}
const anyFoe = () => R.enemies.some(e => alive(e) && e.type !== 'boss' && e.x < VW + 10);
const FIRE = {
  bolt(D, M){
    const ev = R.sk.evo.bolt, L = lvOf('bolt');
    const ts = targets((ev ? 5 : ACTIVES.bolt.count[L]) + M.multi);
    if (!ts.length){ R.sk.cd.bolt = 0.2; return; }
    for (const e of ts){
      const [x, y] = ecenter(e);
      sExplode(x, y, 18*M.area*M.blastR*(ev ? 1.6 : 1), D*M.blastD*(ev ? 3.5 : ACTIVES.bolt.dmg[L]));
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
      for (const e of ts){ const [x, y] = ecenter(e); R.sk.meteors.push({x, y:Math.min(VTOP, 0) - 20 - Math.random()*60, ty:y, r:30*M.area*M.blastR, dmg:D*2.2*M.blastD}); }
      sfx('orb');
      return;
    }
    const n = ACTIVES.missile.count[L] + M.multi, cy = R.p.y - 20;
    if (!R.enemies.some(alive)){ R.sk.cd.missile = 0.2; return; }
    for (let i=0;i<n;i++){
      const a = -0.6 - i*0.35;
      R.shots.push({kind:'missile', home:true, x:PX, y:cy, vx:Math.cos(a)*300, vy:Math.sin(a)*300, dmg:D*ACTIVES.missile.dmg[L], pierce:0, hit:[], life:2.2, r:5, onHit:sHit});
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
      sHit(e, D*(ev ? 1.8 : ACTIVES.frost.dmg[L]));
      if (e.type !== 'boss'){ if (ev) e.stun = Math.max(e.stun || 0, 1.2); else e.slow = Math.max(e.slow || 0, 1.5); }
    }
    R.fx.push({kind:'frost', x:cx, y:cy, r, t:0.35, max:0.35});
    sfx('frost');
  },
  boomer(D, M){
    const ev = R.sk.evo.boomer, L = lvOf('boomer');
    if (!anyFoe()){ R.sk.cd.boomer = 0.2; return; }
    const n = (ev ? 4 : ACTIVES.boomer.count[L]) + (ev ? 0 : M.multi);
    const ys = [0, -26, 12, -48, -14, 24];
    for (let i = 0; i < n; i++){
      R.sk.booms.push({t:-i*0.12, T:1.3, range:150*M.area, y0:R.p.y - 15 + ys[i % ys.length], x:PX, y:R.p.y - 15, spin:0,
        r:(ev ? 13 : 8)*M.area, dmg:D*(ev ? 2.4 : ACTIVES.boomer.dmg[L]), hit:[], back:false, big:!!ev});
    }
    sfx('slash');
  },
  mine(D, M){
    const ev = R.sk.evo.mine, L = lvOf('mine');
    R.sk.mines.push({x:PX + 50 + Math.random()*90, t:6, arm:0.3, r:(ev ? 75 : ACTIVES.mine.radius[L])*M.area*M.blastR,
      dmg:D*M.blastD*(ev ? 3.6 : ACTIVES.mine.dmg[L]), cluster:!!ev});
  },
  lance(D, M){
    const ev = R.sk.evo.lance, L = lvOf('lance');
    if (!anyFoe()){ R.sk.cd.lance = 0.2; return; }
    const w = (ev ? 24 : ACTIVES.lance.width[L]) * M.area, dmg = D*(ev ? 3.2 : ACTIVES.lance.dmg[L]);
    const ys = ev ? [GY - 12, GY - 50, GY - 95] : [R.p.y - 15];
    for (const y of ys){
      for (const e of R.enemies){
        if (!alive(e) || e.x < PX) continue;
        const [, ey] = ecenter(e);
        if (Math.abs(ey - y) < e.h/2 + w/2) sHit(e, dmg);
      }
      R.fx.push({kind:'beam', x:PX + 10, y, w, t:0.25, max:0.25});
    }
    sfx('zap');
  },
  barrier(){
    const S = R.sk;
    S.shield = Math.min(S.evo.barrier ? 2 : 1, S.shield + 1);
    sfx('frost');
  },
  time(){
    const S = R.sk, ev = S.evo.time, L = lvOf('time');
    S.slowT = ev ? 3 : ACTIVES.time.dur[L];
    S.slowF = ev ? 0.15 : 0.4;
    S.dropMul = ev ? 2 : 1;
    R.flash = {c:'#c9b6ff', t:0.25, max:0.25};
    sfx('orb');
  },
};
// 被弾の直前に呼ぶ（run.js）。障壁があれば受け止めて true
export function absorbHit(){
  const S = R.sk;
  if (!S || S.shield <= 0) return false;
  S.shield--;
  const L = lvOf('barrier'), ev = S.evo.barrier, r = ev ? 110 : 65;
  const y = R.p.y - 15;
  sExplode(PX, y, r, skillDmg() * (ev ? 3 : ACTIVES.barrier.dmg[L]));
  R.fx.push({kind:'ring', x:PX, y, r, t:0.3, max:0.3, c:'143,216,255'});
  R.p.inv = Math.max(R.p.inv, 0.6);
  shake(0.12, 2); sfx('crit');
  R.blocked = (R.blocked || 0) + 1;
  return true;
}
// 着地したとき（run.js から呼ぶ）
export function onLand(){
  const S = R.sk;
  if (!S.act.quake) return;
  const ev = S.evo.quake, M = mods(), L = lvOf('quake');
  const r = (ev ? 170 : ACTIVES.quake.radius[L]) * M.area * M.blastR;
  const dmg = skillDmg() * (ev ? 3.5 : ACTIVES.quake.dmg[L]) * (1 + 0.15*M.spring) * M.blastD;
  for (const e of R.enemies){
    if (!alive(e) || !onGround(e) || Math.abs(e.x - PX) > r) continue;
    sHit(e, dmg);
    if (e.type !== 'boss'){ e.x += 18 * Math.sign(e.x - PX || 1); if (ev) e.stun = Math.max(e.stun || 0, 0.8); }
  }
  R.fx.push({kind:'quake', x:PX, r, t:0.3, max:0.3});
  shake(0.1, ev ? 3.5 : 2);
  sfx('stomp');
}

// ---------- レベルアップの3択 ----------
function options(exclude = []){
  const S = R.sk, A = S.act, P = S.pas, out = [];
  const nA = Object.keys(A).length, nP = Object.keys(P).length;
  const skip = o => exclude.some(x => x.k === o.k && x.id === o.id);
  for (const id in ACTIVES){
    if (!offered(id) && !A[id]) continue;
    const ev = ACTIVES[id].evo;
    if (A[id] === 5 && !S.evo[id] && P[ev.need]) out.push({k:'evo', id, w:100});
    else if (A[id] && A[id] < 5) out.push({k:'act', id, w:1.6});
    else if (!A[id] && nA < MAX_SLOTS) out.push({k:'act', id, w:1});
  }
  for (const id in PASSIVES){
    if (!offered(id) && !P[id]) continue;
    // 持っている攻撃スキルの進化に必要な強化スキルは出やすい
    const wanted = Object.keys(A).some(a => ACTIVES[a].evo.need === id);
    if (P[id] && P[id] < 5) out.push({k:'pas', id, w:wanted ? 1.3 : 1});
    else if (!P[id] && nP < MAX_SLOTS) out.push({k:'pas', id, w:wanted ? 2.2 : 0.9});
  }
  // 最初のレベルアップは攻撃スキルから
  let pool = nA === 0 ? out.filter(o => o.k === 'act') : out;
  const fresh = pool.filter(o => !skip(o));
  if (fresh.length >= 3) pool = fresh;
  const picks = [];
  // 保証：持っている攻撃スキルの強化（か進化）を1枚は入れる。選べるスキルが多くても、育てたいものが育つように
  const own = pool.filter(o => o.k === 'evo' || (o.k === 'act' && A[o.id]));
  if (own.length){ const o = own[Math.floor(Math.random()*own.length)]; picks.push(o); pool.splice(pool.indexOf(o), 1); }
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
    case 'barrier': return `${A.cd[i]}秒ごとに障壁を張り、攻撃を1回防ぐ（ボスの攻撃も）。割れると周りに${pw(A.dmg[i])}`;
    case 'boomer':  return `${A.cd[i]}秒ごとにブーメラン${A.count[i]}個。行きと帰りで当たる（${pw(A.dmg[i])}）`;
    case 'aura':    return `周り${A.radius[i]}の敵に0.5秒ごとに${pw(A.dmg[i])}`;
    case 'mine':    return `${A.cd[i]}秒ごとに前の地面へ地雷。地上の敵が乗ると爆発（範囲${A.radius[i]}・${pw(A.dmg[i])}）`;
    case 'lance':   return `${A.cd[i]}秒ごとに自分の高さへ光線。一直線の敵すべてに${pw(A.dmg[i])}`;
    case 'time':    return `${A.cd[i]}秒ごとに${A.dur[i]}秒、敵と敵の弾が遅くなり、受けるダメージ +25%（ボスも）`;
  }
}
function card(o, i){
  const S = R.sk;
  let ic, c, name, badge, desc, cls = o.k;
  if (o.k === 'act'){
    const A = ACTIVES[o.id], cur = S.act[o.id] || 0;
    ({ic, c} = A); name = A.n + (A.util ? '<span class="util">補助</span>' : ''); badge = cur ? `Lv${cur}→${cur + 1}` : 'NEW';
    desc = actText(o.id, cur + 1) + `<span class="evohint">${A.util ? '敵を倒す力は弱い。ボス戦で役立つ ・ ' : ''}進化：Lv5＋${PASSIVES[A.evo.need].n}${S.pas[A.evo.need] ? '（持っている）' : ''}</span>`;
  } else if (o.k === 'pas'){
    const P = PASSIVES[o.id], cur = S.pas[o.id] || 0;
    ({ic, c} = P); name = P.n; badge = cur ? `Lv${cur}→${cur + 1}` : 'NEW';
    const evoOf = Object.entries(ACTIVES).filter(([, a]) => a.evo.need === o.id).map(([id, a]) => a.n + (S.act[id] ? `（Lv${S.act[id]}）` : ''));
    desc = P.desc + `<span class="evohint">${evoOf.join('・')}の進化に必要</span>`;
  } else if (o.k === 'evo'){
    const A = ACTIVES[o.id];
    ic = A.ic; c = A.c; name = `${A.n} → ${A.evo.n}`; badge = '進化'; desc = A.evo.desc;
  } else if (o.k === 'heal'){ c = '#5fd17a'; name = '回復'; badge = ''; desc = 'HPを30%回復する'; }
  else { c = '#ffd36b'; name = 'ゴールド'; badge = ''; desc = `${goldBonus()}G を手に入れる`; }
  const art = o.k === 'heal' ? 'heal' : o.k === 'gold' || !o.id ? 'gold' : o.id;
  return `<button class="lvcard ${cls}" data-i="${i}" style="--c:${c}"><span class="lvic ${o.k === 'pas' ? 'sq' : ''}">${skillSvg(art)}</span>
    <span class="lvt"><b>${name}</b>${badge ? `<em>${badge}</em>` : ''}<small>${desc}</small></span></button>`;
}
const goldBonus = () => 20 * R.sk.lv;

export function openLevelUp(keep){
  const S = R.sk;
  if (!keep) S.choices = options();
  R.levelup = true; R.p.hold = false;
  if (!keep) sfx('lvup');
  dialog(`<h2>レベルアップ！</h2><p class="lvsub">Lv ${S.lv - S.pending + 1}${S.pending > 1 ? `（あと${S.pending - 1}回）` : ''} ・ 1つ選ぶ<br>
    <small>スキルは群れに強い。投石兵には効きにくく、ボスには効かない（ボスは装備の武器で倒す）</small></p>
    <div class="lvcards ${keep ? '' : 'arming'}">${S.choices.map(card).join('')}</div>
    ${S.rerolls > 0 ? `<div class="btns"><button id="lvReroll">引き直す（残り${S.rerolls}回）</button></div>` : ''}`);
  const box = $('dcard').querySelector('.lvcards');
  if (!keep) setTimeout(() => box.classList.remove('arming'), 350);   // 表示直後のタップ（ジャンプのつもり）で選ばないように
  box.querySelectorAll('.lvcard').forEach(b => b.onclick = () => pickSkill(Number(b.dataset.i)));
  if ($('lvReroll')) $('lvReroll').onclick = rerollSkills;
}
// 引き直し（訓練所）：今の3枚とは別のカードを引く
export function rerollSkills(){
  const S = R.sk;
  if (!S.choices || S.rerolls <= 0) return false;
  S.rerolls--;
  S.choices = options(S.choices);
  openLevelUp(true);
  return true;
}
export function pickSkill(i){
  const S = R.sk, o = S.choices && S.choices[i];
  if (!o) return;
  const seen = SAVE.skill.seen;
  if (o.k === 'act'){ S.act[o.id] = (S.act[o.id] || 0) + 1; S.cd[o.id] = Math.min(S.cd[o.id] ?? 0.3, 0.3); seen[o.id] = 1; }
  else if (o.k === 'pas'){ S.pas[o.id] = (S.pas[o.id] || 0) + 1; applyPassives(); seen[o.id] = 1; }
  else if (o.k === 'evo'){
    S.evo[o.id] = true; SAVE.skill.evo[o.id] = 1; R.evos = (R.evos || 0) + 1;
    R.banner = {t:2, txt:`進化！ ${ACTIVES[o.id].evo.n}`, c:ACTIVES[o.id].c}; R.flash = {c:ACTIVES[o.id].c, t:0.3, max:0.3};
  }
  else if (o.k === 'heal') R.p.hp = Math.min(R.p.maxHp, R.p.hp + R.p.maxHp*0.3);
  else { const g = goldBonus(); SAVE.gold += g; R.gold += g; }
  S.pending--; S.choices = null; S.picks++;
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
