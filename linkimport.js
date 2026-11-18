// «Importér opskrift»: ét felt til det hele. Links hentes én efter én via Supabase-funktionen «hent-opskrift» (hjemmesider med billede,
// og TikTok, Instagram og Facebook, når opskriften står i teksten under opslaget). Tekst, man sætter ind eller selv skriver, læses her i appen (Tekstlaeser, se tekstlaeser.js).
// Alt gemmes som almindelige opskrifter. Ingen nøgler i koden (kun den offentlige).
const LinkImport = (() => {
  const SAMTIDIG = 4, BATCH = 10, FUNKTION = SUPABASE_URL + '/functions/v1/hent-opskrift';
  let koerer = false, stop = false;
  const HOVED = { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
  const SOCIALT = /(^|\.)(tiktok\.com|instagram\.com|facebook\.com|fb\.watch|threads\.net)$/i;
  const socialt = url => { try { return SOCIALT.test(new URL(url).hostname); } catch (e) { return false; } };
  const LINK = /https?:\/\/[^\s<>"']+/g;

  // ---------- Fri tekst -> opskrift ----------
  // Læsningen af fri tekst ligger i tekstlaeser.js (Tekstlaeser): den forstår tekst med og uden overskrifter, uden mængder, med stavefejl og i mange stile.
  // Her bruges den til tekst, man har sat ind eller skrevet, og til ingredienser og trin fra hjemmesider.
  const { ingLinjer, trinFraFunktion, svaerhedAf, pænNavn } = Tekstlaeser, tekstTilOpskrift = Tekstlaeser.tilOpskrift;

  const KAT = [[/forret|starter|appetizer|snack/i, 'Forret'], [/salat|salad/i, 'Salat'], [/dessert|kage|cake|cookie|bag|sweet|sød/i, 'Dessert'],
    [/tilbehør|side/i, 'Tilbehør'], [/drik|drink|beverage|smoothie|cocktail/i, 'Drikke'], [/hoved|main|aften|middag|dinner|lunch|supper/i, 'Hovedret']];
  const KOEKKEN = { danish: 'Dansk', italian: 'Italiensk', asian: 'Asiatisk', chinese: 'Asiatisk', thai: 'Asiatisk', japanese: 'Asiatisk', korean: 'Asiatisk', vietnamese: 'Asiatisk',
    spanish: 'Spansk', mexican: 'Mexicansk', french: 'Fransk', indian: 'Indisk', american: 'Amerikansk', greek: 'Græsk', 'middle eastern': 'Mellemøstlig', lebanese: 'Mellemøstlig', turkish: 'Mellemøstlig' };
  const mapKat = t => { const s = String(t || ''); const fast = OPSKRIFT_KAT.find(k => k.toLowerCase() === s.toLowerCase()); if (fast) return fast; const m = KAT.find(([re]) => re.test(s)); return m ? m[1] : null; };
  const LAND = { grækenland: 'Græsk', italien: 'Italiensk', frankrig: 'Fransk', spanien: 'Spansk', mexico: 'Mexicansk', indien: 'Indisk', danmark: 'Dansk', usa: 'Amerikansk', amerika: 'Amerikansk', libanon: 'Mellemøstlig', tyrkiet: 'Mellemøstlig' };
  const mapKoekken = t => { // «Dansk, Sydamerikansk» -> første; «Grækenland» -> Græsk
    const s = String(t || '').split(',')[0].trim().toLowerCase(), fast = OPSKRIFT_KOEKKEN.find(k => k.toLowerCase() === s);
    return fast || KOEKKEN[s] || LAND[s] || (s ? s.charAt(0).toUpperCase() + s.slice(1) : null);
  };

  // «hakket kalv (med 10 % fedt)» -> «hakket kalv»: parenteser står ikke i ingrediensnavne, og navnet bruges til at finde kategori
  const renIng = t => { const u = String(t).replace(/\s*\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').replace(/[\s,;:]+$/, '').trim(); return u || String(t); };
  const laesLinks = tekst => [...new Set((String(tekst).match(LINK) || []).map(l => l.replace(/[.,;)\]]+$/, '')))];
  const fejlboks = t => { const e = $('#formfejl'); if (e) e.innerHTML = t ? `<div class="fejlboks">${esc(t)}</div>` : ''; };

  async function hentEn(url) { // giver { data } fra appens egen læser, eller kaster en fejl på dansk
    let svar;
    for (let forsoeg = 0; ; forsoeg++) {
      try {
        svar = await fetch(FUNKTION, { method: 'POST', headers: HOVED, body: JSON.stringify({ url }) });
        break;
      } catch (e) { if (forsoeg >= 1) throw new Error('Der er ingen forbindelse.'); await new Promise(r => setTimeout(r, 800)); }
    }
    if (svar.status === 404) { const e = new Error('Funktionen «hent-opskrift» findes ikke i Supabase endnu.'); e.fatal = true; throw e; }
    if (svar.status === 401 || svar.status === 403) { const e = new Error('Supabase afviste kaldet. Funktionen skal lægges ind uden «Verify JWT».'); e.fatal = true; throw e; }
    let j; try { j = await svar.json(); } catch (e) { throw new Error('Svaret kunne ikke læses.'); }
    if (!j.ok) throw new Error(j.fejl || 'Siden kunne ikke hentes.');
    let r;
    if (j.tekst) { // ingen færdig opskrift i siden (fx et opslag): teksten læses som fri tekst
      const t = tekstTilOpskrift(j.tekst.tekst, j.tekst.titel);
      if (t.fejl) throw new Error(socialt(url) ? 'Jeg kunne ikke finde ingredienser og trin i teksten under opslaget. Står opskriften kun i videoen, må du skrive den selv.'
        : 'Jeg kunne ikke finde en opskrift på siden. Kopiér opskriftens tekst fra siden, og sæt den ind i feltet.');
      r = laesEn(t.j);
    } else {
      const d = j.data;
      const ingr = d.ingredienser.map(Tekstlaeser.retStavning).flatMap(ingLinjer);
      r = laesEn({ navn: pænNavn(d.navn), kategori: mapKat(d.kategori), koekken: mapKoekken(d.koekken), svaerhed: svaerhedAf(ingr.length, d.tid), portioner: d.portioner, tid: d.tid, ingredienser: ingr, trin: trinFraFunktion(d.trin) });
    }
    if (r.fejl) throw new Error('Opskriften mangler navn, ingredienser eller trin.');
    r.billede = !socialt(url) && (j.data || j.tekst).billede || null; // billedet følger kun med fra hjemmesider
    return r;
  }
  // Billedet hentes gennem funktionen (siderne tillader ikke, at browseren henter det direkte) og gemmes som forside
  async function hentBillede(url, opskriftId) {
    const svar = await fetch(FUNKTION, { method: 'POST', headers: HOVED, body: JSON.stringify({ billede: url }) });
    if (!svar.ok || !/^image\//.test(svar.headers.get('content-type') || '')) throw new Error('Billedet kunne ikke hentes.');
    await Billeder.fraFil(opskriftId, await svar.blob());
  }

  function side() {
    const gemt = lager.hent('linksFaerdig', []).length;
    app.innerHTML = `${Ikoner.tilbage('#/opskrifter')}<h1>Importér opskrift</h1>
      <ol class="trin vejledning">
        <li>Sæt et link ind, sæt teksten fra en side ind, eller skriv opskriften selv. Har du flere links, så skriv ét på hver linje.
          <textarea id="imp" data-tpid="importer-tekst" rows="6" data-husk="importTekst" placeholder="https://… eller din opskrift" aria-label="Link eller opskrift"></textarea>
          ${feltKnapper('importer', 'imp')}
          <p class="lille">Skriver du selv? Navnet øverst. Så «Ingredienser» med én på hver linje, og «Sådan gør du» med trinnene.</p>
          <p class="lille">Har du opskriften i en fil? Word, PDF, tekst, mail eller en gemt hjemmeside. Tryk på «Vælg fil».</p>
          <div class="rakke venstre"><button type="button" class="knap" data-tpid="importer-fil" data-h="vaelgFil">Vælg fil</button></div>
          <input type="file" id="imp-fil" hidden accept=".txt,.md,.html,.htm,.eml,.json,.csv,.tsv,.rtf,.docx,.pdf,text/plain,text/html,application/pdf,message/rfc822,application/vnd.openxmlformats-officedocument.wordprocessingml.document"></li>
        <li>Tryk på Importér. Links henter jeg fra nettet, også fra TikTok, Instagram og Facebook, når opskriften står i teksten under opslaget. Hold siden åben imens.
          <div class="rakke venstre">
            <button class="knap hoved stor" data-tpid="importer-start" data-h="startLinks">${ik('gryde')} Importér</button>
            <button class="knap stor" data-tpid="importer-stop" data-h="stopLinks" hidden>Stop</button>
          </div></li>
        <li>Her kan du følge med:
          <p class="tekst-m" data-tpid="importer-status" id="status">Intet er startet endnu.</p>
          <div class="felt felt-s importbar" role="progressbar" aria-label="Fremdrift" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="barfyld"></i></div>
          <div id="fejlomraade"></div></li>
      </ol>
      <div id="formfejl"></div>
      ${gemt ? `<p class="lille">${gemt} links er allerede hentet fra før og springes over.</p>
      <button class="knap" data-tpid="importer-forfra" data-h="startForfra">Start forfra med alle links</button>` : ''}`;
    document.querySelectorAll('textarea[data-husk]').forEach(t => { t.value = lager.hent(t.dataset.husk, ''); });
    $('#imp-fil').addEventListener('change', e => { const fil = e.target.files[0]; e.target.value = ''; if (fil) laesFil($('[data-tpid=importer-fil]'), fil); });
    Hjaelper.side([
      { tekst: 'Sæt et link eller en opskrift ind her. Du kan også skrive selv.', maal: 'importer-tekst', bev: 'salto' },
      { tekst: 'Tryk på Importér. Så gemmer jeg opskriften for dig.', maal: 'importer-start', bev: 'skridt' },
      { tekst: 'Her ser du, hvor langt jeg er.', maal: 'importer-status', bev: 'dans' }]);
  }

  // Ingredienser, appen ikke kender, spørges der om i samme ark som i formularen (Katalog.afklar). Én, der ligner præcis én, rettes selv.
  // spring: tekster, man har svaret «Ikke nu» til i denne import. Giver svarene, eller null, hvis man gik tilbage.
  const spoerg = (r, valg, spring = new Set()) => Katalog.afklar(ingAf(r.data).map(i => i.n).filter(n => !spring.has(Katalog.rens(n))),
    { imp: true, kat: r.kat, titel: r.data.titel, gem: 'Gem opskriften', ...valg });

  // Tekst, man har sat ind eller skrevet: én opskrift, som gemmes med det samme og åbnes, så den kan tjekkes.
  // Særlige formater (JSON, HTML, RTF, mail, CSV) læses først af Filleser (filleser.js).
  const mapper = { kat: mapKat, koekken: mapKoekken };
  function gemTekst(el, tekst) {
    const f = Filleser.fraTekst(tekst);
    return gemJ(el, f ? Filleser.tilJ(f, mapper) : tekstTilOpskrift(tekst), true);
  }
  // En fil (Word, PDF, tekst, mail, gemt hjemmeside, JSON, CSV, RTF): læses her i appen, intet sendes ud
  async function laesFil(el, fil) {
    fejlboks('');
    if (fil.size > 15e6) return fejlboks('Filen er for stor. Den må højst fylde 15 MB.');
    let r;
    el.disabled = true;
    try { r = await Filleser.laes(fil.name, new Uint8Array(await fil.arrayBuffer())); }
    catch (e) { console.error(e); return fejlboks('Filen kunne ikke læses. Kopiér teksten fra filen, og sæt den ind i feltet.'); }
    finally { el.disabled = false; }
    return gemJ(el, Filleser.tilJ(r, mapper), false);
  }
  async function gemJ(el, t, fraFelt) {
    if (t.fejl) return fejlboks(t.fejl);
    const r = laesEn(t.j);
    if (r.fejl) return fejlboks('Opskriften mangler navn, ingredienser eller trin.');
    el.disabled = true;
    try {
      const o = findNavn(await api('opskrifter?select=id,titel'), r.data.titel);
      if (o && !(await spoergDublet([{ ...o, titel: r.data.titel }], 1))) return;
      const svar = await spoerg(r, { tilbage: 'Tilbage' });
      if (!svar) return; // tilbage: intet er gemt, og teksten står i feltet
      r.data.ingredienser = await Katalog.knyt(r.data.ingredienser, svar, { claude: r.kat });
      const [ny] = await api('opskrifter', { method: 'POST', body: { ...r.data, kilde: 'importeret' } });
      if (fraFelt) lager.gem('importTekst', '');
      toast('Opskriften er gemt. Tjek, at alt står rigtigt'); Hjaelper.glad('Opskriften er gemt!');
      location.hash = '#/opskrifter/' + ny.id;
    } finally { el.disabled = false; }
  }

  async function koer(el) {
    if (koerer) return;
    fejlboks('');
    const tekst = $('#imp').value, alle = laesLinks(tekst), rest = tekst.replace(LINK, '').trim();
    if (rest.length > 40 || (rest && !alle.length)) return gemTekst(el, tekst); // mere end links: det er en opskrift som tekst
    if (!alle.length) return fejlboks('Feltet er tomt. Sæt et link eller en opskrift ind først.');
    const id = visning, klar = new Set(lager.hent('linksFaerdig', []));
    const todo = alle.length === 1 ? alle : alle.filter(l => !klar.has(l)); // ét link hentes altid, mange fortsætter, hvor de slap
    let sidsteId = null;
    const tael = { gemt: 0, fandtes: 0, fejlede: 0, udenBillede: 0, tidligere: alle.length - todo.length, ialt: alle.length };
    if (!todo.length) return fejlboks('Alle disse links er allerede hentet. Tryk «Start forfra», hvis du vil hente dem igen.');
    koerer = true; stop = false;
    el.hidden = true; const stopKnap = $('[data-h=stopLinks]'); stopKnap.hidden = false; stopKnap.disabled = false;
    $('#fejlomraade').innerHTML = '';
    const fejlListe = [], buf = [];
    let nu = []; try { nu = await api('opskrifter?select=id,titel'); } catch (e) { console.error(e); }
    const set = [];
    let fatal = null, afbrudt = false; // afbrudt: man trykkede «Stop importen» i arket. Det, der ikke er gemt, hentes igen ved «Fortsæt».
    const ikkeNu = new Set();

    const vis = () => {
      const s = $('#status'), b = $('#barfyld'); if (!s || !b) return;
      const faerdig = tael.gemt + tael.fandtes + tael.fejlede + tael.tidligere, pct = Math.round(faerdig / tael.ialt * 100);
      s.textContent = `${faerdig} af ${tael.ialt}. ${tael.gemt} gemt${tael.fandtes ? `, ${tael.fandtes} fandtes allerede` : ''}${tael.fejlede ? `, ${tael.fejlede} kunne ikke hentes` : ''}${tael.udenBillede ? `, ${tael.udenBillede} uden billede` : ''}.`;
      b.style.width = pct + '%'; b.parentElement.setAttribute('aria-valuenow', pct);
    };
    const husk = () => lager.gem('linksFaerdig', [...klar]);
    // Bundterne gemmes ét ad gangen, så der kun er ét ark åbent. Før et bundt gemmes, spørges der pr. opskrift.
    let kaede = Promise.resolve();
    const flush = () => (kaede = kaede.then(flushNu));
    const flushNu = async () => {
      if (afbrudt || !buf.length) return;
      const b = [];
      for (const x of buf.splice(0)) {
        if (afbrudt) break; // resten er ikke gemt og hentes igen næste gang
        try { x.svar = await spoerg(x.r, { tilbage: alle.length > 1 ? 'Stop importen' : 'Tilbage', ...(alle.length > 1 && { note: 'I resten af importen bliver du ikke spurgt om den igen.' }) }, ikkeNu); }
        catch (e) { console.error(e); tael.fejlede++; fejlListe.push([x.url, 'Ingredienserne kunne ikke tjekkes. Tjek internettet.']); continue; }
        if (!x.svar) { afbrudt = stop = true; break; }
        Object.entries(x.svar).forEach(([t, v]) => { if (v === false) ikkeNu.add(t); });
        b.push(x);
      }
      if (!b.length) return vis();
      const gem = async dele => {
        for (const x of dele) x.r.data.ingredienser = await Katalog.knyt(x.r.data.ingredienser, x.svar, { claude: x.r.kat }); // hver linje får ingrediensens id
        const rader = await api('opskrifter', { method: 'POST', body: dele.map(x => ({ ...x.r.data, kilde: 'importeret' })) });
        dele.forEach((x, n) => { klar.add(x.url); tael.gemt++; x.id = rader[n] && rader[n].id; sidsteId = x.id || sidsteId; });
        for (const x of dele) if (x.r.billede && x.id) { try { await hentBillede(x.r.billede, x.id); } catch (e) { console.error(e); tael.udenBillede++; } } // opskriften er gemt, også hvis billedet fejler
      };
      try { await gem(b); }
      catch (e) { // én dårlig opskrift må ikke tage de andre med: prøv dem en ad gangen
        for (const x of b) { try { await gem([x]); } catch (e2) { tael.fejlede++; fejlListe.push([x.url, 'Opskriften kunne ikke gemmes.']); } }
      }
      husk(); vis();
    };
    const en = async url => {
      try {
        const r = await hentEn(url);
        const titel = r.data.titel;
        if (findNavn(nu, titel) || findNavn(set, titel)) { tael.fandtes++; klar.add(url); husk(); return; }
        set.push({ titel });
        buf.push({ url, r });
        if (buf.length >= BATCH) await flush();
      } catch (e) {
        if (e.fatal) { fatal = e.message; stop = true; return; }
        tael.fejlede++; fejlListe.push([url, e.message || 'Ukendt fejl.']);
      }
    };
    let i = 0;
    vis();
    const arbejder = async () => {
      while (!stop) {
        if (id !== visning) { stop = true; break; }
        const k = i++; if (k >= todo.length) return;
        await en(todo[k]); vis();
      }
    };
    try { await Promise.all(Array.from({ length: SAMTIDIG }, arbejder)); await flush(); }
    catch (e) { console.error(e); fatal = fatal || 'Noget gik galt: ' + (e.message || e); }
    koerer = false;
    if (id !== visning) return; // brugeren er gået væk: det, der er hentet, er gemt
    vis(); el.hidden = false; stopKnap.hidden = true; el.lastChild.textContent = i < todo.length || (afbrudt && alle.length > 1) ? ' Fortsæt' : ' Importér';
    if (fatal) fejlboks(fatal);
    else if (afbrudt) fejlboks(alle.length > 1 ? 'Importen er stoppet. Det, der er gemt, er gemt. Tryk på «Fortsæt» for at tage resten.' : 'Opskriften er ikke gemt. Tryk på «Importér», når du vil prøve igen.');
    if (fejlListe.length) {
      const o = $('#fejlomraade');
      o.innerHTML = `<p class="tekst-m">Disse links kunne ikke hentes:</p>
        <textarea id="fejltekst" rows="6" readonly aria-label="Links, der fejlede">${esc(fejlListe.map(([u, m]) => `${u}\n  ${m}`).join('\n'))}</textarea>
        <button class="knap" data-tpid="importer-kopier-fejl" data-h="kopierFejl">Kopiér de links, der fejlede</button>`;
      o.dataset.links = JSON.stringify(fejlListe.map(f => f[0]));
    }
    if (alle.length === 1 && tael.fandtes) fejlboks('Opskriften findes allerede i din kogebog.');
    if (alle.length === 1 && tael.gemt && sidsteId && !fatal) { // ét link: åbn opskriften, så den kan tjekkes
      lager.gem('importTekst', ''); toast(tael.udenBillede ? 'Opskriften er gemt, men billedet kunne ikke hentes' : 'Opskriften er gemt'); Hjaelper.glad('Opskriften er gemt!');
      location.hash = '#/opskrifter/' + sidsteId; return;
    }
    if (tael.gemt && !fatal) { toast(`${tael.gemt} ${tael.gemt === 1 ? 'opskrift er' : 'opskrifter er'} gemt`); Hjaelper.glad('Opskrifterne er gemt!'); }
  }

  Object.assign(H, {
    startLinks(el) { return koer(el); },
    vaelgFil() { $('#imp-fil').click(); },
    stopLinks(el) { stop = true; el.disabled = true; toast('Stopper efter de links, jeg er i gang med'); },
    async kopierFejl() {
      const o = $('#fejlomraade'); let l = []; try { l = JSON.parse(o.dataset.links || '[]'); } catch (e) { /* tom */ }
      (await kopier(l.join('\n'))) ? toast('Linkene er kopieret') : fejlbesked('Linkene blev ikke kopieret. Tryk på knappen igen.');
    },
    async startForfra() {
      if (koerer) return;
      if (!await bekraeft('Vil du hente alle linkene igen? Opskrifter, der allerede findes, bliver sprunget over.', 'Start forfra')) return;
      lager.gem('linksFaerdig', []); side(); toast('Klar til at starte forfra');
    }
  });
  return { side, tekstTilOpskrift };
})();
