// Executado somente no servidor. Não expõe chaves administrativas no cliente.
// Sem dependências externas: Auth e PostgREST oficiais via fetch.
export function createHandler({ url, publicKey, serviceKey, fetchImpl = fetch }) {
  const allowedOrigin = origin => origin === 'https://enginspec360.netlify.app'
    || /^https:\/\/deploy-preview-\d+--enginspec360\.netlify\.app$/.test(origin);

  return async function handle(req) {
    const origin = req.headers.get('Origin');
    const cors = {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Max-Age': '600',
      'Vary': 'Origin',
    };
    if (origin && allowedOrigin(origin)) cors['Access-Control-Allow-Origin'] = origin;
    const respond = (status, message, extra = {}) => new Response(
      JSON.stringify({ ...(message ? { message } : {}), ...extra }),
      { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
    );
    if (origin && !allowedOrigin(origin)) return respond(403, 'Origem não autorizada.');
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return respond(405, 'Método não permitido.');
    const authorization = req.headers.get('Authorization') || '';
    if (!/^Bearer\s+\S+$/i.test(authorization)) return respond(401, 'Entre novamente para continuar.');
    if (!url || !publicKey || !serviceKey) return respond(503, 'Cadastro de usuários indisponível.');

    const signal = AbortSignal.timeout(35000);
    // Primeiro valida a identidade com o Auth e depois o perfil atual no banco.
    // Nem o papel enviado pelo cliente nem user_metadata concedem privilégios.
    const userHeaders = { apikey: publicKey, Authorization: authorization, 'Content-Type': 'application/json' };
    let createdUser = null;
    try {
      const auth = await fetchImpl(url + '/auth/v1/user', { headers: userHeaders, signal });
      if (!auth.ok) return respond(401, 'Sessão inválida. Entre novamente.');
      const caller = await auth.json();
      if (!caller.id || !caller.email_confirmed_at) return respond(403, 'Confirme sua conta antes de cadastrar usuários.');

      if (Number(req.headers.get('Content-Length') || 0) > 8192) return respond(413, 'Dados do formulário excedem o limite.');
      const raw = await req.text();
      if (raw.length > 8192) return respond(413, 'Dados do formulário excedem o limite.');
      let input;
      try { input = JSON.parse(raw); } catch { return respond(400, 'Formulário inválido.'); }
      if (!input || typeof input !== 'object') return respond(400, 'Formulário inválido.');
      const workspace = typeof input.workspaceId === 'string' ? input.workspaceId : '';
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workspace)) return respond(400, 'Organização inválida.');

      const memberQuery = new URLSearchParams({
        workspace_id: 'eq.' + workspace, user_id: 'eq.' + caller.id,
        active: 'eq.true', role: 'eq.admin', select: 'user_id', limit: '1',
      });
      const membership = await fetchImpl(url + '/rest/v1/inspec_members?' + memberQuery, { headers: userHeaders, signal });
      if (!membership.ok) return respond(503, 'Não foi possível validar sua permissão.');
      const admins = await membership.json();
      if (!Array.isArray(admins) || admins.length !== 1) return respond(403, 'Somente administradores ativos podem cadastrar usuários nesta organização.');

      const name = typeof input.name === 'string' ? input.name.trim() : '';
      const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
      const password = typeof input.password === 'string' ? input.password : '';
      const role = input.role;
      if (!name || name.length > 150) return respond(400, 'Informe um nome com até 150 caracteres.');
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return respond(400, 'Informe um e-mail válido.');
      if (password.length < 10 || password.length > 128) return respond(400, 'A senha inicial deve ter de 10 a 128 caracteres.');
      if (!['admin', 'editor', 'viewer'].includes(role)) return respond(400, 'Perfil de acesso inválido.');

      // A chave administrativa só é usada após identidade e autorização confirmadas.
      const adminHeaders = { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'application/json' };
      const created = await fetchImpl(url + '/auth/v1/admin/users', {
        method: 'POST', headers: adminHeaders, signal,
        body: JSON.stringify({ email, password, email_confirm: true,
          user_metadata: { name }, app_metadata: { inspec360_created_by: caller.id, inspec360_workspace: workspace } }),
      });
      if (!created.ok) {
        let error = {}; try { error = await created.json(); } catch {}
        const duplicate = ['email_exists', 'user_already_exists'].includes(error.code)
          || /already.*(registered|exists)/i.test(error.msg || error.message || '');
        if (duplicate) return respond(409, 'Este e-mail já possui uma conta. Atualize a lista para conferir os cadastros. Contas existentes não são vinculadas automaticamente.');
        if (created.status === 422 || created.status === 400) return respond(400, 'Não foi possível criar a conta. Confira o e-mail e a política de senha.');
        return respond(503, 'O serviço de cadastro está indisponível. Tente novamente mais tarde.');
      }
      const result = await created.json();
      createdUser = result.user || result;
      if (!/^[0-9a-f-]{36}$/i.test(createdUser.id || '')) throw Error('Invalid new user response');

      // A RPC revalida o administrador, inclusive se o perfil mudou durante a requisição.
      const linked = await fetchImpl(url + '/rest/v1/rpc/inspec_set_member', {
        method: 'POST', headers: userHeaders, signal,
        body: JSON.stringify({ p_workspace: workspace, p_user: createdUser.id, p_name: name, p_role: role, p_active: true }),
      });
      if (!linked.ok) throw Error('Membership creation failed');
      return respond(201, '', { user: { id: createdUser.id, name, email, role, active: true } });
    } catch {
      // Compensa apenas a conta recém-criada, nunca uma conta que já existia.
      if (createdUser && /^[0-9a-f-]{36}$/i.test(createdUser.id || '')) {
        try {
          const cleanup = await fetchImpl(url + '/auth/v1/admin/users/' + createdUser.id, {
            method: 'DELETE', headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey },
            signal: AbortSignal.timeout(8000),
          });
          if (!cleanup.ok) return respond(503, 'Cadastro incompleto. Solicite apoio antes de repetir esta operação.');
        } catch { return respond(503, 'Cadastro incompleto. Solicite apoio antes de repetir esta operação.'); }
      }
      return respond(503, 'Não foi possível concluir o cadastro. Confira a lista antes de tentar novamente.');
    }
  };
}

if (typeof Deno !== 'undefined') {
  Deno.serve(createHandler({
    url: Deno.env.get('SUPABASE_URL'),
    publicKey: Deno.env.get('SUPABASE_ANON_KEY'),
    serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  }));
}
