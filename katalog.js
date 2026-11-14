// Kataloget over ingredienser (tabellerne «ingredienser» og «ingrediens_kategorier» i Supabase).
// Opskrifter lægger deres ingredienser her. Kategorien kommer fra kataloget, fra Claude eller fra dig. I appen hedder både «ingen kategori» og den rigtige kategori «Andet» (til det, der ikke passer andre steder) «Ikke sorteret», se katNavn i app.js.
const Katalog = (() => {
  let kat = [], ing = [], regler = [], hentet = false, idx = null;
  const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const rens = n => norm(String(n).replace(/\([^)]*\)/g, ' ').replace(/[.,;:]+$/, ''));
  const katId = navn => { const n = norm(navn), k = kat.find(x => x.navn_norm === (n === 'ikke sorteret' ? 'andet' : n)); return k ? k.id : null; }; // «Ikke sorteret» er kategorien «Andet»
  const ikkeSorteret = i => { if (!i.kategori_id) return true; const k = kat.find(c => c.id === i.kategori_id); return !k || k.navn_norm === 'andet'; };
  const sorteret = () => [...kat].sort((a, b) => a.raekkefolge - b.raekkefolge || a.navn.localeCompare(b.navn, 'da'));
  const unik = navne => [...new Set(navne.map(n => rens(simpel(n))).filter(Boolean))]; // i databasen står ingredienserne i simpel form
  async function hent() {
    [kat, ing, regler] = await Promise.all([api('ingrediens_kategorier?select=*'), api('ingredienser?select=*'), api('ingrediens_regler?select=*')]);
    hentet = true; idx = null;
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
    if (nye.length) idx = null;
    if (nye.length) ing.push(...await api('ingredienser?on_conflict=navn_norm', { method: 'POST', flet: 'ignorer', body: nye })); // de nye huskes med deres id
    for (const [id, k] of opdat) await api(`ingredienser?id=eq.${enc(id)}`, { method: 'PATCH', body: { kategori_id: k } });
  }
  // Navnet, en linje står under i kataloget: selve varen («finthakket løg» står under «løg»)
  const noegle = navn => rens(simpel(navn)) || norm(String(navn).replace(/[(),;]/g, ' '));
  // Ved «Gem» (opdatering 4c): lægger ingredienserne i kataloget og giver hver linje ingrediensens id og navn derfra.
  // Tilberedningen («finthakket») flyttes fra navnet til linjens forberedelse (f). En linje uden navn falder væk.
  async function knyt(liste, valg = {}, claude = {}) {
    const dele = liste.map(x => 'g' in x || Array.isArray(x.eller) ? null : { ...delIng(x.n), k: noegle(x.n) }); // en «eller»-linje har sine varer i forvejen
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
  // ---------- Læs et skrevet navn (Styr på ingredienser) ----------
  // Fire udfald. «kendt»: navnet, selve varen eller en regel passer præcist og bruges uden spørgsmål.
  // «taet»: præcis én ingrediens ligner (ental og flertal, ét bogstav fra, delt eller samlet ord, accenter). Import retter selv, de andre steder spørger.
  // «flere»: flere ligner. «ukendt»: ingen ligner. Ved «flere» og «ukendt» spørges der altid. Linjer med «og» eller «eller» rettes aldrig selv.
  // Svar: { udfald, via, slags, varer: [{ id, f }], lignende: [id, …] (højst 5, til spørgsmålet), ogEller }
  const ACCENT = { é: 'e', è: 'e', ê: 'e', ë: 'e', á: 'a', à: 'a', â: 'a', ä: 'a', í: 'i', ì: 'i', î: 'i', ï: 'i', ó: 'o', ò: 'o', ô: 'o', ú: 'u', ù: 'u', û: 'u', ü: 'u', ç: 'c', ñ: 'n' };
  const samlet = s => s.replace(/[éèêëáàâäíìîïóòôúùûüçñ]/g, c => ACCENT[c]).replace(/[\s-]+/g, '');
  const ENDELSER = ['e', 'r', 'er', 'en', 'et', 'ne', 'ene', 'erne', 's'];
  const boejning = (a, b) => { if (a.length > b.length) [a, b] = [b, a]; return a.length >= 3 && a !== b && b.startsWith(a) && ENDELSER.includes(b.slice(a.length)); };
  function afstand(a, b, max) { // bogstaver, der skal ændres, tilføjes, fjernes eller bytte plads
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let p2 = null, p = [...Array(b.length + 1).keys()];
    for (let i = 1; i <= a.length; i++) {
      const r = [i];
      for (let j = 1; j <= b.length; j++) {
        r[j] = Math.min(p[j] + 1, r[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (p2 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) r[j] = Math.min(r[j], p2[j - 2] + 1);
      }
      p2 = p; p = r;
    }
    return p[b.length];
  }
  // Det, et navn kan ligne: ingrediensernes navne og aliaser (en regel med én vare uden tilberedning)
  const kandidater = (liste, rl) => [...liste.map(i => ({ t: i.navn_norm, id: i.id })),
    ...rl.filter(r => r.slags === 'vare' && r.resultat.length === 1 && !r.resultat[0].f).map(r => ({ t: r.tekst, id: r.resultat[0].id }))];
  function taetPaa(k, c) {
    const a = samlet(k), b = samlet(c);
    if (a.replace(/\D/g, '') !== b.replace(/\D/g, '')) return null; // «cremefraiche 38 %» er ikke «cremefraiche 18 %»
    if (a === b) return 'ord';
    const ka = k.split(' '), cb = c.split(' ');
    if ((ka.length === cb.length && ka.some((w, i) => boejning(w, cb[i])) && ka.every((w, i) => w === cb[i] || boejning(w, cb[i]))) || boejning(a, b)) return 'boejning';
    if (Math.min(a.length, b.length) >= 5 && afstand(a, b, 1) <= 1) return 'stavning';
    return null;
  }
  const SMAAORD = ['til', 'med', 'og', 'eller', 'af', 'på', 'fra', 'som', 'uden', 'i'];
  function lignendeAf(k, alle, foerst) { // til spørgsmålet: dem, der står i navnet, ligner det eller deler et ord med det
    const a = samlet(k), ord = k.split(' ').filter(w => w.length >= 3 && !SMAAORD.includes(w)), pt = new Map();
    for (const c of alle) {
      if (foerst.includes(c.id)) continue;
      const b = samlet(c.t), et = c.t.length >= 4 && !c.t.includes(' ');
      let p = null;
      if (c.t.length >= 3 && ((' ' + k + ' ').includes(' ' + c.t + ' ') || a.endsWith(b) || a.startsWith(b) || b.endsWith(a))) p = 0;
      else if (et && ord.some(w => w.startsWith(c.t) || w.endsWith(c.t) || boejning(w, c.t))) p = 0; // «basilikumblade», «tomater»
      else if (Math.min(a.length, b.length) >= 4 && afstand(a, b, 2) <= 2) p = 1;
      else if (et && c.t.length >= 5 && ord.some(w => afstand(w, c.t, 1) <= 1)) p = 1; // «ruccola»
      else if (c.t.split(' ').some(w => ord.includes(w))) p = 2;
      if (p != null && (!pt.has(c.id) || pt.get(c.id)[0] > p)) pt.set(c.id, [p, -c.t.length]);
    }
    return [...foerst, ...[...pt].sort((x, y) => x[1][0] - y[1][0] || x[1][1] - y[1][1]).map(x => x[0])].slice(0, 5);
  }
  function laes(tekst, liste = ing, rl = regler) {
    const n = rens(tekst), d = delIng(n), k = rens(d.n) || n, f = k === n ? '' : d.f;
    const medF = (varer, ekstra) => varer.map(v => { const ff = [ekstra, v.f].filter(Boolean).join(', '); return { id: v.id, ...(ff && { f: ff }) }; });
    for (const [t, ff] of k === n ? [[n, '']] : [[n, ''], [k, f]]) {
      const r = rl.find(x => x.tekst === t);
      if (r) return { udfald: 'kendt', via: 'regel', slags: r.slags, regel: r, varer: medF(r.resultat, ff), lignende: [] };
      const i = liste.find(x => x.navn_norm === t);
      if (i) return { udfald: 'kendt', via: 'navn', slags: 'vare', varer: medF([{ id: i.id }], ff), lignende: [] };
    }
    const ogEller = /(^| )(og|eller)( |$)|[,&+/]/.test(k), alle = kandidater(liste, rl), grund = new Map();
    if (!ogEller) for (const c of alle) { const g = taetPaa(k, c.t); if (g && !grund.has(c.id)) grund.set(c.id, g); }
    const ids = [...grund.keys()], lignende = lignendeAf(k, alle, ids);
    if (ids.length === 1) return { udfald: 'taet', via: grund.get(ids[0]), slags: 'vare', varer: medF([{ id: ids[0] }], f), lignende, ogEller };
    return { udfald: ids.length ? 'flere' : 'ukendt', varer: [], lignende, ogEller };
  }
  const kategorier = () => sorteret().map(katNavn);

  // ---------- En linje læst på id (Styr på ingredienser, fase 2) ----------
  // Én regel for alle: «Hvad kan jeg lave?», madplanen, «træk fra» og søgningen bruger funktionerne herunder.
  // Er kataloget ikke hentet (fx uden net første gang), bruges navnet på linjen, som det står.
  const sikr = () => hentet ? Promise.resolve() : hent().catch(e => console.error(e));
  function I() { // opslag: id -> ingrediens, fællesnavn -> varianter, id -> aliaser, skrevet tekst -> varer
    if (idx) return idx;
    idx = { id: new Map(ing.map(i => [i.id, i])), var: new Map(), alias: new Map(), tekst: new Map() };
    for (const i of ing) if (i.faelles_id) { if (!idx.var.has(i.faelles_id)) idx.var.set(i.faelles_id, []); idx.var.get(i.faelles_id).push(i.id); }
    for (const r of regler) if (r.slags === 'vare' && r.resultat.length === 1 && !r.resultat[0].f) { const id = r.resultat[0].id; if (!idx.alias.has(id)) idx.alias.set(id, []); idx.alias.get(id).push(r.tekst); }
    return idx;
  }
  // Varerne på en linje: «eller»-listen, linjens id, eller (uden id) det, navnet præcis svarer til som navn, vare eller regel
  function varerAf(x) {
    if (!x || 'g' in x) return [];
    if (Array.isArray(x.eller)) return x.eller.filter(id => I().id.has(id));
    if (x.id && I().id.has(x.id)) return [x.id];
    const t = String(x.n || ''), ix = I();
    if (!ix.tekst.has(t)) {
      const n = rens(t), k = noegle(t), r = regler.find(r => (r.tekst === n || r.tekst === k) && (r.slags === 'vare' || r.slags === 'eller')), i = !r && ing.find(i => i.navn_norm === n || i.navn_norm === k);
      ix.tekst.set(t, r ? r.resultat.map(v => v.id) : i ? [i.id] : []);
    }
    return ix.tekst.get(t);
  }
  // Navnet fra kataloget («frisk timian», «timian», «smør eller margarine»). Kendes en vare ikke, bruges navnet på linjen.
  function navn(x) {
    const v = varerAf(x);
    return v.length && (x.id || Array.isArray(x.eller)) ? v.map(id => I().id.get(id).navn).join(' eller ') : x.n;
  }
  const medNavn = x => x && !('g' in x) ? { ...x, n: navn(x) } : x;
  // Det, der dækker en vare: varen selv og, er den et fællesnavn, dets varianter. Tørret timian dækker ikke frisk timian.
  const daekker = id => [id, ...(I().var.get(id) || [])];
  // Er linjen opfyldt af det, der er derhjemme (et Set af id'er)? En «eller»-linje er opfyldt af én af varerne.
  // En linje uden kendt vare er opfyldt, hvis det samme navn står derhjemme.
  const opfyldt = (x, har) => { const v = varerAf(x); return v.length ? v.some(id => daekker(id).some(d => har.has(d))) : [...har].some(id => { const i = I().id.get(id); return i && i.navn_norm === noegle(x.n); }); };
  const noegleAf = x => varerAf(x).join('|') || noegle(x.n); // samme vare tæller kun én gang som manglende
  // Ord, en linje kan findes på: linjens navn, varerne, deres varianter og fællesnavn, og aliaser
  function soegeord(x) {
    const ud = new Set([norm(x.n)]), ids = new Set();
    for (const id of varerAf(x)) { daekker(id).forEach(d => ids.add(d)); const f = I().id.get(id).faelles_id; if (f) ids.add(f); }
    for (const id of ids) { const i = I().id.get(id); if (i) ud.add(i.navn_norm); (I().alias.get(id) || []).forEach(t => ud.add(t)); }
    return [...ud];
  }
  // Er linjen et krydderi? Kategorien kommer fra kataloget. Ukendte ingredienser tæller ikke som krydderier.
  const krydderi = x => { const v = varerAf(x); return !!v.length && v.every(id => { const k = kat.find(c => c.id === I().id.get(id).kategori_id); return !!k && k.navn_norm === 'krydderier'; }); };

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
  return { hent, sikr, rens, noegle, spoerg, knyt, laes, kategorier, sorterAndet, laesKat, varerAf, navn, medNavn, daekker, opfyldt, noegleAf, soegeord, krydderi };
})();
