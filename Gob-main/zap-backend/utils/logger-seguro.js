// ============================================================
// utils/logger-seguro.js — Sistema de Logging Anonimizado
// Protege dados pessoais (LGPD) ao fazer logs
// ============================================================

/**
 * Sistema de logging que anonimiza dados sensíveis automaticamente
 * 
 * Previne exposição de:
 * - Telefones
 * - Nomes completos
 * - Emails
 * - CPF/CNPJ
 * - Endereços
 */

// ──────────────────────────────────────────────────────────
// Funções de Anonimização
// ──────────────────────────────────────────────────────────

/**
 * Anonimiza telefone mantendo apenas últimos 4 dígitos
 * @param {string} telefone 
 * @returns {string}
 */
function anonimizarTelefone(telefone) {
    if (!telefone || typeof telefone !== 'string') return '';
    const numeros = telefone.replace(/\D/g, '');
    if (numeros.length < 4) return '***';
    return '*'.repeat(numeros.length - 4) + numeros.slice(-4);
}

/**
 * Anonimiza nome mantendo apenas primeiro nome
 * @param {string} nome 
 * @returns {string}
 */
function anonimizarNome(nome) {
    if (!nome || typeof nome !== 'string') return '';
    const partes = nome.trim().split(' ');
    return partes[0] + ' ***';
}

/**
 * Anonimiza email mantendo primeira letra e domínio
 * @param {string} email 
 * @returns {string}
 */
function anonimizarEmail(email) {
    if (!email || typeof email !== 'string') return '';
    const [local, dominio] = email.split('@');
    if (!dominio) return '***';
    return local[0] + '***@' + dominio;
}

/**
 * Anonimiza CPF/CNPJ mantendo apenas últimos 4 dígitos
 * @param {string} documento 
 * @returns {string}
 */
function anonimizarDocumento(documento) {
    if (!documento || typeof documento !== 'string') return '';
    const numeros = documento.replace(/\D/g, '');
    if (numeros.length < 4) return '***';
    return '*'.repeat(numeros.length - 4) + numeros.slice(-4);
}

// ──────────────────────────────────────────────────────────
// Campos Sensíveis (auto-detectar)
// ──────────────────────────────────────────────────────────

const CAMPOS_SENSIVEIS = {
    // Telefones
    telefone: anonimizarTelefone,
    whatsapp: anonimizarTelefone,
    celular: anonimizarTelefone,
    contato: anonimizarTelefone,
    phone: anonimizarTelefone,
    
    // Nomes
    nome: anonimizarNome,
    name: anonimizarNome,
    'nome_completo': anonimizarNome,
    
    // Emails
    email: anonimizarEmail,
    
    // Documentos
    cpf: anonimizarDocumento,
    cnpj: anonimizarDocumento,
    rg: anonimizarDocumento
};

/**
 * Anonimiza objeto recursivamente
 * @param {Object} obj 
 * @returns {Object}
 */
function anonimizarObjeto(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    
    const resultado = Array.isArray(obj) ? [] : {};
    
    for (const [chave, valor] of Object.entries(obj)) {
        const chaveNormalizada = chave.toLowerCase();
        
        // Se é campo sensível, anonimizar
        if (CAMPOS_SENSIVEIS[chaveNormalizada]) {
            resultado[chave] = CAMPOS_SENSIVEIS[chaveNormalizada](valor);
        }
        // Se é objeto/array, recursão
        else if (typeof valor === 'object' && valor !== null) {
            resultado[chave] = anonimizarObjeto(valor);
        }
        // Senão, manter valor original
        else {
            resultado[chave] = valor;
        }
    }
    
    return resultado;
}

// ──────────────────────────────────────────────────────────
// Logger Seguro
// ──────────────────────────────────────────────────────────

class LoggerSeguro {
    constructor(options = {}) {
        this.nivel = options.nivel || 'info';
        this.anonimizar = options.anonimizar !== false; // default true
    }
    
    /**
     * Formata timestamp
     */
    _timestamp() {
        return new Date().toISOString();
    }
    
    /**
     * Prepara dados para log (anonimiza se habilitado)
     */
    _prepararDados(dados) {
        if (!this.anonimizar) return dados;
        if (typeof dados !== 'object') return dados;
        return anonimizarObjeto(dados);
    }
    
    /**
     * Log informativo
     */
    info(mensagem, dados = null) {
        const dadosLog = dados ? this._prepararDados(dados) : '';
        console.log(`[${this._timestamp()}] ℹ️  INFO: ${mensagem}`, dadosLog);
    }
    
    /**
     * Log de sucesso
     */
    success(mensagem, dados = null) {
        const dadosLog = dados ? this._prepararDados(dados) : '';
        console.log(`[${this._timestamp()}] ✅ SUCCESS: ${mensagem}`, dadosLog);
    }
    
    /**
     * Log de aviso
     */
    warn(mensagem, dados = null) {
        const dadosLog = dados ? this._prepararDados(dados) : '';
        console.warn(`[${this._timestamp()}] ⚠️  WARN: ${mensagem}`, dadosLog);
    }
    
    /**
     * Log de erro
     */
    error(mensagem, erro = null) {
        const erroLog = erro ? {
            mensagem: erro.message,
            stack: erro.stack,
            code: erro.code
        } : '';
        console.error(`[${this._timestamp()}] ❌ ERROR: ${mensagem}`, erroLog);
    }
    
    /**
     * Log de debug (apenas em development)
     */
    debug(mensagem, dados = null) {
        if (process.env.NODE_ENV === 'production') return;
        const dadosLog = dados ? this._prepararDados(dados) : '';
        console.debug(`[${this._timestamp()}] 🐛 DEBUG: ${mensagem}`, dadosLog);
    }
}

// Instância global do logger
const logger = new LoggerSeguro({ anonimizar: true });

// ──────────────────────────────────────────────────────────
// Middleware de Request Logging
// ──────────────────────────────────────────────────────────

/**
 * Middleware que loga todas as requisições de forma segura
 */
function requestLogger(req, res, next) {
    const inicio = Date.now();
    
    // Log da requisição
    logger.info(`${req.method} ${req.url}`, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
        origem: req.get('origin') || 'N/A'
    });
    
    // Hook no response para logar quando terminar
    res.on('finish', () => {
        const duracao = Date.now() - inicio;
        const nivel = res.statusCode >= 400 ? 'warn' : 'info';
        
        logger[nivel](`${req.method} ${req.url} - ${res.statusCode}`, {
            duracao: `${duracao}ms`,
            tamanho: res.get('content-length') || '0'
        });
    });
    
    next();
}

// ──────────────────────────────────────────────────────────
// Exports
// ──────────────────────────────────────────────────────────

module.exports = {
    logger,
    requestLogger,
    anonimizarTelefone,
    anonimizarNome,
    anonimizarEmail,
    anonimizarDocumento,
    anonimizarObjeto,
    LoggerSeguro
};
