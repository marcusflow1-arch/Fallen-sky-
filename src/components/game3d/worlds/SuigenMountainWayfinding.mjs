import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {createSuigenTerrainHeightSampler} from './SuigenTerrainHeight.mjs';

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
  {id:'vortex-lake',name:'Water Tornado Gateway',
    x:205,z:390,target:'lunar-cave',returnToGate:true},
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
  const bark=new THREE.MeshStandardMaterial({color:0x66533f,roughness:.91});
  const leaf=new THREE.MeshStandardMaterial({color:0x426f5c,roughness:.86,side:THREE.DoubleSide});
  const glyph=new THREE.MeshStandardMaterial({color:0x8fcee1,emissive:0x58a1d0,emissiveIntensity:1.1,metalness:.2,roughness:.32});
  const colliders=[],treads=[],stones=[],trunks=[],crowns=[];
  const ground=createSuigenTerrainHeightSampler(terrainRoot||worldRoot);
  const terrain=[];
  (terrainRoot||worldRoot).traverse(node=>{if(node.isMesh&&node.name==='Map_Terrain_2400m')terrain.push(node);});
  terrainRoot?.updateMatrixWorld(true);
  // The owner's historic 26 steps disappear beneath an intact imported
  // terrain surface (at z≈328 the uncut ground is ~34m ABOVE the -25m vault).
  // Carve only this narrow canyon corridor in the clone's loaded copy of the
  // 2400m mesh. The source GLB and Classic world remain immutable.
  let carvedTriangles=0;
  for(const mesh of terrain){
    const geometry=mesh.geometry;
    const position=geometry?.getAttribute?.('position');
    const indices=geometry?.index;
    if(!position||!indices)continue;
    const keep=[];
    const inside=(v)=>{
      const x=position.getX(v),z=position.getZ(v);
      return Math.abs(x+440)<12.5&&z>=320&&z<=427;
    };
    for(let i=0;i<indices.count;i+=3){
      const a=indices.getX(i),b=indices.getX(i+1),c=indices.getX(i+2);
      // Remove full crossing triangles, not a tiny hole between vertices.
      if(inside(a)||inside(b)||inside(c)){carvedTriangles++;continue;}
      keep.push(a,b,c);
    }
    if(carvedTriangles){
      const carved=geometry.clone();
      carved.setIndex(keep);
      mesh.geometry=carved;
      geometry.dispose();
      mesh.userData.suigenAbyssCarvedTriangles=carvedTriangles;
    }
  }
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
  // Reinforce both trench walls with believable rocky terraces. The corridor
  // center remains clear so stairs, mounts on permitted routes, and the camera
  // have a reliable walkable passage to the underground vault.
  for(let bank=0;bank<2;bank++){
    const side=bank?1:-1;
    for(let n=0;n<35;n++){
      const z=424-n*2.9,fall=(420-z)/(420-357.5);
      const stepY=3.5-26.923*Math.max(0,Math.min(1,fall));
      const rock=new THREE.Mesh(boulderShape,n%4?rockDark:stone);
      rock.position.set(-440+side*(6.4+(n%4)*.9),
        stepY+1.25+(n%5)*.38,z);
      rock.scale.set(2.1+(n%3)*.43,2.7+(n%4)*.34,2.45);
      rock.rotation.set(.02*n,.13*n,.04*n);
      root.add(rock);stones.push(rock);
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
  // A lake-sized liquid-glass funnel, rooted in the ORIGINAL Suigen mountain
  // terrain rather than Classic Wolfveil's incompatible 82.6m elevation.
  const waterOrigin={x:205,z:390,y:(ground(205,390)??26)+.20};
  // Real lake basin, not a disc hovering over unaltered mountain dirt.
  // The wet inner 24m slopes ~3m below the surface; the 9m bank fades
  // smoothly back to the existing terrain. This copy is hidden in Classic.
  let lakeGradeVertices=0;
  for(const mesh of terrain){
    const geometry=mesh.geometry;
    const position=geometry?.getAttribute?.('position');
    if(!position)continue;
    const graded=geometry.clone(),attr=graded.getAttribute('position');
    for(let k=0;k<attr.count;k++){
      const x=attr.getX(k),z=attr.getZ(k);
      const radial=Math.hypot(x-waterOrigin.x,z-waterOrigin.z);
      if(radial>=34)continue;
      const t=Math.min(1,Math.max(0,(radial-24)/10));
      const blend=t*t*(3-2*t);
      const depth=2.8+(1-Math.min(1,radial/24))*.9;
      const desired=waterOrigin.y-depth;
      const oldY=attr.getY(k);
      const nextY=oldY*blend+Math.min(oldY,desired)*(1-blend);
      if(Math.abs(nextY-oldY)>.001){
        attr.setY(k,nextY);lakeGradeVertices++;
      }
    }
    if(lakeGradeVertices){
      attr.needsUpdate=true;graded.computeVertexNormals();
      graded.computeBoundingBox();graded.computeBoundingSphere();
      mesh.geometry=graded;geometry.dispose();
    }else graded.dispose();
  }
  const waterRoot=new THREE.Group();
  waterRoot.name='Suigen_Mountain_Water_Tornado_Real_Terrain';
  waterRoot.position.set(waterOrigin.x,waterOrigin.y,waterOrigin.z);
  root.add(waterRoot);
  const waterMaterial=new THREE.MeshPhysicalMaterial({
    color:0x156c9b,metalness:.12,roughness:.21,transparent:true,opacity:.78,
    clearcoat:.8,clearcoatRoughness:.15,side:THREE.DoubleSide,depthWrite:false,
  });
  const surface=new THREE.Mesh(new THREE.CircleGeometry(28,96),waterMaterial);
  surface.rotation.x=-Math.PI/2;
  surface.position.y=.08;surface.name='Suigen_Vortex_Water_Surface';
  waterRoot.add(surface);
  const vortexEnergy=new THREE.Group();vortexEnergy.name='Suigen_Liquid_Glass_Vortex_Spirals';
  waterRoot.add(vortexEnergy);
  const vortexMats=[
    new THREE.MeshBasicMaterial({color:0x5bc8e9,transparent:true,opacity:.63,depthWrite:false}),
    new THREE.MeshBasicMaterial({color:0x8399ed,transparent:true,opacity:.52,depthWrite:false}),
  ];
  for(let v=0;v<12;v++){
    const pts=[],phase=v*Math.PI*2/12;
    for(let i=0;i<=70;i++){
      const t=i/70,a=phase+t*Math.PI*4.5,r=18*(1-t)+1.6;
      pts.push(new THREE.Vector3(Math.cos(a)*r,1.1+t*20,Math.sin(a)*r));
    }
    const geom=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),105,.095,5,false);
    const spiral=new THREE.Mesh(geom,vortexMats[v%2]);
    vortexEnergy.add(spiral);
  }
  const currentRing=new THREE.Mesh(new THREE.TorusGeometry(23,.24,8,100),
    vortexMats[0]);
  currentRing.rotation.x=Math.PI/2;currentRing.position.y=.25;
  vortexEnergy.add(currentRing);
  // Water edge rocks visually ground the vortex in the mountain basin.
  for(let i=0;i<24;i++){
    const a=i*Math.PI*2/24,r=27.2+(i%3)*.65;
    const x=waterOrigin.x+Math.cos(a)*r,z=waterOrigin.z+Math.sin(a)*r;
    const y=ground(x,z)??waterOrigin.y;
    const edge=new THREE.Mesh(boulderShape,i%3?stone:rockDark);
    edge.position.set(x,y+.35,z);edge.scale.set(2.7,1.25,1.5);
    edge.rotation.y=a;root.add(edge);stones.push(edge);
  }

  const portalMeshes=[];
  for(const portal of SUIGEN_CAVE_PORTALS){
    if(portal.id==='vortex-lake')continue;
    // The owner-authored first Abyss stair is at Y=3.5. The new canyon
    // removes the old ground above it, so sampleGround could fall through.
    const y=portal.id==='abyss-entry'?3.5:(ground(portal.x,portal.z)??0);
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
  root.userData.suigenAbyssCarvedTriangles=carvedTriangles;
  root.userData.suigenVortexLakeGradedVertices=lakeGradeVertices;
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
      return hit?{target:hit.portal.target,
        sourcePortal:hit.portal.id==='vortex-lake'?'vortex':'suigen',
        returnToGate:hit.portal.returnToGate}:null;
    },
    update(dt){
      time+=Math.max(0,Math.min(.1,Number(dt)||0));
      for(const {lens,key} of portalMeshes){
        lens.material.opacity=.36+.1*Math.sin(time*2.4);
        key.rotation.y+=dt*.7;
      }
      vortexEnergy.rotation.y=time*.33;
      surface.rotation.z=time*.015;
    },
    dispose(){
      if(disposed)return;disposed=true;
      root.parent?.remove(root);
      for(const mesh of treads)mesh.geometry.dispose();
      surface.geometry.dispose();waterMaterial.dispose();
      vortexEnergy.traverse(node=>{if(node.isMesh)node.geometry.dispose();});
      vortexMats.forEach(m=>m.dispose());
      for(const {lens} of portalMeshes){
        lens.geometry.dispose();lens.material.dispose();
      }
      const portalGeometries=new Set();
      for(const {group} of portalMeshes)group.traverse(node=>{
        if(node.isMesh && node.geometry)portalGeometries.add(node.geometry);
      });
      for(const geometry of portalGeometries)geometry.dispose();
      floorGeo?.dispose();
      [stone,rockDark,bark,leaf,glyph].forEach(m=>m.dispose());
      root.clear();
    },
  };
}
