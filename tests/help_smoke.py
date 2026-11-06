import shutil
from playwright.sync_api import sync_playwright, expect
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1500,'height':950})
    page.goto('http://127.0.0.1:8000/FreeMindAgain.html')
    page.evaluate('model=new Mindmap.Model();render();fit();')
    assert page.get_by_text('ОТ МЫСЛИ К ЦЕЛОМУ').count()==0
    title=page.locator('header #title').bounding_box();brand=page.locator('.brand').bounding_box();nav=page.locator('header nav').bounding_box()
    assert brand['x']+brand['width']<=title['x']<title['x']+title['width']<=nav['x']
    assert page.locator('.bottom p').count()==0
    page.locator('#show-help').click()
    expect(page.locator('#help-dialog')).to_be_visible()
    expect(page.locator('#help-dialog')).to_contain_text('F2')
    page.locator('#close-help').click()
    expect(page.locator('#help-dialog')).not_to_be_visible()
    for key in ['Tab','Enter','Delete','Control+z','Control+s']:
        page.locator('.node.root').focus()
        before=page.evaluate('JSON.stringify(model.doc)')
        page.keyboard.press(key)
        assert page.evaluate('JSON.stringify(model.doc)')==before
        assert page.locator('dialog[open]').count()==0
    page.locator('.node.root').focus();page.keyboard.press('F2')
    expect(page.locator('#rename-dialog')).to_be_visible()
    page.locator('#rename-label').fill('Новое название карты');page.locator('#apply-rename').click()
    expect(page.locator('header #title')).to_have_text('Новое название карты')
    page.screenshot(path='/tmp/help-layout.png')
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.locator('#show-help').click()
    expect(page.locator('#help-dialog')).to_be_visible()
    page.keyboard.press('Escape')
    expect(page.locator('#help-dialog')).not_to_be_visible()
    b.close()
print('PASS: centered header title, help dialog, no action shortcuts except F2, rename title, mobile layout')
