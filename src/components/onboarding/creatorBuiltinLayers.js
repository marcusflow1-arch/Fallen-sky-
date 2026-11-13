// Built-in layers that ship with the fused creator bodies: hair (skinned GLBs) and
// tattoos (surface PNGs baked by tools/avatar-fuse/bake-tattoos.mjs). Their
// manifests are static files; each entry becomes a customization asset the
// AvatarCustomizationRuntime can bind, flagged builtin so saves can tell them
// apart from the server catalog.
import {useEffect,useState} from 'react';
import {FUSED_MANIFESTS,creatorBody} from './avatarCustomization';

const cache=new Map();
export function builtinAsset(entry) {
 return {
  id:String(entry.id),name:String(entry.label||entry.id),slot:entry.slot,gender:entry.gender,rig_id:entry.rig_id,
  binding:entry.binding||'skinned',file_url:entry.url,thumbnail_url:'',description:'',published:true,builtin:true,
  hide_meshes:entry.hide_meshes||[],tint_materials:entry.tint_materials||[],target_meshes:entry.target_meshes||[],target_materials:entry.target_materials||[],
 };
}
export function loadBuiltinLayers(kind) {
 if(!cache.has(kind))cache.set(kind,fetch(FUSED_MANIFESTS[kind]).then(r=>{if(!r.ok)throw Error('manifest '+r.status);return r.json();}).then(json=>({
  female:(json.female||[]).map(builtinAsset),male:(json.male||[]).map(builtinAsset),
 })).catch(error=>{cache.delete(kind);throw error;}));
 return cache.get(kind);
}
// Layers for the body in this appearance ({hair:[], tattoo:[]}); empty for v5 bodies.
export function useBuiltinLayers(appearance) {
 const body=creatorBody(appearance);
 const [state,setState]=useState({hair:[],tattoo:[],loading:false,error:''});
 useEffect(()=>{
  if(!body){setState({hair:[],tattoo:[],loading:false,error:''});return undefined;}
  let alive=true;setState(s=>({...s,loading:true,error:''}));
  Promise.all(['hair','tattoo'].map(kind=>loadBuiltinLayers(kind).catch(()=>({female:[],male:[]})))).then(([hair,tattoo])=>{
   if(!alive)return;
   const own=list=>list[body.gender].filter(a=>a.rig_id===body.rig_id);
   setState({hair:own(hair),tattoo:own(tattoo),loading:false,error:''});
  });
  return()=>{alive=false;};
 },[body?.id]);
 return state;
}
