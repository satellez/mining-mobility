document.addEventListener('DOMContentLoaded', () => {

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
