// Ingrediensværktøjet (opdatering 4c). Ligger i Værkstedet: #/vaerksted/ingredienser.
// Det rydder op i kataloget: dubletter lægges sammen, navne rettes, og tilberedningen («finthakket») flyttes fra navnet til opskriftens linje (f).
// Gangen: kopiér listen til Claude, sæt Claudes rettelser ind, se forhåndsvisningen, gem. Alt regnes ud her (beregn) og sendes som én pakke til
// databasefunktionen «ingrediens_ret» (supabase/ingredienser.sql), som først gemmer en kopi og så retter det hele eller intet.
const IngVaerktoej = (() => {
  let D = null, R = null, valg = {}, kopiListe = [], rettelse = null, G = []; // G: «Til gennemgang»
  const aabne = new Set(['linjer']);
  const norm = s => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  const KORT = 8; // så mange tegn af et id står i listen til Claude
  const hentAlt = async () => {
    const [ing, kat, hj, ops, regler] = await Promise.all([api('ingredienser?select=*'), api('ingrediens_kategorier?select=*'), api('hjemme?select=id,ingrediens_id'), api('opskrifter?select=id,titel,ingredienser&order=titel'), api('ingrediens_regler?select=*')]);
    return { ing, kat, hj, ops, regler };
  };
  // Et id fra rettelserne er de første tegn af det rigtige id. Det skal passe på præcis én.
  const findKort = (liste, kort) => { const k = String(kort ?? '').toLowerCase().trim(); if (k.length < 6) return null; const m = liste.filter(x => x.id === k || x.id.startsWith(k)); return m.length === 1 ? m[0] : null; };
  const ugyldigt = n => !n || /[(),;]/.test(n);

  // Regner ud, hvad rettelserne gør. Ændrer intet. data: { ing, kat, hj, ops }. rettelse: { ingredienser: [...], linjer: [...] }. svar: dine svar på tvivl (nøgle -> true/false).
  // Regler: to ingredienser med samme navn lægges sammen. Hver linje i hver opskrift får id og navn fra kataloget. En linje uden ingrediens i kataloget giver en ny ingrediens.
  // Et gammelt navn, der lægges sammen eller omdøbes, bliver et alias (en regel), så teksten stadig findes. En tekst, der er en regel, kan ikke også blive navnet på en ingrediens.
  function beregn(data, rettelse = {}, svar = {}) {
    const { ing, kat, hj, ops } = data, regler = data.regler || [], reglerTekst = new Set(regler.map(r => r.tekst)), fejl = [], tvivl = [];
    const erRegel = n => `«${n}» er allerede en regel. Slet reglen under «Regler og aliaser» først, eller brug et andet navn.`;
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
      if (n != null && n !== i.navn_norm && reglerTekst.has(n)) { fejl.push(erRegel(n)); continue; }
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
    const maal = navn => { // ingrediensen med det navn efter rettelserne. Er teksten et alias, bruges ingrediensen bag. Findes den ikke, oprettes den.
      const g = grupper.get(navn);
      if (g) return g[0].vinder;
      const a = regler.find(x => x.tekst === navn && Katalog.erAlias(x)), m = a && plan.get(a.resultat[0].id);
      if (m && m.vinder) return m.vinder;
      if (reglerTekst.has(navn)) { fejl.push(`«${navn}» er en regel, som ikke kan bruges her. Ret linjen i opskriften.`); return { ny: true, i: { id: crypto.randomUUID() }, navn, kat: null }; }
      if (!nye.has(navn)) nye.set(navn, { ny: true, i: { id: crypto.randomUUID() }, navn, kat: null });
      return nye.get(navn);
    };
    const opskrifter = [], linjer = [];
    let antalLinjer = 0, uden = 0, knyttet = 0;
    for (const o of ops) {
      const raa = Array.isArray(o.ingredienser) ? o.ingredienser : [], liste = ingListe(o);
      let aendret = liste.length !== raa.length || !Array.isArray(o.ingredienser);
      const ny = liste.map((x, nr) => {
        if ('g' in x || Array.isArray(x.eller)) return x; // en overskrift eller en «eller»-linje er allerede ordnet
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
        // Et alias bevarer teksten (t). Lægges to ingredienser sammen, beholder linjerne det gamle navn som tekst (valg 1 A, 2.19.1). Kun fremad.
        const alias = !gl && !grupper.has(k) && regler.some(a => a.tekst === k && Katalog.erAlias(a)); // en linje, hvis tekst er et alias, bevarer teksten
        const t = r && r.navn != null ? '' : x.t || (alias ? k : gl && gl.vinder !== gl && !grupper.has(gl.i.navn_norm) ? gl.i.navn_norm : '');
        // Flere varer på linjen (el/og): de følger med, når en ingrediens lægges sammen med en anden. Teksten står, som den er.
        const ekstra = liste => [...new Set((liste || []).map(id => { const q = plan.get(id); return q ? q.vinder.i.id : id; }))].filter(id => id !== p.i.id);
        const el = ekstra(x.el), og = ekstra(x.og);
        const linje = { m: r && 'm' in r ? tal(r.m) : x.m, e: r && r.e != null ? String(r.e).trim() : x.e, n: p.navn, id: p.i.id, ...(f && { f }), ...(t && { t }), ...(el.length && { el }), ...(og.length && { og }) };
        const vis = l => visIng(l.t ? { ...l, n: l.t } : l); // som det står i opskriften
        if (['m', 'e', 'n', 'id', 'f', 't', 'el', 'og'].some(a => JSON.stringify(linje[a] ?? '') !== JSON.stringify(x[a] ?? '')) || typeof raa[nr] !== 'object') {
          aendret = true;
          if (vis(x) === vis(linje)) knyttet++; else linjer.push({ opskrift: o.titel, foer: vis(x), efter: vis(linje) });
        }
        return linje;
      }).filter(Boolean);
      if (aendret) opskrifter.push({ id: o.id, ingredienser: ny });
    }
    for (const p of plan.values()) if (p.slet && derhjemme.has(p.i.id)) fejl.push(`«${p.i.navn}» står i «Derhjemme» og kan ikke slettes.`);
    // 5. Pakken til databasen og oversigten til forhåndsvisningen
    const flet = [], ret = [], sammen = [], omdoebt = [], aliaser = [];
    let kategori = 0;
    const slutNavne = new Set([...grupper.keys(), ...nye.keys()]);
    for (const [navn, g] of grupper) {
      const v = g[0].vinder, nytNavn = v.i.navn_norm !== navn, nyKat = (v.i.kategori_id || null) !== v.kat;
      g.forEach(p => { if (p !== v) flet.push({ fra: p.i.id, til: v.i.id }); });
      g.forEach(p => { // det gamle navn bliver en regel (med tilberedningen, hvis den flyttede). Ikke hvis navnet er uændret, allerede er en regel eller nu er navnet på en ingrediens.
        const gammel = p.i.navn_norm;
        if (gammel === navn || reglerTekst.has(gammel) || slutNavne.has(gammel)) return;
        aliaser.push({ tekst: gammel, slags: 'vare', resultat: [{ id: v.i.id, ...(p.f && { f: p.f }) }], til: navn });
      });
      if (g.length > 1) sammen.push({ til: navn, fra: g.map(p => p.i.navn).filter(n => n !== navn) });
      else if (nytNavn) omdoebt.push({ fra: v.i.navn, til: navn });
      if (nytNavn || nyKat) ret.push({ id: v.i.id, navn, navn_norm: navn, kategori_id: v.kat });
      if (nyKat) kategori++;
    }
    const slettes = [...plan.values()].filter(p => p.slet), da = (a, b) => a.localeCompare(b, 'da');
    const payload = { antal: ing.length, flet, slet: slettes.map(p => p.i.id), ret, ny: [...nye.values()].map(p => ({ id: p.i.id, navn: p.navn, navn_norm: p.navn, kategori_id: p.kat })), opskrifter,
      regler: aliaser.map(({ til, ...r }) => r) };
    const navnAf = id => (ing.find(i => i.id === id) || {}).navn; // til forhåndsvisningen: hvad ligner en ny ingrediens?
    const lignendeNye = [...nye.keys()].sort(da).map(n => ({ navn: n, ligner: Katalog.laes(n, ing, regler).lignende.map(navnAf).filter(Boolean) }));
    return { fejl: [...new Set(fejl)], tvivl, uafgjort: tvivl.filter(t => t.svar == null).length, payload,
      tom: !flet.length && !payload.slet.length && !ret.length && !payload.ny.length && !opskrifter.length,
      oversigt: { sammen: sammen.sort((a, b) => da(a.til, b.til)), omdoebt: omdoebt.sort((a, b) => da(a.fra, b.fra)), kategori, slettet: slettes.map(p => p.i.navn).sort(da), nye: [...nye.keys()].sort(da), lignendeNye,
        aliaser: aliaser.map(a => ({ fra: a.tekst, til: a.til, f: a.resultat[0].f || '' })).sort((a, b) => da(a.fra, b.fra)),
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
  // ---------- Regler og aliaser (Styr på ingredienser, fase 4) ----------
  // En regel er «skrevet tekst → resultat» (tabellen ingrediens_regler). Et alias er en regel med én vare uden tilberedning: «kyllingefilet» → kyllingebryst.
  // Regler ændres kun gennem ingrediens_regel_gem og ingrediens_regel_slet. De tjekker versionen: er reglen ændret, siden den blev hentet, vises den andens udgave først.
  let soeg = '', ed = null; // ed: reglen i vinduet: { id, version, tekst, slags, varer: [{ navn, f }], t, resultat }
  const SLAGS = [['vare', 'Én vare', 'Teksten er én ingrediens. Skriv en tilberedning, hvis den hører med, fx «finthakket».'], ['del', 'Flere varer', 'Linjen deles i flere linjer, fx «salt og peber».'],
    ['eller', 'Én af flere varer', 'Linjen er opfyldt, når én af varerne er derhjemme, fx «smør eller margarine».'], ['slet', 'Ingen vare', 'Linjen slettes, fx en overskrift, der ikke er en ingrediens.']];
  const ingNavn = id => (D.ing.find(x => x.id === id) || {}).navn || '?';
  const varTekst = v => ingNavn(v.id) + (v.f ? ', ' + v.f : '');
  const regelTekst = r => r.slags === 'slet' ? 'slettes' : r.slags === 'del' ? r.resultat.map(varTekst).join(' + ') + ' (deles)' : r.slags === 'eller' ? r.resultat.map(varTekst).join(' eller ') : varTekst(r.resultat[0]);
  const regelAf = r => ({ id: r.id, version: r.version, tekst: r.tekst, slags: r.slags, varer: r.resultat.map(v => ({ navn: ingNavn(v.id), f: v.f || '' })) });
  const serverFejl = e => { const m = String(e.message).match(/"message":"((?:[^"\\]|\\.)*)"/); try { return m ? JSON.parse('"' + m[1] + '"') : ''; } catch (x) { return ''; } };
  const regelFejl = (e, hvad) => { console.error(e); const s = serverFejl(e); return /PGRST202|42883|404/.test(String(e.message)) && !s ? 'Databasen mangler reglernes funktioner. Kør supabase/ingredienser.sql i Supabase.' : s.includes('«') ? s : `${hvad} Intet er ændret. Tjek internettet, og prøv igen.`; };

  // ---------- Slags af, Samme som og foreløbige ingredienser (2.26.0) ----------
  // Test: kan den ene erstatte den anden 1:1? Ja: «samme som» (kyllingebryst og hønsebryst). Er den ene en slags af den anden: «slags af» (frisk timian er en slags timian). Er den bare et andet navn: alias.
  // Koblinger går kun ét skridt. Navne og koblinger ændres kun gennem databasefunktionerne (kopi først).
  const finIng = t => D.ing.find(x => x.navn_norm === norm(t));
  // Feltet står lige før knappens række. Det kan stå flere steder for samme ingrediens (listen og de foreløbige), så det findes ud fra knappen.
  const valgIng = (el, id, hvad) => { const fe = el.closest('.rakke').previousElementSibling, f = finIng(fe ? fe.value : ''); if (!f) { toast('Vælg ' + hvad + ' fra listen'); return null; } if (f.id === id) { toast('Vælg en anden ingrediens end den selv'); return null; } return f; };
  const kobling = (i, attr, tekst, knap, h, ikon, fb = '') => `<label for="${fb}${attr}-${i.id}">${tekst}</label>
    <input id="${fb}${attr}-${i.id}" class="felt felt-m" list="ivliste" autocomplete="off" autocapitalize="off" spellcheck="false">
    <div class="rakke venstre"><button type="button" class="knap mini" data-tpid="iv-${attr}" data-h="${h}" data-n="${i.id}">${ik(ikon)} ${knap}</button></div>`;
  const handlinger = (i, fae, sam) => `${kobling(i, 'slags', `«${esc(i.navn)}» er en slags …`, 'Gør til slags af', 'ivSlags', 'tjek')}
    ${fae ? `<div class="rakke venstre"><button type="button" class="knap mini slet" data-tpid="iv-slags-fjern" data-h="ivSlagsFjern" data-n="${i.id}">${ik('fjern')} Ikke en slags af «${esc(fae)}»</button></div>` : ''}
    ${kobling(i, 'samme', `«${esc(i.navn)}» er samme som …`, 'Gør samme som', 'ivSamme', 'tjek')}
    ${sam.length ? `<div class="rakke venstre"><button type="button" class="knap mini slet" data-tpid="iv-samme-fjern" data-h="ivSammeFjern" data-n="${i.id}">${ik('fjern')} Ikke samme som de andre</button></div>` : ''}
    ${kobling(i, 'tilalias', `Gør «${esc(i.navn)}» til alias af …`, 'Gør til alias', 'ivTilAlias', 'tjek')}`;
  // Foreløbige ingredienser: nye, lavet af appen uden spørgsmål. Godkend dem med en kategori, eller gør dem til alias af en, der findes.
  const foreloebigHtml = () => {
    const f = D.ing.filter(i => i.foreloebig).sort((a, b) => a.navn.localeCompare(b.navn, 'da')), brugt = new Map();
    for (const o of D.ops) for (const x of ingListe(o)) if (x.id) brugt.set(x.id, (brugt.get(x.id) || 0) + 1);
    if (!f.length) return '<h2>Foreløbige ingredienser</h2><p class="lille">Ingen nye ingredienser venter på dig.</p>';
    const kat = [...D.kat].sort((a, b) => a.raekkefolge - b.raekkefolge);
    const række = i => `<div class="iv-regel"><p class="tekst-s" data-tpdata><strong>${esc(i.navn)}</strong> · ${flertal(brugt.get(i.id) || 0, 'opskrift', 'opskrifter')}</p>
      <label for="fk-${i.id}">Kategori</label>
      <select id="fk-${i.id}" class="felt felt-m" data-fkat="${i.id}">${kat.map(k => `<option value="${k.id}"${k.id === i.kategori_id ? ' selected' : ''}>${esc(katNavn(k))}</option>`).join('')}</select>
      <div class="rakke venstre"><button type="button" class="knap mini gem" data-tpid="iv-fb-ok" data-h="ivFbGodkend" data-n="${i.id}" aria-label="Godkend ${esc(i.navn)}">${ik('tjek')} Godkend</button></div>
      ${kobling(i, 'tilalias', `Eller gør «${esc(i.navn)}» til alias af …`, 'Gør til alias', 'ivTilAlias', 'tjek', 'fb-')}</div>`;
    return `<h2>Foreløbige ingredienser (${f.length})</h2><p class="lille">Appen har oprettet dem uden at spørge, fordi de ikke fandtes. Vælg kategori og tryk «Godkend», eller gør dem til alias af en ingrediens, der findes. Så bliver teksten stående i opskrifterne.</p>
      ${f.map(række).join('')}${f.length > 1 ? `<div class="rakke venstre"><button type="button" class="knap mini" data-tpid="iv-fb-alle" data-h="ivFbAlle">${ik('tjek')} Godkend alle</button></div>` : ''}`;
  };
  const tegnForeloebig = () => { const b = $('#iv-foreloebig'); if (b) b.innerHTML = foreloebigHtml(); };
  // Én pakke til ingrediens_ret (kopi først, alt eller intet)
  async function retPakke(p, note, besked) {
    try { await api('rpc/ingrediens_ret', { method: 'POST', body: { p: { antal: D.ing.length, note, ...p } } }); }
    catch (e) { console.error(e); return fejlbesked(serverFejl(e) || 'Det blev ikke gemt. Intet er ændret. Tjek internettet, og prøv igen.'); }
    await efterRegel(besked);
  }

  function reglerListe() {
    const q = norm(soeg), pr = new Map(), uden = [];
    for (const r of D.regler) { if (!r.resultat.length) uden.push(r); for (const v of r.resultat) { if (!pr.has(v.id)) pr.set(v.id, []); pr.get(v.id).push(r); } }
    const soegt = q.length >= 2, hit = r => r.tekst.includes(q);
    const alle = D.ing.filter(i => soegt ? i.navn_norm.includes(q) || (pr.get(i.id) || []).some(hit) : pr.has(i.id)).sort((a, b) => a.navn.localeCompare(b.navn, 'da'));
    const vis = alle.slice(0, 30), sletRegler = uden.filter(r => !soegt || hit(r));
    const regel = (r, nr) => `<div class="iv-regel"><p class="tekst-s" data-tpdata>«${esc(r.tekst)}» → ${esc(regelTekst(r))}${r.slags === 'eller' && r.resultat.length > 1 && !r.resultat.some(v => v.f) ? ' (alias, der deles)' : ''}</p><div class="rakke venstre">
      <button type="button" class="knap mini" data-tpid="iv-regel-tilpas" data-h="ivRegel" data-v="${r.id}" aria-label="Tilpas reglen ${esc(r.tekst)}">Tilpas</button>
      <button type="button" class="knap mini slet" data-tpid="iv-regel-slet" data-h="ivRegelSlet" data-v="${r.id}" data-n="${nr}" aria-label="Fjern ${esc(r.tekst)}${nr ? ' fra ' + esc(ingNavn(nr)) : ''}">${ik('slet')} Fjern</button>
      ${r.slags === 'slet' ? '' : `<button type="button" class="knap mini" data-tpid="iv-regel-egen" data-h="ivEgen" data-v="${r.id}" aria-label="Gør ${esc(r.tekst)} til en egen ingrediens">Egen ingrediens</button>`}</div></div>`;
    const dele = vis.map(i => {
      const rs = pr.get(i.id) || [], fae = i.faelles_id && ingNavn(i.faelles_id), vars = D.ing.filter(x => x.faelles_id === i.id).map(x => x.navn);
      const sam = i.ens_gruppe ? D.ing.filter(x => x.ens_gruppe === i.ens_gruppe && x.id !== i.id).map(x => x.navn) : [];
      const info = [`Kategori: ${katNavn(D.kat.find(k => k.id === i.kategori_id))}.`, i.foreloebig && 'Foreløbig: ikke godkendt endnu.', fae && `Slags af «${fae}».`, vars.length && `Slags: ${vars.join(', ')}.`, sam.length && `Samme som: ${sam.join(', ')}.`].filter(Boolean).join(' ');
      return del('r:' + i.id, `<span data-tpdata>${esc(i.navn)}</span>`, rs.length, `<p class="lille" data-tpdata>${esc(info)}</p>${rs.map(r => regel(r, i.id)).join('') || '<p class="lille">Ingen aliaser endnu.</p>'}
        <label for="al-${i.id}">Nyt alias til «${esc(i.navn)}»</label>
        <input id="al-${i.id}" class="felt felt-m" placeholder="fx kyllingefilet" autocomplete="off" autocapitalize="off" spellcheck="false" data-alias="${i.id}">
        <div class="rakke venstre"><button type="button" class="knap mini" data-tpid="iv-alias-nyt" data-h="ivAliasNy" data-n="${i.id}" aria-label="Tilføj alias til ${esc(i.navn)}">${ik('plus')} Tilføj alias</button></div>${handlinger(i, fae, sam)}`, true);
    }).join('');
    const slet = sletRegler.length ? del('r:slet', 'Regler uden vare', sletRegler.length, sletRegler.map(r => regel(r, '')).join('')) : '';
    const tom = !dele && !slet ? `<p class="lille">${soegt ? 'Ingen ingredienser eller regler passer.' : 'Der er ingen aliaser endnu.'}</p>` : '';
    return dele + slet + tom + (alle.length > vis.length ? `<p class="lille">${flertal(alle.length - vis.length, 'ingrediens', 'ingredienser')} mere. Skriv mere i feltet for at indsnævre.</p>` : '');
  }
  const reglerHtml = () => `<h2>Ingredienser og aliaser</h2>
    <p class="lille">Et alias er et andet navn for samme ingrediens, fx «kyllingefilet» for «kyllingebryst». «Samme som» er to ingredienser, der kan erstatte hinanden 1:1 (kyllingebryst og hønsebryst). «Slags af» er en variant af et fællesnavn (frisk timian er en slags timian). Koblinger går kun ét skridt. Søg efter en ingrediens for at ændre den.</p>
    <div class="rakke venstre"><button type="button" class="knap mini" data-tpid="iv-ing-ny" data-h="ivNy">${ik('plus')} Ny ingrediens</button></div>
    <label for="ivsoeg">Find en ingrediens eller et alias</label>
    <input id="ivsoeg" type="search" class="felt felt-m" value="${esc(soeg)}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="ivsoeg-h" aria-controls="iv-regler">
    <p class="lille" id="ivsoeg-h">Skriv mindst to bogstaver. Uden søgning ses de ingredienser, der har et alias.</p>
    <datalist id="ivliste">${[...D.ing].sort((a, b) => a.navn.localeCompare(b.navn, 'da')).map(i => `<option value="${esc(i.navn)}"></option>`).join('')}</datalist>
    <div id="iv-regler">${reglerListe()}</div>
    <div class="rakke venstre"><button type="button" class="knap mini" data-tpid="iv-regel-ny" data-h="ivRegel">${ik('plus')} Ny regel (flere varer, én af flere)</button></div>`;

  // Gem en regel og tegn listen igen. Er den ændret af en anden, vises den andens udgave først.
  async function gemRegel(p, besked) {
    let r;
    try { r = await api('rpc/ingrediens_regel_gem', { method: 'POST', body: { p } }); } catch (e) { return fejlbesked(regelFejl(e, 'Aliaset blev ikke gemt.')); }
    if (r.ok) return efterRegel(besked);
    if (r.grund === 'aendret' || r.grund === 'slettet' || r.grund === 'findes') { await efterRegel(); return toast('Reglen er ændret af en anden. Prøv igen.'); }
    toast(r.grund === 'navn' ? 'Teksten er allerede navnet på en ingrediens' : 'Aliaset blev ikke gemt');
  }
  // Vinduet til en ny ingrediens, eller til et alias, der bliver en ingrediens (fra)
  let ny_fra = null;
  function aabnNy(navn, kat, fra) {
    ny_fra = fra;
    const valgt = kat || '', d = ark(`<h2>${fra ? 'Gør til egen ingrediens' : 'Ny ingrediens'}</h2>
      ${fra ? `<small>«${esc(fra.tekst)}» er ikke længere et alias. Opskrifter, der allerede er gemt, ændres ikke.</small>` : '<small>Skriv selve varen, fx «løg», ikke «hakket løg».</small>'}
      <label for="nyNavn">Navn</label>
      <input id="nyNavn" class="felt felt-m" value="${esc(navn)}" autocomplete="off" autocapitalize="off" spellcheck="false">
      <label for="nyKat">Kategori</label>
      <select id="nyKat" class="felt felt-m"><option value="">${IKKE_SORTERET}</option>${[...D.kat].filter(k => k.navn_norm !== 'andet').sort((a, b) => a.raekkefolge - b.raekkefolge).map(k => `<option value="${k.id}"${k.id === valgt ? ' selected' : ''}>${esc(katNavn(k))}</option>`).join('')}</select>
      <div id="arkfejl"></div>
      <div class="rakke"><button type="button" class="knap annuller" data-tpid="annuller" data-h="lukArk">Annuller</button><button type="button" class="knap gem" data-tpid="gem" data-h="ivNyGem">${ik('tjek')} Opret</button></div>`);
    $('.ark-bag', d).addEventListener('click', lukArk);
    $('#nyNavn').focus();
  }

  // Vinduet, hvor en regel laves eller tilpasses
  const raekker = () => {
    const n = ed.slags === 'slet' ? 0 : ed.slags === 'vare' ? 1 : Math.max(2, ed.varer.length);
    while (ed.varer.length < n) ed.varer.push({ navn: '', f: '' });
    ed.varer.length = n;
    return ed.varer.map((v, i) => `<div class="iv-vare"><label for="rgv${i}">${n > 1 ? 'Vare ' + (i + 1) : 'Vare'}</label>
      <input id="rgv${i}" class="felt felt-m" list="rgliste" value="${esc(v.navn)}" autocomplete="off" autocapitalize="off" spellcheck="false">
      <label for="rgf${i}">Tilberedning (valgfrit)</label>
      <input id="rgf${i}" class="felt felt-m" value="${esc(v.f)}" placeholder="fx finthakket" autocomplete="off" autocapitalize="off">
      ${n > 2 ? `<div class="rakke venstre"><button type="button" class="knap mini slet" data-tpid="iv-vare-fjern" data-h="rgFjern" data-v="${i}" aria-label="Fjern vare ${i + 1}">${ik('fjern')} Fjern</button></div>` : ''}</div>`).join('')
      + (ed.slags === 'del' || ed.slags === 'eller' ? `<div class="rakke venstre"><button type="button" class="knap mini" data-tpid="iv-vare-ny" data-h="rgTilfoej">${ik('plus')} Tilføj vare</button></div>` : '');
  };
  const laesVinduet = () => { // vinduets felter ind i ed
    if (!$('#rgtekst')) return;
    ed.tekst = $('#rgtekst').value;
    ed.varer.forEach((v, i) => { const a = $('#rgv' + i), b = $('#rgf' + i); if (a) v.navn = a.value; if (b) v.f = b.value; });
  };
  const tegnRaekker = () => { $('#rgvarer').innerHTML = raekker(); $('#rghint').textContent = SLAGS.find(s => s[0] === ed.slags)[2]; };
  const arkFejl = liste => { $('#arkfejl').innerHTML = liste.length ? `<div class="fejlboks" role="alert" tabindex="-1">${liste.map(esc).join('<br>')}</div>` : ''; const b = $('#arkfejl .fejlboks'); if (b) b.focus(); };
  function aabnVindue(r) {
    ed = r;
    const d = ark(`<h2>${ed.id ? 'Tilpas reglen' : 'Ny regel'}</h2>
      <small>En regel fortæller appen, hvad en tekst i en opskrift betyder.</small>
      <label for="rgtekst">Når der står</label>
      <input id="rgtekst" class="felt felt-m" value="${esc(ed.tekst)}" autocomplete="off" autocapitalize="off" spellcheck="false">
      <fieldset class="iv-valg"><legend>Så betyder det</legend>${SLAGS.map(([k, t]) => `<label class="skift"><input type="radio" name="rgslags" value="${k}"${ed.slags === k ? ' checked' : ''}> <span>${t}</span></label>`).join('')}</fieldset>
      <p class="lille" id="rghint"></p>
      <div id="rgvarer"></div>
      <datalist id="rgliste">${[...D.ing].sort((a, b) => a.navn.localeCompare(b.navn, 'da')).map(i => `<option value="${esc(i.navn)}"></option>`).join('')}</datalist>
      <div id="arkfejl"></div>
      <div class="rakke"><button type="button" class="knap annuller" data-tpid="annuller" data-h="lukArk">Annuller</button><button type="button" class="knap gem" data-tpid="gem" data-h="rgGem">${ik('tjek')} Gem reglen</button></div>`);
    tegnRaekker();
    $('.ark-bag', d).addEventListener('click', lukArk);
  }
  function loes() { // vinduet til tekst og resultat. Fejl, hvis noget ikke kan bruges.
    laesVinduet();
    const fejl = [], t = norm(ed.tekst), resultat = [];
    if (!t) fejl.push('Skriv den tekst, reglen gælder for.');
    if (ed.slags !== 'slet') ed.varer.forEach((v, i) => {
      const n = norm(v.navn), hvilken = ed.varer.length > 1 ? 'vare ' + (i + 1) : 'varen';
      if (!n) return fejl.push(`Vælg ${hvilken} fra listen.`);
      const m = D.ing.find(x => x.navn_norm === n);
      if (!m) { const l = Katalog.laes(n, D.ing, D.regler).lignende.slice(0, 3).map(id => '«' + ingNavn(id) + '»'); return fejl.push(`«${v.navn.trim()}» findes ikke i kataloget.${l.length ? ' Mente du ' + l.join(', ') + '?' : ''} Vælg ${hvilken} fra listen.`); }
      if (resultat.some(x => x.id === m.id)) return fejl.push(`«${m.navn}» står to gange.`);
      resultat.push({ id: m.id, ...(v.f.trim() && { f: v.f.trim() }) });
    });
    return { t, resultat, fejl };
  }
  async function efterRegel(besked) { // hent reglerne igen, og tegn listen og forhåndsvisningen forfra
    D = await hentAlt();
    await Katalog.hent().catch(e => console.error(e));
    lukArk();
    const l = $('#iv-regler'); if (l) l.innerHTML = reglerListe();
    tegnForeloebig();
    if (R) { R = beregn(D, rettelse, valg); tegnVis(); }
    if (besked) toast(besked);
  }
  async function visKonflikt(hvad, deres) { // hvad: «gem», «slet» eller «slettet» (en anden har slettet reglen)
    D.regler = await api('ingrediens_regler?select=*');
    const l = $('#iv-regler'); if (l) l.innerHTML = reglerListe();
    const gem = hvad === 'gem', slettet = hvad === 'slettet';
    const d = ark(`<h2>${slettet ? 'Reglen er slettet' : 'Reglen er ændret'}</h2>
      ${slettet ? '<p class="ark-tekst">En anden har slettet reglen, siden du åbnede den. Intet er gemt.</p>' : `<p class="ark-tekst">En anden har ændret reglen, siden du åbnede den. Nu står der:</p><p class="ark-tekst" data-tpdata>«${esc(deres.tekst)}» → ${esc(regelTekst(deres))}</p>
      <p class="ark-tekst">${gem ? 'Vil du gemme din udgave oven på?' : 'Vil du slette den alligevel?'}</p>`}
      <div class="rakke">${slettet ? '<button type="button" class="knap annuller" data-h="lukArk">Annuller</button><button type="button" class="knap gem" data-h="rgSomNy">Gem som ny regel</button>'
        : gem ? '<button type="button" class="knap annuller" data-h="lukArk">Annuller</button><button type="button" class="knap" data-h="rgBrugDeres">Tilpas den nye</button><button type="button" class="knap gem" data-h="rgAlligevel">Gem min alligevel</button>'
        : '<button type="button" class="knap" data-h="lukArk">Behold</button><button type="button" class="knap slet" data-h="rgAlligevel">Slet alligevel</button>'}</div>`);
    $('.ark-bag', d).addEventListener('click', lukArk);
    ed = ed || {}; ed.deres = deres; ed.hvad = hvad;
  }
  async function sendGem() {
    const knap = $('[data-h="rgGem"]'), tekst = knap && knap.lastChild;
    if (knap) { knap.disabled = true; tekst.textContent = ' Gemmer…'; }
    let r;
    try { r = await api('rpc/ingrediens_regel_gem', { method: 'POST', body: { p: { ...(ed.id && { id: ed.id, version: ed.version }), tekst: ed.t, slags: ed.slags, resultat: ed.resultat } } }); }
    catch (e) { if (knap) { knap.disabled = false; tekst.textContent = ' Gem reglen'; } return $('#arkfejl') ? arkFejl([regelFejl(e, 'Reglen blev ikke gemt.')]) : fejlbesked(regelFejl(e, 'Reglen blev ikke gemt.')); }
    if (r.ok) return efterRegel('Reglen er gemt');
    if (knap) { knap.disabled = false; tekst.textContent = ' Gem reglen'; }
    if (r.grund === 'aendret') return visKonflikt('gem', r.regel);
    if (r.grund === 'slettet') return visKonflikt('slettet');
    if (r.grund === 'findes') { // teksten er allerede en regel: den, der findes, gælder
      D.regler = await api('ingrediens_regler?select=*'); ed.findes = r.regel;
      const d = ark(`<h2>Teksten findes allerede</h2><p class="ark-tekst">Der er allerede en regel for den tekst:</p><p class="ark-tekst" data-tpdata>«${esc(r.regel.tekst)}» → ${esc(regelTekst(r.regel))}</p>
        <div class="rakke"><button type="button" class="knap annuller" data-h="lukArk">Annuller</button><button type="button" class="knap" data-h="rgBrugFindes">Tilpas den</button></div>`);
      return $('.ark-bag', d).addEventListener('click', lukArk);
    }
    if (r.grund === 'navn') return arkFejl([`«${ed.t}» er allerede navnet på en ingrediens. Linjer med den tekst peger allerede på den.`]);
    arkFejl(['Reglen blev ikke gemt.']);
  }
  async function sletRegel(id, version) {
    let s;
    try { s = await api('rpc/ingrediens_regel_slet', { method: 'POST', body: { id, version } }); } catch (e) { return fejlbesked(regelFejl(e, 'Reglen blev ikke slettet.')); }
    if (s.ok) return efterRegel('Reglen er slettet');
    if (s.grund === 'aendret') { ed = { id, version }; return visKonflikt('slet', s.regel); }
  }

  // ---------- Siden ----------
  const flertal = (n, en, flere) => `${n} ${n === 1 ? en : flere}`;
  const tid = t => new Date(t).toLocaleString('da-DK', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const del = (noegle, titel, antal, indhold, altid) => antal || altid ? `<details class="iv-del" data-del="${noegle}"${aabne.has(noegle) ? ' open' : ''}><summary>${titel} (${antal})</summary>${indhold}</details>` : '';
  const tabel = (hoveder, raekker) => `<table class="ing-tabel tekst-s" data-tpid="iv-tabel"><thead><tr>${hoveder.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${raekker.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const visFejl = liste => { $('#iv-fejl').innerHTML = liste.length ? `<div class="fejlboks" role="alert" tabindex="-1">${liste.slice(0, 8).map(esc).join('<br>')}${liste.length > 8 ? `<br>Og ${liste.length - 8} fejl mere.` : ''}</div>` : ''; const b = $('#iv-fejl .fejlboks'); if (b) b.focus(); };

  // Opskrifter, hvor en linje endnu ikke er ordnet: flere varer i ét navn («persille og forårsløg») eller ingen ingrediens i kataloget
  function venter() {
    const iId = new Map(D.ing.map(i => [i.id, i])), ud = [];
    for (const o of D.ops) {
      const l = [];
      for (const x of ingListe(o)) {
        if ('g' in x || Array.isArray(x.eller)) continue;
        const i = x.id && iId.get(x.id);
        if (!i) l.push(x.n); else if (Katalog.flereVarer(i.navn_norm) && !Katalog.flereAf(i.navn_norm)) l.push(i.navn); // «salt og peber» med kendte dele samles stille
      }
      if (l.length) ud.push({ id: o.id, titel: o.titel, linjer: l });
    }
    return ud;
  }
  function status() {
    const r = beregn(D, {}), o = r.oversigt, l = ligner(D.ing), v = venter();
    return `<p class="tekst" id="iv-status">${flertal(D.ing.length, 'ingrediens', 'ingredienser')} i kataloget. ${flertal(o.antalLinjer, 'linje', 'linjer')} i ${flertal(D.ops.length, 'opskrift', 'opskrifter')}.</p>
      <p class="lille">${o.uden ? `${flertal(o.uden, 'linje peger', 'linjer peger')} ikke på en ingrediens i kataloget endnu. Tryk på «Vis ændringerne», så bliver de knyttet til.` : 'Alle linjer peger på en ingrediens i kataloget.'}
        ${l.length ? `${flertal(l.length, 'navn', 'navne')} ligner hinanden, fx ${l.slice(0, 3).map(g => '«' + esc(g.join('» og «')) + '»').join(', ')}.` : 'Ingen navne ligner hinanden.'}
        ${v.length ? `${flertal(v.length, 'opskrift har', 'opskrifter har')} linjer med flere varer i ét navn, fx «${esc(v[0].linjer[0])}». De er ikke ordnet endnu.` : 'Alle linjer har én vare.'}</p>
      ${del('venter', 'Opskrifter, der venter på svar', v.length, v.map(x => `<p class="tekst-s" data-tpdata><a href="#/opskrifter/${x.id}">${esc(x.titel)}</a>: ${x.linjer.map(esc).join(', ')}</p>`).join(''))}`;
  }
  function tegnVis() {
    const boks = $('#iv-vis');
    if (!boks) return;
    if (!R) { boks.innerHTML = ''; return; }
    const o = R.oversigt, sammen = o.sammen.reduce((n, g) => n + g.fra.length, 0);
    const dele = [sammen && `${flertal(sammen, 'ingrediens lægges', 'ingredienser lægges')} sammen med en anden`, o.omdoebt.length && `${o.omdoebt.length} får nyt navn`, o.kategori && `${o.kategori} får ny kategori`,
      o.aliaser.length && `${flertal(o.aliaser.length, 'gammelt navn bliver', 'gamle navne bliver')} til alias`,
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
      ${del('aliaser', 'Gamle navne, der bliver aliaser', o.aliaser.length, `<p class="lille">Teksten virker stadig i opskrifter og import. Den peger nu på det nye navn.</p>${tabel(['Gammelt navn', 'Peger på'], o.aliaser.map(a => [a.fra, a.til + (a.f ? ', ' + a.f : '')]))}`)}
      ${del('nye', 'Nye ingredienser', o.nye.length, `<p class="lille">Tjek, at de ikke findes i forvejen. Er en af dem det samme som en ingrediens i kolonnen til højre, så ret navnet i rettelserne.</p>${tabel(['Ny ingrediens', 'Ligner'], o.lignendeNye.map(n => [n.navn, n.ligner.join(', ') || 'Ingen lignende']))}`)}
      ${del('linjer', 'Linjer i opskrifter', o.linjer.length, tabel(['Opskrift', 'Var', 'Bliver til'], o.linjer.map(l => [l.opskrift, l.foer, l.efter])))}
      <p class="lille">Før der rettes, gemmes en sikkerhedskopi. Den kan du gendanne nederst på siden.</p>
      <div class="rakke"><button type="button" class="knap annuller" data-tpid="annuller" data-h="ivLuk">${ik('annuller')} Annuller</button><button type="button" class="knap gem" data-tpid="iv-gem" data-h="ivGem">${ik('tjek')} Gem rettelserne</button></div>`;
  }
  const kopiHtml = () => kopiListe.length ? kopiListe.map(k => `<div class="iv-kopi"><p class="tekst">${esc(tid(k.oprettet))} · ${esc(k.note || 'kopi')} · ${flertal(k.antal ?? 0, 'ingrediens', 'ingredienser')}</p>
      <div class="rakke venstre"><button type="button" class="knap mini" data-tpid="iv-gendan" data-h="ivGendan" data-v="${k.id}">${ik('genindlaes')} Gendan</button><button type="button" class="knap mini slet" data-tpid="iv-slet-kopi" data-h="ivSletKopi" data-v="${k.id}">${ik('slet')} Slet kopien</button></div></div>`).join('')
    : '<p class="lille">Der er ingen kopier endnu. Den første gemmes, når du retter noget.</p>';
  // «Til gennemgang»: det, der er lavet uden for værktøjet. «Godkend» fjerner kun rækken fra listen.
  const GSLAGS = { ny: 'Ny ingrediens', alias: 'Nyt alias eller regel', taet: 'Rettet, fordi den lignede' };
  function gennemgangHtml() {
    if (!G.length) return '<h2>Til gennemgang</h2><p class="lille">Intet at gennemgå. Nye ingredienser og aliaser, der laves andre steder, kommer til at stå her.</p>';
    const række = g => {
      const i = g.ingrediens_id && D.ing.find(x => x.id === g.ingrediens_id), hen = i ? ' → ' + i.navn : '';
      return `<div class="iv-regel"><p class="tekst-s" data-tpdata>${GSLAGS[g.slags] || g.slags}: «${esc(g.tekst)}»${esc(hen)}${g.note ? ' (' + esc(g.note) + ')' : ''}</p>
        <p class="lille" data-tpdata>${esc(g.kilde)} · ${esc(tid(g.oprettet))}</p>
        <div class="rakke venstre"><button type="button" class="knap mini" data-tpid="iv-gg-se" data-h="ivSe" data-v="${g.id}" aria-label="Se ${esc(g.tekst)} i listen">Se</button>
          <button type="button" class="knap mini gem" data-tpid="iv-gg-ok" data-h="ivGodkend" data-v="${g.id}" aria-label="Godkend ${esc(g.tekst)}">${ik('tjek')} Godkend</button></div></div>`;
    };
    return `<h2>Til gennemgang (${G.length})</h2><p class="lille">Laves der en ingrediens, et alias eller en rettelse uden for værktøjet, står den her. Tryk «Godkend», når den er i orden. Det ændrer ikke ingredienserne.</p>
      ${G.map(række).join('')}${G.length > 1 ? `<div class="rakke venstre"><button type="button" class="knap mini" data-tpid="iv-gg-alle" data-h="ivGodkendAlle">${ik('tjek')} Godkend alle</button></div>` : ''}`;
  }
  const tegnGennemgang = () => { const b = $('#iv-gennemgang'); if (b) b.innerHTML = gennemgangHtml(); };
  // Oversigt: ingredienser med aliaser og varianter, og de navne, der ligner hinanden
  function oversigtHtml() {
    const al = new Map();
    for (const r of D.regler) if ((r.slags === 'vare' || r.slags === 'eller') && r.resultat.every(v => !v.f)) for (const v of r.resultat) al.set(v.id, [...(al.get(v.id) || []), r.tekst]);
    const grupper = new Map(D.kat.sort((a, b) => a.raekkefolge - b.raekkefolge).map(k => [k.id, { navn: katNavn(k), liste: [] }])), andet = { navn: IKKE_SORTERET, liste: [] };
    for (const i of D.ing) (grupper.get(i.kategori_id) || andet).liste.push(i);
    const række = i => { const a = (al.get(i.id) || []).sort((x, y) => x.localeCompare(y, 'da')), v = D.ing.filter(x => x.faelles_id === i.id).map(x => x.navn);
      return `<p class="tekst-s" data-tpdata><strong>${esc(i.navn)}</strong>${a.length ? ' · også: ' + esc(a.join(', ')) : ''}${v.length ? ' · slags: ' + esc(v.join(', ')) : ''}${i.ens_gruppe ? ' · samme som: ' + esc(D.ing.filter(x => x.ens_gruppe === i.ens_gruppe && x.id !== i.id).map(x => x.navn).join(', ')) : ''}${i.foreloebig ? ' · foreløbig' : ''}</p>`; };
    const dele = [...grupper.values(), andet].filter(g => g.liste.length).map(g => del('o:' + g.navn, esc(g.navn), g.liste.length, g.liste.sort((x, y) => x.navn.localeCompare(y.navn, 'da')).map(række).join('')));
    const l = ligner(D.ing), ligHtml = l.length ? del('o:ligner', 'Navne, der ligner hinanden', l.length, `<p class="lille">Er det den samme vare, så læg dem sammen med Claude, eller lav det ene til et alias.</p>${l.map(g => `<p class="tekst-s" data-tpdata>${esc(g.join(' · '))}</p>`).join('')}`) : '<p class="lille">Ingen navne ligner hinanden.</p>';
    const tal = `${flertal(D.ing.length, 'ingrediens', 'ingredienser')}, ${flertal([...al.values()].reduce((n, a) => n + a.length, 0), 'alias', 'aliaser')}.`;
    return `<h2>Oversigt</h2><p class="lille">${tal}</p>${ligHtml}${dele.join('')}<div class="rakke">${Ikoner.rund('luk', 'Luk', 'data-tpid="luk" data-h="lukArk"')}</div>`;
  }
  function tegn() {
    app.innerHTML = `${Ikoner.tilbage('#/vaerksted')}
      <h2>Ingrediensværktøj</h2>
      <p class="lille">Her opretter du ingredienser og styrer deres aliaser.</p>
      ${status()}
      <div id="iv-foreloebig">${foreloebigHtml()}</div>
      <div id="iv-gennemgang">${gennemgangHtml()}</div>
      <div class="rakke venstre"><button type="button" class="knap" data-tpid="iv-oversigt" data-h="ivOversigt">${ik('tag')} Se oversigt</button></div>
      ${reglerHtml()}
      <h2>Ret mange ingredienser med Claude</h2>
      <p class="lille">Til at lægge dubletter sammen og flytte ord som «finthakket» fra navnet. Intet gemmes, før du har set ændringerne.</p>
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
    [D, kopiListe, G] = await Promise.all([hentAlt(), api('ingrediens_backup?select=id,oprettet,note,antal&order=oprettet.desc&limit=20'),
      api('ingrediens_gennemgang?select=*&order=oprettet.desc&limit=200').catch(() => [])]); // uden tabellen er listen tom
  }
  async function side() {
    app.innerHTML = `${Ikoner.tilbage('#/vaerksted')}<h2>Ingrediensværktøj</h2><p class="lille">Henter…</p>`;
    R = null; valg = {}; rettelse = null; soeg = ''; ed = null;
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
  document.addEventListener('change', e => { // valget af slags i reglens vindue
    if (e.target.name !== 'rgslags' || !ed) return;
    laesVinduet(); ed.slags = e.target.value; tegnRaekker();
  });
  document.addEventListener('input', e => { // søgningen i listen over regler
    if (e.target.id !== 'ivsoeg') return;
    soeg = e.target.value; $('#iv-regler').innerHTML = reglerListe();
  });
  Object.assign(H, {
    ivRegel(el) { // tilpas en regel (data-v), lav et alias til en ingrediens (data-n) eller en ny regel
      const r = el.dataset.v && D.regler.find(x => x.id === el.dataset.v);
      if (el.dataset.v && !r) return toast('Reglen findes ikke mere');
      aabnVindue(r ? regelAf(r) : { id: null, version: null, tekst: '', slags: 'vare', varer: [{ navn: el.dataset.n ? ingNavn(el.dataset.n) : '', f: '' }] });
    },
    async ivRegelSlet(el) { // fjern et alias fra en ingrediens. Deles det med en anden, fjernes kun denne ingrediens.
      const r = D.regler.find(x => x.id === el.dataset.v), nr = el.dataset.n;
      if (!r) return toast('Reglen findes ikke mere');
      const rest = nr ? r.resultat.filter(v => v.id !== nr) : [];
      if (rest.length && rest.length < r.resultat.length) {
        if (!await bekraeft(`Vil du fjerne «${r.tekst}» fra «${ingNavn(nr)}»? Det gælder stadig for ${rest.map(v => '«' + ingNavn(v.id) + '»').join(', ')}. Opskrifter, der allerede er gemt, ændres ikke.`, 'Fjern')) return;
        return gemRegel({ id: r.id, version: r.version, tekst: r.tekst, slags: rest.length > 1 ? r.slags : r.slags === 'eller' ? 'vare' : r.slags, resultat: rest }, 'Aliaset er fjernet');
      }
      if (!await bekraeft(`Vil du fjerne «${r.tekst}»? Opskrifter, der allerede er gemt, ændres ikke.`, 'Fjern')) return;
      await sletRegel(r.id, r.version);
    },
    async ivAliasNy(el) { // et nyt alias til en ingrediens (data-n). Findes teksten som alias for en anden, deles det: så er én af dem nok.
      const id = el.dataset.n, felt = document.querySelector(`[data-alias="${id}"]`), t = norm(felt && felt.value);
      if (!t) { toast('Skriv det nye alias først'); return felt && felt.focus(); }
      if (/[(),;]/.test(t)) return toast('Et alias må ikke have komma eller parentes');
      if (D.ing.some(x => x.navn_norm === t)) return toast(`«${t}» er allerede en ingrediens. Læg dem sammen med Claude, eller brug «Egen ingrediens».`);
      const r = D.regler.find(x => x.tekst === t);
      if (!r) return gemRegel({ tekst: t, slags: 'vare', resultat: [{ id }] }, 'Aliaset er gemt');
      if (r.resultat.some(v => v.id === id)) return toast(`«${t}» er allerede et alias for «${ingNavn(id)}»`);
      if (!(r.slags === 'vare' || r.slags === 'eller') || r.resultat.some(v => v.f)) return toast(`«${t}» er allerede en regel med en anden betydning. Tilpas den under «Ny regel».`);
      if (!await bekraeft(`«${t}» er allerede et alias for ${r.resultat.map(v => '«' + ingNavn(v.id) + '»').join(', ')}. Skal det også gælde «${ingNavn(id)}»? Så er én af dem nok i en opskrift.`, 'Del aliaset')) return;
      await gemRegel({ id: r.id, version: r.version, tekst: t, slags: 'eller', resultat: [...r.resultat, { id }] }, 'Aliaset deles nu');
    },
    async ivSlags(el) { // «a» er en slags «b»: a får b som fællesnavn (ét niveau)
      const a = D.ing.find(x => x.id === el.dataset.n), b = valgIng(el, a.id, 'fællesnavnet');
      if (b) await retPakke({ faelles: [{ id: a.id, faelles_id: b.id }] }, 'før «slags af»', `«${a.navn}» er nu en slags «${b.navn}»`);
    },
    async ivSlagsFjern(el) { const a = D.ing.find(x => x.id === el.dataset.n); await retPakke({ faelles: [{ id: a.id, faelles_id: null }] }, 'før «slags af» fjernes', `«${a.navn}» er ikke længere en slags af noget`); },
    async ivSamme(el) { // to ingredienser, der kan erstatte hinanden 1:1 (en gruppe på mindst to)
      const a = D.ing.find(x => x.id === el.dataset.n), b = valgIng(el, a.id, 'ingrediensen');
      if (!b) return;
      try { await api('rpc/ingrediens_samme', { method: 'POST', body: { p: { ids: [a.id, b.id] } } }); }
      catch (e) { console.error(e); return fejlbesked(serverFejl(e) || 'Det blev ikke gemt. Tjek internettet, og prøv igen.'); }
      await efterRegel(`«${a.navn}» er nu samme som «${b.navn}»`);
    },
    async ivSammeFjern(el) {
      const a = D.ing.find(x => x.id === el.dataset.n);
      try { await api('rpc/ingrediens_samme_fjern', { method: 'POST', body: { p: { id: a.id } } }); }
      catch (e) { console.error(e); return fejlbesked(serverFejl(e) || 'Det blev ikke gemt. Tjek internettet, og prøv igen.'); }
      await efterRegel(`«${a.navn}» er ikke længere samme som de andre`);
    },
    async ivTilAlias(el) { // «a» bliver et alias af «b»: a lægges sammen med b, og a's navn bliver et alias. Opskrifter og Derhjemme følger med.
      const a = D.ing.find(x => x.id === el.dataset.n), b = valgIng(el, a.id, 'ingrediensen');
      if (!b) return;
      const r = beregn(D, { ingredienser: [{ id: a.id, navn: b.navn_norm }] }, {});
      if (r.fejl.length) return fejlbesked(r.fejl[0]);
      if (r.oversigt.nye.length) return fejlbesked('Der er linjer i opskrifter, som ikke er knyttet til kataloget endnu. Tryk først på «Vis ændringerne» længere nede.');
      if (!await bekraeft(`«${a.navn}» bliver et alias af «${b.navn}». Opskrifter og «Derhjemme» følger med, og teksten «${a.navn}» virker stadig. Der gemmes en kopi først.`, 'Gør til alias')) return;
      await retPakke(r.payload, 'før alias', `«${a.navn}» er nu et alias af «${b.navn}»`);
    },
    async ivFbGodkend(el) { // en foreløbig ingrediens godkendes med den valgte kategori
      const i = D.ing.find(x => x.id === el.dataset.n), k = document.querySelector(`[data-fkat="${i.id}"]`);
      try {
        await api(`ingredienser?id=eq.${enc(i.id)}`, { method: 'PATCH', body: { foreloebig: false, kategori_id: k && k.value || i.kategori_id } });
        await api(`ingrediens_gennemgang?ingrediens_id=eq.${enc(i.id)}&slags=eq.ny`, { method: 'DELETE' }).catch(() => {});
      } catch (e) { console.error(e); return fejlbesked('Det blev ikke godkendt. Tjek internettet, og prøv igen.'); }
      G = G.filter(g => !(g.ingrediens_id === i.id && g.slags === 'ny')); tegnGennemgang();
      await efterRegel(`«${i.navn}» er godkendt`);
    },
    async ivFbAlle() {
      const n = D.ing.filter(i => i.foreloebig).length;
      if (!await bekraeft(`Vil du godkende alle ${n} med den kategori, de har nu? Du kan stadig ændre kategorien bagefter.`, 'Godkend')) return;
      try {
        await api('ingredienser?foreloebig=is.true', { method: 'PATCH', body: { foreloebig: false } });
        await api('ingrediens_gennemgang?slags=eq.ny', { method: 'DELETE' }).catch(() => {});
      } catch (e) { console.error(e); return fejlbesked('Det blev ikke godkendt. Tjek internettet, og prøv igen.'); }
      G = G.filter(g => g.slags !== 'ny'); tegnGennemgang();
      await efterRegel('Alle er godkendt');
    },
    ivEgen(el) { // et alias eller en regel bliver til en ingrediens for sig selv
      const r = D.regler.find(x => x.id === el.dataset.v);
      if (!r) return toast('Reglen findes ikke mere');
      const i = r.resultat.length && D.ing.find(x => x.id === r.resultat[0].id);
      aabnNy(r.tekst, i && i.kategori_id, r);
    },
    ivNy() { aabnNy('', null, null); },
    ivOversigt() { const d = ark(oversigtHtml()); $('.ark-bag', d).addEventListener('click', lukArk); },
    async ivGodkend(el) {
      try { await api(`ingrediens_gennemgang?id=eq.${enc(el.dataset.v)}`, { method: 'DELETE' }); } catch (e) { return fejlbesked('Det blev ikke godkendt. Tjek internettet, og prøv igen.'); }
      G = G.filter(g => g.id !== el.dataset.v); tegnGennemgang();
    },
    async ivGodkendAlle() {
      if (!await bekraeft(`Vil du godkende alle ${G.length}? De fjernes fra listen. Ingredienserne ændres ikke.`, 'Godkend')) return;
      try { await api('ingrediens_gennemgang?id=not.is.null', { method: 'DELETE' }); } catch (e) { return fejlbesked('Det blev ikke godkendt. Tjek internettet, og prøv igen.'); }
      G = []; tegnGennemgang();
    },
    ivSe(el) { // find ingrediensen i listen over aliaser
      const g = G.find(x => x.id === el.dataset.v), i = g && (g.ingrediens_id && D.ing.find(x => x.id === g.ingrediens_id));
      soeg = i ? i.navn_norm : (g ? norm(g.tekst) : ''); const f = $('#ivsoeg'); if (f) { f.value = soeg; $('#iv-regler').innerHTML = reglerListe(); f.scrollIntoView({ block: 'center' }); }
    },
    async ivNyGem() {
      const navn = norm($('#nyNavn').value), kategori_id = $('#nyKat').value || null;
      if (!navn || /[(),;]/.test(navn)) return arkFejl([!navn ? 'Skriv et navn.' : 'Et navn må ikke have komma eller parentes.']);
      if (D.ing.some(x => x.navn_norm === navn)) return arkFejl([`«${navn}» findes allerede som ingrediens.`]);
      const knap = $('[data-h="ivNyGem"]'); knap.disabled = true;
      const fra = ny_fra; let slettet = false;
      try {
        if (fra) { const s = await api('rpc/ingrediens_regel_slet', { method: 'POST', body: { id: fra.id, version: fra.version } }); if (!s.ok) { knap.disabled = false; await efterRegel(); return toast('Reglen er ændret af en anden. Prøv igen.'); } slettet = true; }
        await Katalog.opret([{ navn, kategori_id }]);
      } catch (e) {
        console.error(e); knap.disabled = false;
        if (slettet) try { await api('rpc/ingrediens_regel_gem', { method: 'POST', body: { tekst: fra.tekst, slags: fra.slags, resultat: fra.resultat } }); } catch (x) { console.error(x); } // sæt reglen tilbage
        return arkFejl([`«${navn}» blev ikke oprettet${slettet ? ', og reglen er sat tilbage' : ''}. Tjek internettet, og prøv igen.`]);
      }
      await efterRegel(fra ? `«${navn}» er nu en ingrediens` : 'Ingrediensen er oprettet');
    },
    rgTilfoej() { laesVinduet(); ed.varer.push({ navn: '', f: '' }); tegnRaekker(); const i = $('#rgv' + (ed.varer.length - 1)); if (i) i.focus(); },
    rgFjern(el) { laesVinduet(); ed.varer.splice(Number(el.dataset.v), 1); tegnRaekker(); },
    async rgGem() {
      const { t, resultat, fejl } = loes();
      if (fejl.length) return arkFejl(fejl);
      arkFejl([]); ed.t = t; ed.resultat = resultat;
      await sendGem();
    },
    rgBrugDeres() { aabnVindue(regelAf(ed.deres)); },
    rgBrugFindes() { aabnVindue(regelAf(ed.findes)); },
    async rgAlligevel() { // efter at have set den andens udgave
      ed.version = ed.deres.version;
      if (ed.hvad === 'slet') return sletRegel(ed.id, ed.deres.version);
      await sendGem();
    },
    async rgSomNy() { ed.id = null; ed.version = null; await sendGem(); },
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
  return { side, beregn, eksport, laes };
})();
