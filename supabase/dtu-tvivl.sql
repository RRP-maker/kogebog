-- DTU-forslag til gennemgang i Ingrediensværktøjet. Kør i Supabase (SQL Editor). Kan køres flere gange.
-- Rækkerne indlæses fra supabase/dtu-tvivl.json (forslag, kategori, antal, eksempler). En række slettes, når den er oprettet eller sprunget over.
create table if not exists ingrediens_tvivl (
  id uuid primary key default gen_random_uuid(),
  forslag text not null unique,
  kategori text not null,
  antal int not null default 1,
  eksempler text,
  oprettet timestamptz not null default now());
alter table ingrediens_tvivl enable row level security;
drop policy if exists "aaben" on ingrediens_tvivl;
create policy "aaben" on ingrediens_tvivl for all using (true) with check (true);
grant select, insert, update, delete on ingrediens_tvivl to anon, authenticated;
notify pgrst, 'reload schema';
