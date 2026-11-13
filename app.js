const API = SUPABASE_URL + '/rest/v1/';
const $ = (s, rod = document) => rod.querySelector(s);
const app = $('#app');
let visning = 0; // tæller sider, så et langsomt svar ikke overskriver en nyere side

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const enc = encodeURIComponent;
// Gitterets mål står ét sted: --kol og --raekke i style.css. Her og i tilpas.js læses de derfra.
const maal = v => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(v)) || 0, KOL = () => maal('--kol') || 16, RAEKKE = () => maal('--raekke') || 32;

// Små ting, der kun gemmes på denne enhed (hjælper til/fra, dine egne stjerner)
const lager = {
  hent(k, standard) { try { const v = localStorage.getItem('kogebog_' + k); return v == null ? standard : JSON.parse(v); } catch (e) { return standard; } },
  gem(k, v) { try { localStorage.setItem('kogebog_' + k, JSON.stringify(v)); } catch (e) { /* privat tilstand */ } }
};
// Udseende: «auto» følger telefonen, «lys» og «moerk» er dit eget valg
const Tema = (() => {
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const valg = () => { const v = lager.hent('tema', 'auto'); return v === 'lys' || v === 'moerk' ? v : 'auto'; };
  const anvend = () => {
    const v = valg(), moerk = v === 'moerk' || (v === 'auto' && mq.matches);
    document.documentElement.dataset.tema = moerk ? 'moerk' : 'lys';
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = getComputedStyle(document.documentElement).getPropertyValue('--papir').trim();
  };
  mq.addEventListener('change', anvend);
  // Udskrift er altid på lyst papir
  let foer = null;
  addEventListener('beforeprint', () => { foer = document.documentElement.dataset.tema; document.documentElement.dataset.tema = 'lys'; });
  addEventListener('afterprint', () => { if (foer) document.documentElement.dataset.tema = foer; foer = null; });
  return { valg, saet(v) { lager.gem('tema', v); anvend(); }, anvend };
})();
Tema.anvend();
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
const OPSKRIFT_KAT = ['Hovedret', 'Forret', 'Salat', 'Dessert', 'Tilbehør', 'Drikke']; // faste forslag til opskrifters kategori. Man kan altid skrive en ny.
const OPSKRIFT_KOEKKEN = ['Dansk', 'Italiensk', 'Asiatisk', 'Spansk', 'Mexicansk', 'Fransk', 'Indisk', 'Amerikansk', 'Græsk', 'Mellemøstlig']; // faste forslag til køkken. Man kan altid skrive et nyt.
const TYPER = {
  opskrifter: {
    navn: 'Opskrifter', ny: 'Ny opskrift', rediger: 'Rediger opskrift',
    tom: 'Der er ingen opskrifter endnu. Tryk på «Ny opskrift» for at skrive den første.',
    bekraeft: 'Vil du slette opskriften? Den kan ikke hentes tilbage.', slettet: 'Opskriften er slettet',
    felter: [
      { n: 'titel', l: 'Navn', t: 'text', kraevet: true },
      { n: 'beskrivelse', l: 'Kort beskrivelse', t: 'textarea', rows: 2 },
      { n: 'kategori', l: 'Kategori', t: 'kategori', hint: 'Vælg en af forslagene, eller skriv en ny.' },
      { n: 'koekken', l: 'Køkken', t: 'koekken', hint: 'Hvor kommer retten fra? Vælg et af forslagene, eller skriv et nyt.' },
      { n: 'svaerhed', l: 'Sværhed', t: 'valg', valg: [[1, '1 · Meget let'], [2, '2 · Let'], [3, '3 · Middel'], [4, '4 · Svær'], [5, '5 · Meget svær']] },
      { n: 'portioner', l: 'Antal portioner', t: 'number' },
      { n: 'tid_minutter', l: 'Tid i minutter', t: 'number' },
      { n: 'ingredienser', l: 'Ingredienser', t: 'ingredienser', hint: 'Én ingrediens i hvert felt. Skriv mængden først, fx «2 dl mælk». Tryk på «overskrift» for at sætte en overskrift over en ingrediens, fx Sovs eller Kødboller.' },
      { n: 'fremgangsmaade', l: 'Trin', t: 'trin', hint: 'Ét trin i hvert felt. Tryk på «deltrin» for at lave små skridt under et trin. Skriv tiden med, fx «Kog i 10 minutter», så kan man starte et ur.' },
      { n: 'skjul_forslag', l: 'Foreslå ikke denne ret i «Hvad kan jeg lave?»', t: 'tjek', hint: 'Sæt kryds, hvis retten ikke skal dukke op som forslag.' }
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
// Beskeder: står i 4 sekunder (8 med «Fortryd»). En fejl (valg.bliv) står, til man trykker «Luk», handler eller skifter side.
function toast(tekst, valg = {}) {
  const el = $('#toast'), luk = () => el.classList.remove('vis');
  clearTimeout(tt);
  const t = document.createElement('span'); t.className = 'toast-tekst'; t.textContent = tekst;
  el.replaceChildren(t);
  const knap = (navn, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'toast-knap'; b.textContent = navn; b.addEventListener('click', fn); el.append(b); };
  if (valg.fortryd) knap('Fortryd', () => { luk(); valg.fortryd(); });
  if (valg.bliv) knap('Luk', luk);
  el.setAttribute('role', valg.bliv ? 'alert' : 'status');
  el.classList.toggle('fejl', !!valg.bliv);
  el.classList.add('vis');
  if (!valg.bliv) tt = setTimeout(luk, valg.fortryd ? 8000 : 4000);
}
const fejlbesked = tekst => toast(tekst, { bliv: true });
// Kategorien «Andet» i databasen og en ingrediens uden kategori vises begge som «Ikke sorteret»
const IKKE_SORTERET = 'Ikke sorteret';
const katNavn = k => !k || k.navn_norm === 'andet' ? IKKE_SORTERET : k.navn;
window.addEventListener('hashchange', () => { const el = $('#toast'); if (el.classList.contains('fejl')) el.classList.remove('vis'); });
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
    r.koekken && esc(r.koekken),
    r.svaerhed && `<span aria-label="Sværhed ${r.svaerhed} af 5">Sværhed ${stjernetekst(r.svaerhed)}</span>`,
    r.tid_minutter && `${ik('ur')} ${r.tid_minutter} min`
  ].filter(Boolean);
}
const linjer = t => String(t || '').split('\n').map(s => s.trim().replace(/^(\d+[.)]|[-•*])\s+/, '')).filter(Boolean);

// Ark: lille vindue nedefra. Bruges til bekræftelse og til at oprette tip på stedet.
// Med tastatur: fokus flytter ind i vinduet, Tab bliver i det, og når det lukkes, kommer fokus tilbage, hvor det var.
let arkFoer = null, medTastatur = false; // på touch flytter fokus kun, når man bruger tastatur, så skærmtastaturet ikke dukker op af sig selv
addEventListener('keydown', e => { if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') medTastatur = true; }, true);
addEventListener('pointerdown', () => { medTastatur = false; }, true);
function ark(html) {
  const foer = $('#ark') ? arkFoer : document.activeElement;
  lukArk(true);
  const d = document.createElement('div');
  d.id = 'ark';
  d.innerHTML = `<div class="ark-bag"></div><div class="ark-kort" role="dialog" aria-modal="true">${html}</div>`;
  document.body.append(d);
  arkFoer = foer;
  if (medTastatur || !matchMedia('(pointer: coarse)').matches) setTimeout(() => { if (d.isConnected && !d.contains(document.activeElement)) { const f = d.querySelector('.ark-kort input:not([type=hidden]), .ark-kort textarea, .ark-kort select, .ark-kort button, .ark-kort a[href]'); if (f) f.focus({ preventScroll: true }); } }, 60);
  return d;
}
// Vinduet glider ned og toner ud. «straks» fjerner det med det samme, fx når et nyt vindue afløser det.
function lukArk(straks) {
  const a = $('#ark');
  if (!a) return;
  if (straks !== true && a.contains(document.activeElement) && arkFoer && arkFoer.isConnected && arkFoer !== document.body) arkFoer.focus({ preventScroll: true });
  if (straks === true || matchMedia('(prefers-reduced-motion: reduce)').matches) { a.remove(); return; }
  a.removeAttribute('id'); a.classList.add('ark-ud');
  setTimeout(() => a.remove(), 260);
}
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

// ---------- Dubletter: samme opskriftsnavn ----------
const navnNoegle = t => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();
const findNavn = (liste, titel, undtag) => { const n = navnNoegle(titel); return n ? liste.find(o => o.id !== undtag && navnNoegle(o.titel) === n) : null; };
// Spørger, hvad der skal ske med opskrifter, der allerede findes. Svarer 'gem', 'spring' eller null (annuller).
function spoergDublet(dubletter, antal) {
  return new Promise(svar => {
    const en = antal === 1, d0 = dubletter[0];
    const tekst = en ? `«${d0.titel}» findes allerede.` : dubletter.length === 1 ? `«${d0.titel}» findes allerede.` : `${dubletter.length} af opskrifterne findes allerede.`;
    const se = d0.id ? `<a class="knap hel" href="#/opskrifter/${d0.id}" data-svar="se">Se opskriften</a>` : '';
    const d = ark(`<p class="ark-tekst">${esc(tekst)}</p><div class="rakke">${en || dubletter.length === 1 ? se : ''}
      <button class="knap primaer" data-svar="gem">${en ? 'Gem alligevel' : 'Gem alle'}</button>
      ${en ? '' : '<button class="knap" data-svar="spring">Spring over dem</button>'}
      <button class="knap" data-svar="nej">Annuller</button></div>`);
    d.addEventListener('click', e => {
      const b = e.target.closest('[data-svar]');
      if (!b && !e.target.closest('.ark-bag')) return;
      const v = b ? b.dataset.svar : 'nej';
      lukArk(); svar(v === 'gem' || v === 'spring' ? v : null);
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
// Gør et ingrediensnavn simpelt: «finthakket løg» og «løg skåret i tynde skiver» bliver til «løg». Forkortelser skrives ud («hakk» -> «hakket»).
// Bruges kun under «Hvad kan jeg lave?» og i ingrediensdatabasen. Selve opskriften beholder navnene, som de står.
// Rigtige produkter som «hakkede tomater» og «hakket svinekød» beholdes.
const FORKORT = [[/\bfinthakk\b/gi, 'finthakket'], [/\bgrofthakk\b/gi, 'grofthakket'], [/\bhakk\b/gi, 'hakket'], [/\brev\b/gi, 'revet'], [/\bskr\b/gi, 'skrællet']];
const PRODUKT = /^(hakkede|flåede|knuste|pillede|hele|tørrede) tomater\b|^hakket (okse|svine|kalve|lamme|kylling|kalkun|and|blandet )?\s?kød$|^hakket (okse|svine|kalve|lamme|kylling|kalkun)kød$/i;
const TILBEREDT = /\b(finthakket|grofthakket|hakket|hakkede|revet|revne|skåret|skårne|snittet|snittede|pillet|pillede|skrællet|skrællede|presset|pressede|knust|knuste|smuldret|smuldrede|fint|groft)\b/gi;
function simpel(navn) {
  let n = String(navn).trim();
  FORKORT.forEach(([r, t]) => { n = n.replace(r, t); });
  if (PRODUKT.test(n)) return n;
  let s = n.replace(/\([^)]*\)/g, ' ').replace(/,.*$/, ' ').replace(/\b(skåret|skårne|snittet|snittede|i tern|i skiver|i tynde|i strimler|i både|i stykker|i bidder)\b.*$/i, ' ').replace(TILBEREDT, ' ').replace(/\s+/g, ' ').trim();
  return s || n;
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

// ---------- Begreber: ord i en opskrift, der har et tip ----------
function begreberAf(tips) {
  return [
    ...tips.filter(t => t.titel).map(t => ({ type: 'tips', id: t.id, navn: t.titel.trim(), tekst: t.tekst }))
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
const spor = []; // de sider, man har været på, så «Tilbage» kan gå til den forrige
const formSide = h => /\/(rediger|ny)$/.test(h) || h === '#/import';
async function route() {
  const id = ++visning;
  const nuHash = location.hash || '#/';
  if (spor[spor.length - 2] === nuHash) spor.pop(); else if (spor[spor.length - 1] !== nuHash) spor.push(nuHash);
  lukArk(); lukForklaring(); slipSkaerm(); sidsteValg = '';
  Hjaelper.side(null);
  const dele = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent), [a, b, c] = dele;
  app.dataset.retning = dele.length > dybde ? 'frem' : dele.length < dybde ? 'tilbage' : 'samme';
  dybde = dele.length;
  if (a === 'forslag' || a === 'hjemme') opskriftFra = a === 'forslag' && b === 'madplan' ? '#/forslag/madplan' : '#/forslag'; else if (a !== 'opskrifter' || !b) opskriftFra = null;
  if (a !== 'opskrifter') FIL = null; // søgning og filtre huskes kun, mens man er i opskrifterne
  // To ruder (brede skærme, indstilling): kun når en opskrift er valgt. Listen til venstre bliver stående, og kun opskriften til højre skiftes
  const iRuder = ruderAktiv() && a === 'opskrifter' && !!b && b !== 'ny' && !c, iForslag = ruderAktiv() && (a === 'forslag' || a === 'hjemme') && !b, bliv = iRuder && !!app.querySelector('.ruder');
  document.body.classList.toggle('ruder-vist', iRuder || iForslag);
  if (!bliv && !foerste && app.firstChild) {
    app.classList.remove('sideind'); app.classList.add('sideud');
    await new Promise(r => setTimeout(r, 120));
    if (id !== visning) return;
  }
  foerste = false; indKlar = !bliv;
  window.scrollTo(0, 0);
  document.body.dataset.side = c === 'lav' ? 'lav' : (a || 'forside');
  // Navigationen viser, hvor man er
  const sted = a === 'forslag' && b === 'madplan' ? 'madplan' : ({ opskrifter: 'opskrifter', opdater: 'opskrifter', import: 'opskrifter', tips: 'tips', tipsimport: 'tips', forslag: 'forslag', hjemme: 'forslag', mere: 'mere' })[a] || 'forside';
  document.querySelectorAll('#nav a').forEach(l => { if (l.dataset.nav === sted) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current'); });
  try {
    if (a === 'forslag' && b === 'madplan') return await Madplan.side();
    if (a === 'forslag' && b === 'nye') return await Hjemme.gennemgang();
    if (a === 'forslag') return await forslagSide();
    if (a === 'import' && b === 'links') return LinkImport.side();
    if (a === 'import') return importSide();
    if (a === 'opdater' && b) return await ClaudeEkstra.opdaterSide(b);
    if (a === 'tipsimport') return await ClaudeEkstra.tipsSide();
    if (a === 'mere') return mereSide();
    if (a === 'hjemme') return await forslagSide();
    if (!TYPER[a]) { document.body.dataset.side = 'forside'; return await forside(); }
    if (b === 'ny') return await formular(a);
    if (c === 'rediger') return await formular(a, b);
    if (a === 'opskrifter' && b && c === 'lav') return await lavSide(b);
    if (iRuder) return await ruderSide(b);
    if (a === 'opskrifter' && b) return await opskriftSide(b);
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
      <a class="fane f3" href="#/tips"><span aria-hidden="true">${ik('paere')}</span>Tips</a>
    </nav>
    <nav class="genveje">
      <a class="knap" href="#/forslag">${ik('kurv')} Hvad kan jeg lave?</a>
    </nav>
    <h2>Favoritter</h2>
    <div id="favoritter"><p class="lille">Henter…</p></div>`;
  Hjaelper.side([
    { tekst: 'Se her! Tryk på Opskrifter, når du vil finde en ret.', maal: '.fane.f1', bev: 'salto' },
    { tekst: 'Her er Tips. Det er små råd til køkkenet.', maal: '.fane.f3', bev: 'skridt' },
    { tekst: 'Har du varer derhjemme? Tryk her, så finder jeg en ret.', maal: '.genveje .knap', bev: 'dans' },
    { tekst: 'Dine favoritter står her. Tryk på stjernen i en opskrift.', maal: '#app h2', bev: 'rul' }]);;
  tilfoejTilHjem();
  const [fav, ops] = await Promise.all([api('favoritter?select=opskrift_id'), api('opskrifter?select=id,titel,kategori,svaerhed,tid_minutter&order=titel')]);
  if (id !== visning) return;
  const ids = new Set(fav.map(f => f.opskrift_id)), liste = ops.filter(o => ids.has(o.id));
  $('#favoritter').innerHTML = liste.length ? liste.map(r => opskriftKort(r, true)).join('')
    : '';
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

// En tæt række i opskriftslisten: navn og en linje med kategori, køkken og tid. Notesbogens linjer skiller rækkerne.
const opskriftRaekke = (r, fav, valgt) => `<a class="oprk" href="#/opskrifter/${r.id}"${valgt ? ' aria-current="true"' : ''}><strong>${fav ? `<span class="guld">${ik('stjerne')}</span> ` : ''}${esc(r.titel)}</strong>
  <span>${esc([r.kategori, r.koekken, r.tid_minutter ? r.tid_minutter + ' min' : ''].filter(Boolean).join(' · ') || ' ')}</span></a>`;

// ---------- Lister ----------
let L = {}; // data til den liste, der vises
let FIL = null; // opskriftslistens søgning og filtre, så de overlever skiftet mellem listen alene og to ruder
const SOEG = { begge: ['Begge', 'Søg i navne og ingredienser'], navn: ['Navn', 'Søg i navne'], ing: ['Ingredienser', 'Søg i ingredienser'] };
// To ruder: en indstilling under Indstillinger, gemt på enheden. Standard: slået til med mus (Mac), fra med touch. Virker kun på brede skærme.
const BRED = matchMedia('(min-width: 1024px)');
const toRuder = () => { const v = lager.hent('toRuder', null); return v === null ? matchMedia('(hover: hover) and (pointer: fine)').matches : !!v; };
const ruderAktiv = () => toRuder() && BRED.matches;
const iOpskrifter = () => /^#\/opskrifter(\/(?!ny$)[^/]+)?$/.test(location.hash);
BRED.addEventListener('change', () => { if (toRuder() && (iOpskrifter() || /^#\/(forslag|hjemme)\/?$/.test(location.hash))) route(); });
const HENTER = '<p class="tomt">Henter…</p>';
// Ruller kun listen (ikke siden), så den valgte opskrift kan ses
function visValgt() {
  const p = $('#rude-liste'), v = p && p.querySelector('.oprk[aria-current]');
  if (!v) return;
  const a = v.getBoundingClientRect(), b = p.getBoundingClientRect();
  if (a.top < b.top + 64) p.scrollTop -= Math.ceil((b.top + 64 - a.top) / 32) * 32; else if (a.bottom > b.bottom - 96) p.scrollTop += Math.ceil((a.bottom - b.bottom + 96) / 32) * 32;
}
async function ruderSide(rid) {
  const id = visning;
  if (!app.querySelector('.ruder')) {
    app.innerHTML = '<div class="ruder"><div id="rude-liste" class="rude-liste"></div><div id="rude-indhold" class="rude-indhold"></div></div>';
    await liste('opskrifter', $('#rude-liste'));
    if (id !== visning) return;
  }
  L.valgt = rid; tegnListe();
  const h = $('#rude-indhold');
  h.classList.remove('trinind'); void h.offsetWidth; h.classList.add('trinind');
  await opskriftSide(rid, h); visValgt();
}
async function liste(type, maal = app) {
  const id = visning, T = TYPER[type];
  if (maal === app) henter(); else maal.innerHTML = HENTER;
  const [rader, ekstra] = await Promise.all([
    api(`${type}?select=*&order=${type === 'opskrifter' ? 'titel' : 'oprettet.desc'}`),
    type === 'tips' ? api('opskrifter?select=id,titel') : type === 'opskrifter' ? api('favoritter?select=opskrift_id') : []
  ]);
  if (id !== visning) return;
  const fil = type === 'opskrifter' && FIL ? FIL : {}, rude = maal !== app;
  L = { type, rader, q: fil.q || '', kat: fil.kat || '', koekken: fil.koekken || '', kunFav: !!fil.kunFav, valgt: '', soeg: SOEG[lager.hent('soegtype', 'begge')] ? lager.hent('soegtype', 'begge') : 'begge', navne: {}, fav: new Set() };
  if (type === 'tips') L.navne = Object.fromEntries(ekstra.map(o => [o.id, o.titel]));
  if (type === 'opskrifter') L.fav = new Set(ekstra.map(f => f.opskrift_id));
  const unik = n => [...new Set(rader.map(r => r[n]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'da')), kat = unik('kategori'), koek = unik('koekken');
  if (L.kat && !kat.includes(L.kat)) L.kat = '';
  if (L.koekken && !koek.includes(L.koekken)) L.koekken = '';
  const valg = (id, h, navn, alle, liste, nu) => `<select id="${id}" data-hs="${h}" aria-label="${navn}"><option value="">${alle}</option>${liste.map(k => `<option${k === nu ? ' selected' : ''}>${esc(k)}</option>`).join('')}</select>`;
  const soegChips = `<div class="filter soegtype" data-tpid="bjaelke-soeg" role="group" aria-label="Søg i">${Object.entries(SOEG).map(([k, [navn]]) => `<button type="button" class="chip${k === L.soeg ? ' valgt' : ''}" data-tpid="soeg-${k}" data-h="soegType" data-v="${k}">${navn}</button>`).join('')}</div>`;
  const favChip = `<button type="button" class="chip${L.kunFav ? ' valgt' : ''}" data-tpid="kun-favoritter" data-h="kunFav" aria-pressed="${L.kunFav}">${ik('stjerne')} Favoritter</button>`;
  const soeg = `<input id="soeg" type="search" placeholder="${SOEG[L.soeg][1]}" aria-label="Søg i opskrifter" autocomplete="off" value="${esc(fil.qr || '')}">`;
  // I ruden til venstre er der kun smal plads: ingen «Tilbage» (navigationen findes), én «Importér»-menu og valgfelter i stedet for rækker af chips, der ruller væk
  const hoved = rude && type === 'opskrifter' ? `<h1>${T.navn}</h1>
    <div class="rakke rude-knapper">
      <a class="knap primaer" href="#/${type}/ny">+ ${T.ny}</a>
      <details class="tilfoej"><summary class="knap" data-tpid="opskrifter-importer">Importér</summary>
        <div class="tilfoej-menu"><a class="knap" href="#/import">${ik('gnist')} Tilføj med Claude</a><a class="knap" data-tpid="opskrifter-links" href="#/import/links">${ik('gryde')} Importér links</a></div></details>
    </div>
    ${rader.length ? `${soeg}
      <div class="rude-valg" data-r="kat">${kat.length ? valg('valg-kat', 'katValg', 'Kategori', 'Alle kategorier', kat, L.kat) : ''}${koek.length ? valg('valg-koek', 'koekkenValg', 'Køkken', 'Alle køkkener', koek, L.koekken) : ''}</div>
      ${soegChips}
      <div class="filter" data-tpid="bjaelke-favoritter" role="group" aria-label="Favoritter">${favChip}</div>` : ''}` : `<a class="tilbage" href="#/">‹ Tilbage</a>
    <h1>${T.navn}</h1>
    <div class="rakke">
      <a class="knap primaer" href="#/${type}/ny">+ ${T.ny}</a>
      ${type === 'opskrifter' ? `<a class="knap" href="#/import">${ik('gnist')} Tilføj med Claude</a><a class="knap" data-tpid="opskrifter-links" href="#/import/links">${ik('gryde')} Importér links</a>` : ''}
      ${type === 'tips' ? `<a class="knap" data-tpid="tips-claude" href="#/tipsimport">${ik('gnist')} Tilføj med Claude</a>` : ''}
    </div>
    ${type === 'opskrifter' && rader.length ? `${soeg}
      ${soegChips}
      ${kat.length ? `<div class="filter" data-r="kat" data-tpid="bjaelke-kategori" role="group" aria-label="Kategori"><button class="chip${L.kat ? '' : ' valgt'}" data-h="kat" data-v="">Alle</button>${favChip}${kat.map(k => `<button class="chip${k === L.kat ? ' valgt' : ''}" data-h="kat" data-v="${esc(k)}">${esc(k)}</button>`).join('')}</div>` : ''}
      ${koek.length ? `<div class="filter" data-r="koekken" data-tpid="bjaelke-koekken" role="group" aria-label="Køkken"><button class="chip${L.koekken ? '' : ' valgt'}" data-tpid="koekken-alle" data-h="koekken" data-v="">Alle køkkener</button>${koek.map(k => `<button class="chip${k === L.koekken ? ' valgt' : ''}" data-h="koekken" data-v="${esc(k)}">${esc(k)}</button>`).join('')}</div>` : ''}` : ''}`;
  maal.innerHTML = `${hoved}
    <div id="liste"${type === 'opskrifter' ? ' class="oplist"' : ''}></div>`;
  tegnListe();
  const s = $('#soeg');
  if (s) s.addEventListener('input', () => { L.q = s.value.trim().toLowerCase(); tegnListe(); });
  Hjaelper.side(type === 'opskrifter' ? [
    { tekst: 'Vil du skrive din egen ret? Tryk her.', maal: '.rakke .primaer', bev: 'salto' },
    rude ? { tekst: 'Har du en opskrift fra nettet? Tryk på «Importér», så skriver Claude den ind for dig.', maal: '.tilfoej summary', bev: 'skridt', valgfri: true }
         : { tekst: 'Har du en opskrift fra nettet? Claude skriver den ind for dig.', maal: 'a[href="#/import"]', bev: 'skridt', valgfri: true },
    { tekst: 'Skriv et navn eller en ingrediens. Så finder jeg retten.', maal: '#soeg', bev: 'dans', valgfri: true },
    { tekst: 'Vælg, om jeg skal søge i navne, ingredienser eller begge dele.', maal: '.soegtype', bev: 'skridt', valgfri: true },
    { tekst: 'Tryk på en kategori eller et køkken for at sortere.', maal: '[data-r=kat]', bev: 'hop', valgfri: true },
    { tekst: 'Tryk på en ret for at åbne den.', maal: '#liste .kort, #liste a', bev: 'rul', valgfri: true }] : [
    { tekst: 'Skriv dit eget tip her. Det er et lille råd.', maal: '.rakke .primaer', bev: 'salto' },
    { tekst: 'Står tipsets navn i en opskrift, bliver ordet blåt. Tryk på det.', maal: '#liste .kort', bev: 'rul', valgfri: true }]);
}
function tegnListe() {
  const { type, rader, q, kat, koekken, soeg } = L, T = TYPER[type];
  if (type === 'opskrifter') FIL = { q, qr: ($('#soeg') || {}).value || '', kat, koekken, kunFav: L.kunFav };
  const iNavn = r => (r.titel || '').toLowerCase().includes(q), iIng = r => ingAf(r).some(i => i.n.toLowerCase().includes(q));
  const vis = rader.filter(r => (!kat || r.kategori === kat) && (!koekken || r.koekken === koekken) && (!L.kunFav || L.fav.has(r.id)) &&
    (!q || (type !== 'opskrifter' || soeg === 'navn' ? iNavn(r) : soeg === 'ing' ? iIng(r) : iNavn(r) || iIng(r))));
  let bogstav = ''; // bogstav-overskrifter, når listen står i alfabetisk orden uden søgning
  $('#liste').innerHTML = vis.length ? vis.map(r => {
    if (type === 'opskrifter') {
      const b = (r.titel || '').trim().charAt(0).toLocaleUpperCase('da'), ny = !q && b !== bogstav; bogstav = b;
      return (ny ? `<h3 class="oplist-bogstav">${esc(b)}</h3>` : '') + opskriftRaekke(r, L.fav.has(r.id), r.id === L.valgt);
    }
    const til = L.navne[r.opskrift_id];
    return `<article class="kort" id="tip-${r.id}">${r.titel ? `<strong>${esc(r.titel)}</strong>` : ''}<p class="tekst">${esc(r.tekst)}</p>
      ${til ? `<p class="lille">Til: <a href="#/opskrifter/${r.opskrift_id}">${esc(til)}</a></p>` : ''}${knapper('tips', r.id)}</article>`;
  }).join('') : `<p class="tomt">${rader.length ? (L.kunFav && !q && !kat && !koekken ? 'Du har ingen favoritter endnu. Tryk på stjernen i en opskrift.' : 'Ingen opskrifter passer. Prøv et andet ord.') : T.tom}</p>`;
}
const knapper = (type, id, ekstra = '') => `<div class="rakke skaerm">
  <a class="knap" data-tpid="rediger" href="#/${type}/${id}/rediger">Rediger</a>${ekstra}
  <button class="knap fare" data-tpid="slet" data-h="slet" data-v="${type}:${id}">Slet</button></div>`;

// ---------- Opskrift ----------
let S = null; // den opskrift, der vises
const portValg = {};
async function opskriftSide(rid, maal = app) {
  const id = visning, iRude = maal !== app;
  if (iRude) maal.innerHTML = HENTER; else henter();
  const q = `opskrift_id=eq.${enc(rid)}`;
  const [rr, tips, fav, stj, lr] = await Promise.all([
    api(`opskrifter?id=eq.${enc(rid)}&select=*`), api('tips?select=*&order=oprettet.desc'),
    api(`favoritter?${q}&select=id`), api(`stjerner?${q}&select=antal,bruger_id`), api(`laerred?${q}&select=*&order=oprettet`)
  ]);
  if (id !== visning) return;
  const r = rr[0];
  if (!r) { if (maal !== app) maal.innerHTML = '<p class="tomt">Opskriften findes ikke længere. Vælg en anden i listen.</p>'; else info('Opskriften findes ikke længere.<br><a href="#/opskrifter">Tilbage til Opskrifter</a>'); return; }
  S = { r, tips, fav: fav.length > 0, stj, port: portValg[rid] || r.portioner || 4 };
  kendteBegreber = begreberAf(tips);
  const c = chips(r), egne = tips.filter(t => t.opskrift_id === r.id);
  maal.innerHTML = `${iRude && !opskriftFra ? `<a class="tilbage direkte skaerm" href="#/opskrifter">‹ Tilbage</a>` : `<a class="tilbage skaerm" href="${opskriftFra || '#/opskrifter'}">‹ Tilbage</a>`}
    ${vaerktoej(`<a class="knap" data-tpid="rediger" href="#/opskrifter/${r.id}/rediger">${ik('blyant')} Rediger</a>`)}
    <div class="titelrakke"><h1>${esc(r.titel)}</h1>
      <button id="favknap" class="favknap skaerm" data-h="favorit" aria-pressed="${S.fav}" aria-label="Favorit">${ik(S.fav ? 'stjerne' : 'stjerne0')}</button></div>
    ${c.length ? `<p class="chips">${c.map(x => `<span>${x}</span>`).join('')}</p>` : ''}
    ${r.beskrivelse ? `<p class="tekst">${esc(r.beskrivelse)}</p>` : ''}
    <button class="knap primaer stor skaerm" data-h="lav">▶ Lav retten trin for trin</button>
    <div class="opsk-ruder"><section>
    <h2 class="opsk">Ingredienser</h2>
    <div class="portioner skaerm"><div class="stepper" role="group" aria-label="Antal portioner">
      <button type="button" class="rund felt felt-s" data-h="port" data-v="-1" aria-label="Færre portioner">−</button>
      <input id="portinp" class="felt felt-s" type="text" inputmode="numeric" autocomplete="off" value="" aria-label="Antal portioner">
      <button type="button" class="rund felt felt-s" data-h="port" data-v="1" aria-label="Flere portioner">+</button></div>
      <small id="portvis"></small></div>
    <ul class="ing" id="ing"></ul></section><section>
    <h2 class="opsk">Sådan gør du</h2>
    <div id="trin"></div></section></div>
    <h2 class="skaerm opsk">Hvordan smagte det?</h2>
    <div id="stjerner" class="skaerm"></div>
    ${egne.length ? `<h2 class="opsk">Tips til retten</h2>${egne.map(t => `<div class="kort">${t.titel ? `<strong>${esc(t.titel)}</strong>` : ''}<p class="tekst">${esc(t.tekst)}</p></div>`).join('')}` : ''}
    <h2 class="skaerm opsk">Vores side</h2>
    <p class="lille skaerm opsk">Sæt billeder og figurer på siden, og flyt dem rundt.</p>
    <div class="laerred-ramme skaerm"><div id="laerred" class="laerred"></div></div>
    <div id="laerred-knapper" class="rakke skaerm"></div>
    <input id="billedfil" type="file" accept="image/*" hidden>
    <div class="rakke skaerm"><a class="knap" data-tpid="opdater-claude" href="#/opdater/${r.id}">${ik('gnist')} Opdater med Claude</a>
      <button class="knap" data-h="print">Print</button></div>
    <div class="rakke skaerm sletrakke"><button class="knap fare" data-tpid="slet" data-h="slet" data-v="opskrifter:${r.id}">Slet</button></div>`;
  tegnIng(); tegnTrin(); tegnStjerner(); tegnLaerredKnapper(false);
  $('#billedfil').addEventListener('change', nytBillede);
  const lel = $('#laerred');
  lel.addEventListener('valgt', e => { const k = $('#fjernvalgt'); if (k) k.disabled = !e.detail; });
  Hjaelper.side([
    { tekst: 'Tryk på stjernen. Så bliver retten en favorit.', maal: '#favknap', bev: 'salto' },
    { tekst: 'Skal I være flere? Tryk på plus og minus.', maal: '.portioner', bev: 'skridt' },
    { tekst: 'Tryk på et blåt ord. Så forklarer jeg det.', maal: '#trin .begreb', bev: 'dans', valgfri: true },
    { tekst: 'Klar? Tryk her, så går vi trin for trin.', maal: 'button[data-h=lav]', bev: 'rul' }]);;
  await Laerred.start(lel, lr, r.id);
}
// Knapperne øverst. «Tilføj tip» sidder fast øverst til venstre, mens man ruller. Ekstra knapper kommer til højre.
const vaerktoej = (hoejre = '') => `<div class="vaerktoej skaerm"><button type="button" class="knap"${hoejre ? '' : ' data-tpid="tip-alene"'} data-h="nytBegreb">${ik('paere')} Tilføj tip</button>${hoejre}</div>`;
// Overskrift (fx «Sovs») i en liste af ingredienser
const ingOverskrift = navn => `<li class="grp">${esc(navn)}</li>`;
function tegnIng() {
  const grp = ingGrupper(S.r), f = S.port / (S.r.portioner || S.port);
  $('#portinp').value = S.port; $('#portvis').textContent = S.port === 1 ? 'portion' : 'portioner';
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
  catch (err) { console.error(err); fejlbesked('Billedet blev ikke gemt. Tjek internettet, eller vælg et andet billede.'); }
}

// ---------- Trin for trin ----------
let K = null, skaermlaas = null;
async function holdSkaerm() { try { if (navigator.wakeLock) skaermlaas = await navigator.wakeLock.request('screen'); } catch (e) { /* ikke vigtigt */ } }
function slipSkaerm() { if (skaermlaas) { skaermlaas.release().catch(() => {}); skaermlaas = null; } }
async function lavSide(rid) {
  const id = visning;
  henter();
  const q = `opskrift_id=eq.${enc(rid)}`;
  const [rr, tips, stj] = await Promise.all([api(`opskrifter?id=eq.${enc(rid)}&select=*`), api('tips?select=*'), api(`stjerner?${q}&select=antal,bruger_id`)]);
  if (id !== visning) return;
  const r = rr[0];
  if (!r) return info('Opskriften findes ikke længere.<br><a href="#/opskrifter">Tilbage til Opskrifter</a>');
  kendteBegreber = begreberAf(tips);
  K = { r, trin: trinAf(r), i: -1, port: portValg[rid] || r.portioner || 4, talt: false, afkr: {} };
  S = { r, tips, stj, port: K.port, fav: false };
  holdSkaerm();
  tegnLav();
  Hjaelper.side([
    { tekst: 'Her kan du se, hvor langt du er.', maal: 'progress', bev: 'hop' },
    { tekst: 'Her står, hvad du skal gøre. Ét trin ad gangen.', maal: '.lav-midte', bev: 'skridt' },
    { tekst: 'Står der en tid? Tryk her for at starte et ur.', maal: '.lav-ur .knap', bev: 'dans', valgfri: true },
    { tekst: 'Tryk på Næste, når du er klar til næste trin.', maal: '.lav-bund .primaer', bev: 'salto' }]);;
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
    midte = `<h1>Velbekomme!</h1><p class="tekst">Du har lavet ${esc(r.titel)}. Hvordan smagte det?</p><div id="stjerner">${stjerneHtml(S.stj)}</div>
      <div class="traek" id="traek">${K.traek ? `<p class="tekst">${esc(K.traek)}</p>` : `<p class="tekst">Skal ingredienserne trækkes fra i «Hvad har du derhjemme?»</p>
        <button type="button" class="knap felt felt-m primaer" data-tpid="traek-ja" data-h="traekFra">Ja, træk fra</button>
        <button type="button" class="knap felt felt-m" data-tpid="traek-nej" data-h="traekNej">Nej tak</button>`}</div>`;
    naeste = '';
  }
  app.innerHTML = `<div class="lav">
    <div class="lav-top"><a class="knap" data-tpid="luk" href="#/opskrifter/${r.id}">× Luk</a>
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
function rkVokser(t) { if (!t.scrollHeight) return; t.style.height = 'auto'; const R = RAEKKE(); t.style.height = Math.max(2 * R, Math.ceil((t.scrollHeight + t.offsetHeight - t.clientHeight) / R - 0.02) * R) + 'px'; } // hele rækker
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
  if (f.t === 'tjek') return `<label class="skift tjekfelt" for="f_${f.n}"><input id="f_${f.n}" name="${f.n}" type="checkbox"${v ? ' checked' : ''}> <span>${f.l}</span></label>
    ${f.hint ? `<small>${f.hint}</small>` : ''}`;
  if (f.t === 'textarea') input = `<textarea ${m} rows="${f.rows || 4}">${esc(v)}</textarea>`;
  else if (f.t === 'number') input = `<input ${m} type="number" inputmode="numeric" min="0" step="1" value="${esc(v)}">`;
  else if (f.t === 'valg') input = `<select ${m}><option value="">Vælg</option>${f.valg.map(([k, t]) => `<option value="${k}"${k === v ? ' selected' : ''}>${t}</option>`).join('')}</select>`;
  else if (f.t === 'opskrift') input = `<select ${m}><option value="">Ingen bestemt opskrift</option>${
    ekstra.map(o => `<option value="${o.id}"${o.id === v ? ' selected' : ''}>${esc(o.titel)}</option>`).join('')}</select>`;
  else if (f.t === 'kategori' || f.t === 'koekken') { // forslagene står som knapper under feltet, så man ser dem, før man skriver
    const ko = f.t === 'koekken', kat = [...new Set([...(ko ? OPSKRIFT_KOEKKEN : OPSKRIFT_KAT), ...ekstra.map(o => o[f.n]).filter(Boolean)])], nu = String(v || '').trim().toLowerCase();
    input = `<input ${m} type="text" value="${esc(v)}" autocomplete="off">
      <div class="katvalg" role="group" aria-label="Forslag til ${ko ? 'køkken' : 'kategori'}">${kat.map(k => `<button type="button" class="chip${k.toLowerCase() === nu ? ' valgt' : ''}" data-h="vaelgKat" data-f="${f.n}" data-v="${esc(k)}">${esc(k)}</button>`).join('')}</div>`;
  }
  else input = `<input ${m} type="text" value="${esc(v)}" autocomplete="off">`;
  return `<label for="f_${f.n}">${f.l}${f.kraevet ? '' : ' <span>(kan springes over)</span>'}</label>
    ${f.hint ? `<small>${f.hint}</small>` : ''}${input}`;
}
function laesFelter(form, felter, visFejl) {
  const data = {};
  for (const f of felter) {
    if (f.t === 'ingredienser') { data[f.n] = laesIngEd($('#ed_' + f.n, form)); continue; }
    if (f.t === 'trin') { data[f.n] = laesTrinEd($('#ed_' + f.n, form)); continue; }
    if (f.t === 'tjek') { data[f.n] = form.elements[f.n].checked; continue; }
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
    type === 'tips' ? api('opskrifter?select=id,titel&order=titel') : type === 'opskrifter' ? api('opskrifter?select=id,titel,kategori,koekken') : []
  ]);
  if (id !== visning) return;
  if (rid && !r[0]) return info(`Den findes ikke længere.<br><a href="#/${type}">Tilbage</a>`);
  const rad = r[0] || {};
  const tilbage = rid && type !== 'tips' ? `#/${type}/${rid}` : `#/${type}`;
  app.innerHTML = `<a class="tilbage fortryd" href="${tilbage}">‹ Annuller</a>
    ${type === 'opskrifter' ? vaerktoej() : ''}
    <h1>${rid ? T.rediger : T.ny}</h1>
    <form id="form" novalidate>
      ${T.felter.map(f => felt(f, rad, ekstra)).join('')}
      <div id="formfejl"></div>
      <button class="knap primaer stor formknap" data-tpid="gem" type="submit">Gem</button>
    </form>`;
  Hjaelper.side(type === 'opskrifter' ? [
    { tekst: 'Start med navnet på retten.', maal: '#form input:not([type=hidden])', bev: 'salto' },
    { tekst: 'Skriv én ingrediens i hvert felt. Tryk på retur for et nyt felt.', maal: '#ed_ingredienser', bev: 'skridt', valgfri: true },
    { tekst: 'Skriv ét trin i hvert felt. Korte trin er lettest at følge.', maal: '#ed_trin', bev: 'dans', valgfri: true },
    { tekst: 'Tryk på Gem, når du er færdig.', maal: '[data-tpid=gem]', bev: 'rul' }] : [
    { tekst: 'Giv tippet et navn. Står navnet i en opskrift, bliver ordet et link.', maal: '#form input:not([type=hidden])', bev: 'salto' },
    { tekst: 'Tryk på Gem, når du er færdig.', maal: '[data-tpid=gem]', bev: 'rul' }]);
  const form = $('#form');
  form.querySelectorAll('.rk-tekst').forEach(rkVokser);
  form.addEventListener('input', e => { if (e.target.classList.contains('rk-tekst')) rkInput(e.target); });
  form.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing && e.target.classList.contains('rk-tekst')) { e.preventDefault(); rkEnter(e.target.closest('.rk')); }
  });
  form.addEventListener('beforeinput', e => { // telefoner sender ikke altid Enter som tast
    if (e.target.classList.contains('rk-tekst') && (e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph')) { e.preventDefault(); rkEnter(e.target.closest('.rk')); }
  });
  if (type === 'opskrifter') { // hjælperen siger til, hvis navnet allerede findes
    let sidstNavn = '', dubTimer;
    const titelEl = form.elements.titel;
    titelEl.addEventListener('input', () => {
      clearTimeout(dubTimer);
      dubTimer = setTimeout(() => {
        const o = findNavn(ekstra, titelEl.value, rid);
        if (!o) { sidstNavn = ''; return; }
        if (navnNoegle(o.titel) === sidstNavn) return;
        sidstNavn = navnNoegle(o.titel);
        Hjaelper.sig(`Hov, du har allerede en opskrift, der hedder «${o.titel}».`, { nu: true, knap: { tekst: 'Se opskriften', href: `#/opskrifter/${o.id}` } });
      }, 700);
    });
  }
  const visFejl = tekst => { $('#formfejl').innerHTML = `<div class="fejlboks">${tekst}</div>`; };
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = laesFelter(form, T.felter, visFejl);
    if (!data) return;
    if (type === 'opskrifter' && !rid) {
      let nu = ekstra; try { nu = await api('opskrifter?select=id,titel'); } catch (err) { console.error(err); }
      const o = findNavn(nu, data.titel);
      if (o && !(await spoergDublet([o], 1))) return;
    }
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
function beregnForslag(opskrifter, harTekst, udenKrydderier) {
  const har = harTekst.split(/[,\n]/).map(stamme).filter(Boolean);
  const rader = opskrifter.map(r => {
    const brug = ingAf(r).map(i => simpel(i.n.toLowerCase())).filter(n => !erBasis(n) && !(udenKrydderier && Katalog.erKrydderi(n)));
    const set = new Set(), mangler = []; // vises med hele ord («sojasauce»), men tæller kun én gang pr. stamme
    for (const n of brug) { const s = stamme(n); if (!har.some(h => passer(s, h)) && !set.has(s)) { set.add(s); mangler.push(n); } }
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
  F = (await api('opskrifter?select=id,titel,kategori,svaerhed,tid_minutter,ingredienser,skjul_forslag&order=titel')).filter(r => !r.skjul_forslag);
  await Katalog.hent().catch(() => {}); // kategorierne bruges til at kende krydderier
  if (id !== visning) return;
  // Brede skærme med «to ruder»: ingredienserne i et kort til venstre, forslagene til højre. Ellers én kolonne, som før.
  const tilbage = '<a class="tilbage" href="#/">‹ Tilbage</a>', titel = '<h1>Hvad kan jeg lave?</h1>',
    madplan = rude => `<a class="knap felt felt-m" data-tpid="${rude ? 'madplan-rude' : 'madplan'}" href="#/forslag/madplan">${ik('gryde')} Madplan</a>`, // i ruden står knappen på en anden plads end i én kolonne, så den har sit eget id
    claude = `<div class="rakke to-knapper"><button type="button" class="knap" data-tpid="hj-claude" data-h="hjClaude">${ik('gnist')} Tilføj med Claude</button>
      <button type="button" class="knap" data-tpid="sorter-claude" data-h="sorterAndet">${ik('gnist')} Sortér med Claude</button></div>`,
    oversigt = `<button type="button" class="knap" data-h="ingOversigt">${ik('tag')} Se alle ingredienser</button>`;
  app.innerHTML = ruderAktiv()
    ? `<div class="ruder ruder-forslag"><section class="rude-liste" aria-label="Det, du har derhjemme">${titel}<div id="hj-boks"></div><div id="hj-liste-boks"></div>${claude}${oversigt}</section>
      <div class="rude-indhold">${tilbage}${madplan(true)}<div id="forslag-nu"></div><div id="forslag-resten"></div></div></div>`
    : `${tilbage}${titel}<div id="hj-boks"></div><div id="forslag-nu"></div>${madplan(false)}<div id="hj-liste-boks"></div>${claude}<div id="forslag-resten"></div>${oversigt}`;
  Hjaelper.side([
    { tekst: 'Skriv det, du har derhjemme. Ét ord i hvert felt.', maal: '#hj-boks', bev: 'salto' },
    { tekst: 'Her kommer de retter, du kan lave nu.', maal: '#forslag-nu', bev: 'skridt', valgfri: true },
    { tekst: 'Tag billeder af dit køleskab. Så skriver Claude listen for dig.', maal: '[data-h=hjClaude]', bev: 'skridt' },
    { tekst: 'Står der noget skævt? Claude kan rydde op.', maal: '[data-h=sorterAndet]', bev: 'dans' }]);;
  await visHjemme();
}
const visHjemme = () => Hjemme.vis($('#hj-boks'), tegnForslag, $('#hj-liste-boks'));
let visNaesten = 20; // hvor mange af «Du mangler lidt»-retterne der vises
const udenKryd = () => lager.hent('udenKrydderier', false);
const maksMangler = () => Math.max(0, Math.min(20, Math.round(Number(lager.hent('maxMangler', 3))) || 0));
function tegnForslag() {
  const nu = $('#forslag-nu'), rest = $('#forslag-resten'), tekst = Hjemme.navne().join(',');
  if (!nu) return;
  if (!tekst.trim()) { nu.innerHTML = '<h2>Det kan du lave nu</h2><p class="tomt">Skriv mindst én ting i feltet ovenfor, så finder jeg retter.</p>'; rest.innerHTML = ''; return; }
  const f = beregnForslag(F, tekst, udenKryd()), maks = maksMangler(), naesten = f.naesten.filter(x => x.mangler.length <= maks);
  nu.innerHTML = `<div class="mangler-top"><h2>Det kan du lave nu</h2>
      <label class="skift" data-tpid="uden-krydderier"><input type="checkbox" id="udenkryd" ${udenKryd() ? 'checked' : ''}> <span>Uden krydderier</span></label></div>
    ${f.kan.length ? f.kan.map(r => opskriftKort(r)).join('') : '<p class="lille">Ingen retter endnu. Se, hvad du kan købe længere nede.</p>'}`;
  rest.innerHTML = `${f.koeb.length ? `<h2>Køb lidt, og lav mere</h2>${f.koeb.map(k => `<div class="kort koebsforslag"><strong>Køb ${esc(k.koeb.join(' og '))}</strong>
      <span>Så kan du også lave: ${k.retter.map(r => `<a href="#/opskrifter/${r.id}">${esc(r.titel)}</a>`).join(', ')}</span></div>`).join('')}` : ''}
    <div class="mangler-top"><h2>Du mangler lidt</h2>
      <div class="stepper" role="group" aria-label="Højst så mange ingredienser må mangle">
        <button type="button" class="rund felt felt-s" data-h="maksNed" aria-label="Færre">−</button>
        <input id="maks" class="felt felt-s" type="text" inputmode="numeric" autocomplete="off" value="${maks}" aria-label="Højst så mange ingredienser må mangle">
        <button type="button" class="rund felt felt-s" data-h="maksOp" aria-label="Flere">+</button></div></div>
    <small>Højst ${maks} ${maks === 1 ? 'ingrediens' : 'ingredienser'} må mangle.${naesten.length > visNaesten ? ` Viser ${visNaesten} af ${naesten.length} retter.` : ''}</small>
    ${naesten.length ? naesten.slice(0, visNaesten).map(x => `<a class="kort" href="#/opskrifter/${x.r.id}"><strong>${esc(x.r.titel)}</strong><span>Mangler: ${esc(x.mangler.join(', '))}</span></a>`).join('') : '<p class="lille">Ingen retter mangler så få. Skriv et højere tal.</p>'}
    ${naesten.length > visNaesten ? '<button type="button" class="knap felt felt-m" data-tpid="vis-flere" data-h="visFlere">Vis flere</button>' : ''}`;
}
function saetMaks(n) { lager.gem('maxMangler', Math.max(0, Math.min(20, Math.round(Number(n)) || 0))); visNaesten = 20; tegnForslag(); }

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
- Skriv ingen forkortelser i navne. Skriv "hakket", ikke "hakk", og "revet", ikke "rev".
- Giv retten en "kategori" på øverste niveau. Brug præcis en af disse: ${OPSKRIFT_KAT.join(', ')}.
- Giv retten et "køkken" på øverste niveau. Brug en af disse: ${OPSKRIFT_KOEKKEN.join(', ')}. Passer ingen, så skriv et andet kort navn, fx "Thai".
- Giv hver ingrediens en "kategori". Brug præcis en af disse: §KAT§. Passer ingen, så skriv "Ikke sorteret".

Svar KUN med JSON i en kodeblok, uden anden tekst, i præcis dette format:
{
  "navn": "Spaghetti med kødboller",
  "sværhed": 3,
  "tid": 45,
  "portioner": 4,
  "kategori": "Hovedret",
  "køkken": "Italiensk",
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
const rydFoer = {}; // teksten før «Ryd», så den kan sættes tilbage
const lavBesked = () => CLAUDE_BESKED.replace('§KAT§', Katalog.kategorier().join(', ') || FALDBACK_KAT);
function importSide() {
  claudeBesked = lavBesked();
  Katalog.hent().catch(() => {}); // kategorierne kommer med i beskeden
  app.innerHTML = `<a class="tilbage" href="#/opskrifter">‹ Tilbage</a><h1>Tilføj med Claude</h1>
    <ol class="trin vejledning">
      <li>Skriv din opskrift her, eller sæt ét eller flere links ind (ét pr. linje). Står der intet, bruger jeg det, du har kopieret. Tryk så på knappen. Din tekst bliver sat sammen med beskeden til Claude.
        <textarea id="egen" rows="5" data-husk="importEgen" placeholder="Din opskrift eller links" aria-label="Din opskrift"></textarea>
        <div class="felt-knapper"><button type="button" class="knap" data-tpid="import-egen-saet" data-h="saetInd" data-v="egen">Sæt ind</button><span class="hoejre"><button type="button" class="knap mini" data-tpid="import-egen-fortryd" data-h="fortrydRyd" data-v="egen" hidden>Fortryd</button><button type="button" class="knap mini fare" data-tpid="import-egen-ryd" data-h="rydFelt" data-v="egen">Ryd</button></span></div>
        <button class="knap primaer stor formknap" data-tpid="kopier-besked" data-h="kopierBesked">${ik('gnist')} Kopiér besked</button></li>
      <li>Åbn Claude, og sæt beskeden ind, hvis feltet er tomt. Har du et billede, så sæt det på hos Claude.
        <div class="rakke venstre"><a class="knap stor" data-tpid="aabn-claude" id="aabnClaude" href="https://claude.ai/new" target="_blank" rel="noopener">Åbn Claude ›</a></div></li>
      <li>Kopiér Claudes svar, og sæt det ind her:
        <textarea id="claudesvar" rows="7" data-husk="importSvar" placeholder='{ "navn": "…" }' aria-label="Claudes svar"></textarea>
        <div class="felt-knapper"><button type="button" class="knap" data-tpid="import-svar-saet" data-h="saetInd" data-v="claudesvar">Sæt ind</button><span class="hoejre"><button type="button" class="knap mini" data-tpid="import-svar-fortryd" data-h="fortrydRyd" data-v="claudesvar" hidden>Fortryd</button><button type="button" class="knap mini fare" data-tpid="import-svar-ryd" data-h="rydFelt" data-v="claudesvar">Ryd</button></span></div></li>
    </ol>
    <div id="formfejl"></div>
    <button class="knap primaer stor formknap" data-h="gemImport">Gem opskriften</button>`;
  document.querySelectorAll('textarea[data-husk]').forEach(t => { t.value = lager.hent(t.dataset.husk, ''); }); // teksten huskes, til opskriften er gemt
  Hjaelper.side([
    { tekst: 'Sæt din opskrift eller dine links ind her.', maal: '#egen', bev: 'salto' },
    { tekst: 'Tryk her. Så kopierer jeg en besked til Claude.', maal: '[data-h=kopierBesked]', bev: 'skridt' },
    { tekst: 'Åbn Claude, og sæt beskeden ind.', maal: '#aabnClaude', bev: 'dans' },
    { tekst: 'Sæt Claudes svar ind her. Tryk så på Gem.', maal: '#claudesvar', bev: 'rul' }]);;
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
  const vare = v => { const i = normIng(v); if (!i) return null; const k = v && typeof v === 'object' ? (v.kategori ?? v.kat) : null; if (k) kat[Katalog.rens(simpel(i.n))] = String(k).trim(); return i; };
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
    koekken: (() => { const k = j['køkken'] ?? j.koekken; return typeof k === 'string' && k.trim() ? k.trim() : null; })(),
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
const tilpasHoejde = () => Math.max(20, Math.min(90, Math.round(Number(lager.hent('tilpasHoejde', 33))) || 33));
const versionstekst = () => {
  const k = window.KOGEBOG; if (!k) return '';
  const d = new Date(k.dato + 'T12:00:00');
  return `Version ${esc(k.version)}${isNaN(d) ? '' : ' · ' + d.toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' })}`;
};
function mereSide() {
  app.innerHTML = `<a class="tilbage" href="#/">‹ Tilbage</a>
    <h2>Indstillinger</h2>
    <p class="lille">Udseende</p>
    <div role="radiogroup" aria-label="Udseende">
      <label class="skift"><input type="radio" name="tema" value="auto" ${Tema.valg() === 'auto' ? 'checked' : ''}> <span>Automatisk (som din telefon)</span></label>
      <label class="skift"><input type="radio" name="tema" value="lys" ${Tema.valg() === 'lys' ? 'checked' : ''}> <span>Lyst</span></label>
      <label class="skift"><input type="radio" name="tema" value="moerk" ${Tema.valg() === 'moerk' ? 'checked' : ''}> <span>Mørkt</span></label>
    </div>
    <label class="skift"><input type="checkbox" id="vishj" ${Hjaelper.skjult() ? '' : 'checked'}> <span>Vis hjælperen</span></label>
    <label class="skift"><input type="checkbox" id="lydtil" ${Lyd.til() ? 'checked' : ''}> <span>Lyde</span></label>
    <label class="skift"><input type="checkbox" id="toruder" ${toRuder() ? 'checked' : ''}> <span>Vis to ruder på brede skærme</span></label>
    <p class="lille">Når du åbner en opskrift: listen til venstre og opskriften til højre.${BRED.matches ? '' : ' Skærmen her er for smal, så det ses kun på en bred skærm (iPad på langs og Mac).'}</p>
    <label class="skift"><input type="checkbox" id="tilpastil" ${Tilpas.til() ? 'checked' : ''}> <span>Tilpas siden</span></label>
    <button class="knap fare" id="tilpasnul">Nulstil alle tekster</button>
    <p class="lille">Hvor højt vinduet til at tilpasse et felt må blive, i procent af skærmen.</p>
    <div class="stepper" role="group" aria-label="Højde på tilpas-vinduet">
      <button type="button" class="rund felt felt-s" id="tphned" aria-label="Lavere">−</button>
      <input id="tphoejde" class="felt felt-s" type="text" inputmode="numeric" autocomplete="off" value="${tilpasHoejde()}" aria-label="Højde i procent">
      <button type="button" class="rund felt felt-s" id="tpop" aria-label="Højere">+</button> <span>%</span></div>
    <h2>Genindlæs</h2>
    <p class="lille">Henter appen forfra, så du får den nyeste version.</p>
    <button type="button" class="knap" id="genstart">${ik('genindlaes')} Genindlæs appen</button>
    <h2>Sikkerhedskopi</h2>
    <p class="lille">Hent alt indhold som en fil. Gem den et sikkert sted.</p>
    <button class="knap" data-h="eksport">${ik('hent')} Hent sikkerhedskopi</button>
    <p class="lille" id="versionstekst">${versionstekst()}</p>
`;
  document.querySelectorAll('input[name=tema]').forEach(r => r.addEventListener('change', e => Tema.saet(e.target.value)));
  $('#vishj').addEventListener('change', e => Hjaelper.vis(e.target.checked));
  $('#toruder').addEventListener('change', e => { lager.gem('toRuder', e.target.checked); toast(e.target.checked ? 'To ruder er slået til' : 'To ruder er slået fra'); });
  $('#tilpastil').addEventListener('change', e => Tilpas.saet(e.target.checked));
  const saetHoejde = n => { const v = Math.max(20, Math.min(90, Math.round(Number(n)) || 33)); lager.gem('tilpasHoejde', v); $('#tphoejde').value = v; };
  $('#tphned').addEventListener('click', () => saetHoejde(tilpasHoejde() - 5));
  $('#tpop').addEventListener('click', () => saetHoejde(tilpasHoejde() + 5));
  $('#tphoejde').addEventListener('change', e => saetHoejde(e.target.value));
  $('#tilpasnul').addEventListener('click', async () => { if (await bekraeft('Vil du sætte alle tekster og størrelser tilbage?', 'Nulstil')) { Tilpas.nulstil(); toast('Teksterne er nulstillet'); } });
  $('#lydtil').addEventListener('change', e => { Lyd.saet(e.target.checked); Lyd.spil('klik'); });
  Hjaelper.side([
    { tekst: 'Vælg lyst eller mørkt udseende.', maal: '[role=radiogroup]', bev: 'salto' },
    { tekst: 'Her kan du skjule mig. Du kan altid hente mig igen.', maal: '#vishj', bev: 'skridt' },
    { tekst: 'Slå lydene til og fra her.', maal: '#lydtil', bev: 'hop' },
    { tekst: 'Hent en sikkerhedskopi. Så har du alle opskrifter i en fil.', maal: '[data-h=eksport]', bev: 'rul' }]);;
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
  sorterAndet: () => Katalog.sorterAndet(visHjemme),
  vaelgKat(el) { const f = $('#f_' + (el.dataset.f || 'kategori')); if (!f) return; f.value = el.dataset.v; markerKat(); },
  visFlere: () => { visNaesten += 20; tegnForslag(); },
  maksNed: () => saetMaks(maksMangler() - 1),
  maksOp: () => saetMaks(maksMangler() + 1),
  async slet(el) {
    const [type, id] = el.dataset.v.split(':');
    if (!await bekraeft(TYPER[type].bekraeft)) return;
    await api(`${type}?id=eq.${enc(id)}`, { method: 'DELETE' });
    toast(TYPER[type].slettet);
    app.innerHTML = ''; // også listen i to ruder hentes forfra
    if (location.hash === '#/' + type) route(); else location.hash = '#/' + type;
  },
  katValg(el) { L.kat = el.value; tegnListe(); },
  koekkenValg(el) { L.koekken = el.value; tegnListe(); },
  kunFav(el) { L.kunFav = !L.kunFav; el.classList.toggle('valgt', L.kunFav); el.setAttribute('aria-pressed', L.kunFav); tegnListe(); },
  kat(el) {
    L.kat = el.dataset.v;
    el.parentNode.querySelectorAll('.chip[data-h=kat]').forEach(c => c.classList.toggle('valgt', c === el));
    tegnListe();
  },
  koekken(el) {
    L.koekken = el.dataset.v;
    el.parentNode.querySelectorAll('.chip').forEach(c => c.classList.toggle('valgt', c === el));
    tegnListe();
  },
  soegType(el) {
    L.soeg = el.dataset.v; lager.gem('soegtype', L.soeg);
    el.parentNode.querySelectorAll('.chip').forEach(c => c.classList.toggle('valgt', c === el));
    $('#soeg').placeholder = SOEG[L.soeg][1];
    tegnListe();
  },
  async favorit() {
    const q = `favoritter?opskrift_id=eq.${enc(S.r.id)}`;
    if (S.fav) await api(q, { method: 'DELETE' });
    else await api('favoritter?on_conflict=opskrift_id,bruger_id', { method: 'POST', flet: true, body: { opskrift_id: S.r.id, bruger_id: FAELLES } });
    S.fav = !S.fav;
    if (L.fav && $('#rude-liste')) { if (S.fav) L.fav.add(S.r.id); else L.fav.delete(S.r.id); tegnListe(); }
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
  async traekFra() {
    K.traek = 'Gemmer…'; tegnLav();
    try {
      const t = await Hjemme.traek(ingAf(K.r), K.port / (K.r.portioner || K.port));
      K.traek = t.rettet ? `Færdig. Ingredienserne er trukket fra${t.fjernet ? `, og ${t.fjernet} er brugt op og fjernet` : ''}.` : 'Der var ikke noget at trække fra.';
    } catch (err) { console.error(err); K.traek = ''; fejlbesked('Ingredienserne blev ikke trukket fra listen derhjemme. Tjek internettet, og tryk på knappen igen.'); }
    tegnLav();
  },
  traekNej() { K.traek = 'Okay, listen er ikke ændret.'; tegnLav(); },
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
    f.innerHTML = `<b>${esc(b.navn)}</b> <i>Tip</i><span>${esc(b.tekst || 'Der er ingen forklaring endnu.')}</span>`;
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
        <label for="b_tekst">Forklaring</label><textarea id="b_tekst" rows="4"></textarea>
        <div id="arkfejl"></div>
        <div class="rakke"><button class="knap" type="button" data-tpid="fortryd" data-h="lukArk">Annuller</button><button class="knap primaer" data-tpid="gem" type="submit">Gem</button></div>
      </form>`);
    const form = $('#begrebform', d);
    $('.ark-bag', d).addEventListener('click', lukArk);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const navn = $('#b_navn').value.trim(), tekst = $('#b_tekst').value.trim();
      if (!navn || !tekst) { $('#arkfejl').innerHTML = '<div class="fejlboks">Skriv både ordet og en forklaring.</div>'; return; }
      try {
        const [ny] = await api('tips', { method: 'POST', body: { titel: navn, tekst } });
        if (!paaOpskrift) { lukArk(); toast('Gemt'); Hjaelper.glad(`Gemt! Nu kan man trykke på «${navn}» i opskrifter, hvor ordet står.`); return; }
        S.tips.push(ny);
        kendteBegreber = begreberAf(S.tips);
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
  // Sæt ind: lægger det kopierede i feltet med en retur efter, så næste link kan stå på en ny linje
  rydFelt(el) {
    const felt = $('#' + el.dataset.v);
    if (felt.value) { rydFoer[felt.id] = felt.value; const f = document.querySelector(`[data-h="fortrydRyd"][data-v="${felt.id}"]`); if (f) f.hidden = false; }
    felt.value = ''; lager.gem(felt.dataset.husk, ''); // ingen fokus, så tastaturet ikke kommer frem
  },
  fortrydRyd(el) { // sætter den ryddede tekst tilbage
    const felt = $('#' + el.dataset.v);
    if (rydFoer[felt.id] != null) { felt.value = rydFoer[felt.id]; lager.gem(felt.dataset.husk, felt.value); delete rydFoer[felt.id]; }
    el.hidden = true;
  },
  async saetInd(el) {
    const felt = $('#' + el.dataset.v), t = await laesUdklip();
    if (t === null) { fejlbesked('Appen må ikke læse udklipsholderen. Hold fingeren i feltet, og vælg «Sæt ind».'); return; }
    if (!t) { fejlbesked('Der er ikke noget i udklipsholderen. Kopiér teksten først, og tryk så på «Sæt ind».'); return; }
    const foer = felt.value, mellem = foer && !foer.endsWith('\n') ? '\n' : '';
    felt.value = foer + mellem + t + '\n';
    felt.dispatchEvent(new Event('input', { bubbles: true }));
    felt.focus(); felt.scrollTop = felt.scrollHeight;
  },
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
    ok ? toast('Beskeden er kopieret') : fejlbesked('Beskeden blev ikke kopieret. Tryk på knappen igen.');
  },
  async gemImport(el) {
    const svar = laesImport($('#claudesvar').value);
    if (svar.fejl) { $('#formfejl').innerHTML = `<div class="fejlboks">${esc(svar.fejl)}</div>`; return; }
    el.disabled = true;
    try {
      let alle = svar.liste || [svar];
      const antal = alle.length;
      let nu = []; try { nu = await api('opskrifter?select=id,titel'); } catch (e) { console.error(e); }
      const set = [], dubletter = [];
      for (const r of alle) {
        const o = findNavn(nu, r.data.titel) || findNavn(set, r.data.titel);
        if (o) dubletter.push({ ...o, titel: r.data.titel }); r.dublet = !!o;
        set.push({ id: null, titel: r.data.titel, ...(o && o.id ? { id: o.id } : {}) });
      }
      if (dubletter.length) {
        const v = await spoergDublet(dubletter, antal);
        if (!v) { el.disabled = false; return; }
        if (v === 'spring') alle = alle.filter(r => !r.dublet);
        if (!alle.length) { el.disabled = false; toast('Alle findes allerede'); return; }
      }
      let sidste;
      for (const r of alle) {
        [sidste] = await api('opskrifter', { method: 'POST', body: r.data });
        try { await Katalog.laeg(ingAf(r.data).map(i => i.n), {}, r.kat); } catch (e) { console.error(e); } // ingredienserne med Claudes kategorier
      }
      lager.gem('importEgen', ''); lager.gem('importSvar', ''); // opskriften er gemt, så felterne tømmes
      const flere = alle.length > 1;
      toast(flere ? `${alle.length} opskrifter er gemt` : 'Opskriften er gemt'); Hjaelper.glad(flere ? 'Opskrifterne er gemt!' : 'Opskriften er gemt!');
      location.hash = flere ? '#/opskrifter' : '#/opskrifter/' + sidste.id;
    } catch (err) { el.disabled = false; throw err; }
  },
  async eksport() {
    const tabeller = ['opskrifter', 'tips', 'favoritter', 'stjerner', 'laerred'], data = { hentet: new Date().toISOString() };
    for (const t of tabeller) data[t] = await api(`${t}?select=*`);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `kogebog-${data.hentet.slice(0, 10)}.json`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast('Sikkerhedskopien er hentet');
  }
};
document.addEventListener('input', e => { // teksten på «Tilføj med Claude» huskes, også hvis appen lukkes eller opdateres
  if (e.target.dataset && e.target.dataset.husk) lager.gem(e.target.dataset.husk, e.target.value);
});
function markerKat() { document.querySelectorAll('.katvalg .chip').forEach(c => { const f = $('#f_' + (c.dataset.f || 'kategori')); c.classList.toggle('valgt', !!f && c.dataset.v.toLowerCase() === f.value.trim().toLowerCase()); }); }
document.addEventListener('input', e => { if (e.target.id === 'f_kategori' || e.target.id === 'f_koekken') markerKat(); });
document.addEventListener('change', e => {
  if (e.target.matches('select[data-hs]') && H[e.target.dataset.hs]) H[e.target.dataset.hs](e.target);
  if (e.target.id === 'maks') saetMaks(e.target.value);
  if (e.target.id === 'udenkryd') { lager.gem('udenKrydderier', e.target.checked); tegnForslag(); }
  if (e.target.id === 'portinp') { S.port = Math.max(1, Math.min(50, Math.round(Number(e.target.value)) || S.r.portioner || 4)); portValg[S.r.id] = S.port; tegnIng(); }
});
document.addEventListener('click', e => { // «Importér»-menuen lukkes, når man trykker et andet sted
  document.querySelectorAll('details.tilfoej[open]').forEach(d => { if (!d.contains(e.target)) d.open = false; });
});
// ---------- Tastatur (Mac, og iPad med tastatur) ----------
// Escape lukker det øverste: menu, vindue, forklaring, Grydelil. / eller ⌘K søger. ⌘1–5 (eller ⌥1–5 i browseren) går til de fem steder.
// Trin for trin: → eller mellemrum er Næste, ← er Tilbage.
const skriverNu = el => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
const STEDER = ['#/opskrifter', '#/tips', '#/forslag', '#/forslag/madplan', '#/mere'];
function fokusSoeg(forsoeg = 0) {
  const s = $('#soeg');
  if (s) { s.focus(); s.select(); return; }
  if (forsoeg === 0 && !/^#\/(opskrifter|tips)$/.test(location.hash)) location.hash = /^#\/tips/.test(location.hash) ? '#/tips' : '#/opskrifter';
  if (forsoeg < 30) setTimeout(() => fokusSoeg(forsoeg + 1), 100);
}
document.addEventListener('keydown', e => {
  if (e.defaultPrevented || e.isComposing) return;
  const mod = e.metaKey || e.ctrlKey, el = document.activeElement;
  if (e.key === 'Escape') {
    const menu = document.querySelector('details.tilfoej[open]');
    if (menu) { menu.open = false; menu.querySelector('summary').focus(); return; }
    const a = $('#ark');
    if (a) { e.preventDefault(); const bag = a.querySelector('.ark-bag'); if (bag) bag.click(); else lukArk(); return; }
    if ($('.forklaring')) { lukForklaring(); return; }
    if (window.Hjaelper && Hjaelper.luk && Hjaelper.luk()) return;
    if (skriverNu(el) && !(el.type === 'search' && el.value)) el.blur();
    return;
  }
  if (e.key === 'Tab' && $('#ark')) { // Tab bliver i vinduet
    const f = [...$('#ark').querySelectorAll('.ark-kort a[href], .ark-kort button:not(:disabled), .ark-kort input:not([type=hidden]):not(:disabled), .ark-kort select, .ark-kort textarea')].filter(x => x.offsetParent);
    if (!f.length) return;
    const i = f.indexOf(el);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && (i === -1 || i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
    return;
  }
  if ($('#ark')) return;
  if ((mod && !e.altKey && e.key.toLowerCase() === 'k') || (e.key === '/' && !mod && !e.altKey && !skriverNu(el))) { e.preventDefault(); fokusSoeg(); return; }
  const nr = /^Digit[1-5]$/.test(e.code) ? Number(e.code.slice(5)) : 0;
  if (nr && !e.shiftKey && ((mod && !e.altKey) || (e.altKey && !mod)) && document.body.dataset.side !== 'lav') { e.preventDefault(); location.hash = STEDER[nr - 1]; return; }
  if (document.body.dataset.side === 'lav' && !mod && !e.altKey && !skriverNu(el)) {
    const paaKnap = el && el.matches && el.matches('button, a[href], summary, label');
    if (e.key === 'ArrowRight' || (e.key === ' ' && !paaKnap)) { const k = $('.lav-bund .primaer'); if (k) { e.preventDefault(); k.click(); } }
    else if (e.key === 'ArrowLeft') { const k = $('.lav-bund [data-v="-1"]'); if (k && !k.disabled) { e.preventDefault(); k.click(); } }
  }
});
document.addEventListener('click', async e => {
  const tb = e.target.closest('a.tilbage:not(.fortryd):not(.direkte)');
  if (tb) { // gå til den side, man kom fra. Rediger- og ny-sider springes over.
    let i = spor.length - 2;
    while (i >= 0 && (formSide(spor[i]) || spor[i] === spor[spor.length - 1])) i--;
    if (i >= 0) { e.preventDefault(); const mål = spor[i]; spor.length = i + 1; if (location.hash === mål) route(); else location.hash = mål; return; }
  }
  const el = e.target.closest('[data-h]');
  if (!el) { if (!e.target.closest('.forklaring')) lukForklaring(); return; }
  const f = H[el.dataset.h];
  if (!f) return;
  try { await f(el, e); }
  catch (err) { console.error(err); fejlbesked(err instanceof TypeError && /fetch|load|network/i.test(err.message) ? 'Der er ikke forbindelse til internettet. Tjek det, og tryk på knappen igen.' : 'Noget gik galt, og det blev ikke gemt. Tryk på knappen igen.'); }
});

// Notesbogens linjer: et net à 32 px, der starter, hvor indholdet i <main> starter. Så står alle rækker, felter og knapper på linjerne.
let rasterTimer;
function rasterIgen() {
  cancelAnimationFrame(rasterTimer);
  rasterTimer = requestAnimationFrame(() => {
    const main = document.querySelector('main'), rod = document.documentElement.style, R = RAEKKE();
    app.querySelectorAll('.laerred-ramme').forEach(el => { // rammen runder op til hele rækker, så resten af siden bliver på linjerne
      el.style.height = '';
      el.style.height = Math.ceil(el.getBoundingClientRect().height / R - 0.02) * R + 'px';
    });
    const m = main.getBoundingClientRect(), cs = getComputedStyle(main), y = m.top + scrollY + parseFloat(cs.paddingTop);
    rod.setProperty('--raster', (((Math.round(y) % R) + R) % R) + 'px');
    rod.setProperty('--kol-x', (m.left + scrollX + parseFloat(cs.paddingLeft)) + 'px'); // kolonnens venstre kant: den røde margen følger den
  });
}
new MutationObserver(rasterIgen).observe(app, { childList: true, subtree: true });
addEventListener('resize', rasterIgen);
if (window.ResizeObserver) { const ro = new ResizeObserver(rasterIgen); ['main', '#nav', '#ure'].forEach(q => ro.observe(document.querySelector(q))); }
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
// ---------- Tryk-område på mindst 48 px (kun touch) ----------
// Små knapper og felter (32 px) kan ikke gøres større uden at flytte rækkerne, så et tryk op til (48 − højde) / 2 over eller under dem rammer dem alligevel.
// Kun lodret, og kun hvis trykket ikke ligger på noget andet, så to naboer aldrig deler et tryk-område. Med mus og tastatur ændres intet.
const Tryk = {
  MIN: 48,
  KAND: 'a[href], button, [role=button], select, input:not([type=hidden]):not([type=checkbox]):not([type=radio])',
  AKTIV: 'a[href], button, input, select, textarea, label, summary, [role=button]',
  find(x, y) {
    let bedst = null, afst = Infinity, lige = false;
    for (const el of document.querySelectorAll(Tryk.KAND)) {
      if (el.classList.contains('plads') || el.disabled || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true }))) continue;
      const r = el.getBoundingClientRect();
      if (r.height >= Tryk.MIN || r.width === 0 || x < r.left || x > r.right) continue;
      const d = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      if (d <= 0 || d > (Tryk.MIN - r.height) / 2) continue;
      if (d < afst) { bedst = el; afst = d; lige = false; } else if (d === afst) lige = true;
    }
    return lige ? null : bedst;
  }
};
document.addEventListener('click', e => {
  if (!e.isTrusted || e.detail === 0 || !matchMedia('(pointer: coarse)').matches) return;
  if (e.target.closest && e.target.closest(Tryk.AKTIV)) return;
  const m = Tryk.find(e.clientX, e.clientY);
  if (!m) return;
  e.preventDefault(); e.stopPropagation();
  if (m.matches('input, select')) m.focus(); else m.click();
}, true);
document.addEventListener('DOMContentLoaded', () => { Hjaelper.start(); route(); });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js?v=' + (window.KOGEBOG ? KOGEBOG.version : '')).catch(() => {});

// Genindlæs-knappen foroven: tømmer den gemte kopi og henter siden forfra, så et nyt push ses uden at lukke appen
document.addEventListener('click', async e => {
  if (!e.target.closest('#genstart')) return;
  try { if (window.caches) for (const k of await caches.keys()) await caches.delete(k); } catch (err) { /* ingen gemt kopi */ }
  try { if (navigator.serviceWorker) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); } catch (err) { /* ingen service worker */ }
  location.reload();
});
