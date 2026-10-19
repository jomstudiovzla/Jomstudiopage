#!/usr/bin/env node
// JOM Studio · auditor de MÓVIL: lo que el scroll horizontal no ve.
//
// Una página puede no tener scroll lateral (overflow-x: hidden) y aun así cortar
// contenido. Este auditor mide, en un Chromium táctil a 360/390/430 px:
//   FAIL  fuera     elementos con texto o imagen que se salen de la pantalla
//                   (salvo dentro de un carrusel con overflow-x: auto/scroll)
//   FAIL  scroll    scroll horizontal de la página
//   FAIL  contraste botones y enlaces con texto ilegible (< 3:1); WARN entre 3 y 4.5 (WCAG AA)
//   FAIL  cursor    cursor personalizado visible en una pantalla táctil
//   FAIL  cabecera  elementos de la cabecera fija que se tapan entre sí (logo bajo otra barra)
//   FAIL  js        errores de JavaScript
//   WARN  toque     botones o enlaces de menos de 40×40 px
//   WARN  letra     texto de menos de 12 px
//   WARN  tapa      barras fijas abajo que tapan más del 18 % de la pantalla
//
// Uso:
//   node scripts/auditar_movil.mjs --url https://staging.jomstudio.pages.dev/ [--url …]
//   node scripts/auditar_movil.mjs --src <carpeta> [--paginas index.html,page_02_fullstack.html]
//   [--out <dir>] [--anchos 360,390,430]
// Playwright: JOM_PLAYWRIGHT (carpeta del paquete), ${TMPDIR}/jom-audit-node (lo instala
// auditar-protocolos.sh la primera vez) o el node global.
// Salida: tabla, movil.json y capturas en --out. Código: 0 sin FAIL · 1 con FAIL · 2 no se pudo auditar.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const opt = (k, def) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : def; };
const todas = (k) => args.flatMap((a, i) => (a === k ? [args[i + 1]] : []));
const OUT = path.resolve(opt('--out', 'auditoria-movil'));
const ANCHOS = opt('--anchos', '360,390,430').split(',').map(Number);
const SRC = opt('--src');

function cargarPlaywright() {
  const candidatos = [process.env.JOM_PLAYWRIGHT,
    path.join(process.env.TMPDIR || os.tmpdir(), 'jom-audit-node', 'node_modules', 'playwright'),
    '/opt/node-tools/node_modules/playwright'].filter(Boolean);
  const req = createRequire(import.meta.url);
  for (const c of candidatos) { try { return req(c); } catch (_) { /* siguiente */ } }
  try { return req('playwright'); } catch (_) { return null; }
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.webm': 'video/webm',
  '.mp4': 'video/mp4', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };

function servir(raiz) {
  return new Promise((ok) => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]);
      let f = path.join(raiz, rel);
      if (!f.startsWith(raiz)) { res.writeHead(403); return res.end(); }
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
      if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => ok(srv));
  });
}

// Se ejecuta DENTRO de la página.
function medir(ancho) {
  // el ancho del dispositivo, no innerWidth: en móvil Chrome ensancha la vista si algo se desborda
  const vw = ancho, vh = window.innerHeight;
  const visible = (e) => {
    const s = getComputedStyle(e);
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
    const r = e.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const nombre = (e) => {
    const id = e.id ? '#' + e.id : '';
    const cl = typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    return (e.tagName.toLowerCase() + id + cl).slice(0, 70);
  };
  const texto = (e) => (e.innerText || e.getAttribute('aria-label') || e.alt || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const enCarrusel = (e) => {
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if ((ox === 'auto' || ox === 'scroll') && p.scrollWidth > p.clientWidth) return true;
    }
    return false;
  };
  const animado = (e) => { // cintas, marquesinas y carruseles que se mueven solos: recortados a propósito
    for (let p = e; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.animationName && s.animationName !== 'none') return true;
      if (p.getAnimations && p.getAnimations().some((a) => a.playState === 'running')) return true;
    }
    return false;
  };
  const oculto = (e) => { // recortado a propósito por un padre con overflow hidden/clip dentro de la pantalla
    const r = e.getBoundingClientRect();
    for (let p = e.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const s = getComputedStyle(p);
      if ((s.overflowX === 'hidden' || s.overflowX === 'clip') && p !== document.body) {
        const q = p.getBoundingClientRect();
        if (q.left >= -1 && q.right <= vw + 1 && (r.right <= q.left || r.left >= q.right)) return true;
        // una pista mucho más ancha que la pantalla dentro de una caja que la recorta: es un carrusel
        if (q.left >= -1 && q.right <= vw + 1 && r.width > vw * 1.5) return true;
      }
    }
    return false;
  };
  const rgba = (c) => { const m = c.match(/[\d.]+/g); return m ? m.map(Number).concat([1]).slice(0, 4) : [0, 0, 0, 0]; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fondo = (e) => { // solo el fondo del propio botón o de 2 cajas por encima: más lejos puede haber una foto encima
    let n = 0;
    for (let p = e; p && n < 3 && p !== document.body && p !== document.documentElement; p = p.parentElement, n++) {
      const s = getComputedStyle(p);
      if (s.backgroundImage && s.backgroundImage !== 'none') return null; // degradado o imagen: no medible
      const c = rgba(s.backgroundColor);
      if (c[3] > 0.5) return c;
    }
    return null;
  };
  const fallos = [], avisos = [];
  const todos = [...document.querySelectorAll('body *')].filter((e) => !['SCRIPT', 'STYLE', 'NOSCRIPT', 'BR'].includes(e.tagName));
  if (document.documentElement.scrollWidth > vw + 1) fallos.push(['scroll', 'página', `${document.documentElement.scrollWidth}px de ancho en ${vw}px`]);
  const vistos = new Set();
  for (const e of todos) {
    if (!visible(e)) continue;
    const r = e.getBoundingClientRect();
    const tieneContenido = e.matches('img,video,canvas,svg,button,a,input,label') ||
      [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!tieneContenido) continue;
    if ((r.left < -2 || r.right > vw + 2) && r.bottom > 0 && !enCarrusel(e) && !oculto(e) && !animado(e) && !e.closest('[aria-hidden="true"]')) {
      let raiz = e; // informar del elemento más externo que se sale, no de cada hijo
      while (raiz.parentElement && raiz.parentElement !== document.body) {
        const q = raiz.parentElement.getBoundingClientRect();
        if (q.left < -2 || q.right > vw + 2) raiz = raiz.parentElement; else break;
      }
      if (!vistos.has(raiz)) {
        vistos.add(raiz);
        const q = raiz.getBoundingClientRect();
        fallos.push(['fuera', nombre(raiz), `«${texto(raiz)}» x ${Math.round(q.left)}→${Math.round(q.right)} (pantalla 0→${vw})`]);
      }
    }
  }
  for (const e of document.querySelectorAll('a,button,[role=button],input[type=submit],summary')) {
    if (!visible(e)) continue;
    const s = getComputedStyle(e), r = e.getBoundingClientRect();
    if (r.bottom < 0 || r.top > document.documentElement.scrollHeight) continue;
    const bg = fondo(e);
    const visibleTxt = (e.innerText || '').trim(); // el aria-label de un icono no se mide
    if (bg && visibleTxt) {
      const fg = rgba(s.color), L1 = lum(fg), L2 = lum(bg);
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const grande = parseFloat(s.fontSize) >= 18.66 || (parseFloat(s.fontSize) >= 14 && +s.fontWeight >= 700);
      if (ratio < 3) fallos.push(['contraste', nombre(e), `«${visibleTxt.slice(0, 40)}» ${ratio.toFixed(2)}:1 (ilegible)`]);
      else if (!grande && ratio < 4.5) avisos.push(['contraste', nombre(e), `«${visibleTxt.slice(0, 40)}» ${ratio.toFixed(2)}:1 (AA pide 4.5)`]);
    }
    if ((r.width < 40 || r.height < 40) && s.display !== 'inline') avisos.push(['toque', nombre(e), `«${texto(e)}» ${Math.round(r.width)}×${Math.round(r.height)}`]);
  }
  for (const e of todos) {
    const s = getComputedStyle(e);
    const marca = (e.id + ' ' + (typeof e.className === 'string' ? e.className : '')).toLowerCase();
    if (/cursor|pointer-ring|follower/.test(marca) && (s.position === 'fixed' || s.position === 'absolute') && visible(e) &&
        s.pointerEvents === 'none') fallos.push(['cursor', nombre(e), 'cursor personalizado visible en pantalla táctil (usa @media (hover: none) { display: none })']);
  }
  const cab = [...document.querySelectorAll('header, nav, [class*=header], [class*=topbar]')]
    .filter((h) => { const s = getComputedStyle(h); return visible(h) && (s.position === 'fixed' || s.position === 'sticky') && h.getBoundingClientRect().top < 10; });
  for (const h of cab.slice(0, 2)) {
    const conTexto = [...h.querySelectorAll('*')].filter((x) => visible(x) && (x.matches('a,button,img,svg') || [...x.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())));
    // lo que puede tapar: lo anterior y cualquier caja con fondo opaco (p. ej. la barra de colores)
    const tapan = [...h.querySelectorAll('*')].filter((x) => visible(x) && (conTexto.includes(x) || rgba(getComputedStyle(x).backgroundColor)[3] > 0.5));
    for (const a of conTexto) for (const b of tapan) {
      if (a === b || a.contains(b) || b.contains(a) || (conTexto.includes(b) && conTexto.indexOf(b) < conTexto.indexOf(a))) continue;
      const p = a.getBoundingClientRect(), q = b.getBoundingClientRect();
      const ix = Math.min(p.right, q.right) - Math.max(p.left, q.left), iy = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
      if (ix > 4 && iy > 4) fallos.push(['cabecera', nombre(a) + ' ↔ ' + nombre(b), `«${texto(a)}» y «${texto(b)}» se tapan ${Math.round(ix)}×${Math.round(iy)}px`]);
    }
  }
  for (const e of todos) {
    if (!visible(e) || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const fs = parseFloat(getComputedStyle(e).fontSize);
    if (fs < 12) { avisos.push(['letra', nombre(e), `«${texto(e)}» ${fs}px`]); }
  }
  for (const e of todos) {
    const s = getComputedStyle(e), r = e.getBoundingClientRect();
    if (s.position === 'fixed' && visible(e) && r.bottom >= vh - 4 && r.top > vh / 2 && r.height > vh * 0.18) avisos.push(['tapa', nombre(e), `${Math.round(r.height)}px de ${vh}px`]);
  }
  const unico = (l) => [...new Map(l.map((x) => [x.join('|'), x])).values()];
  return { fallos: unico(fallos), avisos: unico(avisos).slice(0, 25) };
}

async function main() {
  const pw = cargarPlaywright();
  if (!pw) { console.error('No encuentro Playwright: ejecuta antes scripts/auditar-protocolos.sh (lo instala) o define JOM_PLAYWRIGHT.'); process.exit(2); }
  let urls = todas('--url');
  let srv = null;
  if (SRC) {
    const raiz = path.resolve(SRC);
    srv = await servir(raiz);
    const base = `http://127.0.0.1:${srv.address().port}/`;
    const pags = (opt('--paginas') || fs.readdirSync(raiz).filter((f) => f.endsWith('.html')).join(',')).split(',').filter(Boolean);
    urls = urls.concat(pags.map((p) => base + p));
  }
  if (!urls.length) { console.error('Indica --url URL o --src CARPETA'); process.exit(2); }
  fs.mkdirSync(path.join(OUT, 'capturas'), { recursive: true });
  const nav = await pw.chromium.launch(process.env.JOM_CHROMIUM ? { executablePath: process.env.JOM_CHROMIUM } : {});
  const informe = [];
  let total = 0;
  for (const url of urls) for (const ancho of ANCHOS) {
    const ctx = await nav.newContext({ viewport: { width: ancho, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    const js = [];
    p.on('pageerror', (e) => js.push(e.message.slice(0, 120)));
    let res;
    try { res = await p.goto(url, { waitUntil: 'load', timeout: 45000 }); } catch (e) { js.push('no carga: ' + e.message.slice(0, 80)); }
    await p.waitForTimeout(1500);
    const alto = await p.evaluate(() => document.documentElement.scrollHeight).catch(() => 0);
    const acum = { fallos: [], avisos: [] };
    for (let y = 0; y < Math.min(alto, 30000); y += 700) { // cada pantalla: lo que aparece al bajar también cuenta
      await p.evaluate((yy) => window.scrollTo(0, yy), y);
      await p.waitForTimeout(250);
      const m = await p.evaluate(medir, ancho).catch(() => ({ fallos: [], avisos: [] }));
      acum.fallos.push(...m.fallos); acum.avisos.push(...m.avisos);
    }
    const clave = (x) => (x[0] === 'fuera' ? [x[0], x[1], x[2].split('» ')[0]].join('|') : x.join('|'));
    const uniq = (l) => [...new Map(l.map((x) => [clave(x), x])).values()];
    const fallos = uniq(acum.fallos).concat(js.map((m) => ['js', 'página', m]));
    const avisos = uniq(acum.avisos).slice(0, 25);
    if (res && res.status() >= 400) fallos.push(['http', 'página', String(res.status())]);
    const nombre = url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '_').slice(0, 60) + '_' + ancho;
    await p.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
    await p.screenshot({ path: path.join(OUT, 'capturas', nombre + '.png'), fullPage: true }).catch(() => {});
    console.log(`${fallos.length ? 'FAIL' : avisos.length ? 'WARN' : 'PASS'}  ${ancho}px  ${url}`);
    for (const [t, q, d] of fallos.slice(0, 30)) console.log(`   ✖ ${t.padEnd(9)} ${q}  ${d}`);
    for (const [t, q, d] of avisos.slice(0, 8)) console.log(`   ⚠ ${t.padEnd(9)} ${q}  ${d}`);
    informe.push({ url, ancho, fallos, avisos });
    total += fallos.length ? 1 : 0;
    await ctx.close();
  }
  await nav.close();
  if (srv) srv.close();
  fs.writeFileSync(path.join(OUT, 'movil.json'), JSON.stringify(informe, null, 1));
  console.log(`\n${total ? `MÓVIL: ${total} vistas con FAIL` : 'MÓVIL OK: 0 FAIL'} · informe ${path.join(OUT, 'movil.json')} · capturas ${path.join(OUT, 'capturas')}`);
  process.exit(total ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
