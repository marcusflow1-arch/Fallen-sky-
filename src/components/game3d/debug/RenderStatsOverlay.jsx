// Developer-only render statistics overlay for the Game 3D hero world. Default OFF.
// Turn on with `?renderStats=1` (remembered), off with `?renderStats=0`. While on, it times
// renderer.render (CPU, and GPU when EXT_disjoint_timer_query_webgl2 exists) and exposes
// window.__axeRenderStats.sample(ms) for scripted benchmarks. Off, it renders nothing and
// touches nothing. See docs/game3d/RENDERING_BASELINE.md.
import { useEffect, useState } from 'react';
import {
  estimateSceneMemory,
  isRenderStatsEnabled,
  readRendererInfo,
  summarizeFrameTimes,
} from './renderStats';

const WINDOW_FRAMES = 240;
const MB = 1024 * 1024;

function pushCapped(list, value) {
  list.push(value);
  if (list.length > WINDOW_FRAMES * 8) list.splice(0, list.length - WINDOW_FRAMES * 8);
}

export default function RenderStatsOverlay() {
  const [enabled,setEnabled] = useState(() => (typeof window === 'undefined'
    ? false
    : isRenderStatsEnabled(window.location.search, window.localStorage)));
  const [view, setView] = useState(null);
  useEffect(()=>{
    const onPreference=event=>setEnabled(!!event?.detail?.enabled);
    window.addEventListener('game3dRenderStatsChanged',onPreference);
    return ()=>window.removeEventListener('game3dRenderStatsChanged',onPreference);
  },[]);

  useEffect(() => {
    if (!enabled) return undefined;
    const frames = [];
    const cpu = [];
    const gpu = [];
    const pending = [];
    let wrapped = null; // { renderer, original, gl, ext }
    let last = 0;
    let rafId = 0;

    const unwrap = () => {
      if (!wrapped) return;
      wrapped.renderer.render = wrapped.original;
      pending.forEach((q) => { try { wrapped.gl.deleteQuery(q); } catch { /* context gone */ } });
      pending.length = 0;
      wrapped = null;
    };

    const wrap = (renderer) => {
      const original = renderer.render;
      const gl = renderer.getContext?.();
      let ext = null;
      try { ext = gl?.getExtension?.('EXT_disjoint_timer_query_webgl2') || null; } catch { ext = null; }
      renderer.render = function timedRender(...args) {
        let query = null;
        if (ext && pending.length < 8) {
          query = gl.createQuery();
          gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
        }
        const t0 = performance.now();
        try {
          return original.apply(this, args);
        } finally {
          pushCapped(cpu, performance.now() - t0);
          if (query) {
            gl.endQuery(ext.TIME_ELAPSED_EXT);
            pending.push(query);
          }
        }
      };
      wrapped = { renderer, original, gl, ext };
    };

    const pollQueries = () => {
      if (!wrapped?.ext) return;
      const { gl, ext } = wrapped;
      while (pending.length) {
        const query = pending[0];
        if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) break;
        if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) pushCapped(gpu, gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6);
        gl.deleteQuery(query);
        pending.shift();
      }
    };

    const tick = (now) => {
      const renderer = window.__gw3dRenderer;
      if (wrapped && wrapped.renderer !== renderer) unwrap();
      if (!wrapped && renderer) wrap(renderer);
      if (last) pushCapped(frames, now - last);
      last = now;
      pollQueries();
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    const collect = (count) => {
      const tail = (list) => list.slice(-count);
      const renderer = window.__gw3dRenderer;
      return {
        frame: summarizeFrameTimes(tail(frames)),
        cpuRender: summarizeFrameTimes(tail(cpu)),
        gpuRender: wrapped?.ext ? summarizeFrameTimes(tail(gpu)) : null,
        info: readRendererInfo(renderer),
        scene: estimateSceneMemory(window.__gw3dScene),
        jsHeapMB: performance.memory ? performance.memory.usedJSHeapSize / MB : null,
      };
    };

    window.__axeRenderStats = {
      snapshot: () => collect(WINDOW_FRAMES),
      // Clears the buffers, waits `ms`, and summarises every frame drawn in that window.
      sample: (ms = 5000) => {
        frames.length = 0; cpu.length = 0; gpu.length = 0; last = 0;
        return new Promise((resolve) => {
          setTimeout(() => resolve(collect(Number.MAX_SAFE_INTEGER)), ms);
        });
      },
    };

    const interval = setInterval(() => setView(collect(WINDOW_FRAMES)), 500);
    return () => {
      clearInterval(interval);
      cancelAnimationFrame(rafId);
      unwrap();
      if (window.__axeRenderStats) window.__axeRenderStats = null;
    };
  }, [enabled]);

  if (!enabled || !view) return null;
  const { frame, cpuRender, gpuRender, info, scene, jsHeapMB } = view;
  const fmt = (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : '-');
  const lines = [
    `fps ${fmt(frame.fps, 0)}  frame p50 ${fmt(frame.p50Ms)} p95 ${fmt(frame.p95Ms)} ms`,
    `render cpu p50 ${fmt(cpuRender.p50Ms, 2)} p95 ${fmt(cpuRender.p95Ms, 2)} ms`,
    gpuRender ? `render gpu p50 ${fmt(gpuRender.p50Ms, 2)} p95 ${fmt(gpuRender.p95Ms, 2)} ms` : 'render gpu n/a (no timer query)',
  ];
  if (info) {
    lines.push(`calls ${info.calls}  tris ${info.triangles.toLocaleString()}  pts ${info.points}  lines ${info.lines}`);
    lines.push(`geo ${info.geometries}  tex ${info.textures}  programs ${info.programs}`);
    lines.push(`buffer ${info.bufferWidth}x${info.bufferHeight} @${fmt(info.pixelRatio, 2)}`);
  }
  lines.push(`meshes ${scene.meshes} (skinned ${scene.skinnedMeshes}, casters ${scene.shadowCasters})  lights ${scene.lights}`);
  lines.push(`est. GPU geo ${fmt(scene.geometryBytes / MB)} MB  tex ${fmt(scene.textureBytes / MB)} MB`);
  if (jsHeapMB != null) lines.push(`JS heap ${fmt(jsHeapMB, 0)} MB`);

  return (
    <div
      data-render-stats
      style={{
        position: 'fixed', left: 8, bottom: 8, zIndex: 9999, pointerEvents: 'none',
        background: 'rgba(0,0,0,0.72)', color: '#9effa8', padding: '6px 8px', borderRadius: 4,
        font: '11px/1.35 ui-monospace, Consolas, monospace', whiteSpace: 'pre',
      }}
    >
      {lines.join('\n')}
    </div>
  );
}
