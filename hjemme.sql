-- Hvad har du derhjemme? Kør i Supabase (SQL Editor). Kan køres flere gange.
create table if not exists ingrediens_kategorier (
  id uuid primary key default gen_random_uuid(),
  navn text not null, navn_norm text not null unique, raekkefolge int not null default 0);
create table if not exists ingredienser ( -- kataloget: appen husker, hvilken kategori en ingrediens hører til
  id uuid primary key default gen_random_uuid(),
  navn text not null, navn_norm text not null unique,
  kategori_id uuid references ingrediens_kategorier(id) on delete set null); -- tom = «Andet»
create table if not exists hjemme ( -- det, du har derhjemme lige nu
  id uuid primary key default gen_random_uuid(),
  ingrediens_id uuid not null unique references ingredienser(id) on delete cascade,
  maengde numeric, enhed text, oprettet timestamptz default now());
alter table ingrediens_kategorier enable row level security;
alter table ingredienser enable row level security;
alter table hjemme enable row level security;
drop policy if exists "aaben" on ingrediens_kategorier; create policy "aaben" on ingrediens_kategorier for all using (true) with check (true);
drop policy if exists "aaben" on ingredienser; create policy "aaben" on ingredienser for all using (true) with check (true);
drop policy if exists "aaben" on hjemme; create policy "aaben" on hjemme for all using (true) with check (true);

-- Testdata
insert into ingrediens_kategorier (navn, navn_norm, raekkefolge) values
 ('Grøntsager','grøntsager',1),('Frugt','frugt',2),('Kød','kød',3),('Fisk og skaldyr','fisk og skaldyr',4),
 ('Mejeri og æg','mejeri og æg',5),('Bønner og linser','bønner og linser',6),('Pasta, ris og korn','pasta, ris og korn',7),
 ('Krydderier','krydderier',8),('Konserves','konserves',9) on conflict (navn_norm) do nothing;
insert into ingredienser (navn, navn_norm, kategori_id)
select v.n, v.n, k.id from (values
 ('gulerødder','grøntsager'),('løg','grøntsager'),('hvidløg','grøntsager'),('kartofler','grøntsager'),('æbler','frugt'),
 ('hakket oksekød','kød'),('kyllingebryst','kød'),('laks','fisk og skaldyr'),('mælk','mejeri og æg'),('æg','mejeri og æg'),('smør','mejeri og æg'),
 ('kidneybønner','bønner og linser'),('kikærter','bønner og linser'),('røde linser','bønner og linser'),
 ('pasta','pasta, ris og korn'),('ris','pasta, ris og korn'),('salt','krydderier'),('hakkede tomater','konserves')
) v(n,k) join ingrediens_kategorier k on k.navn_norm = v.k on conflict (navn_norm) do nothing;
insert into hjemme (ingrediens_id, maengde, enhed)
select i.id, v.m, v.e from (values ('gulerødder',500,'g'),('kidneybønner',2,'dåse'),('mælk',1,'l'),('hakket oksekød',400,'g')) v(n,m,e)
join ingredienser i on i.navn_norm = v.n on conflict (ingrediens_id) do nothing;
