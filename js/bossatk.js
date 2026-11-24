// ボスの技（ボスごとに専用。同じ技を別のボスは使わない）
// 技：{n：技名（予告のときにボスの上に出る）, tele：予告の秒数, seq：[[何秒後, 動き, 中身]...]}
// 動き（run.js の bossAct）：
//   wave：地面を走る衝撃波（跳ぶ）       {sp：速さ, h：高さ, w：幅, c：色}
//   orb：まっすぐ飛ぶ弾                  {lane：low（跳ぶ）/ high（跳ばない）/ alt（交互）/ rand, sp, r, sk：形, c}
//   zig：上下にジグザグする弾。予告の点線が通り道（主人公のところで赤＝下：跳ぶ／青＝上：跳ばない） {sp, c}
//   homing：主人公の高さを追いかけ、近くで高さが決まる弾（決まる瞬間に跳んでいれば、着地してくぐれる） {sp, c}
//   bounce：地面を跳ねて来る玉（低いときに跳ぶ） {sp, vy, r, c}
//   drop：足もとに輪が出て、空から落ちてくる（地面に落ちる瞬間に跳んでいればかわせる） {tele, r, sk, c}
//   pillar：足もとが光って噴き出す（跳ぶ） {c}
//   beam：出続ける光線 {lane, dur}
//   wall：背の高い壁が迫る（長押しで高く跳ぶ） {h, sp, c}
//   charge：体ごと突進（長押しで高く跳ぶ） / dive：飛ぶボスが低く急降下して突っ込む
//   summon：手下を呼ぶ {t：敵の種類}
//   lob：岩を投げる（転がってきたら跳ぶ） / boulder：大岩が転がる {sp, r}
//   spin：ブーメラン（往きは低い＝跳ぶ／帰りは高い＝跳ばない） {sp, c}
//   split：途中で低い弾2つに分かれる（2回跳ぶ） {sp, c}
//   descend：高いところから降りてくる弾（近くで低くなる。遅めに跳ぶ） {sp, c}
//   meteor：前に隕石が落ちて、衝撃波が来る（跳ぶ） {c}
//   dark：しばらく周りが暗くなる {dur}
const W = (at, o = {}) => [at, 'wave', o];
const O = (at, lane, o = {}) => [at, 'orb', {lane, ...o}];
const rep = (n, gap, f) => Array.from({length:n}, (_, i) => f(i*gap, i));

export const BOSS_ATK = {
  // ---- キングスライム ----
  ks_hop:     {n:'のしかかり',     tele:0.8,  seq:[W(0, {c:'#7fd86a'})]},
  ks_spit:    {n:'吐き出し',       tele:0.6,  seq:rep(3, 0.35, at => [at, 'summon', {t:'mini'}])},
  ks_bighop:  {n:'大のしかかり',   tele:0.85, seq:[W(0, {c:'#7fd86a'}), W(0.55, {c:'#7fd86a'})]},
  ks_blob:    {n:'ぷるぷる弾',     tele:0.7,  seq:rep(3, 0.6, at => [at, 'bounce', {sp:150, vy:200, r:9, c:'#8fe36a'}])},
  // ---- 岩石ゴーレム ----
  go_rocks:   {n:'投石',           tele:0.8,  seq:rep(3, 0.62, at => [at, 'lob', {}])},
  go_crack:   {n:'地割れ',         tele:0.85, seq:[W(0, {sp:150, h:30, w:22, c:'#b0865a'})]},
  go_boulder: {n:'大岩',           tele:0.9,  seq:[[0, 'boulder', {sp:150, r:13}]]},
  go_fall:    {n:'落石',           tele:0.7,  seq:rep(3, 0.6, at => [at, 'drop', {tele:0.55, r:11, sk:'rock', c:'#8b8378'}])},
  // ---- 森の魔女 ----
  wi_orbs:    {n:'魔弾',           tele:0.75, seq:rep(3, 0.6, at => O(at, 'rand', {c:'#c58bff'}))},
  wi_ghost:   {n:'霊呼び',         tele:0.6,  seq:[[0, 'summon', {t:'ghost'}], [0.5, 'summon', {t:'ghost'}]]},
  wi_curse:   {n:'呪いの追尾弾',   tele:0.75, seq:rep(2, 1.0, at => [at, 'homing', {sp:120, c:'#9a4aff'}])},
  wi_fall:    {n:'星降りの魔弾',   tele:0.7,  seq:rep(3, 0.55, at => [at, 'descend', {sp:170, c:'#ff8adf'}])},
  // ---- 炎竜 ----
  dr_pillar:  {n:'火柱',           tele:0.45, seq:rep(2, 0.7, at => [at, 'pillar', {}])},
  dr_breath:  {n:'火の玉',         tele:0.7,  seq:rep(2, 0.5, at => O(at, 'low', {sp:220, r:8, sk:'fire'}))},
  dr_wall:    {n:'炎の壁',         tele:0.9,  seq:[[0, 'wall', {h:64, sp:170, c:'#ff7a2a'}]]},
  dr_meteor:  {n:'竜星落とし',     tele:0.8,  seq:[[0, 'meteor', {c:'#ff6a2a'}]]},
  // ---- 女王蜂 ----
  qb_needle:  {n:'針の雨',         tele:0.6,  seq:rep(4, 0.6, at => [at, 'drop', {tele:0.45, r:5, sk:'needle', c:'#ffe14d'}])},
  qb_guard:   {n:'近衛兵',         tele:0.6,  seq:[[0, 'summon', {t:'bee'}], [0.4, 'summon', {t:'bee'}]]},
  qb_dive:    {n:'女王の急降下',   tele:0.9,  seq:[[0, 'dive', {}]]},
  qb_burst:   {n:'毒針の連射',     tele:0.75, seq:rep(5, 0.5, at => O(at, 'alt', {sp:210, r:5, sk:'needle', c:'#c8ff4a'}))},
  // ---- 大砂虫 ----
  sw_burrow:  {n:'地中からの一撃', tele:0.6,  seq:[[0, 'pillar', {c:'#d8a860', big:1}]]},
  sw_waves:   {n:'砂の大波',       tele:0.85, seq:rep(3, 0.62, at => W(at, {sp:200, h:20, c:'#e8c878'}))},
  sw_tail:    {n:'尾の薙ぎ払い',   tele:0.8,  seq:rep(2, 0.85, at => [at, 'wall', {h:28, sp:230, c:'#a87848'}])},
  sw_spit:    {n:'砂の吐息',       tele:0.7,  seq:rep(2, 0.9, at => [at, 'split', {sp:170, c:'#e8c878'}])},
  // ---- 森の古木 ----
  tk_roots:   {n:'根の突き上げ',   tele:0.5,  seq:rep(3, 0.6, at => [at, 'pillar', {c:'#6a4a2a', root:1}])},
  tk_leaves:  {n:'木の葉の舞',     tele:0.7,  seq:rep(3, 0.55, at => [at, 'zig', {sp:150, c:'#5fae4e'}])},
  tk_call:    {n:'森の仲間',       tele:0.6,  seq:[[0, 'summon', {t:'owl'}], [0.6, 'summon', {t:'treant'}]]},
  tk_fruit:   {n:'大きな実',       tele:0.7,  seq:rep(2, 0.8, at => [at, 'bounce', {sp:120, vy:220, r:11, c:'#e0584a'}])},
  // ---- 不死鳥 ----
  ph_rain:    {n:'火の雨',         tele:0.6,  seq:rep(4, 0.6, at => [at, 'drop', {tele:0.4, r:7, sk:'fire', c:'#ff8a3a'}])},
  ph_feather: {n:'炎の羽根',       tele:0.7,  seq:[O(0, 'high', {sp:190, sk:'feather', c:'#ffb347'}), O(0.45, 'low', {sp:190, sk:'feather', c:'#ffb347'}), O(0.9, 'high', {sp:190, sk:'feather', c:'#ffb347'})]},
  ph_spin:    {n:'炎の輪',         tele:0.8,  seq:[[0, 'spin', {sp:230, c:'#ff7a2a'}]]},
  ph_nova:    {n:'転生の炎',       tele:0.85, seq:[W(0, {sp:260, c:'#ffd36b'}), O(0.55, 'high', {sp:200, r:9, sk:'fire'})]},
  // ---- 結晶の女王 ----
  cq_beam:    {n:'結晶の光線',     tele:0.85, seq:[[0, 'beam', {lane:'rand'}]]},
  cq_shards:  {n:'結晶のつぶて',   tele:0.7,  seq:rep(3, 0.5, at => O(at, 'rand', {sp:240, r:6, sk:'crystal', c:'#c8a6ff'}))},
  cq_bats:    {n:'結晶の眷属',     tele:0.6,  seq:[[0, 'summon', {t:'shardbat'}], [0.4, 'summon', {t:'shardbat'}]]},
  cq_twin:    {n:'双晶の光線',     tele:0.85, seq:[[0, 'beam', {lane:'low'}], [1.0, 'beam', {lane:'high'}]]},
  // ---- ファラオ ----
  pr_call:    {n:'王の墓守',       tele:0.6,  seq:[[0, 'summon', {t:'mummy'}], [0.5, 'summon', {t:'scarab'}]]},
  pr_disk:    {n:'太陽の円盤',     tele:0.8,  seq:[[0, 'spin', {sp:200, c:'#ffd36b', sk:'disk'}]]},
  pr_scarab:  {n:'スカラベの群れ', tele:0.7,  seq:rep(4, 0.55, at => [at, 'bounce', {sp:190, vy:160, r:6, c:'#2a8a7a'}])},
  pr_coffin:  {n:'呪いの棺',       tele:0.9,  seq:[[0, 'wall', {h:62, sp:150, c:'#c8a050'}]]},
  // ---- 嵐の王 ----
  st_volley:  {n:'雷の連射',       tele:0.8,  seq:rep(5, 0.5, at => O(at, 'alt', {sp:200, sk:'bolt', c:'#ffe14d'}))},
  st_strike:  {n:'落雷',           tele:0.6,  seq:rep(3, 0.6, at => [at, 'drop', {tele:0.5, r:8, sk:'bolt', c:'#fff27a'}])},
  st_tornado: {n:'竜巻',           tele:0.75, seq:rep(2, 0.9, at => [at, 'zig', {sp:130, c:'#cfe8ff', big:1}])},
  st_dark:    {n:'嵐の闇',         tele:0.7,  seq:[[0, 'dark', {dur:3.5}], ...rep(3, 0.7, (at, i) => O(0.6 + at, i % 2 ? 'high' : 'low', {sp:180, sk:'bolt', c:'#ffe14d'}))]},
  // ---- 深淵の瞳 ----
  ae_gaze:    {n:'凝視',           tele:0.7,  seq:rep(2, 0.9, at => [at, 'homing', {sp:150, c:'#ff3a5a'}])},
  ae_tent:    {n:'触手',           tele:0.5,  seq:rep(2, 0.55, at => [at, 'pillar', {c:'#7a2a4a', tent:1}])},
  ae_shades:  {n:'影の召喚',       tele:0.6,  seq:[[0, 'summon', {t:'shade'}], [0.5, 'summon', {t:'eyeball'}]]},
  ae_dark:    {n:'深淵の闇',       tele:0.8,  seq:[[0, 'dark', {dur:4}], ...rep(3, 0.65, at => [0.6 + at, 'descend', {sp:190, c:'#ff3a5a'}])]},
  // ---- 虚無の騎士 ----
  vk_charge:  {n:'突撃',           tele:0.95, seq:[[0, 'charge', {}]]},
  vk_slash:   {n:'虚無の斬撃',     tele:0.75, seq:[O(0, 'low', {sp:260, r:9, sk:'slash', c:'#b48cff'}), O(0.5, 'high', {sp:260, r:9, sk:'slash', c:'#b48cff'})]},
  vk_swords:  {n:'幻影剣',         tele:0.7,  seq:rep(3, 0.6, at => [at, 'drop', {tele:0.5, r:6, sk:'sword', c:'#cfd3e8'}])},
  vk_break:   {n:'大地割り',       tele:0.9,  seq:[[0, 'meteor', {c:'#b48cff'}], W(0.9, {sp:220, h:26, c:'#b48cff'})]},
  // ---- キマイラ ----
  ch_breath:  {n:'三つ首の炎',     tele:0.7,  seq:rep(3, 0.3, at => O(at, 'low', {sp:240, r:7, sk:'fire'}))},
  ch_ram:     {n:'山羊の頭突き',   tele:0.8,  seq:[[0, 'wall', {h:40, sp:280, c:'#e8dcc0'}]]},
  ch_venom:   {n:'蛇の毒',         tele:0.7,  seq:rep(2, 0.8, at => [at, 'split', {sp:190, c:'#7fcf6a'}])},
  ch_roar:    {n:'咆哮',           tele:0.8,  seq:[W(0, {sp:280, c:'#ffb070'}), W(0.45, {sp:280, c:'#ffb070'}), O(1.0, 'high', {sp:220, sk:'fire'})]},
  // ---- 星喰い ----
  sb_fall:    {n:'星降らし',       tele:0.8,  seq:[[0, 'meteor', {c:'#ffe9a8'}], [1.0, 'meteor', {c:'#ffe9a8'}]]},
  sb_comet:   {n:'彗星の群れ',     tele:0.6,  seq:[[0, 'summon', {t:'comet'}], [0.5, 'summon', {t:'meteorite'}]]},
  sb_void:    {n:'星の渦',         tele:0.8,  seq:rep(3, 0.6, at => [at, 'zig', {sp:170, c:'#b48cff', big:1}])},
  sb_nova:    {n:'超新星',         tele:1.0,  seq:[[0, 'dark', {dur:3.5}], ...rep(3, 1.0, at => [0.5 + at, 'spin', {sp:260, c:'#ffe9a8', sk:'star'}])]},
};

// ボスごとの技（p1：第1形態 / p2：第2形態で増える技）
export const BOSS_SET = {
  kingslime:   {p1:['ks_hop', 'ks_spit'],     p2:['ks_bighop', 'ks_blob']},
  golem:       {p1:['go_rocks', 'go_crack'],  p2:['go_boulder', 'go_fall']},
  witch:       {p1:['wi_orbs', 'wi_ghost'],   p2:['wi_curse', 'wi_fall']},
  dragon:      {p1:['dr_pillar', 'dr_breath'], p2:['dr_wall', 'dr_meteor']},
  queenbee:    {p1:['qb_needle', 'qb_guard'], p2:['qb_dive', 'qb_burst']},
  sandworm:    {p1:['sw_burrow', 'sw_waves'], p2:['sw_tail', 'sw_spit']},
  treeking:    {p1:['tk_roots', 'tk_leaves'], p2:['tk_call', 'tk_fruit']},
  phoenix:     {p1:['ph_rain', 'ph_feather'], p2:['ph_spin', 'ph_nova']},
  crystalqueen:{p1:['cq_beam', 'cq_shards'],  p2:['cq_bats', 'cq_twin']},
  pharaoh:     {p1:['pr_call', 'pr_disk'],    p2:['pr_scarab', 'pr_coffin']},
  stormlord:   {p1:['st_volley', 'st_strike'], p2:['st_tornado', 'st_dark']},
  abysseye:    {p1:['ae_gaze', 'ae_tent'],    p2:['ae_shades', 'ae_dark']},
  voidknight:  {p1:['vk_charge', 'vk_slash'], p2:['vk_swords', 'vk_break']},
  chimera:     {p1:['ch_breath', 'ch_ram'],   p2:['ch_venom', 'ch_roar']},
  starbeast:   {p1:['sb_fall', 'sb_comet'],   p2:['sb_void', 'sb_nova']},
};
// 説明（ボスの初めての説明・図鑑に使う）
export const BOSS_TIPS = {
  kingslime:'のしかかり（衝撃波）は跳ぶ。第2形態は跳ねる弾も',
  golem:'投げた岩は転がってから跳ぶ。地割れはゆっくり大きい',
  witch:'低い弾は跳び、高い弾はくぐる。追尾弾は跳んで落ちる途中でかわす',
  dragon:'足元が光ったら火柱。炎の壁は長押しで高く跳ぶ',
  queenbee:'針の雨は足元の輪を見て跳ぶ。急降下は長押しで越える',
  sandworm:'足元から飛び出す。分かれる砂の吐息は2回跳ぶ',
  treeking:'根は3回続けて突き上げる。木の葉はジグザグ',
  phoenix:'火の雨はリズムよく跳ぶ。炎の輪は往きが低く、帰りが高い',
  crystalqueen:'光線は線の色を見る。双晶は低い→高いの順',
  pharaoh:'太陽の円盤は往きが低く帰りが高い。棺は高く跳ぶ',
  stormlord:'雷の連射は赤＝跳ぶ／青＝跳ばない。嵐の闇では弾の線を見る',
  abysseye:'凝視の弾は追いかけてくる。闇の中で降りてくる弾に注意',
  voidknight:'突撃は長押しで越える。斬撃は低い→高いの順',
  chimera:'三つ首の炎は3連。頭突きは高い壁。蛇の毒は分かれた2つを長く跳んでまとめて越える',
  starbeast:'星降らしの衝撃波は2回。超新星は闇の中のブーメラン',
};
