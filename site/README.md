# PopDict landing page

Marketing + download site for PopDict, built with Next.js (App Router) for deployment on
Vercel. It also hosts the **privacy policy** (`/privacy`) required by the Google OAuth
consent screen, an OAuth handoff page (`/auth/callback`), and a `/download/latest` route
that redirects to the newest GitHub release DMG. Public support links point to GitHub
Issues.

## Local development

```bash
cd site
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_SITE_URL and GITHUB_REPO
npm run dev
```

## Environment

| Variable               | Purpose                                                        |
| ---------------------- | ------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL, used for SEO / Open Graph metadata.       |
| `GITHUB_REPO`          | `owner/repo` hosting PopDict releases. Powers `/download/latest` and GitHub Issues links. |

## Deploy (Vercel)

1. Import this `site/` directory as a Vercel project (set the root directory to `site`).
2. Add a **custom domain** — do this early: the same URL is used for the privacy-policy
   link in the Google OAuth consent screen and in the app, and changing it later means
   re-editing the OAuth config.
3. Set `NEXT_PUBLIC_SITE_URL` and `GITHUB_REPO` in the Vercel project env.
4. Web Analytics is wired via `@vercel/analytics`; enable Analytics in the Vercel
   dashboard for the project.

## Routes

- `/` — hero, how-it-works, features, FAQ.
- `/auth/callback` — OAuth handoff page that opens `popdict://auth/callback` and leaves
  the browser on a completed page.
- `/privacy` — privacy policy (link this in the Google OAuth consent screen).
- `/terms` — terms of use.
- `/download/latest` — 302 redirect to the latest release's `.dmg` asset.
