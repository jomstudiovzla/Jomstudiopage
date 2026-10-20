#!/usr/bin/env node
// JOM Studio · graba la home y los 7 protocolos EN ACCIÓN (Playwright recordVideo)
// para montar videos de YouTube. No modifica nada de SRC.
//
// Normalmente lo lanza scripts/grabar-protocolos.sh, que sirve SRC en 127.0.0.1.
// A mano:
//   node scripts/grabar-protocolos.mjs --src <carpeta> --base http://127.0.0.1:8089 \
//        [--out ./youtube-out] [--vertical | --solo-vertical] [--solo home,01,03] \
//        [--duracion 14] [--repetir 1] [--sin-cursor]
// Modo interno (lo usa montar-youtube.sh cuando el ffmpeg no trae drawtext):
//   node scripts/grabar-protocolos.mjs --rotulos <spec.json>
//
// Salida: <out>/clips/<pagina>.webm (1920×1080) y, con --vertical,
// <out>/clips/vertical/<pagina>.webm (1080×1920), más <out>/clips/manifiesto.json
// (duración real, inicio útil, momento clave y qué acciones se hicieron).
// Si ya había una carpeta clips con videos, se renombra a clips-AAAAMMDD-HHMMSS
// (nunca se borra nada). Código de salida: 0 ok · 1 alguna página falló · 2 no se pudo grabar.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEBGL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars'];
const SIZES = { horizontal: { width: 1920, height: 1080 }, vertical: { width: 1080, height: 1920 } };
const PROTOS = [
  ['01', 'Gamificación'], ['02', 'Full-Stack & 3D'], ['03', 'Arte IA'], ['04', 'Automatización'],
  ['05', 'Audio UGC'], ['06', 'Branding'], ['07', 'Sentinel QA'],
];
// Tipos que daría Cloudflare (python3 -m http.server no conoce .glb/.wasm/.mjs en todos los Mac).
const MIME = {
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json', '.webm': 'video/webm', '.mp4': 'video/mp4', '.webp': 'image/webp',
  '.avif': 'image/avif', '.svg': 'image/svg+xml', '.css': 'text/css; charset=utf-8',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.woff2': 'font/woff2',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (s) => console.log(`\n==> ${s}`);
const die = (s) => { console.error(`\n✖ ${s}`); process.exit(2); };
const first = (e) => String(e?.message ?? e).split('\n')[0].replace(/\s+/g, ' ').trim();
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const d0 = new Date(), p2 = (n) => String(n).padStart(2, '0');
const STAMP = `${d0.getFullYear()}${p2(d0.getMonth() + 1)}${p2(d0.getDate())}-${p2(d0.getHours())}${p2(d0.getMinutes())}${p2(d0.getSeconds())}`;

// ---- Argumentos -------------------------------------------------------------
const FLAGS = new Set(['vertical', 'solo-vertical', 'sin-cursor']);
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const m = process.argv[i].match(/^--([a-z-]+)(?:=(.*))?$/);
  if (!m) die(`Argumento desconocido: ${process.argv[i]}`);
  if (FLAGS.has(m[1])) { args[m[1]] = true; continue; }
  args[m[1]] = m[2] ?? process.argv[++i];
  if (args[m[1]] === undefined) die(`--${m[1]} necesita un valor`);
}

// ---- Playwright -------------------------------------------------------------
// ESM no mira NODE_PATH: se resuelve con createRequire desde rutas conocidas
// (mismo orden que auditar_protocolos.mjs).
function loadPlaywright() {
  const dirs = [process.env.JOM_PLAYWRIGHT].filter(Boolean);
  const froms = [process.env.JOM_AUDIT_PREFIX && path.join(process.env.JOM_AUDIT_PREFIX, 'package.json'),
    path.join(os.tmpdir(), 'jom-audit-node', 'package.json'),
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

// =============================================================================
// Modo --rotulos: rótulos PNG transparentes con Chromium (reserva de montar-youtube
// cuando el ffmpeg instalado no trae el filtro drawtext). Mismo diseño que drawtext:
// rectángulos, degradados, imágenes y líneas de texto en px absolutos.
// =============================================================================
async function rotulos(specPath) {
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const PW = loadPlaywright();
  if (!PW) die('No encuentro Playwright (ejecuta antes scripts/grabar-protocolos.sh o define JOM_PLAYWRIGHT)');
  const dataUrl = (file, mime) => `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
  const fontMime = (f) => (/\.otf$/i.test(f) ? 'font/otf' : /\.woff2$/i.test(f) ? 'font/woff2' : 'font/ttf');
  const faces = Object.entries(spec.fuentes || {}).map(([rol, f]) =>
    `@font-face{font-family:"jom-${rol}";src:url(${dataUrl(f, fontMime(f))});}`).join('\n');
  const rgba = (hex, a = 1) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const browser = await PW.pw.chromium.launch();
  try {
    for (const card of spec.tarjetas) {
      const els = card.prims.map((p) => {
        if (p.tipo === 'rect') {
          return `<div style="position:absolute;left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px;background:${rgba(p.color, p.alfa ?? 1)}"></div>`;
        }
        if (p.tipo === 'degradado') {
          const dir = p.direccion === 'vertical' ? 'to bottom' : 'to right';
          return `<div style="position:absolute;left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px;background:linear-gradient(${dir},${rgba(p.color, p.alfa0)},${rgba(p.color, p.alfa1)})"></div>`;
        }
        if (p.tipo === 'imagen') {
          return `<img src="${dataUrl(p.archivo, 'image/png')}" style="position:absolute;left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px;object-fit:contain">`;
        }
        if (p.tipo === 'texto') {
          const shadow = p.sombra ? `text-shadow:${p.sombra}px ${p.sombra}px 0 rgba(0,0,0,.55);` : '';
          const pos = p.alinear === 'centro' ? `left:0;width:${card.w}px;text-align:center` : `left:${p.x}px`;
          return `<div style="position:absolute;${pos};top:${p.y}px;font-family:'jom-${p.fuente}';font-size:${p.tam}px;line-height:${Math.round(p.tam * 1.18)}px;color:${rgba(p.color, p.alfa ?? 1)};white-space:pre;${shadow}">${esc(p.texto)}</div>`;
        }
        return '';
      }).join('\n');
      const bg = card.fondo ? `background:${rgba(card.fondo)};` : 'background:transparent;';
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>${faces}
html,body{margin:0;width:${card.w}px;height:${card.h}px;overflow:hidden;${bg}}</style></head><body>${els}</body></html>`;
      const page = await browser.newPage({ viewport: { width: card.w, height: card.h }, deviceScaleFactor: 1 });
      await page.setContent(html, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: card.salida, omitBackground: !card.fondo });
      await page.close();
      console.log(`  ✔ rótulo ${path.basename(card.salida)} (${card.w}×${card.h})`);
    }
  } finally {
    await browser.close();
  }
}

if (args.rotulos) {
  await rotulos(path.resolve(args.rotulos));
  process.exit(0);
}

// =============================================================================
// Modo normal: grabar
// =============================================================================
const SRC = path.resolve(args.src || process.env.SRC || '.');
const BASE = (args.base || process.env.BASE || 'http://127.0.0.1:8089').replace(/\/+$/, '');
const OUT = path.resolve(args.out || path.join(process.cwd(), 'youtube-out'));
const DURACION = Math.max(6, Number(args.duracion || 14));   // s útiles mínimos por página
const REPETIR = Math.max(1, Math.min(10, Math.round(Number(args.repetir || 1))));   // ciclos de coreografía por clip
const CURSOR = !args['sin-cursor'];
const ORIENTS = args['solo-vertical'] ? ['vertical'] : args.vertical ? ['horizontal', 'vertical'] : ['horizontal'];
const SOLO = args.solo ? new Set(String(args.solo).split(',').map((s) => s.trim().replace(/\.html$/, '')).filter(Boolean)) : null;
if (!fs.existsSync(SRC) || !fs.statSync(SRC).isDirectory()) die(`No existe la carpeta ${SRC}`);
if (!Number.isFinite(DURACION)) die('--duracion debe ser un número de segundos');
if (!Number.isFinite(REPETIR)) die('--repetir debe ser un número de ciclos (1–10)');

// Páginas que existan: home (concept_master_horizontal, si no index) + page_NN_*.html.
function discoverPages() {
  const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.html')).sort();
  const pages = [];
  const home = files.includes('concept_master_horizontal.html') ? 'concept_master_horizontal.html'
    : files.includes('index.html') ? 'index.html' : null;
  if (home) pages.push({ clave: 'home', file: home, slug: home.replace(/\.html$/, ''), nombre: 'Home' });
  for (const [n, nombre] of PROTOS) {
    const f = files.find((x) => x.startsWith(`page_${n}_`));
    if (f) pages.push({ clave: n, file: f, slug: f.replace(/\.html$/, ''), nombre });
  }
  return pages.filter((p) => !SOLO || SOLO.has(p.clave) || SOLO.has(p.slug) || SOLO.has(p.file.replace(/\.html$/, '')));
}

// Cursor visible (Playwright no graba el puntero del sistema). pointer-events:none:
// no tapa nada ni cambia elementFromPoint, así el hover del michi sigue igual.
function cursorInit() {
  const make = () => {
    if (document.getElementById('__jom-cursor')) return;
    const c = document.createElement('div');
    c.id = '__jom-cursor';
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:fixed;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;'
      + 'border:3px solid #fff;background:rgba(196,163,90,.55);box-shadow:0 0 0 2px rgba(13,13,13,.55),0 4px 14px rgba(0,0,0,.35);'
      + 'pointer-events:none;z-index:2147483647;transform:translate(-100px,-100px);transition:width .12s,height .12s,margin .12s';
    document.documentElement.appendChild(c);
    addEventListener('mousemove', (e) => { c.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; }, true);
    addEventListener('mousedown', () => { c.style.width = c.style.height = '18px'; c.style.margin = '-9px 0 0 -9px'; }, true);
    addEventListener('mouseup', () => { c.style.width = c.style.height = '26px'; c.style.margin = '-13px 0 0 -13px'; }, true);
  };
  if (document.documentElement) make(); else addEventListener('DOMContentLoaded', make);
  addEventListener('DOMContentLoaded', make);
}

// ---- Movimiento de cámara/cursor ---------------------------------------------
function rig(page) {
  const st = { x: 40, y: 40 };
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  return {
    // Por reloj, no por pasos: con WebGL por software cada mouse.move puede tardar ~0,2 s y
    // un bucle de N pasos se alargaría segundos; así el gesto dura `ms` en cualquier máquina.
    async moveTo(x, y, ms = 650) {
      const ax = st.x, ay = st.y, t0 = Date.now();
      for (;;) {
        const k = Math.min(1, (Date.now() - t0) / ms), e = ease(k);
        await page.mouse.move(ax + (x - ax) * e, ay + (y - ay) * e);
        if (k >= 1) break;
        await sleep(16);
      }
      st.x = x; st.y = y;
    },
    async click(x, y, ms = 600) {
      await this.moveTo(x, y, ms);
      await sleep(120);
      await page.mouse.down(); await sleep(90); await page.mouse.up();
    },
    pos: st,
  };
}

// Scroll suave con duración controlada (behavior:'smooth' cambia según el navegador).
async function scrollTo(page, y, ms = 1400) {
  await page.evaluate(([y, ms]) => new Promise((res) => {
    const y0 = scrollY, dy = Math.max(0, Math.min(y, document.documentElement.scrollHeight - innerHeight)) - y0;
    if (Math.abs(dy) < 2) return res();
    const t0 = performance.now();
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    (function step(now) {
      const t = Math.min(1, (now - t0) / ms);
      scrollTo(0, y0 + dy * ease(t));
      if (t < 1) requestAnimationFrame(step); else res();
    })(t0);
  }), [y, ms]);
}
async function scrollIntoCenter(page, sel, ms = 900) {
  const y = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return scrollY + r.top + r.height / 2 - innerHeight / 2;
  }, sel);
  if (y !== null) await scrollTo(page, y, ms);
  return y !== null;
}
const boxOf = (page, sel) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, top: r.top, left: r.left };
}, sel);

// Botón principal por texto (fuera del menú y del cajón), como el auditor.
function markButton([reSrc, attrSrc]) {
  const re = new RegExp(reSrc, 'i'), ar = attrSrc ? new RegExp(attrSrc, 'i') : null;
  const skip = (el) => !el || !!el.closest('script,style,noscript,template,head,nav,#mobile-drawer-menu,#__jom-cursor');
  const vis = (el) => (el.checkVisibility ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : true);
  const clickOf = (el) => el.closest('button,[role=button],input[type=button],input[type=submit],summary,label,[onclick],a[href^="#"]');
  const cands = [];
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (tw.nextNode()) if (re.test(tw.currentNode.nodeValue)) cands.push(tw.currentNode.parentElement);
  for (const el of document.body.querySelectorAll('button,input,[aria-label],[title]')) {
    if (re.test(el.value || '') || re.test(el.getAttribute('aria-label') || '') || re.test(el.getAttribute('title') || '')) cands.push(el);
  }
  if (ar) for (const el of document.body.querySelectorAll('[id],[class]')) if (ar.test(el.id) || ar.test(el.getAttribute('class') || '')) cands.push(el);
  const good = cands.filter((el) => !skip(el));
  document.querySelectorAll('[data-jom-rec]').forEach((e) => e.removeAttribute('data-jom-rec'));
  const pick = good.find((el) => vis(el) && clickOf(el)) || good.find(vis);
  if (!pick) return null;
  const target = clickOf(pick) || pick;
  target.setAttribute('data-jom-rec', '1');
  return { text: (target.textContent || target.value || target.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 50),
    clickable: !!clickOf(pick) };
}

// ---- Coreografías -------------------------------------------------------------
// Cada paso es tolerante: si falta el elemento se anota y se sigue.
// act(accion, ok, detalle, clave) → manifiesto; clave=true marca el "momento clave" del clip.
const COREO = {
  async home(page, act, r) {
    const SEL = '#michi-roaming-entity';
    if (!(await page.$(SEL))) { act('companion', false, 'no hay #michi-roaming-entity'); return; }
    await scrollIntoCenter(page, SEL, 900);
    await r.moveTo(page.viewportSize().width - 60, 60, 500);
    act('companion: pasea', true, 'cursor lejos, el michi camina', true);
    await sleep(3000);
    // Se mueve: se apunta a donde está, y un salto final corto a donde está AHORA.
    let b = await boxOf(page, SEL);
    await r.moveTo(b.x, b.y, 650);
    b = await boxOf(page, SEL);
    await r.moveTo(b.x, b.y, 90);
    await sleep(500);
    const hub = await page.evaluate(() => {
      const h = document.querySelector('.michi-action-hub');
      return h ? (h.checkVisibility ? h.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : true) : null;
    });
    act('companion: hover', hub !== false, hub === null ? 'hover hecho (no hay .michi-action-hub)' : hub ? 'quieto y con su menú visible' : 'el menú no se ve con hover');
    await sleep(2200);
    await r.moveTo(page.viewportSize().width - 60, page.viewportSize().height - 60, 700);
    act('companion: reanuda', true, 'cursor fuera');
    await sleep(1600);
  },

  async '01'(page, act, r) {
    const mounted = await page.waitForFunction(() => [...document.querySelectorAll('.jom-arena')].some((e) => e.jomArena),
      null, { timeout: 20000 }).then(() => true, () => false);
    const sel = await page.evaluate(() => {
      const el = [...document.querySelectorAll('.jom-arena')].find((e) => e.jomArena)
        || document.querySelector('[data-jom-arena],.jom-arena,#gameCanvas');
      if (!el) return null;
      el.setAttribute('data-jom-rec-arena', '1');
      return true;
    });
    if (!sel) { act('arena', false, 'no hay arena ni #gameCanvas'); return; }
    act('arena: montada', mounted, mounted ? 'jomArena lista' : 'no se montó en 20 s; pulso teclas igual');
    await scrollIntoCenter(page, '[data-jom-rec-arena]', 900);
    const b = await boxOf(page, '[data-jom-rec-arena]');
    await r.moveTo(b.left + b.w - 50, b.top + 40, 600);   // el cursor no tapa al personaje
    await page.locator('[data-jom-rec-arena]').focus().catch(() => {});
    const x = () => page.evaluate(() => document.querySelector('[data-jom-rec-arena]').jomArena?.state?.x ?? null);
    const x0 = await x();
    const hold = async (key, ms) => { await page.keyboard.down(key); await sleep(ms); await page.keyboard.up(key); };
    act('arena: ArrowRight', true, 'camina a la derecha', true);
    await hold('ArrowRight', 1400);
    act('arena: ArrowUp', true, 'salta');
    await hold('ArrowUp', 140); await hold('ArrowRight', 700); await sleep(350);
    const x1 = await x();
    act('arena: ArrowLeft', true, 'vuelve a la izquierda');
    await hold('ArrowLeft', 1400);
    await hold('ArrowUp', 140); await hold('ArrowLeft', 600); await sleep(500);
    const x2 = await x();
    if (x0 !== null) act('arena: movimiento', x1 > x0 + 0.05 && x2 < x1 - 0.05, `x ${x0.toFixed(2)} → ${x1.toFixed(2)} → ${x2.toFixed(2)}`);
  },

  async '03'(page, act, r) {
    const host = await page.$('[data-jom-workstation]');
    if (!host) return COREO.boton(page, act, r, 'generar', null, 1);
    const mounted = await page.waitForFunction(() => document.querySelector('[data-jom-workstation]').jomWorkstation,
      null, { timeout: 10000 }).then(() => true, () => false);
    if (!mounted) { act('estación', false, 'no se montó en 10 s'); return; }
    const has = await page.evaluate(() => {
      const h = document.querySelector('[data-jom-workstation]');
      const b = h.querySelector('.jom-ws__btn') || [...h.querySelectorAll('button')].find((x) => /generar/i.test(x.textContent));
      if (b) b.setAttribute('data-jom-rec', '1');
      return !!b;
    });
    await scrollIntoCenter(page, has ? '[data-jom-rec]' : '[data-jom-workstation]', 900);
    await sleep(500);
    const t0 = Date.now();
    if (has) {
      const b = await boxOf(page, '[data-jom-rec]');
      await r.click(b.x, b.y, 700);
      act('estación: generar', true, 'clic en GENERAR', true);
    } else {
      await page.evaluate(() => document.querySelector('[data-jom-workstation]').jomWorkstation.generate());
      act('estación: generar', true, 'sin botón; vía API', true);
    }
    // En un 2.º ciclo phase sigue en 'done' hasta el primer fotograma: se espera a que arranque.
    await page.waitForFunction(() => document.querySelector('[data-jom-workstation]').jomWorkstation.phase !== 'done',
      null, { timeout: 3000 }).catch(() => {});
    await r.moveTo(r.pos.x + 260, r.pos.y + 160, 600);
    const done = await page.waitForFunction(() => document.querySelector('[data-jom-workstation]').jomWorkstation.phase === 'done',
      null, { timeout: 20000 }).then(() => true, () => false);
    act('estación: done', done, done ? `phase 'done' en ${((Date.now() - t0) / 1000).toFixed(1)} s` : 'no llegó a done en 20 s');
    await sleep(2200);
  },

  // 02/04/05/07: pulsar el botón principal si existe.
  async boton(page, act, r, re, attr, veces = 1, nombre = re) {
    const t = await page.evaluate(markButton, [re, attr]);
    if (!t) { act(`botón ${nombre}`, false, `no encuentro ${nombre.toUpperCase()}`); return; }
    await scrollIntoCenter(page, '[data-jom-rec]', 900);
    await sleep(400);
    for (let i = 0; i < veces; i++) {
      const b = await boxOf(page, '[data-jom-rec]');
      if (!b) break;
      if (t.clickable) await r.click(b.x, b.y, i ? 250 : 700);
      else await r.moveTo(b.x, b.y, 700);
      act(`botón ${nombre}`, t.clickable, `${t.clickable ? 'clic' : 'hover (no pulsable)'} en "${t.text}"${veces > 1 ? ` (${i + 1}/${veces})` : ''}`, i === 0);
      await sleep(i < veces - 1 ? 1400 : 600);
    }
    await r.moveTo(r.pos.x + 220, r.pos.y + 120, 500);
    await sleep(2200);
  },
  '02': (p, a, r) => COREO.boton(p, a, r, 'compilar', null, 3, 'COMPILAR'),
  '04': (p, a, r) => COREO.boton(p, a, r, 'pipeline', null, 1, 'PIPELINE'),
  '05': (p, a, r) => COREO.boton(p, a, r, '\\btocar', null, 2, 'TOCAR'),
  '07': (p, a, r) => COREO.boton(p, a, r, 'escaneo', null, 1, 'ESCANEO'),

  // 06: el cursor recorre la moneda (los efectos de hover/tilt se ven en el clip).
  async '06'(page, act, r) {
    const found = await page.evaluate(() => {
      const re = /coin|moneda/i;
      const bad = (el) => el.closest('nav,#mobile-drawer-menu,button,[role=button],#__jom-cursor');
      const big = (el) => { const b = el.getBoundingClientRect(); return b.width >= 40 && b.height >= 40; };
      const cands = [...document.body.querySelectorAll('[id],[class],canvas')]
        .filter((el) => (re.test(el.id) || re.test(el.getAttribute('class') || '')) && !bad(el) && big(el));
      const el = cands[0] || [...document.querySelectorAll('main canvas, canvas')].find((c) => !bad(c) && big(c));
      if (!el) return false;
      el.setAttribute('data-jom-rec-coin', '1');
      return true;
    });
    if (!found) { act('moneda', false, 'no encuentro la moneda (id/class coin|moneda ni canvas)'); return; }
    await scrollIntoCenter(page, '[data-jom-rec-coin]', 900);
    await sleep(300);
    const b = await boxOf(page, '[data-jom-rec-coin]');
    await r.moveTo(b.x, b.y, 700);
    act('moneda: hover', true, 'cursor sobre la moneda', true);
    const rad = Math.max(12, Math.min(b.w, b.h) * 0.32);
    const t0 = Date.now(), VUELTAS_MS = 3000;   // dos vueltas en 3 s (por reloj, ver rig.moveTo)
    for (;;) {
      const k = Math.min(1, (Date.now() - t0) / VUELTAS_MS), a = k * 2 * Math.PI * 2;
      r.pos.x = b.x + Math.cos(a) * rad; r.pos.y = b.y + Math.sin(a) * rad;
      await page.mouse.move(r.pos.x, r.pos.y);
      if (k >= 1) break;
      await sleep(16);
    }
    await r.moveTo(b.x, b.y, 300);
    await sleep(1200);
    act('moneda: recorrido', true, `2 vueltas de radio ${Math.round(rad)} px`);
  },
};

// ---- Grabación de una página ---------------------------------------------------
function probeDuration(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], { encoding: 'utf8' });
  const v = parseFloat((r.stdout || '').trim());
  return r.status === 0 && Number.isFinite(v) ? +v.toFixed(3) : null;
}

async function record(browser, pg, orient, dir) {
  const size = SIZES[orient];
  const tmp = fs.mkdtempSync(path.join(dir, '.grabando-'));
  // Vertical = teléfono real: se graba a 540×960 CSS (diseño móvil: menú ☰, D-Pad, letra
  // legible) y luego se escala ×2 a 1080×1920. Playwright graba al tamaño CSS del visor:
  // grabar a 1080 de ancho mostraría el diseño de escritorio con letra diminuta.
  const movil = size.height > size.width;
  const MOV = { width: 540, height: 960 };
  const ctx = await browser.newContext(movil
    ? { viewport: MOV, deviceScaleFactor: 1, isMobile: true, hasTouch: true, recordVideo: { dir: tmp, size: MOV } }
    : { viewport: size, deviceScaleFactor: 1, recordVideo: { dir: tmp, size } });
  await ctx.route('**/*', async (route) => {
    const u = route.request().url();
    if (!u.startsWith(BASE + '/')) return route.continue();
    try {
      const res = await route.fetch();
      const ext = path.extname(new URL(u).pathname).toLowerCase();
      const headers = { ...res.headers() };
      if (MIME[ext] && res.status() < 400) headers['content-type'] = MIME[ext];
      await route.fulfill({ response: res, headers });
    } catch { await route.continue().catch(() => {}); }
  });
  if (CURSOR) await ctx.addInitScript(cursorInit);
  const page = await ctx.newPage();
  const t0 = Date.now();
  const now = () => +((Date.now() - t0) / 1000).toFixed(2);
  const acciones = [], errores = new Set();
  let clave = null;
  const act = (accion, ok, detalle, esClave = false) => {
    acciones.push({ t: now(), accion, ok: !!ok, detalle });
    if (esClave && clave === null) clave = now();
  };
  page.on('pageerror', (e) => errores.add(cut(first(e), 200)));
  page.on('console', (m) => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) errores.add(cut(m.text(), 200)); });
  const r = rig(page);
  let status = 0;
  try {
    const res = await page.goto(`${BASE}/${encodeURI(pg.file)}`, { waitUntil: 'load', timeout: 30000 });
    status = res ? res.status() : 0;
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.mouse.move(r.pos.x, r.pos.y);
  } catch (e) {
    act('cargar', false, cut(first(e), 160));
  }
  await sleep(700);
  const inicio = now();
  act('lista', status === 200, `HTTP ${status || '—'} · ${pg.file}`);
  await sleep(1000);   // plano de situación
  const fn = COREO[pg.clave];
  for (let ciclo = 1; fn && ciclo <= REPETIR; ciclo++) {
    if (REPETIR > 1) act(`ciclo ${ciclo}/${REPETIR}`, true, ciclo === 1 ? 'coreografía' : 'repite la coreografía');
    try {
      await fn(page, act, r);
    } catch (e) {
      act('coreografía', false, cut(first(e), 160));
    }
    if (ciclo < REPETIR) await sleep(800);
  }
  // Scroll suave: baja hasta el final y vuelve (si la página es más alta que la ventana).
  try {
    const h = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    if (h > 40) {
      await scrollTo(page, h, Math.min(3200, 900 + h * 1.2));
      await sleep(700);
      await scrollTo(page, 0, 1600);
      act('scroll suave', true, `${Math.round(h)} px abajo y arriba`);
    } else act('scroll suave', true, 'la página cabe en la ventana; sin scroll');
  } catch (e) { act('scroll suave', false, cut(first(e), 120)); }
  while (now() - inicio < DURACION) await sleep(100);
  await sleep(400);
  const video = page.video();
  await ctx.close();
  const dest = path.join(dir, `${pg.slug}.webm`);
  await video.saveAs(movil ? dest + '.raw.webm' : dest);
  await video.delete().catch(() => {});
  if (movil) {
    const r = spawnSync(process.env.JOM_FFMPEG || 'ffmpeg', ['-nostdin', '-v', 'error', '-y', '-i', dest + '.raw.webm',
      '-vf', `scale=${size.width}:${size.height}:flags=lanczos`, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '24',
      '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', '-an', dest], { encoding: 'utf8' });
    if (r.status === 0) fs.rmSync(dest + '.raw.webm', { force: true });
    else fs.renameSync(dest + '.raw.webm', dest);  // sin ffmpeg: se queda a 540×960
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  const dur = probeDuration(dest);
  return {
    pagina: pg.slug, clave: pg.clave, nombre: pg.nombre, archivo_html: pg.file,
    clip: path.relative(path.join(OUT, 'clips'), dest).split(path.sep).join('/'),
    orientacion: orient, resolucion: `${size.width}x${size.height}`,
    duracion_s: dur ?? +(now()).toFixed(2), duracion_medida: dur !== null ? 'ffprobe' : 'reloj',
    inicio_util_s: inicio, momento_clave_s: clave ?? inicio, http: status,
    acciones, errores_js: [...errores],
  };
}

// ---- Principal ---------------------------------------------------------------
const pages = discoverPages();
if (!pages.length) die(`No hay páginas que grabar en ${SRC}${SOLO ? ` (--solo ${[...SOLO].join(',')})` : ''}`);
const PW = loadPlaywright();
if (!PW) die('No encuentro Playwright (usa scripts/grabar-protocolos.sh o define JOM_PLAYWRIGHT)');

const CLIPS = path.join(OUT, 'clips');
if (fs.existsSync(CLIPS) && fs.readdirSync(CLIPS).some((f) => /\.webm$|^vertical$|^manifiesto\.json$/.test(f))) {
  const old = path.join(OUT, `clips-${STAMP}`);
  fs.renameSync(CLIPS, old);
  console.log(`  ⚠ ya había clips: los muevo a ${old} (no se borra nada)`);
}
fs.mkdirSync(CLIPS, { recursive: true });

say(`Grabando ${pages.length} página(s) · ${ORIENTS.join(' + ')} · ≥${DURACION} s útiles${REPETIR > 1 ? ` · ${REPETIR} ciclos` : ''} · Playwright ${PW.version}`);
console.log(`  · origen: ${SRC}\n  · clips: ${CLIPS}`);
const browser = await PW.pw.chromium.launch({ args: WEBGL_ARGS });
const clips = [];
let bad = 0;
try {
  for (const orient of ORIENTS) {
    const dir = orient === 'vertical' ? path.join(CLIPS, 'vertical') : CLIPS;
    fs.mkdirSync(dir, { recursive: true });
    for (const pg of pages) {
      process.stdout.write(`  · ${orient === 'vertical' ? '[V] ' : ''}${pg.slug} … `);
      try {
        const c = await record(browser, pg, orient, dir);
        clips.push(c);
        const fails = c.acciones.filter((a) => !a.ok);
        const icon = c.http !== 200 ? '✖' : fails.length ? '⚠' : '✔';
        if (c.http !== 200) bad++;
        console.log(`${icon} ${c.duracion_s}s · ${c.acciones.length} acciones${fails.length ? ` (${fails.length} con aviso: ${fails.map((a) => a.accion).join(', ')})` : ''}`);
      } catch (e) {
        bad++;
        console.log(`✖ ${cut(first(e), 160)}`);
        clips.push({ pagina: pg.slug, clave: pg.clave, orientacion: orient, error: first(e) });
      }
    }
  }
} finally {
  await browser.close();
}

const manifest = {
  herramienta: 'grabar-protocolos', version: 1, generado: new Date().toISOString(),
  src: SRC, base: BASE, playwright: PW.version, duracion_minima_s: DURACION, repetir: REPETIR, cursor: CURSOR,
  nota: 'inicio_util_s: segundo del clip en que la página ya está lista; momento_clave_s: primera acción del protocolo.',
  clips,
};
fs.writeFileSync(path.join(CLIPS, 'manifiesto.json'), JSON.stringify(manifest, null, 2) + '\n');
say(`Listo: ${clips.filter((c) => !c.error).length} clip(s) en ${CLIPS}`);
console.log(`  · manifiesto: ${path.join(CLIPS, 'manifiesto.json')}`);
console.log(`  · siguiente: scripts/montar-youtube.sh --clips "${CLIPS}" [--guion guion.txt] [--musica tema.mp3]`);
process.exit(bad ? 1 : 0);
