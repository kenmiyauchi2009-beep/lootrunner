// 拠点画面（装備・所持品・鍛冶・図鑑）
import { $, fmt } from './util.js';
import { RAR, WTYPES, SLOT_N, ICON, AFFIX, UNIQUES, uniqueOf, SETS, MATS, EQUIP_SLOTS, slotOfKey, INV_LIMIT, invExpandCost, ZONES, diffInfo, CP_RULE } from './data.js';
import { affRange, tierRange, fmtNum, fmtAff, affGrade, baseStats, computeStats, powerWith, equipKeyFor, equippedKey,
  salvageValue, salvageMats, upgradeCost, rerollCost, valueCost, lockCost, canPay,
  smithUpgrade, smithReroll, smithValue, smithLock, salvage } from './items.js';
import { SAVE, saveGame } from './save.js';
import { closeModal, dialog, closeDialog, toast } from './ui.js';
import { startRun } from './run.js';
import { renderHub } from './hub.js';
import { ACTIVES, PASSIVES, unlocked } from './skills.js';
import { TRAIN } from './meta.js';
import { icon, itemIcon, matIcon, matChip, goldChip, costHTML } from './icons.js';
import { setupCamp, campHit, kickCamp, stopCamp } from './camp.js';
import { titleText } from './meta.js';
import { openFacilities, openLook } from './hub.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]));
const costText = c => costHTML(c, SAVE);
const matsText = m => `${MATS[m.r]}×${m.n}`;
const subText = it => `${SLOT_N[it.slot]}${it.slot==='weapon' ? '・' + WTYPES[it.type].n : ''} ・ Lv${it.ilvl}${it.up ? ' ・ +' + it.up : ''} ・ 品質${Math.round(it.q*100)}%`;

export function itemRowHTML(it, right){
  const rc = RAR[it.r].c, S = it.set && SETS[it.set];
  return `<div class="item" data-id="${it.id}" style="--rc:${rc}">
    <div class="ico">${itemIcon(it.type)}</div>
    <div class="nm"><b>${esc(it.name)}${it.up ? ' +' + it.up : ''}${it.isNew ? '<span class="tag new">NEW</span>' : ''}${S ? `<span class="tag set" style="--sc:${S.c}">${S.n}</span>` : ''}${it.lock ? '<span class="tag lock">保護</span>' : ''}</b><small>${subText(it)}</small></div>
    ${right || ''}</div>`;
}
function diffHTML(d){
  if (Math.abs(d) < 0.5) return `<span class="diff same">±0</span>`;
  return `<span class="diff ${d>0?'up':'down'}">${d>0?'▲':'▼'}${fmt(Math.abs(d))}</span>`;
}

// ---------- 拠点の表示 ----------
export function renderBase(){
  const st = computeStats(SAVE.equip);
  $('bGold').textContent = fmt(SAVE.gold) + ' G';
  const P = SAVE.prog;
  $('bBest').textContent = `${P.maxDiff > 1 ? `難易度${P.diff} ` : ''}最高 ${fmt(P.best[P.diff] || 0)}m`;
  const cp = P.cp[P.diff] || 0;
  $('goSub').textContent = P.maxDiff > 1 || cp ? `難易度${P.diff}${P.maxDiff > 1 ? `（${P.maxDiff}まで解放）` : ''} ・ チェックポイント ${cp ? cp + 'mまで' : 'なし'}` : '2000m の4体目のボスを倒すと踏破';
  $('bPower').textContent = fmt(st.power);
  $('bStats').innerHTML = [
    ['DPS(目安)', fmt(st.dps)], ['ボス火力', fmt(st.bossDps)], ['最大HP', fmt(st.hp)],
    ['被ダメ軽減', Math.round(st.defRed*100) + '%' + (st.dodgeC ? ` 回避${Math.round(st.dodgeC*100)}%` : '')], ['攻撃/秒', st.rate.toFixed(2)], ['会心', `${Math.round(st.crit)}% ×${st.critM.toFixed(2)}`],
  ].map(([k,v]) => `<div class="stat"><small>${k}</small><b>${v}</b></div>`).join('');
  $('bEquip').innerHTML = EQUIP_SLOTS.map(k => {
    const it = SAVE.equip[k];
    return it ? itemRowHTML(it, `<span class="diff same">${SLOT_N[k]}</span>`)
      : `<div class="item" style="--rc:#444"><div class="ico">${itemIcon(k==='weapon' ? 'sword' : slotOfKey(k))}</div><div class="nm"><b style="color:var(--muted)">${SLOT_N[k]}：なし</b><small>冒険で拾える</small></div></div>`;
  }).join('');
  $('bSets').innerHTML = Object.entries(st.sets).map(([id, n]) => setLineHTML(id, n)).join('');
  $('bMats').innerHTML = MATS.map((m, i) => `<span class="mat" style="--rc:${RAR[i].c}">${matIcon(i)}${m}<b>${fmt(SAVE.mats[i])}</b></span>`).join('');
  $('bInvTitle').textContent = `所持品 ${SAVE.inv.length}/${SAVE.invMax}`;
  $('expandBtn').disabled = SAVE.invMax >= INV_LIMIT;
  $('sortSel').value = SAVE.sort;
  $('fSlot').value = SAVE.filter.slot;
  $('fRar').value = String(SAVE.filter.r);
  $('autoSel').value = String(SAVE.autoSalv);
  // 絞り込み → 並び替え（戦力の差は1回だけ計算する）
  let list = SAVE.inv.filter(i => (SAVE.filter.slot === 'all' || i.slot === SAVE.filter.slot) && i.r >= SAVE.filter.r);
  const gain = new Map(list.map(i => [i, powerWith(i) - st.power]));
  const order = {weapon:0, head:1, body:2, charm:3};
  const sorts = {
    power: (a, b) => gain.get(b) - gain.get(a),
    rarity:(a, b) => b.r - a.r || b.ilvl - a.ilvl,
    ilvl:  (a, b) => b.ilvl - a.ilvl || b.r - a.r,
    slot:  (a, b) => order[a.slot] - order[b.slot] || gain.get(b) - gain.get(a),
    new:   (a, b) => b.id - a.id,
  };
  list.sort(sorts[SAVE.sort] || sorts.power);
  const hidden = SAVE.inv.length - list.length;
  $('bInv').innerHTML = (list.length ? list.map(it => itemRowHTML(it, diffHTML(gain.get(it)))).join('')
    : `<div class="empty">${SAVE.inv.length ? '条件に合う装備がない。' : 'まだ何もない。出撃して装備を拾おう。'}</div>`)
    + (hidden ? `<div class="empty">絞り込みで ${hidden}個 を隠しています</div>` : '');
  // 拠点タブ：村の絵・戦力・称号、タブの印（新しい装備の数・戦力が上がる装備）
  $('campPow').textContent = fmt(st.power);
  const tt = titleText();
  $('campTag').innerHTML = tt ? `<small>称号</small>〈${esc(tt)}〉` : '';
  $('campTag').classList.toggle('hidden', !tt);
  const nNew = SAVE.inv.filter(i => i.isNew).length, better = SAVE.inv.some(i => gain.get(i) > 0.5 || (!gain.has(i) && powerWith(i) - st.power > 0.5));
  $('bagBadge').textContent = nNew ? String(nNew) : '';
  $('gearBadge').textContent = better ? '▲' : '';
  renderHub();
  kickCamp();
}

// ---------- タブ（拠点・装備・所持品） ----------
let tab = 'tabHome';
export const homeVisible = () => tab === 'tabHome' && !$('base').classList.contains('hidden') && $('title').classList.contains('hidden');
export function showTab(id){
  tab = id;
  for (const t of ['tabHome', 'tabGear', 'tabBag']) $(t).classList.toggle('hidden', t !== id);
  document.querySelectorAll('#tabbar [data-tab]').forEach(b => { const on = b.dataset.tab === id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  window.scrollTo(0, 0);
  if (id === 'tabHome') kickCamp(); else stopCamp();
}
document.querySelectorAll('#tabbar [data-tab]').forEach(b => b.onclick = () => showTab(b.dataset.tab));
document.querySelectorAll('[data-ic]').forEach(el => { el.outerHTML = icon(el.dataset.ic); });
$('setBtn').innerHTML = icon('gear');
setupCamp($('campCv'), homeVisible);
// 村の絵のタップ：建物→その施設、主人公→見た目（称号・マント）
$('campCv').addEventListener('click', ev => {
  const r = $('campCv').getBoundingClientRect(), id = campHit(ev.clientX - r.left, ev.clientY - r.top);
  if (id === 'hero') openLook();
  else if (id) openFacilities(false, id);
});
function setLineHTML(id, n){
  const S = SETS[id];
  return `<div class="setline" style="--sc:${S.c}"><b>${S.n}</b> ${n}/4　${[2,3,4].map(k => `<span class="${n >= k ? 'on' : 'off'}">${k}：${S.b[k]}</span>`).join('　')}</div>`;
}

document.addEventListener('click', ev => {
  const row = ev.target.closest('.item[data-id]');
  if (row && !$('base').classList.contains('hidden') && !row.closest('#sheet')) openItem(Number(row.dataset.id));
});
$('sortSel').onchange = e => { SAVE.sort = e.target.value; saveGame(); renderBase(); };
$('fSlot').onchange = e => { SAVE.filter.slot = e.target.value; saveGame(); renderBase(); };
$('fRar').onchange = e => { SAVE.filter.r = Number(e.target.value); saveGame(); renderBase(); };
$('autoSel').onchange = e => {
  SAVE.autoSalv = Number(e.target.value); saveGame();
  toast(SAVE.autoSalv < 0 ? '自動分解をやめた' : `${['コモン','アンコモン以下','レア以下'][SAVE.autoSalv]}を拾ったら自動で分解する（セット・レジェンド・戦力が上がるものは残す）`);
};
$('goBtn').onclick = openSortie;
// 出撃の選択：難易度と、どこから走るか（チェックポイント）
export function openSortie(){
  const P = SAVE.prog;
  if (P.maxDiff === 1 && !P.cp[1]){ startRun({diff:1, start:0}); return; }
  let d = P.diff;
  const show = () => {
    const D = diffInfo(d), cp = P.cp[d] || 0;
    const starts = [0, 500, 1000, 1500].filter(s => s <= cp);
    dialog(`<h2>出撃</h2>
      ${P.maxDiff > 1 ? `<div class="seg">${Array.from({length:P.maxDiff}, (_, i) => `<button data-d="${i + 1}" class="${i + 1 === d ? 'on' : ''}" aria-pressed="${i + 1 === d}">難易度${i + 1}${P.clears[i + 1] ? ' ✓' : ''}</button>`).join('')}</div>` : ''}
      <p class="sksum">${d > 1 ? `敵の強さ HP×${D.hpMul.toFixed(1)}・攻撃×${D.dmgMul.toFixed(1)} ・ ` : ''}アイテムLv ${1 + D.lvOff}〜${D.ilvlMax} ・ 付与効果 T${D.tierCap}まで<br>
        最高 ${fmt(P.best[d] || 0)}m${P.clears[d] ? ` ・ 踏破 ${P.clears[d]}回` : ''}</p>
      <div class="btns starts">${starts.map(s => `<button class="${s === 0 ? 'primary' : ''}" data-s="${s}">${s ? `${s}m（${ZONES[s/500].n}）から` : '0mから'}
        <small>${s ? `雑魚のドロップ${Math.round(CP_RULE.dropMul*100)}%・ボスの装備${CP_RULE.bossDrops}個・踏破報酬なし・スキルはその分まとめて選ぶ` : `ボスの装備${CP_RULE.fullBossDrops}個・踏破するとエピック以上を1つ`}</small></button>`).join('')}
        <button id="dNo">やめる</button></div>`);
    document.querySelectorAll('#dcard [data-d]').forEach(b => b.onclick = () => { d = Number(b.dataset.d); show(); });
    document.querySelectorAll('#dcard [data-s]').forEach(b => b.onclick = () => startRun({diff:d, start:Number(b.dataset.s)}));
    $('dNo').onclick = closeDialog;
  };
  show();
}
$('codexBtn').onclick = openCodex;
$('expandBtn').onclick = () => {
  if (SAVE.invMax >= INV_LIMIT) return;
  const c = invExpandCost(SAVE.invMax);
  dialog(`<h2>所持枠を増やす</h2><p style="color:var(--muted);font-size:13px">${SAVE.invMax} → ${SAVE.invMax + 10}（最大${INV_LIMIT}）<br>${fmt(c)}G（所持 ${fmt(SAVE.gold)}G）</p>
    <div class="btns"><button class="primary" id="dOk" ${SAVE.gold < c ? 'disabled' : ''}>${fmt(c)}Gで増やす</button><button id="dNo">やめる</button></div>`);
  $('dOk').onclick = () => { if (SAVE.gold < c) return; SAVE.gold -= c; SAVE.invMax += 10; saveGame(); closeDialog(); renderBase(); toast(`所持枠が ${SAVE.invMax} になった`); };
  $('dNo').onclick = closeDialog;
};
// まとめて分解：保護・セット・レジェンド以外
$('bulkBtn').onclick = () => {
  const pickT = r => SAVE.inv.filter(i => !i.lock && !i.set && !i.uniq && i.r <= r);
  const opt = r => { const t = pickT(r); return `<button id="dR${r}" ${t.length ? '' : 'disabled'}>${['コモン','アンコモン以下','レア以下','エピック以下'][r]}（${t.length}個）</button>`; };
  dialog(`<h2>まとめて分解</h2><p style="color:var(--muted);font-size:13px">保護・セット・レジェンドは分解しません。</p>
    <div class="btns">${[0,1,2,3].map(opt).join('')}<button id="dNo">やめる</button></div>`);
  for (const r of [0,1,2,3]) $('dR' + r).onclick = () => {
    const t = pickT(r);
    const mats = [0,0,0,0,0]; let g = 0;
    for (const it of t){ g += salvageValue(it); const m = salvageMats(it); mats[m.r] += m.n; }
    dialog(`<h2>まとめて分解</h2><p style="font-size:13px">${t.length}個を分解して<br><b class="gold">${fmt(g)}G</b> ${mats.map((n, i) => n ? `＋${MATS[i]}×${n}` : '').join('')}</p>
      <div class="btns"><button class="primary" id="dOk">分解する</button><button id="dNo">やめる</button></div>`);
    $('dOk').onclick = () => { for (const it of t) salvage(it); SAVE.inv = SAVE.inv.filter(i => !t.includes(i)); saveGame(); closeDialog(); renderBase(); toast(`${t.length}個を分解した`); };
    $('dNo').onclick = closeDialog;
  };
  $('dNo').onclick = closeDialog;
};

// ---------- 装備の詳細・比較・鍛冶 ----------
export function findItem(id){
  for (const k of EQUIP_SLOTS) if (SAVE.equip[k] && SAVE.equip[k].id === id) return {it:SAVE.equip[k], key:k};
  const it = SAVE.inv.find(i => i.id === id);
  return it ? {it, key:null} : null;
}
let selLine = 0, selId = null, cmpKey = null;

// 今の装備と並べた比較（各ステータスの増減）
function compareHTML(it, key){
  const cur = computeStats(SAVE.equip), nw = computeStats({...SAVE.equip, [key]: it});
  const rows = [
    ['戦力', cur.power, nw.power, fmt],
    ['DPS', cur.dps, nw.dps, fmt],
    ['ボス火力', cur.bossDps, nw.bossDps, fmt],
    ['最大HP', cur.hp, nw.hp, fmt],
    ['被ダメ軽減', cur.defRed*100, nw.defRed*100, v => Math.round(v) + '%'],
    ['回避', cur.dodgeC*100, nw.dodgeC*100, v => Math.round(v) + '%'],
    ['攻撃/秒', cur.rate, nw.rate, v => v.toFixed(2)],
    ['会心率', cur.crit, nw.crit, v => Math.round(v) + '%'],
  ].filter(([n, a, b]) => n === '戦力' || Math.abs(a - b) > 1e-6 || a);
  const td = (a, b, f) => { const d = b - a, cls = Math.abs(d) < 1e-6 ? 'same' : d > 0 ? 'up' : 'down';
    return `<td>${f(a)}</td><td>→ ${f(b)}</td><td class="${cls}">${Math.abs(d) < 1e-6 ? '' : (d > 0 ? '▲' : '▼')}</td>`; };
  const other = SAVE.equip[key];
  const charmPick = it.slot === 'charm' && SAVE.equip.charm1 && SAVE.equip.charm2
    ? `<span><button class="small" data-cmp="charm1" ${key==='charm1'?'disabled':''}>装飾1と</button> <button class="small" data-cmp="charm2" ${key==='charm2'?'disabled':''}>装飾2と</button></span>` : '';
  return `<div class="compare"><div class="cmphead"><span>${other ? `${SLOT_N[key]}「${esc(other.name)}」と比べる` : `${SLOT_N[key]}は空き`}</span>${charmPick}</div>
    <table class="cmp">${rows.map(([n, a, b, f]) => `<tr><td>${n}</td>${td(a, b, f)}</tr>`).join('')}</table></div>`;
}

export function openItem(id){
  const f = findItem(id); if (!f) return;
  const {it, key} = f;
  if (selId !== id){ selId = id; selLine = 0; cmpKey = null; }
  if (it.isNew){ it.isNew = false; saveGame(); }
  const b = baseStats(it);
  let base = '';
  if (it.slot==='weapon'){
    const W = WTYPES[it.type];
    base = `<div class="line"><span>攻撃力</span><b>${fmt(b.dmg)}</b></div>
      <div class="line"><span>攻撃間隔${W.melee ? ` ・ 1回で${W.targets}体まで` : ''}</span><b>${W.interval.toFixed(2)}秒</b></div>
      ${W.crit ? `<div class="line"><span>武器の会心</span><b>+${W.crit}% ×+${W.critdmg}%</b></div>` : ''}`;
  } else if (b.hp){
    base = `<div class="line"><span>最大HP</span><b>+${fmt(b.hp)}</b></div><div class="line"><span>防御</span><b>${fmt(b.def)}</b></div>`;
  }
  // 付与効果（タップで選ぶ → 下の鍛冶で使う）
  if (selLine >= it.aff.length) selLine = 0;
  const affs = it.aff.map((a, i) => {
    const A = AFFIX[a.k], [lo, hi] = A.int ? [A.min, A.max] : tierRange(it, a.k, a.t), g = affGrade(it, a);
    return `<button class="aff ${i === selLine ? 'sel' : ''}" data-line="${i}" aria-pressed="${i === selLine}">
      <span class="tier t${A.int ? 0 : a.t}">${A.int ? '固定' : 'T' + a.t}</span>
      <span class="l">${fmtAff(it, a)}<span class="range">${A.int ? '' : `(T${a.t}：${fmtNum(a.k, lo)}〜${fmtNum(a.k, hi)})`}</span>
      <div class="meter"><i style="width:${Math.min(100, Math.round(10 + g*90))}%"></i></div></span></button>`;
  }).join('');
  let smith = '';
  if (it.aff.length){
    const a = it.aff[selLine], vc = valueCost(it), rc = rerollCost(it), lc = lockCost(it);
    const canV = !AFFIX[a.k].int && canPay(vc), canR = canPay(rc), canL = it.aff.length >= 2 && canPay(lc);
    smith = `<div class="smith"><p>鍛冶：「${AFFIX[a.k].n}」を選択中</p><div class="row">
      <button id="sValue" ${canV ? '' : 'disabled'}>数値を再抽選（階級と値）<small>${AFFIX[a.k].int ? '対象外' : costText(vc)}</small></button>
      <button id="sReroll" ${canR ? '' : 'disabled'}>別の効果に付け替え<small>${costText(rc)}</small></button>
      <button id="sLock" ${canL ? '' : 'disabled'}>これを残して他を引き直す<small>${it.aff.length < 2 ? '2行以上で使える' : costText(lc)}</small></button>
    </div></div>`;
  }
  const U = it.uniq && uniqueOf(it.uniq), S = it.set && SETS[it.set];
  const setN = S ? (computeStats(SAVE.equip).sets[it.set] || 0) : 0;
  const tgt = key || cmpKey || equipKeyFor(it);
  const uc = upgradeCost(it), sv = salvageValue(it), sm = salvageMats(it);
  const equipBtns = key ? (key !== 'weapon' ? `<button id="aUnequip">外す</button>` : '')
    : `<button class="primary wide" id="aEquip">${SLOT_N[tgt]}に装備する</button>`;
  $('sheet').style.setProperty('--rc', RAR[it.r].c);
  $('sheet').innerHTML = `
    <h3>${esc(it.name)}${it.up ? ' +' + it.up : ''}</h3>
    <div class="sub">${RAR[it.r].n} ・ ${subText(it)}${key ? ` ・ ${SLOT_N[key]}に装備中` : ''}</div>
    ${base}
    ${affs || '<div class="line" style="color:var(--muted)">付与効果なし（アンコモン以上で付く）</div>'}
    ${smith}
    ${U ? `<div class="uniq">★ ${U.desc}</div>` : ''}
    ${S ? `<div class="setline" style="--sc:${S.c}"><b>${S.n}セット</b>（装備中 ${setN}/4）<br>${[2,3,4].map(k => `<span class="${setN >= k ? 'on' : 'off'}">${k}個：${S.b[k]}</span>`).join('<br>')}</div>` : ''}
    ${key ? '' : compareHTML(it, tgt)}
    <div class="actions">
      ${equipBtns}
      <button id="aUp" ${it.up >= 10 || !canPay(uc) ? 'disabled' : ''}>${it.up >= 10 ? '強化 最大' : `強化 +${it.up + 1}<br><small>${costText(uc)}</small>`}</button>
      ${key ? '' : `<button id="aLock">${it.lock ? '保護を外す' : '保護する'}</button>`}
      ${key ? '' : `<button id="aSalv" ${it.lock ? 'disabled' : ''}>分解<br><small>${goldChip(sv)}${matChip(sm.r, sm.n)}</small></button>`}
      <button id="aClose" class="${key ? '' : 'wide'}">閉じる</button>
    </div>`;
  $('modal').classList.remove('hidden');
  const re = () => { renderBase(); openItem(id); };
  $('sheet').querySelectorAll('[data-line]').forEach(b => b.onclick = () => { selLine = Number(b.dataset.line); openItem(id); });
  $('sheet').querySelectorAll('[data-cmp]').forEach(b => b.onclick = () => { cmpKey = b.dataset.cmp; openItem(id); });
  if ($('aEquip')) $('aEquip').onclick = () => { equipItem(it, tgt); renderBase(); closeModal(); toast(`${it.name} を${SLOT_N[tgt]}に装備した`); };
  if ($('aUnequip')) $('aUnequip').onclick = () => {
    if (SAVE.inv.length >= SAVE.invMax){ toast('所持品がいっぱい'); return; }
    SAVE.equip[key] = null; SAVE.inv.push(it); saveGame(); renderBase(); closeModal(); };
  $('aUp').onclick = () => { if (smithUpgrade(it)){ saveGame(); re(); toast(`+${it.up} に強化した`); } };
  if ($('aLock')) $('aLock').onclick = () => { it.lock = !it.lock; saveGame(); re(); };
  if ($('aSalv')) $('aSalv').onclick = () => {
    const r = salvage(it); SAVE.inv = SAVE.inv.filter(i => i !== it); saveGame(); renderBase(); closeModal();
    toast(`分解して +${fmt(r.g)}G・${matsText(r.m)}`); };
  $('aClose').onclick = closeModal;
  const before = it.aff[selLine] && fmtAff(it, it.aff[selLine]);
  if ($('sValue')) $('sValue').onclick = () => { if (smithValue(it, selLine)){ saveGame(); re(); toast(`${before} → ${fmtAff(it, it.aff[selLine])}（T${it.aff[selLine].t}）`); } };
  if ($('sReroll')) $('sReroll').onclick = () => { if (smithReroll(it, selLine)){ saveGame(); re(); toast(`${before} → ${fmtAff(it, it.aff[selLine])}`); } };
  if ($('sLock')) $('sLock').onclick = () => { if (smithLock(it, selLine)){ saveGame(); re(); toast(`「${AFFIX[it.aff[selLine].k].n}」を残して引き直した`); } };
}
// key を省略すると空き枠か、戦力が高くなる方の枠へ
export function equipItem(it, key = equipKeyFor(it)){
  const from = equippedKey(it), cur = SAVE.equip[key];
  if (from){ SAVE.equip[from] = cur; SAVE.equip[key] = it; saveGame(); return; }   // 装飾1と2の入れ替え
  SAVE.inv = SAVE.inv.filter(i => i !== it);
  if (cur) SAVE.inv.push(cur);
  SAVE.equip[key] = it;
  saveGame();
}

// ---------- 図鑑 ----------
export function openCodex(){
  const C = SAVE.codex;
  const groups = ['sword','axe','dagger','bow','staff','head','body','charm'];
  const gname = t => WTYPES[t] ? WTYPES[t].n : SLOT_N[t];
  const found = UNIQUES.filter(u => C.u[u.id]).length;
  const legends = groups.map(t => {
    const us = UNIQUES.filter(u => u.type === t);
    return us.map(u => C.u[u.id]
      ? `<div class="cx"><b>${u.name}</b>（${gname(t)}）<small>${u.desc}</small></div>`
      : `<div class="cx no"><b>？？？</b>（${gname(t)}のレジェンド）<small>まだ見つけていない</small></div>`).join('');
  }).join('');
  const sets = Object.entries(SETS).map(([id, S]) => {
    const got = C.s[id] || {};
    return `<div class="cx" style="--sc:${S.c}"><b style="color:${S.c}">${got && Object.keys(got).length ? S.n : '？？？'}セット</b>
      <small>${[2,3,4].map(k => `${k}個：${Object.keys(got).length ? S.b[k] : '？？？'}`).join('<br>')}</small>
      <div class="pieces">${['weapon','head','body','charm'].map(sl => `<span class="${got[sl] ? 'got' : ''}">${SLOT_N[sl]}</span>`).join('')}</div></div>`;
  }).join('');
  // スキル：解放したもの・見た進化
  const trainAt = id => TRAIN.findIndex(t => t && t.sk && t.sk.includes(id));
  const skills = Object.entries(ACTIVES).map(([id, A]) => {
    if (!unlocked(id)) return `<div class="cx no"><b>？？？</b><small>訓練所 Lv${trainAt(id)} で解放</small></div>`;
    const ev = SAVE.skill.evo[id];
    return `<div class="cx"><b style="color:${A.c}">${A.n}</b>${SAVE.skill.seen[id] ? '' : '（まだ選んでいない）'}
      <small>進化：${ev ? `<b style="color:${A.c}">${A.evo.n}</b> ― ${A.evo.desc}` : `？？？（Lv5＋${unlocked(A.evo.need) ? PASSIVES[A.evo.need].n : '？？？'}）`}</small></div>`;
  }).join('');
  const nEvo = Object.keys(SAVE.skill.evo).length;
  $('sheet').style.setProperty('--rc', 'var(--text)');
  $('sheet').innerHTML = `<h3>図鑑</h3><div class="sub">レジェンド ${found}/${UNIQUES.length} ・ 進化 ${nEvo}/12 ・ セットは見つけた部位に色がつく</div>
    <div class="codex"><h4>レジェンド</h4>${legends}<h4>セット</h4>${sets}<h4>スキルと進化</h4>${skills}</div>
    <div class="actions"><button class="wide" id="aClose">閉じる</button></div>`;
  $('modal').classList.remove('hidden');
  $('sheet').scrollTop = 0;
  $('aClose').onclick = closeModal;
}
