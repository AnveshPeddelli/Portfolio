import { cleanDocument, renderDocument } from './document.js';

export class WritingEditor {
  constructor(textarea, upload) {
    this.textarea = textarea;
    this.form = textarea.form;
    this.upload = upload;
    this.pages = [{ html: '' }];
    this.histories = new WeakMap();
    this.index = 0;
    this.key = `portfolio-draft-${this.form.id}`;
    textarea.hidden = true;
    this.root = document.createElement('div');
    this.root.className = 'writing-studio full-span';
    textarea.closest('label').replaceWith(this.root);
    this.root.append(textarea);
    this.root.insertAdjacentHTML('beforeend', `
      <div class="writing-heading"><div><strong>Your story</strong><small>Write, add photos, and build your story across pages.</small></div><button type="button" data-action="preview">Preview</button></div>
      <div class="writing-toolbar" role="toolbar" aria-label="Document formatting">
        <select aria-label="Text style" data-style><option value="p">Normal text</option><option value="h2">Heading</option><option value="h3">Subheading</option><option value="blockquote">Quote</option><option value="pre">Code</option></select>
        <button type="button" data-command="bold" title="Bold (Ctrl+B)"><b>B</b></button><button type="button" data-command="italic" title="Italic (Ctrl+I)"><i>I</i></button><button type="button" data-command="underline" title="Underline (Ctrl+U)"><u>U</u></button>
        <button type="button" data-command="insertUnorderedList">• List</button><button type="button" data-command="insertOrderedList">1. List</button>
        <button type="button" data-command="justifyLeft">Left</button><button type="button" data-command="justifyCenter">Center</button>
        <button type="button" data-action="link">Link</button><button type="button" data-action="photos">＋ Photos</button><button type="button" data-action="table">Table</button><button type="button" data-command="insertHorizontalRule">Divider</button>
        <button type="button" data-command="undo">Undo</button><button type="button" data-command="redo">Redo</button>
      </div>
      <div class="image-tools" hidden role="group" aria-label="Selected image options">
        <strong>Photo</strong><label>Width <input type="range" min="10" max="100" step="1" value="100" aria-label="Image width percentage" data-image-width></label><output data-image-size>100%</output>
        <button type="button" data-image-preset="25">25%</button><button type="button" data-image-preset="50">50%</button><button type="button" data-image-preset="100">Full width</button>
        <select aria-label="Image alignment" data-image-align><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select>
        <label class="image-alt-label">Image description <input type="text" data-image-alt placeholder="Describe the photo for screen readers"></label>
        <button type="button" data-image-remove>Remove photo</button><small>Drag the corner handle or use the width slider. Proportions stay locked.</small>
      </div>
      <button type="button" class="image-resize-handle" aria-label="Resize selected image using the width slider" hidden title="Drag to resize"></button>
      <div class="writing-pages"><nav aria-label="Document pages"></nav><button type="button" data-action="add">＋ Page</button><button type="button" data-action="up">Move earlier</button><button type="button" data-action="down">Move later</button><button type="button" data-action="remove">Remove page</button></div>
      <div class="writing-paper rich-document" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Blog document" data-placeholder="Start your story here…"></div>
      <div class="writing-preview rich-document" hidden></div>
      <div class="writing-footer"><span data-count></span><span data-status role="status" aria-live="polite">Changes stay in this browser until you save the post.</span><button type="button" data-action="restore">Restore draft</button></div>
      <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden data-photos>
    `);
    this.paper = this.root.querySelector('.writing-paper');
    this.status = this.root.querySelector('[data-status]');
    this.setupImageTools();
    this.root.querySelectorAll('[data-command]').forEach(button => button.setAttribute('aria-label', button.title || button.textContent));
    this.root.addEventListener('mousedown', event => { if (event.target.closest('[data-command], [data-action="link"], [data-action="photos"], [data-action="table"]')) { this.captureSelection(); event.preventDefault(); } });
    this.root.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.closest('.image-tools') || button.classList.contains('image-resize-handle')) return;
      if (this.busy) { this.status.textContent = 'Wait for photo uploads to finish.'; return; }
      if (button.dataset.command) this.command(button.dataset.command);
      else if (button.dataset.page !== undefined) { this.sync(); this.index = Number(button.dataset.page); this.draw(); }
      else void this.action(button.dataset.action);
    });
    this.root.querySelector('[data-style]').addEventListener('change', event => this.command('formatBlock', event.target.value));
    this.paper.addEventListener('input', () => { this.changed(); this.refreshImageTools(); });
    this.paper.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
        event.preventDefault(); this.applyHistory(event.key.toLowerCase() === 'y' || event.shiftKey ? 1 : -1);
      }
      if (this.selectedImage && ['Delete', 'Backspace'].includes(event.key) && window.getSelection()?.isCollapsed) {
        event.preventDefault(); this.removeImage();
      }
      if (event.key === 'Escape') this.selectImage(null);
    });
    this.paper.addEventListener('beforeinput', event => {
      if (['historyUndo','historyRedo'].includes(event.inputType)) { event.preventDefault(); this.applyHistory(event.inputType === 'historyUndo' ? -1 : 1); }
    });
    this.paper.addEventListener('click', event => this.selectImage(event.target.tagName === 'IMG' ? event.target : null));
    this.paper.addEventListener('keyup', () => this.captureSelection());
    this.paper.addEventListener('mouseup', () => this.captureSelection());
    this.paper.addEventListener('paste', event => {
      event.preventDefault();
      const photos = [...event.clipboardData.files].filter(file => file.type.startsWith('image/'));
      if (photos.length) { this.captureSelection(); void this.insertPhotos(photos); }
      else this.command('insertText', event.clipboardData.getData('text/plain'));
    });
    this.paper.addEventListener('dragover', event => event.preventDefault());
    this.paper.addEventListener('drop', event => {
      event.preventDefault();
      if (!event.dataTransfer.files.length) return;
      let range = document.caretRangeFromPoint?.(event.clientX, event.clientY);
      if (range && this.paper.contains(range.startContainer)) { const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); this.range = range; }
      void this.insertPhotos([...event.dataTransfer.files]);
    });
    this.root.querySelector('[data-photos]').addEventListener('change', event => { void this.insertPhotos([...event.target.files]); event.target.value = ''; });
    this.form.addEventListener('input', () => this.saveDraft());
    this.draw();
  }
  setupImageTools() {
    this.root.addEventListener('keydown', event => {
      if (event.target.matches('[data-image-alt]') && event.key === 'Enter') {
        event.preventDefault(); this.paper.focus(); return;
      }
      if (!event.target.closest('.image-tools, .image-resize-handle') || event.target.matches('input[type="text"]')) return;
      if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
        event.preventDefault(); this.applyHistory(event.key.toLowerCase() === 'y' || event.shiftKey ? 1 : -1);
      }
    });
    this.imageTools = this.root.querySelector('.image-tools');
    this.resizeHandle = this.root.querySelector('.image-resize-handle');
    const slider = this.root.querySelector('[data-image-width]');
    slider.addEventListener('input', () => this.resizeImage(Number(slider.value), false));
    slider.addEventListener('change', () => this.changed());
    this.root.querySelectorAll('[data-image-preset]').forEach(button => button.addEventListener('click', () => this.resizeImage(Number(button.dataset.imagePreset))));
    this.root.querySelector('[data-image-align]').addEventListener('change', event => {
      if (!this.selectedImage) return;
      this.selectedImage.dataset.imageAlign = event.target.value; this.changed(); this.refreshImageTools();
    });
    this.root.querySelector('[data-image-alt]').addEventListener('input', event => {
      if (this.selectedImage) { this.selectedImage.alt = event.target.value; this.changed(); }
    });
    this.root.querySelector('[data-image-remove]').addEventListener('click', () => this.removeImage());
    this.resizeHandle.addEventListener('pointerdown', event => {
      if (!this.selectedImage || this.busy) return;
      event.preventDefault();
      const image = this.selectedImage;
      const original = image.style.width;
      const startX = event.clientX;
      const startWidth = image.getBoundingClientRect().width;
      this.resizeHandle.setPointerCapture(event.pointerId);
      const move = event => this.resizeImage((startWidth + event.clientX - startX) / this.imageContainerWidth() * 100, false);
      const finish = event => {
        if (event.type === 'pointercancel') image.style.width = original;
        this.resizeHandle.removeEventListener('pointermove', move);
        this.resizeHandle.removeEventListener('pointerup', finish);
        this.resizeHandle.removeEventListener('pointercancel', finish);
        this.changed(); this.refreshImageTools();
      };
      this.resizeHandle.addEventListener('pointermove', move);
      this.resizeHandle.addEventListener('pointerup', finish);
      this.resizeHandle.addEventListener('pointercancel', finish);
    });
    new ResizeObserver(() => this.refreshImageTools()).observe(this.paper);
    this.paper.addEventListener('load', () => this.refreshImageTools(), true);
  }
  imageContainerWidth() {
    const parent = this.selectedImage?.parentElement || this.paper;
    const style = getComputedStyle(parent);
    return Math.max(1, parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
  }
  selectImage(image) {
    this.selectedImage?.removeAttribute('data-editor-selected');
    this.selectedImage = image;
    if (image) { image.setAttribute('data-editor-selected', 'true'); image.closest('figure')?.style.setProperty('--image-width', image.style.width || '100%'); }
    this.imageTools.hidden = !image;
    this.resizeHandle.hidden = !image;
    if (image) {
      this.root.querySelector('[data-image-alt]').value = image.alt;
      this.root.querySelector('[data-image-align]').value = image.dataset.imageAlign || 'center';
    }
    this.refreshImageTools();
  }
  refreshImageTools() {
    const image = this.selectedImage;
    if (!image) return;
    if (!this.paper.contains(image) || this.paper.hidden) { this.selectImage(null); return; }
    image.closest('figure')?.style.setProperty('--image-width', image.style.width || '100%');
    const width = image.style.width.endsWith('%') ? parseFloat(image.style.width) : image.getBoundingClientRect().width / this.imageContainerWidth() * 100;
    this.root.querySelector('[data-image-width]').value = Math.round(width);
    this.root.querySelector('[data-image-size]').textContent = `${Math.round(width)}%`;
    const rect = image.getBoundingClientRect();
    const origin = this.root.getBoundingClientRect();
    this.resizeHandle.style.left = `${rect.right - origin.left}px`;
    this.resizeHandle.style.top = `${rect.bottom - origin.top}px`;
  }
  resizeImage(width, commit = true) {
    if (!this.selectedImage) return;
    this.selectedImage.style.width = `${Math.max(10, Math.min(100, Math.round(width)))}%`;
    this.selectedImage.removeAttribute('width');
    this.selectedImage.closest('figure')?.style.setProperty('--image-width', this.selectedImage.style.width);
    this.refreshImageTools();
    if (commit) this.changed();
  }
  removeImage() {
    if (!this.selectedImage) return;
    const node = this.selectedImage.closest('figure') || this.selectedImage;
    this.selectImage(null);
    const paragraph = document.createElement('p'); paragraph.append(document.createElement('br'));
    node.after(paragraph); node.remove();
    this.paper.focus();
    const range = document.createRange(); range.selectNodeContents(paragraph); range.collapse(true);
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    this.captureSelection(); this.changed();
  }
  applyHistory(direction) {
    if (this.busy) return;
    const history = this.histories.get(this.pages[this.index]);
    const next = history.index + direction;
    if (next < 0 || next >= history.items.length) return;
    history.index = next;
    this.selectImage(null); this.range = null;
    this.paper.innerHTML = history.items[next];
    this.changed(false);
    if (!this.paper.hidden) this.paper.focus();
  }
  captureSelection() { const selection = window.getSelection(); if (selection.rangeCount && this.paper.contains(selection.anchorNode)) this.range = selection.getRangeAt(0).cloneRange(); }
  command(name, value) {
    if (name === 'undo' || name === 'redo') { this.applyHistory(name === 'undo' ? -1 : 1); return; }
    this.selectImage(null);
    this.paper.focus();
    if (this.range && this.paper.contains(this.range.commonAncestorContainer)) { const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(this.range); }
    document.execCommand(name, false, value);
    this.captureSelection(); this.changed();
  }
  sync() { this.pages[this.index].html = cleanDocument(this.paper.innerHTML); this.textarea.value = this.plainText(); }
  plainText() {
    const div = document.createElement('div');
    div.innerHTML = this.pages.map(page => page.html).join('\n');
    div.querySelectorAll('p,div,h2,h3,h4,li,blockquote,pre,figcaption,tr').forEach(node => node.append('\n'));
    return div.textContent.trim();
  }
  getPages() { this.sync(); return structuredClone(this.pages); }
  hasContent() { this.sync(); return Boolean(this.plainText() || this.pages.some(page => /<img\b/.test(page.html))); }
  load(post = {}, key = this.form.id) {
    this.paper.hidden = false;
    this.root.querySelector('.writing-preview').hidden = true;
    this.root.querySelector('.writing-toolbar').hidden = false;
    this.root.querySelector('[data-action="preview"]').textContent = 'Preview';
    this.key = `portfolio-draft-${key}`;
    this.pages = Array.isArray(post.pages) && post.pages.length ? post.pages.map(page => ({ html: cleanDocument(page.html) })) : [{ html: (post.body || []).map(text => { const p = document.createElement('p'); p.textContent = text; return p.outerHTML; }).join('') }];
    this.index = 0; this.draw();
  }
  draw() {
    this.selectImage(null);
    this.range = null;
    this.paper.innerHTML = this.pages[this.index].html;
    if (!this.histories.has(this.pages[this.index])) this.histories.set(this.pages[this.index], { items: [this.paper.innerHTML], index: 0 });
    this.root.querySelector('nav').innerHTML = this.pages.map((_, index) => `<button type="button" data-page="${index}" aria-current="${index === this.index ? 'page' : 'false'}">Page ${index + 1}</button>`).join('');
    this.root.querySelector('[data-count]').textContent = `${this.plainText().split(/\s+/).filter(Boolean).length} words · ${this.pages.length} page${this.pages.length === 1 ? '' : 's'}`;
    this.root.querySelector('.writing-preview').innerHTML = renderDocument(this.pages);
  }
  changed(record = true) {
    this.sync();
    const history = this.histories.get(this.pages[this.index]);
    const html = this.pages[this.index].html;
    if (record && history && history.items[history.index] !== html) {
      history.items.splice(history.index + 1);
      history.items.push(html);
      if (history.items.length > 80) history.items.shift();
      history.index = history.items.length - 1;
    } this.root.querySelector('[data-count]').textContent = `${this.plainText().split(/\s+/).filter(Boolean).length} words · ${this.pages.length} page(s)`; this.saveDraft(); if (this.paper.hidden) this.root.querySelector('.writing-preview').innerHTML = renderDocument(this.pages); }
  saveDraft() {
    this.sync();
    const fields = Object.fromEntries([...new FormData(this.form)].filter(([_, value]) => typeof value === 'string'));
    try { localStorage.setItem(this.key, JSON.stringify({ pages: this.pages, fields })); this.status.textContent = 'Draft saved in this browser · Save the post to publish.'; }
    catch { this.status.textContent = 'Browser draft storage unavailable. Save your post to keep changes.'; }
  }
  clearDraft() { try { localStorage.removeItem(this.key); } catch { /* Saving the post must still succeed when browser storage is disabled. */ } }
  async insertPhotos(files) {
    if (this.busy || !files.length) return;
    if (files.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      this.status.textContent = 'Choose JPG, PNG, or WebP images up to 5 MB each.'; return;
    }
    this.captureSelection();
    let insertionRange = this.range?.cloneRange();
    if (!insertionRange || !this.paper.contains(insertionRange.commonAncestorContainer)) {
      insertionRange = document.createRange(); insertionRange.selectNodeContents(this.paper); insertionRange.collapse(false);
    }
    const anchor = insertionRange.startContainer.nodeType === 1 ? insertionRange.startContainer : insertionRange.startContainer.parentElement;
    const enclosingPhoto = anchor.closest?.('figure');
    if (enclosingPhoto && this.paper.contains(enclosingPhoto)) { insertionRange.setStartAfter(enclosingPhoto); insertionRange.collapse(true); }
    const page = this.pages[this.index];
    this.busy = true;
    this.selectImage(null);
    this.paper.contentEditable = 'false';
    this.status.textContent = 'Uploading photos…';
    try {
      for (const file of files) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Choose JPG, PNG, or WebP images up to 5 MB each.');
        const result = await this.upload(file);
        if (this.pages[this.index] !== page) throw new Error('The document changed during upload. Please insert the photo again.');
        this.paper.contentEditable = 'true';
        this.range = insertionRange;
        const figure = document.createElement('figure');
        const image = document.createElement('img'); image.src = result.url; image.style.width = '100%'; image.dataset.imageAlign = 'center';
        image.alt = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
        const caption = document.createElement('figcaption'); caption.append(document.createElement('br'));
        figure.append(image, caption);
        this.command('insertHTML', figure.outerHTML + '<p><br></p>');
        insertionRange = this.range?.cloneRange();
        this.paper.contentEditable = 'false';
      }
    } catch (error) { this.status.textContent = error.message; }
    finally { this.busy = false; this.paper.contentEditable = 'true'; }
  }
  async action(action) {
    if (this.busy) { this.status.textContent = 'Wait for photo uploads to finish before changing pages.'; return; }
    this.sync();
    if (action === 'photos') this.root.querySelector('[data-photos]').click();
    if (action === 'link') { const url = window.prompt('Link address (https://…)'); if (url && /^https?:\/\//i.test(url)) this.command('createLink', url); }
    if (action === 'table') this.command('insertHTML', '<table><tbody><tr><th>Detail</th><th>Notes</th></tr><tr><td>Stay / stop</td><td>Add your notes here</td></tr></tbody></table><p><br></p>');
    if (action === 'preview') {
      this.selectImage(null);
      const preview = this.root.querySelector('.writing-preview'); preview.innerHTML = renderDocument(this.pages); preview.hidden = !preview.hidden; this.paper.hidden = !preview.hidden;
      this.root.querySelector('.writing-toolbar').hidden = !preview.hidden;
      this.root.querySelector('[data-action="preview"]').textContent = preview.hidden ? 'Preview' : 'Back to writing';
    }
    if (action === 'restore') {
      try { const draft = JSON.parse(localStorage.getItem(this.key)); if (!draft) { this.status.textContent = 'No saved draft for this post.'; return; }
        if (!Array.isArray(draft.pages) || !draft.pages.length || !draft.fields || typeof draft.fields !== 'object') throw new Error('Invalid draft');
        if (!window.confirm('Replace the current editor with the saved browser draft?')) return;
        for (const [name, value] of Object.entries(draft.fields)) if (!['kind', 'body'].includes(name) && typeof value === 'string' && this.form.elements[name]) this.form.elements[name].value = value;
        this.pages = draft.pages.map(page => ({ html: cleanDocument(page.html) })); this.index = 0; this.draw(); this.status.textContent = 'Draft restored. Save the post when ready.';
      } catch { this.status.textContent = 'Unable to restore this draft.'; }
    }
    if (action === 'add') { this.pages.splice(this.index + 1, 0, { html: '' }); this.index++; }
    if (action === 'remove' && window.confirm('Remove this page and its content?')) { this.pages.splice(this.index, 1); if (!this.pages.length) this.pages.push({ html: '' }); this.index = Math.min(this.index, this.pages.length - 1); }
    const next = this.index + (action === 'up' ? -1 : 1);
    if (['up', 'down'].includes(action) && next >= 0 && next < this.pages.length) { [this.pages[this.index], this.pages[next]] = [this.pages[next], this.pages[this.index]]; this.index = next; }
    if (['add', 'remove', 'up', 'down'].includes(action)) { this.draw(); this.saveDraft(); }
  }
}
