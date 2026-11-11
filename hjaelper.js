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
      <ellipse class="h-fod h-fod1" cx="44" cy="118" rx="11" ry="5.5"/>
      <ellipse class="h-fod h-fod2" cx="76" cy="118" rx="11" ry="5.5"/>
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
  let turEl, talEl, naesteKnap, tur = null, turId = 0, offX = 0, offY = 0, flytter = false, bevNr = 0, anims = [];
  const rolig = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const vent = ms => new Promise(r => setTimeout(r, ms));
  const ease = t => t * t * (3 - 2 * t);
  const skjult = () => lager.hent('hjaelper_skjult', false);

  function byg() {
    rod = document.createElement('div');
    rod.id = 'hjaelper';
    rod.innerHTML = `<div class="h-boble" hidden><p></p><button class="h-knap" type="button" hidden></button>
        <div class="h-tur" hidden><button class="h-stop" type="button">Stop</button><span class="h-tal"></span><button class="h-naeste" type="button">Næste ›</button></div>
        <span class="h-videre">Tryk for at fortsætte</span></div>
      <button class="h-figur" type="button" aria-label="Hjælperen. Tryk for hjælp.">${SVG}</button>
      <button class="h-skjul" type="button" aria-label="Skjul hjælperen">×</button>`;
    visKnap = document.createElement('button');
    visKnap.id = 'hjaelper-vis'; visKnap.type = 'button';
    visKnap.textContent = 'Vis hjælper';
    document.body.append(rod, visKnap);
    figur = rod.querySelector('.h-figur'); boble = rod.querySelector('.h-boble'); tekst = boble.querySelector('p'); knapEl = boble.querySelector('.h-knap');
    turEl = boble.querySelector('.h-tur'); talEl = boble.querySelector('.h-tal'); naesteKnap = boble.querySelector('.h-naeste');
    boble.querySelector('.h-stop').addEventListener('click', e => { e.stopPropagation(); stopTur(true); });
    naesteKnap.addEventListener('click', e => { e.stopPropagation(); videre(); });
    knapEl.addEventListener('click', e => { e.stopPropagation(); const k = aktiv && aktiv.knap; if (!k) return; stop(); if (k.href) location.hash = k.href; });
    figur.addEventListener('click', () => {
      if (flytter) return;
      if (tur || aktiv) videre(); else if (Array.isArray(sideTekst)) startTur(); else if (sideTekst) sig(sideTekst);
    });
    boble.addEventListener('click', videre);
    rod.querySelector('.h-skjul').addEventListener('click', () => vis(false));
    visKnap.addEventListener('click', () => { vis(true); sig('Hej igen! Tryk på mig, så viser jeg dig rundt.'); });
    saetTilstand('hvile'); opdater();
  }
  function opdater() { rod.hidden = skjult(); visKnap.hidden = !skjult(); }
  function vis(ja) {
    lager.gem('hjaelper_skjult', !ja);
    if (!ja) { koe = []; stopTur(false); stop(); }
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
    boble.classList.toggle('tur', !!n.tur); boble.classList.toggle('under', !!n.under);
    turEl.hidden = true;
    placerBoble(!!n.tur);
    if (n.peg && document.contains(n.peg)) {
      const m = n.peg.getBoundingClientRect(), f = figur.getBoundingClientRect();
      const dx = (m.left + m.width / 2) - (f.left + f.width * 0.22), dy = (m.top + m.height / 2) - (f.top + f.height * 0.63);
      let v = Math.atan2(dx, -dy) * 180 / Math.PI;
      if (v > 80) v -= 360; // peger skråt ned til venstre
      v = Math.max(-175, Math.min(70, v));
      rod.style.setProperty('--vinkel', (v + 10) + 'deg');
      n.peg.classList.add('udpeget');
    }
    const tale = () => saetTilstand(n.peg ? 'peg' : 'tale');
    if (n.glad) { saetTilstand('glad'); Lyd.spil('glad'); setTimeout(() => { if (aktiv === n && !n.faerdig) tale(); }, 1100); }
    else tale();
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
    if (!rod || skjult() || !t) return;
    if (tur && !valg.tur) stopTur(false); // en vigtig besked afbryder rundvisningen
    if (valg.nu) koe = [];
    koe.push({ tekst: String(t), peg: valg.peg || null, glad: !!valg.glad, stor: !!valg.stor, knap: valg.knap || null, tur: !!valg.tur, under: !!valg.under, nr: valg.nr, af: valg.af });
    if (!aktiv || valg.nu) naeste();
  }
  function glad(t) { if (tur) stopTur(false); if (t) sig(t, { glad: true, nu: true }); else if (rod && !skjult()) { saetTilstand('glad'); Lyd.spil('glad'); setTimeout(() => { if (!aktiv) saetTilstand('hvile'); }, 1100); } }

  // ---------- Rundvisning: Grydelil hopper hen til emnet og peger ----------
  function placerBoble(tur) {
    boble.style.translate = '0 0';
    if (!tur) return;
    const w = Math.min(270, innerWidth - 24), venstre = rod.getBoundingClientRect().right - 4 - w;
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
  function anim(el, kf, opt) { const a = el.animate(kf, { fill: 'forwards', ...opt }); anims.push(a); return a.finished.catch(() => {}); }
  function stopAnim() { anims.forEach(a => { try { a.cancel(); } catch (e) { /* ok */ } }); anims = []; if (rod) rod.classList.remove('skridt'); }
  function markerFjern() { document.querySelectorAll('.h-maal').forEach(e => e.classList.remove('h-maal')); }

  // Bevægelserne: salto (hop og drej rundt), dans (små hop og vrid), skridt (ét langt skridt, benene strækkes), rul (ligger ned og ruller), hop (to hop)
  async function flyt(nx, ny, navn) {
    const mit = ++bevNr, fx = offX, fy = offY, dx = nx - fx, dy = ny - fy, dist = Math.hypot(dx, dy);
    const sat = () => { stopAnim(); offX = nx; offY = ny; rod.style.transform = nx || ny ? `translate(${nx}px, ${ny}px)` : ''; };
    if (rolig() || dist < 6) { sat(); return; }
    const d = Math.round(Math.max(700, Math.min(1250, 520 + dist * 0.7)));
    const pos = (t, loft = 0) => `translate(${fx + dx * t}px, ${fy + dy * t - loft}px)`;
    const kf = (fn, n = 16) => Array.from({ length: n + 1 }, (_, i) => ({ transform: fn(i / n) }));
    const svg = figur.querySelector('svg'), job = [];
    saetTilstand('flyv');
    if (navn === 'salto') {
      Lyd.spil('salto');
      job.push(anim(rod, kf(t => pos(ease(t), Math.sin(Math.PI * t) * (60 + dist * 0.12))), { duration: d, easing: 'linear' }));
      job.push(anim(svg, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-360deg)' }], { duration: d * 0.85, delay: d * 0.08, easing: 'ease-in-out' }));
    } else if (navn === 'dans') {
      Lyd.spil('hop');
      job.push(anim(rod, kf(t => pos(ease(t), Math.abs(Math.sin(Math.PI * t * 3)) * 22), 24), { duration: d * 1.2, easing: 'linear' }));
      job.push(anim(svg, kf(t => `rotate(${Math.sin(Math.PI * t * 6) * 13}deg)`, 24), { duration: d * 1.2, easing: 'linear' }));
    } else if (navn === 'skridt') {
      rod.classList.add('skridt'); rod.style.setProperty('--d', d + 'ms');
      job.push(anim(rod, kf(t => pos(ease(t), Math.sin(Math.PI * t) * 8)), { duration: d, easing: 'linear' }));
      job.push(anim(svg, [{ transform: 'none' }, { transform: 'skewX(-14deg) scale(1.08, .88)', offset: .45 }, { transform: 'skewX(6deg)', offset: .8 }, { transform: 'none' }], { duration: d }));
    } else if (navn === 'rul') {
      Lyd.spil('hop');
      job.push(anim(rod, kf(t => pos(ease(t), Math.sin(Math.PI * t) * 10)), { duration: d * 1.1, easing: 'linear' }));
      job.push(anim(svg, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(90deg)', offset: .14 }, { transform: 'rotate(450deg)', offset: .86 }, { transform: 'rotate(360deg)' }], { duration: d * 1.1, easing: 'ease-in-out' }));
    } else { // hop
      Lyd.spil('hop');
      job.push(anim(rod, kf(t => pos(ease(t), Math.abs(Math.sin(Math.PI * t * 2)) * 30)), { duration: d, easing: 'linear' }));
      job.push(anim(svg, [{ transform: 'none' }, { transform: 'scale(.9, 1.12)', offset: .2 }, { transform: 'scale(1.1, .88)', offset: .5 }, { transform: 'scale(.92, 1.1)', offset: .72 }, { transform: 'none' }], { duration: d }));
    }
    await Promise.all(job);
    if (mit !== bevNr) return; // afbrudt
    sat(); Lyd.spil('bump');
    await anim(svg, [{ transform: 'scale(1.12, .86)' }, { transform: 'none' }], { duration: 180, easing: 'ease-out' });
    if (mit === bevNr) { stopAnim(); saetTilstand('hvile'); }
  }

  async function startTur() {
    koe = []; stop();
    tur = { id: ++turId, trin: sideTekst, i: -1 };
    trinTur(0);
  }
  async function trinTur(i) {
    const t = tur; if (!t) return;
    if (i >= t.trin.length) return slutTur();
    const id = t.id, s = t.trin[i];
    const el = s.maal ? document.querySelector(s.maal) : null;
    if (s.valgfri && !el) return trinTur(i + 1);
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
    await flyt(p ? p.x - (f.left - offX) : (el ? 0 : offX), p ? p.y - (f.top - offY) : (el ? 0 : offY), s.bev || 'hop');
    if (!tur || tur.id !== id) return;
    if (s.bev === 'dans') { saetTilstand('dans'); await vent(1100); if (!tur || tur.id !== id) return; }
    if (el) el.classList.add('h-maal');
    flytter = false;
    sig(s.tekst, { peg: el, nu: true, tur: true, under: !!(p && p.under), nr: i + 1, af: t.trin.length });
  }
  function naesteTur() { if (tur && !flytter) trinTur(tur.i + 1); }
  async function slutTur() {
    tur = null; stop(); markerFjern(); flytter = true;
    await flyt(0, 0, 'hop');
    flytter = false; glad();
  }
  async function stopTur(animer) {
    tur = null; ++bevNr; stopAnim(); markerFjern(); stop(); flytter = false;
    if (rod) rod.classList.remove('skridt');
    if (!offX && !offY) return;
    if (animer) { flytter = true; await flyt(0, 0, 'hop'); flytter = false; }
    else { offX = offY = 0; rod.style.transform = ''; saetTilstand('hvile'); }
  }

  function start() {
    byg();
    if (!lager.hent('intro_set', false)) {
      lager.gem('intro_set', true);
      sig('Hej! Jeg hedder Grydelil. Jeg hjælper dig i køkkenet.');
      sig('Tryk på Opskrifter for at finde en ret. Blå ord i en opskrift kan du trykke på, så forklarer jeg dem.');
      sig('Tryk på mig, så viser jeg dig rundt på siden. Tryk på krydset, hvis jeg skal gemme mig.');
    }
  }
  return { start, sig, glad, vis, skjult, stille: () => { koe = []; if (rod) stop(); }, side: t => { sideTekst = t || ''; if (rod && (tur || offX || offY)) stopTur(false); } };
})();
