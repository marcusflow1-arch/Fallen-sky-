// Walkable floors and walls of the assembled town, baked from its real
// triangles into a grid. Pure data (no THREE) so it can be checked offline.
export const WOLFVEIL_TOWN_COLLISION=Object.freeze({
  cell:.25,       // quarter-metre grid preserves individual stair tread edges
  stepUp:.30,     // a character must ascend each tread, not jump a 1.1m kerb
  stepDown:.60,   // prevent stepping over a ledge into a deep drop
  headroom:2.2,   // geometry above stepUp, below headroom, is a wall
  bodyPad:2,      // .5m full-body margin from sharp architecture
});

// Visits evenly spaced points across every triangle of a mesh.
function sampleTriangles({position:p,index},spacing,accept,visit){
  const count=index?index.length:p.length/3;
  for(let t=0;t<count;t+=3){
    const a=(index?index[t]:t)*3,b=(index?index[t+1]:t+1)*3,c=(index?index[t+2]:t+2)*3;
    const ax=p[a],ay=p[a+1],az=p[a+2],bx=p[b],by=p[b+1],bz=p[b+2],cx=p[c],cy=p[c+1],cz=p[c+2];
    if(!accept(ax,ay,az,bx,by,bz,cx,cy,cz))continue;
    const span=Math.max(Math.hypot(bx-ax,by-ay,bz-az),Math.hypot(cx-ax,cy-ay,cz-az),
      Math.hypot(cx-bx,cy-by,cz-bz));
    const steps=Math.min(96,Math.max(1,Math.ceil(span/spacing)));
    for(let i=0;i<=steps;i++)for(let k=0;k<=steps-i;k++){
      const u=i/steps,v=k/steps,w=1-u-v;
      visit(ax*w+bx*u+cx*v,ay*w+by*u+cy*v,az*w+bz*u+cz*v);
    }
  }
}

// meshes: [{role:'floor'|'solid',position:Float32Array(world xyz),index}]
// circles: [{x,z,radius}] solid round obstacles such as the plaza tree.
export function bakeWolfveilTownCollision({meshes,minX,minZ,maxX,maxZ,baseY,circles=[]}){
  const {cell,stepUp,stepDown,headroom,bodyPad}=WOLFVEIL_TOWN_COLLISION;
  const cols=Math.ceil((maxX-minX)/cell),rows=Math.ceil((maxZ-minZ)/cell);
  const top=new Float32Array(cols*rows).fill(NaN),wall=new Uint8Array(cols*rows);
  const at=(x,z)=>{
    const c=Math.floor((x-minX)/cell),r=Math.floor((z-minZ)/cell);
    return c<0||r<0||c>=cols||r>=rows?-1:r*cols+c;
  };
  const groundOf=i=>i>=0&&top[i]===top[i]?top[i]:baseY;

  // 1. Floors: the highest flat surface in each cell.
  const flat=(ax,ay,az,bx,by,bz,cx,cy,cz)=>{
    const nx=(by-ay)*(cz-az)-(bz-az)*(cy-ay),ny=(bz-az)*(cx-ax)-(bx-ax)*(cz-az),
      nz=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
    return Math.abs(ny)>.6*Math.hypot(nx,ny,nz);
  };
  let highest=baseY;
  for(const mesh of meshes)if(mesh.role!=='solid')sampleTriangles(mesh,cell*.5,flat,(x,y,z)=>{
    const i=at(x,z);
    if(i<0)return;
    // Lower walkable levels win under overlapping roofs/raised decor.
    if(!Number.isFinite(top[i]) || Math.abs(y-baseY)<Math.abs(top[i]-baseY))top[i]=y;
    if(y>highest)highest=y;
  });

  // 2. Walls: anything solid at body height above the floor it stands on.
  const bodyHeight=(ax,ay,az,bx,by,bz,cx,cy,cz)=>
    !flat(ax,ay,az,bx,by,bz,cx,cy,cz)&&
    Math.max(ay,by,cy)>baseY+stepUp&&Math.min(ay,by,cy)<highest+headroom;
  for(const mesh of meshes)if(mesh.role!=='floor')sampleTriangles(mesh,cell*.5,bodyHeight,(x,y,z)=>{
    const i=at(x,z);
    if(i<0)return;
    const ground=groundOf(i);
    if(y>ground+stepUp+.05&&y<ground+headroom)wall[i]=1;
  });

  // 3. Pad walls by the character's body so a single point test is enough.
  const solid=new Uint8Array(cols*rows);
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    if(!wall[r*cols+c])continue;
    for(let dr=-bodyPad;dr<=bodyPad;dr++)for(let dc=-bodyPad;dc<=bodyPad;dc++){
      const rr=r+dr,cc=c+dc;
      if(rr>=0&&cc>=0&&rr<rows&&cc<cols)solid[rr*cols+cc]=1;
    }
  }
  for(const circle of circles){
    const reach=circle.radius+cell*bodyPad;
    for(let z=circle.z-reach;z<=circle.z+reach;z+=cell)for(let x=circle.x-reach;x<=circle.x+reach;x+=cell){
      const i=at(x,z);
      if(i>=0&&Math.hypot(x-circle.x,z-circle.z)<=reach)solid[i]=1;
    }
  }

  const blocked=(x,z,fromX,fromZ)=>{
    const i=at(x,z);
    if(i<0)return false;
    const delta=groundOf(i)-groundOf(at(fromX,fromZ));
    return solid[i]===1||delta>stepUp+.005||delta< -stepDown-.005;
  };
  return {
    cols,rows,cell,
    /** Height of the town floor here, or null where there is none. */
    groundAt(x,z){const i=at(x,z);return i>=0&&top[i]===top[i]?top[i]:null;},
    isSolid(x,z){const i=at(x,z);return i>=0&&solid[i]===1;},
    blocked,
    /** Sub-step every movement, including sprint, dodge and click-to-move. */
    resolve(position,previous){
      if(!previous||!Number.isFinite(position?.x)||!Number.isFinite(position?.z)||
         !Number.isFinite(previous.x)||!Number.isFinite(previous.z))return false;
      const px=previous.x,pz=previous.z,start=at(px,pz);
      // If an imported object spawned over the character, let them escape.
      if(start>=0&&solid[start])return false;
      const dx=position.x-px,dz=position.z-pz;
      const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.125));
      let x=px,z=pz,hit=false;
      for(let n=1;n<=steps;n++){
        const gx=px+dx*n/steps,gz=pz+dz*n/steps;
        if(!blocked(gx,gz,x,z)){x=gx;z=gz;continue;}
        hit=true;
        // Stay on the current stair tread and slide along a wall; never
        // teleport directly from one stair to a higher nonadjacent stair.
        if(!blocked(gx,z,x,z))x=gx;
        else if(!blocked(x,gz,x,z))z=gz;
      }
      position.x=x;position.z=z;
      return hit;
    },
  };
}