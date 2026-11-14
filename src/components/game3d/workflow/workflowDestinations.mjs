import { createTileGrid, tileFromId } from '../../worldTileEditor/tileGrid.mjs';
import { sectionFromId, SECTION_STORAGE_KEY } from '../wolfveil/preview/wolfveilSectionGrid.mjs';
import { insideWolfveilClientGround } from '../wolfveil/WolfveilTravelSafety.mjs';
import { LUNAR_CAVE_ENTRANCE } from '../dungeons/LunarCaveLayout.mjs';
import {VORTEX_LAKE} from '../wolfveil/VortexLakeLayout.mjs';
import { ASTRAL_DUNGEON_REGION,ASTRAL_DUNGEON_TITLE,ASTRAL_PADS } from '../dungeons/AstralDungeonLayout.mjs';

// The current Play mesh uses world X/Z metres and the Wolfveil +70m Z offset.
// Tile IDs are NOT geographic latitude/longitude.
export const WOLFVEIL_WORKFLOW_GRID = createTileGrid(
  { minX: -550, maxX: 550, minZ: -480, maxZ: 620 }, 5,
);
export const WORKFLOW_LAST_REPORTED_TILE = 'X87-Z70';
// A stable world-space landmark, intentionally independent from terrain tile IDs.
export const WORKFLOW_DUNGEON_ENTRANCE_ID = 'dungeon-entrance';
export const WORKFLOW_VORTEX_LAKE_ID='vortex-lake';
export const WORKFLOW_ASTRAL_DUNGEON_ID = 'moonfall-expanse';

// Reviewed Wolfveil single-square claims snapshot (2026-11-09).
// The claim issue remains the status authority; source-QA estimates are not
// live Play acceptance and this list is not an automatic GitHub activity feed.
// All positions are world-space Play X/Z, including the one-time +70m Z offset.
export const WORKFLOW_REPORTED_AREAS = Object.freeze([
  { id: 'T07-05', label: 'West forest understory', sourceQa: 88, issue: 1292, pr: 1335 },
  { id: 'WV-R06-C02', label: 'Western forest lawn', sourceQa: 88, issue: 1291, pr: 1326 },
  { id: 'X40-Z123', label: 'West hillside grass', sourceQa: 87, issue: 1270, pr: 1331 },
  { id: 'X87-Z70', label: 'Southern meadow lawn', sourceQa: 87, issue: 1296, pr: 1299 },
  { id: 'X100-Z189', label: 'Northern rocky woodland', sourceQa: 87, issue: 1295, pr: 1334 },
  { id: 'X64-Z130', label: 'West cedar forest floor', sourceQa: 82, issue: 1283, pr: 1288 },
  { id: 'X49-Z113', label: 'Western forest-floor detail', sourceQa: 70, issue: 1284, pr: 1332 },
  { id: 'WV-R08-C10', label: 'Southeast meadow and stones', sourceQa: 65, issue: 1282, pr: 1333 },
  { id: 'X46-Z116', label: 'West forest-floor art QA', sourceQa: 35, issue: 1293, pr: 1338 },
]);

// T07-05 belongs to the separate 10m precision blueprint; it is not an X/Z
// index in the 5m Play grid or a 100m WV section.
const WORKFLOW_PRECISION_TILES = Object.freeze({
  'T07-05': Object.freeze({
    minX: -210, maxX: -200, minZ: 180, maxZ: 190,
    centerX: -205, centerZ: 185,
  }),
});


const finite = (n) => Number.isFinite(n);
const rounded = (n) => Math.round(n * 100) / 100;
function fromCell(cell, kind) {
  if (!cell || !insideWolfveilClientGround(cell.centerX, cell.centerZ, 2)) return null;
  return {
    id: cell.id, kind, x: cell.centerX, z: cell.centerZ,
    minX: cell.minX, maxX: cell.maxX, minZ: cell.minZ, maxZ: cell.maxZ,
  };
}

/** Accept canonical 5m tile IDs, 100m WIP square IDs and Play world coordinates. */
export function resolveWorkflowDestination(value) {
  if (typeof value !== 'string' || value.length > 90) return null;
  const text = value.trim();
  const tileId = text.toUpperCase().replace(/\s+/g, '');
  const landmarkName = text.toLowerCase().replace(/[\s_]+/g, '-');
  if(['moonfall','moonfall-expanse','astral-dungeon','space-dungeon','moon-dungeon'].includes(landmarkName)){
    // A self-contained Game 3D map instance, not a Wolfveil terrain square.
    return {id:WORKFLOW_ASTRAL_DUNGEON_ID,kind:'region',region:ASTRAL_DUNGEON_REGION,
      area:ASTRAL_DUNGEON_TITLE,status:'Preview · four moonlit circular platforms · Lv 45+',
      x:ASTRAL_PADS[0].x,z:ASTRAL_PADS[0].z,minX:0,maxX:0,minZ:0,maxZ:0};
  }
  if(['vortex','vortex-lake','living-lake','world-beneath-world'].includes(landmarkName)){
    // Spawn on the registered bridge; never spawn inside the deep whirlpool.
    const {x,z}=VORTEX_LAKE.safeReturn;
    if(!insideWolfveilClientGround(x,z,2))return null;
    return {id:WORKFLOW_VORTEX_LAKE_ID,kind:'landmark',
      area:'Living Perspectives Vortex Lake',
      status:'Preview · 3D mountain water passage · exploration portal',
      x,z,minX:x,maxX:x,minZ:z,maxZ:z};
  }
  if (['dungeon', 'dungeon-entrance', 'lunar-cave', 'lunar-mountain-gate'].includes(landmarkName)) {
    // Spawn on the natural approach OUTSIDE the portal, never inside the rock.
    // Keep this position coupled to the actual Lunar Cave entrance layout.
    const x = LUNAR_CAVE_ENTRANCE.approachX, z = LUNAR_CAVE_ENTRANCE.approachZ;
    if (!insideWolfveilClientGround(x, z, 2)) return null;
    return {
      id: WORKFLOW_DUNGEON_ENTRANCE_ID, kind: 'landmark',
      area: 'Dungeon Entrance', status: 'Lunar Cave · outside mountain portal',
      x, z, minX: x, maxX: x, minZ: z, maxZ: z,
    };
  }
  if (WORKFLOW_PRECISION_TILES[tileId])
    return fromCell({ id: tileId, ...WORKFLOW_PRECISION_TILES[tileId] }, 'tile-10m');
  if (/^X\d+-Z\d+$/.test(tileId))
    return fromCell(tileFromId(WOLFVEIL_WORKFLOW_GRID, tileId), 'tile-5m');
  if (/^WV-R\d{2}-C\d{2}$/.test(tileId))
    return fromCell(sectionFromId(tileId), 'section-100m');

  // "X -112.5, Z -127.5", "X=-112.5 Z=-127.5" or "-112.5, -127.5".
  const labelled = /^X\s*[:=]?\s*(-?\d+(?:\.\d+)?)\s*[,;\s]+\s*Z\s*[:=]?\s*(-?\d+(?:\.\d+)?)$/i.exec(text);
  const plain = /^(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)$/.exec(text);
  const pair = labelled || plain;
  if (!pair) return null;
  const x = Number(pair[1]), z = Number(pair[2]);
  if (!finite(x) || !finite(z) || !insideWolfveilClientGround(x, z, 2)) return null;
  return { id: `X ${rounded(x)}, Z ${rounded(z)}`, kind: 'coordinates',
    x, z, minX: x, maxX: x, minZ: z, maxZ: z };
}

function safeParse(raw) {
  if (typeof raw !== 'string' || raw.length > 200_000) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/** The preview planner is local-only; do not misrepresent its state as live GitHub CI. */
export function listWorkflowDestinations(read = (key) =>
  typeof window === 'undefined' ? null : window.localStorage.getItem(key)) {
  const items = [];
  const seen = new Set();
  const vortex=resolveWorkflowDestination(WORKFLOW_VORTEX_LAKE_ID);
  if(vortex){items.push({...vortex,source:'clone-preview'});seen.add(vortex.id);}
  for (const reported of WORKFLOW_REPORTED_AREAS) {
    const destination = resolveWorkflowDestination(reported.id);
    if (!destination) continue; // Never list an unsafe or invalid location.
    items.push({
      ...destination,
      area: reported.label,
      sourceQa: reported.sourceQa,
      issueUrl: `https://github.com/marcusflow1-arch/atom-x-eve-os/issues/${reported.issue}`,
      prUrl: `https://github.com/marcusflow1-arch/atom-x-eve-os/pull/${reported.pr}`,
      status: `~${reported.sourceQa}% reported source QA · Play not certified`,
      source: 'claim-snapshot',
    });
    seen.add(destination.id);
  }
  // Keep the historical fallback if a future claim snapshot omits the last tile.
  const last = resolveWorkflowDestination(WORKFLOW_LAST_REPORTED_TILE);
  if (last && !seen.has(last.id)) {
    items.push({ ...last, status: 'Last reported work square', source: 'reported' });
    seen.add(last.id);
  }
  let stored = null;
  try { stored = safeParse(read(SECTION_STORAGE_KEY)); } catch { /* storage disabled */ }
  const states = stored?.states && typeof stored.states === 'object' ? stored.states : {};
  for (const [id, state] of Object.entries(states)) {
    if (state !== 'in-progress' && state !== 'needs-review') continue;
    const item = resolveWorkflowDestination(id);
    if (item && !seen.has(item.id)) items.push({
      ...item, status: state === 'in-progress' ? 'In progress · local plan' : 'Needs review · local plan',
      source: 'local-plan',
    });
  }
  return items.slice(0, 125);
}

/** Pick an actual ground point inside the requested square, never a blind Y=0 warp.
 * Coordinates are exact; tiles/squares can scan their own interior for a safe spot.
 */
export function findWorkflowSpawn(destination, {
  sampleGroundY, isBlocked = () => false, insideGround = insideWolfveilClientGround,
} = {}) {
  const target = resolveWorkflowDestination(typeof destination === 'string' ? destination : destination?.id);
  if (!target || target.kind==='region' || typeof sampleGroundY !== 'function' || typeof isBlocked !== 'function') return null;
  const spanX = target.maxX - target.minX;
  const spanZ = target.maxZ - target.minZ;
  const offsets = target.kind === 'coordinates' || target.kind === 'landmark' ? [[0, 0]] : [
    [0, 0], [-.20, 0], [.20, 0], [0, -.20], [0, .20],
    [-.20, -.20], [-.20, .20], [.20, -.20], [.20, .20],
    [-.35, 0], [.35, 0], [0, -.35], [0, .35],
  ];
  for (const [ox, oz] of offsets) {
    const x = target.x + ox * spanX, z = target.z + oz * spanZ;
    if (!insideGround(x, z, 2) || isBlocked(x, z)) continue;
    const y = sampleGroundY(x, z);
    if (!finite(y)) continue;
    return { id: target.id, x, y, z };
  }
  return null;
}
