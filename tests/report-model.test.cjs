const fs=require('node:fs');
const vm=require('node:vm');
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
let sequence=0;
const context={window:{},document:{addEventListener(){}},actionMap:{},uid:()=>`node_${++sequence}`,
  reportModal(){},previewReport(){},printReport(){},exportDocx(){},dateStr:v=>v};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../report-studio.js'),'utf8'),context);
const studio=context.window.ReportStudio;
const plain=v=>JSON.parse(JSON.stringify(v));
const data=()=>({i:{id:'inspection1',title:'Vistoria',date:'2026-10-27',objective:'Escopo informado'},condo:{name:'Imóvel',propertyType:'Residencial'},profile:{},sections:[]});

test('modelo inclui todos os tópicos solicitados e não inventa conclusão técnica',()=>{
  const doc=studio.defaults(data());
  assert.equal(doc.sections.length,15);
  for(const title of ['Introdução','Considerações Iniciais','Identificação','Realização do Laudo','Datas das Vistorias','Ficha Técnica','Registro Fotográfico','Metodologia','Critério Utilizado','Prioridades','Documentação Analisada','Ordem das Prioridades – Grau de Prioridade','Conclusão','Encerramento','Anexos'])assert(doc.sections.some(s=>s.title===title));
  assert.equal(doc.sections.find(s=>s.title==='Conclusão').body,'');
  assert.equal(doc.propertyType,'Residencial');
});
test('configuração inválida não injeta CSS e IDs duplicados são normalizados',()=>{
  const r=data(),doc=studio.normalize({fontFamily:'Arial;display:none',textColor:'red;background:black',fontSize:999,columns:8,sections:[{id:'same',title:'A',children:[]},{id:'same',title:'B',children:[]}]},r);
  assert.equal(doc.fontFamily,'Arial');assert.equal(doc.textColor,'#172638');assert.equal(doc.fontSize,24);assert.equal(doc.columns,2);assert.notEqual(doc.sections[0].id,doc.sections[1].id);
});
test('subitens recebem numeração hierárquica e tópicos excluídos não são exportados',()=>{
  const r=data(),doc=studio.defaults(r);
  doc.sections=[{id:'one',title:'Principal',body:'Texto',enabled:true,kind:'text',children:[{id:'sub',title:'Detalhe',body:'Subtexto',enabled:true,kind:'text',children:[]}]},{id:'hidden',title:'Oculto',enabled:false,body:'Não exportar',children:[]}];
  const blocks=plain(studio.compose(r,doc));assert.deepEqual(blocks.filter(b=>b.type==='heading').map(b=>b.text),['1. Principal','1.1. Detalhe']);assert(!blocks.some(b=>b.text==='Não exportar'));
});
test('áreas ordenadas são refletidas no registro fotográfico e três fotos formam uma linha',()=>{
  const r=data();r.sections=[{area:{id:'b',name:'B',order:2},items:[]},{area:{id:'a',name:'A',order:1},items:[{item:{id:'it',name:'Item',status:'Conforme'},findings:[],photos:Array.from({length:4},(_,i)=>({id:'p'+i,caption:'Foto '+i}))}]}];
  const doc=studio.defaults(r);doc.columns=3;
  const blocks=plain(studio.compose(r,doc));assert.deepEqual(blocks.filter(b=>b.anchor?.startsWith('area_')).map(b=>b.text),['7.1. A','7.2. B']);assert.deepEqual(blocks.filter(b=>b.type==='photos').map(b=>b.photos.length),[3,1]);
});
test('ordenação não modifica a lista original e preserva a posição zero',()=>{
  const source=[{id:'b',order:2},{id:'a',order:0}];assert.deepEqual(plain(studio.ordered(source)).map(x=>x.id),['a','b']);assert.deepEqual(source.map(x=>x.id),['b','a']);
});
