const elements = {
  authForm: document.querySelector("#auth-form"),
  adminKey: document.querySelector("#admin-key"),
  authStatus: document.querySelector("#auth-status"),
  insightsShell: document.querySelector("#insights-shell"),
  recordsShell: document.querySelector("#records-shell"),
  metrics: document.querySelector("#insight-metrics"),
  topPages: document.querySelector("#top-pages"),
  topReferrers: document.querySelector("#top-referrers"),
  eventBreakdown: document.querySelector("#event-breakdown"),
  visitorRows: document.querySelector("#visitor-rows"),
  messageRows: document.querySelector("#message-rows"),
};

elements.authForm?.addEventListener("submit", handleSubmit);

async function handleSubmit(event) {
  event.preventDefault();

  const adminKey = elements.adminKey.value.trim();

  if (!adminKey) {
    elements.authStatus.textContent = "Enter the admin key first.";
    return;
  }

  elements.authStatus.textContent = "Loading private analytics...";

  try {
    const response = await fetch("/api/insights", {
      headers: {
        "x-admin-key": adminKey,
      },
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Unable to load insights.");
    }

    renderInsights(result.insights);
    elements.authStatus.textContent = `Updated ${formatDateTime(result.insights.generatedAt)}.`;
    elements.authStatus.style.color = "var(--teal)";
  } catch (error) {
    elements.authStatus.textContent =
      error instanceof Error ? error.message : "Unable to load insights.";
    elements.authStatus.style.color = "var(--accent-deep)";
  }
}

function renderInsights(insights) {
  elements.insightsShell.hidden = false;
  elements.recordsShell.hidden = false;

  const summaryCards = [
    { label: "Total events", value: insights.summary.totalEvents },
    { label: "Page views", value: insights.summary.totalPageViews },
    { label: "Unique visitors", value: insights.summary.uniqueVisitors },
    { label: "Contact submissions", value: insights.summary.contactSubmissions },
  ];

  elements.metrics.innerHTML = summaryCards
    .map(
      (item) => `
        <article class="insight-card reveal is-visible">
          <strong>${escapeHtml(item.value)}</strong>
          <span>${escapeHtml(item.label)}</span>
        </article>
      `,
    )
    .join("");

  elements.topPages.innerHTML = renderListCards(insights.topPages, "No pages tracked yet.");
  elements.topReferrers.innerHTML = renderListCards(
    insights.topReferrers,
    "No referrers recorded yet.",
  );
  elements.eventBreakdown.innerHTML = renderListCards(
    insights.eventBreakdown,
    "No event data recorded yet.",
  );

  elements.visitorRows.innerHTML = insights.recentVisitors.length
    ? insights.recentVisitors
        .map(
          (entry) => `
            <tr>
              <td>${escapeHtml(formatDateTime(entry.receivedAt))}</td>
              <td>${escapeHtml(entry.path)}</td>
              <td>${escapeHtml(entry.ip)}</td>
              <td>${escapeHtml(entry.type)}</td>
              <td>${escapeHtml(entry.referrer)}</td>
            </tr>
          `,
        )
        .join("")
    : `<tr><td colspan="5">No visitors logged yet.</td></tr>`;

  elements.messageRows.innerHTML = insights.recentMessages.length
    ? insights.recentMessages
        .map(
          (entry) => `
            <tr>
              <td>${escapeHtml(formatDateTime(entry.receivedAt))}</td>
              <td>${escapeHtml(entry.name)}</td>
              <td>${escapeHtml(entry.email)}</td>
              <td>${escapeHtml(entry.interest || "General")}</td>
              <td>${escapeHtml(entry.message)}</td>
            </tr>
          `,
        )
        .join("")
    : `<tr><td colspan="5">No contact submissions yet.</td></tr>`;
}

function renderListCards(items, emptyMessage) {
  if (!items.length) {
    return `<article class="list-card"><p>${escapeHtml(emptyMessage)}</p></article>`;
  }

  return items
    .map(
      (item) => `
        <article class="list-card">
          <div class="list-row">
            <strong>${escapeHtml(item.label)}</strong>
            <span class="status-pill">${escapeHtml(item.count)}</span>
          </div>
        </article>
      `,
    )
    .join("");
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
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
