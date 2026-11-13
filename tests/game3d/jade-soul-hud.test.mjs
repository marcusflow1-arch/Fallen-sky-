import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const hudMount = read('src/components/game3d/hud/GameHUD.jsx');
const view = read('src/pages/GameView.jsx');
const hud = read('src/components/game3d/hud/JadeSoulHUD.jsx');
const css = read('src/components/game3d/hud/JadeSoulHUD.css');
const chat = read('src/components/game3d/social/WorldChatPanel.jsx');
const weather = read('src/components/game3d/WorldEnvironmentHUD.jsx');
const navigation = read('src/components/game3d/axe/services/AXEServicesNavigation.jsx');

test('Game 3D mounts the real Jade Soul HUD and context target without duplicating old gauges', () => {
  assert.match(view, /<GameHUD[\s>]/);
  assert.match(hudMount, /<JadeSoulHUD onOpenServices=\{onOpenServices\}/);
  assert.match(hud, /<TargetDisplay/);
  assert.doesNotMatch(hudMount, /<TargetDisplay/);
  assert.match(hud, /!hideTarget && <TargetDisplay/);
  assert.match(css, /\.jade-compass-block \.axe-target-lock/);
  for (const old of ['HUDVitals', 'HUDMinimapQuest', 'HUDGameQuickActions', 'HUDKillStreakChip']) {
    assert.doesNotMatch(hudMount, new RegExp('<' + old + '\\s*[/ >]'));
  }
});

test('services keep the measured navigation, quest tracker, and world map interaction', () => {
  assert.match(hud, /<AXEServicesNavigation/);
  assert.match(hud, /<JadeQuestTracker/);
  assert.match(hud, /axeOpenWorldMap/);
  assert.match(hud, /<Compass region=\{region\} hideTarget=\{navigationHidden\} \/>/);
  assert.match(navigation, /measureAXEServicesArea\(/);
  assert.match(navigation, /splitAXEServiceRows\(/);
  assert.match(css, /\.jade-services-options-scroll\s*\{[^}]*overflow-x:\s*auto/);
});

test('ten actual active skills display as two gently curved five-slot rows', () => {
  assert.match(hud, /import \{ ACTIVE_SLOTS, getLoadout, subscribeLoadout \}/);
  assert.match(hud, /Array\.from\(\{ length: ACTIVE_SLOTS \}/);
  assert.match(hud, /const SKILL_KEYS = \['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'\]/);
  assert.match(hud, /loadout\?\.activeSlots\?\.\[index\]/);
  assert.match(hud, /loadout\?\.cooldowns\?\.\[index\]/);
  assert.match(hud, /const SKILL_ARC_RISE = \[10, 7, 0, -11, -24\]/);
  assert.match(css, /grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(css, /grid-template-rows:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /width:\s*clamp\(35px, 3\.1vw, 46px\)/);
  assert.doesNotMatch(hud, /<DiamondSlots/);
});

test('HP, Will and Stamina use live values and share slimmer legible gauges', () => {
  assert.match(hud, /subscribePlayerHUD\(setHud\)/);
  assert.match(hud, /subscribeCombatResources\(setResources\)/);
  assert.match(hud, /ratio\(hud\?\.hp, hud\?\.maxHP\)/);
  assert.match(hud, /ratio\(currentWill, maxWill\)/);
  assert.match(hud, /ratio\(resources\.stamina, resources\.maxStamina\)/);
  for (const cls of ['hp', 'will', 'stamina']) assert.match(hud, new RegExp('jade-status-fill--' + cls));
  assert.match(css, /\.jade-status-track\s*\{[^}]*height:\s*12px/s);
});

test('XP progress is real and uses a fine dotted gold rail with a reduced center diamond', () => {
  assert.match(hud, /ratio\(hud\.xp, hud\.xpForNext\)/);
  assert.match(hud, /className="jade-xp-fill"/);
  assert.match(hud, /className="jade-xp-pip/);
  assert.match(hud, /className="jade-xp-center"/);
  assert.match(css, /\.jade-xp-fill\s*\{[^}]*repeating-linear-gradient\(90deg, #ffe0a0 0 6px/s);
  assert.match(css, /\.jade-xp-center\s*\{[^}]*width:\s*39px/s);
  assert.doesNotMatch(hud, /jade-xp-emblem|jade-xp-under/);
});

test('three-card weapon selector renders real Damage, Defense, Ranged inventory slots', () => {
  assert.match(hud, /AXE_HUD_WEAPON_ROLES\.map\(row=>/);
  assert.match(hud, /drawAXEHUDWeaponRole\(role,\{level:playerLevel\|\|1\}\)/);
  assert.match(hud, /assignAXEHUDWeaponRole\(role,id\)/);
  assert.match(hud, /getOwnedWeaponsForAXERole\(assigning\)/);
  assert.match(hud, /addEventListener\('wheel',onWheel,\{passive:false\}\)/);
  assert.match(hud, /e\.code!=='KeyC'/);
  assert.match(hud, /aria-pressed=\{isActive\}/);
  assert.match(css, /\.jade-weapon-card\.is-active/);
  assert.match(css, /\.jade-weapon-chooser/);
  assert.match(css, /\.jade-weapon-c-arc/);
});

test('world chat and live weather stay mounted and outside the skill matrix', () => {
  assert.match(view, /<WorldChatPanel userId=\{user\?\.id\}/);
  assert.match(chat, /game3d-world-chat/);
  assert.match(chat, /fetchChatHistory\('world'\)/);
  assert.match(chat, /sendChatMessage\(tab, text\)/);
  assert.match(weather, /game3d-world-weather/);
  assert.match(weather, /game3d-weather-main/);
  assert.match(weather, /game3d-weather-forecast/);
  assert.match(css, /\.game3d-world-chat\s*\{/);
  assert.match(css, /\.game3d-view \.game3d-world-weather\s*\{/);
});

test('compact layouts and reduced-motion remain supported', () => {
  assert.match(css, /@media \(max-width: 1180px\)/);
  assert.match(css, /@media \(max-width: 860px\)/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
