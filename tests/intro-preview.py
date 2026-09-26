import os
import urllib.parse
from playwright.sync_api import sync_playwright

BASE = os.environ.get('INTRO_URL', 'http://127.0.0.1:8768/intro/?test=1&speed=12')
SHOT_PROLOGUE = '/tmp/protocole-intro-prologue.png'
SHOT_BRIEFING = '/tmp/protocole-intro-briefing.png'

T = 'document.getElementById("telemetry").dataset'

results = []
def check(name, ok, extra=''):
    results.append((name, bool(ok), extra))
    print(('PASS' if ok else 'FAIL'), name, extra)

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    console_errors, page_errors, requests, responses = [], [], [], []
    # The optional theme song is probed with fetch; its 404 is expected until the file lands.
    page.on('console', lambda m: console_errors.append(m.text) if m.type == 'error' and '404' not in m.text else None)
    page.on('pageerror', lambda e: page_errors.append(str(e)))
    page.on('request', lambda r: requests.append(r.url))
    page.on('response', lambda r: responses.append((r.url, r.status)))

    page.goto(BASE, wait_until='networkidle')
    page.wait_for_function(f'{T}.loaded !== undefined', timeout=30000)
    check('sound bank loaded', page.evaluate(f'{T}.loaded') == 'true')
    check('all samples decoded', page.evaluate(f'{T}.samples') == '12', page.evaluate(f'{T}.samples'))
    bad = [(u, s) for u, s in responses if s >= 400 and '/intro/theme/' not in u]
    theme_probe = [(u, s) for u, s in responses if s >= 400 and '/intro/theme/' in u]
    check('only theme-song probes may 404', all('theme-song.' in u for u, _ in theme_probe), str(theme_probe))
    check('no failed local requests', not bad, str(bad))
    external = [u for u in requests if urllib.parse.urlparse(u).hostname not in ('127.0.0.1', 'localhost')]
    check('no external requests', not external, str(external))

    page.locator('#start').click()
    page.wait_for_function(f'{T}.phase === "prologue"', timeout=5000)
    page.wait_for_function(f'{T}.lastLine !== undefined', timeout=5000)
    page.screenshot(path=SHOT_PROLOGUE)
    page.wait_for_function(f'{T}.cut === "true"', timeout=15000)
    check('hard cut reached', True)
    page.wait_for_function(f'{T}.phase === "briefing"', timeout=20000)
    check('briefing reached', True)
    check('body white', page.evaluate('document.body.classList.contains("phase-briefing")'))
    page.wait_for_function(f'{T}.ready === "true"', timeout=20000)
    check('theme layer started', page.evaluate(f'{T}.themePlaying') in ('file', 'placeholder'), page.evaluate(f'{T}.themePlaying'))
    check('begin button visible', page.locator('#begin').is_visible())
    page.screenshot(path=SHOT_BRIEFING)
    page.locator('#begin').click()
    page.wait_for_function(f'{T}.leaving === "true"', timeout=5000)
    check('begin triggers exit', True)

    # Skip path
    page.goto(BASE, wait_until='networkidle')
    page.wait_for_function(f'{T}.loaded !== undefined', timeout=30000)
    page.locator('#start').click()
    page.wait_for_function(f'{T}.phase === "prologue"', timeout=5000)
    page.keyboard.press('Escape')
    page.wait_for_function(f'{T}.phase === "briefing"', timeout=5000)
    check('escape skips prologue', True)

    check('no console errors', not console_errors, str(console_errors))
    check('no page errors', not page_errors, str(page_errors))
    browser.close()

failed = [r for r in results if not r[1]]
print(f'{len(results) - len(failed)}/{len(results)} passed')
raise SystemExit(1 if failed else 0)
