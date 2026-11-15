import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GAME3D_FACTION_MOUNTS,getGame3DStarterMountDefinitionId } from
  '../src/components/game3d/axe/factions/AXEFactionMountAssets.mjs';
import { FACTION_PET_RIG_PROFILES,combineNativeFactionPetClips,proceduralFactionPetGait } from
  '../src/components/game3d/character/factionPetAnimationRigs.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('each faction gets its own established companion and starter mount ID',()=>{
 assert.deepEqual(Object.keys(GAME3D_FACTION_MOUNTS),['AXE_Faction_1','AXE_Faction_2','AXE_Faction_3']);
 assert.equal(getGame3DStarterMountDefinitionId('AXE_Faction_1'),'axe_mount_faction_bear');
 assert.equal(getGame3DStarterMountDefinitionId('AXE_Faction_2'),'axe_mount_faction_wolf');
 assert.equal(getGame3DStarterMountDefinitionId('AXE_Faction_3'),'axe_mount_faction_tiger');
 assert.equal(getGame3DStarterMountDefinitionId('AXE_Faction_Unassigned'),'axe_mount_war_wolf');
 const a=GAME3D_FACTION_MOUNTS;
 assert.equal(a.AXE_Faction_1.companionId,'faction_bear');
 assert.equal(a.AXE_Faction_2.companionId,'faction_armored_wolf');
 assert.equal(a.AXE_Faction_3.companionId,'faction_tiger');
 assert.equal(a.AXE_Faction_2.animationRigProfile,'winged_faction_2_158');
 assert.equal(a.AXE_Faction_3.animationRigProfile,'winged_faction_3_160');
 assert.ok(a.AXE_Faction_2.modelUrl.endsWith('158.glb'));
 assert.ok(a.AXE_Faction_3.modelUrl.endsWith('160.glb'));
 assert.ok(a.AXE_Faction_2.previousModelUrl.endsWith('.glb'));
 assert.ok(a.AXE_Faction_3.previousModelUrl.endsWith('.glb'));
 assert.notEqual(a.AXE_Faction_2.modelUrl,a.AXE_Faction_3.modelUrl);
});
test('the inspected new rig profiles map four feet and anatomical source bones',()=>{
 for(const [id,p] of Object.entries(FACTION_PET_RIG_PROFILES)){
   assert.ok(p.idle);
   assert.equal(p.limbs.length,4);
   for(const bone of Object.keys(p.map)) assert.ok(p.nodes.includes(bone),id+': '+bone);
   assert.ok(p.map.pelvis&&p.map.spine&&p.map.head);
   for(const bone of p.limbs)assert.ok(p.map[bone]&&p.map[bone].startsWith('Rig'));
   assert.ok(p.nodes.some(n=>n.toLowerCase().includes('tail')));
   assert.ok(p.nodes.some(n=>n.toLowerCase().includes('wing')));
 }
});
test('native wing/tail idle is retained and grafted on old-wolf walk/run gait',()=>{
 const q=(name)=>new THREE.QuaternionKeyframeTrack(name,[0,1],
   [0,0,0,1,0,.12,0,.99277389]);
 const idle=new THREE.AnimationClip('Idle',1,[
  q('tail_00.quaternion'),q('wing_l_base.quaternion'),q('head.quaternion')
 ]);
 const oldGait=[
  new THREE.AnimationClip('idle',1,[q('front_l_upper.quaternion')]),
  new THREE.AnimationClip('walk',.8,[q('front_l_upper.quaternion'),q('head.quaternion')]),
  new THREE.AnimationClip('run',.6,[q('front_l_upper.quaternion'),q('head.quaternion')]),
 ];
 const clips=combineNativeFactionPetClips([idle],oldGait,'winged_faction_2_158');
 assert.deepEqual(clips.map(c=>c.name),['idle','walk','run']);
 assert.equal(clips[0].tracks.length,3);
 for(const c of clips.slice(1)){
  assert.equal(c.tracks.filter(t=>t.name==='head.quaternion').length,1);
  assert.ok(c.tracks.some(t=>t.name==='tail_00.quaternion'));
  assert.ok(c.tracks.some(t=>t.name==='wing_l_base.quaternion'));
 }
});
test('offline gait fallback creates valid cyclic tracks for the new rigs',()=>{
 for(const [id,p] of Object.entries(FACTION_PET_RIG_PROFILES)){
  const root=new THREE.Group();
  for(const name of p.limbs){const bone=new THREE.Bone();bone.name=name;root.add(bone);}
  const idle=new THREE.AnimationClip(p.idle,1,[]);
  const clips=proceduralFactionPetGait(root,[idle],id);
  assert.deepEqual(clips.map(c=>c.name),['idle','walk','run']);
  for(const clip of clips.slice(1)){
   assert.equal(clip.tracks.length,4);
   for(const track of clip.tracks) {
    assert.ok(track.name.endsWith('.quaternion'));
    assert.equal(track.values.length,21*4);
    assert.deepEqual(Array.from(track.values.slice(0,4)),Array.from(track.values.slice(-4)));
   }
  }
 }
});
test('the original and clone avatar loaders use one shared runtime retargeting path',()=>{
 const defs=read('src/components/game3d/companionData.jsx');
 const animation=read('src/components/game3d/character/mountAnimations.mjs');
 const world=read('src/components/game3d/GameWorld3D.jsx');
 const remote=read('src/components/game3d/RemoteCompanionManager.jsx');
 const store=read('src/components/game3d/axe/progression/AXEMountStore.js');
 assert.match(defs,/animationRigProfile: asset\.animationRigProfile \|\| null/);
 assert.match(defs,/previousModelUrl: asset\.previousModelUrl \|\| null/);
 assert.match(defs,/animationSource: 'baby-wolf-retarget'/);
 assert.match(animation,/retargetDogMountClips\(source\.scene,source\.animations\|\|\[\],root,definition\.id,profile\.map\)/);
 assert.match(animation,/const steadyGait=sanitizeFactionThreeNativeClips\(root,gait,definition\)/);
 assert.match(animation,/combineNativeFactionPetClips\(sanitizeFactionThreeNativeClips\(root,embeddedClips,definition\),steadyGait,definition\.animationRigProfile\)/);
 assert.match(world,/prepareMountAnimationClips\(companionModel, embeddedClips, companionDef\)/);
 assert.match(remote,/prepareMountAnimationClips\(root,embeddedClips,effectiveDefinition\)/);
 assert.match(remote,/if\(!companionDef\.previousModelUrl\)throw error/);
 assert.match(world,/failToPreviousModel/);
 assert.match(world,/animationRigProfile: null/);
 assert.match(store,/axeCharacterFactionChanged/);
 assert.match(store,/adoptFactionStarterIfPristine/);
 assert.match(store,/old\.totalXp!==0/);
 assert.match(store,/old\.spiritualWeapon\?\.mode==='utility'/);
 assert.match(store,/Object\.values\(old\.gear\|\|\{\}\)\.some/);
});
