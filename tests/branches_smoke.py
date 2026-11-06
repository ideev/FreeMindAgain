"""Test the standalone page in a preview without form permissions."""
import shutil
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1500,'height':1000})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:8000/README.md')
    page.set_content('<iframe sandbox="allow-scripts allow-same-origin allow-modals" src="http://127.0.0.1:8000/FreeMindAgain.html" style="width:1450px;height:950px"></iframe>')
    f=page.frames[1]
    f.evaluate('''() => {
      const ns=[
        {id:'root',parent:null,label:'Карта',x:0,y:0},
        {id:'b',parent:'root',label:'Группа',x:300,y:0},
        {id:'c',parent:'b',label:'Длинная дочерняя группа',x:600,y:-70},
        {id:'s',parent:'b',label:'Узел',x:600,y:80},
        {id:'h',parent:'c',label:'Скрытый потомок',x:900,y:-70}
      ].map(n=>({...n,note:'',collapsed:n.id==='c',color:'#688b50'}));
      model.load({format:'FreeMindAgain',version:1,nodes:ns});render();fit();
    }''')
    group=f.locator('[data-id="b"]')
    group.dblclick()
    expect(f.locator('[data-id="c"]')).to_have_count(0)
    expect(f.locator('#rename-dialog')).not_to_be_visible()
    group.dblclick()
    expect(f.locator('[data-id="c"]')).to_have_count(1)
    expect(f.locator('[data-id="h"]')).to_have_count(0)
    before=f.evaluate('JSON.stringify(model.doc)')
    # Drag relative to the displayed root, using real pointer events.
    def drag_to(side):
        f.locator('#fit').click()
        b=group.bounding_box();r=f.locator('[data-id="root"]').bounding_box()
        x=b['x']+b['width']/2;y=b['y']+b['height']/2
        page.mouse.move(x,y);page.mouse.down()
        page.mouse.move(r['x']+r['width']/2+side*150,y,steps=15);page.mouse.up()
    drag_to(-1)
    assert f.evaluate('''() => {
      const ns=new Map(model.nodes.map(n=>[n.id,n])),w=nodeWidths();
      return ns.get('c').x+w.get('c')===ns.get('b').x-80 &&
        ns.get('s').x+w.get('s')===ns.get('b').x-80 &&
        ns.get('h').x+w.get('h')===ns.get('c').x-80;
    }''')
    assert group.evaluate('(el)=>getComputedStyle(el).textAlign')=='right'
    assert f.locator('[data-id="c"]').evaluate('(el)=>getComputedStyle(el).textAlign')=='right'
    f.locator('#undo').click()
    assert f.evaluate('JSON.stringify(model.doc)')==before
    f.locator('#redo').click()
    drag_to(1)
    assert f.evaluate('''() => {
      const ns=new Map(model.nodes.map(n=>[n.id,n])),w=nodeWidths();
      return ns.get('c').x===ns.get('b').x+w.get('b')+80 &&
        ns.get('s').x===ns.get('c').x &&
        ns.get('h').x===ns.get('c').x+w.get('c')+80;
    }''')
    assert group.evaluate('(el)=>getComputedStyle(el).textAlign')=='left'
    f.locator('#fit').click()
    f.locator('[data-id="c"]').dblclick()
    expect(f.locator('[data-id="h"]')).to_have_count(1)
    # The artifact must have no external scripts or stylesheets.
    assert f.locator('script[src],link[rel="stylesheet"]').count()==0
    assert not errors,errors
    browser.close()
print('PASS: standalone sandbox, double-click collapse/expand, left/right drag, hidden descendants, edge alignment, undo/redo')
