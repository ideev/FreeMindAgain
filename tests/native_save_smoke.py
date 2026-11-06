"""Test real writable file handles; substitute only the OS file picker."""
import shutil
from playwright.sync_api import sync_playwright, expect
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    page=b.new_page(accept_downloads=True)
    page.goto('http://127.0.0.1:8000/FreeMindAgain.html')
    page.on('dialog',lambda d:d.accept())
    page.evaluate('''async()=>{
      localStorage.clear();model=new Mindmap.Model();render();
      window.testDir=await navigator.storage.getDirectory();
      window.picks=0;window.cancelPicker=false;window.deny=false;
      window.showSaveFilePicker=async options=>{
        picks++;
        if(cancelPicker)throw new DOMException('Cancelled','AbortError');
        if(deny)throw new DOMException('Denied','SecurityError');
        return testDir.getFileHandle(options.suggestedName,{create:true});
      };
    }''')
    page.locator('#save').click();page.locator('#save-name').fill('Original.json');page.locator('#confirm-save').click()
    expect(page.locator('#save-dialog')).not_to_be_visible()
    assert page.evaluate('picks')==1
    page.locator('#show-details').click()
    page.locator('#label').fill('Updated');page.locator('#apply-editor').click()
    page.locator('#save').click();page.locator('#confirm-save').click()
    expect(page.locator('#save-dialog')).not_to_be_visible()
    assert page.evaluate('picks')==1
    assert page.evaluate("async()=>JSON.parse(await (await (await testDir.getFileHandle('Original.json')).getFile()).text()).nodes[0].label")=='Updated'
    page.locator('#save-as').click();page.locator('#save-name').fill('Copy.json');page.locator('#confirm-save').click()
    expect(page.locator('#save-dialog')).not_to_be_visible()
    assert page.evaluate('picks')==2
    page.evaluate('cancelPicker=true')
    page.locator('#save-as').click();page.locator('#confirm-save').click()
    expect(page.locator('#save-error')).to_contain_text('отменён')
    assert page.evaluate('fileHandle.name')=='Copy.json'
    page.locator('#cancel-save').click()
    page.evaluate('cancelPicker=false;deny=true')
    page.locator('#save-as').click();page.locator('#confirm-save').click()
    expect(page.locator('#save-error')).to_contain_text('Не удалось')
    with page.expect_download() as d:page.locator('#download-copy').click()
    assert d.value.suggested_filename=='Copy.json'
    # A write failure must not claim success or change the name/active handle.
    page.evaluate("fileHandle={name:'Copy.json',createWritable:async()=>{throw new DOMException('No write permission','NotAllowedError')}}")
    page.locator('#save').click();page.locator('#confirm-save').click()
    expect(page.locator('#save-error')).to_contain_text('No write permission')
    page.locator('#cancel-save').click()
    # Native open attaches the selected file to future saves.
    page.evaluate("window.showOpenFilePicker=async()=>[await testDir.getFileHandle('Original.json')]")
    page.locator('#open').click()
    expect(page.locator('#title')).to_have_text('Updated')
    page.wait_for_function("fileHandle?.name==='Original.json'")
    page.locator('#save').click();page.locator('#confirm-save').click()
    expect(page.locator('#save-dialog')).not_to_be_visible()
    page.locator('#new').click()
    assert page.evaluate('fileHandle===null')
    b.close()
print('PASS: real writable handles, overwrite same file, save as, cancellation, access denial, download fallback, native open, new-document reset; OS picker simulated')
