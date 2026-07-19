---
title: Site & downloads
last-verified: 2026-07-19
---

# Site & downloads

Next.js (App Router) site in `site/` — landing page, legal pages, OAuth
handoff (`site/app/auth/`), download redirect, and download stats. Deployed on
Vercel; the project's Root Directory is `site` (config:
[site/vercel.json](../../site/vercel.json)), so git pushes to `main`
auto-deploy and CLI deploys run from `site/`.

Note: popdict.app is an unrelated product — this project's site is not it.

## Download path

- [site/app/download/latest/route.ts](../../site/app/download/latest/route.ts)
  redirects to the newest GitHub release `.dmg` (`revalidate: 300`, so a new
  release goes live within ~5 minutes — no site redeploy).
- [record.ts](../../site/app/download/latest/record.ts) reports an attributed
  website redirect to the `downloads` edge function (env-token gated).
  Dashboard metrics intentionally keep redirect intent, GitHub DMG delivery,
  and updater ZIP delivery separate; they are not additive sources.
- Ops detail: [docs/download-tracking-runbook.md](../download-tracking-runbook.md).

## Stats & cron

- Admin dashboard: `site/app/admin/downloads/`.
- [site/app/api/cron/snapshot/](../../site/app/api/cron/snapshot/) snapshots
  download counts on a Vercel cron.
- CTA attribution uses bounded `source` and `cta` query tags. The landing page
  labels its nav, hero, and closing links; the GitHub README labels its link.
- Optional Slack redirect notifications hang off the `downloads` edge function
  ([supabase/functions/downloads/index.ts](../../supabase/functions/downloads/index.ts)).

## Gates that bite here

- Site lint is DEAD (Next 16 removed `next lint`) — learning L-007. Site
  gates are `cd site && npx tsc --noEmit && npx vitest run`; that is what
  `npm run test:ci` and CI execute.
- `next build` rewrites the tracked `site/next-env.d.ts` — learning L-008:
  revert it, never commit it.
