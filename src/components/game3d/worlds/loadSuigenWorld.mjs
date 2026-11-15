import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {SUIGEN_ASSET_PARTS,SUIGEN_WORLD_METADATA} from './WolfveilWorldVariants.mjs';
import {createSuigenTownDistrict} from './SuigenTownDistrict.mjs';
import {createSuigenMountainWayfinding} from './SuigenMountainWayfinding.mjs';

const WALKABLE_NAME=/^(?:Map_Terrain_2400m|Canal_Bridge_Deck|Abyss_Stair_\d+|Abyss_Vault_Floor)$/;
const INTERIOR_FLOOR_MATERIAL=/^SUI_Woven_Tatami_Mat$/;
export function isSuigenWalkableMesh(node){
  if(!node?.isMesh)return false;
  if(WALKABLE_NAME.test(node.name))return true;
  // A floor can be an ordinary Map_Object node. Include structural floor
  // materials for raycastable interiors, but not walls, roof tiles or foliage.
  const materials=Array.isArray(node.material)?node.material:[node.material];
  return materials.some(mat=>INTERIOR_FLOOR_MATERIAL.test(mat?.name||''));
}

function disposeScene(root) {
  root.traverse?.(obj=>{
    if(!obj.isMesh)return;
    obj.geometry?.dispose?.();
    const mats=Array.isArray(obj.material)?obj.material:[obj.material];
    for(const material of mats){
      if(!material)continue;
      for(const value of Object.values(material)){
        if(value?.isTexture)value.dispose?.();
      }
      material.dispose?.();
    }
  });
}

/**
 * Loads both ORIGINAL GLB scene shards as one transform-preserving world.
 * Does not modify the old village, spawn, combat, quests, player state, or
 * camera. The caller decides when to swap the visible world after success.
 */
export async function loadSuigenWorld({scene,signal}={}){
  if(!scene?.isScene)throw new Error('Suigen requires the active Game 3D scene');
  const loader=new GLTFLoader();
  loader.setCrossOrigin('anonymous');
  const assets=await Promise.all(SUIGEN_ASSET_PARTS.map(url=>loader.loadAsync(url)));
  const root=new THREE.Group();
  root.name='Wolfveil_Dominion_Of_Suigen_2400m_AAA_Map';
  root.userData.mapVariant='suigen';
  root.userData.worldSizeMeters=SUIGEN_WORLD_METADATA.sideMeters;
  root.visible=false;
  const walkables=[];
  for(const gltf of assets){
    const part=gltf.scene;
    part.updateMatrixWorld(true);
    part.traverse(obj=>{
      if(!obj.isMesh)return;
      obj.castShadow=!!obj.castShadow; // retain artist's authored material response
      if(isSuigenWalkableMesh(obj))walkables.push(obj);
    });
    root.add(part);
  }
  if(signal?.aborted) {
    disposeScene(root);
    throw new Error('Suigen map load was cancelled');
  }
  // Phase 2: original architecture around the preserved historic precinct.
  // Town loads as a child so a single world-variant visibility toggle applies
  // to old terrain, new interiors, walkable stairs and their collision.
  // A failed town procedural pass should not discard either original GLB.
  let district=null,mountains=null,upgradeError=null;
  try {
    district=createSuigenTownDistrict({worldRoot:root,terrainRoot:root});
    walkables.push(...district.walkables);
  } catch(error) {
    upgradeError=error;
    console.error('[Suigen] Living town failed to generate; source map retained:',error);
  }
  try {
    mountains=createSuigenMountainWayfinding({worldRoot:root,terrainRoot:root});
    walkables.push(...mountains.walkables);
  } catch(error) {
    upgradeError=upgradeError||error;
    console.error('[Suigen] Mountain trails failed; original Abyss is preserved:',error);
  }
  // No spatial offsets or scaling: imported geometry keeps the source's
  // precise world coordinates for the 2400m terrain and underground vault.
  scene.add(root);
  root.updateMatrixWorld(true);
  let disposed=false;
  return {
    root, walkables, district, mountains, upgradeError,
    get visible(){return root.visible;},
    setVisible(visible){if(!disposed)root.visible=!!visible;},
    dispose(){
      if(disposed)return;
      disposed=true;
      scene.remove(root);
      district?.dispose();
      mountains?.dispose();
      disposeScene(root);
    },
  };
}
