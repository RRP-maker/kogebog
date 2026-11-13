-- Sidebyggeren (opdatering 2): felterne og deres plads. Kør i Supabase (SQL Editor). Kan køres flere gange.
-- Kun tilføjelser: «tilpasning» røres ikke, så en tidligere version af appen virker stadig.
create table if not exists objekter (
  id text primary key,              -- feltets nøgle (som tilpasning.noegle), en skabelon (fx «hj-grp») eller «egen-…» for dine egne felter
  side text,                        -- egne felter: siden, de står på (fx «forside», «opskrifter/:id»)
  efter text, efter_bred text,      -- rækkefølge: feltet før («^nøgle» = før det felt, «i:nøgle» = først i den beholder). efter = smal (under 744 px), efter_bred = bred
  kant smallint, kant_bred smallint,       -- 0 venstre, 1 højre
  bredde text, bredde_bred text,    -- hel, halv eller tredjedel
  type text,                        -- tekst, knap, billede, afstand, beholder (egne felter)
  indhold text,                     -- egne felter: teksten, eller billedets adresse
  link text,                        -- egne knapper: hvor de fører hen
  tekst text, stoerrelse int, farve text, baggrund text, felt text, ramme boolean,
  laast boolean, ikkeflyt boolean, skjult boolean, slettet boolean not null default false,
  pos text,                         -- kun felter, der er låst på skærmen: forskydning i px («dx,dy»), så feltet bliver, hvor det stod
  skabelon_for text,                -- skabelon: listens navn. Ændres den, ændres alle elementer i listen
  undtagelse_for text,              -- undtagelse fra en skabelon: kun farve og baggrund
  omregnet boolean,                 -- fase 5: placeringen er regnet om fra en gammel pixelplacering
  opdateret timestamptz not null default now()
);
alter table objekter enable row level security;
drop policy if exists "aaben" on objekter; create policy "aaben" on objekter for all using (true) with check (true);
