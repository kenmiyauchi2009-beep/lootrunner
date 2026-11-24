// ボスの技の「振り付け」（ターン制のボス戦）とセリフ。
// 技＝数秒つづく弾の模様。mode：'jump'（ふだんのジャンプ）／'float'（浮遊：押すと上がる・離すと下がる。当たるのは胸のハートだけ）
// make(L, r)：L＝この戦いでその技を使った回数（0,1,2…。くり返すほど激しくなる）、r＝乱数。戻り値は [[何秒後, 動き, 中身]...]
//
// ジャンプの動き（run.js の bossAct）：wave / orb / zig / homing / bounce / drop / pillar / beam / wall / charge / dive / summon / lob / boulder / spin / split / descend / meteor / dark
// 浮遊の動き：
//   fb：弾 {f：高さ（0＝下〜1＝上）, sp：速さ, vy：上下の速さ, mo：'sine'（波）/'bounce'（上下ではね返る）, amp, fq, c, col：'blue'（動くと当たる）/'orange'（止まると当たる）, r}
//   fwall：すき間のある壁 {f：すき間の高さ, gap：すき間の大きさ（0〜1）, sp, c}
//   flaser：横に走る光（予告の線のあと出る） {a, b：高さの範囲（0〜1）, tele, dur}
const J = (at, a, o = {}) => [at, a, o];
const fb = (at, f, o = {}) => [at, 'fb', {f, ...o}];
const fw = (at, f, gap, o = {}) => [at, 'fwall', {f, gap, ...o}];
const fl = (at, a, b, o = {}) => [at, 'flaser', {a, b, ...o}];
const n = (base, L, max) => Math.min(max, base + L);      // くり返すほど増える
const sp = (base, L) => base * (1 + Math.min(0.5, L*0.12));   // くり返すほど速い
const seq = (count, gap, f) => Array.from({length:count}, (_, i) => f(i*gap, i)).flat(1);
const pick = (r, arr) => arr[Math.floor(r()*arr.length)];

export const PATTERNS = {
  // ================= キングスライム：ぷよぷよ、のんき =================
  ks_bounce: {n:'ぽよんぽよん', mode:'jump', line:'ぽよん！ついてこれるかな？', make:(L, r) => [
    ...seq(n(3, L, 5), 0.75, t => [J(t, 'wave', {c:'#7fd86a', sp:sp(220, L)})]),
    ...seq(n(1, L, 3), 0.9, t => [J(0.4 + t, 'bounce', {sp:150, vy:200, r:9, c:'#8fe36a'})]),
  ]},
  ks_jelly: {n:'ゼリーの海', mode:'float', line:'ぷるぷるの海で泳いでみて〜', make:(L, r) =>
    seq(n(5, L, 8), 0.8, (t, i) => [fw(t, 0.25 + 0.5*Math.abs(Math.sin(i*1.1 + r()*0.5)), 0.38 - Math.min(0.08, L*0.02), {sp:sp(140, L), c:'#7fd86a'})])},
  ks_rain: {n:'スライムの雨', mode:'jump', line:'子どもたち、いけ〜！', make:(L, r) => [
    ...seq(n(3, L, 5), 0.6, t => [J(t, 'drop', {tele:0.5, r:9, c:'#8fe36a'})]),
    ...seq(3, 0.35, t => [J(0.3 + t, 'summon', {t:'mini'})]),
  ]},
  ks_final: {n:'キングの大行進', mode:'float', line:'王さまの本気、見せちゃうぞ〜！', make:(L, r) => [
    ...seq(8, 0.55, (t, i) => [fb(t, (i % 4)/3, {sp:170, mo:'bounce', vy:120, c:'#8fe36a'})]),
    ...seq(4, 1.1, (t, i) => [fw(1 + t, i % 2 ? 0.75 : 0.25, 0.35, {sp:150, c:'#5fb84a'})]),
  ]},
  // ================= 岩石ゴーレム：無口、重い =================
  go_quake: {n:'大地のこぶし', mode:'jump', line:'……砕ク。', make:(L, r) => [
    J(0, 'wave', {sp:150, h:30, w:22, c:'#b0865a'}),
    ...seq(n(2, L, 4), 0.62, t => [J(0.8 + t, 'lob', {})]),
    ...(L >= 1 ? [J(0.8 + n(2, L, 4)*0.62 + 0.3, 'boulder', {sp:150, r:13})] : []),
  ]},
  go_maze: {n:'岩の迷路', mode:'float', line:'……迷エ。', make:(L, r) => {
    let f = 0.5; return seq(n(6, L, 9), 0.7, t => { f = Math.max(0.15, Math.min(0.85, f + (r() - 0.5)*0.5)); return [fw(t, f, 0.34, {sp:sp(130, L), c:'#8b8378'})]; }); }},
  go_fall: {n:'崩れる天井', mode:'float', line:'……落チル。', make:(L, r) =>
    seq(n(10, L*2, 16), 0.32, (t, i) => [fb(t, i % 3 === 0 ? 0 : r(), {sp:sp(180, L), r:7, c:'#8b8378'})])},   // 3つに1つは床すれすれ
  go_final: {n:'山崩し', mode:'jump', line:'……スベテ、崩ス。', make:(L, r) => [
    J(0, 'meteor', {c:'#b0865a'}), J(1.0, 'boulder', {sp:170, r:14}), J(1.9, 'wave', {sp:200, h:26, c:'#b0865a'}),
    ...seq(3, 0.6, t => [J(2.6 + t, 'drop', {tele:0.5, r:11, sk:'rock', c:'#8b8378'})]),
  ]},
  // ================= 森の魔女：いたずら好き =================
  wi_dance: {n:'魔弾の舞踏会', mode:'float', line:'ふふ、踊りましょう？', make:(L, r) =>
    seq(n(3, L, 5), 1.1, (t, i) => { const ph = i*1.9 + r()*0.6; return [fb(t, 0.5, {sp:150, mo:'sine', amp:0.5, fq:2.2, ph, c:'#c58bff'}), fb(t + 0.3, 0.5, {sp:150, mo:'sine', amp:0.5, fq:2.2, ph:ph + Math.PI, c:'#ff8adf'})]; })},   // 二人で踊るように、たがいちがいの波
  wi_color: {n:'青と橙の呪文', mode:'float', line:'青は動かないで。橙は動いて。かんたんでしょう？', make:(L, r) =>
    seq(n(4, L, 6), 0.95, (t, i) => [fw(t, 0.5, 0, {sp:150, c:i % 2 ? '#ffa53a' : '#4ea3ff', col:i % 2 ? 'orange' : 'blue', full:1})])},
  wi_ghost: {n:'霊たちの行進', mode:'jump', line:'みんな、出ておいで〜', make:(L, r) => [
    J(0, 'summon', {t:'ghost'}), J(0.5, 'summon', {t:'ghost'}),
    ...seq(n(2, L, 4), 0.7, t => [J(1.0 + t, 'homing', {sp:120, c:'#9a4aff'})]),
  ]},
  wi_final: {n:'満月の大魔法', mode:'float', line:'これで最後。月まで飛ばしてあげる！', make:(L, r) => [
    ...seq(6, 0.5, (t, i) => [fb(t, i/5, {sp:160, c:'#c58bff'}), fb(t, 1 - i/5, {sp:160, c:'#ff8adf'})]),
    ...seq(3, 0.8, (t, i) => [fw(3.2 + t, pick(r, [0.2, 0.5, 0.8]), 0.32, {sp:150, c:'#7a4ab8'})]),
  ]},
  // ================= 炎竜：誇り高い =================
  dr_breath: {n:'業火の息', mode:'jump', line:'焼き尽くしてくれる！', make:(L, r) => [
    ...seq(n(2, L, 4), 0.5, t => [J(t, 'orb', {lane:'low', sp:sp(220, L), r:8, sk:'fire'})]),
    J(1.3, 'pillar', {}), ...(L >= 1 ? [J(2.0, 'pillar', {})] : []),
  ]},
  dr_wings: {n:'炎の翼', mode:'float', line:'空でも逃げられんぞ！', make:(L, r) =>
    seq(n(3, L, 5), 1.0, (t, i) => seq(5, 0, () => []).concat([fb(t, 0.5, {sp:170, vy:-120, c:'#ff8a3a', sk:'fire'}), fb(t, 0.5, {sp:170, vy:-50, c:'#ff8a3a', sk:'fire'}), fb(t, 0.5, {sp:170, vy:50, c:'#ff8a3a', sk:'fire'}), fb(t, 0.5, {sp:170, vy:120, c:'#ff8a3a', sk:'fire'})]))},
  dr_wall: {n:'炎の壁', mode:'jump', line:'越えてみせよ！', make:(L, r) => [J(0, 'wall', {h:64, sp:170, c:'#ff7a2a'}), ...(L >= 1 ? [J(1.2, 'wall', {h:50, sp:200, c:'#ff7a2a'})] : [])]},
  dr_final: {n:'竜王の怒り', mode:'float', line:'我が炎、受けてみよ！！', make:(L, r) => [
    fl(0, 0, 0.35, {tele:0.8, dur:0.7}), fl(1.6, 0.65, 1, {tele:0.8, dur:0.7}), fl(3.2, 0.3, 0.7, {tele:0.8, dur:0.7}),
    ...seq(4, 0.5, (t, i) => [fb(4.6 + t, i % 2 ? 0.2 : 0.8, {sp:200, sk:'fire', c:'#ff8a3a'})]),
  ]},
  // ================= 女王蜂：高飛車 =================
  qb_needle: {n:'針の雨', mode:'jump', line:'ひざまずきなさい！', make:(L, r) => seq(n(3, L, 5), 0.6, t => [J(t, 'drop', {tele:0.45, r:5, sk:'needle', c:'#ffe14d'})])},
  qb_comb: {n:'ハチの巣', mode:'float', line:'わたくしの巣から出られるかしら？', make:(L, r) =>
    seq(n(6, L, 9), 0.6, (t, i) => (i % 2 ? [0.22, 0.67] : [0, 0.45, 0.9]).map(f => fb(t, f, {sp:sp(160, L), c:'#ffc83a', r:6})))},   // 段ちがいの巣の目
  qb_dive: {n:'女王の急降下', mode:'jump', line:'無礼者！', make:(L, r) => [J(0, 'summon', {t:'bee'}), J(0.6, 'dive', {}), ...(L >= 1 ? [J(2.4, 'summon', {t:'bee'})] : [])]},
  qb_final: {n:'女王の舞', mode:'float', line:'わたくしの舞、最後まで見なさい！', make:(L, r) => [
    ...seq(10, 0.35, (t, i) => [fb(t, 0.5, {sp:190, mo:'sine', amp:0.45, fq:3, ph:i*0.6, sk:'needle', c:'#c8ff4a'})]),
    ...seq(2, 1.0, (t, i) => [fw(3.8 + t, i ? 0.7 : 0.3, 0.3, {sp:160, c:'#ffc83a'})]),
  ]},
  // ================= 大砂虫：腹ぺこ =================
  sw_burrow: {n:'地中からの一撃', mode:'jump', line:'ハラ……ヘッタ……', make:(L, r) => [J(0, 'pillar', {c:'#d8a860', big:1}), ...seq(n(2, L, 4), 0.62, t => [J(0.9 + t, 'wave', {sp:200, h:20, c:'#e8c878'})])]},
  sw_sand: {n:'砂の流れ', mode:'float', line:'ナガレニ……ノマレロ……', make:(L, r) =>
    seq(n(14, L*3, 22), 0.22, (t, i) => [fb(t, 0.5 + 0.38*Math.sin(i*0.45), {sp:sp(170, L), r:5, c:'#e8c878'}), fb(t, 0.5 + 0.38*Math.sin(i*0.45) + (i % 2 ? 0.55 : -0.55), {sp:sp(170, L), r:5, c:'#d8a860'})])},
  sw_tail: {n:'尾の薙ぎ払い', mode:'jump', line:'ジャマ……スルナ……', make:(L, r) => seq(n(2, L, 3), 0.85, t => [J(t, 'wall', {h:28, sp:230, c:'#a87848'})])},
  sw_final: {n:'大食い', mode:'float', line:'ゼンブ……クウ……！', make:(L, r) => [
    fl(0, 0, 0.3, {tele:0.7, dur:3.0}), fl(0.9, 0.7, 1, {tele:0.7, dur:2.4}),
    ...seq(6, 0.4, (t, i) => [fb(1.2 + t, 0.4 + (i % 3)*0.1, {sp:150, r:6, c:'#e8c878'})]),
  ]},
  // ================= 森の古木：ゆったり、古風 =================
  tk_roots: {n:'根の目覚め', mode:'jump', line:'森を荒らすのは、誰じゃ……', make:(L, r) => seq(n(3, L, 4), 0.6, t => [J(t, 'pillar', {c:'#6a4a2a', root:1})])},
  tk_leaves: {n:'木の葉の渦', mode:'float', line:'風に舞う葉を、くぐってみよ', make:(L, r) =>
    seq(n(8, L*2, 14), 0.4, (t, i) => [fb(t, 0.5, {sp:150, mo:'sine', amp:0.42, fq:1.6, ph:i*0.8, c:'#5fae4e', sk:'leaf'})])},
  tk_fruit: {n:'実りの季節', mode:'jump', line:'実りを分けてやろう', make:(L, r) => [J(0, 'summon', {t:'owl'}), ...seq(n(2, L, 4), 0.8, t => [J(0.5 + t, 'bounce', {sp:120, vy:220, r:11, c:'#e0584a'})])]},
  tk_final: {n:'千年の森', mode:'float', line:'千年の森の重み、思い知れ', make:(L, r) => {
    let f = 0.5; return [...seq(7, 0.6, t => { f = Math.max(0.2, Math.min(0.8, f + (r() < 0.5 ? -0.25 : 0.25))); return [fw(t, f, 0.3, {sp:150, c:'#3f7a4a'})]; }),
      ...seq(6, 0.45, (t, i) => [fb(1 + t, r(), {sp:200, c:'#8fd47a', sk:'leaf'})])]; }},
  // ================= 不死鳥：情熱的 =================
  ph_rain: {n:'火の雨', mode:'jump', line:'燃えなさい！灰からまた生まれるの！', make:(L, r) => seq(n(3, L, 5), 0.6, t => [J(t, 'drop', {tele:0.4, r:7, sk:'fire', c:'#ff8a3a'})])},
  ph_spiral: {n:'炎の螺旋', mode:'float', line:'くるくる回って、きれいでしょう？', make:(L, r) =>
    seq(n(12, L*3, 20), 0.25, (t, i) => [fb(t, 0.5, {sp:170, vy:Math.sin(i*0.7)*140, c:i % 2 ? '#ff8a3a' : '#ffd36b', sk:'fire'})])},
  ph_ring: {n:'炎の輪', mode:'jump', line:'輪をくぐって！', make:(L, r) => [J(0, 'spin', {sp:230, c:'#ff7a2a'}), ...(L >= 1 ? [J(1.2, 'spin', {sp:250, c:'#ffd36b'})] : []), J(L >= 1 ? 2.4 : 1.2, 'wave', {sp:260, c:'#ffd36b'})]},
  ph_final: {n:'転生の炎', mode:'float', line:'わたしは何度でもよみがえる！', make:(L, r) => [
    ...seq(5, 0.7, (t, i) => [fw(t, i % 2 ? 0.25 : 0.75, 0.3, {sp:160, c:'#ff7a2a', col:i === 4 ? 'blue' : null})]),
    ...seq(8, 0.3, (t, i) => [fb(3.8 + t, 0.5, {sp:180, vy:(i % 2 ? 1 : -1)*(40 + i*12), c:'#ffd36b', sk:'fire'})]),
  ]},
  // ================= 結晶の女王：冷たい =================
  cq_beam: {n:'結晶の光線', mode:'jump', line:'砕けてしまいなさい。', make:(L, r) => [J(0, 'beam', {lane:pick(r, ['low', 'high'])}), ...(L >= 1 ? [J(1.1, 'beam', {lane:pick(r, ['low', 'high'])})] : [])]},
  cq_prism: {n:'プリズムの檻', mode:'float', line:'光の檻の中で、震えなさい。', make:(L, r) => {
    const ls = [[0, 0.3], [0.35, 0.65], [0.7, 1]], safe = Math.floor(r()*3);
    return [...ls.map((l, i) => i === safe ? null : fl(0, l[0], l[1], {tele:0.9, dur:0.8})).filter(Boolean),
      ...seq(n(1, L, 2), 1.8, (t, k) => { const s2 = (safe + 1 + k) % 3; return ls.map((l, i) => i === s2 ? null : fl(1.8 + t, l[0], l[1], {tele:0.9, dur:0.8})).filter(Boolean); })]; }},
  cq_shard: {n:'結晶のつぶて', mode:'float', line:'美しいでしょう？触れたら終わりよ。', make:(L, r) =>
    seq(n(6, L*2, 10), 0.4, (t, i) => [fb(t, 0.5, {sp:200, vy:(r() - 0.5)*240, mo:'bounce', c:'#c8a6ff', sk:'crystal'})])},
  cq_final: {n:'永久凍土', mode:'float', line:'すべて、凍りつきなさい。', make:(L, r) => [
    ...seq(4, 1.0, (t, i) => [fw(t, 0.5, 0.0, {sp:140, c:i % 2 ? '#ffa53a' : '#9fe3ff', col:i % 2 ? 'orange' : 'blue', full:1})]),
    ...seq(6, 0.4, (t, i) => [fb(4.2 + t, i % 2 ? 0.15 : 0.85, {sp:220, c:'#e8dcff', sk:'crystal'})]),
  ]},
  // ================= ファラオ：尊大 =================
  pr_disk: {n:'太陽の円盤', mode:'jump', line:'ひれ伏せ、旅人よ。', make:(L, r) => [J(0, 'spin', {sp:200, c:'#ffd36b', sk:'disk'}), J(0.6, 'summon', {t:'scarab'}), ...(L >= 1 ? [J(1.4, 'spin', {sp:220, c:'#ffd36b', sk:'disk'})] : [])]},
  pr_hiero: {n:'象形文字の壁', mode:'float', line:'読めるか？この呪いの文字を。', make:(L, r) =>
    seq(n(5, L, 8), 0.75, (t, i) => [fw(t, [0.2, 0.8, 0.5, 0.2, 0.8, 0.5, 0.3, 0.7][i], 0.3, {sp:sp(140, L), c:'#c8a050'})])},
  pr_curse: {n:'王家の呪い', mode:'jump', line:'眠りを妨げた罪は重い。', make:(L, r) => [J(0, 'summon', {t:'mummy'}), J(0.4, 'wall', {h:62, sp:150, c:'#c8a050'}), ...seq(n(2, L, 3), 0.55, t => [J(1.6 + t, 'bounce', {sp:190, vy:160, r:6, c:'#2a8a7a'})])]},
  pr_final: {n:'太陽王の審判', mode:'float', line:'太陽の裁きを受けよ！', make:(L, r) => [
    ...seq(3, 1.4, (t, i) => [fl(t, i === 1 ? 0.5 : 0, i === 1 ? 1 : 0.5, {tele:0.8, dur:0.6})]),
    ...seq(6, 0.45, (t, i) => [fb(4.4 + t, (i*0.37) % 1, {sp:200, c:'#ffd36b', sk:'disk'})]),
  ]},
  // ================= 嵐の王：豪快 =================
  st_volley: {n:'雷鳴', mode:'jump', line:'ガハハ！雷を受けてみろ！', make:(L, r) => seq(n(4, L, 6), 0.5, (t, i) => [J(t, 'orb', {lane:i % 2 ? 'high' : 'low', sp:200, sk:'bolt', c:'#ffe14d'})])},
  st_storm: {n:'暴風', mode:'float', line:'吹き飛ばされるなよ！', make:(L, r) =>
    seq(n(16, L*4, 26), 0.18, (t, i) => [fb(t, r(), {sp:sp(240, L), r:4, c:'#cfe8ff', vy:(r() - 0.5)*40})])},
  st_strike: {n:'落雷', mode:'jump', line:'そこだァ！', make:(L, r) => [J(0, 'dark', {dur:2.6}), ...seq(n(3, L, 4), 0.6, t => [J(0.5 + t, 'drop', {tele:0.5, r:8, sk:'bolt', c:'#fff27a'})])]},
  st_final: {n:'天変地異', mode:'float', line:'これがオレ様の全力だァ！！', make:(L, r) => [
    J(0, 'dark', {dur:5.5}),
    ...seq(5, 0.8, (t, i) => [fw(0.4 + t, 0.5, 0, {sp:150, c:i % 2 ? '#ffa53a' : '#4ea3ff', col:i % 2 ? 'orange' : 'blue', full:1})]),
    ...seq(8, 0.25, (t, i) => [fb(4.6 + t, r(), {sp:260, r:4, c:'#ffe14d', sk:'bolt'})]),
  ]},
  // ================= 深淵の瞳：不気味 =================
  ae_gaze: {n:'凝視', mode:'jump', line:'……ミテイル……', make:(L, r) => [J(0, 'dark', {dur:3}), ...seq(n(2, L, 4), 0.9, t => [J(0.4 + t, 'homing', {sp:150, c:'#ff3a5a'})])]},
  ae_tears: {n:'血の涙', mode:'float', line:'……ナミダ……トマラナイ……', make:(L, r) =>
    seq(n(9, L*2, 15), 0.3, (t, i) => [fb(t, 1, {sp:140, vy:110 + r()*60, c:'#c83a4a', r:6}), fb(t + 0.15, 0, {sp:140, vy:-(110 + r()*60), c:'#c83a4a', r:6})])},
  ae_iris: {n:'瞳の迷宮', mode:'float', line:'……ニゲラレナイ……', make:(L, r) => {
    let f = 0.5; return seq(n(6, L, 9), 0.55, t => { f = Math.max(0.15, Math.min(0.85, f + (r() - 0.5)*0.6)); return [fw(t, f, 0.3, {sp:170, c:'#7a2a4a'})]; }); }},
  ae_final: {n:'深淵の底', mode:'float', line:'……イッショニ……オチヨウ……', make:(L, r) => [
    J(0, 'dark', {dur:6}),
    ...seq(6, 0.7, (t, i) => [fb(0.5 + t, 0.5, {sp:150, mo:'sine', amp:0.45, fq:2.4, ph:i, c:'#ff3a5a'}), fb(0.85 + t, 0.5, {sp:150, mo:'sine', amp:0.45, fq:2.4, ph:i + Math.PI, c:'#ff3a5a'})]),
  ]},
  // ================= 虚無の騎士：寡黙な剣士 =================
  vk_slash: {n:'虚無の剣技', mode:'jump', line:'――参る。', make:(L, r) => [J(0, 'orb', {lane:'low', sp:260, r:9, sk:'slash', c:'#b48cff'}), J(0.5, 'orb', {lane:'high', sp:260, r:9, sk:'slash', c:'#b48cff'}), J(1.3, 'charge', {}), ...(L >= 1 ? [J(3.0, 'orb', {lane:'low', sp:280, r:9, sk:'slash', c:'#b48cff'})] : [])]},
  vk_blades: {n:'剣の結界', mode:'float', line:'――刃の間を、通れるか。', make:(L, r) =>
    seq(n(5, L, 8), 0.7, (t, i) => [fb(t, 0, {sp:220, sk:'sword', c:'#cfd3e8', r:6}), fb(t, 1, {sp:220, sk:'sword', c:'#cfd3e8', r:6}), fb(t, 0.5, {sp:220, sk:'sword', c:'#cfd3e8', r:6}), fb(t + 0.35, 0.25, {sp:220, sk:'sword', c:'#b48cff', r:6}), fb(t + 0.35, 0.75, {sp:220, sk:'sword', c:'#b48cff', r:6})])},
  vk_judge: {n:'裁きの剣', mode:'jump', line:'――終わりだ。', make:(L, r) => [...seq(3, 0.6, t => [J(t, 'drop', {tele:0.5, r:6, sk:'sword', c:'#cfd3e8'})]), J(2.0, 'meteor', {c:'#b48cff'})]},
  vk_final: {n:'虚無断ち', mode:'float', line:'――虚無に、還れ。', make:(L, r) => [
    fl(0, 0, 0.45, {tele:0.7, dur:0.5}), fl(1.2, 0.55, 1, {tele:0.7, dur:0.5}), fl(2.4, 0.25, 0.75, {tele:0.7, dur:0.5}),
    ...seq(4, 0.6, (t, i) => [fw(3.6 + t, i % 2 ? 0.2 : 0.8, 0.28, {sp:190, c:'#3a2a6a'})]),
  ]},
  // ================= キマイラ：三つの頭がけんか =================
  ch_three: {n:'三つ首の連携', mode:'jump', line:'ガウ！メェ〜！シャー！', make:(L, r) => [...seq(3, 0.3, t => [J(t, 'orb', {lane:'low', sp:240, r:7, sk:'fire'})]), J(1.4, 'wall', {h:40, sp:280, c:'#e8dcc0'}), J(2.5, 'split', {sp:190, c:'#7fcf6a'})]},
  ch_venom: {n:'毒の霧', mode:'float', line:'シャー……毒の中で踊れ……', make:(L, r) =>
    seq(n(5, L, 7), 0.8, (t, i) => { const ph = i*1.4 + r(); return [fb(t, 0.25, {sp:130, mo:'sine', amp:0.25, fq:1.3, ph, c:'#7fcf6a', r:9}), fb(t, 0.75, {sp:130, mo:'sine', amp:0.25, fq:1.3, ph:ph + Math.PI, c:'#7fcf6a', r:9})]; })},
  ch_roar: {n:'咆哮', mode:'jump', line:'ガアアアッ！', make:(L, r) => [J(0, 'wave', {sp:280, c:'#ffb070'}), J(0.45, 'wave', {sp:280, c:'#ffb070'}), J(1.0, 'orb', {lane:'high', sp:220, sk:'fire'}), ...(L >= 1 ? [J(1.6, 'charge', {})] : [])]},
  ch_final: {n:'三位一体', mode:'float', line:'ガウ！メェ！シャー！（三つの頭が声をそろえた）', make:(L, r) => [
    ...seq(4, 0.8, (t, i) => [fw(t, [0.3, 0.7, 0.5, 0.2][i], 0.3, {sp:160, c:'#b8784a'})]),
    ...seq(6, 0.35, (t, i) => [fb(3.4 + t, i % 3/2, {sp:200, c:'#ff8a3a', sk:'fire'})]),
  ]},
  // ================= 星喰い：最奥の主、壮大 =================
  sb_fall: {n:'星降らし', mode:'jump', line:'小さき者よ。星の重さを知れ。', make:(L, r) => [J(0, 'meteor', {c:'#ffe9a8'}), J(1.0, 'meteor', {c:'#ffe9a8'}), ...(L >= 1 ? [J(2.0, 'summon', {t:'comet'})] : [])]},
  sb_galaxy: {n:'銀河の渦', mode:'float', line:'宇宙は回る。お前も回れ。', make:(L, r) =>
    seq(n(14, L*3, 22), 0.22, (t, i) => [fb(t, 0.5 + 0.5*Math.sin(i*0.5), {sp:180, c:i % 3 ? '#ffe9a8' : '#b48cff', r:5, sk:'star'})])},
  sb_void: {n:'事象の地平', mode:'float', line:'光さえ、ここからは逃げられぬ。', make:(L, r) => [
    fl(0, 0, 0.25, {tele:0.8, dur:3.2}), fl(0, 0.75, 1, {tele:0.8, dur:3.2}),
    ...seq(n(4, L, 6), 0.55, (t, i) => [fb(1.0 + t, 0.35 + (i % 3)*0.15, {sp:170, c:'#2a2f7a', r:6})]),
  ]},
  sb_final: {n:'終わりの星', mode:'float', line:'すべての星が消える時だ。……見事だ、小さき者よ。', make:(L, r) => [
    J(0, 'dark', {dur:8}),
    ...seq(4, 1.0, (t, i) => [fw(0.3 + t, 0.5, 0, {sp:140, c:i % 2 ? '#ffa53a' : '#4ea3ff', col:i % 2 ? 'orange' : 'blue', full:1})]),
    ...seq(10, 0.3, (t, i) => [fb(4.6 + t, 0.5, {sp:190, mo:'sine', amp:0.45, fq:2.5, ph:i*0.7, c:'#ffe9a8', sk:'star'})]),
  ]},
};

// ボスごとの技の組み合わせ：p1（第1形態：ジャンプ1つ＋浮遊1つ）・p2（第2形態で増える）・fin（HP25%からの大技）
export const BOSS_PAT = {
  kingslime:   {p1:['ks_bounce', 'ks_jelly'],  p2:['ks_rain'],   fin:'ks_final'},
  golem:       {p1:['go_quake', 'go_maze'],    p2:['go_fall'],   fin:'go_final'},
  witch:       {p1:['wi_dance', 'wi_ghost'],   p2:['wi_color'],  fin:'wi_final'},
  dragon:      {p1:['dr_breath', 'dr_wings'],  p2:['dr_wall'],   fin:'dr_final'},
  queenbee:    {p1:['qb_needle', 'qb_comb'],   p2:['qb_dive'],   fin:'qb_final'},
  sandworm:    {p1:['sw_burrow', 'sw_sand'],   p2:['sw_tail'],   fin:'sw_final'},
  treeking:    {p1:['tk_roots', 'tk_leaves'],  p2:['tk_fruit'],  fin:'tk_final'},
  phoenix:     {p1:['ph_rain', 'ph_spiral'],   p2:['ph_ring'],   fin:'ph_final'},
  crystalqueen:{p1:['cq_beam', 'cq_prism'],    p2:['cq_shard'],  fin:'cq_final'},
  pharaoh:     {p1:['pr_disk', 'pr_hiero'],    p2:['pr_curse'],  fin:'pr_final'},
  stormlord:   {p1:['st_volley', 'st_storm'],  p2:['st_strike'], fin:'st_final'},
  abysseye:    {p1:['ae_gaze', 'ae_tears'],    p2:['ae_iris'],   fin:'ae_final'},
  voidknight:  {p1:['vk_slash', 'vk_blades'],  p2:['vk_judge'],  fin:'vk_final'},
  chimera:     {p1:['ch_three', 'ch_venom'],   p2:['ch_roar'],   fin:'ch_final'},
  starbeast:   {p1:['sb_fall', 'sb_galaxy'],   p2:['sb_void'],   fin:'sb_final'},
};

// セリフ：intro（登場）/ p2（第2形態）/ rage（怒り）/ chance（チャンスのとき。息切れ）/ win（倒されたとき）
export const BOSS_LINES = {
  kingslime:   {intro:'ぽよ〜ん。王さまのお通りだよ〜', p2:'ぷんぷん！本気出しちゃうもんね！', rage:'もう怒ったぞ〜！', chance:'ふぅ、ふぅ……', win:'ぽよ……ま、まけた〜……'},
  golem:       {intro:'……侵入者、排除スル。', p2:'……損傷、拡大。出力、最大。', rage:'……排除、排除、排除。', chance:'……冷却中……', win:'……機能……停止……'},
  witch:       {intro:'あら、迷子かしら？遊んであげる。', p2:'やるじゃない。もう少しだけ本気を出すわ。', rage:'いいかげんにしなさい！', chance:'ちょ、ちょっと休憩……', win:'今日はこれくらいにしてあげる……'},
  dragon:      {intro:'我が火山に何用だ、小さき者よ。', p2:'面白い……ならば翼を広げよう！', rage:'許さぬ！！', chance:'ぐっ……息が……', win:'見事……先へ進むがよい……'},
  queenbee:    {intro:'わたくしの花畑に、何の用かしら？', p2:'近衛兵！何をしているの！', rage:'もう許しませんわ！', chance:'はぁ……羽が疲れましたわ……', win:'くっ……覚えていらっしゃい！'},
  sandworm:    {intro:'……ニオイ……エモノ……', p2:'……モット……クイタイ……', rage:'……ガアアア……！', chance:'……ゲップ……', win:'……オナカ……イッパイ……'},
  treeking:    {intro:'若いの……森で騒ぐでない。', p2:'ほう、根性があるのう。', rage:'森の怒りを知れ！', chance:'ふぅ……年には勝てんのう……', win:'よき若者じゃ……森を頼むぞ……'},
  phoenix:     {intro:'あら、燃えるような目をしているのね！', p2:'もっと、もっと熱くなりましょう！', rage:'燃えて、燃えて、燃え尽きなさい！', chance:'少し、火が弱く……', win:'また……灰からよみがえるわ……'},
  crystalqueen:{intro:'わたくしの洞窟に、温かいものはいらないの。', p2:'砕けないなんて……生意気ね。', rage:'凍りつきなさい！今すぐ！', chance:'……ひびが……', win:'わたくしが……砕けるなんて……'},
  pharaoh:     {intro:'千年の眠りを覚ましたのは、貴様か。', p2:'墓守ども、王を守れ！', rage:'不敬なり！！', chance:'む……包帯がほどけ……', win:'千年……ぶりに……負けたか……'},
  stormlord:   {intro:'ガハハ！いい風が吹いてきたな！', p2:'おもしれえ！もっと吹かすぞ！', rage:'嵐だァァ！！', chance:'ぜぇ……風切れだ……', win:'ガハハ……いい勝負だった……！'},
  abysseye:    {intro:'……ミツケタ……', p2:'……マダ……ミテイル……', rage:'……ニガサナイ……', chance:'……マブシイ……', win:'……ミエナク……ナル……'},
  voidknight:  {intro:'――剣を抜け。', p2:'――やるな。', rage:'――全力で行く。', chance:'――隙を見せたか。', win:'――見事。'},
  chimera:     {intro:'ガウ！（右の頭）メェ〜（左の頭）シャー（しっぽ）', p2:'三つの頭がそろってうなった！', rage:'ガアアア！（全員激怒）', chance:'三つの頭がけんかを始めた！', win:'ガウ……メェ……シャー……（仲良く倒れた）'},
  starbeast:   {intro:'よくぞここまで来た。星を喰らう者、我がここにいる。', p2:'その輝き……もっと見せてみよ。', rage:'宇宙が、震えている。', chance:'……星が、まぶしい……', win:'……お前こそが、新しい星だ。'},
};
