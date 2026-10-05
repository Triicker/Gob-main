const { test, expect } = require('@playwright/test');

const URL = 'http://localhost:3333/index.html';
const VIEWPORTS = [360, 375, 390, 412, 430, 768, 820, 1024, 1280, 1366, 1440, 1920];

test('hero e seção O projeto preservam composição e responsividade', async ({ page }) => {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });

  const project = page.locator('#projeto');
  const features = project.locator('.project-features');
  const featureImages = features.locator('img');

  await expect(project.locator('.project-title img')).toHaveAttribute('src', 'img/O projeto.png');
  await expect(project.locator('.project-title-line')).toHaveAttribute('src', 'img/Linha 10.png');
  await expect(project.locator('.project-logo')).toHaveAttribute('src', 'img/BASTA-logo2.png');
  await expect(project.locator('.project-text-box')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(project.locator('.project-text-box')).toHaveCSS('border-left-width', '0px');
  await expect(project.locator('.project-text-box p').first()).toHaveCSS('color', 'rgb(255, 247, 251)');
  await expect(project.locator('.project-text-box p')).toHaveCount(3);
  await expect(project.locator('.project-text-box strong')).toHaveCount(4);
  await expect(project.locator('.project-text-box p').first()).toContainText('É preciso atuar antes');
  await expect(project.locator('img[src="img/phone_with_book-1.png"]')).toHaveCount(0);
  await expect(featureImages).toHaveCount(10);

  const expectedFeatures = Array.from({ length: 10 }, (_, index) => `img/Grupo ${index + 160}.png`);
  expect(await featureImages.evaluateAll(images => images.map(image => image.getAttribute('src'))))
    .toEqual(expectedFeatures);

  for (const width of VIEWPORTS) {
    const height = width <= 430 ? 844 : 1000;
    await page.setViewportSize({ width, height });

    await expect(project).toHaveCSS('color-scheme', 'light only');
    await expect(project).toHaveCSS('background-color', 'rgb(67, 0, 82)');

    const state = await page.evaluate(() => {
      const projectSection = document.querySelector('#projeto');
      const grid = document.querySelector('.project-grid');
      const heading = document.querySelector('.project-heading');
      const copy = document.querySelector('.project-text-box');
      const logo = document.querySelector('.project-logo-wrap');
      const featureGrid = document.querySelector('.project-features');
      const heroBackground = document.querySelector('.hero-bg');
      const heroCallout = document.querySelector('.hero-left');
      const rect = element => element.getBoundingClientRect();

      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        projectBackground: getComputedStyle(projectSection).backgroundImage,
        featureColumns: getComputedStyle(featureGrid).gridTemplateColumns.split(/\s+/).length,
        heroBackground: getComputedStyle(heroBackground).backgroundImage,
        heroCallout: getComputedStyle(heroCallout).content,
        heading: rect(heading),
        copy: rect(copy),
        logo: rect(logo),
        features: rect(featureGrid),
        imagesLoaded: [...featureGrid.querySelectorAll('img')].every(image => image.complete && image.naturalWidth > 0),
        gridDisplay: getComputedStyle(grid).display,
      };
    });

    expect(state.overflow, `${width}px: overflow horizontal`).toBeLessThanOrEqual(1);
    expect(state.projectBackground, `${width}px: fundo da seção`).toContain('Grupo%20159.png');
    expect(state.imagesLoaded, `${width}px: recursos carregados`).toBe(true);
    expect(state.gridDisplay, `${width}px: layout da seção`).toBe('grid');

    const expectedColumns = width <= 768 ? 2 : width <= 1024 ? 3 : 5;
    expect(state.featureColumns, `${width}px: colunas de recursos`).toBe(expectedColumns);

    if (width <= 1024) {
      expect(state.heading.top, `${width}px: título antes do logo`).toBeLessThan(state.logo.top);
      expect(state.logo.top, `${width}px: logo antes do texto`).toBeLessThan(state.copy.top);
      expect(state.copy.top, `${width}px: texto antes dos recursos`).toBeLessThan(state.features.top);
    } else {
      expect(state.heading.left, `${width}px: título na coluna esquerda`).toBeLessThan(state.logo.left);
      expect(state.heading.top, `${width}px: título acima do texto`).toBeLessThan(state.copy.top);
      expect(state.copy.left, `${width}px: texto à esquerda`).toBeLessThan(state.logo.left);
      expect(state.logo.top, `${width}px: logo acima dos recursos`).toBeLessThan(state.features.top);
    }

    if (width <= 768) {
      expect(state.heroBackground, `${width}px: arte mobile do hero`).toContain('homeimagemobile.png');
      expect(state.heroCallout, `${width}px: chamada mobile do hero`).toContain('homeleftmobile.png');
    } else {
      expect(state.heroBackground, `${width}px: arte desktop do hero`).toContain('homeimage.png');
      expect(state.heroCallout, `${width}px: chamada desktop do hero`).toBe('normal');
    }
  }
});
