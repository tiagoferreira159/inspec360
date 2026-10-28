// API REST do Supabase. A autorização efetiva é aplicada pelas políticas SQL/RLS.
const cloudConfig = window.INSPEC360_CONFIG;
const sessionKey = 'inspec360_cloud_session_v1';
let cloudSession = null, workspaceId = null, refreshing = null;
const photoCache = new Map();
function rememberSession(s) {
  cloudSession = s ? {...s, expires_at: s.expires_at || Math.floor(Date.now()/1000) + s.expires_in} : null;
  if (cloudSession) sessionStorage.setItem(sessionKey, JSON.stringify(cloudSession));
  else sessionStorage.removeItem(sessionKey);
}
async function cloudRequest(path, {method='GET', body, headers={}, auth=true, blob=false, retry=true}={}) {
  if (auth && !cloudSession) throw Error('Entre novamente para continuar.');
  if (auth && cloudSession.expires_at < Date.now()/1000 + 45) await refreshCloudSession();
  const h = {apikey:cloudConfig.key, ...headers};
  if (auth) h.Authorization = 'Bearer ' + cloudSession.access_token;
  if (body !== undefined && !(body instanceof Blob)) h['Content-Type']='application/json';
  let response;
  try { response = await fetch(cloudConfig.url + path, {method, headers:h, body:body===undefined?undefined:body instanceof Blob?body:JSON.stringify(body), signal:AbortSignal.timeout(45000)}); }
  catch(e) { throw Error('Não foi possível conectar ao Supabase. Verifique a internet e se o projeto está ativo.'); }
  if (response.status===401 && auth && retry) { await refreshCloudSession(); return cloudRequest(path,{method,body,headers,auth,blob,retry:false}); }
  if (!response.ok) {
    let detail={}; try {detail=await response.json()} catch(e) {}
    const message = detail.message || detail.msg || detail.error_description || detail.error || response.statusText;
    throw Error((response.status===403?'Acesso negado. Confira seu perfil e as políticas de acesso. ': '') + message);
  }
  if (blob) return response.blob();
  const content=await response.text(); return content?JSON.parse(content):null;
}
async function refreshCloudSession() {
  if (!refreshing) refreshing=(async()=>{
    if(!cloudSession?.refresh_token) throw Error('Sessão expirada. Entre novamente.');
    try {rememberSession(await cloudRequest('/auth/v1/token?grant_type=refresh_token',{method:'POST',auth:false,body:{refresh_token:cloudSession.refresh_token}}));}
    catch(e){rememberSession(null);throw Error('Sessão expirada. Saia e entre novamente.');}
  })().finally(()=>refreshing=null);
  return refreshing;
}
async function cloudLogin(email,password) {
  const s=await cloudRequest('/auth/v1/token?grant_type=password',{method:'POST',auth:false,body:{email:email.trim(),password}});
  rememberSession(s); return s.user;
}
async function cloudRows(path) {
  let rows=[];
  for(let offset=0;;offset+=500){
    const page=await cloudRequest(path + (path.includes('?')?'&':'?') + 'limit=500&offset='+offset);
    rows.push(...page); if(page.length<500)break;
  }
  return rows;
}
async function connectMember(user) {
  const members=await cloudRequest('/rest/v1/inspec_members?user_id=eq.'+encodeURIComponent(user.id)+'&active=eq.true&select=*');
  if (!members.length) throw Error('Conta autenticada, mas sem acesso ao Inspec360. Solicite ao administrador o vínculo do seu usuário.');
  if(members.length!==1)throw Error('Este usuário possui mais de uma organização. Utilize uma conta vinculada a uma única organização nesta edição.');
  workspaceId=members[0].workspace_id; sessionUser=memberAsUser(members[0]);
}
function memberAsUser(m){return {id:m.user_id,name:m.name,email:m.email,role:m.role,active:m.active};}
async function load() {
  if(!workspaceId)throw Error('Organização não selecionada.');
  const [records,members]=await Promise.all([
    cloudRows('/rest/v1/inspec_records?workspace_id=eq.'+workspaceId+'&select=kind,id,payload,updated_at&order=kind.asc,id.asc'),
    cloudRows('/rest/v1/inspec_members?workspace_id=eq.'+workspaceId+'&select=*&order=user_id.asc')
  ]);
  const next=Object.fromEntries(stores.map(s=>[s,[]]));
  for(const r of records){
    if(r.kind==='users'||!next[r.kind])continue;
    const entry={...r.payload,id:r.id,_revision:r.updated_at};
    if(r.kind==='photos'){
      if(!entry.storagePath)throw Error('Fotografia sem caminho no armazenamento: '+r.id);
      let cached=photoCache.get(entry.storagePath);
      if(!cached){cached=await cloudRequest('/storage/v1/object/authenticated/'+cloudConfig.bucket+'/'+entry.storagePath,{blob:true});photoCache.set(entry.storagePath,cached);}
      entry.blob=cached;
    }
    next[r.kind].push(entry);
  }
  next.users=members.map(memberAsUser);
  const me=next.users.find(u=>u.id===sessionUser?.id&&u.active);
  if(!me)throw Error('Seu acesso foi desativado. Saia do sistema.');
  D=next;sessionUser=me;
}
async function put(kind,obj) {
  if(kind==='users')throw Error('Use a gestão de acessos para cadastrar usuários.');
  if(!canEdit())throw Error('Acesso somente consulta.');
  if(kind==='settings'&&!isAdmin())throw Error('Somente o administrador altera configurações.');
  let payload={...obj};delete payload.blob;delete payload._revision;
  let uploaded=false;
  if(kind==='photos'&&!payload.storagePath){
    if(!(obj.blob instanceof Blob)||!obj.blob.size)throw Error('Foto inválida ou ausente no backup.');
    const packed=await compressPhoto(obj.blob);
    payload.storagePath=workspaceId+'/'+uid()+'.jpg';payload.mime=packed.type;
    await cloudRequest('/storage/v1/object/'+cloudConfig.bucket+'/'+payload.storagePath,{method:'POST',body:packed,headers:{'Content-Type':packed.type,'x-upsert':'false'}});
    photoCache.set(payload.storagePath,packed);uploaded=true;
  }
  const query='/rest/v1/inspec_records?workspace_id=eq.'+workspaceId+'&kind=eq.'+kind+'&id=eq.'+encodeURIComponent(obj.id);
  try {
    if(obj._revision){
      const rows=await cloudRequest(query+'&updated_at=eq.'+encodeURIComponent(obj._revision),{method:'PATCH',body:{payload},headers:{Prefer:'return=representation'}});
      if(!rows.length)throw Error('Este registro foi alterado ou excluído por outra pessoa. Clique em Atualizar dados antes de editar novamente.');
      obj._revision=rows[0].updated_at;
    }else{
      const rows=await cloudRequest('/rest/v1/inspec_records',{method:'POST',body:{workspace_id:workspaceId,kind,id:obj.id,payload},headers:{Prefer:'return=representation'}});
      obj._revision=rows[0].updated_at;
    }
    if(payload.storagePath)obj.storagePath=payload.storagePath;
    return obj;
  }catch(e){
    if(uploaded){try{await cloudRequest('/storage/v1/object/'+cloudConfig.bucket,{method:'DELETE',body:{prefixes:[payload.storagePath]}});photoCache.delete(payload.storagePath)}catch(cleanup){console.warn('Arquivo órfão no Storage. Administrador pode removê-lo.',payload.storagePath);}}
    throw e;
  }
}
async function del(kind,id) {
  if(!canEdit())throw Error('Acesso somente consulta.');
  const obj=by(kind,id);
  let path='/rest/v1/inspec_records?workspace_id=eq.'+workspaceId+'&kind=eq.'+kind+'&id=eq.'+encodeURIComponent(id);
  if(obj?._revision)path+='&updated_at=eq.'+encodeURIComponent(obj._revision);
  const rows=await cloudRequest(path,{method:'DELETE',headers:{Prefer:'return=representation'}});
  if(!rows.length)throw Error('Registro alterado ou já excluído. Atualize os dados e tente novamente.');
  if(kind==='photos'&&obj?.storagePath){
    try{await cloudRequest('/storage/v1/object/'+cloudConfig.bucket,{method:'DELETE',body:{prefixes:[obj.storagePath]}});photoCache.delete(obj.storagePath);}
    catch(e){toast('Registro excluído. Não foi possível remover o arquivo do Storage; solicite limpeza ao administrador.');}
  }
}
async function compressPhoto(blob){
  if(!['image/jpeg','image/png','image/webp'].includes(blob.type))throw Error('Use fotografia JPEG, PNG ou WebP. Converta HEIC/HEIF antes de enviar.');
  if(blob.size>10*1024*1024)throw Error('Envie fotos com até 10 MB cada.');
  const image=await createImageBitmap(blob);
  const ratio=Math.min(1,1800/Math.max(image.width,image.height));
  const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*ratio);canvas.height=Math.round(image.height*ratio);
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);image.close();
  const result=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.86));
  if(!result)throw Error('Não foi possível converter esta foto.');return result;
}
async function initAuth(){
  showAuth();
  try{
    const saved=sessionStorage.getItem(sessionKey);if(!saved)return;
    cloudSession=JSON.parse(saved);
    const user=await cloudRequest('/auth/v1/user');await connectMember(user);await load();
    $('#auth-layer').style.display='none';render();
  }catch(e){rememberSession(null);sessionUser=null;workspaceId=null;showAuth(e.message);}
}
function showAuth(message=''){
  const root=$('#auth-layer');root.style.display='flex';
  root.innerHTML=`<div class="auth-card"><h1>INSPEC<span style="color:#2563eb">360</span></h1><p class="hint">Acesso seguro · dados na nuvem</p><form id="auth-form">${field('email','E-mail','','email',true).replaceAll('f-email','login-email')}${field('password','Senha','','password',true).replaceAll('f-password','login-password')}<p class="auth-error" id="auth-error">${esc(message)}</p><button type="submit" class="btn primary" style="width:100%">Entrar</button></form><p class="hint">Utilize a conta cadastrada pelo administrador. Para redefinir a senha, solicite apoio ao responsável pelo sistema.</p></div>`;
  $('#auth-form').onsubmit=async e=>{
    e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;$('#auth-error').textContent='Conectando…';
    const v=Object.fromEntries(new FormData(e.target));
    try{const user=await cloudLogin(v.email,v.password);await connectMember(user);await load();root.style.display='none';render();}
    catch(ex){rememberSession(null);sessionUser=null;workspaceId=null;$('#auth-error').textContent=ex.message;}
    finally{button.disabled=false;}
  };
}
async function logout(){
  try{if(cloudSession)await cloudRequest('/auth/v1/logout',{method:'POST'});}catch(e){}
  rememberSession(null);sessionUser=null;workspaceId=null;photoCache.clear();
  urls.forEach(u=>URL.revokeObjectURL(u));urls.clear();closeModal();D=Object.fromEntries(stores.map(s=>[s,[]]));
  state={page:'dashboard',inspectionId:null,areaId:null,itemId:null,reportMode:'all',reportLayout:'pair',search:''};
  $('#content').innerHTML='';$('#signed-user').textContent='';showAuth();
}
function renderUsers(){
  if(!isAdmin())return '<div class="alert">Acesso restrito.</div>';
  return `<div class="card"><h2>Acessos à organização</h2><p>Cadastre os usuários da sua equipe e defina o perfil de acesso. As contas ficam disponíveis para entrar no sistema em qualquer dispositivo.</p>${btn('+ Novo usuário','newUser','','primary')}</div><div class="card tablewrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th>Ações</th></tr></thead><tbody>${D.users.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${roleLabels[u.role]}</td><td>${u.active?'Ativo':'Inativo'}</td><td>${btn('Editar perfil','editUser',`data-id="${esc(u.id)}"`,'sm')} ${u.id!==sessionUser.id?btn(u.active?'Desativar':'Ativar','toggleUser',`data-id="${esc(u.id)}"`,'sm'):''}</td></tr>`).join('')}</tbody></table></div>`;
}
function userModal(id){
  if(!isAdmin())return;
  const u=D.users.find(x=>x.id===id)||{};
  const passwordFields=id?'':`${field('email','E-mail','','email',true)}${field('initialPassword','Senha inicial (mínimo 10 caracteres)','','password',true)}${field('confirmPassword','Confirmar senha inicial','','password',true)}`;
  modal(id?'Editar perfil':'Cadastrar usuário',`${field('name','Nome',u.name||'','text',true)}${id?`<p class="hint">${esc(u.email||'')}</p>`:''}${passwordFields}${select('role','Perfil',[['admin','Administrador'],['editor','Engenheiro / Editor'],['viewer','Consulta']],u.role||'viewer')}<p class="hint">${id?'Altere o nome e o perfil de acesso.':'O usuário poderá entrar com o e-mail e a senha inicial informados. Ele poderá trocar a própria senha em Minha senha.'}</p>`,id?'Salvar':'Cadastrar',async v=>{
    if(id){
      if(id===sessionUser.id&&v.role!=='admin')throw Error('Não remova seu próprio perfil administrador.');
      await cloudRequest('/rest/v1/rpc/inspec_set_member',{method:'POST',body:{p_workspace:workspaceId,p_user:id,p_name:v.name,p_role:v.role,p_active:u.active??true}});
    }else{
      if(v.initialPassword!==v.confirmPassword)throw Error('As senhas informadas não coincidem.');
      if(v.initialPassword.length<10||v.initialPassword.length>128)throw Error('Use uma senha inicial com 10 a 128 caracteres.');
      if(D.users.some(x=>x.email.toLowerCase()===v.email.trim().toLowerCase()))throw Error('Este e-mail já está cadastrado na organização.');
      await cloudRequest('/functions/v1/inspec360-create-user',{method:'POST',body:{workspaceId,name:v.name,email:v.email,password:v.initialPassword,role:v.role}});
    }
    // Após a confirmação do servidor, remove os campos de senha antes de atualizar a lista.
    if(!id)closeModal();
    try{await load();}catch(ex){closeModal();toast((id?'Perfil salvo.':'Usuário cadastrado.')+' Clique em Atualizar dados para recarregar a lista.');return;}
    closeModal();render();toast(id?'Perfil salvo.':'Usuário cadastrado com sucesso.');
  });
  if(!id){
    for(const name of ['initialPassword','confirmPassword']){
      const input=document.querySelector('#modal-form [name="'+name+'"]');
      input.minLength=10;input.maxLength=128;input.autocomplete='new-password';
    }
  }
}
async function toggleUser(id){
  const u=by('users',id);if(!isAdmin()||!u||id===sessionUser.id)return;
  await cloudRequest('/rest/v1/rpc/inspec_set_member',{method:'POST',body:{p_workspace:workspaceId,p_user:id,p_name:u.name,p_role:u.role,p_active:!u.active}});
  await load();render();
}
function passwordModal(){
  modal('Alterar minha senha',`${field('old','Senha atual','','password',true)}${field('password','Nova senha (mínimo 10 caracteres)','','password',true)}`,'Alterar',async v=>{
    if(v.password.length<10)throw Error('Use uma senha com pelo menos 10 caracteres.');
    await cloudLogin(sessionUser.email,v.old);
    await cloudRequest('/auth/v1/user',{method:'PUT',body:{password:v.password}});
    closeModal();toast('Senha alterada.');
  });
  $('#modal-form').dataset.allowViewer='true';
}
async function backup(lite=false){
  if(!isAdmin())throw Error('Somente administrador.');await load();
  const output={format:'Inspec360Backup',version:2,created:new Date().toISOString(),data:{}};
  for(const kind of stores.filter(s=>s!=='users')){
    output.data[kind]=[];
    for(const record of D[kind]){
      const entry={...record};delete entry._revision;delete entry.storagePath;delete entry.blob;
      if(kind==='photos'&&!lite){entry.base64=bufToBase64(await record.blob.arrayBuffer());entry.mime=record.blob.type;}
      output.data[kind].push(entry);
    }
  }
  download(new Blob([JSON.stringify(output)],{type:'application/json'}),`inspec360_backup_${new Date().toISOString().slice(0,10)}${lite?'_sem_fotos':''}.json`);
  toast('Backup gerado. Contas e senhas não são exportadas.');
}
async function restoreFile(file){
  try{
    if(!isAdmin())throw Error('Somente administrador.');
    const j=JSON.parse(await file.text());
    const kinds=stores.filter(s=>s!=='users');
    if(j.format!=='Inspec360Backup'||!j.data||!kinds.every(k=>Array.isArray(j.data[k])))throw Error('Backup inválido.');
    if(j.data.photos.some(p=>!p.base64))throw Error('Use um backup completo, com fotografias. O backup sem fotos não pode ser importado.');
    await load();
    if(kinds.some(k=>D[k].length))throw Error('A importação inicial exige uma organização vazia. Nenhum dado foi substituído.');
    if(!confirm('Importar este backup para a organização atual? Os usuários locais não serão importados. Se houver falha, parte dos registros poderá já ter sido enviada.'))return;
    // Valida IDs, vínculos e imagens antes de iniciar envios.
    for(const kind of kinds){const ids=new Set();for(const r of j.data[kind]){if(typeof r.id!=='string'||!r.id||!/^[A-Za-z0-9_-]{1,200}$/.test(r.id)||ids.has(r.id))throw Error('IDs inválidos ou repetidos em '+kind);ids.add(r.id);}}
    const refs={inspections:[['condoId','condos']],areas:[['inspectionId','inspections']],items:[['areaId','areas'],['inspectionId','inspections']],findings:[['itemId','items'],['areaId','areas'],['inspectionId','inspections']],photos:[['itemId','items'],['areaId','areas'],['inspectionId','inspections']]};
    for(const [kind,links] of Object.entries(refs))for(const r of j.data[kind])for(const [key,target] of links)if(!j.data[target].some(t=>t.id===r[key]))throw Error('Vínculo inválido em '+kind+': '+key);
    for(const p of j.data.photos){const b=base64ToBlob(p.base64,p.mime||'image/jpeg');await compressPhoto(b);}
    let count=0;
    for(const kind of kinds)for(const record of j.data[kind]){
      const e={...record};delete e._revision;delete e.storagePath;
      if(kind==='photos'){e.blob=base64ToBlob(e.base64,e.mime||'image/jpeg');delete e.base64;}
      await put(kind,e);count++;toast('Importando… '+count+' registros enviados.');
    }
    await load();render();toast('Importação concluída. Usuários locais foram ignorados.');
  }catch(e){alert('Importação: '+e.message+' Se o envio já havia começado, confira os registros enviados antes de tentar novamente.');}
}
