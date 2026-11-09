const API = SUPABASE_URL + '/rest/v1/';
const app = document.getElementById('app');
let visning = 0; // tæller sider, så et langsomt svar ikke overskriver en nyere side

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const enc = encodeURIComponent;

// ---------- Supabase (REST, ingen pakker) ----------
async function api(sti, { method = 'GET', body } = {}) {
  const headers = { apikey: SUPABASE_ANON_KEY };
  if (body) headers['Content-Type'] = 'application/json';
  if (method === 'POST' || method === 'PATCH') headers.Prefer = 'return=representation';
  const res = await fetch(API + sti, {
    method, headers, cache: 'no-store', body: body && JSON.stringify(body)
  });
  if (!res.ok) throw new Error(res.status + ' ' + await res.text());
  return method === 'DELETE' ? null : res.json();
}

// ---------- Typer ----------
const TYPER = {
  opskrifter: {
    navn: 'Opskrifter', ny: 'Ny opskrift', rediger: 'Rediger opskrift',
    tom: 'Du har ingen opskrifter endnu. Tryk på «Ny opskrift» for at oprette den første.',
    bekraeft: 'Slet opskriften? Tips til opskriften bliver også slettet, og det kan ikke fortrydes.',
    slettet: 'Opskriften er slettet',
    felter: [
      { n: 'titel', l: 'Titel', t: 'text', kraevet: true },
      { n: 'beskrivelse', l: 'Kort beskrivelse', t: 'textarea', rows: 3 },
      { n: 'kategori', l: 'Kategori', t: 'text', hint: 'Fx Aftensmad, Dessert eller Brød' },
      { n: 'portioner', l: 'Antal portioner', t: 'number' },
      { n: 'tid_minutter', l: 'Tid i minutter', t: 'number' },
      { n: 'ingredienser', l: 'Ingredienser', t: 'liste', hint: 'Skriv én ingrediens på hver linje' },
      { n: 'fremgangsmaade', l: 'Fremgangsmåde', t: 'textarea', rows: 8 }
    ]
  },
  metoder: {
    navn: 'Metoder', ny: 'Ny metode', rediger: 'Rediger metode',
    tom: 'Du har ingen metoder endnu. En metode er en teknik, fx hvordan man steger kød eller laver en roux.',
    bekraeft: 'Slet metoden? Det kan ikke fortrydes.', slettet: 'Metoden er slettet',
    felter: [
      { n: 'titel', l: 'Titel', t: 'text', kraevet: true },
      { n: 'beskrivelse', l: 'Kort beskrivelse', t: 'textarea', rows: 3 },
      { n: 'trin', l: 'Sådan gør du', t: 'textarea', rows: 8 }
    ]
  },
  tips: {
    navn: 'Tips', ny: 'Nyt tip', rediger: 'Rediger tip',
    tom: 'Du har ingen tips endnu. Tryk på «Nyt tip», og skriv fx en lille genvej eller en erfaring.',
    bekraeft: 'Slet dette tip? Det kan ikke fortrydes.', slettet: 'Tippet er slettet',
    felter: [
      { n: 'tekst', l: 'Tip', t: 'textarea', rows: 5, kraevet: true },
      { n: 'opskrift_id', l: 'Hører til opskrift', t: 'opskrift', hint: 'Valgfrit. Tippet vises så på opskriftens side.' }
    ]
  }
};

// ---------- Hjælpere ----------
let tt;
function toast(tekst) {
  const el = document.getElementById('toast');
  el.textContent = tekst; el.classList.add('vis');
  clearTimeout(tt); tt = setTimeout(() => el.classList.remove('vis'), 2200);
}
const info = t => { app.innerHTML = `<p class="tomt">${t}</p>`; };
function fejl(e) {
  console.error(e);
  app.innerHTML = `<div class="fejlboks">Hov, noget gik galt. Tjek din internetforbindelse, og prøv igen.</div>
    <button class="knap" data-igen>Prøv igen</button>`;
}
function chips(r) {
  return [
    r.kategori,
    r.portioner && r.portioner + (r.portioner === 1 ? ' portion' : ' portioner'),
    r.tid_minutter && r.tid_minutter + ' min'
  ].filter(Boolean);
}
const knapper = (type, id) => `<div class="rakke">
  <a class="knap" href="#/${type}/${id}/rediger">Rediger</a>
  <button class="knap fare" data-slet="${type}:${id}">Slet</button></div>`;

// ---------- Router ----------
async function route() {
  visning++;
  window.scrollTo(0, 0);
  const [type, a, b] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  try {
    if (!TYPER[type]) return forside();
    if (!a || (type === 'tips' && a !== 'ny' && b !== 'rediger')) return await liste(type);
    if (a === 'ny') return await formular(type);
    if (b === 'rediger') return await formular(type, a);
    return await detalje(type, a);
  } catch (e) { fejl(e); }
}
window.addEventListener('hashchange', route);

// ---------- Forside ----------
function forside() {
  app.innerHTML = `<h1>Hvad vil du lave?</h1>
    <nav class="knapper">
      <a class="stor" href="#/opskrifter"><span>🍲</span>Opskrifter</a>
      <a class="stor" href="#/metoder"><span>🔪</span>Metode</a>
      <a class="stor" href="#/tips"><span>💡</span>Tips</a>
    </nav>`;
}

// ---------- Liste ----------
async function liste(type) {
  const id = visning, T = TYPER[type];
  info('Henter…');
  const [rader, opskrifter] = await Promise.all([
    api(`${type}?select=*&order=oprettet.desc`),
    type === 'tips' ? api('opskrifter?select=id,titel') : []
  ]);
  if (id !== visning) return;
  const navne = Object.fromEntries(opskrifter.map(o => [o.id, o.titel]));
  app.innerHTML = `<a class="tilbage" href="#/">← Forside</a>
    <h1>${T.navn}</h1>
    <a class="knap primaer" href="#/${type}/ny">+ ${T.ny}</a>
    <div style="margin-top:16px">${rader.length ? rader.map(r => kort(type, r, navne)).join('') : `<p class="tomt">${T.tom}</p>`}</div>`;
}
function kort(type, r, navne) {
  if (type === 'tips') {
    const til = navne[r.opskrift_id];
    return `<article class="kort"><p>${esc(r.tekst)}</p>
      ${til ? `<p class="lille">Til: <a href="#/opskrifter/${r.opskrift_id}">${esc(til)}</a></p>` : ''}
      ${knapper('tips', r.id)}</article>`;
  }
  const under = type === 'opskrifter' ? chips(r).join(' · ') : (r.beskrivelse || '');
  return `<a class="kort" href="#/${type}/${r.id}"><strong>${esc(r.titel)}</strong>${under ? `<span>${esc(under)}</span>` : ''}</a>`;
}

// ---------- Side (opskrift / metode) ----------
async function detalje(type, rid) {
  const id = visning, T = TYPER[type];
  info('Henter…');
  const [r] = await api(`${type}?id=eq.${enc(rid)}&select=*`);
  if (!r) return info(`Vi kunne ikke finde den. <br><a href="#/${type}">Tilbage til ${T.navn.toLowerCase()}</a>`);
  const tips = type === 'opskrifter'
    ? await api(`tips?opskrift_id=eq.${enc(rid)}&select=*&order=oprettet.desc`) : [];
  if (id !== visning) return;

  let h = `<a class="tilbage" href="#/${type}">← ${T.navn}</a><h1>${esc(r.titel)}</h1>`;
  if (type === 'opskrifter') {
    const c = chips(r);
    if (c.length) h += `<p class="chips">${c.map(x => `<span>${esc(x)}</span>`).join('')}</p>`;
    if (r.beskrivelse) h += `<p class="tekst">${esc(r.beskrivelse)}</p>`;
    const ing = Array.isArray(r.ingredienser) ? r.ingredienser : [];
    h += '<h2>Ingredienser</h2>' + (ing.length
      ? `<ul class="ing">${ing.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`
      : '<p class="lille">Ingen ingredienser endnu. Tryk på «Rediger» for at tilføje dem.</p>');
    h += '<h2>Fremgangsmåde</h2>' + (r.fremgangsmaade
      ? `<p class="tekst">${esc(r.fremgangsmaade)}</p>`
      : '<p class="lille">Ingen fremgangsmåde endnu.</p>');
    h += '<h2>Tips</h2>' + (tips.length
      ? tips.map(t => `<div class="kort"><p>${esc(t.tekst)}</p></div>`).join('')
      : '<p class="lille">Ingen tips til denne opskrift endnu. Du kan oprette et under Tips.</p>');
  } else {
    if (r.beskrivelse) h += `<p class="tekst">${esc(r.beskrivelse)}</p>`;
    h += '<h2>Sådan gør du</h2>' + (r.trin
      ? `<p class="tekst">${esc(r.trin)}</p>` : '<p class="lille">Ingen trin endnu.</p>');
  }
  app.innerHTML = h + knapper(type, r.id);
}

// ---------- Formular (opret / rediger) ----------
function felt(f, rad, opskrifter) {
  const v = rad[f.n];
  const m = `id="f_${f.n}" name="${f.n}"` + (f.kraevet ? ' required' : '');
  let input;
  if (f.t === 'textarea') input = `<textarea ${m} rows="${f.rows || 4}">${esc(v)}</textarea>`;
  else if (f.t === 'liste') input = `<textarea ${m} rows="6">${esc(Array.isArray(v) ? v.join('\n') : '')}</textarea>`;
  else if (f.t === 'number') input = `<input ${m} type="number" inputmode="numeric" min="0" step="1" value="${esc(v)}">`;
  else if (f.t === 'opskrift') input = `<select ${m}><option value="">Ingen bestemt opskrift</option>${
    opskrifter.map(o => `<option value="${o.id}"${o.id === v ? ' selected' : ''}>${esc(o.titel)}</option>`).join('')}</select>`;
  else input = `<input ${m} type="text" value="${esc(v)}">`;
  return `<label for="f_${f.n}">${f.l}${f.kraevet ? '' : ' <span>(valgfri)</span>'}</label>
    ${f.hint ? `<small>${f.hint}</small>` : ''}${input}`;
}

async function formular(type, rid) {
  const id = visning, T = TYPER[type];
  info('Henter…');
  const [r, opskrifter] = await Promise.all([
    rid ? api(`${type}?id=eq.${enc(rid)}&select=*`) : [],
    type === 'tips' ? api('opskrifter?select=id,titel&order=titel') : []
  ]);
  if (id !== visning) return;
  if (rid && !r[0]) return info(`Vi kunne ikke finde den. <br><a href="#/${type}">Tilbage</a>`);
  const rad = r[0] || {};

  const tilbage = rid && type !== 'tips' ? `#/${type}/${rid}` : `#/${type}`;
  app.innerHTML = `<a class="tilbage" href="${tilbage}">← Annuller</a>
    <h1>${rid ? T.rediger : T.ny}</h1>
    <form id="form" novalidate>
      ${T.felter.map(f => felt(f, rad, opskrifter)).join('')}
      <div id="formfejl"></div>
      <button class="knap primaer" type="submit">Gem</button>
    </form>`;

  const form = document.getElementById('form');
  const visFejl = tekst => { document.getElementById('formfejl').innerHTML = `<div class="fejlboks">${tekst}</div>`; };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = {};
    for (const f of T.felter) {
      const el = form.elements[f.n], v = el.value.trim();
      if (f.kraevet && !v) { visFejl(`Udfyld feltet «${f.l}».`); el.focus(); return; }
      if (f.t === 'liste') data[f.n] = v.split('\n').map(s => s.trim()).filter(Boolean);
      else if (f.t === 'number') {
        const n = v === '' ? null : Number(v);
        if (n !== null && !(Number.isInteger(n) && n >= 0)) { visFejl(`«${f.l}» skal være et helt tal, fx 4.`); el.focus(); return; }
        data[f.n] = n;
      } else data[f.n] = v === '' ? null : v;
    }
    const knap = form.querySelector('button');
    knap.disabled = true; knap.textContent = 'Gemmer…';
    try {
      const res = rid
        ? await api(`${type}?id=eq.${enc(rid)}`, { method: 'PATCH', body: data })
        : await api(type, { method: 'POST', body: data });
      toast('Gemt');
      location.hash = type === 'tips' ? '#/tips' : `#/${type}/${rid || res[0].id}`;
    } catch (err) {
      console.error(err);
      visFejl('Det kunne ikke gemmes. Tjek din internetforbindelse, og prøv igen.');
      knap.disabled = false; knap.textContent = 'Gem';
    }
  });
}

// ---------- Klik: slet med bekræftelse, prøv igen ----------
app.addEventListener('click', async e => {
  if (e.target.closest('[data-igen]')) return route();
  const b = e.target.closest('[data-slet]');
  if (!b) return;
  const [type, id] = b.dataset.slet.split(':');
  if (!confirm(TYPER[type].bekraeft)) return;
  b.disabled = true;
  try {
    await api(`${type}?id=eq.${enc(id)}`, { method: 'DELETE' });
    toast(TYPER[type].slettet);
    if (location.hash === '#/' + type) route(); else location.hash = '#/' + type;
  } catch (err) {
    console.error(err); b.disabled = false;
    toast('Kunne ikke slettes. Prøv igen.');
  }
});

route();
