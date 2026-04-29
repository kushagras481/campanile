import * as THREE from 'three';

// Canonical weather state. `clear` pins to the Day 2 sky tuning by design — at
// cloudCover = 0 the shader is unchanged, and the other scalars match the
// values createSky() ships with. Don't retune these without retuning Day 2.
export const WEATHER_PRESETS = {
  clear: {
    turbidity: 2.5,  rayleigh: 1.0,  mieCoefficient: 0.005,
    exposure: 1.0,   cloudCover: 0.0,
    fogColor: 0xb8c8d8, fogDensity: 0.0005,
  },
  overcast: {
    turbidity: 6.0,  rayleigh: 0.6,  mieCoefficient: 0.012,
    exposure: 0.85,  cloudCover: 0.85,
    fogColor: 0x9aa4ad, fogDensity: 0.004,
  },
  rain: {
    turbidity: 8.0,  rayleigh: 0.5,  mieCoefficient: 0.020,
    exposure: 0.6,   cloudCover: 1.0,
    fogColor: 0x6c747c, fogDensity: 0.008,
  },
};

const SCALAR_KEYS = ['turbidity', 'rayleigh', 'mieCoefficient', 'exposure', 'cloudCover', 'fogDensity'];
const TIME_CONSTANT = 1.5; // seconds; ~1.5s feels smooth without dragging
const CLEAR = WEATHER_PRESETS.clear;

// Live state. main.js mutates uniforms / scene.fog from this every frame.
// Mutated in place — never reassigned, so other modules can hold references.
export const current = {
  turbidity: CLEAR.turbidity,
  rayleigh: CLEAR.rayleigh,
  mieCoefficient: CLEAR.mieCoefficient,
  exposure: CLEAR.exposure,
  cloudCover: CLEAR.cloudCover,
  fogColor: new THREE.Color(CLEAR.fogColor),
  fogDensity: CLEAR.fogDensity,
};

// Allocated once; reused every frame to avoid per-frame Color churn.
const _targetColor = new THREE.Color();

export function updateWeather(dt, targetName) {
  const target = WEATHER_PRESETS[targetName] ?? CLEAR;
  // Frame-rate independent exponential approach: identical visual lerp speed
  // regardless of dt. At dt = 1.5s, t ≈ 0.63 (one time constant).
  const t = 1 - Math.exp(-dt / TIME_CONSTANT);
  for (const k of SCALAR_KEYS) {
    current[k] += (target[k] - current[k]) * t;
  }
  _targetColor.set(target.fogColor);
  current.fogColor.lerp(_targetColor, t);
}
