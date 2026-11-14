/* DEE site behaviour. No dependencies. init() is safe to call again after the page content is swapped. */
(function () {
  'use strict';
  var doc = document;

  /* Mobile menu and language memory (delegated, bound once) */
  doc.addEventListener('click', function (e) {
    var t = e.target;
    var menu = t.closest('[data-menu]');
    if (menu) { setMenu(!doc.documentElement.classList.contains('menu-open')); return; }
    if (t.closest('.drawer a')) setMenu(false);
    var lang = t.closest('a.lang, a[hreflang]');
    if (lang) { try { localStorage.setItem('dee-lang', lang.getAttribute('lang') || 'ar'); } catch (err) {} }
  });
  var menuY = 0;
  function setMenu(open) {
    var was = doc.documentElement.classList.contains('menu-open');
    /* Freeze the page in place while the menu is open (works on iPhone Safari), and put it back exactly where it was on close. */
    if (open && !was) { menuY = window.scrollY; doc.body.style.top = -menuY + 'px'; }
    doc.documentElement.classList.toggle('menu-open', open);
    if (!open && was) { doc.body.style.top = ''; window.scrollTo({ top: menuY, left: 0, behavior: 'instant' }); }
    var btn = doc.querySelector('[data-menu]');
    if (btn) { btn.setAttribute('aria-expanded', String(open)); if (was && !open) btn.focus(); }
  }
  doc.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (doc.documentElement.classList.contains('menu-open')) setMenu(false); closeLb(); }
    if (e.key === 'Tab' && lb && lb.classList.contains('on')) {
      var bs = lb.querySelectorAll('button'), first = bs[0], last = bs[bs.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    if (lb && lb.classList.contains('on')) { if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-gallery] figure')) { e.preventDefault(); openLb(e.target); }
  });

  /* Lightbox */
  var lb, lbImgs = [], lbI = 0, lbFrom = null;
  function openLb(fig) {
    lb = doc.querySelector('.lightbox'); if (!lb) return; lbFrom = fig;
    lbImgs = Array.prototype.slice.call(fig.closest('[data-gallery]').querySelectorAll('figure img'));
    lbI = lbImgs.indexOf(fig.querySelector('img')); show(); lb.classList.add('on'); lb.querySelector('.lb-x').focus();
  }
  function show() {
    var im = lbImgs[lbI]; var el = lb.querySelector('img');
    /* The photo element is created on first open, so the page never carries an <img> without a src. */
    if (!el) { el = doc.createElement('img'); lb.insertBefore(el, lb.querySelector('.lb-n')); }
    el.src = im.getAttribute('src'); el.alt = im.alt; lb.querySelector('.lb-c').textContent = (lbI + 1) + ' / ' + lbImgs.length; }
  function step(d) { if (!lbImgs.length) return; lbI = (lbI + d + lbImgs.length) % lbImgs.length; show(); }
  function closeLb() { if (lb && lb.classList.contains('on')) { lb.classList.remove('on'); if (lbFrom && lbFrom.focus) lbFrom.focus(); } }
  doc.addEventListener('click', function (e) {
    var fig = e.target.closest('[data-gallery] figure');
    if (fig) return openLb(fig);
    if (e.target.closest('.lb-x') || e.target.classList.contains('lightbox')) return closeLb();
    if (e.target.closest('.lb-n')) return step(1);
    if (e.target.closest('.lb-p')) return step(-1);
  });

  /* Project filters: sector, city, discipline and text search. The choice is remembered for the visit. */
  doc.addEventListener('click', function (e) {
    var chip = e.target.closest('.chip'); if (!chip) return;
    var root = chip.closest('[data-filter]'); if (!root) return;
    chip.parentNode.querySelectorAll('.chip').forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
    applyFilter(root, true);
    track('project_filter', { filter: chip.dataset.f, value: chip.dataset.v || 'all' });
  });
  doc.addEventListener('input', function (e) {
    if (e.target.matches && e.target.matches('[data-q]')) applyFilter(e.target.closest('[data-filter]'), true);
  });
  function store(key, val) {
    try { if (val === undefined) return JSON.parse(sessionStorage.getItem(key) || 'null'); sessionStorage.setItem(key, JSON.stringify(val)); } catch (err) { return null; }
  }
  function applyFilter(root, save) {
    var want = {}, q = root.querySelector('[data-q]');
    root.querySelectorAll('.chip[aria-pressed="true"]').forEach(function (c) { want[c.dataset.f] = c.dataset.v; });
    var text = q ? q.value.trim().toLowerCase() : '';
    var n = 0;
    root.querySelectorAll('[data-card]').forEach(function (card) {
      var ok = (!want.city || card.dataset.city === want.city) && (!want.sector || card.dataset.sector === want.sector)
        && (!want.services || (' ' + card.dataset.services + ' ').indexOf(' ' + want.services + ' ') > -1)
        && (!text || card.textContent.toLowerCase().indexOf(text) > -1);
      card.hidden = !ok; if (ok) { n++; card.classList.add('in'); }
    });
    var out = root.querySelector('[data-count-out]'); if (out) out.textContent = plural(n, out.dataset.lang);
    var empty = root.querySelector('[data-empty]'); if (empty) empty.hidden = n !== 0;
    var form = root.querySelector('[data-filter-key]');
    if (save && form) { want.q = q ? q.value : ''; store(form.dataset.filterKey, want); }
  }
  function restoreFilter() {
    var root = doc.querySelector('[data-filter]'), form = root && root.querySelector('[data-filter-key]'); if (!form) return;
    var saved = store(form.dataset.filterKey); if (!saved) return;
    Object.keys(saved).forEach(function (k) {
      if (k === 'q') { var q = root.querySelector('[data-q]'); if (q) q.value = saved.q || ''; return; }
      var chip = root.querySelector('.chip[data-f="' + k + '"][data-v="' + saved[k] + '"]'); if (!chip) return;
      chip.parentNode.querySelectorAll('.chip').forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
    });
    applyFilter(root, false);
  }

  function plural(n, lang) {
    if (lang === 'ar') return n === 0 ? 'لا توجد مشاريع' : n === 1 ? 'مشروع واحد' : n === 2 ? 'مشروعان' : n <= 10 ? n + ' مشاريع' : n + ' مشروعاً';
    return n === 1 ? '1 project' : n + ' projects';
  }

  /* Enquiry form */
  function digits(s) { return (s || '').replace(/[^\d+]/g, ''); }
  function validPhone(v) { var d = digits(v).replace(/^\+/, '').replace(/^00/, ''); return /^(9665\d{8}|05\d{8}|5\d{8})$/.test(d) || /^\d{9,15}$/.test(d) && !/^(966|05|5)/.test(d); }
  function setBad(el, bad) { var f = el.closest('.field'); if (f) f.classList.toggle('bad', bad); el.setAttribute('aria-invalid', String(bad)); return bad; }
  function validate(form) {
    var bad = [], f = form.elements;
    if (setBad(f.name, f.name.value.trim().length < 2)) bad.push(f.name);
    if (setBad(f.phone, !validPhone(f.phone.value))) bad.push(f.phone);
    if (setBad(f.email, f.email.value.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.value.trim()))) bad.push(f.email);
    if (setBad(f.message, f.message.value.trim().length < 10)) bad.push(f.message);
    if (setBad(f.consent, !f.consent.checked)) bad.push(f.consent);
    if (bad.length) { var st = bad[0].closest('[data-step]'); if (st) showStep(form, st.dataset.step); bad[0].focus(); }
    return !bad.length;
  }
  function showStep(form, n) {
    form.querySelectorAll('[data-step]').forEach(function (s) { s.hidden = s.dataset.step !== String(n); });
    form.querySelectorAll('[data-ind]').forEach(function (s) { s.classList.toggle('on', s.dataset.ind === String(n)); s.classList.toggle('done', +s.dataset.ind < +n); });
  }
  function stepOne(form) {
    var m = form.elements.message;
    if (setBad(m, m.value.trim().length < 10)) { m.focus(); return false; }
    showStep(form, 2); form.elements.name.focus(); track('form_step_2'); return true;
  }
  function compose(form) {
    var f = form.elements, lines = [];
    function add(el) {
      var v = el.tagName === 'SELECT' ? (el.value ? el.options[el.selectedIndex].text : '') : el.value.trim();
      if (!v) return;
      var lab = form.querySelector('label[for="' + el.id + '"]');
      var name = lab ? lab.childNodes[0].textContent.trim() : el.name;
      lines.push(name + ': ' + v);
    }
    [f.type, f.name, f.company, f.phone, f.email, f.city, f.discipline].forEach(add);
    lines.push(''); lines.push(f.message.value.trim());
    return lines.join('\n');
  }
  doc.addEventListener('submit', function (e) {
    var form = e.target.closest('[data-enquiry]'); if (!form) return;
    e.preventDefault();
    if (form.elements.website.value) return; /* honeypot */
    var one = form.querySelector('[data-step="1"]');
    if (one && !one.hidden) { stepOne(form); return; }
    if (!validate(form)) return;
    var text = compose(form), box = form.parentNode, ready = box.querySelector('[data-ready]'), sent = box.querySelector('[data-sent]');
    function showReady(msg) {
      ready.querySelector('[data-ready-text]').textContent = text;
      if (msg) ready.querySelector('[data-ready-msg]').textContent = msg;
      ready.querySelector('[data-send-wa]').href = form.dataset.wa + '?text=' + encodeURIComponent(text);
      ready.querySelector('[data-send-mail]').href = 'mailto:' + form.dataset.mail + '?subject=' + encodeURIComponent(form.dataset.subject) + '&body=' + encodeURIComponent(text);
      form.hidden = true; ready.hidden = false; ready.focus(); ready.scrollIntoView({ block: 'center' });
      track('form_ready', { type: form.elements.type.value, discipline: form.elements.discipline.value || 'none' });
    }
    if (!form.dataset.endpoint) return showReady();
    var btn = form.querySelector('button[type="submit"]'), old = btn.innerHTML; btn.disabled = true; btn.textContent = form.dataset.sending;
    var payload = { subject: form.dataset.subject, message: text, page: location.href };
    if (form.dataset.key) payload.access_key = form.dataset.key;
    ['name', 'company', 'phone', 'email', 'city', 'type', 'discipline'].forEach(function (k) { payload[k] = form.elements[k].value; });
    fetch(form.dataset.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); form.hidden = true; sent.hidden = false; sent.focus(); track('form_sent', { type: form.elements.type.value }); })
      .catch(function () { showReady(form.dataset.failed); })
      .then(function () { btn.disabled = false; btn.innerHTML = old; });
  });
  doc.addEventListener('input', function (e) { var f = e.target.closest && e.target.closest('.field.bad'); if (f) { f.classList.remove('bad'); e.target.removeAttribute('aria-invalid'); } });
  doc.addEventListener('click', function (e) {
    var copy = e.target.closest('[data-copy]');
    if (copy) {
      var txt = copy.closest('[data-ready]').querySelector('[data-ready-text]').textContent, form = doc.querySelector('[data-enquiry]');
      try { navigator.clipboard.writeText(txt).then(function () { copy.textContent = form.dataset.copied; }, function () {}); } catch (err) {}
    }
    var next = e.target.closest('[data-next]'); if (next) stepOne(next.closest('form'));
    var back = e.target.closest('[data-back]'); if (back) { var bf = back.closest('form'); showStep(bf, 1); bf.elements.message.focus(); }
    var edit = e.target.closest('[data-edit]');
    if (edit) { var b = edit.closest('[data-ready]'); b.hidden = true; var fm = b.parentNode.querySelector('[data-enquiry]'); fm.hidden = false; showStep(fm, 1); fm.elements.message.focus(); }
  });

  /* Hero slides */
  var slideTimer = null;
  function slides() {
    if (slideTimer) { clearInterval(slideTimer); slideTimer = null; }
    var box = doc.querySelector('[data-slides]'); if (!box) return;
    var imgs = box.querySelectorAll('img'), i = 0, hero = box.closest('.hero');
    var n = hero.querySelector('[data-slide-n]'), cap = hero.querySelector('[data-slide-cap]'), bar = hero.querySelector('.bar');
    var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    function go(k) {
      i = (k + imgs.length) % imgs.length;
      imgs.forEach(function (im, j) { im.classList.toggle('on', j === i); });
      if (n) n.textContent = ('0' + (i + 1)).slice(-2);
      if (cap) { cap.classList.add('swap'); setTimeout(function () { cap.textContent = imgs[i].dataset.cap || ''; cap.classList.remove('swap'); }, 350); }
      if (bar) { bar.classList.remove('run'); void bar.offsetWidth; bar.classList.add('run'); }
    }
    function arm() { if (slideTimer) clearInterval(slideTimer); if (!calm) slideTimer = setInterval(function () { if (!doc.hidden) go(i + 1); }, 6500); }
    hero.onclick = function (e) {
      if (e.target.closest('[data-slide-next]')) { go(i + 1); arm(); }
      else if (e.target.closest('[data-slide-prev]')) { go(i - 1); arm(); }
    };
    if (bar) bar.classList.add('run');
    arm();
  }
  /* Scroll: compact header, mobile quote bar, slow drift on full-bleed photos */
  var ticking = false, calmAll = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function onScroll() {
    ticking = false;
    var y = window.scrollY, root = doc.documentElement, vh = window.innerHeight;
    root.classList.toggle('scrolled', y > 24);
    root.classList.toggle('past-hero', y > 520 && y + vh < root.scrollHeight - 260);
    if (calmAll) return;
    doc.querySelectorAll('[data-parallax]').forEach(function (el) {
      var r = el.parentNode.getBoundingClientRect(); if (r.bottom < 0 || r.top > vh) return;
      el.style.transform = 'translate3d(0,' + Math.round((r.top + r.height / 2 - vh / 2) * -0.12) + 'px,0)';
    });
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });

  /* Click tracking. Sends to Plausible or Google Analytics when one is installed, otherwise does nothing. */
  function track(name, props) {
    try {
      if (window.plausible) window.plausible(name, { props: props || {} });
      if (window.gtag) window.gtag('event', name, props || {});
    } catch (err) {}
  }
  doc.addEventListener('click', function (e) {
    var a = e.target.closest('a'); if (!a) return;
    var h = a.getAttribute('href') || '', where = a.closest('.hero, .cta, .qbar, .site-head, .drawer, .site-foot, .quote-card, .form-out');
    var p = { place: where ? where.className.split(' ')[0] : 'page' };
    if (a.dataset.track) track(a.dataset.track, p);
    else if (h.indexOf('wa.me') > -1) track('whatsapp_click', p);
    else if (h.indexOf('tel:') === 0) track('phone_click', p);
    else if (h.indexOf('mailto:') === 0) track('email_click', p);
    else if (/(\/|#[a-z]{2}-)contact\/?(\?|$)/.test(h)) track('quote_click', p);
  });

  /* Per-page setup */
  var io;
  function init() {
    setMenu(false);
    slides();
    restoreFilter();
    onScroll();
    if (doc.readyState === 'complete') { loadAhead(); warmSoon(); } else window.addEventListener('load', function () { loadAhead(); warmSoon(); }, { once: true });
    doc.querySelectorAll('.sec-head > *, .statement .wrap > *, .cta .wrap > *, .feature > *, .lead-fig, .spec > div, .client-wall li, .phero-facts > div, .pnav-item, .quote-card, .sband dl > div').forEach(function (el) { el.classList.add('reveal'); });
    doc.querySelectorAll('.reveal').forEach(function (el) {
      var sib = Array.prototype.filter.call(el.parentNode.children, function (c) { return c.classList.contains('reveal'); });
      el.style.setProperty('--d', Math.min(sib.indexOf(el), 5) * 0.09 + 's');
    });
    var items = doc.querySelectorAll('.reveal:not(.in)');
    if (!('IntersectionObserver' in window)) { items.forEach(function (el) { el.classList.add('in'); }); }
    else {
      if (io) io.disconnect();
      io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); count(en.target); } }); }, { rootMargin: '0px 0px 70% 0px' });
      items.forEach(function (el) { io.observe(el); });
      doc.querySelectorAll('[data-count]').forEach(function (el) { io.observe(el); });
    }
    /* Preselect discipline or request type from ?d= */
    var form = doc.querySelector('[data-enquiry]');
    if (form) {
      var d = null; try { d = new URLSearchParams(location.search).get('d'); } catch (err) {}
      if (d === 'prequalification') form.elements.type.value = d;
      else if (d && form.elements.discipline.querySelector('option[value="' + d + '"]')) form.elements.discipline.value = d;
    }
  }
  function count(el) {
    if (!el.dataset || !el.dataset.count || el.dataset.done) return; el.dataset.done = '1';
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var to = +el.dataset.count, suf = el.dataset.suffix || '', t0 = null;
    function tick(ts) { if (!t0) t0 = ts; var p = Math.min(1, (ts - t0) / 900); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))) + suf; if (p < 1) requestAnimationFrame(tick); }
    requestAnimationFrame(tick);
  }
  /* Warm-up: once the page is idle, fetch what the next tap is likely to need, so a first visit moves like a second one.
     Hosted site: the next page's HTML. Packed preview: the opening photos of the pages linked from here. */
  var warmed = {};
  function warmLink(a) {
    var h = a.getAttribute('href') || ''; if (!h || warmed[h] || a.target === '_blank') return;
    if (h.charAt(0) === '#') {
      var tpl = doc.getElementById('r-' + h.slice(1)); if (!tpl || !tpl.content) return; warmed[h] = 1;
      Array.prototype.slice.call(tpl.content.querySelectorAll('img'), 0, 2).forEach(function (im) {
        var pre = new Image(); pre.decoding = 'async';
        if (im.getAttribute('sizes')) pre.sizes = im.getAttribute('sizes');
        if (im.getAttribute('srcset')) pre.srcset = im.getAttribute('srcset');
        pre.src = im.getAttribute('src');
      });
    } else if (h.charAt(0) === '/' && h.indexOf('/img/') !== 0) {
      warmed[h] = 1; var l = doc.createElement('link'); l.rel = 'prefetch'; l.href = h.split('?')[0]; doc.head.appendChild(l);
    }
  }
  function warm() {
    var c = navigator.connection; if (c && (c.saveData || /2g/.test(c.effectiveType || ''))) return;
    var links = Array.prototype.slice.call(doc.querySelectorAll('.nav a, .hero a, .showcase, .pcard, .div-list a, .rack a, .pnav-item, .cta a'), 0, 12), i = 0;
    (function next() { if (i >= links.length) return; warmLink(links[i++]); setTimeout(next, 180); })();
  }
  ['pointerenter', 'touchstart', 'focusin'].forEach(function (ev) {
    doc.addEventListener(ev, function (e) { var a = e.target.closest && e.target.closest('a[href]'); if (a) warmLink(a); }, { passive: true, capture: true });
  });
  /* Photos further down the page start downloading as soon as the first screen is ready,
     in page order, so they are already there when the visitor scrolls to them. */
  function loadAhead() {
    var c = navigator.connection; if (c && (c.saveData || /2g/.test(c.effectiveType || ''))) return;
    var imgs = Array.prototype.slice.call(doc.querySelectorAll('img[loading="lazy"]')), i = 0;
    (function next() {
      var n = 0;
      while (i < imgs.length && n < 4) { imgs[i].loading = 'eager'; i++; n++; }
      if (i < imgs.length) setTimeout(next, 250);
    })();
  }
  function warmSoon() { if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 2500 }); else setTimeout(warm, 1500); }
  window.DEE = { init: init };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
