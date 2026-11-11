# Kogebog: regler for nye elementer

Gælder alt, jeg indsætter. Tilpasseren (`tilpas.js`) er et separat system og ændres ikke af dette.

- **Net:** alt står på notesbogens rækker à 32 px (se `--l0`, `--m`, `--pt` i `style.css`).
- **Felter** (knapper, skrivefelter, rækker): klasserne `felt` + `felt-s` / `felt-m` / `felt-l` = 32 / 64 / 96 px høje. M og L har margen foroven `--m` og forneden `--pt`. S sidder med kanterne på to linjer (`top: calc(var(--l0) - 32px)`). Standard er `felt-m`.
- **Tekst:** `tekst-s` / `tekst-m` / `tekst-l` / `tekst-xl` = 17 / 20 / 24 / 29 px, altid 32 px linjehøjde. Standard er `tekst-m`.
- **Flerlinjefelter** (textarea): højden er hele rækker à 32 px. Overskrifter (`h1`, `h2`, `h3`) har egne størrelser og står på rækkerne. Småtekst på 12 px under ikoner og tekst inde i løbende tekst er undtaget.
- **Skrivefelter og opskrifter kan ikke tilpasses** i tilpasseren, men følger størrelses- og placeringsreglerne ovenfor.
- Tjek hver ny side mod skabelonen, før en fase meldes færdig. Ingen egne mål, margener eller skriftstørrelser ved siden af skabelonen.
- Hæv `?v=` i `index.html` og `LAGER` i `sw.js`, når filer ændres.
- **Beholdere** (`div`) med felter og tekst skal være `display: flex; flex-direction: column`, ellers smelter margenerne sammen, og rækkerne flytter sig fra linjerne.
- Mål efter: toppen af et felt eller kort skal være 12 px under en række (`--raster`), tekstrækker 0 px.
- **Tilpasseren og id'er:** Hvert felt, der kan tilpasses, har et id. Har feltet ikke selv `data-tpid`, laves id'et af siden og teksten (`side|tekst`), så to felter med samme tekst på hver sin side ikke påvirker hinanden. Felter, der hænger sammen (fx alle «Gem»- eller «Luk»-knapper), får samme `data-tpid` i koden (kun bogstaver og bindestreger, ingen tal). Et felt, der skal stå for sig selv, får et eget `data-tpid`, også hvis teksten er den samme som på et andet felt. Tilbage-knapper deler id'et `tilbage`. Gamle tilpasninger gemt på teksten gælder, til feltet ændres første gang.
