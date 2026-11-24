// 効果音と BGM。Web Audio API でその場で合成する（音声ファイルは使わない）。
// iOS は利用者の操作（タップ）の中で有効化しないと鳴らないので、タイトル・出撃ボタン・画面タップで unlockAudio() を呼ぶ。
// 音の流れ：効果音 → sfxBus ┐
//           BGM の曲 → bgmBus ┴→ master（消音で0）→ コンプレッサー → スピーカー
let ac = null, master = null, sfxBus = null, bgmBus = null, noiseBuf = null, muted = false, noiseOfs = 0, gemN = 0;
let vol = {bgm:0.5, sfx:0.8};
const VOL = 0.55, BGM_BASE = 0.32;
const last = {};
// 同じ音を短い間隔で重ねない（うるささと負荷を抑える）
const GAP = {gem:0.04, zap:0.08, fire:0.1, frost:0.15, lvup:0.3, hit:0.035, crit:0.05, slash:0.05, shoot:0.05, orb:0.06, kill:0.04, thud:0.08, drop:0.12, jump:0.03, warn:0.2};

export const isMuted = () => muted;
export function setMuted(m){
  muted = !!m;
  if (master) master.gain.value = muted ? 0 : VOL;
  // 消音中は音の処理ごと止める（電池のため）。戻すときは次のタップ（unlockAudio）でも再開する
  if (ac){ if (muted) ac.suspend().catch(() => {}); else if (!document.hidden) ac.resume().then(syncBgm).catch(() => {}); }
  syncBgm();
}
// 音量（0〜1）。BGM と効果音は別々
export function setVolumes(bgm, sfx){
  vol = {bgm, sfx};
  if (sfxBus) sfxBus.gain.value = sfx;
  if (bgmBus) bgmBus.gain.setTargetAtTime(bgm * BGM_BASE * duckF(), ac.currentTime, 0.05);
  syncBgm();
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
      sfxBus = ac.createGain(); sfxBus.gain.value = vol.sfx; sfxBus.connect(master);
      bgmBus = ac.createGain(); bgmBus.gain.value = vol.bgm * BGM_BASE; bgmBus.connect(master);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      let s = 1;
      for (let i = 0; i < d.length; i++){ s = (s * 16807) % 2147483647; d[i] = s / 1073741823.5 - 1; }
    }
    if (ac.state !== 'running' && !muted) ac.resume().then(syncBgm).catch(() => {});
    // 無音を1つ鳴らして確実に有効化する（古い iOS 向け）
    const src = ac.createBufferSource();
    src.buffer = ac.createBuffer(1, 1, 22050);
    src.connect(ac.destination); src.start(0);
    syncBgm();
  } catch(e){}
}

function env(g, t0, attack, dur, vol){
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
}
// 音程のある音
function tone({type = 'square', f0, f1 = f0, dur, vol = 0.15, attack = 0.004, delay = 0, lp = 0, at, dest = sfxBus}){
  const t0 = at ?? ac.currentTime + delay;
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  const g = ac.createGain();
  env(g, t0, attack, dur, vol);
  let node = o;
  if (lp){ const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); node = f; }
  node.connect(g); g.connect(dest);
  o.start(t0); o.stop(t0 + dur + 0.03);
}
// ノイズ（斬撃・衝撃）
function noise({dur, vol = 0.15, f0 = 1000, f1 = f0, type = 'bandpass', q = 1, attack = 0.002, delay = 0, at, dest = sfxBus}){
  const t0 = at ?? ac.currentTime + delay;
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  const g = ac.createGain();
  env(g, t0, attack, dur, vol);
  src.connect(f); f.connect(g); g.connect(dest);
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
  if (!ac || muted || vol.sfx <= 0 || ac.state !== 'running') return;
  const now = ac.currentTime;
  if (last[name] !== undefined && now - last[name] < (GAP[name] || 0.02)) return;
  last[name] = now;
  try { SOUNDS[name](arg); } catch(e){}
}

// ---------- BGM ----------
// 曲はデータ（テンポ・調・和音の進行・楽器）から作る。旋律は曲ごとに決まった乱数で生成するので、毎回同じ曲になる。
// 16分音符ごとに少し先まで予約して鳴らす（タイマーは0.15秒ごと）。消音・音量0・裏に回ったときは予約を止める（電池のため）。
const MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10], DOR = [0, 2, 3, 5, 7, 9, 10], PHR = [0, 1, 3, 5, 7, 8, 10], HMIN = [0, 2, 3, 5, 7, 8, 11];
const SONGS = {
  base: {bpm:84,  root:53, sc:MAJ,  prog:[0, 5, 3, 4], lead:'triangle', lv:0.05, bass:'sine',     bv:0.10, arp:'sine',     av:0.035, drums:'soft', seed:11, rest:0.45},
  zone0:{bpm:126, root:60, sc:MAJ,  prog:[0, 4, 5, 3], lead:'square',   lv:0.03, bass:'triangle', bv:0.12, arp:'triangle', av:0.03,  drums:'pop',  seed:21, rest:0.25},
  zone1:{bpm:110, root:50, sc:DOR,  prog:[0, 6, 5, 6], lead:'triangle', lv:0.05, bass:'triangle', bv:0.13, arp:'square',   av:0.018, drums:'trot', seed:33, rest:0.3},
  zone2:{bpm:96,  root:57, sc:MIN,  prog:[0, 5, 2, 6], lead:'sine',     lv:0.06, bass:'sine',     bv:0.12, arp:'triangle', av:0.03,  drums:'soft', seed:47, rest:0.4, echo:1},
  zone3:{bpm:142, root:52, sc:PHR,  prog:[0, 1, 0, 6], lead:'sawtooth', lv:0.022, bass:'sawtooth', bv:0.07, arp:'square',  av:0.015, drums:'rock', seed:59, rest:0.3},
  boss: {bpm:152, root:48, sc:HMIN, prog:[0, 0, 5, 4], lead:'square',   lv:0.028, bass:'sawtooth', bv:0.08, arp:'square',   av:0.016, drums:'rock', seed:71, rest:0.2},
};
const DRUMS = {   // 16分の位置：k=バスドラム s=スネア h=ハイハット
  soft:{k:[0, 8],          s:[],       h:[4, 12]},
  pop: {k:[0, 8, 10],      s:[4, 12],  h:[0, 2, 4, 6, 8, 10, 12, 14]},
  trot:{k:[0, 6, 8, 14],   s:[4, 12],  h:[2, 6, 10, 14]},
  rock:{k:[0, 3, 8, 10],   s:[4, 12],  h:[0, 2, 4, 6, 8, 10, 12, 14, 15]},
};
const mtof = m => 440 * Math.pow(2, (m - 69)/12);
const note = (S, deg, oct = 0) => S.root + 12*(oct + Math.floor(deg/7)) + S.sc[((deg % 7) + 7) % 7];
// 旋律：8小節（4小節の進行×2）。強拍は和音の音、それ以外は前の音から順に動く。後半は終わりを主音に戻す
function makeMelody(S){
  let a = S.seed;
  const r = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  const half = [];
  let d = 4;
  for (let bar = 0; bar < 4; bar++){
    const ch = S.prog[bar];
    for (let i = 0; i < 8; i++){
      if (i % 4 === 0) d = ch + [0, 2, 4][Math.floor(r()*3)] + 7;
      else d += [-2, -1, -1, 1, 1, 2][Math.floor(r()*6)];
      d = Math.max(5, Math.min(14, d));
      half.push(r() < S.rest && i % 4 ? null : {d, len:r() < 0.3 ? 2 : 1});
    }
  }
  const second = half.map(x => x && {...x});
  second[second.length - 2] = {d:7, len:2}; second[second.length - 1] = null;
  return [...half, ...second];
}
let cur = null;          // 鳴っている曲 {name, S, mel, g, step, next}
let want = '';           // 鳴らしたい曲（音が使えるようになったら始める）
let timer = 0, paused = false, duckUntil = 0;
const duckF = () => (paused ? 0.35 : 1) * (ac && ac.currentTime < duckUntil ? 0.25 : 1);
const audible = () => ac && ac.state === 'running' && !muted && vol.bgm > 0 && !document.hidden;

export function playBgm(name, fade = 0.8){
  want = name;
  if (!ac) return;
  if (cur && cur.name === name) return syncBgm();
  if (cur){ const old = cur; old.g.gain.setTargetAtTime(0, ac.currentTime, fade/3); setTimeout(() => { try { old.g.disconnect(); } catch(e){} }, fade*1000 + 200); }
  cur = null;
  syncBgm();
}
export function pauseBgm(p){ paused = p; if (bgmBus) bgmBus.gain.setTargetAtTime(vol.bgm * BGM_BASE * duckF(), ac.currentTime, 0.1); }
// 撃破のファンファーレのあいだ BGM を小さく
export function duckBgm(sec){
  if (!ac) return;
  duckUntil = ac.currentTime + sec;
  bgmBus.gain.setTargetAtTime(vol.bgm * BGM_BASE * 0.25, ac.currentTime, 0.05);
  setTimeout(() => { if (bgmBus) bgmBus.gain.setTargetAtTime(vol.bgm * BGM_BASE * duckF(), ac.currentTime, 0.4); }, sec*1000);
}
// 鳴らせる状態なら予約を続け、鳴らせないなら止める
function syncBgm(){
  if (!audible() || !want){ if (timer){ clearTimeout(timer); timer = 0; } return; }
  if (!cur || cur.name !== want){
    const S = SONGS[want] || SONGS.base;
    const g = ac.createGain(); g.gain.value = 0; g.connect(bgmBus);
    g.gain.setTargetAtTime(1, ac.currentTime, 0.3);
    cur = {name:want, S, mel:makeMelody(S), g, step:0, next:ac.currentTime + 0.1};
  }
  if (cur.next < ac.currentTime) cur.next = ac.currentTime + 0.05;   // 止まっていたら今から
  if (!timer) schedule();
}
function schedule(){
  timer = 0;
  if (!audible() || !cur) return;
  const S = cur.S, st = 60 / S.bpm / 4;
  while (cur.next < ac.currentTime + 0.4){
    playStep(cur, cur.step, cur.next, st);
    cur.step = (cur.step + 1) % 128;
    cur.next += st;
  }
  timer = setTimeout(schedule, 150);
}
function playStep(c, i, t, st){
  const S = c.S, dest = c.g, bar = Math.floor(i/16) % 4, pos = i % 16, ch = S.prog[bar];
  try {
    // ベース：8分ごと（根音と5度）
    if (pos % 2 === 0){
      const deg = pos % 8 === 6 ? ch + 4 : ch;
      tone({type:S.bass, f0:mtof(note(S, deg, -1)), dur:st*1.8, vol:S.bv, attack:0.01, at:t, dest, lp:900});
    }
    // 和音の分散（16分ごとに和音の音を上下）
    if (pos % 2 === 1 || S.drums === 'rock'){
      const k = [0, 2, 4, 7, 4, 2][Math.floor(pos/2) % 6];
      tone({type:S.arp, f0:mtof(note(S, ch + k, 0)), dur:st*0.9, vol:S.av, attack:0.005, at:t, dest, lp:2400});
    }
    // 旋律：8分ごと
    if (pos % 2 === 0){
      const m = c.mel[Math.floor(i/2) % c.mel.length];
      if (m){
        tone({type:S.lead, f0:mtof(note(S, m.d, 0)), dur:st*2*m.len*0.95, vol:S.lv, attack:0.01, at:t, dest, lp:3200});
        if (S.echo) tone({type:S.lead, f0:mtof(note(S, m.d, 0)), dur:st*2*m.len, vol:S.lv*0.35, attack:0.02, at:t + st*3, dest, lp:1800});
      }
    }
    // 打楽器
    const D = DRUMS[S.drums];
    if (D.k.includes(pos)) tone({type:'sine', f0:150, f1:45, dur:0.16, vol:0.22, attack:0.002, at:t, dest});
    if (D.s.includes(pos)) noise({dur:0.12, vol:0.1, f0:1800, type:'bandpass', q:0.7, at:t, dest});
    if (D.h.includes(pos)) noise({dur:0.035, vol:0.035, f0:8000, type:'highpass', at:t, dest});
  } catch(e){}
}
// 裏に回ったら音の処理ごと止める（電池のため）。戻ったら再開
document.addEventListener('visibilitychange', () => {
  if (!ac) return;
  if (document.hidden){ if (timer){ clearTimeout(timer); timer = 0; } ac.suspend().catch(() => {}); }
  else if (!muted) ac.resume().then(syncBgm).catch(() => {});
});
// 確認用（window.T.bgm）
export const bgmState = () => ({want, playing:cur ? cur.name : '', scheduling:!!timer, ctx:ac ? ac.state : 'none', muted, vol:{...vol}});
// iOS は裏から戻ったあと、タップの中でないと音が再開しないことがあるので、どこかをタップしたら再開する
document.addEventListener('pointerdown', () => { if (ac && ac.state !== 'running' && !muted) unlockAudio(); }, {capture:true, passive:true});
