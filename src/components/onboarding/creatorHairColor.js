// Maintain light and dark strands when recoloring a textured GLB hairstyle.
// A plain material.color multiplier cannot make dark painted hair blonde.
import * as THREE from 'three';
const HEX=/^#[a-f0-9]{6}$/i;

export function bindCreatorHairColor(material,hex,enabled=true){
 if(!material?.isMeshStandardMaterial||!material.color||!material.userData)return false;
 let state=material.userData.creatorHairColor;
 if(!state){
  const uniforms={creatorHairTarget:{value:new THREE.Color('#888888')},
    creatorHairTintOn:{value:0}};
  const earlier=material.onBeforeCompile;
  const key=material.customProgramCacheKey?.bind(material);
  material.onBeforeCompile=function(shader,renderer){
   earlier?.call(this,shader,renderer);
   Object.assign(shader.uniforms,uniforms);
   shader.fragmentShader=shader.fragmentShader.replace(
    '#include <common>',
    '#include <common>\nuniform vec3 creatorHairTarget;\nuniform float creatorHairTintOn;'
   ).replace(
    '#include <map_fragment>',
    `#include <map_fragment>
float creatorHairLuma=dot(diffuseColor.rgb,vec3(0.2126,0.7152,0.0722));
// Lift nearly black painted strands without flattening their natural detail.
float creatorHairDetail=mix(0.62,1.24,smoothstep(0.012,0.70,creatorHairLuma));
diffuseColor.rgb=mix(diffuseColor.rgb,creatorHairTarget*creatorHairDetail,creatorHairTintOn);`
   );
  };
  material.customProgramCacheKey=()=>String(key?.()||'')+'|creator-hair-pigment-v1';
  state={uniforms};
  material.userData.creatorHairColor=state;
  material.needsUpdate=true;
 }
 const valid=enabled&&HEX.test(String(hex||''));
 state.uniforms.creatorHairTintOn.value=valid?1:0;
 if(valid)state.uniforms.creatorHairTarget.value.set(hex);
 return true;
}
