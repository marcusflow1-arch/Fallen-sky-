// Fused Game 3D creator quality controls. These presets only set real CC_*
// sliders found on the selected character; unavailable shapes are never faked.
export const CREATOR_BODY_PRESETS=Object.freeze([
 Object.freeze({id:'natural',label:'Natural',description:'Original proportions',values:Object.freeze({})}),
 Object.freeze({id:'slender',label:'Slender',description:'Narrower waist and lighter build',values:Object.freeze({
  body_weight:-.65,waist:-.45,belly:-.6,hip_width:-.2,glute_size:-.2,thigh_size:-.2,arm_size:-.15,
 })}),
 Object.freeze({id:'soft_full',label:'Full figure',description:'Soft, rounded waist, abdomen, hips and limbs',values:Object.freeze({
  body_weight:.75,waist:.5,belly:.8,hip_width:.4,glute_size:.35,chest_size:.3,thigh_size:.35,arm_size:.25,calf_size:.18,
 })}),
 Object.freeze({id:'heavyset',label:'Heavyset',description:'Full belly all around, broad midsection and natural weight distribution',values:Object.freeze({
  body_weight:1,waist:.9,belly:1,hip_width:.65,glute_size:.55,chest_size:.5,thigh_size:.65,arm_size:.5,calf_size:.28,
 })}),
 Object.freeze({id:'athletic',label:'Athletic',description:'Balanced frame with moderate muscle tone',values:Object.freeze({
  body_weight:.05,waist:-.25,belly:-.2,muscle_definition:.65,shoulder_width:.4,arm_size:.3,thigh_size:.3,calf_size:.2,
 })}),
 Object.freeze({id:'muscular',label:'Muscular',description:'Broad shoulders and strong arms, legs and torso',values:Object.freeze({
  body_weight:.25,waist:-.2,belly:-.3,muscle_definition:1,shoulder_width:.8,arm_size:.8,thigh_size:.7,calf_size:.6,
 })}),
]);
// Body shapes are deliberately limited to this list. Presets must never clear
// facial sculpting, expression keys, saved identity or skin/hair colors.
export const CREATOR_BODY_SHAPE_IDS=Object.freeze([
 'body_weight','waist','belly','shoulder_width','muscle_definition','arm_size',
 'thigh_size','calf_size','neck_width','chest_size','chest_height',
 'chest_spacing','glute_size','glute_lift','hip_width',
]);
export function applyCreatorBodyPreset(appearance,presetId,supportedShapes=[]){
 const preset=CREATOR_BODY_PRESETS.find(p=>p.id===presetId);
 if(!preset)throw new RangeError('Unknown creator physique preset');
 const supported=new Set(supportedShapes);
 const shape_controls={...(appearance?.shape_controls||{})};
 for(const id of CREATOR_BODY_SHAPE_IDS){
  if(supported.has(id))shape_controls[id]=Math.max(-1,Math.min(1,preset.values[id]??0));
 }
 return {...appearance,shape_controls};
}
// Smoothstep avoids a new sharp line in the midriff. Source model coordinates
// are translated to a hips→upper-chest frame, not an arbitrary world scale.
const smooth=x=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
export function bellyTorsoEnvelope(heightFraction,torsoBoneWeight=1){
 if(!Number.isFinite(heightFraction)||!Number.isFinite(torsoBoneWeight))return 0;
 return smooth((heightFraction-.05)/.25) *
  (1-smooth((heightFraction-.78)/.3)) *
  Math.max(0,Math.min(1,torsoBoneWeight));
}
export function eyeClearanceEnvelope(horizontalError,verticalError,depthError){
 if(![horizontalError,verticalError,depthError].every(Number.isFinite))return 0;
 // Normalized within eye oval, with a soft falloff to preserve forehead bangs.
 const d=horizontalError*horizontalError+verticalError*verticalError;
 return (1-smooth((d-.25)/.75))*(1-smooth((depthError+.2)/.5));
}
export function neckToneFeather(heightFraction,radialFraction){
 if(!Number.isFinite(heightFraction)||!Number.isFinite(radialFraction))return 0;
 return smooth((heightFraction+.10)/.37)*
  (1-smooth((heightFraction-.64)/.43))*
  (1-smooth((radialFraction-.75)/.65));
}
