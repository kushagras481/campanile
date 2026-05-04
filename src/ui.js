import { Pane } from 'tweakpane';
import { setLightningEnabled } from './lightning.js';

// State object the UI mutates. main.js holds the canonical reference and reads
// from it each frame.
export const params = {
  timeOfDay: 12,
  dayOfYear: 172,
  weather: 'clear',
  showShadows: true,
  lightning: true,
};

export function initUI() {
  const pane = new Pane({ title: 'Campanile' });

  pane.addBinding(params, 'timeOfDay', { min: 0, max: 24, step: 0.01, label: 'Time of day' });
  pane.addBinding(params, 'dayOfYear', { min: 1, max: 365, step: 1, label: 'Day of year' });

  pane.addBinding(params, 'weather', {
    label: 'Weather',
    options: { clear: 'clear', rain: 'rain', overcast: 'overcast' },
  });

  pane.addBinding(params, 'showShadows', { label: 'Show shadows' });

  pane
    .addBinding(params, 'lightning', { label: 'Lightning' })
    .on('change', (ev) => setLightningEnabled(ev.value));

  return pane;
}
