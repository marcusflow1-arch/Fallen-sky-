// One authoritative scene build for Game 1's Shadow Wolf hometown.
// All landmarks, routes, buildings, terrain and water share world meters;
// the viewer and the actual game instantiate this same scene module.
import * as THREE from 'three';
import {MeshBVH,acceleratedRaycast} from 'three-mesh-bvh';
import {
  WOLFVEIL_SITES,WOLFVEIL_RIVER,WOLFVEIL_ROUTES,WOLFVEIL_BRIDGES,
  WOLFVEIL_HOUSING_PLOTS,wolfveilHeight,wolfveilDistanceToRiver,wolfveilRouteClearance,
} from './WolfveilLayout.js';
import {
  WolfveilBuilder,buildWolfveilTerrain,addWolfEarPeaks,
  addWolfveilPaths,addWolfveilWater,material,
} from './WolfveilGeometry.js';
import {buildWolfveilTown} from './WolfveilTown.js';
import {resolveWolfveilBridgeRailing} from './WolfveilBridgeProfile.mjs';
import {buildWolfveilVegetation,buildWolfveilWaterfall} from './WolfveilNature.js';
import {buildWolfveilGroundCover} from './WolfveilGroundCover.js';
import {installWolfveilOwnerGrassTile} from './WolfveilGrassTileReplacement.js';
import {applyWolfveilPrecisionForestGroundPigment} from './WolfveilPrecisionForestTile.mjs';
// LAND-WS05 #1282: tile-exclusive pigment; never another scene or collision floor.
import {applyWolfveilSquareR08C10GroundPigment} from '../axe/world/landscaping/WolfveilSquareR08C10.mjs';
import {clearOf,wolfveilTreePlacements,wolfveilForestTrunkColliders} from './WolfveilForestLayout.js';
import {installWolfveilOwnerLandscapeModels} from './WolfveilOwnerLandscapeModels.js';
import {buildWolfveilTrailLandscaping} from './WolfveilTrailLandscaping.js';
import {buildWolfveilLivingLandscape} from './WolfveilLivingLandscape.js';
import {applyWolfveilSpawnGroundDetail} from './WolfveilSpawnGroundDetail.js';
import {addWolfveilWestHillsideLandscaping} from './WolfveilWestHillsideGround.js';
import {WOLFVEIL_SPAWN_TILE} from './WolfveilSpawnTile.js';
import {addWolfveilTerraces} from './WolfveilTerraces.js';
import {addWolfveilTerrainEdgeSkirt} from './WolfveilTerrainEdgeSkirt.js';
import {installShadowWolfHouseModels} from './ShadowWolfHouseGLB.js';
import {addWolfveilLunaPalace} from './WolfveilLunaPalace.js';
import {palaceWallCrosses} from './WolfveilPalaceLayout.mjs';

export function createWolfveilVillage(scene,options={}){
  if(!scene?.add)throw Error('Wolfveil requires the existing Three.js scene');
  const world=new WolfveilBuilder(scene);
  // Live Game 1 spawns near world (0,0). In the first connected art slice,
  // put the market at spawn; preserve unshifted master layout coordinates.
  const offsetZ=options.originAtMarket?70:0;
  world.group.position.z=offsetZ;
  const geometry=buildWolfveilTerrain({
    span:options.span||1100,segments:options.segments||310,
  });
  const terrainMaterial=material(0xffffff,.92,{vertexColors:true,side:THREE.DoubleSide});
  // Game 3D opt-in: replace flat ground pigment inside the first spawn square.
  // No overlay mesh: terrain geometry, raycast BVH and server collision stay identical.
  if(options.spawnGroundTile){
    applyWolfveilSpawnGroundDetail(terrainMaterial,geometry);
    // The builder must dispose the small 96x96 grass texture as well as its material.
    world.ownedMaterials.push(terrainMaterial);
  }
  // The single claimed T07-05 precision tile gets a restrained green
  // Sumi-e lawn wash on the SAME walkable terrain, never a fake overlay floor.
  // Only Game 3D's translated market entry opts in; Game 1 stays untouched.
  if(options.originAtMarket&&options.groundCover)
    applyWolfveilPrecisionForestGroundPigment(geometry,{
      enabled:true,
      paintableAt:(x,z)=>clearOf({x,z},.75),
      routeDistance:wolfveilRouteClearance,
      riverDistance:wolfveilDistanceToRiver,
    });
  // WS05: color the already-authored terrain *inside R08-C10 ONLY*.
  // The clumps occupy ~1.3% of its nominal area, so this soft Sumi-e green
  // base avoids bare brown gaps while preserving roads, rivers and every
  // other reserved square. No overlay mesh, no height or collision edits.
  if(options.originAtMarket&&options.groundCover)
    applyWolfveilSquareR08C10GroundPigment(geometry,{
      enabled:true,
      // The renderer's true vertex spacing bounds interpolation across
      // the owner tile edge, even for a custom terrainSpan/segments build.
      terrainGridStep:(options.span||1100)/(options.segments||310),
      // One read of the authoritative tree anchors for this world build.
      // Never paint over a real trunk's rooted footprint.
      existingTrees:wolfveilTreePlacements(),
      paintableAt:(x,z)=>clearOf({x,z},.75),
      routeDistance:wolfveilRouteClearance,
      riverDistance:wolfveilDistanceToRiver,
    });
  const ground=world.mesh(new THREE.Mesh(geometry,terrainMaterial));
  // The real Game 1 renderer casts a downward ray every frame for player,
  // mount, companions, enemies, and NPCs. Accelerate this 190K-triangle
  // terrain with a static BVH rather than checking all triangles per foot.
  geometry.boundsTree=new MeshBVH(geometry,{maxLeafTris:16});
  ground.raycast=acceleratedRaycast;
  ground.name='SWV_RealWalkableContouredTerrain';
  ground.userData.isTerrain=true;
  ground.userData.wolfveil=true;
  ground.receiveShadow=true;
  // Keep the one physical terrain in view while exploring the spawn square:
  // browser-specific culling must not leave the sky visible beneath our feet.
  if(options.spawnGroundTile)ground.frustumCulled=false;
  // Blend the owner's dirt with weathered stone only on the western flank.
  // This overlay never enters BVH, player-foot raycasts or worker physics.
  const westLandscaping=options.groundCover
    ?addWolfveilWestHillsideLandscaping(world,geometry,{
        span:options.span||1100,segments:options.segments||310,
      })
    :null;
  // Decorative underside only: no terrain/collision shrink, no extra raycast floor.
  addWolfveilTerrainEdgeSkirt(world,{span:options.span||1100});
  addWolfEarPeaks(world);
  const routes=addWolfveilPaths(world,WOLFVEIL_ROUTES,{
    excludePalaceApproach:true,
    swQuarterQuality:Boolean(options.originAtMarket&&options.groundCover),
    canonicalPlaySurface:Boolean(options.originAtMarket&&options.groundCover),
    trailBreaks:Boolean(options.originAtMarket&&options.groundCover),
    terrainSpan:options.span||1100,terrainSegments:options.segments||310,
  });
  // Valley-wide stones, grass tufts and washed-out trail rubble (Game 3D only).
  const trailLandscaping=options.originAtMarket&&options.groundCover
    ?buildWolfveilTrailLandscaping(world,{
        terrainSpan:options.span||1100,terrainSegments:options.segments||310,
      })
    :null;
  // Wildflowers, shrubs, ferns, fallen logs and riverbank reeds (Game 3D only).
  const livingLandscape=trailLandscaping
    ?buildWolfveilLivingLandscape(world,{heightAt:trailLandscaping.heightAt})
    :null;
  const river=addWolfveilWater(world,WOLFVEIL_RIVER,{
    silverWater:Boolean(options.silverWater),
  });
  const waterfall=buildWolfveilWaterfall(world);
  const town=buildWolfveilTown(world,{
    terrainSpan:options.span||1100,terrainSegments:options.segments||310,
    hideMarketStalls:Boolean(options.hideMarketStalls),
    importedTownAtMarket:Boolean(options.importedTownAtMarket),
  });
  // This shared Wolfveil valley retires all legacy/fountain housing and
  // fallback silhouettes. The Luna Dashboard architecture is the ONLY home.
  // Source GLB files stay archived in the project, but do not spawn.
  // Game 3D market-origin opt-in: do not modify the shared Game 1 valley,
  // paths, authored terrain squares, server physics, or original asset data.
  const quietEntryDecor=Boolean(options.originAtMarket&&options.groundCover);
  const palace=addWolfveilLunaPalace(world,{compactPathLights:quietEntryDecor});
  const retireHousing=true;
  const fountainHomes={colliders:[],count:0,state:'retired',dispose(){}};
  const terraces=addWolfveilTerraces(world,{
    excludePalaceApproach:true,
    swQuarterQuality:Boolean(options.originAtMarket&&options.groundCover),
    compactPathLights:quietEntryDecor,
  });
  const vegetation=buildWolfveilVegetation(world,{
    blueCanopy:false, // owner trees use bark browns and natural green foliage
  });
  // Game 3D-only detailed grass and route-side stones. Leave the shared
  // Game 1 scene unchanged unless a caller explicitly opts into this layer.
  const groundCover=options.groundCover
    ?buildWolfveilGroundCover(world,{
        ...(options.groundCover===true?{}:options.groundCover),
        terrainSpan:options.span||1100,
        terrainSegments:options.segments||310,
        precisionTileWorldOffsetZ:options.originAtMarket?offsetZ:null,
        removeBlueCyanOvals:quietEntryDecor,
      })
    :null;
  // Optional high-detail uploaded models are a small, bounded accent layer.
  // Source procedural grass/trees remain present if a network model fails.
  const ownerModels=groundCover?.flowPlan
    ?installWolfveilOwnerLandscapeModels(world,{
       flowPlan:groundCover.flowPlan,forestTrees:vegetation.trees,
       trail:trailLandscaping?{grass:trailLandscaping.grassAnchors,
         plants:trailLandscaping.plantAnchors}:undefined,
       onStatus(status){
         // Keep fallback trees visible if the FBX or blue atlas is unavailable.
         // Hide only after all owner tree meshes were successfully installed.
         vegetation.setOwnerWestTreeReady(status.loadedKinds?.includes('tree')===true);
       },
     })
    :null;
  world.flush();
  // Replace ALL decorative blade-batch visuals only for the Game 3D version
  // of this world. Source plans and exact 5m/100m square root ownership remain.
  // Original blades remain visible until both owner-derived GLBs are loaded,
  // and remain the graceful fallback if a CDN asset fails.
  const ownerGrassTiles=quietEntryDecor&&groundCover
    ?installWolfveilOwnerGrassTile(world,{groundCover,ownerModels})
    :null;
  const colliders=[...town.buildings.map(b=>({
    id:b.id,kind:b.kind,x:b.x,z:b.z,w:b.w,d:b.d,Y:b.Y,
  })),...fountainHomes.colliders,palace.palace];
  // The exact same immutable FBX ancient and GLB elm trunk centers/radii are
  // used for local Play and the dedicated authoritative worker.
  const treeColliders=options.originAtMarket
    ?wolfveilForestTrunkColliders():[];
  const info={
    id:'wolfveil_valley',
    kind:'game1_shadow_race_homeland',
    name:'Wolfveil Valley — Shadow Wolf Homeland',
    stage:'connected_world_blockout_with_architecture_art_slice',
    game:'Game 1 — Game 3D',
    north:'+z',
    worldSizeMeters:2000,
    renderedCoreSizeMeters:options.span||1100,
    town,terraces,palace:palace.palace,
    palaceLoadStatus:palace.sourceStatus,
    palaceLoadFailureStage:palace.loadFailureStage,
    palaceFootprintCollisionDefined:true,
    fountainHomes:{count:fountainHomes.count,locations:fountainHomes.colliders},
    get fountainHomeAssetStatus(){return fountainHomes.state;},
    plantedTrees:vegetation.trees.length,
    trailLandscaping:trailLandscaping?{rocks:trailLandscaping.rocks,
      tufts:trailLandscaping.tufts,triangles:trailLandscaping.triangles}:null,
    livingLandscape,
    spawnGroundTile:options.spawnGroundTile?WOLFVEIL_SPAWN_TILE:null,
    groundCover:groundCover?{
      grassPatches:groundCover.grassPatches,
      grassClumps:groundCover.grassClumps,
      pathStones:groundCover.pathStones,
      flowingRouteClumps:groundCover.flowGrass,
      blueCyanUnderstory:groundCover.flowShrubs,
      blueCyanOvalsRemoved:groundCover.removedBlueCyanOvals,
      decorativeOnly:true,
      qualityTile:groundCover.precisionTile,
      swQuarterQuality:groundCover.swQuarterQuality,
      swDecorAudit:groundCover.swDecorAudit,
    }:null,
    nativeElmTargets:vegetation.elmTargets,
    housingPlots:[], // old plots exist only in archived layout data
    landmarks:WOLFVEIL_SITES,
    river:WOLFVEIL_RIVER,
    routes:WOLFVEIL_ROUTES,
    // Honest feature contracts: visible paths exist, but gameplay systems
    // and multiplayer server movement are separate staged work.
    featureStatus:{
      townGeometry:retireHousing?'luna_dashboard_mansion_only':'luna_manor_with_legacy_fountain_homes',
      majorRoutes:'visible_ground_conforming',
      bridges:'bank_seated_walkable_ray_decks_and_client_rails_server_physics_pending',
      housing:retireHousing?'retired_all_non_mansion_homes':'legacy_fountain_homes',
      interiors:palace.sourceStatus==='luna_exact'
        ?'luna_palace_original_architecture_reused; gameplay collision QA pending'
        :'luna_palace_missing_no_placeholder; physical and worker wall boundaries remain',
      caves:'entrances_visual_interior_unbuilt',
      waterfall:'animated_visual_sheet_not_fluid_simulation',
      enemyAi:'existing_game1_ai_only_no_new_wolfveil_spawns',
      traversal:'local_preview_exploration_only_outside_gameplay_bounds',
    },
  };
  let elapsed=0,disposed=false;
  let fallbackDisposed=false;
  let modelState='retired_old_houses';
  const initialSurfaceCount=world.walkableSurfaces?.length||0;
  // Update the parent transform before the first player-foot raycast: the
  // valley's local geometry is offset 70m into the real game's coordinates.
  world.group.updateMatrixWorld(true);
  const sceneState={
    ground,world,scene,info,geometry,town,river,waterfall,vegetation,
    get uploadedLandscapeModels(){return ownerModels?.status()??null;},
    grassTileReplacement:ownerGrassTiles,
    get grassTileStatus(){return ownerGrassTiles?.status()??null;},
    get westernLandscape(){return westLandscaping?{
      vertices:westLandscaping.vertexCount,triangles:westLandscaping.triangleCount,
      ancientTrees:vegetation.trees.filter(t=>t.kind==='ancient').length,
    }:null;},
    get houseModelStatus(){return modelState;},
    get palaceLoadStatus(){return palace.sourceStatus;},
    get palaceLoadFailureStage(){return palace.loadFailureStage;},
    get fountainHouseModelStatus(){return fountainHomes.state;},
    treeTrunkColliders:treeColliders.length,
    walkableSurfaces:world.walkableSurfaces??[],
    sites:WOLFVEIL_SITES,colliders,
    worldHeight:(x,z)=>wolfveilHeight(x,z-offsetZ),
    // Preserve existing client ground-ray registration and render offset.
    resolveBridgeRailCollision(position,radius=.62,previous=position){
      return resolveWolfveilBridgeRailing(
        position,previous,WOLFVEIL_BRIDGES,radius,offsetZ);
    },
    playerPalaceGroundY(position){return palace.playerGroundY(position);},
    interactPalace(position){return palace.interact(position);},
    resetPalaceNavigation(){palace.resetNavigation();},
    update(dt,weather={},playerPosition=null){
      if(disposed)return;
      elapsed+=Math.max(0,Math.min(dt,.08));
      const storm=weather.weather==='storm',rainy=storm||weather.weather==='rain';
      const windMph=Number(weather.windMph??(storm?24:rainy?13:7));
      const degMap={N:0,NE:45,E:90,SE:135,S:180,SW:225,W:270,NW:315};
      const dir=Number.isFinite(degMap[weather.windDir])?degMap[weather.windDir]:225;
      const rad=dir*Math.PI/180;
      const frame={
        time:elapsed,
        rain:rainy?(storm?1:.65):0,
        wind:[-Math.sin(rad),-Math.cos(rad)],
        gust:Math.max(0,Math.min(1,.18+windMph/35)),
      };
      vegetation.update(frame);
      palace.update(dt);
      groundCover?.update(dt,frame,playerPosition); // bent footsteps relax over time; no new collider
      ownerModels?.update(frame); // uploaded foliage, no new authoritative collision
      ownerGrassTiles?.update(); // remove late-loading outdated grass accents
      waterfall.update(frame);
      river.uniforms.uFlowTime.value=elapsed;
      river.updateAppearance?.(weather,options.sunLight,scene.fog);
      river.uniforms.uRain.value=frame.rain;
      // Damp stone and soil are separate materials; no fake flooding.
      river.uniforms.uWet.value=frame.rain;
      if(world.heroStreamMaterial?.uniforms?.uTime)
        world.heroStreamMaterial.uniforms.uTime.value=elapsed;
      return frame;
    },
    resolveBuildingCollision(position,radius=.65,previous=null,{player=false}={}){
      if(!position)return false;
      // The 62 authored hillside stones are not Luna interior stairs. Their
      // own tread-top support catches feet; a high side riser blocks motion.
      let pushed=!!(player&&previous&&palace.resolveApproachCollision?.(position,previous,radius));
      for(const b of colliders){
        const actualZ=b.z+offsetZ;
        if(b.kind==='palace'){
          // Player uses the actual Luna 3D colliders and swept stairs; the
          // old footprint-only guard stays for AI/fallback paths.
          if(player&&palace.navigationEnabled){
            if(previous&&palace.resolvePlayerMovement(position,previous,radius))pushed=true;
            continue;
          }
          if(previous&&palaceWallCrosses(previous,position,radius,offsetZ)){
            position.x=previous.x;position.z=previous.z;pushed=true;
          }
          continue;
        }
        if(b.kind==='residence'){
          // This house has a genuine 2.5m open front doorway and solid side
          // and rear walls. Check player travel across those wall planes,
          // allowing entry and exit along the central corridor only.
          if(!previous)continue;
          const front=actualZ-b.d/2,rear=actualZ+b.d/2;
          const crossed=(a,c,wall)=> (a-wall)*(c-wall)<=0&&Math.abs(a-c)>1e-6;
          const crossAt=(a,c,otherA,otherC,wall)=>
            otherA+(otherC-otherA)*(wall-a)/(c-a);
          const sideBoundary=[b.x-b.w/2,b.x+b.w/2];
          let blocked=false;
          for(const wall of sideBoundary){
            if(crossed(previous.x,position.x,wall)){
              const atZ=crossAt(previous.x,position.x,previous.z,position.z,wall);
              if(atZ>front-radius&&atZ<rear+radius)blocked=true;
            }
          }
          if(crossed(previous.z,position.z,rear)){
            const atX=crossAt(previous.z,position.z,previous.x,position.x,rear);
            if(Math.abs(atX-b.x)<b.w/2+radius)blocked=true;
          }
          if(crossed(previous.z,position.z,front)){
            const atX=crossAt(previous.z,position.z,previous.x,position.x,front);
            if(Math.abs(atX-b.x)>Math.max(0,(b.doorHalfWidth??1.25)-radius)&&
              Math.abs(atX-b.x)<b.w/2+radius)blocked=true;
          }
          if(blocked){position.x=previous.x;position.z=previous.z;pushed=true;}
          continue;
        }
        if(Math.abs(position.x-b.x)>b.w*.5+radius+.8||
          Math.abs(position.z-actualZ)>b.d*.5+radius+.8)continue;
        const dx=position.x-b.x,dz=position.z-actualZ;
        const ox=b.w*.5+radius-Math.abs(dx);
        const oz=b.d*.5+radius-Math.abs(dz);
        if(ox<=0||oz<=0)continue;
        if(ox<oz)position.x=b.x+Math.sign(dx||1)*(b.w*.5+radius);
        else position.z=actualZ+Math.sign(dz||1)*(b.d*.5+radius);
        pushed=true;
      }
      // Swept trunk collision: even a fast step cannot cross an imported
      // owner tree. Leaf canopies stay pass-through; trunk circles block.
      // The worker uses this same source list with fixed substeps.
      for(const tree of treeColliders){
        const tz=tree.z+offsetZ;
        const min=tree.radius+radius;
        const dx=position.x-tree.x,dz=position.z-tz;
        const old=previous??position;
        const vx=position.x-old.x,vz=position.z-old.z;
        const len2=vx*vx+vz*vz;
        if(len2>1e-10){
          const fx=old.x-tree.x,fz=old.z-tz;
          const t=Math.max(0,Math.min(1,-(fx*vx+fz*vz)/len2));
          const px=fx+t*vx,pz=fz+t*vz;
          if(px*px+pz*pz<min*min){
            const b=2*(fx*vx+fz*vz),a=len2;
            const discriminant=b*b-4*a*(fx*fx+fz*fz-min*min);
            if(fx*fx+fz*fz>=min*min&&discriminant>=0){
              const entry=(-b-Math.sqrt(discriminant))/(2*a);
              if(entry>=0&&entry<=1){
                const before=Math.max(0,entry-.002);
                position.x=old.x+vx*before;
                position.z=old.z+vz*before;
                pushed=true;
                continue;
              }
            }
          }
        }
        const distance=Math.hypot(position.x-tree.x,position.z-tz);
        if(distance<min){
          const nx=distance>1e-8?(position.x-tree.x)/distance:1;
          const nz=distance>1e-8?(position.z-tz)/distance:0;
          position.x=tree.x+nx*(min+.002);
          position.z=tz+nz*(min+.002);
          pushed=true;
        }
      }
      return pushed;
    },
    dispose(){
      if(disposed)return;
      disposed=true;
      houseModels?.dispose();
      fountainHomes.dispose();
      palace.dispose();
      vegetation.dispose();
      ownerGrassTiles?.dispose();
      ownerModels?.dispose();
      westLandscaping?.dispose();
      if(!fallbackDisposed)town.residenceWorld?.dispose();
      world.dispose();
    },
  };
  // One GLB download for the entire village, then shared geometry and
  // materials instanced 18 times. Only switch off procedural homes after
  // the full asset has been decoded and every house has been placed.
  const houseModels=installShadowWolfHouseModels(world,town.buildings,{
    url:options.houseModelUrl,
    loader:options.houseModelLoader,
    onReady(detail){
      if(disposed)return;
      const byId=new Map(colliders.map(c=>[c.id,c]));
      for(const {id,walls} of detail.placements){
        const collider=byId.get(id);
        if(collider)Object.assign(collider,walls);
      }
      // The renderer and Game 3D player-foot raycasts share these exact meshes.
      options.onHouseWalkableSurfaces?.(
        world.walkableSurfaces.slice(initialSurfaceCount),
      );
      town.residenceWorld?.dispose();
      fallbackDisposed=true;
      modelState='ready';
      info.featureStatus.housing='owner_supplied_shadow_wolf_house_v4_instanced_18_residences';
      info.featureStatus.interiors='house_floor_and_stair_raycasts; upper_stairs_collision_work_in_progress';
    },
    onError(error){
      if(disposed)return;
      modelState='fallback';
      console.warn('Shadow Wolf house GLB unavailable; preserving village homes:',error?.message||error);
    },
  });
  sceneState.houseModels=houseModels;
  ground.userData.wolfveilVillage=sceneState;
  return sceneState;
}