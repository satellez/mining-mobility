document.addEventListener('DOMContentLoaded', () => {

  // Secciones colapsables: "Ver más" cuando el contenido supera el viewport
  const CHEVRON_DOWN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`;
  const CHEVRON_UP   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>`;

  document.querySelectorAll('section[id]').forEach(sec => {
    const natural = sec.scrollHeight;
    const limit   = window.innerHeight;
    if (natural <= limit * 1.05) return;

    sec.style.maxHeight  = limit + 'px';
    sec.style.overflow   = 'hidden';
    sec.style.position   = 'relative';
    sec.style.transition = 'max-height 0.55s cubic-bezier(0.4,0,0.2,1)';

    const rawBg = getComputedStyle(sec).backgroundColor;
    const bg    = (rawBg === 'rgba(0, 0, 0, 0)' || rawBg === 'transparent')
                  ? '#060c18' : rawBg;

    const fade = document.createElement('div');
    fade.className = 'sec-fade';
    fade.style.background = `linear-gradient(transparent, ${bg})`;

    const btn = document.createElement('button');
    btn.className = 'sec-toggle';
    btn.innerHTML = `Ver más ${CHEVRON_DOWN}`;

    let expanded = false;
    btn.addEventListener('click', () => {
      expanded = !expanded;
      if (expanded) {
        sec.style.maxHeight = natural + 'px';
        fade.style.opacity  = '0';
        btn.innerHTML       = `Ver menos ${CHEVRON_UP}`;
      } else {
        sec.style.maxHeight = limit + 'px';
        fade.style.opacity  = '1';
        btn.innerHTML       = `Ver más ${CHEVRON_DOWN}`;
        setTimeout(() => sec.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      }
    });

    sec.appendChild(fade);
    sec.appendChild(btn);
  });

  // Scroll reveal
  const revealEls = document.querySelectorAll('.reveal');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, entry.target.dataset.delay || 0);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  revealEls.forEach(el => observer.observe(el));

  // Scroll sin hash — botones del hero y links del sidebar
  function scrollToSection(targetId) {
    const target = document.getElementById(targetId);
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  }

  document.querySelectorAll('[data-scroll]').forEach(btn => {
    btn.addEventListener('click', () => scrollToSection(btn.dataset.scroll));
  });

  document.querySelectorAll('.side-nav-link[data-target]').forEach(link => {
    link.addEventListener('click', () => scrollToSection(link.dataset.target));
  });

  // Sidebar: marcar sección activa al hacer scroll
  const sections = document.querySelectorAll('section[id]');
  const sideItems = document.querySelectorAll('.side-nav-item');

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        sideItems.forEach(item => {
          const link = item.querySelector('.side-nav-link');
          item.classList.toggle('active', link && link.dataset.target === entry.target.id);
        });
      }
    });
  }, { threshold: 0.4 });

  sections.forEach(s => sectionObserver.observe(s));

});
