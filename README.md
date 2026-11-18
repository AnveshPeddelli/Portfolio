# Anvesh Portfolio

A multi-page portfolio with a cinematic homepage, project/work pages, writing, and a contact flow that works cleanly on static hosting.

## Hosting shape

This repo supports two hosting modes:

- Static hosting from `docs/`, useful for free GitHub Pages hosting.
- Online editable hosting with the Node server, useful when you want `/owner-console` to save posts and upload PDFs directly on the live site.

Source files live in `public/`, and the default seed content lives in `data/site-content.json`.

For free hosting, use the GitHub Pages workflow: run `/owner-console` locally, save your edits locally, build `docs/`, then commit and push.

## Local development

For the public site with npm:

```powershell
npm run build
```

If npm is not installed on your Windows PATH, use:

```powershell
.\build-github-pages.cmd
```

For the local owner console:

```powershell
.\start-portfolio.cmd
```

Then open:

```text
http://localhost:3000/owner-console
```

Set `PORTFOLIO_ADMIN_KEY` before starting the server if you want the private editor to unlock.

By default, `start-portfolio.cmd` uses the local owner key `dev`.

## Free GitHub Pages workflow

Use this when you want free hosting and are happy to edit locally before pushing.

1. Start the local editor:

```powershell
cd C:\Users\p.anvesh\source\repos\Portfolio\Portfolio
.\start-portfolio.cmd
```

2. Open the owner console:

```text
http://localhost:3000/owner-console
```

3. Enter the owner key:

```text
dev
```

4. Add, edit, or delete blog posts in **Blog manager**.

5. For PDF posts, upload the PDF locally through the console. Uploaded files are stored in:

```text
public/uploads/
```

6. Stop the local server with `Ctrl+C`.

7. Build the GitHub Pages output:

```powershell
.\build-github-pages.cmd
```

This copies the public site, `data/site-content.json`, and uploaded files into `docs/`.

8. Review and publish:

```powershell
git status
git add data public docs README.md package.json server.js scripts start-portfolio.cmd build-github-pages.cmd .gitignore
git commit -m "Update portfolio content"
git push origin main
```

GitHub Pages should be configured to serve the `main` branch from `/docs`.

### What to commit

For GitHub Pages, commit these when content changes:

```text
data/site-content.json
public/uploads/
docs/
```

Do not edit `docs/` by hand. Treat it as generated deploy output.

## Online editable deployment

Deploy the full Node app, not only the `docs/` folder.

Required environment variable:

```text
PORTFOLIO_ADMIN_KEY=choose-a-long-private-key
```

Recommended environment variables for persistent storage:

```text
PORTFOLIO_DATA_DIR=/path/to/persistent/data
PORTFOLIO_UPLOAD_DIR=/path/to/persistent/uploads
```

Use your host's persistent disk/volume feature for those two paths. The server stores:

```text
PORTFOLIO_DATA_DIR/site-content.json
PORTFOLIO_DATA_DIR/visitors.json
PORTFOLIO_DATA_DIR/messages.json
PORTFOLIO_UPLOAD_DIR/*.pdf
PORTFOLIO_UPLOAD_DIR/*.jpg
PORTFOLIO_UPLOAD_DIR/*.png
PORTFOLIO_UPLOAD_DIR/*.webp
```

Start command:

```text
npm start
```

After deployment:

1. Visit `https://your-domain/owner-console`.
2. Enter `PORTFOLIO_ADMIN_KEY`.
3. Add a tech or travel post.
4. Attach a PDF file, or paste a `PDF URL`.
5. Save the post.

The public site reads live content from `/api/content` when the Node server is running. Static builds still fall back to `data/site-content.json`.

## Publish on GitHub Pages

1. Run:

```powershell
.\build-github-pages.cmd
```

2. Commit the updated content, uploads, and `docs/` folder.
3. Push to GitHub.
4. In GitHub repo settings, open **Pages**.
5. Set the source to your main branch and the `/docs` folder.
6. Save, then wait for GitHub Pages to publish.

Your site will be served from the generated static files in `docs/`.

## Content updates

For static hosting, prefer the local owner console. If needed, you can edit:

```text
data/site-content.json
```

Then rebuild:

```powershell
.\build-github-pages.cmd
```

## Notes

- Do not commit real passwords, admin keys, inbox messages, or visitor logs to a public repo.
- The local owner key `dev` is only for your machine. Do not use it for online Node hosting.
- The `public/assets/` folder is the right place for portfolio images that should ship with the site.
- The `public/uploads/` folder is the right place for PDFs/images uploaded through the local owner console and intended for GitHub Pages.
- Online uploads should use persistent storage. Otherwise, files can disappear when the host redeploys or restarts the app.
- If you want a custom domain later, add a `CNAME` file inside `docs/`.

## Document writing studio

New and existing posts have a visual editor: headings, bold/italic/underline, lists,
quotes, code, alignment, links, tables, dividers, and undo/redo. Use **Photos** to
upload multiple JPG/PNG/WebP files (up to 5 MB each), or paste/drop photos into
the document. Edit captions directly beneath each photo.

Use **+ Page** to create chapters and the page controls to reorder or remove them.
**Preview** shows the full story. Pages are explicit sections, not automatic paper
pagination. Photos and formatting appear in the public blog reader and static build.
Existing plain-text and PDF posts remain supported; PDFs can accompany a document.

Drafts are saved locally in the same browser. After reopening a post, use
**Restore draft** to recover writing. Browser drafts are not published or synced
between devices. **Add post** or **Save changes** saves to the portfolio server;
the GitHub Pages build/commit/push workflow above still applies.

## Organized owner workspace

The owner console shows one section at a time. Use the sidebar (or the compact
section buttons on mobile) to switch between Personal info, New blog, New tech
blog, New project, Manage content, Skills & about, Media library, and Advanced.
Switching sections keeps unsaved form fields and writing in place.

- **Personal info:** name, headline, short bio, contact details, availability,
  social profiles, profile image and resume. Upload an image or PDF directly.
- **New blog / New tech blog:** independent writing editors and browser drafts.
  Choose **Write an article** or **Upload a PDF**; PDFs can also accompany text.
- **New project:** summary, impact, stack, repository, demo, other links and an
  uploaded thumbnail. Open an existing project from **Manage content** to edit it.
- **Skills & about:** introduction, strengths, target roles and editable skill groups.
- **Media library:** upload a file and copy its URL for use in another section.

The public site uses a responsive editorial layout, with light and dark themes,
project-led content and skills drawn from the documented work in this repository.

### Editing photos in a document

Click a photo to select it. Drag the corner handle, use the width slider (10–100%),
or choose a size preset. The image keeps its original proportions and stays within
the document width. The photo toolbar also provides alignment, an accessible image
description, and removal. Type captions directly below photos; captions follow the
photo width and alignment. Image changes support Undo/Redo, including Ctrl+Z and
Ctrl+Shift+Z. Width and alignment are retained in drafts, saved posts and previews.

The browser regression fixture is in `tests/editor-fixture.html`. With the local
server running, temporarily copy it to `public/.editor-qa.html` and open that URL.
It uses a mock uploader and does not write portfolio content. Remove the temporary
public copy before building the site.
