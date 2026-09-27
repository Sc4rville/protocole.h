// Text, bars, flashes and subtitles as a pure function of trailer time, so
// the offline renderer and the live player draw exactly the same frame.
import { sampleTrack } from './camera.js';

const FADE_IN = 0.55;
const FADE_OUT = 0.45;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

function fade(t, at, until, fin = FADE_IN, fout = FADE_OUT) {
  if (t < at || t >= until) return 0;
  return Math.min(clamp01((t - at) / fin), clamp01((until - t) / fout));
}

export function createOverlay(root, timeline, voiceText) {
  const cardsEl = root.querySelector('#cards');
  const blackEl = root.querySelector('#black');
  const flashEl = root.querySelector('#flash');
  const subEl = root.querySelector('#subtitle');
  const barTop = root.querySelector('#bar-top');
  const barBottom = root.querySelector('#bar-bottom');
  const grainEl = root.querySelector('#grain');
  const hudEl = root.querySelector('#hud');
  const hudTime = root.querySelector('#hud-time');

  const cardNodes = timeline.CARDS.map((card) => {
    const el = document.createElement('div');
    el.className = `card card-${card.style}` + (card.tone ? ` tone-${card.tone}` : '');
    if (card.style === 'title') {
      el.innerHTML = 'protocole<span class="dot">.</span><span class="h">h</span>';
    } else {
      el.textContent = card.text;
    }
    el.style.opacity = '0';
    cardsEl.appendChild(el);
    return el;
  });

  function update(t) {
    // hard blacks
    let black = 0;
    for (const b of timeline.BLACKS) {
      if (t >= b.from && t < b.to) black = 1;
    }
    blackEl.style.opacity = String(black);

    // flashes
    let flash = 0;
    let flashColor = '#ffffff';
    for (const f of timeline.FLASHES) {
      if (t >= f.at && t < f.at + f.dur) {
        flash = Math.max(flash, 1 - (t - f.at) / f.dur);
        flashColor = f.color || '#ffffff';
      }
    }
    flashEl.style.opacity = String(flash);
    flashEl.style.background = flashColor;

    // cards
    timeline.CARDS.forEach((card, i) => {
      const el = cardNodes[i];
      let a;
      if (card.fadeIn || card.fadeOut) a = fade(t, card.at, card.until, card.fadeIn || FADE_IN, card.fadeOut || FADE_OUT);
      else if (card.style === 'word') a = fade(t, card.at, card.until, 0.08, 0.2);
      else if (card.style === 'hud') a = t >= card.at && t < card.until ? (Math.sin(t * 40) > -0.6 ? 1 : 0.3) : 0;
      else if (card.style === 'title') a = fade(t, card.at, card.until, 1.6, 0.6);
      else if (card.style === 'statement') a = fade(t, card.at, card.until, 0.25, 0.25);
      else a = fade(t, card.at, card.until);
      el.style.opacity = String(a);
      if (a > 0) {
        const life = clamp01((t - card.at) / Math.max(0.5, card.until - card.at));
        if (card.style === 'quote' || card.style === 'stress' || card.style === 'tagline') {
          el.style.letterSpacing = `${0.02 + life * 0.03}em`;
          // keep the CSS centring (-50%, -50%) under the drift
          el.style.transform = `translate(-50%, calc(-50% + ${(1 - a) * 6}px))`;
        } else if (card.style === 'word') {
          el.style.transform = `translate(-50%, -50%) scale(${1 + life * 0.06})`;
        } else if (card.style === 'title') {
          el.style.letterSpacing = `${0.34 + life * 0.05}em`;
        }
      }
    });

    // subtitles for voice lines
    let line = null;
    for (const v of timeline.VOICE) {
      const info = voiceText[v.id];
      if (!info || v.sub === false) continue;
      const until = v.at + info.duration + 0.35;
      if (t >= v.at && t < until) line = { text: info.text, speaker: info.speaker, a: fade(t, v.at, until, 0.15, 0.3) };
    }
    if (line) {
      subEl.textContent = line.text;
      subEl.className = `speaker-${line.speaker}`;
      subEl.style.opacity = String(line.a);
    } else {
      subEl.style.opacity = '0';
    }

    // letterbox
    const bars = sampleTrack(timeline.TRACKS.bars, t);
    const h = `${bars * 12}%`;
    barTop.style.height = h;
    barBottom.style.height = h;

    // grain: deterministic offset from time
    const gx = Math.floor((t * 24) % 7) * 13;
    const gy = Math.floor((t * 24) % 5) * 17;
    grainEl.style.transform = `translate(${gx}px, ${gy}px)`;

    // hud (timecode + phase) only in the shots that ask for it
    const hud = (timeline.HUD || []).some((w) => t >= w.from && t < w.to);
    hudEl.style.opacity = hud ? '1' : '0';
    if (hud) {
      const s = Math.floor(t);
      const f = Math.floor((t - s) * 24);
      hudTime.textContent = `REC ${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
    }
  }

  return { update };
}
