import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = await readFile(new URL('../supabase/functions/inspec360-create-user/index.ts', import.meta.url), 'utf8');
const { createHandler } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const workspace = '4b853e1f-019a-4467-949b-924d4414cbaf';
const callerId = '00000000-0000-0000-0000-000000000001';
const newId = '00000000-0000-0000-0000-000000000002';
const input = { workspaceId: workspace, name: 'Pessoa de teste', email: 'pessoa@example.invalid', password: 'Test-only-password-123', role: 'editor' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });

function fixture(options = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    const path = new URL(url).pathname;
    if (path === '/auth/v1/user') return options.invalidToken ? json({}, 401) : json({ id: callerId, email_confirmed_at: '2026-10-28T00:00:00Z' });
    if (path === '/rest/v1/inspec_members') return json(options.notAdmin ? [] : [{ user_id: callerId }]);
    if (path === '/auth/v1/admin/users') return options.duplicate ? json({ code: 'email_exists' }, 422) : json({ id: newId }, 201);
    if (path === '/rest/v1/rpc/inspec_set_member') return options.failedLink ? json({}, 403) : new Response(null, { status: 204 });
    if (path === '/auth/v1/admin/users/' + newId && init.method === 'DELETE') return json({});
    throw new Error('Unexpected request: ' + path);
  };
  return { calls, handler: createHandler({ url: 'https://project.invalid', publicKey: 'test-public', serviceKey: 'test-server-secret', fetchImpl }) };
}
function request(body = input, overrides = {}) {
  return new Request('https://project.invalid/functions/v1/inspec360-create-user', {
    method: 'POST', headers: { Origin: 'https://enginspec360.netlify.app', Authorization: 'Bearer caller-token', 'Content-Type': 'application/json', ...overrides.headers },
    body: JSON.stringify(body),
  });
}

test('sem autenticação não alcança Auth administrativo', async () => {
  const { handler, calls } = fixture();
  const req = request(); req.headers.delete('Authorization');
  assert.equal((await handler(req)).status, 401); assert.equal(calls.length, 0);
});
test('token inválido é recusado antes de usar a chave administrativa', async () => {
  const { handler, calls } = fixture({ invalidToken: true });
  assert.equal((await handler(request())).status, 401); assert.equal(calls.length, 1);
  assert(!JSON.stringify(calls).includes('test-server-secret'));
});
test('editor/consulta, usuário desativado ou outra organização não cadastram', async () => {
  const { handler, calls } = fixture({ notAdmin: true });
  assert.equal((await handler(request())).status, 403);
  assert.equal(calls.length, 2); assert(!JSON.stringify(calls).includes('test-server-secret'));
  const query = new URL(calls[1].url).searchParams;
  assert.equal(query.get('user_id'), 'eq.' + callerId);
  assert.equal(query.get('workspace_id'), 'eq.' + workspace);
  assert.equal(query.get('active'), 'eq.true'); assert.equal(query.get('role'), 'eq.admin');
});
test('administrador cria Auth e vincula usando sua própria autorização', async () => {
  const { handler, calls } = fixture();
  const response = await handler(request({ ...input, email: ' PESSOA@example.invalid ', user_metadata: { role: 'admin' } }));
  assert.equal(response.status, 201);
  const result = await response.json(); assert.equal(result.user.id, newId); assert.equal(result.user.role, 'editor');
  assert.equal(result.user.email, 'pessoa@example.invalid');
  assert(!JSON.stringify(result).includes(input.password)); assert(!JSON.stringify(result).includes('test-server-secret'));
  const authBody = JSON.parse(calls[2].init.body);
  assert.equal(authBody.email_confirm, true); assert.deepEqual(authBody.user_metadata, { name: input.name });
  assert.equal(authBody.app_metadata.inspec360_created_by, callerId);
  const link = calls[3]; assert.equal(link.init.headers.Authorization, 'Bearer caller-token');
  assert.equal(JSON.parse(link.init.body).p_role, 'editor');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://enginspec360.netlify.app');
});
test('duplicidade não vincula nem modifica a conta existente', async () => {
  const { handler, calls } = fixture({ duplicate: true });
  assert.equal((await handler(request())).status, 409); assert.equal(calls.length, 3);
  assert(!calls.some(c => c.init.method === 'DELETE'));
});
test('falha no vínculo compensa exclusivamente a conta recém-criada', async () => {
  const { handler, calls } = fixture({ failedLink: true });
  assert.equal((await handler(request())).status, 503);
  const last = calls.at(-1); assert.equal(last.init.method, 'DELETE'); assert(last.url.endsWith(newId));
});
test('perfil, senha e e-mail inválidos não chegam ao Auth administrativo', async () => {
  for (const change of [{ role: 'owner' }, { password: 'curta' }, { email: 'inválido' }, { name: '' }]) {
    const { handler, calls } = fixture();
    assert.equal((await handler(request({ ...input, ...change }))).status, 400);
    assert.equal(calls.length, 2);
  }
});
test('origem estranha é bloqueada e prévia autorizada recebe CORS', async () => {
  const { handler, calls } = fixture();
  assert.equal((await handler(request(input, { headers: { Origin: 'https://evil.invalid' } }))).status, 403);
  assert.equal(calls.length, 0);
  const response = await handler(new Request('https://project.invalid', { method: 'OPTIONS', headers: { Origin: 'https://deploy-preview-2--enginspec360.netlify.app' } }));
  assert.equal(response.status, 204); assert.equal(calls.length, 0);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://deploy-preview-2--enginspec360.netlify.app');
});
test('método diferente de POST não cria conta', async () => {
  const { handler, calls } = fixture();
  assert.equal((await handler(new Request('https://project.invalid'))).status, 405);
  assert.equal(calls.length, 0);
});
