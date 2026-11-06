// Stylized water surface. Reads the first render pass (colour + depth) to get the real depth under
// every pixel: depth colour bands, refraction, caustics on the sea floor, shoreline foam and the
// white wash lines from the key art, plus ripple rings for splashes, bites and wakes.
import * as THREE from 'three';
import { createWaterNormalTexture, createCausticTexture } from './waterTextures.js';

export const MAX_RIPPLES = 20;

const vertexShader = /* glsl */`
  uniform float uTime;
  uniform float uSwell;
  varying vec3 vWorldPos;
  #include <fog_pars_vertex>
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    float sw = sin(wp.x * 0.31 + uTime * 0.8) * 0.55 + sin(wp.z * 0.24 - uTime * 0.62 + wp.x * 0.12) * 0.45;
    wp.y += sw * uSwell;
    vWorldPos = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

const fragmentShader = /* glsl */`
  uniform sampler2D tSceneColor;
  uniform sampler2D tSceneDepth;
  uniform sampler2D uNormalMap;
  uniform sampler2D uCaustic;
  uniform vec2 uResolution;
  uniform mat4 uProjInv;
  uniform mat4 uCamWorld;
  uniform float uTime;
  uniform vec3 uShallow, uMid, uDeep, uAbyss, uFoam, uSkyHorizon, uSkyZenith;
  uniform vec3 uSunDir, uSunColor;
  uniform float uLight;
  uniform float uRefract;
  uniform vec4 uRipples[${MAX_RIPPLES}];
  varying vec3 vWorldPos;
  #include <fog_pars_fragment>

  vec3 worldFromDepth(vec2 uv, float z) {
    vec4 ndc = vec4(uv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0);
    vec4 view = uProjInv * ndc;
    view /= view.w;
    return (uCamWorld * view).xyz;
  }

  void main() {
    vec2 suv = gl_FragCoord.xy / uResolution;
    vec3 V = normalize(cameraPosition - vWorldPos);
    float camDist = length(cameraPosition - vWorldPos);

    // Surface normal: two scrolling samples of the painted wavelet map.
    vec2 p = vWorldPos.xz;
    vec4 s1 = texture2D(uNormalMap, p * 0.045 + vec2(uTime * 0.011, uTime * 0.007));
    vec4 s2 = texture2D(uNormalMap, p * 0.081 + vec2(-uTime * 0.009, uTime * 0.013));
    vec2 nxy = (s1.xy * 2.0 - 1.0) * 0.32 + (s2.xy * 2.0 - 1.0) * 0.26;
    float foamNoise = texture2D(uNormalMap, p * 0.17 + vec2(uTime * 0.02, -uTime * 0.015)).a;

    // Ripple rings (splashes, nibbles, wakes): x, z, start time, strength.
    float ringFoam = 0.0;
    for (int i = 0; i < ${MAX_RIPPLES}; i++) {
      vec4 r = uRipples[i];
      if (r.w <= 0.0) continue;
      float age = uTime - r.z;
      if (age < 0.0 || age > 3.0) continue;
      vec2 d = p - r.xy;
      float dist = length(d);
      float speed = 1.1 + r.w * 0.6;
      float front = age * speed;
      float fade = exp(-age * 1.6) * r.w;
      float ring = exp(-pow((dist - front) * 4.5, 2.0));
      float ring2 = exp(-pow((dist - front * 0.62) * 6.0, 2.0)) * 0.6;
      vec2 dir = dist > 1e-3 ? d / dist : vec2(0.0);
      nxy += dir * (ring - ring2) * fade * 1.4;
      ringFoam += ring * fade * 0.55 * smoothstep(0.35, 0.65, foamNoise + 0.2) * smoothstep(0.05, 0.4, front);
    }
    vec3 N = normalize(vec3(nxy.x, 1.0, nxy.y));

    // Depth of the scene behind this pixel.
    float sceneZ = texture2D(tSceneDepth, suv).x;
    bool open = sceneZ >= 0.99999;
    vec3 bed = worldFromDepth(suv, sceneZ);
    float vDepth = open ? 60.0 : max(0.0, vWorldPos.y - bed.y);

    // Refraction (offset scaled down near the shore and in the distance).
    vec2 offs = N.xz * uRefract * clamp(vDepth * 0.8, 0.0, 1.0) / max(1.0, camDist * 0.05);
    vec2 ruv = suv + offs;
    float rz = texture2D(tSceneDepth, ruv).x;
    vec3 rbed = worldFromDepth(ruv, rz);
    if (rz < 0.99999 && rbed.y > vWorldPos.y - 0.02) { ruv = suv; rz = sceneZ; rbed = bed; }
    bool ropen = rz >= 0.99999;
    vec3 refr = texture2D(tSceneColor, ruv).rgb;
    float rDepth = ropen ? 60.0 : max(0.0, vWorldPos.y - rbed.y);
    float rThick = ropen ? 90.0 : distance(vWorldPos, rbed);

    // Caustics dance on the sea floor in the shallows.
    vec2 cp = rbed.xz;
    float c1 = texture2D(uCaustic, cp * 0.13 + vec2(uTime * 0.021, uTime * 0.012) + nxy * 0.02).r;
    float c2 = texture2D(uCaustic, cp * 0.17 + vec2(-uTime * 0.016, uTime * 0.018) - nxy * 0.02).r;
    float caustic = min(c1, c2) * 1.4 + max(c1, c2) * 0.08;
    float cBand = smoothstep(0.05, 0.6, rDepth) * (1.0 - smoothstep(1.2, 4.0, rDepth));
    refr += uSunColor * caustic * cBand * 0.11 * uLight;

    // Absorption (red goes first: emerald-teal like the key art) and in-scatter colour by depth.
    vec3 trans = exp(-vec3(0.95, 0.3, 0.36) * rThick);
    vec3 scatter = mix(uShallow, uMid, smoothstep(0.25, 2.6, rDepth));
    scatter = mix(scatter, uDeep, smoothstep(2.2, 7.5, rDepth));
    scatter = mix(scatter, uAbyss, smoothstep(7.0, 18.0, rDepth));
    scatter *= uLight;
    vec3 col = refr * trans + scatter * (1.0 - trans);

    // Sky reflection (fresnel) and a restrained, painterly sun glint.
    float NdotV = max(dot(N, V), 0.0);
    float fres = 0.02 + 0.98 * pow(1.0 - NdotV, 5.0);
    vec3 R = reflect(-V, N);
    vec3 sky = mix(uSkyHorizon, uSkyZenith, smoothstep(0.0, 0.55, R.y)) * uLight;
    col = mix(col, sky, clamp(fres * 0.45, 0.0, 0.35));
    vec3 H = normalize(uSunDir + V);
    float spec = pow(max(dot(N, H), 0.0), 180.0);
    col += uSunColor * (smoothstep(0.25, 0.85, spec) * 2.2 + spec * 0.4) * uLight;

    // Shoreline: solid contact foam, then white wash lines rolling in over the shallows.
    float contact = 1.0 - smoothstep(0.015, 0.16 + foamNoise * 0.16, vDepth);
    float waveT = fract(vDepth * 1.45 - uTime * 0.2 + foamNoise * 0.45);
    float line = smoothstep(0.84, 0.93, waveT) * (1.0 - smoothstep(0.94, 1.0, waveT));
    line *= (1.0 - smoothstep(0.2, 1.05, vDepth)) * smoothstep(0.32, 0.62, foamNoise + 0.18);
    float foam = clamp(max(contact * smoothstep(0.25, 0.55, foamNoise + 0.35), line * 0.8) + ringFoam, 0.0, 1.0);
    col = mix(col, uFoam * uLight * 1.15, foam);

    // Fade the very edge into the wet sand so the waterline never reads as a hard plane cut.
    vec3 edgeCol = texture2D(tSceneColor, suv).rgb;
    col = mix(edgeCol, col, smoothstep(0.0, 0.05, vDepth));

    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
  }`;

export function createWater({ palette, sceneTarget, camera }) {
  const normalMap = createWaterNormalTexture(256);
  const causticMap = createCausticTexture(256, 9);
  const ripples = Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, -100, 0));
  let rippleCursor = 0;
  const w = palette.water;

  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    tSceneColor: { value: null },
    tSceneDepth: { value: null },
    uNormalMap: { value: null },
    uCaustic: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uProjInv: { value: new THREE.Matrix4() },
    uCamWorld: { value: new THREE.Matrix4() },
    uTime: { value: 0 },
    uSwell: { value: 0.035 },
    uShallow: { value: new THREE.Color(w.shallow) },
    uMid: { value: new THREE.Color(w.mid) },
    uDeep: { value: new THREE.Color(w.deep) },
    uAbyss: { value: new THREE.Color(w.abyss) },
    uFoam: { value: new THREE.Color(w.foam) },
    uSkyHorizon: { value: new THREE.Color(w.skyHorizon) },
    uSkyZenith: { value: new THREE.Color(w.skyZenith) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(1, 1, 1) },
    uLight: { value: 1 },
    uRefract: { value: 0.022 },
    uRipples: { value: ripples },
  }]);
  // merge() clones values; keep live references to the arrays/textures we update.
  uniforms.uRipples.value = ripples;
  uniforms.uNormalMap.value = normalMap;
  uniforms.uCaustic.value = causticMap;
  uniforms.tSceneColor.value = sceneTarget.texture;
  uniforms.tSceneDepth.value = sceneTarget.depthTexture;

  const material = new THREE.ShaderMaterial({
    name: 'CoveWater',
    uniforms,
    vertexShader,
    fragmentShader,
    fog: true,
    // No depth write: fish silhouettes and the line under the surface are drawn after the water.
    depthWrite: false,
  });

  const geo = new THREE.PlaneGeometry(420, 420, 210, 210);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'water';
  mesh.frustumCulled = false;
  mesh.renderOrder = -10; // first in the surface pass; decals and line draw over it

  return {
    mesh,
    uniforms,
    normalMap,
    // strength ~0.3 (nibble) .. 1.5 (big splash)
    addRipple(x, z, strength = 1, delay = 0) {
      const r = ripples[rippleCursor];
      rippleCursor = (rippleCursor + 1) % MAX_RIPPLES;
      r.set(x, z, uniforms.uTime.value + delay, strength);
    },
    update(time, { sunDir, sunColor, light, pixelWidth, pixelHeight }) {
      uniforms.uTime.value = time;
      uniforms.uResolution.value.set(pixelWidth, pixelHeight);
      uniforms.uProjInv.value.copy(camera.projectionMatrixInverse);
      uniforms.uCamWorld.value.copy(camera.matrixWorld);
      if (sunDir) uniforms.uSunDir.value.copy(sunDir);
      if (sunColor) uniforms.uSunColor.value.copy(sunColor);
      if (light !== undefined) uniforms.uLight.value = light;
    },
    // Height of the animated surface (the vertex swell), for floats and splashes.
    surfaceY(x, z, time = uniforms.uTime.value) {
      const sw = Math.sin(x * 0.31 + time * 0.8) * 0.55 + Math.sin(z * 0.24 - time * 0.62 + x * 0.12) * 0.45;
      return sw * uniforms.uSwell.value;
    },
  };
}
