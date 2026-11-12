// Madplan: én madplan, der gemmes i Supabase (tabellen madplan, rækken «faelles») og er ens på alle enheder. Når man gemmer, erstattes den gamle.
// Hver dag kan have en hovedret, en salat eller begge dele. «Blandet» lader dig vælge for hver dag. Retterne vælges, så de mangler nogenlunde de samme varer.
// Siden «Madplan» viser planen som et gitter med en dag pr. felt. Siden «Rediger madplan» har valgene. Ren logik, ingen AI.
const Madplan = (() => {
  const VALG = { // navn: [tekst, standard, mindst, højst]
    dage: ['Antal dage', 5, 1, 14],
    prRet: ['Højst mangler pr. ret', 2, 0, 10],
    i_alt: ['Højst varer at købe i alt', 4, 0, 20]
  };
  const RAEKKE = 'faelles';
  const STD = { type: 'hoved', dage: 5, prRet: 2, i_alt: 4, dagTyper: [], plan: null }; // plan: [{ t: 'hoved' | 'salat' | 'begge', hoved: id, salat: id }]
  let ST = { ...STD }, E = { ...STD }, har = '', P = new Map(), gemTimer, afvist = new Set();
  const tal = (o, k) => { const [, std, min, max] = VALG[k]; return Math.max(min, Math.min(max, Math.round(Number(o[k])))) || (min > 0 ? std : 0); };
  const vaerdi = k => tal(E, k);
  const SLOT = { hoved: 'Hovedret', salat: 'Salat' };
  const gem = () => api('madplan?on_conflict=id', { method: 'POST', flet: true, body: { id: RAEKKE, data: ST, opdateret: new Date().toISOString() } })
    .catch(e => { console.error(e); toast('Madplanen kunne ikke gemmes. Tjek internettet.'); });
  const foer = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]; return false; };

  // Hvilke retter må med? Tilbehør, drikke og dessert er aldrig med. En salat kendes på ordet «salat» i navnet eller kategorien.
  const TYPER = [['hoved', 'Hovedret', 'En hovedret hver dag.'], ['salat', 'Salat', 'En salat hver dag.'], ['begge', 'Begge dele', 'En hovedret og en salat hver dag, altså to retter.'], ['blandet', 'Blandet', 'Du vælger selv for hver dag: hovedret, salat eller begge dele.']];
  const type = () => TYPER.some(x => x[0] === E.type) ? E.type : 'hoved';
  const dagType = i => type() === 'blandet' ? (['hoved', 'salat', 'begge'].includes(E.dagTyper[i]) ? E.dagTyper[i] : 'hoved') : type();
  const udeladt = r => /tilbehør|drik|dessert/i.test(r.kategori || '');
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
  // Gem: lav en ny plan af valgene og læg den i stedet for den gamle.
  function nyPlan() {
    const dage = ST.dage, t = i => (ST.type === 'blandet' ? ST.dagTyper[i] : ST.type) || 'hoved';
    const dageT = Array.from({ length: dage }, (_, i) => t(i)), nH = dageT.filter(x => x !== 'salat').length, nS = dageT.filter(x => x !== 'hoved').length;
    const hoved = nH ? vaelgSaet(pool(r => !erSalat(r)), nH, ST.prRet, ST.i_alt) : null;
    const salat = nS ? vaelgSaet(pool(erSalat), nS, ST.prRet, ST.i_alt, hoved ? hoved.K : new Set()) : null;
    let h = 0, s = 0;
    ST.plan = dageT.map(x => ({ t: x, hoved: x !== 'salat' ? (hoved && hoved.valgt[h++] ? hoved.valgt[h - 1].r.id : null) : null, salat: x !== 'hoved' ? (salat && salat.valgt[s++] ? salat.valgt[s - 1].r.id : null) : null }));
  }
  const manglerTekst = x => x.mangler.length ? 'Mangler: ' + x.mangler.join(', ') : 'Du har det hele';
  const viser = (d, s) => d[s] || d.t === s || d.t === 'begge';
  function retHtml(d, i, s) {
    const x = d[s] ? P.get(d[s]) : null;
    return `<div class="kort mp-ret"><strong>${x ? `<a href="#/opskrifter/${x.r.id}">${esc(x.r.titel)}</a>` : d[s] ? 'Retten findes ikke mere' : 'Ingen ret endnu'}</strong>
      <span>${SLOT[s]}${x ? ' · ' + esc(manglerTekst(x)) : ''}</span>
      <div class="rakke"><button type="button" class="knap mini" data-tpid="mp-udskift" data-h="mpUdskift" data-v="${i}:${s}">${d[s] ? 'Udskift' : 'Vælg ret'}</button></div></div>`;
  }
  function dagHtml(d, i) {
    const mangler = !(viser(d, 'hoved') && viser(d, 'salat'));
    return `<section class="kort mp-dagfelt"><div class="mp-hoved"><h3 class="tekst-l">Dag ${i + 1}</h3>${mangler ? `<button type="button" class="knap mini" data-tpid="mp-tilfoej" data-h="mpTilfoej" data-v="${i}">+ Tilføj ret</button>` : ''}</div>
      ${['hoved', 'salat'].filter(s => viser(d, s)).map(s => retHtml(d, i, s)).join('')}</section>`;
  }
  function tegn() {
    const el = $('#mp-plan');
    if (!el) return;
    const plan = ST.plan || [];
    if (!plan.length) { el.innerHTML = `<p class="tomt">Du har ingen madplan endnu. Tryk på «Rediger madplan», vælg og gem.</p>`; return; }
    const koeb = new Map(); // stamme -> { navn, antal }
    plan.forEach(d => ['hoved', 'salat'].forEach(s => { const x = d[s] && P.get(d[s]); if (x) x.mangler.forEach(m => { const st = stamme(m), k = koeb.get(st); if (k) k.antal++; else koeb.set(st, { navn: m, antal: 1 }); }); }));
    const tomme = plan.filter(d => ['hoved', 'salat'].some(s => viser(d, s) && !d[s])).length;
    el.innerHTML = `${tomme ? `<p class="lille">Jeg fandt ikke retter til alle felter. Tryk på «Vælg ret», eller tillad flere varer i «Rediger madplan».</p>` : ''}
      <div class="mp-grid">${plan.map(dagHtml).join('')}</div>
      <h2>Det skal du købe</h2>
      ${koeb.size ? `<div class="kort"><ul class="ing">${[...koeb.values()].map(k => `<li><span>${esc(k.navn)}${k.antal > 1 ? ` (til ${k.antal} retter)` : ''}</span></li>`).join('')}</ul></div>`
        : '<p class="lille">Ingenting. Du har alt, hvad du skal bruge.</p>'}`;
  }
  // Retter, der kan komme i stedet: de samme regler som valgene (højst mangler pr. ret og i alt), og ikke en ret, der allerede er med.
  function kandidater(dag, s) {
    const d = ST.plan[dag], brugt = new Set(ST.plan.flatMap(x => [x.hoved, x.salat]).filter(Boolean));
    const K = new Set(); ST.plan.forEach((x, i) => ['hoved', 'salat'].forEach(sl => { const y = x[sl] && P.get(x[sl]); if (y && !(i === dag && sl === s)) y.n.forEach(v => K.add(v)); }));
    return pool(s === 'salat' ? erSalat : r => !erSalat(r)).filter(x => x.mangler.length <= ST.prRet && (!brugt.has(x.r.id) || x.r.id === d[s]))
      .map(x => ({ x, nye: x.n.filter(v => !K.has(v)).length })).filter(c => K.size + c.nye <= ST.i_alt)
      .sort((a, b) => a.nye - b.nye || a.x.n.length - b.x.n.length).slice(0, 12).map(c => c.x);
  }
  let aaben = null; // { dag, s }
  function popup(dag, s) {
    aaben = { dag, s };
    const d = ST.plan[dag], liste = kandidater(dag, s);
    ark(`<h2>${d[s] ? 'Udskift' : 'Vælg'} ${SLOT[s].toLowerCase()} · Dag ${dag + 1}</h2>
      <small>Retterne følger dine valg: højst ${ST.prRet} mangler pr. ret og ${ST.i_alt} varer i alt.</small>
      ${liste.length && liste.length < 6 ? '<small>Vil du se flere retter? Tillad flere varer at købe i «Rediger madplan».</small>' : ''}
      <div class="mp-valgliste">${liste.length ? liste.map(x => `<button type="button" class="kort${x.r.id === d[s] ? ' valgt' : ''}" data-tpid="mp-vaelg" data-h="mpVaelg" data-v="${x.r.id}"><strong>${esc(x.r.titel)}</strong><span>${esc(manglerTekst(x))}</span></button>`).join('')
        : '<p class="tomt">Jeg finder ingen retter, der passer. Tillad flere varer i «Rediger madplan».</p>'}</div>
      <div class="rakke">${d[s] ? '<button type="button" class="knap" data-tpid="mp-fjern" data-h="mpFjern">Fjern retten</button>' : ''}<button type="button" class="knap" data-tpid="mp-luk" data-h="lukArk">Luk</button></div>`);
    $('.ark-bag').addEventListener('click', lukArk);
  }
  async function hent() {
    const [opsk, hj, rk] = await Promise.all([api('opskrifter?select=id,titel,kategori,svaerhed,tid_minutter,ingredienser,skjul_forslag&order=titel'), api('hjemme?select=ingredienser(navn)'), api(`madplan?id=eq.${RAEKKE}&select=data`).catch(e => { console.error(e); return []; })]);
    F = opsk.filter(r => !r.skjul_forslag); har = hj.map(h => h.ingredienser && h.ingredienser.navn).filter(Boolean).join(',');
    ST = { ...STD, ...(rk[0] && rk[0].data) };
    if (ST.plan && !Array.isArray(ST.plan)) ST.plan = (ST.plan.liste || []).map(d => ({ t: ST.plan.t || 'hoved', hoved: d.hoved, salat: d.salat })); // den gamle form
    if (!ST.plan || !ST.plan.length) ST.plan = null;
    P = new Map(pool(() => true).map(x => [x.r.id, x]));
  }
  async function side() { // Madplan: planen som gitter
    const id = visning;
    henter();
    await hent();
    if (id !== visning) return;
    app.innerHTML = `<a class="tilbage" href="#/forslag">‹ Tilbage</a><h1>Madplan</h1>
      <a class="knap felt felt-m" data-tpid="mp-rediger" href="#/forslag/madplan/rediger">${ik('gryde')} Rediger madplan</a>
      <div id="mp-plan"></div>`;
    tegn();
    Hjaelper.side([
      { tekst: 'Her er din madplan. Hver dag har sit eget felt.', maal: '#mp-plan', bev: 'dans', valgfri: true },
      { tekst: 'Passer en ret ikke? Tryk på «Udskift», og vælg en anden.', maal: '.mp-ret .knap', bev: 'skridt', valgfri: true },
      { tekst: 'Vil du lave en helt ny plan? Tryk på «Rediger madplan».', maal: '[data-tpid=mp-rediger]', bev: 'salto' }]);
  }
  const raekke = k => `<div class="mp-rk"><span class="tekst-m">${VALG[k][0]}</span>
    <div class="stepper" role="group" aria-label="${VALG[k][0]}">
      <button type="button" class="rund felt felt-s" data-h="mpTrin" data-v="${k}:-1" aria-label="Færre">−</button>
      <input class="felt felt-s mp-inp" data-k="${k}" type="text" inputmode="numeric" autocomplete="off" value="${vaerdi(k)}" aria-label="${VALG[k][0]}">
      <button type="button" class="rund felt felt-s" data-h="mpTrin" data-v="${k}:1" aria-label="Flere">+</button></div></div>`;
  const dagValg = () => type() !== 'blandet' ? '' : Array.from({ length: vaerdi('dage') }, (_, i) => `<div class="mp-rk mp-dagrk"><span class="tekst-m">Dag ${i + 1}</span>
      <div class="mp-dagchips" role="group" aria-label="Dag ${i + 1}">${[['hoved', 'Hovedret'], ['salat', 'Salat'], ['begge', 'Begge']].map(([k, n]) => `<button type="button" class="chip${dagType(i) === k ? ' valgt' : ''}" data-tpid="mp-dag-${k}" data-h="mpDagType" data-v="${i}:${k}">${n}</button>`).join('')}</div></div>`).join('');
  function tegnValg() {
    const t = type();
    document.querySelectorAll('.mp-type .chip').forEach(c => c.classList.toggle('valgt', c.dataset.v === t));
    const hjaelp = $('#mp-typetekst'); if (hjaelp) hjaelp.textContent = TYPER.find(x => x[0] === t)[2];
    const dv = $('#mp-dagvalg'); if (dv) dv.innerHTML = dagValg();
  }
  async function rediger() { // Rediger madplan: valgene. «Gem madplan» laver planen og erstatter den gamle.
    const id = visning;
    henter();
    await hent();
    if (id !== visning) return;
    E = { ...STD, ...ST, plan: null, dagTyper: [...(ST.dagTyper || [])] };
    app.innerHTML = `<a class="tilbage" href="#/forslag/madplan">‹ Tilbage</a><h1>Rediger madplan</h1>
      <p class="tekst">Jeg vælger retter ud fra det, du har derhjemme. Retterne mangler nogenlunde de samme ting, så du skal købe så lidt som muligt. Der er kun én madplan, og den er den samme på alle dine enheder.</p>
      <h2>Hvad skal vi have hver dag?</h2>
      <div class="filter mp-type">${TYPER.map(([k, navn]) => `<button type="button" class="chip" data-tpid="mp-type-${k}" data-h="mpType" data-v="${k}">${navn}</button>`).join('')}</div>
      <small id="mp-typetekst"></small>
      <div id="mp-dagvalg" class="mp-valg"></div>
      <div class="mp-valg">${Object.keys(VALG).map(raekke).join('')}</div>
      <small>${ST.plan ? 'Når du gemmer, erstatter den nye madplan den, du har nu.' : 'Tryk på «Gem madplan», så laver jeg planen.'}</small>
      <button type="button" class="knap primaer felt felt-m" data-tpid="mp-gem" data-h="mpGem">Gem madplan</button>`;
    tegnValg();
    Hjaelper.side([
      { tekst: 'Vælg først: hovedret, salat, begge dele eller blandet.', maal: '.mp-type', bev: 'salto' },
      { tekst: 'Vælg, hvor mange dage og hvor meget du vil købe.', maal: '.mp-valg:last-of-type', bev: 'skridt' },
      { tekst: 'Tryk på «Gem madplan», så laver jeg planen.', maal: '[data-h=mpGem]', bev: 'dans' }]);
  }
  const saet = (k, v) => {
    E[k] = Math.max(VALG[k][2], Math.min(VALG[k][3], Math.round(Number(v)) || 0));
    const inp = $(`.mp-inp[data-k="${k}"]`); if (inp) inp.value = vaerdi(k);
    if (k === 'dage') tegnValg();
  };
  const ind = () => { const a = ST.plan && ST.plan[aaben.dag]; return a; };
  Object.assign(H, {
    mpType(el) { E.type = el.dataset.v; tegnValg(); },
    mpDagType(el) { const [i, t] = el.dataset.v.split(':'); E.dagTyper = Array.from({ length: vaerdi('dage') }, (_, j) => dagType(j)); E.dagTyper[Number(i)] = t; tegnValg(); },
    mpTrin(el) { const [k, d] = el.dataset.v.split(':'); saet(k, vaerdi(k) + Number(d)); },
    async mpGem(el) {
      el.disabled = true;
      try {
        const dage = vaerdi('dage');
        ST = { ...ST, type: type(), dage, prRet: vaerdi('prRet'), i_alt: vaerdi('i_alt'), dagTyper: Array.from({ length: dage }, (_, j) => dagType(j)) };
        nyPlan();
        await api('madplan?on_conflict=id', { method: 'POST', flet: true, body: { id: RAEKKE, data: ST, opdateret: new Date().toISOString() } });
        toast('Madplanen er gemt'); Hjaelper.glad('Din madplan er gemt!');
        location.hash = '#/forslag/madplan';
      } catch (err) { el.disabled = false; throw err; }
    },
    mpUdskift(el) { const [i, s] = el.dataset.v.split(':'); popup(Number(i), s); },
    mpTilfoej(el) { // tilføj den ret, dagen mangler: har dagen kun hovedret, kommer der en salat, og omvendt
      const i = Number(el.dataset.v), d = ST.plan[i], s = viser(d, 'hoved') ? 'salat' : 'hoved';
      d.t = 'begge'; tegn(); popup(i, s);
    },
    async mpVaelg(el) {
      const d = ind(); if (!d) return;
      d[aaben.s] = el.dataset.v; lukArk(); tegn(); await gem();
    },
    async mpFjern() {
      const d = ind(); if (!d) return;
      const s = aaben.s; d[s] = null;
      if (d.t === 'begge') d.t = s === 'hoved' ? 'salat' : 'hoved';
      lukArk(); tegn(); await gem();
    }
  });
  document.addEventListener('change', e => { if (e.target.classList && e.target.classList.contains('mp-inp')) saet(e.target.dataset.k, e.target.value); });
  return { side, rediger };
})();
