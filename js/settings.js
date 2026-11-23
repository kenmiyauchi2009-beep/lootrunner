// 設定シート（セーブの書き出し・読み込み・初期化、オフライン状態の表示）
import { $, fmt } from './util.js';
import { computeStats } from './items.js';
import { SAVE, SAVE_VERSION, lastSavedAt, saveGame, exportText, parseImport, applySave, resetSave } from './save.js';
import { renderBase } from './base.js';
import { closeModal, dialog, closeDialog, toast } from './ui.js';
import { offlineStatus, updateReady } from './offline.js';
import { isMuted, setMuted } from './audio.js';
import { toggleMute } from './run.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]));

function summary(d){
  const items = d.inv.length + Object.values(d.equip).filter(Boolean).length;
  return `ゴールド ${fmt(d.gold)}G ・ 最高 ${fmt(d.best)}m ・ 出撃 ${fmt(d.runs)}回 ・ 装備 ${items}個 ・ 戦力 ${fmt(computeStats(d.equip).power)}`;
}
function timeText(t){
  if (!t) return 'まだ';
  const d = new Date(t);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

async function copyText(text, ta){
  try { await navigator.clipboard.writeText(text); return true; } catch(e){}
  // http（同じWi-Fi内での確認時など）では clipboard API が使えないので選択してコピー
  try {
    ta.focus(); ta.select(); ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.blur();
    return ok;
  } catch(e){ return false; }
}

export function openSettings(){
  saveGame();
  const sheet = $('sheet');
  sheet.style.setProperty('--rc', 'var(--text)');
  sheet.innerHTML = `
    <h3>設定</h3>
    <div class="sub">セーブ形式 v${SAVE_VERSION} ・ 最終保存 ${timeText(lastSavedAt)}</div>

    <section class="sect">
      <h4>効果音</h4>
      <p class="note">iPhone のマナーモード中は鳴りません。</p>
      <button class="wide-btn" id="sMute" aria-pressed="${isMuted()}">${isMuted() ? '効果音：OFF（タップで ON）' : '効果音：ON（タップで OFF）'}</button>
    </section>

    <section class="sect">
      <h4>オフライン</h4>
      <p class="note" id="sOffline">確認中…</p>
      ${updateReady() ? '<button class="wide-btn" id="sReload">新しい版にする（再読み込み）</button>' : ''}
    </section>

    <section class="sect">
      <h4>セーブを書き出す</h4>
      <p class="note">機種変更やデータ消失に備えて、このテキストをメモなどに保存しておけます。</p>
      <textarea id="sExport" rows="3" readonly spellcheck="false" aria-label="書き出したセーブ">${esc(exportText())}</textarea>
      <button class="primary wide-btn" id="sCopy">テキストをコピー</button>
    </section>

    <section class="sect">
      <h4>セーブを読み込む</h4>
      <p class="note">書き出したテキストを貼り付けて読み込みます。今のデータは上書きされます。</p>
      <label class="note" for="sImport">貼り付け欄</label>
      <textarea id="sImport" rows="3" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="LOOTRUNNER1:…"></textarea>
      <div class="err" id="sImportErr" role="alert"></div>
      <button class="wide-btn" id="sImportBtn">貼り付けたセーブを読み込む</button>
    </section>

    <section class="sect">
      <h4>データを初期化</h4>
      <p class="note">装備・ゴールド・最高距離がすべて消えます。先に書き出しておけば、読み込みで戻せます。</p>
      <button class="danger wide-btn" id="sReset">データを初期化する</button>
    </section>

    <div class="actions"><button class="wide" id="sClose">閉じる</button></div>`;
  $('modal').classList.remove('hidden');

  $('sMute').onclick = () => {
    toggleMute();
    $('sMute').textContent = isMuted() ? '効果音：OFF（タップで ON）' : '効果音：ON（タップで OFF）';
    $('sMute').setAttribute('aria-pressed', String(isMuted()));
  };
  offlineStatus().then(t => { const el = $('sOffline'); if (el) el.textContent = t; });
  if ($('sReload')) $('sReload').onclick = () => { saveGame(); location.reload(); };

  $('sCopy').onclick = async () => {
    const ta = $('sExport');
    ta.value = exportText();
    toast(await copyText(ta.value, ta) ? 'コピーしました。メモなどに貼り付けて保存してください' : 'コピーできませんでした。欄を長押しして全選択→コピーしてください');
  };

  const imp = $('sImport'), err = $('sImportErr');
  imp.oninput = () => { err.textContent = ''; };
  $('sImportBtn').onclick = () => {
    let data;
    try { data = parseImport(imp.value); }
    catch(e){ err.textContent = e.message; return; }
    dialog(`<h2>セーブを読み込む</h2>
      <p style="font-size:13px;text-align:left">読み込むデータ：<br>${summary(data)}</p>
      <p style="font-size:13px;text-align:left;color:var(--muted)">今のデータ（${summary(SAVE)}）は上書きされます。</p>
      <div class="btns"><button class="primary" id="dOk">読み込む</button><button id="dNo">やめる</button></div>`);
    $('dOk').onclick = () => {
      const ok = applySave(data);
      setMuted(!!SAVE.settings.mute);
      closeDialog(); closeModal(); renderBase();
      toast(ok ? 'セーブを読み込みました' : '読み込みましたが、保存に失敗しました');
    };
    $('dNo').onclick = closeDialog;
  };

  $('sReset').onclick = () => {
    dialog(`<h2>データを初期化</h2>
      <p style="font-size:13px;text-align:left">${summary(SAVE)}</p>
      <p style="font-size:13px;text-align:left;color:var(--bad)">すべて消えて、最初の剣1本からやり直しになります。元に戻せません。</p>
      <div class="btns"><button class="danger" id="dOk">初期化する</button><button id="dNo">やめる</button></div>`);
    $('dOk').onclick = () => { resetSave(); setMuted(false); closeDialog(); closeModal(); renderBase(); toast('データを初期化しました'); };
    $('dNo').onclick = closeDialog;
  };

  $('sClose').onclick = closeModal;
}
