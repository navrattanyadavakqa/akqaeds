import { moveInstrumentation } from '../../scripts/scripts.js';

export default function decorate(block) {
  const rows = [...block.children];

  block.innerHTML = '';

  rows.forEach((row) => {
    const name =
      row.querySelector('h2')?.textContent?.trim()
      ?? row.querySelector('h1, h3, h4, h5, h6')?.textContent?.trim()
      ?? '';
    let priceRaw = row.querySelector('p')?.textContent?.trim() ?? '';
    if (priceRaw.startsWith('₹')) {
      priceRaw = priceRaw.replace(/^\s*₹\s*/, '').trim();
    }

    const card = document.createElement('div');
    card.className = 'product-list-card';
    moveInstrumentation(row, card);

    const title = document.createElement('h3');
    title.textContent = name;

    const priceEl = document.createElement('p');
    priceEl.textContent = priceRaw ? `₹${priceRaw}` : '';

    card.append(title, priceEl);
    block.appendChild(card);
  });
}
