-- GYMFORGE: схема Supabase (PostgreSQL) с RLS. Выполните в SQL Editor проекта.
create table public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  age int, sex text, height_cm numeric, weight_kg numeric,
  level text, experience_months int, goal text,
  days_per_week int, session_minutes int,
  equipment text[] default '{}', preferred text[] default '{}', limitations text[] default '{}',
  updated_at timestamptz default now()
);
create table public.user_settings (
  user_id uuid primary key references auth.users on delete cascade,
  rest_default_sec int default 90, vibrate boolean default true
);
create table public.exercises (
  id text primary key, name text not null, name_en text, equipment text not null,
  primary_muscles text[], secondary_muscles text[], step numeric default 2.5, bar numeric default 0, data jsonb
);
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null, split text not null, is_active boolean default false, created_at timestamptz default now()
);
create table public.program_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  position int not null, name text not null, focus text[] default '{}'
);
create table public.program_exercises (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.program_days on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  position int not null, exercise_id text not null references public.exercises,
  sets int, rep_min int, rep_max int, rest_sec int, rir int
);
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  program_id uuid references public.programs on delete set null,
  day_name text, started_at timestamptz not null, finished_at timestamptz, flags jsonb default '{}'
);
create table public.logged_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  exercise_id text not null references public.exercises,
  set_index int, weight numeric not null, reps int not null, rir int, logged_at timestamptz default now()
);
create table public.weight_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  exercise_id text not null references public.exercises,
  weight numeric not null, reason text, changed_at timestamptz default now()
);
create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  date date not null, weight_kg numeric not null, unique (user_id, date)
);

-- RLS: каждый видит и меняет только свои записи
do $$
declare t text;
begin
  foreach t in array array['profiles','user_settings','programs','program_days','program_exercises','workout_sessions','logged_sets','weight_changes','body_measurements']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
alter table public.exercises enable row level security;
create policy "catalog readable" on public.exercises for select using (true);
