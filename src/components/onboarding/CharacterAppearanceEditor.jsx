import {Check, Layers3} from 'lucide-react';
import {SHAPE_CONTROLS,CREATOR_BODIES,EXPRESSION_CONTROLS,EXPRESSION_PRESETS,creatorBody} from '@/components/onboarding/avatarCustomization';
import { CREATOR_BODY_PRESETS, CREATOR_BODY_SHAPE_IDS, applyCreatorBodyPreset } from './creatorBodyQuality.mjs';
import {AVATAR_STYLE_PRESETS,COMPANION_MODELS,DEFAULT_AVATAR_APPEARANCE} from './genesisAssets';
import {useCustomizationCatalog} from './useCustomizationCatalog';
import {useBuiltinLayers} from './creatorBuiltinLayers';
import GenesisFaceScan from './GenesisFaceScan';
import CulturalInspirationSelector from './CulturalInspirationSelector';
import {regionColorKey} from './bodyRegions.js';
import {MAKEUP_COLORS} from './creatorMakeup.js';
import {BodyGlyph,ChestGlyph,ExpressionGlyph,FaceGlyph,GlossGlyph,GlutesGlyph,HairGlyph,HeightGlyph,InfluenceGlyph,OutfitGlyph,SkinGlyph,StyleGlyph,TattooGlyph} from './creatorIcons';
import './character-creator.css';

// One rail entry per category. shot: the camera framing the stage eases to.
export const CREATOR_SECTIONS=[
 {id:'body',label:'Body',icon:BodyGlyph,shot:'body'},
 {id:'face',label:'Face',icon:FaceGlyph,shot:'face'},
 {id:'skin',label:'Complexion & Skin',icon:SkinGlyph,shot:'head'},
 {id:'hair',label:'Hair',icon:HairGlyph,shot:'head'},
 {id:'height',label:'Height',icon:HeightGlyph,shot:'body'},
 {id:'chest',label:'Chest',icon:ChestGlyph,shot:'upper'},
 {id:'glutes',label:'Glutes',icon:GlutesGlyph,shot:'hips'},
 {id:'expression',label:'Expression',icon:ExpressionGlyph,shot:'face'},
 {id:'tattoos',label:'Tattoos',icon:TattooGlyph,shot:'back'},
 {id:'makeup',label:'Makeup & Gloss',icon:GlossGlyph,shot:'face'},
 {id:'wardrobe',label:'Outfit',icon:OutfitGlyph,shot:'body'},
 {id:'inspiration',label:'Influences',icon:InfluenceGlyph,shot:'body'},
 {id:'style',label:'Art style',icon:StyleGlyph,shot:'body'},
];
export const creatorShot=id=>(CREATOR_SECTIONS.find(s=>s.id===id)||CREATOR_SECTIONS[0]).shot;
// shapes shown per category (each slider renders only when the loaded body has its CC_ key)
const SHAPES_BY_SECTION={
 body:['body_weight','waist','belly','shoulder_width','muscle_definition','arm_size','thigh_size','calf_size','neck_width'],
 face:['face_width','face_height','forehead_height','forehead_slope','brow_size','brow_height','brow_angle','eye_size','eye_spacing','eye_height','eye_tilt','eye_depth','nose_width','nose_length','nose_bridge','nose_tip','nose_projection','cheek_bone','cheek_height','cheek_puff','jaw_width','jaw_angle','chin_length','chin_width','chin_projection','mouth_width','mouth_height','lip_upper','lip_lower','ear_size','ear_angle'],
 skin:['age'],chest:['chest_size','chest_height','chest_spacing'],glutes:['glute_size','glute_lift','hip_width'],
};
const SKIN=['#f5dccb','#e7c3a3','#d2a080','#b97855','#976441','#714b35','#503326','#32211b'];
const HAIR=['#17191d','#3a281e','#704630','#a36a3b','#d4b278','#e9dfcd','#b64039','#d79aa4','#8670bc','#3e8791','#ececf0','#747d87'];
const EYES=['#4b3527','#98663b','#627342','#41937c','#7aa2c2','#697083','#ac83bf','#dda847'];
const OUTFIT=['#f2f0ea','#1d1f24','#3b4a63','#6b2b2b','#4f5d3a','#8a6a45','#5c3a26','#2f6f73','#7a4f9a','#b8892e'];
const SHEEN=['#ffffff','#fff3e5','#ffe0bd','#f2d6cd','#dcecff'];
const signedShape=v=>Math.abs(v)<.005?'0':(v>0?'+':'−')+Math.round(Math.abs(v)*100);
const percent=v=>Math.round(v*100)+'';

// Every body the creator offers: the two v5 bodies plus the fused creator bodies.
export const CREATOR_BODY_CHOICES=[
 {key:'male',gender:'male',creator_body:'',label:'Getsuga',detail:'Male · animated'},
 {key:'female',gender:'female',creator_body:'',label:'Artemis',detail:'Female · animated'},
 ...Object.values(CREATOR_BODIES).map(b=>({key:b.id,gender:b.gender,creator_body:b.id,label:b.label,detail:b.detail+' · full sculpt'})),
];
export function chooseCreatorBody(current,gender,creator_body='') {
 const body=CREATOR_BODIES[creator_body]?.gender===gender?creator_body:'';
 if(current.gender===gender&&(current.creator_body||'')===body)return current;
 return {...current,gender,creator_body:body,model_url:COMPANION_MODELS[gender].url,female_model_variant:gender==='female'?'artemis_archer':'',
  base_body_gender:gender,base_body_model_url:COMPANION_MODELS[gender].url,selected_assets:{},customization_assets:[],morph_targets:{},shape_controls:{},material_colors:{},face_shape:{},face_fit_source:'manual'};
}
// Select (or clear) one layer per slot. A full outfit and separate top/bottom share body regions.
export function selectLayer(config,slot,asset,known=[]) {
 const selected_assets={...(config.selected_assets||{})};
 if(asset)selected_assets[slot]=asset.id;else delete selected_assets[slot];
 if(slot==='outfit'&&asset){delete selected_assets.top;delete selected_assets.bottom;}
 if(['top','bottom'].includes(slot)&&asset)delete selected_assets.outfit;
 const byId=new Map([...(config.customization_assets||[]),...known,...(asset?[asset]:[])].map(a=>[a.id,a]));
 return {...config,selected_assets,customization_assets:Object.values(selected_assets).map(id=>byId.get(id)).filter(Boolean)};
}
const pick=list=>list[Math.floor(Math.random()*list.length)];
const spread=(scale=.55)=>Math.round(((Math.random()+Math.random()+Math.random())/1.5-1)*scale*100)/100;
// A believable random character within the shapes and layers this body supports.
export function randomizeAppearance(config,{shapes=[],hair=[],tattoo=[]}={}) {
 const supported=new Set(shapes);
 const shape_controls={...(config.shape_controls||{})};
 SHAPE_CONTROLS.forEach(c=>{if(supported.has(c.id))shape_controls[c.id]=c.min<0?Math.max(c.min,spread(c.id==='body_weight'?.45:.6)):Math.round(Math.random()*.35*100)/100;});
 let next={...config,shape_controls,height_scale:Math.round((.94+Math.random()*.12)*100)/100,
  skin_tint_enabled:true,skin_tone:pick(SKIN),skin_tint_strength:creatorBody(config)?Math.round((.25+Math.random()*.4)*100)/100:1,
  hair_tint_enabled:true,hair_color:pick(HAIR),eye_tint_enabled:true,eye_color:pick(EYES),
  skin_finish_enabled:true,skin_finish:Math.round((.2+Math.random()*.55)*100)/100};
 if(hair.length)next=selectLayer(next,'hair',pick(hair),hair);
 if(tattoo.length)next=selectLayer(next,'tattoo',Math.random()<.45?pick(tattoo):null,tattoo);
 return next;
}

export function CreatorNavigation({section,onChange,sections=CREATOR_SECTIONS}) {
 return <nav className="creator-navigation" aria-label="Character customization categories">{sections.map(({id,label,icon:Icon})=><button type="button" key={id} aria-current={section===id?'page':undefined} title={label} onClick={()=>onChange(id)}><Icon size={20}/><span className="creator-rail-label">{label}</span></button>)}</nav>;
}
function Range({label,value,onChange,min=0,max=1,step=.01,disabled=false,format=percent,signed=false}) {
 const fill=((value-min)/(max-min))*100,zero=signed?((0-min)/(max-min))*100:0;
 return <label className={'creator-range'+(signed?' is-signed':'')} style={{'--fill-from':Math.min(zero,fill)+'%','--fill-to':Math.max(zero,fill)+'%'}}><span>{label}<output>{format(value)}</output></span><input aria-label={label} type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={e=>onChange(Number(e.target.value))} onDoubleClick={()=>onChange(signed?0:min)}/></label>;
}
function Colors({label,value,choices,onChange,disabled=false,onReset}) {
 return <fieldset className="creator-colors" disabled={disabled}><legend>{label}{onReset&&value&&<button type="button" className="creator-color-original" onClick={onReset}>Original</button>}</legend><div>{choices.map((color,i)=><button type="button" key={color} aria-label={label+' preset '+(i+1)} aria-pressed={value?.toLowerCase()===color} style={{'--swatch':color}} onClick={()=>onChange(color)}>{value?.toLowerCase()===color&&<Check size={12}/>}</button>)}<label className="creator-custom-color" title={'Custom '+label.toLowerCase()}><input type="color" aria-label={'Custom '+label.toLowerCase()} value={value||choices[0]} onChange={e=>onChange(e.target.value)}/><span>+</span></label></div></fieldset>;
}
function Group({title,aside,children}) {
 return <section className="creator-group">{title&&<h3>{title}{aside&&<span>{aside}</span>}</h3>}{children}</section>;
}

export default function CharacterAppearanceEditor({config,setConfig,capabilities={},section='body',expression={},onExpressionChange}) {
 const catalog=useCustomizationCatalog();
 const builtin=useBuiltinLayers(config);
 const caps=capabilities.customization||{},supported=new Set(caps.shapes||[]);
 const update=patch=>setConfig(c=>({...c,...patch}));
 const fused=Boolean(creatorBody(config));
 const catalogAssets=(catalog.data?.assets||[]).filter(a=>a.published&&a.gender===config.gender&&!fused);
 const garmentColor=(id,color)=>setConfig(c=>{const material_colors={...(c.material_colors||{})};if(color)material_colors[regionColorKey(id)]=color;else delete material_colors[regionColorKey(id)];return {...c,material_colors};});
 const layer=(slot,title,{extra=[],emptyLabel}={})=>{
  const options=[...extra,...catalogAssets.filter(a=>a.slot===slot)],selected=config.selected_assets?.[slot]||'';
  const choose=asset=>setConfig(c=>selectLayer(c,slot,asset,[...(catalog.data?.assets||[]),...extra]));
  const none=emptyLabel||(['tattoo','accessory','facial_hair','complexion'].includes(slot)?'None':'Original');
  const chosen=options.find(a=>a.id===selected);
  return <Group key={slot} title={title} aside={catalog.isPending&&!extra.length?'…':options.length?String(options.length):''}>
   <div className="creator-layer-grid"><button type="button" aria-pressed={!selected} onClick={()=>choose(null)}><span className="creator-layer-placeholder"><Layers3 size={16} strokeWidth={1.25}/></span><strong>{none}</strong></button>{options.map(a=><button type="button" key={a.id} aria-pressed={selected===a.id} onClick={()=>choose(a)}>{a.thumbnail_url?<img src={a.thumbnail_url} alt="" loading="lazy"/>:<span className="creator-layer-placeholder" aria-hidden="true">{a.name.slice(0,1)}</span>}<strong>{a.name}</strong></button>)}</div>
   {selected&&!chosen&&<p className="creator-notice">This saved layer is not available on this body. Choose {none} to remove it.</p>}
   {chosen&&['tattoo','complexion'].includes(slot)&&<Range label="Opacity" value={config.layer_opacity?.[slot]??(slot==='tattoo'?.75:1)} onChange={value=>update({layer_opacity:{...config.layer_opacity,[slot]:value}})}/>}
   {chosen&&slot!=='hair'&&chosen.tint_materials?.length>0&&<Colors label="Tint" value={config.layer_colors?.[slot]} choices={HAIR} onChange={color=>update({layer_colors:{...config.layer_colors,[slot]:color}})}/>}
  </Group>;
 };
 const shapes=group=>{
  const list=SHAPE_CONTROLS.filter(c=>(SHAPES_BY_SECTION[group]||[]).includes(c.id)&&supported.has(c.id));
  if(!list.length)return <p className="creator-hint">{fused?'Loading shapes…':'This body has no '+(group==='skin'?'age':group)+' shape keys. Choose Eve or Adam under Body to sculpt it.'}</p>;
  return <Group>{list.map(c=><Range key={c.id} label={c.label} min={c.min??0} signed={c.min<0} value={config.shape_controls?.[c.id]||0} onChange={v=>update({shape_controls:{...config.shape_controls,[c.id]:v}})} format={c.min<0?signedShape:percent}/>)}</Group>;
 };
 const expressionKeys=new Set(capabilities.expressions||[]);
 const expressionControls=EXPRESSION_CONTROLS.filter(c=>c.morphs.every(m=>expressionKeys.has(m)));
 const hairTintable=fused||caps.hair||Boolean((config.customization_assets||[]).find(a=>a.id===config.selected_assets?.hair)?.tint_materials?.length);
 return <div className="character-appearance-editor" data-section={section}>
  {catalog.isError&&!fused&&<p className="creator-notice" role="alert">Extra layers could not load. <button type="button" onClick={()=>catalog.refetch()}>Retry</button></p>}
  {section==='body'&&<>
   <Group title="Base"><div className="creator-base-grid">{CREATOR_BODY_CHOICES.map(b=><button type="button" key={b.key} aria-pressed={config.gender===b.gender&&(config.creator_body||'')===b.creator_body} onClick={()=>setConfig(c=>chooseCreatorBody(c,b.gender,b.creator_body))}><strong>{b.label}</strong><small>{b.detail}</small></button>)}</div></Group>
   {fused&&<Group title="Physique presets" aside="Works with the actual body morphs"><div className="creator-physique-presets" role="group" aria-label="Physique presets">{CREATOR_BODY_PRESETS.map(p=><button type="button" key={p.id} disabled={!supported.has('body_weight')||!supported.has('belly')} title={p.description} aria-pressed={supported.has('body_weight')&&supported.has('belly')&&CREATOR_BODY_SHAPE_IDS.filter(id=>supported.has(id)).every(id=>Math.abs((config.shape_controls?.[id]||0)-(p.values[id]||0))<.001)} onClick={()=>setConfig(c=>applyCreatorBodyPreset(c,p.id,capabilities.customization?.shapes||[]))}><strong>{p.label}</strong><small>{p.description}</small></button>)}</div><p className="creator-hint">Full figure and Heavyset expand the waist, sides and upper abdomen as well as the belly; shape sliders below remain adjustable.</p></Group>}
  {shapes('body')}{!fused&&layer('body','Body presets')}
  </>}
  {section==='face'&&<>
   {shapes('face')}
   <Group><Colors label="Eye color" choices={EYES} disabled={!caps.iris} value={config.eye_tint_enabled?config.eye_color:''} onChange={c=>update({eye_tint_enabled:true,eye_color:c})}/></Group>
   {!fused&&layer('eyebrows','Brows')}
   <details className="creator-photo"><summary>Match from a photo</summary><GenesisFaceScan config={config} setConfig={setConfig} capabilities={capabilities}/></details>
  </>}
  {section==='skin'&&<>
   <Group><Colors label="Complexion" choices={SKIN} value={config.skin_tint_enabled?config.skin_tone:''} disabled={!caps.skin} onChange={c=>update({skin_tint_enabled:true,skin_tone:c})} onReset={()=>update({skin_tint_enabled:false})}/>
    {config.skin_tint_enabled&&<Range label="Tint" value={config.skin_tint_strength??1} disabled={!caps.skin} onChange={v=>update({skin_tint_strength:v})}/>}
    {!caps.skin&&<p className="creator-hint">This body has no separate skin material to tint.</p>}</Group>
   {shapes('skin')}
  </>}
  {section==='hair'&&<>
   {layer('hair','Style',{extra:builtin.hair,emptyLabel:fused?'Default':undefined})}
   <Group><Colors label="Hair color" choices={HAIR} disabled={!hairTintable} value={config.hair_tint_enabled?config.hair_color:''} onChange={c=>update({hair_tint_enabled:true,hair_color:c})} onReset={()=>update({hair_tint_enabled:false})}/>{!hairTintable&&<p className="creator-hint">Hair is painted into this body. A fitted hair layer enables color.</p>}</Group>
   {!fused&&layer('facial_hair','Facial hair')}
  </>}
  {section==='height'&&<Group><Range label="Height" min={.84} max={1.18} value={config.height_scale||1} onChange={v=>update({height_scale:v})} format={v=>Math.round(v*172)+' cm'}/><Range label="Frame" min={.88} max={1.12} value={config.body_proportions?.width||1} onChange={v=>update({body_proportions:{...config.body_proportions,width:v}})}/><Range label="Depth" min={.9} max={1.1} value={config.body_proportions?.depth||1} onChange={v=>update({body_proportions:{...config.body_proportions,depth:v}})}/></Group>}
  {section==='chest'&&shapes('chest')}
  {section==='glutes'&&shapes('glutes')}
  {section==='expression'&&<>
   {expressionControls.length?<>
    <div className="creator-chips" role="group" aria-label="Expression presets">{EXPRESSION_PRESETS.map(p=><button type="button" key={p.id} aria-pressed={expression.preset===p.id} onClick={()=>onExpressionChange?.({preset:p.id,values:{...p.values},morphs:{...(p.morphs||{})}})}>{p.label}</button>)}</div>
    <Group>{expressionControls.map(c=><Range key={c.id} label={c.label} value={expression.values?.[c.id]||0} onChange={v=>onExpressionChange?.({preset:'',values:{...(expression.values||{}),[c.id]:v},morphs:{}})}/>)}</Group>
   </>:<p className="creator-hint">This body has no expression keys. Choose Eve or Adam under Body to preview expressions.</p>}
   <p className="creator-microcopy">Preview only · not saved</p>
  </>}
  {section==='tattoos'&&<>
   {layer('tattoo','Design',{extra:builtin.tattoo})}
   {fused&&<Group title="Ink finish">
     <Colors label="Ink colour" choices={['#17232d','#2b4f62','#7e4e34','#9b6e43','#a43f58','#77508c']}
       value={config.layer_colors?.tattoo||''}
       onChange={value=>update({layer_colors:{...config.layer_colors,tattoo:value}})}
       onReset={()=>{const colors={...config.layer_colors};delete colors.tattoo;update({layer_colors:colors});}}/>
     <p className="creator-hint">Choose a design above, then adjust its ink and opacity.</p>
   </Group>}
  </>}
  {section==='makeup'&&<>
   {fused?<Group title="Makeup" aside="Paint">
     <label className="creator-switch"><span>Apply makeup</span><input type="checkbox"
       checked={config.makeup_enabled===true}
       onChange={e=>update({makeup_enabled:e.target.checked})}/></label>
     <Colors label="Lip colour" choices={MAKEUP_COLORS.lip}
       value={config.makeup_lip_color||'#a4495c'} onChange={v=>update({makeup_enabled:true,makeup_lip_color:v})}/>
     <Colors label="Cheek blush" choices={MAKEUP_COLORS.blush}
       value={config.makeup_blush_color||'#c47776'} onChange={v=>update({makeup_enabled:true,makeup_blush_color:v})}/>
     <Colors label="Eye shadow" choices={MAKEUP_COLORS.eye}
       value={config.makeup_eye_color||'#66516b'} onChange={v=>update({makeup_enabled:true,makeup_eye_color:v})}/>
     <Range label="Pigment strength" value={config.makeup_strength??.55}
       onChange={v=>update({makeup_enabled:true,makeup_strength:v})}/>
     <p className="creator-hint">Makeup adds pigment to the head skin. Gloss controls reflected light separately.</p>
    </Group>:layer('complexion','Makeup')}
   <details className="creator-advanced" open={false}>
    <summary>Skin gloss & lighting</summary>
    <Group><Range label="Gloss" disabled={!caps.skin} value={config.skin_finish??.35}
      onChange={v=>update({skin_finish_enabled:true,skin_finish:v})}
      format={v=>v<.3?'Matte':v<.7?'Satin':'Glass'}/>
      <Colors label="Sheen" choices={SHEEN}
       value={config.skin_highlight_enabled?config.skin_highlight_color:''}
       disabled={!caps.skin} onChange={c=>update({skin_highlight_enabled:true,skin_highlight_color:c})}
       onReset={()=>update({skin_highlight_enabled:false})}/>
    </Group>
   </details>
  </>}
  {section==='wardrobe'&&<>
   {caps.garments?.length>0&&<Group title="Colours">{caps.garments.map(g=><Colors key={g.id} label={g.label} choices={OUTFIT} value={config.material_colors?.[regionColorKey(g.id)]||''} onChange={c=>garmentColor(g.id,c)} onReset={()=>garmentColor(g.id,null)}/>)}</Group>}
   {fused?<p className="creator-hint">Fitted outfits for Eve and Adam arrive with their animation set.</p>:<>{layer('outfit','Outfits')}{layer('top','Tops')}{layer('bottom','Bottoms')}{layer('footwear','Footwear')}{layer('accessory','Accessories')}</>}
   {(capabilities.weapon||capabilities.hood)&&<Group title="Gear">{capabilities.weapon&&<label className="creator-switch"><span>Weapon</span><input type="checkbox" checked={config.weapon_visible!==false} onChange={e=>update({weapon_visible:e.target.checked})}/></label>}{capabilities.hood&&<label className="creator-switch"><span>Hood</span><input type="checkbox" checked={config.hood_enabled!==false} onChange={e=>update({hood_enabled:e.target.checked})}/></label>}</Group>}
  </>}
  {section==='inspiration'&&<CulturalInspirationSelector config={config} setConfig={setConfig}/>}
  {section==='style'&&<div className="creator-style-grid">{AVATAR_STYLE_PRESETS.map(s=><button type="button" key={s.id} aria-pressed={(config.style_preset||'heroic_fantasy')===s.id} onClick={()=>update({style_preset:s.id})}><span className={'creator-style-orb style-'+s.id}/><span><strong>{s.name}</strong><small>{s.short}</small></span></button>)}</div>}
  <button type="button" className="creator-reset" onClick={()=>setConfig(c=>({...c,...DEFAULT_AVATAR_APPEARANCE,gender:c.gender,creator_body:c.creator_body,selected_assets:{},customization_assets:[]}))}>Restore original</button>
 </div>;
}
