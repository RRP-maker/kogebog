# Kogebog: regler for nye elementer

Gælder alt, jeg indsætter. Tilpasseren (`tilpas.js`) er et separat system og ændres ikke af dette.

- **Net:** alt står på notesbogens rækker à 32 px (se `--l0`, `--m`, `--pt` i `style.css`).
- **Felter** (knapper, skrivefelter, rækker): klasserne `felt` + `felt-s` / `felt-m` / `felt-l` = 32 / 64 / 96 px høje. M og L har margen foroven `--m` og forneden `--pt`. S sidder på linjerne. Standard er `felt-m`.
- **Tekst:** `tekst-s` / `tekst-m` / `tekst-l` / `tekst-xl` = 17 / 20 / 24 / 29 px, altid 32 px linjehøjde. Standard er `tekst-m`.
- **Flerlinjefelter** (textarea): højden er hele rækker à 32 px. Overskrifter (`h1`, `h2`, `h3`) har egne størrelser og står på rækkerne. Småtekst på 12 px under ikoner og tekst inde i løbende tekst er undtaget.
- **Skrivefelter og opskrifter kan ikke tilpasses** i tilpasseren, men følger størrelses- og placeringsreglerne ovenfor.
- Tjek hver ny side mod skabelonen, før en fase meldes færdig. Ingen egne mål, margener eller skriftstørrelser ved siden af skabelonen.
- Hæv `?v=` i `index.html` og `LAGER` i `sw.js`, når filer ændres.
