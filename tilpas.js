// Tilpas siden: når det er slået til, kan man trykke på en knap eller overskrift og ændre teksten og skriftstørrelsen,
// og holde fingeren på et felt og trække det. Det falder på notesbogens net: 16 px på tværs, og på rækkerne à 32 px op og ned
// (store felter: top midt mellem to linjer. Små felter på 32 px: kanterne på linjerne. Tekst: på rækken).
// Kolonner i «tilpasning»: pos («dx,dy», målt ved øverst på siden), felt (størrelsen s/m/l), laast (true: feltet sidder fast på skærmen og følger med,
// når man ruller. false eller tom: det bliver liggende på sin plads på siden. «Tilføj tip» og «Rediger» sidder som standard fast).
// Ændringen gælder alle steder, hvor den samme tekst står. Den gemmes i Supabase (tabellen «tilpasning») og dermed på alle enheder.
// Mangler tabellen, gemmes den kun på denne enhed.
const Tilpas = (() => {
  const VALG = '.knap, .tilbage, .fane, .logo, main h1, main h2, main p.lille, main p.tomt, main small';
  const FAST = '.opsk'; // tekster inde i selve opskriften: kan ændres, men aldrig flyttes
  const KORT = '.kort:not([href^="#/opskrifter"]):not(.koebsforslag)', G = 16, FLYT = VALG + ', ' + KORT; // opskrifter kan ikke tilpasses
  const FELTSTR = [['s', 'Lille'], ['m', 'Normal'], ['l', 'Stor']]; // 32, 64 og 96 px: som mærker, knapper og faner
  const naturligZ = el => el.matches('.fane') ? 'l' : el.matches('.tilbage, .vaerktoej .knap') ? 's' : 'm';
  const standardFast = el => el.matches('.vaerktoej .knap');
  const erFast = (el, k) => !el.closest('.top') && (data[k] && data[k].l !== undefined ? !!data[k].l : standardFast(el));
  // Fastlåst felt: position: fixed (browseren ruller det selv, så det hakker ikke). En usynlig kopi holder pladsen på siden.
  const fjernFast = el => {
    if (!el._ph) return;
    el._ph.remove(); el._ph = null;
    ['position', 'margin', 'left', 'top', 'width', 'zIndex'].forEach(k => { el.style[k] = ''; });
  };
  function plac(el, p, fast) {
    if (!fast) { fjernFast(el); el.style.translate = p ? `${p[0]}px ${p[1]}px` : ''; return; }
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
    Object.assign(el.style, { position: 'fixed', margin: '0', translate: 'none', left: (r.left + (p ? p[0] : 0)) + 'px', top: (r.top + scrollY + (p ? p[1] : 0)) + 'px', width: r.width + 'px', zIndex: '19' });
  }
  const raster = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--raster')) || 0;
  const fase = el => el.matches('.kort, .knap, .tilbage, .fane') ? (Math.round(el.offsetHeight / 32) === 1 ? 28 : 12) : 0;
  const STR = [[0.85, 'Lille'], [1, 'Normal'], [1.2, 'Stor'], [1.45, 'Størst']];
  const TEKSTFARVER = ['#22386b', '#56638a', '#b5301f', '#d9432f', '#2f8f4e', '#2f7f95', '#e8a400', '#d0507a', '#ffffff', '#222222']; // de to første er appens egne standardfarver
  const FELTFARVER = ['#ffd95a', '#a0e2b2', '#ffbeb6', '#cfe6f5', '#ffffff', '#de4832', '#4a9fb5', '#22386b']; // plus «glas» (gennemsigtigt Liquid Glass)
  let til = lager.hent('tilpasTil', false), timer, aktiv = lager.hent('tilpasAktiv', true), server = false, data = lager.hent('tilpas', {});
  const noder = el => [...el.childNodes].filter(n => n.nodeType === 3 && n.nodeValue.trim());
  const tekstAf = el => noder(el).map(n => n.nodeValue.trim()).join(' ');
  // Kun faste tekster kan ændres: ikke opskrifternes navne, tal og ure
  const egnet = (el, k) => k && !/\d/.test(k) && !el.closest('#ark, #tilpas-knap, #tilpas-fortryd, #tilpas-gentag, .titelrakke, .h-boble, .tekst, .kort[href^="#/opskrifter"], .koebsforslag') && !(el.matches('p, small') && el.firstElementChild);

  function anvend() {
    document.body.classList.toggle('tilpas', til && aktiv);
    document.body.classList.toggle('tilpas-menu', til);
    document.querySelectorAll(VALG).forEach(el => {
      if (el.classList.contains('plads')) return;
      const k = el.dataset.org ?? tekstAf(el);
      if (!egnet(el, k)) return;
      el.dataset.org = k;
      const o = data[k] || {}, ny = o.t || k, n = noder(el);
      if (n.length && tekstAf(el) !== ny) { n[0].nodeValue = ny; n.slice(1).forEach(x => { x.nodeValue = ''; }); }
      if (!el.dataset.fs) el.dataset.fs = parseFloat(getComputedStyle(el).fontSize);
      el.style.fontSize = o.s ? (el.dataset.fs * o.s) + 'px' : '';
      const ret = til && aktiv; // under tilpasning vises skjulte felter svagt, så de kan hentes tilbage
      el.style.display = o.x && !ret ? 'none' : '';
      el.style.opacity = o.x && ret ? '.35' : '';
      el.style.color = o.f || '';
      el.style.background = o.b === 'glas' ? 'var(--glas)' : (o.b || '');
    });
    document.querySelectorAll(FLYT).forEach(el => { // felternes plads
      if (el.classList.contains('plads')) return;
      if (drag && drag.laast && drag.el === el) return;
      let k = el.dataset.org;
      if (el.matches('.kort')) k = el.closest('#ark') ? null : 'kort:' + (el.getAttribute('href') || el.textContent.trim().slice(0, 40));
      const p = !el.matches(FAST) && k && data[k] && data[k].p;
      if (k) el.dataset.flyt = k; else delete el.dataset.flyt;
      const fast = !el.matches(FAST) && !!k && erFast(el, k), o = (k && data[k]) || {};
      if (el.matches('.knap, .tilbage, .fane') && o.z) el.dataset.fs = o.z; else delete el.dataset.fs;
      plac(el, p, fast);
      el.toggleAttribute('data-laast', fast);
      el.toggleAttribute('data-ikkeflyt', !!o.m || el.matches(FAST));
    });
    document.querySelectorAll('.rakke, .vaerktoej, .genveje, .faner').forEach(c => { // tomme rækker skjules med
      const tom = c.children.length > 0 && [...c.children].every(k => k.style.display === 'none');
      if (tom) { c.style.display = 'none'; c.dataset.tom = '1'; } else if (c.dataset.tom) { c.style.display = ''; delete c.dataset.tom; }
    });
    bjaelke();
  }
  // Knap nederst til højre: sætter tilpasningen på pause, så man kan bladre i appen, og tænder den igen
  function bjaelke() {
    let b = document.getElementById('tilpas-knap');
    if (til && !b) {
      b = document.createElement('button'); b.id = 'tilpas-knap'; b.type = 'button';
      b.addEventListener('click', () => { aktiv = !aktiv; lager.gem('tilpasAktiv', aktiv); if (aktiv) toast('Tryk for at ændre. Hold og træk for at flytte.'); anvend(); });
      document.body.append(b);
      for (const [id, tekst, fkt] of [['tilpas-fortryd', '↶ Fortryd', fortryd], ['tilpas-gentag', 'Gentag ↷', gentag]]) {
        const x = document.createElement('button'); x.id = id; x.type = 'button'; x.textContent = tekst; x.addEventListener('click', fkt); document.body.append(x);
      }
    } else if (!til && b) { b.remove(); ['tilpas-fortryd', 'tilpas-gentag'].forEach(id => { const x = document.getElementById(id); if (x) x.remove(); }); }
    knapper();
    if (b) b.innerHTML = Ikoner.svg(aktiv ? 'pause' : 'blyant') + (aktiv ? ' Pause tilpas' : ' Tilpas igen');
  }
  // Fortryd og gentag: hver ændring gemmer et billede af tilpasningerne før ændringen
  let hist = [], frem = [];
  const kopi = d => JSON.parse(JSON.stringify(d));
  function knapper() {
    const u = document.getElementById('tilpas-fortryd'), g = document.getElementById('tilpas-gentag');
    if (u) u.disabled = !hist.length;
    if (g) g.disabled = !frem.length;
  }
  function husk() { hist.push(kopi(data)); if (hist.length > 50) hist.shift(); frem = []; knapper(); }
  async function skriv(k, ny, stille) {
    try {
      if (Object.keys(ny).length) {
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
    if (Object.keys(ny).length) data[k] = ny; else delete data[k];
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
    til = !!v; if (til) { aktiv = true; lager.gem('tilpasAktiv', true); toast('Tryk for at ændre. Hold og træk for at flytte.'); } lager.gem('tilpasTil', til); anvend();
    const c = document.getElementById('tilpastil'); if (c) c.checked = til;
  }
  const rgbAf = t => (String(t).match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const naermest = (liste, rgb) => liste.reduce((bst, c) => { const d = hexRgb(c).reduce((sum, v, i) => sum + (v - rgb[i]) ** 2, 0); return d < bst[0] ? [d, c] : bst; }, [Infinity, ''])[1];
  // Elementets egne farver (uden ændringer), som den farveknap der svarer til dem. Gennemsigtigt eller hvidt glas er knappen «glas».
  function standardFarver(el) {
    const f0 = el.style.color, b0 = el.style.background; el.style.color = ''; el.style.background = '';
    const cs = getComputedStyle(el), tekst = rgbAf(cs.color);
    const bg = cs.backgroundImage !== 'none' ? (cs.backgroundImage.match(/rgba?\([^)]*\)/) || [''])[0] : cs.backgroundColor, brgb = rgbAf(bg);
    el.style.color = f0; el.style.background = b0;
    return { f: naermest(TEKSTFARVER, tekst), b: !brgb.length || brgb.every(v => v >= 250) || /,\s*0\)$/.test(bg) ? 'glas' : naermest(FELTFARVER, brgb) };
  }
  const flytTekst = v => v ? 'Feltet kan ikke flyttes. Du kan stadig ændre tekst og farve.' : 'Du flytter feltet ved at holde fingeren på det og trække.';
  function aabn(el) {
    const k = el.dataset.org, o = data[k] || {}, felt = el.matches('.knap, .tilbage, .fane'), nat = naturligZ(el), std = standardFarver(el);
    const opsk = el.matches(FAST);
    let st = o.s || 1, f = o.f || std.f, b = o.b || std.b, x = !!o.x, z = o.z || nat, foer = erFast(el, k), l = foer, m = !!o.m;
    const laasTekst = v => v ? 'Feltet sidder fast på skærmen og følger med, når du ruller.' : 'Feltet bliver liggende på sin plads, når du ruller.';
    const sw = (liste, v, nøgle, glas) => `<div class="farver">${glas ? `<button type="button" class="sw glas${v === 'glas' ? ' valgt' : ''}" data-${nøgle}="glas" aria-label="Gennemsigtigt glas"></button>` : ''}${liste.map(c => `<button type="button" class="sw${c === v ? ' valgt' : ''}" data-${nøgle}="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div>`;
    const d = ark(`<h2>Ret tekst</h2>
      <label for="tp-tekst">Tekst</label>
      <input type="text" id="tp-tekst" value="${esc(o.t || k)}" maxlength="200" autocomplete="off">
      <label>Tekststørrelse</label>
      <div class="rakke venstre">${STR.map(([v, n]) => `<button class="chip${v === st ? ' valgt' : ''}" type="button" data-st="${v}">${n}</button>`).join('')}</div>
      ${felt ? `<label>Feltets størrelse</label><div class="rakke venstre">${FELTSTR.map(([v, n]) => `<button class="chip${v === z ? ' valgt' : ''}" type="button" data-fz="${v}">${n}</button>`).join('')}</div>` : ''}
      <label>Tekstfarve</label>${sw(TEKSTFARVER, f, 'f')}
      ${felt ? `<label>Feltets farve</label>${sw(FELTFARVER, b, 'b', true)}` : ''}
      <p class="lille">Ændringen gælder alle steder, hvor «${esc(k)}» står.</p>
      ${opsk ? '<p class="lille">Teksten i opskriften kan ændres, men ikke flyttes.</p>' : `<div class="rakke venstre"><button class="knap" type="button" data-tp="flyt">${m ? 'Kan flyttes igen' : 'Kan ikke flyttes'}</button></div>
      <p class="lille" id="tp-flyttekst">${flytTekst(m)}</p>`}
      ${el.closest('.top') || opsk ? '' : `<div class="rakke venstre"><button class="knap" type="button" data-tp="laas">${Ikoner.svg(l ? 'laasop' : 'laas')} ${l ? 'Lås op' : 'Lås på skærmen'}</button></div>
      <p class="lille" id="tp-laastekst">${laasTekst(l)}</p>`}
      <div class="rakke"><button class="knap fare" type="button" data-tp="skjul">${x ? 'Vis igen' : 'Skjul her'}</button><button class="knap" type="button" data-tp="nulstil">Nulstil</button><button class="knap primaer" type="button" data-tp="gem">Gem</button></div>`);
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
        const t = $('#tp-tekst', d).value.trim();
        if (t && t !== k) ny.t = t;
        if (st !== 1) ny.s = st;
        if (f !== std.f) ny.f = f; // en farve, der er appens egen, gemmes ikke
        if (felt && b !== std.b) ny.b = b;
        if (m) ny.m = true;
        let p = o.p;
        if (l !== foer) { const g = p || [0, 0]; p = [g[0], Math.round((g[1] + (l ? -scrollY : scrollY)) * 100) / 100]; if (!p[0] && !p[1]) p = null; } // feltet bliver, hvor det står på skærmen nu
        if (p && !opsk) ny.p = p;
        if (felt && z !== nat) ny.z = z;
        if (l !== standardFast(el)) ny.l = l;
      }
      lukArk(); gem(k, ny);
      if (ny.p && (ny.z || '') !== (o.z || '')) setTimeout(() => genplacer(k), 80); // ny størrelse: ind på nettet igen
    });
    setTimeout(() => $('#tp-tekst', d).select(), 50);
  }
  function aabnKort(el) {
    const k = el.dataset.flyt, l = erFast(el, k), m = !!(data[k] || {}).m;
    const d = ark(`<h2>Flyt felt</h2><p class="lille">${flytTekst(m)} Det falder på notesbogens net.</p>
      <p class="lille">${l ? 'Feltet sidder fast på skærmen og følger med, når du ruller.' : 'Feltet bliver liggende på sin plads, når du ruller.'}</p>
      <div class="rakke venstre"><button class="knap" type="button" data-tp="flyt">${m ? 'Kan flyttes igen' : 'Kan ikke flyttes'}</button></div>
      <div class="rakke"><button class="knap" type="button" data-tp="laas">${Ikoner.svg(l ? 'laasop' : 'laas')} ${l ? 'Lås op' : 'Lås på skærmen'}</button><button class="knap" type="button" data-tp="nulstil">Nulstil plads</button><button class="knap primaer" type="button" data-tp="luk">Luk</button></div>`);
    d.addEventListener('click', e => {
      if (e.target.closest('.ark-bag')) return lukArk();
      const a = e.target.closest('[data-tp]'); if (!a) return;
      lukArk(); const o = data[k] || {};
      if (a.dataset.tp === 'flyt') { const { m: _m, ...rest } = o; if (!m) rest.m = true; gem(k, rest); }
      else if (a.dataset.tp === 'nulstil') { const { p, ...rest } = o; gem(k, rest); }
      else if (a.dataset.tp === 'laas') {
        const g = o.p || [0, 0], p = [g[0], Math.round((g[1] + (l ? scrollY : -scrollY)) * 100) / 100], { l: _l, p: _p, ...rest } = o;
        if (p[0] || p[1]) rest.p = p;
        if (!l !== standardFast(el)) rest.l = !l;
        gem(k, rest);
      }
    });
  }
  function genplacer(k) {
    const el = document.querySelector(`[data-flyt="${CSS.escape(k)}"]`), p = data[k] && data[k].p; if (!el || !p) return;
    const r = el.getBoundingClientRect(), rast = raster(), f = fase(el), T = r.top + (el.hasAttribute('data-laast') ? 0 : scrollY), Y = rast + f + Math.round((T - rast - f) / 32) * 32, dy = Y - T;
    if (Math.abs(dy) > .5) gem(k, { ...data[k], p: [p[0], Math.round((p[1] + dy) * 100) / 100] }, true);
  }
  // Træk: hold fingeren stille et øjeblik, så løfter feltet sig, og det følger fingeren og falder på gitteret
  let drag = null, sidstTrukket = 0;
  const gitter = () => { let g = document.getElementById('gitter'); if (!g) { g = document.createElement('div'); g.id = 'gitter'; document.body.append(g); } return g; };
  function startTraek(d) {
    d.laast = true; const m = document.querySelector('main'), tf = d.el.style.transform, ov = d.el.style.transition;
    d.el.style.transition = 'none'; d.el.style.transform = 'none'; // målt uden «trykket ned»-effekten
    const r = d.el.getBoundingClientRect(); d.el.style.transform = tf; void d.el.offsetWidth; d.el.style.transition = ov;
    d.fast = d.el.hasAttribute('data-laast') && !!d.el._ph; d.top0 = r.top;
    if (d.fast) { const q = d.el._ph.getBoundingClientRect(); d.nx = q.left; d.natDoc = q.top + scrollY; } // fastlåst: pladsholderen viser, hvor feltet ville stå
    else { d.nx = r.left - d.p0[0]; d.natDoc = r.top - d.p0[1] + scrollY; }
    d.rast = raster(); d.fase = fase(d.el); d.xo = m.getBoundingClientRect().left + parseFloat(getComputedStyle(m).paddingLeft) + scrollX;
    d.stat = getComputedStyle(d.el).position === 'static'; if (d.stat) d.el.style.position = 'relative';
    d.el.classList.add('traekker');
    gitter().style.backgroundPosition = `${d.xo - scrollX - 8}px ${d.rast + d.fase - (d.fast ? 0 : scrollY) - 16}px`;
    if (navigator.vibrate) navigator.vibrate(12);
  }
  // Et felt må ikke lande oven på tekst, der ikke kan tilpasses (opskrifter, trin, skrivefelter ...)
  const BLOKSKIP = '[data-org], [data-flyt], #ark, #gitter, .plads, #tilpas-knap, #tilpas-fortryd, #tilpas-gentag, #toast, #hjaelper, #hjaelper-vis, .h-boble';
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
    const tx = d.nx + d.p0[0] + e.clientX - d.x0 + scrollX, ty = d.top0 + e.clientY - d.y0 + (d.fast ? 0 : scrollY);
    const X = d.xo + Math.round((tx - d.xo) / G) * G, Y = d.rast + d.fase + Math.round((ty - d.rast - d.fase) / 32) * 32;
    d.p = [Math.round((X - scrollX - d.nx) * 100) / 100, Math.round((Y - d.natDoc) * 100) / 100];
    if (d.fast) { d.el.style.left = (d.nx + d.p[0]) + 'px'; d.el.style.top = (d.natDoc + d.p[1]) + 'px'; }
    else d.el.style.translate = `${d.p[0]}px ${d.p[1]}px`;
    if (!d.fast) { const kl = d.p.join(); if (kl !== d.sidstP) { d.sidstP = kl; d.ulovlig = paaTekst(d.el); d.el.classList.toggle('ulovlig', d.ulovlig); } } // fastlåste felter følger skærmen: tekst ruller under dem
  }
  function slutTraek() {
    const d = drag; drag = null; if (!d) return; clearTimeout(d.t);
    if (!d.laast) return;
    sidstTrukket = Date.now(); d.el.classList.remove('traekker'); if (d.stat) d.el.style.position = '';
    const g = document.getElementById('gitter'); if (g) g.remove();
    if (d.ulovlig) { d.el.classList.remove('ulovlig'); anvend(); toast('Her ligger tekst, der ikke kan tilpasses. Prøv et andet sted.'); return; }
    const k = d.el.dataset.flyt, { p, ...rest } = data[k] || {};
    if (d.p && (d.p[0] || d.p[1])) rest.p = d.p;
    gem(k, rest);
  }
  document.addEventListener('pointerdown', e => {
    if (!til || !aktiv || e.button > 0) return;
    const el = e.target.closest('[data-flyt]'); if (!el || el.closest('#ark') || (data[el.dataset.flyt] || {}).m || el.matches(FAST)) return;
    const d = drag = { el, x0: e.clientX, y0: e.clientY, p0: (data[el.dataset.flyt] || {}).p || [0, 0], laast: false };
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
  new MutationObserver(igen).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => { anvend(); hent(); });
  return { saet, til: () => til, async nulstil() {
    husk(); data = {}; lager.gem('tilpas', data); anvend();
    try { await api('tilpasning?noegle=not.is.null', { method: 'DELETE' }); } catch (err) { console.error(err); }
  } };
})();
