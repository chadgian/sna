(() => {
  const search = document.getElementById('guideSearch');
  const sections = [...document.querySelectorAll('.guide-section')];
  const tocLinks = [...document.querySelectorAll('.guide-toc a')];
  const empty = document.getElementById('guideSearchEmpty');

  function normalize(value) {
    return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function runSearch() {
    const query = normalize(search?.value);
    let visible = 0;
    sections.forEach(section => {
      const haystack = normalize(section.dataset.search || section.textContent);
      const match = !query || haystack.includes(query);
      section.classList.toggle('hidden-by-search', !match);
      if (match) visible += 1;
    });
    tocLinks.forEach(link => {
      const section = document.querySelector(link.getAttribute('href'));
      link.style.display = section?.classList.contains('hidden-by-search') ? 'none' : '';
    });
    empty?.classList.toggle('show', visible === 0);
  }

  search?.addEventListener('input', runSearch);

  const observer = new IntersectionObserver(entries => {
    const visible = entries
      .filter(entry => entry.isIntersecting && !entry.target.classList.contains('hidden-by-search'))
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    tocLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${visible.target.id}`));
  }, { rootMargin: '-18% 0px -68% 0px', threshold: [0, .2, .5, .8] });

  sections.forEach(section => observer.observe(section));

  document.querySelectorAll('[data-expand-all]').forEach(button => {
    button.addEventListener('click', () => {
      const details = [...document.querySelectorAll('details')];
      const shouldOpen = details.some(item => !item.open);
      details.forEach(item => { item.open = shouldOpen; });
      button.innerHTML = shouldOpen
        ? '<i class="fa-solid fa-compress me-1"></i>Collapse details'
        : '<i class="fa-solid fa-expand me-1"></i>Expand details';
    });
  });
})();