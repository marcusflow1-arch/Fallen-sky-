/**
 * Game 3D clone preview: new real-time graphics preset.
 * New rendering code only. No textures/models loaded, no collision changes.
 * Existing geometry is shaded procedurally; textures are not sampled by these
 * GLSL materials. Switching off restores the originals.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import {
  ATOMIC_WORLD_VERTEX,ATOMIC_GRASS_VERTEX,ATOMIC_WORLD_FRAGMENT,
  ATOMIC_SCREEN_VERTEX,ATOMIC_SOBEL_FRAGMENT,ATOMIC_HEAT_FRAGMENT,
  ATOMIC_SPARK_VERTEX,ATOMIC_SPARK_FRAGMENT,
  ATOMIC_HULL_VERTEX,ATOMIC_HULL_FRAGMENT,
} from './atomicUltraSumiShaders.mjs';

export const ATOMIC_ULTRA_SUMI = Object.freeze({
  style:'atomic-ultra-sumi', blades:60000, segments:5, meadowArea:1000,
  bloomThreshold:.72,bloomStrength:1.35,bloomRadius:.55,
  sparks:2048,
});
const FAMILY={terrain:0,grass:1,foliage:2,stone:3,architecture:4,character:5,water:6,material:7};
const noRaycast=()=>{};
const rng=(seed)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296;};
function classify(mesh){
  if(!(mesh?.isMesh||mesh?.isInstancedMesh) || !mesh.geometry ||
      mesh.userData?.atomicUltraSumiOwned || mesh.userData?.editorOnly ||
      mesh.userData?.isHitbox || mesh.userData?.isCollider) return null;
  const source=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  if(source.some(m=>!m||m.isShaderMaterial||m.isRawShaderMaterial||m.transparent||m.depthWrite===false))return null;
  const name=(mesh.name+' '+source.map(m=>m.name||'').join(' ')).toLowerCase();
  if(/sky|cloud|star|sunlight|hud|reticle|pointer|marker|debug|editor|particle|vfx|portal|fire|translucent|glass/.test(name))return null;
  if(/water|river|waterfall|lake|foam/.test(name))return 'water';
  if(/grass|lawn|blade|meadow|reed/.test(name))return 'grass';
  if(/tree|trunk|bark|branch|canopy|leaves|leaf|bamboo|shrub|flower|fern/.test(name))return 'foliage';
  if(/rock|stone|cliff|cave|mountain|ridge|boulder/.test(name))return 'stone';
  if(/terrain|ground|earth|soil|bank|hillside/.test(name))return 'terrain';
  if(/bridge|wall|arch|torii|shrine|house|palace|temple|roof|floor|paving|rail|gate|door/.test(name))return 'architecture';
  return mesh.isSkinnedMesh?'character':'material';
}
function shaderMaterial(family,shared,vertex=ATOMIC_WORLD_VERTEX){
  return new THREE.ShaderMaterial({
    name:'AtomicUltraSumi_'+family,
    uniforms:{uTime:shared.time,uMode:shared.mode,
      uWindStrength:shared.wind,uEnergyIntensity:shared.energy,
      uFamily:{value:FAMILY[family]??7}},
    vertexShader:vertex,fragmentShader:ATOMIC_WORLD_FRAGMENT,
    side:THREE.DoubleSide,transparent:false,depthTest:true,depthWrite:true,
    toneMapped:false,
  });
}
export function createAtomicUltraSumiBladeGeometry(){
  const positions=[],normals=[],uv=[],triangles=[];
  for(let i=0;i<=ATOMIC_ULTRA_SUMI.segments;i++){
    const t=i/ATOMIC_ULTRA_SUMI.segments,w=.065*(1-t)+.002;
    for(const side of [-1,1]){
      positions.push(side*w,t*.83,t*t*.13);
      normals.push(0,.35,.937);uv.push((side+1)*.5,t);
    }
    if(i<ATOMIC_ULTRA_SUMI.segments){
      const k=i*2;triangles.push(k,k+1,k+2,k+1,k+3,k+2);
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(triangles);g.computeBoundingSphere();
  return g;
}
function createMeadow(scene,shared){
  const geometry=createAtomicUltraSumiBladeGeometry();
  const material=shaderMaterial('grass',shared,ATOMIC_GRASS_VERTEX);
  const mesh=new THREE.InstancedMesh(geometry,material,ATOMIC_ULTRA_SUMI.blades);
  mesh.name='AtomicUltraSumi_60000_5Segment_Grass';mesh.count=0;
  mesh.castShadow=false;mesh.receiveShadow=false;mesh.frustumCulled=false;
  mesh.raycast=noRaycast;mesh.userData.atomicUltraSumiOwned=true;
  scene.add(mesh);
  const dummy=new THREE.Object3D();
  let active=null;
  function start(x,z){
    active={x,z,r:rng((Math.floor(x*17)^Math.floor(z*43)^1421)>>>0),
      attempts:0,count:0,heights:new Map()};
    mesh.count=0;
  }
  function step(sampleHeight,allowGrass,maxCount=2500,total=ATOMIC_ULTRA_SUMI.blades){
    if(!active||active.count>=total)return;
    let tested=0;
    const span=Math.sqrt(ATOMIC_ULTRA_SUMI.meadowArea);
    while(tested<maxCount && active.count<total && active.attempts<total*5){
      tested++;active.attempts++;
      const rand=active.r,x=active.x+(rand()-.5)*span,z=active.z+(rand()-.5)*span;
      if(allowGrass&&!allowGrass(x,z))continue;
      const gx=Math.floor(x/2),gz=Math.floor(z/2),key=gx+':'+gz;
      if(!active.heights.has(key))
        active.heights.set(key,sampleHeight((gx+.5)*2,(gz+.5)*2));
      const y=active.heights.get(key);
      if(!Number.isFinite(y))continue;
      dummy.position.set(x,y,z);
      dummy.rotation.set(0,rand()*Math.PI*2,0);
      const height=.68+rand()*.55;
      dummy.scale.set(.7+rand()*.58,height,.82);
      dummy.updateMatrix();
      mesh.setMatrixAt(active.count++,dummy.matrix);
    }
    mesh.count=active.count;mesh.instanceMatrix.needsUpdate=true;
  }
  return {mesh,start,step,get anchor(){return active&&{x:active.x,z:active.z};},
    dispose(){scene.remove(mesh);geometry.dispose();material.dispose();}};
}
function createSparks(scene,shared){
  const rand=rng(3463),points=[],seeds=[];
  for(let i=0;i<ATOMIC_ULTRA_SUMI.sparks;i++){
    const angle=rand()*Math.PI*2,d=Math.sqrt(rand())*16;
    points.push(Math.sin(angle)*d,rand()*1.4,Math.cos(angle)*d);
    seeds.push(rand());
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  geometry.setAttribute('aSeed',new THREE.Float32BufferAttribute(seeds,1));
  const material=new THREE.ShaderMaterial({
    uniforms:{uTime:shared.time,uEnergyIntensity:shared.energy},
    vertexShader:ATOMIC_SPARK_VERTEX,fragmentShader:ATOMIC_SPARK_FRAGMENT,
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  });
  const mesh=new THREE.Points(geometry,material);
  mesh.name='AtomicUltraSumi_Sparks';mesh.frustumCulled=false;
  mesh.raycast=noRaycast;mesh.userData.atomicUltraSumiOwned=true;
  scene.add(mesh);
  return{mesh,dispose(){scene.remove(mesh);geometry.dispose();material.dispose();}};
}
/**
 * This controller is a non-destructive material + postprocessing preview. It
 * does not touch mesh positions, scale, collision, quest scripts or physics.
 * Bloom/ink use a postprocessed copy of the existing game camera.
 */
export function createAtomicUltraSumiMode({
  scene,renderer,camera,sampleHeight=()=>null,allowGrass=()=>true,
  quality='high',enabled=false,
}={}){
  if(!scene||!renderer||!camera)throw Error('Atomic mode needs a Three.js scene, renderer, camera');
  const shared={time:{value:0},mode:{value:2},energy:{value:1},wind:{value:.52}};
  const materials=new Map(),originals=new Map(),hiddenGrass=new Map(),size=new THREE.Vector2();
  const hulls=[];let hullMaterial=null;
  let active=false,disposed=false,composer=null,ink=null,haze=null;
  let meadow=null,sparks=null,age=0,lastRefresh=-10,lastMeadow=-10;
  let qualitySetting=quality;
  function acquire(family){
    if(!materials.has(family))materials.set(family,shaderMaterial(family,shared));
    return materials.get(family);
  }
  function addHull(mesh,family){
    // A small number of near-camera meshes receive a true inverted hull.
    // Keep duplicate draw work bounded; silhouettes elsewhere use Sobel.
    if(hulls.length>=24 || !mesh.isMesh || mesh.isSkinnedMesh ||
        mesh.isInstancedMesh || (family!=='stone'&&family!=='architecture') ||
        (mesh.geometry?.attributes?.position?.count??Infinity)>12000)return;
    const near=new THREE.Vector3();
    mesh.getWorldPosition(near);
    if(near.distanceTo(camera.position)>65)return;
    if(!hullMaterial){
      hullMaterial=new THREE.ShaderMaterial({
        name:'AtomicUltraSumi_InvertedHull',
        uniforms:{uTime:shared.time,uEnergyIntensity:shared.energy},
        vertexShader:ATOMIC_HULL_VERTEX,fragmentShader:ATOMIC_HULL_FRAGMENT,
        side:THREE.BackSide,depthWrite:false,depthTest:true,
        transparent:false,toneMapped:false,
      });
    }
    const child=new THREE.Mesh(mesh.geometry,hullMaterial);
    child.name='AtomicUltraSumi_InvertedHull';child.raycast=noRaycast;
    child.userData.atomicUltraSumiOwned=true;child.renderOrder=mesh.renderOrder;
    mesh.add(child);hulls.push({parent:mesh,child});
  }
  function clearHulls(){
    for(const {parent,child} of hulls)parent.remove(child);
    hulls.length=0;
    hullMaterial?.dispose();hullMaterial=null;
  }
  function refresh(){
    if(!active)return;
    scene.traverse(mesh=>{
      // Do not stack legacy hundreds-of-thousands of valley blades beneath
      // our experimental 60k GPU field. Visual-only change, restored on exit.
      if(mesh?.isInstancedMesh && /^SWV_(?:Individual|Near)_GrassBlades_/.test(mesh.name||'')){
        if(!hiddenGrass.has(mesh))hiddenGrass.set(mesh,mesh.visible);
        mesh.visible=false;
        return;
      }
      if(originals.has(mesh))return;
      const family=classify(mesh);if(!family)return;
      originals.set(mesh,mesh.material);
      mesh.material=acquire(family);
      addHull(mesh,family);
    });
  }
  function restore(){
    const owned=new Set(materials.values());
    for(const [mesh,original] of originals)
      if(owned.has(mesh.material))mesh.material=original;
    originals.clear();
    for(const [mesh,wasVisible] of hiddenGrass)
      if(mesh.visible===false)mesh.visible=wasVisible;
    hiddenGrass.clear();
  }
  function resize(){
    if(!composer)return;
    renderer.getSize(size);
    composer.setSize(Math.max(1,size.x),Math.max(1,size.y));
    renderer.getDrawingBufferSize(size);
    ink.material.uniforms.uResolution.value.copy(size);
    haze.material.uniforms.uResolution.value.copy(size);
  }
  function ensureComposer(){
    if(composer)return;
    composer=new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene,camera));
    ink=new ShaderPass({uniforms:{tDiffuse:{value:null},
      uResolution:{value:new THREE.Vector2(1,1)}},
      vertexShader:ATOMIC_SCREEN_VERTEX,fragmentShader:ATOMIC_SOBEL_FRAGMENT});
    composer.addPass(ink);
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(1,1),
      ATOMIC_ULTRA_SUMI.bloomStrength,ATOMIC_ULTRA_SUMI.bloomRadius,
      ATOMIC_ULTRA_SUMI.bloomThreshold));
    haze=new ShaderPass({uniforms:{tDiffuse:{value:null},uTime:shared.time,
      uResolution:{value:new THREE.Vector2(1,1)}},
      vertexShader:ATOMIC_SCREEN_VERTEX,fragmentShader:ATOMIC_HEAT_FRAGMENT});
    composer.addPass(haze);
    composer.addPass(new OutputPass());
    resize();
  }
  function setQuality(next){
    qualitySetting=next;
    shared.energy.value=next==='low'?.5:next==='medium'?.72:next==='high'?.88:1;
  }
  function setEnabled(next){
    if(disposed||active===!!next)return;
    active=!!next;
    if(active){
      ensureComposer();refresh();
      meadow=createMeadow(scene,shared);
      sparks=createSparks(scene,shared);
      lastMeadow=-10;lastRefresh=-10;
    }else{
      meadow?.dispose();meadow=null;
      sparks?.dispose();sparks=null;
      clearHulls();restore();
    }
  }
  function update(dt,position,weather={}){
    if(disposed||!active)return;
    const step=Math.max(0,Math.min(Number(dt)||0,.08));
    age+=step;shared.time.value=age;
    const wind=Number(weather?.windSpeed);
    shared.wind.value=Number.isFinite(wind)
      ?Math.min(1.4,Math.max(.35,.45+wind*.014)):.62;
    if(age-lastRefresh>4){lastRefresh=age;refresh();}
    if(position && Number.isFinite(position.x)&&Number.isFinite(position.z)){
      const x=position.x,z=position.z;
      sparks?.mesh.position.set(x,Number(position.y)||0,z);
      if((!meadow?.anchor||Math.hypot(meadow.anchor.x-x,meadow.anchor.z-z)>18)&&
          age-lastMeadow>5){
        lastMeadow=age;meadow?.start(x,z);
      }
      const budget=qualitySetting==='low'?15000:qualitySetting==='medium'?30000:ATOMIC_ULTRA_SUMI.blades;
      meadow?.step(sampleHeight,allowGrass,2600,budget);
    }
  }
  function render(viewCamera=camera){
    if(!active||disposed)return false;
    if(renderer.getContext()?.isContextLost?.())return false;
    ensureComposer();
    renderer.getSize(size);
    const effectiveDpr=renderer.getPixelRatio?.()||1;
    const expectedW=Math.max(1,Math.floor(size.x*effectiveDpr));
    // The clone's AdaptiveGraphics adjusts DPR without a window resize.
    // Composer and Sobel texel offsets must follow that change.
    if(composer.readBuffer.width!==expectedW){
      composer.setPixelRatio(effectiveDpr);
      resize();
    }
    composer.passes[0].camera=viewCamera;
    composer.render();
    return true;
  }
  function dispose(){
    if(disposed)return;
    setEnabled(false);disposed=true;
    for(const mat of materials.values())mat.dispose();
    materials.clear();composer?.dispose();composer=null;
  }
  setQuality(quality);setEnabled(enabled);
  return {setEnabled,setQuality,update,render,resize,dispose,
    get enabled(){return active;},
    get stats(){return {enabled:active,decoratedMeshes:originals.size,
      grassBlades:meadow?.mesh.count??0,sparks:active?ATOMIC_ULTRA_SUMI.sparks:0};}};
}
