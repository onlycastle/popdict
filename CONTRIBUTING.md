# Contributing

Thanks for helping improve PopDict. Keep changes small, reviewable, and focused on
the issue or bug being addressed.

## Setup

```bash
npm install
cp .env.example .env.local
npm start
```

Supabase is optional for basic dictionary lookup. Auth, saved words, and idioms need
the Supabase variables documented in [README.md](README.md).

## Pull Requests

- Open an issue first for larger behavior or product changes.
- Do not commit `.env`, Supabase `.temp`, signing material, build output, caches, or
  release artifacts.
- Include tests for logic changes when practical.
- Keep generated lockfile changes paired with the package change that produced them.
- Run the relevant checks before requesting review.

## Checks

```bash
npx tsc --noEmit
npm run lint
npm test
```

For site changes:

```bash
cd site
npm run build
```

## Support And Feedback

Use GitHub Issues for bugs, feature requests, and product feedback. Do not include
secrets, tokens, private account data, or personal data in public issues.
