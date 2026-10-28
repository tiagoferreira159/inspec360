/* Modelos de inspeção da organização. Reutiliza persistência e revisões do cloud.js. */
(() => {
'use strict';
const key=s=>String(s||'').trim().normalize('NFKC').toLocaleLowerCase('pt-BR');
const copy=v=>JSON.parse(JSON.stringify(v));
const initial=()=>({id:'basic',name:'Condomínio residencial — modelo inicial',description:'Estrutura inicial. Duplique para personalizar.',areas:BASIC.map(name=>({id:uid(),name,items:BASIC_ITEMS.map(name=>({id:uid(),name}))}))});
const models=()=>[initial(),...(D.settings||[]).filter(x=>x.type==='inspectionTemplate').sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'))];
const find=id=>id==='basic'?initial():(D.settings||[]).find(x=>x.id===id&&x.type==='inspectionTemplate');
let draft=null,selected=null,busy=false;
function admin(){if(!isAdmin())throw Error('Somente o administrador pode alterar modelos da organização.');}
function valid(model){
 if(!model.name?.trim())throw Error('Informe o nome do modelo.');
 if(!model.areas.length)throw Error('Adicione pelo menos um ambiente.');
 const names=new Set();
 for(const a of model.areas){
  if(!key(a.name))throw Error('Informe o nome de todos os ambientes.');
  if(names.has(key(a.name)))throw Error('Use nomes diferentes para os ambientes.');names.add(key(a.name));
  if(!a.items.length)throw Error('Adicione pelo menos um item em '+a.name+'.');
  const items=new Set();for(const i of a.items){if(!key(i.name))throw Error('Preencha todos os itens de '+a.name+'.');if(items.has(key(i.name)))throw Error('Há itens repetidos em '+a.name+'.');items.add(key(i.name));}
 }
 return model;
}
const attr=id=>`data-id="${esc(id)}"`;
renderTemplates=function(){return `<div class="card"><div class="row between"><div><h2>Seus modelos de inspeção</h2><p class="hint">Crie ambientes e itens específicos para cada modelo. As alterações nos modelos não modificam inspeções existentes.</p></div>${isAdmin()?btn('+ Novo modelo','templateNew','','primary'):''}</div>${!isAdmin()?'<p class="hint">O administrador cadastra e edita modelos. Engenheiros e editores podem aplicá-los nas inspeções.</p>':''}</div><div class="grid2">${models().map(m=>`<div class="card"><h3>${esc(m.name)}</h3><p>${esc(m.description||'')}</p><p class="hint">${m.areas.length} ambientes · ${m.areas.reduce((n,a)=>n+a.items.length,0)} itens de verificação</p><details><summary>Consultar ambientes e itens</summary>${m.areas.map(a=>`<h4>${esc(a.name)}</h4><ul>${a.items.map(i=>`<li>${esc(i.name)}</li>`).join('')}</ul>`).join('')}</details><div class="row" style="margin-top:16px">${isAdmin()?`${m.id!=='basic'?btn('Editar modelo','templateEdit',attr(m.id)):''}${btn('Duplicar e personalizar','templateDuplicate',attr(m.id))}${m.id!=='basic'?btn('Excluir','templateDelete',attr(m.id),'danger'):''}`:''}${canEdit()?btn('Aplicar em uma inspeção','templateChooseInspection',attr(m.id)):''}</div></div>`).join('')}</div>`};
function open(id,duplicate=false){
 admin();const source=id?find(id):null;if(id&&!source)throw Error('Modelo não encontrado. Atualize os dados.');
 draft=source?copy(source):{id:'template-'+uid(),type:'inspectionTemplate',name:'',description:'',areas:[]};
 if(duplicate){draft.id='template-'+uid();delete draft._revision;draft.name=source.name+' — cópia';}
 draft.type='inspectionTemplate';selected=draft.areas[0]?.id||null;
 modal(duplicate?'Duplicar modelo':source?'Editar modelo':'Novo modelo','<div id="template-editor"></div>','Salvar modelo',async()=>{
  admin();capture();valid(draft);const saved=copy(draft);saved.name=saved.name.trim();saved.areas.forEach(a=>{a.name=a.name.trim();a.items.forEach(i=>i.name=i.name.trim())});
  await put('settings',saved);await load();draft=null;closeModal();render();toast('Modelo salvo no banco de dados.');
 },true);draw();
}
function capture(){if(!draft)return;const host=$('#template-editor');if(!host)return;draft.name=host.querySelector('[name=templateName]').value;draft.description=host.querySelector('[name=templateDescription]').value;const a=draft.areas.find(x=>x.id===selected);if(a){const name=host.querySelector('[name=areaName]');if(name)a.name=name.value;host.querySelectorAll('[data-template-item]').forEach(input=>{const i=a.items.find(i=>i.id===input.dataset.templateItem);if(i)i.name=input.value;});}}
function draw(){
 const a=draft.areas.find(x=>x.id===selected);$('#template-editor').innerHTML=`${field('templateName','Nome do modelo',draft.name,'text',true)}${field('templateDescription','Descrição',draft.description,'textarea')}<p class="hint">Selecione um ambiente à esquerda para adicionar seus itens à direita. As setas definem a ordem.</p><div class="grid2"><section><div class="row between"><h3>Ambientes</h3>${btn('+ Ambiente','templateAddArea','','sm')}</div>${draft.areas.map((a,n)=>`<div style="border:1px solid var(--line);padding:8px;margin-bottom:8px;border-radius:8px;${a.id===selected?'background:#edf3ff':''}"><div class="row">${btn(esc(a.name||'Novo ambiente'),'templateSelectArea',attr(a.id),'sm')}${btn('↑','templateMoveArea',`${attr(a.id)} data-dir="-1" aria-label="Subir ambiente"`,'sm')}${btn('↓','templateMoveArea',`${attr(a.id)} data-dir="1" aria-label="Descer ambiente"`,'sm')}${btn('Excluir','templateRemoveArea',attr(a.id),'sm')}</div><span class="hint">${n+1}. ${a.items.length} itens</span></div>`).join('')||'<p class="hint">Clique em + Ambiente para começar.</p>'}</section><section><h3>Itens do ambiente selecionado</h3>${a?`${field('areaName','Nome do ambiente',a.name,'text',true)}${a.items.map((i,n)=>`<div style="border-bottom:1px solid var(--line);padding:8px 0"><label class="field"><span>Item ${n+1}</span><input required data-template-item="${esc(i.id)}" value="${esc(i.name)}" aria-label="Item ${n+1}"></label><div class="row">${btn('↑','templateMoveItem',`${attr(i.id)} data-dir="-1" aria-label="Subir item"`,'sm')}${btn('↓','templateMoveItem',`${attr(i.id)} data-dir="1" aria-label="Descer item"`,'sm')}${btn('Excluir item','templateRemoveItem',attr(i.id),'sm')}</div></div>`).join('')}<div style="margin-top:12px">${btn('+ Item de verificação','templateAddItem','','primary')}</div>`:'<p class="hint">Adicione ou selecione um ambiente.</p>'}</section></div>`;
}
function edit(change){admin();if(!draft)throw Error('Abra um modelo primeiro.');capture();change();draw();}
function move(arr,id,dir){const n=arr.findIndex(x=>x.id===id),j=n+Number(dir);if(n>=0&&j>=0&&j<arr.length)[arr[n],arr[j]]=[arr[j],arr[n]];}
function choose(id,inspectionId){
 if(!canEdit())throw Error('Acesso somente consulta.');
 const list=id?[find(id)].filter(Boolean):models();if(!list.length)throw Error('Modelo não encontrado.');
 const inspections=D.inspections||[];if(!inspections.length){toast('Cadastre uma inspeção antes de aplicar um modelo.');return;}
 modal('Aplicar modelo à inspeção',`${select('templateId','Modelo',list.map(m=>[m.id,m.name]),id||'basic')}${select('inspectionId','Inspeção',inspections.map(i=>[i.id,i.title]),inspectionId||inspections[0].id)}<p class="hint">Serão adicionados somente ambientes e itens ausentes. Avaliações, fotos e observações existentes serão preservadas. Você pode aplicar mais de um modelo à mesma inspeção.</p>`,'Aplicar modelo',async v=>{
  await apply(v.templateId,v.inspectionId);closeModal();state.inspectionId=v.inspectionId;state.areaId=null;state.itemId=null;state.page='workspace';render();
 });
}
async function apply(id,inspectionId){
 if(!canEdit())throw Error('Acesso somente consulta.');if(busy)throw Error('Aguarde a aplicação em andamento.');
 const m=find(id);if(!m)throw Error('Modelo não encontrado.');valid(m);if(!by('inspections',inspectionId))throw Error('Inspeção não encontrada.');
 busy=true;let addedAreas=0,addedItems=0;
 try{
  await load();let order=child('areas','inspectionId',inspectionId).reduce((n,a)=>Math.max(n,Number(a.order)||0),-1)+1;
  for(const src of m.areas){
   let area=child('areas','inspectionId',inspectionId).find(a=>key(a.name)===key(src.name));
   if(!area){area={id:uid(),inspectionId,name:src.name.trim(),order:order++};await put('areas',area);D.areas.push(area);addedAreas++;}
   let itemOrder=child('items','areaId',area.id).reduce((n,i)=>Math.max(n,Number(i.order)||0),-1)+1;
   for(const srcItem of src.items){if(child('items','areaId',area.id).some(i=>key(i.name)===key(srcItem.name)))continue;
    const item={id:uid(),inspectionId,areaId:area.id,name:srcItem.name.trim(),status:'Pendente',order:itemOrder++};await put('items',item);D.items.push(item);addedItems++;
   }
  }
  await load();toast(`Modelo aplicado: ${addedAreas} ambientes e ${addedItems} itens adicionados.`);
 }catch(e){try{await load();render()}catch(_){}throw Error('Não foi possível concluir. '+e.message+' Você pode aplicar novamente: os itens já adicionados serão preservados.');}finally{busy=false;}
}
Object.assign(actionMap,{
 templateNew:()=>open(),templateEdit:e=>open(e.dataset.id),templateDuplicate:e=>open(e.dataset.id,true),
 templateDelete:async e=>{admin();const m=find(e.dataset.id);if(!m||m.id==='basic')return;if(!confirm('Excluir o modelo “'+m.name+'”? As inspeções existentes serão preservadas.'))return;await del('settings',m.id);await load();render();toast('Modelo excluído.');},
 templateChooseInspection:e=>choose(e.dataset.id),
 templateAddArea:()=>edit(()=>{const a={id:uid(),name:'Novo ambiente',items:[]};draft.areas.push(a);selected=a.id;}),
 templateSelectArea:e=>edit(()=>{selected=e.dataset.id;}),
 templateMoveArea:e=>edit(()=>move(draft.areas,e.dataset.id,e.dataset.dir)),
 templateRemoveArea:e=>edit(()=>{const a=draft.areas.find(a=>a.id===e.dataset.id);if(!a||!confirm('Excluir este ambiente e seus itens do modelo?'))return;draft.areas=draft.areas.filter(a=>a.id!==e.dataset.id);if(selected===e.dataset.id)selected=draft.areas[0]?.id||null;}),
 templateAddItem:()=>edit(()=>{draft.areas.find(a=>a.id===selected)?.items.push({id:uid(),name:''});}),
 templateMoveItem:e=>edit(()=>move(draft.areas.find(a=>a.id===selected)?.items||[],e.dataset.id,e.dataset.dir)),
 templateRemoveItem:e=>edit(()=>{const a=draft.areas.find(a=>a.id===selected);if(a)a.items=a.items.filter(i=>i.id!==e.dataset.id);}),
 applyTemplate:()=>choose(null,state.inspectionId)
});
applyTemplate=()=>choose(null,state.inspectionId);
window.InspectionTemplates={key,valid,initial,models,apply,open};
})();
