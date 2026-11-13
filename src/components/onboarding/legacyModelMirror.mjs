// Temporary read-only bridge while GitSync Pro receives the original binary
// character assets. This only admits the owner's exact, publicly published
// Atom X Eve OS build and the nine known Game 3D character models. Never
// accept a model URL from a saved player record or an arbitrary host.
export const ORIGINAL_GAME3D_SITE = 'https://atomxeveos.base44.app';
const MODEL_PATHS = new Set([
  '/models/characters/Artemis_Character_v2.glb',
  '/models/characters/Artemis_Character_v3.glb',
  '/models/characters/Artemis_Character_v5.glb',
  '/models/characters/Getsuga_Tensho_Character_v3.glb',
  '/models/characters/Getsuga_Tensho_Character_v5.glb',
  '/models/characters/fused/Female_Fused_v1.glb',
  '/models/characters/fused/Female_Fused_v2.glb',
  '/models/characters/fused/Male_Fused_v1.glb',
  '/models/characters/fused/Male_Fused_v2.glb',
]);
export function originalGame3DModelUrl(path) {
  const normalized = typeof path === 'string' ? path.split(/[?#]/)[0] : '';
  return MODEL_PATHS.has(normalized) ? ORIGINAL_GAME3D_SITE + normalized : null;
}
export const REQUIRED_GAME3D_MODEL_PATHS = Object.freeze([...MODEL_PATHS]);
