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
// Build code as separate UTF-8 fragments. Full 1100m worlds can produce
// massive GLBs; joining all base64 into one JS string exhausts memory.
export function game3DMapCodeParts(input,{name='Game3D_Clone_Full_Map',region='wolfveil'}={}){
  const bytes=validateGame3DGLB(input);
  const output=[`// Game 3D clone map - complete binary embedded as executable JavaScript.
export const MAP_NAME=${JSON.stringify(String(name))};
export const MAP_REGION=${JSON.stringify(String(region))};
const PARTS=[
`];
  for(let off=0;off<bytes.byteLength;off+=PART_BYTES){
    const slice=bytes.subarray(off,off+PART_BYTES);
    let binary='';for(let i=0;i<slice.length;i++)binary+=String.fromCharCode(slice[i]);
    output.push(JSON.stringify(btoa(binary)),',\n');
  }
  output.push(`];
export function mapBytes(){
  const result=new Uint8Array(${bytes.byteLength});let pos=0;
  for(const part of PARTS){const raw=atob(part);
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
`);
  return output;
}
export function generateGame3DMapCode(input,options={}){
  return game3DMapCodeParts(input,options).join('');
}
export function createGame3DMapCodeBlob(input,options={}){
  return new Blob(game3DMapCodeParts(input,options),{type:'text/javascript;charset=utf-8'});
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
    const materialHidden=Array.isArray(node.material)
      ?node.material.length>0&&node.material.every(m=>m?.visible===false)
      :node.material?.visible===false;
    if(!includeHidden&&(!visibleWithin(node,scene)||materialHidden)){
      stats.skippedHidden++;return;
    }
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
let currentMapDownloadDialog=null;
// Async GLTFExporter resolution no longer has a browser user-activation token.
// Never fire two synthetic anchor.click() calls: Chromium/Safari often suppress
// one or both. These links are real, user-initiated individual downloads.
export function showGame3DMapDownloads({glb,codeBlob,name,stats}){
  if(typeof document==='undefined'||typeof URL.createObjectURL!=='function')
    throw Error('Download links require a browser');
  // Repeated exports must revoke the previous world's potentially huge blobs.
  currentMapDownloadDialog?.close?.();
  document.getElementById('game3d-map-export-downloads')?.remove();
  const safeName=String(name).replace(/[^a-z0-9._-]/gi,'_')||'Game3D_Map';
  const glbURL=URL.createObjectURL(new Blob([glb],{type:'model/gltf-binary'}));
  const codeURL=URL.createObjectURL(codeBlob);
  const panel=document.createElement('div');
  panel.id='game3d-map-export-downloads';
  panel.setAttribute('role','dialog');
  panel.setAttribute('aria-label','Game 3D full map download');
  panel.style.cssText='position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:rgba(0,0,0,.7);font:14px system-ui,sans-serif;color:#fff';
  const content=document.createElement('div');
  content.style.cssText='width:min(480px,92vw);max-height:80vh;overflow:auto;padding:24px;border:1px solid #7bdde8;border-radius:16px;background:#101c29;box-shadow:0 20px 60px #000a';
  const heading=document.createElement('h2');heading.textContent='Game 3D map export ready';
  heading.style.cssText='font-size:18px;font-weight:700;margin:0 0 10px';
  const description=document.createElement('p');
  description.textContent='Choose each file separately. Browsers often block two simultaneous automatic downloads. No map geometry has been cropped to your camera view.';
  description.style.cssText='line-height:1.5;margin:0 0 12px;color:#d8e7f4';
  const details=document.createElement('p');
  details.textContent='GLB '+(glb.byteLength/1048576).toFixed(1)+' MB · Source '+(codeBlob.size/1048576).toFixed(1)+' MB · '+(stats.meshes+stats.instancedMeshes)+' mesh groups';
  details.style.cssText='font-size:12px;color:#9ab9ca';
  const links=document.createElement('div');links.style.cssText='display:flex;flex-wrap:wrap;gap:10px;margin-top:18px';
  const makeLink=(url,filename,label)=>{
    const link=document.createElement('a');link.href=url;link.download=filename;
    link.textContent=label;link.style.cssText='display:inline-block;padding:10px 14px;border-radius:10px;color:#081321;background:#94e8ef;font-weight:700;text-decoration:none';
    return link;
  };
  links.append(makeLink(glbURL,safeName+'.glb','Download full GLB'),
    makeLink(codeURL,safeName+'.mjs','Download pure code'));
  const close=document.createElement('button');close.textContent='Close';
  close.style.cssText='margin-top:18px;padding:8px 12px;border:1px solid #7293a4;border-radius:8px;color:#fff;background:transparent;cursor:pointer';
  let disposed=false;
  const teardown=()=>{
    if(disposed)return;disposed=true;panel.remove();
    URL.revokeObjectURL(glbURL);URL.revokeObjectURL(codeURL);
    if(currentMapDownloadDialog?.close===teardown)currentMapDownloadDialog=null;
  };
  close.addEventListener('click',teardown);
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();teardown();}});
  panel.addEventListener('pointerdown',e=>e.stopPropagation());
  panel.addEventListener('click',e=>e.stopPropagation());
  content.append(heading,description,details,links,close);
  panel.append(content);document.body.appendChild(panel);
  close.focus();
  currentMapDownloadDialog={close:teardown,glbURL,codeURL};
  return currentMapDownloadDialog;
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
  const codeBlob=createGame3DMapCodeBlob(glb,{name,region});
  const downloads=download?showGame3DMapDownloads({glb,codeBlob,name,stats}):null;
  return {glb,codeBlob,downloads,stats,region,name,bytes:glb.byteLength};
}
