"""Optional Playwright checks of the self-contained build.
Runs without HTTP or file navigation (both are restricted in the build sandbox).
This does NOT test native localStorage persistence or file:// navigation.
"""
import json
import os
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = Path(os.environ.get('CUBE_TEST_OUTPUT', str(ROOT / 'test-results')))
OUTPUT.mkdir(parents=True, exist_ok=True)
HTML = (ROOT / 'dist/index.html').read_text()
checks = []

def check(name, condition):
    if not condition:
        raise AssertionError(name)
    checks.append(name)
    print('PASS', name)

def snap(page):
    return page.evaluate('CubeLabDebug.snapshot()')

def idle(page):
    page.wait_for_function('!CubeLabDebug.snapshot().busy && !CubeLabDebug.snapshot().playing')

def done(page):
    page.wait_for_function('!CubeLabDebug.snapshot().busy && !CubeLabDebug.snapshot().playing && CubeLabDebug.snapshot().cursor === CubeLabDebug.snapshot().steps')

with sync_playwright() as p:
    executable = os.environ.get('CHROMIUM') or which('chromium') or which('chromium-browser')
    browser = p.chromium.launch(headless=True, executable_path=executable, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width':1440,'height':1080}, device_scale_factor=1)
    context.set_offline(True)
    page = context.new_page()
    errors,requests,workers = [],[],[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('request', lambda r: requests.append(r.url))
    page.on('worker',lambda w:workers.append(w.url))
    page.set_content(HTML,wait_until='load')
    page.wait_for_timeout(100)
    check('Initial solved cube and 54 net stickers', snap(page)['solved'] and page.locator('#flat-view [data-slot]').count()==54)
    check('No horizontal desktop overflow', page.evaluate('document.body.scrollWidth <= innerWidth'))
    page.select_option('#speed','40')
    page.locator('[data-move="R"]').click()
    page.wait_for_function('CubeLabDebug.snapshot().moves===1 && !CubeLabDebug.snapshot().busy')
    r_state=snap(page)['state']
    check('R changes state',not snap(page)['solved'])
    colors=['#f5cc42','#ef6663','#50cbb0','#edf0f6','#f5a05a','#729bed']
    stickers=page.locator('#flat-view [data-slot]').evaluate_all('(els)=>els.map(e=>({slot:+e.dataset.slot,fill:e.getAttribute("fill")}))')
    check('All 54 2D stickers match the model',all(x['fill']==colors[r_state[x['slot']]//9] for x in stickers))
    page.keyboard.press('Shift+R');idle(page)
    check('Keyboard inverse restores cube',snap(page)['solved'])
    page.click('#undo');check('Undo restores prior state',snap(page)['state']==r_state)
    page.click('#redo');check('Redo restores solved state',snap(page)['solved'])
    page.locator('#algorithm-input').fill("R U R' U' "*6)
    page.locator('#algorithm-form button').click();done(page)
    check('Custom repeated trigger plays correctly',snap(page)['solved'] and snap(page)['cursor']==24)
    page.click('#scramble');scrambled=snap(page)['state']
    check('Scramble is nontrivial',not snap(page)['solved'])
    page.click('#solve');page.wait_for_function('!CubeLabDebug.snapshot().solving && CubeLabDebug.snapshot().steps>0')
    check('Solver computes from current state without changing it',snap(page)['state']==scrambled and snap(page)['cursor']==0)
    check('Web Worker was created',len(workers)>0)
    page.click('#next-step');idle(page)
    check('Solution single-step advances one move',snap(page)['cursor']==1)
    page.click('#previous-step');idle(page)
    check('Solution reverse step is exact',snap(page)['cursor']==0 and snap(page)['state']==scrambled)
    page.click('#play-pause');page.wait_for_function('CubeLabDebug.snapshot().cursor>=3');page.click('#play-pause');idle(page)
    paused=snap(page)['cursor'];page.wait_for_timeout(220)
    check('Pause remains paused after in-flight move completes',snap(page)['cursor']==paused)
    page.click('#play-pause');done(page)
    check('Full seven-stage replay solves the cube',snap(page)['solved'] and all(snap(page)['stageFlags']))
    for i in range(7):
        page.locator('[data-lesson]').nth(i).click();page.click('#lesson-load')
        page.click('#play-pause');done(page)
        check('Matched lesson '+str(i+1)+' solves its example',snap(page)['solved'])
    page.locator('[data-view="ring"]').click()
    check('Ring view has 54 linked stickers',snap(page)['view']=='ring' and page.locator('#flat-view [data-slot]').count()==54)
    page.locator('#flat-view [data-slot="7"]').click()
    check('Sticker identity can be selected in ring view',snap(page)['selected']==snap(page)['state'][7])
    page.click('#map-expand');check('Expanded ring dialog works',page.locator('#map-dialog').evaluate('(e)=>e.open') and page.locator('#expanded-flat-view [data-slot]').count()==54)
    page.screenshot(path=str(OUTPUT/'cube-lab-rings-expanded.png'))
    page.click('#map-close')
    before=page.locator('#cube-canvas').screenshot()
    box=page.locator('#cube-canvas').bounding_box();x,y=box['x']+box['width']*.5,box['y']+box['height']*.5
    page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+100,y+30,steps=6);page.mouse.up();page.wait_for_timeout(60)
    after=page.locator('#cube-canvas').screenshot()
    check('Dragging changes the rendered 3D camera',before!=after)
    page.click('#camera-reset')
    import_payload={'version':1,'state':scrambled,'moves':22,'elapsed':12000}
    page.locator('#import-file').set_input_files({'name':'valid.json','mimeType':'application/json','buffer':json.dumps(import_payload).encode()})
    page.wait_for_function('CubeLabDebug.snapshot().moves===22')
    check('Import restores a validated state',snap(page)['state']==scrambled)
    bad=list(range(54));bad[5],bad[10]=bad[10],bad[5]
    page.locator('#import-file').set_input_files({'name':'invalid.json','mimeType':'application/json','buffer':json.dumps({'version':1,'state':bad}).encode()})
    page.wait_for_timeout(150)
    check('Impossible imported edge flip is rejected',snap(page)['state']==scrambled)
    page.fill('#algorithm-input','<script>alert(1)</script>');page.locator('#algorithm-form button').click();page.wait_for_timeout(80)
    check('Invalid algorithm input does not mutate the cube',snap(page)['state']==scrambled)
    page.locator('[data-page="learn"]').click();check('Seven formula lessons are present',page.locator('.lesson-card').count()==7)
    page.locator('[data-page="principles"]').click();check('Four first-principles notes are present',page.locator('.principle').count()==4)
    page.locator('[data-page="play"]').click();page.locator('[data-view="net"]').click()
    page.click('#reset');page.locator('[data-lesson]').nth(1).click();page.click('#lesson-load')
    page.select_option('#speed','400');page.fill('#algorithm-input',"R U R' U'");page.evaluate('document.getElementById("toast").hidden=true')
    page.screenshot(path=str(OUTPUT/'cube-lab-desktop.png'),full_page=True)
    check('No page runtime exceptions',not errors)
    check('No external network requests in offline build',not [url for url in requests if url.startswith(('http:', 'https:'))])
    mobile=context.new_page();mobile.set_viewport_size({'width':390,'height':844})
    mobile_errors=[];mobile.on('pageerror',lambda e:mobile_errors.append(str(e)))
    mobile.set_content(HTML,wait_until='load');mobile.wait_for_timeout(100)
    check('No horizontal mobile overflow',mobile.evaluate('document.body.scrollWidth <= innerWidth'))
    mobile.locator('[data-view="ring"]').click();mobile.screenshot(path=str(OUTPUT/'cube-lab-mobile.png'),full_page=True)
    check('Mobile ring view works',snap(mobile)['view']=='ring' and not mobile_errors)
    browser.close()

report={'checksPassed':len(checks),'checks':checks,'runtimeErrors':errors,'externalNetworkRequests':[url for url in requests if url.startswith(('http:', 'https:'))], 'internalResourceRequests':requests,'workerCount':len(workers),'limitations':['Browser policy prohibits HTTP/file navigation in this sandbox; tested the exact standalone HTML via set_content with network disabled.','Native localStorage and real file:// double-click opening were not verified in this environment.','Only bundled Chromium was tested, not Safari or Firefox.']}
(OUTPUT/'browser-report.json').write_text(json.dumps(report,indent=2))
print('ALL PASSED',len(checks))
