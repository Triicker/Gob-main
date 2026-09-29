// ========== SISTEMA DE TRADUÇÃO UNIVERSAL ==========
// Sistema compartilhado para todas as páginas do site BASTA!

(function() {
    'use strict';
    
    // Constantes
    const STORAGE_KEY = 'basta-lang';
    const DEFAULT_LANG = 'pt';
    const SUPPORTED_LANGS = ['pt', 'en', 'es', 'fr'];
    
    // Estado global
    let currentLang = localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;
    
    // ========== FUNÇÕES PRINCIPAIS ==========
    
    /**
     * Aplica as traduções em todos os elementos com data-i18n
     */
    function applyTranslations(lang) {
        if (!translations[lang]) {
            console.warn(`Language '${lang}' not found, using default`);
            lang = DEFAULT_LANG;
        }
        
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (translations[lang] && translations[lang][key]) {
                // Traduzir conteúdo de texto
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    el.placeholder = translations[lang][key];
                } else if (el.tagName === 'BUTTON' && el.type === 'submit') {
                    el.textContent = translations[lang][key];
                } else {
                    el.textContent = translations[lang][key];
                }
            }
        });

        // Suporte a HTML rico (negrito, links, formatação inline)
        const htmlElements = document.querySelectorAll('[data-i18n-html]');
        htmlElements.forEach(el => {
            const key = el.getAttribute('data-i18n-html');
            if (translations[lang] && translations[lang][key]) {
                el.innerHTML = translations[lang][key];
            }
        });
        
        // Atualizar atributo lang do HTML
        document.documentElement.lang = lang === 'pt' ? 'pt-BR' : lang;
        currentLang = lang;
    }
    
    /**
     * Atualiza o estado visual dos botões de idioma
     */
    function updateLanguageButtons(selectedLang) {
        const langBtns = document.querySelectorAll('.lang-btn');
        langBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === selectedLang);
        });
    }
    
    /**
     * Animação suave ao trocar idioma
     */
    function fadeTransition(callback) {
        document.body.style.opacity = '0.7';
        setTimeout(() => {
            callback();
            document.body.style.opacity = '1';
        }, 150);
    }
    
    /**
     * Muda o idioma da aplicação
     */
    function changeLanguage(newLang) {
        if (!SUPPORTED_LANGS.includes(newLang)) {
            console.error(`Unsupported language: ${newLang}`);
            return;
        }
        
        fadeTransition(() => {
            localStorage.setItem(STORAGE_KEY, newLang);
            applyTranslations(newLang);
            updateLanguageButtons(newLang);
        });
    }
    
    /**
     * Inicializa o sistema de tradução
     */
    function initializeLanguageSystem() {
        // Verificar se translations está disponível
        if (typeof translations === 'undefined') {
            console.error('translations.js not loaded! Language system cannot start.');
            return;
        }
        
        // Aplicar idioma salvo
        const savedLang = localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;
        applyTranslations(savedLang);
        updateLanguageButtons(savedLang);
        
        // Configurar botões de idioma
        const langBtns = document.querySelectorAll('.lang-btn');
        langBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const newLang = btn.dataset.lang;
                if (newLang !== currentLang) {
                    changeLanguage(newLang);
                }
            });
        });
        
        console.log(`✓ Language system initialized (${savedLang})`);
    }
    
    // ========== AUTO-INICIALIZAÇÃO ==========
    
    // Aguardar DOM estar pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeLanguageSystem);
    } else {
        // DOM já está pronto
        initializeLanguageSystem();
    }
    
    // Expor API global (opcional, para uso programático)
    window.LanguageSystem = {
        changeLanguage,
        getCurrentLanguage: () => currentLang,
        getSupportedLanguages: () => [...SUPPORTED_LANGS],
        applyTranslations
    };
    
})();
