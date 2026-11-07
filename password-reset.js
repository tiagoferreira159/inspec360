/* Recuperação nativa do Supabase: tokens somente em memória, sem armazenamento/logs. */
(() => {
'use strict';
const fragment=new URLSearchParams(location.hash.slice(1));
// Remove credenciais/erros da barra e do histórico antes de qualquer chamada.
if(location.hash)history.replaceState(null,'',location.pathname);
const config=window.INSPEC360_CONFIG,$=id=>document.getElementById(id);
let accessToken=fragment.get('type')==='recovery'?fragment.get('access_token'):null;
fragment.delete('access_token');fragment.delete('refresh_token');
const message=(text,error=false)=>{$('message').textContent=text;$('message').dataset.error=String(error);$('message').setAttribute('role',error?'alert':'status');};
async function request(path,{method='GET',body,token}={}){
 const headers={apikey:config.key,'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;
 let response;try{response=await fetch(config.url+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000),referrerPolicy:'no-referrer',cache:'no-store'});}catch{throw Error('Não foi possível conectar. Verifique a internet e tente novamente.');}
 if(!response.ok){
  if(response.status===429)throw Error('Muitas solicitações. Aguarde alguns minutos antes de tentar novamente.');
  if(response.status===401||response.status===403){const error=Error('Este link expirou ou não é válido. Solicite um novo link abaixo.');error.code='invalid_link';throw error;}
  throw Error(method==='PUT'?'Não foi possível atualizar a senha. Use uma senha diferente, com pelo menos 10 caracteres. Se necessário, solicite outro link.':'Não foi possível concluir a solicitação. Tente novamente mais tarde.');
 }
 const text=await response.text();return text?JSON.parse(text):null;
}
const requestForm=$('request-form'),resetForm=$('reset-form');
requestForm.onsubmit=async event=>{
 event.preventDefault();const button=requestForm.querySelector('button');if(button.disabled)return;button.disabled=true;message('Enviando solicitação…');
 try{const email=$('email').value.trim();await request('/auth/v1/recover?redirect_to='+encodeURIComponent(new URL('/password-reset.html',location.origin).href),{method:'POST',body:{email}});message('Se este e-mail estiver cadastrado, você receberá um link de recuperação. Confira também o spam.');}
 catch(error){message(error.message,true);}finally{button.disabled=false;}
};
resetForm.onsubmit=async event=>{
 event.preventDefault();const button=resetForm.querySelector('button');if(button.disabled)return;
 const password=$('password').value,confirmation=$('confirm').value;
 if(!accessToken){message('Solicite um novo link para continuar.',true);return;}
 if(password.length<10||password.length>128){message('Use uma senha com 10 a 128 caracteres.',true);return;}
 if(password!==confirmation){message('As senhas informadas não coincidem.',true);return;}
 button.disabled=true;message('Salvando nova senha…');
 try{
  await request('/auth/v1/user',{method:'PUT',body:{password},token:accessToken});
  try{await request('/auth/v1/logout?scope=global',{method:'POST',token:accessToken});}catch{/* A senha já foi alterada. Não repetir a gravação. */}
  accessToken=null;sessionStorage.removeItem('inspec360_cloud_session_v1');$('password').value='';$('confirm').value='';resetForm.hidden=true;requestForm.hidden=true;
  $('title').textContent='Senha atualizada';$('intro').textContent='Você já pode entrar no Inspec360 com seu e-mail e a nova senha.';message('Nova senha salva com sucesso.');
 }catch(error){if(error.code==='invalid_link'){accessToken=null;resetForm.hidden=true;requestForm.hidden=false;$('password').value='';$('confirm').value='';}message(error.message,true);button.disabled=false;}
};
(async()=>{
 if(fragment.has('error_code')||fragment.has('error')){message('O link expirou ou já foi utilizado. Solicite outro link abaixo.',true);accessToken=null;return;}
 if(!accessToken)return;
 requestForm.hidden=true;message('Validando link de recuperação…');
 try{const user=await request('/auth/v1/user',{token:accessToken});if(!user?.id||!user.email)throw Error('Link inválido. Solicite outro link abaixo.');$('title').textContent='Definir nova senha';$('intro').textContent='Escolha uma nova senha para '+user.email+'.';resetForm.hidden=false;message('');}
 catch(error){accessToken=null;requestForm.hidden=false;resetForm.hidden=true;message(error.message,true);}
})();
})();
