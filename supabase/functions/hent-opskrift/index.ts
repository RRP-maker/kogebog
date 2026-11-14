// Supabase Edge Function: henter en opskriftsside og læser opskriften ud af sidens JSON-LD (schema.org/Recipe), med billedets adresse.
// Har siden ingen JSON-LD (fx et opslag på TikTok, Instagram eller Facebook), sendes sidens tekst tilbage, og appen finder selv ingredienser og trin.
// { billede: adresse } henter et billede og sender det videre, så appen kan gøre det mindre og gemme det (browseren må ikke hente det direkte).
// Ingen nøgler. Lægges ind i Supabase med «Verify JWT» slået fra (appen bruger kun den offentlige nøgle).
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const svar = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const fejl = (tekst: string, kode = 200) => svar({ ok: false, fejl: tekst }, kode);

const MAKS_BYTES = 4_000_000, MAKS_BILLEDE = 8_000_000;
const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const DELER = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'; // sociale medier viser opslagets tekst til den, der laver forhåndsvisninger

// Afviser adresser, der peger på intern trafik (localhost, private IP'er)
function erIntern(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) return true;
  if (h.includes(':')) return h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80') || h.startsWith('::ffff:');
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}
async function tjekVaert(url: URL) {
  if (!/^https?:$/.test(url.protocol)) throw new Error('Kun http- og https-links.');
  if (erIntern(url.hostname)) throw new Error('Linket peger på en intern adresse.');
  try { // også efter opslag: hvis navnet peger på en intern IP
    const ips = [...await Deno.resolveDns(url.hostname, 'A').catch(() => []), ...await Deno.resolveDns(url.hostname, 'AAAA').catch(() => [])];
    if (ips.some(erIntern)) throw new Error('Linket peger på en intern adresse.');
  } catch (e) { if (e instanceof Error && e.message.startsWith('Linket')) throw e; }
}
// Henter en adresse og følger videresendelser selv, så hver ny adresse bliver tjekket
async function hent(start: string, agent = CHROME, accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'): Promise<{ r: Response; url: URL }> {
  let url = new URL(start);
  for (let i = 0; i < 5; i++) {
    await tjekVaert(url);
    const r = await fetch(url, {
      redirect: 'manual', signal: AbortSignal.timeout(12000),
      headers: { 'User-Agent': agent, 'Accept': accept, 'Accept-Language': 'da-DK,da;q=0.9,en;q=0.7', 'Upgrade-Insecure-Requests': '1', 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Site': 'none' },
    });
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { await r.body?.cancel(); url = new URL(r.headers.get('location')!, url); continue; }
    if (!r.ok) { await r.body?.cancel(); throw new Error(`Siden svarede ${r.status}.`); }
    return { r, url };
  }
  throw new Error('For mange videresendelser.');
}
async function bytes(r: Response, maks: number): Promise<Uint8Array> {
  const reader = r.body?.getReader();
  if (!reader) return new Uint8Array();
  const dele: Uint8Array[] = []; let n = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.length; dele.push(value);
    if (n > maks) { await reader.cancel(); break; }
  }
  const alt = new Uint8Array(Math.min(n, maks)); let p = 0;
  for (const d of dele) { const bit = d.subarray(0, alt.length - p); alt.set(bit, p); p += bit.length; if (p >= alt.length) break; }
  return alt;
}
async function hentSide(start: string, agent = CHROME): Promise<{ html: string; url: URL }> {
  const { r, url } = await hent(start, agent);
  return { html: new TextDecoder('utf-8').decode(await bytes(r, MAKS_BYTES)), url };
}

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', aelig: 'æ', oslash: 'ø', aring: 'å', AElig: 'Æ', Oslash: 'Ø', Aring: 'Å', frac12: '½', frac14: '¼', frac34: '¾', deg: '°', eacute: 'é' };
const afkod = (t: string): string => t
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-zA-Z0-9]+);/g, (m, n) => ENT[n] ?? m);
const rens = (t: unknown): string => afkod(String(t ?? '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const linjer = (t: string): string => afkod(t).split(/\n/).map(l => l.replace(/[ \t\u00a0]+/g, ' ').trim()).filter(Boolean).join('\n'); // som rens, men linjeskift bliver stående

// <meta property="og:…" content="…"> (rækkefølgen af attributterne er ikke fast)
function meta(html: string, navn: string): string {
  const re = new RegExp(`<meta\\b[^>]*(?:property|name)=["']${navn}["'][^>]*>`, 'i'), m = html.match(re);
  const c = m && (m[0].match(/content="([^"]*)"/i) || m[0].match(/content='([^']*)'/i));
  return c ? linjer(c[1]) : '';
}
// Sidens egen tekst uden menuer, scripts og bund: ét afsnit pr. linje
function sideTekst(html: string): string {
  const krop = (html.match(/<article\b[\s\S]*<\/article>/i) || html.match(/<main\b[\s\S]*<\/main>/i) || html.match(/<body\b[\s\S]*/i) || [html])[0];
  return linjer(krop.replace(/<(script|style|noscript|nav|header|footer|aside|form|svg|button|select)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>|<\/(p|li|h\d|div|tr|section|ul|ol)>/gi, '\n').replace(/<[^>]+>/g, ' ')).slice(0, 20000);
}
const billedeAf = (v: any, basis: URL): string => { // image kan være tekst, en liste eller { url }
  for (const x of liste(v)) { const u = typeof x === 'string' ? x : x && (x.url || x.contentUrl); if (u) { try { return new URL(String(u), basis).href; } catch { /* ugyldig adresse */ } } }
  return '';
};

function jsonLdBlokke(html: string): unknown[] {
  const ud: unknown[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const rå = m[1].trim().replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, '');
    try { ud.push(JSON.parse(rå)); } catch { try { ud.push(JSON.parse(rå.replace(/[\u0000-\u001f]+/g, ' '))); } catch { /* ugyldig blok */ } }
  }
  return ud;
}
function findOpskrift(x: any): any | null {
  if (!x || typeof x !== 'object') return null;
  if (Array.isArray(x)) { for (const y of x) { const r = findOpskrift(y); if (r) return r; } return null; }
  const t = x['@type'];
  if (t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))) return x;
  return findOpskrift(x['@graph']) || findOpskrift(x.mainEntity) || findOpskrift(x.itemListElement) || null;
}
const liste = (v: unknown): any[] => Array.isArray(v) ? v : v == null ? [] : [v];
const foerste = (v: unknown): string => { const a = liste(v).map(x => rens(typeof x === 'object' && x ? (x as any).name : x)).filter(Boolean); return a[0] || ''; };

function minutter(v: unknown): number | null { // ISO 8601, fx PT1H30M
  const m = String(v ?? '').match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m || !String(v).trim()) return null;
  const t = Number(m[1] || 0) * 1440 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
  return t > 0 ? t : null;
}
function portioner(v: unknown): number | null {
  for (const x of liste(v)) { const m = String(x).match(/\d+/); if (m) return Number(m[0]); }
  return null;
}
function trinListe(v: unknown): string[] {
  const ud: string[] = [];
  const gaa = (x: any) => {
    if (x == null) return;
    if (typeof x === 'string') { // ren tekst: ét trin pr. linje, ellers pr. sætning-blok
      const dele = x.split(/\r?\n+|<br\s*\/?>|<\/p>|<\/li>/i).map(rens).filter(Boolean);
      ud.push(...dele); return;
    }
    if (Array.isArray(x)) { x.forEach(gaa); return; }
    if (Array.isArray(x.itemListElement)) { const navn = rens(x.name ?? ''); if (navn) ud.push('# ' + navn); gaa(x.itemListElement); return; } // HowToSection: navnet sendes som «# Navn» før trinene
    const t = rens(x.text ?? x.name ?? '');
    if (t) ud.push(t);
  };
  gaa(v);
  return ud.map(t => t.replace(/^\d+[.)]\s+/, ''));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return fejl('Brug POST.', 405);
  let krop: any;
  try { krop = await req.json(); } catch { return fejl('Beskeden kunne ikke læses.', 400); }
  const url = String(krop?.url ?? '').trim();
  if (typeof krop.billede === 'string' && krop.billede) { // et billede sendes videre: kun billeder, højst 8 MB
    try {
      const { r } = await hent(krop.billede, CHROME, 'image/avif,image/webp,image/*,*/*;q=0.8'), type = (r.headers.get('content-type') || '').split(';')[0].trim();
      if (!type.startsWith('image/') || type === 'image/svg+xml') { await r.body?.cancel(); return fejl('Adressen er ikke et billede.'); }
      const b = await bytes(r, MAKS_BILLEDE + 1);
      if (b.length > MAKS_BILLEDE) return fejl('Billedet er for stort.');
      return new Response(b, { headers: { ...CORS, 'Content-Type': type, 'Cache-Control': 'no-store' } });
    } catch (e) { return fejl(e instanceof Error && e.message ? e.message : 'Billedet kunne ikke hentes.'); }
  }
  let u: URL;
  try { u = new URL(url); } catch { return fejl('Det er ikke et gyldigt link.'); }
  const vaert = u.hostname.toLowerCase().replace(/^(www|m|vm|vt)\./, '');
  const social = /(^|\.)(tiktok\.com|instagram\.com|facebook\.com|fb\.watch|threads\.net)$/.test(vaert);
  const navnPaa = vaert.includes('tiktok') ? 'TikTok' : vaert.includes('instagram') ? 'Instagram' : vaert.includes('threads') ? 'Threads' : 'Facebook';
  let html = '', slut = u, hentFejl = '';
  try { const s = await hentSide(u.href, social ? DELER : CHROME); html = s.html; slut = s.url; }
  catch (e) { hentFejl = e instanceof Error && e.message ? e.message : 'Siden kunne ikke hentes.'; }
  const r = jsonLdBlokke(html).map(findOpskrift).find(Boolean);
  if (!r) { // ingen færdig opskrift: send teksten, så appen kan lede efter ingredienser og trin
    let titel = meta(html, 'og:title') || rens((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]), tekst = '', billede = meta(html, 'og:image');
    if (social) {
      tekst = meta(html, 'og:description') || meta(html, 'description');
      if (vaert.includes('tiktok')) { // TikTok har en åben adresse til opslagets tekst
        try {
          const o = await (await hent('https://www.tiktok.com/oembed?url=' + encodeURIComponent(slut.href), CHROME, 'application/json')).r.json();
          if (o && typeof o.title === 'string' && o.title.trim()) { tekst = linjer(o.title); titel = ''; }
        } catch { /* teksten fra siden bruges, hvis den findes */ }
      }
      const citat = tekst.match(/:\s*["“]([\s\S]+)["”]\.?\s*$/); // Instagram: «12 likes, 3 comments - navn on dato: "teksten"»
      if (citat) { tekst = citat[1]; titel = ''; }
      if (tekst.length < 40) return fejl(`${navnPaa} viser ikke opslagets tekst uden login. Kopiér teksten under opslaget, og sæt den ind i feltet.`);
    } else {
      if (hentFejl) return fejl(hentFejl);
      tekst = sideTekst(html);
      if (tekst.length < 80) return fejl('Siden har ingen tekst, jeg kan læse. Kopiér opskriftens tekst fra siden, og sæt den ind i feltet.');
    }
    return svar({ ok: true, tekst: { titel: titel.slice(0, 120), tekst, billede: billede ? billedeAf(billede, slut) : '', type: social ? 'opslag' : 'side' } });
  }
  const ingredienser = liste(r.recipeIngredient ?? r.ingredients).map(rens).filter(Boolean);
  const trin = trinListe(r.recipeInstructions);
  if (!ingredienser.length || !trin.length) return fejl('Opskriften mangler ingredienser eller trin.');
  const tid = minutter(r.totalTime) ?? ((minutter(r.prepTime) ?? 0) + (minutter(r.cookTime) ?? 0) || null);
  return svar({ ok: true, data: {
    navn: rens(r.name), beskrivelse: rens(r.description).slice(0, 300),
    kategori: foerste(r.recipeCategory), koekken: foerste(r.recipeCuisine),
    portioner: portioner(r.recipeYield), tid, ingredienser, trin, billede: billedeAf(r.image, slut) || billedeAf(meta(html, 'og:image'), slut),
  } });
});
