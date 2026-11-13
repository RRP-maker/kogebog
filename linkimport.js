// «Importér links»: sæt mange opskriftslinks ind, så henter appen dem én efter én via Supabase-funktionen «hent-opskrift»
// og gemmer dem som almindelige opskrifter. Ingen nøgler i koden (kun den offentlige).
const LinkImport = (() => {
  const SAMTIDIG = 4, BATCH = 10, FUNKTION = SUPABASE_URL + '/functions/v1/hent-opskrift';
  let koerer = false, stop = false;

  const KAT = [[/forret|starter|appetizer|snack/i, 'Forret'], [/salat|salad/i, 'Salat'], [/dessert|kage|cake|cookie|bag|sweet|sød/i, 'Dessert'],
    [/tilbehør|side/i, 'Tilbehør'], [/drik|drink|beverage|smoothie|cocktail/i, 'Drikke'], [/hoved|main|aften|middag|dinner|lunch|supper/i, 'Hovedret']];
  const KOEKKEN = { danish: 'Dansk', italian: 'Italiensk', asian: 'Asiatisk', chinese: 'Asiatisk', thai: 'Asiatisk', japanese: 'Asiatisk', korean: 'Asiatisk', vietnamese: 'Asiatisk',
    spanish: 'Spansk', mexican: 'Mexicansk', french: 'Fransk', indian: 'Indisk', american: 'Amerikansk', greek: 'Græsk', 'middle eastern': 'Mellemøstlig', lebanese: 'Mellemøstlig', turkish: 'Mellemøstlig' };
  const mapKat = t => { const s = String(t || ''); const fast = OPSKRIFT_KAT.find(k => k.toLowerCase() === s.toLowerCase()); if (fast) return fast; const m = KAT.find(([re]) => re.test(s)); return m ? m[1] : null; };
  const mapKoekken = t => { const s = String(t || '').trim().toLowerCase(); const fast = OPSKRIFT_KOEKKEN.find(k => k.toLowerCase() === s); return fast || KOEKKEN[s] || (s ? s.charAt(0).toUpperCase() + s.slice(1) : null); };

  // «hakket kalv (med 10 % fedt)» -> «hakket kalv»: parenteser står ikke i ingrediensnavne, og navnet bruges til at finde kategori
  const renIng = t => { const u = String(t).replace(/\s*\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').replace(/[\s,;:]+$/, '').trim(); return u || String(t); };
  const laesLinks = tekst => [...new Set((String(tekst).match(/https?:\/\/[^\s<>"']+/g) || []).map(l => l.replace(/[.,;)\]]+$/, '')))];
  const fejlboks = t => { const e = $('#formfejl'); if (e) e.innerHTML = t ? `<div class="fejlboks">${esc(t)}</div>` : ''; };

  async function hentEn(url) { // giver { data } fra appens egen læser, eller kaster en fejl på dansk
    let svar;
    for (let forsoeg = 0; ; forsoeg++) {
      try {
        svar = await fetch(FUNKTION, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
        break;
      } catch (e) { if (forsoeg >= 1) throw new Error('Der er ingen forbindelse.'); await new Promise(r => setTimeout(r, 800)); }
    }
    if (svar.status === 404) { const e = new Error('Funktionen «hent-opskrift» findes ikke i Supabase endnu.'); e.fatal = true; throw e; }
    if (svar.status === 401 || svar.status === 403) { const e = new Error('Supabase afviste kaldet. Funktionen skal lægges ind uden «Verify JWT».'); e.fatal = true; throw e; }
    let j; try { j = await svar.json(); } catch (e) { throw new Error('Svaret kunne ikke læses.'); }
    if (!j.ok) throw new Error(j.fejl || 'Siden kunne ikke hentes.');
    const d = j.data, ingredienser = d.ingredienser.map(renIng), r = laesEn({ navn: d.navn, kategori: mapKat(d.kategori), koekken: mapKoekken(d.koekken), portioner: d.portioner, tid: d.tid, ingredienser, trin: d.trin });
    if (r.fejl) throw new Error(r.fejl);
    return r;
  }

  function side() {
    const gemt = lager.hent('linksFaerdig', []).length;
    app.innerHTML = `${Ikoner.tilbage('#/import')}<h1>Importér links</h1>
      <ol class="trin vejledning">
        <li>Sæt dine links ind her. Ét link på hver linje.
          <textarea id="links" data-tpid="links" rows="6" data-husk="linksTekst" placeholder="https://…" aria-label="Links til opskrifter"></textarea>
          <div class="felt-knapper"><button type="button" class="knap" data-tpid="links-saet" data-h="saetInd" data-v="links">Sæt ind</button><span class="hoejre">${Ikoner.rund('fortryd', 'Fortryd', 'data-tpid="links-fortryd" data-h="fortrydRyd" data-v="links" hidden')}<button type="button" class="knap mini slet" data-tpid="links-ryd" data-h="rydFelt" data-v="links">Ryd</button></span></div></li>
        <li>Tryk på Start. Jeg henter opskrifterne én ad gangen. Hold siden åben, mens det kører. Stopper du, kan du trykke Start igen, så fortsætter jeg, hvor jeg slap.
          <div class="rakke venstre">
            <button class="knap hoved stor" data-tpid="links-start" data-h="startLinks">${ik('gnist')} Start</button>
            <button class="knap stor" data-tpid="links-stop" data-h="stopLinks" hidden>Stop</button>
          </div></li>
        <li>Her kan du følge med:
          <p class="tekst-m" data-tpid="link-status" id="status">Intet er startet endnu.</p>
          <div class="felt felt-s importbar" role="progressbar" aria-label="Fremdrift" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="barfyld"></i></div>
          <div id="fejlomraade"></div></li>
      </ol>
      <div id="formfejl"></div>
      ${gemt ? `<p class="lille">${gemt} links er allerede hentet fra før og springes over.</p>
      <button class="knap" data-tpid="links-forfra" data-h="startForfra">Start forfra med alle links</button>` : ''}`;
    document.querySelectorAll('textarea[data-husk]').forEach(t => { t.value = lager.hent(t.dataset.husk, ''); });
    Hjaelper.side([
      { tekst: 'Sæt alle dine links ind her. Ét på hver linje.', maal: 'links', bev: 'salto' },
      { tekst: 'Tryk på Start. Så henter jeg opskrifterne for dig.', maal: 'links-start', bev: 'skridt' },
      { tekst: 'Her ser du, hvor langt jeg er.', maal: 'link-status', bev: 'dans' }]);
  }

  async function koer(el) {
    if (koerer) return;
    fejlboks('');
    const alle = laesLinks($('#links').value);
    if (!alle.length) return fejlboks('Sæt mindst ét link ind først. Det skal begynde med https://');
    const id = visning, klar = new Set(lager.hent('linksFaerdig', []));
    const todo = alle.filter(l => !klar.has(l));
    const tael = { gemt: 0, fandtes: 0, fejlede: 0, tidligere: alle.length - todo.length, ialt: alle.length };
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
      s.textContent = `${faerdig} af ${tael.ialt}. ${tael.gemt} gemt${tael.fandtes ? `, ${tael.fandtes} fandtes allerede` : ''}${tael.fejlede ? `, ${tael.fejlede} kunne ikke hentes` : ''}.`;
      b.style.width = pct + '%'; b.parentElement.setAttribute('aria-valuenow', pct);
    };
    const husk = () => lager.gem('linksFaerdig', [...klar]);
    const flush = async () => {
      if (!buf.length) return;
      const b = buf.splice(0);
      const gem = async dele => {
        for (const x of dele) x.r.data.ingredienser = await Katalog.knyt(x.r.data.ingredienser, {}, x.r.kat); // hver linje får ingrediensens id
        await api('opskrifter', { method: 'POST', body: dele.map(x => x.r.data) });
        dele.forEach(x => { klar.add(x.url); tael.gemt++; });
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
    vis(); el.hidden = false; stopKnap.hidden = true; el.lastChild.textContent = ' Fortsæt';
    if (fatal) fejlboks(fatal);
    if (fejlListe.length) {
      const o = $('#fejlomraade');
      o.innerHTML = `<p class="tekst-m">Disse links kunne ikke hentes:</p>
        <textarea id="fejltekst" rows="6" readonly aria-label="Links, der fejlede">${esc(fejlListe.map(([u, m]) => `${u}\n  ${m}`).join('\n'))}</textarea>
        <button class="knap" data-tpid="links-kopier-fejl" data-h="kopierFejl">Kopiér de links, der fejlede</button>`;
      o.dataset.links = JSON.stringify(fejlListe.map(f => f[0]));
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
  return { side };
})();
