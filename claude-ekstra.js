// «Opdater opskrift med Claude» og «Tilføj tips med Claude». Samme vej som «Tilføj med Claude»:
// appen laver en besked, du sætter ind hos Claude, og så sætter du Claudes svar ind her. Ingen nøgler i koden.
const ClaudeEkstra = (() => {
  let O = null, TI = null; // O: opskriften, der opdateres. TI: opskrifter og tips, der allerede findes.
  const felter = (pre, id) => `<div class="felt-knapper"><button type="button" class="knap" data-tpid="${pre}-saet" data-h="saetInd" data-v="${id}">Sæt ind</button><span class="hoejre"><button type="button" class="knap mini" data-tpid="${pre}-fortryd" data-h="fortrydRyd" data-v="${id}" hidden>Fortryd</button><button type="button" class="knap mini fare" data-tpid="${pre}-ryd" data-h="rydFelt" data-v="${id}">Ryd</button></span></div>`;
  const side = ({ tilbage, titel, tekst1, husk, pre, kopierH, gemH, gemTekst, plads, ekstra = '', udenEgen = false }) => {
    app.innerHTML = `<a class="tilbage" href="${tilbage}">‹ Tilbage</a><h1>${esc(titel)}</h1>
      <ol class="trin vejledning">
        <li>${tekst1}
          ${udenEgen ? '' : `<textarea id="egen" rows="5" data-husk="${husk}" placeholder="Skriv her" aria-label="Din besked"></textarea>
          ${felter(pre + '-egen', 'egen')}`}
          <button class="knap primaer stor" data-tpid="${pre}-kopier" data-h="${kopierH}">${ik('gnist')} Kopiér besked</button></li>
        <li>Åbn Claude, og sæt beskeden ind, hvis feltet er tomt.
          <div class="rakke venstre"><a class="knap stor" data-tpid="aabn-claude" id="aabnClaude" href="https://claude.ai/new" target="_blank" rel="noopener">Åbn Claude ›</a></div></li>
        <li>Kopiér Claudes svar, og sæt det ind her:
          <textarea id="claudesvar" rows="7" data-husk="${husk}Svar" placeholder="${plads}" aria-label="Claudes svar"></textarea>
          ${felter(pre + '-svar', 'claudesvar')}</li>
      </ol>
      <div id="formfejl"></div>
      <button class="knap primaer stor" data-tpid="${pre}-gem" data-h="${gemH}">${gemTekst}</button>${ekstra}`;
    document.querySelectorAll('textarea[data-husk]').forEach(t => { t.value = lager.hent(t.dataset.husk, ''); });
    Hjaelper.side([
      ...(udenEgen ? [] : [{ tekst: 'Skriv her, hvad Claude skal gøre.', maal: '#egen', bev: 'salto' }]),
      { tekst: 'Tryk her. Så kopierer jeg en besked til Claude.', maal: `[data-h=${kopierH}]`, bev: 'skridt' },
      { tekst: 'Åbn Claude, og sæt beskeden ind.', maal: '#aabnClaude', bev: 'dans' },
      { tekst: 'Sæt Claudes svar ind her. Tryk så på knappen nederst.', maal: '#claudesvar', bev: 'rul' }]);
  };
  async function kopierTil(besked) {
    const ok = await kopier(besked), kodet = encodeURIComponent(besked);
    $('#aabnClaude').href = 'https://claude.ai/new' + (kodet.length < 7000 ? '?q=' + kodet : ''); // for lang til adressen: beskeden ligger i udklipsholderen
    toast(ok ? 'Beskeden er kopieret' : 'Beskeden kunne ikke kopieres');
  }
  const fejlboks = t => { $('#formfejl').innerHTML = `<div class="fejlboks">${esc(t)}</div>`; };
  const FELTER = ['titel', 'kategori', 'koekken', 'svaerhed', 'tid_minutter', 'portioner', 'ingredienser', 'fremgangsmaade'];
  const sikkerhedskopi = () => { const k = lager.hent('opdatFoer', null); return k && O && k.id === O.r.id ? k : null; };

  async function opdaterSide(rid) {
    const id = visning;
    henter();
    const [r] = await api(`opskrifter?id=eq.${enc(rid)}&select=*`);
    if (id !== visning) return;
    if (!r) return info('Opskriften findes ikke længere.<br><a href="#/opskrifter">Tilbage til Opskrifter</a>');
    O = { r };
    Katalog.hent().catch(() => {});
    side({ tilbage: `#/opskrifter/${r.id}`, titel: 'Opdater med Claude', husk: 'opdaterEgen', pre: 'opdat', kopierH: 'kopierOpdat', gemH: 'gemOpdat', gemTekst: 'Gem ændringerne',
      udenEgen: true,
      tekst1: `Claude skriver «${esc(r.titel)}» om, så den følger skabelonen. Tryk på knappen. Så kopierer jeg beskeden med din opskrift.`,
      plads: '{ "navn": "…" }',
      ekstra: sikkerhedskopi() ? '<button class="knap stor" data-tpid="opdat-gendan" data-h="gendanOpdat">Gendan det, der stod før</button>' : '' });
  }
  async function tipsSide() {
    const id = visning;
    henter();
    const [opsk, tips] = await Promise.all([api('opskrifter?select=id,titel&order=titel'), api('tips?select=id,titel')]);
    if (id !== visning) return;
    TI = { opsk, tips };
    side({ tilbage: '#/tips', titel: 'Tilføj tips med Claude', husk: 'tipsEgen', pre: 'tips', kopierH: 'kopierTips', gemH: 'gemTips', gemTekst: 'Gem tipsene',
      tekst1: 'Skriv, hvad tipsene skal handle om, fx «tips til at koge ris» eller «sæt en opskrift eller et link ind». Står der intet, laver Claude tips til dine opskrifter.',
      plads: '[ { "navn": "…", "tekst": "…" } ]' });
  }
  function laesTips(tekst) {
    const s = String(tekst).replace(/[“”]/g, '"');
    if (!s.trim()) return { fejl: 'Feltet er tomt. Sæt Claudes svar ind først.' };
    const a1 = s.indexOf('['), a2 = s.indexOf('{');
    if (a1 === -1 && a2 === -1) return { fejl: 'Det ligner ikke Claudes svar. Det skal begynde med [ og slutte med ]. Kopiér hele svaret, og prøv igen.' };
    let j;
    try { j = a1 !== -1 && (a2 === -1 || a1 < a2) ? JSON.parse(s.slice(a1, s.lastIndexOf(']') + 1)) : JSON.parse(s.slice(a2, s.lastIndexOf('}') + 1)); }
    catch (e) { return { fejl: 'Svaret kan ikke læses. Der mangler nok noget af teksten. Kopiér hele Claudes svar, og prøv igen.' }; }
    if (!Array.isArray(j)) j = Array.isArray(j && j.tips) ? j.tips : [j];
    const liste = j.map(x => ({ titel: enLinje((x && (x.navn ?? x.titel)) || ''), tekst: enLinje(tekstAf(x)), opskrift: enLinje((x && x.opskrift) || '') })).filter(x => x.tekst);
    return liste.length ? { liste } : { fejl: 'Der er ingen tips i svaret. Bed Claude om at svare igen i det rigtige format.' };
  }

  Object.assign(H, {
    async kopierOpdat() { // samme besked som «Tilføj med Claude», med den nuværende opskrift som tekst
      await Katalog.hent().catch(() => {});
      const r = O.r, f = r.portioner || 4;
      await kopierTil(lavBesked() + [r.titel, `${f} portioner`, '', 'Ingredienser:', ...ingListe(r).map(x => 'g' in x ? x.g + ':' : visIng(x)), '', 'Sådan gør du:', trinTilTekst(trinAf(r))].join('\n') + '\n');
    },
    async gemOpdat(el) {
      const svar = laesImport($('#claudesvar').value);
      if (svar.fejl) return fejlboks(svar.fejl);
      if (svar.liste) return fejlboks('Svaret har flere opskrifter. Her skal der kun være én.');
      const d = svar.data, r = O.r, ny = { titel: d.titel, ingredienser: d.ingredienser, fremgangsmaade: d.fremgangsmaade };
      ['kategori', 'koekken', 'svaerhed', 'tid_minutter', 'portioner'].forEach(k => { if (d[k] != null) ny[k] = d[k]; });
      el.disabled = true;
      try {
        lager.gem('opdatFoer', { id: r.id, data: Object.fromEntries(FELTER.map(k => [k, r[k] ?? null])) }); // så man kan fortryde
        await api(`opskrifter?id=eq.${enc(r.id)}`, { method: 'PATCH', body: ny });
        try { await Katalog.laeg(ingAf(ny).map(i => i.n), {}, svar.kat); } catch (e) { console.error(e); }
        lager.gem('opdaterEgen', ''); lager.gem('opdaterEgenSvar', '');
        toast('Opskriften er opdateret'); Hjaelper.glad('Opskriften er opdateret!');
        location.hash = `#/opskrifter/${r.id}`;
      } catch (err) { el.disabled = false; throw err; }
    },
    async gendanOpdat() {
      const k = sikkerhedskopi();
      if (!k) return;
      await api(`opskrifter?id=eq.${enc(k.id)}`, { method: 'PATCH', body: k.data });
      lager.gem('opdatFoer', null);
      toast('Den gamle opskrift er sat tilbage');
      location.hash = `#/opskrifter/${k.id}`;
    },
    async kopierTips() {
      const emne = $('#egen').value.trim(), titler = a => a.map(x => x.titel).filter(Boolean).slice(0, 200).join(', ');
      await kopierTil(`Skriv tips til min kogebog-app. Et tip er et lille råd, som en 10-årig kan bruge, fx «Kom salt i vandet, før pastaen».

Regler:
- Skriv på dansk. Korte sætninger, 1 til 3 pr. tip.
- "navn" er ordet eller udtrykket, som det kan stå i en opskrift, fx "koge ris". Så bliver ordet i opskriften til et link. Hold det kort: 1 til 3 ord.
- Skriv kun tips, du ved er rigtige. Gæt ikke.
- Hører et tip til en af mine opskrifter, så skriv opskriftens titel i "opskrift". Ellers udelad "opskrift".
${TI.opsk.length ? `- Mine opskrifter: ${titler(TI.opsk)}.\n` : ''}${TI.tips.some(t => t.titel) ? `- Disse tips findes allerede. Lav dem ikke igen: ${titler(TI.tips)}.\n` : ''}
Svar KUN med JSON i en kodeblok, uden anden tekst, i præcis dette format:
[
  { "navn": "koge ris", "tekst": "Skyl risene, til vandet er klart. Så klistrer de ikke sammen." },
  { "navn": "forvarme ovnen", "tekst": "Tænd ovnen i god tid. Den skal være varm, før maden kommer ind.", "opskrift": "Lasagne" }
]

Det skal tipsene handle om:
${emne || 'Lav tips til de opskrifter, jeg har.'}
`);
    },
    async gemTips(el) {
      const svar = laesTips($('#claudesvar').value);
      if (svar.fejl) return fejlboks(svar.fejl);
      el.disabled = true;
      try {
        const set = [...TI.tips]; let gemt = 0, sprunget = 0;
        for (const t of svar.liste) {
          if (t.titel && findNavn(set, t.titel)) { sprunget++; continue; }
          const o = t.opskrift ? findNavn(TI.opsk, t.opskrift) : null;
          const [ny] = await api('tips', { method: 'POST', body: { titel: t.titel || null, tekst: t.tekst, opskrift_id: o ? o.id : null } });
          set.push(ny); gemt++;
        }
        lager.gem('tipsEgen', ''); lager.gem('tipsEgenSvar', '');
        const tekst = gemt ? `${gemt} ${gemt === 1 ? 'tip er gemt' : 'tips er gemt'}${sprunget ? `. ${sprunget} fandtes allerede` : ''}` : 'Alle tipsene fandtes allerede';
        toast(tekst); if (gemt) Hjaelper.glad('Tipsene er gemt!');
        location.hash = '#/tips';
      } catch (err) { el.disabled = false; throw err; }
    }
  });
  return { opdaterSide, tipsSide };
})();
