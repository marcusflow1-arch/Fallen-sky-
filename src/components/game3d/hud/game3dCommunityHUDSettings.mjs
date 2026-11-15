// Shared Game 3D community/HUD visibility and presentation preferences.
// Browser-local only: never changes multiplayer, presence, chat data, or Echo consent.
export const GAME3D_COMMUNITY_HUD_KEY = 'game3d_community_hud_v1';
export const GAME3D_COMMUNITY_HUD_EVENT = 'game3dCommunityHUDChanged';
export const GAME3D_COMMUNITY_HUD_DEFAULTS = Object.freeze({
  chat: true,
  echo: true,
  miniGames: true,
  online: true, // requested slim live count above the unchanged upper-left portrait
  scale: 1,
});
export function normalizeGame3DCommunityHUD(value) {
  const input = value && typeof value === 'object' ? value : {};
  const rawScale = Number(input.scale);
  return {
    chat: typeof input.chat === 'boolean' ? input.chat : GAME3D_COMMUNITY_HUD_DEFAULTS.chat,
    echo: typeof input.echo === 'boolean' ? input.echo : GAME3D_COMMUNITY_HUD_DEFAULTS.echo,
    miniGames: typeof input.miniGames === 'boolean' ? input.miniGames : GAME3D_COMMUNITY_HUD_DEFAULTS.miniGames,
    online: typeof input.online === 'boolean' ? input.online : GAME3D_COMMUNITY_HUD_DEFAULTS.online,
    scale: Number.isFinite(rawScale) ? Math.max(.75, Math.min(1.25, Math.round(rawScale*20)/20)) : 1,
  };
}
export function readGame3DCommunityHUD(storage = globalThis.localStorage) {
  try { return normalizeGame3DCommunityHUD(JSON.parse(storage?.getItem?.(GAME3D_COMMUNITY_HUD_KEY) || 'null')); }
  catch { return normalizeGame3DCommunityHUD(null); }
}
export function saveGame3DCommunityHUD(value, storage = globalThis.localStorage) {
  const next = normalizeGame3DCommunityHUD(value);
  try { storage?.setItem?.(GAME3D_COMMUNITY_HUD_KEY, JSON.stringify(next)); }
  catch { /* private browsing/storage denial does not prevent an immediate UI change */ }
  return next;
}
