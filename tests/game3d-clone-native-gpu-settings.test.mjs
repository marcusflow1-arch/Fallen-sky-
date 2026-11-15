import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CLONE_GPU_PROFILE_KEY,CLONE_GPU_PROFILES,normalizeCloneGPUProfile,
  rendererPixelRatioLimit} from '../src/components/game3d/performance/AdaptiveGraphics.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const menu=read('src/components/game3d/PauseMenu.jsx');
const page=read('src/pages/GameView.jsx');
const bootstrap=read('src/components/game3d/performance/Game3DPerformanceBootstrap.jsx');
test('native shared Graphics settings expose all available clone GPU render profiles',()=>{
 assert.equal(CLONE_GPU_PROFILE_KEY,'axe3d_clone_gpu_profile_v1');
 assert.deepEqual(CLONE_GPU_PROFILES,['auto','performance','balanced','quality','off']);
 assert.equal(normalizeCloneGPUProfile('wrong'),'auto');
 assert.match(menu,/GPU render profile/);
 assert.match(menu,/onPick=\{changeGpuProfile\}/);
 assert.match(menu,/CLONE_GPU_PROFILE_KEY/);
 assert.match(menu,/__axe3dCloneGovernor\?\.setProfile/);
 assert.match(menu,/game3dCloneGPUProfileChanged/);
});
test('GPU profile controls real adaptive pixel ratio, never combat or terrain',()=>{
 assert.equal(rendererPixelRatioLimit({profile:'performance',devicePixelRatio:2}),.75);
 assert.equal(rendererPixelRatioLimit({profile:'balanced',devicePixelRatio:2}),1);
 assert.equal(rendererPixelRatioLimit({profile:'quality',devicePixelRatio:2}),1.5);
 assert.match(menu,/Performance metrics \(FPS \/ GPU \/ CPU\)/);
 assert.match(menu,/game3dRenderStatsChanged/);
 assert.doesNotMatch(menu,/combatSystem\.applyDamage|clearWolfveilTownInterior/);
});
test('bottom-left GPU/FPS floating control is disabled without stopping the governor',()=>{
 assert.match(page,/Game3DPerformanceBootstrap region=\{worldRegion\} showPanel=\{false\}/);
 assert.match(bootstrap,/createCloneAdaptiveGraphics\(\{ renderer \}\)/);
 assert.match(bootstrap,/return <CloneHardwarePanel visible=\{showPanel\} \/>/);
});
