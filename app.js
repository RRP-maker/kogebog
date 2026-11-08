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
    visSide('side-opskrifter');
  } else if (dele[1] === 'opskrift' && dele.length === 3) {
    visOpskrift(decodeURIComponent(dele[2]));
  } else if (hash === '/ordforraad') {
    visSide('side-ordforraad');
  } else if (hash === '/tips') {
    visSide('side-tips');
  } else {
    visSide('side-forside');
  }
}

function visOpskrift(id) {
  const opskrifter = JSON.parse(localStorage.getItem('opskrifter') || '[]');
  const opskrift = opskrifter.find(function (o) { return String(o.id) === id; });
  document.getElementById('opskrift-titel').textContent = opskrift ? opskrift.titel : '';
  document.getElementById('opskrift-tekst').textContent = opskrift ? (opskrift.beskrivelse || '') : 'Opskriften findes ikke';
  visSide('side-opskrift');
}

window.addEventListener('hashchange', route);
route();
