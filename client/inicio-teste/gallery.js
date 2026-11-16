const dialog = document.querySelector('.model-dialog');
const preview = dialog.querySelector('.model-image');
const title = dialog.querySelector('#modelo-titulo');
const quote = dialog.querySelector('.model-quote');
const toolbar = document.querySelector('.gallery-toolbar');
const filters = [...toolbar.querySelectorAll('[data-filter]')];
const count = toolbar.querySelector('.gallery-count');
const models = [...document.querySelectorAll('.look')];

function showCategory(category) {
  filters.forEach((filter) => {
    filter.setAttribute('aria-pressed', String(filter.dataset.filter === category));
  });

  let visible = 0;
  models.forEach((model) => {
    model.hidden = category !== 'todos' && model.dataset.category !== category;
    if (!model.hidden) visible++;
  });
  count.textContent = visible === 1 ? '1 modelo' : `${visible} modelos`;
}

function followGalleryLink() {
  if (location.hash === '#abadas') showCategory('abadas');
  if (location.hash === '#modelos') showCategory('todos');
}

filters.forEach((filter) => {
  filter.addEventListener('click', () => showCategory(filter.dataset.filter));
});

toolbar.hidden = false;
showCategory('todos');
followGalleryLink();
window.addEventListener('hashchange', followGalleryLink);
document.querySelectorAll('a[href="#modelos"], a[href="#abadas"]').forEach((link) => {
  link.addEventListener('click', () => showCategory(link.hash === '#abadas' ? 'abadas' : 'todos'));
});

models.forEach((model) => {
  const button = model.querySelector('.look-link');
  const photo = button.querySelector('img');
  button.addEventListener('click', () => {
    const name = button.querySelector('strong').textContent;
    const category = button.querySelector('small').textContent;
    const message = `Olá! Gostaria de um orçamento para o modelo ${name} (${category}).`;

    preview.src = photo.currentSrc || photo.src;
    preview.alt = photo.alt;
    title.textContent = name;
    quote.href = `https://wa.me/5581988074760?text=${encodeURIComponent(message)}`;
    dialog.showModal();
  });
});
