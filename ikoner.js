// Kogebogs egne ikoner: blækstreg i kladdehæftets stil med en flade af farve bagved.
// Streg = currentColor (blæk), flader = --i1 / --i2 (med rollerne --ik-* som reserve, se style.css).
const Ikoner = (() => {
  // viewBox 24 x 24. Hver ikon er indmaden af en SVG.
  const D = {
    gryde: `<path d="M5 10h14v4.5a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5z" fill="var(--i1,var(--ik-gryde))"/><path d="M3.5 10h17"/><path d="M5 8.5q7-5 14 0"/><circle cx="12" cy="5.2" r="1.1" fill="var(--i2,var(--ik-smoer))"/><path d="M9.5 14.2v.8M14.5 14.2v.8"/><path d="M11 16.4q1 .9 2 0"/>`,
    paere: `<path d="M12 3.5a5.5 5.5 0 0 0-3.2 10c.5.4.8 1 .8 1.6v.4h4.8v-.4c0-.6.3-1.2.8-1.6A5.5 5.5 0 0 0 12 3.5z" fill="var(--i1,var(--ik-smoer))"/><path d="M9.8 18.2h4.4M10.6 20.5h2.8"/><path d="M12 7.5v3"/>`,
    tag: `<path d="M4 12.5V5a1 1 0 0 1 1-1h7.5l7.5 7.5-8.5 8.5z" fill="var(--i1,var(--ik-smoer))"/><circle cx="8.5" cy="8.5" r="1.3"/>`,
    kurv: `<path d="M3.5 10h17l-1.6 8.6a1.5 1.5 0 0 1-1.5 1.2H6.6a1.5 1.5 0 0 1-1.5-1.2z" fill="var(--i1,var(--ik-rosa))"/><path d="M8 10l3-5.5M16 10l-3-5.5"/><path d="M9 13.5v3.5M12 13.5v3.5M15 13.5v3.5"/>`,
    gnist: `<path d="M10 3.5l1.6 5 5 1.6-5 1.6-1.6 5-1.6-5-5-1.6 5-1.6z" fill="var(--i1,var(--ik-smoer))"/><path d="M18 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" fill="var(--i2,var(--ik-rosa))"/>`,
    blyant: `<path d="M4 20l1-4.5L15.8 4.7a1.8 1.8 0 0 1 2.5 0l1 1a1.8 1.8 0 0 1 0 2.5L8.5 19z" fill="var(--i1,var(--ik-smoer))"/><path d="M14.3 6.2l3.5 3.5M4 20l4.5-1-3.5-3.5z"/>`,
    ur: `<circle cx="12" cy="13.5" r="7" fill="var(--i1,var(--ik-mynte))"/><path d="M9.5 3.5h5M12 3.5v3M18.5 7l1.2-1.2"/><path d="M12 13.5V9.8M12 13.5l2.6 1.6"/>`,
    stjerne: `<path d="M12 3.6l2.5 5.3 5.8.7-4.3 4 1.1 5.8L12 16.5l-5.1 2.9L8 13.6l-4.3-4 5.8-.7z" fill="var(--i1,var(--ik-guld))"/>`,
    stjerne0: `<path d="M12 3.6l2.5 5.3 5.8.7-4.3 4 1.1 5.8L12 16.5l-5.1 2.9L8 13.6l-4.3-4 5.8-.7z" fill="none"/>`,
    kamera: `<path d="M3.5 8.5a1.5 1.5 0 0 1 1.5-1.5h2.2l1.3-2h7l1.3 2H19a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z" fill="var(--i1,var(--ik-himmel))"/><circle cx="12" cy="13" r="3.4" fill="var(--i2,var(--ik-papir))"/>`,
    gulerod: `<path d="M16.5 8.5 6.2 19.4a1.2 1.2 0 0 1-2-1.2L8.5 7.5a5 5 0 0 1 8 1z" fill="var(--i1,var(--ik-orange))"/><path d="M9.5 11l1.8.6M7.8 14.5l1.8.6"/><path d="M15 9.2l3-4.7M16.6 8.6l4.2-2.2M14.2 7.4l1.6-4"/>`,
    kalender: `<rect x="4" y="5.5" width="16" height="14.5" rx="2.5" fill="var(--i1,var(--ik-mynte))"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/><path d="M8.5 14h.01M12 14h.01M15.5 14h.01M8.5 17h.01M12 17h.01" stroke-width="2.2"/>`,
    hus: `<path d="M5.5 11v8a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-8" fill="var(--i1,var(--ik-smoer))"/><path d="M3 12l9-8 9 8"/><path d="M10 20.5v-4.8a2 2 0 0 1 4 0v4.8" fill="var(--i2,var(--ik-papir))"/>`,
    genindlaes: `<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" fill="none"/><path d="M18.5 3v4.5H14" fill="none"/>`,
    tandhjul: `<path d="M9.87 5.12L10.41 2.74L13.59 2.74L14.13 5.12L15.36 5.63L17.43 4.32L19.68 6.57L18.37 8.64L18.88 9.87L21.26 10.41L21.26 13.59L18.88 14.13L18.37 15.36L19.68 17.43L17.43 19.68L15.36 18.37L14.13 18.88L13.59 21.26L10.41 21.26L9.87 18.88L8.64 18.37L6.57 19.68L4.32 17.43L5.63 15.36L5.12 14.13L2.74 13.59L2.74 10.41L5.12 9.87L5.63 8.64L4.32 6.57L6.57 4.32L8.64 5.63z" fill="var(--i1,var(--ik-himmel))"/><circle cx="12" cy="12" r="3" fill="var(--i2,var(--ik-papir))"/>`,
    laas: `<rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="var(--i1,var(--ik-smoer))"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/><path d="M12 14.6v2" stroke-width="2"/>`,
    laasop: `<rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="var(--i1,var(--ik-mynte))"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 6.7-1.5"/><path d="M12 14.6v2" stroke-width="2"/>`,
    tjek: `<path d="M5 12.8l4.2 4.2L19 7.2" stroke-width="2.4"/>`,
    pause: `<rect x="6.2" y="5" width="3.8" height="14" rx="1.4" fill="var(--i1,var(--ik-smoer))"/><rect x="14" y="5" width="3.8" height="14" rx="1.4" fill="var(--i1,var(--ik-smoer))"/>`,
    hent: `<path d="M12 4v11M7.5 11l4.5 4.5 4.5-4.5M5 19.5h14"/>`,
    deltrin: `<path d="M6 5v8a2 2 0 0 0 2 2h10M14.5 11.5 18 15l-3.5 3.5"/>`,
    // Figurer til lærredet: lidt mere farve
    hjerte: `<path d="M12 20.2C5.5 15.6 3.5 12.2 3.5 9a4.6 4.6 0 0 1 8.5-2.4A4.6 4.6 0 0 1 20.5 9c0 3.2-2 6.6-8.5 11.2z" fill="var(--i1,var(--ik-tomat))"/><path d="M7 8.2q.8-1.4 2.2-1.4" stroke="#fff" stroke-width="1.4"/>`,
    tomat: `<circle cx="12" cy="13.5" r="7.2" fill="var(--i1,var(--ik-tomat))"/><path d="M8 7.6l2.4 1.2L12 6.6l1.6 2.2 2.4-1.2-.8 2.6H8.8z" fill="var(--i2,var(--ik-blad))"/><path d="M12 6.6V4.5"/><path d="M8.6 12.4q.4-1.4 1.6-1.8" stroke="#fff" stroke-width="1.3"/>`,
    ost: `<path d="M3.5 17.5V11L20.5 6.5v11z" fill="var(--i1,var(--ik-smoer))"/><path d="M3.5 11L20.5 6.5"/><circle cx="9" cy="14.2" r="1.4" fill="var(--i2,var(--ik-papir))"/><circle cx="15" cy="11.2" r="1" fill="var(--i2,var(--ik-papir))"/><circle cx="16.5" cy="14.8" r="1.2" fill="var(--i2,var(--ik-papir))"/>`,
    baguette: `<path d="M17.5 3.8a2.7 2.7 0 0 1 2.7 2.7c0 1.4-.8 2.4-1.8 3.4L9.9 18.4c-1 1-2 1.8-3.4 1.8a2.7 2.7 0 0 1-2.7-2.7c0-1.4.8-2.4 1.8-3.4l8.5-8.5c1-1 2-1.8 3.4-1.8z" fill="var(--i1,var(--ik-brod))"/><path d="M10.2 8.2l2.4 2.4M7.6 10.8l2.4 2.4M12.8 5.6l2.4 2.4"/>`,
    aeg: `<path d="M4.5 12.5C4 8 7.5 4.8 12 5.2c3 .3 3.8 1.8 6 2 2.2.2 3 2.6 2.4 5-.7 3-3.2 5.3-6.6 5.6-3.4.3-4.6-1.2-6.8-1.4-1.6-.2-2.4-1.2-2.5-3.9z" fill="var(--i2,var(--ik-papir))"/><circle cx="11.5" cy="11.2" r="3.1" fill="var(--i1,var(--ik-smoer))"/>`,
    cupcake: `<path d="M6 12h12l-1.7 7.2a1.2 1.2 0 0 1-1.2.9H8.9a1.2 1.2 0 0 1-1.2-.9z" fill="var(--i2,var(--ik-gryde))"/><path d="M5 12.2a3.6 3.6 0 0 1 2-6.2 4.4 4.4 0 0 1 8.6-.6A3.6 3.6 0 0 1 19 12.2z" fill="var(--i1,var(--ik-rosa))"/><circle cx="12" cy="3.4" r="1.3" fill="var(--i3,var(--ik-tomat))"/><path d="M10 14.5v4M14 14.5v4"/>`,
    tommel: `<path d="M3.5 11h3.2v8.5H3.5z" fill="var(--i2,var(--ik-himmel))"/><path d="M6.7 11.5l3.4-6.6a1.8 1.8 0 0 1 3.3 1.3L12.6 9.5h5.7a2 2 0 0 1 2 2.4l-1.2 6a2.4 2.4 0 0 1-2.3 1.9H6.7z" fill="var(--i1,var(--ik-smoer))"/>`
  };

  const svg = (navn, extra = '') => {
    const d = D[navn];
    if (!d) return '';
    return `<svg class="ikon ikon-${navn}${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
  };

  // Som billede (til lærredet): variablerne og currentColor skal være faste farver
  const billede = navn => {
    const rod = getComputedStyle(document.documentElement), v = x => rod.getPropertyValue(x).trim();
    const s = svg(navn)
      .replace(/var\(--i\d,var\((--ik-[a-z]+)\)\)/g, (_, x) => v(x))
      .replace('class="ikon', 'xmlns="http://www.w3.org/2000/svg" width="96" height="96" class="ikon')
      .replace(/currentColor/g, v('--blaek'));
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  };

  const stjerner = (n, af = 5) => Array.from({ length: af }, (_, i) => svg(i < n ? 'stjerne' : 'stjerne0')).join('');
  return { svg, billede, stjerner, navne: Object.keys(D) };
})();

// Ikoner i den faste HTML (fx tandhjulet foroven): <a data-ikon="tandhjul">
document.querySelectorAll('[data-ikon]').forEach(e => { e.innerHTML = Ikoner.svg(e.dataset.ikon); });
