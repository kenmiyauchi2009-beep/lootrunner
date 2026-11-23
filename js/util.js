// 汎用の小道具
export const $ = id => document.getElementById(id);
export const rnd = (a,b) => a + Math.random()*(b-a);
export const pick = arr => arr[Math.floor(Math.random()*arr.length)];
export const fmt = n => Math.round(n).toLocaleString('ja-JP');
export function pickW(obj){ const t = Object.values(obj).reduce((a,b)=>a+b,0); let r = Math.random()*t;
  for (const [k,w] of Object.entries(obj)){ if ((r-=w) < 0) return k; } return Object.keys(obj)[0]; }
