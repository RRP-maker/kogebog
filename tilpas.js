// Tilpas tekster: når det er slået til, kan man trykke på en knap eller overskrift og ændre teksten og skriftstørrelsen.
// Ændringen gælder alle steder, hvor den samme tekst står, og gemmes på denne enhed.
const Tilpas = (() => {
  const VALG = '.knap, .tilbage, .fane, .logo, main h1, main h2';
  const STR = [[0.85, 'Lille'], [1, 'Normal'], [1.2, 'Stor'], [1.45, 'Størst']];
  let til = lager.hent('tilpasTil', false), timer;
  const noder = el => [...el.childNodes].filter(n => n.nodeType === 3 && n.nodeValue.trim());
  const tekstAf = el => noder(el).map(n => n.nodeValue.trim()).join(' ');
  // Kun faste tekster kan ændres: ikke opskrifternes navne, tal og ure
  const egnet = (el, k) => k && !/\d/.test(k) && !el.closest('#ark, #tilpas-bar, .titelrakke, .h-boble');

  function anvend() {
    document.body.classList.toggle('tilpas', til);
    const data = lager.hent('tilpas', {});
    document.querySelectorAll(VALG).forEach(el => {
      const k = el.dataset.org ?? tekstAf(el);
      if (!egnet(el, k)) return;
      el.dataset.org = k;
      const o = data[k] || {}, ny = o.t || k, n = noder(el);
      if (n.length && tekstAf(el) !== ny) { n[0].nodeValue = ny; n.slice(1).forEach(x => { x.nodeValue = ''; }); }
      if (!el.dataset.fs) el.dataset.fs = parseFloat(getComputedStyle(el).fontSize);
      el.style.fontSize = o.s ? (el.dataset.fs * o.s) + 'px' : '';
    });
    bjaelke();
  }
  function bjaelke() {
    let b = document.getElementById('tilpas-bar');
    if (til && !b) {
      b = document.createElement('div'); b.id = 'tilpas-bar';
      b.innerHTML = '<span>Tryk på en tekst for at ændre den.</span><button class="knap" type="button">Færdig</button>';
      b.querySelector('button').addEventListener('click', () => saet(false));
      document.body.append(b);
    } else if (!til && b) b.remove();
  }
  function saet(v) {
    til = !!v; lager.gem('tilpasTil', til); anvend();
    const c = document.getElementById('tilpastil'); if (c) c.checked = til;
  }
  function aabn(el) {
    const k = el.dataset.org, o = lager.hent('tilpas', {})[k] || {};
    let st = o.s || 1;
    const d = ark(`<h2>Ret tekst</h2>
      <label for="tp-tekst">Tekst</label>
      <input type="text" id="tp-tekst" value="${esc(o.t || k)}" maxlength="40" autocomplete="off">
      <label>Størrelse</label>
      <div class="rakke venstre">${STR.map(([v, n]) => `<button class="chip${v === st ? ' valgt' : ''}" type="button" data-st="${v}">${n}</button>`).join('')}</div>
      <p class="lille">Ændringen gælder alle steder, hvor «${esc(k)}» står.</p>
      <div class="rakke"><button class="knap fare" type="button" data-tp="nulstil">Nulstil</button><button class="knap primaer" type="button" data-tp="gem">Gem</button></div>`);
    d.addEventListener('click', e => {
      const s = e.target.closest('[data-st]'), a = e.target.closest('[data-tp]');
      if (s) { st = Number(s.dataset.st); d.querySelectorAll('[data-st]').forEach(x => x.classList.toggle('valgt', x === s)); return; }
      if (e.target.closest('.ark-bag')) return lukArk();
      if (!a) return;
      const data = lager.hent('tilpas', {});
      if (a.dataset.tp === 'nulstil') delete data[k];
      else {
        const t = $('#tp-tekst', d).value.trim(), ny = {};
        if (t && t !== k) ny.t = t;
        if (st !== 1) ny.s = st;
        if (Object.keys(ny).length) data[k] = ny; else delete data[k];
      }
      lager.gem('tilpas', data); lukArk(); anvend(); toast('Gemt');
    });
    setTimeout(() => $('#tp-tekst', d).select(), 50);
  }
  // I tilpas-tilstand åbner et tryk på en tekst i stedet for at gøre det, knappen plejer
  document.addEventListener('click', e => {
    if (!til) return;
    const el = e.target.closest('[data-org]');
    if (!el) return;
    e.preventDefault(); e.stopPropagation(); aabn(el);
  }, true);
  const igen = () => { cancelAnimationFrame(timer); timer = requestAnimationFrame(anvend); };
  new MutationObserver(igen).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', anvend);
  return { saet, til: () => til, nulstil() { lager.gem('tilpas', {}); anvend(); } };
})();
