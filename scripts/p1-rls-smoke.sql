\set ON_ERROR_STOP on

begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('11111111-1111-4111-8111-111111111111',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'alice@example.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('22222222-2222-4222-8222-222222222222',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'bob@example.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.saved_words (
  id, user_id, word, normalized_word, note
) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '11111111-1111-4111-8111-111111111111', 'Alpha', 'alpha', 'Alice private note'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   '22222222-2222-4222-8222-222222222222', 'Beta', 'beta', 'Bob private note');

insert into public.saved_word_tags (user_id, saved_word_id, tag) values
  ('11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Alice tag'),
  ('22222222-2222-4222-8222-222222222222',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Bob tag');

insert into public.word_reviews (user_id, normalized_word, box, next_due_at) values
  ('11111111-1111-4111-8111-111111111111', 'alpha', 2, now()),
  ('22222222-2222-4222-8222-222222222222', 'beta', 4, now());

insert into public.quiz_preferences (user_id, enabled, streak) values
  ('11111111-1111-4111-8111-111111111111', false, 0);

insert into public.quizzes (id, user_id, sent_at, source) values
  ('33333333-3333-4333-8333-333333333333',
   '11111111-1111-4111-8111-111111111111', now() - interval '2 minutes', 'app'),
  ('44444444-4444-4444-8444-444444444444',
   '11111111-1111-4111-8111-111111111111', now() - interval '1 minute', 'email');

insert into public.quiz_questions (
  id, quiz_id, user_id, word, normalized_word, options, correct_index
) values
  ('55555555-5555-4555-8555-555555555555',
   '33333333-3333-4333-8333-333333333333',
   '11111111-1111-4111-8111-111111111111',
   'Alpha', 'alpha', '["correct", "wrong 1", "wrong 2", "wrong 3"]'::jsonb, 0),
  ('66666666-6666-4666-8666-666666666666',
   '44444444-4444-4444-8444-444444444444',
   '11111111-1111-4111-8111-111111111111',
   'Alpha', 'alpha', '["correct", "wrong 1", "wrong 2", "wrong 3"]'::jsonb, 0);

do $$
declare
  app_result jsonb;
  email_result jsonb;
  persisted_streak integer;
begin
  app_result := public.record_quiz_answer(
    '55555555-5555-4555-8555-555555555555', 0, true
  );
  select streak into persisted_streak from public.quiz_preferences
  where user_id = '11111111-1111-4111-8111-111111111111';
  if (app_result ->> 'streak')::integer <> 0 or persisted_streak <> 0 then
    raise exception 'app answer unexpectedly changed the weekly streak';
  end if;

  email_result := public.record_quiz_answer(
    '66666666-6666-4666-8666-666666666666', 0, false
  );
  select streak into persisted_streak from public.quiz_preferences
  where user_id = '11111111-1111-4111-8111-111111111111';
  if (email_result ->> 'streak')::integer <> 1 or persisted_streak <> 1 then
    raise exception 'email answer did not advance the weekly streak';
  end if;
end
$$;

do $$
declare
  client_role text;
  licensed_table text;
  write_privilege text;
begin
  foreach client_role in array array['anon', 'authenticated'] loop
    foreach licensed_table in array array['public.word_translations', 'public.phrase_entries'] loop
      foreach write_privilege in array array['INSERT', 'UPDATE', 'DELETE'] loop
        if has_table_privilege(client_role, licensed_table, write_privilege) then
          raise exception '% unexpectedly has % on %',
            client_role, write_privilege, licensed_table;
        end if;
      end loop;
    end loop;
  end loop;
end
$$;

set local role anon;
select 1 / case when (select count(*) from public.word_translations) > 0 then 1 else 0 end;
select 1 / case when (select count(*) from public.phrase_entries) > 0 then 1 else 0 end;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select 1 / case when (select count(*) from public.saved_words) = 1 then 1 else 0 end;
select 1 / case when (select note from public.saved_words) = 'Alice private note' then 1 else 0 end;
select 1 / case when (select count(*) from public.saved_word_tags) = 1 then 1 else 0 end;
select 1 / case when (select count(*) from public.word_reviews) = 1 then 1 else 0 end;

do $$
declare
  blocked boolean := false;
begin
  begin
    insert into public.saved_word_tags (user_id, saved_word_id, tag) values (
      '22222222-2222-4222-8222-222222222222',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'Cross-account write'
    );
  exception when insufficient_privilege then
    blocked := true;
  end;
  if not blocked then
    raise exception 'cross-account tag insert unexpectedly succeeded';
  end if;
end
$$;

reset role;
rollback;
