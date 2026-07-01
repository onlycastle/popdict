# Download Tracking — Runbook

## Deploy

1. Push the migration:      `supabase db push`
2. Deploy the function:     `supabase functions deploy downloads`
3. Set function secrets (values NOT in this repo):
   `supabase secrets set GITHUB_REPO=onlycastle/popdict DOWNLOADS_RECORD_TOKEN=<rec> DOWNLOADS_STATS_TOKEN=<admin>`
   (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are provided to functions automatically.)
4. Set Vercel (site) env for Production:
   `DOWNLOADS_FN_URL` = https://<project>.functions.supabase.co/downloads
   `DOWNLOADS_RECORD_TOKEN` = <rec>   (same value as the function's)
   `DOWNLOADS_STATS_TOKEN`  = <admin> (same value as the function's)
   `CRON_SECRET` is auto-provided by Vercel Cron; set it in project env if running the route manually.
5. Deploy the site (Vercel) so `/download/latest` and `/api/cron/snapshot` ship.

## Seed the first GitHub number

The stats endpoint reads the latest stored snapshot, so run one snapshot before
the first daily cron fires:

    curl -X POST "$DOWNLOADS_FN_URL" \
      -H 'content-type: application/json' -H "x-admin-token: $DOWNLOADS_STATS_TOKEN" \
      -d '{"action":"snapshot"}'

## Read the numbers

    source .env.local           # exports DOWNLOADS_FN_URL + DOWNLOADS_STATS_TOKEN
    ./scripts/download-stats.sh              # current totals
    ./scripts/download-stats.sh timeseries   # per-day cumulative series

## Notes

- `stats` is ≤24h stale by design (reads the latest daily snapshot, not live GitHub).
- The cron runs daily at 06:00 UTC (`vercel.json` → crons). Hobby plan allows daily.
- `record` is best-effort; a site outage loses events but never breaks downloads.
