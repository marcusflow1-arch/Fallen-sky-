// Runtime cleanup for the assembled CLONE town's knee-height step/riser remnants.
// The surrounding square, centre tree/planter and walkable top faces survive.
// Cut render triangles BEFORE the imported town's physics/collision is baked.
import {WOLFVEIL_IMPORTED_TOWN,WOLFVEIL_IMPORTED_TOWN_FLOOR_Y,
  WOLFVEIL_IMPORTED_TOWN_TREE} from './WolfveilImportedTownLayout.mjs';

export const TOWN_CENTER_RISER_SCOPE=Object.freeze({
  halfWidth:25,frontOffset:31,backOffset:4,
  minRaisedAboveFloor:.28,minVerticalAboveFloor:.22,
  minHorizontal:.82,treeClearanceMeters:3.8,
  perimeterProtectionMeters:5,
});
const FLOOR_MESH=/^(?:Tile_[\w.-]+|(?:Expansion_)?(?:paving|grass)|stone)$/i;
const WATER_OR_FEATURE=/water|river|canal|pond|gate|planter|tree|trunk|root|border|perimeter/i;
const point=(attr,i,m)=>{
  const x=attr.getX(i),y=attr.getY(i),z=attr.getZ(i);
  if(!m?.elements)return{x,y,z};
  const e=m.elements;
  const w=e[3]*x+e[7]*y+e[11]*z+e[15]||1;
  return{
    x:(e[0]*x+e[4]*y+e[8]*z+e[12])/w,
    y:(e[1]*x+e[5]*y+e[9]*z+e[13])/w,
    z:(e[2]*x+e[6]*y+e[10]*z+e[14])/w,
  };
};
function flatness(a,b,c){
  const ax=b.x-a.x,ay=b.y-a.y,az=b.z-a.z;
  const bx=c.x-a.x,by=c.y-a.y,bz=c.z-a.z;
  const nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;
  const len=Math.hypot(nx,ny,nz);
  return len>1e-9?Math.abs(ny)/len:0;
}
export function clearWolfveilTownCenterRisers(townRoot,{
  floorY=WOLFVEIL_IMPORTED_TOWN_FLOOR_Y+WOLFVEIL_IMPORTED_TOWN.floorLiftMeters,
  scope=TOWN_CENTER_RISER_SCOPE,
}={}){
  const report={removedFaces:0,changedMeshes:0,protectedFloorFaces:0,
    protectedTreeFaces:0,protectedPerimeterFaces:0,inspectedFaces:0};
  if(!townRoot?.traverse)return report;
  townRoot.updateMatrixWorld?.(true);
  const tree=WOLFVEIL_IMPORTED_TOWN_TREE;
  const centerZ=WOLFVEIL_IMPORTED_TOWN.z+70;
  const insideTown=(p)=>Math.abs(p.x-WOLFVEIL_IMPORTED_TOWN.x)<
    WOLFVEIL_IMPORTED_TOWN.width/2-scope.perimeterProtectionMeters &&
    Math.abs(p.z-centerZ)<
    WOLFVEIL_IMPORTED_TOWN.depth/2-scope.perimeterProtectionMeters;
  const approaches=(p)=>Math.abs(p.x-tree.x)<scope.halfWidth &&
    p.z>tree.z-scope.backOffset&&p.z<tree.z+scope.frontOffset;
  const inTreeRing=(p)=>Math.hypot(p.x-tree.x,p.z-tree.z)<scope.treeClearanceMeters;
  townRoot.traverse(node=>{
    if(!node?.isMesh||WATER_OR_FEATURE.test(node.name||'')||
      !FLOOR_MESH.test(node.name||''))return;
    const geometry=node.geometry,pos=geometry?.attributes?.position;
    if(!pos)return;
    const index=geometry.index;
    const count=index?.count??index?.array?.length??pos.count;
    const at=i=>index?(typeof index.getX==='function'?index.getX(i):index.array[i]):i;
    const groups=geometry.groups?.length?geometry.groups.map(g=>({...g}))
      :[{start:0,count,materialIndex:0}];
    const kept=[],newGroups=[];let changed=false;
    for(const group of groups){
      const start=kept.length;
      for(let i=group.start;i+2<Math.min(count,group.start+group.count);i+=3){
        const aIdx=at(i),bIdx=at(i+1),cIdx=at(i+2);
        if([aIdx,bIdx,cIdx].some(n=>!Number.isInteger(n)||n<0||n>=pos.count))continue;
        const a=point(pos,aIdx,node.matrixWorld);
        const b=point(pos,bIdx,node.matrixWorld);
        const c=point(pos,cIdx,node.matrixWorld);
        if(![a,b,c].every(p=>[p.x,p.y,p.z].every(Number.isFinite)))continue;
        report.inspectedFaces++;
        const points=[a,b,c];
        const nearTree=points.some(inTreeRing);
        const perimeter=points.some(p=>!insideTown(p));
        const nearApproach=points.every(approaches);
        const maxY=Math.max(a.y,b.y,c.y),minY=Math.min(a.y,b.y,c.y);
        const horizontal=flatness(a,b,c)>=scope.minHorizontal;
        const raisedTread=horizontal&&minY>floorY+scope.minRaisedAboveFloor;
        const raisedWall=!horizontal&&maxY>floorY+scope.minVerticalAboveFloor;
        const remove=nearApproach&&!perimeter&&!nearTree&&(raisedTread||raisedWall);
        if(remove){report.removedFaces++;changed=true;}
        else{
          kept.push(aIdx,bIdx,cIdx);
          if(nearTree)report.protectedTreeFaces++;
          else if(perimeter)report.protectedPerimeterFaces++;
          else if(horizontal&&maxY<=floorY+scope.minRaisedAboveFloor)report.protectedFloorFaces++;
        }
      }
      if(kept.length>start)newGroups.push({start,count:kept.length-start,
        materialIndex:group.materialIndex});
    }
    if(!changed)return;
    // The same indexed geometry is used by worldPositions + collision bake.
    geometry.setIndex(kept);
    geometry.clearGroups?.();
    for(const group of newGroups)
      geometry.addGroup?.(group.start,group.count,group.materialIndex);
    geometry.setDrawRange?.(0,kept.length);
    geometry.computeBoundingBox?.();geometry.computeBoundingSphere?.();
    node.userData??={};
    node.userData.cloneTownCenterRiserFacesRemoved=true;
    report.changedMeshes++;
  });
  townRoot.userData??={};
  townRoot.userData.cloneTownCenterRiserCleanup=report;
  return report;
}
