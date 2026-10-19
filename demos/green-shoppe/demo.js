/* Green Shoppe — interactions */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();

  // --- Hours (Pacific time) ---
  // [open, close] in hours; null = closed. Index: 0 = Sunday.
  var HOURS = [[10, 16], [9, 17], null, [9, 17], [9, 17], [9, 17], [10, 17]];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function fmt(h) { var s = h > 12 ? h - 12 : h; return s + (h >= 12 ? ' PM' : ' AM'); }
  function short(h) { return h > 12 ? h - 12 : h; }
  function now() {
    try {
      var p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
      var g = function (t) { return p.find(function (x) { return x.type === t; }).value; };
      return { d: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday')), h: (parseInt(g('hour'), 10) % 24) + parseInt(g('minute'), 10) / 60 };
    } catch (e) { var n = new Date(); return { d: n.getDay(), h: n.getHours() + n.getMinutes() / 60 }; }
  }
  var t = now(), today = HOURS[t.d], isOpen = !!today && t.h >= today[0] && t.h < today[1];
  var statusText;
  if (isOpen) statusText = 'Open now · until ' + fmt(today[1]);
  else {
    var nd = t.d, add = 0;
    if (today && t.h < today[0]) { statusText = 'Closed · opens today at ' + fmt(today[0]); }
    else {
      do { nd = (nd + 1) % 7; add++; } while (!HOURS[nd]);
      statusText = 'Closed · opens ' + (add === 1 ? 'tomorrow' : DAYS[nd]) + ' at ' + fmt(HOURS[nd][0]);
    }
  }
  var st = $('#status');
  if (st) { st.querySelector('b').textContent = statusText; st.querySelector('.pulse').classList.add(isOpen ? 'open' : 'closed'); }
  var row = $('#hours tr[data-d="' + t.d + '"]'); if (row) row.classList.add('today');
  var tagTop = $('#tagTop'), tagHours = $('#tagHours');
  if (tagTop) {
    if (isOpen) { tagTop.textContent = 'Open now!'; tagHours.textContent = short(today[0]) + ' – ' + short(today[1]); }
    else if (today) { tagTop.textContent = DAYS[t.d] + ' hours'; tagHours.textContent = short(today[0]) + ' – ' + short(today[1]); }
    else { tagTop.textContent = 'Closed today'; tagHours.textContent = 'Wed 9–5'; }
  }

  // --- Nav, FAB ---
  var nav = $('#nav'), fab = $('.fab'), burger = $('#burger'), menu = $('#menu');
  function onScroll() {
    var y = window.scrollY;
    nav.classList.toggle('solid', y > window.innerHeight * 0.7 || burger.getAttribute('aria-expanded') === 'true');
    fab.classList.toggle('show', y > window.innerHeight);
  }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  burger.addEventListener('click', function () {
    var open = burger.getAttribute('aria-expanded') === 'true';
    burger.setAttribute('aria-expanded', String(!open));
    menu.hidden = open;
    document.body.style.overflow = open ? '' : 'hidden';
    onScroll();
  });
  $$('#menu a').forEach(function (a) { a.addEventListener('click', function () { if (burger.getAttribute('aria-expanded') === 'true') burger.click(); }); });

  // --- Reveal ---
  $$('.why-title, .mentions').forEach(function (el) { el.classList.add('rv'); });
  var io = new IntersectionObserver(function (en) {
    en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.15 });
  $$('.rv').forEach(function (el, i) { el.style.transitionDelay = ((i % 4) * 0.08) + 's'; io.observe(el); });

  // --- Seed packets flip ---
  $$('.packet').forEach(function (p) {
    p.addEventListener('click', function () {
      p.classList.toggle('flipped');
      p.setAttribute('aria-pressed', p.classList.contains('flipped'));
    });
  });

  // --- Planting calendar (general Rogue Valley guide) ---
  var CAL = [
    { t: 'Plan & dream', x: 'A quiet month in the garden. Sketch your beds, prune dormant fruit trees, and plan what you will grow this year.', c: ['Garden planning', 'Pruning', 'Seed shopping'] },
    { t: 'Early cool-season start', x: 'On mild days, prepare the soil. Peas and onions can go in when the ground is workable.', c: ['Peas', 'Onion sets', 'Soil prep'] },
    { t: 'Cool-season crops', x: 'Spring is close. Hardy greens and brassicas tolerate cool nights. Cover them if a hard frost is forecast.', c: ['Lettuce', 'Spinach', 'Kale', 'Broccoli', 'Cabbage'] },
    { t: 'Greens, herbs & more', x: 'A great month for leafy greens and hardy herbs. Hold off on tomatoes until nights stay warm.', c: ['Lettuce', 'Chard', 'Parsley', 'Cilantro', 'Strawberries'] },
    { t: 'Warm-season planting begins', x: 'Once the frost risk passes (usually early to mid-May in Medford), it is time for the summer favorites.', c: ['Tomatoes', 'Peppers', 'Squash', 'Cucumbers', 'Basil', 'Marigolds'] },
    { t: 'Fill every gap', x: 'Warm soil means fast growth. Keep planting heat lovers, and water deeply in the morning.', c: ['Tomatoes', 'Peppers', 'Beans', 'Melons', 'Zinnias'] },
    { t: 'Keep it going', x: 'Water deeply and mulch. Start planning your fall garden, and keep harvesting so plants keep producing.', c: ['Mulch', 'Succession lettuce (shade)', 'Fall brassica starts'] },
    { t: 'Plant your fall garden', x: 'A great time to set out starts for a fall and winter harvest.', c: ['Broccoli', 'Cabbage', 'Kale', 'Lettuce', 'Cauliflower'] },
    { t: 'Fall greens & perennials', x: 'Cooler days are easy on new plants. Great for greens, perennials and shrubs.', c: ['Lettuce', 'Spinach', 'Perennials', 'Mums'] },
    { t: 'Garlic & bulbs', x: 'Plant garlic and spring bulbs now for next year. Clean up spent summer crops.', c: ['Garlic', 'Tulips & daffodils', 'Cover crops'] },
    { t: 'Put the garden to bed', x: 'Mulch beds, protect tender plants, and bring potted herbs indoors.', c: ['Mulch', 'Frost protection', 'Indoor herbs'] },
    { t: 'Rest & gifts', x: 'Time to rest. A plant makes a great gift for the gardener in your life.', c: ['Houseplants', 'Gift ideas', 'Planning'] }
  ];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONF = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var mBtns = $$('.months button'), card = $('#calCard');
  function showMonth(m, anim) {
    mBtns.forEach(function (b) { b.setAttribute('aria-selected', String(+b.dataset.m === m)); });
    $('#calMonth').textContent = MON[m];
    $('#calMonth').setAttribute('aria-label', MONF[m]);
    $('#calTitle').textContent = CAL[m].t;
    $('#calText').textContent = CAL[m].x;
    $('#calChips').innerHTML = CAL[m].c.map(function (c, i) { return '<span style="animation-delay:' + (i * 0.06) + 's">' + c + '</span>'; }).join('');
    if (anim && !reduce) { var b = $('.cal-body'); b.classList.remove('swap-in'); void b.offsetWidth; b.classList.add('swap-in'); }
  }
  var cm = new Date().getMonth();
  mBtns.forEach(function (b) {
    if (+b.dataset.m === cm) b.classList.add('now');
    b.addEventListener('click', function () { showMonth(+b.dataset.m, true); });
  });
  showMonth(cm, false);
})();
