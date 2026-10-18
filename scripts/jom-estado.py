#!/usr/bin/env python3
"""JOM Estudio · estado persistente de tareas, para no perder nunca por dónde ibas.

Lo usan el skill jom-estudio (y sus sub-skills) y el Stop hook jom-no-parar.py.
Solo biblioteca estándar; compatible con el /usr/bin/python3 (3.9) de macOS.

Uso:
  jom-estado.py iniciar "<tarea>" --pasos "a;b;c" [--dod "…"] [--plan ID] [--en-cola]
  jom-estado.py paso-hecho N [--evidencia "…"]
  jom-estado.py bloquear N --necesita "…"        (solo lo que únicamente el CEO puede resolver)
  jom-estado.py desbloquear N [--nota "…"]
  jom-estado.py nota "…" [--paso N]              (miga de pan: marca el paso en curso)
  jom-estado.py agregar "paso x;paso y"          (añade pasos al final de la tarea activa)
  jom-estado.py workflow RUN_ID [--nombre "…"] [--paso N]   (para resumeFromRunId)
  jom-estado.py siguiente | estado | reanudar | historial [-n 20]
  jom-estado.py terminar [--resumen "…"] [--forzar]
  jom-estado.py pausar [--motivo "…"] | cancelar [--motivo "…"] | activar ID
  jom-estado.py skills [--buscar "movimientos de video"]
Opciones (antes o después del comando):
  --archivo RUTA   estado explícito (también JOM_ESTADO=RUTA)
  --global         usar ~/.jom/estado.json
  --json           salida para máquinas
  --sync-context RUTA/.context_sync.json   tras escribir, actualiza SOLO la clave
                   "jom_estudio" de ese archivo (con copia .bak). Úsalo solo si el CEO lo confirmó.

Dónde vive el estado: el .jom/estado.json más cercano (de la carpeta actual hacia
arriba) que tenga tareas vivas; si no hay, <raíz git>/.jom/estado.json o, fuera de
un repo, ~/.jom/estado.json. Escritura atómica (tmp + os.replace) bajo candado
(flock); estado.json.bak es espejo de la última versión válida (si el JSON se daña,
se lee de ahí y el dañado se guarda como estado.json.dañado-<fecha>).

Las tareas forman una cola: «iniciar» pone la nueva delante y deja la anterior en
espera (no se pierde); «terminar» reactiva la siguiente en espera.
Códigos de salida: 0 bien · 1 uso o regla incumplida · 2 error interno/candado ·
3 («siguiente») no hay nada que hacer ahora.
"""

import argparse
import contextlib
import json
import os
import re
import shlex
import shutil
import sys
import time
import unicodedata
from datetime import datetime

try:
    import fcntl
except ImportError:  # pragma: no cover (Windows)
    fcntl = None

VERSION = "1.0.0"
VIVAS = ("activa", "en-espera", "pausada")
MAX_HISTORIAL = 300
MAX_TERMINADAS = 30
GITIGNORE = "# Generado por jom-estado.py: solo se versiona estado.json (sin datos privados).\n*.lock\n*.tmp\n*.bak\nno-parar.json\nestado.json.dañado-*\n"


class Fallo(Exception):
    def __init__(self, msg, codigo=1):
        Exception.__init__(self, msg)
        self.codigo = codigo


# ---------------------------------------------------------------- utilidades
def ahora():
    return datetime.now().astimezone().isoformat(timespec="seconds")


def casa():
    return os.path.expanduser("~")


def corto(ruta):
    """~/… en lugar de /Users/<nombre>/… (no deja el nombre de usuario en el estado)."""
    h = casa().rstrip("/")
    if ruta == h or ruta.startswith(h + "/"):
        return "~" + ruta[len(h):]
    return ruta


def raiz_git(desde):
    d = os.path.abspath(desde)
    while True:
        if os.path.exists(os.path.join(d, ".git")):
            return d
        p = os.path.dirname(d)
        if p == d:
            return None
        d = p


def candidatos(desde):
    vistos, out = set(), []
    d = os.path.abspath(desde)
    while True:
        p = os.path.join(d, ".jom", "estado.json")
        if p not in vistos:
            vistos.add(p)
            out.append(p)
        padre = os.path.dirname(d)
        if padre == d:
            break
        d = padre
    g = os.path.join(casa(), ".jom", "estado.json")
    if g not in vistos:
        out.append(g)
    return out


# Datos privados: el repo de la web es PÚBLICO y estado.json puede versionarse.
_PRIV = [
    (re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"), "[email]"),
    (re.compile(r"(?<![\w/.-])\+\d[\d \-().]{7,}\d"), "[tel]"),
    (re.compile(r"\b(?:58|0)?4(?:12|14|16|24|26)[- ]?\d{3}[- ]?\d{4}\b"), "[tel]"),
    (re.compile(r"\b(ghp|gho|ghs|github_pat)_[A-Za-z0-9_]{16,}"), "[secreto]"),
    (re.compile(r"\bsk-[A-Za-z0-9_-]{16,}"), "[secreto]"),
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "[secreto]"),
    (re.compile(r"\bxox[abpr]-[A-Za-z0-9-]{10,}"), "[secreto]"),
    (re.compile(r"(?i)\b(password|passwd|contraseña|contrasena|clave|token|secret|api[_-]?key)(\s*[:=]\s*)\S+"), r"\1\2[secreto]"),
]


def limpiar(texto, avisar=True):
    t = " ".join(str(texto or "").split())
    original = t
    for rx, rep in _PRIV:
        t = rx.sub(rep, t)
    if t != original and avisar:
        print("  ⚠ oculté datos privados (email/teléfono/secreto): el estado no debe guardarlos", file=sys.stderr)
    return t[:2000]


def partir_pasos(texto):
    return [p.strip() for p in str(texto or "").split(";") if p.strip()]


# ---------------------------------------------------------------- persistencia
def nuevo_estado():
    return {"version": 1, "rev": 0, "actualizado": "", "sig_id": 1, "tareas": [], "terminadas": [], "historial": []}


def _normalizar(d):
    if not isinstance(d, dict):
        raise ValueError("no es un objeto JSON")
    base = nuevo_estado()
    for k, v in base.items():
        d.setdefault(k, v)
    for k in ("tareas", "terminadas", "historial"):
        if not isinstance(d[k], list):
            raise ValueError("'%s' no es una lista" % k)
    return d


def leer(ruta, avisar=True):
    """Lee el estado. Si está dañado usa estado.json.bak (y lo avisa)."""
    if not os.path.isfile(ruta):
        return nuevo_estado(), False
    try:
        with open(ruta, "r", encoding="utf-8") as f:
            return _normalizar(json.load(f)), False
    except (OSError, ValueError) as e:
        bak = ruta + ".bak"
        try:
            with open(bak, "r", encoding="utf-8") as f:
                d = _normalizar(json.load(f))
            if avisar:
                print("  ⚠ %s está dañado (%s); uso la copia %s" % (corto(ruta), e, os.path.basename(bak)), file=sys.stderr)
            return d, True
        except (OSError, ValueError):
            raise Fallo("%s está dañado (%s) y no hay copia válida; revísalo a mano o muévelo" % (corto(ruta), e), 2)


def asegurar_carpeta(ruta):
    carpeta = os.path.dirname(ruta)
    os.makedirs(carpeta, exist_ok=True)
    gi = os.path.join(carpeta, ".gitignore")
    if not os.path.exists(gi):
        with open(gi, "w", encoding="utf-8") as f:
            f.write(GITIGNORE)


@contextlib.contextmanager
def candado(ruta, espera=10.0):
    asegurar_carpeta(ruta)
    lp = os.path.join(os.path.dirname(ruta), "estado.lock")
    fd = os.open(lp, os.O_RDWR | os.O_CREAT, 0o600)
    try:
        if fcntl is not None:
            t0 = time.time()
            while True:
                try:
                    fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    break
                except OSError:
                    if time.time() - t0 > espera:
                        raise Fallo("otro proceso tiene el estado ocupado más de %d s (%s)" % (espera, corto(lp)), 2)
                    time.sleep(0.03)
        yield
    finally:
        if fcntl is not None:
            try:
                fcntl.flock(fd, fcntl.LOCK_UN)
            except OSError:
                pass
        os.close(fd)


def _volcar(ruta, contenido):
    tmp = "%s.%d.%d.tmp" % (ruta, os.getpid(), int(time.time() * 1000000) % 1000000)
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(contenido)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, ruta)


def escribir_atomico(ruta, datos):
    """tmp + fsync + os.replace; estado.json.bak queda como espejo de la última versión buena."""
    contenido = json.dumps(datos, ensure_ascii=False, indent=2) + "\n"
    if os.path.isfile(ruta):
        try:
            with open(ruta, "r", encoding="utf-8") as f:
                json.load(f)
        except (OSError, ValueError):
            try:  # el dañado no se pierde: queda al lado para revisarlo
                shutil.copy2(ruta, "%s.dañado-%s" % (ruta, datetime.now().strftime("%Y%m%d-%H%M%S")))
            except OSError:
                pass
    _volcar(ruta, contenido)
    _volcar(ruta + ".bak", contenido)


# ---------------------------------------------------------------- modelo
def tarea_activa(d):
    for t in d["tareas"]:
        if t.get("estado") == "activa":
            return t
    return None


def siguiente_paso(t):
    for p in t.get("pasos", []):
        if p.get("estado") in ("en-curso", "pendiente"):
            return p
    return None


def pendientes(t):
    return [p for p in t.get("pasos", []) if p.get("estado") != "hecho"]


def hechos(t):
    return sum(1 for p in t.get("pasos", []) if p.get("estado") == "hecho")


def buscar_paso(t, n):
    for p in t.get("pasos", []):
        if p.get("n") == n:
            return p
    raise Fallo("la tarea %s no tiene paso %s (tiene 1–%d)" % (t["id"], n, len(t.get("pasos", []))))


def evento(d, t, que, detalle=""):
    d["historial"].append({"fecha": ahora(), "tarea": t["id"] if t else "", "evento": que, "detalle": limpiar(detalle, avisar=False)[:300]})
    if len(d["historial"]) > MAX_HISTORIAL:
        del d["historial"][: len(d["historial"]) - MAX_HISTORIAL]


def tocar(t):
    t["actualizada"] = ahora()
    t["ts"] = int(time.time())


def necesita_activa(d):
    t = tarea_activa(d)
    if t:
        return t
    vivas = [x for x in d["tareas"] if x.get("estado") in VIVAS]
    if vivas:
        raise Fallo("no hay tarea activa (hay %d en espera/pausadas): usa «reanudar» o «activar ID»" % len(vivas))
    raise Fallo("no hay ninguna tarea: créala con «iniciar»")


def promover_siguiente(d):
    """Tras terminar/cancelar: la primera tarea en espera o pausada pasa a activa."""
    if tarea_activa(d):
        return None
    for t in d["tareas"]:
        if t.get("estado") in ("en-espera", "pausada"):
            t["estado"] = "activa"
            tocar(t)
            evento(d, t, "reactivada", "sigue tras la anterior")
            return t
    return None


def archivar(d, t):
    d["tareas"] = [x for x in d["tareas"] if x is not t]
    d["terminadas"].insert(0, t)
    del d["terminadas"][MAX_TERMINADAS:]


# ---------------------------------------------------------------- salida
ICON = {"hecho": "✔", "pendiente": "○", "en-curso": "▶", "bloqueado": "⏸"}


def ruta_herramienta():
    return os.path.abspath(sys.argv[0]) if sys.argv and sys.argv[0] else "jom-estado.py"


def cmd_base(ruta_estado):
    return "python3 %s --archivo %s" % (shlex.quote(ruta_herramienta()), shlex.quote(ruta_estado))


def resumen_tarea(t):
    return "%s «%s» (%s) · %d/%d hechos" % (t["id"], t["titulo"], t["estado"], hechos(t), len(t.get("pasos", [])))


def lineas_pasos(t, marcar=None):
    out = []
    for p in t.get("pasos", []):
        ic = ICON.get(p.get("estado"), "?")
        txt = "  %s %d. %s" % (ic, p["n"], p["texto"])
        if marcar is not None and p is marcar:
            txt += "   ← SIGUIENTE"
        out.append(txt)
        if p.get("estado") == "hecho" and p.get("evidencia"):
            out.append("       evidencia: %s" % p["evidencia"][-1])
        if p.get("estado") == "bloqueado":
            out.append("       necesita del CEO: %s" % p.get("necesita", ""))
        if p.get("estado") != "hecho" and p.get("notas"):
            out.append("       última nota: %s" % p["notas"][-1])
    return out


def imprimir_json(obj):
    print(json.dumps(obj, ensure_ascii=False, indent=2))


def vista(d, ruta):
    t = tarea_activa(d)
    sig = siguiente_paso(t) if t else None
    return {"archivo": ruta, "rev": d["rev"], "activa": t, "siguiente": sig,
            "cola": [{"id": x["id"], "titulo": x["titulo"], "estado": x["estado"], "hechos": hechos(x),
                      "pasos": len(x.get("pasos", []))} for x in d["tareas"]]}


# ---------------------------------------------------------------- .context_sync.json
def sync_context(ruta_ctx, d, ruta_estado):
    ruta_ctx = os.path.abspath(os.path.expanduser(ruta_ctx))
    if not os.path.isfile(ruta_ctx):
        raise Fallo("no existe %s (no lo creo: es del IDE)" % corto(ruta_ctx))
    with open(ruta_ctx, "r", encoding="utf-8") as f:
        texto = f.read()
    try:
        ctx = json.loads(texto)
    except ValueError as e:
        raise Fallo("%s no es JSON válido (%s): no lo toco" % (corto(ruta_ctx), e))
    if not isinstance(ctx, dict):
        raise Fallo("%s no es un objeto JSON: no lo toco" % corto(ruta_ctx))
    m = re.search(r"\n([ \t]+)\S", texto)
    sangria = m.group(1) if m else "  "
    t = tarea_activa(d)
    sig = siguiente_paso(t) if t else None
    ctx["jom_estudio"] = {
        "actualizado": ahora(),
        "estado_archivo": corto(ruta_estado),
        "tarea": t["titulo"] if t else None,
        "id": t["id"] if t else None,
        "estado": t["estado"] if t else "sin tarea activa",
        "progreso": ("%d/%d" % (hechos(t), len(t["pasos"]))) if t else None,
        "siguiente": {"n": sig["n"], "texto": sig["texto"]} if sig else None,
        "bloqueados": [{"n": p["n"], "necesita": p.get("necesita", "")} for p in (t["pasos"] if t else []) if p["estado"] == "bloqueado"],
        "en_cola": [x["titulo"] for x in d["tareas"] if x is not t],
        "reanudar": "python3 ~/.claude/jom/jom-estado.py reanudar",
    }
    shutil.copy2(ruta_ctx, ruta_ctx + ".bak")
    tmp = ruta_ctx + ".jom.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(ctx, f, ensure_ascii=False, indent=sangria)
        f.write("\n")
    os.replace(tmp, ruta_ctx)
    print("  ✔ %s: clave jom_estudio actualizada (copia en %s.bak)" % (corto(ruta_ctx), os.path.basename(ruta_ctx)))


# ---------------------------------------------------------------- skills
_SINONIMOS = {
    "movimiento": ["motion", "animacion", "loop"], "motion": ["movimiento"], "video": ["videos", "clip"],
    "auditoria": ["audit", "auditar", "revision", "verificar"], "auditar": ["auditoria", "audit"],
    "tipografia": ["fuente", "font", "typography", "tipografico"], "fuente": ["font", "tipografia"],
    "correo": ["email", "mail", "gmail", "prospeccion"], "seguridad": ["security", "sentinel", "owasp", "csp"],
    "youtube": ["short", "reel", "canal"], "web": ["pagina", "staging", "migrar", "kit"],
    "escena": ["scene", "threejs"], "3d": ["three", "threejs", "glb"], "accesibilidad": ["a11y"],
    "estudio": ["orquestador", "jom"], "home": ["inicio", "concept_master_horizontal"],
}
_VACIAS = set("activa activar el la los las de del un una unos unas que para mi mis con y o en por al a skill skills "
              "quiero dale usa usar haz hacer the of to and lo".split())


def _norm(s):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode("ascii").lower()
    return [w for w in re.split(r"[^a-z0-9]+", s) if w]


def _raiz(w):
    if len(w) > 5 and w.endswith("es"):
        return w[:-2]
    if len(w) > 3 and w.endswith("s"):
        return w[:-1]
    return w


def frontmatter(ruta):
    try:
        with open(ruta, "r", encoding="utf-8") as f:
            texto = f.read(20000)
    except OSError:
        return None
    lineas = texto.splitlines()
    if not lineas or lineas[0].strip() != "---":
        return None
    datos, clave, bloque = {}, None, []
    for ln in lineas[1:]:
        if ln.strip() == "---":
            break
        m = re.match(r"^([A-Za-z0-9_-]+):\s*(.*)$", ln)
        if m and not ln.startswith((" ", "\t")):
            if clave and bloque:
                datos[clave] = " ".join(bloque)
            clave, valor = m.group(1), m.group(2).strip()
            bloque = []
            if valor in ("|", ">", "|-", ">-", "|+", ">+", ""):
                datos[clave] = ""
            else:
                if len(valor) >= 2 and valor[0] == valor[-1] and valor[0] in "\"'":
                    valor = valor[1:-1]
                datos[clave] = valor
                clave = None
        elif clave:
            bloque.append(ln.strip())
    else:
        return None  # sin cierre ---
    if clave and bloque:
        datos[clave] = " ".join(bloque)
    return datos


def raices_skills(desde):
    out = []
    g = raiz_git(desde)
    if g:
        out.append(os.path.join(g, ".claude", "skills"))
    out += [os.path.join(casa(), ".claude", "skills"), os.path.join(casa(), ".gemini", "config", "skills")]
    for extra in os.environ.get("JOM_SKILLS_DIRS", "").split(os.pathsep):
        if extra:
            out.append(os.path.expanduser(extra))
    vistos, res = set(), []
    for r in out:
        r = os.path.abspath(r)
        if r not in vistos:
            vistos.add(r)
            res.append(r)
    return res


def listar_skills(desde):
    res = []
    for raiz in raices_skills(desde):
        if not os.path.isdir(raiz):
            continue
        for actual, dirs, files in os.walk(raiz):
            prof = actual[len(raiz):].count(os.sep)
            dirs[:] = [x for x in dirs if not x.startswith(".")] if prof < 3 else []
            if "SKILL.md" in files:
                fm = frontmatter(os.path.join(actual, "SKILL.md")) or {}
                res.append({"nombre": fm.get("name") or os.path.basename(actual), "descripcion": fm.get("description", ""),
                            "ruta": os.path.join(actual, "SKILL.md"), "origen": corto(raiz)})
    return res


def puntuar(consulta, sk):
    q = [w for w in _norm(consulta) if w not in _VACIAS]
    if not q:
        return 0
    nombre = set(_raiz(w) for w in _norm(sk["nombre"]))
    desc = set(_raiz(w) for w in _norm(sk["descripcion"]))
    total = 0
    for w in q:
        variantes = set([_raiz(w)] + [_raiz(x) for x in _SINONIMOS.get(_raiz(w), []) + _SINONIMOS.get(w, [])])
        if variantes & nombre:
            total += 3
        elif variantes & desc:
            total += 1
    if " ".join(_norm(consulta)) == " ".join(_norm(sk["nombre"])):
        total += 10
    return total


# ---------------------------------------------------------------- comandos
def elegir_archivo(a, para_crear=False):
    if getattr(a, "archivo", None):
        return os.path.abspath(os.path.expanduser(a.archivo))
    if os.environ.get("JOM_ESTADO"):
        return os.path.abspath(os.path.expanduser(os.environ["JOM_ESTADO"]))
    g = os.path.join(casa(), ".jom", "estado.json")
    if getattr(a, "global_", False):
        return g
    existentes = [p for p in candidatos(os.getcwd()) if os.path.isfile(p)]
    for p in existentes:
        try:
            d, _ = leer(p, avisar=False)
        except Fallo:
            continue
        if any(t.get("estado") in VIVAS for t in d["tareas"]):
            return p
    if not para_crear and existentes:
        return existentes[0]
    r = raiz_git(os.getcwd())
    return os.path.join(r, ".jom", "estado.json") if r else g


def c_iniciar(a, d, ruta):
    pasos = partir_pasos(a.pasos)
    if not pasos:
        raise Fallo("--pasos necesita al menos un paso (separados por ';')")
    tid = "t%d" % d["sig_id"]
    d["sig_id"] += 1
    t = {"id": tid, "titulo": limpiar(a.titulo), "estado": "activa", "plan": limpiar(a.plan or ""),
         "dod": limpiar(a.dod or "Todos los pasos hechos con evidencia y re-verificados; informe final entregado."),
         "creada": ahora(), "raiz": corto(os.getcwd()), "workflows": [], "resumen": "",
         "pasos": [{"n": i + 1, "texto": limpiar(p), "estado": "pendiente", "evidencia": [], "notas": [], "necesita": ""}
                   for i, p in enumerate(pasos)]}
    tocar(t)
    act = tarea_activa(d)
    if act and a.en_cola:
        t["estado"] = "en-espera"
        d["tareas"].append(t)
        evento(d, t, "en-cola", t["titulo"])
        msg = "  ✔ %s en cola detrás de %s «%s»" % (tid, act["id"], act["titulo"])
    else:
        if act:
            act["estado"] = "en-espera"
            tocar(act)
            evento(d, act, "en-espera", "interrumpida por %s; se retoma al terminar" % tid)
        d["tareas"].insert(0, t)
        evento(d, t, "iniciada", t["titulo"])
        msg = "  ✔ %s «%s» activa con %d pasos" % (tid, t["titulo"], len(pasos))
        if act:
            msg += "\n  · %s «%s» queda EN ESPERA (%d/%d) y se retoma al terminar esta" % (act["id"], act["titulo"], hechos(act), len(act["pasos"]))
    return msg


def c_paso_hecho(a, d, ruta):
    t = necesita_activa(d)
    p = buscar_paso(t, a.n)
    p["estado"] = "hecho"
    p["hecho"] = ahora()
    p["necesita"] = ""
    if a.evidencia:
        p["evidencia"].append(limpiar(a.evidencia))
    tocar(t)
    t.pop("atascado", None)
    evento(d, t, "paso-hecho", "%d. %s" % (p["n"], p["texto"]))
    sig = siguiente_paso(t)
    msg = "  ✔ %s paso %d hecho (%d/%d)" % (t["id"], p["n"], hechos(t), len(t["pasos"]))
    if not a.evidencia:
        msg += "\n  ⚠ sin --evidencia: añade la prueba (comando y resultado) para el informe final"
    if sig:
        msg += "\n  ▶ siguiente: %d. %s" % (sig["n"], sig["texto"])
    elif pendientes(t):
        msg += "\n  ⏸ quedan pasos bloqueados por el CEO"
    else:
        msg += "\n  ▶ todos los pasos hechos: re-verifica, entrega el informe y ejecuta «terminar»"
    return msg


def c_bloquear(a, d, ruta):
    t = necesita_activa(d)
    p = buscar_paso(t, a.n)
    if p["estado"] == "hecho":
        raise Fallo("el paso %d ya está hecho" % a.n)
    if not a.necesita.strip():
        raise Fallo("--necesita debe decir la acción exacta que tiene que hacer el CEO")
    p["estado"] = "bloqueado"
    p["necesita"] = limpiar(a.necesita)
    tocar(t)
    evento(d, t, "bloqueado", "%d. necesita: %s" % (p["n"], p["necesita"]))
    sig = siguiente_paso(t)
    msg = "  ⏸ %s paso %d bloqueado · el CEO tiene que: %s" % (t["id"], p["n"], p["necesita"])
    if sig:
        msg += "\n  ▶ mientras tanto sigue con: %d. %s" % (sig["n"], sig["texto"])
    return msg


def c_desbloquear(a, d, ruta):
    t = necesita_activa(d)
    p = buscar_paso(t, a.n)
    if p["estado"] != "bloqueado":
        raise Fallo("el paso %d no está bloqueado (%s)" % (a.n, p["estado"]))
    p["estado"] = "pendiente"
    if a.nota:
        p["notas"].append(limpiar(a.nota))
    p["necesita"] = ""
    tocar(t)
    evento(d, t, "desbloqueado", "%d" % p["n"])
    return "  ✔ %s paso %d desbloqueado: %s" % (t["id"], p["n"], p["texto"])


def c_nota(a, d, ruta):
    t = necesita_activa(d)
    p = buscar_paso(t, a.paso) if a.paso else siguiente_paso(t)
    if p is None:
        raise Fallo("no hay paso pendiente al que anotar (usa --paso N)")
    p["notas"].append(limpiar(a.texto))
    del p["notas"][:-20]
    if p["estado"] == "pendiente":
        p["estado"] = "en-curso"
    tocar(t)
    evento(d, t, "nota", "%d. %s" % (p["n"], a.texto))
    return "  ✔ nota en %s paso %d (%s)" % (t["id"], p["n"], p["estado"])


def c_agregar(a, d, ruta):
    t = necesita_activa(d)
    nuevos = partir_pasos(a.texto)
    if not nuevos:
        raise Fallo("nada que añadir")
    base = len(t["pasos"])
    for i, txt in enumerate(nuevos):
        t["pasos"].append({"n": base + i + 1, "texto": limpiar(txt), "estado": "pendiente", "evidencia": [], "notas": [], "necesita": ""})
    tocar(t)
    evento(d, t, "pasos-añadidos", "; ".join(nuevos))
    return "  ✔ %s: añadidos los pasos %d–%d" % (t["id"], base + 1, base + len(nuevos))


def c_workflow(a, d, ruta):
    t = necesita_activa(d)
    rid = a.run_id.strip()
    if not re.match(r"^[A-Za-z0-9_.:-]{3,120}$", rid):
        raise Fallo("RUN_ID inválido: %r" % rid)
    for w in t["workflows"]:
        if w["run_id"] == rid:
            w.update({"nombre": limpiar(a.nombre or w.get("nombre", "")), "paso": a.paso or w.get("paso")})
            break
    else:
        t["workflows"].append({"run_id": rid, "nombre": limpiar(a.nombre or ""), "paso": a.paso, "fecha": ahora()})
    tocar(t)
    evento(d, t, "workflow", rid)
    return "  ✔ %s: workflow %s registrado (se reanuda con resumeFromRunId)" % (t["id"], rid)


def c_terminar(a, d, ruta):
    t = necesita_activa(d)
    pend = pendientes(t)
    if pend and not a.forzar:
        raise Fallo("no se puede terminar %s: quedan %d pasos (%s). Hazlos, o márcalos bloqueados y deja la tarea abierta; "
                    "--forzar solo si el CEO lo pide" % (t["id"], len(pend), ", ".join(str(p["n"]) for p in pend)))
    t["estado"] = "terminada" if not pend else "terminada-forzada"
    t["terminada"] = ahora()
    if a.resumen:
        t["resumen"] = limpiar(a.resumen)
    tocar(t)
    evento(d, t, t["estado"], a.resumen or "")
    archivar(d, t)
    msg = "  ✔ %s «%s» %s (%d/%d pasos)" % (t["id"], t["titulo"], t["estado"], hechos(t), len(t["pasos"]))
    sig = promover_siguiente(d)
    if sig:
        p = siguiente_paso(sig)
        msg += "\n  ▶ se reanuda %s «%s»%s" % (sig["id"], sig["titulo"], (" en el paso %d. %s" % (p["n"], p["texto"])) if p else "")
    return msg


def c_cancelar(a, d, ruta):
    t = necesita_activa(d)
    t["estado"] = "cancelada"
    t["resumen"] = limpiar(a.motivo or "cancelada por el CEO")
    tocar(t)
    evento(d, t, "cancelada", a.motivo or "")
    archivar(d, t)
    sig = promover_siguiente(d)
    return "  ✔ %s cancelada%s" % (t["id"], ("\n  ▶ se reanuda %s «%s»" % (sig["id"], sig["titulo"])) if sig else "")


def c_pausar(a, d, ruta):
    n = 0
    for t in d["tareas"]:
        if t["estado"] in ("activa", "en-espera"):
            t["estado"] = "pausada"
            tocar(t)
            evento(d, t, "pausada", a.motivo or "")
            n += 1
    if not n:
        raise Fallo("no hay tareas que pausar")
    return "  ⏸ %d tarea(s) pausada(s): el hook ya no impide cerrar. Para seguir: «reanudar»" % n


def c_activar(a, d, ruta):
    obj = None
    for t in d["tareas"]:
        if t["id"] == a.id:
            obj = t
    if obj is None:
        raise Fallo("no hay tarea viva con id %s" % a.id)
    act = tarea_activa(d)
    if act is not None and act is not obj:
        act["estado"] = "en-espera"
        tocar(act)
    obj["estado"] = "activa"
    tocar(obj)
    d["tareas"] = [obj] + [t for t in d["tareas"] if t is not obj]
    evento(d, obj, "activada", "")
    return "  ✔ %s «%s» activa" % (obj["id"], obj["titulo"])


def c_reanudar(a, d, ruta):
    t = tarea_activa(d)
    reactivadas = 0
    if t is None:
        for x in d["tareas"]:
            if x["estado"] in ("pausada", "en-espera"):
                if t is None:
                    x["estado"] = "activa"
                    t = x
                elif x["estado"] == "pausada":
                    x["estado"] = "en-espera"
                tocar(x)
                reactivadas += 1
    else:
        for x in d["tareas"]:
            if x["estado"] == "pausada":
                x["estado"] = "en-espera"
                tocar(x)
                reactivadas += 1
    if t is not None:
        t.pop("atascado", None)
        tocar(t)
        evento(d, t, "reanudar", "")
    # el contador anti-bucle del hook vuelve a cero
    np = os.path.join(os.path.dirname(ruta), "no-parar.json")
    if os.path.exists(np):
        try:
            os.remove(np)
        except OSError:
            pass
    return None if t is None and not reactivadas else ""


def texto_reanudar(d, ruta):
    t = tarea_activa(d)
    if t is None:
        return "==> No hay tareas pendientes en %s\n  Crea una con: %s iniciar \"<tarea>\" --pasos \"a;b;c\" --dod \"…\"" % (corto(ruta), cmd_base(ruta))
    sig = siguiente_paso(t)
    out = ["==> Reanudar · %s" % resumen_tarea(t), "  Archivo: %s" % corto(ruta), "  Terminado cuando: %s" % t["dod"]]
    if t.get("plan"):
        out.append("  Plan: %s" % t["plan"])
    out += lineas_pasos(t, sig)
    for w in t.get("workflows", []):
        out.append("  Workflow %s%s → reanúdalo con resumeFromRunId: \"%s\"" % (
            w["run_id"], (" (%s)" % w["nombre"]) if w.get("nombre") else "", w["run_id"]))
    if t.get("atascado"):
        out.append("  ⚠ el hook marcó la tarea como ATASCADA en el paso %s (%s): revisa por qué no avanza" % (
            t["atascado"].get("paso"), t["atascado"].get("fecha")))
    otras = [x for x in d["tareas"] if x is not t]
    for x in otras:
        out.append("  · después: %s" % resumen_tarea(x))
    base = cmd_base(ruta)
    out.append("Qué hacer ahora:")
    if sig:
        out.append("  1. Si el último paso hecho es de otra sesión, re-verifícalo antes de seguir.")
        out.append("  2. Ejecuta el paso %d: %s" % (sig["n"], sig["texto"]))
        out.append("  3. Al terminarlo: %s paso-hecho %d --evidencia \"<comando → resultado>\"" % (base, sig["n"]))
        out.append("  4. Si solo el CEO puede resolverlo: %s bloquear %d --necesita \"<acción exacta>\"" % (base, sig["n"]))
    elif pendientes(t):
        out.append("  Todo lo pendiente espera al CEO; díselo con la acción exacta de cada paso bloqueado.")
        out.append("  Cuando lo resuelva: %s desbloquear N" % base)
    else:
        out.append("  Todos los pasos hechos: re-verifica, entrega el informe final con evidencia y ejecuta:")
        out.append("  %s terminar --resumen \"…\"" % base)
    return "\n".join(out)


def texto_estado(d, ruta):
    if not d["tareas"]:
        ult = d["terminadas"][0] if d["terminadas"] else None
        return "==> Sin tareas vivas (%s)%s" % (corto(ruta), ("\n  Última: %s" % resumen_tarea(ult)) if ult else "")
    out = ["==> Estado JOM (%s · rev %d)" % (corto(ruta), d["rev"])]
    for t in d["tareas"]:
        out.append("  %s %s" % ("▶" if t["estado"] == "activa" else "·", resumen_tarea(t)))
    t = tarea_activa(d)
    if t:
        out.append("  Terminado cuando: %s" % t["dod"])
        out += lineas_pasos(t, siguiente_paso(t))
        if t.get("atascado"):
            out.append("  ⚠ ATASCADA en el paso %s según el hook (%s)" % (t["atascado"].get("paso"), t["atascado"].get("fecha")))
    return "\n".join(out)


ESCRIBEN = {"iniciar": c_iniciar, "paso-hecho": c_paso_hecho, "bloquear": c_bloquear, "desbloquear": c_desbloquear,
            "nota": c_nota, "agregar": c_agregar, "workflow": c_workflow, "terminar": c_terminar,
            "cancelar": c_cancelar, "pausar": c_pausar, "activar": c_activar, "reanudar": c_reanudar}


def parser():
    comun = argparse.ArgumentParser(add_help=False)
    comun.add_argument("--archivo", default=argparse.SUPPRESS, help="ruta del estado.json")
    comun.add_argument("--global", dest="global_", action="store_true", default=argparse.SUPPRESS, help="usar ~/.jom/estado.json")
    comun.add_argument("--json", action="store_true", default=argparse.SUPPRESS, help="salida JSON")
    comun.add_argument("--sync-context", default=argparse.SUPPRESS, help="actualizar la clave jom_estudio de ese .context_sync.json")
    p = argparse.ArgumentParser(prog="jom-estado.py", parents=[comun], description="Estado persistente de JOM Estudio.",
                                epilog=__doc__.split("Uso:")[1].split("Opciones")[0], formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--version", action="version", version="jom-estado %s" % VERSION)
    sub = p.add_subparsers(dest="comando", metavar="COMANDO")

    def s(n, h):
        return sub.add_parser(n, help=h, parents=[comun], description=h)

    x = s("iniciar", "crear una tarea con pasos y definición de terminado")
    x.add_argument("titulo")
    x.add_argument("--pasos", required=True, help="pasos separados por ';'")
    x.add_argument("--dod", help="definición de terminado")
    x.add_argument("--plan", help="id del plan (p. ej. auditoria-home)")
    x.add_argument("--en-cola", action="store_true", help="ponerla detrás de la activa en vez de delante")
    x = s("paso-hecho", "marcar un paso como hecho")
    x.add_argument("n", type=int)
    x.add_argument("--evidencia", help="comando y resultado que lo prueban")
    x = s("bloquear", "marcar un paso como bloqueado por el CEO")
    x.add_argument("n", type=int)
    x.add_argument("--necesita", required=True, help="acción exacta que tiene que hacer el CEO")
    x = s("desbloquear", "devolver un paso bloqueado a pendiente")
    x.add_argument("n", type=int)
    x.add_argument("--nota")
    x = s("nota", "anotar por dónde vas en un paso")
    x.add_argument("texto")
    x.add_argument("--paso", type=int)
    x = s("agregar", "añadir pasos al final")
    x.add_argument("texto")
    x = s("workflow", "registrar un workflow para reanudar con resumeFromRunId")
    x.add_argument("run_id")
    x.add_argument("--nombre")
    x.add_argument("--paso", type=int)
    s("siguiente", "siguiente paso accionable (sale con 3 si no hay)")
    s("estado", "resumen")
    s("reanudar", "plan exacto para retomar (reactiva lo pausado)")
    x = s("historial", "últimos eventos")
    x.add_argument("-n", type=int, default=20)
    x = s("terminar", "cerrar la tarea activa (exige todos los pasos hechos)")
    x.add_argument("--resumen")
    x.add_argument("--forzar", action="store_true")
    x = s("pausar", "pausar todas las tareas (el hook deja de bloquear)")
    x.add_argument("--motivo")
    x = s("cancelar", "cancelar la tarea activa")
    x.add_argument("--motivo")
    x = s("activar", "poner delante una tarea en espera")
    x.add_argument("id")
    x = s("skills", "buscar skills por nombre/descripción (.claude/skills, ~/.claude/skills, ~/.gemini/config/skills)")
    x.add_argument("--buscar", default="")
    return p


def main(argv=None):
    p = parser()
    a = p.parse_args(argv)
    if not a.comando:
        p.print_help()
        return 1
    como_json = getattr(a, "json", False)
    try:
        if a.comando == "skills":
            sk = listar_skills(os.getcwd())
            if a.buscar:
                for x in sk:
                    x["puntos"] = puntuar(a.buscar, x)
                sk = sorted([x for x in sk if x["puntos"] > 0], key=lambda x: (-x["puntos"], x["nombre"]))
            if como_json:
                imprimir_json(sk)
            else:
                if not sk:
                    print("  ⚠ ningún skill coincide%s" % (" con «%s»" % a.buscar if a.buscar else ""))
                for x in sk[:15 if a.buscar else 200]:
                    pts = (" [%d]" % x["puntos"]) if a.buscar else ""
                    print("  · %s%s  (%s)\n      %s\n      %s" % (x["nombre"], pts, x["origen"], x["descripcion"][:160], x["ruta"]))
            return 0 if sk else 3

        ruta = elegir_archivo(a, para_crear=(a.comando == "iniciar"))
        if a.comando == "reanudar" and not os.path.isfile(ruta):
            d = nuevo_estado()  # nada que retomar: no se crea ningún archivo
            if como_json:
                imprimir_json(vista(d, ruta))
            else:
                print(texto_reanudar(d, ruta))
            return 0
        if a.comando in ESCRIBEN:
            with candado(ruta):
                d, de_bak = leer(ruta)
                msg = ESCRIBEN[a.comando](a, d, ruta)
                if msg is not None or de_bak:
                    d["rev"] += 1
                    d["actualizado"] = ahora()
                    escribir_atomico(ruta, d)
            if a.comando == "reanudar":
                if como_json:
                    imprimir_json(vista(d, ruta))
                else:
                    print(texto_reanudar(d, ruta))
            elif como_json:
                imprimir_json(vista(d, ruta))
            else:
                print(msg)
            if getattr(a, "sync_context", None):
                try:
                    sync_context(a.sync_context, d, ruta)
                except Fallo as e:
                    raise Fallo("%s (el estado sí se guardó en %s)" % (e, corto(ruta)))
            return 0

        d, _ = leer(ruta)
        if a.comando == "estado":
            if como_json:
                imprimir_json(vista(d, ruta))
            else:
                print(texto_estado(d, ruta))
            return 0
        if a.comando == "siguiente":
            t = tarea_activa(d)
            sig = siguiente_paso(t) if t else None
            if como_json:
                imprimir_json({"tarea": t["id"] if t else None, "siguiente": sig,
                               "bloqueados": [x for x in (t["pasos"] if t else []) if x["estado"] == "bloqueado"]})
            elif sig:
                print("%s %d. %s" % (t["id"], sig["n"], sig["texto"]))
            elif t and pendientes(t):
                print("⏸ %s: todo lo pendiente espera al CEO" % t["id"])
            elif t:
                print("✔ %s: todos los pasos hechos → re-verifica, informe final y «terminar»" % t["id"])
            else:
                print("· sin tarea activa")
            return 0 if sig else 3
        if a.comando == "historial":
            ev = d["historial"][-a.n:] if a.n > 0 else []
            if como_json:
                imprimir_json(ev)
            else:
                if not ev:
                    print("  (sin eventos)")
                for e in ev:
                    print("  %s  %-4s %-14s %s" % (e["fecha"], e.get("tarea", ""), e["evento"], e.get("detalle", "")))
            return 0
    except Fallo as e:
        print("✖ %s" % e, file=sys.stderr)
        return e.codigo
    return 1


if __name__ == "__main__":
    sys.exit(main())
