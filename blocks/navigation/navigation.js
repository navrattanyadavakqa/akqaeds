import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * @param {Element} source
 * @param {string} prop
 * @param {string} fallback
 * @returns {string}
 */
function readTextField(source, prop, fallback) {
  const el = source.querySelector(`[data-aue-prop="${prop}"]`);
  if (!el) return fallback;
  const t = el.textContent.trim();
  return t || fallback;
}

/**
 * @param {Element} source
 * @param {string} prop
 * @param {string} fallback
 * @returns {string}
 */
function readPathField(source, prop, fallback) {
  const el = source.querySelector(`[data-aue-prop="${prop}"]`);
  if (!el) return fallback;
  const a = el.querySelector('a[href]');
  if (a?.href) {
    try {
      const u = new URL(a.href);
      if (u.origin === window.location.origin) return u.pathname || fallback;
      return a.href;
    } catch {
      return fallback;
    }
  }
  const t = el.textContent.trim();
  if (!t) return fallback;
  if (/^https?:\/\//i.test(t)) return t;
  return t.startsWith('/') ? t : fallback;
}

/**
 * @param {string} pathOrUrl
 * @returns {string}
 */
function toHref(pathOrUrl) {
  const p = (pathOrUrl || '/').trim();
  if (/^https?:\/\//i.test(p)) return p;
  return new URL(p.startsWith('/') ? p : `/${p}`, window.location.origin).href;
}

/**
 * @param {Element | null} main
 * @returns {boolean}
 */
function pageHasProductDetail(main) {
  return Boolean(main?.querySelector('.product-detail'));
}

/**
 * @param {Element} main
 * @returns {string}
 */
function readPdpTitleFromDom(main) {
  return main.querySelector('.product-detail .product-detail-title')?.textContent?.trim() ?? '';
}

/**
 * @param {HTMLElement} currentLi
 * @param {Element} main
 */
function watchPdpTitle(currentLi, main) {
  const apply = () => {
    const t = readPdpTitleFromDom(main);
    if (t) {
      currentLi.textContent = t;
      return true;
    }
    return false;
  };

  if (apply()) return;

  const mo = new MutationObserver(() => {
    if (apply()) mo.disconnect();
  });
  mo.observe(main, {
    subtree: true,
    childList: true,
    characterData: true,
  });

  window.setTimeout(() => {
    mo.disconnect();
    if (!currentLi.textContent.trim() || currentLi.textContent.trim() === '…') {
      const fromTitle = document.querySelector('title')?.textContent?.split('|')[0]?.trim();
      currentLi.textContent = fromTitle || 'Product';
    }
  }, 12000);
}

export default function decorate(block) {
  const main = block.closest('main');
  const source = block.cloneNode(true);

  block.innerHTML = '';
  moveInstrumentation(source, block);

  if (!pageHasProductDetail(main)) {
    return;
  }

  const homePath = readPathField(source, 'homePath', '/');
  const productsPath = readPathField(source, 'productsPage', '/products');
  const homeLabel = readTextField(source, 'homeLabel', 'Home');
  const productsLabel = readTextField(source, 'productsLabel', 'Products');

  const root = document.createElement('nav');
  root.className = 'navigation-trail';
  root.setAttribute('aria-label', 'Breadcrumb');

  const list = document.createElement('ol');
  list.className = 'navigation-list';

  const liHome = document.createElement('li');
  liHome.className = 'navigation-item';
  const aHome = document.createElement('a');
  aHome.className = 'navigation-link';
  aHome.href = toHref(homePath);
  aHome.textContent = homeLabel;
  liHome.append(aHome);
  list.append(liHome);

  const liProducts = document.createElement('li');
  liProducts.className = 'navigation-item';
  const aProducts = document.createElement('a');
  aProducts.className = 'navigation-link';
  aProducts.href = toHref(productsPath);
  aProducts.textContent = productsLabel;
  liProducts.append(aProducts);
  list.append(liProducts);

  const liCurrent = document.createElement('li');
  liCurrent.className = 'navigation-item navigation-item-current';
  liCurrent.setAttribute('aria-current', 'page');
  liCurrent.textContent = '…';
  list.append(liCurrent);

  root.append(list);
  block.append(root);

  watchPdpTitle(liCurrent, main);
}
