---
name: lobby-runtime-testing
description: Browser runtime verification of the static Three.js lobby scene, including collisions, pause, lighting, and visual evidence.
---

# Lobby runtime testing

## Setup
- From the repository root, serve `public` with `python3 -m http.server 8768 --directory public`; check for an existing listener first.
- Open `http://127.0.0.1:8768/lobby-test/?test=1` in maximized Chrome.
- No build or login is needed for this static scene.
- The repository environment blueprint installs Python Playwright and Chromium.

## Reliable interaction and evidence
- Click the visible entry button to start and to resume after Escape or blur.
  Do not assume Enter resumes. Check current UI/source for keyboard controls.
- Proximity wakes repos into éveil and then intervention. Jugement is selected
  manually with 3 or L, not the expected end of an automatic proximity sequence.
- Under pointer lock, Ctrl+L may reach the scene as KeyL instead of opening the
  browser address bar. Test blur by switching to an actual second application.
  On Linux, `dolphin /tmp` followed by `wmctrl -a Dolphin` provides a deterministic
  target if only Chrome was open. Return to Chrome and explicitly click resume.
- Record the GUI. Use the test hook only for initial positioning/diagnostics;
  send actual movement keys to verify collisions and sliding.
- Read `window.__lobbyTest.getState()` and `.levels()` to assert state and lighting.
  Save cue text, pose, state, and levels immediately after pausing and again after
  at least eight seconds. Verify that the button resumes the remaining sequence.
- Software-rendered WebGL can be much slower than real time, while scene dt is
  clamped. Await state transitions with generous timeouts rather than assuming
  wall-clock completion at the sequence's nominal duration. Report this limitation
  separately from application failures; refresh-rate equivalence needs its own run.
- Inspect all texture responses and decoded dimensions. Capture screenshots of
  every state and close-up views of tools, station/cable, grate, and framed door.
- Sample positions throughout diagonal movement, not just endpoints, to detect
  tunnelling through a circular obstacle.
- Collect console/page errors and request failures from before initial navigation.
  Assign screenshot return values to `_` in a Python REPL to avoid printing PNG
  byte arrays into evidence logs.

## Devin Secrets Needed
None for local static-scene testing.
