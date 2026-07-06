-- In-app quiz sessions must not affect the weekly-email streak. Tag each quiz
-- with its origin so the streak logic can count only email quizzes.
alter table public.quizzes
  add column if not exists source text not null default 'email';
