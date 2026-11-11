// Madplan: en ret pr. dag ud fra det, du har derhjemme. Retterne vælges, så de mangler nogenlunde de samme varer.
// Så bliver indkøbslisten kort. Ren logik, ingen AI.
const Madplan = (() => {
  const VALG = { // navn: [tekst, standard, mindst, højst]
    dage: ['Antal dage', 5, 1, 14],
    prRet: ['Højst så mange mangler pr. ret', 2, 0, 10],
    i_alt: ['Højst så mange forskellige varer at købe', 4, 0, 20]
  };
  const vaerdi = k => { const [, std, min, max] = VALG[k]; return Math.max(min, Math.min(max, Math.round(Number(lager.hent('mp_' + k, std))))) || (min > 0 ? std : 0); };
  let har = '';
  const foer = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]; return false; };

  // Prøv hver ret som den første. Læg derefter den ret til, der giver færrest nye varer at købe
  // (og bruger flest af dem, der allerede skal købes). Den plan med flest dage og kortest indkøbsliste vinder.
  function lavPlan() {
    const dage = vaerdi('dage'), prRet = vaerdi('prRet'), iAlt = vaerdi('i_alt');
    const f = beregnForslag(F, har);
    const kand = [...f.kan.map(r => ({ r, mangler: [] })), ...f.naesten].filter(x => x.mangler.length <= prRet)
      .map(x => ({ ...x, n: [...new Set(x.mangler.map(stamme))] }));
    let bedst = null;
    for (const start of kand.length ? kand : []) {
      if (start.n.length > iAlt) continue;
      const K = new Set(start.n), valgt = [start];
      while (valgt.length < dage) {
        let ny = null, nyScore = null;
        for (const x of kand) {
          if (valgt.includes(x)) continue;
          const nye = x.n.filter(s => !K.has(s)).length;
          if (K.size + nye > iAlt) continue;
          const score = [nye, -(x.n.length - nye), x.n.length];
          if (!ny || foer(score, nyScore)) { ny = x; nyScore = score; }
        }
        if (!ny) break;
        ny.n.forEach(s => K.add(s)); valgt.push(ny);
      }
      const total = valgt.reduce((a, x) => a + x.n.length, 0);
      if (!bedst || valgt.length > bedst.valgt.length || (valgt.length === bedst.valgt.length && (K.size < bedst.K.size || (K.size === bedst.K.size && total < bedst.total)))) bedst = { valgt, K, total };
    }
    return { dage, plan: bedst ? bedst.valgt : [] };
  }
  function tegn() {
    const el = $('#mp-plan');
    if (!el) return;
    const { dage, plan } = lavPlan();
    if (!plan.length) { el.innerHTML = '<p class="tomt">Jeg kan ikke finde nogen retter. Tillad flere varer at købe, eller skriv mere i «Hvad har du derhjemme?».</p>'; return; }
    const koeb = new Map(); // stamme -> { navn, antal }
    plan.forEach(x => x.mangler.forEach(m => { const s = stamme(m), k = koeb.get(s); if (k) k.antal++; else koeb.set(s, { navn: m, antal: 1 }); }));
    el.innerHTML = `<h2>Din madplan</h2>
      ${plan.length < dage ? `<p class="lille">Jeg fandt kun ${plan.length} ${plan.length === 1 ? 'ret' : 'retter'}. Tillad flere varer, så kan jeg finde flere.</p>` : ''}
      ${plan.map((x, i) => `<a class="kort" href="#/opskrifter/${x.r.id}"><strong>Dag ${i + 1}: ${esc(x.r.titel)}</strong><span>${x.mangler.length ? 'Mangler: ' + esc(x.mangler.join(', ')) : 'Du har det hele'}</span></a>`).join('')}
      <h2>Det skal du købe</h2>
      ${koeb.size ? `<div class="kort"><ul class="ing">${[...koeb.values()].map(k => `<li><span>${esc(k.navn)}${k.antal > 1 ? ` (til ${k.antal} retter)` : ''}</span></li>`).join('')}</ul></div>`
        : '<p class="lille">Ingenting. Du har alt, hvad du skal bruge.</p>'}`;
  }
  const raekke = k => `<div class="mp-rk"><span class="tekst-m">${VALG[k][0]}</span>
    <div class="stepper" role="group" aria-label="${VALG[k][0]}">
      <button type="button" class="rund felt felt-s" data-h="mpTrin" data-v="${k}:-1" aria-label="Færre">−</button>
      <input class="felt felt-s mp-inp" data-k="${k}" type="text" inputmode="numeric" autocomplete="off" value="${vaerdi(k)}" aria-label="${VALG[k][0]}">
      <button type="button" class="rund felt felt-s" data-h="mpTrin" data-v="${k}:1" aria-label="Flere">+</button></div></div>`;
  async function side() {
    const id = visning;
    henter();
    const [opsk, hj] = await Promise.all([api('opskrifter?select=id,titel,kategori,svaerhed,tid_minutter,ingredienser&order=titel'), api('hjemme?select=ingredienser(navn)')]);
    if (id !== visning) return;
    F = opsk; har = hj.map(h => h.ingredienser && h.ingredienser.navn).filter(Boolean).join(',');
    app.innerHTML = `<a class="tilbage" href="#/forslag">‹ Tilbage</a><h1>Madplan</h1>
      <p class="tekst">Jeg vælger retter ud fra det, du har derhjemme. Retterne mangler nogenlunde de samme ting, så du skal købe så lidt som muligt.</p>
      <div class="mp-valg">${Object.keys(VALG).map(raekke).join('')}</div>
      <div id="mp-plan"></div>`;
    tegn();
    Hjaelper.side([
      { tekst: 'Vælg, hvor mange dage og hvor meget du vil købe.', maal: '.mp-valg', bev: 'skridt' },
      { tekst: 'Her er din madplan. Tryk på en ret for at se opskriften.', maal: '#mp-plan', bev: 'dans' }]);
  }
  const saet = (k, v) => {
    lager.gem('mp_' + k, Math.max(VALG[k][2], Math.min(VALG[k][3], Math.round(Number(v)) || 0)));
    const inp = $(`.mp-inp[data-k="${k}"]`); if (inp) inp.value = vaerdi(k);
    tegn();
  };
  H.mpTrin = el => { const [k, d] = el.dataset.v.split(':'); saet(k, vaerdi(k) + Number(d)); };
  document.addEventListener('change', e => { if (e.target.classList && e.target.classList.contains('mp-inp')) saet(e.target.dataset.k, e.target.value); });
  return { side };
})();
