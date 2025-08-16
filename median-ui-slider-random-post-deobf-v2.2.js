
/*!
 * Median UI – Random Post Slider (deobfuscated, markup-only) v2.2
 * Preserves existing `.slideI` classes (e.g., "slideI flex center i12").
 */
(function () {
  'use strict';

  // ---- Config ----
  const CFG = (typeof window.wcSliderRandom === 'object' && window.wcSliderRandom) || {};
  const NO_IMG = typeof CFG.noImage === 'string' ? CFG.noImage : 'data:image/png;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
  const THUMB = String(CFG.thumbnailSize || '1600').replace(/[^0-9]/g, '') || '1600';
  const CREDIT = CFG.sharedBy || '';

  // ---- Utilities ----
  const normalizeThumb = (url) => {
    if (!url) return NO_IMG;
    try { return url.replace(/\/s\d+(-c)?\//, `/s${THUMB}/`); } catch { return NO_IMG; }
  };
  const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

  const extractImage = (entry) => {
    try {
      if (entry['media$thumbnail'] && entry['media$thumbnail'].url) return normalizeThumb(entry['media$thumbnail'].url);
      const content = (entry.content && entry.content.$t) || (entry.summary && entry.summary.$t) || '';
      const m = content.match(/<img[^>]+src=["']([^"']+)["']/i);
      return normalizeThumb(m ? m[1] : NO_IMG);
    } catch { return NO_IMG; }
  };
  const extractLabel = (entry) => { try { const c = entry.category || []; return c.length ? (c[0].term || null) : null; } catch { return null; } };
  const extractLink  = (entry) => { try { const l = (entry.link || []).find(x => x.rel === 'alternate'); return l ? l.href : '#'; } catch { return '#'; } };
  const extractTitle = (entry) => { try { return (entry.title && entry.title.$t) || 'Untitled'; } catch { return 'Untitled'; } };

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
      // Insert slider before existing slideI if present, else append
      const preSlideI = box.querySelector('.slideI');
      preSlideI ? box.insertBefore(slider, preSlideI) : box.appendChild(slider);
    } else {
      // Ensure 'flex' class on slider
      if (!slider.classList.contains('flex')) slider.classList.add('flex');
      // Clear only slider contents (do not wipe siblings)
      slider.innerHTML = '';
    }

    // Ensure .slideI exists; preserve its classes if present
    let slideI = box.querySelector('.slideI');
    if (!slideI) {
      slideI = document.createElement('div');
      slideI.className = 'slideI flex center i12'; // default per user's request
      box.appendChild(slideI);
    } else {
      // Do NOT overwrite className; keep e.g. "slideI flex center i12"
      slideI.innerHTML = ''; // only clear children (dots)
    }
    return { slider, slideI };
  }

  function buildItem(entry) {
    const href = extractLink(entry);
    const title = extractTitle(entry);
    const img = extractImage(entry);
    const label = extractLabel(entry);

    const a = document.createElement('a');
    a.className = 'item';
    a.href = href;
    a.setAttribute('aria-label', title);

    const imgSpan = document.createElement('span');
    imgSpan.className = 'img';
    imgSpan.style.backgroundImage = `url("${img}")`;

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
    cap.textContent = title;

    a.appendChild(imgSpan);
    a.appendChild(cap);
    return a;
  }

  async function init() {
    const box = pickContainer();
    const { slider, slideI } = ensureStructure(box);

    let entries = await fetchEntries(40);
    if (!entries.length) return;
    entries = shuffle(entries).slice(0, 4);

    entries.forEach(e => slider.appendChild(buildItem(e)));

    for (let i = 0; i < entries.length; i++) {
      const dot = document.createElement('span');
      dot.className = 'i';
      slideI.appendChild(dot);
    }

    if (CREDIT) box.dataset.sharedBy = CREDIT;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
