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
      else if (navn === 'hop') { tone(520, 0, 0.08); tone(780, 0.07, 0.1); }
      else if (navn === 'raket') { for (let i = 0; i < 10; i++) tone(180 + i * 70, i * 0.07, 0.09, 0.08); }
      else if (navn === 'salto') { tone(440, 0, 0.1); tone(660, 0.09, 0.1); tone(990, 0.18, 0.16); }
      else if (navn === 'bump') tone(190, 0, 0.1, 0.2);
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
      <path class="h-ben h-ben1" d=""/><path class="h-ben h-ben2" d=""/>
      <ellipse class="h-fod h-fod1" cx="44" cy="118" rx="11" ry="5.5"/>
      <ellipse class="h-fod h-fod2" cx="76" cy="118" rx="11" ry="5.5"/>
      <path class="h-potte" d="M22 62h76v30a24 24 0 0 1-24 24H46a24 24 0 0 1-24-24z"/>
      <g class="h-plaster" transform="rotate(-18 76 94)"><rect x="66" y="90" width="20" height="9" rx="4.5"/><circle cx="73" cy="94.5" r="1"/><circle cx="79" cy="94.5" r="1"/></g>
      <rect class="h-rand" x="16" y="56" width="88" height="11" rx="5.5"/>
      <ellipse class="h-hul" cx="60" cy="59" rx="40" ry="7"/>
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
        <path class="h-tand" transform="rotate(-7 47 59)" d="M44 59h7v8h-5.5a1.5 1.5 0 0 1-1.5-1.5z"/>
        <path class="h-tand" transform="rotate(9 58 59)" d="M55 59h6v5.5h-4.5a1.5 1.5 0 0 1-1.5-1.5z"/>
        <path class="h-tand" transform="rotate(-12 71 59)" d="M68 59h7v10h-5.5a1.5 1.5 0 0 1-1.5-1.5z"/>
        <path class="h-tand" transform="rotate(14 86 59)" d="M83 59h6v6.5h-4.5a1.5 1.5 0 0 1-1.5-1.5z"/>
        <path class="h-tand" transform="rotate(-5 32 59)" d="M29.5 59h5v5h-3.5a1.5 1.5 0 0 1-1.5-1.5z"/>
      </g>
      <g class="h-glimt"><path d="M104 30l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/></g>
    </g>
  </svg>`;

  let rod, figur, boble, tekst, knapEl, visKnap;
  let koe = [], aktiv = null, skrivTimer, ventTimer, sideTekst = '', er = false, kommer = false, gaar = false, epoke = 0; // er: Grydelil er i gang. Ellers er han der ikke, og kun ?-knappen står. epoke tælles op ved nulstil, så gamle animationer stopper.
  let turEl, talEl, naesteKnap, tur = null, turId = 0, offX = 0, offY = 0, flytter = false, bevNr = 0, anims = [];
  const rolig = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const vent = ms => new Promise(r => setTimeout(r, ms));
  const ease = t => t * t * (3 - 2 * t);
  const skjult = () => lager.hent('hjaelper_skjult', false);

  function byg() {
    rod = document.createElement('div');
    rod.id = 'hjaelper';
    rod.innerHTML = `<div class="h-boble" hidden><p></p><button class="h-knap" type="button" hidden></button>
        <div class="h-tur" hidden><button class="h-tilbage" type="button">‹ Tilbage</button><span class="h-tal"></span><button class="h-naeste" type="button">Næste ›</button></div>
        <span class="h-videre">Tryk for at fortsætte</span></div>
      <button class="h-figur" type="button" aria-label="Hjælperen. Tryk for hjælp.">${SVG}</button>
      <button class="h-skjul" type="button" aria-label="Skjul hjælperen">×</button>`;
    visKnap = document.createElement('button');
    visKnap.id = 'hjaelper-vis'; visKnap.type = 'button'; visKnap.className = 'rund hjaelp';
    visKnap.setAttribute('aria-label', 'Vis hjælper'); visKnap.title = 'Vis hjælper'; visKnap.innerHTML = Ikoner.svg('hjaelp');
    document.body.append(rod, visKnap);
    figur = rod.querySelector('.h-figur'); boble = rod.querySelector('.h-boble'); tekst = boble.querySelector('p'); knapEl = boble.querySelector('.h-knap');
    turEl = boble.querySelector('.h-tur'); talEl = boble.querySelector('.h-tal'); naesteKnap = boble.querySelector('.h-naeste');
    boble.querySelector('.h-tilbage').addEventListener('click', e => { e.stopPropagation(); if (tur && !flytter && tur.i > 0) trinTur(tur.i - 1); });
    naesteKnap.addEventListener('click', e => { e.stopPropagation(); videre(); });
    knapEl.addEventListener('click', e => { e.stopPropagation(); const k = aktiv && aktiv.knap; if (!k) return; stop(); if (k.href) location.hash = k.href; });
    figur.addEventListener('click', () => { if (!flytter && (tur || aktiv)) videre(); });
    boble.addEventListener('click', videre);
    rod.querySelector('.h-skjul').addEventListener('click', () => { koe = []; if (tur) stopTur(true); else stop(); }); // sender ham væk
    visKnap.addEventListener('click', kastKnap);
    saetTilstand('hvile'); opdater();
  }
  function opdater() { rod.hidden = !er; visKnap.hidden = skjult() || er; } // enten er Grydelil i gang, eller også står ?-knappen
  function vis(ja) { // «Vis hjælperen» under Indstillinger: slået fra er der hverken Grydelil eller ?-knap
    lager.gem('hjaelper_skjult', !ja);
    if (!ja) nulstil(); else opdater();
  }
  function saetTilstand(t) { rod.dataset.tilstand = t; }

  function stopSkjult() {
    clearInterval(skrivTimer); clearTimeout(ventTimer);
    if (aktiv && aktiv.peg) aktiv.peg.classList.remove('udpeget');
    aktiv = null; boble.hidden = true; saetTilstand('hvile');
  }
  function stop() { // er der ikke flere beskeder, og ingen tur, går Grydelil
    stopSkjult();
    if (er && !koe.length && !tur && !kommer && !gaar && !flytter) afgaa();
  }
  function naeste() {
    stop();
    const n = koe.shift();
    if (!n) return;
    aktiv = n; aktiv.faerdig = false;
    rod.classList.toggle('hurtig', !!n.hurtig);
    boble.hidden = false; tekst.textContent = '';
    knapEl.hidden = true;
    boble.classList.toggle('flere', koe.length > 0);
    boble.classList.toggle('stor', !!n.stor);
    boble.classList.toggle('tur', !!n.tur); boble.classList.toggle('under', !!n.under);
    turEl.hidden = true;
    placerBoble(!!n.tur);
    if (n.peg && document.contains(n.peg)) {
      const m = n.peg.getBoundingClientRect(), f = figur.getBoundingClientRect(), ox = n.tur ? 0 : offX, oy = n.tur ? 0 : offY; // uden for turen står han på sin plads
      const dx = (m.left + m.width / 2) - (f.left - ox + f.width * 0.22), dy = (m.top + m.height / 2) - (f.top - oy + f.height * 0.63);
      let v = Math.atan2(dx, -dy) * 180 / Math.PI;
      if (v > 80) v -= 360; // peger skråt ned til venstre
      v = Math.max(-175, Math.min(70, v));
      rod.style.setProperty('--vinkel', (v + 10) + 'deg');
      n.peg.classList.add('udpeget');
    }
    const tale = () => saetTilstand(n.peg ? 'peg' : 'tale');
    if (n.glad) { saetTilstand('glad'); Lyd.spil('glad'); setTimeout(() => { if (aktiv === n && !n.faerdig) tale(); }, 1100); }
    else tale();
    if (n.hurtig) { tekst.textContent = n.tekst; faerdigSkrevet(); return; } // tips: hele teksten med det samme, så man ikke venter
    let i = 0;
    const rolig = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const skridt = rolig ? n.tekst.length : Math.max(1, Math.ceil(n.tekst.length / (n.tur ? 22 : 120)));
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
    if (aktiv.tur) { // rundvisningen venter på dig: Næste eller Stop
      talEl.textContent = `${aktiv.nr} af ${aktiv.af}`;
      naesteKnap.textContent = aktiv.nr === aktiv.af ? 'Færdig' : 'Næste ›';
      boble.querySelector('.h-tilbage').disabled = aktiv.nr === 1;
      turEl.hidden = false; return;
    }
    ventTimer = setTimeout(naeste, 2600 + aktiv.tekst.length * 55);
  }
  function videre() {
    if (flytter) return;
    if (!aktiv) { if (tur) naesteTur(); return; }
    if (!aktiv.faerdig) faerdigSkrevet(); else if (aktiv.tur) naesteTur(); else naeste();
  }

  // sig('tekst', { peg: element, glad: true, nu: true, stor: true, knap: { tekst, href } })
  function sig(t, valg = {}) {
    if (!rod || !t || (skjult() && !valg.hurtig)) return; // slået fra under Indstillinger: kun tips kommer stadig
    if (gaar) nulstil(); // han var på vej væk: begynd forfra
    if (tur && !valg.tur) stopTur(false); // en vigtig besked afbryder rundvisningen
    if (valg.nu) koe = [];
    koe.push({ tekst: String(t), peg: valg.peg || null, hurtig: !!valg.hurtig, bliv: !!valg.bliv, glad: !!valg.glad, stor: !!valg.stor, knap: valg.knap || null, tur: !!valg.tur, under: !!valg.under, nr: valg.nr, af: valg.af });
    if (!er) ind(); // han kommer flyvende, og først bagefter står beskeden frem
    else if (!kommer && (!aktiv || valg.nu)) naeste();
  }
  // bliv: beskeden overlever et sideskift (fx «Gemt!», der kommer, lige før siden skifter)
  function glad(t) { if (t) sig(t, { glad: true, nu: true, bliv: true }); }

  // ---------- Ind og ud: Grydelil er enten i gang eller der ikke. Han kommer flyvende som en raket ud af hjørnet og flyver tilbage. ----------
  function hjoerne() { // hvor hjørnet uden for skærmen er, som forskydning fra hvilestedet. s = 1: han bor til højre (telefon), -1: til venstre (sidebjælke)
    const f = figur.getBoundingClientRect(), l = f.left - offX, t = f.top - offY, s = l + f.width / 2 > innerWidth / 2 ? 1 : -1;
    return { s, dx: s > 0 ? innerWidth - l + 10 : -(l + f.width + 10), dy: innerHeight - t + 10 };
  }
  function placerHjoerne() { // han står klar uden for skærmen
    er = true; gaar = false; rod.hidden = false;
    const h = hjoerne(); offX = h.dx; offY = h.dy; rod.style.transform = `translate(${offX}px, ${offY}px)`;
  }
  async function ind() { // hurtig raket ind (til tips og beskeder)
    const ep = epoke; kommer = true; visKnap.hidden = true; placerHjoerne();
    await flyt(0, 0, 'raket', false, true);
    if (ep !== epoke) return;
    kommer = false;
    if (!aktiv && koe.length) naeste();
  }
  async function afgaa() { // hurtig raket tilbage til hjørnet
    const ep = epoke; gaar = true; koe = []; stopSkjult(); markerFjern();
    const h = hjoerne();
    await flyt(h.dx, h.dy, 'raket', false, true);
    if (ep !== epoke) return;
    hvile();
  }
  function hvile() { stopAnim(); offX = offY = 0; rod.style.transform = ''; er = false; gaar = false; saetTilstand('hvile'); opdater(); }
  // Sidesskifte og andre afbrydelser: alt stoppes, og både Grydelil og ?-knappen står, som de skal
  function nulstil() {
    epoke++; ++bevNr; tur = null; koe = []; flytter = false; kommer = false; gaar = false; er = false;
    clearInterval(skrivTimer); clearTimeout(ventTimer); aktiv = null;
    anims = []; rod.getAnimations({ subtree: true }).forEach(a => a.cancel()); visKnap.getAnimations().forEach(a => a.cancel());
    document.querySelectorAll('.h-armind, .h-skyggeflyv, .h-partikel').forEach(e => e.remove());
    document.querySelectorAll('.udpeget').forEach(e => e.classList.remove('udpeget'));
    skyg = null; rod.classList.remove('skridt', 'iluften', 'hurtig'); nulBen(); figur.querySelector('svg').style.transform = '';
    offX = offY = 0; rod.style.transform = ''; boble.hidden = true; boble.style.translate = ''; markerFjern(); saetTilstand('hvile');
    opdater();
  }
  // ?-knappen: Grydelil kommer flyvende ud af hjørnet og direkte op til første trin i gennemgangen. Bolden (?) bliver sparket væk, når han letter.
  function boldVaek() {
    if (visKnap.hidden) return;
    const ep = epoke, v = visKnap.getBoundingClientRect(), cx = v.left + v.width / 2, s = cx > innerWidth / 2 ? 1 : -1, bane = (s > 0 ? innerWidth - cx : cx) + 70;
    if (rolig()) { visKnap.hidden = true; return; }
    const a = visKnap.animate([{ transform: 'none' }, { transform: `translate(${s * bane * .5}px, -150px) rotate(${s * 360}deg)`, offset: .45 }, { transform: `translate(${s * bane}px, 120px) rotate(${s * 720}deg)` }], { duration: 520, delay: 120, easing: 'ease-in', fill: 'both' });
    a.finished.then(() => { if (ep === epoke) { visKnap.hidden = true; a.cancel(); } }, () => {});
  }
  function kastKnap() {
    if (er || flytter || skjult()) return;
    if (Array.isArray(sideTekst)) startTur(); else sig(sideTekst || 'Hej! Tryk på ?, når du vil have hjælp.');
  }

  // Slut på turen: Grydelil hopper ud af skærmen (til siden, hvor han bor), og en arm med en hånd rækker ind og sætter ?-knappen på plads
  async function afsted() {
    const ep = epoke;
    const f = figur.getBoundingClientRect(), hjem = f.left - offX, venstre = hjem + f.width / 2 < innerWidth / 2;
    await flyt(venstre ? -(hjem + f.width + 16) : innerWidth - hjem + 16, 0, 'hop', true);
    if (ep !== epoke) return;
    hvile(); // ?-knappen står nu igen
    if (rolig()) return;
    // Knappen starter uden for skærmen, i hånden på armen. Armen sænker den på plads, slipper og trækker sig tilbage.
    const v = visKnap.getBoundingClientRect(), cx = v.left + v.width / 2, s = cx > innerWidth / 2 ? 1 : -1, X = s * ((s > 0 ? innerWidth - cx : cx) + 40), D = 1000;
    const arm = document.createElement('div');
    arm.className = 'h-armind'; arm.style.cssText = `left:${v.left}px;top:${v.top}px;width:${v.width}px;height:${v.height}px`;
    arm.innerHTML = `<svg width="520" height="${v.height}" viewBox="0 0 520 ${v.height}" aria-hidden="true" style="transform-origin:${v.width / 2}px 50%;transform:scaleX(${s})"><path d="M${v.width * .85} ${v.height * .15}Q150 -26 500 -14"/><circle cx="${v.width * .85}" cy="${v.height * .15}" r="8"/></svg>`;
    document.body.append(arm);
    const ind = [{ transform: `translate(${X}px, -34px)`, easing: 'cubic-bezier(.2,.7,.3,1)' }, { transform: 'translate(0px, -16px)', offset: .55, easing: 'ease-in' }, { transform: 'translate(0px, 0px)', offset: .68, easing: 'ease-out' }];
    Lyd.spil('hop'); setTimeout(() => Lyd.spil('bump'), D * .68);
    const kn = visKnap.animate([...ind, { transform: 'translate(0px, 0px)' }], { duration: D });
    const am = arm.animate([...ind, { transform: `translate(${X}px, -34px)` }], { duration: D, fill: 'forwards' });
    await am.finished.catch(() => {}); arm.remove();
  }

  // ---------- Rundvisning: Grydelil hopper hen til emnet og peger ----------
  function placerBoble(tur) {
    boble.style.translate = '0 0';
    if (!tur) return;
    const w = Math.min(270, innerWidth - 24), r = rod.getBoundingClientRect();
    if (getComputedStyle(boble).right === 'auto') { const hoejre = r.left + 4 + w; if (hoejre > innerWidth - 8) boble.style.translate = `${innerWidth - 8 - hoejre}px 0`; return; } // Mac: Grydelil hviler til venstre, og boblen går mod højre
    const venstre = r.right - 4 - w;
    if (venstre < 8) boble.style.translate = `${8 - venstre}px 0`;
  }
  function plan(el) { // hvor skal Grydelil stå, så skeen når emnet, og boblen ikke dækker det?
    const r = el.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
    const bund = document.body.dataset.side === 'lav' ? vh - 112 : vh - 8;
    const FW = 80, FH = FW * 130 / 120, PX = FW * 26 / 120, PY = FH * 82 / 130;
    const ax = Math.max(r.left + 10, Math.min(r.right - 10, r.left + r.width / 2));
    const kl = x => Math.max(8, Math.min(vw - FW - 8, x));
    if (bund - r.bottom >= 250) return { x: kl(ax + 14 - PX), y: r.bottom + 44 - PY, under: true }; // under emnet, skeen peger op
    if (r.top >= 270) return { x: kl(ax + 30 - PX), y: r.top - 42 - PY, under: false };            // over emnet, skeen peger ned
    return null;
  }
  // Skyggen bliver på jorden: den følger ruten uden løftet, og bliver mindre og svagere, jo højere Grydelil er oppe
  let skyg = null;
  function skyggeStart() {
    skyggeSlut();
    const r = rod.querySelector('.h-skygge').getBoundingClientRect();
    skyg = document.createElement('div'); skyg.className = 'h-skyggeflyv';
    Object.assign(skyg.style, { left: r.left - offX + 'px', top: r.top - offY + 'px', width: r.width + 'px', height: r.height + 'px' });
    document.body.append(skyg); rod.classList.add('iluften');
  }
  const skyggeKf = (x, y, loft) => { const k = Math.max(.3, 1 - Math.max(0, loft) / 200); return { transform: `translate(${x}px, ${y}px) scale(${k})`, opacity: k }; };
  function skygge(x, y, loft) { if (skyg) Object.assign(skyg.style, skyggeKf(x, y, loft)); }
  function skyggeSlut() { if (skyg) skyg.remove(); skyg = null; if (rod) rod.classList.remove('iluften'); }
  function anim(el, kf, opt) { const a = el.animate(kf, { fill: 'forwards', ...opt }); anims.push(a); return a.finished.catch(() => {}); }
  function stopAnim() { anims.forEach(a => { try { a.cancel(); } catch (e) { /* ok */ } }); anims = []; if (rod) { rod.classList.remove('skridt'); nulBen(); skyggeSlut(); } }
  function nulBen() { rod.querySelectorAll('.h-fod, .h-ben').forEach(e => e.removeAttribute('transform')); rod.querySelectorAll('.h-ben').forEach(e => e.setAttribute('d', '')); }
  function markerFjern() { document.querySelectorAll('.h-maal').forEach(e => e.classList.remove('h-maal')); }

  // Bevægelserne: sats (sammenklemt) → flyvetur → landing (mast flad) med støv. Alt er overdrevet med vilje.
  const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
  const io = t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  function partikler(x, y, slags) {
    if (rolig()) return;
    const n = slags === 'stjerne' ? 6 : 7;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('span');
      p.className = 'h-partikel ' + slags;
      if (slags === 'stjerne') p.textContent = '✦';
      p.style.left = x + 'px'; p.style.top = y + 'px';
      document.body.append(p);
      const v = slags === 'stjerne' ? Math.random() * Math.PI * 2 : Math.PI + (i / (n - 1)) * Math.PI, l = 30 + Math.random() * 30;
      p.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(v) * l}px), calc(-50% + ${Math.sin(v) * l * (slags === 'stjerne' ? 1 : .45) - 8}px)) scale(${slags === 'stjerne' ? 1.3 : 1.6})`, opacity: 0 }],
        { duration: 520 + Math.random() * 200, easing: 'cubic-bezier(.2,.8,.3,1)' }).finished.then(() => p.remove(), () => p.remove());
    }
  }
  function fodpunkt() { const r = figur.getBoundingClientRect(); return [r.left + r.width / 2, r.bottom - 6]; }

  async function flyt(nx, ny, navn, ud = false, hurtig = false) {
    const mit = ++bevNr, fx = offX, fy = offY, dx = nx - fx, dy = ny - fy, dist = Math.hypot(dx, dy), ret = dx < 0 ? -1 : 1;
    const sat = () => { stopAnim(); offX = nx; offY = ny; rod.style.transform = nx || ny ? `translate(${nx}px, ${ny}px)` : ''; };
    if (rolig() || dist < 6) { sat(); return; }
    const svg = figur.querySelector('svg'), top0 = figur.getBoundingClientRect().top - fy;
    if (navn === 'skridt') return skridt(mit, fx, fy, dx, dy, dist, ret, sat);
    if (navn === 'raket') return raket(mit, fx, fy, dx, dy, dist, ret, sat, svg, hurtig);
    const D = { salto: 1500, dans: 2000, skridt: 1500, rul: 1700, hop: 1300 }[navn] || 1300;
    const d = Math.round(D + Math.min(400, dist * .5));
    // én funktion pr. bevægelse: t (0-1) → position (bevægelse frem, løft) og kropsform (drej, bred, høj)
    const F = {
      salto: t => { const u = seg(t, .16, .84), k = seg(t, 0, .16), l = seg(t, .84, 1);
        return { e: io(u), loft: Math.sin(Math.PI * u) * (150 + dist * .15), r: -ret * (dist > 220 ? 720 : 360) * io(u) + (k < 1 ? -ret * 8 * Math.sin(Math.PI * k) : 0),
          sx: 1 + .3 * Math.sin(Math.PI * k) - .15 * Math.sin(Math.PI * seg(u, 0, .25)) + .35 * Math.sin(Math.PI * l), sy: 1 - .35 * Math.sin(Math.PI * k) + .3 * Math.sin(Math.PI * seg(u, 0, .25)) - .4 * Math.sin(Math.PI * l) }; },
      hop: t => { const k = seg(t, 0, .12), u = seg(t, .12, 1), h = (u * 3) % 1, nr = Math.min(2, Math.floor(u * 3)), lan = h > .85 || h < .1;
        return { e: io(u), loft: Math.sin(Math.PI * h) * [70, 50, 34][nr], r: ret * 10 * Math.sin(Math.PI * 2 * h),
          sx: 1 + .3 * Math.sin(Math.PI * k) + (lan && u > .02 ? .25 : -.1 * Math.sin(Math.PI * h)), sy: 1 - .3 * Math.sin(Math.PI * k) + (lan && u > .02 ? -.3 : .18 * Math.sin(Math.PI * h)) }; },
      skridt: t => { const k = seg(t, 0, .12), u = seg(t, .12, .92), l = seg(t, .92, 1), h = (u * 2) % 1;
        return { e: io(u), loft: Math.sin(Math.PI * h) * 46, r: ret * (18 * Math.sin(Math.PI * u) - 10 * Math.sin(Math.PI * k)),
          sx: 1 + .25 * Math.sin(Math.PI * k) + .3 * Math.sin(Math.PI * h) + .3 * Math.sin(Math.PI * l), sy: 1 - .25 * Math.sin(Math.PI * k) - .18 * Math.sin(Math.PI * h) - .3 * Math.sin(Math.PI * l) }; },
      rul: t => { const k = seg(t, 0, .14), u = seg(t, .14, .8), op = seg(t, .8, 1);
        const r = k < 1 ? ret * 90 * io(k) : u < 1 ? ret * (90 + 720 * io(u)) : ret * (810 - 90 * io(op));
        return { e: io(seg(t, .08, .86)), loft: Math.abs(Math.sin(Math.PI * 4 * u)) * 14 + Math.sin(Math.PI * op) * 70, r,
          sx: 1 + .2 * Math.sin(Math.PI * k) + .3 * Math.sin(Math.PI * seg(op, .7, 1)), sy: 1 - .25 * Math.sin(Math.PI * k) - .35 * Math.sin(Math.PI * seg(op, .7, 1)) }; },
      dans: t => { const u = seg(t, .05, .95), spin = seg(u, .42, .62), h = (u * 6) % 1;
        return { e: io(u), loft: Math.abs(Math.sin(Math.PI * h)) * 26 + Math.sin(Math.PI * spin) * 60,
          r: 26 * Math.sin(Math.PI * 2 * u * 3) * (1 - Math.sin(Math.PI * spin)) + ret * 360 * io(spin),
          sx: 1 + .14 * Math.sin(Math.PI * 2 * h), sy: 1 - .14 * Math.sin(Math.PI * 2 * h) }; }
    }[navn] || (t => ({ e: t, loft: 0, r: 0, sx: 1, sy: 1 }));
    const N = 60, rk = [], sk = [], gk = [];
    skyggeStart();
    for (let i = 0; i <= N; i++) {
      const t = i / N, p = F(t), x = fx + dx * p.e, y = fy + dy * p.e;
      const loft = Math.min(p.loft, Math.max(0, top0 + y - 12)); // aldrig ud over skærmens top
      rk.push({ transform: `translate(${x}px, ${y - loft}px)` }); gk.push(skyggeKf(x, y, loft));
      sk.push({ transform: `translateY(${(1 - p.sy) * 30}px) rotate(${p.r}deg) scale(${p.sx}, ${p.sy})` });
    }
    saetTilstand('flyv');
    if (navn === 'skridt') { rod.classList.add('skridt'); rod.style.setProperty('--d', Math.round(d * .4) + 'ms'); }
    Lyd.spil(navn === 'salto' ? 'salto' : 'hop');
    const [sx0, sy0] = fodpunkt();
    setTimeout(() => { if (mit === bevNr) partikler(sx0, sy0, 'stoev'); }, d * .14);
    if (navn === 'salto' || navn === 'dans') setTimeout(() => { if (mit === bevNr) { const r = figur.getBoundingClientRect(); partikler(r.left + r.width / 2, r.top + r.height / 2, 'stjerne'); } }, d * .5);
    if (navn === 'hop' || navn === 'skridt') [.45, .7].forEach(f => setTimeout(() => { if (mit === bevNr) { const [a, b] = fodpunkt(); partikler(a, b, 'stoev'); } }, d * f));
    await Promise.all([anim(rod, rk, { duration: d, easing: 'linear' }), anim(svg, sk, { duration: d, easing: 'linear' }), anim(skyg, gk, { duration: d, easing: 'linear' })]);
    if (mit !== bevNr) return; // afbrudt
    sat(); skyggeSlut();
    if (ud) return; // ud af skærmen: ingen landing
    Lyd.spil('bump');
    const [lx, ly] = fodpunkt(); partikler(lx, ly, 'stoev');
    // ta-da: vrikker og står stolt
    saetTilstand('lander');
    await anim(svg, [{ transform: 'rotate(0)' }, { transform: `rotate(${-12 * ret}deg) scale(1.06)` }, { transform: `rotate(${7 * ret}deg)` }, { transform: 'rotate(-2deg)' }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.3,.7,.4,1)' });
    if (mit === bevNr) { stopAnim(); saetTilstand('hvile'); }
  }

  // Langt skridt: forreste ben strækker sig hen til det nye sted, så kommer kroppen, og til sidst trækkes bagerste ben med
  function skridt(mit, fx, fy, dx, dy, dist, ret, sat) {
    const K = 1.5, SX = dx * K, SY = dy * K; // px → tegningens enheder
    const forr = rod.querySelector(ret > 0 ? '.h-fod2' : '.h-fod1'), bag = rod.querySelector(ret > 0 ? '.h-fod1' : '.h-fod2');
    const fb = rod.querySelector(ret > 0 ? '.h-ben2' : '.h-ben1'), bb = rod.querySelector(ret > 0 ? '.h-ben1' : '.h-ben2');
    const hofte = el => [Number(el.getAttribute('cx')), 106], fod = el => [Number(el.getAttribute('cx')), 118];
    const loft = Math.min(46, 18 + dist * .1);
    const ben = (b, f, ox, oy) => { // ben fra hoften til foden, med et lille knæk
      const [hx, hy] = hofte(f), [px, py] = fod(f), tx = px + ox, ty = py + oy, mx = (hx + tx) / 2, my = (hy + ty) / 2;
      const l = Math.hypot(tx - hx, ty - hy), bue = Math.min(14, l * .12);
      b.setAttribute('d', l < 14 ? '' : `M${hx} ${hy}Q${mx} ${my - bue} ${tx} ${ty}`);
      f.setAttribute('transform', `translate(${ox} ${oy})`);
    };
    const d = Math.round(Math.max(1500, Math.min(2400, 1200 + dist * 1.2)));
    saetTilstand('flyv'); Lyd.spil('hop'); skyggeStart();
    return new Promise(slut => {
      const t0 = performance.now();
      const ramme = nu => {
        if (mit !== bevNr) return slut();
        const t = Math.min(1, (nu - t0) / d);
        const a = io(seg(t, 0, .38)), b = io(seg(t, .38, .7)), c = io(seg(t, .7, .96));
        // kroppen: står stille, glider så frem med et lille løft, og læner sig mod det nye sted
        const kx = fx + dx * b, ky = fy + dy * b - Math.sin(Math.PI * b) * 12 + Math.sin(Math.PI * a) * 4;
        rod.style.transform = `translate(${kx}px, ${ky}px)`; skygge(fx + dx * b, fy + dy * b, fy + dy * b - ky);
        figur.querySelector('svg').style.transform = `rotate(${ret * (8 * Math.sin(Math.PI * Math.min(1, t / .7)) - 6 * Math.sin(Math.PI * c))}deg)`;
        // forreste fod: rejser sig og lander på det nye sted, bliver der, mens kroppen kommer
        const fOx = SX * a - SX * b, fOy = SY * a - SY * b - Math.sin(Math.PI * a) * loft * K;
        // bagerste fod: står fast, mens kroppen går, og hives så med
        const bOx = -SX * b + SX * c, bOy = -SY * b + SY * c - Math.sin(Math.PI * c) * loft * .7 * K;
        ben(fb, forr, fOx, fOy); ben(bb, bag, bOx, bOy);
        if (t >= .38 && !ramme.a) { ramme.a = 1; Lyd.spil('bump'); const r = forr.getBoundingClientRect(); partikler(r.left + r.width / 2, r.bottom, 'stoev'); }
        if (t >= .96 && !ramme.c) { ramme.c = 1; Lyd.spil('bump'); const r = bag.getBoundingClientRect(); partikler(r.left + r.width / 2, r.bottom, 'stoev'); }
        if (t < 1) return requestAnimationFrame(ramme);
        figur.querySelector('svg').style.transform = ''; nulBen(); sat(); skyggeSlut(); lander(mit).then(slut);
      };
      requestAnimationFrame(ramme);
    });
  }
  // Raket: drejer låget væk fra målet, ryster og flyver af sted på røgen. Han flyver lidt for højt, vender sig om i luften
  // og daler blødt ned på plads.
  function raket(mit, fx, fy, dx, dy, dist, ret, sat, svg, hurtig) {
    const vinkel = Math.atan2(-dx, dy) * 180 / Math.PI, d = hurtig ? 520 : Math.round(Math.max(2300, Math.min(3000, 1900 + dist * 1.4)));
    const hul = rod.querySelector('.h-hul'), top0 = figur.getBoundingClientRect().top - fy;
    const H = Math.max(0, Math.min(80, top0 + fy + dy - 16)); // hvor meget for højt han flyver (aldrig ud af skærmen)
    const ox = fx + dx, oy = fy + dy - H, slutVinkel = Math.round(vinkel / 360) * 360 + (vinkel >= 0 ? 360 : -360); // vender med en ekstra omgang
    saetTilstand('raket'); Lyd.spil('raket'); skyggeStart();
    return new Promise(slut => {
      const t0 = performance.now(); let sidstRoeg = 0, lukket = false, landet = false;
      const ramme = nu => {
        if (mit !== bevNr) return slut();
        const t = Math.min(1, (nu - t0) / d);
        const drej = io(seg(t, 0, .16)), fart = seg(t, .16, .6), vend = io(seg(t, .58, .76)), fald = seg(t, .74, .94), bump = seg(t, .94, 1);
        const e = fart < .5 ? 4 * fart ** 3 : 1 - (-2 * fart + 2) ** 3 / 2; // speeder op og bremser
        const ryst = t < .18 ? Math.sin(nu / 18) * 3 * seg(t, .04, .16) : t < .6 ? Math.sin(nu / 40) * 1.5 : 0;
        const bue = Math.sin(Math.PI * fart) * Math.min(60, dist * .15);
        const svaev = Math.sin(Math.PI * seg(t, .58, .76)) * 6; // svæver lidt op, mens han vender
        const g = fald * fald; // falder blødt: langsomt i starten, hurtigere til sidst
        const x = fx + (ox - fx) * e + ryst;
        const y = t < .74 ? fy + (oy - fy) * e - bue - svaev : oy + H * g;
        const hop = Math.sin(Math.PI * bump) * 7; // lille genhop efter landingen
        rod.style.transform = `translate(${x}px, ${y - hop}px)`;
        const jordY = t < .74 ? fy + dy * e : fy + dy;
        skygge(fx + dx * e, jordY, jordY - (y - hop));
        const r = vinkel * drej + (slutVinkel - vinkel) * vend;
        const kl = 1 - .2 * Math.sin(Math.PI * seg(t, .1, .16)) - .22 * Math.sin(Math.PI * seg(t, .92, .97));
        svg.style.transform = `translateY(${(1 - kl) * 30}px) rotate(${r}deg) scale(${2 - kl}, ${kl})`;
        if (t > .08 && t < .6 && nu - sidstRoeg > 28) { // røg op af gryden, ud gennem det åbne låg
          sidstRoeg = nu;
          const b = hul.getBoundingClientRect(), rad = r * Math.PI / 180;
          roeg(b.left + b.width / 2, b.top + b.height / 2, Math.sin(rad), -Math.cos(rad), t < .16);
        }
        if (t >= .62 && !lukket) { lukket = true; saetTilstand('landerraket'); } // motoren slukker, låget lukker
        if (t >= .94 && !landet) { landet = true; Lyd.spil('bump'); const rr = figur.getBoundingClientRect(); partikler(rr.left + rr.width / 2, rr.bottom - 6, 'stoev'); }
        if (t < 1) return requestAnimationFrame(ramme);
        svg.style.transform = ''; sat(); skyggeSlut(); saetTilstand('hvile'); slut();
      };
      requestAnimationFrame(ramme);
    });
  }
  function roeg(x, y, ux, uy, lille) { // ux, uy: lågets retning; røgen pustes den vej ud
    if (rolig()) return;
    const p = document.createElement('span');
    p.className = 'h-partikel roeg'; p.style.left = x + 'px'; p.style.top = y + 'px';
    document.body.append(p);
    const l = (lille ? 35 : 75) + Math.random() * 35, sp = (Math.random() - .5) * 34;
    if (Math.random() < .35) p.classList.add('moerk');
    p.animate([{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 }, { transform: `translate(calc(-50% + ${ux * 12}px), calc(-50% + ${uy * 12}px)) scale(1)`, opacity: 1, offset: .12 },
      { transform: `translate(calc(-50% + ${ux * l - uy * sp}px), calc(-50% + ${uy * l + ux * sp - 10}px)) scale(${2.4 + Math.random()})`, opacity: 0 }],
      { duration: 700 + Math.random() * 300, easing: 'cubic-bezier(.1,.7,.3,1)' }).finished.then(() => p.remove(), () => p.remove());
  }
  // blød overgang tilbage til hvile: låget lukker roligt, i stedet for at klappe i
  async function lander(mit, tilstand = 'lander') {
    saetTilstand(tilstand); await vent(300);
    if (mit === bevNr) saetTilstand('hvile');
  }

  // Bevægelsen passer til turens længde: korte ture små hop, lange ture raket. Samme bevægelse to gange i træk undgås.
  let sidsteBev = '';
  function vaelg(dx, dy, foerste) {
    if (foerste === 'tvang') { sidsteBev = 'raket'; return 'raket'; } // første trin: altid raket ud af hjørnet
    const l = Math.hypot(dx, dy), vandret = Math.abs(dx) > Math.abs(dy);
    if (foerste && l >= 200 && -dy > Math.abs(dx)) { sidsteBev = 'raket'; return 'raket'; } // raket: kun første tur, og kun opad
    const muligt = l < 70 ? ['hop'] : l < 150 ? ['skridt', 'hop'] : l < 240 ? (vandret ? ['rul', 'dans'] : ['dans', 'salto']) : ['salto', 'dans'];
    const b = muligt.find(x => x !== sidsteBev) || muligt[0];
    sidsteBev = b; return b;
  }

  // Et trin peger på et felts id (data-tpid, eller tilpasserens nøgle data-flyt). Det første synlige felt med id'et bruges. En liste af id'er giver det første, der findes.
  function find(maal) {
    for (const m of [].concat(maal)) {
      const q = `[data-flyt="${CSS.escape(m)}"], [data-tpid="${CSS.escape(m)}"]`;
      for (const e of document.querySelectorAll(q)) if (!e.classList.contains('plads') && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden') return e;
    }
    return null;
  }
  async function startTur() { sidsteBev = '';
    koe = []; stopSkjult();
    placerHjoerne(); // han står klar uden for skærmen og letter som en raket
    tur = { id: ++turId, trin: sideTekst, i: -1 };
    trinTur(0);
  }
  async function trinTur(i) {
    const t = tur; if (!t) return;
    if (i >= t.trin.length) return slutTur();
    const id = t.id, s = t.trin[i];
    const el = s.maal ? find(s.maal) : null;
    if (s.maal && !el) return trinTur(i + 1); // feltet er skjult, slettet eller væk: trinnet springes over
    t.i = i; flytter = true; stop(); markerFjern();
    if (el) { // rul emnet ind midt på skærmen
      const r = el.getBoundingClientRect();
      if (Math.abs(r.top + r.height / 2 - innerHeight / 2) > 60) {
        el.scrollIntoView({ block: r.height > innerHeight * 0.5 ? 'start' : 'center', behavior: rolig() ? 'auto' : 'smooth' });
        await vent(rolig() ? 0 : 550);
        if (!tur || tur.id !== id) return;
      }
    }
    const p = el ? plan(el) : null, f = figur.getBoundingClientRect();
    const nx = p ? p.x - (f.left - offX) : (el || i === 0 ? 0 : offX), ny = p ? p.y - (f.top - offY) : (el || i === 0 ? 0 : offY);
    const bev = vaelg(nx - offX, ny - offY, i === 0 ? 'tvang' : false);
    if (i === 0) boldVaek();
    await flyt(nx, ny, bev);
    if (!tur || tur.id !== id) return;
    if (bev === 'dans') { saetTilstand('dans'); await vent(1440); if (!tur || tur.id !== id) return; }
    if (el) el.classList.add('h-maal');
    flytter = false;
    sig(s.tekst, { peg: el, nu: true, tur: true, under: !!(p && p.under), nr: i + 1, af: t.trin.length });
  }
  function naesteTur() { if (tur && !flytter) trinTur(tur.i + 1); }
  async function slutTur() {
    stopSkjult(); tur = null; markerFjern(); flytter = true;
    await afsted();
    flytter = false;
  }
  async function stopTur(animer) {
    tur = null; ++bevNr; stopAnim(); markerFjern(); stopSkjult(); flytter = false;
    if (rod) rod.classList.remove('skridt');
    if (animer) afgaa(); else { offX = offY = 0; rod.style.transform = ''; saetTilstand('hvile'); }
  }

  function start() {
    byg();
    if (!lager.hent('intro_set', false)) {
      lager.gem('intro_set', true);
      sig('Hej! Jeg hedder Grydelil. Jeg hjælper dig i køkkenet.');
      sig('Tryk på Opskrifter for at finde en ret. Blå ord i en opskrift kan du trykke på, så forklarer jeg dem.');
      sig('Tryk på ?, så viser jeg dig rundt på siden.');
    }
  }
  return { start, sig, glad, vis, skjult, luk: () => { if (tur) { stopTur(true); return true; } if (rod && er) { koe = []; stop(); return true; } return false; }, stille: () => { koe = []; if (rod) stop(); }, side: t => { sideTekst = t || ''; if (rod && !(er && aktiv && aktiv.bliv && !tur && !flytter && !kommer && !gaar)) nulstil(); } }; // et sideskift nulstiller alt, der er i gang
})();
