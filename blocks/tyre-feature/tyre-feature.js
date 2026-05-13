import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

function renderFeatureMedia(src, alt) {
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
  return createOptimizedPicture(src, alt || '', false, [{ width: '220' }]);
}

function optimizePictureInPlace(mediaEl) {
  mediaEl.querySelectorAll('picture > img').forEach((img) => {
    const pic = img.closest('picture');
    if (!pic) return;
    const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: '220' }]);
    moveInstrumentation(img, optimizedPic.querySelector('img'));
    pic.replaceWith(optimizedPic);
  });
}

/**
 * @param {Element} row
 * @returns {boolean}
 */
function rowHasMedia(row) {
  return Boolean(row.querySelector('picture, img'));
}

/**
 * One table row whose only cell is basically an image (no headings / body copy).
 * @param {Element} row
 * @returns {boolean}
 */
function isMediaOnlyRow(row) {
  const cells = [...row.children].filter((el) => el.tagName === 'DIV');
  if (cells.length !== 1) return false;
  const cell = cells[0];
  if (!cell.querySelector('picture, img')) return false;
  return !cell.querySelector('h1, h2, h3, h4, h5, h6, p, ul, ol, li');
}

/**
 * Row with copy but no image (e.g. second row when image is authored on its own row).
 * @param {Element} row
 * @returns {boolean}
 */
function isTextOnlyRow(row) {
  if (rowHasMedia(row)) return false;
  return Boolean(row.textContent.trim());
}

/**
 * Merge adjacent image / text rows into one logical feature row.
 * @param {Element[]} rows
 * @returns {{ row: Element, instrumentFrom: Element }[]}
 */
function expandFeatureRows(rows) {
  const out = [];
  let i = 0;
  while (i < rows.length) {
    const a = rows[i];
    const b = rows[i + 1];
    if (b && isMediaOnlyRow(a) && isTextOnlyRow(b)) {
      const merged = document.createElement('div');
      [...a.children].forEach((c) => merged.append(c.cloneNode(true)));
      [...b.children].forEach((c) => merged.append(c.cloneNode(true)));
      out.push({ row: merged, instrumentFrom: a });
      i += 2;
    } else if (b && isTextOnlyRow(a) && isMediaOnlyRow(b)) {
      const merged = document.createElement('div');
      [...b.children].forEach((c) => merged.append(c.cloneNode(true)));
      [...a.children].forEach((c) => merged.append(c.cloneNode(true)));
      out.push({ row: merged, instrumentFrom: a });
      i += 2;
    } else {
      out.push({ row: a, instrumentFrom: a });
      i += 1;
    }
  }
  return out;
}

/**
 * @param {Element} row
 * @param {Element} instrumentFrom
 * @returns {HTMLElement}
 */
function buildFeatureItem(row, instrumentFrom = row) {
  if (!row.querySelector('picture, img') && !row.textContent.trim()) {
    return null;
  }

  const item = document.createElement('div');
  item.className = 'tyre-feature-item';
  moveInstrumentation(instrumentFrom, item);

  const cells = [...row.children].filter((el) => el.tagName === 'DIV');
  let mediaCell = null;
  let bodyCells = [];

  if (cells.length >= 3) {
    mediaCell = cells.find((c) => c.querySelector('picture, img')) ?? cells[0];
    bodyCells = cells.filter((c) => c !== mediaCell);
  } else if (cells.length === 2) {
    const [c0, c1] = cells;
    if (c0.querySelector('picture, img')) {
      mediaCell = c0;
      bodyCells = [c1];
    } else if (c1.querySelector('picture, img')) {
      mediaCell = c1;
      bodyCells = [c0];
    } else {
      bodyCells = cells;
    }
  } else if (cells.length === 1) {
    const cell = cells[0];
    const hasImg = Boolean(cell.querySelector('picture, img'));
    const hasCopy = Boolean(cell.querySelector('h1, h2, h3, h4, h5, h6, p, ul, ol'));
    if (hasImg && hasCopy) {
      const pic = cell.querySelector('picture');
      const img = cell.querySelector('img');
      mediaCell = document.createElement('div');
      if (pic) mediaCell.append(pic.cloneNode(true));
      else if (img) mediaCell.append(img.cloneNode(true));
      const bodyClone = cell.cloneNode(true);
      bodyClone.querySelectorAll('picture, img').forEach((n) => n.remove());
      bodyCells = [bodyClone];
    } else if (hasImg) {
      mediaCell = cell;
    } else {
      bodyCells = [cell];
    }
  }

  const media = document.createElement('div');
  media.className = 'tyre-feature-item-media';

  if (mediaCell) {
    const pic = mediaCell.querySelector('picture');
    const img = mediaCell.querySelector('img');
    if (pic) {
      media.append(pic.cloneNode(true));
    } else if (img) {
      media.append(renderFeatureMedia(img.src, img.alt));
    }
  }

  const body = document.createElement('div');
  body.className = 'tyre-feature-item-body';

  if (bodyCells.length >= 2) {
    const headSource = bodyCells[0];
    const descSource = bodyCells[1];
    const hSrc = headSource.querySelector('h1, h2, h3, h4, h5, h6');
    const titleText = hSrc?.textContent?.trim() || headSource.textContent.trim();
    if (titleText) {
      const h = document.createElement('h3');
      h.className = 'tyre-feature-item-heading';
      h.textContent = titleText;
      body.append(h);
    }
    const desc = document.createElement('div');
    desc.className = 'tyre-feature-item-desc';
    desc.innerHTML = descSource.innerHTML.trim();
    body.append(desc);
  } else if (bodyCells.length === 1) {
    const cell = bodyCells[0];
    const hEl = cell.querySelector('h1, h2, h3, h4, h5, h6');
    if (hEl) {
      const h = document.createElement('h3');
      h.className = 'tyre-feature-item-heading';
      h.textContent = hEl.textContent.trim();
      body.append(h);
      const clone = cell.cloneNode(true);
      clone.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((el) => el.remove());
      const desc = document.createElement('div');
      desc.className = 'tyre-feature-item-desc';
      desc.innerHTML = clone.innerHTML.trim();
      body.append(desc);
    } else {
      const desc = document.createElement('div');
      desc.className = 'tyre-feature-item-desc';
      desc.innerHTML = cell.innerHTML.trim();
      body.append(desc);
    }
  }

  const layoutRow = document.createElement('div');
  layoutRow.className = 'tyre-feature-item-row';
  layoutRow.append(media, body);
  item.append(layoutRow);
  optimizePictureInPlace(media);
  return item;
}

export default function decorate(block) {
  const rowEls = [...block.children];
  const root = document.createElement('div');
  root.className = 'tyre-feature-inner';
  block.innerHTML = '';

  let start = 0;
  if (rowEls[0] && !rowHasMedia(rowEls[0])) {
    const titleText = rowEls[0].querySelector('h1, h2, h3, h4, h5, h6')?.textContent?.trim()
      || rowEls[0].textContent.trim();
    if (titleText) {
      const h = document.createElement('h2');
      h.className = 'tyre-feature-title';
      h.textContent = titleText;
      root.append(h);
    }
    start = 1;
  }

  const featureRows = rowEls.slice(start);
  const expanded = expandFeatureRows(featureRows);
  expanded.forEach(({ row, instrumentFrom }) => {
    const el = buildFeatureItem(row, instrumentFrom);
    if (el) root.append(el);
  });

  block.append(root);
}
