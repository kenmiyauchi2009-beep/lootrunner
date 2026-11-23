// service worker の登録とオフライン状態
import { toast } from './ui.js';

let ready = false;   // 新しい版を受け取り済み（再読み込みで切り替わる）
const supported = () => 'serviceWorker' in navigator && window.isSecureContext;

export const updateReady = () => ready;

export function setupOffline(){
  if (!supported()) return;
  let controlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const first = !controlled;    // 初回のインストールでは知らせない
    controlled = true;
    if (first) return;
    ready = true;
    toast('新しい版を受け取りました。次に起動したときに切り替わります');
  });
  navigator.serviceWorker.register('sw.js', {updateViaCache:'none'}).then(reg => {
    // ホーム画面のアプリは開きっぱなしになりやすいので、前面に戻ったときも更新を確認する
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(() => {});
}

export async function offlineStatus(){
  if (!('serviceWorker' in navigator)) return '未対応のブラウザです。';
  if (!window.isSecureContext) return '未対応：https（GitHub Pages など）か localhost で開いたときだけ有効になります。';
  let ver = '';
  try { ver = (await caches.keys()).find(k => k.startsWith('lootrunner-')) || ''; } catch(e){}
  if (navigator.serviceWorker.controller && ver) return `有効（${ver.replace('lootrunner-', '版 ')}）。機内モードでも起動できます。`;
  return '準備中：一度アプリを閉じて開き直すと有効になります。';
}
