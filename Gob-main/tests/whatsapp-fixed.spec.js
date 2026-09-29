const { test, expect } = require('@playwright/test');

const URL = 'http://localhost:3333/index.html';

async function getButtonRect(page) {
  return page.evaluate(() => {
    const btn = document.querySelector('.whatsapp-float');
    const r = btn.getBoundingClientRect();
    return { top: r.top, left: r.left, bottom: r.bottom, right: r.right };
  });
}

async function scrollTo(page, y) {
  await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
  await page.waitForTimeout(350);
}

test('botão tem position:fixed', async ({ page }) => {
  await page.goto(URL, { waitUntil: 'networkidle' });
  const info = await page.evaluate(() => {
    const btn = document.querySelector('.whatsapp-float');
    const style = window.getComputedStyle(btn);
    const r = btn.getBoundingClientRect();
    // Subir na árvore até encontrar o pai real
    let parent = btn.parentElement;
    const ancestry = [];
    while (parent && parent !== document.body) {
      const ps = window.getComputedStyle(parent);
      ancestry.push({
        tag: parent.tagName,
        id: parent.id,
        className: parent.className.substring(0, 60),
        position: ps.position,
        transform: ps.transform !== 'none' ? ps.transform.substring(0,30) : 'none',
        filter: ps.filter,
        willChange: ps.willChange,
        overflow: ps.overflow,
      });
      parent = parent.parentElement;
    }
    return {
      position: style.position,
      bottom: style.bottom,
      right: style.right,
      offsetParentTag: btn.offsetParent ? btn.offsetParent.tagName : 'null',
      offsetParentId: btn.offsetParent ? btn.offsetParent.id : 'null',
      offsetParentClass: btn.offsetParent ? btn.offsetParent.className.substring(0,60) : 'null',
      directParent: btn.parentElement ? btn.parentElement.tagName + '#' + btn.parentElement.id : 'body',
      ancestry,
      viewportH: window.innerHeight,
      bcr: { top: Math.round(r.top), bottom: Math.round(r.bottom) },
    };
  });
  console.log('DIAGNÓSTICO:', JSON.stringify(info, null, 2));
  expect(info.position).toBe('fixed');
  expect(info.offsetParentTag).toBe('null');
});

test('botão permanece fixo após rolar 500px', async ({ page }) => {
  await page.goto(URL, { waitUntil: 'networkidle' });
  const before = await getButtonRect(page);
  await scrollTo(page, 500);
  const after = await getButtonRect(page);
  console.log(`[${page.context().browser().browserType().name()}] 500px → before:`, before, '| after:', after);
  expect(Math.abs(after.bottom - before.bottom)).toBeLessThan(2);
  expect(Math.abs(after.right  - before.right )).toBeLessThan(2);
});

test('botão permanece fixo após rolar até o fim da página', async ({ page }) => {
  await page.goto(URL, { waitUntil: 'networkidle' });
  const before = await getButtonRect(page);
  await scrollTo(page, 99999);
  const after = await getButtonRect(page);
  console.log(`[${page.context().browser().browserType().name()}] fim da página → before:`, before, '| after:', after);
  expect(Math.abs(after.bottom - before.bottom)).toBeLessThan(2);
  expect(Math.abs(after.right  - before.right )).toBeLessThan(2);
});
