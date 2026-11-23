// 冒険（更新処理と入力）
import { $, rnd, pickW, fmt } from './util.js';
import { RAR, ZONES, DROP_FX, WTYPES, MATS } from './data.js';
import { genItem, salvage, computeStats, powerWith, noteFound } from './items.js';
import { SAVE, saveGame } from './save.js';
import { closeModal, dialog, closeDialog } from './ui.js';
import { renderBase } from './base.js';
import { draw } from './render.js';
import { sfx, unlockAudio, isMuted, setMuted } from './audio.js';
import { initSkills, updateSkills, onLand, dropGem, openLevelUp, skillSummary, XP } from './skills.js';

export const VH = 300, GY = 255, PX = 70;
export let R = null, cv = $('cv'), ctx = cv.getContext('2d');
// VW：見えている横幅（ゲーム内の単位）。OY：ゲーム内の y を画面の y にずらす量。VTOP/VBOT：画面の上端・下端のゲーム内 y
export let VW = 300, SCALE = 1, DPR = 1, OY = 0, VTOP = 0, VBOT = VH, rafId = 0, lastT = 0;
let feedMax = 6;

// ジャンプ：長押しで高く、すぐ離すと低く。2段目は低め（空中での高さ調整用）
export const JUMP = {v:[470, 400, 360], gRise:1150, gFall:1800, buffer:0.12, bounce:380};   // 3段目は「天駆ける羽根」
const MAX_FX = 400;

export function sizeCanvas(){
  const stage = $('stage');
  const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
  DPR = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(w*DPR); cv.height = Math.round(h*DPR);
  // 縦持ち：横幅250ぶんを映して大きく見せ、地面を下から約3割の位置に置いてその下をログ欄にする
  // 横持ち：高さ300ぶんを映す（横は広く見える）
  const portrait = h > w * 1.15;
  SCALE = portrait ? w / 250 : Math.min(w / 300, h / VH);
  VW = w / SCALE;
  const hu = h / SCALE;
  OY = portrait ? Math.max(10, 0.68 * hu - GY) : GY / VH * hu - GY;
  VTOP = -OY; VBOT = hu - OY;
  const feed = $('feed');
  if (portrait){
    Object.assign(feed.style, {top:Math.round((GY + OY + 18) * SCALE) + 'px', left:'16px', right:'16px', bottom:'4px'});
    feedMax = Math.max(3, Math.floor(((VBOT - GY - 18) * SCALE - 4) / 24));
  } else {
    Object.assign(feed.style, {top:Math.round((44 - VTOP) * SCALE) + 'px', left:Math.round(10 * SCALE) + 'px', right:'50%', bottom:'auto'});
    feedMax = 3;
  }
  const f = $('feed'); while (f.children.length > feedMax) f.lastChild.remove();
}
window.addEventListener('resize', () => { if (R) sizeCanvas(); });

export function startRun(){
  unlockAudio();
  const base = computeStats(SAVE.equip), st = {...base, stompMul:1};   // st は出撃中に強化スキルで変わる
  R = {dist:0, px:0, speed:150, base, st, eid:0, levelup:false, hordeT:45, horde:null,
       p:{y:GY, vy:0, jumps:0, hold:false, buf:0, hp:st.hp, maxHp:st.hp, inv:0, atkT:0.4, revived:false, swing:0, swingMax:0.18},
       enemies:[], shots:[], eshots:[], fx:[], texts:[], spawnT:1.0, nextBoss:500, boss:null,
       gold:0, kills:0, stomps:0, jumpsUsed:0, hurts:{}, loot:[], paused:false, over:false, t:0,
       shake:0, shakeAmp:0, hitstop:0, flash:null, hurtFx:0,
       banner:{t:2.4, txt:ZONES[0].n}};
  initSkills();
  if (st.uniq.has('sage')) R.sk.pending = 1;   // 賢者の冠：出撃してすぐスキルを1つ選べる
  $('base').classList.add('hidden'); closeModal(); closeDialog();
  $('run').classList.remove('hidden');
  $('feed').innerHTML = '';
  syncMuteBtn();
  window.scrollTo(0,0);
  sizeCanvas();
  lastT = performance.now();
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}
export function toBase(){
  cancelAnimationFrame(rafId); R = null;
  $('run').classList.add('hidden'); $('base').classList.remove('hidden');
  closeDialog(); renderBase();
}
export function resumeClock(){ lastT = performance.now(); }
function loop(now){
  if (!R) return;
  const dt = Math.min(0.05, (now - lastT)/1000); lastT = now;
  if (!R.paused && !R.over) step(dt);
  draw();
  rafId = requestAnimationFrame(loop);
}
export const zone = () => ZONES[(Math.floor(R.nextBoss/500) - 1) % ZONES.length];
export const elv = () => 1 + Math.floor(R.dist/100);
export const ecenter = e => [e.x, e.y - e.h/2];
export function shake(t, amp){ R.shakeAmp = R.shake > 0 ? Math.max(R.shakeAmp, amp) : amp; R.shake = Math.max(R.shake, t); }

export const EB = {
  mini:   {hp:6,   dmg:12, w:16, h:12, gold:0},   // 群れの小さいスライム：経験値だけ
  slime:  {hp:16,  dmg:8,  w:24, h:18, gold:3},
  bat:    {hp:12,  dmg:7,  w:22, h:14, gold:3},
  thrower:{hp:30,  dmg:11, w:20, h:30, gold:5},
  boss:   {hp:357, dmg:18, w:56, h:70, gold:60},   // HP は BOSS_GROW で伸びる（最初のボスは従来と同じ強さ）
};
// コウモリの高さ：low は立っていると当たる（跳んで越える）、high は大きく跳ぶと当たる
export const BAT_LANE = {low:GY - 8, high:GY - 100};

// 敵の強さの伸び方（100mごとに敵Lvが1上がる）。HP と攻撃力がこの率で増える
export const GROW = {hp:1.3, dmg:1.2};
export const hpScale = lv => Math.pow(GROW.hp, lv - 1);
// ボスのHPの伸び（雑魚より緩い。装備を鍛えたぶん先へ進めるように）
export const BOSS_GROW = 1.22;
// スキルの効き方：投石兵には効きにくく、ボスには効かない（ボスは装備＝武器と踏みつけで倒す）
export const SKILL_RES = {thrower:0.35, boss:0};

export function mkEnemy(type){
  const lv = elv(), hm = type === 'boss' ? Math.pow(BOSS_GROW, lv - 1) : hpScale(lv), dm = Math.pow(GROW.dmg, lv-1);
  const B = EB[type];
  const e = {id:++R.eid, type, lv, x:VW+30, y:GY, hp:B.hp*hm, maxHp:B.hp*hm, dmg:B.dmg*dm, w:B.w, h:B.h, gold:B.gold,
    t:Math.random()*6, burnT:0, burnDps:0, burnAcc:0, burnTick:0.5, phase:'walk', throws:0, cd:1.6, tele:0, next:null, rockQ:0, rockT:0, hitFlash:0, wind:false};
  if (type==='bat'){ e.lane = Math.random() < 0.5 ? 'low' : 'high'; e.baseY = BAT_LANE[e.lane]; e.y = e.baseY; }
  return e;
}
function spawnEnemy(){
  const d = R.dist;
  // 小さいスライムの群れ（進むほど多く・長く）
  if (d > 40 && Math.random() < Math.min(0.5, 0.15 + d/2000)){
    const n = Math.min(8, 3 + Math.floor(d/400));
    for (let i=0;i<n;i++){ const e = mkEnemy('mini'); e.x += i*20; R.enemies.push(e); }
    return;
  }
  const w = {slime:50};
  if (d > 60) w.bat = 30;
  if (d > 160) w.thrower = 20;
  R.enemies.push(mkEnemy(pickW(w)));
}
// 大群：予告のあと、小さいスライムがすき間なく固まった「壁」が何度も来る。
// 長い壁はジャンプでは越えきれないので、範囲攻撃のスキルで崩す（大群＝スキルの関門、ボス＝装備の関門）
export const HORDE = {every:40, walls:6, gap:1.0};
const wallSize = () => Math.min(18, 5 + Math.floor(R.t / 25));
function updateHorde(dt){
  if (R.boss) return;
  if (!R.horde){
    R.hordeT -= dt;
    if (R.hordeT <= 0 && R.dist < R.nextBoss - 80){
      R.horde = {walls:Math.min(HORDE.walls, 3 + Math.floor(R.t / 60)), t:1.2};   // 序盤の大群は壁が少ない
      R.banner = {t:1.8, txt:'大群が来る！', c:'#ff8a6b'};
      sfx('warn'); R.hordeT = HORDE.every;
    }
    return;
  }
  R.horde.t -= dt;
  if (R.horde.t > 0) return;
  const n = wallSize();
  for (let i=0;i<n;i++){ const e = mkEnemy('mini'); e.x += i*11; e.t = i*0.7; R.enemies.push(e); }
  R.horde.t = HORDE.gap;
  if (--R.horde.walls <= 0) R.horde = null;
}

// ---------- 1フレームの更新 ----------
export function step(dt){
  const p = R.p, st = R.st;
  if (R.levelup) return;                              // レベルアップの3択を選んでいるあいだは止める
  if (R.hitstop > 0){ R.hitstop -= dt; return; }   // ヒットストップ中は時間を止める
  R.t += dt;
  const scroll = R.boss ? 0 : R.speed;
  R.px += scroll*dt;
  R.dist = R.px / 25;
  if (R.banner.t > 0) R.banner.t -= dt;
  if (R.shake > 0) R.shake -= dt;
  if (R.hurtFx > 0) R.hurtFx -= dt;
  if (R.flash && (R.flash.t -= dt) <= 0) R.flash = null;

  if (!R.boss && R.dist >= R.nextBoss){
    R.boss = mkEnemy('boss'); R.enemies.push(R.boss);
    R.banner = {t:2, txt:'ボス出現！', c:'#ff8a6b'};
    sfx('boss'); shake(0.6, 3);
  }
  if (!R.boss){
    R.spawnT -= dt;
    if (R.spawnT <= 0){ spawnEnemy(); R.spawnT = Math.max(0.45, 1.5 - R.dist/1500) * rnd(0.7,1.3); }
  }
  updateHorde(dt);

  // 自分：上昇中に押し続けていると重力が弱い（高く跳ぶ）
  const air = p.y < GY;
  p.vy += (p.vy < 0 && p.hold ? JUMP.gRise : JUMP.gFall) * dt;
  p.y += p.vy*dt;
  if (p.y >= GY){
    if (air && p.vy > 300) burst(PX, GY, 'rgba(230,230,220,.8)', 4);
    if (air && p.vy > 200){
      onLand();
      if (st.setB.has('gale4')){   // 疾風セット4：着地のたびに周りへ斬撃
        for (const e of R.enemies) if (!e.dead && e.hp > 0 && Math.abs(e.x - PX) < 70 && GY - e.y < 40) hit(e, st.finalDmg*1.5, true);
        R.fx.push({kind:'ring', x:PX, y:GY - 10, r:60, t:0.2, max:0.2, c:'127,224,168'});
      }
    }
    p.y = GY; p.vy = 0; p.jumps = 0;
    if (p.buf > 0) doJump();   // 着地直前に押していたら、着地と同時に跳ぶ
  }
  if (p.buf > 0) p.buf -= dt;
  if (p.inv > 0) p.inv -= dt;
  if (p.swing > 0) p.swing -= dt;
  if (st.regen > 0) p.hp = Math.min(p.maxHp, p.hp + st.regen*dt);
  p.atkT -= dt;
  const rate = st.rate * (p.hp < p.maxHp*0.5 ? 1 + st.lowHpAspd/100 : 1);   // 背水：HP50%以下で攻撃速度
  if (p.atkT <= 0) p.atkT = attack() ? 1/rate : 0.05;

  // 敵
  const pcY = p.y - 15;
  for (const e of R.enemies){
    if (e.dead) continue;
    e.t += dt; if (e.hitFlash > 0) e.hitFlash -= dt;
    // 足止め（stun）・鈍足（slow）。地面と一緒には流れる
    if (e.stun > 0) e.stun -= dt; if (e.slow > 0) e.slow -= dt;
    const m = e.stun > 0 ? 0 : e.slow > 0 ? 0.55 : 1;
    if (e.type==='slime') e.x += (-35*m - scroll)*dt;
    else if (e.type==='mini') e.x += (-45*m - scroll)*dt;
    else if (e.type==='bat'){
      e.x += (-70*m - scroll)*dt;
      e.y = e.baseY + Math.sin(e.t*4) * (e.lane==='low' ? 2 : 5);
    }
    else if (e.type==='thrower'){
      if (e.phase==='walk'){
        e.x += (-25*m - scroll)*dt;
        if (e.throws < 2 && e.x < Math.max(VW*0.72, PX + 170)){ e.phase = 'stand'; e.cd = 0.8; }
      } else {
        e.cd -= dt*m;
        e.wind = e.cd < 0.4;   // 振りかぶり（投げる予告）
        if (e.cd <= 0){ throwRock(e, 1.1, 105); e.throws++; e.cd = 1.6; e.wind = false; if (e.throws >= 2) e.phase = 'walk'; }
      }
    }
    else if (e.type==='boss') updateBoss(e, dt);

    if (e.poisonT > 0){ e.poisonT -= dt; e.hp -= e.poisonDps*dt; }   // 毒牙
    if (e.burnT > 0){
      e.burnT -= dt; const d = e.burnDps*dt; e.hp -= d; e.burnAcc += d; e.burnTick -= dt;
      if (e.burnTick <= 0){ e.burnTick = 0.5; if (e.burnAcc >= 1) addText(e.x+6, e.y-e.h-2, Math.round(e.burnAcc), '#ff9b4a'); e.burnAcc = 0; }
    }
    if (e.type==='boss' || e.hp <= 0) continue;
    const near = Math.abs(e.x - PX) < e.w/2 + 9;
    // 踏みつけ：落下中に敵の頭に乗ったら大ダメージ＋跳ね返り
    // 群れの小さいスライムは小さすぎて踏めない（群れを踏み渡れないように。群れはスキルで崩す）
    if (near && e.type !== 'mini' && p.vy > 0 && p.y >= e.y - e.h - 6 && p.y <= e.y - e.h + 12){
      stomp(e);
      continue;
    }
    // 接触
    if (p.inv <= 0 && near && p.y > e.y - e.h && p.y - 30 < e.y){
      if (e.type==='mini'){
        // 群れの小さいスライムは体当たりして消える（経験値なし）。無敵時間が短いので、止めきれない群れは続けて当たる
        hurtPlayer(e.dmg, 'mini', 0.25, 0.1);    // 防御で防ぎきれない（最大HPの10%以上）
        e.dead = true; burst(e.x, e.y - e.h/2, '#a6e35a', 4);
      } else {
        hurtPlayer(e.dmg, e.type==='bat' ? 'bat-' + e.lane : e.type);
        e.x += 45;
      }
    }
  }

  updateSkills(dt, scroll);

  // 自分の弾
  for (const s of R.shots){
    s.life -= dt;
    if (s.kind==='orb' || s.home){
      if (!s.tgt || s.tgt.dead || s.tgt.hp <= 0) s.tgt = nearestTarget(VW);
      if (s.tgt){
        const [tx,ty] = ecenter(s.tgt);
        const cur = Math.atan2(s.vy, s.vx); let da = Math.atan2(ty-s.y, tx-s.x) - cur;
        while (da > Math.PI) da -= 2*Math.PI; while (da < -Math.PI) da += 2*Math.PI;
        const na = cur + Math.max(-7*dt, Math.min(7*dt, da));
        const sp = s.speed || (s.home ? 340 : 300);
        s.vx = Math.cos(na)*sp; s.vy = Math.sin(na)*sp;
      }
    }
    s.x += s.vx*dt; s.y += s.vy*dt;
    for (const e of R.enemies){
      if (e.dead || e.hp <= 0 || s.hit.includes(e.id)) continue;
      if (Math.abs(s.x - e.x) < e.w/2 + s.r && s.y > e.y - e.h - s.r && s.y < e.y + s.r){
        if (s.kind==='orb'){ explode(s.x, s.y, s.aoe, s.dmg, false); if (R.st.uniq.has('storm')) chainLightning(e, s.dmg*0.6); s.life = 0; break; }
        hit(e, s.dmg, s.noProc, s.quiet); s.hit.push(e.id);
        if (--s.pierce < 0){ s.life = 0; break; }
      }
    }
    if (s.x > VW + 40 || s.x < -40 || s.y > GY + 20 || s.y < VTOP - 60) s.life = 0;
  }
  R.shots = R.shots.filter(s => s.life > 0);

  // 敵の弾
  for (const s of R.eshots){
    if (s.kind==='rock'){
      // 自分の少し前に落ち、そこから転がってくる（跳んで越える）
      s.t -= dt;
      if (!s.rolling){
        s.vy += s.g*dt; s.x += s.vx*dt; s.y += s.vy*dt;
        if (s.t <= 0){ s.rolling = true; s.y = GY - s.r; burst(s.x, GY, '#8b8378', 5); sfx('thud'); }
      } else {
        s.x += (-ROLL_SPEED - scroll)*dt; s.spin = (s.spin || 0) + dt*12;
        if (Math.abs(s.x - PX) < s.r + 9 && p.y > GY - s.r*2){ hurtPlayer(s.dmg, s.src + '-rock'); s.dead = true; burst(s.x, GY - s.r, '#8b8378', 6); }
        if (s.x < -30) s.dead = true;
      }
    } else if (s.kind==='wave'){
      s.x += s.vx*dt;
      if (Math.abs(s.x - PX) < s.w/2 + 9 && p.y > GY - s.h){ hurtPlayer(s.dmg, 'boss-wave'); }
      if (s.x < -30) s.dead = true;
    }
  }
  R.eshots = R.eshots.filter(s => !s.dead);

  // 倒した敵
  for (const e of R.enemies) if (!e.dead && e.hp <= 0) onKill(e);
  R.enemies = R.enemies.filter(e => !e.dead && e.x > -60);

  // 演出（光の柱は地面と一緒に流れる）
  for (const f of R.fx){
    f.t -= dt;
    if (f.kind==='part'){ f.vy += (f.g ?? 500)*dt; f.x += f.vx*dt; f.y += f.vy*dt; }
    else if (f.kind==='pillar') f.x -= scroll*dt;
  }
  R.fx = R.fx.filter(f => f.t > 0);
  for (const t of R.texts) t.t -= dt;
  R.texts = R.texts.filter(t => t.t > 0);
  if (R.sk.pending > 0 && !R.over) openLevelUp();
  // 定期保存は main.js の自動保存（5秒ごと）が行う
}

// ボス戦の制限時間：戦い始めて BOSS_RAGE 秒で怒り（攻撃が速く・強くなる）、BOSS_LIMIT 秒で最後の一撃（倒しきれなければ終わり）。
// 避けるのが上手くても、装備の火力が足りなければ先へ進めない
export const BOSS_RAGE = 40, BOSS_LIMIT = 70;
function updateBoss(e, dt){
  // 近接武器が届く距離まで近づく（短剣は近くまで来る）。弓・杖のときは 100 先で止まる
  const reach = WTYPES[R.st.type].melee ? R.st.range * (1 + R.st.rangeP/100) + e.w/2 - 8 : 100;
  const stopX = Math.min(VW - 70, PX + Math.max(60, Math.min(100, reach)));
  if (e.x > stopX){ e.x -= 60*dt; return; }
  e.fightT = (e.fightT || 0) + dt;
  if (e.fightT >= BOSS_LIMIT){ R.flash = {c:'#ff3b2f', t:0.6, max:0.6}; shake(0.6, 6); sfx('bosskill'); endRun(false, 'boss'); return; }
  const over = e.fightT - BOSS_RAGE;
  if (over > 0 && !e.rage){ R.banner = {t:2, txt:'ボスが怒った！', c:'#ff5b4a'}; sfx('boss'); shake(0.4, 3); }
  e.rage = over > 0 ? 1 + 0.3 + over * 0.03 : 0;   // 怒った瞬間に +30%、その後も毎秒 +3%
  const pow = e.rage || 1;
  if (e.tele > 0){
    e.tele -= dt;
    if (e.tele <= 0){
      if (e.next==='stomp'){
        R.eshots.push({kind:'wave', x:e.x - 30, y:GY, vx:-240, w:16, h:22, dmg:e.dmg*pow});
        shake(0.25, 4); sfx('stomp');
      }
      else { e.rockQ = 3; e.rockT = 0; }
    }
    return;
  }
  if (e.rockQ > 0){
    e.rockT -= dt;
    if (e.rockT <= 0){ throwRock(e, 0.95, 80, pow); e.rockQ--; e.rockT = 0.62; }
    return;
  }
  e.cd -= dt;
  if (e.cd <= 0){
    e.next = Math.random() < 0.5 ? 'stomp' : 'rocks';
    e.tele = e.rage ? 0.65 : 0.8; e.cd = Math.max(1.6, 2.6 - e.lv*0.04) / Math.min(2, pow);
    sfx('warn');
  }
}
// 岩は自分の少し前（ahead）に落ちてから転がってくる。飛んでいるあいだ、落ちる場所に輪が出る
export const ROLL_SPEED = 110;
function throwRock(e, T, ahead, pow = 1){
  const sx = e.x - 8, sy = e.y - e.h + 6, tx = PX + ahead, ty = GY - 7, g = 700;
  R.eshots.push({kind:'rock', x:sx, y:sy, vx:(tx-sx)/T, vy:(ty - sy - 0.5*g*T*T)/T, g, r:7, tx, dmg:e.dmg*pow, t:T, T, src:e.type});
}

export function nearestTarget(maxX){
  let best = null, bd = 1e9;
  for (const e of R.enemies){
    if (e.dead || e.hp <= 0 || e.x < PX - 12 || e.x > maxX) continue;
    const d = e.x - PX; if (d < bd){ bd = d; best = e; }
  }
  return best;
}
const weaponColor = () => SAVE.equip.weapon ? RAR[SAVE.equip.weapon.r].c : '#ffffff';
function attack(){
  const st = R.st, p = R.p, cx = PX, cy = p.y - 15, U = x => st.uniq.has(x);
  // 攻撃速度が上がるほど振りが速くなる
  const dur = Math.max(0.08, Math.min(st.type==='axe' ? 0.3 : 0.2, 0.36 / st.rate));
  if (WTYPES[st.type].melee){
    const rr = st.range * (1 + st.rangeP/100);
    // 武器（装備）は強い一撃。1回に当たるのは近い st.targets 体まで（剣3・斧5・短剣1。群れはスキルの役目）
    const hits = R.enemies.filter(e => !e.dead && e.hp > 0 && e.x > PX - 30 && Math.hypot(e.x - cx, e.y - e.h/2 - cy) < rr + e.w/2)
      .sort((a, b) => Math.abs(a.x - PX) - Math.abs(b.x - PX)).slice(0, st.targets);
    if (!hits.length) return false;
    for (const e of hits){
      const crit = hit(e, st.finalDmg);
      if (U('twin')) hit(e, st.finalDmg*0.6);                                 // 双星の剣：2回目（60%）
      if (U('shadow') && crit) hit(e, st.finalDmg);                           // 影の短剣：会心でもう1回
      if (st.type==='axe' && e.type !== 'boss') e.x += 10;                    // 斧は大きく押し返す
    }
    if (U('quakeaxe')){                                                       // 大地の斧：地上の敵すべてに
      for (const e of R.enemies) if (!e.dead && e.hp > 0 && GY - e.y < 35 && !hits.includes(e) && e.x < VW + 10) hit(e, st.finalDmg*0.4, true);
      R.fx.push({kind:'quake', x:PX, r:VW, t:0.25, max:0.25});
    }
    p.flip = !p.flip;
    R.fx.push({kind:'slash', t:dur, max:dur, r:rr, c:weaponColor(), flip:p.flip, wide:st.type==='axe', thin:st.type==='dagger'});
    p.swing = dur; p.swingMax = dur;
    if (U('wave')) R.shots.push({kind:'wave', x:PX+16, y:cy, vx:420, vy:0, dmg:st.finalDmg*0.35, pierce:99, hit:[], life:0.9, r:12});
    sfx('slash');
    return true;
  }
  const tgt = nearestTarget(VW - 5);
  if (!tgt) return false;
  const [tx,ty] = ecenter(tgt);
  const base = Math.atan2(ty - cy, tx - cx);
  const n = 1 + st.multi + (U('fan') ? 2 : 0);
  for (let i=0;i<n;i++){
    const a = base + (i - (n-1)/2) * 0.13;
    const dmg = st.finalDmg * (U('fan') && i >= n - 2 ? 0.35 : 1);   // 千本弓の追加の2本は35%の威力
    if (st.type==='bow') R.shots.push({kind:'arrow', x:cx+10, y:cy, vx:Math.cos(a)*560, vy:Math.sin(a)*560, dmg, pierce:st.pierce, hit:[], life:1.5, r:4, home:U('seeker'), speed:560, tgt});
    else R.shots.push({kind:'orb', x:cx+10, y:cy-4, vx:Math.cos(a)*300, vy:Math.sin(a)*300, dmg:st.finalDmg, hit:[], life:2.5, r:6, tgt, aoe:42*(1 + st.rangeP/100)});
  }
  p.swing = dur; p.swingMax = dur;
  sfx(st.type==='bow' ? 'shoot' : 'orb');
  return true;
}
// skill：スキルによる攻撃。装備の会心は乗らず、大きい敵には効きにくい。数字は小さく、命中音なし
// 装備による攻撃には、条件付きの付与効果（ジャンプ中・ボス・無傷の敵）とレジェンドが乗る。会心したかを返す
export function hit(e, base, noProc, skill){
  if (e.dead || e.hp <= 0) return false;
  const st = R.st, U = x => st.uniq.has(x);
  const crit = !skill && Math.random() < st.critC;
  const res = skill ? (SKILL_RES[e.type] ?? 1) : 1;
  if (res === 0) return false;
  let mul = 1;
  if (!skill){
    if (R.p.y < GY - 2) mul *= 1 + st.airAtk/100;
    if (e.type === 'boss') mul *= 1 + st.bossDmg/100;
    if (e.hp >= e.maxHp) mul *= 1 + st.firstHit/100;
    if (crit && e.type === 'boss' && U('hawk')) mul *= 1.5;
  }
  const d = base * (crit ? st.critM : 1) * res * mul;
  e.hp -= d; e.hitFlash = 0.08;
  if (e.type !== 'boss') e.x += 3;   // 軽いノックバック
  addText(e.x + rnd(-6,6), e.y - e.h - 4, Math.round(d), crit ? '#ffe14d' : !skill ? '#ffffff' : res < 1 ? '#8e9aa3' : '#d8e4ff', crit, 0.7, skill);
  if (crit){ shake(0.08, 2); sfx('crit'); } else if (!skill) sfx('hit');
  if (st.leech > 0) R.p.hp = Math.min(R.p.maxHp, R.p.hp + d*st.leech/100);
  if (!noProc){
    if (st.burn > 0 && Math.random() < st.burn/100){ e.burnT = 3; e.burnDps = Math.max(e.burnDps, base*0.4); }
    if (st.chain > 0 && Math.random() < st.chain/100) chainLightning(e, base*0.6);
    if (U('venom')){ e.poisonT = 3; e.poisonDps = Math.max(e.poisonDps || 0, st.finalDmg*0.4); }
  }
  // 処刑人の斧：HP25%以下の敵にとどめ（ボスを除く）
  if (!skill && U('execute') && e.type !== 'boss' && e.hp > 0 && e.hp < e.maxHp*0.25){ e.hp = 0; addText(e.x, e.y - e.h - 14, 'とどめ', '#ff8a6b', true); }
  return crit;
}
function stomp(e){
  const p = R.p;
  R.stomps++;
  hit(e, R.st.finalDmg * 2.5 * R.st.stompMul * (1 + R.st.stompDmg/100), true);
  p.vy = -JUMP.bounce; p.jumps = 1; p.inv = Math.max(p.inv, 0.15);
  R.fx.push({kind:'ring', x:e.x, y:e.y - e.h, r:22, t:0.25, max:0.25, c:'255,255,255'});
  shake(0.1, 2.5); sfx('stomp');
  R.hitstop = Math.max(R.hitstop, 0.05);
}
export function explode(x, y, r, dmg, noProc, quiet, fx = 'boom'){
  if (fx === 'boom') R.fx.push({kind:'boom', x, y, r, t:0.3, max:0.3});
  for (const e of R.enemies){
    if (e.dead || e.hp <= 0) continue;
    const [ex,ey] = ecenter(e);
    if (Math.hypot(ex-x, ey-y) < r + e.w/2) hit(e, dmg, noProc, quiet);
  }
}
function chainLightning(src, dmg){
  const [sx,sy] = ecenter(src);
  const pts = [[sx,sy]];
  const targets = R.enemies.filter(e => e!==src && !e.dead && e.hp > 0)
    .map(e => [e, Math.hypot(e.x - src.x, e.y - src.y)]).filter(([,d]) => d < 150)
    .sort((a,b) => a[1]-b[1]).slice(0,2).map(([e]) => e);
  for (const t of targets){ hit(t, dmg, true); pts.push(ecenter(t)); }
  if (pts.length > 1) R.fx.push({kind:'bolt', pts, t:0.2, max:0.2});
}
function onKill(e){
  e.dead = true; R.kills++;
  const g = Math.round(e.gold * (1 + e.lv*0.35) * (1 + R.st.gold/100));
  R.gold += g; SAVE.gold += g;
  const [cx,cy] = ecenter(e);
  dropGem(cx, cy, XP[e.type]);
  // 強化スキル「生命」：倒すたびに少し回復
  if (R.sk.pas.vigor) R.p.hp = Math.min(R.p.maxHp, R.p.hp + R.p.maxHp * 0.002 * R.sk.pas.vigor);
  // 装備：倒すたびにHP回復・8体ごとに落雷・嵐の指輪（10体ごとに落雷5本）
  const st = R.st;
  if (st.killHeal) R.p.hp = Math.min(R.p.maxHp, R.p.hp + st.killHeal);
  if (st.killBolt && R.kills % 8 === 0) gearBolt(1, st.finalDmg * st.killBolt/100);
  if (st.uniq.has('tempest') && R.kills % 10 === 0) gearBolt(5, st.finalDmg * 2);
  burst(cx, cy, e.type==='slime' || e.type==='mini' ? '#6ccf5e' : e.type==='bat' ? '#8a5cc7' : e.type==='boss' ? '#a58fd0' : '#b07a48', e.type==='boss' ? 30 : 8);
  R.fx.push({kind:'ring', x:cx, y:cy, r:e.w*0.9, t:0.2, max:0.2, c:'255,240,200'});
  if (R.st.uniq.has('nova')) explode(cx, cy, 55, R.st.finalDmg*0.8, true);
  if (e.type==='boss'){
    R.hitstop = Math.max(R.hitstop, 0.3);
    shake(0.5, 5); R.flash = {c:'#ffffff', t:0.3, max:0.3};
    sfx('bosskill');
    drop(e, e.lv + 1, 2); drop(e, e.lv + 1, 2);
    R.boss = null; R.nextBoss += 500;
    R.p.hp = Math.min(R.p.maxHp, R.p.hp + R.p.maxHp*0.3);
    R.banner = {t:2.6, txt:`ボス撃破！ → ${zone().n}`};
    R.eshots = [];
    saveGame();
  } else {
    R.hitstop = Math.max(R.hitstop, 0.035);
    sfx('kill');
    if (Math.random() < (e.type==='mini' ? 0.005 : 0.09) * (1 + R.st.drop/100)) drop(e, e.lv, 0);
  }
}
// 装備による落雷（ボスにも当たる）
function gearBolt(n, dmg){
  const list = R.enemies.filter(e => !e.dead && e.hp > 0 && e.x > PX - 20 && e.x < VW + 10);
  for (let i = 0; i < n && list.length; i++){
    const e = list.splice(Math.floor(Math.random()*list.length), 1)[0];
    const [x, y] = ecenter(e);
    hit(e, dmg, true);
    R.fx.push({kind:'skybolt', x, y, t:0.2, max:0.2});
  }
  sfx('zap');
}
function drop(e, ilvl, minR){
  const it = genItem(ilvl, minR, R.st.drop/100 + R.st.rarityB);
  noteFound(it);
  const F = DROP_FX[it.r];
  R.fx.push({kind:'pillar', x:e.x, r:it.r, t:F.t, max:F.t});
  if (it.r >= 3) R.flash = {c:RAR[it.r].c, t:0.35, max:0.35};
  if (it.r === 4) for (let i=0;i<14;i++) R.fx.push({kind:'part', x:e.x + rnd(-10,10), y:GY - rnd(0,20), vx:rnd(-20,20), vy:rnd(-160,-60), g:-20, c:RAR[4].c, t:rnd(0.8,1.4), max:1.4});
  sfx('drop', it.r);
  const rc = RAR[it.r].c;
  let line, up = false;
  const d = powerWith(it) - computeStats(SAVE.equip).power;
  // 自動分解：設定したレア度以下で、セット・レジェンドでなく、戦力も上がらないもの
  const auto = it.r <= SAVE.autoSalv && !it.set && !it.uniq && d <= 0.5;
  if (auto || SAVE.inv.length >= SAVE.invMax){
    const r = salvage(it); R.gold += r.g; R.salv = (R.salv || 0) + 1;
    line = `<span style="color:var(--muted)">${auto ? '自動分解' : '所持品がいっぱい：分解'}：${it.name} +${r.g}G・${MATS[r.m.r]}×${r.m.n}</span>`;
  } else {
    SAVE.inv.push(it); R.loot.push(it);
    up = d > 0.5;
    line = `<b style="color:${rc}">${RAR[it.r].n}</b> <span style="color:${rc}">${it.name}</span> <small>Lv${it.ilvl}</small>${up ? ` <b class="upbadge">▲ 戦力+${fmt(d)}</b>` : ''}`;
    if (it.r >= 3) R.banner = {t:1.8, txt:`${RAR[it.r].n}！ ${it.name}`, c:rc};
    if (up){ addText(PX + 10, R.p.y - 52, '▲ 戦力UP', '#5fd17a', true, 1.3); sfx('up'); }
  }
  const div = document.createElement('div'); div.innerHTML = line;
  if (up) div.className = 'up';
  $('feed').prepend(div);
  while ($('feed').children.length > feedMax) $('feed').lastChild.remove();
  saveGame();
}
// minPct：防御で減らしても最大HPのこの割合は必ず受ける（群れの体当たり）
function hurtPlayer(d, src, inv = 0.8, minPct = 0){
  const p = R.p, st = R.st;
  if (p.inv > 0 || R.over) return;
  // 回避
  if (Math.random() < st.dodgeC){ p.inv = 0.3; addText(PX, p.y - 40, '回避', '#9fe3ff', true); return; }
  const dd = Math.max(d * (1 - st.defRed), p.maxHp * minPct);
  p.hp -= dd; p.inv = inv * st.invMul;
  // 反撃（棘の鎧・鉄壁セット・付与効果）
  if (st.thorns){
    for (const e of R.enemies) if (!e.dead && e.hp > 0 && Math.abs(e.x - PX) < 80) hit(e, st.finalDmg * st.thorns/100, true);
    R.fx.push({kind:'ring', x:PX, y:p.y - 15, r:50, t:0.2, max:0.2, c:'255,138,107'});
  }
  R.hurts[src] = (R.hurts[src] || 0) + 1;
  shake(0.25, 4); R.hurtFx = 0.3; sfx('hurt');
  addText(PX, p.y - 40, '-' + Math.round(dd), '#ff6b6b', true);
  if (navigator.vibrate) navigator.vibrate(40);
  if (p.hp <= 0){
    if (R.st.uniq.has('revive') && !p.revived){ p.revived = true; p.hp = p.maxHp*0.5; p.inv = 1.5; addText(PX, p.y - 56, '不屈！', '#ffa53a', true); }
    else endRun(false);
  }
}

// ---------- 入力 ----------
function doJump(){
  const p = R.p;
  p.vy = -JUMP.v[Math.min(p.jumps, JUMP.v.length - 1)]; p.jumps++; p.buf = 0; R.jumpsUsed++;
  sfx('jump', p.jumps);
}
// 押したとき
export function jump(){
  if (!R || R.paused || R.over) return;
  const p = R.p;
  p.hold = true;
  // 落下中で、もうすぐ着地するなら2段目を使わず、着地と同時に跳ぶ
  const landingSoon = p.y < GY && p.vy > 0 && p.y + p.vy*JUMP.buffer + 0.5*JUMP.gFall*JUMP.buffer*JUMP.buffer >= GY;
  if (p.jumps < R.st.maxJumps && !landingSoon) doJump();
  else p.buf = JUMP.buffer;
}
// 離したとき（早く離すと低いジャンプになる）
export function releaseJump(){ if (R) R.p.hold = false; }

export function addText(x, y, txt, c, big, life = 0.7, small = false){
  if (R.texts.length > 60) R.texts.shift();
  R.texts.push({x, y, txt:String(txt), c, big, small, t:life, max:life});
}
export function burst(x, y, c, n){
  if (R.fx.length > MAX_FX) return;
  for (let i=0;i<n;i++) R.fx.push({kind:'part', x, y, vx:rnd(-120,120), vy:rnd(-220,-40), c, t:rnd(0.3,0.6), max:0.6});
}

function endRun(retreat, reason){
  R.over = true;
  SAVE.runs++;
  SAVE.best = Math.max(SAVE.best, Math.floor(R.dist));
  saveGame();
  const loot = [...R.loot].sort((a,b) => b.r - a.r || b.ilvl - a.ilvl);
  const lootHTML = loot.length ? loot.map(it => `<div><b style="color:${RAR[it.r].c}">${RAR[it.r].n}</b> <span style="color:${RAR[it.r].c}">${it.name}</span> <small style="color:var(--muted)">Lv${it.ilvl}</small></div>`).join('')
    : '<div style="color:var(--muted);text-align:center">装備は拾えなかった</div>';
  setTimeout(() => dialog(`
    <h2>${retreat ? '撤退した' : reason === 'boss' ? 'ボスを倒しきれなかった…' : '力尽きた…'}</h2>
    ${reason === 'boss' ? '<p class="sksum">ボスは70秒以内に倒す必要がある。ボスにはスキルが効かないので、装備（武器）を鍛えよう。</p>' : ''}
    <div class="res">
      <div class="stat"><small>到達</small><b>${fmt(R.dist)}m</b></div>
      <div class="stat"><small>撃破</small><b>${R.kills}</b></div>
      <div class="stat"><small>ゴールド</small><b>${fmt(R.gold)}</b></div>
    </div>
    <p class="sksum">${skillSummary()}</p>
    <div class="loot">${lootHTML}</div>
    <div class="btns"><button class="primary" id="dBase">拠点へ戻る</button></div>`), retreat ? 0 : 600);
  setTimeout(() => { const b = $('dBase'); if (b) b.onclick = toBase; }, retreat ? 10 : 620);
}
export function pauseRun(){
  if (!R || R.over || R.paused || R.levelup) return;   // レベルアップの3択中はそれ自体が止まっている
  R.paused = true; R.p.hold = false;
  dialog(`<h2>一時停止</h2><p style="color:var(--muted);font-size:13px">${fmt(R.dist)}m ・ 拾った装備 ${R.loot.length}個</p>
    <p class="sksum">${skillSummary()}</p>
    <div class="btns"><button class="primary" id="dResume">再開</button><button id="dRetreat">撤退する（拾った装備は持ち帰る）</button></div>`);
  $('dResume').onclick = () => { closeDialog(); R.paused = false; lastT = performance.now(); unlockAudio(); };
  $('dRetreat').onclick = () => { closeDialog(); R.paused = false; endRun(true); };
}

// 消音（設定に保存）
function syncMuteBtn(){
  const b = $('muteBtn');
  b.textContent = isMuted() ? '音 OFF' : '音 ON';
  b.setAttribute('aria-pressed', String(isMuted()));
}
export function toggleMute(){
  setMuted(!isMuted());
  SAVE.settings.mute = isMuted();
  saveGame(); syncMuteBtn();
  if (!isMuted()) unlockAudio();
}

$('pauseBtn').onclick = pauseRun;
$('muteBtn').onclick = toggleMute;
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseRun(); });   // 保存は main.js

$('run').addEventListener('pointerdown', ev => {
  if (ev.target.closest('button')) return;
  ev.preventDefault(); unlockAudio(); jump();
});
window.addEventListener('pointerup', releaseJump);
window.addEventListener('pointercancel', releaseJump);
document.addEventListener('keydown', ev => {
  if (!R) return;
  if (ev.key===' ' || ev.key==='ArrowUp' || ev.key==='w'){ ev.preventDefault(); if (!ev.repeat) jump(); }
  else if (ev.key==='Escape' || ev.key==='p') pauseRun();
});
document.addEventListener('keyup', ev => { if (ev.key===' ' || ev.key==='ArrowUp' || ev.key==='w') releaseJump(); });
