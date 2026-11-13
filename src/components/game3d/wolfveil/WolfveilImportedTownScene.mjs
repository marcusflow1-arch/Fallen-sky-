// 104-mesh GLB converted from the user's actual .blend; 80 tiles remain separate.
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {WOLFVEIL_IMPORTED_TOWN,WOLFVEIL_IMPORTED_TOWN_FLOOR_Y} from './WolfveilImportedTownLayout.mjs';
export const DEFAULT_WOLFVEIL_TOWN_ASSET='https://media.base44.com/files/public/6ab42219a52fd34656a53b37/461493b8c_game3d_town_assembled.glb';
/** Use the one Wolfveil scene and physically graded Wolfveil ground, never a fake floor. */
export function installWolfveilImportedTown(scene,{url=DEFAULT_WOLFVEIL_TOWN_ASSET,onStatus}={}){
 if(!scene?.add)throw Error('Imported town requires Game 3D scene');
 const root=new THREE.Group();root.name='Wolfveil_Imported_Player_Spawn_Town';
 root.userData.townId=WOLFVEIL_IMPORTED_TOWN.id;scene.add(root);
 let active=true,model=null,state='loading';
 const emit=(next,reason)=>{state=next;onStatus?.({state:next,reason});};
 const disposeModel=(object)=>{
   const geometries=new Set(),materials=new Set();
   object?.traverse(node=>{if(!node.isMesh)return;
     if(node.geometry)geometries.add(node.geometry);
     for(const m of (Array.isArray(node.material)?node.material:[node.material]))if(m)materials.add(m);
   });
   for(const g of geometries)g.dispose();
   for(const m of materials){for(const key of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap'])m[key]?.dispose?.();m.dispose();}
 };
 new GLTFLoader().load(url,gltf=>{
   if(!active){disposeModel(gltf.scene);return;}
   const town=gltf.scene;
   const bounds=new THREE.Box3().setFromObject(town),size=bounds.getSize(new THREE.Vector3());
   if(!(size.x>0&&size.z>0)){disposeModel(town);emit('error','Invalid model bounds');return;}
   const factor=Math.min(WOLFVEIL_IMPORTED_TOWN.width/size.x,WOLFVEIL_IMPORTED_TOWN.depth/size.z);
   const mid=bounds.getCenter(new THREE.Vector3());
   town.scale.setScalar(factor);
   town.position.set(WOLFVEIL_IMPORTED_TOWN.x-mid.x*factor,
     WOLFVEIL_IMPORTED_TOWN_FLOOR_Y-WOLFVEIL_IMPORTED_TOWN.floorSourceY*factor+WOLFVEIL_IMPORTED_TOWN.floorLiftMeters,
     WOLFVEIL_IMPORTED_TOWN.z+70-mid.z*factor);
   town.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}});
   town.name='Blender_Assembled_Town_80_Separate_Tiles';root.add(town);root.updateMatrixWorld(true);
   model=town;emit('ready');
 },undefined,error=>{if(active){emit('error',error?.message||'Asset network error');console.warn('[Game 3D town] GLB load failed; Wolfveil remains walkable',error);}});
 return {root,get status(){return state;},get model(){return model;},dispose(){if(!active)return;active=false;scene.remove(root);disposeModel(model);root.clear();model=null;state='disposed';}};
}
