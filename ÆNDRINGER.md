# Ændringer i Kogebog

Nyeste øverst. Hver version har et git-tag (`v1.1.0` osv.). Beslutninger skrives under versionen.

## 2.2.3 · Samme handling, samme form (kriterie 2 færdigt)
- «Fjern» fra en liste (ingredienslinjer, «Hvad har du derhjemme?», gennemgangen) har nu et minus-ikon på melgrå flade. Før var det ×, som også betyder Luk.
- «Nulstil plads» i Designer er melgrå som al anden Nulstil.
- Knappen nederst i «Tjek ingredienserne» er kun grøn (Gem), når den gemmer noget. Står der «Færdig», er den en almindelig hovedknap.
- Designerens gemte feltfarver blev fjernet i 2.2.1, så rollernes farver gælder overalt.

## 2.2.2 · Gulerod til hovedknapperne, «Tilføj tip» i blåbær
- `--hovedhandling` er nu gulerod i stedet for blæk (Rasmus' valg C): lys `#b4530c` med hvid tekst (5,0:1, kant 4,9:1), mørk `#f5a25a` med mørk tekst (8,5:1, kant 8,0:1). Gælder «Lav retten», «+ Ny opskrift», «Generer ny madplan», «Start», «Næste» m.fl. Den skilles nu også fra «valgt» (blæk).
- «Tilføj tip» bruger `hjaelp` (blåbær): et tip forklarer et ord, og knappen skilles fra den gule «Tilpas» ved siden af.
- Forbehold: gulerod og tomatrød (Slet) ligger tæt ved rød-grøn farveblindhed. Teksten og skraldespanden bærer forskellen, og Slet står aldrig ved siden af en hovedknap.

## 2.2.1 · «Annuller» skiller sig ud fra glasknapperne
- Melgrå «Annuller» lignede en almindelig glasknap. Nu er fladen fast og tydeligt mørkere: havremel `#d1c7ad` med kant `#6e6757` i lyst tema (tekst 6,8:1, kant 5,5:1) og mellemgrå `#8d95b3` med mørk tekst i mørkt tema (tekst 6,1:1, kant 5,5:1).
- Designerens gamle feltfarver er fjernet fra `objekter` (13. nov., efter Rasmus' ja), så knapperne viser rollernes farver. Kun `baggrund` (og `farve: hvid`, hvor den hørte til baggrunden) er sat til tom. Placeringer er urørte. Før: `forside|hvad-kan-jeg-lave` hvid/indigo, `gem` mynte, `opskrifter/:id/lav|start` mynte, `luk` rod, `madplan` smoer, `mp-udskift` rod, `mp-vaelg-ret` mynte, `mere|nulstil-alle-tekster` glas, `tip-rediger` hvid/smoer, `tip-slet` rod.

## 2.2.0 · Farver med betydning, ens knapper, «Tilpas» og «Designer» (opdatering 4a-3)
- **Farver i to lag** øverst i `style.css`: rå farver (`--raa-…`, kun i `:root` og det mørke tema) og roller, som komponenter bruger. Handlinger: `--gem` (æblegrøn), `--tilpas` (smørgul), `--slet` (tomatrød), `--annuller` (melgrå), `--hjaelp` (blåbærblå), `--hovedhandling` (blæk). Hver har `--paa-…` (tekst) og `…-kant`. Kategorier: `--kat-hovedret`, `-forret`, `-salat`, `-dessert`, `-tilbehoer`, `-drikke` og `-andet` (egne kategorier). Værdierne er fra farvelisten i 4a-1.
- **Knapper efter rolle:** klasserne `gem`, `hoved`, `slet`, `annuller`, `tilpas`, `hjaelp` på `.knap` (erstatter `primaer`, `gron`, `fare`). Rød betyder kun, at noget går tabt (Slet, Ryd). Slet har skraldespand og tingens navn («Slet opskriften»). Fjern og Nulstil er melgrå. Melgrå har 2 px kant, og en deaktiveret knap er bleg med stiplet kant, så de ikke ligner hinanden.
- **Runde knapper:** Tilbage er rund med ‹ (`Ikoner.tilbage`), Luk er rund med ×, Fortryd og Gentag er runde med de buede pile fra 4a-1 (`Ikoner.rund`), og «Vis hjælper» er rund med ?. Alle har `aria-label` og er 44 px (fylder én række i nettet). «‹ Annuller» øverst i formularen hedder nu «Annuller».
- «Luk» ved siden af «Gem» i vinduer hedder nu «Annuller» (`data-tpid="annuller"`). «Opret» (ny kategori) hedder «Gem».
- **Ord:** «Rediger» hedder «Tilpas» overalt (knapper, overskrifter «Tilpas opskriften» og «Tilpas tippet», hjælpetekster). Layoutværktøjet hedder «Designer»: «Åbn Designer», «Sæt Designer på pause», «Fortsæt Designer», «Designer: feltet».
- **Kategorier ses:** kategori-mærket på opskriften, i listen (mærke + farvet streg) og på filterknapperne. Navnet står altid.
- Links er blå (`--link`), ikke røde. Fejl og ulovlige træk bruger `--advarsel`. Tælleren i «Lav retten» er blæk, fremgangslinjen `--hovedhandling`.
- Ingen løse farveværdier i komponenter i `style.css`. Undtaget: Designerens feltfarver i `tilpas.js` og reserveværdierne på indlæsningsskærmen i `index.html`.
- Gemte placeringer er bevaret: kortet med madplanens knapper har sit gamle tekst-id som `data-tpid`, og afsnittet om Designers vindueshøjde har sit gamle id. Standardplaceringen for «Tilpas» står under `rediger`.
- Beslutning: Designerens gemte feltfarver går stadig forud for rollerne (fx «Gem» i mynte, «Luk» i rød). Se status for 4a-3.

## 2.1.1 · Indlæsningsskærmen ses også, mens style.css hentes
- Rettet: `style.css` blokerede første tegning, så skærmen var tom, til den var hentet (set med 4 s forsinkelse: kun papirfarve). Nu hentes den uden at blokere (`media="print"`, til den er hentet), og app.js starter først, når den er klar (`CssKlar`), så mål i koden læses fra den rigtige CSS. Fejler hentningen, bruges siden alligevel.
- Skærmens farver er nu rollerne fra `style.css` (`--papir`, `--blaek`, `--gryde`, `--smor`) med faste reserveværdier, til filen er hentet. Før den er hentet, står teksten i systemskrift.
- Målt: opskriftssiden har de samme afvigelser fra rækker og kolonner som før 2.1.0 (390 og 1440 px). Efter den fjernede sektion står «Opdater med Claude», «Print» og «Slet» uændret.

## 2.1.0 · Indlæsningsskærm og «Vores side» fjernet (opdatering 4a-2)
- Ved start dækker en indlæsningsskærm hele siden: en gryde med damp og teksten «Åbner Kogebog…». Den står i `index.html` med egen CSS, så den ses, før resten er hentet. Den forsvinder (på 0,18 s), når startsiden er tegnet, de gemte placeringer er sat på plads, og skrifterne er klar, højst 3 sekunder efter. Derfor ses hverken «Henter…», tomme felter eller felter, der hopper på plads.
- Går det langsomt (8 sekunder), står der «Det tager længere end ventet. Tjek, at du har internet.» med knappen «Prøv igen».
- Med reduceret bevægelse står gryden stille, og skærmen skifter uden toning.
- «Vores side» er fjernet fra opskrifterne: lærredet, figurerne og billedknapperne. `laerred.js`, Konva (CDN), CSS, de syv figur-ikoner (`hjerte`, `tomat`, `ost`, `baguette`, `aeg`, `cupcake`, `tommel`) og `Ikoner.billede` er slettet. `laerred` er også taget ud af «Sikkerhedskopi» under Indstillinger. Kamera-ikonet er beholdt til billederne i 4e.
- Tabellen `laerred` er slettet i Supabase (13. nov., efter Rasmus' godkendelse). Den havde 0 rækker, så der er ingen kopi. Ingen rækker i `objekter`/`tilpasning` hørte til «Vores side». Kolonnerne var `id uuid`, `opskrift_id uuid`, `slags`, `indhold`, `x`, `y`, `skala`, `rotation`, `oprettet`, med adgangsreglen `alle_kan_alt`.
- Beslutning: indlæsningsskærmen venter på hele den første side (ikke kun skelettet), fordi sider som opskriften viser «Henter…», til data er hentet.
- Beslutning: ingen mindste visningstid. Den toner først ind efter 0,2 s, så en hurtig start ikke blinker.
- `Tilpas.klar()` er ny (den første hentning af placeringer), og app.js venter på den.

## 2.0.3 · Knapper i tips og plus/minus
- Tips: «Rediger» og «Slet» står små og side om side nederst i kortet. De har egne id'er (`tip-rediger`, `tip-slet`), så de ikke længere følger opskriftens «Rediger» (som står øverst til højre) og «Slet».
- Plus og minus er én pille af glas med −, tallet og + inde i (32 px, på linjerne). Gælder alle steder: portioner, «Du mangler lidt», Madplan og Indstillinger.
- Plus og minus under Indstillinger kan tilpasses: hele pillen kan flyttes, og −, tallet og + kan få farve hver for sig, som på Madplan.

## 2.0.2 · Fortryd rydder også i «objekter»
- Tabellen «objekter» er oprettet og i brug: appen gemmer der (tjekket live).
- Rettet: «Fortryd» efter en flytning ryddede ikke pladsen i tabellen, så den kom igen efter genindlæsning. Nu sendes alle kolonner, også de tomme.

## 2.0.1 · Tabellen «objekter»
- `supabase/objekter.sql` opretter tabellen og kopierer felterne fra «tilpasning» (`obj|…`) over i den. Rækkerne i «tilpasning» bliver liggende.
- Findes «objekter», læser appen kun felterne derfra. Ellers kunne et felt, der var fjernet i «objekter», komme igen fra den gamle kopi.
- Git-tags `v1.0.0` til `v2.0.0` er lavet, men kunne ikke skubbes fra sessionen.

## 2.0.0 · Sidebygger, fase 5: de gamle placeringer er regnet om
- Første gang en side vises på en smal (iPhone) og en bred skærm (iPad, Mac), regnes dine gamle pixelplaceringer om til rækkefølge og kant: der, hvor feltet står (efter beskyttelsen mod overlap), bliver dets nye plads. Tekst, størrelse og farver følger med. Placeringer, der gav overlap eller sendte et felt ud af skærmen, bliver til feltets egen plads.
- Felter, der er låst på skærmen, beholder deres forskydning.
- Tabellen «tilpasning» røres ikke. Sikkerhedskopi før omregningen: `supabase/sikkerhedskopi/tilpasning-2026-11-13.json` og `.sql` (lægger den tilbage).
- Beslutning: Omregningen sker i appen, når siden vises, og ikke én gang for alle i databasen. Pladsen afhænger af sidens opbygning og skærmens bredde, og den kendes kun, når siden er tegnet.
- Beslutning: Gamle nøgler til felter, der ikke findes mere (`mp-dagfelt-…`, `kort:…`), regnes ikke om og bliver liggende i «tilpasning».

## 1.10.0 · Sidebygger, fase 4: opskriften som beholder
- Opskriftens dele er datafelter: titel, mærker, beskrivelse, ingredienser, trin, «Hvordan smagte det?», tips og «Vores side». Når du tilpasser, kan de flyttes (også ingredienser og trin ud af de to kolonner), få ramme og farve. Teksten kommer altid fra opskriften og kan ikke ændres her.
- Linjelængde: løbende tekst i opskriften og trin for trin er højst 640 px (40 kolonner, ca. 70 tegn), så linjerne ikke bliver for lange på iPad og Mac.
- `CLAUDE.md` og skabelonen er opdateret: opskriftens dele kan tilpasses, felter flyttes i rækkefølge, lister har skabelon, og Grydelil peger på nøgler.

## 1.9.0 · Sidebygger, fase 3: flyt, tilføj og slet
- Felter flyttes i rækkefølge i stedet for med pixels: «↑ Flyt op», «↓ Flyt ned», «Smallere», «Bredere» (tredjedel, halv, hel, i hele kolonner), «Til den anden side» og «Egen plads» i vinduet, når du trykker på et felt. Feltet flyttes i koden, så tastatur og skærmlæser følger med, og to felter kan aldrig ligge oven på hinanden.
- Træk: hold fingeren på et felt, så vises de steder, det kan lande, som streger. Den nærmeste er markeret med «Her». Slipper du et andet sted, bliver feltet, hvor det var. Siden ruller med mod kanten.
- To pladser pr. felt: smal (iPhone, under 744 px) og bred (iPad og Mac). Flytter du på en bred skærm, ændres kun den brede plads. Har den brede ingen plads, bruges den smalle.
- «＋ Tilføj felt» (når du tilpasser): tekst, knap (til en side i appen eller en adresse på nettet), billede (fra en adresse), afstand (1 eller 2 rækker) og beholder (en ramme). Feltet kommer øverst på det, du kan se. Dine egne felter slettes med «Slet feltet», og beskeden har «Fortryd». Appens egne felter kan skjules, men ikke slettes.
- «Med ramme»/«Uden ramme» på dine egne felter.
- Fortryd og gentag gælder også flytninger, nye og slettede felter. Fortryder du en flytning, går feltet tilbage til sin plads.
- Appen henter tilpasningerne igen, når den får fokus, og siger til, hvis en anden enhed har ændret noget.
- Tip første gang, du tilpasser. Det kan vises igen under Indstillinger («Vis tippet om tilpasning igen»).
- Animationer: et felt glider til sin nye plads på 200 ms (ikke med reduceret bevægelse).
- Beslutning: Felter, der er låst på skærmen, flyttes stadig med pixels (de svæver over siden). Alle andre bruger rækkefølgen.

## 1.8.0 · Sidebygger, fase 2: felter og skabeloner
- Ny model for felterne: et felt, du ændrer, får en række med hele sin stil (og senere sin plads) i tabellen «objekter». Findes tabellen ikke endnu, gemmes rækken i «tilpasning» under nøglen «obj|…». Dine gamle tilpasninger gælder stadig, til feltet ændres. SQL til tabellen: `supabase/objekter.sql`.
- Lister har en skabelon: overskrifterne i «Hvad har du derhjemme?», dagene på Madplan og retterne i dagene. Ændrer du én overskrift (størrelse, farve), ændres alle. «Egen farve til dette felt» giver ét felt en anden farve. Det vises med «● egen farve», når du tilpasser, og «Følg listen igen» fjerner det. Plads, størrelse og tekst følger altid listen.
- Kontrast: vælger du en tekst- og feltfarve, der er svær at læse (under 4,5:1, eller 3:1 for stor tekst), står der «Teksten er svær at læse på den farve. Prøv en mørkere.»
- Tilpasseren kører kun, når siden får nyt indhold, ikke ved beskeder, ure og Grydelil.
- Grydelil peger på felternes id (data-tpid eller tilpasserens nøgle) i stedet for CSS-klasser. Er et felt skjult eller væk, springes trinnet over.
- Beslutning: Dagene på Madplan har fået ét fælles id (`mp-dag`). Deres gamle gemte forskydninger (`mp-dagfelt-en` …) gælder ikke længere. Det var dem, der lagde Dag 1 og Dag 3 oven på hinanden.
- Beslutning: Pladsen gemmes i «objekter» (rækkefølge, kant og bredde for smal og bred skærm) og ikke i en ny kolonne `pos_bred` på «tilpasning». Så kan «pos» blive, som den er, og en ældre version af appen virker stadig.

## 1.7.1 · Opdatering 3 er færdig
- Dine gemte placeringer i tilpasseren gælder igen (`IGNORER_GEMTE = false`). En placering, der ville lægge et felt oven på et andet eller uden for skærmen, ignoreres stadig. Nu tjekkes det igen, når et felt er flyttet tilbage, så to flyttede felter (fx «Sæt ind» og «Ryd» på import) ikke kan ende oven på hinanden.
- Kontrast: dæmpet tekst i mørkt tema er lidt lysere (blyant), og «Er ikke med» på Madplan er mindre dæmpet.
- Beslutning: Gennemgangen af dine placeringer sammen med dig er erstattet af omregningen i opdatering 2 (fase 5), hvor de gamle pixelplaceringer bliver til rækkefølge og kant.

## 1.7.0 · Mac: tastatur og mus (fase 3d)
- Tastatur: Escape lukker det øverste (menu, vindue, forklaring, Grydelils boble eller rundvisning). `/` eller ⌘K (Ctrl+K) søger i opskrifterne (eller i tips, når man er der). ⌘1–5 går til Opskrifter, Tips, Hvad kan jeg lave?, Madplan og Indstillinger. I browseren tager Chrome selv ⌘1–5, så ⌥1–5 virker også.
- Trin for trin: → eller mellemrum er «Næste», ← er «Tilbage».
- Vinduer (ark): fokus flytter ind i vinduet, Tab bliver i det, og fokus kommer tilbage til knappen, man kom fra. På touch flytter fokus kun, når man bruger tastatur, så skærmtastaturet ikke dukker op af sig selv.
- Mac (bred skærm med mus): intet fast nederst over indholdet. Grydelil og «Vis hjælper» står nederst i sidebjælken, og boblen åbner mod højre. Trin for trin har knapperne i siden under trinnet.
- Beslutning: Tryk-flade på 48 px gælder kun touch (fra 1.2.0). Med mus er felterne som før.

## 1.6.1 · Gemte placeringer ignoreres under opdatering 3
- Tilpasserens gemte placeringer (tabellen «tilpasning») ignoreres, til opdatering 3 er færdig. Kun STANDARD i `tilpas.js` gælder (`IGNORER_GEMTE`). Databasen er urørt. Sæt `IGNORER_GEMTE = false`, når opdateringen er færdig.
- Madplan: valgene står i et kort (handlinger til venstre, dagvalg og tal til højre fra 744 px). Dagene står i kolonner under.
- Import-siderne er højst 704 px brede som formularerne.
- Chips har 44 px tryk-flade.

## 1.6.0 · «Hvad kan jeg lave?», madplan og formularer (fase 3c)
- «Hvad kan jeg lave?» i to ruder, når «to ruder» er slået til og skærmen er bred: det, du har derhjemme, i et kort til venstre (ruller for sig), forslagene og «Madplan» til højre. Ellers én kolonne som før, med samme rækkefølge.
- Kategorierne i ingredienslisten kan foldes sammen (tryk på navnet). Valget huskes på enheden.
- «Madplan» står øverst i højre rude og ikke længere over det første forslag.
- Madplan er uændret i opbygningen: dagene står i kolonner (1, 2 eller 3 efter bredden), og valgene står over dem. Beslutning: Valgene blev ikke samlet i et kort, fordi dine gemte placeringer i tilpasseren er målt fra de nuværende steder og ville ende forkert.
- Formularer er altid én kolonne på højst 704 px (44 kolonner). Knapper har deres egen bredde (før var «Gem» 910 px).
- «Gem» sidder ikke længere fast over indholdet, men står i flowet efter sidste felt, så den aldrig dækker kategorier eller sværhedsvalg. Beslutning: Den kan ikke længere ses uden at rulle ned på lange formularer.
- «Fjern linjen» er 44 × 44 px og har eget sted til højre i feltet (teksten kommer aldrig ind under den).
- Navne: «Fortryd» bruges kun om at fortryde en ændring, «Tilbage» om at gå et skridt tilbage og «Annuller» om at forlade en formular.

## 1.5.2 · «Tilbage» i højre rude, værktøjsknapper til højre
- Højre rude har «Tilbage» på første række. Den går til listen alene (ikke til forrige opskrift). Kommer man fra «Hvad kan jeg lave?», går den dertil som før.
- «Tilføj tip» og «Rediger» står helt til højre på samme række som «Tilbage». Standardplaceringerne er skrevet om fra pixels til «ved højre kant, afstand fra kanten» (kant 1), så de passer til alle bredder. Før lå «Tilføj tip» oven på «Tilbage» på brede skærme.
- «Tilføj tip» alene (ny opskrift) står også helt til højre (eget id `tip-alene`).
- Beslutning: Erstatter beslutningen i 1.5.1 om ingen «Luk»-knap. Pladsen på første række var optaget af de to knapper, og det er løst ved at flytte dem til højre.
- Gemte placeringer i databasen er uændrede. Har du selv flyttet knapperne, gælder dine placeringer fortsat.

## 1.5.1 · Rettelser til to ruder (fase 3b)
- To ruder vises kun, når en opskrift er valgt. Uden valgt opskrift står listen alene i fuld bredde (to kolonner fra 744 px). Søgning og filtre bevares, når man åbner en opskrift, og når man går tilbage til listen.
- Listen til venstre er et farvet kort med skygge og kant, så ruderne er tydeligt adskilt. Kortet slutter over navigationsbjælken og følger safe areas (før kunne de nederste rækker ligge bag bjælken på iPad).
- Hele opskriftens navn vises: lange navne brækker over på flere linjer i stedet for at blive klippet med «…». Rækkerne er stadig hele rækker à 32 px.
- Kategori og køkken er valgfelter i ruden (hele navnet, hele listen) i stedet for rækker af chips, der rullede ud af ruden.
- «Tilføj med Claude» og «Importér links» ligger i en «Importér»-menu i ruden, så kun «Ny opskrift» og «Importér» står før søgningen. «Tilbage» udgår i ruden (navigationen findes).
- Ruden er 352 px (før 320). Ingredienser og trin side om side kræver derfor lidt mere plads: 1154 px med touch og 1362 px med mus.
- Beslutning: Ingen «Luk»-knap i højre rude. «Opskrifter» i navigationen går til listen alene. En ekstra tilbage-knap ville ligge oven på «Tilføj tip» og «Rediger», som tilpasserens gemte placeringer lægger på første række.
- Beslutning: Valgfelter i stedet for chips i ruden, fordi 7 kategorier og 11 køkkener ikke kan stå i 328 px uden at fylde meget eller rulle ud af ruden.

## 1.5.0 · Fase 3b: opskrifter og en opskrift
- To ruder som indstilling («Vis to ruder på brede skærme» under Indstillinger). På skærme fra 1024 px står opskriftslisten til venstre og den valgte opskrift til højre. Listen ruller for sig og bliver stående, når man vælger en ny opskrift. Kan slås til og fra uden genindlæsning.
- Er ruden bred nok (ca. 720 px), står ingredienser til venstre og trin til højre i opskriften.
- Tæt opskriftsliste: to linjer pr. opskrift (navn + kategori, køkken og tid) i stedet for kort, med bogstav-overskrifter. To kolonner fra 744 px, når to ruder ikke vises. Listen er ca. 13.700 px høj på iPhone mod 31.400 før.
- «Favoritter» er et filter i listen.
- Filtre: på smalle skærme toner rækken ud i højre side, så man ser, at der er flere. Fra 744 px står de på flere linjer.
- Opskriftssiden: stjernen står ved titlen, «Vores side» er flyttet ned under stjerner og tips, og «Slet» står for sig selv nederst.
- Beslutning: To ruder er som standard slået til med mus (Mac) og fra med touch (iPad). Valget gemmes på enheden.
- Beslutning: «Vores side» er flyttet ned (stod åbent i planen). Det kan let flyttes tilbage.
- Beslutning: Ruderne laves uden container queries, fordi de ville flytte felter, der er låst på skærmen i tilpasseren. Bredden afgøres med media queries.

## 1.4.1 · Rettelser til navigationen
- iPhone på højkant: bjælken sidder lavere (tæt på hjemmestregen). iPad og iPhone på langs er uændret.
- Tilpasserens knap står i navigationen med ikon og lille tekst, når «Tilpas siden» er slået til. Den gør det samme som før (pause og tilpas igen). Krydset «Forlad tilpasseren» er fjernet. Tilpasseren slås fra under Indstillinger.
- «Mere» hedder «Indstillinger».

## 1.4.0 · Fase 3a: navigation og lav højde
- Fem destinationer med ikon og tekst: Opskrifter, Tips, Hvad kan jeg lave?, Madplan og Mere. Den aktuelle er markeret (`aria-current`).
- Bjælke nederst på telefon og tablet. Sidebjælke til venstre på brede skærme med mus (mindst 1024 px, `hover` og `pointer: fine`), med «Kogebog» som vej til forsiden. Valgt efter plads og input, ikke efter enhed.
- Lav højde (højst 520 px, telefon på langs): navigationen står øverst i siden, intet sidder fast på skærmen (heller ikke felter låst i tilpasseren og «Gem»), og Grydelil er skjult.
- Topbjælken er væk. Beskeder vises stadig øverst. «Genindlæs appen» ligger under «Mere». Forsiden nås med «Tilbage» (og «Kogebog» i sidebjælken).
- Alt, der sidder fast nederst (Grydelil, «Gem», trin for trin, tilpasserens knapper), er løftet over bjælken med `--nav-b`. Trin for trin viser ikke navigationen.
- Nyt ikon: `kalender` (Madplan).
- Beslutning: «Hvad kan jeg lave?» beholder sit fulde navn i bjælken (to linjer à 12 px), så siden og bjælken hedder det samme.

## 1.3.0 · Fase 1c: brug og tekster
- Fjern en ingrediens (og fjern en ting i «Tjek ingredienserne») viser «Fortryd» i beskeden. Beskeder står i 4 sekunder, og dem med «Fortryd» i 8.
- Fejl står, til man trykker «Luk», handler eller skifter side, har kant og knap (ikke kun farve) og siger, hvad der skete, og hvad man gør. Fejl i `tilpas.js` er ikke ændret, fordi tilpasseren er et eget system.
- Synlige navne («Antal», «Enhed», «Ingrediens») over felterne i formularen, i listen og i gennemgangen. Placeholder bruges kun til eksempler («fx 2», «fx gulerødder»).
- «Andet» og «Ikke kategoriseret» hedder nu begge «Ikke sorteret» og står i én gruppe. Databasen er uændret (kategorien hedder stadig «Andet»), og Claude bliver bedt om at skrive «Ikke sorteret». «Ret kun ikke sorterede» tager nu også ting i «Andet» med.
- «Du mangler lidt» viser «Viser 20 af 32 retter» og en «Vis flere»-knap.
- Feltet til at tilføje ingredienser står øverst på «Hvad kan jeg lave?», før resultaterne. Grydelils trin passer stadig, fordi de peger på `#hj-boks` og `#forslag-nu`.
- Tydelig fokusring (3 px, kontrast over 5:1 i begge temaer) på skrivefelter i stedet for kun en ændret kant.
- «Fortryd» betyder nu kun fortryd. Knapper, der går tilbage uden at gemme, hedder «Annuller».
- Beslutning (mængde): Mængden bruges ikke til at finde retter. En kort tekst siger det, i stedet for at ændre beregningen. Rasmus kan i stedet vælge, at mængden skal tælle med, men det er en større ændring.
- Ikke ændret: `ENH` i `hjemme.js` og `ENHEDER` i `app.js` og `parseIng` er ikke testet endnu (planen siger, de kun testes, før de kaldes fejl).

## 1.2.0 · Fase 1b: grundting
- Versionen står kun i `index.html` (`window.KOGEBOG`). Den bruges til `?v=` på filerne, til cachens navn i `sw.js` og til teksten «Version … · dato» nederst under «Mere».
- Skrifttyperne (Caveat Brush og Patrick Hand, licens OFL) ligger i `skrifter/` som `.woff2` i stedet for at komme fra Google Fonts. De har `font-display: swap` og en erstatning med samme bredde (`size-adjust`), og `sw.js` gemmer dem.
- `sw.js` sletter gamle versioners cacher, når en ny version tages i brug.
- Tryk-område på 48 px med touch: et tryk op til 8 px over eller under en lille knap rammer knappen. Kun lodret og kun, hvor trykket ikke ligger på noget andet. Med mus og tastatur er intet ændret.
- CSS-dubletter fjernet (hover på knapper, `.knap:active`, `@keyframes hjblink`). Udseendet er uændret.
- Beslutning: Tryk-området laves med JavaScript (`Tryk` i `app.js`) og ikke med `::after`, fordi knapper og tilbage-knapper har `overflow: hidden`, og deres `::before` og `::after` bruges til glans. Rækker af ingredienser og lister med tætte rækker er uændrede og afgøres i opdatering 3.
- Beslutning: Erstatningsskriften (`size-adjust` 76,5 % og 78 %) er målt mod Chalkboard SE. Telefoner uden den skrift bruger standardskriften, og så kan linjeskift afvige lidt, indtil skriften er hentet.

## 1.1.0 · Fase 1a: nettet
- Indholdet er altid et helt antal kolonner à 16 px bredt, og marginlinjen følger kolonnen.
- Kort, rækker, kategorivalg, madplanens chips og knapper står på rækker (32 px) og kolonner (16 px) på alle skærmbredder.
- Skrivefelter vokser i hele rækker.
- Gamle placeringer i tilpasseren rundes kun af på skærmen (data ændres ikke) og flyttes ind på skærmen, hvis de ellers ville ligge uden for eller oven på andre felter.
- Beslutning: Omskrivning af gemte placeringer til nettet hører til opdatering 2 (sidebygger).
