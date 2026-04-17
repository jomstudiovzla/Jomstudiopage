/* ═══════════════════════════════════════════════
   JOM STUDIO PORTFOLIO 2026 — Main JS
   Features: Canvas Logo BG, Sound Engine, Custom Cursor,
   Magnetic Buttons, Scroll Reveals, Counter Animation,
   Page Loader, Marquee pause on hover, Modal System
═══════════════════════════════════════════════ */

(function() {
'use strict';

/* ─────────────────────────────────────────────
   SOUND ENGINE (Web Audio API — no external files)
───────────────────────────────────────────── */
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function getAudioCtx() {
    if (!audioCtx) audioCtx = new AudioCtx();
    return audioCtx;
}

function playSound(type) {
    try {
        const ctx = getAudioCtx();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        if (type === 'click') {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, ctx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.1);
        } else if (type === 'hover') {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(660, ctx.currentTime);
            gainNode.gain.setValueAtTime(0.04, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.08);
        } else if (type === 'open') {
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(440, ctx.currentTime);
            oscillator.frequency.linearRampToValueAtTime(660, ctx.currentTime + 0.15);
            gainNode.gain.setValueAtTime(0.07, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.2);
        } else if (type === 'close') {
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(660, ctx.currentTime);
            oscillator.frequency.linearRampToValueAtTime(330, ctx.currentTime + 0.12);
            gainNode.gain.setValueAtTime(0.06, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.15);
        } else if (type === 'loader') {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(300, ctx.currentTime);
            oscillator.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.4);
            gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.45);
        }
    } catch(e) {
        // Audio not supported — continue silently
    }
}

/* ─────────────────────────────────────────────
   PAGE LOADER
───────────────────────────────────────────── */
const loader = document.getElementById('page-loader');
const loaderBar = document.getElementById('loader-bar');
const loaderPct = document.getElementById('loader-pct');

let progress = 0;
const loaderInterval = setInterval(() => {
    progress += Math.random() * 15;
    if (progress >= 100) {
        progress = 100;
        clearInterval(loaderInterval);
        loaderBar.style.width = '100%';
        loaderPct.textContent = '100%';
        setTimeout(() => {
            playSound('loader');
            loader.classList.add('hidden');
            document.body.style.overflow = '';
            // Trigger hero reveal
            document.querySelectorAll('#hero .reveal-up').forEach((el, i) => {
                setTimeout(() => el.classList.add('visible'), i * 120);
            });
        }, 400);
    }
    loaderBar.style.width = Math.min(progress, 100) + '%';
    loaderPct.textContent = Math.round(Math.min(progress, 100)) + '%';
}, 60);

// Block scroll during load
document.body.style.overflow = 'hidden';

/* ─────────────────────────────────────────────
   HERO CANVAS — Animated Logo Background
───────────────────────────────────────────── */
const canvas = document.getElementById('hero-canvas');
const ctx = canvas.getContext('2d');

let logoImg = null;
let particles = [];
let mouse = { x: -999, y: -999 };
let animFrame;

// Load logo
const img = new Image();
img.src = 'assets/logo_jom.png';
img.onload = () => {
    logoImg = img;
    initCanvas();
    animateCanvas();
};
img.onerror = () => {
    initCanvas();
    animateCanvas();
};

function resizeCanvas() {
    const hero = document.getElementById('hero');
    canvas.width = hero.offsetWidth;
    canvas.height = hero.offsetHeight;
}

class Particle {
    constructor() { this.reset(true); }
    reset(initial = false) {
        this.x = Math.random() * canvas.width;
        this.y = initial ? Math.random() * canvas.height : canvas.height + 10;
        this.size = Math.random() * 1.5 + 0.4;
        this.speedY = -(Math.random() * 0.4 + 0.1);
        this.speedX = (Math.random() - 0.5) * 0.2;
        this.opacity = Math.random() * 0.4 + 0.1;
        this.life = 1;
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;

        // Repel from mouse
        const dx = this.x - mouse.x;
        const dy = this.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
            const force = (100 - dist) / 100;
            this.x += (dx / dist) * force * 1.5;
            this.y += (dy / dist) * force * 1.5;
        }

        if (this.y < -10) this.reset();
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = '#2EC4B6';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function initCanvas() {
    resizeCanvas();
    particles = [];
    const count = Math.floor((canvas.width * canvas.height) / 8000);
    for (let i = 0; i < Math.max(count, 40); i++) {
        particles.push(new Particle());
    }
}

let logoAlpha = 0;
let logoScale = 1;
let logoRotation = 0;
let logoTime = 0;

function drawLogo() {
    if (!logoImg) return;
    ctx.save();

    logoTime += 0.003;
    logoAlpha = 0.04 + Math.sin(logoTime * 0.7) * 0.015;
    logoScale = 1 + Math.sin(logoTime * 0.5) * 0.015;
    logoRotation = Math.sin(logoTime * 0.3) * 0.008;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const maxW = canvas.width * 0.7;
    const maxH = canvas.height * 0.7;
    const scale = Math.min(maxW / logoImg.width, maxH / logoImg.height) * logoScale;
    const w = logoImg.width * scale;
    const h = logoImg.height * scale;

    ctx.globalAlpha = logoAlpha;
    ctx.translate(cx, cy);
    ctx.rotate(logoRotation);

    // Teal tint overlay
    ctx.filter = 'hue-rotate(20deg) saturate(1.2)';
    ctx.drawImage(logoImg, -w / 2, -h / 2, w, h);

    ctx.restore();
}

// Scan line effect
let scanY = 0;
function drawScanLine() {
    scanY += 1.5;
    if (scanY > canvas.height) scanY = 0;
    const grad = ctx.createLinearGradient(0, scanY - 60, 0, scanY + 60);
    grad.addColorStop(0, 'rgba(46,196,182,0)');
    grad.addColorStop(0.5, 'rgba(46,196,182,0.04)');
    grad.addColorStop(1, 'rgba(46,196,182,0)');
    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, scanY - 60, canvas.width, 120);
    ctx.restore();
}

// Grid overlay
function drawGrid() {
    ctx.save();
    ctx.globalAlpha = 0.025;
    ctx.strokeStyle = '#2EC4B6';
    ctx.lineWidth = 0.5;
    const spacing = 60;
    for (let x = 0; x < canvas.width; x += spacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += spacing) {
        ctx.beginPath();
        ctx.moveTo(0, y); ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
    ctx.restore();
}

function animateCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dark base
    ctx.fillStyle = '#0e0e0e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid();
    drawLogo();
    drawScanLine();

    particles.forEach(p => { p.update(); p.draw(); });

    // Radial glow from center
    const grd = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width * 0.5
    );
    grd.addColorStop(0, 'rgba(46,196,182,0.04)');
    grd.addColorStop(1, 'rgba(14,14,14,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    animFrame = requestAnimationFrame(animateCanvas);
}

// Track mouse for particle repulsion
document.getElementById('hero').addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
});
document.getElementById('hero').addEventListener('mouseleave', () => {
    mouse.x = -999; mouse.y = -999;
});

window.addEventListener('resize', () => {
    cancelAnimationFrame(animFrame);
    initCanvas();
    animateCanvas();
});

/* ─────────────────────────────────────────────
   CUSTOM CURSOR
───────────────────────────────────────────── */
const cursor = document.getElementById('cursor');
const follower = document.getElementById('cursor-follower');
let followerX = 0, followerY = 0;
let cursorX = 0, cursorY = 0;

document.addEventListener('mousemove', (e) => {
    cursorX = e.clientX;
    cursorY = e.clientY;
    cursor.style.left = cursorX + 'px';
    cursor.style.top = cursorY + 'px';
});

function animateCursor() {
    followerX += (cursorX - followerX) * 0.12;
    followerY += (cursorY - followerY) * 0.12;
    follower.style.left = followerX + 'px';
    follower.style.top = followerY + 'px';
    requestAnimationFrame(animateCursor);
}
animateCursor();

// Hover state on interactive elements
const hoverEls = document.querySelectorAll('a, button, .project-card, .cv-box, .photobook-item');
hoverEls.forEach(el => {
    el.addEventListener('mouseenter', () => {
        cursor.classList.add('hovered');
        follower.classList.add('hovered');
    });
    el.addEventListener('mouseleave', () => {
        cursor.classList.remove('hovered');
        follower.classList.remove('hovered');
    });
});

/* ─────────────────────────────────────────────
   MAGNETIC BUTTON EFFECT
───────────────────────────────────────────── */
document.querySelectorAll('.magnetic').forEach(el => {
    el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        el.style.transform = `translate(${dx * 0.25}px, ${dy * 0.25}px)`;
    });
    el.addEventListener('mouseleave', () => {
        el.style.transform = '';
    });
});

/* ─────────────────────────────────────────────
   SOUND ON INTERACTIONS
───────────────────────────────────────────── */
document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-sound]');
    if (el) playSound(el.dataset.sound);
});
document.querySelectorAll('.nav-link').forEach(el => {
    el.addEventListener('mouseenter', () => playSound('hover'));
});

/* ─────────────────────────────────────────────
   NAVIGATION — Scroll & Burger
───────────────────────────────────────────── */
const nav = document.getElementById('main-nav');
window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 60);
});

const burger = document.getElementById('nav-burger');
const mobileMenu = document.getElementById('mobile-menu');
burger.addEventListener('click', () => {
    playSound('click');
    burger.classList.toggle('open');
    mobileMenu.classList.toggle('open');
    document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
});
document.querySelectorAll('.mobile-link').forEach(link => {
    link.addEventListener('click', () => {
        burger.classList.remove('open');
        mobileMenu.classList.remove('open');
        document.body.style.overflow = '';
    });
});

/* ─────────────────────────────────────────────
   SCROLL REVEAL (IntersectionObserver)
───────────────────────────────────────────── */
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

document.querySelectorAll('.reveal-up').forEach(el => {
    // Skip hero — handled by loader
    if (!el.closest('#hero')) revealObserver.observe(el);
});

/* ─────────────────────────────────────────────
   COUNTER ANIMATION (Stats)
───────────────────────────────────────────── */
const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.querySelectorAll('.stat-num').forEach(el => {
            const target = parseInt(el.dataset.target);
            let current = 0;
            const step = Math.ceil(target / 40);
            const timer = setInterval(() => {
                current += step;
                if (current >= target) { current = target; clearInterval(timer); }
                el.textContent = current;
            }, 40);
        });
        counterObserver.unobserve(entry.target);
    });
}, { threshold: 0.5 });

const heroStats = document.querySelector('.hero-stats');
if (heroStats) counterObserver.observe(heroStats);

/* ─────────────────────────────────────────────
   MODAL SYSTEM
───────────────────────────────────────────── */
function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    playSound('open');
}
function closeModal(modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
    playSound('close');
}

// Open via modal-trigger
document.querySelectorAll('.modal-trigger').forEach(el => {
    el.addEventListener('click', () => {
        const id = el.getAttribute('data-target');
        if (id) openModal(id);
    });
});

// Close via close button
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.close-modal');
    if (btn) closeModal(btn.closest('.modal'));
});

// Close via backdrop
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) closeModal(e.target);
});

// Close via Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (lightbox.classList.contains('active')) {
            closeLightbox();
        } else {
            document.querySelectorAll('.modal.active').forEach(closeModal);
        }
    }
    if (lightbox.classList.contains('active')) {
        if (e.key === 'ArrowRight') lbNext();
        if (e.key === 'ArrowLeft') lbPrev();
    }
});

/* ─────────────────────────────────────────────
   LIGHTBOX ENGINE
───────────────────────────────────────────── */
const lightbox   = document.getElementById('lightbox');
const lbImg      = document.getElementById('lb-img');
const lbCur      = document.getElementById('lb-cur');
const lbTot      = document.getElementById('lb-tot');
const lbCaption  = document.getElementById('lb-caption');

let lbImages = [];   // [{src, title, desc}, ...]
let lbIndex  = 0;

function buildLbImages(gallery) {
    const items = gallery.querySelectorAll('.gallery-item img');
    return Array.from(items).map(img => ({
        src:   img.src,
        title: img.dataset.title || img.alt || '',
        desc:  img.dataset.desc  || ''
    }));
}

function openLightbox(images, startIndex) {
    lbImages = images;
    lbIndex  = startIndex;
    renderLb();
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
    playSound('open');
}

function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
    playSound('close');
    // Re-trigger img animation
    lbImg.style.opacity = '0';
    lbImg.style.transform = 'scale(0.92)';
}

function renderLb() {
    const item = lbImages[lbIndex];
    // Fade out → swap → fade in
    lbImg.style.opacity = '0';
    lbImg.style.transform = 'scale(0.95)';
    setTimeout(() => {
        lbImg.src = item.src;
        lbImg.alt = item.title;
        lbImg.style.opacity = '1';
        lbImg.style.transform = 'scale(1)';
    }, 160);
    lbCur.textContent = lbIndex + 1;
    lbTot.textContent = lbImages.length;
    lbCaption.innerHTML = item.title
        ? `<strong>${item.title}</strong>${item.desc}`
        : item.desc;
}

function lbNext() {
    lbIndex = (lbIndex + 1) % lbImages.length;
    renderLb();
    playSound('click');
}
function lbPrev() {
    lbIndex = (lbIndex - 1 + lbImages.length) % lbImages.length;
    renderLb();
    playSound('click');
}

// Click on gallery-item inside a modal → open lightbox
document.addEventListener('click', (e) => {
    const item = e.target.closest('.gallery-item');
    if (!item) return;
    const img = item.querySelector('img');
    if (!img) return;
    const gallery = item.closest('.modal-gallery');
    if (!gallery) return;
    const images = buildLbImages(gallery);
    const idx = Array.from(gallery.querySelectorAll('.gallery-item img')).indexOf(img);
    openLightbox(images, Math.max(0, idx));
});

// Lightbox controls
document.getElementById('lb-close').addEventListener('click', closeLightbox);
document.getElementById('lb-next').addEventListener('click', lbNext);
document.getElementById('lb-prev').addEventListener('click', lbPrev);

// Close on backdrop click (not image)
lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox || e.target.classList.contains('lightbox-img-wrap')) {
        closeLightbox();
    }
});

// Touch swipe support
let lbTouchX = 0;
lightbox.addEventListener('touchstart', (e) => { lbTouchX = e.touches[0].clientX; }, { passive: true });
lightbox.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - lbTouchX;
    if (Math.abs(dx) > 50) { dx < 0 ? lbNext() : lbPrev(); }
}, { passive: true });


/* ─────────────────────────────────────────────
   PARALLAX — Hero title on mouse move
───────────────────────────────────────────── */
document.addEventListener('mousemove', (e) => {
    const { innerWidth: W, innerHeight: H } = window;
    const x = (e.clientX / W - 0.5) * 2;
    const y = (e.clientY / H - 0.5) * 2;
    const title = document.querySelector('.hero-title');
    if (title) {
        title.style.transform = `translate(${x * 8}px, ${y * 4}px)`;
    }
});

/* ─────────────────────────────────────────────
   DYNAMIC PHOTOBOOK
───────────────────────────────────────────── */
const photobookData = [
    {
        id: "sesion-1",
        title: "Sesión I: Noche en La Guaira",
        desc: "Exploración nocturna de los callejones históricos de La Guaira, donde la arquitectura colonial venezolana cobra vida bajo las luces.",
        images: [
            { file: "WhatsApp Image 2026-04-17 at 17.01.22.jpeg", title: "El Callejón de las Escaleras", desc: "Perspectiva desde el interior del callejón colonial. Escaleras de piedra bañadas en luz azul que contrasta con los ocres de las paredes centenarias." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.25.jpeg", title: "Calle Bolívar — La Memoria de Piedra", desc: "Letrero histórico en pared ocre bajo luz nocturna. Las flores de buganvilia magenta caen sobre el borde, belleza en los rincones olvidados." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.27.jpeg", title: "Pasaje de las Palmas", desc: "Pasillo empedrado flanqueado por palmas y muros de ladrillo. Las guirnaldas de bombillos crean un techo de luz cálida bajo el cielo nocturno." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.29.jpeg", title: "Sendero Iluminado", desc: "Galería de arcos de ladrillo en perspectiva simétrica. Las luces colgantes se pierden en el punto de fuga como pequeños puntos dorados." }
        ]
    },
    {
        id: "sesion-2",
        title: "Sesión II: Calles de Luz y Sombra",
        desc: "Recorrido nocturno por el casco histórico, capturando la magia de los arcos iluminados, fachadas coloniales y la vida de sus habitantes.",
        images: [
            { file: "WhatsApp Image 2026-04-17 at 17.01.31.jpeg", title: "La Calle Viva", desc: "Callejón empedrado con arcos decorados por cientos de bombillos. El arco neón verde al fondo actúa como faro entre flores silvestres y columnas de piedra." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.32.jpeg", title: "La Ventana de los Siglos", desc: "Ventana enrejada en fachada de piedra colonial, iluminada en ámbar desde adentro. Ladrillo, piedra y barro narran siglos de historia en un solo encuadre." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.32 (1).jpeg", title: "Capas de Tiempo", desc: "Pared en ruinas donde conviven ladrillo antiguo, piedra rústica y enlucido descascarado. Un arco cegado sugiere aperturas que el tiempo fue sellando." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.32 (2).jpeg", title: "El Ojo de la Ruina", desc: "Túnel natural en roca arenisca enmarca una ventana colonial iluminada. La textura rugosa de la piedra domina el primer plano en tonos dorados." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.32 (3).jpeg", title: "Cueva de Memorias", desc: "Ángulo diferente del espacio rupestre. Las capas de sedimento forman un patrón casi orgánico alrededor de la ventana iluminada al fondo." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.32 (4).jpeg", title: "Balcón Colonial", desc: "Fachada amarilla vibrante con postigos de madera abiertos. Las palmas tropicales y la baranda generan capas que hablan de arquitectura viva y habitada." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.33.jpeg", title: "El Portal de la Medusa", desc: "Arco de medio punto blanco en contrapicado. Una escultura orgánica con forma de medusa cuelga iluminada desde abajo en atmósfera de galería de arte." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.33 (1).jpeg", title: "Red de Luces", desc: "Vista aérea del tejido de guirnaldas de bombillos sobre la calle. Arcos decorativos con neón verde crean profundidad teatral sobre el empedrado." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.34.jpeg", title: "Lluvia de Bombillos", desc: "Arcos iluminados curvados sobre la calle crean efecto de lluvia de luz. El faro azul en la esquina añade intensidad al fondo dorado." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.34 (1).jpeg", title: "Torre sobre Cielo Nublado", desc: "Edificio de varios pisos recortado contra cielo dramáticamente nublado. Composición minimalista en contrapicado que resalta la verticalidad arquitectónica." }
        ]
    },
    {
        id: "sesion-3",
        title: "Sesión III: Texturas & Arquitectura",
        desc: "Serie dedicada a detalles arquitectónicos, materiales históricos y encuadres abstractos que revelan la poesía visual oculta en el tiempo.",
        images: [
            { file: "WhatsApp Image 2026-04-17 at 17.01.35 (1).jpeg", title: "Horizonte Urbano", desc: "Edificio residencial en encuadre bajo. Las nubes densas contrastan con la fachada de concreto, creando atmósfera entre lo cotidiano y lo sublime." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.35 (2).jpeg", title: "Geometría Oculta", desc: "Muro colonial donde ladrillo, mampostería y enlucido crean patrones geométricos accidentales. La luz rasante revela profundidad en cada capa." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.35 (3).jpeg", title: "Relieves del Olvido", desc: "Superficie de piedra erosionada en macro. Los surcos y fracturas revelan una historia que ningún texto podría narrar con tanta sinceridad." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.35 (4).jpeg", title: "Entre Grietas", desc: "Textura coralina de pared antigua vista de cerca. El encuadre convierte el muro en un paisaje abstracto de montañas en miniatura color ámbar." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.35 (5).jpeg", title: "Paso del Tiempo", desc: "La transición entre estuque y piedra viva. Distintos materiales de construcción forman franjas casi pictóricas de color y textura." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.36.jpeg", title: "Arco de Piedra Viva", desc: "Arco de medio punto en ladrillo y piedra rústica visto desde el interior. La apertura central enmarca el exterior iluminado sobre la oscuridad." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.36 (1).jpeg", title: "Umbral Colonial", desc: "Umbral deteriorado mezclando mampostería, piedra y ladrillo — siglos de construcción superpuesta que hablan de continuidad y resistencia." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.36 (2).jpeg", title: "Luz en la Hendidura", desc: "Un rayo de luz penetra por una grieta angosta y toca el suelo empedrado. Simplicidad extrema que convierte un evento cotidiano en algo sagrado." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.36 (3).jpeg", title: "La Fachada que Respira", desc: "Muro de ladrillo expuesto con manchas de humedad que forman patrones orgánicos. Textura áspera y tonos tierra con inusitada belleza." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.36 (4).jpeg", title: "Código de Ladrillos", desc: "Vista perpendicular de muro de ladrillo antiguo. Cada pieza cuenta su historia de cocción, colocación y años de servicio estructural." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.37.jpeg", title: "Espejo de Agua", desc: "Superficie reflectante en el piso devuelve la imagen de los arcos iluminados. Simetría surreal que duplica la arquitectura histórica en el suelo." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.37 (1).jpeg", title: "Callejón en Plena Noche", desc: "Vista de conjunto del pasillo histórico con guirnaldas luminosas. Integración de plantas, arcos y personas en ambiente vibrante y cálido." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.37 (2).jpeg", title: "Detalles en Reposo", desc: "Elemento decorativo captado en quietud con fondo desenfocado. Composición íntima que transmite calma dentro del dinamismo urbano." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.37 (3).jpeg", title: "Sombras Paralelas", desc: "Sombras proyectadas sobre la pared por guirnaldas y estructuras del callejón. Líneas paralelas que crean un patrón gráfico sobre la percepción." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.37 (4).jpeg", title: "La Vuelta de los Arcos", desc: "Secuencia de arcos repetidos en profundidad crean ritmo visual hipnótico que guía la mirada hacia el punto de fuga iluminado." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.37 (5).jpeg", title: "Grano Grueso", desc: "Toma de alta sensibilidad con grano visible que convierte una escena nocturna en imagen cinematográfica, evocando el cine negro latinoamericano." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.38.jpeg", title: "Final de Calle", desc: "El extremo del callejón visto desde lejos. Densidad de luces y bullicio fundidos en masa de color dorado. La profundidad de campo comprime el espacio." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.38 (1).jpeg", title: "Puerta de Madera Antigua", desc: "Puerta centenaria con cerrojo de hierro forjado. Sus capas de pintura descascarada y madera veteada guardan huellas de décadas de uso cotidiano." }
        ]
    },
    {
        id: "sesion-yo",
        title: "Sesión IV: Retrato & Ciudad",
        desc: "Serie de retratos urbanos de Jesus Omar Martinez — fotografía callejera, estilo editorial y exploraciones visuales entre la identidad personal y la ciudad como escenario.",
        images: [
            {
                file: "Yo/Jesus Formal.jpeg",
                title: "Ciudad en los Ojos",
                desc: "Retrato formal en blanco y negro con fondo negro absoluto. Jesus viste traje negro y camisa blanca; sus lentes circulares redondos reflejan el skyline de una ciudad. La composición minimalista irradia una elegancia oscura de editorial de moda."
            },
            {
                file: "Yo/jesus sueter.jpeg",
                title: "Skyline en la Noche",
                desc: "Retrato en blanco y negro de alta definición. La ciudad se refleja nuevamente en los lentes circulares, mientras el pelo rizado enmarca un gesto sereno. El pin de caballito de mar en el suéter negro añade un detalle de identidad personal."
            },
            {
                file: "Yo/Jesus.jpeg",
                title: "Paz & Frecuencias",
                desc: "Selfie cálida e íntima en interior con luz natural. Jesus hace la señal de paz mirando a cámara, con sus audífonos Beats alrededor del cuello y lentes cuadrados. La ventana verde al fondo da una ambiance de calma creativa."
            },
            {
                file: "Yo/foto1.png",
                title: "El Fotógrafo en la Calle",
                desc: "Jesus sostiene una Canon F-1 analógica apuntando directamente al lente. La calle bulliciosa de São Paulo al atardecer sirve de fondo: tráfico, neones y arquitectura clásica. Los auriculares al cuello refuerzan su identidad de creador multidisciplinar."
            },
            {
                file: "Yo/fotografiando2.png",
                title: "Pausa en el Movimiento",
                desc: "Vista de tres cuartos con la Canon F-1 en mano baja. El rostro tranquilo mira a cámara en medio del caos vehicular de la ciudad brasileña al atardecer. La luz dorada del ocaso baña su perfil creando un efecto cinematográfico."
            },
            {
                file: "Yo/fotografiando.png",
                title: "El Instante Decisivo",
                desc: "Jesus captura el momento exacto de disparar la Canon en una esquina de São Paulo. El ojo cerrado detrás del lente y la postura concentrada capturan la esencia misma de lo que significa ser fotógrafo en plena calle."
            },
            {
                file: "Yo/foto 2.png",
                title: "Jazz Club, Nueva Orleans",
                desc: "Retrato editorial de película en las calles históricas del Barrio Francés de Nueva Orleans. Traje negro, camisa blanca, collar de caracoles y lentes redondos con el skyline reflejado. Un tranvía vintage al fondo y el cartel de Jazz Club crean una atmósfera cinematográfica irrepetible."
            },
            {
                file: "Yo/foto vintage.png",
                title: "Hollywood Walk of Fame",
                desc: "Retrato analógico con grano de película en el Boulevard de la Fama. Jesus camina sobre las estrellas de Hollywood con traje negro entre carteles de neón vintage, autos clásicos y el frenesí de la ciudad. La luz ambarina del atardecer envuelve cada elemento."
            },
            {
                file: "Yo/quiero_que_la_202604171825 (1).png",
                title: "Distrito Neón",
                desc: "Retrato nocturno urbano con luces de neón azules, rojas y amarillas al fondo. El bokeh envuelve la escena en color mientras Jesus, de negro con su pin de caballito de mar, observa hacia arriba con serenidad. Una imagen que mezcla lo íntimo con lo urbano."
            }
        ]
    }
];


const cardsContainer = document.getElementById('dynamic-photobook-cards');
const modalsContainer = document.getElementById('dynamic-modals-container');

if (cardsContainer && modalsContainer) {
    photobookData.forEach((session, index) => {
        // CARD
        const card = document.createElement('div');
        card.className = 'project-card reveal-up modal-trigger';
        card.style.setProperty('--d', `${index * 0.1 + 0.1}s`);
        card.setAttribute('data-target', `modal-${session.id}`);

        card.innerHTML = `
            <div class="project-thumb" style="background-image: url('assets/gallery/${session.images[0].file}');">
                <div class="project-thumb-overlay"></div>
                <span class="project-num">0${index + 4}</span>
            </div>
            <div class="project-card-info">
                <span class="tag">Sesión Fotográfica</span>
                <h3>${session.title}</h3>
                <p>${session.desc}</p>
                <div class="card-footer">
                    <span class="card-tech">${session.images.length} fotografías</span>
                    <span class="card-arrow">→</span>
                </div>
            </div>
        `;
        cardsContainer.appendChild(card);
        revealObserver.observe(card);

        // MODAL
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = `modal-${session.id}`;

        let galleryHTML = '';
        session.images.forEach(photo => {
            galleryHTML += `
                <div class="photobook-item">
                    <div class="photo-img">
                        <img src="assets/gallery/${photo.file}" alt="${photo.title}" loading="lazy">
                    </div>
                    <div class="photo-details">
                        <h5 class="photo-title">${photo.title}</h5>
                        <p class="photo-desc">${photo.desc}</p>
                    </div>
                </div>
            `;
        });

        modal.innerHTML = `
            <div class="modal-content">
                <button class="close-modal">&times;</button>
                <div class="modal-header">
                    <span class="tag">Sesión Fotográfica</span>
                    <h3>${session.title}</h3>
                    <p>${session.desc}</p>
                </div>
                <div class="modal-body">
                    <div class="photobook-grid">${galleryHTML}</div>
                </div>
            </div>
        `;
        modalsContainer.appendChild(modal);

        // Events for dynamic card/modal
        card.addEventListener('click', () => openModal(`modal-${session.id}`));
        modal.querySelector('.close-modal').addEventListener('click', () => closeModal(modal));
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });
    });

    // Re-apply hover cursor
    document.querySelectorAll('.project-card, .photobook-item').forEach(el => {
        el.addEventListener('mouseenter', () => {
            cursor.classList.add('hovered');
            follower.classList.add('hovered');
        });
        el.addEventListener('mouseleave', () => {
            cursor.classList.remove('hovered');
            follower.classList.remove('hovered');
        });
    });
}

})();
