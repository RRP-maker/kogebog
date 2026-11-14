# Ændringer i Kogebog

Nyeste øverst. Hver version har et git-tag (`v1.1.0` osv.). Beslutninger skrives under versionen.

## 2.9.1 · Søgevalg inde i søgefeltet
- Begge / Navn / Ingredienser sidder nu inde i søgefeltets ramme, nederst, som plus og minus i ingredienslisten (`.soegblok`, 96 px højde). Før var de en separat strimmel under feltet.

## 2.9.0 · Mærker på opskrifter, kameraknap og søgeblok
- **Mærke på opskrifter** (`kilde`: `egen` eller `importeret`, `supabase/kilde.sql`, kørt i Supabase). «Importér opskrift» gemmer som importeret, formularen som min egen. Øverst i formularen (også ved Tilpas) kan det skiftes. Mærket står blandt kategori og køkken på opskriften. Alle gamle opskrifter blev «min egen».
- **«Mine egne»** over søgefeltet: tændt = kun egne, slukket = alle. Tændt som standard, hver gang listen åbnes, medmindre man slår «Vis kun mine egne opskrifter som standard» fra under Indstillinger (`egneStandard`). Mærket vises i rækken, når alle vises.
- **Billeder** hører nu til under Navn i formularen. Tilføj er en rund kameraknap uden tekst; den åbner et valg: «Tag billede» eller «Vælg fra enheden». Sektionen ligger inde i formularen, men Fortryd og Gentag rører den ikke (`#bil-ed` springes over i `navTilpas`).
- **Søgefeltet og Begge / Navn / Ingredienser** er ét sammenhængende felt (`.soegblok`).
- Beslutning: kolonnen er `text` med `check`, ikke en enum, så en ny værdi kan tilføjes uden at ændre typen.
- Ikke prøvet: iPhone (kamera og filvalg), skærmlæser.

## 2.8.1 · Import fra hjemmeside uden JSON-LD
- `tekstTilOpskrift`: trinene stopper ved sidens knapper, tips, forslag og kommentarer (fx «Føj til indkøbsseddel», «Tip til opskriften»). Navnet tages fra sidens titel (uden « | Sidenavn»), og menu- og tilbudslinjer som «Tilmeld Premium» springes over. Testet med valdemarsro.dk/kyllingefrikadeller: 9 ingredienser og 3 trin i stedet for en side fuld af uvedkommende tekst.

## 2.8.0 · Importér opskrift, knapper under skrivefelter og bjælkens animation
- **«Importér opskrift»** erstatter «Tilføj med Claude» og «Importér links» (`#/import`, `linkimport.js`). Ét felt: sæt et eller flere links ind, sæt teksten fra en side ind, eller skriv selv. Mere end 40 tegn ud over links læses som tekst.
- **Tekst læses i appen** (`LinkImport.tekstTilOpskrift`): navnet øverst, «Ingredienser» og «Sådan gør du» (eller de engelske ord) deler teksten. Uden overskrifter er linjer med tal forrest ingredienser. En linje med kolon til sidst er en gruppe («Sovs:»). Opskriften gemmes og åbnes, så den kan tjekkes.
- **Funktionen `hent-opskrift`:** sender billedets adresse med, sender sidens tekst, når der ikke er JSON-LD, læser teksten under opslag på TikTok (oEmbed), Instagram og Facebook (forhåndsvisningens tekst), og henter et billede for appen (`{ billede }`, kun billeder, højst 8 MB). Skal lægges ind i Supabase igen.
- **Billede fra hjemmesider** gemmes som forside (`Billeder.fraFil`). Fejler billedet, er opskriften stadig gemt («uden billede»). Ikke fra sociale medier.
- **Sæt ind, Fortryd og Ryd** (`feltKnapper` i `app.js`): alle tre står der altid, er 32 px høje og kan ikke flyttes i Designer (tekst, størrelse og farve kan stadig ændres). Fortryd er slået fra, til der er noget at fortryde, og tager også «Sæt ind» tilbage. Ingen af dem åbner tastaturet.
- **Navigationsbjælken:** når knapperne skifter (normal, Tilpas, Designer), hopper de nye ind én efter én (0,3 s), og det valgte ikon vipper kort. Ved reduceret bevægelse sker skiftet uden bevægelse.
- Fjernet: siden «Tilføj med Claude» for opskrifter, `kopierBesked`, `gemImport` og «Importér»-menuen. «Opdater med Claude» og «Tilføj tips med Claude» er uændrede.
- Beslutning: tekst læses med faste regler, ikke med en AI, så der ikke skal en nøgle ind. Står opskriften kun i en video, kan den ikke hentes.
- Beslutning: de nye knapper har nye id'er (`importer-…`), så gamle placeringer fra Designer ikke følger med.

## 2.7.0 · Designer: alle tekster, popupvinduer, tabeller og farver med rolle (opdatering 4d-2)
- **Alle faste tekster kan vælges:** også mellemoverskrifter, navne over felter, punkter i vejledninger, tabelhoveder og teksterne i appens popupvinduer. Data kan ikke ændres: navne, beskeder med «», fejlbeskeder, opskriftens linjer og tekster med et felt inde i sig.
- **Tekster, appen selv skifter** (fx en status), skrives ikke længere tilbage til den første tekst. Kun en tekst, du har ændret i Designer, sættes ind.
- **Feltfarve på alle felter:** også overskrifter og tekster (runde hjørner, teksten står stadig på nettet), kort, tællere og bjælker.
- **Popupvinduer:** mens Designer er slået til, står bjælken over vinduet, så Designer kan sættes på pause og i gang igen. Tryk på en tekst i vinduet: vinduet gemmes væk, mens feltet tilpasses, og kommer igen bagefter. Tekst og farver kan ændres, men felter i vinduer flyttes ikke. Id'et er `vindue:<overskrift>|<tekst>`. «Tilføj» er skjult, mens et vindue er åbent.
- **Tabeller** (`data-tpid` `ing-tabel` og `iv-tabel`): tekststørrelse, tekstfarve og feltfarve. Tabelhoveder kan ændres.
- **Ny knap til et popupvindue:** «Tilføj» → «Knap» → «Hvor fører knappen hen?» → «Et popupvindue», med overskrift og tekst (en tom linje = nyt afsnit). Gemmes i `objekter` som `link: 'popup'` og `indhold` (JSON). Knappens vindue tilpasses på knappen.
- **Farver vises med rolle:** «Grøn = Gem», «Lysegrøn = Salat» osv., i grupperne Handlinger, Kategorier og Uden fast betydning. De nye feltfarver bruger appens roller (`--gem`, `--kat-salat` …) med tekst fra `--paa-…`, så de følger temaet og har kontrast som rollerne.
- Ældre feltfarver vises som før. `smoer` og `rod` vises som «Gul = Tilpas» og «Rød = Slet» i Designer og gemmes som rollen, næste gang feltet gemmes (i mørkt tema er rollens gule lysere end den gamle).
- Beslutning: felter i vinduer flyttes ikke (sidebyggeren arbejder kun i siden).
- Kopi af `objekter` (50 rækker) før ændringen: `madplan`, række `kopi-objekter-4d2`. Slettes, når Rasmus har sagt god for 2.7.0.

## 2.6.0 · Billeder (opdatering 4e)
- **Flere billeder pr. opskrift.** Ét er forsiden (stjernen «Forside» i formularen). Forsiden vises øverst på opskriften og som lille billede foran navnet i listen. De andre billeder af hele retten står i en række under forsiden. Tryk på et billede for at se det stort.
- **Billeder på trin.** Ved hvert billede vælges «Hører til»: hele retten eller et trin. Trinnets billeder står under trinnet på opskriften og over teksten, når man laver retten trin for trin. Flyttes eller rettes trinnene, følger billedet med (trinnets tekst huskes).
- **Kamera og bibliotek.** «Tag billede» åbner kameraet, «Vælg billeder» åbner biblioteket (flere ad gangen).
- **Gøres mindre i appen** (`billeder.js`): JPEG, højst 1600 px på den lange led (kvalitet 80 %), og en lille udgave på 400 px til listen. Drejning fra telefonen rettes. Bliver en fil over 1 MB (lagerets grænse), sænkes kvaliteten og målene, til den passer.
- **Sendes ved «Gem».** «Annuller» kaster nye billeder væk. Slettede billeder slettes først ved «Gem». Går sendingen galt, er opskriften gemt, og «Gem» prøves igen (nye billeder sendes, intet bliver lavet to gange).
- **Sletning.** En opskrift slettes først efter, at filerne er væk fra lageret (tjekket med en liste bagefter). Fejler det, er intet slettet.
- **Værkstedet → Billeder → «Tjek lageret»:** antal billeder og filer, plads i alt, og filer uden opskrift (efter en afbrudt «Gem»), som kan slettes.
- **Kræver én SQL-kørsel:** `supabase/billeder.sql` (tabellen `opskrift_billeder`, lageret `opskrift-billeder`: offentligt, kun JPEG, højst 1 MB pr. fil, åbne regler som resten af appen). Før den er kørt, virker appen som før, og «Gem» med billeder giver en fejlbesked.
- Service workeren gemmer ikke billeder (browserens egen cache bruges), så lageret på enheden ikke vokser.
- **Ikke med:** billederne er ikke med i «Hent sikkerhedskopi» (kun tekst og tal).

## 2.5.0 · Ingredienser som rene data og Ingrediensværktøjet (opdatering 4c)
- **En ingrediens er kun selve varen.** Hver linje i en opskrift har nu `id` (ingrediensens id i kataloget) og `f` (forberedelse) ved siden af mængde, enhed og navn. Den vises med komma: «2 løg, finthakket». Ingen ny tabel: linjerne ligger stadig i `opskrifter.ingredienser`.
- **Ved «Gem»** (formularen, «Tilføj med Claude», links og «Opdater med Claude») lægges ingredienserne i kataloget først, og linjen får id og navn derfra (`Katalog.knyt`). «finthakket løg» bliver til «løg» med forberedelsen «finthakket» (`delIng`). I formularen skrives forberedelsen efter et komma. Beskeden til Claude beder om feltet «forberedelse».
- **Nyt: Ingrediensværktøjet** i Værkstedet (`ingvaerktoej.js`, `#/vaerksted/ingredienser`): kopiér listen til Claude, sæt rettelserne ind, se forhåndsvisningen (lægges sammen, nyt navn, slettes, nye, linjer før og efter), afgør tvivl med Ja eller Nej, og gem. To ingredienser med samme navn lægges sammen, og «Derhjemme» flytter med.
- **Alt eller intet.** Rettelsen regnes ud i appen (`beregn`) og køres som én databasefunktion, `ingrediens_ret`, der først gemmer en kopi i `ingrediens_backup`. Fejler noget, er intet ændret. Funktionen stopper også, hvis en linje ikke peger på en ingrediens, eller hvis kataloget er ændret siden forhåndsvisningen.
- **Sikkerhedskopier** står nederst i værktøjet: «Gendan» (gemmer først det nuværende som en ny kopi) og «Slet kopien».
- **«Sortér og ret med Claude»** bruger nu samme funktion, så opskrifternes linjer følger med, når et navn rettes eller to ingredienser lægges sammen. Før kunne en sammenlægning stoppe halvvejs.
- Nye enheder i linjer: stængel, stængler, knivspids og shot. «finthakkede» og «grofthakkede» regnes som tilberedning.
- **Kræver én SQL-kørsel:** `supabase/ingredienser.sql` (kun tilføjelser, kan køres flere gange).
- Rettelserne til det nuværende katalog ligger i `supabase/rettelser/ingredienser-2026-11-13.json`.
- Testet: SQL i lokal Postgres 16 (ret, gendan sammenlignet med før på alle rækker, tilbagerulning ved fejl, kørt som anon). Headless med mock-Supabase, 390 px lyst og 1180 px mørkt: låst uden kode, eksport, fejl, tvivl, gem, gendan, formular, import og «Sortér og ret». Appens egen pakke er kørt mod Postgres. Ikke prøvet på iPhone, og skærmlæser er ikke testet.

## 2.4.1 · Skift kode
- Under «Lås» i Værkstedet står nu «Skift kode»: nuværende kode, ny kode to gange. Den nuværende kode tjekkes først og tæller med i ventetiden ved forkerte forsøg. Det nye hash erstatter det gamle i `madplan`.
- Glemt kode: slet stadig rækken `vaerksted-kode` i `madplan` i Supabase.

## 2.4.0 · Værkstedet med kode (opdatering 4d-1)
- **Nyt: Værkstedet** (`vaerksted.js`, `#/vaerksted`). Under Indstillinger står nu «Åbn Værkstedet». Her ligger Designer-afsnittet (Åbn Designer, tippet, nulstil tekster, vinduets højde), flyttet fra Indstillinger med uændrede `data-tpid`.
- **Koden er en spærring mod uheld, ikke sikkerhed.** Første gang vælger man koden i appen (mindst 4 tegn, skrives to gange). Kun et saltet hash (PBKDF2, SHA-256, 200.000 runder) ligger i Supabase, i tabellen `madplan` på rækken `vaerksted-kode`. Koden står ikke i repoet. Ingen SQL-kørsel er nødvendig.
- **Låst:** oplåsningen ligger i `sessionStorage`, så Værkstedet er låst igen, når appen er lukket. Er Designer tændt uden oplåsning, slukkes den ved start.
- **«Lås ikke Værkstedet på denne enhed»** (`localStorage`): Værkstedet er åbent uden kode. **«Lås nu»** låser og slår «Lås ikke» fra. **«Behold Designer»** kan kun slås til, når «Lås ikke» er til. Er den til, bliver Designer tændt, også efter «Lås nu». Slås «Lås ikke» fra, slås «Behold» også fra.
- **Forkert kode:** efter tre forsøg ventetid på 30 sekunder, derefter dobbelt så lang (højst 10 minutter). Ventetiden ligger på enheden og kan omgås, så den er kun en spærring mod uheld.
- **Fejl** vises som tekst øverst og ved feltet, og fokus flyttes til feltet (`formularer-og-input`). Koden kan indsættes og vises.
- Glemt kode: slet rækken `vaerksted-kode` i `madplan` (Supabase), så kan en ny vælges. Ingen «Skift kode» endnu.
- Testet (headless, mock-Supabase, 390 px): opret kode, for kort og ikke ens, genåbning låst, tre forkerte forsøg og ventetid, husket enhed, «Lås nu» med og uden «Behold Designer», ingen JS-fejl. Koden findes ikke i det, der sendes til databasen. Ikke prøvet på iPhone.

## 2.3.1 · Designer-knappen siger, hvad der sker, og bjælkens farvede knapper ligner de andre knapper
- Designer-knappen viser nu tilstanden i ord: «Designer er i gang» (palet) og «Designer holder pause» (pauseikon). Før sagde teksten, hvad et tryk gjorde, og det var svært at forstå (Rasmus). Hvad et tryk gør, står i `aria-label` og `title`.
- Gem, Tilføj tip og Annuller i bjælken har samme flade, kant, skygge og lysskær som de samme knapper i siden. Teksten står stadig under ikonet.
- Valg af kategori eller køkken med forslagsknapperne tæller nu som en ændring, som Fortryd kan tage tilbage.
- Testet (headless, 390 px): vælg kategori, ny linje med tekst og fjern en linje. Fortryd tager de tre ændringer tilbage én ad gangen, og Gentag lægger dem på igen. Retur laver stadig en ny linje efter Fortryd.

## 2.3.0 · Navigationsbjælkens fire tilstande og to ruder med Luk (opdatering 4b)
- **Bjælken skifter efter, hvad man gør.** Normal: navigationen. **Tilpas** (formularen til en opskrift eller et tip): Fortryd, Gentag, Gem (grøn), Tilføj tip (blåbær, kun opskrifter) og Annuller (melgrå). De stod før i siden («Annuller» øverst, «Tilføj tip» fast foroven, «Gem» nederst) og er flyttet, så der kun er ét af hver. **Designer i gang:** Fortryd, Gentag, Tilføj og Designer-knappen («Sæt på pause») i stedet for navigationen. **Designer på pause:** navigationen og Designer-knappen med pauseikon («Fortsæt Designer»).
- **Fortryd og Gentag i formularen** er nye: ét skridt pr. pause i skrivningen (0,7 s) eller pr. tilføjet eller fjernet linje, højst 50.
- Designerens Fortryd, Gentag og «Tilføj felt» svævede før over siden. Nu står de i bjælken, også på Mac (sidebjælken) og på trin for trin-siden.
- Alle knapper i bjælken har ikon og lille tekst, også Fortryd og Gentag (bjælkens egen regel). De runde knapper i siderne er stadig uden tekst.
- Telefon på langs: bjælken står i siden og bliver nu hængende foroven, mens formularen eller Designer er åben, så Gem ikke ruller væk.
- **To ruder:** På den store side til højre er «Tilbage» blevet til **Luk** (×, viser listen alene). Ved siden af er **Fuld skærm**, der skjuler listen. I fuld skærm står Luk stadig, og knappen bliver til «Vis listen igen». Fuld skærm glemmes, når opskriften lukkes. Siden «Hvad kan jeg lave?» i to ruder har stadig Tilbage, fordi den ikke er en åbnet ting.
- Indstillingen «Vis to ruder» ses kun på skærme, der er brede nok (mindst 1024 px).
- Nye ikoner: plus, annuller (cirkel med streg), designer (palet), fuld og lille skærm.
- Målt (headless, mock-data): 390 px: fem knapper à 70 × 56 px uden overlap. Med Designer på pause i formularen: seks à 58 × 56 px. 1440 px (sidebjælke) og 1180 px (iPad på langs): ingen JS-fejl.

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
