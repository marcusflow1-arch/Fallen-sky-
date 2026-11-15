import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  MINI_GAMES,MINI_GAME_IDS,miniGameById,miniGameReadiness,
  miniGameEventOpen,validMiniGameRole,
} from '../base44/shared/game3dMiniGameCatalog.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('all nine requested mini games are available exactly once',()=>{
  assert.deepEqual([...MINI_GAME_IDS].sort(),[
    'basketball','checkers','chess','football','palm-clash',
    'soccer','sumo','tennis','volleyball'].sort());
  assert.equal(new Set(MINI_GAME_IDS).size,9);
  for(const game of MINI_GAMES){
    assert.equal(miniGameById(game.id),game);
    assert.ok(game.minPlayers>=2&&game.maxPlayers>=game.minPlayers);
    assert.ok(game.icon&&game.name&&game.category&&game.arena);
  }
  assert.equal(miniGameById('power-slap'),null,
    'Use original Palm Clash name and gameplay design rather than a licensed brand');
});
test('spectators cannot start an event and a player is counted only once',()=>{
  const r=[
    {user_id:'a',status:'active',role:'player'},
    {user_id:'a',status:'active',role:'player'},
    {user_id:'b',status:'active',role:'spectator'},
    {user_id:'c',status:'left',role:'player'},
  ];
  const count=miniGameReadiness('chess',r);
  assert.equal(count.players,1);
  assert.equal(count.spectators,1);
  assert.equal(count.remaining,1);
  assert.equal(count.ready,false);
  assert.equal(miniGameReadiness('chess',[...r,{user_id:'d',role:'player',status:'active'}]).ready,true);
});
test('signup status is open only during an authorized event window',()=>{
  const clock=Date.parse('2026-11-14T20:00:00Z');
  assert.equal(miniGameEventOpen({status:'open',expires_at:'2026-11-14T21:00:00Z'},clock),true);
  assert.equal(miniGameEventOpen({status:'closed',expires_at:'2026-11-14T21:00:00Z'},clock),false);
  assert.equal(miniGameEventOpen({status:'open',expires_at:'2026-11-14T19:00:00Z'},clock),false);
  assert.equal(validMiniGameRole('player'),true);
  assert.equal(validMiniGameRole('spectator'),true);
  assert.equal(validMiniGameRole('winner'),false);
});
test('HUD launcher opens a modal, suppresses controls and has all lobby actions',()=>{
  const page=read('src/pages/GameView.jsx');
  const hub=read('src/components/game3d/minigames/MiniGamesHub.jsx');
  const style=read('src/components/game3d/minigames/MiniGamesHub.css');
  assert.ok(page.includes('MiniGamesHub userId={user?.id} showLauncher={communityHUD.miniGames}'));
  const settings=read('src/components/game3d/hud/game3dCommunityHUDSettings.mjs');
  const pause=read('src/components/game3d/PauseMenu.jsx');
  assert.match(settings,/miniGames: true/);
  assert.match(pause,/label="Mini Games events button"/);
  assert.match(page,/ChronicleBlueprintLibrary/);
  assert.match(hub,/className="axe-minigames-launch"/);
  assert.match(hub,/role="dialog" aria-modal="true"/);
  assert.match(hub,/__axeUiModalOpen=true/);
  assert.match(hub,/document.exitPointerLock\?\.\(\)/);
  assert.match(hub,/run\('create',\{gameId\}\)/);
  assert.match(hub,/run\('rsvp',\{eventId:event.id,role:'player'\}\)/);
  assert.match(hub,/run\('rsvp',\{eventId:event.id,role:'spectator'\}\)/);
  assert.match(hub,/run\('leave',\{eventId:event.id\}\)/);
  assert.match(hub,/run\('cancel',\{eventId:event.id\}\)/);
  assert.match(style,/left:clamp\(231px,17vw,259px\)/);
});
test('arena stage preview is procedural, distinct for tabletop and sport courts',()=>{
  const arena=read('src/components/game3d/minigames/miniGameArena.mjs');
  const preview=read('src/components/game3d/minigames/MiniGameArenaPreview.jsx');
  assert.match(arena,/export function buildMiniGameArena/);
  assert.match(arena,/gameId==='sumo'/);
  assert.match(arena,/gameId==='palm-clash'/);
  assert.match(arena,/gameId==='chess'\|\|gameId==='checkers'/);
  assert.match(arena,/new THREE\.BoxGeometry/);
  assert.match(arena,/previewOnly:true,collisionEnabled:false/);
  assert.match(preview,/disposeMiniGameArena/);
  assert.doesNotMatch(arena,/\.glb|\.gltf|\.fbx|TextureLoader|GLTFLoader/);
});
test('server validates game and role, uses signed-in identity and never awards winners',()=>{
  const server=read('base44/functions/game3dMiniGames/entry.ts');
  const eventSchema=read('base44/entities/Game3DMiniEvent.jsonc');
  const rsvpSchema=read('base44/entities/Game3DMiniRSVP.jsonc');
  assert.match(server,/app\.auth\.me\(\)/);
  assert.match(server,/app\.asServiceRole\.entities/);
  assert.match(server,/miniGameById\(data\.gameId\)/);
  assert.match(server,/validMiniGameRole\(role\)/);
  assert.match(server,/count\.players>=game\.maxPlayers/);
  assert.match(server,/if\(event\.host_id!==me\)/);
  assert.doesNotMatch(server,/awardXP|winner_id|RewardGrant\.create/);
  for(const schema of [eventSchema,rsvpSchema]){
    const parsed=JSON.parse(schema);
    assert.equal(parsed.rls.create.user_condition.role,'admin');
    assert.equal(parsed.rls.update.user_condition.role,'admin');
    assert.equal(parsed.rls.read.user_condition.role,'admin');
  }
});
