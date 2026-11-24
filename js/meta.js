// やり込み要素（処理）：拠点の施設・実績・記録・日替わりダンジョン
import { SAVE, saveGame, HIST_MAX } from './save.js';
import { UNIQUES, MATS, FAC_MAX } from './data.js';
import { computeStats } from './items.js';

const sum = o => Object.values(o || {}).reduce((a, b) => a + (Number(b) || 0), 0);

// ---------- 施設 ----------
// mt/mn：レベルごとの素材（種類・数）。費用のゴールドは base × grow^今のLv
export const FACILITIES = {
  train:{n:'訓練所', ic:'訓', max:FAC_MAX.train, base:600,  grow:1.75, mt:[0,0,1,1,2,2,2,3,3,3], mn:[5,8,5,8,5,8,10,3,5,6],
         about:'新しいスキル・引き直し・最初のスキル'},
  smith:{n:'鍛冶屋', ic:'鍛', max:FAC_MAX.smith,  base:2000, grow:2.5,  mt:[0,1,2,3,3], mn:[6,6,5,3,5], about:'鍛冶（強化・付け替えなど）のゴールドが安くなる'},
  store:{n:'倉庫',   ic:'倉', max:FAC_MAX.store,  base:1500, grow:2.5,  mt:[0,1,2,3,3], mn:[6,6,5,3,5], about:'分解で多く手に入る'},
  dojo: {n:'道場',   ic:'道', max:FAC_MAX.dojo,  base:3000, grow:2.6, mt:[0,1,2,3,3], mn:[8,8,6,4,6], about:'本体の最大HPと攻撃力が上がる'},
  vault:{n:'金庫',   ic:'金', max:FAC_MAX.vault,  base:2000, grow:2.5,  mt:[0,1,2,3,3], mn:[6,6,5,3,5], about:'ゴールド獲得が増える'},
};
// 訓練所のレベルごとの中身
export const TRAIN = [null,
  {sk:['barrier','guard'], t:'スキル「障壁」「守り」'},
  {t:'レベルアップの引き直し 1回'},
  {sk:['boomer','edge'],   t:'スキル「ブーメラン」「鋭さ」'},
  {t:'最初のスキルを選んで持って出られる'},
  {sk:['aura','magnet'],   t:'スキル「聖域」「引力」'},
  {t:'引き直し +1回（2回）'},
  {sk:['mine','blast'],    t:'スキル「地雷」「爆薬」'},
  {sk:['lance','focus'],   t:'スキル「光線」「集中」'},
  {sk:['time','luck'],     t:'スキル「時の砂」「幸運」'},
  {t:'引き直し +1回（3回）'},
];
export const facLv = id => (SAVE.fac && SAVE.fac[id]) || 0;
export function trainPerks(){ const l = facLv('train'); return {rerolls:(l >= 2) + (l >= 6) + (l >= 10), startPick:l >= 4}; }
export const smithDisc = () => 1 - 0.08*facLv('smith');
export const salvGoldMul = () => 1 + 0.15*facLv('store');
export const salvMatPlus = r => (facLv('store') >= 3 && r >= 2) || (facLv('store') >= 5 && r >= 1) ? 1 : 0;
export const dojoHp = () => 1 + 0.04*facLv('dojo');
export const dojoAtk = () => 3*facLv('dojo');
export const vaultGold = () => 8*facLv('vault');
export function facEffect(id, l){
  if (id === 'train') return l ? TRAIN.slice(1, l + 1).map(x => x.t).join('・') : 'なし';
  if (id === 'smith') return `鍛冶のゴールド -${l*8}%`;
  if (id === 'store') return `分解のゴールド +${l*15}%${l >= 5 ? '・アンコモン以上の素材 +1' : l >= 3 ? '・レア以上の素材 +1' : ''}`;
  if (id === 'dojo')  return `最大HP +${l*4}%・攻撃力 +${l*3}%`;
  if (id === 'vault') return `ゴールド獲得 +${l*8}%`;
}
export function facNext(id){ const l = facLv(id); return id === 'train' ? (TRAIN[l + 1] ? TRAIN[l + 1].t : '') : facEffect(id, l + 1); }
export function facCost(id){
  const F = FACILITIES[id], l = facLv(id);
  if (l >= F.max) return null;
  return {gold:Math.round(F.base*Math.pow(F.grow, l)/50)*50, mat:{r:F.mt[l], n:F.mn[l]}};
}
const canPay = c => SAVE.gold >= c.gold && SAVE.mats[c.mat.r] >= c.mat.n;
export const canUpgradeFac = id => { const c = facCost(id); return !!c && canPay(c); };
export function upgradeFac(id){
  const c = facCost(id);
  if (!c || !canPay(c)) return false;
  SAVE.gold -= c.gold; SAVE.mats[c.mat.r] -= c.mat.n;
  SAVE.fac[id] = facLv(id) + 1;
  SAVE.stats.facUps++;
  saveGame();
  return true;
}

// ---------- 実績 ----------
const bestAll = () => Math.max(SAVE.best, ...Object.values(SAVE.prog.best));
const clears = d => SAVE.prog.clears[d] || 0;
const maxSet = () => Math.max(0, ...Object.values(computeStats(SAVE.equip).sets));
const facTotal = () => Object.keys(FACILITIES).reduce((a, k) => a + facLv(k), 0);
const FAC_TOTAL = Object.values(FACILITIES).reduce((a, f) => a + f.max, 0);
const S = () => SAVE.stats;
// v：今の値 / goal：目標 / r：報酬（g：ゴールド、m：[素材の種類, 数]）
export const ACH = [
  {id:'d500',     n:'はじめの一歩',   d:'500m に到達する',               goal:500,   v:bestAll,                   r:{g:300}},
  {id:'boss1',    n:'王を倒せ',       d:'ボスを倒す',                    goal:1,     v:() => S().bosses,          r:{g:500}},
  {id:'d1000',    n:'荒野の向こう',   d:'1000m に到達する',              goal:1000,  v:bestAll,                   r:{g:1000, m:[1, 3]}},
  {id:'d1500',    n:'夜の森',         d:'1500m に到達する',              goal:1500,  v:bestAll,                   r:{g:2000, m:[2, 2]}},
  {id:'clear1',   n:'踏破者',         d:'2000m の炎竜を倒して踏破する',  goal:1,     v:() => sum(SAVE.prog.clears), r:{g:5000, m:[2, 3]}},
  {id:'clear10',  n:'歴戦',           d:'10回踏破する',                  goal:10,    v:() => sum(SAVE.prog.clears), r:{g:20000, m:[3, 3]}},
  {id:'diff2',    n:'難易度2',        d:'難易度2を踏破する',             goal:1,     v:() => clears(2),           r:{g:10000, m:[3, 2]}},
  {id:'diff3',    n:'難易度3',        d:'難易度3を踏破する',             goal:1,     v:() => clears(3),           r:{g:30000, m:[3, 4]}},
  {id:'diff4',    n:'難易度4',        d:'難易度4を踏破する',             goal:1,     v:() => clears(4),           r:{g:80000, m:[4, 1]}},
  {id:'diff5',    n:'頂点',           d:'難易度5を踏破する',             goal:1,     v:() => clears(5),           r:{g:200000, m:[4, 3]}},
  {id:'bossAll',  n:'四天王',         d:'4体のボスをすべて倒す',         goal:4,     v:() => Object.keys(S().bossKinds).length, r:{g:3000}},
  {id:'flawless', n:'無傷の勝利',     d:'ダメージを受けずにボスを倒す',  goal:1,     v:() => S().flawless,        r:{g:3000, m:[2, 2]}},
  {id:'elite10',  n:'精鋭狩り',       d:'エリートを10体倒す',            goal:10,    v:() => S().elites,          r:{g:2000}},
  {id:'elite100', n:'精鋭の天敵',     d:'エリートを100体倒す',           goal:100,   v:() => S().elites,          r:{g:15000, m:[3, 2]}},
  {id:'kill1k',   n:'千の敵',         d:'敵を合計1,000体倒す',           goal:1000,  v:() => S().kills,           r:{g:1000}},
  {id:'kill10k',  n:'万の敵',         d:'敵を合計10,000体倒す',          goal:10000, v:() => S().kills,           r:{g:8000, m:[2, 4]}},
  {id:'kill50k',  n:'無双',           d:'敵を合計50,000体倒す',          goal:50000, v:() => S().kills,           r:{g:40000, m:[3, 4]}},
  {id:'runKill',  n:'嵐のように',     d:'1回の出撃で1,500体倒す',        goal:1500,   v:() => S().maxKills,        r:{g:3000}},
  {id:'stomp500', n:'踏み名人',       d:'踏みつけを合計500回',           goal:500,   v:() => S().stomps,          r:{g:3000}},
  {id:'lv20',     n:'育ち盛り',       d:'1回の出撃でLv20になる',         goal:20,    v:() => S().maxLv,           r:{g:3000}},
  {id:'evo1',     n:'進化',           d:'スキルを進化させる',            goal:1,     v:() => Object.keys(SAVE.skill.evo).length, r:{g:2000, m:[1, 5]}},
  {id:'evo6',     n:'進化の探究',     d:'6種類の進化を見る',             goal:6,     v:() => Object.keys(SAVE.skill.evo).length, r:{g:10000, m:[2, 4]}},
  {id:'evo12',    n:'進化の極み',     d:'12種類すべての進化を見る',      goal:12,    v:() => Object.keys(SAVE.skill.evo).length, r:{g:50000, m:[4, 1]}},
  {id:'leg1',     n:'伝説との出会い', d:'レジェンドを手に入れる',        goal:1,     v:() => Object.keys(SAVE.codex.u).length, r:{g:2000}},
  {id:'leg8',     n:'伝説の収集家',   d:'レジェンドを8種類集める',       goal:8,     v:() => Object.keys(SAVE.codex.u).length, r:{g:15000, m:[3, 2]}},
  {id:'legAll',   n:'伝説の図鑑',     d:`レジェンドを${UNIQUES.length}種類すべて集める`, goal:UNIQUES.length, v:() => Object.keys(SAVE.codex.u).length, r:{g:100000, m:[4, 2]}},
  {id:'set4',     n:'そろい踏み',     d:'セット装備を4つそろえて装備する', goal:4,   v:maxSet,                    r:{g:5000}},
  {id:'up10',     n:'鍛え抜く',       d:'装備を+10まで強化する',         goal:10,    v:() => S().upMax,           r:{g:10000, m:[3, 2]}},
  {id:'t6',       n:'上位の階級',     d:'T6以上の付与効果がついた装備を拾う', goal:1, v:() => S().t6,             r:{g:5000}},
  {id:'fac1',     n:'拠点づくり',     d:'施設を強化する',                goal:1,     v:facTotal,                  r:{g:500, m:[0, 10]}},
  {id:'facMax',   n:'完成した拠点',   d:'施設をすべて最大まで強化する',  goal:FAC_TOTAL, v:facTotal,                r:{g:50000, m:[4, 1]}},
  {id:'daily1',   n:'今日の挑戦',     d:'日替わりダンジョンに挑む',      goal:1,     v:() => S().dailies,         r:{g:1000}},
  {id:'daily7',   n:'日課',           d:'日替わりダンジョンに7日挑む',   goal:7,     v:() => S().dailies,         r:{g:10000, m:[2, 5]}},
  {id:'dailyClr', n:'今日の踏破者',   d:'日替わりダンジョンを踏破する',  goal:1,     v:() => S().dailyClears,     r:{g:8000, m:[3, 2]}},
  {id:'gold1m',   n:'大富豪',         d:'冒険で合計1,000,000G 稼ぐ',     goal:1e6,   v:() => S().gold,            r:{g:30000, m:[3, 3]}},
  {id:'time5h',   n:'旅慣れた足',     d:'冒険した時間が合計5時間',       goal:5*3600, v:() => S().time,           r:{g:10000}},
];
// 称号：実績の報酬を受け取ると名乗れる（拠点の絵と結果の画面に出る）
const TITLES = {d500:'駆け出し', boss1:'王殺し', d1000:'荒野の旅人', d1500:'夜を越えし者', clear1:'踏破者', clear10:'歴戦の勇者',
  diff2:'猛者', diff3:'豪傑', diff4:'英雄', diff5:'頂に立つ者', bossAll:'四天王殺し', flawless:'無傷の剣士', elite10:'精鋭狩り',
  elite100:'精鋭の天敵', kill1k:'千人斬り', kill10k:'万人斬り', kill50k:'無双', runKill:'嵐を呼ぶ者', stomp500:'踏み名人',
  lv20:'育ち盛り', evo1:'進化の芽', evo6:'探究者', evo12:'進化の極み', leg1:'伝説を知る者', leg8:'収集家', legAll:'伝説の語り部',
  set4:'そろい踏み', up10:'鍛冶の鬼', t6:'目利き', fac1:'村づくり', facMax:'村長', daily1:'挑戦者', daily7:'日課の人',
  dailyClr:'今日の英雄', gold1m:'大富豪', time5h:'旅慣れた足'};
for (const a of ACH) a.t = TITLES[a.id] || a.n;
// マント：受け取った実績の数で増える（冒険中と拠点の主人公に描く）
export const CAPES = [
  {n:'赤',   c:'#c8403c', need:3},  {n:'青',   c:'#356fc4', need:6},  {n:'緑',   c:'#3a9a5e', need:10}, {n:'紫',   c:'#7d4cc0', need:14},
  {n:'白銀', c:'#cdd6de', need:18}, {n:'漆黒', c:'#25232e', need:23}, {n:'黄金', c:'#e8b23a', need:29}, {n:'星空', c:'#2b2f7a', need:36, star:true},
];
export const achGot = () => ACH.filter(a => SAVE.ach[a.id] === 2).length;
export const capeOpen = i => achGot() >= CAPES[i].need;
export const nextCape = () => CAPES.find((c, i) => !capeOpen(i));
export const titleText = () => { const a = ACH.find(x => x.id === SAVE.look.title); return a ? a.t : ''; };
export const capeColor = () => { const i = SAVE.look.cape; return i >= 0 && CAPES[i] && capeOpen(i) ? CAPES[i] : null; };
// 前の版から移ってきたセーブ：受け取り済みの実績のうち一番あとのものを称号に、着られる一番上のマントを着る
export function initLook(){
  const L = SAVE.look;
  if (!L.fresh) return;
  delete L.fresh;
  const got = ACH.filter(a => SAVE.ach[a.id] === 2);
  if (got.length) L.title = got[got.length - 1].id;
  for (let i = CAPES.length - 1; i >= 0; i--) if (capeOpen(i)){ L.cape = i; break; }
  saveGame();
}
export const rewardText = r => [r.g ? `${r.g.toLocaleString('ja-JP')}G` : '', r.m ? `${MATS[r.m[0]]}×${r.m[1]}` : ''].filter(Boolean).join('＋');
// 達成したもの（まだ受け取っていない）を記録し、新しく達成したものを返す
export function checkAch(){
  const got = [];
  for (const a of ACH){
    if (SAVE.ach[a.id]) continue;
    if (a.v() >= a.goal){ SAVE.ach[a.id] = 1; got.push(a); }
  }
  return got;
}
export const achClaimable = () => ACH.filter(a => SAVE.ach[a.id] === 1);
export function claimAch(id){
  const a = ACH.find(x => x.id === id);
  if (!a || SAVE.ach[id] !== 1) return false;
  const before = CAPES.filter((c, i) => capeOpen(i)).length;
  SAVE.ach[id] = 2;
  if (!SAVE.look.title) SAVE.look.title = id;   // 最初の称号は自動で名乗る
  const after = CAPES.filter((c, i) => capeOpen(i)).length;
  if (after > before) SAVE.look.cape = after - 1;   // 新しいマントはすぐ着る
  if (a.r.g) SAVE.gold += a.r.g;
  if (a.r.m) SAVE.mats[a.r.m[0]] += a.r.m[1];
  saveGame();
  return true;
}

// ---------- 日替わりダンジョン ----------
export const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function hashStr(s){ let h = 2166136261; for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
// 決まった並びの乱数（同じ seed なら同じ列）
export function seeded(seed){
  let a = seed >>> 0;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
// その日の条件（良いもの1つ・厳しいもの1つ）
export const DAILY_MODS = {
  gold: {n:'黄金の日',     d:'ゴールド2倍',               good:1},
  loot: {n:'宝の日',       d:'装備のドロップ率 1.5倍',     good:1},
  wise: {n:'学びの日',     d:'経験値 1.5倍',              good:1},
  heal: {n:'癒しの日',     d:'ボスを倒すとHPが全回復',     good:1},
  fast: {n:'俊敏な敵',     d:'敵の動きが1.3倍'},
  elite:{n:'エリートの日', d:'エリートが3倍出る'},
  horde:{n:'大群の日',     d:'大群が来る間隔が短い'},
  tough:{n:'頑丈な敵',     d:'敵のHP 1.4倍'},
  fog:  {n:'霧の日',       d:'どのエリアにも霧が出る'},
};
// 節目の報酬（その日に初めて倒したボスごと。ゴールドは難易度倍）
export const DAILY_REWARD = {500:{g:800, m:[1, 3]}, 1000:{g:1500, m:[2, 2]}, 1500:{g:2500, m:[3, 1]}, 2000:{g:4000, m:[3, 2]}};
// 難易度：踏破した一番上の難易度（まだなら1）
export const dailyDiff = () => Math.max(1, ...Object.keys(SAVE.prog.clears).map(Number));
export function dailyPlan(key = dateKey()){
  const rng = seeded(hashStr('lootrunner-daily:' + key));
  const zones = [0, 1, 2, 3];
  for (let i = zones.length - 1; i > 0; i--){ const j = Math.floor(rng()*(i + 1)); [zones[i], zones[j]] = [zones[j], zones[i]]; }
  const good = Object.keys(DAILY_MODS).filter(k => DAILY_MODS[k].good), bad = Object.keys(DAILY_MODS).filter(k => !DAILY_MODS[k].good);
  const mods = [good[Math.floor(rng()*good.length)], bad[Math.floor(rng()*bad.length)]];
  return {key, seed:hashStr('lootrunner-course:' + key), zones, mods, diff:dailyDiff()};
}
// 今日の記録（日付が変わっていたら新しくする）
export function dailyToday(key = dateKey()){
  const D = SAVE.daily;
  if (D.key !== key){ D.key = key; D.best = 0; D.got = []; D.tries = 0; D.clear = false; }
  return D;
}
export function dailyStreak(key = dateKey()){
  const H = SAVE.daily.hist, d = new Date(key + 'T12:00:00');
  let n = 0;
  if (!H[dateKey(d)]) d.setDate(d.getDate() - 1);   // 今日まだなら昨日から数える
  while (H[dateKey(d)]){ n++; d.setDate(d.getDate() - 1); }
  return n;
}

// ---------- 記録（出撃の終わりに呼ぶ） ----------
// 戻り値：{ach：新しく達成した実績, daily：日替わりで受け取った報酬の一覧}
export function recordRun(R){
  const st = S();
  st.kills += R.kills; st.gold += R.gold; st.time += R.t; st.dist += Math.max(0, R.dist - R.start);
  st.bosses += R.bossLog.length;
  for (const b of R.bossLog) st.bossKinds[b.id] = 1;
  st.elites += R.eliteKills || 0; st.stomps += R.stomps; st.jumps += R.jumpsUsed;
  st.items += R.loot.length + (R.salv || 0); st.flawless += R.flawless || 0; st.evos += R.evos || 0;
  if (R.endReason === 'dead' || R.endReason === 'boss') st.deaths++;
  if (R.endReason === 'retreat') st.retreats++;
  st.maxKills = Math.max(st.maxKills, R.kills);
  st.maxLv = Math.max(st.maxLv, R.sk.lv);
  const out = {ach:[], daily:[]};
  if (R.daily){
    const D = dailyToday(R.daily.key);
    if (!D.tries) st.dailies++;
    D.tries++;
    D.best = Math.max(D.best, Math.floor(R.dist));
    if (R.endReason === 'clear'){ if (!D.clear) st.dailyClears++; D.clear = true; }
    for (const b of R.bossLog){
      if (D.got.includes(b.at) || !DAILY_REWARD[b.at]) continue;
      D.got.push(b.at);
      const r = DAILY_REWARD[b.at], g = r.g * R.diff;
      SAVE.gold += g; SAVE.mats[r.m[0]] += r.m[1];
      out.daily.push({at:b.at, g, m:r.m});
    }
    const H = SAVE.daily.hist;
    H[D.key] = {best:D.best, clear:D.clear, tries:D.tries, mods:R.daily.mods, diff:R.daily.diff};
    const keys = Object.keys(H).sort();
    while (keys.length > HIST_MAX) delete H[keys.shift()];
  }
  out.ach = checkAch();
  saveGame();
  return out;
}
