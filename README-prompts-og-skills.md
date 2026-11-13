# Prompts og skills

Kun til at læse. Appen og Claude bruger ikke filen.

## Prompts

Skriv dem i denne rækkefølge. Hæng beskrivelsen på den første.

| Hvornår | Prompt |
|---|---|
| Planlæg en opdatering | `/designarbejde planlæg ud fra denne beskrivelse` |
| Svar på spørgsmål | Svar på nummer, fx «1. De nuværende. 2. Ja, men uden tekst.» |
| Gem planen | `Opdater planen` |
| Vælg model og indsats | `Revidér kun kolonnen «Model og indsats» i faseplanen. Vurdér hver fase ud fra: åbne valg, hvor svær den er at fortryde, mekanik eller skøn, om den kan kontrolleres, og hvor meget eksisterende kode den skal passe ind i.` |
| Skift til konkrete modeller | `Skriv modelkolonnen om med konkrete modeller. Behold indsats og begrundelser.` |
| Byg en fase | `Start 4a-1` (kun den fase bygges, og Claude stopper, hvor du skal gøre noget) |
| Afslut en fase | Claude gennemgår tjeklisten og siger, hvad der ikke er opfyldt |

## Skills

Claude vælger selv skills. Højst 2–3 ad gangen.

| Skill | Bruges til |
|---|---|
| `designarbejde` | Indgangen. Vælger skills og rækkefølge, og skriver brief og plan |
| `kodekontinuitet-og-genbrug` | Kode, der følger projektets mønstre og holder ændringen lille |
| `farve-i-ui` | Paletter, kontrast, lyst og mørkt tema |
| `usabilitet-og-heuristik` | Brugbarhed: ens ord, fortryd, tydelig status |
| `designsystemer-og-tokens` | Navngivne farver og komponenter |
| `ux-writing-og-mikrotekst` | Knapper, labels, fejl og tomme sider |
| `bevaegelse-feedback-og-game-feel` | Animation og feedback, også med reduceret bevægelse |
| `tvaers-af-enheder-adaptivt-design` | iPhone, iPad og Mac |
| `platformkonventioner-app` | Apples regler: tryk-mål, navigation, tema |
| `informationsarkitektur-og-navigation` | Menuer, navigationsbjælke og navne på sider |
| `layout-og-visuelt-hierarki` | Mellemrum, gruppering og hvad øjet ser først |
| `typografi-og-laesbarhed` | Skrifttype, størrelse og linjelængde |
| `formularer-og-input` | Felter, kode og fejlbeskeder |
| `onboarding-og-tutorials` | Første brug og tips |
| `tilgaengelighed-web-app-spil` | Krav til, at alle kan bruge appen |
| `webperformance-core-web-vitals` | Hastighed og layoutskift |
| `adfaerd-i-design` | Friktion, standardvalg og dark patterns |
| `projektkonventioner-web` | Reglerne i `CLAUDE.md` |

Fra projektets regler: Liquid Glass (glasudseendet) og Emil Kowalskis skills (animation).
