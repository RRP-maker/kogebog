// Ingrediensværktøjet (opdatering 4c). Ligger i Værkstedet: #/vaerksted/ingredienser.
// Det rydder op i kataloget: dubletter lægges sammen, navne rettes, og tilberedningen («finthakket») flyttes fra navnet til opskriftens linje (f).
// Gangen: kopiér listen til Claude, sæt Claudes rettelser ind, se forhåndsvisningen, gem. Alt regnes ud her (beregn) og sendes som én pakke til
// databasefunktionen «ingrediens_ret» (supabase/ingredienser.sql), som først gemmer en kopi og så retter det hele eller intet.
const IngVaerktoej = (() => {
  let D = null, R = null, valg = {}, kopiListe = [], rettelse = null;
  const aabne = new Set(['linjer']);
  const norm = s => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  const KORT = 8; // så mange tegn af et id står i listen til Claude
  const hentAlt = async () => {
    const [ing, kat, hj, ops] = await Promise.all([api('ingredienser?select=*'), api('ingrediens_kategorier?select=*'), api('hjemme?select=id,ingrediens_id'), api('opskrifter?select=id,titel,ingredienser&order=titel')]);
    return { ing, kat, hj, ops };
  };
  // Et id fra rettelserne er de første tegn af det rigtige id. Det skal passe på præcis én.
  const findKort = (liste, kort) => { const k = String(kort ?? '').toLowerCase().trim(); if (k.length < 6) return null; const m = liste.filter(x => x.id === k || x.id.startsWith(k)); return m.length === 1 ? m[0] : null; };
  const ugyldigt = n => !n || /[(),;]/.test(n);

  // Regner ud, hvad rettelserne gør. Ændrer intet. data: { ing, kat, hj, ops }. rettelse: { ingredienser: [...], linjer: [...] }. svar: dine svar på tvivl (nøgle -> true/false).
  // Regler: to ingredienser med samme navn lægges sammen. Hver linje i hver opskrift får id og navn fra kataloget. En linje uden ingrediens i kataloget giver en ny ingrediens.
  function beregn(data, rettelse = {}, svar = {}) {
    const { ing, kat, hj, ops } = data, fejl = [], tvivl = [];
    const katAf = navn => { const n = norm(navn); return kat.find(k => k.navn_norm === (n === 'ikke sorteret' ? 'andet' : n)); };
    const derhjemme = new Set(hj.map(h => h.ingrediens_id));
    const spoerg = (noegle, r, forslag) => { tvivl.push({ noegle, tekst: String(r.tvivl), forslag, svar: svar[noegle] }); return svar[noegle] === true; };

    // 1. Katalogets rettelser. plan: hvad hver ingrediens ender som
    const plan = new Map(ing.map(i => [i.id, { i, navn: i.navn_norm, kat: i.kategori_id || null, katSat: false, f: '', slet: false }]));
    const set = new Set();
    for (const r of Array.isArray(rettelse.ingredienser) ? rettelse.ingredienser : []) {
      const i = r && findKort(ing, r.id);
      if (!i) { fejl.push(`Ingrediensen med id «${r && r.id}» findes ikke.`); continue; }
      if (set.has(i.id)) { fejl.push(`«${i.navn}» står to gange i rettelserne.`); continue; }
      set.add(i.id);
      const n = r.navn != null ? norm(r.navn) : null, k = r.kategori != null ? katAf(r.kategori) : null;
      if (n != null && ugyldigt(n)) { fejl.push(`Navnet «${r.navn}» kan ikke bruges. Et navn må ikke være tomt eller have komma eller parentes.`); continue; }
      if (r.kategori != null && !k) { fejl.push(`Kategorien «${r.kategori}» findes ikke.`); continue; }
      if (r.tvivl && !spoerg('i:' + i.id, r, r.slet ? `«${i.navn}» slettes` : `«${i.navn}» bliver til «${n || i.navn}»${r.f ? `, og «${r.f}» flyttes til linjen` : ''}${k ? ` (${katNavn(k)})` : ''}`)) continue;
      const p = plan.get(i.id);
      if (r.slet) p.slet = true;
      if (n) p.navn = n;
      if (k) { p.kat = k.id; p.katSat = true; }
      if (r.f) p.f = String(r.f).trim();
    }
    // 2. Samme navn = samme ingrediens. Den, der allerede hedder sådan, bliver. Ellers den, der står derhjemme.
    const grupper = new Map();
    for (const p of plan.values()) if (!p.slet) { if (!grupper.has(p.navn)) grupper.set(p.navn, []); grupper.get(p.navn).push(p); }
    for (const [navn, g] of grupper) {
      const v = g.find(p => p.i.navn_norm === navn) || g.find(p => derhjemme.has(p.i.id)) || g[0];
      if (!v.katSat) { const m = g.find(p => p.katSat) || (!v.kat && g.find(p => p.kat)); if (m) v.kat = m.kat; }
      g.forEach(p => { p.vinder = v; });
    }
    // 3. Rettelser til enkelte linjer i opskrifter
    const linjeRet = new Map();
    for (const r of Array.isArray(rettelse.linjer) ? rettelse.linjer : []) {
      const [ok, nr] = String(r && r.linje).split(':'), o = findKort(ops, ok), x = o && ingListe(o)[Number(nr)];
      if (!x || 'g' in x) { fejl.push(`Linjen «${r && r.linje}» findes ikke.`); continue; }
      if (r.var != null && norm(r.var) !== norm(x.n)) { fejl.push(`Linjen «${r.var}» i «${o.titel}» er ændret, siden listen blev kopieret. Kopiér listen igen.`); continue; }
      if (r.navn != null && ugyldigt(norm(r.navn))) { fejl.push(`Navnet «${r.navn}» kan ikke bruges. Et navn må ikke være tomt eller have komma eller parentes.`); continue; }
      if (r.kategori != null && !katAf(r.kategori)) { fejl.push(`Kategorien «${r.kategori}» findes ikke.`); continue; }
      const ny = { m: 'm' in r ? tal(r.m) : x.m, e: r.e != null ? String(r.e).trim() : x.e, n: r.navn != null ? norm(r.navn) : x.n, f: r.f != null ? String(r.f).trim() : x.f };
      if (r.tvivl && !spoerg('l:' + o.id + ':' + Number(nr), r, `«${visIng(x)}» i «${o.titel}» bliver til «${visIng(ny)}»`)) continue;
      linjeRet.set(o.id + ':' + Number(nr), r);
    }
    // 4. Hver linje i hver opskrift
    const glNavn = new Map(ing.map(i => [i.navn_norm, i.id])), nye = new Map();
    const maal = navn => { // ingrediensen med det navn efter rettelserne. Findes den ikke, oprettes den.
      const g = grupper.get(navn);
      if (g) return g[0].vinder;
      if (!nye.has(navn)) nye.set(navn, { ny: true, i: { id: crypto.randomUUID() }, navn, kat: null });
      return nye.get(navn);
    };
    const opskrifter = [], linjer = [];
    let antalLinjer = 0, uden = 0, knyttet = 0;
    for (const o of ops) {
      const raa = Array.isArray(o.ingredienser) ? o.ingredienser : [], liste = ingListe(o);
      let aendret = liste.length !== raa.length || !Array.isArray(o.ingredienser);
      const ny = liste.map((x, nr) => {
        if ('g' in x) return x;
        antalLinjer++;
        const kendt = !!x.id && plan.has(x.id), r = linjeRet.get(o.id + ':' + nr), k = Katalog.noegle(x.n);
        if (!kendt) uden++;
        const gl = plan.get(x.id) || plan.get(glNavn.get(k)) || plan.get(glNavn.get(norm(x.n)));
        let p, f;
        if (r && r.navn != null) { p = maal(norm(r.navn)); f = x.f || ''; if (p.ny && r.kategori) p.kat = katAf(r.kategori).id; }
        else if (gl && gl.slet) { fejl.push(`«${gl.i.navn}» bruges i «${o.titel}» og kan ikke slettes.`); return x; }
        else if (!gl && !k) { aendret = true; return null; } // en linje uden navn falder væk
        else { p = gl ? gl.vinder : maal(k); f = [...new Set([kendt ? '' : delIng(x.n).f, x.f, gl ? gl.f : ''].filter(Boolean))].join(', '); }
        if (r && r.f != null) f = String(r.f).trim();
        const linje = { m: r && 'm' in r ? tal(r.m) : x.m, e: r && r.e != null ? String(r.e).trim() : x.e, n: p.navn, id: p.i.id, ...(f && { f }) };
        if (['m', 'e', 'n', 'id', 'f'].some(a => (linje[a] ?? '') !== (x[a] ?? '')) || typeof raa[nr] !== 'object') {
          aendret = true;
          if (visIng(x) === visIng(linje)) knyttet++; else linjer.push({ opskrift: o.titel, foer: visIng(x), efter: visIng(linje) });
        }
        return linje;
      }).filter(Boolean);
      if (aendret) opskrifter.push({ id: o.id, ingredienser: ny });
    }
    for (const p of plan.values()) if (p.slet && derhjemme.has(p.i.id)) fejl.push(`«${p.i.navn}» står i «Derhjemme» og kan ikke slettes.`);
    // 5. Pakken til databasen og oversigten til forhåndsvisningen
    const flet = [], ret = [], sammen = [], omdoebt = [];
    let kategori = 0;
    for (const [navn, g] of grupper) {
      const v = g[0].vinder, nytNavn = v.i.navn_norm !== navn, nyKat = (v.i.kategori_id || null) !== v.kat;
      g.forEach(p => { if (p !== v) flet.push({ fra: p.i.id, til: v.i.id }); });
      if (g.length > 1) sammen.push({ til: navn, fra: g.map(p => p.i.navn).filter(n => n !== navn) });
      else if (nytNavn) omdoebt.push({ fra: v.i.navn, til: navn });
      if (nytNavn || nyKat) ret.push({ id: v.i.id, navn, navn_norm: navn, kategori_id: v.kat });
      if (nyKat) kategori++;
    }
    const slettes = [...plan.values()].filter(p => p.slet), da = (a, b) => a.localeCompare(b, 'da');
    const payload = { antal: ing.length, flet, slet: slettes.map(p => p.i.id), ret, ny: [...nye.values()].map(p => ({ id: p.i.id, navn: p.navn, navn_norm: p.navn, kategori_id: p.kat })), opskrifter };
    return { fejl: [...new Set(fejl)], tvivl, uafgjort: tvivl.filter(t => t.svar == null).length, payload,
      tom: !flet.length && !payload.slet.length && !ret.length && !payload.ny.length && !opskrifter.length,
      oversigt: { sammen: sammen.sort((a, b) => da(a.til, b.til)), omdoebt: omdoebt.sort((a, b) => da(a.fra, b.fra)), kategori, slettet: slettes.map(p => p.i.navn).sort(da), nye: [...nye.keys()].sort(da),
        linjer, knyttet, antalLinjer, uden, foer: ing.length, efter: ing.length - flet.length - slettes.length + nye.size } };
  }
  // Ingredienser, der ligner hinanden (ental og flertal): «porre» og «porrer». Kun en hjælp til at finde dubletter.
  function ligner(ing) {
    const g = new Map();
    for (const i of ing) { const s = stamme(i.navn_norm); if (!g.has(s)) g.set(s, []); g.get(s).push(i.navn); }
    return [...g.values()].filter(x => x.length > 1);
  }

  // Listen til Claude: reglerne, formatet og alle ingredienser og linjer
  function eksport(data) {
    const { ing, kat, hj, ops } = data, derhjemme = new Set(hj.map(h => h.ingrediens_id)), antal = new Map(), linjer = [];
    const glNavn = new Map(ing.map(i => [i.navn_norm, i.id])), iId = new Set(ing.map(i => i.id));
    for (const o of ops) {
      const set = new Set();
      ingListe(o).forEach((x, nr) => {
        if ('g' in x) return;
        const id = iId.has(x.id) ? x.id : glNavn.get(Katalog.noegle(x.n)) || glNavn.get(norm(x.n));
        if (id) set.add(id);
        linjer.push(`${o.id.slice(0, KORT)}:${nr} | ${visIng(x)} | ${o.titel}${id ? '' : ' | (ikke i kataloget)'}`);
      });
      set.forEach(id => antal.set(id, (antal.get(id) || 0) + 1));
    }
    const kn = id => katNavn(kat.find(k => k.id === id));
    return `Ryd op i ingredienserne i min kogebog-app.

Regler:
- En ingrediens er kun selve varen, fx "løg". Tilberedningen ("finthakket", "i tern", "til stegning") er ikke en del af navnet. Skriv den i "f".
- Et produkt, man køber sådan, er sin egen ingrediens, fx "hakkede tomater" og "hakket oksekød".
- Dubletter lægges sammen ved at give dem præcis samme "navn": ental og flertal, stavemåder og det samme med andre ord.
- Navne skrives med små bogstaver, uden komma og parentes.
- Brug kun disse kategorier: ${[...kat].sort((a, b) => a.raekkefolge - b.raekkefolge).map(katNavn).join(', ')}.
- Er du i tvivl om en rettelse, så skriv et kort spørgsmål i "tvivl". Så afgør jeg den.
- Tag kun det med, der skal ændres.

Svar KUN med JSON i en kodeblok, uden anden tekst, i præcis dette format:
{
  "ingredienser": [
    { "id": "1394f7f6", "navn": "agurk" },
    { "id": "ea41ceaa", "navn": "agurk", "f": "i julienne" },
    { "id": "a6aa4320", "kategori": "Krydderier" },
    { "id": "592ac129", "slet": true },
    { "id": "1821989d", "navn": "kaffirlimeblade", "tvivl": "Er kaffirblade det samme som kaffirlimeblade?" }
  ],
  "linjer": [
    { "linje": "9dd34573:2", "var": "stort brunt løg", "navn": "løg", "f": "stort" }
  ]
}
"id" er id'et fra listen. "f" på en ingrediens flyttes til de linjer i opskrifterne, der bruger den.
"slet" må kun bruges, når ingrediensen ikke er i nogen opskrift og ikke står derhjemme.
"linjer" retter én linje i en opskrift. "var" er navnet, som det står nu. Du kan også rette "m" (mængde) og "e" (enhed).

Ingredienser (id | navn | kategori | antal opskrifter | * = står derhjemme):
${[...ing].sort((a, b) => a.navn.localeCompare(b.navn, 'da')).map(i => `${i.id.slice(0, KORT)} | ${i.navn} | ${kn(i.kategori_id)} | ${antal.get(i.id) || 0}${derhjemme.has(i.id) ? ' | *' : ''}`).join('\n')}

Linjer i opskrifter (linje | tekst | opskrift):
${linjer.join('\n')}
`;
  }
  // Læser Claudes rettelser. Tom tekst er i orden: så bliver linjerne kun knyttet til kataloget.
  function laes(tekst) {
    const s = String(tekst).replace(/[“”]/g, '"').trim();
    if (!s) return {};
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a === -1 || b <= a) return null;
    try { const j = JSON.parse(s.slice(a, b + 1)); return j && typeof j === 'object' && !Array.isArray(j) ? j : null; } catch (e) { return null; }
  }
  // Bruges af «Sortér og ret med Claude» (katalog.js): samme regler og samme sikkerhedskopi, uden forhåndsvisning
  async function ret(rettelse, note) {
    const r = beregn(await hentAlt(), rettelse);
    if (r.fejl.length) { const e = new Error(r.fejl.join(' ')); e.vis = r.fejl[0]; throw e; }
    if (!r.tom) await api('rpc/ingrediens_ret', { method: 'POST', body: { p: { ...r.payload, note } } });
    return r.oversigt;
  }

  // ---------- Siden ----------
  const flertal = (n, en, flere) => `${n} ${n === 1 ? en : flere}`;
  const tid = t => new Date(t).toLocaleString('da-DK', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const del = (noegle, titel, antal, indhold) => antal ? `<details class="iv-del" data-del="${noegle}"${aabne.has(noegle) ? ' open' : ''}><summary>${titel} (${antal})</summary>${indhold}</details>` : '';
  const tabel = (hoveder, raekker) => `<table class="ing-tabel tekst-s"><thead><tr>${hoveder.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${raekker.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const visFejl = liste => { $('#iv-fejl').innerHTML = liste.length ? `<div class="fejlboks" role="alert" tabindex="-1">${liste.slice(0, 8).map(esc).join('<br>')}${liste.length > 8 ? `<br>Og ${liste.length - 8} fejl mere.` : ''}</div>` : ''; const b = $('#iv-fejl .fejlboks'); if (b) b.focus(); };

  function status() {
    const r = beregn(D, {}), o = r.oversigt, l = ligner(D.ing);
    return `<p class="tekst" id="iv-status">${flertal(D.ing.length, 'ingrediens', 'ingredienser')} i kataloget. ${flertal(o.antalLinjer, 'linje', 'linjer')} i ${flertal(D.ops.length, 'opskrift', 'opskrifter')}.</p>
      <p class="lille">${o.uden ? `${flertal(o.uden, 'linje peger', 'linjer peger')} ikke på en ingrediens i kataloget endnu. Tryk på «Vis ændringerne», så bliver de knyttet til.` : 'Alle linjer peger på en ingrediens i kataloget.'}
        ${l.length ? `${flertal(l.length, 'navn', 'navne')} ligner hinanden, fx ${l.slice(0, 3).map(g => '«' + esc(g.join('» og «')) + '»').join(', ')}.` : 'Ingen navne ligner hinanden.'}</p>`;
  }
  function tegnVis() {
    const boks = $('#iv-vis');
    if (!boks) return;
    if (!R) { boks.innerHTML = ''; return; }
    const o = R.oversigt, sammen = o.sammen.reduce((n, g) => n + g.fra.length, 0);
    const dele = [sammen && `${flertal(sammen, 'ingrediens lægges', 'ingredienser lægges')} sammen med en anden`, o.omdoebt.length && `${o.omdoebt.length} får nyt navn`, o.kategori && `${o.kategori} får ny kategori`,
      o.slettet.length && `${o.slettet.length} slettes`, o.nye.length && `${flertal(o.nye.length, 'ny ingrediens', 'nye ingredienser')} oprettes`,
      o.linjer.length && `${flertal(o.linjer.length, 'linje', 'linjer')} i opskrifter får ny tekst`, o.knyttet && `${flertal(o.knyttet, 'linje knyttes', 'linjer knyttes')} til kataloget uden ny tekst`].filter(Boolean);
    if (R.tom && !R.tvivl.length) { boks.innerHTML = '<h2 tabindex="-1">Der er intet at ændre</h2><p class="lille">Rettelserne ændrer ikke noget, og alle linjer peger på en ingrediens.</p>'; return; }
    boks.innerHTML = `<h2 tabindex="-1">Det bliver ændret</h2>
      <p class="tekst">${dele.length ? dele.join('. ') + '.' : 'Intet endnu.'} Kataloget går fra ${o.foer} til ${flertal(o.efter, 'ingrediens', 'ingredienser')}.</p>
      ${R.tvivl.length ? `<h3>Det skal du afgøre (${R.tvivl.length})</h3>${R.tvivl.map((t, i) => `<fieldset class="iv-tvivl" data-noegle="${esc(t.noegle)}"><legend>${esc(t.tekst)}</legend>
        <p class="lille">Forslag: ${esc(t.forslag)}.</p>
        <label class="skift"><input type="radio" name="iv-tv${i}" value="ja"${t.svar === true ? ' checked' : ''}> <span>Ja, ret det</span></label>
        <label class="skift"><input type="radio" name="iv-tv${i}" value="nej"${t.svar === false ? ' checked' : ''}> <span>Nej, lad det være</span></label></fieldset>`).join('')}` : ''}
      ${del('sammen', 'Lægges sammen', o.sammen.length, tabel(['Bliver til', 'Var'], o.sammen.map(g => [g.til, g.fra.join(', ')])))}
      ${del('omdoebt', 'Nyt navn', o.omdoebt.length, tabel(['Var', 'Bliver til'], o.omdoebt.map(g => [g.fra, g.til])))}
      ${del('slettet', 'Slettes', o.slettet.length, `<p class="tekst-s">${o.slettet.map(esc).join(', ')}</p>`)}
      ${del('nye', 'Nye ingredienser', o.nye.length, `<p class="tekst-s">${o.nye.map(esc).join(', ')}</p>`)}
      ${del('linjer', 'Linjer i opskrifter', o.linjer.length, tabel(['Opskrift', 'Var', 'Bliver til'], o.linjer.map(l => [l.opskrift, l.foer, l.efter])))}
      <p class="lille">Før der rettes, gemmes en sikkerhedskopi. Den kan du gendanne nederst på siden.</p>
      <div class="rakke"><button type="button" class="knap annuller" data-tpid="annuller" data-h="ivLuk">${ik('annuller')} Annuller</button><button type="button" class="knap gem" data-tpid="iv-gem" data-h="ivGem">${ik('tjek')} Gem rettelserne</button></div>`;
  }
  const kopiHtml = () => kopiListe.length ? kopiListe.map(k => `<div class="iv-kopi"><p class="tekst">${esc(tid(k.oprettet))} · ${esc(k.note || 'kopi')} · ${flertal(k.antal ?? 0, 'ingrediens', 'ingredienser')}</p>
      <div class="rakke venstre"><button type="button" class="knap mini" data-tpid="iv-gendan" data-h="ivGendan" data-v="${k.id}">${ik('genindlaes')} Gendan</button><button type="button" class="knap mini slet" data-tpid="iv-slet-kopi" data-h="ivSletKopi" data-v="${k.id}">${ik('slet')} Slet kopien</button></div></div>`).join('')
    : '<p class="lille">Der er ingen kopier endnu. Den første gemmes, når du retter noget.</p>';
  function tegn() {
    app.innerHTML = `${Ikoner.tilbage('#/vaerksted')}
      <h2>Ingrediensværktøj</h2>
      <p class="lille">Her rydder du op i ingredienserne. Dubletter lægges sammen, og ord som «finthakket» flyttes fra navnet til linjen i opskriften.</p>
      ${status()}
      <ol class="trin vejledning">
        <li>Kopiér listen over ingredienser, og giv den til Claude.
          <div class="rakke iv-knapper"><button type="button" class="knap mini" data-tpid="iv-kopier" data-h="ivKopier">${ik('gnist')} Kopiér listen</button>
            <a class="knap mini" data-tpid="iv-aabn" href="https://claude.ai/new" target="_blank" rel="noopener">Åbn Claude</a></div></li>
        <li>Kopiér Claudes svar, og sæt det ind her:
          <textarea id="ivsvar" class="felt-s" rows="1" data-husk="ivSvar" placeholder='{ "ingredienser": [ … ] }' aria-label="Claudes rettelser"></textarea>
          <div class="felt-knapper"><button type="button" class="knap mini" data-tpid="iv-saet" data-h="saetInd" data-v="ivsvar">Sæt ind</button>
            <span class="hoejre">${Ikoner.rund('fortryd', 'Fortryd', 'data-tpid="iv-fortryd" data-h="fortrydRyd" data-v="ivsvar" hidden')}<button type="button" class="knap mini slet" data-tpid="iv-ryd" data-h="rydFelt" data-v="ivsvar">Ryd</button></span></div></li>
        <li>Se, hvad der bliver ændret. Intet gemmes endnu.
          <div class="rakke iv-knapper"><button type="button" class="knap mini hoved" data-tpid="iv-vis" data-h="ivVis">Vis ændringerne</button></div></li>
      </ol>
      <div id="iv-fejl"></div>
      <section id="iv-vis" class="iv-vis"></section>
      <h2>Sikkerhedskopier</h2>
      <p class="lille">En kopi har ingredienserne, «Derhjemme» og opskrifternes ingredienser, som de var. «Gendan» sætter dem tilbage og gemmer først en kopi af det, der er nu.</p>
      <div id="iv-kopier">${kopiHtml()}</div>`;
    $('#ivsvar').value = lager.hent('ivSvar', '');
    tegnVis();
  }
  async function hentSiden() {
    [D, kopiListe] = await Promise.all([hentAlt(), api('ingrediens_backup?select=id,oprettet,note,antal&order=oprettet.desc&limit=20')]);
  }
  async function side() {
    app.innerHTML = `${Ikoner.tilbage('#/vaerksted')}<h2>Ingrediensværktøj</h2><p class="lille">Henter…</p>`;
    R = null; valg = {}; rettelse = null;
    await hentSiden();
    if (location.hash === '#/vaerksted/ingredienser') tegn(); // man kan have forladt siden, mens der blev hentet
  }
  const igen = async besked => { R = null; valg = {}; rettelse = null; await hentSiden(); tegn(); toast(besked); };
  const gemFejl = (e, hvad) => { console.error(e); visFejl([/ingrediens_(ret|gendan|backup)/.test(String(e.message)) && /404|PGRST202|42883|42P01/.test(String(e.message)) ? 'Databasen mangler Ingrediensværktøjets funktioner. Kør supabase/ingredienser.sql i Supabase.' : /ændret, siden/.test(String(e.message)) ? 'Kataloget er ændret, siden du trykkede «Vis ændringerne». Intet er rettet. Tryk på «Vis ændringerne» igen.' : `${hvad} Intet er ændret. Tjek internettet, og prøv igen.`]); };

  document.addEventListener('change', e => { // dine svar på tvivl: forhåndsvisningen regnes om
    const f = e.target.closest && e.target.closest('.iv-tvivl');
    if (!f || !R) return;
    valg[f.dataset.noegle] = e.target.value === 'ja';
    const navn = e.target.name;
    R = beregn(D, rettelse, valg); visFejl(R.fejl); tegnVis();
    const r = document.querySelector(`input[name="${navn}"]:checked`); if (r) r.focus();
  });
  document.addEventListener('toggle', e => { const d = e.target; if (d.classList && d.classList.contains('iv-del')) d.open ? aabne.add(d.dataset.del) : aabne.delete(d.dataset.del); }, true);
  Object.assign(H, {
    async ivKopier() {
      D = await hentAlt();
      (await kopier(eksport(D))) ? toast('Listen er kopieret. Sæt den ind hos Claude.') : fejlbesked('Listen blev ikke kopieret. Tryk på knappen igen.');
    },
    async ivVis() {
      rettelse = laes($('#ivsvar').value);
      if (!rettelse) { R = null; tegnVis(); return visFejl(['Rettelserne kan ikke læses. Kopiér hele Claudes svar, og sæt det ind igen.']); }
      D = await hentAlt(); valg = {};
      R = beregn(D, rettelse, valg);
      if (R.fejl.length) { const f = R.fejl; R = null; tegnVis(); return visFejl(f); }
      visFejl([]); tegnVis();
      const h = $('#iv-vis h2'); if (h) { h.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); h.focus({ preventScroll: true }); }
    },
    ivLuk() { R = null; rettelse = null; valg = {}; visFejl([]); tegnVis(); $('[data-h="ivVis"]').focus(); },
    async ivGem(el) {
      if (!R) return;
      if (R.uafgjort) { const f = [...document.querySelectorAll('.iv-tvivl')].filter(x => !x.querySelector(':checked')).map(x => x.querySelector('input'))[0]; visFejl([`Du mangler at afgøre ${flertal(R.uafgjort, 'rettelse', 'rettelser')}. Vælg «Ja» eller «Nej» ved hver.`]); if (f) f.focus(); return; }
      if (R.fejl.length) return visFejl(R.fejl);
      if (R.tom) return ivFaerdig('Der var intet at ændre');
      const tekst = el.lastChild; el.disabled = true; tekst.textContent = ' Gemmer…';
      try { await api('rpc/ingrediens_ret', { method: 'POST', body: { p: { ...R.payload, note: 'før rettelse' } } }); }
      catch (e) { el.disabled = false; tekst.textContent = ' Gem rettelserne'; return gemFejl(e, 'Rettelserne blev ikke gemt.'); }
      await ivFaerdig('Rettelserne er gemt');
    },
    async ivGendan(el) {
      const k = kopiListe.find(x => x.id === el.dataset.v);
      if (!k || !await bekraeft(`Vil du gendanne kopien fra ${tid(k.oprettet)}? Ingredienserne, «Derhjemme» og opskrifternes ingredienser bliver, som de var dengang. Det, der er nu, gemmes først som en ny kopi.`, 'Gendan')) return;
      try { await api('rpc/ingrediens_gendan', { method: 'POST', body: { kopi: k.id } }); }
      catch (e) { return gemFejl(e, 'Kopien blev ikke gendannet.'); }
      await igen('Kopien er gendannet');
    },
    async ivSletKopi(el) {
      const k = kopiListe.find(x => x.id === el.dataset.v);
      if (!k || !await bekraeft(`Vil du slette kopien fra ${tid(k.oprettet)}? Den kan ikke hentes tilbage.`)) return;
      try { await api(`ingrediens_backup?id=eq.${enc(k.id)}`, { method: 'DELETE' }); }
      catch (e) { return gemFejl(e, 'Kopien blev ikke slettet.'); }
      await igen('Kopien er slettet');
    }
  });
  const ivFaerdig = besked => { lager.gem('ivSvar', ''); return igen(besked); };
  return { side, ret, beregn, eksport, laes };
})();
