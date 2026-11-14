// «Importér opskrift»: ét felt til det hele. Links hentes én efter én via Supabase-funktionen «hent-opskrift» (hjemmesider med billede,
// og TikTok, Instagram og Facebook, når opskriften står i teksten under opslaget). Tekst, man sætter ind eller selv skriver, læses her i appen (tekstTilOpskrift).
// Alt gemmes som almindelige opskrifter. Ingen nøgler i koden (kun den offentlige).
const LinkImport = (() => {
  const SAMTIDIG = 4, BATCH = 10, FUNKTION = SUPABASE_URL + '/functions/v1/hent-opskrift';
  let koerer = false, stop = false;
  const HOVED = { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
  const SOCIALT = /(^|\.)(tiktok\.com|instagram\.com|facebook\.com|fb\.watch|threads\.net)$/i;
  const socialt = url => { try { return SOCIALT.test(new URL(url).hostname); } catch (e) { return false; } };
  const LINK = /https?:\/\/[^\s<>"']+/g;

  // ---------- Fri tekst -> opskrift ----------
  // Finder navn, ingredienser og trin i en tekst, man har sat ind eller skrevet. Overskrifterne «Ingredienser» og «Sådan gør du» (eller de engelske) deler teksten.
  // Uden overskrifter: linjer, der begynder med et tal, er ingredienser, og det, der står efter dem, er trin. Giver { j } til laesEn eller { fejl }.
  const ING_H = /^(ingredienser|ingredients|det skal du bruge|du skal bruge|what you need|you'?ll need)\b\s*:?\s*/i;
  const TRIN_H = /^(fremgangsmåde|sådan gør du|tilberedning|instruktioner|instructions|method|directions|preparation|how to make it)\b\s*:?\s*/i;
  const TAL = /^(\d|[½¼¾])/;
  // Linjer på hjemmesider, der ikke er opskrift: knapper under opskriften, tips, forslag og kommentarer. Trinnene slutter ved den første.
  const SLUT = /^(føj til|sæt på madplan|udskriv\b|send$|hold min skærm|næringsindhold|mine noter|tips?\b|tip til|forslag til servering|prøv også|relaterede|læs også|del opskriften|spørgsmål til|\d+\s+kommentarer|kommentarer\b|bedøm)/i;
  const STOEJ = /^(tilmeld|log ind|menu|søg\b|premium|cookies?|accepter|gå til indhold|skip to)/i; // menuer og tilbud, der kan stå før opskriften
  const rensTitel = t => String(t || '').split(/\s+[|•]\s+/)[0].replace(/\s+[-–—]\s+(valdemarsro|[^-–—]*opskrift)\s*$/i, '').trim(); // «Navn | Side» -> «Navn»
  function tekstTilOpskrift(tekst, titel) {
    const linjer = String(tekst || '').replace(/\r/g, '')
      .replace(/[ \t]+(?=(?:ingredienser|ingredients|fremgangsmåde|sådan gør du|instructions|method|directions)\s*:)/gi, '\n') // overskrifter midt i en linje (opslag uden linjeskift)
      .split('\n').map(l => l.replace(LINK, '').replace(/#[\p{L}\d_]+/gu, '').replace(/^[\s•\-–—*·▢☐▪●○✅✔☑]+/u, '').trim()).filter(Boolean);
    let iIng = linjer.findIndex(l => ING_H.test(l)), slutIng, ing = [], foer;
    const iTrin = linjer.findIndex((l, i) => i > iIng && TRIN_H.test(l));
    if (iIng >= 0) {
      foer = linjer.slice(0, iIng);
      const rest = linjer[iIng].replace(ING_H, '');
      if (rest) ing.push(...rest.split(/\s*[,;]\s*|\s+[•·]\s+/).filter(Boolean));
      slutIng = iTrin >= 0 ? iTrin : linjer.findIndex((l, i) => i > iIng && !TAL.test(l) && (l.length > 45 || /[.!]$/.test(l)));
      if (slutIng < 0) slutIng = linjer.length;
      ing.push(...linjer.slice(iIng + 1, slutIng));
    } else { // ingen overskrift: den første række af linjer med tal forrest
      iIng = linjer.findIndex((l, i) => TAL.test(l) && linjer[i + 1] && TAL.test(linjer[i + 1]) && (iTrin < 0 || i < iTrin));
      if (iIng < 0) return { fejl: 'Jeg kunne ikke finde ingredienserne. Skriv «Ingredienser» på en linje for sig selv, og skriv så én ingrediens på hver linje.' };
      slutIng = linjer.findIndex((l, i) => i > iIng && !TAL.test(l)); if (slutIng < 0) slutIng = linjer.length;
      if (iTrin >= 0 && iTrin < slutIng) slutIng = iTrin;
      foer = linjer.slice(0, iIng); ing = linjer.slice(iIng, slutIng);
    }
    let trin = iTrin >= 0 ? [linjer[iTrin].replace(TRIN_H, ''), ...linjer.slice(iTrin + 1)].filter(Boolean) : linjer.slice(slutIng);
    if (trin.length === 1 && /\s\d{1,2}[.)]\s/.test(trin[0])) trin = trin[0].split(/\s+(?=\d{1,2}[.)]\s)/); // «1. … 2. …» på én linje
    else if (trin.length === 1 && trin[0].length > 160) trin = trin[0].split(/(?<=[.!?])\s+(?=[A-ZÆØÅ])/);
    const stopI = trin.findIndex((t, i) => i > 0 && SLUT.test(t)); if (stopI > 0) trin = trin.slice(0, stopI); // sidens knapper, tips, kommentarer og forslag hører ikke til trinnene
    trin = trin.map(t => t.replace(/^(?:trin|step)?\s*\d{1,2}\s*[.):]\s*/i, '').trim()).filter(t => t.length > 2);
    // Ingredienser: en linje, der slutter med kolon, er en overskrift til en gruppe («Sovs:»)
    const ud = []; let gruppe = null;
    for (const l of ing) { if (/:$/.test(l) && !TAL.test(l)) { gruppe = { overskrift: l.slice(0, -1).trim(), varer: [] }; ud.push(gruppe); } else (gruppe ? gruppe.varer : ud).push(l); }
    if (!ud.some(x => typeof x === 'string' || x.varer.length)) return { fejl: 'Jeg kunne ikke finde ingredienserne. Skriv én ingrediens på hver linje under «Ingredienser».' };
    if (!trin.length) return { fejl: 'Jeg kunne ikke finde, hvordan retten laves. Skriv «Sådan gør du» på en linje for sig selv, og skriv trinnene under.' };
    const hoved = foer.join(' '), port = hoved.match(/(\d+)\s*(?:portioner|personer|pers\b|servings|people)/i) || hoved.match(/(?:serves|rækker til)\s*(\d+)/i);
    const min = hoved.match(/(\d+)\s*(?:min\b|minutter|minutes)/i), timer = hoved.match(/(\d+)\s*(?:timer?|hours?)\b/i);
    const navn = (rensTitel(titel) || foer.find(l => !/^\d/.test(l) && l.length > 2 && !STOEJ.test(l)) || '').replace(/[:.!]+$/, '').slice(0, 80).trim();
    if (!navn) return { fejl: 'Jeg mangler rettens navn. Skriv navnet på den øverste linje.' };
    return { j: { navn, portioner: port ? Number(port[1]) : null, tid: (timer ? Number(timer[1]) * 60 : 0) + (min ? Number(min[1]) : 0) || null, ingredienser: ud, trin } };
  }


  const KAT = [[/forret|starter|appetizer|snack/i, 'Forret'], [/salat|salad/i, 'Salat'], [/dessert|kage|cake|cookie|bag|sweet|sød/i, 'Dessert'],
    [/tilbehør|side/i, 'Tilbehør'], [/drik|drink|beverage|smoothie|cocktail/i, 'Drikke'], [/hoved|main|aften|middag|dinner|lunch|supper/i, 'Hovedret']];
  const KOEKKEN = { danish: 'Dansk', italian: 'Italiensk', asian: 'Asiatisk', chinese: 'Asiatisk', thai: 'Asiatisk', japanese: 'Asiatisk', korean: 'Asiatisk', vietnamese: 'Asiatisk',
    spanish: 'Spansk', mexican: 'Mexicansk', french: 'Fransk', indian: 'Indisk', american: 'Amerikansk', greek: 'Græsk', 'middle eastern': 'Mellemøstlig', lebanese: 'Mellemøstlig', turkish: 'Mellemøstlig' };
  const mapKat = t => { const s = String(t || ''); const fast = OPSKRIFT_KAT.find(k => k.toLowerCase() === s.toLowerCase()); if (fast) return fast; const m = KAT.find(([re]) => re.test(s)); return m ? m[1] : null; };
  const mapKoekken = t => { const s = String(t || '').trim().toLowerCase(); const fast = OPSKRIFT_KOEKKEN.find(k => k.toLowerCase() === s); return fast || KOEKKEN[s] || (s ? s.charAt(0).toUpperCase() + s.slice(1) : null); };

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
      r = laesEn({ navn: d.navn, kategori: mapKat(d.kategori), koekken: mapKoekken(d.koekken), portioner: d.portioner, tid: d.tid, ingredienser: d.ingredienser.map(renIng), trin: d.trin });
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
          <p class="lille">Skriver du selv? Navnet øverst. Så «Ingredienser» med én på hver linje, og «Sådan gør du» med trinnene.</p></li>
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
    Hjaelper.side([
      { tekst: 'Sæt et link eller en opskrift ind her. Du kan også skrive selv.', maal: 'importer-tekst', bev: 'salto' },
      { tekst: 'Tryk på Importér. Så gemmer jeg opskriften for dig.', maal: 'importer-start', bev: 'skridt' },
      { tekst: 'Her ser du, hvor langt jeg er.', maal: 'importer-status', bev: 'dans' }]);
  }

  // Tekst, man har sat ind eller skrevet: én opskrift, som gemmes med det samme og åbnes, så den kan tjekkes
  async function gemTekst(el, tekst) {
    const t = tekstTilOpskrift(tekst);
    if (t.fejl) return fejlboks(t.fejl);
    const r = laesEn(t.j);
    if (r.fejl) return fejlboks('Opskriften mangler navn, ingredienser eller trin.');
    el.disabled = true;
    try {
      const o = findNavn(await api('opskrifter?select=id,titel'), r.data.titel);
      if (o && !(await spoergDublet([{ ...o, titel: r.data.titel }], 1))) return;
      r.data.ingredienser = await Katalog.knyt(r.data.ingredienser, {}, r.kat);
      const [ny] = await api('opskrifter', { method: 'POST', body: { ...r.data, kilde: 'importeret' } });
      lager.gem('importTekst', '');
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
    let fatal = null;

    const vis = () => {
      const s = $('#status'), b = $('#barfyld'); if (!s || !b) return;
      const faerdig = tael.gemt + tael.fandtes + tael.fejlede + tael.tidligere, pct = Math.round(faerdig / tael.ialt * 100);
      s.textContent = `${faerdig} af ${tael.ialt}. ${tael.gemt} gemt${tael.fandtes ? `, ${tael.fandtes} fandtes allerede` : ''}${tael.fejlede ? `, ${tael.fejlede} kunne ikke hentes` : ''}${tael.udenBillede ? `, ${tael.udenBillede} uden billede` : ''}.`;
      b.style.width = pct + '%'; b.parentElement.setAttribute('aria-valuenow', pct);
    };
    const husk = () => lager.gem('linksFaerdig', [...klar]);
    const flush = async () => {
      if (!buf.length) return;
      const b = buf.splice(0);
      const gem = async dele => {
        for (const x of dele) x.r.data.ingredienser = await Katalog.knyt(x.r.data.ingredienser, {}, x.r.kat); // hver linje får ingrediensens id
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
    vis(); el.hidden = false; stopKnap.hidden = true; el.lastChild.textContent = i < todo.length ? ' Fortsæt' : ' Importér';
    if (fatal) fejlboks(fatal);
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
