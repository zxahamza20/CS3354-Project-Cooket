-- Cooket database schema. Run this once in the Supabase SQL Editor to create the tables.
-- ingredients_search is the ingredient list joined into one lowercase string, so ilike can search it.

create table recipes (
  id uuid default gen_random_uuid() primary key,
  url text unique not null,
  title text not null,
  ingredients text[] not null,
  ingredients_search text not null,
  steps text[] not null default '{}',
  text text,
  created_at timestamptz not null default now()
);

alter table recipes enable row level security;
grant select, insert, update on recipes to service_role;

