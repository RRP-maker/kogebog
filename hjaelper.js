// Hjælperen Grydelil: en frisk lille gryde med skæve bryn, hvor låget er munden. Har en grydeske. Tegnet til Kogebog.
// Lyd: små toner lavet i browseren, ingen lydfiler.
const Lyd = (() => {
  let ctx;
  const til = () => lager.hent('lyd', true);
  function tone(frekvens, start, laengde, styrke = 0.12) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = frekvens;
    g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
    g.gain.exponentialRampToValueAtTime(styrke, ctx.currentTime + start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + laengde);
    o.connect(g).connect(ctx.destination);
    o.start(ctx.currentTime + start); o.stop(ctx.currentTime + start + laengde + 0.05);
  }
  function spil(navn) {
    if (!til()) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      if (navn === 'glad') { tone(660, 0, 0.12); tone(880, 0.1, 0.12); tone(1320, 0.2, 0.2); }
      else if (navn === 'ur') { for (let i = 0; i < 3; i++) { tone(988, i * 0.5, 0.18, 0.2); tone(1319, i * 0.5 + 0.18, 0.25, 0.2); } }
      else tone(740, 0, 0.1);
    } catch (e) { /* lyd er ikke vigtig */ }
  }
  return { spil, til, saet: v => lager.gem('lyd', v) };
})();

const Hjaelper = (() => {
  const SVG = `<svg viewBox="0 0 120 130" aria-hidden="true">
    <ellipse class="h-skygge" cx="60" cy="123" rx="34" ry="5"/>
    <g class="h-krop">
      <g class="h-pegearm">
        <path class="h-arm" d="M26 82 Q12 72 14 54"/>
        <rect class="h-skaft" x="11" y="24" width="6" height="34" rx="3"/>
        <ellipse class="h-skeblad" cx="14" cy="17" rx="8.5" ry="11"/>
      </g>
      <path class="h-arm" d="M95 82 Q109 86 106 99"/>
      <circle class="h-haand" cx="106" cy="100" r="4.5"/>
      <ellipse class="h-fod" cx="44" cy="118" rx="11" ry="5.5"/>
      <ellipse class="h-fod" cx="76" cy="118" rx="11" ry="5.5"/>
      <path class="h-potte" d="M22 62h76v30a24 24 0 0 1-24 24H46a24 24 0 0 1-24-24z"/>
      <g class="h-plaster" transform="rotate(-18 76 94)"><rect x="66" y="90" width="20" height="9" rx="4.5"/><circle cx="73" cy="94.5" r="1"/><circle cx="79" cy="94.5" r="1"/></g>
      <rect class="h-rand" x="16" y="56" width="88" height="11" rx="5.5"/>
      <path class="h-indre" d="M18 57H103L102.5 50L21.5 36z"/>
      <path class="h-tunge" d="M60 53a8 8 0 0 1 16 0v11a8 8 0 0 1-16 0z"/>
      <path class="h-tungestreg" d="M68 60v7"/>
      <g class="h-laag">
        <path class="h-kuppel" d="M20 59C20 28 100 28 100 59z"/>
        <path class="h-hanekam" d="M58 33c-5-5-3-11 3-11"/>
        <g class="h-ojne">
          <g class="h-oje"><circle class="h-hvid" cx="45" cy="44" r="9.5"/><g class="h-pupil" style="transform-origin:45px 44px"><circle class="h-sort" cx="45" cy="48" r="4.5"/><circle class="h-blink" cx="46.6" cy="46.4" r="1.5"/></g></g>
          <g class="h-oje"><circle class="h-hvid" cx="75" cy="44" r="9.5"/><g class="h-pupil h-pupil2" style="transform-origin:75px 44px"><circle class="h-sort" cx="75" cy="48" r="4.5"/><circle class="h-blink" cx="76.6" cy="46.4" r="1.5"/></g></g>
        </g>
        <path class="h-bryn" d="M35 34.5L54 37M86 30L66 36"/>
        <rect class="h-laaglaebe" x="18" y="56" width="84" height="6" rx="3"/>
        <path class="h-tand" d="M44 59h7v8h-5.5a1.5 1.5 0 0 1-1.5-1.5z"/>
      </g>
      <g class="h-glimt"><path d="M104 30l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/></g>
    </g>
  </svg>`;

  let rod, figur, boble, tekst, knapEl, visKnap;
  let koe = [], aktiv = null, skrivTimer, ventTimer, sideTekst = '';
  const skjult = () => lager.hent('hjaelper_skjult', false);

  function byg() {
    rod = document.createElement('div');
    rod.id = 'hjaelper';
    rod.innerHTML = `<div class="h-boble" hidden><p></p><button class="h-knap" type="button" hidden></button><span class="h-videre">Tryk for at fortsætte</span></div>
      <button class="h-figur" type="button" aria-label="Hjælperen. Tryk for hjælp.">${SVG}</button>
      <button class="h-skjul" type="button" aria-label="Skjul hjælperen">×</button>`;
    visKnap = document.createElement('button');
    visKnap.id = 'hjaelper-vis'; visKnap.type = 'button';
    visKnap.textContent = 'Vis hjælper';
    document.body.append(rod, visKnap);
    figur = rod.querySelector('.h-figur'); boble = rod.querySelector('.h-boble'); tekst = boble.querySelector('p'); knapEl = boble.querySelector('.h-knap');
    knapEl.addEventListener('click', e => { e.stopPropagation(); const k = aktiv && aktiv.knap; if (!k) return; stop(); if (k.href) location.hash = k.href; });
    figur.addEventListener('click', () => { if (aktiv) videre(); else if (sideTekst) sig(sideTekst); });
    boble.addEventListener('click', videre);
    rod.querySelector('.h-skjul').addEventListener('click', () => vis(false));
    visKnap.addEventListener('click', () => { vis(true); sig('Hej igen! Tryk på mig, hvis du vil have hjælp.'); });
    saetTilstand('hvile'); opdater();
  }
  function opdater() { rod.hidden = skjult(); visKnap.hidden = !skjult(); }
  function vis(ja) {
    lager.gem('hjaelper_skjult', !ja);
    if (!ja) { koe = []; stop(); }
    opdater();
  }
  function saetTilstand(t) { rod.dataset.tilstand = t; }

  function stop() {
    clearInterval(skrivTimer); clearTimeout(ventTimer);
    if (aktiv && aktiv.peg) aktiv.peg.classList.remove('udpeget');
    aktiv = null; boble.hidden = true; saetTilstand('hvile');
  }
  function naeste() {
    stop();
    const n = koe.shift();
    if (!n) return;
    aktiv = n; aktiv.faerdig = false;
    boble.hidden = false; tekst.textContent = '';
    knapEl.hidden = true;
    boble.classList.toggle('flere', koe.length > 0);
    boble.classList.toggle('stor', !!n.stor);
    if (n.peg && document.contains(n.peg)) {
      const m = n.peg.getBoundingClientRect(), f = figur.getBoundingClientRect();
      const dx = (m.left + m.width / 2) - (f.left + f.width * 0.22), dy = (m.top + m.height / 2) - (f.top + f.height * 0.63);
      const v = Math.max(-150, Math.min(60, Math.atan2(dx, -dy) * 180 / Math.PI));
      rod.style.setProperty('--vinkel', (v + 10) + 'deg');
      n.peg.classList.add('udpeget');
    }
    const tale = () => saetTilstand(n.peg ? 'peg' : 'tale');
    if (n.glad) { saetTilstand('glad'); Lyd.spil('glad'); setTimeout(() => { if (aktiv === n && !n.faerdig) tale(); }, 1100); }
    else tale();
    let i = 0;
    const rolig = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const skridt = rolig ? n.tekst.length : Math.max(1, Math.ceil(n.tekst.length / 120));
    skrivTimer = setInterval(() => {
      i += skridt; tekst.textContent = n.tekst.slice(0, i);
      if (i >= n.tekst.length) faerdigSkrevet();
    }, 28);
  }
  function faerdigSkrevet() {
    if (!aktiv) return;
    clearInterval(skrivTimer);
    tekst.textContent = aktiv.tekst; aktiv.faerdig = true;
    if (rod.dataset.tilstand !== 'glad') saetTilstand(aktiv.peg ? 'pegstille' : 'hvile');
    else setTimeout(() => { if (aktiv && aktiv.faerdig) saetTilstand(aktiv.peg ? 'pegstille' : 'hvile'); }, 1100);
    if (aktiv.knap) { knapEl.textContent = aktiv.knap.tekst; knapEl.hidden = false; return; } // med knap bliver boblen stående
    ventTimer = setTimeout(naeste, 2600 + aktiv.tekst.length * 55);
  }
  function videre() { if (!aktiv) return; if (!aktiv.faerdig) faerdigSkrevet(); else naeste(); }

  // sig('tekst', { peg: element, glad: true, nu: true, stor: true, knap: { tekst, href } })
  function sig(t, valg = {}) {
    if (!rod || skjult() || !t) return;
    if (valg.nu) koe = [];
    koe.push({ tekst: String(t), peg: valg.peg || null, glad: !!valg.glad, stor: !!valg.stor, knap: valg.knap || null });
    if (!aktiv || valg.nu) naeste();
  }
  function glad(t) { if (t) sig(t, { glad: true, nu: true }); else if (rod && !skjult()) { saetTilstand('glad'); Lyd.spil('glad'); setTimeout(() => { if (!aktiv) saetTilstand('hvile'); }, 1100); } }

  function start() {
    byg();
    if (!lager.hent('intro_set', false)) {
      lager.gem('intro_set', true);
      sig('Hej! Jeg hedder Grydelil. Jeg hjælper dig i køkkenet.');
      sig('Tryk på Opskrifter for at finde en ret. Blå ord i en opskrift kan du trykke på, så forklarer jeg dem.');
      sig('Tryk på mig, hvis du vil have hjælp. Tryk på krydset, hvis jeg skal gemme mig.');
    }
  }
  return { start, sig, glad, vis, skjult, stille: () => { koe = []; if (rod) stop(); }, side: t => { sideTekst = t; } };
})();
