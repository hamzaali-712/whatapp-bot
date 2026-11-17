create table if not exists public.whatsapp_auth (
  session_id text not null,
  key text not null,
  value text not null,
  updated_at timestamptz not null default now(),
  primary key (session_id, key)
);

alter table public.whatsapp_auth enable row level security;

-- Do not grant anon/authenticated policies. The backend service-role client
-- bypasses RLS and must remain server-only.
