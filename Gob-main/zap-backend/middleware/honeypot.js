// ============================================================
// middleware/honeypot.js — Proteção Anti-Bot
// Técnica: Campo invisível que bots preenchem, humanos não
// ============================================================

/**
 * Middleware que detecta e bloqueia bots através de honeypot field
 * 
 * Como usar:
 * 1. Adicione campo invisível no HTML:
 *    <input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off">
 * 
 * 2. Aplique middleware nas rotas de formulário:
 *    app.post('/api/enviar-lead', honeypotProtection, ...)
 */

const honeypotProtection = (req, res, next) => {
    const honeypotFields = ['website', 'url', 'homepage', 'bot_field'];
    
    // Verifica se algum campo honeypot foi preenchido
    const isBotDetected = honeypotFields.some(field => {
        const value = req.body[field];
        return value && value.trim().length > 0;
    });
    
    if (isBotDetected) {
        console.warn(`🤖 Bot detectado via honeypot - IP: ${req.ip}`);
        
        // Retorna sucesso fake para não alertar o bot
        return res.json({ 
            sucesso: true, 
            mensagem: 'Enviado com sucesso!' 
        });
    }
    
    next();
};

module.exports = honeypotProtection;
