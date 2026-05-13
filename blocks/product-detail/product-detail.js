import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const PRODUCTS_API = 'https://257490-akqaeds-stage.adobeioruntime.net/api/v1/web/akqaeds/getProducts';

/**
 * Reads authored product id from block markup (first number in text, or ?id= from link).
 * @param {Element} block
 * @returns {string}
 */
function readProductId(block) {
  const link = block.querySelector('a[href*="getProducts"]');
  if (link) {
    try {
      const u = new URL(link.href);
      const id = u.searchParams.get('id');
      if (id) return id.trim();
    } catch {
      // ignore
    }
  }
  const raw = (block.querySelector('p')?.textContent || block.textContent || '').trim();
  const digits = raw.match(/\d+/)?.[0];
  return digits || raw;
}

function formatPrice(value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (!Number.isNaN(n)) {
    return `₹${n.toLocaleString('en-IN')}`;
  }
  return String(value);
}

/**
 * @param {string} src
 * @param {string} alt
 * @returns {Element}
 */
function renderProductImage(src, alt) {
  try {
    const u = new URL(src, window.location.href);
    if (u.origin !== window.location.origin) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = alt || '';
      img.loading = 'lazy';
      return img;
    }
  } catch {
    // fall through
  }
  return createOptimizedPicture(src, alt || '', false, [{ width: '750' }]);
}

export default async function decorate(block) {
  const source = block.cloneNode(true);
  const productId = readProductId(source);
  block.innerHTML = '';

  const root = document.createElement('div');
  root.className = 'product-detail-card';
  moveInstrumentation(source, root);

  if (!productId) {
    const hint = document.createElement('p');
    hint.className = 'product-detail-placeholder';
    hint.textContent = 'Add a product ID.';
    root.append(hint);
    block.append(root);
    return;
  }

  const loading = document.createElement('p');
  loading.className = 'product-detail-loading';
  loading.textContent = 'Loading…';
  root.append(loading);
  block.append(root);

  let response;
  try {
    const url = `${PRODUCTS_API}?id=${encodeURIComponent(productId)}`;
    response = await fetch(url);
  } catch {
    loading.remove();
    const err = document.createElement('p');
    err.className = 'product-detail-error';
    err.textContent = 'Network error. Could not load product.';
    root.append(err);
    return;
  }

  if (!response.ok) {
    loading.remove();
    const err = document.createElement('p');
    err.className = 'product-detail-error';
    err.textContent = 'Could not load product.';
    root.append(err);
    return;
  }

  let json;
  try {
    json = await response.json();
  } catch {
    loading.remove();
    const err = document.createElement('p');
    err.className = 'product-detail-error';
    err.textContent = 'Invalid response from server.';
    root.append(err);
    return;
  }

  loading.remove();

  if (!json.success || !json.data) {
    const err = document.createElement('p');
    err.className = 'product-detail-error';
    err.textContent = 'Product not found.';
    root.append(err);
    return;
  }

  const {
    title, description, image, price,
  } = json.data;

  root.innerHTML = '';

  const media = document.createElement('div');
  media.className = 'product-detail-card-image';
  if (image) {
    const picOrImg = renderProductImage(image, title || 'Product');
    media.append(picOrImg);
  }

  const body = document.createElement('div');
  body.className = 'product-detail-card-body';

  if (title) {
    const h = document.createElement('h2');
    h.className = 'product-detail-title';
    h.textContent = title;
    body.append(h);
  }

  if (description) {
    const desc = document.createElement('p');
    desc.className = 'product-detail-card-description';
    desc.textContent = description;
    body.append(desc);
  }

  const priceEl = document.createElement('p');
  priceEl.className = 'product-detail-card-price';
  priceEl.textContent = formatPrice(price);
  body.append(priceEl);

  if (media.firstChild) root.append(media);
  root.append(body);
}
