// Visual-only biome rules for Blaze of Grass. No changes to physical terrain,
// streamed meadow tiles, server collisions or the world's real tree geometry.
export const BLAZE_TILE_METERS=16;
export const BLAZE_ANKLE_MIN_METERS=1.15;
export const BLAZE_ANKLE_MAX_METERS=1.65; // clone-only 3x flame grass; legacy export aliases
export const BLAZE_WORLD_PALETTES=Object.freeze({
  meadow:Object.freeze({index:0,density:1,root:[.04,.20,.15],tip:[.68,.92,.42]}),
  forest:Object.freeze({index:0,density:.9,root:[.025,.14,.10],tip:[.37,.76,.43]}),
  desert:Object.freeze({index:3,density:.30,root:[.11,.085,.058],tip:[.72,.55,.32]}),
  barren:Object.freeze({index:3,density:0,root:[.08,.07,.06],tip:[.37,.29,.22]}),
});
export function classifyBlazeBiome(input={}){
  const text=[input.biome,input.region,input.materialName,input.surfaceName]
    .filter(Boolean).join(' ').toLowerCase();
  if(/water|river|lake|ocean|wetland|lava|ice|snow|cliff|rockslide|bare.?rock|floor|building|cave|road|paved/.test(text))
    return 'barren';
  if(/desert|dune|arid|sand|badland|scrubland|dry.?steppe/.test(text))
    return 'desert';
  if(/forest|woodland|grove|jungle|cedar|birch|elm|oak|pine/.test(text))
    return 'forest';
  return 'meadow';
}
export function blazeBiomePalette(biome){
  return BLAZE_WORLD_PALETTES[biome]||BLAZE_WORLD_PALETTES.meadow;
}
export function blazeTileKey(ix,iz){return ix+':'+iz;}
export function blazeTileCoords(x,z,tileSize=BLAZE_TILE_METERS){
  return {ix:Math.floor(x/tileSize),iz:Math.floor(z/tileSize)};
}
export function blazeTileSeed(ix,iz){
  return (Math.imul(ix,73856093)^Math.imul(iz,19349663)^0xB1A2E)>>>0;
}
export function blazeRandom(seed){
  let state=seed>>>0;
  return ()=>{state=(state+0x6D2B79F5)>>>0;
    let x=Math.imul(state^(state>>>15),state|1);
    x^=x+Math.imul(x^(x>>>7),x|61);
    return ((x^(x>>>14))>>>0)/4294967296;
  };
}
export function blazeStreamQuality(quality='high'){
  if(quality==='low')return Object.freeze({radius:1,near:500,far:0,embers:30});
  if(quality==='medium')return Object.freeze({radius:1,near:1400,far:0,embers:48});
  if(quality==='ultra')return Object.freeze({radius:2,near:5200,far:2000,embers:80});
  return Object.freeze({radius:2,near:4200,far:1400,embers:64});
}
export function isBlazeTreePart({name='',parentName='',materialName=''}={}){
  const own=(name+' '+materialName).toLowerCase();
  const group=(own+' '+parentName).toLowerCase();
  if(/sky|water|foam|portal|particle|decorative.?light/.test(group))return null;
  const likelyTree=/tree|elm|oak|birch|maple|cedar|pine|bamboo|bough|crown|canopy|needle|foliage|leaf|leaves|trunk|branch|bark|shrub|fern/.test(group);
  if(!likelyTree)return null;
  if(/trunk|bark|branch|stem|timber|log/.test(own))return 'bark';
  if(/canopy|crown|leaf|leaves|needle|foliage|bough|fern|shrub/.test(own))return 'foliage';
  if(/trunk|bark|branch/.test(parentName.toLowerCase()))return 'bark';
  return 'foliage';
}
