// Render pipeline.
// 1. The world under/around the water (terrain, props, fish, player) renders into `sceneTarget`,
//    which keeps a depth texture.
// 2. Colour + depth are restored into the composer buffer, then the water surface and everything
//    that sits on it (shadows, line, splashes, reticle) render on top. The water samples the
//    first pass for depth colour, refraction, shoreline foam and caustics.
// 3. Bloom (quality-gated) and a grade pass (tone mapping, warm split-tone, vignette).
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const MAX_PIXEL_RATIO = 1.6;

class SplitScenePass extends Pass {
  constructor({ scene, camera, under, surface, sceneTarget }) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.under = under;
    this.surface = surface;
    this.sceneTarget = sceneTarget;
    this.needsSwap = false;
    this.shadowsDirty = true;
    this.restore = new FullScreenQuad(new THREE.ShaderMaterial({
      name: 'RestoreColourDepth',
      uniforms: { tColor: { value: null }, tDepth: { value: null } },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tColor;
        uniform sampler2D tDepth;
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D(tColor, vUv);
          gl_FragDepth = texture2D(tDepth, vUv).x;
        }`,
      depthTest: true,
      depthWrite: true,
      depthFunc: THREE.AlwaysDepth,
    }));
  }

  render(renderer, writeBuffer, readBuffer) {
    const { scene, camera, under, surface, sceneTarget } = this;
    const background = scene.background;
    const autoClear = renderer.autoClear;

    // Pass 1: the world below and around the water.
    surface.visible = false;
    under.visible = true;
    renderer.shadowMap.needsUpdate = renderer.shadowMap.enabled;
    renderer.setRenderTarget(sceneTarget);
    renderer.autoClear = true;
    renderer.render(scene, camera);

    // Pass 2: restore into the composer buffer, then draw the surface layer.
    renderer.setRenderTarget(readBuffer);
    renderer.autoClear = false;
    renderer.clear(true, true, false);
    const mat = this.restore.material;
    mat.uniforms.tColor.value = sceneTarget.texture;
    mat.uniforms.tDepth.value = sceneTarget.depthTexture;
    this.restore.render(renderer);

    scene.background = null; // a colour background would clear the restored frame
    under.visible = false;
    surface.visible = true;
    renderer.shadowMap.needsUpdate = false;
    renderer.render(scene, camera);

    scene.background = background;
    under.visible = true;
    renderer.autoClear = autoClear;
  }
}

// Tone mapping (ACES), a warm/teal split-tone like the key art, and a soft vignette.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    toneMappingExposure: { value: 1.0 },
    uVignette: { value: 0.32 },
    uWarm: { value: new THREE.Color(1.05, 0.98, 0.88) },
    uShadowTint: { value: new THREE.Color(0.86, 1.0, 0.98) },
    uSaturation: { value: 1.08 },
    uAspect: { value: 1 },
  },
  vertexShader: /* glsl */`
    precision highp float;
    uniform mat4 modelViewMatrix;
    uniform mat4 projectionMatrix;
    attribute vec3 position;
    attribute vec2 uv;
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform vec3 uWarm;
    uniform vec3 uShadowTint;
    uniform float uSaturation;
    uniform float uAspect;
    #include <tonemapping_pars_fragment>
    #include <colorspace_pars_fragment>
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      c = ACESFilmicToneMapping(c);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(c * uShadowTint, c * uWarm, smoothstep(0.05, 0.7, l));
      c = mix(vec3(l), c, uSaturation);
      vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
      float v = smoothstep(0.35, 1.05, length(p * vec2(0.9, 1.1)));
      c *= 1.0 - uVignette * v;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
      gl_FragColor = sRGBTransferOETF(gl_FragColor);
    }`,
};

class GradePass extends Pass {
  constructor() {
    super();
    this.uniforms = THREE.UniformsUtils.clone(GradeShader.uniforms);
    this.material = new THREE.RawShaderMaterial({
      name: 'Grade',
      uniforms: this.uniforms,
      vertexShader: GradeShader.vertexShader,
      fragmentShader: GradeShader.fragmentShader,
      defines: { ACES_FILMIC_TONE_MAPPING: '' },
    });
    this.quad = new FullScreenQuad(this.material);
  }
  render(renderer, writeBuffer, readBuffer) {
    this.uniforms.tDiffuse.value = readBuffer.texture;
    this.uniforms.toneMappingExposure.value = renderer.toneMappingExposure;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
}

export function createRenderPipeline({ canvas, scene, camera, under, surface }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    stencil: false,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // GradePass tone maps
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const depthTexture = new THREE.DepthTexture(1, 1);
  depthTexture.type = THREE.UnsignedIntType;
  const sceneTarget = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    depthBuffer: true,
    depthTexture,
  });
  sceneTarget.texture.minFilter = THREE.LinearFilter;
  sceneTarget.texture.magFilter = THREE.LinearFilter;
  sceneTarget.texture.generateMipmaps = false;

  const composer = new EffectComposer(renderer);
  const splitPass = new SplitScenePass({ scene, camera, under, surface, sceneTarget });
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.55, 0.92);
  const gradePass = new GradePass();
  composer.addPass(splitPass);
  composer.addPass(bloomPass);
  composer.addPass(gradePass);

  let width = 1;
  let height = 1;
  let resolutionScale = 1;
  const listeners = new Set();

  function pixelRatio() {
    return Math.min(MAX_PIXEL_RATIO, window.devicePixelRatio || 1) * resolutionScale;
  }

  function resize() {
    width = Math.max(1, canvas.clientWidth || window.innerWidth);
    height = Math.max(1, canvas.clientHeight || window.innerHeight);
    const pr = pixelRatio();
    renderer.setPixelRatio(pr);
    renderer.setSize(width, height, false);
    composer.setPixelRatio(pr);
    composer.setSize(width, height);
    const w = Math.max(1, Math.floor(width * pr));
    const h = Math.max(1, Math.floor(height * pr));
    sceneTarget.setSize(w, h);
    gradePass.uniforms.uAspect.value = width / height;
    for (const fn of listeners) fn({ width, height, pixelWidth: w, pixelHeight: h });
  }

  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);

  return {
    renderer,
    composer,
    sceneTarget,
    bloomPass,
    gradePass,
    resize,
    onResize(fn) { listeners.add(fn); },
    get size() { return { width, height, pixelWidth: sceneTarget.width, pixelHeight: sceneTarget.height }; },
    setBloom(on) { bloomPass.enabled = on; },
    setShadows(on, mapSize) {
      renderer.shadowMap.enabled = on;
      scene.traverse((o) => {
        if (o.isDirectionalLight && o.castShadow && mapSize && o.shadow.mapSize.x !== mapSize) {
          o.shadow.mapSize.set(mapSize, mapSize);
          o.shadow.map?.dispose();
          o.shadow.map = null;
        }
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) m.needsUpdate = true;
        }
      });
    },
    setResolutionScale(s) {
      if (s === resolutionScale) return;
      resolutionScale = s;
      resize();
    },
    render(dt) { composer.render(dt); },
  };
}
