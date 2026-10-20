#!/usr/bin/env python3
"""JOM Auditoría · Home y Estudio de punta a punta. Solo audita: no modifica nada.

Uso:
  python3 jom_auditoria.py home        # concept_master_horizontal.html (+ index.html)
  python3 jom_auditoria.py estudio     # home + 7 protocolos + kit + CSP + tipografía + videos/alfa
                                       #   + ensayo de migración + staging + correo + seguridad + git
  python3 jom_auditoria.py inventario  # qué herramientas, skills e instalaciones existen
Opciones: --repo R · --src S (light-concepts) · --out O · --sin-navegador · --sin-migracion · --json

Llama a los scripts REALES del repo por su interfaz (auditar-protocolos.sh, build_csp.py,
integrar-kit.sh con DRY_RUN=1, migrar-web-nueva.sh con NO_PUSH=1, y si existen
auditar-tipografia.sh, verificar_alfa.py, auditar_video.py). Lo que no existe sale
OMITIDO con el motivo. Informe: <out>/informe.md + <out>/resumen.json + logs/.
Salida: 0 sin FAIL · 1 hay FAIL · 2 no se pudo empezar. Solo stdlib (Python 3.9).
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime

AQUI = os.path.dirname(os.path.abspath(__file__))
CASA = os.path.expanduser("~")
STUDIO = os.environ.get("JOM_STUDIO_DIR") or os.path.join(CASA, "Documents", "Antigravity", "JOM Studio")
HERRAMIENTAS = [
    ("auditar-protocolos", "scripts/auditar-protocolos.sh", True), ("auditar_protocolos.mjs", "scripts/auditar_protocolos.mjs", True),
    ("build_csp", "scripts/build_csp.py", True), ("integrar-kit", "scripts/integrar-kit.sh", True),
    ("migrar-web-nueva", "scripts/migrar-web-nueva.sh", True), ("deploy-cloudflare", "deploy-cloudflare.sh", True),
    ("jom-estado", "scripts/jom-estado.py", True), ("instalar-skills-jom", "scripts/instalar-skills-jom.sh", True),
    ("auditar-tipografia", "scripts/auditar-tipografia.sh", False), ("verificar_alfa", "scripts/verificar_alfa.py", False),
    ("alfa-sin-verde", "scripts/alfa-sin-verde.sh", False), ("auditar_video", "scripts/auditar_video.py", False),
    ("pulir-video", "scripts/pulir-video.sh", False), ("jom-todo", "scripts/jom-todo.sh", False),
    ("grabar-protocolos", "scripts/grabar-protocolos.sh", False), ("montar-youtube", "scripts/montar-youtube.sh", False),
]
PRIVADO = re.compile(r"presupuestos y automatizacion|presupuestos_y_automatizacion|catalogo_presentaciones", re.I)
SECRETOS = [
    (re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"), "clave privada"),
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "AWS access key"),
    (re.compile(r"\b(?:ghp|gho|ghs|github_pat)_[A-Za-z0-9_]{20,}"), "token de GitHub"),
    (re.compile(r"\bsk-(?:live|proj|ant)?[-_]?[A-Za-z0-9]{24,}"), "clave sk-…"),
    (re.compile(r"\bxox[abpr]-[A-Za-z0-9-]{10,}"), "token de Slack"),
    (re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b"), "clave de Google API"),
    (re.compile(r"(?i)\b(?:cloudflare_api_token|cf_api_token|smtp_pass(?:word)?|app_password)\s*[:=]\s*['\"]?[A-Za-z0-9_\-]{16,}"), "credencial en claro"),
]
MEDIA_ALFA = (".webm", ".webp", ".png", ".mov")
MEDIA_VIDEO = (".webm", ".mp4", ".mov")
ICON = {"PASS": "✔", "WARN": "⚠", "FAIL": "✖", "OMITIDO": "·"}
LANZADORES = ["JOM Correo · Trabajo completo.command", "JOM Correo · Enviar aprobados.command",
              "JOM Correo · Instalar.command", "JOM Web · Todo.command"]


def say(m):
    print("\n==> %s" % m, flush=True)


class Ctx(object):
    pass


def resultado(cid, area, estado, detalle, comando="", log=""):
    return {"id": cid, "area": area, "estado": estado, "detalle": detalle, "comando": comando, "log": log}


def correr(ctx, cid, cmd, env_extra=None, cwd=None, timeout=900):
    """Ejecuta, guarda TODO en logs/<cid>.log y devuelve (código, salida)."""
    env = dict(os.environ)
    env.update(env_extra or {})
    log = os.path.join(ctx.out, "logs", "%s.log" % cid)
    os.makedirs(os.path.dirname(log), exist_ok=True)
    pre = " ".join("%s=%s" % (k, shq(v)) for k, v in sorted((env_extra or {}).items()))
    texto_cmd = (pre + " " if pre else "") + " ".join(shq(c) for c in cmd)
    t0 = time.time()
    try:
        r = subprocess.run(cmd, cwd=cwd or ctx.repo, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                           stdin=subprocess.DEVNULL, timeout=timeout)
        rc, out = r.returncode, r.stdout.decode("utf-8", "replace")
    except subprocess.TimeoutExpired as e:
        rc, out = 124, (e.stdout or b"").decode("utf-8", "replace") + "\n✖ tiempo agotado (%d s)" % timeout
    except OSError as e:
        rc, out = 127, "✖ no se pudo ejecutar: %s" % e
    with open(log, "w", encoding="utf-8") as f:
        f.write("$ %s\n(cwd %s · %.1f s · código %d)\n\n%s" % (texto_cmd, cwd or ctx.repo, time.time() - t0, rc, out))
    return rc, out, texto_cmd, log


def shq(s):
    s = str(s)
    return s if re.match(r"^[A-Za-z0-9_./=:,+@%-]+$", s) else "'" + s.replace("'", "'\"'\"'") + "'"


def cola(texto, n=6):
    ls = [l for l in texto.strip().splitlines() if l.strip()]
    return " | ".join(l.strip() for l in ls[-n:])[:600]


def problemas(texto, n=3):
    """Primeras líneas ✖ (y luego ⚠) del informe de un auditor, sin la tabla."""
    ls = [l.strip() for l in texto.splitlines()]
    malas = [l for l in ls if l.startswith("✖ ") and " (" not in l[-8:]] + [l for l in ls if l.startswith("⚠ ")]
    return " | ".join(malas[:n])[:500]


def contar_resumen(texto):
    # «7 PASS · 1 WARN · 0 FAIL» (auditar-*.sh) o «Resumen: 3 ✔ PASS · 1 ⚠ WARN · 0 ✖ FAIL» (auditar_video.py)
    m = re.findall(r"(\d+)\s*\S?\s*PASS\s*·\s*(\d+)\s*\S?\s*WARN\s*·\s*(\d+)\s*\S?\s*FAIL", texto)
    return tuple(int(x) for x in m[-1]) if m else None


def raiz_git(desde):
    d = os.path.abspath(desde)
    while True:
        if os.path.exists(os.path.join(d, ".git")):
            return d
        p = os.path.dirname(d)
        if p == d:
            return None
        d = p


def hallar_repo(arg):
    cands = [arg, os.environ.get("JOM_REPO"), raiz_git(os.getcwd()),
             os.path.abspath(os.path.join(AQUI, "..", "..", "..", "..")),
             os.path.join(STUDIO, "Portafolio"), "/home/user/Jomstudiopage"]
    for c in cands:
        if c and os.path.isfile(os.path.join(c, "scripts", "build_csp.py")):
            return os.path.abspath(c)
    return None


def hallar_src(arg, repo):
    for c in [arg, os.environ.get("SRC"), os.path.join(repo, "demos", "light-concepts"),
              os.path.join(STUDIO, "Portafolio", "demos", "light-concepts")]:
        if c and os.path.isdir(c):
            return os.path.abspath(c)
    return os.path.abspath(arg or os.path.join(repo, "demos", "light-concepts"))


def herramienta(ctx, nombre):
    for n, rel, _ in HERRAMIENTAS:
        if n == nombre:
            p = os.path.join(ctx.repo, rel)
            return p if os.path.isfile(p) else None
    return None


# ---------------------------------------------------------------- recogida de archivos
def paginas(ctx, modo):
    fijas = ["index.html", "concept_master_horizontal.html"]
    if modo == "home":
        return [p for p in fijas if os.path.isfile(os.path.join(ctx.src, p))]
    return [p for p in sorted(os.listdir(ctx.src)) if p.endswith(".html") and os.path.isfile(os.path.join(ctx.src, p))] \
        if os.path.isdir(ctx.src) else []


def medios(ctx, modo, exts):
    res = []
    if modo == "home":
        rx = re.compile(r"""["'(]\s*(?:\./)?((?:assets/)(?:personajes|video)/[^"'()?#\s]+)""")
        for pg in paginas(ctx, "home"):
            try:
                with open(os.path.join(ctx.src, pg), "r", encoding="utf-8", errors="replace") as f:
                    for m in rx.finditer(f.read()):
                        res.append(m.group(1))
            except OSError:
                pass
        res = [os.path.join(ctx.src, r) for r in sorted(set(res))]
    else:
        for sub in ("assets/personajes", "assets/video"):
            base = os.path.join(ctx.src, sub)
            for actual, _, files in os.walk(base):
                res += [os.path.join(actual, f) for f in files]
    return sorted(p for p in set(res) if p.lower().endswith(exts) and os.path.isfile(p) and ".bak" not in os.path.basename(p))


# ---------------------------------------------------------------- comprobaciones
def ch_git(ctx):
    if not raiz_git(ctx.repo):
        return resultado("git", "git", "WARN", "%s no es un repositorio git" % ctx.repo)
    rc, rama, _, _ = correr(ctx, "git-rama", ["git", "-C", ctx.repo, "rev-parse", "--abbrev-ref", "HEAD"], timeout=30)
    rc2, st, cmd, log = correr(ctx, "git-status", ["git", "-C", ctx.repo, "status", "--porcelain"], timeout=60)
    mod = [l[3:] for l in st.splitlines() if l.strip() and not l.startswith("??")]
    nuevos = [l[3:] for l in st.splitlines() if l.startswith("??")]
    rc3, ab, _, _ = correr(ctx, "git-upstream", ["git", "-C", ctx.repo, "rev-list", "--left-right", "--count", "@{u}...HEAD"], timeout=30)
    rel = ""
    if rc3 == 0 and len(ab.split()) == 2:
        detras, delante = ab.split()
        rel = " · %s commit(s) por subir, %s por bajar" % (delante, detras)
    det = "rama %s%s · %d modificados · %d sin seguimiento" % (rama.strip(), rel, len(mod), len(nuevos))
    if mod:
        return resultado("git", "git", "WARN", det + " (sin commit: %s)" % ", ".join(mod[:5]), cmd, log)
    return resultado("git", "git", "PASS", det, cmd, log)


def ch_src(ctx, modo):
    if not os.path.isdir(ctx.src):
        return resultado("origen", "web", "FAIL", "no existe %s (la web nueva vive en el Mac: pasa --src o SRC=…)" % ctx.src)
    if not os.path.isfile(os.path.join(ctx.src, "concept_master_horizontal.html")):
        return resultado("origen", "web", "FAIL", "falta concept_master_horizontal.html en %s" % ctx.src)
    pgs = paginas(ctx, "estudio")
    faltan = [p for p in ["page_01_gamificacion.html", "page_02_fullstack.html", "page_03_arte_ia.html", "page_04_automatizacion.html",
                          "page_05_audio_ugc.html", "page_06_branding.html", "page_07_consultoria.html"] if p not in pgs]
    if modo == "estudio" and faltan:
        return resultado("origen", "web", "WARN", "%d páginas; faltan: %s" % (len(pgs), ", ".join(faltan)))
    return resultado("origen", "web", "PASS", "%d páginas en %s" % (len(pgs), ctx.src))


def ch_navegador(ctx, modo, staging=False):
    cid = "navegador-staging" if staging else "navegador"
    if ctx.sin_navegador:
        return resultado(cid, "web", "OMITIDO", "--sin-navegador")
    sh = herramienta(ctx, "auditar-protocolos")
    if not sh:
        return resultado(cid, "web", "FAIL", "no existe scripts/auditar-protocolos.sh (git pull de la rama)")
    out = os.path.join(ctx.out, "protocolos-staging" if staging else "protocolos")
    cmd = ["bash", sh, "--staging"] if staging else ["bash", sh, ctx.src]
    if modo == "home" and not staging:
        cmd += ["--solo", "concept_master_horizontal.html,index.html"]
    rc, txt, c, log = correr(ctx, cid, cmd, {"OUT": out}, timeout=1800)
    js = os.path.join(out, "auditoria.json")
    datos = None
    try:
        with open(js, "r", encoding="utf-8") as f:
            datos = json.load(f)
    except (OSError, ValueError):
        pass
    if rc not in (0, 1) or not datos:
        return resultado(cid, "web", "FAIL", "no se pudo auditar (código %d): %s" % (rc, cola(txt)), c, log)
    r = datos.get("resumen", {})
    malas = ["%s %s: %s" % (p["file"], p["verdict"], "; ".join(p.get("reasons", [])[:2])) for p in datos.get("paginas", []) if p.get("verdict") != "PASS"]
    det = "%d PASS · %d WARN · %d FAIL (%s)" % (r.get("PASS", 0), r.get("WARN", 0), r.get("FAIL", 0), js)
    if malas:
        det += " — " + " | ".join(malas)[:900]
    estado = "FAIL" if r.get("FAIL") else ("WARN" if r.get("WARN") else "PASS")
    return resultado(cid, "web", estado, det, c, log)


def ch_csp(ctx):
    py = herramienta(ctx, "build_csp")
    if not py:
        return resultado("csp", "seguridad", "FAIL", "no existe scripts/build_csp.py")
    rc, txt, c, log = correr(ctx, "csp", [sys.executable, py, ctx.src, "--check"], timeout=300)
    m = re.search(r"modo=([\w-]+)", txt)
    if rc != 0 or not m:
        return resultado("csp", "seguridad", "FAIL", "build_csp.py falló (código %d): %s" % (rc, cola(txt)), c, log)
    avisos = [l.strip() for l in txt.splitlines() if "aviso" in l]
    linea = next((l.strip() for l in txt.splitlines() if "modo=" in l), "")
    if m.group(1) == "hashes":
        return resultado("csp", "seguridad", "PASS", linea, c, log)
    return resultado("csp", "seguridad", "WARN", "modo=%s (scripts con 'unsafe-inline'): %s" % (m.group(1), " | ".join(avisos)[:500]), c, log)


def ch_tipografia(ctx, modo):
    sh = herramienta(ctx, "auditar-tipografia")
    if not sh:
        return resultado("tipografia", "branding", "OMITIDO", "no existe scripts/auditar-tipografia.sh (lo construye otro flujo)")
    if ctx.sin_navegador:
        return resultado("tipografia", "branding", "OMITIDO", "--sin-navegador")
    _, ayuda, _, _ = correr(ctx, "tipografia-ayuda", ["bash", sh, "--help"], timeout=30)
    cmd = ["bash", sh]
    if modo == "home" and "--solo" in ayuda:
        cmd += ["--solo", "concept_master_horizontal.html,index.html"]
    rc, txt, c, log = correr(ctx, "tipografia", cmd, {"SRC": ctx.src, "OUT": os.path.join(ctx.out, "tipografia")}, timeout=1800)
    n = contar_resumen(txt)
    det = ("%d PASS · %d WARN · %d FAIL" % n) if n else cola(txt, 3)
    if problemas(txt):
        det += " — " + problemas(txt)
    if rc == 0:
        return resultado("tipografia", "branding", "WARN" if n and n[1] else "PASS", det, c, log)
    if rc == 1:
        return resultado("tipografia", "branding", "FAIL", det, c, log)
    return resultado("tipografia", "branding", "FAIL", "no se pudo auditar (código %d): %s" % (rc, cola(txt)), c, log)


def ch_alfa(ctx, modo):
    py = herramienta(ctx, "verificar_alfa")
    if not py:
        return resultado("alfa", "video", "OMITIDO", "no existe scripts/verificar_alfa.py (lo construye otro flujo)")
    archivos = medios(ctx, modo, MEDIA_ALFA)
    if not archivos:
        return resultado("alfa", "video", "OMITIDO", "no hay .webm/.webp/.png/.mov en assets/personajes ni assets/video%s" % (" usados por el Home" if modo == "home" else ""))
    rc, txt, c, log = correr(ctx, "alfa", [sys.executable, py] + archivos, timeout=1800)
    n = contar_resumen(txt)
    det = "%d archivo(s): %s" % (len(archivos), ("%d PASS · %d WARN · %d FAIL" % n) if n else cola(txt, 4))
    if rc != 0 and problemas(txt):
        det += " — " + problemas(txt)
    if rc == 0:
        return resultado("alfa", "video", "WARN" if n and n[1] else "PASS", det, c, log)
    if rc == 1:
        fix = " → corrige con scripts/alfa-sin-verde.sh <archivo> (salida en ./alfa-out, nunca sobre el original)" if herramienta(ctx, "alfa-sin-verde") else ""
        return resultado("alfa", "video", "FAIL", det + fix, c, log)
    return resultado("alfa", "video", "FAIL", "verificar_alfa.py no pudo (código %d): %s" % (rc, cola(txt)), c, log)


def ch_video(ctx, modo):
    py = herramienta(ctx, "auditar_video")
    if not py:
        return resultado("video", "video", "OMITIDO", "no existe scripts/auditar_video.py (lo construye otro flujo)")
    archivos = medios(ctx, modo, MEDIA_VIDEO)
    if not archivos:
        return resultado("video", "video", "OMITIDO", "no hay .webm/.mp4/.mov que auditar")
    rc, txt, c, log = correr(ctx, "video", [sys.executable, py, "--perfil", "web-personaje"] + archivos, timeout=3600)
    n = contar_resumen(txt)
    det = "%d video(s): %s" % (len(archivos), ("%d PASS · %d WARN · %d FAIL" % n) if n else cola(txt, 4))
    if rc != 0 and problemas(txt):
        det += " — " + problemas(txt)
    if rc == 0:
        return resultado("video", "video", "WARN" if n and n[1] else "PASS", det, c, log)
    if rc == 1:
        return resultado("video", "video", "FAIL", det + " → pule con scripts/pulir-video.sh (salida en ./video-pulido)", c, log)
    return resultado("video", "video", "FAIL", "auditar_video.py no pudo (código %d): %s" % (rc, cola(txt)), c, log)


def textos(ctx, carpeta, exts, excluir=("three", "node_modules", ".git", "_cuarentena", ".wrangler")):
    for actual, dirs, files in os.walk(carpeta):
        dirs[:] = [d for d in dirs if d not in excluir and not PRIVADO.search(d)]
        for f in files:
            if f.lower().endswith(exts) and ".bak" not in f:
                p = os.path.join(actual, f)
                try:
                    if os.path.getsize(p) < 3 * 1024 * 1024:
                        yield p
                except OSError:
                    pass


def ch_seguridad_web(ctx, modo):
    if not os.path.isdir(ctx.src):
        return resultado("seguridad-web", "seguridad", "OMITIDO", "sin carpeta de origen")
    fallos, avisos = [], []
    htmls = [os.path.join(ctx.src, p) for p in paginas(ctx, modo)]
    for p in htmls:
        try:
            with open(p, "r", encoding="utf-8", errors="replace") as f:
                h = f.read()
        except OSError:
            continue
        n = os.path.basename(p)
        blank = [t for t in re.findall(r"<a\b[^>]*target\s*=\s*[\"']?_blank[^>]*>", h, re.I) if not re.search(r"noopener|noreferrer", t, re.I)]
        if blank:
            avisos.append("%s: %d enlace(s) target=_blank sin rel=noopener" % (n, len(blank)))
        on = re.findall(r"""\son[a-z]+\s*=\s*["']""", h, re.I)
        if on:
            avisos.append("%s: %d atributo(s) on*= (rompen la CSP por hashes)" % (n, len(on)))
        mixto = [u for u in re.findall(r"""(?:src|href)\s*=\s*["'](http://[^"']+)""", h, re.I) if not re.match(r"http://(localhost|127\.)", u)]
        if mixto:
            avisos.append("%s: %d recurso(s) http:// (contenido mixto)" % (n, len(mixto)))
        if PRIVADO.search(h):
            fallos.append("%s enlaza a datos privados (presupuestos/catálogo de prospectos): quita el enlace" % n)
    alcance = htmls if modo == "home" else list(textos(ctx, ctx.src, (".html", ".js", ".json", ".css")))
    for p in alcance:
        try:
            with open(p, "r", encoding="utf-8", errors="replace") as f:
                h = f.read()
        except OSError:
            continue
        for rx, que in SECRETOS:
            if rx.search(h):
                fallos.append("%s: posible %s" % (os.path.relpath(p, ctx.src), que))
    det = " | ".join(fallos + avisos)[:900] or "%d página(s) sin enlaces privados, secretos, on*=, http:// ni _blank inseguros" % len(htmls)
    return resultado("seguridad-web", "seguridad", "FAIL" if fallos else ("WARN" if avisos else "PASS"), det)


def ch_kit(ctx):
    sh = herramienta(ctx, "integrar-kit")
    if not sh:
        return resultado("kit", "web", "FAIL", "no existe scripts/integrar-kit.sh")
    if not os.path.isdir(ctx.src):
        return resultado("kit", "web", "OMITIDO", "sin carpeta de origen")
    rc, txt, c, log = correr(ctx, "kit", ["bash", sh], {"DRY_RUN": "1", "SRC": ctx.src}, timeout=120)
    if rc != 0:
        return resultado("kit", "web", "FAIL", "integrar-kit.sh (ensayo) falló: %s" % cola(txt), c, log)
    pend = [l for l in txt.splitlines() if l.startswith("+ ") or l.startswith("--- a/")]
    faltan = [l.strip() for l in txt.splitlines() if l.startswith("⚠")]
    if pend or faltan:
        return resultado("kit", "web", "WARN", "integración pendiente (%s): ejecuta scripts/integrar-kit.sh (copia .bak-kit)" % " | ".join((pend + faltan)[:6]), c, log)
    return resultado("kit", "web", "PASS", "kit al día: %s" % cola(txt, 4), c, log)


def ch_migracion(ctx):
    if ctx.sin_migracion:
        return resultado("migracion-ensayo", "web", "OMITIDO", "--sin-migracion")
    sh = herramienta(ctx, "migrar-web-nueva")
    if not sh:
        return resultado("migracion-ensayo", "web", "FAIL", "no existe scripts/migrar-web-nueva.sh")
    rc, txt, c, log = correr(ctx, "migracion-ensayo", ["bash", sh], {"NO_PUSH": "1", "SRC": ctx.src}, timeout=3600)
    if rc != 0:
        return resultado("migracion-ensayo", "web", "FAIL", "NO_PUSH=1 migrar-web-nueva.sh falló (código %d): %s" % (rc, cola(txt)), c, log)
    m = re.search(r"modo=([\w-]+)", txt)
    avisos = [l.strip() for l in txt.splitlines() if l.strip().startswith("⚠")]
    det = "ensayo completo sin tocar GitHub ni Cloudflare%s%s" % ((" · CSP modo=%s" % m.group(1)) if m else "",
                                                               (" · avisos: " + " | ".join(avisos[:4])) if avisos else "")
    return resultado("migracion-ensayo", "web", "WARN" if avisos else "PASS", det, c, log)


def ch_correo(ctx):
    app = os.environ.get("JOMCORREO_DIR") or os.path.join(CASA, "Library", "Application Support", "JOMCorreo")
    cli = os.path.join(app, "jomcorreo.py")
    if not os.path.isfile(cli):
        if sys.platform == "darwin" or os.environ.get("JOMCORREO_DIR"):
            return resultado("correo", "correo", "WARN", "JOM Correo no está instalado en %s → el CEO: doble clic en «JOM Correo · Instalar.command» (o bash instalar.sh)" % app)
        return resultado("correo", "correo", "OMITIDO", "JOM Correo vive en el Mac (no instalado aquí)")
    rc, txt, c, log = correr(ctx, "correo", [sys.executable, cli, "estado"], cwd=app, timeout=180)
    if rc != 0:
        return resultado("correo", "correo", "FAIL", "jomcorreo.py estado falló (código %d): %s" % (rc, cola(txt)), c, log)
    notas = []
    try:
        with open(os.path.join(app, "config.json"), "r", encoding="utf-8") as f:
            cfg = json.load(f)
        notas.append("modo ensayo: %s" % ("sí (no envía nada real)" if (cfg.get("envio") or {}).get("modo_ensayo", True) else "NO (envío real activo)"))
    except (OSError, ValueError):
        notas.append("config.json ilegible")
    estado = "PASS"
    if sys.platform == "darwin":
        uid = str(os.getuid())
        for lbl in ("site.jomstudio.correo.preparar", "site.jomstudio.correo.enviar"):
            r, _, _, _ = correr(ctx, "launchd-" + lbl.split(".")[-1], ["launchctl", "print", "gui/%s/%s" % (uid, lbl)], timeout=30)
            if r != 0:
                notas.append("%s NO cargado (repite bash instalar.sh)" % lbl)
                estado = "WARN"
    return resultado("correo", "correo", estado, "%s · %s" % (" · ".join(notas), cola(txt, 3)), c, log)


def ch_lanzadores(ctx):
    carpeta = os.path.join(STUDIO, "presupuestos y automatizacion", "lanzadores-mac")
    if not os.path.isdir(STUDIO):
        return resultado("lanzadores", "correo", "OMITIDO", "no existe %s (no es el Mac del CEO)" % STUDIO)
    faltan = [n for n in LANZADORES if not os.path.isfile(os.path.join(carpeta, n))]
    no_x = [n for n in LANZADORES if os.path.isfile(os.path.join(carpeta, n)) and not os.access(os.path.join(carpeta, n), os.X_OK)]
    if faltan or no_x:
        det = ("faltan: %s" % ", ".join(faltan) if faltan else "") + ((" · sin permiso de ejecución: %s (chmod +x)" % ", ".join(no_x)) if no_x else "")
        return resultado("lanzadores", "correo", "WARN", "%s en %s" % (det.strip(" ·"), carpeta))
    return resultado("lanzadores", "correo", "PASS", "4 lanzadores listos en %s" % carpeta)


def ch_seguridad_repo(ctx):
    if not raiz_git(ctx.repo):
        return resultado("seguridad-repo", "seguridad", "OMITIDO", "no es un repo git")
    fallos, avisos = [], []
    _, ls, c, log = correr(ctx, "git-ls-files", ["git", "-C", ctx.repo, "ls-files"], timeout=60)
    versionados = [l for l in ls.splitlines() if l.strip()]
    priv = [l for l in versionados if PRIVADO.search(l)]
    if priv:
        fallos.append("datos privados VERSIONADOS en un repo público: %s" % ", ".join(priv[:5]))
    _, otros, _, _ = correr(ctx, "git-otros", ["git", "-C", ctx.repo, "ls-files", "--others", "--exclude-standard", "--directory"], timeout=60)
    priv2 = [l for l in otros.splitlines() if PRIVADO.search(l)]
    if priv2:
        fallos.append("datos privados sin ignorar (un git add -A los subiría): %s → añádelos a .gitignore" % ", ".join(priv2[:5]))
    for rel in versionados:
        p = os.path.join(ctx.repo, rel)
        try:
            if os.path.getsize(p) > 2 * 1024 * 1024:
                continue
            with open(p, "rb") as f:
                b = f.read()
        except OSError:
            continue
        if b"\0" in b[:8192]:
            continue
        t = b.decode("utf-8", "replace")
        for rx, que in SECRETOS:
            if rx.search(t):
                fallos.append("%s: posible %s" % (rel, que))
    docs = [l for l in versionados if re.search(r"(?i)(propuesta|presupuesto|cotizaci|factura|contrato|invoice)[^/]*\.(docx?|xlsx?|pdf|pptx?|csv)$", l)]
    if docs:
        avisos.append("documentos de clientes en un repo PÚBLICO (¿deben ser privados?): %s" % ", ".join(docs[:4]))
    cfgjs = os.path.join(ctx.repo, "js", "config.js")
    if os.path.isfile(cfgjs):
        with open(cfgjs, "r", encoding="utf-8", errors="replace") as f:
            t = f.read()
        if "REPLACE_WITH_YOUR_TRC20_USDT_ADDRESS" in t:
            avisos.append("js/config.js: falta la wallet USDT TRC20 (placeholder)")
        if re.search(r"""password\s*:\s*["']jom2026["']""", t):
            avisos.append("js/config.js: contraseña de admin por defecto en JS público (cámbiala; protege admin-ops con Cloudflare Access)")
    gi = os.path.join(ctx.repo, ".gitignore")
    gtxt = open(gi, "r", encoding="utf-8", errors="replace").read() if os.path.isfile(gi) else ""
    for patron in (".env", ".dev.vars"):
        if patron not in gtxt:
            avisos.append(".gitignore no ignora %s" % patron)
    grandes = []
    for actual, dirs, files in os.walk(ctx.src) if os.path.isdir(ctx.src) else []:
        dirs[:] = [d for d in dirs if d not in ("node_modules", ".git")]
        for f in files:
            p = os.path.join(actual, f)
            try:
                if os.path.getsize(p) > 25 * 1024 * 1024:
                    grandes.append("%s (%.0f MB)" % (os.path.relpath(p, ctx.src), os.path.getsize(p) / 1048576.0))
            except OSError:
                pass
    if grandes:
        avisos.append("> 25 MiB (límite de Cloudflare; la migración comprime solo la COPIA): %s" % ", ".join(grandes[:4]))
    det = " | ".join(fallos + avisos)[:900] or "%d archivos versionados sin datos privados ni secretos" % len(versionados)
    return resultado("seguridad-repo", "seguridad", "FAIL" if fallos else ("WARN" if avisos else "PASS"), det, c, log)


def ch_instalacion(ctx):
    sk = os.path.join(CASA, ".claude", "skills", "jom-estudio", "SKILL.md")
    st = os.path.join(CASA, ".claude", "settings.json")
    notas, estado = [], "PASS"
    if os.path.isfile(sk):
        notas.append("skills jom-* globales instalados")
    else:
        notas.append("skills jom-* NO instalados en ~/.claude/skills"); estado = "WARN"
    hook = git = False
    try:
        with open(st, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        for g in (cfg.get("hooks") or {}).get("Stop") or []:
            for h in g.get("hooks") or []:
                hook = hook or "jom-no-parar.py" in str(h.get("command", ""))
                git = git or "stop-hook-git-check" in str(h.get("command", ""))
    except (OSError, ValueError, AttributeError):
        pass
    notas.append("Stop hook jom-no-parar %s" % ("registrado" if hook else "NO registrado"))
    if not hook:
        estado = "WARN"
    if git:
        notas.append("stop-hook-git-check.sh conservado")
    if estado == "WARN":
        notas.append("→ bash scripts/instalar-skills-jom.sh")
    return resultado("instalacion", "orquestador", estado, " · ".join(notas))


def inventario(ctx):
    tools = []
    for n, rel, base in HERRAMIENTAS:
        tools.append({"nombre": n, "ruta": rel, "existe": os.path.isfile(os.path.join(ctx.repo, rel)), "nucleo": base})
    skills = []
    for raiz in (os.path.join(ctx.repo, ".claude", "skills"), os.path.join(CASA, ".claude", "skills"), os.path.join(CASA, ".gemini", "config", "skills")):
        if os.path.isdir(raiz):
            for d in sorted(os.listdir(raiz)):
                if os.path.isfile(os.path.join(raiz, d, "SKILL.md")):
                    skills.append(os.path.join(raiz, d))
    bins = {}
    for b in ("node", "npm", "ffmpeg", "ffprobe", "git", "gh", "npx", "tesseract", "webpmux"):
        bins[b] = any(os.access(os.path.join(p, b), os.X_OK) for p in os.environ.get("PATH", "").split(os.pathsep) if p)
    return {"repo": ctx.repo, "src": ctx.src, "src_existe": os.path.isdir(ctx.src), "herramientas": tools, "skills": skills,
            "binarios": bins, "jom_correo": os.path.isfile(os.path.join(os.environ.get("JOMCORREO_DIR") or os.path.join(CASA, "Library", "Application Support", "JOMCorreo"), "jomcorreo.py")),
            "studio_dir": STUDIO if os.path.isdir(STUDIO) else None, "playwright": os.environ.get("JOM_PLAYWRIGHT") or "(prefijo ${TMPDIR}/jom-audit-node; se instala solo)"}


# ---------------------------------------------------------------- principal
def informe(ctx, modo, res, t0):
    cuenta = {k: sum(1 for r in res if r["estado"] == k) for k in ICON}
    say("Resultado · auditoría %s" % modo)
    w = max(len(r["id"]) for r in res) + 2
    for r in res:
        print("  %s %-*s %-8s %s" % (ICON[r["estado"]], w, r["id"], r["estado"], r["detalle"][:300]))
    resumen = "%d PASS · %d WARN · %d FAIL · %d OMITIDO" % (cuenta["PASS"], cuenta["WARN"], cuenta["FAIL"], cuenta["OMITIDO"])
    print("\n  %s  (%.0f s)" % (resumen, time.time() - t0))
    datos = {"modo": modo, "fecha": datetime.now().astimezone().isoformat(timespec="seconds"), "repo": ctx.repo, "src": ctx.src,
             "resumen": cuenta, "comprobaciones": res}
    with open(os.path.join(ctx.out, "resumen.json"), "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=2)
    md = ["# Auditoría %s · JOM Studio" % modo, "", "- Fecha: %s" % datos["fecha"], "- Repo: `%s`" % ctx.repo,
          "- Origen: `%s`" % ctx.src, "- Resultado: **%s**" % resumen, "", "| Comprobación | Área | Estado | Detalle |", "|---|---|---|---|"]
    for r in res:
        md.append("| %s | %s | %s %s | %s |" % (r["id"], r["area"], ICON[r["estado"]], r["estado"], r["detalle"].replace("|", "/")[:500]))
    md += ["", "## Comandos y registros", ""]
    for r in res:
        if r["comando"]:
            md.append("- **%s**: `%s` → `%s`" % (r["id"], r["comando"], r["log"]))
    md += ["", "Siguiente: corrige cada FAIL (y justifica o corrige cada WARN) y vuelve a correr esta auditoría hasta 0 FAIL."]
    with open(os.path.join(ctx.out, "informe.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(md) + "\n")
    print("  Informe: %s" % os.path.join(ctx.out, "informe.md"))
    print("  JSON:    %s" % os.path.join(ctx.out, "resumen.json"))
    print("  Evidencia para jom-estado: \"jom_auditoria.py %s → %s (%s)\"" % (modo, resumen, os.path.join(ctx.out, "informe.md")))
    return datos


def main(argv=None):
    p = argparse.ArgumentParser(description="Auditoría de punta a punta de JOM Studio (no modifica nada).")
    p.add_argument("modo", choices=["home", "estudio", "inventario"])
    p.add_argument("--repo")
    p.add_argument("--src")
    p.add_argument("--out")
    p.add_argument("--sin-navegador", action="store_true", help="no lanzar Chromium (omite auditar-protocolos y tipografía)")
    p.add_argument("--sin-migracion", action="store_true", help="estudio: no hacer el ensayo NO_PUSH=1 de la migración ni el staging")
    p.add_argument("--json", action="store_true")
    a = p.parse_args(argv)
    ctx = Ctx()
    ctx.repo = hallar_repo(a.repo)
    if not ctx.repo:
        print("✖ No encuentro el repo de la web (scripts/build_csp.py). Pasa --repo o JOM_REPO=…", file=sys.stderr)
        return 2
    ctx.src = hallar_src(a.src, ctx.repo)
    ctx.sin_navegador, ctx.sin_migracion = a.sin_navegador, a.sin_migracion
    if a.modo == "inventario":
        inv = inventario(ctx)
        if a.json:
            print(json.dumps(inv, ensure_ascii=False, indent=2))
        else:
            say("Inventario JOM Studio")
            print("  repo: %s\n  origen: %s (%s)" % (inv["repo"], inv["src"], "existe" if inv["src_existe"] else "NO existe"))
            for t in inv["herramientas"]:
                print("  %s %-24s %s%s" % ("✔" if t["existe"] else ("✖" if t["nucleo"] else "·"), t["nombre"], t["ruta"],
                                          "" if t["existe"] else ("  (FALTA)" if t["nucleo"] else "  (aún no existe: otro flujo)")))
            print("  skills: %s" % (", ".join(os.path.basename(s) + " [" + os.path.dirname(s).replace(CASA, "~") + "]" for s in inv["skills"]) or "ninguno"))
            print("  binarios: %s" % ", ".join("%s %s" % (k, "✔" if v else "✖") for k, v in inv["binarios"].items()))
            print("  JOM Correo instalado: %s · carpeta JOM Studio: %s" % ("sí" if inv["jom_correo"] else "no", inv["studio_dir"] or "no (no es el Mac)"))
        return 0
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    ctx.out = os.path.abspath(a.out or os.path.join(os.environ.get("TMPDIR", "/tmp").rstrip("/"), "jom-auditoria-%s-%s" % (a.modo, stamp)))
    os.makedirs(os.path.join(ctx.out, "logs"), exist_ok=True)
    t0 = time.time()
    say("Auditoría %s · repo %s · origen %s" % (a.modo, ctx.repo, ctx.src))
    print("  informe en %s" % ctx.out)
    pasos = [("git", ch_git), ("origen", lambda c: ch_src(c, a.modo))]
    if a.modo == "estudio":
        pasos.append(("kit", ch_kit))
    pasos += [("navegador", lambda c: ch_navegador(c, a.modo)), ("csp", ch_csp), ("tipografia", lambda c: ch_tipografia(c, a.modo)),
              ("alfa", lambda c: ch_alfa(c, a.modo)), ("video", lambda c: ch_video(c, a.modo)),
              ("seguridad-web", lambda c: ch_seguridad_web(c, a.modo))]
    if a.modo == "estudio":
        pasos += [("migracion-ensayo", ch_migracion), ("seguridad-repo", ch_seguridad_repo), ("correo", ch_correo),
                  ("lanzadores", ch_lanzadores), ("instalacion", ch_instalacion)]
    necesitan_origen = ("kit", "navegador", "csp", "tipografia", "alfa", "video", "seguridad-web", "migracion-ensayo")
    areas = {"kit": "web", "navegador": "web", "csp": "seguridad", "tipografia": "branding", "alfa": "video",
             "video": "video", "seguridad-web": "seguridad", "migracion-ensayo": "web"}
    res = []
    origen_ok = True
    for cid, f in pasos:
        if not origen_ok and cid in necesitan_origen:
            r = resultado(cid, areas[cid], "OMITIDO", "sin carpeta de origen válida (%s)" % ctx.src)
        else:
            r = f(ctx)
        if cid == "origen" and r["estado"] == "FAIL":
            origen_ok = False
        res.append(r)
        print("  %s %-18s %s" % (ICON[r["estado"]], r["id"], r["detalle"][:160]), flush=True)
        if cid == "migracion-ensayo" and r["estado"] in ("PASS", "WARN"):
            r2 = ch_navegador(ctx, "estudio", staging=True)
            res.append(r2)
            print("  %s %-18s %s" % (ICON[r2["estado"]], r2["id"], r2["detalle"][:160]), flush=True)
    datos = informe(ctx, a.modo, res, t0)
    if a.json:
        print(json.dumps(datos, ensure_ascii=False, indent=2))
    return 1 if datos["resumen"]["FAIL"] else 0


if __name__ == "__main__":
    sys.exit(main())
