# Campanile

A real-time, physically based WebGL renderer of UC Berkeley's Campanile (Sather Tower). CS184 final project, Spring 2026.

**[Live demo →](https://kushagras481.github.io/campanile/)**

The lighting comes from physical and astronomical models rather than art-directed values: the sun's position is computed from Berkeley's coordinates and the date, the sky uses the Preetham (1999) analytical model, and a live shadow camera tracks the sun every frame. The tower itself is hand-modeled in Blender; its stone uses a procedural shader that interpolates between dry and rain-slicked states.

## Features

- **Solar positioning** — declination / hour-angle / altitude / azimuth equations anchored to Berkeley (37.87°N, 122.26°W), with longitude correction for the PST/PDT meridian and a day-of-year DST window.
- **Preetham analytical sky** — custom GLSL implementation with Rayleigh + Mie single scattering, Henyey-Greenstein phase function, Kasten-Young airmass, and a sub-degree sun disc.
- **Procedural night sky** — equal-area starfield (two layers, temperature-tinted), faint Milky Way band, and a moon disc opposite the sun.
- **Weather system** — three presets (`clear`, `overcast`, `rain`) cross-faded with a 1.5 s exponential lerp over five scalars (turbidity, fog density, cloud cover, exposure, rain strength).
- **Wet-stone PBR** — `MeshStandardMaterial` patched via `onBeforeCompile` with limestone tint, multi-scale procedural noise, masonry course lines, weather streaks, ground grime, and a wetness uniform that interpolates roughness `0.85 → 0.25` and darkens diffuse.
- **Rain + lightning** — GPU rain particles tinted each frame by the live fog color; stochastic lightning flashes scaled to rain strength, briefly boosting sky exposure, hemisphere fill, and rain-streak brightness.
- **Shadow mapping** — 2048² PCF soft shadow map with the directional light following the sun; depth/normal bias tuned to suppress Peter Panning at low sun angles, intensity dampened up to 25% under overcast.
- **PMREM environment map** — re-baked at 2 Hz so wet stone reflects the live sky without self-reflecting the tower.

## Tech stack

- **[Three.js r160](https://threejs.org/)** over WebGL 2.0 — scene graph, PBR materials, shadow mapping, GLTFLoader.
- **Custom GLSL** — sky shader written from scratch (loaded as raw strings); stone shader patched into the standard PBR fragment via `onBeforeCompile`.
- **[Tweakpane](https://tweakpane.github.io/docs/)** — live UI for `timeOfDay`, `dayOfYear`, weather preset, and shadow / lightning toggles.
- **[Vite](https://vitejs.dev/)** — bundler and dev server. `base: '/campanile/'` for GitHub Pages deployment.

## Develop

```bash
npm install
npm run dev          # localhost dev server with HMR
```

## Build / preview

```bash
npm run build
npm run preview      # serve dist/ for prod sanity check
```

## Deploy (GitHub Pages)

```bash
npm run deploy       # vite build && gh-pages -d dist
```

The Vite `base` is set to `/campanile/` — change it in `vite.config.js` if the repo is renamed.

## Repo structure

```
campanile/
├── index.html              # writeup / report (also the deployed landing page)
├── demo.html               # live interactive scene
├── style.css
├── vite.config.js
├── src/
│   ├── main.js             # renderer, scene, camera, lights, render loop
│   ├── solar.js            # sun direction from date + time of day
│   ├── weather.js          # presets + cross-fade
│   ├── stone.js            # GLB load + wet-stone shader patch
│   ├── envmap.js           # PMREM environment-map bake
│   ├── rain.js             # GPU rain particle system
│   ├── lightning.js        # stochastic flash scheduler
│   ├── ui.js               # Tweakpane bindings
│   └── shaders/
│       ├── sky.vert.glsl
│       └── sky.frag.glsl   # Preetham + clouds + stars + moon
└── assets/
    └── campanile.glb       # hand-modeled tower (Blender → glTF binary)
```

## Team

- **Shivani Wadhwa** — Preetham sky shader, weather presets, exponential fog, milestone writeup
- **Roopa Srinivas** — Blender geometry, procedural stone shader, wet/dry PBR interpolation, PCF shadow tuning
- **Akshat Kishore** — solar position math, dynamic shadow frustum, moonlight model, Tweakpane UI
- **Kushagra Srivastava** — rain particle system, lightning, atmospheric streak tinting, build pipeline & GitHub Pages deploy, final report writeup

## References

Preetham, Shirley, Smits — *A Practical Analytic Model for Daylight* (SIGGRAPH 1999) · Three.js r160 · Tweakpane · NOAA Solar Position Calculator. Full reference list in the writeup at [the live site](https://kushagras481.github.io/campanile/).
