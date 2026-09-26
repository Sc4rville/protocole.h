from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:5183/'
OUT = '/tmp/protocole-runner-preview'
Path(OUT).mkdir(parents=True, exist_ok=True)
S = 'document.getElementById("runner-state").dataset'

def snap(page, keys=('state', 'distance', 'playerY', 'lane', 'checkpoint', 'gliding')):
    return page.evaluate(
        '({' + ','.join(f'{k}:{S}.{k}' for k in keys) + '})'
    )

def wait_distance(page, target, timeout=90000):
    page.wait_for_function(
        f'parseFloat({S}.distance) >= {target}', timeout=timeout
    )

def wait_state(page, state, timeout=90000):
    page.wait_for_function(
        f'{S}.state === "{state}"', timeout=timeout
    )

def select_mode(page, mode):
    page.locator(f'.mode-btn[data-mode="{mode}"]').click()
    page.wait_for_timeout(150)
    page.locator('#btn-play').click()
    page.wait_for_timeout(300)

def hell_policy(page, actions):
    for at, action in actions:
        wait_distance(page, at)
        action()

results = []
def check(name, ok, extra=''):
    results.append((name, ok, extra))
    print(('PASS' if ok else 'FAIL'), name, extra)

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={'width': 1440, 'height': 900})
    errors = []
    reqs = []
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('request', lambda r: reqs.append(r.url))
    page.goto(BASE, wait_until='networkidle')
    page.screenshot(path=f'{OUT}/menu.png')
    check('title', 'protocole.h' in page.title())
    check('canvas', page.evaluate('document.querySelectorAll("canvas").length') == 1)
    check('menu state', snap(page)['state'] == 'menu')

    select_mode(page, 'hell')
    check('hell running', snap(page)['state'] == 'running')
    page.screenshot(path=f'{OUT}/hell-start.png')
    wait_state(page, 'dead')
    check('hell dies at first barrier', snap(page)['state'] == 'dead')
    page.screenshot(path=f'{OUT}/hell-dead.png')
    page.locator('#btn-retry').click()
    page.wait_for_timeout(300)
    st = snap(page)
    check('retry restarts at 0', st['state'] == 'running' and float(st['distance']) < 12, str(st))

    hell_policy(page, [
        (55, lambda: page.keyboard.press('ArrowUp')),
        (133, lambda: page.keyboard.press('ArrowDown')),
        (272, lambda: page.keyboard.press('ArrowUp')),
        (330, lambda: page.keyboard.press('ArrowRight')),
    ])
    wait_distance(page, 405)
    st = snap(page)
    check('checkpoint 400 activated', st['checkpoint'] == '400', str(st))
    wait_state(page, 'dead')
    st = snap(page)
    check('death past checkpoint', st['state'] == 'dead', str(st))
    page.screenshot(path=f'{OUT}/hell-dead-cp.png')
    page.locator('#btn-retry').click()
    page.wait_for_timeout(300)
    st = snap(page)
    check('retry resumes at 400', 400 <= float(st['distance']) < 415 and st['checkpoint'] == '400', str(st))

    hell_policy(page, [
        (430, lambda: page.keyboard.press('ArrowRight')),
        (452, lambda: page.keyboard.press('ArrowUp')),
        (728, lambda: page.keyboard.press('ArrowDown')),
    ])
    wait_state(page, 'won', timeout=60000)
    st = snap(page)
    check('hell win', st['state'] == 'won', str(st))
    page.screenshot(path=f'{OUT}/hell-win.png')
    page.locator('#btn-replay').click()
    page.wait_for_timeout(300)
    st = snap(page)
    check('replay resets hell', st['state'] == 'running' and float(st['distance']) < 12 and st['checkpoint'] == '0', str(st))

    page.wait_for_timeout(400)
    page.locator('#btn-pause').click()
    page.wait_for_timeout(300)
    check('pause state', snap(page)['state'] == 'paused')
    d0 = float(snap(page)['distance'])
    page.wait_for_timeout(600)
    check('pause freezes distance', abs(float(snap(page)['distance']) - d0) < 0.5)
    page.locator('#btn-resume').click()
    page.wait_for_timeout(300)
    check('resume state', snap(page)['state'] == 'running')
    page.keyboard.press('ArrowUp')
    page.wait_for_timeout(250)
    st = snap(page)
    check('jump works after resume', float(st['playerY']) > 0.3, str(st))
    page.locator('.hud-bar .btn-select').click()
    page.wait_for_timeout(400)
    check('back to menu', snap(page)['state'] == 'menu')

    select_mode(page, 'heaven')
    check('heaven running', snap(page)['state'] == 'running')
    page.screenshot(path=f'{OUT}/heaven-start.png')
    wait_distance(page, 112, timeout=20000)
    wait_state(page, 'dead', timeout=15000)
    page.wait_for_timeout(1200)
    st = snap(page)
    check('heaven auto recovery near island start', st['state'] == 'running' and float(st['distance']) < 60, str(st))
    page.keyboard.down('Space')
    saw_glide = False
    saw_apex = False
    for _ in range(500):
        st = snap(page)
        if st['state'] == 'won':
            break
        if st['gliding'] == 'true' and not saw_glide:
            saw_glide = True
            page.screenshot(path=f'{OUT}/heaven-glide.png')
        if float(st['playerY']) > 5 and not saw_apex:
            saw_apex = True
            page.screenshot(path=f'{OUT}/heaven-apex.png')
        page.wait_for_timeout(100)
    page.keyboard.up('Space')
    st = snap(page)
    check('heaven win', st['state'] == 'won', str(st))
    check('glide observed', saw_glide)
    page.screenshot(path=f'{OUT}/heaven-win.png')
    page.locator('#btn-replay').click()
    page.wait_for_timeout(300)
    st = snap(page)
    check('replay resets heaven', st['state'] == 'running' and float(st['distance']) < 12, str(st))
    page.locator('.hud-bar .btn-select').click()
    page.wait_for_timeout(300)

    ctx = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
    mp = ctx.new_page()
    mp.on('pageerror', lambda e: errors.append(str(e)))
    mreqs = []
    mp.on('request', lambda r: mreqs.append(r.url))
    mp.goto(BASE, wait_until='networkidle')
    mp.screenshot(path=f'{OUT}/mobile-menu.png')
    mp.locator('.mode-btn[data-mode="heaven"]').click()
    mp.wait_for_timeout(150)
    mp.locator('#btn-play').click()
    mp.wait_for_timeout(500)
    mp.locator('#t-left').tap()
    mp.wait_for_timeout(200)
    lane = mp.evaluate(f'{S}.lane')
    check('touch lane left', lane == '0', lane)
    mp.locator('#t-right').tap()
    mp.wait_for_timeout(200)
    mp.locator('#t-jump').tap()
    mp.wait_for_timeout(250)
    y = float(mp.evaluate(f'{S}.playerY'))
    check('touch jump', y > 0.3, str(y))
    mp.screenshot(path=f'{OUT}/mobile-heaven.png')
    check('mobile requests all local', all(u.startswith(BASE) for u in mreqs))
    ctx.close()

    check('no page errors', not errors, str(errors[:5]))
    check('desktop requests all local', all(u.startswith(BASE) for u in reqs))
    b.close()

fails = [r for r in results if not r[1]]
print(f'--- {len(results) - len(fails)}/{len(results)} passed ---')
if fails:
    raise SystemExit(1)
