// Filleseren: en fil (eller indsat tekst i et særligt format) -> tekst, som Tekstlaeser kan læse, eller færdige opskriftsdata.
// Læser Word (.docx), PDF med tekst, RTF, gemte hjemmesider (.html), mails (.eml), JSON, CSV og almindelig tekst (.txt, .md).
// Ingen pakker og intet netværk: zip og PDF pakkes ud med browserens egen DecompressionStream.
// Giver { tekst, titel } (til Tekstlaeser), { data } (opskrift fra JSON-LD eller schema.org-JSON) eller { fejl } på dansk.
const Filleser = (() => {
  // ---------- Tegn ----------
  const CP1252 = { 128: '€', 130: '‚', 131: 'ƒ', 132: '„', 133: '…', 134: '†', 135: '‡', 136: 'ˆ', 137: '‰', 138: 'Š', 139: '‹', 140: 'Œ', 142: 'Ž', 145: '‘', 146: '’', 147: '“', 148: '”', 149: '•', 150: '–', 151: '—', 152: '˜', 153: '™', 154: 'š', 155: '›', 156: 'œ', 158: 'ž', 159: 'Ÿ' };
  const fraCp1252 = b => CP1252[b] || String.fromCharCode(b);
  const latin1 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return s; };
  function tekstAf(u8) { // UTF-8, ellers Windows-1252
    let t;
    try { t = new TextDecoder('utf-8', { fatal: true }).decode(u8); } catch (e) { t = Array.from(u8, fraCp1252).join(''); }
    return retTegn(t.replace(/^﻿/, ''));
  }
  // «svinekÃ¸d» (UTF-8 læst som Latin-1/Windows-1252) -> «svinekød»
  const TIL_BYTE = Object.fromEntries(Object.entries(CP1252).map(([k, v]) => [v, Number(k)]));
  function retTegn(t) {
    const fejl = (t.match(/[ÃÂ][\u0080-¿‘-›Œ-Ÿ€]/g) || []).length;
    if (fejl < 2) return t;
    const b = []; for (const c of t) { const k = c.charCodeAt(0); if (k < 256) b.push(k); else if (TIL_BYTE[c] != null) b.push(TIL_BYTE[c]); else return t; }
    const ny = new TextDecoder('utf-8').decode(new Uint8Array(b));
    return (ny.match(/�/g) || []).length <= (t.match(/�/g) || []).length + 1 ? ny : t;
  }
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', aelig: 'æ', oslash: 'ø', aring: 'å', AElig: 'Æ', Oslash: 'Ø', Aring: 'Å', frac12: '½', frac14: '¼', frac34: '¾', deg: '°', eacute: 'é', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', bull: '•', middot: '·', times: '×', euml: 'ë', ouml: 'ö', auml: 'ä', uuml: 'ü' };
  const afkod1 = t => t.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&([a-zA-Z0-9]+);/g, (m, n) => ENT[n] ?? m);
  const afkod = t => { const a = afkod1(t); return /&(?:[a-zA-Z]+|#\d+|#x[0-9a-f]+);/i.test(a) && a !== t ? afkod1(a) : a; }; // også «&amp;aring;»
  const rens = t => afkod(String(t ?? '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  const linjer = t => afkod(t).split(/\n/).map(l => l.replace(/[ \t ]+/g, ' ').trim()).filter(Boolean).join('\n');

  // ---------- Hjemmesider (samme regler som funktionen «hent-opskrift») ----------
  const liste = v => Array.isArray(v) ? v : v == null ? [] : [v];
  function jsonLdBlokke(html) {
    const ud = [], re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi; let m;
    while ((m = re.exec(html))) { const r = m[1].trim().replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, ''); try { ud.push(JSON.parse(r)); } catch (e) { try { ud.push(JSON.parse(r.replace(/[\u0000-\u001f]+/g, ' '))); } catch (e2) { /* ugyldig blok */ } } }
    return ud;
  }
  function findOpskrift(x) {
    if (!x || typeof x !== 'object') return null;
    if (Array.isArray(x)) { for (const y of x) { const r = findOpskrift(y); if (r) return r; } return null; }
    const t = x['@type'];
    if (t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))) return x;
    return findOpskrift(x['@graph']) || findOpskrift(x.mainEntity) || findOpskrift(x.itemListElement) || null;
  }
  function minutter(v) {
    const s = String(v ?? '').trim(), m = s.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
    if (m && s) { const t = Number(m[1] || 0) * 1440 + Number(m[2] || 0) * 60 + Number(m[3] || 0); if (t > 0) return t; }
    const h = s.match(/(\d+(?:[.,]\d+)?)\s*(?:timer?|t|hours?|h)\b/i), mi = s.match(/(\d+)\s*(?:min|minutter|minutes)\b/i); // «30 min.» i stedet for PT30M
    const t = Math.round((h ? Number(h[1].replace(',', '.')) * 60 : 0) + (mi ? Number(mi[1]) : 0));
    return t || null;
  }
  const portioner = v => { for (const x of liste(v)) { const m = String(x).match(/\d+/); if (m) return Number(m[0]); } return null; };
  function trinListe(v) {
    const ud = [];
    const gaa = x => {
      if (x == null) return;
      if (typeof x === 'string') { ud.push(...x.split(/\r?\n+|<br\s*\/?>|<\/p>|<\/li>/i).map(rens).filter(Boolean)); return; }
      if (Array.isArray(x)) { x.forEach(gaa); return; }
      if (Array.isArray(x.itemListElement)) { const n = rens(x.name ?? ''); if (n) ud.push('# ' + n); gaa(x.itemListElement); return; }
      const t = rens(x.text ?? x.name ?? ''); if (t) ud.push(t);
    };
    gaa(v);
    return ud.map(t => t.replace(/^\d+[.)]\s+/, ''));
  }
  const foerste = v => liste(v).map(x => rens(typeof x === 'object' && x ? x.name : x)).filter(Boolean)[0] || '';
  function fraRecipe(r) {
    const ingredienser = liste(r.recipeIngredient ?? r.ingredients).map(rens).filter(Boolean), trin = trinListe(r.recipeInstructions);
    if (!ingredienser.length || !trin.length) return null;
    const tid = minutter(r.totalTime) ?? ((minutter(r.prepTime) ?? 0) + (minutter(r.cookTime) ?? 0) || null);
    return { data: { navn: rens(r.name), kategori: foerste(r.recipeCategory), koekken: foerste(r.recipeCuisine), portioner: portioner(r.recipeYield), tid, ingredienser, trin } };
  }
  const meta = (html, navn) => { const m = html.match(new RegExp(`<meta\\b[^>]*(?:property|name)=["']${navn}["'][^>]*>`, 'i')); const c = m && (m[0].match(/content="([^"]*)"/i) || m[0].match(/content='([^']*)'/i)); return c ? linjer(c[1]) : ''; };
  function sideTekst(html) {
    let krop = (html.match(/<article\b[\s\S]*<\/article>/i) || html.match(/<main\b[\s\S]*<\/main>/i) || html.match(/<body\b[\s\S]*/i) || [html])[0];
    const h1 = html.search(/<h1\b/i), k0 = html.indexOf(krop);
    if (h1 >= 0 && h1 < k0 && k0 - h1 < 3000) krop = html.slice(h1, k0) + krop; // overskrift, forfatter, tid og antal står tit lige over <article>
    return linjer(krop.replace(/<(script|style|noscript|nav|header|footer|aside|form|svg|button|select)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<br\s*\/?>|<\/(p|li|h\d|div|tr|section|ul|ol|table|center)>|<(li|p|tr|h\d)\b[^>]*>/gi, '\n').replace(/<\/t[dh]>/gi, ' ').replace(/<[^>]+>/g, ' ')).slice(0, 20000);
  }
  function fraHtml(html) {
    const r = jsonLdBlokke(html).map(findOpskrift).find(Boolean);
    if (r) { const d = fraRecipe(r); if (d) return d; }
    const titel = meta(html, 'og:title') || rens((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]) || rens((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]);
    let tekst = sideTekst(html);
    const h1 = rens((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]);
    if (h1 && !tekst.includes(h1)) tekst = h1 + '\n' + tekst; // overskriften står tit uden for <article>
    return { tekst, titel };
  }

  // ---------- Mail (.eml) ----------
  const qp = t => t.replace(/=\r?\n/g, '').replace(/(?:=[0-9A-F]{2})+/gi, m => new TextDecoder('utf-8').decode(new Uint8Array(m.slice(1).split('=').map(h => parseInt(h, 16)))));
  const b64 = t => { const s = atob(t.replace(/\s+/g, '')); return new TextDecoder('utf-8').decode(Uint8Array.from(s, c => c.charCodeAt(0))); };
  const ordKode = t => t.replace(/=\?([^?]+)\?([QB])\?([^?]*)\?=/gi, (m, cs, k, x) => { try { return k.toUpperCase() === 'B' ? b64(x) : qp(x.replace(/_/g, ' ')); } catch (e) { return m; } });
  function fraMail(t) {
    const [hoved, ...rest] = t.replace(/\r/g, '').split(/\n\n/); let krop = rest.join('\n\n');
    const felt = n => ordKode(((hoved.replace(/\n[ \t]+/g, ' ').match(new RegExp(`^${n}:\\s*(.*)$`, 'im')) || [])[1] || '').trim());
    const type = felt('Content-Type'), grænse = (type.match(/boundary="?([^";]+)"?/i) || [])[1];
    let kode = felt('Content-Transfer-Encoding'), html = /text\/html/i.test(type);
    if (grænse) { // flere dele: tag den rene tekst, ellers html
      const dele = krop.split('--' + grænse).map(d => d.replace(/^\n/, '')).filter(d => /\n\n/.test(d));
      const del = dele.find(d => /content-type:\s*text\/plain/i.test(d)) || dele.find(d => /content-type:\s*text\/html/i.test(d));
      if (del) { const [h, ...k] = del.split(/\n\n/); krop = k.join('\n\n'); kode = (h.match(/content-transfer-encoding:\s*(\S+)/i) || [])[1] || ''; html = /text\/html/i.test(h); }
    }
    if (/quoted-printable/i.test(kode)) krop = qp(krop); else if (/base64/i.test(kode)) { try { krop = b64(krop); } catch (e) { /* lad stå */ } }
    if (html) krop = sideTekst(krop);
    krop = krop.split('\n').filter(l => !/^\s*>/.test(l)).join('\n') // citeret tidligere mail
      .replace(/\n(?:Den|On) [^\n]{5,120}(?:skrev|wrote)[^\n]*:?\s*$/i, '');
    const titel = felt('Subject').replace(/^(?:(?:sv|vs|re|fw|fwd|aw)\s*:\s*)+/i, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
    return { tekst: (titel ? titel + '\n' : '') + krop, titel };
  }

  // ---------- RTF ----------
  function fraRtf(t) {
    let ud = '', i = 0, uc = 1; const stak = [], SKIP = /^(fonttbl|colortbl|stylesheet|info|pict|object|header|footer|listtable|listoverridetable|rsidtbl|generator|xmlnstbl|themedata|colorschememapping|latentstyles|datastore)$/;
    let skip = false;
    while (i < t.length) {
      const c = t[i];
      if (c === '{') { stak.push(skip); i++; if (t.startsWith('\\*', i)) skip = true; continue; }
      if (c === '}') { skip = stak.pop() ?? false; i++; continue; }
      if (c === '\\') {
        const n = t[i + 1];
        if (n === '\'') { if (!skip) ud += fraCp1252(parseInt(t.substr(i + 2, 2), 16)); i += 4; continue; }
        if (n === '\\' || n === '{' || n === '}') { if (!skip) ud += n; i += 2; continue; }
        if (n === '~') { if (!skip) ud += ' '; i += 2; continue; }
        if (n === '\n' || n === '\r') { if (!skip) ud += '\n'; i += 2; continue; }
        const m = t.slice(i + 1).match(/^([a-zA-Z]+)(-?\d+)? ?/);
        if (!m) { i += 2; continue; }
        const [hele, ord, tal] = m; i += 1 + hele.length;
        if (SKIP.test(ord)) skip = true;
        else if (skip) continue;
        else if (ord === 'par' || ord === 'line' || ord === 'sect' || ord === 'row') ud += '\n';
        else if (ord === 'tab' || ord === 'cell') ud += ' ';
        else if (ord === 'uc') uc = Number(tal);
        else if (ord === 'u') { let k = Number(tal); if (k < 0) k += 65536; ud += String.fromCharCode(k); i += uc; }
        else if (ord === 'bullet') ud += '•'; else if (ord === 'endash') ud += '–'; else if (ord === 'emdash') ud += '—';
        continue;
      }
      if (c === '\n' || c === '\r') { i++; continue; }
      if (!skip) ud += c; i++;
    }
    return { tekst: ud.split('\n').map(l => l.trim()).join('\n') };
  }

  // ---------- JSON ----------
  const vaelg = (o, ...n) => { for (const k of n) if (o && o[k] != null && o[k] !== '') return o[k]; return null; };
  function fraJson(o) {
    const r = findOpskrift(o);
    if (r) { const d = fraRecipe(r); if (d) return d; }
    const ob = Array.isArray(o) ? o[0] : o; if (!ob || typeof ob !== 'object') return null;
    const L = [], titel = String(vaelg(ob, 'titel', 'navn', 'name', 'title', 'opskrift') || '');
    if (titel) L.push(titel);
    const port = vaelg(ob, 'portioner', 'personer', 'antal', 'servings', 'serves', 'yield', 'recipeYield'), tid = vaelg(ob, 'tid', 'tid_i_alt', 'totalTime', 'time', 'total_time');
    if (port != null) L.push(`Portioner: ${portioner(port) ?? port}`);
    if (tid != null) L.push(`Tid i alt: ${typeof tid === 'number' ? tid + ' min.' : minutter(tid) ? minutter(tid) + ' min.' : tid}`);
    const ing = vaelg(ob, 'ingredienser', 'ingredients', 'recipeIngredient', 'varer'), trin = vaelg(ob, 'fremgangsmaade', 'fremgangsmåde', 'trin', 'steps', 'instructions', 'method', 'recipeInstructions', 'metode');
    if (!ing || !trin) return null;
    const linje = x => typeof x === 'string' ? x : [vaelg(x, 'maengde', 'mængde', 'amount', 'antal', 'qty', 'm'), vaelg(x, 'enhed', 'unit', 'e'), vaelg(x, 'navn', 'name', 'ingrediens', 'ingredient', 'vare', 'n', 'tekst', 'text')].filter(v => v != null && v !== '').join(' ') + ((v => v ? ', ' + v : '')(vaelg(x, 'note', 'noter', 'f', 'forberedelse')));
    const gruppe = x => x && typeof x === 'object' && !Array.isArray(x) ? vaelg(x, 'gruppe', 'overskrift', 'group', 'section', 'title', 'heading') ?? (Array.isArray(x.itemListElement) ? x.name : null) : null;
    const under = x => x && typeof x === 'object' ? vaelg(x, 'linjer', 'varer', 'items', 'ingredienser', 'ingredients', 'trin', 'steps', 'itemListElement') : null;
    L.push('Ingredienser');
    for (const x of liste(ing)) { const u = under(x); if (Array.isArray(u)) { const g = gruppe(x); if (g) L.push(g + ':'); L.push(...u.map(linje)); } else L.push(linje(x)); }
    L.push('Fremgangsmåde');
    const tekstAfTrin = x => typeof x === 'string' ? x : String(vaelg(x, 'tekst', 'text', 'trin', 'step', 'name') || '');
    for (const x of liste(trin)) { const u = under(x); if (Array.isArray(u)) { const g = gruppe(x); if (g) L.push(g); L.push(...u.map(tekstAfTrin)); } else L.push(tekstAfTrin(x)); }
    return { tekst: L.filter(Boolean).join('\n'), titel };
  }

  // ---------- CSV ----------
  function felter(l, d) {
    const ud = []; let f = '', q = false;
    for (let i = 0; i < l.length; i++) { const c = l[i]; if (q) { if (c === '"' && l[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; } else if (c === '"') q = true; else if (c === d) { ud.push(f); f = ''; } else f += c; }
    ud.push(f); return ud.map(x => x.trim());
  }
  function fraCsv(t) {
    const rk = t.replace(/\r/g, '').split('\n').filter(l => l.trim()); if (rk.length < 3) return null;
    const d = [';', '\t', ','].map(x => [x, rk[0].split(x).length]).sort((a, b) => b[1] - a[1])[0][0];
    const top = felter(rk[0], d).map(x => x.toLowerCase());
    const kol = (...n) => top.findIndex(h => n.includes(h));
    const cT = kol('type', 'art', 'kind'), cG = kol('gruppe', 'group', 'sektion', 'section', 'overskrift'), cM = kol('maengde', 'mængde', 'amount', 'antal', 'qty'), cE = kol('enhed', 'unit'), cN = kol('navn', 'name', 'ingrediens', 'ingredient', 'tekst', 'text', 'vare'), cNo = kol('note', 'noter', 'forberedelse');
    if (cN < 0) return { tekst: rk.map(l => felter(l, d).filter(Boolean).join(' ')).join('\n') };
    const rows = rk.slice(1).map(l => felter(l, d)), v = (r, c) => c >= 0 ? (r[c] || '') : '';
    const typ = r => cT < 0 ? 'ingrediens' : v(r, cT).toLowerCase();
    const L = []; const t0 = rows.find(r => /^(titel|title|navn|name|opskrift)$/.test(typ(r)));
    if (t0) { L.push(v(t0, cN)); if (v(t0, cM)) L.push(`Antal ${v(t0, cM)} ${v(t0, cE) || 'personer'}`); if (v(t0, cNo)) L.push(`Tid i alt ${v(t0, cNo)}`); }
    L.push('Ingredienser'); let g = null;
    for (const r of rows.filter(r => /ingr|vare/.test(typ(r)))) { if (v(r, cG) && v(r, cG) !== g) { g = v(r, cG); L.push(g + ':'); } L.push([v(r, cM), v(r, cE), v(r, cN)].filter(Boolean).join(' ') + (v(r, cNo) ? ', ' + v(r, cNo) : '')); }
    L.push('Fremgangsmåde'); g = null;
    for (const r of rows.filter(r => /trin|step|instr|frem/.test(typ(r)))) { if (v(r, cG) && v(r, cG) !== g) { g = v(r, cG); L.push(g); } L.push(v(r, cN)); }
    return { tekst: L.join('\n'), titel: t0 ? v(t0, cN) : '' };
  }

  // ---------- Zip (Word) ----------
  async function pak(u8, format) { return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream(format))).arrayBuffer()); }
  async function zipFil(u8, navn) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let e = -1; for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) return null;
    let p = dv.getUint32(e + 16, true); const n = dv.getUint16(e + 10, true);
    for (let k = 0; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) return null;
      const met = dv.getUint16(p + 10, true), str = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
      const fn = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl));
      if (fn === navn) {
        const start = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true), data = u8.subarray(start, start + str);
        return met === 0 ? data : met === 8 ? pak(data, 'deflate-raw') : null;
      }
      p += 46 + nl + xl + cl;
    }
    return null;
  }
  async function fraDocx(u8) {
    const x = await zipFil(u8, 'word/document.xml');
    if (!x) return { fejl: 'Word-filen kunne ikke åbnes. Gem den igen som .docx, eller kopiér teksten og sæt den ind.' };
    const xml = new TextDecoder('utf-8').decode(x), L = [];
    for (const p of xml.match(/<w:p\b[\s\S]*?<\/w:p>|<w:p\b[^>]*\/>/g) || []) {
      let t = p.replace(/<w:tab\/>/g, ' ').replace(/<w:br\b[^>]*\/>/g, '\n').replace(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g, '\u0001$1\u0002').replace(/<[^>]+>/g, '');
      t = afkod((t.match(/\u0001[^\u0002]*\u0002|\n/g) || []).map(s => s === '\n' ? '\n' : s.slice(1, -1)).join(''));
      if (/<w:numPr>/.test(p) && t.trim()) t = '- ' + t; // punkt- og nummerlister
      L.push(t);
    }
    return { tekst: L.join('\n') };
  }

  // ---------- PDF ----------
  function a85(s) {
    s = s.replace(/^<~/, '').replace(/~>[\s\S]*$/, '').replace(/\s+/g, ''); const ud = []; let g = [];
    for (const c of s) {
      if (c === 'z' && !g.length) { ud.push(0, 0, 0, 0); continue; }
      g.push(c.charCodeAt(0) - 33);
      if (g.length === 5) { let v = 0; for (const x of g) v = v * 85 + x; ud.push(v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255); g = []; }
    }
    if (g.length) { const n = g.length; while (g.length < 5) g.push(84); let v = 0; for (const x of g) v = v * 85 + x; ud.push(...[v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255].slice(0, n - 1)); }
    return Uint8Array.from(ud);
  }
  async function fraPdf(u8) {
    const s = latin1(u8), obj = new Map();
    const re = /(\d+)\s+(\d+)\s+obj\b/g; let m;
    while ((m = re.exec(s))) {
      const start = m.index + m[0].length, slut = s.indexOf('endobj', start); if (slut < 0) break;
      let krop = s.slice(start, slut), strom = null;
      const si = krop.search(/\bstream\r?\n/);
      if (si >= 0) { const ds = krop.slice(si).match(/^stream\r?\n/)[0].length, l = (krop.slice(0, si).match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/) || [])[1]; const a = start + si + ds; strom = l ? u8.subarray(a, a + Number(l)) : u8.subarray(a, start + krop.lastIndexOf('endstream')); krop = krop.slice(0, si); }
      obj.set(Number(m[1]), { d: krop, s: strom }); re.lastIndex = slut;
    }
    const filtre = d => (d.match(/\/Filter\s*(\[[^\]]*\]|\/\w+)/) || [])[1] || '';
    async function data(o) {
      if (!o || !o.s) return null; let b = o.s;
      for (const f of filtre(o.d).match(/\w+Decode/g) || []) {
        if (f === 'FlateDecode') { try { b = await pak(b, 'deflate'); } catch (e) { return null; } }
        else if (f === 'ASCII85Decode') b = a85(latin1(b));
        else if (f === 'ASCIIHexDecode') b = Uint8Array.from(latin1(b).replace(/[^0-9a-f]/gi, '').match(/../g) || [], h => parseInt(h, 16));
        else return null; // billeder o.l.
      }
      return b;
    }
    for (const [, o] of [...obj]) if (/\/Type\s*\/ObjStm/.test(o.d)) { // objekter pakket i strømme (PDF 1.5)
      const b = await data(o); if (!b) continue; const t = latin1(b), n = Number((o.d.match(/\/N\s+(\d+)/) || [])[1]), f = Number((o.d.match(/\/First\s+(\d+)/) || [])[1]);
      const h = t.slice(0, f).trim().split(/\s+/).map(Number);
      for (let k = 0; k < n; k++) { const a = f + h[2 * k + 1], b2 = k + 1 < n ? f + h[2 * k + 3] : t.length; if (!obj.has(h[2 * k])) obj.set(h[2 * k], { d: t.slice(a, b2), s: null }); }
    }
    const ref = (d, n) => { const r = d.match(new RegExp(`/${n}\\s+(\\d+)\\s+\\d+\\s+R`)); return r ? obj.get(Number(r[1])) : null; };
    const dictAf = (d, n) => { const i = d.indexOf('/' + n); if (i < 0) return null; let j = d.indexOf('<<', i); const r = d.slice(i + n.length + 1).match(/^\s*(\d+)\s+\d+\s+R/); if (r) return obj.get(Number(r[1]))?.d || null; if (j < 0) return null; let dyb = 0, k = j; for (; k < d.length; k++) { if (d.startsWith('<<', k)) { dyb++; k++; } else if (d.startsWith('>>', k)) { dyb--; k++; if (!dyb) break; } } return d.slice(j, k + 1); };
    // Sider i rækkefølge
    const sider = [];
    const rod = [...obj.values()].find(o => /\/Type\s*\/Catalog/.test(o.d)), gaa = (o, arv, dyb = 0) => {
      if (!o || dyb > 30) return;
      const res = dictAf(o.d, 'Resources') || arv;
      if (/\/Type\s*\/Page\b/.test(o.d)) { sider.push({ o, res }); return; }
      const kids = (o.d.match(/\/Kids\s*\[([^\]]*)\]/) || [])[1] || '';
      for (const r of kids.matchAll(/(\d+)\s+\d+\s+R/g)) gaa(obj.get(Number(r[1])), res, dyb + 1);
    };
    if (rod) gaa(ref(rod.d, 'Pages'), null);
    if (!sider.length) for (const o of obj.values()) if (/\/Type\s*\/Page\b/.test(o.d)) sider.push({ o, res: dictAf(o.d, 'Resources') });
    const fontCache = new Map();
    async function font(res, navn) {
      const fd = res && dictAf(res, 'Font'); if (!fd) return null;
      const r = fd.match(new RegExp(`/${navn.replace(/[+.]/g, '\\$&')}\\s+(\\d+)\\s+\\d+\\s+R`)); if (!r) return null;
      if (fontCache.has(r[1])) return fontCache.get(r[1]);
      const o = obj.get(Number(r[1])), f = { bytes: /\/Type0/.test(o?.d || '') ? 2 : 1, map: null, diff: {} };
      const tu = o && ref(o.d, 'ToUnicode');
      if (tu) {
        const cm = latin1(await data(tu) || new Uint8Array()); f.map = {};
        const hex = h => { let u = ''; for (let i = 0; i + 4 <= h.length; i += 4) u += String.fromCharCode(parseInt(h.substr(i, 4), 16)); return u || String.fromCharCode(parseInt(h, 16)); };
        const cs = cm.match(/begincodespacerange\s*<([0-9a-f]+)>/i); if (cs) f.bytes = cs[1].length / 2;
        for (const b of cm.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) for (const p of b[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]*)>/gi)) f.map[parseInt(p[1], 16)] = hex(p[2]);
        for (const b of cm.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) for (const p of b[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>\s*(?:<([0-9a-f]+)>|\[([^\]]*)\])/gi)) {
          const a = parseInt(p[1], 16), z = parseInt(p[2], 16);
          if (p[3] != null) { const base = parseInt(p[3], 16); for (let c = a; c <= z && c - a < 65536; c++) f.map[c] = String.fromCharCode(base + c - a); }
          else [...p[4].matchAll(/<([0-9a-f]+)>/gi)].forEach((h, k) => { f.map[a + k] = hex(h[1]); });
        }
      }
      const enc = o && (o.d.match(/\/Encoding\s+(\d+)\s+\d+\s+R/) ? obj.get(Number(o.d.match(/\/Encoding\s+(\d+)\s+\d+\s+R/)[1]))?.d : o.d) || '';
      const dif = enc.match(/\/Differences\s*\[([^\]]*)\]/);
      if (dif) { let c = 0; for (const t of dif[1].match(/\d+|\/[^\s/\[\]]+/g) || []) { if (/^\d/.test(t)) c = Number(t); else f.diff[c++] = GLYF[t.slice(1)] ?? (t.startsWith('/uni') ? String.fromCharCode(parseInt(t.slice(4, 8), 16)) : t.length === 2 ? t[1] : ''); } }
      fontCache.set(r[1], f); return f;
    }
    const GLYF = { space: ' ', aring: 'å', Aring: 'Å', oslash: 'ø', Oslash: 'Ø', ae: 'æ', AE: 'Æ', onehalf: '½', onequarter: '¼', threequarters: '¾', endash: '–', emdash: '—', bullet: '•', degree: '°', eacute: 'é', quoteright: '’', quoteleft: '‘', quotedblleft: '“', quotedblright: '”', periodcentered: '·', multiply: '×', hyphen: '-', period: '.', comma: ',', colon: ':', semicolon: ';', parenleft: '(', parenright: ')', percent: '%', slash: '/', zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9' };
    const afkodTekst = (bytes, f) => {
      let u = '';
      if (f && f.map) { const n = f.bytes; for (let i = 0; i + n <= bytes.length; i += n) { let c = 0; for (let k = 0; k < n; k++) c = c * 256 + bytes[i + k]; u += f.map[c] ?? (n === 1 ? fraCp1252(c) : ''); } return u; }
      for (const b of bytes) u += (f && f.diff[b]) ?? fraCp1252(b);
      return u;
    };
    const afkodTekstRen = (b, f) => afkodTekst(b, f).replace(/\u007f/g, '•').replace(/[\u0000-\u0008\u000b-\u001f]/g, ''); // nogle programmer lægger punkttegnet på kode 127
    // Tekststykker med position -> linjer (efter højde på siden) -> afsnit (linjer, der er brækket, samles)
    const alle = [];
    for (let sn = 0; sn < sider.length; sn++) {
      const { o, res } = sider[sn], cs = []; const c = o.d.match(/\/Contents\s*(\[[^\]]*\]|\d+\s+\d+\s+R)/);
      if (c) for (const r of c[1].matchAll(/(\d+)\s+\d+\s+R/g)) { const b = await data(obj.get(Number(r[1]))); if (b) cs.push(latin1(b)); }
      const t = cs.join('\n'), stykker = [], mb = (o.d.match(/\/MediaBox\s*\[\s*[-\d.]+\s+[-\d.]+\s+[-\d.]+\s+([-\d.]+)/) || [])[1], hoejde = Number(mb) || 842;
      let i = 0, f = null, fs = 10, stak = [], ctm = [1, 0, 0, 1, 0, 0], gemt = [], tl = [0, 0], TL = 0, nyPos = true, seq = 0;
      const gange = (m, n) => [m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3], m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3], m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5]];
      let tm = [1, 0, 0, 1, 0, 0];
      const vis = bytes => { const u = afkodTekstRen(bytes, f); if (!u) return; const m = gange(tm, ctm); stykker.push({ x: m[4], y: m[5], t: u, ny: nyPos, seq: seq++, fs: Math.round(fs * Math.abs(m[3] || 1) * 10) / 10 }); nyPos = false; };
      const flyt = (dx, dy) => { tl = [tl[0] + dx, tl[1] + dy]; tm = gange([1, 0, 0, 1, dx, dy], tm); nyPos = true; };
      while (i < t.length) {
        const ch = t[i];
        if (/\s/.test(ch)) { i++; continue; }
        if (ch === '%') { while (i < t.length && t[i] !== '\n' && t[i] !== '\r') i++; continue; }
        if (ch === '(') { let d = 1, b = []; i++; while (i < t.length && d) { const x = t[i]; if (x === '\\') { const n = t[i + 1]; const E = { n: 10, r: 13, t: 9, b: 8, f: 12 }; if (E[n] != null) { b.push(E[n]); i += 2; } else if (/[0-7]/.test(n)) { const o3 = t.slice(i + 1).match(/^[0-7]{1,3}/)[0]; b.push(parseInt(o3, 8) & 255); i += 1 + o3.length; } else if (n === '\n') { i += 2; } else if (n === '\r') { i += t[i + 2] === '\n' ? 3 : 2; } else { b.push(n.charCodeAt(0)); i += 2; } continue; } if (x === '(') d++; else if (x === ')') { d--; if (!d) { i++; break; } } b.push(x.charCodeAt(0)); i++; } stak.push({ s: Uint8Array.from(b) }); continue; }
        if (ch === '<' && t[i + 1] !== '<') { const e = t.indexOf('>', i); const h = t.slice(i + 1, e).replace(/\s+/g, ''); stak.push({ s: Uint8Array.from((h.length % 2 ? h + '0' : h).match(/../g) || [], x => parseInt(x, 16)) }); i = e + 1; continue; }
        if (ch === '[') { stak.push('['); i++; continue; }
        if (ch === ']') { const a2 = []; while (stak.length && stak[stak.length - 1] !== '[') a2.unshift(stak.pop()); stak.pop(); stak.push({ a: a2 }); i++; continue; }
        if (ch === '<' || ch === '>') { i += 2; continue; }
        if (ch === '/') { const m2 = t.slice(i).match(/^\/[^\s/\[\]()<>{}%]*/)[0]; stak.push(m2); i += m2.length; continue; }
        const m2 = t.slice(i, i + 40).match(/^[+-]?(?:\d+\.?\d*|\.\d+)/);
        if (m2) { stak.push(Number(m2[0])); i += m2[0].length; continue; }
        const op = (t.slice(i).match(/^[A-Za-z'"*]+/) || [ch])[0]; i += op.length;
        const a = stak; stak = []; const n = k => Number(a[a.length - k]) || 0;
        if (op === 'BI') { const e = t.indexOf('EI', i); i = e < 0 ? t.length : e + 2; continue; }
        if (op === 'q') gemt.push(ctm); else if (op === 'Q') ctm = gemt.pop() || [1, 0, 0, 1, 0, 0];
        else if (op === 'cm' && a.length >= 6) ctm = gange([n(6), n(5), n(4), n(3), n(2), n(1)], ctm);
        else if (op === 'Tf') { f = await font(res, String(a[a.length - 2] || '').slice(1)); fs = n(1); }
        else if (op === 'BT') { tm = [1, 0, 0, 1, 0, 0]; tl = [0, 0]; nyPos = true; }
        else if (op === 'Tm' && a.length >= 6) { tm = [n(6), n(5), n(4), n(3), n(2), n(1)]; nyPos = true; }
        else if (op === 'Td') flyt(n(2), n(1));
        else if (op === 'TD') { TL = -n(1); flyt(n(2), n(1)); }
        else if (op === 'TL') TL = n(1);
        else if (op === 'T*') flyt(0, -TL);
        else if (op === 'Tj' && a.length && a[a.length - 1].s) vis(a[a.length - 1].s);
        else if ((op === "'" || op === '"') && a.length && a[a.length - 1].s) { flyt(0, -TL); vis(a[a.length - 1].s); }
        else if (op === 'TJ' && a.length && a[a.length - 1].a) for (const x of a[a.length - 1].a) { if (x && x.s) vis(x.s); else if (typeof x === 'number' && x < -180) stykker.push({ x: 0, y: 0, t: ' ', ny: false, seq: seq++, mellem: true }); }
      }
      // linjer: samme højde (± 2,5)
      const linjerS = [];
      let sidste = null;
      for (const st of stykker) { if (st.mellem) { if (sidste) sidste.t += ' '; continue; } sidste = st; }
      const rigtige = stykker.filter(x => !x.mellem).sort((p, q) => (Math.abs(p.y - q.y) > 2.5 ? q.y - p.y : 0) || p.x - q.x || p.seq - q.seq);
      for (const st of rigtige) {
        const l = linjerS[linjerS.length - 1];
        if (l && Math.abs(l.y - st.y) <= 2.5) l.t += (st.ny && !/\s$/.test(l.t) && !/^\s/.test(st.t) ? ' ' : '') + st.t;
        else linjerS.push({ y: st.y, x: st.x, t: st.t, side: sn, h: hoejde, fs: st.fs });
      }
      for (const l of linjerS) { l.t = l.t.replace(/\s+/g, ' ').trim(); if (l.t) alle.push(l); }
    }
    // Sidehoved og -fod, der står på flere sider, links og sidetal væk
    const noegle = t => t.replace(/\d+/g, '#');
    const paaSider = new Map(); alle.forEach(l => { const k = noegle(l.t); if (!paaSider.has(k)) paaSider.set(k, new Set()); paaSider.get(k).add(l.side); });
    const kant = l => l.y > l.h * 0.9 || l.y < l.h * 0.1; // sidehoved og sidefod
    const linjerP = alle.filter(l => !(sider.length > 1 && kant(l) && paaSider.get(noegle(l.t)).size > 1 && l.t.length < 120) && !/^https?:\/\/\S+$/.test(l.t) && !/^\d+\s*(?:\/|af)\s*\d+$/.test(l.t));
    // Afsnit: en linje, der fortsætter en lang linje lige over (lille afstand, ingen punkttegn eller nummer), er samme afsnit
    const MARK = /^(?:\d{1,2}\s*[.)]\s|[•☐▢▪●○◦*·]\s?|[-–—]\s)/;
    const gaps = linjerP.slice(1).map((l, k) => l.side === linjerP[k].side ? linjerP[k].y - l.y : 0).filter(g => g > 0).sort((p, q) => p - q), typisk = gaps[Math.floor(gaps.length / 2)] || 12;
    const ud = [], max = Math.max(...linjerP.map(l => l.t.length), 1), str = linjerP.map(l => l.fs).sort((p, q) => p - q), brod = str[Math.floor(str.length / 2)] || 10;
    linjerP.forEach((l, k) => {
      const f2 = linjerP[k - 1], gap = f2 && f2.side === l.side ? f2.y - l.y : null;
      const fortsaet = f2 && !MARK.test(l.t) && f2.t.length >= (/[.!?]$/.test(f2.t) ? 0.85 : 0.7) * max && !/[:]$/.test(f2.t) && (gap == null ? /^[a-zæøå]/.test(l.t) : gap > 0 && gap <= typisk * 1.3);
      const overskrift = f2 && gap > 0 && l.fs === f2.fs && l.fs > brod * 1.15 && gap <= l.fs * 1.6 && !/[.!?:]$/.test(f2.t); // en stor overskrift over to linjer
      if ((fortsaet || overskrift) && ud.length) ud[ud.length - 1] += (/-$/.test(ud[ud.length - 1]) && /^[a-zæøå]/.test(l.t) ? '' : ' ') + l.t; else ud.push(l.t);
    });
    const tekst = ud.join('\n');
    if (tekst.replace(/\s/g, '').length < 30) return { fejl: sider.length ? 'PDF-filen er et billede (fx en scanning), og jeg kan ikke læse tekst i billeder. Skriv opskriften af, eller kopiér teksten, hvis du har den et andet sted.' : 'PDF-filen kunne ikke læses.' };
    return { tekst };
  }

  // ---------- Hvilken slags? ----------
  const ser = {
    html: t => /^\s*(?:<!doctype html|<html|<head|<body|<meta|<article|<div|<p\b|<table)/i.test(t) || /<\/(?:p|div|li|body)>/i.test(t.slice(0, 4000)) && (t.match(/<[a-z][^>]*>/gi) || []).length > 5,
    rtf: t => /^\s*\{\\rtf/.test(t),
    json: t => /^\s*[\[{]/.test(t) && /[\]}]\s*$/.test(t),
    mail: t => /^(?:(?:From|To|Subject|Date|MIME-Version|Received|Return-Path|Message-ID|Content-Type|Fra|Til|Emne)\s*:.*\n){2,}/i.test(t.replace(/\r/g, '')),
    csv: t => { const r = t.replace(/\r/g, '').split('\n').filter(l => l.trim()).slice(0, 8); if (r.length < 3) return false; for (const d of [';', '\t']) { const n = r.map(l => l.split(d).length); if (n[0] >= 3 && n.every(x => x === n[0])) return true; } return false; },
  };
  // Indsat tekst: giver null, hvis det bare er almindelig tekst
  function fraTekst(t0) {
    const t = retTegn(String(t0 || '').replace(/^\uFEFF/, ''));
    if (ser.rtf(t)) return fraRtf(t);
    if (ser.json(t)) { try { const r = fraJson(JSON.parse(t)); if (r) return r; } catch (e) { /* ikke JSON */ } }
    if (ser.mail(t)) return fraMail(t);
    if (ser.html(t)) return fraHtml(t);
    if (ser.csv(t)) return fraCsv(t);
    return t !== String(t0 || '') ? { tekst: t } : null; // kun rettede tegn
  }
  async function laes(navn, u8) {
    const n = String(navn || '').toLowerCase(), endelse = (n.match(/\.([a-z0-9]+)$/) || [])[1] || '';
    if (u8[0] === 0x50 && u8[1] === 0x4b) { if (endelse && endelse !== 'docx') return { fejl: 'Jeg kan læse Word-filer (.docx), men ikke denne slags fil.' }; return fraDocx(u8); }
    if (latin1(u8.subarray(0, 5)) === '%PDF-') return fraPdf(u8);
    if (/^(png|jpe?g|heic|gif|webp)$/.test(endelse) || (u8[0] === 0xff && u8[1] === 0xd8) || (u8[0] === 0x89 && u8[1] === 0x50)) return { fejl: 'Jeg kan ikke læse tekst i billeder. Skriv opskriften af, eller kopiér teksten, hvis du har den et andet sted.' };
    if (/^(doc|pages|odt|xls|xlsx)$/.test(endelse)) return { fejl: 'Den slags fil kan jeg ikke læse. Gem den som Word (.docx) eller PDF, eller kopiér teksten og sæt den ind.' };
    const t = tekstAf(u8);
    if (/\u0000/.test(t.slice(0, 2000))) return { fejl: 'Filen kunne ikke læses som tekst.' };
    if (endelse === 'html' || endelse === 'htm') return fraHtml(t);
    if (endelse === 'eml') return fraMail(t);
    if (endelse === 'rtf') return fraRtf(t);
    if (endelse === 'csv' || endelse === 'tsv') return fraCsv(t) || { tekst: t };
    if (endelse === 'json') { try { return fraJson(JSON.parse(t)) || { fejl: 'Jeg kunne ikke finde en opskrift i JSON-filen.' }; } catch (e) { return { fejl: 'JSON-filen har en fejl og kan ikke læses.' }; } }
    return fraTekst(t) || { tekst: t };
  }
  // Resultatet -> { j } (til laesEn) eller { fejl }. kat og koekken: appens egne oversættelser (fra linkimport.js).
  function tilJ(r, { kat = x => x || null, koekken = x => x || null } = {}) {
    if (!r) return { fejl: 'Der er ingen tekst at læse.' };
    if (r.fejl) return r;
    const T = Tekstlaeser;
    if (r.data) {
      const d = r.data, ingr = d.ingredienser.map(T.retStavning).flatMap(T.ingLinjer);
      return { j: { navn: T.pænNavn(d.navn), kategori: kat(d.kategori), 'køkken': koekken(d.koekken), 'sværhed': T.svaerhedAf(ingr.length, d.tid), portioner: d.portioner, tid: d.tid, ingredienser: ingr, trin: T.trinFraFunktion(d.trin) } };
    }
    return T.tilOpskrift(r.tekst, r.titel);
  }
  return { laes, fraTekst, tilJ, retTegn };
})();
