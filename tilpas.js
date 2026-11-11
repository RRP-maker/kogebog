// Tilpas siden: når det er slået til, kan man trykke på en knap eller overskrift og ændre teksten og skriftstørrelsen,
// og holde fingeren på et felt og trække det. Det falder på et gitter (G px). Pladsen gemmes som kolonnen «pos» («dx,dy»).
// Ændringen gælder alle steder, hvor den samme tekst står. Den gemmes i Supabase (tabellen «tilpasning») og dermed på alle enheder.
// Mangler tabellen, gemmes den kun på denne enhed.
const Tilpas = (() => {
  const VALG = '.knap, .tilbage, .fane, .logo, main h1, main h2, main p.lille, main p.tomt, main small';
  const G = 16, FLYT = VALG + ', .kort';
  const STR = [[0.85, 'Lille'], [1, 'Normal'], [1.2, 'Stor'], [1.45, 'Størst']];
  const TEKSTFARVER = ['#22386b', '#d9432f', '#2f8f4e', '#2f7f95', '#e8a400', '#d0507a', '#ffffff', '#222222'];
  const FELTFARVER = ['#ffd95a', '#c4ebcd', '#ffcdc6', '#cfe6f5', '#ffffff', '#d9432f', '#4a9fb5', '#22386b'];
  let til = lager.hent('tilpasTil', false), timer, aktiv = lager.hent('tilpasAktiv', true), server = false, data = lager.hent('tilpas', {});
  const noder = el => [...el.childNodes].filter(n => n.nodeType === 3 && n.nodeValue.trim());
  const tekstAf = el => noder(el).map(n => n.nodeValue.trim()).join(' ');
  // Kun faste tekster kan ændres: ikke opskrifternes navne, tal og ure
  const egnet = (el, k) => k && !/\d/.test(k) && !el.closest('#ark, #tilpas-knap, .titelrakke, .h-boble, .tekst') && !(el.matches('p, small') && el.firstElementChild);

  function anvend() {
    document.body.classList.toggle('tilpas', til && aktiv);
    document.body.classList.toggle('tilpas-menu', til);
    document.querySelectorAll(VALG).forEach(el => {
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
      el.style.background = o.b || '';
    });
    document.querySelectorAll(FLYT).forEach(el => { // felternes plads
      if (drag && drag.laast && drag.el === el) return;
      let k = el.dataset.org;
      if (el.matches('.kort')) k = el.closest('#ark') ? null : 'kort:' + (el.getAttribute('href') || el.textContent.trim().slice(0, 40));
      const p = k && data[k] && data[k].p;
      if (k) el.dataset.flyt = k; else delete el.dataset.flyt;
      el.style.translate = p ? `${p[0]}px ${p[1]}px` : '';
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
    } else if (!til && b) b.remove();
    if (b) b.innerHTML = Ikoner.svg(aktiv ? 'pause' : 'blyant') + (aktiv ? ' Pause tilpas' : ' Tilpas igen');
  }
  async function gem(k, ny) {
    if (Object.keys(ny).length) data[k] = ny; else delete data[k];
    lager.gem('tilpas', data); anvend();
    try {
      if (Object.keys(ny).length) {
        const rad = { noegle: k, tekst: ny.t || null, stoerrelse: ny.s || null, farve: ny.f || null, baggrund: ny.b || null };
        const url = 'tilpasning?on_conflict=noegle', skjult = !!ny.x;
        try { await api(url, { method: 'POST', flet: true, body: { ...rad, skjult, pos: ny.p ? ny.p.join(',') : null } }); }
        catch (e) { // kolonnen «pos» eller «skjult» mangler måske endnu
          try { await api(url, { method: 'POST', flet: true, body: { ...rad, skjult } }); if (ny.p) toast('Flyttet på denne enhed. Databasen mangler kolonnen «pos».'); }
          catch (e2) { await api(url, { method: 'POST', flet: true, body: rad }); if (ny.x) toast('Skjult på denne enhed. Databasen mangler kolonnen «skjult».'); }
        }
      } else await api(`tilpasning?noegle=eq.${enc(k)}`, { method: 'DELETE' });
      toast('Gemt');
    } catch (err) { console.error(err); toast('Gemt på denne enhed. Databasen mangler tabellen «tilpasning».'); }
  }
  async function hent() {
    try {
      const rader = await api('tilpasning?select=*');
      data = {};
      for (const r of rader) data[r.noegle] = Object.fromEntries(Object.entries({ t: r.tekst, s: r.stoerrelse && Number(r.stoerrelse), f: r.farve, b: r.baggrund, x: r.skjult, p: r.pos && String(r.pos).split(',').map(Number) }).filter(([, v]) => v));
      server = true; lager.gem('tilpas', data); anvend();
    } catch (err) { /* tabellen findes ikke endnu: brug det, der er gemt på enheden */ }
  }
  function saet(v) {
    til = !!v; if (til) { aktiv = true; lager.gem('tilpasAktiv', true); toast('Tryk for at ændre. Hold og træk for at flytte.'); } lager.gem('tilpasTil', til); anvend();
    const c = document.getElementById('tilpastil'); if (c) c.checked = til;
  }
  function aabn(el) {
    const k = el.dataset.org, o = data[k] || {}, felt = el.matches('.knap, .fane');
    let st = o.s || 1, f = o.f || '', b = o.b || '', x = !!o.x;
    const sw = (liste, v, nøgle) => `<div class="farver"><button type="button" class="sw${v ? '' : ' valgt'}" data-${nøgle}="" aria-label="Standard">∅</button>${liste.map(c => `<button type="button" class="sw${c === v ? ' valgt' : ''}" data-${nøgle}="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div>`;
    const d = ark(`<h2>Ret tekst</h2>
      <label for="tp-tekst">Tekst</label>
      <input type="text" id="tp-tekst" value="${esc(o.t || k)}" maxlength="200" autocomplete="off">
      <label>Størrelse</label>
      <div class="rakke venstre">${STR.map(([v, n]) => `<button class="chip${v === st ? ' valgt' : ''}" type="button" data-st="${v}">${n}</button>`).join('')}</div>
      <label>Tekstfarve</label>${sw(TEKSTFARVER, f, 'f')}
      ${felt ? `<label>Feltets farve</label>${sw(FELTFARVER, b, 'b')}` : ''}
      <p class="lille">Ændringen gælder alle steder, hvor «${esc(k)}» står. Du flytter feltet ved at holde fingeren på det og trække.</p>
      <div class="rakke"><button class="knap fare" type="button" data-tp="skjul">${x ? 'Vis igen' : 'Skjul her'}</button><button class="knap" type="button" data-tp="nulstil">Nulstil</button><button class="knap primaer" type="button" data-tp="gem">Gem</button></div>`);
    d.addEventListener('click', e => {
      const s = e.target.closest('[data-st]'), a = e.target.closest('[data-tp]'), c = e.target.closest('.sw');
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
        if (f) ny.f = f;
        if (b) ny.b = b;
        if (o.p) ny.p = o.p;
      }
      lukArk(); gem(k, ny);
    });
    setTimeout(() => $('#tp-tekst', d).select(), 50);
  }
  function aabnKort(el) {
    const k = el.dataset.flyt;
    const d = ark(`<h2>Flyt felt</h2><p class="lille">Hold fingeren på feltet, og træk det. Det falder på et gitter.</p>
      <div class="rakke"><button class="knap" type="button" data-tp="nulstil">Nulstil plads</button><button class="knap primaer" type="button" data-tp="luk">Luk</button></div>`);
    d.addEventListener('click', e => {
      if (e.target.closest('.ark-bag')) return lukArk();
      const a = e.target.closest('[data-tp]'); if (!a) return;
      lukArk(); if (a.dataset.tp === 'nulstil') { const { p, ...rest } = data[k] || {}; gem(k, rest); }
    });
  }
  // Træk: hold fingeren stille et øjeblik, så løfter feltet sig, og det følger fingeren og falder på gitteret
  let drag = null, sidstTrukket = 0;
  const gitter = () => { let g = document.getElementById('gitter'); if (!g) { g = document.createElement('div'); g.id = 'gitter'; document.body.append(g); } return g; };
  function startTraek(d) {
    d.laast = true; const r = d.el.getBoundingClientRect();
    d.nx = r.left - d.p0[0]; d.ny = r.top - d.p0[1]; // feltets plads uden forskydning
    d.stat = getComputedStyle(d.el).position === 'static'; if (d.stat) d.el.style.position = 'relative';
    d.el.classList.add('traekker'); gitter().style.backgroundPosition = `${-scrollX}px ${-scrollY}px`;
    if (navigator.vibrate) navigator.vibrate(12);
  }
  function flyt(d, e) {
    const snap = (v, rul) => Math.round((v + rul) / G) * G - rul;
    const dx = snap(d.nx + d.p0[0] + e.clientX - d.x0, scrollX) - d.nx, dy = snap(d.ny + d.p0[1] + e.clientY - d.y0, scrollY) - d.ny;
    d.p = [Math.round(dx * 100) / 100, Math.round(dy * 100) / 100]; d.el.style.translate = `${dx}px ${dy}px`;
  }
  function slutTraek() {
    const d = drag; drag = null; if (!d) return; clearTimeout(d.t);
    if (!d.laast) return;
    sidstTrukket = Date.now(); d.el.classList.remove('traekker'); if (d.stat) d.el.style.position = '';
    const g = document.getElementById('gitter'); if (g) g.remove();
    const k = d.el.dataset.flyt, { p, ...rest } = data[k] || {};
    if (d.p && (d.p[0] || d.p[1])) rest.p = d.p;
    gem(k, rest);
  }
  document.addEventListener('pointerdown', e => {
    if (!til || !aktiv || e.button > 0) return;
    const el = e.target.closest('[data-flyt]'); if (!el || el.closest('#ark')) return;
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
    data = {}; lager.gem('tilpas', data); anvend();
    try { await api('tilpasning?noegle=not.is.null', { method: 'DELETE' }); } catch (err) { console.error(err); }
  } };
})();
