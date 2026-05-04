# Campanile — Progress & Handoff

Real-time WebGL renderer of UC Berkeley's Campanile. CS184 final project.
Solo for now; team of 4 joins later. Target hardware: M1 Pro MacBook.
One-week timeline. Deploys to GitHub Pages.

This file is the source of truth between sessions. Update the **Status** section
at the top whenever a phase is finished or scope changes.

---

## Status

- **Current phase**: Day 4 complete + side quests, visually verified. Ready to start Day 6.
- **Last action**: Day 4 landed (real Campanile glTF, wet-stone shader, PMREM env map) plus four side quests during sign-off: limestone tint, procedural low-freq stone noise, solar.js DST/longitude correction, and a night hemi floor so the tower silhouettes against a dark sky instead of glowing dusk-blue. A clock-face dial attempt was tried and reverted — the GLB plates have no UVs, and the eventual fix wasn't worth the scope creep.
- **Next phase**: Day 6 — rain particles + polish + add-ons. Plan below.
- **Day 5 is SKIPPED.** Tone.js bell chimes are off the table; we will not add audio. Roadmap and deliverables jump straight from Day 4 to Day 6.
- **Pre-Day-6 reminders**:
  - Weather state is still the canonical driver. Rain particle density / lightning probability key off `weatherCurrent.cloudCover` and/or `weatherCurrent.wetness`, the same way wet stone does.
  - `main.js` is currently at ~200 lines. New systems (rain, lightning, stars) live in their own modules under `src/` — no fat `main.js`.
  - `setWetness()` is already on a per-frame path; `pushWeatherToScene()` is the right place to feed any new weather-derived parameters.
  - PMREM env map rebakes at 2 Hz and hides the tower while baking — if a new system adds visible-from-the-sky geometry (rain streaks, lightning flash mesh), consider whether it should also be hidden during the bake.

---

## Tech stack (locked — do not substitute)

| Concern        | Choice                                                          |
| -------------- | --------------------------------------------------------------- |
| Build tool     | Vite (vanilla template, no React/Vue/etc.)                      |
| 3D engine      | Three.js (scene graph, camera, shadows, glTF loading)           |
| UI controls    | Tweakpane                                                       |
| Audio (later)  | Tone.js                                                         |
| Shaders        | Plain GLSL written by us — **not** Three.js's built-in `Sky`    |
| Modules        | ES modules everywhere, no CommonJS                              |
| Deploy target  | GitHub Pages, Vite `base: '/campanile/'`                        |

Imports must be:
```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
```

---

## Repo layout

```
campanile/
├── index.html
├── style.css
├── vite.config.js          # base: '/campanile/'
├── package.json            # dev / build / preview / deploy (gh-pages)
├── .gitignore              # node_modules, dist, .DS_Store
├── README.md
├── PROGRESS.md             # this file
├── src/
│   ├── main.js             # entry: scene, camera, lights, render loop
│   ├── solar.js            # NOAA solar position (DONE Day 2)
│   ├── ui.js               # Tweakpane panel
│   ├── weather.js          # weather presets + cross-fade (DONE Day 3)
│   ├── bells.js            # STUB — Tone.js bells (Day 5)
│   └── shaders/
│       ├── sky.vert.glsl   # Preetham vertex (DONE Day 2)
│       ├── sky.frag.glsl   # Preetham + cloudCover overlay (DONE Day 3)
│       ├── stone.vert.glsl # placeholder (Day 4)
│       └── stone.frag.glsl # placeholder (Day 4)
└── assets/
    └── .gitkeep            # campanile.glb will go here later
```

---

## Verification commands

```bash
cd /Users/kushagras/Desktop/Kushagra/Coding/Classes/COMPSCI184/campanile
npm install
npm run dev                       # localhost dev server
npm run build && npm run preview  # prod build sanity check
```

What to look for (current — through end of Day 3):
- Grass-green ground plane + grey cylinder centered on origin, under a Preetham sky.
- Orbit / zoom / pan via mouse, target locked to tower midpoint (0, 47, 0).
- `timeOfDay` slider arcs the sun across the dome; sky color shifts dawn → noon → dusk → night.
- `dayOfYear` slider visibly changes noon sun height (summer high, winter low).
- Cylinder shadow rotates with the sun and lengthens at low angles.
- `showShadows` toggle turns the cylinder shadow off and on.
- `weather` dropdown is now functional and cross-fades over ~1.5 s:
  - `clear` is byte-for-byte identical to Day 2 (cloudCover = 0, fog barely visible).
  - `overcast` desaturates the sky, fades the sun behind cloud, raises fog so the far ground edge falls off, softens shadow contrast.
  - `rain` darkens further, thickens fog, hides the sun entirely.
  - Switching back to `clear` fades in smoothly — no pop.
- Console shows three `[solar] ...` lines and **no** `Assertion failed` messages.
- No shader compile errors, no NaN black pixels in the sky in any weather state at any time-of-day.

---

## Day 1 — DONE

Scaffolding + working Three.js scene with placeholder geometry.

### Scene constants (in `src/main.js`)
- Tower placeholder: cylinder, 10 m diameter, 94 m tall, base on ground.
- Camera: PerspectiveCamera, FOV 50, near 0.1, far 5000, position (150, 30, 150), target (0, 47, 0).
- Ground: 200 m × 200 m plane, MeshStandardMaterial roughness 0.9.
- Hemisphere light: sky `#87ceeb`, ground `#444`, intensity 0.6.
- Directional light: position (100, 100, 50), intensity 1.0, casts shadow.
  - shadowMap size 2048, PCFSoftShadowMap, bias -0.0005.
  - Shadow camera frustum: ±100 left/right/top/bottom, near 50, far 300.
- Renderer: `ACESFilmicToneMapping`, `SRGBColorSpace` output, antialias on, pixel ratio capped at 2.

### Tweakpane controls (in `src/ui.js`)
- `timeOfDay` slider, 0–24, step 0.01, default 12.
- `dayOfYear` slider, 1–365, step 1, default 172 (summer solstice).
- `weather` dropdown: clear / rain / overcast.
- `showShadows` toggle, default true.

Day 1 wires only `showShadows` → `directionalLight.castShadow`. Everything else
just `console.log`s on change.

### NOT done in Day 1 (intentional)
- No Preetham sky shader.
- No solar position math.
- No glTF load — placeholder cylinder only.
- No rain particles, fog, bell audio, weather transitions.
- No loading screen / splash.
- No tests.
- No report HTML.
- No git init / commits — user does this manually.

---

## Day 2 — DONE

Real sky + real sun position, driven by the existing sliders.

### What landed

- **`src/solar.js`** — `getSunDirection(dayOfYear, timeOfDay)` returns a unit
  `THREE.Vector3` pointing toward the sun in a Y-up world (+X east, +Z south)
  for Berkeley (37.8719°N, −122.2585°W). Standard declination / hour-angle /
  altitude / azimuth equations; no equation-of-time, no atmospheric refraction.
  DEV-only `console.assert`s verify summer noon ≈ 75°, winter noon ≈ 28°,
  equinox 6am ≈ 0° pointing east.
- **`src/shaders/sky.{vert,frag}.glsl`** — Custom Preetham analytic daylight
  model. Rayleigh + Mie single-scattering, Henyey-Greenstein phase function for
  Mie, Kasten-Young airmass (finite at horizon), soft sun disc (~0.5°),
  twilight saturation tweak. Outputs linear radiance — no in-shader tonemap;
  `ACESFilmicToneMapping` on the renderer handles compression.
- **`src/main.js`** — `createSky()` helper mounts a 3000-radius inverted
  sphere with `BackSide` + `depthWrite: false` + `renderOrder: -1`. Each
  frame, the sun direction drives both the sky's `sunDirection` uniform and
  `directionalLight.position` (× 200). Directional intensity ramps with
  `max(0, sun.y)`; hemisphere intensity ramps inversely between 0.1 and 0.6
  via `mix(0.1, 0.6, smoothstep(-0.1, 0.2, sun.y))`. Added
  `directionalLight.shadow.normalBias = 0.05` to suppress peter-panning at
  grazing angles. Shadow frustum bounds left fixed at ±100 — the light's
  orbit naturally rotates the shadow.
- **`src/ui.js`** — Dropped `console.log` handlers for `timeOfDay` and
  `dayOfYear` (the sliders now have real effects). Kept the `weather` log
  since it's still a stub.

### Post-feedback tweaks (still Day 2)

After visual review, three issues surfaced and were fixed in the same phase:

- **Sun glow was a giant white blob at sunrise.** Root cause: in-scattering
  was using full top-of-atmosphere sun radiance regardless of how much
  atmosphere the sun ray itself had to traverse. Fix: multiply `Lin` by
  `sunExt = exp(-betaTotal * pathSun)` — this both dims the horizon glow at
  dawn/dusk and naturally biases it red (blue extincts faster). Also tightened
  the sun disc smoothstep band 10× and dropped its brightness multiplier from
  30 → 8. Switched to the standard exp-cutoff `sunIntensity()` formulation
  for smoother horizon falloff.
- **Deep night was pitch black.** Root cause: hemi floor of 0.1 was too low
  to register after ACES tonemap. Fix: lifted floor to 0.25
  (`mix(0.25, 0.6, smoothstep(-0.1, 0.2, sun.y))`).
- **Ground read as featureless white-grey wash.** Root cause: neutral 0x8a8a8a
  ground material against a bright sky has no visual hook. Fix: changed to
  muted grass green `0x3e5a2c`, roughness 1.0 (Memorial Glade is grass).

### NOT done in Day 2 (intentional)

- No weather (overcast, clouds, fog) — Day 3.
- No glTF / wet stone — Day 4.
- No moon / stars / night-sky procedural detail.
- No Hosek-Wilkie. Preetham is the assignment.
- No aerial perspective on the tower itself.

---

## Day 3 — DONE

The `weather` dropdown now drives the scene. Three states cross-faded with
a ~1.5 s exponential lerp — no pop on toggle. `clear` pins to Day 2 defaults
by construction (cloudCover = 0 and matching scattering uniforms), so the
noon-clear scene is byte-for-byte unchanged.

### What landed

- **`src/weather.js`** — `WEATHER_PRESETS` for the three named states, a
  module-scoped `current` object (mutated in place every frame, never
  reassigned), and `updateWeather(dt, targetName)`. Math is the
  frame-rate-independent exponential approach `t = 1 - exp(-dt / 1.5)`,
  applied to each scalar key and to the fog `THREE.Color` via `.lerp()`.
  A single module-scope `_targetColor` is reused for the per-frame setHex —
  no per-frame allocations. Falls back to `clear` if `targetName` is
  unknown rather than throwing.
- **`src/shaders/sky.frag.glsl`** — added `uniform float cloudCover;` and
  a flat overlay block at the very end of `main()`. The sun disc is
  multiplied by `(1.0 - cloudCover)` at the addition site (no
  double-application). The cloud overlay desaturates the existing scene
  color toward its luminance and darkens to ~0.85×, then `mix`es by
  `cloudCover`. No procedural noise, no FBM — flat layer only.
- **`src/main.js`** — added a module-scoped `THREE.Clock`, a `scene.fog`
  initialized to the `clear` preset (`FogExp2`), and a `cloudCover` uniform
  on the sky material. `render()` now calls `updateWeather(clock.getDelta(),
  params.weather)` exactly once per frame at the top, then
  `pushWeatherToScene()` copies the `current` state onto sky uniforms and
  `scene.fog`. `getDelta()` is destructive — single call only. File still
  181 lines, under the 200 cap.
- **`src/ui.js`** — dropped the `console.log` handler on the `weather`
  binding; the dropdown is now read directly from `params.weather` each
  frame.

### Preset values (in `src/weather.js`)

```js
clear:    { turbidity: 2.5, rayleigh: 1.0, mieCoefficient: 0.005,
            exposure: 1.0,  cloudCover: 0.0,
            fogColor: 0xb8c8d8, fogDensity: 0.0005 }
overcast: { turbidity: 6.0, rayleigh: 0.6, mieCoefficient: 0.012,
            exposure: 0.85, cloudCover: 0.85,
            fogColor: 0x9aa4ad, fogDensity: 0.004 }
rain:     { turbidity: 8.0, rayleigh: 0.5, mieCoefficient: 0.020,
            exposure: 0.6,  cloudCover: 1.0,
            fogColor: 0x6c747c, fogDensity: 0.008 }
```

### Post-feedback tweaks (still Day 3)

After visual review, three issues surfaced under non-clear weather and were
fixed in the same phase. All fixes are in `sky.frag.glsl`'s cloud block —
preset values were left as-is.

- **Pre-dawn overcast was pitch black.** Root cause: the original cloud
  overlay (luminance-preserving desaturation of the underlying sky color)
  inherits zero brightness when the underlying scattering is near zero.
  Fix: replaced the overlay with a uniform diffuse cloud color driven by
  sun *height*, with a ~0.05 brightness floor so the dome stays visible
  through the night. Independent of view direction, so no inherited
  horizon-vs-zenith gradient.
- **Morning overcast had a dark zenith / bright horizon gradient.** Same
  root cause as above — desaturating the underlying Preetham integral
  preserves its horizon-bright shape. Same fix: uniform sun-height-driven
  cloud color erases the gradient.
- **Sunrise rain showed a giant white sun blob despite cloudCover = 1.0.**
  Root cause: the disc was correctly faded by `(1 - cloudCover)`, but the
  Mie forward-peak in `inScatter` was not — and luminance-preserving
  desaturation kept the resulting bright blob bright. Fix: multiply
  `inScatter` by `cloudAbsorb = 1 - cloudCover * 0.9` so the in-scattering
  integral itself attenuates with cloud cover. The remaining 10% leaks
  through at full overcast as a soft brightness near the sun direction,
  augmented by a small `pow(cosViewSun, 4)` halo term.

The cloud block now also has a subtle warm tint near the horizon
(`vec3(1.0, 0.92, 0.78)` → white as `sun.y` rises past 0.2), so sunset/sunrise
under overcast gets a faint warm cast rather than a flat grey.

- **Rain at midnight read as bright daylight-grey, much brighter than clear
  midnight.** Root cause: `FogExp2.color` is a constant that doesn't
  respond to scene lighting. With rain's high `fogDensity = 0.008`, ~76%
  of the ground at typical camera distance was being replaced by the
  preset fog color regardless of whether there was any light to scatter
  through the fog. Fix: in `pushWeatherToScene()`, scale the fog color by
  `mix(0.05, 1.0, smoothstep(-0.15, 0.25, sun.y))` — same curve as the
  cloud overlay's brightness, so the sky-to-fog transition stays
  continuous. Fog still has a 5% floor so far things fade slightly even
  at deep night. `pushWeatherToScene()` now needs `_sunDir` to be set
  before it's called, so the call moved to after `getSunDirection()` in
  `render()`.

### Realism pass (still Day 3)

After the screenshots looked correct but felt static / "lit wrong," four
small additions were made — all within the no-noise, no-volumetrics, no-new-
controls scope of the spec:

- **Sky-derived cloud tint.** The cloud overlay used to lerp toward a
  hand-tuned warm color at low sun. Now `cloudLight = sunExt + vec3(0.4)` —
  the same atmospheric extinction along the sun ray that reddens clear
  sunsets now drives the cloud color. Sunset under overcast is *physically*
  warm-tinted instead of constant-tinted; noon overcast is neutral
  automatically. ~3-line shader edit.
- **Weather-modulated lights.** `directionalLight.intensity` multiplies by
  `mix(1.0, 0.15, cloudCover)` so a thick cloud dims direct sun by ~85%.
  `directionalLight.color` lerps toward a slight cool-white under cloud.
  `hemi.color` lerps from the clear-sky blue (`0x87ceeb`) to the live fog
  color — under overcast/rain, the "sky" lighting the ground IS the cloud
  bottom, so the hemi color should match. `hemi.intensity` gets a 1.4×
  boost under full cloud to fill in the now-soft shadows. Net: shadow
  contrast naturally softens under cloud (no PCF/VSM tweaks needed),
  ground desaturates and reads cool under rain.
- **Time-of-day fog density modulation.** `fog.density *= mix(1.5, 1.0,
  smoothstep(sun.y, 0.05, 0.4))` — fog is ~50% denser near dawn/dusk and
  thins back to preset at midday. Sweeping `timeOfDay` 5→12 under overcast
  now visibly "lifts" the fog through the morning.
- **Cloud breathing.** `cloudCover` uniform gets a ±0.07 perturbation from
  two incommensurate sines (`sin(t*0.13)*0.04 + sin(t*0.07)*0.03`) on top
  of the lerped target. Below conscious perception per-frame but kills the
  static feel of a perfectly uniform cloud layer. No procedural noise — just
  one scalar wiggling over time.

All four live in `pushWeatherToScene()` (and the cloud block of the sky
shader). `main.js` is at 200 lines exactly.

### NOT done in Day 3 (intentional)

- No rain particles — Day 6.
- No glTF / wet stone — Day 4.
- No procedural 3D clouds, no FBM, no volumetrics. Flat overlay only.
- No additional Tweakpane controls; preset values are not exposed as live
  sliders.
- No new weather states beyond the three named ones.
- No retuning of Day 2 defaults — `clear` *is* the Day 2 tuning.

---

## Day 4 — DONE

Real Campanile geometry on a wet-stone PBR shader, with the wetness scalar
following the same Day 3 lerp curve as every other weather parameter. The
GLB shipped with a number of authoring quirks that took most of the day to
work around; the final pipeline is documented below for the next time we
touch it.

### What landed

- **`src/weather.js`** — added `wetness` to all three presets
  (`clear: 0.0`, `overcast: 0.4`, `rain: 1.0`), to `SCALAR_KEYS`, and to
  the `current` state object. Zero new code paths — the existing
  `updateWeather` lerp picked it up.
- **`src/stone.js`** (new) — `loadCampanile(scene)` GLTFLoader wrapper
  with cylinder fallback, plus the `onBeforeCompile` wet-stone patch.
  - **GLB filtering rules**: `Ground`, `Plaza`, `Path_*`, `Wall_*`,
    `Bollard*`, `Pilaster_M_*` are hidden (they're props/glitches that
    don't belong on Memorial Glade). Blender's auto-suffixed duplicates
    (`*.001` etc.) are also hidden.
  - **`fixLowerWindows`**: lower-shaft window strips have a duplicate-pair
    authoring bug — one floats past the wall, one is buried inside it.
    The patch snaps the outer copy onto the wall surface
    (`LOWER_WALL_R = 1.32` in GLB units) and hides the inner duplicate.
    The belfry colonnade (`Col_*` / `ColBase_*` / `ColCap_*`) sits past
    `BelfryShaft` too but that's *intentional* — freestanding columns —
    so it's left alone.
  - **`normalizeToTower`**: two-pass bbox normalization. Scale uses the
    *full* bbox (so the tower height stays at 94 m regardless of which
    props are filtered); centering and grounding use only *visible*
    meshes (so the lowest tower step sits on grass, not on the height
    of the hidden plaza underneath).
- **`src/envmap.js`** (new) — `PMREMGenerator`-based scene-environment
  bake at 2 Hz. Hides the tower mesh during the bake so wet stone
  doesn't reflect itself. Without this, wet stone reads as dark plastic
  because `MeshStandardMaterial`'s specular term samples a black
  environment by default.
- **`src/main.js`** — top-level `await loadCampanile(scene)`,
  `initEnvMap(renderer)` after fog setup, `updateEnvMap(scene, t, tower)`
  in `render()`, and `setWetness(weatherCurrent.wetness)` /
  `directionalLight.shadow.intensity = lerp(1.0, 0.75, cc)` added to
  `pushWeatherToScene()`. Vite `build.target` bumped to `'esnext'` for
  top-level await support.

### Wet-stone shader patch (in `stone.js`)

The `patchWetness(material)` `onBeforeCompile` injection does **three**
things in fixed order on every `MeshStandardMaterial`:

1. **Limestone tint** — `diffuseColor.rgb *= vec3(1.05, 1.0, 0.85)`. The
   real Campanile is warm Indiana limestone, not neutral grey. Shifts
   the whole tower cream/tan without retouching any GLB material.
2. **Low-frequency stone noise** — three incommensurate sines on world
   position (`vStoneWPos`, passed through a custom varying because
   `MeshStandardMaterial` doesn't expose `vWorldPosition` outside the
   env-map path). Frequencies `(0.5, 0.27, 0.43)`. Modulates diffuse
   `mix(0.92, 1.08, n)` and roughness `+= (n - 0.5) * 0.15`. Multi-meter
   patches break up the flat painted look without committing to a real
   texture asset.
3. **Wetness** — diffuse `*= mix(1.0, 0.78, wetness)` (uniform darken)
   and roughness `= mix(0.85, 0.25, wetness)` (uniform smoothing). Comes
   *after* the tint+noise so wet stone keeps its warm undertone and
   weathered patches.

Per-material `wetness` uniform lives on `material.userData.wetness =
{ value: 0 }` and is wired to the compiled shader via `shader.uniforms`.
A module-scope `wetUniforms[]` array lets `setWetness()` push the same
value to every patched material in one tight loop.

### Side quests during sign-off

These were not in the original Day 4 spec; they came up during visual
review and were addressed in-phase rather than punted:

- **Limestone tint and stone noise** (above) — both originally listed as
  optional Day 7 polish. Cheap enough to land now and they ground the
  visual.
- **`solar.js` DST + longitude correction.** The original code treated
  `timeOfDay` as solar time, so 17:29 on May 3 read as ~18° altitude
  (sunset-like). Berkeley sits 9 min west of the Pacific time-zone
  meridian and observes PDT March–November, so 17:29 *clock* time is
  actually solar time ≈ 16:09 → ~31° altitude. Now `getSunDirection`
  treats input as Berkeley local clock time, applies a day-of-year DST
  window (days 70–308) and the longitude offset
  (`LON_OFFSET_HR = -0.151`), and the dev `console.assert` lines were
  updated to use clock-time inputs (e.g. summer solstice solar noon =
  13:09 PDT, not 12:00). Equation of time (±15 min) still ignored.
- **Night hemi floor.** The Day 2 hemi floor of `0.25` kept the tower
  visible at midnight but glowing dusk-blue. Lowered the night floor to
  `0.07` (`mix(0.07, 0.6, smoothstep(_sunDir.y, -0.1, 0.2))`) so the
  tower silhouettes against a dark sky rather than disappearing into
  pitch black or floating in dusk light.
- **Clock-face dial — attempted, reverted.** The four `ClockFace_*`
  plates in the GLB use the dark `GraniteDark` material and ship with
  no `TEXCOORD_0`, only `POSITION` + `NORMAL`. A first attempt at a
  procedural canvas-texture dial (Roman numerals + live hour/minute
  hands keyed to `params.timeOfDay`) failed because there are no UVs
  to sample against. Generating planar UVs from each plate's bbox would
  work but introduces orientation-flip handling per cardinal face plus
  emissive-glow tuning so the recessed dial reads behind the bronze
  ring — too much surface area for what was supposed to be a polish
  beat. Removed entirely; clock plates now go through the standard
  `patchWetness` path and read as part of the wall behind the bronze
  ring.

### Verification (signed off)

- Real Campanile geometry visible, ~94 m tall, sitting on grass with the
  filtered-out plaza/paths/walls/etc. correctly hidden.
- Wet/dry transition smooth across the same 1.5 s curve as the rest of
  the weather state.
- Limestone tint reads warm cream/tan in clear noon; stone noise is
  visible as gentle multi-meter patches on close inspection.
- Sun position at 17:29 on day 123 reads as afternoon, not sunset.
- Night sky and tower both go dark — tower stays a faint silhouette,
  not pitch black.
- No shader compile errors, no `THREE.WebGLProgram` warnings, no
  console asserts firing.

### NOT done in Day 4 (intentional)

- No rain particles — Day 6 (now next).
- No procedural cracks, moss, or normal maps.
- No physically-correct puddle pooling or screen-space reflections.
- No new Tweakpane controls — `wetness` derived from `weather`.
- No retuning of Day 3 lighting.

---

## Day 5 — SKIPPED

Tone.js bell synthesis is dropped. We will not add audio to the project.
Roadmap and deliverables go straight from Day 4 to Day 6.

---

## Day 6 — PLAN (next)

Headline: rain particles. While we're in there, add a few small
weather-driven effects that fill obvious gaps the previous days exposed
(empty night sky, missing storm drama, missing audio replaced with visual
weather cues).

### Goals (in priority order)

1. **Rain particles.** Visible falling streaks during `rain`, faint
   drizzle during `overcast`, none in `clear`. Density driven by
   `weatherCurrent.cloudCover` (or a new derived `rainStrength`), with
   the same 1.5 s cross-fade as everything else. Streaks have wind drift
   and a slight forward tilt.
2. **Lightning flash.** Rare random pulses during `rain` only — bright
   directional-light boost + sky exposure spike for a few frames, then
   exponential decay. Optional follow-up flicker. Probability scales with
   `rainStrength`. Acts as the visual equivalent of the audio drama we're
   not building.
3. **Stars + moon at night.** The night-floor change in Day 4 left the
   sky genuinely dark, which made the empty dome obvious. Add a fixed
   star field (rendered into the existing sky shader or as a separate
   pass) and a simple moon disc that follows an opposite arc to the sun.
   Both fade in/out with `smoothstep(_sunDir.y, 0.0, -0.1)` so they only
   appear after dusk.
4. **Distant lightning ambient flash on cloud.** If lightning ships
   cleanly, modulate `cloudCover` brightness for a subset of pulses so
   the cloud layer flashes from within (heat-lightning look) without a
   visible bolt. Cheap and atmospheric.
5. **Polish sweep.** Walk through dawn / noon / dusk / midnight under
   each of the three weather states and fix any remaining transition
   pops, NaN pixels, or shadow-frustum artifacts.

### File plan

- `src/rain.js` (new) — particle system. `Points` with a custom
  `ShaderMaterial` (streak quads via `gl_PointSize` + texture, OR an
  `InstancedMesh` of thin lines if streaks need real length).
  `setRainStrength(value)` exported, called from `pushWeatherToScene()`.
  Wraps particles around the camera so the rain volume travels with
  the viewer.
- `src/sky.js` (new) — moves the sky factory + new stars/moon code out
  of `main.js`. Or extend `shaders/sky.frag.glsl` directly with a
  procedural star sample and a moon disc; keep the file boundary
  whichever way is cleaner.
- `src/lightning.js` (new) — randomized pulse scheduler. Holds onto
  `directionalLight` + `sky.material` references and drives short
  intensity/exposure spikes. Exposes `updateLightning(dt, scene)`.
- `src/main.js` — wire the three new modules into `render()` and
  `pushWeatherToScene()`. Should still stay in the ~200-line
  neighborhood.
- `src/ui.js` — possibly add a `lightning` toggle (so demo can be
  forced/suppressed). No new sliders unless we add a fourth weather
  state (we won't this phase).

### Constraints

- Per-frame allocations stay zero — pre-allocate buffers, reuse vectors.
- Particles are GPU-driven where possible. CPU per-particle work caps
  at maybe a few thousand (camera-relative wrap math).
- New systems must respect `params.showShadows` if they cast shadows
  (probably they don't — rain/stars/moon shouldn't).
- Wet-stone shader stays untouched. Rain *amount* and stone *wetness*
  are two different sliders driven by the same weather state; don't
  conflate them.
- No commit until user signs off. User commits manually.

### Stretch (only if time permits and the headline ships clean)

- Subtle ground darkening / puddle reflectance under rain — a roughness
  modulation on the grass plane, not real puddles.
- Wind direction visible in subtle tree/grass motion (we don't have
  trees yet, so this is really "rain wind direction").
- Streaks bias toward the camera direction so close drops read as
  forward streaks vs. distant drops as point dots.

### Out of scope for Day 6 (do NOT do)

- No bell audio. No audio at all.
- No real volumetric rain or volumetric clouds.
- No screen-space god rays / lens flare.
- No fourth weather state ("snow", "storm", etc.) — keep the trio.
- No new physics. Rain is purely visual.

---

## Later phases (rough roadmap)

| Day | Scope                                                                |
| --- | -------------------------------------------------------------------- |
| 3   | Weather state machine — clear/rain/overcast cloud cover, fog density |
| 4   | Wet stone PBR shader + glTF Campanile model load                     |
| 5   | SKIPPED — Tone.js bell synthesis is dropped, no audio                |
| 6   | Rain particles + lightning + stars/moon, polish                      |
| 7   | Report HTML, GitHub Pages deploy, demo prep                          |

---

## Style preferences

- Clarity over cleverness. Code should read linearly.
- `main.js` stays under ~200 lines.
- Named functions over inline arrows where it aids readability.
- No abstraction layers (no scene managers, no event buses) — direct Three.js calls.
- Comments only where the **why** is non-obvious.
