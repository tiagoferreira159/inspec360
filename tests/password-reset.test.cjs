const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../password-reset.js'),'utf8');
const response=(status,body={})=>({status,ok:status>=200&&status<300,text:async()=>JSON.stringify(body)});
async function fixture(hash='',handler=()=>response(200,{id:'u',email:'test@example.test'})){
 const calls=[],history=[],removed=[],nodes={};for(const id of ['title','intro','message','email','password','confirm','request-form','reset-form'])nodes[id]={hidden:id==='reset-form',value:'',textContent:'',dataset:{},setAttribute(){},button:{disabled:false},querySelector(){return this.button}};
 const c={window:{INSPEC360_CONFIG:{url:'https://project.test',key:'public-key'}},document:{getElementById:id=>nodes[id]},URL,URLSearchParams,AbortSignal,location:{hash,pathname:'/password-reset.html',origin:'https://inspec.test'},history:{replaceState:(...args)=>history.push(args)},sessionStorage:{removeItem:key=>removed.push(key)},fetch:async(url,args)=>{calls.push({url,args});return handler(url,args);}};
 vm.createContext(c);vm.runInContext(source,c);await new Promise(resolve=>setImmediate(resolve));return {nodes,calls,history,removed};
}
const event={preventDefault(){}};
test('sem token apenas solicita e-mail; não consulta nem altera senha',async()=>{
 const f=await fixture();assert.equal(f.calls.length,0);f.nodes.email.value=' test@example.test ';await f.nodes['request-form'].onsubmit(event);
 assert.equal(f.calls.length,1);assert(f.calls[0].url.includes('/recover?redirect_to=https%3A%2F%2Finspec.test%2Fpassword-reset.html'));assert.deepEqual(JSON.parse(f.calls[0].args.body),{email:'test@example.test'});assert.equal(f.calls[0].args.headers.Authorization,undefined);assert.match(f.nodes.message.textContent,/Se este e-mail/);
});
test('hash limpo antes de validar link, token somente em memória e senha salva apenas após confirmação',async()=>{
 const f=await fixture('#type=recovery&access_token=synthetic-token&refresh_token=synthetic-refresh');assert.equal(f.history[0][2],'/password-reset.html');assert.equal(f.nodes['reset-form'].hidden,false);assert.equal(f.calls[0].args.headers.Authorization,'Bearer synthetic-token');
 f.nodes.password.value='Synthetic-pass-123';f.nodes.confirm.value='different';await f.nodes['reset-form'].onsubmit(event);assert.equal(f.calls.length,1);
 f.nodes.confirm.value=f.nodes.password.value;await f.nodes['reset-form'].onsubmit(event);assert.equal(f.calls[1].args.method,'PUT');assert.deepEqual(JSON.parse(f.calls[1].args.body),{password:'Synthetic-pass-123'});assert(f.calls[2].url.endsWith('/logout?scope=global'));assert.equal(f.nodes.password.value,'');assert.equal(f.nodes.confirm.value,'');assert.equal(f.nodes['reset-form'].hidden,true);assert.match(f.nodes.message.textContent,/sucesso/);assert.deepEqual(f.removed,['inspec360_cloud_session_v1']);
});
test('link expirado oferece nova solicitação sem executar troca',async()=>{
 const f=await fixture('#type=recovery&access_token=expired',()=>response(401));assert.equal(f.nodes['request-form'].hidden,false);assert.equal(f.nodes['reset-form'].hidden,true);assert.match(f.nodes.message.textContent,/expirou/);assert.equal(f.calls.length,1);
 const error=await fixture('#error=access_denied&error_code=otp_expired');assert.equal(error.calls.length,0);assert.match(error.nodes.message.textContent,/expirou/);
});
test('token sem tipo recovery não é utilizado e limite de e-mail informa espera',async()=>{
 const f=await fixture('#access_token=not-a-recovery-token',()=>response(429));assert.equal(f.calls.length,0);assert.equal(f.history.length,1);f.nodes.email.value='test@example.test';await f.nodes['request-form'].onsubmit(event);assert.match(f.nodes.message.textContent,/Aguarde/);assert.equal(f.nodes['request-form'].button.disabled,false);
});
