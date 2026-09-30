const { test, expect } = require('@playwright/test');

const URL = 'http://localhost:3333/index.html#depoimentos';

test('modal de depoimentos reproduz, navega e responde ao viewport', async ({ page }, testInfo) => {
  await page.goto(URL, { waitUntil: 'networkidle' });

  const section = page.locator('#depoimentos');
  const cards = section.locator('.testimonial-card');

  await expect(section).toBeVisible();
  await expect(page.locator('#depoimentos-title')).toHaveText(/Depoimentos/i);
  await expect(cards).toHaveCount(4);
  await expect(section.locator('.testimonials-dot')).toHaveCount(4);

  const horizontalOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(1);

  await section.screenshot({
    path: testInfo.outputPath(`depoimentos-${testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`)
  });

  await cards.first().click();
  const modal = page.locator('#testimonialModal');
  const video = page.locator('#testimonialVideo');
  const phone = page.locator('.testimonial-phone');
  await expect(modal).toHaveClass(/is-open/);
  await expect(video).toHaveAttribute('src', 'https://midiasave-5c064.web.app/video1.mp4');
  if (testInfo.project.name.includes('Safari')) {
    // O WebKit headless pode devolver o foco ao player nativo durante autoplay.
    await expect(modal).toHaveAttribute('tabindex', '-1');
    await expect(page.locator('.testimonial-modal-close')).toBeEnabled();
  } else {
    await expect.poll(() => page.evaluate(() =>
      document.querySelector('#testimonialModal').contains(document.activeElement)
    )).toBe(true);
  }
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await expect.poll(() => video.evaluate(element => element.readyState)).toBeGreaterThanOrEqual(1);
  expect(await video.evaluate(element => element.duration)).toBeGreaterThan(60);
  await expect.poll(() => video.evaluate(element => element.paused)).toBe(false);

  const phoneBox = await phone.boundingBox();
  const viewport = page.viewportSize();
  expect(phoneBox).not.toBeNull();
  if (viewport.width <= 576) {
    expect(Math.abs(phoneBox.width - viewport.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(phoneBox.height - viewport.height)).toBeLessThanOrEqual(3);
  } else {
    expect(phoneBox.width).toBeLessThanOrEqual(390);
    expect(phoneBox.height).toBeLessThanOrEqual(viewport.height * 0.88);
  }

  await page.keyboard.press('ArrowRight');
  await expect(video).toHaveAttribute('src', 'https://midiasave-5c064.web.app/video2.mp4');
  await expect(page.locator('#testimonialCurrent')).toHaveText('02');
  await expect(page.locator('#testimonialModalTitle')).toHaveText('Depoimento 02');

  await page.keyboard.press('ArrowLeft');
  await expect(video).toHaveAttribute('src', 'https://midiasave-5c064.web.app/video1.mp4');

  await page.keyboard.press('Escape');
  await expect(modal).not.toHaveClass(/is-open/);
  await expect(video).not.toHaveAttribute('src');
  await expect(cards.first()).toBeFocused();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');

  await section.locator('.testimonials-dot').nth(1).click();
  await expect(cards.nth(1)).toHaveClass(/is-active/);
  await cards.nth(1).click();
  await page.locator('.testimonial-modal-close').click();
  await expect(modal).not.toHaveClass(/is-open/);
});
