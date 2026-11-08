// Viser præcis én side ad gangen ud fra hashen
function visSide(id) {
  document.querySelectorAll('.side').forEach(function (side) {
    side.classList.toggle('aktiv', side.id === id);
  });
}

function route() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const dele = hash.split('/'); // "/opskrift/5" -> ["", "opskrift", "5"]

  if (hash === '/opskrifter') {
    visListe('opskrifter');
  } else if (dele[1] === 'opskrift' && dele.length === 3) {
    visOpskrift(decodeURIComponent(dele[2]));
  } else if (hash === '/ordforraad') {
    visListe('ordforraad');
  } else if (hash === '/tips') {
    visListe('tips');
  } else {
    visSide('side-forside');
  }
}

function visOpskrift(id) {
  const opskrifter = hent('opskrifter');
  const opskrift = opskrifter.find(function (o) { return String(o.id) === id; });
  document.getElementById('opskrift-titel').textContent = opskrift ? opskrift.titel : '';
  document.getElementById('opskrift-tekst').textContent = opskrift ? (opskrift.ingredienser || '') + '\n\n' + (opskrift.fremgang || '') : 'Opskriften findes ikke';
  visSide('side-opskrift');
}

// ---- Datalag (localStorage, hver nøgle er et JSON-array) ----
const NOEGLER = ['opskrifter', 'ordforraad', 'tips'];

function hent(noegle) {
  try {
    const data = JSON.parse(localStorage.getItem(noegle) || '[]');
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function gem(noegle, liste) {
  localStorage.setItem(noegle, JSON.stringify(liste));
}

function nytId() {
  return Date.now().toString(36);
}

function gemPost(noegle, post) {
  const liste = hent(noegle);
  const i = liste.findIndex(function (p) { return p.id === post.id; });
  if (i === -1) liste.push(post); else liste[i] = post;
  gem(noegle, liste);
}

function sletPost(noegle, id) {
  gem(noegle, hent(noegle).filter(function (p) { return p.id !== id; }));
}

// ---- Typer: hvilke felter hver liste har ----
const TITEL = { navn: 'titel', label: 'Titel', type: 'tekst' };
const BESKRIVELSE = { navn: 'beskrivelse', label: 'Beskrivelse', type: 'tekstomraade' };
const ALIAS = { navn: 'alias', label: 'Alias (komma-separeret)', type: 'liste' };

const TYPER = {
  opskrifter: {
    side: 'side-opskrifter',
    felter: [
      TITEL,
      { navn: 'ingredienser', label: 'Ingredienser (én pr. linje)', type: 'tekstomraade' },
      { navn: 'fremgang', label: 'Fremgangsmåde', type: 'tekstomraade' }
    ]
  },
  ordforraad: { side: 'side-ordforraad', felter: [TITEL, BESKRIVELSE, ALIAS] },
  tips: { side: 'side-tips', felter: [TITEL, BESKRIVELSE, ALIAS] }
};

// ---- Listesider og formularer ----
function lavKnap(tekst, onClick) {
  const knap = document.createElement('button');
  knap.type = 'button';
  knap.className = 'lille-knap';
  knap.textContent = tekst;
  knap.addEventListener('click', onClick);
  return knap;
}

function hentBoks(noegle) {
  const side = document.getElementById(TYPER[noegle].side);
  let boks = side.querySelector('.indhold');
  if (!boks) {
    boks = document.createElement('div');
    boks.className = 'indhold';
    side.appendChild(boks);
  }
  boks.replaceChildren();
  return boks;
}

function visListe(noegle) {
  const boks = hentBoks(noegle);
  boks.appendChild(lavKnap('Ny', function () { visFormular(noegle, null); }));

  hent(noegle).forEach(function (post) {
    const kort = document.createElement('div');
    kort.className = 'kort';

    let titel;
    if (noegle === 'opskrifter') {
      titel = document.createElement('a');
      titel.href = '#/opskrift/' + encodeURIComponent(post.id);
    } else {
      titel = document.createElement('strong');
    }
    titel.className = 'kort-titel';
    titel.textContent = post.titel;
    kort.appendChild(titel);

    if (post.beskrivelse) {
      const tekst = document.createElement('p');
      tekst.textContent = post.beskrivelse;
      kort.appendChild(tekst);
    }

    const raekke = document.createElement('div');
    raekke.className = 'raekke';
    raekke.appendChild(lavKnap('Rediger', function () { visFormular(noegle, post); }));
    raekke.appendChild(lavKnap('Slet', function () {
      if (confirm('Slet "' + post.titel + '"?')) {
        sletPost(noegle, post.id);
        visListe(noegle);
      }
    }));
    kort.appendChild(raekke);
    boks.appendChild(kort);
  });

  visSide(TYPER[noegle].side);
}

function visFormular(noegle, post) {
  const boks = hentBoks(noegle);
  const form = document.createElement('form');
  form.className = 'formular';
  const felter = {};

  TYPER[noegle].felter.forEach(function (felt) {
    const label = document.createElement('label');
    label.textContent = felt.label;
    const input = document.createElement(felt.type === 'tekstomraade' ? 'textarea' : 'input');
    if (felt.type === 'tekstomraade') input.rows = 6;
    if (felt.navn === 'titel') input.required = true;
    const vaerdi = post ? post[felt.navn] : '';
    input.value = felt.type === 'liste' ? (vaerdi || []).join(', ') : (vaerdi || '');
    label.appendChild(input);
    form.appendChild(label);
    felter[felt.navn] = input;
  });

  const raekke = document.createElement('div');
  raekke.className = 'raekke';
  const gemKnap = lavKnap('Gem', function () {});
  gemKnap.type = 'submit';
  raekke.appendChild(gemKnap);
  raekke.appendChild(lavKnap('Annullér', function () { visListe(noegle); }));
  form.appendChild(raekke);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const ny = { id: post ? post.id : nytId() };
    TYPER[noegle].felter.forEach(function (felt) {
      const vaerdi = felter[felt.navn].value;
      ny[felt.navn] = felt.type === 'liste'
        ? vaerdi.split(',').map(function (s) { return s.trim(); }).filter(Boolean)
        : vaerdi.trim();
    });
    gemPost(noegle, ny);
    visListe(noegle);
  });

  boks.appendChild(form);
}

// ---- Eksport og import af data.json ----
function eksporter() {
  const data = {};
  NOEGLER.forEach(function (n) { data[n] = hent(n); });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'data.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

function importer(fil) {
  const laeser = new FileReader();
  laeser.onload = function () {
    let data = null;
    try { data = JSON.parse(laeser.result); } catch (e) { /* ugyldig JSON */ }
    if (!data || !NOEGLER.every(function (n) { return Array.isArray(data[n]); })) {
      alert('Filen er ikke en gyldig data.json');
      return;
    }
    if (!confirm('Importér og erstat alle nuværende data?')) return;
    NOEGLER.forEach(function (n) { gem(n, data[n]); });
  };
  laeser.readAsText(fil);
}

function byggDataKnapper() {
  const raekke = document.createElement('div');
  raekke.className = 'raekke';
  const filvaelger = document.createElement('input');
  filvaelger.type = 'file';
  filvaelger.accept = 'application/json,.json';
  filvaelger.hidden = true;
  filvaelger.addEventListener('change', function () {
    if (filvaelger.files[0]) importer(filvaelger.files[0]);
    filvaelger.value = '';
  });
  raekke.appendChild(lavKnap('Eksportér', eksporter));
  raekke.appendChild(lavKnap('Importér', function () { filvaelger.click(); }));
  raekke.appendChild(filvaelger);
  document.getElementById('side-forside').appendChild(raekke);
}

byggDataKnapper();
window.addEventListener('hashchange', route);
route();
