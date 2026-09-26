import os
import urllib.parse
from playwright.sync_api import sync_playwright

BASE = os.environ.get('ROBOT_TEST_URL', 'http://127.0.0.1:8768/robot-test/?test=1')
OUT = os.environ.get('ROBOT_SHOT_DIR', '/tmp')

T = 'document.getElementById("telemetry").dataset'

results = []
def check(name, ok, extra=''):
    results.append((name, bool(ok), extra))
    print(('PASS' if ok else 'FAIL'), name, extra)

SHOTS = [
    ('front', 'debout', (0.0, 0.05, 3.4, 1.0), False),
    ('three-quarter', 'debout', (0.6, 0.1, 3.4, 1.0), False),
    ('profile', 'debout', (1.57, 0.05, 3.4, 1.0), False),
    ('back', 'debout', (3.14, 0.1, 3.4, 1.0), False),
    ('head', 'debout', (0.45, 0.05, 0.9, 1.7), False),
    ('torso', 'debout', (0.3, 0.1, 1.5, 1.3), False),
    ('forearm-left', 'debout', (-1.1, 0.0, 1.1, 1.05), False),
    ('seated', 'assis', (0.7, 0.15, 3.2, 0.9), True),
    ('defensive', 'defensif', (0.5, 0.12, 3.2, 0.9), True),
]

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width': 1200, 'height': 900})
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
    meshes = int(page.evaluate(f'{T}.meshes'))
    check('robot has many parts', meshes > 150, f'{meshes} meshes')
    head_y = float(page.evaluate(f'{T}.headY'))
    check('head pivot near 1.7 m', 1.6 < head_y < 1.85, f'headY={head_y}')

    FEET_MIN_Y = '''(() => {
      const r = window.__robotTest.robot; r.group.updateMatrixWorld(true);
      const L = new THREE.Box3().setFromObject(r.joints.ankleL).min.y;
      const R = new THREE.Box3().setFromObject(r.joints.ankleR).min.y;
      return [L, R];
    })()'''

    page.evaluate('window.__robotTest.setTurn(false)')
    for name, pose, (yaw, pitch, dist, ty), cell in SHOTS:
        page.evaluate(f'window.__robotTest.setPose("{pose}")')
        page.evaluate(f'window.__robotTest.setCellLight({str(cell).lower()})')
        page.evaluate(f'window.__robotTest.setOrbit({yaw}, {pitch}, {dist}, {ty})')
        page.wait_for_timeout(1400 if pose != 'debout' else 300)
        check(f'pose {pose} applied', page.evaluate(f'{T}.pose') == pose)
        left_y, right_y = page.evaluate(FEET_MIN_Y)
        check(f'both feet on floor ({pose})', abs(left_y) < 0.02 and abs(right_y) < 0.02, f'L={left_y:.4f} R={right_y:.4f}')
        page.screenshot(path=os.path.join(OUT, f'protocole-robot-{name}.png'))

    page.evaluate('window.__robotTest.setOrbit(0.4, -1.2, 7, 1.0)')
    page.wait_for_timeout(200)
    cam_y = page.evaluate('window.__robotTest.debug.camera.position.y')
    check('camera stays above floor', cam_y > 0.1, f'cameraY={cam_y:.3f}')

    check('no page errors', not page_errors, str(page_errors))
    check('no console errors', not console_errors, str(console_errors[:3]))
    browser.close()

failed = [r for r in results if not r[1]]
print(f'{len(results) - len(failed)}/{len(results)} checks passed')
raise SystemExit(1 if failed else 0)
