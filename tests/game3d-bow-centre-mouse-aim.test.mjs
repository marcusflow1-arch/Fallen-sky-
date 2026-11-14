import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const world = read('src/components/game3d/GameWorld3D.jsx');
const cameraMath = read('src/components/game3d/player/otsAim.mjs');
const store = read('src/components/game3d/player/otsAimStore.js');
const frame = read('src/components/game3d/player/otsAimRuntime.js');
const reticle = read('src/components/game3d/hud/OTSAimReticle.jsx');
const css = read('src/components/game3d/hud/OTSAimReticle.css');

test('bow aim stays third person with subtle field-of-view change',()=>{
 assert.match(cameraMath,/fov:\s*46\b/);
 assert.match(cameraMath,/boom:\s*3\.0\b/);
 assert.doesNotMatch(cameraMath,/fov:\s*34\b/);
});

test('centre aim point is present with bow equipped even without aim hold',()=>{
 assert.match(store,/bowEquipped:\s*false/);
 assert.match(store,/blocked:\s*false/);
 assert.match(frame,/publishOTSAim\(\{ aiming: aim\.aiming, side: aim\.side, bowEquipped, blocked \}\)/);
 assert.match(reticle,/\(aim\.bowEquipped \|\| aim\.aiming\) && !aim\.blocked/);
 assert.match(css,/left:\s*50%;/);
 assert.match(css,/top:\s*50%;/);
 assert.doesNotMatch(css,/is-active\.is-left\s*\{[^}]*translateX/);
});

test('mouse movement drives camera under pointer lock; click-to-move cannot consume bow shot',()=>{
 assert.match(world,/getActiveWeaponPath\(\)!=='ranged' && isAXEClickToMoveEnabled\(\)/);
 assert.match(world,/if \(getActiveWeaponPath\(\)==='ranged' && !altCursorHeld\.current/);
 assert.match(world,/renderer\.domElement\.requestPointerLock\?\.\(\)/);
 assert.match(world,/captured \? e\.movementX : e\.clientX - drag\.current\.x/);
 assert.match(world,/applyGame3DGame2MouseLook\(orbit\.current, dx, dy\)/);
 assert.match(world,/bowEquipped:getActiveWeaponPath\(\)==='ranged'&&!isMountedRef\.current/);
});

test('bow selection always leaves camera steering to mouse, not an automatic lock',()=>{
 const camera = read('src/components/game3d/player/PlayerCameraSystem.jsx');
 assert.match(world,/otsAim\.current\.bowEquipped=getActiveWeaponPath\(\)==='ranged'/);
 assert.match(camera,/this\.aim\?\.bowEquipped\|\|!isAXEAutoTargetNearbyEnabled\(\)/);
 assert.match(camera,/aimBlend<=\.0001&&!this\.aim\?\.bowEquipped/);
 assert.match(cameraMath,/!aim\.aiming && !aim\.bowEquipped/);
});

test('bow hits use exact camera centre independently of melee target fan',()=>{
 const bow = read('src/components/game3d/combat/BowCameraAim.mjs');
 assert.match(bow,/setFromCamera\(\{x:0,y:0\},camera\)/);
 assert.match(world,/selectCameraBowTarget\(\{/);
 assert.match(world,/activeWeaponPath==='ranged' && aoeRadius===0/);
 assert.match(world,/if\(appliedDamage>0&&activeWeaponPath==='ranged'\)/);
});
