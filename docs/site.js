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
  { href: PAGE_FILES.professional, label: "Professional", page: "professional" },
  { href: PAGE_FILES.work, label: "Work", page: "work" },
  { href: PAGE_FILES.journey, label: "Journey", page: "journey" },
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
    state.content = await fetchJson("data/site-content.json");
    state.stories = buildStories(state.content);
    renderShell();
    renderPage();
    setupRevealAnimations();
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
  return "dark";
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
          <small>My Portfolio</small>
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
        <a class="button button-ghost" href="${PAGE_FILES.contact}" data-track-link data-track-label="Header CTA">
          Hire me
        </a>
      </div>
    </div>
  `;

  shell.footer.innerHTML = `
    <div class="footer">
      <p>
        ${escapeHtml(profile.name)} | ${new Date().getFullYear()} |
        Software, product thinking, and personal stories.
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
  const { profile, professionalFocus, journeyFocus, projects } = state.content;
  const featuredProjects = projects.slice(0, 3);
  const recentStories = state.stories.slice(0, 2);
  const heroPhoto = resolveHref(profile.photoUrl || "assets/anvesh-portfolio-pic.jpg");
  const firstName = (profile.name || "Anvesh").split(" ")[0] || "Anvesh";
  const visibleSocialLinks = getVisibleSocialLinks(profile);
  const services = [
    {
      number: "01",
      title: "Development",
      description:
        professionalFocus.coreStrengths[1] ||
        "Building lightweight full-stack experiences with a focus on performance.",
    },
    {
      number: "02",
      title: "Design",
      description:
        "Responsive interfaces, clean content structure, and product pages that feel easy to scan.",
    },
    {
      number: "03",
      title: "Systems",
      description:
        professionalFocus.coreStrengths[2] ||
        "Internal tools, dashboards, and automations that remove repetitive work.",
    },
  ];
  const portfolioTabs = ["Design", "Build", "Systems", "Writing"];

  shell.main.innerHTML = `
    <section class="section hero-section page-hero cinematic-hero">
      <img
        class="hero-photo"
        src="${escapeAttribute(heroPhoto)}"
        alt="${escapeAttribute(profile.name)} portrait"
        fetchpriority="high"
      />
      <div class="hero-vignette" aria-hidden="true"></div>
      <div class="hero-copy">
        <span class="eyebrow">My Portfolio</span>
        <h1>Hi, I am ${escapeHtml(firstName)}.</h1>
        <p class="hero-description">${escapeHtml(profile.subheadline)}</p>
        <div class="hero-actions">
          <a class="button" href="${PAGE_FILES.professional}" data-track-link data-track-label="Home: Professional">Show profile</a>
          <a class="button button-ghost" href="${PAGE_FILES.work}" data-track-link data-track-label="Home: Work">Know more</a>
        </div>
        <ul class="stack-list hero-stack">
          ${profile.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </div>
      <a class="scroll-cue" href="#services" aria-label="Jump to services">
        <span aria-hidden="true"></span>
      </a>
    </section>

    <section class="section section-framed portfolio-strip">
      <div class="portfolio-strip-head">
        <div>
          <span class="section-kicker">My Portfolio</span>
          <h2>Selected work with a sharper visual edge.</h2>
        </div>
        <div class="portfolio-tabs">
          ${portfolioTabs.map((tab) => `<span>${escapeHtml(tab)}</span>`).join("")}
        </div>
      </div>
      <div class="gallery-strip">
        <a
          class="gallery-card gallery-photo reveal"
          href="${PAGE_FILES.professional}"
          style="--gallery-image: url('${escapeAttribute(heroPhoto)}')"
          data-track-link
          data-track-label="Home gallery: Profile"
        >
          <span>Profile</span>
          <strong>${escapeHtml(profile.name)}</strong>
        </a>
        ${featuredProjects
          .map(
            (project, index) => `
              <a
                class="gallery-card gallery-card-${index + 1} reveal"
                href="${PAGE_FILES.work}"
                data-track-link
                data-track-label="Home gallery: ${escapeAttribute(project.title)}"
              >
                <span>${escapeHtml(project.category)}</span>
                <strong>${escapeHtml(project.title)}</strong>
              </a>
            `,
          )
          .join("")}
      </div>
    </section>

    <section class="section section-framed services-section" id="services">
      <div class="section-head centered">
        <span class="section-kicker">Our Services</span>
        <h2>What I can bring into a team.</h2>
        <p>${escapeHtml(professionalFocus.intro)}</p>
      </div>
      <div class="service-grid">
        ${services
          .map(
            (service) => `
              <article class="service-card reveal">
                <span class="service-icon" aria-hidden="true">${escapeHtml(service.number)}</span>
                <h3>${escapeHtml(service.title)}</h3>
                <p>${escapeHtml(service.description)}</p>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>

    <section class="section split-layout showcase-section">
      <div class="panel profile-panel">
        <div class="subsection-head compact">
          <div>
            <span class="subsection-kicker">Quick view</span>
            <h3>${escapeHtml(profile.availability)}</h3>
          </div>
        </div>
        <p class="quiet-copy">${escapeHtml(profile.headline)}</p>
        <div class="metric-band compact-metrics">
          ${profile.heroMetrics.map((metric) => createMetricCard(metric.value, metric.label)).join("")}
        </div>
        <div class="project-links">
          <a class="button" href="${PAGE_FILES.contact}" data-track-link data-track-label="Home: Contact CTA">Start a conversation</a>
        </div>
      </div>
      <div class="panel">
        <div class="subsection-head compact">
          <div>
            <span class="subsection-kicker">Featured work</span>
            <h3>Project snapshots</h3>
          </div>
        </div>
        <div class="preview-stack">
          ${featuredProjects.map((project) => createPreviewCard(project.title, project.impact, PAGE_FILES.work)).join("")}
        </div>
      </div>
    </section>

    <section class="section split-layout">
      <div class="panel">
        <div class="subsection-head compact">
          <div>
            <span class="subsection-kicker">Writing and journey</span>
            <h3>Recent notes from the journey side</h3>
          </div>
        </div>
        <div class="preview-stack">
          ${recentStories.map((story) => createStoryPreview(story)).join("")}
        </div>
      </div>
      <div class="panel">
        <div class="subsection-head compact">
          <div>
            <span class="subsection-kicker">Signal</span>
            <h3>Role fit</h3>
          </div>
        </div>
        <div class="chip-row">
          ${professionalFocus.roleFit.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("")}
        </div>
        <p class="quiet-copy">${escapeHtml(journeyFocus.intro)}</p>
        <div class="social-row">
          ${visibleSocialLinks
            .map(
              (link) => `
                <a
                  class="social-link"
                  href="${escapeAttribute(resolveHref(link.url))}"
                  ${isHttpUrl(link.url) ? 'target="_blank" rel="noreferrer"' : ""}
                  data-track-link
                  data-track-label="Home social: ${escapeAttribute(link.label)}"
                >
                  <span>${escapeHtml(link.label)}</span>
                  <span>Open</span>
                </a>
              `,
            )
            .join("")}
        </div>
      </div>
    </section>
  `;
}

function renderProfessionalPage() {
  const { profile, professionalFocus, workOverview, skills, achievements, timeline } = state.content;
  const highlightedTimeline = timeline.slice(0, 3);

  shell.main.innerHTML = `
    <section class="section section-framed page-section">
      <div class="page-banner">
        <div class="section-head compact">
          <span class="section-kicker">Professional profile</span>
          <h1>Professional, steady, and built for ownership.</h1>
          <p>${escapeHtml(professionalFocus.intro)}</p>
        </div>
        <div class="page-banner-card">
          <span class="subsection-kicker">At a glance</span>
          <h3>${escapeHtml(profile.availability)}</h3>
          <div class="metric-band compact-metrics">
            ${workOverview.metrics.slice(0, 2).map((item) => createMetricCard(item.value, item.label)).join("")}
          </div>
          <p>${escapeHtml(profile.location)}</p>
        </div>
      </div>
    </section>

    <section class="section split-layout">
      <div class="panel">
        <div class="subsection-head compact">
          <div>
            <span class="subsection-kicker">Core strengths</span>
            <h3>What I consistently bring</h3>
          </div>
        </div>
        <div class="strength-strip">
          ${professionalFocus.coreStrengths
            .slice(0, 3)
            .map(
              (strength, index) => `
                <article class="strength-card reveal">
                  <span class="eyebrow">Focus ${index + 1}</span>
                  <strong>${escapeHtml(strength)}</strong>
                </article>
              `,
            )
            .join("")}
        </div>
        <div class="chip-row">
          ${professionalFocus.roleFit.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("")}
        </div>
      </div>
      <div class="panel">
        <div class="subsection-head compact">
          <div>
            <span class="subsection-kicker">Operating style</span>
            <h3>Simple principles behind the work</h3>
          </div>
        </div>
        <div class="feature-grid">
          ${professionalFocus.operatingPrinciples
            .slice(0, 3)
            .map((item) => createFeatureCard(item.title, item.description))
            .join("")}
        </div>
      </div>
    </section>

    <section class="section split-layout">
      <div class="panel">
        <div class="subsection-head compact">
          <div>
            <span class="subsection-kicker">Capabilities</span>
            <h3>Skills grouped by working domain</h3>
          </div>
        </div>
        <div class="skill-grid">
          ${skills
            .map(
              (group) => `
                <article class="skill-card reveal">
                  <h3>${escapeHtml(group.group)}</h3>
                  <div class="chip-row">
                    ${group.items.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("")}
                  </div>
                </article>
              `,
            )
            .join("")}
        </div>
      </div>
      <div class="panel">
        <div class="subsection-head compact">
          <div>
            <span class="subsection-kicker">Signals</span>
            <h3>Proof points behind the profile</h3>
          </div>
        </div>
        <div class="achievement-grid">
          ${achievements
            .slice(0, 3)
            .map(
              (achievement) => `
                <article class="achievement-card reveal">
                  <span class="eyebrow">${escapeHtml(achievement.meta)}</span>
                  <h3>${escapeHtml(achievement.title)}</h3>
                  <p>${escapeHtml(achievement.description)}</p>
                </article>
              `,
            )
            .join("")}
        </div>
      </div>
    </section>

    <section class="section split-layout">
      <div class="panel">
        <div class="subsection-head compact">
          <div>
            <span class="subsection-kicker">Career arc</span>
            <h3>A short timeline</h3>
          </div>
        </div>
        <div class="timeline">
          ${highlightedTimeline
            .map(
              (entry) => `
                <article class="timeline-card reveal">
                  <div class="timeline-head">
                    <span class="eyebrow">${escapeHtml(entry.year)}</span>
                    <span class="status-pill">${escapeHtml(entry.subtitle)}</span>
                  </div>
                  <h3>${escapeHtml(entry.title)}</h3>
                  <p>${escapeHtml(entry.description)}</p>
                </article>
              `,
            )
            .join("")}
        </div>
      </div>
      <div class="panel stack-panel">
        <div>
          <span class="subsection-kicker">Professional note</span>
          <h3>Built to read like a strong candidate profile</h3>
        </div>
        <p class="quiet-copy">
          The goal is clarity: enough signal to show depth, without turning the page
          into a wall of explanation.
        </p>
        <a class="button" href="${PAGE_FILES.work}" data-track-link data-track-label="Professional CTA">See selected work</a>
      </div>
    </section>
  `;
}

function renderWorkPage() {
  const { professionalFocus, workOverview } = state.content;

  shell.main.innerHTML = `
    <section class="section section-framed page-section">
      <div class="page-banner">
        <div class="section-head compact">
          <span class="section-kicker">Selected work</span>
          <h1>Work that shows judgment, delivery, and range.</h1>
          <p>${escapeHtml(workOverview.intro)}</p>
        </div>
        <div class="page-banner-card">
          <span class="subsection-kicker">Snapshot</span>
          <div class="metric-band compact-metrics">
            ${workOverview.metrics.slice(0, 4).map((item) => createMetricCard(item.value, item.label)).join("")}
          </div>
        </div>
      </div>
    </section>

    <section class="section split-layout">
      <div class="panel">
        <div class="subsection-head compact">
          <div>
            <span class="subsection-kicker">What stands out</span>
            <h3>The delivery patterns across the portfolio</h3>
          </div>
        </div>
        <div class="chip-row">
          ${professionalFocus.coreStrengths
            .slice(0, 3)
            .map((item) => `<span class="chip">${escapeHtml(item)}</span>`)
            .join("")}
        </div>
        <div class="feature-grid">
          ${workOverview.deliveryThemes
            .slice(0, 2)
            .map((item) => createFeatureCard(item.title, item.description))
            .join("")}
        </div>
      </div>
      <div class="panel">
        <div class="subsection-head compact">
          <div>
            <span class="subsection-kicker">Reading lens</span>
            <h3>How to evaluate the projects</h3>
          </div>
        </div>
        <div class="feature-grid">
          ${workOverview.caseStudyLens
            .slice(0, 3)
            .map((item) => createFeatureCard(item.title, item.description))
            .join("")}
        </div>
      </div>
    </section>

    <section class="section section-framed">
      <div class="subsection-head">
        <div>
          <span class="subsection-kicker">Project index</span>
          <h3>Browse by category</h3>
        </div>
        <div class="filter-row" id="project-filters"></div>
      </div>
      <div class="card-grid project-grid" id="projects-grid"></div>
    </section>

    <section class="section split-layout">
      <div class="panel">
        <div class="subsection-head compact">
          <div>
            <span class="subsection-kicker">Why this page works</span>
            <h3>Compact on purpose</h3>
          </div>
        </div>
        <p class="quiet-copy">
          This page keeps the work readable: what shipped, why it mattered, and the
          kind of thinking behind it.
        </p>
      </div>
      <div class="panel stack-panel">
        <div>
          <span class="subsection-kicker">Next move</span>
          <h3>Want the deeper walkthrough?</h3>
        </div>
        <p class="quiet-copy">
          I can share the fuller case-study version in interviews, hiring loops, or
          project conversations.
        </p>
        <a class="button" href="${PAGE_FILES.contact}" data-track-link data-track-label="Work CTA">Request walkthroughs</a>
      </div>
    </section>
  `;

  renderProjects();
}

function renderJourneyPage() {
  const { techBlogs, travelBlogs, journeyFocus } = state.content;

  shell.main.innerHTML = `
    <section class="section section-framed page-section">
      <div class="page-banner">
        <div class="section-head compact">
          <span class="section-kicker">Journey and writing</span>
          <h1>Perspective beyond the project list.</h1>
          <p>${escapeHtml(journeyFocus.intro)}</p>
        </div>
        <div class="page-banner-card">
          <span class="subsection-kicker">Current mix</span>
          <div class="metric-band compact-metrics">
            ${createMetricCard(String(techBlogs.length), "Tech essays")}
            ${createMetricCard(String(travelBlogs.length), "Travel notes")}
            ${createMetricCard(String(journeyFocus.topicAreas.length), "Topics")}
            ${createMetricCard("1", "Consistent voice")}
          </div>
        </div>
      </div>
    </section>

    <section class="section split-layout">
      <div class="panel">
        <div class="subsection-head compact">
          <div>
            <span class="subsection-kicker">Themes</span>
            <h3>What this side adds</h3>
          </div>
        </div>
        <div class="feature-grid">
          ${journeyFocus.themes.slice(0, 3).map((item) => createFeatureCard(item.title, item.description)).join("")}
        </div>
      </div>
      <div class="panel">
        <div class="subsection-head compact">
          <div>
            <span class="subsection-kicker">Topics</span>
            <h3>Recurring subjects</h3>
          </div>
        </div>
        <div class="chip-row">
          ${journeyFocus.topicAreas.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("")}
        </div>
        <p class="quiet-copy">
          Writing and travel stay in the portfolio because they show perspective,
          communication, and curiosity without distracting from the professional side.
        </p>
      </div>
    </section>

    <section class="section section-framed">
      <div class="subsection-head">
        <div>
          <span class="subsection-kicker">Story library</span>
          <h3>Browse by stream</h3>
        </div>
        <div class="filter-row" id="story-filters"></div>
      </div>
      <div class="story-grid" id="stories-grid"></div>
    </section>

    <section class="section split-layout">
      <div class="panel">
        <div class="subsection-head compact">
          <div>
            <span class="subsection-kicker">Professional value</span>
            <h3>Why it belongs in the same portfolio</h3>
          </div>
        </div>
        <div class="feature-grid">
          ${journeyFocus.professionalValue
            .map((item) => createFeatureCard("Value", item))
            .join("")}
        </div>
      </div>
      <div class="panel stack-panel">
        <div>
          <span class="subsection-kicker">Stay connected</span>
          <h3>Open the journal or reach out</h3>
        </div>
        <p class="quiet-copy">
          Open a story for the longer version, or jump to contact if you want to talk
          about writing, product thinking, or collaboration.
        </p>
        <a class="button button-ghost" href="${PAGE_FILES.contact}" data-track-link data-track-label="Journey CTA">Start a conversation</a>
      </div>
    </section>
  `;

  renderStories();
}

function renderContactPage() {
  const { profile, contactPrompts, contactDetails } = state.content;
  const resumeHref = profile.resumeUrl === "#" ? `mailto:${profile.email}` : profile.resumeUrl;
  const resumeValue = profile.resumeUrl === "#" ? "Available on request" : "Open resume";
  const visibleSocialLinks = getVisibleSocialLinks(profile);

  shell.main.innerHTML = `
    <section class="section section-framed page-section">
      <div class="page-banner">
        <div class="section-head compact">
          <span class="section-kicker">Contact</span>
          <h1>Direct details and a clean way to reach me.</h1>
          <p>
            Use the form below or email me directly. On the hosted Git version,
            the form opens your email app with the message prefilled.
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
              <h3>What this contact page is built for</h3>
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

    <section class="section section-framed">
      <div class="section-head compact">
        <span class="section-kicker">Signals</span>
        <h2>Simple, direct, and ready to share.</h2>
      </div>
      <div class="feature-grid compact-grid">
        ${createFeatureCard("Email handoff", "The hosted contact form opens a prefilled email so people can reach you without any broken backend dependency.")}
        ${createFeatureCard("Git-hosted ready", "The public site can be deployed from this repository as static files, which keeps hosting simple and reliable.")}
        ${createFeatureCard("Best for", contactDetails.bestFor.slice(0, 2).join(" and "))}
      </div>
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
          class="filter-chip ${filter.value === state.storyFilter ? "is-active" : ""}"
          type="button"
          data-story-filter="${escapeAttribute(filter.value)}"
        >
          ${escapeHtml(filter.label)}
        </button>
      `,
    )
    .join("");

  grid.innerHTML = visibleStories.map((story) => createStoryCard(story)).join("");
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
        ${project.stack.map((item) => `<span class="tag-pill">${escapeHtml(item)}</span>`).join("")}
      </div>
      <div class="project-links">
        ${project.links
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
        <span>${escapeHtml(story.tags.join(" | "))}</span>
      </div>
      <div class="project-links">
        <button class="text-link" type="button" data-story-slug="${escapeAttribute(story.slug)}">
          Read the full piece
        </button>
      </div>
    </article>
  `;
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

  shell.modalContent.innerHTML = `
    <span class="eyebrow">${escapeHtml(story.label)}</span>
    <h3>${escapeHtml(story.title)}</h3>
    ${story.image ? `<img class="card-media story-modal-media" src="${escapeAttribute(resolveHref(story.image))}" alt="${escapeAttribute(story.title)} cover" />` : ""}
    <div class="story-meta">
      <span>${formatDate(story.date)}</span>
      <span>${escapeHtml(story.readTime)}</span>
      <span>${escapeHtml(story.tags.join(" | "))}</span>
    </div>
    <div class="story-body">
      ${story.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
    </div>
  `;

  shell.modal.showModal();
  void trackEvent("story_open", { slug: story.slug, kind: story.kind, page });
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
