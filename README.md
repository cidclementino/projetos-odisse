# projetos-odisse

**Projetos** do Odisse, em https://projetos.odisse.com.br: projetos, etapas, prazos e apontamento de horas.
Uma das ferramentas do [Universo](https://universo.odisse.com.br); os dados moram no banco comum do
Universo (D1), não aqui. Repositório público: nenhum dado de cliente entra no git.

## Como funciona
- Páginas estáticas (GitHub Pages): `index.html` (lista), `projeto.html#prj_…` (ficha: etapas, horas,
  dados, local do imóvel, contrato), `horas.html` (semana de cada pessoa), `equipe.html`, `login.html`.
- `worker/`: Worker `projetos-odisse` (Cloudflare). Confere a senha (`PROJETOS_SENHA`) e repassa
  `/u/v1/…` à API do Universo pelo service binding `UNIVERSO` (ponto de entrada `Projetos`).
  Publicado pelo GitHub Actions a cada mudança em `worker/` (`.github/workflows/worker.yml`).
- Projetos nascem no vendas.odisse, quando o contrato principal é registrado como assinado no Funil
  (código AAAA-NNN, etapas e prazos da proposta, endereço do imóvel, co-clientes). Os que já existiam
  antes do Universo são cadastrados à mão aqui, com o código que já tinham.
- Visual: `styles.css` e `auth.js` são os mesmos do vendas.odisse; `base.js` adapta o cliente da API
  e as peças de tela de lá. `projetos.css` acrescenta o que é só daqui.

## Secrets do repositório
`CLOUDFLARE_API_TOKEN` (token `odisse-projetos`, modelo Edit Cloudflare Workers),
`CLOUDFLARE_ACCOUNT_ID`, `PROJETOS_SENHA` (senha desta ferramenta).
Trocar a senha: atualizar o secret e rodar "Publicar API de Projetos".

## Landing pages antigas
Até 11/11/2026 este endereço era das landing pages, que foram para https://servicos.odisse.com.br
(repo `servicos-odisse`). As pastas `inicio/`, `residencial/`, `interiores/`, `formulario-residencial/`
e `formulario-interiores/` só redirecionam para lá, preservando `gclid` e `utm_*` dos anúncios.
