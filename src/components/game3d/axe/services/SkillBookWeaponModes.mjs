// Game 3D clone Skill Book: one real weapon and one 10-slot hotbar per role.
// The canonical game_weapon_skill_presets_v1 store still owns hotbar slots;
// the equipment inventory remains the only source of owned weapon instances.
export const SKILL_BOOK_WEAPON_MODES=Object.freeze([
  Object.freeze({id:'damage',label:'Damage',role:'offensive',presetIndex:0}),
  Object.freeze({id:'range',label:'Range',role:'ranged',presetIndex:1}),
  Object.freeze({id:'defense',label:'Defense',role:'defensive',presetIndex:2}),
]);
const normalize=v=>String(v||'').toLowerCase();
export function getWeaponRole(item){
  if(!item||!(item.category==='weapon'||item.slot==='weapon'))return null;
  const explicit=normalize(item.axeWeaponRole);
  if(explicit==='offensive'||explicit==='damage')return 'offensive';
  if(explicit==='ranged'||explicit==='range')return 'ranged';
  if(explicit==='defensive'||explicit==='defense')return 'defensive';
  const name=normalize([item.weaponFamily,item.masteryWeaponId,item.type,item.name].join(' '));
  if(/bow|crossbow|ranged|archery|rifle|staff/.test(name))return 'ranged';
  if(/guard|defend|shield|dagger|buckler/.test(name))return 'defensive';
  return 'offensive';
}
export function getWeaponForSkillBookMode(items,modeId,preferredInstanceId=null){
  const mode=SKILL_BOOK_WEAPON_MODES.find(entry=>entry.id===modeId);
  if(!mode)return null;
  const matching=(Array.isArray(items)?items:[]).filter(item=>
    getWeaponRole(item)===mode.role);
  return matching.find(item=>item.instanceId===preferredInstanceId)
    ||matching.find(item=>item.equipped)
    ||matching[0]||null;
}
export function getSkillBookWeaponArt(item){
  if(!item)return null;
  const art=item.imageUrl||item.iconUrl||item.image;
  return typeof art==='string'&&art.trim()?art:null;
}
export function getSkillBookModeForPreset(index){
  return SKILL_BOOK_WEAPON_MODES.find(mode=>mode.presetIndex===index)
    ||SKILL_BOOK_WEAPON_MODES[0];
}
