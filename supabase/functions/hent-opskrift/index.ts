// Supabase Edge Function: henter en opskriftsside og læser opskriften ud af sidens JSON-LD (schema.org/Recipe).
// Ingen nøgler. Lægges ind i Supabase med «Verify JWT» slået fra (appen bruger kun den offentlige nøgle).
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const svar = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const fejl = (tekst: string, kode = 200) => svar({ ok: false, fejl: tekst }, kode);

const MAKS_BYTES = 2_000_000;

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
async function hentSide(start: string): Promise<string> {
  let url = new URL(start);
  for (let i = 0; i < 4; i++) {
    await tjekVaert(url);
    const r = await fetch(url, {
      redirect: 'manual', signal: AbortSignal.timeout(12000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'da-DK,da;q=0.9,en;q=0.7',
        'Upgrade-Insecure-Requests': '1', 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Site': 'none',
      },
    });
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { url = new URL(r.headers.get('location')!, url); continue; }
    if (!r.ok) throw new Error(`Siden svarede ${r.status}.`);
    const reader = r.body?.getReader();
    if (!reader) return '';
    const dele: Uint8Array[] = []; let n = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      n += value.length; dele.push(value);
      if (n > MAKS_BYTES) { await reader.cancel(); break; }
    }
    const alt = new Uint8Array(n > MAKS_BYTES ? MAKS_BYTES : n); let p = 0;
    for (const d of dele) { const bit = d.subarray(0, alt.length - p); alt.set(bit, p); p += bit.length; if (p >= alt.length) break; }
    return new TextDecoder('utf-8').decode(alt);
  }
  throw new Error('For mange videresendelser.');
}

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', aelig: 'æ', oslash: 'ø', aring: 'å', AElig: 'Æ', Oslash: 'Ø', Aring: 'Å', frac12: '½', frac14: '¼', frac34: '¾', deg: '°', eacute: 'é' };
const rens = (t: unknown): string => String(t ?? '')
  .replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-zA-Z0-9]+);/g, (m, n) => ENT[n] ?? m)
  .replace(/\s+/g, ' ').trim();

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
    if (Array.isArray(x.itemListElement)) { gaa(x.itemListElement); return; } // HowToSection
    const t = rens(x.text ?? x.name ?? '');
    if (t) ud.push(t);
  };
  gaa(v);
  return ud.map(t => t.replace(/^\d+[.)]\s+/, ''));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return fejl('Brug POST.', 405);
  let url: string;
  try { url = String((await req.json()).url ?? '').trim(); } catch { return fejl('Beskeden kunne ikke læses.', 400); }
  let u: URL;
  try { u = new URL(url); } catch { return fejl('Det er ikke et gyldigt link.'); }
  let html: string;
  try { html = await hentSide(u.href); }
  catch (e) { return fejl(e instanceof Error && e.message ? e.message : 'Siden kunne ikke hentes.'); }
  const r = jsonLdBlokke(html).map(findOpskrift).find(Boolean);
  if (!r) { // fortæl, hvad siden egentlig sendte, så fejlen kan findes
    const blokke = jsonLdBlokke(html), typer = new Set<string>();
    const saml = (x: any) => { if (Array.isArray(x)) x.forEach(saml); else if (x && typeof x === 'object') { liste(x['@type']).forEach(t => typer.add(String(t))); saml(x['@graph']); } };
    blokke.forEach(saml);
    const titel = rens((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]).slice(0, 60);
    return fejl(`Der ligger ingen opskrift i siden (ingen JSON-LD). Siden er ${html.length} tegn, titel «${titel}», ${blokke.length} JSON-LD-blokke${typer.size ? ' (' + [...typer].slice(0, 6).join(', ') + ')' : ''}.`);
  }
  const ingredienser = liste(r.recipeIngredient ?? r.ingredients).map(rens).filter(Boolean);
  const trin = trinListe(r.recipeInstructions);
  if (!ingredienser.length || !trin.length) return fejl('Opskriften mangler ingredienser eller trin.');
  const tid = minutter(r.totalTime) ?? ((minutter(r.prepTime) ?? 0) + (minutter(r.cookTime) ?? 0) || null);
  return svar({ ok: true, data: {
    navn: rens(r.name), beskrivelse: rens(r.description).slice(0, 300),
    kategori: foerste(r.recipeCategory), koekken: foerste(r.recipeCuisine),
    portioner: portioner(r.recipeYield), tid, ingredienser, trin,
  } });
});
