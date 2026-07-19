# Contributing

Thanks for helping improve PopDict. Keep changes small, reviewable, and focused on
the issue or bug being addressed.

## Setup

```bash
npm install
cp .env.example .env.local
npm start
```

Cloud-backed features are optional and require a separately configured
compatible backend. Use `.env.example` as the public-safe template for local
variables.

## Pull Requests

- Open an issue first for larger behavior or product changes.
- Do not commit `.env`, Supabase `.temp`, signing material, build output, caches, or
  release artifacts.
- Include tests for logic changes when practical.
- Keep generated lockfile changes paired with the package change that produced them.
- Run the relevant checks before requesting review.

## Checks

Run these before requesting review. CI runs the same set, so a green local run
means a green PR:

```bash
npx tsc --noEmit
npm run lint
npm test
npm run harness:validate   # deterministic quality gates — CI fails without it
```

`npm run test:ci` runs everything CI runs in one shot (the app checks above plus
the site typecheck and tests), if you prefer a single command.

For site changes, also:

```bash
cd site
npm run build
```

## Support And Feedback

App users can send private feedback from PopDict’s menu bar or Settings. Use
GitHub Issues for public, reproducible bugs and contributor proposals. Do not include
secrets, tokens, private account data, or personal data in public issues.
