const THEME_STORAGE_KEY = "portfolio-theme";
const OWNER_KEY_STORAGE = "portfolio-owner-key";

const state = {
  ownerKey: window.sessionStorage.getItem(OWNER_KEY_STORAGE) || "",
  content: null,
  editingPost: null,
  theme: window.localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark",
};

const dom = {};

document.addEventListener("DOMContentLoaded", () => {
  collectDom();
  applyTheme(state.theme, false);
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
    saveProfile();
  });

  dom.uploadForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    void uploadMedia();
  });

  dom.projectForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    addProject();
  });

  dom.postForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    void addPost();
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
    void updatePost();
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
  setFormValue(dom.profileForm, "resumeUrl", profile.resumeUrl);

  dom.jsonEditor.value = JSON.stringify(state.content, null, 2);
  renderPostManager();
}

function setFormValue(form, name, value = "") {
  const field = form?.elements?.[name];

  if (field) {
    field.value = value || "";
  }
}

function saveProfile() {
  const formData = new FormData(dom.profileForm);
  state.content.profile = {
    ...state.content.profile,
    name: String(formData.get("name") || ""),
    location: String(formData.get("location") || ""),
    email: String(formData.get("email") || ""),
    phone: String(formData.get("phone") || ""),
    headline: String(formData.get("headline") || ""),
    subheadline: String(formData.get("subheadline") || ""),
    resumeUrl: String(formData.get("resumeUrl") || "#"),
  };

  void saveContent("Profile saved.");
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
    maybeApplyUploadedMediaUrl(result.url);
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

function addProject() {
  const formData = new FormData(dom.projectForm);
  const linkLabel = String(formData.get("linkLabel") || "View details").trim();
  const linkUrl = String(formData.get("linkUrl") || "/contact").trim();
  const project = {
    title: String(formData.get("title") || "").trim(),
    type: String(formData.get("type") || "Project").trim(),
    summary: String(formData.get("summary") || "").trim(),
    impact: String(formData.get("impact") || "Impact details coming soon.").trim(),
    category: String(formData.get("category") || "Selected Work").trim(),
    status: String(formData.get("status") || "Published").trim(),
    stack: splitCsv(formData.get("stack")),
    links: [{ label: linkLabel, url: linkUrl }],
  };
  const image = String(formData.get("image") || "").trim();

  if (image) {
    project.image = image;
  }

  state.content.projects = [project, ...(state.content.projects || [])];
  dom.projectForm.reset();
  void saveContent("Project added.");
}

async function addPost() {
  const formData = new FormData(dom.postForm);
  const collection = String(formData.get("kind") || "techBlogs");
  const title = String(formData.get("title") || "").trim();
  const body = splitLines(formData.get("body"));
  const pdfFile = dom.postForm.elements.pdfFile?.files?.[0];
  const pdfUrl = String(formData.get("pdfUrl") || "").trim();

  if (!body.length && !pdfFile && !pdfUrl) {
    setStatus(dom.postStatus, "Add body text or attach a PDF.", "error");
    return;
  }

  const post = {
    title,
    slug: slugify(title),
    date: String(formData.get("date") || new Date().toISOString().slice(0, 10)),
    readTime: String(formData.get("readTime") || "4 min read").trim(),
    excerpt: String(formData.get("excerpt") || "").trim(),
    tags: splitCsv(formData.get("tags")),
    body,
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
      setStatus(dom.postStatus, "Uploading PDF...");
      const result = await uploadFile(pdfFile);
      post.pdfUrl = result.url;
    }

    state.content[collection] = [post, ...(state.content[collection] || [])];
    dom.postForm.reset();

    const saved = await saveContent(
      collection === "techBlogs" ? "Tech post added." : "Travel post added.",
    );

    if (saved) {
      setStatus(dom.postStatus, post.pdfUrl ? "PDF post added." : "Post added.", "ok");
    }
  } catch (error) {
    setStatus(dom.postStatus, getErrorMessage(error), "error");
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
  setFormValue(dom.postEditForm, "body", Array.isArray(post.body) ? post.body.join("\n") : "");
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
  const body = splitLines(formData.get("body"));
  const pdfFile = dom.postEditForm.elements.pdfFile?.files?.[0];
  const pdfUrl = String(formData.get("pdfUrl") || "").trim();
  const image = String(formData.get("image") || "").trim();

  if (!title) {
    setStatus(dom.postEditStatus, "Title is required.", "error");
    return;
  }

  if (!body.length && !pdfFile && !pdfUrl) {
    setStatus(dom.postEditStatus, "Keep body text or a PDF URL on the post.", "error");
    return;
  }

  const updatedPost = {
    ...existingPost,
    title,
    slug: slugify(title),
    date: String(formData.get("date") || new Date().toISOString().slice(0, 10)),
    readTime: String(formData.get("readTime") || "4 min read").trim(),
    excerpt: String(formData.get("excerpt") || "").trim(),
    tags: splitCsv(formData.get("tags")),
    body,
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

    if (nextCollection === collection) {
      getPostCollection(collection)[index] = updatedPost;
    } else {
      getPostCollection(collection).splice(index, 1);
      getPostCollection(nextCollection).unshift(updatedPost);
    }

    state.editingPost = null;
    const saved = await saveContent("Post updated.");

    if (saved) {
      cancelPostEdit();
      setStatus(dom.postManagerStatus, "Post updated.", "ok");
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
    renderEditor();
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
