// Glas: frost og sløring for alle glasflader (GlassControls fra designsystemet, opdatering 5).
// Gemmes kun på denne enhed (lager «glas»). Standardværdierne giver det glas, appen havde før: intet sættes, før man ændrer noget.
// Glasset står i style.css (--glas, --glasfilter) og læser --glas-k (dækning) og --glas-s (sløring).
// Farvehjulet hører til Designer og justerer standardfarverne (farver.js).
const Glas = (() => {
  const STD = { frost: 0.44, sloer: 2.5 };
  const lagret = () => { const s = lager.hent('glas', {}); return { frost: Number(s && s.frost) >= 0 ? Number(s.frost) : STD.frost, sloer: Number(s && s.sloer) >= 0 ? Number(s.sloer) : STD.sloer }; };
  let S = lagret();
  const k = s => (0.14 + s.frost * 0.56) / (0.14 + STD.frost * 0.56); // dækningen i forhold til standard

  function anvend() {
    const r = document.documentElement.style, set = (n, v, std) => v === std ? r.removeProperty(n) : r.setProperty(n, v);
    set('--glas-k', k(S).toFixed(3), k(STD).toFixed(3));
    set('--glas-s', (S.sloer / STD.sloer).toFixed(3), '1.000');
  }
  // Kontrast: blæk på glasset over papiret (glassets tætteste sted). Afrundet nedad, så 4,499 ikke består.
  function kontrast() {
    const cs = getComputedStyle(document.documentElement), moerk = document.documentElement.dataset.tema === 'moerk';
    const a = Math.min(1, (moerk ? 0.18 : 0.42) * k(S)), flade = Farver.bland({ r: 255, g: 255, b: 255 }, a, Farver.rgb(cs.getPropertyValue('--papir')));
    return Math.floor(Farver.forhold(Farver.rgb(cs.getPropertyValue('--blaek')), flade) * 100) / 100;
  }
  const tal = (v, d = 2) => v.toFixed(d).replace('.', ',');

  // Indstillinger: to skydere i hele rækker (etiket 32 px, skyder 32 px)
  const html = () => `<h2>Glas</h2>
    <p class="lille">Gælder kun denne enhed. Standard er det glas, appen altid har haft.</p>
    <div class="glas-panel" data-tpid="glas">
      <div class="glas-rk"><label for="glas-frost">Frost og gennemsigtighed <small>(dækning for læsbarhed)</small></label><output id="glas-frost-v" for="glas-frost"></output></div>
      <input type="range" id="glas-frost" min="0" max="1" step="0.02">
      <div class="glas-rk"><label for="glas-sloer">Sløring</label><output id="glas-sloer-v" for="glas-sloer"></output></div>
      <input type="range" id="glas-sloer" min="0" max="12" step="0.5">
      <p class="glas-status" id="glas-status" role="status"></p>
      <div class="rakke"><button type="button" class="knap mini" id="glas-nul">${ik('genindlaes')} Nulstil glas</button></div>
    </div>`;

  function start(rod) {
    const $g = s => rod.querySelector(s), R = { frost: $g('#glas-frost'), sloer: $g('#glas-sloer') };
    const gem = () => { lager.gem('glas', S); anvend(); vis(); };
    function vis() {
      R.frost.value = S.frost; R.sloer.value = S.sloer;
      $g('#glas-frost-v').textContent = tal(S.frost);
      $g('#glas-sloer-v').textContent = tal(S.sloer, 1) + ' (' + Math.round(18 * S.sloer / STD.sloer) + ' px)';
      const kr = kontrast(), ok = kr >= 4.5;
      $g('#glas-status').textContent = `Kontrast ${tal(kr)}:1 · ${ok ? 'Består AA (normal tekst ≥ 4,5:1)' : kr >= 3 ? 'Kun stor tekst (≥ 3:1)' : 'Under AA. Øg frost.'}`;
      $g('#glas-status').classList.toggle('lav', !ok);
    }
    Object.entries(R).forEach(([n, el]) => el.addEventListener('input', () => { S[n] = Number(el.value); gem(); }));
    $g('#glas-nul').addEventListener('click', () => { S = { ...STD }; gem(); toast('Glasset er sat tilbage'); });
    vis();
    return vis;
  }

  anvend();
  return { anvend, html, start };
})();
