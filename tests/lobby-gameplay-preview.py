import json
import os
import time
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

def wait_state(page, expression, timeout=30000):
    deadline = time.monotonic() + timeout / 1000
    while time.monotonic() < deadline:
        if page.evaluate(expression):
            return
        page.wait_for_timeout(100)
    print('STATE TIMEOUT', expression, page.evaluate(f'{G}.getState()'),
          page.evaluate('window.__lobbyTest.getState()'))
    page.screenshot(path=SHOT_DIR + '/protocole-gameplay-state-failure.png')
    raise AssertionError(f'State condition not reached: {expression}')

def aim(page, target):
    hover_canvas(page)
    w = page.evaluate(f'{G}.targetWorld("{target}")')
    page.evaluate(f'window.__lobbyTest.aimAt({w[0]},{w[1]},{w[2]})')
    return w

def targeted(page, target):
    try:
        wait_state(page, f'{G}.currentTarget === "{target}"', timeout=30000)
    except Exception:
        print('TARGET FAILURE', target, page.evaluate(f'{G}.getState()'),
              page.evaluate('window.__lobbyTest.getState()'), page.evaluate(f'{G}.currentTarget'),
              page.evaluate(f'{G}.targetWorld("{target}")'))
        page.screenshot(path=f'{SHOT_DIR}/protocole-gameplay-{target}-failure.png')
        raise

def pose(page, x, z):
    page.evaluate(f'window.__lobbyTest.setPose({x},{z})')

def hover_canvas(page):
    page.mouse.move(720, 450)

def click_button(page, button_id):
    rect = page.evaluate('''id => {
        const r = document.getElementById(id).getBoundingClientRect();
        return {x:r.x, y:r.y, width:r.width, height:r.height};
    }''', button_id)
    assert rect['width'] > 0 and rect['height'] > 0, f'Button not visible: {button_id}'
    page.mouse.click(rect['x'] + rect['width'] / 2, rect['y'] + rect['height'] / 2)

def changed_mesh_hidden(page, flag):
    return page.evaluate(f'''(() => {{
        const found = [];
        {G}.robot.group.traverse(o => {{ if (o.userData.{flag}) found.push(o); }});
        return found.length === 1 && !found[0].visible;
    }})()''')

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    page.set_default_timeout(60000)
    console_errors, page_errors, responses, requests, failed_requests = [], [], [], [], []
    page.on('console', lambda m: console_errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: page_errors.append(str(e)))
    page.on('response', lambda r: responses.append((r.url, r.status)))
    page.on('request', lambda r: requests.append(r.url))
    page.on('requestfailed', lambda r: failed_requests.append((r.url, r.failure)))

    page.goto(BASE, wait_until='networkidle')
    try:
        wait_state(page, f'{S}.loaded === "true"', timeout=30000)
    except Exception:
        print('LOAD FAILURE', page_errors, console_errors, failed_requests,
              page.evaluate(f'({{...{S}}})'), page.evaluate('window.__lobbyTest?.getState()'))
        page.screenshot(path=SHOT_DIR + '/protocole-gameplay-load-failure.png')
        raise
    page.wait_for_timeout(1200)

    check('robot seated in scene', page.evaluate(f'{G}.robot.meshCount') > 100
          and page.evaluate(f'{G}.robot.pose') == 'assis')
    click_button(page, 'enter')
    wait_state(page, f'{S}.entered === "true"', timeout=10000)
    hover_canvas(page)
    pose(page, 0, 2.7)
    page.evaluate('window.__lobbyTest.aimAt(0,1.45,-0.5)')
    page.wait_for_timeout(800)
    page.screenshot(path=SHOT_DIR + '/protocole-gameplay-front.png')
    pose(page, 2.6, -0.3)
    page.evaluate('window.__lobbyTest.aimAt(0,1.2,-0.4)')
    page.wait_for_timeout(800)
    page.screenshot(path=SHOT_DIR + '/protocole-gameplay-side.png')

    pose(page, 0, 2.7)
    aim(page, 'probe_tool')
    page.wait_for_timeout(600)
    check('probe unreachable from spawn', page.evaluate(f'{G}.currentTarget') is None)
    page.keyboard.press('e')
    check('E at spawn cannot equip distant probe', gs(page, 'equipped') is None)

    pose(page, 2.0, -0.7)
    aim(page, 'probe_tool')
    targeted(page, 'probe_tool')
    check('probe tool targeted', page.evaluate(f'{G}.currentTarget') == 'probe_tool')
    page.keyboard.press('e')
    page.wait_for_timeout(300)
    check('probe equipped', gs(page, 'equipped') == 'probe')
    check('tray probe hidden', page.evaluate('window.__lobbyTest.debug.props.probe.visible') is False)
    check('equipped viewmodel in rendered scene', page.evaluate(
        'window.__lobbyTest.debug.scene.children.some(o => o.isCamera && '
        'o.children.some(model => model.visible))'))

    pose(page, -0.2, 1.35)
    aim(page, 'probe')
    targeted(page, 'probe')
    check('port targeted', page.evaluate(f'{G}.currentTarget') == 'probe')
    page.mouse.down()
    wait_state(page, f'{G}.getState().active && {G}.getState().active.target === "probe"',
                           timeout=10000)
    wait_state(page, f'{G}.getState().charge > 0.62', timeout=90000)
    c_mid = gs(page, 'charge')
    check('charging reaches safe zone', 0.62 < c_mid < 0.79, f'{c_mid:.3f}')

    page.keyboard.press('Escape')
    wait_state(page, f'{S}.entered === "false"', timeout=10000)
    c_paused = gs(page, 'charge')
    page.wait_for_timeout(1500)
    check('charge frozen on pause', abs(c_paused - gs(page, 'charge')) < 1e-9
          and gs(page, 'active') is None, f'{c_mid} -> {c_paused}')
    check('no score on pause', 'charge_restored' not in gs(page, 'facts'))
    page.mouse.up()
    check('release while paused awards nothing', 'charge_restored' not in gs(page, 'facts'))
    click_button(page, 'enter')
    wait_state(page, f'{S}.entered === "true"', timeout=10000)
    aim(page, 'probe')
    targeted(page, 'probe')
    check('resume requires new press', gs(page, 'active') is None
          and gs(page, 'charge') == c_paused)
    page.mouse.down()
    wait_state(page, f'{G}.getState().active !== null', timeout=10000)
    c_release = gs(page, 'charge')
    page.mouse.up()
    page.wait_for_timeout(600)
    check('safe disconnect awards charge_restored',
          0.62 < c_release < 0.79 and gs(page, 'facts').count('charge_restored') == 1,
          str(gs(page, 'facts')))
    page.screenshot(path=SHOT_DIR + '/protocole-gameplay-probe.png')

    pose(page, 1.9, -0.7)
    aim(page, 'pliers_tool')
    targeted(page, 'pliers_tool')
    page.keyboard.press('e')
    page.wait_for_timeout(300)
    check('pliers equipped', gs(page, 'equipped') == 'pliers')

    pose(page, 0.25, 1.35)
    aim(page, 'debris')
    targeted(page, 'debris')
    page.mouse.down()
    wait_state(page, f'{G}.getState().active?.target === "debris"', timeout=10000)
    page.mouse.move(720, 710)
    wait_state(page, f'{G}.getState().facts.includes("debris_removed")',
                           timeout=30000)
    page.mouse.up()
    check('debris removed by drag', True)
    check('debris mesh hidden',
          page.evaluate(f'{G}.targets.debris.object.visible') is False
          and changed_mesh_hidden(page, 'removed'))

    pose(page, -0.05, 1.35)
    aim(page, 'cable')
    targeted(page, 'cable')
    page.mouse.down()
    wait_state(page, f'{G}.getState().active?.target === "cable"', timeout=10000)
    page.mouse.move(720, 3050)
    c1 = gs(page, 'cable')
    check('first cable pull capped at warning', c1 == 0.5 and 'cable_torn' not in gs(page, 'facts'),
          f'cable={c1}')
    wait_state(page,
        f'{G}.getState().active && {G}.getState().active.warningRemaining <= 0.000000001', timeout=90000)
    check('waiting alone does not tear cable', gs(page, 'cable') == 0.5
          and 'cable_torn' not in gs(page, 'facts')
          and gs(page, 'active.elapsed') >= 1)
    page.mouse.move(720, 3310)
    wait_state(page, f'{G}.getState().facts.includes("cable_torn")',
                           timeout=30000)
    check('cable torn after warning window', True)
    page.mouse.up()
    check('cable damage visible', page.evaluate(f'{G}.targets.cable.object.visible') is False
          and changed_mesh_hidden(page, 'torn'))

    page.keyboard.press('r')
    page.wait_for_timeout(300)
    check('hands empty', gs(page, 'equipped') is None)
    pose(page, -1.15, 1.0)
    aim(page, 'restraint')
    targeted(page, 'restraint')
    page.mouse.down()
    wait_state(page,
        f'{G}.getState().active && {G}.getState().active.target === "restraint"', timeout=10000)
    for _ in range(2):
        page.mouse.wheel(0, -100)
    wait_state(page, f'{G}.getState().restraint >= 0.75', timeout=10000)
    check('restraint tightened to warning', gs(page, 'restraint') == 0.75
          and 'restraint_damaged' not in gs(page, 'facts'),
          gs(page, 'restraint'))
    wait_state(page,
        f'{G}.getState().active && {G}.getState().active.warningRemaining <= 0.000000001', timeout=90000)
    check('waiting alone does not damage restraint', gs(page, 'restraint') == 0.75
          and 'restraint_damaged' not in gs(page, 'facts')
          and gs(page, 'active.elapsed') >= 1)
    for _ in range(2):
        page.mouse.wheel(0, -100)
    wait_state(page, f'{G}.getState().facts.includes("restraint_damaged")', timeout=10000)
    check('restraint_damaged recorded', 'restraint_damaged' in gs(page, 'facts'))
    for _ in range(8):
        page.mouse.wheel(0, 100)
    wait_state(page, f'{G}.getState().facts.includes("restraint_released")', timeout=10000)
    check('restraint_released recorded', 'restraint_released' in gs(page, 'facts'))
    page.mouse.up()
    facts = gs(page, 'facts')
    check('both restraint facts persist',
          'restraint_damaged' in facts and 'restraint_released' in facts, str(facts))
    page.mouse.down()
    page.mouse.wheel(0, -100)
    page.mouse.up()
    check('restraint release is permanent', gs(page, 'restraint') == 0
          and gs(page, 'facts') == facts)
    check('cable damage persists', page.evaluate(f'{G}.targets.cable.object.visible') is False
          and changed_mesh_hidden(page, 'torn'))
    check('score hidden before finish', page.locator('#verdict').is_hidden()
          and page.locator('#verdict .verdict-text').inner_text() == ''
          and gs(page, 'result') is None)
    page.screenshot(path=SHOT_DIR + '/protocole-gameplay-damage.png')

    pose(page, -2.4, -0.6)
    aim(page, 'finish')
    targeted(page, 'finish')
    check('finish targeted', page.evaluate(f'{G}.currentTarget') == 'finish')
    page.keyboard.press('e')
    wait_state(page, f'{G}.getState().finished', timeout=10000)
    result = page.evaluate(f'{G}.result')
    expected = {'charge_restored', 'debris_removed', 'cable_torn',
                'restraint_damaged', 'restraint_released'}
    check('verdict records actual facts', expected == set(result['facts'])
          and len(result['facts']) == len(expected),
          str(result['facts']))
    check('documented mixed sequence scores 10', result['score'] == 10
          and result['outcome'] == 'mixed', str(result))
    check('verdict effects match actual actions', result['effects'] ==
          {'energy': 'support', 'machinery': 'hazard', 'route': 'open'})
    check('verdict overlay shown', page.evaluate('!document.getElementById("verdict").hidden'))
    stored = page.evaluate('sessionStorage.getItem("protocole.h.result.v1")')
    check('result stored in sessionStorage', stored and json.loads(stored) == result)
    check('verdict uses authored text', page.evaluate(
        'document.querySelector("#verdict .verdict-text").textContent') == result['verdictText'])
    page.wait_for_timeout(800)
    page.screenshot(path=SHOT_DIR + '/protocole-gameplay-verdict.png')
    page.keyboard.press('e')
    page.keyboard.press('r')
    page.mouse.click(720, 300)
    page.mouse.wheel(0, -100)
    page.wait_for_timeout(500)
    check('finished result is frozen', gs(page, 'result') == result
          and gs(page, 'facts') == result['facts'] and gs(page, 'finished')
          and page.evaluate('sessionStorage.getItem("protocole.h.result.v1")') == stored)

    click_button(page, 'replay')
    page.wait_for_load_state('networkidle')
    wait_state(page, f'{S}.loaded === "true"', timeout=30000)
    page.wait_for_timeout(1200)
    check('replay resets session', gs(page, 'facts') == [] and gs(page, 'finished') is False)
    check('replay resets geometry', page.evaluate(
        f'{G}.targets.debris.object.visible && {G}.targets.cable.object.visible && '
        'window.__lobbyTest.debug.props.probe.visible && window.__lobbyTest.debug.props.pliers.visible'))
    check('replay resets devices', gs(page, 'charge') == 0 and gs(page, 'debris') == 0
          and gs(page, 'cable') == 0 and gs(page, 'restraint') == 0.5
          and gs(page, 'equipped') is None and gs(page, 'result') is None)

    bad = [(u, s_) for u, s_ in responses if s_ >= 400]
    check('no failed local requests', not bad, str(bad))
    check('no unexpected failed requests', not failed_requests, str(failed_requests))
    external = [u for u in requests
                if urllib.parse.urlparse(u).hostname not in ('127.0.0.1', 'localhost')]
    check('no external requests', not external, str(external))
    check('no page errors', not page_errors, str(page_errors[:3]))
    check('no console errors', not console_errors, str(console_errors[:3]))

    browser.close()

fails = [n for n, ok, _ in results if not ok]
print(f'\n{len(results) - len(fails)}/{len(results)} passed')
raise SystemExit(1 if fails else 0)
