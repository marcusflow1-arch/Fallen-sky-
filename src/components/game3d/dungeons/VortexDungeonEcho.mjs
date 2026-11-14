// Symbolic continuation of the lake vortex inside the EXISTING five-hall
// Lunar Cave dungeon. Light follows paths; no new combat arena, collision,
// loot grants, AI authority, level change or replacement floor.
import * as THREE from 'three';
import {LUNAR_CAVE_CHAMBERS,LUNAR_CAVE_PASSAGES}
  from './LunarCaveLayout.mjs';
const TAU=Math.PI*2;
export function addVortexDungeonEcho(dungeonRoot){
  if(!dungeonRoot?.add)throw new Error('Dungeon echo needs existing Lunar Cave root');
  const root=new THREE.Group();
  root.name='LivingPerspectives_VortexDungeonMemory';
  root.userData.blazeProcedural=true;
  dungeonRoot.add(root);
  const shader=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{uTime:{value:0}},
    vertexShader:`varying vec2 vUv;void main(){
      vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
    }`,
    fragmentShader:`precision highp float;
      uniform float uTime;varying vec2 vUv;
      void main(){
        float pulse=.5+.5*sin(vUv.x*46.-uTime*2.2);
        float ink=sin(vUv.x*65.+uTime*.64)*.10;
        vec3 jade=vec3(.02,.48,.49),violet=vec3(.23,.14,.53);
        vec3 color=mix(jade,violet,pulse*.72);
        color+=ink*vec3(.09,.15,.17);
        gl_FragColor=vec4(color,.28+.47*pulse);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const roots=[];
  for(let i=0;i<LUNAR_CAVE_PASSAGES.length;i++){
    const p=LUNAR_CAVE_PASSAGES[i];
    const start=new THREE.Vector3(p.ax,12.1,p.az);
    const end=new THREE.Vector3(p.bx,12.1,p.bz);
    const mid=start.clone().lerp(end,.5);
    mid.x+=Math.sin(i*2.3)*2;
    mid.y=11.2+Math.cos(i*1.3)*1.2;
    const curve=new THREE.CatmullRomCurve3([start,mid,end]);
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,40,.085,5,false),shader);
    mesh.userData.blazeProcedural=true;root.add(mesh);roots.push(mesh);
  }
  const circles=[];
  const colors=[0x29a6c0,0x7f61c4,0x50b5bc,0x936bbc,0x44a1bd];
  for(let i=0;i<LUNAR_CAVE_CHAMBERS.length;i++){
    const c=LUNAR_CAVE_CHAMBERS[i];
    const portal=new THREE.Group();portal.name='LunarMemory_'+c.id;
    portal.position.set(c.x,6.8,c.z);
    root.add(portal);
    const ink=new THREE.MeshBasicMaterial({
      color:colors[i],transparent:true,opacity:.38,depthWrite:false,
    });
    for(let k=0;k<3;k++){
      const loop=new THREE.Mesh(new THREE.TorusGeometry(5.6+k*1.65,.10,6,70),ink);
      loop.rotation.y=(i+k)*.37;
      loop.rotation.x=Math.PI/2-(k-1)*.19;
      portal.add(loop);
    }
    // Each node offers a different point of view without forcing an
    // explanation: the same energy transforms at every threshold.
    const center=new THREE.Mesh(new THREE.OctahedronGeometry(.52+i*.045,1),
      new THREE.MeshStandardMaterial({
        color:0x91bbd7,emissive:colors[i],emissiveIntensity:.8,
        roughness:.3,metalness:.36,
      }));
    center.position.y=1;portal.add(center);
    circles.push({portal,center});
  }
  let seconds=0;
  return {
    root,
    update(dt){
      seconds+=Math.min(.1,Math.max(0,Number(dt)||0));
      shader.uniforms.uTime.value=seconds;
      for(let i=0;i<circles.length;i++){
        const c=circles[i];
        c.portal.rotation.y=seconds*(i%2?.09:-.11);
        c.center.rotation.y=seconds*.29;
        c.center.position.y=1+Math.sin(seconds*1.3+i)*.32;
      }
    },
    // Parent Lunar Cave disposeRoot owns the meshes, source geometry and
    // shared shader material. Do not double-dispose them here.
  };
}
