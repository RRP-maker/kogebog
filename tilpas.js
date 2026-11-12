// Tilpas siden: når det er slået til, kan man trykke på en knap eller overskrift og ændre teksten og skriftstørrelsen,
// og holde fingeren på et felt og trække det. Det falder på notesbogens net: 16 px på tværs, og på rækkerne à 32 px op og ned
// (store felter: top midt mellem to linjer. Små felter på 32 px: kanterne på linjerne. Tekst: på rækken).
// Kolonner i «tilpasning»: pos («dx,dy», målt ved øverst på siden), felt (størrelsen s/m/l), laast (true: feltet sidder fast på skærmen og følger med,
// når man ruller. false eller tom: det bliver liggende på sin plads på siden. «Tilføj tip» og «Rediger» sidder som standard fast).
// Ændringen gælder alle steder, hvor den samme tekst står. Den gemmes i Supabase (tabellen «tilpasning») og dermed på alle enheder.
// Mangler tabellen, gemmes den kun på denne enhed.
const Tilpas = (() => {
  const VALG = '.knap, .tilbage, .fane, .logo, main h1, main h2, main p.lille, main p.tomt, main small, .mp-dagfelt, .mp-ret, .mp-rk > span'; // de sidste: dagene, retternes felter og tællernes navne på Madplan
  const NEDE = '#form > button[type=submit]'; // «Gem» nederst i formularer: fast i CSS, uden for tilpasserens flytning
  const FAST = '.opsk'; // tekster inde i selve opskriften: kan ændres, men aldrig flyttes
  const KORT = '.kort:not([href^="#/opskrifter"]):not(.koebsforslag)', DELE = '.mp-valg .rund, .mp-valg .mp-inp, .filter .chip', TRIN = '.mp-valg .stepper, .filter', TRINFLYT = TRIN.split(', ').map(x => x + '[data-flyt]').join(', '), FLYT = VALG + ', ' + DELE + ', ' + TRIN + ', ' + KORT;
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
    "forside|hvad-skal-vi-lave": {}, "forslag|hvad-kan-jeg-lave": {}, "Ingredienser": {}, // tomme: feltet arver ikke fra teksten
    "Kopiér besked": {"s": 20, "z": "s", "p": [196, -72]},
    "Sæt ind": {"s": 20, "z": "s", "p": [100, -20]},
    "Ryd": {"p": [-257.19, -4]},
    "Tips": {"s": 34},
    "Sæt svar ind": {"z": "s", "p": [228, -12.5]},
    "Ryd svar": {"p": [-128.94, 3.5]},
    "‹ Fortryd": {"l": true},
    "import-svar-saet": {"s": 20, "z": "s", "p": [260, -12.5]},
    "Hvad skal vi lave?": {"t": "Kogebogen", "s": 34},
    "import-svar-ryd": {"p": [-97.19, 3.5]},
    "forslag|hvad-har-du-derhjemme": {"p": [0, 34]},
    "Favoritter": {"p": [0, 2]},
    "Hvad kan jeg lave?": {"s": 34, "z": "l"},
    "Åbn Claude ›": {"p": [4, -4.5]},
    "Hvad har du derhjemme?": {"p": [0, -10]},
    "‹ Forside": {"l": true},
    "Du mangler lidt": {"t": "Der mangler"},
    "Rediger": {"p": [-110.81, -64]},
    "Tilføj tip": {"p": [288, -64]},
    "▶ Lav retten trin for trin": {"t": "Lav retten trin for trin"},
    "slet": {"z": "s", "p": [-106.74, 36.7]},
    "tips|nyt-tip": {"z": "s"},
    "forside|hvad-kan-jeg-lave": {"s": 34, "b": "himmel", "z": "l"}
  };
  const D = k => data[k] !== undefined ? data[k] : STANDARD[k];
  const get = k => {
    if (D(k) !== undefined) return D(k);
    if (arv[k] === undefined || D(arv[k]) === undefined) return undefined;
    if (arvFelt[k] === false && feltTekster.has(arv[k])) return undefined; // gamle tilpasninger på teksten tilhører knappen
    return D(arv[k]);
  };

  const tomb = k => arv[k] !== undefined && data[arv[k]] !== undefined; // en nulstillet tilpasning huskes, så den gamle ikke dukker op igen
  const slug = s => String(s).toLowerCase().replace(/[^a-zæøå]+/g, '-').replace(/^-|-$/g, '');
  const sideNavn = () => (location.hash || '#/').replace(/^#\/?/, '').split('/').filter(Boolean).map(s => /\d/.test(s) ? ':id' : s).join('/') || 'forside';
  const idAf = (el, tekst) => el.dataset.tpid || (el.matches('.tilbage') ? 'tilbage' + (el.classList.contains('fortryd') ? '-fortryd' : '') : sideNavn() + '|' + slug(tekst));
  const noder = el => [...el.childNodes].filter(n => n.nodeType === 3 && n.nodeValue.trim());
  const tekstAf = el => noder(el).map(n => n.nodeValue.trim()).join(' ');
  // Kun faste tekster kan ændres: ikke opskrifternes navne, tal og ure
  const egnet = (el, k) => k && !/\d/.test(k) && !el.closest('#ark, #tilpas-gruppe, #tilpas-knap, #tilpas-forlad, #tilpas-fortryd, #tilpas-gentag, .titelrakke, .h-boble, .tekst, .kort[href^="#/opskrifter"], .koebsforslag') && !(el.matches('p, small') && el.firstElementChild);

  function anvend() {
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
      const o = get(k) || {}, ny = o.t || leg, n = noder(el);
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
    });
    if (ryd.length) setTimeout(() => ryd.forEach(k => { if (get(k) && get(k).x) { const ny = { ...get(k) }; delete ny.x; gem(k, ny, true); } }), 0);
    document.querySelectorAll(FLYT).forEach(el => { // felternes plads
      if (el.classList.contains('plads')) return;
      if (drag && drag.laast && drag.el === el) return;
      if (el.matches(NEDE)) { // «Gem» i en formular sidder altid fast nederst på skærmen (CSS). Den kan ikke flyttes eller låses af tilpasseren.
        fjernFast(el); el.style.translate = ''; el.removeAttribute('data-laast'); el.setAttribute('data-ikkeflyt', '');
        if (el.dataset.org) el.dataset.flyt = el.dataset.org;
        return;
      }
      let k = el.dataset.org;
      if (!k && el.matches(TRIN)) k = el.dataset.tpid;
      if (el.matches('.kort')) k = el.closest('#ark') ? null : el.dataset.tpid || 'kort:' + (el.getAttribute('href') || el.textContent.trim().slice(0, 40)); // felter med data-tpid bruger det
      const p = !el.matches(FAST) && k && get(k) && get(k).p;
      if (k) el.dataset.flyt = k; else delete el.dataset.flyt;
      const fast = !el.matches(FAST) && !!k && erFast(el, k), o = (k && get(k)) || {};
      if (el.matches('.knap, .tilbage, .fane') && o.z) el.dataset.fs = o.z; else delete el.dataset.fs;
      plac(el, p, fast);
      el.toggleAttribute('data-laast', fast);
      el.toggleAttribute('data-ikkeflyt', !!o.m || el.matches(FAST));
    });
    document.querySelectorAll('[data-flyt]').forEach(el => { // først når alle står på plads: ingen må ende uden for skærmen eller oven på et andet felt
      if (el.classList.contains('plads') || (drag && drag.laast && drag.el === el)) return;
      const p = !el.matches(FAST) && get(el.dataset.flyt) && get(el.dataset.flyt).p;
      if (!p || !uheldig(el)) return;
      const fast = el.hasAttribute('data-laast');
      plac(el, p, fast, 1); if (uheldig(el)) plac(el, p, fast, 2);
    });
    document.querySelectorAll('[data-tom]').forEach(c => { c.style.display = ''; delete c.dataset.tom; }); // en række med skjulte felter beholder sin plads, så siden ikke kryber sammen
    bjaelke();
  }
  // Knap nederst til højre: sætter tilpasningen på pause, så man kan bladre i appen, og tænder den igen
  function bjaelke() {
    let b = document.getElementById('tilpas-knap');
    if (til && !b) {
      b = document.createElement('button'); b.id = 'tilpas-knap'; b.type = 'button';
      b.addEventListener('click', () => { aktiv = !aktiv; lager.gem('tilpasAktiv', aktiv); if (aktiv) toast('Tryk for at ændre. Hold og træk for at flytte.'); anvend(); });
      document.getElementById('nav').append(b); // knappen står i navigationen, så længe «Tilpas siden» er slået til under Indstillinger
      for (const [id, tekst, fkt] of [['tilpas-fortryd', '↶ Fortryd', fortryd], ['tilpas-gentag', 'Gentag ↷', gentag]]) {
        const x = document.createElement('button'); x.id = id; x.type = 'button'; x.textContent = tekst; x.addEventListener('click', fkt); document.body.append(x);
      }
    } else if (!til && b) { b.remove(); ['tilpas-fortryd', 'tilpas-gentag'].forEach(id => { const x = document.getElementById(id); if (x) x.remove(); }); }
    knapper();
    if (b) b.innerHTML = `<span>${Ikoner.svg(aktiv ? 'pause' : 'blyant')}</span><span>${aktiv ? 'Pause tilpas' : 'Tilpas igen'}</span>`;
  }
  // Fortryd og gentag: hver ændring gemmer et billede af tilpasningerne før ændringen
  let hist = [], frem = [];
  const kopi = d => JSON.parse(JSON.stringify(d));
  function knapper() {
    const u = document.getElementById('tilpas-fortryd'), g = document.getElementById('tilpas-gentag');
    if (u) { u.disabled = !hist.length; u.style.display = aktiv ? '' : 'none'; } // kun når tilpasningen ikke er på pause
    if (g) { g.disabled = !frem.length; g.style.display = aktiv ? '' : 'none'; }
  }
  function husk() { hist.push(kopi(data)); if (hist.length > 50) hist.shift(); frem = []; knapper(); }
  async function skriv(k, ny, stille) {
    try {
      if (Object.keys(ny).length || data[k] !== undefined) {
        const rad = { noegle: k, tekst: ny.t || null, stoerrelse: ny.s || null, farve: ny.f || null, baggrund: ny.b || null };
        const url = 'tilpasning?on_conflict=noegle', pos = ny.p ? ny.p.join(',') : null, lst = ny.l === undefined ? null : !!ny.l;
        const trin = [{ skjult: !!ny.x, pos, felt: ny.z || null, laast: lst, ikkeflyt: !!ny.m }, { skjult: !!ny.x, pos, felt: ny.z || null, laast: lst }, { skjult: !!ny.x, pos }, { skjult: !!ny.x }, {}];
        let ok = -1;
        for (let i = 0; i < trin.length && ok < 0; i++) { try { await api(url, { method: 'POST', flet: true, body: { ...rad, ...trin[i] } }); ok = i; } catch (e) { if (i === trin.length - 1) throw e; } }
        if (ok > 0) toast('Gemt på denne enhed. Databasen mangler en kolonne (' + ['', 'ikkeflyt', 'felt, laast', 'pos', 'skjult'][ok] + ').');
      } else await api(`tilpasning?noegle=eq.${enc(k)}`, { method: 'DELETE' });
      if (!stille) toast('Gemt');
    } catch (err) { console.error(err); toast('Gemt på denne enhed. Databasen mangler tabellen «tilpasning».'); }
  }
  async function gem(k, ny, stille) {
    if (!stille) husk();
    if (Object.keys(ny).length) data[k] = ny; else if (tomb(k)) data[k] = {}; else delete data[k];
    lager.gem('tilpas', data); anvend();
    await skriv(k, ny, stille);
  }
  async function skift(nyData) { // fortryd/gentag: sæt tilpasningerne tilbage og ret databasen, hvor noget er anderledes
    const foer = data; data = nyData; lager.gem('tilpas', data); anvend(); knapper();
    for (const k of new Set([...Object.keys(foer), ...Object.keys(data)])) if (JSON.stringify(foer[k] || null) !== JSON.stringify(data[k] || null)) await skriv(k, data[k] || {}, true);
  }
  function fortryd() { if (!hist.length) return; frem.push(kopi(data)); skift(hist.pop()); toast('Fortrudt'); }
  function gentag() { if (!frem.length) return; hist.push(kopi(data)); skift(frem.pop()); toast('Gentaget'); }
  async function hent() {
    try {
      const rader = await api('tilpasning?select=*');
      data = {};
      for (const r of rader) {
        const o = Object.fromEntries(Object.entries({ t: r.tekst, s: r.stoerrelse && Number(r.stoerrelse), f: r.farve, b: r.baggrund, x: r.skjult, z: r.felt, l: r.laast, m: r.ikkeflyt, p: r.pos && String(r.pos).split(',').map(Number) }).filter(([, v]) => v));
        if (r.laast === false) o.l = false;
        data[r.noegle] = o;
      }
      server = true; lager.gem('tilpas', data); anvend();
    } catch (err) { /* tabellen findes ikke endnu: brug det, der er gemt på enheden */ }
  }
  function saet(v) {
    til = !!v; if (til) { aktiv = false; lager.gem('tilpasAktiv', false); toast('Tilpasningen er på pause. Tryk på «Tilpas igen» for at ændre.'); } lager.gem('tilpasTil', til); anvend();
    const c = document.getElementById('tilpastil'); if (c) c.checked = til;
  }
  const rgbAf = t => (String(t).match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const probe = css => { const e = document.createElement('span'); e.style.color = css; document.body.appendChild(e); const r = rgbAf(getComputedStyle(e).color); e.remove(); return r; };
  const naermest = (liste, rgb, css) => liste.reduce((bst, c) => { const d = probe(css(c)).reduce((sum, v, i) => sum + (v - rgb[i]) ** 2, 0); return d < bst[0] ? [d, c] : bst; }, [Infinity, ''])[1];
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
    const k = el.dataset.org, o = get(k) || {}, felt = el.matches('.knap, .tilbage, .fane'), farvefelt = felt || el.matches('.rund, .mp-inp, .chip, .mp-dagfelt, .mp-ret'), nat = naturligZ(el), std = standardFarver(el);
    const opsk = el.matches(FAST);
    const st0 = o.s ? pxAf(o.s) : naermestStr(parseFloat(el.dataset.fs) || 20); let st = st0, f = o.f || std.f, b = o.b || std.b, kanSkjule = !(beskyttet.has(k) || beskyttet.has(el.dataset.orgtekst)), x = !!o.x && kanSkjule, z = o.z || nat, foer = erFast(el, k), l = foer, m = !!o.m;
    const laasTekst = v => v ? 'Feltet sidder fast på skærmen og følger med, når du ruller.' : 'Feltet bliver liggende på sin plads, når du ruller.';
    const sw = (liste, v, nøgle, glas, css) => `<div class="farver">${glas ? `<button type="button" class="sw glas${v === 'glas' ? ' valgt' : ''}" data-${nøgle}="glas" aria-label="Gennemsigtigt glas"></button>` : ''}${liste.map(c => `<button type="button" class="sw${c === v ? ' valgt' : ''}" data-${nøgle}="${c}" style="background:${css(c)}" aria-label="${NAVN[c] || c}"></button>`).join('')}</div>`;
    const d = ark(`<div class="tp-top"><h2>Tilpas felt</h2><div class="rakke"><button class="knap gron" type="button" data-tp="gem">Gem</button><button class="knap primaer" type="button" data-tp="nulstil">Nulstil</button>${kanSkjule ? `<button class="knap fare" type="button" data-tp="skjul">${x ? 'Vis igen' : 'Skjul'}</button>` : ''}</div></div>
      ${el.matches('.mp-dagfelt, .mp-ret') ? '' : `<label for="tp-tekst">Tekst</label>
      <input type="text" id="tp-tekst" value="${esc(o.t || el.dataset.orgtekst || '')}" maxlength="200" autocomplete="off">`}
      <label>Tekststørrelse</label>
      <div class="rakke venstre">${STR.map(([v, n]) => `<button class="chip${v === st ? ' valgt' : ''}" type="button" data-st="${v}">${n}</button>`).join('')}</div>
      ${felt ? `<label>Feltets størrelse</label><div class="rakke venstre">${FELTSTR.map(([v, n]) => `<button class="chip${v === z ? ' valgt' : ''}" type="button" data-fz="${v}">${n}</button>`).join('')}</div>` : ''}
      <label>Tekstfarve</label>${sw(TEKSTFARVER, f, 'f', false, tCss)}
      ${farvefelt ? `<label>Feltets farve</label>${sw(FELTFARVER, b, 'b', true, fCss)}` : ''}
      <p class="lille">Ændringen gælder dette felt og de felter, der hænger sammen med det.</p>
      ${opsk ? '<p class="lille">Teksten i opskriften kan ændres, men ikke flyttes.</p>' : `<div class="rakke venstre"><button class="knap" type="button" data-tp="flyt">${m ? 'Kan flyttes igen' : 'Kan ikke flyttes'}</button></div>
      <p class="lille" id="tp-flyttekst">${flytTekst(m)}</p>`}
      ${el.closest('.top') || opsk ? '' : `<div class="rakke venstre"><button class="knap" type="button" data-tp="laas">${Ikoner.svg(l ? 'laasop' : 'laas')} ${l ? 'Lås op' : 'Lås på skærmen'}</button></div>
      <p class="lille" id="tp-laastekst">${laasTekst(l)}</p>`}
`);
    { const h = Math.max(20, Math.min(90, Number(lager.hent('tilpasHoejde', 33)) || 33)); $('.ark-kort', d).style.maxHeight = `min(max(${h}dvh, var(--ark-min, 280px)), calc(100dvh - 16px))`; } // vinduets højde i procent af skærmen (sættes under Mere), dog mindst --ark-min (280 px, på iPad 480 px), så det kan bruges på en vendt telefon
    d.addEventListener('click', e => {
      const s = e.target.closest('[data-st]'), a = e.target.closest('[data-tp]'), c = e.target.closest('.sw'), fz = e.target.closest('[data-fz]');
      if (fz) { z = fz.dataset.fz; d.querySelectorAll('[data-fz]').forEach(x => x.classList.toggle('valgt', x === fz)); return; }
      if (a && a.dataset.tp === 'flyt') { m = !m; a.textContent = m ? 'Kan flyttes igen' : 'Kan ikke flyttes'; $('#tp-flyttekst', d).textContent = flytTekst(m); return; }
      if (a && a.dataset.tp === 'laas') { l = !l; a.innerHTML = Ikoner.svg(l ? 'laasop' : 'laas') + (l ? ' Lås op' : ' Lås på skærmen'); $('#tp-laastekst', d).textContent = laasTekst(l); return; }
      if (c) { const n = 'f' in c.dataset ? 'f' : 'b'; if (n === 'f') f = c.dataset.f; else b = c.dataset.b; c.parentElement.querySelectorAll('.sw').forEach(x => x.classList.toggle('valgt', x === c)); return; }
      if (s) { st = Number(s.dataset.st); d.querySelectorAll('[data-st]').forEach(x => x.classList.toggle('valgt', x === s)); return; }
      if (e.target.closest('.ark-bag')) return lukArk();
      if (!a) return;
      let ny = {};
      if (a.dataset.tp !== 'nulstil') {
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
      lukArk(); gem(k, ny);
    });
    setTimeout(() => $('#tp-tekst', d).select(), 50);
  }
  function aabnKort(el) {
    const k = el.dataset.flyt, l = erFast(el, k), m = !!(get(k) || {}).m;
    const d = ark(`<h2>Flyt felt</h2><p class="lille">${flytTekst(m)} Det falder på notesbogens net.</p>
      <p class="lille">${l ? 'Feltet sidder fast på skærmen og følger med, når du ruller.' : 'Feltet bliver liggende på sin plads, når du ruller.'}</p>
      <div class="rakke venstre"><button class="knap" type="button" data-tp="flyt">${m ? 'Kan flyttes igen' : 'Kan ikke flyttes'}</button></div>
      <div class="rakke"><button class="knap" type="button" data-tp="laas">${Ikoner.svg(l ? 'laasop' : 'laas')} ${l ? 'Lås op' : 'Lås på skærmen'}</button><button class="knap" type="button" data-tp="nulstil">Nulstil plads</button><button class="knap primaer" type="button" data-tp="luk">Luk</button></div>`);
    d.addEventListener('click', e => {
      if (e.target.closest('.ark-bag')) return lukArk();
      const a = e.target.closest('[data-tp]'); if (!a) return;
      lukArk(); const o = get(k) || {};
      if (a.dataset.tp === 'flyt') { const { m: _m, ...rest } = o; if (!m) rest.m = true; gem(k, rest); }
      else if (a.dataset.tp === 'nulstil') { const { p, ...rest } = o; gem(k, rest); }
      else if (a.dataset.tp === 'laas') {
        const g = o.p || [0, 0], p = [g[0], Math.round((g[1] + (l ? scrollY : -scrollY)) * 100) / 100, ...g.slice(2)], { l: _l, p: _p, ...rest } = o;
        if (p[0] || p[1]) rest.p = p;
        if (!l !== standardFast(el)) rest.l = !l;
        gem(k, rest);
      }
    });
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
    if (!el || el.closest('#ark') || (get(el.dataset.flyt) || {}).m || el.matches(FAST)) return;
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
  const igen = () => { cancelAnimationFrame(timer); timer = requestAnimationFrame(anvend); };
  const appEl = document.getElementById('app'); // mens siden glider ind, er felternes mål forskudt: placeringerne sættes igen, når bevægelsen er slut
  if (appEl) appEl.addEventListener('animationend', e => { if (e.animationName === 'sideind') igen(); });
  if (window.ResizeObserver) new ResizeObserver(igen).observe(document.querySelector('main')); // indholdet kan lægge sig om uden at DOM'en ændres (skrifttyper, billeder): placeringerne sættes igen
  if (document.fonts) document.fonts.ready.then(igen);
  new MutationObserver(igen).observe(document.body, { childList: true, subtree: true });
  // Vendes skærmen, eller ændres vinduets bredde, sættes alle felter på plads igen (efter at siden har lagt sig om)
  let vendTimer;
  const omlaeg = () => { clearTimeout(vendTimer); vendTimer = setTimeout(() => { if (drag && drag.laast) return; anvend(); requestAnimationFrame(anvend); }, 120); };
  addEventListener('resize', omlaeg); addEventListener('orientationchange', omlaeg);  document.addEventListener('DOMContentLoaded', () => { anvend(); hent(); });
  return { saet, til: () => til, async nulstil() {
    husk(); data = {}; lager.gem('tilpas', data); anvend();
    try { await api('tilpasning?noegle=not.is.null', { method: 'DELETE' }); } catch (err) { console.error(err); }
  } };
})();
