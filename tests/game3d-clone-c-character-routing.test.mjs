import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getAXECharacterShortcutAction } from '../src/components/game3d/axe/services/AXECharacterShortcutRouting.mjs';
import { getGame3DMenuShortcut } from '../src/components/game3d/axe/services/game3dMenuHotkeys.mjs';
import { getAXEServiceGroup } from '../src/components/game3d/axe/services/AXEServiceGroups.js';

const source=path=>readFileSync(path,'utf8');
const keyEvent=code=>({
  code,repeat:false,defaultPrevented:false,ctrlKey:false,altKey:false,
  metaKey:false,shiftKey:false,isComposing:false,target:null,
});

test('the unmodified C key still belongs to Character and not combat or old hub',()=>{
  assert.equal(getGame3DMenuShortcut(keyEvent('KeyC')),'character');
  assert.equal(getGame3DMenuShortcut({...keyEvent('KeyC'),shiftKey:true}),null);
  assert.equal(getAXEServiceGroup('character')?.defaultServiceId,'character');
  assert.equal(getAXEServiceGroup('appearance')?.id,'character','Appearance is consolidated into Character');
});

test('C opens the modern Character subpage when closed, regardless of old hub history',()=>{
  assert.equal(getAXECharacterShortcutAction({activeGroupId:null}),'open');
  assert.equal(getAXECharacterShortcutAction({activeGroupId:'blacksmith'}),'open');
  assert.equal(getAXECharacterShortcutAction({
    activeGroupId:null,legacyHubOpen:true,activeTab:'attributes',
  }),'open');
});

test('C changes Equipment/Vanity/Aura back to Character, then C again closes',()=>{
  for(const activeTab of ['Equipment','Vanity','Aura'])
    assert.equal(getAXECharacterShortcutAction({
      activeGroupId:'character',activeTab,
    }),'focus',activeTab);
  assert.equal(getAXECharacterShortcutAction({
    activeGroupId:'character',activeTab:'Character',
  }),'close');
});

test('GameView C no longer renders the old AttributesTab CharacterProgressionMenu',()=>{
  const game=source('src/pages/GameView.jsx');
  assert.match(game,/const action = getAXECharacterShortcutAction\(\{/);
  assert.match(game,/void services\.controller\.open\('character', \{ serviceId: 'character' \}\)/);
  assert.match(game,/setProgressionOpen\(false\)/);
  assert.match(game,/setFocusCharacterRequest\(value => value \+ 1\)/);
  assert.match(game,/onCharacterTabChange=\{setActiveCharacterSubview\}/);
  assert.doesNotMatch(game,/setRequestedCharacterTab\(closingCharacter \? null : 'attributes'\)/);
  assert.match(game,/<CharacterProgressionMenu[\s\S]*?isOpen=\{progressionOpen\}/,
    'legacy inventory events retain their separate route rather than breaking callers');
});

test('modern services host forwards visible-tab tracking and C-key focus request',()=>{
  const host=source('src/components/game3d/axe/services/AXEServiceWorkspace.jsx');
  const appearance=source('src/components/game3d/axe/services/AXEAppearanceWorkspace.jsx');
  assert.match(host,/onActiveTabChange=\{onCharacterTabChange\}/);
  assert.match(host,/focusCharacterRequest=\{focusCharacterRequest\}/);
  assert.match(appearance,/onActiveTabChange\?\.\(tab\)/);
  assert.match(appearance,/if \(focusCharacterRequest > 0\) setTab\('Character'\)/);
  assert.match(appearance,/const TAB_NAMES = \['Character', 'Equipment', 'Vanity', 'Aura'\]/);
  assert.match(appearance,/<CharacterWorkspace embedded\s*\/>/);
  assert.match(appearance,/<AXEGlassLoadoutPane actor="player"/);
});

test('new Character workspace has the live 3D viewer, equipment slots and attribute allocation',()=>{
  const modern=source('src/components/game3d/axe/services/AXECharacterWorkspace.jsx');
  assert.match(modern,/EquipmentPreview3D/);
  assert.match(modern,/CHARACTER_DISPLAY_SLOTS/);
  assert.match(modern,/subscribeAXEEquipmentInventory/);
  assert.match(modern,/applyAttributeAllocationPlan\(plan\)/);
  assert.match(modern,/getActiveCharacter/);
});
