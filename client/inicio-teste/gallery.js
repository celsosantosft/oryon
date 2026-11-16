const dialog = document.querySelector('.model-dialog');
const preview = dialog.querySelector('.model-image');
const title = dialog.querySelector('#modelo-titulo');
const quote = dialog.querySelector('.model-quote');
const example = dialog.querySelector('.model-example');

document.querySelectorAll('.look-link').forEach((button) => {
  button.addEventListener('click', () => {
    const model = button.dataset.quote;
    const photo = button.querySelector('img');
    const message = `Olá! Gostaria de um orçamento de sublimação para ${model.toLowerCase()}.`;

    preview.src = photo.currentSrc || photo.src;
    preview.alt = photo.alt;
    title.textContent = model;
    quote.href = `https://wa.me/5581988074760?text=${encodeURIComponent(message)}`;
    example.href = button.dataset.example;
    dialog.showModal();
  });
});
