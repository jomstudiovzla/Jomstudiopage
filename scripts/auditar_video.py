#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Auditoría técnica de los videos de JOM Studio (formato, edición, motion, audio, alfa, tipografía).

Uso:
  python3 scripts/auditar_video.py <archivo|carpeta>... [--perfil auto|web-personaje|social-vertical|loop]
          [--json] [--umbral clave=valor]... [--ocr | --sin-ocr] [--sin-alfa-externo] [--solo-problemas]
  python3 scripts/auditar_video.py --flags-pulido [--perfil …] <archivo>   # banderas para pulir-video.sh
  python3 scripts/auditar_video.py --perfiles                              # umbrales de cada perfil
  python3 scripts/auditar_video.py --detectar-verde <archivo>              # JSON: ¿fondo verde?
  python3 scripts/auditar_video.py --sondear <archivo>                     # clave=valor para scripts

Formatos: mp4 / mov / m4v / webm / mkv / gif y WebP animado (necesita anim_dump de `brew install webp`).
Una carpeta audita todos los videos que contenga (recursivo).
Veredicto por video: PASS / WARN / FAIL. Sale con código 1 si algún video tiene FAIL.

100 % local: solo biblioteca estándar de Python (≥ 3.9, el de macOS) + ffmpeg/ffprobe.
Opcionales: tesseract (OCR de márgenes seguros), anim_dump/webpmux (WebP animado),
scripts/verificar_alfa.py (verificación de alfa de la cadena "alfa sin pantalla verde").
"""
import argparse
import json
import math
import os
import re
import shutil
import statistics
import struct
import subprocess
import sys
import tempfile

VERSION = "1.0"
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERIFICAR_ALFA = os.path.join(RAIZ, "scripts", "verificar_alfa.py")
EXT_VIDEO = (".mp4", ".mov", ".m4v", ".webm", ".mkv", ".gif", ".webp")
CARPETAS_IGNORADAS = (".git", "node_modules", ".wrangler")
GRAVEDAD = {"PASS": 0, "INFO": 0, "SKIP": 0, "WARN": 1, "FAIL": 2}
SIMBOLO = {"PASS": "✔", "WARN": "⚠", "FAIL": "✖", "INFO": "·", "SKIP": "–"}
RE_ALFA_PIXFMT = re.compile(r"^(yuva|rgba|bgra|argb|abgr|gbrap|ya8|ya16|pal8)")

# ───────────────────────────── perfiles y umbrales ─────────────────────────────
# Cada umbral se puede cambiar con --umbral clave=valor. La justificación de cada
# número está en .claude/skills/jom-video-motion/references/umbrales.md
COMUN = {
    # formato
    "aspecto": "9:16", "aspecto_tol": 0.01,
    "fps_min_fail": 20.0, "fps_min_warn": 23.5, "fps_max_warn": 60.5, "fps_decl_tol": 0.02,
    "vfr_tol": 0.05,                    # fracción de intervalos irregulares tolerada
    "dur_min_warn": 3.0, "dur_max_warn": 180.0,
    "mbps_max_warn": 30.0, "mb_max_warn": 0.0,   # 0 = sin límite de peso
    # edición
    "negro_pix_th": 0.10, "negro_final_max_s": 1.0,
    "congelado_warn_s": 0.5, "congelado_fail_s": 1.5,
    "tirones_warn_s": 0.2, "tirones_fail_s": 1.0,   # tirones por segundo
    "corte_umbral": 0.35, "flash_max_fot": 2,
    "bandas_pct": 1.0,                  # % del lado ocupado por barras negras
    "negro_puro_warn": 0.30, "blanco_puro_warn": 0.08,
    "fuera_rango_warn": 0.01, "fuera_rango_fail": 0.05,
    "parpadeo_warn": 1.0, "parpadeo_fail": 2.5,     # RMS de YAVG (niveles 0-255)
    # motion / loop
    "salto_k": 2.0, "salto_min": 0.3, "saltos_warn": 1, "saltos_fail": 2,
    "costura_ratio": 2.5, "costura_ssim_ok": 0.99,
    # audio
    "lufs_obj": -14.0, "lufs_tol_warn": 1.0, "lufs_tol_fail": 3.0, "tp_max": -1.0,
    "silencio_db": -50.0, "silencio_max_s": 2.0,
    # tipografía (márgenes seguros 9:16 para la UI de Reels/TikTok/Shorts)
    "margen_lat": 0.06, "margen_sup": 0.10, "margen_inf": 0.15, "margen_generico": 0.05,
    "texto_min_warn": 0.018, "texto_min_fail": 0.012, "ocr_conf": 70.0, "ocr_muestras": 4,
}
PERFILES = {
    "social-vertical": dict(
        COMUN,
        descripcion="Reels/TikTok/Shorts: MP4 H.264 1080×1920 yuv420p, audio −14 LUFS / −1 dBTP",
        alfa="no", audio="si", ocr=1, costura="INFO", cortes_nivel="INFO",
        codecs="h264,hevc", contenedores="mp4,mov", aspecto_nivel="FAIL",
        res_min="720x1280", res_ideal="1080x1920", vfr_nivel="FAIL", bandas_nivel="FAIL",
        pixfmts="yuv420p", faststart=1, etiquetas_color=1,
    ),
    "web-personaje": dict(
        COMUN,
        descripcion="Personaje transparente para la web: WebM VP9 yuva420p (+ WebP / HEVC alfa)",
        alfa="si", audio="no", ocr=0, costura="WARN", cortes_nivel="WARN",
        codecs="vp9,av1,hevc,webp,vp8", contenedores="webm,webp,mov", aspecto_nivel="WARN",
        res_min="360x640", res_ideal="", vfr_nivel="WARN", bandas_nivel="WARN",
        pixfmts="", faststart=0, etiquetas_color=1,
        fps_min_fail=10.0, fps_min_warn=15.0, dur_min_warn=0.5, dur_max_warn=30.0,
        mbps_max_warn=4.0, mb_max_warn=8.0,
    ),
    "loop": dict(
        COMUN,
        descripcion="Ciclo en bucle (caminar, idle): la costura final→inicio no puede saltar",
        alfa="opcional", audio="no", ocr=0, costura="FAIL", cortes_nivel="WARN",
        codecs="vp9,av1,hevc,webp,vp8,h264", contenedores="webm,webp,mov,mp4", aspecto_nivel="INFO",
        res_min="", res_ideal="", vfr_nivel="WARN", bandas_nivel="WARN",
        pixfmts="", faststart=0, etiquetas_color=0,
        fps_min_fail=8.0, fps_min_warn=12.0, dur_min_warn=0.4, dur_max_warn=20.0,
        mbps_max_warn=4.0, mb_max_warn=8.0,
    ),
}


# ───────────────────────────── utilidades ─────────────────────────────
def sh(cmd, cwd=None, timeout=None):
    try:
        p = subprocess.run(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    except subprocess.TimeoutExpired:
        return 124, "", "tiempo agotado"
    except OSError as e:
        return 127, "", str(e)
    return p.returncode, p.stdout.decode("utf-8", "replace"), p.stderr.decode("utf-8", "replace")


def racional(s):
    try:
        if "/" in str(s):
            a, b = str(s).split("/", 1)
            return float(a) / float(b) if float(b) else 0.0
        return float(s)
    except (ValueError, TypeError):
        return 0.0


def num(x, nd=3):
    if x is None:
        return None
    if isinstance(x, float):
        if math.isnan(x) or math.isinf(x):
            return None
        return round(x, nd)
    return x


def percentil(vals, p):
    if not vals:
        return None
    v = sorted(vals)
    k = (len(v) - 1) * p
    f = int(math.floor(k))
    c = min(f + 1, len(v) - 1)
    return v[f] + (v[c] - v[f]) * (k - f)


def mediana(vals):
    return statistics.median(vals) if vals else None


def tiene(cmd):
    return shutil.which(cmd) is not None


def tiene_filtro(nombre, _cache={}):
    if "lista" not in _cache:
        _, out, _ = sh(["ffmpeg", "-hide_banner", "-filters"])
        _cache["lista"] = out
    return re.search(r"\s%s\s" % re.escape(nombre), _cache["lista"]) is not None


def fmt_t(s):
    return "%.2fs" % s if s is not None else "?"


# ───────────────────────────── WebP / MP4 (solo stdlib) ─────────────────────────────
def leer_webp(path):
    """Lee el contenedor RIFF de un WebP: lienzo, alfa, animación, duraciones y color de fondo."""
    try:
        with open(path, "rb") as f:
            data = f.read()
    except OSError:
        return None
    if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        return None
    info = {"animado": False, "bandera_alfa": False, "ancho": 0, "alto": 0, "duraciones": [],
            "bucle": None, "fondo_argb": None, "subcuadros_con_alfa": 0}
    pos = 12
    while pos + 8 <= len(data):
        cc = data[pos:pos + 4]
        size = struct.unpack("<I", data[pos + 4:pos + 8])[0]
        body = data[pos + 8:pos + 8 + size]
        if cc == b"VP8X" and len(body) >= 10:
            info["bandera_alfa"] = bool(body[0] & 0x10)
            info["animado"] = bool(body[0] & 0x02)
            info["ancho"] = 1 + int.from_bytes(body[4:7], "little")
            info["alto"] = 1 + int.from_bytes(body[7:10], "little")
        elif cc == b"ANIM" and len(body) >= 6:
            b, g, r, a = body[0], body[1], body[2], body[3]
            info["fondo_argb"] = "%02X%02X%02X%02X" % (a, r, g, b)
            info["bucle"] = struct.unpack("<H", body[4:6])[0]
        elif cc == b"ANMF" and len(body) >= 16:
            info["duraciones"].append(int.from_bytes(body[12:15], "little"))
            if b"ALPH" in body[16:40] or body[16:20] == b"VP8L":
                info["subcuadros_con_alfa"] += 1
        elif cc == b"VP8 " and not info["ancho"] and len(body) >= 10:
            info["ancho"] = struct.unpack("<H", body[6:8])[0] & 0x3FFF
            info["alto"] = struct.unpack("<H", body[8:10])[0] & 0x3FFF
        elif cc == b"VP8L" and not info["ancho"] and len(body) >= 5:
            bits = int.from_bytes(body[1:5], "little")
            info["ancho"] = (bits & 0x3FFF) + 1
            info["alto"] = ((bits >> 14) & 0x3FFF) + 1
            info["bandera_alfa"] = bool((bits >> 28) & 1)
        pos += 8 + size + (size & 1)
    return info


def mp4_faststart(path):
    """True si 'moov' va antes que 'mdat' (reproducción inmediata en web). None si no aplica."""
    try:
        with open(path, "rb") as f:
            orden = []
            while len(orden) < 64:
                h = f.read(8)
                if len(h) < 8:
                    break
                size, typ = struct.unpack(">I4s", h)
                typ = typ.decode("latin-1")
                if size == 1:
                    size = struct.unpack(">Q", f.read(8))[0]
                    f.seek(size - 16, 1)
                elif size == 0:
                    orden.append(typ)
                    break
                else:
                    f.seek(size - 8, 1)
                orden.append(typ)
    except (OSError, struct.error, ValueError):
        return None
    if "moov" in orden and "mdat" in orden:
        return orden.index("moov") < orden.index("mdat")
    return None


# ───────────────────────────── sondeo ─────────────────────────────
def sondear(path):
    """Metadatos sin decodificar: ffprobe + RIFF (WebP) + orden de átomos (MP4)."""
    ext = os.path.splitext(path)[1].lower()
    s = {"archivo": path, "ext": ext.lstrip("."), "tipo": "video", "notas": [], "peso_mb": os.path.getsize(path) / 1e6}
    if ext == ".webp":
        w = leer_webp(path)
        if not w:
            s["tipo"] = "ilegible"
            return s
        s["webp"] = w
        if not w["animado"] or len(w["duraciones"]) < 2:
            s["tipo"] = "imagen"
            return s
        s["tipo"] = "webp"
        durs = [d if d > 0 else 100 for d in w["duraciones"]]
        s.update(codec="webp", contenedor="webp", ancho=w["ancho"], alto=w["alto"], cuadros=len(durs),
                 duracion=sum(durs) / 1000.0, fps_decl=1000.0 / mediana(durs), fps_real=len(durs) / (sum(durs) / 1000.0),
                 pix_fmt="rgba" if w["bandera_alfa"] else "rgb", alfa_posible=True, decodificador=[],
                 audio=None, field_order="progressive", color={}, mbps=s["peso_mb"] * 8 / max(sum(durs) / 1000.0, 1e-3))
        med = mediana(durs)
        # libwebp fusiona cuadros idénticos en uno más largo (múltiplo de la duración base): se
        # reconstruye la cadencia repitiendo cada cuadro, igual que lo verá el navegador.
        reps = [max(1, int(round(d / float(med)))) for d in durs]
        resto = [abs(d - r * med) for d, r in zip(durs, reps)]
        irregular = sum(1 for x in resto if x > max(0.10 * med, 1.5)) / float(len(durs))
        s["vfr_irregular"] = irregular
        s["webp_reps"] = reps
        s["intervalos_ms"] = [min(durs), med, max(durs)]
        s["fps_real"] = s["fps_decl"]          # WebP no declara fps: cada cuadro trae su duración
        return s
    rc, out, err = sh(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", path])
    if rc != 0:
        s["tipo"] = "ilegible"
        s["error"] = err.strip()[-300:]
        return s
    pj = json.loads(out or "{}")
    vs = [x for x in pj.get("streams", []) if x.get("codec_type") == "video"
          and not x.get("disposition", {}).get("attached_pic")]
    aus = [x for x in pj.get("streams", []) if x.get("codec_type") == "audio"]
    fmt = pj.get("format", {})
    if not vs:
        s["tipo"] = "sin-video"
        return s
    v = vs[0]
    tags = dict((k.lower(), val) for k, val in (v.get("tags") or {}).items())
    alpha_tag = str(tags.get("alpha_mode", "0")) == "1"
    codec = v.get("codec_name", "?")
    dec = []
    if alpha_tag and codec == "vp9":
        dec = ["-c:v", "libvpx-vp9"]      # el decodificador nativo de VP9 descarta el alfa
    elif alpha_tag and codec == "vp8":
        dec = ["-c:v", "libvpx"]
    nombre_fmt = fmt.get("format_name", "")
    if "webm" in nombre_fmt and s["ext"] == "webm":
        cont = "webm"
    elif "matroska" in nombre_fmt:
        cont = "mkv"
    elif "mov" in nombre_fmt or "mp4" in nombre_fmt:
        cont = "mp4" if s["ext"] in ("mp4", "m4v") else ("mov" if s["ext"] == "mov" else "mp4")
    elif "gif" in nombre_fmt:
        cont = "gif"
    else:
        cont = nombre_fmt.split(",")[0]
    dur = racional(fmt.get("duration") or v.get("duration") or 0)
    br = racional(fmt.get("bit_rate") or 0) / 1e6 or (s["peso_mb"] * 8 / dur if dur else 0)
    s.update(codec=codec, contenedor=cont, ancho=int(v.get("width", 0)), alto=int(v.get("height", 0)),
             pix_fmt=v.get("pix_fmt", "?"), alfa_tag=alpha_tag, decodificador=dec, duracion=dur, mbps=br,
             fps_decl=racional(v.get("r_frame_rate")), fps_media=racional(v.get("avg_frame_rate")),
             time_base=racional(v.get("time_base", "1/1000")), field_order=v.get("field_order", "unknown"),
             sar=v.get("sample_aspect_ratio", "1:1"),
             color={"rango": v.get("color_range"), "matriz": v.get("color_space"),
                    "primarios": v.get("color_primaries"), "transferencia": v.get("color_transfer")})
    s["alfa_posible"] = alpha_tag or bool(RE_ALFA_PIXFMT.match(s["pix_fmt"])) or codec == "gif"
    s["hevc_alfa_no_verificable"] = codec == "hevc" and cont == "mov" and not s["alfa_posible"]
    if aus:
        a = aus[0]
        s["audio"] = {"codec": a.get("codec_name"), "hz": int(a.get("sample_rate") or 0),
                      "canales": int(a.get("channels") or 0), "duracion": racional(a.get("duration") or dur)}
    else:
        s["audio"] = None
    if cont in ("mp4", "mov"):
        s["faststart"] = mp4_faststart(path)
    # cadencia real a partir de los timestamps de los paquetes (más fiable que vfrdet en WebM: base 1 ms)
    rc, out, _ = sh(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "packet=pts_time",
                     "-of", "csv=p=0", path])
    ts = []
    for ln in out.split():
        ln = ln.strip().strip(",")
        if ln and ln != "N/A":
            try:
                ts.append(float(ln))
            except ValueError:
                pass
    ts = sorted(set(ts))
    s["cuadros"] = len(ts)
    if len(ts) >= 3:
        deltas = [b - a for a, b in zip(ts, ts[1:])]
        med = mediana(deltas)
        tol = max(0.10 * med, 1.5 * (s["time_base"] or 0.001))
        s["vfr_irregular"] = sum(1 for d in deltas if abs(d - med) > tol) / float(len(deltas))
        s["fps_real"] = (len(ts) - 1) / (ts[-1] - ts[0]) if ts[-1] > ts[0] else 0.0
        s["intervalos_ms"] = [min(deltas) * 1000, med * 1000, max(deltas) * 1000]
    else:
        s["vfr_irregular"] = 0.0
        s["fps_real"] = s["fps_decl"]
    return s


# ───────────────────────────── decodificación ─────────────────────────────
def preparar_entrada(s, tmp):
    """Argumentos de entrada de ffmpeg. Para WebP animado vuelca los cuadros a PNG con anim_dump."""
    if s["tipo"] == "webp":
        if not tiene("anim_dump"):
            return None, "falta anim_dump (brew install webp): sin análisis de píxeles del WebP"
        carpeta = os.path.join(tmp, "webp")
        os.makedirs(carpeta, exist_ok=True)
        rc, _, err = sh(["anim_dump", "-folder", carpeta, "-prefix", "f_", s["archivo"]])
        pngs = sorted(x for x in os.listdir(carpeta) if x.endswith(".png"))
        if rc != 0 or not pngs:
            return None, "anim_dump no pudo volcar el WebP: " + err.strip()[-200:]
        reps = s.get("webp_reps") or []
        if len(reps) != len(pngs):
            reps = [1] * len(pngs)
        # secuencia a cadencia constante: un cuadro fusionado de 5× dura 5 cuadros (enlaces, sin copiar)
        sec = os.path.join(tmp, "webp_cfr")
        os.makedirs(sec, exist_ok=True)
        rutas, k = [], 0
        for png, r in zip(pngs, reps):
            for _ in range(r):
                dst = os.path.join(sec, "s_%05d.png" % k)
                try:
                    os.symlink(os.path.join(carpeta, png), dst)
                except OSError:
                    shutil.copyfile(os.path.join(carpeta, png), dst)
                rutas.append(dst)
                k += 1
        s["cuadros"] = len(pngs)
        s["webp_secuencia"] = rutas
        return ["-framerate", "%.6f" % s["fps_decl"], "-i", os.path.join(sec, "s_%05d.png")], None
    return s["decodificador"] + ["-i", s["archivo"]], None


def pre_grafo(alfa, etiqueta="base", rama_alfa=False):
    """Normaliza a 8 bits; si hay alfa, compone sobre gris medio (el negro bajo el alfa no es 'negro').
    rama_alfa=True deja además la salida [alf] con el canal alfa para medirlo."""
    if alfa:
        return ("[0:v]format=yuva420p,split=%d[fg][bgs]%s;"
                "[bgs]drawbox=x=0:y=0:w=iw:h=ih:color=0x7F7F7F@1:t=fill,format=yuv420p[bg];"
                "[bg][fg]overlay=format=auto,format=yuv420p,setsar=1[%s]"
                % (3 if rama_alfa else 2, "[alf]" if rama_alfa else "", etiqueta))
    return "[0:v]format=yuv420p,setsar=1[%s]" % etiqueta


def leer_metadata(fn):
    cuadros, cur = [], None
    if not os.path.exists(fn):
        return cuadros
    with open(fn, encoding="utf-8", errors="replace") as f:
        for ln in f:
            ln = ln.strip()
            if ln.startswith("frame:"):
                m = re.match(r"frame:(\d+)\s+pts:(-?\d+|NOPTS)\s+pts_time:(\S+)", ln)
                if not m:
                    continue
                try:
                    t = float(m.group(3))
                except ValueError:
                    t = float("nan")
                cur = {"n": int(m.group(1)), "pts": m.group(2), "t": t}
                cuadros.append(cur)
            elif "=" in ln and cur is not None:
                k, v = ln.split("=", 1)
                k = k.replace("lavfi.signalstats.", "").replace("lavfi.", "")
                try:
                    cur[k] = float(v)
                except ValueError:
                    cur[k] = v
    return cuadros


def analisis_video(s, entrada, tmp, th, alfa_rama):
    """Una sola decodificación con todas las ramas de análisis."""
    rango_pc = (s.get("color") or {}).get("rango") == "pc" or s["tipo"] == "webp" or s.get("pix_fmt", "").startswith("yuvj")
    lo, hi = (1, 254) if rango_pc else (17, 234)
    fps = s.get("fps_decl") or s.get("fps_real") or 25.0
    g = [pre_grafo(alfa_rama, "base", rama_alfa=True)]
    if alfa_rama:
        g.append("[alf]alphaextract,split[al1][al2]")
        g.append("[al1]signalstats,metadata=print:file=alfa.txt,nullsink")
        g.append("[al2]lut=c0='if(between(val,8,247),255,0)',signalstats,"
                 "metadata=print:key=lavfi.signalstats.YAVG:file=semi.txt,nullsink")
    g.append("[base]split=5[m][lo][hi][dec][ss]")
    g.append("[m]blackdetect=d=%.4f:pix_th=%.3f,freezedetect=n=-60dB:d=0.4,cropdetect=limit=20:round=2:reset=0,"
             "idet,vfrdet,signalstats=stat=brng,select='gte(scene,0)',metadata=print:file=cuadros.txt[out]"
             % (0.5 / fps, th["negro_pix_th"]))
    g.append("[lo]lutyuv=y='if(lte(val,%d),255,0)',signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=lo.txt,nullsink" % lo)
    g.append("[hi]lutyuv=y='if(gte(val,%d),255,0)',signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=hi.txt,nullsink" % hi)
    g.append("[dec]mpdecimate,showinfo,nullsink")
    g.append("[ss]scale=360:-2:flags=area,format=gray,split[s1][s2];[s1]setpts=N[s1n];"
             "[s2]trim=start_frame=1,setpts=N[s2n];[s1n][s2n]ssim=stats_file=ssim.txt:shortest=1,nullsink")
    cmd = ["ffmpeg", "-nostdin", "-hide_banner", "-nostats", "-loglevel", "info"] + entrada + \
          ["-filter_complex", ";".join(g), "-map", "[out]", "-f", "null", "-"]
    rc, _, err = sh(cmd, cwd=tmp)
    if rc != 0:
        utiles = [ln.strip() for ln in err.splitlines() if re.search(r"rror|nvalid|ailed|No such|annot", ln)]
        return {"error": "ffmpeg falló en el análisis (exit %d): %s" % (rc, " | ".join(utiles[-4:]) or err.strip()[-300:])}
    cu = leer_metadata(os.path.join(tmp, "cuadros.txt"))
    r = {"cuadros": cu, "rango_pc": rango_pc}
    r["lo"] = [c.get("YAVG", 0.0) / 255.0 for c in leer_metadata(os.path.join(tmp, "lo.txt"))]
    r["hi"] = [c.get("YAVG", 0.0) / 255.0 for c in leer_metadata(os.path.join(tmp, "hi.txt"))]
    if alfa_rama:
        r["alfa"] = leer_metadata(os.path.join(tmp, "alfa.txt"))
        r["semi"] = [c.get("YAVG", 0.0) / 255.0 for c in leer_metadata(os.path.join(tmp, "semi.txt"))]
    # detectores que escriben en el log
    r["negros"] = [(float(a), float(b)) for a, b in re.findall(r"black_start:\s*([\d.]+)\s+black_end:\s*([\d.]+)", err)]
    fr, abiertos = [], None
    for m in re.finditer(r"freeze_(start|end):\s*([\d.]+)", err):
        if m.group(1) == "start":
            abiertos = float(m.group(2))
        elif abiertos is not None:
            fr.append((abiertos, float(m.group(2))))
            abiertos = None
    if abiertos is not None:              # congelado hasta el final: freezedetect no lo cierra
        fin = cu[-1]["t"] + 1.0 / fps if cu else s.get("duracion", 0)
        fr.append((abiertos, fin))
    r["congelados"] = fr
    idet = re.findall(r"Multi frame detection:\s*TFF:\s*(\d+)\s*BFF:\s*(\d+)\s*Progressive:\s*(\d+)\s*Undetermined:\s*(\d+)", err)
    r["idet"] = [int(x) for x in idet[-1]] if idet else None
    vfr = re.findall(r"VFR:([-\w.]+)\s*\((\d+)/(\d+)\)", err)
    r["vfrdet"] = vfr[-1] if vfr else None
    crop = re.findall(r"crop=(\d+):(\d+):(\d+):(\d+)", err)
    r["crop"] = [int(x) for x in crop[-1]] if crop else None
    kept = set(m.group(1) for m in re.finditer(r"Parsed_showinfo_\d+ @ [^\]]+\]\s*n:\s*\d+\s+pts:\s*(-?\d+)", err))
    r["mantenidos"] = kept
    ss = []
    p = os.path.join(tmp, "ssim.txt")
    if os.path.exists(p):
        with open(p) as f:
            for ln in f:
                m = re.search(r"All:([\d.]+|inf)", ln)
                if m:
                    ss.append(1.0 if m.group(1) == "inf" else float(m.group(1)))
    r["ssim_paso"] = ss            # ssim_paso[i] = SSIM(cuadro i, cuadro i+1)
    return r


def analisis_costura(s, entrada, tmp, alfa_rama):
    """SSIM y PSNR entre el último y el primer cuadro (lo que se ve al dar la vuelta el loop)."""
    pre = pre_grafo(alfa_rama, "b") + ";[b]scale=360:-2:flags=area,format=gray[o]"
    primero, ultimo = os.path.join(tmp, "primero.png"), os.path.join(tmp, "ultimo.png")
    sh(["ffmpeg", "-nostdin", "-v", "error", "-y"] + entrada + ["-filter_complex", pre, "-map", "[o]",
                                                                "-frames:v", "1", primero])
    if s["tipo"] == "webp":
        ent_ult = ["-i", s["webp_secuencia"][-1]]
    else:
        ent_ult = s["decodificador"] + ["-sseof", "-1.5", "-i", s["archivo"]]
    sh(["ffmpeg", "-nostdin", "-v", "error", "-y"] + ent_ult + ["-filter_complex", pre, "-map", "[o]",
                                                                "-update", "1", ultimo])
    if not (os.path.exists(primero) and os.path.exists(ultimo)):
        return None
    _, _, e1 = sh(["ffmpeg", "-nostdin", "-hide_banner", "-i", ultimo, "-i", primero, "-lavfi", "[0][1]ssim", "-f", "null", "-"])
    _, _, e2 = sh(["ffmpeg", "-nostdin", "-hide_banner", "-i", ultimo, "-i", primero, "-lavfi", "[0][1]psnr", "-f", "null", "-"])
    m1 = re.search(r"All:([\d.]+)", e1)
    m2 = re.search(r"average:([\d.]+|inf)", e2)
    if not m1:
        return None
    return {"ssim": float(m1.group(1)), "psnr": (float("inf") if m2 and m2.group(1) == "inf" else
                                                  (float(m2.group(1)) if m2 else None))}


def analisis_audio(s, th):
    cad = "silencedetect=n=%sdB:d=%s,astats,volumedetect,ebur128=peak=true:framelog=verbose" % (th["silencio_db"], th["silencio_max_s"])
    rc, _, err = sh(["ffmpeg", "-nostdin", "-hide_banner", "-nostats", "-i", s["archivo"], "-map", "0:a:0",
                     "-af", cad, "-f", "null", "-"])
    if rc != 0:
        return {"error": err.strip()[-300:]}
    r = {}
    resumen = err[err.rfind("Summary:"):] if "Summary:" in err else err
    m = re.search(r"I:\s*(-?[\d.]+|-inf)\s*LUFS", resumen)
    r["lufs"] = float(m.group(1)) if m and m.group(1) != "-inf" else float("-inf")
    m = re.search(r"LRA:\s*([\d.]+)\s*LU", resumen)
    r["lra"] = float(m.group(1)) if m else None
    m = re.search(r"True peak:\s*Peak:\s*(-?[\d.]+|-inf)", resumen, re.S)
    r["true_peak"] = float(m.group(1)) if m and m.group(1) != "-inf" else float("-inf")
    general = err[err.rfind("Overall"):] if "Overall" in err else err
    m = re.search(r"Peak level dB:\s*(-?[\d.]+|-inf)", general)
    r["pico_db"] = float(m.group(1)) if m and m.group(1) != "-inf" else float("-inf")
    m = re.search(r"Flat factor:\s*([\d.]+)", general)
    r["flat_factor"] = float(m.group(1)) if m else 0.0
    m = re.search(r"Peak count:\s*([\d.]+)", general)
    r["peak_count"] = float(m.group(1)) if m else 0.0
    # volumedetect: muestras en el último dB antes de 0 dBFS. En AAC el recorte no deja "techo plano"
    # (flat factor 0) pero sí una montaña de muestras pegadas a 0 dBFS.
    n = re.findall(r"n_samples:\s*(\d+)", err)       # el último: ffmpeg prueba el grafo una vez vacío
    h0 = re.findall(r"histogram_0db:\s*(\d+)", err)
    r["muestras_0db_pct"] = 100.0 * int(h0[-1]) / int(n[-1]) if (n and h0 and int(n[-1])) else 0.0
    sil, ini = [], None
    for mm in re.finditer(r"silence_(start|end):\s*(-?[\d.]+)", err):
        if mm.group(1) == "start":
            ini = max(0.0, float(mm.group(2)))
        elif ini is not None:
            sil.append((ini, float(mm.group(2))))
            ini = None
    if ini is not None:
        sil.append((ini, s["audio"]["duracion"] or s["duracion"]))
    r["silencios"] = sil
    return r


def _tesseract_palabras(png, lang, th):
    rc, out, _ = sh(["tesseract", png, "stdout", "-l", lang, "--psm", "11", "tsv"], timeout=120)
    lineas = {}
    for ln in out.splitlines()[1:]:
        c = ln.split("\t")
        if len(c) < 12 or c[0] != "5":
            continue
        txt = c[11].strip()
        try:
            conf = float(c[10])
        except ValueError:
            continue
        if conf < th["ocr_conf"] or len(re.sub(r"[^\w]", "", txt)) < 2:
            continue
        lineas.setdefault((c[2], c[3], c[4]), []).append((int(c[6]), int(c[7]), int(c[8]), int(c[9]), txt, conf))
    palabras = []
    for ps in lineas.values():
        alto_linea = max(p[3] for p in ps)
        for (x, y, w, h, txt, conf) in ps:
            palabras.append({"texto": txt, "x": x, "y": y, "w": w, "h": h, "alto_linea": alto_linea, "conf": conf})
    return palabras


def _solapa(a, b):
    ix = max(0, min(a["x"] + a["w"], b["x"] + b["w"]) - max(a["x"], b["x"]))
    iy = max(0, min(a["y"] + a["h"], b["y"] + b["h"]) - max(a["y"], b["y"]))
    inter = ix * iy
    return inter / float(min(a["w"] * a["h"], b["w"] * b["h"]) or 1)


def analisis_ocr(s, entrada, tmp, th, negros):
    """OCR de cuadros muestreados con tesseract. Tres pasadas por cuadro (color, gris y umbral de
    brillo: el rótulo blanco sobre degradado se le escapa a una sola) y se fusionan las cajas."""
    n = int(th["ocr_muestras"])
    dur = s.get("duracion") or 0
    if dur <= 0:
        return None
    langs = sh(["tesseract", "--list-langs"])[1]
    lang = "spa+eng" if re.search(r"^spa$", langs, re.M) else "eng"
    variantes = "[o]split=3[c0][g][b];[g]format=gray[c1];[b]format=gray,lutyuv=y='if(gte(val,200),0,255)'[c2]"
    cajas = []
    for i in range(n):
        t = dur * (i + 0.5) / n
        if any(a - 0.05 <= t <= b + 0.05 for a, b in negros):
            continue
        if s["tipo"] == "webp":
            sec = s["webp_secuencia"]
            ent = ["-i", sec[min(len(sec) - 1, int(t * s["fps_decl"]))]]
        else:
            ent = s["decodificador"] + ["-ss", "%.3f" % t, "-i", s["archivo"]]
        rutas = [os.path.join(tmp, "ocr_%02d_%d.png" % (i, k)) for k in range(3)]
        cmd = ["ffmpeg", "-nostdin", "-v", "error", "-y"] + ent + \
              ["-filter_complex", pre_grafo(s.get("alfa_real"), "o") + ";" + variantes]
        for k, r in enumerate(rutas):
            cmd += ["-map", "[c%d]" % k, "-frames:v", "1", r]
        sh(cmd)
        vistas = []

        def fusionar(png):
            for p in _tesseract_palabras(png, lang, th):
                igual = [v for v in vistas if v["texto"].lower() == p["texto"].lower() and _solapa(v, p) > 0.5]
                if igual:
                    if p["conf"] > igual[0]["conf"]:
                        igual[0].update(p)
                else:
                    vistas.append(p)
        for r in rutas:
            if os.path.exists(r):
                fusionar(r)
        # Segunda pasada con lo ya leído tapado: con un titular grande en el cuadro, tesseract
        # descarta la letra pequeña como ruido (medido: 22 px junto a 110 px → 0 palabras; tapando
        # el titular → 3 de 3). Justo la letra pequeña es la que más interesa detectar.
        if vistas:
            tapa = ",".join("drawbox=x=%d:y=%d:w=%d:h=%d:color=white:t=fill" % (max(0, v["x"] - 4), max(0, v["y"] - 4),
                                                                              v["w"] + 8, v["alto_linea"] + 8) for v in vistas)
            for k in (1, 2):
                if not os.path.exists(rutas[k]):
                    continue
                tapada = os.path.join(tmp, "ocr_%02d_%d_tapada.png" % (i, k))
                sh(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", rutas[k], "-vf", tapa, tapada])
                if os.path.exists(tapada):
                    fusionar(tapada)
        for p in vistas:
            p["t"] = round(t, 2)
            cajas.append(p)
    return {"cajas": cajas, "idioma": lang}


def detectar_verde(path, s=None):
    """Media RGB de franjas de borde (arriba, izquierda, derecha) en 3 instantes. ¿Croma verde?"""
    s = s or sondear(path)
    if s["tipo"] not in ("video",):
        return {"verde": False, "motivo": "no aplica a " + s["tipo"]}
    dur = s.get("duracion") or 1.0
    votos, muestras = 0, []
    for frac in (0.1, 0.5, 0.9):
        g = ("[0:v]format=rgb24,split=3[a][b][c];[a]crop=iw:ih*0.05:0:0,scale=1:1:flags=area[t];"
             "[b]crop=iw*0.05:ih:0:0,scale=1:1:flags=area[l];[c]crop=iw*0.05:ih:iw*0.95:0,scale=1:1:flags=area[r];"
             "[t][l][r]hstack=3,format=rgb24[o]")
        p = subprocess.run(["ffmpeg", "-nostdin", "-v", "error"] + s["decodificador"] +
                           ["-ss", "%.3f" % (dur * frac), "-i", path, "-filter_complex", g, "-map", "[o]",
                            "-frames:v", "1", "-f", "rawvideo", "-"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        b = p.stdout
        if len(b) < 9:
            continue
        franjas = [(b[i], b[i + 1], b[i + 2]) for i in (0, 3, 6)]
        verdes = sum(1 for (r_, g_, b_) in franjas if g_ > 70 and g_ > 1.35 * max(r_, b_, 1))
        muestras.append(franjas)
        if verdes >= 2:
            votos += 1
    return {"verde": votos >= 2, "votos": votos, "muestras_rgb": muestras}


# ───────────────────────────── evaluación ─────────────────────────────
class Informe(object):
    def __init__(self, archivo, perfil):
        self.archivo, self.perfil, self.checks, self.metricas, self.recetas = archivo, perfil, [], {}, []

    def add(self, area, cid, nivel, valor="", detalle="", receta=None):
        self.checks.append({"area": area, "id": cid, "nivel": nivel, "valor": valor, "detalle": detalle,
                            "receta": receta})
        if receta and GRAVEDAD.get(nivel, 0) > 0:
            for r in receta.split(";"):
                r = r.strip()
                if r and r not in self.recetas:
                    self.recetas.append(r)

    def veredicto(self):
        peor = max([GRAVEDAD.get(c["nivel"], 0) for c in self.checks] or [0])
        return {0: "PASS", 1: "WARN", 2: "FAIL"}[peor]


def perfil_auto(s):
    nombre = os.path.basename(s["archivo"]).lower()
    if re.search(r"loop|ciclo|caminar_animado|cycle", nombre):
        return "loop"
    if s.get("alfa_posible") or s.get("tipo") == "webp" or s.get("contenedor") == "webm":
        return "web-personaje"
    return "social-vertical"


def nivel_por(valor, warn, fail, mayor=True):
    if valor is None:
        return "SKIP"
    if mayor:
        return "FAIL" if valor >= fail else ("WARN" if valor >= warn else "PASS")
    return "FAIL" if valor <= fail else ("WARN" if valor <= warn else "PASS")


def evaluar_formato(inf, s, th):
    m = inf.metricas
    codecs = th["codecs"].split(",")
    conts = th["contenedores"].split(",")
    ok_c = s["codec"] in codecs and s["contenedor"] in conts
    rec = "--preset social" if th["alfa"] == "no" else "--preset web-alfa"
    inf.add("formato", "códec/contenedor", "PASS" if ok_c else "FAIL", "%s · %s" % (s["codec"], s["contenedor"]),
            "" if ok_c else "esperado %s en %s" % ("/".join(codecs), "/".join(conts)), rec)
    w, h = s["ancho"], s["alto"]
    m.update(ancho=w, alto=h)
    if w and h:
        an, ad = [float(x) for x in th["aspecto"].split(":")]
        sar = racional(s.get("sar", "1:1").replace(":", "/")) or 1.0
        asp = (w * sar) / float(h)
        obj = an / ad
        m["aspecto"] = num(asp, 4)
        ok = abs(asp - obj) / obj <= th["aspecto_tol"]
        inf.add("formato", "aspecto", "PASS" if ok else th["aspecto_nivel"], "%.4f (%dx%d)" % (asp, w, h),
                "" if ok else "esperado %s = %.4f" % (th["aspecto"], obj),
                "--preset social" if th["alfa"] == "no" else None)
        if th["res_min"]:
            rw, rh = [int(x) for x in th["res_min"].split("x")]
            lado_c, lado_l = min(w, h), max(w, h)
            if lado_c < rw or lado_l < rh:
                inf.add("formato", "resolución", "FAIL" if th["alfa"] == "no" and lado_c < rw * 0.75 else "WARN",
                        "%dx%d" % (w, h), "mínimo %s" % th["res_min"], "--preset social" if th["alfa"] == "no" else None)
            elif th["res_ideal"] and "%dx%d" % (w, h) != th["res_ideal"]:
                inf.add("formato", "resolución", "WARN", "%dx%d" % (w, h), "ideal %s (la plataforma reescala)" % th["res_ideal"],
                        "--preset social")
            else:
                inf.add("formato", "resolución", "PASS", "%dx%d" % (w, h))
        if (w % 2 or h % 2) and s["codec"] != "webp":
            inf.add("formato", "dimensiones pares", "FAIL", "%dx%d" % (w, h), "yuv420p exige ancho y alto pares", rec)
    # fps
    fd, fr = s.get("fps_decl") or 0, s.get("fps_real") or 0
    m.update(fps_declarado=num(fd), fps_real=num(fr))
    irr0 = s.get("vfr_irregular", 0.0)
    f = fd if (irr0 > th["vfr_tol"] and fd) else (fr or fd)   # con VFR manda la cadencia nominal
    if f:
        if f < th["fps_min_fail"]:
            nv = "FAIL"
        elif f < th["fps_min_warn"] or f > th["fps_max_warn"]:
            nv = "WARN"
        else:
            nv = "PASS"
        inf.add("formato", "fps", nv, "%.3f real / %.3f decl." % (fr, fd),
                "" if nv == "PASS" else "rango %.0f–%.0f" % (th["fps_min_warn"], th["fps_max_warn"]),
                "--60fps" if f < th["fps_min_warn"] else None)
        if s["tipo"] != "webp" and fd and fr and abs(fd - fr) / fd > th["fps_decl_tol"]:
            inf.add("formato", "fps declarado≠real", "WARN", "%.3f vs %.3f" % (fd, fr),
                    "el contenedor miente sobre la cadencia", "--cfr")
    irr = s.get("vfr_irregular", 0.0)
    m["vfr_irregular"] = num(irr, 4)
    m["intervalos_ms"] = [num(x, 2) for x in s.get("intervalos_ms", [])]
    vd = inf.metricas.get("vfrdet")
    det = "intervalos min/med/max %s ms" % "/".join("%.1f" % x for x in s.get("intervalos_ms", [0, 0, 0]))
    if vd:
        det += " · vfrdet %s" % vd
    inf.add("formato", "cadencia (VFR)", th["vfr_nivel"] if irr > th["vfr_tol"] else "PASS",
            "%.1f%% irregular" % (irr * 100), det, "--cfr")
    # duración, peso
    d = s.get("duracion") or 0
    m["duracion"] = num(d)
    nv = "WARN" if (d < th["dur_min_warn"] or d > th["dur_max_warn"]) else "PASS"
    inf.add("formato", "duración", nv, fmt_t(d), "" if nv == "PASS" else "rango %.1f–%.0f s" % (th["dur_min_warn"], th["dur_max_warn"]))
    mb = s.get("mbps") or 0
    m.update(mbps=num(mb, 2), peso_mb=num(s["peso_mb"], 2))
    nv = "WARN" if mb > th["mbps_max_warn"] or (th["mb_max_warn"] and s["peso_mb"] > th["mb_max_warn"]) else "PASS"
    inf.add("formato", "bitrate/peso", nv, "%.2f Mb/s · %.2f MB" % (mb, s["peso_mb"]),
            "" if nv == "PASS" else "máx. %.1f Mb/s%s" % (th["mbps_max_warn"], (" / %.0f MB" % th["mb_max_warn"]) if th["mb_max_warn"] else ""),
            rec)
    # pix_fmt
    pf = s.get("pix_fmt", "?")
    m["pix_fmt"] = pf
    if th["pixfmts"]:
        ok = pf in th["pixfmts"].split(",")
        inf.add("formato", "pix_fmt", "PASS" if ok else "FAIL", pf, "" if ok else "esperado " + th["pixfmts"], rec)
    # color
    col = s.get("color") or {}
    if th["etiquetas_color"] and s["tipo"] == "video":
        falt = [k for k in ("matriz", "primarios", "transferencia") if not col.get(k) or col.get(k) == "unknown"]
        if falt:
            inf.add("formato", "etiquetas de color", "WARN", "sin " + "/".join(falt),
                    "sin etiquetas cada navegador adivina (gamma distinta Safari/Chrome)", "--color")
        elif col.get("matriz") not in ("bt709",) and (s["alto"] >= 720 or s["ancho"] >= 720):
            inf.add("formato", "etiquetas de color", "WARN", col.get("matriz"), "HD debería ser bt709", "--color")
        else:
            inf.add("formato", "etiquetas de color", "PASS", "%s/%s/%s %s" % (col.get("matriz"), col.get("primarios"),
                                                                             col.get("transferencia"), col.get("rango") or ""))
        if col.get("rango") == "pc" and th["alfa"] == "no":
            inf.add("formato", "rango", "WARN", "pc (completo)", "redes esperan rango limitado (tv)", "--color")
    if th["faststart"] and s.get("contenedor") in ("mp4", "mov"):
        fs = s.get("faststart")
        inf.add("formato", "faststart", "PASS" if fs else "WARN", {True: "moov al inicio", False: "moov al final", None: "?"}[fs],
                "" if fs else "el video no arranca hasta descargarse entero", "--preset social")
    # entrelazado
    fo = s.get("field_order", "unknown")
    idet = m.get("idet")
    ratio = None
    coherencia = 0.0
    if idet:
        # En progresivo, los falsos positivos de idet se reparten entre TFF y BFF; en entrelazado
        # real domina un solo orden de campo. Por eso se mide el orden dominante y su coherencia.
        tff, bff, prog, _und = idet
        tot = tff + bff + prog
        ratio = max(tff, bff) / float(tot) if tot >= 10 else None
        coherencia = max(tff, bff) / float(tff + bff) if tff + bff else 0.0
        m["entrelazado_idet"] = num(ratio, 3)
        m["entrelazado_coherencia"] = num(coherencia, 3)
    peine = ratio is not None and coherencia >= 0.85
    if s.get("codec") in ("vp8", "vp9", "av1", "webp", "gif"):
        inf.add("formato", "entrelazado", "PASS", "progresivo", "%s no admite entrelazado" % s.get("codec"))
        return
    if fo in ("tt", "bb", "tb", "bt") or (peine and ratio > 0.6):
        inf.add("formato", "entrelazado", "FAIL", "field_order=%s · idet %s" % (fo, "%.0f%%" % (ratio * 100) if ratio is not None else "?"),
                "peine en movimiento; la web y las redes son progresivas", "--desentrelazar")
    elif peine and ratio > 0.4:
        inf.add("formato", "entrelazado", "WARN", "idet %.0f%% %s" % (ratio * 100, "TFF" if idet[0] >= idet[1] else "BFF"),
                "posible peine", "--desentrelazar")
    else:
        inf.add("formato", "entrelazado", "PASS", "progresivo" + (" · idet %.0f%% (coherencia %.0f%%)" % (ratio * 100, coherencia * 100)
                                                               if ratio is not None else ""))


def evaluar_edicion(inf, s, th, a, fps):
    m = inf.metricas
    cu = a["cuadros"]
    n = len(cu)
    dur = (cu[-1]["t"] + 1.0 / fps) if cu else (s.get("duracion") or 0)
    tol = 1.5 / fps
    # negros
    negros = a["negros"]
    m["negros"] = [[num(x), num(y)] for x, y in negros]
    if not negros:
        inf.add("edición", "fotogramas negros", "PASS", "ninguno")
    for (x, y) in negros:
        if x <= tol and y >= dur - tol:
            inf.add("edición", "fotogramas negros", "FAIL", "todo el video", "el video entero es negro")
        elif x <= tol:
            inf.add("edición", "negro al inicio", "WARN" if y < 1.0 else "FAIL", "0–%s" % fmt_t(y),
                    "primer cuadro negro: póster y autoplay en negro", "--recortar-inicio %.3f" % y)
        elif y >= dur - tol:
            dd = y - x
            if dd > th["negro_final_max_s"]:
                inf.add("edición", "negro al final", "WARN", "%s–%s" % (fmt_t(x), fmt_t(y)),
                        "cola negra > %.1fs" % th["negro_final_max_s"], "--recortar-fin %.3f" % dd)
        else:
            inf.add("edición", "negro en medio", "FAIL", "%s–%s" % (fmt_t(x), fmt_t(y)),
                    "corte negro accidental", "--quitar-negros")
    # congelados (los que caen dentro de un negro ya están contados)
    cong = []
    for (x, y) in a["congelados"]:
        solape = sum(max(0.0, min(y, b) - max(x, a_)) for a_, b in negros)
        if y - x > 0 and solape / (y - x) < 0.5:
            cong.append((x, y))
    m["congelados"] = [[num(x), num(y)] for x, y in cong]
    if not cong:
        inf.add("edición", "congelados", "PASS", "ninguno")
    for (x, y) in cong:
        dd = y - x
        nv = nivel_por(dd, th["congelado_warn_s"], th["congelado_fail_s"])
        if nv == "PASS":
            continue
        if y >= dur - tol:
            rec = "--recortar-fin %.3f" % dd
            donde = "al final"
        elif x <= tol:
            rec = "--recortar-inicio %.3f" % y
            donde = "al inicio"
        else:
            rec = None
            donde = "en medio"
        inf.add("edición", "congelado " + donde, nv, "%s–%s (%s)" % (fmt_t(x), fmt_t(y), fmt_t(dd)),
                "imagen fija ≥ %.1fs" % th["congelado_warn_s"], rec)
    # duplicados / tirones: mpdecimate + contexto de movimiento (YDIF de los vecinos)
    ydif = [c.get("YDIF", 0.0) for c in cu]
    kept = a["mantenidos"]
    dropped = [i for i, c in enumerate(cu) if i > 0 and c["pts"] not in kept] if kept else []
    en_negro = set()
    for i, c in enumerate(cu):
        if any(x - 1e-6 <= c["t"] <= y for x, y in negros):
            en_negro.add(i)
    en_cong = set()
    for i, c in enumerate(cu):
        if any(x - 1e-6 <= c["t"] <= y + 1e-6 for x, y in a["congelados"]):
            en_cong.add(i)
    piso = max(th["salto_min"] * 0.5, 0.05)
    tirones = []
    for i in dropped:
        if i in en_negro or i in en_cong or i + 1 >= n:
            continue
        prev_m = ydif[i - 1] if i - 1 > 0 else ydif[i + 1]
        sig_m = ydif[i + 1]
        if min(prev_m, sig_m) >= max(piso, 4 * ydif[i]):
            tirones.append(i)
    m["duplicados"] = len(dropped)
    m["tirones"] = len(tirones)
    tps = len(tirones) / max(dur, 1e-3)
    m["tirones_por_s"] = num(tps, 3)
    en_doses = len(dropped) > 0.35 * n and len(tirones) > 0.8 * len(dropped) and \
        statistics.pstdev([b - a_ for a_, b in zip(tirones, tirones[1:])] or [0]) < 0.6
    if en_doses:
        inf.add("edición", "duplicados", "WARN", "%d de %d (en doses)" % (len(dropped), n),
                "animación a 2 cuadros por dibujo: válido si es estilo, si no interpola", "--deduplicar")
    else:
        nv = nivel_por(tps, th["tirones_warn_s"], th["tirones_fail_s"]) if tirones else "PASS"
        inf.add("edición", "duplicados/tirones", nv, "%d tirones (%.2f/s) · %d dup." % (len(tirones), tps, len(dropped)),
                "cuadro repetido en pleno movimiento = tirón" if tirones else "", "--deduplicar")
    # cortes y ritmo
    sc = [c.get("scene_score", 0.0) for c in cu]
    cortes = [i for i in range(1, n) if sc[i] > th["corte_umbral"]]
    limites = [0] + cortes + [n]
    planos = [b - a_ for a_, b in zip(limites, limites[1:]) if b > a_]
    flashes = []
    for a_, b in zip(limites, limites[1:]):
        if 0 < b - a_ <= th["flash_max_fot"] and n > 3 * th["flash_max_fot"] and not all(i in en_negro for i in range(a_, b)):
            flashes.append(a_)
    m["cortes"] = len(cortes)
    m["cortes_t"] = [num(cu[i]["t"], 3) for i in cortes]
    asl = (dur / len(planos)) if planos else dur
    m["duracion_media_plano"] = num(asl, 2)
    det = "%d cortes · %.1f/min · plano medio %.2fs" % (len(cortes), len(cortes) / max(dur, 1e-3) * 60, asl)
    if flashes:
        inf.add("edición", "cortes/ritmo", "FAIL", det, "plano de ≤%d cuadros en %s: fotograma suelto en el corte"
                % (th["flash_max_fot"], ", ".join(fmt_t(cu[i]["t"]) for i in flashes[:4])))
    elif cortes and th["cortes_nivel"] == "WARN":
        inf.add("edición", "cortes/ritmo", "WARN", det, "un personaje web o un loop deberían ser un solo plano")
    else:
        inf.add("edición", "cortes/ritmo", "INFO" if cortes else "PASS", det)
    # bandas negras
    if a.get("crop") and s["ancho"] and s["alto"]:
        cw, ch, cx, cy = a["crop"]
        W, H = s["ancho"], s["alto"]
        arriba, abajo, izq, der = cy, H - (cy + ch), cx, W - (cx + cw)
        pct_v = 100.0 * min(arriba, abajo) / H
        pct_h = 100.0 * min(izq, der) / W
        m["bandas_px"] = {"arriba": arriba, "abajo": abajo, "izquierda": izq, "derecha": der}
        tipo = []
        if pct_v >= th["bandas_pct"] / 2 and 100.0 * max(arriba, abajo) / H >= th["bandas_pct"]:
            tipo.append("letterbox %d/%d px" % (arriba, abajo))
        if pct_h >= th["bandas_pct"] / 2 and 100.0 * max(izq, der) / W >= th["bandas_pct"]:
            tipo.append("pillarbox %d/%d px" % (izq, der))
        if tipo and len(en_negro) < n:
            inf.add("edición", "bandas negras", th["bandas_nivel"], " + ".join(tipo), "crop=%d:%d:%d:%d" % (cw, ch, cx, cy),
                    "--quitar-bandas")
        else:
            inf.add("edición", "bandas negras", "PASS", "ninguna")
    # niveles: negros aplastados / blancos quemados / fuera de rango legal
    idx = [i for i in range(n) if i not in en_negro]
    lo = [a["lo"][i] for i in idx if i < len(a["lo"])]
    hi = [a["hi"][i] for i in idx if i < len(a["hi"])]
    brng = [cu[i].get("BRNG", 0.0) for i in idx]
    if lo and hi:
        mlo, mhi = statistics.mean(lo), statistics.mean(hi)
        mbr = statistics.mean(brng) if brng else 0.0
        ymin = min(cu[i].get("YMIN", 0) for i in idx)
        ymax = max(cu[i].get("YMAX", 255) for i in idx)
        m.update(negro_puro=num(mlo, 4), blanco_puro=num(mhi, 4), fuera_rango=num(mbr, 4), ymin=ymin, ymax=ymax)
        val = "Y %d–%d · negro %.1f%% · blanco %.1f%%" % (ymin, ymax, mlo * 100, mhi * 100)
        if not a["rango_pc"] and mbr > th["fuera_rango_fail"]:
            inf.add("edición", "niveles", "FAIL", val + " · fuera de rango %.1f%%" % (mbr * 100),
                    "píxeles fuera de 16–235: se recortan al reproducir", "--color")
        elif (not a["rango_pc"] and mbr > th["fuera_rango_warn"]) or mlo > th["negro_puro_warn"] or mhi > th["blanco_puro_warn"]:
            det = []
            if mlo > th["negro_puro_warn"]:
                det.append("negros aplastados")
            if mhi > th["blanco_puro_warn"]:
                det.append("blancos quemados (si es un fondo plano de diseño, ignóralo)")
            if not a["rango_pc"] and mbr > th["fuera_rango_warn"]:
                det.append("fuera de rango %.1f%%" % (mbr * 100))
            inf.add("edición", "niveles", "WARN", val, "; ".join(det), "--color")
        else:
            inf.add("edición", "niveles", "PASS", val)
    # parpadeo: componente de alta frecuencia de YAVG (una rampa o un fundido dan 0)
    cerca_corte = set()
    for i in cortes:
        cerca_corte.update((i - 1, i, i + 1))
    yavg = [c.get("YAVG", 0.0) for c in cu]
    hp = [yavg[i] - (yavg[i - 1] + yavg[i + 1]) / 2.0 for i in range(1, n - 1)
          if not ({i - 1, i, i + 1} & (cerca_corte | en_negro))]
    if len(hp) >= 5:
        rms = math.sqrt(sum(x * x for x in hp) / len(hp))
        m["parpadeo_rms"] = num(rms, 3)
        inf.add("edición", "parpadeo", nivel_por(rms, th["parpadeo_warn"], th["parpadeo_fail"]), "RMS %.2f niveles" % rms,
                "" if rms < th["parpadeo_warn"] else "el brillo late cuadro a cuadro", "--antiparpadeo")
    return {"cortes": cortes, "en_negro": en_negro, "en_cong": en_cong, "dropped": set(dropped), "dur": dur}


def evaluar_motion(inf, s, th, a, ctx, costura):
    m = inf.metricas
    cu = a["cuadros"]
    n = len(cu)
    ydif = [c.get("YDIF", 0.0) for c in cu]
    excl = set([0]) | set(ctx["cortes"]) | ctx["en_negro"] | ctx["en_cong"] | ctx["dropped"]
    excl |= set(i + 1 for i in ctx["dropped"])
    validos = [i for i in range(n) if i not in excl]
    saltos = []
    for i in validos:
        ventana = [ydif[j] for j in range(max(1, i - 6), min(n, i + 7)) if j != i and j in validos]
        if len(ventana) < 3:
            continue
        loc = mediana(ventana)
        if ydif[i] > th["salto_k"] * max(loc, 1e-3) and ydif[i] - loc > th["salto_min"]:
            saltos.append(i)
    vals = [ydif[i] for i in validos]
    if len(vals) >= 3:
        mu = statistics.mean(vals)
        cv = statistics.pstdev(vals) / mu if mu > 1e-6 else 0.0
        m.update(movimiento_medio=num(mu, 3), suavidad_cv=num(cv, 3), saltos=len(saltos),
                 saltos_t=[num(cu[i]["t"], 3) for i in saltos])
        nv = nivel_por(len(saltos), th["saltos_warn"], th["saltos_fail"]) if saltos else "PASS"
        inf.add("motion", "suavidad", nv, "%d saltos · YDIF medio %.2f · CV %.2f" % (len(saltos), mu, cv),
                ("salto en " + ", ".join(fmt_t(cu[i]["t"]) for i in saltos[:5]) + " (cuadros perdidos o mal empalmados)")
                if saltos else "")
    else:
        inf.add("motion", "suavidad", "SKIP", "muy pocos cuadros con movimiento")
    # costura del loop
    ss = a.get("ssim_paso") or []
    pasos = [ss[i] for i in range(len(ss)) if i + 1 not in excl and i not in ctx["en_negro"]]
    if costura and pasos:
        med = mediana(pasos)
        # Referencia local: el paso que el ojo compara al dar la vuelta es el de los cuadros vecinos
        # (penúltimo→último y primero→segundo). La mediana global solo es respaldo.
        vecinos = [1.0 - ss[k] for k in (0, len(ss) - 1) if 0 <= k < len(ss)]
        dif_paso = max(statistics.mean(vecinos) if vecinos else 1.0 - med, 1e-4)
        ratio = (1.0 - costura["ssim"]) / dif_paso
        m.update(costura_ssim=num(costura["ssim"], 5), costura_psnr=num(costura["psnr"], 2),
                 paso_ssim_mediana=num(med, 5), paso_ssim_vecinos=num(1.0 - dif_paso, 5), costura_ratio=num(ratio, 2))
        val = "SSIM %.4f · PSNR %s dB · %.1f× un paso" % (costura["ssim"],
                                                          "inf" if costura["psnr"] == float("inf") else "%.1f" % (costura["psnr"] or 0), ratio)
        if ratio > th["costura_ratio"] and costura["ssim"] < th["costura_ssim_ok"]:
            inf.add("motion", "costura del loop", th["costura"], val, "el final no empalma con el inicio: salto visible al repetir",
                    "--loop-sin-costura")
        elif costura["ssim"] >= 0.999 and med < 0.995:
            inf.add("motion", "costura del loop", "WARN" if th["costura"] != "INFO" else "INFO", val,
                    "el último cuadro repite el primero: micro-pausa en cada vuelta", "--recortar-fin 1f")
        else:
            inf.add("motion", "costura del loop", "PASS", val)
    elif costura is None:
        inf.add("motion", "costura del loop", "SKIP", "no se pudo extraer primer/último cuadro")


def evaluar_audio(inf, s, th):
    m = inf.metricas
    au = s.get("audio")
    if th["audio"] == "no":
        if au:
            inf.add("audio", "pista", "WARN", au["codec"], "audio en video de fondo: peso inútil (autoplay va en silencio)", "--sin-audio")
        else:
            inf.add("audio", "pista", "PASS", "sin audio")
        return
    if not au:
        inf.add("audio", "pista", "INFO", "sin audio", "las redes priorizan videos con sonido (o añádelo en la app)")
        return
    r = analisis_audio(s, th)
    if "error" in r:
        inf.add("audio", "análisis", "SKIP", "", r["error"][:120])
        return
    m["audio"] = dict((k, num(v, 2) if isinstance(v, float) else v) for k, v in r.items() if k != "silencios")
    m["audio"]["silencios"] = [[num(x), num(y)] for x, y in r["silencios"]]
    inf.add("audio", "formato", "PASS" if au["hz"] in (44100, 48000) and au["codec"] in ("aac", "opus", "mp3") else "WARN",
            "%s %d Hz %dch" % (au["codec"], au["hz"], au["canales"]), "" if au["hz"] == 48000 else "ideal AAC 48 kHz",
            "--preset social")
    if r["lufs"] == float("-inf") or r["lufs"] < -60:
        inf.add("audio", "loudness", "WARN", "pista muda", "lleva audio pero no suena", "--sin-audio")
        return
    dif = abs(r["lufs"] - th["lufs_obj"])
    nv = "FAIL" if dif > th["lufs_tol_fail"] else ("WARN" if dif > th["lufs_tol_warn"] else "PASS")
    inf.add("audio", "loudness", nv, "%.1f LUFS · LRA %s" % (r["lufs"], "%.1f" % r["lra"] if r["lra"] is not None else "?"),
            "" if nv == "PASS" else "objetivo %.0f ± %.0f LUFS" % (th["lufs_obj"], th["lufs_tol_warn"]), "--normalizar-audio")
    tp = r["true_peak"]
    inf.add("audio", "true peak", "FAIL" if tp > th["tp_max"] else "PASS", "%.1f dBTP" % tp,
            "" if tp <= th["tp_max"] else "máx. %.1f dBTP (la plataforma lo recorta al recomprimir)" % th["tp_max"], "--normalizar-audio")
    pegadas = r["muestras_0db_pct"]
    clip = r["pico_db"] > 0.0 or pegadas > 1.0 or (r["pico_db"] >= -0.1 and (r["flat_factor"] > 0 or r["peak_count"] >= 10))
    nv = "FAIL" if clip else ("WARN" if pegadas > 0.1 else "PASS")
    inf.add("audio", "clipping", nv,
            "pico %.2f dBFS · %.2f%% a <1 dB de 0" % (r["pico_db"], pegadas),
            "onda recortada contra 0 dBFS (distorsión audible)" if clip else ("picos pegados a 0 dBFS" if nv == "WARN" else ""),
            "--normalizar-audio")
    dur = au["duracion"] or s["duracion"]
    largos = [(x, y) for x, y in r["silencios"] if y - x >= th["silencio_max_s"] and x > 0.5 and y < dur - 0.5]
    inf.add("audio", "silencios", "WARN" if largos else "PASS",
            ", ".join("%s–%s" % (fmt_t(x), fmt_t(y)) for x, y in largos[:3]) or "ninguno largo",
            "hueco de audio ≥ %.0fs en mitad del video" % th["silencio_max_s"] if largos else "")
    if abs((au["duracion"] or dur) - s["duracion"]) > 0.25:
        inf.add("audio", "duración a/v", "WARN", "audio %s · video %s" % (fmt_t(au["duracion"]), fmt_t(s["duracion"])),
                "colas desparejas", "--preset social")


def evaluar_alfa(inf, s, th, a, verde, externo=True):
    m = inf.metricas
    req = th["alfa"]
    if s.get("hevc_alfa_no_verificable") and req != "no":
        inf.add("alfa", "canal alfa", "SKIP", "HEVC .mov", "ffmpeg no decodifica la capa alfa HEVC: revísalo en Safari")
        return
    if a is None and s.get("alfa_posible"):
        inf.add("alfa", "canal alfa", "SKIP", "bandera alfa %s" % ("sí" if (s.get("webp") or {}).get("bandera_alfa") else "no"),
                "sin cuadros decodificados no se puede medir el alfa")
        return
    alfa = a.get("alfa") if a else None
    real = False
    if alfa:
        amin = min(c.get("YMIN", 255) for c in alfa)
        cobertura = [c.get("YAVG", 0.0) / 255.0 for c in alfa]
        vacios = [i for i, c in enumerate(alfa) if c.get("YMAX", 0) < 8]
        real = amin < 250
        semi = statistics.mean(a["semi"]) if a.get("semi") else 0.0
        m.update(alfa_cobertura_media=num(statistics.mean(cobertura), 4), alfa_cobertura_min=num(min(cobertura), 4),
                 alfa_cuadros_vacios=len(vacios), alfa_semitransparente=num(semi, 5))
    s["alfa_real"] = real
    if req == "no":
        if real:
            inf.add("alfa", "canal alfa", "WARN" if s["contenedor"] in ("mov", "webm") else "INFO", "con alfa",
                    "las redes no usan alfa: se aplanará sobre un fondo", "--preset social")
        return
    if not real:
        if alfa and not real:
            inf.add("alfa", "canal alfa", "FAIL" if req == "si" else "INFO", "alfa 100 % opaca", "el canal existe pero no recorta nada")
        elif verde and verde.get("verde"):
            inf.add("alfa", "canal alfa", "FAIL" if req == "si" else "WARN", "fondo verde sin recortar",
                    "pásalo por scripts/alfa-sin-verde.sh (pulir-video.sh lo delega solo)", "--recortar-verde")
        else:
            inf.add("alfa", "canal alfa", "FAIL" if req == "si" else "INFO", "sin alfa",
                    "un personaje web necesita fondo transparente (WebM VP9 yuva420p)" if req == "si" else "")
        return
    etiqueta = "RGBA" if s["tipo"] == "webp" else ("yuva420p (alpha_mode=1)" if s.get("alfa_tag") else s.get("pix_fmt"))
    inf.add("alfa", "canal alfa", "PASS", "%s · cobertura %.1f%%" % (etiqueta, m["alfa_cobertura_media"] * 100),
            "decodificado con %s" % ("anim_dump → PNG RGBA" if s["tipo"] == "webp" else
                                     (" ".join(s["decodificador"]) or "decodificador nativo")))
    vac = m["alfa_cuadros_vacios"]
    if vac:
        inf.add("alfa", "cuadros vacíos", "FAIL" if vac > 2 else "WARN", "%d cuadros 100 %% transparentes" % vac,
                "el personaje desaparece (parpadeo en la web)")
    if m["alfa_semitransparente"] < 0.0005 and m["alfa_cobertura_media"] > 0.01:
        inf.add("alfa", "bordes", "WARN", "alfa binaria", "sin antialias: bordes dentados sobre fondos claros")
    if s["tipo"] == "webp":
        w = s["webp"]
        if not w["bandera_alfa"] and (w.get("fondo_argb") or "FF").startswith("FF"):
            inf.add("alfa", "WebP: fondo del lienzo", "WARN", "sin bandera alfa · fondo %s" % w.get("fondo_argb"),
                    "algún visor puede pintar el fondo opaco; fija bgcolor 0,0,0,0 con webpmux", "--preset web-alfa")
    if externo:
        evaluar_alfa_externo(inf, s)


def evaluar_alfa_externo(inf, s):
    """Delega en scripts/verificar_alfa.py (cadena alfa sin verde): halo, fuga, cuadros vacíos, bordes."""
    if not os.path.exists(VERIFICAR_ALFA):
        inf.add("alfa", "verificar_alfa.py", "SKIP", "no existe aún",
                "scripts/verificar_alfa.py (cadena alfa sin verde) no está; solo verificación interna")
        return
    rc, out, err = sh([sys.executable, VERIFICAR_ALFA, s["archivo"], "--json"], timeout=1800)
    res = None
    try:
        j = json.loads(out)
        if isinstance(j, dict):
            j = j.get("archivos") or j.get("resultados") or [j]
        res = j[0] if isinstance(j, list) and j else None
    except (ValueError, TypeError, IndexError):
        res = None
    if not isinstance(res, dict):
        inf.add("alfa", "verificar_alfa.py", "FAIL" if rc == 1 else "WARN", "exit %d" % rc,
                "salida no reconocida: " + (err.strip() or out.strip())[-140:])
        return
    estado = str(res.get("estado") or res.get("veredicto") or "").upper()
    nivel = {"OK": "PASS", "PASS": "PASS", "FALLA": "FAIL", "FAIL": "FAIL", "WARN": "WARN"}.get(estado, "WARN")
    met = res.get("metricas") or {}
    clave = ["derrame_verde_%", "fuga_clave_%", "salto_cobertura_%", "toca_borde"]
    val = " · ".join("%s %s" % (k.replace("_%", "%").replace("_", " "), met[k]) for k in clave if k in met) or estado
    det = "; ".join(list(res.get("fallos") or []) + list(res.get("avisos") or []))
    if estado == "SIN VERIFICAR":
        det = "SIN VERIFICAR: " + det
    inf.add("alfa", "verificar_alfa.py", nivel, val[:60], det[:220])
    inf.metricas["verificar_alfa"] = {"exit": rc, "estado": estado, "metricas": met,
                                      "fallos": res.get("fallos"), "avisos": res.get("avisos")}


def evaluar_ocr(inf, s, th, o):
    if o is None:
        inf.add("tipografía", "OCR", "SKIP", "", "sin cuadros que leer")
        return
    cajas = o["cajas"]
    inf.metricas["ocr_palabras"] = len(cajas)
    if not cajas:
        inf.add("tipografía", "texto en pantalla", "PASS", "sin texto detectado (OCR %s)" % o["idioma"])
        return
    W, H = s["ancho"], s["alto"]
    vertical = s["alto"] > s["ancho"]
    if vertical:
        ml, mt, mb = th["margen_lat"], th["margen_sup"], th["margen_inf"]
    else:
        ml = mt = mb = th["margen_generico"]
    x0, x1, y0, y1 = W * ml, W * (1 - ml), H * mt, H * (1 - mb)
    fuera = [c for c in cajas if c["x"] < x0 or c["x"] + c["w"] > x1 or c["y"] < y0 or c["y"] + c["h"] > y1]
    textos = sorted(set(c["texto"] for c in cajas))
    inf.metricas["ocr_texto"] = textos[:40]
    inf.metricas["margen_seguro_px"] = {"x": [int(x0), int(x1)], "y": [int(y0), int(y1)]}
    if fuera:
        ej = ", ".join('"%s"@%s' % (c["texto"], fmt_t(c["t"])) for c in fuera[:4])
        inf.add("tipografía", "margen seguro", "FAIL", "%d palabras fuera" % len(fuera),
                "zona segura x %d–%d, y %d–%d px: %s" % (x0, x1, y0, y1, ej),
                "--texto (rehaz el rótulo dentro del margen)")
    else:
        inf.add("tipografía", "margen seguro", "PASS", "%d palabras dentro" % len(cajas),
                "zona x %d–%d, y %d–%d px" % (x0, x1, y0, y1))
    minimo = min(c["alto_linea"] for c in cajas) / float(H)
    inf.metricas["texto_alto_min_pct"] = num(minimo * 100, 2)
    nv = nivel_por(minimo, th["texto_min_warn"], th["texto_min_fail"], mayor=False)
    chicas = [c for c in cajas if c["alto_linea"] / float(H) <= th["texto_min_warn"]]
    inf.add("tipografía", "tamaño de texto", nv, "línea mín. %.1f%% del alto (%d px)" % (minimo * 100, minimo * H),
            ("ilegible en móvil: " + ", ".join('"%s"' % c["texto"] for c in chicas[:4])) if nv != "PASS" else "",
            "--texto (tamaño ≥ %.1f%% del alto)" % (th["texto_min_warn"] * 100))


def auditar(path, perfil, th_extra, opts):
    # ruta absoluta: el análisis corre ffmpeg con cwd en la carpeta temporal (sus ficheros de métricas)
    s = sondear(os.path.abspath(path))
    if s["tipo"] in ("ilegible", "sin-video", "imagen"):
        inf = Informe(path, perfil if perfil != "auto" else "-")
        inf.add("formato", "lectura", "SKIP" if s["tipo"] == "imagen" else "FAIL", s["tipo"],
                s.get("error", "imagen fija, no es video") if s["tipo"] != "sin-video" else "sin pista de video")
        return inf
    nombre = perfil_auto(s) if perfil == "auto" else perfil
    th = dict(PERFILES[nombre])
    th.update(th_extra)
    inf = Informe(path, nombre)
    tmp = tempfile.mkdtemp(prefix="jom-auditar-")
    try:
        entrada, aviso = preparar_entrada(s, tmp)
        fps = s.get("fps_decl") or s.get("fps_real") or 25.0
        a = None
        if entrada is None:
            inf.add("formato", "decodificación", "WARN", "solo metadatos", aviso)
        else:
            a = analisis_video(s, entrada, tmp, th, s.get("alfa_posible"))
            if "error" in a or not a.get("cuadros"):
                inf.add("formato", "decodificación", "FAIL", "no decodifica", (a or {}).get("error", "sin cuadros")[:200])
                a = None
        if a:
            inf.metricas["idet"] = a["idet"]
            if a.get("vfrdet"):
                inf.metricas["vfrdet"] = "%s (%s/%s)" % a["vfrdet"]
        evaluar_formato(inf, s, th)
        verde = None
        if (a is None or not a.get("alfa") or min(c.get("YMIN", 255) for c in a["alfa"]) >= 250) and s["tipo"] == "video":
            verde = detectar_verde(s["archivo"], s)
            inf.metricas["fondo_verde"] = verde.get("verde")
        evaluar_alfa(inf, s, th, a, verde, externo=not opts.sin_alfa_externo)
        if a:
            ctx = evaluar_edicion(inf, s, th, a, fps)
            costura = analisis_costura(s, entrada, tmp, s.get("alfa_posible"))
            evaluar_motion(inf, s, th, a, ctx, costura)
        evaluar_audio(inf, s, th)
        quiere_ocr = opts.ocr if opts.ocr is not None else bool(th["ocr"])
        if quiere_ocr:
            if not tiene("tesseract"):
                inf.add("tipografía", "OCR", "SKIP", "sin tesseract", "brew install tesseract tesseract-lang para revisar márgenes")
            elif entrada is None:
                inf.add("tipografía", "OCR", "SKIP", "", "sin cuadros decodificados")
            else:
                evaluar_ocr(inf, s, th, analisis_ocr(s, entrada, tmp, th, a["negros"] if a else []))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return inf


# ───────────────────────────── salida ─────────────────────────────
def recolectar(rutas):
    vistos = []
    for r in rutas:
        if os.path.isdir(r):
            for base, dirs, files in os.walk(r):
                dirs[:] = sorted(d for d in dirs if d not in CARPETAS_IGNORADAS and not d.startswith("."))
                for f in sorted(files):
                    if f.lower().endswith(EXT_VIDEO) and not f.startswith("."):
                        vistos.append(os.path.join(base, f))
        elif os.path.isfile(r):
            vistos.append(r)
        else:
            print("✖ no existe: %s" % r, file=sys.stderr)
    return vistos


def imprimir(inf, solo_problemas=False):
    v = inf.veredicto()
    print("\n━━ %s  ·  perfil %s  ·  %s %s" % (inf.archivo, inf.perfil, SIMBOLO[v], v))
    for c in inf.checks:
        if solo_problemas and GRAVEDAD.get(c["nivel"], 0) == 0:
            continue
        val = str(c["valor"])
        det = c["detalle"] or ""
        print("  %s %-4s  %-10s %-20s %-34s %s" % (SIMBOLO.get(c["nivel"], "?"), c["nivel"], c["area"], c["id"][:20], val[:34], det))
    if inf.recetas:
        print("  → arreglo: scripts/pulir-video.sh \"%s\" %s" % (inf.archivo, " ".join(r for r in inf.recetas if r.startswith("--"))))


def flags_pulido(inf):
    flags = []
    for r in inf.recetas:
        r = r.split(" (")[0]
        if r.startswith("--texto"):
            continue
        if r.startswith("--") and r not in flags:
            flags.append(r)
    # una sola regla por bandera (p. ej. dos --recortar-fin): gana la mayor
    final, vistos = [], {}
    for f in flags:
        k = f.split(" ")[0]
        if k in vistos:
            prev = final[vistos[k]]
            try:
                if float(f.split(" ")[1].rstrip("f")) > float(prev.split(" ")[1].rstrip("f")):
                    final[vistos[k]] = f
            except (IndexError, ValueError):
                pass
            continue
        vistos[k] = len(final)
        final.append(f)
    return " ".join(final)


def main():
    ap = argparse.ArgumentParser(description="Auditoría técnica de videos de JOM Studio.",
                                 formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__)
    ap.add_argument("rutas", nargs="*")
    ap.add_argument("--perfil", default="auto", choices=["auto"] + sorted(PERFILES))
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--umbral", action="append", default=[], metavar="clave=valor")
    ap.add_argument("--ocr", dest="ocr", action="store_true", default=None)
    ap.add_argument("--sin-ocr", dest="ocr", action="store_false")
    ap.add_argument("--sin-alfa-externo", action="store_true")
    ap.add_argument("--solo-problemas", action="store_true")
    ap.add_argument("--flags-pulido", action="store_true")
    ap.add_argument("--perfiles", action="store_true")
    ap.add_argument("--detectar-verde", action="store_true")
    ap.add_argument("--sondear", action="store_true")
    ap.add_argument("--version", action="version", version="auditar_video.py " + VERSION)
    o = ap.parse_args()
    if o.perfiles:
        for k in sorted(PERFILES):
            print("\n%s — %s" % (k, PERFILES[k]["descripcion"]))
            for kk, vv in sorted(PERFILES[k].items()):
                if kk != "descripcion":
                    print("  %-18s %s" % (kk, vv))
        return 0
    if not tiene("ffmpeg") or not tiene("ffprobe"):
        print("✖ falta ffmpeg/ffprobe (brew install ffmpeg)", file=sys.stderr)
        return 2
    extra = {}
    for u in o.umbral:
        if "=" not in u:
            print("✖ --umbral espera clave=valor: %s" % u, file=sys.stderr)
            return 2
        k, v = u.split("=", 1)
        base = COMUN.get(k, PERFILES["social-vertical"].get(k))
        if base is None:
            print("✖ umbral desconocido: %s (mira --perfiles)" % k, file=sys.stderr)
            return 2
        extra[k] = float(v) if isinstance(base, (int, float)) else v
    rutas = recolectar(o.rutas)
    if not rutas:
        ap.print_usage(sys.stderr)
        return 2
    if o.detectar_verde or o.sondear:
        for r in rutas:
            s = sondear(r)
            if o.detectar_verde:
                print(json.dumps(dict(detectar_verde(r, s), archivo=r), ensure_ascii=False))
            else:
                for k in ("tipo", "codec", "contenedor", "ancho", "alto", "fps_decl", "fps_real", "duracion", "pix_fmt",
                          "alfa_posible", "cuadros"):
                    v = s.get(k)
                    print("%s=%s" % (k, ("%.6f" % v) if isinstance(v, float) else ("1" if v is True else ("0" if v is False else v))))
                print("audio=%s" % ("1" if s.get("audio") else "0"))
                print("vfr=%s" % ("1" if s.get("vfr_irregular", 0) > PERFILES["social-vertical"]["vfr_tol"] else "0"))
                print("matriz=%s" % ((s.get("color") or {}).get("matriz") or ""))
                print("decodificador=%s" % " ".join(s.get("decodificador") or []))
                print("webp_reps=%s" % ",".join(str(x) for x in (s.get("webp_reps") or [])))
                print("perfil_auto=%s" % (perfil_auto(s) if s["tipo"] in ("video", "webp") else "-"))
        return 0
    informes = []
    for r in rutas:
        if not o.json and not o.flags_pulido:
            print("… auditando %s" % r, file=sys.stderr)
        informes.append(auditar(r, o.perfil, extra, o))
    if o.flags_pulido:
        for inf in informes:
            print(flags_pulido(inf) if len(informes) == 1 else "%s\t%s" % (inf.archivo, flags_pulido(inf)))
    elif o.json:
        print(json.dumps({"version": VERSION, "archivos": [
            {"archivo": i.archivo, "perfil": i.perfil, "veredicto": i.veredicto(), "metricas": i.metricas,
             "checks": i.checks, "flags_pulido": flags_pulido(i)} for i in informes]}, ensure_ascii=False, indent=2, default=str))
    else:
        for inf in informes:
            imprimir(inf, o.solo_problemas)
        cuenta = {"PASS": 0, "WARN": 0, "FAIL": 0}
        for inf in informes:
            cuenta[inf.veredicto()] += 1
        print("\nResumen: %d ✔ PASS · %d ⚠ WARN · %d ✖ FAIL" % (cuenta["PASS"], cuenta["WARN"], cuenta["FAIL"]))
    return 1 if any(i.veredicto() == "FAIL" for i in informes) else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
