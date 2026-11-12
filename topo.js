// ==========================================================================
// Barra do projetos.odisse — mesma régua da barra do Universo e do vendas
// (48 px, ardósia, selo da mão + logotipo ODISSE + rótulo da ferramenta;
// seções no centro; botão "Universo" à direita).
//   <header class="topo" data-pagina="projetos"></header><script src="topo.js"></script>
// ==========================================================================
(() => {
  // Cadeia progressiva: Bases → Plano Geral de Trabalho → Projetos; depois, o dia a dia (horas, equipe).
  const SECOES = [
    { id: 'bases', nome: 'Bases', href: 'bases.html', dica: 'Serviços, tipologias, CUB, fatores do CAU e índice de complexidade' },
    { id: 'pgt', nome: 'PGT', href: 'pgt.html', dica: 'Plano Geral de Trabalho: fases, etapas, entregáveis e materiais por serviço' },
    { id: 'projetos', nome: 'Projetos', href: 'index.html', dica: 'Projetos em andamento, etapas e prazos' },
    { id: 'horas', nome: 'Horas', href: 'horas.html', dica: 'Apontamento de horas da semana' },
    { id: 'equipe', nome: 'Equipe', href: 'equipe.html', dica: 'Quem aponta horas' }
  ];
  const PERTENCE = { projeto: 'projetos' };
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const raiz = document.querySelector('header.topo');
  if (!raiz) return;
  const pagina = PERTENCE[raiz.dataset.pagina] || raiz.dataset.pagina || '';
  raiz.innerHTML = `
    <a class="topo__casa" href="index.html" title="Projetos">
      <span class="topo__selo" aria-hidden="true"></span>
      <span class="topo__logotipo" role="img" aria-label="Odisse"></span>
      <span class="topo__sub">Projetos</span>
    </a>
    <nav class="topo__secoes" aria-label="Seções de Projetos">
      ${SECOES.map((s) => `<a href="${s.href}" title="${esc(s.dica)}"${s.id === pagina ? ' class="is-current" aria-current="page"' : ''}>${esc(s.nome)}</a>`).join('')}
    </nav>
    <div class="topo__direita">
      <span data-universo-menu></span>
      <span class="topo__conta"><span id="rail-user"></span><a href="login.html" id="btn-logout">Sair</a></span>
    </div>`;
  const mostrarNome = () => {
    try { document.getElementById('rail-user').textContent = typeof getUserName === 'function' ? getUserName() : ''; } catch (_) { /* sem nome */ }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mostrarNome); else mostrarNome();
  document.getElementById('btn-logout').addEventListener('click', (e) => {
    e.preventDefault();
    if (typeof logout === 'function') logout();
    window.location.href = 'login.html';
  });
  const s = document.createElement('script');
  s.src = 'https://universo.odisse.com.br/base/v1/barra.js';
  s.defer = true;
  document.head.appendChild(s);
})();
