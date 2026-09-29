// ============================================================
// middleware/security.js — Headers de Segurança
// Proteção contra XSS, clickjacking, MIME sniffing, etc.
// ============================================================

/**
 * Configuração de segurança usando Helmet.js
 * 
 * Instalar: npm install helmet
 * 
 * Protege contra:
 * - XSS (Cross-Site Scripting)
 * - Clickjacking
 * - MIME Type Sniffing
 * - Sensitive headers exposure
 */

const helmet = require('helmet');

const securityMiddleware = helmet({
    // Content Security Policy - Define fontes confiáveis para recursos
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'", 
                "'unsafe-inline'", // Necessário para scripts inline (idealmente remover)
                "https://www.google.com",
                "https://www.gstatic.com",
                "https://cdnjs.cloudflare.com"
            ],
            styleSrc: [
                "'self'", 
                "'unsafe-inline'",
                "https://fonts.googleapis.com",
                "https://cdnjs.cloudflare.com"
            ],
            fontSrc: [
                "'self'",
                "https://fonts.gstatic.com",
                "https://cdnjs.cloudflare.com"
            ],
            imgSrc: [
                "'self'", 
                "data:", 
                "https:", 
                "http:"
            ],
            connectSrc: [
                "'self'",
                "https://bastasite.onrender.com",
                "https://api.z-api.io"
            ],
            frameSrc: ["'self'", "https://www.google.com"], // reCAPTCHA
            objectSrc: ["'none'"],
            upgradeInsecureRequests: []
        }
    },
    
    // HTTP Strict Transport Security - Force HTTPS
    hsts: {
        maxAge: 31536000, // 1 ano
        includeSubDomains: true,
        preload: true
    },
    
    // X-Frame-Options - Previne clickjacking
    frameguard: {
        action: 'deny'
    },
    
    // X-Content-Type-Options - Previne MIME sniffing
    noSniff: true,
    
    // X-XSS-Protection - Proteção XSS legada (browsers antigos)
    xssFilter: true,
    
    // Referrer-Policy - Controla informações de referrer
    referrerPolicy: {
        policy: 'strict-origin-when-cross-origin'
    },
    
    // Remove X-Powered-By header
    hidePoweredBy: true
});

// Middleware adicional para remover headers sensíveis
const removeServerHeader = (req, res, next) => {
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');
    next();
};

module.exports = {
    securityMiddleware,
    removeServerHeader
};
