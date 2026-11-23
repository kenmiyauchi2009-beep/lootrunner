// やり込み要素（画面）：施設・実績・記録・日替わりダンジョン
import { $, fmt } from './util.js';
import { MATS, ZONES, UNIQUES, BOSSES } from './data.js';
import { SAVE, saveGame } from './save.js';
import { closeModal, dialog, closeDialog, toast } from './ui.js';
import { FACILITIES, TRAIN, facLv, facCost, facEffect, facNext, upgradeFac, canUpgradeFac, trainPerks,
  ACH, claimAch, achClaimable, checkAch, rewardText, dailyPlan, dailyToday, dailyStreak, dateKey, DAILY_MODS, DAILY_REWARD } from './meta.js';
import { ACTIVES, PASSIVES, ALL_SKILLS, unlocked, MIN_ON } from './skills.js';
import { startRun } from './run.js';
import { renderBase } from './base.js';

const costText = c => `${fmt(c.gold)}G＋${MATS[c.mat.r]}×${c.mat.n}`;
const have = c => `所持 ${fmt(SAVE.gold)}G・${MATS[c.mat.r]} ${fmt(SAVE.mats[c.mat.r])}`;
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

// 拠点の4つのボタンの小さな説明（受け取れる実績・強化できる施設があれば目立たせる）
export function renderHub(){
  checkAch();
  const n = achClaimable().length;
  $('achSub').textContent = n ? `${n}件 受け取れる` : `${ACH.filter(a => SAVE.ach[a.id]).length}/${ACH.length}`;
  $('achBtn').classList.toggle('ping', n > 0);
  const up = Object.keys(FACILITIES).some(canUpgradeFac);
  $('facSub').textContent = up ? '強化できる' : `合計Lv ${Object.keys(FACILITIES).reduce((a, k) => a + facLv(k), 0)}`;
  $('facBtn').classList.toggle('ping', up);
  const D = SAVE.daily, today = dateKey();
  $('dailySub').textContent = D.key === today && D.tries ? `今日 ${fmt(D.best)}m${D.clear ? ' ✓' : ''}` : '今日はまだ';
  $('dailyBtn').classList.toggle('ping', !(D.key === today && D.tries));
}

// ---------- 施設 ----------
export function openFacilities(keep){
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
    return `<div class="fac">
      <div class="fhead"><span class="fic">${F.ic}</span><b>${F.n}</b><em>Lv ${l}/${F.max}</em></div>
      <small class="fabout">${F.about}</small>
      <div class="fline"><span>今</span>${now || 'なし'}</div>
      ${c ? `<div class="fline next"><span>次</span>${next}</div>` : ''}
      ${startSel}
      ${pool}
      ${c ? `<button class="${canUpgradeFac(id) ? 'primary' : ''}" data-fac="${id}" ${canUpgradeFac(id) ? '' : 'disabled'}>Lv${l + 1}に強化<small>${costText(c)}（${have(c)}）</small></button>`
          : `<div class="fmax">最大まで強化した</div>`}
    </div>`;
  }).join('');
  openSheet('fac', `<h3>拠点の施設</h3><div class="sub">ゴールドと素材で強化する。効果はずっと続く</div><div class="facs">${rows}</div>`, keep);
  $('sheet').querySelectorAll('[data-fac]').forEach(b => b.onclick = () => {
    const id = b.dataset.fac;
    if (!upgradeFac(id)) return;
    const l = facLv(id);
    toast(`${FACILITIES[id].n}が Lv${l} になった${id === 'train' && TRAIN[l] ? `：${TRAIN[l].t}` : ''}`);
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
  checkAch();
  const st = a => SAVE.ach[a.id] || 0;
  const list = [...ACH].sort((a, b) => (st(a) === 1 ? -1 : 0) - (st(b) === 1 ? -1 : 0) || (st(a) === 2) - (st(b) === 2));
  const done = ACH.filter(a => st(a)).length, can = achClaimable().length;
  const rows = list.map(a => {
    const v = Math.min(a.goal, a.v()), s = st(a);
    const prog = a.goal > 1 ? `${fmt(v)}/${fmt(a.goal)}` : '';
    return `<div class="ach ${s === 2 ? 'got' : s === 1 ? 'ready' : ''}">
      <div class="atext"><b>${a.n}</b><small>${a.d}</small>
        ${s ? '' : `<div class="meter"><i style="width:${Math.round(v/a.goal*100)}%"></i></div>`}
        <small class="arew">報酬：${rewardText(a.r)}${s ? '' : prog ? ` ・ ${prog}` : ''}</small></div>
      ${s === 1 ? `<button class="primary small" data-ach="${a.id}">受け取る</button>` : s === 2 ? '<span class="adone">済</span>' : ''}
    </div>`;
  }).join('');
  openSheet('ach', `<h3>実績</h3><div class="sub">達成 ${done}/${ACH.length}${can ? ` ・ 受け取れる ${can}件` : ''}</div>
    ${can > 1 ? `<div class="btns"><button class="primary" id="achAll">まとめて受け取る（${can}件）</button></div>` : ''}
    <div class="achs">${rows}</div>`, keep);
  const after = msg => { toast(msg); renderBase(); openAchievements(true); };
  $('sheet').querySelectorAll('[data-ach]').forEach(b => b.onclick = () => {
    const a = ACH.find(x => x.id === b.dataset.ach);
    if (claimAch(a.id)) after(`「${a.n}」の報酬：${rewardText(a.r)}`);
  });
  if ($('achAll')) $('achAll').onclick = () => {
    let g = 0; const m = [0, 0, 0, 0, 0];
    for (const a of achClaimable()) if (claimAch(a.id)){ g += a.r.g || 0; if (a.r.m) m[a.r.m[0]] += a.r.m[1]; }
    after(`${fmt(g)}G${m.map((n, i) => n ? `＋${MATS[i]}×${n}` : '').join('')} を受け取った`);
  };
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

$('facBtn').onclick = openFacilities;
$('achBtn').onclick = openAchievements;
$('recBtn').onclick = openRecords;
$('dailyBtn').onclick = openDaily;
