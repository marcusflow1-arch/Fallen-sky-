// Pure procedural arena staging. Independent THREE.Group keeps the existing
// world terrain, central town tree, houses, paths and collision untouched.
// The same arena root can later be mounted into an isolated match instance.
import * as THREE from 'three';
import {miniGameById} from '../../../../base44/shared/game3dMiniGameCatalog.mjs';

const MAT=(color)=>new THREE.MeshStandardMaterial({color,roughness:.87,metalness:.03});
function cube(root,x,y,z,w,h,l,color){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,l),MAT(color));
  mesh.position.set(x,y,z);root.add(mesh);return mesh;
}
function line(root,x,z,w,l,color='#f1eadb'){
  return cube(root,x,.11,z,w,.025,l,color);
}
function ring(root,x,z,inner,outer,color){
  const mesh=new THREE.Mesh(new THREE.RingGeometry(inner,outer,64),MAT(color));
  mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.13,z);root.add(mesh);
}
function pillar(root,x,z,h,color){return cube(root,x,h*.5+.12,z,.18,h,.18,color);}
function net(root,w){
  cube(root,0,1.28,0,w,.035,.05,'#e6edf6');
  for(let x=-w/2;x<w/2;x+=.65)pillar(root,x,0,2.1,'#9bbdc6');
}
const board=(root,checkers)=>{
  for(let row=0;row<8;row++)for(let col=0;col<8;col++){
    const x=(col-3.5)*1.65,z=(row-3.5)*1.65;
    cube(root,x,.145,z,1.65,.11,1.65,(row+col)%2?'#354f61':'#d7d4bf');
    const occupant=checkers?(row<3||row>4) && ((row+col)%2===1):
      (row<2||row>5);
    if(!occupant)continue;
    const top=row<4?'#d1dfef':'#753847';
    const pawn=new THREE.Mesh(new THREE.CylinderGeometry(
      checkers ? .43 : .32,checkers ? .43 : .37,checkers ? .2 : .58,16),MAT(top));
    pawn.position.set(x,.25+(checkers ? .10 : .29),z);root.add(pawn);
  }
};
export function buildMiniGameArena(gameId){
  const game=miniGameById(gameId);
  if(!game)throw Error('Unknown Mini Game arena');
  const root=new THREE.Group();
  root.name='Game3D_MiniGame_Arena_'+game.id;
  const large=['football','soccer'].includes(gameId);
  const w=large?30:['basketball','volleyball'].includes(gameId)?22:gameId==='tennis'?17:17;
  const l=large?54:gameId==='basketball'?36:gameId==='volleyball'?27:gameId==='tennis'?30:18;
  let floor='#324854';
  if(['football','soccer'].includes(gameId))floor='#30574c';
  if(gameId==='basketball')floor='#956449';
  if(gameId==='tennis')floor='#395f69';
  if(gameId==='volleyball')floor='#d1ab72';
  if(gameId==='sumo')floor='#a98663';
  if(gameId==='palm-clash')floor='#32394b';
  cube(root,0,-.12,0,w+.7,.24,l+.7,'#122334');
  cube(root,0,.02,0,w,.10,l,floor);
  // Perimeter lines preserve readable silhouettes in the compact live preview.
  for(const x of [-w/2+.7,w/2-.7])line(root,x,0,.12,l-1.4);
  for(const z of [-l/2+.7,l/2-.7])line(root,0,z,w-1.4,.12);
  if(gameId==='football'){
    for(let z=-20;z<=20;z+=5)line(root,0,z,w-1.8,.08,'#edf4e9');
    for(const z of [-23,23]){
      cube(root,0,.17,z,w-2, .12,5,z<0?'#2b6880':'#7b5268');
      pillar(root,-3,z,5,'#fff0aa');pillar(root,3,z,5,'#fff0aa');
      cube(root,0,3.8,z,6,.14,.14,'#fff0aa');
    }
  }else if(gameId==='soccer'){
    ring(root,0,0,4.6,4.71,'#e7efe7');
    line(root,0,0,w-1.5,.13);
    for(const z of [-l/2+.8,l/2-.8]){
      const off=z<0?2.2:-2.2;
      cube(root,-4.4,1,z+off,.13,2,.14,'#f5f1e7');
      cube(root,4.4,1,z+off,.13,2,.14,'#f5f1e7');
      cube(root,0,2,z+off,8.8,.12,.12,'#f5f1e7');
    }
  }else if(gameId==='basketball'){
    ring(root,0,0,3.4,3.52,'#f3eac7');
    line(root,0,0,w-1.5,.12,'#f3eac7');
    for(const z of [-l/2+1.6,l/2-1.6]){
      const dir=z>0?1:-1;
      pillar(root,0,z+dir*.9,3.5,'#c9d9e6');
      cube(root,0,3.5,z,2.8,1.6,.14,'#eaf1fa');
      ring(root,0,z-dir*.8,.55,.65,'#dd763e');
    }
  }else if(gameId==='tennis'||gameId==='volleyball'){
    net(root,w-1.6);line(root,0,0,w-1,.14,'#dfe9e4');
    for(const x of [-w*.28,w*.28])line(root,x,0,.12,l*.8,'#dfe9e4');
    if(gameId==='tennis'){
      for(const z of [-l*.23,l*.23])line(root,0,z,w*.55,.12,'#dfe9e4');
    }
  }else if(gameId==='sumo'){
    ring(root,0,0,5.5,6.0,'#edddbd');
    for(let i=0;i<32;i++){
      const a=i*Math.PI/16;
      cube(root,Math.cos(a)*6.8,.16,Math.sin(a)*6.8,.8,.2,.75,'#c3986c');
    }
    line(root,0,0,1,.10,'#fff1cf');
  }else if(gameId==='palm-clash'){
    cube(root,0,.72,0,7,1.35,4.6,'#394f71');
    cube(root,0,1.44,0,2.5,.2,1.5,'#e3c6a2');
    for(const z of [-3.2,3.2]){
      const marker=new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.4,.12,32),MAT('#65d8e5'));
      marker.position.set(0,.18,z);root.add(marker);
    }
  }else if(gameId==='chess'||gameId==='checkers')board(root,gameId==='checkers');
  // 3D arenas are staging previews, not authoritative match collision surfaces.
  root.userData={miniGameId:gameId,previewOnly:true,collisionEnabled:false};
  return root;
}
export function disposeMiniGameArena(root){
  if(!root)return;
  root.traverse(node=>{
    if(!node.isMesh)return;
    node.geometry?.dispose?.();
    if(Array.isArray(node.material))node.material.forEach(m=>m.dispose?.());
    else node.material?.dispose?.();
  });
}
