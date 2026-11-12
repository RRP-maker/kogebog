# Ændringer i Kogebog

Nyeste øverst. Hver version har et git-tag (`v1.1.0` osv.). Beslutninger skrives under versionen.

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
