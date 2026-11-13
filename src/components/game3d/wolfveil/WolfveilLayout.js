import {gradeWolfveilImportedTown} from './WolfveilImportedTownLayout.mjs';
import {gradeWolfveilPalaceTerrain,gradeWolfveilPalaceRearMountain,WOLFVEIL_PALACE_REAR_MOUNTAIN} from './WolfveilPalaceGround.mjs';
import {gradeWolfveilRiverbank} from './WolfveilRiverBanks.mjs';
import {createWolfveilBridgeBankTerrainGrade} from './WolfveilBridgeBankTerrain.mjs';
import {gradeWolfveilWestHillside} from './WolfveilWestHillside.mjs';
// Shadow Wolf Homeland — Wolfveil Valley master blockout.
//
// Reference: docs/game3d/WOLFVEIL_REFERENCE_PLAN.md, written from
// Shadow_Wolf_Village_Master_Prompt(1).md + 19 owner-supplied concept views.
// +Z is NORTH; +X is EAST; units are meters. This is NOT Game 2 and not
// a replacement for the Game 1 combat/server-authority systems.
export const WOLFVEIL_PALETTE=Object.freeze({
  ink:0x172735,indigo:0x344d78,roofLight:0x647eac,
  cedar:0x94603d,cedarLight:0xb78556,plaster:0xe6d7b5,
  basalt:0x59646c,granite:0xa1a49b,fern:0x3d7953,
  leaf:0x80ab56,moss:0xa5ad60,turquoise:0x55b9b2,
  deepWater:0x245f72,lantern:0xf3b465,spirit:0xa287e1,
  autumn:0xcf7655,
});
export const WOLFVEIL_EXTENTS=Object.freeze({
  plateau:[-1000,1000,-1000,1000],
  preview:[-550,550,-550,550],
  townCore:[-200,200,-250,250],
  housingEnvelopes:[-450,450,-450,450],
  metersPerUnit:1, north:'+z',
});
export const WOLFVEIL_SITES=Object.freeze({
  southGate:{id:'wolfveil_south_gate',x:0,z:-225,kind:'arrival',label:'Southern Wolf Gate'},
  market:{id:'wolfveil_market',x:0,z:-70,kind:'town',label:'Wolf-Spirit Market'},
  wolfFountain:{id:'wolfveil_fountain',x:0,z:-69,kind:'town',label:'Wolf-Spirit Fountain'},
  sanctuary:{id:'wolfveil_sanctuary',x:4,z:220,kind:'sacred',label:'Wolf Sanctuary'},
  wolfEars:{id:'wolfveil_twin_peaks',x:2,z:470,kind:'mountain',label:'Split Wolf-Ear Peaks'},
  waterfall:{id:'wolfveil_high_waterfall',x:142,z:179,kind:'water',label:'Hidden Waterfall'},
  waterfallCave:{id:'wolfveil_waterfall_cave',x:163,z:155,kind:'cave',label:'Secret Cave Behind Falls'},
  cedarForest:{id:'wolfveil_cedar_forest',x:-320,z:65,kind:'forest',label:'Western Cedar Forest'},
  training:{id:'wolfveil_training',x:-165,z:88,kind:'training',label:'Shadow Wolf Training Grounds'},
  quarry:{id:'wolfveil_quarry',x:350,z:-40,kind:'encounter',label:'Abandoned Stone Quarry'},
  hotSpring:{id:'wolfveil_hot_spring',x:-105,z:330,kind:'refuge',label:'Mountain Hot Springs'},
  snowRidge:{id:'wolfveil_snow_ridge',x:35,z:680,kind:'mountain',label:'Snow Ridge'},
  ravine:{id:'wolfveil_hostile_ravine',x:340,z:-165,kind:'encounter',label:'Shadow Ravine'},
  wolfStone:{id:'wolfveil_wolfstone_arena',x:-325,z:235,kind:'encounter',label:'Wind-Carved Wolf Stones'},
  ruinedWatch:{id:'wolfveil_ruined_watch',x:295,z:-205,kind:'ruin',label:'Ruined Watch Station'},
});
export const WOLFVEIL_ROUTES=Object.freeze([
  {id:'public_gate_market_sanctuary',kind:'primary',width:6,
    points:[[0,-225],[0,-150],[0,-70],[0,20],[2,115],[4,220]],
    labels:['Southern Gate','Market','Sanctuary']},
  {id:'west_residential',kind:'residential',width:3.6,
    points:[[0,-70],[-65,-88],[-135,-105],[-205,-113],[-263,-93]]},
  {id:'south_residential',kind:'residential',width:3.6,
    points:[[0,-155],[-70,-200],[-145,-240],[-235,-280]]},
  {id:'riverside_loop',kind:'riverside',width:3.3,
    points:[[8,-155],[67,-147],[89,-85],[104,0],[102,115],[142,179]]},
  {id:'river_housing_loop',kind:'residential',width:3.5,
    points:[[0,-125],[72,-105],[139,-122],[205,-96],[235,-35],[190,35],[104,0]]},
  {id:'west_woodland_fork',kind:'explore',width:2.7,
    points:[[-135,-105],[-230,-35],[-320,65],[-335,145],[-325,235]]},
  {id:'training_forest',kind:'explore',width:2.8,
    points:[[-30,62],[-165,88],[-230,65],[-320,65]]},
  {id:'quarry_approach',kind:'explore',width:3.2,
    points:[[205,-96],[278,-65],[350,-40],[340,-165]]},
  {id:'ridge_path',kind:'ridge',width:2.8,
    points:[[4,220],[-55,265],[-105,330],[0,470],[35,680]]},
  {id:'waterfall_cave',kind:'explore',width:2.3,
    points:[[102,115],[142,179],[163,155],[190,150]]},
]);
export const WOLFVEIL_BRIDGES=Object.freeze([
  {id:'market_bridge',label:'Market Stone Bridge',from:[63,-98],to:[134,-98],width:6,kind:'stone'},
  {id:'residential_footbridge',label:'Residential Timber Bridge',from:[82,35],to:[146,35],width:3.3,kind:'timber'},
  {id:'outer_trail_bridge',label:'Outrider Rope Bridge',from:[87,205],to:[173,205],width:2.4,kind:'rope'},
]);
const functional=[
  ['inn_tea','Inn & Tea House',-32,-92,20,15,'inn'],
  ['forge','Blacksmith & Forge',35,-96,21,17,'forge'],
  ['apothecary','Herbalist & Apothecary',-38,-33,18,14,'shop'],
  ['provisions','General Provisions',29,-33,17,14,'shop'],
  ['clan_hall','Wolf Clan Hall',-38,12,26,20,'hall'],
  ['archive','Wolf Lore Archive',33,16,20,16,'archive'],
  ['bathhouse','Hot Spring Pavilion',-105,330,22,18,'bathhouse'],
  ['training_hall','Training Hall',-165,88,28,18,'training'],
  ['sanctuary_hall','Wolf Sanctuary Hall',4,220,32,23,'sanctuary'],
  ['southern_rest','Visitor Rest Pavilion',-27,-194,15,13,'pavilion'],
  ['market_food','Market Cuisine',-32,-66,13,11,'shop'],
  ['market_cloth','Craft & Cloth Shop',30,-64,13,11,'shop'],
];
const homes=[
  [-106,13],[-135,18],[-165,12],[-106,-25],[-138,-28],[-168,-23],
  [-105,-105],[-143,-112],[-175,-118],[-102,-160],[-138,-170],[-170,-178],
  [136,-142],[175,-134],[222,-120],[162,-66],[204,-61],[245,-39],
  [128,53],[163,79],[199,97],[118,139],[156,147],[197,160],
];
export const WOLFVEIL_BUILDINGS=Object.freeze([
  ...functional.map(([id,label,x,z,w,d,kind],i)=>({id,label,x,z,w,d,kind,
    stories:kind==='sanctuary'||kind==='hall'?2:kind==='inn'?2:1,
    variant:i%4,hasInterior:['inn','forge','shop','archive','sanctuary'].includes(kind)})),
  ...homes.slice(0,18).map(([x,z],i)=>({id:'existing_residence_'+(i+1),label:'Cedar Residence '+(i+1),
    x,z,w:12+(i%3)*2,d:10+(i%2)*3,kind:'residence',
    stories:i%3===0?2:1,variant:i%4,hasInterior:i===0})),
]);
const housingCenters={
  cedar:[[-275,-100],[-309,-100],[-341,-101],[-274,-138],[-307,-139],[-341,-139],[-273,-179],[-307,-180]],
  river:[[232,16],[265,16],[299,16],[231,58],[266,58],[300,58],[232,101],[267,102]],
  sun:[[-243,-243],[-281,-243],[-318,-243],[-243,-283],[-281,-283],[-318,-283],[-243,-323],[-281,-323]],
};
export const WOLFVEIL_HOUSING_PLOTS=Object.freeze(
  Object.entries(housingCenters).flatMap(([district,centers])=>
    centers.map(([x,z],i)=>({
      id:'wolfveil_plot_'+district+'_'+String(i+1).padStart(2,'0'),
      district,x,z,w:(i<5?16:24),d:(i<5?20:28),
      state:'reserved_visual_plot_only',
      buildable:false, // requires authenticated owner, server persistence and collision
    }))),
);
export const WOLFVEIL_MARKET_STALLS=Object.freeze([
  [-26,-54],[26,-54],[-25,-73],[25,-73],[-24,-95],[23,-94],[-17,-112],[16,-113]
].map(([x,z],i)=>({id:'market_stall_'+(i+1),x,z})));

export const WOLFVEIL_RIVER=Object.freeze({
  origin:'northeast_highfall',outlet:'southeast_lowland',
  // A continuous stream from +Z northern mountain source to -Z outlet.
  // grade is the WATER elevation, so monotone downhill is testable.
  points:[
    [227,360,99],[205,320,83],[180,268,66],[151,218,54],
    [142,184,45],[132,166,19],[121,115,17],[123,75,13],
    [119,34,10],[111,0,7],[105,-50,3],[103,-98,-1],
    [129,-144,-4],[151,-190,-6],[175,-245,-11],[203,-335,-18],
    [237,-450,-25],
  ],
  width:19,
  waterfallRange:[166,184],
});
export const WOLFVEIL_CAVES=Object.freeze([
  {id:'jade_lantern_grotto',name:'Jade Lantern Grotto',entry:[-216,76],exit:[-138,196],
    accessible:'explorable_interconnected_tunnel'},
  {id:'whispering_root_hollow',name:'Whispering Root Hollow',entry:[-312,148],exit:[-138,196],
    accessible:'explorable_interconnected_tunnel'},
  {id:'sunken_inkstone_cistern',name:'Sunken Inkstone Cistern',entry:[-82,312],exit:[-138,196],
    accessible:'explorable_interconnected_tunnel'},
  {id:'echoing_crystal_vault',name:'Echoing Crystal Vault',entry:[122,198],exit:[-138,196],
    accessible:'explorable_interconnected_tunnel'},
]);
export function wolfveilDistanceToRiver(x,z){
  let dist=Infinity;
  for(let i=0;i<WOLFVEIL_RIVER.points.length-1;i++){
    const a=WOLFVEIL_RIVER.points[i],b=WOLFVEIL_RIVER.points[i+1];
    const dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz||1;
    const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/l));
    dist=Math.min(dist,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));
  }
  return dist;
}
export function wolfveilRiverHeightAtZ(z){
  const pts=WOLFVEIL_RIVER.points;
  if(z>=pts[0][1])return pts[0][2];
  for(let i=0;i<pts.length-1;i++){
    if(z<=pts[i][1]&&z>=pts[i+1][1]){
      const t=(pts[i][1]-z)/(pts[i][1]-pts[i+1][1]);
      return pts[i][2]+t*(pts[i+1][2]-pts[i][2]);
    }
  }
  return pts.at(-1)[2];
}
const smooth=(t)=>{const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x);};
// Distance outside the WALKABLE route edge. A bounded segment envelope keeps
// the terrain-build cost low when sampling the 1,100m contoured ground.
// Returns Infinity away from routes (no nearby transition to protect).
export function wolfveilRouteClearance(x,z){
  if(!Number.isFinite(x)||!Number.isFinite(z))return Infinity;
  let nearest=Infinity;
  for(const route of WOLFVEIL_ROUTES){
    const points=route.points,reach=route.width/2+11;
    for(let i=0;i<points.length-1;i++){
      const [ax,az]=points[i],[bx,bz]=points[i+1];
      if(x<Math.min(ax,bx)-reach||x>Math.max(ax,bx)+reach||
         z<Math.min(az,bz)-reach||z>Math.max(az,bz)+reach)continue;
      const dx=bx-ax,dz=bz-az,denom=dx*dx+dz*dz||1;
      const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/denom));
      const clearance=Math.hypot(x-ax-t*dx,z-az-t*dz)-route.width/2;
      if(clearance<nearest)nearest=clearance;
    }
  }
  return nearest;
}
// Low-amplitude, deterministic relief in metres: gentle swells interspersed
// with finer rough pockets. Never affect a roadbed, stream bank or the Luna
// palace foundations/steps. Everyone samples this same analytical height:
// walkable geometry, planting, client feet and shared physics remain aligned.
export function wolfveilGroundUndulation(x,z,riverDistance=wolfveilDistanceToRiver(x,z)){
  if(!Number.isFinite(x)||!Number.isFinite(z))return 0;
  const routeFade=smooth((wolfveilRouteClearance(x,z)-.6)/5.5);
  const waterFade=smooth((riverDistance-14)/20);
  const palaceX=Math.max(0,Math.abs(x)-26.5);
  const palaceZ=Math.max(0,Math.abs(z-115)-16.5);
  const palaceFade=smooth((Math.hypot(palaceX,palaceZ)-4)/9);
  const large=.26*Math.sin(x*.25+z*.12)*Math.sin(z*.18-x*.085);
  const fine=.105*Math.sin(x*.53-z*.34)*Math.sin(z*.39+x*.17);
  return (large+fine)*routeFade*waterFade*palaceFade;
}
// Smooth only the actual Lunar Cave slope. World Z 222 maps to local Z 152;
// the same analytic grade feeds visible terrain and authoritative collision.
export function gradeWolfveilLunarCaveApproach(x,z,height,riverDistance=wolfveilDistanceToRiver(x,z)){
  if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(height))return height;
  const dx=x-171,dz=z-152,yaw=Math.PI/8;
  const lateral=dx*Math.cos(yaw)-dz*Math.sin(yaw);
  const depth=dx*Math.sin(yaw)+dz*Math.cos(yaw);
  const sideways=1-smooth((Math.abs(lateral)-6)/22);
  const front=smooth((depth+43)/20),rear=1-smooth((depth-6)/20);
  const protectWater=smooth((riverDistance-12)/18);
  return height-8.5*sideways*front*rear*protectWater;
}
export function wolfveilNaturalHeight(x,z){
  // Town rises approximately 80m from entrance to sanctuary while the
  // broader plateau rim climbs toward the split high ridges.
  const northRise=z< -225?0:z>220?80:80*smooth((z+225)/445);
  const plazaGrade=2.8*Math.sin(x*.014+z*.027)+1.2*Math.cos(x*.042-z*.012);
  const outward=Math.max(0,(Math.abs(x)-145)/150);
  // Walkable relief: the valley rim and northern highlands are long, gentle
  // climbs (mostly under 20 degrees) rather than steep up-and-down walls.
  const sideHills=30*smooth(outward)*(.68+.32*Math.cos(z*.009));
  const farNorth=44*smooth((z-250)/290);
  const cliffBands=3.5*Math.sin(x*.058+z*.023)*smooth((Math.abs(x)-160)/170);
  let y=northRise+plazaGrade+sideHills+farNorth+cliffBands;
  // Feather the western mountain flank into an explorable, rolling hillside.
  // Terrain BVH, worker height contract and planting all read this one grade.
  y=gradeWolfveilWestHillside(x,z,y,sideHills);
  // Expose a carved, lower riverbed along the eastern edge of the basin.
  const river=wolfveilDistanceToRiver(x,z);
  y+=wolfveilGroundUndulation(x,z,river);
  // One continuous sculpted channel: the terrain, player-foot BVH and
  // server-authoritative map all sample this exact shared elevation.
  // Unlike a Z-only approximation, the waterline follows river bends.
  y=gradeWolfveilRiverbank(x,z,y,WOLFVEIL_RIVER.points,WOLFVEIL_RIVER.width);
  y=gradeWolfveilLunarCaveApproach(x,z,y,river);
  // Keep key public locations and village foundations predictable without
  // erasing organic terrain globally.
  for(const location of [WOLFVEIL_SITES.market,WOLFVEIL_SITES.southGate,
      WOLFVEIL_SITES.sanctuary]){
    const d=Math.hypot(x-location.x,z-location.z);
    const r=location===WOLFVEIL_SITES.market?34:location===WOLFVEIL_SITES.sanctuary?28:22;
    if(d<r){
      const centerRise=location.z< -220?0:80*smooth((location.z+225)/445);
      y=y*smooth(d/r)+(centerRise+.3)*(1-smooth(d/r));
    }
  }
  return y;
}
// The same shared graded elevation is sampled by the rendered BVH, player
// feet, landscaping, and multiplayer worker; keep the previous micro-contours.
const palaceNaturalCenterY=wolfveilNaturalHeight(0,115);
const palaceNaturalJoinY=wolfveilNaturalHeight(0,89);
// Removed fountain homes must not leave their four artificially leveled
// foundations in the real shared heightfield / worker. Preserve all grading
// necessary to seat the actual Luna mansion and the authored bridge banks.
export function wolfveilPreBridgeHeight(x,z){
  // Rear mountain is 50% gentler in the manor-facing core. Feed this same
  // height to the physical terrain BVH, vegetation roots and server worker.
  // The manor pad and its SOUTH entrance stairs are graded afterwards and
  // therefore retain exact ground/foundation contact.
  const natural=wolfveilNaturalHeight(x,z);
  const rearReference=wolfveilNaturalHeight(x,WOLFVEIL_PALACE_REAR_MOUNTAIN.startZ);
  const rear=gradeWolfveilPalaceRearMountain(x,z,natural,rearReference);
  return gradeWolfveilPalaceTerrain(
    x,z,rear,palaceNaturalCenterY,palaceNaturalJoinY);
}
// Grade the SAME real terrain mesh near both bearings of every Play bridge.
// No extra visual-only "ground": the existing terrain BVH and trusted worker
// sample wolfveilHeight, including the bank-local grading.
export const wolfveilBridgeBankTerrainGrade=createWolfveilBridgeBankTerrainGrade(
  WOLFVEIL_BRIDGES,wolfveilPreBridgeHeight);
export function wolfveilHeight(x,z){
  return gradeWolfveilImportedTown(x,z,wolfveilBridgeBankTerrainGrade(x,z));
}
export const WOLFVEIL_DISTRICTS=Object.freeze([
  {id:'market',name:'Wolf-Spirit Market',center:[0,-70],purpose:'safe services'},
  {id:'cedar_housing',name:'Cedar Housing Terraces',center:[-297,-136],purpose:'player plots'},
  {id:'river_housing',name:'Riverside Terraces',center:[269,61],purpose:'player plots'},
  {id:'sun_housing',name:'Sun Terraces',center:[-285,-280],purpose:'player plots'},
  {id:'forest',name:'Western Cedar Forest',center:[-320,65],purpose:'quiet exploration'},
  {id:'training',name:'Training Courtyard',center:[-165,88],purpose:'safe training'},
  {id:'sanctuary',name:'Wolf Sanctuary',center:[4,220],purpose:'sacred gathering'},
  {id:'quarry',name:'Abandoned Quarry',center:[350,-40],purpose:'hostile wilderness'},
]);

// The former procedural village remains archival reference only.
// All former village and fountain houses remain archived, unmounted.
// Luna's dashboard mansion is the one active Wolfveil residence.
export const WOLFVEIL_ACTIVE_TOWN_BUILDINGS=Object.freeze([]);