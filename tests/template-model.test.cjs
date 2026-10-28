const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const test=require('node:test'),assert=require('node:assert/strict');
function fixture(role='admin'){
 let n=0,failAt=0,writes=0;const db={settings:[],areas:[],items:[],inspections:[{id:'i',title:'Teste'}]};
 const c={window:{},BASIC:['Portaria'],BASIC_ITEMS:['Pisos','Estruturas'],uid:()=>`id${++n}`,actionMap:{},renderTemplates(){},applyTemplate(){},state:{inspectionId:'i'},D:structuredClone(db),isAdmin:()=>role==='admin',canEdit:()=>role!=='viewer',toast(){},render(){},
  by:(kind,id)=>c.D[kind].find(x=>x.id===id),child:(kind,field,id)=>c.D[kind].filter(x=>x[field]===id),
  load:async()=>{c.D=structuredClone(db)},put:async(kind,obj)=>{writes++;if(writes===failAt)throw Error('conexão interrompida');const existing=db[kind].find(x=>x.id===obj.id);if(existing)Object.assign(existing,structuredClone(obj));else db[kind].push(structuredClone(obj));}
 };vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../template-studio.js'),'utf8'),c);
 return {c,api:c.window.InspectionTemplates,db,failNextAt:n=>{failAt=n}};
}
const model=()=>({id:'m',type:'inspectionTemplate',name:'Comercial',areas:[{id:'a',name:'Portaria',items:[{id:'x',name:'Pisos'},{id:'y',name:'Iluminação'}]},{id:'b',name:'Elevadores',items:[{id:'z',name:'Cabine'}]}]});
test('modelo suporta itens diferentes em cada ambiente e rejeita duplicidades normalizadas',()=>{
 const {api}=fixture();assert.equal(api.valid(model()).areas[1].items.length,1);const m=model();m.areas[0].items.push({name:' PISOS '});assert.throws(()=>api.valid(m),/repetidos/);m.areas=[];assert.throws(()=>api.valid(m),/ambiente/);
});
test('aplicar acrescenta apenas ausentes e preserva status, ordem e fotografias',async()=>{
 const {api,db,c}=fixture();db.settings.push(model());db.areas.push({id:'old',inspectionId:'i',name:' portaria ',order:7});db.items.push({id:'existing',inspectionId:'i',areaId:'old',name:'PISOS',status:'Conforme',order:3,photo:'preservada'});
 await c.load();await api.apply('m','i');assert.equal(db.areas.length,2);assert.equal(db.areas[1].order,8);assert.equal(db.items.length,3);assert.equal(db.items[0].status,'Conforme');assert.equal(db.items[0].photo,'preservada');assert.equal(db.items[1].order,4);
 await api.apply('m','i');assert.equal(db.areas.length,2);assert.equal(db.items.length,3);
});
test('repetir após falha parcial conclui sem duplicar ambientes ou itens',async()=>{
 const {api,db,c,failNextAt}=fixture();db.settings.push(model());await c.load();failNextAt(3);await assert.rejects(()=>api.apply('m','i'),/aplicar novamente/);assert.equal(db.items.length,1);await api.apply('m','i');assert.equal(db.areas.length,2);assert.equal(db.items.length,3);
});
test('consulta não aplica modelos e editor não abre edição de modelos',async()=>{
 const viewer=fixture('viewer');await assert.rejects(()=>viewer.api.apply('basic','i'),/consulta/);assert.throws(()=>viewer.api.open(),/administrador/);
 const editor=fixture('editor');assert.throws(()=>editor.api.open(),/administrador/);await editor.api.apply('basic','i');assert.equal(editor.db.items.length,2);
});
