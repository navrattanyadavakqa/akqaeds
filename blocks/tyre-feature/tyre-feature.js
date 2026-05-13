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
  return createOptimizedPicture(src, alt || '', false, [{ width: '400' }]);
}

function optimizePictureInPlace(mediaEl) {
  mediaEl.querySelectorAll('picture > img').forEach((img) => {
    const pic = img.closest('picture');
    if (!pic) return;
    const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: '400' }]);
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
 * @param {Element} row
 * @returns {HTMLElement}
 */
function buildFeatureItem(row) {
  const item = document.createElement('div');
  item.className = 'tyre-feature-item';
  moveInstrumentation(row, item);

  const cells = [...row.children].filter((el) => el.tagName === 'DIV');
  let mediaCell = null;
  let bodyCells = [];

  if (cells.length >= 3) {
    mediaCell = cells.find((c) => c.querySelector('picture, img')) ?? cells[0];
    bodyCells = cells.filter((c) => c !== mediaCell);
  } else if (cells.length === 2) {
    if (cells[0].querySelector('picture, img')) {
      mediaCell = cells[0];
      bodyCells = [cells[1]];
    } else if (cells[1].querySelector('picture, img')) {
      mediaCell = cells[1];
      bodyCells = [cells[0]];
    } else {
      bodyCells = cells;
    }
  } else if (cells.length === 1) {
    if (cells[0].querySelector('picture, img')) mediaCell = cells[0];
    else bodyCells = [cells[0]];
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

  item.append(media, body);
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

  for (let i = start; i < rowEls.length; i += 1) {
    root.append(buildFeatureItem(rowEls[i]));
  }

  block.append(root);
}
