import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

function normalizePrice(text) {
  if (!text) return '';
  let t = text.trim();
  if (t.startsWith('₹')) t = t.replace(/^\s*₹\s*/, '').trim();
  return t ? `₹${t}` : '';
}

function isMostlyPrice(text) {
  return /^[\s₹$€£]*[\d,.]+[\s\d,.₹$€£]*$/u.test(text.trim());
}

function cellPlainText(cell) {
  if (!cell) return '';
  const h = cell.querySelector('h1, h2, h3, h4, h5, h6');
  if (h) return h.textContent.trim();
  const p = cell.querySelector('p');
  if (p) return p.textContent.trim();
  return cell.textContent.trim();
}

function cellDescriptionHTML(cell) {
  if (!cell) return '';
  const clone = cell.cloneNode(true);
  clone.querySelectorAll('picture, img').forEach((el) => el.remove());
  return clone.innerHTML.trim();
}

function firstPictureOrImg(container) {
  const pic = container?.querySelector('picture');
  if (pic) return { type: 'picture', el: pic };
  const img = container?.querySelector('img');
  if (img) return { type: 'img', el: img };
  return null;
}

function extractFromColumns(cells) {
  if (cells.length >= 4) {
    const media = firstPictureOrImg(cells[0]);
    return {
      media,
      name: cellPlainText(cells[1]),
      descriptionHTML: cellDescriptionHTML(cells[2]),
      price: cellPlainText(cells[3]),
    };
  }
  if (cells.length === 3) {
    const media = firstPictureOrImg(cells[0]);
    const mid = cells[1];
    const heading = mid?.querySelector('h1, h2, h3, h4, h5, h6');
    const midPs = [...(mid?.querySelectorAll('p') ?? [])].filter((p) => !p.closest('picture'));
    let name = heading?.textContent.trim() ?? '';
    let descriptionHTML = '';
    const price = cellPlainText(cells[2]);

    if (heading && midPs.length) {
      descriptionHTML = midPs.map((p) => p.outerHTML).join('');
    } else if (midPs.length >= 2) {
      name = midPs[0].textContent.trim();
      descriptionHTML = midPs.slice(1).map((p) => p.outerHTML).join('');
    } else if (midPs.length === 1) {
      if (!name) name = midPs[0].textContent.trim();
      else descriptionHTML = midPs[0].outerHTML;
    } else if (!name && mid) {
      name = mid.textContent.trim().split(/\n/)[0]?.trim() ?? '';
    }
    return { media, name, descriptionHTML, price };
  }
  return null;
}

function extractFromFlat(row) {
  const media = firstPictureOrImg(row);
  const heading = row.querySelector('h1, h2, h3, h4, h5, h6');
  const bodyPs = [...row.querySelectorAll('p')].filter((p) => !p.closest('picture'));

  let name = heading?.textContent.trim() ?? '';
  let descriptionHTML = '';
  let price = '';

  if (heading) {
    if (bodyPs.length >= 2) {
      descriptionHTML = bodyPs.slice(0, -1).map((p) => p.outerHTML).join('');
      price = bodyPs[bodyPs.length - 1].textContent.trim();
    } else if (bodyPs.length === 1) {
      const t = bodyPs[0].textContent.trim();
      if (isMostlyPrice(t)) price = t;
      else descriptionHTML = bodyPs[0].outerHTML;
    }
  } else if (bodyPs.length >= 4) {
    name = bodyPs[0].textContent.trim();
    descriptionHTML = bodyPs.slice(1, -1).map((p) => p.outerHTML).join('');
    price = bodyPs[bodyPs.length - 1].textContent.trim();
  } else if (bodyPs.length === 3) {
    name = bodyPs[0].textContent.trim();
    descriptionHTML = bodyPs[1].outerHTML;
    price = bodyPs[2].textContent.trim();
  } else if (bodyPs.length === 2) {
    if (isMostlyPrice(bodyPs[1].textContent)) {
      name = bodyPs[0].textContent.trim();
      price = bodyPs[1].textContent.trim();
    } else {
      descriptionHTML = bodyPs[0].outerHTML;
      price = bodyPs[1].textContent.trim();
    }
  } else if (bodyPs.length === 1) {
    const t = bodyPs[0].textContent.trim();
    if (isMostlyPrice(t)) price = t;
    else name = t;
  }

  return { media, name, descriptionHTML, price };
}

function extractProduct(row) {
  const cells = [...row.children].filter((el) => el.tagName === 'DIV');
  if (cells.length >= 3) {
    const fromCols = extractFromColumns(cells);
    if (fromCols && (fromCols.name || fromCols.descriptionHTML || fromCols.price || fromCols.media)) {
      return fromCols;
    }
  }
  return extractFromFlat(row);
}

export default function decorate(block) {
  const rows = [...block.children];

  block.innerHTML = '';

  rows.forEach((row) => {
    const { media, name, descriptionHTML, price } = extractProduct(row);

    const card = document.createElement('div');
    card.className = 'products-card';
    moveInstrumentation(row, card);

    const mediaWrap = document.createElement('div');
    mediaWrap.className = 'products-card-image';

    if (media?.type === 'picture') {
      mediaWrap.append(media.el.cloneNode(true));
    } else if (media?.type === 'img') {
      const { el: img } = media;
      const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
      moveInstrumentation(img, optimizedPic.querySelector('img'));
      mediaWrap.append(optimizedPic);
    }

    const body = document.createElement('div');
    body.className = 'products-card-body';

    const title = document.createElement('h3');
    title.textContent = name;

    const desc = document.createElement('div');
    desc.className = 'products-card-description';
    if (descriptionHTML) {
      desc.innerHTML = descriptionHTML;
    }

    const priceEl = document.createElement('p');
    priceEl.className = 'products-card-price';
    priceEl.textContent = normalizePrice(price);

    if (name) body.append(title);
    if (descriptionHTML) body.append(desc);
    body.append(priceEl);

    if (mediaWrap.firstChild) {
      card.append(mediaWrap);
    }
    card.append(body);
    block.appendChild(card);
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
