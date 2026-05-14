/** Edge function: price + inventory by SKU (matches product id from getProducts). */
export const PRICE_STOCK_API_ORIGIN = 'http://127.0.0.1:7676';

/**
 * @param {unknown} stock
 * @returns {string}
 */
export function formatStock(stock) {
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
export function parsePriceStockPayload(json) {
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
export function formatAvailability(row) {
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
export async function fetchPriceStock(sku) {
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
