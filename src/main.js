import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { initUI, params } from './ui.js';
import { getSunDirection } from './solar.js';
import { WEATHER_PRESETS, current as weatherCurrent, updateWeather } from './weather.js';
import skyVert from './shaders/sky.vert.glsl?raw';
import skyFrag from './shaders/sky.frag.glsl?raw';

// Tower placeholder dimensions. The real Campanile is ~93.6m; we round to 94m.
const TOWER_HEIGHT = 94;
const TOWER_DIAMETER = 10;
const TOWER_MIDPOINT = new THREE.Vector3(0, TOWER_HEIGHT / 2, 0);
const SUN_DISTANCE = 200;

const canvas = document.getElementById('scene');

const renderer = createRenderer(canvas);
const scene = new THREE.Scene();

const camera = createCamera();
const controls = createControls(camera, renderer.domElement);

const { hemi, directionalLight } = addLighting(scene);
addGround(scene);
const tower = addTowerPlaceholder(scene);
const sky = createSky(scene);

// Initialized to the `clear` preset; updateWeather() mutates color/density.
scene.fog = new THREE.FogExp2(WEATHER_PRESETS.clear.fogColor, WEATHER_PRESETS.clear.fogDensity);

const clock = new THREE.Clock();

initUI();

window.addEventListener('resize', onResize);
renderer.setAnimationLoop(render);

// ---- factories -------------------------------------------------------------

function createRenderer(targetCanvas) {
  const r = new THREE.WebGLRenderer({ canvas: targetCanvas, antialias: true });
  r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  r.setSize(window.innerWidth, window.innerHeight);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.0;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  return r;
}

function createCamera() {
  const cam = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 5000);
  cam.position.set(150, 30, 150);
  cam.lookAt(TOWER_MIDPOINT);
  return cam;
}

function createControls(cam, dom) {
  const c = new OrbitControls(cam, dom);
  c.target.copy(TOWER_MIDPOINT);
  c.enableDamping = true;
  c.dampingFactor = 0.08;
  c.minDistance = 20;
  c.maxDistance = 800;
  c.maxPolarAngle = Math.PI / 2 - 0.01; // keep camera above the ground
  c.update();
  return c;
}

function addLighting(targetScene) {
  const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x444444, 0.6);
  targetScene.add(hemiLight);

  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(100, 100, 50);
  dir.target.position.set(0, 0, 0);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  dir.shadow.bias = -0.0005;
  dir.shadow.normalBias = 0.05; // suppress peter-panning at low sun angles
  dir.shadow.camera.left = -100;
  dir.shadow.camera.right = 100;
  dir.shadow.camera.top = 100;
  dir.shadow.camera.bottom = -100;
  dir.shadow.camera.near = 50;
  dir.shadow.camera.far = 300;
  targetScene.add(dir);
  targetScene.add(dir.target);

  return { hemi: hemiLight, directionalLight: dir };
}

function addGround(targetScene) {
  const geo = new THREE.PlaneGeometry(200, 200);
  // Memorial Glade is grass; a muted green reads better than neutral grey
  // against the Preetham sky and gives the cylinder something to cast onto.
  const mat = new THREE.MeshStandardMaterial({ color: 0x3e5a2c, roughness: 1.0, metalness: 0.0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  targetScene.add(mesh);
  return mesh;
}

function addTowerPlaceholder(targetScene) {
  const geo = new THREE.CylinderGeometry(TOWER_DIAMETER / 2, TOWER_DIAMETER / 2, TOWER_HEIGHT, 32);
  const mat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.7, metalness: 0.0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = TOWER_HEIGHT / 2; // base flush with ground
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  targetScene.add(mesh);
  return mesh;
}

function createSky(targetScene) {
  const geo = new THREE.SphereGeometry(3000, 32, 16);
  const material = new THREE.ShaderMaterial({
    vertexShader: skyVert,
    fragmentShader: skyFrag,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      sunDirection: { value: new THREE.Vector3(0, 1, 0) },
      turbidity: { value: 2.5 },
      rayleigh: { value: 1.0 },
      mieCoefficient: { value: 0.005 },
      mieDirectionalG: { value: 0.8 },
      exposure: { value: 1.0 },
      cloudCover: { value: 0.0 },
    },
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.renderOrder = -1; // draw before opaque geometry so it never overlays
  mesh.frustumCulled = false;
  targetScene.add(mesh);
  return { mesh, material };
}

// ---- per-frame -------------------------------------------------------------

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

const _sunDir = new THREE.Vector3();

function render() {
  // Clock.getDelta() is destructive — call exactly once per frame.
  updateWeather(clock.getDelta(), params.weather);

  _sunDir.copy(getSunDirection(params.dayOfYear, params.timeOfDay));
  pushWeatherToScene();

  directionalLight.castShadow = params.showShadows;
  sky.material.uniforms.sunDirection.value.copy(_sunDir);

  // Light orbits with the sun; the shadow camera looks from light → target,
  // so the frustum naturally rotates to follow.
  directionalLight.position.copy(_sunDir).multiplyScalar(SUN_DISTANCE);
  directionalLight.intensity = Math.max(0, _sunDir.y);
  // Floor at 0.25 keeps deep night visible after ACES tonemap; 0.1 read black.
  hemi.intensity = THREE.MathUtils.lerp(0.25, 0.6, THREE.MathUtils.smoothstep(_sunDir.y, -0.1, 0.2));

  controls.update();
  renderer.render(scene, camera);
}

function pushWeatherToScene() {
  const u = sky.material.uniforms;
  u.turbidity.value = weatherCurrent.turbidity;
  u.rayleigh.value = weatherCurrent.rayleigh;
  u.mieCoefficient.value = weatherCurrent.mieCoefficient;
  u.exposure.value = weatherCurrent.exposure;
  u.cloudCover.value = weatherCurrent.cloudCover;

  // FogExp2.color is a constant that doesn't respond to scene lighting —
  // without modulation, dense rain fog reads as bright daylight-grey at
  // midnight (no light source, but the fog color "emits" at its preset).
  // Scale by sun height so fog only "lights up" when there's light to
  // scatter through it. Same curve as the shader's cloud brightness so
  // the sky-fog transition stays visually continuous.
  const lit = THREE.MathUtils.smoothstep(_sunDir.y, -0.15, 0.25);
  const fogBright = THREE.MathUtils.lerp(0.05, 1.0, lit);
  scene.fog.color.copy(weatherCurrent.fogColor).multiplyScalar(fogBright);
  scene.fog.density = weatherCurrent.fogDensity;
}
