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


def wav_bytes(seconds=0.3, freq=440.0):
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

    first = page.locator('.card[data-id="h_arrival"]')
    first.locator('button').click()
    page.wait_for_timeout(400)
    check('clip plays', page.evaluate(f'!{T}.paused'))
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
    page.screenshot(path=SHOT)
    browser.close()

fails = [n for n, ok, _ in results if not ok]
print(f'\n{len(results) - len(fails)}/{len(results)} passed')
raise SystemExit(1 if fails else 0)
