import { copyFile, cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.join(ROOT_DIR, "data");
const DOCS_DIR = path.join(ROOT_DIR, "docs");
const PUBLIC_DATA_DIR = path.join(PUBLIC_DIR, "data");
const CONTENT_FILE = path.join(DATA_DIR, "site-content.json");
const PUBLIC_CONTENT_FILE = path.join(PUBLIC_DATA_DIR, "site-content.json");
const DOCS_CONTENT_DIR = path.join(DOCS_DIR, "data");
const DOCS_CONTENT_FILE = path.join(DOCS_CONTENT_DIR, "site-content.json");
const PUBLIC_FILES_TO_SKIP = new Set([
  "creator.html",
  "creator.js",
  "insights.html",
  "insights.js",
  "uploads",
]);

async function copyPublicToDocs() {
  const entries = await readdir(PUBLIC_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (PUBLIC_FILES_TO_SKIP.has(entry.name)) {
      continue;
    }

    const sourcePath = path.join(PUBLIC_DIR, entry.name);
    const targetPath = path.join(DOCS_DIR, entry.name);

    if (entry.isDirectory()) {
      await cp(sourcePath, targetPath, { recursive: true });
      continue;
    }

    await copyFile(sourcePath, targetPath);
  }
}

await mkdir(PUBLIC_DATA_DIR, { recursive: true });
await copyFile(CONTENT_FILE, PUBLIC_CONTENT_FILE);

await rm(DOCS_DIR, { recursive: true, force: true });
await mkdir(DOCS_DIR, { recursive: true });
await copyPublicToDocs();
await mkdir(DOCS_CONTENT_DIR, { recursive: true });
await copyFile(CONTENT_FILE, DOCS_CONTENT_FILE);
await writeFile(path.join(DOCS_DIR, ".nojekyll"), "");

console.log("Static portfolio build ready in ./docs");
