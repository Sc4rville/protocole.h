const tone = (frequency, release, gain = 1) => ({ at: 0, gain, params: [1, 0, frequency, 0.002, 0, release, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0] });
const noise = (release, gain = 1, filter = -1600) => ({ at: 0, gain, params: [1, 0, 130, 0.005, 0, release, 4, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, filter] });
const chime = (frequency, at = 0, gain = 0.3) => ({ at, gain, params: [1, 0, frequency, 0.01, 0.025, 0.38, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0.07, 0.45, 0.06, 0, -5000] });

export const recipes = [
  { id: 'step-metal-a', layers: [noise(0.085, 0.23, -2300), tone(91, 0.11, 0.24), tone(670, 0.09, 0.055)] },
  { id: 'step-metal-b', layers: [noise(0.073, 0.20, -2100), tone(107, 0.12, 0.22), tone(740, 0.08, 0.05)] },
  { id: 'step-stone-a', layers: [noise(0.09, 0.14, -1800), tone(125, 0.085, 0.15)] },
  { id: 'step-stone-b', layers: [noise(0.10, 0.13, -1600), tone(139, 0.08, 0.15)] },
  { id: 'jump', layers: [noise(0.18, 0.14, -1700), tone(160, 0.12, 0.1)] },
  { id: 'land-soft', layers: [noise(0.19, 0.21, -1800), tone(76, 0.20, 0.20)] },
  { id: 'land-hard', layers: [noise(0.32, 0.32, -1900), tone(54, 0.36, 0.36), tone(114, 0.20, 0.16)] },
  { id: 'lane-whoosh', layers: [noise(0.15, 0.16, -2400)] },
  { id: 'slide', layers: [noise(0.72, 0.25, -1600), tone(91, 0.26, 0.09)] },
  { id: 'air-dive', layers: [noise(0.45, 0.18, -2800)] },
  { id: 'glider-open', layers: [noise(0.32, 0.24, -2400), tone(210, 0.18, 0.08)] },
  { id: 'rebound', layers: [{ at: 0, gain: 0.28, params: [1, 0, 100, 0.003, 0.02, 0.26, 1, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, -2400] }, noise(0.13, 0.14, -1800)] },
  { id: 'perfect-rebound', layers: [chime(523.25, 0, 0.2), chime(783.99, 0.07, 0.2), noise(0.16, 0.15, -1800)] },
  { id: 'collect', layers: [chime(659.25, 0, 0.22), chime(987.77, 0.055, 0.14)] },
  { id: 'checkpoint', layers: [chime(392, 0, 0.20), chime(523.25, 0.11, 0.20), chime(783.99, 0.23, 0.18)] },
  { id: 'press-warning', layers: [{ ...tone(740, 0.09, 0.13), at: 0 }, { ...tone(740, 0.09, 0.13), at: 0.2 }] },
  { id: 'press-impact', layers: [tone(47, 0.55, 0.35), tone(130, 0.31, 0.2), noise(0.43, 0.38, -2100)] },
  { id: 'hit', layers: [noise(0.28, 0.25, -1900), tone(65, 0.32, 0.30)] },
  { id: 'recover', layers: [chime(329.63, 0, 0.18), chime(493.88, 0.12, 0.16), noise(0.25, 0.12, -1800)] },
  { id: 'finish', layers: [chime(392, 0, 0.20), chime(523.25, 0.12, 0.2), chime(659.25, 0.24, 0.2), chime(783.99, 0.36, 0.22)] },
  { id: 'ui-confirm', layers: [chime(440, 0, 0.10)] },
  { id: 'hell-room', loop: true, layers: [{ at: 0, gain: 0.14, params: [1, 0, 55, 0.7, 6, 0.7, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, -650] }, { at: 0, gain: 0.09, params: [1, 0, 85, 0.7, 6, 0.7, 4, 1, 0, 0, 0, 0, 0, 0.4, 0, 0, 0, 1, 0, 0, -650] }] },
  { id: 'heaven-air', loop: true, layers: [{ at: 0, gain: 0.13, params: [1, 0, 170, 1, 6, 1, 4, 1, 0, 0, 0, 0, 0, 0.7, 0, 0, 0, 1, 0, 0, -1300] }] },
  { id: 'flight-air', loop: true, layers: [{ at: 0, gain: 0.12, params: [1, 0, 240, 0.5, 4, 0.5, 4, 1, 0, 0, 0, 0, 0, 0.8, 0, 0, 0, 1, 0, 0, -2400] }] },
];
