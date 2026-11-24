// やり込み要素（画面）：施設・実績・記録・日替わりダンジョン
import { $, fmt } from './util.js';
import { MATS, ZONES, UNIQUES, BOSSES, RAR, CLEAR_DIST, DIFF_MAX } from './data.js';
import { SAVE, saveGame } from './save.js';
import { computeStats, powerWith } from './items.js';
import { closeModal, dialog, closeDialog, toast } from './ui.js';
import { FACILITIES, TRAIN, facLv, facCost, facEffect, facNext, upgradeFac, canUpgradeFac, trainPerks,
  ACH, claimAch, achClaimable, checkAch, rewardText, dailyPlan, dailyToday, dailyStreak, dateKey, DAILY_MODS, DAILY_REWARD,
  CAPES, capeOpen, nextCape, achGot, titleText } from './meta.js';
import { ACTIVES, PASSIVES, ALL_SKILLS, unlocked, MIN_ON } from './skills.js';
import { startRun } from './run.js';
import { renderBase, openItem, openSortie, showTab } from './base.js';
import { icon, itemIcon, costHTML, rewardHTML } from './icons.js';
import { drawBuilding, stageOf, STAGE_N, campFx, drawStandingHero, FAC_C } from './camp.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]));
// keep：同じ画面を描き直すとき（受け取り・強化のあと）はスクロール位置を残す
let openKind = '';
function openSheet(kind, html, keep){
  const sh = $('sheet'), y = sh.scrollTop, same = keep && openKind === kind && !$('modal').classList.contains('hidden');
  openKind = kind;
  sh.style.setProperty('--rc', 'var(--text)');
  $('sheet').innerHTML = html + `<div class="actions"><button class="wide" id="aClose">閉じる</button></div>`;
  $('modal').classList.remove('hidden');
  sh.scrollTop = same ? y : 0;
  $('aClose').onclick = closeModal;
}

// 拠点の4つのボタンの小さな説明。目立たせるのは「次の目標」の1つだけにする（全部が呼ぶと何から手を付けるか分からないため）
export function renderHub(){
  checkAch();
  const n = achClaimable().length;
  $('achSub').textContent = n ? `${n}件 受け取れる` : `${ACH.filter(a => SAVE.ach[a.id]).length}/${ACH.length}`;
  $('achBadge').textContent = n ? String(n) : '';
  const up = Object.keys(FACILITIES).some(canUpgradeFac);
  $('facSub').textContent = up ? '強化できる' : `合計Lv ${Object.keys(FACILITIES).reduce((a, k) => a + facLv(k), 0)}`;
  const D = SAVE.daily, today = dateKey();
  $('dailySub').textContent = D.key === today && D.tries ? `今日 ${fmt(D.best)}m${D.clear ? ' ✓' : ''}` : '今日はまだ';
  const g = nextGoal();
  $('goal').innerHTML = `<span class="gic" style="color:${g.c || 'var(--accent)'}">${g.ic}</span>
    <span class="gtx"><small>次の目標</small><b>${g.t}</b><em>${g.d}</em></span><span class="gch">›</span>`;
  $('goal').onclick = g.act;
}

// 次の目標を1つ選ぶ：受け取れる報酬 → 戦力が上がる装備 → 強化できる施設 → 今日の日替わり → 次のボス・難易度 → 近い実績
export function nextGoal(){
  const can = achClaimable().length, cape = nextCape();
  if (can) return {ic:icon('trophy'), t:`実績の報酬を受け取る（${can}件）`,
    d:`ゴールド・素材・称号${cape ? ` ・ あと${Math.max(0, cape.need - achGot())}件でマント「${cape.n}」` : ''}`, act:() => openAchievements()};
  const power = computeStats(SAVE.equip).power;
  let best = null, gain = 0.5;
  for (const it of SAVE.inv){ const d = powerWith(it) - power; if (d > gain){ gain = d; best = it; } }
  if (best) return {ic:itemIcon(best.type), c:RAR[best.r].c, t:`もっと強い装備がある`, d:`${esc(best.name)} ・ 装備すると戦力 +${fmt(gain)}`, act:() => { showTab('tabBag'); openItem(best.id); }};
  const ups = Object.keys(FACILITIES).filter(canUpgradeFac).sort((a, b) => facCost(a).gold - facCost(b).gold);
  if (ups.length){ const id = ups[0], F = FACILITIES[id];
    return {ic:icon(id), t:`${F.n}を Lv${facLv(id) + 1} にできる`, d:facNext(id), act:() => openFacilities(false, id)}; }
  const D = SAVE.daily;
  if (SAVE.runs >= 3 && !(D.key === dateKey() && D.tries)){
    const plan = dailyPlan();
    return {ic:icon('daily'), t:'今日の日替わりダンジョン', d:`${plan.mods.map(m => DAILY_MODS[m].n).join('・')} ・ ボスを倒すとゴールドと素材`, act:() => openDaily()};
  }
  const P = SAVE.prog, md = P.maxDiff;
  if (!P.clears[md]){
    const b = P.best[md] || 0, i = Math.min(3, Math.floor(b / 500)), boss = BOSSES[ZONES[i].boss];
    return {ic:icon('go'), t:`${md > 1 ? `難易度${md}：` : ''}${boss.n}を倒す（${(i + 1)*500}m）`,
      d:`今の最高 ${fmt(b)}m${i ? ` ・ ${i*500}m から出撃もできる` : ''}${i === 3 ? ' ・ 倒すと踏破' : ''}`, act:() => openSortie()};
  }
  // すべての難易度を踏破したら、いちばん近い実績
  const open = ACH.filter(a => !SAVE.ach[a.id]).map(a => [a, Math.min(1, a.v()/a.goal)]).sort((x, y) => y[1] - x[1]);
  if (open.length){ const [a, q] = open[0];
    return {ic:icon('trophy'), t:`実績「${a.n}」`, d:`${a.d} ・ ${Math.round(q*100)}%`, act:() => openAchievements()}; }
  return {ic:icon('go'), t:'すべて達成！', d:'好きなだけ厳選を楽しもう', act:() => openSortie()};
}

// ---------- 施設 ----------
// focus：開いたときにその施設まで送って光らせる
export function openFacilities(keep, focus){
  if (typeof keep !== 'boolean') keep = false;
  const rows = Object.entries(FACILITIES).map(([id, F]) => {
    const l = facLv(id), c = facCost(id), next = facNext(id);
    let now = facEffect(id, l);
    if (id === 'train'){
      const P = trainPerks(), extra = Object.keys(ALL_SKILLS).filter(k => ALL_SKILLS[k].lock && unlocked(k)).length;
      now = `追加スキル ${extra}/12 ・ 引き直し ${P.rerolls}回 ・ 最初のスキル ${P.startPick ? '選べる' : '—'}`;
    }
    const startSel = id === 'train' && trainPerks().startPick ? `<label class="fsel">最初に持って出るスキル
      <select id="startSel"><option value="">選ばない（レベルアップで選ぶ）</option>
      ${Object.entries(ACTIVES).filter(([k]) => unlocked(k)).map(([k, A]) => `<option value="${k}" ${SAVE.skill.start === k ? 'selected' : ''}>${A.n}</option>`).join('')}</select></label>` : '';
    // 訓練所：レベルアップで出すスキルを選ぶ（解放したものだけ。タップで出す／出さない）
    const chips = (defs, label) => {
      const ids = Object.keys(defs).filter(unlocked);
      return `<div class="chips"><small>${label}（タップで出す／出さない）</small><div>${ids.map(k => `<button class="chip ${SAVE.skill.off[k] ? 'off' : ''}" data-skoff="${k}" aria-pressed="${!SAVE.skill.off[k]}" style="--c:${defs[k].c}">${defs[k].n}</button>`).join('')}</div></div>`;
    };
    const pool = id === 'train' && facLv('train') ? chips(ACTIVES, 'レベルアップで出る攻撃スキル') + chips(PASSIVES, '出る強化スキル') : '';
    // 建物の絵：今の姿と、次の段階で変わるならその姿
    const s0 = stageOf(id, l), s1 = c ? stageOf(id, l + 1) : s0;
    const art = `<div class="fart"><figure><canvas data-fart="${id}" data-lv="${l}"></canvas><figcaption>今：${STAGE_N[s0]}</figcaption></figure>
      ${c && s1 !== s0 ? `<span class="farr">→</span><figure class="nextart"><canvas data-fart="${id}" data-lv="${l + 1}"></canvas><figcaption>Lv${l + 1}：${STAGE_N[s1]}</figcaption></figure>` : ''}</div>`;
    return `<div class="fac" id="fac-${id}">
      <div class="fhead"><span class="fic" style="color:${FAC_C[id]}">${icon(id)}</span><b>${F.n}</b><em>Lv ${l}/${F.max}</em></div>
      <small class="fabout">${F.about}</small>
      ${art}
      <div class="fline"><span>今</span>${now || 'なし'}</div>
      ${c ? `<div class="fline next"><span>次</span>${next}</div>` : ''}
      ${startSel}
      ${pool}
      ${c ? `<button class="${canUpgradeFac(id) ? 'primary' : ''} fup" data-fac="${id}" ${canUpgradeFac(id) ? '' : 'disabled'}>Lv${l + 1}に強化<span class="cost">${costHTML(c, SAVE)}</span></button>`
          : `<div class="fmax">最大まで強化した</div>`}
    </div>`;
  }).join('');
  openSheet('fac', `<h3>拠点の施設</h3><div class="sub">ゴールドと素材で強化する。効果はずっと続き、村の建物も育つ。素材は装備の分解で手に入る</div><div class="facs">${rows}</div>`, keep);
  $('sheet').querySelectorAll('canvas[data-fart]').forEach(cv => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = 96*dpr; cv.height = 72*dpr;
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#25343c'; c.fillRect(0, 0, 96, 72);
    c.fillStyle = '#3d5a3a'; c.fillRect(0, 60, 96, 12);
    drawBuilding(c, cv.dataset.fart, Number(cv.dataset.lv), 44, 60, 0.82, 1, false);
  });
  if (focus && $('fac-' + focus)){
    const el = $('fac-' + focus);
    $('sheet').scrollTop = el.offsetTop - 8;
    el.classList.add('focus'); setTimeout(() => el.classList.remove('focus'), 1200);
  }
  $('sheet').querySelectorAll('[data-fac]').forEach(b => b.onclick = () => {
    const id = b.dataset.fac;
    if (!upgradeFac(id)) return;
    const l = facLv(id);
    toast(`${FACILITIES[id].n}が Lv${l} になった${id === 'train' && TRAIN[l] ? `：${TRAIN[l].t}` : ''}`);
    campFx(id);
    renderBase(); openFacilities(true);
  });
  $('sheet').querySelectorAll('[data-skoff]').forEach(b => b.onclick = () => {
    const k = b.dataset.skoff, off = SAVE.skill.off, defs = ACTIVES[k] ? ACTIVES : PASSIVES;
    if (!off[k] && Object.keys(defs).filter(x => unlocked(x) && !off[x]).length <= MIN_ON){ toast(`少なくとも${MIN_ON}種は出す必要がある`); return; }
    if (off[k]) delete off[k]; else off[k] = 1;
    if (off[k] && SAVE.skill.start === k) SAVE.skill.start = '';
    saveGame(); openFacilities(true);
  });
  if ($('startSel')) $('startSel').onchange = e => { SAVE.skill.start = e.target.value; saveGame(); toast(e.target.value ? `「${ACTIVES[e.target.value].n}」を持って出撃する` : '最初のスキルは選ばない'); };
}

// ---------- 実績 ----------
export function openAchievements(keep){
  if (typeof keep !== 'boolean') keep = false;
  checkAch();
  const st = a => SAVE.ach[a.id] || 0;
  const list = [...ACH].sort((a, b) => (st(a) === 1 ? -1 : 0) - (st(b) === 1 ? -1 : 0) || (st(a) === 2) - (st(b) === 2));
  const done = ACH.filter(a => st(a)).length, can = achClaimable().length, cape = nextCape();
  const rows = list.map(a => {
    const v = Math.min(a.goal, a.v()), s = st(a);
    const prog = a.goal > 1 ? `${fmt(v)}/${fmt(a.goal)}` : '';
    return `<div class="ach ${s === 2 ? 'got' : s === 1 ? 'ready' : ''}">
      <span class="aic">${icon('trophy')}</span>
      <div class="atext"><b>${a.n}</b><small>${a.d}</small>
        ${s ? '' : `<div class="meter"><i style="width:${Math.round(v/a.goal*100)}%"></i></div>`}
        <div class="arew">${rewardHTML(a.r)}<span class="ttl">称号〈${a.t}〉</span>${s ? '' : prog ? `<small>${prog}</small>` : ''}</div></div>
      ${s === 1 ? `<button class="primary small" data-ach="${a.id}">受け取る</button>` : s === 2 ? '<span class="adone">済</span>' : ''}
    </div>`;
  }).join('');
  openSheet('ach', `<h3>実績</h3><div class="sub">達成 ${done}/${ACH.length}${can ? ` ・ 受け取れる ${can}件` : ''}<br>報酬を受け取ると、ゴールド・素材と一緒に<b>称号</b>が手に入る。受け取った数で<b>マント</b>も増える${cape ? `（次は「${cape.n}」：あと${Math.max(0, cape.need - achGot())}件）` : ''}</div>
    <div class="btns">${can > 1 ? `<button class="primary" id="achAll">まとめて受け取る（${can}件）</button>` : ''}<button id="achLook">見た目を変える（称号・マント）</button></div>
    <div class="achs">${rows}</div>`, keep);
  const after = msg => { toast(msg); renderBase(); openAchievements(true); };
  $('sheet').querySelectorAll('[data-ach]').forEach(b => b.onclick = () => {
    const a = ACH.find(x => x.id === b.dataset.ach), capes = achGot();
    if (claimAch(a.id)) after(`「${a.n}」の報酬：${rewardText(a.r)}・称号〈${a.t}〉${newCapeText(capes)}`);
  });
  if ($('achAll')) $('achAll').onclick = () => {
    let g = 0; const m = [0, 0, 0, 0, 0], capes = achGot();
    for (const a of achClaimable()) if (claimAch(a.id)){ g += a.r.g || 0; if (a.r.m) m[a.r.m[0]] += a.r.m[1]; }
    after(`${fmt(g)}G${m.map((n, i) => n ? `＋${MATS[i]}×${n}` : '').join('')} を受け取った${newCapeText(capes)}`);
  };
  $('achLook').onclick = openLook;
}
// 受け取る前の数と比べて、新しいマントが増えたか
const newCapeText = before => { const c = CAPES.filter(x => x.need > before && x.need <= achGot()); return c.length ? `・マント「${c.map(x => x.n).join('」「')}」` : ''; };

// ---------- 見た目（称号・マント） ----------
export function openLook(){
  const titles = ACH.filter(a => SAVE.ach[a.id] === 2);
  const capes = CAPES.map((c, i) => {
    const open = capeOpen(i), on = SAVE.look.cape === i;
    return `<button class="cape ${on ? 'on' : ''}" data-cape="${i}" ${open ? '' : 'disabled'} aria-pressed="${on}" style="--cc:${c.c}"><i></i>${open ? c.n : `実績${c.need}件`}</button>`;
  }).join('');
  openSheet('look', `<h3>見た目</h3><div class="sub">拠点の村と冒険中の主人公に出る。兜・鎧・装飾は装備のレア度で見た目が変わる</div>
    <canvas id="lookCv" class="lookcv"></canvas>
    <h4 class="rech">マント（受け取った実績の数で増える）</h4>
    <div class="capes"><button class="cape ${SAVE.look.cape < 0 ? 'on' : ''}" data-cape="-1" aria-pressed="${SAVE.look.cape < 0}" style="--cc:transparent"><i></i>なし</button>${capes}</div>
    <h4 class="rech">称号（受け取った実績から選ぶ）</h4>
    ${titles.length ? `<div class="titles"><button class="chip ${SAVE.look.title ? '' : 'on'}" data-title="" style="--c:var(--muted)">なし</button>${titles.map(a => `<button class="chip ${SAVE.look.title === a.id ? 'on' : ''}" data-title="${a.id}" style="--c:var(--accent)">${a.t}</button>`).join('')}</div>`
      : '<p class="note">実績の報酬を受け取ると称号が手に入る。</p>'}`, true);
  const cv = $('lookCv'), dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = 160*dpr; cv.height = 90*dpr;
  const c = cv.getContext('2d'); c.setTransform(dpr*1.6, 0, 0, dpr*1.6, 0, 0);
  c.fillStyle = '#25343c'; c.fillRect(0, 0, 100, 57); c.fillStyle = '#3d5a3a'; c.fillRect(0, 50, 100, 7);
  drawStandingHero(c, 50, 51, 0.6);
  $('sheet').querySelectorAll('[data-cape]').forEach(b => b.onclick = () => { SAVE.look.cape = Number(b.dataset.cape); saveGame(); renderBase(); openLook(); });
  $('sheet').querySelectorAll('[data-title]').forEach(b => b.onclick = () => { SAVE.look.title = b.dataset.title; saveGame(); renderBase(); openLook(); });
}

// ---------- 記録 ----------
const hms = sec => { const h = Math.floor(sec/3600), m = Math.floor(sec % 3600 / 60); return h ? `${h}時間${m}分` : `${m}分`; };
export function openRecords(){
  const S = SAVE.stats, P = SAVE.prog;
  const diffs = Array.from({length:P.maxDiff}, (_, i) => i + 1);
  const rows = [
    ['冒険', [
      ['出撃', `${fmt(SAVE.runs)}回`], ['冒険した時間', hms(S.time)], ['走った距離', `${(S.dist/1000).toFixed(1)}km`],
      ['力尽きた', `${fmt(S.deaths)}回`], ['撤退', `${fmt(S.retreats)}回`],
      ...diffs.map(d => [`難易度${d}`, `最高 ${fmt(P.best[d] || 0)}m${P.clears[d] ? ` ・ 踏破${P.clears[d]}回` : ''}`]),
    ]],
    ['戦い', [
      ['倒した敵', fmt(S.kills)], ['1回の最多', `${fmt(S.maxKills)}体`], ['エリート', `${fmt(S.elites)}体`],
      ['ボス', `${fmt(S.bosses)}体（${Object.keys(S.bossKinds).map(k => BOSSES[k] ? BOSSES[k].n : k).join('・') || '—'}）`],
      ['ノーダメージでボス', `${fmt(S.flawless)}回`], ['踏みつけ', `${fmt(S.stomps)}回`], ['ジャンプ', `${fmt(S.jumps)}回`],
    ]],
    ['スキル', [
      ['最高レベル', `Lv${S.maxLv}`], ['進化', `${fmt(S.evos)}回・${Object.keys(SAVE.skill.evo).length}/12種類`],
      ['選んだことのあるスキル', `${Object.keys(SAVE.skill.seen).length}/${Object.keys(ALL_SKILLS).length}`],
    ]],
    ['装備', [
      ['拾った装備', `${fmt(S.items)}個`], ['レジェンド', `${Object.keys(SAVE.codex.u).length}/${UNIQUES.length}種類`],
      ['鍛冶', `${fmt(S.smith)}回`], ['最高の強化', `+${S.upMax}`], ['稼いだゴールド', `${fmt(S.gold)}G`],
    ]],
    ['拠点・日替わり', [
      ['施設の強化', `${fmt(S.facUps)}回`], ['実績', `${ACH.filter(a => SAVE.ach[a.id]).length}/${ACH.length}`],
      ['日替わりに挑んだ日', `${fmt(S.dailies)}日（連続${dailyStreak()}日）`], ['日替わりの踏破', `${fmt(S.dailyClears)}回`],
    ]],
  ];
  openSheet('rec', `<h3>記録</h3><div class="sub">撃破数・時間などは版 1.6.0 から数えています</div>
    ${rows.map(([h, list]) => `<h4 class="rech">${h}</h4><table class="rec">${list.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`).join('')}`);
}

// ---------- 日替わりダンジョン ----------
export function openDaily(){
  const key = dateKey(), plan = dailyPlan(key), D = dailyToday(key);
  const hist = Object.entries(SAVE.daily.hist).filter(([k]) => k !== key).sort((a, b) => b[0] < a[0] ? -1 : 1).slice(0, 6);
  const miles = Object.entries(DAILY_REWARD).map(([at, r]) => {
    const got = D.got.includes(Number(at));
    return `<span class="${got ? 'on' : ''}">${at}m${got ? ' ✓' : ''}<small>${rewardText({g:r.g*plan.diff, m:r.m})}</small></span>`;
  }).join('');
  dialog(`<h2>日替わりダンジョン</h2>
    <p class="sksum">${key} ・ 難易度${plan.diff}<br>
      エリアの順：${plan.zones.map(z => ZONES[z].n).join(' → ')}<br>
      今日の条件：${plan.mods.map(m => `<b style="color:${DAILY_MODS[m].good ? '#5fd17a' : '#ff9a7a'}">${DAILY_MODS[m].n}</b>（${DAILY_MODS[m].d}）`).join('・')}</p>
    <p class="sksum">今日の最高 <b>${fmt(D.best)}m</b>${D.clear ? '（踏破 ✓）' : ''} ・ 挑戦 ${D.tries}回 ・ 連続 ${dailyStreak(key)}日</p>
    <div class="dmiles">${miles}</div>
    <p class="dnote">同じ日なら何度でも同じコース（敵の並び・仕掛け）。ボスを倒すと節目の報酬（1日1回ずつ）。装備も拾える。チェックポイントと難易度の解放には数えない。</p>
    ${hist.length ? `<div class="dhist">${hist.map(([k, h]) => `<div><span>${k.slice(5)}</span><span>${fmt(h.best)}m${h.clear ? ' ✓' : ''}</span><small>${(h.mods || []).map(m => DAILY_MODS[m] ? DAILY_MODS[m].n : '').join('・')}</small></div>`).join('')}</div>` : ''}
    <div class="btns"><button class="primary" id="dDaily">挑戦する</button><button id="dNo">やめる</button></div>`);
  $('dDaily').onclick = () => startRun({daily:true, key});
  $('dNo').onclick = closeDialog;
}

$('facBtn').onclick = () => openFacilities();
$('achBtn').onclick = () => openAchievements();
$('recBtn').onclick = openRecords;
$('dailyBtn').onclick = openDaily;
