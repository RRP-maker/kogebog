// Kataloget over ingredienser (tabellerne «ingredienser» og «ingrediens_kategorier» i Supabase).
// Opskrifter lægger deres ingredienser her. Kategorien kommer fra kataloget, fra Claude eller fra dig. I appen hedder både «ingen kategori» og den rigtige kategori «Andet» (til det, der ikke passer andre steder) «Ikke sorteret», se katNavn i app.js.
const Katalog = (() => {
  let kat = [], ing = [];
  const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const rens = n => norm(String(n).replace(/\([^)]*\)/g, ' ').replace(/[.,;:]+$/, ''));
  const katId = navn => { const n = norm(navn), k = kat.find(x => x.navn_norm === (n === 'ikke sorteret' ? 'andet' : n)); return k ? k.id : null; }; // «Ikke sorteret» er kategorien «Andet»
  const ikkeSorteret = i => { if (!i.kategori_id) return true; const k = kat.find(c => c.id === i.kategori_id); return !k || k.navn_norm === 'andet'; };
  const sorteret = () => [...kat].sort((a, b) => a.raekkefolge - b.raekkefolge || a.navn.localeCompare(b.navn, 'da'));
  const unik = navne => [...new Set(navne.map(n => rens(simpel(n))).filter(Boolean))]; // i databasen står ingredienserne i simpel form
  async function hent() {
    [kat, ing] = await Promise.all([api('ingrediens_kategorier?select=*'), api('ingredienser?select=*')]);
    if (!kat.some(k => k.navn_norm === 'andet')) { // «Andet» er en rigtig kategori, som altid skal findes (står sidst)
      try { await api('ingrediens_kategorier?on_conflict=navn_norm', { method: 'POST', flet: 'ignorer', body: { navn: 'Andet', navn_norm: 'andet', raekkefolge: 1000 } }); kat = await api('ingrediens_kategorier?select=*'); }
      catch (e) { console.error(e); }
    }
  }
  // Gæt ud fra kendte ingredienser: «rødløg» og «røde løg» ligner «løg». Længste match vinder.
  function gaet(n) {
    let bedst = null;
    for (const i of ing) {
      if (!i.kategori_id || i.navn_norm.length < 3) continue;
      if ((n === i.navn_norm || (' ' + n + ' ').includes(' ' + i.navn_norm + ' ') || n.endsWith(i.navn_norm)) && (!bedst || i.navn_norm.length > bedst.navn_norm.length)) bedst = i;
    }
    return bedst ? bedst.kategori_id : null;
  }
  const ukendte = navne => unik(navne).filter(n => !ing.some(i => i.navn_norm === n) && !gaet(n));

  // Ved «Gem» i en opskrift: spørg om kategorier til ingredienser, appen ikke kender. Springer man over, bliver de «Ikke sorteret».
  async function spoerg(navne) {
    await hent();
    const uk = ukendte(navne);
    if (!uk.length) return {};
    return new Promise(svar => {
      const valg = sorteret().map(k => `<option value="${k.id}">${esc(katNavn(k))}</option>`).join('');
      const d = ark(`<h2>Hvilken kategori?</h2><small>Vælg en kategori til hver ny ingrediens. Springer du over, står de under «Ikke sorteret».</small>
        ${uk.map((n, i) => `<label for="kn${i}">${esc(n)}</label><select id="kn${i}" class="felt felt-m" data-n="${i}"><option value="">${IKKE_SORTERET}</option>${valg}</select>`).join('')}
        <div class="rakke"><button type="button" class="knap" data-kat="spring">Spring over</button><button type="button" class="knap gem" data-tpid="gem" data-kat="gem">Gem</button></div>`);
      d.addEventListener('click', e => {
        const a = e.target.closest('[data-kat]');
        if (!a && !e.target.closest('.ark-bag')) return;
        const ud = {};
        if (a && a.dataset.kat === 'gem') d.querySelectorAll('select[data-n]').forEach(s => { if (s.value) ud[uk[s.dataset.n]] = s.value; });
        lukArk(); svar(ud);
      });
    });
  }
  // Lægger ingredienserne i kataloget. valg: dine valg (navn -> kategori-id). claude: Claudes forslag (navn -> kategorinavn).
  async function laeg(navne, valg = {}, claude = {}) {
    await hent();
    const nye = [], opdat = [];
    for (const n of unik(navne)) {
      const fund = ing.find(i => i.navn_norm === n), ck = claude[n] ? katId(claude[n]) : null, k = valg[n] || ck;
      if (fund) { if (!fund.kategori_id && k) opdat.push([fund.id, k]); continue; }
      nye.push({ navn: n, navn_norm: n, kategori_id: k || gaet(n) || null });
    }
    if (nye.length) ing.push(...await api('ingredienser?on_conflict=navn_norm', { method: 'POST', flet: 'ignorer', body: nye })); // de nye huskes med deres id
    for (const [id, k] of opdat) await api(`ingredienser?id=eq.${enc(id)}`, { method: 'PATCH', body: { kategori_id: k } });
  }
  // Navnet, en linje står under i kataloget: selve varen («finthakket løg» står under «løg»)
  const noegle = navn => rens(simpel(navn)) || norm(String(navn).replace(/[(),;]/g, ' '));
  // Ved «Gem» (opdatering 4c): lægger ingredienserne i kataloget og giver hver linje ingrediensens id og navn derfra.
  // Tilberedningen («finthakket») flyttes fra navnet til linjens forberedelse (f). En linje uden navn falder væk.
  async function knyt(liste, valg = {}, claude = {}) {
    const dele = liste.map(x => 'g' in x ? null : { ...delIng(x.n), k: noegle(x.n) });
    await laeg(dele.filter(d => d && d.k).map(d => d.k), valg, claude);
    if (dele.some(d => d && d.k && !ing.some(i => i.navn_norm === d.k))) await hent(); // en anden enhed lagde den ind samtidig
    return liste.map((x, nr) => {
      const d = dele[nr];
      if (!d) return x;
      if (!d.k) return null;
      const i = ing.find(c => c.navn_norm === d.k);
      if (!i) throw new Error('Ingrediensen kom ikke i kataloget: ' + x.n);
      const f = [d.f, x.f].filter(Boolean).join(', ');
      return { m: x.m, e: x.e, n: i.navn, id: i.id, ...(f && { f }) };
    }).filter(Boolean);
  }
  const kategorier = () => sorteret().map(katNavn);
  // Er ingrediensen et krydderi? Kategorien kommer fra kataloget. Ukendte ingredienser tæller ikke som krydderier.
  const erKrydderi = n => { const i = ing.find(x => x.navn_norm === rens(simpel(n)) || x.navn_norm === norm(n)); const k = i && kat.find(c => c.id === i.kategori_id); return !!k && k.navn_norm === 'krydderier'; };

  // Knappen i Hvad kan jeg lave?: bed Claude om at sortere og rette ingredienserne
  let andre = [], efterSortering = null, besked = '', modus = 'alle'; // modus: «alle» (ret alle kategorier) eller «andet» (kun dem, der er «Ikke sorteret»)
  const MODUSNAVN = { alle: 'Ret alle kategorier', andet: 'Ret kun ikke sorterede' };
  function bygBesked() {
    const alle = [...ing].sort((a, b) => a.navn.localeCompare(b.navn, 'da'));
    andre = modus === 'alle' ? alle : alle.filter(ikkeSorteret);
    const regel = modus === 'alle'
      ? 'Står en kategori i parentes, er det den nuværende. Tag KUN ingredienser med, hvor kategorien skal ændres, eller hvor navnet skal rettes eller gøres simplere.'
      : 'Tag alle ingredienserne med.';
    besked = `Sorter og ret disse ingredienser til min kogebog-app.

Brug præcis en af disse kategorier: ${kategorier().join(', ')}.
Passer ingen, så skriv "Ikke sorteret".
Ret også stavefejl i navnet, fx "grønsagsbouillon" -> "grøntsagsbouillon".
Gør navnet simpelt: det er kun selve varen. Skriv "løg", ikke "hakket løg" eller "løg skåret i tynde skiver". Er det et rigtigt produkt, som man køber sådan, så behold navnet, fx "hakkede tomater" eller "hakket svinekød".
Skriv ingen forkortelser i navne. Skriv "hakket", ikke "hakk", og "revet", ikke "rev".
Skriv det rettede navn i "rettet". Er navnet rigtigt, så skriv det samme navn igen.
${regel}

Svar KUN med JSON i en kodeblok, uden anden tekst, i præcis dette format (ingrediensen som nøgle):
{
  "gulerødder": { "kategori": "Grøntsager", "rettet": "gulerødder" },
  "grønsagsbouillon": { "kategori": "Olie, sauce og bouillon", "rettet": "grøntsagsbouillon" }
}

Ingredienser:
${andre.map(i => '- ' + i.navn + (modus === 'alle' && i.kategori_id ? ` (${katNavn(kat.find(c => c.id === i.kategori_id))})` : '')).join('\n')}
`;
  }
  function visBesked() {
    bygBesked();
    const kodet = encodeURIComponent(besked), n = andre.length, uden = ing.filter(ikkeSorteret).length;
    $('#katClaude').href = 'https://claude.ai/new' + (kodet.length < 7000 ? '?q=' + kodet : '');
    $('#katantal').textContent = `${n} ${n === 1 ? 'ingrediens' : 'ingredienser'} sendes. ${uden} er ikke sorteret.`;
    $('#katModus').textContent = MODUSNAVN[modus];
  }
  async function sorterAndet(efter) {
    await hent(); efterSortering = efter; modus = 'alle';
    if (!ing.length) { toast('Der er ingen ingredienser endnu.'); return; }
    const d = ark(`<div class="ark-top"><h2>Sortér og ret med Claude</h2>
        <button type="button" class="knap mini modusknap" id="katModus" data-tpid="kat-modus" data-h="katModus"></button></div>
      <small id="katantal"></small>
      <ol class="trin vejledning">
        <li>Tryk her, så kopieres beskeden til Claude.
          <div class="rakke venstre"><button type="button" class="knap mini" data-tpid="kat-kopier" data-h="katKopier">${ik('gnist')} Kopiér besked</button></div></li>
        <li>Åbn Claude, og sæt beskeden ind, hvis feltet er tomt.
          <div class="rakke venstre"><a class="knap mini" data-tpid="kat-aabn" id="katClaude" href="https://claude.ai/new" target="_blank" rel="noopener">Åbn Claude ›</a></div></li>
        <li>Kopiér Claudes svar, og sæt det ind her:
          <textarea id="katsvar" class="felt-s" rows="1" data-husk="katSvar" placeholder='{ "gulerødder": { "kategori": "Grøntsager" } }' aria-label="Claudes svar"></textarea>
          <div class="felt-knapper"><button type="button" class="knap mini" data-tpid="kat-saet" data-h="saetInd" data-v="katsvar">Sæt ind</button>
            <span class="hoejre">${Ikoner.rund('fortryd', 'Fortryd', 'data-tpid="kat-fortryd" data-h="fortrydRyd" data-v="katsvar" hidden')}<button type="button" class="knap mini slet" data-tpid="kat-ryd" data-h="rydFelt" data-v="katsvar">Ryd</button></span></div></li>
      </ol>
      <div id="arkfejl"></div>
      <div class="rakke"><button type="button" class="knap mini annuller" data-tpid="annuller" data-h="lukArk">Annuller</button><button type="button" class="knap mini gem" data-tpid="gem" data-h="katGem">Gem kategorier</button></div>`);
    $('#katsvar', d).value = lager.hent('katSvar', '');
    visBesked();
    $('.ark-bag', d).addEventListener('click', lukArk);
  }
  // Læser Claudes svar: { "navn": "Kategori" } eller en liste af { navn, kategori }
  function laesKat(tekst) {
    const s = String(tekst).replace(/[“”]/g, '"'), a = s.search(/[{[]/), b = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
    if (a === -1 || b <= a) return null;
    let j; try { j = JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
    const ud = {}; // navn -> { kat, rettet }
    const saet = (navn, kat, rettet) => { if (kat || rettet) ud[rens(navn)] = { kat: kat ? String(kat) : null, rettet: rettet ? rens(rettet) : null }; };
    if (Array.isArray(j)) j.forEach(x => { if (x && (x.navn || x.ingrediens)) saet(x.navn || x.ingrediens, x.kategori, x.rettet); });
    else Object.entries(j).forEach(([n, v]) => { if (typeof v === 'string') saet(n, v); else if (v && typeof v === 'object') saet(n, v.kategori, v.rettet); });
    return ud;
  }
  // Skema over alle ingredienser i databasen: kategori og ingredienserne under den
  function oversigtHtml() {
    const grupper = new Map();
    for (const c of sorteret()) grupper.set(c.id, { navn: katNavn(c), liste: [] });
    const ak = kat.find(c => c.navn_norm === 'andet'), andet = (ak && grupper.get(ak.id)) || { navn: IKKE_SORTERET, liste: [] };
    for (const i of ing) (grupper.get(i.kategori_id) || andet).liste.push(i.navn);
    const alle = [...grupper.values(), andet].filter(g => g.liste.length);
    return alle.length ? `<table class="ing-tabel tekst-s" data-tpid="ing-tabel"><thead><tr><th>Kategori</th><th>Ingredienser</th></tr></thead><tbody>${alle.map(g =>
      `<tr><th scope="row">${esc(g.navn)}<span>${g.liste.length}</span></th><td>${g.liste.sort((x, y) => x.localeCompare(y, 'da')).map(esc).join(', ')}</td></tr>`).join('')}</tbody></table>`
      : '<p class="tomt">Der er ingen ingredienser i databasen endnu.</p>';
  }
  Object.assign(H, {
    async ingOversigt() {
      await hent();
      const d = ark(`<h2>Ingredienser i databasen</h2><small>${ing.length} ${ing.length === 1 ? 'ingrediens' : 'ingredienser'} i alt.</small>
        ${oversigtHtml()}
        <div class="rakke">${Ikoner.rund('luk', 'Luk', 'data-tpid="luk" data-h="lukArk"')}</div>`);
      $('.ark-bag', d).addEventListener('click', lukArk);
    },
    katModus() {
      if (modus === 'alle' && !ing.some(ikkeSorteret)) { toast('Alt er sorteret. Der er ikke noget at rette.'); return; }
      modus = modus === 'alle' ? 'andet' : 'alle'; visBesked();
    },
    async katKopier() {
      let ok = false;
      try { await navigator.clipboard.writeText(besked); ok = true; } catch (e) { ok = await kopier(besked); }
      ok ? toast('Beskeden er kopieret') : fejlbesked('Beskeden blev ikke kopieret. Tryk på knappen igen.');
    },
    async katGem() {
      const svar = laesKat($('#katsvar').value);
      if (!svar || !Object.keys(svar).length) { $('#arkfejl').innerHTML = '<div class="fejlboks">Svaret kan ikke læses. Kopiér hele Claudes svar, og prøv igen.</div>'; return; }
      // Navne og kategorier rettes med samme funktion som Ingrediensværktøjet: alt eller intet, med en sikkerhedskopi først,
      // og opskrifternes linjer følger med. Får to ingredienser samme navn, lægges de sammen.
      const ret = [];
      for (const i of andre) {
        const r = svar[i.navn_norm];
        if (!r) continue;
        const navn = r.rettet ? rens(simpel(r.rettet)) : '', e = { id: i.id }; // navnet gøres simpelt, også hvis Claude glemmer det
        if (navn && navn !== i.navn_norm) e.navn = navn;
        if (r.kat && katId(r.kat) && (modus === 'alle' || ikkeSorteret(i))) e.kategori = r.kat; // «Ret alle kategorier» må også ændre en kategori, der er sat
        if (e.navn || e.kategori) ret.push(e);
      }
      let o;
      try { o = await IngVaerktoej.ret({ ingredienser: ret }, 'før «Sortér og ret»'); }
      catch (e) { console.error(e); $('#arkfejl').innerHTML = `<div class="fejlboks">${esc(e.vis || 'Det blev ikke gemt, og intet er ændret. Tjek internettet, og prøv igen.')}</div>`; return; }
      const sat = o.kategori, rettet = o.omdoebt.length + o.sammen.reduce((n, g) => n + g.fra.length, 0);
      lager.gem('katSvar', '');
      lukArk();
      const dele = [sat && `${sat} sorteret`, rettet && `${rettet} navne rettet`].filter(Boolean);
      toast(dele.length ? dele.join(', ') : 'Ingen af svarene passede');
      if (efterSortering) efterSortering();
    }
  });
  return { hent, rens, noegle, spoerg, knyt, kategorier, sorterAndet, laesKat, erKrydderi };
})();
