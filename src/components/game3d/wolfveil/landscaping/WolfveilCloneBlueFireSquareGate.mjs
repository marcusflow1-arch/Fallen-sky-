// Game 3D clone: no square is visually enabled merely by existing in source.
// Every exact 5m cell needs independent QA and owner acceptance for live use.
// Review-preview is an explicit nonproduction mode; neither mode overrides a
// locked square or another landscape workstream's exclusion.
const finite=(...values)=>values.every(Number.isFinite);
const exactFive=s=>s&&finite(s.minX,s.minZ,s.maxX,s.maxZ)&&
  Math.abs((s.maxX-s.minX)-5)<1e-6&&Math.abs((s.maxZ-s.minZ)-5)<1e-6;
const overlaps=(a,b,pad=0)=>a.minX<b.maxX+pad&&a.maxX>b.minX-pad&&
  a.minZ<b.maxZ+pad&&a.maxZ>b.minZ-pad;

export function selectCloneBlueFireSquares({
  squares=[],protectedTiles=[],mode='certified',
}={}){
  if(!Array.isArray(squares)||!Array.isArray(protectedTiles)||
      !['certified','review-preview'].includes(mode))return [];
  const retained=[],seen=new Set();
  for(const s of squares){
    if(!exactFive(s))continue;
    // Live mode is strictly fail closed. Preview mode never writes a tile.
    if(mode==='certified'&&!(s.ownerAccepted===true&&s.independentQA100===true))continue;
    if(protectedTiles.some(p=>p&&finite(p.minX,p.minZ,p.maxX,p.maxZ)&&
      overlaps(s,p,.75)))continue;
    const key=s.minX+','+s.minZ;
    if(seen.has(key))continue;
    seen.add(key);
    retained.push({minX:s.minX,maxX:s.maxX,minZ:s.minZ,maxZ:s.maxZ});
  }
  return retained;
}
