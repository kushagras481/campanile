import * as THREE from 'three';

// GPU-driven rain. One LineSegments draw, two verts per drop. The vertex
// shader computes each drop's world position from `time + phase` so the CPU
// touches no per-particle state per frame — `updateRain()` only writes the
// time/camera uniforms. Drops wrap around the camera xz so the rain volume
// follows the viewer; vertical wrap happens implicitly via mod(time, height).

const COUNT = 6500;
const RADIUS = 70;       // horizontal cylinder radius around camera
const HEIGHT_VOL = 90;   // vertical sweep before wrapping
const TOP_OFFSET = 50;   // top of volume above camera y
const FALL_SPEED = 30;   // m/s — perceptually right for rain
const STREAK_LEN = 0.85; // world-units; baseline trail length (jittered per drop)

let mesh = null;
let material = null;

export function initRain(scene) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(COUNT * 6);
  const phases = new Float32Array(COUNT * 2);
  const ends = new Float32Array(COUNT * 2);

  for (let i = 0; i < COUNT; i++) {
    // Uniform-area distribution within the cylinder (sqrt for area weighting).
    const r = Math.sqrt(Math.random()) * RADIUS;
    const theta = Math.random() * Math.PI * 2;
    const x = r * Math.cos(theta);
    const z = r * Math.sin(theta);

    positions[i * 6 + 0] = x; positions[i * 6 + 1] = 0; positions[i * 6 + 2] = z;
    positions[i * 6 + 3] = x; positions[i * 6 + 4] = 0; positions[i * 6 + 5] = z;

    const ph = Math.random();
    phases[i * 2 + 0] = ph;
    phases[i * 2 + 1] = ph;

    ends[i * 2 + 0] = 0; // leading (bottom of streak)
    ends[i * 2 + 1] = 1; // trailing (top of streak)
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
  geo.setAttribute('endIdx', new THREE.BufferAttribute(ends, 1));

  material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      camPos: { value: new THREE.Vector3() },
      strength: { value: 0 },
      tint: { value: new THREE.Color(0xb8c8d8) },
      streakLen: { value: STREAK_LEN },
      fallSpeed: { value: FALL_SPEED },
      windX: { value: 0.85 },
      topOffset: { value: TOP_OFFSET },
      heightVol: { value: HEIGHT_VOL },
      flashBoost: { value: 0 }, // lightning brightens drops in-shot
    },
    vertexShader: /* glsl */ `
      uniform float time;
      uniform vec3 camPos;
      uniform float strength;
      uniform float streakLen;
      uniform float fallSpeed;
      uniform float windX;
      uniform float topOffset;
      uniform float heightVol;
      attribute float phase;
      attribute float endIdx;
      varying float vAlpha;

      // Cheap scalar hash — second uncorrelated random per drop without paying
      // for an extra attribute upload. Real rain has hugely varied drop sizes
      // and exposure-time streak lengths, so jittering each per-drop knob
      // independently breaks up the "same drop replicated" look.
      float hash(float n) { return fract(sin(n * 91.345) * 43758.5453); }

      void main() {
        float r1 = hash(phase * 17.31);
        float r2 = hash(phase * 91.7);
        float r3 = hash(phase * 53.9);

        float dropLen    = mix(0.55, 1.35, r1);  // streak length jitter
        float dropBright = mix(0.45, 1.0,  r2);  // per-drop opacity
        float speedMul   = mix(0.85, 1.15, r3);  // small terminal-velocity spread

        // Volume tracks the camera xz so the rain doesn't get left behind.
        vec3 wp;
        wp.x = position.x + camPos.x;
        wp.z = position.z + camPos.z;

        float fall = mod(time * fallSpeed * speedMul + phase * heightVol, heightVol);
        wp.y = camPos.y + topOffset - fall;

        // Wind drift; gust frequency low so groups of drops sweep together.
        wp.x += sin(time * 0.27 + phase * 31.4) * windX;

        // Trailing vertex lifts up + back along the wind so the streak aligns
        // with the drop's motion vector. dropLen jitters length; the 0.22
        // factor matches the windX/fallSpeed ratio for a believable angle.
        float L = streakLen * dropLen;
        wp.y += endIdx * L;
        wp.x -= endIdx * L * 0.22;

        vec4 viewPos = viewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * viewPos;

        float dist = -viewPos.z;
        // Far drops fade into fog; very near drops fade out a hair so we don't
        // get giant streaks slamming the lens.
        float distFade = 1.0 - smoothstep(40.0, 80.0, dist);
        float nearFade = smoothstep(1.5, 5.0, dist);

        // Sharp leading edge → soft trail. Squared falloff feels more like
        // motion blur than the previous linear taper.
        float taper = pow(1.0 - endIdx, 1.8);
        vAlpha = strength * distFade * nearFade * dropBright * taper;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 tint;
      uniform float flashBoost;
      varying float vAlpha;
      void main() {
        // Lift the streak color a touch above the (already sun-dimmed) fog
        // tint so drops register against very dark backgrounds — pure fog tint
        // disappears at midnight.
        vec3 c = mix(tint, vec3(1.0), 0.18) + vec3(flashBoost);
        gl_FragColor = vec4(c, vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });

  mesh = new THREE.LineSegments(geo, material);
  mesh.frustumCulled = false; // we wrap to the camera, the bbox lies anyway
  mesh.renderOrder = 5;       // draw after opaque scene
  mesh.visible = false;       // off until rainStrength rises
  scene.add(mesh);
}

export function getRainMesh() {
  return mesh;
}

export function setRainStrength(value) {
  if (!material) return;
  material.uniforms.strength.value = value;
  // Skip the draw entirely when there's effectively no rain.
  mesh.visible = value > 0.01;
}

export function setRainTint(color) {
  if (!material) return;
  material.uniforms.tint.value.copy(color);
}

export function setRainFlash(boost) {
  if (!material) return;
  material.uniforms.flashBoost.value = boost;
}

export function updateRain(time, camera) {
  if (!material || !mesh.visible) return;
  material.uniforms.time.value = time;
  material.uniforms.camPos.value.copy(camera.position);
}
