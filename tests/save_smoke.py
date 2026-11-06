"""Filename and last-document persistence in the sandboxed standalone page."""
import json
import shutil
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    b=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1500,'height':1000},accept_downloads=True)
    page.add_init_script('window.showSaveFilePicker=undefined;window.showOpenFilePicker=undefined;')
    page.goto('http://127.0.0.1:8000/README.md')
    page.set_content('<iframe sandbox="allow-scripts allow-same-origin allow-modals allow-downloads" src="http://127.0.0.1:8000/FreeMindAgain.html" style="width:1400px;height:950px"></iframe>')
    f=page.frames[1]
    f.evaluate('localStorage.clear();model=new Mindmap.Model();render();')
    f.locator('#save').click()
    expect(f.locator('#save-name')).to_have_value('Новая карта.json')
    f.locator('#save-name').fill('Мой проект')
    with page.expect_download() as download:
        f.locator('#confirm-save').click()
    assert download.value.suggested_filename=='Мой проект.json'
    saved=json.loads(open(download.value.path()).read())
    assert saved['fileName']=='Мой проект.json'
    expect(f.locator('#save-dialog')).not_to_be_visible()
    f.locator('#save').click()
    expect(f.locator('#save-name')).to_have_value('Мой проект.json')
    f.locator('#save-name').fill('Не сохранять')
    f.locator('#cancel-save').click()
    assert f.evaluate('model.doc.fileName')=='Мой проект.json'
    f.goto('http://127.0.0.1:8000/FreeMindAgain.html')
    f.locator('#save').click()
    expect(f.locator('#save-name')).to_have_value('Мой проект.json')
    f.locator('#save-name').fill('Вторая версия.json')
    with page.expect_download() as download:
        f.locator('#save-name').press('Enter')
    assert download.value.suggested_filename=='Вторая версия.json'
    # Opening an older JSON takes its actual filename; opening a new one uses metadata.
    page.on('dialog',lambda d:d.accept())
    for doc, actual_name, expected in [(saved,'Переименован.json','Мой проект.json'),
                                     ({k:v for k,v in saved.items() if k!='fileName'},'Старая карта.json','Старая карта.json')]:
        doc['nodes'][0]['label']=actual_name
        f.locator('#file').set_input_files({'name':actual_name,'mimeType':'application/json','buffer':json.dumps(doc).encode()})
        expect(f.locator('#title')).to_have_text(actual_name)
        f.locator('#save').click()
        expect(f.locator('#save-name')).to_have_value(expected)
        f.locator('#cancel-save').click()
        f.goto('http://127.0.0.1:8000/FreeMindAgain.html')
        expect(f.locator('#title')).to_have_text(actual_name)
        assert f.evaluate('JSON.parse(localStorage.getItem(storageKey)).fileName')==expected
    f.locator('#new').click()
    expect(f.locator('#title')).to_have_text('Новая карта')
    f.locator('#save').click()
    expect(f.locator('#save-name')).to_have_value('Новая карта.json')
    f.locator('#cancel-save').click()
    f.goto('http://127.0.0.1:8000/FreeMindAgain.html')
    assert f.evaluate('model.nodes.length')==1
    expect(f.locator('#title')).to_have_text('Новая карта')
    b.close()
print('PASS: suggested name, confirmation each time, cancel, Enter, download metadata, reload, imports, last-map storage, new-map reset')
