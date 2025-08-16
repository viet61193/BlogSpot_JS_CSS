/*
  Deobfuscated, clean, and readable implementation equivalent to
  `median-ui-slider-random-post.js` for Blogger / Median UI.

  Notes:
  - Keeps the same global config `wcSliderRandom` (noImage, thumbnailSize, sharedBy).
  - Uses a small JSONP helper to fetch the Blogger feed without CORS issues.
  - Randomizes posts, builds the same DOM structure expected by the provided CSS
    (classes: .slideB .slider .img, .cap, .category > a.button).
  - Tries to mirror behavior faithfully while removing obfuscation and anti-debug code.
*/
(function () {
  'use strict';

  // ---- Config & defaults ----------------------------------------------------
  const DEFAULTS = {
    noImage:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
    thumbnailSize: '1600', // Blogger image size token (e.g., 72, 320, 640, 1024, 1600)
    sharedBy: '',
    // how many slides to render if container doesn't specify
    count: 5,
  };

  // Allow page to set/override via global before script runs
  const wc = (window.wcSliderRandom = Object.assign({}, DEFAULTS, window.wcSliderRandom || {}));

  // Honor the original gate check: only run when credit is intact.
  if (String(wc.sharedBy).trim() !== '') {
    // Do nothing if credit string was altered/removed
    return;
  }

  // ---- Utilities ------------------------------------------------------------
  const $all = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const $ = (sel, root = document) => root.querySelector(sel);

  function createEl(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v);
    }
    for (const ch of children) {
      if (ch == null) continue;
      if (typeof ch === 'string') el.appendChild(document.createTextNode(ch));
      else el.appendChild(ch);
    }
    return el;
  }

  function getRandomInt(min, max) {
    // inclusive min, inclusive max
    const a = Math.ceil(min);
    const b = Math.floor(max);
    return Math.floor(Math.random() * (b - a + 1)) + a;
  }

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function normalizeThumb(url, sizeToken) {
    // Blogger thumbnails often look like .../s72-c/... or .../s1600/...
    // Replace size token segment with desired size.
    if (!url) return wc.noImage;
    try {
      return url.replace(/\/s(\d+)(?:-c)?\//, `/s${sizeToken}/`);
    } catch (_) {
      return url;
    }
  }

  function extractThumbFromEntry(entry) {
    // 1) media$thumbnail
    const media = entry['media$thumbnail'] && entry['media$thumbnail'].url;
    if (media) return normalizeThumb(media, wc.thumbnailSize);

    // 2) content: look for first <img>
    const content = (entry['content'] && entry['content']['$t']) || '';
    const m = content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (m && m[1]) return normalizeThumb(m[1], wc.thumbnailSize);

    // 3) summary: try similarly
    const sum = (entry['summary'] && entry['summary']['$t']) || '';
    const m2 = sum.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (m2 && m2[1]) return normalizeThumb(m2[1], wc.thumbnailSize);

    return wc.noImage;
  }

  function extractCategories(entry) {
    const cats = Array.isArray(entry.category)
      ? entry.category.map((c) => c.term).filter(Boolean)
      : [];
    return cats;
  }

  function extractLink(entry) {
    const alt = (entry.link || []).find((l) => l.rel === 'alternate');
    return alt ? alt.href : '#';
  }

  function extractTitle(entry) {
    return (entry.title && entry.title.$t) || '';
  }

  // ---- JSONP fetch for Blogger feed ----------------------------------------
  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const cbName = `__wcJsonp_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const cleanup = () => {
        if (script.parentNode) script.parentNode.removeChild(script);
        try {
          delete window[cbName];
        } catch (_) {
          window[cbName] = undefined;
        }
      };
      window[cbName] = (data) => {
        cleanup();
        resolve(data);
      };
      script.onerror = (e) => {
        cleanup();
        reject(e);
      };
      const sep = url.includes('?') ? '&' : '?';
      script.src = `${url}${sep}alt=json-in-script&callback=${cbName}&max-results=150`;
      script.async = true;
      document.body.appendChild(script);
    });
  }

  // ---- Rendering ------------------------------------------------------------
  function renderSlide(container, entry) {
    const url = extractLink(entry);
    const title = extractTitle(entry);
    const cats = extractCategories(entry);
    const thumb = extractThumbFromEntry(entry);

    const wrap = createEl('div', { class: 'slider' });

    const imgA = createEl('a', { class: 'img', href: url, title });
    const img = createEl('img', { src: thumb, alt: title, loading: 'lazy' });
    imgA.appendChild(img);

    const cap = createEl('div', { class: 'cap' });

    // category badge (use first category if present)
    if (cats.length) {
      const cat = cats[0];
      const catWrap = createEl('div', { class: 'category' });
      const catA = createEl('a', { class: 'button', href: `/search/label/${encodeURIComponent(cat)}` }, cat);
      catWrap.appendChild(catA);
      cap.appendChild(catWrap);
    }

    const h3 = createEl('h3', { class: 'title' });
    const titleA = createEl('a', { href: url, title }, title);
    h3.appendChild(titleA);

    cap.appendChild(h3);

    wrap.appendChild(imgA);
    wrap.appendChild(cap);

    container.appendChild(wrap);
  }

  async function loadAndRender(container) {
    // Allow per-container overrides via data-attrs
    const count = parseInt(container.getAttribute('data-count') || wc.count, 10);
    const label = container.getAttribute('data-label'); // optional label filter

    // Derive blog base URL from current location by default
    const home = container.getAttribute('data-home') || `${location.protocol}//${location.host}`;

    // Build feed URL. If label is set, use /feeds/posts/summary/-/Label
    const feedUrl = label
      ? `${home}/feeds/posts/summary/-/${encodeURIComponent(label)}`
      : `${home}/feeds/posts/summary`;

    let data;
    try {
      data = await jsonp(feedUrl);
    } catch (e) {
      // fail silently
      return;
    }

    const entries = ((data && data.feed && data.feed.entry) || []).slice();
    if (!entries.length) return;

    // Randomize order and pick the first N
    shuffleInPlace(entries);

    const chosen = entries.slice(0, Math.max(1, count));

    // Clear any previous content and render
    container.innerHTML = '';
    for (const entry of chosen) renderSlide(container, entry);
  }

  function init() {
    const containers = $all('.slideB');
    if (!containers.length) return;

    for (const box of containers) {
      // If there is a dedicated inner container like `.slider`, prefer it; otherwise use the box itself
      const target = $('.slider', box) || box;
      loadAndRender(target);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
