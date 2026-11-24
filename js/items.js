// 装備ロジック（生成・付与効果と階級・セット・ステータス計算・鍛冶・分解）
import { rnd, pick, pickW } from './util.js';
import { WTYPES, BASE_NAMES, AFFIX, UNIQUES, uniqueOf, SETS, SET_CHANCE, EQUIP_SLOTS, SKILL_N, SKILL_LOCK } from './data.js';
import { SAVE } from './save.js';
import { smithDisc, salvGoldMul, salvMatPlus, dojoHp, dojoAtk, vaultGold } from './meta.js';

// ---------- 付与効果と階級 ----------
export function affRange(it, k){
  const a = AFFIX[k];
  if (a.int) return [a.min, a.max];
  const m = (a.scale ? 1 + it.ilvl*0.25 : 1) * (1 + it.r*0.08);
  return [a.min*m, a.max*m];
}
// 出る階級の上限はアイテムLvで決まる（Lv3でT2、Lv8でT3、Lv13でT4、Lv18でT5、Lv23でT6、Lv28でT7）。
// T6・T7 は難易度2・3以上で拾った装備だけ（it.tc に上限を記録。鍛冶で引き直しても上限は同じ）
export const tierCap = it => it.tc || 5;
export const maxTier = (ilvl, cap = 5) => Math.min(cap, 1 + Math.floor((ilvl + 2) / 5));
const TIER_W = [30, 25, 20, 15, 10, 6, 3];
function rollTier(it){
  const w = TIER_W.slice(0, maxTier(it.ilvl, tierCap(it)));
  let r = Math.random() * w.reduce((a, b) => a + b, 0), t = 0;
  while ((r -= w[t]) > 0 && t < w.length - 1) t++;
  return t + 1;
}
// 階級 t の値の範囲（全体の範囲を5等分。T6・T7 は最大値のさらに上）
export function tierRange(it, k, t){
  const [lo, hi] = affRange(it, k);
  return [lo + (hi - lo)*(t - 1)/5, lo + (hi - lo)*t/5];
}
// 「持って出撃」のスキル：訓練所で解放したものから選ぶ
export const startSkillPool = () => Object.keys(SKILL_N).filter(id => (SKILL_LOCK[id] || 0) <= ((SAVE.fac && SAVE.fac.train) || 0));
export function rollAff(it, k, t = rollTier(it)){
  const A = AFFIX[k];
  if (A.skill){ const pool = startSkillPool(); return {k, t:1, v:1, s:pick(pool.length ? pool : ['blade'])}; }
  if (A.int) return {k, t, v: A.min + Math.floor(Math.random()*(A.max - A.min + 1))};
  const [lo, hi] = tierRange(it, k, t);
  return {k, t, v: rnd(lo, hi)};
}
// 古いセーブの付与効果（階級なし）に、値から階級をつける
export function tierFromValue(it, a){
  const [lo, hi] = affRange(it, a.k);
  return hi === lo ? 1 : Math.max(1, Math.min(tierCap(it), Math.ceil((a.v - lo)/(hi - lo)*5 - 1e-9)));
}
export function allowedAff(it, except){
  return Object.keys(AFFIX).filter(k => {
    const a = AFFIX[k];
    return a.slots.includes(it.slot) && (!a.types || a.types.includes(it.type))
      && !it.aff.some(x => x.k===k && x!==except);
  });
}
export const affVal = (it,a) => AFFIX[a.k].int ? a.v : a.v*(1 + 0.05*it.up);
export function fmtNum(k, v){ const A = AFFIX[k]; return A.int ? String(v) : A.dec ? v.toFixed(A.dec) : String(Math.round(v)); }
export function fmtAff(it, a){
  const A = AFFIX[a.k];
  if (A.skill) return `「${SKILL_N[a.s] || '？'}」を持って出撃（Lv+${a.v}）`;
  return `${A.n} ${A.note ? '（' + A.note : '+'}${fmtNum(a.k, affVal(it,a))}${A.pct ? '%' : ''}${A.note ? '）' : ''}`;
}
export function affGrade(it, a){ const [lo,hi] = affRange(it,a.k); return hi===lo ? 1 : (a.v-lo)/(hi-lo); }

// ---------- 生成 ----------
export function genItem(ilvl, minR=0, dropB=0, force={}){
  const slot = force.slot || pickW({weapon:40, head:20, body:20, charm:20});
  const type = slot==='weapon' ? (force.type || pick(Object.keys(WTYPES))) : slot;
  const w = [50,30,14,5,1].map((v,i) => i ? v*(1 + dropB*i*0.6) : v);
  let r = force.r ?? Number(pickW(Object.fromEntries(w.map((v,i)=>[i,v]))));
  r = Math.max(r, minR);
  const it = {id:SAVE.nextId++, slot, type, r, ilvl, q: Math.round(rnd(0.8,1.2)*100)/100, up:0, aff:[], isNew:true, lock:false};
  if (force.tc > 5) it.tc = force.tc;
  let n = [0,1,2,3,4][r];
  if (slot==='charm') n = Math.max(1, n);
  for (let i=0;i<n;i++){ const opts = allowedAff(it); if (opts.length) it.aff.push(rollAff(it, pick(opts))); }
  if (r===4) it.uniq = force.uniq || pick(UNIQUES.filter(u => u.type===type)).id;
  else if (r>=2 && (force.set || Math.random() < SET_CHANCE)) it.set = force.set || pick(Object.keys(SETS));
  it.name = itemName(it);
  return it;
}
export function itemName(it){
  if (it.uniq) return uniqueOf(it.uniq).name;
  const tier = Math.min(3, Math.floor((it.ilvl-1)/8));
  const base = it.slot==='weapon' ? WTYPES[it.type].names[tier] : BASE_NAMES[it.slot][tier];
  if (it.set) return `${SETS[it.set].n}の${base}`;
  return (it.aff.length ? AFFIX[it.aff[0].k].pre : '') + base;
}
export function baseStats(it){
  const m = 1 + 0.12*it.up;
  if (it.slot==='weapon') return {dmg:(8 + it.ilvl*2.2) * WTYPES[it.type].mult * it.q * m};
  if (it.slot==='body')   return {hp:(20 + it.ilvl*6) * it.q * m, def:(2 + it.ilvl*1.2) * it.q * m};
  if (it.slot==='head')   return {hp:(10 + it.ilvl*3) * it.q * m, def:(1 + it.ilvl*0.6) * it.q * m};
  return {};
}

// ---------- ステータス計算 ----------
// eq：{weapon, head, body, charm1, charm2}
export function computeStats(eq){
  const s = {type:'sword', dmg:5, interval:0.6, range:110, targets:3, atk:0, aspd:0, crit:5, critdmg:50, rangeP:0,
    hp:100, def:0, regen:0, leech:0, gold:0, drop:0, burn:0, chain:0, multi:0, pierce:0,
    airAtk:0, lowHpAspd:0, bossDmg:0, killBolt:0, stompDmg:0, firstHit:0, thorns:0, dodge:0, xpGain:0, killHeal:0,
    skillDmg:0, skillCd:0, skillArea:0, skStart:0, skBoost:{},
    invMul:1, rarityB:0, maxJumps:2, uniq:new Set(), sets:{}, setB:new Set()};
  const w = eq.weapon;
  if (w){
    const W = WTYPES[w.type];
    s.type = w.type; s.dmg = baseStats(w).dmg; s.interval = W.interval; s.range = W.range || 0; s.targets = W.targets || 1;
    s.crit += W.crit || 0; s.critdmg += W.critdmg || 0;
  }
  for (const k of EQUIP_SLOTS){
    const it = eq[k];
    if (!it) continue;
    const b = baseStats(it);
    if (b.hp) s.hp += b.hp;
    if (b.def) s.def += b.def;
    for (const a of it.aff){
      if (AFFIX[a.k].skill){ if (a.s) s.skBoost[a.s] = (s.skBoost[a.s] || 0) + a.v; s.skStart += a.v; continue; }
      s[a.k] += affVal(it, a);
    }
    if (it.uniq) s.uniq.add(it.uniq);
    if (it.set) s.sets[it.set] = (s.sets[it.set] || 0) + 1;
  }
  // セット効果
  for (const [id, n] of Object.entries(s.sets)) for (const need of [2,3,4]) if (n >= need) s.setB.add(id + need);
  const B = x => s.setB.has(x), U = x => s.uniq.has(x);
  if (B('gale2')) s.aspd += 15;
  if (B('gale3')) s.airAtk += 40;
  if (B('bulwark2')) s.def *= 1.3;
  if (B('bulwark3')) s.hp *= 1.25;
  if (B('bulwark4')){ s.invMul = 1.5; s.thorns += 200; }
  if (B('hunter2')) s.crit += 8;
  if (B('hunter3')) s.critdmg += 50;
  if (B('hunter4')) s.bossDmg += 40;
  if (B('fortune2')) s.gold += 30;
  if (B('fortune3')) s.drop += 30;
  if (B('fortune4')) s.rarityB = 0.6;
  // レジェンド
  if (U('midas')){ s.gold += 100; s.drop += 50; }
  if (U('twin')) s.aspd -= 15;
  if (U('seeker')) s.pierce += 2;
  if (U('execute')) s.bossDmg += 40;
  if (U('sage')) s.xpGain += 40;
  if (U('hawk')) s.crit += 15;
  if (U('thornmail')) s.thorns += 300;
  if (U('wing')) s.maxJumps = 3;
  if (U('archmage')) s.skillDmg += 30;
  if (U('thunderking')) s.skBoost.bolt = (s.skBoost.bolt || 0) + 1;
  // 道場・金庫（施設）
  s.hp *= dojoHp(); s.atk += dojoAtk(); s.gold += vaultGold();

  s.finalDmg = s.dmg * (1 + s.atk/100);
  s.rate = Math.max(0.2, 1 + s.aspd/100) / s.interval;
  s.critC = Math.min(100, s.crit) / 100;
  s.critM = 1 + s.critdmg/100;
  s.defRed = s.def / (s.def + 40);
  s.dodgeC = Math.min(0.5, s.dodge/100);
  // 戦力の目安（実際の強さとの近似。条件付きの効果は控えめに数える）
  const shots = 1 + s.multi + (U('fan') ? 0.7 : 0);   // 千本弓の2本は35%の威力
  const typeF = {sword:1.4, axe:1.6, dagger:1.0, bow:1.0, staff:1.5}[s.type];
  const uniqF = (U('wave') ? 1.2 : 1) * (U('nova') ? 1.3 : 1) * (U('twin') ? 1.6 : 1) * (U('seeker') ? 1.3 : 1) * (U('storm') ? 1.35 : 1)
    * (U('quakeaxe') ? 1.3 : 1) * (U('execute') ? 1.15 : 1) * (U('shadow') ? 1 + s.critC : 1) * (U('venom') ? 1.4 : 1)
    * (U('tempest') ? 1.15 : 1) * (B('gale4') ? 1.15 : 1);
  s.dps = s.finalDmg * s.rate * (1 + s.critC*(s.critM-1)) * (1 + s.burn/100*1.2) * (1 + s.chain/100*1.2)
        * (1 + (shots-1)*0.7) * typeF * (1 + s.rangeP/200) * uniqF
        * (1 + s.airAtk/100*0.2) * (1 + s.lowHpAspd/100*0.1) * (1 + s.firstHit/100*0.2) * (1 + s.killBolt/100*0.06);
  // ボス火力：装備だけでボスに与える火力（スキルの分は含まない）。ボス戦の目安
  s.bossDps = s.dps * (1 + s.bossDmg/100) * (U('hawk') ? 1 + s.critC*0.5 : 1);
  const surv = Math.sqrt(s.hp/100) * (1 + s.defRed) / (1 - s.dodgeC*0.8)
    * (1 + s.regen/20 + s.leech/20 + s.killHeal/20) * (U('revive') ? 1.2 : 1) * (1 + Math.min(0.15, s.thorns/3000)) * (s.invMul > 1 ? 1.1 : 1);
  // スキルに効く装備：出撃中のスキルがダメージのおよそ半分なので、その分を戦力に足す
  const skillF = (1 + s.skillDmg/100) * (1 + s.skillCd/100) * (1 + s.skillArea/200) * (1 + 0.12*s.skStart + (U('thunderking') ? 0.12 : 0))
    * (U('pyreheart') ? 1.1 : 1) * (U('orbit') ? 1.12 : 1) * (U('archmage') ? 1.15 : 1) * (U('seed') ? 1.15 : 1);
  s.skillF = skillF;
  s.power = Math.sqrt(s.dps * s.bossDps) * surv * (1 + (skillF - 1)*0.5);
  return s;
}
// 装飾は2枠。空いていればそこへ、埋まっていれば戦力が高くなる方と入れ替える
export function equipKeyFor(it, eq = SAVE.equip){
  if (it.slot !== 'charm') return it.slot;
  if (!eq.charm1) return 'charm1';
  if (!eq.charm2) return 'charm2';
  return computeStats({...eq, charm1:it}).power >= computeStats({...eq, charm2:it}).power ? 'charm1' : 'charm2';
}
export function powerWith(item, key = equipKeyFor(item)){
  return computeStats({...SAVE.equip, [key]: item}).power;
}
export const equippedKey = it => EQUIP_SLOTS.find(k => SAVE.equip[k] === it);

// ---------- 鍛冶・分解の費用 ----------
// 費用は {gold, mat:{r, n}}。素材はレア度ごと（MATS）
// 倉庫（施設）で分解の収益が増え、鍛冶屋（施設）で鍛冶のゴールドが安くなる
export const salvageValue = it => Math.round(4 * it.ilvl * (1 + it.r*it.r) * (1 + it.up*0.5) * salvGoldMul());
export const salvageMats  = it => ({r:it.r, n:1 + (it.r >= 2 ? 1 : 0) + (it.up >= 5 ? 1 : 0) + salvMatPlus(it.r)});
const sg = g => Math.round(g * smithDisc());
export const upgradeCost  = it => ({gold:sg(12 * Math.pow(it.ilvl,1.1) * Math.pow(it.up+1,1.6) * (1 + it.r*0.5)),
                                    mat: it.up >= 5 ? {r:it.r, n:it.up - 4} : null});
export const rerollCost   = it => ({gold:sg(15 * it.ilvl * (1 + it.r)), mat:{r:it.r, n:1}});           // 付け替え
export const valueCost    = it => ({gold:sg(5 * it.ilvl * (1 + it.r)), mat:null});                    // 数値の再抽選（安い）
export const lockCost     = it => ({gold:sg(40 * it.ilvl * (1 + it.r)), mat:{r:Math.min(4, it.r + 1), n:1}}); // 効果の固定（高い）
export const canPay = c => SAVE.gold >= c.gold && (!c.mat || SAVE.mats[c.mat.r] >= c.mat.n);
function pay(c){
  if (!canPay(c)) return false;
  SAVE.gold -= c.gold;
  if (c.mat) SAVE.mats[c.mat.r] -= c.mat.n;
  SAVE.stats.smith++;
  return true;
}

// ---------- 鍛冶 ----------
export function smithUpgrade(it){
  if (it.up >= 10 || !pay(upgradeCost(it))) return false;
  it.up++;
  SAVE.stats.upMax = Math.max(SAVE.stats.upMax, it.up);
  return true;
}
// 付け替え：1行を別の効果に引き直す
export function smithReroll(it, i){
  const all = allowedAff(it, it.aff[i]), other = all.filter(k => k !== it.aff[i].k);
  const opts = other.length ? other : all;   // 「別の効果」なので、今と同じ効果は出さない（ほかに候補がなければ同じものから）
  if (!opts.length || !pay(rerollCost(it))) return false;
  it.aff[i] = rollAff(it, pick(opts));
  it.name = itemName(it);
  return true;
}
// 数値の再抽選：効果の種類はそのままで、階級と値を引き直す
export function smithValue(it, i){
  if (AFFIX[it.aff[i].k].int || !pay(valueCost(it))) return false;
  it.aff[i] = rollAff(it, it.aff[i].k);
  return true;
}
// 効果の固定：選んだ1行を残して、ほかの行を引き直す
export function smithLock(it, i){
  if (it.aff.length < 2 || !pay(lockCost(it))) return false;
  for (let j = 0; j < it.aff.length; j++){
    if (j === i) continue;
    const opts = allowedAff(it, it.aff[j]);
    if (opts.length) it.aff[j] = rollAff(it, pick(opts));
  }
  it.name = itemName(it);
  return true;
}
// 分解：ゴールドと素材
export function salvage(it){
  const g = salvageValue(it), m = salvageMats(it);
  SAVE.gold += g;
  SAVE.mats[m.r] += m.n;
  return {g, m};
}
// 図鑑に記録
export function noteFound(it){
  if (it.uniq) SAVE.codex.u[it.uniq] = 1;
  if (it.set) (SAVE.codex.s[it.set] ||= {})[it.slot] = 1;
  if (it.aff.some(a => a.t >= 6)) SAVE.stats.t6 = 1;
}
