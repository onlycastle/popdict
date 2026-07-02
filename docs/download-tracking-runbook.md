# Download Tracking — Runbook

## Deploy

1. Push the migration:      `supabase db push`
2. Deploy the function:     `supabase functions deploy downloads --no-verify-jwt`
   (The function does its OWN token checks; callers send no Supabase JWT, so the
    gateway JWT check must be disabled or every request 401s at the gateway.)
3. Set function secrets (values NOT in this repo):
   `supabase secrets set GITHUB_REPO=onlycastle/popdict DOWNLOADS_RECORD_TOKEN=<rec> DOWNLOADS_STATS_TOKEN=<admin>`
   Optional Slack notifications for each successful website download record:
   `supabase secrets set SLACK_DOWNLOAD_WEBHOOK_URL=https://hooks.slack.com/services/...`
   (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are provided to functions automatically.)
4. Set Vercel (site) env for Production:
   `DOWNLOADS_FN_URL`      = https://<project>.functions.supabase.co/downloads
   `DOWNLOADS_RECORD_TOKEN` = <rec>   (same value as the function's)
   `DOWNLOADS_STATS_TOKEN`  = <admin> (same value as the function's)
   `DOWNLOADS_DASHBOARD_USER` = <user> for `/admin/downloads` Basic Auth
   `DOWNLOADS_DASHBOARD_PASSWORD` = <password> for `/admin/downloads` Basic Auth
   `CRON_SECRET`            = <secret> MUST be set in the Vercel project env — Vercel attaches
                               `Authorization: Bearer $CRON_SECRET` to scheduled cron requests;
                               without it the daily snapshot route 401s and the GitHub count never advances.
   `GITHUB_REPO`            = onlycastle/popdict
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

Or open the private dashboard:

    https://popdict.space/admin/downloads

It is protected by HTTP Basic Auth with `DOWNLOADS_DASHBOARD_USER` and
`DOWNLOADS_DASHBOARD_PASSWORD`.

## Notes

- `stats` is ≤24h stale by design (reads the latest daily snapshot, not live GitHub).
- The cron runs daily at 06:00 UTC (`vercel.json` → crons). Hobby plan allows daily.
- `record` is best-effort; a site outage loses events but never breaks downloads.
- Slack download notifications are opt-in via the `SLACK_DOWNLOAD_WEBHOOK_URL`
  function secret. Notification failures are logged and ignored after the event is
  stored, so Slack outages do not break download tracking.
