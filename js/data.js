// 装備・冒険のデータ定義
export const RAR = [
  {n:'コモン',     c:'#c9d3d6'},
  {n:'アンコモン', c:'#5fd17a'},
  {n:'レア',       c:'#4ea3ff'},
  {n:'エピック',   c:'#c07cff'},
  {n:'レジェンド', c:'#ffa53a'},
];
// 武器種。targets：1回の攻撃で当たる数（近接）。crit/critdmg：武器そのものの会心
export const WTYPES = {
  sword: {n:'剣',   names:['ショートソード','ブロードソード','ルーンブレード','竜牙の剣'], mult:1.3,  interval:0.55, range:80, targets:3, melee:1},
  axe:   {n:'斧',   names:['手斧','戦斧','双刃斧','巨人の斧'],                         mult:2.0,  interval:0.95, range:95, targets:5, melee:1},
  dagger:{n:'短剣', names:['ナイフ','ダガー','スティレット','月影の刃'],               mult:0.62, interval:0.30, range:58, targets:1, melee:1, crit:10, critdmg:25},
  bow:   {n:'弓',   names:['ショートボウ','ロングボウ','風切りの弓','天穹の弓'],         mult:1.5,  interval:0.70},
  staff: {n:'杖',   names:['ワンド','スタッフ','アークスタッフ','星詠みの杖'],           mult:1.6,  interval:0.90},
};
export const BASE_NAMES = {
  head: ['革の帽子','鉄の兜','鋼の兜','竜角の兜'],
  body: ['革の鎧','鎖帷子','鋼の鎧','竜鱗の鎧'],
  charm:['護符','指輪','首飾り','宝珠'],
};
// 装備枠（装飾は2つ）
export const EQUIP_SLOTS = ['weapon','head','body','charm1','charm2'];
export const slotOfKey = k => k.startsWith('charm') ? 'charm' : k;
export const SLOT_N = {weapon:'武器', head:'頭', body:'胴', charm:'装飾', charm1:'装飾1', charm2:'装飾2'};
export const ICON = {sword:'剣', axe:'斧', dagger:'短', bow:'弓', staff:'杖', head:'兜', body:'鎧', charm:'飾'};

// 付与効果（厳選の対象）。min〜max を5つの階級（T1〜T5）に分け、アイテムLvが高いほど上位の階級が出やすい
//   pct：%表示 / scale：アイテムLvで値が伸びる / int：整数 / dec：小数の桁 / cond：条件付き（説明を出す）
export const AFFIX = {
  atk:      {n:'攻撃力',             min:5,   max:30,  pct:1, slots:['weapon','charm'], pre:'鋭い'},
  aspd:     {n:'攻撃速度',           min:5,   max:20,  pct:1, slots:['weapon','charm'], pre:'疾風の'},
  crit:     {n:'会心率',             min:3,   max:12,  pct:1, slots:['weapon','head','charm'], pre:'必殺の'},
  critdmg:  {n:'会心ダメージ',       min:15,  max:60,  pct:1, slots:['weapon','charm'], pre:'凶刃の'},
  rangeP:   {n:'攻撃範囲',           min:10,  max:30,  pct:1, slots:['weapon'], types:['sword','axe','dagger','staff'], pre:'広域の'},
  hp:       {n:'最大HP',             min:8,   max:20,  scale:1, slots:['head','body','charm'], pre:'頑強な'},
  def:      {n:'防御',               min:2,   max:6,   scale:1, slots:['head','body'], pre:'堅牢な'},
  regen:    {n:'HP回復/秒',          min:0.4, max:1.5, scale:1, dec:1, slots:['head','body','charm'], pre:'癒しの'},
  leech:    {n:'HP吸収',             min:1,   max:4,   pct:1, dec:1, slots:['weapon','charm'], pre:'吸血の'},
  gold:     {n:'ゴールド獲得',       min:10,  max:40,  pct:1, slots:['body','charm'], pre:'黄金の'},
  drop:     {n:'ドロップ率',         min:10,  max:30,  pct:1, slots:['head','charm'], pre:'幸運の'},
  burn:     {n:'炎上付与',           min:10,  max:30,  pct:1, slots:['weapon'], pre:'炎の'},
  chain:    {n:'連鎖雷',             min:8,   max:25,  pct:1, slots:['weapon'], pre:'雷の'},
  multi:    {n:'追加弾',             min:1,   max:1,   int:1, slots:['weapon'], types:['bow','staff'], pre:'双子の'},
  pierce:   {n:'貫通',               min:1,   max:2,   int:1, slots:['weapon'], types:['bow'], pre:'穿つ'},
  airAtk:   {n:'ジャンプ中の攻撃力', min:15,  max:50,  pct:1, cond:1, slots:['weapon','charm'], pre:'天翔ける'},
  lowHpAspd:{n:'HP50%以下で攻撃速度',min:15,  max:40,  pct:1, cond:1, slots:['body','charm'], pre:'背水の'},
  bossDmg:  {n:'ボスへのダメージ',   min:10,  max:40,  pct:1, cond:1, slots:['weapon','head','charm'], pre:'王殺しの'},
  killBolt: {n:'8体倒すごとに落雷',  min:100, max:300, pct:1, cond:1, slots:['weapon','charm'], pre:'雷鳴の', note:'攻撃力の'},
  stompDmg: {n:'踏みつけダメージ',   min:30,  max:100, pct:1, slots:['head','body'], pre:'跳ねる'},
  firstHit: {n:'無傷の敵へのダメージ',min:15, max:50,  pct:1, cond:1, slots:['weapon'], pre:'先手の'},
  thorns:   {n:'被弾時に反撃',       min:100, max:300, pct:1, cond:1, slots:['body'], pre:'棘の', note:'攻撃力の'},
  dodge:    {n:'回避率',             min:3,   max:10,  pct:1, slots:['head','body','charm'], pre:'身軽な'},
  xpGain:   {n:'経験値',             min:10,  max:30,  pct:1, slots:['head','charm'], pre:'賢き'},
  killHeal: {n:'倒すたびにHP回復',   min:0.5, max:2,   scale:1, dec:1, cond:1, slots:['head','body'], pre:'貪る'},
  // 出撃中のスキルに効くもの（装備とスキルをつなぐ）
  skillDmg: {n:'スキルのダメージ',   min:8,   max:30,  pct:1, slots:['weapon','head','charm'], pre:'魔導の'},
  skillCd:  {n:'スキルの速さ',       min:5,   max:18,  pct:1, slots:['body','charm'], pre:'俊才の'},
  skillArea:{n:'スキルの範囲',       min:8,   max:25,  pct:1, slots:['head','body'], pre:'広がる'},
  skStart:  {n:'持って出撃',         min:1,   max:1,   int:1, skill:1, slots:['head','charm'], pre:'導きの'},   // s：スキルの種類。そのスキルを Lv+1 で持って出る
};
// スキルの名前と、訓練所で解放されるLv（skills.js の ACTIVES と同じ。装備の付与効果「持って出撃」で使う）
export const SKILL_N = {blade:'回転刃', bolt:'落雷', fire:'火炎瓶', quake:'着地衝撃', missile:'魔弾', frost:'冷気',
  barrier:'障壁', boomer:'ブーメラン', aura:'聖域', mine:'地雷', lance:'光線', time:'時の砂'};
export const SKILL_LOCK = {barrier:1, boomer:3, aura:5, mine:7, lance:8, time:9};

// レジェンド：ビルドの軸になる固有効果（武器種・部位ごとに2〜3種）
export const UNIQUES = [
  {id:'wave',     type:'sword',  name:'月光剣',       desc:'斬るたびに衝撃波が前方へ飛ぶ'},
  {id:'twin',     type:'sword',  name:'双星の剣',     desc:'斬撃が2回当たる（攻撃速度 -15%）'},
  {id:'quakeaxe', type:'axe',    name:'大地の斧',     desc:'振るたびに地面が揺れ、地上の敵すべてに攻撃力の40%'},
  {id:'execute',  type:'axe',    name:'処刑人の斧',   desc:'HP25%以下の敵にとどめを刺す（ボスを除く）・ボスへのダメージ +40%'},
  {id:'shadow',   type:'dagger', name:'影の短剣',     desc:'会心が出ると、もう1回攻撃する'},
  {id:'venom',    type:'dagger', name:'毒牙',         desc:'攻撃した敵を毒にする（3秒で攻撃力の120%）'},
  {id:'fan',      type:'bow',    name:'千本弓',       desc:'常に矢が+2本（威力35%）、扇状に放つ'},
  {id:'seeker',   type:'bow',    name:'追星の弓',     desc:'矢が敵を追いかけ、貫通 +2'},
  {id:'nova',     type:'staff',  name:'星喰いの杖',   desc:'倒した敵が誘爆する'},
  {id:'storm',    type:'staff',  name:'雷霆の杖',     desc:'弾が当たるたびに必ず連鎖雷が出る'},
  {id:'sage',     type:'head',   name:'賢者の冠',     desc:'経験値 +40%・出撃してすぐスキルを1つ選べる'},
  {id:'hawk',     type:'head',   name:'鷹の目',       desc:'会心率 +15%・ボスへの会心ダメージ +50%'},
  {id:'revive',   type:'body',   name:'不屈の鎧',     desc:'出撃ごとに1度だけ、倒れてもHP50%で復活'},
  {id:'thornmail',type:'body',   name:'棘の鎧',       desc:'被弾時に周りの敵へ攻撃力の300%で反撃'},
  {id:'midas',    type:'charm',  name:'黄金律の宝珠', desc:'ゴールド獲得 +100%・ドロップ率 +50%'},
  {id:'wing',     type:'charm',  name:'天駆ける羽根', desc:'空中でもう1回跳べる（3段ジャンプ）'},
  {id:'tempest',  type:'charm',  name:'嵐の指輪',     desc:'10体倒すごとに落雷を5本（攻撃力の200%）'},
  // スキルとつながるレジェンド
  {id:'thunderking',type:'head', name:'雷帝の冠',     desc:'「落雷」を持って出撃する・落雷の数 +1'},
  {id:'pyreheart', type:'body',  name:'火竜の心臓',   desc:'「火炎瓶」「地雷」の威力 +50%'},
  {id:'orbit',     type:'charm', name:'円環の指輪',   desc:'「回転刃」の数 +2・回転刃は Lv4 で進化できる'},
  {id:'archmage',  type:'charm', name:'大魔導の宝珠', desc:'スキルのダメージ +30%・スキルがボスに効く割合が2倍'},
  {id:'seed',      type:'charm', name:'進化の種',     desc:'攻撃スキルが Lv4 で進化できる'},
];
export const uniqueOf = id => UNIQUES.find(u => u.id === id);

// セット：同じシリーズを2/3/4個そろえるとボーナス（どの部位でもよい。装飾2つも別々に数える）
export const SETS = {
  gale:   {n:'疾風', c:'#7fe0a8', b:{2:'攻撃速度 +15%', 3:'ジャンプ中の攻撃力 +40%', 4:'着地のたびに周りへ斬撃（攻撃力の150%）'}},
  bulwark:{n:'鉄壁', c:'#9fc4e8', b:{2:'防御 +30%', 3:'最大HP +25%', 4:'被弾後の無敵時間 +50%・被弾時に反撃（攻撃力の200%）'}},
  hunter: {n:'狩人', c:'#ff8a6b', b:{2:'会心率 +8%', 3:'会心ダメージ +50%', 4:'ボスへのダメージ +40%'}},
  fortune:{n:'黄金', c:'#ffd36b', b:{2:'ゴールド獲得 +30%', 3:'ドロップ率 +30%', 4:'拾う装備のレア度が上がりやすい'}},
};
export const SET_CHANCE = 0.15;   // レア・エピックがセット装備になる確率

// 拠点の施設の最大Lv（中身は meta.js）
export const FAC_MAX = {train:10, smith:5, store:5, dojo:5, vault:5};

// 素材（分解で手に入る。レア度ごと）
export const MATS = ['欠片','結晶','宝玉','秘石','星核'];
// 所持枠：最初は60。10ずつ拡張できる（最大150）
export const INV_BASE = 60, INV_LIMIT = 150;
export const invExpandCost = max => Math.round(800 * Math.pow(2, (max - INV_BASE) / 10));

// 冒険のエリア（500mごと。4つ目のボスを倒すと「踏破」）
//   foes：出現する敵の重み（[重み, 出始める距離（エリアの頭から）]）・boss：エリアのボス・gim：エリアの仕掛け
export const ZONES = [
  {n:'みどりの丘',   sky:['#8fd3f4','#d8f1ff'], far:'#a7cdbf', near:'#6aa77f', ground:'#5b8c4a', dirt:'#4a6f3c',
   foes:{slime:[50,0], bat:[28,60], bigslime:[14,220], boar:[14,300]}, boss:'kingslime', gim:'chest', gn:'宝箱', deco:'meadow'},
  {n:'夕焼けの荒野', sky:['#f08d5a','#ffd9a8'], far:'#d49a76', near:'#a8694f', ground:'#8a5a3c', dirt:'#6f4630',
   foes:{slime:[16,0], thrower:[24,0], boar:[22,0], mole:[20,0], shield:[18,120]}, boss:'golem', gim:'sand', gn:'流砂', deco:'mesa'},
  {n:'月夜の森',     sky:['#16224a','#45568a'], far:'#2c3c6a', near:'#203553', cloud:'rgba(180,200,255,.12)', ground:'#2c4a3e', dirt:'#1f362d',
   foes:{bat:[22,0], ghost:[26,0], shield:[18,0], bigslime:[16,0], mole:[14,0], thrower:[8,0]}, boss:'witch', gim:'fog', gn:'霧', deco:'forest'},
  {n:'灼熱の火山',   sky:['#2e1010','#8a2c1c'], far:'#5a2020', near:'#3f1616', cloud:'rgba(60,40,40,.5)', ground:'#3a2a26', dirt:'#2a1d1a',
   foes:{bomber:[24,0], thrower:[16,0], boar:[18,0], shield:[16,0], ghost:[12,0], bat:[10,0]}, boss:'dragon', gim:'lava', gn:'火柱', deco:'volcano'},
];
export const CLEAR_DIST = 2000;   // 4体目のボスの位置。倒すと踏破
// 難易度：踏破すると次が解放。1段ごとに敵のHP×1.8・攻撃力×1.3。
// 敵Lv（＝拾う装備のアイテムLv）が5ずつ上がり、付与効果の上位の階級（T6・T7）が出るようになる
export const DIFF_MAX = 5;
export const diffInfo = d => ({lvOff:(d - 1)*5, hpMul:Math.pow(1.8, d - 1), dmgMul:Math.pow(1.3, d - 1), tierCap:Math.min(7, 4 + d), ilvlMax:22 + (d - 1)*5});
// チェックポイント：倒したボスの位置から出撃できる。ただし0mから走る方がドロップが多い
export const CP_RULE = {dropMul:0.5, bossDrops:1, fullBossDrops:2};

// 敵の名前（ログ・図鑑・被弾の記録用）
export const FOE_N = {mini:'小スライム', slime:'スライム', bat:'コウモリ', thrower:'投石兵', shield:'盾兵', boar:'突進イノシシ',
  bigslime:'大スライム', mole:'もぐら', bomber:'自爆ボム', ghost:'さまよう霊', chest:'宝箱'};
// エリート：まれに出る強い敵。特性を1〜2個持ち、良い装備を必ず落とす
export const ELITE_MODS = {
  fast:  {n:'速い',   d:'動きが1.6倍'},
  tough: {n:'硬い',   d:'HPがさらに2倍'},
  spiky: {n:'トゲ',   d:'踏むと反撃される（跳び越えるか倒す）'},
  regen: {n:'再生',   d:'HPが毎秒5%回復'},
};
// エリアのボス。atk：使う攻撃（第2形態＝HP50%以下で p2 に変わる）
export const BOSSES = {
//   charge：体ごと突っ込む（長押しで高く跳ぶ）/ beam：低い光線（空中にいる）か高い光線（跳ばない）/ combo：攻撃を続けて2つ
  kingslime:{n:'キングスライム', w:62, h:50, atk:['hop','spit','charge'],      p2:['bighop','spit','charge','combo']},
  golem:    {n:'岩石ゴーレム',   w:56, h:70, atk:['rocks','hop','charge'],     p2:['boulder','rocks','bighop','beam','combo']},
  witch:    {n:'森の魔女',       w:34, h:54, fly:16, atk:['orbs','summon','beam'], p2:['orbs','summon','beam','combo']},
  dragon:   {n:'炎竜',           w:66, h:60, atk:['pillars','breath','charge'], p2:['pillars','breath','beam','charge','combo']},
};

// ドロップの光の柱（レア度ごと）。h:0 は画面の上まで届く
export const DROP_FX = [
  {w:6,  h:70,  t:1.0},
  {w:8,  h:110, t:1.2},
  {w:11, h:170, t:1.5},
  {w:16, h:0,   t:2.0},
  {w:22, h:0,   t:2.6},
];
