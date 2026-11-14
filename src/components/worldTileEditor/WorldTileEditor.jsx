import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { createTileGrid, tileAt, tileFromId, rectangleTiles, mergeTileIds, csvCell } from './tileGrid.mjs';

const DEFAULT_REPO = 'marcusflow1-arch/atom-x-eve-os';
const glass = 'rounded-xl border border-cyan-200/20 bg-[#071623]/90 text-cyan-50 shadow-2xl backdrop-blur-xl';
const action = 'rounded-lg border border-cyan-200/25 bg-cyan-100/10 px-3 py-2 text-xs text-cyan-50 hover:bg-cyan-100/20';
const field = 'w-full rounded-lg border border-cyan-200/20 bg-black/35 p-2 text-xs text-white outline-none focus:border-cyan-300/60';
const round = value => Math.round(value * 100) / 100;
function loadState(key) { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; } }
function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function getSceneProps(scene, tile, limit = 12) {
  if (!scene || !tile) return [];
  const found = [], point = new THREE.Vector3();
  let visited = 0;
  scene.traverse(object => {
    if (found.length >= limit || visited++ > 18000 || !object?.isMesh ||
        object.visible === false || object.userData?.editorOnly || object.userData?.editorHelper ||
        !object.name || /^(mesh|object|scene)\d*$/i.test(object.name)) return;
    object.getWorldPosition(point);
    if (point.x < tile.minX - 2 || point.x > tile.maxX + 2 ||
        point.z < tile.minZ - 2 || point.z > tile.maxZ + 2) return;
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    found.push({
      name: object.name, kind: object.userData?.type || object.type,
      x: round(point.x), y: round(point.y), z: round(point.z),
      width: round(size.x), height: round(size.y), depth: round(size.z),
      rotationY: round(object.rotation.y)
    });
  });
  return found;
}
function describeAuthored(callback, tile) {
  try { return callback?.(tile) || []; } catch { return []; }
}

export default function WorldTileEditor({
  worldId, title, bounds, tileSize = 5, getWorld, describeTile,
}) {
  const grid = useMemo(() => createTileGrid(bounds, tileSize), [
    bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ, tileSize
  ]);
  const storageKey = 'atomxe-tile-review-v1-' + worldId;
  const initial = useMemo(() => loadState(storageKey), [storageKey]);
  const [selected, setSelected] = useState(() => initial.selected || []);
  const [notes, setNotes] = useState(() => initial.notes || {});
  const [repository, setRepository] = useState(() => initial.repository || DEFAULT_REPO);
  const [active, setActive] = useState(false);
  const [scene, setScene] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const [insideId, setInsideId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [problem, setProblem] = useState('');
  const [prompt, setPrompt] = useState('');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState([]);
  const cameraRef = useRef(new THREE.PerspectiveCamera(48, 1, 0.1, 5000));
  const viewRef = useRef({ x: 0, z: 0,
    distance: Math.max(80, Math.max(grid.maxX-grid.minX, grid.maxZ-grid.minZ) * 1.1), tilt: 0 });
  const worldRef = useRef(null);
  const sceneRef = useRef(null);
  const worldGetter = useRef(getWorld);
  const currentSelection = useRef(selected);
  const activeRef = useRef(active);
  const dragRef = useRef(null);
  const rayRef = useRef(new THREE.Raycaster());
  const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  worldGetter.current = getWorld;
  currentSelection.current = selected;
  activeRef.current = active;

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify({
      version: 1, selected, notes, repository
    })); } catch { setMessage('Browser storage is full; export your report.'); }
  }, [storageKey, selected, notes, repository]);

  useEffect(() => {
    const refresh = () => {
      const world = worldGetter.current?.();
      worldRef.current = world;
      const nextScene = world?.scene || null;
      if (nextScene !== sceneRef.current) {
        sceneRef.current = nextScene;
        setScene(sceneRef.current);
      }
      if (activeRef.current) return;
      const position = world?.playerPosition;
      const id = position ? tileAt(grid, position.x, position.z)?.id : null;
      const next = id && currentSelection.current.includes(id) ? id : null;
      setInsideId(previous => previous === next ? previous : next);
    };
    refresh();
    const interval = setInterval(refresh, 250);
    return () => clearInterval(interval);
  }, [grid]);

  const updateCamera = () => {
    const camera = cameraRef.current, view = viewRef.current;
    const canvas = worldRef.current?.canvas;
    const width = canvas?.clientWidth || window.innerWidth;
    const height = canvas?.clientHeight || window.innerHeight;
    camera.aspect = Math.max(1, width) / Math.max(1, height);
    camera.position.set(view.x, Math.max(2, view.distance * Math.cos(view.tilt)),
      view.z + view.distance * Math.sin(view.tilt));
    camera.up.set(0, 0, -1);
    camera.lookAt(view.x, 0, view.z);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  };
  useEffect(() => {
    if (!active) return undefined;
    const world = worldGetter.current?.();
    const first = selected[0] ? tileFromId(grid, selected[0]) : null;
    viewRef.current.x = first?.centerX ?? world?.playerPosition?.x ?? (grid.minX + grid.maxX) / 2;
    viewRef.current.z = first?.centerZ ?? world?.playerPosition?.z ?? (grid.minZ + grid.maxZ) / 2;
    updateCamera();
    if (document.pointerLockElement) document.exitPointerLock?.();
    const value = { worldId, camera: cameraRef.current };
    window.__axeTileInspectionCamera = value;
    window.__axeTileInspectionEditing = true;
    window.dispatchEvent(new CustomEvent('axeTileInspectionChanged', { detail: { worldId, active: true } }));
    const onResize = () => updateCamera();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (window.__axeTileInspectionCamera === value) window.__axeTileInspectionCamera = null;
      window.__axeTileInspectionEditing = false;
      window.dispatchEvent(new CustomEvent('axeTileInspectionChanged', { detail: { worldId, active: false } }));
    };
  // selected is deliberately not a dependency: changing selected cells never resets the aerial camera.
  }, [active, worldId, grid]);

  useEffect(() => {
    if (!scene) return undefined;
    const group = new THREE.Group();
    group.name = 'AXE_Tile_Inspection_Helpers';
    group.userData.editorOnly = true;
    group.userData.editorHelper = true;
    if (active) {
      const size = Math.max(grid.maxX - grid.minX, grid.maxZ - grid.minZ);
      const lines = new THREE.GridHelper(size, Math.ceil(size / grid.size), 0x7cefff, 0x477b86);
      lines.position.set((grid.minX + grid.maxX)/2, 0.14, (grid.minZ + grid.maxZ)/2);
      lines.material.transparent = true;
      lines.material.opacity = 0.32;
      lines.material.depthTest = false;
      lines.renderOrder = 998;
      group.add(lines);
    }
    // Selection overlays are editor-only; never paint review tiles in normal gameplay.
    const highlighted = active ? mergeTileIds(grid, selected, preview, true) : [];
    if (highlighted.length) {
      const geometry = new THREE.PlaneGeometry(1, 1);
      const material = new THREE.MeshBasicMaterial({
        color: 0x45d8ff, transparent: true, opacity: active ? 0.34 : 0.23,
        depthWrite: false, depthTest: false, side: THREE.DoubleSide
      });
      const mesh = new THREE.InstancedMesh(geometry, material, highlighted.length);
      mesh.rotation.x = -Math.PI / 2;
      const matrix = new THREE.Matrix4();
      highlighted.forEach((id, index) => {
        const tile = tileFromId(grid, id);
        const elevation = highlighted.length <= 120
          ? worldRef.current?.sampleHeight?.(tile.centerX, tile.centerZ) : null;
        matrix.makeScale(tile.width, tile.depth, 1);
        // After rotation, local Z is world Y; lie close to the actual ground surface.
        matrix.setPosition(tile.centerX, -tile.centerZ,
          Number.isFinite(elevation) ? elevation + 0.15 : 0.15);
        mesh.setMatrixAt(index, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      mesh.renderOrder = 999;
      group.add(mesh);
    }
    scene.add(group);
    return () => {
      scene.remove(group);
      group.traverse(node => {
        node.geometry?.dispose?.();
        if (Array.isArray(node.material)) node.material.forEach(m => m.dispose());
        else node.material?.dispose?.();
      });
    };
  }, [scene, active, selected, preview, grid]);

  const pick = event => {
    const canvas = worldRef.current?.canvas;
    const rect = canvas?.getBoundingClientRect?.() || {
      left: 0, top: 0, width: window.innerWidth, height: window.innerHeight
    };
    if (rect.width <= 0 || rect.height <= 0 ||
        event.clientX < rect.left || event.clientX > rect.left + rect.width ||
        event.clientY < rect.top || event.clientY > rect.top + rect.height) return null;
    const pointer = new THREE.Vector2(
      (event.clientX - rect.left) * 2 / rect.width - 1,
      1 - (event.clientY - rect.top) * 2 / rect.height
    );
    rayRef.current.setFromCamera(pointer, cameraRef.current);
    const worldPoint = rayRef.current.ray.intersectPlane(planeRef.current, new THREE.Vector3());
    return worldPoint ? tileAt(grid, worldPoint.x, worldPoint.z) : null;
  };
  const down = event => {
    if (event.button !== 0 && event.button !== 2) return;
    const tile = event.button === 0 ? pick(event) : null;
    dragRef.current = {
      mode: event.button === 2 ? 'pan' : event.shiftKey ? 'region' : 'single',
      start: tile, end: tile, x: event.clientX, y: event.clientY,
      additive: event.ctrlKey || event.metaKey
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tile) setFocusId(tile.id);
    if (event.button === 0) event.preventDefault();
  };
  const move = event => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.mode === 'pan') {
      const rect = worldRef.current?.canvas?.getBoundingClientRect();
      const pixelScale = viewRef.current.distance / Math.max(200, rect?.height || window.innerHeight);
      viewRef.current.x -= (event.clientX - drag.x) * pixelScale;
      viewRef.current.z += (event.clientY - drag.y) * pixelScale;
      drag.x = event.clientX; drag.y = event.clientY;
      updateCamera();
    } else if (drag.mode === 'region') {
      drag.end = pick(event) || drag.end;
      if (drag.start && drag.end) setPreview(rectangleTiles(grid, drag.start, drag.end));
    }
  };
  const up = event => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.mode === 'pan') return;
    const end = pick(event) || drag.end || drag.start;
    if (!end) { setPreview([]); return; }
    if (drag.mode === 'region' && drag.start) {
      const ids = rectangleTiles(grid, drag.start, end);
      setSelected(previous => mergeTileIds(grid, previous, ids, true));
    } else if (drag.mode === 'single') {
      setSelected(previous => drag.additive
        ? previous.includes(end.id) ? previous.filter(id => id !== end.id)
          : mergeTileIds(grid, previous, [end.id], true)
        : [end.id]);
    }
    setFocusId(end.id);
    setPreview([]);
  };
  const zoom = factor => {
    viewRef.current.distance = Math.max(15, Math.min(2500, viewRef.current.distance * factor));
    updateCamera();
  };
  useEffect(() => {
    if (!active) return undefined;
    const onKey = event => {
      if (event.target?.closest?.('input,textarea,select,[contenteditable="true"]')) return;
      const key = event.key.toLowerCase(), v = viewRef.current;
      if (key === 'escape') { setActive(false); event.preventDefault(); event.stopImmediatePropagation(); return; }
      let handled = true;
      const step = grid.size * (event.shiftKey ? 5 : 2);
      if (key === 'w' || key === 'arrowup') v.z -= step;
      else if (key === 's' || key === 'arrowdown') v.z += step;
      else if (key === 'a' || key === 'arrowleft') v.x -= step;
      else if (key === 'd' || key === 'arrowright') v.x += step;
      else if (key === '+' || key === '=') zoom(0.85);
      else if (key === '-' || key === '_') zoom(1.15);
      else handled = false;
      if (handled) { updateCamera(); event.preventDefault(); event.stopImmediatePropagation(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active, grid]);

  const relevant = active ? selected : insideId ? [insideId] : [];
  const focusedTile = tileFromId(grid, focusId || relevant[0] || insideId);
  const displayedTile = active ? focusedTile : tileFromId(grid, insideId);
  const authored = displayedTile ? describeAuthored(describeTile, displayedTile) : [];
  const discovered = useMemo(() => getSceneProps(scene, displayedTile), [
    scene, displayedTile?.id
  ]);
  const noteForTile = notes[displayedTile?.id] || {};
  const startEditing = tileId => {
    const note = notes[tileId] || {};
    setProblem(note.problem || '');
    setPrompt(note.prompt || '');
    setFocusId(tileId);
    setEditing(true);
  };
  const saveNote = () => {
    const targets = relevant.length ? relevant : focusedTile ? [focusedTile.id] : [];
    if (!targets.length) { setMessage('Select a tile first.'); return; }
    const updatedAt = new Date().toISOString();
    setNotes(previous => {
      const result = { ...previous };
      targets.forEach(id => { result[id] = { problem, prompt, updatedAt }; });
      return result;
    });
    setEditing(false);
    setMessage('Saved locally for ' + targets.length + ' tile(s). Export JSON/CSV or open a GitHub issue draft to share the report.');
  };
  const sampleY = tile => {
    try {
      const value = worldRef.current?.sampleHeight?.(tile.centerX, tile.centerZ);
      return Number.isFinite(value) ? round(value) : null;
    } catch { return null; }
  };
  const makeReport = () => ({
    schema: 'atomxe.terrain-tile-review.v1', worldId, title,
    coordinateSystem: 'Three.js world metres: X east/west, Z depth/north-south, Y elevation',
    grid, repository, generatedAt: new Date().toISOString(),
    sceneModelScanLimit: 120,
    note: relevant.length > 120 ? 'Large-region export includes authored props and every cell; detailed live mesh scans are limited to selections of 120 tiles or fewer.' : null,
    tiles: relevant.map(id => {
      const tile = tileFromId(grid, id);
      return { ...tile, terrainY: sampleY(tile),
        authoredFeatures: describeAuthored(describeTile, tile),
        sceneModels: relevant.length <= 120 ? getSceneProps(scene, tile) : [],
        note: notes[id] || null };
    })
  });
  const exportJSON = () => download(worldId + '-tile-review.json',
    JSON.stringify(makeReport(), null, 2), 'application/json');
  const exportCSV = () => {
    const report = makeReport();
    const rows = [['tileId','column','row','minX','maxX','minZ','maxZ','centerX','centerZ','surfaceY','width','depth','features','problem','requestedChange','updatedAt']];
    report.tiles.forEach(t => rows.push([
      t.id,t.column,t.row,t.minX,t.maxX,t.minZ,t.maxZ,t.centerX,t.centerZ,t.terrainY,t.width,t.depth,
      JSON.stringify([...(t.authoredFeatures || []),...(t.sceneModels || [])]),
      t.note?.problem || '',t.note?.prompt || '',t.note?.updatedAt || ''
    ]));
    download(worldId + '-tile-review.csv', rows.map(row => row.map(csvCell).join(',')).join('\r\n'), 'text/csv');
  };
  const githubDraft = () => {
    const cleanRepo = repository.trim();
    if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(cleanRepo)) {
      setMessage('Enter a GitHub repository as owner/name.'); return;
    }
    const ids = relevant.slice(0, 45).join(', ');
    const text = [
      'World: ' + title + ' (' + worldId + ')',
      'Coordinate system: world X/Z metres; Y is elevation. Tile size: ' + grid.size + 'm.',
      'Tiles selected: ' + relevant.length,
      'Tile IDs (first 45): ' + ids,
      '',
      'Reported problems:',
      ...[...new Set(relevant.map(id => notes[id]?.problem).filter(Boolean))].slice(0, 4),
      '',
      'Requested changes:',
      ...[...new Set(relevant.map(id => notes[id]?.prompt).filter(Boolean))].slice(0, 4),
      '',
      'World-space tile detail (sampled at report creation):',
      ...relevant.slice(0, 6).map(id => {
        const tile = tileFromId(grid, id);
        return JSON.stringify({
          id, minX: tile.minX, maxX: tile.maxX,
          minZ: tile.minZ, maxZ: tile.maxZ,
          surfaceY: sampleY(tile),
          authoredFeatures: describeAuthored(describeTile, tile).slice(0, 10),
          problem: notes[id]?.problem || '',
          requestedChange: notes[id]?.prompt || ''
        });
      }),
      '',
      'For more than six tiles or a full scene-model inventory, attach the downloaded JSON / CSV.'

    ].join('\n').slice(0, 6000);
    const titleText = '[Tile Review] ' + title + ': ' + (relevant[0] || 'map') +
      (relevant.length > 1 ? ' +' + (relevant.length - 1) + ' tiles' : '');
    const url = 'https://github.com/' + cleanRepo + '/issues/new?title=' +
      encodeURIComponent(titleText) + '&body=' + encodeURIComponent(text);
    window.open(url, '_blank', 'noopener,noreferrer');
    setMessage('GitHub draft opened. Submit it on GitHub to save it to the repository.');
  };

  return (
    <>
      <div data-axe-tile-editor={worldId}>
        {!active && (
          <button type="button" onClick={() => { setActive(true); setEditing(false); }}
            className={glass + ' fixed left-1/2 top-[135px] z-[160] -translate-x-1/2 px-4 py-2 text-xs font-semibold hover:border-cyan-300/50'}>
            ◈ Edit Map Tiles
          </button>
        )}
        {active && (
          <>
            <div className="fixed inset-0 z-[160] cursor-crosshair"
              style={{ touchAction: 'none', background: 'transparent' }}
              onPointerDown={down} onPointerMove={move} onPointerUp={up}
              onPointerCancel={() => { dragRef.current = null; setPreview([]); }}
              onWheel={event => { event.preventDefault(); zoom(event.deltaY > 0 ? 1.12 : 0.88); }}
              onContextMenu={event => event.preventDefault()}
              role="application" aria-label="Aerial tile selection canvas"/>
            <div className={glass + ' fixed right-4 top-16 z-[170] w-[350px] max-w-[92vw] max-h-[86vh] overflow-y-auto p-4'}
              onPointerDown={event => event.stopPropagation()}>
              <div className="flex items-center justify-between gap-2">
                <div><div className="text-[10px] uppercase tracking-[.2em] text-cyan-300/70">Terrain inspection</div>
                  <div className="text-sm font-bold">{title}</div></div>
                <button className={action} onClick={() => { setActive(false); setEditing(false); }}>Done</button>
              </div>
              <p className="mt-3 text-[11px] leading-5 text-white/65">
                Click a tile · Ctrl/Cmd-click to add/remove · Shift-drag to select a rectangle ·
                Right-drag to pan · Wheel to zoom · WASD/arrows to move overhead.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button className={action} onClick={() => zoom(0.8)}>Zoom +</button>
                <button className={action} onClick={() => zoom(1.25)}>Zoom −</button>
                <button className={action} onClick={() => { setSelected([]); setPreview([]); }}>Clear selection</button>
              </div>
              <label className="mt-3 block text-[11px] text-white/70">Camera angle: {Math.round(viewRef.current.tilt * 180 / Math.PI)}°
                <input className="mt-1 w-full accent-cyan-300" type="range" min="0" max="65"
                  defaultValue="0" onChange={event => { viewRef.current.tilt = Number(event.target.value) * Math.PI / 180; updateCamera(); }}/>
              </label>
              <p className="mt-2 text-xs font-semibold text-cyan-200">{selected.length} selected tile(s) · {grid.size}m grid</p>
              {displayedTile && <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-2 text-xs">
                <strong>{displayedTile.id}</strong>
                <div>X {round(displayedTile.minX)} to {round(displayedTile.maxX)}m ·
                  Z {round(displayedTile.minZ)} to {round(displayedTile.maxZ)}m</div>
                <div>Centre ({round(displayedTile.centerX)}, {round(displayedTile.centerZ)}) ·
                  grid column {displayedTile.column}, row {displayedTile.row}</div>
                <div>Surface Y elevation: {sampleY(displayedTile) ?? 'not sampled'}m</div>
              </div>}
              {displayedTile && <div className="mt-2 text-[11px] text-white/70">
                <strong>Recorded features</strong>
                {[...authored, ...discovered].slice(0, 8).length
                  ? [...authored, ...discovered].slice(0, 8).map((feature, index) =>
                      <div key={index} className="mt-1 border-b border-white/10 pb-1">
                        {typeof feature === 'string' ? feature : (feature.name || feature.kind || feature.type || JSON.stringify(feature))}
                        {feature.height !== undefined ? ' · height ' + feature.height + 'm' : ''}
                      </div>)
                  : <div>Uncatalogued tile — add a description in the review.</div>}
              </div>}
              <button className={action + ' mt-3 w-full'} onClick={() => startEditing(displayedTile?.id || selected[0])}
                disabled={!displayedTile}>Describe problem / requested 3D change</button>
              {editing && <div className="mt-3 space-y-2">
                <label className="block text-[11px] text-white/70">What is wrong?
                  <textarea className={field + ' mt-1'} rows={2} value={problem}
                    onChange={event => setProblem(event.target.value)} placeholder="Bridge intersects river bank; rock is too flat..."/>
                </label>
                <label className="block text-[11px] text-white/70">What should change? (prompt)
                  <textarea className={field + ' mt-1'} rows={4} value={prompt}
                    onChange={event => setPrompt(event.target.value)} placeholder="Move the bridge to X..., increase rock height to Y..., rotate tree..."/>
                </label>
                <button className={action} onClick={saveNote}>Save notes for {relevant.length} tile(s)</button>
              </div>}
              <div className="mt-4 border-t border-white/10 pt-3">
                <label className="block text-[11px] text-white/70">GitHub repository
                  <input className={field + ' mt-1'} value={repository}
                    onChange={event => setRepository(event.target.value)}
                    placeholder="owner/repository"/>
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className={action} onClick={exportJSON}>Download JSON</button>
                  <button className={action} onClick={exportCSV}>Download CSV</button>
                  <button className={action} onClick={githubDraft}>GitHub issue draft</button>
                </div>
                <p className="mt-2 text-[10px] text-white/50">GitHub drafts require your confirmation; this page never stores GitHub credentials or silently commits code.</p>
              </div>
              {message && <p className="mt-3 text-[11px] text-cyan-200" role="status">{message}</p>}
            </div>
          </>
        )}
        {!active && insideId && (
          <div className={glass + ' fixed bottom-28 left-1/2 z-[165] w-[370px] max-w-[90vw] -translate-x-1/2 p-3'}
            onPointerDown={event => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-2">
              <strong className="text-sm">◈ {insideId}</strong>
              <button className={action} onClick={() => startEditing(insideId)}>Edit</button>
            </div>
            <div className="mt-1 text-[11px] text-white/70">
              Surface Y {displayedTile ? (sampleY(displayedTile) ?? 'unknown') : 'unknown'}m ·
              X {round(displayedTile?.minX || 0)}–{round(displayedTile?.maxX || 0)}m ·
              Z {round(displayedTile?.minZ || 0)}–{round(displayedTile?.maxZ || 0)}m
            </div>
            <div className="mt-1 text-[11px] text-white/65">
              {[...authored, ...discovered].slice(0, 4).map(f => typeof f === 'string' ? f : f.name || f.kind || f.type).join(' · ') || 'No authored props catalogued'}
            </div>
            {noteForTile.problem && <p className="mt-1 text-[11px] text-amber-200">Issue: {noteForTile.problem}</p>}
            {editing && <div className="mt-2 space-y-2">
              <textarea className={field} rows={2} aria-label="Tile problem"
                value={problem} onChange={event => setProblem(event.target.value)} placeholder="What is wrong?"/>
              <textarea className={field} rows={3} aria-label="Requested tile change"
                value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="Describe the desired model/placement changes"/>
              <button className={action} onClick={saveNote}>Save tile report</button>
            </div>}
            <div className="mt-2 flex flex-wrap gap-2">
              <button className={action} onClick={exportJSON}>Download JSON</button>
              <button className={action} onClick={githubDraft}>GitHub issue draft</button>
            </div>
            {message && <p className="mt-2 text-[11px] text-cyan-200" role="status">{message}</p>}
          </div>
        )}
      </div>
    </>
  );
}
