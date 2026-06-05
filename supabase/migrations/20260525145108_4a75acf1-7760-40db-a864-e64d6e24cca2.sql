
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text not null,
  need text not null,
  description text not null,
  created_at timestamptz not null default now()
);

alter table public.requests enable row level security;

-- Anyone (including anon) can submit a request
create policy "Anyone can insert requests"
  on public.requests for insert
  to anon, authenticated
  with check (true);

-- Only the admin email can read requests
create policy "Admin can read all requests"
  on public.requests for select
  to authenticated
  using ((auth.jwt() ->> 'email') = 'netzah09@gmail.com');

create policy "Admin can delete requests"
  on public.requests for delete
  to authenticated
  using ((auth.jwt() ->> 'email') = 'netzah09@gmail.com');
