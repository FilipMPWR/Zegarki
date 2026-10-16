/* Wspólna obsługa zdjęć dla index.html i noszenie.html:
   zmniejszanie zdjęć, celownik kadru miniatury i pełnoekranowa galeria. */
const Zdjecia = (() => {
  const FULL_MAX = 1600;   // dłuższy bok pełnego zdjęcia (px)
  const THUMB = 480;       // bok kwadratowej miniatury (px)
  const Z_MAX = 4;         // maksymalne powiększenie względem „wypełnij”

  const style = document.createElement('style');
  style.textContent = `
  .zd-crop { border: 0; padding: 0; border-radius: 18px; background: var(--surface); color: var(--text);
    width: min(420px, calc(100vw - 24px)); box-shadow: 0 20px 60px rgba(0,0,0,.3); }
  .zd-crop::backdrop { background: rgba(0,0,0,.6); }
  .zd-crop-in { padding: 20px; display: grid; gap: 12px; }
  .zd-crop h2 { font: 600 1.5rem var(--serif); margin: 0; }
  .zd-crop p { margin: 0; color: var(--muted); font-size: .85rem; }
  .zd-stage { position: relative; width: 100%; aspect-ratio: 1; border-radius: 12px; overflow: hidden;
    background: var(--accent-soft); touch-action: none; cursor: grab; }
  .zd-stage:active { cursor: grabbing; }
  .zd-stage canvas { width: 100%; height: 100%; display: block; }
  .zd-stage::after { content: ''; position: absolute; inset: 0; pointer-events: none; border-radius: 12px;
    box-shadow: inset 0 0 0 2px rgba(255,255,255,.7);
    background: linear-gradient(to right, transparent calc(33.33% - .5px), rgba(255,255,255,.35) 33.33%, transparent calc(33.33% + .5px), transparent calc(66.66% - .5px), rgba(255,255,255,.35) 66.66%, transparent calc(66.66% + .5px)),
                linear-gradient(to bottom, transparent calc(33.33% - .5px), rgba(255,255,255,.35) 33.33%, transparent calc(33.33% + .5px), transparent calc(66.66% - .5px), rgba(255,255,255,.35) 66.66%, transparent calc(66.66% + .5px)); }
  .zd-zoom { width: 100%; accent-color: var(--accent); }
  .zd-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .zd-row .sp { flex: 1; }
  .zd-btn { font: 500 .9rem var(--sans); padding: 10px 14px; border-radius: 10px; cursor: pointer;
    border: 1px solid var(--line); background: var(--surface); color: var(--text); }
  .zd-btn.primary { background: var(--text); color: var(--bg); border-color: var(--text); }

  .zd-gal { position: fixed; inset: 0; z-index: 1000; background: #000; color: #fff; display: flex; flex-direction: column; }
  .zd-gal[hidden] { display: none; }
  .zd-track { flex: 1; display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; }
  .zd-track::-webkit-scrollbar { display: none; }
  .zd-slide { flex: 0 0 100%; scroll-snap-align: center; display: flex; align-items: center; justify-content: center; position: relative; }
  .zd-slide img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
  .zd-slide .ld { position: absolute; bottom: 16px; font-size: .8rem; opacity: .6; font-family: var(--sans); }
  .zd-top { position: absolute; top: 0; left: 0; right: 0; display: flex; align-items: center; gap: 12px;
    padding: calc(env(safe-area-inset-top) + 10px) 12px 10px 16px; background: linear-gradient(rgba(0,0,0,.6), transparent); font-family: var(--sans); }
  .zd-title { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: .95rem; }
  .zd-count { font-size: .85rem; opacity: .75; font-variant-numeric: tabular-nums; }
  .zd-x { width: 44px; height: 44px; border-radius: 50%; border: 0; background: rgba(255,255,255,.15); color: #fff; font-size: 1.2rem; cursor: pointer; }
  .zd-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 44px; height: 44px; border-radius: 50%; border: 0;
    background: rgba(255,255,255,.15); color: #fff; font-size: 1.4rem; cursor: pointer; }
  .zd-nav.prev { left: 12px; } .zd-nav.next { right: 12px; }
  @media (hover: none) { .zd-nav { display: none; } }
  `;
  document.head.appendChild(style);

  const loadImage = src => new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src;
  });

  // Zmniejsza wybrany plik do max 1600 px (JPEG). Pilnuje, by wynik zmieścił się w jednym dokumencie bazy (<1 MB).
  async function fileToFull(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      let max = FULL_MAX, q = 0.82, out;
      do {
        const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        out = c.toDataURL('image/jpeg', q);
        max = Math.round(max * 0.8); q = Math.max(0.6, q - 0.06);
      } while (out.length > 900000 && max > 400);
      return out;
    } finally { URL.revokeObjectURL(url); }
  }

  /* Kadr: z = powiększenie względem „wypełnij kwadrat” (1 = wypełnia, <1 = widać całe zdjęcie),
     x, y = przesunięcie środka zdjęcia względem środka kwadratu (w ułamkach boku). */
  const zMin = img => Math.min(img.naturalWidth, img.naturalHeight) / Math.max(img.naturalWidth, img.naturalHeight);
  function clamp(img, c) {
    const z = Math.min(Z_MAX, Math.max(zMin(img), c.z));
    const cover = Math.max(1 / img.naturalWidth, 1 / img.naturalHeight);
    const w = img.naturalWidth * cover * z, h = img.naturalHeight * cover * z;
    const lim = (v, size) => size >= 1 ? Math.min((size - 1) / 2, Math.max(-(size - 1) / 2, v)) : 0;
    return { z, x: lim(c.x, w), y: lim(c.y, h) };
  }
  function draw(ctx, img, size, c) {
    const cover = Math.max(size / img.naturalWidth, size / img.naturalHeight);
    const w = img.naturalWidth * cover * c.z, h = img.naturalHeight * cover * c.z;
    ctx.clearRect(0, 0, size, size);
    if (w < size - 0.5 || h < size - 0.5) {
      // Gdy widać całe zdjęcie: tło z rozmytej wersji tego samego zdjęcia.
      ctx.fillStyle = '#e9e5dc'; ctx.fillRect(0, 0, size, size);
      if ('filter' in ctx) {
        ctx.filter = `blur(${Math.round(size / 18)}px)`;
        const s = Math.max(size / img.naturalWidth, size / img.naturalHeight) * 1.2;
        ctx.drawImage(img, (size - img.naturalWidth * s) / 2, (size - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
        ctx.filter = 'none';
      }
    }
    ctx.drawImage(img, size / 2 + c.x * size - w / 2, size / 2 + c.y * size - h / 2, w, h);
  }
  async function makeThumb(src, crop = { z: 1, x: 0, y: 0 }) {
    const img = await loadImage(src);
    const c = document.createElement('canvas'); c.width = c.height = THUMB;
    draw(c.getContext('2d'), img, THUMB, clamp(img, crop));
    return c.toDataURL('image/jpeg', 0.8);
  }

  /* ===== Celownik kadru ===== */
  let cropDlg;
  function buildCrop() {
    cropDlg = document.createElement('dialog');
    cropDlg.className = 'zd-crop';
    cropDlg.innerHTML = `<div class="zd-crop-in">
      <h2>Kadr miniatury</h2>
      <p>Przesuń zdjęcie w ramce. Powiększ suwakiem (lub dwoma palcami).</p>
      <div class="zd-stage"><canvas></canvas></div>
      <input type="range" class="zd-zoom" min="0" max="1000" value="0" aria-label="Powiększenie">
      <div class="zd-row">
        <button type="button" class="zd-btn" data-act="fit">Całe zdjęcie</button>
        <button type="button" class="zd-btn" data-act="fill">Wypełnij ramkę</button>
      </div>
      <div class="zd-row"><span class="sp"></span>
        <button type="button" class="zd-btn" data-act="cancel">Anuluj</button>
        <button type="button" class="zd-btn primary" data-act="ok">Zapisz kadr</button>
      </div></div>`;
    document.body.appendChild(cropDlg);
  }

  function crop(src, initial) {
    if (!cropDlg) buildCrop();
    return new Promise(async resolve => {
      let img;
      try { img = await loadImage(src); } catch { return resolve(null); }
      const stage = cropDlg.querySelector('.zd-stage'), canvas = stage.querySelector('canvas');
      const zoom = cropDlg.querySelector('.zd-zoom'), ctx = canvas.getContext('2d');
      let c = clamp(img, initial || { z: 1, x: 0, y: 0 });
      const lo = Math.log(zMin(img)), hi = Math.log(Z_MAX);
      const toSlider = z => Math.round((Math.log(z) - lo) / (hi - lo) * 1000);
      const fromSlider = v => Math.exp(lo + v / 1000 * (hi - lo));
      const paint = () => {
        const px = Math.round(stage.clientWidth * (window.devicePixelRatio || 1));
        if (canvas.width !== px) canvas.width = canvas.height = px;
        draw(ctx, img, px, c); zoom.value = toSlider(c.z);
      };
      const set = n => { c = clamp(img, n); paint(); };

      // Przeciąganie jednym palcem / myszką, powiększanie dwoma palcami.
      const pts = new Map(); let pinch = null;
      const onDown = e => { stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) pinch = null; };
      const onMove = e => {
        if (!pts.has(e.pointerId)) return;
        const prev = pts.get(e.pointerId), size = stage.clientWidth;
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size === 1) set({ ...c, x: c.x + (e.clientX - prev.x) / size, y: c.y + (e.clientY - prev.y) / size });
        else if (pts.size === 2) {
          const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (pinch) set({ ...c, z: c.z * d / pinch });
          pinch = d;
        }
      };
      const onUp = e => { pts.delete(e.pointerId); pinch = null; };
      const onWheel = e => { e.preventDefault(); set({ ...c, z: c.z * Math.exp(-e.deltaY / 400) }); };
      const onZoom = () => set({ ...c, z: fromSlider(+zoom.value) });
      const onClick = e => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (act === 'fit') set({ z: zMin(img), x: 0, y: 0 });
        else if (act === 'fill') set({ z: 1, x: 0, y: 0 });
        else if (act === 'cancel') finish(null);
        else if (act === 'ok') finish(c);
      };
      const onCancel = e => { e.preventDefault(); finish(null); };
      stage.addEventListener('pointerdown', onDown); stage.addEventListener('pointermove', onMove);
      stage.addEventListener('pointerup', onUp); stage.addEventListener('pointercancel', onUp);
      stage.addEventListener('wheel', onWheel, { passive: false });
      zoom.addEventListener('input', onZoom); cropDlg.addEventListener('click', onClick); cropDlg.addEventListener('cancel', onCancel);
      window.addEventListener('resize', paint);

      async function finish(result) {
        stage.removeEventListener('pointerdown', onDown); stage.removeEventListener('pointermove', onMove);
        stage.removeEventListener('pointerup', onUp); stage.removeEventListener('pointercancel', onUp);
        stage.removeEventListener('wheel', onWheel); zoom.removeEventListener('input', onZoom);
        cropDlg.removeEventListener('click', onClick); cropDlg.removeEventListener('cancel', onCancel);
        window.removeEventListener('resize', paint);
        cropDlg.close();
        resolve(result ? { crop: result, thumb: await makeThumb(src, result) } : null);
      }
      cropDlg.showModal();
      requestAnimationFrame(paint);
    });
  }

  /* ===== Galeria ===== */
  let gal;
  function buildGallery() {
    gal = document.createElement('div');
    gal.className = 'zd-gal'; gal.hidden = true;
    gal.setAttribute('role', 'dialog'); gal.setAttribute('aria-modal', 'true');
    gal.innerHTML = `<div class="zd-track"></div>
      <div class="zd-top"><div class="zd-title"></div><div class="zd-count"></div><button class="zd-x" aria-label="Zamknij">✕</button></div>
      <button class="zd-nav prev" aria-label="Poprzednie">‹</button><button class="zd-nav next" aria-label="Następne">›</button>`;
    document.body.appendChild(gal);
    const track = gal.querySelector('.zd-track');
    const idx = () => Math.round(track.scrollLeft / track.clientWidth);
    const go = i => track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
    track.addEventListener('scroll', () => { gal.querySelector('.zd-count').textContent = `${idx() + 1} / ${track.children.length}`; });
    gal.querySelector('.zd-x').addEventListener('click', closeGallery);
    gal.querySelector('.prev').addEventListener('click', () => go(idx() - 1));
    gal.querySelector('.next').addEventListener('click', () => go(idx() + 1));
    document.addEventListener('keydown', e => {
      if (gal.hidden) return;
      if (e.key === 'Escape') closeGallery();
      if (e.key === 'ArrowLeft') go(idx() - 1);
      if (e.key === 'ArrowRight') go(idx() + 1);
    });
  }
  function closeGallery() { gal.hidden = true; document.documentElement.style.overflow = ''; }

  // items: [{ thumb, load: () => Promise<pełne zdjęcie> }]
  function gallery(items, start = 0, title = '') {
    if (!items.length) return;
    if (!gal) buildGallery();
    const track = gal.querySelector('.zd-track');
    gal.querySelector('.zd-title').textContent = title;
    gal.querySelector('.zd-count').textContent = `${start + 1} / ${items.length}`;
    gal.querySelectorAll('.zd-nav').forEach(b => b.hidden = items.length < 2);
    track.innerHTML = items.map(() => `<div class="zd-slide"><img alt=""><span class="ld">Wczytywanie…</span></div>`).join('');
    items.forEach((it, i) => {
      const slide = track.children[i], im = slide.querySelector('img');
      im.src = it.thumb;  // od razu miniatura, potem pełne zdjęcie
      Promise.resolve().then(it.load).then(src => { im.src = src; slide.querySelector('.ld').remove(); })
        .catch(() => { slide.querySelector('.ld').textContent = 'Pełne zdjęcie niedostępne (brak internetu?)'; });
    });
    gal.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    requestAnimationFrame(() => { track.scrollLeft = start * track.clientWidth; });
  }

  return { fileToFull, makeThumb, crop, gallery, MAX_PHOTOS: 10 };
})();
