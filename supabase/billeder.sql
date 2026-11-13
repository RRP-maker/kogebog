-- Billeder til opskrifter (opdatering 4e). Kør i Supabase (SQL Editor). Kan køres flere gange. Kun tilføjelser.
-- Lageret «opskrift-billeder» tager kun JPEG og højst 1 MB pr. fil (appen gør billederne mindre, før de sendes).
-- Tabellerne og lageret er åbne som resten af appen (bevidst valg). Det er ikke sikkerhed.

-- Lageret
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('opskrift-billeder', 'opskrift-billeder', true, 1048576, array['image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg'];

drop policy if exists "billeder_laes" on storage.objects;
drop policy if exists "billeder_gem" on storage.objects;
drop policy if exists "billeder_ret" on storage.objects;
drop policy if exists "billeder_slet" on storage.objects;
create policy "billeder_laes" on storage.objects for select to anon, authenticated using (bucket_id = 'opskrift-billeder');
create policy "billeder_gem"  on storage.objects for insert to anon, authenticated with check (bucket_id = 'opskrift-billeder');
create policy "billeder_ret"  on storage.objects for update to anon, authenticated using (bucket_id = 'opskrift-billeder') with check (bucket_id = 'opskrift-billeder');
create policy "billeder_slet" on storage.objects for delete to anon, authenticated using (bucket_id = 'opskrift-billeder');

-- Billederne: én række pr. billede. Filerne ligger som <opskrift_id>/<id>.jpg (stort) og <opskrift_id>/<id>-s.jpg (lille, til listen).
-- Slettes en opskrift, forsvinder rækkerne her. Filerne slettes af appen (først filerne, så opskriften).
create table if not exists opskrift_billeder (
  id uuid primary key default gen_random_uuid(),
  opskrift_id uuid not null references opskrifter(id) on delete cascade,
  sti text not null,            -- <opskrift_id>/<id>, uden endelse
  forside boolean not null default false,
  trin int,                     -- nummer på trinnet (fra 0), tom = hele retten
  trin_tekst text,              -- trinnets tekst, så billedet følger med, hvis trinnene flyttes
  raekke int not null default 0,
  bytes int,
  bredde int,
  hoejde int,
  oprettet timestamptz not null default now());
create index if not exists opskrift_billeder_opskrift on opskrift_billeder (opskrift_id, raekke);
create unique index if not exists opskrift_billeder_en_forside on opskrift_billeder (opskrift_id) where forside;
alter table opskrift_billeder enable row level security;
drop policy if exists "aaben" on opskrift_billeder; create policy "aaben" on opskrift_billeder for all using (true) with check (true);
grant select, insert, update, delete on opskrift_billeder to anon, authenticated;
