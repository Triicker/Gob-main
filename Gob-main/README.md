# BASTA! — Escolas Unidas contra a Violência Doméstica

Site institucional do programa **BASTA!**, ecossistema de educação, prevenção e formação contra a violência doméstica: livros didáticos, aplicativo de segurança e formação para profissionais da educação.

- **Produção:** [basta.app.br](https://basta.app.br) — Cloudflare Worker `gob-main` (páginas estáticas + API dos formulários).
- **Site irmão:** Instituto BASTA! (repositório `Triicker/instituto-basta`, Worker `instituto-basta`), com a mesma configuração de e-mail.

## Páginas

| Arquivo | Conteúdo |
|---|---|
| `index.html` | Página principal; modal de solicitação de cronograma |
| `projeto.html` | O projeto |
| `embaixadoras.html` | Programa de embaixadoras |
| `contato.html` | Fale conosco |
| `distribuidor.html` | Cadastro de distribuidor (formulário em etapas) |
| `mapas.html` / `mapasMobile.html` | Mapa de cobertura (computador / celular) |
| `termos.html` | Termos de uso |

## Estrutura

```
├── *.html                 páginas
├── css/                   variables, base, layout, components, language-system, responsive
├── js/                    scripts (inclui busca de municípios no IBGE)
├── img/, videos/          imagens e pôsteres
├── worker/index.js        Worker: entrega as páginas (binding ASSETS) e atende /api/*
├── scripts/build-static.mjs   copia páginas, css, img, js e videos para dist/
├── tests/                 teste do Worker (node:test) e testes de tela (Playwright)
└── wrangler.jsonc         configuração do Worker gob-main
```

## Formulários (Worker + Resend)

O Worker atende só `/api/*` (`run_worker_first`); o resto vem dos arquivos estáticos em `dist/`. Cada envio é validado (tamanho, campos, UF, telefone, CNPJ) e enviado por e-mail pelo [Resend](https://resend.com), com o domínio `basta.app.br` verificado.

| Método | Rota | Origem |
|---|---|---|
| `POST` | `/api/contact` | `contato.html` — Fale conosco |
| `POST` | `/api/schedule` | `index.html` — solicitação de cronograma |
| `POST` | `/api/distributor` | `distribuidor.html` — cadastro de distribuidor |

| Variável | Onde fica | Valor |
|---|---|---|
| `RESEND_FROM_EMAIL` | `wrangler.jsonc` (`vars`) | `Instituto BASTA <contato@basta.app.br>` |
| `RESEND_TO_EMAIL` | `wrangler.jsonc` (`vars`) | caixa que recebe os contatos |
| `RESEND_API_KEY` | segredo do Worker | nunca em arquivo; cadastrar com o comando abaixo |

## Rodar e publicar

```bash
npm install
npm run dev              # wrangler dev (para testar formulários, crie .dev.vars a partir de .dev.vars.example)
npm test                 # testes do Worker
npm run test:e2e         # testes de tela (Playwright)
npm run deploy:dry-run   # confere o pacote sem publicar
npm run deploy           # build + publica o Worker gob-main
```

Segredo do Resend (uma vez, ou ao trocar a chave):

```bash
npx wrangler secret put RESEND_API_KEY
```

## Legado

`zap-backend/` (API Express + Z-API para WhatsApp) e `render.yaml` (Blueprint do Render) são da versão anterior. O site atual não chama esse backend: os formulários vão pelo Worker. Podem ser removidos quando não forem mais necessários como referência.

## Licença

Projeto proprietário — **BASTA! Educação**. Todos os direitos reservados.
