# Anvesh Portfolio

A multi-page portfolio with a cinematic homepage, project/work pages, writing, and a contact flow that works cleanly on static hosting.

## Public hosting shape

This repo is now set up for GitHub Pages style hosting:

- Source files live in `public/`
- Portfolio content lives in `data/site-content.json`
- Static deploy output is generated into `docs/`
- The hosted contact form falls back to a prefilled `mailto:` flow, so it does not need a server

## Local development

For the public site:

```powershell
npm run build
```

Then serve `docs/` with any static server.

For the older local Node workflow:

```powershell
npm start
```

That local server is optional now. It is only useful if you want the legacy private editor and local JSON message storage.

## Publish on GitHub Pages

1. Run:

```powershell
npm run build
```

2. Commit the updated `docs/` folder.
3. Push to GitHub.
4. In GitHub repo settings, open **Pages**.
5. Set the source to your main branch and the `/docs` folder.
6. Save, then wait for GitHub Pages to publish.

Your site will be served from the generated static files in `docs/`.

## Content updates

Edit:

```text
data/site-content.json
```

Then rebuild:

```powershell
npm run build
```

## Notes

- Do not commit real passwords, admin keys, inbox messages, or visitor logs to a public repo.
- The `public/assets/` folder is the right place for portfolio images that should ship with the site.
- If you want a custom domain later, add a `CNAME` file inside `docs/`.
