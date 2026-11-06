"""Run against: python3 -m http.server 8000 --bind 127.0.0.1"""
import json
import shutil
from playwright.sync_api import sync_playwright, expect
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=shutil.which('chromium'), args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1360, 'height': 900})
    page.add_init_script('window.showSaveFilePicker=undefined;window.showOpenFilePicker=undefined;')
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('dialog', lambda dialog: dialog.accept())
    page.goto('http://127.0.0.1:8000')
    # Repeated creation must close the modal and keep each node's own label.
    page.locator('#show-details').click()
    expected = ['Новая карта']
    for i, action in enumerate(['#add', '#child', '#child', '#sibling']):
        page.locator(action).click()
        expect(page.locator('#rename-dialog')).to_be_visible()
        expect(page.locator('#rename-label')).to_have_value('Новая мысль')
        label = f'Узел {i + 1}'
        page.locator('#rename-label').fill(label)
        if i % 2:
            page.locator('#rename-label').press('Enter')
        else:
            page.locator('#rename-form button.primary').click()
        expect(page.locator('#rename-dialog')).not_to_be_visible()
        assert page.evaluate("document.querySelector('#rename-dialog').open") is False
        expected.append(label)
        assert page.evaluate('model.nodes.map(n=>n.label)') == expected
        assert page.evaluate('model.current.label') == label
    # Blank input must not reuse the last submitted title.
    page.locator('#child').click()
    expect(page.locator('#rename-label')).to_have_value('Новая мысль')
    page.locator('#rename-label').fill('   ')
    page.locator('#rename-form button.primary').click()
    expect(page.locator('#rename-dialog')).to_be_visible()
    page.locator('#rename-label').fill('После исправления')
    page.locator('#rename-label').press('Enter')
    expect(page.locator('#rename-dialog')).not_to_be_visible()
    assert page.evaluate('model.current.label') == 'После исправления'
    page.locator('#child').click()
    page.keyboard.press('Escape')
    expect(page.locator('#rename-dialog')).not_to_be_visible()
    page.locator('#child').click()
    expect(page.locator('#rename-label')).to_have_value('Новая мысль')
    page.locator('#cancel-rename').click()
    expect(page.locator('#rename-dialog')).not_to_be_visible()
    page.evaluate('localStorage.clear()')
    page.reload()
    page.locator('#show-details').click()
    page.locator('#add').click()
    page.locator('#rename-label').fill('Первая ветка')
    page.locator('#rename-form button.primary').click()
    page.locator('#child').click()
    page.locator('#rename-label').fill('Дочерний узел')
    page.locator('#rename-form button.primary').click()
    page.locator('#note').fill('Содержимое карточки')
    page.locator('#editor button').click()
    assert page.locator('.node').count() == 3
    branch = page.locator('.node', has_text='Первая ветка')
    box = branch.bounding_box()
    before = page.evaluate('model.nodes.map(n=>({id:n.id,x:n.x,y:n.y}))')
    page.mouse.move(box['x']+20, box['y']+15)
    page.mouse.down()
    page.mouse.move(box['x']+70, box['y']+65, steps=5)
    page.mouse.up()
    after = page.evaluate('model.nodes.map(n=>({id:n.id,x:n.x,y:n.y}))')
    assert after[0] == before[0]
    assert after[1]['x'] > before[1]['x'] and after[2]['x'] > before[2]['x']
    page.locator('#undo').click()
    assert page.evaluate('model.nodes.map(n=>({id:n.id,x:n.x,y:n.y}))') == before
    branch.click()
    page.locator('#collapse').click()
    assert page.locator('.node').count() == 2
    page.locator('#undo').click()
    assert page.locator('.node').count() == 3
    page.locator('#remove').click()
    assert page.locator('.node').count() == 1
    page.locator('#undo').click()
    assert page.locator('.node').count() == 3
    with page.expect_download() as download_info:
        page.locator('#save').click()
        page.locator('#confirm-save').click()
    document = json.loads(open(download_info.value.path()).read())
    assert len(document['nodes']) == 3
    assert document['nodes'][2]['note'] == 'Содержимое карточки'
    page.reload()
    assert page.locator('.node').count() == 3
    page.locator('#new').click()
    assert page.locator('.node').count() == 1
    page.locator('#file').set_input_files({'name':'map.json','mimeType':'application/json','buffer':json.dumps(document).encode()})
    assert page.locator('.node').count() == 3
    page.screenshot(path='/tmp/freemindagain.png', full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors, errors
    browser.close()
print('PASS: edit, notes, subtree drag, undo, collapse, delete, JSON round trip, reload, mobile width')
