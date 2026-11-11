# Kogebog

En delt kogebog som statisk web app: opskrifter, metode og tips i et kladdehæfte, med hjælperen Grydelil.

- **Hosting:** GitHub Pages (branch `main`, mappe `/`).
- **Database:** Supabase. `config.js` indeholder kun Project URL og den offentlige nøgle.
- **Kode:** Vanilla HTML, CSS og JavaScript. Konva hentes fra CDN. Ingen build-værktøjer.

| Fil | Indhold |
|---|---|
| `index.html` | Sidens skelet |
| `style.css` | Notesbog-design |
| `app.js` | Sider, database, begreber, ure, forslag, import |
| `hjaelper.js` | Hjælperen og lyde |
| `hjemme.js` | Listen «Hvad har du derhjemme?» på siden Hvad kan jeg lave? (SQL i `hjemme.sql`) |
| `laerred.js` | Lærred med billeder og figurer (Konva) |
| `sw.js`, `manifest.webmanifest` | Installér på hjemmeskærm, læs uden internet |

Tabeller: `opskrifter`, `tips`, `metoder`, `favoritter`, `stjerner`, `laerred`. Alle har åben læse- og skriveadgang.

**Format i databasen (ingen ekstra kolonner):**
- `opskrifter.ingredienser` er en liste. `{ "g": "Sovs" }` er en overskrift, resten er `{ m, e, n }`.
- `opskrifter.fremgangsmaade` er tekst: ét trin pr. linje. En linje, der starter med mellemrum, er et deltrin under trinnet over.

## Tilpas siden

Tabellen `tilpasning` gemmer rettede tekster, størrelser og farver. Opret den i Supabase (SQL Editor):

```sql
create table tilpasning (noegle text primary key, tekst text, stoerrelse numeric, farve text, baggrund text);
alter table tilpasning enable row level security;
create policy "aaben" on tilpasning for all using (true) with check (true);
alter table tilpasning add column skjult boolean;
alter table tilpasning add column pos text; -- feltets plads, «dx,dy»
alter table tilpasning add column felt text; -- feltets størrelse: s, m eller l
alter table tilpasning add column laast boolean; -- feltet er låst
alter table tilpasning add column ikkeflyt boolean; -- feltet kan ikke flyttes
```
