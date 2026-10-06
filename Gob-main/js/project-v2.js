// Isolated page behavior; no dependency on the Home's carousel/modal globals.
(() => {
  const header = document.querySelector('header');
  const menu = document.getElementById('navLinks');
  const open = document.getElementById('menuIcon');
  const close = document.getElementById('menuClose');
  let previousOverflow = '';
  function setMenu(expanded) {
    if (expanded) previousOverflow = document.body.style.overflow;
    menu.classList.toggle('active', expanded);
    open.setAttribute('aria-expanded', String(expanded));
    document.body.style.overflow = expanded ? 'hidden' : previousOverflow;
    if (expanded) close.focus();
  }
  open.addEventListener('click', () => setMenu(true));
  close.addEventListener('click', () => { setMenu(false); open.focus(); });
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', event => {
    if (!menu.classList.contains('active')) return;
    if (event.key === 'Escape') { setMenu(false); open.focus(); }
    if (event.key === 'Tab') {
      const focusable = [...menu.querySelectorAll('a, button'), close];
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  new ResizeObserver(() => {
    document.body.style.setProperty('--pdf-header-height', `${header.offsetHeight}px`);
    if (innerWidth > 1100 && menu.classList.contains('active')) setMenu(false);
  }).observe(header);
})();
