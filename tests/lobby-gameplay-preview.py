import json
import os
import urllib.parse
from playwright.sync_api import sync_playwright

BASE = os.environ.get('LOBBY_TEST_URL', 'http://127.0.0.1:8776/lobby-test/?test=1')
SHOT_DIR = '/tmp'

results = []
def check(name, ok, extra=''):
    results.append((name, bool(ok), extra))
    print(('PASS' if ok else 'FAIL'), name, extra)

G = 'window.__lobbyTest.debug.gameplay'
S = 'document.getElementById("telemetry").dataset'

def gs(page, expr):
    return page.evaluate(f'{G}.getState().{expr}')

def aim(page, target):
    w = page.evaluate(f'{G}.targetWorld("{target}")')
    page.evaluate(f'window.__lobbyTest.aimAt({w[0]},{w[1]},{w[2]})')
    return w

def pose(page, x, z):
    page.evaluate(f'window.__lobbyTest.setPose({x},{z})')

def hover_canvas(page):
    page.mouse.move(720, 450)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    console_errors, page_errors, responses, requests = [], [], [], []
    page.on('console', lambda m: console_errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: page_errors.append(str(e)))
    page.on('response', lambda r: responses.append((r.url, r.status)))
    page.on('request', lambda r: requests.append(r.url))

    page.goto(BASE, wait_until='networkidle')
    page.wait_for_function(f'{S}.loaded === "true"', timeout=30000)
    page.wait_for_timeout(1200)

    check('robot seated in scene', page.evaluate(f'{G}.robot.meshCount') > 100)
    pose(page, 0, 1.4)
    page.evaluate('window.__lobbyTest.aimAt(0,1.45,-0.5)')
    page.wait_for_timeout(800)
    page.screenshot(path=SHOT_DIR + '/protocole-gameplay-robot-front.png')
    pose(page, 1.9, -0.3)
    page.evaluate('window.__lobbyTest.aimAt(0,1.2,-0.4)')
    page.wait_for_timeout(800)
    page.screenshot(path=SHOT_DIR + '/protocole-gameplay-robot-side.png')

    page.locator('#enter').click()
    page.wait_for_function(f'{S}.entered === "true"', timeout=5000)

    # out of reach: probe tool is >4 m from spawn
    pose(page, 0, 2.7)
    aim(page, 'probe_tool')
    page.wait_for_timeout(600)
    check('probe unreachable from spawn', page.evaluate(f'{G}.currentTarget') is None)

    pose(page, 2.0, -0.7)
    aim(page, 'probe_tool')
    page.wait_for_timeout(600)
    check('probe tool targeted', page.evaluate(f'{G}.currentTarget') == 'probe_tool')
    page.keyboard.press('e')
    page.wait_for_timeout(300)
    check('probe equipped', gs(page, 'equipped') == 'probe')
    check('tray probe hidden', page.evaluate('window.__lobbyTest.debug.props.probe.visible') is False)

    # charge to safe zone and disconnect intentionally
    pose(page, -0.2, 1.35)
    aim(page, 'probe')
    page.wait_for_timeout(600)
    check('port targeted', page.evaluate(f'{G}.currentTarget') == 'probe')
    hover_canvas(page)
    page.mouse.down()
    page.wait_for_function(f'{G}.getState().active && {G}.getState().active.target === "probe"',
                           timeout=10000)
    page.wait_for_function(f'{G}.getState().charge > 0.5', timeout=70000)
    c_mid = gs(page, 'charge')
    check('charging progresses', c_mid > 0.5, f'{c_mid:.3f}')

    # pause mid-charge: freezes, cancels without reward
    page.evaluate('window.__lobbyTest.pause()')
    page.wait_for_timeout(1500)
    c_paused = gs(page, 'charge')
    check('charge frozen on pause', abs(c_paused - gs(page, 'charge')) < 1e-9
          and gs(page, 'active') is None, f'{c_mid} -> {c_paused}')
    check('no score on pause', 'charge_restored' not in gs(page, 'facts'))
    page.locator('#enter').click()
    page.wait_for_function(f'{S}.entered === "true"', timeout=5000)
    aim(page, 'probe')
    page.wait_for_timeout(600)
    hover_canvas(page)
    page.mouse.down()
    page.wait_for_function(f'{G}.getState().charge >= 0.62', timeout=70000)
    page.mouse.up()
    page.wait_for_timeout(600)
    check('safe disconnect awards charge_restored',
          'charge_restored' in gs(page, 'facts'), gs(page, 'facts'))
    page.screenshot(path=SHOT_DIR + '/protocole-gameplay-charge.png')

    # pliers: debris drag removes mesh
    pose(page, 1.9, -0.7)
    aim(page, 'pliers_tool')
    page.wait_for_timeout(600)
    page.keyboard.press('e')
    page.wait_for_timeout(300)
    check('pliers equipped', gs(page, 'equipped') == 'pliers')

    pose(page, 0.25, 1.35)
    aim(page, 'debris')
    page.wait_for_timeout(600)
    hover_canvas(page)
    page.mouse.down()
    for _ in range(8):
        page.mouse.move(720, 450 + 40, steps=4)
        page.mouse.move(720, 450, steps=4)
    page.wait_for_function("'debris_removed' in window.__lobbyTest.debug.gameplay.getState().facts",
                           timeout=30000)
    check('debris removed by drag', True)
    check('debris mesh hidden',
          page.evaluate(f'{G}.targets.debris.object.visible') is False)

    # cable: first pull gated at warning, subsequent pull tears after warning drained
    pose(page, -0.05, 1.35)
    aim(page, 'cable')
    page.wait_for_timeout(600)
    hover_canvas(page)
    page.mouse.down()
    for _ in range(12):
        page.mouse.move(720, 450 + 60, steps=5)
    c1 = gs(page, 'cable')
    check('first cable pull capped at warning', c1 <= 0.51 and 'cable_torn' not in gs(page, 'facts'),
          f'cable={c1}')
    page.wait_for_function(
        f'{G}.getState().active && {G}.getState().active.warningRemaining <= 0.001', timeout=30000)
    for _ in range(14):
        page.mouse.move(720, 450 + 70, steps=5)
    page.wait_for_function("'cable_torn' in window.__lobbyTest.debug.gameplay.getState().facts",
                           timeout=30000)
    check('cable torn after warning window', True)
    page.mouse.up()
    page.screenshot(path=SHOT_DIR + '/protocole-gameplay-damage.png')

    # restraint: empty hands, wheel both ways until damage then release
    page.keyboard.press('r')
    page.wait_for_timeout(300)
    check('hands empty', gs(page, 'equipped') is None)
    pose(page, -1.15, 1.0)
    aim(page, 'restraint')
    page.wait_for_timeout(600)
    hover_canvas(page)
    page.mouse.down()
    page.wait_for_function(
        f'{G}.getState().active && {G}.getState().active.target === "restraint"', timeout=10000)
    hover_canvas(page)
    for _ in range(4):
        page.mouse.wheel(0, -100)
        page.wait_for_timeout(1200)
    check('restraint tightened to warning', gs(page, 'restraint') >= 0.74,
          gs(page, 'restraint'))
    page.wait_for_function(
        f'{G}.getState().active && {G}.getState().active.warningRemaining <= 0.001', timeout=30000)
    for _ in range(4):
        page.mouse.wheel(0, -100)
        page.wait_for_timeout(1200)
        if 'restraint_damaged' in gs(page, 'facts'):
            break
    check('restraint_damaged recorded', 'restraint_damaged' in gs(page, 'facts'))
    for _ in range(10):
        page.mouse.wheel(0, 100)
        page.wait_for_timeout(1200)
        if 'restraint_released' in gs(page, 'facts'):
            break
    check('restraint_released recorded', 'restraint_released' in gs(page, 'facts'))
    page.mouse.up()
    facts = gs(page, 'facts')
    check('both restraint facts persist',
          'restraint_damaged' in facts and 'restraint_released' in facts, str(facts))

    # finish console shows verdict with actual facts
    pose(page, -2.4, -0.6)
    aim(page, 'finish')
    page.wait_for_timeout(600)
    check('finish targeted', page.evaluate(f'{G}.currentTarget') == 'finish')
    page.keyboard.press('e')
    page.wait_for_function(f'{G}.getState().finished', timeout=10000)
    result = page.evaluate(f'{G}.result')
    expected = {'charge_restored', 'debris_removed', 'cable_torn',
                'restraint_damaged', 'restraint_released'}
    check('verdict records actual facts', expected.issubset(set(result['facts'])),
          str(result['facts']))
    check('verdict overlay shown', page.evaluate('!document.getElementById("verdict").hidden'))
    stored = page.evaluate('sessionStorage.getItem("protocole.h.result.v1")')
    check('result stored in sessionStorage', stored and json.loads(stored)['version'] == 1)
    check('verdict uses authored text', page.evaluate(
        'document.querySelector("#verdict .verdict-text").textContent') == result['verdictText'])
    page.wait_for_timeout(800)
    page.screenshot(path=SHOT_DIR + '/protocole-gameplay-verdict.png')

    # reload clears the session
    page.goto(BASE, wait_until='networkidle')
    page.wait_for_function(f'{S}.loaded === "true"', timeout=30000)
    page.wait_for_timeout(1200)
    check('replay resets session', gs(page, 'facts') == [] and gs(page, 'finished') is False)

    bad = [(u, s_) for u, s_ in responses if s_ >= 400]
    check('no failed local requests', not bad, str(bad))
    external = [u for u in requests
                if urllib.parse.urlparse(u).hostname not in ('127.0.0.1', 'localhost')]
    check('no external requests', not external, str(external))
    check('no page errors', not page_errors, str(page_errors[:3]))
    check('no console errors', not console_errors, str(console_errors[:3]))

    browser.close()

fails = [n for n, ok, _ in results if not ok]
print(f'\n{len(results) - len(fails)}/{len(results)} passed')
raise SystemExit(1 if fails else 0)
