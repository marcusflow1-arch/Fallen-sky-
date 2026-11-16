// Shared, non-authoritative world map data for the active Game 3D region.
// Coordinates come from the same scene/quest/enemy manifests as the gameplay.
// A reserve/portal defined in the future-world manifest is CHARTED only,
// not a usable entry point while its runtime mount is paused.
import { QUESTS, QUEST_NPCS } from '../questData';
import { WOLFVEIL_TOWN_QUEST_NPC_SPOTS } from '../wolfveil/WolfveilImportedTownLayout.mjs';
import { AXE_QUESTS } from '../axe/quests/AXEQuestFramework';
import { ENEMY_ZONES } from '../enemySpawnConfig';
import { AXE_FIRST_REGION } from '../axe/world/AXEFirstRegionLayout';
import { createAXEInitialWorldManifest } from '../axe/world/AXEWorldStreamingSystem';
import { getAXEQuestObjectives } from '../axe/quests/AXEQuestFramework';
import { LUNAR_CAVE_CHAMBERS, LUNAR_CAVE_WATER_END } from '../dungeons/LunarCaveLayout.mjs';
import { ASTRAL_PADS,ASTRAL_RETURN_PORTAL,ASTRAL_DUNGEON_TITLE } from '../dungeons/AstralDungeonLayout.mjs';
import {WOLFVEIL_CAVE_APPROACHES} from '../wolfveil/WolfveilCaveAccessPlan.mjs';

const FUTURE_WORLD = createAXEInitialWorldManifest();
const normalize = value => String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
const isForest = region => region === 'forest';
export const MAP_SCALE = Object.freeze({
  forest: Object.freeze({ name: 'First Territory', minX: -1200, maxX: 1200, minZ: -1200, maxZ: 1200 }),
  wolfveil: Object.freeze({ name: 'Wolfveil Valley · Cave Approaches', minX: -550, maxX: 550, minZ: -480, maxZ: 620 }),
  'lunar-cave': Object.freeze({ name: 'Lunar Cave Dungeon', minX: -390, maxX: 390, minZ: -40, maxZ: 740 }),
  'astral-dungeon': Object.freeze({ name: ASTRAL_DUNGEON_TITLE, minX: -200, maxX: 200, minZ: -60, maxZ: 340 }),
});
export function getMapScale(region) { return MAP_SCALE[region] || MAP_SCALE.wolfveil; }
export function projectMapPosition(region, x, z) {
  const m = getMapScale(region);
  return { x: (Number(x) - m.minX) / (m.maxX - m.minX) * 1000,
    y: (m.maxZ - Number(z)) / (m.maxZ - m.minZ) * 1000 };
}
export const mapDistance = (a,b) => Math.hypot((a?.x || 0)-(b?.x || 0),(a?.z || 0)-(b?.z || 0));
export const mapBearing = (origin,target) =>
  (Math.atan2((target?.x || 0)-(origin?.x || 0),(target?.z || 0)-(origin?.z || 0)) * 180/Math.PI + 360) % 360;

// All quest NPCs are loaded in GameWorld3D in both regions.
export function getMapMarkers(region) {
  if(region==='astral-dungeon')return [
    ...ASTRAL_PADS.map(p=>({id:'astral:'+p.id,name:p.name,type:'landmark',
      x:p.x,z:p.z,live:true,description:'High-level platform '+p.index+' · Lv '+p.level+'+'})),
    {id:'astral:return',name:'Return Portal',type:'portal',x:ASTRAL_RETURN_PORTAL.x,
      z:ASTRAL_RETURN_PORTAL.z,live:true,description:'Return to Wolfveil'},
  ];
  if(region==='lunar-cave')return [
    {id:'dungeon:entrance',name:'Dungeon entrance',type:'portal',x:0,z:-21,live:true,description:'Return to Wolfveil'},
    ...LUNAR_CAVE_CHAMBERS.map(c=>({
      id:'dungeon:'+c.id,name:c.name,type:'landmark',x:c.x,z:c.z,live:true,
      description:'Training chamber '+c.index+' · Level '+c.level+'+',
    })),
    {id:'dungeon:exit',name:'Dungeon return portal',type:'portal',x:LUNAR_CAVE_WATER_END.x,
      z:LUNAR_CAVE_WATER_END.returnPortalZ,live:true,description:'Return to Wolfveil'},
  ];
  // Wolfveil's quest givers stand at their own places around the town.
  const townSpots = region === 'wolfveil' ? WOLFVEIL_TOWN_QUEST_NPC_SPOTS : {};
  const markers = QUEST_NPCS.map(npc => ({
    id: 'npc:'+npc.id, name:npc.name, type:'npc',
    x:townSpots[npc.id]?.x ?? npc.pos[0], z:townSpots[npc.id]?.z ?? npc.pos[2], live:true,
    description:'Quest giver',
  }));
  // The four caves are actual walk-in Wolfveil destinations, not reserve
  // portal labels. Their center coords use the same +70m world-Z as Game 3D.
  if(region==='wolfveil'){
    for(const access of WOLFVEIL_CAVE_APPROACHES){
      markers.push({
        id:'cave:'+access.caveId,name:access.label,type:'cave',
        x:access.entrance.x,z:access.entrance.z+70,live:true,
        description:access.trailName+' · physical walk-in descent, connected underground',
      });
    }
  }
  if (!isForest(region)) return markers;
  for (const zone of ENEMY_ZONES) {
    markers.push({id:'mob:'+zone.id,name:zone.id.replace(/^axe_/,'').replaceAll('_',' '),
      type:'mob',x:zone.center[0],z:zone.center[2],radius:zone.radius,
      levelRange:zone.levels,tier:zone.fixedTier || 'mixed',live:true,
      description:'Enemy levels '+zone.levels.join('–') });
  }
  // Charted macro-world data is explicitly marked "reserve" while its
  // 3D streaming/interaction mounts are disabled in GameView.
  for (const poi of FUTURE_WORLD.pois) {
    markers.push({id:'poi:'+poi.id,name:poi.name,type:poi.kind==='CaveEntrance'?'cave':'landmark',
      x:poi.position[0],z:poi.position[2],live:false,
      description:'Charted reserve — not yet open for travel',
      sourceId:poi.id});
  }
  for (const point of FUTURE_WORLD.travelPoints) {
    markers.push({id:'travel:'+point.id,name:point.name,
      type:'portal',x:point.position[0],z:point.position[2],live:false,
      description:point.requiredItemId
        ? 'Charted portal — requires '+point.requiredItemId.replaceAll('_',' ')+' (not yet active)'
        : 'Charted travel point — not yet active'});
  }
  return markers;
}

export function getTrackedQuest(questState) {
  const questId = questState?.lastAcceptedId;
  return questId && questState.acceptedIds?.includes(questId)
    ? (QUESTS.find(q=>q.id===questId) || AXE_QUESTS.find(q=>q.id===questId) || null) : null;
}
function questReady(quest,state) {
  return getAXEQuestObjectives(quest).filter(o=>!o.optional).every((o,i)=>{
    const count=Math.max(1,Number(o.count)||1);
    const progress=state.objectiveProgress?.[quest.id]?.[o.id||'objective_'+i]
      ?? (i===0?state.progress?.[quest.id]:0);
    return Number(progress||0)>=count;
  });
}
export function getQuestNavigationTarget(region, questState, player={x:0,z:0}) {
  if(region==='lunar-cave'||region==='astral-dungeon')return null; // Instance maps do not show outside-world quest objectives.
  const quest=getTrackedQuest(questState);
  if(!quest) return null;
  const markers=getMapMarkers(region);
  const giver=markers.find(m=>m.id==='npc:'+quest.npcId);
  if(questReady(quest,questState)) return giver && {...giver,questId:quest.id,navLabel:'Turn in: '+quest.title};
  const objective=getAXEQuestObjectives(quest).find((o,i)=>{
    if(o.optional)return false;
    const progress=questState.objectiveProgress?.[quest.id]?.[o.id||'objective_'+i]
      ?? (i===0?questState.progress?.[quest.id]:0);
    return Number(progress||0)<Math.max(1,Number(o.count)||1);
  });
  if(!objective)return null;
  // Location objectives need an actual matching POI record. Do not point to
  // an NPC or a fabricated location when the objective target is unknown.
  const match=markers.find(m=>m.sourceId&&(
    normalize(m.sourceId)===normalize(objective.targetId) ||
    normalize(m.sourceId).endsWith(normalize(objective.targetId)?.replace(/^axe/,'')||'!')));
  if(['discover_location','interact','enter_cave','explore'].includes(objective.type))
    return match ? {...match,questId:quest.id,navLabel:quest.title} : null;
  if(objective.type==='talk')return giver ? {...giver,questId:quest.id,navLabel:quest.title} : null;
  if(['kill','kill_tier','defeat_boss'].includes(objective.type)) {
    const zones=markers.filter(m=>m.type==='mob' &&
      (!objective.tier ||
        (objective.tier==='normal' ? m.tier==='mixed' :
         objective.tier==='elite' ? m.tier==='elite' :
         objective.tier==='champion' ? (m.tier==='champion'||m.tier==='mixed') :
         objective.tier==='miniBoss' ? m.tier==='miniBoss' : m.tier===objective.tier)));
    const nearest=[...zones].sort((a,b)=>mapDistance(a,player)-mapDistance(b,player))[0];
    return nearest ? {...nearest,questId:quest.id,navLabel:quest.title} : null;
  }
  return null;
}
export function getMapZone(region,position) {
  if(region==='astral-dungeon'){
    const near=ASTRAL_PADS.find(p=>Math.hypot((position?.x||0)-p.x,(position?.z||0)-p.z)<32);
    return near?near.name:'Moonfall · Star Bridge';
  }
  if(region==='lunar-cave'){
    const nearby=LUNAR_CAVE_CHAMBERS.find(c=>Math.hypot((position?.x||0)-c.x,(position?.z||0)-c.z)<40);
    return nearby?nearby.name:'Lunar Cave · Stone Passage';
  }
  if(!isForest(region))return getMapScale(region).name;
  const found=AXE_FIRST_REGION.zones.filter(zone=>
    Math.hypot((position?.x||0)-zone.center[0],(position?.z||0)-zone.center[2])<=zone.radius)
    .sort((a,b)=>a.radius-b.radius)[0];
  return found?.name || getMapScale(region).name;
}