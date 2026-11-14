// Sumi-e ink wash: the look of the Game 3D world (docs/game3d/SUMI_E_LOOK.md; the Wuxia blueprint's art direction,
// owner decision D7: the whole world). The scene is drawn as usual into an off-screen image with its depth, and one
// full-screen pass paints it as ink on rice paper:
//   - its brightness laid down in a few soft tones of diluted ink, unevenly, as a wet brush leaves it;
//   - coloured pigment retained across foliage, clothing and sky, with the original muted wash available as Classic;
//   - ink lines where the depth folds (silhouettes, creases) and, at the top level, where the brightness turns, their
//     width and darkness wandering like a brush's, thinning out with distance;
//   - mist: the distance fades into the paper as far mountains do on a scroll (into dark ink at night: the mist takes
//     the world's own fog colour, which the time of day sets);
//   - the paper: fibres, grain, soft blotches, the edge of the sheet a little darker.
// About two extra GPU passes and no extra CPU draw work beyond one triangle (the frame is CPU-bound by draw calls:
// RENDERING_BASELINE.md). Level 0 draws exactly as before. The level follows the pause menu's Graphics settings.
import * as THREE from 'three';

// what the pause menu's Quality preset means for the ink: low = tones, mist and paper; medium = + ink lines from depth;
// high = + lines where the brightness turns; ultra = + multisampled (2x) edges, which cost the most
// (docs/game3d/SUMI_E_LOOK.md#cost)
export const INK_LEVELS = Object.freeze({ off: 0, low: 1, medium: 2, high: 3, ultra: 4 });
export const GRAPHICS_SETTINGS_KEY = 'game_graphics_settings';
export const ART_STYLES = Object.freeze(['ink', 'original', 'atomic-ultra-sumi']);
// sRGB 0..1
export const INK_PALETTE = Object.freeze({ paper: [0.94, 0.91, 0.84], ink: [0.06, 0.055, 0.065], mist: [0.91, 0.9, 0.86] });
export const INK_TUNING = Object.freeze({ colorKeep: 0.4, lineWidth: 1.6, mistNear: 40, mistFar: 600 });
// Display-space pigments. These profiles share the same pass, textures and quality levels.
export const INK_COLOR_PROFILES = Object.freeze({
  vibrant: Object.freeze({
    paper: [0.98, 0.96, 0.90], ink: [0.035, 0.055, 0.08], mist: [0.80, 0.88, 0.94],
    colorKeep: 0.94, washLift: 0.28, vibrance: 0.22, lineStrength: 0.86,
    mistNear: 70, mistFar: 900, mistStrength: 0.62, skyMist: 0.035, fogColorKeep: 0.88,
  }),
  classic: Object.freeze({
    ...INK_PALETTE, ...INK_TUNING, washLift: 1, vibrance: 0, lineStrength: 0.95,
    mistStrength: 0.86, skyMist: 0.15, fogColorKeep: 0,
  }),
});

export function inkPaletteFor(settings) {
  return settings?.inkPalette === 'classic' ? 'classic' : 'vibrant';
}
export function resolveInkPalette({ search = globalThis.location?.search, storage = globalThis.localStorage } = {}) {
  const override = new URLSearchParams(search || '').get('inkPalette');
  return override === 'vibrant' || override === 'classic' ? override : inkPaletteFor(readGraphicsSettings(storage));
}

// the level for these Graphics settings (the art style defaults to ink, the quality to high)
export function inkLevelFor(settings) {
  const s = settings || {};
  if ((s.artStyle ?? 'ink') !== 'ink') return 0;
  return INK_LEVELS[s.quality] ?? INK_LEVELS.high;
}
export function readGraphicsSettings(storage = globalThis.localStorage) {
  try { return JSON.parse(storage?.getItem(GRAPHICS_SETTINGS_KEY) || 'null') || {}; } catch { return {}; }
}
// ?ink=off|low|medium|high|ultra overrides the settings (for reviewing and benchmarking); null when absent or unknown
export function inkLevelFromUrl(search) {
  const v = new URLSearchParams(search || '').get('ink');
  return v != null && Object.prototype.hasOwnProperty.call(INK_LEVELS, v) ? INK_LEVELS[v] : null;
}
export function resolveInkLevel({ search = globalThis.location?.search, storage = globalThis.localStorage } = {}) {
  return inkLevelFromUrl(search) ?? inkLevelFor(readGraphicsSettings(storage));
}

// The same brightness-to-ink tone as the shader's washTone (without the brush's unevenness), for values worked out once a
// frame on the CPU instead of for every pixel.
export function washToneOf(L) {
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const t = smooth(0.1, 0.92, Math.min(1, Math.max(0, L / (L + 0.16) * 1.16)));
  const bands = (Math.floor(t * 3) + smooth(0.2, 0.8, (t * 3) % 1)) / 3;
  return t + (bands - t) * 0.3;
}
// World's linear fog -> displayed pigment. Vibrant retains its blue/warm weather tint; Classic uses a paper wash.
export function mistColorFor(fog, exposure = 1, out = [0, 0, 0], palette = 'vibrant') {
  const profile = INK_COLOR_PROFILES[inkPaletteFor({ inkPalette: palette })];
  const aces = (x) => Math.min(1, Math.max(0, (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)));
  const srgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
  const d = [fog.r, fog.g, fog.b].map((c) => srgb(aces(c * exposure * 0.8))); // (Narkowicz's fit; 0.8 brings it close to three.js's ACES)
  const tone = Math.max(washToneOf(0.299 * d[0] + 0.587 * d[1] + 0.114 * d[2]), 0.12);
  for (let i = 0; i < 3; i++) {
    const wash = profile.ink[i] + (profile.mist[i] - profile.ink[i]) * tone;
    out[i] = wash + (d[i] - wash) * profile.fogColorKeep;
  }
  return out;
}

const VERTEX = /* glsl */`
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAGMENT = /* glsl */`
#include <packing>
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uResolution;
uniform float uNear, uFar, uLevel, uColorKeep, uLineWidth, uMistNear, uMistFar;
uniform float uVibrant, uWashLift, uVibrance, uLineStrength, uMistStrength, uSkyMist;
uniform vec3 uPaper, uInk, uMistColor;
varying vec2 vUv;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
// the renderer's own tone mapping (and exposure), then sRGB: the colours as the original look shows them
vec3 toDisplay(vec3 hdr) {
#ifdef TONE_MAPPING
  vec3 c = clamp(toneMapping(hdr), 0.0, 1.0);
#else
  vec3 c = clamp(hdr, 0.0, 1.0);
#endif
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 colorAt(vec2 uv) { return toDisplay(texture2D(tColor, uv).rgb); }
float distAt(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar); }
// a brightness as ink: lifted (a dark scene is a wash, not a black sheet), the paper left bare for the light, a hint of
// the separate tones of layered washes, laid unevenly
float washTone(float L, float wet) {
  float lift = L / (L + 0.16) * 1.16;
  float t = smoothstep(0.1, 0.92, clamp(lift + wet, 0.0, 1.0));
  float bands = (floor(t * 3.0) + smoothstep(0.2, 0.8, fract(t * 3.0))) / 3.0;
  return mix(t, bands, 0.3);
}
// how much of a line this pixel is, from the distance around it at offset o (in uv)
float foldAt(vec2 uv, float dist, vec2 o) {
  float dN = distAt(uv + vec2(0.0, o.y)), dS = distAt(uv - vec2(0.0, o.y)), dE = distAt(uv + vec2(o.x, 0.0)), dW = distAt(uv - vec2(o.x, 0.0));
  return (abs(dN + dS - 2.0 * dist) + abs(dE + dW - 2.0 * dist)) / max(dist, 0.5); // the second difference, relative: silhouettes and creases, not a slope
}

void main() {
  vec2 px = vUv * uResolution, texel = 1.0 / uResolution;
  float raw = texture2D(tDepth, vUv).x;
  // nothing drawn here but the sky dome: it writes no depth, and its shader (WorldEnvironmentSystem) puts out its colours
  // as they are shown, without tone mapping or sRGB, so they are taken as they are - and it gets its own colour, not mist
  bool sky = raw >= 0.99999;
  vec3 c = sky ? clamp(texture2D(tColor, vUv).rgb, 0.0, 1.0) : colorAt(vUv);
  float L = luma(c), dist = distAt(vUv);

  // the wash: unevenly laid, grainy where it is half-diluted (pigment settling in the paper), and dry-brushed in the
  // darkest masses so a big shadow is strokes with paper showing through, not a black slab
  float blot = fbm(px / 150.0 + 3.1) - 0.5; // one soft field for the wash's unevenness and the paper's blotches
  float wet = blot * 0.06;
  float tone = washTone(L, wet);
  tone += (vnoise(px / 2.5) - 0.5) * 0.12 * tone * (1.0 - tone);
  vec2 stroke = mat2(0.94, 0.34, -0.34, 0.94) * px; // brush strokes run a little off the horizontal
  float dry = smoothstep(0.62, 0.92, vnoise(vec2(stroke.x / 160.0, stroke.y / 9.0)) * 0.75 + vnoise(stroke / vec2(24.0, 3.5)) * 0.25);
  if (!sky) tone += dry * 0.2 * (1.0 - smoothstep(0.0, 0.32, tone)); // (on the sky they would read as rain)
  vec3 wash = mix(uInk, uPaper, clamp(tone, 0.0, 1.0));
  // Classic keeps the original subdued wash. Vibrant retains ordinary midtone pigments as well as bright effects.
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), sat = mx > 1e-3 ? (mx - mn) / mx : 0.0;
  float keep = uColorKeep * (0.25 + 0.75 * smoothstep(0.3, 0.85, sat)) * smoothstep(0.12, 0.5, mx);
  vec3 tinted = clamp(c * (luma(wash) / max(L, 0.04)), 0.0, 1.0);
  vec3 col = mix(wash, tinted, keep);
  if (uVibrant > 0.5) {
    // Preserve lighting, including night, while letting a little paper show through the wash.
    float targetL = mix(L, luma(wash), uWashLift * smoothstep(0.015, 0.18, L));
    vec3 pigment = c * (targetL / max(L, 0.0001));
    float center = luma(pigment);
    vec3 chroma = (pigment - vec3(center)) * (1.0 + uVibrance * (1.0 - sat));
    // Compress chroma together at the gamut boundary instead of clipping channels and changing their hue.
    float hi = max(chroma.r, max(chroma.g, chroma.b));
    float lo = min(chroma.r, min(chroma.g, chroma.b));
    float fit = min(1.0, min((1.0 - center) / max(hi, 0.0001), center / max(-lo, 0.0001)));
    pigment = vec3(center) + chroma * max(fit, 0.0);
    vec3 paper = wash * (center / max(luma(wash), 0.0001));
    col = mix(paper, pigment, uColorKeep);
  }

  // ink lines, two brush widths so they read at a distance
  if (uLevel >= 2.0) {
    float brush = vnoise(px / 11.0);
    vec2 o = texel * uLineWidth * (0.6 + 0.9 * brush);
    float line = max(smoothstep(0.03, 0.12, foldAt(vUv, dist, o)), smoothstep(0.08, 0.3, foldAt(vUv, dist, o * 1.7)) * 0.45);
    if (uLevel >= 3.0) {
      // where the light turns: the contrast of the linear brightness around, relative to it (no tone mapping per tap)
      float lE = luma(texture2D(tColor, vUv + vec2(o.x, 0.0)).rgb), lW = luma(texture2D(tColor, vUv - vec2(o.x, 0.0)).rgb);
      float lN = luma(texture2D(tColor, vUv + vec2(0.0, o.y)).rgb), lS = luma(texture2D(tColor, vUv - vec2(0.0, o.y)).rgb);
      float g = (abs(lE - lW) + abs(lN - lS)) / (lE + lW + lN + lS + 0.08) * 2.0;
      line = max(line, smoothstep(0.35, 0.9, g) * 0.7);
    }
    line *= (1.0 - smoothstep(60.0, 320.0, dist)) * (0.6 + 0.4 * brush); // the brush thins out far away
    col = mix(col, uInk, line * uLineStrength);
  }

  // Atmospheric pigment, preserving the world's time-of-day and weather rather than whitening every distance.
  col = mix(col, uMistColor, sky ? uSkyMist : smoothstep(uMistNear, uMistFar, dist) * uMistStrength);

  // the paper
  float fibre = 0.5 * vnoise(vec2(px.x * 0.06, px.y * 0.6)) + 0.5 * vnoise(vec2(px.x * 0.6, px.y * 0.05));
  col *= 0.94 + 0.05 * fibre + 0.03 * hash(floor(px)) - 0.04 * blot;
  vec2 q = vUv - 0.5;
  col *= 1.0 - 0.18 * smoothstep(0.35, 0.75, length(q * vec2(1.0, 0.8)));
  gl_FragColor = vec4(col, 1.0);
}
`;

// renderer: the world's THREE.WebGLRenderer; guard: its context guard (webglContextGuard.jsx), which every draw goes
// through so a lost context skips the frame instead of throwing
export function createInkWashLook({ renderer, guard, level = 0, palette = 'vibrant' }) {
  const size = new THREE.Vector2();
  const halfFloat = !!renderer.extensions?.has?.('EXT_color_buffer_float');
  const material = new THREE.ShaderMaterial({
    name: 'InkWashLook',
    uniforms: {
      tColor: { value: null }, tDepth: { value: null }, uResolution: { value: new THREE.Vector2(1, 1) },
      uNear: { value: 0.1 }, uFar: { value: 1000 }, uLevel: { value: level },
      uColorKeep: { value: INK_TUNING.colorKeep }, uLineWidth: { value: INK_TUNING.lineWidth }, uMistNear: { value: INK_TUNING.mistNear }, uMistFar: { value: INK_TUNING.mistFar },
      uPaper: { value: new THREE.Vector3(...INK_PALETTE.paper) }, uInk: { value: new THREE.Vector3(...INK_PALETTE.ink) }, uMistColor: { value: new THREE.Vector3(...INK_PALETTE.mist) },
      uVibrant: { value: 1 }, uWashLift: { value: 0 }, uVibrance: { value: 0 },
      uLineStrength: { value: 0 }, uMistStrength: { value: 0 }, uSkyMist: { value: 0 },
    },
    vertexShader: VERTEX, fragmentShader: FRAGMENT,
    depthTest: false, depthWrite: false, toneMapped: true, // toneMapped: the renderer's toneMapping() is defined for the shader (it applies it itself)
  });
  const geometry = new THREE.BufferGeometry(); // one triangle over the whole screen
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const quad = new THREE.Mesh(geometry, material); quad.frustumCulled = false;
  const quadScene = new THREE.Scene(); quadScene.add(quad);
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let target = null, current = 0, samples = -1, currentPalette = 'vibrant'; const mistRgb = [0, 0, 0];

  function makeTarget() {
    renderer.getDrawingBufferSize(size);
    const w = Math.max(1, Math.floor(size.x)), h = Math.max(1, Math.floor(size.y)), want = current >= 4 ? 2 : 0;
    if (target && target.width === w && target.height === h && samples === want) return;
    target?.dispose();
    const depthTexture = new THREE.DepthTexture(w, h); depthTexture.type = THREE.UnsignedIntType;
    target = new THREE.WebGLRenderTarget(w, h, { type: halfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType, depthBuffer: true, depthTexture, samples: want });
    target.texture.name = 'InkWashLook.color'; samples = want;
    material.uniforms.tColor.value = target.texture; material.uniforms.tDepth.value = depthTexture; material.uniforms.uResolution.value.set(w, h);
  }

  const look = {
    get level() { return current; },
    get palette() { return currentPalette; },
    setPalette(next) {
      currentPalette = inkPaletteFor({ inkPalette: next });
      const p = INK_COLOR_PROFILES[currentPalette], u = material.uniforms;
      u.uVibrant.value = currentPalette === 'vibrant' ? 1 : 0;
      u.uPaper.value.fromArray(p.paper); u.uInk.value.fromArray(p.ink);
      for (const key of ['colorKeep', 'washLift', 'vibrance', 'lineStrength', 'mistNear', 'mistFar', 'mistStrength', 'skyMist']) {
        u['u' + key[0].toUpperCase() + key.slice(1)].value = p[key];
      }
    },
    setLevel(next) {
      current = Math.max(0, Math.min(4, Number(next) || 0)); material.uniforms.uLevel.value = current;
      if (current === 0) { target?.dispose(); target = null; samples = -1; if (renderer.info) renderer.info.autoReset = true; }
    },
    setSize() { if (current > 0) makeTarget(); },
    // draws one frame: the scene, then (above level 0) the ink pass over it. renderer.info then counts both passes
    render(scene, camera) {
      if (current === 0) return guard.render(scene, camera);
      makeTarget();
      const info = renderer.info; if (info) { info.autoReset = false; info.reset(); }
      const u = material.uniforms; u.uNear.value = camera.near; u.uFar.value = camera.far;
      u.uMistColor.value.fromArray(scene.fog?.color ? mistColorFor(scene.fog.color, renderer.toneMappingExposure ?? 1, mistRgb, currentPalette) : INK_COLOR_PROFILES[currentPalette].mist);
      const previous = renderer.getRenderTarget();
      renderer.setRenderTarget(target);
      const ok = guard.render(scene, camera);
      renderer.setRenderTarget(previous);
      return ok && guard.render(quadScene, quadCamera);
    },
    dispose() { target?.dispose(); target = null; geometry.dispose(); material.dispose(); if (renderer.info) renderer.info.autoReset = true; },
    _material: material, // tests
  };
  look.setPalette(palette); look.setLevel(level);
  return look;
}
