"""Regression: the chat HTML preview blocks native form submission."""
import shutil
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'), args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1500, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    for filename in ['index.html', 'FreeMindAgain.html']:
        page.goto('http://127.0.0.1:8000/' + filename)
        page.evaluate('localStorage.clear()')
        page.goto('http://127.0.0.1:8000/README.md')
        page.set_content('<iframe sandbox="allow-scripts allow-same-origin allow-modals" '
                         f'src="http://127.0.0.1:8000/{filename}" '
                         'style="width:1400px;height:950px"></iframe>')
        frame = page.frames[1]
        frame.locator('#show-details').click()
        names = ['Первый', 'Второй', 'Третий']
        for i, name in enumerate(names):
            frame.locator('#child').click()
            expect(frame.locator('#rename-label')).to_have_value('Новая мысль')
            frame.locator('#rename-label').fill(name)
            if i == 1:
                frame.locator('#rename-label').press('Enter')
            else:
                frame.locator('#apply-rename').click()
            expect(frame.locator('#rename-dialog')).not_to_be_visible()
            assert frame.evaluate('model.nodes.slice(1).map(n=>n.label)') == names[:i+1]
        frame.locator('#label').fill('Заголовок из карточки')
        frame.locator('#note').fill('Изменённый комментарий')
        frame.locator('#apply-editor').click()
        expect(frame.locator('#node-title')).to_have_text('Заголовок из карточки')
        assert frame.evaluate('model.current.note') == 'Изменённый комментарий'
        current_id = frame.evaluate('model.selected')
        frame.locator('.node.root').click()
        frame.locator(f'[data-id="{current_id}"]').click()
        expect(frame.locator('#label')).to_have_value('Заголовок из карточки')
        expect(frame.locator('#note')).to_have_value('Изменённый комментарий')
        frame.locator('#label').fill('Название через Enter')
        frame.locator('#label').press('Enter')
        expect(frame.locator('#node-title')).to_have_text('Название через Enter')
        frame.locator('#note').fill('Вторая редакция\nДве строки')
        frame.locator('#apply-editor').click()
        frame.locator('#undo').click()
        expect(frame.locator('#note')).to_have_value('Изменённый комментарий')
        frame.locator('#redo').click()
        expect(frame.locator('#note')).to_have_value('Вторая редакция\nДве строки')
        frame.goto('http://127.0.0.1:8000/' + filename)
        assert frame.evaluate('model.nodes.find(n=>n.id===' + repr(current_id) + ').note') == 'Вторая редакция\nДве строки'
        print('PASS:', filename, 'sandbox dialog, repeated add, card title/note, Enter, selection, undo/redo, reload')
    assert not errors, errors
    browser.close()
