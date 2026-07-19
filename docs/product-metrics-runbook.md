# Product Metrics — Runbook

PopDict measures a small activation funnel without storing lookup text, saved
words, email, account IDs, or stable device IDs. Review weekly while volume is
small; avoid percentage conclusions until a step has at least 30 eligible
sessions.

## Deploy

Apply the migration before shipping an app build that uses the new endpoints,
then deploy the affected Edge Functions:

```bash
supabase db push
supabase functions deploy downloads
supabase functions deploy feedback
supabase functions deploy events
```

`supabase/config.toml` disables gateway JWT verification where required; the
handlers validate and bound accepted payloads before service-role writes. Next,
deploy the site so its attributed download links and matching dashboard schema
go live. Publish the updated privacy page before or with the desktop release.

## Sources of truth

| Question | Source | Definition |
|---|---|---|
| How many DMG deliveries occurred? | GitHub release assets | Sum `.dmg` delivery counts. Do not add updater `.zip` files or website redirects. |
| Which link drove download intent? | `download_events` | Count redirects grouped by `source` and `cta`. A redirect may become a GitHub DMG delivery, so it is not an extra download. |
| How many accounts exist or were newly created? | `auth.users.created_at` | Supabase Auth is authoritative. An OAuth callback can be a returning sign-in and is not a signup. |
| Did a new user reach value? | `product_events` | A first-launch session with at least one `lookup_success`. |
| Did the save prompt convert? | `product_events` | Distinct sessions progressing from `save_intent_signed_out` to `oauth_completed`, then `pending_save_completed`. |
| Are users giving feedback? | `feedback_submissions` and `product_events` | Private submissions, plus opened-to-submitted completion. |

## Recommended weekly KPIs

1. **New accounts:** count of `auth.users` created that week. This is the signup
   outcome; Slack notifications and OAuth callbacks are not substitutes.
2. **First-session activation:** first-launch sessions with a successful lookup
   divided by all first-launch sessions.
3. **Authenticated save activation:** sessions with `pending_save_completed` divided
   by sessions with `save_intent_signed_out`. Inspect the intermediate
   `oauth_started` and `oauth_completed` steps to locate drop-off. Track
   `first_word_saved` separately as the new-account activation milestone.

Drivers are attributed website redirects by CTA and feedback completion
(`feedback_submitted` sessions / `feedback_opened` sessions). Guardrails are
DMG delivery freshness, Edge Function errors, and feedback submission errors.

Do not set a firm conversion target from the current one-account baseline.
Collect two weeks or at least 30 eligible sessions, whichever is later, then use
that period as the baseline. For each experiment, choose one funnel step and
seek a relative lift while ensuring downstream first-word saves do not fall.

## Data-quality limits

- GitHub reports cumulative asset deliveries, not unique people or successful
  installations. Re-downloads count again.
- Website redirect records are best-effort and only cover dates after tracking
  launched. Ad blockers, outages, and direct GitHub downloads can create gaps.
- Product events use a random ID shared across windows for one app launch. They
  support session funnels, not unique-user or retention analysis. The public
  client endpoint is schema-bounded and hourly rate-limited, but can still be
  spoofed, so use these metrics for product diagnosis, never billing, security,
  or account totals.
- Supabase Auth is the only authoritative account/signup source.

## Aggregate queries

Run these in the Supabase SQL editor. They return counts only—never export rows
from `auth.users` or feedback text into reports.

```sql
-- Event volume and unique sessions by day.
select occurred_at::date as day,
       event_name,
       count(*) as events,
       count(distinct session_id) as sessions
from public.product_events
where occurred_at >= now() - interval '30 days'
group by 1, 2
order by 1, 2;
```

```sql
-- Session-level activation funnel for a review window.
with session_steps as (
  select session_id,
         bool_or(event_name = 'first_launch') as first_launch,
         bool_or(event_name = 'lookup_success') as lookup_success,
         bool_or(event_name = 'save_intent_signed_out') as save_intent,
         bool_or(event_name = 'oauth_started') as oauth_started,
         bool_or(event_name = 'oauth_completed') as oauth_completed,
         bool_or(event_name = 'pending_save_completed') as pending_save_completed,
         bool_or(event_name = 'first_word_saved') as first_word_saved
  from public.product_events
  where occurred_at >= now() - interval '30 days'
  group by session_id
)
select count(*) filter (where first_launch) as first_launch_sessions,
       count(*) filter (where first_launch and lookup_success) as activated_sessions,
       count(*) filter (where save_intent) as save_intent_sessions,
       count(*) filter (where save_intent and oauth_started) as oauth_started_sessions,
       count(*) filter (where save_intent and oauth_completed) as oauth_completed_sessions,
       count(*) filter (where save_intent and pending_save_completed) as pending_save_completed_sessions,
       count(*) filter (where save_intent and first_word_saved) as first_word_saved_sessions
from session_steps;
```

```sql
-- Authoritative signup counts, aggregated by day.
select created_at::date as day, count(*) as new_accounts
from auth.users
where created_at >= now() - interval '30 days'
group by 1
order by 1;
```

```sql
-- Feedback volume only; read message content only when triaging feedback.
select created_at::date as day, category, count(*) as submissions
from public.feedback_submissions
where created_at >= now() - interval '30 days'
group by 1, 2
order by 1, 2;
```

For the private triage queue, review `feedback_submissions` rows whose `status`
is `pending`, then mark them `reviewed`, `promoted`, or `closed` in the Supabase
dashboard. Never paste contact details or feedback text into public issues
without the sender’s permission.

## Experiments to run in order

1. Compare landing-page CTA redirects (`nav`, `hero`, `closing`, and README)
   before changing acquisition copy.
2. Compare save intent → OAuth completed after the value copy change. Keep
   sign-in triggered by saving or reviewing words, not by lookup, translation,
   or app launch.
3. Review private feedback weekly and label repeated friction. Ask after value
   (the third successful lookup), not during onboarding.
4. After sufficient volume, test one signup message at a time. Use first word
   saved—not OAuth completion—as the downstream guardrail.
