-- Keep the database contract aligned with the privacy-minimal P1 adoption
-- events accepted by the Edge Function and emitted by the desktop app.

alter table public.product_events
  drop constraint if exists product_events_event_name_check,
  add constraint product_events_event_name_check check (event_name in (
    'first_launch',
    'lookup_success',
    'save_intent_signed_out',
    'oauth_started',
    'oauth_completed',
    'pending_save_completed',
    'first_word_saved',
    'feedback_opened',
    'feedback_submitted',
    'lookup_recovery_used',
    'phrase_lookup_success',
    'offline_cache_hit',
    'saved_words_exported',
    'review_reminder_enabled',
    'review_session_completed'
  ));
