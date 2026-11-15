// Kataloget over ingredienser (tabellerne «ingredienser» og «ingrediens_kategorier» i Supabase).
// Opskrifter lægger deres ingredienser her. Kategorien kommer fra kataloget, fra Claude eller fra dig. I appen hedder både «ingen kategori» og den rigtige kategori «Andet» (til det, der ikke passer andre steder) «Ikke sorteret», se katNavn i app.js.
const Katalog = (() => {
  let kat = [], ing = [], regler = [], hentet = false, idx = null;
  const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const erAlias = r => r.slags === 'vare' && r.resultat.length === 1 && !r.resultat[0].f; // et alias: én vare uden tilberedning
  const rens = n => norm(String(n).replace(/\([^)]*\)/g, ' ').replace(/[.,;:]+$/, ''));
  const katId = navn => { const n = norm(navn), k = kat.find(x => x.navn_norm === (n === 'ikke sorteret' ? 'andet' : n)); return k ? k.id : null; }; // «Ikke sorteret» er kategorien «Andet»
  const sorteret = () => [...kat].sort((a, b) => a.raekkefolge - b.raekkefolge || a.navn.localeCompare(b.navn, 'da'));
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
  // Navnet, en linje står under i kataloget: selve varen («finthakket løg» står under «løg»)
  const noegle = navn => rens(simpel(navn)) || norm(String(navn).replace(/[(),;]/g, ' '));
  // Den ene vej til nye ingredienser (valg 10): databasefunktionen «ingrediens_opret». nye: [{ navn, kategori_id }].
  // Findes et navn allerede (en anden enhed nåede først), bruges det, der findes.
  async function opret(nye) {
    if (!nye.length) return;
    let r = await api('rpc/ingrediens_opret', { method: 'POST', body: { p: { nye } } });
    if (!r.ok) {
      const findes = new Set(r.findes.map(f => f.navn));
      const rest = nye.filter(x => !findes.has(norm(x.navn)));
      r = rest.length ? await api('rpc/ingrediens_opret', { method: 'POST', body: { p: { nye: rest } } }) : { ok: true, ingredienser: [] };
      if (!r.ok) throw new Error('Ingredienserne blev ikke oprettet: ' + r.findes.map(f => f.navn).join(', '));
    }
    await hent();
  }
  // Import (links, tekst og «Opdater med Claude»): Claudes kategori lægges på en kendt ingrediens, der ikke har nogen. claude: navn -> kategorinavn.
  async function katFraClaude(liste, claude = {}) {
    for (const x of liste) {
      if (!x || 'g' in x || Array.isArray(x.eller)) continue;
      const l = laes(x.n), { k } = dele(x.n), ck = claude[k] ? katId(claude[k]) : null, i = ck && l.udfald === 'kendt' && l.slags === 'vare' && ing.find(c => c.id === l.varer[0].id);
      if (i && !i.kategori_id) { await api(`ingredienser?id=eq.${enc(i.id)}`, { method: 'PATCH', body: { kategori_id: ck } }); i.kategori_id = ck; }
    }
  }
  // Ved «Gem» (opdatering 4c, fase 5): hver linje får ingrediensens id og navn fra kataloget.
  // En tekst, appen kender (navn, alias eller regel), bruges uden spørgsmål: en regel kan dele linjen, gøre den til «eller» eller slette den.
  // Ukendte linjer er spurgt om i forvejen (afklar). Svarede man «Ikke nu», gemmes linjen, som den står, uden vare, og der spørges igen næste gang.
  // svar: fra afklar. imp: { claude } fra import. Import retter selv ved præcis én, der ligner («tæt på», valg 6). Den opretter intet.
  async function knyt(liste, svar = {}, imp = null) {
    await hent();
    if (imp) await katFraClaude(liste, imp.claude || {});
    return liste.flatMap(x => knytLinje(x, svar, imp));
  }
  function knytLinje(x, svar, imp) {
    if ('g' in x || Array.isArray(x.eller)) return [x]; // en «eller»-linje har sine varer i forvejen
    const d = dele(x.n);
    if (!d.n) return []; // en linje uden navn falder væk
    const l = laes(x.n), s = svar[d.n];
    const r = l.udfald === 'kendt' || (imp && l.udfald === 'taet') ? l : s && s.id ? { slags: 'vare', alias: d.k !== norm(ingNavn(s.id)) ? d.k : '', varer: [{ id: s.id, ...(d.f && { f: d.f }) }] } : null; // et valgt alias bevarer teksten
    if (!r) { const { id, eller, t, ...rest } = x; return [rest]; }
    return anvend(x, r);
  }
  // Et svar eller en regel lagt på en linje. Ved «del» får den første vare mængden.
  function anvend(x, r) {
    const navnPaa = id => (ing.find(i => i.id === id) || {}).navn, ff = v => [v.f, x.f].filter(Boolean).join(', ');
    const linje = (v, m, e, t) => { const f = ff(v); return { m, e, n: navnPaa(v.id), id: v.id, ...(f && { f }), ...(t && { t }) }; };
    if (r.slags === 'slet') return [];
    if (r.slags === 'eller') { const f = [...new Set(r.varer.map(v => v.f).concat(x.f).filter(Boolean))].join(', '); return [{ m: x.m, e: x.e, n: r.varer.map(v => navnPaa(v.id)).join(' eller '), eller: r.varer.map(v => v.id), ...(f && { f }) }]; }
    if (r.slags === 'del') return r.varer.map((v, i) => linje(v, i ? null : x.m, i ? '' : x.e));
    return [linje(r.varer[0], x.m, x.e, r.alias)]; // r.alias: et alias bevarer teksten, som den står i opskriften (t)
  }

  // ---------- Eksisterende opskrifter (Styr på ingredienser, fase 7) ----------
  // En linje venter, når den ikke peger på en ingrediens i kataloget, eller når ingrediensens navn står for flere varer («salt og peber»).
  // «Eller»-linjer og overskrifter er ordnet. Samme regel som «Opskrifter, der venter på svar» i Ingrediensværktøjet.
  const klar = () => hentet && ing.length > 0; // uden et hentet katalog ligner alle linjer uordnede, så der røres intet
  const venter = x => { if (!x || 'g' in x || Array.isArray(x.eller)) return false; const i = x.id && I().id.get(x.id); return !i || OGELLER.test(i.navn_norm); };
  const tekstAf = x => { const i = x.id && I().id.get(x.id); return i ? i.navn : x.n; }; // teksten, der spørges om
  // Ved åbning: en tekst, appen kender (navn, alias eller regel), bruges uden spørgsmål. Intet gættes («tæt på» spørges der om).
  function ordnStille(liste) {
    let aendret = false;
    const ud = liste.flatMap(x => {
      if (!venter(x) || (x.id && I().id.has(x.id)) || laes(x.n).udfald !== 'kendt') return [x];
      aendret = true;
      return knytLinje(x, {}, null);
    });
    return { liste: ud, aendret };
  }
  // Svar fra afklar (med ordn) lagt på de linjer, der venter. «Ikke nu» og ubesvarede linjer står, som de er.
  // Et svar med slags gælder kun denne opskrift (navnet på en ingrediens kan ikke blive en regel).
  function ordn(liste, svar) {
    return liste.flatMap(x => {
      const s = venter(x) && svar[dele(tekstAf(x)).n];
      if (!s) return [x];
      return s.slags ? anvend(x, s) : knytLinje(x, svar, null);
    });
  }

  // ---------- Spørgsmålet ved «Gem» (Styr på ingredienser, fase 5) ----------
  // Ét ark med alle tekster, appen ikke kender. Svarene: en af de lignende, «Opret ny», «Del selv» og «Ikke nu».
  // Svarene huskes som regel (et alias eller en regel), så der ikke spørges igen. «Ikke nu» spørger igen næste gang.
  // hjemme: «Derhjemme» spørger også, når teksten er et fællesnavn (vælg frisk eller tørret). Der er ingen «Del selv».
  // imp: import, som selv retter «tæt på» og ikke spørger om dem. kat: Claudes kategorier (navn -> kategorinavn). titel: opskriften, der spørges for. note: ekstra tekst øverst.
  // Svar: tekst -> { id } (valgt eller oprettet), true (en regel er gemt) eller false («Ikke nu»). null: man gik tilbage.
  // felt: et element, spørgsmålet står i (en eksisterende opskrift, fase 7) i stedet for i et ark. «Skjul» giver null.
  // ordn: spørg også om navnet på en ingrediens, der står for flere varer («salt og peber»). Svaret gælder kun den opskrift: { slags, varer }, for teksten kan ikke blive en regel.
  const husk = new Map(); // svarene, til arket åbnes igen (fx efter «Tilbage»)
  const AFSLAGS = [['vare', 'Én vare med tilberedning'], ['del', 'Flere varer, linjen deles'], ['eller', 'Én af flere varer'], ['slet', 'Ikke en vare, linjen slettes']];
  const varianter = id => ing.filter(i => i.faelles_id === id).map(i => i.id);
  const ingNavn = id => (ing.find(i => i.id === id) || {}).navn || '';
  function forslagDel(t) { // «salt og peber» -> del: salt + peber, «smør eller margarine» -> eller
    const eller = / eller /.test(t), dele = t.split(eller ? / eller / : / og |\s*[,&+/]\s*/).map(x => x.trim()).filter(Boolean);
    return { slags: dele.length > 1 ? (eller ? 'eller' : 'del') : 'vare', varer: (dele.length > 1 ? dele : [t]).map(x => { const i = ing.find(c => c.navn_norm === x); return { navn: i ? i.navn : '', f: '' }; }) };
  }
  async function afklar(tekster, { hjemme = false, imp = false, kat: ck = {}, titel = '', note = '', gem = 'Gem', tilbage = 'Tilbage', felt = null, ordn = false } = {}) {
    await hent();
    const sp = [], set = new Set();
    for (const t of tekster) {
      const d = dele(t);
      if (!d.n || set.has(d.n)) continue;
      set.add(d.n);
      const l = laes(t);
      if (imp && l.udfald === 'taet') continue;
      let valg = l.lignende, fast = false;
      const fler = ordn && l.udfald === 'kendt' && l.via === 'navn' && OGELLER.test(d.k);
      if (l.udfald === 'kendt' && !fler) {
        if (!hjemme) continue;
        const ids = l.varer.map(v => v.id);
        if (l.slags === 'vare' && !varianter(ids[0]).length) continue;
        valg = ids; fast = true; // et fællesnavn eller en regel med flere varer: vælg én. Det huskes ikke som regel.
      }
      if (hjemme) valg = [...new Set(valg.flatMap(id => varianter(id).length ? varianter(id) : [id]))].slice(0, 6);
      const gl = husk.get(d.n);
      sp.push({ ...d, l, valg, fast, fler, s: gl || { valg: 'ikke', navn: d.k, kat: katId(ck[d.k] || ck[d.n] || '') || gaet(d.k) || '', ...forslagDel(d.n) } });
    }
    if (!sp.length) return {};
    const katValg = v => `<option value="">${IKKE_SORTERET}</option>` + sorteret().filter(k => k.navn_norm !== 'andet').map(k => `<option value="${k.id}"${k.id === v ? ' selected' : ''}>${esc(katNavn(k))}</option>`).join('');
    const hint = it => {
      if (it.fast) return it.l.slags === 'vare' ? 'Det er et fællesnavn. Vælg, hvilken du har derhjemme.' : 'Teksten står for flere varer. Vælg den, du har derhjemme.';
      const ens = it.fler ? 'Det er en ingrediens i kataloget, men den står for flere varer.' : it.l.udfald === 'taet' ? `Appen kender den ikke. Den ligner «${ingNavn(it.valg[0])}».` : it.valg.length ? 'Appen kender den ikke. Måske er det en af disse.' : 'Appen kender den ikke, og ingen ingredienser ligner.';
      return [ens, it.fler ? 'Vælg «Del selv» for at dele linjen. Det gælder kun denne opskrift.' : it.l.ogEller && !hjemme && 'Der står flere varer. Vælg «Del selv» for at dele linjen.', it.f && `«${it.f}» bliver stående på linjen.`].filter(Boolean).join(' ');
    };
    const radio = (i, v, tekst, s) => `<label class="skift"><input type="radio" name="af${i}" value="${v}"${s.valg === v ? ' checked' : ''}> <span>${tekst}</span></label>`;
    const delRaekker = (i, s) => {
      const n = s.slags === 'slet' ? 0 : s.slags === 'vare' ? 1 : Math.max(2, s.varer.length);
      while (s.varer.length < n) s.varer.push({ navn: '', f: '' });
      s.varer.length = n;
      return s.varer.map((v, j) => `<div class="iv-vare"><label for="afv${i}_${j}">${n > 1 ? 'Vare ' + (j + 1) : 'Vare'}</label>
        <input id="afv${i}_${j}" class="felt felt-m" list="afliste" value="${esc(v.navn)}" autocomplete="off" autocapitalize="off" spellcheck="false">
        <label for="aff${i}_${j}">Tilberedning (valgfrit)</label>
        <input id="aff${i}_${j}" class="felt felt-m" value="${esc(v.f)}" placeholder="fx finthakket" autocomplete="off" autocapitalize="off"></div>`).join('')
        + (n > 1 ? `<div class="rakke venstre"><button type="button" class="knap mini" data-af="vare" data-i="${i}">${ik('plus')} Tilføj vare</button></div>` : '');
    };
    const item = (it, i) => `<fieldset class="iv-valg af-sp" data-i="${i}"><legend>Hvad er «<span data-tpdata>${esc(it.n)}</span>»?</legend>
      <p class="lille">${esc(hint(it))}</p>
      ${it.valg.map(id => radio(i, 'v:' + id, `<span data-tpdata>${esc(ingNavn(id))}</span>`, it.s)).join('')}
      ${it.fast || it.fler ? '' : radio(i, 'ny', 'Opret ny ingrediens', it.s)}
      <div class="af-ny" ${it.s.valg === 'ny' ? '' : 'hidden'}>
        <label for="afn${i}">Navn på den nye ingrediens</label>
        <input id="afn${i}" class="felt felt-m" value="${esc(it.s.navn)}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="afnh${i}">
        <p class="lille" id="afnh${i}">Kun selve varen, fx «løg», ikke «hakket løg».</p>
        <label for="afk${i}">Kategori</label>
        <select id="afk${i}" class="felt felt-m">${katValg(it.s.kat)}</select></div>
      ${it.fast || hjemme ? '' : `${radio(i, 'del', 'Del selv', it.s)}
      <div class="af-del" ${it.s.valg === 'del' ? '' : 'hidden'}>
        <fieldset class="iv-valg"><legend>Teksten er</legend>${AFSLAGS.map(([k, t]) => `<label class="skift"><input type="radio" name="afs${i}" value="${k}"${it.s.slags === k ? ' checked' : ''}> <span>${t}</span></label>`).join('')}</fieldset>
        <div class="af-varer">${delRaekker(i, it.s)}</div></div>`}
      ${radio(i, 'ikke', hjemme ? 'Tilføj den ikke' : 'Ikke nu', it.s)}</fieldset>`;
    return new Promise(svar => {
      const en = sp.length === 1, top = felt
        ? `<h2 id="ordn-h">${en ? 'Appen er i tvivl om en ingrediens' : `Appen er i tvivl om ${sp.length} ingredienser`}</h2>
        <small>Vælg, hvad ${en ? 'den' : 'de'} er, så virker søgningen og «Hvad kan jeg lave?» rigtigt. Vælger du «Ikke nu», spørger appen igen, næste gang du åbner opskriften.</small>`
        : `<h2>Hvad betyder ${en ? 'teksten' : 'teksterne'}?</h2>
        ${titel ? `<p class="tekst-m">I opskriften «<span data-tpdata>${esc(titel)}</span>»</p>` : ''}
        <small>${en ? 'Appen kender ikke denne ingrediens' : `Appen kender ikke ${sp.length} af ingredienserne`}. Vælg, hvad ${en ? 'den' : 'de'} er. ${hjemme ? '' : 'Dit svar huskes, så du ikke bliver spurgt igen. Vælger du «Ikke nu», gemmes linjen, som den står, og du bliver spurgt igen næste gang.'}${note ? ' ' + esc(note) : ''}</small>`;
      const html = `${top}
        ${sp.map(item).join('')}
        <datalist id="afliste">${[...ing].filter(i => !hjemme || !varianter(i.id).length).sort((a, b) => a.navn.localeCompare(b.navn, 'da')).map(i => `<option value="${esc(i.navn)}"></option>`).join('')}</datalist>
        <div id="arkfejl"></div>
        <div class="rakke"><button type="button" class="knap annuller" data-tpid="${felt ? 'ordn-skjul' : 'annuller'}" data-af="tilbage">${esc(tilbage)}</button><button type="button" class="knap gem" data-tpid="${felt ? 'ordn-gem' : 'gem'}" data-af="gem">${ik('tjek')} ${esc(gem)}</button></div>`;
      let d;
      if (felt) { d = document.createElement('section'); d.setAttribute('aria-labelledby', 'ordn-h'); d.innerHTML = html; felt.replaceChildren(d); }
      else d = ark(html);
      const laesIt = (it, i) => { // arkets felter ind i svaret
        const s = it.s, v = $(`input[name="af${i}"]:checked`, d), sl = $(`input[name="afs${i}"]:checked`, d);
        if (v) s.valg = v.value;
        if ($('#afn' + i, d)) { s.navn = $('#afn' + i, d).value; s.kat = $('#afk' + i, d).value; }
        if (sl) s.slags = sl.value;
        s.varer.forEach((x, j) => { const a = $(`#afv${i}_${j}`, d), b = $(`#aff${i}_${j}`, d); if (a) x.navn = a.value; if (b) x.f = b.value; });
        husk.set(it.n, s);
      };
      const alleLaes = () => sp.forEach(laesIt);
      const fejlVis = liste => { $('#arkfejl', d).innerHTML = liste.length ? `<div class="fejlboks" role="alert" tabindex="-1">${liste.map(esc).join('<br>')}</div>` : ''; const b = $('#arkfejl .fejlboks', d); if (b) b.focus(); };
      d.addEventListener('change', e => {
        const fs = e.target.closest('.af-sp'); if (!fs) return;
        const i = Number(fs.dataset.i), it = sp[i];
        laesIt(it, i);
        const ny = $('.af-ny', fs); if (ny) ny.hidden = it.s.valg !== 'ny';
        const dl = $('.af-del', fs); if (dl) dl.hidden = it.s.valg !== 'del';
        if (e.target.name === 'afs' + i) $('.af-varer', fs).innerHTML = delRaekker(i, it.s);
      });
      const luk = ud => { if (felt) felt.replaceChildren(); else lukArk(); svar(ud); };
      d.addEventListener('click', async e => {
        const a = e.target.closest('[data-af]');
        if (!a && e.target.closest('.ark-bag')) { alleLaes(); return luk(null); }
        if (!a) return;
        if (a.dataset.af === 'tilbage') { alleLaes(); return luk(null); }
        if (a.dataset.af === 'vare') { const i = Number(a.dataset.i); laesIt(sp[i], i); sp[i].s.varer.push({ navn: '', f: '' }); const fs = a.closest('.af-sp'); $('.af-varer', fs).innerHTML = delRaekker(i, sp[i].s); $(`#afv${i}_${sp[i].s.varer.length - 1}`, d).focus(); return; }
        alleLaes();
        // Tjek svarene, før noget gemmes
        const fejl = [], nye = [], regl = [], ud = {};
        sp.forEach(it => {
          const s = it.s, hvad = `«${it.n}»`;
          if (s.valg === 'ikke') { ud[it.n] = false; return; }
          if (s.valg.startsWith('v:')) { const id = s.valg.slice(2); ud[it.n] = { id }; if (!it.fast && it.k !== (ing.find(i => i.id === id) || {}).navn_norm) regl.push({ tekst: it.k, slags: 'vare', resultat: [{ id }] }); return; }
          if (s.valg === 'ny') {
            const n = norm(s.navn);
            if (!n) return fejl.push(`${hvad}: skriv et navn på den nye ingrediens.`);
            if (/[(),;]/.test(n)) return fejl.push(`${hvad}: navnet må ikke have komma eller parentes.`);
            const i = ing.find(c => c.navn_norm === n), r = regler.find(c => c.tekst === n);
            if (r) return fejl.push(`${hvad}: «${n}» er allerede en regel. Vælg en af de lignende, eller skriv et andet navn.`);
            if (hjemme && i && varianter(i.id).length) return fejl.push(`${hvad}: «${n}» er et fællesnavn. Vælg en af varianterne.`);
            if (!i) nye.push({ navn: n, kategori_id: s.kat || null });
            ud[it.n] = { navn: n, ny: !i };
            if (it.k !== n) regl.push({ tekst: it.k, slags: 'vare', ny: n });
            return;
          }
          const res = []; // «Del selv»
          if (s.slags !== 'slet') s.varer.forEach((v, j) => {
            const n = norm(v.navn), hvilken = s.varer.length > 1 ? 'vare ' + (j + 1) : 'varen';
            if (!n) return fejl.push(`${hvad}: vælg ${hvilken} fra listen.`);
            const m = ing.find(c => c.navn_norm === n);
            if (!m) { const l = laes(n).lignende.slice(0, 3).map(id => '«' + ingNavn(id) + '»'); return fejl.push(`${hvad}: «${v.navn.trim()}» findes ikke i kataloget.${l.length ? ' Mente du ' + l.join(', ') + '?' : ''} Vælg ${hvilken} fra listen, eller vælg «Opret ny ingrediens».`); }
            if (res.some(x => x.id === m.id)) return fejl.push(`${hvad}: «${m.navn}» står to gange.`);
            res.push({ id: m.id, ...(v.f.trim() && { f: v.f.trim() }) });
          });
          if (it.fler) { ud[it.n] = { slags: s.slags, varer: res }; return; } // gælder kun denne opskrift
          if (s.slags === 'vare' && res.length === 1 && !res[0].f && it.k === ingNavn(res[0].id)) { ud[it.n] = { id: res[0].id }; return; }
          regl.push({ tekst: it.n, slags: s.slags, resultat: res });
          ud[it.n] = true;
        });
        if (fejl.length) return fejlVis(fejl);
        const knap = $('[data-af="gem"]', d), kt = knap.lastChild;
        knap.disabled = true; kt.textContent = ' Gemmer…';
        const andre = []; // regler, en anden enhed nåede at lave først: den, der findes, gælder
        try {
          await opret(nye);
          for (const it of sp) { const u = ud[it.n]; if (u && u.navn) ud[it.n] = { id: ing.find(c => c.navn_norm === u.navn).id, ny: u.ny }; }
          for (const r of regl) {
            const resultat = r.ny ? [{ id: ing.find(c => c.navn_norm === r.ny).id }] : r.resultat;
            const g = await api('rpc/ingrediens_regel_gem', { method: 'POST', body: { p: { tekst: r.tekst, slags: r.slags, resultat } } });
            if (!g.ok && g.grund === 'findes') andre.push(r.tekst);
          }
          await hent();
        } catch (err) {
          console.error(err);
          knap.disabled = false; kt.textContent = ' ' + gem;
          return fejlVis(['Svarene blev ikke gemt. Tjek internettet, og tryk på «' + gem + '» igen.']);
        }
        sp.forEach(it => husk.delete(it.n));
        if (andre.length) toast(`${andre.map(t => '«' + t + '»').join(', ')} havde allerede en regel fra en anden enhed. Den bruges.`);
        luk(ud);
      });
    });
  }
  // «Derhjemme»: ingrediensen, en tekst står for efter afklar. null: ingen (ukendt, «Tilføj den ikke» eller et fællesnavn).
  function hjemmeId(tekst, svar = {}) {
    const s = svar[dele(tekst).n];
    if (s === false) return null;
    if (s && s.id) return s.id;
    const l = laes(tekst);
    return l.udfald === 'kendt' && l.slags === 'vare' && !varianter(l.varer[0].id).length ? l.varer[0].id : null;
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
    ...rl.filter(erAlias).map(r => ({ t: r.tekst, id: r.resultat[0].id }))];
  function taetPaa(k, c) {
    const a = samlet(k), b = samlet(c);
    if (a.replace(/\D/g, '') !== b.replace(/\D/g, '')) return null; // «cremefraiche 38 %» er ikke «cremefraiche 18 %»
    if (a === b) return 'ord';
    const ka = k.split(' '), cb = c.split(' ');
    if ((ka.length === cb.length && ka.some((w, i) => boejning(w, cb[i])) && ka.every((w, i) => w === cb[i] || boejning(w, cb[i]))) || boejning(a, b)) return 'boejning';
    if (Math.min(a.length, b.length) >= 5 && afstand(a, b, 1) <= 1) return 'stavning';
    return null;
  }
  const OGELLER = /(^| )(og|eller)( |$)|[,&+/]/; // et navn med flere varer i
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
  // Teksten delt i hele teksten (n), selve varen (k) og tilberedningen (f): «finthakket løg» -> løg + finthakket
  const dele = tekst => { const n = rens(tekst), d = delIng(n), k = rens(d.n) || n; return { n, k, f: k === n ? '' : d.f }; };
  function laes(tekst, liste = ing, rl = regler) {
    const { n, k, f } = dele(tekst);
    const medF = (varer, ekstra) => varer.map(v => { const ff = [ekstra, v.f].filter(Boolean).join(', '); return { id: v.id, ...(ff && { f: ff }) }; });
    for (const [t, ff] of k === n ? [[n, '']] : [[n, ''], [k, f]]) {
      const r = rl.find(x => x.tekst === t);
      if (r) return { udfald: 'kendt', via: 'regel', slags: r.slags, regel: r, alias: erAlias(r) ? r.tekst : '', varer: medF(r.resultat, ff), lignende: [] };
      const i = liste.find(x => x.navn_norm === t);
      if (i) return { udfald: 'kendt', via: 'navn', slags: 'vare', varer: medF([{ id: i.id }], ff), lignende: [] };
    }
    const ogEller = OGELLER.test(k), alle = kandidater(liste, rl), grund = new Map();
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
    for (const r of regler) if (erAlias(r)) { const id = r.resultat[0].id; if (!idx.alias.has(id)) idx.alias.set(id, []); idx.alias.get(id).push(r.tekst); }
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
  // Navnet, der vises: et alias står, som det står i opskriften (t). Ellers navnet fra kataloget («frisk timian», «timian», «smør eller margarine»). Kendes en vare ikke, bruges navnet på linjen.
  // katalog: kun navnet fra kataloget (til at kende den samme vare, fx i «Hvad kan jeg lave?» og madplanen).
  function navn(x, katalog = false) {
    if (x.t && !katalog && !Array.isArray(x.eller)) return x.t;
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
    const ud = new Set([norm(x.n), ...(x.t ? [norm(x.t)] : [])]), ids = new Set();
    for (const id of varerAf(x)) { daekker(id).forEach(d => ids.add(d)); const f = I().id.get(id).faelles_id; if (f) ids.add(f); }
    for (const id of ids) { const i = I().id.get(id); if (i) ud.add(i.navn_norm); (I().alias.get(id) || []).forEach(t => ud.add(t)); }
    return [...ud];
  }
  // Er linjen et krydderi? Kategorien kommer fra kataloget. Ukendte ingredienser tæller ikke som krydderier.
  const krydderi = x => { const v = varerAf(x); return !!v.length && v.every(id => { const k = kat.find(c => c.id === I().id.get(id).kategori_id); return !!k && k.navn_norm === 'krydderier'; }); };

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
    }
  });
  return { hent, sikr, klar, erAlias, venter, tekstAf, ordnStille, ordn, rens, noegle, afklar, hjemmeId, knyt, laes, kategorier, varerAf, navn, medNavn, flereVarer: n => OGELLER.test(n), daekker, opfyldt, noegleAf, soegeord, krydderi };
})();
