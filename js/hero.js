// 主人公の装備の見た目（冒険中と拠点の両方で使う）：マント・兜・肩当て・首飾り
// x, y は足もと。体は y-27〜y-9、頭は (x+1, y-32) 半径7（render.js の drawPlayer と同じ寸法）
import { RAR } from './data.js';
import { SAVE } from './save.js';
import { capeColor } from './meta.js';

const rc = it => RAR[it.r].c;

// マント（体より先に描く）。t：時間、sp：なびき方（走っているとき大きい）
export function drawCape(c, x, y, t, sp = 1){
  const cp = capeColor();
  if (!cp) return;
  const w1 = Math.sin(t*9)*2.5*sp, w2 = Math.sin(t*9 + 1.3)*3*sp;
  c.fillStyle = cp.c;
  c.beginPath();
  c.moveTo(x - 6, y - 27);
  c.lineTo(x + 3, y - 27);
  c.quadraticCurveTo(x - 4, y - 16, x - 9 - 5*sp + w1, y - 7 + w1*0.3);
  c.lineTo(x - 15 - 7*sp + w2, y - 10 + w2*0.4);
  c.quadraticCurveTo(x - 12, y - 20, x - 6, y - 27);
  c.fill();
  c.fillStyle = 'rgba(0,0,0,.22)';
  c.beginPath(); c.moveTo(x - 6, y - 27); c.quadraticCurveTo(x - 10, y - 18, x - 15 - 7*sp + w2, y - 10 + w2*0.4); c.lineTo(x - 12 - 6*sp + w2, y - 11); c.quadraticCurveTo(x - 8, y - 19, x - 4, y - 27); c.fill();
  if (cp.star){
    c.fillStyle = '#fff';
    for (let i = 0; i < 4; i++){ const k = (i*37 + Math.floor(t*3)) % 7; c.fillRect(x - 6 - i*2.6 - k*0.4 + w1*0.5, y - 22 + ((i*5 + k) % 11), 1.2, 1.2); }
  }
}

// 兜（頭の上に描く）。レア度が上がると飾りが増える
export function drawHelmet(c, x, y){
  const h = SAVE.equip.head;
  if (!h) return;
  const col = rc(h), hx = x + 1, hy = y - 33;
  c.fillStyle = col;
  c.beginPath(); c.arc(hx, hy, 8, Math.PI, 0); c.fill();
  c.fillRect(hx - 9, hy - 0.5, 18, 2.6);
  c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(hx - 9, hy + 1.2, 18, 0.9);
  c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(hx - 2.5, hy - 4, 2.2, 0, Math.PI*2); c.fill();
  if (h.r >= 2){   // 羽根飾り
    c.fillStyle = h.r >= 4 ? '#ffe9a8' : '#e8e8f0';
    c.beginPath(); c.moveTo(hx - 1, hy - 7.5); c.quadraticCurveTo(hx - 9, hy - 15, hx - 13, hy - 9); c.quadraticCurveTo(hx - 7, hy - 10, hx + 1, hy - 7); c.fill();
  }
  if (h.r >= 4){   // 角
    c.fillStyle = '#fff2c0';
    c.beginPath(); c.moveTo(hx + 4, hy - 5); c.lineTo(hx + 9, hy - 12); c.lineTo(hx + 6.5, hy - 3.5); c.fill();
  }
}

// 肩当て・首飾り（体の上に描く）
export function drawTrim(c, x, y, t){
  const b = SAVE.equip.body;
  if (b && b.r >= 1){
    c.fillStyle = rc(b);
    c.beginPath(); c.arc(x + 5, y - 25, 4, Math.PI, Math.PI*2.2); c.fill();
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x + 1, y - 25, 8, 1);
    if (b.r >= 3){ c.fillStyle = '#ffd36b'; c.fillRect(x - 8, y - 12.5, 16, 1.6); }
  }
  const ch = SAVE.equip.charm1 || SAVE.equip.charm2;
  if (ch){
    const col = rc(ch);
    c.strokeStyle = 'rgba(255,240,200,.7)'; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(x - 2, y - 26); c.lineTo(x + 2, y - 21); c.lineTo(x + 5, y - 26); c.stroke();
    c.fillStyle = col; c.beginPath(); c.arc(x + 2, y - 20.5, 1.8, 0, Math.PI*2); c.fill();
    if (ch.r >= 4 && Math.sin(t*5) > 0.3){ c.fillStyle = '#fff'; c.fillRect(x + 3, y - 23, 1.2, 1.2); }
  }
}
