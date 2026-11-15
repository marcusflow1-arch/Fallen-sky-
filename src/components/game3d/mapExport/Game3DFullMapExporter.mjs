// Full GLB + pure-code map export for Game 3D clone; opt-in and client-only.
// The assembled Three.js scene is the source of truth; no fake terrain tiles.
// GLB does not serialize collision rules, gameplay, weather or custom shaders.
const MAGIC=0x46546c67,PART_BYTES=24576;
export function validateGame3DGLB(input){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
  if(bytes.byteLength<20)throw Error('GLB is too small');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(view.getUint32(0,true)!==MAGIC||view.getUint32(4,true)!==2||
     view.getUint32(8,true)!==bytes.byteLength)throw Error('Invalid glTF 2 GLB header/length');
  return bytes;
}
export function generateGame3DMapCode(input,{name='Game3D_Clone_Full_Map',region='wolfveil'}={}){
  const bytes=validateGame3DGLB(input),parts=[];
  for(let off=0;off<bytes.length;off+=PART_BYTES){
    const slice=bytes.subarray(off,off+PART_BYTES);
    let binary='';for(let i=0;i<slice.length;i++)binary+=String.fromCharCode(slice[i]);
    parts.push(btoa(binary));
  }
  return \`// Self-contained Game 3D clone map as pure JavaScript source.
export const MAP_NAME=\${JSON.stringify(name)};
export const MAP_REGION=\${JSON.stringify(region)};
const PARTS=\${JSON.stringify(parts)};
export function mapBytes(){
  const result=new Uint8Array(\${bytes.byteLength});let pos=0;
  for(const piece of PARTS){const raw=atob(piece);
    for(let i=0;i<raw.length;i++)result[pos++]=raw.charCodeAt(i);
  }
  if(pos!==result.byteLength)throw Error('Incomplete Game 3D map data');
  return result;
}
export function mapGLB(){return mapBytes().buffer;}
export async function loadMap(){
  const {GLTFLoader}=await import('three/examples/jsm/loaders/GLTFLoader.js');
  return (await new GLTFLoader().parseAsync(mapGLB(),'')).scene;
}
\`;
}
const visibleWithin=(node,scene)=>{
  for(let parent=node;parent&&parent!==scene;parent=parent.parent)
    if(!parent.visible)return false;
  return true;
};
function materialForExport(THREE,original,stats){
  const convert=m=>{
    if(!m)return new THREE.MeshStandardMaterial({color:0x777777});
    if(m.isShaderMaterial||m.isRawShaderMaterial){
      stats.shaderFallbacks++;
      const color=new THREE.Color(0x777777);
      const candidate=m.uniforms?.uColor?.value??m.uniforms?.diffuse?.value;
      if(candidate?.isColor)color.copy(candidate);
      else if(typeof candidate==='number')color.set(candidate);
      return new THREE.MeshStandardMaterial({color,side:m.side,roughness:1,
        transparent:!!m.transparent,opacity:Number.isFinite(m.opacity)?m.opacity:1});
    }
    return m;
  };
  return Array.isArray(original)?original.map(convert):convert(original);
}
export function snapshotGame3DMap(scene,THREE,{includeHidden=false,includeSkinned=false,
    exclude=()=>false}={}){
  if(!scene?.traverse||!scene?.updateMatrixWorld)throw TypeError('Live Three.js world is required');
  scene.updateMatrixWorld(true);
  const root=new THREE.Group();root.name='Game3D_Full_Map';
  const stats={meshes:0,instancedMeshes:0,instances:0,lines:0,points:0,
    skippedHidden:0,skippedSkinned:0,skippedExcluded:0,shaderFallbacks:0};
  scene.traverse(node=>{
    if(!node.geometry||!(node.isMesh||node.isLine||node.isPoints))return;
    if(!includeHidden&&!visibleWithin(node,scene)){stats.skippedHidden++;return;}
    if(!includeSkinned&&node.isSkinnedMesh){stats.skippedSkinned++;return;}
    if(exclude(node)){stats.skippedExcluded++;return;}
    const material=materialForExport(THREE,node.material,stats);
    let copy;
    if(node.isInstancedMesh){
      copy=new THREE.InstancedMesh(node.geometry,material,node.count);
      copy.instanceMatrix.copy(node.instanceMatrix);
      if(node.instanceColor)copy.instanceColor=node.instanceColor.clone();
      stats.instancedMeshes++;stats.instances+=node.count;
    }else if(node.isLineSegments){
      copy=new THREE.LineSegments(node.geometry,material);stats.lines++;
    }else if(node.isLineLoop){
      copy=new THREE.LineLoop(node.geometry,material);stats.lines++;
    }else if(node.isLine){
      copy=new THREE.Line(node.geometry,material);stats.lines++;
    }else if(node.isPoints){
      copy=new THREE.Points(node.geometry,material);stats.points++;
    }else{copy=new THREE.Mesh(node.geometry,material);stats.meshes++;}
    copy.name=node.name||'Map_Item_'+root.children.length;
    // Flatten to world coordinates while leaving the LIVE scene untouched.
    copy.matrix.copy(node.matrixWorld);
    copy.matrix.decompose(copy.position,copy.quaternion,copy.scale);
    copy.visible=true;copy.castShadow=node.castShadow;
    copy.receiveShadow=node.receiveShadow;root.add(copy);
  });
  if(!root.children.length)throw Error('No loaded map geometry available to export');
  return {root,stats};
}
function downloadFile(contents,type,filename){
  if(typeof document==='undefined')throw Error('File download requires a browser');
  const url=URL.createObjectURL(new Blob([contents],{type}));
  const link=document.createElement('a');link.href=url;link.download=filename;
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}
export async function exportGame3DFullMap({
  scene=typeof window!=='undefined'?window.__gw3dScene:null,
  region='wolfveil',name='Game3D_Clone_Full_'+region,download=true,
  includeHidden=false,includeSkinned=false,exclude,maxTextureSize=4096,
  beforeExport,
}={}){
  if(!scene)throw Error('Load the Game 3D clone map before exporting');
  if(beforeExport)await beforeExport();
  const THREE=await import('three');
  const {GLTFExporter}=await import('three/examples/jsm/exporters/GLTFExporter.js');
  const {root,stats}=snapshotGame3DMap(scene,THREE,{includeHidden,includeSkinned,exclude});
  const glb=await new GLTFExporter().parseAsync(root,{
    binary:true,onlyVisible:true,trs:true,maxTextureSize,includeCustomExtensions:true,
  });
  validateGame3DGLB(glb);
  const code=generateGame3DMapCode(glb,{name,region});
  if(download){
    const filename=String(name).replace(/[^a-z0-9._-]/gi,'_')||'Game3D_Map';
    downloadFile(glb,'model/gltf-binary',filename+'.glb');
    downloadFile(code,'text/javascript;charset=utf-8',filename+'.mjs');
  }
  return {glb,code,stats,region,name,bytes:glb.byteLength};
}
