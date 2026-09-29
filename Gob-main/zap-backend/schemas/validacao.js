// ============================================================
// schemas/validacao.js — Validação de Dados com Zod
// Garante que apenas dados válidos sejam processados
// ============================================================

/**
 * Schemas de validação para todos os formulários
 * 
 * Instalar: npm install zod
 * 
 * Uso:
 * const resultado = leadSchema.safeParse(req.body);
 * if (!resultado.success) {
 *     return res.status(400).json({ erro: resultado.error.errors });
 * }
 */

const { z } = require('zod');

// ──────────────────────────────────────────────────────────
// Validadores customizados
// ──────────────────────────────────────────────────────────

const telefoneRegex = /^\(\d{2}\)\s?\d{4,5}-\d{4}$/;
const cnpjRegex = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;

// ──────────────────────────────────────────────────────────
// Schema: Formulário de Contato (Fale Conosco)
// ──────────────────────────────────────────────────────────

const leadSchema = z.object({
    nome: z.string()
        .min(2, 'Nome deve ter no mínimo 2 caracteres')
        .max(100, 'Nome deve ter no máximo 100 caracteres')
        .trim()
        .transform(str => str.replace(/\s+/g, ' ')), // Remove espaços múltiplos
    
    telefone: z.string()
        .regex(telefoneRegex, 'Telefone inválido. Use (XX) XXXXX-XXXX')
        .transform(str => str.replace(/\D/g, '')), // Remove formatação
    
    email: z.string()
        .email('Email inválido')
        .optional()
        .or(z.literal('')),
    
    cidade: z.string()
        .max(100, 'Cidade deve ter no máximo 100 caracteres')
        .optional()
        .or(z.literal('')),
    
    instituicao: z.string()
        .max(200, 'Instituição deve ter no máximo 200 caracteres')
        .optional()
        .or(z.literal('')),
    
    mensagem: z.string()
        .max(2000, 'Mensagem deve ter no máximo 2000 caracteres')
        .optional()
        .or(z.literal('')),
    
    // Honeypot field - deve estar vazio
    website: z.string().optional().refine(val => !val, {
        message: 'Campo honeypot preenchido'
    })
});

// ──────────────────────────────────────────────────────────
// Schema: Cronograma
// ──────────────────────────────────────────────────────────

const cronogramaSchema = z.object({
    nome: z.string()
        .min(2, 'Nome obrigatório')
        .max(100)
        .trim(),
    
    cargo: z.string()
        .max(100)
        .optional()
        .or(z.literal('')),
    
    whatsapp: z.string()
        .regex(telefoneRegex, 'WhatsApp inválido'),
    
    telefone: z.string()
        .regex(telefoneRegex, 'Telefone inválido')
        .optional()
        .or(z.literal('')),
    
    instituicao: z.string()
        .max(200)
        .optional()
        .or(z.literal('')),
    
    cidade: z.string()
        .max(100)
        .optional()
        .or(z.literal('')),
    
    estado: z.string()
        .length(2, 'Estado deve ter 2 caracteres (UF)')
        .toUpperCase()
        .optional()
        .or(z.literal('')),
    
    website: z.string().optional().refine(val => !val)
});

// ──────────────────────────────────────────────────────────
// Schema: Distribuidor
// ──────────────────────────────────────────────────────────

const distribuidorSchema = z.object({
    tipo: z.union([
        z.string(),
        z.array(z.string())
    ]).transform(val => 
        Array.isArray(val) ? val.join(', ') : val
    ),
    
    nome: z.string()
        .min(2, 'Nome obrigatório')
        .max(100)
        .trim(),
    
    contato: z.string()
        .regex(telefoneRegex, 'Contato inválido'),
    
    cidade: z.string().max(100).optional().or(z.literal('')),
    uf: z.string().length(2).toUpperCase().optional().or(z.literal('')),
    
    empresa: z.string().max(200).optional().or(z.literal('')),
    
    cnpj: z.string()
        .regex(cnpjRegex, 'CNPJ inválido')
        .optional()
        .or(z.literal('')),
    
    // Histórico de vendas (5 campos)
    hist1: z.string().max(200).optional().or(z.literal('')),
    cliente1: z.string().max(200).optional().or(z.literal('')),
    ano1: z.string().max(4).optional().or(z.literal('')),
    
    hist2: z.string().max(200).optional().or(z.literal('')),
    cliente2: z.string().max(200).optional().or(z.literal('')),
    ano2: z.string().max(4).optional().or(z.literal('')),
    
    hist3: z.string().max(200).optional().or(z.literal('')),
    cliente3: z.string().max(200).optional().or(z.literal('')),
    ano3: z.string().max(4).optional().or(z.literal('')),
    
    hist4: z.string().max(200).optional().or(z.literal('')),
    cliente4: z.string().max(200).optional().or(z.literal('')),
    ano4: z.string().max(4).optional().or(z.literal('')),
    
    hist5: z.string().max(200).optional().or(z.literal('')),
    cliente5: z.string().max(200).optional().or(z.literal('')),
    ano5: z.string().max(4).optional().or(z.literal('')),
    
    foco: z.string().max(500).optional().or(z.literal('')),
    
    // Cidades de atuação (5 campos)
    cid1: z.string().max(100).optional().or(z.literal('')),
    uf_cid1: z.string().length(2).toUpperCase().optional().or(z.literal('')),
    
    cid2: z.string().max(100).optional().or(z.literal('')),
    uf_cid2: z.string().length(2).toUpperCase().optional().or(z.literal('')),
    
    cid3: z.string().max(100).optional().or(z.literal('')),
    uf_cid3: z.string().length(2).toUpperCase().optional().or(z.literal('')),
    
    cid4: z.string().max(100).optional().or(z.literal('')),
    uf_cid4: z.string().length(2).toUpperCase().optional().or(z.literal('')),
    
    cid5: z.string().max(100).optional().or(z.literal('')),
    uf_cid5: z.string().length(2).toUpperCase().optional().or(z.literal('')),
    
    mensagem: z.string().max(2000).optional().or(z.literal('')),
    
    website: z.string().optional().refine(val => !val)
});

// ──────────────────────────────────────────────────────────
// Middleware de Validação
// ──────────────────────────────────────────────────────────

/**
 * Cria middleware de validação para uma rota
 * @param {z.ZodSchema} schema - Schema Zod para validar
 * @returns {Function} Express middleware
 */
function validar(schema) {
    return (req, res, next) => {
        const resultado = schema.safeParse(req.body);
        
        if (!resultado.success) {
            const erros = resultado.error.errors.map(err => ({
                campo: err.path.join('.'),
                mensagem: err.message
            }));
            
            console.warn('❌ Validação falhou:', erros);
            
            return res.status(400).json({
                sucesso: false,
                erro: 'Dados inválidos',
                detalhes: erros
            });
        }
        
        // Substitui req.body pelos dados validados e transformados
        req.body = resultado.data;
        next();
    };
}

// ──────────────────────────────────────────────────────────
// Exports
// ──────────────────────────────────────────────────────────

module.exports = {
    leadSchema,
    cronogramaSchema,
    distribuidorSchema,
    validar
};
