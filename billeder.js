// Billeder til opskrifter (opdatering 4e).
// Filerne ligger i Supabase Storage (lageret «opskrift-billeder»), oplysningerne i tabellen «opskrift_billeder» (supabase/billeder.sql).
// Alt gøres mindre i browseren, før det sendes: JPEG, højst 1600 px på den lange led, og en lille udgave (400 px) til listen.
// Billederne i formularen sendes først, når man trykker «Gem». «Annuller» kaster dem væk.
// Findes tabellen eller lageret ikke endnu, virker resten af appen som før (hentning giver bare ingen billeder).
const Billeder = (() => {
  const BUCKET = 'opskrift-billeder', STOR = 1600, LILLE = 400, KVALITET = .8, MAX_BYTES = 1000000; // MAX_BYTES = lagerets grænse (1 MB)
  const url = (sti, lille) => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${sti}${lille ? '-s' : ''}.jpg`;
  const kb = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1000)) + ' kB';

  async function stApi(metode, sti, { body, type } = {}) {
    const h = { apikey: SUPABASE_ANON_KEY };
    if (type) h['Content-Type'] = type;
    if (metode === 'POST' && sti.startsWith('object/') && !sti.startsWith('object/list/')) h['x-upsert'] = 'true'; // et nyt forsøg må overskrive en halv upload
    const res = await fetch(`${SUPABASE_URL}/storage/v1/${sti}`, { method: metode, headers: h, body, cache: 'no-store' });
    if (!res.ok) throw new Error(res.status + ' ' + await res.text());
    return res.json().catch(() => null);
  }
  const liste = async (prefix) => {
    const ud = []; // lageret giver højst 1000 ad gangen
    for (let offset = 0; ; offset += 1000) {
      const d = await stApi('POST', `object/list/${BUCKET}`, { type: 'application/json', body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }) });
      ud.push(...(d || []));
      if (!d || d.length < 1000) return ud;
    }
  };
  const sletFiler = async stier => { if (stier.length) await stApi('DELETE', `object/${BUCKET}`, { type: 'application/json', body: JSON.stringify({ prefixes: stier }) }); };

  // Hentning. Mangler tabellen, er der bare ingen billeder.
  const hentFor = id => api(`opskrift_billeder?opskrift_id=eq.${enc(id)}&select=*&order=raekke`).catch(() => []);
  const hentForsider = () => api('opskrift_billeder?forside=eq.true&select=opskrift_id,sti').then(r => Object.fromEntries(r.map(x => [x.opskrift_id, x.sti]))).catch(() => ({}));

  // ---------- Gør billedet mindre ----------
  async function laes(fil) {
    try { return await createImageBitmap(fil, { imageOrientation: 'from-image' }); } // retter drejning fra telefonen. Safari læser også HEIC.
    catch (e) {
      return await new Promise((ok, nej) => { const u = URL.createObjectURL(fil), i = new Image(); i.onload = () => { URL.revokeObjectURL(u); ok(i); }; i.onerror = () => { URL.revokeObjectURL(u); nej(new Error('billede')); }; i.src = u; });
    }
  }
  function jpeg(bm, maks, kv) {
    const b = bm.width || bm.naturalWidth, h = bm.height || bm.naturalHeight, f = Math.min(1, maks / Math.max(b, h)), w2 = Math.round(b * f), h2 = Math.round(h * f);
    const c = document.createElement('canvas'); c.width = w2; c.height = h2;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w2, h2); x.drawImage(bm, 0, 0, w2, h2); // hvid bag, så gennemsigtige billeder ikke bliver sorte
    return new Promise((ok, nej) => c.toBlob(bl => bl ? ok({ blob: bl, w: w2, h: h2 }) : nej(new Error('billede')), 'image/jpeg', kv));
  }
  async function skaler(fil) {
    const bm = await laes(fil);
    let stor, maks = STOR, kv = KVALITET;
    for (let forsoeg = 0; forsoeg < 6; forsoeg++) { // for stort til lageret: lidt lavere kvalitet, så mindre mål
      stor = await jpeg(bm, maks, kv);
      if (stor.blob.size <= MAX_BYTES) break;
      if (kv > .55) kv -= .1; else maks = Math.round(maks * .8);
    }
    const lille = await jpeg(bm, LILLE, .75);
    if (bm.close) bm.close();
    if (stor.blob.size > MAX_BYTES) throw new Error('for stort');
    return { stor: stor.blob, lille: lille.blob, w: stor.w, h: stor.h, bytes: stor.blob.size };
  }

  // ---------- Visning ----------
  const alt = (tekst) => esc(tekst);
  // Forsiden og de øvrige billeder af hele retten, øverst på opskriften
  function toppen(rader, titel) {
    const hele = rader.filter(b => b.trin == null), fs = rader.find(b => b.forside) || hele[0]; // forsiden står altid øverst, også hvis den hører til et trin
    if (!fs) return '';
    const flere = hele.filter(b => b !== fs);
    const knap = (b, kl, tekst) => `<button type="button" class="bil-knap ${kl}" data-bil-stor="${url(b.sti)}" aria-label="${alt(tekst)}"><img src="${url(b.sti, kl === 'bil-lille')}" alt="" loading="${kl === 'bil-lille' ? 'lazy' : 'eager'}" decoding="async"></button>`;
    return `<div class="opsk-felt opsk-billeder" data-tpid="opsk-billeder">${knap(fs, 'bil-stor', `Se billedet af ${titel} stort`)}
      ${flere.length ? `<div class="bil-raekke">${flere.map((b, i) => knap(b, 'bil-lille', `Se billede ${i + 2} stort`)).join('')}</div>` : ''}</div>`;
  }
  // Billeder til ét trin (nummer fra 0)
  const trinHtml = (rader, i) => {
    const mine = rader.filter(b => b.trin === i);
    return mine.length ? `<div class="bil-trin">${mine.map(b => `<button type="button" class="bil-knap" data-bil-stor="${url(b.sti)}" aria-label="Se billedet til trin ${i + 1} stort"><img src="${url(b.sti)}" alt="" loading="lazy" decoding="async"></button>`).join('')}</div>` : '';
  };
  const miniature = sti => `<img class="oprk-bil" src="${url(sti, true)}" alt="" loading="lazy" decoding="async">`;

  // Stort billede: tryk på det eller på Luk (eller Esc) for at lukke
  let stortFoer = null;
  function lukStort() { const d = $('#bil-stor'); if (!d) return; d.remove(); document.removeEventListener('keydown', stortTast, true); if (stortFoer && stortFoer.isConnected) stortFoer.focus({ preventScroll: true }); stortFoer = null; }
  const stortTast = e => { if (e.key === 'Escape') { e.preventDefault(); lukStort(); } };
  function aabn(src) {
    lukStort(); stortFoer = document.activeElement;
    const d = document.createElement('div');
    d.id = 'bil-stor'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', 'Billede');
    d.innerHTML = `<img src="${src}" alt="">${Ikoner.rund('luk', 'Luk', 'data-bil-luk')}`;
    d.addEventListener('click', lukStort);
    document.body.append(d); document.addEventListener('keydown', stortTast, true);
    d.querySelector('button').focus({ preventScroll: true });
  }
  document.addEventListener('click', e => { const k = e.target.closest('[data-bil-stor]'); if (k) aabn(k.dataset.bilStor); });

  // ---------- Formularen: billeder under opskriften ----------
  // Tilstanden: liste = billederne i rækkefølge. Hvert har k (nøgle), og enten rad (findes i lageret) eller blob/lille (ny, sendes ved «Gem»).
  const ny = rader => ({ liste: rader.map(r => ({ k: r.id, rad: r, sti: r.sti, forside: !!r.forside, trin: r.trin, trinTekst: r.trin_tekst, bytes: r.bytes, src: url(r.sti, true) })), fjern: [] });

  function tegn(el, st, trinTekster) {
    const valg = (b) => `<option value="">Hele retten</option>${trinTekster.map((t, i) => `<option value="${i}"${b.trin === i ? ' selected' : ''}>Trin ${i + 1}: ${esc(t.length > 28 ? t.slice(0, 27) + '…' : t)}</option>`).join('')}`;
    el.innerHTML = `<h3 class="ed-titel" id="bil-h">Billeder</h3>
      <small>Tryk på kameraet for at tage et billede eller vælge fra enheden. De bliver gjort mindre og sendes, når du trykker på Gem.</small>
      <div class="bil-tilfoej">
        ${Ikoner.rund('kamera', 'Tilføj billede', 'data-tpid="bil-tilfoej" data-bil="aabn" aria-haspopup="menu" aria-expanded="false"', 'bil-rund')}
        <div class="bil-menu" role="menu" hidden>
          <button type="button" class="knap" role="menuitem" data-tpid="bil-tag" data-bil="kamera">${ik('kamera')} Tag billede</button>
          <button type="button" class="knap" role="menuitem" data-tpid="bil-vaelg" data-bil="vaelg">${ik('plus')} Vælg fra enheden</button>
        </div>
      </div>
      <input type="file" id="bil-kamera" accept="image/*" capture="environment" hidden>
      <input type="file" id="bil-vaelg" accept="image/*" multiple hidden>
      <p class="lille bil-status" role="status"></p>
      ${st.liste.length ? `<ul class="bil-liste">${st.liste.map((b, i) => `<li class="bil" data-k="${b.k}">
        <img src="${b.src}" alt="Billede ${i + 1}">
        <div class="bil-side">
          <label for="bil-t-${b.k}">Hører til</label>
          <select id="bil-t-${b.k}" data-bil="trin">${valg(b)}</select>
          <button type="button" class="chip${b.forside ? ' valgt' : ''}" data-bil="forside" aria-pressed="${b.forside}">${ik('stjerne')} Forside</button>
          <small>${b.bytes ? kb(b.bytes) : ''}${b.rad ? '' : ' · ny'}</small>
        </div>
        ${Ikoner.rund('slet', `Slet billede ${i + 1}`, 'data-bil="slet"')}
      </li>`).join('')}</ul>` : ''}`;
  }

  // Sætter billedafsnittet ind i el og giver et objekt, formularen bruger ved «Gem»
  function formular(el, rader, trinTekster) {
    const st = ny(rader);
    let trin = trinTekster();
    const rul = () => tegn(el, st, trin);
    const status = t => { const s = $('.bil-status', el); if (s) s.textContent = t; };
    const forsideRet = () => { if (st.liste.length && !st.liste.some(b => b.forside)) st.liste[0].forside = true; };
    async function tilfoej(filer) {
      for (const [i, fil] of [...filer].entries()) {
        status(`Gør billede ${i + 1} af ${filer.length} mindre…`);
        try {
          const s = await skaler(fil);
          st.liste.push({ k: 'n' + Math.random().toString(36).slice(2, 10), blob: s.stor, lille: s.lille, bytes: s.bytes, w: s.w, h: s.h, forside: false, trin: null, trinTekst: null, src: URL.createObjectURL(s.lille) });
          forsideRet(); rul();
        } catch (err) { console.error(err); status(''); fejlbesked(`Billedet «${fil.name || 'uden navn'}» kunne ikke læses. Prøv et andet billede (JPEG eller PNG).`); }
      }
      status(''); rul();
    }
    // Valget «Tag billede» / «Vælg fra enheden» under kameraknappen. Lukker ved valg, Esc og tryk udenfor.
    const menu = aaben => {
      const m = $('.bil-menu', el), k = $('.bil-rund', el); if (!m) return;
      m.hidden = !aaben; k.setAttribute('aria-expanded', aaben);
      if (aaben) m.querySelector('button').focus({ preventScroll: true });
    };
    el.addEventListener('keydown', e => { const m = $('.bil-menu', el); if (e.key === 'Escape' && m && !m.hidden) { e.stopPropagation(); menu(false); $('.bil-rund', el).focus(); } });
    document.addEventListener('click', e => { if (el.isConnected && !e.target.closest('.bil-tilfoej')) menu(false); });
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-bil]'); if (!b) return;
      const li = b.closest('.bil'), post = li && st.liste.find(x => x.k === li.dataset.k);
      if (b.dataset.bil === 'aabn') menu(!$('.bil-menu', el).hidden ? false : true);
      else if (b.dataset.bil === 'kamera') { menu(false); $('#bil-kamera', el).click(); }
      else if (b.dataset.bil === 'vaelg') { menu(false); $('#bil-vaelg', el).click(); }
      else if (b.dataset.bil === 'forside' && post) { st.liste.forEach(x => { x.forside = x === post; }); rul(); }
      else if (b.dataset.bil === 'slet' && post) {
        st.liste = st.liste.filter(x => x !== post); if (post.rad) st.fjern.push(post.rad); if (post.blob) URL.revokeObjectURL(post.src);
        forsideRet(); rul(); toast('Billedet slettes, når du trykker på Gem'); status('');
      }
    });
    el.addEventListener('change', e => {
      if (e.target.matches('input[type=file]')) { const f = [...e.target.files]; e.target.value = ''; if (f.length) tilfoej(f); return; }
      const s = e.target.closest('[data-bil=trin]'), li = s && s.closest('.bil'), post = li && st.liste.find(x => x.k === li.dataset.k);
      if (post) { post.trin = s.value === '' ? null : Number(s.value); post.trinTekst = post.trin == null ? null : trin[post.trin] || null; }
    });
    rul();
    return {
      st,
      // Trinnene er ændret: valgene i «Hører til» følger med
      trinNu() { const nu = trinTekster(); if (nu.join('\n') === trin.join('\n')) return; trin = nu; const aaben = el.contains(document.activeElement) && document.activeElement.matches('select'); if (!aaben) rul(); },
      antalNye: () => st.liste.filter(b => !b.rad).length + st.fjern.length,
      aendret: () => st.liste.some(b => !b.rad || b.forside !== !!b.rad.forside || b.trin !== b.rad.trin) || st.fjern.length > 0,
      frigiv() { st.liste.forEach(b => { if (b.blob) URL.revokeObjectURL(b.src); }); }
    };
  }

  // Sender det, der er ændret: først slettes filer (og tjekkes), så sendes nye, så rettes rækkerne. Fejler noget, kan «Gem» prøves igen.
  async function gem(f, opskriftId, trinTekster) {
    const st = f.st;
    for (const b of st.liste) { // billedet følger sit trin, selv om trinnene er flyttet eller rettet
      if (b.trin == null) { b.trinTekst = null; continue; }
      if (b.trinTekst && trinTekster[b.trin] !== b.trinTekst) { const j = trinTekster.indexOf(b.trinTekst); if (j >= 0) b.trin = j; }
      if (b.trin >= trinTekster.length) b.trin = null;
      b.trinTekst = b.trin == null ? null : trinTekster[b.trin];
    }
    if (st.liste.length && !st.liste.some(b => b.forside)) st.liste[0].forside = true;
    if (st.fjern.length) {
      await sletStier(st.fjern.flatMap(r => [r.sti + '.jpg', r.sti + '-s.jpg']));
      for (const r of st.fjern) await api(`opskrift_billeder?id=eq.${enc(r.id)}`, { method: 'DELETE' });
      st.fjern = [];
    }
    const nyForside = st.liste.find(b => b.forside), gammelForside = st.liste.find(b => b.rad && b.rad.forside);
    if (nyForside && gammelForside !== nyForside && st.liste.some(b => b.rad && b.rad.forside)) // højst én forside: den gamle slukkes først
      await api(`opskrift_billeder?opskrift_id=eq.${enc(opskriftId)}&forside=eq.true`, { method: 'PATCH', body: { forside: false } }).then(() => st.liste.forEach(b => { if (b.rad) b.rad.forside = false; }));
    for (const [i, b] of st.liste.entries()) {
      if (!b.rad) {
        const id = crypto.randomUUID(), sti = `${opskriftId}/${id}`;
        await stApi('POST', `object/${BUCKET}/${sti}.jpg`, { body: b.blob, type: 'image/jpeg' });
        await stApi('POST', `object/${BUCKET}/${sti}-s.jpg`, { body: b.lille, type: 'image/jpeg' });
        const r = (await api('opskrift_billeder', { method: 'POST', body: { id, opskrift_id: opskriftId, sti, forside: b.forside, trin: b.trin, trin_tekst: b.trinTekst, raekke: i, bytes: b.bytes, bredde: b.w, hoejde: b.h } }))[0];
        URL.revokeObjectURL(b.src); b.rad = r; b.k = r.id; b.sti = sti; b.src = url(sti, true); b.blob = b.lille = null;
      } else if (b.forside !== b.rad.forside || b.trin !== b.rad.trin || b.trinTekst !== b.rad.trin_tekst || i !== b.rad.raekke) {
        const [r] = await api(`opskrift_billeder?id=eq.${enc(b.rad.id)}`, { method: 'PATCH', body: { forside: b.forside, trin: b.trin, trin_tekst: b.trinTekst, raekke: i } });
        b.rad = r;
      }
    }
  }

  // Ét billede til en opskrift uden om formularen (bruges af «Importér opskrift»): gøres mindre og sendes som forside
  async function fraFil(opskriftId, fil) {
    const s = await skaler(fil);
    await gem({ st: { liste: [{ blob: s.stor, lille: s.lille, bytes: s.bytes, w: s.w, h: s.h, forside: true, trin: null, trinTekst: null, src: '' }], fjern: [] } }, opskriftId, []);
  }

  // Sletter filer og tjekker bagefter, at de er væk fra lageret (et svar uden fejl er ikke nok)
  async function sletStier(stier) {
    if (!stier.length) return;
    await sletFiler(stier);
    const mapper = [...new Set(stier.map(s => s.split('/')[0]))], tilbage = [];
    for (const m of mapper) { const fil = new Set((await liste(m)).map(x => `${m}/${x.name}`)); tilbage.push(...stier.filter(s => s.startsWith(m + '/') && fil.has(s))); }
    if (tilbage.length) throw new Error('Filerne blev ikke slettet: ' + tilbage.join(', '));
  }
  // Før en opskrift slettes: alle dens filer væk fra lageret. Fejler det, slettes opskriften ikke.
  async function sletFor(opskriftId) {
    const fil = await liste(opskriftId);
    await sletStier(fil.filter(x => x.id).map(x => `${opskriftId}/${x.name}`));
  }

  // ---------- Værkstedet: se og ryd op i lageret ----------
  // Filer uden række (efter en afbrudt «Gem» eller en slettet opskrift) og rækker uden fil.
  async function gennemgang() {
    const [raekker, mapper] = await Promise.all([api('opskrift_billeder?select=id,opskrift_id,sti,bytes'), liste('')]);
    const forventet = new Set(raekker.flatMap(r => [r.sti + '.jpg', r.sti + '-s.jpg']));
    const filer = [];
    const mn = mapper.filter(m => !m.id).map(m => m.name);
    for (let i = 0; i < mn.length; i += 6) await Promise.all(mn.slice(i, i + 6).map(async m => { for (const x of await liste(m)) if (x.id) filer.push({ sti: `${m}/${x.name}`, bytes: (x.metadata && x.metadata.size) || 0 }); }));
    const sti = new Set(filer.map(f => f.sti));
    const uden = filer.filter(f => !forventet.has(f.sti));
    return { billeder: raekker.length, filer: filer.length, bytes: filer.reduce((s, f) => s + f.bytes, 0), uden, udenBytes: uden.reduce((s, f) => s + f.bytes, 0), udenFil: raekker.filter(r => !sti.has(r.sti + '.jpg')).length };
  }
  async function ryd(uden) { for (let i = 0; i < uden.length; i += 50) await sletStier(uden.slice(i, i + 50).map(f => f.sti)); }

  return { url, kb, hentFor, hentForsider, toppen, trinHtml, miniature, formular, gem, fraFil, sletFor, gennemgang, ryd };
})();
