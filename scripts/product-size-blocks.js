import { decorateBlock, loadBlock } from './aem.js';

/**
 * @param {Element} source
 * @returns {Element[]}
 */
export function collectProductSizeNodes(source) {
  const byModel = [...source.querySelectorAll('[data-aue-model="product-size"]')];
  if (byModel.length) {
    return byModel.map((el) => el.closest('.product-size') ?? el);
  }
  return [...source.querySelectorAll('.product-size')];
}

/**
 * @param {Element | null | undefined} el
 * @returns {boolean}
 */
export function isProductSizeElement(el) {
  if (!el) return false;
  if (el.classList?.contains('product-size')) return true;
  if (el.getAttribute?.('data-aue-model') === 'product-size') return true;
  return Boolean(el.querySelector?.('[data-aue-model="product-size"], .product-size'));
}

/**
 * @param {Element} container
 * @param {Element[]} sizeSources
 * @param {string} wrapClass
 */
export function appendProductSizes(container, sizeSources, wrapClass) {
  if (!sizeSources.length) return;
  const wrap = document.createElement('div');
  wrap.className = wrapClass;
  sizeSources.forEach((sizeSource) => {
    wrap.append(sizeSource.cloneNode(true));
  });
  container.append(wrap);
}

/**
 * @param {Element} container
 */
export async function initProductSizeBlocks(container) {
  const blocks = [...container.querySelectorAll('.product-size')];
  await Promise.all(blocks.map(async (sizeBlock) => {
    decorateBlock(sizeBlock);
    await loadBlock(sizeBlock);
  }));
}

/**
 * @param {Element} container
 * @param {Element[]} sizeSources
 * @param {string} wrapClass
 */
export async function mountProductSizes(container, sizeSources, wrapClass) {
  appendProductSizes(container, sizeSources, wrapClass);
  await initProductSizeBlocks(container);
}
