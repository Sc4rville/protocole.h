---
name: audio-bank-browser-testing
description: Run the static protocole.h audio and dialogue banks and verify playback, filters, and safe fixture handling.
---

# Audio bank browser testing

## Setup
- From the repository root, run `python3 -m http.server 8768 --bind 127.0.0.1 --directory public`.
- Open `http://127.0.0.1:8768/audio/index.html`; no Node build or backend is required.
- Blueprint installs Python Playwright and Chromium. The existing
  `tests/audio-bank-preview.py` accepts `AUDIO_BANK_URL`.
- Before playing aggressive sounds, lower actual system output when available.
  Some remote environments have no audio server/device; report subjective listening
  as untested rather than equating a media clock with audible sound quality.

## Runtime checks
- Capture console/page errors and network requests before navigation, including
  the HTTP server log: browser instrumentation can omit incidental favicon requests.
- Make playback/filter changes through the UI. Passive media-event logging can
  verify duration, successive advancing currentTime values, and looping wraps.
- The audio bank uses one persistent `#player`, `#now-playing`, `#category`, `#search`,
  `#loop`, `#volume`, and `#stop`; cards have `data-id` and `data-category`.
- Switching sound clears test-loop state; Stop pauses and resets the time.
- Native volume controls can use finer precision than the custom slider's 0.01
  step. Report rounding separately from a genuinely disconnected control.
- Chrome generally selects OGG. Do not claim MP3 fallback coverage without
  exercising a browser/codec path that chooses MP3.
- `Crédits et licences` points to `licenses/SOURCES.txt`. Plain Python HTTP
  serving may omit a UTF-8 charset for text files; inspect accented text in-browser.

## Dialogue lab variant
- Serve only `public/`, bound to loopback; `/dialogue/` requires no login,
  Node build, external provider, or API keys. Reuse an existing server if available.
- `tests/dialogue-bank-preview.py` accepts `DIALOGUE_URL`. An existing
  `~/pw-venv/bin/python` may supply Playwright when system Python does not.
- Never run paid generation to test UI wiring. Route `generated.json` and
  synthetic WAV bytes in memory. Do not overwrite tracked manifests or clips.
- Abort and log all non-127.0.0.1 browser requests before navigation; log
  request attempts, not only responses, to detect failed external attempts.
- Real empty data should show 60 cards, 55 unit_h and five system; audition
  selects six. Fixtures must be labeled synthetic and prove wiring, not acting quality.
- Put malformed paths in real codec fields and include an unknown cue ID.
  Count only valid paths belonging to known cues, not raw index entries.
- For malformed JSON, use a unique sentinel at the start of the body and assert
  neither it nor a prefix is visible. Browser JSON parse errors may quote body
  snippets, so checking only the complete sentinel misses disclosure.
- Hold the manifest route, operate filters, then release it. Assert no page
  exceptions and that the pre-load filter choices apply after resolution.
- Reset routes and verify the real empty state before capturing real-data evidence.

## Devin Secrets Needed
None for browser wiring or synthetic fixtures. Do not read provider keys or env files.
