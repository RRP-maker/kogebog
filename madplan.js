// Madplan: én side med planen som gitter og alle valg øverst. Planen og valgene gemmes i Supabase (tabellen madplan, rækken «faelles») og er ens på alle enheder.
// Hver dag har tre felter: hovedret, salat og tilbehør, som kan slås til og fra pr. dag eller på alle dage. Retterne vælges, så de mangler nogenlunde de samme varer.
// Fortryd og Gentag husker ændringerne, mens siden er åben. Ren logik, ingen AI.
const Madplan = (() => {
  const VALG = { // navn: [tekst, standard, mindst, højst]
    dage: ['Antal dage', 5, 1, 14],
    prRet: ['Højst mangler pr. ret', 2, 0, 10],
    i_alt: ['Højst varer at købe i alt', 4, 0, 20]
  };
  const RAEKKE = 'faelles', SLOTS = ['hoved', 'salat', 'tilbehoer'], NAVN = { hoved: 'Hovedret', salat: 'Salat', tilbehoer: 'Tilbehør' };
  const STD = { dage: 5, prRet: 2, i_alt: 4, plan: null }; // plan: [{ paa: { hoved, salat, tilbehoer }, hoved: id, salat: id, tilbehoer: id }]
  let ST = { ...STD }, har = '', P = new Map(), gemTimer, fortrydes = [], gentages = [], aaben = null;
  const vaerdi = k => { const [, std, min, max] = VALG[k]; return Math.max(min, Math.min(max, Math.round(Number(ST[k])))) || (min > 0 ? std : 0); };
  const gem = straks => {
    clearTimeout(gemTimer);
    const send = () => api('madplan?on_conflict=id', { method: 'POST', flet: true, body: { id: RAEKKE, data: ST, opdateret: new Date().toISOString() } })
      .catch(e => { console.error(e); toast('Madplanen kunne ikke gemmes. Tjek internettet.'); });
    if (straks) return send(); gemTimer = setTimeout(send, 400);
  };
  const foer = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]; return false; };
  // En ret hører til én slags: tilbehør, salat eller hovedret. Drikke og dessert er aldrig med. En salat kendes på ordet «salat» i navnet eller kategorien.
  const slotAf = r => /tilbehør/i.test(r.kategori || '') ? 'tilbehoer' : /drik|dessert/i.test(r.kategori || '') ? null : /salat/i.test((r.kategori || '') + ' ' + (r.titel || '')) ? 'salat' : 'hoved';
  const pool = filter => { const f = beregnForslag(F.filter(r => slotAf(r) && filter(r)), har);
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
  const tomDag = paa => ({ paa: { hoved: !!paa.hoved, salat: !!paa.salat, tilbehoer: !!paa.tilbehoer }, hoved: null, salat: null, tilbehoer: null });
  const STANDARDDAG = { hoved: true, salat: false, tilbehoer: false };
  // Ældre planer (før dagene fik tre felter) laves om til den nye form.
  function normPlan(p) {
    if (!p) return null;
    const liste = Array.isArray(p) ? p : (p.liste || []).map(d => ({ t: p.t || 'hoved', hoved: d.hoved, salat: d.salat }));
    return liste.map(d => { const paa = d.paa || { hoved: d.t !== 'salat', salat: d.t === 'salat' || d.t === 'begge', tilbehoer: false }; return { ...tomDag(paa), hoved: d.hoved || null, salat: d.salat || null, tilbehoer: d.tilbehoer || null }; });
  }
  const snap = () => { fortrydes.push(JSON.stringify(ST.plan)); if (fortrydes.length > 30) fortrydes.shift(); gentages = []; };
  const blandet = () => ST.plan.length > 1 && ST.plan.some(d => SLOTS.some(s => !!d.paa[s] !== !!ST.plan[0].paa[s]));
  function saetDage(n) {
    const pl = ST.plan;
    while (pl.length > n) pl.pop();
    while (pl.length < n) pl.push(tomDag(pl.length ? pl[pl.length - 1].paa : STANDARDDAG));
  }
  // Generer: fyld alle felter, der er slået til, med nye retter. Hvilke felter der er til, ændres ikke.
  function nyPlan() {
    const pl = ST.plan, prRet = vaerdi('prRet'), iAlt = vaerdi('i_alt');
    let K = new Set();
    SLOTS.forEach(s => {
      const dd = pl.filter(d => d.paa[s]);
      pl.forEach(d => { if (!d.paa[s]) d[s] = null; });
      if (!dd.length) return;
      const r = vaelgSaet(pool(x => slotAf(x) === s), dd.length, prRet, iAlt, K);
      K = r.K;
      dd.forEach((d, j) => { d[s] = r.valgt[j] ? r.valgt[j].r.id : null; });
    });
  }
  const manglerTekst = x => x.mangler.length ? 'Mangler: ' + x.mangler.join(', ') : 'Du har det hele';
  function slotHtml(d, i, s) {
    if (!d.paa[s]) return `<div class="kort mp-ret mp-av tekst-m" data-tpid="mp-ret-${s}"><strong>${NAVN[s]}</strong><span>Er ikke med</span><div class="rakke"></div></div>`;
    const x = d[s] ? P.get(d[s]) : null, info = x ? NAVN[s] + ' · ' + manglerTekst(x) : NAVN[s];
    return `<div class="kort mp-ret tekst-m" data-tpid="mp-ret-${s}"><strong>${x ? `<a href="#/opskrifter/${x.r.id}" title="${esc(x.r.titel)}">${esc(x.r.titel)}</a>` : d[s] ? 'Retten findes ikke mere' : 'Ingen ret endnu'}</strong>
      <span title="${esc(info)}">${esc(info)}</span>
      <div class="rakke"><button type="button" class="knap mini" data-tpid="${d[s] ? 'mp-udskift' : 'mp-vaelg-ret'}" data-h="mpUdskift" data-v="${i}:${s}">${d[s] ? 'Udskift' : 'Vælg ret'}</button></div></div>`;
  }
  const DAGORD = ['en', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni', 'ti', 'elleve', 'tolv', 'tretten', 'fjorten']; // id'er har ingen tal
  const dagHtml = (d, i) => `<section class="kort mp-dagfelt tekst-l" data-tpid="mp-dagfelt-${DAGORD[i]}"><h3 class="tekst-l">Dag ${i + 1}</h3>
      <div class="mp-dagchips" role="group" aria-label="Dag ${i + 1}">${SLOTS.map(s => `<button type="button" class="chip${d.paa[s] ? ' valgt' : ''}" data-tpid="mp-dag-${s}" data-h="mpDagSlot" data-v="${i}:${s}" aria-pressed="${!!d.paa[s]}">${NAVN[s]}</button>`).join('')}</div>
      ${SLOTS.map(s => slotHtml(d, i, s)).join('')}</section>`;
  function tegn() {
    const pl = ST.plan;
    const har1 = pl.some(d => SLOTS.some(s => d[s]));
    $('#mp-knapper').innerHTML = `<button type="button" class="knap felt felt-s" data-tpid="mp-fortryd" data-h="mpFortryd">↶ Fortryd</button>
      <button type="button" class="knap felt felt-s" data-tpid="mp-gentag" data-h="mpGentag">Gentag ↷</button>
      <button type="button" class="knap felt felt-s" data-tpid="mp-ryd" data-h="mpRyd">Ryd madplan</button>`;
    $('#mp-alle').innerHTML = SLOTS.map(s => { const n = pl.filter(d => d.paa[s]).length; return `<button type="button" class="chip${n === pl.length ? ' valgt' : n ? ' delvis' : ''}" data-tpid="mp-alle-${s}" data-h="mpAlle" data-v="${s}" aria-pressed="${n === pl.length}">${NAVN[s]}</button>`; }).join('')
      + (blandet() ? '<span class="chip valgt mp-blandet">Blandet</span>' : '');
    const koeb = new Map(); // stamme -> { navn, antal }
    pl.forEach(d => SLOTS.forEach(s => { const x = d[s] && P.get(d[s]); if (x) x.mangler.forEach(m => { const st = stamme(m), k = koeb.get(st); if (k) k.antal++; else koeb.set(st, { navn: m, antal: 1 }); }); }));
    $('#mp-plan').innerHTML = `<div class="mp-grid">${pl.map(dagHtml).join('')}</div>
      <h2>Det skal du købe</h2>
      ${koeb.size ? `<div class="kort"><ul class="ing">${[...koeb.values()].map(k => `<li><span>${esc(k.navn)}${k.antal > 1 ? ` (til ${k.antal} retter)` : ''}</span></li>`).join('')}</ul></div>`
        : `<p class="lille">${har1 ? 'Ingenting. Du har alt, hvad du skal bruge.' : 'Tryk på «Generer ny madplan», så finder jeg retter.'}</p>`}`;
  }
  // Retter, der kan komme i stedet: de samme regler som valgene (højst mangler pr. ret og i alt), og ikke en ret, der allerede er med.
  function kandidater(dag, s) {
    const d = ST.plan[dag], brugt = new Set(ST.plan.flatMap(x => SLOTS.map(sl => x[sl])).filter(Boolean));
    const K = new Set(); ST.plan.forEach((x, i) => SLOTS.forEach(sl => { const y = x[sl] && P.get(x[sl]); if (y && !(i === dag && sl === s)) y.n.forEach(v => K.add(v)); }));
    return pool(r => slotAf(r) === s).filter(x => x.mangler.length <= vaerdi('prRet') && (!brugt.has(x.r.id) || x.r.id === d[s]))
      .map(x => ({ x, nye: x.n.filter(v => !K.has(v)).length })).filter(c => K.size + c.nye <= vaerdi('i_alt'))
      .sort((a, b) => a.nye - b.nye || a.x.n.length - b.x.n.length).map(c => c.x);
  }
  function popup(dag, s) {
    aaben = { dag, s };
    const d = ST.plan[dag], liste = kandidater(dag, s).slice(0, 12);
    ark(`<h2>${d[s] ? 'Udskift' : 'Vælg'} ${NAVN[s].toLowerCase()} · Dag ${dag + 1}</h2>
      <small>Retterne følger dine valg: højst ${vaerdi('prRet')} mangler pr. ret og ${vaerdi('i_alt')} varer i alt.</small>
      ${liste.length && liste.length < 6 ? '<small>Vil du se flere retter? Tillad flere varer at købe øverst på siden.</small>' : ''}
      <div class="mp-valgliste">${liste.length ? liste.map(x => `<button type="button" class="kort${x.r.id === d[s] ? ' valgt' : ''}" data-tpid="mp-vaelg" data-h="mpVaelg" data-v="${x.r.id}"><strong>${esc(x.r.titel)}</strong><span>${esc(manglerTekst(x))}</span></button>`).join('')
        : '<p class="tomt">Jeg finder ingen retter, der passer. Tillad flere mangler eller varer øverst på siden.</p>'}</div>
      <div class="rakke">${d[s] ? '<button type="button" class="knap" data-tpid="mp-fjern" data-h="mpFjern">Fjern retten</button>' : ''}<button type="button" class="knap" data-tpid="mp-luk" data-h="lukArk">Luk</button></div>`);
    $('.ark-bag').addEventListener('click', lukArk);
  }
  const TRINID = { dage: 'dage', prRet: 'mangler', i_alt: 'varer' }; // id'er har ingen tal eller store bogstaver
  const raekke = k => `<div class="mp-rk"><span class="tekst-m">${VALG[k][0]}</span>
    <div class="stepper" data-tpid="mp-trin-${TRINID[k]}" role="group" aria-label="${VALG[k][0]}">
      <button type="button" class="rund felt felt-s" data-tpid="mp-minus" data-h="mpTrin" data-v="${k}:-1" aria-label="Færre">−</button>
      <input class="felt felt-s mp-inp" data-tpid="mp-tal" data-k="${k}" type="text" inputmode="numeric" autocomplete="off" value="${vaerdi(k)}" aria-label="${VALG[k][0]}">
      <button type="button" class="rund felt felt-s" data-tpid="mp-plus" data-h="mpTrin" data-v="${k}:1" aria-label="Flere">+</button></div></div>`;
  async function side() {
    const id = visning;
    henter();
    const [opsk, hj, rk] = await Promise.all([api('opskrifter?select=id,titel,kategori,svaerhed,tid_minutter,ingredienser,skjul_forslag&order=titel'), api('hjemme?select=ingredienser(navn)'), api(`madplan?id=eq.${RAEKKE}&select=data`).catch(e => { console.error(e); return []; })]);
    if (id !== visning) return;
    F = opsk.filter(r => !r.skjul_forslag); har = hj.map(h => h.ingredienser && h.ingredienser.navn).filter(Boolean).join(',');
    ST = { ...STD, ...(rk[0] && rk[0].data) };
    ST.plan = normPlan(ST.plan);
    if (!ST.plan || !ST.plan.length) ST.plan = Array.from({ length: vaerdi('dage') }, () => tomDag(STANDARDDAG));
    ST.dage = ST.plan.length;
    P = new Map(pool(() => true).map(x => [x.r.id, x]));
    fortrydes = []; gentages = [];
    app.innerHTML = `<a class="tilbage" href="#/forslag">‹ Tilbage</a><h1>Madplan</h1>
      <div id="mp-knapper"></div>
      <button type="button" class="knap primaer felt felt-m" data-tpid="mp-generer" data-h="mpGenerer">${ik('gryde')} Generer ny madplan</button>
      <h2>Hvad skal med hver dag?</h2>
      <div class="filter mp-alle" id="mp-alle" data-tpid="bjaelke-madplan"></div>
      <small>Tryk for at slå hovedret, salat eller tilbehør til eller fra på alle dage. Under hver dag kan du vælge selv.</small>
      <div class="mp-valg">${Object.keys(VALG).map(raekke).join('')}</div>
      <div id="mp-plan"></div>`;
    tegn();
    Hjaelper.side([
      { tekst: 'Tryk på «Generer ny madplan», så vælger jeg retterne.', maal: '[data-h=mpGenerer]', bev: 'salto' },
      { tekst: 'Slå hovedret, salat og tilbehør til eller fra her. Eller vælg for hver dag.', maal: '.mp-alle', bev: 'skridt' },
      { tekst: 'Vælg, hvor mange dage og hvor meget der må mangle eller købes.', maal: '.mp-valg', bev: 'hop' },
      { tekst: 'Passer en ret ikke? Tryk på «Udskift», og vælg en anden.', maal: '.mp-ret .knap', bev: 'dans', valgfri: true }]);
  }
  const saet = (k, v) => {
    const ny = Math.max(VALG[k][2], Math.min(VALG[k][3], Math.round(Number(v)) || 0));
    if (k === 'dage' && ny !== ST.plan.length) { snap(); ST.dage = ny; saetDage(ny); }
    else ST[k] = ny;
    const inp = $(`.mp-inp[data-k="${k}"]`); if (inp) inp.value = vaerdi(k);
    gem(); tegn();
  };
  const goer = f => { snap(); f(); gem(true); tegn(); }; // en ændring af planen, som kan fortrydes
  const flyt = (fra, til, tom) => { if (!fra.length) return toast(tom); til.push(JSON.stringify(ST.plan)); ST.plan = JSON.parse(fra.pop()); ST.dage = ST.plan.length; const inp = $('.mp-inp[data-k="dage"]'); if (inp) inp.value = vaerdi('dage'); gem(true); tegn(); };
  const fyldTomme = (s) => ST.plan.forEach((d, i) => { if (d.paa[s] && !d[s]) { const k = kandidater(i, s)[0]; if (k) d[s] = k.r.id; } });
  Object.assign(H, {
    mpFortryd() { flyt(fortrydes, gentages, 'Der er ikke noget at fortryde.'); },
    mpGentag() { flyt(gentages, fortrydes, 'Der er ikke noget at gentage.'); },
    mpRyd() { if (!ST.plan.some(d => SLOTS.some(s => d[s]))) return toast('Madplanen er allerede tom.'); goer(() => ST.plan.forEach(d => SLOTS.forEach(s => { d[s] = null; }))); toast('Madplanen er ryddet'); },
    mpGenerer() { goer(nyPlan); toast('Ny madplan lavet'); },
    mpTrin(el) { const [k, d] = el.dataset.v.split(':'); saet(k, vaerdi(k) + Number(d)); },
    mpAlle(el) { // slå et felt til eller fra på alle dage. Når det slås til, får de tomme felter en ret.
      const s = el.dataset.v, til = !ST.plan.every(d => d.paa[s]);
      goer(() => { ST.plan.forEach(d => { d.paa[s] = til; if (!til) d[s] = null; }); if (til) fyldTomme(s); });
    },
    mpDagSlot(el) {
      const [i, s] = el.dataset.v.split(':'), d = ST.plan[Number(i)];
      goer(() => { d.paa[s] = !d.paa[s]; if (!d.paa[s]) d[s] = null; else fyldTomme(s); });
    },
    mpUdskift(el) { const [i, s] = el.dataset.v.split(':'); popup(Number(i), s); },
    mpVaelg(el) { const d = ST.plan[aaben.dag], s = aaben.s; lukArk(); goer(() => { d[s] = el.dataset.v; }); },
    mpFjern() { const d = ST.plan[aaben.dag], s = aaben.s; lukArk(); goer(() => { d[s] = null; }); }
  });
  document.addEventListener('change', e => { if (e.target.classList && e.target.classList.contains('mp-inp')) saet(e.target.dataset.k, e.target.value); });
  return { side };
})();
