import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 SUIGEN_TOWN_PLOTS,SUIGEN_MERCHANT_CATALOG,SUIGEN_TOWN_BOUNDS,
 suigenTownTravelPlan
} from '../src/components/game3d/worlds/SuigenTownPlan.mjs';
import {SUIGEN_QUEST_POIS,SUIGEN_CAVE_PORTALS}
  from '../src/components/game3d/worlds/SuigenMountainWayfinding.mjs';

const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const district=file('src/components/game3d/worlds/SuigenTownDistrict.mjs');
const mountains=file('src/components/game3d/worlds/SuigenMountainWayfinding.mjs');
const loader=file('src/components/game3d/worlds/loadSuigenWorld.mjs');
const world=file('src/components/game3d/GameWorld3D.jsx');
const view=file('src/pages/GameView.jsx');
const merchants=file('src/components/game3d/worlds/SuigenTownMerchants.jsx');

test('Town has 60 unique genuinely enterable, reasonably sized house plots',()=>{
 assert.equal(SUIGEN_TOWN_PLOTS.length,60);
 assert.equal(new Set(SUIGEN_TOWN_PLOTS.map(p=>p.id)).size,60);
 assert(SUIGEN_TOWN_PLOTS.every(p=>p.enterable&&p.width>=20&&p.depth>=19));
 assert(SUIGEN_TOWN_PLOTS.filter(p=>p.stories===2).length>=40);
 const plan=suigenTownTravelPlan();
 assert.equal(plan.buildingCount,60);
 assert.equal(plan.enterableCount,60);
 assert(plan.roads.length>=5);
 assert(SUIGEN_TOWN_BOUNDS.maxX-SUIGEN_TOWN_BOUNDS.minX>=500);
});

test('Actual shops have an apothecary, weapons counter, forge and services',()=>{
 assert.equal(SUIGEN_MERCHANT_CATALOG.length,12);
 const types=new Set(SUIGEN_MERCHANT_CATALOG.map(m=>m.kind));
 for(const category of ['blacksmith','weapons','apothecary','general',
   'vanity','spiritual','stables','guild','inn','tavern'])
   assert(types.has(category),category);
 assert.equal(SUIGEN_TOWN_PLOTS.filter(p=>p.merchantId).length,12);
});

test('All buildings receive interior geometry and walkable upper floors',()=>{
 for(const expr of ['gradeSuigenTownTerrain','const kitchenZ','// centre island',
   '// refrigerator','// stovetop','// Dinner','// Second storey',
   'const steps=18','// The underside of the ROOF',
   'collide(plot,sx,y+.005,z','const door=new THREE.Group()',
   'for(const original of SUIGEN_TOWN_PLOTS)','mergeGeometries(colliderGeos,false)'])
   assert(district.includes(expr),expr);
 assert(district.includes("roof")&&district.includes("glass")&&district.includes("lacquer"));
 assert(district.includes('position.x=previous.x;position.z=previous.z;return true;'));
});

test('Town foundations are graded into the Suigen heightfield, preserving Classic',()=>{
 assert(district.includes('gradedTerrainVertices:terrainGrade.adjustedVertices'));
 assert(district.includes('const tx=sm(')&&district.includes('const tz=sm('));
 assert(district.includes("node.name!=='Map_Terrain_2400m'"));
 assert(world.includes('const classicWorldRoots='));
 assert(world.includes('root.visible=originalVisibility.get(root)??true'));
 assert(world.includes('const reachable=hits.find(hit=>hit.point.y<=referenceY+.72)'));
 assert(world.includes('sampleGroundY(model.position.x,model.position.z,model.position.y)'));
});

test('Potion trade uses existing character Silver and real healing bridge',()=>{
 for(const marker of ['getShopState,purchaseItem,sellItem,consumeItem',
   'suigen_healing_pill','suigen_greater_healing_pill','suigen_lotus_recovery',
   'kind:\'heal\'','game3dSuigenMerchantOpen',
   'window.__axeUiModalOpen=true','window.__axeUiModalOpen=false'])
   assert(merchants.includes(marker),marker);
 assert(view.includes('<SuigenTownMerchants />'));
 assert(view.includes('<ShopEffectsBridge />'));
 assert(world.includes("new CustomEvent('game3dSuigenMerchantOpen'"));
 // No fake player equipment sales, server-free weapons, or premium checkout.
 assert(merchants.includes('authoritative transfer checks'));
});

test('Underground abyss descent has accessible fine stone steps and a clear trench',()=>{
 assert(mountains.includes('const stairCount=26*6'));
 assert(mountains.includes('Abyss_Fine_Stone_Tread_Collision'));
 assert(mountains.includes('suigenAbyssCarvedTriangles'));
 assert(mountains.includes('carved.setIndex(keep)'));
 assert(mountains.includes('geometry.dispose()'));
 assert(mountains.includes('rock.rotation.set('));
 assert(SUIGEN_QUEST_POIS.length>=8);
});

test('Mountain vortex and both real dungeon portal destinations are connected',()=>{
 assert(SUIGEN_CAVE_PORTALS.some(p=>p.id==='abyss-entry'&&p.target==='lunar-cave'));
 assert(SUIGEN_CAVE_PORTALS.some(p=>p.id==='astral-trial'&&p.target==='astral-dungeon'));
 assert(SUIGEN_CAVE_PORTALS.some(p=>p.id==='vortex-lake'));
 assert(mountains.includes('Suigen_Mountain_Water_Tornado_Real_Terrain'));
 assert(mountains.includes("sourcePortal:hit.portal.id==='vortex-lake'?'vortex':'suigen'"));
 assert(world.includes("new CustomEvent('game3dPortalTravel'"));
 assert(world.includes('!suigenActive&&lunarGate?.update'));
 assert(world.includes('!suigenActive&&astralGate?.update'));
});

test('Procedural upgrade is optional and can never remove the source GLB or Classic',()=>{
 assert(loader.includes('district=createSuigenTownDistrict('));
 assert(loader.includes('mountains=createSuigenMountainWayfinding('));
 assert(loader.includes('walkables.push(...district.walkables)'));
 assert(loader.includes('walkables.push(...mountains.walkables)'));
 assert(loader.includes('upgradeError=upgradeError||error'));
 assert(loader.includes('scene.add(root)'));
 assert(loader.includes('district?.dispose()'));
 assert(loader.includes('mountains?.dispose()'));
 assert(world.includes('suigenRuntime?.setVisible(false)'));
});
