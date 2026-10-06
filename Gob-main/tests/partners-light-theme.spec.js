const { test, expect } = require('@playwright/test');

const URL = 'http://localhost:3333/index.html#parceiros';

test.describe('Parceiros e clientes com preferência escura do sistema', () => {
  test.use({ colorScheme: 'dark' });

  test('preserva as cores claras e os logos sem filtros', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });

    const wrapper = page.locator('.partners-clientes-wrapper');
    const whitePartnerFace = page.locator('.partner-card:nth-child(1) .partner-card-front');
    const brandedPartnerFace = page.locator('.partner-card:nth-child(3) .partner-card-front');
    const whiteClientFace = page.locator('.cliente-card:not([class*="bg-"]) .cliente-card-front').first();
    const brandedClientFace = page.locator('.cliente-card.bg-laranja .cliente-card-front');
    const logo = whitePartnerFace.locator('img');

    await expect(wrapper).toBeVisible();
    await expect(wrapper).toHaveCSS('color-scheme', 'light only');
    await expect(wrapper).toHaveCSS('background-color', 'rgb(139, 58, 158)');
    await expect(whitePartnerFace).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(whiteClientFace).toHaveCSS('background-color', 'rgb(255, 255, 255)');

    // Cores intencionais da identidade visual não devem ser substituídas por branco.
    await expect(brandedPartnerFace).toHaveCSS('background-color', 'rgb(0, 0, 0)');
    await expect(brandedClientFace).toHaveCSS('background-color', 'rgb(255, 162, 13)');

    await expect(logo).toHaveCSS('filter', 'none');
    await expect(logo).toHaveCSS('opacity', '1');
    await expect(logo).toHaveCSS('mix-blend-mode', 'normal');

    // A proteção fica restrita à vitrine, sem mudar o esquema do documento inteiro.
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'normal');
  });
});
