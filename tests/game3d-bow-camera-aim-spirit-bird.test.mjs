import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import { BOW_AIM_SETTINGS,selectCameraBowTarget,cameraBowImpactPoint,
  pickCameraBowCombatTargets } from '../src/components/game3d/combat/BowCameraAim.mjs';
import {createGame3DBowAimVisuals} from '../src/components/game3d/vfx/Game3DBowSpiritBird.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const makeCamera=()=>{const c=new THREE.PerspectiveCamera(55,16/9,.1,200);
  c.position.set(0,2,8);c.lookAt(0,1.4,0);c.updateMatrixWorld(true);return c;};
const enemy=(id,x=0,z=0)=>{
 const group=new THREE.Group();group.position.set(x,1.4,z);
 group.add(new THREE.Mesh(new THREE.SphereGeometry(.65,12,8),new THREE.MeshBasicMaterial()));
 group.updateMatrixWorld(true);
 return {id,name:id,alive:true,hp:100,group};
};
const base=()=>({camera:makeCamera(),origin:new THREE.Vector3(0,0,5),maxRange:12});

test('the small centre dot selects a real enemy hit, not the old 150 degree frontal fan',()=>{
 const straight=enemy('straight'),offAxis=enemy('off-axis',5,0);
 const hit=selectCameraBowTarget({...base(),enemies:[offAxis,straight]});
 assert.equal(hit?.target,straight);
 assert.equal(hit.rayHit,true);
 assert.equal(pickCameraBowCombatTargets({...base(),enemies:[offAxis,straight]})[0]?.target,straight);
 assert.ok(BOW_AIM_SETTINGS.edgeNdc<.1);
});
test('camera dot does not silently acquire off-axis enemies even when selected as a lock',()=>{
 const wide=enemy('wide',5,0);
 assert.equal(selectCameraBowTarget({...base(),enemies:[wide]}),null);
 assert.equal(selectCameraBowTarget({...base(),enemies:[wide],lockedEnemyId:'wide'}),null);
});
test('dead, invisible and out-of-range enemies never receive bow hits',()=>{
 const dead=enemy('dead');dead.alive=false;
 const hidden=enemy('hidden');hidden.group.visible=false;
 const distant=enemy('distant',0,-22);
 assert.equal(selectCameraBowTarget({...base(),enemies:[dead,hidden,distant]}),null);
});
test('a solid wall between the camera and target blocks the arrow hit',()=>{
 const wall=new THREE.Mesh(new THREE.BoxGeometry(4,4,.2),new THREE.MeshBasicMaterial());
 wall.position.set(0,1.4,4);wall.updateMatrixWorld(true);
 const hit=selectCameraBowTarget({...base(),enemies:[enemy('blocked')],groundMeshes:[wall]});
 assert.equal(hit,null);
});
test('free bow shots have a finite line-of-sight endpoint with no phantom target',()=>{
 const point=cameraBowImpactPoint(makeCamera(),[],40);
 assert.ok([point.x,point.y,point.z].every(Number.isFinite));
 assert.ok(Math.abs(makeCamera().position.distanceTo(point)-40)<.02);
});
test('the spirit-bird is VFX only, animates, caps allocations and disposes cleanly',()=>{
 const scene=new THREE.Scene(),vfx=createGame3DBowAimVisuals({scene,container:{}});
 assert.equal(vfx.fire({origin:{x:0,y:0,z:5},target:{x:0,y:1,z:0}}),true);
 assert.equal(scene.children.length,1);
 for(let i=0;i<16;i++)vfx.update(.05,{active:true});
 assert.equal(scene.children.length,0);
 for(let i=0;i<9;i++)vfx.fire({origin:{x:0,y:0,z:5},target:{x:i*.1,y:1,z:0}});
 assert.ok(scene.children.length<=6);
 vfx.confirmHit();vfx.dispose();
 assert.equal(scene.children.length,0);
});
test('the verified damage path is separate from reticle and bird visuals',()=>{
 const world=read('src/components/game3d/GameWorld3D.jsx');
 const bridge=read('src/components/game3d/rogueAttackBridge.jsx');
 const vfx=read('src/components/game3d/vfx/Game3DBowSpiritBird.mjs');
 assert.match(world,/selectCameraBowTarget\(\{/);
 assert.match(world,/activeWeaponPath==='ranged' && aoeRadius===0/);
 assert.match(world,/if\(appliedDamage>0&&activeWeaponPath==='ranged'\)/);
 assert.match(world,/bowVisuals\.fire/);
 assert.match(world,/bowVisuals\.dispose/);
 assert.match(world,/rangedClickAttackPressed\.current = (?:bowClick|getActiveWeaponPath\(\)==='ranged')/);
 assert.match(world,/__gw3dBowOccluders=bowOccluders/);
 assert.match(bridge,/const bowPriority=ranged\?resolveBowPriorityTarget\(\):null/);
 assert.match(bridge,/window\.addEventListener\('blur',onBlur\)/);
 assert.match(bridge,/lastRangedBaseDamage<=0/);
 assert.match(bridge,/game3dVerifiedBowHit/);
 assert.match(bridge,/if\(ranged\)\{lastRangedBaseDamage=0;return false;\}/);
 assert.doesNotMatch(bridge,/let bestDot = 0\.84/);
 assert.doesNotMatch(vfx,/combatSystem\.applyDamage|updateTargetHP|reportWeaponKill/);
});
