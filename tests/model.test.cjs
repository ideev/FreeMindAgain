const {test}=require('node:test');const assert=require('node:assert/strict');const {Model,validate}=require('../model.js');
test('editing, deleting a branch, undo and redo preserve full document',()=>{const m=new Model();m.rename('Проект','Описание');m.add();const branch=m.selected;m.rename('Ветка');m.add();m.rename('Лист','Заметка');const saved=JSON.stringify(m.doc);m.selected=branch;m.remove();assert.equal(m.nodes.length,1);m.undo();assert.equal(JSON.stringify(m.doc),saved);m.redo();assert.equal(m.nodes.length,1);m.undo();assert.deepEqual(validate(JSON.parse(saved)),m.doc);});
test('import validates tree and is atomic on invalid input',()=>{const m=new Model();m.add();const before=m.snapshot();const bad=structuredClone(m.doc);bad.nodes[1].parent=bad.nodes[1].id;assert.throws(()=>m.load(bad));assert.equal(m.snapshot(),before);bad.nodes[1].parent='missing';assert.throws(()=>validate(bad));bad.nodes[1].parent=null;assert.throws(()=>validate(bad));bad.nodes[1].id='root';assert.throws(()=>validate(bad));});
test('import, new map and branch movement can be undone',()=>{const m=new Model();m.add();m.add();const before=m.snapshot();m.change(()=>{for(const n of [m.current,...m.descendants(m.selected)])n.x+=100;});m.undo();assert.equal(m.snapshot(),before);const other=new Model();m.load(other.doc);assert.equal(m.nodes.length,1);m.undo();assert.equal(m.snapshot(),before);});
test('branch side change aligns all descendants including hidden nodes and is undoable',()=>{
 const m=new Model();m.add();const branch=m.current;m.add();const child=m.current;m.add();const leaf=m.current;
 m.selected=branch.id;m.add();const sibling=m.current;child.collapsed=true;
 const widths=new Map([[branch.id,130],[child.id,220],[leaf.id,95],[sibling.id,90]]);
 const before=m.snapshot(),ys=m.nodes.map(n=>n.y);
 m.change(()=>m.alignBranch(branch.id,-1,widths));
 assert.equal(child.x+220,branch.x-80);assert.equal(sibling.x+90,branch.x-80);assert.equal(leaf.x+95,child.x-80);
 assert.deepEqual(m.nodes.map(n=>n.y),ys);assert.equal(child.collapsed,true);
 m.undo();assert.equal(m.snapshot(),before);m.redo();
 m.alignBranch(branch.id,1,widths);
 assert.equal(m.nodes.find(n=>n.id===child.id).x,branch.x+130+80);
 assert.equal(m.nodes.find(n=>n.id===sibling.id).x,branch.x+130+80);
});
test('statuses default empty, survive JSON and undo, and invalid values are rejected',()=>{
 const m=new Model();assert.equal(m.current.status,'');m.add();assert.equal(m.current.status,'');
 for(const status of ['planned','in-progress','done','']){
  const before=m.current.status;m.rename('Узел','Комментарий',status);
  assert.equal(validate(JSON.parse(JSON.stringify(m.doc))).nodes[1].status,status);
  m.undo();assert.equal(m.current.status,before);m.redo();assert.equal(m.current.status,status);
 }
 const legacy=structuredClone(m.doc);legacy.nodes.forEach(n=>delete n.status);
 assert.ok(validate(legacy).nodes.every(n=>n.status===''));
 legacy.nodes[0].status='unknown';assert.throws(()=>validate(legacy));
});
test('reparent moves full subtree atomically, prevents cycles, and preserves data',()=>{
 const m=new Model();m.add();const a=m.current.id;m.rename('A','Note','done');m.add();const child=m.current.id;m.selected='root';m.add();const b=m.current.id;
 const widths=new Map(m.nodes.map(n=>[n.id,140]));const before=m.snapshot();
 m.reparent(a,b,widths);assert.equal(m.nodes.find(n=>n.id===a).parent,b);assert.equal(m.nodes.find(n=>n.id===child).parent,a);assert.equal(m.nodes.find(n=>n.id===a).status,'done');validate(m.doc);
 m.undo();assert.equal(m.snapshot(),before);m.redo();
 const after=m.snapshot();for(const [source,target]of [[b,child],[a,a],['root',b]])assert.throws(()=>m.reparent(source,target,widths));assert.equal(m.snapshot(),after);
});
