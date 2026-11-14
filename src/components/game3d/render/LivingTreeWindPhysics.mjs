// Render-only damped wind response for imported GLB/FBX and procedural trees.
// The GLB's vertex positions, materials, geometry, transforms, and authoritative
// trunk colliders stay unchanged. Only the vertex shader moves the visible crown.
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export const BLAZE_TREE_WIND_DEFAULT=.62;
export const BLAZE_KNEE_GRASS_MIN=.38;
export const BLAZE_KNEE_GRASS_MAX=.55;
export const BLAZE_KNEE_GRASS_BODY=.47;

/** A leaf and bark may be separate material groups within one imported mesh. */
export function classifyTreeMaterialPart(name='',fallback='foliage'){
  const text=String(name).toLowerCase();
  if(/bark|trunk|wood|branch|stem|timber|log/.test(text))return 'bark';
  if(/leaf|leaves|foliage|canopy|crown|needle|bough|frond/.test(text))
    return 'foliage';
  return fallback==='bark'?'bark':'foliage';
}
export function treeShaderSpace(mesh){
  const axis=mesh?.userData?.blazeTreeUpAxis==='z'?'z':'y';
  const geom=mesh?.geometry;
  if(geom&&!geom.boundingBox)geom.computeBoundingBox?.();
  const box=geom?.boundingBox,lo=box?.min?.[axis],hi=box?.max?.[axis];
  const start=Number.isFinite(lo)?lo:0;
  const height=Number.isFinite(hi)&&hi>start?hi-start:1;
  return {axis,min:start,height:clamp(height,.01,100000)};
}
const glsl=(n)=>Number.isFinite(n)?Number(n).toFixed(6):'0.0';
/**
 * Build a per-material shader section. The source is applied before
 * <project_vertex>, after already installed GLB leaf-wind hooks, so it
 * preserves native animation and physically springs back following gusts.
 */
export function treeWindProject(kind,mesh,projectChunk,{existingLeafWind=false}={}){
  const {axis,min,height}=treeShaderSpace(mesh);
  const lateral=axis==='z'?['x','y']:['x','z'];
  const foliage=kind==='foliage'||kind==='desertFoliage';
  const coeff=foliage?(existingLeafWind?.008:.026):.013;
  return `
  // Damped GPU tree physics: no CPU geometry mutation or collider changes.
  #ifdef USE_INSTANCING
    vec3 blazeTreeRoot=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
  #else
    vec3 blazeTreeRoot=(modelMatrix*vec4(0.,0.,0.,1.)).xyz;
  #endif
  float blazeTreeFraction=clamp(
    (position.${axis}-(${glsl(min)}))/${glsl(height)},0.,1.);
  float blazeTreeBend=blazeTreeFraction*blazeTreeFraction*
    (3.-2.*blazeTreeFraction);
  float blazeTreeWave=sin(uBlazeTime*.93+blazeTreeRoot.x*.14+
    blazeTreeRoot.z*.09)+
    .27*sin(uBlazeTime*2.17+blazeTreeRoot.z*.18+
       position.${axis}*.043);
  float blazeTreeAmplitude=${glsl(height*coeff)}*
    uBlazeTreeSway*clamp(uBlazeTreeSpring,0.,1.75)*blazeTreeBend;
  vec2 blazeTreeDir=normalize(uBlazeTreeDirection+vec2(.0001));
  transformed.${lateral[0]}+=blazeTreeDir.x*
    blazeTreeWave*blazeTreeAmplitude;
  transformed.${lateral[1]}+=blazeTreeDir.y*
    blazeTreeWave*blazeTreeAmplitude;
`+projectChunk;
}
/** Stable critically damped gust spring; does not integrate rigid bodies. */
export function createTreeGustSpring(){
  let position=0,velocity=0;
  return {
    advance(target,seconds){
      const dt=clamp(Number(seconds)||0,0,.08);
      const aim=clamp(Number(target)||0,0,1.75);
      const acceleration=(aim-position)*17-velocity*8.2;
      velocity+=acceleration*dt;
      position=clamp(position+velocity*dt,0,1.75);
      return position;
    },
    reset(value=0){position=clamp(Number(value)||0,0,1.75);velocity=0;},
    get value(){return position;},
  };
}
