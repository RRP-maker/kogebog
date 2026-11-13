-- Ingrediensværktøjet (opdatering 4c). Kør i Supabase (SQL Editor). Kan køres flere gange. Kun tilføjelser.
-- Rettelser køres som én funktion: enten sker det hele, eller også sker intet. Før hver rettelse gemmes en kopi, som kan gendannes.
-- Tabellerne er åbne som resten af appen (bevidst valg). Det er ikke sikkerhed.

-- Kopierne: ingredienser, kategorier, «Derhjemme» og opskrifternes ingredienslinjer, som de var
create table if not exists ingrediens_backup (
  id uuid primary key default gen_random_uuid(),
  oprettet timestamptz not null default now(),
  note text,
  antal int,            -- ingredienser i kopien (til listen i appen)
  data jsonb not null);
alter table ingrediens_backup enable row level security;
drop policy if exists "aaben" on ingrediens_backup; create policy "aaben" on ingrediens_backup for all using (true) with check (true);
grant select, insert, update, delete on ingrediens_backup to anon, authenticated;

create or replace function ingrediens_kopi(tekst text default null) returns uuid language plpgsql as $$
declare ny uuid;
begin
  insert into ingrediens_backup (note, antal, data)
  values (tekst, (select count(*) from ingredienser), jsonb_build_object(
    'ingrediens_kategorier', (select coalesce(jsonb_agg(to_jsonb(k)), '[]'::jsonb) from ingrediens_kategorier k),
    'ingredienser', (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from ingredienser i),
    'hjemme', (select coalesce(jsonb_agg(to_jsonb(h)), '[]'::jsonb) from hjemme h),
    'opskrifter', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'ingredienser', o.ingredienser)), '[]'::jsonb) from opskrifter o)))
  returning id into ny;
  return ny;
end $$;

-- p kommer fra appen (ingvaerktoej.js, beregn): { antal, note, flet: [{fra, til}], slet: [id], ret: [{id, navn, navn_norm, kategori_id}], ny: [det samme], opskrifter: [{id, ingredienser}] }
create or replace function ingrediens_ret(p jsonb) returns jsonb language plpgsql as $$
declare kopi uuid; r record; n int;
begin
  -- Er kataloget ændret, siden forhåndsvisningen blev lavet, stoppes der
  if p ? 'antal' and (p->>'antal')::int <> (select count(*) from ingredienser) then
    raise exception 'Kataloget er ændret, siden forhåndsvisningen blev lavet.';
  end if;
  kopi := ingrediens_kopi(coalesce(p->>'note', 'før rettelse'));
  -- 1. Læg sammen: «Derhjemme» flytter med, hvis den, der bliver, ikke selv står der
  for r in select (x->>'fra')::uuid as fra, (x->>'til')::uuid as til from jsonb_array_elements(coalesce(p->'flet', '[]'::jsonb)) x loop
    if exists (select 1 from hjemme where ingrediens_id = r.til) then delete from hjemme where ingrediens_id = r.fra;
    else update hjemme set ingrediens_id = r.til where ingrediens_id = r.fra; end if;
    delete from ingredienser where id = r.fra;
  end loop;
  -- 2. Slet
  delete from ingredienser where id in (select (x #>> '{}')::uuid from jsonb_array_elements(coalesce(p->'slet', '[]'::jsonb)) x);
  -- 3. Nyt navn eller ny kategori. Først et midlertidigt navn, så to ingredienser kan bytte navn.
  update ingredienser i set navn_norm = '~' || i.id::text
    from jsonb_to_recordset(coalesce(p->'ret', '[]'::jsonb)) as x(id uuid) where i.id = x.id;
  update ingredienser i set navn = x.navn, navn_norm = x.navn_norm, kategori_id = x.kategori_id
    from jsonb_to_recordset(coalesce(p->'ret', '[]'::jsonb)) as x(id uuid, navn text, navn_norm text, kategori_id uuid) where i.id = x.id;
  -- 4. Nye ingredienser
  insert into ingredienser (id, navn, navn_norm, kategori_id)
    select x.id, x.navn, x.navn_norm, x.kategori_id
    from jsonb_to_recordset(coalesce(p->'ny', '[]'::jsonb)) as x(id uuid, navn text, navn_norm text, kategori_id uuid);
  -- 5. Opskrifternes linjer
  update opskrifter o set ingredienser = x.ingredienser
    from jsonb_to_recordset(coalesce(p->'opskrifter', '[]'::jsonb)) as x(id uuid, ingredienser jsonb) where o.id = x.id;
  -- 6. Kontrol: hver linje i hver opskrift peger på en ingrediens, der findes. Ellers rulles alt tilbage.
  select count(*) into n
    from opskrifter o, jsonb_array_elements(case when jsonb_typeof(o.ingredienser) = 'array' then o.ingredienser else '[]'::jsonb end) l
    where jsonb_typeof(l) <> 'object' or (not (l ? 'g') and not exists (select 1 from ingredienser i where i.id::text = l->>'id'));
  if n > 0 then raise exception '% linjer peger ikke på en ingrediens i kataloget.', n; end if;
  return jsonb_build_object('kopi', kopi, 'ingredienser', (select count(*) from ingredienser));
end $$;

-- Sætter ingredienser, «Derhjemme» og opskrifternes linjer tilbage til en kopi. Det nuværende gemmes først som en ny kopi.
-- Opskrifter, der er lavet efter kopien, beholder deres linjer (appen knytter dem til kataloget igen).
create or replace function ingrediens_gendan(kopi uuid) returns jsonb language plpgsql as $$
declare d jsonb; ny uuid;
begin
  select data into d from ingrediens_backup where id = kopi;
  if d is null then raise exception 'Sikkerhedskopien findes ikke.'; end if;
  ny := ingrediens_kopi('før gendan');
  insert into ingrediens_kategorier (id, navn, navn_norm, raekkefolge)
    select x.id, x.navn, x.navn_norm, x.raekkefolge
    from jsonb_to_recordset(d->'ingrediens_kategorier') as x(id uuid, navn text, navn_norm text, raekkefolge int)
    on conflict do nothing;
  delete from hjemme where id is not null;
  delete from ingredienser where id is not null;
  insert into ingredienser (id, navn, navn_norm, kategori_id)
    select x.id, x.navn, x.navn_norm, (select k.id from ingrediens_kategorier k where k.id = x.kategori_id)
    from jsonb_to_recordset(d->'ingredienser') as x(id uuid, navn text, navn_norm text, kategori_id uuid);
  insert into hjemme (id, ingrediens_id, maengde, enhed, oprettet)
    select x.id, x.ingrediens_id, x.maengde, x.enhed, x.oprettet
    from jsonb_to_recordset(d->'hjemme') as x(id uuid, ingrediens_id uuid, maengde numeric, enhed text, oprettet timestamptz);
  update opskrifter o set ingredienser = x.ingredienser
    from jsonb_to_recordset(d->'opskrifter') as x(id uuid, ingredienser jsonb) where o.id = x.id;
  return jsonb_build_object('kopi', ny, 'ingredienser', (select count(*) from ingredienser));
end $$;

grant execute on function ingrediens_kopi(text), ingrediens_ret(jsonb), ingrediens_gendan(uuid) to anon, authenticated;
notify pgrst, 'reload schema';
select (select count(*) from ingredienser) as ingredienser, (select count(*) from ingrediens_backup) as kopier;
