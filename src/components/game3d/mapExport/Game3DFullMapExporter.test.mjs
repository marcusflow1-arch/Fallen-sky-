import test from 'node:test';
import assert from 'node:assert/strict';
import {generateGame3DMapCode,createGame3DMapCodeBlob,showGame3DMapDownloads,validateGame3DGLB,snapshotGame3DMap}
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

test('large code downloads use a Blob, not a single concatenated source string',async()=>{
  const glb=testGLB(24576*7+113);
  const blob=createGame3DMapCodeBlob(glb,{name:'Wolfveil'});
  assert.equal(blob.type,'text/javascript;charset=utf-8');
  assert.equal(await blob.text(),generateGame3DMapCode(glb,{name:'Wolfveil'}));
});

test('export presents two user-clicked download links without auto-clicking them',()=>{
  const previous=globalThis.document;
  const body={children:[],appendChild(element){this.children.push(element);}};
  function element(tag){
    return {tag,children:[],listeners:{},style:{},attributes:{},removed:false,
      append(...xs){this.children.push(...xs);},
      appendChild(x){this.children.push(x);},
      setAttribute(key,value){this.attributes[key]=value;},
      addEventListener(type,callback){this.listeners[type]=callback;},
      remove(){this.removed=true;},
      focus(){},
      click(){throw Error('Programmatic clicks must not download files');},
    };
  }
  globalThis.document={
    body,createElement:element,
    getElementById(id){return body.children.find(x=>x.id===id&&!x.removed)||null;},
  };
  try{
    const glb=testGLB(),codeBlob=createGame3DMapCodeBlob(glb);
    const first=showGame3DMapDownloads({glb,codeBlob,name:'Wolfveil Full',stats:{meshes:2,instancedMeshes:1}});
    const panel=body.children.at(-1),content=panel.children[0];
    const links=content.children.find(x=>x.tag==='div').children;
    assert.equal(links.length,2);
    assert.equal(links[0].download,'Wolfveil_Full.glb');
    assert.equal(links[1].download,'Wolfveil_Full.mjs');
    assert.match(links[0].href,/^blob:/);
    assert.match(links[1].href,/^blob:/);
    // Creating new download links closes/revokes the former set.
    const second=showGame3DMapDownloads({glb,codeBlob,name:'Retry',stats:{meshes:2,instancedMeshes:1}});
    assert.equal(panel.removed,true);
    assert.notEqual(first.glbURL,second.glbURL);
    second.close();
    assert.equal(body.children.at(-1).removed,true);
  }finally{
    if(previous===undefined)delete globalThis.document;
    else globalThis.document=previous;
  }
});
