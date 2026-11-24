// セーブ（localStorage）。読み書きはすべて try/catch で囲む。
import { RAR, WTYPES, AFFIX, uniqueOf, SETS, EQUIP_SLOTS, slotOfKey, INV_BASE, INV_LIMIT, DIFF_MAX, CLEAR_DIST, FAC_MAX } from './data.js';
import { genItem, tierFromValue } from './items.js';
import { toast } from './ui.js';

// キー名は試作のまま（変えると既存のセーブが見えなくなる）。形式の版は中身の v で管理する。
export const SKEY = 'lootrunner-save-v1';
export const SAVE_VERSION = 6;
const EXPORT_PREFIX = 'LOOTRUNNER1:';
const SLOTS = ['weapon', 'head', 'body', 'charm'];

export let SAVE = null;
export let lastSavedAt = 0;
let lastWritten = null;   // 最後に書き込んだ文字列。中身が変わっていなければ書き込まない
let failToastAt = 0;

export function newSave(){
  SAVE = {v:SAVE_VERSION, gold:0, best:0, runs:0, nextId:1, inv:[], equip:emptyEquip(), sort:'power', settings:newSettings(), ...v3Fields(), prog:newProg(), ...v5Fields(), look:newLook()};
  const w = genItem(1, 0, 0, {slot:'weapon', type:'sword', r:0});
  w.q = 1; w.isNew = false;
  SAVE.equip.weapon = w;
}

const emptyEquip = () => ({weapon:null, head:null, body:null, charm1:null, charm2:null});
// v3 で増えた欄（素材・所持枠・自動分解・絞り込み・図鑑）
const v3Fields = () => ({mats:[0,0,0,0,0], invMax:INV_BASE, autoSalv:-1, filter:{slot:'all', r:0}, codex:{u:{}, s:{}}});
// v4：進み具合。maxDiff：解放した難易度 / cp[難易度]：倒したボスの位置（チェックポイント）/ best[難易度]：最高距離 / diff・start：前回の選択
const newProg = () => ({maxDiff:1, diff:1, start:0, cp:{1:0}, best:{1:0}, clears:{}, foes:{}});
// v5：やり込み要素。fac：施設のLv / ach：実績（1＝達成・2＝受け取り済み）/ skill：見たスキル・進化・最初のスキル / daily：日替わり / stats：記録
const FAC_IDS = Object.keys(FAC_MAX);
export const STAT_KEYS = ['kills', 'gold', 'time', 'dist', 'bosses', 'elites', 'stomps', 'jumps', 'items', 'deaths', 'retreats',
  'maxKills', 'maxLv', 'flawless', 'evos', 'smith', 'upMax', 't6', 'facUps', 'dailies', 'dailyClears'];
const newStats = () => ({...Object.fromEntries(STAT_KEYS.map(k => [k, 0])), bossKinds:{}});
const v5Fields = () => ({fac:Object.fromEntries(FAC_IDS.map(k => [k, 0])), ach:{}, skill:{seen:{}, evo:{}, start:'', off:{}},
  daily:{key:'', best:0, got:[], tries:0, clear:false, hist:{}}, stats:newStats()});

// v6：設定（音量・揺れ・ダメージ数字・省電力・ボタンの位置）と見た目（称号・マント）
export const newSettings = () => ({mute:false, bgm:0.5, sfx:0.8, shake:true, dmgNum:true, eco:false, left:false});
const newLook = () => ({title:'', cape:-1});
export const HIST_MAX = 30;   // 日替わりの履歴は直近30日分だけ残す（セーブが増え続けないように）

// ---------- 移行処理 ----------
// MIGRATIONS[n] は v(n) → v(n+1) の変換。形式を変えるときは SAVE_VERSION を上げてここに足す。
const MIGRATIONS = {
  // v1：試作版（バージョン番号なし）→ v2：バージョン番号と設定欄を追加
  1(d){
    d.settings = {};
    for (const it of [...(d.inv || []), ...Object.values(d.equip || {})]) if (it) delete it._d;
  },
  // v2 → v3：装備枠を 武器/頭/胴/装飾×2 に。防具→胴、装飾→装飾1。付与効果に階級。素材・図鑑など
  2(d){
    const conv = it => {
      if (!it || typeof it !== 'object') return it;
      if (it.slot === 'armor'){ it.slot = 'body'; it.type = 'body'; }
      if (Array.isArray(it.aff)) for (const a of it.aff) if (a && !a.t && AFFIX[a.k] && Number.isFinite(a.v)) a.t = tierFromValue(it, a);
      return it;
    };
    if (Array.isArray(d.inv)) d.inv.forEach(conv);
    const e = d.equip || {};
    d.equip = {weapon:conv(e.weapon) || null, head:null, body:conv(e.armor) || null, charm1:conv(e.charm) || null, charm2:null};
    Object.assign(d, v3Fields(), {sort:d.sort});
    for (const it of [...(d.inv || []), ...Object.values(d.equip)]) if (it && it.uniq) d.codex.u[it.uniq] = 1;
  },
  // v3 → v4：難易度とチェックポイント。これまでの最高距離から、倒したボス（距離がボスの位置を超えていれば倒している）を決める
  3(d){
    const best = Number.isFinite(d.best) ? d.best : 0;
    d.prog = newProg();
    d.prog.cp[1] = [1500, 1000, 500].find(b => best > b) || 0;
    d.prog.best[1] = Math.min(best, CLEAR_DIST);
    if (best > CLEAR_DIST){ d.prog.maxDiff = 2; d.prog.cp[2] = 0; d.prog.best[2] = 0; d.prog.clears[1] = 1; }
    if (best > 0) d.prog.foes = {bat:1, thrower:1, mini:1};   // もう知っている敵には説明を出さない
  },
  // v4 → v5：施設・実績・記録・日替わり。記録はわかる分だけ今までのデータから埋める（撃破数などはこの版から数える）
  4(d){
    Object.assign(d, v5Fields());
    const st = d.stats, P = d.prog || {}, cp1 = (P.cp && P.cp[1]) || 0;
    const kinds = ['kingslime', 'golem', 'witch', 'dragon'];
    const cleared = Object.keys(P.clears || {}).length > 0;
    kinds.slice(0, cleared ? 4 : cp1 / 500).forEach(k => { st.bossKinds[k] = 1; });
    st.bosses = Object.keys(st.bossKinds).length;
    const up = Math.max(0, ...[...(d.inv || []), ...Object.values(d.equip || {})].map(it => it && Number.isFinite(it.up) ? it.up : 0));
    st.upMax = up;
    st.t6 = [...(d.inv || []), ...Object.values(d.equip || {})].some(it => it && Array.isArray(it.aff) && it.aff.some(a => a && a.t >= 6)) ? 1 : 0;
  },
  // v5 → v6：設定の欄を増やす（消音はそのまま引き継ぐ）・見た目（称号・マント）
  5(d){
    const old = d.settings && typeof d.settings === 'object' ? d.settings : {};
    d.settings = {...newSettings(), mute:!!old.mute};
    d.look = {...newLook(), fresh:1};   // 起動後に、受け取り済みの実績から称号とマントを決める（meta.js の initLook）
  },
};

export function migrate(d){
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('セーブデータの形式が違います');
  let v = Number.isInteger(d.v) ? d.v : 1;
  if (v > SAVE_VERSION) throw new Error(`新しい版のセーブデータ（形式v${v}）です。アプリを最新にしてから読み込んでください`);
  while (v < SAVE_VERSION){
    MIGRATIONS[v](d);
    d.v = ++v;
  }
  return sanitize(d);
}

// 欠けた値を補い、壊れた装備を取り除く
function validItem(it){
  if (!it || typeof it !== 'object' || !Number.isFinite(it.id) || !SLOTS.includes(it.slot) || !RAR[it.r]) return false;
  if (it.slot === 'weapon' ? !WTYPES[it.type] : it.type !== it.slot) return false;
  if (!Number.isFinite(it.ilvl) || !Number.isFinite(it.q)) return false;
  it.aff = Array.isArray(it.aff) ? it.aff.filter(a => a && AFFIX[a.k] && Number.isFinite(a.v)) : [];
  if (it.tc !== 6 && it.tc !== 7) delete it.tc;
  for (const a of it.aff) if (!Number.isInteger(a.t) || a.t < 1 || a.t > (it.tc || 5)) a.t = tierFromValue(it, a);
  it.up = Number.isFinite(it.up) ? it.up : 0;
  if (it.uniq && !uniqueOf(it.uniq)) delete it.uniq;
  if (it.set && !SETS[it.set]) delete it.set;
  if (typeof it.name !== 'string') it.name = '名もなき装備';
  it.lock = !!it.lock; it.isNew = !!it.isNew;
  return true;
}
function sanitize(d){
  const num = x => Number.isFinite(x) ? x : 0, obj = x => x && typeof x === 'object' && !Array.isArray(x) ? x : {};
  d.gold = num(d.gold); d.best = num(d.best); d.runs = num(d.runs);
  d.inv = Array.isArray(d.inv) ? d.inv.filter(validItem) : [];
  const eq = d.equip && typeof d.equip === 'object' ? d.equip : {};
  d.equip = {};
  for (const k of EQUIP_SLOTS) d.equip[k] = validItem(eq[k]) && eq[k].slot === slotOfKey(k) ? eq[k] : null;
  const maxId = Math.max(0, ...d.inv.map(i => i.id), ...EQUIP_SLOTS.map(k => d.equip[k] ? d.equip[k].id : 0));
  d.nextId = Math.max(num(d.nextId), maxId + 1);
  if (!['power', 'rarity', 'new', 'ilvl', 'slot'].includes(d.sort)) d.sort = 'power';
  const se = obj(d.settings), def = newSettings(), vol = x => Number.isFinite(x) ? Math.min(1, Math.max(0, Math.round(x*10)/10)) : null;
  d.settings = {mute:!!se.mute, bgm:vol(se.bgm) ?? def.bgm, sfx:vol(se.sfx) ?? def.sfx,
    shake:se.shake !== false, dmgNum:se.dmgNum !== false, eco:!!se.eco, left:!!se.left};
  d.mats = Array.from({length:5}, (_, i) => Array.isArray(d.mats) ? Math.max(0, Math.floor(num(d.mats[i]))) : 0);
  d.invMax = Math.min(INV_LIMIT, Math.max(INV_BASE, Math.floor(num(d.invMax)) || INV_BASE));
  d.autoSalv = [-1, 0, 1, 2].includes(d.autoSalv) ? d.autoSalv : -1;
  const f = d.filter && typeof d.filter === 'object' ? d.filter : {};
  d.filter = {slot:['all', 'weapon', 'head', 'body', 'charm'].includes(f.slot) ? f.slot : 'all', r:[0, 1, 2, 3, 4].includes(f.r) ? f.r : 0};
  const c = d.codex && typeof d.codex === 'object' ? d.codex : {};
  d.codex = {u:c.u && typeof c.u === 'object' ? c.u : {}, s:c.s && typeof c.s === 'object' ? c.s : {}};
  const pr = d.prog && typeof d.prog === 'object' ? d.prog : {};
  const maxDiff = Math.min(DIFF_MAX, Math.max(1, Math.floor(num(pr.maxDiff)) || 1));
  const cp = {}, best = {}, clears = {};
  for (let k = 1; k <= maxDiff; k++){
    cp[k] = [0, 500, 1000, 1500].includes(obj(pr.cp)[k]) ? obj(pr.cp)[k] : 0;
    best[k] = Math.max(0, num(obj(pr.best)[k]));
    if (obj(pr.clears)[k]) clears[k] = Math.max(1, Math.floor(num(obj(pr.clears)[k])));
  }
  const diff = Math.min(maxDiff, Math.max(1, Math.floor(num(pr.diff)) || 1));
  const foes = {};
  for (const [k, v] of Object.entries(obj(pr.foes))) if (typeof k === 'string' && k.length < 20) foes[k] = 1;
  d.prog = {maxDiff, diff, start:[0, 500, 1000, 1500].includes(pr.start) && pr.start <= cp[diff] ? pr.start : 0, cp, best, clears, foes};
  // v5
  const fac = obj(d.fac);
  d.fac = Object.fromEntries(FAC_IDS.map(k => [k, Math.min(FAC_MAX[k], Math.max(0, Math.floor(num(fac[k]))))]));
  const ach = {};
  for (const [k, v] of Object.entries(obj(d.ach))) if (k.length < 20 && (v === 1 || v === 2)) ach[k] = v;
  d.ach = ach;
  const sk = obj(d.skill), flags = o => Object.fromEntries(Object.keys(obj(o)).filter(k => k.length < 20).map(k => [k, 1]));
  d.skill = {seen:flags(sk.seen), evo:flags(sk.evo), start:typeof sk.start === 'string' && sk.start.length < 20 ? sk.start : '', off:flags(sk.off)};
  const dl = obj(d.daily), hist = {};
  for (const [k, v] of Object.entries(obj(dl.hist)).filter(([k]) => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort((a, b) => a[0] < b[0] ? 1 : -1).slice(0, HIST_MAX)) if (v && typeof v === 'object')
    hist[k] = {best:Math.max(0, num(v.best)), clear:!!v.clear, tries:Math.max(0, Math.floor(num(v.tries))), mods:Array.isArray(v.mods) ? v.mods.filter(m => typeof m === 'string').slice(0, 4) : [], diff:Math.max(1, Math.floor(num(v.diff)) || 1)};
  d.daily = {key:typeof dl.key === 'string' ? dl.key : '', best:Math.max(0, num(dl.best)), got:Array.isArray(dl.got) ? dl.got.filter(x => [500, 1000, 1500, 2000].includes(x)) : [],
    tries:Math.max(0, Math.floor(num(dl.tries))), clear:!!dl.clear, hist};
  const st = obj(d.stats);
  d.stats = {...Object.fromEntries(STAT_KEYS.map(k => [k, Math.max(0, num(st[k]))])), bossKinds:flags(st.bossKinds)};
  // v6
  const lk = obj(d.look);
  d.look = {title:typeof lk.title === 'string' && lk.title.length < 20 && d.ach[lk.title] === 2 ? lk.title : '',
    cape:Number.isInteger(lk.cape) && lk.cape >= -1 && lk.cape < 8 ? lk.cape : -1, ...(lk.fresh === 1 ? {fresh:1} : {})};
  return d;
}

// ---------- 読み書き ----------
// 戻り値：'new'（初回）/ 'loaded' / 'broken'（読めなかったので新規。元データは別キーに退避）
export function loadGame(){
  let raw = null;
  try { raw = localStorage.getItem(SKEY); } catch(e){}
  if (raw){
    try { SAVE = migrate(JSON.parse(raw)); lastWritten = null; return 'loaded'; }
    catch(e){ try { localStorage.setItem(`${SKEY}-broken-${Date.now()}`, raw); } catch(_){} }
    newSave(); return 'broken';
  }
  newSave(); return 'new';
}
export function saveGame(){
  if (!SAVE) return false;
  let s;
  try { s = JSON.stringify(SAVE); } catch(e){ return false; }
  if (s === lastWritten) return true;
  try {
    localStorage.setItem(SKEY, s);
    lastWritten = s; lastSavedAt = Date.now();
    return true;
  } catch(e){
    if (Date.now() - failToastAt > 30000){ failToastAt = Date.now(); toast('保存できませんでした（空き容量やプライベートブラウズを確認）'); }
    return false;
  }
}

// ---------- 書き出し・読み込み・初期化 ----------
function toB64(str){
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function fromB64(b64){
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}
export function exportText(){
  return EXPORT_PREFIX + toB64(JSON.stringify(SAVE));
}
// 貼り付けられたテキストを読んで、移行済みのセーブを返す（SAVE にはまだ反映しない）。読めなければ例外。
export function parseImport(text){
  const t = String(text || '').trim();
  if (!t) throw new Error('テキストが空です');
  let json;
  if (t.startsWith('{')) json = t;
  else {
    const body = t.replace(/\s+/g, '');
    try { json = fromB64(body.startsWith(EXPORT_PREFIX) ? body.slice(EXPORT_PREFIX.length) : body); }
    catch(e){ throw new Error('読み込めない形式です。書き出したテキストを最初から最後まで貼り付けてください'); }
  }
  let data;
  try { data = JSON.parse(json); }
  catch(e){ throw new Error('テキストが途中で切れているか、壊れています。もう一度コピーしてください'); }
  return migrate(data);
}
export function applySave(data){
  SAVE = data; lastWritten = null;
  return saveGame();
}
export function resetSave(){
  newSave(); lastWritten = null;
  return saveGame();
}
