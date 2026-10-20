#!/usr/bin/env python3
"""JOM Estudio · Stop hook «no parar hasta terminar» para Claude Code.

Claude Code lo ejecuta cada vez que Claude va a cerrar un turno y le pasa por
stdin un JSON (session_id, transcript_path, cwd, stop_hook_active, …).

  · Hay una tarea viva (activa o en espera, no pausada) en .jom/estado.json
    (buscado desde cwd hacia arriba y en ~/.jom/estado.json) con un paso
    pendiente NO bloqueado → imprime {"decision":"block","reason":"…"} con el
    siguiente paso exacto y Claude sigue trabajando.
  · Todos los pasos hechos pero la tarea sin cerrar → bloquea para el cierre
    (re-verificar, informe final, «terminar»).
  · Todo lo pendiente está bloqueado por el CEO, la tarea está pausada, no hay
    tarea o lleva más de JOM_NO_PARAR_HORAS (24) sin moverse → no bloquea.
  · Anti-bucle: cuenta los bloqueos seguidos SIN progreso (los pasos no cambian).
    Tras JOM_NO_PARAR_MAX (5) deja parar, marca la tarea como «atascada» en el
    estado (lo ve el CEO con «estado»/«reanudar») y avisa con systemMessage.
    No se usa stop_hook_active para cortar: el CEO quiere que siga hasta terminar;
    el contador es el freno. «reanudar» o cualquier progreso lo pone a cero.
  · Nunca rompe nada: ante cualquier error, no bloquea y sale con 0.
  · JOM_NO_PARAR=0 lo desactiva.

Solo biblioteca estándar (Python 3.9 de macOS).
"""

import hashlib
import json
import os
import shlex
import sys
import time
from datetime import datetime

try:
    import fcntl
except ImportError:  # pragma: no cover
    fcntl = None


def _entero(nombre, defecto):
    try:
        return max(1, int(os.environ.get(nombre, defecto)))
    except ValueError:
        return defecto


MAX_SIN_PROGRESO = _entero("JOM_NO_PARAR_MAX", 5)
HORAS_CADUCA = _entero("JOM_NO_PARAR_HORAS", 24)


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
    g = os.path.join(os.path.expanduser("~"), ".jom", "estado.json")
    if g not in vistos:
        out.append(g)
    return out


def leer_json(ruta):
    try:
        with open(ruta, "r", encoding="utf-8") as f:
            d = json.load(f)
        return d if isinstance(d, dict) else None
    except (OSError, ValueError):
        return None


def herramienta():
    aqui = os.path.dirname(os.path.abspath(__file__))
    for c in (os.path.join(aqui, "jom-estado.py"), os.path.join(os.path.dirname(aqui), "jom-estado.py")):
        if os.path.isfile(c):
            return c
    return os.path.join(os.path.expanduser("~"), ".claude", "jom", "jom-estado.py")


def accionable(t):
    """(paso siguiente, hay_pendientes). Paso = primero en-curso/pendiente."""
    pend = False
    for p in t.get("pasos") or []:
        e = p.get("estado")
        if e != "hecho":
            pend = True
        if e in ("en-curso", "pendiente"):
            return p, True
    return None, pend


def elegir(cwd):
    """Primer estado.json con trabajo que Claude puede hacer ya."""
    ahora = time.time()
    for ruta in candidatos(cwd):
        if not os.path.isfile(ruta):
            continue
        d = leer_json(ruta)
        if not d or not isinstance(d.get("tareas"), list):
            continue
        tareas = [t for t in d["tareas"] if isinstance(t, dict) and t.get("estado") in ("activa", "en-espera")]
        tareas.sort(key=lambda t: 0 if t.get("estado") == "activa" else 1)
        for t in tareas:
            ts = t.get("ts")
            if isinstance(ts, (int, float)) and ahora - ts > HORAS_CADUCA * 3600:
                continue  # olvidada: no atrapa al CEO
            paso, pend = accionable(t)
            if paso is not None or not pend:
                return ruta, d, t, paso
    return None


def firma(d):
    pasos = []
    for t in d.get("tareas") or []:
        if isinstance(t, dict):
            pasos.append([t.get("id"), t.get("estado"),
                          [[p.get("n"), p.get("estado"), len(p.get("evidencia") or []), len(p.get("notas") or [])]
                           for p in (t.get("pasos") or []) if isinstance(p, dict)]])
    return hashlib.sha1(json.dumps(pasos, sort_keys=True).encode("utf-8")).hexdigest()


class Candado(object):
    def __init__(self, carpeta, espera=2.0):
        self.ruta = os.path.join(carpeta, "estado.lock")
        self.espera = espera
        self.fd = None

    def __enter__(self):
        self.fd = os.open(self.ruta, os.O_RDWR | os.O_CREAT, 0o600)
        if fcntl is not None:
            t0 = time.time()
            while True:
                try:
                    fcntl.flock(self.fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    break
                except OSError:
                    if time.time() - t0 > self.espera:
                        os.close(self.fd)
                        self.fd = None
                        raise
                    time.sleep(0.03)
        return self

    def __exit__(self, *exc):
        if self.fd is not None:
            if fcntl is not None:
                try:
                    fcntl.flock(self.fd, fcntl.LOCK_UN)
                except OSError:
                    pass
            os.close(self.fd)
        return False


def escribir(ruta, datos):
    tmp = "%s.%d.hook.tmp" % (ruta, os.getpid())
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=2)
        f.write("\n")
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, ruta)


def marcar_atascada(ruta, tid, paso_n, veces):
    """Deja constancia en estado.json (sin tocar los pasos: no cuenta como progreso)."""
    d = leer_json(ruta)
    if not d:
        return
    marca = datetime.now().astimezone().isoformat(timespec="seconds")
    for t in d.get("tareas") or []:
        if isinstance(t, dict) and t.get("id") == tid:
            t["atascado"] = {"paso": paso_n, "bloqueos": veces, "fecha": marca}
    hist = d.setdefault("historial", [])
    if isinstance(hist, list):
        hist.append({"fecha": marca, "tarea": tid, "evento": "atascada",
                     "detalle": "el hook dejó parar tras %d bloqueos sin progreso (paso %s)" % (veces, paso_n)})
        del hist[:-300]
    d["rev"] = int(d.get("rev") or 0) + 1
    escribir(ruta, d)


def razon(ruta, t, paso, veces):
    j = shlex.quote(herramienta())
    base = "python3 %s --archivo %s" % (j, shlex.quote(ruta))
    total = len(t.get("pasos") or [])
    hechos = sum(1 for p in t.get("pasos") or [] if p.get("estado") == "hecho")
    cab = "JOM Estudio · tarea %s «%s» sin terminar (%d/%d pasos). " % (t.get("id"), t.get("titulo"), hechos, total)
    if paso is None:
        return (cab + "Todos los pasos están hechos pero falta el cierre: re-verifica lo hecho, entrega el informe "
                "final con evidencia y ejecuta: %s terminar --resumen \"…\"" % base)
    txt = cab + "Sigue AHORA con el paso %s: %s. " % (paso.get("n"), paso.get("texto"))
    notas = paso.get("notas") or []
    if notas:
        txt += "Última nota: %s. " % notas[-1]
    if t.get("estado") != "activa":
        txt += "(Es una tarea en espera: actívala con %s activar %s.) " % (base, t.get("id"))
    txt += ("Al terminar el paso: %s paso-hecho %s --evidencia \"<comando → resultado>\". "
            "Si solo el CEO puede resolverlo: %s bloquear %s --necesita \"<acción exacta>\" y entonces podrás parar. "
            "Plan completo: %s reanudar. Si el CEO pidió parar: %s pausar. (aviso %d/%d sin progreso)"
            % (base, paso.get("n"), base, paso.get("n"), base, base, veces, MAX_SIN_PROGRESO))
    return txt


def decidir(entrada):
    if os.environ.get("JOM_NO_PARAR", "1").strip().lower() in ("0", "no", "off", "false"):
        return None
    cwd = entrada.get("cwd") if isinstance(entrada.get("cwd"), str) and entrada.get("cwd") else os.getcwd()
    hallado = elegir(cwd)
    if not hallado:
        return None
    ruta, d, t, paso = hallado
    carpeta = os.path.dirname(ruta)
    cont_ruta = os.path.join(carpeta, "no-parar.json")
    f = firma(d)
    with Candado(carpeta):
        c = leer_json(cont_ruta) or {}
        if c.get("atascado_firma") == f:
            return None  # ya se declaró atascada en este mismo punto: no insistir
        veces = int(c.get("bloqueos") or 0) + 1 if c.get("firma") == f else 1
        if veces > MAX_SIN_PROGRESO:
            c.update({"atascado_firma": f, "bloqueos": veces - 1})
            escribir(cont_ruta, c)
            marcar_atascada(ruta, t.get("id"), paso.get("n") if paso else "cierre", veces - 1)
            return {"systemMessage": "JOM Estudio: la tarea %s «%s» está ATASCADA en el paso %s tras %d intentos sin "
                                     "progreso; la dejo parar. Revisa con: python3 %s reanudar"
                                     % (t.get("id"), t.get("titulo"), paso.get("n") if paso else "de cierre",
                                        veces - 1, shlex.quote(herramienta()))}
        c.update({"firma": f, "bloqueos": veces, "tarea": t.get("id"), "sesion": str(entrada.get("session_id") or "")[:80],
                  "ultimo": datetime.now().astimezone().isoformat(timespec="seconds")})
        c.pop("atascado_firma", None)
        escribir(cont_ruta, c)
    return {"decision": "block", "reason": razon(ruta, t, paso, veces)}


def main():
    try:
        crudo = sys.stdin.read()
        try:
            entrada = json.loads(crudo)
        except ValueError:
            return 0  # Claude Code siempre manda JSON: si no lo es, algo va mal → no bloquear
        if not isinstance(entrada, dict):
            return 0
        salida = decidir(entrada)
        if salida:
            sys.stdout.write(json.dumps(salida, ensure_ascii=False) + "\n")
    except BaseException:  # nunca un error visible ni un bloqueo por fallo propio
        pass
    return 0


if __name__ == "__main__":
    try:
        main()
    finally:
        sys.exit(0)
