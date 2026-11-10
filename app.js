const API = SUPABASE_URL + '/rest/v1/';
const $ = (s, rod = document) => rod.querySelector(s);
const app = $('#app');
let visning = 0; // tæller sider, så et langsomt svar ikke overskriver en nyere side

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const enc = encodeURIComponent;

// Små ting, der kun gemmes på denne enhed (hjælper til/fra, mærker, dine egne stjerner)
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
  if (method === 'POST' || method === 'PATCH') headers.Prefer = 'return=representation' + (flet ? ',resolution=merge-duplicates' : '');
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
      { n: 'ingredienser', l: 'Ingredienser', t: 'ingredienser', hint: 'Én på hver linje. Skriv mængden først, fx «2 dl mælk».' },
      { n: 'fremgangsmaade', l: 'Trin', t: 'textarea', rows: 8, hint: 'Ét trin på hver linje. Skriv tiden med, fx «Kog i 10 minutter», så kan man starte et ur.' }
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
const stjernetekst = n => '★'.repeat(n) + '☆'.repeat(5 - n);
function chips(r) {
  return [
    r.kategori && esc(r.kategori),
    r.svaerhed && `<span aria-label="Sværhed ${r.svaerhed} af 5">Sværhed ${stjernetekst(r.svaerhed)}</span>`,
    r.tid_minutter && `⏱ ${r.tid_minutter} min`
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
const ingAf = r => (Array.isArray(r.ingredienser) ? r.ingredienser : []).map(normIng).filter(Boolean);
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
  tael('ure'); Lyd.spil('klik'); tegnUre();
  Hjaelper.sig(`Uret er startet: ${visVarighed(sek)}. Jeg siger til, når tiden er gået.`, { nu: true });
}
function tegnUre() {
  $('#ure').innerHTML = ure.map(u => `<div class="ur${u.faerdig ? ' faerdig' : ''}" data-ur="${u.id}">
    <span>⏱ <b>${u.faerdig ? 'Færdig!' : visTid((u.slut - Date.now()) / 1000)}</b> ${esc(u.navn)}</span>
    <button type="button" data-h="stopUr" data-v="${u.id}" aria-label="Stop uret">×</button></div>`).join('');
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

// ---------- Mærker (gemmes på enheden) ----------
const MAERKER = [
  { id: 'foerste', ikon: '🍽️', navn: 'Første ret', tekst: 'Du har lavet din første ret.', test: s => s.lavet >= 1 },
  { id: 'fem', ikon: '🏅', navn: 'Køkkenhelt', tekst: 'Du har lavet 5 retter.', test: s => s.lavet >= 5 },
  { id: 'bager', ikon: '🥖', navn: 'Bager', tekst: 'Du har bagt for første gang.', test: s => s.bagt >= 1 },
  { id: 'forfatter', ikon: '✏️', navn: 'Forfatter', tekst: 'Du har skrevet din første opskrift.', test: s => s.skrevet >= 1 },
  { id: 'ur', ikon: '⏱️', navn: 'Tidtager', tekst: 'Du har brugt et ur.', test: s => s.ure >= 1 },
  { id: 'dommer', ikon: '⭐', navn: 'Smagsdommer', tekst: 'Du har givet en ret stjerner.', test: s => s.vurderet >= 1 }
];
function tael(noegle) {
  const s = lager.hent('stat', {}), har = lager.hent('maerker', []);
  s[noegle] = (s[noegle] || 0) + 1; lager.gem('stat', s);
  for (const m of MAERKER) if (!har.includes(m.id) && m.test(s)) {
    har.push(m.id);
    toast(`Nyt mærke: ${m.ikon} ${m.navn}`);
    setTimeout(() => Hjaelper.sig(`Du har fået et mærke: ${m.navn}! ${m.tekst}`, { glad: true }), 400);
  }
  lager.gem('maerker', har);
}

// ---------- Router ----------
async function route() {
  const id = ++visning;
  lukArk(); lukForklaring(); slipSkaerm();
  const dele = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent), [a, b, c] = dele;
  app.dataset.retning = dele.length > dybde ? 'frem' : dele.length < dybde ? 'tilbage' : 'samme';
  dybde = dele.length;
  if (!foerste && app.firstChild) {
    app.classList.remove('sideind'); app.classList.add('sideud');
    await new Promise(r => setTimeout(r, 120));
    if (id !== visning) return;
  }
  foerste = false; indKlar = true;
  window.scrollTo(0, 0);
  document.body.dataset.side = c === 'lav' ? 'lav' : (a || 'forside');
  try {
    if (a === 'indkob') return await indkobSide();
    if (a === 'forslag') return await forslagSide();
    if (a === 'import') return importSide();
    if (a === 'mere') return mereSide();
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
      <a class="fane f1" href="#/opskrifter"><span aria-hidden="true">🍲</span>Opskrifter</a>
      <a class="fane f2" href="#/metoder"><span aria-hidden="true">🥄</span>Metode</a>
      <a class="fane f3" href="#/tips"><span aria-hidden="true">💡</span>Tips</a>
    </nav>
    <h2>Favoritter</h2>
    <div id="favoritter"><p class="lille">Henter…</p></div>
    <nav class="genveje">
      <a class="knap" href="#/forslag">🧺 Hvad kan jeg lave?</a>
      <a class="knap" href="#/indkob">🛒 Indkøbsliste</a>
    </nav>`;
  Hjaelper.side('Her er forsiden. Tryk på Opskrifter for at finde en ret. Under Metode og Tips kan du lære, hvordan man gør. Favoritter er dem med stjerne.');
  const [fav, ops] = await Promise.all([api('favoritter?select=opskrift_id'), api('opskrifter?select=id,titel,kategori,svaerhed,tid_minutter&order=titel')]);
  if (id !== visning) return;
  const ids = new Set(fav.map(f => f.opskrift_id)), liste = ops.filter(o => ids.has(o.id));
  $('#favoritter').innerHTML = liste.length ? liste.map(r => opskriftKort(r, true)).join('')
    : '<p class="lille">Ingen favoritter endnu. Tryk på stjernen på en opskrift, så står den her.</p>';
}
const opskriftKort = (r, fav) => `<a class="kort" href="#/opskrifter/${r.id}"><strong>${fav ? '<span class="guld">★</span> ' : ''}${esc(r.titel)}</strong>
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
      ${type === 'opskrifter' ? '<a class="knap" href="#/import">✨ Tilføj med Claude</a>' : ''}
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
  app.innerHTML = `<a class="tilbage skaerm" href="#/opskrifter">‹ Opskrifter</a>
    <div class="titelrakke"><h1>${esc(r.titel)}</h1>
      <button id="favknap" class="favknap skaerm" data-h="favorit" aria-pressed="${S.fav}" aria-label="Favorit">${S.fav ? '★' : '☆'}</button></div>
    ${c.length ? `<p class="chips">${c.map(x => `<span>${x}</span>`).join('')}</p>` : ''}
    ${r.beskrivelse ? `<p class="tekst">${esc(r.beskrivelse)}</p>` : ''}
    <h2>Ingredienser</h2>
    <div class="portioner skaerm"><button class="rund" data-h="port" data-v="-1" aria-label="Færre portioner">−</button>
      <span id="portvis"></span><button class="rund" data-h="port" data-v="1" aria-label="Flere portioner">+</button></div>
    <ul class="ing" id="ing"></ul>
    <h2>Sådan gør du</h2>
    <div id="trin"></div>
    <div class="rakke skaerm">
      <button class="knap primaer stor" data-h="lav">▶ Lav retten trin for trin</button>
      <button class="knap" data-h="nytBegreb">+ Forklar et ord</button>
    </div>
    <h2 class="skaerm">Vores side</h2>
    <p class="lille skaerm">Sæt billeder og figurer på siden, og flyt dem rundt.</p>
    <div class="laerred-ramme skaerm"><div id="laerred" class="laerred"></div></div>
    <div id="laerred-knapper" class="rakke skaerm"></div>
    <input id="billedfil" type="file" accept="image/*" hidden>
    <h2 class="skaerm">Hvordan smagte det?</h2>
    <div id="stjerner" class="skaerm"></div>
    ${egne.length ? `<h2>Tips til retten</h2>${egne.map(t => `<div class="kort">${t.titel ? `<strong>${esc(t.titel)}</strong>` : ''}<p class="tekst">${esc(t.tekst)}</p></div>`).join('')}` : ''}
    ${knapper('opskrifter', r.id, '<button class="knap" data-h="print">Print</button>')}`;
  tegnIng(); tegnTrin(); tegnStjerner(); tegnLaerredKnapper(false);
  $('#billedfil').addEventListener('change', nytBillede);
  const lel = $('#laerred');
  lel.addEventListener('valgt', e => { const k = $('#fjernvalgt'); if (k) k.disabled = !e.detail; });
  Hjaelper.side('Her er opskriften. Tryk på plus og minus for at ændre antal portioner. Blå ord kan du trykke på. Tryk på «Lav retten trin for trin», når du er klar.');
  await Laerred.start(lel, lr, r.id);
}
function tegnIng() {
  const ing = ingAf(S.r), f = S.port / (S.r.portioner || S.port);
  $('#portvis').textContent = S.port + (S.port === 1 ? ' portion' : ' portioner');
  $('#ing').innerHTML = ing.length ? ing.map((i, n) => `<li><span>${esc(visIng(i, f))}</span>
      <button class="rund lille-rund skaerm" data-h="koeb" data-v="${n}" aria-label="Læg ${esc(i.n)} på indkøbslisten">🛒</button></li>`).join('')
    + '<li class="skaerm"><button class="knap" data-h="koebAlle">🛒 Læg alle på indkøbslisten</button></li>'
    : '<li class="lille">Ingen ingredienser endnu. Tryk på «Rediger» for at skrive dem.</li>';
}
function tegnTrin() {
  const trin = linjer(S.r.fremgangsmaade);
  $('#trin').innerHTML = trin.length ? `<ol class="trin">${trin.map(t => `<li>${medBegreber(t, kendteBegreber)}</li>`).join('')}</ol>`
    : '<p class="lille">Der er ingen trin endnu. Tryk på «Rediger» for at skrive dem.</p>';
}
function stjerneHtml(stj) {
  const min = (stj.find(s => s.bruger_id === ENHED) || {}).antal || 0;
  const snit = stj.length ? stj.reduce((a, s) => a + s.antal, 0) / stj.length : 0;
  return `<div class="stjernevalg" role="group" aria-label="Giv stjerner">${[1, 2, 3, 4, 5].map(n =>
    `<button class="${n <= min ? 'til' : ''}" data-h="stjerne" data-v="${n}" aria-label="${n} stjerne${n > 1 ? 'r' : ''}">${n <= min ? '★' : '☆'}</button>`).join('')}</div>
    <p class="lille">${stj.length ? `Snit: ${visTal(snit)} af 5 (${stj.length} ${stj.length === 1 ? 'vurdering' : 'vurderinger'})` : 'Giv stjerner, når du har lavet retten.'}</p>`;
}
function tegnStjerner() { const el = $('#stjerner'); if (el) el.innerHTML = stjerneHtml(S.stj); }
function tegnLaerredKnapper(rediger) {
  $('#laerred-knapper').innerHTML = rediger
    ? `<button class="knap" data-h="vaelgBillede">📷 Billede</button>
       ${Laerred.FIGURER.map(f => `<button class="rund" data-h="figur" data-v="${f}" aria-label="Sæt ${f} på siden">${f}</button>`).join('')}
       <button class="knap fare" id="fjernvalgt" data-h="fjernValgt" disabled>Fjern den valgte</button>
       <button class="knap primaer" data-h="laerredRediger" data-v="0">Færdig</button>`
    : '<button class="knap" data-h="laerredRediger" data-v="1">✏️ Flyt og tilføj</button>';
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
  K = { r, trin: linjer(r.fremgangsmaade), i: -1, port: portValg[rid] || r.portioner || 4, talt: false };
  S = { r, tips, metoder, stj, port: K.port, fav: false };
  holdSkaerm();
  tegnLav();
  Hjaelper.side('Her laver du retten. Der er ét trin ad gangen. Tryk på «Næste», når du er færdig med et trin. Står der en tid, kan du starte et ur.');
}
function tegnLav() {
  const { r, trin, i } = K, n = trin.length;
  lukForklaring();
  let midte, naeste = 'Næste ›';
  if (i === -1) {
    const ing = ingAf(r), f = K.port / (r.portioner || K.port);
    midte = `<h1>Find tingene frem</h1><p class="lille">${K.port} ${K.port === 1 ? 'portion' : 'portioner'}</p>
      <ul class="ing tjek">${ing.map(x => `<li><label><input type="checkbox"> <span>${esc(visIng(x, f))}</span></label></li>`).join('') || '<li class="lille">Der står ingen ingredienser.</li>'}</ul>`;
    naeste = n ? 'Start ›' : 'Færdig';
  } else if (i < n) {
    const sek = tidISek(trin[i]), navn = `${r.titel}, trin ${i + 1}`, igang = ure.some(u => u.navn === navn);
    midte = `<p class="lav-trin">${medBegreber(trin[i], kendteBegreber)}</p>
      ${sek ? `<div class="lav-ur"><button class="knap stor" data-h="ur" data-v="${sek}" data-navn="${esc(navn)}">⏱ ${igang ? 'Start uret igen' : 'Start ur'}: ${visVarighed(sek)}</button>
        <b class="urvis" data-urvis="${esc(navn)}"></b></div>` : ''}`;
    if (i === n - 1) naeste = 'Færdig ✓';
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
    K.talt = true; tael('lavet');
    if (/bag|brød|bolle|kage|kiks|dej/i.test((r.kategori || '') + ' ' + r.titel)) tael('bagt');
    Hjaelper.glad('Flot klaret! Du har lavet hele retten.');
  }
}

// ---------- Formular (opret / rediger) ----------
function felt(f, rad, ekstra) {
  const v = rad[f.n];
  const m = `id="f_${f.n}" name="${f.n}"` + (f.kraevet ? ' required' : '');
  let input;
  if (f.t === 'textarea') input = `<textarea ${m} rows="${f.rows || 4}">${esc(v)}</textarea>`;
  else if (f.t === 'ingredienser') input = `<textarea ${m} rows="6">${esc(ingAf(rad).map(i => visIng(i)).join('\n'))}</textarea>`;
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
    const el = form.elements[f.n], v = el.value.trim();
    if (f.kraevet && !v) { visFejl(`Skriv noget i feltet «${f.l}».`); el.focus(); return null; }
    if (f.t === 'ingredienser') data[f.n] = v.split('\n').map(s => s.trim()).filter(Boolean).map(parseIng);
    else if (f.t === 'number' || f.t === 'valg') {
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
    <h1>${rid ? T.rediger : T.ny}</h1>
    <form id="form" novalidate>
      ${T.felter.map(f => felt(f, rad, ekstra)).join('')}
      <div id="formfejl"></div>
      <button class="knap primaer stor" type="submit">Gem</button>
    </form>`;
  Hjaelper.side(type === 'opskrifter' ? 'Skriv opskriften her. Skriv én ingrediens på hver linje og ét trin på hver linje. Tryk på «Gem», når du er færdig.' : 'Skriv i felterne, og tryk på «Gem». Navnet bliver til et link i opskrifter, hvor ordet står.');
  const form = $('#form');
  const visFejl = tekst => { $('#formfejl').innerHTML = `<div class="fejlboks">${tekst}</div>`; };
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = laesFelter(form, T.felter, visFejl);
    if (!data) return;
    const knap = form.querySelector('button[type=submit]');
    knap.disabled = true; knap.textContent = 'Gemmer…';
    try {
      const res = rid
        ? await api(`${type}?id=eq.${enc(rid)}`, { method: 'PATCH', body: data })
        : await api(type, { method: 'POST', body: data });
      toast('Gemt'); Hjaelper.glad('Gemt!');
      if (!rid && type === 'opskrifter') tael('skrevet');
      location.hash = type === 'tips' ? '#/tips' : `#/${type}/${rid || res[0].id}`;
    } catch (err) {
      console.error(err);
      visFejl('Det blev ikke gemt. Tjek internettet, og tryk på «Gem» igen.');
      knap.disabled = false; knap.textContent = 'Gem';
    }
  });
}

// ---------- Indkøbsliste ----------
async function indkobSide() {
  const id = visning;
  henter();
  const varer = await api('indkob?select=*&order=oprettet');
  if (id !== visning) return;
  app.innerHTML = `<a class="tilbage" href="#/">‹ Forside</a><h1>Indkøbsliste</h1>
    <form id="nyvare" class="linjeform"><input name="tekst" type="text" placeholder="Skriv en vare, fx mælk" aria-label="Ny vare" autocomplete="off">
      <button class="knap primaer" type="submit">Tilføj</button></form>
    <ul class="ing tjek" id="varer">${varer.map(vareHtml).join('')}</ul>
    <p class="tomt" id="ingenvarer" ${varer.length ? 'hidden' : ''}>Listen er tom. Skriv en vare herover, eller tryk på 🛒 i en opskrift.</p>
    <button class="knap fare" data-h="rydKoebt">Fjern dem med flueben</button>`;
  Hjaelper.side('Her er indkøbslisten. Den er fælles for alle. Sæt flueben, når varen ligger i kurven.');
  $('#nyvare').addEventListener('submit', async e => {
    e.preventDefault();
    const felt = e.target.elements.tekst, tekst = felt.value.trim();
    if (!tekst) return felt.focus();
    try {
      const [v] = await api('indkob', { method: 'POST', body: { tekst } });
      $('#varer').insertAdjacentHTML('beforeend', vareHtml(v)); $('#ingenvarer').hidden = true; felt.value = '';
    } catch (err) { console.error(err); toast('Varen blev ikke gemt. Tjek internettet.'); }
  });
}
const vareHtml = v => `<li><label><input type="checkbox" data-vare="${v.id}" ${v.krydset ? 'checked' : ''}> <span>${esc(v.tekst)}</span></label></li>`;
document.addEventListener('change', async e => {
  const el = e.target.closest('[data-vare]');
  if (!el) return;
  try { await api(`indkob?id=eq.${enc(el.dataset.vare)}`, { method: 'PATCH', body: { krydset: el.checked } }); }
  catch (err) { console.error(err); el.checked = !el.checked; toast('Fluebenet blev ikke gemt. Tjek internettet.'); }
});
async function laegPaaListen(tekster) {
  await api('indkob', { method: 'POST', body: tekster.map(tekst => ({ tekst })) });
  toast(tekster.length === 1 ? `«${tekster[0]}» er på indkøbslisten` : `${tekster.length} varer er på indkøbslisten`);
}

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
    <label for="har">Hvad har du hjemme?</label>
    <small>Skriv med komma imellem, fx «æg, mel, mælk». Salt, peber, olie og vand tæller ikke med.</small>
    <textarea id="har" rows="3">${esc(lager.hent('har', ''))}</textarea>
    <button class="knap primaer stor" data-h="forslag">Find retter</button>
    <div id="forslag"></div>`;
  Hjaelper.side('Skriv det, du har hjemme, med komma imellem. Så finder jeg retter, du kan lave, og siger, hvad du kan købe for at lave flere.');
  if (lager.hent('har', '')) tegnForslag();
}
function tegnForslag() {
  const tekst = $('#har').value;
  lager.gem('har', tekst);
  if (!tekst.trim()) { $('#forslag').innerHTML = '<p class="tomt">Skriv mindst én ting i feltet.</p>'; return; }
  const f = beregnForslag(F, tekst);
  $('#forslag').innerHTML = `<h2>Det kan du lave nu</h2>
    ${f.kan.length ? f.kan.map(r => opskriftKort(r)).join('') : '<p class="lille">Ingen retter endnu. Se, hvad du kan købe herunder.</p>'}
    ${f.koeb.length ? `<h2>Køb lidt, og lav mere</h2>${f.koeb.map(k => `<div class="kort koebsforslag"><strong>Køb ${esc(k.koeb.join(' og '))}</strong>
      <span>Så kan du også lave: ${k.retter.map(r => `<a href="#/opskrifter/${r.id}">${esc(r.titel)}</a>`).join(', ')}</span>
      <button class="knap" data-h="koebForslag" data-v="${esc(k.koeb.join('|'))}">🛒 Læg på indkøbslisten</button></div>`).join('')}` : ''}
    ${f.naesten.length ? `<h2>Du mangler lidt</h2>${f.naesten.slice(0, 8).map(x => `<a class="kort" href="#/opskrifter/${x.r.id}"><strong>${esc(x.r.titel)}</strong><span>Mangler: ${esc(x.mangler.join(', '))}</span></a>`).join('')}` : ''}`;
}

// ---------- Tilføj med Claude ----------
const CLAUDE_BESKED = `Omskriv opskriften nederst til min kogebog-app. Den skal kunne laves af en 10-årig.

Regler:
- Skriv på dansk.
- Ét trin pr. handling. Korte sætninger.
- Skriv konkrete værdier: komfurets varme fra 1 til 9, om ovnen skal forvarmes, og hvor lang tid det tager, fx "Kog i 10 minutter".
- Mængder skal være tal, fx 2,5 dl skrives som 2.5.

Svar KUN med JSON i en kodeblok, uden anden tekst, i præcis dette format:
{
  "navn": "Pandekager",
  "sværhed": 2,
  "tid": 30,
  "portioner": 4,
  "kategori": "Dessert",
  "ingredienser": [{ "mængde": 2.5, "enhed": "dl", "navn": "mel" }],
  "trin": ["Pisk mel og mælk sammen.", "Steg ved varme 6 i 1 minut på hver side."]
}
"sværhed" er et tal fra 1 til 5. "tid" er minutter i alt.

Her er opskriften (jeg indsætter et link, en tekst eller et billede):
`;
function importSide() {
  app.innerHTML = `<a class="tilbage" href="#/opskrifter">‹ Opskrifter</a><h1>Tilføj med Claude</h1>
    <ol class="trin vejledning">
      <li>Tryk på knappen. Beskeden bliver kopieret, og Claude åbner.
        <button class="knap primaer stor" data-h="kopierBesked">✨ Kopiér besked og åbn Claude</button></li>
      <li>Sæt beskeden ind hos Claude, og tilføj din opskrift: et link, en tekst eller et billede.</li>
      <li>Kopiér Claudes svar, og sæt det ind her:
        <textarea id="claudesvar" rows="7" placeholder='{ "navn": "…" }' aria-label="Claudes svar"></textarea></li>
    </ol>
    <div id="formfejl"></div>
    <button class="knap primaer stor" data-h="gemImport">Gem opskriften</button>`;
  Hjaelper.side('Her kan Claude skrive en opskrift om for dig. Tryk på den første knap, sæt beskeden ind hos Claude sammen med din opskrift, og sæt svaret ind i feltet her.');
}
// Læser Claudes svar. Giver { data } eller { fejl } med en besked på dansk.
function laesImport(tekst) {
  const s = String(tekst).replace(/[“”]/g, '"'), a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (!s.trim()) return { fejl: 'Feltet er tomt. Sæt Claudes svar ind først.' };
  if (a === -1 || b <= a) return { fejl: 'Det ligner ikke Claudes svar. Det skal begynde med { og slutte med }. Kopiér hele svaret, og prøv igen.' };
  let j;
  try { j = JSON.parse(s.slice(a, b + 1)); }
  catch (e) { return { fejl: 'Svaret kan ikke læses. Der mangler nok noget af teksten. Kopiér hele Claudes svar, og prøv igen.' }; }
  const mangler = [];
  const navn = typeof j.navn === 'string' ? j.navn.trim() : '';
  if (!navn) mangler.push('navn');
  const ing = Array.isArray(j.ingredienser) ? j.ingredienser.map(normIng).filter(Boolean) : [];
  if (!ing.length) mangler.push('ingredienser');
  const trin = Array.isArray(j.trin) ? j.trin.map(t => typeof t === 'string' ? t : (t && (t.tekst || t.trin)) || '').map(t => String(t).replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean) : [];
  if (!trin.length) mangler.push('trin');
  if (mangler.length) return { fejl: `Svaret mangler: ${mangler.join(', ')}. Bed Claude om at svare igen i det rigtige format.` };
  const helt = (v, min, max) => { const n = Math.round(tal(v)); return tal(v) != null && n >= min && n <= max ? n : null; };
  return { data: {
    titel: navn, kategori: typeof j.kategori === 'string' && j.kategori.trim() ? j.kategori.trim() : null,
    svaerhed: helt(j['sværhed'] ?? j.svaerhed, 1, 5), tid_minutter: helt(j.tid, 0, 6000), portioner: helt(j.portioner, 1, 100),
    ingredienser: ing, fremgangsmaade: trin.join('\n')
  } };
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

// ---------- Mere: backup, mærker, indstillinger ----------
function mereSide() {
  const har = lager.hent('maerker', []);
  app.innerHTML = `<a class="tilbage" href="#/">‹ Forside</a><h1>Mere</h1>
    <h2>Dine mærker</h2>
    <div class="maerker">${MAERKER.map(m => `<div class="maerke${har.includes(m.id) ? ' har' : ''}"><span aria-hidden="true">${m.ikon}</span><b>${m.navn}</b><small>${har.includes(m.id) ? m.tekst : 'Ikke fået endnu'}</small></div>`).join('')}</div>
    <h2>Indstillinger</h2>
    <label class="skift"><input type="checkbox" id="vishj" ${Hjaelper.skjult() ? '' : 'checked'}> <span>Vis hjælperen</span></label>
    <label class="skift"><input type="checkbox" id="lydtil" ${Lyd.til() ? 'checked' : ''}> <span>Lyde</span></label>
    <h2>Sikkerhedskopi</h2>
    <p class="lille">Hent alt indhold som en fil. Gem den et sikkert sted.</p>
    <button class="knap" data-h="eksport">⬇ Hent sikkerhedskopi</button>
    <h2>Læg appen på hjemmeskærmen</h2>
    <p class="lille">På iPhone og iPad: Tryk på Del-knappen i Safari, og vælg «Føj til hjemmeskærm».</p>`;
  $('#vishj').addEventListener('change', e => Hjaelper.vis(e.target.checked));
  $('#lydtil').addEventListener('change', e => { Lyd.saet(e.target.checked); Lyd.spil('klik'); });
  Hjaelper.side('Her ser du dine mærker. Du kan også slå mig og lydene til og fra, og hente en sikkerhedskopi.');
}

// ---------- Klik ----------
const H = {
  igen: () => route(),
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
    const k = $('#favknap'); k.textContent = S.fav ? '★' : '☆'; k.setAttribute('aria-pressed', S.fav);
    if (S.fav) { k.classList.add('hop'); setTimeout(() => k.classList.remove('hop'), 500); Hjaelper.glad('Den er nu en favorit. Du finder den på forsiden.'); }
    else toast('Ikke længere favorit');
  },
  port(el) {
    S.port = Math.max(1, Math.min(50, S.port + Number(el.dataset.v)));
    portValg[S.r.id] = S.port; tegnIng();
  },
  async koeb(el) { const i = ingAf(S.r)[el.dataset.v]; await laegPaaListen([visIng(i, S.port / (S.r.portioner || S.port))]); },
  async koebAlle() { const f = S.port / (S.r.portioner || S.port); await laegPaaListen(ingAf(S.r).map(i => visIng(i, f))); },
  async koebForslag(el) { await laegPaaListen(el.dataset.v.split('|')); },
  async rydKoebt() {
    if (!document.querySelector('[data-vare]:checked')) return toast('Ingen varer har flueben.');
    if (!await bekraeft('Vil du fjerne alle varer med flueben?', 'Fjern')) return;
    await api('indkob?krydset=eq.true', { method: 'DELETE' });
    route();
  },
  async stjerne(el) {
    const antal = Number(el.dataset.v);
    await api('stjerner?on_conflict=opskrift_id,bruger_id', { method: 'POST', flet: true, body: { opskrift_id: S.r.id, bruger_id: ENHED, antal } });
    const foer = S.stj.find(s => s.bruger_id === ENHED);
    if (foer) foer.antal = antal; else { S.stj.push({ bruger_id: ENHED, antal }); tael('vurderet'); }
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
    startUr(el.dataset.navn, Number(el.dataset.v)); tegnLav();
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
    const valgt = String(window.getSelection ? window.getSelection() : '').trim().slice(0, 60);
    const d = ark(`<h2>Forklar et ord</h2>
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
        (type === 'tips' ? S.tips : S.metoder).push(ny);
        kendteBegreber = begreberAf(S.tips, S.metoder);
        lukArk(); tegnTrin();
        const findes = linjer(S.r.fremgangsmaade).some(t => medBegreber(t, kendteBegreber.filter(b => b.id === ny.id)).includes('data-h'));
        Hjaelper.glad(findes ? `Gemt! Nu kan man trykke på «${navn}» i opskriften.` : `Gemt! Ordet «${navn}» står ikke i trinene, så der er ikke noget link endnu.`);
        toast('Gemt');
      } catch (err) { console.error(err); $('#arkfejl').innerHTML = '<div class="fejlboks">Det blev ikke gemt. Tjek internettet, og prøv igen.</div>'; }
    });
    $('#b_navn').focus();
  },
  lukArk,
  laerredRediger(el) { const ja = el.dataset.v === '1'; Laerred.saetRediger(ja); tegnLaerredKnapper(ja); if (ja) Hjaelper.sig('Træk i en ting for at flytte den. Tryk på den for at gøre den større eller dreje den.', { nu: true }); },
  vaelgBillede() { $('#billedfil').click(); },
  async figur(el) { await Laerred.ny('figur', el.dataset.v); },
  async fjernValgt() { if (await Laerred.fjernValgt()) toast('Fjernet'); },
  print() { window.print(); },
  forslag: tegnForslag,
  async kopierBesked() {
    const kopi = kopier(CLAUDE_BESKED); // start kopieringen, før Claude åbner og tager fokus
    window.open('https://claude.ai/new', '_blank', 'noopener');
    const ok = await kopi;
    toast(ok ? 'Beskeden er kopieret. Sæt den ind hos Claude.' : 'Beskeden kunne ikke kopieres. Prøv igen.');
  },
  async gemImport(el) {
    const svar = laesImport($('#claudesvar').value);
    if (svar.fejl) { $('#formfejl').innerHTML = `<div class="fejlboks">${esc(svar.fejl)}</div>`; return; }
    el.disabled = true;
    try {
      const [ny] = await api('opskrifter', { method: 'POST', body: svar.data });
      toast('Opskriften er gemt'); tael('skrevet'); Hjaelper.glad('Opskriften er gemt!');
      location.hash = '#/opskrifter/' + ny.id;
    } catch (err) { el.disabled = false; throw err; }
  },
  async eksport() {
    const tabeller = ['opskrifter', 'tips', 'metoder', 'favoritter', 'stjerner', 'indkob', 'laerred'], data = { hentet: new Date().toISOString() };
    for (const t of tabeller) data[t] = await api(`${t}?select=*`);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `kogebog-${data.hentet.slice(0, 10)}.json`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast('Sikkerhedskopien er hentet');
  }
};
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-h]');
  if (!el) { if (!e.target.closest('.forklaring')) lukForklaring(); return; }
  const f = H[el.dataset.h];
  if (!f) return;
  try { await f(el, e); }
  catch (err) { console.error(err); toast('Det virkede ikke. Tjek internettet, og prøv igen.'); }
});

document.addEventListener('DOMContentLoaded', () => { Hjaelper.start(); route(); });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
