
/*!
 * Median UI – Random Post Slider (deobfuscated & readable)
 * Behavior derived from the attached obfuscated file and WendyCode's docs.
 * Keeps the external config contract:
 *   const wcSliderRandom = {
 *     noImage: 'data:image/png;base64,...',
 *     thumbnailSize: '1600',
 *     sharedBy: 'www.wendycode.com' // credit
 *   };
 *
 * Drop this right before </body> (after defining wcSliderRandom).
 * It will look for a container: <div class="slideB wendycodeRandom"></div>
 * and fill it with a random-post slider.
 */
(function () {
  'use strict';

  // ---- Config ----
  const CFG = (typeof window.wcSliderRandom === 'object' && window.wcSliderRandom) || {};
  const NO_IMG = typeof CFG.noImage === 'string' ? CFG.noImage : 'data:image/png;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
  const THUMB = String(CFG.thumbnailSize || '1600').replace(/[^0-9]/g, '') || '1600';
  const CREDIT = CFG.sharedBy || '';

  // ---- Utilities ----
  function $(sel, root = document) { return root.querySelector(sel); }
  function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function pickN(arr, n) { return arr.slice(0, Math.max(0, n)); }

  function normalizeThumb(url) {
    if (!url) return NO_IMG;
    try {
      // Blogger thumbs often have /s72- or /s320/; upscale to requested size.
      return url.replace(/\/s\d+(-c)?\//, `/s${THUMB}/`);
    } catch { return NO_IMG; }
  }

  function extractImage(entry) {
    try {
      if (entry['media$thumbnail'] && entry['media$thumbnail'].url) {
        return normalizeThumb(entry['media$thumbnail'].url);
      }
      const content = (entry.content && entry.content.$t) || (entry.summary && entry.summary.$t) || '';
      const m = content.match(/<img[^>]+src=["']([^"']+)["']/i);
      return normalizeThumb(m ? m[1] : NO_IMG);
    } catch { return NO_IMG; }
  }

  function extractFirstLabel(entry) {
    try {
      const cats = entry.category || [];
      if (!cats.length) return null;
      // Blogger feeds put the label term at .term
      return cats[0].term || null;
    } catch { return null; }
  }

  function extractLink(entry) {
    try {
      const l = (entry.link || []).find(x => x.rel === 'alternate');
      return l ? l.href : '#';
    } catch { return '#'; }
  }

  function extractTitle(entry) {
    try {
      return (entry.title && entry.title.$t) || 'Untitled';
    } catch { return 'Untitled'; }
  }

  // JSONP loader for Blogger feeds (works without CORS headaches on Blogger)
  function loadJSONP(url) {
    return new Promise((resolve, reject) => {
      const cbName = '__wcRndCB_' + Math.random().toString(36).slice(2);
      const cleanup = () => {
        delete window[cbName];
        script.remove();
      };
      window[cbName] = (data) => { cleanup(); resolve(data); };
      const script = document.createElement('script');
      script.async = true;
      script.src = url + (url.includes('?') ? '&' : '?') + 'alt=json-in-script&callback=' + cbName;
      script.onerror = () => { cleanup(); reject(new Error('JSONP load failed')); };
      document.head.appendChild(script);
    });
  }

  async function fetchRandomPosts(maxResults = 16) {
    // Use the same origin as the current blog by default
    const base = location.origin;
    const url = `${base}/feeds/posts/summary?max-results=${encodeURIComponent(maxResults)}&orderby=published`;
    const json = await loadJSONP(url);
    const entries = (json && json.feed && json.feed.entry) || [];
    return entries;
  }

  function ensureContainer() {
    // Preferred hook used by the original tutorial
    let box = $('.slideB.wendycodeRandom');
    if (!box) {
      // Fallback: create one near the top so the widget still works.
      box = document.createElement('div');
      box.className = 'slideB wendycodeRandom';
      document.body.insertBefore(box, document.body.firstChild);
    }
    // Create the structure expected by Median UI CSS
    box.innerHTML = [
      '<div class="slider"></div>',
      '<div class="slideI"></div>'
    ].join('');
    return { box, slider: $('.slider', box), dots: $('.slideI', box) };
  }

  function buildSlide(entry) {
    const link = extractLink(entry);
    const title = extractTitle(entry);
    const img = extractImage(entry);
    const label = extractFirstLabel(entry);

    const a = document.createElement('a');
    a.className = 'item';
    a.href = link;
    a.setAttribute('aria-label', title);

    const spanImg = document.createElement('span');
    spanImg.className = 'img';
    spanImg.style.backgroundImage = `url("${img}")`;

    // Category badge (right-top)
    const catWrap = document.createElement('span');
    catWrap.className = 'category';
    if (label) {
      const catA = document.createElement('a');
      catA.className = 'button';
      catA.href = `/search/label/${encodeURIComponent(label)}`;
      catA.textContent = label;
      catWrap.appendChild(catA);
    }
    spanImg.appendChild(catWrap);

    const cap = document.createElement('span');
    cap.className = 'cap';
    cap.textContent = title;

    a.appendChild(spanImg);
    a.appendChild(cap);
    return a;
  }

  function makeDot(i) {
    const d = document.createElement('span');
    d.className = 'i';
    d.dataset.index = String(i);
    return d;
  }

  function activate(slider, dots, idx) {
    const items = $all('.item', slider);
    items.forEach((el, i) => { el.style.display = i === idx ? 'block' : 'none'; el.classList.toggle('active', i === idx); });
    const dotsEls = $all('.i', dots);
    dotsEls.forEach((el, i) => el.classList.toggle('active', i === idx));
  }

  function attachControls(box, slider, dots, opts) {
    let current = 0;
    const items = $all('.item', slider);
    const total = items.length;
    const next = () => { current = (current + 1) % total; activate(slider, dots, current); };
    const prev = () => { current = (current - 1 + total) % total; activate(slider, dots, current); };

    // Indicators
    dots.innerHTML = '';
    for (let i = 0; i < total; i++) dots.appendChild(makeDot(i));
    dots.addEventListener('click', (e) => {
      const t = e.target.closest('.i');
      if (!t) return;
      current = Number(t.dataset.index) || 0;
      activate(slider, dots, current);
    });

    // Optional play / pause (hover to pause)
    let timer = null;
    const start = () => {
      stop();
      timer = setInterval(next, opts.duration);
    };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };

    box.addEventListener('mouseenter', stop);
    box.addEventListener('mouseleave', start);

    // Swipe on mobile (simple)
    let touchX = null;
    box.addEventListener('touchstart', (e) => { touchX = e.changedTouches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', (e) => {
      if (touchX == null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 30) { dx < 0 ? next() : prev(); }
      touchX = null;
    }, { passive: true });

    // Start
    activate(slider, dots, 0);
    start();

    return { next, prev, start, stop };
  }

  async function init() {
    const { box, slider, dots } = ensureContainer();

    // Fetch and build slides
    let entries = await fetchRandomPosts(24);
    if (!entries.length) return;
    entries = shuffle(entries);
    const chosen = pickN(entries, 4);

    slider.innerHTML = '';
    chosen.forEach(e => slider.appendChild(buildSlide(e)));

    const DURATION = 3000; // ms
    attachControls(box, slider, dots, { duration: DURATION });

    // Keep a tiny, non-invasive credit (as in the original)
    if (CREDIT) {
      box.dataset.sharedBy = CREDIT;
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
