const API = SUPABASE_URL + '/rest/v1/';
const $ = (s, rod = document) => rod.querySelector(s);
const app = $('#app');
let visning = 0; // tæller sider, så et langsomt svar ikke overskriver en nyere side

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const enc = encodeURIComponent;

// Små ting, der kun gemmes på denne enhed (hjælper til/fra, dine egne stjerner)
const lager = {
  hent(k, standard) { try { const v = localStorage.getItem('kogebog_' + k); return v == null ? standard : JSON.parse(v); } catch (e) { return standard; } },
  gem(k, v) { try { localStorage.setItem('kogebog_' + k, JSON.stringify(v)); } catch (e) { /* privat tilstand */ } }
};
const ENHED = (() => {
  let id = lager.hent('enhed');
  if (!id) { id = 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); lager.gem('enhed', id); }
  return id;
})();
const FAELLES = 'alle'; // favoritter er fælles for alle

// ---------- Supabase (REST, ingen pakker) ----------
async function api(sti, { method = 'GET', body, flet } = {}) {
  const headers = { apikey: SUPABASE_ANON_KEY };
  if (body) headers['Content-Type'] = 'application/json';
  if (method === 'POST' || method === 'PATCH') headers.Prefer = 'return=representation' + (flet === 'ignorer' ? ',resolution=ignore-duplicates' : flet ? ',resolution=merge-duplicates' : '');
  const res = await fetch(API + sti, { method, headers, cache: 'no-store', body: body && JSON.stringify(body) });
  if (!res.ok) throw new Error(res.status + ' ' + await res.text());
  return method === 'DELETE' ? null : res.json();
}

// ---------- Typer ----------
const TYPER = {
  opskrifter: {
    navn: 'Opskrifter', ny: 'Ny opskrift', rediger: 'Rediger opskrift',
    tom: 'Der er ingen opskrifter endnu. Tryk på «Ny opskrift» for at skrive den første.',
    bekraeft: 'Vil du slette opskriften? Den kan ikke hentes tilbage.', slettet: 'Opskriften er slettet',
    felter: [
      { n: 'titel', l: 'Navn', t: 'text', kraevet: true },
      { n: 'beskrivelse', l: 'Kort beskrivelse', t: 'textarea', rows: 2 },
      { n: 'kategori', l: 'Kategori', t: 'kategori', hint: 'Fx Aftensmad, Bagværk eller Dessert' },
      { n: 'svaerhed', l: 'Sværhed', t: 'valg', valg: [[1, '1 · Meget let'], [2, '2 · Let'], [3, '3 · Middel'], [4, '4 · Svær'], [5, '5 · Meget svær']] },
      { n: 'portioner', l: 'Antal portioner', t: 'number' },
      { n: 'tid_minutter', l: 'Tid i minutter', t: 'number' },
      { n: 'ingredienser', l: 'Ingredienser', t: 'ingredienser', hint: 'Én ingrediens i hvert felt. Skriv mængden først, fx «2 dl mælk». Tryk på «overskrift» for at sætte en overskrift over en ingrediens, fx Sovs eller Kødboller.' },
      { n: 'fremgangsmaade', l: 'Trin', t: 'trin', hint: 'Ét trin i hvert felt. Tryk på «deltrin» for at lave små skridt under et trin. Skriv tiden med, fx «Kog i 10 minutter», så kan man starte et ur.' }
    ]
  },
  metoder: {
    navn: 'Metode', ny: 'Ny metode', rediger: 'Rediger metode',
    tom: 'Der er ingen metoder endnu. En metode er en teknik, fx «koge ris» eller «piske æggehvider».',
    bekraeft: 'Vil du slette metoden? Den kan ikke hentes tilbage.', slettet: 'Metoden er slettet',
    felter: [
      { n: 'titel', l: 'Navn', t: 'text', kraevet: true, hint: 'Skriv det, som det står i opskrifterne, fx «koge ris». Så bliver ordet til et link.' },
      { n: 'beskrivelse', l: 'Kort forklaring', t: 'textarea', rows: 3 },
      { n: 'trin', l: 'Sådan gør du', t: 'textarea', rows: 8, hint: 'Ét trin på hver linje.' }
    ]
  },
  tips: {
    navn: 'Tips', ny: 'Nyt tip', rediger: 'Rediger tip',
    tom: 'Der er ingen tips endnu. Et tip er et lille råd, fx «Kom salt i vandet, før pastaen».',
    bekraeft: 'Vil du slette tippet? Det kan ikke hentes tilbage.', slettet: 'Tippet er slettet',
    felter: [
      { n: 'titel', l: 'Navn', t: 'text', kraevet: true, hint: 'Skriv det, som det står i opskrifterne, fx «koge ris». Så bliver ordet til et link.' },
      { n: 'tekst', l: 'Tip', t: 'textarea', rows: 5, kraevet: true },
      { n: 'opskrift_id', l: 'Hører til opskrift', t: 'opskrift', hint: 'Så står tippet også nederst på opskriften.' }
    ]
  }
};

// ---------- Små hjælpere ----------
let tt;
function toast(tekst) {
  const el = $('#toast');
  el.textContent = tekst; el.classList.add('vis');
  clearTimeout(tt); tt = setTimeout(() => el.classList.remove('vis'), 2600);
}
const info = t => { app.innerHTML = `<p class="tomt">${t}</p>`; };
const henter = () => { app.innerHTML = '<p class="tomt henter">Henter…</p>'; };

// ---------- Sideskift ----------
// Det nye indhold glider ind, når det er klar (ikke mens der står «Henter…»).
let indKlar = false, foerste = true, dybde = 0, indTimer;
function spilInd() {
  app.classList.remove('sideud', 'sideind');
  void app.offsetWidth; // start animationen forfra
  app.classList.add('sideind');
  clearTimeout(indTimer); indTimer = setTimeout(() => app.classList.remove('sideind'), 700);
}
new MutationObserver(() => {
  if (indKlar && app.firstChild && !$('.henter', app)) { indKlar = false; spilInd(); }
}).observe(app, { childList: true });
function fejl(e) {
  console.error(e);
  app.innerHTML = `<div class="fejlboks">Siden kunne ikke hentes. Tjek internettet, og prøv igen.</div>
    <button class="knap" data-h="igen">Prøv igen</button>`;
}
const ik = Ikoner.svg;
const stjernetekst = n => Ikoner.stjerner(n);
function chips(r) {
  return [
    r.kategori && esc(r.kategori),
    r.svaerhed && `<span aria-label="Sværhed ${r.svaerhed} af 5">Sværhed ${stjernetekst(r.svaerhed)}</span>`,
    r.tid_minutter && `${ik('ur')} ${r.tid_minutter} min`
  ].filter(Boolean);
}
const linjer = t => String(t || '').split('\n').map(s => s.trim().replace(/^(\d+[.)]|[-•*])\s+/, '')).filter(Boolean);

// Ark: lille vindue nedefra. Bruges til bekræftelse og til at oprette tip/metode på stedet.
function ark(html) {
  lukArk();
  const d = document.createElement('div');
  d.id = 'ark';
  d.innerHTML = `<div class="ark-bag"></div><div class="ark-kort" role="dialog" aria-modal="true">${html}</div>`;
  document.body.append(d);
  return d;
}
function lukArk() { const a = $('#ark'); if (a) a.remove(); }
function bekraeft(tekst, ja = 'Slet') {
  return new Promise(svar => {
    const d = ark(`<p class="ark-tekst">${esc(tekst)}</p><div class="rakke">
      <button class="knap" data-svar="0">Behold</button><button class="knap fare" data-svar="1">${esc(ja)}</button></div>`);
    d.addEventListener('click', e => {
      const b = e.target.closest('[data-svar]');
      if (b || e.target.closest('.ark-bag')) { lukArk(); svar(!!b && b.dataset.svar === '1'); }
    });
  });
}

// ---------- Ingredienser: mængde, enhed, navn ----------
const ENHEDER = ['g', 'kg', 'ml', 'cl', 'dl', 'l', 'tsk', 'spsk', 'stk', 'knsp', 'nip', 'dåse', 'dåser', 'fed', 'bundt', 'pk', 'pakke', 'pakker', 'skive', 'skiver', 'håndfuld', 'glas', 'kop', 'kopper', 'pose', 'poser', 'bakke', 'bakker'];
const BROEK = { '½': 0.5, '¼': 0.25, '¾': 0.75, '1/2': 0.5, '1/4': 0.25, '3/4': 0.75 };
function tal(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (v == null) return null;
  const s = String(v).trim();
  if (s in BROEK) return BROEK[s];
  const n = parseFloat(s.replace(',', '.'));
  return isFinite(n) ? n : null;
}
function parseIng(linje) {
  const s = String(linje).trim().replace(/^[-•*]\s*/, '');
  const m = s.match(/^(\d+\/\d+|\d+(?:[.,]\d+)?|[½¼¾])\s*(.*)$/);
  if (!m || !m[2]) return { m: null, e: '', n: s };
  const ord = m[2].split(/\s+/);
  let e = '';
  if (ord.length > 1 && ENHEDER.includes(ord[0].toLowerCase().replace(/\.$/, ''))) e = ord.shift().replace(/\.$/, '');
  return { m: tal(m[1]), e, n: ord.join(' ') };
}
function normIng(x) {
  if (typeof x === 'string') return parseIng(x);
  if (!x || typeof x !== 'object') return null;
  const n = String(x.n ?? x.navn ?? x.name ?? '').trim();
  if (!n) return null;
  return { m: tal(x.m ?? x.maengde ?? x['mængde'] ?? x.antal), e: String(x.e ?? x.enhed ?? '').trim(), n };
}
// ingredienser gemmes som en liste. Et element { g: "Sovs" } er en overskrift, resten er ingredienser.
// (Ældre kode ignorerer overskrifterne, så de gør ingen skade.)
function ingListe(r) {
  return (Array.isArray(r.ingredienser) ? r.ingredienser : []).map(x =>
    x && typeof x === 'object' && typeof x.g === 'string' ? (x.g.trim() ? { g: x.g.trim() } : null) : normIng(x)).filter(Boolean);
}
const ingAf = r => ingListe(r).filter(x => !('g' in x));
// [{ navn: null | "Sovs", ing: [...] }, ...]. Første gruppe har intet navn, hvis der står ingredienser før første overskrift.
function ingGrupper(r) {
  const ud = [{ navn: null, ing: [] }];
  for (const x of ingListe(r)) {
    if ('g' in x) ud.push({ navn: x.g, ing: [] }); else ud[ud.length - 1].ing.push(x);
  }
  return ud.filter((g, i) => g.ing.length || (i > 0 && g.navn));
}
// fremgangsmaade er tekst: ét trin pr. linje. En linje, der starter med mellemrum, er et deltrin under trinnet over.
const TRINRENS = /^(\d+[.)]|[-•*])\s+/;
function trinAf(r) {
  const ud = [];
  for (const raa of String(r.fremgangsmaade || '').split('\n')) {
    const t = raa.trim().replace(TRINRENS, '');
    if (!t) continue;
    if (/^\s/.test(raa) && ud.length) ud[ud.length - 1].del.push(t); else ud.push({ t, del: [] });
  }
  return ud;
}
const trinTilTekst = trin => trin.map(t => [t.t, ...t.del.map(d => '  ' + d)].join('\n')).join('\n');
function visTal(n) {
  const d = n >= 100 ? 0 : n >= 1 ? 1 : 2;
  return String(Math.round(n * 10 ** d) / 10 ** d).replace('.', ',');
}
const visIng = (i, faktor = 1) => [i.m != null ? visTal(i.m * faktor) : '', i.e, i.n].filter(Boolean).join(' ');

// ---------- Begreber: ord i en opskrift, der har et tip eller en metode ----------
function begreberAf(tips, metoder) {
  return [
    ...tips.filter(t => t.titel).map(t => ({ type: 'tips', id: t.id, navn: t.titel.trim(), tekst: t.tekst })),
    ...metoder.filter(m => m.titel).map(m => ({ type: 'metoder', id: m.id, navn: m.titel.trim(), tekst: [m.beskrivelse, linjer(m.trin).map((s, i) => `${i + 1}. ${s}`).join(' ')].filter(Boolean).join(' ') }))
  ].filter(b => b.navn.length > 1).sort((a, b) => b.navn.length - a.navn.length);
}
const BOGSTAV = /[a-zæøåéü0-9]/;
function medBegreber(tekst, begreber) {
  const lav = tekst.toLowerCase(), fund = [];
  for (const b of begreber) {
    const n = b.navn.toLowerCase();
    let i = -1;
    while ((i = lav.indexOf(n, i + 1)) !== -1) {
      const foer = lav[i - 1], efter = lav[i + n.length];
      if ((foer && BOGSTAV.test(foer)) || (efter && BOGSTAV.test(efter))) continue;
      if (fund.some(f => i < f.s + f.l && f.s < i + n.length)) continue;
      fund.push({ s: i, l: n.length, b });
    }
  }
  fund.sort((a, b) => a.s - b.s);
  let ud = '', p = 0;
  for (const f of fund) {
    ud += esc(tekst.slice(p, f.s)) + `<button type="button" class="begreb" data-h="begreb" data-v="${f.b.type}:${f.b.id}">${esc(tekst.slice(f.s, f.s + f.l))}</button>`;
    p = f.s + f.l;
  }
  return ud + esc(tekst.slice(p));
}
let kendteBegreber = [];
function lukForklaring() { const f = $('.forklaring'); if (f) f.remove(); }

// ---------- Ure ----------
function tidISek(tekst) {
  const m = String(tekst).match(/(\d+(?:[.,]\d+)?)\s*(sekunder|sekund|sek|minutter|minut|min|timer|time)(?![a-zæøå])/i);
  if (!m) return 0;
  const n = parseFloat(m[1].replace(',', '.')), e = m[2].toLowerCase();
  return Math.round(n * (e.startsWith('s') ? 1 : e.startsWith('m') ? 60 : 3600));
}
const visTid = s => { s = Math.max(0, Math.ceil(s)); const t = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (t ? t + ':' + String(m).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0'); };
const visVarighed = s => s >= 3600 ? `${visTal(s / 3600)} time${s === 3600 ? '' : 'r'}` : s >= 60 ? `${visTal(s / 60)} min` : `${s} sek`;
let ure = [], urNr = 0;
function startUr(navn, sek) {
  ure.push({ id: ++urNr, navn, slut: Date.now() + sek * 1000, sek, varslet: false, faerdig: false });
  Lyd.spil('klik'); tegnUre();
  Hjaelper.sig(`Uret er startet: ${visVarighed(sek)}. Jeg siger til, når tiden er gået.`, { nu: true });
}
function tegnUre() {
  $('#ure').innerHTML = ure.map(u => `<div class="ur${u.faerdig ? ' faerdig' : ''}" data-ur="${u.id}">
    <span>${ik('ur')} <b>${u.faerdig ? 'Færdig!' : visTid((u.slut - Date.now()) / 1000)}</b> ${esc(u.navn)}</span>
    <button type="button" data-h="stopUr" data-v="${u.id}" aria-label="Stop uret">×</button></div>`).join('');
  document.documentElement.style.setProperty('--ure-h', $('#ure').offsetHeight + 'px'); // så «Tilføj tip» ikke skjuler sig bag urene
  document.querySelectorAll('[data-urvis]').forEach(el => {
    const u = ure.find(x => x.navn === el.dataset.urvis);
    el.textContent = u ? (u.faerdig ? 'Tiden er gået!' : visTid((u.slut - Date.now()) / 1000)) : '';
  });
}
setInterval(() => {
  if (!ure.length) return;
  for (const u of ure) {
    const rest = (u.slut - Date.now()) / 1000;
    if (!u.varslet && u.sek > 120 && rest <= 60 && rest > 0) { u.varslet = true; Hjaelper.sig(`Husk uret: Der er 1 minut tilbage af «${u.navn}».`); }
    if (!u.faerdig && rest <= 0) {
      u.faerdig = true; Lyd.spil('ur');
      if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
      toast('Tiden er gået: ' + u.navn);
      Hjaelper.sig(`Ding! Tiden er gået: «${u.navn}».`, { glad: true, nu: true });
    }
  }
  tegnUre();
}, 500);

// ---------- Router ----------
let opskriftFra = null; // kom man til opskriften fra Hvad kan jeg lave?, fører tilbage-knappen dertil
async function route() {
  const id = ++visning;
  lukArk(); lukForklaring(); slipSkaerm(); sidsteValg = '';
  const dele = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent), [a, b, c] = dele;
  app.dataset.retning = dele.length > dybde ? 'frem' : dele.length < dybde ? 'tilbage' : 'samme';
  dybde = dele.length;
  if (a === 'forslag' || a === 'hjemme') opskriftFra = '#/forslag'; else if (a !== 'opskrifter' || !b) opskriftFra = null;
  if (!foerste && app.firstChild) {
    app.classList.remove('sideind'); app.classList.add('sideud');
    await new Promise(r => setTimeout(r, 120));
    if (id !== visning) return;
  }
  foerste = false; indKlar = true;
  window.scrollTo(0, 0);
  document.body.dataset.side = c === 'lav' ? 'lav' : (a || 'forside');
  try {
    if (a === 'forslag') return await forslagSide();
    if (a === 'import') return importSide();
    if (a === 'mere') return mereSide();
    if (a === 'hjemme') return await forslagSide();
    if (!TYPER[a]) { document.body.dataset.side = 'forside'; return await forside(); }
    if (b === 'ny') return await formular(a);
    if (c === 'rediger') return await formular(a, b);
    if (a === 'opskrifter' && b && c === 'lav') return await lavSide(b);
    if (a === 'opskrifter' && b) return await opskriftSide(b);
    if (a === 'metoder' && b) return await metodeSide(b);
    return await liste(a);
  } catch (e) { fejl(e); }
}
window.addEventListener('hashchange', route);

// ---------- Forside ----------
async function forside() {
  const id = visning;
  app.innerHTML = `<h1 class="forsidetitel">Hvad skal vi lave?</h1>
    <nav class="faner">
      <a class="fane f1" href="#/opskrifter"><span aria-hidden="true">${ik('gryde')}</span>Opskrifter</a>
      <a class="fane f2" href="#/metoder"><span aria-hidden="true">${ik('ske')}</span>Metode</a>
      <a class="fane f3" href="#/tips"><span aria-hidden="true">${ik('paere')}</span>Tips</a>
    </nav>
    <h2>Favoritter</h2>
    <div id="favoritter"><p class="lille">Henter…</p></div>
    <nav class="genveje">
      <a class="knap" href="#/forslag">${ik('kurv')} Hvad kan jeg lave?</a>
    </nav>`;
  Hjaelper.side('Her er forsiden. Tryk på Opskrifter for at finde en ret. Under Metode og Tips kan du lære, hvordan man gør. Favoritter er dem med stjerne.');
  tilfoejTilHjem();
  const [fav, ops] = await Promise.all([api('favoritter?select=opskrift_id'), api('opskrifter?select=id,titel,kategori,svaerhed,tid_minutter&order=titel')]);
  if (id !== visning) return;
  const ids = new Set(fav.map(f => f.opskrift_id)), liste = ops.filter(o => ids.has(o.id));
  $('#favoritter').innerHTML = liste.length ? liste.map(r => opskriftKort(r, true)).join('')
    : '<p class="lille">Ingen favoritter endnu. Tryk på stjernen på en opskrift, så står den her.</p>';
}
// iPhone/iPad i en browser (ikke som app på hjemmeskærmen): Hjælperen viser, hvordan man lægger Kogebog på hjemmeskærmen. Én gang pr. gang siden åbnes.
let hjemVist = false;
function tilfoejTilHjem() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const app = navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  if (!ios || app || hjemVist) return;
  hjemVist = true;
  Hjaelper.sig('Læg Kogebog på hjemmeskærmen, så åbner den som en rigtig app:\n1. Tryk på Del-knappen i Safari (firkanten med en pil op).\n2. Rul ned, og tryk på «Føj til hjemmeskærm».\n3. Tryk på «Tilføj» øverst til højre.', { stor: true });
}
const opskriftKort = (r, fav) => `<a class="kort" href="#/opskrifter/${r.id}"><strong>${fav ? `<span class="guld">${ik('stjerne')}</span> ` : ''}${esc(r.titel)}</strong>
  ${chips(r).length ? `<span class="chips">${chips(r).map(c => `<span>${c}</span>`).join('')}</span>` : ''}</a>`;

// ---------- Lister ----------
let L = {}; // data til den liste, der vises
async function liste(type) {
  const id = visning, T = TYPER[type];
  henter();
  const [rader, ekstra] = await Promise.all([
    api(`${type}?select=*&order=${type === 'opskrifter' || type === 'metoder' ? 'titel' : 'oprettet.desc'}`),
    type === 'tips' ? api('opskrifter?select=id,titel') : type === 'opskrifter' ? api('favoritter?select=opskrift_id') : []
  ]);
  if (id !== visning) return;
  L = { type, rader, q: '', kat: '', navne: {}, fav: new Set() };
  if (type === 'tips') L.navne = Object.fromEntries(ekstra.map(o => [o.id, o.titel]));
  if (type === 'opskrifter') L.fav = new Set(ekstra.map(f => f.opskrift_id));
  const kat = [...new Set(rader.map(r => r.kategori).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'da'));
  app.innerHTML = `<a class="tilbage" href="#/">‹ Forside</a>
    <h1>${T.navn}</h1>
    <div class="rakke">
      <a class="knap primaer" href="#/${type}/ny">+ ${T.ny}</a>
      ${type === 'opskrifter' ? `<a class="knap" href="#/import">${ik('gnist')} Tilføj med Claude</a>` : ''}
    </div>
    ${type === 'opskrifter' && rader.length ? `<input id="soeg" type="search" placeholder="Søg i navne og ingredienser" aria-label="Søg i opskrifter" autocomplete="off">
      ${kat.length ? `<div class="filter"><button class="chip valgt" data-h="kat" data-v="">Alle</button>${kat.map(k => `<button class="chip" data-h="kat" data-v="${esc(k)}">${esc(k)}</button>`).join('')}</div>` : ''}` : ''}
    <div id="liste"></div>`;
  tegnListe();
  const s = $('#soeg');
  if (s) s.addEventListener('input', () => { L.q = s.value.trim().toLowerCase(); tegnListe(); });
  Hjaelper.side({ opskrifter: 'Her er alle opskrifter. Skriv i søgefeltet for at finde en ret, eller tryk på en kategori. Tryk på «Ny opskrift» for at skrive din egen.',
    metoder: 'En metode er en teknik, fx at koge ris. Hvis en metode har samme navn som et ord i en opskrift, bliver ordet til et link.',
    tips: 'Et tip er et lille råd. Hvis et tip har samme navn som et ord i en opskrift, bliver ordet til et link.' }[type]);
}
function tegnListe() {
  const { type, rader, q, kat } = L, T = TYPER[type];
  const vis = rader.filter(r => (!kat || r.kategori === kat) &&
    (!q || (r.titel || '').toLowerCase().includes(q) || (type === 'opskrifter' && ingAf(r).some(i => i.n.toLowerCase().includes(q)))));
  $('#liste').innerHTML = vis.length ? vis.map(r => {
    if (type === 'opskrifter') return opskriftKort(r, L.fav.has(r.id));
    if (type === 'metoder') return `<a class="kort" href="#/metoder/${r.id}"><strong>${esc(r.titel)}</strong>${r.beskrivelse ? `<span>${esc(r.beskrivelse)}</span>` : ''}</a>`;
    const til = L.navne[r.opskrift_id];
    return `<article class="kort" id="tip-${r.id}">${r.titel ? `<strong>${esc(r.titel)}</strong>` : ''}<p class="tekst">${esc(r.tekst)}</p>
      ${til ? `<p class="lille">Til: <a href="#/opskrifter/${r.opskrift_id}">${esc(til)}</a></p>` : ''}${knapper('tips', r.id)}</article>`;
  }).join('') : `<p class="tomt">${rader.length ? 'Ingen opskrifter passer. Prøv et andet ord.' : T.tom}</p>`;
}
const knapper = (type, id, ekstra = '') => `<div class="rakke skaerm">
  <a class="knap" href="#/${type}/${id}/rediger">Rediger</a>${ekstra}
  <button class="knap fare" data-h="slet" data-v="${type}:${id}">Slet</button></div>`;

// ---------- Metode ----------
async function metodeSide(rid) {
  const id = visning;
  henter();
  const [r] = await api(`metoder?id=eq.${enc(rid)}&select=*`);
  if (id !== visning) return;
  if (!r) return info('Metoden findes ikke længere.<br><a href="#/metoder">Tilbage til Metode</a>');
  const trin = linjer(r.trin);
  app.innerHTML = `<a class="tilbage" href="#/metoder">‹ Metode</a><h1>${esc(r.titel)}</h1>
    ${r.beskrivelse ? `<p class="tekst">${esc(r.beskrivelse)}</p>` : ''}
    <h2>Sådan gør du</h2>
    ${trin.length ? `<ol class="trin">${trin.map(t => `<li>${esc(t)}</li>`).join('')}</ol>` : '<p class="lille">Der er ingen trin endnu. Tryk på «Rediger» for at skrive dem.</p>'}
    ${knapper('metoder', r.id)}`;
  Hjaelper.side('Her er en metode. Læs trinene, og prøv selv. Du kan rette teksten med «Rediger».');
}

// ---------- Opskrift ----------
let S = null; // den opskrift, der vises
const portValg = {};
async function opskriftSide(rid) {
  const id = visning;
  henter();
  const q = `opskrift_id=eq.${enc(rid)}`;
  const [rr, tips, metoder, fav, stj, lr] = await Promise.all([
    api(`opskrifter?id=eq.${enc(rid)}&select=*`), api('tips?select=*&order=oprettet.desc'), api('metoder?select=*'),
    api(`favoritter?${q}&select=id`), api(`stjerner?${q}&select=antal,bruger_id`), api(`laerred?${q}&select=*&order=oprettet`)
  ]);
  if (id !== visning) return;
  const r = rr[0];
  if (!r) return info('Opskriften findes ikke længere.<br><a href="#/opskrifter">Tilbage til Opskrifter</a>');
  S = { r, tips, metoder, fav: fav.length > 0, stj, port: portValg[rid] || r.portioner || 4 };
  kendteBegreber = begreberAf(tips, metoder);
  const c = chips(r), egne = tips.filter(t => t.opskrift_id === r.id);
  app.innerHTML = `<a class="tilbage skaerm" href="${opskriftFra || '#/opskrifter'}">‹ ${opskriftFra ? 'Hvad kan jeg lave?' : 'Opskrifter'}</a>
    ${vaerktoej(`<a class="knap" href="#/opskrifter/${r.id}/rediger">${ik('blyant')} Rediger</a>`)}
    <div class="titelrakke"><h1>${esc(r.titel)}</h1>
      <button id="favknap" class="favknap skaerm" data-h="favorit" aria-pressed="${S.fav}" aria-label="Favorit">${ik(S.fav ? 'stjerne' : 'stjerne0')}</button></div>
    ${c.length ? `<p class="chips">${c.map(x => `<span>${x}</span>`).join('')}</p>` : ''}
    ${r.beskrivelse ? `<p class="tekst">${esc(r.beskrivelse)}</p>` : ''}
    <button class="knap primaer stor skaerm" data-h="lav">▶ Lav retten trin for trin</button>
    <h2 class="opsk">Ingredienser</h2>
    <div class="portioner skaerm"><button class="rund" data-h="port" data-v="-1" aria-label="Færre portioner">−</button>
      <span id="portvis"></span><button class="rund" data-h="port" data-v="1" aria-label="Flere portioner">+</button></div>
    <ul class="ing" id="ing"></ul>
    <h2 class="opsk">Sådan gør du</h2>
    <div id="trin"></div>
    <h2 class="skaerm opsk">Vores side</h2>
    <p class="lille skaerm opsk">Sæt billeder og figurer på siden, og flyt dem rundt.</p>
    <div class="laerred-ramme skaerm"><div id="laerred" class="laerred"></div></div>
    <div id="laerred-knapper" class="rakke skaerm"></div>
    <input id="billedfil" type="file" accept="image/*" hidden>
    <h2 class="skaerm opsk">Hvordan smagte det?</h2>
    <div id="stjerner" class="skaerm"></div>
    ${egne.length ? `<h2 class="opsk">Tips til retten</h2>${egne.map(t => `<div class="kort">${t.titel ? `<strong>${esc(t.titel)}</strong>` : ''}<p class="tekst">${esc(t.tekst)}</p></div>`).join('')}` : ''}
    <div class="rakke skaerm"><button class="knap" data-h="print">Print</button>
      <button class="knap fare" data-h="slet" data-v="opskrifter:${r.id}">Slet</button></div>`;
  tegnIng(); tegnTrin(); tegnStjerner(); tegnLaerredKnapper(false);
  $('#billedfil').addEventListener('change', nytBillede);
  const lel = $('#laerred');
  lel.addEventListener('valgt', e => { const k = $('#fjernvalgt'); if (k) k.disabled = !e.detail; });
  Hjaelper.side('Her er opskriften. Tryk på plus og minus for at ændre antal portioner. Blå ord kan du trykke på. Tryk på «Lav retten trin for trin» øverst, når du er klar.');
  await Laerred.start(lel, lr, r.id);
}
// Knapperne øverst. «Tilføj tip» sidder fast øverst til venstre, mens man ruller. Ekstra knapper kommer til højre.
const vaerktoej = (hoejre = '') => `<div class="vaerktoej skaerm"><button type="button" class="knap" data-h="nytBegreb">${ik('paere')} Tilføj tip</button>${hoejre}</div>`;
// Overskrift (fx «Sovs») i en liste af ingredienser
const ingOverskrift = navn => `<li class="grp">${esc(navn)}</li>`;
function tegnIng() {
  const grp = ingGrupper(S.r), f = S.port / (S.r.portioner || S.port);
  $('#portvis').textContent = S.port + (S.port === 1 ? ' portion' : ' portioner');
  $('#ing').innerHTML = grp.length ? grp.map(g => (g.navn ? ingOverskrift(g.navn) : '') + g.ing.map(i => `<li><span>${esc(visIng(i, f))}</span></li>`).join('')).join('')
    : '<li class="lille">Ingen ingredienser endnu. Tryk på «Rediger» for at skrive dem.</li>';
}
function tegnTrin() {
  const trin = trinAf(S.r), b = kendteBegreber;
  $('#trin').innerHTML = trin.length ? `<ol class="trin">${trin.map(t => `<li>${medBegreber(t.t, b)}${
    t.del.length ? `<ul class="deltrin">${t.del.map(d => `<li>${medBegreber(d, b)}</li>`).join('')}</ul>` : ''}</li>`).join('')}</ol>`
    : '<p class="lille">Der er ingen trin endnu. Tryk på «Rediger» for at skrive dem.</p>';
}
function stjerneHtml(stj) {
  const min = (stj.find(s => s.bruger_id === ENHED) || {}).antal || 0;
  const snit = stj.length ? stj.reduce((a, s) => a + s.antal, 0) / stj.length : 0;
  return `<div class="stjernevalg" role="group" aria-label="Giv stjerner">${[1, 2, 3, 4, 5].map(n =>
    `<button class="${n <= min ? 'til' : ''}" data-h="stjerne" data-v="${n}" aria-label="${n} stjerne${n > 1 ? 'r' : ''}">${ik(n <= min ? 'stjerne' : 'stjerne0')}</button>`).join('')}</div>
    <p class="lille">${stj.length ? `Snit: ${visTal(snit)} af 5 (${stj.length} ${stj.length === 1 ? 'vurdering' : 'vurderinger'})` : 'Giv stjerner, når du har lavet retten.'}</p>`;
}
function tegnStjerner() { const el = $('#stjerner'); if (el) el.innerHTML = stjerneHtml(S.stj); }
function tegnLaerredKnapper(rediger) {
  $('#laerred-knapper').innerHTML = rediger
    ? `<button class="knap" data-h="vaelgBillede">${ik('kamera')} Billede</button>
       ${Laerred.FIGURER.map(f => `<button class="rund" data-h="figur" data-v="${f.n}" aria-label="Sæt ${f.t} på siden">${ik(f.n)}</button>`).join('')}
       <button class="knap fare" id="fjernvalgt" data-h="fjernValgt" disabled>Fjern den valgte</button>
       <button class="knap primaer" data-h="laerredRediger" data-v="0">Færdig</button>`
    : `<button class="knap" data-h="laerredRediger" data-v="1">${ik('blyant')} Flyt og tilføj</button>`;
}
async function nytBillede(e) {
  const fil = e.target.files[0]; e.target.value = '';
  if (!fil) return;
  try { toast('Gemmer billedet…'); await Laerred.nytBillede(fil); toast('Billedet er sat på siden'); Hjaelper.glad(); }
  catch (err) { console.error(err); toast('Billedet kunne ikke gemmes. Prøv et andet.'); }
}

// ---------- Trin for trin ----------
let K = null, skaermlaas = null;
async function holdSkaerm() { try { if (navigator.wakeLock) skaermlaas = await navigator.wakeLock.request('screen'); } catch (e) { /* ikke vigtigt */ } }
function slipSkaerm() { if (skaermlaas) { skaermlaas.release().catch(() => {}); skaermlaas = null; } }
async function lavSide(rid) {
  const id = visning;
  henter();
  const q = `opskrift_id=eq.${enc(rid)}`;
  const [rr, tips, metoder, stj] = await Promise.all([api(`opskrifter?id=eq.${enc(rid)}&select=*`), api('tips?select=*'), api('metoder?select=*'), api(`stjerner?${q}&select=antal,bruger_id`)]);
  if (id !== visning) return;
  const r = rr[0];
  if (!r) return info('Opskriften findes ikke længere.<br><a href="#/opskrifter">Tilbage til Opskrifter</a>');
  kendteBegreber = begreberAf(tips, metoder);
  K = { r, trin: trinAf(r), i: -1, port: portValg[rid] || r.portioner || 4, talt: false, afkr: {} };
  S = { r, tips, metoder, stj, port: K.port, fav: false };
  holdSkaerm();
  tegnLav();
  Hjaelper.side('Her laver du retten. Der er ét trin ad gangen. Tryk på «Næste», når du er færdig med et trin. Står der en tid, kan du starte et ur.');
}
const urKnap = (tekst, navn, stor) => {
  const sek = tidISek(tekst);
  if (!sek) return '';
  const igang = ure.some(u => u.navn === navn);
  return `<div class="lav-ur"><button class="knap${stor ? ' stor' : ''}" data-h="ur" data-v="${sek}" data-navn="${esc(navn)}">${ik('ur')} ${igang ? 'Start uret igen' : 'Start ur'}: ${visVarighed(sek)}</button>
    <b class="urvis" data-urvis="${esc(navn)}"></b></div>`;
};
function tegnLav() {
  const { r, trin, i } = K, n = trin.length;
  lukForklaring();
  let midte, naeste = 'Næste ›';
  if (i === -1) {
    const grp = ingGrupper(r), f = K.port / (r.portioner || K.port);
    midte = `<h1>Find tingene frem</h1><p class="lille">${K.port} ${K.port === 1 ? 'portion' : 'portioner'}</p>
      <ul class="ing tjek">${grp.map(g => (g.navn ? ingOverskrift(g.navn) : '') + g.ing.map(x => `<li><label><input type="checkbox"> <span>${esc(visIng(x, f))}</span></label></li>`).join('')).join('')
        || '<li class="lille">Der står ingen ingredienser.</li>'}</ul>`;
    naeste = n ? 'Start ›' : 'Færdig';
  } else if (i < n) {
    const t = trin[i], navn = `${r.titel}, trin ${i + 1}`;
    // Trinnet og dets deltrin står på samme side. Deltrin kan man sætte flueben ved, og de kan have eget ur.
    midte = `<p class="lav-trin">${medBegreber(t.t, kendteBegreber)}</p>${urKnap(t.t, navn, true)}
      ${t.del.length ? `<ul class="ing tjek lav-del">${t.del.map((d, j) => `<li><label><input type="checkbox" data-del="${i}:${j}" ${K.afkr[i + ':' + j] ? 'checked' : ''}> <span>${medBegreber(d, kendteBegreber)}</span></label>${urKnap(d, `${navn}.${j + 1}`)}</li>`).join('')}</ul>` : ''}`;
    if (i === n - 1) naeste = `Færdig ${ik('tjek')}`;
  } else {
    midte = `<h1>Velbekomme!</h1><p class="tekst">Du har lavet ${esc(r.titel)}. Hvordan smagte det?</p><div id="stjerner">${stjerneHtml(S.stj)}</div>`;
    naeste = '';
  }
  app.innerHTML = `<div class="lav">
    <div class="lav-top"><a class="knap" href="#/opskrifter/${r.id}">× Luk</a>
      <span>${i === -1 ? 'Før du går i gang' : i < n ? `Trin ${i + 1} af ${n}` : 'Færdig'}</span></div>
    <progress max="${n + 1}" value="${i + 1}" aria-label="Hvor langt du er"></progress>
    <div class="lav-midte">${midte}</div>
    <div class="lav-bund">
      <button class="knap stor" data-h="lavTrin" data-v="-1" ${i === -1 ? 'disabled' : ''}>‹ Tilbage</button>
      ${naeste ? `<button class="knap stor primaer" data-h="lavTrin" data-v="1">${naeste}</button>` : `<a class="knap stor primaer" href="#/opskrifter/${r.id}">Til opskriften</a>`}
    </div></div>`;
  tegnUre();
  window.scrollTo(0, 0);
  if (i === n && !K.talt) {
    K.talt = true;
    Hjaelper.glad('Flot klaret! Du har lavet hele retten.');
  }
}

// ---------- Redigering af ingredienser og trin: ét skrivefelt pr. linje ----------
const ORD_OVERSKRIFT = 'overskrift'; // ordet i knappen, der deler ingredienserne op (fx Sovs, Kødboller)
function rkHtml(ed, { art = 'ing', niv = 0, tekst = '' } = {}) {
  const fjern = '<button type="button" class="rk-fjern" data-h="rkFjern" aria-label="Fjern linjen">×</button>';
  if (ed === 'ing') {
    const o = art === 'over';
    return `<div class="rk${o ? ' over' : ''}" data-art="${o ? 'over' : 'ing'}">
      <div class="rk-felt"><textarea class="rk-tekst" rows="1" enterkeyhint="next" autocomplete="off" aria-label="${o ? 'Overskrift' : 'Ingrediens'}"
        placeholder="${o ? 'Overskrift, fx Sovs' : 'fx 2 dl mælk'}">${esc(tekst)}</textarea>${fjern}</div>
      <button type="button" class="rk-knap" data-h="rkSkift" aria-label="Skift til ${o ? 'ingrediens' : ORD_OVERSKRIFT}"><b>${o ? ik('gulerod') : 'Aa'}</b><small>${o ? 'ingrediens' : ORD_OVERSKRIFT}</small></button>
      <button type="button" class="rk-knap" data-h="rkNy" aria-label="Tilføj ingrediens"><b>＋</b><small>ingrediens</small></button></div>`;
  }
  return `<div class="rk" data-niv="${niv}">
    <div class="rk-felt"><span class="rk-mark" aria-hidden="true"></span><textarea class="rk-tekst" rows="1" enterkeyhint="next" autocomplete="off"
      aria-label="${niv ? 'Deltrin' : 'Trin'}" placeholder="${niv ? 'Deltrin, fx Hak løget' : 'Skriv et trin'}">${esc(tekst)}</textarea>${fjern}</div>
    <button type="button" class="rk-knap" data-h="rkNy" data-v="trin" aria-label="Tilføj trin"><b>＋</b><small>trin</small></button>
    <button type="button" class="rk-knap" data-h="rkNy" data-v="del" aria-label="Tilføj deltrin"><b>${ik('deltrin')}</b><small>deltrin</small></button></div>`;
}
function edFelt(f, rad) {
  const ed = f.t === 'trin' ? 'trin' : 'ing';
  let rader;
  if (ed === 'ing') rader = ingListe(rad).map(x => 'g' in x ? { art: 'over', tekst: x.g } : { art: 'ing', tekst: visIng(x) });
  else rader = trinAf(rad).flatMap(t => [{ niv: 0, tekst: t.t }, ...t.del.map(d => ({ niv: 1, tekst: d }))]);
  if (!rader.length) rader = [{}];
  return `<div class="edfelt"><h3 class="ed-titel">${f.l}</h3>${f.hint ? `<small>${f.hint}</small>` : ''}
    <div class="ed ed-${ed}" data-ed="${ed}" id="ed_${f.n}">${rader.map(r => rkHtml(ed, r)).join('')}</div></div>`;
}
const rkFelt = rk => rk.querySelector('.rk-tekst');
function rkVokser(t) { if (!t.scrollHeight) return; t.style.height = 'auto'; t.style.height = (t.scrollHeight + t.offsetHeight - t.clientHeight) + 'px'; }
function rkFokus(rk) { const t = rkFelt(rk); t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
function rkIndsaet(ed, efter, data, fokus = true, foer = false) {
  const tmp = document.createElement('template');
  tmp.innerHTML = rkHtml(ed.dataset.ed, data).trim();
  const rk = tmp.content.firstElementChild;
  if (efter) efter[foer ? 'before' : 'after'](rk); else ed.append(rk);
  rkVokser(rkFelt(rk));
  if (fokus) rkFokus(rk);
  return rk;
}
function rkGruppeSlut(rk) { // sidste deltrin under et trin (eller trinnet selv)
  let sidste = rk;
  if (rk.dataset.niv === '0') while (sidste.nextElementSibling && sidste.nextElementSibling.dataset.niv === '1') sidste = sidste.nextElementSibling;
  return sidste;
}
function rkEnter(rk) { // retur: videre til næste felt, eller lav et nyt
  const ed = rk.closest('.ed'), naeste = rk.nextElementSibling, tom = !rkFelt(rk).value.trim();
  if (naeste) return rkFokus(naeste);
  if (ed.dataset.ed === 'ing') { if (!tom) rkIndsaet(ed, null, { art: 'ing' }); return; }
  if (rk.dataset.niv === '1' && tom) { rk.dataset.niv = '0'; rkFelt(rk).placeholder = 'Skriv et trin'; return; } // tomt deltrin + retur = nyt trin
  rkIndsaet(ed, null, { niv: rk.dataset.niv === '1' ? 1 : 0 });
}
function rkInput(t) { // vokser med teksten, og delt tekst med linjeskift (indsat) bliver til flere felter
  rkVokser(t);
  if (!t.value.includes('\n')) return;
  const rk = t.closest('.rk'), ed = rk.closest('.ed'), trin = ed.dataset.ed === 'trin';
  const dele = t.value.split('\n').map(x => x.trim().replace(trin ? TRINRENS : /^[-•*]\s+/, '')).filter(Boolean);
  t.value = dele.shift() || ''; rkVokser(t);
  let efter = rk;
  for (const d of dele) efter = rkIndsaet(ed, efter, { art: rk.dataset.art, niv: rk.dataset.niv, tekst: d }, false);
  rkFokus(efter);
}
function laesIngEd(ed) {
  const ud = [];
  for (const rk of ed.querySelectorAll('.rk')) {
    const t = rkFelt(rk).value.replace(/\s*\n\s*/g, ' ').trim();
    if (t) ud.push(rk.dataset.art === 'over' ? { g: t } : parseIng(t));
  }
  return ud;
}
function laesTrinEd(ed) {
  const ud = [];
  let ejer = false; // hører deltrinnet til et trin med tekst?
  for (const rk of ed.querySelectorAll('.rk')) {
    const t = rkFelt(rk).value.replace(/\s*\n\s*/g, ' ').trim().replace(TRINRENS, '');
    if (rk.dataset.niv !== '1') ejer = !!t;
    if (!t) continue;
    if (rk.dataset.niv === '1' && ejer && ud.length) ud[ud.length - 1].del.push(t); else ud.push({ t, del: [] });
  }
  return ud.length ? trinTilTekst(ud) : null;
}

// ---------- Formular (opret / rediger) ----------
function felt(f, rad, ekstra) {
  const v = rad[f.n];
  const m = `id="f_${f.n}" name="${f.n}"` + (f.kraevet ? ' required' : '');
  let input;
  if (f.t === 'ingredienser' || f.t === 'trin') return edFelt(f, rad);
  if (f.t === 'textarea') input = `<textarea ${m} rows="${f.rows || 4}">${esc(v)}</textarea>`;
  else if (f.t === 'number') input = `<input ${m} type="number" inputmode="numeric" min="0" step="1" value="${esc(v)}">`;
  else if (f.t === 'valg') input = `<select ${m}><option value="">Vælg</option>${f.valg.map(([k, t]) => `<option value="${k}"${k === v ? ' selected' : ''}>${t}</option>`).join('')}</select>`;
  else if (f.t === 'opskrift') input = `<select ${m}><option value="">Ingen bestemt opskrift</option>${
    ekstra.map(o => `<option value="${o.id}"${o.id === v ? ' selected' : ''}>${esc(o.titel)}</option>`).join('')}</select>`;
  else if (f.t === 'kategori') input = `<input ${m} type="text" list="kategorier" value="${esc(v)}" autocomplete="off"><datalist id="kategorier">${
    [...new Set([...ekstra.map(o => o.kategori).filter(Boolean), 'Aftensmad', 'Morgenmad', 'Frokost', 'Bagværk', 'Dessert', 'Snack'])].map(k => `<option value="${esc(k)}">`).join('')}</datalist>`;
  else input = `<input ${m} type="text" value="${esc(v)}" autocomplete="off">`;
  return `<label for="f_${f.n}">${f.l}${f.kraevet ? '' : ' <span>(kan springes over)</span>'}</label>
    ${f.hint ? `<small>${f.hint}</small>` : ''}${input}`;
}
function laesFelter(form, felter, visFejl) {
  const data = {};
  for (const f of felter) {
    if (f.t === 'ingredienser') { data[f.n] = laesIngEd($('#ed_' + f.n, form)); continue; }
    if (f.t === 'trin') { data[f.n] = laesTrinEd($('#ed_' + f.n, form)); continue; }
    const el = form.elements[f.n], v = el.value.trim();
    if (f.kraevet && !v) { visFejl(`Skriv noget i feltet «${f.l}».`); el.focus(); return null; }
    if (f.t === 'number' || f.t === 'valg') {
      const n = v === '' ? null : Number(v);
      if (n !== null && !(Number.isInteger(n) && n >= 0)) { visFejl(`«${f.l}» skal være et helt tal, fx 4.`); el.focus(); return null; }
      data[f.n] = n;
    } else data[f.n] = v === '' ? null : v;
  }
  return data;
}
async function formular(type, rid) {
  const id = visning, T = TYPER[type];
  henter();
  const [r, ekstra] = await Promise.all([
    rid ? api(`${type}?id=eq.${enc(rid)}&select=*`) : [],
    type === 'tips' ? api('opskrifter?select=id,titel&order=titel') : type === 'opskrifter' ? api('opskrifter?select=kategori') : []
  ]);
  if (id !== visning) return;
  if (rid && !r[0]) return info(`Den findes ikke længere.<br><a href="#/${type}">Tilbage</a>`);
  const rad = r[0] || {};
  const tilbage = rid && type !== 'tips' ? `#/${type}/${rid}` : `#/${type}`;
  app.innerHTML = `<a class="tilbage" href="${tilbage}">‹ Fortryd</a>
    ${type === 'opskrifter' ? vaerktoej() : ''}
    <h1>${rid ? T.rediger : T.ny}</h1>
    <form id="form" novalidate>
      ${T.felter.map(f => felt(f, rad, ekstra)).join('')}
      <div id="formfejl"></div>
      <button class="knap primaer stor" type="submit">Gem</button>
    </form>`;
  Hjaelper.side(type === 'opskrifter' ? 'Skriv opskriften her. Skriv én ingrediens i hvert felt og ét trin i hvert felt. Tryk på retur for at komme til næste felt. Tryk på «Gem», når du er færdig.' : 'Skriv i felterne, og tryk på «Gem». Navnet bliver til et link i opskrifter, hvor ordet står.');
  const form = $('#form');
  form.querySelectorAll('.rk-tekst').forEach(rkVokser);
  form.addEventListener('input', e => { if (e.target.classList.contains('rk-tekst')) rkInput(e.target); });
  form.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing && e.target.classList.contains('rk-tekst')) { e.preventDefault(); rkEnter(e.target.closest('.rk')); }
  });
  form.addEventListener('beforeinput', e => { // telefoner sender ikke altid Enter som tast
    if (e.target.classList.contains('rk-tekst') && (e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph')) { e.preventDefault(); rkEnter(e.target.closest('.rk')); }
  });
  const visFejl = tekst => { $('#formfejl').innerHTML = `<div class="fejlboks">${tekst}</div>`; };
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = laesFelter(form, T.felter, visFejl);
    if (!data) return;
    let valg = {};
    if (type === 'opskrifter') { try { valg = await Katalog.spoerg(ingAf(data).map(i => i.n)); } catch (err) { console.error(err); } } // spørger om kategorier til nye ingredienser
    const knap = form.querySelector('button[type=submit]');
    knap.disabled = true; knap.textContent = 'Gemmer…';
    try {
      const res = rid
        ? await api(`${type}?id=eq.${enc(rid)}`, { method: 'PATCH', body: data })
        : await api(type, { method: 'POST', body: data });
      if (type === 'opskrifter') { try { await Katalog.laeg(ingAf(data).map(i => i.n), valg); } catch (err) { console.error(err); } }
      toast('Gemt'); Hjaelper.glad('Gemt!');
      location.hash = type === 'tips' ? '#/tips' : `#/${type}/${rid || res[0].id}`;
    } catch (err) {
      console.error(err);
      visFejl('Det blev ikke gemt. Tjek internettet, og tryk på «Gem» igen.');
      knap.disabled = false; knap.textContent = 'Gem';
    }
  });
}

document.addEventListener('change', async e => {
  const d = e.target.closest('[data-del]');
  if (d && K) { K.afkr[d.dataset.del] = d.checked; return; } // husk flueben på deltrin
});

// ---------- Hvad kan jeg lave? (ren logik, ingen AI) ----------
const BASIS = ['salt', 'olie', 'vand', 'peber'];
const stamme = s => { s = s.toLowerCase().replace(/[^a-zæøåéü ]/g, '').trim(); return s.length > 4 ? s.replace(/(erne|ene|er|en|et|e|r)$/, '') : s; };
const erBasis = n => BASIS.some(b => n === b || n.endsWith(b) || n.split(' ').includes(b));
const passer = (a, b) => a === b || (a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a)));
function beregnForslag(opskrifter, harTekst) {
  const har = harTekst.split(/[,\n]/).map(stamme).filter(Boolean);
  const rader = opskrifter.map(r => {
    const brug = ingAf(r).map(i => i.n.toLowerCase()).filter(n => !erBasis(n));
    const mangler = [...new Set(brug.filter(n => !har.some(h => passer(stamme(n), h))).map(stamme))];
    return { r, antal: brug.length, mangler };
  }).filter(x => x.antal > 0);
  const kan = rader.filter(x => !x.mangler.length), naesten = rader.filter(x => x.mangler.length);
  // Find 1 og 2 ting at købe, som giver flest nye retter
  const kandidater = [...new Set(naesten.flatMap(x => x.mangler))];
  const nye = saet => naesten.filter(x => x.mangler.every(m => saet.includes(m))).map(x => x.r);
  let en = null, to = null;
  for (const a of kandidater) { const n = nye([a]); if (n.length && (!en || n.length > en.retter.length)) en = { koeb: [a], retter: n }; }
  for (let i = 0; i < kandidater.length; i++) for (let j = i + 1; j < kandidater.length; j++) {
    const n = nye([kandidater[i], kandidater[j]]);
    if (n.length > (en ? en.retter.length : 0) && (!to || n.length > to.retter.length)) to = { koeb: [kandidater[i], kandidater[j]], retter: n };
  }
  return { kan: kan.map(x => x.r), naesten: naesten.sort((a, b) => a.mangler.length - b.mangler.length), koeb: [en, to].filter(Boolean) };
}
let F = [];
async function forslagSide() {
  const id = visning;
  henter();
  F = await api('opskrifter?select=id,titel,kategori,svaerhed,tid_minutter,ingredienser&order=titel');
  if (id !== visning) return;
  app.innerHTML = `<a class="tilbage" href="#/">‹ Forside</a><h1>Hvad kan jeg lave?</h1>
    <div id="forslag-nu"></div>
    <div id="hj-boks"></div>
    <button type="button" class="knap" data-h="sorterAndet">${ik('gnist')} Sortér «Andet» med Claude</button>
    <div id="forslag-resten"></div>`;
  Hjaelper.side('Skriv det, du har derhjemme, ét ord i hvert felt. Så finder jeg retter, du kan lave, og siger, hvad du kan købe for at lave flere.');
  await Hjemme.vis($('#hj-boks'), tegnForslag);
}
const maksMangler = () => Math.max(0, Math.min(20, Math.round(Number(lager.hent('maxMangler', 3))) || 0));
function tegnForslag() {
  const nu = $('#forslag-nu'), rest = $('#forslag-resten'), tekst = Hjemme.navne().join(',');
  if (!nu) return;
  if (!tekst.trim()) { nu.innerHTML = '<h2>Det kan du lave nu</h2><p class="tomt">Skriv mindst én ting herunder, så finder jeg retter.</p>'; rest.innerHTML = ''; return; }
  const f = beregnForslag(F, tekst), maks = maksMangler(), naesten = f.naesten.filter(x => x.mangler.length <= maks);
  nu.innerHTML = `<h2>Det kan du lave nu</h2>
    ${f.kan.length ? f.kan.map(r => opskriftKort(r)).join('') : '<p class="lille">Ingen retter endnu. Se, hvad du kan købe længere nede.</p>'}`;
  rest.innerHTML = `${f.koeb.length ? `<h2>Køb lidt, og lav mere</h2>${f.koeb.map(k => `<div class="kort koebsforslag"><strong>Køb ${esc(k.koeb.join(' og '))}</strong>
      <span>Så kan du også lave: ${k.retter.map(r => `<a href="#/opskrifter/${r.id}">${esc(r.titel)}</a>`).join(', ')}</span></div>`).join('')}` : ''}
    <div class="mangler-top"><h2>Du mangler lidt</h2>
      <div class="stepper" role="group" aria-label="Højst så mange ingredienser må mangle">
        <button type="button" class="rund felt felt-s" data-h="maksNed" aria-label="Færre">−</button>
        <input id="maks" class="felt felt-s" type="text" inputmode="numeric" autocomplete="off" value="${maks}" aria-label="Højst så mange ingredienser må mangle">
        <button type="button" class="rund felt felt-s" data-h="maksOp" aria-label="Flere">+</button></div></div>
    <small>Højst ${maks} ${maks === 1 ? 'ingrediens' : 'ingredienser'} må mangle.</small>
    ${naesten.length ? naesten.slice(0, 20).map(x => `<a class="kort" href="#/opskrifter/${x.r.id}"><strong>${esc(x.r.titel)}</strong><span>Mangler: ${esc(x.mangler.join(', '))}</span></a>`).join('') : '<p class="lille">Ingen retter mangler så få. Skriv et højere tal.</p>'}`;
}
function saetMaks(n) { lager.gem('maxMangler', Math.max(0, Math.min(20, Math.round(Number(n)) || 0))); tegnForslag(); }

// ---------- Tilføj med Claude ----------
const CLAUDE_BESKED = `Omskriv opskriften nederst til min kogebog-app. Den skal kunne laves af en 10-årig, men uden at være mere detaljeret end nødvendigt.

Regler:
- Skriv på dansk.
- Del retten op i trin. Et trin er en meningsfuld del af arbejdet, fx "Lav kødbollerne" eller "Kog pastaen". Er der flere små handlinger i et trin, så skriv dem som deltrin under trinnet.
- Slå oplagte småting sammen. Skriv fx "Skræl og hak løget" som ét deltrin, ikke to. Er et trin kun én handling, så skriv det uden deltrin.
- Korte sætninger.
- Skriv konkrete værdier: komfurets varme fra 1 til 9, om ovnen skal forvarmes (og til hvor mange grader), og hvor lang tid det tager. Skriv tiden i den sætning, den hører til, fx "Kog i 10 minutter".
- Har retten flere dele, fx sovs og kødboller, så del ingredienserne op i grupper med en overskrift. Har den kun én del, så brug én gruppe med "overskrift": null.
- Mængder skal være tal, fx 2,5 dl skrives som 2.5. Mangler der en mængde (fx "salt"), så udelad "mængde" og "enhed".
- Giv hver ingrediens en "kategori". Brug præcis en af disse: §KAT§. Passer ingen, så skriv "Andet".

Svar KUN med JSON i en kodeblok, uden anden tekst, i præcis dette format:
{
  "navn": "Spaghetti med kødboller",
  "sværhed": 3,
  "tid": 45,
  "portioner": 4,
  "kategori": "Aftensmad",
  "ingredienser": [
    { "overskrift": "Kødboller", "varer": [
      { "mængde": 500, "enhed": "g", "navn": "hakket svinekød", "kategori": "Kød" },
      { "mængde": 1, "enhed": "stk", "navn": "løg", "kategori": "Grøntsager" } ] },
    { "overskrift": "Sovs", "varer": [
      { "mængde": 2.5, "enhed": "dl", "navn": "fløde", "kategori": "Mejeri og æg" },
      { "navn": "salt", "kategori": "Krydderier" } ] }
  ],
  "trin": [
    { "tekst": "Lav kødbollerne.", "deltrin": ["Skræl og hak løget.", "Bland kød, løg og æg i en skål."] },
    { "tekst": "Steg kødbollerne ved varme 6 i 10 minutter.", "deltrin": [] },
    "Kog spaghettien efter anvisningen på posen."
  ]
}
"sværhed" er et tal fra 1 til 5. "tid" er minutter i alt. Et trin uden deltrin kan skrives som ren tekst.

Her er opskriften:
`;
const CLAUDE_FOERSTE = CLAUDE_BESKED.slice(0, 30); // bruges til at se, om udklipsholderen allerede indeholder beskeden
let claudeBesked = '';
const FALDBACK_KAT = 'Grøntsager, Frugt, Kød, Fisk og skaldyr, Mejeri og æg, Bønner og linser, Pasta, ris og korn, Krydderier, Konserves';
const FLERE_LINKS = `

Der er flere links nedenfor. Lav én opskrift for hvert link. Svar med en liste i stedet: [ { …opskrift 1… }, { …opskrift 2… } ], stadig kun i én kodeblok.`;
const antalLinks = t => (String(t).match(/https?:\/\/\S+/g) || []).length;
const lavBesked = () => CLAUDE_BESKED.replace('§KAT§', Katalog.kategorier().join(', ') || FALDBACK_KAT);
function importSide() {
  claudeBesked = lavBesked();
  Katalog.hent().catch(() => {}); // kategorierne kommer med i beskeden
  app.innerHTML = `<a class="tilbage" href="#/opskrifter">‹ Opskrifter</a><h1>Tilføj med Claude</h1>
    <ol class="trin vejledning">
      <li>Skriv din opskrift her, eller sæt ét eller flere links ind (ét pr. linje). Står der intet, bruger jeg det, du har kopieret. Tryk så på knappen. Din tekst bliver sat sammen med beskeden til Claude.
        <textarea id="egen" rows="5" placeholder="Din opskrift eller links" aria-label="Din opskrift"></textarea>
        <button class="knap primaer stor" data-h="kopierBesked">${ik('gnist')} Kopiér besked</button>
        <p class="lille" id="kopinote" role="status"></p></li>
      <li>Åbn Claude, og sæt beskeden ind, hvis feltet er tomt. Har du et billede, så sæt det på hos Claude.
        <a class="knap stor" id="aabnClaude" href="https://claude.ai/new" target="_blank" rel="noopener">Åbn Claude ›</a></li>
      <li>Kopiér Claudes svar, og sæt det ind her:
        <textarea id="claudesvar" rows="7" placeholder='{ "navn": "…" }' aria-label="Claudes svar"></textarea></li>
    </ol>
    <div id="formfejl"></div>
    <button class="knap primaer stor" data-h="gemImport">Gem opskriften</button>`;
  Hjaelper.side('Her kan Claude skrive en opskrift om for dig. Kopiér først din opskrift, eller flere links. Tryk så på den første knap, åbn Claude, og sæt beskeden ind. Sæt til sidst Claudes svar ind i feltet her.');
}
// Læser Claudes svar. Giver { data } eller { fejl } med en besked på dansk.
const tekstAf = x => typeof x === 'string' ? x : (x && (x.tekst ?? x.trin ?? x.beskrivelse)) || '';
const enLinje = t => String(t).replace(/\s*\n\s*/g, ' ').trim();
function laesImport(tekst) {
  const s = String(tekst).replace(/[“”]/g, '"');
  if (!s.trim()) return { fejl: 'Feltet er tomt. Sæt Claudes svar ind først.' };
  const a1 = s.indexOf('['), a2 = s.indexOf('{');
  if (a1 !== -1 && (a2 === -1 || a1 < a2)) { // en liste med flere opskrifter
    const b = s.lastIndexOf(']');
    let l;
    try { l = JSON.parse(s.slice(a1, b + 1)); } catch (e) { return { fejl: 'Svaret kan ikke læses. Der mangler nok noget af teksten. Kopiér hele Claudes svar, og prøv igen.' }; }
    if (!Array.isArray(l) || !l.length) return { fejl: 'Listen er tom. Kopiér hele Claudes svar, og prøv igen.' };
    const liste = [];
    for (let i = 0; i < l.length; i++) {
      const r = laesEn(l[i]);
      if (r.fejl) return { fejl: `Opskrift ${i + 1}: ${r.fejl}` };
      liste.push(r);
    }
    return { liste };
  }
  const a = a2, b = s.lastIndexOf('}');
  if (a === -1 || b <= a) return { fejl: 'Det ligner ikke Claudes svar. Det skal begynde med { og slutte med }. Kopiér hele svaret, og prøv igen.' };
  let j;
  try { j = JSON.parse(s.slice(a, b + 1)); }
  catch (e) { return { fejl: 'Svaret kan ikke læses. Der mangler nok noget af teksten. Kopiér hele Claudes svar, og prøv igen.' }; }
  return laesEn(j);
}
function laesEn(j) {
  if (!j || typeof j !== 'object') return { fejl: 'Svaret har ikke det rigtige format.' };
  const mangler = [];
  const navn = typeof j.navn === 'string' ? j.navn.trim() : '';
  if (!navn) mangler.push('navn');
  // Ingredienser: enten en flad liste eller grupper med overskrift og varer. Gemmes som liste med { g: overskrift } imellem.
  const ing = [], kat = {}; // kat: ingrediens -> kategori fra Claude
  const vare = v => { const i = normIng(v); if (!i) return null; const k = v && typeof v === 'object' ? (v.kategori ?? v.kat) : null; if (k) kat[Katalog.rens(i.n)] = String(k).trim(); return i; };
  for (const x of Array.isArray(j.ingredienser) ? j.ingredienser : []) {
    const varer = x && (Array.isArray(x.varer) ? x.varer : Array.isArray(x.ingredienser) ? x.ingredienser : null);
    const over = x && typeof x === 'object' ? String(x.overskrift ?? x.gruppe ?? '').trim() : '';
    if (varer) {
      if (over) ing.push({ g: over });
      ing.push(...varer.map(vare).filter(Boolean));
    } else if (over && !(x.navn || x.n || x.name)) ing.push({ g: over });
    else { const i = vare(x); if (i) ing.push(i); }
  }
  if (!ing.some(x => !('g' in x))) mangler.push('ingredienser');
  const trin = [];
  for (const x of Array.isArray(j.trin) ? j.trin : []) {
    const t = enLinje(tekstAf(x));
    const del = (x && Array.isArray(x.deltrin ?? x.delt) ? (x.deltrin ?? x.delt) : []).map(d => enLinje(tekstAf(d))).filter(Boolean);
    if (t) trin.push({ t, del }); else del.forEach(d => trin.push({ t: d, del: [] }));
  }
  if (!trin.length) mangler.push('trin');
  if (mangler.length) return { fejl: `Svaret mangler: ${mangler.join(', ')}. Bed Claude om at svare igen i det rigtige format.` };
  const helt = (v, min, max) => { const n = Math.round(tal(v)); return tal(v) != null && n >= min && n <= max ? n : null; };
  return { data: {
    titel: navn, kategori: typeof j.kategori === 'string' && j.kategori.trim() ? j.kategori.trim() : null,
    svaerhed: helt(j['sværhed'] ?? j.svaerhed, 1, 5), tid_minutter: helt(j.tid, 0, 6000), portioner: helt(j.portioner, 1, 100),
    ingredienser: ing, fremgangsmaade: trinTilTekst(trin)
  }, kat };
}
async function kopier(tekst) {
  try { await navigator.clipboard.writeText(tekst); return true; }
  catch (e) {
    const t = document.createElement('textarea');
    t.value = tekst; t.style.cssText = 'position:fixed;opacity:0'; document.body.append(t); t.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { /* ingen adgang */ }
    t.remove(); return ok;
  }
}
// Det, der ligger i udklipsholderen lige nu. Tom tekst, hvis der intet er, eller hvis browseren ikke må læse den.
async function laesUdklip() {
  try { return String(await navigator.clipboard.readText()).trim(); } catch (e) { return null; }
}

// ---------- Mere: backup, indstillinger ----------
function mereSide() {
  app.innerHTML = `<a class="tilbage" href="#/">‹ Forside</a><h1>Mere</h1>
    <h2>Indstillinger</h2>
    <label class="skift"><input type="checkbox" id="vishj" ${Hjaelper.skjult() ? '' : 'checked'}> <span>Vis hjælperen</span></label>
    <label class="skift"><input type="checkbox" id="lydtil" ${Lyd.til() ? 'checked' : ''}> <span>Lyde</span></label>
    <label class="skift"><input type="checkbox" id="tilpastil" ${Tilpas.til() ? 'checked' : ''}> <span>Tilpas siden</span></label>
    <p class="lille">Slå til, og tryk så på en knap eller overskrift for at ændre teksten og skriftstørrelsen. Hold fingeren på et felt og træk, for at flytte det. Ændringen gælder alle steder.</p>
    <button class="knap fare" id="tilpasnul">Nulstil alle tekster</button>
    <h2>Sikkerhedskopi</h2>
    <p class="lille">Hent alt indhold som en fil. Gem den et sikkert sted.</p>
    <button class="knap" data-h="eksport">${ik('hent')} Hent sikkerhedskopi</button>
    <h2>Læg appen på hjemmeskærmen</h2>
    <p class="lille">På iPhone og iPad: Tryk på Del-knappen i Safari, og vælg «Føj til hjemmeskærm».</p>`;
  $('#vishj').addEventListener('change', e => Hjaelper.vis(e.target.checked));
  $('#tilpastil').addEventListener('change', e => Tilpas.saet(e.target.checked));
  $('#tilpasnul').addEventListener('click', async () => { if (await bekraeft('Vil du sætte alle tekster og størrelser tilbage?', 'Nulstil')) { Tilpas.nulstil(); toast('Teksterne er nulstillet'); } });
  $('#lydtil').addEventListener('change', e => { Lyd.saet(e.target.checked); Lyd.spil('klik'); });
  Hjaelper.side('Her kan du slå mig og lydene til og fra, og hente en sikkerhedskopi.');
}

// ---------- Klik ----------
// Den tekst, man sidst har markeret (bruges, når «Tilføj tip» åbnes)
let sidsteValg = '';
document.addEventListener('selectionchange', () => { const t = String(window.getSelection ? window.getSelection() : '').trim(); if (t) sidsteValg = t; });
document.addEventListener('select', e => {
  const t = e.target;
  if (typeof t.selectionStart === 'number' && t.selectionEnd > t.selectionStart) sidsteValg = t.value.slice(t.selectionStart, t.selectionEnd).trim();
}, true);
const H = {
  igen: () => route(),
  sorterAndet: () => Katalog.sorterAndet(() => Hjemme.vis($('#hj-boks'), tegnForslag)),
  maksNed: () => saetMaks(maksMangler() - 1),
  maksOp: () => saetMaks(maksMangler() + 1),
  async slet(el) {
    const [type, id] = el.dataset.v.split(':');
    if (!await bekraeft(TYPER[type].bekraeft)) return;
    await api(`${type}?id=eq.${enc(id)}`, { method: 'DELETE' });
    toast(TYPER[type].slettet);
    if (location.hash === '#/' + type) route(); else location.hash = '#/' + type;
  },
  kat(el) {
    L.kat = el.dataset.v;
    document.querySelectorAll('.filter .chip').forEach(c => c.classList.toggle('valgt', c === el));
    tegnListe();
  },
  async favorit() {
    const q = `favoritter?opskrift_id=eq.${enc(S.r.id)}`;
    if (S.fav) await api(q, { method: 'DELETE' });
    else await api('favoritter?on_conflict=opskrift_id,bruger_id', { method: 'POST', flet: true, body: { opskrift_id: S.r.id, bruger_id: FAELLES } });
    S.fav = !S.fav;
    const k = $('#favknap'); k.innerHTML = ik(S.fav ? 'stjerne' : 'stjerne0'); k.setAttribute('aria-pressed', S.fav);
    if (S.fav) { k.classList.add('hop'); setTimeout(() => k.classList.remove('hop'), 500); Hjaelper.glad('Den er nu en favorit. Du finder den på forsiden.'); }
    else toast('Ikke længere favorit');
  },
  port(el) {
    S.port = Math.max(1, Math.min(50, S.port + Number(el.dataset.v)));
    portValg[S.r.id] = S.port; tegnIng();
  },
  async stjerne(el) {
    const antal = Number(el.dataset.v);
    await api('stjerner?on_conflict=opskrift_id,bruger_id', { method: 'POST', flet: true, body: { opskrift_id: S.r.id, bruger_id: ENHED, antal } });
    const foer = S.stj.find(s => s.bruger_id === ENHED);
    if (foer) foer.antal = antal; else { S.stj.push({ bruger_id: ENHED, antal }); }
    tegnStjerner(); toast('Tak! Dine stjerner er gemt.'); Hjaelper.glad();
  },
  lav() { location.hash = `#/opskrifter/${S.r.id}/lav`; },
  lavTrin(el) {
    const foer = K.i;
    K.i = Math.max(-1, Math.min(K.trin.length, K.i + Number(el.dataset.v)));
    if (K.i === foer) return;
    Hjaelper.stille();
    app.dataset.retning = K.i > foer ? 'frem' : 'tilbage';
    tegnLav();
    $('.lav-midte').classList.add('trinind');
  },
  ur(el) {
    ure = ure.filter(u => u.navn !== el.dataset.navn);
    startUr(el.dataset.navn, Number(el.dataset.v));
    el.innerHTML = ik('ur') + ' Start uret igen: ' + visVarighed(Number(el.dataset.v)); // siden bliver stående, hvor den er
  },
  stopUr(el) { ure = ure.filter(u => u.id !== Number(el.dataset.v)); tegnUre(); },
  begreb(el) {
    const [type, id] = el.dataset.v.split(':'), b = kendteBegreber.find(x => x.type === type && x.id === id);
    const aaben = $('.forklaring');
    lukForklaring();
    if (!b || (aaben && aaben.dataset.for === el.dataset.v && aaben.previousElementSibling === el)) return;
    const f = document.createElement('span');
    f.className = 'forklaring'; f.dataset.for = el.dataset.v; f.setAttribute('role', 'note');
    f.innerHTML = `<b>${esc(b.navn)}</b> <i>${type === 'tips' ? 'Tip' : 'Metode'}</i><span>${esc(b.tekst || 'Der er ingen forklaring endnu.')}</span>
      ${type === 'metoder' ? `<a href="#/metoder/${id}">Se hele metoden</a>` : ''}`;
    el.after(f);
    Hjaelper.sig(`${b.navn}: ${b.tekst || 'Der er ingen forklaring endnu.'}`, { peg: el, nu: true });
  },
  nytBegreb() {
    const valgt = (String(window.getSelection ? window.getSelection() : '').trim() || sidsteValg).slice(0, 60);
    sidsteValg = '';
    const paaOpskrift = !!$('#trin'); // på opskriftssiden opdateres teksten med det samme
    const d = ark(`<h2>Tilføj tip</h2>
      <form id="begrebform" novalidate>
        <label for="b_navn">Ordet fra opskriften</label><small>Skriv det præcis, som det står, fx «koge ris».</small>
        <input id="b_navn" type="text" value="${esc(valgt)}" autocomplete="off">
        <div class="valgrakke"><label><input type="radio" name="b_type" value="tips" checked> Tip</label><label><input type="radio" name="b_type" value="metoder"> Metode</label></div>
        <label for="b_tekst">Forklaring</label><textarea id="b_tekst" rows="4"></textarea>
        <div id="arkfejl"></div>
        <div class="rakke"><button class="knap" type="button" data-h="lukArk">Fortryd</button><button class="knap primaer" type="submit">Gem</button></div>
      </form>`);
    const form = $('#begrebform', d);
    $('.ark-bag', d).addEventListener('click', lukArk);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const navn = $('#b_navn').value.trim(), tekst = $('#b_tekst').value.trim(), type = form.elements.b_type.value;
      if (!navn || !tekst) { $('#arkfejl').innerHTML = '<div class="fejlboks">Skriv både ordet og en forklaring.</div>'; return; }
      try {
        const [ny] = await api(type, { method: 'POST', body: type === 'tips' ? { titel: navn, tekst } : { titel: navn, beskrivelse: tekst } });
        if (!paaOpskrift) { lukArk(); toast('Gemt'); Hjaelper.glad(`Gemt! Nu kan man trykke på «${navn}» i opskrifter, hvor ordet står.`); return; }
        (type === 'tips' ? S.tips : S.metoder).push(ny);
        kendteBegreber = begreberAf(S.tips, S.metoder);
        lukArk(); tegnTrin();
        const findes = trinAf(S.r).some(t => [t.t, ...t.del].some(x => medBegreber(x, kendteBegreber.filter(b => b.id === ny.id)).includes('data-h')));
        Hjaelper.glad(findes ? `Gemt! Nu kan man trykke på «${navn}» i opskriften.` : `Gemt! Ordet «${navn}» står ikke i trinene, så der er ikke noget link endnu.`);
        toast('Gemt');
      } catch (err) { console.error(err); $('#arkfejl').innerHTML = '<div class="fejlboks">Det blev ikke gemt. Tjek internettet, og prøv igen.</div>'; }
    });
    $('#b_navn').focus();
  },
  lukArk,
  rkNy(el) {
    const rk = el.closest('.rk'), ed = rk.closest('.ed');
    if (ed.dataset.ed === 'ing') return rkIndsaet(ed, rk, { art: 'ing' });
    if (el.dataset.v === 'del') rkIndsaet(ed, rkGruppeSlut(rk), { niv: 1 });
    else rkIndsaet(ed, rkGruppeSlut(rk), { niv: 0 });
  },
  rkSkift(el) { // en ingrediens med tekst får en overskrift over sig. Ellers skifter linjen mellem ingrediens og overskrift.
    const rk = el.closest('.rk'), ed = rk.closest('.ed'), over = rk.dataset.art === 'over', tekst = rkFelt(rk).value;
    if (!over && tekst.trim()) return rkIndsaet(ed, rk, { art: 'over' }, true, true);
    const ny = rkIndsaet(ed, rk, { art: over ? 'ing' : 'over', tekst }, false);
    rk.remove(); rkVokser(rkFelt(ny)); rkFokus(ny);
  },
  async rkFjern(el) {
    const rk = el.closest('.rk'), ed = rk.closest('.ed');
    const grp = [rk];
    if (rk.dataset.niv === '0') for (let x = rk.nextElementSibling; x && x.dataset.niv === '1'; x = x.nextElementSibling) grp.push(x);
    if (grp.slice(1).some(x => rkFelt(x).value.trim()) && !await bekraeft('Vil du fjerne trinnet og dets deltrin?', 'Fjern')) return;
    const naboe = grp[grp.length - 1].nextElementSibling || rk.previousElementSibling;
    grp.forEach(x => x.remove());
    if (!ed.querySelector('.rk')) rkIndsaet(ed, null, ed.dataset.ed === 'ing' ? { art: 'ing' } : { niv: 0 }, false);
    else if (naboe) rkFokus(naboe);
  },
  laerredRediger(el) { const ja = el.dataset.v === '1'; Laerred.saetRediger(ja); tegnLaerredKnapper(ja); if (ja) Hjaelper.sig('Træk i en ting for at flytte den. Tryk på den for at gøre den større eller dreje den.', { nu: true }); },
  vaelgBillede() { $('#billedfil').click(); },
  async figur(el) { await Laerred.ny('figur', 'ikon:' + el.dataset.v); },
  async fjernValgt() { if (await Laerred.fjernValgt()) toast('Fjernet'); },
  print() { window.print(); },
  async kopierBesked() {
    await Katalog.hent().catch(() => {});
    const grund = lavBesked(), egen = ($('#egen') || {}).value ? $('#egen').value.trim() : '';
    const udklip = egen ? '' : await laesUdklip(); // null = browseren måtte ikke læse udklipsholderen
    // Ligger beskeden selv i udklipsholderen (man trykker to gange), så beholder vi den, vi allerede har bygget.
    let status;
    if (egen) { claudeBesked = grund.replace('\n\nHer er opskriften:\n', (antalLinks(egen) > 1 ? FLERE_LINKS : '') + '\n\nHer er opskriften:\n') + egen + '\n'; status = 'egen'; }
    else if (udklip && udklip.startsWith(CLAUDE_FOERSTE)) status = 'igen';
    else if (udklip) { claudeBesked = grund + udklip + '\n'; status = 'med'; }
    else { claudeBesked = grund; status = udklip === null ? 'naegtet' : 'tom'; }
    const ok = await kopier(claudeBesked);
    // Hos Claude kan feltet udfyldes via adressen. Er beskeden for lang til det, åbner Claude tomt, og beskeden ligger i udklipsholderen.
    const kodet = encodeURIComponent(claudeBesked);
    $('#aabnClaude').href = 'https://claude.ai/new' + (kodet.length < 7000 ? '?q=' + kodet : '');
    $('#kopinote').textContent = !ok ? 'Beskeden kunne ikke kopieres. Prøv igen.' : {
      egen: 'Kopieret. Det, du skrev, er sat med i beskeden.',
      med: 'Kopieret. Din opskrift er sat med i beskeden.',
      igen: 'Kopieret igen.',
      tom: 'Kopieret. Der lå ingen tekst i udklipsholderen, så beskeden er uden opskrift. Sæt opskriften ind hos Claude.',
      naegtet: 'Kopieret. Appen måtte ikke læse din udklipsholder, så beskeden er uden opskrift. Sæt opskriften ind hos Claude.'
    }[status];
    toast(ok ? 'Beskeden er kopieret' : 'Beskeden kunne ikke kopieres');
  },
  async gemImport(el) {
    const svar = laesImport($('#claudesvar').value);
    if (svar.fejl) { $('#formfejl').innerHTML = `<div class="fejlboks">${esc(svar.fejl)}</div>`; return; }
    el.disabled = true;
    try {
      const alle = svar.liste || [svar];
      let sidste;
      for (const r of alle) {
        [sidste] = await api('opskrifter', { method: 'POST', body: r.data });
        try { await Katalog.laeg(ingAf(r.data).map(i => i.n), {}, r.kat); } catch (e) { console.error(e); } // ingredienserne med Claudes kategorier
      }
      const flere = alle.length > 1;
      toast(flere ? `${alle.length} opskrifter er gemt` : 'Opskriften er gemt'); Hjaelper.glad(flere ? 'Opskrifterne er gemt!' : 'Opskriften er gemt!');
      location.hash = flere ? '#/opskrifter' : '#/opskrifter/' + sidste.id;
    } catch (err) { el.disabled = false; throw err; }
  },
  async eksport() {
    const tabeller = ['opskrifter', 'tips', 'metoder', 'favoritter', 'stjerner', 'laerred'], data = { hentet: new Date().toISOString() };
    for (const t of tabeller) data[t] = await api(`${t}?select=*`);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `kogebog-${data.hentet.slice(0, 10)}.json`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast('Sikkerhedskopien er hentet');
  }
};
document.addEventListener('change', e => { if (e.target.id === 'maks') saetMaks(e.target.value); });
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-h]');
  if (!el) { if (!e.target.closest('.forklaring')) lukForklaring(); return; }
  const f = H[el.dataset.h];
  if (!f) return;
  try { await f(el, e); }
  catch (err) { console.error(err); toast('Det virkede ikke. Tjek internettet, og prøv igen.'); }
});

// Notesbogens linjer: et net à 32 px, der starter, hvor indholdet i <main> starter. Så står alle rækker, felter og knapper på linjerne.
let rasterTimer;
function rasterIgen() {
  cancelAnimationFrame(rasterTimer);
  rasterTimer = requestAnimationFrame(() => {
    const main = document.querySelector('main');
    app.querySelectorAll('.laerred-ramme').forEach(el => { // rammen runder op til hele rækker, så resten af siden bliver på linjerne
      el.style.height = '';
      el.style.height = Math.ceil(el.getBoundingClientRect().height / 32 - 0.02) * 32 + 'px';
    });
    const y = main.getBoundingClientRect().top + scrollY + parseFloat(getComputedStyle(main).paddingTop);
    document.documentElement.style.setProperty('--raster', (((Math.round(y) % 32) + 32) % 32) + 'px');
  });
}
new MutationObserver(rasterIgen).observe(app, { childList: true, subtree: true });
addEventListener('resize', rasterIgen);
if (window.ResizeObserver) { const ro = new ResizeObserver(rasterIgen); ['main', '.top', '#ure'].forEach(q => ro.observe(document.querySelector(q))); }
if (document.fonts) document.fonts.ready.then(rasterIgen);
// Tryk-animation: glansen starter, hvor fingeren rammer
document.addEventListener('pointerdown', e => {
  const el = e.target.closest('.knap, .tilbage, .rund, .rk-knap, .kort, .fane');
  if (!el || el.disabled) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--rx', (e.clientX - r.left) + 'px'); el.style.setProperty('--ry', (e.clientY - r.top) + 'px');
  el.classList.remove('tryk'); void el.offsetWidth; el.classList.add('tryk');
  el.addEventListener('animationend', ev => { if (ev.animationName === 'glans') el.classList.remove('tryk'); }, { once: true });
}, { passive: true });
document.addEventListener('DOMContentLoaded', () => { Hjaelper.start(); route(); });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
