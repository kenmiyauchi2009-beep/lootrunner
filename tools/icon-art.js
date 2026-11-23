// アプリアイコンの絵（100×100 の座標で描き、size に合わせて拡大する）
// 主要な絵は中央80%に収めているので、角丸・円形に切り抜かれても欠けない。
export function drawIcon(ctx, size){
  ctx.save();
  ctx.scale(size / 100, size / 100);
  const GY = 76;

  // 夕焼けの空
  const sky = ctx.createLinearGradient(0, 0, 0, GY);
  sky.addColorStop(0, '#1b2b4d'); sky.addColorStop(0.55, '#7a3f5c'); sky.addColorStop(1, '#f08d5a');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 100, 100);
  // 星
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  for (const [x, y, r] of [[16, 14, .9], [30, 9, .6], [84, 12, .8], [72, 22, .5], [10, 30, .5]]){ ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill(); }
  // 遠くの丘
  ctx.fillStyle = '#a8694f';
  ctx.beginPath(); ctx.moveTo(0, GY);
  for (let x = 0; x <= 100; x += 2) ctx.lineTo(x, 64 - 5*Math.sin(x*0.07 + 1) - 3*Math.sin(x*0.17));
  ctx.lineTo(100, GY); ctx.closePath(); ctx.fill();
  // 地面
  ctx.fillStyle = '#3a2a26'; ctx.fillRect(0, GY, 100, 24);
  ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(0, GY, 100, 1.2);
  ctx.fillStyle = '#2a1d1a'; for (let x = 4; x < 100; x += 16) ctx.fillRect(x, GY + 6, 7, 1.8);

  // レジェンド装備の光の柱
  const px = 72;
  const pg = ctx.createLinearGradient(0, 8, 0, GY);
  pg.addColorStop(0, 'rgba(255,165,58,0)'); pg.addColorStop(1, 'rgba(255,165,58,.9)');
  ctx.fillStyle = pg; ctx.fillRect(px - 7, 8, 14, GY - 8);
  ctx.fillStyle = 'rgba(255,230,180,.5)'; ctx.fillRect(px - 2, 18, 4, GY - 18);
  // 落ちている宝石
  ctx.shadowColor = '#ffa53a'; ctx.shadowBlur = 6;
  ctx.fillStyle = '#ffa53a';
  ctx.beginPath(); ctx.moveTo(px, GY - 13); ctx.lineTo(px + 6, GY - 6); ctx.lineTo(px, GY - 0.5); ctx.lineTo(px - 6, GY - 6); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff3d6';
  ctx.beginPath(); ctx.moveTo(px - 1, GY - 11); ctx.lineTo(px + 2, GY - 7); ctx.lineTo(px - 2.5, GY - 6.5); ctx.closePath(); ctx.fill();

  // 走る主人公（ゲーム内の絵を拡大）
  ctx.save();
  ctx.translate(34, GY); ctx.scale(1.5, 1.5);
  const circ = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill(); };
  const rr = (x, y, w, h, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); };
  // 斬撃
  ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(4, -16, 19, -1.35, 0.9); ctx.stroke();
  // 脚
  ctx.strokeStyle = '#2b2f3a'; ctx.lineWidth = 4;
  for (const [i, a] of [0.8, -0.8].entries()){ ctx.beginPath(); ctx.moveTo(-2 + i*4, -10); ctx.lineTo(-2 + i*4 + Math.sin(a)*8, -1); ctx.stroke(); }
  // 体と頭
  rr(-8, -27, 16, 18, 4, '#4ea3ff');
  rr(-8, -15, 16, 3, 1, 'rgba(0,0,0,.25)');
  circ(1, -32, 7, '#f6d2a8');
  ctx.fillStyle = '#5a3a22'; ctx.beginPath(); ctx.arc(0, -34, 7.5, Math.PI*1.05, Math.PI*2.05); ctx.fill();
  circ(4, -32, 1.3, '#222');
  // 剣
  const hx = 7, hy = -18, a = -1.05, len = 20;
  ctx.shadowColor = '#ffa53a'; ctx.shadowBlur = 5;
  ctx.strokeStyle = '#ffc56b'; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(a)*len, hy + Math.sin(a)*len); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#6b5a3a'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(hx + Math.cos(a + 1.57)*4, hy + Math.sin(a + 1.57)*4); ctx.lineTo(hx - Math.cos(a + 1.57)*4, hy - Math.sin(a + 1.57)*4); ctx.stroke();
  ctx.restore();

  ctx.restore();
}
