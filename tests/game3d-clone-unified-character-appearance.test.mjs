import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  AXE_SERVICE_GROUPS,getAXEServiceGroup,getAXEServiceGroupForService,
} from '../src/components/game3d/axe/services/AXEServiceGroups.js';
import {createAXEServiceModeController}
  from '../src/components/game3d/axe/services/AXEServiceModeController.js';

const view = path => readFileSync(new URL('../src/components/game3d/axe/services/'+path, import.meta.url),'utf8');

test('the former Appearance service is now Character in its ORIGINAL navigation position',()=>{
  assert.deepEqual(AXE_SERVICE_GROUPS.map(group=>group.id),[
    'blacksmith','character','skills','quest_logbook','companion','spiritual',
  ]);
  assert.deepEqual(AXE_SERVICE_GROUPS.map(group=>group.label),[
    'Blacksmith','Character','Skill Book','Quest Logbook','Companion','Spiritual',
  ]);
  assert.equal(AXE_SERVICE_GROUPS.filter(group=>group.label==='Character').length,1);
  const character=getAXEServiceGroup('character');
  assert.equal(character.defaultServiceId,'character');
  assert.equal(character.presentation,'panel');
  for(const service of ['character','cape','vanity','costume','equipment_aura']){
    assert(character.serviceIds.includes(service),service);
    assert.equal(getAXEServiceGroupForService(service),character);
  }
  assert.equal(getAXEServiceGroup('appearance'),character);
});

test('old Appearance links and direct cosmetic requests open canonical Character session',async()=>{
  const summoned=[],entered=[];
  const controller=createAXEServiceModeController({
    summon:groupId=>{summoned.push(groupId);return {ok:false,reason:'test'};},
    enter:stationId=>{entered.push(stationId);return {ok:false,reason:'test'};},
    leave:()=>{},
  });
  await controller.open('appearance',{serviceId:'vanity'});
  assert.equal(controller.getSnapshot().groupId,'character');
  assert.equal(controller.getSnapshot().serviceId,'vanity');
  assert.equal(controller.getSnapshot().uiOnly,true);
  controller.selectOperation('costume');
  assert.equal(controller.getSnapshot().serviceId,'costume');
  assert.deepEqual(summoned,[]);
  assert.deepEqual(entered,[]);
  await controller.open('character');
  assert.equal(controller.getSnapshot().groupId,'character');
  assert.equal(controller.getSnapshot().serviceId,'character');
  controller.close();controller.dispose();
});

test('merged service mounts Appearance UI once and loads original Character inside it',()=>{
  const outer=view('AXEServiceWorkspace.jsx');
  assert.match(outer,/group\.id === 'character' \? 'axe-service-workspace--character axe-service-workspace--appearance'/);
  assert.match(outer,/group\.id === 'character' \? <div className="axe-service-progression">\s*<AppearanceWorkspace serviceId=\{mode\.serviceId\}/);
  assert.doesNotMatch(outer,/<CharacterWorkspace\s*\/>/);
  assert.match(outer,/onClose=\{onClose\}/);
  const appearance=view('AXEAppearanceWorkspace.jsx');
  assert.match(appearance,/const CharacterWorkspace = lazy\(\(\) => import\('\.\/AXECharacterWorkspace'\)\)/);
  assert.match(appearance,/<CharacterWorkspace embedded\s*\/>/);
  assert.match(appearance,/data-service-close className="axe-app-unified-close"/);
  assert.equal((appearance.match(/<CharacterWorkspace embedded\s*\/>/g)||[]).length,1);
});

test('Overview is gone; Character replaces its first tab and preserves every other subpage',()=>{
  const appearance=view('AXEAppearanceWorkspace.jsx');
  assert.match(appearance,/TAB_NAMES = \['Character', 'Equipment', 'Vanity', 'Costumes', 'Wings', 'Aura'\]/);
  assert.doesNotMatch(appearance, /\btab === 'Overview'\b/);
  assert.doesNotMatch(appearance,/\['Overview'/);
  assert.match(appearance,/serviceId === 'costume' \? 'Costumes' : 'Character'/);
  assert.match(appearance,/tab === 'Equipment' \? <AXEGlassLoadoutPane/);
  assert.match(appearance,/tab === 'Wings' \? <GlassCard/);
  assert.match(appearance,/tab === 'Aura' \? <GlassCard/);
  assert.doesNotMatch(view('AXEAppearanceDetails.jsx'),/tab === 'Overview'/);
});

test('the exact existing owned Outfits rail sits BESIDE the embedded Character equipment sheet',()=>{
  const appearance=view('AXEAppearanceWorkspace.jsx');
  assert.match(appearance,/const outfitRail = \(<aside className="axe-app-rail" aria-label="Costume wardrobe outfits">/);
  assert.match(appearance,/ownedCostumes\.map\(def => <button/);
  assert.match(appearance,/tab === 'Character' \? <div className="axe-app-unified-character-layout">\s*\{outfitRail\}/);
  assert.match(appearance,/aria-label="Character 3D viewer, equipment, attributes and live statistics"/);
  assert.match(appearance,/equipAXECostume\(def\.id\)/);
  assert.match(appearance,/if\(tab==='Character'\)/);
  assert.match(appearance,/onClick=\{\(\) => selectOutfit\(def\)\}/);
  const css=view('AXEAppearanceWorkspace.css');
  assert.match(css,/\.axe-app-unified-character-layout\s*\{[^}]*grid-template-columns:clamp\(76px,8\.8vw,126px\) minmax\(0,1fr\);/);
  assert.match(css,/\.axe-app-unified-character-layout > \.axe-app-rail/);
});

test('the original Character sheet is embedded WITHOUT duplicate model, header or lost attributes',()=>{
  const character=view('AXECharacterWorkspace.jsx');
  assert.match(character,/function AXECharacterWorkspace\(\{ embedded=false \} = \{\}\)/);
  assert.match(character,/!embedded&&<div className="axe-app-brand"/);
  assert.match(character,/axe-char-root--embedded/);
  assert.match(character,/<PlayerModel\s*\/>/);
  assert.match(character,/CHARACTER_DISPLAY_SLOTS\.slice/);
  assert.match(character,/applyAttributeAllocationPlan\(plan\)/);
  assert.match(character,/<h3>Character Stats<\/h3>/);
  assert.match(character,/Combat &amp; Secondary Stats/);
  assert.match(character,/getActiveCharacter/);
  const css=view('AXECharacterWorkspace.css');
  assert.match(css,/\.axe-char-root--embedded \.axe-char-layout/);
  assert.match(css,/\.axe-char-root--embedded \.axe-char-stats-column/);
  assert.match(css,/\.axe-app-unified-character-panel > \.axe-char-root--embedded/);
});

test('the original Services close action, appearance controls, and outfit transaction remain usable',()=>{
  const outer=view('AXEServiceWorkspace.jsx');
  const app=view('AXEAppearanceWorkspace.jsx');
  assert.match(outer,/onKeyDown=\{event => \{/);
  assert.match(app,/aria-label="Close Character" onClick=\{onClose\}/);
  assert.match(app,/equipAXEVanityPiece\(item\.id\)/);
  assert.match(app,/equipAXECostume\(item\.id\)/);
  assert.match(app,/onDoubleClick=\{\(\) => equipFromInventory\(item\)\}/);
  assert.match(app,/onDoubleClick=\{\(\)=>\{const result=selectAppearanceAuraSource\(aura\.id\)/);
});
