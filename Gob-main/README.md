# BASTA! — Escolas Unidas contra a Violência Doméstica

Landing page institucional do programa **BASTA!**, o maior ecossistema de educação, prevenção e formação contra violência doméstica do Brasil. O projeto atua em escolas com livros didáticos, aplicativo de segurança e formação especializada para profissionais da educação.

🔗 **Site:** [basta.app.br](https://basta.app.br)

---

## 📋 Visão Geral

| Recurso | Descrição |
|---------|-----------|
| **O Projeto** | Apresentação da coleção didática BASTA! para escolas |
| **O Aplicativo** | App de segurança com botão de pânico e rede de apoio |
| **Embaixadoras** | Programa de embaixadoras do movimento |
| **Distribuidor** | Formulário multi-step para novos distribuidores |
| **Contato** | Formulário de contato integrado ao WhatsApp |
| **Cronograma** | Modal para solicitação de cronograma de atividades |
| **Mapas** | Visualização geográfica de cobertura do programa |

---

## 🗂️ Estrutura do Projeto

```
├── index.html              # Página principal (landing page)
├── contato.html             # Página de contato (Fale Conosco)
├── distribuidor.html        # Formulário para distribuidores
├── embaixadoras.html        # Programa de embaixadoras
├── termos.html              # Termos de uso
├── mapas.html               # Mapas (desktop)
├── mapasMobile.html         # Mapas (mobile)
├── render.yaml              # Blueprint de deploy no Render
│
├── css/
│   ├── variables.css        # Variáveis CSS (cores, fontes, espaçamentos)
│   ├── base.css             # Reset, tipografia e estilos globais
│   ├── layout.css           # Grid, seções e estrutura de página
│   ├── components.css       # Cards, modais, botões, formulários
│   └── responsive.css       # Media queries e ajustes mobile/tablet
│
└── zap-backend/
    ├── server.js            # API Express (proxy Z-API WhatsApp)
    ├── package.json         # Dependências do backend
    ├── .env.example         # Modelo de variáveis de ambiente
    └── .gitignore           # Ignora node_modules e .env
```

---

## 🚀 Frontend

Site estático em HTML, CSS e JavaScript vanilla. Todas as imagens são servidas localmente na pasta `img/`.

### CSS Modular

Os estilos estão organizados em 5 arquivos para manutenibilidade:

- **variables.css** — Design tokens (cores, fontes, sombras)
- **base.css** — Reset CSS, tipografia global, animações base
- **layout.css** — Estrutura de seções (hero, projeto, aplicativo, etc.)
- **components.css** — Componentes reutilizáveis (cards, modais, formulários, botão WhatsApp)
- **responsive.css** — Breakpoints para mobile (≤768px) e tablet (≤1024px)

### Funcionalidades do Frontend

- Design responsivo (mobile-first)
- Cards com animação de flip (clique no mobile, hover no desktop)
- Botão flutuante de WhatsApp com animação de pulso
- Modais de cronograma e feedback
- Formulário multi-step para distribuidores (5 etapas)
- Lazy loading de imagens
- Integração com backend via `fetch` API

---

## ⚙️ Backend (Z-API WhatsApp)

API em **Node.js + Express** que recebe dados dos formulários e envia mensagens formatadas para o WhatsApp via [Z-API](https://z-api.io).

### Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/enviar-lead` | Formulário "Fale Conosco" |
| `POST` | `/api/enviar-cronograma` | Solicitação de cronograma |
| `POST` | `/api/enviar-feedback` | Opinião / feedback |
| `POST` | `/api/enviar-distribuidor` | Cadastro de distribuidor |

Cada formulário envia uma mensagem com **header identificador** no WhatsApp:

```
📩 [FALE CONOSCO] — Site BASTA!
📅 [CONHEÇA O CRONOGRAMA] — Site BASTA!
💬 [DEIXE SUA OPINIÃO] — Site BASTA!
🤝 [SEJA UM DISTRIBUIDOR] — Site BASTA!
```

### Dependências

- `express` — Servidor HTTP
- `axios` — Requisições à Z-API
- `cors` — Controle de origens
- `dotenv` — Variáveis de ambiente
- `express-rate-limit` — Limite de 10 envios/15min por IP

### Rodando localmente

```bash
cd zap-backend
cp .env.example .env
# Preencha as variáveis no .env
npm install
npm start
```

### Variáveis de Ambiente

| Variável | Descrição |
|----------|-----------|
| `ZAPI_INSTANCE_ID` | ID da instância Z-API |
| `ZAPI_INSTANCE_TOKEN` | Token da instância Z-API |
| `ZAPI_CLIENT_TOKEN` | Token de cliente Z-API |
| `ZAP_PHONE` | Número do WhatsApp destino (ex: `5571999999999`) |
| `PORT` | Porta do servidor (padrão: `3001`) |
| `ALLOWED_ORIGINS` | Origens permitidas pelo CORS (separadas por vírgula) |

---

## 🌐 Deploy (Render)

O backend está configurado para deploy no [Render](https://render.com) via `render.yaml`:

1. Conecte o repositório GitHub ao Render
2. Use **Blueprint** ou crie um **Web Service** manualmente:
   - **Root Directory:** `zap-backend`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
3. Configure as **Environment Variables** no dashboard do Render (mesmas da tabela acima)
4. Atualize `ALLOWED_ORIGINS` com o domínio do frontend em produção

O frontend pode ser hospedado como **Static Site** no Render ou em qualquer hosting estático.

---

## 📄 Licença

Projeto proprietário — **BASTA! Educação**. Todos os direitos reservados.
