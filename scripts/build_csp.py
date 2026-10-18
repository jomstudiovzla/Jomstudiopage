#!/usr/bin/env python3
"""Genera _headers con una CSP que deja correr la web nueva sin abrir 'unsafe-inline'.

Lee los .html publicados, calcula el sha256 de cada <script> inline (también
importmap), reúne los hosts externos de scripts, módulos y fetch, y escribe
_headers. Si la línea CSP supera el límite de Cloudflare Pages (2000 chars),
cae a 'unsafe-inline' y lo avisa.

Uso: python3 scripts/build_csp.py [raíz] [--check]
"""
import base64
import hashlib
import pathlib
import re
import sys

ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else ".").resolve()
CHECK = "--check" in sys.argv
CF_LINE_LIMIT = 2000
SKIP_DIRS = {".git", "node_modules", ".wrangler", "_cuarentena", "scripts"}

SCRIPT_RE = re.compile(r"<script\b([^>]*)>(.*?)</script\s*>", re.S | re.I)
SRC_RE = re.compile(r"""\bsrc\s*=\s*["']([^"']+)["']""", re.I)
TYPE_RE = re.compile(r"""\btype\s*=\s*["']([^"']+)["']""", re.I)
URL_RE = re.compile(r"""https://([a-z0-9.-]+\.[a-z]{2,})(?=[/"'`?])""", re.I)
# Solo URLs que el navegador ejecuta o descarga; las de comentarios (Three.js trae
# cientos) no cuentan.
QUOTED = r"""\s*["'`]https://([a-z0-9.-]+\.[a-z]{2,})"""
SCRIPT_USE_RE = re.compile(r"""(?:\bfrom|\bimport\s*\(|\bimport|\.src\s*=|importScripts\s*\()""" + QUOTED, re.I)
FETCH_USE_RE = re.compile(r"""(?:\bfetch\s*\(|\.load(?:Async)?\s*\(|new\s+URL\s*\(|\.setDecoderPath\s*\(|\.setTranscoderPath\s*\(|\.open\s*\(\s*["'][A-Z]+["']\s*,)""" + QUOTED, re.I)
COMMENT_RE = re.compile(r"""/\*.*?\*/|(?<![:"'`\\])//[^\n]*""", re.S)
HANDLER_RE = re.compile(r"""\son[a-z]+\s*=\s*["']""", re.I)
DATA_TYPES = {"application/ld+json", "application/json", "text/template", "text/x-template"}

# Hosts que la web ya usaba (formulario, analytics, USDT): se conservan.
BASE_CONNECT = {"https://ipapi.co", "https://api.trongrid.io", "https://formspree.io",
                "https://cloudflareinsights.com", "https://static.cloudflareinsights.com"}
BASE_SCRIPT = {"https://static.cloudflareinsights.com"}


def html_files():
    for p in sorted(ROOT.rglob("*.html")):
        if not SKIP_DIRS.intersection(p.relative_to(ROOT).parts):
            yield p


def scan_js(code, script_hosts, connect_hosts):
    code = COMMENT_RE.sub("", code)
    script_hosts.update("https://" + h.lower() for h in SCRIPT_USE_RE.findall(code))
    connect_hosts.update("https://" + h.lower() for h in FETCH_USE_RE.findall(code))


def main():
    hashes, script_hosts, connect_hosts = set(), set(BASE_SCRIPT), set(BASE_CONNECT)
    handlers = {}
    for f in html_files():
        text = f.read_text(encoding="utf-8", errors="replace")
        for attrs, body in SCRIPT_RE.findall(text):
            src = SRC_RE.search(attrs)
            t = TYPE_RE.search(attrs)
            typ = t.group(1).lower() if t else ""
            if src:
                m = URL_RE.match(src.group(1))
                if m:
                    script_hosts.add("https://" + m.group(1).lower())
                continue
            if typ in DATA_TYPES or not body.strip():
                continue
            digest = hashlib.sha256(body.encode("utf-8")).digest()
            hashes.add("'sha256-" + base64.b64encode(digest).decode() + "'")
            if typ == "importmap":
                script_hosts.update("https://" + h.lower() for h in URL_RE.findall(body))
            else:
                scan_js(body, script_hosts, connect_hosts)
        n = len(HANDLER_RE.findall(re.sub(SCRIPT_RE, "", text)))
        if n:
            handlers[str(f.relative_to(ROOT))] = n
    for js in ROOT.rglob("*.js"):
        if SKIP_DIRS.intersection(js.relative_to(ROOT).parts) or "functions" in js.parts:
            continue
        scan_js(js.read_text(encoding="utf-8", errors="replace"), script_hosts, connect_hosts)


    def csp(script_extra):
        return "; ".join([
            "default-src 'self'",
            "script-src 'self' " + " ".join(sorted(script_hosts)) + " " + script_extra + " 'wasm-unsafe-eval'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' data: https://fonts.gstatic.com",
            "img-src 'self' data: blob: https:",
            "media-src 'self' blob: data:",
            "worker-src 'self' blob:",
            "connect-src 'self' blob: data: " + " ".join(sorted(connect_hosts)),
            "object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'",
            "upgrade-insecure-requests",
        ])

    mode = "hashes"
    policy = csp(" ".join(sorted(hashes)))
    if handlers:
        policy = policy.replace("'wasm-unsafe-eval'", "'unsafe-hashes' 'wasm-unsafe-eval'")
    if len("  Content-Security-Policy: " + policy) > CF_LINE_LIMIT or handlers:
        mode = "unsafe-inline"
        policy = csp("'unsafe-inline'")

    print(f"CSP: {len(hashes)} scripts inline, {len(script_hosts)} hosts de script, modo={mode}")
    for name, n in handlers.items():
        print(f"  aviso: {name} tiene {n} atributos on*=… (onclick, etc.); exigen 'unsafe-inline'")
    if mode == "unsafe-inline" and not handlers:
        print("  aviso: demasiados hashes para una línea de _headers; uso 'unsafe-inline'")

    headers = f"""# Generado por scripts/build_csp.py — no editar a mano; vuelve a correrlo.
/*
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()
  Content-Security-Policy: {policy}
  Cross-Origin-Opener-Policy: same-origin

/*.glb
  Content-Type: model/gltf-binary
  Cache-Control: public, max-age=604800

/*.webm
  Cache-Control: public, max-age=604800

/*.webp
  Cache-Control: public, max-age=604800
"""
    out = ROOT / "_headers"
    if CHECK:
        print("(--check: no se escribe _headers)")
        return
    out.write_text(headers, encoding="utf-8")
    print(f"escrito {out}")


if __name__ == "__main__":
    main()
