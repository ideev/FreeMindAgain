import shutil
from playwright.sync_api import sync_playwright, expect
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1450,'height':950})
    page.goto('http://127.0.0.1:8000/README.md')
    page.set_content('<iframe sandbox="allow-scripts allow-same-origin allow-modals" src="http://127.0.0.1:8000/FreeMindAgain.html" style="width:1400px;height:900px"></iframe>')
    f=page.frames[1]
    f.evaluate('''()=>{
      model=new Mindmap.Model();model.add();model.current.label='A';window.source=model.selected;model.add();model.current.label='Child';window.child=model.selected;model.selected='root';model.add();model.current.label='B';window.target=model.selected;model.current.x=-300;model.current.collapsed=true;render();fit();
    }''')
    f.evaluate('select(source)')
    before=f.evaluate('JSON.stringify(model.doc)')
    f.locator('#reparent').click()
    expect(f.locator('#reparent-message')).to_have_text('Выберите нового родителя')
    f.locator('.node',has_text='A').click()
    expect(f.locator('#reparent-message')).to_contain_text('Нельзя')
    f.locator('.node',has_text='Child').click()
    expect(f.locator('#reparent-notice')).to_be_visible()
    assert f.evaluate('JSON.stringify(model.doc)')==before
    f.locator('.node',has_text='B').click()
    expect(f.locator('#reparent-notice')).not_to_be_visible()
    assert f.evaluate('model.nodes.find(n=>n.id===source).parent===target')
    assert f.evaluate('model.nodes.find(n=>n.id===child).parent===source')
    assert f.evaluate('model.nodes.find(n=>n.id===child).x<model.nodes.find(n=>n.id===source).x')
    f.locator('#undo').click();assert f.evaluate('JSON.stringify(model.doc)')==before
    f.locator('#redo').click()
    f.locator('#reparent').click();page.keyboard.press('Escape')
    expect(f.locator('#reparent-notice')).not_to_be_visible()
    f.locator('#reparent').click();f.locator('#cancel-reparent').click()
    expect(f.locator('#reparent-notice')).not_to_be_visible()
    # Root is a valid target, but cannot itself be moved.
    f.locator('#reparent').click();f.locator('.node.root').click()
    assert f.evaluate("model.nodes.find(n=>n.id===source).parent==='root'")
    f.evaluate("select('root')")
    expect(f.locator('#reparent')).to_be_disabled()
    f.goto('http://127.0.0.1:8000/FreeMindAgain.html')
    assert f.evaluate("model.nodes.find(n=>n.label==='A').parent==='root'")
    b.close()
print('PASS: sandbox choose parent, self/descendant rejection, subtree and left layout, undo/redo, Esc/button cancel, root target/protection, reload')
