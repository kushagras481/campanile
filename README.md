# Campanile

Real-time WebGL renderer of UC Berkeley's Campanile. CS184 final project.

## Develop

```bash
npm install
npm run dev
```

## Build / preview

```bash
npm run build
npm run preview
```

## Deploy (GitHub Pages)

```bash
npm run deploy
```

The Vite `base` is set to `/campanile/` — change it in `vite.config.js` if the
repo is renamed.

## Structure

- `src/main.js` — scene, camera, lights, render loop
- `src/ui.js` — Tweakpane controls
- `src/solar.js` — solar position math (stub)
- `src/weather.js` — weather state (stub)
- `src/bells.js` — Tone.js bell synthesis (stub)
- `src/shaders/` — sky and stone GLSL (placeholders)
- `assets/` — `campanile.glb` lands here later
