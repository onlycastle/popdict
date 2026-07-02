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
| `DOWNLOADS_FN_URL`     | Supabase `downloads` function URL for recording and stats.    |
| `DOWNLOADS_RECORD_TOKEN` | Server-side token used by `/download/latest` to record clicks. |
| `DOWNLOADS_STATS_TOKEN` | Server-side token used by cron and the private dashboard.     |
| `DOWNLOADS_DASHBOARD_USER` | Basic Auth username for `/admin/downloads`.                |
| `DOWNLOADS_DASHBOARD_PASSWORD` | Basic Auth password for `/admin/downloads`.          |
| `CRON_SECRET`          | Vercel Cron bearer secret for `/api/cron/snapshot`.           |

## Routes

- `/` — hero, how-it-works, features, FAQ.
- `/auth/callback` — OAuth handoff page that opens `popdict://auth/callback` and leaves
  the browser on a completed page.
- `/privacy` — privacy policy (link this in the Google OAuth consent screen).
- `/terms` — terms of use.
- `/download/latest` — 302 redirect to the latest release's `.dmg` asset.
- `/admin/downloads` — private Basic Auth dashboard for download totals.
