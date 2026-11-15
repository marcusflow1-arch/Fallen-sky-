import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const SUIGEN_QUEST_POIS=Object.freeze([
  {id:'suigen-keep-council',name:'Acropolis Council',x:0,z:-105,category:'story',chapter:1},
  {id:'suigen-market-crossing',name:'Moonsteel Market',x:0,z:217,category:'town',chapter:1},
  {id:'suigen-forest-shrine',name:'Bamboo Shrine',x:-230,z:295,category:'discovery',chapter:2},
  {id:'suigen-abyss-gate',name:'Abyss Descent',x:-440,z:420,category:'dungeon',chapter:3},
  {id:'suigen-abyss-vault',name:'Sealed Abyss Vault',x:-440,z:328,category:'boss',chapter:3},
  {id:'suigen-water-vortex',name:'Water Tornado and Mountain Lake',x:205,z:390,category:'portal',chapter:4},
  {id:'suigen-mountain-cave',name:'Moonstone Mountain Gate',x:171,z:222,category:'dungeon',chapter:2},
  {id:'suigen-astral-gate',name:'Celestial Trial Gate',x:197,z:224,category:'dungeon',chapter:5},
]);
export const SUIGEN_CAVE_PORTALS=Object.freeze([
  {id:'abyss-entry',name:'Abyss Gate to Moonstone Hall',
    x:-440,z:420,target:'lunar-cave',returnToGate:true},
  {id:'astral-trial',name:'Celestial Trial Portal',
    x:197,z:224,target:'astral-dungeon',returnToGate:'astral'},
]);

const boulderShape=new THREE.DodecahedronGeometry(1,1);
const trunkShape=new THREE.CylinderGeometry(.35,.58,1,9,3);
const crownShape=new THREE.IcosahedronGeometry(1,2);
const floorShape=new THREE.PlaneGeometry(1,1);
floorShape.rotateX(-Math.PI/2);

/**
 * Rock stair reinforcement: existing imported Abyss treads drop ~1.076 m at
 * each 2.5m span. Six smaller walkable steps per span make a practical route.
 * The original source stair and vault meshes are never removed.
 */
export function createSuigenMountainWayfinding({worldRoot,terrainRoot}={}){
  if(!worldRoot)throw Error('Suigen mountain trails need a world root');
  const root=new THREE.Group();root.name='Suigen_Abyss_Stairs_And_Quest_Wayfinding';
  worldRoot.add(root);
  const stone=new THREE.MeshStandardMaterial({color:0x6e7880,roughness:.93,flatShading:false});
  const rockDark=new THREE.MeshStandardMaterial({color:0x485965,roughness:.96});
  const moss=new THREE.MeshStandardMaterial({color:0x466b4f,roughness:.95});
  const bark=new THREE.MeshStandardMaterial({color:0x66533f,roughness:.91});
  const leaf=new THREE.MeshStandardMaterial({color:0x426f5c,roughness:.86,side:THREE.DoubleSide});
  const glyph=new THREE.MeshStandardMaterial({color:0x8fcee1,emissive:0x58a1d0,emissiveIntensity:1.1,metalness:.2,roughness:.32});
  const postMat=new THREE.MeshStandardMaterial({color:0x9c7650,roughness:.77});
  const colliders=[],treads=[],stones=[],trunks=[],crowns=[];
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
  const terrain=[];
  (terrainRoot||worldRoot).traverse(node=>{if(node.isMesh&&node.name==='Map_Terrain_2400m')terrain.push(node);});
  terrainRoot?.updateMatrixWorld(true);
  const ground=(x,z)=>{
    ray.set(new THREE.Vector3(x,1500,z),down);
    const hit=ray.intersectObjects(terrain,false)[0];
    return hit?.point.y??null;
  };
  const addCollider=(x,y,z,w,d)=>{
    const mesh=floorShape.clone();
    mesh.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),
      new THREE.Quaternion(),new THREE.Vector3(w,1,d)));
    colliders.push(mesh);
  };
  // Original stairs are 26 large sections from local z=420 down to z=357.5.
  // Preserve the geological descent and break each historical riser into
  // individually walkable rock steps with original local-world coordinates.
  const stairCount=26*6,initialZ=420,finalZ=357.5;
  const firstY=3.5,lastY=-23.423076923;
  for(let i=0;i<=stairCount;i++){
    const t=i/stairCount;
    const z=initialZ+(finalZ-initialZ)*t;
    const y=firstY+(lastY-firstY)*t;
    const x=-440+.13*Math.sin(t*9*Math.PI);
    const width=3.35+.25*Math.sin(i*1.81);
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,.27,.43),i%7===0?rockDark:stone);
    mesh.position.set(x,y-.06,z);mesh.rotation.y=.025*Math.sin(i*.6);
    mesh.receiveShadow=true;mesh.castShadow=i%5===0;
    root.add(mesh);treads.push(mesh);
    addCollider(x,y+.085,z,width,.48);
    if(i%5===0)for(const side of [-1,1]){
      const rock=new THREE.Mesh(boulderShape,side<0?stone:rockDark);
      rock.position.set(x+side*(2.8+.4*Math.sin(i)),y-.13,z);
      rock.scale.set(.75+(i%4)*.15,.5+.16*(i%3),.8);
      rock.rotation.set(.08*i,.13*i,.04*i);
      rock.castShadow=true;rock.receiveShadow=true;root.add(rock);stones.push(rock);
    }
  }
  // The descent approaches a preserved deep vault at x=-440,z=328.
  // Add a continuous stone bridge/tunnel-floor extension at the same depth.
  for(let j=0;j<44;j++){
    const z=357.1-j*.67;
    const y=lastY+Math.min(0,-.036*j);
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(3.7,.32,.7),stone);
    mesh.position.set(-440,y-.18,z);mesh.receiveShadow=true;root.add(mesh);treads.push(mesh);
    addCollider(-440,y,z,3.7,.7);
  }
  // Alpine rock clusters and modest native-material trees. Geometry is shared
  // across all copies and can be upgraded with licensed/owner GLB tree assets.
  const scenic=[
    [-320,290],[-348,330],[-386,362],[-409,407],
    [-470,409],[-489,365],[-489,313],[-470,278],
    [230,350],[240,385],[253,408],[186,417],[172,365],
  ];
  for(let k=0;k<scenic.length;k++){
    const [x,z]=scenic[k],base=ground(x,z);
    if(base===null)continue;
    const trunk=new THREE.Mesh(trunkShape,bark);
    const tall=4.9+(k%4)*1.8;
    trunk.scale.set(1,tall,1);
    trunk.position.set(x,base+tall/2,z);
    trunk.castShadow=true;root.add(trunk);trunks.push(trunk);
    for(let c=0;c<3;c++){
      const crown=new THREE.Mesh(crownShape,leaf);
      const diameter=2.35+(k%4)*.4;
      crown.scale.set(diameter,1.9+(c%2)*.4,diameter*.88);
      crown.position.set(x+.25*Math.sin(k+c),base+tall*.75+c*1.03,z);
      crown.castShadow=false;root.add(crown);crowns.push(crown);
    }
    for(let r=0;r<4;r++){
      const rock=new THREE.Mesh(boulderShape,r%2?rockDark:stone);
      const a=r*Math.PI/2+k*.31,dist=3.8+r*.7;
      rock.position.set(x+Math.sin(a)*dist,base+.05,z+Math.cos(a)*dist);
      rock.scale.set(.9+(r%3)*.3,.5+(r%2)*.3,1.1);
      root.add(rock);stones.push(rock);
    }
  }
  // Travel markers are genuine world objects, not fake disconnected map pins.
  const portalMeshes=[];
  for(const portal of SUIGEN_CAVE_PORTALS){
    const y=ground(portal.x,portal.z)??0;
    const group=new THREE.Group();
    group.position.set(portal.x,y,portal.z);
    group.name='Suigen_Portal_'+portal.id;
    for(const side of [-1,1]){
      const pillar=new THREE.Mesh(new THREE.BoxGeometry(.63,4.7,.68),stone);
      pillar.position.set(side*2.4,2.35,.3);pillar.castShadow=true;group.add(pillar);
    }
    const lintel=new THREE.Mesh(new THREE.BoxGeometry(5.6,.75,1.2),rockDark);
    lintel.position.set(0,4.87,.3);group.add(lintel);
    const lens=new THREE.Mesh(new THREE.CircleGeometry(1.95,48),
      new THREE.MeshStandardMaterial({color:0x2d83c2,emissive:0x348ad1,
        emissiveIntensity:.84,transparent:true,opacity:.47,
        side:THREE.DoubleSide,depthWrite:false}));
    lens.position.set(0,2.62,.18);group.add(lens);
    const key=new THREE.Mesh(new THREE.OctahedronGeometry(.45,0),glyph);
    key.position.set(0,4.86,.95);group.add(key);
    group.userData.destination=portal.target;
    group.userData.returnToGate=portal.returnToGate;
    root.add(group);portalMeshes.push({group,lens,key,portal});
  }
  const floorGeo=colliders.length?mergeGeometries(colliders,false):null;
  colliders.forEach(c=>c.dispose());
  const walkables=[];
  if(floorGeo){
    const mesh=new THREE.Mesh(floorGeo,new THREE.MeshBasicMaterial({visible:false,side:THREE.DoubleSide}));
    mesh.name='Suigen_Abyss_Fine_Stone_Tread_Collision';
    root.add(mesh);walkables.push(mesh);
  }
  let time=0,disposed=false;
  return {
    root,walkables,
    questPOIs:SUIGEN_QUEST_POIS,
    nearestInteraction(position,maxRadius=3.5){
      if(!position)return null;
      const hit=SUIGEN_CAVE_PORTALS.find(p=>
        Math.hypot(position.x-p.x,position.z-p.z)<=maxRadius);
      return hit?{kind:'portal',label:'Enter '+hit.name,portal:hit}:null;
    },
    interact(position){
      const hit=this.nearestInteraction(position);
      return hit?{target:hit.portal.target,sourcePortal:'suigen',
        returnToGate:hit.portal.returnToGate}:null;
    },
    update(dt){
      time+=Math.max(0,Math.min(.1,Number(dt)||0));
      for(const {lens,key} of portalMeshes){
        lens.material.opacity=.36+.1*Math.sin(time*2.4);
        key.rotation.y+=dt*.7;
      }
    },
    dispose(){
      if(disposed)return;disposed=true;
      root.parent?.remove(root);
      for(const mesh of treads)mesh.geometry.dispose();
      for(const {lens} of portalMeshes){
        lens.geometry.dispose();lens.material.dispose();
      }
      for(const {group} of portalMeshes)group.traverse(node=>{
        if(node.isMesh && node!==group.children[2])node.geometry.dispose();
      });
      floorGeo?.dispose();
      [stone,rockDark,moss,bark,leaf,glyph,postMat].forEach(m=>m.dispose());
      root.clear();
    },
  };
}
