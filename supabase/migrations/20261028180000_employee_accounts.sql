-- Employee sign-in identity on profiles.
--
-- This migration is not applied. Supabase Auth and PostgreSQL are not
-- connected. The running app stores scrypt password hashes in the
-- demonstration file, not in Postgres. Do not add a password column here.
-- When Supabase Auth is connected, passwords stay in Supabase Auth.

alter table public.profiles
  add column if not exists employee_id text,
  add column if not exists email text;

create unique index if not exists profiles_employee_id_lower_idx
  on public.profiles (lower(employee_id))
  where employee_id is not null and length(trim(employee_id)) > 0;

create unique index if not exists profiles_email_lower_idx
  on public.profiles (lower(email))
  where email is not null and length(trim(email)) > 0;
