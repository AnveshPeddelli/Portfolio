import { WritingEditor } from "./writing-editor.js";
const THEME_STORAGE_KEY = "portfolio-theme";
const OWNER_KEY_STORAGE = "portfolio-owner-key";

const state = {
  ownerKey: window.sessionStorage.getItem(OWNER_KEY_STORAGE) || "",
  content: null,
  editingPost: null,
  editingProject: null,
  activePanel: "personal",
  theme: window.localStorage.getItem(THEME_STORAGE_KEY) !== "dark" ? "light" : "dark",
};

const dom = {};

document.addEventListener("DOMContentLoaded", () => {
  collectDom();
  applyTheme(state.theme, false);
  dom.postWriter = new WritingEditor(dom.postForm.elements.body, uploadFile);
  dom.travelForm = document.querySelector("#travel-post-form");
  dom.travelWriter = new WritingEditor(dom.travelForm.elements.body, uploadFile);
  dom.travelStatus = document.querySelector("#travel-post-status");
  setupConsole();
  dom.editWriter = new WritingEditor(dom.postEditForm.elements.body, uploadFile);
  bindEvents();

  if (state.ownerKey) {
    void loadContent();
  }
});

function collectDom() {
  dom.loginPanel = document.querySelector("#login-panel");
  dom.dashboard = document.querySelector("#creator-dashboard");
  dom.loginForm = document.querySelector("#creator-login");
  dom.loginStatus = document.querySelector("#login-status");
  dom.profileForm = document.querySelector("#profile-form");
  dom.uploadForm = document.querySelector("#upload-form");
  dom.uploadStatus = document.querySelector("#upload-status");
  dom.uploadedUrl = document.querySelector("#uploaded-url");
  dom.projectForm = document.querySelector("#project-form");
  dom.postForm = document.querySelector("#post-form");
  dom.postStatus = document.querySelector("#post-status");
  dom.postFilter = document.querySelector("#post-filter");
  dom.postSearch = document.querySelector("#post-search");
  dom.postList = document.querySelector("#post-list");
  dom.postManagerStatus = document.querySelector("#post-manager-status");
  dom.postEditForm = document.querySelector("#post-edit-form");
  dom.postEditHeading = document.querySelector("#post-edit-heading");
  dom.postEditStatus = document.querySelector("#post-edit-status");
  dom.cancelPostEdit = document.querySelector("#cancel-post-edit");
  dom.jsonForm = document.querySelector("#json-form");
  dom.jsonEditor = document.querySelector("#json-editor");
  dom.saveStatus = document.querySelector("#save-status");
  dom.reloadButton = document.querySelector("#reload-content");
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-theme-toggle]")) {
      toggleTheme();
    }
  });

  dom.loginForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(dom.loginForm);
    state.ownerKey = String(formData.get("ownerKey") || "").trim();
    window.sessionStorage.setItem(OWNER_KEY_STORAGE, state.ownerKey);
    void loadContent();
  });

  dom.profileForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    void runSave(saveProfile);
  });

  dom.uploadForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    void uploadMedia();
  });

  dom.projectForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    void runSave(addProject);
  });

  dom.postForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    void runSave(addPost);
  });

  dom.postFilter?.addEventListener("change", () => {
    renderPostManager();
  });

  dom.postSearch?.addEventListener("input", () => {
    renderPostManager();
  });

  dom.postList?.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-post]");
    const deleteButton = event.target.closest("[data-delete-post]");

    if (editButton) {
      beginEditPost(editButton.dataset.collection, Number(editButton.dataset.index));
      return;
    }

    if (deleteButton) {
      void deletePost(deleteButton.dataset.collection, Number(deleteButton.dataset.index));
    }
  });

  dom.postEditForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    void runSave(updatePost);
  });

  dom.cancelPostEdit?.addEventListener("click", () => {
    cancelPostEdit();
  });

  dom.jsonForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    saveJsonEditor();
  });

  dom.reloadButton?.addEventListener("click", () => {
    void loadContent();
  });
}

function applyTheme(theme, persist = true) {
  state.theme = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = state.theme;

  if (persist) {
    window.localStorage.setItem(THEME_STORAGE_KEY, state.theme);
  }

  const toggle = document.querySelector("[data-theme-toggle]");

  if (toggle) {
    const nextTheme = state.theme === "dark" ? "light" : "dark";
    toggle.setAttribute("aria-label", `Switch to ${nextTheme} mode`);
    toggle.querySelector("[data-theme-label]").textContent =
      state.theme === "dark" ? "Dark" : "Light";
  }
}

function toggleTheme() {
  applyTheme(state.theme === "dark" ? "light" : "dark");
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-admin-key": state.ownerKey,
      ...(options.headers || {}),
    },
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Request failed.");
  }

  return result;
}

async function loadContent() {
  setStatus(dom.loginStatus, "Checking owner key...");

  try {
    const result = await requestJson("/api/creator/content");
    state.content = result.content;
    dom.loginPanel.hidden = true;
    dom.dashboard.hidden = false;
    renderEditor();
    setStatus(dom.loginStatus, "");
    setStatus(dom.saveStatus, "Content loaded.", "ok");
  } catch (error) {
    window.sessionStorage.removeItem(OWNER_KEY_STORAGE);
    state.ownerKey = "";
    dom.loginPanel.hidden = false;
    dom.dashboard.hidden = true;
    setStatus(dom.loginStatus, getErrorMessage(error), "error");
  }
}

function renderEditor() {
  const { profile = {} } = state.content;

  setFormValue(dom.profileForm, "name", profile.name);
  setFormValue(dom.profileForm, "location", profile.location);
  setFormValue(dom.profileForm, "email", profile.email);
  setFormValue(dom.profileForm, "phone", profile.phone);
  setFormValue(dom.profileForm, "headline", profile.headline);
  setFormValue(dom.profileForm, "subheadline", profile.subheadline);
  setFormValue(dom.profileForm, "resumeUrl", profile.resumeUrl === "#" ? "" : profile.resumeUrl);

  ["photoUrl", "availability"].forEach(name => setFormValue(dom.profileForm, name, profile[name]));
  setFormValue(dom.profileForm, "githubUrl", profile.socialLinks?.find(link => link.label === "GitHub")?.url || "");
  setFormValue(dom.profileForm, "linkedinUrl", profile.socialLinks?.find(link => link.label === "LinkedIn")?.url || "");
  renderSkillFields();
  renderProjectManager();
  dom.jsonEditor.value = JSON.stringify(state.content, null, 2);
  renderPostManager();
}

function setFormValue(form, name, value = "") {
  const field = form?.elements?.[name];

  if (field) {
    field.value = value || "";
  }
}

async function saveProfile() {
  const formData = new FormData(dom.profileForm);
  const previous = structuredClone(state.content);
  const next = { ...state.content.profile };
  try {
    for (const name of ["name", "location", "email", "phone", "headline", "subheadline", "resumeUrl", "photoUrl", "availability"]) next[name] = String(formData.get(name) || "").trim();
    next.resumeUrl ||= "#";
    for (const [field, destination] of [["photoFile", "photoUrl"], ["resumeFile", "resumeUrl"]]) {
      const file = dom.profileForm.elements[field].files[0];
      if (file) { setStatus(dom.saveStatus, "Uploading files…"); next[destination] = (await uploadFile(file)).url; }
    }
    next.socialLinks = (next.socialLinks || []).filter(link => !["GitHub", "LinkedIn", "Email"].includes(link.label));
    for (const [field, label] of [["githubUrl", "GitHub"], ["linkedinUrl", "LinkedIn"]]) {
      const url = String(formData.get(field) || "").trim(); if (url) next.socialLinks.push({ label, url });
    }
    if (next.email) next.socialLinks.push({ label: "Email", url: `mailto:${next.email}` });
    state.content.profile = next;
    if (!await saveContent("Personal information saved.")) state.content = previous;
    else { dom.profileForm.elements.photoFile.value = ""; dom.profileForm.elements.resumeFile.value = ""; setFormValue(dom.profileForm, "photoUrl", next.photoUrl); setFormValue(dom.profileForm, "resumeUrl", next.resumeUrl); }
  } catch (error) { state.content = previous; setStatus(dom.saveStatus, getErrorMessage(error), "error"); }
}

async function uploadMedia() {
  const file = dom.uploadForm.elements.image.files[0];

  if (!file) {
    setStatus(dom.uploadStatus, "Choose a file first.", "error");
    return;
  }

  setStatus(dom.uploadStatus, "Uploading file...");

  try {
    const result = await uploadFile(file);

    dom.uploadForm.reset();
    dom.uploadedUrl.value = result.url;

    setStatus(dom.uploadStatus, `Uploaded: ${result.url}`, "ok");
  } catch (error) {
    setStatus(dom.uploadStatus, getErrorMessage(error), "error");
  }
}

function maybeApplyUploadedMediaUrl(url) {
  if (!dom.postForm || typeof url !== "string") {
    return;
  }

  if (/\.pdf(?:$|[?#])/i.test(url)) {
    setFormValue(dom.postForm, "pdfUrl", url);
    setStatus(dom.postStatus, "PDF URL added to the post form.", "ok");
    return;
  }

  setFormValue(dom.postForm, "image", url);
}

async function uploadFile(file) {
  const pdf = file.type === 'application/pdf';
  if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG, WebP image or PDF.');
  if (file.size > (pdf ? 20 : 5) * 1024 * 1024) throw new Error(pdf ? 'PDFs must be 20 MB or smaller.' : 'Images must be 5 MB or smaller.');
  const dataUrl = await readFileAsDataUrl(file);

  return requestJson("/api/creator/upload", {
    method: "POST",
    body: JSON.stringify({
      filename: file.name,
      dataUrl,
    }),
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(new Error("Unable to read file.")));
    reader.readAsDataURL(file);
  });
}

async function addProject() {
  const formData = new FormData(dom.projectForm);
  const previous = structuredClone(state.content);
  const existing = state.editingProject === null ? {} : state.content.projects[state.editingProject];
  const project = { ...existing };
  for (const name of ["title", "type", "summary", "impact", "category", "status", "image"]) project[name] = String(formData.get(name) || "").trim();
  project.stack = splitCsv(formData.get("stack"));
  project.links = [];
  const customUrl = String(formData.get("linkUrl") || "").trim();
  if (customUrl) project.links.push({ label: String(formData.get("linkLabel") || "View project"), url: customUrl });
  for (const [field, label] of [["githubUrl", "GitHub"], ["demoUrl", "Live demo"]]) {
    const url = String(formData.get(field) || "").trim(); if (url) project.links.push({ label, url });
  }
  try {
    const file = dom.projectForm.elements.thumbnailFile.files[0];
    if (file) { setStatus(dom.saveStatus, "Uploading thumbnail…"); project.image = (await uploadFile(file)).url; }
    state.content.projects ||= [];
    if (state.editingProject === null) state.content.projects.unshift(project);
    else state.content.projects[state.editingProject] = project;
    if (await saveContent("Project saved.")) resetProjectForm();
    else state.content = previous;
  } catch (error) { state.content = previous; setStatus(dom.saveStatus, getErrorMessage(error), "error"); }
}

async function addPost(form = dom.postForm, writer = dom.postWriter, status = dom.postStatus) {
  const formData = new FormData(form);
  const collection = String(formData.get("kind") || "techBlogs");
  const title = String(formData.get("title") || "").trim();
  const pages = writer.getPages();
  const body = splitLines(writer.plainText());
  const pdfFile = form.elements.pdfFile?.files?.[0];
  const pdfUrl = String(formData.get("pdfUrl") || "").trim();

  if (writer.busy || (!writer.hasContent() && !pdfFile && !pdfUrl)) {
    setStatus(status, "Add story content or a PDF, and wait for photo uploads to finish.", "error");
    return;
  }

  const post = {
    title,
    slug: `${slugify(title) || "post"}-${crypto.randomUUID().slice(0,8)}`,
    date: String(formData.get("date") || new Date().toISOString().slice(0, 10)),
    readTime: String(formData.get("readTime") || `${Math.max(1, Math.ceil(writer.plainText().split(/\s+/).filter(Boolean).length / 200))} min read`).trim(),
    excerpt: String(formData.get("excerpt") || "").trim(),
    tags: splitCsv(formData.get("tags")),
    body,
    pages: writer.hasContent() ? pages : [],
  };
  const image = String(formData.get("image") || "").trim();

  if (image) {
    post.image = image;
  }

  if (pdfUrl) {
    post.pdfUrl = pdfUrl;
  }

  try {
    if (pdfFile) {
      setStatus(status, "Uploading PDF...");
      const result = await uploadFile(pdfFile);
      post.pdfUrl = result.url;
    }

    const previousContent = structuredClone(state.content);
    state.content[collection] = [post, ...(state.content[collection] || [])];

    const saved = await saveContent(
      collection === "techBlogs" ? "Tech post added." : "Travel post added.",
    );

    if (saved) {
      writer.clearDraft();
      form.reset();
      writer.load({}, form.id);
      setStatus(status, "Post published.", "ok");
    } else {
      state.content = previousContent;
      renderEditor();
      setStatus(status, "Could not save. Your writing is still here; try again.", "error");
    }
  } catch (error) {
    setStatus(status, getErrorMessage(error), "error");
  }
}

function renderPostManager() {
  if (!dom.postList || !state.content) {
    return;
  }

  const posts = getManagedPosts();

  if (!posts.length) {
    dom.postList.innerHTML = `
      <article class="managed-post-card empty-state">
        <p>No posts match the current view.</p>
      </article>
    `;
    setStatus(dom.postManagerStatus, "No posts to show.");
    return;
  }

  dom.postList.innerHTML = posts.map(createManagedPostCard).join("");
  setStatus(dom.postManagerStatus, `${posts.length} post${posts.length === 1 ? "" : "s"} shown.`, "ok");
}

function getManagedPosts() {
  const selectedCollection = dom.postFilter?.value || "all";
  const searchTerm = String(dom.postSearch?.value || "").trim().toLowerCase();
  const collections =
    selectedCollection === "all" ? ["techBlogs", "travelBlogs"] : [selectedCollection];

  return collections
    .flatMap((collection) =>
      getPostCollection(collection).map((post, index) => ({
        collection,
        index,
        post,
      })),
    )
    .filter(({ post }) => {
      if (!searchTerm) {
        return true;
      }

      const haystack = [
        post.title,
        post.excerpt,
        post.readTime,
        Array.isArray(post.tags) ? post.tags.join(" ") : "",
        post.pdfUrl,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(searchTerm);
    })
    .sort((left, right) => new Date(right.post.date).getTime() - new Date(left.post.date).getTime());
}

function createManagedPostCard(entry) {
  const { collection, index, post } = entry;
  const hasPdf = typeof post.pdfUrl === "string" && post.pdfUrl.trim();
  const hasImage = typeof post.image === "string" && post.image.trim();
  const bodyCount = Array.isArray(post.body) ? post.body.length : 0;
  const tags = Array.isArray(post.tags) ? post.tags : [];

  return `
    <article class="managed-post-card">
      <div class="managed-post-main">
        <div>
          <div class="story-head">
            <span class="tag-pill">${escapeHtml(getCollectionLabel(collection))}</span>
            <span class="status-pill">${escapeHtml(post.date || "No date")}</span>
          </div>
          <h4>${escapeHtml(post.title || "Untitled post")}</h4>
          <p>${escapeHtml(post.excerpt || "No excerpt yet.")}</p>
          <div class="story-meta">
            <span>${escapeHtml(post.readTime || "No read time")}</span>
            ${tags.length ? `<span>${escapeHtml(tags.join(" | "))}</span>` : ""}
            ${hasPdf ? `<span>PDF</span>` : ""}
            ${hasImage ? `<span>Image</span>` : ""}
            ${bodyCount ? `<span>${bodyCount} paragraph${bodyCount === 1 ? "" : "s"}</span>` : ""}
          </div>
        </div>
        <div class="managed-post-actions">
          <button
            class="button button-ghost"
            type="button"
            data-edit-post
            data-collection="${escapeAttribute(collection)}"
            data-index="${escapeAttribute(index)}"
          >
            Edit
          </button>
          ${
            hasPdf
              ? `<a class="button button-ghost" href="${escapeAttribute(post.pdfUrl)}" target="_blank" rel="noreferrer">Open PDF</a>`
              : ""
          }
          <button
            class="button button-danger"
            type="button"
            data-delete-post
            data-collection="${escapeAttribute(collection)}"
            data-index="${escapeAttribute(index)}"
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  `;
}

function beginEditPost(collection, index) {
  const post = getPost(collection, index);

  if (!post || !dom.postEditForm) {
    setStatus(dom.postManagerStatus, "That post could not be found.", "error");
    return;
  }

  state.editingPost = { collection, index };
  dom.postEditForm.hidden = false;
  dom.postEditHeading.textContent = post.title || "Edit post";
  setFormValue(dom.postEditForm, "kind", collection);
  setFormValue(dom.postEditForm, "date", post.date);
  setFormValue(dom.postEditForm, "title", post.title);
  setFormValue(dom.postEditForm, "excerpt", post.excerpt);
  setFormValue(dom.postEditForm, "readTime", post.readTime);
  setFormValue(dom.postEditForm, "tags", Array.isArray(post.tags) ? post.tags.join(", ") : "");
  dom.editWriter.load(post, `${collection}-${post.slug || index}`);
  setFormValue(dom.postEditForm, "pdfUrl", post.pdfUrl);
  setFormValue(dom.postEditForm, "image", post.image);

  if (dom.postEditForm.elements.pdfFile) {
    dom.postEditForm.elements.pdfFile.value = "";
  }

  setStatus(dom.postEditStatus, "Editing selected post.");
  dom.postEditForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function updatePost() {
  if (!state.editingPost || !dom.postEditForm) {
    setStatus(dom.postEditStatus, "Choose a post to edit first.", "error");
    return;
  }

  const { collection, index } = state.editingPost;
  const existingPost = getPost(collection, index);

  if (!existingPost) {
    setStatus(dom.postEditStatus, "That post no longer exists.", "error");
    cancelPostEdit();
    renderPostManager();
    return;
  }

  const formData = new FormData(dom.postEditForm);
  const nextCollection = String(formData.get("kind") || collection);
  const title = String(formData.get("title") || "").trim();
  const writer = dom.editWriter;
  const pages = writer.getPages();
  const body = splitLines(writer.plainText());
  const pdfFile = dom.postEditForm.elements.pdfFile?.files?.[0];
  const pdfUrl = String(formData.get("pdfUrl") || "").trim();
  const image = String(formData.get("image") || "").trim();

  if (!title) {
    setStatus(dom.postEditStatus, "Title is required.", "error");
    return;
  }

  if (writer.busy || (!writer.hasContent() && !pdfFile && !pdfUrl)) {
    setStatus(dom.postEditStatus, "Keep story content or a PDF, and wait for photo uploads to finish.", "error");
    return;
  }

  const updatedPost = {
    ...existingPost,
    title,
    slug: existingPost.slug || slugify(title),
    date: String(formData.get("date") || new Date().toISOString().slice(0, 10)),
    readTime: String(formData.get("readTime") || `${Math.max(1, Math.ceil(writer.plainText().split(/\s+/).filter(Boolean).length / 200))} min read`).trim(),
    excerpt: String(formData.get("excerpt") || "").trim(),
    tags: splitCsv(formData.get("tags")),
    body,
    pages: writer.hasContent() ? pages : [],
  };

  if (image) {
    updatedPost.image = image;
  } else {
    delete updatedPost.image;
  }

  if (pdfUrl) {
    updatedPost.pdfUrl = pdfUrl;
  } else {
    delete updatedPost.pdfUrl;
  }

  try {
    if (pdfFile) {
      setStatus(dom.postEditStatus, "Uploading replacement PDF...");
      const result = await uploadFile(pdfFile);
      updatedPost.pdfUrl = result.url;
    }

    const previousContent = structuredClone(state.content);
    if (nextCollection === collection) {
      getPostCollection(collection)[index] = updatedPost;
    } else {
      getPostCollection(collection).splice(index, 1);
      getPostCollection(nextCollection).unshift(updatedPost);
    }

    const saved = await saveContent("Post updated.");

    if (saved) {
      writer.clearDraft();
      cancelPostEdit();
      setStatus(dom.postManagerStatus, "Post updated.", "ok");
    } else {
      state.content = previousContent;
      renderEditor();
      setStatus(dom.postEditStatus, "Could not save. Your writing is still here; try again.", "error");
    }
  } catch (error) {
    setStatus(dom.postEditStatus, getErrorMessage(error), "error");
  }
}

async function deletePost(collection, index) {
  const post = getPost(collection, index);

  if (!post) {
    setStatus(dom.postManagerStatus, "That post could not be found.", "error");
    return;
  }

  const confirmed = window.confirm(`Delete "${post.title || "Untitled post"}"?`);

  if (!confirmed) {
    return;
  }

  getPostCollection(collection).splice(index, 1);

  if (
    state.editingPost &&
    state.editingPost.collection === collection &&
    state.editingPost.index === index
  ) {
    cancelPostEdit();
  }

  const saved = await saveContent("Post deleted.");

  if (saved) {
    setStatus(dom.postManagerStatus, "Post deleted.", "ok");
  }
}

function cancelPostEdit() {
  state.editingPost = null;

  if (dom.postEditForm) {
    dom.postEditForm.reset();
    dom.postEditForm.hidden = true;
  }

  setStatus(dom.postEditStatus, "");
}

function getPostCollection(collection) {
  if (!Array.isArray(state.content[collection])) {
    state.content[collection] = [];
  }

  return state.content[collection];
}

function getPost(collection, index) {
  if (!["techBlogs", "travelBlogs"].includes(collection) || !Number.isInteger(index)) {
    return null;
  }

  return getPostCollection(collection)[index] || null;
}

function getCollectionLabel(collection) {
  return collection === "travelBlogs" ? "Travel journal" : "Tech writing";
}

function saveJsonEditor() {
  try {
    const parsed = JSON.parse(dom.jsonEditor.value);
    state.content = parsed;
    void saveContent("JSON saved.");
  } catch (error) {
    setStatus(dom.saveStatus, getErrorMessage(error), "error");
  }
}

async function saveContent(message) {
  setStatus(dom.saveStatus, "Saving content...");

  try {
    await requestJson("/api/creator/content", {
      method: "POST",
      body: JSON.stringify({ content: state.content }),
    });
    dom.jsonEditor.value = JSON.stringify(state.content, null, 2);
    renderPostManager();
    renderProjectManager();
    setStatus(dom.saveStatus, message, "ok");
    return true;
  } catch (error) {
    setStatus(dom.saveStatus, getErrorMessage(error), "error");
    return false;
  }
}

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function slugify(value) {
  return String(value || "post")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function setStatus(element, message, tone = "") {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.style.color =
    tone === "error" ? "var(--accent-deep)" : tone === "ok" ? "var(--gold)" : "var(--muted)";
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}


function setupConsole() {
  document.querySelectorAll('[data-compose-mode]').forEach(button => button.addEventListener('click', () => {
    const form = button.closest('form');
    form.querySelector('.writing-studio').hidden = button.dataset.composeMode === 'pdf';
    form.querySelectorAll('[data-compose-mode]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  }));
  document.querySelectorAll('[data-console-tab]').forEach(button => {
    button.addEventListener('click', () => switchPanel(button.dataset.consoleTab));
    button.addEventListener('keydown', event => {
      const buttons = [...document.querySelectorAll('[data-console-tab]')];
      const direction = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
      if (!direction && !['Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? buttons[0] : event.key === 'End' ? buttons.at(-1) : buttons[(buttons.indexOf(button) + direction + buttons.length) % buttons.length];
      switchPanel(next.dataset.consoleTab); next.focus();
    });
  });
  switchPanel(location.hash.slice(1) || 'personal', false);
  window.addEventListener('hashchange', () => switchPanel(location.hash.slice(1), false));
  dom.travelForm.addEventListener('submit', event => { event.preventDefault(); void runSave(() => addPost(dom.travelForm, dom.travelWriter, dom.travelStatus)); });
  document.querySelector('#project-cancel').addEventListener('click', resetProjectForm);
  document.querySelector('#project-list').addEventListener('click', event => {
    const button = event.target.closest('[data-edit-project]');
    if (!button) return;
    const index = Number(button.dataset.editProject);
    const project = state.content.projects[index];
    resetProjectForm(); state.editingProject = index;
    for (const name of ['title', 'type', 'summary', 'impact', 'category', 'status', 'image']) setFormValue(dom.projectForm, name, project[name]);
    setFormValue(dom.projectForm, 'stack', (project.stack || []).join(', '));
    const links = project.links || [];
    const github = links.find(link => /github\.com/i.test(link.url));
    const demo = links.find(link => link.label === 'Live demo');
    const other = links.find(link => link !== github && link !== demo);
    setFormValue(dom.projectForm, 'githubUrl', github?.url);
    setFormValue(dom.projectForm, 'demoUrl', demo?.url);
    setFormValue(dom.projectForm, 'linkUrl', other?.url);
    setFormValue(dom.projectForm, 'linkLabel', other?.label);
    document.querySelector('#project-save').textContent = 'Save project changes';
    document.querySelector('#project-cancel').hidden = false;
    switchPanel('project');
  });
  document.querySelector('#add-skill-group').addEventListener('click', () => addSkillFields());
  document.querySelector('#skills-form').addEventListener('submit', async event => {
    event.preventDefault();
    const previous = structuredClone(state.content);
    const data = new FormData(event.target);
    state.content.professionalFocus = { ...state.content.professionalFocus, intro: String(data.get('intro') || ''), coreStrengths: splitLines(data.get('coreStrengths')), roleFit: splitLines(data.get('roleFit')) };
    state.content.skills = [...document.querySelectorAll('[data-skill-group]')].map(group => ({ group: group.querySelector('input').value.trim(), items: splitCsv(group.querySelector('textarea').value) })).filter(group => group.group && group.items.length);
    if (!await saveContent('Skills and introduction saved.')) state.content = previous;
  });
}

function switchPanel(name, updateHash = true) {
  const panel = document.querySelector(`#panel-${CSS.escape(name)}`);
  if (!panel) return;
  state.activePanel = name;
  document.querySelectorAll('.console-panel').forEach(item => item.hidden = item !== panel);
  document.querySelectorAll('[data-console-tab]').forEach(button => {
    const active = button.dataset.consoleTab === name;
    button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
  });
  if (updateHash) { history.replaceState(null, '', `#${name}`); window.scrollTo(0, 0); }
}

function resetProjectForm() {
  state.editingProject = null;
  dom.projectForm.reset();
  document.querySelector('#project-save').textContent = 'Add project';
  document.querySelector('#project-cancel').hidden = true;
}

function renderProjectManager() {
  document.querySelector('#project-list').innerHTML = (state.content.projects || []).map((project, index) => `<article class="managed-post-card"><div><span class="eyebrow">${escapeHtml(project.category)}</span><h4>${escapeHtml(project.title)}</h4></div><button class="button button-ghost" type="button" data-edit-project="${index}">Edit project</button></article>`).join('') || '<p>No projects yet. Create your first project in New project.</p>';
}

function renderSkillFields() {
  const form = document.querySelector('#skills-form');
  const focus = state.content.professionalFocus || {};
  setFormValue(form, 'intro', focus.intro);
  setFormValue(form, 'coreStrengths', (focus.coreStrengths || []).join('\n'));
  setFormValue(form, 'roleFit', (focus.roleFit || []).join('\n'));
  document.querySelector('#skill-fields').replaceChildren();
  (state.content.skills || []).forEach(addSkillFields);
}

function addSkillFields(group = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'skill-edit-group'; wrapper.dataset.skillGroup = '';
  wrapper.innerHTML = '<label><span>Group name</span><input placeholder="e.g. Systems engineering" required></label><label><span>Skills (separated by commas)</span><textarea rows="3" placeholder="C++, Asio, TCP/IP"></textarea></label><button class="text-link" type="button">Remove group</button>';
  wrapper.querySelector('input').value = group.group || '';
  wrapper.querySelector('textarea').value = (group.items || []).join(', ');
  wrapper.querySelector('button').addEventListener('click', () => wrapper.remove());
  document.querySelector('#skill-fields').append(wrapper);
}

async function runSave(action) {
  if (state.saving) return;
  state.saving = true;
  const buttons = [...document.querySelectorAll('#creator-dashboard button[type="submit"]')];
  buttons.forEach(button => button.disabled = true);
  try { await action(); }
  finally { state.saving = false; buttons.forEach(button => button.disabled = false); }
}
