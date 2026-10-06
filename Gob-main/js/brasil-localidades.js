(function (global) {
    'use strict';

    const STATES = [
        { sigla: 'AC', nome: 'Acre' },
        { sigla: 'AL', nome: 'Alagoas' },
        { sigla: 'AP', nome: 'Amapá' },
        { sigla: 'AM', nome: 'Amazonas' },
        { sigla: 'BA', nome: 'Bahia' },
        { sigla: 'CE', nome: 'Ceará' },
        { sigla: 'DF', nome: 'Distrito Federal' },
        { sigla: 'ES', nome: 'Espírito Santo' },
        { sigla: 'GO', nome: 'Goiás' },
        { sigla: 'MA', nome: 'Maranhão' },
        { sigla: 'MT', nome: 'Mato Grosso' },
        { sigla: 'MS', nome: 'Mato Grosso do Sul' },
        { sigla: 'MG', nome: 'Minas Gerais' },
        { sigla: 'PA', nome: 'Pará' },
        { sigla: 'PB', nome: 'Paraíba' },
        { sigla: 'PR', nome: 'Paraná' },
        { sigla: 'PE', nome: 'Pernambuco' },
        { sigla: 'PI', nome: 'Piauí' },
        { sigla: 'RJ', nome: 'Rio de Janeiro' },
        { sigla: 'RN', nome: 'Rio Grande do Norte' },
        { sigla: 'RS', nome: 'Rio Grande do Sul' },
        { sigla: 'RO', nome: 'Rondônia' },
        { sigla: 'RR', nome: 'Roraima' },
        { sigla: 'SC', nome: 'Santa Catarina' },
        { sigla: 'SP', nome: 'São Paulo' },
        { sigla: 'SE', nome: 'Sergipe' },
        { sigla: 'TO', nome: 'Tocantins' }
    ].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    const cityMemoryCache = new Map();
    const CACHE_PREFIX = 'basta:municipios:v1:';

    function resolveElement(value) {
        return typeof value === 'string' ? document.querySelector(value) : value;
    }

    function replaceOptions(select, label, values) {
        select.replaceChildren();
        select.add(new Option(label, ''));
        values.forEach(({ value, label: optionLabel }) => {
            select.add(new Option(optionLabel, value));
        });
    }

    function readCachedCities(uf) {
        if (cityMemoryCache.has(uf)) return cityMemoryCache.get(uf);

        try {
            const stored = sessionStorage.getItem(CACHE_PREFIX + uf);
            if (!stored) return null;
            const cities = JSON.parse(stored);
            if (!Array.isArray(cities)) return null;
            cityMemoryCache.set(uf, cities);
            return cities;
        } catch {
            return null;
        }
    }

    function cacheCities(uf, cities) {
        cityMemoryCache.set(uf, cities);
        try {
            sessionStorage.setItem(CACHE_PREFIX + uf, JSON.stringify(cities));
        } catch {
            // O cache em memória continua funcionando quando o storage está indisponível.
        }
    }

    function getStatusElement(citySelect) {
        const statusId = citySelect.id ? `${citySelect.id}-status` : '';
        let status = statusId ? document.getElementById(statusId) : null;
        if (!status) {
            status = document.createElement('span');
            status.id = statusId || `city-status-${Math.random().toString(36).slice(2)}`;
            status.className = 'location-status';
            status.setAttribute('aria-live', 'polite');
            citySelect.insertAdjacentElement('afterend', status);
        }
        citySelect.setAttribute('aria-describedby', status.id);
        return status;
    }

    async function fetchCities(uf) {
        const cached = readCachedCities(uf);
        if (cached) return cached;

        const response = await fetch(
            `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(uf)}/municipios?orderBy=nome`,
            { headers: { Accept: 'application/json' } }
        );
        if (!response.ok) throw new Error(`IBGE respondeu com status ${response.status}`);

        const payload = await response.json();
        if (!Array.isArray(payload)) throw new Error('Resposta inválida do IBGE');

        const cities = payload
            .map(city => String(city && city.nome || '').trim())
            .filter(Boolean)
            .map(name => ({ value: name, label: name }));
        cacheCities(uf, cities);
        return cities;
    }

    function initStateCityPair({ state, city, stateRequired, cityRequired } = {}) {
        const stateSelect = resolveElement(state);
        const citySelect = resolveElement(city);
        if (!stateSelect || !citySelect) return null;

        const status = getStatusElement(citySelect);
        const initialState = stateSelect.value;
        const initialCity = citySelect.value;
        const mustRequireState = stateRequired ?? stateSelect.required;
        const mustRequireCity = cityRequired ?? citySelect.required;

        replaceOptions(
            stateSelect,
            'Selecione o estado',
            STATES.map(item => ({ value: item.sigla, label: `${item.nome} (${item.sigla})` }))
        );
        stateSelect.required = Boolean(mustRequireState);
        if (initialState && STATES.some(item => item.sigla === initialState)) {
            stateSelect.value = initialState;
        }

        function resetCity() {
            replaceOptions(citySelect, 'Selecione a cidade', []);
            citySelect.disabled = true;
            citySelect.required = Boolean(mustRequireCity);
            citySelect.removeAttribute('aria-busy');
            citySelect.removeAttribute('aria-invalid');
            citySelect.setCustomValidity('');
            status.textContent = '';
        }

        async function loadSelectedState(preferredCity = '') {
            const uf = stateSelect.value;
            resetCity();
            stateSelect.setCustomValidity('');
            stateSelect.removeAttribute('aria-invalid');
            if (!uf) return;

            citySelect.required = Boolean(mustRequireCity || uf);
            citySelect.setAttribute('aria-busy', 'true');
            replaceOptions(citySelect, 'Carregando cidades...', []);
            status.textContent = 'Carregando cidades...';

            try {
                const cities = await fetchCities(uf);
                if (stateSelect.value !== uf) return;
                replaceOptions(citySelect, 'Selecione a cidade', cities);
                citySelect.disabled = false;
                citySelect.removeAttribute('aria-busy');
                status.textContent = '';
                if (preferredCity && cities.some(item => item.value === preferredCity)) {
                    citySelect.value = preferredCity;
                }
            } catch (error) {
                if (stateSelect.value !== uf) return;
                replaceOptions(citySelect, 'Não foi possível carregar as cidades. Tente novamente.', []);
                citySelect.disabled = true;
                citySelect.removeAttribute('aria-busy');
                citySelect.setAttribute('aria-invalid', 'true');
                citySelect.setCustomValidity('Não foi possível carregar as cidades. Tente novamente.');
                stateSelect.setAttribute('aria-invalid', 'true');
                stateSelect.setCustomValidity('Não foi possível carregar as cidades. Tente novamente.');
                status.textContent = 'Não foi possível carregar as cidades. Tente novamente.';
                console.error('Erro ao carregar municípios do IBGE:', error);
            }
        }

        stateSelect.addEventListener('change', () => loadSelectedState());
        citySelect.addEventListener('change', () => {
            citySelect.setCustomValidity('');
            citySelect.toggleAttribute('aria-invalid', !citySelect.validity.valid);
        });

        const form = stateSelect.form || citySelect.form;
        if (form) {
            form.addEventListener('reset', () => {
                window.setTimeout(() => {
                    stateSelect.value = '';
                    resetCity();
                }, 0);
            });
        }

        if (stateSelect.value) loadSelectedState(initialCity);
        else resetCity();

        return { state: stateSelect, city: citySelect, loadCities: loadSelectedState };
    }

    function digitsOnly(value) {
        return String(value || '').replace(/\D/g, '');
    }

    function formatPhone(value) {
        const digits = digitsOnly(value).slice(0, 11);
        if (!digits) return '';
        if (digits.length <= 2) return `(${digits}`;

        const local = digits.slice(2);
        const firstPartLength = digits.length > 10 ? 5 : 4;
        const firstPart = local.slice(0, firstPartLength);
        const secondPart = local.slice(firstPartLength);
        return `(${digits.slice(0, 2)}) ${firstPart}${secondPart ? `-${secondPart}` : ''}`;
    }

    function isValidPhone(value) {
        return /^\d{10,11}$/.test(digitsOnly(value));
    }

    function formatCnpj(value) {
        const digits = digitsOnly(value).slice(0, 14);
        return digits
            .replace(/^(\d{2})(\d)/, '$1.$2')
            .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
            .replace(/\.(\d{3})(\d)/, '.$1/$2')
            .replace(/(\d{4})(\d)/, '$1-$2');
    }

    function isValidCnpj(value) {
        const digits = digitsOnly(value);
        if (!/^\d{14}$/.test(digits) || /^(\d)\1{13}$/.test(digits)) return false;

        function checkDigit(length) {
            let factor = length - 7;
            let sum = 0;
            for (let index = 0; index < length; index += 1) {
                sum += Number(digits[index]) * factor--;
                if (factor < 2) factor = 9;
            }
            const result = sum % 11;
            return result < 2 ? 0 : 11 - result;
        }

        return checkDigit(12) === Number(digits[12]) && checkDigit(13) === Number(digits[13]);
    }

    function bindPhoneMask(input) {
        const element = resolveElement(input);
        if (!element) return;
        element.addEventListener('input', () => {
            element.value = formatPhone(element.value);
            element.setCustomValidity('');
            element.removeAttribute('aria-invalid');
        });
    }

    function bindCnpjMask(input) {
        const element = resolveElement(input);
        if (!element) return;
        element.addEventListener('input', () => {
            element.value = formatCnpj(element.value);
            element.setCustomValidity('');
            element.removeAttribute('aria-invalid');
        });
    }

    function bindValidationState(form) {
        const element = resolveElement(form);
        if (!element) return;
        element.addEventListener('invalid', event => {
            event.target.setAttribute('aria-invalid', 'true');
        }, true);
        element.addEventListener('input', event => {
            if (event.target.matches('input, select, textarea')) {
                event.target.toggleAttribute('aria-invalid', !event.target.validity.valid);
            }
        });
        element.addEventListener('change', event => {
            if (event.target.matches('input, select, textarea')) {
                event.target.toggleAttribute('aria-invalid', !event.target.validity.valid);
            }
        });
    }

    global.BrasilLocalidades = Object.freeze({
        STATES,
        initStateCityPair,
        formatPhone,
        isValidPhone,
        formatCnpj,
        isValidCnpj,
        bindPhoneMask,
        bindCnpjMask,
        bindValidationState
    });
})(window);
