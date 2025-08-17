/*!
 * Median UI – Random Post Slider (deobfuscated) v2.5
 * - Preserves .slideI markup (dots + Blogger include for play/pause).
 * - Autoplay với play/pause wiring.
 * - Chỉ chạy ở trang chủ (/ hoặc /index.html).
 */
(function () {
  'use strict';

  // ---- Config ----
  const CFG = (typeof window.wcSliderRandom === 'object' && window.wcSliderRandom) || {};
  const NO_IMG = typeof CFG.noImage === 'string' ? CFG.noImage : 'data:image/png;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
  const THUMB = String(CFG.thumbnailSize || '1600').replace(/[^0-9]/g, '') || '1600';
  const CREDIT = CFG.sharedBy || '';
  const AUTO = CFG.auto !== false;                 // default true
  const INTERVAL = Number(CFG.interval || 4000);   // ms

  // ---- Utilities ----
  const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  const normalizeThumb = (url) => { if (!url) return NO_IMG; try { return url.replace(/\/s\d+(-c)?\//, `/s${THUMB}/`); } catch { return NO_IMG; } };
  const extractImage = (e) => {
    try {
      if (e['media$thumbnail']?.url) return normalizeThumb(e['media$thumbnail'].url);
      const content = (e.content && e.content.$t) || (e.summary && e.summary.$t) || '';
      const m = content.match(/<img[^>]+src=["']([^"']+)["']/i);
      return normalizeThumb(m ? m[1] : NO_IMG);
    } catch { return NO_IMG; }
  };
  const extractLabel = (e) => { try { const c = e.category || []; return c.length ? (c[0].term || null) : null; } catch { return null; } };
  const extractLink  = (e) => { try { const l = (e.link || []).find(x => x.rel === 'alternate'); return l ? l.href : '#'; } catch { return '#'; } };
  const extractTitle = (e) => { try { return (e.title && e.title.$t) || 'Untitled'; } catch { return 'Untitled'; } };

  // Blogger JSONP
  function loadJSONP(url) {
    return new Promise((resolve, reject) => {
      const cb = '__wcRnd_' + Math.random().toString(36).slice(2);
      const cleanup = () => { try { delete window[cb]; } catch {} script.remove(); };
      window[cb] = (data) => { cleanup(); resolve(data); };
      const script = document.createElement('script');
      script.async = true;
      script.src = url + (url.includes('?') ? '&' : '?') + 'alt=json-in-script&callback=' + cb;
      script.onerror = () => { cleanup(); reject(new Error('JSONP load failed')); };
      document.head.appendChild(script);
    });
  }
  async function fetchEntries(maxResults = 40) {
    const base = location.origin;
    const url = `${base}/feeds/posts/summary?max-results=${encodeURIComponent(maxResults)}&orderby=published`;
    const json = await loadJSONP(url);
    return (json && json.feed && json.feed.entry) || [];
  }

  function pickContainer() {
    let box = document.querySelector('.slideB.wendycodeRandom');
    if (!box) box = document.querySelector('.slideB.scrlH.fontM.noPrint');
    if (!box) box = document.querySelector('.slideB');
    if (!box) { box = document.createElement('div'); box.className = 'slideB'; document.body.insertBefore(box, document.body.firstChild); }
    return box;
  }

  function ensureStructure(box) {
    // Ensure .slider.flex exists
    let slider = box.querySelector('.slider');
    if (!slider) {
      slider = document.createElement('div');
      slider.className = 'slider flex';
      const slideI = box.querySelector('.slideI');
      slideI ? box.insertBefore(slider, slideI) : box.appendChild(slider);
    } else {
      if (!slider.classList.contains('flex')) slider.classList.add('flex');
      slider.innerHTML = '';
    }
    let slideI = box.querySelector('.slideI');
    if (!slideI) {
      slideI = document.createElement('div');
      slideI.className = 'slideI flex center i12'; // default
      box.appendChild(slideI);
    }
    return { slider, slideI };
  }

  function buildItem(entry) {
    const a = document.createElement('a');
    a.className = 'item';
    a.href = extractLink(entry);
    a.setAttribute('aria-label', extractTitle(entry));

    const imgSpan = document.createElement('span');
    imgSpan.className = 'img';
    imgSpan.style.backgroundImage = `url("${extractImage(entry)}")`;

    const label = extractLabel(entry);
    const catWrap = document.createElement('span');
    catWrap.className = 'category';
    if (label) {
      const catA = document.createElement('a');
      catA.className = 'button';
      catA.href = `/search/label/${encodeURIComponent(label)}`;
      catA.textContent = label;
      catWrap.appendChild(catA);
    }
    imgSpan.appendChild(catWrap);

    const cap = document.createElement('span');
    cap.className = 'cap';
    cap.textContent = extractTitle(entry);

    a.appendChild(imgSpan);
    a.appendChild(cap);
    return a;
  }

  function ensureDots(slideI, count) {
    let dots = Array.from(slideI.querySelectorAll('span.i'));
    if (dots.length === 0) {
      const frag = document.createDocumentFragment();
      for (let i = 0; i < count; i++) {
        const dot = document.createElement('span');
        dot.className = 'i';
        frag.appendChild(dot);
      }
      slideI.insertBefore(frag, slideI.firstChild || null);
      dots = Array.from(slideI.querySelectorAll('span.i'));
    }
    dots.forEach((d, i) => d.dataset.index = String(i));
    return dots;
  }

  function findPlayPause(slideI) {
    const svg = slideI.querySelector('svg');
    if (!svg) return null;
    const gPlay = svg.querySelector('.play');
    const gPause = svg.querySelector('.pause');
    if (!gPlay || !gPause) return null;
    return { svg, gPlay, gPause, ctrl: svg };
  }

  function setIcon(paused, gPlay, gPause) {
    if (!gPlay || !gPause) return;
    gPlay.style.display  = paused ? '' : 'none';
    gPause.style.display = paused ? 'none' : '';
  }

  function activate(slider, dots, idx) {
    const items = Array.from(slider.querySelectorAll('.item'));
    items.forEach((el, i) => {
      el.style.display = i === idx ? 'block' : 'none';
      el.classList.toggle('active', i === idx);
    });
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
  }

  function attachLogic(box, slider, slideI, dots) {
    const items = Array.from(slider.querySelectorAll('.item'));
    let current = 0;
    let paused = false;
    let timer = null;

    const pp = findPlayPause(slideI);
    const start = () => {
      if (!AUTO) return;
      stop();
      paused = false;
      if (pp) setIcon(paused, pp.gPlay, pp.gPause);
      timer = setInterval(() => {
        current = (current + 1) % items.length;
        activate(slider, dots, current);
      }, INTERVAL);
    };
    const stop = () => { if (timer) clearInterval(timer); timer = null; };

    dots.forEach(d => d.addEventListener('click', () => {
      current = Number(d.dataset.index) || 0;
      activate(slider, dots, current);
    }));

    if (pp) {
      pp.ctrl.style.cursor = 'pointer';
      pp.ctrl.addEventListener('click', () => {
        paused = !paused;
        if (paused) { stop(); } else { start(); }
        setIcon(paused, pp.gPlay, pp.gPause);
        box.toggleAttribute('data-paused', paused);
      });
    }

    box.addEventListener('mouseenter', () => { if (!paused) stop(); });
    box.addEventListener('mouseleave', () => { if (!paused) start(); });

    activate(slider, dots, 0);
    if (pp) setIcon(paused, pp.gPlay, pp.gPause);
    if (AUTO) start();
  }

  async function init() {
    const box = pickContainer();
    const { slider, slideI } = ensureStructure(box);

    let entries = await fetchEntries(40);
    if (!entries.length) return;
    entries = shuffle(entries).slice(0, 4);
    entries.forEach(e => slider.appendChild(buildItem(e)));

    const dots = ensureDots(slideI, entries.length);
    if (CREDIT) box.dataset.sharedBy = CREDIT;

    attachLogic(box, slider, slideI, dots);
  }

  // ---- Homepage-only condition ----
  function isHome() {
    const path = location.pathname.replace(/\/+$/, '');
    return path === '' || path === '/' || path === '/index.html';
  }

  if (isHome()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
      init();
    }
  }
})();
