// Living Perspectives: a fully procedural water landmark in the real Wolfveil
// scene — never a skybox or screenshot. Original gameplay terrain is graded
// by VortexLakeLayout; this renderer supplies water, walkable bridge, arch,
// liquid-glass whirlpool and energy ribbons without scene-wide bloom.
import * as THREE from 'three';
import {VORTEX_LAKE,vortexLakePortalCrossing} from './VortexLakeLayout.mjs';

const TAU=Math.PI*2;
const waterVertex=`
varying vec2 vBasinUV;
varying float vDepth;
uniform float uTime;
void main(){
  vBasinUV=uv;vDepth=position.y;
  vec3 p=position;
  float r=length(p.xz);
  p.y+=.12*sin(r*.23-uTime*1.25+atan(p.z,p.x)*4.0)*
    smoothstep(6.,35.,r);
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
}`;
const waterFragment=`
precision highp float;
varying vec2 vBasinUV;
varying float vDepth;
uniform float uTime;
void main(){
  float angle=vBasinUV.x*6.283185;
  float radius=vBasinUV.y;
  float spiral=sin(angle*7.0-radius*27.0-uTime*2.35);
  float ripple=sin(radius*80.0-uTime*4.4+angle*3.0);
  float glow=.5+.5*spiral;
  vec3 deep=vec3(.012,.063,.124);
  vec3 cyan=vec3(.045,.49,.66);
  vec3 violet=vec3(.19,.12,.46);
  vec3 col=mix(deep,cyan,.30+.35*glow+.14*ripple);
  col=mix(col,violet,smoothstep(.42,.95,glow)*.30);
  float edge=pow(1.0-radius,2.5);
  col+=vec3(.10,.19,.22)*edge*(.45+.55*glow);
  // Dense, naturally shaded lake rather than white lighting on the terrain.
  gl_FragColor=vec4(col,.88);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
function basinGeometry(){
  const angles=128,bands=32,pos=[],uv=[],indices=[];
  for(let j=0;j<=bands;j++){
    const fraction=j/bands;
    const radius=2.1+(1-fraction)*40.2;
    const sink=Math.pow(fraction,4)*-11.5;
    for(let i=0;i<=angles;i++){
      const angle=i/angles*TAU;
      // Subtly scalloped shore still follows the same water body.
      const contour=1+.023*Math.sin(angle*9)+.014*Math.cos(angle*17);
      pos.push(Math.cos(angle)*radius*contour,sink,
        Math.sin(angle)*radius*.865*contour);
      uv.push(i/angles,fraction);
      if(i<angles&&j<bands){
        const k=j*(angles+1)+i;
        indices.push(k,k+1,k+angles+1,k+1,k+angles+2,k+angles+1);
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}
function energyRibbon(root,phase,material){
  // A 3D spiral falling into the abyss, not a flat luminous halo.
  const path=[];
  for(let i=0;i<=80;i++){
    const t=i/80;
    const r=34*(1-t)+2*t;
    const a=phase+TAU*t*2.35;
    path.push(new THREE.Vector3(
      r*Math.cos(a),1.2+Math.sin(t*TAU+phase)*.55-10.2*Math.pow(t,2.6),
      .865*r*Math.sin(a)));
  }
  const curve=new THREE.CatmullRomCurve3(path);
  const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,160,.12,5,false),material);
  tube.userData.blazeProcedural=true;
  root.add(tube);return tube;
}
function rock(root,material,x,y,z,sx,sy,sz,rotation=0){
  const m=new THREE.Mesh(new THREE.DodecahedronGeometry(1,1),material);
  m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.y=rotation;
  m.castShadow=true;m.receiveShadow=true;root.add(m);return m;
}
function addCavern(root){
  const stone=new THREE.MeshStandardMaterial({
    color:0x495567,roughness:.93,metalness:.02,flatShading:true,
  });
  const darkStone=new THREE.MeshStandardMaterial({
    color:0x2b3746,roughness:.96,metalness:.02,flatShading:true,
  });
  const glow=new THREE.MeshStandardMaterial({
    color:0x548da8,emissive:0x165a79,emissiveIntensity:.9,
    roughness:.27,metalness:.34,
  });
  const passage=new THREE.Group();
  passage.position.set(VORTEX_LAKE.mouthX-VORTEX_LAKE.centerX,0,
    VORTEX_LAKE.mouthZ-VORTEX_LAKE.centerZ);
  passage.name='Wolfveil_SunlitMountainWaterMouth';
  root.add(passage);
  // Stone arch from a genuine 3D half-torus with >30m of open air and a
  // 26m ceiling. The tunnel itself remains open to daylight from the south.
  for(const z of [0,14,28]){
    const arch=new THREE.Mesh(new THREE.TorusGeometry(19.5,4.6,8,56,Math.PI),
      z===14?darkStone:stone);
    arch.position.set(0,2.7,z);
    arch.castShadow=true;arch.receiveShadow=true;passage.add(arch);
    for(const side of [-1,1]){
      rock(passage,stone,side*22,9,z,7.4,12,10,z*.12+side);
      rock(passage,darkStone,side*25,17,z+5,6.2,7.5,6.4,side+.3);
    }
  }
  // An irregular but OPEN mountain vault: skylight and a full-height
  // southern mouth; not a closed black wall across the water entrance.
  for(let i=0;i<10;i++){
    const z=6+i*2.7;
    const slab=rock(passage,stone,(i%2?1:-1)*8.5,28+Math.sin(i)*2,z,
      10,4.3,4.8,i*.3);
    slab.castShadow=true;
  }
  for(let j=0;j<9;j++){
    const angle=j*.84;
    const crystal=new THREE.Mesh(new THREE.ConeGeometry(.45,3.0+j%3,6),glow);
    crystal.position.set(Math.cos(angle)*14,19+j%4,
      6+j*2.2);crystal.rotation.z=Math.PI;
    passage.add(crystal);
  }
  // The water surface truly extends under the 30m-wide entrance.
  const streamMat=new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0}},
    transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:`varying vec2 vUv;void main(){
      vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
    }`,
    fragmentShader:`precision highp float;
      varying vec2 vUv;uniform float uTime;
      float flow(){
        return sin(vUv.y*44.-uTime*3.8+vUv.x*13.)*.5+.5;
      }
      void main(){
        float r=flow(),ridge=pow(r,7.);
        vec3 dark=vec3(.02,.11,.18),teal=vec3(.035,.32,.47);
        vec3 col=mix(dark,teal,.42+.42*r)+ridge*vec3(.06,.13,.15);
        gl_FragColor=vec4(col,.83);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const stream=new THREE.Mesh(new THREE.PlaneGeometry(26,67,18,28),streamMat);
  stream.rotation.x=-Math.PI/2;stream.position.set(-2,-.05,15);
  passage.add(stream);
  const shaft=new THREE.SpotLight(0xcfe2ed,26,82,Math.PI/5,.6,1.9);
  shaft.position.set(0,31,2);shaft.target.position.set(0,3,17);
  passage.add(shaft,shaft.target);
  // Bridge from the southern bank to the vortex lip. This is registered in
  // the game's existing groundMeshes raycaster, not a separate physics floor.
  return {passage,water:stream};
}
function bridgePieces(root,{sampleGroundY}={}){
  const deckMaterial=new THREE.MeshStandardMaterial({
    color:0x5e6570,roughness:.87,metalness:.09,
  });
  const bronze=new THREE.MeshStandardMaterial({
    color:0x786b58,roughness:.55,metalness:.45,
  });
  const deck=new THREE.Mesh(new THREE.BoxGeometry(4.2,.58,33),deckMaterial);
  deck.position.set(0,1.70,-20);
  deck.receiveShadow=true;deck.name='Wolfveil_VortexLakeWalkableBridgeDeck';
  deck.userData.bridgeWalkable=true;
  root.add(deck);
  // Long, grade-matched ramp joins the original mountain bank to the
  // raised deck: a standing player can reach the water portal on foot.
  const worldBankZ=VORTEX_LAKE.centerZ+VORTEX_LAKE.worldOffsetZ-65;
  const bankY=sampleGroundY?.(VORTEX_LAKE.centerX,worldBankZ);
  const groundY=Number.isFinite(bankY)?bankY+.25:VORTEX_LAKE.waterY+1.2;
  const deckTop=VORTEX_LAKE.waterY+1.70+.29;
  const dz=30,rise=deckTop-groundY;
  const rampLength=Math.hypot(dz,rise);
  const ramp=new THREE.Mesh(new THREE.BoxGeometry(4.4,.58,rampLength),
    deckMaterial);
  ramp.position.set(0,(groundY+deckTop)/2-VORTEX_LAKE.waterY-.29,-50);
  ramp.rotation.x=-Math.atan2(rise,dz);
  ramp.receiveShadow=true;
  ramp.name='Wolfveil_VortexLake_GroundedBridgeApproach';
  ramp.userData.bridgeWalkable=true;
  root.add(ramp);
  for(const side of [-1,1]){
    for(let i=0;i<9;i++){
      const z=-35+i*3.65;
      const post=new THREE.Mesh(new THREE.BoxGeometry(.28,1.6,.28),bronze);
      post.position.set(side*1.97,2.45,z);root.add(post);
    }
    const rail=new THREE.Mesh(new THREE.BoxGeometry(.16,.18,32),bronze);
    rail.position.set(side*1.97,3.25,-20);root.add(rail);
  }
  return {deck,ramp};
}
function makeSpiralingCore(root){
  const core=new THREE.Mesh(new THREE.CylinderGeometry(2.5,1.3,17,32,1,true),
    new THREE.MeshBasicMaterial({
      color:0x16265a,transparent:true,opacity:.42,
      side:THREE.DoubleSide,depthWrite:false,
    }));
  core.position.y=-7.5;root.add(core);
  const rings=new THREE.Group();root.add(rings);
  const mats=[0x1cabc4,0x5366d0,0x887de5].map(color=>
    new THREE.MeshBasicMaterial({color,transparent:true,
      opacity:.54,depthWrite:false}));
  for(let i=0;i<9;i++){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(3.3+i*.28,.10,6,80),
      mats[i%3]);
    ring.rotation.x=-Math.PI/2;
    ring.position.y=.35-i*.9;
    rings.add(ring);
  }
  return rings;
}
export function createVortexLakeLandmark(scene,{addGroundMesh,removeGroundMesh,sampleGroundY}={}){
  if(!scene?.add)throw new Error('The vortex lake needs the existing game scene');
  const root=new THREE.Group();
  root.name='Wolfveil_LivingPerspectivesLakeVortex';
  root.position.set(VORTEX_LAKE.centerX,VORTEX_LAKE.waterY,
    VORTEX_LAKE.centerZ+VORTEX_LAKE.worldOffsetZ);
  root.userData.blazeProcedural=true;
  scene.add(root);
  const mat=new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0}},
    vertexShader:waterVertex,fragmentShader:waterFragment,
    side:THREE.DoubleSide,transparent:true,depthWrite:false,
  });
  const water=new THREE.Mesh(basinGeometry(),mat);
  water.name='Wolfveil_ExpandedRiverMountainBasin';
  water.userData.blazeProcedural=true;
  water.renderOrder=2;root.add(water);
  const cave=addCavern(root);
  const {deck:bridge,ramp}=bridgePieces(root,{sampleGroundY});
  // The main terrain and physical river remain the authoritative world.
  // These two walkable bridge pieces are intentionally added to the existing
  // player/companion/ranged ground raycaster, not a new collision authority.
  root.updateMatrixWorld(true);
  addGroundMesh?.(bridge);
  addGroundMesh?.(ramp);
  const ribbons=new THREE.Group();
  ribbons.name='LivingUltraSumi_WaterEnergyVortex';root.add(ribbons);
  const palette=[0x2c9dc5,0x7172db,0x3adac0,0x936ad5];
  const ribbonMaterials=palette.map(color=>new THREE.MeshBasicMaterial({
    color,transparent:true,opacity:.62,depthWrite:false,
  }));
  for(let i=0;i<16;i++)energyRibbon(ribbons,TAU*i/16,ribbonMaterials[i%4]);
  const rings=makeSpiralingCore(root);
  const darkMouth=new THREE.Mesh(new THREE.CircleGeometry(2.25,64),
    new THREE.MeshBasicMaterial({color:0x09152c,side:THREE.DoubleSide}));
  darkMouth.rotation.x=-Math.PI/2;darkMouth.position.y=-11.3;
  root.add(darkMouth);
  let t=0,last=null,entered=false;
  return {
    root,bridge,water,
    get status(){return {entered,time:t,worldPosition:root.position.toArray()};},
    update(dt,position){
      t+=Math.min(.08,Math.max(0,Number(dt)||0));
      mat.uniforms.uTime.value=t;
      ribbons.rotation.y=t*.17;
      rings.rotation.y=-t*.68;
      rings.position.y=Math.sin(t*1.7)*.24;
      cave.water.material.uniforms.uTime.value=t;
      const crossing=vortexLakePortalCrossing(last,position);
      last=position?{x:position.x,z:position.z}:null;
      if(!entered&&crossing){
        entered=true;return {target:VORTEX_LAKE.dungeon,sourcePortal:'vortex'};
      }
      return null;
    },
    dispose(){
      removeGroundMesh?.(bridge);
      removeGroundMesh?.(ramp);
      scene.remove(root);
      root.traverse(obj=>{
        if(!obj.isMesh)return;
        obj.geometry?.dispose();
        if(Array.isArray(obj.material))obj.material.forEach(m=>m?.dispose());
        else obj.material?.dispose();
      });
      mat.dispose();
    },
  };
}
