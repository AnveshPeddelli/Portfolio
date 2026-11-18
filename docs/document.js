// Shared allowlist for saved documents, previews, and public articles.
export function cleanDocument(html, resolveUrl = (value) => value) {
  const source = document.createElement('template');
  source.innerHTML = String(html || '');
  const allowed = new Set('P DIV BR H2 H3 H4 STRONG B EM I U S UL OL LI BLOCKQUOTE PRE CODE A FIGURE IMG FIGCAPTION HR TABLE THEAD TBODY TR TH TD'.split(' '));
  function copy(node) {
    if (node.nodeType === 3) return document.createTextNode(node.textContent);
    if (node.nodeType !== 1 || ['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'SVG', 'MATH'].includes(node.tagName)) return document.createTextNode('');
    const result = document.createElement(allowed.has(node.tagName) ? node.tagName.toLowerCase() : 'span');
    for (const child of node.childNodes) result.append(copy(child));
    if (node.tagName === 'A' || node.tagName === 'IMG') {
      const attr = node.tagName === 'IMG' ? 'src' : 'href';
      const value = node.getAttribute(attr) || '';
      if (/^(https?:\/\/|\/(?!\/)|\.\.?\/)/i.test(value) || (attr === 'href' && /^(mailto:|#)/i.test(value))) result.setAttribute(attr, resolveUrl(value));
      if (attr === 'src') {
        result.setAttribute('alt', node.getAttribute('alt') || '');
        result.setAttribute('loading', 'lazy');
        // Preserve only bounded image dimensions, never arbitrary pasted CSS.
        const width = node.style.width;
        if (/^\d+(?:\.\d+)?%$/.test(width) && parseFloat(width) >= 10 && parseFloat(width) <= 100) result.style.width = width;
        const legacyWidth = node.getAttribute('width');
        if (!result.style.width && /^\d+$/.test(legacyWidth || '') && Number(legacyWidth) > 0 && Number(legacyWidth) <= 4096) result.setAttribute('width', legacyWidth);
        const alignment = node.getAttribute('data-image-align');
        if (['left', 'center', 'right'].includes(alignment)) result.setAttribute('data-image-align', alignment);
      }
      else result.setAttribute('rel', 'noopener noreferrer');
    }
    const align = node.style.textAlign;
    if (['left', 'center', 'right'].includes(align)) result.style.textAlign = align;
    if (node.tagName === 'FIGURE') {
      const photo = result.querySelector('img');
      if (photo?.style.width) result.style.setProperty('--image-width', photo.style.width);
    }
    return result;
  }
  const target = document.createElement('div');
  for (const node of source.content.childNodes) target.append(copy(node));
  return target.innerHTML;
}

export function renderDocument(pages, resolveUrl) {
  return pages.map((page, index) => `<section class="document-page" aria-label="Page ${index + 1}">${cleanDocument(page.html, resolveUrl)}</section>`).join('');
}
