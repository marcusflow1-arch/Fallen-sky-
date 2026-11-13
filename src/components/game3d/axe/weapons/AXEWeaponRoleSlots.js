// Character-scoped HUD weapon-role assignments. Exactly ONE weapon is active
// at a time, using the existing inventory transaction and its level checks.
// This does not add three equipped weapons or duplicate their stat bonuses.
import { characterScopedStorage, subscribeCharacterChange } from '../../characterStorage';
import {
  getAXEInventoryItemsByCategory, getActiveEquippedAXEWeapon,
  switchAXEInventoryWeapon, subscribeAXEEquipmentInventory,
} from '../equipment/AXEEquipmentInventoryStore';
import { inferAXEWeaponRole } from './AXEWeaponIdentity';
import { AXE_HUD_WEAPON_ROLES, isAXEHUDWeaponRole, eligibleRoleWeapons, selectRoleWeapon } from './AXEWeaponRoleSlots.mjs';

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
  return eligibleRoleWeapons(getAXEInventoryItemsByCategory('weapon'),role,inferAXEWeaponRole);
}
export function getAXERoleWeapon(role){
  const inventory=getAXEInventoryItemsByCategory('weapon');
  return selectRoleWeapon(inventory,role,assignments[role],
    getActiveEquippedAXEWeapon()?.instanceId,inferAXEWeaponRole);
}
export function assignAXEHUDWeaponRole(role,instanceId){
  if(!isAXEHUDWeaponRole(role))return {ok:false,reason:'INVALID_ROLE'};
  if(instanceId!==null && !getOwnedWeaponsForAXERole(role).some(item=>item.instanceId===instanceId))
    return {ok:false,reason:'WEAPON_NOT_OWNED_OR_WRONG_ROLE'};
  const next={...assignments,[role]:instanceId};
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
