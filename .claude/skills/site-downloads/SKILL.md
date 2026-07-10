---
name: site-downloads
description: Use when changing the Next.js marketing site, the /download/latest redirect, download tracking, the admin stats dashboard, cron snapshots, or the OAuth handoff page.
---

# Site & Downloads Specialist

Domain map: [docs/llm-wiki/site-downloads.md](../../../docs/llm-wiki/site-downloads.md)
— read it first.

## Working rules

- The site's gates are `cd site && npx tsc --noEmit && npx vitest run`.
  `site/ npm run lint` is DEAD (learning L-007) — never "fix" CI by calling
  it.
- `next build` rewrites tracked `site/next-env.d.ts` (learning L-008):
  revert that diff, never commit it.
- The download button redirects to the latest GitHub release
  ([route.ts](../../../site/app/download/latest/route.ts), 5-min
  revalidate) — a stale download almost always means no release was cut,
  not a site bug.
- Match the shared design identity (amber, Fraunces + JetBrains Mono,
  dictionary-entry aesthetic) for any new UI.
- The Vercel project's Root Directory is `site` (config lives in
  `site/vercel.json`); pushes to `main` auto-deploy the site.

## Verification

Site tsc + vitest, `npm run harness:validate`, and a local
`npm --prefix site run dev` smoke of the changed page.
