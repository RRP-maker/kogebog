// Tilpas siden (sidebyggeren): når det er slået til, kan man trykke på et felt og ændre tekst, størrelse og farver, flytte det (op, ned, kant, bredde, eller hold og træk),
// tilføje egne felter (tekst, knap, billede, afstand, beholder) og slette dem igen. Felterne flyttes i rækkefølge, så de aldrig ligger oven på hinanden.
// Felter, der er låst på skærmen, svæver over siden og flyttes med pixels.
// Alt gemmes i Supabase i tabellen «objekter» (eller i «tilpasning» under «obj|nøgle», til tabellen findes) og dermed på alle enheder.
// De gamle tilpasninger fra før opdatering 2 (tabellen «tilpasning», pixelplaceringer) gælder, til de er regnet om (fase 5, se omregn).
const Tilpas = (() => {
  const VALG = '.knap, .tilbage, .fane, .logo, main h1, main h2, main p.lille, main p.tomt, main small, .mp-dagfelt, .mp-ret, .mp-rk > span, .hj-fold, .tp-egen'; // tp-egen: dine egne felter. hj-fold: overskrifterne i «Hvad har du derhjemme?» (en liste med skabelon) // de sidste: dagene, retternes felter og tællernes navne på Madplan
  const NEDE = '#form > button[type=submit]'; // «Gem» nederst i formularer: fast i CSS, uden for tilpasserens flytning
  const FAST = '.opsk'; // tekster inde i selve opskriften: kan ændres, men aldrig flyttes
  const KORT = '.kort:not([href^="#/opskrifter"]):not(.koebsforslag)', DELE = '.stepper[data-tpid] .rund, .stepper[data-tpid] input, .filter .chip', TRIN = '.stepper[data-tpid], .filter', TRINFLYT = TRIN.split(', ').map(x => x + '[data-flyt]').join(', '), FLYT = VALG + ', ' + DELE + ', ' + TRIN + ', ' + KORT + ', .opsk-felt'; // opsk-felt: opskriftens dele (datafelter)
  // Tæller på Madplan («−», skrivefelt, «+») og bjælker med mærker (kategorier, køkkener, søgning): delene kan tilpasses hver for sig (DELE), men et tryk-og-træk flytter hele tælleren eller bjælken (TRIN). // opskrifter kan ikke tilpasses
  const FELTSTR = [['s', 'Lille'], ['m', 'Normal'], ['l', 'Stor']]; // 32, 64 og 96 px: som mærker, knapper og faner
  const naturligZ = el => el.matches('.fane') ? 'l' : el.matches('.tilbage, .vaerktoej .knap') ? 's' : 'm';
  const standardFast = el => el.matches('.vaerktoej .knap');
  const lavt = () => matchMedia('(max-height: 520px)').matches; // lav højde (telefon på langs): intet sidder fast på skærmen
  const erFast = (el, k) => !lavt() && !el.closest('.top') && (get(k) && get(k).l !== undefined ? !!get(k).l : standardFast(el));
  // Fastlåst felt: position: fixed (browseren ruller det selv, så det hakker ikke). En usynlig kopi holder pladsen på siden.
  const fjernFast = el => {
    if (!el._ph) return;
    el._ph.remove(); el._ph = null;
    ['position', 'margin', 'left', 'top', 'width', 'zIndex'].forEach(k => { el.style[k] = ''; });
  };
  // Gitterets mål (KOL og RAEKKE) læses fra style.css i app.js, så der ikke står tal i koden.
  // En gemt placering passer måske ikke til den skærm, man bruger nu (iPad → iPhone, eller vendt om). Den må aldrig sende et felt uden for skærmen eller oven på et andet felt.
  // Gør den det, ignoreres først den vandrette forskydning og så hele placeringen. Kun visning, intet gemmes.
  const ANDRE = '.knap, .tilbage, .fane, .kort, .rund, .chip, .rk-knap, .favknap, input:not([type=checkbox]):not([type=radio]), textarea, select, .mp-dagfelt, .mp-ret';
  const IKKE = '.plads, #ark, #hjaelper, #hjaelper-vis, #toast, #tilpas-gruppe, .top, #ure, #nav';
  function paaFelt(el, r = el.getBoundingClientRect()) {
    if (!r.width || el.hasAttribute('data-laast')) return false; // fastlåste felter svæver over siden, som de skal
    for (const e of document.querySelectorAll(ANDRE)) {
      if (e === el || e.contains(el) || el.contains(e) || e.hasAttribute('data-laast') || e.closest(IKKE) || (el._ph && (e === el._ph || el._ph.contains(e)))) continue;
      const q = e.getBoundingClientRect();
      if (q.width && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && Math.min(q.right, r.right) - Math.max(q.left, r.left) > 4 && Math.min(q.bottom, r.bottom) - Math.max(q.top, r.top) > 4) return true;
    }
    return false;
  }
  const SKAERM = 8; // mindste afstand til skærmkanten
  const uheldig = el => { const r = el.getBoundingClientRect(), vw = document.documentElement.clientWidth; return !!r.width && (r.left < SKAERM - .5 || r.right > vw - SKAERM + .5 || paaFelt(el, r)); };
  // Vandret placering: en forskydning i px fra feltets normale plads passer kun til den skærmbredde, den blev lavet på (iPhone: 340 px bred kolonne, iPad: 770 px).
  // Derfor husker et flyttet felt, om det sidder ved venstre eller højre kant af kolonnen, og hvor langt fra kanten (pos: «dx,dy,kant,afstand», kant 0 = venstre, 1 = højre).
  // Ældre placeringer («dx,dy») gælder en iPhone-kolonne på 340 px og regnes om til en kant og en afstand.
  const REF = 340;
  const kolonne = () => { const m = document.querySelector('main'), r = m.getBoundingClientRect(), cs = getComputedStyle(m); return { l: r.left + parseFloat(cs.paddingLeft), r: r.right - parseFloat(cs.paddingRight) }; };
  function dxAf(p, natL, w, inde) {
    if (!p) return 0;
    if (inde) return p[0];
    const K = kolonne(); let kant, afst;
    if (p.length >= 4) { kant = p[2]; afst = p[3]; }
    else {
      const ven = natL - K.l, hoj = K.r - (natL + w), refL = ven <= hoj ? ven + p[0] : REF - w - hoj + p[0];
      if (refL + w / 2 > REF / 2) { kant = 1; afst = REF - refL - w; } else { kant = 0; afst = refL; }
    }
    return (kant ? K.r - afst - w : K.l + afst) - natL;
  }
  // ign: 0 = hele placeringen, 1 = uden den vandrette forskydning, 2 = uden placering (se uheldig)
  // Placeringer, der blev gemt før gitteret (pixels fra det gamle net), vises rundet af til hele kolonner og rækker fra feltets plads. De gemte data røres ikke.
  const paaNet = (v, m) => Math.round(v / m) * m || 0;
  function plac(el, p, fast, ign = 0) {
    el._dy = !p || ign === 2 ? 0 : paaNet(p[1], RAEKKE());
    if (!fast) {
      fjernFast(el); el.style.translate = ''; el._dx = 0;
      if (p) { const r0 = el.getBoundingClientRect(); el._dx = ign ? 0 : paaNet(dxAf(p, r0.left, r0.width, !!indeI(el)), KOL()); el.style.translate = `${el._dx}px ${el._dy}px`; }
      return;
    }
    let ph = el._ph;
    if (!ph || !ph.isConnected) {
      ph = el._ph = el.cloneNode(true); ph.classList.add('plads'); ph.setAttribute('aria-hidden', 'true');
      ['data-flyt', 'data-laast', 'data-org', 'data-h', 'id', 'href'].forEach(a => ph.removeAttribute(a));
      ph.querySelectorAll('[id]').forEach(x => x.removeAttribute('id'));
      Object.assign(ph.style, { visibility: 'hidden', pointerEvents: 'none', translate: 'none', position: '', left: '', top: '', width: '', zIndex: '' });
      el.before(ph);
    } else if (ph.innerHTML !== el.innerHTML) ph.innerHTML = el.innerHTML;
    if (el.dataset.fs) ph.dataset.fs = el.dataset.fs; else delete ph.dataset.fs;
    ph.style.fontSize = el.style.fontSize; ph.style.display = el.style.display;
    const r = ph.getBoundingClientRect(); if (!r.width) return;
    Object.assign(el.style, { position: 'fixed', margin: '0', translate: 'none', left: (r.left + (el._dx = ign ? 0 : paaNet(dxAf(p, r.left, r.width, !!indeI(el)), KOL()))) + 'px', top: (r.top + scrollY + el._dy) + 'px', width: r.width + 'px', zIndex: '19' });
  }
  // Felter inde i et felt (retterne i en dag på Madplan): deres placering gemmes som en forskydning, så den passer til alle dage.
  const indeI = el => el.matches('.mp-ret') ? el.parentElement.closest('.mp-dagfelt') : null;
  const STR = [[17, 'Lille'], [20, 'Normal'], [24, 'Stor'], [34, 'Størst']]; // faste skriftstørrelser i px. 34 er skriften på forsidens faner.
  const GAMLE = { 0.85: 17, 1: 20, 1.2: 24, 1.45: 34 }; // tidligere gemt som gange den originale størrelse
  const pxAf = s => s >= 5 ? s : (GAMLE[s] || 20);
  const naermestStr = px => STR.reduce((b, [v]) => Math.abs(v - px) < Math.abs(b - px) ? v : b, STR[0][0]);
  // Farvevalg gemmes som navne, ikke hex-værdier, så de følger lyst/mørkt tema (rollerne --tp-* står i style.css)
  const TEKSTFARVER = ['blaek', 'blyant', 'rod', 'tomat', 'groen', 'gryde', 'guld', 'rosa', 'hvid', 'sort']; // de to første er appens egne standardfarver
  const FELTFARVER = ['smoer', 'mynte', 'rosa', 'himmel', 'hvid', 'rod', 'gryde', 'indigo']; // plus «glas» (gennemsigtigt Liquid Glass)
  const TEKST_CSS = { blaek: 'var(--blaek)', blyant: 'var(--blyant)', rod: 'var(--tomat-mork)', tomat: 'var(--tomat)', groen: 'var(--tp-groen)', gryde: 'var(--gryde-mork)', guld: 'var(--tp-guld)', rosa: 'var(--tp-rosa)', hvid: '#fff', sort: '#222' };
  const FELT_CSS = { smoer: 'var(--fl-smoer)', mynte: 'var(--fl-mynte)', rosa: 'var(--fl-rosa)', himmel: 'var(--fl-himmel)', hvid: 'var(--fl-hvid)', rod: 'var(--fl-rod)', gryde: 'var(--fl-gryde)', indigo: 'var(--fl-indigo)' }; // skifter med lyst/mørkt tema
  const FELT_TEKST = { smoer: 'var(--paa-felt)', mynte: 'var(--paa-felt)', rosa: 'var(--paa-felt)', himmel: 'var(--paa-felt)', hvid: 'var(--paa-felt)', rod: '#fff', gryde: '#fff', indigo: '#fff' }; // tekst, der altid kan læses på feltets farve
  const NAVN = { blaek: 'Blæk', blyant: 'Blyant', rod: 'Mørkerød', tomat: 'Tomat', groen: 'Grøn', gryde: 'Turkis', guld: 'Guld', rosa: 'Rosa', hvid: 'Hvid', sort: 'Sort', smoer: 'Smørgul', mynte: 'Mynte', himmel: 'Lyseblå', indigo: 'Mørkeblå' };
  const tCss = n => TEKST_CSS[n] || '', fCss = n => FELT_CSS[n] || '';
  // Tekster, der står på forsiden, kan aldrig skjules (heller ikke på andre sider, hvor den samme tekst står)
  const beskyttet = new Set(['Kogebog', 'Hvad skal vi lave?', 'Opskrifter', 'Tips', 'Hvad kan jeg lave?', 'Favoritter', ...lager.hent('tpForside', [])]);
  let til = lager.hent('tilpasTil', false), timer, aktiv = lager.hent('tilpasAktiv', true), server = false, data = lager.hent('tilpas', {});
  // Hvert felt har et id (data-tpid). Har feltet ikke selv et, laves det af siden og teksten. Felter, der hænger sammen, får samme data-tpid i koden.
  // Tilpasninger, der før var gemt på teksten, gælder stadig, til feltet ændres første gang (arv).
  const arv = {}, arvFelt = {};
  // Tekster på knapper og faner. En overskrift med samme tekst som en knap, der fører til siden, arver intet fra knappen.
  const feltTekster = new Set(['Hvad kan jeg lave?', 'Opskrifter', 'Tips', 'Tilføj med Claude', 'Mere', 'Indstillinger', 'Ny opskrift', 'Nyt tip', ...lager.hent('tpFeltTekster', [])]);
  // Standardværdier: placeringer, størrelser, tekster og farver, som felterne har efter gennemgangen. «Nulstil» går tilbage til dem.
  const STANDARD = {
    "forside|hvad-skal-vi-lave": {}, "forslag|hvad-kan-jeg-lave": {}, "Ingredienser": {}, "tip-rediger": {}, "tip-slet": {}, // tomme: feltet arver ikke fra teksten (fx «Tilpas» på opskriften)
    "Kopiér besked": {"s": 20, "z": "s"},
    "Sæt ind": {"s": 20, "z": "s"},
    "Tips": {"s": 34},
    "Sæt svar ind": {"z": "s", "p": [228, -12.5]},
    "Ryd svar": {"p": [-128.94, 3.5]},
    "‹ Fortryd": {"l": true},
    "import-svar-saet": {"s": 20, "z": "s"},
    "Hvad skal vi lave?": {"t": "Kogebogen", "s": 34},
    "forslag|hvad-har-du-derhjemme": {"p": [0, 34]},
    "Favoritter": {"p": [0, 2]},
    "Hvad kan jeg lave?": {"s": 34, "z": "l"},
    "Åbn Claude ›": {"p": [4, -4.5]},
    "Hvad har du derhjemme?": {"p": [0, -10]},
    "‹ Forside": {"l": true},
    "Du mangler lidt": {"t": "Der mangler"},
    "rediger": {"p": [0, -64, 1, 0]}, // «Tilpas» (data-tpid rediger, hed «Rediger» før 2.2.0): helt til højre, på «Tilbage»s række (kant 1 = højre, afstand fra kanten)
    "tip-alene": {"p": [0, -64, 1, 0]}, // «Tilføj tip» uden «Tilpas» ved siden af: helt til højre
    "Tilføj tip": {"p": [0, -64, 1, 128]}, // lige til venstre for «Tilpas» (dennes bredde + mellemrum; nettet runder af til 16 px)
    "▶ Lav retten trin for trin": {"t": "Lav retten trin for trin"},
    "slet": {"z": "s", "p": [-106.74, 36.7]},
    "tips|nyt-tip": {"z": "s"},
    "forside|hvad-kan-jeg-lave": {"s": 34, "b": "himmel", "z": "l"}
  };
  // Under opdatering 3 blev de gemte placeringer ignoreret (true). Opdateringen er færdig, så de gælder igen. Placeringer, der giver overlap eller sender et felt ud af skærmen, ignoreres stadig (se uheldig).
  const IGNORER_GEMTE = false;
  const D = k => !IGNORER_GEMTE && data[k] !== undefined ? data[k] : STANDARD[k];
  const gammel = (k, d = D) => { // tilpasninger fra før sidebyggeren (tabellen «tilpasning») og STANDARD
    if (d(k) !== undefined) return d(k);
    if (arv[k] === undefined || d(arv[k]) === undefined) return undefined;
    if (arvFelt[k] === false && feltTekster.has(arv[k])) return undefined; // gamle tilpasninger på teksten tilhører knappen
    return d(arv[k]);
  };
  const stdAf = k => gammel(k, x => STANDARD[x]); // kun appens egne standardværdier
  // ---------- Sidebyggerens felter (opdatering 2) ----------
  // Et felt, der er ændret efter opdatering 2, har en række i «objekter» med hele sin stil (tekst, størrelse, farver ...) og sin plads.
  // Findes tabellen ikke endnu, gemmes rækken i «tilpasning» under nøglen «obj|id» (felterne som JSON i kolonnen tekst). Ældre versioner af appen ser ikke de nøgler.
  // Undtagelser fra en skabelon (en liste) har nøglen «skabelon#element» og må kun have farve og baggrund.
  const OBJ = 'obj|';
  let obj = lager.hent('objekter', {}), objTabel = null; // objTabel: true = «objekter» findes, false = brug «tilpasning»
  const stilAf = o => {
    const r = {};
    if (o.tekst) r.t = o.tekst; if (o.stoerrelse) r.s = Number(o.stoerrelse); if (o.farve) r.f = o.farve; if (o.baggrund) r.b = o.baggrund;
    if (o.skjult) r.x = true; if (o.felt) r.z = o.felt; if (o.laast === true || o.laast === false) r.l = o.laast; if (o.ikkeflyt) r.m = true; if (o.ramme) r.r = true;
    if (o.pos) r.p = String(o.pos).split(',').map(Number);
    return r;
  };
  const get = k => {
    const o = obj[k];
    if (!o || o.undtagelse_for) return gammel(k);
    const r = stilAf(o), g = gammel(k) || {};
    if (!r.p && g.p && !omregnet(k)) r.p = g.p; // en gammel pixelplacering gælder, til den er regnet om (fase 5)
    else if (!r.p && omregnet(k) && (stdAf(k) || {}).p) r.p = stdAf(k).p; // appens egne standardplaceringer gælder altid
    if (plads(k) && !o.pos) delete r.p; // en ny plads (rækkefølge, kant, bredde) afløser pixelplaceringen. Kun felter, der er låst på skærmen, har en forskydning.
    return r;
  };
  const NULPLADS = { efter: null, efter_bred: null, kant: null, kant_bred: null, bredde: null, bredde_bred: null, omregnet: 'begge' }; // «Nulstil»: tilbage til feltets egen plads
  const omregnet = k => { const v = obj[k] && obj[k].omregnet; return v === true || v === 'begge' || v === (matchMedia('(min-width: 744px)').matches ? 'bred' : 'smal'); }; // den gamle pixelplacering er regnet om for den skærm, man bruger nu
  const undtag = el => el.dataset.tpinst ? obj[el.dataset.org + '#' + el.dataset.tpinst] : null;

  const slug = s => String(s).toLowerCase().replace(/[^a-zæøå]+/g, '-').replace(/^-|-$/g, '');
  const sideNavn = () => (location.hash || '#/').replace(/^#\/?/, '').split('/').filter(Boolean).map(s => /\d/.test(s) ? ':id' : s).join('/') || 'forside';
  const idAf = (el, tekst) => el.dataset.tpid || (el.matches('.tilbage') ? 'tilbage' + (el.classList.contains('fortryd') ? '-fortryd' : '') : sideNavn() + '|' + slug(tekst));
  const noder = el => [...el.childNodes].filter(n => n.nodeType === 3 && n.nodeValue.trim());
  const tekstAf = el => noder(el).map(n => n.nodeValue.trim()).join(' ');
  // Kun faste tekster kan ændres: ikke opskrifternes navne, tal og ure
  const egnet = (el, k) => k && !/\d/.test(k) && !el.closest('#ark, #tilpas-gruppe, #tilpas-knap, #tilpas-forlad, #tilpas-fortryd, #tilpas-gentag, .titelrakke, .h-boble, .tekst, .kort[href^="#/opskrifter"], .koebsforslag') && !(el.matches('p, small') && el.firstElementChild);

  let iGang = false;
  function anvend() { iGang = true; try { anvend0(); } finally { vagt.takeRecords(); iGang = false; } }
  function anvend0() {
    egne();
    document.body.classList.toggle('tilpas', til && aktiv);
    document.body.classList.toggle('tilpas-menu', til);
    const ryd = []; // beskyttede tekster, der står som skjulte: flaget fjernes
    document.querySelectorAll(VALG + ', ' + DELE).forEach(el => {
      if (el.classList.contains('plads')) return;
      if (el.dataset.orgtekst === undefined && tekstAf(el)) el.dataset.orgtekst = tekstAf(el);
      const leg = el.dataset.orgtekst || tekstAf(el);
      const k = el.dataset.org ?? idAf(el, leg);
      if (!egnet(el, el.dataset.tpid ? k : leg)) return;
      el.dataset.org = k;
      if (k !== leg) { arv[k] = leg; arvFelt[k] = el.matches('.knap, .tilbage, .fane'); }
      if (el.matches('.knap, .tilbage, .fane') && leg && !feltTekster.has(leg)) { feltTekster.add(leg); lager.gem('tpFeltTekster', [...feltTekster]); }
      if (document.body.dataset.side === 'forside' && !(beskyttet.has(k) && beskyttet.has(leg))) { beskyttet.add(k); beskyttet.add(leg); lager.gem('tpForside', [...beskyttet]); }
      const u = undtag(el), o = { ...(get(k) || {}) }, ny = (!el.dataset.tpinst && o.t) || leg, n = noder(el); // i en liste kommer teksten fra listen, ikke fra skabelonen
      if (u) { if (u.farve) o.f = u.farve; if (u.baggrund) o.b = u.baggrund; } // undtagelse: dette felt har sin egen farve
      el.toggleAttribute('data-tpegen', !!u);
      if (n.length && tekstAf(el) !== ny) { n[0].nodeValue = ny; n.slice(1).forEach(x => { x.nodeValue = ''; }); }
      if (!el.dataset.fs) el.dataset.fs = parseFloat(getComputedStyle(el).fontSize);
      el.style.fontSize = o.s ? pxAf(o.s) + 'px' : ''; el.classList.toggle('tp-staerst', !!o.s && pxAf(o.s) === 34); // de fire størrelser er faste skriftstørrelser i hele appen
      const ret = til && aktiv; // under tilpasning vises skjulte felter svagt, så de kan hentes tilbage
      const skj = !!o.x && !(beskyttet.has(k) || beskyttet.has(leg));
      if (o.x && !skj && !ryd.includes(k)) ryd.push(k);
      el.style.display = ''; el.style.visibility = skj && !ret ? 'hidden' : ''; el.style.pointerEvents = skj && !ret ? 'none' : ''; // et skjult felt beholder sin plads, så siden ikke kryber sammen
      el.style.opacity = skj && ret ? '.35' : '';
      el.style.color = tCss(o.f) || (FELT_TEKST[o.b] || '');
      el.style.background = o.b === 'glas' ? 'var(--glas)' : fCss(o.b);
      el.classList.toggle('tp-ramme', !!o.r);
    });
    if (ryd.length) setTimeout(() => ryd.forEach(k => { if (get(k) && get(k).x) { const ny = { ...get(k) }; delete ny.x; gem(k, ny, true); } }), 0);
    { // rækkefølge, kant og bredde (to gange, så felter, der peger på hinanden, også lander rigtigt)
      const alle = [...document.querySelectorAll(FLYT + ', .opsk-felt')].filter(el => !el.classList.contains('plads') && !el.closest('#ark'));
      for (let i = 0; i < 2; i++) alle.forEach(el => { if (drag && drag.laast && drag.el === el) return; const k = noegle(el); placer(el, k && kanPlaceres(el) ? plads(k) : null); });
      document.querySelectorAll('.opsk-felt').forEach(el => { const o = get(el.dataset.tpid) || {}; el.style.color = tCss(o.f); el.style.background = o.b === 'glas' ? 'var(--glas)' : fCss(o.b); el.classList.toggle('tp-ramme', !!(o.r || o.b)); }); // datafelter: farve og ramme
    }
    document.querySelectorAll(FLYT).forEach(el => { // felternes plads
      if (el.classList.contains('plads')) return;
      if (drag && drag.laast && drag.el === el) return;
      if (el.matches(NEDE)) { // «Gem» i en formular sidder altid fast nederst på skærmen (CSS). Den kan ikke flyttes eller låses af tilpasseren.
        fjernFast(el); el.style.translate = ''; el.removeAttribute('data-laast'); el.setAttribute('data-ikkeflyt', '');
        if (el.dataset.org) el.dataset.flyt = el.dataset.org;
        return;
      }
      const k = noegle(el);
      const p = !el.matches(FAST) && k && get(k) && get(k).p;
      if (k) el.dataset.flyt = k; else delete el.dataset.flyt;
      const fast = !el.matches(FAST) && !!k && erFast(el, k), o = (k && get(k)) || {};
      if (el.matches('.knap, .tilbage, .fane') && o.z) el.dataset.fs = o.z; else delete el.dataset.fs;
      el._ign = 0; plac(el, p, fast);
      el.toggleAttribute('data-laast', fast);
      el.toggleAttribute('data-ikkeflyt', !!o.m || el.matches(FAST) || !!el.dataset.tpinst); // et element i en liste flytter med listen, aldrig for sig selv
    });
    for (let runde = 0, flere = true; flere && runde < 3; runde++) { flere = false; // først når alle står på plads: ingen må ende uden for skærmen eller oven på et andet felt. Et felt, der flyttes tilbage, kan ramme et andet, så der tjekkes igen.
      document.querySelectorAll('[data-flyt]').forEach(el => {
        if (el.classList.contains('plads') || (drag && drag.laast && drag.el === el)) return;
        const p = !el.matches(FAST) && get(el.dataset.flyt) && get(el.dataset.flyt).p;
        if (!p || !uheldig(el)) return;
        const fast = el.hasAttribute('data-laast');
        flere = true; plac(el, p, fast, el._ign ? 2 : 1); el._ign = 1; if (uheldig(el)) plac(el, p, fast, 2);
      });
    }
    document.querySelectorAll('[data-tom]').forEach(c => { c.style.display = ''; delete c.dataset.tom; });
    if (server) omregnSnart(); // en række med skjulte felter beholder sin plads, så siden ikke kryber sammen
    bjaelke();
  }
  // Navigationsbjælken (opdatering 4b): når Designer er i gang, står Fortryd, Gentag, Tilføj og Designer-knappen i bjælken i stedet for navigationen.
  // På pause: navigationen og Designer-knappen med pauseikon. Ikonet viser tilstanden, teksten siger, hvad et tryk gør.
  const navKnap = (id, ikon, tekst, fkt) => { const x = document.createElement('button'); x.id = id; x.type = 'button'; x.className = 'nav-knap nav-designer'; x.innerHTML = `<span>${Ikoner.svg(ikon)}</span><span>${tekst}</span>`; x.addEventListener('click', fkt); return x; };
  function bjaelke() {
    let b = document.getElementById('tilpas-knap');
    const nav = document.getElementById('nav');
    if (til && !b) {
      b = document.createElement('button'); b.id = 'tilpas-knap'; b.type = 'button'; b.className = 'nav-knap';
      b.addEventListener('click', () => { aktiv = !aktiv; lager.gem('tilpasAktiv', aktiv); if (aktiv) tip(); anvend(); });
      nav.append(navKnap('tilpas-fortryd', 'fortryd', 'Fortryd', fortryd), navKnap('tilpas-gentag', 'gentag', 'Gentag', gentag), navKnap('tilpas-ny', 'plus', 'Tilføj', palette), b); // knapperne står i navigationen, så længe «Åbn Designer» er slået til under Indstillinger
    } else if (!til && b) { b.remove(); ['tilpas-fortryd', 'tilpas-gentag', 'tilpas-ny'].forEach(id => { const x = document.getElementById(id); if (x) x.remove(); }); }
    knapper();
    if (b) { b.innerHTML = `<span>${Ikoner.svg(aktiv ? 'designer' : 'pause')}</span><span>${aktiv ? 'Designer er i gang' : 'Designer holder pause'}</span>`; b.setAttribute('aria-label', aktiv ? 'Designer er i gang. Tryk for at holde pause' : 'Designer holder pause. Tryk for at fortsætte'); b.title = aktiv ? 'Tryk for at holde pause' : 'Tryk for at fortsætte'; }
  }
  // Kort tip første gang, man tilpasser. Det kan vises igen under Indstillinger.
  const TIP = 'Tryk på et felt for at ændre det. Flyt det med «Flyt op» og «Flyt ned», eller hold fingeren på det og træk. «Tilføj felt» laver et nyt felt, og «Fortryd» tager det sidste tilbage.';
  function tip() {
    if (lager.hent('tilpasTipSet', false)) return toast('Tryk på et felt for at ændre det. Hold og træk for at flytte.');
    lager.gem('tilpasTipSet', true);
    if (window.Hjaelper && !Hjaelper.skjult()) Hjaelper.sig(TIP, { stor: true, nu: true }); else toast(TIP);
  }
  // Fortryd og gentag: hver ændring gemmer et billede af tilpasningerne før ændringen
  let hist = [], frem = [];
  const kopi = d => JSON.parse(JSON.stringify(d));
  function knapper() {
    const u = document.getElementById('tilpas-fortryd'), g = document.getElementById('tilpas-gentag');
    if (u) u.disabled = !hist.length; // ses kun, når Designer ikke er på pause (body.tilpas, se style.css)
    if (g) g.disabled = !frem.length;
  }
  const billede = () => kopi({ data, obj });
  function husk() { hist.push(billede()); if (hist.length > 50) hist.shift(); frem = []; knapper(); }
  // Gem i «objekter» (eller i «tilpasning» under «obj|id», hvis tabellen mangler). Rækken har altid hele feltets stil, så de gamle tilpasninger ikke blandes ind.
  async function skrivObj(k, stille) {
    const o = obj[k];
    try {
      if (objTabel !== false) {
        try {
          if (o) await api('objekter?on_conflict=id', { method: 'POST', flet: true, body: { ...Object.fromEntries(KOLONNER.map(c => [c, null])), slettet: false, ...o, id: k, opdateret: new Date().toISOString() } }); // alle kolonner sendes, så en fjernet værdi (fx efter fortryd) også ryddes i tabellen
          else await api(`objekter?id=eq.${enc(k)}`, { method: 'DELETE' });
          objTabel = true;
        } catch (e) { if (objTabel === true || !/404|42P01|PGRST205|does not exist|schema cache/i.test(String(e.message))) throw e; objTabel = false; }
      }
      if (objTabel === false) {
        if (o) await api('tilpasning?on_conflict=noegle', { method: 'POST', flet: true, body: { noegle: OBJ + k, tekst: JSON.stringify(o) } });
        else await api(`tilpasning?noegle=eq.${enc(OBJ + k)}`, { method: 'DELETE' });
      }
      if (!stille) toast('Gemt');
    } catch (err) { console.error(err); fejlbesked('Ændringen er kun gemt på denne enhed. Der er ikke forbindelse til databasen. Prøv igen senere.'); }
  }
  const KOLONNER = ['side', 'efter', 'efter_bred', 'kant', 'kant_bred', 'bredde', 'bredde_bred', 'type', 'indhold', 'link', 'tekst', 'stoerrelse', 'farve', 'baggrund', 'felt', 'ramme', 'laast', 'ikkeflyt', 'skjult', 'pos', 'skabelon_for', 'undtagelse_for', 'omregnet'];
  const STILNOEGLER = ['tekst', 'stoerrelse', 'farve', 'baggrund', 'skjult', 'felt', 'laast', 'ikkeflyt', 'pos'];
  const tilRaekke = ny => ({ tekst: ny.t || null, stoerrelse: ny.s || null, farve: ny.f || null, baggrund: ny.b || null, skjult: !!ny.x, felt: ny.z || null, laast: ny.l === undefined ? null : !!ny.l, ikkeflyt: !!ny.m, pos: ny.p && ny.l ? ny.p.join(',') : null });
  // ny: feltets stil i den korte form (t, s, f, b, x, z, l, m, p). Pladsen (rækkefølge, kant, bredde) beholdes.
  async function gem(k, ny, stille, plads) {
    if (!stille) husk();
    const o = { ...(obj[k] || {}) };
    if (ny) Object.assign(o, tilRaekke(ny));
    if (plads) Object.assign(o, plads);
    obj[k] = o; lager.gem('objekter', obj); anvend();
    await skrivObj(k, stille);
  }
  async function fjernObj(k, stille) { if (!stille) husk(); delete obj[k]; lager.gem('objekter', obj); anvend(); await skrivObj(k, stille); }
  async function skift(ny) { // fortryd/gentag: sæt tilpasningerne tilbage og ret databasen, hvor noget er anderledes
    const foer = obj; data = ny.data; obj = ny.obj; lager.gem('tilpas', data); lager.gem('objekter', obj); anvend(); knapper();
    for (const k of new Set([...Object.keys(foer), ...Object.keys(obj)])) if (JSON.stringify(foer[k] || null) !== JSON.stringify(obj[k] || null)) await skrivObj(k, true);
  }
  function fortryd() { if (!hist.length) return; frem.push(billede()); skift(hist.pop()); toast('Fortrudt'); }
  function gentag() { if (!frem.length) return; hist.push(billede()); skift(frem.pop()); toast('Gentaget'); }
  let foersteHent; // den første hentning af placeringer: app.js venter på den, før indlæsningsskærmen fjernes
  async function hent() {
    try {
      const rader = await api('tilpasning?select=*');
      const foer = JSON.stringify([data, obj]);
      data = {}; let nyObj = {};
      for (const r of rader) {
        if (r.noegle.startsWith(OBJ)) { try { nyObj[r.noegle.slice(OBJ.length)] = JSON.parse(r.tekst); } catch (e) { /* ødelagt række: springes over */ } continue; }
        const o = Object.fromEntries(Object.entries({ t: r.tekst, s: r.stoerrelse && Number(r.stoerrelse), f: r.farve, b: r.baggrund, x: r.skjult, z: r.felt, l: r.laast, m: r.ikkeflyt, p: r.pos && String(r.pos).split(',').map(Number) }).filter(([, v]) => v));
        if (r.laast === false) o.l = false;
        data[r.noegle] = o;
      }
      // Findes «objekter», gælder kun den: «obj|»-rækkerne i «tilpasning» er kopieret dertil (supabase/objekter.sql), så et felt, der er fjernet, ikke kommer igen.
      try { const t = await api('objekter?select=*'); nyObj = {}; for (const r of t) { const { id, opdateret, ...o } = r; for (const x in o) if (o[x] === null) delete o[x]; nyObj[id] = o; } objTabel = true; }
      catch (e) { objTabel = false; } // tabellen findes ikke endnu: rækkerne står i «tilpasning»
      obj = nyObj;
      const aendret = server && JSON.stringify([data, obj]) !== foer;
      server = true; lager.gem('tilpas', data); lager.gem('objekter', obj); anvend();
      return aendret;
    } catch (err) { /* tabellen findes ikke endnu: brug det, der er gemt på enheden */ }
  }
  function saet(v) {
    til = !!v; if (til) { aktiv = false; lager.gem('tilpasAktiv', false); toast('Designer holder pause. Tryk på «Designer holder pause» nederst for at fortsætte.'); } lager.gem('tilpasTil', til); anvend();
    const c = document.getElementById('tilpastil'); if (c) c.checked = til;
  }
  const rgbAf = t => (String(t).match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const probe = css => { const e = document.createElement('span'); e.style.color = css; document.body.appendChild(e); const r = rgbAf(getComputedStyle(e).color); e.remove(); return r; };
  const naermest = (liste, rgb, css) => liste.reduce((bst, c) => { const d = probe(css(c)).reduce((sum, v, i) => sum + (v - rgb[i]) ** 2, 0); return d < bst[0] ? [d, c] : bst; }, [Infinity, ''])[1];
  // Kontrast mellem tekst og felt (WCAG): under 4,5:1 (3:1 for stor tekst) er teksten svær at læse. Glas og felter uden farve måles mod baggrunden bag dem.
  const lys = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const kontrast = (a, b) => { const x = lys(a), y = lys(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  function bagved(el) { // den første faste baggrundsfarve bag feltet
    for (let x = el.parentElement; x; x = x.parentElement) { const c = getComputedStyle(x).backgroundColor, v = rgbAf(c), a = (String(c).match(/[\d.]+/g) || [])[3]; if (v.length === 3 && (a === undefined || Number(a) > .9)) return v; }
    return probe('var(--papir, #fffdf5)');
  }
  function daarligKontrast(el, f, b, std, px) {
    const f0 = el.style.color; el.style.color = ''; const egen = rgbAf(getComputedStyle(el).color); el.style.color = f0;
    const tekst = f !== std.f ? probe(tCss(f)) : b !== std.b && FELT_TEKST[b] ? probe(FELT_TEKST[b]) : egen;
    const bag = b && b !== 'glas' && FELT_CSS[b] ? probe(FELT_CSS[b]) : bagved(el);
    return kontrast(tekst, bag) < (px >= 24 ? 3 : 4.5);
  }
  // Elementets egne farver (uden ændringer), som den farveknap der svarer til dem. Gennemsigtigt eller hvidt glas er knappen «glas».
  function standardFarver(el) {
    const f0 = el.style.color, b0 = el.style.background; el.style.color = ''; el.style.background = '';
    const cs = getComputedStyle(el), tekst = rgbAf(cs.color);
    const bg = cs.backgroundImage !== 'none' ? (cs.backgroundImage.match(/rgba?\([^)]*\)/) || [''])[0] : cs.backgroundColor, brgb = rgbAf(bg);
    el.style.color = f0; el.style.background = b0;
    return { f: naermest(TEKSTFARVER, tekst, tCss), b: !brgb.length || brgb.every(v => v >= 250) || /,\s*0\)$/.test(bg) ? 'glas' : naermest(FELTFARVER, brgb, fCss) };
  }
  const flytTekst = v => v ? 'Feltet kan ikke flyttes. Du kan stadig ændre tekst og farve.' : 'Du flytter feltet ved at holde fingeren på det og trække.';
  function aabn(el) {
    const k = el.dataset.org, o = get(k) || {}, felt = el.matches('.knap, .tilbage, .fane'), farvefelt = felt || el.matches('.rund, .stepper input, .chip, .mp-dagfelt, .mp-ret, .hj-fold'), nat = naturligZ(el), std = standardFarver(el);
    const egenO = el.dataset.egen ? obj[el.dataset.egen] : null; let rk = egenO ? Number(egenO.indhold) || 1 : 1, ramme = !!o.r;
    const opsk = el.matches(FAST), inst = el.dataset.tpinst, u = inst ? undtag(el) : null; let egen = !!u; // inst: feltet er et element i en liste (skabelon)
    const st0 = o.s ? pxAf(o.s) : naermestStr(parseFloat(el.dataset.fs) || 20); let st = st0, f = o.f || std.f, b = o.b || std.b, kanSkjule = !(beskyttet.has(k) || beskyttet.has(el.dataset.orgtekst)), x = !!o.x && kanSkjule, z = o.z || nat, foer = erFast(el, k), l = foer, m = !!o.m;
    const laasTekst = v => v ? 'Feltet sidder fast på skærmen og følger med, når du ruller.' : 'Feltet bliver liggende på sin plads, når du ruller.';
    const sw = (liste, v, nøgle, glas, css) => `<div class="farver">${glas ? `<button type="button" class="sw glas${v === 'glas' ? ' valgt' : ''}" data-${nøgle}="glas" aria-label="Gennemsigtigt glas"></button>` : ''}${liste.map(c => `<button type="button" class="sw${c === v ? ' valgt' : ''}" data-${nøgle}="${c}" style="background:${css(c)}" aria-label="${NAVN[c] || c}"></button>`).join('')}</div>`;
    const d = ark(`<div class="tp-top"><h2>Designer: feltet</h2><div class="rakke"><button class="knap gem" type="button" data-tp="gem">Gem</button><button class="knap annuller" type="button" data-tp="nulstil">Nulstil</button>${kanSkjule ? `<button class="knap annuller" type="button" data-tp="skjul">${x ? 'Vis igen' : 'Skjul'}</button>` : ''}</div></div>
      ${egenO && egenO.type === 'knap' ? `<label for="tp-link">Hvor fører knappen hen?</label><input type="text" id="tp-link" value="${esc(egenO.link || '')}" autocomplete="off"><p class="lille">En side i appen (fx #/opskrifter) eller en adresse, der starter med https://</p>` : ''}
      ${egenO && egenO.type === 'billede' ? `<label for="tp-url">Billedets adresse</label><input type="url" id="tp-url" value="${esc(egenO.indhold || '')}" autocomplete="off">` : ''}
      ${egenO && egenO.type === 'afstand' ? `<label>Hvor meget luft?</label><div class="rakke venstre">${[1, 2].map(n => `<button type="button" class="chip${String(n) === String(egenO.indhold || 1) ? ' valgt' : ''}" data-rk="${n}">${n} ${n === 1 ? 'række' : 'rækker'}</button>`).join('')}</div>` : ''}
      ${el.matches('.mp-dagfelt, .mp-ret') || inst || (egenO && !['tekst', 'knap', 'billede'].includes(egenO.type)) ? '' : `<label for="tp-tekst">${egenO && egenO.type === 'billede' ? 'Hvad viser billedet?' : 'Tekst'}</label>
      <input type="text" id="tp-tekst" value="${esc(o.t || el.dataset.orgtekst || '')}" maxlength="200" autocomplete="off">`}
      <label>Tekststørrelse</label>
      <div class="rakke venstre">${STR.map(([v, n]) => `<button class="chip${v === st ? ' valgt' : ''}" type="button" data-st="${v}">${n}</button>`).join('')}</div>
      ${felt ? `<label>Feltets størrelse</label><div class="rakke venstre">${FELTSTR.map(([v, n]) => `<button class="chip${v === z ? ' valgt' : ''}" type="button" data-fz="${v}">${n}</button>`).join('')}</div>` : ''}
      <label>Tekstfarve</label>${sw(TEKSTFARVER, f, 'f', false, tCss)}
      ${farvefelt ? `<label>Feltets farve</label>${sw(FELTFARVER, b, 'b', true, fCss)}` : ''}
      <p class="lille tp-advarsel" id="tp-kontrast" role="status" hidden>${Ikoner.svg('advarsel') || '⚠'} Teksten er svær at læse på den farve. Prøv en mørkere.</p>
      ${inst ? `<p class="lille" id="tp-listetekst"></p>
      <div class="rakke venstre"><button class="knap" type="button" data-tp="egen" aria-pressed="${egen}">Egen farve til dette felt</button>${u ? '<button class="knap" type="button" data-tp="foelg">Følg listen igen</button>' : ''}</div>` : `<p class="lille">Ændringen gælder dette felt og de felter, der hænger sammen med det.</p>`}
      ${egenO && egenO.type !== 'knap' && egenO.type !== 'afstand' ? `<div class="rakke venstre"><button class="knap" type="button" data-tp="ramme" aria-pressed="${ramme}">${ramme ? 'Uden ramme' : 'Med ramme'}</button></div>` : ''}
      ${pladsHtml(el, k)}
      ${egenO ? `<div class="rakke venstre"><button class="knap slet" type="button" data-tp="sletegen">${Ikoner.svg('slet')} Slet feltet</button></div>` : ''}
      ${inst ? '' : opsk ? '<p class="lille">Teksten i opskriften kan ændres, men ikke flyttes.</p>' : `<div class="rakke venstre"><button class="knap" type="button" data-tp="flyt">${m ? 'Kan flyttes igen' : 'Kan ikke flyttes'}</button></div>
      <p class="lille" id="tp-flyttekst">${flytTekst(m)}</p>`}
      ${el.closest('.top') || opsk || inst ? '' : `<div class="rakke venstre"><button class="knap" type="button" data-tp="laas">${Ikoner.svg(l ? 'laasop' : 'laas')} ${l ? 'Lås op' : 'Lås på skærmen'}</button></div>
      <p class="lille" id="tp-laastekst">${laasTekst(l)}</p>`}
`);
    if (u) { f = u.farve || f; b = u.baggrund || b; d.querySelectorAll('.sw').forEach(x => x.classList.toggle('valgt', ('f' in x.dataset ? x.dataset.f === f : x.dataset.b === b))); }
    const listeTekst = () => { const t = $('#tp-listetekst', d); if (!t) return; t.textContent = egen ? 'Farverne gælder kun dette felt. Resten følger listen.' : 'Ændringen gælder alle felter i listen.'; d.querySelectorAll('[data-st], [data-fz]').forEach(x => { x.disabled = egen; }); };
    const kontrastTjek = () => { const t = $('#tp-kontrast', d); if (t) t.hidden = !daarligKontrast(el, f, b, std, st); };
    listeTekst(); kontrastTjek();
    { const h = Math.max(20, Math.min(90, Number(lager.hent('tilpasHoejde', 33)) || 33)); $('.ark-kort', d).style.maxHeight = `min(max(${h}dvh, var(--ark-min, 280px)), calc(100dvh - 16px))`; } // vinduets højde i procent af skærmen (sættes under Mere), dog mindst --ark-min (280 px, på iPad 480 px), så det kan bruges på en vendt telefon
    d.addEventListener('click', e => {
      const s = e.target.closest('[data-st]'), a = e.target.closest('[data-tp]'), c = e.target.closest('.sw'), fz = e.target.closest('[data-fz]');
      if (fz) { z = fz.dataset.fz; d.querySelectorAll('[data-fz]').forEach(x => x.classList.toggle('valgt', x === fz)); return; }
      if (a && a.dataset.tp === 'flyt') { m = !m; a.textContent = m ? 'Kan flyttes igen' : 'Kan ikke flyttes'; $('#tp-flyttekst', d).textContent = flytTekst(m); return; }
      if (a && a.dataset.tp === 'laas') { l = !l; a.innerHTML = Ikoner.svg(l ? 'laasop' : 'laas') + (l ? ' Lås op' : ' Lås på skærmen'); $('#tp-laastekst', d).textContent = laasTekst(l); return; }
      if (c) { const n = 'f' in c.dataset ? 'f' : 'b'; if (n === 'f') f = c.dataset.f; else b = c.dataset.b; c.parentElement.querySelectorAll('.sw').forEach(x => x.classList.toggle('valgt', x === c)); kontrastTjek(); return; }
      if (s) { st = Number(s.dataset.st); d.querySelectorAll('[data-st]').forEach(x => x.classList.toggle('valgt', x === s)); kontrastTjek(); return; }
      const pl = e.target.closest('[data-pl]'); if (pl) { pladsKlik(el, k, pl.dataset.pl); return; }
      const rr = e.target.closest('[data-rk]'); if (rr) { rk = Number(rr.dataset.rk); d.querySelectorAll('[data-rk]').forEach(x => x.classList.toggle('valgt', x === rr)); return; }
      if (a && a.dataset.tp === 'ramme') { ramme = !ramme; a.textContent = ramme ? 'Uden ramme' : 'Med ramme'; a.setAttribute('aria-pressed', ramme); return; }
      if (a && a.dataset.tp === 'sletegen') { lukArk(); sletEgen(el); return; }
      if (a && a.dataset.tp === 'egen') { egen = !egen; a.setAttribute('aria-pressed', egen); listeTekst(); return; }
      if (a && a.dataset.tp === 'foelg') { lukArk(); fjernObj(k + '#' + inst); toast('Feltet følger listen igen'); return; }
      if (e.target.closest('.ark-bag')) return lukArk();
      if (!a) return;
      if (inst && egen && a.dataset.tp === 'gem') { // undtagelse: kun farve og baggrund
        const uk = k + '#' + inst, r = { undtagelse_for: k, farve: f !== std.f ? f : null, baggrund: farvefelt && b !== std.b ? b : null };
        lukArk(); if (!r.farve && !r.baggrund) return fjernObj(uk);
        husk(); obj[uk] = r; lager.gem('objekter', obj); anvend(); skrivObj(uk); return;
      }
      if (a.dataset.tp === 'nulstil') { lukArk(); gem(k, { ...(stdAf(k) || {}), p: undefined }, false, NULPLADS); return; }
      let ny = {};
      {
        if (a.dataset.tp === 'skjul') x = !x;
        if (x) ny.x = true;
        const t = $('#tp-tekst', d) ? $('#tp-tekst', d).value.trim() : ''; // dagene og deres felter har ingen tekst, der kan rettes
        if (t && t !== el.dataset.orgtekst) ny.t = t;
        if (o.s || st !== st0) ny.s = st;
        if (f !== std.f) ny.f = f; // en farve, der er appens egen, gemmes ikke
        if (farvefelt && b !== std.b) ny.b = b;
        if (m) ny.m = true;
        let p = o.p;
        if (l !== foer) { const g = p || [0, 0]; p = [g[0], Math.round((g[1] + (l ? -scrollY : scrollY)) * 100) / 100, ...g.slice(2)]; if (!p[0] && !p[1]) p = null; } // feltet bliver, hvor det står på skærmen nu
        if (p && !opsk) ny.p = p;
        if (felt && z !== nat) ny.z = z;
        if (l !== standardFast(el)) ny.l = l;
      }
      if (ramme) ny.r = true;
      let ekstra = { ramme };
      if (egenO) {
        if (egenO.type === 'knap') { const v = $('#tp-link', d).value.trim(); if (v && !(v.startsWith('#/') || sikkerUrl(v))) { toast('Adressen skal starte med #/ eller https://', { bliv: true }); return; } ekstra.link = v || egenO.link; }
        if (egenO.type === 'billede') { const v = $('#tp-url', d).value.trim(); if (!sikkerUrl(v)) { toast('Adressen skal starte med https://', { bliv: true }); return; } ekstra.indhold = v; }
        if (egenO.type === 'afstand') ekstra.indhold = String(rk);
        ekstra.tekst = ny.t || egenO.tekst || null; // dine egne felters tekst er selve indholdet
        const el2 = document.querySelector(`[data-egen="${k}"]`); if (el2 && ny.t && el2.firstChild && el2.firstChild.nodeType === 3) el2.firstChild.nodeValue = ny.t;
      }
      lukArk(); gem(k, ny, false, ekstra);
    });
    setTimeout(() => { const t = $('#tp-tekst', d); if (t) t.select(); }, 50);
  }
  function aabnKort(el) {
    const k = el.dataset.flyt, l = erFast(el, k), o0 = get(k) || {}, m = !!o0.m, data = el.matches('.opsk-felt');
    const sw = (liste, v, n, glas, css) => `<div class="farver">${glas ? `<button type="button" class="sw glas${v === 'glas' ? ' valgt' : ''}" data-${n}="glas" aria-label="Gennemsigtigt glas"></button>` : ''}<button type="button" class="sw ingen${!v ? ' valgt' : ''}" data-${n}="" aria-label="Ingen (appens egen)">×</button>${liste.map(c => `<button type="button" class="sw${c === v ? ' valgt' : ''}" data-${n}="${c}" style="background:${css(c)}" aria-label="${NAVN[c] || c}"></button>`).join('')}</div>`;
    const d = ark(`<h2>${data ? 'Opskriftens felt' : 'Flyt felt'}</h2><p class="lille">${data ? 'Feltet kan flyttes og få ramme og farve. Teksten kommer fra opskriften.' : flytTekst(m) + ' Det falder på notesbogens net.'}</p>
      ${data ? '' : `<p class="lille">${l ? 'Feltet sidder fast på skærmen og følger med, når du ruller.' : 'Feltet bliver liggende på sin plads, når du ruller.'}</p>`}
      ${pladsHtml(el, k)}
      ${data ? `<div class="rakke venstre"><button class="knap" type="button" data-tp="ramme">${o0.r ? 'Uden ramme' : 'Med ramme'}</button></div>
      <label>Tekstfarve</label>${sw(TEKSTFARVER, o0.f, 'f', false, tCss)}<label>Feltets farve</label>${sw(FELTFARVER, o0.b, 'b', true, fCss)}
      <p class="lille tp-advarsel" id="tp-kontrast" role="status" hidden>⚠ Teksten er svær at læse på den farve. Prøv en mørkere.</p>` : ''}
      <div class="rakke venstre"><button class="knap" type="button" data-tp="flyt">${m ? 'Kan flyttes igen' : 'Kan ikke flyttes'}</button></div>
      <div class="rakke">${data ? '' : `<button class="knap" type="button" data-tp="laas">${Ikoner.svg(l ? 'laasop' : 'laas')} ${l ? 'Lås op' : 'Lås på skærmen'}</button>`}<button class="knap annuller" type="button" data-tp="nulstil">Nulstil plads</button>${Ikoner.rund('luk', 'Luk', 'data-tp="luk"')}</div>`);
    d.addEventListener('click', e => {
      if (e.target.closest('.ark-bag')) return lukArk();
      const pl = e.target.closest('[data-pl]'); if (pl) { pladsKlik(el, k, pl.dataset.pl); return; }
      const c = e.target.closest('.sw'); if (c) { // datafelter: farven gemmes med det samme
        const n = 'f' in c.dataset ? 'f' : 'b', o = { ...(get(k) || {}) }; if (c.dataset[n]) o[n] = c.dataset[n]; else delete o[n];
        c.parentElement.querySelectorAll('.sw').forEach(x => x.classList.toggle('valgt', x === c));
        const t = $('#tp-kontrast', d); if (t) t.hidden = !(o.f || o.b) || !daarligKontrast(el, o.f || '', o.b || '', { f: '', b: '' }, 20);
        husk(); gem(k, o, true); return;
      }
      const a = e.target.closest('[data-tp]'); if (!a) return;
      lukArk(); const o = get(k) || {};
      if (a.dataset.tp === 'ramme') { gem(k, o, false, { ramme: !o.r }); return; }
      if (a.dataset.tp === 'flyt') { const { m: _m, ...rest } = o; if (!m) rest.m = true; gem(k, rest); }
      else if (a.dataset.tp === 'nulstil') { const { p, ...rest } = o; gem(k, rest, false, NULPLADS); }
      else if (a.dataset.tp === 'laas') {
        const g = o.p || [0, 0], p = [g[0], Math.round((g[1] + (l ? scrollY : -scrollY)) * 100) / 100, ...g.slice(2)], { l: _l, p: _p, ...rest } = o;
        if (p[0] || p[1]) rest.p = p;
        rest.l = !l;
        gem(k, rest);
      }
    });
  }

  // ---------- Plads: rækkefølge, kant og bredde (sidebyggeren, fase 3) ----------
  // Et felt flyttes i koden (DOM) og ikke med CSS, så tastatur og skærmlæser følger det, man ser. Der kan aldrig ligge to felter oven på hinanden.
  // Hvert felt har to pladser: smal (under 744 px) og bred (744 px og op). Har bred ingen plads, bruges smal.
  // «efter»: feltet står efter feltet med denne nøgle. «^nøgle»: lige før det felt. «i:nøgle»: først i den beholder. «=»: feltets egen plads.
  const BREDSK = matchMedia('(min-width: 744px)');
  const lag = () => BREDSK.matches ? '_bred' : '';
  function plads(k) {
    const o = k && obj[k]; if (!o) return null;
    const v = n => { const b = o[n + '_bred']; return BREDSK.matches && b !== undefined && b !== null ? b : o[n]; };
    const r = { efter: v('efter'), kant: v('kant'), bredde: v('bredde') };
    return (r.efter && r.efter !== '=') || r.kant === 0 || r.kant === 1 || r.bredde ? r : null;
  }
  const appEl0 = () => document.getElementById('app');
  const synlig = x => !!x.getClientRects().length && getComputedStyle(x).visibility !== 'hidden';
  // Nøglen, et andet felt kan bruge til at pege på dette (data-flyt, data-tpid eller id). Kort med tekst som nøgle er for ustabile.
  const refAf = x => { if (!x || x.nodeType !== 1 || x.classList.contains('plads')) return null; const k = x.dataset.flyt || x.dataset.tpid; if (k && !k.startsWith('kort:')) return k; return x.id && /^[a-zæøå][\w-]*$/i.test(x.id) ? '#' + x.id : null; };
  function findRef(el, key) {
    const q = key[0] === '#' ? `[id="${CSS.escape(key.slice(1))}"]` : `[data-flyt="${CSS.escape(key)}"], [data-tpid="${CSS.escape(key)}"]`, a = appEl0();
    const ok = x => x !== el && !el.contains(x) && x !== el._ph && !x.classList.contains('plads') && !x.closest('#ark');
    for (let sc = el.parentElement, i = 0; sc && i < 5 && a && a.contains(sc); sc = sc.parentElement, i++) { for (const x of sc.querySelectorAll(q)) if (ok(x)) return x; if (sc === a) return null; }
    if (a) for (const x of a.querySelectorAll(q)) if (ok(x)) return x;
    return null;
  }
  const BREDDER = ['tredjedel', 'halv', 'hel'];
  function placer(el, pl) {
    const node = el._ph || el, e = pl && pl.efter;
    if ((!e || e === '=') && el._hjem && el._hjem.isConnected && el._hjem.nextSibling !== node) { el._hjem.after(node); if (el._ph) el._ph.after(el); } // pladsen er fjernet (fx fortryd): feltet går hjem
    if (e && e !== '=') {
      const ind = e.startsWith('i:'), foer = e[0] === '^', ref = findRef(el, ind ? e.slice(2) : foer ? e.slice(1) : e);
      if (ref && !el._hjem && !el.dataset.egen) { el._hjem = document.createComment('plads'); node.before(el._hjem); } // husker feltets egen plads
      if (ref) {
        if (ind) { if (ref.firstElementChild !== node) ref.prepend(node); }
        else if (foer) { const r = ref._ph || ref; if (r.previousElementSibling !== node && r.previousElementSibling !== el) r.before(node); }
        else if (ref.nextElementSibling !== node) ref.after(node);
        if (el._ph && el._ph.nextElementSibling !== el) el._ph.after(el);
      }
    }
    const kt = pl ? pl.kant : null, w = pl ? pl.bredde : null;
    el.classList.toggle('tp-hoejre', kt === 1); el.classList.toggle('tp-venstre', kt === 0);
    BREDDER.forEach(b => el.classList.toggle('tp-b-' + b, w === b));
    const pd = node.parentElement ? getComputedStyle(node.parentElement).display : 'block', blok = (kt === 0 || kt === 1 || !!w) && !/flex|grid/.test(pd);
    el.classList.toggle('tp-blok', blok);
    if (blok && getComputedStyle(el).display.startsWith('inline')) { el.style.display = getComputedStyle(el).display.replace('inline-', '').replace(/^inline$/, 'block'); el._dispSat = true; }
    else if (!blok && el._dispSat) { el.style.display = ''; el._dispSat = false; }
  }
  // Dine egne felter: tekst, knap, billede, afstand og beholder. De står på den side, de blev lavet på.
  const EGNE = [['tekst', 'Tekst', 'Et stykke tekst'], ['knap', 'Knap', 'Fører til en side i appen eller på nettet'], ['billede', 'Billede', 'Fra en adresse på nettet'], ['afstand', 'Afstand', 'Luft mellem felterne'], ['beholder', 'Beholder', 'En ramme, du kan flytte felter ind i']];
  const STEDER = [['#/', 'Forsiden'], ['#/opskrifter', 'Opskrifter'], ['#/tips', 'Tips'], ['#/forslag', 'Hvad kan jeg lave?'], ['#/forslag/madplan', 'Madplan'], ['#/mere', 'Indstillinger']];
  const sikkerUrl = u => /^https:\/\/\S+$/i.test(String(u || '').trim());
  function lavEgen(id, o) {
    let el;
    if (o.type === 'knap') { el = document.createElement('a'); el.className = 'knap felt felt-m tp-egen'; }
    else if (o.type === 'billede') { el = document.createElement('figure'); el.className = 'tp-egen tp-billede'; const i = document.createElement('img'); i.loading = 'lazy'; i.addEventListener('load', () => { el.style.height = Math.max(1, Math.ceil(i.getBoundingClientRect().height / RAEKKE() - .02)) * RAEKKE() + 'px'; }); el.append(i); }
    else if (o.type === 'afstand') { el = document.createElement('div'); el.className = 'tp-egen tp-afstand'; el.setAttribute('aria-hidden', 'true'); }
    else if (o.type === 'beholder') { el = document.createElement('div'); el.className = 'tp-egen tp-beholder'; el.innerHTML = '<p class="tp-tom tekst-s" aria-hidden="true">Tom beholder. Flyt felter herind.</p>'; }
    else { el = document.createElement('p'); el.className = 'tp-egen tekst-m'; }
    el.dataset.egen = id; el.dataset.tpid = id;
    opdaterEgen(el, o); return el;
  }
  function opdaterEgen(el, o) {
    if (o.type === 'knap') { const l = o.link || '#/'; el.href = l; if (sikkerUrl(l)) { el.target = '_blank'; el.rel = 'noopener'; } else { el.removeAttribute('target'); el.removeAttribute('rel'); } if (!el.firstChild) el.textContent = o.tekst || 'Knap'; }
    else if (o.type === 'billede') { const i = el.querySelector('img'); if (i.getAttribute('src') !== o.indhold) i.src = sikkerUrl(o.indhold) ? o.indhold : ''; i.alt = o.tekst || ''; }
    else if (o.type === 'afstand') el.style.height = `calc(${Math.max(1, Math.min(4, Number(o.indhold) || 1))} * var(--raekke))`;
    else if (o.type === 'tekst' && !el.firstChild) el.textContent = o.tekst || '';
  }
  function egne() {
    const a = appEl0(); if (!a || !a.firstElementChild || a.querySelector(':scope > .henter')) return;
    const side = sideNavn();
    for (const [id, o] of Object.entries(obj)) {
      if (!o.type || o.side !== side) continue;
      let el = a.querySelector(`[data-egen="${id}"]`);
      if (o.slettet) { if (el) el.remove(); continue; }
      if (!el) a.append(lavEgen(id, o)); else opdaterEgen(el, o);
    }
    a.querySelectorAll('[data-egen]').forEach(el => { const o = obj[el.dataset.egen]; if (!o || o.slettet || o.side !== side) el.remove(); });
  }
  // Steder, et felt kan flyttes hen: før og efter hvert felt med en nøgle, og først i en tom beholder. Ikke inde i lister og opskriftens tekst.
  const IKKEIND = '[data-tpinst], .hj-gruppe, #hj-liste, #liste, .ing, #trin, .opsk-felt *, #ark, .plads, .mp-grid > * > *, .lav-midte *, .vejledning > li > *';
  function pladser(el) {
    const a = appEl0(), ud = []; if (!a) return ud;
    for (const x of a.querySelectorAll('[data-flyt], [data-tpid], [id]')) {
      const r = refAf(x); if (!r || x === el || el.contains(x) || x.matches(IKKEIND) || x.closest('[data-tpinst], .hj-gruppe, #ark') || (x.parentElement && x.parentElement.closest('.opsk-felt')) || !synlig(x)) continue;
      if (x === el._ph || x.matches('input[type=hidden], input[type=file], [hidden]')) continue;
      const q = x.getBoundingClientRect(); if (q.width < 8 || q.height < 4) continue;
      ud.push({ x0: q.left, x1: q.right, y: q.top + scrollY, efter: '^' + r }, { x0: q.left, x1: q.right, y: q.bottom + scrollY, efter: r });
      if (x.matches('.tp-beholder')) ud.push({ x0: q.left + 16, x1: q.right - 16, y: q.top + scrollY + 20, efter: 'i:' + r });
    }
    return ud;
  }
  function naermestPlads(liste, x, y) {
    let b = null, bd = Infinity;
    for (const p of liste) { const dx = x < p.x0 ? p.x0 - x : x > p.x1 ? x - p.x1 : 0, d = Math.hypot(dx, y - p.y); if (d < bd) { bd = d; b = p; } }
    return bd < 160 ? b : null;
  }
  function visPladser(liste) {
    let g = document.getElementById('tp-pladser'); if (!g) { g = document.createElement('div'); g.id = 'tp-pladser'; document.body.append(g); }
    g.innerHTML = liste.map(p => `<i style="left:${p.x0}px;top:${p.y - 1}px;width:${p.x1 - p.x0}px"></i>`).join('') + '<b id="tp-markoer" hidden></b>';
  }
  // Animation: feltet glider fra sin gamle plads til den nye (ca. 200 ms). Ikke ved reduceret bevægelse.
  function glid(el, foer) {
    if (!foer || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const nu = el.getBoundingClientRect(), dx = foer.left - nu.left, dy = foer.top - nu.top;
    if (Math.abs(dx) + Math.abs(dy) < 2) return;
    el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.2, .8, .2, 1)' });
  }
  async function saetPlads(el, k, ny, besked, fra) { // fra: hvor feltet stod (efter træk). ny: { efter, kant, bredde } for den skærm, man bruger nu (null = feltets egen)
    const foer = fra || el.getBoundingClientRect(), s0 = lag(), r = {};
    for (const [n, v] of Object.entries(ny)) r[n + s0] = v;
    husk(); obj[k] = { ...(obj[k] || {}), ...r }; lager.gem('objekter', obj); anvend();
    glid(el, foer); el.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    if (besked) toast(besked);
    await skrivObj(k, true);
  }
  const forbudt = x => !x || x.matches('#app, main, .ruder, .rude-liste, .rude-indhold') || !appEl0() || !appEl0().contains(x) || x === appEl0();
  const foerRef = n => { const r = refAf(n); if (r) return '^' + r; const p = n.previousElementSibling, pr = refAf(p); return pr ? pr : null; };
  const efterRef = n => { const r = refAf(n); if (r) return r; const x = n.nextElementSibling, xr = refAf(x); return xr ? '^' + xr : null; };
  function naboSted(el, ret) { // ret −1: op, 1: ned. Giver den nye «efter», eller null
    const node = el._ph || el, spring = x => x && (x === el || x === el._ph || x.classList.contains('plads') || x.matches('#ark, script, template, [hidden], input[type=hidden], input[type=file]') || !synlig(x));
    let x = ret < 0 ? node.previousElementSibling : node.nextElementSibling;
    while (spring(x)) x = ret < 0 ? x.previousElementSibling : x.nextElementSibling;
    if (x) return ret < 0 ? foerRef(x) : efterRef(x);
    const P = node.parentElement; if (forbudt(P)) return null;
    return ret < 0 ? foerRef(P) : efterRef(P);
  }
  function bredder(el) { // mulige bredder i px: egen, tredjedel, halv, hel
    const P = (el._ph || el).parentElement, cs = getComputedStyle(P), W = P.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), K = KOL();
    const gl = BREDDER.find(b => el.classList.contains('tp-b-' + b)); if (gl) el.classList.remove('tp-b-' + gl);
    const egen = el.getBoundingClientRect().width; if (gl) el.classList.add('tp-b-' + gl);
    return [[null, egen], ['tredjedel', Math.floor((W - 32) / 3 / K) * K], ['halv', Math.floor((W - 16) / 2 / K) * K], ['hel', W]];
  }
  function pladsKlik(el, k, hvad) {
    const pl = plads(k) || {}, nu = el.getBoundingClientRect();
    if (hvad === 'op' || hvad === 'ned') {
      const e = naboSted(el, hvad === 'op' ? -1 : 1);
      if (!e) return toast(hvad === 'op' ? 'Feltet kan ikke komme længere op her.' : 'Feltet kan ikke komme længere ned her.');
      return saetPlads(el, k, { efter: e }, hvad === 'op' ? 'Flyttet op' : 'Flyttet ned');
    }
    if (hvad === 'bredere' || hvad === 'smallere') {
      const b = bredder(el), w = nu.width, liste = b.filter(([, v]) => hvad === 'bredere' ? v > w + 2 : v < w - 2).sort((x, y) => hvad === 'bredere' ? x[1] - y[1] : y[1] - x[1]);
      if (!liste.length) return toast(hvad === 'bredere' ? 'Feltet er så bredt, det kan blive.' : 'Feltet er så smalt, det kan blive.');
      return saetPlads(el, k, { bredde: liste[0][0] }, hvad === 'bredere' ? 'Bredere' : 'Smallere');
    }
    if (hvad === 'kant') { const P = (el._ph || el).parentElement.getBoundingClientRect(), hoejre = pl.kant === 1 || (pl.kant !== 0 && nu.left + nu.width / 2 > P.left + P.width / 2 + 4); return saetPlads(el, k, { kant: hoejre ? 0 : 1 }, hoejre ? 'Til venstre' : 'Til højre'); }
    if (hvad === 'egenplads') { obj[k] = { ...(obj[k] || {}), omregnet: 'begge' }; return saetPlads(el, k, { efter: null, kant: null, bredde: null }, 'Feltet står på sin egen plads igen'); }
  }
  const kanPlaceres = el => !el.dataset.tpinst && !el.matches(FAST) && !el.closest('.top');
  const pladsHtml = (el, k) => kanPlaceres(el) && !(get(k) || {}).m ? `<label>Plads <small>(gælder ${BREDSK.matches ? 'brede skærme: iPad og Mac' : 'smalle skærme: iPhone'})</small></label>
      <div class="rakke venstre tp-plads"><button class="knap mini" type="button" data-pl="op">↑ Flyt op</button><button class="knap mini" type="button" data-pl="ned">↓ Flyt ned</button>
      <button class="knap mini" type="button" data-pl="smallere">Smallere</button><button class="knap mini" type="button" data-pl="bredere">Bredere</button>
      <button class="knap mini" type="button" data-pl="kant">Til den anden side</button><button class="knap mini" type="button" data-pl="egenplads">Egen plads</button></div>` : '';
  // «Tilføj felt»: en palet med tekst, knap, billede, afstand og beholder
  const bogstaver = n => Array.from({ length: n }, () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]).join('');
  function forankring() { // feltet kommer lige før det første felt, man kan se
    const liste = pladser(document.createElement('i')).filter(p => p.efter[0] === '^' && p.y - scrollY > 40 && p.y - scrollY < innerHeight - 120);
    return liste.length ? liste.sort((a, b) => a.y - b.y)[0].efter : null;
  }
  function palette() {
    const d = ark(`<h2>Tilføj felt</h2><p class="lille">Feltet kommer øverst på det, du kan se. Bagefter kan du flytte det.</p>
      <div class="tp-palette">${EGNE.map(([t, n, f]) => `<button type="button" class="knap" data-ny="${t}"><strong>${n}</strong><small>${f}</small></button>`).join('')}</div>
      <div class="rakke">${Ikoner.rund('luk', 'Luk', 'data-tp="luk"')}</div>`);
    d.addEventListener('click', e => {
      if (e.target.closest('.ark-bag') || e.target.closest('[data-tp=luk]')) return lukArk();
      const b = e.target.closest('[data-ny]'); if (b) nytFelt(b.dataset.ny);
    });
  }
  function nytFelt(type) {
    const navn = EGNE.find(x => x[0] === type)[1];
    const d = ark(`<h2>Tilføj ${navn.toLowerCase()}</h2>
      ${type === 'tekst' ? '<label for="tp-ny-tekst">Teksten</label><textarea id="tp-ny-tekst" rows="3" maxlength="2000"></textarea>' : ''}
      ${type === 'knap' ? `<label for="tp-ny-tekst">Teksten på knappen</label><input type="text" id="tp-ny-tekst" maxlength="60" autocomplete="off">
        <label for="tp-ny-link">Hvor skal den føre hen?</label><select id="tp-ny-link">${STEDER.map(([h, n]) => `<option value="${h}">${n}</option>`).join('')}<option value="ude">En adresse på nettet</option></select>
        <label for="tp-ny-url" class="tp-url">Adressen</label><input type="url" id="tp-ny-url" class="tp-url" placeholder="https://…" autocomplete="off" hidden>` : ''}
      ${type === 'billede' ? `<label for="tp-ny-url">Billedets adresse</label><input type="url" id="tp-ny-url" placeholder="https://…" autocomplete="off">
        <label for="tp-ny-tekst">Hvad viser billedet?</label><input type="text" id="tp-ny-tekst" maxlength="200" autocomplete="off"><p class="lille">Teksten læses op for dem, der ikke kan se billedet.</p>` : ''}
      ${type === 'afstand' ? `<label>Hvor meget luft?</label><div class="rakke venstre"><button type="button" class="chip valgt" data-r="1">1 række</button><button type="button" class="chip" data-r="2">2 rækker</button></div>` : ''}
      ${type === 'beholder' ? '<p class="lille">Beholderen er en ramme. Flyt felter ind i den ved at trække dem.</p>' : ''}
      <p class="lille tp-advarsel" id="tp-ny-fejl" role="alert" hidden></p>
      <div class="rakke"><button class="tilbage" type="button" data-tp="tilbage" aria-label="Tilbage" title="Tilbage">${Ikoner.svg('tilbage')}</button><button class="knap gem" type="button" data-tp="tilfoej">Tilføj</button></div>`);
    let rk = 1;
    const fejl = t => { const f = $('#tp-ny-fejl', d); f.textContent = t; f.hidden = false; };
    const sel = $('#tp-ny-link', d); if (sel) sel.addEventListener('change', () => d.querySelectorAll('.tp-url').forEach(x => { x.hidden = sel.value !== 'ude'; }));
    d.addEventListener('click', e => {
      if (e.target.closest('.ark-bag')) return lukArk();
      const c = e.target.closest('[data-r]'); if (c) { rk = Number(c.dataset.r); d.querySelectorAll('[data-r]').forEach(x => x.classList.toggle('valgt', x === c)); return; }
      const a = e.target.closest('[data-tp]'); if (!a) return;
      if (a.dataset.tp === 'tilbage') return palette();
      const tekst = ($('#tp-ny-tekst', d) || {}).value, url = (($('#tp-ny-url', d) || {}).value || '').trim();
      const o = { type, side: sideNavn() };
      if (type === 'tekst' || type === 'knap') { if (!String(tekst || '').trim()) return fejl(type === 'knap' ? 'Skriv en tekst på knappen.' : 'Skriv teksten.'); o.tekst = tekst.trim(); }
      if (type === 'knap') { o.link = sel.value === 'ude' ? url : sel.value; if (sel.value === 'ude' && !sikkerUrl(url)) return fejl('Adressen skal starte med https://'); }
      if (type === 'billede') { if (!sikkerUrl(url)) return fejl('Adressen skal starte med https://'); o.indhold = url; o.tekst = String(tekst || '').trim() || null; }
      if (type === 'afstand') o.indhold = String(rk);
      if (type === 'beholder') o.ramme = true;
      o.efter = forankring();
      const id = 'egen-' + bogstaver(10);
      lukArk(); husk(); obj[id] = o; lager.gem('objekter', obj); anvend();
      const el = document.querySelector(`[data-egen="${id}"]`); if (el) { el.scrollIntoView({ block: 'center' }); if (!matchMedia('(prefers-reduced-motion: reduce)').matches) el.animate([{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 200 }); }
      toast(`${navn} er tilføjet. Tryk på feltet for at ændre det.`, { fortryd });
      skrivObj(id, true);
    });
    setTimeout(() => { const f = d.querySelector('input:not([hidden]), textarea'); if (f) f.focus(); }, 80);
  }
  function sletEgen(el) {
    const id = el.dataset.egen, navn = (EGNE.find(x => x[0] === (obj[id] || {}).type) || ['', 'Feltet'])[1];
    husk(); obj[id] = { ...obj[id], slettet: true }; lager.gem('objekter', obj); anvend();
    toast(`${navn} er slettet`, { fortryd }); skrivObj(id, true);
  }
  // Træk: hold fingeren stille et øjeblik, så løfter feltet sig, og det følger fingeren og falder på gitteret
  let drag = null, sidstTrukket = 0;
  const gitter = () => { let g = document.getElementById('gitter'); if (!g) { g = document.createElement('div'); g.id = 'gitter'; document.body.append(g); } return g; };
  function startTraek(d) {
    d.laast = true; const tf = d.el.style.transform, ov = d.el.style.transition;
    d.el.style.transition = 'none'; d.el.style.transform = 'none'; // målt uden «trykket ned»-effekten
    const r = d.el.getBoundingClientRect(); d.el.style.transform = tf; void d.el.offsetWidth; d.el.style.transition = ov;
    d.fast = d.el.hasAttribute('data-laast') && !!d.el._ph; d.top0 = r.top;
    d.dx0 = d.el._dx || 0; // den vandrette forskydning, feltet har nu (kan være ignoreret, se uheldig)
    if (d.fast) { const q = d.el._ph.getBoundingClientRect(); d.nx = q.left; d.natDoc = q.top + scrollY; } // fastlåst: pladsholderen viser, hvor feltet ville stå
    else { d.nx = r.left - d.dx0; d.natDoc = r.top - (d.el._dy || 0) + scrollY; }
    d.stat = getComputedStyle(d.el).position === 'static'; if (d.stat) d.el.style.position = 'relative';
    d.el.classList.add('traekker');
    if (!d.fast) { d.pladser = pladser(d.el); visPladser(d.pladser); if (navigator.vibrate) navigator.vibrate(12); return; } // felter i siden: de gyldige pladser vises som streger, og feltet lander på en af dem
    gitter().style.backgroundPosition = `${d.nx - 8}px ${(d.fast ? d.natDoc : d.natDoc - scrollY) - 16}px`; // prikkerne står, hvor feltets hjørne kan lande: hele kolonner og rækker fra dets egen plads
    if (navigator.vibrate) navigator.vibrate(12);
  }
  // Et felt må ikke lande oven på tekst, der ikke kan tilpasses (opskrifter, trin, skrivefelter ...)
  const BLOKSKIP = '[data-org], [data-flyt], #ark, #gitter, .plads, #tilpas-gruppe, #tilpas-knap, #tilpas-forlad, #tilpas-fortryd, #tilpas-gentag, #toast, #hjaelper, #hjaelper-vis, .h-boble';
  function paaTekst(el) {
    const r = el.getBoundingClientRect(), ph = el._ph, snit = q => q.right > r.left + 4 && q.left < r.right - 4 && q.bottom > r.top + 4 && q.top < r.bottom - 4;
    for (const e of document.querySelectorAll('main *')) {
      if (e.contains(el) || el.contains(e) || (ph && (ph === e || ph.contains(e))) || (e.closest(BLOKSKIP) && !e.closest(FAST))) continue; // tekst i opskriften flytter aldrig, så den tæller med
      if (e.matches('input, textarea, select')) { if (e.offsetHeight && snit(e.getBoundingClientRect())) return true; continue; }
      for (const n of e.childNodes) {
        if (n.nodeType !== 3 || !n.nodeValue.trim()) continue;
        const rg = document.createRange(); rg.selectNodeContents(n);
        for (const q of rg.getClientRects()) if (q.width && snit(q)) return true;
      }
    }
    return false;
  }
  function flyt(d, e) {
    if (!d.fast) {
      d.el.style.translate = `${e.clientX - d.x0}px ${e.clientY - d.y0}px`;
      const p = naermestPlads(d.pladser, e.clientX, e.clientY + scrollY), m = document.getElementById('tp-markoer');
      d.plads = p;
      if (m) { m.hidden = !p; if (p) Object.assign(m.style, { left: p.x0 + 'px', top: (p.y - 2) + 'px', width: (p.x1 - p.x0) + 'px' }); }
      if (e.clientY < 60) scrollBy(0, -12); else if (e.clientY > innerHeight - 90) scrollBy(0, 12); // ruller med, når feltet trækkes mod kanten
      return;
    }
    const K = KOL(), R = RAEKKE(), tx = d.nx + d.dx0 + e.clientX - d.x0, ty = d.top0 + e.clientY - d.y0 + (d.fast ? 0 : scrollY);
    d.p = [Math.round((tx - d.nx) / K) * K, Math.round((ty - d.natDoc) / R) * R]; // hele kolonner og rækker fra feltets egen plads, som står på nettet
    if (d.fast) { d.el.style.left = (d.nx + d.p[0]) + 'px'; d.el.style.top = (d.natDoc + d.p[1]) + 'px'; }
    else d.el.style.translate = `${d.p[0]}px ${d.p[1]}px`;
    if (!d.fast) { const kl = d.p.join(); if (kl !== d.sidstP) { d.sidstP = kl; d.ulovlig = paaTekst(d.el) || paaFelt(d.el); d.el.classList.toggle('ulovlig', d.ulovlig); } } // fastlåste felter følger skærmen: tekst ruller under dem
  }
  function slutTraek() {
    const d = drag; drag = null; if (!d) return; clearTimeout(d.t);
    if (!d.laast) return;
    sidstTrukket = Date.now(); d.el.classList.remove('traekker'); if (d.stat) d.el.style.position = '';
    const g = document.getElementById('gitter'); if (g) g.remove();
    if (!d.fast) {
      const pl = document.getElementById('tp-pladser'); if (pl) pl.remove();
      const foer = d.el.getBoundingClientRect(); d.el.style.translate = '';
      if (!d.plads) { glid(d.el, foer); anvend(); return toast('Slip feltet ved en af stregerne.'); }
      saetPlads(d.el, noegle(d.el), { efter: d.plads.efter }, 'Flyttet', foer); return;
    }
    if (d.ulovlig) { d.el.classList.remove('ulovlig'); anvend(); toast('Her er der ikke plads. Prøv et andet sted.'); return; }
    const k = d.el.dataset.flyt, { p, ...rest } = get(k) || {};
    if (d.p && (d.p[0] || d.p[1]) && indeI(d.el)) rest.p = [d.p[0], d.p[1]];
    else if (d.p && (d.p[0] || d.p[1])) { // husk kanten: venstre eller højre, og afstanden fra den
      const K = kolonne(), w = d.el.getBoundingClientRect().width, L = d.nx + d.p[0], hoj = L + w / 2 > (K.l + K.r) / 2 ? 1 : 0;
      rest.p = [d.p[0], d.p[1], hoj, Math.round((hoj ? K.r - (L + w) : L - K.l) * 100) / 100];
    }
    gem(k, rest);
  }
  document.addEventListener('pointerdown', e => {
    if (!til || !aktiv || e.button > 0) return;
    let el = e.target.closest('[data-flyt]'); if (el && el.matches(DELE)) el = el.closest(TRINFLYT) || el; // træk i en del af tælleren flytter hele tælleren
    if (!el || el.closest('#ark') || (get(el.dataset.flyt) || {}).m || el.matches(FAST) || el.dataset.tpinst) return;
    const d = drag = { el, x0: e.clientX, y0: e.clientY, p0: (get(el.dataset.flyt) || {}).p || [0, 0], laast: false };
    d.t = setTimeout(() => startTraek(d), 300);
  }, true);
  document.addEventListener('pointermove', e => {
    if (!drag) return;
    if (!drag.laast) { if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 8) { clearTimeout(drag.t); drag = null; } return; }
    flyt(drag, e);
  }, true);
  document.addEventListener('pointerup', slutTraek, true);
  document.addEventListener('pointercancel', slutTraek, true);
  document.addEventListener('touchmove', e => { if (drag && drag.laast) e.preventDefault(); }, { passive: false });
  document.addEventListener('dragstart', e => { if (til && aktiv) e.preventDefault(); }, true);
  // I tilpas-tilstand åbner et tryk på en tekst i stedet for at gøre det, knappen plejer
  document.addEventListener('click', e => {
    if (!til || !aktiv) return;
    if (Date.now() - sidstTrukket < 400) { e.preventDefault(); e.stopPropagation(); return; } // slip efter træk er ikke et tryk
    const el = e.target.closest('[data-flyt]');
    if (!el || el.closest('#ark')) return;
    e.preventDefault(); e.stopPropagation(); el.dataset.org ? aabn(el) : aabnKort(el);
  }, true);
  function noegle(el) {
    if (el.matches('.kort')) return el.closest('#ark') ? null : el.dataset.tpid || 'kort:' + (el.getAttribute('href') || el.textContent.trim().slice(0, 40)); // felter med data-tpid bruger det
    return el.dataset.org || ((el.matches(TRIN) || el.matches('.opsk-felt')) && el.dataset.tpid) || el.dataset.egen || null;
  }
  const igen = () => { cancelAnimationFrame(timer); timer = requestAnimationFrame(anvend); };
  const appEl = document.getElementById('app'); // mens siden glider ind, er felternes mål forskudt: placeringerne sættes igen, når bevægelsen er slut
  if (appEl) appEl.addEventListener('animationend', e => { if (e.animationName === 'sideind') igen(); });
  if (window.ResizeObserver) new ResizeObserver(igen).observe(document.querySelector('main')); // indholdet kan lægge sig om uden at DOM'en ændres (skrifttyper, billeder): placeringerne sættes igen
  if (document.fonts) document.fonts.ready.then(igen);
  // Tilpasseren kører kun, når siden faktisk har fået nyt indhold: ikke ved beskeder, ure, Grydelil eller dens egne ændringer (pladsholdere, flytninger)
  const UDEN = '#toast, #ure, #hjaelper, #hjaelper-vis, #gitter, #tp-pladser, .h-boble, #tilpas-fortryd, #tilpas-gentag, #tilpas-ny, #nav';
  const nyt = n => n.nodeType === 1 && !n.classList.contains('plads') && !n.matches(UDEN) && !n.closest(UDEN);
  const vagt = new MutationObserver(recs => {
    if (iGang) return;
    for (const r of recs) { const t = r.target.nodeType === 1 ? r.target : r.target.parentElement; if (t && t.closest && t.closest(UDEN)) continue; if ([...r.addedNodes, ...r.removedNodes].some(nyt)) return igen(); }
  });
  vagt.observe(document.body, { childList: true, subtree: true });
  // Vendes skærmen, eller ændres vinduets bredde, sættes alle felter på plads igen (efter at siden har lagt sig om)
  let vendTimer;
  const omlaeg = () => { clearTimeout(vendTimer); vendTimer = setTimeout(() => { if (drag && drag.laast) return; anvend(); requestAnimationFrame(anvend); }, 120); };
  addEventListener('resize', omlaeg); addEventListener('orientationchange', omlaeg);  document.addEventListener('DOMContentLoaded', () => { anvend(); foersteHent = hent(); });

  // ---------- Omregning af de gamle placeringer (sidebyggeren, fase 5) ----------
  // Før opdatering 2 blev en placering gemt som pixels fra feltets egen plads. Første gang en side vises på en smal eller bred skærm,
  // regnes dine gamle placeringer om: hvor feltet står nu (efter beskyttelsen mod overlap), bliver til en rækkefølge og en kant. Stilen (tekst, farver ...) følger med.
  // Felter, der er låst på skærmen, beholder deres forskydning. Tabellen «tilpasning» røres ikke (sikkerhedskopi i supabase/sikkerhedskopi).
  const lagNavn = () => BREDSK.matches ? 'bred' : 'smal';
  let omregnTimer;
  const omregnSnart = () => { clearTimeout(omregnTimer); omregnTimer = setTimeout(omregn, 700); };
  function ordenNu(el) { // hvor feltet står blandt sine naboer lige nu. null = på sin egen plads
    const node = el._ph || el, P = node.parentElement; if (!P) return null;
    const cs = getComputedStyle(P), raekke = /flex/.test(cs.display) && !/column/.test(cs.flexDirection), r = el.getBoundingClientRect(), midt = q => raekke ? q.left + q.width / 2 : q.top + q.height / 2;
    const naboer = [...P.children].filter(x => x !== el && x !== el._ph && !x.classList.contains('plads') && synlig(x) && refAf(x));
    if (!naboer.length) return null;
    let foer = null; for (const x of naboer) if (midt(x.getBoundingClientRect()) < midt(r)) foer = x;
    let nat = node.previousElementSibling; while (nat && !naboer.includes(nat)) nat = nat.previousElementSibling;
    if (foer === nat) return null;
    return foer ? refAf(foer) : '^' + refAf(naboer[0]);
  }
  function omregn() {
    if (!server || IGNORER_GEMTE || (drag && drag.laast) || document.getElementById('ark') || !appEl0() || !appEl0().firstElementChild) return;
    const ln = lagNavn(), s0 = lag(), gjort = [];
    for (const el of document.querySelectorAll('[data-flyt]')) {
      const k = el.dataset.flyt;
      if (!k || gjort.includes(k) || el.classList.contains('plads') || el.dataset.tpinst || el.dataset.egen || omregnet(k)) continue;
      const egne = gammel(k, x => data[x]); if (!egne) continue; // kun dine egne gamle tilpasninger
      const g = gammel(k) || {}, o = obj[k] ? { ...obj[k] } : tilRaekke(g);
      const fast = erFast(el, k);
      if (fast && g.p && !o.pos) o.pos = g.p.join(','); // låst på skærmen: forskydningen bliver
      if (!fast && g.p && (el._dx || el._dy) && kanPlaceres(el)) {
        const e = ordenNu(el), rp = e && plads(e.replace(/^\^|^i:/, ''));
        if (e && o['efter' + s0] == null && !(rp && rp.efter && rp.efter.replace(/^\^|^i:/, '') === k)) o['efter' + s0] = e; // aldrig to felter, der peger på hinanden
        const P = (el._ph || el).parentElement, q = el.getBoundingClientRect(), pq = P.getBoundingClientRect();
        if (el._dx && !/flex|grid/.test(getComputedStyle(P).display) && q.left + q.width / 2 > pq.left + pq.width / 2 && o['kant' + s0] == null) o['kant' + s0] = 1;
      }
      o.omregnet = o.omregnet && o.omregnet !== ln ? 'begge' : ln;
      obj[k] = o; gjort.push(k);
    }
    if (!gjort.length) return;
    lager.gem('objekter', obj); anvend();
    gjort.forEach(k => skrivObj(k, true));
  }
  // Henter igen, når appen får fokus (fx efter at have været på en anden enhed), og siger til, hvis noget er ændret
  let sidstHentet = Date.now();
  const hentIgen = async () => {
    if (document.visibilityState !== 'visible' || Date.now() - sidstHentet < 5000 || (drag && drag.laast) || document.getElementById('ark')) return;
    sidstHentet = Date.now();
    if (await hent()) toast('Siden er ændret på en anden enhed. Nu ser du det nyeste.');
  };
  document.addEventListener('visibilitychange', hentIgen); addEventListener('focus', hentIgen);
  // Skifter skærmen mellem smal og bred, tegnes siden forfra, så felterne står på deres plads for den bredde
  BREDSK.addEventListener('change', () => { if (Object.values(obj).some(o => o.efter || o.efter_bred || o.type) && typeof route === 'function') route(); });
  return { saet, klar: () => foersteHent || Promise.resolve(), til: () => til, tipIgen: () => { lager.gem('tilpasTipSet', false); toast('Tippet vises næste gang, du åbner Designer.'); }, async nulstil() {
    husk(); data = {}; obj = {}; lager.gem('tilpas', data); lager.gem('objekter', obj); anvend();
    try { await api('tilpasning?noegle=not.is.null', { method: 'DELETE' }); } catch (err) { console.error(err); }
    if (objTabel) try { await api('objekter?id=not.is.null', { method: 'DELETE' }); } catch (err) { console.error(err); }
  } };
})();
