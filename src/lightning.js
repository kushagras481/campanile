// Random lightning pulses during rain. Each strike is an instantaneous
// brightness spike that decays exponentially over ~0.06s; a fraction get a
// follow-up flicker 60–180ms later to read as the staccato of a real flash.
// Output is a single 0..~1 scalar `flash`. main.js applies it to:
//   - sky exposure (whole dome flashes)
//   - hemi intensity (ground / shadow side fills with cool light)
//   - rain shader flashBoost uniform (drops glint)
//
// We deliberately do NOT touch the directional sun light — lightning flashes
// at night, when the sun is below the horizon, and using the sun for it would
// produce shadows from the wrong direction.

const STRIKE_INTERVAL = 7.5; // mean seconds between strikes at full rain
const STRIKE_THRESHOLD = 0.45; // rain strength below this → no lightning
const DECAY = 0.06;          // exp time constant — lower = snappier
const FLICKER_PROB = 0.4;
const FLICKER_MIN_DELAY = 0.06;
const FLICKER_MAX_DELAY = 0.18;
const POOL_SIZE = 8;

// Pre-allocated strike pool — slots are reused so updateLightning() never
// allocates per frame, no matter how dense the storm.
const strikes = [];
for (let i = 0; i < POOL_SIZE; i++) strikes.push({ start: -Infinity, peak: 0 });

let enabled = true;
let strength = 0;
let nextStrike = Infinity;

export function setLightningEnabled(value) {
  enabled = value;
  if (!enabled) nextStrike = Infinity;
}

export function setLightningRainStrength(value, time) {
  strength = value;
  if (!enabled || strength < STRIKE_THRESHOLD) {
    nextStrike = Infinity;
  } else if (!isFinite(nextStrike)) {
    nextStrike = scheduleNext(time);
  }
}

function scheduleNext(now) {
  // Exponential interarrival; mean shrinks as rain intensifies.
  const mean = STRIKE_INTERVAL / Math.max(0.2, strength);
  const u = Math.max(1e-6, Math.random());
  return now - Math.log(u) * mean;
}

function spawn(time, peak) {
  // Find a "dead" slot first (decayed past visibility).
  let oldestIdx = 0;
  let oldestStart = strikes[0].start;
  for (let i = 0; i < POOL_SIZE; i++) {
    const s = strikes[i];
    if (time - s.start > DECAY * 8) { s.start = time; s.peak = peak; return; }
    if (s.start < oldestStart) { oldestIdx = i; oldestStart = s.start; }
  }
  // No dead slot — overwrite oldest.
  strikes[oldestIdx].start = time;
  strikes[oldestIdx].peak = peak;
}

export function updateLightning(time) {
  if (enabled && time >= nextStrike) {
    spawn(time, 0.7 + Math.random() * 0.6);
    if (Math.random() < FLICKER_PROB) {
      const delay = FLICKER_MIN_DELAY + Math.random() * (FLICKER_MAX_DELAY - FLICKER_MIN_DELAY);
      spawn(time + delay, 0.4 + Math.random() * 0.5);
    }
    nextStrike = scheduleNext(time);
  }

  // Composite: take the max of all active strikes (overlapping flashes don't
  // sum past 1, real lightning saturates the visual response anyway).
  let flash = 0;
  for (let i = 0; i < POOL_SIZE; i++) {
    const s = strikes[i];
    if (time < s.start) continue;
    const age = time - s.start;
    const v = s.peak * Math.exp(-age / DECAY);
    if (v > flash) flash = v;
  }
  return flash;
}
