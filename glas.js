// Glas: frost, sløring og glastone for alle glasflader (GlassControls og GlassTint fra designsystemet, opdatering 5).
// Gemmes kun på denne enhed (lager «glas»). Standardværdierne giver det glas, appen havde før: intet sættes, før man ændrer noget.
// Glasset står i style.css (--glas, --glasfilter) og læser --glas-k (dækning), --glas-s (sløring) og --glas-rgb (tone).
const Glas = (() => {
  const C = (v, a, b) => Math.max(a, Math.min(b, v));
  const STD = { frost: 0.44, sloer: 2.5, styrke: 0, mode: 'farve', nx: 0.31, ny: 0.66, lys: 100 };
  // Kogebogens standardfarver (designsystemets palet). Det er værdier til hjulet, ikke farver i komponenterne.
  const FARVER = [['Turkisblå', 74, 159, 181], ['Marineblå', 34, 56, 107], ['Isblå', 112, 186, 218], ['Salatgrøn', 102, 196, 128], ['Græsgrøn', 22, 163, 74], ['Smørgul', 245, 196, 56],
    ['Orange', 234, 88, 12], ['Koral', 245, 146, 136], ['Pink', 236, 72, 153], ['Rød', 220, 38, 38], ['Cremehvid', 250, 245, 234]];
  const lagret = () => { const s = lager.hent('glas', {}); return { ...STD, ...(s && typeof s === 'object' ? s : {}) }; };
  let S = lagret();

  const hsl = (h, s, l) => {
    h = ((h % 360) + 360) % 360; s = C(s, 0, 100) / 100; l = C(l, 0, 100) / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
  };
  const hex = c => '#' + [c.r, c.g, c.b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  // Hjulets punkt til en farve (colorFromWheel i designsystemets contrast.ts)
  function farve(s) {
    const d = Math.min(1, Math.hypot(s.nx, s.ny)), grad = Math.atan2(s.ny, s.nx) * 180 / Math.PI + 90, ls = C(s.lys / 100, 0.15, 1);
    if (s.mode === 'hvid') {
      const w = C(s.nx, -1, 1);
      return { r: Math.round((w < 0 ? 255 : 255 - w * 36) * ls), g: Math.round((248 - Math.abs(w) * 8) * ls), b: Math.round((w > 0 ? 255 : 255 + w * 54) * ls) };
    }
    return hsl(grad, Math.round(d * 94), Math.round((96 - d * 44) * ls));
  }
  // En farve tilbage til hjulet (wheelPosFromRgb)
  function plads(c) {
    const r = c.r / 255, g = c.g / 255, b = c.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (d < 0.04) return { nx: 0, ny: 0, lys: C(Math.round(l * 100), 20, 100), mode: 'hvid' };
    const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    const h = 60 * (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4);
    const dist = C(s * 100 / 94, 0.08, 0.9), a = (h - 90) * Math.PI / 180;
    return { nx: +(dist * Math.cos(a)).toFixed(3), ny: +(dist * Math.sin(a)).toFixed(3), lys: C(Math.round(l / Math.max(0.25, (96 - dist * 44) / 100) * 100), 20, 100), mode: 'farve' };
  }
  const bland = (c, t, bag) => ({ r: Math.round(c.r * t + bag.r * (1 - t)), g: Math.round(c.g * t + bag.g * (1 - t)), b: Math.round(c.b * t + bag.b * (1 - t)) });
  const HVID = { r: 255, g: 255, b: 255 };
  const tone = s => bland(farve(s), s.styrke / 100, HVID);
  const k = s => (0.14 + s.frost * 0.56) / (0.14 + STD.frost * 0.56); // dækningen i forhold til standard

  function anvend() {
    const r = document.documentElement.style, set = (n, v, std) => v === std ? r.removeProperty(n) : r.setProperty(n, v);
    set('--glas-k', k(S).toFixed(3), k(STD).toFixed(3));
    set('--glas-s', (S.sloer / STD.sloer).toFixed(3), '1.000');
    const t = tone(S); set('--glas-rgb', `${t.r}, ${t.g}, ${t.b}`, '255, 255, 255');
  }

  // Kontrast: blæk på glasset over papiret (glassets tætteste sted). Afrundet nedad, så 4,499 ikke består.
  const rgbAf = v => { v = v.trim(); if (v[0] === '#') { const n = v.length === 4 ? v.slice(1).split('').map(x => x + x).join('') : v.slice(1); return { r: parseInt(n.slice(0, 2), 16), g: parseInt(n.slice(2, 4), 16), b: parseInt(n.slice(4, 6), 16) }; }
    const m = v.match(/\d+(\.\d+)?/g) || [0, 0, 0]; return { r: +m[0], g: +m[1], b: +m[2] }; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const forhold = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  function kontrast() {
    const cs = getComputedStyle(document.documentElement), moerk = document.documentElement.dataset.tema === 'moerk';
    const a = Math.min(1, (moerk ? 0.18 : 0.42) * k(S)), flade = bland(tone(S), a, rgbAf(cs.getPropertyValue('--papir')));
    return Math.floor(forhold(rgbAf(cs.getPropertyValue('--blaek')), flade) * 100) / 100;
  }
  const tal = (v, d = 2) => v.toFixed(d).replace('.', ',');

  // Indstillinger: to skydere og farvehjulet. Alt står på notesbogens net (rækker à 32 px).
  const html = () => `<h2>Glas</h2>
    <p class="lille">Gælder kun denne enhed. Standard er det glas, appen altid har haft.</p>
    <div class="glas-panel" data-tpid="glas">
      <div class="glas-rk"><label for="glas-frost">Frost og gennemsigtighed <small>(dækning for læsbarhed)</small></label><output id="glas-frost-v" for="glas-frost"></output></div>
      <input type="range" id="glas-frost" min="0" max="1" step="0.02">
      <div class="glas-rk"><label for="glas-sloer">Sløring</label><output id="glas-sloer-v" for="glas-sloer"></output></div>
      <input type="range" id="glas-sloer" min="0" max="12" step="0.5">
      <p class="glas-status" id="glas-status" role="status"></p>
      <h3 class="tekst-l">Glastone</h3>
      <div class="glas-tone">
        <div class="glas-hjul" id="glas-hjul" role="application" tabindex="0" aria-label="Farvehjul til glastone. Brug piletasterne." aria-describedby="glas-hex"><span class="glas-draabe"></span></div>
        <div class="glas-side">
          <div class="filter glas-mode" role="group" aria-label="Hjulets tilstand"><button type="button" class="chip" data-gm="farve" aria-pressed="false">Farve</button><button type="button" class="chip" data-gm="hvid" aria-pressed="false">Hvid</button></div>
          <p class="glas-hex"><i id="glas-prik"></i><span id="glas-hex"></span></p>
          <button type="button" class="knap mini" id="glas-nul">${ik('genindlaes')} Nulstil glas</button>
        </div>
      </div>
      <div class="glas-rk"><label for="glas-lys">Lysstyrke</label><output id="glas-lys-v" for="glas-lys"></output></div>
      <input type="range" id="glas-lys" min="15" max="100" step="1">
      <div class="glas-rk"><label for="glas-styrke">Farvestyrke i glasset</label><output id="glas-styrke-v" for="glas-styrke"></output></div>
      <input type="range" id="glas-styrke" min="0" max="100" step="1">
      <p class="lille">Standardfarver</p>
      <div class="glas-farver" role="group" aria-label="Standardfarver">${FARVER.map(([n, r, g, b], i) => `<button type="button" class="glas-farve" data-gf="${i}" style="--gf: ${r}, ${g}, ${b}" aria-label="Vælg ${n} (${hex({ r, g, b })})" title="${n}"></button>`).join('')}</div>
    </div>`;

  function start(rod) {
    const $g = s => rod.querySelector(s), hjul = $g('#glas-hjul'), draabe = $g('.glas-draabe');
    const R = { frost: $g('#glas-frost'), sloer: $g('#glas-sloer'), lys: $g('#glas-lys'), styrke: $g('#glas-styrke') };
    const gem = () => { lager.gem('glas', S); anvend(); vis(); };
    function vis() {
      R.frost.value = S.frost; R.sloer.value = S.sloer; R.lys.value = S.lys; R.styrke.value = S.styrke;
      $g('#glas-frost-v').textContent = tal(S.frost);
      $g('#glas-sloer-v').textContent = tal(S.sloer, 1) + ' (' + Math.round(18 * S.sloer / STD.sloer) + ' px)';
      $g('#glas-lys-v').textContent = S.lys + ' %'; $g('#glas-styrke-v').textContent = S.styrke + ' %';
      const f = farve(S);
      hjul.dataset.mode = S.mode; hjul.style.setProperty('--lys', S.lys / 100);
      draabe.style.left = (S.nx * 50 + 50) + '%'; draabe.style.top = (S.ny * 50 + 50) + '%'; draabe.style.setProperty('--gf', `${f.r}, ${f.g}, ${f.b}`);
      $g('#glas-prik').style.setProperty('--gf', `${f.r}, ${f.g}, ${f.b}`);
      $g('#glas-hex').textContent = S.styrke ? `${hex(f)} · ${S.styrke} %` : 'Ingen tone';
      rod.querySelectorAll('[data-gm]').forEach(b => { const on = b.dataset.gm === S.mode; b.classList.toggle('valgt', on); b.setAttribute('aria-pressed', on); });
      const kr = kontrast(), ok = kr >= 4.5;
      $g('#glas-status').textContent = `Kontrast ${tal(kr)}:1 · ${ok ? 'Består AA (normal tekst ≥ 4,5:1)' : kr >= 3 ? 'Kun stor tekst (≥ 3:1)' : 'Under AA. Øg frost eller sænk farvestyrken.'}`;
      $g('#glas-status').classList.toggle('lav', !ok);
    }
    Object.entries(R).forEach(([n, el]) => el.addEventListener('input', () => { S[n] = Number(el.value); gem(); }));
    // Hjulet: træk dråben, eller brug piletasterne. Punktet holdes inden for 0,9 af radius.
    const saetPunkt = (x, y) => { const d = Math.hypot(x, y); if (d > 0.9) { x = x / d * 0.9; y = y / d * 0.9; } S.nx = +x.toFixed(3); S.ny = +y.toFixed(3); if (!S.styrke) S.styrke = STD_STYRKE; gem(); };
    const fra = e => { const r = hjul.getBoundingClientRect(); saetPunkt((e.clientX - r.left - r.width / 2) / (r.width / 2), (e.clientY - r.top - r.height / 2) / (r.height / 2)); };
    hjul.addEventListener('pointerdown', e => { hjul.setPointerCapture(e.pointerId); hjul.classList.add('traek'); fra(e); });
    hjul.addEventListener('pointermove', e => { if (hjul.hasPointerCapture(e.pointerId)) fra(e); });
    const slip = e => { if (hjul.hasPointerCapture(e.pointerId)) hjul.releasePointerCapture(e.pointerId); hjul.classList.remove('traek'); };
    hjul.addEventListener('pointerup', slip); hjul.addEventListener('pointercancel', slip);
    hjul.addEventListener('keydown', e => {
      const t = { ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] }[e.key];
      if (!t) return; e.preventDefault(); saetPunkt(S.nx + t[0], S.ny + t[1]);
    });
    rod.querySelectorAll('[data-gm]').forEach(b => b.addEventListener('click', () => { S.mode = b.dataset.gm; gem(); }));
    rod.querySelectorAll('[data-gf]').forEach(b => b.addEventListener('click', () => {
      const [, r, g, bl] = FARVER[Number(b.dataset.gf)]; Object.assign(S, plads({ r, g, b: bl })); if (!S.styrke) S.styrke = STD_STYRKE; gem();
    }));
    $g('#glas-nul').addEventListener('click', () => { S = { ...STD }; gem(); toast('Glasset er sat tilbage'); });
    vis();
  }
  const STD_STYRKE = 62; // farvestyrke, når man vælger en tone første gang (designsystemets standard for delelementer)

  anvend();
  return { anvend, html, start, kontrast };
})();
