/* Nova Arcade Bar — interacciones */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();

  // ---- Horario (America/Caracas): miércoles a domingo, 13:00 – 24:00 ----
  var OPEN = 13, CLOSE = 24, DAYS = [0, 3, 4, 5, 6]; // 0 = domingo
  function caracasNow() {
    try {
      var p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Caracas', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
      var g = function (t) { return p.find(function (x) { return x.type === t; }).value; };
      var wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday'));
      return { d: wd, h: (parseInt(g('hour'), 10) % 24) + parseInt(g('minute'), 10) / 60 };
    } catch (e) { var n = new Date(); return { d: n.getDay(), h: n.getHours() + n.getMinutes() / 60 }; }
  }
  var now = caracasNow(), openDay = DAYS.indexOf(now.d) > -1, open = openDay && now.h >= OPEN && now.h < CLOSE;
  var NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  function nextOpen() {
    if (openDay && now.h < OPEN) return 'abre hoy a la 1:00 PM';
    for (var i = 1; i < 8; i++) { var d = (now.d + i) % 7; if (DAYS.indexOf(d) > -1) return 'abre el ' + NAMES[d] + ' a la 1:00 PM'; }
    return '';
  }
  var txt = open ? 'Abierto ahora · ¡a jugar!' : 'Cerrado · ' + nextOpen();
  var td = $('#topDot'), ts = $('#topStatus');
  if (td) { td.classList.add(open ? 'open' : 'closed'); ts.textContent = txt; }
  var st = $('#status'); if (st) { st.querySelector('b').textContent = txt; st.querySelector('.pulse').classList.add(open ? 'open' : 'closed'); }

  // ---- Nav / menú / fab ----
  var nav = $('#nav'), fab = $('.fab'), burger = $('#burger'), menu = $('#menu');
  function onScroll() { var y = window.scrollY; nav.classList.toggle('solid', y > 40); fab.classList.toggle('show', y > window.innerHeight); }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  burger.addEventListener('click', function () {
    var o = burger.getAttribute('aria-expanded') === 'true';
    burger.setAttribute('aria-expanded', String(!o));
    burger.setAttribute('aria-label', o ? 'Abrir el menú' : 'Cerrar el menú');
    menu.hidden = o; document.body.style.overflow = o ? '' : 'hidden';
  });
  $$('#menu a').forEach(function (a) { a.addEventListener('click', function () { if (burger.getAttribute('aria-expanded') === 'true') burger.click(); }); });

  // ---- Reveal ----
  var io = new IntersectionObserver(function (en) {
    en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  $$('.rv').forEach(function (el, i) { el.style.transitionDelay = ((i % 3) * 0.08) + 's'; io.observe(el); });

  // ---- Estrellas en el hero ----
  var cv = $('#stars');
  if (cv && !reduce) {
    var ctx = cv.getContext('2d'), W, H, S = [], vis = true;
    function size() { var r = cv.getBoundingClientRect(); W = cv.width = Math.round(r.width); H = cv.height = Math.round(r.height); S = []; for (var i = 0; i < Math.round(W * H / 9000); i++) S.push({ x: Math.random() * W, y: Math.random() * H, z: Math.random() * 1.6 + .3, t: Math.random() * 6 }); }
    size(); window.addEventListener('resize', size);
    new IntersectionObserver(function (e) { vis = e[0].isIntersecting; }).observe(cv);
    var COLS = ['#FFFFFF', '#C9B8FF', '#FFD23F', '#FF3EA5'];
    (function loop(t) {
      if (vis) {
        ctx.clearRect(0, 0, W, H);
        S.forEach(function (s, i) {
          s.x -= s.z * .25; if (s.x < 0) s.x = W;
          var a = .4 + .6 * Math.abs(Math.sin(t / 900 + s.t));
          ctx.globalAlpha = a; ctx.fillStyle = COLS[i % 4];
          ctx.fillRect(s.x, s.y, s.z * 1.6, s.z * 1.6);
        });
      }
      requestAnimationFrame(loop);
    })(0);
  }

  // ---- Selector de juegos ----
  var GAMES = [
    { n: 'Pinball', k: 'STAGE 01', img: 'pinball2', alt: 'Máquina de pinball iluminada', x: 'Tres mesas de pinball de verdad: The Addams Family, Super Mario Bros. y Theatre of Magic. Luces, rampas y multiball.', s: [100, 70, 95], b: 'MEJOR PARA: 1P · 2P POR TURNOS' },
    { n: 'Arcade', k: 'STAGE 02', img: 'arcade4', alt: 'Máquinas arcade clásicas con luces de neón', x: 'Máquinas arcade clásicas para revivir los 80 y 90: peleas, disparos y récords que esperan ser batidos.', s: [95, 85, 100], b: 'MEJOR PARA: 1P · 2P COOPERATIVO' },
    { n: 'Air hockey', k: 'STAGE 03', img: 'airhockey2', alt: 'Mesa de air hockey', x: 'Rápido, ruidoso y muy competitivo. El duelo perfecto para decidir quién paga la siguiente ronda.', s: [90, 100, 70], b: 'MEJOR PARA: 1 VS 1' },
    { n: 'Futbolito', k: 'STAGE 04', img: 'futbolito2', alt: 'Mesa de futbolito', x: 'El clásico de toda la vida. Arma tu equipo y que no se te escape la revancha.', s: [92, 95, 85], b: 'MEJOR PARA: 2 VS 2' }
  ];
  var slots = $$('.slot'), stage = $('#stage');
  function showGame(i) {
    var g = GAMES[i];
    slots.forEach(function (s) { var on = +s.dataset.g === i; s.classList.toggle('on', on); s.setAttribute('aria-selected', String(on)); });
    $('#gImg').src = 'assets/images/' + g.img + '.webp'; $('#gImg').alt = g.alt;
    $('#gK').textContent = g.k; $('#gName').textContent = g.n; $('#gText').textContent = g.x; $('#gBest').textContent = g.b;
    $$('#gStats i').forEach(function (b, j) { b.style.setProperty('--v', g.s[j] + '%'); });
    if (!reduce) { stage.classList.remove('swap'); void stage.offsetWidth; stage.classList.add('swap'); }
  }
  slots.forEach(function (s) { s.addEventListener('click', function () { showGame(+s.dataset.g); }); });

  // ---- Modos de juego ----
  var MODES = [
    { t: 'Modo un jugador', img: 'joystick', x: 'Una cerveza de barril, tu playlist favorito sonando y el récord del pinball esperándote. El mejor plan para desconectar después del trabajo.', tip: 'TIP: VEN TEMPRANO, CUANDO ESTÁ MÁS TRANQUILO' },
    { t: 'Con tu Player 2', img: 'amigos', x: 'La cita perfecta: unas partidas de air hockey, unos cócteles y una hamburguesa para compartir. Sin silencios incómodos.', tip: 'TIP: EL QUE PIERDE EN AIR HOCKEY INVITA' },
    { t: 'Con los panas', img: 'amigos3', x: 'Torneo de futbolito, ronda de cerveza de barril, nachos al centro y rock de fondo. Se te va a pasar la noche sin darte cuenta.', tip: 'TIP: ARMEN EQUIPOS 2 VS 2 EN EL FUTBOLITO' },
    { t: 'Cumpleaños', img: 'neonpurple', x: '¿Cumples años? Celébralo entre máquinas, luces de neón y buena música. Escríbenos por Instagram y te ayudamos a organizarlo.', tip: 'TIP: AVÍSANOS CON TIEMPO POR INSTAGRAM' }
  ];
  var modes = $$('.mode'), card = $('#modeCard');
  modes.forEach(function (m) {
    m.addEventListener('click', function () {
      var i = +m.dataset.m, d = MODES[i];
      modes.forEach(function (x) { x.classList.toggle('on', x === m); });
      $('#mImg').src = 'assets/images/' + d.img + '.webp'; $('#mTitle').textContent = d.t; $('#mText').textContent = d.x; $('#mTip').textContent = d.tip;
      if (!reduce) { card.classList.remove('swap'); void card.offsetWidth; card.classList.add('swap'); }
    });
  });

  // ---- Continue countdown ----
  var c = $('#cont'), n = 9;
  if (c && !reduce) setInterval(function () { n = n > 0 ? n - 1 : 9; c.textContent = 'CONTINUE ' + n; }, 1000);
})();
