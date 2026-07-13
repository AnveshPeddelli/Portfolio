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
