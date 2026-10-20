#!/usr/bin/env python3
"""Verifica el canal alfa de videos/imágenes recortados (Departamento 03 · Arte IA).

Solo biblioteca estándar + ffmpeg/ffprobe (Python 3.9 del Mac, sin numpy ni Pillow).
WebP ANIMADO: ffmpeg 6/7 no lo decodifica; se usa anim_dump (o webpmux + dwebp) de
libwebp:  brew install webp

Uso:
  scripts/verificar_alfa.py salida.webm salida.webp [--fuente original.mp4] [--json]
  scripts/verificar_alfa.py alfa-out/*.png --fuente "fotos/retrato.jpg"

Métricas (las de borde, en una muestra de fotogramas; cobertura y caja, en todos):
  tiene_alfa         hay transparencia real (si no: "caja" negra/verde al componer en la web)
  derrame_verde_%    % del borde (semitransparentes + 2 px opacos) con verde visible por encima del
                     interior cercano del sujeto = halo. Sobre todo en la banda semitransparente.
  fuga_clave_%       con --fuente: % de la pantalla segura del original que queda con alfa > 10 %;
                     sin --fuente: % del marco exterior (1,5 %) con alfa > 10 % (aproximado)
  sujeto_perdido_%   con --fuente: % de píxeles claramente NO verdes del original con alfa < 50 %
                     (miembros cortados por la clave o por el modelo)
  toca_borde         la caja del sujeto toca el marco = posible corte (si el original ya lo
                     tocaba es solo aviso; --permitir-borde abajo,izq,... lo acepta)
  salto_cobertura_%  mayor salto de cobertura de un fotograma respecto a sus vecinos
                     (parpadeo, una pierna que desaparece en un fotograma)
Sale con 1 si algún archivo falla los umbrales; 0 si todo pasa (SIN VERIFICAR = aviso,
salvo con --estricto).
"""
import argparse
import glob
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile

UMBRALES = {  # por defecto; calibrados con scratchpad (ver comentarios en alfa-sin-verde.sh)
    "derrame_verde_%": 3.0,
    "fuga_clave_%": 1.0,
    "sujeto_perdido_%": 1.0,
    "salto_cobertura_%": 5.0,
}
LADOS = ("arriba", "abajo", "izq", "der")


class SinVerificar(Exception):
    pass


def run(cmd, **kw):  # stdin cerrado: ffmpeg lee teclas de stdin y se comería la entrada del llamador
    return subprocess.run(cmd, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kw)


def tabla(fn):  # tabla de 256 bytes para bytes.translate (máscaras 0/1 a velocidad de C)
    return bytes(1 if fn(v) else 0 for v in range(256))


T_TRANSP = tabla(lambda v: v < 8)
T_ALFA10 = tabla(lambda v: v > 25)
T_MEDIO = tabla(lambda v: v < 128)
T_OPACO = tabla(lambda v: v >= 243)
T_BANDA = tabla(lambda v: 13 <= v <= 242)
NEGAR = tabla(lambda v: v == 0)  # invierte una máscara 0/1


def contar(mask):
    return mask.count(1)


def y_bits(a, b):  # AND de dos máscaras 0/1 del mismo tamaño
    n = len(a)
    return (int.from_bytes(a, "little") & int.from_bytes(b, "little")).to_bytes(n, "little")


def o_bits(a, b):
    n = len(a)
    return (int.from_bytes(a, "little") | int.from_bytes(b, "little")).to_bytes(n, "little")


def dilatar(mask, w, r):
    """Dilatación cuadrada de radio r con desplazamientos de un entero grande (1 byte = 1 px)."""
    n = len(mask)
    x = int.from_bytes(mask, "little")
    full = (1 << (8 * n)) - 1
    for _ in range(r):
        x = x | (x << 8) | (x >> 8)
        x = (x | (x << (8 * w)) | (x >> (8 * w))) & full
    return x.to_bytes(n, "little")


def caja(mask, w, h):
    """bbox (x0, y0, x1, y1) de los 1 de la máscara, o None."""
    first = mask.find(1)
    if first < 0:
        return None
    last = mask.rfind(1)
    y0, y1 = first // w, last // w
    x0, x1 = w, -1
    for y in range(y0, y1 + 1):
        row = mask[y * w:(y + 1) * w]
        f = row.find(1)
        if f >= 0:
            if f < x0:
                x0 = f
            g = row.rfind(1)
            if g > x1:
                x1 = g
    return x0, y0, x1, y1


def lados_tocados(bb, w, h):
    if bb is None:
        return set()
    x0, y0, x1, y1 = bb
    s = set()
    if y0 <= 0:
        s.add("arriba")
    if y1 >= h - 1:
        s.add("abajo")
    if x0 <= 0:
        s.add("izq")
    if x1 >= w - 1:
        s.add("der")
    return s


# ---------------------------------------------------------------- decodificación
def es_webp_animado(path):
    with open(path, "rb") as f:
        head = f.read(32)
    # RIFF....WEBPVP8X + flags: bit 1 (0x02) = animación
    return head[:4] == b"RIFF" and head[8:12] == b"WEBP" and head[12:16] == b"VP8X" and bool(head[20] & 0x02)


def sondear(path):
    p = run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_packets", "-show_entries",
             "stream=codec_name,width,height,pix_fmt,nb_read_packets:stream_tags=alpha_mode",
             "-of", "json", path])
    if p.returncode:
        raise SinVerificar("ffprobe no puede leerlo: " + p.stderr.decode(errors="replace").strip()[-200:])
    st = (json.loads(p.stdout.decode() or "{}").get("streams") or [{}])[0]
    if not st.get("width"):
        raise SinVerificar("sin pista de video")
    tags = {k.lower(): v for k, v in (st.get("tags") or {}).items()}
    n = st.get("nb_read_packets")
    return {"codec": st.get("codec_name", "?"), "w": int(st["width"]), "h": int(st["height"]),
            "pix_fmt": st.get("pix_fmt", "?"), "n": int(n) if n and n.isdigit() else None,
            "alpha_mode": tags.get("alpha_mode")}


def leer_pam(path):
    with open(path, "rb") as f:
        data = f.read()
    end = data.index(b"ENDHDR\n") + 7
    hdr = dict(l.split(" ", 1) for l in data[:end].decode().splitlines()[1:-1] if " " in l)
    w, h, d = int(hdr["WIDTH"]), int(hdr["HEIGHT"]), int(hdr["DEPTH"])
    px = data[end:end + w * h * d]
    if d == 3:  # sin alfa: lo añadimos opaco
        out = bytearray(w * h * 4)
        out[0::4], out[1::4], out[2::4] = px[0::3], px[1::3], px[2::3]
        out[3::4] = b"\xff" * (w * h)
        px = bytes(out)
    return w, h, px


def frames_webp_animado(path, tmp):
    """Fotogramas RGBA de un WebP animado: anim_dump > webpmux+dwebp > ffmpeg (si es ≥ 8)."""
    if shutil.which("anim_dump"):
        d = os.path.join(tmp, "anim")
        os.makedirs(d)
        p = run(["anim_dump", "-folder", d, "-prefix", "f_", "-pam", path])
        files = sorted(glob.glob(os.path.join(d, "f_*.pam")))
        if p.returncode == 0 and files:
            w, h, _ = leer_pam(files[0])
            return "anim_dump", w, h, len(files), (leer_pam(f)[2] for f in files)
    if shutil.which("webpmux") and shutil.which("dwebp"):
        info = run(["webpmux", "-info", path]).stdout.decode(errors="replace")
        m = re.search(r"Canvas size:\s*(\d+)\s*x\s*(\d+)", info)
        rows = re.findall(r"^\s*(\d+):\s+(\d+)\s+(\d+)\s+(\w+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\w+)\s+(\w+)", info, re.M)
        if m and rows:
            return ("webpmux+dwebp", int(m.group(1)), int(m.group(2)), len(rows),
                    _componer_webpmux(path, tmp, int(m.group(1)), int(m.group(2)), rows))
    # ffmpeg ≥ 8 decodifica WebP animado; 6/7 fallan con "image data not found"
    p = run(["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-f", "rawvideo", "-pix_fmt", "rgba", "-"])
    pr = run(["ffprobe", "-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", path])
    try:
        w, h = (int(x) for x in pr.stdout.decode().strip().split(",")[:2])
    except ValueError:
        w = h = 0
    if p.returncode == 0 and w and len(p.stdout) >= w * h * 4 * 2:
        fs = w * h * 4
        n = len(p.stdout) // fs
        return "ffmpeg", w, h, n, (p.stdout[i * fs:(i + 1) * fs] for i in range(n))
    raise SinVerificar("WebP animado: ni anim_dump ni webpmux/dwebp (brew install webp) y este ffmpeg no lo decodifica")


def _componer_webpmux(path, tmp, W, H, rows):
    canvas = bytearray(W * H * 4)  # transparente, como hacen los navegadores
    for (idx, fw, fh, _alpha, fx, fy, _dur, dispose, blend) in rows:
        fw, fh, fx, fy = int(fw), int(fh), int(fx), int(fy)
        fwebp, fpam = os.path.join(tmp, "fr.webp"), os.path.join(tmp, "fr.pam")
        run(["webpmux", "-get", "frame", idx, path, "-o", fwebp], check=True)
        run(["dwebp", fwebp, "-pam", "-o", fpam], check=True)
        _, _, px = leer_pam(fpam)
        for y in range(fh):
            src = px[y * fw * 4:(y + 1) * fw * 4]
            o = ((fy + y) * W + fx) * 4
            if blend == "no":
                canvas[o:o + fw * 4] = src
            else:  # "src over dst" por píxel (camino lento, solo respaldo)
                for x in range(fw):
                    sa = src[4 * x + 3]
                    if sa == 255:
                        canvas[o + 4 * x:o + 4 * x + 4] = src[4 * x:4 * x + 4]
                    elif sa:
                        da = canvas[o + 4 * x + 3]
                        oa = sa + da * (255 - sa) / 255.0
                        for c in range(3):
                            canvas[o + 4 * x + c] = int((src[4 * x + c] * sa + canvas[o + 4 * x + c] * da * (255 - sa) / 255.0) / oa + 0.5)
                        canvas[o + 4 * x + 3] = int(oa + 0.5)
        yield bytes(canvas)
        if dispose == "background":
            for y in range(fh):
                o = ((fy + y) * W + fx) * 4
                canvas[o:o + fw * 4] = bytes(fw * 4)


def frames_ffmpeg(path, info, pix_fmt="rgba", vf=None):
    # El decodificador NATIVO de VP9/VP8 de ffmpeg descarta el alfa (BlockAdditional del WebM)
    # y entrega el fondo negro opaco: hay que forzar libvpx ANTES de -i. Medido: el mismo .webm
    # da 0 % transparente con el nativo y 78,7 % con -c:v libvpx-vp9.
    pre = {"vp9": ["-c:v", "libvpx-vp9"], "vp8": ["-c:v", "libvpx"]}.get(info["codec"], [])
    bpp = {"rgba": 4, "yuv444p": 3}[pix_fmt]
    cmd = ["ffmpeg", "-nostdin", "-v", "error", *pre, "-i", path, "-map", "0:v:0"]
    if vf:
        cmd += ["-vf", vf]
    cmd += ["-f", "rawvideo", "-pix_fmt", pix_fmt, "-"]
    fs = info["w"] * info["h"] * bpp
    proc = subprocess.Popen(cmd, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)

    def gen():
        try:
            while True:
                buf = proc.stdout.read(fs)
                if len(buf) < fs:
                    break
                yield buf
        finally:
            proc.stdout.close()
            proc.wait()
    return gen()


def abrir(path, tmp):
    """→ (decodificador, w, h, n|None, iterador de fotogramas RGBA, info)."""
    if path.lower().endswith(".webp") and es_webp_animado(path):
        dec, w, h, n, it = frames_webp_animado(path, tmp)
        return dec, w, h, n, it, {"codec": "webp", "alpha_mode": None}
    info = sondear(path)
    dec = {"vp9": "libvpx-vp9", "vp8": "libvpx"}.get(info["codec"], "ffmpeg/" + info["codec"])
    return dec, info["w"], info["h"], info["n"], frames_ffmpeg(path, info), info


# ---------------------------------------------------------------- clave del original
def medir_clave_yuv(frame, w, h):
    """Mediana U,V del borde (3 %) del primer fotograma y ruido p99.9 (igual que alfa-sin-verde.sh)."""
    n = w * h
    U, V = frame[n:2 * n], frame[2 * n:3 * n]
    m = max(4, round(min(w, h) * 0.03))
    idx = [y * w + x for y in range(h) for x in range(w) if y < m or y >= h - m or x < m or x >= w - m]
    med = lambda v: sorted(v)[len(v) // 2]
    ku, kv = med([U[i] for i in idx]), med([V[i] for i in idx])
    d = sorted(math.hypot(U[i] - ku, V[i] - kv) / (255 * 2 ** 0.5) for i in idx)
    dm = d[len(d) // 2]
    d = [x for x in d if x <= max(0.03, 6 * dm)]  # fuera el sujeto si toca el borde
    return ku, kv, d[int(0.999 * (len(d) - 1))]


def tablas_fuente(ku, kv, p999):
    # Pantalla segura: distancia UV ≤ p99.9 del ruido del borde. Cuadrado inscrito → separable.
    s = p999 * 255.0
    seg_u = tabla(lambda v: abs(v - ku) <= s)
    seg_v = tabla(lambda v: abs(v - kv) <= s)
    # Sujeto seguro: distancia UV > 0.15 (≈ 5x el ruido típico). Fuera del cuadrado circunscrito.
    R = 0.15 * 255.0 * 2 ** 0.5
    suj_u = tabla(lambda v: abs(v - ku) > R)
    suj_v = tabla(lambda v: abs(v - kv) > R)
    return seg_u, seg_v, suj_u, suj_v


# ---------------------------------------------------------------- derrame en el borde
def derrame(rgba, alpha, w, h, canal):
    """% de píxeles de borde con exceso de verde (o azul) visible respecto al interior cercano."""
    n = w * h
    opaco = alpha.translate(T_OPACO)
    no_opaco = opaco.translate(NEGAR)
    dil = dilatar(no_opaco, w, 2)
    borde_opaco = y_bits(opaco, dil)                      # 2 px opacos junto al borde
    semi = alpha.translate(T_BANDA)                        # 5 %..95 %
    banda = o_bits(semi, borde_opaco)
    interior = y_bits(opaco, dil.translate(NEGAR))       # opaco y lejos del borde
    D = max(6, round(min(w, h) / 90))                     # 6 px a 540 de ancho, 12 a 1080
    offs = []
    for r in (D, (3 * D) // 2):
        q = max(1, round(r / 2 ** 0.5))
        offs += [(r, 0), (-r, 0), (0, r), (0, -r), (q, q), (q, -q), (-q, q), (-q, -q)]
    g, o1, o2 = (1, 0, 2) if canal == "verde" else (2, 0, 1)
    vis_umbral = 10.0   # niveles 0-255 de exceso VISIBLE (alfa x exceso) que cuentan como halo
    tot = cnt = tot_s = cnt_s = 0
    i = banda.find(1)
    while i >= 0:
        p = 4 * i
        exc = rgba[p + g] - max(rgba[p + o1], rgba[p + o2])
        if exc > 0:
            x, y = i % w, i // w
            ref = 0
            for dx, dy in offs:
                xx, yy = x + dx, y + dy
                if 0 <= xx < w and 0 <= yy < h:
                    j = yy * w + xx
                    if interior[j]:
                        q = 4 * j
                        e = rgba[q + g] - max(rgba[q + o1], rgba[q + o2])
                        if e > ref:
                            ref = e
            vis = alpha[i] / 255.0 * (exc - ref)
            halo = vis > vis_umbral
        else:
            halo = False
        tot += 1
        cnt += halo
        if semi[i]:
            tot_s += 1
            cnt_s += halo
        i = banda.find(1, i + 1)
    return (100.0 * cnt / tot if tot else 0.0), (100.0 * cnt_s / tot_s if tot_s else 0.0), tot


# ---------------------------------------------------------------- análisis de un archivo
def analizar(path, args, tmp):
    res = {"archivo": path, "estado": "OK", "fallos": [], "avisos": [], "metricas": {}}
    try:
        dec, w, h, n, frames, info = abrir(path, tmp)
    except SinVerificar as e:
        res.update(estado="SIN VERIFICAR", decodificador="-")
        res["avisos"].append(str(e))
        return res
    res.update(decodificador=dec, ancho=w, alto=h)
    if info.get("codec") == "vp9" and info.get("alpha_mode") != "1":
        res["avisos"].append("el WebM no declara alpha_mode=1: VP9 sin canal alfa")

    fuente = None
    if args.fuente:
        try:
            fi = sondear(args.fuente)
            if (fi["w"], fi["h"]) != (w, h):
                res["avisos"].append("la fuente mide %dx%d y la salida %dx%d: métricas de fuente omitidas"
                                     % (fi["w"], fi["h"], w, h))
            else:
                fi["codec"] = "fuente"   # el original se decodifica con el decodificador por defecto
                # yuv444p por el mismo camino que usa alfa-sin-verde.sh (format=yuva444p)
                fuente = frames_ffmpeg(args.fuente, fi, "yuv444p", "format=yuv444p")
        except SinVerificar as e:
            res["avisos"].append("fuente ilegible: %s" % e)

    total = n or 0
    k = max(1, args.muestras)
    if total:
        muestras = set(round(i * (total - 1) / max(1, k - 1)) for i in range(k)) if total > 1 else {0}
    else:
        muestras = set(range(0, 10 ** 9, 12))  # sin recuento: uno de cada 12
    cob, transp, lados, lados_fuente = [], [], {}, set()
    der, der_s, fugas, perds = [], [], [], []   # por fotograma muestreado: (%, índice)
    tablas = None
    ring = None
    primero = b""
    N = w * h
    i = -1
    for i, fr in enumerate(frames):
        if i >= args.max_fotogramas:
            res["avisos"].append("solo se analizan los primeros %d fotogramas" % args.max_fotogramas)
            break
        a = fr[3::4]
        cob.append(sum(a) / (255.0 * N))
        transp.append(contar(a.translate(T_TRANSP)))
        if i == 0:
            primero = fr
        m10 = a.translate(T_ALFA10)
        bb = caja(m10, w, h)
        for s in lados_tocados(bb, w, h):
            lados.setdefault(s, []).append(i)
        fy = next(fuente, None) if fuente is not None else None
        if fy is not None:
            if tablas is None:
                ku, kv, p999 = medir_clave_yuv(fy, w, h)
                tablas = tablas_fuente(ku, kv, p999)
                res["clave_fuente_uv"] = [ku, kv, round(p999, 4)]
            U, V = fy[N:2 * N], fy[2 * N:3 * N]
            suj = o_bits(U.translate(tablas[2]), V.translate(tablas[3]))
            lados_fuente |= lados_tocados(caja(suj, w, h), w, h)
        if i in muestras:
            d, ds, nb = derrame(fr, a, w, h, args.pantalla)
            der.append(d)
            der_s.append(ds)
            if fy is not None:
                seg = y_bits(U.translate(tablas[0]), V.translate(tablas[1]))
                ns, nj = contar(seg), contar(suj)
                if ns:
                    fugas.append((100.0 * contar(y_bits(seg, m10)) / ns, i))
                if nj:
                    perds.append((100.0 * contar(y_bits(suj, a.translate(T_MEDIO))) / nj, i))
            else:
                if ring is None:
                    mr = max(2, round(min(w, h) * 0.015))
                    ring = bytes(1 if (y < mr or y >= h - mr or x < mr or x >= w - mr) else 0
                                 for y in range(h) for x in range(w))
                fugas.append((100.0 * contar(y_bits(ring, m10)) / contar(ring), i))
    nf = i + 1
    if nf <= 0:
        res.update(estado="SIN VERIFICAR")
        res["avisos"].append("no se pudo decodificar ningún fotograma")
        return res
    res["fotogramas"] = nf
    met = res["metricas"]
    frac_t = sorted(t / N for t in transp)[len(transp) // 2]
    met["transparente_%"] = round(100 * frac_t, 2)
    met["tiene_alfa"] = frac_t >= 0.01
    if not met["tiene_alfa"]:
        # ¿qué se vería? color medio del marco del primer fotograma
        fr = primero
        if fr:
            px = [fr[4 * j:4 * j + 3] for j in list(range(0, w)) + list(range(N - w, N))]
            mr_, mg, mb = (sum(p[c] for p in px) / len(px) for c in range(3))
            tipo = "negra" if max(mr_, mg, mb) < 40 else ("verde" if mg > mr_ + 25 and mg > mb + 25 else "opaca")
        else:
            tipo = "opaca"
        msg = "sin transparencia: se verá una caja %s" % tipo
        if info.get("codec") == "hevc":
            res["estado"] = "SIN VERIFICAR"
            res["avisos"].append("HEVC: este ffmpeg no entrega el alfa de HEVC; compruébalo en Safari")
        else:
            res["fallos"].append(msg)
    met["derrame_verde_%"] = round(max(der), 2) if der else 0.0
    met["derrame_semitransparente_%"] = round(max(der_s), 2) if der_s else 0.0
    # peor fotograma muestreado: un solo fotograma con la pierna borrada ya es un fallo
    f_max = max(fugas) if fugas else (0.0, 0)
    met["fuga_clave_%"] = round(f_max[0], 2)
    met["fuga_metodo"] = "fuente" if tablas else "marco (aprox.)"
    if tablas:
        p_max = max(perds) if perds else (0.0, 0)
        met["sujeto_perdido_%"] = round(p_max[0], 2)
        met["perdido_en_fotograma"] = p_max[1]
    toc = sorted(lados)
    met["toca_borde"] = ",".join(toc) if toc else "no"
    if len(cob) >= 3:
        mean = sum(cob) / len(cob)
        saltos = [abs(cob[j] - (cob[j - 1] + cob[j + 1]) / 2) / mean * 100 if mean else 0 for j in range(1, len(cob) - 1)]
        jmax = max(range(len(saltos)), key=lambda j: saltos[j])
        met["salto_cobertura_%"] = round(saltos[jmax], 2)
        met["salto_en_fotograma"] = jmax + 1
        med = sorted(cob)[len(cob) // 2]
        vac = sum(1 for c in cob if c < 0.2 * med)
        if vac:
            res["fallos"].append("%d fotogramas casi vacíos (el sujeto desaparece)" % vac)
    met["cobertura_media_%"] = round(100 * sum(cob) / len(cob), 2)

    if met["tiene_alfa"]:
        if met["derrame_verde_%"] > args.max_derrame:
            res["fallos"].append("halo: derrame_verde %.2f %% > %.2f" % (met["derrame_verde_%"], args.max_derrame))
        if met["fuga_clave_%"] > args.max_fuga:
            res["fallos"].append("fondo sin quitar: fuga_clave %.2f %% > %.2f" % (met["fuga_clave_%"], args.max_fuga))
        if met.get("sujeto_perdido_%", 0) > args.max_perdido:
            res["fallos"].append("sujeto recortado: sujeto_perdido %.2f %% en el fotograma %d > %.2f"
                                 % (met["sujeto_perdido_%"], met["perdido_en_fotograma"], args.max_perdido))
        if met.get("salto_cobertura_%", 0) > args.max_salto:
            res["fallos"].append("cobertura inestable: salto %.2f %% en el fotograma %d > %.2f"
                                 % (met["salto_cobertura_%"], met["salto_en_fotograma"], args.max_salto))
        for s in toc:
            fr_s = lados[s]
            txt = "toca el borde %s en %d fotogramas (desde el %d)" % (s, len(fr_s), fr_s[0])
            if s in args.permitir_borde:
                res["avisos"].append(txt + " — permitido")
            elif s in lados_fuente:
                res["avisos"].append(txt + " — el original ya lo toca")
            elif met["fuga_clave_%"] > args.max_fuga:
                res["avisos"].append(txt + " — es el fondo sin quitar, no el sujeto")
            else:
                res["fallos"].append(txt + ": posible corte")
    if res["fallos"]:
        res["estado"] = "FALLA"
    return res


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("archivos", nargs="+")
    ap.add_argument("--fuente", help="original con pantalla verde (mismos fotogramas y tamaño)")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--muestras", type=int, default=8, help="fotogramas para las métricas de borde (8)")
    ap.add_argument("--max-fotogramas", type=int, default=3000)
    ap.add_argument("--pantalla", choices=("verde", "azul"), default="verde")
    ap.add_argument("--permitir-borde", default="", help="lados aceptados: arriba,abajo,izq,der")
    ap.add_argument("--max-derrame", type=float, default=UMBRALES["derrame_verde_%"])
    ap.add_argument("--max-fuga", type=float, default=UMBRALES["fuga_clave_%"])
    ap.add_argument("--max-perdido", type=float, default=UMBRALES["sujeto_perdido_%"])
    ap.add_argument("--max-salto", type=float, default=UMBRALES["salto_cobertura_%"])
    ap.add_argument("--estricto", action="store_true", help="SIN VERIFICAR cuenta como fallo")
    args = ap.parse_args()
    args.permitir_borde = set(s for s in args.permitir_borde.split(",") if s)
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        print("✖ falta ffmpeg/ffprobe (brew install ffmpeg)", file=sys.stderr)
        return 2
    out = []
    for f in args.archivos:
        if not os.path.isfile(f):
            out.append({"archivo": f, "estado": "SIN VERIFICAR", "avisos": ["no existe"], "fallos": [], "metricas": {}})
            continue
        tmp = tempfile.mkdtemp(prefix="jom-verif.")
        try:
            out.append(analizar(f, args, tmp))
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    if args.json:
        print(json.dumps(out, ensure_ascii=False, indent=1))
    else:
        cols = [("tiene_alfa", "alfa"), ("derrame_verde_%", "derrame%"), ("derrame_semitransparente_%", "der.semi%"),
                ("fuga_clave_%", "fuga%"), ("sujeto_perdido_%", "perdido%"), ("toca_borde", "borde"),
                ("salto_cobertura_%", "salto%")]
        print("%-34s %-14s %5s " % ("archivo", "decodificador", "fot.") + " ".join("%9s" % c for _, c in cols) + "  estado")
        for r in out:
            m = r.get("metricas", {})
            vals = []
            for k, _ in cols:
                v = m.get(k, "-")
                vals.append("%9s" % ({True: "sí", False: "NO"}.get(v, v) if isinstance(v, bool) else v))
            name = os.path.basename(r["archivo"])
            print("%-34s %-14s %5s " % (name[:34], r.get("decodificador", "-")[:14], r.get("fotogramas", "-"))
                  + " ".join(vals) + "  " + {"OK": "✔ OK", "FALLA": "✖ FALLA"}.get(r["estado"], "⚠ " + r["estado"]))
            for x in r["fallos"]:
                print("    ✖ " + x)
            for x in r["avisos"]:
                print("    ⚠ " + x)
    falla = any(r["estado"] == "FALLA" or (args.estricto and r["estado"] != "OK") for r in out)
    return 1 if falla else 0


if __name__ == "__main__":
    sys.exit(main())
