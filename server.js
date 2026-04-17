import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const ADMIN_KEY = process.env.PORTFOLIO_ADMIN_KEY || "";
const ROOT_DIR = path.resolve(__dirname);
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.join(ROOT_DIR, "data");
const UPLOAD_DIR = path.join(PUBLIC_DIR, "uploads");
const CONTENT_FILE = path.join(DATA_DIR, "site-content.json");
const VISITORS_FILE = path.join(DATA_DIR, "visitors.json");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");
const ROUTE_MAP = {
  "/": "/index.html",
  "/professional": "/professional.html",
  "/work": "/work.html",
  "/journey": "/journey.html",
  "/contact": "/contact.html",
  "/insights": "/insights.html",
  "/owner-console": "/creator.html",
};
const JSON_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};
const IMAGE_MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const defaultCollection = { entries: [] };

async function ensureDataFiles() {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(UPLOAD_DIR, { recursive: true });

  const defaults = [
    [VISITORS_FILE, defaultCollection],
    [MESSAGES_FILE, defaultCollection],
  ];

  for (const [filePath, fallback] of defaults) {
    try {
      await readFile(filePath, "utf8");
    } catch {
      await writeJson(filePath, fallback);
    }
  }
}

async function readJson(filePath, fallback) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, JSON.stringify(value, null, 2));
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, JSON_HEADERS);
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": contentType,
  });
  response.end(body);
}

function getClientIp(request) {
  const forwarded = request.headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  return request.socket.remoteAddress || "unknown";
}

function getRequestBody(request, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    request.on("data", (chunk) => {
      size += chunk.length;

      if (size > maxBytes) {
        reject(new Error("Payload too large."));
        request.destroy();
        return;
      }

      chunks.push(chunk);
    });

    request.on("end", () => {
      if (!chunks.length) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("Invalid JSON payload."));
      }
    });

    request.on("error", reject);
  });
}

function getAdminKey(request, url) {
  return request.headers["x-admin-key"] || url.searchParams.get("key") || "";
}

function authorizeAdmin(request, url, response) {
  if (!ADMIN_KEY) {
    sendJson(response, 503, {
      ok: false,
      message: "Set PORTFOLIO_ADMIN_KEY before using the owner tools.",
    });
    return false;
  }

  if (getAdminKey(request, url) !== ADMIN_KEY) {
    sendJson(response, 401, {
      ok: false,
      message: "Unauthorized. Provide a valid owner key.",
    });
    return false;
  }

  return true;
}

function sanitizeFileStem(value) {
  const base = String(value || "portfolio-image")
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return base || "portfolio-image";
}

async function saveUploadedImage(payload) {
  if (typeof payload.dataUrl !== "string") {
    throw new Error("Upload must include an image data URL.");
  }

  const match = payload.dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=]+)$/i);

  if (!match) {
    throw new Error("Only JPG, PNG, and WebP images are supported.");
  }

  const [, mimeType, base64] = match;
  const extension = IMAGE_MIME_EXTENSIONS[mimeType.toLowerCase()];
  const buffer = Buffer.from(base64, "base64");

  if (buffer.byteLength > 5 * 1024 * 1024) {
    throw new Error("Images must be 5 MB or smaller.");
  }

  const stem = sanitizeFileStem(payload.filename);
  const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}-${stem}.${extension}`;
  const filePath = path.join(UPLOAD_DIR, fileName);

  await writeFile(filePath, buffer);

  return `/uploads/${fileName}`;
}

async function appendVisit(payload, request) {
  const visitors = await readJson(VISITORS_FILE, defaultCollection);
  const entry = {
    id: randomUUID(),
    receivedAt: new Date().toISOString(),
    type: typeof payload.type === "string" ? payload.type : "pageview",
    path: typeof payload.path === "string" ? payload.path : "/",
    title: typeof payload.title === "string" ? payload.title : "",
    referrer: request.headers.referer || payload.referrer || "Direct",
    ip: getClientIp(request),
    userAgent: request.headers["user-agent"] || "unknown",
    language: typeof payload.language === "string" ? payload.language : "",
    timezone: typeof payload.timezone === "string" ? payload.timezone : "",
    metadata: typeof payload.metadata === "object" && payload.metadata ? payload.metadata : {},
  };

  visitors.entries.push(entry);

  if (visitors.entries.length > 5000) {
    visitors.entries = visitors.entries.slice(-5000);
  }

  await writeJson(VISITORS_FILE, visitors);
  return entry;
}

function validateContactSubmission(payload) {
  const requiredFields = ["name", "email", "message"];

  for (const field of requiredFields) {
    const value = payload[field];

    if (typeof value !== "string" || !value.trim()) {
      return `${field} is required.`;
    }
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(payload.email.trim())) {
    return "Please enter a valid email address.";
  }

  return "";
}

async function appendMessage(payload, request) {
  const messages = await readJson(MESSAGES_FILE, defaultCollection);
  const entry = {
    id: randomUUID(),
    receivedAt: new Date().toISOString(),
    name: payload.name.trim(),
    email: payload.email.trim(),
    company: typeof payload.company === "string" ? payload.company.trim() : "",
    interest: typeof payload.interest === "string" ? payload.interest.trim() : "",
    message: payload.message.trim(),
    ip: getClientIp(request),
    userAgent: request.headers["user-agent"] || "unknown",
  };

  messages.entries.push(entry);

  if (messages.entries.length > 1000) {
    messages.entries = messages.entries.slice(-1000);
  }

  await writeJson(MESSAGES_FILE, messages);
  return entry;
}

function sortCounts(items) {
  return Object.entries(items)
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);
}

function computeInsights(visitors, messages) {
  const pageViews = visitors.entries.filter((entry) => entry.type === "pageview");
  const topPages = {};
  const topReferrers = {};
  const eventBreakdown = {};

  for (const entry of visitors.entries) {
    topPages[entry.path] = (topPages[entry.path] || 0) + 1;
    topReferrers[entry.referrer] = (topReferrers[entry.referrer] || 0) + 1;
    eventBreakdown[entry.type] = (eventBreakdown[entry.type] || 0) + 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalEvents: visitors.entries.length,
      totalPageViews: pageViews.length,
      uniqueVisitors: new Set(pageViews.map((entry) => entry.ip)).size,
      contactSubmissions: messages.entries.length,
    },
    topPages: sortCounts(topPages),
    topReferrers: sortCounts(topReferrers),
    eventBreakdown: sortCounts(eventBreakdown),
    recentVisitors: visitors.entries.slice(-15).reverse(),
    recentMessages: messages.entries.slice(-10).reverse(),
  };
}

function resolveStaticFile(requestPath) {
  const cleanPath =
    requestPath.length > 1 && requestPath.endsWith("/")
      ? requestPath.slice(0, -1)
      : requestPath;
  const publicPath = ROUTE_MAP[cleanPath] || cleanPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, publicPath.replace(/^\/+/, "")));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return "";
  }

  return filePath;
}

async function serveStaticFile(requestPath, response) {
  const filePath = resolveStaticFile(requestPath);

  if (!filePath) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const content = await readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[extension] || "application/octet-stream";

    response.writeHead(200, {
      "Cache-Control":
        extension === ".html" || extension === ".css" || extension === ".js"
          ? "no-store"
          : "public, max-age=604800",
      "Content-Type": contentType,
    });
    response.end(content);
  } catch {
    sendText(response, 404, "Not found.");
  }
}

await ensureDataFiles();

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/api/content") {
      const content = await readJson(CONTENT_FILE, {});
      sendJson(response, 200, content);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/creator/content") {
      if (!authorizeAdmin(request, url, response)) {
        return;
      }

      const content = await readJson(CONTENT_FILE, {});
      sendJson(response, 200, { ok: true, content });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/creator/content") {
      if (!authorizeAdmin(request, url, response)) {
        return;
      }

      const payload = await getRequestBody(request, 2 * 1024 * 1024);

      if (!payload.content || typeof payload.content !== "object" || Array.isArray(payload.content)) {
        sendJson(response, 400, {
          ok: false,
          message: "Content payload must include a JSON object.",
        });
        return;
      }

      await writeJson(CONTENT_FILE, payload.content);
      sendJson(response, 200, {
        ok: true,
        message: "Portfolio content saved.",
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/creator/upload") {
      if (!authorizeAdmin(request, url, response)) {
        return;
      }

      const payload = await getRequestBody(request, 8 * 1024 * 1024);
      const uploadedUrl = await saveUploadedImage(payload);
      sendJson(response, 201, {
        ok: true,
        url: uploadedUrl,
        message: "Image uploaded.",
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/track") {
      const payload = await getRequestBody(request);
      await appendVisit(payload, request);
      sendJson(response, 202, { ok: true });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/contact") {
      const payload = await getRequestBody(request);
      const validationError = validateContactSubmission(payload);

      if (validationError) {
        sendJson(response, 400, { ok: false, message: validationError });
        return;
      }

      await appendMessage(payload, request);
      sendJson(response, 201, {
        ok: true,
        message: "Thanks for reaching out. Your note is safely stored.",
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/insights") {
      if (!authorizeAdmin(request, url, response)) {
        return;
      }

      const [visitors, messages] = await Promise.all([
        readJson(VISITORS_FILE, defaultCollection),
        readJson(MESSAGES_FILE, defaultCollection),
      ]);

      sendJson(response, 200, {
        ok: true,
        insights: computeInsights(visitors, messages),
      });
      return;
    }

    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        Allow: "GET, POST, OPTIONS",
      });
      response.end();
      return;
    }

    await serveStaticFile(url.pathname, response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    sendJson(response, 500, { ok: false, message });
  }
});

server.listen(PORT, () => {
  console.log(`Portfolio server running at http://localhost:${PORT}`);
});
