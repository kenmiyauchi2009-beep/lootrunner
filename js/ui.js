// 共通UI（シート・ダイアログ・トースト）
import { $ } from './util.js';
export function closeModal(){ $('modal').classList.add('hidden'); }
$('modal').addEventListener('click', e => { if (e.target.id==='modal') closeModal(); });

export function dialog(html){ $('dcard').innerHTML = html; $('dialog').classList.remove('hidden'); }
export function closeDialog(){ $('dialog').classList.add('hidden'); }
export let toastT = 0;
export function toast(msg){ const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1600); }
