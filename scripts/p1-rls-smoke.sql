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
