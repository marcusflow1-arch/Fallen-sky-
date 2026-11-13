import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { clone as cloneSkinnedModel } from 'three/examples/jsm/utils/SkeletonUtils.js';

/**
 * A second camera renders the *existing animated NPC model* into the quest visor.
 * Geometry, rig and textures come from the loaded world entity; we never
 * download a second character or replace the NPC with a static thumbnail.
 * The preview clone owns its transforms, not the original shared assets.
 */
export default function QuestNpcLivePortrait({ npcObject, name = 'Quest giver' }) {
  const mountRef = useRef(null);
  const [fallback, setFallback] = useState(!npcObject);
  useEffect(() => {
    if (!npcObject || !mountRef.current) { setFallback(true); return; }
    const mount = mountRef.current;
    let renderer, observer, frame = 0, disposed = false;
    let preview;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(0x06121b, 0);
      renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;';
      renderer.domElement.setAttribute('aria-label', `Live 3D view of ${name}`);
      mount.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xd9ecff, 0x253042, 2.1));
      const key = new THREE.DirectionalLight(0xffe6bd, 2.4);
      key.position.set(3, 6, 6); scene.add(key);
      const fill = new THREE.DirectionalLight(0x92c8fa, 1.2);
      fill.position.set(-4, 4, -2); scene.add(fill);
      // SkeletonUtils correctly remaps skinned bones. A normal Object3D.clone
      // can bind the portrait back to the live NPC's skeleton.
      preview = cloneSkinnedModel(npcObject);
      preview.position.set(0, 0, 0);
      preview.rotation.set(0, 0, 0);
      preview.visible = true;
      scene.add(preview);
      const originalNodes = [], copiedNodes = [];
      npcObject.traverse(node => originalNodes.push(node));
      preview.traverse(node => copiedNodes.push(node));
      const box = new THREE.Box3().setFromObject(preview);
      const extent = box.getSize(new THREE.Vector3());
      if (!Number.isFinite(extent.y) || extent.y < 0.01) throw new Error('NPC is not rendered yet');
      const midpoint = box.getCenter(new THREE.Vector3());
      preview.position.set(-midpoint.x, -box.min.y, -midpoint.z);
      // Show head, torso and gestures. The entire NPC rig remains live.
      const height = Math.max(.5, extent.y);
      const camera = new THREE.PerspectiveCamera(34, 1, .01, Math.max(100, height * 30));
      const focus = height * .65;
      const distance = Math.max(1.2, height * 1.45);
      camera.position.set(0, focus + height * .12, distance);
      camera.lookAt(0, focus, 0);
      const resize = () => {
        if (disposed) return;
        const w = Math.max(1, mount.clientWidth), h = Math.max(1, mount.clientHeight);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(resize);
        observer.observe(mount);
      }
      let lastRender = 0;
      const draw = time => {
        if (disposed) return;
        frame = window.requestAnimationFrame(draw);
        if (document.hidden || time - lastRender < 40) return; // 25fps max
        lastRender = time;
        // Copy the *currently playing* pose (including each animated bone).
        // Never step the world mixer twice or move the in-world NPC.
        const count = Math.min(originalNodes.length, copiedNodes.length);
        for (let i = 1; i < count; i++) {
          const a = originalNodes[i], b = copiedNodes[i];
          b.position.copy(a.position);
          b.quaternion.copy(a.quaternion);
          b.scale.copy(a.scale);
        }
        preview.updateMatrixWorld(true);
        renderer.render(scene, camera);
      };
      frame = window.requestAnimationFrame(draw);
      setFallback(false);
    } catch (error) {
      console.warn('[Game 3D quest portrait] Preview unavailable', error);
      setFallback(true);
    }
    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      // Shared GLB geometry and materials belong to GameWorld3D, not this panel.
      preview?.parent?.remove(preview);
      renderer?.dispose();
      renderer?.domElement?.remove();
    };
  }, [npcObject, name]);
  return (
    <div className="relative h-[240px] md:h-[360px] overflow-hidden rounded-xl border border-cyan-200/20 bg-gradient-to-b from-slate-800/60 via-slate-950/95 to-cyan-950/40">
      <div ref={mountRef} className="absolute inset-0" />
      {fallback && <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-cyan-100/60">NPC 3D preview unavailable</div>}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent px-4 pb-4 pt-12">
        <div className="text-[10px] tracking-[0.22em] uppercase text-cyan-300/80">Live encounter</div>
        <div className="text-lg font-semibold text-white">{name}</div>
      </div>
    </div>
  );
}
