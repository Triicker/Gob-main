const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3333';
const citiesByState = {
  BA: ['Feira de Santana', 'Salvador'],
  SP: ['Campinas', 'São Paulo']
};

async function mockIbge(page) {
  await page.route('https://servicodados.ibge.gov.br/api/v1/localidades/estados/*/municipios?*', async route => {
    const match = route.request().url().match(/estados\/([A-Z]{2})\/municipios/);
    const cities = citiesByState[match?.[1]] || ['Cidade teste'];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(cities.map((nome, id) => ({ id, nome })))
    });
  });
}

test('contato valida campos, habilita cidade e envia para /api/contact', async ({ page }) => {
  await mockIbge(page);
  const requests = [];
  await page.route('**/api/contact', async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
  });
  await page.goto(`${BASE_URL}/contato.html`, { waitUntil: 'domcontentloaded' });

  const form = page.locator('#contatoForm');
  const state = form.locator('[name="estado"]');
  const city = form.locator('[name="cidade"]');
  await expect(city).toBeDisabled();
  await expect(state.locator('option')).toHaveCount(28);

  await state.selectOption('BA');
  await expect(city).toBeEnabled();
  await expect(city.locator('option')).toHaveCount(3);

  await form.locator('[name="nome"]').fill('Ana Souza');
  await form.locator('[name="email"]').fill('email-invalido');
  await form.locator('[name="telefone"]').fill('71999999999');
  await city.selectOption('Salvador');
  await form.locator('[name="mensagem"]').fill('Tenho interesse.');
  await form.locator('button[type="submit"]').click();
  expect(requests).toHaveLength(0);

  await form.locator('[name="email"]').fill('ana@example.com');
  await form.locator('button[type="submit"]').click();
  await expect(form.locator('button[type="submit"]')).toContainText('Mensagem enviada com sucesso!');
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ estado: 'BA', cidade: 'Salvador' });
  expect(requests[0].telefone.replace(/\D/g, '')).toBe('71999999999');
});

test('cronograma usa /api/schedule, valida obrigatórios e bloqueia honeypot', async ({ page }) => {
  await mockIbge(page);
  const scheduleRequests = [];
  await page.route('**/api/schedule', async route => {
    scheduleRequests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
  });
  await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'domcontentloaded' });
  const obsoleteRenderHost = ['bastasite', 'onrender', 'com'].join('.');
  expect(await page.locator('html').evaluate(element => element.outerHTML)).not.toContain(obsoleteRenderHost);
  await page.evaluate(() => openCronogramaModal());

  const form = page.locator('#cronogramaForm');
  const city = form.locator('[name="cidade"]');
  await expect(city).toBeDisabled();
  await form.locator('button[type="submit"]').click();
  expect(scheduleRequests).toHaveLength(0);

  await form.locator('[name="nome"]').fill('Maria d\'Ávila');
  await form.locator('[name="whatsapp"]').fill('71999999999');
  await form.locator('[name="instituicao"]').fill('Escola & Comunidade');
  await form.locator('[name="estado"]').selectOption('BA');
  await expect(city).toBeEnabled();
  await city.selectOption('Salvador');

  await form.locator('[name="homepage"]').evaluate(input => { input.value = 'spam.example'; });
  await form.locator('button[type="submit"]').click();
  expect(scheduleRequests).toHaveLength(0);

  await form.locator('[name="homepage"]').evaluate(input => { input.value = ''; });
  await form.locator('button[type="submit"]').click();
  await expect(page.locator('#cron-state-success')).toHaveClass(/active/);
  await expect(page.locator('#cron-state-success')).toContainText('Solicitação enviada com sucesso!');
  await expect(page.locator('#cron-state-success')).toContainText('Nossa equipe entrará em contato em breve.');
  expect(scheduleRequests).toHaveLength(1);
  expect(scheduleRequests[0]).toMatchObject({ estado: 'BA', cidade: 'Salvador' });
});

test('distribuidor mantém wizard, pares independentes e valida CNPJ, ano e foco', async ({ page }) => {
  await mockIbge(page);
  const distributorRequests = [];
  await page.route('**/api/distributor', async route => {
    distributorRequests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
  });
  await page.goto(`${BASE_URL}/distribuidor.html`, { waitUntil: 'domcontentloaded' });

  const form = page.locator('#distributorForm');
  await form.locator('[name="tipo"][value="Distribuidor"]').check();
  await page.evaluate(() => showStep(2));
  await expect(form.locator('[name="cidade"]')).toBeDisabled();
  await form.locator('[name="nome"]').fill('Ana Souza');
  await form.locator('[name="contato"]').fill('71999999999');
  await form.locator('[name="uf"]').selectOption('BA');
  await expect(form.locator('[name="cidade"]')).toBeEnabled();
  await form.locator('[name="cidade"]').selectOption('Salvador');
  await form.locator('[name="cnpj"]').fill('12345678000190');
  await page.evaluate(() => nextStep());
  await expect(page.locator('#step-2')).toHaveClass(/active/);
  await expect(form.locator('[name="cnpj"]')).toHaveAttribute('aria-invalid', 'true');

  await form.locator('[name="cnpj"]').fill('04252011000110');
  await page.evaluate(() => nextStep());
  await expect(page.locator('#step-3')).toHaveClass(/active/);
  await form.locator('[name="ano1"]').fill('1899');
  await page.evaluate(() => nextStep());
  await expect(page.locator('#step-3')).toHaveClass(/active/);
  await form.locator('[name="ano1"]').fill('2024');
  await page.evaluate(() => nextStep());

  await expect(page.locator('#step-4')).toHaveClass(/active/);
  await form.locator('[name="uf_cid1"]').selectOption('BA');
  await form.locator('[name="uf_cid2"]').selectOption('SP');
  await expect(form.locator('[name="cid1"]')).toBeEnabled();
  await expect(form.locator('[name="cid2"]')).toBeEnabled();
  await form.locator('[name="cid1"]').selectOption('Salvador');
  await form.locator('[name="cid2"]').selectOption('Campinas');
  await form.locator('[name="uf_cid2"]').selectOption('BA');
  await expect(form.locator('[name="cid1"]')).toHaveValue('Salvador');
  await expect(form.locator('[name="cid2"]')).toHaveValue('');

  await page.evaluate(() => nextStep());
  await expect(page.locator('#step-4')).toHaveClass(/active/);
  await form.locator('[name="foco"][value="Rede pública"]').check();
  await form.locator('[name="cid2"]').selectOption('Salvador');
  await page.evaluate(() => nextStep());
  await expect(page.locator('#step-5')).toHaveClass(/active/);

  await form.locator('button[type="submit"]').click();
  await expect(page.locator('#successWrap')).toHaveClass(/show/);
  expect(distributorRequests).toHaveLength(1);
  expect(distributorRequests[0]).toMatchObject({
    cnpj: '04.252.011/0001-10',
    ano1: '2024',
    uf_cid1: 'BA',
    cid1: 'Salvador',
    uf_cid2: 'BA',
    cid2: 'Salvador',
    foco: 'Rede pública'
  });
});
