import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GAME3D_PAUSE_SECTIONS,game3dPauseEscape,game3dPauseGraphicsDefaults}
  from '../src/components/game3d/game3dPauseMenuModel.mjs';

const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const pause=file('src/components/game3d/PauseMenu.jsx');
const css=file('src/components/game3d/PauseMenu.css');
const entry=file('src/components/game3d/CharacterLoginScreen.jsx');
const page=file('src/pages/GameView.jsx');

test('one Game 3D menu serves title and in-world without exposing leave-world actions at title',()=>{
  assert.match(entry,/import PauseMenu from '\.\/PauseMenu'/);
  assert.match(entry,/<PauseMenu context="entry" open=\{settingsOpen && step==='start'\}/);
  assert.match(pause,/context='world'/);
  assert.match(pause,/GAME3D_PAUSE_SECTIONS\.filter\(section=>section\.id!=='session'\)/);
  assert.match(pause,/view==='session'&&!entry/);
  assert.match(pause,/entry\?'Back to Title':'Continue Game'/);
  assert.match(pause,/entry\?'Return to Title':'Return to World'/);
  assert.deepEqual(GAME3D_PAUSE_SECTIONS.map(section=>section.id),
    ['overview','audio','controls','graphics','community','session']);
});

test('audio graphics controls and menu motion preserve the existing live settings backend',()=>{
  assert.match(entry,/volume=\{initialMusicVolume\}/);
  assert.match(entry,/onVolumeChange=\{value=>onMusicVolumeChange\?\.\(value\)\}/);
  assert.match(page,/volume=\{themeVolume\}/);
  assert.match(page,/onVolumeChange=\{setThemeVolume\}/);
  assert.match(pause,/localStorage\.setItem\('game_graphics_settings'/);
  assert.match(pause,/graphicsSettingsChanged/);
  assert.match(pause,/getAXEControlSettings/);
  assert.match(pause,/setAXEClickToMoveEnabled/);
  assert.match(pause,/setAXEAutoTargetNearbyEnabled/);
  assert.match(pause,/Middle-click/);
  assert.match(pause,/checked=\{controls\.autoTargetNearby\}/);
  assert.match(pause,/game3d_menu_motion/);
  assert.match(entry,/onMotionChange=\{setMotionEnabled\}/);
  const settings=game3dPauseGraphicsDefaults({artStyle:'original',quality:'ultra',fpsCap:144});
  assert.equal(settings.artStyle,'original');
  assert.equal(settings.quality,'ultra');
  assert.equal(settings.fpsCap,144);
});

test('full-screen translucent console visual treatment keeps selections visible without setting cards',()=>{
  assert.match(css,/width:100%;max-width:none;height:100dvh;max-height:none/);
  assert.match(css,/backdrop-filter:blur\(17px\) saturate\(130%\)/);
  assert.match(css,/\.axe3d-pause__surface,\.axe3d-pause__settings-grid>\.axe3d-pause__surface\{/);
  assert.match(css,/background:transparent;border:0;border-radius:0/);
  assert.match(css,/\.axe3d-pause__nav-item\.is-selected\{/);
  assert.match(css,/\.axe3d-pause__option\.is-selected\{/);
  assert.match(css,/@media\(max-width:700px\)/);
});

test('Escape and keyboard/controller-like vertical navigation do not trigger world hotkeys',()=>{
  assert.deepEqual(game3dPauseEscape('overview'),{close:true,view:'overview',confirmAction:null});
  assert.deepEqual(game3dPauseEscape('graphics'),{close:false,view:'overview',confirmAction:null});
  assert.match(pause,/event\.key==='ArrowDown'/);
  assert.match(pause,/event\.key==='ArrowUp'/);
  assert.match(pause,/event\.key==='Home'/);
  assert.match(pause,/event\.key==='End'/);
  assert.match(pause,/addEventListener\('keydown',onEscape,true\)/);
  assert.match(pause,/stopImmediatePropagation\(\)/);
  assert.match(pause,/window\.__axePauseMenuOpen=true/);
  assert.match(pause,/window\.__axePauseMenuOpen=false/);
});
