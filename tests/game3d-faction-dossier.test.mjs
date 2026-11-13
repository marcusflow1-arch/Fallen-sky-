import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import { AXE_FACTIONS } from '../src/components/game3d/axe/factions/AXEFactionWeaponConfig.js';
import { FACTION_DOSSIERS, getFactionDossier } from '../src/components/game3d/axe/factions/factionDossierPresentation.mjs';
import { GAME3D_FACTION_MOUNTS } from '../src/components/game3d/axe/factions/AXEFactionMountAssets.mjs';
import { AXE_ARMOR_PACK_SETS } from '../src/components/game3d/axe/equipment/AXEArmorPackCatalog.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ui=read('src/components/game3d/CharacterLoginScreen.jsx');
const dossier=read('src/components/game3d/axe/factions/FactionDossier.jsx');
const css=read('src/components/game3d/CharacterFactionDossier.css');

test('every canonical selectable faction has the correct real mount and existing armor-set motif',()=>{
  assert.equal(AXE_FACTIONS.length,3);
  const mounts=['Fantasy Bear','Armored Wolf','Fantasy Tiger'];
  for(const [index,faction] of AXE_FACTIONS.entries()){
    const data=getFactionDossier(faction.id);
    assert.ok(data,`Missing dossier for ${faction.id}`);
    assert.equal(data.beastName,mounts[index]);
    assert.equal(data.beastName,GAME3D_FACTION_MOUNTS[faction.id].name);
    assert.ok(AXE_ARMOR_PACK_SETS.some(set=>set.id===data.armorSetId && set.label===data.armorName));
    assert.ok(data.description.length>50);
    assert.ok(data.homelandName && data.homelandNote);
    assert.match(data.rgb,/^\d+,\d+,\d+$/);
  }
  assert.equal(getFactionDossier('AXE_Faction_invalid'),null);
  assert.equal(Object.keys(FACTION_DOSSIERS).length,3);
});

test('left rail only previews and the right action alone confirms a faction',()=>{
  assert.match(ui,/useState\(AXE_FACTIONS\[0\]\.id\)/);
  assert.match(ui,/<FactionDossier\s+activeId=\{factionPreviewId\}/);
  assert.match(ui,/onPreview=\{setFactionPreviewId\}/);
  assert.match(ui,/onChoose=\{factionId=>\{/);
  assert.match(ui,/AXE_FACTIONS\.some\(faction=>faction\.id===factionId\)/);
  assert.match(ui,/setSelectedFaction\(factionId\);\s*setStep\('creator'\);\s*setShowCreate\(true\);/);
  assert.match(ui,/onBack=\{\(\)=>setStep\(selectableCharacters\.length\?'select':'start'\)\}/);
  assert.match(dossier,/onClick=\{\(\)=>onPreview\(faction\.id\)\}/);
  assert.match(dossier,/onClick=\{\(\)=>onChoose\(activeFaction\.id\)\}/);
  assert.match(dossier,/aria-pressed=\{activeFaction\.id===faction\.id\}/);
  assert.match(dossier,/aria-controls="axe-fd-details"/);
  assert.match(dossier,/aria-live="polite"/);
  assert.ok(ui.indexOf("import './CharacterFactionDossier.css';")>ui.indexOf("import './CharacterSelectionRefinement.css';"));
  assert.doesNotMatch(ui,/<section className="axe-login-character-panel axe-login-faction-panel"/);
  assert.match(ui,/embedded factionId=\{selectedFaction\}/);
});

test('right dossier shows the current symbol, actual armor-set styling and homeland illustration',()=>{
  for(const marker of [
    '<AncestralBeast kind={detail.beast}/>','<ArmorIllustration kind={detail.beast}/>',
    '<HomelandIllustration scene={detail.scene}/>','detail.description',
    'detail.beastName','detail.armorName','detail.armorNote',
    'detail.homelandName','detail.homelandNote','ARMOR STYLE',
    'HOMELAND VISION','Choose {activeFaction.displayName}',
    'no armor is automatically equipped or restricted',
  ]) assert.ok(dossier.includes(marker),`Missing ${marker}`);
  assert.doesNotMatch(dossier,/https?:\/\//);
});

test('faction UI is independent of the old centered glass box, with ripples and fade',()=>{
  assert.match(css,/\[data-entry-step="faction"\] \.axe-fd-stage\{/);
  assert.match(css,/grid-template-columns:minmax\(240px/);
  assert.match(css,/\.axe-fd-options\{\s*display:flex;flex-direction:column/);
  assert.match(css,/\.axe-fd-option\{[\s\S]*?border-bottom:1px/);
  assert.match(css,/\.axe-fd-ripple\{/);
  assert.match(css,/\.axe-fd-details\{[\s\S]*?backdrop-filter:blur\(18px\)/);
  assert.match(css,/mask-image:linear-gradient\(90deg,transparent,#000 12%/);
  assert.match(css,/@media\(max-width:700px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/\.axe-login-page-title\{display:none\}/);
  assert.doesNotMatch(css,/url\(|\.png|\.jpg|\.mp4|\.webm/i);
});

test('faction UI stays presentation-only and leaves real character stats unchanged',()=>{
  const data=read('src/components/game3d/axe/factions/factionDossierPresentation.mjs');
  assert.doesNotMatch(data,/localStorage|sessionStorage|fetch\(|base44\.entities/);
  assert.doesNotMatch(dossier,/setPlayerHUD|createCharacter|inventory|grantArmor|setMount/);
  assert.match(ui,/onCreated=\{created=>/);
});
