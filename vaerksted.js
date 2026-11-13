// Værkstedet (opdatering 4d-1): en kode, der spærrer Designer (og senere Ingrediensværktøjet) mod uheld.
// Det er kun en spærring: tabellerne er åbne, og ventetiden efter forkerte forsøg ligger i appen. Rigtig sikkerhed kommer med login.
// Koden står aldrig i koden. Kun et saltet hash (PBKDF2) ligger i Supabase: tabellen «madplan», rækken «vaerksted-kode».
// Låst/oplåst: oplåsningen ligger i sessionStorage (forsvinder, når appen lukkes). «Lås ikke på denne enhed» og «Behold Designer» ligger i localStorage (lager).
const Vaerksted = (() => {
  const RAEKKE_ID = 'vaerksted-kode', ITER = 200000, MIN = 4, GRAENSE = 3;
  const SS = 'kogebog_vaerksted_oplaast';
  const ssHent = () => { try { return sessionStorage.getItem(SS) === '1'; } catch (e) { return false; } };
  const ssSaet = v => { try { v ? sessionStorage.setItem(SS, '1') : sessionStorage.removeItem(SS); } catch (e) { /* privat tilstand */ } };
  const husk = () => !!lager.hent('vaerkstedHusk', false); // «Lås ikke Værkstedet på denne enhed»
  const behold = () => !!lager.hent('vaerkstedBehold', false); // Designer bliver tændt, når Værkstedet låses
  const oplaast = () => husk() || ssHent();
  const maaDesigner = () => oplaast() || behold();
  // Er Designer tændt uden at måtte være det, slukkes den
  const haandhaev = () => { if (typeof Tilpas !== 'undefined' && Tilpas.til() && !maaDesigner()) Tilpas.saet(false); };

  // Hash: PBKDF2 med SHA-256 og et tilfældigt salt (Web Crypto, ingen pakker)
  const tilB64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const fraB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function afled(kode, salt, iter) {
    const nogle = await crypto.subtle.importKey('raw', new TextEncoder().encode(kode), 'PBKDF2', false, ['deriveBits']);
    return tilB64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, nogle, 256));
  }
  const nyData = async kode => { const salt = crypto.getRandomValues(new Uint8Array(16)); return { salt: tilB64(salt), hash: await afled(kode, salt, ITER), iter: ITER }; };
  const hentRaekke = async () => (await api(`madplan?id=eq.${RAEKKE_ID}&select=data`))[0]?.data || null;

  // Ventetid efter forkerte forsøg: 30 sekunder efter tre, derefter dobbelt så lang (højst 10 minutter). Huskes på enheden.
  const fejlTilstand = () => lager.hent('vaerkstedFejl', { n: 0, til: 0 });
  const ventSek = () => Math.max(0, Math.ceil((fejlTilstand().til - Date.now()) / 1000));
  function forkert() {
    const n = fejlTilstand().n + 1;
    lager.gem('vaerkstedFejl', { n, til: n >= GRAENSE ? Date.now() + Math.min(600, 30 * 2 ** (n - GRAENSE)) * 1000 : 0 });
  }
  const ryd = () => lager.gem('vaerkstedFejl', { n: 0, til: 0 });

  // Fejl står ved feltet og i en fejlboks øverst, og fokus flyttes til feltet (formularer-og-input)
  const visFejl = (felt, tekst) => {
    const boks = $('#vk-fejl'); boks.textContent = tekst; boks.hidden = false;
    felt.setAttribute('aria-invalid', 'true'); felt.setAttribute('aria-describedby', 'vk-fejl'); felt.focus();
  };
  const nulstilFejl = () => { const b = $('#vk-fejl'); if (b) { b.hidden = true; b.textContent = ''; } document.querySelectorAll('#app [aria-invalid]').forEach(f => { f.removeAttribute('aria-invalid'); f.removeAttribute('aria-describedby'); }); };
  const visKode = `<label class="skift"><input type="checkbox" id="vk-vis"> <span>Vis koden</span></label>`;
  const fejlBoks = `<p class="fejlboks" id="vk-fejl" role="alert" hidden></p>`;
  const vis = () => { const c = $('#vk-vis'); if (c) c.addEventListener('change', () => document.querySelectorAll('#app .vk-kode').forEach(i => { i.type = c.checked ? 'text' : 'password'; })); };

  function laastSide(rk) {
    const ny = !rk;
    app.innerHTML = `${Ikoner.tilbage('#/mere')}
      <h2>Værkstedet</h2>
      <p class="lille">${ny ? 'Her ligger værktøjerne. Vælg en kode, så de ikke bliver åbnet ved et uheld. Skriv den ikke andre steder end her.' : 'Her ligger værktøjerne. De er låst med en kode, så de ikke bliver åbnet ved et uheld.'}</p>
      ${fejlBoks}
      <form id="vk-form" novalidate>
        <label for="vk1" class="lille">${ny ? 'Ny kode (mindst ' + MIN + ' tegn)' : 'Kode'}</label>
        <input id="vk1" class="vk-kode felt felt-m" type="password" autocomplete="${ny ? 'new-password' : 'current-password'}" autocapitalize="off" spellcheck="false" enterkeyhint="${ny ? 'next' : 'go'}">
        ${ny ? `<label for="vk2" class="lille">Skriv koden igen</label>
        <input id="vk2" class="vk-kode felt felt-m" type="password" autocomplete="new-password" autocapitalize="off" spellcheck="false" enterkeyhint="go">` : ''}
        ${visKode}
        <button type="submit" class="knap ${ny ? 'gem' : 'hoved'}">${ik(ny ? 'tjek' : 'laasop')} ${ny ? 'Gem koden' : 'Åbn Værkstedet'}</button>
      </form>`;
    vis();
    $('#vk1').focus();
    $('#vk-form').addEventListener('submit', async e => {
      e.preventDefault(); nulstilFejl();
      const f1 = $('#vk1'), f2 = $('#vk2'), kode = f1.value;
      if (!kode) return visFejl(f1, 'Skriv koden.');
      try {
        if (ny) {
          if (kode.length < MIN) return visFejl(f1, `Koden skal være mindst ${MIN} tegn.`);
          if (kode !== f2.value) return visFejl(f2, 'De to koder er ikke ens. Skriv den samme kode igen.');
          // «ignorer»: findes en kode allerede (sat på en anden enhed i mellemtiden), overskrives den ikke
          const sat = await api('madplan?on_conflict=id', { method: 'POST', flet: 'ignorer', body: { id: RAEKKE_ID, data: await nyData(kode), opdateret: new Date().toISOString() } });
          if (!sat.length) { toast('Der er allerede valgt en kode. Skriv den.'); return route(); }
          ssSaet(true); toast('Koden er gemt. Værkstedet er åbent.'); return route();
        }
        const v = ventSek();
        if (v) return visFejl(f1, `Du har prøvet for mange gange. Vent ${v} sekunder, og prøv igen.`);
        if (await afled(kode, fraB64(rk.salt), rk.iter) !== rk.hash) {
          forkert(); const w = ventSek();
          return visFejl(f1, w ? `Koden passer ikke. Vent ${w} sekunder, og prøv igen.` : 'Koden passer ikke. Prøv igen.');
        }
        ryd(); ssSaet(true); route();
      } catch (err) { console.error(err); visFejl(f1, 'Det virkede ikke lige nu. Tjek internettet, og prøv igen.'); }
    });
  }

  // Designer-afsnittet, flyttet hertil fra Indstillinger (felterne beholder deres data-tpid)
  function oplaastSide() {
    app.innerHTML = `${Ikoner.tilbage('#/mere')}
      <h2>Værkstedet</h2>
      <h2>Designer</h2>
      <label class="skift"><input type="checkbox" id="tilpastil" ${Tilpas.til() ? 'checked' : ''}> <span>Åbn Designer</span></label>
      <p class="lille">Designer flytter, tilføjer og skjuler felter og skifter tekst og farver. Ændringerne gælder alle, der bruger kogebogen.</p>
      <button type="button" class="knap" id="tilpastip">Vis tippet om Designer igen</button>
      <button class="knap annuller" id="tilpasnul">Nulstil alle tekster</button>
      <p class="lille" data-tpid="mere|hvor-højt-vinduet-til-at-tilpasse-et-felt-må-blive-i-procent-af-skærmen">Hvor højt Designers vindue må blive, i procent af skærmen.</p>
      <div class="stepper" data-tpid="mere-tilpashoejde" role="group" aria-label="Højde på Designers vindue">
        <button type="button" class="rund felt felt-s" data-tpid="mere-minus" id="tphned" aria-label="Lavere">−</button>
        <input id="tphoejde" class="felt felt-s" data-tpid="mere-tal" type="text" inputmode="numeric" autocomplete="off" value="${tilpasHoejde()}" aria-label="Højde i procent">
        <button type="button" class="rund felt felt-s" data-tpid="mere-plus" id="tpop" aria-label="Højere">+</button><span class="stepper-enhed">%</span></div>
      <h2>Lås</h2>
      <label class="skift"><input type="checkbox" id="vk-husk" ${husk() ? 'checked' : ''}> <span>Lås ikke Værkstedet på denne enhed</span></label>
      <p class="lille">Så skal du ikke skrive koden hver gang. Slå det kun til på din egen telefon eller computer.</p>
      <label class="skift"><input type="checkbox" id="vk-behold" ${behold() ? 'checked' : ''} ${husk() || behold() ? '' : 'disabled'}> <span>Behold Designer</span></label>
      <p class="lille" id="vk-behold-tekst">${husk() || behold() ? 'Designer bliver tændt, også når du låser Værkstedet.' : 'Kan kun slås til, når Værkstedet ikke låses på denne enhed.'}</p>
      <button type="button" class="knap" id="vk-laas">${ik('laas')} Lås nu</button>
      <h2>Skift kode</h2>
      ${fejlBoks}
      <form id="vk-skift" novalidate>
        <label for="vk0" class="lille">Nuværende kode</label>
        <input id="vk0" class="vk-kode felt felt-m" type="password" autocomplete="current-password" autocapitalize="off" spellcheck="false">
        <label for="vk1" class="lille">Ny kode (mindst ${MIN} tegn)</label>
        <input id="vk1" class="vk-kode felt felt-m" type="password" autocomplete="new-password" autocapitalize="off" spellcheck="false">
        <label for="vk2" class="lille">Skriv den nye kode igen</label>
        <input id="vk2" class="vk-kode felt felt-m" type="password" autocomplete="new-password" autocapitalize="off" spellcheck="false" enterkeyhint="go">
        ${visKode}
        <button type="submit" class="knap gem">${ik('tjek')} Gem den nye kode</button>
      </form>`;
    vis();
    $('#vk-skift').addEventListener('submit', async e => {
      e.preventDefault(); nulstilFejl();
      const f0 = $('#vk0'), f1 = $('#vk1'), f2 = $('#vk2');
      if (!f0.value) return visFejl(f0, 'Skriv den nuværende kode.');
      if (f1.value.length < MIN) return visFejl(f1, `Den nye kode skal være mindst ${MIN} tegn.`);
      if (f1.value !== f2.value) return visFejl(f2, 'De to nye koder er ikke ens. Skriv den samme kode igen.');
      const v = ventSek();
      if (v) return visFejl(f0, `Du har prøvet for mange gange. Vent ${v} sekunder, og prøv igen.`);
      try {
        const rk = await hentRaekke();
        if (rk && await afled(f0.value, fraB64(rk.salt), rk.iter) !== rk.hash) {
          forkert(); const w = ventSek();
          return visFejl(f0, w ? `Den nuværende kode passer ikke. Vent ${w} sekunder, og prøv igen.` : 'Den nuværende kode passer ikke. Prøv igen.');
        }
        ryd();
        await api('madplan?on_conflict=id', { method: 'POST', flet: true, body: { id: RAEKKE_ID, data: await nyData(f1.value), opdateret: new Date().toISOString() } });
        [f0, f1, f2].forEach(f => { f.value = ''; }); toast('Den nye kode er gemt');
      } catch (err) { console.error(err); visFejl(f0, 'Det virkede ikke lige nu. Tjek internettet, og prøv igen.'); }
    });
    $('#tilpastil').addEventListener('change', e => Tilpas.saet(e.target.checked));
    $('#tilpastip').addEventListener('click', () => Tilpas.tipIgen());
    const saetHoejde = n => { const v = Math.max(20, Math.min(90, Math.round(Number(n)) || 33)); lager.gem('tilpasHoejde', v); $('#tphoejde').value = v; };
    $('#tphned').addEventListener('click', () => saetHoejde(tilpasHoejde() - 5));
    $('#tpop').addEventListener('click', () => saetHoejde(tilpasHoejde() + 5));
    $('#tphoejde').addEventListener('change', e => saetHoejde(e.target.value));
    $('#tilpasnul').addEventListener('click', async () => { if (await bekraeft('Vil du sætte alle tekster og størrelser tilbage?', 'Nulstil')) { Tilpas.nulstil(); toast('Teksterne er nulstillet'); } });
    $('#vk-husk').addEventListener('change', e => {
      lager.gem('vaerkstedHusk', e.target.checked);
      // Uden «Lås ikke» kan Designer ikke holdes tændt, når der låses, så «Behold» slås fra
      if (!e.target.checked) lager.gem('vaerkstedBehold', false);
      ssSaet(true); // man er stadig inde i Værkstedet
      $('#vk-behold').checked = behold(); $('#vk-behold').disabled = !e.target.checked && !behold();
      $('#vk-behold-tekst').textContent = e.target.checked ? 'Designer bliver tændt, også når du låser Værkstedet.' : 'Kan kun slås til, når Værkstedet ikke låses på denne enhed.';
      toast(e.target.checked ? 'Værkstedet er åbent på denne enhed' : 'Værkstedet låses igen, når appen lukkes');
    });
    $('#vk-behold').addEventListener('change', e => { lager.gem('vaerkstedBehold', e.target.checked); toast(e.target.checked ? 'Designer bliver tændt, når du låser' : 'Designer slukkes, når du låser'); });
    $('#vk-laas').addEventListener('click', () => {
      ssSaet(false); lager.gem('vaerkstedHusk', false); // «Lås nu» låser også en husket enhed
      haandhaev(); toast('Værkstedet er låst'); route();
    });
  }

  async function side() {
    if (oplaast()) { ssSaet(true); return oplaastSide(); }
    app.innerHTML = `${Ikoner.tilbage('#/mere')}<h2>Værkstedet</h2><p class="lille">Henter…</p>`;
    const rk = await hentRaekke();
    if (location.hash === '#/vaerksted') laastSide(rk); // man kan have forladt siden, mens koden blev hentet
  }
  haandhaev();
  return { side, oplaast, maaDesigner, haandhaev };
})();
