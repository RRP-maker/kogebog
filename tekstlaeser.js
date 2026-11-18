// Tekstlæseren: fri tekst -> opskrift. Bruges af «Importér opskrift» til tekst, man sætter ind eller skriver, til indholdet af filer (se filleser.js)
// og til sidetekst fra links, der ikke har en færdig opskrift. Ingen nøgler, ingen netværk: alt sker her i appen.
// Den kan læse pæne opskrifter med overskrifter og rodede uden: stavefejl, små bogstaver, ingredienser på én linje, alt i ét afsnit,
// tal som ord («to løg»), engelske overskrifter, markdown, og tekst helt uden ingredienslinjer (så udledes de af trinene).
// Giver { j, udledt? } (j går til laesEn) eller { fejl }.
const Tekstlaeser = (() => {
  // ---------- Ordforråd ----------
  // Varer, vi kender. Bruges til at se, om en linje er en ingrediens, til at rette stavefejl og til at finde ingredienser i trin.
  const VARER = `løg|rødløg|forårsløg|skalotteløg|hvidløg|ingefær|chili|rød chili|grøn chili|chiliflager|persille|bredbladet persille|dild|basilikum|koriander|timian|rosmarin|oregano|mynte|purløg|salvie|laurbærblade|krydderurter|
gulerod|gulerødder|kartoffel|kartofler|søde kartofler|tomat|tomater|cherrytomater|hakkede tomater|flåede tomater|soltørrede tomater|tomatpuré|tomatsauce|passata|agurk|salat|iceberg|rucola|spinat|grønkål|kål|hvidkål|rødkål|spidskål|broccoli|blomkål|squash|aubergine|peberfrugt|rød peberfrugt|gul peberfrugt|grøn peberfrugt|porre|porrer|selleri|bladselleri|selleriknold|pastinak|rødbede|rødbeder|majs|ærter|bønner|edamamebønner|kidneybønner|kikærter|linser|svampe|champignon|avocado|citron|lime|appelsin|appelsiner|æble|æbler|pære|pærer|mango|banan|ananas|granatæble|fennikel|asparges|aspargessnitter|grønne asparges|oliven|kapers|rosiner|tranebær|
kød|bacon|pølse|pølser|salsiccia|guanciale|pancetta|skinke|hakket oksekød|hakket svinekød|hakket kød|hakket kalv|svinekød|oksekød|kylling|kyllingebryst|kyllingefilet|kyllingelår|hønsebryst|and|flæsk|medister|laks|røget laks|torsk|rejer|tigerrejer|tun|tunfisk|sardiner|ansjoser|frikadellefars|
æg|æggeblommer|æggeblomme|æggehvider|mælk|fløde|piskefløde|madlavningsfløde|cremefraiche|creme fraiche|smør|parmesan|pecorino|ost|feta|fetaost|mozzarella|cheddar|flødeost|yoghurt|skyr|mayonnaise|revet ost|
pasta|spaghetti|linguine|fettuccine|penne|tagliatelle|makaroni|ris|basmatiris|jasminris|nudler|quinoa|couscous|havregryn|mel|hvedemel|majsstivelse|sukker|brun farin|farin|honning|bagepulver|gær|brød|toastbrød|tortilla|tortillas|tortillapandekager|tarteletter|rasp|panko|nødder|valnødder|mandler|cashewnødder|pinjekerner|hasselnødder|pekannødder|solsikkekerner|græskarkerner|sesamfrø|
salt|flagesalt|peber|sort peber|paprika|spidskommen|karry|kanel|muskatnød|gurkemeje|cayennepeber|soja|sojasauce|teriyakisauce|sriracha|eddike|balsamico|riseddike|æbleeddike|sennep|dijonsennep|ketchup|pesto|olie|olivenolie|rapsolie|sesamolie|bouillon|fond|grøntsagsbouillon|hønsebouillon|vand|rødvin|hvidvin|vin|øl|pastavand|kogevand|nudler|tahin|mynte`.replace(/\n/g, '').split('|').map(x => x.trim()).filter(Boolean);
  // Andre stavemåder (og de mest almindelige tastefejl) -> ordet i VARER
  const STAVNING = { spagetti: 'spaghetti', spaghettie: 'spaghetti', chilli: 'chili', chille: 'chili', hvidlog: 'hvidløg', hvidloeg: 'hvidløg', persile: 'persille', parmasan: 'parmesan', parmesaan: 'parmesan', mozarella: 'mozzarella', mozerella: 'mozzarella',
    kartofler: 'kartofler', kartoffler: 'kartofler', tomatter: 'tomater', agurker: 'agurk', mayo: 'mayonnaise', 'creme fraice': 'creme fraiche', cremefrache: 'cremefraiche', fløe: 'fløde', flode: 'fløde', maelk: 'mælk', smor: 'smør', oksekod: 'oksekød', 'hakket oksekod': 'hakket oksekød', gulerodder: 'gulerødder', gulerod: 'gulerod', saltt: 'salt', peper: 'peber', olivenolje: 'olivenolie', oliven: 'oliven', ost: 'ost', koriander: 'koriander', balsamico: 'balsamico', sukkker: 'sukker' };
  const VERBER = new Set(`kog koge steg steger skær hak bland rør kom kommer tilsæt hæld vend server serveres lad tag varm smelt pisk riv pres drys anret form læg sæt tænd sluk smag krydr afkøl rist bag skyl pil skræl snit del fordel tør dræn sigt mos mas kværn stød gnid marinér rul fyld pynt top kør put start lav begynd sørg husk tilbered reducér simr hold brun svits sauter bring skru flyt vask rens pluk fjern gør tilsæt hæld kom smør giv bind klip skub tryk træk forvarm sæt prik pensl kværn krydre lun opvarm nedkøl køl afdryp vend rør steg kog`.split(/\s+/));
  const verbStart = l => { const f = (String(l).toLowerCase().match(/[a-zæøå]+/) || [''])[0]; return VERBER.has(f) && !(f === 'smør' && !/^smør\s+(?:en|et|den|dem|formen|bunden|panden|brød|brødet|gryden|tarteletterne|bagepladen|dejen)\b/i.test(l)); }; // «Smør en pande» er et trin, «smør til at stege i» er en vare
  const TRINSTART = /^(først|så|derefter|dernæst|efter|når|imens|til sidst|herefter|nu|slut|start|tilsidst|inden)\b/i;
  const ADJ = new Set(`hele helt store stor små lille friske frisk tørrede tørret revet revne hakket hakkede finthakket finthakkede grofthakket grofthakkede groft fint presset pressede skåret skårne snittet snittede flere nogle et par lidt godt god gode ca cirka cirka mindre`.split(/\s+/));
  const PREP_FOERSTE = new Set(`finthakket finthakkede grofthakket grofthakkede hakket hakkede revet revne friskrevet friskrevne presset pressede skåret skårne snittet snittede pillet pillede skrællet skrællede optøet optøede smeltet smeltede tørret tørrede ristet ristede kogt kogte stødt knust knuste i skåret skiver tern strimler både stykker bidder frisk friske gerne evt eventuelt eller til efter ved fx f.eks bl.a`.split(/\s+/));
  const PREP_VERB = { hak: 'hakket', finthak: 'finthakket', skær: 'skåret', snit: 'snittet', riv: 'revet', pres: 'presset', pil: 'pillet', skræl: 'skrællet', smelt: 'smeltet', rist: 'ristet', mos: 'mast', mas: 'mast' };
  const NUM = { en: 1, et: 1, to: 2, tre: 3, fire: 4, fem: 5, seks: 6, syv: 7, otte: 8, ni: 9, ti: 10, tolv: 12 };
  const BROEK_T = { '½': 0.5, '¼': 0.25, '¾': 0.75 };
  // Enheder, som de skrives -> som appen kender dem
  const ENH = { g: 'g', gr: 'g', gram: 'g', kg: 'kg', kilo: 'kg', ml: 'ml', milliliter: 'ml', cl: 'cl', centiliter: 'cl', dl: 'dl', deciliter: 'dl', l: 'l', liter: 'l', tsk: 'tsk', tl: 'tsk', teskefuld: 'tsk', teskefulde: 'tsk', teske: 'tsk', skefuld: 'spsk',
    spsk: 'spsk', spiseskefuld: 'spsk', spiseskefulde: 'spsk', spiseske: 'spsk', ss: 'spsk', el: 'spsk', spskf: 'spsk', ts: 'tsk', tskf: 'tsk', tskfl: 'tsk', styk: 'stk', styks: 'stk', grm: 'g', grams: 'g', rulle: 'rulle', ruller: 'ruller', stilk: 'stilk', stilke: 'stilke', dryp: 'dryp', stk: 'stk', stykke: 'stk', stykker: 'stk', ds: 'dåse', dåse: 'dåse', dåser: 'dåser', fed: 'fed', bundt: 'bundt', bundter: 'bundt', bdt: 'bundt',
    pk: 'pk', pakke: 'pakke', pakker: 'pakker', håndfuld: 'håndfuld', håndfulde: 'håndfuld', knsp: 'knsp', knivspids: 'knivspids', skive: 'skive', skiver: 'skiver', glas: 'glas', kop: 'kop', kopper: 'kopper', pose: 'pose', poser: 'poser', bakke: 'bakke', bakker: 'bakker', stængel: 'stængel', stængler: 'stængler', nip: 'nip', shot: 'shot' };

  // ---------- Små hjælpere ----------
  // Afstand mellem to ord. Bogstaver, der ofte byttes ved hurtig skrift (å/a, ø/o, æ/e), koster kun lidt.
  const BYT = new Set(['aå', 'oø', 'eæ', 'aæ', 'oå', 'ee', 'iy']);
  const afstand = (a, b) => {
    const m = a.length, n = b.length; if (!m || !n) return Math.max(m, n);
    const kost = (x, y) => x === y ? 0 : BYT.has(x + y) || BYT.has(y + x) ? 0.4 : 1;
    let pp = null, p = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const q = [i];
      for (let j = 1; j <= n; j++) {
        q[j] = Math.min(p[j] + 1, q[j - 1] + 1, p[j - 1] + kost(a[i - 1], b[j - 1]));
        if (pp && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) q[j] = Math.min(q[j], pp[j - 2] + 1); // to bogstaver byttet om
      }
      pp = p; p = q;
    }
    return p[n];
  };
  const ord = s => String(s).toLowerCase().match(/[a-zæøåé]+(?:[-'][a-zæøåé]+)*|\d+(?:[.,]\d+)?|[½¼¾]/g) || [];
  const stor = s => s.charAt(0).toUpperCase() + s.slice(1);
  const ENKELT = VARER.filter(v => !v.includes(' ')), FRASER = VARER.filter(v => v.includes(' '));
  const ENKELT_SET = new Set([...ENKELT, ...Object.keys(STAVNING)]);
  // Grundformen af et ord, hvis det er en kendt vare: «pastaen» -> pasta, «løget» -> løg, «hvidlog» -> hvidløg. Ellers null.
  const grundCache = new Map();
  const eksakt = w => { // kendt ord, evt. med endelse: «pastaen», «løget», «tomaterne»
    const kandidater = [w];
    for (const s of ['erne', 'ene', 'ne', 'en', 'et', 'er', 'e', 'r', 'n', 't', 's']) if (w.length > s.length + 2 && w.endsWith(s)) { const b = w.slice(0, -s.length); kandidater.push(b); if (/(.)\1$/.test(b)) kandidater.push(b.slice(0, -1)); }
    const k = kandidater.find(x => ENKELT_SET.has(x)); return k ? STAVNING[k] || k : null;
  };
  const KORT_FRI = new Set('og en et til med fra som den det der kan lidt godt stor store små lille hele halv ca evt fx på af om ind ud op ned helt fint groft rød røde grøn gul gule sød søde hvid hvide sort sorte tør tørre lun kold kolde varm varme hel fin fine mild milde stærk ung blød bløde hård sur sure salt mørk lys lyse rå frisk tyk tynd'.split(' '));
  const tastefejl = w => { // en vare med ét forkert bogstav: «hvidlog», «persile», «tomatter»
    if (w.length >= 3 && w.length < 6) { // kort ord: kun et bogstav, der mangler («vnd» -> vand), og kun hvis én vare passer
      if (KORT_FRI.has(w) || ENH[w] || ADJ.has(w) || PREP_FOERSTE.has(w)) return null;
      const k = ENKELT.filter(v => v.length === w.length + 1 && [...v].some((_, i) => v.slice(0, i) + v.slice(i + 1) === w));
      return k.length === 1 ? k[0] : null;
    }
    if (w.length < 6) return null;
    let bedst = null, bedstD = 9;
    for (const v of ENKELT) {
      if (v.length < 5 || Math.abs(v.length - w.length) > 2) continue;
      const d = afstand(w, v);
      if (d <= (w.length >= 8 ? 1.5 : 1.2) && d < bedstD) { bedst = v; bedstD = d; }
    }
    return bedst;
  };
  function grundform(w) {
    if (!grundCache.has(w)) grundCache.set(w, eksakt(w) || tastefejl(w));
    return grundCache.get(w);
  }
  // Ret stavefejl i varenavne i en ingredienslinje («hvidlog» -> «hvidløg»). Andre ord røres ikke.
  const retStavning = l => l.replace(/[A-Za-zÆØÅæøå]{3,}/g, w => {
    const lw = w.toLowerCase();
    if (/aa|oe|ae/.test(lw)) { const d = lw.replace(/aa/g, 'å').replace(/oe/g, 'ø').replace(/ae/g, 'æ'); if (eksakt(d) || ENH[d] || ENKELT.some(v => v.length >= 4 && d.endsWith(v))) return w[0] !== w[0].toLowerCase() ? stor(d) : d; } // «daase» -> dåse
    if (lw.length < 5) { const k = STAVNING[lw] || (!eksakt(lw) && tastefejl(lw)); return k && k !== lw ? (w[0] !== w[0].toLowerCase() ? stor(k) : k) : w; } // «smor» -> smør, «vnd» -> vand
    const ny = STAVNING[lw] && STAVNING[lw] !== lw ? STAVNING[lw] : eksakt(lw) || MODIFIKATOR.includes(lw) ? null : tastefejl(lw) || (lw.length >= 6 ? MODIFIKATOR.find(x => Math.abs(x.length - lw.length) <= 2 && afstand(lw, x) <= (lw.length >= 9 ? 1.5 : 1.2)) : null);
    return ny ? (w[0] !== w[0].toLowerCase() ? stor(ny) : ny) : w;
  });
  const KRYDDERORD = new Set('salt peber sort flagesalt friskkværnet frisk olie olivenolie smør vand sukker mel og eller efter smag til servering lidt'.split(' '));
  const erKrydder = l => { const o = ord(l); return o.length > 0 && (o.every(w => KRYDDERORD.has(w)) || (o.length <= 5 && ['salt', 'peber', 'friskkværnet', 'flagesalt', 'sort', 'olie', 'olivenolie', 'sukker'].includes(o[0]))); }; // «salt, til kogevandet»
    const erVare = s => { const o = ord(s).filter(x => x !== 'og' && x !== 'eller' && !/^\d/.test(x)); return o.length > 0 && o.every(x => grundform(x) || ADJ.has(x) || PREP_FOERSTE.has(x)); };
  const krydderLinje = l => { const o = ord(l); return o.length > 1 && o.length <= 5 && ['salt', 'peber', 'flagesalt', 'friskkværnet', 'olivenolie'].includes(o[0]); }; // «SALT OG FRISKKVÆRNT PEBER» er ikke en overskrift
  const sammensat = s => { const o = ord(s); return o.length === 1 && o[0].length >= 8 && ENKELT.some(v => v.length >= 5 && o[0].endsWith(v)); }; // «basilikumpesto», «hvidløgsbrød» er varer, ikke overskrifter
  const harVare = s => /(?:^|\s)s\s*[&+]\s*p(?:\s|$)/i.test(s) || ord(s).some(x => grundform(x));

  // ---------- Ingrediensers tekst ----------
  const ENH_LANG = Object.keys(ENH).filter(k => k.length >= 5);
  const enhedTastefejl = w => { if (w.length < 5 || ENH[w]) return null; const k = ENH_LANG.find(x => Math.abs(x.length - w.length) <= 2 && afstand(w, x) <= 1.5); return k ? ENH[k] : null; }; // «håndfld» -> håndfuld
  const MODIFIKATOR = ['friskkværnet', 'friskrevet', 'finthakket', 'grofthakket', 'hakkede', 'hakket', 'pillede', 'pillet', 'skrællet', 'presset', 'tørret', 'tørrede', 'bredbladet', 'optøede', 'ristede', 'skåret', 'stødt', 'revet', 'frisk', 'friske'];
  const renIng = t => { const u = String(t).replace(/\s*\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').replace(/[\s,;:]+$/, '').trim(); return u || String(t); };
  const TAL_START = /^(?:\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?|\d+\/\d+|[½¼¾])(?![.)]\s|[.)]$)/;
  const NUMMERERET = /^(?:trin|step|punkt)?\s*\d{1,2}\s*[.):]\s+\S/i; // «1. Kog pastaen» er et trin, ikke en mængde
  const ENHED_FOERST = /^(?:dåse|dåser|pose|poser|bundt|pakke|pakker|bakke|håndfuld|håndfulde|fed|glas|stk)\b/i; // «dåse hakkede tomater» = 1 dåse
  const NAVN_MAENGDE = /^([A-Za-zÆØÅæøå][A-Za-zÆØÅæøå ]{2,28}?)\s+(\d+(?:[.,]\d+)?\s*(?:g|gr|kg|dl|cl|ml|l|stk)\b\.?)(?:\s+(.*))?$/i; // «pasta 400 g»
  const navnMaengde = l => { const m = NAVN_MAENGDE.exec(l); return !!m && harVare(m[1]) && ord(m[1]).length <= 3; };
  const MAENGDE = l => TAL_START.test(l) || /^(?:ca\.?|cirka)\s*\d/i.test(l) || ENHED_FOERST.test(l) || navnMaengde(l)
    || new RegExp(`^(?:${Object.keys(NUM).join('|')}|halv|halvt)\\s+(?:halv(?:t)?\\s+|helt?\\s+)?(?:${Object.keys(ENH).join('|')}|store?|små|lille|hel[et]?|friske?)\\b`, 'i').test(l)
    || /^(?:en|et)\s+(?:halv|halvt|lille|stor|stort|god|godt|smule|del)\b/i.test(l) || /^saft(?:en)?(?:\s+og\s+(?:friskrevet\s+)?skal)?\s+af\s+\S/i.test(l);
  // «spssk», «tkf», «grm», «dyp», «stky»: én fejl fra præcis én kendt enhed (samme første bogstav)
  const ENH_NAER = ['spsk', 'tskf', 'gram', 'styk', 'dryp', 'stilk', 'bundt', 'pose', 'dåse', 'pakke', 'skive', 'håndfuld', 'liter'];
  const enhedNaer = w => { let k = ENH_NAER.filter(x => x[0] === w[0] && afstand(w, x) <= 1); if (k.length > 1) k = k.filter(x => [...x].some((_, i) => x.slice(0, i) + x.slice(i + 1) === w)); return k.length === 1 ? ENH[k[0]] : null; }; // ved tvivl: et bogstav, der mangler
  // Mængde og enhed i begyndelsen af en linje gøres, som appen forstår dem
  function mængdeRet(s) {
    let t = s.trim().replace(/[ \t]+/g, ' ').replace(/^(?:ca\.?|cirka|omkring)\s+(?=\S)/i, '');
    t = t.replace(ENHED_FOERST, m => /^(?:stk)\b/i.test(m) ? m : '1 ' + m); // «dåse tomater» -> «1 dåse tomater»
    const nm = NAVN_MAENGDE.exec(t); if (nm && harVare(nm[1]) && ord(nm[1]).length <= 3) t = `${nm[2]} ${nm[1]}${nm[3] ? ' ' + nm[3] : ''}`; // «pasta 400 g» -> «400 g pasta»
    t = t.replace(/^(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)(?=\s)/, '$2'); // «1 - 2 tsk» -> 2
    t = t.replace(/^(en halv|et halvt|halv|halvt)\s+/i, '½ ').replace(/^(en|et)\s+hel[et]?\s+/i, '1 ');
    t = t.replace(new RegExp(`^(${Object.keys(NUM).join('|')})\\s+(?=\\S)`, 'i'), (m, w) => NUM[w.toLowerCase()] + ' ');
    t = t.replace(/^(\d+(?:[.,]\d+)?)(?=[a-zæøå])/i, '$1 ');
    t = t.replace(/^(\d+(?:[.,]\d+)?|[½¼¾]|\d+\/\d+)\s*(?:(?:x|stk)\s+)?([a-zæøå]+)\b\.?(?=\s+\S)/i, (m, tal, e) => { const w = e.toLowerCase(), u = ENH[w] || enhedTastefejl(w) || (w.length >= 3 && w.length <= 6 && !grundform(w) ? enhedNaer(w) : null); return u ? `${tal} ${u}` : m; });
    return t.replace(/\s{2,}/g, ' ');
  }
  // «1 ½ kg kartofler» -> «1.5 kg kartofler», «salt og friskkværnet peber» -> to linjer, «(eller anden pasta)» væk
  const ingLinjer = l => {
    const ren = String(l).trim().replace(/^[\s•\-–—*·▢☐▪●○✅✔☑]+/u, '').replace(/(\p{L}[^–—]*?)\s+[–—-]\s+\p{L}.*$/u, '$1').replace(/\bsp\.\s?sk\b\.?/i, 'spsk').replace(/\bt\.\s?sk\b\.?/i, 'tsk').replace(/[.!]+$/, '').replace(/\s+(?:efter smag|efter behov|efter ønske|efter eget valg)$/i, '').replace(/^(?:lidt|en smule|et par)\s+/i, '');
    if (/^s\s*(?:&|\+|og)\s*p$/i.test(ren)) return ['salt', 'peber'];
    // «saft og skal af 1 citron» -> «1 citron, saft og skal»; «Saften af ¼ - ½ citron» -> «0.5 citron, saften»
    const sa = ren.match(/^(saft(?:en)?(?:\s+og\s+(?:friskrevet\s+)?skal)?)\s+af\s+(?:[¼½¾\d./]+\s*[-–]\s*)?((?:ca\.?\s*)?(?:[¼½¾]|\d+(?:[.,]\d+)?|\d+\/\d+|en halv|et halvt|en|et))\s+(.+)$/i);
    if (sa) { const q = sa[2].replace(/^ca\.?\s*/i, ''); return ingLinjer(`${/^en halv|^et halvt/i.test(q) ? '½' : /^en$|^et$/i.test(q) ? '1' : BROEK_T[q] ?? q} ${sa[3]}, ${sa[1].toLowerCase()}`); }
    const ren2 = ren.replace(/\s+til\s+([a-zæøå]{3,10})$/i, (m, w) => { const k = ['servering', 'stegning', 'pynt', 'toppen', 'dekoration'].find(x => w.toLowerCase() === x || afstand(w.toLowerCase(), x) <= 1); return k ? ' til ' + k : m; });
    const rå = mængdeRet(ren2.replace(/\s+(til\s+(?:servering|stegning|pynt|toppen|dekoration|at\s+\S+(?:\s+\S+)?)|oven\s+på|på\s+toppen)$/i, (m, k, o) => (ren2.includes(',') ? ' ' : ', ') + k));
    const t = renIng(rå
      .replace(/^(\d+)\s*([½¼¾])/, (m, a, b) => String(Number(a) + BROEK_T[b])) // «1 ½»
      .replace(/^(\d+)\s+(\d+)\/(\d+)(?=\s)/, (m, a, b, c) => String(Number(a) + b / c)) // «1 1/2»
      .replace(/^(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)(?=\s)/, '$2') // «1 - 2 stk.» -> 2
      .replace(/^([\d.,½¼¾/]+)\s+ds\.?(?=\s)/i, '$1 dåse'));
    const c = t.match(/^(.*?\S),\s*(.*)$/); if (c && (c[2].length > 40 || /^[-–]/.test(c[2]))) return ingLinjer(c[1]); // lang bisætning: ikke forberedelse
    const g = t.match(/^(.*?\S),\s*(\S+)$/); if (g && g[1].toLowerCase().includes(g[2].toLowerCase())) return [g[1]]; // «teriyakisauce, sauce»
    const dele = t.split(/,\s*/); // «salt, peber» og «dild, persille»: varer uden mængde, hver for sig
    if (dele.length > 1 && !MAENGDE(t) && dele.every(d => ord(d).length <= 3 && harVare(d) && !PREP_FOERSTE.has(ord(d)[0]))) return dele.flatMap(ingLinjer);
    const sp = t.match(/^(salt|slat|satl|sat|sal|saet|sallt|saalt|salat|sakt|aslt|sallt)\s+og\s+((?:\S+\s+)?(?:peber|pebr|peer|pber|pebber|\S{4,6}))$/i);
    return sp && (/peber/i.test(sp[2]) || afstand(sp[2].split(/\s+/).pop().toLowerCase(), 'peber') <= 1.5) ? ['salt', sp[2]] : [t];
  };
  // En liste på én linje deles ved komma og semikolon. Det, der er forberedelse («finthakket», «i tern»), hører til varen før.
  function delListe(tekst) {
    const KOMMENTAR = new Set('i til eller med uden evt eventuelt gerne fx plus ved saft skal'.split(' '));
    const dele = tekst.split(/\s*(?:;|\s[•·]\s|\n)\s*|,\s+(?=\S)/).map(x => x.trim()).filter(Boolean), ud = [];
    for (const d of dele) {
      const foerst = ord(d)[0] || '', sidste = ud[ud.length - 1] || '';
      const haengerSammen = ud.length && !MAENGDE(d) && (KOMMENTAR.has(foerst) || /^[(\-–]/.test(d) || (PREP_FOERSTE.has(foerst) && !harVare(d)) || (!harVare(d) && ord(d).length <= 3 && !/^[A-ZÆØÅ]/.test(d)))
        || (ud.length && /^\d+(?:[.,]\d+)?\s*(?:[a-zæøå]+\s+)?(?:saft|skal)\b/i.test(d) && /citron|lime|appelsin/i.test(sidste)); // «1 citron, 1 spsk saft og 1 tsk skal»
      if (haengerSammen) ud[ud.length - 1] += ', ' + d; else ud.push(d);
    }
    return ud;
  }

  // Lister, der står i en sætning, deles i linjer: «Man skal bruge 2 løg, 3 æg og salt», «Dressing: 3 spsk olie, 1 spsk honning», «1 pose kål, 250 g kål, 1 granatæble»
  const LEDE = /^(?:(?:man|du|vi|jeg)\s+)?(?:skal\s+|kan\s+|må\s+)?(?:bruge|have|bruger|tager|tag|brug|køb)\s*:?\s+/i;
  const erMaengdeListe = dele => dele.length >= 3 && dele.filter(MAENGDE).length >= dele.length * 0.6;
  function udvid(linjer) {
    return linjer.flatMap(l => {
      let hoved = null, rest = l; const lede = LEDE.exec(l);
      if (lede) rest = l.slice(lede[0].length);
      else {
        const m = /^([A-ZÆØÅ][^:.]{1,30}):\s+(.+)$/.exec(l);
        if (m && !verbStart(m[1]) && !overskrift(l)) { hoved = m[1]; rest = m[2]; }
        else if (verbStart(l) || NUMMERERET.test(l) || overskrift(l) || /^\d+[.)]/.test(l)) return [l];
      }
      const saet = saetninger(rest), dele = delListe(saet[0].replace(/[.!]+$/, ''));
      if (!erMaengdeListe(dele)) return [l];
      const sidste = dele[dele.length - 1], o = sidste.split(/\s+og\s+/);
      if (!MAENGDE(sidste) && o.length === 2 && o.every(x => harVare(x) && ord(x).length <= 3)) dele.splice(dele.length - 1, 1, ...o); // «balsamico og olivenolie»
      const og = saet.slice(1).filter(x => /^og\s+/i.test(x)).map(x => x.replace(/^og\s+/i, '').replace(/[.!]+$/, '')), resten = saet.slice(1).filter(x => !/^og\s+/i.test(x)).join(' ');
      return [...(hoved ? [hoved + ':'] : []), ...dele, ...og, ...(resten ? [resten] : [])];
    });
  }

  // ---------- Overskrifter ----------
  const ING_FOLD = ['ingredienser', 'ingredients', 'ingrediens', 'detskaldubruge', 'duskalbruge', 'duskalhave', 'detskalduhave', 'varer', 'indkøbsliste', 'duhavebrugfor', 'dethavibrug'];
  const TRIN_FOLD = ['fremgangsmåde', 'fremgangsmåden', 'sådangørdu', 'sådangørman', 'sådanlaverdu', 'gørsådan', 'tilberedning', 'tilberedningen', 'metode', 'metoden', 'instruktioner', 'instruktion', 'method', 'directions', 'instructions', 'steps', 'trin', 'sådan', 'sådangørviså', 'sågørdusådan', 'sågørdu', 'sågørman', 'ogsågørdusådan', 'fremgang', 'fremgangsmaade', 'forklaring'];
  const rensH = s => s.toLowerCase().replace(/[^a-zæøå]/g, '');
  // Giver { type: 'ing'|'trin', rest } hvis linjen er en overskrift, ellers null. «Ingredienser: 2 løg» giver rest «2 løg».
  function overskrift(linje) {
    const l = linje.replace(/^[#>\s*_]+/, '').replace(/[*_]+/g, '');
    const m = l.match(/^([A-Za-zÆØÅæøå ]{3,28}?)\s*(?:\(([^)]*)\)\s*)?(?:[:：]\s*|$)(.*)$/); // «Du skal bruge (4 personer):»
    if (!m) return null;
    const kandidat = rensH(m[1]), rest = m[3].trim();
    if (!kandidat || (rest && l.indexOf(':') < 0 && l.indexOf('：') < 0)) return null;
    const hit = lst => lst.some(h => kandidat === h || (kandidat.length >= 6 && afstand(kandidat, h) <= (kandidat.length >= 10 ? 2 : 1.2)));
    if (hit(ING_FOLD)) return { type: 'ing', rest };
    if (hit(TRIN_FOLD)) return { type: 'trin', rest };
    return null;
  }
  // Korte linjer uden slutpunktum («Mangosalsa», «Anret salaten») er overskrifter: de bliver et trin, og linjerne under bliver deltrin
  const trinOverskrift = (t, naeste) => t.length <= 45 && t.split(/\s+/).length <= 5 && !/[.!?,;]$/.test(t) && /^[A-ZÆØÅ]/.test(t)
    && (!verbStart(t) || /:$/.test(t) || (t.split(/\s+/).length <= 3 && !/\d/.test(t) && naeste && saetninger(naeste).length >= 2)); // «Anret salaten» er en overskrift, når trinnet under er flere sætninger; «Kog pasta» alene er et trin
  const ingOverskrift = (l, foerst) => /^[A-ZÆØÅ]/.test(l) && l.length <= 40 && !/[\d½¼¾,.;()]/.test(l) && (foerst || (!erVare(l) && !krydderLinje(l))) && !sammensat(l);
  const abbr = /(?:^|[\s(])(?:ca|fx|evt|osv|dvs|inkl|ekskl|nr|kl|pr|jf|max|ev|bl\.a|f\.eks|m\.m|m\.fl)\.$/i, enhedAbbr = /(?:^|[\s(])(?:min|stk|spsk|tsk|dl|cl|kg|gr|ds|pk|l|g|ml|tim|cm|mm)\.$/i;
  // Sætninger. Et punktum efter en forkortelse («ca.», «fx.») deler ikke.
  function saetninger(t) {
    const dele = t.split(/(?<=[.!?])\s+(?=[A-ZÆØÅa-zæøå0-9])/), ud = [];
    for (const d of dele) {
      const sidste = ud[ud.length - 1];
      if (sidste !== undefined && (abbr.test(sidste) || (enhedAbbr.test(sidste) && !/^[A-ZÆØÅ]/.test(d)) || /\d\.$/.test(sidste) && /^[a-zæøå0-9]/.test(d))) ud[ud.length - 1] += ' ' + d; else ud.push(d);
    }
    return ud.map(x => x.trim()).filter(Boolean);
  }
  // poster: [{ h: «Sovs» }, { t: «trinnets tekst» }, …]. En overskrift hører til det trin, der kommer lige efter, og gælder til næste overskrift.
  // Flere sætninger i ét trin: første sætning er trinnet, resten er deltrin. Står der kun én overskrift, og den står først, er retten ikke delt op, og den udelades.
  function byggTrin(poster) {
    const antal = poster.filter(x => x.h).length, foerst = poster.findIndex(x => x.h);
    const ud = []; let over = null;
    for (const x of poster) {
      if (x.h) { over = String(x.h).replace(/[:：]+$/, '').trim(); continue; }
      const dele = saetninger(x.t), o = { tekst: dele[0] || x.t, deltrin: dele.slice(1) };
      if (over && !(antal === 1 && foerst === 0)) o.overskrift = over;
      over = null;
      ud.push(o.overskrift || o.deltrin.length ? o : o.tekst);
    }
    return ud;
  }
  const trinMedDele = trin => byggTrin(trin.map((t, i) => !(trin.nummer && trin.nummer.has(i)) && trinOverskrift(t, trin[i + 1]) && trin[i + 1] && !trinOverskrift(trin[i + 1], trin[i + 2]) ? { h: t } : { t }));
  // Funktionen sender «# Navn» før trinene i en HowToSection
  const trinFraFunktion = liste => byggTrin((liste || []).map(t => /^#\s+/.test(t) ? { h: t.replace(/^#\s+/, '') } : { t }));
  const svaerhedAf = (antalVarer, tid) => Math.min(4, 1 + (antalVarer > 8) + (antalVarer > 14) + ((tid || 30) > 60)); // et skøn, der kan rettes

  // ---------- Opskriftens dele ----------
  // Linjer på hjemmesider, der ikke er opskrift: knapper under opskriften, tips, forslag og kommentarer. Trinnene slutter ved den første.
  const SLUT = /^((?:et\s+)?godt\s+tip|gode\s+tips|husk\s*:|føj til|sæt på madplan|udskriv\b|send$|hold min skærm|næringsindhold|mine noter|tips?\b|tip til|forslag til servering|prøv også|relaterede|læs også|del opskriften|spørgsmål til|\d+\s+kommentarer|kommentarer\b|bedøm|velbekomme|bon app[eé]tit|(?:(?:rigtig|rigtigt|så|og)\s+)?god fornøjelse|nyd (?:det|retten|maden)|mvh|knus|hilsen|kilde\s*:|source\s*:|foto\s*:|billede\s*:|©|copyright)/i;
  const STOEJ = /^(tilmeld|log ind|menu|søg\b|premium|cookies?|accepter|gå til indhold|skip to)/i;
  const MENU = /^(?:forside|opskrifter|aftensmad|frokost|bagning|dessert|madplan|kogebøger|kogebog|shop|butik|bliv medlem|hjem|home|recipes|kontakt|om os|nyhedsbrev|favoritter|indkøbsliste|råvarer|kategorier|blog|søg)$/i; // menupunkter // menuer og tilbud, der kan stå før opskriften
  const KAT_ORD = [[/dessert|kage|bagværk/, 'Dessert'], [/drik|cocktail|smoothie/, 'Drikke'], [/salat/, 'Salat'], [/forret/, 'Forret'], [/tilbehør/, 'Tilbehør'], [/aftensmad|frokost|middag|hovedret|hverdagsmad|bålmad|simremad/, 'Hovedret']];
  const KOEKKEN_ORD = [[/taco|burrito|fajita|enchilada|quesadilla/, 'Mexicansk'], [/teriyaki|sushi|wok|ramen|pad thai/, 'Asiatisk'], [/pasta|spaghetti|carbonara|bolognese|lasagne|risotto|pizza|gnocchi|alfredo|pesto|aglio|cacio/, 'Italiensk'], [/frikadelle|millionbøf|medister|stegt flæsk|hakkebøf|tarteletter|leverpostej/, 'Dansk']];
  const pænNavn = n => String(n || '').split(/\s+[-–—|]\s+|\s+I\s+(?=[a-zæøå])/)[0].trim();
  const rensTitel = t => String(t || '').split(/\s+[|•]\s+/)[0].replace(/\s+[-–—]\s+(valdemarsro|[^-–—]*opskrift)\s*$/i, '').trim();

  const TID = /(?:^|\b)(?:(\d+(?:[.,]\d+)?|[½])\s*(?:timer|time|tim|hours?|hrs?|h|t)\b\.?\s*(?:og\s*)?)?(?:(\d+)\s*(?:minutter|minutes|min|m)\b\.?)?/i;
  function varighed(s) { // «1 time 15 min.», «45 minutter», «1½ time» -> minutter
    const t = String(s).replace(/(\d)\s*½/, '$1.5').replace(/½/, '0.5').replace(/,(\d)/g, '.$1');
    const h = t.match(/(\d+(?:\.\d+)?)\s*(?:timer?|tim|hours?|hrs?|h|t)(?![a-zæøå])/i), m = t.match(/(\d+)\s*(?:minutter|minutes|min|m)(?![a-zæøå])/i);
    const tot = Math.round((h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0)); return tot || null;
  }
  const METAL = /^[\W_]*(?:(?:tid(?: i alt)?|tilberedningstid|arbejdstid|varighed|time|total time|prep(?: time)?|cook(?: time)?|portioner|personer|antal|servings?|serves|rækker til|tager|til)\b\s*[:\-–]?\s*(?:ca\.?\s*)?(?:\d|[½¼¾])|sværhed(?:sgrad)?\b|difficulty\b|holdbarhed\b|kan fryses\b|\d+(?:\s*[-–]\s*\d+)?\s*(?:personer|pers\b|portioner|servings)|\d+(?:[.,]\d+)?\s*(?:min\b|minutter|timer?(?![a-zæøå])))/i;
  function læsMeta(linjer) { // giver { port, tid } og de linjer, der IKKE er meta
    let port = null, tid = null; const rest = [];
    const HOLDBAR = /^[\W_]*(?:kan fryses|holdbarhed|opbevar|holder sig|kan holde)/i;
    for (const l of linjer) {
      const dele = l.length <= 160 && /\s[|·•]\s/.test(l) ? l.split(/\s+[|·•]\s+/).filter(d => METAL.test(d) && !HOLDBAR.test(d)) : [];
      if (dele.length) { const m = læsMeta(dele); if (port == null) port = m.port; if (tid == null) tid = m.tid; rest.push(l); continue; } // «Af Mette | 30 min. · 4 personer»
      if (!METAL.test(l) || l.length > 90 || HOLDBAR.test(l)) { rest.push(l); continue; }
      const p = l.match(/(?:portioner|personer|antal|servings?|serves|rækker til|til)\s*:?\s*(\d+)/i) || l.match(/(\d+)(?:\s*[-–]\s*\d+)?\s*(?:portioner|personer|pers\b|servings|people|port\b)/i);
      if (p && port == null) port = Number(p[1]);
      const tm = l.match(/(?:tid(?: i alt)?|tilberedningstid|varighed|total time|time\s*:)\s*:?\s*(.*)$/i);
      const v = varighed(tm ? tm[1] : /prep|arbejdstid|cook/i.test(l) ? '' : l);
      if (v && (tid == null || /i alt|total/i.test(l))) tid = v;
    }
    return { port, tid, rest };
  }
  const TAGER = /^(?:og\s+)?(?:det|den|retten|alt|hele\s+\S+)\s+tager\s+(?:vist\s+|ca\.?\s*|cirka\s+|omkring\s+|kun\s+|bare\s+|max\.?\s*|maks\.?\s*)*\d/i; // «Det tager vist 30 min. i alt.»
  const tagerTid = l => { const m = String(l).match(/\btager\s+(?:vist\s+|ca\.?\s*|cirka\s+|omkring\s+|kun\s+|bare\s+|max\.?\s*|maks\.?\s*)*(\d[^.!?\n]{0,24}?(?:min\w*|timer?|time)(?![a-zæøå]))/i); return m ? varighed(m[1]) : null; };
  // Trinene: ét pr. linje. Nummerering og punkttegn fjernes, linjer der er brækket midt i en sætning samles.
  function trinLinjer(trin) {
    let t = trin.map(x => x.trim()).filter(Boolean);
    const laengder = t.slice(0, -1).map(x => x.length), mid = laengder.reduce((u, v) => u + v, 0) / (laengder.length || 1);
    const ens = laengder.length >= 2 && mid >= 50 && Math.sqrt(laengder.reduce((u, v) => u + (v - mid) ** 2, 0) / laengder.length) / mid <= 0.12; // brækket tekst (fx fra pdf): linjerne er næsten lige lange
    const lang = ens && t.filter((x, i) => i < t.length - 1 && x.length >= 45 && !/[.!?:]$/.test(x) && /^[a-zæøå]/.test(t[i + 1])).length >= t.length / 3;
    if (lang) t = t.reduce((a, x, i) => { if (i && a[a.length - 1].length >= 45 && !/[.!?:]$/.test(a[a.length - 1]) && /^[a-zæøå]/.test(x)) a[a.length - 1] += ' ' + x; else a.push(x); return a; }, []);
    if (t.length === 1 && /(?:^|\s)1[.)]\s/.test(t[0]) && /\s2[.)]\s/.test(t[0])) t = t[0].split(/\s+(?=\d{1,2}[.)]\s)/); // «1. … 2. …» på én linje
    else if (t.some(x => x.length > 450 && saetninger(x).length >= 5)) t = t.flatMap(x => x.length > 450 && saetninger(x).length >= 5 ? saetninger(x) : [x]); // en mail eller et opslag: alle trin i ét afsnit
    else if (t.length <= 2 && t.some(x => x.length > 160)) t = t.flatMap(x => x.length > 160 ? saetninger(x) : [x]);
    t = t.flatMap(x => { const d = saetninger(x), r = d.filter(z => !TAGER.test(z)); return r.length === d.length ? [x] : r.length ? [r.join(' ')] : []; });
    const stopI = t.findIndex((x, i) => i > 0 && SLUT.test(x)); if (stopI > 0) t = t.slice(0, stopI);
    const ud = [], nummer = new Set();
    for (const x of t) { const nr = /^(?:trin|step|punkt)?\s*\d{1,2}\s*[.):]\s*\S/i.test(x), y = x.replace(/^(?:trin|step|punkt)?\s*\d{1,2}\s*[.):]\s*/i, '').replace(/^[\s•\-–—*·▪●○]+/u, '').trim(); if (y.length > 2) { if (nr) nummer.add(ud.length); ud.push(y); } }
    ud.nummer = nummer; // et nummereret trin («13. Fordel svampene») er aldrig en overskrift
    return ud;
  }

  // ---------- Ingredienser udledt af trinene ----------
  // Bruges, når teksten ikke har en ingrediensliste: vi leder efter kendte varer og tager mængden, hvis den står lige foran.
  function udledIngredienser(trin) {
    const fund = new Map(); // navn -> { tekst, m }
    for (const linje of trin) {
      for (const klausul of saetninger(linje).flatMap(x => x.split(/;\s+|\s+(?:og|samt)\s+(?=[A-ZÆØÅ])/))) {
        const lav = klausul.toLowerCase(), dele = [...lav.matchAll(/[a-zæøåé]+(?:[-'][a-zæøåé]+)*|\d+(?:[.,]\d+)?|[½¼¾]/g)], tok = dele.map(m => m[0]);
        const mellem = (a, b) => lav.slice(dele[a].index + dele[a][0].length, dele[b].index); // teksten mellem to ord
        const verb = PREP_VERB[tok[0]] ? tok[0] : null, groft = tok.includes('groft'), fint = tok.includes('fint') || tok.includes('fintskåret');
        for (let i = 0; i < tok.length; i++) {
          let navn = null, laengde = 1;
          for (const f of FRASER) { const fo = f.split(' '); if (fo.every((x, k) => tok[i + k] && (tok[i + k] === x || grundform(tok[i + k]) === x))) { if (fo.length > laengde || !navn) { navn = f; laengde = fo.length; } } }
          if (!navn) { const g = grundform(tok[i]); if (g) navn = g; }
          if (!navn || /^(pastavand|kogevand)$/.test(navn) || /^(saltet|saltede|saltvand)$/.test(tok[i])) continue;
          // mængde lige foran (uden komma eller parentes imellem): [tal] [enhed] [adjektiver] navn
          let k = i - 1, fra = i, adj = 0;
          const taet = () => k >= 0 && !/[,;()]/.test(mellem(k, fra));
          while (taet() && ADJ.has(tok[k]) && adj < 3) { fra = k; k--; adj++; }
          let enhed = null, m = null;
          if (taet() && ENH[tok[k]] && !/^\d/.test(tok[k])) { enhed = ENH[tok[k]]; fra = k; k--; }
          if (taet() && (tok[k] === 'halv' || tok[k] === 'halvt')) m = '½';
          else if (taet() && (/^\d/.test(tok[k]) || BROEK_T[tok[k]] || (NUM[tok[k]] && (enhed || adj)))) m = BROEK_T[tok[k]] ?? (NUM[tok[k]] || tok[k]);
          if (m == null) { // mængden kan stå efter: «spaghetti (ca. 400 g)»
            const e = i + laengde - 1; let j = e + 1;
            if (tok[j] === 'ca') j++;
            if (j < tok.length && !/[,;)]/.test(mellem(e, e + 1)) && /^\d/.test(tok[j]) && ENH[tok[j + 1]]) { m = tok[j]; enhed = ENH[tok[j + 1]]; }
          }
          if (m == null) enhed = null;
          if (navn === 'vand' && m == null) continue; // vand i en gryde er ikke en indkøbsvare
          if (navn === 'ost' && fund.has('parmesan') && m == null) continue;
          const f = verb && ['løg', 'hvidløg', 'rødløg', 'forårsløg', 'ingefær', 'chili', 'persille', 'basilikum', 'koriander', 'dild', 'gulerod', 'gulerødder', 'tomater', 'tomat', 'bacon', 'parmesan', 'ost'].includes(navn) ? (groft ? 'groft ' : fint ? 'fint' : '') + PREP_VERB[verb] : '';
          const tekst = `${m != null ? m + ' ' : ''}${enhed ? enhed + ' ' : ''}${navn}${f ? ', ' + f : ''}`;
          const eks = fund.get(navn);
          if (!eks) fund.set(navn, { tekst, m }); else if (eks.m == null && m != null) fund.set(navn, { tekst, m });
          i += laengde - 1;
        }
      }
    }
    if ([...fund.keys()].some(n => ['spaghetti', 'linguine', 'fettuccine', 'penne', 'tagliatelle', 'makaroni'].includes(n))) fund.delete('pasta'); // «pastaen» er den pasta, der allerede står
    if ([...fund.keys()].some(n => ['olivenolie', 'rapsolie', 'sesamolie'].includes(n))) fund.delete('olie');
    return [...fund.values()].map(x => x.tekst);
  }

  // ---------- Chat-eksport ----------
  // «[11.11.2026 17:47] Mor: 400 g spaghetti» (WhatsApp, Messenger m.fl.): kun den, der skriver mest, og uden tid og navn
  const CHAT = /^\[?\d{1,2}[./-]\d{1,2}[./-]\d{2,4},?\s+\d{1,2}[:.]\d{2}(?:[:.]\d{2})?\]?\s*(?:-\s*)?([^:\n]{1,40}?):\s?(.*)$/;
  function chatRens(t) {
    const L = t.split('\n'), n = L.filter(l => CHAT.test(l.trim())).length;
    if (n < 3 || n < L.filter(l => l.trim()).length * 0.3) return t;
    const beskeder = [];
    for (const l of L) { const m = l.trim().match(CHAT); if (m) beskeder.push({ hvem: m[1].trim(), t: [m[2]] }); else if (beskeder.length) beskeder[beskeder.length - 1].t.push(l); }
    const tegn = {}; beskeder.forEach(b => { tegn[b.hvem] = (tegn[b.hvem] || 0) + b.t.join(' ').length; });
    const hoved = Object.keys(tegn).sort((a, b) => tegn[b] - tegn[a])[0];
    return beskeder.filter(b => b.hvem === hoved).flatMap(b => b.t).join('\n');
  }
  // ---------- Læsbarhed ----------
  // Ødelagt tekst (dårlig scanning, forkerte tegn, volapyk) skal give en fejl, ikke en opskrift med vrøvl
  const MAERKELIG = /[~^`´¨|_¡■□¢\uFFFD]/;
  function slemt(w) {
    if (MAERKELIG.test(w)) return true;
    const l = w.toLowerCase().replace(/^[.,;:!?()"'«»\-–]+|[.,;:!?()"'«»\-–]+$/g, '');
    if (!l || /^[\d.,½¼¾\/–-]+$/.test(l)) return false;
    if (/^(lorem|ipsum|dolor|amet|undefined|null|nan|xxxx)$/.test(l) || /[#{}]|\?\?/.test(l)) return true;
    if (/[a-zæøå][0-9]|[0-9][a-zæøå]/.test(l) && !/^\d+(?:[.,]\d+)?(?:g|kg|ml|cl|dl|l|gr|min|t|cm|mm|x)$/.test(l)) return true;
    if (/[íìäëöüïâêàôû]/.test(l)) return true;
    if (l.length >= 4 && /^[a-zæøå]+$/.test(l) && !/[aeiouyæøå]/.test(l) && !ENH[l]) return true;
    return /[bcdfghjklmnpqrstvwxz]{5,}/.test(l);
  }
  function oedelagt(ud, trin) {
    const linjerI = ud.flatMap(x => typeof x === 'string' ? [x] : x.varer), ordene = [...linjerI, ...trin].join(' ').split(/\s+/).filter(Boolean);
    const slemme = ordene.filter(slemt).length, lange = linjerI.filter(l => l.split(/\s+/).length > 8).length;
    return (ordene.length >= 15 && slemme / ordene.length > 0.03 && slemme >= 3) || (linjerI.length >= 3 && lange / linjerI.length > 0.3);
  }

  // ---------- Selve læsningen ----------
  const stjernerUd = l => l.replace(/\*\*|__/g, '').replace(/^#{1,6}\s*/, '').replace(/^>\s*/, '').replace(/^[-_*=]{3,}$/, '').trim();
  function tilOpskrift(tekst, titel) {
    const raa = String(tekst || ''), talOrd = (raa.match(/\b(?:en|et|to|tre|fire|fem|seks|syv|otte|ni|ti|tolv|tyve|halvtreds|hundrede|tusind|halv)\s+(?:gram|deciliter|teskefulde?|spiseskefulde?|kilo|liter|stykker)\b/gi) || []).length;
    const talt = (raa.match(/\b(?:punktum|komma|nyt afsnit|ny linje|spørgsmålstegn)\b/gi) || []).length; // diktat: tegnsætning sagt som ord
    if (talt >= 2 || (talt + talOrd >= 2 && raa.length > 300 && raa.split('\n').filter(l => l.trim()).length <= 3)) return { fejl: 'Teksten ligner diktat uden tegnsætning, så jeg kan ikke se, hvor ingredienserne og trinnene starter. Skriv «Ingredienser» og «Sådan gør du» på hver sin linje, og én ingrediens pr. linje.' };
    let linjer = chatRens(String(tekst || '').replace(/^﻿/, '').replace(/\r/g, '')).replace(/\r/g, '').replace(/(\d)\uFE0F?\u20E3/gu, '$1. ').replace(/[\p{Extended_Pictographic}\u200d\uFE0F]/gu, ' ').replace(/ /g, ' ')
      .replace(/<br\s*\/?>|<\/p>|<\/li>/gi, '\n').replace(/<[^>]+>/g, ' ')
      .replace(/(?<=[^\n])[ \t]+(?=(?:ingredienser|ingredients|fremgangsmåde|sådan gør du|instructions|method|directions|metode|tilberedning)\s*:)/gi, '\n') // overskrifter midt i en linje (opslag uden linjeskift)
      .split('\n').map(l => stjernerUd(l.replace(/https?:\/\/[^\s<>"']+/g, '').replace(/#[\p{L}\d_]+/gu, '').replace(/^[\s•\-–—*·▢☐▪●○✅✔☑✓]+(?=\S)/u, '')).replace(/\s{2,}/g, ' ')).filter(Boolean);
    // Alt i ét afsnit: del ved overskrifter og sætninger
    if (linjer.length <= 3 && linjer.join(' ').length > 200) linjer = linjer.flatMap(l => l.split(/\s+(?=(?:ingredienser|ingredients|fremgangsmåde|sådan gør du|metode|method)\s*:)/i)).flatMap(l => /^(ingredienser|ingredients)\s*:/i.test(l) || overskrift(l)?.rest ? [l] : l.length > 160 && !overskrift(l) ? saetninger(l) : [l]);
    // Overskrifter med indhold på samme linje deles
    linjer = linjer.flatMap(l => { const o = overskrift(l); return o && o.rest ? [l.slice(0, l.length - o.rest.length).trim(), o.rest] : [l]; });
    linjer = udvid(linjer);
    const typer = linjer.map(l => { const o = overskrift(l); return o && !o.rest ? o.type : null; });
    // Menuer på siderne har ofte et ord som «Indkøbsliste», der ligner en overskrift. Den rigtige står lige over en linje med mængde.
    const ingH = typer.map((t, i) => t === 'ing' ? i : -1).filter(i => i >= 0);
    let iIng = ingH.length ? (ingH.find(i => linjer[i + 1] !== undefined && (MAENGDE(linjer[i + 1]) || (linjer[i + 1].length <= 40 && linjer[i + 2] !== undefined && MAENGDE(linjer[i + 2])))) ?? ingH[0]) : -1, iTrin = typer.findIndex((t, i) => t === 'trin' && (iIng < 0 || i > iIng));
    if (iIng >= 0 && iTrin < 0 && typer.indexOf('trin') >= 0) iTrin = typer.indexOf('trin'); // trin først, ingredienser bagefter
    let foer = [], ing = [], trinR = [], udledt = false;
    const kort = l => l !== undefined && !NUMMERERET.test(l) && l.split(/\s+/).length <= 5 && !/[.!?]$/.test(l) && !verbStart(l) && !TRINSTART.test(l) && !SLUT.test(l);
    const ingLignende = l => l !== undefined && !SLUT.test(l) && !NUMMERERET.test(l) && (MAENGDE(l) || (l.split(/\s+/).length <= 6 && !/[.!?]$/.test(l) && !verbStart(l) && !TRINSTART.test(l) && harVare(l)));
    // Overskrift til en gruppe ingredienser («Til servering»): ingen mængde, og linjen under har en. Står den først i listen, må den gerne ligne en vare.
    const gruppeH = (l, i, a, start = -1) => !MAENGDE(l) && (/:$/.test(l) || ingOverskrift(l, i === start)) && a[i + 1] !== undefined && (MAENGDE(a[i + 1]) || /:$/.test(l));
    const trinStart = l => l === undefined || NUMMERERET.test(l) || verbStart(l) || TRINSTART.test(l) || SLUT.test(l);
    // Hvor slutter ingredienserne? Ved første linje, der hverken er en ingrediens eller en gruppeoverskrift.
    // Står en vare uden mængde efter en liste med mængder, er den kun med, hvis den er et krydderi, står i en række, der efterfølges af en linje med mængde, eller er den sidste før trinene.
    function ingSlut(a, start) {
      let q = 0, i = start;
      while (i < a.length) {
        const l = a[i], n = l.split(/\s+/).length;
        if (METAL.test(l) && l.length <= 90) { i++; continue; }
        if (SLUT.test(l) || NUMMERERET.test(l)) break;
        if (MAENGDE(l)) { q++; i++; continue; }
        if (gruppeH(l, i, a, start)) { i++; continue; }
        if (verbStart(l) || TRINSTART.test(l) || (/[.!?]$/.test(l) && n > 5)) break;
        if (q < 2) { if (harVare(l) || (kort(l) && ingLignende(a[i + 1]))) { i++; continue; } break; }
        if (erKrydder(l)) { i++; continue; }
        let j = i; while (j < a.length && !MAENGDE(a[j]) && kort(a[j]) && j - i < 4) j++;
        if (kort(l) && j < a.length && MAENGDE(a[j])) { i++; continue; }
        const overskriftAgtig = n <= 5 && /^[A-ZÆØÅ]/.test(l) && a[i + 1] !== undefined && a[i + 1].length >= 50; // «Ris» over et trin
        if (harVare(l) && !overskriftAgtig && !/[.!?]$/.test(l) && n <= 9 && (trinStart(a[i + 1]) || ingLignende(a[i + 1]))) { i++; continue; }
        break;
      }
      return i;
    }
    const fraMaengde = (a, start) => (start > 1 && !METAL.test(a[start - 1]) && gruppeH(a[start - 1], start - 1, a, start - 1) ? start - 1 : start); // en gruppeoverskrift lige før første vare hører med
    if (iIng >= 0 && iTrin >= 0 && iTrin > iIng) { foer = linjer.slice(0, iIng); ing = linjer.slice(iIng + 1, iTrin); trinR = linjer.slice(iTrin + 1); }
    else if (iIng >= 0 && iTrin >= 0) { foer = linjer.slice(0, iTrin); trinR = linjer.slice(iTrin + 1, iIng); ing = linjer.slice(iIng + 1); }
    else if (iIng >= 0) {
      foer = linjer.slice(0, iIng); const efter = linjer.slice(iIng + 1), slut = ingSlut(efter, 0);
      ing = efter.slice(0, slut); trinR = efter.slice(slut);
    } else if (iTrin >= 0) {
      const foran = linjer.slice(0, iTrin); trinR = linjer.slice(iTrin + 1);
      let foersteI = foran.findIndex((l, i) => i > 0 && (MAENGDE(l) || ingLignende(l)) && !METAL.test(l));
      if (foersteI >= 0) { foersteI = fraMaengde(foran, foersteI); foer = foran.slice(0, foersteI); ing = foran.slice(foersteI); } else foer = foran;
    } else {
      let start = linjer.findIndex((l, i) => i > 0 && MAENGDE(l) && (ingLignende(linjer[i + 1]) || gruppeH(linjer[i + 1] || '', i + 1, linjer)) && !METAL.test(l));
      if (start >= 0) {
        start = fraMaengde(linjer, start); const slut = start + ingSlut(linjer.slice(start), 0);
        foer = linjer.slice(0, start); ing = linjer.slice(start, slut); trinR = linjer.slice(slut);
        const rest = [], grp = []; // flere grupper mellem trinene: overskrift og mindst to varer
        for (let k = 0; k < trinR.length; k++) {
          if (gruppeH(trinR[k], k, trinR) && MAENGDE(trinR[k + 1]) && MAENGDE(trinR[k + 2] || '')) { const e = k + 1 + ingSlut(trinR.slice(k + 1), 0); grp.push(...trinR.slice(k, e)); k = e - 1; } else rest.push(trinR[k]);
        }
        ing = [...ing, ...grp]; trinR = rest;
      } else { // ingen ingredienslinjer: titel, så trin. Ingredienserne udledes
        let t = 0; while (t < linjer.length - 1 && t < 3 && (t === 0 || METAL.test(linjer[t]))) t++;
        foer = linjer.slice(0, t); trinR = linjer.slice(t); udledt = true;
      }
    }
    const meta = læsMeta([...foer, ...ing.filter(l => METAL.test(l)), ...trinR.filter(l => METAL.test(l) && l.length < 60)]);
    const ingHP = iIng >= 0 ? (linjer[iIng].match(/\(([^)]*)\)/) || [])[1] : null; // «Du skal bruge (4 personer):»
    if (ingHP) { const m = læsMeta([ingHP]); if (meta.port == null) meta.port = m.port; if (meta.tid == null) meta.tid = m.tid; }
    if (meta.tid == null) meta.tid = [...foer, ...trinR].map(tagerTid).find(Boolean) ?? null; // «Det tager vist 30 min. i alt»
    if (meta.port == null) { const p = [...foer, ...trinR].join(' ').match(/\btil\s+(\d{1,2})\s+(?:personer|pers\b|portioner)/i); if (p) meta.port = Number(p[1]); }
    foer = foer.filter(l => !METAL.test(l) || l.length > 90); ing = ing.filter(l => !(METAL.test(l) && l.length <= 90)); trinR = trinR.filter(l => !(METAL.test(l) && l.length < 60 && !MAENGDE(l)));
    // Ingredienser: alt på én linje deles; grupper får overskrift
    if (ing.length <= 2 && ing.some(l => (l.match(/,|;/g) || []).length >= 2)) ing = ing.flatMap(delListe);
    const trin = trinLinjer(trinR);
    if (udledt) ing = udledIngredienser(trin);
    const ud = []; let gruppe = null;
    for (const [i, l] of ing.entries()) {
      if (!udledt && gruppeH(l, i, ing, 0)) { gruppe = { overskrift: l.replace(/[:：]+$/, '').trim(), varer: [] }; ud.push(gruppe); continue; }
      (gruppe ? gruppe.varer : ud).push(...ingLinjer(udledt ? l : retStavning(l)).filter(x => x.length > 1));
    }
    if (!ud.some(x => typeof x === 'string' || x.varer.length)) return { fejl: 'Jeg kunne ikke finde ingredienserne. Skriv «Ingredienser» på en linje for sig selv, og skriv så én ingrediens på hver linje.' };
    if (oedelagt(ud, trin)) return { fejl: 'Teksten ser ud til at være ødelagt (fx en dårlig scanning, forkerte tegn eller volapyk). Ret de mærkelige ord, eller kopiér opskriften fra et andet sted, og prøv igen.' };
    const trinUd = trinMedDele(trin);
    if (!trinUd.length) return { fejl: 'Jeg kunne ikke finde, hvordan retten laves. Skriv «Sådan gør du» på en linje for sig selv, og skriv trinnene under.' };
    const hoved = foer.join(' '), iOpsk = foer.findIndex(l => /^opskrift$/i.test(l)); // på nogle sider står kategori og mærker lige over «Opskrift», og rettens navn lige under
    const port = meta.port ?? ((hoved.match(/\bantal\s+(\d+)\s*(?:pers|portion)/i) || hoved.match(/(\d+)\s*(?:portioner|personer|pers\b|servings|people)/i) || hoved.match(/(?:serves|rækker til)\s*(\d+)/i) || [])[1] || null);
    const tidLinje = (hoved.match(/tid i alt\s+((?:\d+\s*(?:timer|time|t)\b\.?\s*)?(?:\d+\s*min\w*\.?)?)/i) || [])[1];
    const tid = (tidLinje ? varighed(tidLinje) : null) ?? meta.tid ?? (hoved ? varighed(hoved) : null);
    const efterOpsk = iOpsk >= 0 ? foer[iOpsk + 1] : '', titelDel = pænNavn(rensTitel(titel));
    const kolonNavn = foer.length && /^[^:]{3,60}:$/.test(foer[foer.length - 1]) && !overskrift(foer[foer.length - 1]) ? foer[foer.length - 1].replace(/:$/, '') : '';
    // Navnet: menuer, forfatterlinjer og reklamer springes over. Står der tid eller antal, er navnet tit linjen lige over.
    const titelAgtig = l => l.length >= 3 && l.length <= 80 && !/^\d/.test(l) && !/[.!?:]$/.test(l) && !STOEJ.test(l) && !MENU.test(l) && !METAL.test(l) && (l.match(/\s[·|•]\s/g) || []).length < 2 && !/^(?:af|by|annonce|reklame|sponsoreret)\b/i.test(l) && l.split(/\s+/).length <= 10;
    const metaI = foer.findIndex(l => METAL.test(l) || /^af\s/i.test(l)), foerMeta = metaI > 0 ? foer.slice(0, metaI).reverse().find(titelAgtig) : '';
    let navn = ((efterOpsk && efterOpsk.split(/\s+[-–—]\s+/)[0]) || titelDel || kolonNavn || foerMeta || foer.find(titelAgtig) || foer.find(l => !/^\d/.test(l) && l.length > 2 && !STOEJ.test(l) && !METAL.test(l)) || '');
    navn = navn.replace(/^(?:titel|navn|opskrift|ret)\s*[:\-–]\s*/i, '').replace(/^opskrift på\s+/i, '').replace(/[:.!]+$/, '').slice(0, 80).trim();
    if (navn && navn === navn.toUpperCase() && /[A-ZÆØÅ]{3}/.test(navn)) navn = stor(navn.toLowerCase());
    navn = pænNavn(navn) || navn; // «Spaghetti Bolognese - pasta med kødsovs» -> «Spaghetti Bolognese», som ved links
    if (!navn) return { fejl: 'Jeg mangler rettens navn. Skriv navnet på den øverste linje.' };
    const maerker = iOpsk >= 0 ? foer.slice(Math.max(0, iOpsk - 2), iOpsk).join(', ').split(/\s*,\s*/).map(x => x.toLowerCase()) : [];
    const kategori = (KAT_ORD.find(([re]) => maerker.some(m => re.test(m))) || KAT_ORD.find(([re]) => !maerker.length && re.test(navn.toLowerCase())) || [])[1] || null;
    const koekken = (maerker.map(m => OPSKRIFT_KOEKKEN.find(k => k.toLowerCase() === m)).find(Boolean)) || (KOEKKEN_ORD.find(([re]) => re.test(navn.toLowerCase())) || [])[1] || null;
    const antalVarer = ud.reduce((n, x) => n + (typeof x === 'string' ? 1 : x.varer.length), 0);
    return { j: { navn, kategori, 'køkken': koekken, 'sværhed': svaerhedAf(antalVarer, tid), portioner: port ? Number(port) : null, tid, ingredienser: ud, trin: trinUd }, ...(udledt && { udledt: true }) };
  }
  return { tilOpskrift, ingLinjer, trinFraFunktion, svaerhedAf, pænNavn, renIng, byggTrin, saetninger, grundform, retStavning };
})();
