import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSuigenTerrainHeightSampler}
  from '../src/components/game3d/worlds/SuigenTerrainHeight.mjs';

test('Suigen height sampler reads 2D grid elevation without heavy raycasts',()=>{
  const root=new THREE.Group();
  const position=[];
  for(const z of [-10,0,10])for(const x of [-10,0,10]){
    position.push(x,x*.2+z*.35+5,z);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(position,3));
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());
  mesh.name='Map_Terrain_2400m';
  root.add(mesh);
  const height=createSuigenTerrainHeightSampler(root);
  assert.equal(height(-10,-10),-.5);
  assert.equal(height(0,0),5);
  assert.equal(height(10,10),10.5);
  assert.equal(height(-5,5),5.75);
  assert.equal(height(0,-10),1.5);
  assert.equal(height(-10,0),3);
  assert.equal(height(12,0),null);
  assert.equal(height(0,-12),null);
  assert.equal(height(Number.NaN,0),null);
  assert.equal(height(0,Infinity),null);
  geometry.dispose();mesh.material.dispose();
});

test('An unavailable/renamed terrain is a safe empty sampler',()=>{
  const root=new THREE.Group();
  const sample=createSuigenTerrainHeightSampler(root);
  assert.equal(sample(0,0),null);
});
