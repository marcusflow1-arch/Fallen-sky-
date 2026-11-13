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
  const eligible=eligibleRoleWeapons(items,role,resolver);
  const assigned=eligible.find(item=>item.instanceId===assignedId);
  const active=eligible.find(item=>item.instanceId===activeId);
  // An explicitly assigned weapon takes precedence; if none, the one already
  // in the player's hand is reflected. Auto-pick only if exactly one qualifies.
  return assigned||active||(eligible.length===1?eligible[0]:null);
}
export function roleForCycle(roles,current,direction){
  const index=roles.indexOf(current);
  return roles[(Math.max(0,index)+(direction<0?-1:1)+roles.length)%roles.length];
}
