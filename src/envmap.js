import * as THREE from 'three';

// Renders the live scene (sky + lighting) to a PMREM-prefiltered cube map and
// assigns it to scene.environment. Without this, MeshStandardMaterial's
// specular term samples a black env map — at low roughness (wet stone) the
// material then reads as dark plastic. We bake at ~2 Hz, not per frame; the
// sky changes slowly with timeOfDay/weather.

const BAKE_INTERVAL = 0.5; // seconds between rebakes

let pmrem = null;
let envTarget = null;
let lastBake = -Infinity;

export function initEnvMap(renderer) {
  pmrem = new THREE.PMREMGenerator(renderer);
}

// `hideList` is anything we don't want sampled into the env probe — the tower
// (so wet stone doesn't reflect itself) and any near-camera FX like rain that
// would just smear the cube map.
export function updateEnvMap(scene, time, hideList = []) {
  if (!pmrem || time - lastBake < BAKE_INTERVAL) return;
  lastBake = time;

  const restore = [];
  for (const obj of hideList) {
    if (!obj) continue;
    restore.push([obj, obj.visible]);
    obj.visible = false;
  }

  if (envTarget) envTarget.dispose();
  envTarget = pmrem.fromScene(scene, 0.04);
  scene.environment = envTarget.texture;

  for (const [obj, was] of restore) obj.visible = was;
}
