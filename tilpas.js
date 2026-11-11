// Tilpas tekster: når det er slået til, kan man trykke på en knap eller overskrift og ændre teksten og skriftstørrelsen.
// Ændringen gælder alle steder, hvor den samme tekst står. Den gemmes i Supabase (tabellen «tilpasning») og dermed på alle enheder.
// Mangler tabellen, gemmes den kun på denne enhed.
const Tilpas = (() => {
  const VALG = '.knap, .tilbage, .fane, .logo, main h1, main h2, main p.lille, main p.tomt, main small';
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
      b.addEventListener('click', () => { aktiv = !aktiv; lager.gem('tilpasAktiv', aktiv); if (aktiv) toast('Tryk på en tekst for at ændre den.'); anvend(); });
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
        try { await api('tilpasning?on_conflict=noegle', { method: 'POST', flet: true, body: { ...rad, skjult: !!ny.x } }); }
        catch (e) { // kolonnen «skjult» mangler måske endnu
          await api('tilpasning?on_conflict=noegle', { method: 'POST', flet: true, body: rad });
          if (ny.x) toast('Skjult på denne enhed. Databasen mangler kolonnen «skjult».');
        }
      } else await api(`tilpasning?noegle=eq.${enc(k)}`, { method: 'DELETE' });
      toast('Gemt');
    } catch (err) { console.error(err); toast('Gemt på denne enhed. Databasen mangler tabellen «tilpasning».'); }
  }
  async function hent() {
    try {
      const rader = await api('tilpasning?select=*');
      data = {};
      for (const r of rader) data[r.noegle] = Object.fromEntries(Object.entries({ t: r.tekst, s: r.stoerrelse && Number(r.stoerrelse), f: r.farve, b: r.baggrund, x: r.skjult }).filter(([, v]) => v));
      server = true; lager.gem('tilpas', data); anvend();
    } catch (err) { /* tabellen findes ikke endnu: brug det, der er gemt på enheden */ }
  }
  function saet(v) {
    til = !!v; if (til) { aktiv = true; lager.gem('tilpasAktiv', true); toast('Tryk på en tekst for at ændre den.'); } lager.gem('tilpasTil', til); anvend();
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
      <p class="lille">Ændringen gælder alle steder, hvor «${esc(k)}» står.</p>
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
      }
      lukArk(); gem(k, ny);
    });
    setTimeout(() => $('#tp-tekst', d).select(), 50);
  }
  // I tilpas-tilstand åbner et tryk på en tekst i stedet for at gøre det, knappen plejer
  document.addEventListener('click', e => {
    if (!til || !aktiv) return;
    const el = e.target.closest('[data-org]');
    if (!el) return;
    e.preventDefault(); e.stopPropagation(); aabn(el);
  }, true);
  const igen = () => { cancelAnimationFrame(timer); timer = requestAnimationFrame(anvend); };
  new MutationObserver(igen).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => { anvend(); hent(); });
  return { saet, til: () => til, async nulstil() {
    data = {}; lager.gem('tilpas', data); anvend();
    try { await api('tilpasning?noegle=not.is.null', { method: 'DELETE' }); } catch (err) { console.error(err); }
  } };
})();
