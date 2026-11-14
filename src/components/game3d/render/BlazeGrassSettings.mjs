// Adapted from the owner's uploaded "Sumi-e Blaze of Grass — 100x100m Living
// Fire Sanctuary" reference. Values match its opening controls and palettes.
export const BLAZE_GRASS = Object.freeze({
  artStyle:'blaze',
  footprintMeters:100,
  bladeCount:52000,
  macroBlades:450,
  emberCount:1800,
  segments:16,
  bloom:Object.freeze({strength:.18,radius:.38,threshold:.88}),
});
export const BLAZE_PALETTES = Object.freeze(['jade','vermilion','cobalt']);
export const BLAZE_PROFILES = Object.freeze(['sumi','anime','realistic']);
export const BLAZE_DEFAULTS = Object.freeze({
  blazePalette:'jade',
  blazeProfile:'sumi',
  blazeGlass:.65,
  blazeFlameSpeed:.42,
  blazePinch:1.15,
  blazeInkWeight:1.25,
  blazeCurl:1.0,
  blazePerimeterRatio:.20,
  blazeBuildingSway:.48,
  blazeTreeSway:.62, // damped GPU tree / GLB canopy wind, with fixed roots
  blazePerimeterFire:true,
  blazeBrightness:.78,
  blazeGlare:.25,
  blazePostFX:false, // optional: no full-frame wash without explicit consent
  blazeGroundCover:true, // stream knee-height fire grass across plantable outdoor land
  blazeFusionStrength:0, // 0 Sanctuary; .72 fusion; 1 Atomic Safe
});
const bounded=(v,lo,hi,def)=>Number.isFinite(Number(v))
  ? Math.max(lo,Math.min(hi,Number(v))):def;
export function normalizeBlazeSettings(raw={}){
  const v=raw&&typeof raw==='object'?raw:{};
  return {
    blazePalette:BLAZE_PALETTES.includes(v.blazePalette)?v.blazePalette:'jade',
    blazeProfile:BLAZE_PROFILES.includes(v.blazeProfile)?v.blazeProfile:'sumi',
    blazeGlass:bounded(v.blazeGlass,0,1.2,BLAZE_DEFAULTS.blazeGlass),
    blazeFlameSpeed:bounded(v.blazeFlameSpeed,.12,1.25,BLAZE_DEFAULTS.blazeFlameSpeed),
    blazePinch:bounded(v.blazePinch,.3,1.8,BLAZE_DEFAULTS.blazePinch),
    blazeInkWeight:bounded(v.blazeInkWeight,.4,2,BLAZE_DEFAULTS.blazeInkWeight),
    blazeCurl:bounded(v.blazeCurl,.2,2,BLAZE_DEFAULTS.blazeCurl),
    blazePerimeterRatio:bounded(v.blazePerimeterRatio,.05,.45,BLAZE_DEFAULTS.blazePerimeterRatio),
    blazeBuildingSway:bounded(v.blazeBuildingSway,.05,1.2,BLAZE_DEFAULTS.blazeBuildingSway),
    blazeTreeSway:bounded(v.blazeTreeSway,0,1.4,BLAZE_DEFAULTS.blazeTreeSway),
    blazePerimeterFire:typeof v.blazePerimeterFire==='boolean'?v.blazePerimeterFire:true,
    blazeBrightness:bounded(v.blazeBrightness,.35,1.35,BLAZE_DEFAULTS.blazeBrightness),
    blazeGlare:bounded(v.blazeGlare,0,1,BLAZE_DEFAULTS.blazeGlare),
    blazePostFX:v.blazePostFX===true,
    blazeGroundCover:v.blazeGroundCover!==false,
    blazeFusionStrength:bounded(v.blazeFusionStrength,0,1,0),
  };
}
export function blazePaletteIndex(value){return Math.max(0,BLAZE_PALETTES.indexOf(value));}
export function blazeProfileIndex(value){return Math.max(0,BLAZE_PROFILES.indexOf(value));}
