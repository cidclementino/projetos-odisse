// ==========================================================================
// Escopo do Projeto — calendário, Linha, Cartões e Alterações (Cid, 20/11/2026).
//
//   * O escopo é a lista de etapas, entregas e eventos contratados (cópia do PGT), cada cartão com a sua duração.
//   * Calendário: início + durações em sequência, em dias úteis (seg–sex; sem feriados por ora); os que correm
//     juntos no mesmo intervalo; a suspensão do projeto congela os dias. "Em andamento" é o que cai em hoje:
//     nenhum estado se marca no cartão.
//   * Ajustes do dia a dia: DURAÇÃO (− / +, à vista no cartão: os seguintes andam junto) e MOVER sem mudar a
//     duração (dentro do cartão: abre um hiato antes dele, ou corre em paralelo para trás).
//   * Suprimir e acrescentar cartões; decisões liberam a rodada prevista (extra previsto).
//   * Tudo o que muda vai para Alterações de escopo (a API junta cliques seguidos em 10 s).
// Usa as globais de base.js (Universo, escHtml, abrirPainel, fecharPainel, avisoEm, mensagemDe).
// ==========================================================================

const ESC_IC = {
  lapis: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.8 2.6 13.4 5.2 6 12.6 3 13 3.4 10Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  menos: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 7h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  mais: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 3v8M3 7h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  esq: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M8.5 3.5 5 7l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dir: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M5.5 3.5 9 7l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const ESC_DIA = 86400000;
const escDia = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const escISO = (t) => new Date(t).toISOString().slice(0, 10);
const escHoje = () => escDia(new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10));
const ESC_SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const escDM = (t) => { const d = new Date(t); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
const escDMA = (t) => `${escDM(t)}/${new Date(t).getUTCFullYear()}`;
const escDiaFmt = (s) => (s ? s.split('-').reverse().join('/') : '');
const plural = (n, um, varios) => `${n} ${Math.abs(n) === 1 ? um : varios}`;

// cores das fases (as mesmas da Linha do PGT); borda do cartão = fase
const ESC_COR_FASE = { pfa_conceitual: '#1D9E75', pfa_legal: '#D85A30', pfa_executiva: '#7F77DD', pfa_obra: '#BA7517', pfa_ilhas: '#888780' };
const ESC_CORES = ['#1D9E75', '#D85A30', '#7F77DD', '#BA7517', '#C2577F', '#3B8C9E', '#888780'];

// ---------------------------------------------------------------- montar o escopo a partir do PGT publicado
// cfg = { servicoId, area, categoriaId, etapas: [pet] | null, entregas: { pet: [pen] } | null, clausulas: [pev], semanas: { pet: n } | null }
function escMontar(P, B, cfg) {
  const srv = cfg.servicoId;
  const servico = ((B && B.servicos) || P.servicos || []).find((s) => s.id === srv);
  const faixas = (B && B.faixas_prazo) || [];
  const fx = !(cfg.area > 0) || !faixas.length ? 1 : (faixas.find((f) => f.ate == null || cfg.area <= f.ate) || faixas[faixas.length - 1]).mult || 1;
  const ehEntP = (x) => String(x.id).startsWith('pen_');
  const pertEtapa = (e) => (e.servicos && e.servicos[srv] ? e.servicos[srv].pertinencia || e.servicos[srv] : null);
  const etapasSrv = P.etapas.filter((e) => pertEtapa(e) && (servico?.dinamica === 'ilha' ? e.servico_id === srv : !e.servico_id));
  const escolhidas = cfg.etapas ? etapasSrv.filter((e) => cfg.etapas.includes(e.id)) : etapasSrv.filter((e) => pertEtapa(e) === 'P');
  const liberadoPor = {};
  for (const v of P.eventos) for (const r of (v.decisao || []).slice(1)) for (const id of r.libera || []) liberadoPor[id] = v.id;
  const cls = new Set(cfg.clausulas || []);
  const fases = Object.fromEntries((P.fases || []).map((f) => [f.id, f]));
  const cartoes = [];
  const enc = P.eventos.find((x) => x.encerramento);
  const ultimaComEnc = enc ? [...escolhidas].reverse().find((e) => (enc.instancias || []).includes(e.id)) || escolhidas[escolhidas.length - 1] : null;
  const diasDe = (x) => {
    if (ehEntP(x)) { const t = x.prazo_turnos; return t ? { dias: Math.max(1, Math.ceil((t * (x.prazo_fixo ? 1 : fx)) / 2)) } : { dias: 1, sem: true }; }
    if (x.tempo === 'cliente') return { dias: 3 };
    if (x.tempo === 'terceiros') return { dias: 7 };
    if (x.tempo === 'pontual') return { dias: 1 };
    const t = x.prazo_turnos; return t ? { dias: Math.max(1, Math.ceil(t / 2)) } : { dias: 1, sem: true };
  };
  for (const e of escolhidas) {
    const fa = fases[e.fase_id] || {};
    cartoes.push({ ref: e.id, tipo: 'etapa', origem_id: e.id, sigla: e.sigla, texto: e.nome, fase_id: e.fase_id, fase_nome: fa.nome || '' });
    const passos = [...P.entregaveis.filter((x) => x.etapa_id === e.id), ...P.eventos.filter((x) => x.etapa_id === e.id && !x.encerramento)]
      .sort((a, b) => (a.ordem - b.ordem) || ((ehEntP(a) ? 0 : 1) - (ehEntP(b) ? 0 : 1)) || String(a.id).localeCompare(String(b.id)));
    const etapaCartoes = [];
    for (const x of passos) {
      const p = x.servicos ? x.servicos[srv] : null;
      if (!p) continue;
      const lib = liberadoPor[x.id];
      let entra;
      if (ehEntP(x)) {
        const cat = !cfg.categoriaId || !(x.categorias || []).length || x.categorias.includes(cfg.categoriaId);
        entra = cfg.entregas && cfg.entregas[e.id] ? cfg.entregas[e.id].includes(x.id) : p === 'P' && cat;
      } else {
        entra = p === 'P' || p === 'S' || (p === 'O' && cls.has(x.id)) || !!lib;
      }
      if (!entra) continue;
      const d = diasDe(x);
      etapaCartoes.push({ ref: x.id, tipo: ehEntP(x) ? 'entrega' : 'evento', etapa_ref: e.id, origem_id: x.id, codigo: x.codigo, texto: x.texto || x.nome,
        fase_id: e.fase_id, fase_nome: fa.nome || '', evento_tipo: x.tipo || null, tempo: ehEntP(x) ? null : (x.tempo || 'estudio'),
        cliente: !!x.cliente, terceiros: !!x.terceiros, junto_anterior: ehEntP(x) && !!x.junto_anterior, dias: d.dias, sem_prazo: !!d.sem,
        decisao: x.decisao || null, liberado_por_ref: lib || null });
    }
    // prazo personalizado da etapa (proposta ou "Gerar escopo"): as entregas e os eventos do estúdio se ajustam na proporção
    const alvo = cfg.semanas && cfg.semanas[e.id] ? Math.round(cfg.semanas[e.id] * 5) : 0;
    if (alvo > 0) {
      const seq = etapaCartoes.filter((c) => !c.liberado_por_ref);
      const ajustaveis = seq.filter((c) => c.tipo === 'entrega' || c.tempo === 'estudio');
      const total = escDuracaoDaSequencia(seq);
      if (total > 0 && total !== alvo && ajustaveis.length) {
        const f = alvo / total;
        for (const c of ajustaveis) c.dias = Math.max(1, Math.round(c.dias * f));
      }
    }
    cartoes.push(...etapaCartoes);
    if (enc && ultimaComEnc && ultimaComEnc.id === e.id) {
      cartoes.push({ ref: enc.id, tipo: 'evento', etapa_ref: e.id, origem_id: enc.id, codigo: 'ENC', texto: enc.nome || 'Encerramento', fase_id: e.fase_id,
        fase_nome: fa.nome || '', evento_tipo: 'encerramento', tempo: 'pontual', encerramento: true, dias: 1 });
    }
  }
  return cartoes;
}
// dias de uma sequência de cartões (os que correm juntos contam pela mais longa)
function escDuracaoDaSequencia(lista, soma = false) {
  if (soma) return lista.reduce((t, c) => t + c.dias, 0);
  let t = 0, grupo = 0;
  for (const c of lista) {
    if (c.tipo === 'entrega' && c.junto_anterior && grupo) { const g = Math.max(grupo, c.dias); t += g - grupo; grupo = g; }
    else { t += c.dias; grupo = c.tipo === 'entrega' ? c.dias : 0; }
  }
  return t;
}

// ---------------------------------------------------------------- calendário
// devolve { itens: [{ c, ini, fim, estado }], hiatos: [{ antes, ini, fim, dias }], etapas: [{ c, ini, fim }], inicio, fim, hoje }
function escCalendario(E) {
  const hoje = escHoje();
  const sus = (E.projeto.suspensoes || []).map((s) => ({ de: escDia(s.de), ate: s.ate ? escDia(s.ate) : hoje + ESC_DIA }));
  const util = (t) => { const w = new Date(t).getUTCDay(); return w !== 0 && w !== 6 && !sus.some((s) => t >= s.de && t < s.ate); };
  const prox = (t) => { let n = 0; while (!util(t) && n++ < 4000) t += ESC_DIA; return t; };
  const somar = (t, n) => { for (let i = 0; i < n; i++) t = prox(t + ESC_DIA); return t; };
  const voltar = (t, n) => { for (let i = 0; i < n; i++) { t -= ESC_DIA; let k = 0; while (!util(t) && k++ < 4000) t -= ESC_DIA; } return t; };
  const inicio = prox(escDia(E.projeto.escopo_inicio || E.projeto.inicio || escISO(hoje)));
  const porId = Object.fromEntries(E.cartoes.map((c) => [c.id, c]));
  const ativo = (c) => {
    if (c.suprimido_em) return false;
    if (c.etapa_id && porId[c.etapa_id]?.suprimido_em) return false;
    if (!c.liberado_por) return true;
    const d = porId[c.liberado_por];
    const r = d && (d.decisao || []).find((x) => x.id === d.decisao_resultado);
    return !!(r && r.libera.includes(c.id));
  };
  const itens = []; const hiatos = []; const etapas = [];
  let cursor = inicio;
  for (const et of E.cartoes.filter((c) => c.tipo === 'etapa')) {
    let grupo = null;
    const filhos = E.cartoes.filter((c) => c.etapa_id === et.id);
    const doEtapa = [];
    for (const c of filhos) {
      if (!ativo(c)) continue;
      const base = c.tipo === 'entrega' && c.junto_anterior && grupo ? grupo.ini : cursor;
      const ini = c.folga > 0 ? somar(base, c.folga) : c.folga < 0 ? voltar(base, -c.folga) : base;
      if (c.folga > 0) hiatos.push({ antes: c, ini: base, fim: ini, dias: c.folga });
      const fim = somar(ini, c.dias);
      const it = { c, ini, fim, estado: fim <= hoje ? 'feito' : ini <= hoje ? 'hoje' : 'adiante' };
      itens.push(it); doEtapa.push(it);
      if (c.tipo === 'entrega' && c.junto_anterior && grupo) { grupo.fim = Math.max(grupo.fim, fim); cursor = grupo.fim; }
      else { cursor = fim; grupo = c.tipo === 'entrega' ? { ini, fim } : null; }
    }
    if (doEtapa.length && !et.suprimido_em) etapas.push({ c: et, ini: Math.min(...doEtapa.map((x) => x.ini)), fim: Math.max(...doEtapa.map((x) => x.fim)) });
  }
  const fim = itens.length ? Math.max(...itens.map((x) => x.fim)) : inicio;
  // último dia de trabalho de um item (o fim é o começo do dia útil seguinte)
  const ultimoDia = (t) => voltar(t, 1);
  return { itens, hiatos, etapas, inicio, fim, hoje, ultimoDia, ativo, util };
}

// ---------------------------------------------------------------- resumo do dia (Ficha)
function escResumo(E) {
  const M = escCalendario(E);
  const hoje = M.itens.filter((x) => x.estado === 'hoje');
  const adiante = M.itens.filter((x) => x.estado === 'adiante').slice(0, 5);
  const aditivos = E.alteracoes.filter((a) => a.natureza === 'aditivo');
  return { M, hoje, adiante, aditivos, fim: M.ultimoDia(M.fim) };
}
const escLinhaCurta = (x, M) => `<li><span class="esc-cod">${escHtml(x.c.codigo || (x.c.adicionado ? 'novo' : ''))}</span>
  <span class="esc-txt">${escHtml(x.c.texto)}${x.estado === 'hoje' && M.ultimoDia(x.fim) === M.hoje ? ' <span class="esc-etq">termina hoje</span>' : ''}</span><span class="esc-dt">${escDM(x.ini)} – ${escDM(M.ultimoDia(x.fim))}</span></li>`;

// ---------------------------------------------------------------- estado da página e ações
const ESC = { E: null, prj: null, fila: Promise.resolve(), pendentes: 0, aoMudar: null, modo: (() => { try { return localStorage.getItem('esc:modo') || 'linha'; } catch (_) { return 'linha'; } })() };
const escCartao = (id) => ESC.E.cartoes.find((c) => c.id === id);

// manda a ação para o Universo em fila (a ordem dos cliques se mantém) e redesenha com o que voltou
function escAcao(corpo, otimista) {
  if (otimista) { otimista(ESC.E); ESC.aoMudar && ESC.aoMudar(); }
  ESC.pendentes++;
  ESC.fila = ESC.fila.then(async () => {
    try {
      const r = await Universo.post(`escopo/${ESC.prj}/acao`, corpo);
      ESC.pendentes--;
      if (!ESC.pendentes) { ESC.E = r; ESC.aoMudar && ESC.aoMudar(); }
    } catch (err) {
      ESC.pendentes--;
      escAviso(mensagemDe(err));
      try { ESC.E = await Universo.get(`escopo/${ESC.prj}`); } catch (_) { /* fica o que está */ }
      ESC.aoMudar && ESC.aoMudar();
    }
  });
  return ESC.fila;
}
const escAviso = (t, tipo) => { const el = document.getElementById('aviso'); if (el) avisoEm(el)(t, tipo); };
const escDuracao = (id, delta) => escAcao({ acao: 'duracao', cartao_id: id, dias: delta }, (E) => {
  const c = E.cartoes.find((x) => x.id === id); if (c) c.dias = Math.max(1, c.dias + delta);
});
const escMover = (id, delta) => escAcao({ acao: 'mover', cartao_id: id, dias: delta }, (E) => {
  const c = E.cartoes.find((x) => x.id === id); if (c) c.folga = Math.max(-400, Math.min(400, c.folga + delta));
});

// ---------------------------------------------------------------- Linha do projeto
//   régua só com as datas que têm marco (espaço fixo entre elas): o hiato aparece como uma caixa tracejada do
//   mesmo tamanho, dure 10 ou 20 dias. Faixas: fase, etapa, régua; camadas Estúdio · Cliente · Terceiros.
const ESC_W = 168, ESC_X0 = 24, ESC_LANE = 100, ESC_GAP = 8;
function escCamada(c) {
  if (c.tipo === 'entrega') return 'est';
  if (c.tempo === 'cliente' || (c.cliente && c.tempo !== 'estudio' && c.tempo !== 'terceiros')) return 'cli';
  if (c.tempo === 'terceiros' || c.terceiros) return 'out';
  return 'est';
}
function escDesenharLinha(el, E) {
  const M = escCalendario(E);
  if (!M.itens.length) { el.innerHTML = '<div class="pg-vazio">Nenhum cartão no escopo.</div>'; return; }
  const marcos = [...new Set([...M.itens.flatMap((x) => [x.ini, x.fim]), ...M.hiatos.flatMap((h) => [h.ini, h.fim]), M.hoje])].sort((a, b) => a - b);
  const col = new Map(marcos.map((t, i) => [t, i]));
  const x = (t) => ESC_X0 + col.get(t) * ESC_W;
  // camadas e pistas (a primeira pista livre em cada camada)
  const CAMADAS = [['est', 'Estúdio'], ['cli', 'Cliente'], ['out', 'Terceiros']];
  const pistas = { est: [], cli: [], out: [] };
  const pos = new Map();
  const ocupar = (cam, a, b) => {
    const p = pistas[cam];
    let i = p.findIndex((fim) => fim <= a);
    if (i < 0) { i = p.length; p.push(b); } else p[i] = b;
    return i;
  };
  const hiatoDe = new Map(M.hiatos.map((h) => [h.antes.id, h]));
  for (const it of M.itens) {
    const h = hiatoDe.get(it.c.id);
    const cam = escCamada(it.c);
    if (h) {   // o hiato fica na mesma pista do cartão que ele antecede
      const p = pistas[cam];
      let i = p.findIndex((fim) => fim <= col.get(h.ini));
      if (i < 0) { i = p.length; p.push(0); }
      p[i] = col.get(it.fim); h.pista = i; h.cam = cam;
      pos.set(it.c.id, { cam, pista: i });
    } else pos.set(it.c.id, { cam, pista: ocupar(cam, col.get(it.ini), col.get(it.fim)) });
  }
  const altura = Object.fromEntries(CAMADAS.map(([k]) => [k, pistas[k].length]));
  const Y0 = 112;  // abaixo das faixas de fase, etapa e da régua
  let y = Y0; const topo = {};
  for (const [k] of CAMADAS) { topo[k] = y; y += Math.max(altura[k], k === 'est' ? 1 : 0) * ESC_LANE + (altura[k] || k === 'est' ? 28 : 0); }
  const H = y + 8;
  const W = x(marcos[marcos.length - 1]) + ESC_X0 + 40;
  const corFase = (id) => ESC_COR_FASE[id] || ESC_CORES[[...new Set(E.cartoes.map((c) => c.fase_id))].indexOf(id) % ESC_CORES.length];
  // fases (faixa de cima) e etapas
  const fases = [];
  for (const et of M.etapas) {
    const f = fases[fases.length - 1];
    if (f && f.id === et.c.fase_id) { f.fim = Math.max(f.fim, et.fim); } else fases.push({ id: et.c.fase_id, nome: et.c.fase_nome, ini: et.ini, fim: et.fim });
  }
  const faixaFase = fases.map((f) => `<div class="esc-fase" style="left:${x(f.ini)}px;width:${x(f.fim) - x(f.ini) - 2}px;--cor:${corFase(f.id)}">${escHtml(f.nome || '')}</div>`).join('');
  const faixaEtapa = M.etapas.map((e) => `<div class="esc-etapa" style="left:${x(e.ini)}px;width:${x(e.fim) - x(e.ini) - 2}px;--cor:${corFase(e.c.fase_id)}" title="${escHtml(e.c.texto)}">
    <b>${escHtml(e.c.sigla || '')}</b> ${escHtml(e.c.texto)}</div>`).join('');
  const regua = marcos.map((t, i) => {
    const salto = i < marcos.length - 1 ? Math.round((marcos[i + 1] - t) / ESC_DIA) : 0;
    return `<div class="esc-marco${t === M.hoje ? ' hoje' : ''}" style="left:${x(t)}px"><span>${ESC_SEM[new Date(t).getUTCDay()]}</span><b>${escDM(t)}</b></div>
      ${salto > 1 ? `<div class="esc-salto" style="left:${x(t) + ESC_W / 2}px" title="${salto} dias corridos até a data seguinte">+${salto}d</div>` : ''}`;
  }).join('');
  const camadas = CAMADAS.filter(([k]) => k === 'est' || altura[k]).map(([k, n]) =>
    `<div class="esc-camada" style="top:${topo[k] - 22}px;width:${W}px"><span>${n}</span></div>`).join('');
  const cartoes = M.itens.map((it) => {
    const p = pos.get(it.c.id); const c = it.c;
    const l = x(it.ini) + ESC_GAP / 2; const w = Math.max(70, x(it.fim) - x(it.ini) - ESC_GAP);
    const dec = c.decisao && c.decisao.length ? `<span class="esc-etq">${escHtml((c.decisao.find((r) => r.id === c.decisao_resultado) || {}).nome || 'decisão')}</span>` : '';
    return `<div class="esc-no ${c.tipo} ${it.estado}${c.adicionado ? ' adicionado' : ''}${c.encerramento ? ' enc' : ''}" data-no="${c.id}"
        style="left:${l}px;top:${topo[p.cam] + p.pista * ESC_LANE}px;width:${w}px;--cor:${corFase(c.fase_id)}" tabindex="0">
      <div class="esc-no__cab"><span class="esc-cod">${escHtml(c.codigo || (c.adicionado ? 'novo' : ''))}</span>
        <span class="esc-dur"><button type="button" class="pg-caixa" data-dur="-1" aria-label="Reduzir um dia" title="Reduzir um dia">${ESC_IC.menos}</button><b>${c.dias}d</b><button type="button" class="pg-caixa" data-dur="1" aria-label="Estender um dia" title="Estender um dia">${ESC_IC.mais}</button></span></div>
      <div class="esc-no__txt" title="${escHtml(c.texto)}">${escHtml(c.texto)}</div>
      <div class="esc-no__pe"><span class="esc-dt">${escDM(it.ini)}–${escDM(M.ultimoDia(it.fim))}</span>${it.estado === 'hoje' ? '<span class="esc-etq hoje">hoje</span>' : ''}${c.adicionado ? '<span class="esc-etq">acrescentado</span>' : ''}${dec}</div>
    </div>`;
  }).join('');
  const hiatos = M.hiatos.map((h) => `<div class="esc-hiato" style="left:${x(h.ini) + ESC_GAP / 2}px;top:${topo[h.cam || 'est'] + h.pista * ESC_LANE}px;width:${Math.max(70, x(h.fim) - x(h.ini) - ESC_GAP)}px"
      title="Tempo parado antes de ${escHtml(h.antes.codigo || h.antes.texto)}"><span>hiato</span><b>${plural(h.dias, 'dia útil', 'dias úteis')}</b></div>`).join('');
  el.innerHTML = `<div class="esc-tela" id="esc-tela"><div class="esc-mapa" style="width:${W}px;height:${H}px">
      ${faixaFase}${faixaEtapa}<div class="esc-regua">${regua}</div>${camadas}
      <div class="esc-hojelinha" style="left:${x(M.hoje)}px;height:${H - 52}px" aria-hidden="true"></div>
      ${hiatos}${cartoes}</div></div>`;
  const tela = el.querySelector('#esc-tela');
  if (ESC.rolagem != null) tela.scrollLeft = ESC.rolagem;
  else tela.scrollLeft = Math.max(0, x(M.hoje) - tela.clientWidth / 3);
  tela.onscroll = () => { ESC.rolagem = tela.scrollLeft; };
  escLigarNos(el);
}
function escLigarNos(el) {
  el.querySelectorAll('[data-no]').forEach((n) => {
    n.querySelectorAll('[data-dur]').forEach((b) => b.onclick = (ev) => { ev.stopPropagation(); escDuracao(n.dataset.no, Number(b.dataset.dur)); });
    n.onclick = () => escAbrirCartao(n.dataset.no);
    n.onkeydown = (ev) => { if (ev.key === 'Enter') escAbrirCartao(n.dataset.no); };
  });
}

// ---------------------------------------------------------------- Cartões (a mesma coisa em lista, por etapa)
function escDesenharCartoes(el, E) {
  const M = escCalendario(E);
  const quando = Object.fromEntries(M.itens.map((x) => [x.c.id, x]));
  const etapas = E.cartoes.filter((c) => c.tipo === 'etapa');
  el.innerHTML = etapas.map((et) => {
    const e = M.etapas.find((x) => x.c.id === et.id);
    const filhos = E.cartoes.filter((c) => c.etapa_id === et.id && (M.ativo(c) || c.suprimido_em));
    return `<section class="esc-grupo${et.suprimido_em ? ' suprimido' : ''}">
      <div class="esc-grupo__cab"><span class="esc-cod">${escHtml(et.sigla || '')}</span><b>${escHtml(et.texto)}</b>
        <span class="esc-dt">${e ? `${escDM(e.ini)} – ${escDM(M.ultimoDia(e.fim))}` : et.suprimido_em ? 'suprimida' : ''}</span>
        <span class="pg-empurra"></span><button type="button" class="pg-caixa" data-abrir="${et.id}" title="Abrir a etapa" aria-label="Abrir">${ESC_IC.lapis}</button></div>
      <div class="esc-lista">${filhos.map((c) => {
        const q = quando[c.id];
        return `<div class="esc-linha ${q ? q.estado : 'suprimido'}${c.adicionado ? ' adicionado' : ''}" data-no="${c.id}" tabindex="0">
          <span class="esc-cod">${escHtml(c.codigo || (c.adicionado ? 'novo' : ''))}</span>
          <span class="esc-txt">${escHtml(c.texto)}${q && q.estado === 'hoje' ? ' <span class="esc-etq hoje">hoje</span>' : ''}${c.adicionado ? ' <span class="esc-etq">acrescentado</span>' : ''}${c.suprimido_em ? ' <span class="esc-etq tracejada">suprimido</span>' : ''}${q && c.folga > 0 ? ` <span class="esc-etq tracejada">hiato de ${plural(c.folga, 'dia', 'dias')} antes</span>` : ''}${q && c.folga < 0 ? ` <span class="esc-etq tracejada">${plural(-c.folga, 'dia', 'dias')} em paralelo</span>` : ''}</span>
          <span class="esc-dt">${q ? `${escDM(q.ini)} – ${escDM(M.ultimoDia(q.fim))}` : ''}</span>
          <span class="esc-dur">${q ? `<button type="button" class="pg-caixa" data-dur="-1" aria-label="Reduzir um dia">${ESC_IC.menos}</button><b>${c.dias}d</b><button type="button" class="pg-caixa" data-dur="1" aria-label="Estender um dia">${ESC_IC.mais}</button>` : ''}</span>
        </div>`;
      }).join('')}</div></section>`;
  }).join('') || '<div class="pg-vazio">Nenhum cartão no escopo.</div>';
  escLigarNos(el);
  el.querySelectorAll('[data-abrir]').forEach((b) => b.onclick = () => escAbrirCartao(b.dataset.abrir));
}

// ---------------------------------------------------------------- o cartão aberto (Gaveta)
function escAbrirCartao(id) {
  const c = escCartao(id);
  if (!c) return;
  const M = escCalendario(ESC.E);
  const q = M.itens.find((x) => x.c.id === id);
  const etapa = c.tipo === 'etapa';
  const dec = c.decisao && c.decisao.length;
  const painel = abrirPainel(`
    <div class="painel__topo"><h2>${escHtml((c.codigo || c.sigla ? (c.codigo || c.sigla) + ' · ' : '') + c.texto)}</h2><button class="painel__fechar" aria-label="Fechar">×</button></div>
    <div id="p-aviso"></div>
    <p class="small">${escHtml(c.fase_nome || '')}${q ? ` · ${escDMA(q.ini)} a ${escDMA(M.ultimoDia(q.fim))}` : ''}${c.dias_contratados && !etapa ? ` · contratado: ${plural(c.dias_contratados, 'dia', 'dias')}` : ''}${c.sem_prazo ? ' · o PGT não tinha prazo' : ''}</p>
    ${etapa ? '' : `
    <div class="field"><label class="field__label">Duração</label>
      <div class="esc-ctl"><button type="button" class="pg-caixa" data-g-dur="-1" aria-label="Reduzir um dia">${ESC_IC.menos}</button>
        <span class="pg-unidade"><input type="number" min="1" max="400" id="g-dias" value="${c.dias}"><i>dias úteis</i></span>
        <button type="button" class="pg-caixa" data-g-dur="1" aria-label="Estender um dia">${ESC_IC.mais}</button></div>
      <p class="field__hint">Estende ou reduz o cartão; os seguintes andam junto.</p></div>
    <div class="field"><label class="field__label">Mover, sem mudar a duração</label>
      <div class="esc-ctl"><button type="button" class="pg-caixa" data-g-mov="-1" aria-label="Um dia antes" title="Um dia antes">${ESC_IC.esq}</button>
        <input type="date" id="g-inicio" value="${q ? escISO(q.ini) : ''}" aria-label="Começa em">
        <button type="button" class="pg-caixa" data-g-mov="1" aria-label="Um dia depois" title="Um dia depois">${ESC_IC.dir}</button>
        <span class="small muted">${c.folga > 0 ? `hiato de ${plural(c.folga, 'dia útil', 'dias úteis')} antes` : c.folga < 0 ? `${plural(-c.folga, 'dia', 'dias')} em paralelo com o anterior` : 'logo depois do anterior'}</span></div>
      <p class="field__hint">Para frente abre um hiato (tempo parado) antes do cartão; para trás, ele corre em paralelo com o anterior.</p></div>`}
    ${dec ? `<div class="field"><label class="field__label">Decisão</label><span class="pg-seletor" role="radiogroup" aria-label="Resultado">
      ${c.decisao.map((r) => `<button type="button" role="radio" data-res="${escHtml(r.id)}" aria-checked="${c.decisao_resultado === r.id}">${escHtml(r.nome)}</button>`).join('')}</span>
      <p class="field__hint">O resultado que libera uma rodada a põe no escopo como extra previsto.</p></div>` : ''}
    <div class="field"><label class="field__label">Observações</label><textarea id="g-obs" rows="3">${escHtml(c.observacoes || '')}</textarea></div>
    <div class="painel__acoes esc-acoes">
      <button type="button" class="u-botao" id="g-acrescentar">${ESC_IC.mais}<span>Acrescentar ${etapa ? 'no começo da etapa' : 'depois deste'}</span></button>
      ${c.encerramento ? '' : c.suprimido_em ? '<button type="button" class="u-botao" id="g-restaurar">Restaurar</button>' : `<button type="button" class="btn-link perigo" id="g-suprimir">Suprimir ${etapa ? 'a etapa' : 'do escopo'}</button>`}
    </div>`);
  const av = avisoEm(painel.querySelector('#p-aviso'));
  const reabrir = () => { if (document.querySelector('.painel')) escAbrirCartao(id); };
  painel.querySelectorAll('[data-g-dur]').forEach((b) => b.onclick = () => { escDuracao(id, Number(b.dataset.gDur)); reabrirDepois(reabrir); });
  painel.querySelectorAll('[data-g-mov]').forEach((b) => b.onclick = () => { escMover(id, Number(b.dataset.gMov)); reabrirDepois(reabrir); });
  const gd = painel.querySelector('#g-dias');
  if (gd) gd.onchange = () => { const n = Math.round(Number(gd.value)); if (n >= 1 && n !== c.dias) { escDuracao(id, n - c.dias); reabrirDepois(reabrir); } };
  const gi = painel.querySelector('#g-inicio');
  if (gi && q) gi.onchange = () => {
    if (!gi.value) return;
    const alvo = escDia(gi.value);
    // diferença em dias úteis entre o começo atual e o novo
    let n = 0, t = q.ini;
    if (alvo > t) { while (t < alvo) { t += ESC_DIA; if (M.util(t)) n++; } } else { while (t > alvo) { t -= ESC_DIA; if (M.util(t)) n--; } }
    if (n) { escMover(id, n); reabrirDepois(reabrir); }
  };
  painel.querySelectorAll('[data-res]').forEach((b) => b.onclick = () => {
    const res = b.dataset.res === c.decisao_resultado ? null : b.dataset.res;
    escAcao({ acao: 'decisao', cartao_id: id, resultado: res }); reabrirDepois(reabrir);
  });
  const go = painel.querySelector('#g-obs');
  go.onchange = () => escAcao({ acao: 'observacoes', cartao_id: id, observacoes: go.value });
  const sup = painel.querySelector('#g-suprimir');
  if (sup) sup.onclick = async () => {
    const motivo = prompt(`Suprimir ${c.codigo || c.sigla || ''} · ${c.texto}? Fica registrado nas Alterações de escopo (potencial aditivo).\n\nMotivo (opcional; dá para preencher depois):`, '');
    if (motivo === null) return;
    await escAcao({ acao: 'suprimir', cartao_id: id, motivo });
    fecharPainel();
  };
  const res = painel.querySelector('#g-restaurar');
  if (res) res.onclick = async () => { await escAcao({ acao: 'restaurar', cartao_id: id }); fecharPainel(); };
  painel.querySelector('#g-acrescentar').onclick = () => escAbrirAcrescentar(id);
  av('');
}
function reabrirDepois(fn) { ESC.fila.then(() => setTimeout(fn, 0)); }

function escAbrirAcrescentar(depoisDe) {
  const ref = escCartao(depoisDe);
  const painel = abrirPainel(`
    <div class="painel__topo"><h2>Acrescentar ao escopo</h2><button class="painel__fechar" aria-label="Fechar">×</button></div>
    <div id="p-aviso"></div>
    <p class="small">${ref.tipo === 'etapa' ? `No começo de ${escHtml(ref.sigla || '')} · ${escHtml(ref.texto)}` : `Depois de ${escHtml(ref.codigo || '')} · ${escHtml(ref.texto)}`}. Fica registrado como acrescentado (potencial aditivo).</p>
    <form id="f">
      <div class="field"><label class="field__label">É</label><span class="pg-seletor" role="radiogroup" aria-label="Tipo">
        <button type="button" role="radio" data-t="entrega" aria-checked="true">Entrega</button>
        <button type="button" role="radio" data-t="evento" aria-checked="false">Evento</button></span></div>
      <div class="field"><label class="field__label">O que é</label><input type="text" name="texto" required maxlength="400"></div>
      <div class="row-2">
        <div class="field"><label class="field__label">Duração (dias úteis)</label><input type="number" name="dias" min="1" max="400" value="1" required></div>
        <div class="field" id="campo-tempo" hidden><label class="field__label">Tempo de quem</label><select name="tempo">
          <option value="estudio">Estúdio</option><option value="cliente">Cliente</option><option value="terceiros">Terceiros</option><option value="pontual">Pontual</option></select></div>
      </div>
      <div class="field"><label class="field__label">Motivo (opcional)</label><textarea name="motivo" rows="2" placeholder="Dá para preencher depois, nas Alterações de escopo"></textarea></div>
      <div class="painel__acoes"><button class="u-botao forte" type="submit">Acrescentar</button></div>
    </form>`);
  const av = avisoEm(painel.querySelector('#p-aviso'));
  const f = painel.querySelector('#f');
  let tipo = 'entrega';
  painel.querySelectorAll('[data-t]').forEach((b) => b.onclick = () => {
    tipo = b.dataset.t;
    painel.querySelectorAll('[data-t]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    painel.querySelector('#campo-tempo').hidden = tipo !== 'evento';
  });
  f.onsubmit = async (e) => {
    e.preventDefault();
    e.submitter.disabled = true;
    try {
      ESC.E = await Universo.post(`escopo/${ESC.prj}/acao`, { acao: 'acrescentar', depois_de: depoisDe, tipo, texto: f.texto.value,
        dias: Number(f.dias.value), tempo: tipo === 'evento' ? f.tempo.value : null, motivo: f.motivo.value });
      fecharPainel(); ESC.aoMudar && ESC.aoMudar();
    } catch (err) { av(mensagemDe(err)); e.submitter.disabled = false; }
  };
  f.texto.focus();
}

// ---------------------------------------------------------------- Alterações de escopo
const ESC_NATUREZA = { aditivo: ['potencial aditivo', 'atencao'], prazo: ['ajuste de prazo', ''], extra: ['extra previsto', 'ok'] };
const ESC_TIPO = { duracao: 'Duração', mover: 'Movido', suprimir: 'Suprimido', restaurar: 'Restaurado', acrescentar: 'Acrescentado',
  decisao: 'Decisão', suspender: 'Suspensão', retomar: 'Retomada', inicio: 'Início' };
let ESC_FILTRO = 'todas';
function escTextoAlteracao(a) {
  const d = a.dias;
  if (a.tipo === 'duracao') return `${d > 0 ? 'Estendido' : 'Reduzido'} ${plural(Math.abs(d), 'dia útil', 'dias úteis')} (${a.antes} → ${a.depois} dias)`;
  if (a.tipo === 'mover') return `${d > 0 ? 'Adiado' : 'Adiantado'} ${plural(Math.abs(d), 'dia útil', 'dias úteis')}${a.depois > 0 ? ` (hiato de ${a.depois} antes)` : a.depois < 0 ? ` (${-a.depois} em paralelo)` : ''}`;
  if (a.tipo === 'suprimir') return `Suprimido do escopo${d ? ` (${plural(-d, 'dia', 'dias')} a menos)` : ''}`;
  if (a.tipo === 'restaurar') return 'Restaurado ao escopo';
  if (a.tipo === 'acrescentar') return `Acrescentado ao escopo (${plural(d || 1, 'dia', 'dias')})`;
  return a.descricao || ESC_TIPO[a.tipo] || a.tipo;
}
function escDesenharAlteracoes(el, E) {
  const lista = E.alteracoes.filter((a) => !(['duracao', 'mover'].includes(a.tipo) && !a.dias));
  const soma = (nat, f = (a) => a.dias || 0) => lista.filter((a) => a.natureza === nat).reduce((t, a) => t + f(a), 0);
  const n = (nat) => lista.filter((a) => a.natureza === nat).length;
  const acresc = lista.filter((a) => a.tipo === 'acrescentar').length;
  const supr = lista.filter((a) => a.tipo === 'suprimir').length - lista.filter((a) => a.tipo === 'restaurar').length;
  const prazo = soma('prazo', (a) => (['duracao', 'mover', 'retomar'].includes(a.tipo) ? a.dias || 0 : 0));
  const vis = lista.filter((a) => ESC_FILTRO === 'todas' || a.natureza === ESC_FILTRO);
  el.innerHTML = `<div class="esc-placar">
      <div><span class="u-rotulo">Potencial aditivo</span><b>${acresc}</b><small>${plural(acresc, 'acrescentado', 'acrescentados')} · ${plural(Math.max(0, supr), 'suprimido', 'suprimidos')}</small></div>
      <div><span class="u-rotulo">Ajuste de prazo</span><b>${prazo > 0 ? '+' : ''}${prazo}</b><small>dias úteis no saldo</small></div>
      <div><span class="u-rotulo">Extra previsto</span><b>${n('extra')}</b><small>${plural(soma('extra'), 'dia', 'dias')}</small></div>
    </div>
    <div class="pg-filtros"><span class="pg-seletor" role="radiogroup" aria-label="Natureza">
      ${[['todas', 'Todas'], ['aditivo', 'Potencial aditivo'], ['prazo', 'Ajuste de prazo'], ['extra', 'Extra previsto']].map(([k, r]) =>
        `<button type="button" role="radio" data-nat="${k}" aria-checked="${ESC_FILTRO === k}">${r} <span class="n">${k === 'todas' ? lista.length : n(k)}</span></button>`).join('')}</span></div>
    <div class="pg-regua esc-grade-alt"><span>Quando</span><span>Cartão</span><span>O que mudou</span><span>Natureza</span><span>Motivo</span></div>
    <div class="pg-registro">${vis.map((a) => {
      const [nat, cls] = ESC_NATUREZA[a.natureza] || [a.natureza, ''];
      const d = new Date(a.em);
      return `<div class="pg-linha esc-grade-alt esc-alt">
        <span class="pg-apoio">${escDM(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))}/${d.getFullYear()}<small>${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}</small></span>
        <span>${a.cartao_id ? `<b>${escHtml(a.cartao_codigo || (a.cartao_tipo === 'etapa' ? '' : 'novo'))}</b> ${escHtml(a.cartao_texto || '')}` : '<span class="sem">projeto</span>'}</span>
        <span>${escHtml(escTextoAlteracao(a))}</span>
        <span><span class="pg-etq ${cls}">${nat}</span></span>
        <span class="esc-motivo">${a.motivo ? escHtml(a.motivo) : '<span class="sem">sem motivo</span>'}
          <button type="button" class="pg-caixa" data-motivo="${a.id}" title="Escrever o motivo" aria-label="Escrever o motivo">${ESC_IC.lapis}</button></span>
      </div>`;
    }).join('') || '<div class="pg-vazio">Nada alterado ainda.</div>'}</div>`;
  el.querySelectorAll('[data-nat]').forEach((b) => b.onclick = () => { ESC_FILTRO = b.dataset.nat; escDesenharAlteracoes(el, E); });
  el.querySelectorAll('[data-motivo]').forEach((b) => b.onclick = async () => {
    const a = E.alteracoes.find((x) => x.id === b.dataset.motivo);
    const m = prompt('Motivo desta alteração:', a.motivo || '');
    if (m === null) return;
    await escAcao({ acao: 'motivo', alteracao_id: a.id, motivo: m });
  });
}

// ---------------------------------------------------------------- Gerar escopo (projeto sem escopo)
//   com proposta assinada: nasce dela (serviço, área, etapas, entregas e prazos, inclusive os personalizados);
//   sem proposta: o serviço, a área, as etapas e o início escolhidos aqui, com o PGT × faixa (personalizável).
async function escCarregarPgt() {
  const [P, B] = await Promise.all([Universo.get('publicacoes/ultima', { tipo: 'pgt' }), Universo.get('publicacoes/ultima', { tipo: 'bases' })]);
  return { P: P.dados, B: B.dados, versao: P.numero };
}
async function escGerarDaProposta(F, contrato) {
  const pp = await Universo.get(`propostas/${contrato.proposta_id}`);
  let calc = pp.registro?.calculo;
  if (typeof calc === 'string') { try { calc = JSON.parse(calc); } catch (_) { calc = null; } }
  if (!calc || !calc.servicoId || !Array.isArray(calc.etapasSelecionadas)) return null;
  const { P, B, versao } = await escCarregarPgt();
  const semanas = {};
  for (const id of calc.etapasSelecionadas) {
    const m = calc.semanasManual && calc.semanasManual[id];
    if (m != null && m !== '' && calc.prazosPersonalizados) semanas[id] = Number(m);
  }
  const cartoes = escMontar(P, B, { servicoId: calc.servicoId, area: Number(calc.areaConstruida) || F.registro.area_m2 || 0, categoriaId: calc.categoriaId,
    etapas: calc.etapasSelecionadas, entregas: calc.entregasSelecionadas || null, clausulas: calc.clausulasSelecionadas || [], semanas });
  if (!cartoes.length) return null;
  return Universo.post(`escopo/${F.registro.id}/gerar`, { inicio: calc.dataInicio && calc.dataInicio >= (contrato.assinado_em || '') ? calc.dataInicio : contrato.assinado_em || F.registro.inicio,
    origem: { proposta_codigo: contrato.proposta_codigo || pp.registro?.codigo, pgt_versao: versao }, cartoes });
}
async function escAbrirGerar(F, aoGerar) {
  let dados;
  try { dados = await escCarregarPgt(); } catch (err) { escAviso(`Não consegui ler o PGT publicado (${mensagemDe(err)}).`); return; }
  const { P, B, versao } = dados;
  const p = F.registro;
  const SV = B.servicos || [];
  const srvPorNome = SV.find((s) => p.servico && (s.nome === p.servico || s.sigla === p.servico));
  const st = { srv: srvPorNome?.id || SV[0]?.id, area: p.area_m2 || '', inicio: p.inicio || escISO(escHoje()), etapas: null, pers: false, semanas: {} };
  const painel = abrirPainel(`<div class="painel__topo"><h2>Gerar escopo</h2><button class="painel__fechar" aria-label="Fechar">×</button></div><div id="p-aviso"></div><div id="g-corpo"></div>`);
  const av = avisoEm(painel.querySelector('#p-aviso'));
  const corpo = painel.querySelector('#g-corpo');
  const desenhar = () => {
    const srv = SV.find((s) => s.id === st.srv);
    const pert = (e) => (e.servicos && e.servicos[st.srv] ? e.servicos[st.srv].pertinencia || e.servicos[st.srv] : null);
    const etapas = P.etapas.filter((e) => pert(e) && (srv?.dinamica === 'ilha' ? e.servico_id === st.srv : !e.servico_id));
    if (!st.etapas) st.etapas = etapas.filter((e) => pert(e) === 'P').map((e) => e.id);
    const area = Number(String(st.area).replace(',', '.')) || 0;
    const semanasCalc = (e) => {
      const cs = escMontar(P, B, { servicoId: st.srv, area, etapas: [e.id] }).filter((c) => c.tipo !== 'etapa' && !c.liberado_por_ref && !c.encerramento);
      return Math.round((escDuracaoDaSequencia(cs) / 5) * 2) / 2;
    };
    corpo.innerHTML = `<p class="small">A partir do PGT publicado (v${versao}). As durações vêm do PGT × a faixa da área; personalize se precisar.</p>
      <div class="row-2">
        <div class="field"><label class="field__label">Serviço</label><select id="g-srv">${SV.map((s) => `<option value="${s.id}" ${s.id === st.srv ? 'selected' : ''}>${escHtml(s.sigla + ' · ' + s.nome)}</option>`).join('')}</select></div>
        <div class="field"><label class="field__label">Área (m²)</label><input type="text" inputmode="decimal" id="g-area" value="${escHtml(String(st.area))}"></div>
      </div>
      <div class="field"><label class="field__label">Começa em</label><input type="date" id="g-ini" value="${st.inicio}"></div>
      <div class="field"><label class="field__label">Etapas contratadas</label>
        <label class="small"><input type="checkbox" id="g-pers" ${st.pers ? 'checked' : ''}> Personalizar prazos</label>
        <div class="esc-etapas">${etapas.map((e) => {
          const on = st.etapas.includes(e.id); const calc = semanasCalc(e);
          return `<div class="esc-etapa-op"><label><input type="checkbox" data-et="${e.id}" ${on ? 'checked' : ''}> <b>${escHtml(e.sigla)}</b> ${escHtml(e.nome)}${pert(e) === 'O' ? ' <span class="pg-etq tracejada">opcional</span>' : ''}</label>
            ${st.pers && on ? `<span class="pg-unidade"><input type="number" step="0.5" min="0.5" data-sem="${e.id}" value="${st.semanas[e.id] ?? calc}"><i>sem.</i></span>` : `<span class="pg-apoio">${calc ? String(calc).replace('.', ',') + ' sem.' : 'sem prazo'}</span>`}</div>`;
        }).join('') || '<p class="small muted">Este serviço não tem etapas no PGT publicado.</p>'}</div></div>
      <div class="painel__acoes"><button class="u-botao forte" type="button" id="g-ok">Gerar escopo</button></div>`;
    corpo.querySelector('#g-srv').onchange = (ev) => { st.srv = ev.target.value; st.etapas = null; st.semanas = {}; desenhar(); };
    corpo.querySelector('#g-area').onchange = (ev) => { st.area = ev.target.value; desenhar(); };
    corpo.querySelector('#g-ini').onchange = (ev) => { st.inicio = ev.target.value; };
    corpo.querySelector('#g-pers').onchange = (ev) => { st.pers = ev.target.checked; desenhar(); };
    corpo.querySelectorAll('[data-et]').forEach((b) => b.onchange = () => {
      st.etapas = b.checked ? [...st.etapas, b.dataset.et] : st.etapas.filter((x) => x !== b.dataset.et); desenhar();
    });
    corpo.querySelectorAll('[data-sem]').forEach((i) => i.onchange = () => { st.semanas[i.dataset.sem] = Number(i.value); });
    corpo.querySelector('#g-ok').onclick = async (ev) => {
      if (!st.etapas.length) return av('Marque ao menos uma etapa.');
      if (!st.inicio) return av('Diga quando começa.');
      ev.currentTarget.disabled = true;
      try {
        const cartoes = escMontar(P, B, { servicoId: st.srv, area, etapas: st.etapas, semanas: st.pers ? st.semanas : null });
        const r = await Universo.post(`escopo/${p.id}/gerar`, { inicio: st.inicio, origem: { pgt_versao: versao }, cartoes });
        fecharPainel(); aoGerar(r);
      } catch (err) { av(mensagemDe(err)); ev.currentTarget.disabled = false; }
    };
  };
  desenhar();
}
