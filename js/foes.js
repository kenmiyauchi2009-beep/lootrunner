// 追加の敵（32種）とボス（11体）のデータ。動き（ai）と見た目（look）の組み合わせで作る。
// 動き（run.js の moveGeneric）：
//   walk：歩く / fly：決まった高さを飛ぶ（lane：low＝跳ぶ・mid＝跳ぶと当たる・high＝大ジャンプで当たる）/ hover：上下に漂う
//   hop：ぴょんと跳ねる / charge：止まって「！」→ 突進 / burrow：地中→赤く光って飛び出す / shoot：止まって弾を撃つ
//   swoop：高く飛び、「！」のあと低く急降下 / roll：速く転がる / phase：ときどき透ける（当たらない・狙えない）
//   summon：小さいスライムを呼ぶ / lob：岩を投げる / heal：周りを回復 / statue：近づくと動き出して突進
// 特性（traits）：spiky＝踏めない / armor＝スキルが半分しか効かない / regen＝HPが回復 / guard＝地上からの装備の攻撃を防ぐ
//   split＝倒すと分かれる / gold＝ゴールドが多い
// 見た目（look）：shape と色（c・c2）。描き方は foeart.js
export const FOES2 = {
  // ---- 通常の難易度3から（エリアごと） ----
  bee:        {n:'針蜂',       hp:12, dmg:9,  w:18, h:14, gold:4, sp:95, xp:2, ai:'fly', lane:'low', look:{shape:'insect', c:'#ffc83a', c2:'#2a2218', wing:1}, hint:'針蜂：低く速く飛んでくる。跳んで越える'},
  shroom:     {n:'胞子きのこ', hp:28, dmg:8,  w:22, h:24, gold:5, sp:0,  xp:3, ai:'shoot', pat:'low', rate:2.6, look:{shape:'mushroom', c:'#e0584a', c2:'#f3ead2'}, hint:'胞子きのこ：低い胞子を飛ばす。跳んでかわす'},
  hornrabbit: {n:'角ウサギ',   hp:18, dmg:11, w:20, h:18, gold:4, sp:0,  xp:3, ai:'hop', hopV:380, hopVx:170, every:0.7, look:{shape:'beast', c:'#e8e2d8', c2:'#ffb0b8', horn:1}, hint:'角ウサギ：高く跳ねて来る。着地を踏むか、下をくぐる'},
  scorpion:   {n:'サソリ',     hp:30, dmg:13, w:26, h:16, gold:5, sp:40, xp:3, ai:'walk', traits:['spiky'], look:{shape:'insect', c:'#c8783a', c2:'#6a3a1a', tail:1}, hint:'サソリ：毒針で踏めない。跳び越えるか倒す'},
  vulture:    {n:'ハゲワシ',   hp:22, dmg:12, w:26, h:16, gold:5, sp:50, xp:3, ai:'swoop', look:{shape:'bird', c:'#6a4a3a', c2:'#e8d8c8'}, hint:'ハゲワシ：「！」のあと低く急降下する。跳んで越える'},
  cactus:     {n:'歩くサボテン', hp:60, dmg:12, w:22, h:30, gold:6, sp:20, xp:4, ai:'walk', traits:['spiky'], look:{shape:'cactus', c:'#5f9a4a', c2:'#ffb0d0'}, hint:'歩くサボテン：トゲで踏めない。硬いので早めに崩す'},
  owl:        {n:'夜フクロウ', hp:20, dmg:9,  w:22, h:20, gold:5, sp:30, xp:3, ai:'shoot', fly:'high', pat:'low', rate:2.2, look:{shape:'bird', c:'#7a6a9a', c2:'#ffd36b', owl:1}, hint:'夜フクロウ：高いところから低い羽根を撃つ。跳んでかわす'},
  wolf:       {n:'影オオカミ', hp:30, dmg:15, w:30, h:20, gold:5, sp:30, xp:4, ai:'charge', tele:0.45, cs:300, look:{shape:'beast', c:'#3a3a5a', c2:'#ff4a6a'}, hint:'影オオカミ：すぐに突進してくる。跳んで越える'},
  treant:     {n:'歩く木',     hp:80, dmg:12, w:30, h:40, gold:7, sp:16, xp:5, ai:'walk', traits:['armor'], look:{shape:'tree', c:'#6a4a2a', c2:'#3f7a4a'}, hint:'歩く木：スキルが半分しか効かない。装備の攻撃で削る'},
  salamander: {n:'火トカゲ',   hp:24, dmg:12, w:28, h:12, gold:5, sp:55, xp:3, ai:'walk', traits:['boom'], look:{shape:'lizard', c:'#ff6a2a', c2:'#ffd36b'}, hint:'火トカゲ：倒すと爆発して周りの敵を巻き込む'},
  magmaball:  {n:'溶岩玉',     hp:26, dmg:14, w:20, h:20, gold:5, sp:0,  xp:3, ai:'hop', hopV:300, hopVx:150, every:0.5, traits:['spiky'], look:{shape:'orb', c:'#ff5a1a', c2:'#ffd36b', fire:1}, hint:'溶岩玉：跳ねながら来る。熱くて踏めない'},
  imp:        {n:'小悪魔',     hp:20, dmg:10, w:18, h:20, gold:5, sp:30, xp:3, ai:'shoot', fly:'hover', pat:'alt', rate:2.0, look:{shape:'imp', c:'#c83a4a', c2:'#ffd36b'}, hint:'小悪魔：漂いながら弾を撃つ。赤い線＝跳ぶ／青い線＝跳ばない'},
  // ---- 深層：結晶の洞窟 ----
  crystalbug: {n:'結晶虫',     hp:34, dmg:12, w:24, h:16, gold:6, sp:35, xp:3, ai:'walk', traits:['armor'], look:{shape:'insect', c:'#9a7aff', c2:'#e8dcff', crystal:1}, hint:'結晶虫：スキルが半分しか効かない'},
  shardbat:   {n:'結晶コウモリ', hp:14, dmg:10, w:22, h:14, gold:4, sp:110, xp:2, ai:'fly', lane:'rand', look:{shape:'bird', c:'#b48cff', c2:'#ffffff', bat:1}, hint:'結晶コウモリ：とても速い。低いものは跳び、高いものはくぐる'},
  gemgolem:   {n:'宝石ゴーレム', hp:110, dmg:14, w:30, h:34, gold:30, sp:18, xp:6, ai:'walk', traits:['gold'], look:{shape:'golem', c:'#7a6aa0', c2:'#ff6ad0'}, hint:'宝石ゴーレム：硬いが、倒すとゴールドがたくさん'},
  mirror:     {n:'鏡の精',     hp:24, dmg:11, w:20, h:26, gold:5, sp:40, xp:3, ai:'phase', look:{shape:'crystal', c:'#cfe8ff', c2:'#8fb8ff'}, hint:'鏡の精：ときどき透けて、攻撃が当たらない（向こうも当たらない）'},
  // ---- 深層：古代の遺跡 ----
  mummy:      {n:'ミイラ',     hp:50, dmg:13, w:22, h:30, gold:6, sp:25, xp:4, ai:'walk', traits:['regen'], look:{shape:'humanoid', c:'#e8dcb8', c2:'#7a6a4a', wrap:1}, hint:'ミイラ：HPが回復していく。一気に倒す'},
  scarab:     {n:'スカラベ',   hp:20, dmg:12, w:18, h:14, gold:5, sp:120, xp:3, ai:'roll', traits:['spiky'], look:{shape:'insect', c:'#2a8a7a', c2:'#ffd36b'}, hint:'スカラベ：速く転がってくる。踏めない'},
  statue:     {n:'動く石像',   hp:70, dmg:16, w:24, h:34, gold:7, sp:0,  xp:5, ai:'statue', look:{shape:'humanoid', c:'#a89a80', c2:'#5a5040', stone:1}, hint:'動く石像：近づくと動き出して突進する。跳んで越える'},
  sandwraith: {n:'砂の亡霊',   hp:28, dmg:13, w:22, h:22, gold:5, sp:45, xp:3, ai:'burrow', look:{shape:'ghost', c:'#d8b878', c2:'#7a5a30'}, hint:'砂の亡霊：砂に潜って近づき、光ったら飛び出す。跳ぶ'},
  // ---- 深層：天空の島 ----
  harpy:      {n:'ハーピー',   hp:26, dmg:13, w:24, h:22, gold:5, sp:55, xp:3, ai:'swoop', look:{shape:'bird', c:'#8fd0a8', c2:'#f6d2a8', harpy:1}, hint:'ハーピー：「！」のあと急降下する。跳んで越える'},
  cloudling:  {n:'雲の子',     hp:30, dmg:9,  w:26, h:18, gold:5, sp:30, xp:3, ai:'hover', lo:6, hi:70, traits:['split'], split:'puff', look:{shape:'cloud', c:'#ffffff', c2:'#9fc8e8'}, hint:'雲の子：倒すと2つに分かれる'},
  puff:       {n:'ちび雲',     hp:10, dmg:7,  w:16, h:12, gold:1, sp:50, xp:1, ai:'hover', lo:4, hi:40, look:{shape:'cloud', c:'#f0f8ff', c2:'#bfdcf0'}, hint:'ちび雲：小さな雲。低いときだけ跳ぶ'},
  thunderbird:{n:'雷鳥',       hp:24, dmg:11, w:26, h:18, gold:6, sp:35, xp:4, ai:'shoot', fly:'high', pat:'low', rate:1.8, look:{shape:'bird', c:'#ffe14d', c2:'#3a5aff'}, hint:'雷鳥：高いところから低い雷を撃つ。跳んでかわす'},
  windspirit: {n:'風の精',     hp:16, dmg:10, w:20, h:16, gold:4, sp:100, xp:2, ai:'fly', lane:'mid', look:{shape:'wisp', c:'#bfffe8', c2:'#5ad0a0'}, hint:'風の精：頭の高さを飛ぶ。跳ぶと当たるので、地上でやり過ごす'},
  // ---- 深層：深淵 ----
  shade:      {n:'影',         hp:26, dmg:13, w:20, h:28, gold:5, sp:50, xp:3, ai:'phase', look:{shape:'ghost', c:'#2a1a3a', c2:'#ff3a5a'}, hint:'影：ときどき闇に溶けて、攻撃が当たらない'},
  eyeball:    {n:'浮かぶ目',   hp:30, dmg:11, w:22, h:22, gold:6, sp:25, xp:4, ai:'shoot', fly:'hover', pat:'rand', rate:1.9, look:{shape:'eye', c:'#f3ead2', c2:'#c83a4a'}, hint:'浮かぶ目：低い弾か高い弾を撃つ。線の色を見る'},
  skullknight:{n:'骸骨騎士',   hp:60, dmg:15, w:24, h:32, gold:7, sp:28, xp:5, ai:'walk', traits:['guard', 'armor'], look:{shape:'humanoid', c:'#d8d8c8', c2:'#4a4a6a', skull:1, shield:1}, hint:'骸骨騎士：盾で地上からの攻撃を防ぎ、スキルも効きにくい。踏むか空中から'},
  crawler:    {n:'這うもの',   hp:32, dmg:14, w:28, h:14, gold:5, sp:70, xp:3, ai:'burrow', look:{shape:'lizard', c:'#3a1a2a', c2:'#ff3a5a'}, hint:'這うもの：地中を速く進み、光ったら飛び出す。跳ぶ'},
  // ---- 深層：星の海 ----
  meteorite:  {n:'流れ星',     hp:20, dmg:14, w:20, h:16, gold:5, sp:80, xp:3, ai:'swoop', look:{shape:'star', c:'#ffe9a8', c2:'#ff8a3a'}, hint:'流れ星：「！」のあと急降下する。跳んで越える'},
  nebula:     {n:'星雲の子',   hp:40, dmg:9,  w:28, h:24, gold:7, sp:22, xp:4, ai:'summon', look:{shape:'cloud', c:'#8a5ad0', c2:'#ffb0e8', star:1}, hint:'星雲の子：小さいスライムを呼び続ける。先に倒す'},
  comet:      {n:'彗星',       hp:24, dmg:15, w:20, h:20, gold:5, sp:160, xp:3, ai:'roll', traits:['spiky'], look:{shape:'orb', c:'#9fd8ff', c2:'#ffffff', tailFx:1}, hint:'彗星：とても速く転がる。踏めない。跳び越える'},
  voidmage:   {n:'虚無の魔導士', hp:34, dmg:12, w:20, h:30, gold:7, sp:25, xp:4, ai:'lob', look:{shape:'humanoid', c:'#3a2a6a', c2:'#b48cff', hood:1}, hint:'虚無の魔導士：岩を投げる。転がってきたら跳ぶ'},
};

// 通常の難易度3から、エリアごとに混ざる敵（[重み, 出始める距離（エリアの頭から）]）
export const ZONE_FOES3 = [
  {bee:[12, 60], shroom:[10, 100], hornrabbit:[10, 150]},
  {scorpion:[12, 60], vulture:[10, 100], cactus:[8, 150]},
  {owl:[10, 60], wolf:[12, 100], treant:[8, 150]},
  {salamander:[12, 60], magmaball:[10, 100], imp:[10, 150]},
];
// 深層のエリアごとに足す敵
export const DEEP_FOES2 = [
  {crystalbug:[14, 0], shardbat:[12, 0], gemgolem:[5, 200], mirror:[10, 100], bee:[6, 0], shroom:[6, 0]},
  {mummy:[12, 0], scarab:[12, 0], statue:[8, 100], sandwraith:[10, 0], scorpion:[8, 0], cactus:[6, 0]},
  {harpy:[12, 0], cloudling:[10, 0], thunderbird:[10, 100], windspirit:[10, 0], owl:[6, 0], hornrabbit:[6, 0]},
  {shade:[12, 0], eyeball:[10, 0], skullknight:[8, 100], crawler:[10, 0], wolf:[8, 0], imp:[6, 0]},
  {meteorite:[12, 0], nebula:[8, 100], comet:[10, 0], voidmage:[10, 0], magmaball:[6, 0], salamander:[6, 0]},
];

// ---- 追加のボス（11体） ----
// 技はボスごとに専用（bossatk.js の BOSS_SET）
// shape・c・c2：見た目（foeart.js の drawBossGeneric）
export const BOSSES2 = {
  queenbee:    {n:'女王蜂',       w:50, h:46, fly:24, shape:'queen',   c:'#ffc83a', c2:'#2a2218', sum:['bee', 'bee'], hint:'女王蜂：針蜂を呼ぶ。突進は長押しで越える'},
  sandworm:    {n:'大砂虫',       w:64, h:64, shape:'worm',    c:'#c89a5a', c2:'#7a4a2a', hint:'大砂虫：衝撃波が3回続くことがある。リズムよく跳ぶ'},
  treeking:    {n:'森の古木',     w:66, h:80, shape:'treeboss', c:'#6a4a2a', c2:'#3f7a4a', sum:['owl', 'treant'], hint:'森の古木：足元から根（光ったら跳ぶ）。仲間を呼ぶ'},
  phoenix:     {n:'不死鳥',       w:60, h:50, fly:30, shape:'phoenix', c:'#ff7a2a', c2:'#ffe14d', hint:'不死鳥：火の玉と火柱。光線は高さを見る'},
  crystalqueen:{n:'結晶の女王',   w:44, h:64, fly:10, shape:'crystalq', c:'#b48cff', c2:'#e8dcff', sum:['shardbat', 'shardbat'], hint:'結晶の女王：光線と弾。結晶コウモリを呼ぶ'},
  pharaoh:     {n:'ファラオ',     w:46, h:70, shape:'pharaoh', c:'#ffd36b', c2:'#2a6a8a', sum:['mummy', 'scarab'], hint:'ファラオ：大岩と光線。ミイラを呼ぶ'},
  stormlord:   {n:'嵐の王',       w:58, h:52, fly:26, shape:'storm',   c:'#6a7aa0', c2:'#ffe14d', hint:'嵐の王：弾を速く撃ち分ける。赤＝跳ぶ／青＝跳ばない'},
  abysseye:    {n:'深淵の瞳',     w:56, h:56, fly:20, shape:'bigeye',  c:'#f3ead2', c2:'#c83a4a', sum:['shade', 'eyeball'], hint:'深淵の瞳：光線と弾を撃ち分ける。影を呼ぶ'},
  voidknight:  {n:'虚無の騎士',   w:44, h:72, shape:'knight',  c:'#3a2a6a', c2:'#b48cff', hint:'虚無の騎士：突進と衝撃波。結界はいつも通り武器で割る'},
  chimera:     {n:'キマイラ',     w:68, h:60, shape:'chimera', c:'#b8784a', c2:'#5a8a4a', hint:'キマイラ：火の玉・突進・衝撃波を使い分ける'},
  starbeast:   {n:'星喰い',       w:72, h:66, shape:'starbeast', c:'#2a2f7a', c2:'#ffe9a8', sum:['meteorite', 'comet'], hint:'星喰い：深層の最奥の主。あらゆる攻撃を使う'},
};
// 通常の難易度3からのボス（エリアごと）
export const ZONE_BOSS3 = ['queenbee', 'sandworm', 'treeking', 'phoenix'];
// 深層のエリアごとのボス（500m ごとに順に。最後の10000m は星喰い）
export const DEEP_BOSSES = [
  ['crystalqueen', 'golem', 'queenbee', 'kingslime'],
  ['pharaoh', 'sandworm', 'golem', 'dragon'],
  ['stormlord', 'phoenix', 'witch', 'queenbee'],
  ['abysseye', 'voidknight', 'treeking', 'witch'],
  ['chimera', 'voidknight', 'phoenix', 'starbeast'],
];
