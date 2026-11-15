import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SKILL_BOOK_WEAPON_MODES,getWeaponRole,getWeaponForSkillBookMode,
  getSkillBookWeaponArt,getSkillBookModeForPreset}
  from '../src/components/game3d/axe/services/SkillBookWeaponModes.mjs';
import {AXE_SERVICE_GROUPS}
  from '../src/components/game3d/axe/services/AXEServiceGroups.js';

const source=path=>readFileSync(new URL('../src/components/game3d/axe/services/'+path,import.meta.url),'utf8');

const sword={instanceId:'sword_01',name:'True Heart Sword',category:'weapon',axeWeaponRole:'offensive',equipped:true};
const dagger={instanceId:'dagger_01',name:'Whisper Dagger',category:'weapon',axeWeaponRole:'defensive',equipped:false};
const bow={instanceId:'bow_01',name:'Training Bow',category:'weapon',axeWeaponRole:'ranged',
  equipped:false,iconUrl:'/game3d/test-gear/training-bow.svg'};
const inventory=[sword,dagger,bow,{instanceId:'hood',name:'Wanderer Hood',category:'helm'}];

test('three weapon-linked hotbar sets have stable original preset indices',()=>{
  assert.deepEqual(SKILL_BOOK_WEAPON_MODES.map(m=>m.label),['Damage','Range','Defense']);
  assert.deepEqual(SKILL_BOOK_WEAPON_MODES.map(m=>m.presetIndex),[0,1,2]);
  assert.equal(getSkillBookModeForPreset(1).id,'range');
  assert.equal(getSkillBookModeForPreset(2).id,'defense');
  assert.equal(getSkillBookModeForPreset(100).id,'damage');
});
test('weapon slots are populated ONLY from owned inventory and correct roles',()=>{
  assert.equal(getWeaponRole(sword),'offensive');
  assert.equal(getWeaponRole(dagger),'defensive');
  assert.equal(getWeaponRole(bow),'ranged');
  assert.equal(getWeaponRole(inventory[3]),null);
  assert.equal(getWeaponForSkillBookMode(inventory,'damage').instanceId,'sword_01');
  assert.equal(getWeaponForSkillBookMode(inventory,'range').instanceId,'bow_01');
  assert.equal(getWeaponForSkillBookMode(inventory,'defense').instanceId,'dagger_01');
  assert.equal(getWeaponForSkillBookMode([],'range'),null);
  assert.equal(getWeaponForSkillBookMode(inventory,'unknown'),null);
  assert.equal(getSkillBookWeaponArt(bow),'/game3d/test-gear/training-bow.svg');
  assert.equal(getSkillBookWeaponArt(dagger),null);
});
test('owned weapon selection prefers an explicitly selected instance then equipped',()=>{
  const other={...sword,instanceId:'sword_02',equipped:false};
  assert.equal(getWeaponForSkillBookMode([other,sword],'damage'),sword);
  assert.equal(getWeaponForSkillBookMode([other,sword],'damage','sword_02'),other);
});
test('skill book removes both vertical skill rails and exterior preset boxes',()=>{
  const jsx=source('AXESkillBookWorkspace.jsx');
  assert.doesNotMatch(jsx,/className="axe-skill-book-slots-vertical"/);
  assert.doesNotMatch(jsx,/<PresetRail\b/);
  assert.match(jsx,/SkillBookWeaponRail items=\{ownedWeapons\}/);
  assert.match(jsx,/SkillBookStanceStrip companion=\{companion\}/);
  assert.match(jsx,/className="axe-skill-book-hotbar"/);
  assert.match(jsx,/activeIds\.map\(\(id,i\) => <SlotButton/);
  assert.match(jsx,/switchAXEInventoryWeapon\(weapon\.instanceId\)/);
  assert.match(jsx,/selectSkillPreset\(mode\.presetIndex\)/);
  assert.match(jsx,/setRightFilter\(mode\.id\)/);
  const controls=source('SkillBookWeaponControls.jsx');
  assert.match(controls,/getWeaponForSkillBookMode\(items,mode\.id\)/);
  assert.match(controls,/getSkillBookWeaponArt\(item\)/);
  assert.match(controls,/aria-pressed=\{activeMode===mode\.id\}/);
});
test('scrollbar on duplicate vertical equip column is removed, actual skill grid scroll remains',()=>{
  const css=source('AXESkillBookWorkspace.css');
  assert.match(css,/\.axe-skill-book-layout \.axe-skill-book-slots-vertical\s*\{display:none;\}/);
  assert.match(css,/\.axe-skill-book-page-content \.axe-book-grid-scroll::-webkit-scrollbar\s*\{\s*display:none;/);
  assert.match(css,/\.axe-book-grid-scroll\s*\{[^}]*overflow-y:auto;/);
  assert.match(css,/data-weapon-slots="character"/);
  assert.match(css,/data-weapon-slots="companion"/);
});
test('all non-Blacksmith Services reduce top footprint 10%, Companion fills width',()=>{
  assert.deepEqual(AXE_SERVICE_GROUPS.map(group=>group.id),[
    'blacksmith','character','skills','quest_logbook','companion','spiritual']);
  const css=source('AXEServiceWorkspace.css');
  assert.match(css,/\[data-service-extent="viewport-top"\]:not\(\.axe-service-workspace--blacksmith\)\s*\{\s*top:clamp\(62px,10dvh,110px\)!important;/);
  assert.match(css,/\.axe-service-workspace--companion\s*\{\s*left:0!important;right:0!important;/);
  assert.match(css,/\.axe-comp-root\s*\{\s*width:100%;max-width:none;/);
  assert.match(css,/\[data-service-extent="viewport-top"\]\.axe-service-workspace--blacksmith/);
});
test('Services navigation is clickable above active workspaces, including Blacksmith',()=>{
  const css=source('AXEServiceWorkspace.css');
  assert.match(css,/\[data-service-mode="true"\] \.jade-hud \{z-index:90;\}/);
  assert.match(css,/\[data-service-mode="true"\] \.jade-services-navigation \{\s*z-index:92;pointer-events:auto;/);
  assert.match(source('AXEServiceWorkspace.jsx'),/mode\.controller\.selectOperation\(id\)/);
  assert.match(source('AXEServicesNavigation.jsx'),/onSelectGroup\?\.\(group\.id\)/);
});
test('Blacksmith forge dimensions are preserved, only its label moves above inventory',()=>{
  const css=source('AXEBlacksmithImageWorkspace.css');
  assert.match(css,/\.axe-blacksmith-live-heading\s*\{\s*left:3\.4%;\s*top:8\.8%;\s*width:28\.8%;/);
  assert.match(css,/\.axe-blacksmith-inventory-shell\s*\{[\s\S]*?top:15\.0%;/);
  assert.match(css,/\.axe-blacksmith-image-tabs\s*\{[\s\S]*?grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
  assert.match(css,/pointer-events:none;/);
});
