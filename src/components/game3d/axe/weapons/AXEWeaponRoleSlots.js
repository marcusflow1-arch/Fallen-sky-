// Character-scoped HUD weapon-role assignments. Exactly ONE weapon is active
// at a time, using the existing inventory transaction and its level checks.
// This does not add three equipped weapons or duplicate their stat bonuses.
import { characterScopedStorage, subscribeCharacterChange } from '../../characterStorage';
import {
  getAXEInventoryItemsByCategory, getActiveEquippedAXEWeapon,
  switchAXEInventoryWeapon, subscribeAXEEquipmentInventory,
} from '../equipment/AXEEquipmentInventoryStore';
import { inferAXEWeaponRole } from './AXEWeaponIdentity';
import { AXE_HUD_WEAPON_ROLES, isAXEHUDWeaponRole, selectRoleWeapon } from './AXEWeaponRoleSlots.mjs';

const storage=characterScopedStorage('axe_hud_weapon_roles_v1');
const empty=()=>({offensive:null,defensive:null,ranged:null});
const listeners=new Set();
const read=()=>{
  try{
    const stored=JSON.parse(storage.get()||'{}');
    return Object.fromEntries(AXE_HUD_WEAPON_ROLES.map(({role})=>[
      role,typeof stored[role]==='string'?stored[role]:null,
    ]));
  }catch{return empty();}
};
let assignments=read();
const emit=()=>{const state=getAXEHUDWeaponRoles();listeners.forEach(fn=>fn(state));};
subscribeCharacterChange(()=>{assignments=read();emit();});
subscribeAXEEquipmentInventory(()=>emit());

export function getAXEHUDWeaponRoles(){
  return {...assignments};
}
export function subscribeAXEHUDWeaponRoles(fn){
  listeners.add(fn);fn(getAXEHUDWeaponRoles());return ()=>listeners.delete(fn);
}
export function getOwnedWeaponsForAXERole(role){
  if(!isAXEHUDWeaponRole(role))return [];
  // Any genuinely owned weapon may be assigned to any one of the three
  // visible socket templates. Role identity is a helpful DEFAULT, not a ban.
  return getAXEInventoryItemsByCategory('weapon')
    .filter(item=>item?.slot==='weapon' && !!item.instanceId);
}
export function getAXERoleWeapon(role){
  // An item assigned to another panel must not reappear as a default
  // fallback in this one. This keeps all three visual sockets independent.
  const reserved=new Set(Object.entries(assignments)
    .filter(([other])=>other!==role).map(([,id])=>id).filter(Boolean));
  const inventory=getAXEInventoryItemsByCategory('weapon')
    .filter(item=>!reserved.has(item.instanceId)||item.instanceId===assignments[role]);
  return selectRoleWeapon(inventory,role,assignments[role],
    getActiveEquippedAXEWeapon()?.instanceId,inferAXEWeaponRole);
}
export function assignAXEHUDWeaponRole(role,instanceId){
  if(!isAXEHUDWeaponRole(role))return {ok:false,reason:'INVALID_ROLE'};
  if(instanceId!==null && !getOwnedWeaponsForAXERole(role).some(item=>item.instanceId===instanceId))
    return {ok:false,reason:'WEAPON_NOT_OWNED_OR_WRONG_ROLE'};
  const next={...assignments,[role]:instanceId};
  // Moving a weapon to a new slot clears its previous visual assignment,
  // without unequipping or duplicating the underlying owned item.
  if(instanceId!==null)for(const other of AXE_HUD_WEAPON_ROLES){
    if(other.role!==role && next[other.role]===instanceId)next[other.role]=null;
  }
  if(!storage.setChecked(JSON.stringify(next)))return {ok:false,reason:'SAVE_FAILED'};
  assignments=next;emit();
  return {ok:true,role,instanceId};
}
export function drawAXEHUDWeaponRole(role,context={}){
  if(!isAXEHUDWeaponRole(role))return {ok:false,reason:'INVALID_ROLE'};
  const item=getAXERoleWeapon(role);
  if(!item)return {ok:false,reason:'EMPTY_ROLE',role};
  // Always go through checked inventory transaction. This updates combat
  // identity, animation equipment context, weapon mastery and active skills.
  return {...switchAXEInventoryWeapon(item.instanceId,context),role};
}
