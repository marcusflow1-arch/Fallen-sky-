import test from 'node:test';
import assert from 'node:assert/strict';
import {generateGame3DMapCode,validateGame3DGLB,snapshotGame3DMap}
  from './Game3DFullMapExporter.mjs';
function testGLB(length=49){
  const data=new Uint8Array(length),view=new DataView(data.buffer);
  view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);
  view.setUint32(8,length,true);
  for(let i=12;i<length;i++)data[i]=(i*13)%255;
  return data;
}
test('the complete binary round-trips through generated pure-code map',async()=>{
  const bytes=testGLB(24576*3+151);
  const code=generateGame3DMapCode(bytes,{name:'Wolfveil',region:'wolfveil'});
  const module=await import('data:text/javascript;base64,'+btoa(code));
  assert.equal(module.MAP_NAME,'Wolfveil');
  assert.equal(module.MAP_REGION,'wolfveil');
  assert.deepEqual(module.mapBytes(),bytes);
  assert.deepEqual(new Uint8Array(module.mapGLB()),bytes);
});
test('GLB validation fails on bad magic, version, size, and truncated file',()=>{
  const original=testGLB();
  const badMagic=original.slice();badMagic[0]=0;
  const badVersion=original.slice();badVersion[4]=5;
  assert.throws(()=>validateGame3DGLB(badMagic),/Invalid/);
  assert.throws(()=>validateGame3DGLB(badVersion),/Invalid/);
  assert.throws(()=>validateGame3DGLB(original.slice(0,21)),/Invalid/);
  assert.throws(()=>validateGame3DGLB(new Uint8Array(5)),/too small/);
});
test('the generated module escapes attacker-controlled names',async()=>{
  const name='";throw Error("injected");//';
  const module=await import('data:text/javascript;base64,'+
    btoa(generateGame3DMapCode(testGLB(),{name})));
  assert.equal(module.MAP_NAME,name);
});
test('cannot claim a complete map when the scene is empty',()=>{
  class Group{constructor(){this.children=[];}add(x){this.children.push(x);}}
  const scene={traverse(f){f({});},updateMatrixWorld(){}};
  assert.throws(()=>snapshotGame3DMap(scene,{Group}),/No loaded map geometry/);
});
