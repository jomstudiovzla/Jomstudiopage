#!/usr/bin/env node
// JOM Studio · auditor de la home + 7 protocolos en un Chromium real (Playwright).
//
// Normalmente lo lanza scripts/auditar-protocolos.sh, que sirve SRC en 127.0.0.1.
// A mano:
//   node scripts/auditar_protocolos.mjs --src <carpeta> --base http://127.0.0.1:8088 \
//        [--repo <clon>] [--out <dir>] [--solo page_03_arte_ia.html,index.html]
// Playwright se busca en JOM_PLAYWRIGHT (carpeta del paquete), JOM_AUDIT_PREFIX
// (prefijo de npm), junto a este script o en el node global.
//
// Por página: HTTP 200, errores JS, recursos rotos (locales y CDN), CSP real de
// build_csp.py inyectada como cabecera, scroll horizontal a 375 y 1440, menú
// móvil (cajón, enlaces, página actual, sonido, Escape) y la prueba de función
// de su protocolo. Salida: tabla PASS/WARN/FAIL + auditoria.json + capturas.
// Código de salida: 0 sin FAIL · 1 alguna página da FAIL · 2 no se pudo auditar.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEBGL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const MOBILE = { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const PROTOS = [
  ['01', 'page_01_gamificacion'], ['02', 'page_02_fullstack'], ['03', 'page_03_arte_ia'],
  ['04', 'page_04_automatizacion'], ['05', 'page_05_audio_ugc'], ['06', 'page_06_branding'],
  ['07', 'page_07_consultoria'],
];
const HOME_SLUGS = ['index', 'concept_master_horizontal'];
// Como sync_site de migrar-web-nueva.sh: esto nunca se publica.
const EXCL_DIRS = new Set(['.git', 'node_modules', '_cuarentena', '.wrangler',
  'presupuestos y automatizacion', 'presupuestos_y_automatizacion']);
// Tipos que daría Cloudflare (python3 -m http.server no conoce .glb/.wasm/.mjs en todos los Mac).
const MIME = {
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json', '.webm': 'video/webm', '.mp4': 'video/mp4', '.webp': 'image/webp',
  '.avif': 'image/avif', '.svg': 'image/svg+xml', '.css': 'text/css; charset=utf-8',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.woff2': 'font/woff2',
};
const CSP_MSG = /Content Security Policy|Refused to (load|execute|evaluate|apply|connect|frame|create|compile|run)/i;
const SOUND_RE = /sonido|sound|sfx|audio/i;
const MOVE_PX = 6;   // por debajo, el michi se considera quieto (tolera un "respirar" idle)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (s) => console.log(`\n==> ${s}`);
const die = (s) => { console.error(`\n✖ ${s}`); process.exit(2); };
const first = (e) => String(e?.message ?? e).split('\n')[0].replace(/\s+/g, ' ').trim();
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const ok = (id, msg = '') => ({ id, status: 'PASS', msg });
const warn = (id, msg) => ({ id, status: 'WARN', msg });
const fail = (id, msg) => ({ id, status: 'FAIL', msg });
const ICON = { PASS: '✔', WARN: '⚠', FAIL: '✖' };

// ---- Argumentos -------------------------------------------------------------
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const m = process.argv[i].match(/^--([a-z]+)(?:=(.*))?$/);
  if (!m) die(`Argumento desconocido: ${process.argv[i]}`);
  args[m[1]] = m[2] ?? process.argv[++i];
  if (args[m[1]] === undefined) die(`--${m[1]} necesita un valor`);
}
const SRC = path.resolve(args.src || process.env.SRC || '.');
const BASE = (args.base || process.env.BASE || 'http://127.0.0.1:8088').replace(/\/+$/, '');
const REPO = path.resolve(args.repo || path.join(HERE, '..'));
const d = new Date(), p2 = (n) => String(n).padStart(2, '0');
const STAMP = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
const OUT = path.resolve(args.out || path.join(os.tmpdir(), `jom-auditoria-${STAMP}`));
const SOLO = args.solo ? new Set(args.solo.split(',').map((s) => s.trim()).filter(Boolean)) : null;
if (!fs.existsSync(SRC) || !fs.statSync(SRC).isDirectory()) die(`No existe la carpeta ${SRC}`);

const PAGES = [
  ...(fs.existsSync(path.join(SRC, 'index.html')) ? [{ file: 'index.html', slug: 'index', kind: 'home' }] : []),
  { file: 'concept_master_horizontal.html', slug: 'concept_master_horizontal', kind: 'home' },
  ...PROTOS.map(([n, slug]) => ({ file: `${slug}.html`, slug, kind: n })),
].filter((pg) => !SOLO || SOLO.has(pg.file) || SOLO.has(pg.slug));
if (!PAGES.length) die(`--solo no coincide con ninguna página (${[...SOLO].join(', ')})`);

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

// ---- CSP como la publicaría la migración --------------------------------------
// Copia solo .html/.js (sin medios pesados) y corre scripts/build_csp.py sobre la copia.
function copyCode(from, to, seen, n) {
  let real; try { real = fs.realpathSync(from); } catch { return; }
  if (seen.has(real)) return;
  seen.add(real);
  for (const ent of fs.readdirSync(from, { withFileTypes: true })) {
    const name = ent.name;
    if (name === '.DS_Store' || name.startsWith('catalogo_presentaciones')) continue;
    const a = path.join(from, name);
    let st; try { st = fs.statSync(a); } catch { continue; }
    if (st.isDirectory()) { if (!EXCL_DIRS.has(name)) copyCode(a, path.join(to, name), seen, n); }
    else if (/\.(html|js)$/i.test(name)) {
      fs.mkdirSync(to, { recursive: true });
      fs.copyFileSync(a, path.join(to, name));
      n.count++;
    }
  }
}

function buildCsp() {
  const script = path.join(REPO, 'scripts', 'build_csp.py');
  if (!fs.existsSync(script)) return { policy: null, why: `no encuentro ${script} (pasa --repo)` };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jom-csp-'));
  try {
    const n = { count: 0 };
    copyCode(SRC, tmp, new Set(), n);
    // Desde light-concepts la migración suma lo que conserva del repo: 404.html y el kit.
    if (!fs.existsSync(path.join(SRC, 'scripts', 'build_csp.py'))) {
      if (!fs.existsSync(path.join(tmp, '404.html')) && fs.existsSync(path.join(REPO, '404.html'))) {
        fs.copyFileSync(path.join(REPO, '404.html'), path.join(tmp, '404.html'));
      }
      const kit = path.join(REPO, 'kit');
      if (fs.existsSync(kit)) {
        for (const f of fs.readdirSync(kit).filter((x) => x.endsWith('.js'))) {
          for (const dst of [path.join(tmp, 'kit', f), path.join(tmp, 'assets', 'js', f)]) {
            if (fs.existsSync(dst)) continue;
            fs.mkdirSync(path.dirname(dst), { recursive: true });
            fs.copyFileSync(path.join(kit, f), dst);
          }
        }
      }
    }
    const r = spawnSync('python3', [script, tmp], { encoding: 'utf8' });
    if (r.status !== 0) return { policy: null, why: `build_csp.py falló: ${first(r.stderr || r.error || r.status)}` };
    const headers = fs.readFileSync(path.join(tmp, '_headers'), 'utf8');
    const m = headers.match(/^\s*Content-Security-Policy:\s*(.+)$/m);
    if (!m) return { policy: null, why: '_headers sin línea Content-Security-Policy' };
    const out = r.stdout;
    const handlers = {};
    for (const h of out.matchAll(/aviso: (.+?) tiene (\d+) atributos on\*/g)) handlers[h[1]] = Number(h[2]);
    return {
      policy: m[1].trim(), files: n.count, mode: (out.match(/modo=([\w-]+)/) || [])[1] || '?',
      inline: Number((out.match(/CSP: (\d+) scripts inline/) || [])[1] || 0), handlers,
      notes: out.split('\n').filter((l) => /aviso:/.test(l)).map((l) => l.trim()),
    };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ---- Funciones que corren dentro de la página (autocontenidas) ---------------
function overflowInfo(ref) {
  const de = document.documentElement, b = document.body;
  const sw = Math.max(de.scrollWidth, b ? b.scrollWidth : 0);
  const x0 = scrollX, y0 = scrollY;
  scrollTo(1e6, y0);
  const sx = scrollX;
  scrollTo(x0, y0);
  const over = innerWidth > ref + 1 || sx > 0 || sw > innerWidth + 1;
  const culprits = [];
  if (over && b) {
    const desc = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '')
      + [...el.classList].slice(0, 2).map((c) => '.' + c).join('');
    const skip = (el) => {
      for (let q = el; q && q !== b; q = q.parentElement) {
        const cs = getComputedStyle(q);
        if (cs.position === 'fixed') return true;
        if (q !== el && cs.overflowX !== 'visible') return true;
      }
      return false;
    };
    const bad = new Set();
    for (const el of b.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width && r.right + scrollX > ref + 1 && !skip(el)) bad.add(el);
    }
    for (const el of bad) {
      if (bad.has(el.parentElement)) continue;
      culprits.push([Math.round(el.getBoundingClientRect().right + scrollX - ref), desc(el)]);
    }
    culprits.sort((a, c) => c[0] - a[0]);
  }
  const vp = document.querySelector('meta[name=viewport]');
  return { over, layout: innerWidth, scrollWidth: sw, scrollX: sx, culprits: culprits.slice(0, 3),
    viewportMeta: vp ? vp.getAttribute('content') || '' : null };
}

function drawerState(sel) {
  const el = document.querySelector(sel);
  if (!el) return { exists: false, open: false };
  const cs = getComputedStyle(el);
  const visible = el.checkVisibility
    ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, opacityProperty: true, visibilityProperty: true })
    : cs.display !== 'none' && cs.visibility !== 'hidden';
  const r = el.getBoundingClientRect();
  const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
  const h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
  const area = Math.min(r.width * r.height, innerWidth * innerHeight) || 1;
  const inView = w > 10 && h > 10 && (w * h) / area > 0.4;
  return { exists: true, open: visible && inView && cs.pointerEvents !== 'none', visible, inView };
}

function inspectDrawer([sel, here, homeSlugs, soundSrc]) {
  const d = document.querySelector(sel);
  const soundRe = new RegExp(soundSrc, 'i');
  const slugOf = (href) => {
    if (!href || href.startsWith('#') || /^(javascript|mailto|tel):/i.test(href)) return null;
    try {
      const u = new URL(href, location.href);
      if (u.origin !== location.origin) return null;
      const last = u.pathname.replace(/\/+$/, '').split('/').pop() || '';
      return last.replace(/\.html?$/i, '') || 'index';
    } catch { return null; }
  };
  const isCurrent = (a) => {
    const ac = a.getAttribute('aria-current');
    if (ac && ac !== 'false') return true;
    return a.classList.contains('active') || !!a.parentElement?.classList.contains('active');
  };
  const links = [...d.querySelectorAll('a[href]')].map((a) => ({ slug: slugOf(a.getAttribute('href')), current: isCurrent(a) }))
    .filter((l) => l.slug);
  const home = new Set(homeSlugs);
  const mine = (s) => s === here || (home.has(here) && home.has(s));
  const labelOf = (el) => [el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`), el.closest('label')]
    .filter(Boolean).map((l) => l.textContent).join(' ');
  const textOf = (el) => [el.textContent, el.getAttribute('aria-label'), el.getAttribute('title'), el.id,
    el.getAttribute('class'), el.getAttribute('name'), labelOf(el)].join(' ');
  const ctrlSel = 'button,input[type=checkbox],[role=switch],[role=button],[role=checkbox]';
  const inDrawer = [...d.querySelectorAll(ctrlSel)].find((el) => soundRe.test(textOf(el)));
  const anywhere = inDrawer ? null : [...document.querySelectorAll(ctrlSel)].find((el) => soundRe.test(textOf(el)));
  const desc = (el) => el && (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '')
    + ' "' + (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30) + '"');
  return {
    slugs: [...new Set(links.map((l) => l.slug))],
    currentMarked: links.some((l) => mine(l.slug) && l.current),
    currentLinked: links.some((l) => mine(l.slug)),
    markedOthers: links.filter((l) => l.current && !mine(l.slug)).map((l) => l.slug),
    sound: desc(inDrawer), soundOutside: desc(anywhere),
  };
}

function findTarget([reSrc, attrSrc]) {
  const re = new RegExp(reSrc, 'i'), ar = attrSrc ? new RegExp(attrSrc, 'i') : null;
  const skip = (el) => !el || !!el.closest('script,style,noscript,template,head,nav,#mobile-drawer-menu');
  const cands = [];
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (tw.nextNode()) if (re.test(tw.currentNode.nodeValue)) cands.push(tw.currentNode.parentElement);
  for (const el of document.body.querySelectorAll('button,input,[aria-label],[title]')) {
    if (re.test(el.value || '') || re.test(el.getAttribute('aria-label') || '') || re.test(el.getAttribute('title') || '')) cands.push(el);
  }
  if (ar) {
    for (const el of document.body.querySelectorAll('[id],[class]')) {
      if (ar.test(el.id) || ar.test(el.getAttribute('class') || '')) cands.push(el);
    }
  }
  const good = cands.filter((el) => !skip(el));
  const vis = (el) => (el.checkVisibility ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : true);
  const clickOf = (el) => el.closest('button,[role=button],input[type=button],input[type=submit],a[href],summary,label,[onclick]');
  const navigates = (c) => {
    if (c.tagName === 'A') {
      const h = c.getAttribute('href') || '';
      if (h.startsWith('#') || h.startsWith('javascript:')) return false;
      return c.target === '_blank' || new URL(h, location.href).pathname !== location.pathname;
    }
    return (c.type || '').toLowerCase() === 'submit' && !!c.form;
  };
  const usable = (el) => { const c = clickOf(el); return c && !navigates(c) ? c : null; };
  const pick = good.find((el) => vis(el) && usable(el)) || good.find(vis) || good[0];
  document.querySelectorAll('[data-jom-audit-pick]').forEach((e) => e.removeAttribute('data-jom-audit-pick'));
  if (!pick) return { found: false, onlyNav: cands.length > 0 };
  const target = usable(pick);
  (target || pick).setAttribute('data-jom-audit-pick', '1');
  const c = clickOf(pick);
  return {
    found: true, visible: vis(pick), clickable: !!target,
    isButton: !!(c && c.matches('button,[role=button],input[type=button],input[type=submit]')),
    text: ((target || pick).textContent || pick.value || pick.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 50),
  };
}

// Se inyecta antes que cualquier script de la página (no le afecta la CSP).
function initAudit() {
  const A = (window.__jomAudit = { audio: 0, ctxs: [], plays: 0 });
  addEventListener('securitypolicyviolation', (e) => {
    try {
      window.__jomAuditCsp?.({ dir: e.effectiveDirective || e.violatedDirective, blocked: e.blockedURI,
        src: e.sourceFile, line: e.lineNumber, sample: (e.sample || '').slice(0, 60) });
    } catch { /* nada */ }
  }, true);
  for (const k of ['AudioContext', 'webkitAudioContext']) {
    const O = window[k];
    if (typeof O !== 'function') continue;
    window[k] = new Proxy(O, { construct(t, a, nt) { const c = Reflect.construct(t, a, nt); A.audio++; A.ctxs.push(c); return c; } });
  }
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...a) { if (!this.muted) A.plays++; return play.apply(this, a); };
}

// ---- Registro de eventos por página ------------------------------------------
function newRec() {
  return { status: {}, consoleErrors: new Set(), pageErrors: new Set(), cspConsole: new Set(), cspEvents: new Map(),
    kitWarnings: new Set(), localBad: new Map(), externalBad: new Map(), externalOk: new Set(), externalCritical: new Set(), cspBlocked: new Set() };
}
const isLocal = (u) => u.startsWith(BASE + '/');
const rel = (u) => (isLocal(u) ? u.slice(BASE.length + 1) : u);

function wire(page, rec) {
  page.on('console', (m) => {
    const t = m.text();
    if (CSP_MSG.test(t)) rec.cspConsole.add(cut(t, 220));
    else if (m.type() === 'error' && !/^Failed to load resource/.test(t)) rec.consoleErrors.add(cut(t, 220));
    else if (m.type() === 'warning' && /^\[jom-/.test(t)) rec.kitWarnings.add(cut(t, 160));
  });
  page.on('pageerror', (e) => rec.pageErrors.add(cut(first(e), 220)));
  // Externos que, si fallan, rompen funciones (scripts/módulos, GLB por fetch…), no solo imágenes.
  const critical = (r, u) => {
    if (!isLocal(u) && /^(script|fetch|xhr)$/.test(r.resourceType())) rec.externalCritical.add(new URL(u).host);
  };
  page.on('requestfailed', (r) => {
    const u = r.url(), err = r.failure()?.errorText || 'error';
    if (!/^https?:/.test(u) || err === 'net::ERR_ABORTED') return;   // abortada por el propio navegador
    // Chromium marca 'csp' lo que bloquea la política: es violación, no caída de red.
    if (/BLOCKED_BY_CSP|^csp$/i.test(err)) { rec.cspBlocked.add(`bloqueado por CSP: ${u}`); return; }
    (isLocal(u) ? rec.localBad : rec.externalBad).set(u, err);
    critical(r, u);
  });
  page.on('response', (r) => {
    const u = r.url();
    if (!/^https?:/.test(u)) return;
    if (r.status() >= 400) { (isLocal(u) ? rec.localBad : rec.externalBad).set(u, `HTTP ${r.status()}`); critical(r.request(), u); }
    else if (!isLocal(u)) rec.externalOk.add(new URL(u).host);
  });
}

async function withContext(browser, opts, rec, CSP, fn) {
  const ctx = await browser.newContext(opts);
  try {
    await ctx.exposeBinding('__jomAuditCsp', (_src, v) => {
      rec.cspEvents.set(`${v.dir} ${v.blocked} ${v.src}:${v.line}`, v);
    });
    await ctx.addInitScript(initAudit);
    await ctx.route('**/*', async (route) => {
      const url = route.request().url();
      if (!isLocal(url)) return route.continue().catch(() => {});
      try {
        const res = await route.fetch();
        const headers = { ...res.headers(), 'x-content-type-options': 'nosniff' };
        if (CSP) headers['content-security-policy'] = CSP;
        const ext = path.extname(new URL(url).pathname).toLowerCase();
        if (MIME[ext] && res.status() < 400) headers['content-type'] = MIME[ext];
        await route.fulfill({ response: res, headers });
      } catch { await route.abort().catch(() => {}); }
    });
    const page = await ctx.newPage();
    wire(page, rec);
    let timer;
    const limit = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('la página no respondió en 150 s')), 150000); });
    const work = fn(page);
    work.catch(() => {});   // si vence el límite, lo pendiente falla al cerrar el contexto
    try { return await Promise.race([work, limit]); } finally { clearTimeout(timer); }
  } finally {
    await ctx.close().catch(() => {});
  }
}

async function load(page, url, rec, label) {
  const r = await page.goto(url, { waitUntil: 'load', timeout: 45000 });
  rec.status[label] = r ? r.status() : 0;
  await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
  await sleep(700);
  return rec.status[label];
}

async function poll(fn, ms, step = 100) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > ms) return null;
    await sleep(step);
  }
}

function overflowCheck(info, width) {
  const id = `scroll ${width}`;
  if (!info.over) return ok(id, 'sin desbordes');
  const who = info.culprits.map(([px, sel]) => `${sel} +${px}px`).join(', ');
  const how = info.layout > width + 1 ? `la página mide ${info.layout}px` : `scrollWidth ${info.scrollWidth}px`;
  return fail(id, `scroll horizontal (${how})${who ? ': ' + who : ''}`);
}

// ---- Menú móvil ---------------------------------------------------------------
async function testMenu(page, pg, shot) {
  const out = [];
  const hb = page.locator('.btn-mobile-hamburger');
  const n = await hb.count();
  if (!n) return [fail('menú', 'no hay .btn-mobile-hamburger')];
  let btn = null;
  for (let i = 0; i < n && !btn; i++) if (await hb.nth(i).isVisible()) btn = hb.nth(i);
  if (!btn) return [fail('menú', '.btn-mobile-hamburger existe pero no se ve a 375 px')];
  const SEL = '#mobile-drawer-menu';
  const st = () => page.evaluate(drawerState, SEL);
  const s0 = await st();
  if (!s0.exists) return [fail('menú', 'no hay #mobile-drawer-menu')];
  if (s0.open) out.push(warn('menú', 'el cajón ya se ve antes de pulsar la hamburguesa'));
  try { await btn.tap({ timeout: 5000 }); } catch { try { await btn.click({ timeout: 5000 }); } catch (e) { return [...out, fail('menú', `no se puede pulsar la hamburguesa: ${cut(first(e), 140)}`)]; } }
  const opened = await poll(async () => (await st()).open, 2000);
  if (!opened) return [...out, fail('menú', 'tras pulsar, #mobile-drawer-menu no aparece en pantalla')];
  out.push(ok('menú: cajón', 'abre al pulsar'));
  await shot('375-menu');
  const info = await page.evaluate(inspectDrawer, [SEL, pg.slug, HOME_SLUGS, SOUND_RE.source]);
  const missing = PROTOS.map(([, s]) => s).filter((s) => !info.slugs.includes(s));
  if (!info.slugs.some((s) => HOME_SLUGS.includes(s))) missing.unshift('home');
  if (missing.length) {
    const near = missing.map((s) => {
      const alt = info.slugs.find((x) => x !== s && x.startsWith(s.slice(0, 7)) && s.startsWith('page_'));
      return alt ? `${s} (enlaza a ${alt})` : s;
    });
    out.push(fail('menú: enlaces', `faltan: ${near.join(', ')}`));
  } else out.push(ok('menú: enlaces', 'home + 7 protocolos'));
  if (info.currentMarked) out.push(ok('menú: actual', 'marcada'));
  else if (!info.currentLinked) out.push(fail('menú: actual', 'el cajón no enlaza a esta página'));
  else out.push(fail('menú: actual', `su enlace no tiene aria-current ni .active${info.markedOthers.length ? ` (marcado: ${info.markedOthers.join(', ')})` : ''}`));
  if (info.sound) out.push(ok('menú: sonido', info.sound));
  else if (info.soundOutside) out.push(warn('menú: sonido', `está fuera del cajón: ${info.soundOutside}`));
  else out.push(fail('menú: sonido', 'no hay control de sonido (botón/checkbox con sonido|sound|sfx|audio)'));
  await page.keyboard.press('Escape');
  const closed = await poll(async () => !(await st()).open, 2000);
  out.push(closed ? ok('menú: Escape', 'cierra') : warn('menú: Escape', 'Escape no cierra el cajón'));
  return out;
}

// ---- Pruebas de función -------------------------------------------------------
// Reacción al clic: nodos del DOM que cambian y que NO cambiaban ya solos (animaciones),
// o bastantes más mutaciones que en reposo, o audio nuevo.
async function clickAndWatch(page) {
  const snap = (stage) => page.evaluate((stage) => {
    const A = window.__jomAudit || (window.__jomAudit = { audio: 0, ctxs: [], plays: 0 });
    if (!A.mo) {
      A.cur = []; A.base = new Set();
      A.mo = new MutationObserver((l) => { for (const r of l) A.cur.push(r.target); });
      A.mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    }
    const recs = A.cur; A.cur = [];
    if (stage === 'base') recs.forEach((t) => A.base.add(t));
    const idle = (t) => A.base.has(t) || (t.nodeType !== 1 && A.base.has(t.parentNode));
    return { mut: recs.length, fresh: new Set(recs.filter((t) => !idle(t))).size, audio: A.audio, plays: A.plays };
  }, stage);
  await snap('start');
  await sleep(800);
  const base = await snap('base');
  await page.locator('[data-jom-audit-pick]').first().click({ timeout: 4000 });
  await sleep(1500);
  const after = await snap('after');
  const expected = base.mut * (1500 / 800);
  return {
    changes: after.mut, fresh: after.fresh,
    reacted: after.fresh > 0 || after.mut > expected * 1.5 + 2 || after.audio > base.audio || after.plays > base.plays,
  };
}

async function testText(page, id, label, re, attr, { button = false } = {}) {
  const t = await page.evaluate(findTarget, [re, attr || null]);
  if (!t.found) return [warn(id, t.onlyNav ? `"${label}" solo aparece en el menú` : `no encuentro el texto ${label}`)];
  if (button && !t.isButton) return [warn(id, `"${t.text}" existe pero no es un botón`)];
  if (!t.clickable) return [ok(id, `texto presente: "${t.text}"`)];
  try {
    const r = await clickAndWatch(page);
    const canvas = await page.evaluate(() => !!document.querySelector('canvas'));
    return [r.reacted ? ok(id, `"${t.text}" responde al clic (${r.fresh} nodo(s) nuevos cambiados, ${r.changes} mutaciones)`)
      : warn(id, `"${t.text}" no cambia el DOM al pulsarlo${canvas ? ' (si solo cambia un canvas, revísalo en la captura)' : ''}`)];
  } catch (e) {
    return [warn(id, `no pude pulsar "${t.text}": ${cut(first(e), 120)}`)];
  }
}

async function testArena(page) {
  const id = 'función 01 (arena)';
  const has = await page.evaluate(() => ({
    host: !!document.querySelector('[data-jom-arena],.jom-arena,.jom-arena--overlay'),
    script: !!document.querySelector('script[src*="jom-arena"]'),
  }));
  if (!has.host && !has.script) return [warn(id, 'no hay .jom-arena ni assets/js/jom-arena.js (¿falta integrar el kit?)')];
  const mounted = await page.waitForFunction(() => [...document.querySelectorAll('.jom-arena')].some((e) => e.jomArena),
    null, { timeout: 25000 }).then(() => true, () => false);
  if (!mounted) return [fail(id, 'la arena no terminó de montarse en 25 s (mira errores JS / three)')];
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('.jom-arena')].find((e) => e.jomArena);
    el.setAttribute('data-jom-audit-arena', '1');
    el.scrollIntoView({ block: 'center' });
  });
  const arena = page.locator('[data-jom-audit-arena]');
  await arena.focus();
  await sleep(400);
  const state = () => page.evaluate(() => document.querySelector('[data-jom-audit-arena]').jomArena.state);
  const s0 = await state();
  await page.keyboard.down('ArrowRight');
  await sleep(600);
  await page.keyboard.up('ArrowRight');
  await sleep(150);
  const s1 = await state();
  const out = [];
  // WEBGL_ARGS fuerza SwiftShader (WebGL por software): ese FPS no es el de la GPU del Mac.
  if (s1.x > s0.x + 0.05) out.push(ok(id, `→ 600 ms: x ${s0.x.toFixed(2)} → ${s1.x.toFixed(2)} · ${s1.fps || '?'} FPS con SwiftShader (software; no es el FPS de tu GPU)`));
  else out.push(fail(id, `ArrowRight no mueve al personaje (x ${s0.x.toFixed(2)} → ${s1.x.toFixed(2)}${s1.visible ? '' : ', arena fuera de pantalla'})`));
  if (!s1.modelLoaded) out.push(warn('arena: GLB', 'el modelo no cargó; se ve la cápsula de reserva'));
  return out;
}

async function testWorkstation(page) {
  const id = 'función 03 (estación)';
  if (!(await page.$('[data-jom-workstation]'))) return [warn(id, 'no hay [data-jom-workstation]')];
  const mounted = await page.waitForFunction(() => document.querySelector('[data-jom-workstation]').jomWorkstation,
    null, { timeout: 10000 }).then(() => true, () => false);
  if (!mounted) return [fail(id, 'no se montó en 10 s (¿carga assets/js/jom-workstation.js?)')];
  const hasBtn = await page.evaluate(() => {
    const h = document.querySelector('[data-jom-workstation]');
    const b = h.querySelector('.jom-ws__btn') || [...h.querySelectorAll('button')].find((x) => /generar/i.test(x.textContent));
    if (b) { b.setAttribute('data-jom-audit-gen', '1'); b.scrollIntoView({ block: 'center' }); }
    return !!b;
  });
  const t0 = Date.now();
  if (hasBtn) await page.locator('[data-jom-audit-gen]').click({ timeout: 5000 });
  else await page.evaluate(() => document.querySelector('[data-jom-workstation]').jomWorkstation.generate());
  const done = await page.waitForFunction(() => document.querySelector('[data-jom-workstation]').jomWorkstation.phase === 'done',
    null, { timeout: 15000 }).then(() => true, () => false);
  const out = [];
  if (done) out.push(ok(id, `generar → phase 'done' en ${((Date.now() - t0) / 1000).toFixed(1)} s${hasBtn ? '' : ' (sin botón; vía API)'}`));
  else out.push(fail(id, `tras 15 s phase = '${await page.evaluate(() => document.querySelector('[data-jom-workstation]').jomWorkstation.phase)}'`));
  // Al terminar, el kit cambia al clip del café: se le da tiempo a cargar antes de juzgar.
  const media = await page.evaluate(() => {
    const a = document.querySelector('[data-jom-workstation] .jom-ws__char video, [data-jom-workstation] .jom-ws__char img');
    if (!a) return null;
    const src = () => (a.currentSrc || a.src).split('/').pop().split('?')[0];
    const loaded = () => (a.tagName === 'VIDEO' ? a.readyState >= 2 : a.complete && a.naturalWidth > 0);
    return new Promise((resolve) => {
      const t0 = performance.now();
      (function check() {
        const err = a.tagName === 'VIDEO' && a.error ? `error ${a.error.code}` : '';
        if (loaded() || err || performance.now() - t0 > 5000) resolve({ loaded: loaded(), src: src(), err });
        else setTimeout(check, 100);
      })();
    });
  });
  if (media && !media.loaded) out.push(warn('estación: video', `el personaje no cargó (${media.src}${media.err ? ', ' + media.err : ''})`));
  return out;
}

async function testAudio(page) {
  const id = 'función 05 (audio)';
  const t = await page.evaluate(findTarget, ['\\btocar', null]);
  if (!t.found) return [warn(id, t.onlyNav ? '"TOCAR" solo aparece en el menú' : 'no encuentro el texto TOCAR')];
  if (t.clickable) {
    try { await page.locator('[data-jom-audit-pick]').first().click({ timeout: 4000 }); } catch (e) {
      return [warn(id, `no pude pulsar "${t.text}": ${cut(first(e), 120)}`)];
    }
    await sleep(800);
  }
  const a = await page.evaluate(() => {
    const A = window.__jomAudit || { ctxs: [], plays: 0 };
    return { api: typeof window.AudioContext === 'function' || typeof window.webkitAudioContext === 'function',
      states: A.ctxs.map((c) => c.state), plays: A.plays };
  });
  if (!a.api) return [fail(id, 'tras el clic no existe window.AudioContext ni webkitAudioContext')];
  if (!t.clickable) return [warn(id, `"${t.text}" no es pulsable; AudioContext disponible`)];
  if (a.states.includes('running') || a.plays) return [ok(id, `"${t.text}" → ${a.states.includes('running') ? 'AudioContext running' : `${a.plays} play() de audio`}`)];
  return [warn(id, `"${t.text}" no puso audio en marcha (AudioContext: ${a.states.join(', ') || 'ninguno'})`)];
}

async function testMichi(page) {
  const SEL = '#michi-roaming-entity';
  if (!(await page.$(SEL))) return [warn('michi', 'no hay #michi-roaming-entity')];
  const pos = () => page.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  }, SEL);
  const maxMove = async (ms) => {
    const a = await pos();
    let m = 0;
    for (let t = 0; t < ms; t += 250) { await sleep(250); const b = await pos(); m = Math.max(m, Math.hypot(b.x - a.x, b.y - a.y)); }
    return Math.round(m);
  };
  await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center', inline: 'nearest' }), SEL);
  await page.mouse.move(1, 1);
  await sleep(300);
  const out = [];
  const moving = await maxMove(1000);
  if (moving <= MOVE_PX) out.push(warn('michi: paseo', `no se mueve sin hover (${moving}px en 1 s)`));
  else out.push(ok('michi: paseo', `${moving}px en 1 s`));
  // Punto del michi que no tape otro elemento; se mueve, así que se apunta y se entra enseguida.
  const target = await page.evaluate((s) => {
    const el = document.querySelector(s), r = el.getBoundingClientRect();
    for (const [fx, fy] of [[0.5, 0.5], [0.5, 0.35], [0.35, 0.6], [0.65, 0.6], [0.5, 0.75]]) {
      const x = r.left + r.width * fx, y = r.top + r.height * fy;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
      const hit = document.elementFromPoint(x, y);
      if (hit && (el === hit || el.contains(hit))) return { x, y };
    }
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { blocked: hit ? hit.tagName.toLowerCase() + (hit.id ? '#' + hit.id : '') + (hit.className && typeof hit.className === 'string' ? '.' + hit.className.split(' ')[0] : '') : 'fuera de la vista' };
  }, SEL);
  if (target.blocked) return [...out, warn('michi: hover', `no se puede apuntar al michi (${target.blocked})`)];
  await page.mouse.move(target.x, target.y);
  await sleep(250);
  const still = await maxMove(1500);
  if (moving > MOVE_PX) {
    out.push(still <= MOVE_PX ? ok('michi: pausa', `quieto con hover (${still}px en 1,5 s)`)
      : fail('michi: pausa', `sigue moviéndose con hover (${still}px en 1,5 s)`));
  }
  const hub = await page.evaluate(() => {
    const h = document.querySelector('.michi-action-hub');
    if (!h) return null;
    const r = h.getBoundingClientRect();
    return (h.checkVisibility ? h.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : true) && r.width > 0 && r.height > 0;
  });
  if (hub === null) out.push(warn('michi: hub', 'no hay .michi-action-hub'));
  else out.push(hub ? ok('michi: hub', 'visible con hover') : fail('michi: hub', '.michi-action-hub no se ve con hover'));
  const vp = page.viewportSize();
  await page.mouse.move(target.x < vp.width / 2 ? vp.width - 2 : 2, vp.height - 2);
  await sleep(400);
  if (moving > MOVE_PX) {
    const again = await maxMove(1200);
    out.push(again > MOVE_PX ? ok('michi: reanuda', `${again}px tras salir`) : warn('michi: reanuda', 'no vuelve a moverse al quitar el ratón'));
  }
  return out;
}

const FUNC = {
  home: testMichi,
  '01': testArena,
  '02': (p) => testText(p, 'función 02 (compilar)', 'COMPILAR', 'compilar', null, { button: true }),
  '03': testWorkstation,
  '04': (p) => testText(p, 'función 04 (pipeline)', 'PIPELINE', 'pipeline'),
  '05': testAudio,
  '06': (p) => testText(p, 'función 06 (moneda)', 'MONEDA/coin', 'moneda|\\bcoins?\\b', 'coin|moneda'),
  '07': (p) => testText(p, 'función 07 (escaneo)', 'ESCANEO', 'escaneo'),
};

// ---- Página completa ----------------------------------------------------------
async function auditPage(browser, pg, csp, mobileUA) {
  const res = { file: pg.file, checks: [], errors: {}, external: [], shots: [] };
  if (!fs.existsSync(path.join(SRC, pg.file))) {
    res.checks.push(fail('archivo', `falta ${pg.file}`));
    return finalize(res);
  }
  const rec = newRec();
  const url = `${BASE}/${pg.file}`;
  const shot = (page, tag) => async (suffix = tag) => {
    const f = path.join(OUT, 'capturas', `${pg.slug}-${suffix}.png`);
    try { await page.screenshot({ path: f, timeout: 10000 }); res.shots.push(f); } catch { /* sin captura */ }
  };
  const C = res.checks;
  const guard = async (label, fn) => {
    try { await fn(); } catch (e) { C.push(fail('auditoría', `${label}: ${cut(first(e), 160)}`)); }
  };

  await guard('escritorio', () => withContext(browser, DESKTOP, rec, csp.policy, async (page) => {
    if ((await load(page, url, rec, '1440')) !== 200) return;
    C.push(overflowCheck(await page.evaluate(overflowInfo, 1440), 1440));
    await shot(page, '1440')();
    C.push(...(await FUNC[pg.kind](page)));
    await sleep(300);
  }));
  await guard('móvil', () => withContext(browser, { ...MOBILE, userAgent: mobileUA }, rec, csp.policy, async (page) => {
    if ((await load(page, url, rec, '375')) !== 200) return;
    const info = await page.evaluate(overflowInfo, 375);
    C.push(overflowCheck(info, 375));
    if (info.viewportMeta === null || !/width\s*=\s*device-width/i.test(info.viewportMeta)) {
      C.push(warn('viewport', 'falta <meta name="viewport" content="width=device-width, initial-scale=1">'));
    }
    await shot(page, '375')();
    C.push(...(await testMenu(page, pg, shot(page, '375-menu'))));
    await sleep(300);
  }));

  const codes = Object.entries(rec.status);
  const bad = codes.filter(([, c]) => c !== 200);
  C.unshift(!codes.length ? fail('HTTP', 'no se pudo cargar')
    : bad.length ? fail('HTTP', bad.map(([w, c]) => `${c} a ${w} px`).join(', ')) : ok('HTTP', '200'));

  const js = [...rec.pageErrors, ...rec.consoleErrors];
  const ext = [...rec.externalBad].map(([u, e]) => `${new URL(u).host} (${e})`);
  const cdn = [...rec.externalCritical].join(', ');
  const cause = cdn ? ` — puede deberse a la CDN de scripts sin respuesta (${cdn})` : '';
  C.push(js.length ? fail('JS', `${js.length} error(es): ${cut(js[0], 150)}${cause}`) : ok('JS', 'sin errores'));
  const local = [...rec.localBad].map(([u, e]) => `${e.replace('HTTP ', '')} ${rel(u)}`);
  C.push(local.length ? fail('recursos', `${local.length} roto(s): ${cut(local.slice(0, 3).join(', '), 180)}`) : ok('recursos', 'todos cargan'));
  if (ext.length) {
    C.push(fail('red externa', `no responde: ${cut([...new Set(ext)].join(', '), 180)}`));
    // Una CDN de scripts caída explica las pruebas de función que fallan: se dice en cada una.
    for (const c of C) {
      if (cause && c.status === 'FAIL' && /^(función|michi|arena|estación|auditoría)/.test(c.id)) c.msg += cause;
    }
  } else C.push(ok('red externa', rec.externalOk.size ? `OK: ${[...rec.externalOk].join(', ')}` : 'no usa'));
  if (rec.kitWarnings.size) C.push(warn('kit', cut([...rec.kitWarnings][0], 160)));

  const ev = [...rec.cspEvents.values()];
  // Evento y mensaje de consola son la misma violación; el bloqueo de red solo cuenta si no hay otra pista.
  const nCsp = Math.max(ev.length, rec.cspConsole.size) || rec.cspBlocked.size;
  // La migración exige modo=hashes: un solo on*= hace que build_csp.py baje TODA la web a 'unsafe-inline'.
  const culprits = Object.keys(csp.handlers || {});
  if (!csp.policy) C.push(warn('CSP', `sin comprobar: ${csp.why}`));
  else {
    if (nCsp) {
      const what = ev.length ? ev.map((v) => `${v.dir} ${v.blocked || 'inline'}${v.sample ? ` «${v.sample}»` : ''}`)
        : rec.cspConsole.size ? [...rec.cspConsole] : [...rec.cspBlocked];
      C.push(fail('CSP', `${nCsp} violación(es): ${cut([...new Set(what)].slice(0, 3).join(' | '), 220)}`));
    }
    if (csp.handlers[pg.file]) {
      C.push(fail('CSP: on*=', `${csp.handlers[pg.file]} atributo(s) on*= (onclick…) bajan TODA la web a 'unsafe-inline'; pásalos a addEventListener`));
    } else if (csp.mode !== 'hashes') {
      C.push(warn('CSP: modo', `${nCsp ? '' : 'sin violaciones, pero '}modo ${csp.mode} por ${culprits.length ? `on*= en ${cut(culprits.join(', '), 120)}` : 'exceso de hashes para una línea de _headers'}`));
    } else if (!nCsp) C.push(ok('CSP', 'sin violaciones (hashes)'));
  }

  res.errors = { js, csp: ev.length ? ev : [...rec.cspConsole, ...rec.cspBlocked], recursos: local, externos: ext };
  res.external = [...rec.externalOk];
  return finalize(res);
}

function finalize(res) {
  const rank = { FAIL: 0, WARN: 1, PASS: 2 };
  res.verdict = res.checks.some((c) => c.status === 'FAIL') ? 'FAIL' : res.checks.some((c) => c.status === 'WARN') ? 'WARN' : 'PASS';
  res.reasons = res.checks.filter((c) => c.status !== 'PASS').sort((a, b) => rank[a.status] - rank[b.status]).map((c) => `${c.id}: ${c.msg}`);
  return res;
}

// ---- Principal ----------------------------------------------------------------
const PW = loadPlaywright();
if (!PW) die('No encuentro el paquete playwright (usa scripts/auditar-protocolos.sh o define JOM_PLAYWRIGHT=<carpeta>)');
fs.mkdirSync(path.join(OUT, 'capturas'), { recursive: true });

say(`Auditoría de ${PAGES.length} páginas`);
console.log(`  · origen: ${SRC}`);
console.log(`  · servidor: ${BASE}`);
const csp = buildCsp();
if (csp.policy) {
  console.log(`  · CSP de build_csp.py (${csp.files} .html/.js copiados): modo=${csp.mode}, ${csp.inline} scripts inline`);
  for (const n of csp.notes) console.log(`  ⚠ ${n}`);
} else console.log(`  ⚠ CSP sin comprobar: ${csp.why}`);

let browser;
try {
  browser = await PW.pw.chromium.launch({ args: WEBGL_ARGS });
} catch (e) {
  die(`Chromium no arranca: ${first(e)}\n  Instálalo con: node "${path.join(PW.dir, 'cli.js')}" install chromium`);
}
const chromeVersion = browser.version();
console.log(`  · playwright ${PW.version} · Chromium ${chromeVersion}`);
const mobileUA = `Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Mobile Safari/537.36`;

const results = [];
try {
  for (const pg of PAGES) {
    const t0 = Date.now();
    const r = await auditPage(browser, pg, csp, mobileUA);
    r.seconds = Math.round((Date.now() - t0) / 100) / 10;
    results.push(r);
    console.log(`  ${ICON[r.verdict]} ${r.file.padEnd(32)} ${r.verdict} (${r.seconds} s)`);
  }
} finally {
  await browser.close().catch(() => {});
}

say('Resultado');
const w = Math.max(...results.map((r) => r.file.length)) + 2;
console.log(`  ${'PÁGINA'.padEnd(w)}${'VEREDICTO'.padEnd(11)}MOTIVO`);
for (const r of results) {
  const m = r.reasons.length ? r.reasons.slice(0, 2).join('; ') + (r.reasons.length > 2 ? ` (+${r.reasons.length - 2})` : '') : '—';
  console.log(`  ${r.file.padEnd(w)}${`${ICON[r.verdict]} ${r.verdict}`.padEnd(11)}${cut(m, 120)}`);
}
const bad = results.filter((r) => r.verdict !== 'PASS');
if (bad.length) {
  say('Detalle');
  for (const r of bad) {
    console.log(`  ${r.file}`);
    for (const c of r.checks.filter((x) => x.status !== 'PASS')) console.log(`    ${ICON[c.status]} ${c.id}: ${cut(c.msg, 300)}`);
  }
}
const count = (v) => results.filter((r) => r.verdict === v).length;
const summary = { PASS: count('PASS'), WARN: count('WARN'), FAIL: count('FAIL') };
const jsonPath = path.join(OUT, 'auditoria.json');
fs.writeFileSync(jsonPath, JSON.stringify({
  fecha: new Date().toISOString(), origen: SRC, servidor: BASE, playwright: PW.version, chromium: chromeVersion,
  csp: { politica: csp.policy, modo: csp.mode, scriptsInline: csp.inline, avisos: csp.notes, motivo: csp.why },
  resumen: summary, paginas: results,
}, null, 2));
console.log(`\n  ${summary.PASS} PASS · ${summary.WARN} WARN · ${summary.FAIL} FAIL`);
console.log(`  JSON: ${jsonPath}`);
console.log(`  Capturas: ${path.join(OUT, 'capturas')}`);
process.exit(summary.FAIL ? 1 : 0);
