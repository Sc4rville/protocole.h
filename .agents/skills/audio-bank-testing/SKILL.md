---
name: audio-bank-browser-testing
description: Run the static protocole.h audio bank and verify playback, filters, and attribution safely.
---

# Audio bank browser testing

## Setup
- From the repository root, run `python3 -m http.server 8768 -d public`.
- Open `http://127.0.0.1:8768/audio/index.html`; no Node build or backend is required.
- Blueprint already installs Python Playwright and Chromium. The existing
  `tests/audio-bank-preview.py` accepts `AUDIO_BANK_URL`.
- Before playing aggressive sounds, lower actual system output when available.
  Some remote environments have no audio server/device; report subjective listening
  as untested rather than equating a media clock with audible sound quality.

## Runtime checks
- Capture console/page errors and network responses before navigation, including
  the HTTP server log: browser instrumentation can omit incidental favicon requests.
- Make playback/filter changes through the UI. Passive media-event logging can
  verify duration, successive advancing currentTime values, and looping wraps.
- The bank uses one persistent `#player`, `#now-playing`, `#category`, `#search`,
  `#loop`, `#volume`, and `#stop`; cards have `data-id` and `data-category`.
- Switching sound clears test-loop state; Stop pauses and resets the time.
- Native volume controls can use finer precision than the custom slider's 0.01
  step. Report any rounding separately from a genuinely disconnected control.
- Chrome generally selects OGG. Do not claim MP3 fallback coverage without
  actually exercising a browser/codec path that chooses MP3.
- `Crédits et licences` points to `licenses/SOURCES.txt`. Plain Python HTTP
  serving may omit a UTF-8 charset for text files; inspect accented text in-browser.

## Devin Secrets Needed
None.
