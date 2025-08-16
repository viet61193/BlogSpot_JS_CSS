/*!
 * Median UI - Random Posts Slider (v3 - mimic WendyCode)
 * Author: ChatGPT (for hobaoviet.name.vn)
 * Drop-in file for CDN use. Auto-runs on load.
 * Compatible with global wcSliderRandom config.
 */
(function(){
  "use strict";
  if (window.__MUISliderRandomBootedV3) return;
  window.__MUISliderRandomBootedV3 = true;

  // ---------- utils ----------
  var d = document;
  function $(sel, root){ return (root||d).querySelector(sel); }
  function $$(sel, root){ return Array.prototype.slice.call((root||d).querySelectorAll(sel)); }
  function $c(tag, cls){ var el=d.createElement(tag); if(cls) el.className=cls; return el; }
  function shuffle(a){ a=a.slice(); for (var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
  function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }
  function once(fn){ var done=false; return function(){ if(done) return; done=true; try{ fn.apply(this, arguments);}catch(e){} }; }
  function onReady(cb){ if (d.readyState==="loading") d.addEventListener("DOMContentLoaded", cb, {once:true}); else cb(); }

  // ---------- config ----------
  function readCfg(){
    var wc = (window.wcSliderRandom || {});
    var link = d.querySelector('link[rel=canonical]');
    var origin = (function(){
      try{
        if (wc.blogUrl) return wc.blogUrl.replace(/\/+$/,'') + '/';
        if (link && link.href){ var a=d.createElement('a'); a.href=link.href; return (a.protocol+'//'+a.host+'/'); }
        return (location.protocol+'//'+location.host+'/');
      } catch(e){ return (location.protocol+'//'+location.host+'/'); }
    })();
    var thumb = parseInt(wc.thumbnailSize||1600,10); if(!(thumb>0)) thumb=1600;
    return {
      blogUrl: origin,
      amount: parseInt(wc.amount||wc.posts||5,10)||5,
      fetchSize: parseInt(wc.fetchSize||wc.maxResults||50,10)||50,
      label: (typeof wc.label==="string" && wc.label.trim()? wc.label.trim() : null),
      autoRotate: wc.autoRotate==null ? true : !!wc.autoRotate,
      rotateInterval: parseInt(wc.rotateInterval||4000,10)||4000,
      containerSelector: wc.containerSelector || ".slideB.scrlH.fontM.noPrint",
      noImage: wc.noImage || 'data:image/png;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
      thumbSize: thumb,
      allowedDomains: Array.isArray(wc.allowedDomains) ? wc.allowedDomains : null
    };
  }
  function domainAllowed(cfg){
    if (!cfg.allowedDomains || !cfg.allowedDomains.length) return true;
    var host = location.host.toLowerCase();
    for (var i=0;i<cfg.allowedDomains.length;i++){
      var d = String(cfg.allowedDomains[i]||"").toLowerCase().trim();
      if (d && (host===d || host.endsWith("."+d))) return true;
    }
    return false;
  }

  // ---------- core helpers ----------
  function ensureSlider(host){
    var s = host.querySelector(".slider");
    if (!s){ s = $c("div","slider"); host.appendChild(s); }
    return s;
  }
  function normalizeImg(url, size, fallback){
    if (!url) return fallback;
    url = url.replace(/^http:\/\//i,'https://');
    url = url.replace(/\/s\d+(?:\-c)?\//, '/s'+size+'/');
    url = url.replace(/=[whs]\d{2,4}(-c)?/g, '=s'+size);
    url = url.replace(/([?&])(imgmax|w|h)=\d+/g, '$1s='+size);
    return url;
  }
  function getLink(e){
    if (e && e.link && e.link.length){
      for (var i=0;i<e.link.length;i++) if (e.link[i].rel==="alternate" && e.link[i].href) return e.link[i].href;
    }
    return '#';
  }
  function getLabel(e){ return (e && e.category && e.category.length) ? e.category[0].term : null; }
  function getThumb(e, cfg){
    if (e && e.media$thumbnail && e.media$thumbnail.url) return normalizeImg(e.media$thumbnail.url, cfg.thumbSize, cfg.noImage);
    if (e && e.content && e.content.$t){
      var m = e.content.$t.match(/<img[^>]+src=['"]([^'"]+)['"]/i);
      if (m) return normalizeImg(m[1], cfg.thumbSize, cfg.noImage);
    }
    return cfg.noImage;
  }

  function buildCard(e, cfg){
    var t = (e && e.title && e.title.$t) ? e.title.$t : "Không tiêu đề";
    var href = getLink(e);
    var lab = getLabel(e);
    var thumb = getThumb(e, cfg);

    var a = $c('a','item'); a.href=href; a.title=t; a.setAttribute('aria-label', t); a.rel='noopener';
    var imgW = $c('div','img');
    var img = $c('img'); img.src=thumb; img.alt=t; img.loading='lazy'; imgW.appendChild(img);
    var cap = $c('div','cap');
    if (lab){
      var cat=$c('div','category');
      var btn=$c('a','button'); btn.textContent=lab;
      btn.href = cfg.blogUrl.replace(/\/+$/,'') + '/search/label/' + encodeURIComponent(lab);
      btn.rel='noopener';
      cat.appendChild(btn); cap.appendChild(cat);
    }
    var h3=$c('h3','title'); h3.textContent=t; cap.appendChild(h3);
    a.appendChild(imgW); a.appendChild(cap);

    // initial hidden state; fade timing tuned to 320ms for closer feel
    a.style.display = 'none';
    a.style.opacity = '0';
    a.style.transition = 'opacity 320ms ease';

    return a;
  }

  // ---------- slider class ----------
  function Slider(host, entries, cfg){
    this.host = host;
    this.slider = ensureSlider(host);
    this.cfg = cfg;
    this.items = [];
    this.idx = 0;
    this.timer = null;
    this.hover = false;

    var pick = shuffle(entries).slice(0, Math.max(1, cfg.amount));
    for (var i=0;i<pick.length;i++){ this.items.push(buildCard(pick[i], cfg)); }

    this.slider.innerHTML = '';
    for (var j=0;j<this.items.length;j++){ this.slider.appendChild(this.items[j]); }

    this.controls = this._controls();
    this._bind();
    // random start index like original feel
    var start = (this.items.length>1) ? Math.floor(Math.random()*this.items.length) : 0;
    this.show(start, true);
    this.auto(true);
  }
  Slider.prototype._controls = function(){
    var wrap = this.host;
    var prev = $c('button','wc-sld-prev'); prev.type='button'; prev.setAttribute('aria-label','Previous'); prev.textContent='◀';
    var next = $c('button','wc-sld-next'); next.type='button'; next.setAttribute('aria-label','Next'); next.textContent='▶';
    wrap.appendChild(prev); wrap.appendChild(next);
    return {prev:prev, next:next};
  };
  Slider.prototype._bind = function(){
    var self = this;
    this.controls.prev.addEventListener('click', function(e){ e.preventDefault(); self.prev(); });
    this.controls.next.addEventListener('click', function(e){ e.preventDefault(); self.next(); });
    // pause on hover
    this.host.addEventListener('mouseenter', function(){ self.hover=true; self.stop(); });
    this.host.addEventListener('mouseleave', function(){ self.hover=false; self.auto(false); });
    // keyboard
    this.host.setAttribute('tabindex','0');
    this.host.addEventListener('keydown', function(ev){
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); self.prev(); }
      else if (ev.key === 'ArrowRight') { ev.preventDefault(); self.next(); }
    });
    // swipe
    var sx=0, sy=0, sw=false;
    this.host.addEventListener('touchstart', function(ev){ var t=ev.touches[0]; sx=t.clientX; sy=t.clientY; sw=true; }, {passive:true});
    this.host.addEventListener('touchmove', function(ev){
      if (!sw) return;
      var t=ev.touches[0]; var dx=t.clientX-sx; var dy=t.clientY-sy;
      if (Math.abs(dx)>Math.abs(dy) && Math.abs(dx)>24){ sw=false; if (dx>0) self.prev(); else self.next(); }
    }, {passive:true});
    this.host.addEventListener('touchend', function(){ sw=false; }, {passive:true});
  };
  Slider.prototype._apply = function(i, instant){
    for (var k=0;k<this.items.length;k++){
      var el = this.items[k];
      el.style.display = 'none';
      el.style.opacity = '0';
      el.classList.remove('active');
    }
    var cur = this.items[i];
    cur.style.display = 'block';
    if (instant){
      var t = cur.style.transition; cur.style.transition='none';
      cur.offsetHeight; // reflow
      cur.style.opacity='1'; cur.classList.add('active');
      cur.style.transition = t;
    } else {
      requestAnimationFrame(function(){ cur.style.opacity='1'; cur.classList.add('active'); });
    }
  };
  Slider.prototype.show = function(i, instant){
    if (!this.items.length) return;
    i = (i%this.items.length + this.items.length) % this.items.length;
    this.idx = i;
    this._apply(i, instant);
  };
  Slider.prototype.next = function(){ this.show(this.idx+1, false); this._resetTimer(); };
  Slider.prototype.prev = function(){ this.show(this.idx-1, false); this._resetTimer(); };
  Slider.prototype._resetTimer = function(){ if (this.hover) return; this.stop(); this.auto(false); };
  Slider.prototype.stop = function(){ if (this.timer){ clearInterval(this.timer); this.timer=null; } };
  Slider.prototype.auto = function(first){
    if (!this.cfg.autoRotate || this.items.length<=1) return;
    var self=this;
    this.stop();
    // Randomized initial delay for first run for a more "organic" feel
    var initial = first ? Math.floor(this.cfg.rotateInterval* (0.8 + Math.random()*0.4)) : this.cfg.rotateInterval;
    this.timer = setInterval(function(){ if (!self.hover) self.next(); }, initial);
  };

  // ---------- bootstrap ----------
  function start(){
    var cfg = readCfg();
    if (!domainAllowed(cfg)) return;

    var host = $(cfg.containerSelector);
    if (!host) return;

    var CB = "__MUI_RAND_CB_V3_" + Math.random().toString(36).slice(2);
    window[CB] = once(function(data){
      try{
        var entries = (data && data.feed && data.feed.entry) ? data.feed.entry : [];
        if (!entries.length) return;
        new Slider(host, entries, cfg);
      } finally {
        try { delete window[CB]; } catch(_) { window[CB]=undefined; }
      }
    });

    var base = cfg.blogUrl.replace(/\/+$/,''); 
    var feed = base + "/feeds/posts/default" + (cfg.label ? "/-/" + encodeURIComponent(cfg.label) : "");
    var url = feed + "?alt=json-in-script&orderby=published&max-results=" + encodeURIComponent(cfg.fetchSize) + "&callback=" + encodeURIComponent(CB);
    var s = d.createElement('script'); s.src=url; s.async=true; d.body.appendChild(s);
  }

  onReady(start);
})();