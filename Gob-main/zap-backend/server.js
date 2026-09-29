// ============================================================
// server.js — Backend de envio de leads via Z-API (WhatsApp)
// Projeto: BASTA! Landing Page
// Deploy: Render Web Service
// ============================================================

require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const axios    = require('axios');
const rateLimit = require('express-rate-limit');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Validação de variáveis obrigatórias ───────────────────
const REQUIRED_ENV = ['ZAPI_INSTANCE_ID', 'ZAPI_INSTANCE_TOKEN', 'ZAP_PHONE'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`❌  Variável de ambiente ${key} não definida. Abortando.`);
    process.exit(1);
  }
}

const {
  ZAPI_INSTANCE_ID,
  ZAPI_INSTANCE_TOKEN,
  ZAPI_CLIENT_TOKEN,
  ZAP_PHONE,
  ALLOWED_ORIGINS = 'https://basta.app.br,https://bastasite.onrender.com'
} = process.env;

// ─── CORS ──────────────────────────────────────────────────
// Sempre inclui domínios de produção + origens do env var
const allowedOrigins = [...new Set([
  'https://basta.app.br',
  'https://bastasite.onrender.com',
  ...ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
])];

app.use(cors({
  origin(origin, cb) {
    // Permite requisições sem origin (curl, Postman, etc.)
    if (!origin) return cb(null, true);
    // Em dev, permite qualquer localhost (porta dinâmica do serve)
    if (origin && origin.match(/^https?:\/\/localhost(:\d+)?$/)) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Origem não permitida pelo CORS'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// ─── Body parser ───────────────────────────────────────────
app.use(express.json({ limit: '16kb' }));

// ─── Request logger (dev) ──────────────────────────────────
app.use((req, _res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url} — origin: ${req.headers.origin || 'N/A'}`);
  next();
});

// ─── Rate limit — máx. 10 envios por IP a cada 15 min ─────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { sucesso: false, erro: 'Muitas requisições. Tente novamente em 15 minutos.' }
});

// ─── Helpers ───────────────────────────────────────────────

/** Remove caracteres não-numéricos do telefone */
function limparTelefone(raw) {
  return String(raw).replace(/\D/g, '');
}

/** Sanitiza texto simples (remove HTML) */
function sanitizar(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim().slice(0, 2000);
}

/** Monta a URL de envio de texto da Z-API */
function zapiUrl() {
  return `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_INSTANCE_TOKEN}/send-text`;
}

/** Headers padrão para a Z-API */
function zapiHeaders() {
  const h = {
    'Content-Type': 'application/json; charset=utf-8',
    'Accept': 'application/json'
  };
  if (ZAPI_CLIENT_TOKEN) h['Client-Token'] = ZAPI_CLIENT_TOKEN;
  return h;
}

// ─── Rota raiz ─────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({ servico: 'Backend BASTA!', status: 'online', docs: '/api/health' });
});

// ─── Endpoint: health check ────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Endpoint: enviar lead (formulário de contato) ─────────
app.post('/api/enviar-lead', limiter, async (req, res) => {
  try {
    const { nome, cidade, telefone, instituicao, mensagem } = req.body;

    // Validação básica
    if (!nome || !telefone) {
      return res.status(400).json({ sucesso: false, erro: 'Nome e telefone são obrigatórios.' });
    }

    const telLimpo = limparTelefone(telefone);
    if (telLimpo.length < 10) {
      return res.status(400).json({ sucesso: false, erro: 'Telefone inválido.' });
    }

    const texto = [
      '📩 *[FALE CONOSCO] — Site BASTA!*',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      `👤 *Nome:* ${sanitizar(nome)}`,
      instituicao ? `🏫 *Instituição:* ${sanitizar(instituicao)}` : null,
      `🏙️ *Cidade:* ${sanitizar(cidade || 'Não informada')}`,
      `📱 *Telefone:* ${telLimpo}`,
      mensagem ? `\n💬 *Mensagem:*\n${sanitizar(mensagem)}` : null
    ].filter(Boolean).join('\n');

    await axios.post(zapiUrl(), {
      phone: ZAP_PHONE,
      message: texto
    }, { headers: zapiHeaders(), timeout: 15000 });

    return res.json({ sucesso: true, mensagem: 'Lead enviado com sucesso!' });

  } catch (err) {
    console.error('Erro ao enviar lead:', err.response?.data || err.message);
    return res.status(502).json({
      sucesso: false,
      erro: 'Não foi possível enviar a mensagem. Tente novamente mais tarde.'
    });
  }
});

// ─── Endpoint: enviar cronograma (modal cronograma) ────────
app.post('/api/enviar-cronograma', limiter, async (req, res) => {
  try {
    const { nome, cargo, whatsapp, instituicao, telefone, cidade, estado } = req.body;

    if (!nome || !whatsapp) {
      return res.status(400).json({ sucesso: false, erro: 'Nome e WhatsApp são obrigatórios.' });
    }

    const texto = [
      '📅 *[CONHEÇA O CRONOGRAMA] — Site BASTA!*',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      `👤 *Nome:* ${sanitizar(nome)}`,
      cargo ? `💼 *Cargo:* ${sanitizar(cargo)}` : null,
      `📱 *WhatsApp:* ${sanitizar(whatsapp)}`,
      instituicao ? `🏫 *Instituição:* ${sanitizar(instituicao)}` : null,
      telefone ? `📞 *Telefone Inst.:* ${sanitizar(telefone)}` : null,
      cidade ? `🏙️ *Cidade:* ${sanitizar(cidade)}` : null,
      estado ? `📍 *Estado:* ${sanitizar(estado)}` : null
    ].filter(Boolean).join('\n');

    await axios.post(zapiUrl(), {
      phone: ZAP_PHONE,
      message: texto
    }, { headers: zapiHeaders(), timeout: 15000 });

    return res.json({ sucesso: true, mensagem: 'Solicitação enviada com sucesso!' });

  } catch (err) {
    console.error('Erro ao enviar cronograma:', err.response?.data || err.message);
    return res.status(502).json({
      sucesso: false,
      erro: 'Não foi possível enviar. Tente novamente mais tarde.'
    });
  }
});

// ─── Endpoint: enviar distribuidor (formulário multi-step) ─
app.post('/api/enviar-distribuidor', limiter, async (req, res) => {
  try {
    const {
      tipo, nome, contato, cidade, uf, empresa, cnpj,
      hist1, cliente1, ano1, hist2, cliente2, ano2,
      hist3, cliente3, ano3, hist4, cliente4, ano4,
      hist5, cliente5, ano5,
      foco, cid1, uf_cid1, cid2, uf_cid2, cid3, uf_cid3,
      cid4, uf_cid4, cid5, uf_cid5, mensagem
    } = req.body;

    if (!nome || !contato) {
      return res.status(400).json({ sucesso: false, erro: 'Nome e contato são obrigatórios.' });
    }

    // Tipos selecionados (pode ser string ou array)
    const tipos = Array.isArray(tipo) ? tipo.join(', ') : (tipo || 'Não informado');

    // Histórico de vendas
    const historico = [
      [hist1, cliente1, ano1], [hist2, cliente2, ano2],
      [hist3, cliente3, ano3], [hist4, cliente4, ano4],
      [hist5, cliente5, ano5]
    ].filter(([h, c, a]) => h || c || a)
     .map(([h, c, a], i) => `   ${i+1}. ${sanitizar(h||'-')} | Cliente: ${sanitizar(c||'-')} | Ano: ${sanitizar(a||'-')}`)
     .join('\n');

    // Cidades de atuação
    const cidades = [
      [cid1, uf_cid1], [cid2, uf_cid2], [cid3, uf_cid3],
      [cid4, uf_cid4], [cid5, uf_cid5]
    ].filter(([c, u]) => c || u)
     .map(([c, u]) => `   • ${sanitizar(c||'-')}/${sanitizar(u||'-')}`)
     .join('\n');

    const texto = [
      '🤝 *[SEJA UM DISTRIBUIDOR] — Site BASTA!*',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      `📋 *Tipo:* ${sanitizar(tipos)}`,
      `👤 *Nome:* ${sanitizar(nome)}`,
      `📱 *Contato:* ${sanitizar(contato)}`,
      cidade ? `🏙️ *Cidade:* ${sanitizar(cidade)}${uf ? '/' + sanitizar(uf) : ''}` : null,
      empresa ? `🏢 *Empresa:* ${sanitizar(empresa)}` : null,
      cnpj ? `📄 *CNPJ:* ${sanitizar(cnpj)}` : null,
      '',
      historico ? `📊 *Histórico de Vendas:*\n${historico}` : null,
      '',
      foco ? `🎯 *Foco:* ${sanitizar(foco)}` : null,
      cidades ? `📍 *Cidades de Atuação:*\n${cidades}` : null,
      mensagem ? `\n💬 *Mensagem:*\n${sanitizar(mensagem)}` : null
    ].filter(Boolean).join('\n');

    await axios.post(zapiUrl(), {
      phone: ZAP_PHONE,
      message: texto
    }, { headers: zapiHeaders(), timeout: 15000 });

    return res.json({ sucesso: true, mensagem: 'Cadastro de distribuidor enviado com sucesso!' });

  } catch (err) {
    console.error('Erro ao enviar distribuidor:', err.response?.data || err.message);
    return res.status(502).json({
      sucesso: false,
      erro: 'Não foi possível enviar. Tente novamente mais tarde.'
    });
  }
});

// ─── 404 catch-all ─────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada.' });
});

// ─── Error handler global ──────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Erro não tratado:', err.message);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

// ─── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  Backend BASTA! rodando na porta ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
});
