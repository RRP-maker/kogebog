// Hvad har du derhjemme? Et felt pr. ingrediens, sorteret efter kategori. Alt gemmes i Supabase:
// «ingredienser» er kataloget (navn -> kategori). Det lærer appen af, hver gang du skifter kategori.
const Hjemme = (() => {
  const ENH = ['stk', 'g', 'kg', 'ml', 'dl', 'l', 'pk', 'dåse', 'bundt', 'fed'];
  let D = { kat: [], ing: [], hj: [] }, valgtIng = null, laaser = false, ved = null;
  const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const ingAf = id => D.ing.find(i => i.id === id);
  const katAf = id => D.kat.find(k => k.id === id);
  const enhHtml = v => (ENH.includes(v) || !v ? ENH : [...ENH, v]).map(e => `<option${e === (v || 'stk') ? ' selected' : ''}>${esc(e)}</option>`).join('');

  // Gæt kategori ud fra kendte ingredienser: «røde løg» ligner «løg». Længste match vinder.
  function gaetKat(n) {
    let bedst = null;
    for (const i of D.ing) {
      if (!i.kategori_id || i.navn_norm.length < 3) continue;
      if ((n.includes(i.navn_norm) || i.navn_norm.includes(n)) && (!bedst || i.navn_norm.length > bedst.navn_norm.length)) bedst = i;
    }
    return bedst ? bedst.kategori_id : null;
  }
  async function findEllerOpret(navn) {
    const n = norm(navn);
    let ing = D.ing.find(i => i.navn_norm === n);
    if (ing) return ing;
    try { [ing] = await api('ingredienser', { method: 'POST', body: { navn: n, navn_norm: n, kategori_id: gaetKat(n) } }); }
    catch (e) { // en anden enhed nåede først
      D.ing = await api('ingredienser?select=*');
      ing = D.ing.find(i => i.navn_norm === n);
      if (!ing) throw e;
      return ing;
    }
    D.ing.push(ing);
    return ing;
  }
  // Står den allerede på listen? Samme navn, eller samme stamme (æble/æbler).
  function dublet(n, udenId) {
    return D.hj.find(h => { const i = ingAf(h.ingrediens_id); return h.id !== udenId && i && (i.navn_norm === n || stamme(i.navn_norm) === stamme(n)); });
  }
  function fremhaev(id) {
    const rk = app.querySelector(`.hj-rk[data-id="${id}"]`);
    if (!rk) return;
    rk.scrollIntoView({ block: 'center', behavior: 'smooth' });
    rk.classList.remove('blink'); void rk.offsetWidth; rk.classList.add('blink');
    rk.querySelector('.hj-mgd').focus();
  }
  const nej = (n, id) => { toast(`«${n}» står allerede på listen. Ret mængden her.`); fremhaev(id); };

  function raekke(h) {
    const i = ingAf(h.ingrediens_id);
    return `<div class="hj-rk felt felt-m" data-id="${h.id}">
      <input class="hj-mgd" type="text" inputmode="decimal" autocomplete="off" aria-label="Mængde" placeholder="Antal" value="${h.maengde != null ? esc(visTal(Number(h.maengde))) : ''}">
      <select class="hj-enh" aria-label="Enhed">${enhHtml(h.enhed)}</select>
      <input class="hj-navn" type="text" autocomplete="off" enterkeyhint="next" aria-label="Ingrediens" value="${esc(i ? i.navn : '')}">
      <button type="button" class="rund hj-ikon" data-h="hjKat" aria-label="Skift kategori">${ik('tag')}</button>
      <button type="button" class="rund hj-ikon hj-x" data-h="hjFjern" aria-label="Fjern fra listen">×</button></div>`;
  }
  function tegn() {
    const el = $('#hj-liste');
    if (!el) return;
    const a = document.activeElement, rk0 = a && a.closest && a.closest('#hj-liste .hj-rk');
    const fokus = rk0 && { id: rk0.dataset.id, k: [...a.classList].find(c => c.startsWith('hj-')) };
    const sorter = [...D.kat].sort((x, y) => x.raekkefolge - y.raekkefolge || x.navn.localeCompare(y.navn, 'da')).map(k => ({ navn: k.navn, id: k.id }));
    sorter.push({ navn: 'Andet', id: null });
    const navn = h => (ingAf(h.ingrediens_id) || {}).navn || '';
    const html = sorter.map(g => {
      const rader = D.hj.filter(h => ((ingAf(h.ingrediens_id) || {}).kategori_id || null) === g.id && (g.id || !katAf(((ingAf(h.ingrediens_id) || {}).kategori_id))))
        .sort((x, y) => navn(x).localeCompare(navn(y), 'da'));
      return rader.length ? `<h3 class="hj-grp">${esc(g.navn)}</h3>${rader.map(raekke).join('')}` : '';
    }).join('');
    el.innerHTML = html || '<p class="tomt">Der står ikke noget endnu. Skriv den første ting i feltet ovenfor.</p>';
    if (fokus) { const x = el.querySelector(`.hj-rk[data-id="${fokus.id}"] .${fokus.k}`); if (x) x.focus(); }
    if (ved) ved();
  }

  async function tilfoej() {
    const felt = $('#hj-ny-navn'), navn = felt.value.trim();
    if (!navn || laaser) return;
    const n = norm(navn), d = dublet(n);
    if (d) { felt.value = ''; return nej(n, d.id); }
    const mgd = $('#hj-ny .hj-mgd'), enh = $('#hj-ny .hj-enh');
    const m = mgd.value.trim() ? tal(mgd.value) : null;
    if (mgd.value.trim() && m == null) { toast('Skriv et tal i mængden, fx 2 eller 1,5.'); mgd.focus(); return; }
    laaser = true;
    try {
      const ing = await findEllerOpret(navn);
      const [ny] = await api('hjemme', { method: 'POST', body: { ingrediens_id: ing.id, maengde: m, enhed: enh.value } });
      D.hj.push(ny);
      felt.value = ''; mgd.value = ''; enh.value = 'stk';
      tegn();
    } catch (e) {
      console.error(e);
      if (/duplicate|23505|409/.test(String(e.message))) { D.hj = await api('hjemme?select=*&order=oprettet'); tegn(); toast(`«${n}» står allerede på listen.`); felt.value = ''; }
      else toast('Det blev ikke gemt. Tjek internettet, og prøv igen.');
    } finally { laaser = false; }
    felt.focus();
  }
  async function gemNavn(rk) {
    const h = D.hj.find(x => x.id === rk.dataset.id), inp = rk.querySelector('.hj-navn');
    if (!h) return;
    const gl = ingAf(h.ingrediens_id), n = norm(inp.value);
    if (!n) { inp.value = gl.navn; return; }
    if (n === gl.navn_norm) return;
    const d = dublet(n, h.id);
    if (d) { inp.value = gl.navn; return nej(n, d.id); }
    const ing = await findEllerOpret(inp.value);
    const [ny] = await api(`hjemme?id=eq.${enc(h.id)}`, { method: 'PATCH', body: { ingrediens_id: ing.id } });
    Object.assign(h, ny);
    tegn();
  }
  async function gemKat(ingId, katId) {
    const [ny] = await api(`ingredienser?id=eq.${enc(ingId)}`, { method: 'PATCH', body: { kategori_id: katId } });
    Object.assign(ingAf(ingId), ny);
    lukArk(); tegn();
    toast(`${ingAf(ingId).navn} står nu under ${katId ? katAf(katId).navn : 'Andet'}`);
  }

  const navne = () => D.hj.map(h => (ingAf(h.ingrediens_id) || {}).navn).filter(Boolean);
  // Lægger listen ind i en boks på siden. «aendret» kaldes, hver gang listen ændrer sig.
  async function vis(boks, aendret) {
    const id = visning;
    const [kat, ing, hj] = await Promise.all([api('ingrediens_kategorier?select=*'), api('ingredienser?select=*'), api('hjemme?select=*&order=oprettet')]);
    if (id !== visning) return;
    D = { kat, ing, hj }; ved = aendret;
    boks.innerHTML = `<h2>Tilføj ingrediens</h2>
      <small>Skriv én ting i hvert felt. Tryk retur for at gemme og skrive næste.</small>
      <div class="hj-rk felt felt-m hj-ny" id="hj-ny">
        <input class="hj-mgd" type="text" inputmode="decimal" autocomplete="off" aria-label="Mængde" placeholder="Antal">
        <select class="hj-enh" aria-label="Enhed">${enhHtml('stk')}</select>
        <input id="hj-ny-navn" class="hj-navn" type="text" autocomplete="off" enterkeyhint="next" aria-label="Ny ingrediens" placeholder="fx gulerødder">
      </div>
      <h2>Hvad har du derhjemme?</h2>
      <div id="hj-liste"></div>`;
    tegn();
  }

  Object.assign(H, {
    hjKat(el) {
      const h = D.hj.find(x => x.id === el.closest('.hj-rk').dataset.id), i = h && ingAf(h.ingrediens_id);
      if (!i) return;
      valgtIng = i.id;
      const kat = [...D.kat].sort((x, y) => x.raekkefolge - y.raekkefolge || x.navn.localeCompare(y.navn, 'da'));
      const d = ark(`<h2>Kategori</h2><small>${esc(i.navn)} hører til:</small>
        <div class="hj-katvalg">${kat.map(k => `<button type="button" class="chip${k.id === i.kategori_id ? ' valgt' : ''}" data-h="hjVaelgKat" data-v="${k.id}">${esc(k.navn)}</button>`).join('')}
          <button type="button" class="chip${i.kategori_id ? '' : ' valgt'}" data-h="hjVaelgKat" data-v="">Andet</button></div>
        <label for="hj_nykat">Ny kategori</label>
        <div class="linjeform"><input id="hj_nykat" type="text" maxlength="30" autocomplete="off" placeholder="fx Brød"><button type="button" class="knap primaer" data-h="hjNyKat">Opret</button></div>
        <div id="arkfejl"></div>
        <div class="rakke"><button type="button" class="knap" data-h="lukArk">Luk</button></div>`);
      $('.ark-bag', d).addEventListener('click', lukArk);
    },
    hjVaelgKat(el) { return gemKat(valgtIng, el.dataset.v || null); },
    async hjNyKat() {
      const navn = $('#hj_nykat').value.trim().replace(/\s+/g, ' '), n = norm(navn);
      if (!n) { $('#arkfejl').innerHTML = '<div class="fejlboks">Skriv et navn til kategorien.</div>'; return; }
      let k = D.kat.find(x => x.navn_norm === n);
      if (!k) {
        [k] = await api('ingrediens_kategorier', { method: 'POST', body: { navn, navn_norm: n, raekkefolge: Math.max(0, ...D.kat.map(x => x.raekkefolge)) + 1 } });
        D.kat.push(k);
      }
      await gemKat(valgtIng, k.id);
    },
    async hjFjern(el) {
      const rk = el.closest('.hj-rk'), id = rk.dataset.id, h = D.hj.find(x => x.id === id);
      await api(`hjemme?id=eq.${enc(id)}`, { method: 'DELETE' });
      D.hj = D.hj.filter(x => x.id !== id);
      tegn();
      toast(`${h ? (ingAf(h.ingrediens_id) || {}).navn : 'Ingrediensen'} er fjernet`);
    }
  });

  // Retur: videre til næste felt, eller gem det nye felt og lav plads til det næste
  document.addEventListener('keydown', async e => {
    if (e.key !== 'Enter' || e.isComposing) return;
    if (e.target.id === 'hj_nykat') { e.preventDefault(); return H.hjNyKat().catch(() => toast('Det virkede ikke. Prøv igen.')); }
    const rk = e.target.closest && e.target.closest('.hj-rk');
    if (!rk || !app.contains(rk)) return;
    e.preventDefault();
    try {
      if (rk.id === 'hj-ny') { if (e.target.classList.contains('hj-navn')) await tilfoej(); else $('#hj-ny-navn').focus(); return; }
      if (e.target.classList.contains('hj-navn')) await gemNavn(rk);
      const alle = [...app.querySelectorAll('.hj-rk')], nu = alle.indexOf(rk), naeste = alle[nu + 1];
      (naeste || $('#hj-ny')).querySelector('.hj-navn').focus();
    } catch (err) { console.error(err); toast('Det virkede ikke. Tjek internettet, og prøv igen.'); }
  });
  // Ændringer gemmes, når man forlader feltet
  document.addEventListener('change', async e => {
    const rk = e.target.closest && e.target.closest('.hj-rk');
    if (!rk || !app.contains(rk)) return;
    const ny = rk.id === 'hj-ny', h = ny ? null : D.hj.find(x => x.id === rk.dataset.id);
    try {
      if (e.target.classList.contains('hj-navn')) { if (ny) await tilfoej(); else await gemNavn(rk); }
      else if (h && e.target.classList.contains('hj-enh')) { await api(`hjemme?id=eq.${enc(h.id)}`, { method: 'PATCH', body: { enhed: e.target.value } }); h.enhed = e.target.value; }
      else if (h && e.target.classList.contains('hj-mgd')) {
        const t = e.target.value.trim(), m = t ? tal(t) : null;
        if (t && m == null) { toast('Skriv et tal i mængden, fx 2 eller 1,5.'); e.target.value = h.maengde != null ? visTal(Number(h.maengde)) : ''; return; }
        await api(`hjemme?id=eq.${enc(h.id)}`, { method: 'PATCH', body: { maengde: m } });
        h.maengde = m; e.target.value = m != null ? visTal(m) : '';
      }
    } catch (err) { console.error(err); toast('Det blev ikke gemt. Tjek internettet, og prøv igen.'); }
  });
  return { vis, navne };
})();
