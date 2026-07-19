-- Persist the study card shown with each question and record answer/review/
-- streak changes in one transaction. The RPC is service-role only.

alter table public.quiz_questions
  add column if not exists material jsonb;

create or replace function public.record_quiz_answer(
  p_question_id uuid,
  p_choice integer,
  p_touch_streak boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.quiz_questions%rowtype;
  quiz_row public.quizzes%rowtype;
  current_box integer;
  next_box integer;
  due_days integer;
  current_streak integer := 0;
  previous_answered_at timestamptz;
  answer_correct boolean;
  answered_now timestamptz := now();
begin
  if p_choice not between 0 and 3 then
    raise exception 'invalid quiz choice' using errcode = 'check_violation';
  end if;

  select questions.* into q
  from public.quiz_questions as questions
  where questions.id = p_question_id
  for update;

  if q.id is null then
    return jsonb_build_object('found', false);
  end if;

  select coalesce(preferences.streak, 0) into current_streak
  from public.quiz_preferences as preferences
  where preferences.user_id = q.user_id;
  current_streak := coalesce(current_streak, 0);

  if q.answered_at is not null then
    return jsonb_build_object(
      'found', true,
      'word', q.word,
      'normalizedWord', q.normalized_word,
      'userId', q.user_id,
      'correct', q.chosen_index = q.correct_index,
      'correctAnswer', q.options ->> q.correct_index,
      'streak', current_streak,
      'alreadyAnswered', true,
      'material', q.material
    );
  end if;

  answer_correct := p_choice = q.correct_index;
  select reviews.box into current_box
  from public.word_reviews as reviews
  where reviews.user_id = q.user_id
    and reviews.normalized_word = q.normalized_word;
  current_box := coalesce(current_box, 1);
  next_box := case when answer_correct then least(current_box + 1, 5) else 1 end;
  due_days := (array[1, 3, 7, 14, 30])[next_box];

  insert into public.word_reviews (
    user_id, normalized_word, box, next_due_at, updated_at
  ) values (
    q.user_id,
    q.normalized_word,
    next_box,
    answered_now + make_interval(days => due_days),
    answered_now
  )
  on conflict (user_id, normalized_word) do update
    set box = excluded.box,
        next_due_at = excluded.next_due_at,
        updated_at = excluded.updated_at;

  update public.quiz_questions
  set chosen_index = p_choice, answered_at = answered_now
  where id = q.id;

  select quizzes.* into quiz_row
  from public.quizzes as quizzes
  where quizzes.id = q.quiz_id
  for update;

  if quiz_row.id is not null and quiz_row.answered_at is null then
    update public.quizzes set answered_at = answered_now where id = quiz_row.id;
    if p_touch_streak then
      select previous_quiz.answered_at into previous_answered_at
      from public.quizzes as previous_quiz
      where previous_quiz.user_id = q.user_id
        and previous_quiz.source = 'email'
        and previous_quiz.sent_at < quiz_row.sent_at
      order by previous_quiz.sent_at desc
      limit 1;

      current_streak := case
        when previous_answered_at is null and exists (
          select 1 from public.quizzes as previous_quiz
          where previous_quiz.user_id = q.user_id
            and previous_quiz.source = 'email'
            and previous_quiz.sent_at < quiz_row.sent_at
        ) then 1
        else current_streak + 1
      end;

      update public.quiz_preferences
      set streak = current_streak, updated_at = answered_now
      where user_id = q.user_id;
    end if;
  end if;

  return jsonb_build_object(
    'found', true,
    'word', q.word,
    'normalizedWord', q.normalized_word,
    'userId', q.user_id,
    'correct', answer_correct,
    'correctAnswer', q.options ->> q.correct_index,
    'streak', current_streak,
    'alreadyAnswered', false,
    'material', q.material
  );
end;
$$;

revoke all on function public.record_quiz_answer(uuid, integer, boolean)
  from public, anon, authenticated;
grant execute on function public.record_quiz_answer(uuid, integer, boolean)
  to service_role;
