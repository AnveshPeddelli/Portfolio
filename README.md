# Portfolio Site

A lightweight, content-driven multi-page portfolio for showing both professional signal and personal journey without pulling in a heavy framework.

## What is included

- A multi-page portfolio with dedicated Home, Professional, Work, Journey, and Contact pages
- Dynamic rendering from `data/site-content.json`
- First-party visitor tracking stored in `data/visitors.json`
- A built-in contact inbox stored in `data/messages.json`
- A private `/insights` dashboard protected by `PORTFOLIO_ADMIN_KEY`
- A hidden `/owner-console` content studio protected by the same owner key
- Light/dark mode switching stored in the visitor's browser

## Run locally

```powershell
npm start
```

For development with automatic restart:

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Main routes:

- `/`
- `/professional`
- `/work`
- `/journey`
- `/contact`
- `/insights`
- `/owner-console` hidden owner editor

## Set the admin key

In PowerShell:

```powershell
$env:PORTFOLIO_ADMIN_KEY = "Anvesh@123"
npm start
```

Then open `/insights` for visitor logs, or `/owner-console` for the private content editor.
Enter the same key when prompted.

Keep this key server-side. Do not put your real password inside browser JavaScript.

## How to add content professionally

Professionals usually separate the public website from a protected content system:

- Public pages read clean, structured content.
- A private editor changes projects, posts, links, profile details, and images.
- Media uploads are stored separately and referenced by URL.
- Credentials stay on the server or in deployment environment variables.

This project now follows that pattern in a lightweight way:

- Use `/owner-console` to edit profile basics, add projects, add tech/travel posts, upload images, or edit the full JSON.
- Uploaded images are saved to `public/uploads` and returned as URLs like `/uploads/example.webp`.
- Add that image URL to a project or post in the editor, and the public cards will render it automatically.
- Advanced edits still live in `data/site-content.json`, so you always have a readable source of truth.

## Customize the site

Edit `data/site-content.json` to update:

- Name, headline, and contact details
- Projects and achievements
- Skills and timeline entries
- Tech blog and travel blog content
- Social links and resume URL

## Deployment note

This version uses local JSON files for tracking and message storage, so it is best deployed on a Node host or VPS where the filesystem persists across restarts. On serverless platforms, file-based analytics and inbox storage may be temporary unless you replace them with a database or external service.
