// ==========================================================================
// projetos.odisse — Worker da ferramenta Projetos (projetos-odisse).
//
// Só faz duas coisas:
//   GET /estado   → confere a senha (tela de login)
//   *   /u/v1/…   → repassa à API de dados do Universo (/api/v1/…) pelo service binding
//                   UNIVERSO, ponto de entrada "Projetos" (permissões da ferramenta Projetos).
//
// Todas as rotas exigem `Authorization: Bearer <PROJETOS_SENHA>`. PROJETOS_SENHA é um secret
// do Worker, enviado pelo GitHub Actions. Sem o secret, recusa tudo (falha fechada).
// A senha desta ferramenta nunca vai para o hub: o ponto de entrada não é acessível pela internet.
// ==========================================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function iguais(a, b) {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let dif = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) dif |= (ea[i] || 0) ^ (eb[i] || 0);
  return dif === 0;
}

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function universo(request, env, url) {
  if (!env.UNIVERSO) return json({ erro: 'ligação com o Universo não configurada' }, 503);
  const destino = 'https://universo/api/v1/' + url.pathname.replace(/^\/u\/v1\/?/, '') + url.search;
  const cab = new Headers();
  for (const k of ['Content-Type', 'Content-Length']) if (request.headers.get(k)) cab.set(k, request.headers.get(k));
  const temCorpo = !['GET', 'HEAD'].includes(request.method);
  const res = await env.UNIVERSO.fetch(destino, { method: request.method, headers: cab, body: temCorpo ? request.body : undefined });
  const saida = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS)) saida.set(k, v);
  saida.set('Access-Control-Expose-Headers', 'Content-Type, Content-Length');
  return new Response(res.body, { status: res.status, headers: saida });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (!env.PROJETOS_SENHA) return json({ erro: 'senha do servidor não configurada' }, 503);
    if (!iguais(request.headers.get('Authorization') || '', `Bearer ${env.PROJETOS_SENHA}`)) return json({ erro: 'senha incorreta' }, 401);
    try {
      if (url.pathname === '/estado' && request.method === 'GET') return json({ ok: true });
      if (url.pathname.startsWith('/u/v1')) return await universo(request, env, url);
      return json({ erro: 'rota não encontrada' }, 404);
    } catch (e) {
      return json({ erro: String(e) }, 500);
    }
  }
};
