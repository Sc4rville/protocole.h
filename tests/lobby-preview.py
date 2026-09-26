import os
import urllib.parse
from playwright.sync_api import sync_playwright

BASE = os.environ.get('LOBBY_TEST_URL', 'http://127.0.0.1:8768/lobby-test/?test=1')
SHOT = '/tmp/protocole-lobby-test.png'
SHOT_ALERT = '/tmp/protocole-lobby-test-alert.png'

T = 'document.getElementById("telemetry").dataset'

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
    page.on('request', lambda r: requests.append(r.url))
    page.on('response', lambda r: responses.append((r.url, r.status)))

    page.goto(BASE, wait_until='networkidle')
    page.wait_for_function(f'{T}.loaded === "true"', timeout=30000)

    check('one canvas', page.evaluate('document.querySelectorAll("canvas").length') == 1)
    bad = [(u, s) for u, s in responses if s >= 400]
    check('no failed local requests', not bad, str(bad))
    external = [u for u in requests
                if urllib.parse.urlparse(u).hostname not in ('127.0.0.1', 'localhost')]
    check('no external requests', not external, str(external))
    check('room loaded', page.evaluate(f'{T}.loaded') == 'true')

    page.locator('#enter').click()
    page.wait_for_timeout(400)
    check('entered', page.evaluate(f'{T}.entered') == 'true')
    check('overlay hidden', page.evaluate('document.getElementById("overlay").hidden') is True)
    pointer_locked = page.evaluate('document.pointerLockElement !== null')
    page.screenshot(path=SHOT)

    z0 = float(page.evaluate(f'{T}.z'))
    page.keyboard.down('w')
    page.wait_for_timeout(500)
    page.keyboard.up('w')
    z1 = float(page.evaluate(f'{T}.z'))
    check('forward moves -z', z1 < z0, f'z {z0} -> {z1} (pointerLock={pointer_locked})')

    m0 = page.evaluate(f'{T}.mode')
    page.keyboard.press('l')
    page.wait_for_timeout(500)
    m1 = page.evaluate(f'{T}.mode')
    check('L toggles lighting', m0 != m1, f'{m0} -> {m1}')
    page.screenshot(path=SHOT_ALERT)

    page.keyboard.press('Escape')
    page.wait_for_timeout(200)
    check('Escape pauses', page.evaluate(f'{T}.entered') == 'false')

    page.keyboard.down('w')
    page.wait_for_timeout(300)
    page.keyboard.up('w')
    z2 = float(page.evaluate(f'{T}.z'))
    check('no motion while paused', abs(z2 - z1) < 1e-6, f'z {z1} -> {z2}')

    page.locator('#enter').click()
    page.wait_for_timeout(300)
    check('enter resumes', page.evaluate(f'{T}.entered') == 'true')

    page.keyboard.down('w')
    page.wait_for_timeout(150)
    page.evaluate('window.dispatchEvent(new Event("blur"))')
    page.wait_for_timeout(100)
    z3 = float(page.evaluate(f'{T}.z'))
    page.wait_for_timeout(400)
    z4 = float(page.evaluate(f'{T}.z'))
    page.keyboard.up('w')
    check('blur pauses, no motion', abs(z4 - z3) < 1e-6 and
          page.evaluate(f'{T}.entered') == 'false', f'z {z3} -> {z4} while W held')

    check('no page errors', not page_errors, str(page_errors[:3]))
    check('no console errors', not console_errors, str(console_errors[:3]))

    browser.close()

fails = [n for n, ok, _ in results if not ok]
print(f'\n{len(results) - len(fails)}/{len(results)} passed')
raise SystemExit(1 if fails else 0)
