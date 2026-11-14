// Styr på ingredienser, fase 3 (2.15.0): flytning af data. Køres én gang i browseren på appens side (ikke en del af appen).
// Regner pakken ud til «ingrediens_ret» (supabase/ingredienser.sql), som gemmer en kopi først og retter alt eller intet.
// data: { ing, kat, hj, ops } som i ingvaerktoej.js, plus bk (kopien fra før 14. nov.) og rf (rettelsesfilen fra 14. nov.).
const Flytning = (() => {
  // Rasmus' valg (godkendes, før kørslen)
  const VALG = {
    // Varianter under et fællesnavn. ord: ordene i tilberedningen (f), der flytter linjen til varianten. «blade» betyder friske blade.
    varianter: [
      { faelles: 'basilikum', navn: 'frisk basilikum', kat: 'Grøntsager', ord: ['frisk', 'blade'] },
      { faelles: 'dild', navn: 'frisk dild', kat: 'Grøntsager', ord: ['frisk'] },
      { faelles: 'koriander', navn: 'frisk koriander', kat: 'Grøntsager', ord: ['frisk', 'blade'] },
      { faelles: 'koriander', navn: 'stødt koriander', kat: 'Krydderier', ord: ['stødt'] },
      { faelles: 'oregano', navn: 'frisk oregano', kat: 'Grøntsager', ord: ['frisk'] },
      { faelles: 'oregano', navn: 'tørret oregano', kat: 'Krydderier', ord: ['tørret'] },
      { faelles: 'rosmarin', navn: 'tørret rosmarin', kat: 'Krydderier', ord: ['tørret'] },
      { faelles: 'timian', navn: 'frisk timian', kat: 'Grøntsager', ord: ['frisk'] },
      { faelles: 'timian', navn: 'tørret timian', kat: 'Krydderier', ord: ['tørret'] },
    ],
    // «Derhjemme»: fællesnavn -> variant
    hjemme: { basilikum: 'frisk basilikum', koriander: 'stødt koriander', oregano: 'tørret oregano', rosmarin: 'tørret rosmarin', timian: 'tørret timian' },
    // Gamle navne, der ikke bliver regler (kan betyde flere ting). Navne med «og» eller «eller» bliver aldrig regler her.
    ikkeRegel: ['gris', 'mel', 'bønner', 'grøn peber', 'rød peber'],
  };
  const norm = s => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  const ordAf = f => String(f || '').split(',').map(norm).filter(Boolean);
  const OG_ELLER = /(^| )(og|eller)( |$)/;

  function beregn(data, valg = VALG) {
    const { ing, kat, hj, ops, bk, rf } = data, fejl = [];
    const navn = new Map(ing.map(i => [i.navn_norm, i])), id = new Map(ing.map(i => [i.id, i]));
    const katId = n => (kat.find(k => norm(k.navn) === norm(n)) || {}).id || null;
    // 1. Varianterne
    const ny = [], faelles = [], variant = new Map(); // navn -> { id, faellesId, ord }
    for (const v of valg.varianter) {
      const f = navn.get(v.faelles);
      if (!f) { fejl.push(`Fællesnavnet «${v.faelles}» findes ikke.`); continue; }
      if (f.faelles_id) { fejl.push(`«${v.faelles}» er selv en variant.`); continue; }
      const fandtes = navn.get(v.navn), vid = fandtes ? fandtes.id : crypto.randomUUID();
      if (!fandtes) ny.push({ id: vid, navn: v.navn, navn_norm: v.navn, kategori_id: katId(v.kat) });
      faelles.push({ id: vid, faelles_id: f.id });
      variant.set(v.navn, { id: vid, faellesId: f.id, ord: v.ord });
    }
    // Finder varianten til en vare på fællesnavnet ud fra tilberedningen. Ordet «frisk» fjernes fra f, «blade» bliver stående.
    const tilVariant = (vareId, f) => {
      const ord = ordAf(f);
      for (const [vn, v] of variant) if (v.faellesId === vareId) {
        const hit = v.ord.find(o => ord.includes(o));
        if (hit) return { id: vn, f: ord.filter(o => o !== 'frisk' && o !== 'tørret' && o !== 'stødt').join(', ') };
      }
      return null;
    };
    // 2. Linjerne
    const opskrifter = [], linjer = [];
    let paaFaelles = 0, antal = 0;
    for (const o of ops) {
      const liste = Array.isArray(o.ingredienser) ? o.ingredienser : [];
      let aendret = false;
      const nyListe = liste.map(l => {
        if (!l || typeof l !== 'object' || 'g' in l || 'eller' in l) return l;
        antal++;
        if (!id.has(l.id)) { fejl.push(`En linje i «${o.titel}» peger ikke på en ingrediens: «${l.n}».`); return l; }
        if (!valg.varianter.some(v => v.faelles === id.get(l.id).navn_norm)) return l;
        const t = tilVariant(l.id, l.f);
        if (!t) { paaFaelles++; linjer.push({ opskrift: o.titel, foer: l.n + (l.f ? ', ' + l.f : ''), efter: 'bliver på fællesnavnet' }); return l; }
        aendret = true;
        const x = { ...l, id: variant.get(t.id).id, n: t.id };
        if (t.f) x.f = t.f; else delete x.f;
        linjer.push({ opskrift: o.titel, foer: l.n + (l.f ? ', ' + l.f : ''), efter: x.n + (x.f ? ', ' + x.f : '') });
        return x;
      });
      if (aendret) opskrifter.push({ id: o.id, ingredienser: nyListe });
    }
    // 3. «Derhjemme»
    const hjemme = [], hjemmeListe = [];
    for (const h of hj) {
      const i = id.get(h.ingrediens_id);
      if (!i || !valg.varianter.some(v => v.faelles === i.navn_norm)) continue;
      const vn = valg.hjemme[i.navn_norm];
      if (!vn || !variant.has(vn)) { fejl.push(`«${i.navn}» står i «Derhjemme», men der er ikke valgt en variant.`); continue; }
      hjemme.push({ id: h.id, ingrediens_id: variant.get(vn).id });
      hjemmeListe.push({ foer: i.navn, efter: vn });
    }
    // 4. Regler: de gamle navne på brugte ingredienser, der blev lagt sammen eller omdøbt 14. nov.
    const brugt = new Set(), gHj = new Set(bk.hjemme.map(h => h.ingrediens_id));
    for (const o of bk.opskrifter) for (const l of Array.isArray(o.ingredienser) ? o.ingredienser : []) if (l && l.id) brugt.add(l.id);
    const regler = [], ikke = [], set = new Set();
    for (const g of bk.ingredienser) {
      if (!brugt.has(g.id) && !gHj.has(g.id)) continue;
      const r = rf.find(x => g.id.startsWith(x.id)), tekst = norm(g.navn);
      let maal, f = r && r.f ? norm(r.f) : '';
      if (id.has(g.id)) { maal = id.get(g.id); if (maal.navn_norm === tekst) continue; }
      else { if (!r || r.slet) { fejl.push(`«${g.navn}» blev slettet 14. nov., men var brugt.`); continue; } maal = navn.get(norm(r.navn)); }
      if (!maal) { fejl.push(`«${g.navn}» blev til «${r.navn}», som ikke findes.`); continue; }
      let mId = maal.id, mNavn = maal.navn_norm;
      const t = tilVariant(maal.id, f);
      if (t) { mId = variant.get(t.id).id; mNavn = t.id; f = t.f; }
      if (tekst === mNavn || variant.has(tekst)) continue; // navnet findes (fx «frisk timian» bliver en vare)
      if (OG_ELLER.test(tekst)) { ikke.push({ tekst, grund: '«og» eller «eller»', til: mNavn }); continue; }
      if (valg.ikkeRegel.includes(tekst)) { ikke.push({ tekst, grund: 'kan betyde flere ting', til: mNavn + (f ? ', ' + f : '') }); continue; }
      if (navn.has(tekst)) { fejl.push(`«${tekst}» er navnet på en ingrediens og kan ikke blive en regel.`); continue; }
      if (set.has(tekst)) continue;
      set.add(tekst);
      regler.push({ tekst, slags: 'vare', resultat: [f ? { id: mId, f } : { id: mId }], vis: mNavn + (f ? ', ' + f : '') });
    }
    const payload = { antal: ing.length, note: 'før flytning (2.15.0)', ny, faelles, hjemme, hjemme_antal: hj.length,
      regler: regler.map(({ vis, ...r }) => r), opskrifter };
    const da = (a, b) => a.localeCompare(b, 'da');
    return { fejl, payload, oversigt: {
      varianter: valg.varianter.map(v => `${v.faelles} → ${v.navn}${navn.has(v.navn) ? ' (findes)' : ''}`),
      aliaser: regler.filter(r => !r.resultat[0].f).map(r => `${r.tekst} → ${r.vis}`).sort(da),
      medTilberedning: regler.filter(r => r.resultat[0].f).map(r => `${r.tekst} → ${r.vis}`).sort(da),
      ikke: ikke.map(x => `${x.tekst} (${x.grund}, ville blive ${x.til})`).sort(da),
      linjer, paaFaelles, antalLinjer: antal, hjemme: hjemmeListe } };
  }
  return { VALG, beregn };
})();
