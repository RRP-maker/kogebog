// Madplan: en hovedret, en salat eller begge dele pr. dag ud fra det, du har derhjemme. Tilbehør og drikke er ikke med. Retterne vælges, så de mangler nogenlunde de samme varer.
// Så bliver indkøbslisten kort. Ren logik, ingen AI.
const Madplan = (() => {
  const VALG = { // navn: [tekst, standard, mindst, højst]
    dage: ['Antal dage', 5, 1, 14],
    prRet: ['Højst mangler pr. ret', 2, 0, 10],
    i_alt: ['Højst varer at købe i alt', 4, 0, 20]
  };
  const vaerdi = k => { const [, std, min, max] = VALG[k]; return Math.max(min, Math.min(max, Math.round(Number(lager.hent('mp_' + k, std))))) || (min > 0 ? std : 0); };
  let har = '';
  const foer = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]; return false; };

  // Hvilke retter må med? Tilbehør og drikke er aldrig med. En salat kendes på ordet «salat» i navnet eller kategorien.
  const TYPER = [['hoved', 'Hovedret', 'En hovedret hver dag.'], ['salat', 'Salat', 'En salat hver dag.'], ['begge', 'Begge dele', 'En hovedret og en salat hver dag, altså to retter.']];
  const type = () => { const t = lager.hent('mp_type', 'hoved'); return TYPER.some(x => x[0] === t) ? t : 'hoved'; };
  const udeladt = r => /tilbehør|drik/i.test(r.kategori || '');
  const erSalat = r => /salat/i.test((r.kategori || '') + ' ' + (r.titel || ''));
  const pool = filter => { const f = beregnForslag(F.filter(r => !udeladt(r) && filter(r)), har);
    return [...f.kan.map(r => ({ r, mangler: [] })), ...f.naesten].map(x => ({ ...x, n: [...new Set(x.mangler.map(stamme))] })); };

  // Prøv hver ret som den første. Læg derefter den ret til, der giver færrest nye varer at købe
  // (og bruger flest af dem, der allerede skal købes). Den plan med flest dage og kortest indkøbsliste vinder.
  // K0: varer, der allerede skal købes til en anden del af planen. De tæller med i grænsen.
  function vaelgSaet(alle, dage, prRet, iAlt, K0 = new Set()) {
    const kand = alle.filter(x => x.mangler.length <= prRet);
    let bedst = null;
    for (const start of kand) {
      const K = new Set([...K0, ...start.n]), valgt = [start];
      if (K.size > iAlt) continue;
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
    return bedst || { valgt: [], K: new Set(K0), total: 0 };
  }
  function lavPlan() {
    const dage = vaerdi('dage'), prRet = vaerdi('prRet'), iAlt = vaerdi('i_alt'), t = type();
    const hoved = t !== 'salat' ? vaelgSaet(pool(r => !erSalat(r)), dage, prRet, iAlt) : null;
    const salat = t !== 'hoved' ? vaelgSaet(pool(erSalat), dage, prRet, iAlt, hoved ? hoved.K : new Set()) : null;
    const antal = Math.max(hoved ? hoved.valgt.length : 0, salat ? salat.valgt.length : 0);
    const dageListe = Array.from({ length: Math.min(dage, antal) }, (_, i) => ({ hoved: hoved && hoved.valgt[i], salat: salat && salat.valgt[i] }));
    return { dage, t, dageListe, mangletHoved: hoved && hoved.valgt.length < dage, mangletSalat: salat && salat.valgt.length < dage };
  }
  const kort = (x, mark, titel) => `<a class="kort" href="#/opskrifter/${x.r.id}"><strong>${titel || ''}${esc(x.r.titel)}</strong><span>${mark ? esc(mark) + ' · ' : ''}${x.mangler.length ? 'Mangler: ' + esc(x.mangler.join(', ')) : 'Du har det hele'}</span></a>`;
  function tegn() {
    const el = $('#mp-plan');
    if (!el) return;
    const { dage, t, dageListe, mangletHoved, mangletSalat } = lavPlan();
    document.querySelectorAll('.mp-type .chip').forEach(c => c.classList.toggle('valgt', c.dataset.v === t));
    const hjaelp = $('#mp-typetekst'); if (hjaelp) hjaelp.textContent = TYPER.find(x => x[0] === t)[2];
    if (!dageListe.length) { el.innerHTML = `<p class="tomt">Jeg kan ikke finde ${t === 'salat' ? 'nogen salater' : 'nogen retter'}. Tillad flere varer at købe, eller skriv mere i «Hvad har du derhjemme?».</p>`; return; }
    const koeb = new Map(); // stamme -> { navn, antal }
    dageListe.forEach(d => [d.hoved, d.salat].filter(Boolean).forEach(x => x.mangler.forEach(m => { const s = stamme(m), k = koeb.get(s); if (k) k.antal++; else koeb.set(s, { navn: m, antal: 1 }); })));
    const mgl = [mangletHoved && 'hovedretter', mangletSalat && 'salater'].filter(Boolean);
    el.innerHTML = `<h2>Din madplan</h2>
      ${mgl.length || dageListe.length < dage ? `<p class="lille">Jeg fandt kun ${dageListe.length} ${dageListe.length === 1 ? 'dag' : 'dage'}${mgl.length ? ` med ${mgl.join(' og ')}` : ''}. Tillad flere varer, så kan jeg finde flere.</p>` : ''}
      ${dageListe.map((d, i) => t === 'begge'
        ? `<h3 class="mp-dag tekst-l">Dag ${i + 1}</h3>${d.hoved ? kort(d.hoved, 'Hovedret') : ''}${d.salat ? kort(d.salat, 'Salat') : ''}`
        : kort(d.hoved || d.salat, '', `Dag ${i + 1}: `)).join('')}
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
    const [opsk, hj] = await Promise.all([api('opskrifter?select=id,titel,kategori,svaerhed,tid_minutter,ingredienser,skjul_forslag&order=titel'), api('hjemme?select=ingredienser(navn)')]);
    if (id !== visning) return;
    F = opsk.filter(r => !r.skjul_forslag); har = hj.map(h => h.ingredienser && h.ingredienser.navn).filter(Boolean).join(',');
    app.innerHTML = `<a class="tilbage" href="#/forslag">‹ Tilbage</a><h1>Madplan</h1>
      <p class="tekst">Jeg vælger retter ud fra det, du har derhjemme. Retterne mangler nogenlunde de samme ting, så du skal købe så lidt som muligt.</p>
      <h2>Hvad skal vi have hver dag?</h2>
      <div class="filter mp-type">${TYPER.map(([k, navn]) => `<button type="button" class="chip${k === type() ? ' valgt' : ''}" data-tpid="mp-type-${k}" data-h="mpType" data-v="${k}">${navn}</button>`).join('')}</div>
      <small id="mp-typetekst"></small>
      <div class="mp-valg">${Object.keys(VALG).map(raekke).join('')}</div>
      <div id="mp-plan"></div>`;
    tegn();
    Hjaelper.side([
      { tekst: 'Vælg først: hovedret, salat eller begge dele.', maal: '.mp-type', bev: 'salto' },
      { tekst: 'Vælg, hvor mange dage og hvor meget du vil købe.', maal: '.mp-valg', bev: 'skridt' },
      { tekst: 'Her er din madplan. Tryk på en ret for at se opskriften.', maal: '#mp-plan', bev: 'dans' }]);
  }
  const saet = (k, v) => {
    lager.gem('mp_' + k, Math.max(VALG[k][2], Math.min(VALG[k][3], Math.round(Number(v)) || 0)));
    const inp = $(`.mp-inp[data-k="${k}"]`); if (inp) inp.value = vaerdi(k);
    tegn();
  };
  H.mpType = el => { lager.gem('mp_type', el.dataset.v); tegn(); };
  H.mpTrin = el => { const [k, d] = el.dataset.v.split(':'); saet(k, vaerdi(k) + Number(d)); };
  document.addEventListener('change', e => { if (e.target.classList && e.target.classList.contains('mp-inp')) saet(e.target.dataset.k, e.target.value); });
  return { side };
})();
