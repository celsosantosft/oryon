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

const slug = new URLSearchParams(location.search).get('modelo');
const selected = models.find((model) => model.querySelector('.look-link').getAttribute('href') === `?modelo=${slug}`);

if (selected) {
  const detail = document.querySelector('#modelo');
  const photo = selected.querySelector('img');
  const name = selected.querySelector('strong').textContent;
  const category = selected.querySelector('small').textContent;
  const stage = detail.querySelector('.product-photo');
  const preview = stage.querySelector('img');
  const views = [...detail.querySelectorAll('.product-views button')];
  const message = `Olá! Gostaria de um orçamento para o modelo ${name} (${category}).`;

  document.querySelector('#vitrine').hidden = true;
  document.querySelector('.top').hidden = true;
  document.title = `${name} | Atos Fardamentos`;
  detail.querySelector('h1').textContent = name;
  detail.querySelector('.model-category').textContent = category;
  detail.querySelector('.model-quote').href = `https://wa.me/5581988074760?text=${encodeURIComponent(message)}`;
  preview.src = photo.src;
  preview.alt = photo.alt;
  detail.querySelector('.product-views').style.setProperty('--photo', `url("${photo.src}")`);
  views.forEach((button) => {
    button.addEventListener('click', () => {
      stage.dataset.view = button.dataset.view;
      preview.alt = `${button.textContent.trim()} do modelo ${name}`;
      views.forEach((view) => view.setAttribute('aria-pressed', String(view === button)));
    });
  });
  detail.hidden = false;
} else {
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
    const photo = model.querySelector('img');
    const back = photo.cloneNode();
    back.alt = '';
    back.setAttribute('aria-hidden', 'true');
    back.className = 'look-back';
    photo.after(back);
  });
}
