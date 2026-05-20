import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * @param {Element} source
 * @param {string} prop
 * @param {string} [fallback]
 * @returns {string}
 */
function readTextField(source, prop, fallback = '') {
  const el = source.querySelector(`[data-aue-prop="${prop}"]`);
  if (!el) return fallback;
  const t = el.textContent.trim();
  return t || fallback;
}

export default function decorate(block) {
  const source = block.cloneNode(true);

  block.innerHTML = '';
  moveInstrumentation(source, block);

  const title = readTextField(source, 'title');
  const size = readTextField(source, 'size');

  const root = document.createElement('div');
  root.className = 'product-size-inner';
  block.append(root);

  if (title) {
    const heading = document.createElement('p');
    heading.className = 'product-size-title';
    heading.textContent = title;
    root.append(heading);
  }

  if (size) {
    const value = document.createElement('p');
    value.className = 'product-size-value';
    value.textContent = size;
    root.append(value);
  }
}
