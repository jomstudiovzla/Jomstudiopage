/* Harmonie d'Ailleurs — interactions */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();

  // Nav, menu, FAB
  var nav = $('#nav'), fab = $('.fab'), burger = $('#burger'), menu = $('#menu');
  function onScroll() {
    var y = window.scrollY;
    nav.classList.toggle('solid', y > window.innerHeight * 0.6 || burger.getAttribute('aria-expanded') === 'true');
    fab.classList.toggle('show', y > window.innerHeight);
  }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  burger.addEventListener('click', function () {
    var open = burger.getAttribute('aria-expanded') === 'true';
    burger.setAttribute('aria-expanded', String(!open));
    burger.setAttribute('aria-label', open ? 'Ouvrir le menu' : 'Fermer le menu');
    menu.hidden = open;
    document.body.style.overflow = open ? '' : 'hidden';
    onScroll();
  });
  $$('#menu a').forEach(function (a) { a.addEventListener('click', function () { if (burger.getAttribute('aria-expanded') === 'true') burger.click(); }); });

  // Reveal + counters
  function count(el) {
    var end = +el.dataset.count, pre = el.dataset.prefix || '', t0 = null;
    if (reduce) { el.textContent = pre + end; return; }
    var start = end > 1000 ? end - 60 : 0;
    requestAnimationFrame(function step(t) { if (!t0) t0 = t; var p = Math.min((t - t0) / 1500, 1), e = 1 - Math.pow(1 - p, 3); el.textContent = pre + Math.round(start + (end - start) * e); if (p < 1) requestAnimationFrame(step); });
  }
  var io = new IntersectionObserver(function (en) {
    en.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      var c = e.target.querySelector('[data-count]'); if (c) count(c);
      io.unobserve(e.target);
    });
  }, { threshold: 0.15 });
  $$('.rv').forEach(function (el, i) { el.style.transitionDelay = ((i % 3) * 0.1) + 's'; io.observe(el); });

  // Musical journey
  var ERAS = [
    { t: 'Moyen Âge', img: 'cathedral', x: 'Le voyage commence sous les voûtes : monodies et premières polyphonies, quand la voix seule suffisait à remplir une cathédrale.' },
    { t: 'Renaissance', img: 'glass', x: "Les voix s'entrelacent. La polyphonie de la Renaissance, ciselée comme un vitrail, met en valeur chaque pupitre du chœur." },
    { t: 'Baroque & classique', img: 'organ', x: "Des grandes œuvres baroques jusqu'à Mozart, le chœur s'entoure d'instruments : orgue, piano, cordes." },
    { t: 'Chant sacré', img: 'candles', x: 'Splendeur et grâce du chant sacré : un répertoire que le chœur aime faire résonner dans les églises et la cathédrale de Dijon.' },
    { t: 'Chanson française', img: 'sheet2', x: "De Mozart à Brassens : la chanson française a toute sa place dans le voyage, portée par guitare, ukulélé et contrebasse." },
    { t: 'Anglo-saxon', img: 'mic', x: 'Gospel, folk, chants anglo-saxons… le chœur traverse la Manche et l’Atlantique avec le même plaisir de chanter ensemble.' },
    { t: 'Jazz', img: 'trumpeter', x: 'Pour finir en swing : trompette, contrebasse et percussions rejoignent les voix pour des arrangements jazz.' }
  ];
  var btns = $$('.era-btns button'), note = $('#eraNote');
  function showEra(i, anim) {
    btns.forEach(function (b) { b.setAttribute('aria-selected', String(+b.dataset.e === i)); });
    var e = ERAS[i];
    $('#eraNum').textContent = ('0' + (i + 1)).slice(-2);
    $('#eraTitle').textContent = e.t;
    $('#eraText').textContent = e.x;
    var img = $('#eraImg'); img.src = 'assets/images/' + e.img + '.webp'; img.alt = e.t;
    note.style.left = ((i + 0.5) / ERAS.length * 100) + '%';
    if (anim && !reduce) {
      [img, $('.era-body')].forEach(function (el) { el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap'); });
    }
  }
  btns.forEach(function (b) { b.addEventListener('click', function () { showEra(+b.dataset.e, true); }); });
  showEra(0, false);

  // Lite YouTube player
  var vinyl = $('#vinyl'), yt = $('#yt');
  if (vinyl) vinyl.addEventListener('click', function () {
    yt.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/WLGV-5oatNg?autoplay=1" title="Harmonie d\'Ailleurs - Maquette Audio 2016" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
    yt.hidden = false; vinyl.hidden = true;
  });
})();
