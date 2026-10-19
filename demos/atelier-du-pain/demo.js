/* Atelier du Pain Châteauroux Lemoine — interactions */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();

  // ---- Opening status (Europe/Paris), 7/7 6h30-20h ----
  var OPEN = 6.5, CLOSE = 20;
  function parisHour() {
    try {
      var p = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
      return (parseInt(p.find(function (x) { return x.type === 'hour'; }).value, 10) % 24) + parseInt(p.find(function (x) { return x.type === 'minute'; }).value, 10) / 60;
    } catch (e) { var d = new Date(); return d.getHours() + d.getMinutes() / 60; }
  }
  var h = parisHour(), open = h >= OPEN && h < CLOSE;
  var txt = open ? 'Ouvert maintenant · ferme à 20h' : (h < OPEN ? 'Fermé · ouvre à 6h30' : 'Fermé · rouvre demain à 6h30');
  var td = $('#topDot'), ts = $('#topStatus');
  if (td) { td.classList.add(open ? 'open' : 'closed'); ts.textContent = txt + ' · 7j/7'; }
  var st = $('#status'); if (st) { st.querySelector('b').textContent = txt; st.querySelector('.pulse').classList.add(open ? 'open' : 'closed'); }

  // ---- Nav / menu / fab ----
  var nav = $('#nav'), fab = $('.fab'), burger = $('#burger'), menu = $('#menu');
  function onScroll() { var y = window.scrollY; nav.classList.toggle('solid', y > 40); fab.classList.toggle('show', y > window.innerHeight); }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  burger.addEventListener('click', function () {
    var o = burger.getAttribute('aria-expanded') === 'true';
    burger.setAttribute('aria-expanded', String(!o));
    burger.setAttribute('aria-label', o ? 'Ouvrir le menu' : 'Fermer le menu');
    menu.hidden = o; document.body.style.overflow = o ? '' : 'hidden';
  });
  $$('#menu a').forEach(function (a) { a.addEventListener('click', function () { if (burger.getAttribute('aria-expanded') === 'true') burger.click(); }); });

  // ---- Reveal ----
  var fidAnimated = false;
  var io = new IntersectionObserver(function (en) {
    en.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      if (e.target.classList.contains('fid-card-wrap') && !fidAnimated) { fidAnimated = true; countPts(); }
      io.unobserve(e.target);
    });
  }, { threshold: 0.15 });
  $$('.rv').forEach(function (el, i) { el.style.transitionDelay = ((i % 3) * 0.09) + 's'; io.observe(el); });

  // ---- Loyalty card: points counter + 3D tilt ----
  function countPts() {
    var el = $('#fcPts'), t0 = null;
    if (reduce) { el.textContent = '30'; return; }
    requestAnimationFrame(function step(t) { if (!t0) t0 = t; var p = Math.min((t - t0) / 1400, 1); el.textContent = Math.round(30 * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); });
  }
  var card = $('#fidCard');
  if (card && !reduce && window.matchMedia('(hover: hover)').matches) {
    card.addEventListener('mousemove', function (e) {
      var r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      card.style.transform = 'rotateY(' + (x * 18) + 'deg) rotateX(' + (-y * 18) + 'deg)';
    });
    card.addEventListener('mouseleave', function () { card.style.transform = ''; });
  }

  // ---- A day at Atelier du Pain ----
  var MOMENTS = [
    { t: '6h30', h: 6.5, title: "L'ouverture du fournil", x: 'Les premières baguettes sortent du four et les croissants dorent. Le café est prêt pour les lève-tôt.', sky: 'linear-gradient(180deg,#FFB98A,#FFE7C7)', dark: false },
    { t: '9h', h: 9, title: 'Le petit-déjeuner', x: 'Viennoiseries pur beurre, cappuccino et pain frais à emporter : la journée commence bien.', sky: 'linear-gradient(180deg,#9FD3F0,#FFF3DF)', dark: false },
    { t: '12h', h: 12, title: 'La pause déjeuner', x: 'Sandwichs chauds ou froids, pizzas, salades et Superpoké. Commandez en Click & Collect : prêt en 15 minutes.', sky: 'linear-gradient(180deg,#6EC1EE,#E8F6FF)', dark: false },
    { t: '16h', h: 16, title: "L'heure du goûter", x: 'Éclairs, tartelettes, cookies et un latte, en salon ou en terrasse.', sky: 'linear-gradient(180deg,#F6B35B,#FFE3B8)', dark: false },
    { t: '18h30', h: 18.5, title: 'Le pain du soir', x: 'Une baguette pour le dîner, une pizza pour ce soir. Ouvert jusqu’à 20h, 7 jours sur 7.', sky: 'linear-gradient(180deg,#23405E,#7C4C6E)', dark: true }
  ];
  var range = $('#hour'), sun = $('#sun'), sky = $('#sky'), jour = $('#journee'), mom = $('#moment');
  function posSun(i) {
    var w = $('.arc-wrap').clientWidth, pct = 0.04 + (i / (MOMENTS.length - 1)) * 0.92;
    var x = pct * w, ax = 20 / 1000 * w, bx = 980 / 1000 * w, t = (x - ax) / (bx - ax);
    var y = 20 + ((1 - t) * (1 - t) * 290 + 2 * (1 - t) * t * (-120) + t * t * 290) * (300 / 300);
    sun.style.left = x + 'px'; sun.style.top = y + 'px';
  }
  function showMoment(i, anim) {
    var m = MOMENTS[i];
    $('#mTime').textContent = m.t; $('#mTitle').textContent = m.title; $('#mText').textContent = m.x;
    sky.style.background = m.sky; jour.classList.toggle('dark', m.dark); sun.classList.toggle('moon', m.dark);
    range.value = i; range.setAttribute('aria-valuetext', m.t + ' : ' + m.title);
    posSun(i);
    if (anim && !reduce) { mom.classList.remove('swap'); void mom.offsetWidth; mom.classList.add('swap'); }
  }
  range.addEventListener('input', function () { showMoment(+range.value, true); });
  window.addEventListener('resize', function () { posSun(+range.value); });
  var start = 0; MOMENTS.forEach(function (m, i) { if (h >= m.h) start = i; });
  showMoment(start, false);

  // ---- Menu filter ----
  var tabs = $$('.tab'), items = $$('.item');
  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      tabs.forEach(function (x) { x.classList.toggle('on', x === t); x.setAttribute('aria-pressed', String(x === t)); });
      var f = t.dataset.f, k = 0;
      items.forEach(function (it) {
        var show = f === 'all' || it.dataset.c === f;
        it.classList.toggle('hide', !show); it.classList.remove('pop');
        if (show) { it.style.animationDelay = (k++ * 0.05) + 's'; void it.offsetWidth; it.classList.add('pop'); }
      });
    });
  });
})();
