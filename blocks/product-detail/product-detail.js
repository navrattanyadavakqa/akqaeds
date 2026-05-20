import {
  createOptimizedPicture,
  decorateBlock,
  loadBlock,
} from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';
import {
  fetchPriceStock,
  formatAvailability,
} from '../../scripts/product-price-stock.js';

const PRODUCTS_API = 'https://257490-akqaeds-stage.adobeioruntime.net/api/v1/web/akqaeds/getProducts';

/**
 * @param {Element} source
 * @returns {Element[]}
 */
function collectProductSizeNodes(source) {
  const byModel = [...source.querySelectorAll('[data-aue-model="product-size"]')];
  if (byModel.length) {
    return byModel.map((el) => el.closest('.product-size') ?? el);
  }
  return [...source.querySelectorAll('.product-size')];
}

/**
 * @param {Element} container
 * @param {Element[]} sizeSources
 */
function appendProductSizes(container, sizeSources) {
  if (!sizeSources.length) return;
  const wrap = document.createElement('div');
  wrap.className = 'product-detail-sizes';
  sizeSources.forEach((sizeSource) => {
    wrap.append(sizeSource.cloneNode(true));
  });
  container.append(wrap);
}

/**
 * @param {Element} container
 */
async function initProductSizeBlocks(container) {
  const blocks = [...container.querySelectorAll('.product-size')];
  await Promise.all(blocks.map(async (sizeBlock) => {
    decorateBlock(sizeBlock);
    await loadBlock(sizeBlock);
  }));
}

/**
 * Reads authored product id from block markup (first number in text, or ?id= from link).
 * @param {Element} block
 * @returns {string}
 */
function readProductId(block) {
  const field = block.querySelector('[data-aue-prop="productId"]');
  if (field) {
    const raw = field.textContent.trim();
    const digits = raw.match(/\d+/)?.[0];
    return digits || raw;
  }
  const scoped = block.cloneNode(true);
  scoped.querySelectorAll('.product-size, [data-aue-model="product-size"]').forEach((n) => n.remove());
  const link = scoped.querySelector('a[href*="getProducts"]');
  if (link) {
    try {
      const u = new URL(link.href);
      const id = u.searchParams.get('id');
      if (id) return id.trim();
    } catch {
      // ignore
    }
  }
  const raw = (scoped.querySelector('p')?.textContent || scoped.textContent || '').trim();
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

/**
 * @param {Element} block
 * @param {Element} root
 * @param {Element[]} sizeSources
 */
async function mountProductDetail(block, root, sizeSources) {
  const body = root.querySelector('.product-detail-card-body');
  if (body) {
    appendProductSizes(body, sizeSources);
    await initProductSizeBlocks(body);
  } else if (sizeSources.length) {
    appendProductSizes(root, sizeSources);
    await initProductSizeBlocks(root);
  }
  if (!root.parentElement) {
    block.append(root);
  }
}

export default async function decorate(block) {
  const source = block.cloneNode(true);
  const sizeSources = collectProductSizeNodes(source);
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
    await mountProductDetail(block, root, sizeSources);
    return;
  }

  const loading = document.createElement('p');
  loading.className = 'product-detail-loading';
  loading.textContent = 'Loading…';
  root.append(loading);
  block.append(root);

  let productRes;
  /** @type {{ price: unknown, stock: unknown, status: string | null } | null} */
  let priceStock;
  try {
    [productRes, priceStock] = await Promise.all([
      fetch(`${PRODUCTS_API}?id=${encodeURIComponent(productId)}`),
      fetchPriceStock(productId),
    ]);
  } catch {
    loading.remove();
    const err = document.createElement('p');
    err.className = 'product-detail-error';
    err.textContent = 'Network error. Could not load product.';
    root.append(err);
    await mountProductDetail(block, root, sizeSources);
    return;
  }

  if (!productRes.ok) {
    loading.remove();
    const err = document.createElement('p');
    err.className = 'product-detail-error';
    err.textContent = 'Could not load product.';
    root.append(err);
    await mountProductDetail(block, root, sizeSources);
    return;
  }

  let json;
  try {
    json = await productRes.json();
  } catch {
    loading.remove();
    const err = document.createElement('p');
    err.className = 'product-detail-error';
    err.textContent = 'Invalid response from server.';
    root.append(err);
    await mountProductDetail(block, root, sizeSources);
    return;
  }

  if (!json.success || !json.data) {
    loading.remove();
    const err = document.createElement('p');
    err.className = 'product-detail-error';
    err.textContent = 'Product not found.';
    root.append(err);
    await mountProductDetail(block, root, sizeSources);
    return;
  }

  loading.remove();

  const {
    title, description, image, price: catalogPrice,
  } = json.data;

  const displayPrice = (
    priceStock?.price != null && String(priceStock.price).trim() !== ''
  )
    ? priceStock.price
    : catalogPrice;

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
  priceEl.textContent = formatPrice(displayPrice);
  body.append(priceEl);

  const stockText = formatAvailability(priceStock);
  if (stockText) {
    const stockEl = document.createElement('p');
    stockEl.className = 'product-detail-card-stock';
    stockEl.textContent = stockText;
    body.append(stockEl);
  }

  if (media.firstChild) root.append(media);
  root.append(body);
  await mountProductDetail(block, root, sizeSources);
}
