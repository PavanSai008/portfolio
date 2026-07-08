/**
 * Avatar Widget — standalone, portable Three.js 2.5D floating avatar.
 *
 * Drop this into any existing site. It mounts onto a <canvas> element you
 * provide, sizes itself to that canvas's parent container (not the whole
 * window), and cleans up fully via the returned `dispose()` function.
 *
 * Usage:
 *   import { createAvatarHero } from './avatar-widget.js';
 *
 *   const canvas = document.getElementById('avatar-canvas');
 *   const avatar = createAvatarHero(canvas, { avatarUrl: '/avatar.png' });
 *
 *   // later, e.g. on unmount in a SPA:
 *   avatar.dispose();
 */

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.164.0/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "https://cdn.jsdelivr.net/npm/three@0.164.0/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "https://cdn.jsdelivr.net/npm/three@0.164.0/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "https://cdn.jsdelivr.net/npm/three@0.164.0/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "https://cdn.jsdelivr.net/npm/three@0.164.0/examples/jsm/postprocessing/ShaderPass.js";

const DEFAULT_CONFIG = {
  avatarUrl: "imgs/Avatar.png",
  layerCount: 24,
  layerSpacing: 0.012,
  layerOpacityFalloff: 0.045,
  layerScaleStep: 0.006,
  maxRotationY: THREE.MathUtils.degToRad(18),
  maxRotationX: THREE.MathUtils.degToRad(10),
  pointerLerp: 0.06,
  floatAmplitude: 0.08,
  floatSpeed: 1.2,
  tiltZAmplitude: 0.02,
  tiltZSpeed: 0.8,
  breathAmplitude: 0.01,
  breathSpeed: 2,
  hoverScale: 1.04,
  glowColor: 0x66ccff,
  particleCount: 60,
  dprCap: 2,
  bloom: {
    strength: 0.5,
    radius: 0.4,
    threshold: 0.85,
  },
};

export function createAvatarHero(canvas, options = {}) {
  const CONFIG = { ...DEFAULT_CONFIG, ...options };
  const container = options.container ?? canvas.parentElement ?? canvas;

  const state = {
    canvas,
    container,
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    composer: null,
    grainPass: null,
    clock: null,
    avatarGroup: null,
    layers: [],
    particles: null,
    cursorLight: null,
    pointer: { x: 0, y: 0 },
    targetRotation: { x: 0, y: 0 },
    currentRotation: { x: 0, y: 0 },
    targetLightPos: new THREE.Vector3(),
    currentLightPos: new THREE.Vector3(),
    hovering: false,
    hoverScaleCurrent: 1,
    rafId: null,
    disposed: false,
    resizeObserver: null,
  };

  if (!isWebGLAvailable()) {
    console.warn("AvatarHero: WebGL is not available — skipping 3D avatar.");
    return { dispose() {} };
  }

  initScene();
  createLights();
  const readyPromise = createAvatar()
    .then(() => {
      createParticles();
      setupPostProcessing();
      bindEvents();
      if (!state.disposed) animate();
    })
    .catch((error) => {
      console.error("AvatarHero: failed to load avatar texture:", error);
    });

  function isWebGLAvailable() {
    try {
      const test = document.createElement("canvas");
      return Boolean(
        window.WebGLRenderingContext &&
        (test.getContext("webgl2") || test.getContext("webgl")),
      );
    } catch {
      return false;
    }
  }

  function getSize() {
    const rect = state.container.getBoundingClientRect();
    return {
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height),
    };
  }

  function isDesktop() {
    return getSize().width >= 1024;
  }

  function initScene() {
    state.scene = new THREE.Scene();

    const { width, height } = getSize();
    state.camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100);
    state.camera.position.set(0, 0, 6);

    state.renderer = new THREE.WebGLRenderer({
      canvas: state.canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    state.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, CONFIG.dprCap),
    );
    state.renderer.setSize(width, height, false);
    state.renderer.setClearColor(0x000000, 0);
    state.renderer.shadowMap.enabled = true;
    state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    state.renderer.outputColorSpace = THREE.SRGBColorSpace;
    state.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    state.renderer.toneMappingExposure = 1.05;

    state.controls = new OrbitControls(state.camera, state.renderer.domElement);
    state.controls.enableZoom = false;
    state.controls.enablePan = false;
    state.controls.enableRotate = false;
    state.controls.enableDamping = true;
    state.controls.dampingFactor = 0.08;

    state.clock = new THREE.Clock();
  }

  function createLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    state.scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0x8fd6ff, 0x1a0f2e, 0.6);
    state.scene.add(hemi);

    const directional = new THREE.DirectionalLight(0xffffff, 1.1);
    directional.position.set(2.5, 3.5, 4);
    directional.castShadow = true;
    directional.shadow.mapSize.set(1024, 1024);
    directional.shadow.radius = 6;
    directional.shadow.bias = -0.0005;
    state.scene.add(directional);

    if (isDesktop()) {
      state.cursorLight = new THREE.PointLight(CONFIG.glowColor, 6, 8, 2);
      state.cursorLight.position.set(0, 0, 2);
      state.scene.add(state.cursorLight);

      const glowMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 16, 16),
        new THREE.MeshBasicMaterial({
          color: CONFIG.glowColor,
          transparent: true,
          opacity: 0.9,
        }),
      );
      state.cursorLight.add(glowMesh);
    }
  }

  async function createAvatar() {
    const texture = await loadTexture(CONFIG.avatarUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = state.renderer.capabilities.getMaxAnisotropy();

    const image = texture.image;
    const aspect = image.width / image.height;
    const baseHeight = 3.4;
    const baseWidth = baseHeight * aspect;

    state.avatarGroup = new THREE.Group();
    state.scene.add(state.avatarGroup);

    const geometry = new THREE.PlaneGeometry(baseWidth, baseHeight, 1, 1);

    const { layerCount, layerSpacing, layerOpacityFalloff, layerScaleStep } =
      CONFIG;
    const centerOffset = ((layerCount - 1) * layerSpacing) / 2;

    for (let i = 0; i < layerCount; i += 1) {
      const depthT = i / (layerCount - 1);
      const opacity = Math.max(
        0.05,
        1 - depthT * layerOpacityFalloff * layerCount * 0.5,
      );
      const scale = 1 - depthT * layerScaleStep * layerCount * 0.5;

      const material = new THREE.MeshPhysicalMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.05,
        side: THREE.DoubleSide,
        depthWrite: false,
        roughness: 0.45,
        metalness: 0.05,
        clearcoat: 0.3,
        clearcoatRoughness: 0.4,
        emissive: new THREE.Color(CONFIG.glowColor),
        emissiveIntensity: 0.06,
        emissiveMap: texture,
        opacity,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = i * layerSpacing - centerOffset;
      mesh.scale.setScalar(scale);
      mesh.renderOrder = layerCount - i;
      mesh.castShadow = i === 0;
      mesh.receiveShadow = false;

      state.avatarGroup.add(mesh);
      state.layers.push(mesh);
    }

    handleResize();
  }

  function loadTexture(url) {
    return new Promise((resolve, reject) => {
      const loader = new THREE.TextureLoader();
      loader.load(url, resolve, undefined, reject);
    });
  }

  function createParticles() {
    const count = CONFIG.particleCount;
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      const radius = 1.6 + Math.random() * 1.6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.7;
      positions[i * 3 + 2] = radius * Math.cos(phi) * 0.6 - 0.5;

      scales[i] = Math.random();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));

    const material = new THREE.PointsMaterial({
      color: CONFIG.glowColor,
      size: 0.025,
      transparent: true,
      opacity: 0.55,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    state.particles = new THREE.Points(geometry, material);
    state.scene.add(state.particles);
  }

  function setupPostProcessing() {
    const { width, height } = getSize();
    const size = new THREE.Vector2(width, height);

    state.composer = new EffectComposer(state.renderer);
    state.composer.addPass(new RenderPass(state.scene, state.camera));

    if (isDesktop()) {
      const bloomPass = new UnrealBloomPass(
        size,
        CONFIG.bloom.strength,
        CONFIG.bloom.radius,
        CONFIG.bloom.threshold,
      );
      state.composer.addPass(bloomPass);
    }

    const grainShader = {
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uAmount: { value: 0.035 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform float uAmount;
        varying vec2 vUv;

        float rand(vec2 co) {
          return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
        }

        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          float grain = rand(vUv * uTime) * 2.0 - 1.0;
          color.rgb += grain * uAmount;
          gl_FragColor = color;
        }
      `,
    };

    state.grainPass = new ShaderPass(grainShader);
    state.composer.addPass(state.grainPass);
  }

  function bindEvents() {
    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    window.addEventListener("pointerleave", handlePointerLeave);

    state.container.addEventListener("pointerenter", handlePointerEnter);
    state.container.addEventListener(
      "pointerleave",
      handlePointerLeaveContainer,
    );

    if ("ResizeObserver" in window) {
      state.resizeObserver = new ResizeObserver(handleResize);
      state.resizeObserver.observe(state.container);
    } else {
      window.addEventListener("resize", handleResize);
    }
  }

  function handlePointerEnter() {
    state.hovering = true;
  }

  function handlePointerLeaveContainer() {
    state.hovering = false;
  }

  function handlePointerMove(event) {
    const rect = state.container.getBoundingClientRect();
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;

    state.pointer.x = nx;
    state.pointer.y = ny;

    state.targetRotation.y = nx * CONFIG.maxRotationY;
    state.targetRotation.x = -ny * CONFIG.maxRotationX;

    state.targetLightPos.set(nx * 2.2, -ny * 1.6, 1.8);
  }

  function handlePointerLeave() {
    state.targetRotation.x = 0;
    state.targetRotation.y = 0;
    state.hovering = false;
  }

  function handleResize() {
    const { width, height } = getSize();

    state.camera.aspect = width / height;
    state.camera.updateProjectionMatrix();

    state.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, CONFIG.dprCap),
    );
    state.renderer.setSize(width, height, false);

    if (state.composer) {
      state.composer.setSize(width, height);
    }

    if (state.avatarGroup) {
      const isMobile = width < 420;
      const isTablet = width >= 420 && width < 768;
      const responsiveScale = isMobile ? 0.72 : isTablet ? 0.86 : 1;
      state.avatarGroup.userData.responsiveScale = responsiveScale;
    }
  }

  function animate() {
    state.rafId = requestAnimationFrame(animate);

    const delta = state.clock.getDelta();
    const elapsed = state.clock.elapsedTime;

    updateAvatarMotion(elapsed);
    updateCursorLight(delta);
    updateParticles(elapsed);
    updateCameraParallax();

    state.controls.update();

    if (state.grainPass) {
      state.grainPass.uniforms.uTime.value = elapsed;
    }

    if (state.composer) {
      state.composer.render();
    } else {
      state.renderer.render(state.scene, state.camera);
    }
  }

  function updateAvatarMotion(elapsed) {
    if (!state.avatarGroup) return;

    state.currentRotation.x = THREE.MathUtils.lerp(
      state.currentRotation.x,
      state.targetRotation.x,
      CONFIG.pointerLerp,
    );
    state.currentRotation.y = THREE.MathUtils.lerp(
      state.currentRotation.y,
      state.targetRotation.y,
      CONFIG.pointerLerp,
    );

    const idleRotation = Math.sin(elapsed * 0.35) * 0.03;

    state.avatarGroup.rotation.x = state.currentRotation.x;
    state.avatarGroup.rotation.y = state.currentRotation.y + idleRotation;

    state.avatarGroup.position.y =
      Math.sin(elapsed * CONFIG.floatSpeed) * CONFIG.floatAmplitude;
    state.avatarGroup.rotation.z =
      Math.sin(elapsed * CONFIG.tiltZSpeed) * CONFIG.tiltZAmplitude;

    const breath =
      1 + Math.sin(elapsed * CONFIG.breathSpeed) * CONFIG.breathAmplitude;
    const hoverTarget = state.hovering ? CONFIG.hoverScale : 1;
    state.hoverScaleCurrent = THREE.MathUtils.lerp(
      state.hoverScaleCurrent,
      hoverTarget,
      0.08,
    );

    const responsiveScale = state.avatarGroup.userData.responsiveScale ?? 1;
    const finalScale = breath * state.hoverScaleCurrent * responsiveScale;
    state.avatarGroup.scale.setScalar(finalScale);
  }

  function updateCursorLight(delta) {
    if (!isDesktop() || !state.cursorLight) return;
    const t = 1 - Math.pow(0.0001, delta);
    state.currentLightPos.lerp(state.targetLightPos, t);
    state.cursorLight.position.copy(state.currentLightPos);
  }

  function updateParticles(elapsed) {
    if (!state.particles) return;
    state.particles.rotation.y = elapsed * 0.02;
    state.particles.rotation.x = Math.sin(elapsed * 0.15) * 0.05;
  }

  function updateCameraParallax() {
    const targetX = state.pointer.x * 0.25;
    const targetY = -state.pointer.y * 0.15;
    state.camera.position.x = THREE.MathUtils.lerp(
      state.camera.position.x,
      targetX,
      0.04,
    );
    state.camera.position.y = THREE.MathUtils.lerp(
      state.camera.position.y,
      targetY,
      0.04,
    );
    state.camera.lookAt(0, 0, 0);
  }

  function dispose() {
    state.disposed = true;

    if (state.rafId !== null) cancelAnimationFrame(state.rafId);

    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerleave", handlePointerLeave);
    window.removeEventListener("resize", handleResize);
    state.container.removeEventListener("pointerenter", handlePointerEnter);
    state.container.removeEventListener(
      "pointerleave",
      handlePointerLeaveContainer,
    );
    state.resizeObserver?.disconnect();

    state.layers[0]?.geometry.dispose();
    const sharedMaterial = state.layers[0]?.material;
    sharedMaterial?.map?.dispose();
    sharedMaterial?.emissiveMap?.dispose();
    state.layers.forEach((mesh) => mesh.material.dispose());

    state.particles?.geometry.dispose();
    state.particles?.material.dispose();

    state.controls?.dispose();
    state.renderer?.dispose();
    state.composer?.dispose();
  }

  return { dispose, ready: readyPromise };
}
