import json
import shutil
from playwright.sync_api import sync_playwright, expect
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1400,'height':950},accept_downloads=True)
    page.goto('http://127.0.0.1:8000/README.md')
    page.set_content('<iframe sandbox="allow-scripts allow-same-origin allow-modals allow-downloads" src="http://127.0.0.1:8000/FreeMindAgain.html" style="width:1350px;height:900px"></iframe>')
    f=page.frames[1]
    f.evaluate('model=new Mindmap.Model();render();fit();')
    assert f.locator('.node-status').count()==0
    f.locator('#show-details').click()
    expect(f.locator('#node-status')).to_have_value('')
    for status,label in [('planned','Запланировано'),('in-progress','В процессе'),('done','Готово')]:
        f.locator('#node-status').select_option(status)
        f.locator('#apply-editor').click()
        expect(f.locator('.node-status')).to_have_class('node-status '+status)
        expect(f.locator('.node-status')).to_have_attribute('title',label)
        assert f.locator('.node.root').evaluate('(el)=>el.firstElementChild.classList.contains("node-status")')
    f.locator('#undo').click()
    expect(f.locator('#node-status')).to_have_value('in-progress')
    f.locator('#redo').click()
    expect(f.locator('#node-status')).to_have_value('done')
    f.locator('#child').click();f.locator('#apply-rename').click()
    expect(f.locator('#node-status')).to_have_value('')
    assert f.locator('.node:not(.root) .node-status').count()==0
    f.locator('#node-status').select_option('planned');f.locator('#apply-editor').click()
    f.locator('#save').click()
    with page.expect_download() as d:f.locator('#download-copy').click()
    doc=json.loads(open(d.value.path()).read())
    assert [n['status'] for n in doc['nodes']]==['done','planned']
    f.goto('http://127.0.0.1:8000/FreeMindAgain.html')
    assert f.locator('.node-status').count()==2
    page.on('dialog',lambda d:d.accept())
    f.locator('#file').set_input_files({'name':'status.json','mimeType':'application/json','buffer':json.dumps(doc).encode()})
    expect(f.locator('.node.root .node-status')).to_have_class('node-status done')
    f.locator('#show-details').click()
    f.locator('#node-status').select_option('');f.locator('#apply-editor').click()
    assert f.locator('.node.root .node-status').count()==0
    page.screenshot(path='/tmp/status-check.png')
    b.close()
print('PASS: sandbox status selector, empty status invisible, all icons, undo/redo, fresh child, JSON download/import, reload, clearing status')
