# Campanile — Progress & Handoff

Real-time WebGL renderer of UC Berkeley's Campanile. CS184 final project.
Solo for now; team of 4 joins later. Target hardware: M1 Pro MacBook.
One-week timeline. Deploys to GitHub Pages.

This file is the source of truth between sessions. Update the **Status** section
at the top whenever a phase is finished or scope changes.

---

## Status

- **Current phase**: Day 3 complete and visually verified.
- **Last action**: Reworked the cloud overlay to fix three issues surfaced in visual review (pitch-black pre-dawn overcast, inverted-gradient morning overcast, giant sun blob through "rain"). Cloud is now a sun-height-driven uniform diffuse with in-scattering absorption.
- **Next phase**: Day 4 — wet-stone PBR shader + glTF Campanile model load. See plan below.
- **Blocked on**: Nothing. (Day 4 may need a Sketchfab placeholder if `assets/campanile.glb` isn't ready yet.)

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

### NOT done in Day 3 (intentional)

- No rain particles — Day 6.
- No glTF / wet stone — Day 4.
- No procedural 3D clouds, no FBM, no volumetrics. Flat overlay only.
- No additional Tweakpane controls; preset values are not exposed as live
  sliders.
- No new weather states beyond the three named ones.
- No retuning of Day 2 defaults — `clear` *is* the Day 2 tuning.

---

## Day 4 — PLAN (do not implement until user gives go-ahead)

Goal: replace the cylinder placeholder with the real Campanile geometry and
give it a wet-stone PBR look that responds to the weather state. Wetness is
just another lerp following the same curve as Day 3's scalars.

### Asset reality check (read first)

`assets/campanile.glb` may not exist at the start of Day 4. If it doesn't,
swap in a Sketchfab / Poly Haven placeholder model temporarily — anything
roughly tower-shaped will do, as long as it loads via `GLTFLoader`. The
shader work is independent of the exact mesh; we just need *something* to
shade. Do not block on the real model; mark a TODO and proceed with the
placeholder so the wet/dry path is end-to-end testable.

When the real model arrives, drop it in at `assets/campanile.glb`, adjust
the scale + position to match the cylinder it's replacing (TOWER_HEIGHT =
94 m, base on ground, centered on origin), and remove the placeholder.

### Wetness as a weather-derived parameter

Add a `wetness` field to each preset and to `current`:

```js
clear:    { ..., wetness: 0.0 }
overcast: { ..., wetness: 0.4 }   // damp but not glistening
rain:     { ..., wetness: 1.0 }
```

`updateWeather` already iterates `SCALAR_KEYS` — adding `'wetness'` to that
array is the entire wiring change. No new shape, no new lerp.

### Wet-stone shader approach

Two reasonable paths. Pick one:

**A. `MeshStandardMaterial.onBeforeCompile` injection (preferred for MVP).**
Hook the material the loader returns and inject GLSL fragments that:
- Lower roughness and raise specular reflectance as `wetness` rises
  (wet stone roughness ≈ 0.25, dry ≈ 0.85). Specifically `roughness = mix(0.85, 0.25, wetness)`.
- Slightly darken the diffuse albedo (wet things look ~15–25% darker).
- Optionally add a subtle vertical-gradient mask so puddling reads at the
  base / horizontal upward-facing surfaces (`max(0, normal.y)` weighting).
- Pass `wetness` in via a `uniforms.wetness = { value: 0.0 }` patched onto
  the material; update each frame from `weatherCurrent.wetness`.

This keeps lighting/shadowing/IBL/tonemapping integration free, which is
the whole reason `MeshStandardMaterial` exists.

**B. Custom `ShaderMaterial`.** Only justified if (A) gets too tangled —
e.g., we end up needing custom BRDF behavior the standard material can't
express. Drop this option unless it becomes obviously cleaner; carrying our
own BRDF is a lot of surface area for a one-week project.

Default to A. Use B only with explicit justification.

### Steps

1. **Add `wetness` to the weather state.**
   - Add `wetness: 0.0/0.4/1.0` to the three presets in `src/weather.js`.
   - Add `wetness` to `SCALAR_KEYS` so `updateWeather` lerps it.
   - Initialize `current.wetness = WEATHER_PRESETS.clear.wetness`.

2. **Load the glTF.**
   - `import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';`
   - In a new `loadCampanile(scene)` factory: `new GLTFLoader().loadAsync('/campanile/assets/campanile.glb')`
     (mind the Vite `base` — the path needs the `/campanile/` prefix in prod).
   - On load: traverse the scene, set `castShadow = receiveShadow = true` on
     every Mesh, swap or patch the material per step 3, add to scene, return
     the root.
   - Handle missing-asset failure gracefully: log a warning, keep the
     cylinder as fallback so the demo still runs.

3. **Patch the material via `onBeforeCompile`.**
   - In `loadCampanile`, traverse meshes; for each `MeshStandardMaterial`:
     - Add `material.userData.wetness = { value: 0.0 }` and reference it
       inside `onBeforeCompile` (`shader.uniforms.wetness = material.userData.wetness`).
     - Inject a `#include <roughnessmap_fragment>` replacement that does
       `roughnessFactor = mix(roughnessFactor, 0.25, wetness);`.
     - Inject a `#include <map_fragment>` replacement that does
       `diffuseColor.rgb *= mix(1.0, 0.78, wetness);`.
     - Optional: weight wet effect by `max(0.0, vNormal.y)` so undersides
       stay drier.
   - Stash the material refs (or just the userData uniform refs) on a
     module array so the per-frame loop can update `wetness` cheaply.

4. **Wire it in `main.js`.**
   - Replace `addTowerPlaceholder` with `await loadCampanile(scene)` (top
     of the module — Vite supports top-level await). Keep the cylinder as
     a fallback path inside the loader on error.
   - In `pushWeatherToScene()`: iterate the wet-material refs and set
     `userData.wetness.value = weatherCurrent.wetness`.

5. **Verification.**
   - Real (or placeholder) glTF visible centered on origin, ~94 m tall,
     casting and receiving shadows like the cylinder did.
   - Switch `weather` clear → rain: stone gets noticeably darker and shinier
     over ~1.5 s, specular highlights from the sun pop on rim/edges.
   - rain → clear: dries out smoothly.
   - No new shader compile errors. Check browser console for
     `THREE.WebGLProgram` warnings.

### Out of scope for Day 4 (do NOT do)

- No rain particles — Day 6.
- No procedural cracks, moss, or normal maps not already on the model.
- No physically-correct puddle pooling or screen-space reflections.
- No swap to a custom BRDF unless option A actually fails.
- No new Tweakpane controls. `wetness` is derived from `weather`, not a
  user knob.
- No commit. User commits manually.

Keep `main.js` under 200 lines. If glTF loading + material patching pushes
it over, factor `loadCampanile` and the material patcher into
`src/stone.js` (a new file).

---

## Later phases (rough roadmap)

| Day | Scope                                                                |
| --- | -------------------------------------------------------------------- |
| 3   | Weather state machine — clear/rain/overcast cloud cover, fog density |
| 4   | Wet stone PBR shader + glTF Campanile model load                     |
| 5   | Tone.js bell synthesis (Westminster chimes on the hour)              |
| 6   | Rain particles, weather transitions, polish                          |
| 7   | Report HTML, GitHub Pages deploy, demo prep                          |

---

## Style preferences

- Clarity over cleverness. Code should read linearly.
- `main.js` stays under ~200 lines.
- Named functions over inline arrows where it aids readability.
- No abstraction layers (no scene managers, no event buses) — direct Three.js calls.
- Comments only where the **why** is non-obvious.
