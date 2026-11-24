// Standardfarver (opdatering 6): Designer justerer appens faste farver med farvehjulet (GlassTint fra designsystemet).
// Farverne er rollerne i style.css (--gem, --slet, --kat-… osv.). Kun fladen vælges; tekst (--paa-…) og kant (…-kant) regnes ud,
// så teksten har mindst 4,5:1 og kanten mindst 3:1 mod papiret (CLAUDE.md). Hvert tema har sine egne værdier.
// Gemmes i Supabase (tabellen madplan, rækken «standardfarver») og gælder alle, der bruger kogebogen. En kopi ligger på enheden.
const Farver = (() => {
  const C = (v, a, b) => Math.max(a, Math.min(b, v));
  const RAEKKE_ID = 'standardfarver';
  // [nøgle, farve, rolle]. Handlinger har egen tekst og kant; kategorierne deler teksten --paa-kat.
  const ROLLER = [['gem', 'Grøn', 'Gem'], ['tilpas', 'Gul', 'Tilpas'], ['slet', 'Rød', 'Slet'], ['annuller', 'Grå', 'Annuller'], ['hjaelp', 'Blå', 'Hjælp'], ['hovedhandling', 'Orange', 'Hovedhandling']];
  const KAT = [['kat-hovedret', 'Brun', 'Hovedret'], ['kat-forret', 'Lys orange', 'Forret'], ['kat-salat', 'Lysegrøn', 'Salat'], ['kat-dessert', 'Lyserød', 'Dessert'], ['kat-tilbehoer', 'Gylden', 'Tilbehør'], ['kat-drikke', 'Lyseblå', 'Drikke'], ['kat-andet', 'Lilla', 'Andre kategorier']];
  const erKat = n => n.startsWith('kat-');
  // Designsystemets 11 standardfarver: genveje på hjulet
  const PALET = [['Turkisblå', 74, 159, 181], ['Marineblå', 34, 56, 107], ['Isblå', 112, 186, 218], ['Salatgrøn', 102, 196, 128], ['Græsgrøn', 22, 163, 74], ['Smørgul', 245, 196, 56],
    ['Orange', 234, 88, 12], ['Koral', 245, 146, 136], ['Pink', 236, 72, 153], ['Rød', 220, 38, 38], ['Cremehvid', 250, 245, 234]];
  const HVID = { r: 255, g: 255, b: 255 };

  // ---------- Farveregning ----------
  const rgb = v => { v = String(v).trim(); if (v[0] === '#') { const n = v.length === 4 ? v.slice(1).split('').map(x => x + x).join('') : v.slice(1, 7); return { r: parseInt(n.slice(0, 2), 16), g: parseInt(n.slice(2, 4), 16), b: parseInt(n.slice(4, 6), 16) }; }
    const m = v.match(/\d+(\.\d+)?/g) || [0, 0, 0]; return { r: +m[0], g: +m[1], b: +m[2] }; };
  const hex = c => '#' + [c.r, c.g, c.b].map(v => C(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  const bland = (c, t, bag) => ({ r: Math.round(c.r * t + bag.r * (1 - t)), g: Math.round(c.g * t + bag.g * (1 - t)), b: Math.round(c.b * t + bag.b * (1 - t)) });
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const forhold = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hsl = (h, s, l) => {
    h = ((h % 360) + 360) % 360; s = C(s, 0, 100) / 100; l = C(l, 0, 100) / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
  };
  // Hjulets punkt til en farve (colorFromWheel i designsystemets contrast.ts). nx, ny: -1..1, lys: 15-100 %.
  function hjulFarve(s) {
    const d = Math.min(1, Math.hypot(s.nx, s.ny)), grad = Math.atan2(s.ny, s.nx) * 180 / Math.PI + 90, ls = C(s.lys / 100, 0.15, 1);
    if (s.mode === 'hvid') { const w = C(s.nx, -1, 1); return { r: Math.round((w < 0 ? 255 : 255 - w * 36) * ls), g: Math.round((248 - Math.abs(w) * 8) * ls), b: Math.round((w > 0 ? 255 : 255 + w * 54) * ls) }; }
    return hsl(grad, Math.round(d * 94), Math.round((96 - d * 44) * ls));
  }
  // En farve tilbage til hjulet (wheelPosFromRgb)
  function hjulPlads(c) {
    const r = c.r / 255, g = c.g / 255, b = c.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (d < 0.04) return { nx: 0, ny: 0, lys: C(Math.round(l * 100), 15, 100), mode: 'hvid' };
    const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn), h = 60 * (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4);
    const dist = C(s * 100 / 94, 0.08, 0.9), a = (h - 90) * Math.PI / 180;
    return { nx: +(dist * Math.cos(a)).toFixed(3), ny: +(dist * Math.sin(a)).toFixed(3), lys: C(Math.round(l / Math.max(0.25, (96 - dist * 44) / 100) * 100), 15, 100), mode: 'farve' };
  }

  // ---------- Tekst og kant til en ny flade ----------
  const tema = () => document.documentElement.dataset.tema === 'moerk' ? 'moerk' : 'lys';
  const PAPIR = { lys: '#fffdf5', moerk: '#1a1f2e' }, MOERK_TEKST = { lys: '#22386b', moerk: '#1a1f2e' }, PAA_KAT = { lys: '#22386b', moerk: '#e9edf9' }; // = --papir, --raa-blaek/--raa-nat og --paa-kat i style.css
  function afledt(navn, flade, t) {
    const f = rgb(flade), papir = rgb(PAPIR[t]);
    const tekst = erKat(navn) ? PAA_KAT[t] : [MOERK_TEKST[t], '#ffffff'].sort((a, b) => forhold(rgb(b), f) - forhold(rgb(a), f))[0];
    let kant = f; const mod = rgb(t === 'moerk' ? '#e9edf9' : '#22386b'); // kanten gøres mørkere (lyst) eller lysere (mørkt), til den står 3:1 mod papiret
    for (let i = 1; i <= 10 && forhold(kant, papir) < 3; i++) kant = bland(mod, i / 10, f);
    return { tekst, kant: hex(kant), kTekst: forhold(rgb(tekst), f), kKant: forhold(kant, papir) };
  }

  // ---------- Gem og anvend ----------
  let D = lager.hent('standardfarver', { lys: {}, moerk: {} });
  if (!D || typeof D !== 'object') D = { lys: {}, moerk: {} };
  function anvend() {
    let el = document.getElementById('standardfarver');
    if (!el) { el = document.createElement('style'); el.id = 'standardfarver'; document.head.append(el); }
    el.textContent = ['lys', 'moerk'].map(t => {
      const linjer = Object.entries(D[t] || {}).filter(([n, v]) => /^#[0-9a-f]{6}$/i.test(v) && [...ROLLER, ...KAT].some(([k]) => k === n)).map(([n, v]) => {
        const a = afledt(n, v, t);
        return erKat(n) ? `--${n}: ${v}; --${n}-kant: ${a.kant};` : `--${n}: ${v}; --paa-${n}: ${a.tekst}; --${n}-kant: ${a.kant};`;
      });
      return linjer.length ? `:root[data-tema=${t}] { ${linjer.join(' ')} }` : '';
    }).join('\n'); // :root[data-tema=…] vinder over style.css (højere specificitet), så rækkefølgen er ligegyldig
  }
  async function hent() {
    try {
      const r = await api(`madplan?id=eq.${RAEKKE_ID}&select=data`), d = r[0] && r[0].data;
      D = { lys: { ...(d && d.lys) }, moerk: { ...(d && d.moerk) } }; lager.gem('standardfarver', D); anvend();
    } catch (e) { console.warn('Standardfarver:', e.message); } // uden net: kopien på enheden
  }
  const gem = () => { lager.gem('standardfarver', D); anvend(); return api('madplan?on_conflict=id', { method: 'POST', flet: true, body: { id: RAEKKE_ID, data: D, opdateret: new Date().toISOString() } }); };

  // ---------- Designer: farvehjulet ----------
  const tal = (v, d = 2) => (Math.floor(v * 100) / 100).toFixed(d).replace('.', ','); // nedad, så 4,499 ikke består
  const navnAf = n => { const x = [...ROLLER, ...KAT].find(([k]) => k === n); return `${x[1]} = ${x[2]}`; };
  const knapper = (liste, g) => `<p class="lille tp-farvegruppe">${g}</p><div class="farver" role="group" aria-label="${g}">${liste.map(([k, f, r]) => `<button type="button" class="sw navn" data-sf="${k}" aria-pressed="false"><i style="background: var(--${k})"></i><span>${f} = ${r}</span></button>`).join('')}</div>`;
  const html = () => `<h3 class="tekst-l">Standardfarver</h3>
    <p class="lille">Justér appens faste farver med farvehjulet. Det gælder alle, der bruger kogebogen, men kun i <span id="sf-tema"></span> tema. Skift tema under Indstillinger for at justere det andet.</p>
    <div class="sf" data-tpid="standardfarver">
      ${knapper(ROLLER, 'Handlinger')}${knapper(KAT, 'Kategorier')}
      <div class="glas-tone">
        <div class="glas-hjul" id="sf-hjul" role="application" tabindex="0" aria-label="Farvehjul. Brug piletasterne." aria-describedby="sf-hex"><span class="glas-draabe"></span></div>
        <div class="glas-side">
          <div class="filter glas-mode" role="group" aria-label="Hjulets tilstand"><button type="button" class="chip" data-sm="farve" aria-pressed="false">Farve</button><button type="button" class="chip" data-sm="hvid" aria-pressed="false">Hvid</button></div>
          <p class="sf-valgt"><span class="sf-proeve" id="sf-proeve"></span><span id="sf-hex"></span></p>
          <p class="glas-status" id="sf-status" role="status"></p>
        </div>
      </div>
      <div class="glas-rk"><label for="sf-lys">Lysstyrke</label><output id="sf-lys-v" for="sf-lys"></output></div>
      <input type="range" id="sf-lys" min="15" max="100" step="1">
      <div class="glas-rk"><label for="sf-styrke">Farvestyrke</label><output id="sf-styrke-v" for="sf-styrke"></output></div>
      <input type="range" id="sf-styrke" min="0" max="100" step="1">
      <p class="lille">Designsystemets farver</p>
      <div class="glas-farver" role="group" aria-label="Designsystemets farver">${PALET.map(([n, r, g, b], i) => `<button type="button" class="glas-farve" data-pf="${i}" style="--gf: ${r}, ${g}, ${b}" aria-label="Brug ${n} (${hex({ r, g, b }).toUpperCase()})" title="${n}"></button>`).join('')}</div>
      <div class="rakke venstre">
        <button type="button" class="knap gem" id="sf-gem">${ik('tjek')} Gem farven</button>
        <button type="button" class="knap annuller" id="sf-nul">Nulstil farven</button>
        <button type="button" class="knap annuller" id="sf-alle">Nulstil alle farver</button>
      </div>
    </div>`;

  function start(rod) {
    const $f = s => rod.querySelector(s), hjul = $f('#sf-hjul'), draabe = hjul.querySelector('.glas-draabe');
    let valgt = 'gem', S;
    const nu = n => getComputedStyle(document.documentElement).getPropertyValue('--' + n).trim();
    const farve = () => bland(hjulFarve(S), S.styrke / 100, HVID);
    function vaelg(n) {
      valgt = n; S = { ...hjulPlads(rgb(nu(n))), styrke: 100 };
      rod.querySelectorAll('[data-sf]').forEach(b => { const on = b.dataset.sf === n; b.classList.toggle('valgt', on); b.setAttribute('aria-pressed', on); });
      vis();
    }
    function vis() {
      const t = tema(), f = farve(), h = hex(f), a = afledt(valgt, h, t), ok = a.kTekst >= 4.5 && a.kKant >= 3;
      $f('#sf-tema').textContent = t === 'moerk' ? 'mørkt' : 'lyst';
      $f('#sf-lys').value = S.lys; $f('#sf-styrke').value = S.styrke; skyderSynk(rod);
      $f('#sf-lys-v').textContent = S.lys + ' %'; $f('#sf-styrke-v').textContent = S.styrke + ' %';
      hjul.dataset.mode = S.mode; hjul.style.setProperty('--lys', S.lys / 100);
      draabe.style.left = (S.nx * 50 + 50) + '%'; draabe.style.top = (S.ny * 50 + 50) + '%'; draabe.style.setProperty('--gf', `${f.r}, ${f.g}, ${f.b}`);
      const p = $f('#sf-proeve'); p.style.background = h; p.style.color = a.tekst; p.style.borderColor = a.kant; p.textContent = navnAf(valgt).split(' = ')[1];
      $f('#sf-hex').textContent = `${navnAf(valgt)} · ${h.toUpperCase()}`;
      $f('#sf-status').textContent = `Tekst ${tal(a.kTekst)}:1 · kant ${tal(a.kKant)}:1 · ${ok ? 'Består' : a.kTekst < 4.5 ? 'Teksten er for svær at læse. Vælg en lysere eller mørkere farve.' : 'Kanten ses for dårligt.'}`;
      $f('#sf-status').classList.toggle('lav', !ok); $f('#sf-gem').disabled = !ok;
      rod.querySelectorAll('[data-sm]').forEach(b => { const on = b.dataset.sm === S.mode; b.classList.toggle('valgt', on); b.setAttribute('aria-pressed', on); });
    }
    const saetPunkt = (x, y) => { const d = Math.hypot(x, y); if (d > 0.9) { x = x / d * 0.9; y = y / d * 0.9; } S.nx = +x.toFixed(3); S.ny = +y.toFixed(3); vis(); };
    const fra = e => { const r = hjul.getBoundingClientRect(); saetPunkt((e.clientX - r.left - r.width / 2) / (r.width / 2), (e.clientY - r.top - r.height / 2) / (r.height / 2)); };
    hjul.addEventListener('pointerdown', e => { hjul.setPointerCapture(e.pointerId); hjul.classList.add('traek'); fra(e); });
    hjul.addEventListener('pointermove', e => { if (hjul.hasPointerCapture(e.pointerId)) fra(e); });
    const slip = e => { if (hjul.hasPointerCapture(e.pointerId)) hjul.releasePointerCapture(e.pointerId); hjul.classList.remove('traek'); };
    hjul.addEventListener('pointerup', slip); hjul.addEventListener('pointercancel', slip);
    hjul.addEventListener('keydown', e => { const t = { ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] }[e.key]; if (!t) return; e.preventDefault(); saetPunkt(S.nx + t[0], S.ny + t[1]); });
    $f('#sf-lys').addEventListener('input', e => { S.lys = Number(e.target.value); vis(); });
    $f('#sf-styrke').addEventListener('input', e => { S.styrke = Number(e.target.value); vis(); });
    rod.querySelectorAll('[data-sm]').forEach(b => b.addEventListener('click', () => { S.mode = b.dataset.sm; vis(); }));
    rod.querySelectorAll('[data-sf]').forEach(b => b.addEventListener('click', () => vaelg(b.dataset.sf)));
    rod.querySelectorAll('[data-pf]').forEach(b => b.addEventListener('click', () => { const [, r, g, bl] = PALET[Number(b.dataset.pf)]; S = { ...hjulPlads({ r, g, b: bl }), styrke: 100 }; vis(); }));
    const send = async (tekst) => { try { await gem(); toast(tekst); } catch (e) { console.error(e); fejlbesked('Farven er kun gemt på denne enhed. Tjek internettet, og gem igen.'); } vaelg(valgt); };
    $f('#sf-gem').addEventListener('click', () => { const t = tema(); D[t] = { ...D[t], [valgt]: hex(farve()) }; send(`«${navnAf(valgt)}» er gemt`); });
    $f('#sf-nul').addEventListener('click', () => { const t = tema(); if (!D[t] || !D[t][valgt]) return toast('Farven er allerede standard'); D[t] = { ...D[t] }; delete D[t][valgt]; send('Farven er sat tilbage'); });
    $f('#sf-alle').addEventListener('click', async () => { if (!await bekraeft('Vil du sætte alle standardfarver tilbage i begge temaer?', 'Nulstil')) return; D = { lys: {}, moerk: {} }; send('Alle farver er sat tilbage'); });
    vaelg(valgt);
  }

  anvend(); hent();
  return { anvend, hent, html, start, rgb, bland, forhold };
})();
