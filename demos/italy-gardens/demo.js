/* Italy Gardens & Nursery — interactions */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // Year
  var yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();

  // Nav: solid after hero, floating call button
  var nav = $('#nav'), fab = $('.fab');
  function onScrollNav() {
    var y = window.scrollY;
    nav.classList.toggle('solid', y > window.innerHeight * 0.75);
    fab.classList.toggle('show', y > window.innerHeight);
  }

  // Mobile menu
  var burger = $('#burger'), menu = $('#menu');
  burger.addEventListener('click', function () {
    var open = burger.getAttribute('aria-expanded') === 'true';
    burger.setAttribute('aria-expanded', String(!open));
    menu.hidden = open;
    nav.classList.toggle('solid', !open || window.scrollY > window.innerHeight * 0.75);
    document.body.style.overflow = open ? '' : 'hidden';
  });
  $$('#menu a').forEach(function (a) {
    a.addEventListener('click', function () { burger.click(); });
  });

  // Open-now (Pacific time)
  function status() {
    try {
      var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', hour: 'numeric', hour12: false }).formatToParts(new Date());
      var wd = parts.find(function (p) { return p.type === 'weekday'; }).value;
      var hr = parseInt(parts.find(function (p) { return p.type === 'hour'; }).value, 10) % 24;
      var d = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
      var openDay = d === 3 || d === 6;
      if (openDay && hr >= 9 && hr < 12) return { open: true, text: 'Open now · until noon' };
      var next = (openDay && hr < 9) ? 'today at 9 AM' : ((d >= 3 && d < 6) ? 'Saturday at 9 AM' : 'Wednesday at 9 AM');
      return { open: false, text: 'Closed · opens ' + next };
    } catch (e) { return { open: false, text: 'Open Wed & Sat · 9 AM – noon' }; }
  }
  var st = status();
  var on = $('#openNow');
  if (on) { on.querySelector('b').textContent = st.text; on.querySelector('.live').classList.toggle('on', st.open); }
  var liveText = $('#liveText'), liveDot = $('#liveDot');
  if (liveText) { liveText.textContent = st.open ? 'Open now' : 'Wed & Sat'; liveDot.classList.toggle('on', st.open); }

  // Story words light up as you scroll
  var story = $('#storyText');
  if (story) {
    story.innerHTML = story.textContent.split(' ').map(function (w) { return '<span class="w">' + w + '</span>'; }).join(' ');
  }
  var words = $$('#storyText .w');

  // Counters
  var counted = false;
  function runCounters() {
    if (counted) return; counted = true;
    $$('[data-count]').forEach(function (el) {
      var end = parseFloat(el.dataset.count), dec = parseInt(el.dataset.dec || '0', 10), t0 = null;
      if (reduce) { el.textContent = end.toFixed(dec); return; }
      function step(t) {
        if (!t0) t0 = t;
        var p = Math.min((t - t0) / 1600, 1), e = 1 - Math.pow(1 - p, 3);
        el.textContent = (end * e).toFixed(dec);
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  // Reveal on scroll
  $$('.sec-head, .stat, .note, .chips, .mrb-body, .visit-info > *, .foot-row').forEach(function (el) { el.classList.add('rv'); });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) {
        en.target.classList.add('in');
        if (en.target.classList.contains('stat')) runCounters();
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.15 });
  $$('.rv').forEach(function (el) { io.observe(el); });

  // Horizontal rooms + gallery parallax + story highlight
  var rooms = $('#rooms'), track = $('#roomsTrack'), bar = $('#roomsBar');
  var cols = $$('.gcol'), gallery = $('.gallery');
  function onScroll() {
    onScrollNav();
    var vh = window.innerHeight;
    // story words
    if (words.length) {
      var r = story.getBoundingClientRect();
      var p = (vh * 0.85 - r.top) / (r.height + vh * 0.35);
      var n = Math.round(Math.max(0, Math.min(1, p)) * words.length);
      words.forEach(function (w, i) { w.classList.toggle('on', i < n); });
    }
    // rooms
    if (rooms && window.innerWidth > 700) {
      var rr = rooms.getBoundingClientRect();
      var total = rooms.offsetHeight - vh;
      var prog = Math.max(0, Math.min(1, -rr.top / total));
      var max = track.scrollWidth - window.innerWidth;
      track.style.transform = 'translateX(' + (-max * prog) + 'px)';
      bar.style.width = (prog * 100) + '%';
    }
    // gallery
    if (gallery && !reduce && window.innerWidth > 700) {
      var gr = gallery.getBoundingClientRect();
      if (gr.top < vh && gr.bottom > 0) {
        var c = gr.top + gr.height / 2 - vh / 2;
        cols.forEach(function (col) { col.style.transform = 'translateY(' + (c * parseFloat(col.dataset.speed)) + 'px)'; });
      }
    }
  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (!ticking) { requestAnimationFrame(function () { onScroll(); ticking = false; }); ticking = true; }
  }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  // Nursery filter
  var chips = $$('.chip'), plants = $$('.plant');
  chips.forEach(function (ch) {
    ch.addEventListener('click', function () {
      chips.forEach(function (c) { c.classList.toggle('on', c === ch); c.setAttribute('aria-pressed', String(c === ch)); });
      var f = ch.dataset.f, i = 0;
      plants.forEach(function (p) {
        var show = f === 'all' || p.dataset.c === f;
        p.classList.toggle('hide', !show);
        p.classList.remove('pop');
        if (show) { p.style.animationDelay = (i++ * 0.06) + 's'; void p.offsetWidth; p.classList.add('pop'); }
      });
    });
  });

  // 3D tilt on plant cards (desktop)
  if (!reduce && window.matchMedia('(hover: hover)').matches) {
    plants.forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = 'perspective(800px) rotateY(' + (x * 10) + 'deg) rotateX(' + (-y * 10) + 'deg) translateY(-6px)';
      });
      card.addEventListener('mouseleave', function () { card.style.transform = ''; });
    });
  }
})();
