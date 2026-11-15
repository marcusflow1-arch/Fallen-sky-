// Built-in layers that ship with the fused creator bodies: hair (skinned GLBs),
// tattoos (surface PNGs baked by tools/avatar-fuse/bake-tattoos.mjs) and armor
// pieces (skinned GLBs from tools/avatar-armor, one slot each). Their
// manifests are static files; each entry becomes a customization asset the
// AvatarCustomizationRuntime can bind, flagged builtin so saves can tell them
// apart from the server catalog.
import {useEffect,useState} from 'react';
import {FUSED_MANIFESTS,creatorBody} from './avatarCustomization';
import {isShippedArmorEntry} from '../game3d/armor/armorEquipCore.js';

const cache=new Map();
export function builtinAsset(entry) {
 return {
  id:String(entry.id),name:String(entry.label||entry.id),slot:entry.slot,gender:entry.gender,rig_id:entry.rig_id,
  binding:entry.binding||'skinned',file_url:entry.url,thumbnail_url:/^\/models\/[\w./-]+\.(?:jpg|png|webp)$/.test(entry.thumbnail||'')?entry.thumbnail:'',description:'',published:true,builtin:true,
  hide_meshes:entry.hide_meshes||[],tint_materials:entry.tint_materials||[],target_meshes:entry.target_meshes||[],target_materials:entry.target_materials||[],
  ...(entry.set?{set:String(entry.set)}:{}),...(entry.hides_hair?{hides_hair:true}:{}),
 };
}
// The creator's catalog remains DEV gated. One exception is rendering the
// already-equipped item from this character's canonical inventory: its GLB
// may be loaded for visual parity even in a preview built with NODE_ENV=production.
// This never grants, sells, drops or lists additional developer equipment.
// Cache the manifest payload, not a filtered snapshot from the first viewer.
const isShipped=entry=>isShippedArmorEntry(entry,import.meta.env?.DEV===true);
export function loadBuiltinLayers(kind,{equippedIds=[]}={}) {
 if(!cache.has(kind))cache.set(kind,fetch(FUSED_MANIFESTS[kind])
   .then(r=>{if(!r.ok)throw Error('manifest '+r.status);return r.json();})
   .catch(error=>{cache.delete(kind);throw error;}));
 const equipped=new Set(kind==='armor'?(equippedIds||[]):[]);
 return cache.get(kind).then(json=>{
  const visible=entry=>isShipped(entry)||
    (kind==='armor'&&entry.dev_only===true&&equipped.has(entry.id));
  return {
   female:(json.female||[]).filter(visible).map(builtinAsset),
   male:(json.male||[]).filter(visible).map(builtinAsset),
  };
 });
}
// Layers for the body in this appearance ({hair:[], tattoo:[], armor:[]}); empty for v5 bodies.
export function useBuiltinLayers(appearance) {
 const body=creatorBody(appearance);
 const [state,setState]=useState({hair:[],tattoo:[],armor:[],loading:false,error:''});
 useEffect(()=>{
  if(!body){setState({hair:[],tattoo:[],armor:[],loading:false,error:''});return undefined;}
  let alive=true;setState(s=>({...s,loading:true,error:''}));
  Promise.all(['hair','tattoo','armor'].map(kind=>loadBuiltinLayers(kind).catch(()=>({female:[],male:[]})))).then(([hair,tattoo,armor])=>{
   if(!alive)return;
   const own=list=>list[body.gender].filter(a=>a.rig_id===body.rig_id);
   setState({hair:own(hair),tattoo:own(tattoo),armor:own(armor),loading:false,error:''});
  });
  return()=>{alive=false;};
 },[body?.id]);
 return state;
}
