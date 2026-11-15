import * as THREE from 'three';

/**
 * O(1) authored-heightfield sampler, shared by town pads and mountain details.
 * The owner's Map_Terrain_2400m is 341 x 341 indexed regular-grid positions.
 * Running 700+ scene raycasts over 230k terrain triangles on map load would
 * block the Game 3D browser. Sample its existing vertex heights instead.
 */
export function createSuigenTerrainHeightSampler(root){
  let mesh=null;
  root?.traverse?.(node=>{
    if(!mesh&&node.isMesh&&node.name==='Map_Terrain_2400m')mesh=node;
  });
  if(!mesh)return ()=>null;
  const pos=mesh.geometry?.getAttribute?.('position');
  const side=Math.round(Math.sqrt(pos?.count||0));
  if(pos&&side>1&&side*side===pos.count){
    const xMin=pos.getX(0),xMax=pos.getX(side-1);
    const zMin=pos.getZ(0),zMax=pos.getZ((side-1)*side);
    const spanX=xMax-xMin,spanZ=zMax-zMin;
    if(spanX>1&&spanZ>1){
      const gx=(side-1)/spanX,gz=(side-1)/spanZ;
      return (x,z)=>{
        if(!Number.isFinite(x)||!Number.isFinite(z)||
          x<xMin||x>xMax||z<zMin||z>zMax)return null;
        const fx=(x-xMin)*gx,fz=(z-zMin)*gz;
        const i=Math.min(side-2,Math.max(0,Math.floor(fx)));
        const j=Math.min(side-2,Math.max(0,Math.floor(fz)));
        const tx=Math.max(0,Math.min(1,fx-i));
        const tz=Math.max(0,Math.min(1,fz-j));
        const a=pos.getY(j*side+i),b=pos.getY(j*side+i+1);
        const c=pos.getY((j+1)*side+i),d=pos.getY((j+1)*side+i+1);
        // The original rectangular triangulation remains available for
        // exact raycast/collision, but blended grade samples are stable
        // enough for sites, roads, trees and foundations.
        return (a*(1-tx)+b*tx)*(1-tz)+(c*(1-tx)+d*tx)*tz;
      };
    }
  }
  // Defensive fallback for a future irregular terrain asset.
  root.updateWorldMatrix?.(true,true);
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
  return (x,z)=>{
    ray.set(new THREE.Vector3(x,1500,z),down);
    return ray.intersectObject(mesh,false)[0]?.point.y??null;
  };
}
