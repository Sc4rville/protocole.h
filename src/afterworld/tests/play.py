import argparse
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--case', choices=['smoke', 'hell', 'heaven', 'mobile', 'audio', 'all'], default='all')
args = parser.parse_args()
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:5186/')
OUT = Path('/tmp/protocole-afterworld-preview')
OUT.mkdir(parents=True, exist_ok=True)
STATE = 'window.__protocole.read()'
results = []


def state(page):
    return page.evaluate(STATE)


def check(name, condition, detail=None):
    results.append({'name': name, 'passed': bool(condition), 'detail': detail})
    print(('PASS' if condition else 'FAIL'), name, json.dumps(detail) if detail is not None else '', flush=True)
    assert condition, name


def wait(page, predicate, timeout=90000):
    page.wait_for_function('(s => ' + predicate + ')(' + STATE + ')', timeout=timeout)
    return state(page)


def elapsed(page, seconds):
    target = state(page)['elapsed'] + seconds
    return wait(page, f's.elapsed >= {target} || s.status === "dead" || s.status === "won"')


def distance(page, value):
    result = wait(page, f'8-s.position.z >= {value} || s.status === "dead" || s.status === "won"')
    check(f'reach {value}m', result['status'] in ('running', 'won'), result)
    return result


def capture(page, name):
    page.screenshot(path=str(OUT / (name + '.png')))


def start(page, mode):
    page.goto(BASE, wait_until='networkidle')
    page.wait_for_function('window.__protocole && document.querySelector("canvas")')
    if mode == 'heaven':
        page.get_by_role('button', name='02 / ÉLAN').click()
    page.get_by_role('button', name='Jouer').click()
    wait(page, 's.status === "running" && s.grounded && s.elapsed > .15')


def hell(page):
    start(page, 'hell')
    capture(page, 'hell-start')
    dead = wait(page, 's.status === "dead"')
    check('no input hits the first hurdle', any(e.get('id') == 'learn-jump' for e in dead['events']), dead)
    page.get_by_role('button', name='Reprendre le parcours').click()
    wait(page, 's.status === "running"')
    distance(page, 25)
    page.keyboard.down('Space')
    distance(page, 33)
    capture(page, 'hell-jump')
    page.keyboard.up('Space')
    distance(page, 57)
    page.keyboard.press('ArrowDown')
    distance(page, 63)
    capture(page, 'hell-slide')
    distance(page, 76)
    page.keyboard.press('ArrowLeft')
    distance(page, 109)
    page.keyboard.down('Space')
    distance(page, 118)
    page.keyboard.up('Space')
    checkpoint = distance(page, 141)
    check('hell checkpoint 140', checkpoint['checkpoint'] == 140, checkpoint)
    wait(page, 's.status === "dead"')
    capture(page, 'hell-checkpoint-death')
    page.get_by_role('button', name='Reprendre le parcours').click()
    resumed = wait(page, 's.status === "running" && s.elapsed > 0')
    check('retry preserves checkpoint', resumed['checkpoint'] == 140 and 136 < 8-resumed['position']['z'] < 155, resumed)
    distance(page, 145)
    page.keyboard.press('ArrowRight')
    distance(page, 202)
    page.keyboard.press('ArrowDown')
    distance(page, 216)
    page.keyboard.press('ArrowLeft')
    distance(page, 222)
    page.keyboard.press('ArrowLeft')
    distance(page, 287)
    page.keyboard.down('Space')
    distance(page, 297)
    page.keyboard.up('Space')
    distance(page, 317)
    page.keyboard.press('ArrowDown')
    distance(page, 330)
    page.keyboard.press('ArrowRight')
    distance(page, 336)
    page.keyboard.press('ArrowRight')
    distance(page, 351)
    capture(page, 'hell-press')
    won = wait(page, 's.status === "won"')
    check('hell full real-input victory', won['checkpoint'] == 270 and 8-won['position']['z'] >= 380, won)
    capture(page, 'hell-win')
    page.get_by_role('button', name='Rejouer').click()
    replay = wait(page, 's.status === "running" && s.elapsed < 1')
    check('hell replay resets', replay['checkpoint'] == 0 and replay['deaths'] == 0 and not replay['sliding'], replay)


def heaven(page):
    start(page, 'heaven')
    capture(page, 'heaven-start')
    page.keyboard.down('ArrowLeft')
    wait(page, 's.position.x < -2.5')
    page.keyboard.up('ArrowLeft')
    page.keyboard.down('ArrowUp')
    bounced = wait(page, 's.events.some(e => e.type === "rebound" || e.type === "perfect-rebound")')
    check('first spring actually launches', bounced['velocity']['y'] > 3, bounced)
    page.keyboard.up('ArrowUp')
    elapsed(page, .35)
    page.keyboard.down('Space')
    gliding = wait(page, 's.gliding')
    check('wing opens in actual flight', gliding['position']['y'] > 1, gliding)
    capture(page, 'heaven-glide')
    for _ in range(12):
        elapsed(page, .3)
        print('HEAVEN', json.dumps(state(page)), flush=True)
    page.keyboard.up('Space')


def smoke(page):
    page.goto(BASE, wait_until='networkidle')
    page.wait_for_function('window.__protocole')
    check('menu canvas', page.locator('canvas').count() == 1)
    check('no autoplay', page.evaluate('window.__protocole.audio().state') == 'locked')
    capture(page, 'menu')
    page.get_by_role('button', name='Jouer').click()
    wait(page, 's.elapsed > .5')
    page.get_by_role('button', name='Mettre en pause').click()
    paused = wait(page, 's.status === "paused"')
    page.wait_for_timeout(500)
    after = state(page)
    check('pause freezes position and clock', paused['position'] == after['position'] and paused['elapsed'] == after['elapsed'])
    page.get_by_role('button', name='Reprendre', exact=True).click()
    elapsed(page, .3)
    check('resume after button', state(page)['status'] == 'running')


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 960, 'height': 640})
    errors = []
    requests = []
    page.on('pageerror', lambda e: (errors.append(str(e)), print('PAGEERROR', str(e), flush=True)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('request', lambda r: requests.append(r.url))
    try:
        if args.case in ('smoke', 'all'):
            smoke(page)
        if args.case in ('hell', 'all'):
            hell(page)
        if args.case in ('heaven', 'all'):
            heaven(page)
        check('no page or console errors', not errors, errors)
        external = [url for url in requests if not url.startswith((BASE.split('/', 3)[0] + '//' + BASE.split('/')[2], 'blob:', 'data:'))]
        check('local-only runtime requests', not external, external)
    except Exception:
        capture(page, 'failure-' + args.case)
        print('FAILURE STATE', json.dumps(state(page)), flush=True)
        raise
    finally:
        (OUT / ('results-' + args.case + '.json')).write_text(json.dumps(results, ensure_ascii=False, indent=2))
        browser.close()
