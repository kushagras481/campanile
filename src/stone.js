import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import campanileUrl from '../assets/campanile.glb?url';

const TOWER_HEIGHT = 94;
const TOWER_DIAMETER = 10;

// Drop the GLB's surrounding props (ground slab, plaza, walking paths,
// perimeter walls, bollards) so the tower sits on our grass plane.
// Pilaster_M_* (mid-section pilasters) are authored 0.33 units past the
// Mezzanine wall and get hidden. The belfry's Col_*/ColBase_*/ColCap_*
// also sit past the BelfryShaft wall but that's intentional (freestanding
// colonnade). Win_L_/Win_G_ have the same authoring bug as the pilasters but
// are repaired in fixLowerWindows() rather than hidden, so windows survive on
// the visible wall surface. SKIP_DUP catches Blender's auto-suffixed
// duplicate nodes (Path_0.001, etc).
const SKIP_NAMES = new Set(['Ground', 'Plaza']);
const SKIP_PREFIX = /^(Path_|Wall_|Bollard_|BollardTop_|Pilaster_M_)/;
const SKIP_DUP = /\.\d{3}$/;

// LowerShaft wall radius in GLB-authored units (scale 2.64 / 2).
const LOWER_WALL_R = 1.32;

// All patched wet-stone material uniforms. setWetness() writes the same value
// into each per frame; refs persist for the lifetime of the page.
const wetUniforms = [];

export async function loadCampanile(scene) {
  const loader = new GLTFLoader();
  try {
    const gltf = await loader.loadAsync(campanileUrl);
    const root = gltf.scene;
    fixLowerWindows(root);
    fixSpireRod(root);
    root.traverse((obj) => {
      if (!obj.isMesh) return;
      if (SKIP_NAMES.has(obj.name) || SKIP_PREFIX.test(obj.name) || SKIP_DUP.test(obj.name)) {
        obj.visible = false;
        return;
      }
      obj.castShadow = true;
      obj.receiveShadow = true;
      patchWetness(obj.material);
    });
    normalizeToTower(root);
    scene.add(root);
    return root;
  } catch (err) {
    console.warn('[stone] campanile.glb failed to load — using cylinder fallback', err);
    return addCylinderFallback(scene);
  }
}

export function setWetness(value) {
  for (const u of wetUniforms) u.value = value;
}

// Two-pass normalization. Scale uses the FULL bbox so the tower's overall
// height is stable regardless of which props get filtered. Centering and
// grounding use only VISIBLE meshes so the lowest tower step sits on grass
// (not the height of the hidden plaza/paths underneath).
function normalizeToTower(root) {
  const fullBox = new THREE.Box3().setFromObject(root);
  const fullSize = new THREE.Vector3();
  fullBox.getSize(fullSize);
  if (fullSize.y > 0) root.scale.setScalar(TOWER_HEIGHT / fullSize.y);
  root.updateMatrixWorld(true);

  const visBox = new THREE.Box3();
  root.traverse((obj) => {
    if (obj.isMesh && obj.visible) visBox.expandByObject(obj);
  });
  const center = new THREE.Vector3();
  visBox.getCenter(center);
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= visBox.min.y;
}

// LightningRod is authored ~0.09 source units above where SpireBall ends —
// after the global scale-to-94m it floats ~0.45m above the finial. Shift it
// down by 0.11 source units (slightly past the gap so the rod base overlaps
// the ball and there's no visible seam).
function fixSpireRod(root) {
  root.traverse((obj) => {
    if (obj.name === 'LightningRod') obj.position.y -= 0.11;
  });
}

// Lower-section windows have the same authoring bug as Pilaster_M_*: each
// face has a duplicate pair, one floating past the wall and one buried inside
// it. Snap the floating one onto the wall surface (so it reads as a small
// inset window casing) and hide the buried duplicate.
function fixLowerWindows(root) {
  const tol = 0.1;
  root.traverse((obj) => {
    if (!obj.isMesh || !/^Win_[LG]_/.test(obj.name)) return;
    const xMag = Math.abs(obj.position.x);
    const zMag = Math.abs(obj.position.z);
    const major = Math.max(xMag, zMag);
    if (major < LOWER_WALL_R - tol) {
      obj.visible = false;
    } else if (major > LOWER_WALL_R + tol) {
      if (xMag > zMag) obj.position.x = Math.sign(obj.position.x) * LOWER_WALL_R;
      else obj.position.z = Math.sign(obj.position.z) * LOWER_WALL_R;
    }
  });
}

function patchWetness(material) {
  if (!material || !material.isMeshStandardMaterial) return;

  // Per-material uniform — userData persists across material clones and is
  // shared with the compiled shader's uniforms object via onBeforeCompile.
  const uniform = { value: 0 };
  material.userData.wetness = uniform;

  // Fragment patch layers, applied in order on every limestone fragment:
  //   1. Limestone tint — warm cream/tan shift over the GLB's neutral grey.
  //   2. Low-freq stone patches (~few meters) — diffuse + roughness organic
  //      variation that breaks the painted-wall look.
  //   3. High-freq grain (cm-scale) — fine-detail noise so the stone reads
  //      as a granular surface up close, not a flat material.
  //   4. Masonry course lines — subtle horizontal joints every ~0.8m so the
  //      tower reads as stacked stone blocks; joints darken diffuse and
  //      roughen the surface (mortar).
  //   5. Vertical weather streaks — sparse warm-brown stains running down
  //      the surface (iron/rain runoff). More visible when wet.
  //   6. Ground-level grime — accumulated dirt darkens the bottom ~8m.
  //   7. Wetness — uniform darken + smoothing, applied LAST so wet stone
  //      keeps every weathered detail above and just darkens/glosses it.
  // World position is passed via a custom varying because Three.js doesn't
  // expose vWorldPosition on MeshStandardMaterial unless an env-map feature
  // path enables it.
  const NOISE_FREQ = { x: 0.5, y: 0.27, z: 0.43 };

  material.onBeforeCompile = (shader) => {
    shader.uniforms.wetness = uniform;

    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec3 vStoneWPos;\nvoid main() {')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\n  vStoneWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'
      );

    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float wetness;\nvarying vec3 vStoneWPos;\nvoid main() {')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        diffuseColor.rgb *= vec3(1.05, 1.0, 0.85);

        float stoneN = sin(vStoneWPos.x * ${NOISE_FREQ.x}) * sin(vStoneWPos.y * ${NOISE_FREQ.y}) * sin(vStoneWPos.z * ${NOISE_FREQ.z});
        stoneN = stoneN * 0.5 + 0.5;
        diffuseColor.rgb *= mix(0.92, 1.08, stoneN);

        float grain = sin(vStoneWPos.x * 8.7) * sin(vStoneWPos.y * 11.3) * sin(vStoneWPos.z * 9.1);
        grain = grain * 0.5 + 0.5;
        diffuseColor.rgb *= mix(0.93, 1.07, grain);

        // 0.8m courses; joint band is ~4cm wide (smoothstep over 5% of half-period).
        float courseFract = fract(vStoneWPos.y * 1.25);
        float courseMid = 1.0 - 2.0 * abs(courseFract - 0.5);
        float courseLine = smoothstep(0.0, 0.05, courseMid);
        diffuseColor.rgb *= mix(0.85, 1.0, courseLine);

        float streakHash = sin(vStoneWPos.x * 1.7 + vStoneWPos.z * 2.3) * 0.5 + 0.5;
        float streakMask = smoothstep(0.55, 0.95, streakHash);
        float streakNoise = sin(vStoneWPos.y * 0.35 + vStoneWPos.x * 0.41) * 0.5 + 0.5;
        float streak = streakMask * streakNoise * (0.4 + wetness * 0.4);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.78, 0.72, 0.62), streak);

        float grime = smoothstep(8.0, 0.5, vStoneWPos.y);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.78, 0.74, 0.68), grime * 0.5);

        diffuseColor.rgb *= mix(1.0, 0.78, wetness);`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(0.85, 0.25, wetness);
        roughnessFactor += (stoneN - 0.5) * 0.15;
        roughnessFactor += (grain - 0.5) * 0.06;
        // Mortar joints + grime are rougher than the stone face — but wet
        // mortar smooths too, so the boost shrinks with wetness.
        roughnessFactor += (1.0 - courseLine) * mix(0.12, 0.04, wetness);
        roughnessFactor += grime * mix(0.1, 0.03, wetness);`
      );
  };
  material.needsUpdate = true;
  wetUniforms.push(uniform);
}

function addCylinderFallback(scene) {
  const geo = new THREE.CylinderGeometry(TOWER_DIAMETER / 2, TOWER_DIAMETER / 2, TOWER_HEIGHT, 32);
  const mat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.85, metalness: 0.0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = TOWER_HEIGHT / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  patchWetness(mat);
  scene.add(mesh);
  return mesh;
}
