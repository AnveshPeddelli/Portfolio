const THEME_STORAGE_KEY = "portfolio-theme";
const OWNER_KEY_STORAGE = "portfolio-owner-key";

const state = {
  ownerKey: window.sessionStorage.getItem(OWNER_KEY_STORAGE) || "",
  content: null,
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
    void uploadImage();
  });

  dom.projectForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    addProject();
  });

  dom.postForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    addPost();
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

async function uploadImage() {
  const file = dom.uploadForm.elements.image.files[0];

  if (!file) {
    setStatus(dom.uploadStatus, "Choose an image first.", "error");
    return;
  }

  setStatus(dom.uploadStatus, "Uploading image...");

  try {
    const dataUrl = await readFileAsDataUrl(file);
    const result = await requestJson("/api/creator/upload", {
      method: "POST",
      body: JSON.stringify({
        filename: file.name,
        dataUrl,
      }),
    });

    dom.uploadForm.reset();
    dom.uploadedUrl.value = result.url;
    setStatus(dom.uploadStatus, `Uploaded: ${result.url}`, "ok");
  } catch (error) {
    setStatus(dom.uploadStatus, getErrorMessage(error), "error");
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(new Error("Unable to read image.")));
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

function addPost() {
  const formData = new FormData(dom.postForm);
  const collection = String(formData.get("kind") || "techBlogs");
  const title = String(formData.get("title") || "").trim();
  const post = {
    title,
    slug: slugify(title),
    date: String(formData.get("date") || new Date().toISOString().slice(0, 10)),
    readTime: String(formData.get("readTime") || "4 min read").trim(),
    excerpt: String(formData.get("excerpt") || "").trim(),
    tags: splitCsv(formData.get("tags")),
    body: splitLines(formData.get("body")),
  };
  const image = String(formData.get("image") || "").trim();

  if (image) {
    post.image = image;
  }

  state.content[collection] = [post, ...(state.content[collection] || [])];
  dom.postForm.reset();
  void saveContent(collection === "techBlogs" ? "Tech post added." : "Travel post added.");
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
  } catch (error) {
    setStatus(dom.saveStatus, getErrorMessage(error), "error");
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
