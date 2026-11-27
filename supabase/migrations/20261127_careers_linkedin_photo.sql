-- HuckHub Careers: optional LinkedIn profile photo for claimed profiles.
--
-- The photo is copied into Storage at claim time (LinkedIn photo URLs expire),
-- and only shown to signed-in members. Members can turn it off on their edit page.

alter table career_profile_overrides
  add column if not exists avatar_url text;

-- Public-read bucket; only the service role (API routes) writes to it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('career-avatars', 'career-avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
