'use strict';
const $=s=>document.querySelector(s),canvas=$('#canvas'),world=$('#world'),nodes=$('#nodes'),edges=$('#edges');
const storageKey='freemindagain.document.v1';let model=new Mindmap.Model(),zoom=1,pan={x:0,y:0},gesture=null,saveError='',reparentSource=null;
try{const saved=localStorage.getItem(storageKey);if(saved)model=new Mindmap.Model(JSON.parse(saved));}catch{saveError='Локальная копия недоступна или повреждена. Используйте JSON для сохранения.';}
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(model.doc));$('#status').textContent='Сохранено в браузере · '+new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});}catch{$('#status').textContent='Не удалось сохранить в браузере. Скачайте JSON-файл.';}}
function visible(n){while(n.parent){n=model.nodes.find(v=>v.id===n.parent);if(n.collapsed)return false;}return true;}
function showDetails(){ details();$('#details').hidden=false;document.querySelector('main').classList.remove('card-hidden');$('#show-details').setAttribute('aria-expanded','true'); }
function hideDetails(){ $('#details').hidden=true;document.querySelector('main').classList.add('card-hidden');$('#show-details').setAttribute('aria-expanded','false'); }
function toggleDetails(){if($('#details').hidden)showDetails();else{hideDetails();canvas.focus({preventScroll:true});}}
$('#show-details').onclick=toggleDetails;
$('#hide-details').onclick=()=>{hideDetails();canvas.focus({preventScroll:true});};
function select(id){if(reparentSource)return;model.selected=id;for(const el of nodes.children){el.classList.toggle('selected',el.dataset.id===id);el.setAttribute('aria-pressed',String(el.dataset.id===id));}details();}
function details(){const n=model.current;$('#node-title').textContent=n.label;$('#label').value=n.label;$('#note').value=n.note;$('#node-status').value=n.status||'';const ancestors=[];let p=n;while(p.parent){p=model.nodes.find(v=>v.id===p.parent);ancestors.unshift(p.label);}$('#path').textContent=ancestors.join(' / ')||'Центральная мысль';$('#reparent').disabled=!n.parent;$('#remove').disabled=!n.parent;$('#delete-node').disabled=!n.parent;$('#sibling').disabled=!n.parent;$('#collapse').disabled=!model.nodes.some(v=>v.parent===n.id);$('#collapse').textContent=n.collapsed?'Раскрыть ветку':'Свернуть ветку';$('#undo').disabled=!model.undoStack.length;$('#redo').disabled=!model.redoStack.length;$('#title').textContent=model.nodes.find(v=>!v.parent).label;$('#title').title=$('#title').textContent;}
const statusLabels={'planned':'Запланировано','in-progress':'В процессе','done':'Готово'};
const statusPaths={
 'planned':'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4m8-4v4M4 10h16m-12 4h3"/>',
 'in-progress':'<circle cx="12" cy="12" r="8" stroke-opacity=".25"/><path d="M12 4a8 8 0 0 1 8 8m-8-4v5l3 2"/>',
 'done':'<path d="m5 12 4.5 4.5L19 7"/>'
};
function statusIcon(n){
 if(!n.status)return null;
 const icon=document.createElement('span');icon.className='node-status '+n.status;icon.title=statusLabels[n.status];icon.setAttribute('aria-hidden','true');
 icon.innerHTML='<svg viewBox="0 0 24 24" focusable="false">'+statusPaths[n.status]+'</svg>';
 return icon;
}
function render(save=true){nodes.replaceChildren();for(const n of model.nodes.filter(visible)){const el=document.createElement('div');el.className='node'+(!n.parent?' root':model.nodes.some(v=>v.parent===n.id)?' group':'')+(n.id===model.selected?' selected':'');el.dataset.id=n.id;el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-label',n.label+(n.status?' — '+statusLabels[n.status]:''));el.setAttribute('aria-pressed',String(n.id===model.selected));el.style.setProperty('--color',n.color);const text=document.createElement('span');text.textContent=n.label;const icon=statusIcon(n);if(icon)el.append(icon);el.append(text);if(model.nodes.some(v=>v.parent===n.id)){const toggle=document.createElement('span');toggle.className='toggle'+(n.collapsed?' collapsed':'');toggle.setAttribute('aria-hidden','true');el.setAttribute('aria-expanded',String(!n.collapsed));toggle.onpointerdown=e=>e.stopPropagation();toggle.onclick=e=>{e.stopPropagation();select(n.id);model.change(()=>n.collapsed=!n.collapsed);render();};el.append(toggle);}el.onfocus=()=>select(n.id);nodes.append(el);}position();details();if(save)persist();}
function branchSide(n,widths){
 const root=model.nodes.find(v=>!v.parent);
 if(!n.parent)return 0;
 return n.x+(widths.get(n.id)||0)/2<root.x+(widths.get(root.id)||0)/2?-1:1;
}
function nodeWidths(){
 const widths=new Map([...nodes.children].map(el=>[el.dataset.id,el.offsetWidth]));
 for(const n of model.nodes){
  if(widths.has(n.id))continue;
  const el=document.createElement('div');
  el.className='node'+(!n.parent?' root':model.nodes.some(v=>v.parent===n.id)?' group':'');
  el.style.visibility='hidden';const icon=statusIcon(n);if(icon)el.append(icon);el.append(document.createTextNode(n.label));
  if(model.nodes.some(v=>v.parent===n.id)){const t=document.createElement('span');t.className='toggle collapsed';el.append(t);}
  nodes.append(el);widths.set(n.id,el.offsetWidth);el.remove();
 }
 return widths;
}
function position(){const els=new Map([...nodes.children].map(el=>[el.dataset.id,el])),widths=new Map([...els].map(([id,el])=>[id,el.offsetWidth]));for(const n of model.nodes){const el=els.get(n.id);if(el){el.style.left=n.x+'px';el.style.top=n.y+'px';el.style.textAlign=branchSide(n,widths)<0?'right':'left';if(!n.parent)el.style.textAlign='center';}}edges.replaceChildren();for(const n of model.nodes.filter(n=>n.parent&&els.has(n.id))){const p=model.nodes.find(v=>v.id===n.parent),a=els.get(p.id),b=els.get(n.id);if(!a)continue;const right=n.x+b.offsetWidth/2>=p.x+a.offsetWidth/2,x1=p.x+(right?a.offsetWidth:0),x2=n.x+(right?0:b.offsetWidth),y1=p.y+a.offsetHeight*.75,y2=n.y+b.offsetHeight*.75,bend=Math.max(35,Math.abs(x2-x1)*.45),s=right?1:-1,path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',`M ${x1} ${y1} C ${x1+s*bend} ${y1} ${x2-s*bend} ${y2} ${x2} ${y2}`);path.setAttribute('fill','none');path.setAttribute('stroke',n.color);path.setAttribute('stroke-width','2');edges.append(path);}}
function transform(){world.style.transform=`translate(${pan.x}px,${pan.y}px) scale(${zoom})`;$('#scale').value=Math.round(zoom*100)+'%';}
function fit(){const els=[...nodes.children],left=Math.min(...els.map(el=>parseFloat(el.style.left))),top=Math.min(...els.map(el=>parseFloat(el.style.top))),right=Math.max(...els.map(el=>parseFloat(el.style.left)+el.offsetWidth)),bottom=Math.max(...els.map(el=>parseFloat(el.style.top)+el.offsetHeight));zoom=Math.max(.03,Math.min(1,(canvas.clientWidth-80)/(right-left),(canvas.clientHeight-190)/(bottom-top)));pan={x:(canvas.clientWidth-(right-left)*zoom)/2-left*zoom,y:105+(canvas.clientHeight-185-(bottom-top)*zoom)/2-top*zoom};transform();}
function zoomAt(factor,x=canvas.clientWidth/2,y=canvas.clientHeight/2){const z=Math.max(.03,Math.min(3,zoom*factor));pan={x:x-(x-pan.x)*z/zoom,y:y-(y-pan.y)*z/zoom};zoom=z;transform();}
let renameTarget=null;
function rename(){
 const dialog=$('#rename-dialog');
 if(dialog.open)return;
 renameTarget=model.selected;
 $('#rename-form').reset();
 $('#rename-label').setCustomValidity('');
 const input=$('#rename-label');
 input.value=model.current.label;
 dialog.showModal();input.focus();input.select();
}
function closeRename(){
 const target=renameTarget;
 renameTarget=null;
 $('#rename-dialog').close();
 $('#rename-form').reset();
 // Closing a native dialog restores focus, which can select an older node.
 if(target&&model.nodes.some(n=>n.id===target))model.selected=target;
 render();
 const el=[...nodes.children].find(n=>n.dataset.id===model.selected);
 el?.focus({preventScroll:true});
}
function add(sibling=false){
 model.add(sibling);render(false);
 const n=model.current,p=model.nodes.find(v=>v.id===n.parent),widths=nodeWidths(),side=branchSide(n,widths);
 n.x=side<0?p.x-80-widths.get(n.id):p.x+widths.get(p.id)+80;
 position();persist();rename();
}
function applyRename(){
 if(!$('#rename-dialog').open||!renameTarget)return;
 const input=$('#rename-label');
 if(!input.reportValidity())return;
 try{
  model.selected=renameTarget;
  model.rename(input.value);
  closeRename();
 }catch(err){input.setCustomValidity(err.message);input.reportValidity();}
}
$('#apply-rename').onclick=applyRename;
$('#rename-form').onsubmit=e=>{e.preventDefault();applyRename();};
$('#rename-label').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();applyRename();}});
$('#rename-label').addEventListener('input',e=>e.target.setCustomValidity(''));
$('#cancel-rename').onclick=closeRename;
$('#rename-dialog').addEventListener('cancel',e=>{e.preventDefault();closeRename();});
function applyEditor(){
 if(!$('#editor').reportValidity())return;
 try{model.rename($('#label').value,$('#note').value,$('#node-status').value);render();}catch(err){alert(err.message);}
}
$('#apply-editor').onclick=applyEditor;
$('#editor').onsubmit=e=>{e.preventDefault();applyEditor();};
$('#label').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();applyEditor();}});
$('#add').onclick=$('#child').onclick=()=>add();$('#sibling').onclick=()=>add(true);function removeSelected(){
 if(!model.current.parent)return;
 if(confirm('Удалить «'+model.current.label+'» и все дочерние ветки? Действие можно отменить.')){model.remove();render();}
}
$('#remove').onclick=$('#delete-node').onclick=removeSelected;
$('#collapse').onclick=()=>{model.change(()=>model.current.collapsed=!model.current.collapsed);render();};
$('#undo').onclick=()=>{fileHandle=null;model.undo();render();};$('#redo').onclick=()=>{fileHandle=null;model.redo();render();};
$('#new').onclick=()=>{if(confirm('Создать новую карту? Текущую можно предварительно сохранить в JSON. Действие можно отменить.')){fileHandle=null;model.load(Mindmap.fresh());render();fit();}};
let fileHandle=null,saveAs=false,saving=false;
const nativeFiles=()=>window.isSecureContext&&typeof window.showSaveFilePicker==='function';
function showSave(as=false){
 saveAs=as;
 const input=$('#save-name');
 input.setCustomValidity('');input.value=fileHandle?.name||model.doc.fileName||Mindmap.fileName(model.nodes.find(n=>!n.parent).label);
 $('#save-error').textContent='';
 $('#save-method').textContent=nativeFiles()?(fileHandle&&!as?'После подтверждения будет обновлён выбранный файл. Измените имя, чтобы выбрать другой файл.':'Выберите папку и файл в системном окне. Следующие сохранения будут обновлять этот файл.'):'Прямой доступ к файлам недоступен. JSON будет скачан средствами браузера.';
 $('#save-dialog').showModal();input.focus();input.select();
}
$('#save').onclick=()=>showSave();$('#save-as').onclick=()=>showSave(true);
function downloadDocument(name){
 const doc={...model.doc,fileName:name};
 const blob=new Blob([JSON.stringify(doc,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 model.doc.fileName=name;persist();$('#save-dialog').close();
}
async function saveDocument(download=false){
 if(saving)return;
 const input=$('#save-name');if(!input.reportValidity())return;
 let name;try{name=Mindmap.fileName(input.value);}catch(err){input.setCustomValidity(err.message);input.reportValidity();return;}
 if(download||!nativeFiles()){downloadDocument(name);return;}
 saving=true;$('#confirm-save').disabled=true;$('#download-copy').disabled=true;$('#cancel-save').disabled=true;
 let writable;
 try{
  let handle=fileHandle;
  if(saveAs||!handle||handle.name!==name){
   handle=await window.showSaveFilePicker({suggestedName:name,types:[{description:'Карта FreeMindAgain (JSON)',accept:{'application/json':['.json']}}]});
  }
  const doc={...model.doc,fileName:handle.name};
  writable=await handle.createWritable();
  await writable.write(JSON.stringify(doc,null,2));await writable.close();writable=null;
  fileHandle=handle;model.doc.fileName=handle.name;persist();$('#save-dialog').close();
  $('#status').textContent='Файл сохранён: '+handle.name;
 }catch(err){
  if(writable)try{await writable.abort();}catch{}
  if(err.name==='AbortError')$('#save-error').textContent='Выбор файла отменён. Файл не изменён.';
  else $('#save-error').textContent='Не удалось записать файл: '+err.message+' Можно повторить или скачать копию JSON.';
 }finally{saving=false;$('#confirm-save').disabled=false;$('#download-copy').disabled=false;$('#cancel-save').disabled=false;}
}
$('#confirm-save').onclick=()=>saveDocument();$('#download-copy').onclick=()=>saveDocument(true);
$('#cancel-save').onclick=()=>$('#save-dialog').close();
$('#save-dialog').addEventListener('cancel',e=>{if(saving)e.preventDefault();});
$('#save-name').addEventListener('input',e=>e.target.setCustomValidity(''));
$('#save-name').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();saveDocument();}});
async function openDocument(file,handle=null){
 try{
  if(file.size>10*1024*1024)throw Error('Файл больше 10 МБ.');
  const doc=Mindmap.validate(JSON.parse(await file.text()));
  if(handle||!doc.fileName)doc.fileName=Mindmap.fileName(file.name);
  if(confirm('Открыть карту из файла? Текущую карту можно будет вернуть отменой.')){cancelReparent();model.load(doc);fileHandle=handle;render();fit();}
 }catch(err){alert('Не удалось открыть карту: '+err.message);}
}
$('#open').onclick=async()=>{
 if(window.isSecureContext&&typeof window.showOpenFilePicker==='function'){
  try{const [handle]=await window.showOpenFilePicker({multiple:false,types:[{description:'Карта JSON',accept:{'application/json':['.json']}}]});await openDocument(await handle.getFile(),handle);return;}
  catch(err){if(err.name==='AbortError')return;}
 }
 $('#file').click();
};
$('#file').onchange=async e=>{const file=e.target.files[0];if(file)await openDocument(file);e.target.value='';};
function cancelReparent(){
 reparentSource=null;$('#reparent-notice').hidden=true;canvas.classList.remove('choosing-parent');
 for(const el of nodes.children)el.classList.remove('reparent-source');
}
$('#reparent').onclick=()=>{
 if(reparentSource){cancelReparent();return;}
 if(!model.current.parent)return;
 reparentSource=model.selected;$('#reparent-message').textContent='Выберите нового родителя';
 $('#reparent-notice').hidden=false;canvas.classList.add('choosing-parent');
 for(const el of nodes.children)el.classList.toggle('reparent-source',el.dataset.id===reparentSource);
};
$('#cancel-reparent').onclick=cancelReparent;
// Cancel the mode before other toolbar/card actions can change the document.
document.addEventListener('click',e=>{
 if(reparentSource&&e.target.closest('button')&&!e.target.closest('#reparent,#cancel-reparent,#canvas,.zoom'))cancelReparent();
},true);
canvas.addEventListener('click',e=>{
 if(!reparentSource)return;
 const el=e.target.closest('.node');if(!el)return;
 e.preventDefault();e.stopImmediatePropagation();
 try{
  model.reparent(reparentSource,el.dataset.id,nodeWidths());cancelReparent();render();fit();
 }catch(err){$('#reparent-message').textContent=err.message+' Выберите нового родителя';}
},true);
// Pointer capture retargets native clicks to the canvas. Hit-test the pointer
// location so a double click still reaches the node under the cursor.
canvas.ondblclick=e=>{
 if(reparentSource)return;
 const hit=document.elementFromPoint(e.clientX,e.clientY);
 if(!hit||hit.closest('.toggle'))return;
 const el=hit.closest('.node');if(!el)return;
 select(el.dataset.id);const n=model.current;
 if(model.nodes.some(v=>v.parent===n.id)){model.change(()=>n.collapsed=!n.collapsed);render();}
 else showDetails();
};
canvas.onpointerdown=e=>{if(reparentSource&&e.target.closest('.node')){e.preventDefault();return;}if(e.button!==0||e.target.closest('.toggle'))return;const el=e.target.closest('.node');if(el)select(el.dataset.id);gesture={id:e.pointerId,x:e.clientX,y:e.clientY,pan:{...pan},before:model.snapshot(),side:el?branchSide(model.current,nodeWidths()):0,items:el?[model.current,...model.descendants(model.selected)].map(n=>({n,x:n.x,y:n.y})):null};canvas.setPointerCapture(e.pointerId);e.preventDefault();};
canvas.onpointermove=e=>{if(!gesture||gesture.id!==e.pointerId)return;const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;if(gesture.items){for(const v of gesture.items){v.n.x=v.x+dx/zoom;v.n.y=v.y+dy/zoom;}position();}else{pan={x:gesture.pan.x+dx,y:gesture.pan.y+dy};transform();}};
function end(e){if(!gesture||e.pointerId!==gesture.id)return;const g=gesture;gesture=null;if(e.type==='pointercancel'){model.restore(g.before);render(false);}else if(g.items){
 const moved=g.items[0].n,widths=nodeWidths();
 if(e.type==='pointerup'&&moved.parent&&Math.hypot(e.clientX-g.x,e.clientY-g.y)>3){
  const root=model.nodes.find(n=>!n.parent);
  const side=moved.x+widths.get(moved.id)/2<root.x+widths.get(root.id)/2?-1:1;
  if(side!==g.side)model.alignBranch(moved.id,side,widths);
 }
 position();model.record(g.before);details();persist();
}else if(e.type==='pointerup'&&Math.hypot(e.clientX-g.x,e.clientY-g.y)<3){hideDetails();}
}
canvas.onpointerup=end;canvas.onpointercancel=end;canvas.onlostpointercapture=end;
canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();zoomAt(Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top);},{passive:false});
$('#in').onclick=()=>zoomAt(1.2);$('#out').onclick=()=>zoomAt(1/1.2);$('#fit').onclick=fit;
$('#show-help').onclick=()=>$('#help-dialog').showModal();
$('#close-help').onclick=()=>$('#help-dialog').close();
document.addEventListener('keydown',e=>{
 if(reparentSource){if(e.key==='Escape'){e.preventDefault();cancelReparent();}return;}
 if(document.querySelector('dialog[open]')||gesture||toolbarDrag||e.isComposing||e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;
 if(e.key==='F3'){e.preventDefault();toggleDetails();return;}
 if(e.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])'))return;
 if(e.key==='F2'){e.preventDefault();rename();}

 else if(e.key==='+'||e.key==='Insert'){e.preventDefault();add();}
 else if(e.key==='-'||e.key==='−'||e.key==='Delete'){e.preventDefault();removeSelected();}
});
const toolPanel=$('#tool-panel'),toolbarHandle=$('#toolbar-handle'),toolbarKey='freemindagain.toolbar.v1';
let toolbarPosition=null,toolbarDrag=null;
try{const v=JSON.parse(localStorage.getItem(toolbarKey));if(v&&Number.isFinite(v.x)&&Number.isFinite(v.y))toolbarPosition={x:Math.max(0,Math.min(1,v.x)),y:Math.max(0,Math.min(1,v.y))};}catch{}
function panelBounds(){return {x:Math.max(0,canvas.clientWidth-toolPanel.offsetWidth-16),y:Math.max(0,canvas.clientHeight-toolPanel.offsetHeight-16)};}
function placeToolbar(){
 if(!toolbarPosition)return;
 const max=panelBounds();toolPanel.style.left=Math.max(0,toolbarPosition.x*max.x)+'px';toolPanel.style.top=Math.max(0,toolbarPosition.y*max.y)+'px';toolPanel.style.right='auto';
}
function moveToolbar(x,y){
 const max=panelBounds();x=Math.max(0,Math.min(max.x,x));y=Math.max(0,Math.min(max.y,y));
 toolbarPosition={x:max.x?x/max.x:0,y:max.y?y/max.y:0};placeToolbar();
}
function saveToolbar(){try{localStorage.setItem(toolbarKey,JSON.stringify(toolbarPosition));}catch{}}
toolbarHandle.onpointerdown=e=>{
 if(e.button!==0)return;e.preventDefault();
 toolbarDrag={id:e.pointerId,x:e.clientX,y:e.clientY,left:toolPanel.offsetLeft,top:toolPanel.offsetTop,before:toolbarPosition&&{...toolbarPosition}};
 toolbarHandle.setPointerCapture(e.pointerId);toolPanel.classList.add('dragging');
};
toolbarHandle.onpointermove=e=>{
 if(!toolbarDrag||e.pointerId!==toolbarDrag.id)return;
 moveToolbar(toolbarDrag.left+e.clientX-toolbarDrag.x,toolbarDrag.top+e.clientY-toolbarDrag.y);
};
function endToolbar(e){
 if(!toolbarDrag||e.pointerId!==toolbarDrag.id)return;
 const g=toolbarDrag;toolbarDrag=null;toolPanel.classList.remove('dragging');
 if(e.type==='pointercancel'){
  toolbarPosition=g.before;
  if(toolbarPosition)placeToolbar();else{toolPanel.style.left='';toolPanel.style.top='';toolPanel.style.right='';}
 }else saveToolbar();
}
toolbarHandle.onpointerup=endToolbar;toolbarHandle.onpointercancel=endToolbar;toolbarHandle.onlostpointercapture=endToolbar;
toolbarHandle.addEventListener('keydown',e=>{
 const steps={ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,-12],ArrowDown:[0,12]};
 if(!steps[e.key])return;e.preventDefault();e.stopPropagation();
 const [dx,dy]=steps[e.key];moveToolbar(toolPanel.offsetLeft+dx,toolPanel.offsetTop+dy);saveToolbar();
});
new ResizeObserver(()=>{position();fit();placeToolbar();}).observe(canvas);hideDetails();render(false);fit();placeToolbar();if(saveError)$('#status').textContent=saveError;else persist();
