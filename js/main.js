// 起動処理
import { $ } from './util.js';
import { genItem, computeStats, powerWith, equipKeyFor, smithUpgrade, smithReroll, smithValue, smithLock, salvage, upgradeCost, valueCost, affGrade } from './items.js';
import { SAVE, SAVE_VERSION, loadGame, newSave, saveGame, migrate, exportText, parseImport, applySave, resetSave } from './save.js';
import { renderBase, openItem, equipItem, openCodex } from './base.js';
import { R, drop, SKILL_RES, BOSS_TUNE, offerResume, saveRunSnap, loadRunSnap, resumeRun, startRun, toBase, step, jump, releaseJump, JUMP, BAT_LANE, ROLL_SPEED, mkEnemy, EB, GHOST, ghostY, ORB, PILLAR, VENT, ventState, BOSS_TELE, CP_CATCHUP, elv } from './run.js';
import * as DATA from './data.js';
import { draw } from './render.js';
import { toast } from './ui.js';
import { openSettings } from './settings.js';
import { setupOffline } from './offline.js';
import { setMuted, setVolumes, playBgm, bgmState } from './audio.js';
import { showTitle, hideTitle } from './title.js';
import { applySettings } from './settings.js';
import { pickSkill, rerollSkills, ACTIVES, PASSIVES } from './skills.js';
import * as META from './meta.js';
import { openFacilities, openAchievements, openRecords, openDaily, openLook, nextGoal } from './hub.js';

// 版の番号（sw.js の VERSION と同じにする）
export const APP_VERSION = '1.7.6';
const loaded = loadGame();
META.initLook();
applySettings();
playBgm('base');   // 音が使えるようになったら（タイトルをタップしたら）鳴り始める
renderBase();
showTitle(APP_VERSION);
offerResume();   // 途中の冒険があれば「続きから」を出す（タイトルの下に出しておく）
saveGame();   // 移行した形式をすぐ書き戻す
if (loaded === 'broken') toast('セーブデータを読めなかったため、新しく始めました（元のデータは別名で保管）');

$('setBtn').onclick = openSettings;

// 自動保存：5秒ごと（中身が変わったときだけ書き込む）と、アプリが裏に回ったとき
setInterval(saveGame, 5000);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
window.addEventListener('pagehide', saveGame);

setupOffline();

window.T = { get SAVE(){ return SAVE; }, get R(){ return R; }, drop, SKILL_RES, BOSS_TUNE, saveRunSnap, loadRunSnap, resumeRun, offerResume, startRun, toBase, genItem, computeStats, renderBase, step, draw, newSave, saveGame, openItem, jump, releaseJump, JUMP, BAT_LANE, ROLL_SPEED, pickSkill, ACTIVES, PASSIVES, equipItem,
  SAVE_VERSION, migrate, exportText, parseImport, applySave, resetSave, openSettings,
  powerWith, equipKeyFor, smithUpgrade, smithReroll, smithValue, smithLock, salvage, upgradeCost, valueCost, affGrade, openCodex,
  mkEnemy, EB, GHOST, ghostY, ORB, PILLAR, VENT, ventState, BOSS_TELE, CP_CATCHUP, elv, DATA,
  rerollSkills, META, openFacilities, openAchievements, openRecords, openDaily, openLook, nextGoal, hideTitle, applySettings, bgmState };
