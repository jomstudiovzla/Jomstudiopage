/* Quinta do Jardim — interações */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();
  var PHONE = '351927764731';

  // ---- Nav / menu / fab ----
  var nav = $('#nav'), fab = $('.fab'), burger = $('#burger'), menu = $('#menu');
  function onScroll() { var y = window.scrollY; nav.classList.toggle('solid', y > 40); fab.classList.toggle('show', y > window.innerHeight * .8); }
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

  // ---- Pétalas a cair (subtil) ----
  var box = $('#petals');
  if (box && !reduce) {
    var live = 0;
    setInterval(function () {
      if (document.hidden || live > 10) return;
      var p = document.createElement('i'); p.className = 'petal';
      var dur = 7 + Math.random() * 6;
      p.style.left = (Math.random() * 100) + 'vw';
      p.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px');
      p.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
      p.style.animationDuration = dur + 's';
      p.style.transform = 'scale(' + (.6 + Math.random() * .8) + ')';
      box.appendChild(p); live++;
      setTimeout(function () { p.remove(); live--; }, dur * 1000);
    }, 1100);
  }

  // ---- A Quinta: cena ilustrada, dia/noite ----
  var HOUSE = [
    { t: 'A casa', d: 'Paredes cor-de-rosa, cantos brancos e telhado de telha. Uma casa ampla e acolhedora, pensada para famílias e amigos.', n: 'À noite, as janelas acendem-se e a casa fica ainda mais acolhedora. Hora de jantar e de conversas longas.' },
    { t: 'O jardim', d: 'Relvado, um caminho de pedra que serpenteia até à porta e candeeiros ao longo do percurso. Espaço para respirar.', n: 'Os candeeiros iluminam o caminho e o jardim enche-se de pirilampos. O silêncio do campo faz o resto.' },
    { t: 'A fonte', d: 'O som da água a correr no meio do jardim. O lugar preferido das crianças e de quem procura sossego.', n: 'À noite, só se ouve a água da fonte. Perfeito para um último passeio antes de dormir.' },
    { t: 'As roseiras', d: 'Não é por acaso que se chama Quinta do Jardim: há rosas à volta da casa e ao longo do jardim.', n: 'O perfume das rosas sente-se ainda mais ao fim do dia, quando o ar fica mais fresco.' },
    { t: 'O céu', d: 'Longe das luzes da cidade, os dias são de sol e de céu aberto. A natureza em harmonia, como dizem os hóspedes.', n: 'Sem as luzes da cidade, as estrelas aparecem todas. Leve uma manta para o jardim.' }
  ];
  var scene = $('#scene'), pins = $$('.pin'), pls = $$('.pl'), hCard = $('#hCard'), cur = 0, night = false;
  function showHouse(i) {
    cur = i; var h = HOUSE[i];
    $('#hTitle').textContent = h.t; $('#hText').textContent = night ? h.n : h.d;
    pins.forEach(function (b) { b.classList.toggle('on', +b.dataset.h === i); });
    pls.forEach(function (b) { var on = +b.dataset.h === i; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    if (!reduce) { hCard.classList.remove('swap'); void hCard.offsetWidth; hCard.classList.add('swap'); }
  }
  function setMode(m) {
    night = m === 'night'; scene.classList.toggle('night', night);
    $$('.dn-btn').forEach(function (b) { var on = b.dataset.mode === m; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    showHouse(cur);
  }
  pins.forEach(function (b) { b.addEventListener('click', function () { showHouse(+b.dataset.h); }); });
  pls.forEach(function (b) { b.addEventListener('click', function () { showHouse(+b.dataset.h); }); });
  $$('.dn-btn').forEach(function (b) { b.addEventListener('click', function () { setMode(b.dataset.mode); }); });
  // começa de noite se em Aveiro já for noite
  try {
    var hh = +new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', hour: 'numeric', hour12: false }).format(new Date());
    setMode(hh >= 20 || hh < 7 ? 'night' : 'day');
  } catch (e) { setMode('day'); }
  // profundidade com o rato
  if (!reduce && window.matchMedia('(hover: hover)').matches) {
    var L = [[$('.ly1'), 6], [$('.ly2'), 10], [$('.ly3'), 16], [$('.ly4'), 28]];
    scene.addEventListener('mousemove', function (e) {
      var r = scene.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      L.forEach(function (l) { if (l[0]) l[0].style.transform = 'translate(' + (-x * l[1]) + 'px,' + (-y * l[1] * .4) + 'px)'; });
    });
    scene.addEventListener('mouseleave', function () { L.forEach(function (l) { if (l[0]) l[0].style.transform = ''; }); });
  }

  // ---- Para quem ----
  var WHO = [
    { t: 'Famílias', img: 'crianca', x: 'Relvado para correr, fonte para descobrir e espaço para todos. As crianças brincam ao ar livre e os pais descansam, longe do trânsito da cidade.', l: ['Espaço exterior amplo', 'Ambiente calmo e seguro', 'Natureza à porta'] },
    { t: 'Casais', img: 'rosas2', x: 'Uma escapadinha romântica entre rosas: manhãs lentas, passeios ao pôr do sol nas Salinas e jantares na Costa Nova.', l: ['Silêncio e privacidade', 'Pôr do sol na Ria', 'Aveiro a 10 minutos'] },
    { t: 'Amigos', img: 'luzes', x: 'Fins de tarde no jardim, conversas até tarde e dias de praia na Barra e na Costa Nova. A base perfeita para o grupo.', l: ['Espaço para todos', 'Jardim para conviver', 'Praias a 25 minutos'] },
    { t: 'De passagem', img: 'moliceiro2', x: 'Vai a caminho do Porto ou de Coimbra? Faça uma pausa tranquila em Aveiro, com acesso rápido ao centro e às autoestradas.', l: ['Fácil de chegar', 'Contacto direto e rápido', 'Descanso garantido'] }
  ];
  var qts = $$('.qt'), qCard = $('#qCard');
  qts.forEach(function (b) {
    b.addEventListener('click', function () {
      var d = WHO[+b.dataset.q];
      qts.forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', String(on)); });
      $('#qImg').src = 'assets/images/' + d.img + '.webp'; $('#qTitle').textContent = d.t; $('#qText').textContent = d.x;
      $('#qList').innerHTML = d.l.map(function (s) { return '<li>' + s + '</li>'; }).join('');
      if (!reduce) { qCard.classList.remove('swap'); void qCard.offsetWidth; qCard.classList.add('swap'); }
    });
  });

  // ---- Explorar ----
  var EX = [
    { t: 'Centro de Aveiro', img: 'moliceiro', alt: 'Moliceiros nos canais de Aveiro', x: 'Os canais, os moliceiros coloridos e os ovos moles. A "Veneza portuguesa" fica a cerca de dez minutos de carro.' },
    { t: 'Salinas de Aveiro', img: 'salinas', alt: 'Montes de sal nas Salinas de Aveiro', x: 'Montes de sal branco, flamingos e pores do sol cor-de-rosa. Um dos passeios mais bonitos da região.' },
    { t: 'Costa Nova', img: 'costanova', alt: 'Casas listradas da Costa Nova', x: 'As famosas casas às riscas, a praia de areia fina e o mercado de peixe. Perfeito para um dia de verão.' },
    { t: 'Farol da Barra', img: 'farol', alt: 'Farol junto ao mar', x: 'O farol mais alto de Portugal e a Praia da Barra, com o seu longo areal e o pôr do sol sobre o Atlântico.' },
    { t: 'Natureza à volta', img: 'floresta', alt: 'Caminho de floresta com luz do sol', x: 'Pinhais, caminhos rurais e ar puro. À porta da quinta há passeios a pé e de bicicleta para todos os ritmos.' }
  ];
  var exs = $$('.ex'), exCard = $('#exCard');
  exs.forEach(function (b) {
    b.addEventListener('click', function () {
      var d = EX[+b.dataset.e];
      exs.forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', String(on)); });
      $('#eImg').src = 'assets/images/' + d.img + '.webp'; $('#eImg').alt = d.alt; $('#eTitle').textContent = d.t; $('#eText').textContent = d.x;
      if (!reduce) { exCard.classList.remove('swap'); void exCard.offsetWidth; exCard.classList.add('swap'); }
    });
  });

  // ---- Pedido de reserva (WhatsApp) ----
  var dIn = $('#dIn'), dOut = $('#dOut'), cnt = { ad: 2, ch: 0 }, sum = $('#bkSum');
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function pt(s) { var p = s.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  var t = new Date(); t.setHours(12, 0, 0, 0);
  var a = new Date(t); a.setDate(a.getDate() + 7); var b2 = new Date(t); b2.setDate(b2.getDate() + 9);
  dIn.value = iso(a); dOut.value = iso(b2); dIn.min = iso(t); dOut.min = iso(a);
  function nights() { var x = new Date(dIn.value + 'T12:00'), y = new Date(dOut.value + 'T12:00'); return Math.round((y - x) / 864e5); }
  function upd() {
    var n = nights();
    $('#nights').textContent = n > 0 ? n + (n === 1 ? ' noite' : ' noites') : 'Datas por definir';
    $('#sumTxt').textContent = cnt.ad + (cnt.ad === 1 ? ' adulto' : ' adultos') + (cnt.ch ? ' · ' + cnt.ch + (cnt.ch === 1 ? ' criança' : ' crianças') : '');
    if (!reduce) { sum.classList.remove('bump'); void sum.offsetWidth; sum.classList.add('bump'); }
  }
  dIn.addEventListener('change', function () { dOut.min = dIn.value; if (nights() < 1) { var d = new Date(dIn.value + 'T12:00'); d.setDate(d.getDate() + 1); dOut.value = iso(d); } upd(); });
  dOut.addEventListener('change', upd);
  $$('.stepper button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var k = btn.dataset.s, v = cnt[k] + (+btn.dataset.d), min = k === 'ad' ? 1 : 0;
      cnt[k] = Math.max(min, Math.min(12, v)); $('#' + k).textContent = cnt[k]; upd();
    });
  });
  upd();
  $('#booking').addEventListener('submit', function (e) {
    e.preventDefault();
    var n = nights(), old = $('.bk-err'); if (old) old.remove();
    if (n < 1) { var er = document.createElement('p'); er.className = 'bk-err'; er.textContent = 'A data de partida tem de ser depois da chegada.'; sum.after(er); return; }
    var name = $('#nm').value.trim();
    var msg = 'Olá! Gostaria de pedir uma reserva na Quinta do Jardim.' +
      '\nChegada: ' + pt(dIn.value) + '\nPartida: ' + pt(dOut.value) + ' (' + n + (n === 1 ? ' noite' : ' noites') + ')' +
      '\nHóspedes: ' + $('#sumTxt').textContent + (name ? '\nNome: ' + name : '') + '\nObrigado!';
    window.open('https://wa.me/' + PHONE + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
  });
})();
