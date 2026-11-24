// 冒険（更新処理と入力）
import { $, rnd, pick, pickW, fmt } from './util.js';
import { RAR, ZONES, DROP_FX, WTYPES, MATS, CLEAR_DIST, DIFF_MAX, diffInfo, CP_RULE, FOE_N, ELITE_MODS, BOSSES } from './data.js';
import { genItem, salvage, computeStats, powerWith, noteFound } from './items.js';
import { SAVE, saveGame } from './save.js';
import { closeModal, dialog, closeDialog } from './ui.js';
import { renderBase } from './base.js';
import { draw } from './render.js';
import { sfx, unlockAudio, isMuted, setMuted, playBgm, duckBgm, pauseBgm } from './audio.js';
import { initSkills, updateSkills, onLand, dropGem, openLevelUp, skillSummary, XP, catchUp, absorbHit, applyPassives } from './skills.js';
import { dailyPlan, seeded, recordRun, rewardText, claimText, claimShort, DAILY_MODS } from './meta.js';
import { hideTitle } from './title.js';

export const VH = 300, GY = 255, PX = 70;
export let R = null, cv = $('cv'), ctx = cv.getContext('2d');
// VW：見えている横幅（ゲーム内の単位）。OY：ゲーム内の y を画面の y にずらす量。VTOP/VBOT：画面の上端・下端のゲーム内 y
export let VW = 300, SCALE = 1, DPR = 1, OY = 0, VTOP = 0, VBOT = VH, rafId = 0, lastT = 0;
let feedMax = 6;

// ジャンプ：長押しで高く、すぐ離すと低く。2段目は低め（空中での高さ調整用）
export const JUMP = {v:[470, 400, 360], gRise:1150, gFall:1800, buffer:0.12, bounce:380};   // 3段目は「天駆ける羽根」
const MAX_FX = 400;

export function sizeCanvas(){
  const stage = $('stage');
  const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
  sizedW = stage.clientWidth; sizedH = stage.clientHeight;
  DPR = Math.min(SAVE.settings.eco ? 1 : 2, window.devicePixelRatio || 1);
  cv.width = Math.round(w*DPR); cv.height = Math.round(h*DPR);
  // 縦持ち：横幅250ぶんを映して大きく見せ、地面を下から約3割の位置に置いてその下をログ欄にする
  // 横持ち：高さ300ぶんを映す（横は広く見える）
  const portrait = h > w * 1.15;
  SCALE = portrait ? w / 250 : Math.min(w / 300, h / VH);
  VW = w / SCALE;
  const hu = h / SCALE;
  OY = portrait ? Math.max(10, 0.68 * hu - GY) : GY / VH * hu - GY;
  VTOP = -OY; VBOT = hu - OY;
  const feed = $('feed');
  if (portrait){
    Object.assign(feed.style, {top:Math.round((GY + OY + 18) * SCALE) + 'px', left:'16px', right:'16px', bottom:'4px'});
    feedMax = Math.max(3, Math.floor(((VBOT - GY - 18) * SCALE - 4) / 24));
  } else {
    Object.assign(feed.style, {top:Math.round((64 - VTOP) * SCALE) + 'px', left:Math.round(10 * SCALE) + 'px', right:'50%', bottom:'auto'});
    feedMax = 3;
  }
  feed.classList.toggle('land', !portrait);
  const f = $('feed'); while (f.children.length > feedMax) f.lastChild.remove();
}
// 画面の向きが変わったら測り直す。iOS は resize の時点ではまだ古い大きさのことがあるので、
// 実際に大きさが変わったとき（ResizeObserver）と、少し遅れてもう一度測る。止まっているあいだも1枚描き直す
let sizedW = 0, sizedH = 0;
function resizeNow(){
  if (!R) return;
  const st = $('stage'), w = st.clientWidth, h = st.clientHeight;
  if (!w || !h || (w === sizedW && h === sizedH)) return;
  sizeCanvas(); draw();
}
window.addEventListener('resize', () => { resizeNow(); setTimeout(resizeNow, 250); setTimeout(resizeNow, 700); });
window.addEventListener('orientationchange', () => { setTimeout(resizeNow, 250); setTimeout(resizeNow, 700); });
if (window.ResizeObserver) new ResizeObserver(resizeNow).observe($('stage'));

// チェックポイントから出撃したときの補い：そこまで走っていれば上がっていたスキルのレベルと、大群の育ち具合（経過時間の換算）
export const CP_CATCHUP = {500:{lv:5, t:105}, 1000:{lv:8, t:210}, 1500:{lv:11, t:316}};   // シミュレーションで測った中央値

// opt：{diff, start}（省略すると前回の選択）/ {daily:true}：日替わりダンジョン（日付で決まるコース。opt.key で日付を指定できる）
export function startRun(opt = {}){
  unlockAudio();
  const P = SAVE.prog;
  const daily = opt.daily ? dailyPlan(opt.key) : null;
  const diff = daily ? daily.diff : Math.min(P.maxDiff, Math.max(1, opt.diff ?? P.diff));
  let start = daily ? 0 : opt.start ?? P.start;
  if (!(start >= 0 && start % 500 === 0 && start <= (P.cp[diff] || 0))) start = 0;
  if (!daily){ P.diff = diff; P.start = start; }
  const D = diffInfo(diff);
  const base = computeStats(SAVE.equip), st = {...base, stompMul:1};   // st は出撃中に強化スキルで変わる
  R = {dist:start, px:start*25, speed:150, base, st, eid:0, levelup:false, hordeT:45, horde:null,
       diff, start, cpRun:start > 0, lvOff:D.lvOff, hpMul:D.hpMul, dmgMul:D.dmgMul, tc:D.tierCap, tOff:start ? CP_CATCHUP[start].t : 0,
       p:{y:GY, vy:0, jumps:0, hold:false, buf:0, hp:st.hp, maxHp:st.hp, inv:0, atkT:0.4, revived:false, swing:0, swingMax:0.18},
       enemies:[], shots:[], eshots:[], haz:[], fx:[], texts:[], spawnT:1.0, nextBoss:start + 500, boss:null, gimT:6, fog:0,
       gold:0, kills:0, stomps:0, jumpsUsed:0, hurts:{}, loot:[], paused:false, over:false, t:0, elites:0, bossLog:[],
       shake:0, shakeAmp:0, hitstop:0, flash:null, hurtFx:0, hints:[], hint:null, eliteKills:0, flawless:0, bossHits:0,
       banner:{t:2.4, txt:''},
       // 日替わり：コースの乱数（敵の並び・仕掛け）は日付で決まる列を使う。条件で倍率が変わる
       daily, zoneOrder:daily ? daily.zones : null, cr:daily ? seeded(daily.seed) : Math.random,
       goldMul:1, lootMul:1, xpMul:1, healBoss:false, foeSpd:1, eliteMul:1, hordeEvery:HORDE.every, fogAll:0};
  if (daily){
    const M = new Set(daily.mods);
    if (M.has('gold')) R.goldMul = 2;
    if (M.has('loot')) R.lootMul = 1.5;
    if (M.has('wise')) R.xpMul = 1.5;
    if (M.has('heal')) R.healBoss = true;
    if (M.has('fast')) R.foeSpd = 1.3;
    if (M.has('elite')) R.eliteMul = 3;
    if (M.has('horde')) R.hordeEvery = 28;
    if (M.has('tough')) R.hpMul *= 1.4;
    if (M.has('fog')) R.fogAll = 0.5;
    R.hordeT = Math.min(R.hordeT, R.hordeEvery + 5);
  }
  R.banner.t = 0;
  R.zoneCard = {t:2.6, max:2.6, i:zoneIdx(), sub:daily ? '日替わりダンジョン' : diff > 1 ? `難易度${diff}` : '', from:null};
  initSkills();
  applyPassives();
  if (start) catchUp(CP_CATCHUP[start].lv);
  if (st.uniq.has('sage')) R.sk.pending++;   // 賢者の冠：出撃してすぐスキルを1つ選べる
  saveGame();
  hideTitle();
  $('base').classList.add('hidden'); closeModal(); closeDialog();
  $('run').classList.remove('hidden');
  $('feed').innerHTML = '';
  syncMuteBtn();
  window.scrollTo(0,0);
  sizeCanvas();
  lastT = performance.now();
  rafId = 0; kick();
  playBgm('zone' + (R.zoneOrder ? R.zoneOrder[0] : zoneIdx()));
}
export function toBase(){
  cancelAnimationFrame(rafId); rafId = 0; R = null;
  $('run').classList.add('hidden'); $('base').classList.remove('hidden');
  closeDialog(); renderBase();
  playBgm('base');
}
// 止まっていた描画を動かし直す（一時停止・レベルアップの3択から戻ったとき）
export function resumeClock(){ lastT = performance.now(); kick(); }
export function kick(){ if (R && !rafId) rafId = requestAnimationFrame(loop); }
// 描画のループ。一時停止中・3択の間・結果の画面では、最後の1枚を描いたら止める（電池のため）。
// 省電力モードでは1秒に30回だけ動かす。
let skipOdd = false;
function loop(now){
  rafId = 0;
  if (!R) return;
  if (SAVE.settings.eco && (skipOdd = !skipOdd) && now - lastT < 30){ rafId = requestAnimationFrame(loop); return; }
  const dt = Math.max(0, Math.min(0.05, (now - lastT)/1000)); lastT = now;   // 最初のフレームは時刻が戻ることがある
  const st = $('stage');
  if (st.clientWidth !== sizedW || st.clientHeight !== sizedH) sizeCanvas();   // 念のため毎フレーム大きさを確かめる（読むだけなので軽い）
  const still = R.paused || R.levelup || (R.over && now - R.overAt > 900);
  if (!R.paused && !R.over) step(dt);
  draw();
  if (!still) rafId = requestAnimationFrame(loop);
}
export const zoneIdx = () => Math.min(ZONES.length - 1, Math.floor(R.nextBoss/500) - 1);
export const zone = () => ZONES[R.zoneOrder ? R.zoneOrder[zoneIdx()] : zoneIdx()];
export const elv = () => 1 + Math.floor(R.dist/100) + R.lvOff;   // 敵Lv（表示・拾う装備のアイテムLv）
const blv = () => elv() - R.lvOff;                                 // 強さの計算に使うLv（難易度の分は倍率で掛ける）
export const ecenter = e => [e.x, e.y - e.h/2];
// 狙える敵（倒れていない・地中にいない）
export const alive = e => !e.dead && e.hp > 0 && !e.under;
export function shake(t, amp){ if (!SAVE.settings.shake) return; R.shakeAmp = R.shake > 0 ? Math.max(R.shakeAmp, amp) : amp; R.shake = Math.max(R.shake, t); }

// 敵の基本値（sp：歩く速さ）
export const EB = {
  mini:    {hp:6,   dmg:12, w:16, h:12, gold:0, sp:45},   // 群れの小さいスライム：経験値だけ
  slime:   {hp:16,  dmg:8,  w:24, h:18, gold:3, sp:35},
  bat:     {hp:12,  dmg:7,  w:22, h:14, gold:3, sp:70},
  thrower: {hp:30,  dmg:11, w:20, h:30, gold:5, sp:25},
  shield:  {hp:30,  dmg:10, w:24, h:30, gold:5, sp:30},   // 地上からの装備の攻撃を盾で防ぐ（踏むか空中から）
  boar:    {hp:24,  dmg:13, w:30, h:20, gold:4, sp:22},   // 止まって「！」→ 突進
  bigslime:{hp:36,  dmg:10, w:36, h:26, gold:5, sp:24},   // 倒すと2つに分かれる
  mole:    {hp:18,  dmg:12, w:22, h:18, gold:4, sp:30},   // 地中を進み、土が赤く光ったら飛び出す
  bomber:  {hp:12,  dmg:20, w:18, h:22, gold:4, sp:55},   // 近づくと光って爆発（跳ぶか先に倒す）
  ghost:   {hp:16,  dmg:9,  w:20, h:22, gold:4, sp:40},   // 上下にゆっくり漂う
  chest:   {hp:40,  dmg:0,  w:24, h:18, gold:45, sp:0},   // 丘の宝箱
  boss:    {hp:357, dmg:18, w:56, h:70, gold:60},          // HP は BOSS_GROW で伸びる
};
// コウモリの高さ：low は立っていると当たる（跳んで越える）、high は大きく跳ぶと当たる
export const BAT_LANE = {low:GY - 8, high:GY - 100};
// 霊の高さ：GY-4（立っていると当たる）〜 GY-80（跳ぶと当たる）をゆっくり行き来する
export const GHOST = {lo:4, hi:80, w:2.2};
export const ghostY = (e, t = e.t) => GY - GHOST.lo - (1 - Math.cos(t*GHOST.w + e.ph))/2 * (GHOST.hi - GHOST.lo);

// 敵の強さの伸び方（100mごとに敵Lvが1上がる）。HP と攻撃力がこの率で増える
export const GROW = {hp:1.3, dmg:1.2};
export const hpScale = lv => Math.pow(GROW.hp, lv - 1);
export const dmgScale = lv => Math.pow(GROW.dmg, lv - 1);
// いまの場所の雑魚のHPの倍率（スキルの威力もこれに合わせて伸びる）
export const foeHp = () => hpScale(blv()) * R.hpMul;
// ボスのHPの伸び（雑魚より緩い。装備を鍛えたぶん先へ進めるように）
export const BOSS_GROW = 1.22;
// ボスの攻撃力の伸び（雑魚より緩い。ボスの攻撃は種類が多く何発も続くので、1発で倒れないように）
export const BOSS_DMG_GROW = 1.12;
// スキルの効き方：投石兵・盾兵には効きにくい。ボスには10%だけ効く（下の hit() でボスのLvの差も打ち消す）。
// スキルは数が多く当たるので、これでボスに与えるダメージの約6割がスキル・約4割が装備になる（シミュレーションで確認）
export const SKILL_RES = {thrower:0.35, shield:0.6, boss:0.1};
// ボスのHPの倍率（スキルが効くようにした分の調整用）
export const BOSS_TUNE = {hp:1};
const ELITE = {hp:3, dmg:1.3, size:1.25, gold:5, xp:5, chance:0.012, grow:1/150000};   // 1回の出撃で5体くらい

// o.rng：乱数（コースの敵は R.cr を使い、日替わりで同じ並びになるようにする）
export function mkEnemy(type, o = {}){
  const lv = elv(), bl = blv(), B = EB[type], rng = o.rng || Math.random;
  const hm = (type === 'boss' ? Math.pow(BOSS_GROW, bl - 1) * BOSS_TUNE.hp : hpScale(bl)) * R.hpMul;
  const dm = (type === 'boss' ? Math.pow(BOSS_DMG_GROW, bl - 1) : dmgScale(bl)) * R.dmgMul;
  const e = {id:++R.eid, type, lv, x:VW+30, y:GY, hp:B.hp*hm, maxHp:B.hp*hm, dmg:B.dmg*dm, w:B.w, h:B.h, gold:B.gold, scale:1,
    t:rng()*6, burnT:0, burnDps:0, burnAcc:0, burnTick:0.5, phase:'walk', throws:0, cd:1.6, tele:0, next:null, rockQ:0, rockT:0, hitFlash:0, wind:false, vel:0};
  if (type==='bat'){ e.lane = rng() < 0.5 ? 'low' : 'high'; e.baseY = BAT_LANE[e.lane]; e.y = e.baseY; }
  if (type==='ghost'){ e.ph = rng()*Math.PI*2; e.y = ghostY(e); }
  if (type==='mole'){ e.phase = 'under'; e.under = true; }
  if (type==='chest'){ e.x = VW + 20; }
  if (type==='boss'){
    const K = BOSSES[o.boss]; e.boss = o.boss; e.w = K.w; e.h = K.h; e.fly = K.fly || 0; e.y = GY - e.fly;
    e.q = []; e.qt = 0; e.cd = 1.2; e.fightT = 0; e.last = [];
  }
  if (o.elite){
    const mods = Object.keys(ELITE_MODS), n = rng() < 0.35 ? 2 : 1, got = [];
    while (got.length < n){ const m = pick(mods, rng); if (!got.includes(m)) got.push(m); }
    e.elite = got;
    const hp = ELITE.hp * (got.includes('tough') ? 2 : 1);
    e.hp *= hp; e.maxHp *= hp; e.dmg *= ELITE.dmg; e.gold *= ELITE.gold;
    e.scale = ELITE.size; e.w *= ELITE.size; e.h *= ELITE.size;
    if (type==='bat') e.y = e.baseY = e.lane === 'low' ? GY - 10 : GY - 104;
  }
  if (o.summon){ e.summon = true; e.gold = 0; }
  return e;
}
const has = (e, m) => e.elite && e.elite.includes(m);

// 初めて会った敵・ボス・仕掛けは、短い説明を出す
export const HINTS = {
  bat:'コウモリ：低いものは跳び、高いものはくぐる', thrower:'投石兵：岩は転がってくる。跳んで越える',
  shield:'盾兵：地上からの攻撃を防ぐ。踏むか空中から', boar:'突進イノシシ：「！」の後に突っ込む。跳んで越える',
  bigslime:'大スライム：倒すと2つに分かれる', mole:'もぐら：土が赤く光ったら飛び出す。跳ぶ',
  bomber:'自爆ボム：光ったら爆発。跳ぶか、先に倒す', ghost:'さまよう霊：上下に漂う。低いときだけ跳ぶ',
  chest:'宝箱：壊すとゴールド。装備が出ることも', mini:'群れ：小さすぎて踏めない。スキルで倒す',
  elite:'エリート：強いが、良い装備を必ず落とす',
  sand:'流砂：踏むと沈んでダメージ。跳び越える', fog:'霧：遠くが見えにくい。「！」は霧の中でも見える', vent:'火柱：光ったら噴き出す。跳び越える',
  kingslime:'キングスライム：跳ねると衝撃波。小スライムを吐く', golem:'岩石ゴーレム：岩を投げる。第2形態は大岩',
  witch:'森の魔女：低い弾は跳び、高い弾はくぐる', dragon:'炎竜：足元が光ったら火柱。火の玉は跳ぶ',
};
function meet(key){
  const F = SAVE.prog.foes;
  if (F[key] || !HINTS[key]) return;
  F[key] = 1;
  const [a, b] = HINTS[key].split('：');
  R.hints.push({t:3.4, a, b});
}

function spawnEnemy(){
  const d = R.dist, zd = d - (R.nextBoss - 500), Z = zone(), rng = R.cr;
  // 小さいスライムの群れ（進むほど多く・長く）
  if (d > 40 && rng() < Math.min(0.45, 0.15 + d/2000)){
    const n = Math.min(8, 3 + Math.floor(d/400));
    for (let i=0;i<n;i++){ const e = mkEnemy('mini', {rng}); e.x += i*20; R.enemies.push(e); }
    return;
  }
  const w = {};
  for (const [k, [wt, from]] of Object.entries(Z.foes)) if (zd >= from) w[k] = wt;
  const type = pickW(w, rng);
  const elite = d - R.start > 120 && rng() < (ELITE.chance + d*ELITE.grow) * R.eliteMul;
  const e = mkEnemy(type, {elite, rng});
  if (R.log) R.log.push([Math.round(d), type, elite ? 1 : 0, e.lane || '', e.elite ? e.elite.join('+') : '']);
  R.enemies.push(e);
  meet(type);
  if (elite){ R.elites++; meet('elite'); R.banner = {t:1.4, txt:'エリート出現！', c:'#ffd36b'}; }
}
// 大群：予告のあと、小さいスライムがすき間なく固まった「壁」が何度も来る。
// 長い壁はジャンプでは越えきれないので、範囲攻撃のスキルで崩す（大群＝スキルの関門、ボス＝装備の関門）
export const HORDE = {every:40, walls:6, gap:1.0};
// 大群の育ち具合の時計。日替わりはボス戦の長さで変わらないよう、走った距離から数える
const hordeT = () => (R.daily ? R.dist / R.speed : R.t) + R.tOff;
const wallSize = () => Math.min(18, 5 + Math.floor(hordeT() / 25));
function updateHorde(dt){
  if (R.boss) return;
  if (!R.horde){
    R.hordeT -= dt;
    if (R.hordeT <= 0 && R.dist < R.nextBoss - 80){
      R.horde = {walls:Math.min(HORDE.walls, 3 + Math.floor(hordeT() / 60)), t:1.2};   // 序盤の大群は壁が少ない
      R.banner = {t:1.8, txt:'大群が来る！', c:'#ff8a6b'};
      sfx('warn'); R.hordeT = R.hordeEvery;
      meet('mini');
    }
    return;
  }
  R.horde.t -= dt;
  if (R.horde.t > 0) return;
  const n = wallSize();
  for (let i=0;i<n;i++){ const e = mkEnemy('mini', {rng:R.cr}); e.x += i*11; e.t = i*0.7; R.enemies.push(e); }
  if (R.log) R.log.push([Math.round(R.dist), 'wall', n]);
  R.horde.t = HORDE.gap;
  if (--R.horde.walls <= 0) R.horde = null;
}

// エリアの仕掛け：丘＝宝箱、荒野＝流砂、森＝霧、火山＝火柱（噴き出し口）
export const VENT = {cycle:2.4, glow:[0.9, 1.7], erupt:[1.7, 2.1], h:42, w:18};
export const ventState = h => { const c = h.c % VENT.cycle; return c >= VENT.erupt[0] && c < VENT.erupt[1] ? 'erupt' : c >= VENT.glow[0] && c < VENT.glow[1] ? 'glow' : 'idle'; };
function updateGimmick(dt, scroll){
  const Z = zone(), p = R.p;
  if (!R.boss && R.dist < R.nextBoss - 60){
    R.gimT -= dt;
    if (R.gimT <= 0){
      const rng = R.cr;
      if (Z.gim === 'chest'){ R.enemies.push(mkEnemy('chest', {rng})); meet('chest'); R.gimT = rnd(15, 22, rng); }
      else if (Z.gim === 'sand'){ R.haz.push({kind:'sand', x:VW + 40, w:rnd(36, 50, rng)}); meet('sand'); R.gimT = rnd(3.5, 6.5, rng); }
      else if (Z.gim === 'lava'){ R.haz.push({kind:'vent', x:VW + 30, w:VENT.w, c:rnd(0, VENT.cycle, rng), dmg:12*dmgScale(blv())*R.dmgMul}); meet('vent'); R.gimT = rnd(3.2, 5.5, rng); }
      if (R.log) R.log.push([Math.round(R.dist), Z.gim]);
      else { meet('fog'); R.gimT = 99; }
    }
  }
  // 霧：森では視界が狭い（魔女の第2形態でさらに濃く）
  const fogT = Z.gim === 'fog' ? (R.boss && R.boss.p2 ? 1 : 0.7) : R.fogAll;
  R.fog += (fogT - R.fog) * Math.min(1, dt*1.5);
  const ground = p.y >= GY - 1;
  for (const h of R.haz){
    h.x -= scroll*dt;
    if (h.kind === 'sand'){
      if (ground && Math.abs(h.x - PX) < h.w/2 + 4){ hurtPlayer(0, 'sand', 0.6, 0.07); h.sank = 0.25; }
      if (h.sank > 0) h.sank -= dt;
    } else if (h.kind === 'vent'){
      h.c += dt;
      if (ventState(h) === 'erupt' && Math.abs(h.x - PX) < h.w/2 + 7 && p.y > GY - VENT.h) hurtPlayer(h.dmg, 'vent');
    }
    if (h.x < -60) h.dead = true;
  }
  R.haz = R.haz.filter(h => !h.dead);
}

// ---------- 1フレームの更新 ----------
export function step(dt){
  const p = R.p, st = R.st;
  if (R.levelup) return;                              // レベルアップの3択を選んでいるあいだは止める
  if (R.hitstop > 0){ R.hitstop -= dt; return; }   // ヒットストップ中は時間を止める
  if (R.slowmo > 0){ R.slowmo -= dt; dt *= 0.3; }   // ボス撃破のスロー
  if (R.zoneCard && (R.zoneCard.t -= dt) <= 0) R.zoneCard = null;
  if (R.bossFx && (R.bossFx.t -= dt) <= 0) R.bossFx = null;
  R.t += dt;
  if (R.clearT > 0 && (R.clearT -= dt) <= 0){ endRun(false, 'clear'); return; }
  const scroll = R.boss || R.clearT > 0 ? 0 : R.speed;
  R.px += scroll*dt;
  R.dist = R.px / 25;
  if (R.banner.t > 0) R.banner.t -= dt;
  if (R.shake > 0) R.shake -= dt;
  if (R.hurtFx > 0) R.hurtFx -= dt;
  if (R.flash && (R.flash.t -= dt) <= 0) R.flash = null;
  if (R.hint){ if ((R.hint.t -= dt) <= 0) R.hint = null; }
  else if (R.hints.length) R.hint = R.hints.shift();

  if (!R.boss && !(R.clearT > 0) && R.dist >= R.nextBoss){
    const id = zone().boss;
    R.boss = mkEnemy('boss', {boss:id}); R.enemies.push(R.boss); R.bossHits = 0;
    R.haz = [];
    R.banner = {t:2, txt:`${BOSSES[id].n} 出現！`, c:'#ff8a6b'};
    meet(id);
    sfx('boss'); shake(0.6, 3);
    playBgm('boss');
  }
  if (!R.boss && !(R.clearT > 0)){
    R.spawnT -= dt;
    if (R.spawnT <= 0){ spawnEnemy(); R.spawnT = Math.max(0.45, 1.5 - R.dist/1500) * rnd(0.7, 1.3, R.cr); }
  }
  updateHorde(dt);
  updateGimmick(dt, scroll);

  // 自分：上昇中に押し続けていると重力が弱い（高く跳ぶ）
  const air = p.y < GY;
  p.vy += (p.vy < 0 && p.hold ? JUMP.gRise : JUMP.gFall) * dt;
  p.y += p.vy*dt;
  if (p.y >= GY){
    if (air && p.vy > 300) burst(PX, GY, 'rgba(230,230,220,.8)', 4);
    if (air && p.vy > 200){
      onLand();
      if (st.setB.has('gale4')){   // 疾風セット4：着地のたびに周りへ斬撃
        for (const e of R.enemies) if (alive(e) && Math.abs(e.x - PX) < 70 && GY - e.y < 40) hit(e, st.finalDmg*1.5, true);
        R.fx.push({kind:'ring', x:PX, y:GY - 10, r:60, t:0.2, max:0.2, c:'127,224,168'});
      }
    }
    p.y = GY; p.vy = 0; p.jumps = 0;
    if (p.buf > 0) doJump();   // 着地直前に押していたら、着地と同時に跳ぶ
  }
  if (p.buf > 0) p.buf -= dt;
  if (p.inv > 0) p.inv -= dt;
  if (p.swing > 0) p.swing -= dt;
  if (st.regen > 0) p.hp = Math.min(p.maxHp, p.hp + st.regen*dt);
  p.atkT -= dt;
  const rate = st.rate * (p.hp < p.maxHp*0.5 ? 1 + st.lowHpAspd/100 : 1);   // 背水：HP50%以下で攻撃速度
  if (p.atkT <= 0) p.atkT = attack() ? 1/rate : 0.05;

  // 敵（時の砂：tf の分だけ敵と敵の弾が遅くなる。ボス戦の残り時間は遅くならない）
  const tf = R.sk.slowT > 0 ? R.sk.slowF : 1;
  for (const e of R.enemies){
    if (e.dead) continue;
    e.t += dt*tf; if (e.hitFlash > 0) e.hitFlash -= dt;
    // 足止め（stun）・鈍足（slow）。地面と一緒には流れる
    if (e.stun > 0) e.stun -= dt; if (e.slow > 0) e.slow -= dt;
    const m = (e.stun > 0 ? 0 : e.slow > 0 ? 0.55 : 1) * tf, x0 = e.x;
    if (e.type === 'boss') updateBoss(e, dt*tf, dt);
    else moveFoe(e, dt, scroll, m);
    e.vel = (e.x - x0) / dt;   // 画面上の速さ（ボットが当たるまでの時間を読むのに使う）
    if (e.dead) continue;
    if (has(e, 'regen') && e.hp > 0) e.hp = Math.min(e.maxHp, e.hp + e.maxHp*0.05*dt);

    if (e.poisonT > 0){ e.poisonT -= dt; e.hp -= e.poisonDps*dt; }   // 毒牙
    if (e.burnT > 0){
      e.burnT -= dt; const d = e.burnDps*dt; e.hp -= d; e.burnAcc += d; e.burnTick -= dt;
      if (e.burnTick <= 0){ e.burnTick = 0.5; if (e.burnAcc >= 1) addText(e.x+6, e.y-e.h-2, Math.round(e.burnAcc), '#ff9b4a'); e.burnAcc = 0; }
    }
    if (e.type==='boss' || e.hp <= 0 || e.under || e.harmless) continue;
    const near = Math.abs(e.x - PX) < e.w/2 + 9;
    // 踏みつけ：落下中に敵の頭に乗ったら大ダメージ＋跳ね返り
    // 群れの小さいスライムは小さすぎて踏めない（群れを踏み渡れないように。群れはスキルで崩す）
    if (near && e.type !== 'mini' && p.vy > 0 && p.y >= e.y - e.h - 6 && p.y <= e.y - e.h + 12){
      stomp(e);
      continue;
    }
    // 接触
    if (p.inv <= 0 && near && p.y > e.y - e.h && p.y - 30 < e.y){
      if (e.type==='mini'){
        // 群れの小さいスライムは体当たりして消える（経験値なし）。無敵時間が短いので、止めきれない群れは続けて当たる
        hurtPlayer(e.dmg, 'mini', 0.25, 0.1);    // 防御で防ぎきれない（最大HPの10%以上）
        e.dead = true; burst(e.x, e.y - e.h/2, '#a6e35a', 4);
      } else {
        hurtPlayer(e.dmg, e.type==='bat' ? 'bat-' + e.lane : e.type);
        e.x += 45;
      }
    }
  }

  updateSkills(dt, scroll);

  // 自分の弾
  for (const s of R.shots){
    s.life -= dt;
    if (s.kind==='orb' || s.home){
      if (!s.tgt || !alive(s.tgt)) s.tgt = nearestTarget(VW);
      if (s.tgt){
        const [tx,ty] = ecenter(s.tgt);
        const cur = Math.atan2(s.vy, s.vx); let da = Math.atan2(ty-s.y, tx-s.x) - cur;
        while (da > Math.PI) da -= 2*Math.PI; while (da < -Math.PI) da += 2*Math.PI;
        const na = cur + Math.max(-7*dt, Math.min(7*dt, da));
        const sp = s.speed || (s.home ? 340 : 300);
        s.vx = Math.cos(na)*sp; s.vy = Math.sin(na)*sp;
      }
    }
    s.x += s.vx*dt; s.y += s.vy*dt;
    for (const e of R.enemies){
      if (!alive(e) || s.hit.includes(e.id)) continue;
      if (Math.abs(s.x - e.x) < e.w/2 + s.r && s.y > e.y - e.h - s.r && s.y < e.y + s.r){
        if (s.kind==='orb'){ explode(s.x, s.y, s.aoe, s.dmg, false); if (R.st.uniq.has('storm')) chainLightning(e, s.dmg*0.6); s.life = 0; break; }
        if (s.onHit) s.onHit(e, s.dmg); else hit(e, s.dmg, s.noProc, s.quiet);
        s.hit.push(e.id);
        if (--s.pierce < 0){ s.life = 0; break; }
      }
    }
    if (s.x > VW + 40 || s.x < -40 || s.y > GY + 20 || s.y < VTOP - 60) s.life = 0;
  }
  R.shots = R.shots.filter(s => s.life > 0);

  updateEShots(dt*tf, scroll/tf);

  // 倒した敵
  for (const e of R.enemies) if (!e.dead && e.hp <= 0) onKill(e);
  R.enemies = R.enemies.filter(e => !e.dead && e.x > -60);

  // 演出（光の柱は地面と一緒に流れる）
  for (const f of R.fx){
    f.t -= dt;
    if (f.kind==='part' || f.kind==='coin'){ f.vy += (f.g ?? 500)*dt; f.x += f.vx*dt; f.y += f.vy*dt; if (f.kind==='coin' && f.y > GY - 3){ f.y = GY - 3; f.vy *= -0.4; f.vx *= 0.6; } }
    else if (f.kind==='pillar') f.x -= scroll*dt;
  }
  R.fx = R.fx.filter(f => f.t > 0);
  for (const t of R.texts) t.t -= dt;
  R.texts = R.texts.filter(t => t.t > 0);
  if (R.sk.pending > 0 && !R.over) openLevelUp();
  // 定期保存は main.js の自動保存（5秒ごと）が行う
}

// 雑魚の動き（m：足止め・鈍足の倍率）
function moveFoe(e, dt, scroll, m){
  const sp = EB[e.type].sp * (has(e, 'fast') ? 1.6 : 1) * R.foeSpd * m, p = R.p;
  switch (e.type){
    case 'bat':
      e.x -= (sp + scroll)*dt;
      e.y = e.baseY + Math.sin(e.t*4) * (e.lane==='low' ? 2 : 5);
      break;
    case 'ghost':
      e.x -= (sp + scroll)*dt; e.y = ghostY(e);
      break;
    case 'thrower':
      if (e.phase==='walk'){
        e.x -= (sp + scroll)*dt;
        if (e.throws < 2 && e.x < Math.max(VW*0.72, PX + 170)){ e.phase = 'stand'; e.cd = 0.8; }
      } else {   // 立ち止まって投げる（画面上の位置は変わらない）
        e.cd -= dt*m;
        e.wind = e.cd < 0.4;   // 振りかぶり（投げる予告）
        if (e.cd <= 0){ throwRock(e, 1.1, 105); e.throws++; e.cd = 1.6; e.wind = false; if (e.throws >= 2) e.phase = 'walk'; }
      }
      break;
    case 'boar':
      // 近づくと立ち止まって前足で地面をかき（予告）、そのあと一気に突っ込んでくる
      if (e.phase==='walk'){
        e.x -= (sp + scroll)*dt;
        if (e.x < PX + 200 && e.x > PX + 70){ e.phase = 'tele'; e.tele = 0.6; }
      } else if (e.phase==='tele'){
        e.x -= scroll*dt; e.tele -= dt*m;
        if (e.tele <= 0){ e.phase = 'charge'; sfx('thud'); }
      } else e.x -= (260*(has(e, 'fast') ? 1.25 : 1)*m + scroll)*dt;
      break;
    case 'mole':
      // 地中（狙えない・当たらない）→ 土が赤く光る（予告）→ 飛び出す（その場の地上に当たり判定）
      if (e.phase==='under'){
        e.x -= (sp + scroll)*dt;
        if (e.x - PX < 115) { e.phase = 'tele'; e.tele = 0.6; sfx('warn'); }
      } else if (e.phase==='tele'){
        e.x -= (sp + scroll)*dt; e.tele -= dt*Math.max(m, 0.4);
        if (e.tele <= 0){ e.phase = 'pop'; e.under = false; e.harmless = true; e.popT = 0.3; burst(e.x, GY, '#8a6a4a', 8); sfx('thud'); shake(0.1, 2); }
      } else {
        e.x -= (14*m + scroll)*dt;
        if (e.popT > 0){
          e.popT -= dt;
          if (!e.spiked && Math.abs(e.x - PX) < 13 && p.y > GY - 34){ e.spiked = true; hurtPlayer(e.dmg, 'mole'); }
        }
      }
      break;
    case 'bomber':
      // 近づくと止まって光り（予告）、地面と一緒に流れてきて足元で爆発する
      if (e.phase==='walk'){
        e.x -= (sp + scroll)*dt;
        if (e.x - PX < 95){ e.phase = 'fuse'; e.tele = 0.6; e.harmless = true; sfx('warn'); }
      } else {
        e.x -= scroll*dt; e.tele -= dt*Math.max(m, 0.4);
        if (e.tele <= 0){
          e.dead = true;
          const bx = e.x, by = GY - 11, r = BOMB_R;
          R.fx.push({kind:'boom', x:bx, y:by, r, t:0.3, max:0.3, c:'#ff8a5a'});
          burst(bx, by, '#ff8a5a', 10); shake(0.25, 4); sfx('stomp');
          if (Math.hypot(PX - bx, (p.y - 15) - by) < r + 6) hurtPlayer(e.dmg, 'bomber');
        }
      }
      break;
    case 'chest':
      e.x -= scroll*dt;
      e.harmless = true;
      break;
    default:   // mini・slime・bigslime・shield
      e.x -= (sp + scroll)*dt;
  }
}

export const BOMB_R = 44;   // 自爆の範囲（跳べば軽いジャンプでもかわせる）
// ---------- ボス ----------
// ボス戦の制限時間：戦い始めて BOSS_RAGE 秒で怒り（攻撃が速く・強くなる）、BOSS_LIMIT 秒で最後の一撃（倒しきれなければ終わり）。
// 避けるのが上手くても、装備の火力が足りなければ先へ進めない。HPが半分を切ると第2形態（攻撃が変わる）
export const BOSS_RAGE = 40, BOSS_LIMIT = 70;
// 予告の長さ（秒）
export const BOSS_TELE = {hop:0.8, bighop:0.85, spit:0.6, rocks:0.8, boulder:0.9, orbs:0.75, summon:0.6, pillars:0.45, breath:0.7};
export const ORB = {low:GY - 12, high:GY - 62, speed:165, r:7};
export const PILLAR = {tele:0.75, act:0.2, h:34, w:20};
// dt：ボスの動き（時の砂で遅くなる）/ realDt：戦いの残り時間に使う実際の時間
function updateBoss(e, dt, realDt = dt){
  // 近接武器が届く距離まで近づく（短剣は近くまで来る）。弓・杖のときは 100 先で止まる
  const reach = WTYPES[R.st.type].melee ? R.st.range * (1 + R.st.rangeP/100) + e.w/2 - 8 : 100;
  const stopX = Math.min(VW - 70, PX + Math.max(60, Math.min(100, reach)));
  if (e.fly) e.y = GY - e.fly - Math.sin(R.t*2)*4;
  if (e.x > stopX){ e.x -= 60*dt; return; }
  e.fightT += realDt;
  if (e.fightT >= BOSS_LIMIT){ R.flash = {c:'#ff3b2f', t:0.6, max:0.6}; shake(0.6, 6); sfx('bosskill'); endRun(false, 'boss'); return; }
  const over = e.fightT - BOSS_RAGE;
  if (over > 0 && !e.rage){ R.banner = {t:2, txt:'ボスが怒った！', c:'#ff5b4a'}; sfx('boss'); shake(0.4, 3); }
  e.rage = over > 0 ? 1 + 0.3 + over * 0.03 : 0;   // 怒った瞬間に +30%、その後も毎秒 +3%
  const pow = e.rage || 1;
  // 第2形態
  if (!e.p2 && e.hp < e.maxHp * 0.5){
    e.p2 = true; e.q = []; e.tele = 0; e.cd = 0.9; e.pause = 0.8;
    R.banner = {t:2, txt:`${BOSSES[e.boss].n} 第2形態！`, c:'#ff5b4a'};
    R.flash = {c:'#ff5b4a', t:0.3, max:0.3}; shake(0.4, 4); sfx('boss');
  }
  if (e.pause > 0){ e.pause -= dt; return; }
  if (e.tele > 0){
    e.tele -= dt;
    if (e.tele <= 0) startAttack(e);
    return;
  }
  if (e.q.length){
    e.qt += dt;
    while (e.q.length && e.q[0].at <= e.qt) bossAct(e, e.q.shift(), pow);
    return;
  }
  e.cd -= dt;
  if (e.cd <= 0){
    const pool = (e.p2 ? BOSSES[e.boss].p2 : BOSSES[e.boss].atk).filter(a => !(e.last[0] === a && e.last[1] === a));   // 同じ攻撃は3回続けない
    e.next = pick(pool); e.last = [e.next, e.last[0]];
    if (e.next === 'orbs') e.orbH = Array.from({length:e.p2 ? 4 : 3}, () => Math.random() < 0.5 ? 'low' : 'high');
    e.tele = BOSS_TELE[e.next] * (e.rage ? 0.85 : 1) * (e.p2 ? 0.9 : 1);
    e.cd = Math.max(1.4, 2.4 - (e.lv - R.lvOff)*0.03) / Math.min(2, pow) * (e.p2 ? 0.85 : 1);
    sfx('warn');
  }
}
// 予告が終わったら、攻撃の中身（時間差の行動の列）を積む
function startAttack(e){
  const p2 = !!e.p2, Q = [];
  switch (e.next){
    case 'hop':    Q.push({at:0, a:'wave'}); break;
    case 'bighop': Q.push({at:0, a:'wave'}, {at:0.55, a:'wave'}); break;   // 2回跳ぶ（間が短いので連続で）
    case 'spit':   for (let i = 0; i < (p2 ? 5 : 3); i++) Q.push({at:i*0.35, a:'spawn', type:'mini'}); break;
    case 'rocks':  for (let i = 0; i < (p2 ? 4 : 3); i++) Q.push({at:i*0.62, a:'rock'}); break;
    case 'boulder':Q.push({at:0, a:'boulder'}); break;
    case 'orbs':   e.orbH.forEach((h, i) => Q.push({at:i*(p2 ? 0.5 : 0.6), a:'orb', h})); break;
    case 'summon': Q.push({at:0, a:'spawn', type:'ghost'}, {at:0.5, a:'spawn', type:p2 ? 'bat' : 'ghost'}); if (p2) Q.push({at:1.0, a:'spawn', type:'ghost'}); break;
    case 'pillars':for (let i = 0; i < (p2 ? 3 : 2); i++) Q.push({at:i*0.7, a:'pillar'}); break;
    case 'breath': for (let i = 0; i < (p2 ? 3 : 2); i++) Q.push({at:i*0.5, a:'fire'}); break;
  }
  e.q = Q; e.qt = 0;
}
// 何発も続く攻撃（岩・弾・火柱・火の玉）は1発あたりを軽く
const MULTI_HIT = 0.75;
function bossAct(e, q, pow){
  const dmg = e.dmg * pow * (q.a === 'wave' || q.a === 'boulder' ? 1 : MULTI_HIT);
  switch (q.a){
    case 'wave':
      R.eshots.push({kind:'wave', x:e.x - e.w/2, y:GY, vx:-240, w:16, h:22, dmg, src:'boss-wave'});
      shake(0.25, 4); sfx('stomp'); break;
    case 'rock': throwRock(e, 0.95, 80, pow * MULTI_HIT); break;
    case 'boulder':
      R.eshots.push({kind:'rock', big:true, x:e.x - e.w/2, y:GY - 13, r:13, rolling:true, sp:150, dmg:dmg*1.3, src:'boss-boulder'});
      shake(0.3, 4); sfx('thud'); break;
    case 'orb':
      R.eshots.push({kind:'orb', x:e.x - e.w/2, y:ORB[q.h], vx:-ORB.speed, r:ORB.r, dmg, hi:q.h === 'high', src:'boss-orb-' + q.h});
      sfx('orb'); break;
    case 'fire':
      R.eshots.push({kind:'orb', fire:true, x:e.x - e.w/2, y:ORB.low, vx:-220, r:8, dmg, src:'boss-fire'});
      sfx('fire'); break;
    case 'pillar':
      R.eshots.push({kind:'pillar', x:PX, tele:PILLAR.tele, act:PILLAR.act, dmg, src:'boss-pillar'});
      break;
    case 'spawn': {
      const m = mkEnemy(q.type, {summon:true});
      m.x = e.x - e.w/2; if (q.type === 'mini'){ m.x -= 4; }
      if (q.type === 'ghost'){ m.t = 0; m.ph = 0; m.y = ghostY(m); }   // 低い位置から出る
      R.enemies.push(m); burst(m.x, m.y - m.h/2, '#c9a6ff', 5);
      break;
    }
  }
}
// 敵の弾・ボスの攻撃
function updateEShots(dt, scroll){
  const p = R.p;
  for (const s of R.eshots){
    if (s.kind==='rock'){
      // 投石：自分の少し前に落ち、そこから転がってくる（跳んで越える）。大岩は最初から転がる
      if (!s.rolling){
        s.t -= dt;
        s.vy += s.g*dt; s.x += s.vx*dt; s.y += s.vy*dt;
        if (s.t <= 0){ s.rolling = true; s.y = GY - s.r; burst(s.x, GY, '#8b8378', 5); sfx('thud'); }
      } else {
        s.x += (-(s.sp || ROLL_SPEED) - scroll)*dt; s.spin = (s.spin || 0) + dt*(s.big ? 8 : 12);
        if (Math.abs(s.x - PX) < s.r + 9 && p.y > GY - s.r*2){ hurtPlayer(s.dmg, s.src + (s.big ? '' : '-rock')); s.dead = true; burst(s.x, GY - s.r, '#8b8378', 6); }
        if (s.x < -30) s.dead = true;
      }
    } else if (s.kind==='wave'){
      s.x += s.vx*dt;
      if (Math.abs(s.x - PX) < s.w/2 + 9 && p.y > GY - s.h) hurtPlayer(s.dmg, 'boss-wave');
      if (s.x < -30) s.dead = true;
    } else if (s.kind==='orb'){
      s.x += (s.vx - scroll)*dt;
      if (Math.abs(s.x - PX) < s.r + 8 && s.y + s.r > p.y - 30 && s.y - s.r < p.y){ hurtPlayer(s.dmg, s.src); s.dead = true; burst(s.x, s.y, s.fire ? '#ff8a3a' : '#c58bff', 6); }
      if (s.x < -30) s.dead = true;
    } else if (s.kind==='pillar'){
      // 火柱：足元が光り（予告）、そのあと短いあいだ噴き出す
      s.x -= scroll*dt;
      if (s.tele > 0){ s.tele -= dt; if (s.tele <= 0){ sfx('fire'); shake(0.12, 2.5); } }
      else {
        s.act -= dt;
        if (!s.done && Math.abs(s.x - PX) < PILLAR.w/2 + 7 && p.y > GY - PILLAR.h){ s.done = true; hurtPlayer(s.dmg, s.src); }
        if (s.act <= 0) s.dead = true;
      }
    }
  }
  R.eshots = R.eshots.filter(s => !s.dead);
}
// 岩は自分の少し前（ahead）に落ちてから転がってくる。飛んでいるあいだ、落ちる場所に輪が出る
export const ROLL_SPEED = 110;
function throwRock(e, T, ahead, pow = 1){
  const sx = e.x - 8, sy = e.y - e.h + 6, tx = PX + ahead, ty = GY - 7, g = 700;
  R.eshots.push({kind:'rock', x:sx, y:sy, vx:(tx-sx)/T, vy:(ty - sy - 0.5*g*T*T)/T, g, r:7, tx, dmg:e.dmg*pow, t:T, T, src:e.type});
}

export function nearestTarget(maxX){
  let best = null, bd = 1e9;
  for (const e of R.enemies){
    if (!alive(e) || e.x < PX - 12 || e.x > maxX) continue;
    const d = e.x - PX; if (d < bd){ bd = d; best = e; }
  }
  return best;
}
const weaponColor = () => SAVE.equip.weapon ? RAR[SAVE.equip.weapon.r].c : '#ffffff';
function attack(){
  const st = R.st, p = R.p, cx = PX, cy = p.y - 15, U = x => st.uniq.has(x);
  // 攻撃速度が上がるほど振りが速くなる
  const dur = Math.max(0.08, Math.min(st.type==='axe' ? 0.3 : 0.2, 0.36 / st.rate));
  if (WTYPES[st.type].melee){
    const rr = st.range * (1 + st.rangeP/100);
    // 武器（装備）は強い一撃。1回に当たるのは近い st.targets 体まで（剣3・斧5・短剣1。群れはスキルの役目）
    const hits = R.enemies.filter(e => alive(e) && e.x > PX - 30 && Math.hypot(e.x - cx, e.y - e.h/2 - cy) < rr + e.w/2)
      .sort((a, b) => Math.abs(a.x - PX) - Math.abs(b.x - PX)).slice(0, st.targets);
    if (!hits.length) return false;
    for (const e of hits){
      const crit = hit(e, st.finalDmg);
      if (U('twin')) hit(e, st.finalDmg*0.6);                                 // 双星の剣：2回目（60%）
      if (U('shadow') && crit) hit(e, st.finalDmg);                           // 影の短剣：会心でもう1回
      if (st.type==='axe' && e.type !== 'boss') e.x += 10;                    // 斧は大きく押し返す
    }
    if (U('quakeaxe')){                                                       // 大地の斧：地上の敵すべてに
      for (const e of R.enemies) if (alive(e) && GY - e.y < 35 && !hits.includes(e) && e.x < VW + 10) hit(e, st.finalDmg*0.4, true);
      R.fx.push({kind:'quake', x:PX, r:VW, t:0.25, max:0.25});
    }
    p.flip = !p.flip;
    R.fx.push({kind:'slash', t:dur, max:dur, r:rr, c:weaponColor(), flip:p.flip, wide:st.type==='axe', thin:st.type==='dagger'});
    p.swing = dur; p.swingMax = dur;
    if (U('wave')) R.shots.push({kind:'wave', x:PX+16, y:cy, vx:420, vy:0, dmg:st.finalDmg*0.35, pierce:99, hit:[], life:0.9, r:12});
    sfx('slash');
    return true;
  }
  const tgt = nearestTarget(VW - 5);
  if (!tgt) return false;
  const [tx,ty] = ecenter(tgt);
  const base = Math.atan2(ty - cy, tx - cx);
  const n = 1 + st.multi + (U('fan') ? 2 : 0);
  for (let i=0;i<n;i++){
    const a = base + (i - (n-1)/2) * 0.13;
    const dmg = st.finalDmg * (U('fan') && i >= n - 2 ? 0.35 : 1);   // 千本弓の追加の2本は35%の威力
    if (st.type==='bow') R.shots.push({kind:'arrow', x:cx+10, y:cy, vx:Math.cos(a)*560, vy:Math.sin(a)*560, dmg, pierce:st.pierce, hit:[], life:1.5, r:4, home:U('seeker'), speed:560, tgt});
    else R.shots.push({kind:'orb', x:cx+10, y:cy-4, vx:Math.cos(a)*300, vy:Math.sin(a)*300, dmg:st.finalDmg, hit:[], life:2.5, r:6, tgt, aoe:42*(1 + st.rangeP/100)});
  }
  p.swing = dur; p.swingMax = dur;
  sfx(st.type==='bow' ? 'shoot' : 'orb');
  return true;
}
// skill：スキルによる攻撃。装備の会心は乗らず、大きい敵には効きにくい。数字は小さく、命中音なし
// 装備による攻撃には、条件付きの付与効果（ジャンプ中・ボス・無傷の敵）とレジェンドが乗る。会心したかを返す
let stompHit = false;
// sCrit：スキルの会心（強化スキル「鋭さ」）。数字を黄色にする
export function hit(e, base, noProc, skill, sCrit){
  if (!alive(e)) return false;
  const st = R.st, U = x => st.uniq.has(x);
  const crit = !skill && Math.random() < st.critC;
  const res = skill ? (SKILL_RES[e.type] ?? 1) : 1;
  if (res === 0) return false;
  let mul = 1;
  if (!skill){
    if (R.p.y < GY - 2) mul *= 1 + st.airAtk/100;
    if (e.type === 'boss') mul *= 1 + st.bossDmg/100;
    if (e.hp >= e.maxHp) mul *= 1 + st.firstHit/100;
    if (crit && e.type === 'boss' && U('hawk')) mul *= 1.5;
    if (R.sk.slowT > 0) mul *= R.sk.evo.time ? 1.4 : 1.25;   // 時の砂：遅くなっている敵には装備の攻撃もよく効く
    // 盾兵：地上から正面への装備の攻撃は 20% に（空中から・踏みつけ・スキルは通る）
    if (e.type === 'shield' && !stompHit && R.p.y > GY - 14 && e.x > PX - 4){
      mul *= 0.2;
      if (!(e.guardT > R.t)){ e.guardT = R.t + 0.4; addText(e.x - 10, e.y - e.h - 2, 'ガード', '#b8c4cc', false, 0.5, true); R.fx.push({kind:'ring', x:e.x - e.w/2, y:e.y - e.h/2, r:8, t:0.15, max:0.15, c:'220,230,240'}); }
    }
  }
  if (skill && R.sk.slowT > 0) mul *= R.sk.evo.time ? 1.4 : 1.25;
  // ボスへのスキル：スキルの威力は雑魚のHP（Lvごとに×1.3）に合わせて伸びるが、ボスのHPは×1.22でしか伸びない。
  // そのままだと奥のボスほどスキルで一瞬で溶けるので、最初のボス（敵Lv6）を基準にその差を打ち消す
  if (skill && e.type === 'boss') mul *= Math.pow(BOSS_GROW / GROW.hp, e.lv - R.lvOff - 6);
  const d = base * (crit ? st.critM : 1) * res * mul;
  e.hp -= d; e.hitFlash = 0.08;
  if (e.type === 'boss'){ if (skill) R.bossDmgSkill = (R.bossDmgSkill || 0) + d; else R.bossDmgGear = (R.bossDmgGear || 0) + d; }   // 記録用：ボスに与えたダメージの内訳
  if (e.type !== 'boss' && e.type !== 'chest') e.x += 3;   // 軽いノックバック
  if (SAVE.settings.dmgNum) addText(e.x + rnd(-6,6), e.y - e.h - 4, Math.round(d), crit || sCrit ? '#ffe14d' : !skill ? '#ffffff' : res < 1 && e.type !== 'boss' ? '#8e9aa3' : '#d8e4ff', crit, 0.7, skill && !sCrit);
  if (crit){ shake(0.08, 2); sfx('crit'); } else if (!skill) sfx('hit');
  if (st.leech > 0) R.p.hp = Math.min(R.p.maxHp, R.p.hp + d*st.leech/100);
  if (!noProc){
    if (st.burn > 0 && Math.random() < st.burn/100){ e.burnT = 3; e.burnDps = Math.max(e.burnDps, base*0.4); }
    if (st.chain > 0 && Math.random() < st.chain/100) chainLightning(e, base*0.6);
    if (U('venom')){ e.poisonT = 3; e.poisonDps = Math.max(e.poisonDps || 0, st.finalDmg*0.4); }
  }
  // 処刑人の斧：HP25%以下の敵にとどめ（ボスを除く）
  if (!skill && U('execute') && e.type !== 'boss' && e.hp > 0 && e.hp < e.maxHp*0.25){ e.hp = 0; addText(e.x, e.y - e.h - 14, 'とどめ', '#ff8a6b', true); }
  return crit;
}
function stomp(e){
  const p = R.p;
  p.vy = -JUMP.bounce; p.jumps = 1; p.inv = Math.max(p.inv, 0.15);
  // トゲのエリート：踏むと逆にダメージ
  if (has(e, 'spiky')){
    p.inv = 0; hurtPlayer(e.dmg, 'spiky');
    R.fx.push({kind:'ring', x:e.x, y:e.y - e.h, r:22, t:0.25, max:0.25, c:'255,120,120'});
    return;
  }
  R.stomps++;
  stompHit = true;
  hit(e, R.st.finalDmg * 2.5 * R.st.stompMul * (1 + R.st.stompDmg/100), true);
  stompHit = false;
  R.fx.push({kind:'ring', x:e.x, y:e.y - e.h, r:22, t:0.25, max:0.25, c:'255,255,255'});
  shake(0.1, 2.5); sfx('stomp');
  R.hitstop = Math.max(R.hitstop, 0.05);
}
export function explode(x, y, r, dmg, noProc, quiet, fx = 'boom'){
  if (fx === 'boom') R.fx.push({kind:'boom', x, y, r, t:0.3, max:0.3});
  for (const e of R.enemies){
    if (!alive(e)) continue;
    const [ex,ey] = ecenter(e);
    if (Math.hypot(ex-x, ey-y) < r + e.w/2) hit(e, dmg, noProc, quiet);
  }
}
function chainLightning(src, dmg){
  const [sx,sy] = ecenter(src);
  const pts = [[sx,sy]];
  const targets = R.enemies.filter(e => e!==src && alive(e))
    .map(e => [e, Math.hypot(e.x - src.x, e.y - src.y)]).filter(([,d]) => d < 150)
    .sort((a,b) => a[1]-b[1]).slice(0,2).map(([e]) => e);
  for (const t of targets){ hit(t, dmg, true); pts.push(ecenter(t)); }
  if (pts.length > 1) R.fx.push({kind:'bolt', pts, t:0.2, max:0.2});
}
const KILL_C = {slime:'#6ccf5e', mini:'#6ccf5e', bigslime:'#5fb6e8', bat:'#8a5cc7', boss:'#a58fd0', shield:'#9aa7b0', boar:'#9a6a40',
  mole:'#8a6a4a', bomber:'#ff8a5a', ghost:'#dfe8ff', chest:'#ffd36b'};
function onKill(e){
  e.dead = true; R.kills++;
  const g = Math.round(e.gold * (1 + e.lv*0.35) * (1 + R.st.gold/100) * R.goldMul);
  R.gold += g; SAVE.gold += g;
  const [cx,cy] = ecenter(e);
  const xp = e.summon ? 1 : (XP[e.type] || 0) * (e.elite ? ELITE.xp : 1);
  if (xp) dropGem(cx, cy, xp);
  // 強化スキル「生命」：倒すたびに少し回復
  if (R.sk.pas.vigor) R.p.hp = Math.min(R.p.maxHp, R.p.hp + R.p.maxHp * 0.002 * R.sk.pas.vigor);
  // 装備：倒すたびにHP回復・8体ごとに落雷・嵐の指輪（10体ごとに落雷5本）
  const st = R.st;
  if (st.killHeal) R.p.hp = Math.min(R.p.maxHp, R.p.hp + st.killHeal);
  if (st.killBolt && R.kills % 8 === 0) gearBolt(1, st.finalDmg * st.killBolt/100);
  if (st.uniq.has('tempest') && R.kills % 10 === 0) gearBolt(5, st.finalDmg * 2);
  burst(cx, cy, KILL_C[e.type] || '#b07a48', e.type==='boss' ? 30 : 8);
  R.fx.push({kind:'ring', x:cx, y:cy, r:e.w*0.9, t:0.2, max:0.2, c:'255,240,200'});
  if (R.st.uniq.has('nova')) explode(cx, cy, 55, R.st.finalDmg*0.8, true);
  // 種類ごとの倒れ方
  if (e.type === 'bigslime'){   // 2つに分かれる
    for (const dx of [-12, 14]){
      const k = mkEnemy('slime'); k.x = e.x + dx; k.hp = k.maxHp = k.maxHp*0.6; k.gold = 1; k.kid = true;
      if (e.elite) k.dmg = e.dmg / ELITE.dmg;
      R.enemies.push(k);
    }
  }
  if (e.type === 'bomber') explode(cx, cy, 55, R.st.finalDmg*1.5, true, true);   // 先に倒すと、周りの敵を巻き込んで爆発
  if (e.type === 'chest'){
    feedLine(`<span style="color:#ffd36b">宝箱：+${fmt(g)}G</span>`);
    if (Math.random() < 0.35 * (1 + R.st.drop/100) * R.lootMul) drop(e, e.lv, 1);
  }
  if (e.type==='boss'){
    R.hitstop = Math.max(R.hitstop, 0.3);
    shake(0.5, 5); R.flash = {c:'#ffffff', t:0.3, max:0.3};
    sfx('bosskill'); duckBgm(2.2);
    // 撃破の演出：スロー・光の筋・衝撃波・金貨
    R.slowmo = 0.8; R.bossFx = {t:2.0, max:2.0, x:cx, y:cy, n:BOSSES[e.boss].n};
    for (let i = 0; i < (SAVE.settings.eco ? 14 : 28); i++) R.fx.push({kind:'coin', x:cx + rnd(-10, 10), y:cy, vx:rnd(-160, 160), vy:rnd(-420, -180), g:900, t:rnd(1.2, 1.8), max:1.8});
    const n = R.cpRun ? CP_RULE.bossDrops : CP_RULE.fullBossDrops;
    for (let i = 0; i < n; i++) drop(e, e.lv + 1, 2);
    R.bossLog.push({id:e.boss, at:R.nextBoss, sec:Math.round(e.fightT), hits:R.bossHits});
    if (!R.bossHits){ R.flawless++; R.banner = {t:2.6, txt:'ノーダメージ撃破！', c:'#7fe8ff'}; }
    R.boss = null;
    R.eshots = [];
    R.p.hp = Math.min(R.p.maxHp, R.p.hp + R.p.maxHp*(R.healBoss ? 1 : 0.3));
    const P = SAVE.prog, b = R.nextBoss;
    if (b >= CLEAR_DIST){
      // 踏破：0mから走ったときは報酬（エピック以上を1つ）。日替わりは進み具合（難易度の解放）に数えない
      if (!R.cpRun) drop(e, e.lv + 2, 3);
      if (!R.daily){
        R.clearNew = P.maxDiff === R.diff && R.diff < DIFF_MAX;
        P.clears[R.diff] = (P.clears[R.diff] || 0) + 1;
        if (R.clearNew){ P.maxDiff = R.diff + 1; P.cp[R.diff + 1] = 0; P.best[R.diff + 1] = 0; }
      }
      saveGame();
      R.clearT = 1.2;   // 少し余韻を見せてから結果へ（step の中で数える）
      R.banner = {t:3, txt:'踏破！', c:'#ffd36b'};
      return;
    }
    if (!R.daily) P.cp[R.diff] = Math.max(P.cp[R.diff] || 0, b);
    const from = zone();
    R.nextBoss += 500;
    // 次のエリアへ：空が切り替わり、エリア名のカードが出る（撃破の演出のあと）
    R.zoneCard = {t:3.4, max:3.4, delay:1.0, i:zoneIdx(), sub:`${R.nextBoss}m にボス`, from};
    if (!R.bossHits) R.banner = {t:2.6, txt:'ノーダメージ撃破！', c:'#7fe8ff'};
    playBgm('zone' + (R.zoneOrder ? R.zoneOrder[zoneIdx()] : zoneIdx()), 1.5);
    saveGame();
  } else {
    // 倒したときの小さなヒットストップは0.35秒に1回まで。
    // ブーメランや回転刃は1フレームに1体ずつ倒すので、毎回止めると群れの中でずっとカクつく（重く感じる）
    if (!(R.t - (R.stopAt ?? -9) < 0.35)){ R.hitstop = Math.max(R.hitstop, 0.035); R.stopAt = R.t; }
    sfx('kill');
    if (e.elite){ R.eliteKills++; drop(e, e.lv + 2, 2); R.banner = {t:1.4, txt:'エリート撃破！', c:'#ffd36b'}; }
    else if (e.type !== 'chest' && Math.random() < (e.type==='mini' ? 0.005 : 0.09) * (1 + R.st.drop/100) * (R.cpRun ? CP_RULE.dropMul : 1) * R.lootMul * (R.sk.dropMul || 1)) drop(e, e.lv, 0);
  }
}
// 装備による落雷（ボスにも当たる）
function gearBolt(n, dmg){
  const list = R.enemies.filter(e => alive(e) && e.x > PX - 20 && e.x < VW + 10);
  for (let i = 0; i < n && list.length; i++){
    const e = list.splice(Math.floor(Math.random()*list.length), 1)[0];
    const [x, y] = ecenter(e);
    hit(e, dmg, true);
    R.fx.push({kind:'skybolt', x, y, t:0.2, max:0.2});
  }
  sfx('zap');
}
function feedLine(html, cls){
  const div = document.createElement('div'); div.innerHTML = html;
  if (cls) div.className = cls;
  $('feed').prepend(div);
  while ($('feed').children.length > feedMax) $('feed').lastChild.remove();
}
export function drop(e, ilvl, minR){
  const it = genItem(ilvl, minR, R.st.drop/100 + R.st.rarityB, {tc:R.tc});
  noteFound(it);
  const F = DROP_FX[it.r];
  R.fx.push({kind:'pillar', x:e.x, r:it.r, t:F.t, max:F.t});
  if (it.r >= 3) R.flash = {c:RAR[it.r].c, t:0.35, max:0.35};
  if (it.r === 4) for (let i=0;i<14;i++) R.fx.push({kind:'part', x:e.x + rnd(-10,10), y:GY - rnd(0,20), vx:rnd(-20,20), vy:rnd(-160,-60), g:-20, c:RAR[4].c, t:rnd(0.8,1.4), max:1.4});
  sfx('drop', it.r);
  const rc = RAR[it.r].c;
  let line, up = false;
  const d = powerWith(it) - computeStats(SAVE.equip).power;
  // 自動分解：設定したレア度以下で、セット・レジェンドでなく、戦力も上がらないもの
  const auto = it.r <= SAVE.autoSalv && !it.set && !it.uniq && d <= 0.5;
  // 所持品がいっぱいのとき：残したい装備（レジェンド・セット・戦力が上がる・エピック）なら、
  // 持っている中で一番弱いもの（保護・セット・レジェンド以外で、拾ったものよりレア度が上でなく、戦力も上がらない）を分解して空ける。
  // 空けられなければ、レジェンド・セット・戦力が上がるものだけは枠を10個までこえて持つ（レジェンドは必ず残す）。それ以外は今まで通り分解
  const want = it.set || it.uniq || it.r >= 3 || d > 0.5, must = it.set || it.uniq || d > 0.5;
  const full = SAVE.inv.length >= SAVE.invMax;
  let made = '', keep = !full;
  if (full && want && !auto){
    const power = computeStats(SAVE.equip).power;
    const cand = SAVE.inv.filter(x => !x.lock && !x.set && !x.uniq && x.r <= it.r && (x.r < it.r || !must ? x.r <= 3 : true))
      .map(x => [x, powerWith(x) - power]).filter(([, g]) => g <= 0.5)
      .sort((a, b) => a[0].r - b[0].r || a[1] - b[1] || a[0].ilvl - b[0].ilvl);
    const v = cand.length && (must || cand[0][0].r < it.r || cand[0][0].ilvl < it.ilvl) ? cand[0][0] : null;
    if (v){
      const r = salvage(v);
      SAVE.inv.splice(SAVE.inv.indexOf(v), 1); R.gold += r.g; R.salv = (R.salv || 0) + 1;
      made = `<span style="color:var(--muted)">所持品がいっぱい：${v.name} を分解して空けた</span>`; keep = true;
    } else if (it.uniq || (must && SAVE.inv.length < SAVE.invMax + 10)){
      made = '<span style="color:#ff9a7a">所持品が枠をこえた：拠点で整理しよう</span>'; keep = true;
    }
  }
  if (full && !R.fullWarn){ R.fullWarn = true; R.banner = {t:2, txt:'所持品がいっぱい！', c:'#ff9a7a'}; }
  if (auto || !keep){
    const r = salvage(it); R.gold += r.g; R.salv = (R.salv || 0) + 1;
    line = `<span style="color:var(--muted)">${auto ? '自動分解' : '所持品がいっぱい：分解'}：${it.name} +${r.g}G・${MATS[r.m.r]}×${r.m.n}</span>`;
  } else {
    if (made) feedLine(made);
    SAVE.inv.push(it); R.loot.push(it);
    up = d > 0.5;
    line = `<b style="color:${rc}">${RAR[it.r].n}</b> <span style="color:${rc}">${it.name}</span> <small>Lv${it.ilvl}</small>${up ? ` <b class="upbadge">▲ 戦力+${fmt(d)}</b>` : ''}`;
    if (it.r >= 3) R.banner = {t:1.8, txt:`${RAR[it.r].n}！ ${it.name}`, c:rc};
    if (up){ addText(PX + 10, R.p.y - 52, '▲ 戦力UP', '#5fd17a', true, 1.3); sfx('up'); }
  }
  feedLine(line, up ? 'up' : '');
  saveGame();
}
// minPct：防御で減らしても最大HPのこの割合は必ず受ける（群れの体当たり・流砂）
function hurtPlayer(d, src, inv = 0.8, minPct = 0){
  const p = R.p, st = R.st;
  if (p.inv > 0 || R.over) return;
  if (absorbHit()) return;   // スキル「障壁」
  // 回避
  if (Math.random() < st.dodgeC){ p.inv = 0.3; addText(PX, p.y - 40, '回避', '#9fe3ff', true); return; }
  const dd = Math.max(d * (1 - st.defRed) * (st.taken ?? 1), p.maxHp * minPct);   // taken：強化スキル「守り」
  if (R.boss) R.bossHits++;
  p.hp -= dd; p.inv = inv * st.invMul;
  // 反撃（棘の鎧・鉄壁セット・付与効果）
  if (st.thorns){
    for (const e of R.enemies) if (alive(e) && Math.abs(e.x - PX) < 80) hit(e, st.finalDmg * st.thorns/100, true);
    R.fx.push({kind:'ring', x:PX, y:p.y - 15, r:50, t:0.2, max:0.2, c:'255,138,107'});
  }
  R.hurts[src] = (R.hurts[src] || 0) + 1;
  shake(0.25, 4); R.hurtFx = 0.3; sfx('hurt');
  addText(PX, p.y - 40, '-' + Math.round(dd), '#ff6b6b', true);
  if (navigator.vibrate) navigator.vibrate(40);
  if (p.hp <= 0){
    if (R.st.uniq.has('revive') && !p.revived){ p.revived = true; p.hp = p.maxHp*0.5; p.inv = 1.5; addText(PX, p.y - 56, '不屈！', '#ffa53a', true); }
    else endRun(false);
  }
}

// ---------- 入力 ----------
function doJump(){
  const p = R.p;
  p.vy = -JUMP.v[Math.min(p.jumps, JUMP.v.length - 1)]; p.jumps++; p.buf = 0; R.jumpsUsed++;
  sfx('jump', p.jumps);
}
// 押したとき
export function jump(){
  if (!R || R.paused || R.over) return;
  const p = R.p;
  p.hold = true;
  // 落下中で、もうすぐ着地するなら2段目を使わず、着地と同時に跳ぶ
  const landingSoon = p.y < GY && p.vy > 0 && p.y + p.vy*JUMP.buffer + 0.5*JUMP.gFall*JUMP.buffer*JUMP.buffer >= GY;
  if (p.jumps < R.st.maxJumps && !landingSoon) doJump();
  else p.buf = JUMP.buffer;
}
// 離したとき（早く離すと低いジャンプになる）
export function releaseJump(){ if (R) R.p.hold = false; }

export function addText(x, y, txt, c, big, life = 0.7, small = false){
  if (R.texts.length > 60) R.texts.shift();
  R.texts.push({x, y, txt:String(txt), c, big, small, t:life, max:life});
}
export function burst(x, y, c, n){
  if (R.fx.length > (SAVE.settings.eco ? MAX_FX/2 : MAX_FX)) return;
  if (SAVE.settings.eco) n = Math.ceil(n/2);
  for (let i=0;i<n;i++) R.fx.push({kind:'part', x, y, vx:rnd(-120,120), vy:rnd(-220,-40), c, t:rnd(0.3,0.6), max:0.6});
}

function endRun(retreat, reason){
  R.over = true; R.overAt = performance.now(); kick(); R.endReason = retreat ? 'retreat' : reason || 'dead';
  SAVE.runs++;
  const dist = Math.floor(R.dist), P = SAVE.prog;
  SAVE.best = Math.max(SAVE.best, dist);
  if (!R.daily) P.best[R.diff] = Math.max(P.best[R.diff] || 0, dist);
  const rec = recordRun(R);   // 記録・実績・日替わりの報酬（保存もする）
  const loot = [...R.loot].sort((a,b) => b.r - a.r || b.ilvl - a.ilvl);
  const lootHTML = loot.length ? loot.map(it => `<div><b style="color:${RAR[it.r].c}">${RAR[it.r].n}</b> <span style="color:${RAR[it.r].c}">${it.name}</span> <small style="color:var(--muted)">Lv${it.ilvl}</small></div>`).join('')
    : '<div style="color:var(--muted);text-align:center">装備は拾えなかった</div>';
  const boss = R.boss && BOSSES[R.boss.boss];
  const title = (R.daily ? '日替わり：' : '') + (retreat ? '撤退した' : reason === 'clear' ? `踏破！${R.diff > 1 ? `（難易度${R.diff}）` : ''}` : reason === 'boss' ? `${boss ? boss.n : 'ボス'}を倒しきれなかった…` : '力尽きた…');
  let note = '';
  if (reason === 'boss') note = 'ボスは70秒以内に倒す必要がある。装備（武器）を鍛えるか、スキルを育てよう（スキルはボスにも効くが、雑魚より効きにくい）。';
  if (reason === 'clear') note = (R.clearNew ? `<b style="color:var(--accent)">難易度${R.diff + 1} が解放された！</b> 敵は強くなるが、アイテムLvの上限と付与効果の階級の上限が上がる。<br>` : '')
    + (R.cpRun ? '途中から出撃したので、踏破報酬はなし。' : '0mからの踏破報酬：エピック以上の装備を1つ。');
  // 日替わりの節目の報酬・新しく達成した実績
  const extra = [
    ...rec.daily.map(x => `<div>日替わり ${x.at}m の報酬：<b class="gold">${rewardText({g:x.g, m:x.m})}</b></div>`),
    rec.claim.list.length ? `<div class="achgot">${rec.claim.list.length > 2 ? claimShort(rec.claim) : claimText(rec.claim)}</div>` : '',
    SAVE.inv.length >= SAVE.invMax ? `<div style="color:#ff9a7a">所持品がいっぱい（${SAVE.inv.length}/${SAVE.invMax}）。拠点の「所持品」で整理しよう</div>` : '',
  ].join('');
  const html = `
    <h2>${title}</h2>
    ${note ? `<p class="sksum">${note}</p>` : ''}
    <div class="res">
      <div class="stat"><small>到達</small><b>${fmt(R.dist)}m</b></div>
      <div class="stat"><small>撃破</small><b>${R.kills}</b></div>
      <div class="stat"><small>ゴールド</small><b>${fmt(R.gold)}</b></div>
    </div>
    <div class="loot">${lootHTML}</div>
    ${extra ? `<div class="sksum extra">${extra}</div>` : ''}
    <p class="sksum">${skillSummary()}</p>
    <div class="btns"><button class="primary" id="dBase">拠点へ戻る</button></div>`;
  // 結果の画面は少し余韻を見せてから出す（中身はいま作っておく。その間に拠点へ戻っていたら出さない）
  const run = R;
  setTimeout(() => { if (R !== run) return; dialog(html); $('dBase').onclick = toBase; }, retreat ? 0 : 600);
}
export function pauseRun(){
  if (!R || R.over || R.paused || R.levelup) return;   // レベルアップの3択中はそれ自体が止まっている
  R.paused = true; R.p.hold = false;
  pauseBgm(true);
  dialog(`<h2>一時停止</h2><p style="color:var(--muted);font-size:13px">${R.daily ? `日替わり（${R.daily.mods.map(m => DAILY_MODS[m].n).join('・')}）・ ` : ''}${R.diff > 1 ? `難易度${R.diff} ・ ` : ''}${fmt(R.dist)}m ・ 拾った装備 ${R.loot.length}個</p>
    <p class="sksum">${skillSummary()}</p>
    <div class="btns"><button class="primary" id="dResume">再開</button><button id="dRetreat">撤退する（拾った装備は持ち帰る）</button></div>`);
  $('dResume').onclick = () => { closeDialog(); R.paused = false; unlockAudio(); pauseBgm(false); resumeClock(); };
  $('dRetreat').onclick = () => { closeDialog(); R.paused = false; pauseBgm(false); endRun(true); };
}

// 消音（設定に保存）
function syncMuteBtn(){
  const b = $('muteBtn');
  b.textContent = isMuted() ? '音 OFF' : '音 ON';
  b.setAttribute('aria-pressed', String(isMuted()));
}
export function toggleMute(){
  setMuted(!isMuted());
  SAVE.settings.mute = isMuted();
  saveGame(); syncMuteBtn();
  if (!isMuted()) unlockAudio();
}

$('pauseBtn').onclick = pauseRun;
$('muteBtn').onclick = toggleMute;
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseRun(); });   // 保存は main.js

$('run').addEventListener('pointerdown', ev => {
  if (ev.target.closest('button')) return;
  ev.preventDefault(); unlockAudio(); jump();
});
window.addEventListener('pointerup', releaseJump);
window.addEventListener('pointercancel', releaseJump);
document.addEventListener('keydown', ev => {
  if (!R) return;
  if (ev.key===' ' || ev.key==='ArrowUp' || ev.key==='w'){ ev.preventDefault(); if (!ev.repeat) jump(); }
  else if (ev.key==='Escape' || ev.key==='p') pauseRun();
});
document.addEventListener('keyup', ev => { if (ev.key===' ' || ev.key==='ArrowUp' || ev.key==='w') releaseJump(); });
