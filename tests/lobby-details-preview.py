import os
import urllib.parse
from playwright.sync_api import sync_playwright

BASE = os.environ.get('LOBBY_TEST_URL', 'http://127.0.0.1:8772/lobby-test/?test=1')
SHOT = '/tmp/protocole-integrated-cell.png'

results = []
def check(name, ok, extra=''):
    results.append((name, bool(ok), extra))
    print(('PASS' if ok else 'FAIL'), name, extra)

D = 'window.__lobbyTest.debug'

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    console_errors = []
    page_errors = []
    responses = []
    page.on('console', lambda m: console_errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: page_errors.append(str(e)))
    page.on('response', lambda r: responses.append((r.url, r.status)))

    page.goto(BASE, wait_until='networkidle')
    page.wait_for_function(f'{D}.mats.wall.map.image && {D}.mats.floor.map.image && '
                           f'{D}.mats.ceiling.map.image', timeout=30000)

    for name, size in [('wall', 1024), ('ceiling', 1024), ('floor', 512)]:
        ok = page.evaluate(
            f'{D}.mats.{name}.map.image instanceof HTMLCanvasElement && '
            f'{D}.mats.{name}.map.image.width === {size}')
        check(f'{name} composite canvas {size}', ok)

    tex200 = {u for u, s in responses if '/lobby-test/assets/textures/' in u and s == 200}
    check('texture requests 200',
          all(any(f in u for u in tex200)
              for f in ('mur-cellule.jpg', 'sol-cellule.jpg', 'metal-sombre.jpg')),
          str(tex200))

    check('props in debug', page.evaluate(f'!!{D}.props && !!{D}.details'))
    check('details nonempty', page.evaluate(f'Object.keys({D}.details).length > 0'))

    page.locator('#enter').click()
    page.wait_for_timeout(600)
    snap1 = page.evaluate(
        f'({{spark:{D}.details.sparkTimer, stutter:{D}.details.stutterTimer, '
        f'dust:{D}.details.dust.points.geometry.attributes.position.array[1]}})')
    snap2 = page.evaluate(
        f'window.__lobbyTest.pause(), ({{spark:{D}.details.sparkTimer, '
        f'stutter:{D}.details.stutterTimer, '
        f'dust:{D}.details.dust.points.geometry.attributes.position.array[1]}})')
    page.wait_for_timeout(300)
    snap3f = page.evaluate(
        f'({{spark:{D}.details.sparkTimer, stutter:{D}.details.stutterTimer, '
        f'dust:{D}.details.dust.points.geometry.attributes.position.array[1]}})')
    check('timers frozen on pause', snap3f['spark'] == snap2['spark']
          and snap3f['stutter'] == snap2['stutter'], f'{snap2} -> {snap3f}')
    check('dust frozen on pause', snap3f['dust'] == snap2['dust'])
    check('entered false after pause',
          page.evaluate('window.__lobbyTest.getState().entered') is False)

    page.locator('#enter').click()
    page.wait_for_timeout(400)
    snap3 = page.evaluate(
        f'({{spark:{D}.details.sparkTimer, stutter:{D}.details.stutterTimer}})')
    check('timers progress after resume',
          snap3['spark'] != snap3f['spark'] or snap3['stutter'] != snap3f['stutter'],
          f'{snap3f} -> {snap3}')

    page.evaluate('window.__lobbyTest.setPose(1.6, 2.9, 0.45)')
    page.evaluate('window.__lobbyTest.setPitch(-0.1)')
    page.evaluate('window.__lobbyTest.setState("intervention")')
    page.wait_for_timeout(1200)
    page.screenshot(path=SHOT)

    bad = [(u, s) for u, s in responses if s >= 400]
    check('no failed requests', not bad, str(bad))
    check('no page errors', not page_errors, str(page_errors[:3]))
    check('no console errors', not console_errors, str(console_errors[:3]))

    browser.close()

fails = [n for n, ok, _ in results if not ok]
print(f'\n{len(results) - len(fails)}/{len(results)} passed')
raise SystemExit(1 if fails else 0)
