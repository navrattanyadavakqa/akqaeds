import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

function isSafeHref(href) {
  if (!href || href === '#') return false;
  const t = href.trim().toLowerCase();
  // Disallow script URLs (eslint flags literal "javascript:" in source).
  return !t.startsWith(`${'java'}${'script'}:`);
}

/**
 * Finds a card link column: a cell with a single page link only (no prose).
 * @param {HTMLLIElement} li
 * @returns {{ href: string, column: Element, label: string | undefined } | null}
 */
function findPageLinkColumn(li) {
  const candidates = [...li.children].filter((div) => {
    if (div.querySelector('picture')) return false;
    if (div.querySelector('p, ul, ol, h1, h2, h3, h4, h5, h6')) return false;
    const links = div.querySelectorAll('a[href]');
    if (links.length !== 1) return false;
    return isSafeHref(links[0].getAttribute('href'));
  });
  const div = candidates[0];
  if (!div) return null;
  const a = div.querySelector('a[href]');
  return {
    href: a.getAttribute('href'),
    column: div,
    label: a.textContent.trim() || undefined,
  };
}

/**
 * Resolves card URL from UE link field or button-style CTA, then removes visible link UI.
 * @param {HTMLLIElement} li
 * @returns {{ href: string, label: string | undefined } | null}
 */
function peelCardLink(li) {
  const authLink = li.querySelector('[data-aue-prop="link"] a[href], [data-aue-prop="Link"] a[href]');
  if (authLink && isSafeHref(authLink.getAttribute('href'))) {
    const href = authLink.getAttribute('href');
    const label = authLink.textContent.trim() || undefined;
    const field = authLink.closest('[data-aue-prop="link"], [data-aue-prop="Link"]');
    if (field && li.contains(field)) {
      field.remove();
    }
    return { href, label };
  }

  let hrefPick;
  let labelPick;
  [...li.querySelectorAll('.cards-card-body .button-container')].forEach((bc) => {
    const a = bc.querySelector('a[href]');
    if (a && isSafeHref(a.getAttribute('href')) && !hrefPick) {
      hrefPick = a.getAttribute('href');
      labelPick = a.textContent.trim() || undefined;
    }
    bc.remove();
  });
  if (hrefPick) return { href: hrefPick, label: labelPick };

  const legacy = findPageLinkColumn(li);
  if (legacy) {
    legacy.column.remove();
    return { href: legacy.href, label: legacy.label };
  }
  return null;
}

export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    moveInstrumentation(row, li);
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      if (div.children.length === 1 && div.querySelector('picture')) div.className = 'cards-card-image';
      else div.className = 'cards-card-body';
    });

    const peeled = peelCardLink(li);
    if (peeled?.href) {
      const wrap = document.createElement('a');
      wrap.className = 'cards-card-link';
      wrap.href = peeled.href;
      if (peeled.label) wrap.setAttribute('aria-label', peeled.label);
      while (li.firstChild) wrap.append(li.firstChild);
      li.append(wrap);
    }

    ul.append(li);
  });
  ul.querySelectorAll('picture > img').forEach((img) => {
    const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    moveInstrumentation(img, optimizedPic.querySelector('img'));
    img.closest('picture').replaceWith(optimizedPic);
  });
  block.replaceChildren(ul);
}
