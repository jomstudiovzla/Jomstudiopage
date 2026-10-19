#!/usr/bin/env python3
"""Motor creativo local de JOM Studio: hooks, títulos y guion para YouTube/Shorts.

Sin IA de pago: fórmulas probadas de gancho + banco de datos REALES del estudio,
puntuadas con una rúbrica transparente y sin repetir lo ya usado (historial).
Python 3.9 de macOS, solo biblioteca estándar.

  python3 scripts/video_creativo.py hooks --dpto 03 [--n 8]
  python3 scripts/video_creativo.py titulos --dpto estudio
  python3 scripts/video_creativo.py guion --dpto 01 --salida guion.txt [--usar]
  python3 scripts/video_creativo.py siguiente      # departamento que toca esta semana

--usar guarda el hook y el título elegidos en el historial para no repetirlos.
"""

import argparse
import json
import os
import re
import sys
from datetime import date

HIST = os.environ.get("JOM_VIDEO_HISTORIAL") or os.path.expanduser(
    "~/Library/Application Support/JOMVideo/historial.json")
ORDEN = ["estudio", "01", "02", "03", "04", "05", "06", "07"]

# Solo hechos comprobables del propio trabajo (nada de clientes ni cifras inventadas).
BANCO = {
    "estudio": {"nombre": "JOM Studio", "tema": "7 protocolos en una sola web",
                "dolor": "webs bonitas que no hacen nada", "resultado": "una web que juega, crea y se protege sola",
                "dato": "7 departamentos en una sola web", "verbo": "recorremos", "cta": "Escríbenos en jomstudio.site"},
    "01": {"nombre": "Gamificación", "tema": "un personaje 3D jugable en la web",
           "dolor": "visitas que se van en 5 segundos", "resultado": "una web que se juega",
           "dato": "física a 60 FPS en el navegador", "verbo": "jugamos", "cta": "Pide tu experiencia gamificada"},
    "02": {"nombre": "Full-Stack y 3D", "tema": "un modelo 3D de 55 MB que carga como si pesara 1,4",
           "dolor": "webs 3D lentas", "resultado": "3D rápido y seguro",
           "dato": "de 55 MB a 1,4 MB sin perder calidad", "verbo": "compilamos", "cta": "Hablemos de tu web"},
    "03": {"nombre": "Arte IA", "tema": "quitar la pantalla verde sin halos",
           "dolor": "recortes con bordes verdes", "resultado": "personajes con transparencia real",
           "dato": "0 % de verde en el borde, medido", "verbo": "recortamos", "cta": "Pide tu dirección de arte"},
    "04": {"nombre": "Automatización", "tema": "correos que se preparan solos a las 5 de la mañana",
           "dolor": "horas perdidas en tareas repetidas", "resultado": "procesos que trabajan solos",
           "dato": "cero créditos y cero suscripciones", "verbo": "automatizamos", "cta": "Automaticemos tu negocio"},
    "05": {"nombre": "Audio UGC", "tema": "sonido que se toca desde el navegador",
           "dolor": "videos sin identidad sonora", "resultado": "audio con marca",
           "dato": "volumen a −14 LUFS, el estándar de YouTube", "verbo": "producimos", "cta": "Pide tu pack de audio"},
    "06": {"nombre": "Branding", "tema": "una identidad que se ve igual en todo",
           "dolor": "marcas que cambian en cada pieza", "resultado": "una marca coherente",
           "dato": "tipografía y color medidos en cada página", "verbo": "diseñamos", "cta": "Hagamos tu marca"},
    "07": {"nombre": "Sentinel QA", "tema": "una auditoría que revisa 8 páginas sola",
           "dolor": "errores que ve el cliente antes que tú", "resultado": "webs revisadas antes de publicar",
           "dato": "seguridad, accesibilidad y 404 en un solo clic", "verbo": "auditamos", "cta": "Audita tu web gratis"},
}

FORMULAS = [
    ("curiosidad", "Esto no es un video: es {tema}."),
    ("contraste", "Todos hacen {dolor}. Nosotros, {resultado}."),
    ("dato", "{dato}. Te enseño cómo."),
    ("error", "El error que convierte tu web en {dolor}."),
    ("demostracion", "Mira lo que pasa cuando {verbo} en vivo."),
    ("pregunta", "¿Y si tu web fuera {resultado}?"),
    ("antes_despues", "Antes: {dolor}. Después: {resultado}."),
    ("reto", "En 30 segundos: {tema}."),
    ("detras", "Así {verbo} en JOM Studio, sin cortes."),
    ("directo", "{nombre}: {resultado}, explicado rápido."),
    ("promesa", "Cómo conseguir {resultado} sin pagar suscripciones."),
]
TITULOS = [
    "{nombre}: {tema}", "Así {verbo}: {tema}", "{dato} | {nombre}",
    "{tema} (en vivo)", "{nombre} en JOM Studio: {resultado}", "De {dolor} a {resultado}",
]
VACIAS = {"increíble", "brutal", "épico", "nunca visto", "el mejor", "100%"}


def puntuar(texto, tipo, usados):
    palabras = re.findall(r"\w+", texto)
    p, razones = 50, []
    if tipo == "hook":
        if len(palabras) <= 12:
            p += 15; razones.append("≤12 palabras (cabe en 3 s)")
        else:
            p -= 10 * (len(palabras) - 12); razones.append("largo para 3 s")
    else:
        if len(texto) <= 60:
            p += 15; razones.append("≤60 caracteres")
        else:
            p -= 30; razones.append("pasa de 60 caracteres")
    if re.search(r"\d", texto):
        p += 10; razones.append("concreto (número)")
    if "?" in texto or ":" in texto:
        p += 5; razones.append("abre un hueco de curiosidad")
    if any(v in texto.lower() for v in VACIAS):
        p -= 20; razones.append("palabra vacía")
    if texto in usados:
        p -= 100; razones.append("ya usado")
    return p, razones


def cargar_hist():
    try:
        with open(HIST, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {"hooks": [], "titulos": [], "rotacion": -1}


def guardar_hist(h):
    os.makedirs(os.path.dirname(HIST), exist_ok=True)
    tmp = HIST + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(h, f, ensure_ascii=False, indent=2)
    os.replace(tmp, HIST)


def generar(dpto, tipo, n, hist):
    b = BANCO[dpto]
    plantillas = FORMULAS if tipo == "hook" else [("titulo", t) for t in TITULOS]
    usados = set(hist["hooks" if tipo == "hook" else "titulos"])
    out = []
    for formula, t in plantillas:
        texto = t.format(**b)
        texto = texto[0].upper() + texto[1:]
        p, r = puntuar(texto, tipo, usados)
        out.append({"texto": texto, "formula": formula, "puntuacion": p, "razones": r})
    out.sort(key=lambda x: -x["puntuacion"])
    return out[:n]


def guion(dpto, hist):
    b = BANCO[dpto]
    hook = generar(dpto, "hook", 1, hist)[0]["texto"]
    titulo = generar(dpto, "titulo", 1, hist)[0]["texto"]
    l = ["# Guion generado por scripts/video_creativo.py el %s · edítalo si quieres" % date.today().isoformat(),
         "titulo: %s" % titulo, "subtitulo: %s" % b["resultado"].capitalize(),
         "descripcion: %s. %s." % (b["tema"].capitalize(), b["dato"].capitalize()),
         "etiquetas: JOM Studio, %s, desarrollo web, Venezuela" % b["nombre"],
         "miniatura: %s" % (b["dato"] if len(b["dato"]) <= 28 else b["nombre"]),
         "short_titulo: %s" % hook, "cierre: %s" % b["cta"], "web: jomstudio.site",
         "hashtags: #JOMStudio #DesarrolloWeb", ""]
    secciones = ["home", "01", "02", "03", "04", "05", "06", "07"] if dpto == "estudio" else [dpto]
    for i, s in enumerate(secciones):
        bs = BANCO["estudio" if s == "home" else s]
        texto = hook if i == 0 else "%s: %s. %s." % (bs["nombre"], bs["resultado"], bs["dato"].capitalize())
        if dpto != "estudio":
            texto = "%s %s. %s. %s." % (hook, b["tema"].capitalize(), b["dato"].capitalize(), b["cta"])
        l += ["[%s]" % s, "duracion: %d" % (12 if dpto == "estudio" else 40), "texto: %s" % texto, ""]
    return "\n".join(l), hook, titulo


def main(argv=None):
    p = argparse.ArgumentParser(description="Hooks, títulos y guion locales para JOM Studio")
    p.add_argument("comando", choices=["hooks", "titulos", "guion", "siguiente"])
    p.add_argument("--dpto", default="estudio", choices=ORDEN)
    p.add_argument("--n", type=int, default=8)
    p.add_argument("--salida")
    p.add_argument("--usar", action="store_true", help="registrar hook/título en el historial")
    p.add_argument("--json", action="store_true")
    a = p.parse_args(argv)
    h = cargar_hist()
    if a.comando == "siguiente":
        i = (int(h.get("rotacion", -1)) + 1) % len(ORDEN)
        if a.usar:
            h["rotacion"] = i
            guardar_hist(h)
        print(ORDEN[i])
        return 0
    if a.comando in ("hooks", "titulos"):
        res = generar(a.dpto, "hook" if a.comando == "hooks" else "titulo", a.n, h)
        if a.json:
            print(json.dumps(res, ensure_ascii=False, indent=2))
        else:
            for r in res:
                print("%4d  %-60s  [%s] %s" % (r["puntuacion"], r["texto"], r["formula"], "; ".join(r["razones"])))
        return 0
    texto, hook, titulo = guion(a.dpto, h)
    if a.salida:
        with open(a.salida, "w", encoding="utf-8") as f:
            f.write(texto + "\n")
        print("Guion: %s" % a.salida)
    else:
        print(texto)
    print("Hook: %s\nTítulo: %s" % (hook, titulo), file=sys.stderr)
    if a.usar:
        h["hooks"].append(hook)
        h["titulos"].append(titulo)
        guardar_hist(h)
    return 0


if __name__ == "__main__":
    sys.exit(main())
