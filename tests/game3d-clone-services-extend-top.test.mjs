// Clone Game 3D: regression guard against navigation-dependent Services tops.
// The visual implementation remains CSS-driven; no per-service JS sizing hooks.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AXE_SERVICE_GROUPS} from '../src/components/game3d/axe/services/AXEServiceGroups.js';

const file=path=>readFileSync(new URL('../src/components/game3d/axe/services/'+path,import.meta.url),'utf8');
const css=file('AXEServiceWorkspace.css');
const component=file('AXEServiceWorkspace.jsx');

test('every owner-visible Services destination uses the same top-extended workspace',()=>{
  assert.deepEqual(AXE_SERVICE_GROUPS.map(s=>s.id),[
    'blacksmith','character','skills','quest_logbook',
    'appearance','companion','spiritual',
  ]);
  assert.match(component,/getAXEServiceGroup\(mode\.groupId\)/);
  assert.match(component,/data-service-extent="viewport-top"/);
  // Main GameView renders exactly this wrapper for every service mode.
  const view=readFileSync(new URL('../src/pages/GameView.jsx',import.meta.url),'utf8');
  assert.match(view,/services\.active && <AXEServiceWorkspace mode=\{services\}/);
});

test('outer frame begins at game viewport y=0 despite per-service top/inset shorthands',()=>{
  assert.match(css,/\.game3d-view \.axe-service-workspace\[data-service-extent="viewport-top"\]\s*\{\s*top:\s*0\s*!important;/);
  assert.match(css,/max-height:\s*none;/);
  // Unlike changing height, a top longhand preserves each panel's existing
  // left, right, bottom and responsive edges.
  const mainRule=css.match(/\.game3d-view \.axe-service-workspace\[data-service-extent="viewport-top"\]\s*\{([^}]*)\}/)?.[1];
  assert(mainRule);
  assert.doesNotMatch(mainRule,/\binset\s*:|\bleft\s*:|\bright\s*:|\bbottom\s*:|\bwidth\s*:/);
});

test('all distinct service panels may overlap top sub-buttons without moving the navigation',()=>{
  const files=[
    'AXEBlacksmithImageWorkspace.css','AXECharacterWorkspace.css',
    'AXESkillBookWorkspace.css','AXEQuestLogbookWorkspace.css',
    'AXEAppearanceWorkspace.css','AXECompanionWorkspace.css',
    'AXESpiritualWorkspace.css',
  ];
  for(const name of files)assert(file(name).length>100, name);
  assert.match(css,/navigation may intentionally overlap/i);
  const nav=file('AXEServicesNavigation.jsx');
  assert.match(nav,/className="jade-services-navigation"/);
  assert.match(nav,/className="jade-services-options"/);
});

test('blacksmith art is visible at y=0 instead of being clipped by old negative margin',()=>{
  assert.match(css,/\.axe-service-workspace--blacksmith \.axe-blacksmith-viewport\s*\{\s*margin-top:\s*0\s*!important;/);
  assert.match(css,/\.axe-service-workspace--blacksmith \.axe-service-heading\s*\{\s*position:\s*absolute;/);
  assert.match(file('AXEBlacksmithImageWorkspace.css'),/margin-top:clamp\(-155px,-9vw,-82px\)/);
});

test('mobile and short display modes also use the viewport top without hiding scrolling',()=>{
  assert.match(css,/@media \(max-width: 760px\), \(max-height: 600px\)/);
  assert.match(css,/\.axe-service-progression \{[^}]*overflow:auto;/);
  assert.match(file('AXECompanionWorkspace.css'),/\.axe-comp-body/);
  assert.match(file('AXESkillBookWorkspace.css'),/\.axe-skill-book-root/);
  assert.match(file('AXEQuestLogbookWorkspace.css'),/\.axe-quest-logbook-root/);
});
