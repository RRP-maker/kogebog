-- NB: efter 2.26 skal ingredienser-regler.sql køres bagefter (den erstatter nogle af funktionerne herunder).
-- Ingrediensværktøjet (opdatering 4c) og «Styr på ingredienser». Kør i Supabase (SQL Editor). Kan køres flere gange. Kun tilføjelser.
-- Rettelser køres som én funktion: enten sker det hele, eller også sker intet. Før hver rettelse gemmes en kopi, som kan gendannes.
-- Tabellerne er åbne som resten af appen (bevidst valg). Det er ikke sikkerhed.

-- Styr på ingredienser, fase 1 (2.13.0): fællesnavne, regler og én vej til nye ingredienser.
-- Fællesnavn: «timian» har varianterne «frisk timian» og «tørret timian». En variant peger på sit fællesnavn (ét niveau).
alter table ingredienser add column if not exists faelles_id uuid references ingredienser(id);
create index if not exists ingredienser_faelles on ingredienser(faelles_id);

-- Regler: «skrevet tekst → resultat». En tekst står kun ét sted: som én regel eller som navnet på en ingrediens.
-- resultat er en liste af varer [{ id, f }]. slags «vare»: én vare (uden f er det et alias, med f har den en tilberedning),
-- «del»: flere varer (linjen deles), «eller»: en af flere varer, «slet»: ingen vare (linjen slettes).
-- Ændres kun gennem ingrediens_regel_gem og ingrediens_regel_slet, som tjekker version (den anden enheds ændring ses først).
create table if not exists ingrediens_regler (
  id uuid primary key default gen_random_uuid(),
  tekst text not null unique,
  slags text not null check (slags in ('vare', 'del', 'eller', 'slet')),
  resultat jsonb not null default '[]',
  version int not null default 1,
  oprettet timestamptz not null default now(),
  aendret timestamptz not null default now(),
  check (jsonb_typeof(resultat) = 'array' and case slags when 'slet' then jsonb_array_length(resultat) = 0
    when 'vare' then jsonb_array_length(resultat) = 1 else jsonb_array_length(resultat) >= 2 end));
alter table ingrediens_regler enable row level security;
drop policy if exists "aaben" on ingrediens_regler; drop policy if exists "laes" on ingrediens_regler;
create policy "laes" on ingrediens_regler for select using (true);
revoke insert, update, delete on ingrediens_regler from anon, authenticated;
grant select on ingrediens_regler to anon, authenticated;

-- Tjek i databasen, så to enheder ikke kan lave det samme samtidig: en tekst er enten et navn eller en regel.
create or replace function ingrediens_tjek() returns trigger language plpgsql as $$
begin
  if tg_table_name = 'ingrediens_regler' then
    perform pg_advisory_xact_lock(hashtext('ingtekst:' || new.tekst));
    if exists (select 1 from ingredienser i where i.navn_norm = new.tekst) then
      raise exception '«%» er allerede navnet på en ingrediens.', new.tekst using errcode = '23505'; end if;
    if exists (select 1 from jsonb_array_elements(new.resultat) x where not exists (select 1 from ingredienser i where i.id::text = x->>'id')) then
      raise exception 'Reglen «%» peger på en ingrediens, der ikke findes.', new.tekst; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then -- ingredienser
    if exists (select 1 from ingrediens_regler r, jsonb_array_elements(r.resultat) x where x->>'id' = old.id::text) then
      raise exception '«%» bruges i en regel og kan ikke slettes.', old.navn; end if;
    return old;
  end if;
  perform pg_advisory_xact_lock(hashtext('ingtekst:' || new.navn_norm));
  if exists (select 1 from ingrediens_regler r where r.tekst = new.navn_norm) then
    raise exception '«%» er allerede en regel.', new.navn_norm using errcode = '23505'; end if;
  if new.faelles_id is not null then
    if new.faelles_id = new.id or exists (select 1 from ingredienser f where f.id = new.faelles_id and f.faelles_id is not null)
      or exists (select 1 from ingredienser v where v.faelles_id = new.id) then
      raise exception '«%»: et fællesnavn har kun ét niveau af varianter.', new.navn; end if;
    if exists (select 1 from hjemme h where h.ingrediens_id = new.faelles_id) then
      raise exception 'Fællesnavnet står i «Derhjemme». Vælg en af varianterne dér først.'; end if;
  end if;
  return new;
end $$;
drop trigger if exists ingrediens_tjek on ingredienser;
create trigger ingrediens_tjek before insert or update of navn_norm, faelles_id or delete on ingredienser for each row execute function ingrediens_tjek();
drop trigger if exists ingrediens_tjek on ingrediens_regler;
create trigger ingrediens_tjek before insert or update of tekst, resultat on ingrediens_regler for each row execute function ingrediens_tjek();

-- Et fællesnavn kan ikke stå i «Derhjemme»: dér vælger man frisk eller tørret.
create or replace function hjemme_tjek() returns trigger language plpgsql as $$
begin
  if exists (select 1 from ingredienser v where v.faelles_id = new.ingrediens_id) then
    raise exception 'Det er et fællesnavn. Vælg en af varianterne, fx frisk eller tørret.'; end if;
  return new;
end $$;
drop trigger if exists hjemme_tjek on hjemme;
create trigger hjemme_tjek before insert or update of ingrediens_id on hjemme for each row execute function hjemme_tjek();

-- Kopierne: ingredienser (med fællesnavne), kategorier, «Derhjemme», regler og opskrifternes ingredienslinjer, som de var
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
    'regler', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from ingrediens_regler r),
    'opskrifter', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'ingredienser', o.ingredienser)), '[]'::jsonb) from opskrifter o)))
  returning id into ny;
  return ny;
end $$;

-- p kommer fra appen (ingvaerktoej.js, beregn): { antal, note, flet: [{fra, til}], slet: [id], ret: [{id, navn, navn_norm, kategori_id}], ny: [det samme], faelles: [{id, faelles_id}], opskrifter: [{id, ingredienser}] }
-- Fase 3 (2.15.0) også: hjemme: [{id, ingrediens_id}] (flyttes før fællesnavnene), regler: [{tekst, slags, resultat}], hjemme_antal (så mange rækker skal «Derhjemme» have bagefter)
create or replace function ingrediens_ret(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
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
    -- Regler og varianter følger med til den, der bliver
    update ingrediens_regler g set resultat = (select jsonb_agg(case when x->>'id' = r.fra::text then jsonb_set(x, '{id}', to_jsonb(r.til::text)) else x end) from jsonb_array_elements(g.resultat) x),
      version = version + 1, aendret = now()
      where g.resultat @> jsonb_build_array(jsonb_build_object('id', r.fra::text));
    update ingredienser set faelles_id = r.til where faelles_id = r.fra;
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
  -- 4a. «Derhjemme» flyttes til en anden vare (fx fra «timian» til «tørret timian»), før «timian» bliver et fællesnavn
  update hjemme h set ingrediens_id = x.ingrediens_id
    from jsonb_to_recordset(coalesce(p->'hjemme', '[]'::jsonb)) as x(id uuid, ingrediens_id uuid) where h.id = x.id;
  -- 4b. Fællesnavne: { id, faelles_id } (faelles_id null = ikke længere en variant)
  update ingredienser i set faelles_id = x.faelles_id
    from jsonb_to_recordset(coalesce(p->'faelles', '[]'::jsonb)) as x(id uuid, faelles_id uuid) where i.id = x.id;
  -- 4c. Nye regler (aliaser og varer med tilberedning). Triggeren afviser en tekst, der er navnet på en ingrediens.
  insert into ingrediens_regler (tekst, slags, resultat)
    select lower(regexp_replace(btrim(x.tekst), '\s+', ' ', 'g')), x.slags, x.resultat
    from jsonb_to_recordset(coalesce(p->'regler', '[]'::jsonb)) as x(tekst text, slags text, resultat jsonb);
  -- 5. Opskrifternes linjer
  update opskrifter o set ingredienser = x.ingredienser
    from jsonb_to_recordset(coalesce(p->'opskrifter', '[]'::jsonb)) as x(id uuid, ingredienser jsonb) where o.id = x.id;
  -- 6. Kontrol: hver linje i hver opskrift peger på en ingrediens, der findes. Ellers rulles alt tilbage.
  select count(*) into n
    from opskrifter o, jsonb_array_elements(case when jsonb_typeof(o.ingredienser) = 'array' then o.ingredienser else '[]'::jsonb end) l
    where jsonb_typeof(l) <> 'object' or (not (l ? 'g') and case when l ? 'eller' then jsonb_typeof(l->'eller') <> 'array' or jsonb_array_length(l->'eller') < 2
      or exists (select 1 from jsonb_array_elements_text(l->'eller') e where not exists (select 1 from ingredienser i where i.id::text = e))
      else not exists (select 1 from ingredienser i where i.id::text = l->>'id') end);
  if n > 0 then raise exception '% linjer peger ikke på en ingrediens i kataloget.', n; end if;
  -- 7. Kontrol: ingen række i «Derhjemme» er tabt
  if p ? 'hjemme_antal' and (p->>'hjemme_antal')::int <> (select count(*) from hjemme) then
    raise exception '«Derhjemme» ville få % rækker i stedet for %.', (select count(*) from hjemme), p->>'hjemme_antal'; end if;
  return jsonb_build_object('kopi', kopi, 'ingredienser', (select count(*) from ingredienser));
end $$;

-- Sætter ingredienser, «Derhjemme», regler og opskrifternes linjer tilbage til en kopi. Det nuværende gemmes først som en ny kopi.
-- Opskrifter, der er lavet efter kopien, beholder deres linjer (appen knytter dem til kataloget igen).
create or replace function ingrediens_gendan(kopi uuid) returns jsonb language plpgsql security definer set search_path = public as $$
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
  delete from ingrediens_regler where id is not null; -- kopier fra før reglerne har ingen regler
  delete from ingredienser where id is not null;
  insert into ingredienser (id, navn, navn_norm, kategori_id)
    select x.id, x.navn, x.navn_norm, (select k.id from ingrediens_kategorier k where k.id = x.kategori_id)
    from jsonb_to_recordset(d->'ingredienser') as x(id uuid, navn text, navn_norm text, kategori_id uuid);
  update ingredienser i set faelles_id = x.faelles_id
    from jsonb_to_recordset(d->'ingredienser') as x(id uuid, faelles_id uuid) where i.id = x.id and x.faelles_id is not null;
  insert into ingrediens_regler (id, tekst, slags, resultat, version, oprettet, aendret)
    select x.id, x.tekst, x.slags, x.resultat, x.version, x.oprettet, x.aendret
    from jsonb_to_recordset(coalesce(d->'regler', '[]'::jsonb)) as x(id uuid, tekst text, slags text, resultat jsonb, version int, oprettet timestamptz, aendret timestamptz);
  insert into hjemme (id, ingrediens_id, maengde, enhed, oprettet)
    select x.id, x.ingrediens_id, x.maengde, x.enhed, x.oprettet
    from jsonb_to_recordset(d->'hjemme') as x(id uuid, ingrediens_id uuid, maengde numeric, enhed text, oprettet timestamptz);
  update opskrifter o set ingredienser = x.ingredienser
    from jsonb_to_recordset(d->'opskrifter') as x(id uuid, ingredienser jsonb) where o.id = x.id;
  return jsonb_build_object('kopi', ny, 'ingredienser', (select count(*) from ingredienser));
end $$;

-- Den ene vej til nye ingredienser (fase 5 flytter appen hertil). p: { nye: [{ navn, kategori_id, faelles_id, id }] }.
-- Alt eller intet: findes et navn som ingrediens eller regel, oprettes intet, og svaret siger hvilke.
create or replace function ingrediens_opret(p jsonb) returns jsonb language plpgsql as $$
declare x jsonb; n text; findes jsonb := '[]'; nye jsonb := '[]'; ny ingredienser; set_ text[] := '{}';
begin
  for x in select * from jsonb_array_elements(coalesce(p->'nye', '[]'::jsonb)) loop
    n := lower(regexp_replace(btrim(coalesce(x->>'navn', '')), '\s+', ' ', 'g'));
    if n = '' or n ~ '[(),;]' then raise exception 'Navnet «%» kan ikke bruges. Et navn må ikke være tomt eller have komma eller parentes.', x->>'navn'; end if;
    if n = any(set_) then continue; end if;
    set_ := set_ || n;
    perform pg_advisory_xact_lock(hashtext('ingtekst:' || n));
    if exists (select 1 from ingredienser i where i.navn_norm = n) then
      findes := findes || (select jsonb_build_object('navn', n, 'via', 'navn', 'ingrediens', to_jsonb(i)) from ingredienser i where i.navn_norm = n);
    elsif exists (select 1 from ingrediens_regler r where r.tekst = n) then
      findes := findes || (select jsonb_build_object('navn', n, 'via', 'regel', 'regel', to_jsonb(r)) from ingrediens_regler r where r.tekst = n);
    end if;
  end loop;
  if jsonb_array_length(findes) > 0 then return jsonb_build_object('ok', false, 'findes', findes); end if;
  for x in select * from jsonb_array_elements(coalesce(p->'nye', '[]'::jsonb)) loop
    n := lower(regexp_replace(btrim(x->>'navn'), '\s+', ' ', 'g'));
    if exists (select 1 from jsonb_array_elements(nye) y where y->>'navn_norm' = n) then continue; end if;
    insert into ingredienser (id, navn, navn_norm, kategori_id, faelles_id)
      values (coalesce((x->>'id')::uuid, gen_random_uuid()), n, n, (x->>'kategori_id')::uuid, (x->>'faelles_id')::uuid) returning * into ny;
    nye := nye || to_jsonb(ny);
  end loop;
  return jsonb_build_object('ok', true, 'ingredienser', nye);
end $$;

-- Gemmer en regel. p: { id?, version?, tekst, slags, resultat: [{ id, f }] }.
-- Ny regel: findes teksten allerede som regel, gælder den, der findes (svar: findes). Er teksten navnet på en ingrediens, svares der «navn». Ændring: er reglen ændret siden den blev hentet, vises den andens udgave (svar: aendret).
create or replace function ingrediens_regel_gem(p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare t text := lower(regexp_replace(btrim(coalesce(p->>'tekst', '')), '\s+', ' ', 'g')); res jsonb; r ingrediens_regler;
begin
  if t = '' then raise exception 'Reglen mangler en tekst.'; end if;
  if jsonb_typeof(coalesce(p->'resultat', '[]'::jsonb)) <> 'array' then raise exception 'Reglens resultat skal være en liste.'; end if;
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', x->>'id', 'f', nullif(btrim(x->>'f'), '')))), '[]') into res
    from jsonb_array_elements(coalesce(p->'resultat', '[]'::jsonb)) x;
  if p ? 'id' and p->>'id' is not null then
    select * into r from ingrediens_regler where id = (p->>'id')::uuid for update;
    if not found then return jsonb_build_object('ok', false, 'grund', 'slettet'); end if;
    if r.version <> coalesce((p->>'version')::int, -1) then return jsonb_build_object('ok', false, 'grund', 'aendret', 'regel', to_jsonb(r)); end if;
    update ingrediens_regler set tekst = t, slags = p->>'slags', resultat = res, version = version + 1, aendret = now() where id = r.id returning * into r;
  else
    select * into r from ingrediens_regler where tekst = t;
    if found then return jsonb_build_object('ok', false, 'grund', 'findes', 'regel', to_jsonb(r)); end if;
    if exists (select 1 from ingredienser i where i.navn_norm = t) then
      return jsonb_build_object('ok', false, 'grund', 'navn', 'ingrediens', (select to_jsonb(i) from ingredienser i where i.navn_norm = t)); end if;
    begin
      insert into ingrediens_regler (tekst, slags, resultat) values (t, p->>'slags', res) returning * into r;
    exception when unique_violation then -- en anden enhed nåede først
      select * into r from ingrediens_regler where tekst = t;
      if not found then raise; end if;
      return jsonb_build_object('ok', false, 'grund', 'findes', 'regel', to_jsonb(r));
    end;
  end if;
  return jsonb_build_object('ok', true, 'regel', to_jsonb(r));
end $$;

create or replace function ingrediens_regel_slet(id uuid, version int) returns jsonb language plpgsql security definer set search_path = public as $$
declare r ingrediens_regler;
begin
  select * into r from ingrediens_regler g where g.id = ingrediens_regel_slet.id for update;
  if not found then return jsonb_build_object('ok', true); end if;
  if r.version <> ingrediens_regel_slet.version then return jsonb_build_object('ok', false, 'grund', 'aendret', 'regel', to_jsonb(r)); end if;
  delete from ingrediens_regler g where g.id = r.id;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function ingrediens_kopi(text), ingrediens_ret(jsonb), ingrediens_gendan(uuid), ingrediens_opret(jsonb), ingrediens_regel_gem(jsonb), ingrediens_regel_slet(uuid, int) to anon, authenticated;
notify pgrst, 'reload schema';
select (select count(*) from ingredienser) as ingredienser, (select count(*) from ingrediens_regler) as regler, (select count(*) from ingrediens_backup) as kopier;

-- 2.20.2: «Til gennemgang». Appen skriver en række, når en ingrediens eller et alias laves uden for Ingrediensværktøjet
-- (formular, åbning af en opskrift, import, «Derhjemme») eller en «tæt på» rettes af sig selv. «Godkend» sletter rækken.
create table if not exists ingrediens_gennemgang (
  id uuid primary key default gen_random_uuid(),
  oprettet timestamptz not null default now(),
  slags text not null check (slags in ('ny', 'alias', 'taet')),
  tekst text not null,
  ingrediens_id uuid references ingredienser(id) on delete cascade,
  kilde text not null default 'app',
  note text
);
alter table ingrediens_gennemgang enable row level security;
drop policy if exists "aaben" on ingrediens_gennemgang;
create policy "aaben" on ingrediens_gennemgang for all using (true) with check (true);
grant select, insert, delete on ingrediens_gennemgang to anon, authenticated;
notify pgrst, 'reload schema';
