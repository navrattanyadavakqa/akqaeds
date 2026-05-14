import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';
import {
  fetchPriceStock,
  formatAvailability,
} from '../../scripts/product-price-stock.js';

/** List: GET with no `id` returns `{ success, data: Product[] }`. */
/** Detail: same URL with `?id=` returns one product in `data`. */
const DEFAULT_PRODUCT_LIST_API = 'https://257490-akqaeds-stage.adobeioruntime.net/api/v1/web/akqaeds/getProducts';

/**
 * @param {Element} source
 * @returns {string}
 */
function readListApiUrl(source) {
  const field = source.querySelector('[data-aue-prop="listApiUrl"]');
  if (field) {
    const a = field.querySelector('a[href^="http"]');
    if (a?.href) return a.href.trim();
    const t = field.textContent.trim();
    if (/^https?:\/\//i.test(t)) return t;
  }
  const link = source.querySelector('a[href^="http"]');
  if (link?.href) return link.href.trim();
  const text = (source.querySelector('p')?.textContent || source.textContent || '').trim();
  if (/^https?:\/\//i.test(text)) return text;
  return '';
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
 * @param {unknown} json
 * @returns {Record<string, unknown>[]}
 */
function productsArrayFromResponse(json) {
  if (!json || typeof json !== 'object' || json.success === false) return [];
  const { data } = json;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const d = /** @type {Record<string, unknown>} */ (data);
    if (Array.isArray(d.products)) return d.products;
    if (Array.isArray(d.items)) return d.items;
    if (Array.isArray(d.results)) return d.results;
    if (d.title != null || d.name != null) return [d];
  }
  return [];
}

/**
 * @param {unknown} pathOrUrl
 * @returns {string}
 */
function toProductPageHref(pathOrUrl) {
  const raw = String(pathOrUrl ?? '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  try {
    return new URL(path, window.location.origin).href;
  } catch {
    return '';
  }
}

/**
 * @param {Record<string, unknown>} raw
 * @returns {object} Normalized product fields including `sku` for price-stock API.
 */
function normalizeProduct(raw) {
  const title = String(raw.title ?? raw.name ?? '').trim();
  const description = String(raw.description ?? raw.summary ?? '').trim();
  const image = String(raw.image ?? raw.imageUrl ?? raw.thumbnail ?? '').trim();
  const price = raw.price ?? raw.amount;
  const urlRaw = raw.url ?? raw.path ?? raw.href ?? raw.link ?? '';
  const href = toProductPageHref(
    typeof urlRaw === 'string' ? urlRaw : String(urlRaw ?? ''),
  );
  const idRaw = raw.id ?? raw.productId ?? raw.sku;
  const sku = idRaw != null && idRaw !== '' ? String(idRaw).trim() : '';
  return {
    title,
    description,
    image,
    price,
    href,
    sku,
  };
}

/**
 * @param {object[]} items
 * @returns {Promise<object[]>}
 */
async function enrichWithPriceStock(items) {
  return Promise.all(
    items.map(async (p) => {
      if (!p.sku) {
        return { ...p, stockText: '' };
      }
      const ps = await fetchPriceStock(p.sku);
      const displayPrice = (
        ps?.price != null && String(ps.price).trim() !== ''
      )
        ? ps.price
        : p.price;
      const stockText = formatAvailability(ps);
      return { ...p, price: displayPrice, stockText };
    }),
  );
}

/**
 * @param {object} p Product row with optional `stockText`.
 * @returns {HTMLElement}
 */
function buildProductCard(p) {
  const card = document.createElement(p.href ? 'a' : 'div');
  card.className = 'products-card';
  if (p.href) {
    card.href = p.href;
  }

  const mediaWrap = document.createElement('div');
  mediaWrap.className = 'products-card-image';
  if (p.image) {
    mediaWrap.append(renderProductImage(p.image, p.title || 'Product'));
  }

  const body = document.createElement('div');
  body.className = 'products-card-body';

  if (p.title) {
    const title = document.createElement('h3');
    title.textContent = p.title;
    body.append(title);
  }

  if (p.description) {
    const desc = document.createElement('div');
    desc.className = 'products-card-description';
    const para = document.createElement('p');
    para.textContent = p.description;
    desc.append(para);
    body.append(desc);
  }

  const priceEl = document.createElement('p');
  priceEl.className = 'products-card-price';
  priceEl.textContent = formatPrice(p.price);
  body.append(priceEl);

  if (p.stockText) {
    const stockEl = document.createElement('p');
    stockEl.className = 'products-card-stock';
    stockEl.textContent = p.stockText;
    body.append(stockEl);
  }

  if (mediaWrap.firstChild) card.append(mediaWrap);
  card.append(body);
  return card;
}

export default async function decorate(block) {
  const source = block.cloneNode(true);
  const apiUrl = readListApiUrl(source) || DEFAULT_PRODUCT_LIST_API;

  block.innerHTML = '';
  const loading = document.createElement('p');
  loading.className = 'product-list-status';
  loading.textContent = 'Loading products…';
  block.append(loading);
  moveInstrumentation(source, block);

  let response;
  try {
    response = await fetch(apiUrl);
  } catch {
    loading.remove();
    const err = document.createElement('p');
    err.className = 'product-list-status product-list-error';
    err.textContent = 'Network error. Could not load products.';
    block.append(err);
    return;
  }

  if (!response.ok) {
    loading.remove();
    const err = document.createElement('p');
    err.className = 'product-list-status product-list-error';
    err.textContent = 'Could not load products.';
    block.append(err);
    return;
  }

  let json;
  try {
    json = await response.json();
  } catch {
    loading.remove();
    const err = document.createElement('p');
    err.className = 'product-list-status product-list-error';
    err.textContent = 'Invalid response from server.';
    block.append(err);
    return;
  }

  const items = productsArrayFromResponse(json)
    .filter((row) => row && typeof row === 'object')
    .map((row) => normalizeProduct(/** @type {Record<string, unknown>} */ (row)));

  if (items.length === 0) {
    loading.remove();
    const empty = document.createElement('p');
    empty.className = 'product-list-status product-list-empty';
    empty.textContent = 'No products returned. Check that the list API responds with an array in `data`.';
    block.append(empty);
    return;
  }

  loading.textContent = 'Loading prices…';
  const enriched = await enrichWithPriceStock(items);
  loading.remove();

  enriched.forEach((p) => {
    block.append(buildProductCard(p));
  });

  block.querySelectorAll('.products-card-image picture > img').forEach((img) => {
    const pic = img.closest('picture');
    if (!pic || pic.dataset.optimized) return;
    const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    moveInstrumentation(img, optimizedPic.querySelector('img'));
    optimizedPic.dataset.optimized = 'true';
    pic.replaceWith(optimizedPic);
  });
}
