/* Ribeira 2004 — interações */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();

  // ---- Horário (Europe/Lisbon) — todos os dias 7h00–20h00 ----
  var OPEN = 7, CLOSE = 20;
  function lisbonHour() {
    try {
      var p = new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
      return (parseInt(p.find(function (x) { return x.type === 'hour'; }).value, 10) % 24) + parseInt(p.find(function (x) { return x.type === 'minute'; }).value, 10) / 60;
    } catch (e) { var d = new Date(); return d.getHours() + d.getMinutes() / 60; }
  }
  var h = lisbonHour(), open = h >= OPEN && h < CLOSE;
  var txt = open ? 'Aberto agora · fecha às 20h' : (h < OPEN ? 'Fechado · abre às 7h' : 'Fechado · abre amanhã às 7h');
  var td = $('#topDot'), ts = $('#topStatus');
  if (td) { td.classList.add(open ? 'open' : 'closed'); ts.textContent = txt + ' · Padaria e Pastelaria'; }
  var st = $('#status'); if (st) { st.querySelector('b').textContent = txt; st.querySelector('.pulse').classList.add(open ? 'open' : 'closed'); }

  // ---- Nav / menu / fab ----
  var nav = $('#nav'), fab = $('.fab'), burger = $('#burger'), menu = $('#menu');
  function onScroll() { var y = window.scrollY; nav.classList.toggle('solid', y > 40); fab.classList.toggle('show', y > window.innerHeight); }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  burger.addEventListener('click', function () {
    var o = burger.getAttribute('aria-expanded') === 'true';
    burger.setAttribute('aria-expanded', String(!o));
    burger.setAttribute('aria-label', o ? 'Abrir o menu' : 'Fechar o menu');
    menu.hidden = o; document.body.style.overflow = o ? '' : 'hidden';
  });
  $$('#menu a').forEach(function (a) { a.addEventListener('click', function () { if (burger.getAttribute('aria-expanded') === 'true') burger.click(); }); });

  // ---- Reveal ----
  var io = new IntersectionObserver(function (en) {
    en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  $$('.rv').forEach(function (el, i) { el.style.transitionDelay = ((i % 3) * 0.08) + 's'; io.observe(el); });

  // ---- Anatomia do pastel de nata ----
  var NATA = [
    { t: 'Massa folhada', x: 'Centenas de camadas finas que estalam à primeira dentada. É o som de um pastel de nata bem feito.' },
    { t: 'Creme de ovos', x: 'Gemas, leite e açúcar, cozidos até ficarem macios e cremosos. Por dentro, ainda a tremer.' },
    { t: 'Topo caramelizado', x: 'O forno bem quente cria as manchas escuras no topo: é aí que mora o sabor a caramelo.' },
    { t: 'Canela & açúcar', x: 'Uma pitada de canela e açúcar em pó por cima, como manda a tradição. Peça-o quentinho!' }
  ];
  var hots = $$('.hot'), steps = $$('#nataSteps li'), card = $('#nataCard');
  function showNata(i) {
    $('#ncNum').textContent = '0' + (i + 1); $('#ncTitle').textContent = NATA[i].t; $('#ncText').textContent = NATA[i].x;
    hots.forEach(function (b) { b.classList.toggle('on', +b.dataset.i === i); });
    steps.forEach(function (s) { s.classList.toggle('on', +s.dataset.i === i); });
    if (!reduce) { card.classList.remove('swap'); void card.offsetWidth; card.classList.add('swap'); }
  }
  hots.forEach(function (b) { b.addEventListener('click', function () { showNata(+b.dataset.i); }); });
  steps.forEach(function (s) { s.addEventListener('click', function () { showNata(+s.dataset.i); }); });
  showNata(0);

  // ---- Montra: filtros ----
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

  // ---- Pequeno-almoço: combos ----
  var NAMES = {
    meia: 'Meia de leite', cafe: 'Café', galao: 'Galão', sumo: 'Sumo natural',
    croissant: 'croissant com manteiga', nata: 'pastel de nata', feijao: 'mini pastel de feijão', tosta: 'tosta mista'
  };
  var COMBOS = {
    'meia+croissant': ['O Clássico de Ribeira', 'Meia de leite e croissant com manteiga: o pedido mais repetido da casa.', '★ Favorito dos clientes'],
    'cafe+feijao': ['O Rápido', 'Um café e um mini pastel de feijão, de pé ao balcão. Dois minutos de felicidade.', '★ Favorito dos clientes'],
    'cafe+nata': ['A Bica Perfeita', 'O par mais português que existe: café e pastel de nata com canela.', '♥ Clássico português'],
    'galao+tosta': ['O Lanche Completo', 'Galão em copo alto e tosta mista quentinha. Perfeito a meio da tarde.', '☀ Ideal para o lanche'],
    'sumo+croissant': ['O Fresco', 'Sumo de laranja espremido na hora e croissant dourado.', '☀ Começar bem o dia']
  };
  var drink = 'meia', food = 'croissant', combo = $('#combo');
  function pick(group, btn) {
    $$('.opt', group).forEach(function (b) { b.classList.toggle('on', b === btn); });
  }
  function updateCombo() {
    var k = drink + '+' + food, c = COMBOS[k];
    var dImg = $('#optDrink .opt.on').dataset.img, fImg = $('#optFood .opt.on').dataset.img;
    $('#cImgA').src = 'assets/images/' + dImg + '.webp'; $('#cImgB').src = 'assets/images/' + fImg + '.webp';
    if (c) { $('#cName').textContent = c[0]; $('#cDesc').textContent = c[1]; $('#cBadge').textContent = c[2]; }
    else {
      $('#cName').textContent = 'À sua maneira';
      $('#cDesc').textContent = NAMES[drink] + ' com ' + NAMES[food] + '. Uma combinação com o seu nome, servida ao balcão ou na esplanada.';
      $('#cBadge').textContent = '✦ Combinação sua';
    }
    if (!reduce) { combo.classList.remove('swap'); void combo.offsetWidth; combo.classList.add('swap'); }
  }
  $$('#optDrink .opt').forEach(function (b) { b.addEventListener('click', function () { drink = b.dataset.v; pick($('#optDrink'), b); updateCombo(); }); });
  $$('#optFood .opt').forEach(function (b) { b.addEventListener('click', function () { food = b.dataset.v; pick($('#optFood'), b); updateCombo(); }); });
})();
