import { renderDocument } from "./document.js";
const page = document.body.dataset.page || "home";
const THEME_STORAGE_KEY = "portfolio-theme";
const PAGE_FILES = {
  home: "index.html",
  professional: "professional.html",
  work: "work.html",
  journey: "journey.html",
  contact: "contact.html",
};
const routes = [
  { href: PAGE_FILES.home, label: "Home", page: "home" },
  { href: PAGE_FILES.professional, label: "About", page: "professional" },
  { href: PAGE_FILES.work, label: "Projects", page: "work" },
  { href: PAGE_FILES.journey, label: "Writing", page: "journey" },
  { href: PAGE_FILES.contact, label: "Contact", page: "contact" },
];

const state = {
  content: null,
  stories: [],
  projectFilter: "All",
  storyFilter: "all",
  theme: getInitialTheme(),
};

const shell = {
  header: document.querySelector("#site-header"),
  main: document.querySelector("#page-main"),
  footer: document.querySelector("#site-footer"),
  modal: document.querySelector("#story-modal"),
  modalContent: document.querySelector("#modal-content"),
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  applyTheme(state.theme, false);
  bindEvents();

  try {
    state.content = await loadContent();
    state.stories = buildStories(state.content);
    renderShell();
    renderPage();
    setupRevealAnimations();
    setupHeroMotion();
    void trackEvent("pageview", {
      path: window.location.pathname,
      title: document.title,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  } catch (error) {
    console.error(error);
    shell.main.innerHTML = `
      <section class="section section-framed">
        <div class="section-head">
          <span class="section-kicker">Portfolio unavailable</span>
          <h1>There was a problem loading the portfolio content.</h1>
          <p>Run the static build again or start the local preview server and refresh the page.</p>
        </div>
      </section>
    `;
  }
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const projectFilter = event.target.closest("[data-project-filter]");
    const storyFilter = event.target.closest("[data-story-filter]");
    const storyTrigger = event.target.closest("[data-story-slug]");
    const themeToggle = event.target.closest("[data-theme-toggle]");
    const trackedLink = event.target.closest("[data-track-link]");
    const closeButton = event.target.closest("#modal-close");

    if (themeToggle) {
      toggleTheme();
      return;
    }

    if (projectFilter) {
      state.projectFilter = projectFilter.dataset.projectFilter || "All";
      renderProjects();
      void trackEvent("project_filter", { filter: state.projectFilter, page });
      return;
    }

    if (storyFilter) {
      state.storyFilter = storyFilter.dataset.storyFilter || "all";
      renderStories();
      void trackEvent("story_filter", { filter: state.storyFilter, page });
      return;
    }

    if (storyTrigger) {
      openStoryModal(storyTrigger.dataset.storySlug || "");
      return;
    }

    if (closeButton) {
      closeStoryModal();
      return;
    }

    if (trackedLink && trackedLink.href) {
      void trackEvent("link_click", {
        label: trackedLink.dataset.trackLabel || trackedLink.textContent?.trim() || "link",
        href: trackedLink.href,
      });
    }
  });

  document.addEventListener("submit", (event) => {
    const form = event.target.closest("#contact-form");

    if (form) {
      void handleContactSubmit(event, form);
    }
  });

  shell.modal?.addEventListener("click", (event) => {
    if (event.target === shell.modal) {
      closeStoryModal();
    }
  });
}

function getInitialTheme() {
  return window.localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
}

function applyTheme(theme, persist = true) {
  state.theme = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = state.theme;

  if (persist) {
    window.localStorage.setItem(THEME_STORAGE_KEY, state.theme);
  }

  updateThemeToggle();
}

function toggleTheme() {
  const nextTheme = state.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  void trackEvent("theme_toggle", { theme: nextTheme, page });
}

function updateThemeToggle() {
  const toggle = document.querySelector("[data-theme-toggle]");

  if (!toggle) {
    return;
  }

  const nextTheme = state.theme === "dark" ? "light" : "dark";
  toggle.setAttribute("aria-label", `Switch to ${nextTheme} mode`);
  toggle.querySelector("[data-theme-label]").textContent =
    state.theme === "dark" ? "Dark" : "Light";
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });

  if (!response.ok) {
    throw new Error(`Request failed for ${url}`);
  }

  return response.json();
}

async function loadContent() {
  if (window.location.protocol !== "file:") {
    try {
      return await fetchJson("/api/content");
    } catch {
      // Static hosts do not have the API route, so fall back to the generated JSON file.
    }
  }

  return fetchJson("data/site-content.json");
}

function resolveHref(value = "") {
  if (!value) {
    return "#";
  }

  if (/^(?:[a-z]+:|#)/i.test(value)) {
    return value;
  }

  const [pathPart, hash = ""] = value.split("#");
  const suffix = hash ? `#${hash}` : "";

  if (pathPart === "/") {
    return `${PAGE_FILES.home}${suffix}`;
  }

  const cleanPath = pathPart.replace(/^\/+/, "");

  if (PAGE_FILES[cleanPath]) {
    return `${PAGE_FILES[cleanPath]}${suffix}`;
  }

  return `${cleanPath}${suffix}`;
}

function isHttpUrl(value = "") {
  return /^https?:\/\//i.test(value);
}

function isPlaceholderLink(value = "") {
  return (
    value.includes("your-username") ||
    value.includes("your-handle") ||
    value.includes("hello@yourdomain.dev")
  );
}

function getVisibleSocialLinks(profile) {
  return (profile.socialLinks || []).filter(
    (link) => typeof link?.url === "string" && link.url.trim() && !isPlaceholderLink(link.url),
  );
}

function buildMailtoUrl(profile, payload) {
  const subject = payload.interest
    ? `Portfolio inquiry: ${payload.interest}`
    : `Portfolio inquiry from ${payload.name || "a visitor"}`;
  const body = [
    `Hi ${profile.name},`,
    "",
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    `Company / team: ${payload.company || "Not provided"}`,
    `Reason: ${payload.interest || "General inquiry"}`,
    "",
    payload.message,
    "",
    "Sent from your portfolio contact form.",
  ].join("\n");

  return `mailto:${profile.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function buildStories(content) {
  const techStories = (content.techBlogs || []).map((story) => ({
    ...story,
    kind: "tech",
    label: "Tech writing",
  }));
  const travelStories = (content.travelBlogs || []).map((story) => ({
    ...story,
    kind: "travel",
    label: "Travel journal",
  }));

  return [...techStories, ...travelStories].sort(
    (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime(),
  );
}

function renderShell() {
  const { profile } = state.content;
  const initialsSource = (profile.avatarLabel || profile.name || "PA").trim();
  const initials =
    initialsSource.length <= 2
      ? initialsSource.toUpperCase()
      : initialsSource
          .split(" ")
          .map((chunk) => chunk[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();

  shell.header.innerHTML = `
    <div class="topbar">
      <a class="brand" href="${PAGE_FILES.home}" aria-label="Go to portfolio home" data-track-link data-track-label="Brand">
        <span class="brand-mark">${escapeHtml(initials)}</span>
        <span class="brand-copy">
          <strong>${escapeHtml(profile.name)}</strong>
          <small>Software developer</small>
        </span>
      </a>
      <nav class="topnav" aria-label="Primary">
        ${routes
          .map(
            (route) => `
              <a
                class="${route.page === page ? "is-active" : ""}"
                href="${route.href}"
                data-track-link
                data-track-label="Nav: ${escapeAttribute(route.label)}"
              >
                ${escapeHtml(route.label)}
              </a>
            `,
          )
          .join("")}
      </nav>
      <div class="nav-actions">
        <button class="theme-toggle" type="button" data-theme-toggle><span data-theme-label>Light</span></button>
        <a class="button button-ghost" href="${PAGE_FILES.contact}" data-track-link data-track-label="Header CTA">
          Let’s talk
        </a>
      </div>
    </div>
  `;

  shell.footer.innerHTML = `
    <div class="footer">
      <p>
        ${escapeHtml(profile.name)} | ${new Date().getFullYear()} |
        Built with curiosity. Made with care.
      </p>
      <div class="footer-links">
        <a href="${PAGE_FILES.work}" data-track-link data-track-label="Footer: Work">Selected work</a>
        <a href="${PAGE_FILES.journey}" data-track-link data-track-label="Footer: Journey">Writing and travel</a>
        <a href="${PAGE_FILES.contact}" data-track-link data-track-label="Footer: Contact">Contact</a>
      </div>
    </div>
  `;
  updateThemeToggle();
}

function renderPage() {
  if (page === "professional") {
    renderProfessionalPage();
    return;
  }

  if (page === "work") {
    renderWorkPage();
    return;
  }

  if (page === "journey") {
    renderJourneyPage();
    return;
  }

  if (page === "contact") {
    renderContactPage();
    return;
  }

  renderHomePage();
}

function renderHomePage() {
  const { profile, projects, skills, professionalFocus } = state.content;
  const social = getVisibleSocialLinks(profile);
  const headline = String(profile.headline || "").trim().split(/\s+/);
  const lastWord = headline.pop() || "";
  shell.main.innerHTML = `
    <section class="home-hero section">
      <div class="home-hero-copy"><span class="availability"><span></span>${escapeHtml(profile.availability)}</span>
        <p class="hero-intro">Hello, I’m ${escapeHtml(profile.name)}.</p>
        <h1>${escapeHtml(headline.join(" "))} <em>${escapeHtml(lastWord)}</em></h1><svg class="hero-ink-trail" viewBox="0 0 280 24" aria-hidden="true"><path d="M5 15C58 5 177 3 264 10M35 20C104 11 198 10 276 16" /></svg>
        <p class="hero-description">${escapeHtml(profile.subheadline)}</p>
        <div class="hero-actions"><a class="button" href="${PAGE_FILES.work}">Explore my projects <span aria-hidden="true">↗</span></a><a class="button button-ghost" href="${PAGE_FILES.contact}">Get in touch</a></div>
        <div class="hero-footnote"><span>${escapeHtml(profile.location)}</span>${social.filter(link => link.label !== 'Email').map(link => `<a href="${escapeAttribute(resolveHref(link.url))}" target="_blank" rel="noreferrer">${escapeHtml(link.label)} ↗</a>`).join('')}</div>
      </div>
      <div class="hero-portrait"><img src="${escapeAttribute(resolveHref(profile.photoUrl))}" alt="${escapeAttribute(profile.name)}" fetchpriority="high"></div><a class="hero-scroll" href="#selected-work"><span>Take a look around</span><span aria-hidden="true">↓</span></a>
    </section>
    <section class="proof-strip" aria-label="CloudForge project results">${profile.heroMetrics.map(metric => `<div><strong>${escapeHtml(metric.value)}</strong><span>${escapeHtml(metric.label)}</span></div>`).join('')}</section>
    <section class="section home-projects" id="selected-work"><div class="section-heading"><div><span class="eyebrow">Things I’ve built</span><h2>From a problem to a working system.</h2></div><a class="text-link" href="${PAGE_FILES.work}">All projects ↗</a></div>
      <div class="project-grid">${projects.slice(0,2).map(createProjectCard).join('')}</div>
    </section>
    <section class="section home-about"><div><span class="eyebrow">A little about me</span><h2>Curious about the details.<br>Focused on the outcome.</h2><p>${escapeHtml(professionalFocus.intro)}</p><a class="text-link" href="${PAGE_FILES.professional}">More about me ↗</a></div><div class="capability-list">${skills.slice(0,3).map((group,index) => `<article><span aria-hidden="true">✦</span><div><h3>${escapeHtml(group.group)}</h3><p>${escapeHtml(group.items.slice(0,4).join(' · '))}</p></div></article>`).join('')}</div></section>
    ${state.stories.length ? `<section class="section"><div class="section-heading"><div><span class="eyebrow">Away from the keyboard</span><h2>Things learned along the way.</h2></div><a class="text-link" href="${PAGE_FILES.journey}">All writing ↗</a></div><div class="card-grid">${state.stories.slice(0,2).map(createStoryCard).join('')}</div></section>` : ''}
    <section class="section contact-band"><div><span class="eyebrow">Let’s build something useful</span><h2>A good conversation is a great start.</h2></div><a class="button" href="${PAGE_FILES.contact}">Say hello ↗</a></section>`;
}

function renderProfessionalPage() {
  const { profile, professionalFocus, skills, achievements } = state.content;
  shell.main.innerHTML = `<section class="section page-intro"><span class="eyebrow">The person behind the projects</span><h1>Engineering with curiosity<br>and a sense of purpose.</h1><p>${escapeHtml(professionalFocus.intro)}</p><div class="hero-actions"><a class="button" href="${PAGE_FILES.work}">See my work ↗</a>${profile.resumeUrl && profile.resumeUrl !== '#' ? `<a class="button button-ghost" href="${escapeAttribute(resolveHref(profile.resumeUrl))}" target="_blank" rel="noreferrer">View resume</a>` : `<a class="button button-ghost" href="mailto:${escapeAttribute(profile.email)}?subject=Resume%20request">Request resume</a>`}</div></section>
    <section class="section"><div class="section-heading"><div><span class="eyebrow">Capabilities</span><h2>The tools behind the work.</h2></div></div><div class="skill-grid">${skills.map(group => `<article class="skill-card"><h3>${escapeHtml(group.group)}</h3><div class="chip-row">${group.items.map(item=>`<span class="chip">${escapeHtml(item)}</span>`).join('')}</div></article>`).join('')}</div></section>
    <section class="section"><div class="section-heading"><div><span class="eyebrow">Evidence in the projects</span><h2>Details that make a difference.</h2></div></div><div class="feature-grid">${achievements.map(item=>`<article class="feature-card"><span class="eyebrow">${escapeHtml(item.meta)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p></article>`).join('')}</div></section>
    <section class="section home-about"><div><span class="eyebrow">Working style</span><h2>Thoughtful implementation.<br>Clear communication.</h2></div><div><ul class="plain-list">${professionalFocus.coreStrengths.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul><div class="chip-row">${professionalFocus.roleFit.map(item=>`<span class="chip">${escapeHtml(item)}</span>`).join('')}</div></div></section>`;
}

function renderWorkPage() {
  shell.main.innerHTML = `<section class="section page-intro"><span class="eyebrow">Ideas, made real</span><h1>Built to solve.<br>Measured to improve.</h1><p>${escapeHtml(state.content.workOverview.intro)}</p></section><section class="section"><div class="filter-row" id="project-filters"></div><div class="project-grid" id="projects-grid"></div></section><section class="section contact-band"><div><span class="eyebrow">Behind the implementation</span><h2>Want to talk through the decisions?</h2></div><a class="button" href="${PAGE_FILES.contact}">Let’s talk ↗</a></section>`;
  renderProjects();
}

function renderJourneyPage() {
  shell.main.innerHTML = `<section class="section page-intro"><span class="eyebrow">Writing & journeys</span><h1>Notes from the code.<br>Stories from the road.</h1><p>${escapeHtml(state.content.journeyFocus.intro)}</p></section><section class="section"><div class="filter-row" id="story-filters"></div><div class="card-grid" id="stories-grid"></div></section>`;
  renderStories();
}

function renderContactPage() {
  const { profile, contactPrompts, contactDetails } = state.content;
  const hasResume = Boolean(profile.resumeUrl && profile.resumeUrl !== "#");
  const resumeHref = hasResume ? profile.resumeUrl : `mailto:${profile.email}?subject=Resume%20request`;
  const resumeValue = hasResume ? "Open resume" : "Available on request";
  const visibleSocialLinks = getVisibleSocialLinks(profile);

  shell.main.innerHTML = `
    <section class="section section-framed page-section">
      <div class="page-banner">
        <div class="section-head compact">
          <span class="section-kicker">Contact</span>
          <h1>Let’s make something worthwhile.</h1>
          <p>
            Have a role, a project, or a technical question in mind? I’d like to hear about it.
          </p>
        </div>
        <div class="page-banner-card">
          <span class="subsection-kicker">Response window</span>
          <h3>${escapeHtml(contactDetails.responseWindow)}</h3>
          <p>${escapeHtml(profile.location)}</p>
        </div>
      </div>
    </section>

    <section class="section split-layout contact-layout">
      <div>
        <div class="contact-cards">
          ${createContactCard("Email", profile.email, `mailto:${profile.email}`)}
          ${createContactCard("Phone", profile.phone, `tel:${profile.phone.replace(/\s+/g, "")}`)}
          ${createContactCard("Location", profile.location, PAGE_FILES.professional)}
          ${createContactCard("Resume", resumeValue, resumeHref)}
        </div>
        <div class="panel">
          <div class="subsection-head compact">
            <div>
              <span class="subsection-kicker">Best use</span>
              <h3>Good reasons to say hello</h3>
            </div>
          </div>
          <ul class="prompt-list">
            ${contactPrompts.map((prompt) => `<li>${escapeHtml(prompt)}</li>`).join("")}
          </ul>
        </div>
        <div class="panel">
          <div class="subsection-head compact">
            <div>
              <span class="subsection-kicker">Profiles</span>
              <h3>Professional links</h3>
            </div>
          </div>
          <div class="social-row">
            ${visibleSocialLinks
              .map(
                (link) => `
                  <a
                    class="social-link"
                    href="${escapeAttribute(resolveHref(link.url))}"
                    ${isHttpUrl(link.url) ? 'target="_blank" rel="noreferrer"' : ""}
                    data-track-link
                    data-track-label="Contact social: ${escapeAttribute(link.label)}"
                  >
                    <span>${escapeHtml(link.label)}</span>
                    <span>Open</span>
                  </a>
                `,
              )
              .join("")}
          </div>
        </div>
      </div>

      <form class="contact-form panel" id="contact-form">
        <div class="form-grid">
          <label>
            <span>Name</span>
            <input type="text" name="name" placeholder="Your name" required />
          </label>
          <label>
            <span>Email</span>
            <input type="email" name="email" placeholder="name@company.com" required />
          </label>
          <label>
            <span>Company / team</span>
            <input type="text" name="company" placeholder="Optional" />
          </label>
          <label>
            <span>Reason for reaching out</span>
            <select name="interest">
              <option value="Role opportunity">Role opportunity</option>
              <option value="Freelance or consulting">Freelance or consulting</option>
              <option value="Collaboration or writing">Collaboration or writing</option>
              <option value="Speaking or community">Speaking or community</option>
            </select>
          </label>
        </div>

        <label>
          <span>Message</span>
          <textarea name="message" rows="7" placeholder="Share the role, project, timeline, or context." required></textarea>
        </label>

        <div class="form-actions">
          <button class="button" type="submit">Send message</button>
          <p class="form-status" id="form-status" role="status" aria-live="polite"></p>
        </div>
      </form>
    </section>

  `;
}

function renderProjects() {
  const filterContainer = document.querySelector("#project-filters");
  const grid = document.querySelector("#projects-grid");

  if (!filterContainer || !grid) {
    return;
  }

  const { projects = [] } = state.content;
  const categories = ["All", ...new Set(projects.map((project) => project.category))];
  const visibleProjects =
    state.projectFilter === "All"
      ? projects
      : projects.filter((project) => project.category === state.projectFilter);

  filterContainer.innerHTML = categories
    .map(
      (category) => `
        <button
          aria-pressed="${category === state.projectFilter}"
          class="filter-chip ${category === state.projectFilter ? "is-active" : ""}"
          type="button"
          data-project-filter="${escapeAttribute(category)}"
        >
          ${escapeHtml(category)}
        </button>
      `,
    )
    .join("");

  grid.innerHTML = visibleProjects.map((project) => createProjectCard(project)).join("");
  setupRevealAnimations();
}

function renderStories() {
  const filterContainer = document.querySelector("#story-filters");
  const grid = document.querySelector("#stories-grid");

  if (!filterContainer || !grid) {
    return;
  }

  const filters = [
    { label: "All stories", value: "all" },
    { label: "Tech writing", value: "tech" },
    { label: "Travel journals", value: "travel" },
  ];
  const visibleStories =
    state.storyFilter === "all"
      ? state.stories
      : state.stories.filter((story) => story.kind === state.storyFilter);

  filterContainer.innerHTML = filters
    .map(
      (filter) => `
        <button
          aria-pressed="${filter.value === state.storyFilter}"
          class="filter-chip ${filter.value === state.storyFilter ? "is-active" : ""}"
          type="button"
          data-story-filter="${escapeAttribute(filter.value)}"
        >
          ${escapeHtml(filter.label)}
        </button>
      `,
    )
    .join("");

  grid.innerHTML = visibleStories.map((story) => createStoryCard(story)).join("") || `<div class="empty-state"><span class="eyebrow">A little space for what’s next</span><h3>No stories published here yet.</h3><p>In the meantime, explore the projects and the ideas behind them.</p><a class="text-link" href="${PAGE_FILES.work}">Explore projects ↗</a></div>`;
  setupRevealAnimations();
}

function createPathCard(href, title, description) {
  return `
    <a class="path-card reveal" href="${resolveHref(href)}" data-track-link data-track-label="Path: ${escapeAttribute(title)}">
      <span class="eyebrow">Explore</span>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
      <span class="text-link">Open page</span>
    </a>
  `;
}

function createRouteLink(href, title, description) {
  return `
    <a class="route-link reveal" href="${resolveHref(href)}" data-track-link data-track-label="Route: ${escapeAttribute(title)}">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(description)}</span>
    </a>
  `;
}

function createPreviewCard(title, description, href) {
  return `
    <a class="preview-card reveal" href="${resolveHref(href)}" data-track-link data-track-label="Preview: ${escapeAttribute(title)}">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(description)}</p>
    </a>
  `;
}

function createStoryPreview(story) {
  return `
    <article class="story-preview reveal">
      <span class="tag-pill">${escapeHtml(story.label)}</span>
      <strong>${escapeHtml(story.title)}</strong>
      <p>${escapeHtml(story.excerpt)}</p>
      <div class="project-links">
        <a class="text-link" href="${PAGE_FILES.journey}" data-track-link data-track-label="Story preview: ${escapeAttribute(story.title)}">
          Open journey page
        </a>
      </div>
    </article>
  `;
}

function createFeatureCard(title, description) {
  return `
    <article class="feature-card reveal">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(description)}</p>
    </article>
  `;
}

function createMetricCard(value, label) {
  return `
    <article class="metric-card reveal">
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(label)}</span>
    </article>
  `;
}

function createProjectCard(project) {
  return `
    <article class="project-card reveal">
      ${project.image ? `<img class="card-media" src="${escapeAttribute(resolveHref(project.image))}" alt="${escapeAttribute(project.title)} preview" loading="lazy" />` : ""}
      <div class="project-head">
        <div>
          <span class="eyebrow">${escapeHtml(project.type)}</span>
          <h3>${escapeHtml(project.title)}</h3>
        </div>
        <span class="status-pill">${escapeHtml(project.status)}</span>
      </div>
      <p class="project-copy">${escapeHtml(project.summary)}</p>
      <p><strong>Impact:</strong> ${escapeHtml(project.impact)}</p>
      <div class="chip-row">
        ${(project.stack || []).map((item) => `<span class="tag-pill">${escapeHtml(item)}</span>`).join("")}
      </div>
      <div class="project-links">
        ${(project.links || [])
          .map(
            (link) => `
              <a
                class="text-link"
                href="${escapeAttribute(resolveHref(link.url))}"
                data-track-link
                data-track-label="${escapeAttribute(project.title)}: ${escapeAttribute(link.label)}"
              >
                ${escapeHtml(link.label)}
              </a>
            `,
          )
          .join("")}
      </div>
    </article>
  `;
}

function createStoryCard(story) {
  const pdfUrl = getStoryPdfUrl(story);
  const tags = getStoryTags(story);

  return `
    <article class="story-card reveal">
      ${story.image ? `<img class="card-media" src="${escapeAttribute(resolveHref(story.image))}" alt="${escapeAttribute(story.title)} cover" loading="lazy" />` : ""}
      <div class="story-head">
        <span class="tag-pill">${escapeHtml(story.label)}</span>
        <span class="status-pill">${formatDate(story.date)}</span>
      </div>
      <h3>${escapeHtml(story.title)}</h3>
      <p>${escapeHtml(story.excerpt)}</p>
      <div class="story-meta">
        <span>${escapeHtml(story.readTime)}</span>
        ${tags.length ? `<span>${escapeHtml(tags.join(" | "))}</span>` : ""}
        ${pdfUrl ? `<span>PDF post</span>` : ""}
      </div>
      <div class="project-links">
        <button class="text-link" type="button" data-story-slug="${escapeAttribute(story.slug)}">
          ${pdfUrl ? "Open PDF post" : "Read the full piece"}
        </button>
      </div>
    </article>
  `;
}

function getStoryPdfUrl(story) {
  return typeof story.pdfUrl === "string" ? story.pdfUrl.trim() : "";
}

function getStoryTags(story) {
  return Array.isArray(story.tags) ? story.tags : [];
}

function createContactCard(title, value, href) {
  const resolvedHref = resolveHref(href);
  const isExternal = isHttpUrl(resolvedHref);

  return `
    <article class="contact-card reveal">
      <div class="contact-meta">
        <span class="eyebrow">${escapeHtml(title)}</span>
      </div>
      <p>${escapeHtml(value)}</p>
      <div class="project-links">
        <a
          class="text-link"
          href="${escapeAttribute(resolvedHref)}"
          ${isExternal ? 'target="_blank" rel="noreferrer"' : ""}
          data-track-link
          data-track-label="Contact: ${escapeAttribute(title)}"
        >
          Open
        </a>
      </div>
    </article>
  `;
}

async function handleContactSubmit(event, form) {
  event.preventDefault();
  const status = form.querySelector("#form-status");
  const formData = new FormData(form);
  const payload = {
    name: String(formData.get("name") || ""),
    email: String(formData.get("email") || ""),
    company: String(formData.get("company") || ""),
    interest: String(formData.get("interest") || ""),
    message: String(formData.get("message") || ""),
  };

  if (status) {
    status.textContent = "Opening your email app...";
    status.style.color = "var(--muted)";
  }

  try {
    const mailtoUrl = buildMailtoUrl(state.content.profile, payload);
    form.reset();

    if (status) {
      status.textContent = "Your message is ready in your email client.";
      status.style.color = "var(--teal)";
    }

    window.location.href = mailtoUrl;
    void trackEvent("contact_submission", { interest: payload.interest, page });
  } catch (error) {
    if (status) {
      status.textContent =
        error instanceof Error ? error.message : "Unable to prepare your email message.";
      status.style.color = "var(--accent-deep)";
    }
  }
}

function openStoryModal(slug) {
  const story = state.stories.find((entry) => entry.slug === slug);

  if (!story || !shell.modal || !shell.modalContent) {
    return;
  }

  const pdfUrl = getStoryPdfUrl(story);
  const resolvedPdfUrl = pdfUrl ? resolveHref(pdfUrl) : "";
  const tags = getStoryTags(story);
  const hasDocument = Array.isArray(story.pages) && story.pages.some(page => /<img\b/i.test(page.html || "") || String(page.html || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim());
  const storyBody = hasDocument
    ? `<div class="story-body rich-document">${renderDocument(story.pages, resolveHref)}</div>${pdfUrl ? `<p><a class="text-link" href="${escapeAttribute(resolvedPdfUrl)}" target="_blank" rel="noreferrer">Open attached PDF</a></p>` : ""}`
    : pdfUrl
    ? `
      <div class="pdf-viewer">
        <iframe
          class="pdf-frame"
          src="${escapeAttribute(resolvedPdfUrl)}"
          title="${escapeAttribute(`${story.title} PDF`)}"
        ></iframe>
        <p class="pdf-fallback">
          <a class="text-link" href="${escapeAttribute(resolvedPdfUrl)}" target="_blank" rel="noreferrer">
            Open PDF in a new tab
          </a>
        </p>
      </div>
    `
    : `
      <div class="story-body">
        ${(story.body || []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
      </div>
    `;

  shell.modal.classList.toggle("has-pdf", Boolean(pdfUrl));
  shell.modalContent.innerHTML = `
    <span class="eyebrow">${escapeHtml(story.label)}</span>
    <h3>${escapeHtml(story.title)}</h3>
    ${story.image ? `<img class="card-media story-modal-media" src="${escapeAttribute(resolveHref(story.image))}" alt="${escapeAttribute(story.title)} cover" />` : ""}
    <div class="story-meta">
      <span>${formatDate(story.date)}</span>
      <span>${escapeHtml(story.readTime)}</span>
      ${tags.length ? `<span>${escapeHtml(tags.join(" | "))}</span>` : ""}
      ${pdfUrl ? `<span>PDF post</span>` : ""}
    </div>
    ${storyBody}
  `;

  shell.modal.showModal();
  void trackEvent("story_open", { slug: story.slug, kind: story.kind, hasPdf: Boolean(pdfUrl), page });
}

function closeStoryModal() {
  if (shell.modal?.open) {
    shell.modal.close();
  }
}

function setupRevealAnimations() {
  const revealItems = document.querySelectorAll(".reveal");

  revealItems.forEach((element, index) => {
    element.style.transitionDelay = `${Math.min(index * 35, 240)}ms`;
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16 },
  );

  revealItems.forEach((item) => {
    if (!item.classList.contains("is-visible")) {
      observer.observe(item);
    }
  });
}

async function trackEvent(type, metadata = {}) {
  void type;
  void metadata;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function setupHeroMotion() {
  const hero = document.querySelector('.home-hero');
  if (!hero || window.matchMedia('(prefers-reduced-motion: reduce), (pointer: coarse)').matches) return;
  let frame = 0;
  hero.addEventListener('pointermove', event => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const rect = hero.getBoundingClientRect();
      hero.style.setProperty('--portrait-shift', `${((event.clientX - rect.left) / rect.width - .5) * 12}px`);
    });
  });
  hero.addEventListener('pointerleave', () => { cancelAnimationFrame(frame); hero.style.setProperty('--portrait-shift', '0px'); });
}
