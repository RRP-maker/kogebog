# Kogebog

En delt kogebog som statisk web app: opskrifter, metode og tips i et kladdehæfte, med hjælperen Grydelil.

- **Hosting:** GitHub Pages (branch `main`, mappe `/`).
- **Database:** Supabase. `config.js` indeholder kun Project URL og den offentlige nøgle.
- **Kode:** Vanilla HTML, CSS og JavaScript. Konva hentes fra CDN. Ingen build-værktøjer.

| Fil | Indhold |
|---|---|
| `index.html` | Sidens skelet |
| `style.css` | Notesbog-design |
| `app.js` | Sider, database, begreber, ure, indkøb, forslag, import |
| `hjaelper.js` | Hjælperen og lyde |
| `laerred.js` | Lærred med billeder og figurer (Konva) |
| `sw.js`, `manifest.webmanifest` | Installér på hjemmeskærm, læs uden internet |

Tabeller: `opskrifter`, `tips`, `metoder`, `favoritter`, `stjerner`, `indkob`, `laerred`. Alle har åben læse- og skriveadgang.
