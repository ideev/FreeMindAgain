(function(global){
'use strict';
const statuses=['','planned','in-progress','done'];
const colors=['#688b50','#be8149','#6d87ad','#ad7291'];
function fresh(){return {format:'FreeMindAgain',version:1,nodes:[{id:'root',parent:null,label:'Новая карта',note:'',status:'',x:0,y:0,color:colors[0],collapsed:false}]};}
function fileName(value){
 const name=String(value).trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').replace(/[. ]+$/g,'').slice(0,180);
 if(!name)throw Error('Введите имя файла.');
 return /\.json$/i.test(name)?name:name+'.json';
}
function validate(value){
 if(!value||value.format!=='FreeMindAgain'||value.version!==1||!Array.isArray(value.nodes)||!value.nodes.length||value.nodes.length>5000)throw Error('Ожидается документ FreeMindAgain версии 1 (до 5000 узлов).');
 const ids=new Set();let roots=0;
 const nodes=value.nodes.map(n=>{if(!n||typeof n.id!=='string'||!n.id||ids.has(n.id)||!(n.parent===null||typeof n.parent==='string')||typeof n.label!=='string'||!n.label.trim()||n.label.length>500||!Number.isFinite(n.x)||!Number.isFinite(n.y)||Math.abs(n.x)>1e7||Math.abs(n.y)>1e7)throw Error('Некорректные данные узла.');if(n.status!=null&&!statuses.includes(n.status))throw Error('Неизвестный статус узла.');ids.add(n.id);if(n.parent===null)roots++;return {id:n.id,parent:n.parent,label:n.label,note:typeof n.note==='string'?n.note.slice(0,100000):'',status:n.status||'',x:n.x,y:n.y,color:/^#[0-9a-f]{6}$/i.test(n.color)?n.color:colors[0],collapsed:!!n.collapsed};});
 if(roots!==1)throw Error('Карта должна содержать один корневой узел.');
 const byId=new Map(nodes.map(n=>[n.id,n]));for(const n of nodes){const seen=new Set([n.id]);let p=n.parent;while(p!==null){if(!byId.has(p)||seen.has(p))throw Error('Нарушена структура дерева.');seen.add(p);p=byId.get(p).parent;}}
 return {format:'FreeMindAgain',version:1,nodes,...(typeof value.fileName==='string'&&value.fileName.trim()?{fileName:fileName(value.fileName)}:{})};
}
class Model{
 constructor(doc=fresh()){this.doc=validate(doc);this.selected=this.doc.nodes[0].id;this.undoStack=[];this.redoStack=[];}
 get nodes(){return this.doc.nodes;} get current(){return this.nodes.find(n=>n.id===this.selected);}
 descendants(id){const result=[],queue=[id];while(queue.length){const parent=queue.shift();for(const n of this.nodes)if(n.parent===parent){result.push(n);queue.push(n.id);}}return result;}
 snapshot(){return JSON.stringify({doc:this.doc,selected:this.selected});}
 restore(s){const v=JSON.parse(s);this.doc=v.doc;this.selected=v.selected;}
 record(before){if(before===this.snapshot())return;this.undoStack.push(before);if(this.undoStack.length>100)this.undoStack.shift();this.redoStack=[];}
 change(fn){const before=this.snapshot();fn();this.record(before);}
 undo(){if(!this.undoStack.length)return;this.redoStack.push(this.snapshot());this.restore(this.undoStack.pop());}
 redo(){if(!this.redoStack.length)return;this.undoStack.push(this.snapshot());this.restore(this.redoStack.pop());}
 add(sibling=false){this.change(()=>{let p=this.current;if(sibling&&p.parent)p=this.nodes.find(n=>n.id===p.parent);const count=this.nodes.filter(n=>n.parent===p.id).length;const side=p.parent?(p.x<this.nodes.find(n=>n.parent===null).x?-1:1):(count%2?-1:1);const n={id:global.crypto.randomUUID(),parent:p.id,label:'Новая мысль',note:'',status:'',x:p.x+side*260,y:p.y+Math.floor(count/(p.parent?1:2))*85-40,color:p.parent?p.color:colors[count%colors.length],collapsed:false};p.collapsed=false;this.nodes.push(n);this.selected=n.id;});}
 // Align each level by its edge nearest the parent, including collapsed nodes.
 alignBranch(id,side,widths){
  const queue=[this.nodes.find(n=>n.id===id)];
  while(queue.length){
   const parent=queue.shift();
   for(const child of this.nodes.filter(n=>n.parent===parent.id)){
    child.x=side<0?parent.x-80-widths.get(child.id):parent.x+widths.get(parent.id)+80;
    queue.push(child);
   }
  }
 }
 reparent(id,parentId,widths){
  const n=this.nodes.find(v=>v.id===id),parent=this.nodes.find(v=>v.id===parentId);
  if(!n||!parent||!n.parent)throw Error('Корневой узел нельзя переподчинить.');
  const branch=[n,...this.descendants(id)];
  if(branch.some(v=>v.id===parentId))throw Error('Нельзя выбрать сам узел или его потомка.');
  if(n.parent===parentId)return;
  this.change(()=>{
   const siblings=this.nodes.filter(v=>v.parent===parentId&&v.id!==id);
   const root=this.nodes.find(v=>!v.parent);
   const side=parent.parent?(parent.x+widths.get(parent.id)/2<root.x+widths.get(root.id)/2?-1:1):(n.x+widths.get(n.id)/2<root.x+widths.get(root.id)/2?-1:1);
   const bottom=siblings.flatMap(v=>[v,...this.descendants(v.id)]);
   const y=bottom.length?Math.max(...bottom.map(v=>v.y))+85:parent.y;
   const dy=y-n.y;for(const v of branch){v.y+=dy;if(parent.parent)v.color=parent.color;}
   n.parent=parentId;parent.collapsed=false;
   n.x=side<0?parent.x-80-widths.get(n.id):parent.x+widths.get(parent.id)+80;
   this.alignBranch(id,side,widths);this.selected=id;
  });
 }
 remove(){if(!this.current.parent)return;this.change(()=>{const n=this.current,ids=new Set([n.id,...this.descendants(n.id).map(v=>v.id)]);this.doc.nodes=this.nodes.filter(v=>!ids.has(v.id));this.selected=n.parent;});}
 rename(label,note=this.current.note,status=this.current.status){if(!statuses.includes(status))throw Error('Неизвестный статус узла.');label=label.trim();if(!label||label.length>500)throw Error('Введите название длиной от 1 до 500 символов.');this.change(()=>Object.assign(this.current,{label,note,status}));}
 load(value){const doc=validate(value);this.change(()=>{this.doc=doc;this.selected=doc.nodes.find(n=>n.parent===null).id;});}
}
global.Mindmap={Model,fresh,validate,fileName};if(typeof module!=='undefined')module.exports=global.Mindmap;
})(globalThis);
