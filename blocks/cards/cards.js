import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Finds a card link column: a cell with a single page link (AEM content picker),
 * not the main richtext body (which uses paragraphs, lists, or headings).
 * @param {HTMLLIElement} li
 * @returns {{ href: string, column: Element, label: string } | null}
 */
function findPageLinkColumn(li) {
  const { children } = li;
  for (let i = 0; i < children.length; i += 1) {
    const div = children[i];
    if (div.querySelector('picture')) continue;
    if (div.querySelector('p, ul, ol, h1, h2, h3, h4, h5, h6')) continue;
    const links = div.querySelectorAll('a[href]');
    if (links.length !== 1) continue;
    const a = links[0];
    const href = a.getAttribute('href');
    if (!href || href === '#' || href.startsWith('javascript:')) continue;
    return {
      href,
      column: div,
      label: a.textContent.trim() || undefined,
    };
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

    const pageLink = findPageLinkColumn(li);
    if (pageLink) {
      const { href, column, label } = pageLink;
      column.remove();
      const wrap = document.createElement('a');
      wrap.className = 'cards-card-link';
      wrap.href = href;
      if (label) wrap.setAttribute('aria-label', label);
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
