// The three on-screen weapon roles are display identities, not three extra
// simultaneously-equipped weapons. Ownership and active equipment stay with
// AXEEquipmentInventoryStore (which validates level and persists atomically).
export const AXE_HUD_WEAPON_ROLES = Object.freeze([
  Object.freeze({ role:'offensive', label:'Damage', icon:'sword', key:'C · 1' }),
  Object.freeze({ role:'defensive', label:'Defense', icon:'shield', key:'C · 2' }),
  Object.freeze({ role:'ranged', label:'Ranged', icon:'crosshair', key:'C · 3' }),
]);
export const isAXEHUDWeaponRole = role => AXE_HUD_WEAPON_ROLES.some(row=>row.role===role);

export function eligibleRoleWeapons(items, role, resolver) {
  if(!isAXEHUDWeaponRole(role))return [];
  return (Array.isArray(items)?items:[]).filter(item=>
    item?.category==='weapon' && item.slot==='weapon' &&
    Boolean(item.instanceId) && resolver(item)===role
  );
}
export function selectRoleWeapon(items, role, assignedId, activeId, resolver) {
  if(!isAXEHUDWeaponRole(role))return null;
  const owned=(Array.isArray(items)?items:[]).filter(item=>
    item?.category==='weapon' && item.slot==='weapon' && Boolean(item.instanceId));
  // The three HUD panels are player-customizable sockets, not role-locked
  // weapons. A specifically assigned bow may be shown in the Damage panel.
  const assigned=owned.find(item=>item.instanceId===assignedId);
  if(assigned)return assigned;
  const eligible=eligibleRoleWeapons(owned,role,resolver);
  const active=eligible.find(item=>item.instanceId===activeId);
  // Only use a role-specific fallback if the player has not made a choice.
  return active||(eligible.length===1?eligible[0]:null);
}
export function roleForCycle(roles,current,direction){
  if(!Array.isArray(roles)||!roles.length)return null;
  const index=roles.indexOf(current);
  if(index<0)return direction<0?roles[roles.length-1]:roles[0];
  return roles[(index+(direction<0?-1:1)+roles.length)%roles.length];
}
