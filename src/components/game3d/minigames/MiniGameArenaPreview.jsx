import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {buildMiniGameArena,disposeMiniGameArena} from './miniGameArena.mjs';

// Separate lightweight preview canvas. Never modifies GameWorld3D's scene,
// collision or player coordinates; real arena instances require match routing.
export default function MiniGameArenaPreview({gameId}){
  const ref=useRef(null);
  const [problem,setProblem]=useState('');
  useEffect(()=>{
    const host=ref.current;
    if(!host)return undefined;
    let renderer=null,frame=0,scene=null,arena=null,observer=null;
    let active=true;
    try{
      scene=new THREE.Scene();
      scene.background=new THREE.Color('#081422');
      arena=buildMiniGameArena(gameId);
      scene.add(arena);
      scene.add(new THREE.AmbientLight(0xdcefff,1.8));
      const sun=new THREE.DirectionalLight(0xffffff,2.2);
      sun.position.set(15,36,21);scene.add(sun);
      const large=gameId==='football'||gameId==='soccer';
      const camera=new THREE.PerspectiveCamera(44,1,.2,250);
      camera.position.set(large?44:26,large?47:27,large?62:35);
      camera.lookAt(0,0,0);
      const canvas=document.createElement('canvas');
      canvas.setAttribute('aria-hidden','true');
      host.appendChild(canvas);
      renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.25));
      renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.setClearColor(0x081422,1);
      const size=()=>{
        const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);
        camera.aspect=w/h;camera.updateProjectionMatrix();
        renderer.setSize(w,h,false);
      };
      if(typeof ResizeObserver!=='undefined'){
        observer=new ResizeObserver(size);observer.observe(host);
      }else window.addEventListener('resize',size);
      size();let last=0;
      const draw=time=>{
        if(!active)return;
        frame=requestAnimationFrame(draw);
        if(time-last<34)return;last=time;
        arena.rotation.y=Math.sin(time*.00011)*.09;
        renderer.render(scene,camera);
      };
      frame=requestAnimationFrame(draw);
      setProblem('');
      return ()=>{
        active=false;cancelAnimationFrame(frame);
        observer?.disconnect();
        window.removeEventListener('resize',size);
        scene.remove(arena);disposeMiniGameArena(arena);
        renderer.dispose();renderer.forceContextLoss?.();
        canvas.remove();
      };
    }catch(error){
      active=false;cancelAnimationFrame(frame);observer?.disconnect();
      renderer?.dispose();if(arena)disposeMiniGameArena(arena);
      if(host)host.replaceChildren();
      setProblem('3D arena preview is unavailable on this device');
      return undefined;
    }
  },[gameId]);
  return <div className="axe-minigame-arena-preview" ref={ref}
    role="img" aria-label={gameId+' procedural arena layout preview'}>
    {problem&&<p className="axe-minigame-arena-error">{problem}</p>}
  </div>;
}
