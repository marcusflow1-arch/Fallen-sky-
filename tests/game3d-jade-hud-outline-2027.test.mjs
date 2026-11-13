import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const hud=read('src/components/game3d/hud/JadeSoulHUD.jsx');
const css=read('src/components/game3d/hud/JadeSoulHUD.css');
const quest=read('src/components/game3d/hud/JadeQuestTracker.css');
const map=read('src/components/game3d/hud/AXEWorldMapOverlay.css');
const game=read('src/components/game3d/hud/GameHUD.jsx');
test('new 2027 HUD is mounted through the real Game 3D renderer',()=>{
 assert.match(game,/import JadeSoulHUD from '\.\/JadeSoulHUD'/);
 assert.match(game,/<JadeSoulHUD\b/);
});
test('all ten skill slots display together on the right; old left grid stays removed',()=>{
 assert.match(hud,/function SkillMatrix\(\{ loadout \}\)/);
 assert.match(hud,/Array\.from\(\{ length: ACTIVE_SLOTS \}/);
 assert.match(hud,/import \{ ACTIVE_SLOTS, getLoadout, subscribeLoadout \}/);
 assert.match(hud,/<SkillMatrix loadout=\{loadout\}\/>/);
 assert.doesNotMatch(hud,/<DiamondSlots\b/);
 assert.match(css,/\.jade-ability-matrix\s*\{[^}]*right:/);
});
test('all ten slot indices keep the original 1–9/0 game bindings',()=>{
 assert.match(hud,/loadout\?\.activeSlots\?\.\[index\]/);
 assert.match(hud,/loadout\?\.cooldowns\?\.\[index\]/);
 assert.match(hud,/data-slot=\{index \+ 1\}/);
 assert.match(hud,/const SKILL_KEYS = \['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'\]/);
 assert.match(hud,/\{key\}<\/span>/);
 assert.match(hud,/data-equipped=\{id \? 'yes' : 'no'\}/);
});
test('skill icons and titles come from the actual registry, not mock art',()=>{
 assert.match(hud,/import \{ getSkillById \} from '\.\.\/skills\/skillRegistry'/);
 assert.match(hud,/skill\?\.skill_name/);
 assert.match(hud,/skill\?\.icon/);
 assert.match(hud,/data-equipped=\{id \? 'yes' : 'no'\}/);
});
test('skill matrix has NO surrounding framed panel, square or circle',()=>{
 const start=css.indexOf('.jade-ability-matrix {');
 const body=css.slice(start,css.indexOf('}',start)+1);
 assert.match(body,/background:\s*none/);
 assert.match(body,/border:\s*0/);
 assert.match(body,/box-shadow:\s*none/);
 assert.doesNotMatch(body,/border-radius|background-image|radial-gradient/);
});
test('individual slots are clear outline diamonds with transparent interiors',()=>{
 assert.match(css,/\.jade-ability-matrix \.jade-skill-slot\s*\{[^}]*transform:\s*translateY\(var\(--jade-arc-rise, 0px\)\) rotate\(45deg\)/s);
 assert.match(css,/\.jade-ability-matrix \.jade-skill-slot\s*\{[^}]*background:\s*transparent/s);
 assert.match(css,/\.jade-ability-matrix \.jade-skill-slot\s*\{[^}]*border:\s*2px solid/s);
 assert.match(css,/\.jade-ability-matrix \.jade-skill-slot--buff/);
});
test('two open-air banks of five are smaller and arc upward on the right',()=>{
 assert.match(css,/grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/);
 assert.match(css,/grid-template-rows:\s*repeat\(2, minmax\(0, 1fr\)\)/);
 assert.match(css,/width:\s*clamp\(35px, 3\.1vw, 46px\)/);
 assert.match(hud,/const SKILL_ARC_RISE = \[10, 7, 0, -11, -24\]/);
 assert.match(hud,/index % 5/);
 assert.doesNotMatch(hud,/jade-ability-matrix-star/);
});
test('HP Will Stamina are slim and XP uses segmented gold progression',()=>{
 assert.match(css,/\.jade-status-track\s*\{[^}]*height:\s*12px/s);
 assert.match(css,/\.jade-xp-fill\s*\{[^}]*repeating-linear-gradient\(90deg, #ffe0a0 0 6px/s);
 assert.match(css,/\.jade-xp-center\s*\{[^}]*width:\s*39px/s);
});
test('weapon selection retains quick switching, now by three real weapon roles',()=>{
  assert.match(hud,/function WeaponStack\(\{ playerLevel \}\)/);
  assert.match(hud,/AXE_HUD_WEAPON_ROLES\.map\(row=>/);
  assert.match(hud,/drawAXEHUDWeaponRole\(role,\{level:playerLevel\|\|1\}\)/);
  assert.match(hud,/addEventListener\('wheel',onWheel,\{passive:false\}\)/);
  assert.match(hud,/<WeaponStack playerLevel=\{hud\?\.level\} \/>/);
});
test('XP center diamond and small dots are children of a single live rail',()=>{
 const start=hud.indexOf('className="jade-xp-rail"');
 const end=hud.indexOf('className="jade-xp-level"',start);
 const rail=hud.slice(start,end);
 assert.match(rail,/jade-xp-fill/);
 assert.match(rail,/jade-xp-pip/);
 assert.match(rail,/jade-xp-center/);
 assert.match(rail,/width: \`\$\{xpPct\}%\`/);
 assert.doesNotMatch(hud,/jade-xp-under|jade-xp-emblem/);
 assert.match(css,/\.jade-xp-rail\s*\{[^}]*clip-path:\s*none/s);
});
test('HP, Will and Stamina each use real store values, not screenshot placeholders',()=>{
 for(const label of ['HP','WILL','STAMINA'])assert(hud.includes('>'+label+'</span>'));
 for(const className of ['jade-status-fill--hp','jade-status-fill--will','jade-status-fill--stamina'])
  assert(hud.includes(className));
 assert.match(hud,/getPlayerHUD/);
 assert.match(hud,/getCombatResources/);
});
test('real quest navigation and interactive map route stay active',()=>{
 assert.match(hud,/axeOpenWorldMap/);
 assert.match(hud,/createPortal\(<AXEWorldMapOverlay/);
 assert.match(hud,/<JadeQuestTracker/);
 assert.match(quest,/jade-quest-tracker-entry\[data-tracked="true"\]/);
 assert.match(map,/axe-world-map-filters>button\[aria-pressed="true"\]/);
});
test('responsive layouts and reduced motion are included',()=>{
 assert.match(css,/@media \(max-width: 860px\)/);
 assert.match(css,/@media \(max-width: 620px\)/);
 assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
});
