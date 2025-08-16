/* Slider Random Post - Clean version (deobfuscated & documented)
   Original behavior mirrored from obfuscated script by wendycode (median-ui slider random post).
   This version keeps the same public surface (global callbacks) and DOM structure expectations.
   Author: refactor by ChatGPT (2025-08-16)
*/

(function () {
  'use strict';

  // ---- Config ----
  // Provide defaults; allow overrides via global wcSliderRandom (same object name as original)
  const cfg = (typeof window.wcSliderRandom === 'object' && window.wcSliderRandom) || {};
  const options = {
    // Where to render. Expect a container with class "slideB" (matches your CSS)
    containerSelector: cfg.containerSelector || '.slideB',
    // Blogger blog base; by default uses current origin (works when placed on the blog)
    blogBase: cfg.blogBase || (window.location.origin || ''),
    // Label (category) to filter; omit for all labels
    label: cfg.label || null,
    // Number of posts to show
    amount: Number(cfg.amount || 6),
    // Autoplay and interval
    auto: cfg.auto !== false, // default true
    timeout: Number(cfg.timeOut || cfg.timeout || 5000),
    // Thumbnail size (Blogger can transform by /s1600/ etc.)
    thumbnailSize: String(cfg.thumbnailSize || '1600'),
    // Fallback 1x1 png
    noImage: cfg.noImage || 'data:image/png;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
    // Credit text (not used for gating/redirects; only for optional attribution)
    sharedBy: cfg.sharedBy || 'www.wendycode.com'
  };

  // ---- Utilities ----
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function ensureThumb(url) {
    if (!url) return options.noImage;
    try {
      // Normalize blogger thumbnail size to /s{size}/
      return url.replace(/\/s\d+\//, `/s${options.thumbnailSize}/`);
    } catch {
      return url;
    }
  }

  function extractFirstImage(html) {
    if (!html) return null;
    const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    return m ? m[1] : null;
  }

  // ---- Rendering ----
  function renderSlider(posts, container) {
    container.innerHTML = ''; // reset

    const slider = document.createElement('div');
    slider.className = 'slider';

    // Build items
    posts.forEach((p, idx) => {
      const item = document.createElement('div');
      item.className = 'slideI'; // "slide item" - same class observed in original
      item.style.display = idx === 0 ? 'block' : 'none';

      // Image wrapper
      const imgWrap = document.createElement('div');
      imgWrap.className = 'img';

      const aImg = document.createElement('a');
      aImg.href = p.link;
      aImg.title = p.title;

      const img = document.createElement('img');
      img.alt = p.title;
      img.loading = 'lazy';
      img.src = ensureThumb(p.thumbnail) || options.noImage;

      aImg.appendChild(img);
      imgWrap.appendChild(aImg);

      // Category pill (top-right)
      const cat = document.createElement('div');
      cat.className = 'category';
      if (p.category) {
        const aCat = document.createElement('a');
        aCat.className = 'button';
        aCat.href = p.categoryLink || '#';
        aCat.textContent = p.category;
        cat.appendChild(aCat);
      }
      imgWrap.appendChild(cat);

      // Caption overlay
      const cap = document.createElement('div');
      cap.className = 'cap';
      const aTitle = document.createElement('a');
      aTitle.href = p.link;
      aTitle.textContent = p.title;
      cap.appendChild(aTitle);

      item.appendChild(imgWrap);
      item.appendChild(cap);
      slider.appendChild(item);
    });

    container.appendChild(slider);

    // Autoplay controls
    if (options.auto) {
      let idx = 0;
      let timerId = null;
      const items = $$('.slideI', slider);

      function show(n) {
        items.forEach((el, i) => {
          el.style.display = i === n ? 'block' : 'none';
        });
      }
      function tick() {
        idx = (idx + 1) % items.length;
        show(idx);
        timerId = window.setTimeout(tick, options.timeout);
      }
      // Start
      timerId = window.setTimeout(tick, options.timeout);

      // Pause on hover / resume on leave
      slider.addEventListener('mouseenter', () => {
        if (timerId) {
          window.clearTimeout(timerId);
          timerId = null;
        }
      });
      slider.addEventListener('mouseleave', () => {
        if (!timerId) {
          timerId = window.setTimeout(tick, options.timeout);
        }
      });

      // Expose minimal API on container for manual control if desired
      container.__sliderNext = () => {
        if (timerId) {
          window.clearTimeout(timerId);
          timerId = null;
        }
        tick();
      };
    }
  }

  // ---- Blogger JSONP plumbing ----
  // We keep the same callback names used in the obfuscated script so existing "callback=slideRandom/slideB" still work
  window.slideRandom = function slideRandom(json) {
    // The obfuscated version used a two-step fetch: first to learn total entries and pick a random start index,
    // then fetched the actual page with callback=slideB. We simplify by just fetching a bigger slice once.
    // However, to stay compatible with existing usage, we still inject a second fetch with callback=slideB.

    // Build feed URL
    const base = options.blogBase.replace(/\/$/, '');
    const labelSeg = options.label ? `/-/` + encodeURIComponent(options.label) : '';
    const max = Math.max(20, options.amount * 3); // fetch enough, then shuffle
    const url = `${base}/feeds/posts/summary${labelSeg}?alt=json-in-script&orderby=published&max-results=${max}&callback=slideB`;

    const s = document.createElement('script');
    s.async = true;
    s.src = url;
    document.body.appendChild(s);
  };

  window.slideB = function slideB(json) {
    // Parse entries
    const entries = (json && json.feed && json.feed.entry) ? json.feed.entry : [];
    if (!entries.length) return;

    // map raw entry -> simplified object
    let posts = entries.map(e => {
      const title = (e.title && e.title.$t) || '(untitled)';
      const link = Array.isArray(e.link) ? (e.link.find(l => l.rel === 'alternate') || e.link[0]).href : '#';
      const thumb = e.media$thumbnail && e.media$thumbnail.url || extractFirstImage(e.content && e.content.$t || e.summary && e.summary.$t);
      const category = Array.isArray(e.category) && e.category.length ? e.category[0].term : (options.label || '');
      const categoryLink = category ? `${options.blogBase.replace(/\/$/, '')}/search/label/${encodeURIComponent(category)}` : null;
      return { title, link, thumbnail: thumb || options.noImage, category, categoryLink };
    });

    // randomize and take the desired amount
    posts = shuffle(posts).slice(0, options.amount);

    // find container
    const container = $(options.containerSelector);
    if (!container) {
      if (console && console.warn) {
        console.warn('[slider-random-post] container not found:', options.containerSelector);
      }
      return;
    }

    // Render
    renderSlider(posts, container);
  };

  // ---- Bootstrap ----
  // If the host page added a script tag calling slideRandom via JSONP already, we don't do anything.
  // Otherwise, auto-start by injecting the "slideRandom" request which will then call slideB.
  if (!window.__sliderRandomBooted) {
    window.__sliderRandomBooted = true;
    const base = options.blogBase.replace(/\/$/, '');
    const labelSeg = options.label ? `/-/` + encodeURIComponent(options.label) : '';
    const url = `${base}/feeds/posts/summary${labelSeg}?alt=json-in-script&max-results=1&callback=slideRandom`;
    const s = document.createElement('script');
    s.async = true;
    s.src = url;
    document.body.appendChild(s);
  }
})();