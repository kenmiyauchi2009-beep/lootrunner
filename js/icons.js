// 小さな絵のアイコン（SVG をコードで持つ。画像ファイルは使わない）
// 色は currentColor（呼ぶ側の color）。装備はレア度の色、素材はその素材の色で塗る。
import { RAR, MATS } from './data.js';
const svg = (body, cls = '') => `<svg class="svgi ${cls}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const S = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor"';
const WOOD = 'fill="#8a6440"';

const BODY = {
  // 武器
  sword: `<path ${S} d="M5 19 L17 7 L19 4 L16 5 L4 17"/><path ${S} d="M7 14 l3 3"/><path ${S} d="M4.5 19.5 l1-1"/>`,
  axe:   `<path stroke="#8a6440" stroke-width="2.2" stroke-linecap="round" d="M6 20 L16 6"/><path ${F} d="M13 3.5 c4 0 7 3 7 7 l-3.5-.5 -4.5-3.2 z"/>`,
  dagger:`<path ${S} d="M7 17 L15.5 8.5 L18 6 L17 9 L9 17"/><path ${S} d="M6.5 13.5 l4 4"/><circle ${F} cx="5.5" cy="18.5" r="1.4"/>`,
  bow:   `<path ${S} d="M7 3 C17 6 17 18 7 21"/><path stroke="currentColor" stroke-width="1" opacity=".7" d="M7 3 V21"/><path ${S} d="M4 12 H17 M15 10 l2 2 -2 2"/>`,
  staff: `<path stroke="#8a6440" stroke-width="2.2" stroke-linecap="round" d="M8 21 L14 9"/><circle ${F} cx="15.5" cy="6.5" r="3.6"/><circle fill="#fff" opacity=".7" cx="14.4" cy="5.4" r="1.1"/>`,
  // 防具・装飾
  head:  `<path ${F} d="M4 15 C4 8 8 4.5 12 4.5 S20 8 20 15 Z"/><rect ${F} x="3" y="14.5" width="18" height="3" rx="1.2"/><path fill="#0006" d="M8 11 h8 v2 h-8z"/>`,
  body:  `<path ${F} d="M7 4 L10 6 H14 L17 4 L21 8 L18 11 V20 H6 V11 L3 8 Z"/><path fill="#0004" d="M11.2 6 h1.6 v14 h-1.6z"/>`,
  charm: `<path ${S} d="M7 3 L12 11 L17 3"/><path ${F} d="M12 9 L16.5 13.5 L12 21 L7.5 13.5 Z"/><path fill="#fff" opacity=".55" d="M12 10.5 L14 13.5 L12 15 Z"/>`,
  // 施設
  train: `<circle ${S} cx="12" cy="12" r="8"/><circle ${S} cx="12" cy="12" r="4.5"/><circle ${F} cx="12" cy="12" r="1.6"/><path ${S} d="M20 4 L13 11"/>`,
  smith: `<path ${F} d="M4 9 H17 C17 11 19 12 21 12 V13 H15 L14 16 H17 V19 H7 V16 H10 L9 13 C6 13 4 11 4 9 Z"/><path ${S} d="M14 2.5 L9 7.5"/>`,
  store: `<rect ${F} x="3.5" y="8" width="17" height="12" rx="1.2"/><path fill="#0005" d="M3.5 12 h17 v1.4 h-17z"/><path ${F} d="M2 8.5 L12 3 L22 8.5 Z"/><rect fill="#0005" x="10" y="14.5" width="4" height="5.5"/>`,
  dojo:  `<path ${F} d="M2 9 L12 3 L22 9 H19 V19 H5 V9 Z"/><rect fill="#0005" x="9.5" y="12" width="5" height="7"/><path stroke="#c8403c" stroke-width="2" d="M5 10.5 H19"/>`,
  vault: `<ellipse ${F} cx="12" cy="17" rx="8" ry="3.2"/><ellipse ${F} cx="12" cy="13" rx="8" ry="3.2" opacity=".85"/><ellipse ${F} cx="12" cy="9" rx="8" ry="3.2"/><ellipse fill="#0003" cx="12" cy="9" rx="4.5" ry="1.6"/>`,
  // 拠点のボタン
  daily: `<rect ${S} x="3.5" y="5" width="17" height="15" rx="2"/><path ${S} d="M3.5 10 H20.5 M8 3 V7 M16 3 V7"/><path ${F} d="M12 12 l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z"/>`,
  trophy:`<path ${F} d="M7 3.5 H17 V9 A5 5 0 0 1 7 9 Z"/><path ${S} d="M7 5.5 H4 C4 9 5.5 10.5 7.5 11 M17 5.5 H20 C20 9 18.5 10.5 16.5 11"/><path ${F} d="M10.5 13 H13.5 V17 H16 V20.5 H8 V17 H10.5 Z"/>`,
  book:  `<path ${F} d="M4 4.5 C7 3.5 10 4 12 5.5 V20 C10 18.5 7 18 4 19 Z" opacity=".85"/><path ${F} d="M20 4.5 C17 3.5 14 4 12 5.5 V20 C14 18.5 17 18 20 19 Z"/>`,
  go:    `<path ${F} d="M7 4 L20 12 L7 20 Z"/>`,
  flag:  `<path ${S} d="M5 21 V3"/><path ${F} d="M6 3.5 H19 L16 8 L19 12.5 H6 Z"/>`,
  gear:  `<circle ${S} cx="12" cy="12" r="3.2"/><path ${S} d="M12 2.8 V5.5 M12 18.5 V21.2 M2.8 12 H5.5 M18.5 12 H21.2 M5.5 5.5 L7.4 7.4 M16.6 16.6 L18.5 18.5 M5.5 18.5 L7.4 16.6 M16.6 7.4 L18.5 5.5"/>`,
  bag:   `<path ${F} d="M5 9 H19 L18 20 H6 Z"/><path ${S} d="M9 9 V7 A3 3 0 0 1 15 7 V9"/>`,
  home:  `<path ${F} d="M3 11 L12 3.5 L21 11 H18.5 V20 H5.5 V11 Z"/><rect fill="#0005" x="10" y="13.5" width="4" height="6.5"/>`,
};
// 素材（宝石）：形でも区別できるように、レア度ごとに形を変える
const MAT_BODY = [
  `<path ${F} d="M6 15 L10 7 L16 9 L18 16 L11 19 Z"/><path fill="#fff" opacity=".35" d="M10 7 L16 9 L12 12 Z"/>`,                                    // 欠片
  `<path ${F} d="M12 2.5 L16.5 9 L12 21.5 L7.5 9 Z"/><path fill="#fff" opacity=".4" d="M12 2.5 L12 21.5 L7.5 9 Z"/>`,                              // 結晶
  `<path ${F} d="M7 4 H17 L21 9 L12 21 L3 9 Z"/><path fill="#fff" opacity=".4" d="M7 4 L9.5 9 H3 Z M12 21 L9.5 9 H14.5 Z"/>`,                         // 宝玉
  `<circle ${F} cx="12" cy="12" r="8.5"/><path fill="#fff" opacity=".45" d="M7.5 9 A5.5 5.5 0 0 1 13 5.5 A4 4 0 0 0 7.5 9 Z"/><circle fill="#0003" cx="13.5" cy="13.5" r="3.5"/>`, // 秘石
  `<path ${F} d="M12 2 L14.4 9.2 L22 9.4 L16 14 L18.2 21.5 L12 17 L5.8 21.5 L8 14 L2 9.4 L9.6 9.2 Z"/><circle fill="#fff" opacity=".6" cx="12" cy="12" r="2.2"/>`, // 星核
];

export const icon = (k, cls) => svg(BODY[k] || BODY.charm, cls);
export const matIcon = (r, cls) => svg(MAT_BODY[r] || MAT_BODY[0], cls);
// 装備の種類（sword / head / …）→ アイコン
export const itemIcon = type => icon(type);

// 素材の札（絵＋名前＋数）。have を渡すと、足りないときに赤くする
export const matChip = (r, n, have) => `<span class="mchip${have !== undefined && have < n ? ' short' : ''}" style="--mc:${RAR[r].c}">${matIcon(r)}${MATS[r]}×${n}</span>`;
export const goldChip = (g, have) => `<span class="gchip${have !== undefined && have < g ? ' short' : ''}">${Math.round(g).toLocaleString('ja-JP')}G</span>`;
// 費用 {gold, mat:{r, n}}（所持と比べて足りない方を赤く）
export const costHTML = (c, S) => goldChip(c.gold, S && S.gold) + (c.mat ? matChip(c.mat.r, c.mat.n, S && S.mats[c.mat.r]) : '');
// 報酬 {g, m:[r, n]}
export const rewardHTML = r => (r.g ? goldChip(r.g) : '') + (r.m ? matChip(r.m[0], r.m[1]) : '');
