// 効果音。Web Audio API でその場で合成する（音声ファイルは使わない）。
// iOS は利用者の操作（タップ）の中で有効化しないと鳴らないので、出撃ボタンと画面タップで unlockAudio() を呼ぶ。
let ac = null, master = null, noiseBuf = null, muted = false, noiseOfs = 0, gemN = 0;
const VOL = 0.55;
const last = {};
// 同じ音を短い間隔で重ねない（うるささと負荷を抑える）
const GAP = {gem:0.04, zap:0.08, fire:0.1, frost:0.15, lvup:0.3, hit:0.035, crit:0.05, slash:0.05, shoot:0.05, orb:0.06, kill:0.04, thud:0.08, drop:0.12, jump:0.03, warn:0.2};

export const isMuted = () => muted;
export function setMuted(m){
  muted = !!m;
  if (master) master.gain.value = muted ? 0 : VOL;
}

export function unlockAudio(){
  try {
    if (!ac){
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      const comp = ac.createDynamicsCompressor();
      comp.connect(ac.destination);
      master = ac.createGain();
      master.gain.value = muted ? 0 : VOL;
      master.connect(comp);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      let s = 1;
      for (let i = 0; i < d.length; i++){ s = (s * 16807) % 2147483647; d[i] = s / 1073741823.5 - 1; }
    }
    if (ac.state !== 'running') ac.resume().catch(() => {});
    // 無音を1つ鳴らして確実に有効化する（古い iOS 向け）
    const src = ac.createBufferSource();
    src.buffer = ac.createBuffer(1, 1, 22050);
    src.connect(ac.destination); src.start(0);
  } catch(e){}
}

function env(g, t0, attack, dur, vol){
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
}
// 音程のある音
function tone({type = 'square', f0, f1 = f0, dur, vol = 0.15, attack = 0.004, delay = 0, lp = 0}){
  const t0 = ac.currentTime + delay;
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  const g = ac.createGain();
  env(g, t0, attack, dur, vol);
  let node = o;
  if (lp){ const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); node = f; }
  node.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.03);
}
// ノイズ（斬撃・衝撃）
function noise({dur, vol = 0.15, f0 = 1000, f1 = f0, type = 'bandpass', q = 1, attack = 0.002, delay = 0}){
  const t0 = ac.currentTime + delay;
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  const g = ac.createGain();
  env(g, t0, attack, dur, vol);
  src.connect(f); f.connect(g); g.connect(master);
  noiseOfs = (noiseOfs + 0.137) % 0.8;
  src.start(t0, noiseOfs); src.stop(t0 + dur + 0.03);
}
const notes = (fs, o) => fs.forEach((f, i) => tone({...o, f0:f, delay:(o.delay || 0) + i * (o.step || 0.07)}));

const SOUNDS = {
  slash(){ noise({dur:0.09, vol:0.22, f0:3200, f1:700, q:1.4}); },
  shoot(){ tone({type:'triangle', f0:900, f1:320, dur:0.08, vol:0.14}); noise({dur:0.025, vol:0.08, f0:5000, type:'highpass'}); },
  orb(){ tone({type:'sine', f0:420, f1:950, dur:0.13, vol:0.12}); tone({type:'sine', f0:840, f1:1500, dur:0.1, vol:0.04, delay:0.02}); },
  hit(){ noise({dur:0.05, vol:0.16, f0:1400, type:'lowpass'}); tone({f0:190, f1:90, dur:0.05, vol:0.05}); },
  crit(){ noise({dur:0.08, vol:0.22, f0:2600, q:0.8}); tone({f0:1500, f1:900, dur:0.09, vol:0.07}); tone({type:'sine', f0:2400, dur:0.12, vol:0.05, delay:0.02}); },
  kill(){ tone({type:'triangle', f0:320, f1:760, dur:0.09, vol:0.13}); noise({dur:0.1, vol:0.09, f0:1600, f1:500}); },
  stomp(){ tone({type:'sine', f0:210, f1:60, dur:0.15, vol:0.32}); noise({dur:0.08, vol:0.18, f0:900, type:'lowpass'}); tone({f0:620, f1:1250, dur:0.07, vol:0.05, delay:0.03, lp:3000}); },
  hurt(){ tone({type:'sawtooth', f0:230, f1:70, dur:0.22, vol:0.2, lp:1400}); noise({dur:0.12, vol:0.18, f0:700, type:'lowpass'}); },
  jump(n){ const b = n === 2 ? 400 : 270; tone({f0:b, f1:b * 2, dur:0.09, vol:0.06, lp:2600}); },
  thud(){ noise({dur:0.08, vol:0.1, f0:420, type:'lowpass'}); },
  warn(){ tone({f0:880, dur:0.07, vol:0.08}); tone({f0:880, dur:0.07, vol:0.08, delay:0.12}); },
  up(){ notes([784, 1175], {type:'sine', dur:0.14, vol:0.13, step:0.08}); },
  drop(r){
    if (r <= 0) tone({type:'sine', f0:880, dur:0.09, vol:0.1});
    else if (r === 1) notes([660, 990], {type:'triangle', dur:0.1, vol:0.12});
    else if (r === 2) notes([660, 880, 1320], {type:'triangle', dur:0.12, vol:0.13});
    else if (r === 3){
      notes([523, 659, 784, 1047], {type:'square', dur:0.16, vol:0.08, lp:3200, step:0.06});
      noise({dur:0.5, vol:0.05, f0:7000, type:'highpass', attack:0.05, delay:0.1});
    } else {
      [523, 659, 784].forEach(f => tone({type:'triangle', f0:f, dur:0.7, vol:0.09, attack:0.02}));
      notes([1047, 1319, 1568, 2093], {type:'square', dur:0.18, vol:0.06, lp:4000, step:0.07, delay:0.12});
      noise({dur:0.8, vol:0.06, f0:8000, type:'highpass', attack:0.1, delay:0.15});
    }
  },
  boss(){
    for (const d of [0, 0.45]){
      tone({type:'sawtooth', f0:110, f1:55, dur:0.9, vol:0.22, lp:600, attack:0.03, delay:d});
      tone({type:'sawtooth', f0:82, f1:41, dur:0.9, vol:0.18, lp:500, attack:0.03, delay:d});
      noise({dur:0.45, vol:0.3, f0:220, type:'lowpass', delay:d});
    }
  },
  lvup(){ notes([523, 659, 784, 1047, 1319], {type:'triangle', dur:0.14, vol:0.12, step:0.055}); },
  gem(){ tone({type:'sine', f0:1500 + Math.min(600, (gemN = (gemN + 1) % 12) * 50), dur:0.05, vol:0.05}); },
  zap(){ noise({dur:0.12, vol:0.18, f0:4000, type:'highpass'}); tone({f0:1800, f1:300, dur:0.1, vol:0.06}); },
  fire(){ noise({dur:0.3, vol:0.14, f0:500, f1:1500, type:'lowpass', attack:0.03}); },
  frost(){ tone({type:'sine', f0:1800, f1:2600, dur:0.25, vol:0.05}); noise({dur:0.2, vol:0.07, f0:6000, type:'highpass', attack:0.02}); },
  bosskill(){
    noise({dur:0.7, vol:0.32, f0:300, f1:80, type:'lowpass'});
    notes([392, 523, 659, 784, 1047], {type:'square', dur:0.18, vol:0.08, lp:3000, step:0.09, delay:0.25});
  },
};

export function sfx(name, arg){
  if (!ac || muted || ac.state !== 'running') return;
  const now = ac.currentTime;
  if (last[name] !== undefined && now - last[name] < (GAP[name] || 0.02)) return;
  last[name] = now;
  try { SOUNDS[name](arg); } catch(e){}
}
