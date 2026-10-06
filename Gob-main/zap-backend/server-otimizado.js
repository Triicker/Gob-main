// ============================================================
// server-otimizado.js — Backend SEGURO com melhorias
// Projeto: BASTA! Landing Page
// Deploy: Render Web Service
// ============================================================

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Importar novos middlewares e utils
const { securityMiddleware, removeServerHeader } = require('./middleware/security');
const honeypotProtection = require('./middleware/honeypot');
const { leadSchema, distribuidorSchema, validar } = require('./schemas/validacao');
const { logger, requestLogger } = require('./utils/logger-seguro');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Validação de variáveis obrigatórias ───────────────────
const REQUIRED_ENV = ['ZAPI_INSTANCE_ID', 'ZAPI_INSTANCE_TOKEN', 'ZAP_PHONE'];
for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
        logger.error(`Variável de ambiente ${key} não definida. Abortando.`);
        process.exit(1);
    }
}

const {
    ZAPI_INSTANCE_ID,
    ZAPI_INSTANCE_TOKEN,
    ZAPI_CLIENT_TOKEN,
    ZAP_PHONE,
    ALLOWED_ORIGINS = 'http://localhost:3000'
} = process.env;

// ─── Security Headers (Helmet.js) ──────────────────────────
app.use(securityMiddleware);
app.use(removeServerHeader);

// ─── Compressão de Respostas ───────────────────────────────
app.use(compression());

// ─── CORS ──────────────────────────────────────────────────
const allowedOrigins = ALLOWED_ORIGINS.split(',').map(o => o.trim());

app.use(cors({
    origin(origin, cb) {
        // Permite requisições sem origin (curl, Postman, etc.)
        if (!origin) return cb(null, true);
        // Em dev, permite qualquer localhost (porta dinâmica do serve)
        if (origin && origin.match(/^https?:\/\/localhost(:\d+)?$/)) return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        
        logger.warn('Origem bloqueada pelo CORS', { origin });
        cb(new Error('Origem não permitida pelo CORS'));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: true
}));

// ─── Body parser ───────────────────────────────────────────
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));

// ─── Request Logger (seguro, anonimizado) ──────────────────
app.use(requestLogger);

// ─── Rate limit — máx. 10 envios por IP a cada 15 min ─────
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { sucesso: false, erro: 'Muitas requisições. Tente novamente em 15 minutos.' },
    handler: (req, res) => {
        logger.warn('Rate limit atingido', { ip: req.ip });
        res.status(429).json({
            sucesso: false,
            erro: 'Muitas requisições. Tente novamente em 15 minutos.'
        });
    }
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
    res.json({
        servico: 'Backend BASTA! v2.0 (Secured)',
        status: 'online',
        docs: '/api/health',
        features: ['Rate Limiting', 'Honeypot Protection', 'Validation', 'Secure Logging']
    });
});

// ─── Endpoint: health check ────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '2.0.0'
    });
});

// ─── Endpoint: enviar lead (formulário de contato) ─────────
app.post('/api/enviar-lead',
    limiter,
    honeypotProtection,
    validar(leadSchema),
    async (req, res) => {
        try {
            const { nome, cidade, telefone, instituicao, mensagem } = req.body;

            const telLimpo = limparTelefone(telefone);

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

            logger.success('Lead enviado', { nome, cidade });
            return res.json({ sucesso: true, mensagem: 'Lead enviado com sucesso!' });

        } catch (err) {
            logger.error('Erro ao enviar lead', err);
            return res.status(502).json({
                sucesso: false,
                erro: 'Não foi possível enviar a mensagem. Tente novamente mais tarde.'
            });
        }
    });

// ─── Endpoint: enviar distribuidor (formulário multi-step) ─
app.post('/api/enviar-distribuidor',
    limiter,
    honeypotProtection,
    validar(distribuidorSchema),
    async (req, res) => {
        try {
            const {
                tipo, nome, contato, cidade, uf, empresa, cnpj,
                hist1, cliente1, ano1, hist2, cliente2, ano2,
                hist3, cliente3, ano3, hist4, cliente4, ano4,
                hist5, cliente5, ano5,
                foco, cid1, uf_cid1, cid2, uf_cid2, cid3, uf_cid3,
                cid4, uf_cid4, cid5, uf_cid5, mensagem
            } = req.body;

            // Histórico de vendas
            const historico = [
                [hist1, cliente1, ano1], [hist2, cliente2, ano2],
                [hist3, cliente3, ano3], [hist4, cliente4, ano4],
                [hist5, cliente5, ano5]
            ].filter(([h, c, a]) => h || c || a)
                .map(([h, c, a], i) => `   ${i + 1}. ${sanitizar(h || '-')} | Cliente: ${sanitizar(c || '-')} | Ano: ${sanitizar(a || '-')}`)
                .join('\n');

            // Cidades de atuação
            const cidades = [
                [cid1, uf_cid1], [cid2, uf_cid2], [cid3, uf_cid3],
                [cid4, uf_cid4], [cid5, uf_cid5]
            ].filter(([c, u]) => c || u)
                .map(([c, u]) => `   • ${sanitizar(c || '-')}/${sanitizar(u || '-')}`)
                .join('\n');

            const texto = [
                '🤝 *[SEJA UM DISTRIBUIDOR] — Site BASTA!*',
                '━━━━━━━━━━━━━━━━━━━━━━━━━━',
                '',
                `📋 *Tipo:* ${sanitizar(tipo)}`,
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

            logger.success('Distribuidor cadastrado', { nome, cidade });
            return res.json({ sucesso: true, mensagem: 'Cadastro enviado com sucesso!' });

        } catch (err) {
            logger.error('Erro ao enviar distribuidor', err);
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
    logger.error('Erro não tratado', err);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
});

// ─── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
    logger.success(`Backend BASTA! v2.0 rodando na porta ${PORT}`);
    logger.info(`Health check: http://localhost:${PORT}/api/health`);
});
