// JOM Studio · Protocolo 03 — estación de trabajo de Arte IA.
//
// Se monta sola en <div data-jom-workstation></div>.
// Personaje en la laptop (video_3) + lienzo sincronizado: código → logo JOM →
// boceto → render final en dorado #C4A35A; al terminar saluda con café (video_2).
//
// Un WebP animado no se puede pausar ni rebobinar, así que se usa <video> con
// el .webm (VP9 alpha). Safari no pinta el alpha de VP9: ahí se usa el .webp.

const GOLD = '#C4A35A';
const DUR = { code: 1800, logo: 1600, sketch: 1300, render: 1500 };
const CODE = [
  'const brand = await jom.studio("alquimia")',
  'brand.palette = hsl(42, 47%, 56%)   // #C4A35A',
  'const logo = vectorize(brand.mark, { stroke: 2 })',
  'for (const pass of ["boceto", "luz", "grano"])',
  '  canvas.render(logo, pass)',
  'export.editorial({ ratio: "16:9", master: "8K" })',
];

const CSS = `
.jom-ws{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:clamp(12px,3vw,32px);align-items:center}
.jom-ws__char{position:relative;aspect-ratio:9/16;max-height:72vh;justify-self:center;cursor:pointer;background:none;border:0;padding:0}
.jom-ws__char video,.jom-ws__char img{width:100%;height:100%;object-fit:contain;display:block}
.jom-ws__char:focus-visible{outline:2px solid ${GOLD};outline-offset:6px;border-radius:12px}
.jom-ws__panel{display:flex;flex-direction:column;gap:12px}
.jom-ws__screen{width:100%;aspect-ratio:16/10;border-radius:14px;background:#0d0d0f;box-shadow:0 0 0 1px rgba(196,163,90,.35),0 20px 60px rgba(0,0,0,.25);cursor:pointer}
.jom-ws__btn{align-self:flex-start;font:600 13px/1 ui-monospace,Menlo,monospace;letter-spacing:.08em;padding:14px 20px;min-height:44px;border-radius:999px;border:1px solid ${GOLD};background:${GOLD};color:#0d0d0f;cursor:pointer}
.jom-ws__btn[disabled]{opacity:.55;cursor:progress}
.jom-ws__status{font:500 12px/1.4 ui-monospace,Menlo,monospace;color:${GOLD};min-height:1.4em}
@media (max-width:760px){.jom-ws{grid-template-columns:1fr}.jom-ws__char{max-height:52vh}}
`;

function injectCss() {
  if (document.getElementById('jom-ws-css')) return;
  const s = document.createElement('style');
  s.id = 'jom-ws-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}

// Safari reproduce VP9 pero sin alpha (sale fondo negro): ahí, WebP animado.
function supportsAlphaWebm() {
  const ua = navigator.userAgent;
  const safari = /Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\//.test(ua);
  const v = document.createElement('video');
  return !safari && v.canPlayType('video/webm; codecs="vp09.00.10.08"') !== '';
}

const ease = (t) => 1 - Math.pow(1 - t, 3);
const clamp01 = (t) => Math.max(0, Math.min(1, t));

export function mountWorkstation(host, opts = {}) {
  injectCss();
  const base = opts.base || host.dataset.base || 'assets/video/';
  const media = {
    work: base + (opts.work || 'video_3_programando_codigo_logo'),
    coffee: base + (opts.coffee || 'video_2_pensando_gesticulando_cafe'),
  };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const useVideo = supportsAlphaWebm();

  host.classList.add('jom-ws');
  host.innerHTML = `
    <button class="jom-ws__char" type="button" aria-label="Generar concepto: el personaje trabaja en su laptop"></button>
    <div class="jom-ws__panel">
      <canvas class="jom-ws__screen" role="img" aria-label="Pantalla del concepto generado"></canvas>
      <button class="jom-ws__btn" type="button">🎨 GENERAR CONCEPTO EN TIEMPO REAL</button>
      <p class="jom-ws__status" aria-live="polite">Listo para generar.</p>
    </div>`;
  const charBtn = host.querySelector('.jom-ws__char');
  const canvas = host.querySelector('canvas');
  const btn = host.querySelector('.jom-ws__btn');
  const status = host.querySelector('.jom-ws__status');
  const ctx = canvas.getContext('2d');

  let actor;
  if (useVideo) {
    actor = document.createElement('video');
    Object.assign(actor, { muted: true, playsInline: true, preload: 'auto', loop: false });
    actor.setAttribute('muted', '');
    actor.setAttribute('playsinline', '');
    actor.src = media.work + '.webm';
  } else {
    actor = document.createElement('img');
    actor.alt = '';
    actor.decoding = 'async';
    actor.src = media.work + '.webp';
  }
  charBtn.appendChild(actor);

  // Cambia de clip. En <img> WebP se reinicia la animación con un query nuevo.
  function play(name, { loop = false } = {}) {
    if (useVideo) {
      const src = media[name] + '.webm';
      if (!actor.src.endsWith(src)) actor.src = src;
      actor.loop = loop;
      actor.currentTime = 0;
      return actor.play().catch(() => {});
    }
    actor.src = `${media[name]}.webp?t=${Date.now()}`;
    return Promise.resolve();
  }

  // ---- Lienzo -------------------------------------------------------------
  let W = 0, H = 0;
  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = Math.max(320, Math.round(r.width)); H = Math.round(W * 10 / 16);
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(phaseT);
  }

  // Monograma JOM como trazos (0..1) para dibujarlo progresivamente.
  const LOGO = [
    [[0.30, 0.30], [0.30, 0.62], [0.26, 0.70], [0.18, 0.70]],             // J
    [[0.50, 0.30], [0.60, 0.36], [0.62, 0.50], [0.60, 0.64], [0.50, 0.70], // O
     [0.40, 0.64], [0.38, 0.50], [0.40, 0.36], [0.50, 0.30]],
    [[0.70, 0.70], [0.70, 0.30], [0.78, 0.52], [0.86, 0.30], [0.86, 0.70]], // M
  ];
  const LOGO_LEN = LOGO.map((s) => s.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - s[i][0], p[1] - s[i][1]), 0));
  const TOTAL_LEN = LOGO_LEN.reduce((a, b) => a + b, 0);

  function strokeLogo(progress, { width, color, jitter = 0 }) {
    const sz = Math.min(W, H) * 0.9, ox = (W - sz) / 2, oy = (H - sz) / 2;
    let budget = progress * TOTAL_LEN;
    ctx.lineWidth = width; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const s of LOGO) {
      if (budget <= 0) break;
      ctx.beginPath();
      ctx.moveTo(ox + s[0][0] * sz, oy + s[0][1] * sz);
      for (let i = 1; i < s.length && budget > 0; i++) {
        const [ax, ay] = s[i - 1], [bx, by] = s[i];
        const len = Math.hypot(bx - ax, by - ay), t = Math.min(1, budget / len);
        const j = jitter ? (Math.sin(i * 12.9 + bx * 78) * jitter) : 0;
        ctx.lineTo(ox + (ax + (bx - ax) * t) * sz + j, oy + (ay + (by - ay) * t) * sz - j);
        budget -= len;
      }
      ctx.stroke();
    }
  }

  function grain(alpha) {
    const n = Math.round(W * H / 90);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    for (let i = 0; i < n; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
  }

  // phaseT: tiempo en ms dentro de la secuencia (0 = reposo).
  let phaseT = 0;
  const T1 = DUR.code, T2 = T1 + DUR.logo, T3 = T2 + DUR.sketch, T4 = T3 + DUR.render;
  function draw(t) {
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0d0d0f'; ctx.fillRect(0, 0, W, H);

    if (t < T2) {                                         // 1–2: código + logo
      const lines = t <= 0 ? 0 : clamp01(t / T1) * CODE.length;
      ctx.font = `${Math.max(11, W / 46)}px ui-monospace, Menlo, monospace`;
      ctx.textBaseline = 'top';
      for (let i = 0; i < Math.ceil(lines); i++) {
        const txt = CODE[i], chars = i < Math.floor(lines) ? txt.length : Math.floor((lines % 1) * txt.length);
        ctx.fillStyle = i % 2 ? 'rgba(196,163,90,.55)' : 'rgba(46,196,182,.75)';
        ctx.fillText(txt.slice(0, chars) + (i === Math.ceil(lines) - 1 && t < T1 ? '▌' : ''), W * 0.05, H * 0.07 + i * (W / 30));
      }
      if (t > T1) strokeLogo(ease(clamp01((t - T1) / DUR.logo)), { width: W / 90, color: GOLD });
      if (t <= 0) {
        ctx.fillStyle = 'rgba(196,163,90,.6)'; ctx.font = `${Math.max(12, W / 40)}px ui-monospace, Menlo, monospace`;
        ctx.fillText('> esperando prompt…', W * 0.05, H * 0.07);
      }
      return;
    }
    if (t < T3) {                                         // 3: boceto a lápiz
      const k = clamp01((t - T2) / DUR.sketch);
      ctx.fillStyle = '#efe9dc'; ctx.globalAlpha = k; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
      for (let p = 0; p < 3; p++) strokeLogo(1, { width: 1 + p * 0.6, color: `rgba(40,36,30,${0.35 + k * 0.3})`, jitter: (3 - p) * 1.4 });
      return;
    }
    // 4: render final — luz cálida, relieve dorado, viñeta y grano.
    const k = ease(clamp01((t - T3) / DUR.render));
    const bg = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.5, W * 0.75);
    bg.addColorStop(0, `hsl(42, 30%, ${10 + 8 * k}%)`); bg.addColorStop(1, '#070707');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const gold = ctx.createLinearGradient(0, H * 0.25, W, H * 0.75);
    gold.addColorStop(0, 'hsl(42, 47%, 38%)'); gold.addColorStop(0.45, 'hsl(42, 70%, 74%)');
    gold.addColorStop(0.55, GOLD); gold.addColorStop(1, 'hsl(38, 45%, 30%)');
    ctx.shadowColor = `rgba(196,163,90,${0.55 * k})`; ctx.shadowBlur = W / 22;
    strokeLogo(1, { width: W / 34, color: gold });
    ctx.shadowBlur = 0;
    strokeLogo(1, { width: W / 140, color: `rgba(255,248,225,${0.6 * k})` });
    grain(0.035 * k);
    ctx.fillStyle = `rgba(196,163,90,${k})`;
    ctx.font = `600 ${Math.max(10, W / 52)}px ui-monospace, Menlo, monospace`;
    ctx.fillText('JOM STUDIO · RENDER EDITORIAL · MÁSTER 8K', W * 0.05, H * 0.9);
  }

  // ---- Secuencia ----------------------------------------------------------
  let running = false, raf = 0;
  const label = (ms) => (ms < T1 ? 'Escribiendo el código del concepto…' : ms < T2 ? 'Animando el logo corporativo…'
    : ms < T3 ? 'Boceto en curso…' : 'Render final…');

  async function generate() {
    if (running) return;
    running = true;
    btn.disabled = true; btn.setAttribute('aria-busy', 'true');
    host.dispatchEvent(new CustomEvent('jom-ws:start'));
    play('work');
    if (reduced) { phaseT = T4; draw(phaseT); return finish(); }
    const t0 = performance.now();
    await new Promise((resolve) => {
      const tick = (now) => {
        phaseT = now - t0;
        status.textContent = label(phaseT);
        draw(Math.min(phaseT, T4));
        if (phaseT >= T4) return resolve();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    return finish();
  }

  async function finish() {
    phaseT = T4;
    status.textContent = 'Concepto listo. ☕';
    await play('coffee');
    running = false;
    btn.disabled = false; btn.removeAttribute('aria-busy');
    btn.textContent = '🎨 GENERAR OTRO CONCEPTO';
    host.dispatchEvent(new CustomEvent('jom-ws:done'));
  }

  btn.addEventListener('click', generate);
  charBtn.addEventListener('click', generate);
  canvas.addEventListener('click', generate);
  // En reposo, el video de trabajo queda en su primer cuadro (no en loop).
  if (useVideo) actor.addEventListener('loadeddata', () => { if (!running) actor.pause(); }, { once: true });
  actor.addEventListener('error', () => console.warn('[jom-workstation] no carga', actor.currentSrc || actor.src));

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  addEventListener('pagehide', () => { cancelAnimationFrame(raf); ro.disconnect(); }, { once: true });

  const api = { generate, get phase() { return phaseT >= T4 ? 'done' : running ? 'running' : 'idle'; }, get usesVideo() { return useVideo; } };
  host.jomWorkstation = api;
  return api;
}

function autoMount() {
  document.querySelectorAll('[data-jom-workstation]').forEach((h) => mountWorkstation(h));
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount, { once: true });
else autoMount();
