// Owner-provided Sanctuary prototype: refactored from browser-globals/r128 to
// shader modules for the live Game 3D Three.js renderer. Texture-free geometry.
export const BLAZE_NOISE = /* glsl */`
float bHash12(vec2 p){
  vec3 p3=fract(vec3(p.xyx)*.1031);
  p3+=dot(p3,p3.yzx+33.33);
  return fract((p3.x+p3.y)*p3.z);
}
float bNoise2D(vec2 p){
  vec2 i=floor(p),f=fract(p);
  f=f*f*(3.-2.*f);
  return mix(mix(bHash12(i),bHash12(i+vec2(1,0)),f.x),
    mix(bHash12(i+vec2(0,1)),bHash12(i+vec2(1,1)),f.x),f.y);
}
float bFbm2D(vec2 p){
  return .55*bNoise2D(p)+.30*bNoise2D(p*2.03+vec2(3.7,-1.9))
      +.15*bNoise2D(p*4.11+vec2(-2.3,5.1));
}
vec3 blazePalette(float idx,vec3 jade,vec3 vermilion,vec3 cobalt){
  vec3 ordinary=mix(mix(jade,vermilion,clamp(idx,0.,1.)),
      cobalt,clamp(idx-1.,0.,1.));
  // Desert material: warm light brown with ink-black roots and dry-brush
  // pockets. No forced blue/green coloring in arid regions.
  float arid=step(2.5,idx);
  float tint=clamp(dot(ordinary,vec3(.299,.587,.114)),0.,1.);
  vec3 sand=mix(vec3(.075,.064,.052),vec3(.74,.56,.36),tint);
  return mix(ordinary,sand,arid);
}
`;
export const BLAZE_GRASS_VERTEX = /* glsl */`
#include <common>
attribute float aPhase;
attribute float aScale;
attribute float aBiomeIndex;
uniform float uTime,uFlameSpeed,uCurlAmp,uWindStrength;
uniform vec3 uPlayerPos;
varying vec2 vUv;
varying vec3 vWorldPos;
varying float vPhase,vScale,vBiomeIndex;
void main(){
 vUv=uv;vPhase=aPhase;vScale=aScale;vBiomeIndex=aBiomeIndex;
 float h=uv.y;
 vec3 local=position;
 float slowT=uTime*uFlameSpeed*2.4;
 vec4 origin=modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
 float breeze=sin(origin.x*.14+origin.z*.11-slowT*.9+aPhase*6.28);
 float s1=sin(h*4.8-slowT*2.6+aPhase*12.56);
 float s2=cos(h*8.2-slowT*3.9+aPhase*19.4);
 float swell=(s1*.031+s2*.012)*pow(h,1.25)*uCurlAmp;
 local.x+=swell;
 local.z+=cos(h*4.2-slowT*2.2+aPhase*9.1)*.025*pow(h,1.3)*uCurlAmp;
 vec4 wp=modelMatrix*instanceMatrix*vec4(local,1.);
 wp.x+=breeze*.048*pow(h,1.35)*uCurlAmp*uWindStrength;
 wp.z+=cos(origin.z*.15-slowT*.75+aPhase*4.)*
    .035*pow(h,1.35)*uCurlAmp*uWindStrength;
 vec2 away=wp.xz-uPlayerPos.xz;
 float dist=length(away);
 if(dist<2.6){
   float push=(1.-dist/2.6)*pow(h,1.2)*.075;
   wp.xz+=normalize(away+vec2(.0001))*push;
 }
 vWorldPos=wp.xyz;
 gl_Position=projectionMatrix*viewMatrix*wp;
}`;
export const BLAZE_GRASS_FRAGMENT = /* glsl */`
#include <common>
uniform float uTime,uFlameSpeed,uPinchAmount,uInkWeight,uCurlAmp;
uniform float uPalette,uArtProfile,uLiquidGlass,uGlareBoost,uBrightness,uFusion;
uniform vec3 uSunDir;
varying vec2 vUv;
varying vec3 vWorldPos;
varying float vPhase,vScale,vBiomeIndex;
/* BLAZE_NOISE */
void main(){
 float h=vUv.y,u=vUv.x*2.-1.;
 float slowT=uTime*uFlameSpeed*2.8;
 float biomePalette=step(2.5,vBiomeIndex)*3.0+
   (1.0-step(2.5,vBiomeIndex))*uPalette;
 float s1=sin(h*9.5-slowT*3.2+vPhase*15.7)*.22;
 float s2=sin(h*17.-slowT*5.1+vPhase*27.3)*.11;
 float jitter=(bFbm2D(vec2(h*7.-slowT*1.8,vPhase*13.))-.5)*.18;
 float spine=(s1+s2+jitter)*smoothstep(.06,.85,h)*uCurlAmp;
 float d=abs(u-spine);
 // Physical flame-shaped blade, neck constrictions and a detached droplet.
 float body=sin(clamp(h*1.15,.05,1.)*3.14159)*(1.-pow(h,1.45)*.72);
 body=max(body,(1.-h)*.58);
 float waveCoord=h*4.4-slowT*1.35+vPhase*10.;
 float droplet=sin(fract(waveCoord)*3.14159);
 float pinch=smoothstep(.38,.74,h)*pow(1.-droplet,1.45)*.88*uPinchAmount;
 float evaporation=smoothstep(.76,.98,h)*.55;
 float brush=bFbm2D(vec2(u*3.5,h*9.-slowT*2.2+vPhase*7.));
 float width=body-pinch-evaporation+(brush-.5)*.14*smoothstep(.38,.74,h);
 float margin=width-d;
 if(margin<0.)discard; // real split in the upper blade, not a particle overlay
 float inkBorder=1.-smoothstep(0.,(.14+.08*(1.-brush))*uInkWeight,margin);
 float dryHair=smoothstep(.65,.95,sin((u-spine)*48.+brush*5.))
   *smoothstep(.25,.85,h)*.28;
 float core=(1.-smoothstep(0.,max(.05,width*.48),d))*
   smoothstep(.08,.85,h);
 vec3 root=blazePalette(biomePalette,vec3(.04,.20,.15),vec3(.26,.05,.04),vec3(.06,.12,.34));
 vec3 mid=blazePalette(biomePalette,vec3(.11,.52,.34),vec3(.82,.22,.08),vec3(.10,.44,.95));
 vec3 tip=blazePalette(biomePalette,vec3(.68,.92,.42),vec3(1.,.68,.14),vec3(0.,.88,1.));
 vec3 coreColor=blazePalette(biomePalette,vec3(.98,.99,.88),vec3(1.,.97,.86),vec3(.96,.99,1.));
 vec3 fire=mix(root,mid,smoothstep(0.,.45,h));
 fire=mix(fire,tip*1.05,smoothstep(.35,.78,h+(brush-.5)*.2));
 fire=mix(fire,coreColor*1.12,clamp(core*.75+dryHair,0.,1.));
 float rootInk=1.-smoothstep(0.,.14,h);
 float smoke=smoothstep(.82,.97,h)*.55;
 vec3 sumi=mix(fire,vec3(.03,.025,.03),
    clamp(inkBorder*.94+rootInk*.85+smoke,0.,.96));
 // Faithful profile options from the owner's reference.
 vec3 anime=mix(vec3(.04,.18,.09),root*.95,.38);
 anime=mix(anime,mix(vec3(.11,.44,.19),mid*.92,.42),
   smoothstep(.20,.26,h+(brush-.5)*.08));
 anime=mix(anime,mix(vec3(.46,.68,.22),tip*.88,.42),
   smoothstep(.54,.60,h+(brush-.5)*.10));
 anime=mix(anime,coreColor,core*.25);
 anime=mix(anime,vec3(.05,.04,.05),
   clamp(inkBorder*.74+rootInk*.62+smoke*.50,0.,.9));
 float veins=.5+.5*sin(d*95.);
 vec3 botanical=mix(vec3(.04,.14,.03),vec3(.14,.36,.08),
    smoothstep(0.,.55,h))*(.88+.22*veins);
 botanical+=vec3(.18,.30,.05)*pow(clamp(h,0.,1.),1.4)*(1.-d*.5);
 vec3 photo=mix(botanical,mix(tip,coreColor,core),
    smoothstep(.45,.88,h+(1.-margin)*.25));
 float animeWeight=1.-clamp(abs(uArtProfile-1.),0.,1.);
 float realistic=clamp(uArtProfile-1.,0.,1.);
 float sumiWeight=clamp(1.-uArtProfile,0.,1.);
 vec3 col=sumi*sumiWeight+anime*animeWeight+photo*realistic;
 // Fusion: energetic cobalt/violet filaments rise WITHIN the same blade,
 // preserving green source pigment and a dark graphic Sumi-e outer edge.
 float safeFusion=uFusion*(1.-step(2.5,vBiomeIndex)*.90);
 float current=smoothstep(.40,.89,
    .5+.5*sin(h*28.-slowT*4.5+vPhase*17.+brush*4.));
 float upper=smoothstep(.25,.88,h);
 vec3 plasma=mix(vec3(.07,.37,.89),vec3(.23,.12,.62),
    .5+.5*sin(h*13.-slowT*2.1+vPhase*8.));
 col=mix(col,mix(col*.55,plasma,.80),
    safeFusion*upper*current*.60);
 float darkPocket=smoothstep(.72,.98,
    .5+.5*sin(h*39.-slowT*3.2+vPhase*24.));
 col=mix(col,vec3(.017,.024,.029),
    safeFusion*upper*darkPocket*.27);
 // Opaque wet lacquer/glass (not a translucent screen wash).
 vec3 N=normalize(vec3((u-spine)*1.35,.35,.85));
 vec3 V=normalize(cameraPosition-vWorldPos);
 vec3 L=normalize(uSunDir),H=normalize(V+L);
 vec3 ripple=vec3(bNoise2D(vWorldPos.xz*2.4+vec2(0.,-uTime*1.1))-.5,
       .16,bNoise2D(vWorldPos.zx*2.4+vec2(uTime*.9,0.))-.5);
 N=normalize(N+ripple*.22*uLiquidGlass);
 float fres=.04+.96*pow(1.-clamp(dot(N,V),0.,1.),3.8);
 float spec=pow(max(0.,dot(N,H)),140.)*.52;
 vec3 wet=mix(vec3(dot(col,vec3(.299,.587,.114))),col,
    1.+.32*uLiquidGlass)*(1.-.20*uLiquidGlass);
 col=mix(col,wet,clamp(uLiquidGlass,0.,1.));
 col+=vec3(.76,.88,.95)*fres*.18*uLiquidGlass*(.30+.70*uGlareBoost);
 col+=vec3(.92,.96,1.)*spec*uLiquidGlass*uGlareBoost;
 col=clamp(col*uBrightness,vec3(0.),vec3(1.24));
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`.replace('/* BLAZE_NOISE */',BLAZE_NOISE);
export const BLAZE_EMBER_VERTEX = /* glsl */`
#include <common>
attribute vec3 aSpawn;
attribute float aPhase;
attribute float aBiomeIndex;
uniform float uTime,uFlameSpeed,uWindStrength;
varying vec2 vUv;
varying float vLife,vPhase,vBiomeIndex;
void main(){
 vUv=uv;vPhase=aPhase;vBiomeIndex=aBiomeIndex;
 float t=uTime*uFlameSpeed*.55;
 float life=fract(aPhase+t);
 vLife=life;
 float envelope=sin(life*3.14159)*(1.-life*.45);
 vec3 pos=position;
 pos.x*=envelope;
 pos.y*=envelope*(1.+life*.6);
 pos.x+=sin(uv.y*4.5-uTime*3.+aPhase*12.)*.06;
 vec3 wp=aSpawn;
 wp.y+=.39+life*1.95;
 wp.x+=sin(t*3.+aPhase*19.)*.25*life*uWindStrength;
 wp.z+=cos(t*2.4+aPhase*13.)*.25*life*uWindStrength;
 gl_Position=projectionMatrix*viewMatrix*vec4(wp+pos,1.);
}`;
export const BLAZE_EMBER_FRAGMENT = /* glsl */`
#include <common>
uniform float uTime,uPalette,uInkWeight,uBrightness,uFusion;
varying vec2 vUv;
varying float vLife,vPhase,vBiomeIndex;
void main(){
 float h=vUv.y,u=vUv.x*2.-1.;
 float wiggle=sin(h*6.-uTime*3.5+vPhase*11.)*.18;
 float radius=sin(h*3.14159)*(1.-vLife*.65);
 float margin=radius-abs(u-wiggle);
 if(margin<0.)discard;
 float rim=1.-smoothstep(0.,.34*uInkWeight,margin);
 vec3 jade=mix(vec3(.20,.72,.42),vec3(.95,.99,.82),h);
 vec3 verm=mix(vec3(.92,.34,.10),vec3(1.,.92,.65),h);
 vec3 blue=mix(vec3(.12,.55,1.),vec3(.88,.98,1.),h);
 vec3 fire=mix(mix(jade,verm,clamp(uPalette,0.,1.)),
      blue,clamp(uPalette-1.,0.,1.));
 vec3 desert=mix(vec3(.10,.076,.055),vec3(.83,.65,.38),h);
 fire=mix(fire,desert,step(2.5,vBiomeIndex));
 fire=mix(fire,vec3(.10,.53,.92),
    uFusion*(1.-step(2.5,vBiomeIndex)*.9)*smoothstep(.25,.95,vLife)*.58);
 vec3 col=mix(fire,vec3(.025,.022,.018),clamp(rim+vLife*.45,0.,.95));
 gl_FragColor=vec4(clamp(col*uBrightness,vec3(0.),vec3(1.1)),1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
