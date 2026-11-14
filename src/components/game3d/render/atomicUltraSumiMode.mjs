// Clone-only migration of the MAIN Game 3D Living Ultra-Sumi / Atomic SAFE
// render setting. Does not copy any combat, inventory, terrain or town logic.
// No flat ShaderMaterial replacements on the actor, buildings or ground.
import * as THREE from 'three';
import {createBlazeOfGrassWorld} from './BlazeOfGrassWorld.mjs';

export const ATOMIC_ULTRA_SUMI=Object.freeze({
  style:'atomic-ultra-sumi',
  grassScale:3,
  safeVegetationOnly:true,
  fullScreenBloom:false,
  collisionChanges:0,
});
// Preserve the old preview's geometry helper signature for code/tests that
// use it; the normal gameplay mode instead uses the streamed 16-segment mesh.
export function createAtomicUltraSumiBladeGeometry(){
  const positions=[],normals=[],uv=[],indices=[];
  const segments=5;
  for(let i=0;i<=segments;i++){
    const t=i/segments,w=.065*(1-t)+.002;
    for(const side of [-1,1]){
      positions.push(side*w,t*.83,t*t*.13);
      normals.push(0,.35,.937);
      uv.push((side+1)*.5,t);
    }
    if(i<segments){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(indices);g.computeBoundingSphere();
  return g;
}

/**
 * Public interface matches the clone's previous preview renderer.
 * Only this graphics setting has been migrated from Main. We keep the
 * clone's one existing scene/camera/renderer and leave all authoritative
 * game systems untouched.
 */
export function createAtomicUltraSumiMode({
  scene,renderer,camera,guard,
  sampleHeight=()=>null,allowGrass=()=>true,biomeAt,
  worldRegion='wolfveil',quality='high',enabled=false,
}={}){
  if(!scene||!renderer||!camera)
    throw new Error('Atomic Ultra-Sumi requires the clone game scene/camera/renderer');
  // The previous clone shader replaced every material, emitted sparks around
  // the hero and ran 1.35 bloom + edge passes. These caused the whiteout.
  const look=createBlazeOfGrassWorld({
    scene,renderer,guard,
    sampleGroundY:sampleHeight,
    canPlantAt:({x,z})=>allowGrass(x,z),
    biomeAt,worldRegion,
  });
  let active=false,disposed=false,selectedQuality=quality,lastPosition=null;
  const settings=()=>({
    quality:selectedQuality,
    blazePalette:'jade',blazeProfile:'sumi',
    blazeFlameSpeed:.58,blazePinch:1.28,
    blazeInkWeight:1.5,blazeCurl:1.16,
    blazeTreeSway:.72,blazeBrightness:.98,
    blazeGlare:.08,blazeGlass:.20,
    blazeBuildingSway:.55,
    blazeFusionStrength:.82,
    blazeGroundCover:true,
    blazePerimeterFire:false,
    blazePostFX:false,
  });
  const apply=()=>look.setSettings(settings());
  apply();
  function setQuality(next){
    if(disposed)return;
    selectedQuality=['low','medium','high','ultra'].includes(next)?next:'high';
    apply();
  }
  function setEnabled(on){
    if(disposed)return;
    active=!!on;
    if(active)apply();
    look.setEnabled(active,lastPosition?{position:lastPosition}:null);
  }
  function update(delta,position,weather={}){
    if(disposed||!active)return;
    if(position&&Number.isFinite(position.x)&&Number.isFinite(position.z))
      lastPosition=position;
    look.update(delta,weather,lastPosition?{position:lastPosition}:null);
  }
  function render(viewCamera=camera){
    if(disposed||!active)return false;
    return look.render(viewCamera);
  }
  function resize(){
    if(disposed)return;
    const size=renderer.getSize(new THREE.Vector2());
    look.resize(size.x,size.y);
  }
  function dispose(){
    if(disposed)return;
    setEnabled(false);
    disposed=true;
    look.dispose();
  }
  // Set quality first, then enable. No second scene, no bloom/haze composer,
  // no texture loss, and no user avatar / building material overrides.
  setQuality(quality);
  setEnabled(enabled);
  return {
    setEnabled,setQuality,update,render,resize,dispose,
    get enabled(){return active&&look.enabled;},
    get stats(){
      const base=look.stats();
      return {enabled:active,decoratedMeshes:base.decoratedMaterials||0,
        grassBlades:base.blades||0,sparks:base.embers||0,
        streamedTiles:base.tiles||0,scale:ATOMIC_ULTRA_SUMI.grassScale,
        materialReplacements:0,heroEmitters:0,worldWhiteoutPasses:0};
    },
  };
}
