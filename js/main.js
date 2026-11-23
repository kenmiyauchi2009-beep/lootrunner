// 起動処理
import { $ } from './util.js';
import { genItem, computeStats, powerWith, equipKeyFor, smithUpgrade, smithReroll, smithValue, smithLock, salvage, upgradeCost, valueCost, affGrade } from './items.js';
import { SAVE, SAVE_VERSION, loadGame, newSave, saveGame, migrate, exportText, parseImport, applySave, resetSave } from './save.js';
import { renderBase, openItem, equipItem, openCodex } from './base.js';
import { R, startRun, toBase, step, jump, releaseJump, JUMP, BAT_LANE, ROLL_SPEED, mkEnemy, EB, GHOST, ghostY, ORB, PILLAR, VENT, ventState, BOSS_TELE, CP_CATCHUP, elv } from './run.js';
import * as DATA from './data.js';
import { draw } from './render.js';
import { toast } from './ui.js';
import { openSettings } from './settings.js';
import { setupOffline } from './offline.js';
import { setMuted } from './audio.js';
import { pickSkill, rerollSkills, ACTIVES, PASSIVES } from './skills.js';
import * as META from './meta.js';
import { openFacilities, openAchievements, openRecords, openDaily } from './hub.js';

const loaded = loadGame();
setMuted(!!SAVE.settings.mute);
renderBase();
saveGame();   // 移行した形式をすぐ書き戻す
if (loaded === 'broken') toast('セーブデータを読めなかったため、新しく始めました（元のデータは別名で保管）');

$('setBtn').onclick = openSettings;

// 自動保存：5秒ごと（中身が変わったときだけ書き込む）と、アプリが裏に回ったとき
setInterval(saveGame, 5000);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
window.addEventListener('pagehide', saveGame);

setupOffline();

window.T = { get SAVE(){ return SAVE; }, get R(){ return R; }, startRun, toBase, genItem, computeStats, renderBase, step, draw, newSave, saveGame, openItem, jump, releaseJump, JUMP, BAT_LANE, ROLL_SPEED, pickSkill, ACTIVES, PASSIVES, equipItem,
  SAVE_VERSION, migrate, exportText, parseImport, applySave, resetSave, openSettings,
  powerWith, equipKeyFor, smithUpgrade, smithReroll, smithValue, smithLock, salvage, upgradeCost, valueCost, affGrade, openCodex,
  mkEnemy, EB, GHOST, ghostY, ORB, PILLAR, VENT, ventState, BOSS_TELE, CP_CATCHUP, elv, DATA,
  rerollSkills, META, openFacilities, openAchievements, openRecords, openDaily };
