import shutil
from playwright.sync_api import sync_playwright, expect
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1450,'height':950})
    page.goto('http://127.0.0.1:8000/README.md')
    page.set_content('<iframe sandbox="allow-scripts allow-same-origin allow-modals" src="http://127.0.0.1:8000/FreeMindAgain.html" style="width:1400px;height:900px"></iframe>')
    f=page.frames[1];f.evaluate('model=new Mindmap.Model();render();fit()')
    confirmations=[];accept=False
    def dialog(d):
        confirmations.append(d.message)
        d.accept() if accept else d.dismiss()
    page.on('dialog',dialog)
    expect(f.locator('#delete-node')).to_be_disabled()
    for key in ['Insert','+']:
        f.locator('#canvas').focus();page.keyboard.press(key)
        expect(f.locator('#rename-dialog')).to_be_visible()
        f.locator('#rename-label').fill('Узел '+key);f.locator('#apply-rename').click()
    assert not confirmations
    assert f.evaluate('model.nodes.length')==3
    before=f.evaluate('JSON.stringify(model.doc)')
    for key in ['Delete','-']:
        f.locator('#canvas').focus();page.keyboard.press(key)
        assert f.evaluate('JSON.stringify(model.doc)')==before
    assert len(confirmations)==2
    f.locator('#delete-node').click()
    assert len(confirmations)==3
    assert f.evaluate('JSON.stringify(model.doc)')==before
    accept=True
    f.evaluate('select(model.nodes[1].id)')
    f.locator('#canvas').focus();page.keyboard.press('Delete')
    assert f.evaluate('model.nodes.length')==1
    f.locator('#undo').click()
    assert f.evaluate('JSON.stringify(model.doc)')==before
    f.locator('#canvas').focus();page.keyboard.press('-')
    assert f.evaluate('model.nodes.length')==1
    f.locator('#undo').click()
    f.locator('#delete-node').click()
    assert f.evaluate('model.nodes.length')==1
    f.locator('#undo').click()
    f.locator('#show-details').click()
    count=len(confirmations)
    for field in ['#label','#note']:
        f.locator(field).fill('Текст')
        f.locator(field).press('+');f.locator(field).press('-');f.locator(field).press('Delete');f.locator(field).press('Insert')
        assert f.evaluate('model.nodes.length')==3
    assert len(confirmations)==count
    f.locator('#label').fill('Правка')
    f.locator('#apply-editor').click()
    # Held keys and modifiers must not create nodes or open confirmation.
    f.locator('#canvas').focus()
    f.locator('#canvas').dispatch_event('keydown',{'key':'Insert','repeat':True})
    f.locator('#canvas').dispatch_event('keydown',{'key':'Delete','repeat':True})
    f.locator('#canvas').press('Control+Insert')
    assert f.locator('dialog[open]').count()==0
    assert len(confirmations)==count
    f.evaluate("select('root')")
    f.locator('#canvas').focus();page.keyboard.press('Delete')
    expect(f.locator('#delete-node')).to_be_disabled()
    assert len(confirmations)==count
    b.close()
print('PASS: +/Insert add, -/Delete/button confirm, cancel preserves tree, subtree deletion, undo, root protection, input/modifier/repeat guards')
