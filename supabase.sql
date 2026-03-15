create table if not exists public.push_subscriptions (
  email text not null,
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions
add column if not exists email text;

create index if not exists push_subscriptions_email_idx
on public.push_subscriptions (email);

alter table public.push_subscriptions enable row level security;

-- L'app écrit/efface via la service_role côté API Vercel.
-- On peut laisser sans policy publique.
