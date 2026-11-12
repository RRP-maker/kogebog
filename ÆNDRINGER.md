# Ændringer i Kogebog

Nyeste øverst. Hver version har et git-tag (`v1.1.0` osv.). Beslutninger skrives under versionen.

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
