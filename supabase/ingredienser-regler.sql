-- «Styr på ingredienser», nye regler. Kør i Supabase (SQL Editor) EFTER ingredienser.sql. Kan køres flere gange.
-- Indhold: «Samme som» (ens_gruppe), «foreløbig» (ny ingrediens, der endnu ikke er godkendt),
-- fællesnavne må stå «Derhjemme», og en importfunktion, der springer eksisterende navne over.

-- 1. Nye felter
alter table ingredienser add column if not exists ens_gruppe uuid;      -- ingredienser med samme gruppe er «samme som» hinanden (min. 2)
alter table ingredienser add column if not exists foreloebig boolean not null default false; -- ny og endnu ikke godkendt i Ingrediensværktøjet
create index if not exists ingredienser_ens_gruppe on ingredienser(ens_gruppe) where ens_gruppe is not null;
create index if not exists ingredienser_foreloebig on ingredienser(foreloebig) where foreloebig;

-- 2. Fællesnavne må stå «Derhjemme» (timian derhjemme dækker frisk og tørret timian)
drop trigger if exists hjemme_tjek on hjemme;
drop function if exists hjemme_tjek();

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
  end if;
  return new;
end $$;

-- 3. «Samme som»: en gruppe skal have mindst 2. Bliver der kun én tilbage (fjernet eller slettet), opløses gruppen.
create or replace function ingrediens_gruppe_ryd() returns trigger language plpgsql as $$
begin
  if old.ens_gruppe is not null and (tg_op = 'DELETE' or new.ens_gruppe is distinct from old.ens_gruppe)
     and (select count(*) from ingredienser where ens_gruppe = old.ens_gruppe) = 1 then
    update ingredienser set ens_gruppe = null where ens_gruppe = old.ens_gruppe;
  end if;
  return null;
end $$;
drop trigger if exists ingrediens_gruppe_ryd on ingredienser;
create trigger ingrediens_gruppe_ryd after delete or update of ens_gruppe on ingredienser for each row execute function ingrediens_gruppe_ryd();

-- Gør ingredienserne «samme som» hinanden. p: { ids: [uuid, ...] } (min. 2). Findes de i grupper allerede, slås grupperne sammen.
create or replace function ingrediens_samme(p jsonb) returns jsonb language plpgsql as $$
declare ids uuid[]; g uuid; kopi uuid;
begin
  select coalesce(array_agg(distinct (x #>> '{}')::uuid), '{}') into ids from jsonb_array_elements(coalesce(p->'ids', '[]'::jsonb)) x;
  if coalesce(array_length(ids, 1), 0) < 2 then raise exception 'Vælg mindst to ingredienser.'; end if;
  if (select count(*) from ingredienser where id = any(ids)) <> array_length(ids, 1) then raise exception 'En af ingredienserne findes ikke.'; end if;
  kopi := ingrediens_kopi('før «samme som»');
  select ens_gruppe into g from ingredienser where id = any(ids) and ens_gruppe is not null limit 1;
  if g is null then g := gen_random_uuid(); end if;
  update ingredienser set ens_gruppe = g where id = any(ids) or ens_gruppe in (select ens_gruppe from ingredienser where id = any(ids) and ens_gruppe is not null);
  return jsonb_build_object('ok', true, 'gruppe', g, 'kopi', kopi);
end $$;

-- Tager én ingrediens ud af sin gruppe. p: { id }
create or replace function ingrediens_samme_fjern(p jsonb) returns jsonb language plpgsql as $$
declare kopi uuid;
begin
  kopi := ingrediens_kopi('før «samme som» fjernes');
  update ingredienser set ens_gruppe = null where id = (p->>'id')::uuid;
  return jsonb_build_object('ok', true, 'kopi', kopi);
end $$;

-- 4. Nye ingredienser fra appen kan markeres foreløbige: { nye: [{ navn, kategori_id, faelles_id, id, foreloebig }] }
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
    insert into ingredienser (id, navn, navn_norm, kategori_id, faelles_id, foreloebig)
      values (coalesce((x->>'id')::uuid, gen_random_uuid()), n, n, (x->>'kategori_id')::uuid, (x->>'faelles_id')::uuid, coalesce((x->>'foreloebig')::boolean, false)) returning * into ny;
    nye := nye || to_jsonb(ny);
  end loop;
  return jsonb_build_object('ok', true, 'ingredienser', nye);
end $$;

-- 5. Kopi og gendan tager de nye felter med (kopien har dem allerede, for den gemmer hele rækken)
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
  update ingredienser i set ens_gruppe = x.ens_gruppe, foreloebig = coalesce(x.foreloebig, false)
    from jsonb_to_recordset(d->'ingredienser') as x(id uuid, ens_gruppe uuid, foreloebig boolean)
    where i.id = x.id and (x.ens_gruppe is not null or coalesce(x.foreloebig, false));
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

-- 6. Import (fx DTU). Køres kun her i SQL Editor, ikke fra appen. p: liste af { navn, kategori } (kategori = kategoriens navn).
-- Eksisterende navne og regler springes over (intet overskrives). Manglende kategorier oprettes. Importerede ingredienser er godkendte.
-- Svar: { oprettet, findes: [navn], regel: [navn], ugyldige: [navn], nye_kategorier: [navn], kopi }
create or replace function ingrediens_import(p jsonb) returns jsonb language plpgsql as $$
declare x jsonb; n text; kn text; kid uuid; kopi uuid; antal int := 0; set_ text[] := '{}';
  findes jsonb := '[]'; regel jsonb := '[]'; ugyldige jsonb := '[]'; nyek jsonb := '[]';
begin
  if jsonb_typeof(p) <> 'array' then raise exception 'Giv en liste: [{"navn": "...", "kategori": "..."}].'; end if;
  kopi := ingrediens_kopi('før import');
  for x in select * from jsonb_array_elements(p) loop
    n := lower(regexp_replace(btrim(coalesce(x->>'navn', '')), '\s+', ' ', 'g'));
    kn := btrim(coalesce(x->>'kategori', ''));
    if n = '' or n ~ '[(),;]' or kn = '' then ugyldige := ugyldige || to_jsonb(coalesce(x->>'navn', '')); continue; end if;
    if n = any(set_) then continue; end if;
    set_ := set_ || n;
    perform pg_advisory_xact_lock(hashtext('ingtekst:' || n));
    if exists (select 1 from ingredienser i where i.navn_norm = n) then findes := findes || to_jsonb(n); continue; end if;
    if exists (select 1 from ingrediens_regler r where r.tekst = n) then regel := regel || to_jsonb(n); continue; end if;
    select id into kid from ingrediens_kategorier where navn_norm = lower(kn);
    if kid is null then
      kid := gen_random_uuid();
      insert into ingrediens_kategorier (id, navn, navn_norm, raekkefolge)
        values (kid, kn, lower(kn), coalesce((select max(raekkefolge) from ingrediens_kategorier), 0) + 1);
      nyek := nyek || to_jsonb(kn);
    end if;
    insert into ingredienser (id, navn, navn_norm, kategori_id) values (gen_random_uuid(), n, n, kid);
    antal := antal + 1;
  end loop;
  return jsonb_build_object('oprettet', antal, 'findes', findes, 'regel', regel, 'ugyldige', ugyldige, 'nye_kategorier', nyek, 'kopi', kopi);
end $$;

grant execute on function ingrediens_samme(jsonb), ingrediens_samme_fjern(jsonb), ingrediens_opret(jsonb), ingrediens_gendan(uuid) to anon, authenticated;
notify pgrst, 'reload schema';
select (select count(*) from ingredienser) as ingredienser, (select count(*) from ingredienser where ens_gruppe is not null) as i_grupper,
  (select count(*) from ingredienser where foreloebig) as foreloebige;
