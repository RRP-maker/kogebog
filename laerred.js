// Lærredet på opskriftssiden: billeder og figurer, der kan flyttes. Bygget med Konva.
const Laerred = (() => {
  const B = 340, H = 300; // fast målestok, så ting står samme sted på alle skærme
  const FIGURER = ['⭐', '❤️', '🥕', '🍅', '🧀', '🥖', '🍳', '🧁', '👍'];
  let stage, lag, tr, boks, opskriftId, redigerer = false;

  function knude(el, billede) {
    const faelles = { x: el.x, y: el.y, rotation: el.rotation, scaleX: el.skala, scaleY: el.skala, draggable: redigerer, id: el.id };
    const k = billede
      ? new Konva.Image({ ...faelles, image: billede, width: 150, height: 150 * billede.height / billede.width, cornerRadius: 6, shadowColor: '#22386b', shadowOpacity: 0.25, shadowBlur: 6, shadowOffsetY: 2 })
      : new Konva.Text({ ...faelles, text: el.indhold, fontSize: 52 });
    k.offsetX(k.width() / 2); k.offsetY(k.height() / 2);
    k.on('dragend transformend', () => gem(k));
    k.on('click tap', () => { if (redigerer) vaelg(k); });
    lag.add(k);
    return k;
  }
  function tilfoej(el) {
    if (el.slags !== 'billede') return Promise.resolve(knude(el));
    return new Promise(res => {
      const b = new Image();
      b.onload = () => res(knude(el, b));
      b.onerror = () => res(null);
      b.src = el.indhold;
    });
  }
  function vaelg(k) { tr.nodes(k ? [k] : []); tr.moveToTop(); boks.dispatchEvent(new CustomEvent('valgt', { detail: !!k })); }
  async function gem(k) {
    k.x(Math.max(0, Math.min(B, k.x()))); k.y(Math.max(0, Math.min(H, k.y())));
    try {
      await api(`laerred?id=eq.${enc(k.id())}`, { method: 'PATCH', body: { x: k.x(), y: k.y(), skala: k.scaleX(), rotation: k.rotation() } });
    } catch (e) { console.error(e); toast('Stedet blev ikke gemt. Tjek internettet.'); }
  }
  function tilpas() {
    if (!stage || !document.contains(boks)) return;
    const b = boks.clientWidth; if (!b) return;
    stage.width(b); stage.height(b * H / B); stage.scale({ x: b / B, y: b / B });
  }
  window.addEventListener('resize', tilpas);

  async function start(element, elementer, id) {
    boks = element; opskriftId = id; redigerer = false;
    if (!window.Konva) { boks.innerHTML = '<p class="lille">Lærredet kan ikke vises lige nu. Tjek internettet.</p>'; return false; }
    stage = new Konva.Stage({ container: boks, width: B, height: H });
    lag = new Konva.Layer(); stage.add(lag);
    tr = new Konva.Transformer({ keepRatio: true, enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'], anchorSize: 16, anchorCornerRadius: 8, borderStroke: '#d9432f', anchorStroke: '#d9432f', rotateAnchorOffset: 28 });
    lag.add(tr);
    stage.on('click tap', e => { if (e.target === stage) vaelg(null); });
    tilpas();
    for (const el of elementer) await tilfoej(el);
    saetRediger(false);
    return true;
  }
  function saetRediger(ja) {
    redigerer = ja;
    if (!stage) return;
    lag.getChildren(k => k !== tr).forEach(k => k.draggable(ja));
    lag.listening(ja); if (!ja) vaelg(null);
    boks.classList.toggle('rediger', ja);
    lag.draw();
  }
  async function ny(slags, indhold) {
    const [el] = await api('laerred', { method: 'POST', body: { opskrift_id: opskriftId, slags, indhold, x: 90 + Math.random() * 160, y: 80 + Math.random() * 140 } });
    const k = await tilfoej(el);
    if (k) vaelg(k);
    return el;
  }
  // Gør et foto mindre, før det gemmes, så databasen ikke fyldes op
  function lilleBillede(fil) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(fil), b = new Image();
      b.onload = () => {
        const f = Math.min(1, 480 / Math.max(b.width, b.height));
        const c = document.createElement('canvas');
        c.width = Math.round(b.width * f); c.height = Math.round(b.height * f);
        c.getContext('2d').drawImage(b, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        res(c.toDataURL('image/jpeg', 0.8));
      };
      b.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Billedet kunne ikke læses')); };
      b.src = url;
    });
  }
  async function nytBillede(fil) { return ny('billede', await lilleBillede(fil)); }
  async function fjernValgt() {
    const k = tr.nodes()[0]; if (!k) return false;
    await api(`laerred?id=eq.${enc(k.id())}`, { method: 'DELETE' });
    k.destroy(); vaelg(null);
    return true;
  }
  return { start, saetRediger, ny, nytBillede, fjernValgt, FIGURER, antal: () => lag ? lag.getChildren(k => k !== tr).length : 0 };
})();
