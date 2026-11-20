// ==========================================================================
// Plano Geral de Trabalho — rotas, Serviços (com a Ficha de cada um), Faixas e prazo e publicação única.
// (Cid, 20/11/2026) As Bases entraram no PGT. Abas: Serviços · Faixas e prazo · Plano do fluxo · Plano das ilhas · Materiais.
//   * Serviço EM FLUXO: entra no plano comum (fases encadeadas) e marca P/O/— nos cartões; pede tipologia; o índice de
//     complexidade se ajusta por categoria (sem valor próprio, vale o padrão do serviço, que fica oculto).
//   * Serviço EM ILHA: tem o próprio plano (etapas e cartões só dele); o índice é um só, o do serviço.
//   * Trocar a dinâmica não apaga nada (o que era da outra fica guardado). Serviço novo nasce vazio ou como cópia.
//   * Publicar grava as Bases e o PGT de uma vez (o vendas lê os dois retratos).
// Este arquivo só define funções; a página chama iniciarRotas(), carregar() e carregarBases() no fim.
// ==========================================================================

let B = null;          // GET bases (serviços com dinâmica, IC, preço para leitura; categorias; usos; faixas)

// Ícones da página (SVG, nunca caracteres)
const IC2 = {
  seta: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3.5 5.5 7 9l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  mais: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 2.5v9M2.5 7h9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  volta: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M4.5 4.5h4.2a2.8 2.8 0 0 1 0 5.6H5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M6.2 2.6 4.3 4.5l1.9 1.9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lapis: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.8 2.6 13.4 5.2 6 12.6 3 13 3.4 10Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  fora: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M8 2.5h3.5V6M11.3 2.7 6.5 7.5M10 8.5v3H2.5V4h3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

// ---------------------------------------------------------------- rotas
//   #servicos · #servico/<id> · #servico/<id>/pgt · #faixas · #fluxo · #ilhas · #materiais
const ABAS = { servicos: 'Serviços', faixas: 'Faixas e prazo', fluxo: 'Plano do fluxo', ilhas: 'Plano das ilhas', materiais: 'Materiais' };
let ROTA = { aba: 'servicos' };
let MODO_FLUXO = (() => { try { return sessionStorage.getItem('pgt:modo') || 'cartoes'; } catch (_) { return 'cartoes'; } })();

function lerRota() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const [a, b, c] = h.split('/');
  if (a === 'servico' && b) return { aba: 'servico', srv: b, sub: c === 'pgt' ? 'pgt' : 'ficha' };
  // endereços antigos da página (abas plano/linha/materiais) e das Bases
  if (a === 'plano' || a === 'linha') return { aba: 'fluxo' };
  return { aba: ABAS[a] ? a : 'servicos' };
}
function irPara(hash, { cartoes = false } = {}) {
  if (cartoes && hash === 'fluxo') { MODO_FLUXO = 'cartoes'; guardarModo(); }
  if (location.hash.replace(/^#/, '') === hash) mostrarRota(); else location.hash = hash;
}
function guardarModo() { try { sessionStorage.setItem('pgt:modo', MODO_FLUXO); } catch (_) { /* sem armazenamento */ } }
function iniciarRotas() {
  // o painel lateral (Gaveta) apaga o endereço ao fechar: aqui ele volta para a rota em que estava
  const fecharOriginal = fecharPainel;
  // eslint-disable-next-line no-global-assign
  fecharPainel = function () { const h = location.hash; fecharOriginal(); if (h) history.replaceState(null, '', h); };
  window.addEventListener('hashchange', mostrarRota);
  if (!location.hash) {
    let ultima = '';
    try { ultima = sessionStorage.getItem('pgt:rota') || ''; } catch (_) { /* sem armazenamento */ }
    history.replaceState(null, '', '#' + (ultima || 'servicos'));
  }
  mostrarRota();
}

// O que o plano mostra agora: 'fluxo', 'ilhas' ou nada; e o serviço fixo (na subpágina PGT de um serviço)
function servicoAtual() { return ROTA.aba === 'servico' ? (D || B)?.servicos.find((s) => s.id === ROTA.srv) || null : null; }
function vistaDoPlano() {
  if (ROTA.aba === 'fluxo') return MODO_FLUXO === 'linha' ? null : 'fluxo';
  if (ROTA.aba === 'ilhas') return 'ilhas';
  if (ROTA.aba === 'servico' && ROTA.sub === 'pgt') { const s = servicoAtual(); return s ? (s.dinamica === 'ilha' ? 'ilhas' : 'fluxo') : null; }
  return null;
}
const servicoFixo = () => (ROTA.aba === 'servico' && ROTA.sub === 'pgt' ? ROTA.srv : '');
function servicosDaVista() {
  if (!D) return [];
  const fixo = servicoFixo();
  if (fixo) return D.servicos.filter((s) => s.id === fixo);
  if (ROTA.aba === 'materiais') return D.servicos;
  const v = vistaDoPlano() || (ROTA.aba === 'ilhas' ? 'ilhas' : 'fluxo');
  return D.servicos.filter((s) => (s.dinamica || 'fluxo') === (v === 'ilhas' ? 'ilha' : 'fluxo'));
}
function etapasDaVista() {
  if (!D) return [];
  if (ROTA.aba === 'materiais') return D.etapas;
  const v = vistaDoPlano();
  const fixo = servicoFixo();
  if (v === 'ilhas') return D.etapas.filter((e) => e.servico_id && (!fixo || e.servico_id === fixo) && servicosDaVista().some((s) => s.id === e.servico_id));
  return D.etapas.filter((e) => !e.servico_id && !faseDe(e.fase_id)?.solta);
}
// a Linha oferece os serviços em fluxo (ou o serviço da subpágina)
function servicosDaLinha() {
  if (!D) return [];
  const fixo = servicoFixo();
  if (fixo) return D.servicos.filter((s) => s.id === fixo);
  return D.servicos.filter((s) => (s.dinamica || 'fluxo') === 'fluxo');
}

function mostrarRota() {
  ROTA = lerRota();
  try { sessionStorage.setItem('pgt:rota', location.hash.replace(/^#/, '')); } catch (_) { /* sem armazenamento */ }
  const srv = servicoAtual();
  // Abas: as da seção; na subpágina de um serviço, Ficha | PGT com a Trilha
  const linha = document.querySelector('.abas-caixa-linha');
  const trilha = document.getElementById('trilha');
  if (ROTA.aba === 'servico') {
    linha.innerHTML = `<span class="u-rotulo">Serviço</span><nav class="abas-caixa" id="abas" aria-label="Subpáginas do serviço">
      <a href="#servico/${ROTA.srv}" class="${ROTA.sub === 'ficha' ? 'ativa' : ''}">Ficha</a>
      <a href="#servico/${ROTA.srv}/pgt" class="${ROTA.sub === 'pgt' ? 'ativa' : ''}">PGT</a></nav>`;
    trilha.hidden = false;
    trilha.innerHTML = `<a href="#servicos">Serviços</a><span class="sep">/</span><span aria-current="page">${escHtml(srv ? srv.sigla : '…')}</span>`;
    document.getElementById('titulo').textContent = srv ? srv.nome : 'Serviço';
  } else {
    linha.innerHTML = `<span class="u-rotulo">Plano Geral de Trabalho</span><nav class="abas-caixa" id="abas" aria-label="Plano Geral de Trabalho">
      ${Object.entries(ABAS).map(([k, n]) => `<a href="#${k}" class="${ROTA.aba === k ? 'ativa' : ''}"${ROTA.aba === k ? ' aria-current="page"' : ''}>${n}</a>`).join('')}</nav>`;
    trilha.hidden = true;
    document.getElementById('titulo').textContent = ABAS[ROTA.aba];
  }
  document.title = `${ROTA.aba === 'servico' ? (srv ? srv.sigla + ' · ' + srv.nome : 'Serviço') : ABAS[ROTA.aba]} · Plano Geral de Trabalho — Odisse`;

  const plano = !!vistaDoPlano();
  const linhaNaTela = ROTA.aba === 'fluxo' && MODO_FLUXO === 'linha';
  const mostrar = {
    servicos: ROTA.aba === 'servicos', ficha: ROTA.aba === 'servico' && ROTA.sub === 'ficha', faixas: ROTA.aba === 'faixas',
    plano, linha: linhaNaTela, materiais: ROTA.aba === 'materiais',
  };
  document.querySelectorAll('[data-painel]').forEach((s) => { s.hidden = !mostrar[s.dataset.painel]; });
  document.getElementById('filtros').hidden = !(plano || ROTA.aba === 'materiais');
  document.getElementById('legenda-pert').hidden = !plano;
  document.getElementById('f-modo').innerHTML = ROTA.aba === 'fluxo' ? seletorModo() : '';
  document.getElementById('linha-modo').innerHTML = linhaNaTela ? `<div class="gestao__filtros">${seletorModo()}</div>` : '';
  document.querySelectorAll('[data-modo]').forEach((b) => b.onclick = () => {
    MODO_FLUXO = b.dataset.modo; guardarModo(); mostrarRota();
  });
  document.getElementById('arquivados').hidden = !(plano || ROTA.aba === 'materiais');
  window.scrollTo(0, 0);
  if (D) {
    montarFiltros();
    if (plano) desenharPlano();
    if (linhaNaTela) desenharLinha();
    if (ROTA.aba === 'materiais') { montarFiltroAlvo(); desenharMateriais(); }
    lnDesenharBarraSelecao();
  }
  desenharServicos();
  desenharNotas();
}
const seletorModo = () => `<span class="pg-seletor" role="radiogroup" aria-label="Como ver o Plano do fluxo">
  <button type="button" role="radio" data-modo="cartoes" aria-checked="${MODO_FLUXO !== 'linha'}">Cartões</button>
  <button type="button" role="radio" data-modo="linha" aria-checked="${MODO_FLUXO === 'linha'}">Linha</button></span>`;

// ---------------------------------------------------------------- dados das Bases
async function carregarBases({ soNovo = false } = {}) {
  try {
    await Universo.lerComCache('bases', (d) => { B = d; desenharServicos(); desenharPub(); }, { soNovo });
  } catch (e) { aviso(`Não consegui carregar os serviços (${mensagemDe(e)}).`); }
}
const recarregarTudo = async () => { await Promise.all([carregarBases({ soNovo: true }), recarregar()]); };
const srvB = (id) => B?.servicos.find((s) => s.id === id);

// ---------------------------------------------------------------- publicação: um botão só (Bases + PGT)
function desenharPub() {
  const el = document.getElementById('pub');
  if (!el || !D0 || !B) return;
  const pendente = !!(D0.pendente || B.pendente || FILA.size);
  const pv = D0.publicacao; const bv = B.publicacao;
  const quando = (p) => new Date(p.publicado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  el.innerHTML = `<span class="gestao-status">
      ${pv ? `<span title="${escHtml(pv.nota || '')}">PGT <strong>v${pv.numero}</strong> · Bases <strong>v${bv ? bv.numero : '—'}</strong> · ${quando(pv)}</span>` : '<span>Ainda não publicado</span>'}
      ${pendente ? '<span class="pg-etq atencao">mudanças não publicadas</span>' : '<span class="pg-etq ok">em dia</span>'}
    </span>
    <button class="u-botao forte" type="button" ${pendente ? '' : 'disabled'}>Publicar versão</button>`;
  el.querySelector('button').onclick = async () => {
    if (FILA.size) await salvar();
    if (FILA.size) return;
    abrirPublicarTudo();
  };
}
function abrirPublicarTudo() {
  const painel = abrirPainel(`
    <div class="painel__topo"><h2>Publicar o Plano Geral de Trabalho</h2><button class="painel__fechar" aria-label="Fechar">×</button></div>
    <div id="pub-aviso"></div>
    <p class="small">Grava um retrato dos serviços (Bases) e do plano (PGT) como estão agora. É o que o vendas usa nas propostas novas;
      cada proposta registra as versões usadas. O rascunho continua editável depois.</p>
    <form id="f-pub">
      <div class="field"><label class="field__label">O que mudou (opcional)</label>
        <textarea name="nota" rows="3" maxlength="500" placeholder="Ex.: Consultoria de viabilidade em ilha"></textarea></div>
      <div class="painel__acoes"><button class="u-botao forte" type="submit">Publicar</button></div>
    </form>`);
  const av = avisoEm(painel.querySelector('#pub-aviso'));
  painel.querySelector('#f-pub').onsubmit = async (e) => {
    e.preventDefault();
    const nota = e.target.nota.value.trim() || null;
    e.submitter && (e.submitter.disabled = true);
    const feitos = [];
    try {
      // Bases antes: o retrato do PGT guarda a versão das Bases de que depende
      for (const tipo of ['bases', 'pgt']) {
        try { const r = await Universo.post(`${tipo}/publicar`, { nota }); feitos.push(`${tipo === 'bases' ? 'Bases' : 'PGT'} v${r.numero}`); }
        catch (err) { if (err.status !== 409) throw err; }
      }
      fecharPainel();
      aviso(feitos.length ? `Publicado: ${feitos.join(' e ')}.` : 'Nada mudou desde a última versão publicada.', 'ok');
      await recarregarTudo();
    } catch (err) { av(mensagemDe(err)); e.submitter && (e.submitter.disabled = false); }
  };
}

// ---------------------------------------------------------------- Serviços (Registro + Tipologias + notas)
const etqDinamica = (s) => (s.dinamica === 'ilha' ? '<span class="pg-etq ambar">em ilha</span>' : '<span class="pg-etq ardosia">em fluxo</span>');
const etqPreco = (s) => (s.com_preco ? '<span class="pg-etq">com preço</span>' : '<span class="pg-etq tracejada">sem preço</span>');
function contagemDe(s) {
  if (!D) return null;
  const ents = D.entregaveis.filter((x) => x.servicos[s.id]);
  const evts = D.eventos.filter((x) => !x.encerramento && x.servicos[s.id]);
  return { p: ents.filter((x) => x.servicos[s.id] === 'P').length, o: ents.filter((x) => x.servicos[s.id] === 'O').length, ev: evts.length };
}
function textoIC(s) {
  if (s.dinamica === 'ilha') return '<span class="sem">do serviço</span>';
  const n = Object.keys(s.ic_categorias || {}).length;
  const total = B.categorias.length;
  return n === total ? `${total} categorias` : n ? `${n} de ${total} categorias` : '<span class="sem">padrão</span>';
}
function desenharServicos() {
  const el = document.getElementById('servicos');
  if (ROTA.aba === 'servico') {   // o nome chega com os dados
    const sv = servicoAtual();
    if (sv) {
      document.getElementById('titulo').textContent = sv.nome;
      const t = document.querySelector('#trilha [aria-current]'); if (t) t.textContent = sv.sigla;
      document.title = `${sv.sigla} · ${sv.nome} · Plano Geral de Trabalho — Odisse`;
    }
  }
  if (!el || !B) return;
  if (ROTA.aba === 'servico' && ROTA.sub === 'ficha') desenharFicha();
  if (ROTA.aba === 'servicos') {
    const q = semAcento(SERV_FILTRO.q);
    const lista = B.servicos.filter((s) => (SERV_FILTRO.din === 'todos' || s.dinamica === SERV_FILTRO.din)
      && (!q || semAcento(`${s.sigla} ${s.nome} ${s.descricao || ''}`).includes(q)));
    const n = (d) => B.servicos.filter((s) => d === 'todos' || s.dinamica === d).length;
    el.innerHTML = `<div class="pg-filtros">
        <span class="pg-seletor" role="radiogroup" aria-label="Dinâmica">
          ${[['todos', 'Todos'], ['fluxo', 'Em fluxo'], ['ilha', 'Em ilha']].map(([k, r]) => `<button type="button" role="radio" data-din="${k}" aria-checked="${SERV_FILTRO.din === k}">${r} <span class="n">${n(k)}</span></button>`).join('')}
        </span>
        <input type="search" class="pg-busca" id="serv-q" placeholder="Buscar serviço" value="${escHtml(SERV_FILTRO.q)}" aria-label="Buscar serviço">
        <span class="pg-empurra"></span>
        <button type="button" class="u-botao" id="novo-servico">${IC2.mais}<span>Novo serviço</span></button>
      </div>
      <div class="pg-regua pg-grade-srv"><span>Serviço</span><span>Dinâmica</span><span>Preço</span><span>Índice de complexidade</span><span>Cartões</span></div>
      <div class="pg-registro">${lista.map((s) => {
        const c = contagemDe(s);
        return `<a class="pg-linha pg-grade-srv" href="#servico/${s.id}">
          <span class="pg-nome"><span class="pg-sigla">${escHtml(s.sigla)}</span><span><b>${escHtml(s.nome)}</b><small>${escHtml(s.descricao || '')}</small></span></span>
          <span>${etqDinamica(s)}</span><span>${etqPreco(s)}</span><span class="pg-apoio">${textoIC(s)}</span>
          <span class="pg-apoio">${c ? (c.p + c.o + c.ev ? `${c.p} P · ${c.o} O · ${c.ev} eventos` : '<span class="sem">vazio</span>') : ''}</span></a>`;
      }).join('') || '<div class="pg-vazio">Nenhum serviço com esses filtros.</div>'}</div>
      ${blocoTipologias()}
      ${B.arquivados?.length ? `<details class="arquivados"><summary>Arquivados (${B.arquivados.length})</summary>
        <ul class="lista-int">${B.arquivados.map((a, i) => `<li>${escHtml({ servico: 'Serviço', categoria: 'Categoria', uso: 'Uso' }[a.tipo] || a.tipo)} · ${escHtml(a.nome)}
          <button type="button" class="btn-link" data-restaurar="${i}">restaurar</button></li>`).join('')}</ul></details>` : ''}`;
    el.querySelectorAll('[data-restaurar]').forEach((b) => b.onclick = async () => {
      try { await arquivarRegistro(B.arquivados[Number(b.dataset.restaurar)], true); await recarregarTudo(); } catch (err) { aviso(mensagemDe(err)); }
    });
    el.querySelector('#novo-servico').onclick = () => abrirNovoServico();
    el.querySelectorAll('[data-din]').forEach((b) => b.onclick = () => { SERV_FILTRO.din = b.dataset.din; desenharServicos(); });
    const qi = el.querySelector('#serv-q');
    qi.oninput = () => { SERV_FILTRO.q = qi.value; const p = qi.selectionStart; desenharServicos(); const n2 = document.getElementById('serv-q'); n2.focus(); n2.setSelectionRange(p, p); };
    ligarTipologias(el);
  }
  if (ROTA.aba === 'faixas') desenharFaixas();
  desenharPub();
}
const SERV_FILTRO = { din: 'todos', q: '' };

// Serviço novo: vazio (em fluxo ou em ilha) ou cópia de outro
function abrirNovoServico() {
  const painel = abrirPainel(`
    <div class="painel__topo"><h2>Novo serviço</h2><button class="painel__fechar" aria-label="Fechar">×</button></div>
    <div id="p-aviso"></div>
    <form id="f">
      <div class="row-2">
        <div class="field"><label class="field__label">Sigla</label><input type="text" name="sigla" maxlength="4" required placeholder="2 a 4 letras"></div>
        <div class="field"><label class="field__label">Começar com</label><select name="copia">
          <option value="">Vazio</option>${B.servicos.map((s) => `<option value="${s.id}">Cópia de ${escHtml(s.sigla + ' · ' + s.nome)}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label class="field__label">Nome</label><input type="text" name="nome" required></div>
      <div class="field" id="campo-din"><label class="field__label">Dinâmica</label>
        <span class="pg-seletor" role="radiogroup" aria-label="Dinâmica">
          <button type="button" role="radio" data-d="fluxo" aria-checked="true">Em fluxo</button>
          <button type="button" role="radio" data-d="ilha" aria-checked="false">Em ilha</button></span>
        <p class="field__hint" id="dica-din">Entra no plano comum, com tudo opcional: depois você marca o que é pertinente.</p></div>
      <p class="field__hint" id="dica-copia" hidden>Nasce com as configurações do serviço copiado: dinâmica, preço, índice de complexidade, marcações e, se for ilha, os cartões (cópias independentes).</p>
      <div class="painel__acoes"><button class="u-botao forte" type="submit">Criar serviço</button></div>
    </form>`);
  const av = avisoEm(painel.querySelector('#p-aviso'));
  const f = painel.querySelector('#f');
  let din = 'fluxo';
  const dicas = { fluxo: 'Entra no plano comum, com tudo opcional: depois você marca o que é pertinente.', ilha: 'Nasce com uma etapa vazia, com a sigla dele, no Plano das ilhas.' };
  painel.querySelectorAll('[data-d]').forEach((b) => b.onclick = () => {
    din = b.dataset.d;
    painel.querySelectorAll('[data-d]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    painel.querySelector('#dica-din').textContent = dicas[din];
  });
  f.copia.onchange = () => {
    painel.querySelector('#campo-din').hidden = !!f.copia.value;
    painel.querySelector('#dica-copia').hidden = !f.copia.value;
  };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const corpo = { sigla: f.sigla.value.trim(), nome: f.nome.value.trim() };
    if (f.copia.value) corpo.copiar_de = f.copia.value;
    else Object.assign(corpo, { dinamica: din, modificador: null, com_preco: 0 });   // serviço vazio nasce sem preço
    e.submitter.disabled = true;
    try {
      const r = await Universo.criar('bases-servicos', corpo);
      fecharPainel();
      await recarregarTudo();
      location.hash = `servico/${r.id}`;
    } catch (err) { av(mensagemDe(err)); e.submitter.disabled = false; }
  };
  f.sigla.focus();
}

// ---------------------------------------------------------------- Ficha do serviço
let FICHA = null;     // { id, campos: {...} } mudanças não salvas dos textos
function desenharFicha() {
  const el = document.getElementById('ficha');
  const s = srvB(ROTA.srv);
  if (!s) { el.innerHTML = B ? '<div class="pg-vazio">Serviço não encontrado. <a href="#servicos">Voltar aos serviços</a>.</div>' : ''; return; }
  if (FICHA && FICHA.id !== s.id) FICHA = null;
  const v = (k) => (FICHA && k in FICHA.campos ? FICHA.campos[k] : s[k]) ?? '';
  const c = contagemDe(s);
  const etapasIlha = D ? D.etapas.filter((e) => e.servico_id === s.id) : [];
  el.innerHTML = `<div class="blocos-fluxo pg-fluxo" style="--bloco-larg:520px">
      ${bloco('servico', 'Serviço', `
        <div class="pg-campos">
          <label class="u-campo"><span>Sigla</span><input data-c="sigla" value="${escHtml(v('sigla'))}" maxlength="4"></label>
          <label class="u-campo pg-largo"><span>Nome</span><input data-c="nome" value="${escHtml(v('nome'))}"></label>
          <label class="u-campo pg-inteiro"><span>Descrição</span><textarea data-c="descricao" rows="3">${escHtml(v('descricao'))}</textarea></label>
          <label class="u-campo pg-inteiro"><span>Observações (uso interno)</span><textarea data-c="observacoes" rows="2">${escHtml(v('observacoes'))}</textarea></label>
        </div>`)}
      ${bloco('dinamica', 'Dinâmica e preço', `
        <div class="u-campo"><span>Dinâmica</span>
          <span class="pg-seletor" role="radiogroup" aria-label="Dinâmica">
            <button type="button" role="radio" data-dinamica="fluxo" aria-checked="${s.dinamica !== 'ilha'}">Em fluxo</button>
            <button type="button" role="radio" data-dinamica="ilha" aria-checked="${s.dinamica === 'ilha'}">Em ilha</button></span>
          <small>${s.dinamica === 'ilha' ? 'Tem o próprio plano, com cartões só dele. Não pede tipologia.' : 'Entra no plano comum das fases e marca o que é pertinente em cada cartão. Pede tipologia.'}</small></div>
        <div class="u-campo"><span>Preço</span>
          <span class="pg-seletor" role="radiogroup" aria-label="Preço">
            <button type="button" role="radio" data-preco="1" aria-checked="${!!s.com_preco}">Com preço</button>
            <button type="button" role="radio" data-preco="0" aria-checked="${!s.com_preco}">Sem preço</button></span>
          <small>${s.com_preco ? `Calculado pela tabela do CAU${s.modificador != null ? `, com modificador ${fmtNum(s.modificador)}` : ' (o modificador se define no vendas)'}.`
            : 'Sem cálculo: o valor se informa no vendas, em cada proposta.'}
            <a href="https://vendas.odisse.com.br/honorarios.html" target="_blank" rel="noopener">Honorários no vendas ${IC2.fora}</a></small></div>`)}
      ${bloco('plano', s.dinamica === 'ilha' ? 'Plano da ilha' : 'No plano do fluxo', `
        <p class="pg-numeros">${c ? `<span><b>${c.p}</b> entregas que vêm marcadas</span><span><b>${c.o}</b> opcionais</span><span><b>${c.ev}</b> eventos</span>` : ''}
          ${s.dinamica === 'ilha' ? `<span><b>${etapasIlha.length}</b> etapa${etapasIlha.length === 1 ? '' : 's'}</span>` : ''}</p>
        <a class="u-botao pg-meia" href="#servico/${s.id}/pgt">Abrir o PGT de ${escHtml(s.sigla)}</a>`)}
    </div>
    ${blocoIC(s)}
    <p class="pg-arquivar"><button type="button" class="btn-link perigo" id="arquivar-srv">Arquivar serviço</button></p>
    ${FICHA && Object.keys(FICHA.campos).length ? `<div class="pg-barra-salvar"><span>Mudanças não salvas na ficha</span><div>
      <button type="button" class="u-botao" id="ficha-descartar">Descartar</button><button type="button" class="u-botao forte" id="ficha-salvar">Salvar</button></div></div>` : ''}`;
  ligarBlocos(el);
  el.querySelectorAll('[data-c]').forEach((i) => i.addEventListener('input', () => {
    FICHA = FICHA || { id: s.id, campos: {} };
    const val = i.dataset.c === 'sigla' ? i.value.toUpperCase() : i.value;
    if ((s[i.dataset.c] ?? '') === val) delete FICHA.campos[i.dataset.c]; else FICHA.campos[i.dataset.c] = val;
    redesenharBarraFicha();
  }));
  el.querySelectorAll('[data-dinamica]').forEach((b) => b.onclick = () => trocarDinamica(s, b.dataset.dinamica));
  el.querySelectorAll('[data-preco]').forEach((b) => b.onclick = () => trocarPreco(s, Number(b.dataset.preco)));
  ligarIC(el, s);
  el.querySelector('#arquivar-srv').onclick = async () => {
    if (!confirm(`Arquivar ${s.sigla} · ${s.nome}? Ele sai dos serviços e do plano (as marcações e os cartões ficam guardados; dá para restaurar no fim da página Serviços).`)) return;
    try { await arquivarRegistro(s); await recarregarTudo(); location.hash = 'servicos'; } catch (err) { aviso(mensagemDe(err)); }
  };
  ligarBarraFicha(s);
}
function redesenharBarraFicha() {
  const s = srvB(ROTA.srv);
  const tem = FICHA && Object.keys(FICHA.campos).length;
  let barra = document.querySelector('#ficha .pg-barra-salvar');
  if (!tem) { barra?.remove(); document.body.classList.remove('pg-com-barra'); return; }
  if (!barra) {
    document.getElementById('ficha').insertAdjacentHTML('beforeend', `<div class="pg-barra-salvar"><span>Mudanças não salvas na ficha</span><div>
      <button type="button" class="u-botao" id="ficha-descartar">Descartar</button><button type="button" class="u-botao forte" id="ficha-salvar">Salvar</button></div></div>`);
    ligarBarraFicha(s);
  }
  document.body.classList.add('pg-com-barra');
}
function ligarBarraFicha(s) {
  const sal = document.getElementById('ficha-salvar');
  if (!sal) return;
  document.body.classList.add('pg-com-barra');
  sal.onclick = salvarFicha;
  document.getElementById('ficha-descartar').onclick = () => { FICHA = null; document.body.classList.remove('pg-com-barra'); desenharFicha(); };
}
async function salvarFicha() {
  const s = srvB(ROTA.srv);
  if (!FICHA || !s) return;
  const campos = Object.fromEntries(Object.entries(FICHA.campos).map(([k, v]) => [k, String(v).trim() || null]));
  if (campos.sigla === null || campos.nome === null) { aviso('Sigla e nome não podem ficar vazios.'); return; }
  try {
    await Universo.alterar('bases-servicos', s.id, { versao: s.versao, ...campos });
    FICHA = null; document.body.classList.remove('pg-com-barra');
    aviso('Ficha salva.', 'ok'); setTimeout(() => aviso(''), 2500);
    await recarregarTudo();
    mostrarRota();
  } catch (err) { aviso(mensagemDe(err)); if (err.status === 409) carregarBases({ soNovo: true }); }
}
document.addEventListener('keydown', (ev) => {
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's' && FICHA && Object.keys(FICHA.campos).length) { ev.preventDefault(); ev.stopImmediatePropagation(); salvarFicha(); }
}, true);
window.addEventListener('beforeunload', (ev) => { if (FICHA && Object.keys(FICHA.campos).length) { ev.preventDefault(); ev.returnValue = ''; } });

async function trocarDinamica(s, din) {
  if ((s.dinamica || 'fluxo') === din) return;
  const msg = din === 'ilha'
    ? `Pôr ${s.sigla} em ilha? Ele passa a ter o próprio plano (uma etapa vazia, se ainda não tiver) e deixa de pedir tipologia. As marcações dele no plano do fluxo ficam guardadas e voltam se ele voltar ao fluxo.`
    : `Pôr ${s.sigla} no fluxo? Ele entra no plano comum das fases${'' } (com tudo opcional, se nunca esteve lá) e passa a pedir tipologia. Os cartões da ilha ficam guardados e voltam se ele voltar à ilha.`;
  if (!confirm(msg)) return;
  try {
    await Universo.alterar('bases-servicos', s.id, { versao: s.versao, dinamica: din });
    aviso(`${s.sigla} agora está ${din === 'ilha' ? 'em ilha' : 'em fluxo'}.`, 'ok');
    await recarregarTudo(); mostrarRota();
  } catch (err) { aviso(mensagemDe(err)); }
}
async function trocarPreco(s, com) {
  if (!!s.com_preco === !!com) return;
  try {
    await Universo.alterar('bases-servicos', s.id, { versao: s.versao, com_preco: com });
    aviso(`${s.sigla}: ${com ? 'com preço calculado' : 'sem preço calculado'}. Vale nas propostas depois que os Honorários forem publicados no vendas.`, 'ok');
    await carregarBases({ soNovo: true });
  } catch (err) { aviso(mensagemDe(err)); }
}

// Bloco recolhível (seta à direita, estado lembrado)
const BLOCOS_FECHADOS = new Set((() => { try { return JSON.parse(localStorage.getItem('pgt:blocos') || '["tipologias"]'); } catch (_) { return ['tipologias']; } })());
const bloco = (id, titulo, corpo, extra = '') => `<section class="pg-bloco${BLOCOS_FECHADOS.has(id) ? ' fechado' : ''}" data-bloco="${id}">
  <div class="pg-bloco-cab"><button type="button" class="pg-bloco-alterna" aria-expanded="${!BLOCOS_FECHADOS.has(id)}"><h3 class="pg-bloco-h">${titulo}</h3></button>
    ${extra}<span class="pg-caixa pg-bloco-seta" aria-hidden="true">${IC2.seta}</span></div>
  <div class="pg-bloco-corpo">${corpo}</div></section>`;
function ligarBlocos(raiz) {
  raiz.querySelectorAll('.pg-bloco').forEach((b) => {
    const alternar = () => {
      const id = b.dataset.bloco;
      b.classList.toggle('fechado');
      if (b.classList.contains('fechado')) BLOCOS_FECHADOS.add(id); else BLOCOS_FECHADOS.delete(id);
      b.querySelector('.pg-bloco-alterna').setAttribute('aria-expanded', String(!b.classList.contains('fechado')));
      try { localStorage.setItem('pgt:blocos', JSON.stringify([...BLOCOS_FECHADOS])); } catch (_) { /* sem armazenamento */ }
    };
    b.querySelector('.pg-bloco-alterna').onclick = alternar;
    b.querySelector('.pg-bloco-seta').onclick = alternar;
  });
}

// ---------------------------------------------------------------- índice de complexidade
//   ilha: uma linha só (o índice do serviço). fluxo: Matriz categorias × critérios; a categoria sem valor próprio
//   aparece tracejada com o padrão do serviço (oculto); mexer num critério cria o valor próprio dela.
const NIVEL_CURTO = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto' };
const selIC = (valor, attrs, herdado = false) => `<select class="pg-ic ${herdado ? 'herdado' : 'nv-' + (valor || 'medio')}" ${attrs} aria-label="Nível">
  ${NIVEIS.map((n) => `<option value="${n.id}" ${n.id === (valor || 'medio') ? 'selected' : ''}>${NIVEL_CURTO[n.id]}</option>`).join('')}</select>`;
function blocoIC(s) {
  const cab = `<thead><tr><th>${s.dinamica === 'ilha' ? '' : 'Categoria da tipologia'}</th>${CRITERIOS_IC.map((c) => `<th class="pg-vertical" title="${escHtml(c.longo)}"><span>${escHtml(c.nome)}</span></th>`).join('')}<th></th></tr></thead>`;
  if (s.dinamica === 'ilha') {
    return bloco('ic', 'Índice de complexidade', `<div class="pg-matriz"><table class="u-tabela pg-tabela-ic">${cab}<tbody><tr>
      <td><b>${escHtml(s.sigla)}</b></td>${CRITERIOS_IC.map((k) => `<td>${selIC((s.ic_padrao || {})[k.id], `data-ic-padrao="${k.id}"`)}</td>`).join('')}<td></td></tr></tbody></table></div>`,
      '<span class="pg-etq">do serviço</span>');
  }
  let linhas = '';
  for (const g of GRUPOS) {
    const cats = B.categorias.filter((c) => c.grupo === g.id);
    if (!cats.length) continue;
    linhas += `<tr class="pg-grupo"><td colspan="${CRITERIOS_IC.length + 2}">${escHtml(g.nome)}</td></tr>`;
    for (const c of cats) {
      const proprio = (s.ic_categorias || {})[c.id];
      const val = (k) => (proprio && proprio[k]) || (s.ic_padrao || {})[k] || 'medio';
      linhas += `<tr class="${proprio ? '' : 'pg-herda'}" data-cat="${c.id}"><td>${escHtml(c.nome)}${proprio ? '' : ' <span class="pg-etq tracejada" title="Sem valor próprio: vale o padrão do serviço">padrão</span>'}</td>
        ${CRITERIOS_IC.map((k) => `<td>${selIC(val(k.id), `data-ic-cat="${c.id}" data-k="${k.id}"`, !proprio)}</td>`).join('')}
        <td>${proprio ? `<button type="button" class="pg-caixa" data-ic-volta="${c.id}" title="Voltar ao padrão do serviço" aria-label="Voltar ao padrão">${IC2.volta}</button>` : ''}</td></tr>`;
    }
  }
  return bloco('ic', 'Índice de complexidade', `<div class="pg-matriz"><table class="u-tabela pg-tabela-ic">${cab}<tbody>${linhas}</tbody></table></div>`,
    '<span class="pg-etq">por categoria</span>');
}
function ligarIC(el, s) {
  el.querySelectorAll('[data-ic-padrao]').forEach((sel) => sel.onchange = async () => {
    sel.disabled = true;
    try { await Universo.alterar('bases-servicos', s.id, { versao: s.versao, ic_padrao: { ...(s.ic_padrao || {}), [sel.dataset.icPadrao]: sel.value } }); }
    catch (err) { aviso(mensagemDe(err)); }
    await carregarBases({ soNovo: true });
  });
  el.querySelectorAll('[data-ic-cat]').forEach((sel) => sel.onchange = async () => {
    const cat = sel.dataset.icCat;
    const atual = (s.ic_categorias || {})[cat] || Object.fromEntries(CRITERIOS_IC.map((k) => [k.id, (s.ic_padrao || {})[k.id] || 'medio']));
    sel.disabled = true;
    try { await Universo.post('bases/ic', { servico_id: s.id, categoria_id: cat, ic: { ...atual, [sel.dataset.k]: sel.value } }); }
    catch (err) { aviso(mensagemDe(err)); }
    await carregarBases({ soNovo: true });
  });
  el.querySelectorAll('[data-ic-volta]').forEach((b) => b.onclick = async () => {
    b.disabled = true;
    try { await Universo.post('bases/ic', { servico_id: s.id, categoria_id: b.dataset.icVolta, ic: null }); }
    catch (err) { aviso(mensagemDe(err)); }
    await carregarBases({ soNovo: true });
  });
}

// ---------------------------------------------------------------- Tipologias (comum a todos os serviços)
function blocoTipologias() {
  let linhas = '';
  for (const g of GRUPOS) {
    const cats = B.categorias.filter((c) => c.grupo === g.id);
    if (!cats.length) continue;
    linhas += `<tr class="pg-grupo"><td colspan="6">${escHtml(g.nome)}</td></tr>`;
    for (const c of cats) {
      const usos = B.usos.filter((u) => u.categoria_id === c.id);
      linhas += `<tr class="pg-cat"><td colspan="5"><button type="button" class="pg-caixa" data-cat-ed="${c.id}" title="Editar a categoria" aria-label="Editar">${IC2.lapis}</button> <b>${escHtml(c.nome)}</b> <span class="pg-apoio">${usos.length} uso${usos.length === 1 ? '' : 's'}</span></td>
        <td class="pg-dir"><button type="button" class="btn-link" data-uso-novo="${c.id}">+ uso</button></td></tr>`;
      linhas += usos.map((u) => `<tr class="clicavel" data-uso="${u.id}" tabindex="0"><td class="codigo">${escHtml(u.item || '')}</td><td>${escHtml(u.descricao)}</td>
        <td class="codigo centro">${escHtml(u.cub_codigo || '—')}</td><td class="centro">${u.categoria_cau ?? '—'}</td><td class="centro">${fmtNum(u.fator_adequacao, 2)}</td><td></td></tr>`).join('');
    }
  }
  return `<section class="pg-secao">
    <div class="pg-cab-secao"><h2 class="u-subtitulo">Tipologias</h2><button type="button" class="u-botao" id="nova-categoria">${IC2.mais}<span>Nova categoria</span></button></div>
    ${bloco('tipologias', 'Categorias e usos', `<div class="pg-matriz"><table class="u-tabela pg-tabela-usos">
      <thead><tr><th>Item CAU</th><th>Uso</th><th class="centro">Código do CUB</th><th class="centro">Cat. CAU</th><th class="centro">Fator</th><th></th></tr></thead>
      <tbody>${linhas}</tbody></table></div>`)}
  </section>`;
}
function ligarTipologias(el) {
  ligarBlocos(el);
  el.querySelector('#nova-categoria').onclick = () => abrirCategoria(null);
  el.querySelectorAll('[data-cat-ed]').forEach((b) => b.onclick = () => abrirCategoria(B.categorias.find((c) => c.id === b.dataset.catEd)));
  el.querySelectorAll('[data-uso-novo]').forEach((b) => b.onclick = () => abrirUso(null, b.dataset.usoNovo));
  el.querySelectorAll('tr[data-uso]').forEach((tr) => {
    const abrir = () => abrirUso(B.usos.find((u) => u.id === tr.dataset.uso));
    tr.onclick = abrir; tr.onkeydown = (e) => { if (e.key === 'Enter') abrir(); };
  });
}
function abrirCategoria(c) {
  const novo = !c;
  c = c || { grupo: 'residencial', nome: '', observacoes: '' };
  const painel = abrirPainel(`
    <div class="painel__topo"><h2>${novo ? 'Nova categoria' : escHtml(c.nome)}</h2><button class="painel__fechar" aria-label="Fechar">×</button></div>
    <div id="p-aviso"></div>
    <form id="f">
      <div class="field"><label class="field__label">Nome</label><input type="text" name="nome" value="${escHtml(c.nome)}" required placeholder="Ex.: Residencial Unifamiliar"></div>
      <div class="field"><label class="field__label">Grupo</label><select name="grupo">${opcoes(GRUPOS, c.grupo)}</select></div>
      <div class="field"><label class="field__label">Observações</label><textarea name="observacoes" rows="2">${escHtml(c.observacoes || '')}</textarea></div>
      <p class="field__hint">O índice de complexidade de cada categoria se ajusta na ficha de cada serviço em fluxo.</p>
      <div class="painel__acoes"><button class="u-botao forte" type="submit">${novo ? 'Criar categoria' : 'Salvar'}</button>
        ${novo ? '' : '<button class="btn-link perigo" type="button" id="arquivar">Arquivar</button>'}</div>
    </form>`);
  const av = avisoEm(painel.querySelector('#p-aviso'));
  const f = painel.querySelector('#f');
  f.onsubmit = async (e) => {
    e.preventDefault();
    const corpo = { nome: f.nome.value, grupo: f.grupo.value, observacoes: f.observacoes.value || null };
    try {
      if (novo) await Universo.criar('bases-categorias', { ...corpo, ic_preset: {} });
      else await Universo.alterar('bases-categorias', c.id, { versao: c.versao, ...corpo });
      fecharPainel(); carregarBases({ soNovo: true });
    } catch (err) { av(mensagemDe(err)); }
  };
  const arq = painel.querySelector('#arquivar');
  if (arq) arq.onclick = async () => {
    if (!confirm(`Arquivar a categoria ${c.nome}? Os usos dela saem junto.`)) return;
    try { await arquivarRegistro(c); fecharPainel(); carregarBases({ soNovo: true }); } catch (err) { av(mensagemDe(err)); }
  };
}
function abrirUso(u, categoriaId) {
  const novo = !u;
  u = u || { categoria_id: categoriaId, item: '', descricao: '', categoria_cau: null, cub_codigo: '', cub_referencia: null, fator_adequacao: 1, observacoes: '' };
  const codigos = [...new Set(B.usos.map((x) => x.cub_codigo).filter(Boolean))].sort();
  const painel = abrirPainel(`
    <div class="painel__topo"><h2>${novo ? 'Novo uso' : escHtml(u.descricao)}</h2><button class="painel__fechar" aria-label="Fechar">×</button></div>
    <div id="p-aviso"></div>
    <form id="f">
      <div class="field"><label class="field__label">Categoria</label><select name="categoria_id">${opcoes(B.categorias, u.categoria_id)}</select></div>
      <div class="field"><label class="field__label">Descrição do uso</label><input type="text" name="descricao" value="${escHtml(u.descricao)}" required></div>
      <div class="row-2">
        <div class="field"><label class="field__label">Item na tabela do CAU</label><input type="text" name="item" value="${escHtml(u.item || '')}" placeholder="1.2"></div>
        <div class="field"><label class="field__label">Categoria do fator percentual (CAU)</label><select name="categoria_cau">${opcoes([1, 2, 3, 4].map((n) => ({ id: String(n), nome: String(n) })), u.categoria_cau ? String(u.categoria_cau) : '', '—')}</select></div>
      </div>
      <div class="field"><label class="field__label">Código do CUB</label>
        <input type="text" name="cub_codigo" value="${escHtml(u.cub_codigo || '')}" placeholder="R-16-A" list="codigos-cub">
        <datalist id="codigos-cub">${codigos.map((c) => `<option value="${c}">`).join('')}</datalist></div>
      <div class="row-2">
        <div class="field"><label class="field__label">Fator de adequação</label><input type="text" inputmode="decimal" name="fator_adequacao" value="${fmtNum(u.fator_adequacao)}"></div>
        <div class="field"><label class="field__label">CUB de referência (R$/m²)</label><input type="text" inputmode="decimal" name="cub_referencia" value="${fmtNum(u.cub_referencia)}">
          <p class="field__hint">Reserva, só se o código sair da tabela do Sinduscon.</p></div>
      </div>
      <div class="field"><label class="field__label">Observações</label><textarea name="observacoes" rows="2">${escHtml(u.observacoes || '')}</textarea></div>
      <div class="painel__acoes"><button class="u-botao forte" type="submit">${novo ? 'Criar uso' : 'Salvar'}</button>
        ${novo ? '' : '<button class="btn-link perigo" type="button" id="arquivar">Arquivar</button>'}</div>
    </form>`);
  const av = avisoEm(painel.querySelector('#p-aviso'));
  const f = painel.querySelector('#f');
  f.onsubmit = async (e) => {
    e.preventDefault();
    const fator = lerNum(f.fator_adequacao.value); const ref = lerNum(f.cub_referencia.value);
    if (Number.isNaN(fator) || Number.isNaN(ref)) return av('Fator e CUB de referência: números (ex.: 1,5).');
    const corpo = { categoria_id: f.categoria_id.value, descricao: f.descricao.value, item: f.item.value || null,
      categoria_cau: f.categoria_cau.value ? Number(f.categoria_cau.value) : null, cub_codigo: f.cub_codigo.value || null,
      fator_adequacao: fator, cub_referencia: ref, observacoes: f.observacoes.value || null };
    try {
      if (novo) await Universo.criar('bases-usos', corpo); else await Universo.alterar('bases-usos', u.id, { versao: u.versao, ...corpo });
      fecharPainel(); carregarBases({ soNovo: true });
    } catch (err) { av(mensagemDe(err)); }
  };
  const arq = painel.querySelector('#arquivar');
  if (arq) arq.onclick = async () => {
    if (!confirm(`Arquivar o uso ${u.descricao}?`)) return;
    try { await arquivarRegistro(u); fecharPainel(); carregarBases({ soNovo: true }); } catch (err) { av(mensagemDe(err)); }
  };
}

// ---------------------------------------------------------------- Faixas e prazo
const fmtArea = (n) => Number(n).toLocaleString('pt-BR');
let FAIXAS_RASCUNHO = null;
function desenharFaixas() {
  const el = document.getElementById('faixas');
  if (!el || !B) return;
  const fx = (FAIXAS_RASCUNHO || B.faixas_prazo || []).map((f) => ({ ...f }));
  const linha = (f, i) => {
    const de = i === 0 ? 0 : fx[i - 1].ate;
    const ult = i === fx.length - 1;
    return `<tr data-i="${i}"><td class="tabular">${i + 1}</td>
      <td class="tabular">${i === 0 ? 'até' : `de ${fmtArea(de ?? 0)} até`}</td>
      <td>${ult ? '<span class="sem">sem teto</span>' : `<span class="pg-unidade"><input type="number" min="1" step="1" data-ate value="${f.ate ?? ''}"><i>m²</i></span>`}</td>
      <td><span class="pg-unidade"><input type="number" min="0.1" max="10" step="0.05" data-mult value="${f.mult}"><i>×</i></span></td>
      <td>${fx.length > 1 ? '<button type="button" class="pg-caixa" data-tirar title="Tirar a faixa" aria-label="Tirar">×</button>' : ''}</td></tr>`;
  };
  const turnos = [['1 turno', '4 horas'], ['1 dia', '2 turnos'], ['1 semana', '5 dias (10 turnos)'], ['1 mês', '4 semanas (40 turnos)']];
  el.innerHTML = `<div class="blocos-fluxo pg-fluxo" style="--bloco-larg:560px">
    ${bloco('faixas', 'Faixas de prazo por área', `<table class="u-tabela pg-tabela-faixas"><thead><tr><th>Faixa</th><th></th><th>Área máxima</th><th>Multiplicador</th><th></th></tr></thead>
      <tbody>${fx.map(linha).join('')}</tbody></table>
      <div class="pg-acoes-bloco"><button type="button" class="u-botao" id="fx-mais">${IC2.mais}<span>Acrescentar faixa</span></button>
        <button type="button" class="u-botao" id="fx-salvar" ${FAIXAS_RASCUNHO ? '' : 'disabled'}>Salvar faixas</button></div>`)}
    ${bloco('turnos', 'Conversão dos prazos', `<table class="u-tabela"><tbody>${turnos.map(([a, b]) => `<tr><td><b>${a}</b></td><td>${b}</td></tr>`).join('')}</tbody></table>`)}
  </div>`;
  ligarBlocos(el);
  const ler = () => [...el.querySelectorAll('.pg-tabela-faixas tbody tr')].map((tr, i, todas) => ({
    ate: i === todas.length - 1 ? null : lerNum(tr.querySelector('[data-ate]').value), mult: lerNum(tr.querySelector('[data-mult]').value) }));
  const mudou = (l) => { FAIXAS_RASCUNHO = l; desenharFaixas(); };
  el.querySelectorAll('[data-tirar]').forEach((b) => b.onclick = () => {
    const l = ler(); l.splice(Number(b.closest('tr').dataset.i), 1); if (l.length) l[l.length - 1].ate = null; mudou(l);
  });
  el.querySelector('#fx-mais').onclick = () => {
    const l = ler(); const ant = l.length > 1 ? l[l.length - 2].ate || 0 : 0;
    l.splice(l.length - 1, 0, { ate: ant ? ant * 2 : 150, mult: l[l.length - 1]?.mult || 1 }); mudou(l);
  };
  el.querySelectorAll('[data-ate], [data-mult]').forEach((i) => i.onchange = () => mudou(ler()));
  el.querySelector('#fx-salvar').onclick = async (ev) => {
    ev.currentTarget.disabled = true;
    try { await Universo.post('bases/faixas-prazo', { faixas: ler() }); FAIXAS_RASCUNHO = null; aviso('Faixas gravadas.', 'ok'); await carregarBases({ soNovo: true }); desenharFaixas(); }
    catch (err) { aviso(mensagemDe(err)); ev.currentTarget.disabled = false; }
  };
}

// ---------------------------------------------------------------- notas do fim (explicações ficam aqui, não no topo)
function desenharNotas() {
  const el = document.getElementById('notas');
  if (!el) return;
  const N = {
    servicos: [['Em fluxo e em ilha', 'Serviço em fluxo entra no plano comum das fases e marca o que é pertinente em cada cartão; pede tipologia, e o índice de complexidade se ajusta por categoria. Serviço em ilha tem o próprio plano, com cartões só dele, e um índice só.'],
      ['Trocar a dinâmica', 'Nada se perde: as marcações do fluxo e os cartões da ilha ficam guardados e voltam quando o serviço volta para a dinâmica deles. Ao entrar no fluxo pela primeira vez, tudo vem como opcional.'],
      ['Preço e publicação', 'O valor (modificador, pesos, parcelas) é do vendas, em Honorários. Publicar grava os serviços e o plano de uma vez; o vendas usa a versão publicada nas propostas novas.']],
    servico: [['Índice de complexidade', 'Em fluxo, cada categoria pode ter o próprio índice; sem valor próprio (tracejada), vale o padrão do serviço. Em ilha, vale o índice do serviço. Empenho e detalhamento são calculados na proposta.'],
      ['Com preço e sem preço', 'Com preço, o honorário sai da tabela do CAU com o modificador do serviço. Sem preço, o valor se informa em cada proposta.']],
    faixas: [['Faixas de prazo', 'O prazo de cada entrega no plano é o de referência. Na proposta, com a área conhecida, o vendas multiplica esse prazo pelo da faixa. Entregas de prazo fixo e eventos não mudam. Valores provisórios, a calibrar.']],
    fluxo: [['Plano do fluxo', 'Fases encadeadas: prazos em sequência e parcelas ao concluir cada fase. Só aparecem os serviços em fluxo. A Linha mostra o mesmo plano no tempo.'],
      ['Correr junto', 'O símbolo de uma entrega a liga à de cima. A primeira do grupo fica no tom forte; as ligadas abaixo, no tom sutil. No prazo da etapa conta a mais longa do grupo.']],
    ilhas: [['Plano das ilhas', 'Serviços avulsos, contratados à parte, fora do encadeamento e das parcelas. Cada ilha tem as próprias etapas e cartões; o que se cria numa ilha já nasce marcado para ela.']],
    materiais: [['Materiais', 'Modelos, formulários, checklists e referências de uso interno, ligados a uma etapa, a uma entrega ou a um evento. Por enquanto, por link; o envio de arquivos e a criação de formulários vêm depois. Os filtros de cima também valem aqui.']],
  };
  const lista = N[ROTA.aba] || [];
  el.innerHTML = lista.length ? `<section class="pg-secao pg-notas">${lista.map(([t, p]) => `<div><h3 class="u-rotulo">${t}</h3><p>${p}</p></div>`).join('')}</section>` : '';
}
