import { useEffect, useState } from 'react';
import { BookOpen, Compass, LocateFixed, Map, MapPin, Mountain, Swords, X } from 'lucide-react';
import { getPlayerPosition, subscribePlayerPosition } from '../playerPositionStore';
import { getLunarCaveMapEnemies, subscribeLunarCaveMapEnemies } from '../dungeons/LunarCaveMapStore.mjs';
import { LUNAR_CAVE_CHAMBERS,LUNAR_CAVE_PASSAGES,LUNAR_CAVE_WATER_END,LUNAR_CAVE_ROOM_RADIUS,LUNAR_CAVE_PASSAGE_HALF_WIDTH } from '../dungeons/LunarCaveLayout.mjs';
import { ASTRAL_PADS,ASTRAL_BRIDGES,ASTRAL_PAD_RADIUS,ASTRAL_BRIDGE_HALF_WIDTH } from '../dungeons/AstralDungeonLayout.mjs';
import {WOLFVEIL_CAVE_APPROACHES} from '../wolfveil/WolfveilCaveAccessPlan.mjs';
import { getQuestState, subscribeQuests } from '../useQuestStore';
import { AXE_FIRST_REGION } from '../axe/world/AXEFirstRegionLayout';
import { getMapMarkers, getMapScale, getMapZone, getQuestNavigationTarget, projectMapPosition } from './worldMapData';
import './AXEWorldMapOverlay.css';

const FILTERS = [
  { id:'quest', label:'Quests', icon:BookOpen },
  { id:'mob', label:'Mobs', icon:Swords },
  { id:'cave', label:'Caves', icon:Mountain },
  { id:'portal', label:'Portals', icon:Compass },
  { id:'npc', label:'NPCs', icon:MapPin },
];
const visibleCategory = (marker,flags) =>
  marker.type==='landmark'||marker.type==='player'||marker.type==='objective'||flags[marker.type]!==false;
const MARKER_SHORT = {npc:'!',mob:'⚔',cave:'⌂',portal:'◇',landmark:'◆',objective:'✦'};

export default function AXEWorldMapOverlay({ region='wolfveil', onClose }) {
  const [position,setPosition]=useState(getPlayerPosition);
  const [dungeonEnemies,setDungeonEnemies]=useState(getLunarCaveMapEnemies);
  const [quests,setQuests]=useState(getQuestState);
  const [zoom,setZoom]=useState(1);
  const [follow,setFollow]=useState(true);
  const [focus,setFocus]=useState({x:500,y:500});
  const [flags,setFlags]=useState({quest:true,mob:true,cave:true,portal:true,npc:true});
  const [selected,setSelected]=useState(null);
  useEffect(()=>subscribeQuests(setQuests),[]);
  useEffect(()=>subscribeLunarCaveMapEnemies(setDungeonEnemies),[]);
  useEffect(()=>{
    // Player position arrives every animation frame. Map rendering needs ~5fps.
    let last=0;
    return subscribePlayerPosition(p=>{
      if(typeof performance!=='undefined'&&performance.now()-last<190)return;
      last=typeof performance!=='undefined'?performance.now():0;
      setPosition(p);
    });
  },[]);
  useEffect(()=>{
    const onKey=e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation?.();onClose?.();}
    };
    window.addEventListener('keydown',onKey,true);
    return()=>window.removeEventListener('keydown',onKey,true);
  },[onClose]);
  const isAstral=region==='astral-dungeon';
  const isDungeon=region==='lunar-cave'||isAstral;
  const scale=getMapScale(region);
  const charted=getMapMarkers(region);
  const target=getQuestNavigationTarget(region,quests,position);
  const markers=[...charted,
    ...(isDungeon?dungeonEnemies.map(e=>({
      id:'live-mob:'+e.id,name:e.name,type:'mob',x:e.x,z:e.z,live:true,
      radius:0,levelRange:e.level===null?null:[e.level,e.level],
      description:'Live monster position · '+(e.level===null?'unknown level':'Level '+e.level),
    })):[]),
    ...(target?[{...target,id:'objective:'+target.questId,type:'objective',name:target.navLabel,
      description:target.live?'Tracked quest objective':'Tracked objective — charted only'}]:[])];
  const playerPoint=projectMapPosition(region,position.x,position.z);
  const center=follow?playerPoint:focus;
  const viewSize=1000/zoom;
  const half=viewSize/2;
  const viewX=Math.max(0,Math.min(1000-viewSize,center.x-half));
  const viewY=Math.max(0,Math.min(1000-viewSize,center.y-half));
  const marker=markers.find(m=>m.id===selected);
  const zones=region==='forest'?AXE_FIRST_REGION.zones:[];
  const roads=region==='forest'?AXE_FIRST_REGION.roads:[];
  const river=region==='forest'?AXE_FIRST_REGION.river:null;
  const questLabel=target?.navLabel||'Select a tracked quest in Quest Logbook';
  const onSelectMap=e=>{
    if(!e.target.closest?.('g[role="button"]')){
      const r=e.currentTarget.getBoundingClientRect();
      const x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
      setFocus({x:viewX+x*viewSize,y:viewY+y*viewSize});setFollow(false);
    }
  };
  const coords=pos=>projectMapPosition(region,pos[0],pos[2]);
  const regionText=isAstral?'Moonfall Expanse':isDungeon?'Lunar Cave Dungeon':region==='forest'?'First Territory':'Wolfveil Village';
  const chartInfo=isAstral?'Four central metal platforms with eight interconnected side rings and flowing energy boundaries. All bridges and live high-level monsters appear here; loot requires server verification.':
    isDungeon?'The stone corridors, five battle halls and monster dots reflect this dungeon instance. Red markers show living enemies from Game 3D.':
    region==='forest'?'Caves and travel portals marked “charted” are mapped reserves, not active transport.':
    'Only currently registered quest NPCs are marked in Wolfveil; uncharted sites are not invented.';
  return <div className="axe-world-map-backdrop" role="presentation" onPointerDown={e=>e.stopPropagation()}>
    <section className="axe-world-map-dialog" role="dialog" aria-modal="true" aria-label="World map"
      onKeyDown={e=>e.stopPropagation()}>
      <header className="axe-world-map-heading">
        <div><Map size={25}/><span><strong>WORLD MAP</strong><small>{regionText} · {getMapZone(region,position)}</small></span></div>
        <span className="axe-world-map-coordinates">X {Math.round(position.x)} · Z {Math.round(position.z)}</span>
        <button type="button" onClick={onClose} aria-label="Close world map"><X size={23}/></button>
      </header>
      <div className="axe-world-map-main">
        <nav className="axe-world-map-filters" aria-label="Map markers">
          <h3>SHOW ON MAP</h3>
          {FILTERS.map(({id,label,icon:Icon})=><button type="button" key={id}
            aria-pressed={flags[id]!==false} onClick={()=>setFlags(prev=>({...prev,[id]:prev[id]===false}))}>
            <Icon size={19}/>{label}<span>{flags[id]!==false?'●':'○'}</span>
          </button>)}
          <div className="axe-world-map-filter-note">
            <strong><LocateFixed size={17}/> Active objective</strong>
            <p>{questLabel}</p>
          </div>
        </nav>
        <div className="axe-world-map-maparea">
          <div className="axe-world-map-maphead"><Compass size={16}/> {scale.name} <span>North ↑</span></div>
          <svg className="axe-world-map-canvas" role="group" aria-label={'Top-down map of '+regionText}
            viewBox={[viewX,viewY,viewSize,viewSize].join(' ')}
            preserveAspectRatio="xMidYMid meet" onClick={onSelectMap}>
            <defs>
              <radialGradient id="axe-world-map-base"><stop stopColor="#526978"/><stop offset="0.6" stopColor="#253e50"/><stop offset="1" stopColor="#122a40"/></radialGradient>
              <pattern id="axe-map-contours" width="75" height="75" patternUnits="userSpaceOnUse">
                <path d="M-10 22 Q15 -3 40 20 T95 16 M-10 50 Q23 25 50 51 T100 54"
                  fill="none" stroke="#b9d5e1" strokeOpacity=".15" strokeWidth="2"/>
              </pattern>
              <filter id="axe-marker-glow"><feGaussianBlur stdDeviation="4"/></filter>
            </defs>
            <rect x="0" y="0" width="1000" height="1000" fill="url(#axe-world-map-base)"/>
            <rect x="0" y="0" width="1000" height="1000" fill="url(#axe-map-contours)"/>
            {Array.from({length:9},(_,i)=><g key={i} stroke="#b7d3dd" strokeOpacity=".08">
              <path d={'M '+(i+1)*100+' 0 V 1000'}/><path d={'M 0 '+(i+1)*100+' H 1000'}/>
            </g>)}
            {region==='lunar-cave'&&<g aria-label="Dungeon walls, corridors and chambers">
              {[...LUNAR_CAVE_CHAMBERS,LUNAR_CAVE_WATER_END].map((c,i)=>{
                const p=projectMapPosition(region,c.x,c.z);
                return <circle key={'dungeon-wall-'+i} cx={p.x} cy={p.y}
                  r={(LUNAR_CAVE_ROOM_RADIUS+2.5)*1000/(scale.maxX-scale.minX)} fill="#7793a5"/>;
              })}
              {LUNAR_CAVE_PASSAGES.map((p,i)=>{
                const a=projectMapPosition(region,p.ax,p.az),b=projectMapPosition(region,p.bx,p.bz);
                return <line key={'dungeon-pass-wall-'+i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke="#7793a5" strokeWidth={(LUNAR_CAVE_PASSAGE_HALF_WIDTH+2.5)*2000/(scale.maxX-scale.minX)} strokeLinecap="round"/>;
              })}
              {[...LUNAR_CAVE_CHAMBERS,LUNAR_CAVE_WATER_END].map((c,i)=>{
                const p=projectMapPosition(region,c.x,c.z);
                return <circle key={'dungeon-room-'+i} cx={p.x} cy={p.y}
                  r={LUNAR_CAVE_ROOM_RADIUS*1000/(scale.maxX-scale.minX)} fill="#1c3544"/>;
              })}
              {LUNAR_CAVE_PASSAGES.map((p,i)=>{
                const a=projectMapPosition(region,p.ax,p.az),b=projectMapPosition(region,p.bx,p.bz);
                return <line key={'dungeon-pass-'+i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke="#1c3544" strokeWidth={LUNAR_CAVE_PASSAGE_HALF_WIDTH*2000/(scale.maxX-scale.minX)} strokeLinecap="round"/>;
              })}
            </g>}
            {isAstral&&<g aria-label="Moonfall platforms and connected bridges">
              {ASTRAL_BRIDGES.map(b=>{
                const a=projectMapPosition(region,b.ax,b.az),c=projectMapPosition(region,b.bx,b.bz);
                return <line key={b.id} x1={a.x} y1={a.y} x2={c.x} y2={c.y}
                  stroke="#8399ba" strokeWidth={ASTRAL_BRIDGE_HALF_WIDTH*2000/(scale.maxX-scale.minX)}
                  strokeLinecap="round"/>;
              })}
              {ASTRAL_PADS.map(p=>{
                const a=projectMapPosition(region,p.x,p.z);
                return <g key={p.id}>
                  <circle cx={a.x} cy={a.y} r={ASTRAL_PAD_RADIUS*1000/(scale.maxX-scale.minX)}
                    fill="#374e68" stroke="#edcc8d" strokeWidth="4"/>
                  <circle cx={a.x} cy={a.y} r={(ASTRAL_PAD_RADIUS-4)*1000/(scale.maxX-scale.minX)}
                    fill="none" stroke="#88c2f8" strokeWidth="2"/>
                  <text x={a.x} y={a.y+5} fill="#fff4df" fontSize="16"
                    textAnchor="middle">{p.index}</text>
                </g>;
              })}
            </g>}
            {region==='wolfveil'&&<g aria-label="Four cave approach trails and walk-in entrances">
              {WOLFVEIL_CAVE_APPROACHES.map(approach=>{
                const points=approach.points.map(point=>{
                  const p=projectMapPosition('wolfveil',point.x,point.z+70);
                  return p.x+','+p.y;
                }).join(' ');
                const end=projectMapPosition('wolfveil',
                  approach.entrance.x,approach.entrance.z+70);
                return <g key={approach.id}>
                  <polyline points={points} fill="none" stroke="#e2c58c"
                    strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1={projectMapPosition('wolfveil',approach.points.at(-1).x,
                    approach.points.at(-1).z+70).x}
                    y1={projectMapPosition('wolfveil',approach.points.at(-1).x,
                      approach.points.at(-1).z+70).y}
                    x2={end.x} y2={end.y} stroke="#b7e1d6" strokeWidth="3"/>
                  <circle cx={end.x} cy={end.y} r="7"
                    fill="#e8c784" stroke="#102b35" strokeWidth="2"/>
                </g>;
              })}
            </g>}
            {zones.map(zone=>{
              const center=coords(zone.center);
              return <g key={zone.id}><circle cx={center.x} cy={center.y}
                r={zone.radius/(scale.maxX-scale.minX)*1000}
                stroke="#b5cbd8" strokeOpacity=".38" strokeDasharray="7 7"
                fill="#8cabb7" fillOpacity=".12"/>
                <text x={center.x} y={center.y-12} fill="#e8e0d0" fontSize="15"
                  textAnchor="middle" stroke="#15283a" strokeWidth="3" paintOrder="stroke">{zone.name}</text></g>;
            })}
            {roads.map(road=><polyline key={road.id}
              points={road.points.map(p=>{const t=coords(p);return t.x+','+t.y}).join(' ')}
              fill="none" stroke="#dbd4be" strokeOpacity=".55" strokeWidth={Math.max(2,road.width/3)}
              strokeLinejoin="round" strokeLinecap="round"/>)}
            {river&&<polyline
              points={river.points.map(p=>{const t=coords(p);return t.x+','+t.y}).join(' ')}
              fill="none" stroke="#7fb9d7" strokeOpacity=".7" strokeWidth={river.width/4}
              strokeLinejoin="round"/>}
            {markers.filter(m=>visibleCategory(m,flags) && (m.type!=='objective'||flags.quest!==false)).map(m=>{
              const pt=projectMapPosition(region,m.x,m.z);
              const isSelected=m.id===selected;
              const isObjective=m.type==='objective';
              const fill=isObjective?'#e1f7ff':m.type==='mob'?'#d5a2a2':m.type==='portal'?'#d8d4f3':
                m.type==='cave'?'#ecd2a5':'#b4d9e9';
              return <g key={m.id} role="button" tabIndex={0}
                aria-label={m.name+' — '+m.description}
                onClick={e=>{e.stopPropagation();setSelected(m.id);}}
                onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(m.id);}}}
                style={{cursor:'pointer'}} opacity={m.live===false ? .62 : 1}>
                {m.type==='mob'&&<circle cx={pt.x} cy={pt.y} r={m.radius/(scale.maxX-scale.minX)*1000}
                  fill="#db9290" fillOpacity=".13" stroke="#d3a7a0" strokeOpacity=".5" strokeDasharray="4 4"/>}
                {(isSelected||isObjective)&&<circle cx={pt.x} cy={pt.y} r="19" stroke="#e7f6fc"
                  strokeWidth="3" strokeOpacity=".6" fill="none"/>}
                <circle cx={pt.x} cy={pt.y} r={isObjective?13:11}
                  fill="#12334a" stroke={fill} strokeWidth="3"/>
                <text x={pt.x} y={pt.y+5} fill={fill} fontSize={isObjective?17:15}
                  fontWeight="bold" textAnchor="middle">{MARKER_SHORT[m.type]||'•'}</text>
                {(zoom>=1.4&&!isDungeon||zoom>=2.5&&isDungeon||isSelected||isObjective||m.type==='mob'&&!isDungeon)&&<text x={pt.x} y={pt.y-21}
                  fontSize="15" textAnchor="middle" fill="#f5ede3" stroke="#142c40"
                  strokeWidth="4" paintOrder="stroke">{m.name}{m.levelRange?' (Lv '+m.levelRange.join('–')+')':''}</text>}
              </g>;
            })}
            <g aria-label="Your location">
              <circle cx={playerPoint.x} cy={playerPoint.y} r="20" fill="#e4f6ff" fillOpacity=".19"/>
              <g transform={'translate('+playerPoint.x+' '+playerPoint.y+') rotate('+(Number(position.yaw)||0)*180/Math.PI+')'}>
                <path d="M0 -17 L11 13 L0 7 L-11 13 Z" fill="#e8f8ff" stroke="#5cbde9" strokeWidth="3"/>
              </g>
            </g>
          </svg>
          <div className="axe-world-map-zoom">
            <button onClick={()=>setZoom(z=>Math.min(4,z*1.5))} aria-label="Zoom in">+</button>
            <span>{Math.round(zoom*100)}%</span>
            <button onClick={()=>setZoom(z=>Math.max(1,z/1.5))} aria-label="Zoom out">−</button>
            <button onClick={()=>{setFollow(true);setSelected(null);}} title="Center on player" aria-label="Center on player"><LocateFixed size={17}/></button>
          </div>
        </div>
        <aside className="axe-world-map-details">
          <h3><MapPin size={20}/> LOCATION DATA</h3>
          {marker?<div><strong>{marker.name}</strong><span>{marker.description}</span>
            {marker.levelRange&&<span>Enemy levels: {marker.levelRange.join('–')}</span>}
            <span>World position: {Math.round(marker.x)}, {Math.round(marker.z)}</span>
            {!marker.live&&<em>Charted reserve — unavailable in the current build.</em>}
          </div>:<div><strong>{getMapZone(region,position)}</strong>
            <span>Select an icon on the map for local information.</span>
            {target&&<span>Tracked quest: {target.navLabel}</span>}</div>}
          <p className="axe-world-map-chart-info">{chartInfo}</p>
          <div className="axe-world-map-legend">
            <span><i className="axe-map-dot-player"/> Player</span>
            <span><i className="axe-map-dot-quest"/> Objective</span>
            <span><i className="axe-map-dot-mob"/> {isDungeon?'Living monsters':'Enemy level zones'}</span>
            <span><i className="axe-map-dot-point"/> Landmarks / travel</span>
          </div>
        </aside>
      </div>
      <footer className="axe-world-map-foot">
        <span>{isDungeon?'North-up cave chart · corridors, rooms and living monsters update as you move.':'Silver-blue navigation trail follows your tracked quest when a valid objective location is known.'}</span>
        <span>Click a marker for details · M / Esc to close</span>
      </footer>
    </section>
  </div>;
}
