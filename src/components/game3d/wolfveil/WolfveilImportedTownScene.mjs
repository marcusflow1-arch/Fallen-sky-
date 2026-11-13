// 104-mesh GLB converted from the user's actual .blend; 80 tiles remain separate.
// Enhanced with smooth normals, Sumi-e architectural/ground textures, manicured
// park grass blades, canal water shaders, and 4 cardinal gateway canopies.
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {WOLFVEIL_IMPORTED_TOWN,WOLFVEIL_IMPORTED_TOWN_FLOOR_Y,WOLFVEIL_IMPORTED_TOWN_SCALE,
  WOLFVEIL_IMPORTED_TOWN_TREE} from './WolfveilImportedTownLayout.mjs';
import {bakeWolfveilTownCollision} from './WolfveilImportedTownCollision.mjs';
import {createWolfveilTownWater} from './WolfveilImportedTownWater.mjs';
import {installWolfveilTownTree,isWolfveilTownTreeMesh,removeWolfveilTownCentreTree} from './WolfveilImportedTownTree.mjs';
import {critiqueAndEnhanceWolfveilTown,buildWolfveilTownCanopyDressing} from './WolfveilImportedTownCritique.mjs';
import {plantTownLawnGrassBlades} from './WolfveilIndividualGrassBlades.js';
import {wolfveilImportedTownHouseOverlapsTree} from './WolfveilTownTileBodyRemoval.mjs';
export const DEFAULT_WOLFVEIL_TOWN_ASSET='https://media.base44.com/files/public/6ab42219a52fd34656a53b37/461493b8c_game3d_town_assembled.glb';

// How each mesh of the model takes part in collision, by its Blender name.
const WATER=/water|foam/i;
const CANOPY=/(^|_)(pink|pinklight|leaf)$/i; // blossom and foliage overhead
const FLOOR=/paving|stone|grass|^Tile_/i;    // surfaces a character stands on

function worldPositions(mesh){
  const source=mesh.geometry.attributes.position,out=new Float32Array(source.count*3);
  const v=new THREE.Vector3();
  for(let i=0;i<source.count;i++){
    v.fromBufferAttribute(source,i).applyMatrix4(mesh.matrixWorld);
    out[i*3]=v.x;out[i*3+1]=v.y;out[i*3+2]=v.z;
  }
  return out;
}

/** Use the one Wolfveil scene and physically graded Wolfveil ground, never a fake floor. */
export function installWolfveilImportedTown(scene,{url=DEFAULT_WOLFVEIL_TOWN_ASSET,onStatus,onReady}={}){
 if(!scene?.add)throw Error('Imported town requires Game 3D scene');
 const p=WOLFVEIL_IMPORTED_TOWN,scale=WOLFVEIL_IMPORTED_TOWN_SCALE;
 const root=new THREE.Group();root.name='Wolfveil_Imported_Player_Spawn_Town';
 root.userData.townId=p.id;scene.add(root);
 let active=true,model=null,state='loading',collision=null;
 let critiquePass=null,lawnGrass=null;
 const water=createWolfveilTownWater();
 const tree=installWolfveilTownTree(root);
 let plazaTreeClearOfHouses=true;
 const canopyDressing=buildWolfveilTownCanopyDressing(root);
 const emit=(next,reason)=>{state=next;onStatus?.({state:next,reason});};
 const disposeModel=(object)=>{
   const geometries=new Set(),materials=new Set();
   object?.traverse(node=>{if(!node.isMesh)return;
     if(node.geometry)geometries.add(node.geometry);
     for(const m of (Array.isArray(node.material)?node.material:[node.material]))if(m)materials.add(m);
   });
   for(const g of geometries)g.dispose();
   for(const m of materials){for(const key of ['map','normalMap','bumpMap','roughnessMap','metalnessMap','emissiveMap'])m[key]?.dispose?.();m.dispose();}
 };
 new GLTFLoader().load(url,gltf=>{
   if(!active){disposeModel(gltf.scene);return;}
   const town=gltf.scene;
   const bounds=new THREE.Box3().setFromObject(town),size=bounds.getSize(new THREE.Vector3());
   if(!(size.x>0&&size.z>0)){disposeModel(town);emit('error','Invalid model bounds');return;}
   // The model is centred on its own origin, so the layout's scale places it.
   town.scale.setScalar(scale);
   town.position.set(p.x,
     WOLFVEIL_IMPORTED_TOWN_FLOOR_Y-p.floorSourceY*scale+p.floorLiftMeters,p.z+70);
   town.traverse(node=>{
     if(!node.isMesh)return;
     if(WATER.test(node.name))water.apply(node);
     else if(isWolfveilTownTreeMesh(node.name))removeWolfveilTownCentreTree(node);
   });
   town.name='Blender_Assembled_Town_80_Separate_Tiles';root.add(town);root.updateMatrixWorld(true);
   // Inspect the actual loaded architectural geometry before keeping the
   // owner tree: houses win over trunks/roots that overlap their footprint.
   plazaTreeClearOfHouses=!wolfveilImportedTownHouseOverlapsTree(town,WOLFVEIL_IMPORTED_TOWN_TREE);
   if(!plazaTreeClearOfHouses)tree.dispose();
   // Keep walkable tile tops, remove protruding box walls and undersides.
   critiquePass=critiqueAndEnhanceWolfveilTown(town,WOLFVEIL_IMPORTED_TOWN_FLOOR_Y);
   lawnGrass=plantTownLawnGrassBlades(town,root);
   // Bake floors and walls from the placed triangles themselves.
   const meshes=[];
   town.traverse(node=>{
     if(!node.isMesh||WATER.test(node.name)||CANOPY.test(node.name))return;
     meshes.push({role:FLOOR.test(node.name)?'floor':'solid',
       position:worldPositions(node),index:node.geometry.index?.array??null});
   });
   collision=bakeWolfveilTownCollision({meshes,baseY:WOLFVEIL_IMPORTED_TOWN_FLOOR_Y,
     minX:p.x-p.width/2-2,maxX:p.x+p.width/2+2,
     minZ:p.z+70-p.depth/2-2,maxZ:p.z+70+p.depth/2+2,
     circles:plazaTreeClearOfHouses?[WOLFVEIL_IMPORTED_TOWN_TREE]:[]});
   model=town;emit('ready');onReady?.();
 },undefined,error=>{if(active){emit('error',error?.message||'Asset network error');globalThis.console?.warn('[Game 3D town] GLB load failed; Wolfveil remains walkable',error);}});
 return {root,get status(){return state;},get model(){return model;},
   /** Town floor height at a point, or null off the town / before it loads. */
   groundY(x,z){return collision?collision.groundAt(x,z):null;},
   /** True where the town's own walls, ledges or plaza tree stand. */
   isSolid(x,z){return collision?collision.isSolid(x,z):false;},
   /** Keeps a moving character out of the town's walls. True when it was stopped. */
   resolveCollision(position,previous){return collision?collision.resolve(position,previous):false;},
   update(dt){water.update(dt);canopyDressing.update(dt);lawnGrass?.update(dt);},
   dispose(){if(!active)return;active=false;scene.remove(root);lawnGrass?.dispose();canopyDressing.dispose();critiquePass?.dispose();tree.dispose();disposeModel(model);water.dispose();root.clear();model=null;collision=null;state='disposed';}};
}