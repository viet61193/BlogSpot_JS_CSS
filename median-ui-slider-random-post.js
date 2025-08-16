/*!
 * Median UI - Random Posts Slider (Clean reimplementation)
 * Usage: load this file via <script src="https://<your-cdn>/median-ui-slider-random-post.js"></script>
 * It will auto-run when loaded (DOMContentLoaded-safe), using global `wcSliderRandom` if present.
 * No external dependencies. No remote fetches except Blogger JSONP.
 */
(function(){
  "use strict";

  // --- idempotency guard ---
  if (window.__MUISliderRandomBooted) return;
  window.__MUISliderRandomBooted = true;

  // ----- tiny utils -----
  function $(sel, root){ return (root||document).querySelector(sel); }
  function $c(tag, cls){ var el = document.createElement(tag); if (cls) el.className = cls; return el; }
  function once(fn){ var done=false; return function(){ if(done) return; done=true; try{ fn.apply(this, arguments);}catch(e){} }; }
  function shuffle(a){ a = a.slice(); for (var i=a.length-1;i>0;i--){ var j = Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
  function onReady(cb){
    if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", cb, {once:true}); }
    else { cb(); }
  }
  function toOrigin(u){
    try { var x = document.createElement("a"); x.href = u; return x.protocol + "//" + x.host; } catch(e){ return null; }
  }

  // ----- configuration (with backward-compat keys) -----
  function readConfig(){
    var wc = (window.wcSliderRandom || {});
    var origin = (function(){
      // Prefer canonical's origin, then location.origin
      var link = document.querySelector('link[rel=canonical]');
      if (link && link.href){ var o = toOrigin(link.href); if (o) return o; }
      if (window.location && window.location.origin) return window.location.origin;
      return (window.location.protocol + "//" + window.location.host);
    })();

    var blogUrl = (wc.blogUrl || origin + "/");
    if (!/\/$/.test(blogUrl)) blogUrl += "/";

    function pickNum(){
      for (var i=0;i<arguments.length;i++){
        var v = arguments[i];
        if (v == null) continue;
        var n = parseInt(v, 10);
        if (n > 0) return n;
      }
      return null;
    }

    return {
      blogUrl: blogUrl,
      amount: pickNum(wc.amount, wc.posts, wc.postCount, 5) || 5,
      fetchSize: pickNum(wc.fetchSize, wc.maxResults, 50) || 50,
      label: (typeof wc.label === "string" && wc.label.trim() ? wc.label.trim() : null),
      autoRotate: (wc.autoRotate == null ? true : !!wc.autoRotate),
      rotateInterval: pickNum(wc.rotateInterval, 4000) || 4000,
      containerSelector: (wc.containerSelector || ".slideB.scrlH.fontM.noPrint"),
      noImage: (wc.noImage || "data:image/png;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="),
      thumbSize: (function(){ var n = parseInt(wc.thumbnailSize || "1600",10); return (n>0 ? n : 1600); })(),
      // optional allowlist domains (to mimic original anti-copy check). If provided, only run on these.
      allowedDomains: (Array.isArray(wc.allowedDomains) ? wc.allowedDomains : null)
    };
  }

  function domainAllowed(cfg){
    if (!cfg.allowedDomains || !cfg.allowedDomains.length) return true;
    var host = window.location.host.toLowerCase();
    for (var i=0;i<cfg.allowedDomains.length;i++){
      var d = String(cfg.allowedDomains[i] || "").toLowerCase().trim();
      if (!d) continue;
      if (host === d || host.endsWith("."+d)) return true;
    }
    return false;
  }

  function ensureSliderContainer(root){
    var s = root.querySelector(".slider");
    if (!s){ s = $c("div","slider"); root.appendChild(s); }
    return s;
  }

  function getAltLink(entry){
    if (entry && entry.link && entry.link.length){
      for (var i=0;i<entry.link.length;i++){
        var L = entry.link[i];
        if (L && L.rel === "alternate" && L.href) return L.href;
      }
    }
    return "#";
  }

  function getLabel(entry){
    if (entry && entry.category && entry.category.length){
      var c = entry.category[0];
      if (c && typeof c.term === "string") return c.term;
    }
    return null;
  }

  function normalizeSize(url, size, fallback){
    if (!url) return fallback;
    try{
      // Force https
      url = url.replace(/^http:\/\//i, "https://");
      // Replace common Blogger size tokens
      url = url.replace(/\/s\d+(?:\-c)?\//, "/s"+size+"/");
      url = url.replace(/=[whs]\d{2,4}(-c)?/g, "=s"+size);
      // handle googleusercontent style '?imgmax='
      url = url.replace(/([?&])(imgmax|w|h)=\d+/g, "$1s="+size);
      return url;
    }catch(e){ return fallback; }
  }

  function getThumb(entry, cfg){
    if (!entry) return cfg.noImage;
    if (entry.media$thumbnail && entry.media$thumbnail.url)
      return normalizeSize(entry.media$thumbnail.url, cfg.thumbSize, cfg.noImage);

    if (entry.content && entry.content.$t){
      var m = entry.content.$t.match(/<img[^>]+src=['"]([^'"]+)['"]/i);
      if (m) return normalizeSize(m[1], cfg.thumbSize, cfg.noImage);
    }
    return cfg.noImage;
  }

  function buildItem(entry, cfg, isFirst){
    var title = (entry && entry.title && entry.title.$t) ? entry.title.$t : "Không tiêu đề";
    var url = getAltLink(entry);
    var thumb = getThumb(entry, cfg);
    var label = getLabel(entry);

    var a = $c("a","item"); a.href = url; a.title = title; a.setAttribute("aria-label", title);
    a.rel = "noopener noreferrer";
    a.target = "_self";

    var imgWrap = $c("div","img");
    var img = $c("img");
    img.src = thumb;
    img.alt = title;
    img.loading = "lazy";
    imgWrap.appendChild(img);

    var cap = $c("div","cap");
    if (label){
      var cat = $c("div","category");
      var btn = $c("a","button");
      btn.textContent = label;
      btn.href = (cfg.blogUrl.replace(/\/+$/,"") + "/search/label/" + encodeURIComponent(label));
      btn.rel = "noopener noreferrer";
      cat.appendChild(btn);
      cap.appendChild(cat);
    }
    var h3 = $c("h3","title");
    h3.textContent = title;
    cap.appendChild(h3);

    a.appendChild(imgWrap);
    a.appendChild(cap);
    a.style.display = isFirst ? "block" : "none";
    return a;
  }

  function setupRotate(root, cfg){
    if (!cfg.autoRotate) return;
    var items = root.querySelectorAll(".item");
    if (items.length <= 1) return;
    var idx = 0;
    setInterval(function(){
      try{
        items[idx].style.display = "none";
        idx = (idx + 1) % items.length;
        items[idx].style.display = "block";
      }catch(e){/* ignore */}
    }, cfg.rotateInterval);
  }

  function injectJSONP(url){
    var s = document.createElement("script");
    s.src = url; s.async = true;
    document.body.appendChild(s);
  }

  function start(){
    var cfg = readConfig();
    if (!domainAllowed(cfg)) return;

    var host = document.querySelector(cfg.containerSelector);
    if (!host) return; // container not found, quietly exit

    var slider = ensureSliderContainer(host);
    slider.innerHTML = ""; // clear previous render if any

    var CB = "__MUI_RAND_CB_" + Math.random().toString(36).slice(2);
    window[CB] = once(function(data){
      try{
        var entries = (data && data.feed && data.feed.entry) ? data.feed.entry : [];
        if (!entries.length) return;

        var pick = shuffle(entries).slice(0, Math.max(1, cfg.amount));
        for (var i=0;i<pick.length;i++){
          slider.appendChild(buildItem(pick[i], cfg, i===0));
        }
        setupRotate(slider, cfg);
      } finally {
        try { delete window[CB]; } catch(_) { window[CB] = undefined; }
      }
    });

    var base = cfg.blogUrl.replace(/\/+$/,"");
    var feed = base + "/feeds/posts/default" + (cfg.label ? "/-/" + encodeURIComponent(cfg.label) : "");
    var url = feed + "?alt=json-in-script"
                  + "&orderby=published"
                  + "&max-results=" + encodeURIComponent(cfg.fetchSize)
                  + "&callback=" + encodeURIComponent(CB);

    injectJSONP(url);
  }

  onReady(start);
})();
