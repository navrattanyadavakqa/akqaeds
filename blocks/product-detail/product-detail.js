import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const PRODUCTS_API = 'https://257490-akqaeds-stage.adobeioruntime.net/api/v1/web/akqaeds/getProducts';

/** Edge function: price + inventory by SKU (same value as product id from getProducts). */
const PRICE_STOCK_API_ORIGIN = 'http://127.0.0.1:7676';

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
 * @param {unknown} stock
 * @returns {string}
 */
function formatStock(stock) {
  if (stock == null || stock === '') return '';
  if (typeof stock === 'boolean') return stock ? 'In stock' : 'Out of stock';
  const n = Number(stock);
  if (!Number.isNaN(n)) {
    if (n <= 0) return 'Out of stock';
    return `In stock (${n})`;
  }
  return String(stock);
}

/**
 * Edge API shape: `{ productId, price, stock, status, timestamp }` (optional `data` wrapper).
 * @param {unknown} json
 * @returns {{ price: unknown, stock: unknown, status: string | null } | null}
 */
function parsePriceStockPayload(json) {
  if (!json || typeof json !== 'object') return null;
  const root = /** @type {Record<string, unknown>} */ (json);
  const payload = root.data && typeof root.data === 'object'
    ? /** @type {Record<string, unknown>} */ (root.data)
    : root;
  const statusRaw = payload.status;
  const status = statusRaw != null && String(statusRaw).trim() !== ''
    ? String(statusRaw).trim()
    : null;
  return {
    price: payload.price ?? payload.salePrice ?? payload.amount ?? null,
    stock: payload.stock ?? payload.quantity ?? payload.inventory ?? payload.inStock ?? null,
    status,
  };
}

/**
 * @param {{ stock: unknown, status: string | null } | null | undefined} row
 * @returns {string}
 */
function formatAvailability(row) {
  if (!row) return '';
  if (row.status) {
    const n = Number(row.stock);
    if (!Number.isNaN(n) && n > 0) {
      return `${row.status} (${n})`;
    }
    return row.status;
  }
  return formatStock(row.stock ?? undefined);
}

/**
 * @param {string} sku
 * @returns {Promise<{ price: unknown, stock: unknown, status: string | null } | null>}
 */
async function fetchPriceStock(sku) {
  const url = `${PRICE_STOCK_API_ORIGIN}/api/price-stock?sku=${encodeURIComponent(sku)}`;
  let response;
  try {
    response = await fetch(url);
  } catch {
    return null;
  }
  if (!response.ok) return null;
  try {
    const json = await response.json();
    return parsePriceStockPayload(json);
  } catch {
    return null;
  }
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
    return;
  }

  if (!productRes.ok) {
    loading.remove();
    const err = document.createElement('p');
    err.className = 'product-detail-error';
    err.textContent = 'Could not load product.';
    root.append(err);
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
    return;
  }

  if (!json.success || !json.data) {
    loading.remove();
    const err = document.createElement('p');
    err.className = 'product-detail-error';
    err.textContent = 'Product not found.';
    root.append(err);
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
}
