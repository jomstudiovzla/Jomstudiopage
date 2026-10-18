#!/usr/bin/env node
// JOM Studio · auditor tipográfico de la home y los protocolos en un Chromium real (Playwright).
//
// Normalmente lo lanza scripts/auditar-tipografia.sh, que sirve SRC en 127.0.0.1.
// A mano:
//   node scripts/auditar_tipografia.mjs --src <carpeta> --base http://127.0.0.1:8090 \
//        [--out <dir>] [--solo index.html,page_03_arte_ia.html] [--marca "Sora,JetBrains Mono"] [--muestra 400]
// Playwright se busca en JOM_PLAYWRIGHT (carpeta del paquete), JOM_AUDIT_PREFIX
// (prefijo de npm), junto a este script o en el node global.
//
// Por página, a 375×667 y 1440×900:
//   · fuentes declaradas (@font-face y Google Fonts) → cargadas (document.fonts) →
//     RENDERIZADAS (CDP CSS.getPlatformFontsForNode: detecta la fuente de reserva)
//   · familias en texto visible (WARN > 3), pesos, familias fuera de la marca
//   · tamaño < 12 px en móvil (WARN) / < 10 px (FAIL), line-height < 1.2 en párrafos,
//     más de ~90 caracteres por línea en escritorio
//   · contraste WCAG 2.1 AA (4.5:1 · 3:1 texto grande) contra el fondo efectivo; con
//     imagen, degradado o vídeo detrás queda «no medible» (no se inventa)
//   · texto cortado (overflow hidden/clip, elipsis, line-clamp), font-display, precarga
//   · iconos de fuente (Material Symbols/Icons) que no cargan y enseñan su nombre
// Salida: tabla PASS/WARN/FAIL + tipografia.json + capturas.
// Código de salida: 0 sin FAIL · 1 alguna página da FAIL · 2 no se pudo auditar.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEBGL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const VIEWPORTS = [
  { id: '375', label: 'móvil', opts: { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
  { id: '1440', label: 'escritorio', opts: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
];
const HOMES = ['concept_master_horizontal.html', 'index.html'];   // el primero que exista da la marca
const ICON_SRC = 'material[- ]?(symbols|icons)';
const ICON_RE = new RegExp(ICON_SRC, 'i');
const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif',
  'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'math', 'fangsong', '-apple-system', 'blinkmacsystemfont']);
const LIMITS = { failPx: 10, warnPx: 12, lh: 1.2, cpl: 90, aa: 4.5, aaLarge: 3, brandShare: 0.02, maxFamilies: 3 };
const DISPLAY_OK = new Set(['swap', 'optional']);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (s) => console.log(`\n==> ${s}`);
const die = (s) => { console.error(`\n✖ ${s}`); process.exit(2); };
const first = (e) => String(e?.message ?? e).split('\n')[0].replace(/\s+/g, ' ').trim();
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const ok = (id, msg = '') => ({ id, status: 'PASS', msg });
const warn = (id, msg) => ({ id, status: 'WARN', msg });
const fail = (id, msg) => ({ id, status: 'FAIL', msg });
const ICON = { PASS: '✔', WARN: '⚠', FAIL: '✖' };
const low = (s) => String(s || '').toLowerCase();
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)} %` : '0 %');
const q = (s) => `«${cut(String(s), 40)}»`;

// ---- Argumentos -------------------------------------------------------------
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const m = process.argv[i].match(/^--([a-z]+)(?:=(.*))?$/);
  if (!m) die(`Argumento desconocido: ${process.argv[i]}`);
  args[m[1]] = m[2] ?? process.argv[++i];
  if (args[m[1]] === undefined) die(`--${m[1]} necesita un valor`);
}
const SRC = path.resolve(args.src || process.env.SRC || '.');
const BASE = (args.base || process.env.BASE || 'http://127.0.0.1:8090').replace(/\/+$/, '');
const d = new Date(), p2 = (n) => String(n).padStart(2, '0');
const STAMP = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
const OUT = path.resolve(args.out || path.join(os.tmpdir(), `jom-tipografia-${STAMP}`));
const SOLO = args.solo ? args.solo.split(',').map((s) => s.trim()).filter(Boolean) : null;
const MARCA = args.marca ? args.marca.split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean) : null;
const MUESTRA = Math.max(20, Number(args.muestra || 400) || 400);
if (!fs.existsSync(SRC) || !fs.statSync(SRC).isDirectory()) die(`No existe la carpeta ${SRC}`);

// index, home horizontal y page_01…07 (los que existan); --solo admite cualquier .html de SRC.
function listPages() {
  const files = fs.readdirSync(SRC);
  const prot = files.filter((f) => /^page_0[1-7][^/]*\.html$/i.test(f)).sort();
  const all = [...['index.html', 'concept_master_horizontal.html'].filter((f) => files.includes(f)), ...prot];
  if (!SOLO) return all;
  const out = [];
  for (const s of SOLO) {
    const f = files.includes(s) ? s : files.includes(`${s}.html`) ? `${s}.html` : null;
    if (!f || !/\.html?$/i.test(f)) die(`--solo: no encuentro ${s} en ${SRC}`);
    if (!out.includes(f)) out.push(f);
  }
  return out;
}
const PAGES = listPages();
if (!PAGES.length) die(`No hay páginas que auditar en ${SRC} (index.html, concept_master_horizontal.html, page_01…07)`);

// ---- Playwright -------------------------------------------------------------
// ESM no mira NODE_PATH: se resuelve con createRequire desde rutas conocidas.
function loadPlaywright() {
  const dirs = [process.env.JOM_PLAYWRIGHT].filter(Boolean);
  const froms = [process.env.JOM_AUDIT_PREFIX && path.join(process.env.JOM_AUDIT_PREFIX, 'package.json'),
    path.join(HERE, 'x.js'), path.join(process.cwd(), 'x.js')].filter(Boolean);
  for (const f of froms) {
    try { dirs.push(path.dirname(createRequire(f).resolve('playwright/package.json'))); } catch { /* sigue */ }
  }
  dirs.push(path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'playwright'));
  for (const dir of dirs) {
    try {
      const req = createRequire(path.join(dir, 'package.json'));
      return { pw: req(dir), version: req(path.join(dir, 'package.json')).version, dir };
    } catch { /* sigue */ }
  }
  return null;
}

// ---- Funciones que corren dentro de la página (autocontenidas) ---------------
// Recorre la página (dispara animaciones de entrada por scroll) y vuelve arriba.
async function autoScroll() {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const se = document.scrollingElement || document.documentElement;
  const maxY = se.scrollHeight - innerHeight, maxX = se.scrollWidth - innerWidth;
  const ny = Math.min(40, Math.max(0, Math.ceil(maxY / (innerHeight * 0.8))));
  for (let i = 1; i <= ny; i++) { scrollTo({ left: 0, top: Math.round((maxY * i) / ny), behavior: 'instant' }); await wait(90); }
  const nx = Math.min(20, Math.max(0, Math.ceil(maxX / (innerWidth * 0.8))));
  for (let i = 1; i <= nx; i++) { scrollTo({ left: Math.round((maxX * i) / nx), top: 0, behavior: 'instant' }); await wait(90); }
  scrollTo({ left: 0, top: 0, behavior: 'instant' });
  await wait(500);
  return ny + nx;
}

async function fontsSettled(ms) {
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, ms))]);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

// Todo lo que se mide del texto visible. Marca con data-jom-tipo los nodos de la muestra CDP.
function collect({ maxSample, iconSrc }) {
  const ICONX = new RegExp(iconSrc, 'i');
  const GEN = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif',
    'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'math', 'fangsong', '-apple-system', 'blinkmacsystemfont']);
  const SKIP = 'script,style,noscript,template,head,select,option,textarea,datalist,[data-jom-tipo-probe]';
  const PARA = 'p,li,blockquote,dd,dt,figcaption,td';
  document.querySelectorAll('[data-jom-tipo]').forEach((e) => e.removeAttribute('data-jom-tipo'));
  const styles = new Map();
  const cs = (e) => { let s = styles.get(e); if (!s) { s = getComputedStyle(e); styles.set(e, s); } return s; };
  const clean = (s) => s.replace(/\s+/g, ' ').trim();
  const desc = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '')
    + [...(el.classList || [])].slice(0, 2).map((c) => '.' + c).join('');
  const famList = (stack) => stack.split(',').map((f) => f.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  const vis = (el, op) => (el.checkVisibility ? el.checkVisibility({ checkOpacity: op, checkVisibilityCSS: true }) : true);
  const vv = window.visualViewport ? visualViewport.scale : 1;

  // Colores: rgb()/rgba() directo; cualquier otra sintaxis (oklch, color-mix…) vía canvas.
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const g = cv.getContext('2d', { willReadFrequently: true });
  const colors = new Map();
  const RGB = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)\s*(?:[,/]\s*([\d.]+)(%?))?\s*\)$/;
  const rgba = (s) => {
    if (colors.has(s)) return colors.get(s);
    let c; const m = s.match(RGB);
    if (m) c = [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : m[5] ? m[4] / 100 : +m[4]];
    else if (!s || s === 'transparent') c = [0, 0, 0, 0];
    else {
      g.clearRect(0, 0, 1, 1); g.fillStyle = 'rgba(0,0,0,0)'; g.fillStyle = s; g.fillRect(0, 0, 1, 1);
      const px = g.getImageData(0, 0, 1, 1).data; c = [px[0], px[1], px[2], px[3] / 255];
    }
    colors.set(s, c);
    return c;
  };
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const over = (t, b) => [0, 1, 2].map((i) => t[i] * t[3] + b[i] * (1 - t[3])).concat(1);
  const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

  // Lo que puede quedar DETRÁS del texto sin ser su ancestro: medios y fondos con imagen.
  const media = [];
  for (const e of document.body ? document.body.getElementsByTagName('*') : []) {
    const tag = e.tagName;
    const isMedia = /^(IMG|VIDEO|CANVAS|IFRAME|OBJECT|EMBED)$/.test(tag) || (tag.toLowerCase() === 'svg' && !e.parentElement?.closest('svg'));
    const bi = isMedia ? '' : cs(e).backgroundImage;
    if (!isMedia && (!bi || bi === 'none')) continue;
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || !vis(e, true)) continue;
    media.push({ e, r, what: isMedia ? `<${tag.toLowerCase()}> detrás` : /gradient/.test(bi) ? 'degradado de fondo' : 'imagen de fondo' });
  }
  const overlap = (a, b) => {
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return w > 0 && h > 0 ? (w * h) / Math.max(1, a.width * a.height) : 0;
  };
  // Fondo efectivo: capas de color de los ancestros hasta una opaca (o el lienzo blanco).
  // Si debajo de esas capas hay algo desconocido (imagen, degradado, vídeo, contenido que
  // pasa por debajo de un fijo) se devuelven las dos cotas: capas sobre negro y sobre blanco.
  // backdrop-filter solo desenfoca lo de detrás: no cambia el color de un fondo liso.
  function background(el, rect) {
    const layers = [];
    let opaque = null, unknown = null;
    for (let e = el; e; e = e.parentElement) {
      const s = cs(e);
      if (s.mixBlendMode && s.mixBlendMode !== 'normal') return { why: `mix-blend-mode: ${s.mixBlendMode}`, at: desc(e) };
      const bi = s.backgroundImage;
      if (bi && bi !== 'none') { unknown = { why: /gradient/.test(bi) ? 'degradado de fondo' : 'imagen de fondo', at: desc(e) }; break; }
      const c = rgba(s.backgroundColor);
      if (c[3] > 0) layers.push(c);
      if (c[3] >= 0.999) { opaque = e; break; }
      // Un fijo/sticky pequeño (cabecera, botón) tiene debajo lo que pase al hacer scroll;
      // un contenedor fijo a pantalla completa solo tiene detrás el fondo de la página.
      if (/fixed|sticky/.test(s.position)) {
        const fr = e.getBoundingClientRect();
        if (fr.width < innerWidth * 0.9 || fr.height < innerHeight * 0.9) { unknown = { why: `${s.position} sobre contenido que se desplaza`, at: desc(e) }; break; }
      }
    }
    if (!unknown) {
      for (const m of media) {
        if (m.e.contains(el) || (opaque && !opaque.contains(m.e)) || m.e === opaque) continue;
        if (overlap(rect, m.r) > 0.3) { unknown = { why: m.what, at: desc(m.e) }; break; }
      }
    }
    const compose = (base) => { let bg = base; for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg); return bg; };
    if (!unknown) {
      const base = opaque ? layers.pop() : [255, 255, 255, 1];
      return { bg: compose(base) };
    }
    if (opaque) layers.pop();
    return { ...unknown, lo: compose([0, 0, 0, 1]), hi: compose([255, 255, 255, 1]) };
  }
  const ratioOf = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };

  // Texto visible, agrupado por su elemento padre; de paso, el texto recortado.
  const byEl = new Map();
  const hidden = { opacidad: 0, recortado: 0, animado: 0, carrusel: 0, deshabilitado: 0 };
  const cuts = [], cutSeen = new Set();
  const range = document.createRange();
  const tw = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
  while (tw.nextNode()) {
    const t = tw.currentNode, raw = t.nodeValue;
    if (!raw || !raw.trim()) continue;
    const el = t.parentElement;
    if (!el || el.closest(SKIP)) continue;
    if (!vis(el, false)) continue;                       // display/visibility: no se pinta
    if (!vis(el, true)) { hidden.opacidad++; continue; } // opacidad 0 (¿animación de entrada?)
    range.selectNodeContents(t);
    const r = range.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (r.right + scrollX < -50 || r.bottom + scrollY < -50) continue;   // left:-9999px y similares
    let sr = false;
    for (let a = el, k = 0; a && k < 4; a = a.parentElement, k++) {
      const s = cs(a), ar = a.getBoundingClientRect();
      if ((ar.width <= 1 || ar.height <= 1) && /hidden|clip/.test(s.overflow)) sr = true;
      if (s.clip && s.clip !== 'auto') sr = true;
      if (/inset\(\s*50%/.test(s.clipPath || '')) sr = true;
    }
    if (sr) continue;                                    // solo para lectores de pantalla
    let it = byEl.get(el);
    if (!it) { it = { el, chars: 0, text: '', rects: [] }; byEl.set(el, it); }
    it.chars += clean(raw).length; it.text += raw; it.rects.push(r);

    const fs = parseFloat(cs(el).fontSize) || 16;
    for (let a = el, k = 0; a && a !== document.body && a !== document.documentElement && k < 15; a = a.parentElement, k++) {
      const s = cs(a);
      const cx = /hidden|clip/.test(s.overflowX), cy = /hidden|clip/.test(s.overflowY);
      if (!cx && !cy) continue;
      const ar = a.getBoundingClientRect();
      const L = ar.left + (parseFloat(s.borderLeftWidth) || 0), R = ar.right - (parseFloat(s.borderRightWidth) || 0);
      const T = ar.top + (parseFloat(s.borderTopWidth) || 0), B = ar.bottom - (parseFloat(s.borderBottomWidth) || 0);
      if ((cx && (r.right <= L || r.left >= R)) || (cy && (r.bottom <= T || r.top >= B))) { hidden.recortado++; break; }
      const dx = cx ? Math.max(L - r.left, r.right - R, 0) : 0;
      const dy = cy ? Math.max(T - r.top, r.bottom - B, 0) : 0;
      let kind = null, px = 0;
      if (dx > 2) { kind = /ellipsis/.test(s.textOverflow) ? 'elipsis' : 'x'; px = dx; }
      else if (dy > 0.25 * fs) { kind = s.webkitLineClamp && s.webkitLineClamp !== 'none' ? 'clamp' : 'y'; px = dy; }
      if (!kind) continue;
      if (a.getAnimations && a.getAnimations({ subtree: true }).some((x) => x.playState === 'running')) { hidden.animado++; break; }
      // Solo es texto cortado si su bloque cabe en la caja y el texto no. Si el bloque mismo
      // asoma por el borde (pista horizontal de GSAP, carrusel, máscara de revelado) se omite.
      let blk = el;
      while (blk !== a && cs(blk).display === 'inline' && blk.parentElement) blk = blk.parentElement;
      if (blk !== a) {
        const b = blk.getBoundingClientRect();
        if (b.right > R + 2 || b.left < L - 2 || b.bottom > B + 2 || b.top < T - 2) { hidden.carrusel++; break; }
      }
      const key = desc(a) + '|' + kind + '|' + clean(raw).slice(0, 30);
      if (!cutSeen.has(key)) {
        cutSeen.add(key);
        cuts.push({ sel: desc(el), box: desc(a), text: clean(raw).slice(0, 60), kind, px: Math.round(px), em: +(px / fs).toFixed(2),
          visible: Math.round(kind === 'x' || kind === 'elipsis' ? R - L : B - T) });
      }
      break;
    }
  }

  // Interlineado 'normal' medido con una sonda (depende de la fuente).
  const lhCache = new Map();
  const normalLH = (s) => {
    const key = `${s.fontStyle}|${s.fontWeight}|${s.fontFamily}`;
    if (lhCache.has(key)) return lhCache.get(key);
    const p = document.createElement('div');
    p.setAttribute('data-jom-tipo-probe', 'lh');
    p.style.cssText = 'position:absolute;left:-10000px;top:0;visibility:hidden;white-space:nowrap;line-height:normal;font-size:100px';
    p.style.fontFamily = s.fontFamily; p.style.fontWeight = s.fontWeight; p.style.fontStyle = s.fontStyle;
    p.textContent = 'Hg';
    document.body.appendChild(p);
    const v = p.getBoundingClientRect().height / 100;
    p.remove();
    lhCache.set(key, v);
    return v;
  };

  // CDP da las fuentes de TODO el subárbol: un nodo con hijos de texto se juzga distinto.
  const parents = new Set();
  for (const el of byEl.keys()) for (let a = el.parentElement; a; a = a.parentElement) if (byEl.has(a)) parents.add(a);
  const items = [];
  let idx = 0;
  for (const it of byEl.values()) {
    const el = it.el, s = cs(el);
    const fl = famList(s.fontFamily);
    const cls = typeof el.className === 'string' ? el.className : '';
    const icon = ICONX.test(fl[0] || '') || ICONX.test(cls);
    const size = parseFloat(s.fontSize) || 0;
    const br = el.getBoundingClientRect();
    const ow = el.offsetWidth;
    // Escala por transform (offsetWidth es entero: por debajo del 3 % es redondeo, no escala).
    const raw = ow > 0 && br.width > 0 ? Math.min(10, Math.max(0.05, br.width / ow)) : 1;
    const scale = Math.abs(raw - 1) < 0.03 ? 1 : raw;
    const u = it.rects.reduce((a, r) => ({ left: Math.min(a.left, r.left), top: Math.min(a.top, r.top),
      right: Math.max(a.right, r.right), bottom: Math.max(a.bottom, r.bottom) }), { left: 1e9, top: 1e9, right: -1e9, bottom: -1e9 });
    u.width = u.right - u.left; u.height = u.bottom - u.top;
    let op = 1;
    for (let a = el; a; a = a.parentElement) op *= parseFloat(cs(a).opacity);
    const fill = rgba(s.webkitTextFillColor || s.color);
    let contrast = null;
    if (!icon) {
      let clip = null;
      for (let a = el; a && !clip; a = a.parentElement) if (/text/.test(cs(a).backgroundClip || '') || /text/.test(cs(a).webkitBackgroundClip || '')) clip = a;
      if (el.closest('[disabled],[aria-disabled="true"]')) { contrast = { why: 'deshabilitado (exento en WCAG)' }; hidden.deshabilitado++; }
      else if (clip) contrast = { why: 'texto con degradado (background-clip: text)', at: desc(clip) };
      else if (fill[3] * op < 0.05) contrast = { why: parseFloat(s.webkitTextStrokeWidth) > 0 ? 'texto en contorno' : 'texto transparente' };
      else {
        const b = background(el, u);
        const px = size * scale;
        const large = px >= 24 || (px >= 18.66 && Number(s.fontWeight) >= 700);
        const need = large ? 3 : 4.5;
        const ft = [fill[0], fill[1], fill[2], fill[3] * op];
        if (b.bg) {
          const fg = over(ft, b.bg);
          contrast = { ratio: +ratioOf(fg, b.bg).toFixed(2), fg: hex(fg), bg: hex(b.bg), large };
        } else if (!b.lo) contrast = { why: b.why, at: b.at };
        else {
          // Fondo desconocido: peor y mejor caso entre «capas sobre negro» y «capas sobre blanco».
          const rLo = ratioOf(over(ft, b.lo), b.lo), rHi = ratioOf(over(ft, b.hi), b.hi);
          const lt = lum(fill), a1 = lum(b.lo), a2 = lum(b.hi);
          const min = lt >= Math.min(a1, a2) && lt <= Math.max(a1, a2) ? 1 : Math.min(rLo, rHi), max = Math.max(rLo, rHi);
          const fg = hex(over(ft, b.lo));
          if (min >= need) contrast = { ratio: +min.toFixed(2), fg, bg: `peor caso sobre ${b.why}`, large, cota: true };
          else if (max < need) contrast = { ratio: +max.toFixed(2), fg, bg: `mejor caso sobre ${b.why}`, large, cota: true };
          else contrast = { why: b.why, at: b.at, rango: [+min.toFixed(2), +max.toFixed(2)] };
        }
      }
    }
    items.push({ idx: idx++, el, sel: desc(el), text: clean(it.text).slice(0, 60), chars: it.chars, stack: s.fontFamily,
      prim: fl[0] || '', generic: GEN.has((fl[0] || '').toLowerCase()), w: s.fontWeight, st: s.fontStyle,
      size: +size.toFixed(1), eff: +(size * scale * vv).toFixed(1), icon, cls: icon ? cls : undefined, leaf: !parents.has(el),
      iconRatio: icon && size ? +(u.width / size).toFixed(2) : undefined, contrast });
  }

  // Párrafos: el contenedor más interno tipo p/li/… o un bloque con ≥ 120 caracteres propios.
  const pset = new Set();
  for (const it of items) {
    if (it.icon) continue;
    const p = it.el.closest(PARA) || (it.chars >= 120 ? it.el : null);
    if (p) pset.add(p);
  }
  const paras = [];
  for (const p of pset) {
    if ([...pset].some((o) => o !== p && p.contains(o))) continue;
    const s = cs(p), text = clean(p.textContent), size = parseFloat(s.fontSize) || 16;
    if (text.length < 40) continue;
    const lhNormal = s.lineHeight === 'normal';
    const lh = +(lhNormal ? normalLH(s) : parseFloat(s.lineHeight) / size).toFixed(2);
    let cpl = null;
    if (text.length >= 60) {
      const width = p.clientWidth ? p.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight) : p.getBoundingClientRect().width;
      g.font = `${s.fontStyle} ${s.fontWeight} ${size}px ${s.fontFamily}`;
      const sample = text.slice(0, 400);
      const avg = g.measureText(sample).width / sample.length + (parseFloat(s.letterSpacing) || 0);
      if (avg > 0 && width > 0) cpl = Math.round(Math.min(text.length, width / avg));
    }
    paras.push({ sel: desc(p), text: text.slice(0, 60), chars: text.length, lh, lhNormal, cpl });
  }

  // Muestra para CDP: todos los iconos y, por turnos, cada combinación familia/peso/estilo.
  const chosen = items.filter((x) => x.icon).slice(0, 100);
  const groups = new Map();
  for (const x of items) {
    if (x.icon) continue;
    const k = `${x.prim}|${x.w}|${x.st}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(x);
  }
  const queues = [...groups.values()].map((l) => [...l.filter((x) => x.leaf), ...l.filter((x) => !x.leaf)]);
  for (let i = 0; chosen.length < maxSample && queues.some((qq) => qq.length > i); i++) {
    for (const qq of queues) if (qq[i] && chosen.length < maxSample) chosen.push(qq[i]);
  }
  for (const x of chosen) { x.sampled = true; x.el.setAttribute('data-jom-tipo', String(x.idx)); }

  const links = { google: [], preload: [], preconnect: [] };
  for (const l of document.querySelectorAll('link[href]')) {
    const rel = (l.getAttribute('rel') || '').toLowerCase();
    if (/fonts\.googleapis\.com/.test(l.href) && /stylesheet/.test(rel)) links.google.push(l.href);
    if (rel.includes('preload')) links.preload.push({ href: l.href, as: l.getAttribute('as') || '', type: l.getAttribute('type') || '', cors: l.hasAttribute('crossorigin') });
    if (rel.includes('preconnect')) links.preconnect.push({ href: l.href, cors: l.hasAttribute('crossorigin') });
  }
  const faces = [...document.fonts].map((f) => ({ family: f.family.replace(/^["']|["']$/g, ''), weight: f.weight, style: f.style,
    status: f.status, display: f.display || 'auto', range: f.unicodeRange }));
  return { vv: +vv.toFixed(3), items: items.map(({ el, ...x }) => x), paras, cuts, hidden, links, faces,
    total: items.length, sampled: chosen.length };
}

// Sondas por familia/peso/estilo: «F», monospace y «F», serif. Si pintan la misma fuente, F existe.
function insertProbes(combos) {
  const box = document.createElement('div');
  box.setAttribute('data-jom-tipo-probe', 'box');
  box.style.cssText = 'position:absolute;left:-10000px;top:0;visibility:hidden;pointer-events:none;white-space:nowrap';
  combos.forEach(([fam, w, st], k) => {
    for (const [v, gen] of [['a', 'monospace'], ['b', 'serif']]) {
      const s = document.createElement('span');
      s.setAttribute('data-jom-tipo-probe', `${k}${v}`);
      s.style.fontFamily = `"${fam.replace(/["\\]/g, '')}", ${gen}`;
      s.style.fontWeight = w; s.style.fontStyle = st;
      s.textContent = 'Hamburgefonstiv 0123 home';
      box.appendChild(s);
    }
  });
  document.body.appendChild(box);
  return box.offsetWidth;   // fuerza el layout para que empiecen las descargas
}

// ---- CDP ----------------------------------------------------------------------
async function platformFonts(cdp, selector, attr) {
  const doc = await cdp.send('DOM.getDocument', { depth: 0 });
  const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: doc.root.nodeId, selector });
  const out = new Map();
  for (const nodeId of nodeIds) {
    try {
      const { attributes } = await cdp.send('DOM.getAttributes', { nodeId });
      const i = attributes.indexOf(attr);
      if (i < 0) continue;
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
      out.set(attributes[i + 1], fonts);
    } catch { /* nodo que ya no existe */ }
  }
  return out;
}
const dominant = (fonts) => (fonts && fonts.length ? fonts.reduce((a, b) => (b.glyphCount > a.glyphCount ? b : a)) : null);

// ¿Se pinta la familia pedida? Hoja: la fuente con más glifos debe ser la de la sonda.
// Con hijos de texto (otras familias), basta con que la de la sonda aparezca.
// Solo se juzga texto con letras: un «→» o «✓» sueltos los pinta otra fuente por diseño.
function judge(x, probes) {
  if (!x.sampled || x.icon || !x.render || !x.render.length) return null;
  const dom = x.render.reduce((a, b) => (b.glyphs > a.glyphs ? b : a));
  if (x.generic || !/[\p{L}\p{N}]{2,}/u.test(x.text)) return { judged: false, name: dom.name };
  const pr = probes[`${x.prim}|${x.w}|${x.st}`];
  const good = !!(pr && pr.avail && (x.leaf ? dom.name === pr.name : x.render.some((f) => f.name === pr.name)));
  return { judged: true, good, name: good ? pr.name : dom.name, avail: !!pr?.avail };
}

// @font-face de la hoja (texto vía CDP: también las de otro origen, como Google Fonts).
function parseFontFaces(text, base) {
  const out = [];
  const body = text.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of body.matchAll(/@font-face\s*\{([^}]*)\}/gi)) {
    const b = m[1];
    const get = (p) => { const r = new RegExp(`(?:^|[;{\\s])${p}\\s*:\\s*([^;]+)`, 'i').exec(b); return r ? r[1].trim() : ''; };
    const srcM = /(?:^|[;{\s])src\s*:\s*((?:url\((?:"[^"]*"|'[^']*'|[^)]*)\)|"[^"]*"|'[^']*'|[^;])*)/i.exec(b);
    const src = srcM ? srcM[1] : '';
    const urls = [...src.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/g)].map((x) => x[1] || x[2] || x[3])
      .map((u) => { if (/^data:/i.test(u)) return 'data:'; try { return new URL(u, base).href; } catch { return u; } });
    out.push({ family: get('font-family').replace(/^["']|["']$/g, ''), srcs: urls, local: /local\(/i.test(src),
      display: low(get('font-display')) || 'auto', weight: get('font-weight') || 'normal', style: get('font-style') || 'normal', base });
  }
  return out;
}
const googleFamilies = (href) => {
  try {
    const u = new URL(href);
    return u.searchParams.getAll('family').flatMap((f) => (u.pathname.includes('css2') ? [f] : f.split('|')))
      .map((f) => f.split(':')[0].trim()).filter(Boolean);
  } catch { return []; }
};

// ---- Una página a un ancho --------------------------------------------------
const isLocal = (u) => u.startsWith(BASE + '/');
const rel = (u) => (isLocal(u) ? u.slice(BASE.length + 1) : u.replace(/^https?:\/\//, ''));

async function auditViewport(browser, file, vp) {
  const ctx = await browser.newContext(vp.opts);
  const net = { fonts: new Map(), google: new Map(), external: new Map(), status: 0 };
  try {
    const page = await ctx.newPage();
    // Hojas y scripts externos caídos cambian los estilos medidos (p. ej. la CDN de Tailwind).
    const extType = (r, u) => /^https?:/.test(u) && !isLocal(u) && /^(stylesheet|script)$/.test(r.resourceType());
    page.on('response', (r) => {
      const u = r.url();
      if (r.request().resourceType() === 'font' && !u.startsWith('data:')) net.fonts.set(u, r.status());
      if (/fonts\.googleapis\.com/.test(u)) net.google.set(u, r.status());
      if (r.status() >= 400 && extType(r.request(), u)) net.external.set(u, `HTTP ${r.status()}`);
    });
    page.on('requestfailed', (r) => {
      const u = r.url(), e = r.failure()?.errorText || 'error';
      if (u.startsWith('data:')) return;
      if (extType(r, u) && e !== 'net::ERR_ABORTED') net.external.set(u, e);
      const isFont = r.resourceType() === 'font', isG = /fonts\.googleapis\.com/.test(u);
      if (!isFont && !isG) return;
      const map = isFont ? net.fonts : net.google;
      if (e === 'net::ERR_ABORTED' && map.has(u)) return;   // ya hay respuesta (404…)
      map.set(u, e);
    });
    const cdp = await ctx.newCDPSession(page);
    let work = (async () => {
      const resp = await page.goto(`${BASE}/${encodeURI(file)}`, { waitUntil: 'load', timeout: 45000 });
      net.status = resp ? resp.status() : 0;
      if (net.status !== 200) return null;
      await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
      await page.evaluate(autoScroll).catch(() => 0);
      await page.evaluate(fontsSettled, 5000).catch(() => {});
      await sleep(300);
      const sheets = [];
      cdp.on('CSS.styleSheetAdded', (e) => sheets.push(e.header));
      await cdp.send('DOM.enable');
      await cdp.send('CSS.enable');
      await sleep(200);
      const data = await page.evaluate(collect, { maxSample: MUESTRA, iconSrc: ICON_SRC });
      const fontFaces = [], imports = [];
      const pageURL = page.url();
      for (const h of sheets) {
        if (h.origin === 'user-agent') continue;
        try {
          const { text } = await cdp.send('CSS.getStyleSheetText', { styleSheetId: h.styleSheetId });
          const base = h.sourceURL && !h.isInline ? h.sourceURL : pageURL;
          for (const f of parseFontFaces(text, base)) fontFaces.push({ ...f, sheet: h.isInline ? 'inline' : rel(h.sourceURL || pageURL) });
          for (const m of text.matchAll(/@import\s+(?:url\(\s*)?["']?(https?:\/\/fonts\.googleapis\.com\/[^"')\s;]+)/gi)) imports.push(m[1]);
        } catch { /* hoja sin texto */ }
      }
      const plat = await platformFonts(cdp, '[data-jom-tipo]', 'data-jom-tipo');
      // Sondas: cada familia/peso/estilo con nombre propio que pinta el texto visible.
      const combos = [];
      const seen = new Set();
      for (const x of data.items) {
        if (x.generic || !x.prim) continue;
        const k = `${x.prim}|${x.w}|${x.st}`;
        if (!seen.has(k)) { seen.add(k); combos.push([x.prim, x.w, x.st]); }
      }
      const probes = new Map();
      if (combos.length) {
        await page.evaluate(insertProbes, combos);
        await page.evaluate(fontsSettled, 5000).catch(() => {});
        const pf = await platformFonts(cdp, '[data-jom-tipo-probe]', 'data-jom-tipo-probe');
        combos.forEach(([fam, w, st], k) => {
          const a = dominant(pf.get(`${k}a`)), b = dominant(pf.get(`${k}b`));
          probes.set(`${fam}|${w}|${st}`, { avail: !!(a && b && a.familyName === b.familyName), name: a?.familyName || '?', custom: !!a?.isCustomFont, alt: b?.familyName || '?' });
        });
        await page.evaluate(() => document.querySelectorAll('[data-jom-tipo-probe]').forEach((e) => e.remove()));
      }
      // Estado final de document.fonts (las sondas pueden haber cargado más caras).
      data.faces = await page.evaluate(() => [...document.fonts].map((f) => ({ family: f.family.replace(/^["']|["']$/g, ''),
        weight: f.weight, style: f.style, status: f.status, display: f.display || 'auto', range: f.unicodeRange })));
      const shot = path.join(OUT, 'capturas', `${file.replace(/\.html?$/i, '')}-${vp.id}.png`);
      await page.screenshot({ path: shot, timeout: 10000 }).catch(() => {});
      for (const x of data.items) if (x.sampled) x.render = (plat.get(String(x.idx)) || []).map((f) => ({ name: f.familyName, custom: f.isCustomFont, glyphs: f.glyphCount }));
      return { data, fontFaces, imports, probes: Object.fromEntries(probes), shot };
    })();
    work.catch(() => {});
    let timer;
    const limit = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('la página no respondió en 120 s')), 120000); });
    try {
      const r = await Promise.race([work, limit]);
      return { ...r, net: { status: net.status, fonts: Object.fromEntries(net.fonts), google: Object.fromEntries(net.google),
        externos: Object.fromEntries(net.external) } };
    } finally { clearTimeout(timer); }
  } finally {
    await ctx.close().catch(() => {});
  }
}

// ---- Análisis -------------------------------------------------------------------
const weightNum = (w) => (w === 'bold' ? 700 : w === 'normal' ? 400 : Number(w) || 400);
const faceRange = (w) => {
  const parts = String(w).split(/\s+/).map(weightNum);
  return [Math.min(...parts), Math.max(...parts)];
};
const ex = (x) => `${x.sel} ${q(x.text)}`;

function familyStats(V) {
  const fam = new Map();
  for (const x of V.data.items) {
    if (x.icon || !x.prim) continue;
    const k = x.prim;
    if (!fam.has(k)) fam.set(k, { chars: 0, weights: new Map(), styles: new Set(), generic: x.generic });
    const f = fam.get(k);
    f.chars += x.chars;
    f.weights.set(x.w, (f.weights.get(x.w) || 0) + x.chars);
    f.styles.add(x.st);
  }
  return fam;
}

function analyze(file, vps, brand) {
  const C = [];
  const V = vps.filter((v) => v.res);
  const bad = vps.filter((v) => !v.res);
  if (bad.length) C.push(fail('HTTP', bad.map((v) => `${v.id}: ${v.error}`).join(' · ')));
  if (!V.length) return { checks: C, families: [] };
  const D = V.find((v) => v.id === '1440') || V[0];
  const M = V.find((v) => v.id === '375');
  {
    const ext = new Map();
    for (const v of V) for (const [u, e] of Object.entries(v.res.net.externos || {})) ext.set(u, e);
    C.push(ext.size
      ? warn('red externa', `no respondió: ${cut([...ext].map(([u, e]) => `${rel(u)} (${e})`).join(', '), 260)} — los estilos medidos pueden no ser los reales`)
      : ok('red externa', 'hojas y scripts externos cargan (o no hay)'));
  }

  // Familias usadas en texto (las dos anchuras) y su cuota en escritorio.
  const used = new Map();
  for (const v of V) {
    for (const [k, f] of familyStats(v.res)) {
      if (!used.has(k)) used.set(k, { chars: 0, weights: new Set(), styles: new Set(), generic: f.generic });
      const u = used.get(k);
      if (v === D) u.chars = f.chars;
      else if (!u.chars) u.chars = f.chars;
      for (const w of f.weights.keys()) u.weights.add(w);
      for (const s of f.styles) u.styles.add(s);
    }
  }
  const totalChars = [...used.values()].reduce((a, f) => a + f.chars, 0);
  const iconItems = V.flatMap((v) => v.res.data.items.filter((x) => x.icon).map((x) => ({ ...x, vp: v.id })));

  // Declaradas: @font-face (todas las hojas) + familias pedidas a Google Fonts.
  const declared = new Map();
  const decl = (fam) => {
    const k = low(fam);
    if (!declared.has(k)) declared.set(k, { family: fam, faces: [], srcs: new Set(), displays: new Set(), google: false, googleCss: [] });
    return declared.get(k);
  };
  const googleHrefs = new Set();
  for (const v of V) {
    for (const f of v.res.fontFaces) {
      const dd = decl(f.family);
      if (!dd.faces.some((x) => x.weight === f.weight && x.style === f.style && x.srcs.join() === f.srcs.join())) dd.faces.push(f);
      f.srcs.forEach((s) => dd.srcs.add(s));
      dd.displays.add(f.display);
      if (/fonts\.googleapis\.com/.test(f.base)) dd.google = true;
    }
    for (const h of [...v.res.data.links.google, ...v.res.imports]) googleHrefs.add(h);
  }
  const gStatus = (h) => { for (const v of V) { const s = v.res.net.google[h]; if (s !== undefined) return s; } return 'sin respuesta'; };
  for (const h of googleHrefs) {
    for (const fam of googleFamilies(h)) {
      const dd = decl(fam);
      dd.google = true;
      dd.googleCss.push({ href: h, status: gStatus(h) });
    }
  }
  // document.fonts: estado por familia (la vista con más caras cargadas manda).
  const faceState = new Map();
  for (const v of V) {
    const byFam = new Map();
    for (const f of v.res.data.faces) {
      const k = low(f.family);
      if (!byFam.has(k)) byFam.set(k, { loaded: 0, error: 0, idle: 0, total: 0, faces: [] });
      const s = byFam.get(k);
      s.total++; s.faces.push(f);
      if (f.status === 'loaded') s.loaded++; else if (f.status === 'error') s.error++; else s.idle++;
    }
    for (const [k, s] of byFam) if (!faceState.has(k) || s.loaded > faceState.get(k).loaded) faceState.set(k, s);
  }
  const fontNet = {};
  for (const v of V) Object.assign(fontNet, v.res.net.fonts);
  const failedSrcs = (dd) => [...dd.srcs].filter((u) => fontNet[u] !== undefined && fontNet[u] !== 200).map((u) => `${rel(u)} → ${fontNet[u]}`);
  const isWeb = (fam) => declared.has(low(fam));
  const isBrand = (fam) => !!brand && brand.some((b) => low(b) === low(fam));
  const iconFams = new Set(iconItems.map((x) => low(x.prim)).filter((f) => ICON_RE.test(f)));

  // 1) carga: declaradas vs cargadas.
  {
    const fails = [], warns = [], infos = [];
    let faces = 0, loadedFaces = 0, idleFaces = 0;
    for (const [k, dd] of declared) {
      const st = faceState.get(k) || { loaded: 0, error: 0, idle: 0, total: 0, faces: [] };
      faces += st.total; loadedFaces += st.loaded; idleFaces += st.idle;
      const isUsed = used.has(dd.family) || [...used.keys()].some((f) => low(f) === k) || iconFams.has(k)
        || (ICON_RE.test(k) && iconItems.length > 0);
      const broken = failedSrcs(dd);
      const gBad = dd.googleCss.filter((g) => g.status !== 200);
      const why = [broken.length ? broken.join(', ') : '', gBad.length ? `Google Fonts: ${gBad.map((g) => `${cut(rel(g.href), 70)} → ${g.status}`).join(', ')}` : '']
        .filter(Boolean).join('; ');
      const origin = dd.google ? 'Google' : 'local';
      if (st.loaded === 0 && isUsed && (st.error > 0 || st.total === 0)) {
        fails.push(`${dd.family} (${origin}): ${st.total ? `${st.error}/${st.total} caras en error` : 'ninguna @font-face llegó a la página'}${why ? ` — ${why}` : ''}`);
      } else if (st.error > 0 || gBad.length) {
        warns.push(`${dd.family} (${origin}): ${st.error}/${st.total} caras en error${isUsed ? '' : ' (no se usa)'}${why ? ` — ${why}` : ''}`);
      } else infos.push(`${dd.family} ${st.loaded}/${st.total}`);
      // Negrita/cursiva sintética: se pide un peso/estilo que ninguna cara tiene.
      const u = [...used.entries()].find(([f]) => low(f) === k)?.[1];
      if (u && st.total) {
        const ranges = st.faces.map((f) => faceRange(f.weight));
        const maxW = Math.max(...ranges.map((r) => r[1]));
        for (const w of u.weights) {
          if (weightNum(w) >= 600 && maxW < 600) warns.push(`${dd.family} ${w}: negrita sintética (solo hay ${[...new Set(st.faces.map((f) => f.weight))].join(', ')})`);
        }
        if ([...u.styles].some((s) => s !== 'normal') && !st.faces.some((f) => f.style !== 'normal')) {
          warns.push(`${dd.family}: cursiva sintética (no hay cara italic)`);
        }
      }
    }
    const id = 'fuentes: carga';
    const summary = `${declared.size} familia(s) web, ${loadedFaces}/${faces} caras cargadas${idleFaces ? ` (${idleFaces} sin pedir: rangos/pesos no usados)` : ''}`;
    if (fails.length) C.push(fail(id, [...fails, ...warns].join(' · ')));
    else if (warns.length) C.push(warn(id, `${warns.join(' · ')} · ${summary}`));
    else C.push(ok(id, declared.size ? `${summary}: ${infos.join(', ')}` : 'sin fuentes web (solo del sistema)'));
  }

  // 2) render: ¿se pinta la fuente pedida o la de reserva? (CDP sobre la muestra + sondas)
  const rendered = new Map();   // familia → Set de fuentes reales
  {
    const fb = new Map();
    let sampled = 0, total = 0;
    for (const v of V) {
      total += v.res.data.total; sampled += v.res.data.sampled;
      for (const x of v.res.data.items) {
        const j = judge(x, v.res.probes);
        if (!j) continue;
        if (!j.judged && !x.generic) continue;
        if (!rendered.has(x.prim)) rendered.set(x.prim, new Map());
        rendered.get(x.prim).set(j.name, (rendered.get(x.prim).get(j.name) || 0) + 1);
        if (!j.judged || j.good) continue;
        if (!fb.has(x.prim)) fb.set(x.prim, { n: 0, got: new Map(), ex: x, avail: j.avail });
        const f = fb.get(x.prim);
        f.n++; f.got.set(j.name, (f.got.get(j.name) || 0) + 1);
      }
    }
    const id = 'fuentes: render';
    const lines = [], fails = [];
    for (const [fam, f] of fb) {
      const got = [...f.got.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n).join(', ');
      const strong = isWeb(fam) || isBrand(fam);
      const msg = `${fam} → se pinta ${got} (reserva) en ${f.n} nodo(s)${f.avail ? ' (faltan glifos o ese peso)' : ''}, p. ej. ${ex(f.ex)}`;
      (strong ? fails : lines).push(strong ? msg : `${msg}; «${fam}» no está instalada aquí`);
    }
    const map = [...rendered.entries()].map(([fam, m]) => `${fam} → ${[...m.keys()].join('/')}`).join(', ');
    const sample = `${sampled} de ${total} nodos de texto muestreados`;
    if (fails.length) C.push(fail(id, [...fails, ...lines].join(' · ')));
    else if (lines.length) C.push(warn(id, `${lines.join(' · ')} · ${sample}`));
    else C.push(ok(id, `${sample}: ${map || '—'}`));
  }

  // 3) iconos de fuente que enseñan su nombre.
  {
    const id = 'iconos';
    const seen = new Map();
    for (const x of iconItems) {
      const name = x.text;
      let broken, how;
      if (x.render && x.render.length) {
        const dom = x.render.reduce((a, b) => (b.glyphs > a.glyphs ? b : a));
        broken = !ICON_RE.test(dom.name);
        how = `se pinta con ${dom.name}`;
      } else {
        broken = /^[a-z0-9_]{3,}$/.test(name) && x.iconRatio > 1.6;
        how = `${x.iconRatio}× más ancho que alto`;
      }
      const k = `${x.sel}|${name}`;
      if (!seen.has(k) || broken) seen.set(k, { broken, how, x });
    }
    const all = [...seen.values()];
    const broken = all.filter((b) => b.broken);
    if (!all.length) C.push(ok(id, 'no usa iconos de fuente'));
    else if (broken.length) {
      const e = broken[0];
      C.push(fail(id, `${broken.length}/${all.length} icono(s) muestran su nombre como texto: ${q(e.x.text)} (${e.x.sel}, ${e.x.vp} px) ${e.how}, ${Math.round(e.x.iconRatio * e.x.size)} px de ancho para ${e.x.size} px`));
    } else C.push(ok(id, `${all.length} icono(s) distintos (${iconItems.length} nodos en ${V.length} anchos) con su fuente: ${[...new Set(iconItems.map((x) => (x.render?.[0]?.name) || x.prim))].join(', ')}`));
  }

  // 4) familias y pesos en texto visible.
  const famList = [...used.entries()].sort((a, b) => b[1].chars - a[1].chars);
  const famDesc = famList.map(([f, u]) => `${f} (${[...u.weights].sort((a, b) => weightNum(a) - weightNum(b)).join('/')} · ${pct(u.chars, totalChars)})`);
  C.push(famList.length > LIMITS.maxFamilies
    ? warn('familias', `${famList.length} familias en texto visible (máx. ${LIMITS.maxFamilies}): ${famDesc.join(', ')}`)
    : ok('familias', `${famList.length}: ${famDesc.join(', ') || '—'}`));

  // 5) marca.
  if (!brand || !brand.length) C.push(ok('marca', 'sin lista de marca (no hay home; usa --marca)'));
  else {
    const out = famList.filter(([f]) => !isBrand(f));
    C.push(out.length
      ? warn('marca', `fuera de la marca (${brand.join(', ')}): ${out.map(([f, u]) => `${f} (${pct(u.chars, totalChars)}, p. ej. ${ex(V.map((v) => v.res.data.items.find((x) => x.prim === f)).find(Boolean))})`).join(' · ')}`)
      : ok('marca', `todo en ${brand.join(', ')}`));
  }

  // 6) tamaño en móvil.
  if (M) {
    const its = M.res.data.items.filter((x) => !x.icon);
    const f10 = its.filter((x) => x.eff < LIMITS.failPx), f12 = its.filter((x) => x.eff >= LIMITS.failPx && x.eff < LIMITS.warnPx);
    const min = its.reduce((a, x) => (x.eff < a.eff ? x : a), its[0] || { eff: 0 });
    const zoom = M.res.data.vv < 0.99 ? ` (la página se ve al ${Math.round(M.res.data.vv * 100)} %: ¿falta meta viewport?)` : '';
    const worst = (l) => l.sort((a, b) => a.eff - b.eff).slice(0, 2).map((x) => `${x.eff} px ${ex(x)}`).join(', ');
    if (f10.length) C.push(fail('tamaño 375', `${f10.length} texto(s) < ${LIMITS.failPx} px: ${worst(f10)}${f12.length ? ` · ${f12.length} más < ${LIMITS.warnPx} px` : ''}${zoom}`));
    else if (f12.length) C.push(warn('tamaño 375', `${f12.length} texto(s) < ${LIMITS.warnPx} px: ${worst(f12)}${zoom}`));
    else C.push(ok('tamaño 375', its.length ? `mínimo ${min.eff} px (${its.length} textos)${zoom}` : 'sin texto'));
  } else C.push(warn('tamaño 375', 'no se pudo medir a 375 px'));

  // 7) interlineado de párrafos.
  {
    const seen = new Map();
    for (const v of V) for (const p of v.res.data.paras) {
      if (p.lh >= LIMITS.lh) continue;
      const k = p.sel + p.text;
      if (!seen.has(k) || p.lh < seen.get(k).lh) seen.set(k, { ...p, vp: v.id });
    }
    const l = [...seen.values()].sort((a, b) => a.lh - b.lh);
    const n = Math.max(...V.map((v) => v.res.data.paras.length));
    C.push(l.length ? warn('interlineado', `${l.length} párrafo(s) con line-height < ${LIMITS.lh}: ${l.slice(0, 2).map((p) => `${p.lh}${p.lhNormal ? ' (normal)' : ''} ${ex(p)}`).join(', ')}`)
      : ok('interlineado', n ? `${n} párrafo(s), todos ≥ ${LIMITS.lh}` : 'sin párrafos'));
  }

  // 8) longitud de línea en escritorio.
  {
    const DD = V.find((v) => v.id === '1440');
    if (!DD) C.push(warn('línea 1440', 'no se pudo medir a 1440 px'));
    else {
      const ps = DD.res.data.paras.filter((p) => p.cpl);
      const l = ps.filter((p) => p.cpl > LIMITS.cpl).sort((a, b) => b.cpl - a.cpl);
      const max = ps.reduce((a, p) => Math.max(a, p.cpl), 0);
      C.push(l.length ? warn('línea 1440', `${l.length} párrafo(s) con más de ${LIMITS.cpl} caracteres por línea: ${l.slice(0, 2).map((p) => `~${p.cpl} ${ex(p)}`).join(', ')}`)
        : ok('línea 1440', ps.length ? `máx. ~${max} caracteres por línea` : 'sin párrafos largos'));
    }
  }

  // 9) contraste WCAG 2.1 AA.
  {
    const parts = [], fails = [];
    let failing = 0;
    for (const v of V) {
      const its = v.res.data.items.filter((x) => x.contrast);
      const meas = its.filter((x) => x.contrast.ratio !== undefined);
      const bad = meas.filter((x) => x.contrast.ratio < (x.contrast.large ? LIMITS.aaLarge : LIMITS.aa)).sort((a, b) => a.contrast.ratio - b.contrast.ratio);
      const nm = its.filter((x) => x.contrast.why);
      const why = {};
      for (const x of nm) why[x.contrast.why] = (why[x.contrast.why] || 0) + 1;
      const nmTxt = nm.length ? `, ${nm.length} no medible(s): ${Object.entries(why).map(([k, n]) => `${k} ${n}`).join(', ')}` : '';
      const nCota = meas.filter((x) => x.contrast.cota).length;
      const cotaTxt = nCota ? ` (${nCota} por cota de peor caso)` : '';
      failing += bad.length;
      if (bad.length) {
        const w = bad[0].contrast;
        fails.push(`${v.id}: ${bad.length}/${meas.length} bajo AA (peor ${w.ratio}:1 ${w.fg} sobre ${w.bg}, mín. ${w.large ? LIMITS.aaLarge : LIMITS.aa}: ${ex(bad[0])})${cotaTxt}${nmTxt}`);
      } else parts.push(`${v.id}: ${meas.length} medidos ≥ AA${cotaTxt}${nmTxt}`);
    }
    C.push(failing ? fail('contraste', [...fails, ...parts].join(' · ')) : ok('contraste', parts.join(' · ')));
  }

  // 10) texto cortado.
  {
    const fails = [], warns = [];
    const seen = new Set();
    for (const v of V) for (const c of v.res.data.cuts) {
      const k = `${c.box}|${c.text}|${c.kind}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const where = `${c.sel}${c.box !== c.sel ? ` en ${c.box}` : ''} ${q(c.text)} (${v.id} px)`;
      if (c.kind === 'x') fails.push(`${where}: sobresalen ${c.px} px de ${c.visible} px visibles (overflow hidden, sin elipsis)`);
      else if (c.kind === 'y' && c.em > 0.6) fails.push(`${where}: ${c.px} px (${c.em} em) de alto ocultos`);
      else if (c.kind === 'y') warns.push(`${where}: recorte vertical de ${c.em} em (¿descendentes?)`);
      else warns.push(`${where}: truncado con ${c.kind === 'elipsis' ? 'elipsis (…)' : 'line-clamp'} (${c.px} px ocultos)`);
    }
    const h = {};
    for (const v of V) for (const [k, n] of Object.entries(v.res.data.hidden)) h[k] = Math.max(h[k] || 0, n);
    const notes = [h.animado ? `${h.animado} en animación` : '', h.carrusel ? `${h.carrusel} en pista/carrusel que asoma por el borde` : '',
      h.opacidad ? `${h.opacidad} con opacidad 0 sin auditar` : ''].filter(Boolean).join(', ');
    if (fails.length) C.push(fail('cortado', [...fails, ...warns].slice(0, 4).join(' · ') + (fails.length + warns.length > 4 ? ` (+${fails.length + warns.length - 4})` : '')));
    else if (warns.length) C.push(warn('cortado', warns.slice(0, 3).join(' · ')));
    else C.push(ok('cortado', `sin texto cortado${notes ? ` (${notes})` : ''}`));
  }

  // 11) font-display.
  {
    const bad = [];
    for (const [k, st] of faceState) {
      const ds = [...new Set(st.faces.map((f) => f.display))];
      const okSet = ICON_RE.test(k) ? new Set([...DISPLAY_OK, 'block']) : DISPLAY_OK;
      const wrong = ds.filter((x) => !okSet.has(x));
      if (wrong.length) bad.push(`${st.faces[0].family}: ${wrong.join('/')}`);
    }
    const n = faceState.size;
    C.push(bad.length ? warn('font-display', `${bad.join(', ')} (usa swap u optional; con block/auto el texto queda invisible hasta 3 s)`)
      : ok('font-display', n ? `${n} familia(s) con swap/optional${[...faceState.keys()].some((k) => ICON_RE.test(k)) ? ' (iconos: block vale)' : ''}` : 'sin @font-face'));
  }

  // 12) precarga de la fuente principal.
  {
    const id = 'precarga';
    const main = famList[0]?.[0];
    const links = D.res.data.links;
    const fontPre = links.preload.filter((l) => low(l.as) === 'font');
    const usedUrls = new Set(Object.entries(fontNet).filter(([, s]) => s === 200).map(([u]) => u));
    const unused = fontPre.filter((l) => !usedUrls.has(l.href));
    const noCors = fontPre.filter((l) => !l.cors);
    const extra = [unused.length ? `precarga sin usar: ${unused.map((l) => rel(l.href)).join(', ')}` : '',
      noCors.length ? `precarga sin crossorigin (se descarga dos veces): ${noCors.map((l) => rel(l.href)).join(', ')}` : ''].filter(Boolean);
    const dd = main && declared.get(low(main));
    if (!main) C.push(ok(id, 'sin texto'));
    else if (!dd) C.push(extra.length ? warn(id, extra.join(' · ')) : ok(id, `la principal (${main}) es del sistema: no necesita precarga`));
    else if (dd.google && ![...dd.srcs].some((s) => fontPre.some((l) => l.href === s))) {
      const pc = links.preconnect.find((l) => /fonts\.gstatic\.com/.test(l.href));
      if (!pc) C.push(warn(id, [`${main} viene de Google Fonts sin <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`, ...extra].join(' · ')));
      else if (!pc.cors) C.push(warn(id, [`preconnect a fonts.gstatic.com sin crossorigin (no sirve para fuentes)`, ...extra].join(' · ')));
      else C.push(extra.length ? warn(id, extra.join(' · ')) : ok(id, `${main} (Google Fonts) con preconnect a fonts.gstatic.com`));
    } else {
      const hit = fontPre.find((l) => dd.srcs.has(l.href));
      const srcs = [...dd.srcs].filter((s) => s !== 'data:');
      if (!hit) C.push(warn(id, [`la fuente principal (${main}, ${pct(famList[0][1].chars, totalChars)} del texto) no tiene <link rel="preload" as="font" type="font/woff2" href="${srcs[0] ? rel(srcs[0]) : '…'}" crossorigin>`, ...extra].join(' · ')));
      else C.push(extra.length ? warn(id, extra.join(' · ')) : ok(id, `${main} precargada (${rel(hit.href)})`));
    }
  }

  const families = famList.map(([f, u]) => {
    const dd = declared.get(low(f));
    const st = faceState.get(low(f));
    return { familia: f, caracteres: u.chars, cuota: totalChars ? +(u.chars / totalChars).toFixed(3) : 0, pesos: [...u.weights],
      estilos: [...u.styles], declarada: dd ? (dd.google ? 'google' : 'local') : 'sistema',
      caras: st ? { cargadas: st.loaded, error: st.error, sinPedir: st.idle, total: st.total } : null,
      display: st ? [...new Set(st.faces.map((x) => x.display))] : [],
      renderizada: rendered.has(f) ? Object.fromEntries(rendered.get(f)) : {} };
  });
  return { checks: C, families, declared: [...declared.values()].map((dd) => ({ familia: dd.family, origen: dd.google ? 'google' : 'local',
    srcs: [...dd.srcs].map(rel), display: [...dd.displays], googleCss: dd.googleCss.map((g) => ({ href: g.href, estado: g.status })) })) };
}

function finalize(res) {
  const rank = { FAIL: 0, WARN: 1, PASS: 2 };
  res.verdict = res.checks.some((c) => c.status === 'FAIL') ? 'FAIL' : res.checks.some((c) => c.status === 'WARN') ? 'WARN' : 'PASS';
  res.reasons = res.checks.filter((c) => c.status !== 'PASS').sort((a, b) => rank[a.status] - rank[b.status]).map((c) => `${c.id}: ${c.msg}`);
  return res;
}

// Marca por defecto: las fuentes web (@font-face/Google) con ≥ 2 % del texto visible del
// home a 1440; si el home no usa ninguna, cualquier familia con ≥ 2 %.
function brandFrom(V) {
  const fam = familyStats(V);
  const total = [...fam.values()].reduce((a, f) => a + f.chars, 0);
  const web = new Set([...V.fontFaces.map((f) => low(f.family)),
    ...[...V.data.links.google, ...V.imports].flatMap(googleFamilies).map(low)]);
  const big = [...fam.entries()].filter(([, f]) => total && f.chars / total >= LIMITS.brandShare && !f.generic)
    .sort((a, b) => b[1].chars - a[1].chars).map(([k]) => k);
  const webBig = big.filter((k) => web.has(low(k)));
  const keep = webBig.length ? webBig : big;
  const dropped = [...fam.entries()].filter(([k]) => !keep.includes(k))
    .map(([k, f]) => `${k} ${pct(f.chars, total)}${webBig.length && big.includes(k) ? ' (no es fuente web)' : ''}`);
  const caidos = Object.keys(V.net.externos || {}).map(rel);
  return { keep, dropped, caidos };
}

// ---- Principal ----------------------------------------------------------------
const PW = loadPlaywright();
if (!PW) die('No encuentro el paquete playwright (usa scripts/auditar-tipografia.sh o define JOM_PLAYWRIGHT=<carpeta>)');
fs.mkdirSync(path.join(OUT, 'capturas'), { recursive: true });

say(`Auditoría tipográfica de ${PAGES.length} página(s)`);
console.log(`  · origen: ${SRC}`);
console.log(`  · servidor: ${BASE}`);
let browser;
try {
  browser = await PW.pw.chromium.launch({ args: WEBGL_ARGS });
} catch (e) {
  die(`Chromium no arranca: ${first(e)}\n  Instálalo con: node "${path.join(PW.dir, 'cli.js')}" install chromium`);
}
const chromeVersion = browser.version();
console.log(`  · playwright ${PW.version} · Chromium ${chromeVersion} · muestra CDP ≤ ${MUESTRA} nodos por ancho`);
const mobileUA = `Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Mobile Safari/537.36`;
VIEWPORTS[0].opts.userAgent = mobileUA;

async function runPage(file) {
  const vps = [];
  for (const vp of VIEWPORTS) {
    try {
      const res = await auditViewport(browser, file, vp);
      if (res.data) vps.push({ id: vp.id, res });
      else vps.push({ id: vp.id, error: `HTTP ${res.net.status}` });
    } catch (e) { vps.push({ id: vp.id, error: cut(first(e), 160) }); }
  }
  return vps;
}

const results = [];
let brand = MARCA, brandOrigin = MARCA ? '--marca' : null, brandDropped = [];
let brandDown = [];
const printBrand = () => {
  console.log(brand && brand.length
    ? `  · marca (${brandOrigin}): ${brand.join(', ')}${brandDropped.length ? ` · descartadas: ${brandDropped.join(', ')}` : ''}`
    : '  ⚠ sin lista de marca: no hay home en SRC o no cargó (usa --marca "Sora,JetBrains Mono")');
  if (brandDown.length) console.log(`  ⚠ en el home no respondió ${cut(brandDown.join(', '), 160)}: la marca detectada puede no ser la real (usa --marca)`);
};
try {
  const home = HOMES.find((f) => fs.existsSync(path.join(SRC, f)));
  const order = home && PAGES.includes(home) ? [home, ...PAGES.filter((f) => f !== home)] : PAGES;
  if (!brand && home && !PAGES.includes(home)) {
    const vps = await runPage(home);
    const D = vps.find((v) => v.id === '1440' && v.res);
    if (D) { const b = brandFrom(D.res); brand = b.keep; brandDropped = b.dropped; brandDown = b.caidos; brandOrigin = home; }
  }
  if (MARCA || !home || !PAGES.includes(home)) printBrand();
  for (const file of order) {
    const t0 = Date.now();
    const vps = await runPage(file);
    if (!brand && file === home) {
      const D = vps.find((v) => v.id === '1440' && v.res);
      if (D) { const b = brandFrom(D.res); brand = b.keep; brandDropped = b.dropped; brandDown = b.caidos; brandOrigin = home; }
    }
    if (file === home && !MARCA) printBrand();
    const a = analyze(file, vps, brand);
    const r = finalize({ file, checks: a.checks, familias: a.families, declaradas: a.declared,
      anchos: Object.fromEntries(vps.map((v) => [v.id, v.res ? {
        escala: v.res.data.vv, textos: v.res.data.total, muestra: v.res.data.sampled, ocultos: v.res.data.hidden,
        sondas: v.res.probes, red: v.res.net, captura: v.res.shot,
        fueraDeAA: v.res.data.items.filter((x) => x.contrast?.ratio !== undefined && x.contrast.ratio < (x.contrast.large ? LIMITS.aaLarge : LIMITS.aa)).slice(0, 50),
        noMedibles: v.res.data.items.filter((x) => x.contrast?.why).slice(0, 50).map((x) => ({ sel: x.sel, text: x.text, ...x.contrast })),
        pequenos: v.res.data.items.filter((x) => !x.icon && x.eff < LIMITS.warnPx).slice(0, 50),
        iconos: v.res.data.items.filter((x) => x.icon),
        reserva: v.res.data.items.filter((x) => { const j = judge(x, v.res.probes); return j && j.judged && !j.good; }).slice(0, 50),
        parrafos: v.res.data.paras, cortes: v.res.data.cuts,
      } : { error: v.error }])) });
    r.seconds = Math.round((Date.now() - t0) / 100) / 10;
    results.push(r);
    console.log(`  ${ICON[r.verdict]} ${r.file.padEnd(32)} ${r.verdict} (${r.seconds} s)`);
  }
} finally {
  await browser.close().catch(() => {});
}

// ---- Informe --------------------------------------------------------------------
const COLS = [['red externa', 'red'], ['fuentes: carga', 'carga'], ['fuentes: render', 'render'], ['iconos', 'iconos'], ['familias', 'famil.'],
  ['marca', 'marca'], ['tamaño 375', 'tamaño'], ['interlineado', 'interl.'], ['línea 1440', 'línea'],
  ['contraste', 'contr.'], ['cortado', 'cortado'], ['font-display', 'display'], ['precarga', 'precarga']];
say('Resultado');
const w = Math.max(8, ...results.map((r) => r.file.length)) + 2;
console.log(`  ${'PÁGINA'.padEnd(w)}${COLS.map(([, h]) => h.padEnd(9)).join('')}VEREDICTO`);
for (const r of results) {
  const cells = COLS.map(([id]) => {
    const c = r.checks.find((x) => x.id === id);
    return (c ? ICON[c.status] : '·').padEnd(9);
  }).join('');
  const http = r.checks.find((x) => x.id === 'HTTP');
  console.log(`  ${r.file.padEnd(w)}${cells}${ICON[r.verdict]} ${r.verdict}${http ? ` (${http.msg})` : ''}`);
}
say('Detalle');
for (const r of results) {
  console.log(`  ${r.file}`);
  const fam = r.familias.map((f) => `${f.familia} [${f.declarada}${f.caras ? ` ${f.caras.cargadas}/${f.caras.total} caras` : ''}] → ${Object.keys(f.renderizada).join('/') || '?'}`);
  if (fam.length) console.log(`    · fuentes: ${cut(fam.join(' · '), 400)}`);
  for (const c of r.checks.filter((x) => x.status !== 'PASS')) console.log(`    ${ICON[c.status]} ${c.id}: ${cut(c.msg, 600)}`);
  for (const c of r.checks.filter((x) => x.status === 'PASS' && /contraste|tamaño|render/.test(x.id))) console.log(`    ${ICON.PASS} ${c.id}: ${cut(c.msg, 300)}`);
}
const count = (v) => results.filter((r) => r.verdict === v).length;
const summary = { PASS: count('PASS'), WARN: count('WARN'), FAIL: count('FAIL') };
const jsonPath = path.join(OUT, 'tipografia.json');
fs.writeFileSync(jsonPath, JSON.stringify({
  fecha: new Date().toISOString(), origen: SRC, servidor: BASE, playwright: PW.version, chromium: chromeVersion,
  umbrales: LIMITS, marca: { familias: brand || [], origen: brandOrigin, descartadas: brandDropped, homeSinRed: brandDown },
  resumen: summary, paginas: results,
}, null, 2));
console.log(`\n  ${summary.PASS} PASS · ${summary.WARN} WARN · ${summary.FAIL} FAIL`);
console.log(`  JSON: ${jsonPath}`);
console.log(`  Capturas: ${path.join(OUT, 'capturas')}`);
process.exit(summary.FAIL ? 1 : 0);
