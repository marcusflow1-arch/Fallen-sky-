import * as THREE from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {BLAZE_GRASS,normalizeBlazeSettings,blazePaletteIndex,
  blazeProfileIndex} from './BlazeGrassSettings.mjs';
import {createBlazeGrassStreamer} from './BlazeGrassStream.mjs';
import {classifyBlazeBiome,isBlazeTreePart} from './BlazeBiomeLandscaping.mjs';
import {classifyTreeMaterialPart,treeWindProject,createTreeGustSpring,
  BLAZE_TREE_WIND_DEFAULT} from './LivingTreeWindPhysics.mjs';

// Adaptation of the owner-created 100x100m Sanctuary: it runs INSIDE the
// existing Game 3D scene and renderer. No standalone HTML scene, new controls,
// new collision geometry, external assets or independent animation loop.
const SKIP=/sky|sun|moon|cloud|water|river|foam|spray|rain|fog|mist|portal|vfx|particle|effect|outline|glow|glass|ui/i;
const WORLD_TYPES=[
  ['grass',/grass|blade|turf|reed/i],
  ['bark',/bark|trunk|branch|timber|bamboo/i],
  ['foliage',/canopy|crown|bough|elm|oak|birch|cedar|pine|maple|leaf|leaves|fern|bush|shrub|foliage|blossom|needle/i],
  ['terrain',/terrain|solidground|ground|soil|earth|landscape|mountain|hill|ridge/i],
  ['stone',/rock|stone|cliff|boulder|cave|granite|basalt/i],
  ['architecture',/bridge|torii|shrine|house|palace|wall|roof|building|pillar|beam|arch|gate|stairs|floor/i],
  ['character',/character|hero|avatar|player|enemy|npc|actor|monster/i],
];
const SUPPORTED=m=>!!(m?.isMeshStandardMaterial||m?.isMeshPhysicalMaterial||
  m?.isMeshPhongMaterial||m?.isMeshLambertMaterial);
function familyOf(mesh,partMaterial=null){
  if(!mesh?.isMesh&&!mesh?.isInstancedMesh&&!mesh?.isSkinnedMesh)return null;
  if(mesh.userData?.blazeProcedural||mesh.userData?.atomicProcedural||
     mesh.userData?.isTerrain||mesh.userData?.solidGround)return null;
  if(mesh.isSkinnedMesh)return null;
  const mats=partMaterial?[partMaterial]:Array.isArray(mesh.material)?mesh.material:[mesh.material];
  if(!mats.length||mats.every(m=>!SUPPORTED(m)||m.opacity<.99))return null;
  let parent=mesh.parent,names='',n=0;
  while(parent&&n++<2){names+=' '+(parent.name||'');parent=parent.parent;}
  const own=((mesh.name||'')+' '+mats.map(m=>m?.name||'').join(' ')).toLowerCase();
  if(SKIP.test(own))return null;
  const label=(own+names).toLowerCase();
  if(SKIP.test(label))return null;
  // Some unskinned buildings and character props use generic leaf/bark
  // materials. Their structural ancestry wins over any material-name match.
  const structural=/house|building|palace|bridge|shrine|torii|roof|floor|stairs|door|window|wall|temple|fence|path|plaza|gate|architecture|structure/i;
  const actor=/character|avatar|hero|player|npc|enemy|boss|armor|weapon|outfit|skin|cloth|face|humanoid/i;
  if(structural.test((mesh.name||'')+' '+names)||
     actor.test((mesh.name||'')+' '+names)||
     /solidground|terrain|groundmesh|soil|cliff|bedrock|pavement|foundation|(?:^|[_ -])road|(?:main|paved|town|dirt|stone)road|road(?:way|mesh|tile|path|side)/i.test(mesh.name||''))
    return null;
  const arid=/desert|dune|arid|sand|badland|dry.?scrub|dry.?steppe/.test(label);
  // Trusted tagging from the actual owner GLB/FBX loader. Even generic
  // Mesh_001 nodes of an imported tree become live textured energy matter.
  const importedPart=mesh.userData?.blazeTreeFamily;
  if(importedPart){
    const materialPart=classifyTreeMaterialPart(
      partMaterial?.name||mats.map(m=>m?.name||'').join(' '),
      importedPart==='bark'?'bark':'foliage');
    return arid?(materialPart==='bark'?'desertBark':'desertFoliage'):materialPart;
  }
  // Mesh geometry has priority over a shared or misnamed leaf material:
  // one seven-blade grass clump is NOT a tree because of its material name.
  if(/grass|blade|turf|reed|meadow.?clump|groundcover/i.test(mesh.name||''))
    return arid?'desertGrass':'grass';
  const tree=isBlazeTreePart({name:mesh.name,parentName:names,
    materialName:mats.map(m=>m?.name||'').join(' ')});
  if(tree)return arid?(tree==='bark'?'desertBark':'desertFoliage'):tree;
  if(/grass|blade|turf|reed|groundcover/.test(own))
    return arid?'desertGrass':'grass';
  if(/leaf|leaves|shrub|foliage|blossom|plant/.test(own))
    return arid?'desertFoliage':'foliage';
  return null;
}
const FAMILY_STRENGTH={
  grass:.61,foliage:.82,bark:.67,terrain:.20,stone:.32,
  architecture:.25,character:.25,
  desertGrass:.52,desertFoliage:.83,desertBark:.66,
  desertTerrain:.23,desertStone:.34,desertArchitecture:.25,
};
const SURFACE_HEADER=`
varying vec3 vBlazeWorld,vBlazeNormal;
varying vec2 vBlazeLocal;
`;
const TREE_VERTEX_UNIFORMS=`
uniform float uBlazeTime,uBlazeTreeSpring,uBlazeTreeSway;
uniform vec2 uBlazeTreeDirection;
`;
const SURFACE_PROJECT=`
#include <project_vertex>
#ifdef USE_INSTANCING
vec4 blazeWorld=modelMatrix*instanceMatrix*vec4(transformed,1.);
vec3 blazeNormal=mat3(modelMatrix)*mat3(instanceMatrix)*objectNormal;
#else
vec4 blazeWorld=modelMatrix*vec4(transformed,1.);
vec3 blazeNormal=mat3(modelMatrix)*objectNormal;
#endif
vBlazeWorld=blazeWorld.xyz;
vBlazeNormal=normalize(blazeNormal);
vBlazeLocal=position.xy;
`;
// Existing owner/model grass remains the same mesh/material, but in this mode
// its visible height is limited AFTER existing animated wind deformation.
// Clone-only 3x knee-height: source grass can reach 1.65m; colliders unchanged.
const GRASS_PROJECT=`
#ifdef USE_INSTANCING
  float blazeYScale=length(mat3(modelMatrix*instanceMatrix)*vec3(0.,1.,0.));
#else
  float blazeYScale=length(mat3(modelMatrix)*vec3(0.,1.,0.));
#endif
  transformed.y=min(max(transformed.y,0.),1.65/max(.001,blazeYScale));
`+SURFACE_PROJECT;
const SURFACE_FRAGMENT_HEADER=`
varying vec3 vBlazeWorld,vBlazeNormal;
varying vec2 vBlazeLocal;
uniform float uBlazeTime,uBlazeSpeed,uBlazePalette,uBlazeProfile;
uniform float uBlazePerimeter,uBlazePerimeterFire,uBlazeGlass,uBlazeInk,uBlazeBrightness;
uniform float uBlazeWind,uBlazeGlare,uBlazeBuildingSway,uBlazeFusion;
`;
function materialBody(kind){
 const strength=FAMILY_STRENGTH[kind]||.22;
 const grass=kind==='grass'||kind==='desertGrass';
 const foliage=kind==='foliage'||kind==='desertFoliage';
 const bark=kind==='bark'||kind==='desertBark';
 const tree=foliage||bark;
 const arid=kind.startsWith('desert');
 return '#include <map_fragment>\n{\n'+
 `  // Preserve source albedo + vertex colors; living fire is IN the matter.
  vec3 paintedOriginal=diffuseColor.rgb;
  vec3 N=normalize(vBlazeNormal),V=normalize(cameraPosition-vBlazeWorld);
  float fres=pow(1.-clamp(dot(N,V),0.,1.),3.5);
  float lift=sin(vBlazeWorld.y*6.7-
    uBlazeTime*uBlazeSpeed*(.68+1.2*uBlazeBuildingSway)*2.7+
    (vBlazeWorld.x+vBlazeWorld.z)*3.7);
  float ripple=sin(vBlazeWorld.y*11.5-uBlazeTime*uBlazeSpeed*4.2+
     sin(vBlazeWorld.x*4.)*.9);
  float contour=smoothstep(.48,.94,fres);
  float wave=.5+.5*lift;
  float ink=smoothstep(.73,.96,.5+.5*ripple)*uBlazeInk;
  vec3 jade=vec3(.08,.57,.34),verm=vec3(.91,.30,.10);
  vec3 cobalt=vec3(.06,.48,.94);
  vec3 pigment=mix(mix(jade,verm,clamp(uBlazePalette,0.,1.)),
      cobalt,clamp(uBlazePalette-1.,0.,1.));
  vec3 drySand=mix(vec3(.07,.058,.043),vec3(.72,.53,.31),
    .38+.48*wave);
  pigment=mix(pigment,drySand,${arid?'1.0':'0.0'});
  // Cobalt/violet plasma remains IN the vegetation's colored matter.
  // No additive rim or bloom on buildings, terrain or character.
  float atomicCurrent=smoothstep(.18,.88,
    .5+.5*sin(vBlazeWorld.y*19.0-uBlazeTime*3.5+
      sin(vBlazeWorld.x*8.2+vBlazeWorld.z*6.0)*1.7));
  vec3 plasma=mix(vec3(.045,.35,.84),vec3(.21,.13,.65),
    .5+.5*sin(vBlazeWorld.y*7.3-uBlazeTime*1.7));
  float safeFusion=uBlazeFusion*${arid?'0.10':'1.0'};
  pigment=mix(pigment,plasma,clamp(safeFusion*atomicCurrent*.72,0.,.72));
  float strength=${strength.toFixed(2)};
  float flame=uBlazePerimeterFire*contour*
    smoothstep(0.,.45,uBlazePerimeter)*uBlazeBuildingSway;
  // The vegetation is materially transformed, but keeps the silhouette,
  // its actual texture map, veins, skinning and wind deformation.
  diffuseColor.rgb=paintedOriginal*(1.-ink*.060*strength)
    +pigment*flame*wave*.28*strength
    +vec3(.66,.82,.91)*fres*.065*uBlazeGlass*uBlazeGlare;
  diffuseColor.rgb*=mix(1.,uBlazeBrightness,.17);
  // Ink pockets retain dark natural detail, without fluorescent plaster.
  diffuseColor.rgb=mix(diffuseColor.rgb,
    diffuseColor.rgb*vec3(.33,.38,.46),
    atomicCurrent*safeFusion*ink*.12);
`+
 (tree?`
  // Real trees are made of the same animated material as grass, not a halo.
  // Bark retains brown grain; canopy retains individual textured leaves.
  float strata=sin(vBlazeWorld.y*13.5-uBlazeTime*uBlazeSpeed*3.3+
    vBlazeWorld.z*7.7);
  float living=smoothstep(.22,.91,.5+.5*strata)*(.45+.55*wave);
  float charcoalPocket=smoothstep(.76,.97,.5+.5*ripple)*.18;
  vec3 darkInk=vec3(.018,.022,.020);
  vec3 livingMatter=mix(paintedOriginal,
    paintedOriginal*.55+pigment*.45,
    (living*.51+.13)*strength);
  diffuseColor.rgb=mix(livingMatter,darkInk,
    charcoalPocket*strength*(${bark?'1.25':'1.0'}));
  diffuseColor.rgb+=pigment*(living*.13+fres*.065)*strength;
  diffuseColor.rgb=mix(diffuseColor.rgb,
    mix(paintedOriginal*.60,plasma*.85,atomicCurrent),
    safeFusion*living*.24*strength);
  // Restrained clear translucent-looking lacquer, no real translucency.
  diffuseColor.rgb+=vec3(.19,.34,.40)*pow(1.-clamp(dot(N,V),0.,1.),5.)
    *.12*uBlazeGlass;
`:'')+
 (grass?`
  float tip=smoothstep(.21,.72,max(0.,vBlazeLocal.y));
  diffuseColor.rgb=mix(diffuseColor.rgb,pigment,
     tip*(.25+safeFusion*.38)*strength*(.45+.55*wave));
  float erosion=smoothstep(.60,1.,tip)*(.31+.26*uBlazeWind);
  diffuseColor.a*=1.-erosion*smoothstep(.34,.91,.5+.5*lift);
`:'')+'}\n';
}
function createSurfaceDecorator(shared){
  const saved=new Map();
  let elapsed=0,lastScan=-99;
  const uniforms={
    uBlazeTime:shared.uTime,uBlazeSpeed:shared.uFlameSpeed,
    uBlazePalette:shared.uPalette,uBlazeProfile:shared.uArtProfile,
    uBlazePerimeter:shared.uStructFlameRatio,
    uBlazePerimeterFire:shared.uPerimeterFireMode,
    uBlazeGlass:shared.uLiquidGlass,uBlazeInk:shared.uInkWeight,
    uBlazeBrightness:shared.uBrightness,uBlazeGlare:shared.uGlareBoost,
    uBlazeWind:shared.uWindStrength,
    uBlazeBuildingSway:shared.uBuildingSway,
    uBlazeFusion:shared.uFusion,
    uBlazeTreeSpring:shared.uTreeSpring,
    uBlazeTreeSway:shared.uTreeSway,
    uBlazeTreeDirection:shared.uTreeDirection,
  };
  function decorate(material,kind,mesh){
    if(!SUPPORTED(material)||material.opacity<.99||saved.has(material))return false;
    if(material.transparent&&kind!=='foliage'&&kind!=='desertFoliage')
      return false;
    const ownHook=Object.prototype.hasOwnProperty.call(material,'onBeforeCompile');
    const ownKey=Object.prototype.hasOwnProperty.call(material,'customProgramCacheKey');
    const oldHook=material.onBeforeCompile,oldKey=material.customProgramCacheKey;
    const oldAlpha=material.alphaTest,oldCoat=material.clearcoat;
    const oldRough=material.clearcoatRoughness;
    const tree=/^(desert)?(Bark|Foliage)$/.test(kind)||
      kind==='bark'||kind==='foliage';
    const existingLeafWind=!!material.userData?.nativeForestUniform;
    const project=tree?treeWindProject(kind,mesh,SURFACE_PROJECT,{
      existingLeafWind,
    }):(kind==='grass'||kind==='desertGrass')?GRASS_PROJECT:SURFACE_PROJECT;
    const hook=function(shader,renderer){
      if(typeof oldHook==='function')oldHook.call(this,shader,renderer);
      if(!shader?.vertexShader?.includes('#include <project_vertex>')||
        !shader.vertexShader.includes('#include <common>')||
        !shader?.fragmentShader?.includes('#include <map_fragment>')||
        !shader.fragmentShader.includes('#include <common>'))return;
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader=shader.vertexShader.replace('#include <common>',
        '#include <common>'+SURFACE_HEADER+(tree?TREE_VERTEX_UNIFORMS:''))
        .replace('#include <project_vertex>',project);
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
        '#include <common>'+SURFACE_FRAGMENT_HEADER).replace('#include <map_fragment>',
        materialBody(kind));
    };
    const key=function(){
      const old=typeof oldKey==='function'?oldKey.call(this):'';
      return String(old)+'|blaze-living-ultra-tree-spring-v3-'+kind+
        (tree?'-'+(mesh?.userData?.blazeTreeUpAxis||'y'):'');
    };
    if(kind==='grass'||kind==='desertGrass')material.alphaTest=Math.max(oldAlpha||0,.35);
    if(material.isMeshPhysicalMaterial){
      material.clearcoat=Math.max(Number(oldCoat)||0,shared.uLiquidGlass.value*.6);
      material.clearcoatRoughness=Math.min(Number(oldRough)||.32,.32);
    }
    saved.set(material,{hook,key,oldHook,oldKey,ownHook,ownKey,oldAlpha,oldCoat,oldRough});
    material.onBeforeCompile=hook;
    material.customProgramCacheKey=key;
    material.needsUpdate=true;
    return true;
  }
  return {
    refresh(scene){
      let count=0;
      const protectedMaterials=new Set();
      // Source materials reused on a wall/player/ground must NEVER receive
      // grass or tree plasma through another mesh's material reference.
      scene.traverse(mesh=>{
        if(!mesh?.isMesh&&!mesh?.isInstancedMesh&&!mesh?.isSkinnedMesh)return;
        if(familyOf(mesh))return;
        for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])
          if(m)protectedMaterials.add(m);
      });
      scene.traverse(mesh=>{
        const kind=familyOf(mesh);if(!kind)return;
        for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
          const specific=familyOf(mesh,m)||kind;
          if(m&&!protectedMaterials.has(m)&&decorate(m,specific,mesh))count++;
        }
      });
      return count;
    },
    update(scene,dt){elapsed+=dt;if(elapsed-lastScan>=3.5){lastScan=elapsed;this.refresh(scene);}},
    setGlass(amount){
      for(const [mat,old] of saved)if(mat.isMeshPhysicalMaterial){
        mat.clearcoat=Math.max(Number(old.oldCoat)||0,amount*.6);
        mat.needsUpdate=true;
      }
    },
    restore(){
      for(const [m,old] of saved){
        if(m.onBeforeCompile!==old.hook)continue;
        if(old.ownHook)m.onBeforeCompile=old.oldHook;else delete m.onBeforeCompile;
        if(old.ownKey)m.customProgramCacheKey=old.oldKey;else delete m.customProgramCacheKey;
        m.alphaTest=old.oldAlpha;
        if(m.isMeshPhysicalMaterial){
          m.clearcoat=old.oldCoat;
          m.clearcoatRoughness=old.oldRough;
        }
        m.needsUpdate=true;
      }
      saved.clear();
    },
    get size(){return saved.size;},
  };
}
const PAPER={
 uniforms:{
  tDiffuse:{value:null},uResolution:{value:new THREE.Vector2(1,1)},
  uInkWeight:{value:1.25},uLiquidGlass:{value:.65},
  uBrightness:{value:.78},uGlareBoost:{value:.25},uTime:{value:0},
 },
 vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`
 uniform sampler2D tDiffuse;
 uniform vec2 uResolution;
 uniform float uInkWeight,uLiquidGlass,uBrightness,uGlareBoost,uTime;
 varying vec2 vUv;
 float luma(vec3 c){return dot(c,vec3(.299,.587,.114));}
 float hash(vec2 x){return fract(sin(dot(x,vec2(127.1,311.7)))*43758.5453);}
 void main(){
  vec2 t=1./uResolution;
  float a=luma(texture2D(tDiffuse,vUv+t*vec2(-1.,1.)).rgb);
  float b=luma(texture2D(tDiffuse,vUv+t*vec2(1.,1.)).rgb);
  float c=luma(texture2D(tDiffuse,vUv+t*vec2(-1.,-1.)).rgb);
  float d=luma(texture2D(tDiffuse,vUv+t*vec2(1.,-1.)).rgb);
  float ml=luma(texture2D(tDiffuse,vUv+t*vec2(-1.,0.)).rgb);
  float mr=luma(texture2D(tDiffuse,vUv+t*vec2(1.,0.)).rgb);
  float tm=luma(texture2D(tDiffuse,vUv+t*vec2(0.,1.)).rgb);
  float bm=luma(texture2D(tDiffuse,vUv+t*vec2(0.,-1.)).rgb);
  float gx=-a-2.*ml-c+b+2.*mr+d,gy=-a-2.*tm-b+c+2.*bm+d;
  float edge=length(vec2(gx,gy));
  vec3 color=texture2D(tDiffuse,vUv).rgb;
  float ink=smoothstep(.20,.58,edge*uInkWeight)*.39;
  color=mix(color,vec3(.04,.03,.03),ink);
  float glass=smoothstep(.28,.85,edge)*uLiquidGlass*uGlareBoost*.10;
  color+=vec3(.75,.88,.96)*glass;
  color*=mix(.90,1.10,clamp(uBrightness,0.,1.35));
  color=color/(1.+color*.07);
  color+=(hash(vUv*uResolution*.35)-.5)*.023;
  float vig=1.-smoothstep(.25,.95,length(vUv-.5));
  color*=mix(.83,1.,vig);
  gl_FragColor=vec4(max(color,vec3(0.)),1.);
 }`,
};
export function createBlazeOfGrassWorld({scene,renderer,guard,
    sampleGroundY,canPlantAt,biomeAt,worldRegion='wolfveil'}={}){
 if(!scene||!renderer)throw Error('Blaze of Grass requires existing Game 3D renderer and scene');
 const shared={
  uTime:{value:0},uFlameSpeed:{value:.42},uStructFlameRatio:{value:.20},
  uBuildingSway:{value:.48},uPinchAmount:{value:1.15},uInkWeight:{value:1.25},
  uCurlAmp:{value:1},uPalette:{value:0},uArtProfile:{value:0},
  uLiquidGlass:{value:.65},uGlareBoost:{value:.25},uBrightness:{value:.78},
  uPerimeterFireMode:{value:1},uPlayerPos:{value:new THREE.Vector3()},
  uSunDir:{value:new THREE.Vector3(.45,.78,-.42).normalize()},
  uWindStrength:{value:1},
  uFusion:{value:0},
  uTreeSpring:{value:0},uTreeSway:{value:BLAZE_TREE_WIND_DEFAULT},
  uTreeDirection:{value:new THREE.Vector2(.68,.73).normalize()},
 };
 const decorator=createSurfaceDecorator(shared);
 const treeSpring=createTreeGustSpring();
 const grassStream=createBlazeGrassStreamer({
   scene,shared,sampleGroundY,canPlantAt,biomeAt,worldRegion,
 });
 let active=false,clock=0,config=normalizeBlazeSettings(),quality='high';
 const onImportedTreeReady=()=>{if(active)decorator.refresh(scene);};
 if(typeof window!=='undefined')
   window.addEventListener('axe:owner-tree-ready',onImportedTreeReady);
 let targetPalette=0,targetProfile=0;
 let composer=null,paper=null,bloom=null;
 let shaderFailed=false;
 const priorShaderError=renderer.debug?.onShaderError;
 const shaderError=(...args)=>{
  shaderFailed=true;
  try{priorShaderError?.apply(renderer.debug,args);}catch{/* diagnostic only */}
  console.warn('[Game3D] Blaze shader failed. Restoring prior art style.');
 };
 function enableShaderGuard(on){
  if(!renderer.debug)return;
  if(on){shaderFailed=false;renderer.debug.onShaderError=shaderError;}
  else if(renderer.debug.onShaderError===shaderError)
    renderer.debug.onShaderError=priorShaderError;
 }
 function freePatch(){grassStream.setEnabled(false);}
 function freeComposer(){
  if(!composer)return;
  for(const pass of composer.passes){pass.dispose?.();}
  composer.dispose();composer=null;paper=null;bloom=null;
 }
 function makeComposer(){
  if(composer)return;
  const size=renderer.getSize(new THREE.Vector2());
  const target=new THREE.WebGLRenderTarget(size.x,size.y,{
    depthBuffer:true,type:THREE.UnsignedByteType,
  });
  composer=new EffectComposer(renderer,target);
  composer.setPixelRatio(Math.min(renderer.getPixelRatio(),1));
  composer.setSize(size.x,size.y);
  composer.addPass(new RenderPass(scene,new THREE.PerspectiveCamera()));
  bloom=new UnrealBloomPass(new THREE.Vector2(size.x,size.y),
    BLAZE_GRASS.bloom.strength,BLAZE_GRASS.bloom.radius,
    BLAZE_GRASS.bloom.threshold);
  composer.addPass(bloom);
  paper=new ShaderPass(PAPER);composer.addPass(paper);
  composer.addPass(new OutputPass());
  resize(size.x,size.y);
 }
 function resize(w,h){
  if(!composer)return;
  const width=Math.max(1,Math.floor(w)),height=Math.max(1,Math.floor(h));
  composer.setSize(width,height);
  paper.uniforms.uResolution.value.set(width,height);
 }
 function updateSettings(next){
  config=normalizeBlazeSettings(next);
  // Whiteout prevention is non-negotiable in all Sanctuary/Ultra variants:
  // no full-screen bloom, paper bleaching, heat haze or scene-wide glare.
  config.blazePostFX=false;
  const previousQuality=quality;
  quality=['low','medium','high','ultra'].includes(next?.quality)?next.quality:'high';
  if(previousQuality!==quality)grassStream.setQuality(quality);
  // Match the standalone prototype's gentle 6x palette/5.5x style easing.
  targetPalette=blazePaletteIndex(config.blazePalette);
  targetProfile=blazeProfileIndex(config.blazeProfile);
  shared.uFlameSpeed.value=config.blazeFlameSpeed;
  shared.uStructFlameRatio.value=config.blazePerimeterRatio;
  shared.uBuildingSway.value=config.blazeBuildingSway;
  shared.uPinchAmount.value=config.blazePinch;
  shared.uInkWeight.value=config.blazeInkWeight;
  shared.uCurlAmp.value=config.blazeCurl;
  shared.uLiquidGlass.value=config.blazeGlass;
  shared.uGlareBoost.value=config.blazeGlare;
  shared.uBrightness.value=config.blazeBrightness;
  shared.uPerimeterFireMode.value=0; // never illuminate buildings or ground
  shared.uFusion.value=THREE.MathUtils.clamp(config.blazeFusionStrength||0,0,1);
  shared.uTreeSway.value=config.blazeTreeSway;
  decorator.setGlass(config.blazeGlass);
  if(active)grassStream.setEnabled(config.blazeGroundCover);
  if(paper){
   paper.uniforms.uInkWeight.value=config.blazeInkWeight;
   paper.uniforms.uLiquidGlass.value=config.blazeGlass;
   paper.uniforms.uBrightness.value=config.blazeBrightness;
   paper.uniforms.uGlareBoost.value=config.blazeGlare;
  }
  if(active){
   if(config.blazePostFX){try{makeComposer();}catch(e){freeComposer();console.warn('[Game3D] Blaze post FX disabled',e);}}
   else freeComposer();
  }
 }
 function enable(next,player){
  if(!!next===active)return;
  active=!!next;
  enableShaderGuard(active);
  if(active){
   treeSpring.reset(shared.uWindStrength.value);
   shared.uTreeSpring.value=treeSpring.value;
   decorator.refresh(scene);
   grassStream.setQuality(quality);
   grassStream.setEnabled(config.blazeGroundCover);
   grassStream.update(player?.position||player);
   if(config.blazePostFX){try{makeComposer();}catch(e){freeComposer();console.warn('[Game3D] Blaze FX disabled',e);}}
  }else{
   freeComposer();
   freePatch();
   decorator.restore();
  }
 }
 function update(dt,weather={},player){
  if(!active)return;
  const step=THREE.MathUtils.clamp(Number(dt)||0,0,.1);
  clock+=step;
  shared.uTime.value=clock;
  shared.uPalette.value+=(targetPalette-shared.uPalette.value)*Math.min(1,step*6);
  shared.uArtProfile.value+=(targetProfile-shared.uArtProfile.value)*Math.min(1,step*5.5);
  const wind=Number(weather.windStrength??weather.windSpeed);
  shared.uWindStrength.value=Number.isFinite(wind)
   ?THREE.MathUtils.clamp(wind>2?wind/12:wind,.25,1.65):1;
  // Damped spring smooths gust changes; the original owner GLB leaf shader
  // continues running first and keeps its own source animation intact.
  shared.uTreeSpring.value=treeSpring.advance(shared.uWindStrength.value,step);
  const direction=Array.isArray(weather.windDirection)?weather.windDirection:
    Array.isArray(weather.wind)?weather.wind:null;
  if(direction?.length===2 && direction.every(Number.isFinite))
    shared.uTreeDirection.value.set(direction[0],direction[1]).normalize();
  const pos=player?.position;
  if(pos && [pos.x,pos.z].every(Number.isFinite))
    shared.uPlayerPos.value.copy(pos);
  grassStream.update(pos);
  decorator.update(scene,step);
  if(paper)paper.uniforms.uTime.value=clock;
 }
 function render(camera){
  if(!active||!guard?.isAlive?.())return false;
  if(shaderFailed){
   enable(false);
   return guard.render(scene,camera);
  }
  if(!composer||!config.blazePostFX){
    const drawn=guard.render(scene,camera);
    if(shaderFailed){enable(false);return guard.render(scene,camera);}
    return drawn;
  }
  composer.passes[0].camera=camera;
  try{composer.render();return true;}
  catch(e){
   console.warn('[Game3D] Blaze post FX failed, returning to scene rendering',e);
   freeComposer();
   return guard.render(scene,camera);
  }
 }
 return {
  get enabled(){return active;},
  setEnabled:enable,
  setSettings:updateSettings,
  update,render,resize,
  stats:()=>({enabled:active,...grassStream.stats(),
    decoratedMaterials:decorator.size,postFX:!!composer}),
  dispose(){
    enable(false);enableShaderGuard(false);freeComposer();
    if(typeof window!=='undefined')
      window.removeEventListener('axe:owner-tree-ready',onImportedTreeReady);
    decorator.restore();grassStream.dispose();
  },
 };
}
