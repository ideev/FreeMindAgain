import shutil
from playwright.sync_api import sync_playwright, expect
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1450,'height':950})
    page.goto('http://127.0.0.1:8000/FreeMindAgain.html')
    page.evaluate('localStorage.clear()');page.reload()
    panel=page.locator('#tool-panel');handle=page.locator('#toolbar-handle')
    ids=panel.locator('.icon-button').evaluate_all('(els)=>els.map(el=>el.id)')
    assert ids==['show-details','add','delete-node','reparent','undo','redo']
    rects=panel.locator('.icon-button').evaluate_all('(els)=>els.map(el=>({x:el.offsetLeft,y:el.offsetTop}))')
    assert len(set(r['x'] for r in rects))==1
    assert [r['y'] for r in rects]==sorted(r['y'] for r in rects)
    before=page.evaluate('JSON.stringify(model.doc)')
    def drag(dx,dy):
        box=handle.bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
        page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+dx,y+dy,steps=10);page.mouse.up()
    original=panel.bounding_box();drag(-450,120)
    moved=panel.bounding_box()
    assert abs(moved['x']-(original['x']-450))<2
    assert abs(moved['y']-(original['y']+120))<2
    assert page.evaluate('JSON.stringify(model.doc)')==before
    assert page.evaluate('model.undoStack.length')==0
    page.reload()
    restored=panel.bounding_box();assert abs(restored['x']-moved['x'])<2
    handle.focus();page.keyboard.press('ArrowDown')
    assert panel.bounding_box()['y']>restored['y']
    page.locator('#show-details').click()
    expect(page.locator('#details')).to_be_visible()
    def in_bounds():
        return panel.evaluate('el=>{const r=el.getBoundingClientRect(),p=document.querySelector(".workspace").getBoundingClientRect();return r.left>=p.left && r.top>=p.top && r.right<=p.right+1 && r.bottom<=p.bottom+1;}')
    assert in_bounds()
    drag(-3000,-3000);assert in_bounds()
    drag(3000,3000);assert in_bounds()
    page.locator('#show-details').click()
    page.set_viewport_size({'width':390,'height':844})
    page.wait_for_timeout(100)
    assert in_bounds()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path='/tmp/toolbar-mobile.png')
    b.close()
print('PASS: vertical order, mouse drag, clamp, persistence, keyboard movement, resize/card/mobile bounds, no document changes')
