/**
 * Shared, rig-independent math for cursor-following fused creator previews.
 * Values are radians and never leave the preview; no appearance data is saved.
 * The authored Getsuga/Artemis creator gaze remains owned by CreatorFace.
 */
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const smoothstep=(edge0,edge1,value)=>{
  const t=clamp((value-edge0)/(edge1-edge0),0,1);
  return t*t*(3-2*t);
};
const finite=Number.isFinite;

export function normalizeCreatorGazePointer(clientX,clientY,rect){
  if(!finite(clientX)||!finite(clientY)||!rect||
    !finite(rect.left)||!finite(rect.top)||
    !finite(rect.width)||!finite(rect.height)||
    rect.width<=0||rect.height<=0)
    return {x:0,y:0,valid:false};
  return {
    x:clamp(2*(clientX-rect.left)/rect.width-1,-1,1),
    y:clamp(2*(clientY-rect.top)/rect.height-1,-1,1),
    valid:true,
  };
}

/**
 * The model looks toward the creator's virtual camera at rest, then follows
 * the mouse within comfortable anatomical limits (eyes move with the head).
 * Walking/dragging, a turned-away model, or reduced-motion preferences disable
 * the extra motion. The neutral pose is always recoverable without drift.
 */
export function computeCreatorCursorGaze({
  x=0,y=0,modelYaw=0,dragging=false,
  tracking=false,reducedMotion=false,
}={}){
  if(!finite(x)||!finite(y)||!finite(modelYaw))
    return {neckYaw:0,headYaw:0,neckPitch:0,headPitch:0,weight:0};
  const facing=Math.atan2(Math.sin(modelYaw),Math.cos(modelYaw));
  const front=1-smoothstep(0.86,1.4,Math.abs(facing));
  const weight=dragging||reducedMotion?0:front;
  if(weight<=0)return {neckYaw:0,headYaw:0,neckPitch:0,headPitch:0,weight:0};
  // The face subtly returns its attention to the camera between mouse moves.
  const cameraBias=-clamp(facing,-0.45,0.45)*0.7;
  const glance=tracking?clamp(x,-1,1)*0.29:0;
  const pitch=tracking?clamp(y,-1,1)*0.15:0; // screen-down = head-down
  const yaw=clamp(cameraBias+glance,-0.39,0.39)*weight;
  const upDown=clamp(pitch,-0.15,0.15)*weight;
  return {
    neckYaw:yaw*0.3,
    headYaw:yaw*0.7,
    neckPitch:upDown*0.25,
    headPitch:upDown*0.75,
    weight,
  };
}
