import {FUSED_CHARACTERS_ENABLED,FUSED_RIG_IDS,V5_RIG_IDS} from '@/lib/fusedCharacterFlag';
// Browser-safe customization contract. Keep validation aligned with
// base44/shared/avatarCustomization.ts; server-only asset resolution stays there.
export const ARMOR_SLOTS = ['helmet','chest','pants','gloves','boots','cape'];
export const CUSTOMIZATION_SLOTS = ['body','hair','eyebrows','facial_hair','outfit','top','bottom','footwear','accessory','tattoo','complexion',...ARMOR_SLOTS];
export const SHAPE_CONTROLS = [
 {id:'face_width',label:'Face width',morph:'CC_FaceWidth',section:'face',min:-1},
 {id:'face_height',label:'Face length',morph:'CC_FaceHeight',section:'face',min:-1},
 {id:'jaw_width',label:'Jaw width',morph:'CC_JawWidth',section:'face',min:-1},
 {id:'brow_size',label:'Brow ridge',morph:'CC_BrowSize',section:'face',min:-1},
 {id:'eye_size',label:'Eye size',morph:'CC_EyeSize',section:'face',min:-1},
 {id:'eye_spacing',label:'Eye spacing',morph:'CC_EyeSpacing',section:'face',min:-1},
 {id:'nose_width',label:'Nose width',morph:'CC_NoseWidth',section:'face',min:-1},
 {id:'nose_length',label:'Nose length',morph:'CC_NoseLength',section:'face',min:-1},
 {id:'mouth_width',label:'Mouth width',morph:'CC_MouthWidth',section:'face',min:-1},
 {id:'chest_size',label:'Chest size',morph:'CC_ChestSize',section:'body',min:-.5},
 {id:'glute_size',label:'Glute size',morph:'CC_GluteSize',section:'body',min:-1},
 {id:'shoulder_width',label:'Shoulder width',morph:'CC_ShoulderWidth',section:'body',min:-1},
 {id:'muscle_definition',label:'Muscle',morph:'CC_MuscleDefinition',section:'body',min:-1},
 // fused characters (tools/avatar-fuse): absent on older bodies, where the runtime skips them
 {id:'body_weight',label:'Body weight',morph:'CC_BodyWeight',section:'body',min:-1},
 {id:'waist',label:'Waist',morph:'CC_Waist',section:'body',min:-1},
 {id:'cheek_puff',label:'Cheeks',morph:'CC_CheekPuff',section:'face',min:-1},
 // detail sculpting (tools/avatar-fuse shapes.py): skipped on bodies without the CC_ key
 {id:'forehead_height',label:'Forehead height',morph:'CC_ForeheadHeight',section:'face',min:-1},
 {id:'forehead_slope',label:'Forehead slope',morph:'CC_ForeheadSlope',section:'face',min:-1},
 {id:'brow_height',label:'Brow height',morph:'CC_BrowHeight',section:'face',min:-1},
 {id:'brow_angle',label:'Brow angle',morph:'CC_BrowAngle',section:'face',min:-1},
 {id:'eye_height',label:'Eye height',morph:'CC_EyeHeight',section:'face',min:-1},
 {id:'eye_tilt',label:'Eye tilt',morph:'CC_EyeTilt',section:'face',min:-1},
 {id:'eye_depth',label:'Eye depth',morph:'CC_EyeDepth',section:'face',min:-1},
 {id:'nose_bridge',label:'Nose bridge',morph:'CC_NoseBridge',section:'face',min:-1},
 {id:'nose_tip',label:'Nose tip',morph:'CC_NoseTip',section:'face',min:-1},
 {id:'nose_projection',label:'Nose projection',morph:'CC_NoseProjection',section:'face',min:-1},
 {id:'cheek_bone',label:'Cheekbones',morph:'CC_CheekBone',section:'face',min:-1},
 {id:'cheek_height',label:'Cheek height',morph:'CC_CheekHeight',section:'face',min:-1},
 {id:'jaw_angle',label:'Jaw angle',morph:'CC_JawAngle',section:'face',min:-1},
 {id:'chin_length',label:'Chin length',morph:'CC_ChinLength',section:'face',min:-1},
 {id:'chin_width',label:'Chin width',morph:'CC_ChinWidth',section:'face',min:-1},
 {id:'chin_projection',label:'Chin projection',morph:'CC_ChinProjection',section:'face',min:-1},
 {id:'mouth_height',label:'Mouth height',morph:'CC_MouthHeight',section:'face',min:-1},
 {id:'lip_upper',label:'Upper lip',morph:'CC_LipUpper',section:'face',min:-1},
 {id:'lip_lower',label:'Lower lip',morph:'CC_LipLower',section:'face',min:-1},
 {id:'ear_size',label:'Ear size',morph:'CC_EarSize',section:'face',min:-1},
 {id:'ear_angle',label:'Ear angle',morph:'CC_EarAngle',section:'face',min:-1},
 {id:'neck_width',label:'Neck width',morph:'CC_NeckWidth',section:'body',min:-1},
 {id:'chest_height',label:'Chest height',morph:'CC_ChestHeight',section:'chest',min:-1},
 {id:'chest_spacing',label:'Chest spacing',morph:'CC_ChestSpacing',section:'chest',min:-1},
 {id:'glute_lift',label:'Glute lift',morph:'CC_GluteLift',section:'glutes',min:-1},
 {id:'hip_width',label:'Hip width',morph:'CC_HipWidth',section:'glutes',min:-1},
 {id:'belly',label:'Belly',morph:'CC_Belly',section:'body',min:-1},
 {id:'arm_size',label:'Arms',morph:'CC_ArmSize',section:'body',min:-1},
 {id:'thigh_size',label:'Thighs',morph:'CC_ThighSize',section:'body',min:-1},
 {id:'calf_size',label:'Calves',morph:'CC_CalfSize',section:'body',min:-1},
 {id:'age',label:'Age appearance',morph:'CC_Age',section:'skin',min:0},
];
// The rig a creator layer must be authored on. Fused bodies (src/lib/fusedCharacterFlag.js) use their own ids, so a
// layer made for the v5 bodies is refused instead of binding to the wrong skeleton.
export const RIG_IDS = FUSED_CHARACTERS_ENABLED ? FUSED_RIG_IDS : V5_RIG_IDS;
// Creator-only bodies (tools/avatar-fuse). They are previewed and saved in the
// creator, while account layer assets continue to use the existing feature-flagged RIG_IDS contract. The server only
// resolves uploaded catalog layers for RIG_IDS, so built-in fused layers are
// kept client-side (see saveAppearance.js). Game 3D keeps the v5 bodies until
// the fused bodies have retargeted animation clips.
// The creator previews the SAME animated body the world renders (v2), so a
// saved Eve/Adam never changes shape or rig between the studio and Game 3D.
export const CREATOR_BODIES = {
 'fused-female-v1':{id:'fused-female-v1',gender:'female',label:'Eve',detail:'Fused female',url:'/models/characters/fused/Female_Fused_v2.glb',rig_id:'fused-female-v1'},
 'fused-male-v1':{id:'fused-male-v1',gender:'male',label:'Adam',detail:'Fused male',url:'/models/characters/fused/Male_Fused_v2.glb',rig_id:'fused-male-v1'},
};
export const FUSED_MANIFESTS = {hair:'/models/characters/fused/hair/manifest.json',tattoo:'/models/characters/fused/tattoos/manifest.json',armor:'/models/characters/fused/armor/manifest.json'};
export function creatorBody(appearance={}) {
 const body=CREATOR_BODIES[appearance?.creator_body];
 return body&&body.gender===(appearance.gender==='female'?'female':'male')?body:null;
}
export function creatorRigId(appearance={}) {
 return creatorBody(appearance)?.rig_id||RIG_IDS[appearance?.gender==='female'?'female':'male'];
}
// Expression preview (FX_ shape keys). Preview only: never saved, never part of
// SHAPE_CONTROLS, and absent bodies simply hide the tab's sliders.
export const EXPRESSION_CONTROLS = [
 {id:'smile',label:'Smile',morphs:['FX_Smile_L','FX_Smile_R']},
 {id:'blink',label:'Blink',morphs:['FX_Blink_L','FX_Blink_R']},
 {id:'brow_up',label:'Brow raise',morphs:['FX_BrowUp_L','FX_BrowUp_R']},
 {id:'brow_down',label:'Brow furrow',morphs:['FX_BrowDown']},
 {id:'cheek_puff',label:'Cheek puff',morphs:['FX_CheekPuff']},
 {id:'jaw_open',label:'Open mouth',morphs:['FX_JawOpen']},
 {id:'pucker',label:'Pucker',morphs:['FX_MouthPucker']},
 {id:'squint',label:'Squint',morphs:['FX_Squint_L','FX_Squint_R']},
 {id:'eye_wide',label:'Wide eyes',morphs:['FX_EyeWide_L','FX_EyeWide_R']},
 {id:'frown',label:'Frown',morphs:['FX_Frown_L','FX_Frown_R']},
 {id:'sneer',label:'Sneer',morphs:['FX_Sneer_L','FX_Sneer_R']},
 {id:'brow_inner',label:'Worried brow',morphs:['FX_BrowInnerUp']},
 {id:'lip_press',label:'Press lips',morphs:['FX_MouthPress']},
 {id:'mouth_stretch',label:'Grimace',morphs:['FX_MouthStretch']},
];
export const EXPRESSION_PRESETS = [
 {id:'neutral',label:'Neutral',values:{}},
 {id:'warm',label:'Warm',values:{smile:.75,brow_up:.25}},
 {id:'wink',label:'Wink',values:{smile:.5},morphs:{FX_Blink_L:1}},
 {id:'focus',label:'Focus',values:{brow_down:.7}},
 {id:'surprise',label:'Surprise',values:{brow_up:1,jaw_open:.45}},
 {id:'puff',label:'Puff',values:{cheek_puff:1}},
 // combat and story moods (same blends as faceMoods.js uses in Game 3D)
 {id:'fierce',label:'Fierce',values:{brow_down:.85,squint:.55,sneer:.35,lip_press:.6,frown:.2}},
 {id:'pain',label:'Pain',values:{brow_inner:.9,brow_down:.35,squint:.8,mouth_stretch:.7,frown:.35,jaw_open:.15}},
 {id:'sad',label:'Sad',values:{brow_inner:.8,frown:.6,lip_press:.2}},
 {id:'angry',label:'Angry',values:{brow_down:1,squint:.4,sneer:.6,frown:.5,mouth_stretch:.3}},
 {id:'shout',label:'Battle cry',values:{brow_down:.8,squint:.5,jaw_open:.75,mouth_stretch:.5,sneer:.3}},
];
export function expressionMorphs(values={},extra={}) {
 const out={};
 for(const c of EXPRESSION_CONTROLS){const v=bound(values[c.id],0,1,0);if(v>0)c.morphs.forEach(m=>{out[m]=v;});}
 for(const [k,v] of Object.entries(extra||{}))if(/^FX_[A-Za-z_]+$/.test(k))out[k]=bound(v,0,1,0);
 return out;
}
// Creator extras that ride along with the appearance (client and local Game 3D
// characters). The server's normalizeAvatarAppearance does not persist them yet.
export function normalizeCreatorExtras(value={}) {
 const a=value&&typeof value==='object'?value:{};
 const gender=a.gender==='female'?'female':'male';
 const body=CREATOR_BODIES[a.creator_body];
 return {
  creator_body:body&&body.gender===gender?body.id:'',
  skin_tint_strength:bound(a.skin_tint_strength,0,1,1),
 };
}
const bound=(v,min,max,f)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):f;
const color=(v,f)=>/^#[a-f0-9]{6}$/i.test(String(v||''))?v:f;
export function normalizeCustomization(value={}) {
 const a=value&&typeof value==='object'?value:{};
 const chosen=a.selected_assets&&typeof a.selected_assets==='object'?a.selected_assets:{};
 return {
  customization_version:1,
  selected_assets:Object.fromEntries(CUSTOMIZATION_SLOTS.filter(s=>/^[a-zA-Z0-9_-]{1,100}$/.test(String(chosen[s]||''))).map(s=>[s,String(chosen[s])])),
  shape_controls:Object.fromEntries(SHAPE_CONTROLS.map(c=>[c.id,bound(a.shape_controls?.[c.id],c.min??0,1,0)])),
  // Pigment controls remain distinct from gloss and are normalized on both
  // client and server, including characters saved across sessions.
  makeup_enabled:a.makeup_enabled===true,
  makeup_strength:bound(a.makeup_strength,0,1,.55),
  makeup_lip_color:color(a.makeup_lip_color,'#a4495c'),
  makeup_blush_color:color(a.makeup_blush_color,'#c47776'),
  makeup_eye_color:color(a.makeup_eye_color,'#66516b'),
  skin_finish:bound(a.skin_finish,0,1,.35),
  skin_finish_enabled:a.skin_finish_enabled===true,
  skin_highlight_color:color(a.skin_highlight_color,'#fff3e5'),
  skin_highlight_enabled:a.skin_highlight_enabled===true,
  layer_colors:Object.fromEntries(CUSTOMIZATION_SLOTS.filter(s=>/^#[a-f0-9]{6}$/i.test(String(a.layer_colors?.[s]||''))).map(s=>[s,a.layer_colors[s]])),
  layer_opacity:Object.fromEntries(['tattoo','complexion'].map(s=>[s,bound(a.layer_opacity?.[s],0,1,s==='tattoo'?.75:1)])),
 };
}
export function isAvatarAssetUrl(value) {
 const s=String(value||'');
 return /^https:\/\/base44\.app\/api\/apps\/6876751a602125f45f1861b9\/files\//.test(s)
  || /^\/models\/[a-zA-Z0-9_./-]+$/.test(s)&&!s.includes('..');
}
const names=value=>Array.isArray(value)?[...new Set(value.filter(v=>typeof v==='string'&&v.length>0&&v.length<=100))].slice(0,32):[];
export function normalizeCustomizationAsset(input={}) {
 const a=input&&typeof input==='object'?input:{};
 const fail=message=>{throw new Error(message);};
 if(!String(a.name||'').trim()||String(a.name).length>70)fail('Enter an asset name up to 70 characters.');
 if(!CUSTOMIZATION_SLOTS.includes(a.slot))fail('Choose a supported customization slot.');
 if(!['male','female'].includes(a.gender))fail('Choose the body this asset was authored for.');
 const binding=['skinned','socket','surface'].includes(a.binding)?a.binding:'skinned';
 if(!isAvatarAssetUrl(a.file_url))fail('Upload this asset to the app first.');
 if(binding==='surface'&&!['tattoo','complexion'].includes(a.slot))fail('Surface layers must use the tattoo or complexion slot.');
 if(binding==='surface'&&!/\.(png|webp)(?:[?#].*)?$/i.test(a.file_url))fail('Use a transparent PNG or WebP exported for the body UVs.');
 if(binding!=='surface'&&!/\.glb(?:[?#].*)?$/i.test(a.file_url))fail('Use a self-contained GLB.');
 if(binding==='socket'&&!String(a.attach_bone||'').trim())fail('A rigid attachment needs its exact bone name.');
 const target_meshes=names(a.target_meshes);
 if(binding==='surface'&&!target_meshes.length)fail('Specify the exact body mesh names for the surface layer.');
 return {
  name:String(a.name).trim(),slot:a.slot,gender:a.gender,rig_id:RIG_IDS[a.gender],binding,file_url:String(a.file_url).slice(0,1200),
  thumbnail_url:isAvatarAssetUrl(a.thumbnail_url)?a.thumbnail_url:'',
  description:String(a.description||'').trim().slice(0,300),published:a.published===true,
  attach_bone:binding==='socket'?String(a.attach_bone).trim().slice(0,100):'',
  hide_meshes:binding==='surface'?[]:names(a.hide_meshes),target_meshes,
  tint_materials:names(a.tint_materials),
 };
}