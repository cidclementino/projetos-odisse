// ==========================================================================
// Plano Geral de Trabalho — aba "Linha": o PGT como sistema de nós sobre uma régua de datas
// (desenho em universo-visualizacao-nos.md, ensaios 3 a 7; primeira implementação, 16/11/2026).
//
//   * Nós = entregas e eventos do serviço escolhido, na sequência do PGT (fases do fluxo, etapas, passos).
//   * Datas de referência: começa no primeiro dia útil de 1º de janeiro do ano corrente.
//     Prazos em turnos (1 dia = 2 turnos) contados de segunda a sexta; o fim de semana fica livre.
//     Sem prazo no PGT: 1 dia (marcado "sem prazo"). Tempo do cliente: 3 dias úteis; de terceiros: 7
//     (marcados "estimado"). Evento pontual: ocupa o dia e termina no dia seguinte.
//   * Régua: só as datas com marco, espaço fixo entre elas; faixa de compressão (verde → vermelho
//     conforme os dias úteis saltados até a data seguinte, com "+Nd" em dias corridos).
//   * Camadas: estúdio · cliente · outros. 1ª linha = interação com o cliente (e de visibilidade);
//     2ª linha = interação com terceiros. Reuniões pontuais pousam sobre a linha dos atores; com os três,
//     o cartão atravessa a faixa do cliente e toca as duas linhas.
//   * Cor: borda = fase; preenchimento = situação (no PGT, tudo previsto: branco). Reto = entrega,
//     arredondado = evento; tracejado = opcional ou suspenso por uma decisão.
//   * Decisão: os botões simulam o resultado (não grava): o caminho esperado tira os cartões suspensos;
//     o que os libera concretiza-os. ↺ desfaz.
//   * Recolher etapa ou fase (clique na faixa de cima), fios destacados ao selecionar, minimapa,
//     ver como cliente. Duplo clique leva ao cartão na aba de edição.
// Usa as globais da página: D, ENC, ehEnt, escHtml, nomeDe, TIPOS_EVT, irAoCartao, materiaisDe, fmtPrazo.
// ==========================================================================

const LN_CHAVE = 'pgt:linha';
const LN = (() => {
  let g = {};
  try { g = JSON.parse(sessionStorage.getItem(LN_CHAVE) || '{}'); } catch (_) { /* sem armazenamento */ }
  return { srv: g.srv || '', opcionais: !!g.opcionais, cliente: !!g.cliente, recolhidas: new Set(g.recolhidas || []), decisoes: g.decisoes || {}, sel: null, rolagem: 0, selecao: new Set(), selSrv: new Set() };
})();
function lnGuardar() {
  try {
    sessionStorage.setItem(LN_CHAVE, JSON.stringify({ srv: LN.srv, opcionais: LN.opcionais, cliente: LN.cliente,
      recolhidas: [...LN.recolhidas], decisoes: LN.decisoes }));
  } catch (_) { /* sem armazenamento */ }
}

// cores das fases (borda); as que não estiverem aqui seguem a lista por ordem
const LN_COR_FASE = { pfa_conceitual: '#1D9E75', pfa_legal: '#D85A30', pfa_executiva: '#7F77DD', pfa_obra: '#BA7517', pfa_ilhas: '#888780' };
const LN_CORES = ['#1D9E75', '#D85A30', '#7F77DD', '#BA7517', '#C2577F', '#3B8C9E', '#888780'];
const lnCorFase = (fa) => LN_COR_FASE[fa.id] || LN_CORES[D.fases.indexOf(fa) % LN_CORES.length];

// ---------------------------------------------------------------- calendário (dias úteis = seg a sex)
const LN_DIA = 86400000;
const lnData = (a, m, d) => Date.UTC(a, m, d);
const lnUtil = (t) => { const w = new Date(t).getUTCDay(); return w !== 0 && w !== 6; };
const lnProxUtil = (t) => { while (!lnUtil(t)) t += LN_DIA; return t; };
// consome n dias úteis a partir de t (útil) e devolve o dia útil seguinte (início do próximo passo)
function lnSomarUteis(t, n) { for (let i = 0; i < n; i++) t = lnProxUtil(t + LN_DIA); return t; }
function lnUteisEntre(a, b) { let n = 0; for (let t = a; t < b; t += LN_DIA) if (lnUtil(t)) n++; return n; }
const LN_SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const LN_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const lnDM = (t) => { const d = new Date(t); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
const lnDataLonga = (t) => `${LN_SEM[new Date(t).getUTCDay()]} ${lnDM(t)}`;

// ---------------------------------------------------------------- modelo: passos do serviço com datas
const LN_DIAS_CLIENTE = 3;
const LN_DIAS_TERCEIROS = 7;

function lnAtor(x) {
  if (ehEnt(x)) return 'est';
  if (x.tempo === 'estudio') return 'est';
  if (x.tempo === 'cliente') return 'cli';
  if (x.tempo === 'terceiros') return 'out';
  if (x.cliente && x.terceiros) return 'tres';
  if (x.cliente) return 'l1';
  if (x.terceiros) return 'l2';
  return 'est';
}
function lnDuracao(x) {
  if (ehEnt(x) || x.tempo === 'estudio') {
    const t = x.prazo_turnos;
    return { dias: t ? Math.max(1, Math.ceil(t / 2)) : 1, semPrazo: !t };
  }
  if (x.tempo === 'cliente') return { dias: LN_DIAS_CLIENTE, estimado: true };
  if (x.tempo === 'terceiros') return { dias: LN_DIAS_TERCEIROS, estimado: true };
  return { dias: 1, pontual: true };
}

function lnModelo() {
  const srv = LN.srv && D.servicos.some((s) => s.id === LN.srv) ? LN.srv : D.servicos[0]?.id;
  LN.srv = srv;
  const pertEtapa = (e) => e.servicos[srv]?.pertinencia;
  const cabe = (e) => pertEtapa(e) === 'P' || (LN.opcionais && pertEtapa(e) === 'O');
  let fases = D.fases.filter((fa) => !fa.ilha);
  let etapas = D.etapas.filter((e) => fases.some((fa) => fa.id === e.fase_id) && cabe(e));
  if (!etapas.length) {                                      // serviço só de ilhas (CR, LA)
    fases = D.fases.filter((fa) => fa.ilha);
    etapas = D.etapas.filter((e) => fases.some((fa) => fa.id === e.fase_id) && cabe(e));
  }
  fases = fases.filter((fa) => etapas.some((e) => e.fase_id === fa.id));
  // quem cada decisão libera
  const liberadoPor = {};
  for (const v of D.eventos) for (const r of v.decisao || []) for (const id of r.libera) liberadoPor[id] = { ev: v, res: r };

  const nos = []; const passos = [];      // passos = [[ids que correm juntos], …] na ordem
  const inicio = lnProxUtil(lnData(new Date().getFullYear(), 0, 1));
  let cursor = inicio;
  const enc = ENC();
  const ultimaComEnc = enc ? [...etapas].reverse().find((e) => (enc.instancias || []).includes(e.id)) : null;
  for (const e of etapas) {
    const fa = faseDe(e.fase_id);
    const etapaOpcional = pertEtapa(e) === 'O';
    const vale = (x) => { const p = x.servicos[srv]; return p === 'P' || p === 'S' || (LN.opcionais && p === 'O'); };
    const lista = D.seq[e.id].filter((x) => {
      if (!x.servicos[srv]) return false;
      const lib = liberadoPor[x.id];
      if (lib && vale(lib.ev)) return true;                   // possível: aparece (suspenso) se a decisão aparece
      return vale(x);
    });
    if (enc && ultimaComEnc && ultimaComEnc.id === e.id && enc.servicos[srv]) lista.push(enc);
    let grupo = null;
    for (const x of lista) {
      const lib = liberadoPor[x.id];
      let susp = '';
      if (lib) {
        const r = LN.decisoes[lib.ev.id];
        if (!r) susp = 'pendente'; else if (r === lib.res.id) susp = 'liberado'; else continue;   // outro resultado: some
      }
      const d = lnDuracao(x);
      const no = { id: x.id, x, ent: ehEnt(x), etapa: e, fase: fa, ator: lnAtor(x), dias: d.dias,
        semPrazo: !!d.semPrazo, estimado: !!d.estimado, pontual: !!d.pontual,
        opcional: etapaOpcional || x.servicos[srv] === 'O', susp, lib };
      if (no.ent && x.junto_anterior && grupo && grupo.etapa === e.id) {          // corre junto com a anterior
        no.ini = grupo.ini; no.fim = lnSomarUteis(grupo.ini, no.dias);
        grupo.ids.push(no.id); grupo.fim = Math.max(grupo.fim, no.fim); cursor = grupo.fim;
      } else {
        no.ini = cursor; no.fim = lnSomarUteis(cursor, no.dias); cursor = no.fim;
        grupo = no.ent ? { etapa: e.id, ini: no.ini, fim: no.fim, ids: [no.id] } : null;
        passos.push(grupo ? grupo.ids : [no.id]);
      }
      nos.push(no);
    }
  }
  return { srv, fases, etapas, nos, passos, inicio, fim: cursor };
}

// ---------------------------------------------------------------- vista: recolhidos, como cliente, geometria
const LN_W = 184;          // espaço entre datas
const LN_X0 = 44;
const LN_H = 62;           // altura do cartão
const LN_HM = 44;          // altura de cada entrega num grupo
const LN_LINHA = 48;       // altura do cartão pousado numa linha
const LN_Y_FASE = 0, LN_Y_ETAPA = 24, LN_Y_REGUA = 50, LN_Y_COMP = 88, LN_Y_CAM = 112;

function lnVista(M) {
  // nós visíveis (com recolhidos virando um resumo) e passos na ordem
  const chaveDe = (no) => LN.recolhidas.has('f:' + no.fase.id) ? 'f:' + no.fase.id : LN.recolhidas.has(no.etapa.id) ? 'e:' + no.etapa.id : null;
  const resumos = new Map();
  const porId = Object.fromEntries(M.nos.map((n) => [n.id, n]));
  const vis = [];
  for (const no of M.nos) {
    const k = chaveDe(no);
    if (!k) { vis.push(no); continue; }
    let r = resumos.get(k);
    if (!r) {
      r = { id: 'sum:' + k, resumo: true, chave: k, etapa: no.etapa, fase: no.fase, ator: 'est', ini: no.ini, fim: no.fim, n: 0,
        nome: k.startsWith('f:') ? `Fase ${no.fase.nome}` : no.etapa.nome, decisoes: 0, susp: 0, cli: 0 };
      resumos.set(k, r); vis.push(r);
    }
    r.ini = Math.min(r.ini, no.ini); r.fim = Math.max(r.fim, no.fim); r.n++;
    if (no.x.decisao) r.decisoes++;
    if (no.susp === 'pendente') r.susp++;
    if (no.ator !== 'est') r.cli++;
  }
  const mapa = (id) => { const no = porId[id]; const k = chaveDe(no); return k ? 'sum:' + k : id; };
  let passos = M.passos.map((ids) => [...new Set(ids.map(mapa))]);
  // como cliente: some a camada do estúdio (e os resumos, que são do estúdio)
  const visivel = (n) => !LN.cliente || (n.ator !== 'est');
  const visIds = new Set(vis.filter(visivel).map((n) => n.id));
  passos = passos.map((p) => p.filter((id) => visIds.has(id))).filter((p) => p.length);
  passos = passos.filter((p, i) => i === 0 || p.join() !== passos[i - 1].join());
  const nos = vis.filter(visivel);
  // grupos de entregas que correm juntas (2+ entregas no mesmo passo, não resumidas)
  const grupos = passos.filter((p) => p.length > 1 && p.every((id) => porId[id]?.ent)).map((p) => ({ id: 'grp:' + p[0], ids: p }));
  const noGrupo = {};
  for (const g of grupos) for (const id of g.ids) noGrupo[id] = g;
  // marcos da régua
  const marcos = [...new Set(nos.flatMap((n) => [n.ini, n.fim]))].sort((a, b) => a - b);
  const col = new Map(marcos.map((t, i) => [t, i]));
  return { nos, passos, grupos, noGrupo, marcos, col, porId };
}

// altura do cartão: cabeçalho + nome inteiro (estimado pela largura) + etiquetas + botões
const LN_PX_LETRA = 6.9;     // largura média de uma letra do nome (12,5 px)
function lnAltura(n, w) {
  if (n.resumo) return 78;
  const nome = n.x.texto || n.x.nome || '';
  const linhas = Math.max(1, Math.ceil((nome.length * LN_PX_LETRA) / Math.max(40, w - 22)));
  const tags = n.susp || n.opcional;
  return 10 + 15 + linhas * 16 + (tags ? 19 : 0) + (n.x.decisao ? 22 : 0) + 26;
}
function lnGeometria(M, V) {
  const x = (t) => LN_X0 + V.col.get(t) * LN_W;
  const caixa = {};
  // larguras e alturas primeiro (dependem das datas); as posições verticais depois
  for (const n of V.nos) {
    const w = Math.max(60, x(n.fim) - x(n.ini) - 12);
    caixa[n.id] = { l: x(n.ini) + 6, w, h: lnAltura(n, w) };
  }
  for (const g of V.grupos) {
    let h = 4;
    for (const id of g.ids) { const c = caixa[id]; c.w = Math.max(56, c.w - 8); c.h = lnAltura(V.porId[id], c.w); h += c.h + 4; }
    const fim = Math.max(...g.ids.map((id) => V.porId[id].fim));
    caixa[g.id] = { l: caixa[g.ids[0]].l - 4, w: Math.max(60, x(fim) - x(V.porId[g.ids[0]].ini) - 12), h };
  }
  const daCamada = (ator) => V.nos.filter((n) => n.ator === ator && !V.noGrupo[n.id]).map((n) => caixa[n.id].h);
  const altEst = Math.max(60, ...daCamada('est'), ...V.grupos.map((g) => caixa[g.id].h));
  const meia1 = Math.max(26, ...daCamada('l1').map((h) => h / 2));
  const meia2 = Math.max(26, ...daCamada('l2').map((h) => h / 2));
  let altCli = Math.max(30, ...daCamada('cli'));
  const altOut = Math.max(30, ...daCamada('out'));
  // os três atores: o cartão vai da 1ª à 2ª linha; a faixa do cliente cresce se ele não couber
  const tres = Math.max(0, ...daCamada('tres'));
  altCli = Math.max(altCli, tres - meia1 - meia2 - 24);
  const cam = {};
  let y = LN_Y_CAM;
  if (!LN.cliente) { cam.est = { y, h: 14 + altEst + meia1 + 12 }; y += cam.est.h; } else y += meia1 + 12;   // sem o estúdio, a 1ª linha desce
  const l1 = y;
  cam.cli = { y, h: meia1 + 12 + altCli + meia2 + 12 }; y += cam.cli.h;
  const l2 = y;
  cam.out = { y, h: meia2 + 12 + altOut + 16 }; y += cam.out.h;
  const largura = LN_X0 * 2 + Math.max(1, V.marcos.length - 1) * LN_W + 40;
  for (const n of V.nos) {
    if (V.noGrupo[n.id]) continue;
    const c = caixa[n.id];
    if (n.ator === 'est') c.t = cam.est.y + 14;
    else if (n.ator === 'cli') c.t = l1 + meia1 + 12;
    else if (n.ator === 'out') c.t = l2 + meia2 + 12;
    else if (n.ator === 'l1') c.t = l1 - c.h / 2;
    else if (n.ator === 'l2') c.t = l2 - c.h / 2;
    else { c.t = l1 - meia1; c.h = l2 - l1 + meia1 + meia2; }       // os três atores
  }
  for (const g of V.grupos) {
    const cg = caixa[g.id]; cg.t = cam.est.y + 14;
    let t = cg.t + 4;
    for (const id of g.ids) { const c = caixa[id]; c.l = cg.l + 4; c.t = t; t += c.h + 4; }
  }
  return { x, cam, l1, l2, altura: y + 8, largura, caixa };
}

// ---------------------------------------------------------------- desenho
const lnIconeTipo = (x) => {
  if (ehEnt(x)) return '';
  if (x.decisao) return ICONE.decisao;
  if (x.cliente && x.terceiros) return ICONE.terceiros;
  if (x.cliente) return ICONE.cliente;
  if (x.terceiros) return ICONE.terceiros;
  return '';
};
function lnTitulo(n) {
  if (n.resumo) return `${n.nome}\n${n.n} passos · ${lnDataLonga(n.ini)} → ${lnDataLonga(n.fim)}\nClique na faixa da etapa para expandir.`;
  const x = n.x;
  const tipo = n.ent ? 'Entrega' : x.encerramento ? 'Encerramento' : nomeDe(TIPOS_EVT, x.tipo);
  const dur = n.pontual ? 'pontual' : `${n.dias} dia${n.dias > 1 ? 's' : ''} úte${n.dias > 1 ? 'is' : 'il'}${n.semPrazo ? ' (sem prazo no PGT)' : n.estimado ? ' (estimado)' : ''}`;
  const quem = { est: 'estúdio', cli: 'tempo do cliente', out: 'tempo de terceiros', l1: 'estúdio + cliente', l2: 'estúdio + terceiros', tres: 'estúdio + cliente + terceiros' }[n.ator];
  return [`${x.codigo} · ${tipo}`, x.texto || x.nome, `${lnDataLonga(n.ini)} → ${lnDataLonga(n.fim)} · ${dur}`, quem,
    n.opcional ? 'Opcional neste serviço' : '', n.susp === 'pendente' ? `Suspenso até ${n.lib.ev.codigo}: entra com «${n.lib.res.nome}»` : '',
    n.susp === 'liberado' ? `Liberado por ${n.lib.ev.codigo} («${n.lib.res.nome}»)` : '', 'Duplo clique: abrir na edição'].filter(Boolean).join('\n');
}
// botões do cartão na visão geral: pertinência no serviço da Linha, prazo (− +), materiais, abrir, cadeado
const LN_PERT_PROX = { P: 'O', O: '', '': 'P' };
function lnPrazoCurto(t) {
  if (!t) return 'sem prazo';
  return fmtPrazo(t);
}
function lnAcoes(n) {
  const x = n.x;
  const trv = travado(x.id);
  const dis = trv ? 'disabled' : '';
  const p = x.servicos[LN.srv] || '';
  const temPrazo = n.ent || x.tempo === 'estudio';
  const mats = materiaisDe(x.id).length;
  return `<div class="ln-acoes">
    ${x.encerramento ? '<span class="ln-ac ln-ac--pert" data-p="S" title="Perpétuo: vale sempre">∞</span>'
      : `<button type="button" class="ln-ac ln-ac--pert" data-p="${p}" data-ac="pert|${x.id}" ${dis} title="Pertinência em ${escHtml(D.servicos.find((s) => s.id === LN.srv)?.sigla || '')}: ${escHtml(nomeDe(PERTINENCIAS, p))} (clique: P → O → —)">${p || '—'}</button>`}
    ${temPrazo ? `<span class="ln-ac--prazo"><button type="button" class="ln-ac" data-ac="menos|${x.id}" ${dis} title="Encurtar">−</button><span title="Prazo no PGT">${lnPrazoCurto(x.prazo_turnos)}</span><button type="button" class="ln-ac" data-ac="mais|${x.id}" ${dis} title="Alongar">+</button></span>`
      : `<span class="ln-ac--info">${n.pontual ? 'pontual' : `${n.dias} dias ~`}</span>`}
    <span class="ln-acoes__dir">
      <button type="button" class="ln-ac" data-ac="mat|${x.id}" title="${mats ? `${mats} material(is): abrir para ler` : 'Sem materiais: abrir para acrescentar'}">${ICONE.clipe}${mats || ''}</button>
      <button type="button" class="ln-ac" data-ac="abrir|${x.id}" title="Abrir (ou duplo clique)">${ICONE.lapis}</button>
      <button type="button" class="ln-ac ln-ac--trava${trv ? ' is-on' : ''}" data-ac="trava|${x.id}" ${!x.travado && trv ? 'disabled' : ''} title="${trv ? (x.travado ? 'Destravar' : 'Travado pela etapa ou fase') : 'Travar'}">${trv ? ICONE.cadeado : ICONE.aberto}</button>
    </span></div>`;
}
function lnCartao(n, c, V) {
  const st = `left:${c.l}px;top:${c.t}px;width:${c.w}px;height:${c.h}px;--fase:${lnCorFase(n.fase)}`;
  if (n.resumo) {
    return `<div class="ln-no ln-no--resumo" data-no="${n.id}" style="${st}" title="${escHtml(lnTitulo(n))}">
      <div class="ln-no__cab"><span class="ln-no__cod">${escHtml(n.chave.startsWith('f:') ? n.fase.nome : n.etapa.sigla)}</span><span>${n.n} passos</span></div>
      <div class="ln-no__nome">${escHtml(n.nome)}</div>
      <div class="ln-no__pe">${n.decisoes ? `<span>${ICONE.decisao} ${n.decisoes}</span>` : ''}${n.susp ? `<span class="ln-tag--susp">${n.susp} suspenso${n.susp > 1 ? 's' : ''}</span>` : ''}</div></div>`;
  }
  const x = n.x;
  const cls = ['ln-no', n.ent ? 'ln-no--ent' : 'ln-no--evt', x.encerramento ? 'ln-no--enc' : '', x.decisao ? 'ln-no--dec' : '',
    n.opcional || n.susp === 'pendente' ? 'is-tracejado' : '', n.susp === 'pendente' ? 'is-suspenso' : '',
    ['l1', 'l2', 'tres'].includes(n.ator) ? 'ln-no--linha' : '', n.ator === 'tres' ? 'ln-no--tres' : '', V.noGrupo[n.id] ? 'ln-no--membro' : ''].filter(Boolean).join(' ');
  const dur = n.pontual ? '' : `${n.dias}d${n.semPrazo ? '*' : n.estimado ? '~' : ''}`;
  const tags = [n.susp === 'pendente' ? `<span class="ln-tag--susp">suspenso · ${escHtml(n.lib.ev.codigo)} → ${escHtml(n.lib.res.nome)}</span>` : '',
    n.susp === 'liberado' ? `<span class="ln-tag--lib">liberado · ${escHtml(n.lib.res.nome)}</span>` : '',
    n.opcional && !n.susp ? '<span>opcional</span>' : ''].filter(Boolean);
  let dec = '';
  if (x.decisao) {
    const r = LN.decisoes[x.id];
    dec = `<div class="ln-dec">${x.decisao.map((res, i) => `<button type="button" class="ln-dec__b${r === res.id ? ' is-on' : ''}${i === 0 ? ' is-esperado' : ''}" data-dec="${x.id}|${res.id}" title="${escHtml(res.nome)} · ${i === 0 ? 'caminho esperado' : res.libera.length ? `libera ${res.libera.map(codigoDe).join(', ')}` : 'sem cartões relacionados'}">${escHtml(res.nome)}</button>`).join('')}
      ${r ? `<button type="button" class="ln-dec__b ln-dec__desfaz" data-dec="${x.id}|" title="Desfazer a decisão">↺</button>` : ''}</div>`;
  }
  return `<div class="${cls}" data-no="${n.id}" style="${st}" title="${escHtml(lnTitulo(n))}">
    <div class="ln-no__cab"><span class="ln-no__cod">${lnIconeTipo(x)}${escHtml(x.codigo)}</span><span>${dur}</span></div>
    <div class="ln-no__nome">${escHtml(x.texto || x.nome)}</div>
    ${tags.length ? `<div class="ln-no__pe">${tags.join('')}</div>` : ''}${dec}${lnAcoes(n)}</div>`;
}

function lnFios(V, G) {
  const ancora = (id, lado) => {
    const g = V.noGrupo[id]; const c = G.caixa[g ? g.id : id];
    return { x: lado === 'saida' ? c.l + c.w : c.l, y: c.t + Math.min(c.h / 2, 26), id: g ? g.id : id };
  };
  const fios = []; const visto = new Set();
  for (let i = 1; i < V.passos.length; i++) {
    const de = [...new Set(V.passos[i - 1].map((id) => V.noGrupo[id]?.id || id))];
    const para = [...new Set(V.passos[i].map((id) => V.noGrupo[id]?.id || id))];
    for (const a of de) for (const b of para) {
      const k = a + '>' + b; if (a === b || visto.has(k)) continue; visto.add(k);
      const A = ancora(V.noGrupo[a] ? V.noGrupo[a].ids[0] : a, 'saida'); const B = ancora(V.noGrupo[b] ? V.noGrupo[b].ids[0] : b, 'entrada');
      A.id = a; B.id = b;
      fios.push({ a, b, A, B });
    }
  }
  // gatilhos: decisão → cartões que ela libera
  for (const n of V.nos) {
    if (n.resumo || !n.x.decisao) continue;
    for (const r of n.x.decisao) for (const id of r.libera) {
      if (!G.caixa[id]) continue;
      const c = G.caixa[n.id]; const d = G.caixa[id];
      fios.push({ a: n.id, b: id, gatilho: true, rotulo: r.nome, A: { x: c.l + c.w / 2, y: c.t + c.h }, B: { x: d.l + d.w / 2, y: d.t + d.h } });
    }
  }
  const caminho = (f) => {
    const { A, B } = f;
    if (f.gatilho) { const yb = Math.max(A.y, B.y) + 22; return `M${A.x} ${A.y} C${A.x} ${yb},${B.x} ${yb},${B.x} ${B.y + 3}`; }
    const mx = Math.max(18, (B.x - A.x) / 2);
    return `M${A.x} ${A.y} C${A.x + mx} ${A.y},${B.x - mx} ${B.y},${B.x - 3} ${B.y}`;
  };
  return { fios, svg: `<svg class="ln-fios" width="${G.largura}" height="${G.altura}" aria-hidden="true">
    <defs><marker id="ln-seta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#888780"/></marker>
      <marker id="ln-seta-g" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#2F6FD0"/></marker></defs>
    ${fios.map((f, i) => `${f.gatilho ? '' : `<path class="ln-fio-toque" data-toque="${i}" d="${caminho(f)}"/>`}<path class="ln-fio${f.gatilho ? ' ln-fio--gatilho' : ''}" data-fio="${i}" d="${caminho(f)}" marker-end="url(#${f.gatilho ? 'ln-seta-g' : 'ln-seta'})"/>
      ${f.gatilho ? `<text class="ln-fio__rot" x="${(f.A.x + f.B.x) / 2}" y="${Math.max(f.A.y, f.B.y) + 20}">${escHtml(f.rotulo)}</text>` : ''}`).join('')}
  </svg>` };
}

function lnCorSalto(n) {        // n = dias úteis até a data seguinte: 1 → verde, 7+ → vermelho
  const k = Math.max(0, Math.min(1, (n - 1) / 6));
  const h = 130 - 130 * k;
  return `hsl(${h} 60% ${50 - 4 * k}%)`;
}

function lnFaixas(M, V, G) {
  // faixa das fases e das etapas (clique recolhe/expande), régua de datas e faixa de compressão
  const blocos = (chave, grupo) => {
    const out = [];
    for (const n of V.nos) {
      const k = chave(n);
      const ult = out[out.length - 1];
      if (ult && ult.k === k) { ult.ini = Math.min(ult.ini, n.ini); ult.fim = Math.max(ult.fim, n.fim); } else out.push({ k, ini: n.ini, fim: n.fim, n });
    }
    return out.map((b) => grupo(b)).join('');
  };
  const fases = blocos((n) => n.fase.id, (b) => {
    const rec = LN.recolhidas.has('f:' + b.n.fase.id);
    return `<button type="button" class="ln-faixa ln-faixa--fase${rec ? ' is-recolhida' : ''}" data-recolher="f:${b.n.fase.id}" style="left:${G.x(b.ini)}px;width:${Math.max(30, G.x(b.fim) - G.x(b.ini))}px;top:${LN_Y_FASE}px;--fase:${lnCorFase(b.n.fase)}"
      title="${rec ? 'Expandir' : 'Recolher'} a fase ${escHtml(b.n.fase.nome)}">${rec ? '▸' : '▾'} ${escHtml(b.n.fase.nome)}</button>`;
  });
  const etapas = blocos((n) => (LN.recolhidas.has('f:' + n.fase.id) ? 'f:' + n.fase.id : n.etapa.id), (b) => {
    if (LN.recolhidas.has('f:' + b.n.fase.id)) return '';
    const e = b.n.etapa; const rec = LN.recolhidas.has(e.id);
    return `<button type="button" class="ln-faixa ln-faixa--etapa${rec ? ' is-recolhida' : ''}" data-recolher="${e.id}" style="left:${G.x(b.ini)}px;width:${Math.max(30, G.x(b.fim) - G.x(b.ini))}px;top:${LN_Y_ETAPA}px;--fase:${lnCorFase(b.n.fase)}"
      title="${rec ? 'Expandir' : 'Recolher'} ${escHtml(e.sigla + ' · ' + e.nome)}">${rec ? '▸' : '▾'} ${escHtml(e.sigla)}</button>`;
  });
  let mesAntes = -1;
  const regua = V.marcos.map((t) => {
    const d = new Date(t); const mes = d.getUTCMonth();
    const novoMes = mes !== mesAntes; mesAntes = mes;
    const fds = !lnUtil(t);
    return `<div class="ln-data${fds ? ' is-fds' : ''}${novoMes ? ' is-mes' : ''}" style="left:${G.x(t)}px;top:${LN_Y_REGUA}px"><span>${LN_SEM[d.getUTCDay()]}${novoMes ? ` · <b>${LN_MES[mes]}</b>` : ''}</span>${lnDM(t)}</div>`;
  }).join('');
  const marcas = V.marcos.map((t) => `<div class="ln-marca" style="left:${G.x(t)}px;top:${LN_Y_COMP}px;height:${G.altura - LN_Y_COMP}px"></div>`).join('');
  const comp = V.marcos.slice(0, -1).map((t, i) => {
    const prox = V.marcos[i + 1];
    const uteis = lnUteisEntre(t, prox);
    const corridos = Math.round((prox - t) / LN_DIA);
    return `<div class="ln-comp" style="left:${G.x(t)}px;width:${LN_W}px;top:${LN_Y_COMP}px;background:${lnCorSalto(uteis)}"
      title="${lnDM(t)} → ${lnDM(prox)}: ${corridos} dia${corridos > 1 ? 's' : ''} corrido${corridos > 1 ? 's' : ''}, ${uteis} út${uteis > 1 ? 'eis' : 'il'}">${uteis > 1 ? `+${corridos}d` : ''}</div>`;
  }).join('');
  return fases + etapas + regua + marcas + comp;
}

function desenharLinha() {
  const el = document.getElementById('linha');
  if (!el || !D || el.closest('[data-painel]')?.hidden) return;
  const antes = el.querySelector('.ln-rolo');
  if (antes) LN.rolagem = antes.scrollLeft;
  const M = lnModelo();
  const V = lnVista(M);
  const G = lnGeometria(M, V);
  const F = lnFios(V, G);
  const srvNome = D.servicos.find((s) => s.id === M.srv);
  const ano = new Date().getFullYear();
  const total = lnUteisEntre(M.inicio, M.fim);
  const semPrazo = M.nos.filter((n) => n.semPrazo).length;
  const decisoesPendentes = M.nos.filter((n) => n.x.decisao && !LN.decisoes[n.x.id]).length;
  const cartoes = [
    ...V.grupos.map((g) => `<div class="ln-grupo" data-no="${g.id}" style="left:${G.caixa[g.id].l}px;top:${G.caixa[g.id].t}px;width:${G.caixa[g.id].w}px;height:${G.caixa[g.id].h}px;--fase:${lnCorFase(V.porId[g.ids[0]].fase)}" title="Entregas que correm juntas: contam pela mais longa"></div>`),
    ...V.nos.map((n) => lnCartao(n, G.caixa[n.id], V)),
  ].join('');
  const linhas = `<div class="ln-linha" style="top:${G.l1}px;width:${G.largura}px"></div><div class="ln-linha" style="top:${G.l2}px;width:${G.largura}px"></div>
    ${LN.cliente ? '' : `<div class="ln-camada" style="top:${G.cam.est.y}px;height:${G.cam.est.h}px;width:${G.largura}px"></div>`}
    <div class="ln-camada ln-camada--cli" style="top:${G.cam.cli.y}px;height:${G.cam.cli.h}px;width:${G.largura}px"></div>
    <div class="ln-camada" style="top:${G.cam.out.y}px;height:${G.cam.out.h}px;width:${G.largura}px"></div>`;
  const lateral = `<div class="ln-lateral" style="height:${G.altura}px">
    <div class="ln-rot" style="top:${LN_Y_FASE + 2}px">fase</div><div class="ln-rot" style="top:${LN_Y_ETAPA + 2}px">etapa</div>
    <div class="ln-rot" style="top:${LN_Y_REGUA + 6}px">datas</div><div class="ln-rot" style="top:${LN_Y_COMP - 2}px">compressão</div>
    ${LN.cliente ? '' : `<div class="ln-rot ln-rot--cam" style="top:${G.cam.est.y + 10}px">Estúdio</div>`}
    <div class="ln-rot ln-rot--linha" style="top:${G.l1 - 9}px">1ª linha<small>interação com o cliente · visibilidade</small></div>
    <div class="ln-rot ln-rot--cam" style="top:${G.l1 + LN_LINHA / 2 + 8}px">Cliente</div>
    <div class="ln-rot ln-rot--linha" style="top:${G.l2 - 9}px">2ª linha<small>interação com terceiros</small></div>
    <div class="ln-rot ln-rot--cam" style="top:${G.l2 + LN_LINHA / 2 + 8}px">Outros</div></div>`;
  el.innerHTML = `<div class="ln">
    <div class="ln-barra">
      <select id="ln-srv" aria-label="Serviço">${D.servicos.map((s) => `<option value="${s.id}" ${s.id === M.srv ? 'selected' : ''}>${escHtml(s.sigla + ' · ' + s.nome)}</option>`).join('')}</select>
      <label class="small"><input type="checkbox" id="ln-opc" ${LN.opcionais ? 'checked' : ''}> mostrar opcionais</label>
      <label class="small"><input type="checkbox" id="ln-cli" ${LN.cliente ? 'checked' : ''}> ver como cliente</label>
      <button type="button" class="btn-link" id="ln-rec">${LN.recolhidas.size ? 'expandir tudo' : 'recolher etapas'}</button>
      ${Object.keys(LN.decisoes).length ? '<button type="button" class="btn-link" id="ln-dec0">desfazer decisões</button>' : ''}
      <span class="ln-resumo small muted">Referência: início em ${lnDataLonga(M.inicio)}/${ano} · ${total} dias úteis até ${lnDataLonga(M.fim)}
        ${semPrazo ? ` · <span title="Passos sem prazo no PGT contam 1 dia">${semPrazo} sem prazo*</span>` : ''}${decisoesPendentes ? ` · ${decisoesPendentes} ${decisoesPendentes > 1 ? 'decisões' : 'decisão'} em aberto` : ''}</span>
    </div>
    ${M.nos.length ? `<div class="ln-corpo">${lateral}
      <div class="ln-rolo"><div class="ln-tela${LN.sel ? ' tem-sel' : ''}" style="width:${G.largura}px;height:${G.altura}px">${linhas}${lnFaixas(M, V, G)}${F.svg}${cartoes}</div></div></div>
      <div class="ln-mini" id="ln-mini" title="Clique para ir ao trecho">${lnMini(V, G)}</div>`
    : `<div class="vazio"><p>Nada do PGT vale para ${escHtml(srvNome?.nome || 'este serviço')}${LN.opcionais ? '' : ' (sem os opcionais)'}.</p></div>`}
    <div class="ln-legenda small">
      <span><i class="ln-am ln-am--ent"></i> entrega</span><span><i class="ln-am ln-am--evt"></i> evento</span>
      <span><i class="ln-am ln-am--trac"></i> opcional ou suspenso</span><span>${ICONE.decisao} decisão (os botões simulam o resultado)</span>
      <span><i class="ln-am ln-am--grupo"></i> correm juntas</span><span><i class="ln-am ln-am--gat"></i> gatilho</span>
      <span>borda = fase: ${M.fases.map((fa) => `<b style="color:${lnCorFase(fa)}">${escHtml(fa.nome)}</b>`).join(' · ')}</span>
      <span>vários: Ctrl+clique ou arraste no vazio · Esc limpa</span>
      <span>* sem prazo no PGT (1 dia) · ~ estimado (cliente ${LN_DIAS_CLIENTE}, terceiros ${LN_DIAS_TERCEIROS} dias úteis)</span>
    </div></div>`;
  ligarLinha(el, M, V, G, F);
}

function lnMini(V, G) {
  const H = 56; const k = H / G.altura;
  const sx = 100 / G.largura;
  const cor = { est: 'var(--tinta-2)', cli: '#2F6FD0', out: '#888780', l1: '#2F6FD0', l2: '#888780', tres: '#2F6FD0' };
  return `<div class="ln-mini__tela">${V.nos.map((n) => { const c = G.caixa[n.id];
    return `<i style="left:${c.l * sx}%;width:${Math.max(0.3, c.w * sx)}%;top:${c.t * k}px;height:${Math.max(2, c.h * k)}px;background:${n.resumo ? lnCorFase(n.fase) : cor[n.ator]};opacity:${n.susp === 'pendente' ? .35 : .7}"></i>`; }).join('')}
    <div class="ln-mini__linha" style="top:${G.l1 * k}px"></div><div class="ln-mini__linha" style="top:${G.l2 * k}px"></div>
    <div class="ln-mini__janela" id="ln-janela"></div></div>`;
}

function ligarLinha(el, M, V, G, F) {
  const rolo = el.querySelector('.ln-rolo');
  const redesenhar = () => { lnGuardar(); desenharLinha(); };
  el.querySelector('#ln-srv').onchange = (ev) => { LN.srv = ev.target.value; LN.recolhidas.clear(); LN.sel = null; LN.rolagem = 0; redesenhar(); };
  el.querySelector('#ln-opc').onchange = (ev) => { LN.opcionais = ev.target.checked; redesenhar(); };
  el.querySelector('#ln-cli').onchange = (ev) => { LN.cliente = ev.target.checked; LN.sel = null; redesenhar(); };
  el.querySelector('#ln-rec').onclick = () => {
    if (LN.recolhidas.size) LN.recolhidas.clear(); else M.etapas.forEach((e) => LN.recolhidas.add(e.id));
    redesenhar();
  };
  const d0 = el.querySelector('#ln-dec0');
  if (d0) d0.onclick = () => { LN.decisoes = {}; redesenhar(); };
  if (!rolo) return;
  rolo.scrollLeft = LN.rolagem;
  el.querySelectorAll('[data-recolher]').forEach((b) => b.onclick = () => {
    const k = b.dataset.recolher;
    LN.recolhidas.has(k) ? LN.recolhidas.delete(k) : LN.recolhidas.add(k);
    redesenhar();
  });
  el.querySelectorAll('[data-ac]').forEach((b) => b.onclick = (ev) => { ev.stopPropagation(); lnAcao(...b.dataset.ac.split('|')); });
  el.querySelectorAll('[data-dec]').forEach((b) => b.onclick = (ev) => {
    ev.stopPropagation();
    const [id, r] = b.dataset.dec.split('|');
    if (!r || LN.decisoes[id] === r) delete LN.decisoes[id]; else LN.decisoes[id] = r;
    redesenhar();
  });
  // seleção: destaca os fios e os vizinhos; o resto esmaece
  const tela = el.querySelector('.ln-tela');
  const marcar = () => {
    tela.classList.toggle('tem-sel', !!LN.sel);
    const lig = new Set(LN.sel ? [LN.sel] : []);
    const sel = LN.sel && V.noGrupo[LN.sel] ? V.noGrupo[LN.sel].id : LN.sel;
    F.fios.forEach((f, i) => {
      const on = !!sel && (f.a === sel || f.b === sel || f.a === LN.sel || f.b === LN.sel);
      tela.querySelector(`[data-fio="${i}"]`)?.classList.toggle('is-lig', on);
      if (on) { lig.add(f.a); lig.add(f.b); }
    });
    for (const id of [...lig]) { const g = V.grupos.find((x) => x.id === id); if (g) g.ids.forEach((m) => lig.add(m)); }
    if (sel && V.noGrupo[LN.sel]) lig.add(V.noGrupo[LN.sel].id);
    tela.querySelectorAll('[data-no]').forEach((c) => {
      c.classList.toggle('is-sel', c.dataset.no === LN.sel);
      c.classList.toggle('is-lig', lig.has(c.dataset.no));
    });
  };
  tela.addEventListener('click', (ev) => {
    const c = ev.target.closest('.ln-no, .ln-grupo');
    if (ev.target.closest('button, input, select, .ln-novo')) return;
    if (lnLaco.arrastou) { lnLaco.arrastou = false; return; }
    if (ev.ctrlKey || ev.metaKey || ev.shiftKey) {               // seleção múltipla
      if (c) { lnAlternarSelecao(lnIdsDoNo(c.dataset.no, V)); lnMarcarSelecao(tela); }
      return;
    }
    if (!c && LN.selecao.size) { LN.selecao.clear(); lnMarcarSelecao(tela); }
    LN.sel = c && LN.sel !== c.dataset.no ? c.dataset.no : null;
    marcar();
  });
  lnLigarLaco(tela, V, G);
  lnMarcarSelecao(tela);
  tela.addEventListener('dblclick', (ev) => {
    const c = ev.target.closest('.ln-no');
    if (!c || ev.target.closest('button')) return;
    const id = c.dataset.no;
    if (id.startsWith('sum:')) { const k = id.slice(4); LN.recolhidas.delete(k.slice(2)); LN.recolhidas.delete(k); redesenhar(); return; }
    lnAbrirModal(id);
  });
  if (LN.sel && !tela.querySelector(`[data-no="${CSS.escape(LN.sel)}"]`)) LN.sel = null;
  marcar();
  // minimapa: janela visível e clique para rolar
  const mini = el.querySelector('#ln-mini'); const janela = el.querySelector('#ln-janela');
  const atualizarJanela = () => {
    const sx = 100 / G.largura;
    janela.style.left = `${rolo.scrollLeft * sx}%`;
    janela.style.width = `${Math.min(100, rolo.clientWidth * sx)}%`;
  };
  rolo.addEventListener('scroll', () => { LN.rolagem = rolo.scrollLeft; atualizarJanela(); }, { passive: true });
  mini.onclick = (ev) => {
    const r = mini.getBoundingClientRect();
    rolo.scrollTo({ left: ((ev.clientX - r.left) / r.width) * G.largura - rolo.clientWidth / 2, behavior: 'smooth' });
  };
  atualizarJanela();
  // roda do mouse rola a linha na horizontal (enquanto houver para onde rolar; depois, a página)
  rolo.addEventListener('wheel', (ev) => {
    if (ev.shiftKey || Math.abs(ev.deltaX) > Math.abs(ev.deltaY) || ev.target.closest('.ln-novo')) return;
    const max = rolo.scrollWidth - rolo.clientWidth;
    if ((ev.deltaY > 0 && rolo.scrollLeft < max - 1) || (ev.deltaY < 0 && rolo.scrollLeft > 0)) {
      rolo.scrollLeft += ev.deltaY * (ev.deltaMode === 1 ? 32 : 1);
      ev.preventDefault();
    }
  }, { passive: false });
  lnLigarNovoNoFio(tela, M, V, F);
}

// ---------------------------------------------------------------- criar cartão sobre o fio
// Pousar o mouse num fio da sequência mostra um "+" no meio dele; o cartão novo entra logo depois do
// cartão de onde o fio sai (na etapa dele) e empurra os seguintes. Vale para o serviço da Linha (P).
function lnLigarNovoNoFio(tela, M, V, F) {
  const mais = document.createElement('button');
  mais.type = 'button'; mais.className = 'ln-mais'; mais.textContent = '+'; mais.hidden = true;
  tela.appendChild(mais);
  let atual = null; let saida = null;
  const depoisDe = (f) => {           // id do passo de onde o fio sai (último de um grupo); null se não dá
    const a = f.a;
    if (a.startsWith('sum:')) return null;
    const g = V.grupos.find((x) => x.id === a);
    const id = g ? g.ids[g.ids.length - 1] : a;
    const no = V.porId[id];
    return no && !no.resumo && !no.x.encerramento ? id : null;
  };
  const esconder = () => { saida = setTimeout(() => { if (!tela.querySelector('.ln-novo')) mais.hidden = true; }, 250); };
  tela.querySelectorAll('[data-toque]').forEach((p) => {
    p.addEventListener('mouseenter', () => {
      const f = F.fios[Number(p.dataset.toque)];
      if (!depoisDe(f) || tela.querySelector('.ln-novo')) return;
      clearTimeout(saida);
      const pt = p.getPointAtLength(p.getTotalLength() / 2);
      atual = f; mais.style.left = `${pt.x}px`; mais.style.top = `${pt.y}px`; mais.hidden = false;
      mais.title = `Novo cartão depois de ${V.porId[depoisDe(f)].x.codigo}`;
    });
    p.addEventListener('mouseleave', esconder);
  });
  mais.addEventListener('mouseenter', () => clearTimeout(saida));
  mais.addEventListener('mouseleave', esconder);
  mais.onclick = (ev) => {
    ev.stopPropagation();
    const apos = depoisDe(atual); if (!apos) return;
    const no = V.porId[apos];
    const box = document.createElement('div');
    box.className = 'ln-novo';
    box.style.left = mais.style.left; box.style.top = mais.style.top;
    box.innerHTML = `<div class="small muted">Depois de <b>${escHtml(no.x.codigo)}</b>, em ${escHtml(no.etapa.sigla)} · vale (P) em ${escHtml(D.servicos.find((s) => s.id === M.srv)?.sigla || '')}</div>
      <select class="ln-novo__tipo" aria-label="Tipo"><option value="entrega">Entrega</option>${TIPOS_EVT.map((t) => `<option value="${t.id}">Evento · ${escHtml(t.nome)}</option>`).join('')}</select>
      <input class="ln-novo__nome" placeholder="Texto da entrega ou nome do evento" aria-label="Nome">
      <div><button type="button" class="btn btn--small">Criar</button> <button type="button" class="btn-link">cancelar</button></div>`;
    tela.appendChild(box); mais.hidden = true;
    const nome = box.querySelector('.ln-novo__nome'); const tipo = box.querySelector('.ln-novo__tipo');
    const [criar, cancelar] = box.querySelectorAll('button');
    nome.focus();
    const fechar = () => { box.remove(); };
    cancelar.onclick = fechar;
    const enviar = async () => {
      const t = nome.value.trim();
      if (!t) { nome.focus(); return; }
      criar.disabled = true;
      try {
        const servicos = { [M.srv]: 'P' };
        const etapa = no.etapa.id;
        const tp = tipo.value;
        const r = tp === 'entrega'
          ? await Universo.criar('pgt-entregaveis', { etapa_id: etapa, texto: t, servicos })
          : await Universo.criar('pgt-eventos', { etapa_id: etapa, nome: t, tipo: tp, servicos,
            cliente: ['reuniao', 'apresentacao', 'aprovacao', 'visita'].includes(tp) ? 1 : 0,
            tempo: tp === 'aprovacao' ? 'cliente' : ['ajuste', 'revisao'].includes(tp) ? 'estudio' : 'pontual' });
        const ids = D.seq[etapa].map((x) => x.id);
        ids.splice(ids.indexOf(apos) + 1, 0, r.id);
        await Universo.post('pgt/sequencia', { etapa_id: etapa, ids });
        esquecerDaFila((op) => op.tipo === 'sq' && op.grupo === etapa);
        LN.sel = r.id;
        aviso(''); await recarregar();
      } catch (err) { aviso(mensagemDe(err)); criar.disabled = false; }
    };
    criar.onclick = enviar;
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter') enviar(); if (e.key === 'Escape') fechar(); });
  };
}

// ---------------------------------------------------------------- popup do cartão (duplo clique)
// O cartão inteiro, em edição, à esquerda (o mesmo da aba de edição, só com a coluna do serviço da Linha);
// à direita, os materiais com link abertos para leitura (Drive e Google Docs em modo de visualização).
// Grande o bastante para ler documentos sem redimensionar.
function lnAbrirModal(id) {
  if (!(entDe(id) || evtDe(id))) return;
  LN.modal = id; LN.mat = null;
  EDITANDO.add(id);
  lnDesenharModal();
}
function lnFecharModal() {
  if (!LN.modal) return;
  EDITANDO.delete(LN.modal);
  LN.modal = null;
  document.getElementById('ln-modal')?.remove();
  document.body.classList.remove('ln-modal-aberto');
  desenharPlano();
}
// link de leitura: Drive e Google Docs em /preview; o resto como veio
function lnPrevia(url) {
  try {
    const u = new URL(url);
    let m = u.pathname.match(/\/file\/d\/([^/]+)/);
    if (u.hostname === 'drive.google.com' && m) return `https://drive.google.com/file/d/${m[1]}/preview`;
    if (u.hostname === 'drive.google.com' && u.searchParams.get('id')) return `https://drive.google.com/file/d/${u.searchParams.get('id')}/preview`;
    m = u.pathname.match(/^\/(document|spreadsheets|presentation|forms)\/d\/([^/]+)/);
    if (u.hostname === 'docs.google.com' && m) return `https://docs.google.com/${m[1]}/d/${m[2]}/${m[1] === 'forms' ? 'viewform?embedded=true' : 'preview'}`;
    return url;
  } catch (_) { return url; }
}
function lnDesenharModal() {
  if (!LN.modal) return;
  const x = entDe(LN.modal) || evtDe(LN.modal);
  if (!x) { LN.modal = null; document.getElementById('ln-modal')?.remove(); document.body.classList.remove('ln-modal-aberto'); return; }
  let raiz = document.getElementById('ln-modal');
  const rolagem = raiz?.querySelector('.lnm-esq')?.scrollTop || 0;
  if (!raiz) {
    raiz = document.createElement('div'); raiz.id = 'ln-modal';
    document.body.appendChild(raiz);
    raiz.addEventListener('mousedown', (ev) => { if (ev.target === raiz.firstElementChild) lnFecharModal(); });
  }
  document.body.classList.add('ln-modal-aberto');
  const e = etapaDe(x.etapa_id); const fa = e ? faseDe(e.fase_id) : null;
  const srv = D.servicos.find((s) => s.id === LN.srv) || D.servicos[0];
  // o cartão com uma coluna de serviço só (a da Linha); S é a lista de serviços visíveis do plano
  const S0 = S; S = [srv];
  const cartao = x.encerramento ? cartaoEncerramento(x, e) : ehEnt(x) ? cartaoEnt(x, false) : cartaoEvento(x, false);
  S = S0;
  const mats = materiaisDe(x.id);
  const comLink = mats.filter((m) => m.link);
  if (!LN.mat || !comLink.some((m) => m.id === LN.mat)) LN.mat = comLink[0]?.id || null;
  const sel = comLink.find((m) => m.id === LN.mat);
  raiz.innerHTML = `<div class="lnm-fundo"><div class="lnm" role="dialog" aria-modal="true" aria-label="${escHtml(x.codigo)}" style="--fase:${fa ? lnCorFase(fa) : 'var(--linha-forte)'}">
    <header class="lnm-cab"><div><span class="lnm-cod">${escHtml(x.codigo)}</span> ${escHtml(x.texto || x.nome)}
      <span class="small muted">· ${escHtml(fa?.nome || '')} › ${escHtml(e ? e.sigla + ' · ' + e.nome : '')} · coluna: ${escHtml(srv.sigla)}</span></div>
      <button type="button" class="lnm-fechar" aria-label="Fechar" title="Fechar (Esc)">×</button></header>
    <div class="lnm-corpo">
      <section class="lnm-esq"><div class="plano" style="--cols:52px 64px minmax(0,1fr) 196px 36px 40px">${cartao}</div>
        <p class="small muted lnm-nota">As mudanças vão para a barra de "não salvas", como na aba de edição (Ctrl+S salva).</p></section>
      <section class="lnm-dir">
        <div class="lnm-abas">${comLink.length ? comLink.map((m) => `<button type="button" class="lnm-aba${m.id === LN.mat ? ' is-on' : ''}" data-ver="${m.id}">${escHtml(nomeDe(TIPOS_MAT, m.tipo))} · ${escHtml(m.nome)}</button>`).join('') : ''}
          ${sel ? `<a class="btn-link lnm-fora" href="${escHtml(sel.link)}" target="_blank" rel="noopener">abrir em nova aba ↗</a>` : ''}</div>
        ${sel ? `<iframe class="lnm-leitor" src="${escHtml(lnPrevia(sel.link))}" title="${escHtml(sel.nome)}" referrerpolicy="no-referrer"></iframe>`
          : `<div class="lnm-vazio"><p>${mats.length ? 'Os materiais deste cartão ainda não têm link.' : 'Este cartão ainda não tem materiais.'}</p>
            <p class="small muted">Acrescente um material com link (Drive, Google Docs, Biblioteca) no cartão, à esquerda, para lê-lo aqui. O envio de arquivos vem depois.</p></div>`}
      </section>
    </div></div></div>`;
  const esq = raiz.querySelector('.lnm-esq');
  esq.scrollTop = rolagem;
  ligarPlano(esq);
  raiz.querySelector('.lnm-fechar').onclick = lnFecharModal;
  raiz.querySelectorAll('[data-ver]').forEach((b) => b.onclick = () => { LN.mat = b.dataset.ver; lnDesenharModal(); });
  // o link de um material, dentro do popup, abre no leitor ao lado
  esq.querySelectorAll('.card--mat').forEach((c) => {
    const a = c.querySelector('.mat__nome a'); if (!a) return;
    a.onclick = (ev) => { ev.preventDefault(); LN.mat = c.dataset.card; lnDesenharModal(); };
  });
}
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && LN.modal && !ev.target.closest?.('input, textarea, select')) lnFecharModal(); });


// ---------------------------------------------------------------- seleção de vários cartões
// Ctrl/⌘/Shift + clique alterna um cartão; arrastar no vazio desenha uma caixa (com Ctrl/Shift, soma
// à seleção). A barra de baixo aplica a todos: pertinência nos serviços marcados, prazo, correr juntas,
// cadeado e arquivar. As mudanças vão para a fila de "não salvas" (menos arquivar, que grava na hora).
const lnLaco = { arrastou: false };
function lnIdsDoNo(id, V) {
  if (id.startsWith('grp:')) return V.grupos.find((g) => g.id === id)?.ids || [];
  if (id.startsWith('sum:')) return [];
  return [id];
}
function lnAlternarSelecao(ids) {
  const todos = ids.every((id) => LN.selecao.has(id));
  ids.forEach((id) => (todos ? LN.selecao.delete(id) : LN.selecao.add(id)));
}
function lnMarcarSelecao(tela) {
  for (const id of [...LN.selecao]) if (!(entDe(id) || evtDe(id))) LN.selecao.delete(id);
  tela?.querySelectorAll('.ln-no').forEach((c) => c.classList.toggle('is-multi', LN.selecao.has(c.dataset.no)));
  lnDesenharBarraSelecao();
}
function lnLigarLaco(tela, V, G) {
  tela.addEventListener('mousedown', (ev) => {
    if (ev.button !== 0 || ev.target.closest('.ln-no, .ln-grupo, button, input, select, .ln-faixa, .ln-novo, .ln-mais, [data-toque]')) return;
    const r0 = tela.getBoundingClientRect();
    const x0 = ev.clientX - r0.left; const y0 = ev.clientY - r0.top;
    const somar = ev.ctrlKey || ev.metaKey || ev.shiftKey;
    const laco = document.createElement('div'); laco.className = 'ln-laco'; tela.appendChild(laco);
    let caixa = null;
    const mover = (e) => {
      const r = tela.getBoundingClientRect();
      const x1 = e.clientX - r.left; const y1 = e.clientY - r.top;
      caixa = { l: Math.min(x0, x1), t: Math.min(y0, y1), r: Math.max(x0, x1), b: Math.max(y0, y1) };
      Object.assign(laco.style, { left: `${caixa.l}px`, top: `${caixa.t}px`, width: `${caixa.r - caixa.l}px`, height: `${caixa.b - caixa.t}px` });
      const rolo = tela.parentElement; const rr = rolo.getBoundingClientRect();     // rola nas bordas
      if (e.clientX > rr.right - 30) rolo.scrollLeft += 20; else if (e.clientX < rr.left + 30) rolo.scrollLeft -= 20;
    };
    const soltar = () => {
      window.removeEventListener('mousemove', mover); window.removeEventListener('mouseup', soltar);
      laco.remove();
      if (!caixa || (caixa.r - caixa.l < 6 && caixa.b - caixa.t < 6)) return;
      lnLaco.arrastou = true;
      if (!somar) LN.selecao.clear();
      for (const n of V.nos) {
        if (n.resumo) continue;
        const c = G.caixa[n.id];
        if (c.l < caixa.r && c.l + c.w > caixa.l && c.t < caixa.b && c.t + c.h > caixa.t) LN.selecao.add(n.id);
      }
      lnMarcarSelecao(tela);
    };
    window.addEventListener('mousemove', mover); window.addEventListener('mouseup', soltar);
    ev.preventDefault();
  });
}
function lnDesenharBarraSelecao() {
  const el = document.getElementById('ln-selbar');
  if (!el) return;
  const linhaVisivel = !document.getElementById('linha')?.closest('[data-painel]')?.hidden;
  const ids = [...LN.selecao];
  el.hidden = !ids.length || !linhaVisivel;
  if (el.hidden) return;
  if (!LN.selSrv.size || ![...LN.selSrv].every((s) => D.servicos.some((x) => x.id === s))) LN.selSrv = new Set([LN.srv || D.servicos[0].id]);
  const ents = ids.filter((id) => entDe(id)); const evs = ids.filter((id) => evtDe(id));
  const pertDe = (id, srv) => (entDe(id) || evtDe(id)).servicos[srv] || '';
  const resumoPert = (srv) => {          // como está hoje no serviço: tudo P, tudo O, misto…
    const ps = new Set(ids.filter((id) => !evtDe(id)?.encerramento).map((id) => pertDe(id, srv)));
    return ps.size === 1 ? ({ P: 'P', O: 'O', '': '—', S: '∞' })[[...ps][0]] : 'misto';
  };
  el.innerHTML = `<strong>${ids.length} selecionado${ids.length > 1 ? 's' : ''}</strong>
    <span class="small" style="opacity:.8">${ents.length} entrega${ents.length === 1 ? '' : 's'} · ${evs.length} evento${evs.length === 1 ? '' : 's'}</span>
    <span class="ln-sel__grupo">Serviços ${D.servicos.map((s) => `<button type="button" class="ln-sel__srv${LN.selSrv.has(s.id) ? ' is-on' : ''}" data-sel-srv="${s.id}" title="${escHtml(s.nome)} · hoje: ${resumoPert(s.id)}">${escHtml(s.sigla)}</button>`).join('')}</span>
    <span class="ln-sel__grupo">Pertinência
      <button type="button" class="btn btn--small" data-sel-pert="P" title="Vem marcado nos serviços escolhidos">P</button>
      <button type="button" class="btn btn--small" data-sel-pert="O" title="Opcional nos serviços escolhidos">O</button>
      <button type="button" class="btn btn--small" data-sel-pert="" title="Não se aplica nos serviços escolhidos">—</button></span>
    <span class="ln-sel__grupo"><select id="ln-sel-prazo" aria-label="Prazo"><option value="">prazo…</option>${PRAZOS.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}<option value="0">sem prazo</option></select></span>
    <span class="ln-sel__grupo">${ents.length > 1 ? '<button type="button" class="btn-link" data-sel="juntas">correr juntas</button><button type="button" class="btn-link" data-sel="separar">separar</button>' : ''}
      <button type="button" class="btn-link" data-sel="travar">travar</button><button type="button" class="btn-link" data-sel="destravar">destravar</button>
      <button type="button" class="btn-link" data-sel="arquivar">arquivar</button>
      <button type="button" class="btn-link" data-sel="todos">selecionar todos da linha</button>
      <button type="button" class="btn-link" data-sel="limpar">limpar (Esc)</button></span>`;
  el.querySelectorAll('[data-sel-srv]').forEach((b) => b.onclick = () => {
    const s = b.dataset.selSrv;
    LN.selSrv.has(s) ? LN.selSrv.delete(s) : LN.selSrv.add(s);
    lnDesenharBarraSelecao();
  });
  el.querySelectorAll('[data-sel-pert]').forEach((b) => b.onclick = () => lnSelAplicar('pert', b.dataset.selPert));
  el.querySelector('#ln-sel-prazo').onchange = (ev) => { if (ev.target.value !== '') lnSelAplicar('prazo', Number(ev.target.value)); };
  el.querySelectorAll('[data-sel]').forEach((b) => b.onclick = () => lnSelAplicar(b.dataset.sel));
}
async function lnSelAplicar(acao, valor) {
  const ids = [...LN.selecao];
  const livres = ids.filter((id) => !travado(id));
  const pulados = ids.length - livres.length;
  const fim = (msg) => { ordenar(D); derivar(D); desenhar(); if (msg) aviso(msg, 'ok'); };
  if (acao === 'limpar') { LN.selecao.clear(); lnMarcarSelecao(document.querySelector('.ln-tela')); return; }
  if (acao === 'todos') {
    document.querySelectorAll('.ln-tela .ln-no').forEach((c) => { if (!c.dataset.no.startsWith('sum:')) LN.selecao.add(c.dataset.no); });
    lnMarcarSelecao(document.querySelector('.ln-tela')); return;
  }
  const aviso2 = pulados ? ` ${pulados} travado${pulados > 1 ? 's' : ''} ficou de fora.` : '';
  if (acao === 'pert') {
    if (!LN.selSrv.size) { aviso('Escolha ao menos um serviço na barra.'); return; }
    let n = 0;
    for (const id of livres) {
      const ent = entDe(id); const ev = evtDe(id);
      if (ev?.encerramento) continue;
      for (const srv of LN.selSrv) { mudar(ent ? { tipo: 'pn', ent: id, srv, p: valor } : { tipo: 'pe', ev: id, srv, p: valor }); n++; }
    }
    return fim(`Pertinência ${valor || '—'} em ${livres.length} cartão(ões) × ${LN.selSrv.size} serviço(s). Falta salvar.${aviso2}`);
  }
  if (acao === 'prazo') {
    const alvo = livres.filter((id) => entDe(id) || evtDe(id)?.tempo === 'estudio');
    alvo.forEach((id) => mudar({ tipo: 'ed', id, campos: { prazo_turnos: valor || null } }));
    const fora = livres.length - alvo.length;
    return fim(`Prazo em ${alvo.length} cartão(ões).${fora ? ` ${fora} evento(s) sem tempo do estúdio ficaram de fora.` : ''} Falta salvar.${aviso2}`);
  }
  if (acao === 'juntas' || acao === 'separar') {
    let n = 0;
    for (const id of livres.filter((x) => entDe(x))) {
      const x = entDe(id); const seq = D.seq[x.etapa_id]; const i = seq.findIndex((y) => y.id === id);
      const antes = seq[i - 1];
      const junto = acao === 'juntas' ? (antes && ehEnt(antes) && LN.selecao.has(antes.id) ? 1 : 0) : 0;
      if ((x.junto_anterior || 0) !== junto && (acao === 'separar' || junto)) { mudar({ tipo: 'ed', id, campos: { junto_anterior: junto } }); n++; }
    }
    return fim(n ? `${n} entrega(s) ${acao === 'juntas' ? 'passam a correr junto com a anterior' : 'separadas'}. Falta salvar.${aviso2}`
      : acao === 'juntas' ? 'Só correm juntas entregas seguidas na mesma etapa, todas selecionadas.' : 'Nada a separar.');
  }
  if (acao === 'travar' || acao === 'destravar') {
    ids.forEach((id) => mudar({ tipo: 'ed', id, campos: { travado: acao === 'travar' ? 1 : 0 } }));
    return fim(`${ids.length} cartão(ões) ${acao === 'travar' ? 'travado(s)' : 'destravado(s)'}. Falta salvar.`);
  }
  if (acao === 'arquivar') {
    const alvo = livres.filter((id) => !evtDe(id)?.encerramento);
    if (!alvo.length) return;
    if (!confirm(`Arquivar ${alvo.length} cartão(ões)? Ficam em "Arquivados", no fim da página, e podem ser restaurados.`)) return;
    let ok = 0;
    for (const id of alvo) {
      try { await arquivarRegistro(registroEm(D0, id)); ok++; LN.selecao.delete(id); } catch (e) { aviso(`${codigoDe(id)}: ${mensagemDe(e)}`); }
    }
    esquecerDaFila((op) => alvo.includes(op.ent || op.ev || op.id));
    await recarregar();
    aviso(`${ok} cartão(ões) arquivado(s).${aviso2}`, 'ok');
  }
}
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && LN.selecao.size && !LN.modal && !ev.target.closest?.('input, textarea, select, .ln-novo')) {
    LN.selecao.clear(); lnMarcarSelecao(document.querySelector('.ln-tela'));
  }
});

function lnAcao(acao, id) {
  const x = entDe(id) || evtDe(id);
  if (!x) return;
  if (acao === 'abrir') return lnAbrirModal(id);
  if (acao === 'mat') { lnAbrirModal(id); return; }
  if (acao === 'trava') return mudar({ tipo: 'ed', id, campos: { travado: x.travado ? 0 : 1 } }, { redesenhar: true });
  if (travado(id)) return;
  if (acao === 'pert') {
    const p = LN_PERT_PROX[x.servicos[LN.srv] || ''];
    mudar(ehEnt(x) ? { tipo: 'pn', ent: id, srv: LN.srv, p } : { tipo: 'pe', ev: id, srv: LN.srv, p }, { redesenhar: true });
    if (p !== 'P' && !LN.opcionais) aviso(`${x.codigo} ficou ${p ? 'opcional' : 'fora'} em ${D.servicos.find((s) => s.id === LN.srv).sigla} e saiu da linha${p ? ' (ligue "mostrar opcionais" para vê-lo)' : ''}. Falta salvar.`, 'ok');
    return;
  }
  if (acao === 'menos' || acao === 'mais') {
    const vs = PRAZOS.map(([v]) => v);
    const t = x.prazo_turnos;
    let i = t ? vs.findIndex((v) => v >= t) : -1;
    if (acao === 'mais') i = t ? Math.min(vs.length - 1, (vs[i] === t ? i + 1 : i)) : vs.indexOf(2);
    else i = t ? (vs[i] === t ? i - 1 : i - 1) : -1;
    mudar({ tipo: 'ed', id, campos: { prazo_turnos: i >= 0 ? vs[i] : null } }, { redesenhar: true });
  }
}
