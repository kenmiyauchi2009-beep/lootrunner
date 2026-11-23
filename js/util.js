// 汎用の小道具（rng：乱数の関数。省略すると Math.random。日替わりダンジョンは決まった列を渡す）
export const $ = id => document.getElementById(id);
export const rnd = (a, b, rng = Math.random) => a + rng()*(b-a);
export const pick = (arr, rng = Math.random) => arr[Math.floor(rng()*arr.length)];
export const fmt = n => Math.round(n).toLocaleString('ja-JP');
export function pickW(obj, rng = Math.random){ const t = Object.values(obj).reduce((a,b)=>a+b,0); let r = rng()*t;
  for (const [k,w] of Object.entries(obj)){ if ((r-=w) < 0) return k; } return Object.keys(obj)[0]; }
