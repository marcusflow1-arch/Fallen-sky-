// Pure Game 3D Escape-menu navigation contract; no React, DOM or Game 2 code.
// The MMO's live world is never stopped by the UI. Only local gameplay input
// is suppressed while the player's menu is visible.
export const GAME3D_PAUSE_SECTIONS=Object.freeze([
  {id:'overview',label:'Main Menu',description:'Return to your adventure'},
  {id:'audio',label:'Audio',description:'Theme volume'},
  {id:'controls',label:'Controls',description:'Movement and interactions'},
  {id:'graphics',label:'Graphics',description:'Rendering and art style'},
  {id:'session',label:'Session',description:'Character and account'},
]);
const sections=new Set(GAME3D_PAUSE_SECTIONS.map(s=>s.id));
export function game3dPauseSection(value){
  return sections.has(value)?value:'overview';
}
export function game3dPauseEscape(view,confirmAction=null){
  // ESC cancels dangerous logout/exit confirmation before any other action.
  if(confirmAction)return {close:false,view:game3dPauseSection(view),confirmAction:null};
  if(game3dPauseSection(view)!=='overview')
    return {close:false,view:'overview',confirmAction:null};
  return {close:true,view:'overview',confirmAction:null};
}
export function game3dPauseGraphicsDefaults(raw){
  const value=raw&&typeof raw==='object'?raw:{};
  return {
    ...value,
    artStyle:['original','ink','atomic-ultra-sumi'].includes(value.artStyle)?value.artStyle:'ink',
    inkPalette:value.inkPalette==='classic'?'classic':'vibrant',
    quality:['low','medium','high','ultra'].includes(value.quality)?value.quality:'high',
    shadows:typeof value.shadows==='boolean'?value.shadows:true,
    fpsCap:[30,60,120,144].includes(value.fpsCap)?value.fpsCap:60,
  };
}
