// スキルの絵（24×24 の図形）。冒険中のスキル欄（canvas）とレベルアップのカード（SVG）で同じ絵を使う。
// 部品：{f:パス} 塗り（穴は evenodd）／{s:パス, w:線の太さ} 線
const C = (x, y, r) => `M${x - r} ${y} a${r} ${r} 0 1 0 ${r*2} 0 a${r} ${r} 0 1 0 ${-r*2} 0`;
const SHIELD = 'M12 2 L20 5 V11 C20 16 16.5 20 12 22 C7.5 20 4 16 4 11 V5Z';
export const SKILL_ART = {
  // 攻撃スキル
  blade:  [{f:'M12 1.5 L14.2 9.8 L22.5 12 L14.2 14.2 L12 22.5 L9.8 14.2 L1.5 12 L9.8 9.8Z ' + C(12, 12, 2.4)}],
  bolt:   [{f:'M14 1.5 L4.5 13.5 H11 L9 22.5 L19.5 9.5 H13Z'}],
  fire:   [{f:'M12 1.5 C16 6 18.5 9 18.5 13.5 A6.5 6.5 0 0 1 5.5 13.5 C5.5 10 7.5 8.5 9 5.5 C10 8 11 9 11.5 10.5 C13 8 13 5 12 1.5Z'}, {f:C(12, 15.5, 2.6), o:0.45}],
  quake:  [{s:'M2 20 H22', w:2.4}, {s:'M5.5 16.5 C8 12.5 16 12.5 18.5 16.5', w:2.2}, {s:'M2.5 14 C5.5 6 18.5 6 21.5 14', w:2.2}, {f:C(12, 17.5, 1.8)}],
  missile:[{f:C(16, 8, 5)}, {s:'M2.5 21.5 L10.5 13.5 M2.5 15.5 L8.5 12 M8.5 21.5 L12 15.5', w:2}],
  frost:  [{s:'M12 2V22 M3.3 7L20.7 17 M3.3 17L20.7 7 M9 3.5L12 6.2L15 3.5 M9 20.5L12 17.8L15 20.5', w:2}],
  barrier:[{f:SHIELD}, {f:'M12 5 L17 7 V11 C17 14 15 16.5 12 18Z', o:0.4}],
  boomer: [{f:'M3 6.5 C8.5 2.5 15 4 21 9.5 L18 12.5 C14.5 9.5 10 8.5 7.8 9.3 L10.5 20.5 L6.2 21.5Z'}],
  aura:   [{s:C(12, 12, 9), w:2}, {s:C(12, 12, 5.2), w:1.6, o:0.7}, {f:'M12 8 L13.2 10.8 L16 12 L13.2 13.2 L12 16 L10.8 13.2 L8 12 L10.8 10.8Z'}],
  mine:   [{f:C(11, 14.5, 7)}, {s:'M15.5 8.5 L18.5 4.5', w:2.2}, {f:'M19.5 1.5 L20.6 3.5 L22.6 4.5 L20.6 5.5 L19.5 7.5 L18.4 5.5 L16.4 4.5 L18.4 3.5Z'}],
  lance:  [{f:'M6 9.5 H23 V14.5 H6Z', o:0.55}, {f:'M6 11 H23 V13 H6Z'}, {f:C(5, 12, 4)}],
  time:   [{f:'M5.5 2 H18.5 V4 C18.5 8 13.8 10 13.8 12 C13.8 14 18.5 16 18.5 20 V22 H5.5 V20 C5.5 16 10.2 14 10.2 12 C10.2 10 5.5 8 5.5 4Z M8 4.5 C8 7 11 8.8 12 10 C13 8.8 16 7 16 4.5Z'}],
  // 強化スキル
  might:  [{f:'M12 1.5 L20.5 11 H15 V22.5 H9 V11 H3.5Z'}],
  haste:  [{s:'M3.5 4.5 L11 12 L3.5 19.5 M12 4.5 L19.5 12 L12 19.5', w:2.8}],
  area:   [{s:'M3 9V3H9 M15 3H21V9 M21 15V21H15 M9 21H3V15', w:2.4}, {f:C(12, 12, 2.6)}],
  vigor:  [{f:'M12 21.5 C5 15.5 1.8 12.2 1.8 8 A5 5 0 0 1 12 5.8 A5 5 0 0 1 22.2 8 C22.2 12.2 19 15.5 12 21.5Z'}],
  multi:  [{f:C(5.5, 15, 3.2)}, {f:C(12, 9, 3.2)}, {f:C(18.5, 15, 3.2)}],
  spring: [{s:'M5 21 H19 M6.5 18 C17.5 18 17.5 15 6.5 15 C17.5 15 17.5 12 6.5 12 C17.5 12 17.5 9 6.5 9 M12 9 V3 M9 5.5 L12 2.5 L15 5.5', w:1.9}],
  guard:  [{s:SHIELD, w:2}, {s:'M8 12 L11 15 L16.5 9', w:2.4}],
  edge:   [{f:'M3.5 20.5 L17.5 3 H21 V6.5 L5.5 22Z'}, {f:'M3 17.5 L6.5 21 L4.5 23 L1 19.5Z', o:0.6}],
  magnet: [{s:'M6 3 V12 A6 6 0 0 0 18 12 V3', w:4}, {f:'M4 2 H8 V5.5 H4Z M16 2 H20 V5.5 H16Z', o:0.55}],
  blast:  [{f:'M12 1 L14 8 L21 5 L16.5 11 L23 14 L15.5 15.2 L17 22.5 L12 17.5 L7 22.5 L8.5 15.2 L1 14 L7.5 11 L3 5 L10 8Z'}],
  focus:  [{s:C(12, 12, 7), w:2}, {s:'M12 1.5V7 M12 17V22.5 M1.5 12H7 M17 12H22.5', w:2}, {f:C(12, 12, 1.8)}],
  luck:   [{f:C(8.5, 8.5, 3.9) + ' ' + C(15.5, 8.5, 3.9) + ' ' + C(8.5, 15.2, 3.9) + ' ' + C(15.5, 15.2, 3.9)}, {s:'M14 18 C15 20 16.5 21.5 18.5 22', w:1.8}],
  // カードだけ
  heal:   [{f:'M9 3 H15 V9 H21 V15 H15 V21 H9 V15 H3 V9 H9Z'}],
  gold:   [{f:C(12, 12, 9)}, {f:C(12, 12, 6), o:0.35}, {f:'M10.5 7.5 H13.5 V16.5 H10.5Z', o:0.6}],
};

// SVG（カード・図鑑用）
export function skillSvg(id){
  const parts = SKILL_ART[id] || [];
  return `<svg class="svgi" viewBox="0 0 24 24" aria-hidden="true">${parts.map(p => p.f
    ? `<path d="${p.f}" fill="currentColor" fill-rule="evenodd"${p.o ? ` opacity="${p.o}"` : ''}/>`
    : `<path d="${p.s}" fill="none" stroke="currentColor" stroke-width="${p.w || 2}" stroke-linecap="round" stroke-linejoin="round"${p.o ? ` opacity="${p.o}"` : ''}/>`).join('')}</svg>`;
}

// canvas に描く（冒険中のスキル欄）。x, y：左上、size：一辺
const cache = new Map();
const path = d => { let p = cache.get(d); if (!p){ p = new Path2D(d); cache.set(d, p); } return p; };
export function drawSkillIcon(c, id, x, y, size, color){
  const parts = SKILL_ART[id];
  if (!parts) return;
  c.save();
  c.translate(x, y); c.scale(size/24, size/24);
  c.fillStyle = color; c.strokeStyle = color; c.lineCap = 'round'; c.lineJoin = 'round';
  const a0 = c.globalAlpha;
  for (const p of parts){
    c.globalAlpha = a0 * (p.o || 1);
    if (p.f) c.fill(path(p.f), 'evenodd');
    else { c.lineWidth = p.w || 2; c.stroke(path(p.s)); }
  }
  c.restore();
}
