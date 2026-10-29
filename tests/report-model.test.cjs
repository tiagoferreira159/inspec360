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

test('laudo antigo com registro fotográfico recriado como subitem recupera as fotos sem alterar textos',()=>{
 const r=data();r.sections=[{area:{id:'a',name:'Portaria',order:0},items:[{item:{id:'i',name:'Pisos',status:'Conforme'},findings:[],photos:[{id:'p',caption:'Piso da portaria'}]}]}];
 const saved={version:1,sections:[{id:'intro',title:'Considerações Iniciais',body:'Texto preservado',enabled:true,kind:'text',children:[{id:'registro',title:'Registro Fotográfico',body:'Texto do usuário',enabled:true,kind:'text',children:[]}]}]};
 const before=JSON.stringify(saved),doc=studio.normalize(saved,r);assert.equal(doc.version,2);assert.equal(doc.sections[0].children[0].kind,'photos');assert.equal(doc.sections[0].children[0].body,'Texto do usuário');assert.equal(JSON.stringify(saved),before);
 const blocks=studio.compose(r,doc);assert.equal(blocks.filter(b=>b.type==='photos').flatMap(b=>b.photos).length,1);assert(blocks.some(b=>b.text==='Texto do usuário'));assert(blocks.some(b=>b.anchor==='item_i'));
});
test('migração não duplica vínculo existente e respeita exclusões e escolhas da versão nova',()=>{
 const r=data(),raw={version:1,sections:[{id:'one',title:'Registro Fotográfico',kind:'text',enabled:true,children:[]},{id:'two',title:'Vistoria',kind:'photos',enabled:true,children:[]}]};
 assert.equal(studio.normalize(raw,r).sections.filter(n=>n.kind==='photos').length,1);
 raw.sections[1].enabled=false;assert.equal(studio.normalize(raw,r).sections[0].kind,'text');
 raw.version=2;raw.sections=raw.sections.slice(0,1);assert.equal(studio.normalize(raw,r).sections[0].kind,'text');
});

test('imagens da capa e marcas aceitam apenas dados de imagens e limitam dimensões e alinhamento',()=>{
 const r=data(),image='data:image/png;base64,aGVsbG8=';
 const doc=studio.normalize({coverImage:image,headerImage:'https://example.test/logo.png',footerImage:'data:image/svg+xml;base64,aGVsbG8=',coverImageHeight:999,headerImageWidth:999,footerImageWidth:-1,headerImageAlign:'left;display:none',footerImageAlign:'right'},r);
 assert.equal(doc.coverImage,image);assert.equal(doc.headerImage,'');assert.equal(doc.footerImage,'');assert.equal(doc.coverImageHeight,150);assert.equal(doc.headerImageWidth,176);assert.equal(doc.footerImageWidth,15);assert.equal(doc.headerImageAlign,'center');assert.equal(doc.footerImageAlign,'right');
 const old=studio.normalize({version:2,sections:studio.defaults(r).sections},r);assert.equal(old.coverImage,'');assert.equal(old.headerImage,'');assert.equal(old.footerImage,'');
});
