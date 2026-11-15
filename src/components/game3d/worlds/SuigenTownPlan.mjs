// Original, clone-only ~588m x 684m town plan built around the EXISTING
// canal/keep precinct. Neither the owner GLB nor Classic Wolfveil is edited.
export const SUIGEN_TOWN_BOUNDS=Object.freeze({
  minX:-294,maxX:294,minZ:-116,maxZ:568,
});
export const SUIGEN_TOWN_NAME='Dominion of Suigen — Living Town';
export const SUIGEN_MERCHANT_CATALOG=Object.freeze([
  {id:'forge',name:'Moonsteel Blacksmith',kind:'blacksmith',service:'enchant'},
  {id:'weapons',name:'Bladewind Weapons',kind:'weapons'},
  {id:'healer',name:'Jade Apothecary',kind:'apothecary'},
  {id:'supplies',name:'Travel Provisioner',kind:'general'},
  {id:'materials',name:'Ore & Materials Exchange',kind:'materials'},
  {id:'wardrobe',name:'Moonloom Atelier',kind:'vanity',service:'vanity'},
  {id:'temple',name:'Spirit & Halo Sanctuary',kind:'spiritual',service:'halo'},
  {id:'inn',name:'Lantern Rest Inn',kind:'inn'},
  {id:'tavern',name:'Silver Crane Tavern',kind:'tavern'},
  {id:'stables',name:'Wolfveil Stables',kind:'stables',service:'mount'},
  {id:'guild',name:'Chronicle Guildhouse',kind:'guild',service:'quest_logbook'},
  {id:'relics',name:'Relic & Curio Dealer',kind:'curios'},
]);
const COLUMNS=Object.freeze([-258,-204,-150,150,204,258]);
const ROWS=Object.freeze([-91,-35,21,77,133,189,245,301,357,413]);
const businessCells=[
  [2,3,'forge'],[3,3,'weapons'],[2,4,'healer'],[3,4,'supplies'],
  [2,5,'materials'],[3,5,'wardrobe'],[2,6,'temple'],[3,6,'inn'],
  [2,7,'tavern'],[3,7,'stables'],[2,8,'guild'],[3,8,'relics'],
];
const shopByCell=new Map(businessCells.map(([c,r,id])=>[c+':'+r,id]));
export const SUIGEN_TOWN_PLOTS=Object.freeze(ROWS.flatMap((z,row)=>COLUMNS.map((x,col)=>{
  const merchantId=shopByCell.get(col+':'+row)||null;
  const merchant=SUIGEN_MERCHANT_CATALOG.find(m=>m.id===merchantId)||null;
  const seed=col*103+row*37+17;
  // Keep the real vortex-lake mountain pocket around (205,390) open. The
  // eastern district's last two rows continue *past* that lake and the
  // connecting scenic bypass instead of occupying its water surface.
  const siteZ=col>=3&&row>=8?480+(row-8)*56:z;
  const width=20+(seed%5)*1.7;
  const depth=19+((row*3+col)%5)*1.45;
  return Object.freeze({
    id:`suigen-building-${String(row*6+col+1).padStart(2,'0')}`,
    name:merchant?.name||`Suigen Residence ${row*6+col+1}`,
    category:merchant?.kind||'residence',
    merchantId,service:merchant?.service||null,
    x,z:siteZ,yaw:x<0?Math.PI/2:-Math.PI/2,
    width,depth,stories:merchant?.kind==='stables'?1:((seed%7===0)?1:2),
    seed,entry:'front',enterable:true,
  });
})));
export const SUIGEN_TOWN_REGIONS=Object.freeze([
  {id:'market-west',name:'Western Merchant Arc',bounds:[-294,-116,-116,450]},
  {id:'market-east',name:'Eastern Merchant Arc',bounds:[116,294,-116,450]},
  {id:'old-keep',name:'Historic Acropolis and Canal',bounds:[-116,116,-116,190],preserved:true},
  {id:'southern-green',name:'Southern Lantern Gardens',bounds:[-116,116,190,450]},
]);
export function suigenTownTravelPlan(){
  return {
    region:'wolfveil',map:'suigen',townBounds:SUIGEN_TOWN_BOUNDS,
    buildingCount:SUIGEN_TOWN_PLOTS.length,
    enterableCount:SUIGEN_TOWN_PLOTS.filter(p=>p.enterable).length,
    merchantCount:SUIGEN_TOWN_PLOTS.filter(p=>p.merchantId).length,
    roads:Object.freeze([
      {id:'western-avenue',from:[-180,-105],to:[-180,563],width:9},
      {id:'eastern-avenue',from:[180,-105],to:[180,340],width:9},
      // A safe loop around the vortex basin, with scenic pedestrian access.
      {id:'lake-bypass-entry',from:[180,340],to:[125,340],width:8},
      {id:'lake-bypass-trail',from:[125,340],to:[125,444],width:8},
      {id:'lake-bypass-exit',from:[125,444],to:[180,444],width:8},
      {id:'eastern-north-avenue',from:[180,444],to:[180,563],width:9},
      {id:'northern-promenade',from:[-290,-7],to:[290,-7],width:8},
      {id:'market-crossing',from:[-290,217],to:[290,217],width:10},
      {id:'southern-crossing',from:[-290,505],to:[290,505],width:8},
    ]),
  };
}
