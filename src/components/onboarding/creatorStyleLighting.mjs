// Lighting grade for fused character-creator preview. Unlike the UI-only
// style chips, these values are applied to the actual lit 3D model. They do
// not overwrite a user's complexion, pigment, or hair-colour selection.
export const CREATOR_STYLE_LOOKS=Object.freeze({
 heroic_fantasy:{key:'#fff2e6',rim:'#a9c8ff',exposure:1.02,fill:.7,env:.55},
 graphic_ink:{key:'#f9f9f9',rim:'#f5f5f5',exposure:1.1,fill:.82,env:.4},
 grounded_rpg:{key:'#f9dfb8',rim:'#8fa190',exposure:.93,fill:.58,env:.48},
 spiritual_sumi_e:{key:'#f3ede2',rim:'#9eafc8',exposure:1.02,fill:.66,env:.39},
 anime:{key:'#fff0e7',rim:'#86c8ff',exposure:1.12,fill:.92,env:.64},
 watercolor:{key:'#ffe8e5',rim:'#bdc9ea',exposure:1.14,fill:.86,env:.7},
 noir:{key:'#e9eef4',rim:'#a2b0c0',exposure:.82,fill:.38,env:.3},
 neon:{key:'#ffb6ed',rim:'#4acbff',exposure:1.12,fill:.45,env:.54},
});
const CULTURE_ACCENTS=Object.freeze({
 egyptian:'#d6ae63',greek:'#b9d5db',roman:'#cb9178',
 american:'#b4c8e2',korean:'#c6b5e9',japanese:'#b1d0c1',
 spiritual:'#9bbdff',
});
export function creatorStageLook(config={}){
 const look=CREATOR_STYLE_LOOKS[config.style_preset]||CREATOR_STYLE_LOOKS.heroic_fantasy;
 const influences=Array.isArray(config.cultural_inspirations)?config.cultural_inspirations:[];
 const first=influences.find(id=>Object.hasOwn(CULTURE_ACCENTS,id));
 return {...look,accent:first?CULTURE_ACCENTS[first]:look.rim,accentBlend:first ? .32 : 0};
}
