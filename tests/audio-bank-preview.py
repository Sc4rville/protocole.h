import os
import urllib.parse
from playwright.sync_api import sync_playwright

BASE = os.environ.get('AUDIO_BANK_URL', 'http://127.0.0.1:8768/audio/index.html')
SHOT = '/tmp/protocole-audio-bank.png'

results = []
def check(name, ok, extra=''):
    results.append((name, bool(ok), extra))
    print(('PASS' if ok else 'FAIL'), name, extra)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    console_errors = []
    page_errors = []
    responses = []
    requests = []
    page.on('console', lambda m: console_errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: page_errors.append(str(e)))
    page.on('response', lambda r: responses.append((r.url, r.status)))
    page.on('request', lambda r: requests.append(r.url))

    page.goto(BASE, wait_until='networkidle')
    page.wait_for_function('document.querySelectorAll(".card").length > 0', timeout=15000)

    n = page.evaluate('document.querySelectorAll(".card").length')
    check('30 cards', n == 30, f'{n}')
    check('subtitle', page.evaluate('document.getElementById("subtitle").textContent')
          .startswith('30 candidats CC0'))

    page.select_option('#category', 'ui')
    n_ui = page.evaluate('document.querySelectorAll(".card").length')
    check('category filter ui', n_ui == 6, f'{n_ui}')
    page.select_option('#category', '')
    page.fill('#search', 'probe_charge')
    check('text search', page.evaluate('document.querySelectorAll(".card").length') == 1)
    page.fill('#search', '')

    check('no autoplay', page.evaluate('document.getElementById("player").paused') is True)
    check('volume .25', abs(page.evaluate('document.getElementById("player").volume') - 0.25) < 1e-6)

    first = page.locator('.card').first
    first_id = first.get_attribute('data-id')
    first.locator('button').click()
    page.wait_for_function('!isNaN(document.getElementById("player").duration) && '
                           'document.getElementById("player").duration > 0', timeout=15000)
    src = page.evaluate('document.getElementById("player").src')
    check('source set + duration>0', '.ogg' in src or '.mp3' in src, src)

    page.locator('#loop').check()
    check('loop sets player.loop', page.evaluate('document.getElementById("player").loop') is True)

    second_id = page.locator('.card').nth(1).get_attribute('data-id')
    third_id = page.locator('.card').nth(2).get_attribute('data-id')
    page.locator('.card').nth(1).locator('button').click()
    page.locator('.card').nth(2).locator('button').click()
    page.wait_for_timeout(400)
    check('single audio element', page.evaluate('document.querySelectorAll("audio").length') == 1)
    cur = page.evaluate('document.getElementById("now-playing").textContent')
    check('rapid switch settles on final id', cur == third_id, cur)
    check('loop reset on switch', page.evaluate('document.getElementById("loop").checked') is False
          and page.evaluate('document.getElementById("player").loop') is False)

    page.evaluate('document.getElementById("player").volume = 0.4')
    check('native volume syncs slider',
          abs(float(page.evaluate('document.getElementById("volume").value')) - 0.4) < 1e-6)

    page.locator('#stop').click()
    check('stop pauses+resets', page.evaluate('document.getElementById("player").paused') is True
          and page.evaluate('document.getElementById("player").currentTime') == 0)

    bad = [(u, s) for u, s in responses if s >= 400]
    check('HTTP assets 200', not bad, str(bad))
    external = [u for u in requests
                if urllib.parse.urlparse(u).hostname not in ('127.0.0.1', 'localhost')]
    check('no external requests', not external, str(external))
    check('no page errors', not page_errors, str(page_errors[:3]))
    check('no console errors', not console_errors, str(console_errors[:3]))

    page.screenshot(path=SHOT, full_page=False)
    browser.close()

fails = [n for n, ok, _ in results if not ok]
print(f'\n{len(results) - len(fails)}/{len(results)} passed')
raise SystemExit(1 if fails else 0)
