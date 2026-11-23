// セーブ（localStorage）。読み書きはすべて try/catch で囲む。
import { RAR, WTYPES, AFFIX, uniqueOf, SETS, EQUIP_SLOTS, slotOfKey, INV_BASE, INV_LIMIT } from './data.js';
import { genItem, tierFromValue } from './items.js';
import { toast } from './ui.js';

// キー名は試作のまま（変えると既存のセーブが見えなくなる）。形式の版は中身の v で管理する。
export const SKEY = 'lootrunner-save-v1';
export const SAVE_VERSION = 3;
const EXPORT_PREFIX = 'LOOTRUNNER1:';
const SLOTS = ['weapon', 'head', 'body', 'charm'];

export let SAVE = null;
export let lastSavedAt = 0;
let lastWritten = null;   // 最後に書き込んだ文字列。中身が変わっていなければ書き込まない
let failToastAt = 0;

export function newSave(){
  SAVE = {v:SAVE_VERSION, gold:0, best:0, runs:0, nextId:1, inv:[], equip:emptyEquip(), sort:'power', settings:{}, ...v3Fields()};
  const w = genItem(1, 0, 0, {slot:'weapon', type:'sword', r:0});
  w.q = 1; w.isNew = false;
  SAVE.equip.weapon = w;
}

const emptyEquip = () => ({weapon:null, head:null, body:null, charm1:null, charm2:null});
// v3 で増えた欄（素材・所持枠・自動分解・絞り込み・図鑑）
const v3Fields = () => ({mats:[0,0,0,0,0], invMax:INV_BASE, autoSalv:-1, filter:{slot:'all', r:0}, codex:{u:{}, s:{}}});

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
  for (const a of it.aff) if (!Number.isInteger(a.t) || a.t < 1 || a.t > 5) a.t = tierFromValue(it, a);
  it.up = Number.isFinite(it.up) ? it.up : 0;
  if (it.uniq && !uniqueOf(it.uniq)) delete it.uniq;
  if (it.set && !SETS[it.set]) delete it.set;
  if (typeof it.name !== 'string') it.name = '名もなき装備';
  it.lock = !!it.lock; it.isNew = !!it.isNew;
  return true;
}
function sanitize(d){
  const num = x => Number.isFinite(x) ? x : 0;
  d.gold = num(d.gold); d.best = num(d.best); d.runs = num(d.runs);
  d.inv = Array.isArray(d.inv) ? d.inv.filter(validItem) : [];
  const eq = d.equip && typeof d.equip === 'object' ? d.equip : {};
  d.equip = {};
  for (const k of EQUIP_SLOTS) d.equip[k] = validItem(eq[k]) && eq[k].slot === slotOfKey(k) ? eq[k] : null;
  const maxId = Math.max(0, ...d.inv.map(i => i.id), ...EQUIP_SLOTS.map(k => d.equip[k] ? d.equip[k].id : 0));
  d.nextId = Math.max(num(d.nextId), maxId + 1);
  if (!['power', 'rarity', 'new', 'ilvl', 'slot'].includes(d.sort)) d.sort = 'power';
  if (!d.settings || typeof d.settings !== 'object') d.settings = {};
  d.mats = Array.from({length:5}, (_, i) => Array.isArray(d.mats) ? Math.max(0, Math.floor(num(d.mats[i]))) : 0);
  d.invMax = Math.min(INV_LIMIT, Math.max(INV_BASE, Math.floor(num(d.invMax)) || INV_BASE));
  d.autoSalv = [-1, 0, 1, 2].includes(d.autoSalv) ? d.autoSalv : -1;
  const f = d.filter && typeof d.filter === 'object' ? d.filter : {};
  d.filter = {slot:['all', 'weapon', 'head', 'body', 'charm'].includes(f.slot) ? f.slot : 'all', r:[0, 1, 2, 3, 4].includes(f.r) ? f.r : 0};
  const c = d.codex && typeof d.codex === 'object' ? d.codex : {};
  d.codex = {u:c.u && typeof c.u === 'object' ? c.u : {}, s:c.s && typeof c.s === 'object' ? c.s : {}};
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
