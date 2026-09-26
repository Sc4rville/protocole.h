import io
import json
import os
import urllib.parse
import wave
from playwright.sync_api import sync_playwright

BASE = os.environ.get('DIALOGUE_URL', 'http://127.0.0.1:8776/dialogue/')
SHOT = '/tmp/protocole-dialogue-lab.png'

T = 'document.getElementById("player")'

results = []
def check(name, ok, extra=''):
    results.append((name, bool(ok), extra))
    print(('PASS' if ok else 'FAIL'), name, extra)


def wav_bytes(seconds=2.0, freq=440.0):
    import math
    import struct
    buf = io.BytesIO()
    w = wave.open(buf, 'wb')
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(8000)
    frames = b''.join(
        struct.pack('<h', int(12000 * math.sin(2 * math.pi * freq * i / 8000)))
        for i in range(int(8000 * seconds)))
    w.writeframes(frames)
    w.close()
    return buf.getvalue()


with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    console_errors, page_errors, responses = [], [], []
    page.on('console', lambda m: console_errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: page_errors.append(str(e)))
    page.on('response', lambda r: responses.append((r.url, r.status)))

    page.goto(BASE, wait_until='networkidle')
    page.wait_for_function('document.querySelectorAll(".card").length > 0', timeout=15000)

    n = page.evaluate('document.querySelectorAll(".card").length')
    check('60 cards', n == 60, f'{n}')
    check('subtitle totals', '60' in page.evaluate('document.getElementById("subtitle").textContent')
          and '0' in page.evaluate('document.getElementById("subtitle").textContent'))
    check('voice-status empty', page.evaluate('document.getElementById("voice-status").textContent')
          == 'No voices generated yet.')
    check('all Listen disabled', page.evaluate(
        '[...document.querySelectorAll(".card button")].every(b => b.disabled)'))
    check('no audio src / autoplay',
          page.evaluate(f'!{T}.src && !{T}.autoplay && {T}.paused'))
    check('volume .25', abs(page.evaluate(f'{T}.volume') - 0.25) < 1e-6)

    check('every card shows line text + notes', page.evaluate(
        '[...document.querySelectorAll(".card")].every(c => '
        'c.querySelector(".line-text").textContent.trim().length > 0 && '
        'c.querySelector("details").textContent.trim().length > 20)'))

    page.locator('#audition').click()
    check('audition filter 6', page.evaluate('document.querySelectorAll(".card").length') == 6)
    page.locator('#audition').click()

    page.select_option('#speaker', 'system')
    check('speaker system 5', page.evaluate('document.querySelectorAll(".card").length') == 5)
    page.select_option('#speaker', '')

    page.select_option('#group', 'probe')
    check('group probe 13', page.evaluate('document.querySelectorAll(".card").length') == 13)
    page.select_option('#group', '')

    page.fill('#search', 'h_arrival')
    check('search exact 1', page.evaluate('document.querySelectorAll(".card").length') == 1)

    page.fill('#search', '')
    check('reset restores 60', page.evaluate('document.querySelectorAll(".card").length') == 60)

    # Fixture playback: generated.json + two wav clips routed in-memory.
    manifest = json.loads(page.evaluate('fetch("manifest.json").then(r => r.text())'))
    poison = dict(manifest)
    poison['lines'] = [dict(l) for l in manifest['lines']]
    poison['lines'][0]['text'] = '<img src=x onerror="window.__xss=1"> not markup'
    generated = {'version': 1, 'clips': {
        'h_arrival': {'files': {'wav': 'clips/h_arrival.wav'}},
        'h_probe_warning': {'files': {'wav': 'clips/h_probe_warning.wav',
                                      'fake': 'https://evil.example/x.wav'}},
        # Malformed paths in real codec fields: every one must be rejected.
        'h_charge_restored': {'files': {'ogg': 'https://evil.example/x.ogg',
                                        'mp3': '//evil.example/x.mp3',
                                        'wav': 'clips/../../index.html'}},
        'h_probe_select_again': {'files': {'ogg': 'clips\\x.ogg',
                                           'mp3': 'clips/%2e%2e/x.mp3',
                                           'wav': '/dialogue/clips/x.wav'}},
        'h_restraint_damage': {'files': {'ogg': 'data:audio/ogg;base64,AAAA',
                                         'mp3': 'clips/x.mp3?x=1',
                                         'wav': 'clips/./x.wav'}},
        'h_end_hurt': {'files': {'ogg': 'other/x.ogg', 'mp3': 'clips/x.flac', 'wav': 42}},
        'unknown_cue_not_in_manifest': {'files': {'wav': 'clips/ghost.wav'}},
    }}
    wav = wav_bytes()

    def route_manifest(route):
        route.fulfill(body=json.dumps(poison), content_type='application/json')

    def route_generated(route):
        route.fulfill(body=json.dumps(generated), content_type='application/json')

    def route_clip(route):
        route.fulfill(body=wav, content_type='audio/wav')

    page.route('**/dialogue/manifest.json', route_manifest)
    page.route('**/dialogue/generated.json', route_generated)
    page.route('**/dialogue/clips/*.wav', route_clip)

    page.goto(BASE, wait_until='networkidle')
    page.wait_for_function('document.querySelectorAll(".card").length > 0', timeout=15000)

    check('xss fixture stays text',
          page.evaluate('window.__xss === undefined') and
          page.evaluate('document.querySelector(".card .line-text").textContent')
          .startswith('<img'),)
    n_listen = page.evaluate('[...document.querySelectorAll(".card button")]'
                             '.filter(b => !b.disabled).length')
    check('2 clips playable', n_listen == 2, f'{n_listen}')
    check('malformed paths keep Listen disabled', page.evaluate(
        '["h_charge_restored","h_probe_select_again","h_restraint_damage","h_end_hurt"]'
        '.every(id => document.querySelector(`.card[data-id="${id}"] button`).disabled)'))
    check('genCount counts only playable known cues',
          '2 générées' in page.evaluate('document.getElementById("subtitle").textContent'))
    check('voice-status generated', page.evaluate('document.getElementById("voice-status").textContent')
          == 'Generated takes require listening and performance review.')

    first = page.locator('.card[data-id="h_arrival"]')
    first.locator('button').click()
    try:
        page.wait_for_function(f'!{T}.paused && {T}.currentTime > 0.2', timeout=5000)
        progressed = True
    except Exception:
        progressed = False
    check('clip plays (currentTime progresses)', progressed,
          f'currentTime={page.evaluate(f"{T}.currentTime")}')
    cur = page.evaluate('document.getElementById("now-playing").textContent')
    check('now-playing label', cur == 'h_arrival', cur)

    page.locator('#stop').click()
    check('stop pauses+resets',
          page.evaluate(f'{T}.paused') and page.evaluate(f'{T}.currentTime') == 0)

    page.locator('.card[data-id="h_probe_warning"] button').click()
    page.wait_for_timeout(150)
    first.locator('button').click()
    page.wait_for_timeout(400)
    cur = page.evaluate('document.getElementById("now-playing").textContent')
    check('rapid switch no stale error', cur == 'h_arrival', cur)
    src = page.evaluate(f'{T}.currentSrc || {T}.src')
    check('player src stays local clips path', src.endswith('/dialogue/clips/h_arrival.wav'), src)

    bad = [(u, s) for u, s in responses if s >= 400]
    check('no failed local requests', not bad, str(bad))
    external = [u for u, s in responses
                if urllib.parse.urlparse(u).hostname not in ('127.0.0.1', 'localhost')]
    check('no external requests', not external, str(external))
    check('no page errors', not page_errors, str(page_errors[:3]))
    check('no console errors', not console_errors, str(console_errors[:3]))

    page.unroute('**/dialogue/manifest.json')
    page.unroute('**/dialogue/generated.json')
    page.unroute('**/dialogue/clips/*.wav')

    # generated.json 500 -> visible error, no card pretends nothing was generated.
    page.route('**/dialogue/generated.json',
               lambda route: route.fulfill(status=500, body='boom', content_type='text/plain'))
    page.goto(BASE, wait_until='networkidle')
    page.wait_for_function('document.getElementById("state").classList.contains("err")', timeout=15000)
    state_txt = page.evaluate('document.getElementById("state").textContent')
    check('generated 500 visible error', 'HTTP 500' in state_txt
          and page.evaluate('document.querySelectorAll(".card").length') == 0, state_txt)
    check('generated 500 does not echo body', 'boom' not in state_txt)
    page.unroute('**/dialogue/generated.json')

    # generated.json malformed JSON -> visible error.
    page.route('**/dialogue/generated.json',
               lambda route: route.fulfill(status=200, body='{not json', content_type='application/json'))
    page.goto(BASE, wait_until='networkidle')
    page.wait_for_function('document.getElementById("state").classList.contains("err")', timeout=15000)
    check('generated malformed JSON visible error',
          page.evaluate('document.querySelectorAll(".card").length') == 0
          and page.evaluate('document.getElementById("state").hidden') is False)
    page.unroute('**/dialogue/generated.json')

    # generated.json 404 -> tolerated as empty.
    page.route('**/dialogue/generated.json',
               lambda route: route.fulfill(status=404, body='', content_type='text/plain'))
    page.goto(BASE, wait_until='networkidle')
    page.wait_for_function('document.querySelectorAll(".card").length > 0', timeout=15000)
    check('generated 404 tolerated as empty',
          page.evaluate('document.querySelectorAll(".card").length') == 60
          and page.evaluate('[...document.querySelectorAll(".card button")].every(b => b.disabled)'))
    page.unroute('**/dialogue/generated.json')

    # Filters used before the manifest resolves must not throw.
    pre_errors = len(page_errors)
    manifest_holder = []

    def route_slow_manifest(route):
        manifest_holder.append(route)

    page.route('**/dialogue/manifest.json', route_slow_manifest)
    page.goto(BASE, wait_until='domcontentloaded')
    page.wait_for_function('!!document.getElementById("search")')
    page.fill('#search', 'probe')
    page.select_option('#speaker', 'system')
    page.locator('#audition').click()
    page.wait_for_timeout(300)
    check('filters before manifest: no page errors', len(page_errors) == pre_errors,
          str(page_errors[pre_errors:pre_errors + 3]))
    for route in manifest_holder:
        route.continue_()
    page.wait_for_function('!document.getElementById("subtitle").textContent.startsWith("Chargement")',
                           timeout=15000)
    page.unroute('**/dialogue/manifest.json')
    # Filters set before the fetch resolved are applied by the deferred render.
    aud_pressed = page.evaluate('document.getElementById("audition").getAttribute("aria-pressed")')
    n_after = page.evaluate('document.querySelectorAll(".card").length')
    check('filters before manifest: applied after resolve',
          aud_pressed == 'true' and n_after == 0, f'pressed={aud_pressed} cards={n_after}')

    external = [u for u, s in responses
                if urllib.parse.urlparse(u).hostname not in ('127.0.0.1', 'localhost')]
    check('no external requests (all scenarios)', not external, str(external))
    check('no page errors (all scenarios)', not page_errors, str(page_errors[:3]))

    # Screenshot the REAL lab (no routes active), not a fixture.
    page.goto(BASE, wait_until='networkidle')
    page.wait_for_function('document.querySelectorAll(".card").length === 60', timeout=15000)
    check('real lab restored before screenshot',
          page.evaluate('[...document.querySelectorAll(".card button")].every(b => b.disabled)')
          and page.evaluate('document.getElementById("voice-status").textContent') == 'No voices generated yet.')
    page.screenshot(path=SHOT, full_page=False)
    browser.close()

fails = [n for n, ok, _ in results if not ok]
print(f'\n{len(results) - len(fails)}/{len(results)} passed')
raise SystemExit(1 if fails else 0)
