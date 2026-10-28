/* Editor e paginação do laudo. Dados persistidos em inspections.payload.reportDoc. */
(() => {
'use strict';
const FONTS=['Arial','Calibri','Times New Roman','Georgia','Verdana','Courier New'];
const TITLES=['Introdução','Considerações Iniciais','Identificação','Realização do Laudo','Datas das Vistorias','Ficha Técnica','Registro Fotográfico','Metodologia','Critério Utilizado','Prioridades','Documentação Analisada','Ordem das Prioridades – Grau de Prioridade','Conclusão','Encerramento','Anexos'];
const clone=v=>JSON.parse(JSON.stringify(v));
const ordered=arr=>arr.slice().sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0)||String(a.id).localeCompare(String(b.id)));
const color=(v,f)=>/^#[0-9a-f]{6}$/i.test(v||'')?v:f;
const number=(v,min,max,f)=>Number.isFinite(Number(v))?Math.min(max,Math.max(min,Number(v))):f;
const text=v=>String(v??'');
let editor=null, areaDraft=null;
const assets=new Map();
function section(title,body='',kind='text'){return {id:uid(),title,body,kind,enabled:true,children:[]};}
function defaults(r){
  const sections=TITLES.map(t=>section(t));
  sections[0].body=r.i.objective||'';
  sections[2].kind='identification';
  sections[4].body=r.i.date?dateStr(r.i.date):'';
  sections[5].kind='technical';
  sections[6].kind='photos';
  sections[7].body=r.profile.methodology||'';
  return {version:2,title:r.profile.reportTitle||'LAUDO TÉCNICO DE INSPEÇÃO PREDIAL',propertyType:r.i.propertyType||r.condo?.propertyType||'',columns:2,fontFamily:'Arial',fontSize:11,headingSize:16,textColor:'#172638',headingColor:'#12355b',header:r.profile.company||r.condo?.name||'Inspec360',footer:[r.i.engineer||r.profile.engineer,r.i.crea||r.profile.crea].filter(Boolean).join(' · '),toc:true,sections};
}
function normalize(value,r){
  const base=defaults(r),raw=value&&typeof value==='object'?value:{};
  const result={...base,...raw};
  result.title=text(result.title).slice(0,250);result.propertyType=text(result.propertyType).slice(0,150);
  result.header=text(result.header).replace(/\s+/g,' ').slice(0,150);result.footer=text(result.footer).replace(/\s+/g,' ').slice(0,150);
  result.columns=[1,2,3].includes(Number(result.columns))?Number(result.columns):2;
  result.fontFamily=FONTS.includes(result.fontFamily)?result.fontFamily:'Arial';
  result.fontSize=number(result.fontSize,8,24,11);result.headingSize=number(result.headingSize,12,32,16);
  result.textColor=color(result.textColor,'#172638');result.headingColor=color(result.headingColor,'#12355b');result.toc=result.toc!==false;
  const ids=new Set();
  function nodes(list,depth=1){
    if(depth>6||!Array.isArray(list))return [];
    return list.map(n=>{
      let id=/^[a-zA-Z0-9_-]+$/.test(n.id||'')?n.id:uid();if(ids.has(id))id=uid();ids.add(id);
      return {id,title:text(n.title).slice(0,180),body:text(n.body),enabled:n.enabled!==false,kind:['text','photos','identification','technical'].includes(n.kind)?n.kind:'text',children:nodes(n.children,depth+1)};
    });
  }
  result.sections=nodes(Array.isArray(raw.sections)?raw.sections:base.sections);
  // Versão 1 permitia recriar Registro Fotográfico como texto, perdendo o vínculo.
  // Recupera somente esse vínculo em documentos antigos, sem mudar corpo/ordem/IDs.
  if(Number(raw.version||1)<2){
    const all=[];const visit=list=>{for(const n of list){all.push(n);visit(n.children);}};visit(result.sections);
    if(!all.some(n=>n.kind==='photos')){
      const match=all.find(n=>n.title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR')==='registro fotografico');
      if(match)match.kind='photos';
    }
  }
  result.version=2;
  return result;
}
function findNode(id,list=editor.draft.sections,parent=null,depth=1){
  for(let index=0;index<list.length;index++){
    const node=list[index];if(node.id===id)return {node,list,index,parent,depth};
    const found=findNode(id,node.children,node,depth+1);if(found)return found;
  }return null;
}
function optionField(key,label,type='text'){
  const value=editor.draft[key],disabled=canEdit()?'':'disabled';
  if(key==='fontFamily')return `<div class="field"><label for="rp-${key}">${label}</label><select id="rp-${key}" data-report-option="${key}" ${disabled}>${FONTS.map(v=>`<option ${v===value?'selected':''}>${v}</option>`).join('')}</select></div>`;
  if(key==='columns')return `<div class="field"><label for="rp-columns">${label}</label><select id="rp-columns" data-report-option="columns" ${disabled}>${[1,2,3].map(v=>`<option value="${v}" ${Number(value)===v?'selected':''}>${v} foto${v>1?'s':''} por linha</option>`).join('')}</select></div>`;
  return `<div class="field"><label for="rp-${key}">${label}</label><input id="rp-${key}" data-report-option="${key}" type="${type}" value="${esc(value)}" ${type==='number'?`min="${key==='fontSize'?8:12}" max="${key==='fontSize'?24:32}" step="1"`:''} ${['title','propertyType','header','footer'].includes(key)?`maxlength="${key==='title'?250:150}"`:''} ${disabled}></div>`;
}
function outlineHTML(nodes=editor.draft.sections,depth=1,prefix=''){
  return nodes.map((n,i)=>{const label=prefix+(i+1);return `<button type="button" data-action="reportChoose" data-id="${esc(n.id)}" aria-current="${editor.selected===n.id}" style="padding-left:${8+(depth-1)*13}px" class="${n.enabled?'':'re-excluded'}">${label}. ${esc(n.title||'Sem título')}</button>${outlineHTML(n.children,depth+1,label+'.')}`;}).join('');
}
function selectedHTML(){
  const found=findNode(editor.selected);if(!found)return '<p class="hint">Adicione ou selecione um tópico.</p>';
  const {node,depth}=found,disabled=canEdit()?'':'disabled';
  return `<h3>Conteúdo do tópico</h3><div class="field"><label for="rp-section-title">Título do tópico</label><input id="rp-section-title" maxlength="180" data-section-field="title" value="${esc(node.title)}" ${disabled}></div><div class="field"><label for="rp-section-kind">Conteúdo automático deste tópico</label><select id="rp-section-kind" data-section-field="kind" ${disabled}>${[['text','Somente o texto preenchido'],['photos','Ambientes, itens, constatações e fotos da inspeção'],['identification','Identificação do imóvel'],['technical','Dados do responsável técnico']].map(([value,label])=>`<option value="${value}" ${node.kind===value?'selected':''}>${label}</option>`).join('')}</select></div><label><input type="checkbox" data-section-field="enabled" ${node.enabled?'checked':''} ${disabled}> Incluir este tópico e seus subitens no laudo</label><div class="field" style="margin-top:12px"><label for="rp-section-body">Texto do tópico</label><textarea id="rp-section-body" data-section-field="body" ${disabled}>${esc(node.body)}</textarea></div>${node.kind!=='text'?`<p class="hint">${({photos:'As áreas, os itens, as constatações e as fotos desta inspeção serão incluídos automaticamente, na ordem cadastrada.',identification:'A identificação do empreendimento e o tipo do imóvel serão incluídos automaticamente.',technical:'Os dados cadastrados do responsável técnico serão incluídos automaticamente.'})[node.kind]}</p>`:''}${canEdit()?`<div class="row">${depth<6?btn('+ Subitem','reportAddChild','','sm'):''}${btn('↑ Subir','reportMoveUp','','sm')}${btn('↓ Descer','reportMoveDown','','sm')}${btn('Excluir tópico','reportDelete','','sm danger')}</div>`:''}`;
}
function renderWorkbench(){
  const host=$('#report-workbench');if(!host||!editor)return;
  const r=reportData(editor.inspection.id),photoCount=r.sections.reduce((n,a)=>n+a.items.reduce((n,i)=>n+i.photos.length,0),0);
  const photoTopics=activePhotoTopics(editor.draft.sections);
  host.innerHTML=`<p class="${photoCount&&!photoTopics.length?'alert':'hint'}">${photoCount} foto(s) cadastrada(s) nesta inspeção. ${photoTopics.length?'Inclusão automática em: '+photoTopics.map(n=>esc(n.title)).join(', ')+'.':'Para incluir as fotos no laudo, selecione um tópico e escolha “Ambientes, itens, constatações e fotos da inspeção” em “Conteúdo automático deste tópico”.'}</p><div class="grid2">${optionField('title','Título do laudo')}${optionField('propertyType','Tipo do imóvel (preenchimento livre)')}</div><details class="re-options"><summary>Formatação, fotografias, cabeçalho e rodapé</summary><div class="grid3">${optionField('columns','Fotografias por linha')}${optionField('fontFamily','Fonte dos textos')}${optionField('fontSize','Tamanho do texto (pt)','number')}${optionField('headingSize','Tamanho dos títulos (pt)','number')}${optionField('textColor','Cor dos textos','color')}${optionField('headingColor','Cor dos títulos','color')}</div><div class="grid2">${optionField('header','Cabeçalho das páginas')}${optionField('footer','Rodapé das páginas')}</div><label><input type="checkbox" data-report-option="toc" ${editor.draft.toc?'checked':''} ${canEdit()?'':'disabled'}> Incluir sumário com páginas</label></details><div class="re-toolbar">${canEdit()?btn('Salvar laudo','reportSave','','primary'):''}${btn('Pré-visualizar páginas','previewReport')}${btn('Gerar Word (.docx)','exportDocx')}${btn('Imprimir / salvar PDF','printReport')}${canEdit()?btn('+ Tópico','reportAddRoot'):''}${isAdmin()?btn('Salvar como modelo padrão','reportSaveTemplate'):''}${canEdit()?btn('Restaurar tópicos padrão','reportReset'):''}</div><p class="hint">As alterações são salvas por inspeção. O PDF usa as páginas da pré-visualização; na impressão, selecione A4, escala 100% e desative cabeçalhos/rodapés do navegador. No Word, atualize o sumário e os campos (F9) se editar o documento.</p><div class="re-layout"><div id="report-outline" class="re-outline">${outlineHTML()}</div><div class="re-section">${selectedHTML()}</div></div>`;
}
function status(message,error=false){const node=$('#report-status');if(node){node.textContent=message;node.setAttribute('role',error?'alert':'status');}}
function dirty(){editor.dirty=true;status('Há alterações ainda não salvas.');}
function openEditor(id){
  const r=reportData(id);state.inspectionId=id;
  for(const url of assets.values())URL.revokeObjectURL(url);assets.clear();
  const inherited=r.profile.reportTemplate?{...clone(r.profile.reportTemplate),propertyType:r.i.propertyType||r.condo?.propertyType||''}:null;
  editor={inspection:r.i,draft:normalize(r.i.reportDoc||inherited,r),selected:null,busy:false,dirty:!r.i.reportDoc||Number(r.i.reportDoc.version||1)<2};editor.selected=editor.draft.sections[0]?.id;
  modal('Editor do laudo — '+r.i.title,'<div id="report-workbench"></div><p id="report-status" class="re-status" role="status"></p><div id="report-preview"><p class="hint">Clique em Pré-visualizar páginas para conferir o sumário e a paginação.</p></div>',null,null,true);
  $('#modal-form').dataset.allowViewer='true';$('#modal-form').onsubmit=e=>{e.preventDefault();if(canEdit())run(saveDraft);};
  renderWorkbench();status(editor.dirty?'Modelo carregado. Salve para vinculá-lo a esta inspeção.':'Configurações do laudo carregadas.');
}
function activePhotoTopics(nodes){return nodes.flatMap(n=>n.enabled?[...(n.kind==='photos'?[n]:[]),...activePhotoTopics(n.children)]:[]);}
function validateDraft(){
  const normalized=normalize(editor.draft,reportData(editor.inspection.id));
  if(!normalized.title.trim())throw Error('Preencha o título do laudo.');
  const check=nodes=>{for(const n of nodes){if(!n.enabled)continue;if(!n.title.trim())throw Error('Preencha o título de todos os tópicos incluídos.');check(n.children);}};check(normalized.sections);
  if(activePhotoTopics(normalized.sections).length>1)throw Error('Escolha apenas um tópico para incluir automaticamente os ambientes, itens e fotografias, evitando fotos repetidas.');
  editor.draft=normalized;return normalized;
}
async function saveDraft(){
  if(!canEdit())return;
  validateDraft();
  const value={...editor.inspection,reportDoc:clone(editor.draft)};
  await put('inspections',value);editor.inspection=value;
  await load();editor.inspection=by('inspections',value.id);editor.dirty=false;status('Laudo salvo na nuvem.');
}
async function run(operation){
  if(!editor||editor.busy)return;
  editor.busy=true;
  const fields=$('#report-workbench')?.querySelectorAll('input,textarea,select,button')||[];fields.forEach(n=>n.disabled=true);
  status('Processando…');
  try{await operation();}catch(e){status(e.message,true);toast(e.message);}finally{if(editor){editor.busy=false;renderWorkbench();}}
}
async function persist(){validateDraft();if(canEdit()&&editor.dirty)await saveDraft();}
function choose(id){editor.selected=id;renderWorkbench();}
function addTopic(child=false){if(!canEdit())return;const current=findNode(editor.selected);if(child&&(!current||current.depth>=6))return;const n=section(child?'Novo subitem':'Novo tópico');(child?current.node.children:editor.draft.sections).push(n);editor.selected=n.id;dirty();renderWorkbench();}
function moveTopic(delta){if(!canEdit())return;const f=findNode(editor.selected);if(!f)return;const j=f.index+delta;if(j<0||j>=f.list.length)return;[f.list[j],f.list[f.index]]=[f.list[f.index],f.list[j]];dirty();renderWorkbench();}
function removeTopic(){if(!canEdit())return;const f=findNode(editor.selected);if(!f||!confirm('Excluir este tópico e seus subitens do modelo deste laudo? A alteração será aplicada ao salvar.'))return;f.list.splice(f.index,1);editor.selected=f.parent?.id||editor.draft.sections[0]?.id;dirty();renderWorkbench();}
async function saveTemplate(){
  if(!isAdmin())throw Error('Somente administrador.');validateDraft();
  const profile=by('settings','profile')||{id:'profile'};
  const template=clone(editor.draft);template.propertyType='';
  await put('settings',{...profile,reportTemplate:template});await load();status('Modelo padrão salvo. Será aplicado a inspeções sem laudo configurado.');
}
function reset(){if(!canEdit()||!confirm('Substituir os tópicos e a formatação deste laudo pelo padrão inicial? Você poderá revisar antes de salvar.'))return;editor.draft=defaults(reportData(editor.inspection.id));editor.selected=editor.draft.sections[0]?.id;dirty();renderWorkbench();}
function asset(photo){const key=photo.id||photo.name;if(!assets.has(key))assets.set(key,URL.createObjectURL(photo.blob));return assets.get(key);}
function compose(r,doc){
  const blocks=[];let photoNumber=0;
  const paragraph=(value,empty=false)=>{const lines=text(value).split(/\r?\n/);for(const line of lines)if(line.trim())blocks.push({type:'paragraph',text:line,empty});};
  const heading=(title,level,anchor)=>blocks.push({type:'heading',text:title,level:Math.min(6,level),anchor});
  const kv=(label,value)=>paragraph(label+': '+(value||'Não informado'));
  function walk(nodes,prefix='',depth=1,start=0){
    let position=start;
    for(const n of nodes){if(!n.enabled)continue;const index=prefix+(++position),anchor='topic_'+n.id;heading(index+'. '+n.title,depth,anchor);
      if(n.body.trim())paragraph(n.body);
      else if(n.kind==='text')paragraph('[Conteúdo não preenchido pelo responsável.]',true);
      let generated=0;
      if(n.kind==='identification'){
        kv('Empreendimento',r.condo?.name);kv('Tipo do imóvel',doc.propertyType);kv('Endereço',[r.condo?.address,r.condo?.neighborhood,r.condo?.city,r.condo?.state].filter(Boolean).join(' · '));kv('Identificação da inspeção',r.i.title);kv('Síndico / responsável',r.condo?.manager);
      }
      if(n.kind==='technical'){
        kv('Responsável técnico',r.i.engineer||r.profile.engineer);kv('Registro profissional',r.i.crea||r.profile.crea);kv('Empresa / escritório',r.profile.company);kv('Contato',r.profile.contact);
      }
      if(n.kind==='photos'){
        for(const {area,items} of r.sections.slice().sort((a,b)=>(Number(a.area.order)||0)-(Number(b.area.order)||0)||String(a.area.id).localeCompare(String(b.area.id)))){const areaIndex=index+'.'+(++generated);heading(areaIndex+'. '+area.name,depth+1,'area_'+area.id);if(area.location)kv('Local',area.location);if(area.notes)paragraph(area.notes);
          for(let i=0;i<items.length;i++){
            const entry=items[i],item=entry.item;heading(areaIndex+'.'+(i+1)+'. '+item.name,depth+2,'item_'+item.id);kv('Resultado',item.status);if(item.notes)kv('Observações',item.notes);
            for(const f of entry.findings){paragraph(f.title||'Constatação');if(f.description)paragraph(f.description);kv('Classificação',f.classification);kv('Prioridade',f.priority);if(f.recommendation)kv('Recomendação técnica',f.recommendation);}
            const photos=entry.photos.map(p=>({photo:p,number:++photoNumber,caption:text(p.caption||area.name+' — '+item.name)}));
            for(let j=0;j<photos.length;j+=doc.columns){const row=photos.slice(j,j+doc.columns);blocks.push({type:'photos',photos:row,columns:doc.columns});for(const p of row)if(p.caption.length>180)paragraph('Legenda completa da foto '+p.number+': '+p.caption);}
          }
        }
        if(!r.sections.length)paragraph('Nenhum ambiente cadastrado nesta inspeção.');
      }
      walk(n.children,index+'.',depth+1,generated);
    }
  }
  walk(doc.sections);return blocks;
}
function variables(doc){return `--rp-font:'${doc.fontFamily}';--rp-size:${doc.fontSize}pt;--rp-color:${doc.textColor};--rp-heading-color:${doc.headingColor};--rp-heading-size:${doc.headingSize}pt;--rp-h2:${Math.max(doc.fontSize,doc.headingSize-2)}pt;--rp-h3:${Math.max(doc.fontSize,doc.headingSize-4)}pt;--rp-cover-size:${Math.min(32,doc.headingSize+10)}pt;--rp-caption-size:${Math.max(8,Math.min(13,doc.fontSize-1))}pt;`;}
function blockNode(b,doc){
  const el=document.createElement(b.type==='heading'?'h'+b.level:b.type==='paragraph'?'p':'div');
  if(b.type==='heading'){el.textContent=b.text;if(b.anchor){el.id=b.anchor;el.dataset.anchor=b.anchor;}}
  if(b.type==='paragraph'){el.textContent=b.text;if(b.empty)el.className='rp-empty';}
  if(b.type==='toc'){
    el.className='rp-toc-row';el.style.paddingLeft=(Math.min(5,b.level-1)*4)+'mm';
    el.innerHTML=`<a href="#${esc(b.anchor)}">${esc(b.text)}</a><span class="rp-dots"></span><span class="rp-page-ref">${b.page}</span>`;
  }
  if(b.type==='photos'){
    el.className='rp-photo-row';el.style.setProperty('--rp-cols',b.columns);el.style.setProperty('--rp-photo-height',({1:85,2:62,3:48})[b.columns]+'mm');
    el.innerHTML=b.photos.map(p=>`<figure><img alt="Foto ${p.number}" src="${asset(p.photo)}"><figcaption>Foto ${String(p.number).padStart(3,'0')} — ${esc(p.caption.slice(0,180)+(p.caption.length>180?'…':''))}</figcaption></figure>`).join('');
  }
  return el;
}
function pageShell(doc){const page=document.createElement('section');page.className='rp-page';page.style.cssText=variables(doc);const content=document.createElement('div');content.className='rp-content';page.append(content);return {page,content,blocks:[]};}
function fits(content){const last=content.lastElementChild;return !last||last.getBoundingClientRect().bottom+parseFloat(getComputedStyle(last).marginBottom||0)<=content.getBoundingClientRect().bottom-8;}
function textPiece(content,b,doc){
  const chars=Array.from(b.text);let low=0,high=chars.length;
  const node=blockNode({...b,text:''},doc);content.append(node);
  while(low<high){const mid=Math.ceil((low+high)/2);node.textContent=chars.slice(0,mid).join('');if(fits(content))low=mid;else high=mid-1;}
  node.remove();if(low===0)return null;
  let prefix=chars.slice(0,low).join('');const space=prefix.lastIndexOf(' ');if(space>prefix.length*.65)prefix=prefix.slice(0,space);
  const consumed=Array.from(prefix).length;
  return {head:{...b,text:prefix},tail:{...b,text:chars.slice(consumed).join('').replace(/^\s+/,'')}};
}
function paginate(blocks,doc,host){
  const pages=[];let current=pageShell(doc);host.append(current.page);pages.push(current);
  const fresh=()=>{current=pageShell(doc);host.append(current.page);pages.push(current);};
  const queue=blocks.slice();let guard=0;
  while(queue.length){if(++guard>30000)throw Error('O documento é muito grande para paginar. Reduza o conteúdo e tente novamente.');
    const b=queue.shift(),node=blockNode(b,doc);current.content.append(node);
    if(fits(current.content)){current.blocks.push(b);continue;}
    node.remove();
    // Evita deixar título sozinho no final da página.
    const last=current.blocks.at(-1);
    if(last?.type==='heading'&&current.blocks.length>1){current.blocks.pop();current.content.lastElementChild.remove();fresh();queue.unshift(last,b);continue;}
    if(b.type==='paragraph'){
      const piece=textPiece(current.content,b,doc);
      if(piece&&(current.blocks.length===0||piece.head.text.length>=100)){
        current.content.append(blockNode(piece.head,doc));current.blocks.push(piece.head);if(piece.tail.text){fresh();queue.unshift(piece.tail);}continue;
      }
    }
    if(current.blocks.length){fresh();queue.unshift(b);continue;}
    throw Error('Um bloco não cabe em uma página. Reduza o tamanho da fonte ou a legenda da fotografia.');
  }
  return pages;
}
function coverNode(r,doc){const el=document.createElement('div');el.className='rp-cover';el.innerHTML=`${r.profile.logo?`<img src="${esc(r.profile.logo)}" alt="Logomarca">`:'<strong>INSPEC360</strong>'}<h1>${esc(doc.title)}</h1><h2>${esc(r.condo?.name||'Empreendimento')}</h2><p><b>Tipo do imóvel:</b> ${esc(doc.propertyType||'Não informado')}</p><p>${esc([r.condo?.address,r.condo?.city,r.condo?.state].filter(Boolean).join(' · '))}</p><p>${esc(r.i.title)}</p><p>Data de referência: ${esc(dateStr(r.i.date))}</p><p>Responsável técnico: ${esc(r.i.engineer||r.profile.engineer||'Não informado')}<br>Registro profissional: ${esc(r.i.crea||r.profile.crea||'Não informado')}</p>`;return el;}
async function buildPlan(r,input){
  const doc=normalize(input,r);await document.fonts?.ready;
  const host=document.createElement('div');host.className='rp-measure';document.body.append(host);
  try{
    const blocks=compose(r,doc),bodyPages=paginate(blocks,doc,host);
    const headings=[];bodyPages.forEach((p,index)=>p.blocks.forEach(b=>{if(b.type==='heading'&&b.anchor)headings.push({...b,bodyPage:index});}));
    let tocPages=[],tocCount=doc.toc?1:0,tocRows=[];
    if(doc.toc){for(let pass=0;pass<5;pass++){
      for(const p of tocPages)p.page.remove();
      tocRows=headings.map(b=>({...b,type:'toc',page:b.bodyPage+tocCount+2}));
      tocPages=paginate([{type:'heading',text:'Sumário',level:1},...tocRows],doc,host);
      if(tocPages.length===tocCount)break;tocCount=tocPages.length;
    }}
    const cover=pageShell(doc);cover.blocks=[{type:'cover'}];cover.content.append(coverNode(r,doc));host.append(cover.page);
    for(const image of cover.content.querySelectorAll('img'))await image.decode();
    const coverBounds=cover.content.getBoundingClientRect();
    if(Array.from(cover.content.firstElementChild.children).some(n=>n.getBoundingClientRect().top<coverBounds.top||n.getBoundingClientRect().bottom>coverBounds.bottom))throw Error('O conteúdo da capa excede uma página. Reduza o título ou o tamanho dos textos.');
    const pages=[cover,...tocPages,...bodyPages],pageMap={};
    pages.forEach((p,index)=>{
      p.number=index+1;p.page.dataset.page=String(index+1);
      const head=document.createElement('header');head.className='rp-header';head.textContent=doc.header;
      const foot=document.createElement('footer');foot.className='rp-footer';foot.innerHTML=`<span>${esc(doc.footer)}</span><span class="rp-counter">Página ${index+1} de ${pages.length}</span>`;
      p.page.prepend(head);p.page.append(foot);p.blocks.forEach(b=>{if(b.anchor&&b.type==='heading')pageMap[b.anchor]=index+1;});
    });
    const container=document.createElement('div');container.className='rp-pages';for(const p of pages)container.append(p.page);
    for(const image of container.querySelectorAll('img')){try{await image.decode();}catch{throw Error('Uma imagem do laudo não pôde ser carregada. Verifique as fotografias e a logomarca.');}}
    return {r,doc,pages,headings:tocRows,pageMap,element:container};
  }finally{host.remove();}
}
async function prepare(){await persist();const r=reportData(editor.inspection.id);return buildPlan(r,editor.draft);}
async function preview(){await run(async()=>{const plan=await prepare();$('#report-preview').replaceChildren(plan.element);status('Pré-visualização pronta: '+plan.pages.length+' páginas.');});}
async function print(){await run(async()=>{const plan=await prepare();$('#report-preview').replaceChildren();$('#print-host').replaceChildren(plan.element);status('Documento pronto para impressão: '+plan.pages.length+' páginas.');await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));window.print();});}
// Word: estilos, sumário nativo com cache de páginas, cabeçalhos, rodapés e tabelas de fotografias.
function wx(value){return text(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
function bookmark(anchor){return 'rpt_'+anchor.replace(/[^A-Za-z0-9_]/g,'').slice(0,35);}
function wrun(value,props=''){return `<w:r>${props?'<w:rPr>'+props+'</w:rPr>':''}<w:t xml:space="preserve">${wx(value)}</w:t></w:r>`;}
function wp(value,style='Normal',extra=''){return `<w:p><w:pPr><w:pStyle w:val="${style}"/>${extra}</w:pPr>${wrun(value)}</w:p>`;}
function wfield(instruction,cached,props=''){return `<w:fldSimple w:instr="${wx(instruction)}">${wrun(cached,props)}</w:fldSimple>`;}
async function makeDocx(plan){
  const {r,doc,pages}=plan,zip=new ZipStore(),rels=[],media=new Map();let imageIndex=0,markIndex=0;
  async function photoImage(blob,key,maxWidth,maxHeight){
    let entry=media.get(key);
    if(!entry){const converted=await convertedPhoto(blob),bitmap=await createImageBitmap(converted.blob);entry={rid:'rImg'+(++imageIndex),idx:imageIndex,width:bitmap.width,height:bitmap.height,name:'image'+imageIndex+'.'+converted.ext};bitmap.close();zip.add('word/media/'+entry.name,new Uint8Array(await converted.blob.arrayBuffer()));rels.push(`<Relationship Id="${entry.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${entry.name}"/>`);media.set(key,entry);}
    const scale=Math.min(maxWidth/entry.width,maxHeight/entry.height,1);
    return imageDrawing(entry.rid,entry.idx,Math.max(1,entry.width*scale),Math.max(1,entry.height*scale)).replace('<w:pPr>','<w:pPr><w:spacing w:before="0" w:after="0"/>');
  }
  let body='',tocStarted=false,tocEnded=false;
  // O Word usa sua paginação nativa; o sumário é um campo atualizável do documento.
  // Não impõe as quebras do navegador, pois as métricas de fonte podem diferir.
  const wordPages=[{blocks:[{type:'cover'}]},...(doc.toc?[{blocks:[{type:'heading',text:'Sumário',level:1},...plan.headings]}]:[]),{blocks:compose(r,doc)}];
  const breakPage='<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  for(let pageIndex=0;pageIndex<wordPages.length;pageIndex++){
    const page=wordPages[pageIndex];
    for(const b of page.blocks){
      if(b.type==='cover'){
        body+=wp('','Normal','<w:spacing w:before="900"/>');
        if(r.profile.logo){const mime=r.profile.logo.slice(5,r.profile.logo.indexOf(';')),blob=base64ToBlob(r.profile.logo.split(',')[1],mime);body+=await photoImage(blob,'logo',300,110);}
        body+=wp(doc.title,'Title','<w:jc w:val="center"/>')+wp(r.condo?.name||'Empreendimento','Subtitle','<w:jc w:val="center"/>');
        for(const line of ['Tipo do imóvel: '+(doc.propertyType||'Não informado'),[r.condo?.address,r.condo?.city,r.condo?.state].filter(Boolean).join(' · '),r.i.title,'Data de referência: '+dateStr(r.i.date),'Responsável técnico: '+(r.i.engineer||r.profile.engineer||'Não informado'),'Registro profissional: '+(r.i.crea||r.profile.crea||'Não informado')])body+=wp(line,'Normal','<w:jc w:val="center"/>');
      }
      if(b.type==='heading'){
        const style=b.text==='Sumário'?'TOCTitle':'Heading'+b.level;
        if(b.anchor){const n=++markIndex;body+=`<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:bookmarkStart w:id="${n}" w:name="${bookmark(b.anchor)}"/>${wrun(b.text)}<w:bookmarkEnd w:id="${n}"/></w:p>`;}
        else body+=wp(b.text,style);
      }
      if(b.type==='paragraph')body+=wp(b.text,b.empty?'Empty':'Normal');
      if(b.type==='toc'){
        if(!tocStarted){body+='<w:p><w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-6" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r></w:p>';tocStarted=true;}
        body+=`<w:p><w:pPr><w:pStyle w:val="TOC${b.level}"/><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9978"/></w:tabs><w:ind w:left="${Math.min(5,b.level-1)*200}"/></w:pPr><w:hyperlink w:anchor="${bookmark(b.anchor)}">${wrun(b.text)}</w:hyperlink><w:r><w:tab/></w:r>${wfield('PAGEREF '+bookmark(b.anchor)+' \\h',b.page)}</w:p>`;
      }
      if(b.type==='photos'){
        const width=Math.floor(9978/b.columns),height=({1:85,2:62,3:48})[b.columns]*96/25.4;
        body+=`<w:tbl><w:tblPr><w:tblW w:w="9978" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="85" w:type="dxa"/><w:bottom w:w="90" w:type="dxa"/><w:right w:w="85" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${Array.from({length:b.columns},()=>`<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr>`;
        for(let i=0;i<b.columns;i++){
          body+=`<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>`;
          const p=b.photos[i];if(p){body+=await photoImage(p.photo.blob,p.photo.id,(width-170)/15,height);body+=wp('Foto '+String(p.number).padStart(3,'0')+' — '+p.caption.slice(0,180)+(p.caption.length>180?'…':''),'Caption','<w:jc w:val="center"/>');}else body+='<w:p/>';
          body+='</w:tc>';
        }body+='</w:tr></w:tbl>';
      }
    }
    const nextHasToC=wordPages.slice(pageIndex+1).some(p=>p.blocks.some(b=>b.type==='toc'));
    if(tocStarted&&!tocEnded&&!nextHasToC){body+='<w:p><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>';tocEnded=true;}
    if(pageIndex<wordPages.length-1)body+=breakPage;
  }
  const ns='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';
  const sect='<w:sectPr><w:headerReference w:type="default" r:id="rHeader"/><w:footerReference w:type="default" r:id="rFooter"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1474" w:right="964" w:bottom="1304" w:left="964" w:header="567" w:footer="454"/><w:pgNumType w:start="1"/></w:sectPr>';
  zip.add('word/document.xml',enc.encode(`<?xml version="1.0" encoding="UTF-8"?><w:document ${ns}><w:body>${body}${sect}</w:body></w:document>`));
  const baseR=`<w:rFonts w:ascii="${wx(doc.fontFamily)}" w:hAnsi="${wx(doc.fontFamily)}" w:cs="${wx(doc.fontFamily)}"/><w:sz w:val="${Math.round(doc.fontSize*2)}"/><w:color w:val="${doc.textColor.slice(1)}"/><w:lang w:val="pt-BR"/>`;
  let styles=`<w:docDefaults><w:rPrDefault><w:rPr>${baseR}</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="100" w:line="348" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>`;
  styles+='<w:style w:type="paragraph" w:styleId="Normal" w:default="1"><w:name w:val="Normal"/></w:style>';
  for(let level=1;level<=6;level++){
    const size=level===1?doc.headingSize:Math.max(doc.fontSize,doc.headingSize-(level===2?2:4));
    styles+=`<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:outlineLvl w:val="${level-1}"/><w:spacing w:before="240" w:after="120" w:line="312" w:lineRule="auto"/></w:pPr><w:rPr><w:b/><w:sz w:val="${Math.round(size*2)}"/><w:color w:val="${doc.headingColor.slice(1)}"/></w:rPr></w:style>`;
    styles+=`<w:style w:type="paragraph" w:styleId="TOC${level}"><w:name w:val="toc ${level}"/><w:basedOn w:val="Normal"/></w:style>`;
  }
  for(const [id,size,bold,fill] of [['Title',Math.min(32,doc.headingSize+10),true,doc.headingColor],['Subtitle',doc.headingSize,true,doc.headingColor],['TOCTitle',doc.headingSize,true,doc.headingColor],['Caption',Math.max(8,Math.min(13,doc.fontSize-1)),false,doc.textColor],['Empty',doc.fontSize,false,'#64748b']])styles+=`<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${id}"/><w:basedOn w:val="Normal"/><w:rPr>${bold?'<w:b/>':''}<w:sz w:val="${Math.round(size*2)}"/><w:color w:val="${fill.slice(1)}"/></w:rPr></w:style>`;
  zip.add('word/styles.xml',enc.encode(`<?xml version="1.0" encoding="UTF-8"?><w:styles ${ns}>${styles}</w:styles>`));
  zip.add('word/settings.xml',enc.encode(`<?xml version="1.0" encoding="UTF-8"?><w:settings ${ns}><w:updateFields w:val="true"/></w:settings>`));
  const small='<w:sz w:val="18"/>';
  zip.add('word/header1.xml',enc.encode(`<?xml version="1.0" encoding="UTF-8"?><w:hdr ${ns}><w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:color="${doc.headingColor.slice(1)}"/></w:pBdr></w:pPr>${wrun(doc.header,small)}</w:p></w:hdr>`));
  zip.add('word/footer1.xml',enc.encode(`<?xml version="1.0" encoding="UTF-8"?><w:ftr ${ns}><w:tbl><w:tblPr><w:tblW w:w="9978" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="7500"/><w:gridCol w:w="2478"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="7500" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:after="0" w:line="240"/></w:pPr>${wrun(doc.footer,small)}</w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="2478" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/><w:spacing w:after="0" w:line="240"/></w:pPr>${wrun('Página ',small)}${wfield('PAGE',1,small)}${wrun(' de ',small)}${wfield('NUMPAGES',pages.length,small)}</w:p></w:tc></w:tr></w:tbl><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr><w:r><w:rPr><w:sz w:val="2"/></w:rPr><w:t></w:t></w:r></w:p></w:ftr>`));
  const relation=(id,type,target)=>`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;
  zip.add('word/_rels/document.xml.rels',enc.encode(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relation('rStyles','styles','styles.xml')}${relation('rSettings','settings','settings.xml')}${relation('rHeader','header','header1.xml')}${relation('rFooter','footer','footer1.xml')}${rels.join('')}</Relationships>`));
  zip.add('_rels/.rels',enc.encode(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relation('rDoc','officeDocument','word/document.xml')}</Relationships>`));
  const overrides=[['document.xml','document.main'],['styles.xml','styles'],['settings.xml','settings'],['header1.xml','header'],['footer1.xml','footer']].map(([part,type])=>`<Override PartName="/word/${part}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${type}+xml"/>`).join('');
  zip.add('[Content_Types].xml',enc.encode(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/>${overrides}</Types>`));
  return zip.blob('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}
async function word(){await run(async()=>{const plan=await prepare();const blob=await makeDocx(plan);download(blob,'laudo_'+safeName(plan.r.condo?.name||'inspecao')+'.docx');status('Word gerado com sumário, cabeçalho e rodapé. Atualize os campos se editar o arquivo.');});}
function showAreaOrder(){
  if(!canEdit())throw Error('Acesso somente consulta.');
  const areas=ordered(child('areas','inspectionId',state.inspectionId));if(!areas.length){toast('Cadastre uma área primeiro.');return;}
  areaDraft={inspectionId:state.inspectionId,areas};
  modal('Organizar a ordem das áreas','<p>A ordem salva será usada na inspeção, nas fotografias e no laudo.</p><div id="report-area-order"></div>','Salvar ordem',async()=>{
    await cloudRequest('/rest/v1/rpc/inspec_reorder_areas',{method:'POST',body:{p_workspace:workspaceId,p_inspection:areaDraft.inspectionId,p_ids:areaDraft.areas.map(a=>a.id),p_versions:areaDraft.areas.map(a=>a._revision)}});
    await load();closeModal();render();toast('Ordem das áreas salva.');areaDraft=null;
  });renderAreaOrder();
}
function renderAreaOrder(){const node=$('#report-area-order');if(node)node.innerHTML=areaDraft.areas.map((a,i)=>`<div class="re-order-row"><span>${i+1}. ${esc(a.name)}</span><span>${i?btn('↑','areaOrderUp',`data-id="${esc(a.id)}" aria-label="Subir ${esc(a.name)}"`,'sm'):''} ${i<areaDraft.areas.length-1?btn('↓','areaOrderDown',`data-id="${esc(a.id)}" aria-label="Descer ${esc(a.name)}"`,'sm'):''}</span></div>`).join('');}
function moveArea(id,delta){if(!areaDraft)return;const i=areaDraft.areas.findIndex(a=>a.id===id),j=i+delta;if(i<0||j<0||j>=areaDraft.areas.length)return;[areaDraft.areas[i],areaDraft.areas[j]]=[areaDraft.areas[j],areaDraft.areas[i]];renderAreaOrder();}
document.addEventListener('input',event=>{
  if(!editor||editor.busy||!canEdit()||!event.target.closest('#report-workbench'))return;
  const key=event.target.dataset.reportOption,field=event.target.dataset.sectionField;
  if(key){editor.draft[key]=event.target.type==='checkbox'?event.target.checked:event.target.value;dirty();}
  if(field){const found=findNode(editor.selected);if(found){found.node[field]=event.target.type==='checkbox'?event.target.checked:event.target.value;dirty();}}
});
document.addEventListener('change',event=>{if(event.target.dataset.sectionField==='kind'&&editor&&!editor.busy&&canEdit()){const found=findNode(editor.selected);if(found){found.node.kind=event.target.value;dirty();renderWorkbench();}return;}if(event.target.dataset.sectionField&&editor){const outline=$('#report-outline');if(outline)outline.innerHTML=outlineHTML();}});
Object.assign(actionMap,{openReport:e=>openEditor(e.dataset.id),previewReport:preview,printReport:print,exportDocx:word,reportSave:()=>run(saveDraft),reportSaveTemplate:()=>run(saveTemplate),reportChoose:e=>choose(e.dataset.id),reportAddRoot:()=>addTopic(),reportAddChild:()=>addTopic(true),reportMoveUp:()=>moveTopic(-1),reportMoveDown:()=>moveTopic(1),reportDelete:removeTopic,reportReset:reset,orderAreas:showAreaOrder,areaOrderUp:e=>moveArea(e.dataset.id,-1),areaOrderDown:e=>moveArea(e.dataset.id,1)});
reportModal=openEditor;previewReport=preview;printReport=print;exportDocx=word;
window.ReportStudio={defaults,normalize,compose,buildPlan,makeDocx,ordered,open:openEditor,save:saveDraft,getDraft:()=>editor?.draft};
})();
