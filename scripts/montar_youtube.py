#!/usr/bin/env python3
"""JOM Studio · motor de montaje para YouTube (lo lanza scripts/montar-youtube.sh).

Python 3.9 + solo biblioteca estándar (el /usr/bin/python3 del Mac). Llama a
ffmpeg/ffprobe para todo lo audiovisual. Nunca escribe sobre las entradas: la
entrega va a una carpeta NUEVA y los intermedios a una carpeta temporal.

Uso: scripts/montar-youtube.sh --help   (o python3 scripts/montar_youtube.py --help)
"""
import argparse
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import unicodedata
from pathlib import Path

W, H, FPS = 1920, 1080, 30
SW, SH = 1080, 1920
TW, TH = 1280, 720
DARK, GOLD, TEAL, CREAM, WHITE = '0D0D0D', 'C4A35A', '2EC4B6', 'F4F1EC', 'FFFFFF'
LUFS, TP_TARGET, LRA_TARGET = -14.0, -1.5, 18.0   # TP con margen: el AAC sube algo el pico
SHORT_MAX = 58.0                                  # ≤ 60 s con margen
CHAPTER_MIN = 10                                   # requisito de YouTube
VIDEO_EXT = ('.webm', '.mp4', '.mov', '.mkv', '.m4v')

DEPARTAMENTOS = {
    'home': ('JOM Studio', 'El estudio y su companion'),
    '01': ('01 · Gamificación', 'Arena jugable con personaje 3D'),
    '02': ('02 · Full-Stack & 3D', 'Shaders, CSP y arquitectura web'),
    '03': ('03 · Arte IA', 'Concepto en tiempo real · alfa sin pantalla verde'),
    '04': ('04 · Automatización', 'Pipelines y JOM Correo local'),
    '05': ('05 · Audio UGC', 'Sonido interactivo para la web'),
    '06': ('06 · Branding', 'Identidad, moneda y tipografía'),
    '07': ('07 · Sentinel QA', 'Auditorías y seguridad'),
}
ETIQUETAS_DEP = {
    'home': ['JOM Studio', 'estudio creativo', 'desarrollo web'],
    '01': ['gamificación', 'three.js', 'juego web 3D'],
    '02': ['full stack', 'WebGL', 'shaders'],
    '03': ['arte IA', 'inteligencia artificial', 'diseño generativo'],
    '04': ['automatización', 'email marketing', 'productividad'],
    '05': ['audio interactivo', 'UGC', 'Web Audio'],
    '06': ['branding', 'identidad visual', 'tipografía'],
    '07': ['QA', 'auditoría web', 'ciberseguridad'],
}
KEYS_VIDEO = {'titulo', 'subtitulo', 'descripcion', 'etiquetas', 'miniatura', 'miniatura_de', 'short_titulo',
              'cierre', 'web', 'enlaces', 'canal', 'hashtags', 'intro_duracion', 'cierre_duracion'}
KEYS_SECCION = {'titulo', 'subtitulo', 'duracion', 'texto', 'clip', 'desde', 'capitulo', 'short'}


# ---------------------------------------------------------------------------
# Salida al estilo de los demás scripts (say / warn / die · ✔ ⚠ ✖)
# ---------------------------------------------------------------------------
AVISOS = []


def say(s):
    print('\n==> ' + s, flush=True)


def info(s):
    print('  · ' + s, flush=True)


def ok(s):
    print('  ✔ ' + s, flush=True)


def warn(s):
    AVISOS.append(s)
    print('  ⚠ ' + s, flush=True)


def die(s, code=2):
    print('\n✖ ' + s, file=sys.stderr, flush=True)
    sys.exit(code)


def run(cmd, cwd=None, what='ffmpeg'):
    r = subprocess.run([str(c) for c in cmd], cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                       universal_newlines=True, errors='replace')
    if r.returncode != 0:
        tail = '\n'.join((r.stderr or r.stdout or '').strip().splitlines()[-25:])
        die('%s falló (código %d):\n%s' % (what, r.returncode, tail))
    return r


def fmt_ts(t, ms=True):
    t = max(0.0, t)
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    if ms:
        return '%02d:%02d:%06.3f' % (h, m, s)
    return '%d:%02d:%02d' % (h, m, int(s)) if h >= 1 else '%02d:%02d' % (m, int(s))


def srt_ts(t):
    t = max(0.0, t)
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return '%02d:%02d:%02d,%03d' % (h, m, s, ms)


def norm_key(s):
    s = unicodedata.normalize('NFKD', s.strip().lower())
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'[\s-]+', '_', s)


def slug(s):
    s = norm_key(s)
    return re.sub(r'[^a-z0-9_]+', '', s).strip('_') or 'video'


def parse_seconds(v, where):
    v = str(v).strip().lower().rstrip('s').strip()
    m = re.match(r'^(\d+):(\d{1,2}(?:[.,]\d+)?)$', v)
    if m:
        return int(m.group(1)) * 60 + float(m.group(2).replace(',', '.'))
    try:
        return float(v.replace(',', '.'))
    except ValueError:
        die('%s: «%s» no es una duración (usa 12, 12,5 o 0:12)' % (where, v))


def clean_text(s):
    """drawtext no tiene emojis: los quita (y avisa una vez)."""
    out = ''.join(c for c in s if unicodedata.category(c) != 'So' and c not in '\ufe0f\u200d')
    out = re.sub(r'\s+', ' ', out).strip()
    if out != re.sub(r'\s+', ' ', s).strip() and 'emoji' not in ' '.join(AVISOS):
        warn('quito emojis de los rótulos (la fuente de marca no los tiene)')
    return out


# ---------------------------------------------------------------------------
# Herramientas: ffmpeg con drawtext, fuentes, whisper.cpp
# ---------------------------------------------------------------------------
NEEDED_FILTERS = ('xfade', 'acrossfade', 'loudnorm', 'ebur128', 'sidechaincompress', 'amix', 'overlay',
                  'gblur', 'tpad', 'fade', 'afade', 'apad', 'adelay', 'geq', 'scale', 'pad', 'blackdetect')


def ffmpeg_caps(path):
    try:
        f = subprocess.run([path, '-hide_banner', '-filters'], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                           universal_newlines=True, timeout=20).stdout
        e = subprocess.run([path, '-hide_banner', '-encoders'], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                           universal_newlines=True, timeout=20).stdout
    except (OSError, subprocess.SubprocessError):
        return None
    names = set(re.findall(r'^\s*[T.][S.][C.]\s+(\S+)', f, re.M))
    encs = set(re.findall(r'^\s*[VAS][F.][S.][X.][B.][D.]\s+(\S+)', e, re.M))
    return {'filters': names, 'encoders': encs}


def pick_ffmpeg():
    cands = []
    if os.environ.get('JOM_FFMPEG'):
        cands.append(os.environ['JOM_FFMPEG'])
    w = shutil.which('ffmpeg')
    if w:
        cands.append(w)
    cands += ['/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg', '/usr/local/opt/ffmpeg-full/bin/ffmpeg',
              '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg']
    seen, usable = set(), []
    for c in cands:
        if not c or not os.path.isfile(c) or not os.access(c, os.X_OK):
            continue
        real = os.path.realpath(c)
        if real in seen:
            continue
        seen.add(real)
        caps = ffmpeg_caps(c)
        if not caps:
            continue
        missing = [x for x in NEEDED_FILTERS if x not in caps['filters']]
        missing += [x for x in ('libx264', 'aac', 'png') if x not in caps['encoders']]
        if missing:
            info('%s no sirve: le falta %s' % (c, ', '.join(missing)))
            continue
        usable.append((c, 'drawtext' in caps['filters']))
    if not usable:
        die('No hay un ffmpeg utilizable (con libx264, xfade, loudnorm…). Instálalo gratis: brew install ffmpeg-full')
    force_png = os.environ.get('JOM_SIN_DRAWTEXT') == '1'
    for c, dt in usable:
        if dt and not force_png:
            return c, True
    return usable[0][0], False


def pick_ffprobe(ffmpeg):
    side = os.path.join(os.path.dirname(ffmpeg), 'ffprobe')
    if os.path.isfile(side) and os.access(side, os.X_OK):
        return side
    w = shutil.which('ffprobe')
    if not w:
        die('Falta ffprobe (viene con ffmpeg: brew install ffmpeg-full)')
    return w


FONT_PREFS = {
    'titulo': [r'^sora-?(extrabold|bold)\.(ttf|otf)$', r'^sora-?semibold\.(ttf|otf)$',
               r'^sora.*(wght|variable).*\.(ttf|otf)$', r'^sora.*\.(ttf|otf)$'],
    'mono': [r'^jetbrainsmono-?(medium|regular)\.(ttf|otf)$', r'^jetbrainsmono-?(semibold|bold)\.(ttf|otf)$',
             r'^jetbrainsmono.*(wght|variable).*\.(ttf|otf)$', r'^jetbrainsmono.*\.(ttf|otf)$'],
}
FONT_FALLBACK = {
    'titulo': ['/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/Library/Fonts/Arial Bold.ttf',
               '/System/Library/Fonts/Supplemental/Verdana Bold.ttf',
               '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
               '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf', '/System/Library/Fonts/Helvetica.ttc'],
    'mono': ['/System/Library/Fonts/Menlo.ttc', '/System/Library/Fonts/Monaco.ttf',
             '/System/Library/Fonts/Supplemental/Courier New Bold.ttf',
             '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',
             '/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf'],
}
FC_FALLBACK = {'titulo': 'sans:bold', 'mono': 'monospace'}


def find_fonts(user_dir, repo):
    dirs = []
    for d in (user_dir, os.environ.get('JOM_FUENTES')):
        if d:
            if not os.path.isdir(d):
                warn('la carpeta de fuentes %s no existe' % d)
            else:
                dirs.append(d)
    home = os.path.expanduser('~')
    dirs += [os.path.join(repo, p) for p in ('assets/fonts', 'assets/fuentes', 'fonts', 'demos/light-concepts/assets/fonts')]
    dirs += [os.path.join(home, 'Library/Fonts'), '/Library/Fonts', os.path.join(home, '.fonts'),
             os.path.join(home, '.local/share/fonts'), '/usr/local/share/fonts', '/opt/homebrew/share/fonts',
             '/usr/share/fonts']
    files = []
    for d in dirs:
        if not os.path.isdir(d):
            continue
        base_depth = d.rstrip('/').count('/')
        for root, sub, names in os.walk(d):
            if root.count('/') - base_depth >= 4:
                sub[:] = []
            for n in names:
                if n.lower().endswith(('.ttf', '.otf', '.ttc')):
                    files.append(os.path.join(root, n))
            if len(files) > 20000:
                break
    chosen = {}
    for role, prefs in FONT_PREFS.items():
        pick = None
        for pat in prefs:   # el orden de las carpetas manda dentro de cada preferencia
            for f in files:
                n = os.path.basename(f).lower().replace(' ', '').replace('_', '-')
                if re.match(pat, n):
                    pick = f
                    break
            if pick:
                break
        if pick:
            chosen[role] = (pick, True)
            continue
        for f in FONT_FALLBACK[role]:
            if os.path.isfile(f):
                pick = f
                break
        if not pick and shutil.which('fc-match'):
            r = subprocess.run(['fc-match', '-f', '%{file}', FC_FALLBACK[role]], stdout=subprocess.PIPE,
                               stderr=subprocess.DEVNULL, universal_newlines=True)
            if r.returncode == 0 and os.path.isfile(r.stdout.strip()):
                pick = r.stdout.strip()
        if not pick:
            die('No encuentro ninguna fuente para los rótulos (%s). Pasa --fuentes DIR con Sora / JetBrains Mono.' % role)
        chosen[role] = (pick, False)
        warn('no encuentro %s: uso %s (instala gratis Sora y JetBrains Mono de Google Fonts, OFL, '
             'o pasa --fuentes DIR)' % ('Sora' if role == 'titulo' else 'JetBrains Mono', os.path.basename(pick)))
    for role, (f, brand) in chosen.items():
        if brand and re.search(r'wght|variable', os.path.basename(f), re.I):
            warn('%s es variable: drawtext usa su peso por defecto; para negrita usa el archivo estático (p. ej. Sora-Bold.ttf)'
                 % os.path.basename(f))
    return chosen


def find_whisper(model_arg):
    exe = None
    for n in ('whisper-cli', 'whisper-cpp'):
        exe = shutil.which(n)
        if exe:
            break
    if not exe:
        return None, None
    model = model_arg or os.environ.get('JOM_WHISPER_MODEL')
    if model and not os.path.isfile(model):
        warn('el modelo de whisper %s no existe' % model)
        model = None
    if not model:
        home = os.path.expanduser('~')
        cands = []
        for d in (os.path.join(home, '.cache/whisper.cpp'), os.path.join(home, '.cache/whisper'),
                  os.path.join(home, 'whisper.cpp/models'), os.path.join(home, 'Library/Application Support/whisper.cpp'),
                  '/opt/homebrew/share/whisper-cpp', '/usr/local/share/whisper-cpp',
                  '/opt/homebrew/opt/whisper-cpp/share/whisper-cpp'):
            if os.path.isdir(d):
                cands += [os.path.join(d, f) for f in os.listdir(d) if re.match(r'^ggml-.*\.bin$', f) and '.en' not in f]
        rank = ['large-v3-turbo', 'medium', 'small', 'base', 'large', 'tiny']
        cands.sort(key=lambda p: next((i for i, k in enumerate(rank) if k in os.path.basename(p)), 99))
        model = cands[0] if cands else None
    return exe, model


# ---------------------------------------------------------------------------
# Guion
# ---------------------------------------------------------------------------
def parse_guion(path):
    g = {'video': {}, 'secciones': []}
    cur, last = g['video'], None
    try:
        text = Path(path).read_text(encoding='utf-8-sig')
    except (OSError, UnicodeDecodeError) as e:
        die('No puedo leer el guion %s: %s' % (path, e))
    for n, raw in enumerate(text.splitlines(), 1):
        line = raw.rstrip()
        if not line.strip() or raw.startswith('#'):
            continue
        if raw[:1] in (' ', '\t') and last:
            cur[last] = (cur[last] + '\n' + line.strip()).strip()
            continue
        m = re.match(r'^\[(.+?)\]\s*$', line.strip())
        if m:
            cur = {'clave': m.group(1).strip(), 'linea': n}
            g['secciones'].append(cur)
            last = None
            continue
        m = re.match(r'^([^:\[\]]+?)\s*:\s*(.*)$', line)
        if not m:
            die('guion línea %d: no entiendo «%s» (usa «clave: valor» o «[seccion]»)' % (n, line))
        key = norm_key(m.group(1))
        allowed = KEYS_SECCION if cur is not g['video'] else KEYS_VIDEO
        if key not in allowed:
            warn('guion línea %d: clave «%s» desconocida (se ignora)' % (n, m.group(1)))
        cur[key] = m.group(2).strip()
        last = key
    return g


def key_of(stem):
    s = stem.lower()
    if s in ('home', 'index', 'concept_master_horizontal') or s.startswith('concept_master'):
        return 'home'
    m = re.match(r'^(?:page_)?(0[1-7])(?:[_\-. ]|$)', s)
    return m.group(1) if m else stem


def default_titles(key, stem):
    if key in DEPARTAMENTOS:
        return DEPARTAMENTOS[key]
    t = re.sub(r'[_\-]+', ' ', stem).strip()
    return (t[:1].upper() + t[1:], '')


def order_key(key):
    if key == 'home':
        return (0, '')
    if re.match(r'^0[1-7]$', key):
        return (1, key)
    return (2, key)


# ---------------------------------------------------------------------------
# Medidas
# ---------------------------------------------------------------------------
class Probe:
    def __init__(self, ffprobe, ffmpeg):
        self.ffprobe, self.ffmpeg = ffprobe, ffmpeg

    def info(self, path):
        r = subprocess.run([self.ffprobe, '-v', 'error', '-show_entries',
                            'format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,duration,'
                            'sample_rate,channels,pix_fmt,profile,color_space', '-of', 'json', str(path)],
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)
        if r.returncode != 0:
            die('ffprobe no puede leer %s: %s' % (path, r.stderr.strip()[-300:]))
        return json.loads(r.stdout or '{}')

    def duration(self, path):
        j = self.info(path)
        for v in [j.get('format', {}).get('duration')] + [s.get('duration') for s in j.get('streams', [])]:
            try:
                if v not in (None, 'N/A') and float(v) > 0:
                    return float(v)
            except ValueError:
                pass
        # Sin duración en la cabecera: se decodifica (lento pero exacto).
        r = subprocess.run([self.ffmpeg, '-hide_banner', '-nostdin', '-i', str(path), '-map', '0:v:0', '-f', 'null', '-'],
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, errors='replace')
        ts = re.findall(r'time=(\d+):(\d+):(\d+(?:\.\d+)?)', r.stderr)
        if not ts:
            die('No puedo medir la duración de %s' % path)
        h, m, s = ts[-1]
        return int(h) * 3600 + int(m) * 60 + float(s)

    def has_audio(self, path):
        return any(s.get('codec_type') == 'audio' for s in self.info(path).get('streams', []))

    def video_frames(self, path):
        j = self.info(path)
        v = next((s for s in j.get('streams', []) if s.get('codec_type') == 'video'), None)
        if not v:
            die('%s no tiene video' % path)
        try:
            n = int(v.get('nb_frames') or 0)
        except ValueError:
            n = 0
        if n <= 0:
            n = int(round(float(v.get('duration') or j['format']['duration']) * FPS))
        return n, v


# ---------------------------------------------------------------------------
# Rótulos: el diseño se describe con primitivas en px y lo pinta drawtext
# (ffmpeg) o, si el ffmpeg no trae drawtext, Chromium (grabar-protocolos.mjs --rotulos).
# ---------------------------------------------------------------------------
CHAR_W = {'titulo': 0.62, 'mono': 0.61}


def wrap(text, maxw, size, role, max_lines=None):
    per = max(4, int(maxw / (size * CHAR_W[role])))
    out = []
    for part in text.split('|'):
        words, line = part.split(), ''
        for w_ in words:
            cand = (line + ' ' + w_).strip()
            if len(cand) <= per or not line:
                line = cand
            else:
                out.append(line)
                line = w_
        if line:
            out.append(line)
    return out if not max_lines else out[:max_lines]


def fit(text, maxw, size, role, max_lines, min_size):
    """Encoge hasta que cabe en max_lines; con «|» intenta una línea por trozo."""
    parts = [x for x in text.split('|') if x.strip()]
    while True:
        lines = wrap(text, maxw, size, role)
        good = len(lines) <= max_lines and (len(parts) < 2 or len(lines) <= len(parts))
        if good or size <= min_size:
            return lines[:max_lines], size
        size = int(size * 0.92)


def text_w(s, size, role):
    return len(s) * size * CHAR_W[role]


def t_lines(lines, role, size, color, y, x=None, sombra=0, lh=1.18, colors=None):
    prims = []
    for i, ln in enumerate(lines):
        prims.append({'tipo': 'texto', 'texto': ln, 'fuente': role, 'tam': int(size),
                      'color': (colors[i % len(colors)] if colors else color),
                      'x': int(x) if x is not None else 0, 'y': int(y + i * size * lh),
                      'alinear': 'izq' if x is not None else 'centro', 'sombra': sombra})
    return prims


def logo_prim(logo, x, y, w, h):
    return [{'tipo': 'imagen', 'archivo': logo, 'x': int(x), 'y': int(y), 'w': int(w), 'h': int(h)}] if logo else []


def card_intro(title, subtitle, logo, w=W, h=H):
    prims = [{'tipo': 'rect', 'x': 0, 'y': 0, 'w': w, 'h': h, 'color': DARK, 'alfa': 0.55}]
    prims += logo_prim(logo, (w - 360) / 2, h * 0.20, 360, 200)
    tl, ts = fit(clean_text(title), w * 0.84, 96, 'titulo', 2, 60)
    y = h * 0.47
    prims += t_lines(tl, 'titulo', ts, WHITE, y, sombra=3)
    y += len(tl) * ts * 1.18 + 26
    prims.append({'tipo': 'rect', 'x': int((w - 200) / 2), 'y': int(y), 'w': 200, 'h': 6, 'color': GOLD, 'alfa': 1})
    if subtitle:
        sl, ss = fit(clean_text(subtitle), w * 0.8, 36, 'mono', 2, 26)
        prims += t_lines(sl, 'mono', ss, GOLD, y + 36)
    return prims


def card_tercio(title, subtitle):
    t, s = clean_text(title), clean_text(subtitle or '')
    ts, ss = 54, 30
    while text_w(t, ts, 'titulo') > W - 360 and ts > 34:
        ts -= 2
    while text_w(s, ss, 'mono') > W - 360 and ss > 20:
        ss -= 1
    pw = int(max(text_w(t, ts, 'titulo'), text_w(s, ss, 'mono') if s else 0) + 88)
    ph = int(24 + ts * 1.18 + (14 + ss * 1.18 if s else 0) + 24)
    x0, y0 = 96, H - 96 - ph
    prims = [{'tipo': 'rect', 'x': x0, 'y': y0, 'w': pw, 'h': ph, 'color': DARK, 'alfa': 0.86},
             {'tipo': 'rect', 'x': x0, 'y': y0, 'w': 10, 'h': ph, 'color': GOLD, 'alfa': 1}]
    prims += t_lines([t], 'titulo', ts, WHITE, y0 + 22, x=x0 + 44)
    if s:
        prims += t_lines([s], 'mono', ss, TEAL, y0 + 22 + ts * 1.18 + 12, x=x0 + 44)
    return prims


def card_cierre(cierre, web, logo):
    prims = [{'tipo': 'rect', 'x': 0, 'y': 0, 'w': W, 'h': H, 'color': DARK, 'alfa': 0.62}]
    prims += logo_prim(logo, (W - 320) / 2, 190, 320, 180)
    prims += t_lines(['Gracias por ver'], 'titulo', 88, WHITE, 470, sombra=3)
    cl, cs = fit(clean_text(cierre), W * 0.8, 36, 'mono', 2, 26)
    prims += t_lines(cl, 'mono', cs, GOLD, 610)
    if web:
        prims += t_lines([clean_text(web)], 'mono', 30, CREAM, 610 + len(cl) * cs * 1.18 + 30)
    return prims


def card_miniatura(text, logo):
    prims = [{'tipo': 'degradado', 'x': 0, 'y': 0, 'w': TW, 'h': TH, 'color': DARK, 'alfa0': 0.94, 'alfa1': 0.10,
              'direccion': 'horizontal'}]
    lines, size = fit(clean_text(text), TW * 0.60, 112, 'titulo', 3, 64)
    block = len(lines) * size * 1.08
    y0 = (TH - block) / 2 + 10
    prims.append({'tipo': 'rect', 'x': 56, 'y': int(y0), 'w': 12, 'h': int(block - size * 0.08), 'color': GOLD, 'alfa': 1})
    prims += t_lines(lines, 'titulo', size, WHITE, y0, x=92, sombra=4, lh=1.08, colors=[WHITE, GOLD])
    prims += logo_prim(logo, 56, 40, 170, 96)
    prims += t_lines(['JOM STUDIO'], 'mono', 26, TEAL, TH - 70, x=92)
    return prims


def card_short_intro(title, logo):
    prims = [{'tipo': 'rect', 'x': 0, 'y': 0, 'w': SW, 'h': SH, 'color': DARK, 'alfa': 0.6}]
    prims += logo_prim(logo, (SW - 400) / 2, 420, 400, 225)
    tl, ts = fit(clean_text(title), SW * 0.84, 92, 'titulo', 4, 56)
    prims += t_lines(tl, 'titulo', ts, WHITE, 760, sombra=3)
    return prims


def card_short_seccion(title, subtitle, vertical_src):
    # Zona segura de Shorts: ni los 250 px de arriba ni los ~480 de abajo.
    tl, ts = fit(clean_text(title), SW * 0.86, 78, 'titulo', 2, 50)
    sl, ss = fit(clean_text(subtitle or ''), SW * 0.86, 36, 'mono', 2, 26) if subtitle else ([], 0)
    block = len(tl) * ts * 1.18 + (12 + len(sl) * ss * 1.18 if sl else 0)
    y0 = 1230 if vertical_src else 640 - block - 40
    prims = [{'tipo': 'rect', 'x': 0, 'y': int(y0 - 34), 'w': SW, 'h': int(block + 68), 'color': DARK, 'alfa': 0.78},
             {'tipo': 'rect', 'x': int((SW - 160) / 2), 'y': int(y0 - 34), 'w': 160, 'h': 6, 'color': GOLD, 'alfa': 1}]
    prims += t_lines(tl, 'titulo', ts, WHITE, y0)
    if sl:
        prims += t_lines(sl, 'mono', ss, GOLD, y0 + len(tl) * ts * 1.18 + 12)
    if not vertical_src:
        prims += t_lines(['JOM STUDIO'], 'mono', 34, TEAL, 1330)
    return prims


class Cards:
    def __init__(self, ctx):
        self.ctx = ctx
        self.pending = []

    def add(self, name, w, h, prims):
        out = os.path.join(self.ctx.work, 'card_%s.png' % name)
        self.pending.append({'nombre': name, 'w': w, 'h': h, 'prims': prims, 'salida': out, 'fondo': None})
        return out

    def render(self):
        if not self.pending:
            return
        if self.ctx.drawtext:
            for c in self.pending:
                self._drawtext(c)
            ok('%d rótulo(s) con drawtext' % len(self.pending))
        else:
            self._chromium()
        self.pending = []

    def _drawtext(self, card):
        ctx = self.ctx
        inputs = ['-f', 'lavfi', '-i', 'color=c=0x000000@0:s=%dx%d:r=1,format=rgba' % (card['w'], card['h'])]
        chains, cur, idx, lab = [], '[0:v]', 1, 0
        for p in card['prims']:
            out = '[k%d]' % lab
            lab += 1
            if p['tipo'] == 'rect':
                inputs += ['-f', 'lavfi', '-i', 'color=c=0x%s@%.3f:s=%dx%d:r=1,format=rgba'
                           % (p['color'], p.get('alfa', 1), max(1, p['w']), max(1, p['h']))]
                chains.append('%s[%d:v]overlay=x=%d:y=%d:format=auto%s' % (cur, idx, p['x'], p['y'], out))
                idx += 1
            elif p['tipo'] == 'degradado':
                c = int(p['color'], 16)
                var = 'Y/H' if p.get('direccion') == 'vertical' else 'X/W'
                inputs += ['-f', 'lavfi', '-i',
                           "color=c=black:s=%dx%d:r=1,format=rgba,geq=r=%d:g=%d:b=%d:a='255*(%.3f+(%.3f)*%s)'"
                           % (p['w'], p['h'], (c >> 16) & 255, (c >> 8) & 255, c & 255,
                              p['alfa0'], p['alfa1'] - p['alfa0'], var)]
                chains.append('%s[%d:v]overlay=x=%d:y=%d:format=auto%s' % (cur, idx, p['x'], p['y'], out))
                idx += 1
            elif p['tipo'] == 'imagen':
                inputs += ['-i', p['archivo']]
                chains.append('[%d:v]format=rgba,scale=%d:%d:force_original_aspect_ratio=decrease:flags=lanczos[i%d]'
                              % (idx, p['w'], p['h'], lab))
                chains.append('%s[i%d]overlay=x=%d+(%d-overlay_w)/2:y=%d+(%d-overlay_h)/2:format=auto%s'
                              % (cur, lab, p['x'], p['w'], p['y'], p['h'], out))
                idx += 1
            elif p['tipo'] == 'texto':
                tf = 't_%s_%d.txt' % (card['nombre'], lab)
                Path(ctx.work, tf).write_text(p['texto'], encoding='utf-8')
                x = '(w-text_w)/2' if p['alinear'] == 'centro' else str(p['x'])
                dt = ('drawtext=fontfile=%s:textfile=%s:expansion=none:fontsize=%d:fontcolor=0x%s@%.2f:x=%s:y=%d'
                      % (ctx.font_file[p['fuente']], tf, p['tam'], p['color'], p.get('alfa', 1), x, p['y']))
                if p.get('sombra'):
                    dt += ':shadowx=%d:shadowy=%d:shadowcolor=0x000000@0.55' % (p['sombra'], p['sombra'])
                chains.append('%s%s%s' % (cur, dt, out))
            else:
                continue
            cur = out
        chains.append('%sformat=rgba[out]' % cur)
        # cwd = carpeta de trabajo: fuentes y textos con nombres simples (sin escapar rutas con espacios).
        run([ctx.ffmpeg, '-hide_banner', '-nostdin', '-v', 'error', '-y'] + inputs +
            ['-filter_complex', ';'.join(chains), '-map', '[out]', '-frames:v', '1', card['salida']],
            cwd=ctx.work, what='ffmpeg (rótulo %s)' % card['nombre'])

    def _chromium(self):
        ctx = self.ctx
        spec = {'fuentes': {k: os.path.join(ctx.work, v) for k, v in ctx.font_file.items()},
                'tarjetas': [{'salida': c['salida'], 'w': c['w'], 'h': c['h'], 'fondo': None,
                              'prims': c['prims']} for c in self.pending]}
        sp = os.path.join(ctx.work, 'rotulos.json')
        Path(sp).write_text(json.dumps(spec, ensure_ascii=False), encoding='utf-8')
        node = shutil.which('node')
        mjs = os.path.join(ctx.repo, 'scripts', 'grabar-protocolos.mjs')
        if not node or not os.path.isfile(mjs):
            die('Tu ffmpeg no trae drawtext y no hay node + scripts/grabar-protocolos.mjs para pintar los rótulos.\n'
                '  Solución gratis: brew install ffmpeg-full  (o brew install node y scripts/grabar-protocolos.sh --solo-preparar)')
        r = subprocess.run([node, mjs, '--rotulos', sp], stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                           universal_newlines=True)
        if r.returncode != 0:
            die('No pude pintar los rótulos con Chromium:\n%s\n  Solución: brew install ffmpeg-full (trae drawtext) '
                'o scripts/grabar-protocolos.sh --solo-preparar' % r.stdout.strip()[-800:])
        ok('%d rótulo(s) con Chromium (este ffmpeg no trae drawtext)' % len(self.pending))


# ---------------------------------------------------------------------------
# Montaje
# ---------------------------------------------------------------------------
class Ctx:
    pass


def x264(ctx, crf):
    return ['-c:v', 'libx264', '-preset', ctx.preset, '-crf', str(crf), '-pix_fmt', 'yuv420p', '-r', str(FPS),
            '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv']


def base_chain(w, h, D, blur=False, fill_from_h=False):
    """Clip → w×h a 30 fps en RGB planar; con tpad por si el clip se queda corto."""
    if fill_from_h:   # horizontal dentro de un vertical: fondo desenfocado + video centrado
        return ('fps=%d,scale=%d:%d:force_original_aspect_ratio=decrease:flags=lanczos,format=gbrp,split[f0][f1];'
                '[f0]scale=-2:%d:flags=bicubic,crop=%d:%d,gblur=sigma=28[bg];[f1]scale=%d:-2:flags=lanczos[fg];'
                '[bg][fg]overlay=0:(H-h)/2:format=rgb,setsar=1,tpad=stop_mode=clone:stop_duration=%.3f'
                % (FPS, W, H, h, w, h, w, D))
    c = ('fps=%d,scale=%d:%d:force_original_aspect_ratio=decrease:flags=lanczos,format=gbrp,'
         'pad=%d:%d:(ow-iw)/2:(oh-ih)/2:color=0x%s,setsar=1,tpad=stop_mode=clone:stop_duration=%.3f'
         % (FPS, w, h, w, h, DARK, D))
    if blur:
        c += ',gblur=sigma=22'
    return c


def to_yuv():
    return 'scale=out_color_matrix=bt709:out_range=tv:flags=lanczos,format=yuv420p'


def render_segment(ctx, seg, out, w, h, kind):
    """kind: 'seccion' (rótulo inferior animado), 'tarjeta' (intro/cierre/short) ."""
    N = seg['frames']
    D = N / FPS
    cmd = [ctx.ffmpeg, '-hide_banner', '-nostdin', '-v', 'error', '-y',
           '-ss', '%.3f' % seg['desde'], '-t', '%.3f' % (D + 1.0), '-i', seg['clip'],
           '-loop', '1', '-framerate', str(FPS), '-t', '%.3f' % D, '-i', seg['card']]
    use_clip_audio = seg.get('audio') and kind == 'seccion'
    if not use_clip_audio:
        cmd += ['-f', 'lavfi', '-t', '%.3f' % D, '-i', 'anullsrc=r=48000:cl=stereo']
    base = base_chain(w, h, D, blur=seg.get('blur', False), fill_from_h=seg.get('fill', False))
    fi = seg.get('card_in', 0.6)
    fo = seg.get('card_out')
    fades = 'fade=t=in:st=%.2f:d=0.45:alpha=1' % fi
    if fo is not None:
        fades += ',fade=t=out:st=%.2f:d=0.5:alpha=1' % fo
    slide = seg.get('slide', 0)
    xexpr = ("'if(lt(t,%.2f),-%d,if(lt(t,%.2f),-%d+%d*(t-%.2f)/0.45,0))'" % (fi, slide, fi + 0.45, slide, slide, fi)
             if slide else '0')
    post = ''
    if seg.get('fade_in'):
        post += ',fade=t=in:st=0:d=%.2f' % seg['fade_in']
    if seg.get('fade_out'):
        post += ',fade=t=out:st=%.3f:d=%.2f' % (D - seg['fade_out'], seg['fade_out'])
    fc = ('[0:v]%s[b];[1:v]format=rgba,%s[l];[b][l]overlay=x=%s:y=0:format=rgb:eval=frame%s,%s[v]'
          % (base, fades, xexpr, post, to_yuv()))
    if use_clip_audio:
        fc += ';[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad[a]'
        amap = '[a]'
    else:
        amap = '2:a'
    cmd += ['-filter_complex', fc, '-map', '[v]', '-map', amap, '-frames:v', str(N), '-t', '%.3f' % D]
    cmd += x264(ctx, 16) + ['-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2', out]
    run(cmd, what='ffmpeg (segmento %s)' % seg['nombre'])
    n, _ = ctx.probe.video_frames(out)
    return n


def cut_frac(transition):
    """Dónde «corta» la transición, como fracción de T desde su inicio.
    fadeblack/fadewhite de ffmpeg no son simétricos: el fotograma más oscuro
    (o claro) cae en 0,196·T (mínimo de la fórmula de vf_xfade). El resto, a la mitad."""
    return 0.2 if transition in ('fadeblack', 'fadewhite') else 0.5


def build_timeline(segs, T, c=0.5):
    """Offsets de xfade y comienzo real de cada segmento (el corte de su transición)."""
    L = segs[0]['real']
    segs[0]['offset'] = 0.0
    segs[0]['inicio'] = 0.0
    for s in segs[1:]:
        s['offset'] = L - T
        s['inicio'] = L - T + c * T
        L = L + s['real'] - T
    return L


def align_cuts(segs, T, c):
    """Ajusta cada segmento ±0,5 s (en fotogramas) para que el corte siguiente caiga en un
    segundo entero: los capítulos de YouTube van en segundos enteros y así son exactos."""
    L = segs[0]['frames'] / FPS
    for k in range(1, len(segs)):
        prev = segs[k - 1]
        cut = L - T + c * T
        df = int(round((math.floor(cut + 0.5) - cut) * FPS))
        if prev['tipo'] == 'seccion' and df > 0:
            room = int((prev['disponible'] - prev['desde']) * FPS) - prev['frames']
            if df > room:
                df -= FPS   # mejor recortar que congelar el último fotograma
        if prev['frames'] + df < int((T + 1) * FPS):
            df += FPS
        prev['frames'] += df
        prev['ajuste_s'] = round(df / FPS, 3)
        L += df / FPS + segs[k]['frames'] / FPS - T
    for s in segs:
        s['real'] = s['frames'] / FPS


def concat_graph(segs, T, transition):
    v, a = '[0:v]', '[0:a]'
    parts = []
    for i, s in enumerate(segs[1:], 1):
        parts.append('%s[%d:v]xfade=transition=%s:duration=%.3f:offset=%.4f[v%d]' % (v, i, transition, T, s['offset'], i))
        parts.append('%s[%d:a]acrossfade=d=%.3f:c1=tri:c2=tri[a%d]' % (a, i, T, i))
        v, a = '[v%d]' % i, '[a%d]' % i
    return parts, v, a


def audio_mix(parts, a_in, total, music_idx, voice_idx, voz_desde, has_voice):
    """Música (en bucle, con ducking bajo la voz) + voz + audio de los clips."""
    chain = []
    labels = [a_in]
    if music_idx is not None:
        mv = 0.30 if has_voice else 0.85
        chain.append('[%d:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,atrim=0:%.3f,asetpts=N/SR/TB,'
                     'volume=%.2f,afade=t=in:st=0:d=1.5,afade=t=out:st=%.3f:d=3[mus]'
                     % (music_idx, total, mv, max(0, total - 3)))
    if voice_idx is not None:
        ms = int(round(voz_desde * 1000))
        chain.append('[%d:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,adelay=%d|%d,apad,'
                     'atrim=0:%.3f,asetpts=N/SR/TB[voz]' % (voice_idx, ms, ms, total))
    if music_idx is not None and voice_idx is not None:
        chain.append('[voz]asplit=2[vz1][vz2]')
        chain.append('[mus][vz1]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=400:makeup=1[duck]')
        labels += ['[duck]', '[vz2]']
    elif music_idx is not None:
        labels.append('[mus]')
    elif voice_idx is not None:
        labels.append('[voz]')
    if len(labels) > 1:
        chain.append('%samix=inputs=%d:duration=first:normalize=0:dropout_transition=0,atrim=0:%.3f[aout]'
                     % (''.join(labels), len(labels), total))
    else:
        chain.append('%satrim=0:%.3f[aout]' % (a_in, total))
    return parts + chain


def loudnorm_two_pass(ctx, src, dst, extra_meta):
    """Pasada 1 mide; pasada 2 normaliza a −14 LUFS (lineal si se puede) y copia el video."""
    r = subprocess.run([ctx.ffmpeg, '-hide_banner', '-nostdin', '-i', src, '-map', '0:a',
                        '-af', 'loudnorm=I=%.1f:TP=%.1f:LRA=%.1f:print_format=json' % (LUFS, TP_TARGET, LRA_TARGET),
                        '-f', 'null', '-'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True,
                       errors='replace')
    m = re.findall(r'\{[^{}]*"input_i"[^{}]*\}', r.stderr, re.S)
    if r.returncode != 0 or not m:
        die('loudnorm (pasada 1) falló:\n' + '\n'.join(r.stderr.strip().splitlines()[-15:]))
    j1 = json.loads(m[-1])
    silent = j1['input_i'] in ('-inf', 'inf') or float(j1['input_i']) < -70
    cmd = [ctx.ffmpeg, '-hide_banner', '-nostdin', '-n', '-i', src, '-map', '0:v', '-map', '0:a', '-c:v', 'copy']
    if silent:
        warn('el audio es silencio (los clips grabados no traen sonido): sin loudnorm. Añade --musica y/o --voz')
        cmd += ['-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2']
    else:
        af = ('loudnorm=I=%.1f:TP=%.1f:LRA=%.1f:measured_I=%s:measured_TP=%s:measured_LRA=%s:measured_thresh=%s:'
              'offset=%s:linear=true:print_format=json,aresample=48000'
              % (LUFS, TP_TARGET, LRA_TARGET, j1['input_i'], j1['input_tp'], j1['input_lra'], j1['input_thresh'],
                 j1['target_offset']))
        cmd += ['-af', af, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2']
    cmd += ['-movflags', '+faststart'] + extra_meta + [dst]
    r2 = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, errors='replace')
    if r2.returncode != 0:
        die('loudnorm (pasada 2) falló:\n' + '\n'.join(r2.stderr.strip().splitlines()[-15:]))
    m2 = re.findall(r'\{[^{}]*"input_i"[^{}]*\}', r2.stderr, re.S)
    j2 = json.loads(m2[-1]) if m2 else {}
    return {'pasada1': j1, 'pasada2': j2, 'silencio': silent, 'tipo': j2.get('normalization_type', 'ninguno')}


CUT_TOL = 0.5   # s: un capítulo publicado debe caer a ≤ 0,5 s del corte real


def luma_frames(ctx, path, w=64, h=36):
    """Decodifica el video entero a 64×36 en gris (≈2 KB por fotograma) para medir los cortes."""
    r = subprocess.run([ctx.ffmpeg, '-hide_banner', '-nostdin', '-v', 'error', '-i', path, '-map', '0:v:0',
                        '-vf', 'fps=%d,scale=%d:%d:flags=area,format=gray' % (FPS, w, h), '-f', 'rawvideo', '-'],
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if r.returncode != 0:
        return None
    n = w * h
    return [r.stdout[i:i + n] for i in range(0, len(r.stdout) - n + 1, n)]


def measure_cuts(ctx, video, segs, T, transition):
    """Dónde cae DE VERDAD cada corte en el video final.
    fadeblack/fadewhite: el fotograma más oscuro (claro) de la transición. Otras: el primer
    fotograma que se parece más al plano siguiente que al anterior."""
    frames = luma_frames(ctx, video)
    if not frames:
        return None
    mean = [sum(f) / len(f) for f in frames]

    def dist(a, b):
        return sum((x - y) * (x - y) for x, y in zip(a, b)) / len(a)

    out = []
    for k in range(1, len(segs)):
        s = segs[k]
        i0 = int(round(s['offset'] * FPS))
        i1 = min(len(frames) - 1, int(round((s['offset'] + T) * FPS)))
        if i0 < 1 or i1 <= i0:
            out.append({'k': k, 'medido_s': None, 'metodo': 'fuera de rango'})
            continue
        win = range(i0, i1 + 1)
        if transition in ('fadeblack', 'fadewhite'):
            vals = [mean[i] for i in win]
            pick = min(win, key=lambda i: mean[i]) if transition == 'fadeblack' else max(win, key=lambda i: mean[i])
            contraste = max(vals) - min(vals)
            metodo = 'luma %s (contraste %.1f)' % ('mínima' if transition == 'fadeblack' else 'máxima', contraste)
            if contraste < 3:
                out.append({'k': k, 'medido_s': None, 'metodo': metodo + ': sin contraste, indeterminado'})
                continue
        else:
            A, B = frames[i0 - 1], frames[min(len(frames) - 1, i1 + 1)]
            pick = next((i for i in win if dist(frames[i], B) < dist(frames[i], A)), None)
            metodo = 'cruce A→B'
            if pick is None or dist(A, B) < 4:
                out.append({'k': k, 'medido_s': None, 'metodo': metodo + ': planos casi iguales, indeterminado'})
                continue
        out.append({'k': k, 'medido_s': round(pick / FPS, 3), 'metodo': metodo})
    return out


def ebur128(ctx, path):
    r = subprocess.run([ctx.ffmpeg, '-hide_banner', '-nostdin', '-nostats', '-i', path, '-map', '0:a',
                        '-af', 'ebur128=peak=true', '-f', 'null', '-'], stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                       universal_newlines=True, errors='replace')
    tail = r.stderr.split('Summary:')[-1]
    gi = re.search(r'I:\s+(-?[\d.]+|-inf)\s+LUFS', tail)
    gp = re.search(r'Peak:\s+(-?[\d.]+|-inf)\s+dBFS', tail)
    gl = re.search(r'LRA:\s+(-?[\d.]+)\s+LU', tail)
    f = lambda m: (float(m.group(1)) if m and m.group(1) != '-inf' else None)
    return {'I_LUFS': f(gi), 'true_peak_dBTP': f(gp), 'LRA_LU': f(gl)}


# ---------------------------------------------------------------------------
# Capítulos, subtítulos y metadatos
# ---------------------------------------------------------------------------
def chapters(segs, total):
    raw = []
    secs = [s for s in segs if s['tipo'] == 'seccion']
    intro = segs[0] if segs[0]['tipo'] == 'intro' else None
    for s in secs:
        raw.append({'t': s['inicio'], 'titulo': s['capitulo']})
    if not raw:
        return [], ['no hay secciones']
    notes = []
    if intro:
        if raw[0]['t'] >= CHAPTER_MIN:
            raw.insert(0, {'t': 0.0, 'titulo': 'Intro'})
        else:
            raw[0] = {'t': 0.0, 'titulo': 'Intro · ' + raw[0]['titulo'], 'incluye_intro': True}
    raw[0]['t'] = 0.0
    cierre = segs[-1] if segs[-1]['tipo'] == 'cierre' else None
    if cierre and total - cierre['inicio'] >= CHAPTER_MIN:
        raw.append({'t': cierre['inicio'], 'titulo': 'Cierre'})
    for c in raw:
        c['seg'] = int(math.floor(c['t'] + 0.5))
    # YouTube: cada capítulo ≥ 10 s (con los segundos redondeados que se publican).
    i = 1
    while i < len(raw):
        prev_len = raw[i]['seg'] - raw[i - 1]['seg']
        if prev_len < CHAPTER_MIN:
            notes.append('«%s» dura %d s (<%d): lo uno con «%s»' % (raw[i - 1]['titulo'], prev_len, CHAPTER_MIN, raw[i]['titulo']))
            raw[i - 1]['titulo'] += ' + ' + raw[i]['titulo']
            del raw[i]
            continue
        i += 1
    if len(raw) > 1 and int(total) - raw[-1]['seg'] < CHAPTER_MIN:
        notes.append('«%s» dura %d s (<%d): lo uno con el anterior' % (raw[-1]['titulo'], int(total) - raw[-1]['seg'], CHAPTER_MIN))
        raw[-2]['titulo'] += ' + ' + raw[-1]['titulo']
        del raw[-1]
    if len(raw) < 3:
        notes.append('solo %d capítulo(s): YouTube necesita ≥3 de ≥10 s para mostrarlos' % len(raw))
    return raw, notes


def chunks(text, maxlen=84):
    out = []
    for sent in re.split(r'(?<=[.!?…])\s+', re.sub(r'\s+', ' ', text).strip()):
        words, cur = sent.split(), ''
        for w_ in words:
            if len(cur) + 1 + len(w_) > maxlen and cur:
                out.append(cur)
                cur = w_
            else:
                cur = (cur + ' ' + w_).strip()
        if cur:
            out.append(cur)
    return out


def two_lines(s, n=42):
    if len(s) <= n:
        return s
    mid = len(s) // 2
    sp = [i for i, c in enumerate(s) if c == ' ']
    cut_ = min(sp, key=lambda i: abs(i - mid)) if sp else mid
    return s[:cut_].strip() + '\n' + s[cut_:].strip()


def srt_from_guion(segs, total, title):
    cues = []
    for i, s in enumerate(segs):
        a = s['inicio'] + (0.3 if i else 0.4)
        b = (segs[i + 1]['inicio'] if i + 1 < len(segs) else total) - 0.4
        if b - a < 0.8:
            continue
        if s['tipo'] == 'intro':
            cues.append((a, b, title))
            continue
        if s['tipo'] == 'cierre':
            continue
        if s.get('texto'):
            parts = chunks(s['texto'])
            weights = [max(len(p), 12) for p in parts]
            span, t = b - a, a
            for p, wgt in zip(parts, weights):
                d = span * wgt / sum(weights)
                cues.append((t, t + d - 0.05, p))
                t += d
        else:
            txt = s['titulo'] + (' — ' + s['subtitulo'] if s.get('subtitulo') else '')
            cues.append((a + 0.3, min(a + 6.0, b), txt))
    return ''.join('%d\n%s --> %s\n%s\n\n' % (n, srt_ts(a), srt_ts(b), two_lines(clean_text(t)))
                   for n, (a, b, t) in enumerate(cues, 1))


def shift_srt(text, dt):
    def f(m):
        h, mi, s, ms = (int(x) for x in m.groups())
        return srt_ts(h * 3600 + mi * 60 + s + ms / 1000 + dt)
    return re.sub(r'(\d\d):(\d\d):(\d\d),(\d\d\d)', f, text)


def build_tags(guion_tags, keys):
    tags = [t.strip() for t in re.split(r'[,\n]', guion_tags or '') if t.strip()]
    for k in keys:
        tags += ETIQUETAS_DEP.get(k, [])
    tags += ['JOM Studio', 'desarrollo web', 'diseño web', 'portafolio web', 'web interactiva']
    out, seen = [], set()
    for t in tags:
        t = t.lstrip('#').strip()
        if t and t.lower() not in seen:
            cand = out + [t]
            # YouTube cuenta ≤ 500 caracteres; las etiquetas con espacios suman las comillas.
            if sum(len(x) + (2 if ' ' in x else 0) for x in cand) + len(cand) - 1 > 500:
                break
            out.append(t)
            seen.add(t.lower())
    return out


# ---------------------------------------------------------------------------
# Programa
# ---------------------------------------------------------------------------
def parse_args(argv):
    ap = argparse.ArgumentParser(prog='montar-youtube.sh', description='Monta el video de YouTube, el Short, la miniatura, '
                                 'los subtítulos y los metadatos a partir de clips (grabados con grabar-protocolos o cualquiera).')
    ap.add_argument('clips_sueltos', nargs='*', metavar='CLIP', help='clips concretos (en este orden); si no, se usa --clips')
    ap.add_argument('--repo', default=str(Path(__file__).resolve().parent.parent), help=argparse.SUPPRESS)
    ap.add_argument('--clips', help='carpeta de clips (por defecto ./youtube-out/clips; usa su manifiesto.json)')
    ap.add_argument('--guion', help='guion de texto (formato en .claude/skills/jom-youtube/references/guion-departamentos.md)')
    ap.add_argument('--musica', help='música del CEO (se repite o recorta; baja sola bajo la voz)')
    ap.add_argument('--voz', help='voz en off (wav/m4a/mp3/aiff)')
    ap.add_argument('--voz-desde', default='0', help='segundo del video donde empieza la voz (0)')
    ap.add_argument('--logo', help='logo PNG (por defecto assets/logo-white.png del repo)')
    ap.add_argument('--fuentes', help='carpeta con Sora / JetBrains Mono (.ttf/.otf)')
    ap.add_argument('--salida', help='carpeta de entrega (nueva; nunca se sobrescribe)')
    ap.add_argument('--transicion', default='fadeblack', help='tipo de xfade (fadeblack, fade, smoothleft, circleopen…)')
    ap.add_argument('--t-transicion', default='0.8', help='duración de cada transición en s (0.8)')
    ap.add_argument('--duracion', default='12', help='s por sección si el guion no la da (12)')
    ap.add_argument('--sin-short', action='store_true', help='no generar el Short')
    ap.add_argument('--sin-intro', action='store_true', help='sin tarjeta de título al principio')
    ap.add_argument('--sin-cierre', action='store_true', help='sin tarjeta final')
    ap.add_argument('--whisper-modelo', help='modelo ggml de whisper.cpp para subtitular la voz')
    ap.add_argument('--rapido', action='store_true', help='x264 veryfast (pruebas); por defecto medium')
    ap.add_argument('--plan', action='store_true', help='solo muestra el plan (secciones, duraciones, capítulos) sin renderizar')
    ap.add_argument('--conservar-temporales', action='store_true', help='no borra la carpeta de intermedios')
    return ap.parse_args(argv)


def main(argv):
    a = parse_args(argv)
    ctx = Ctx()
    ctx.repo = os.path.abspath(a.repo)
    ctx.preset = 'veryfast' if a.rapido else 'medium'
    T = parse_seconds(a.t_transicion, '--t-transicion')
    DUR = parse_seconds(a.duracion, '--duracion')
    voz_desde = parse_seconds(a.voz_desde, '--voz-desde')
    if not 0.2 <= T <= 2.0:
        die('--t-transicion debe estar entre 0,2 y 2 s')

    say('Herramientas')
    ctx.ffmpeg, ctx.drawtext = pick_ffmpeg()
    ctx.ffprobe = pick_ffprobe(ctx.ffmpeg)
    ctx.probe = Probe(ctx.ffprobe, ctx.ffmpeg)
    ver = subprocess.run([ctx.ffmpeg, '-hide_banner', '-version'], stdout=subprocess.PIPE, universal_newlines=True).stdout.split('\n')[0]
    ok('%s · %s' % (ctx.ffmpeg, ver))
    if not ctx.drawtext:
        warn('este ffmpeg no trae drawtext: los rótulos se pintan con Chromium (o instala gratis: brew install ffmpeg-full)')
    xf = subprocess.run([ctx.ffmpeg, '-hide_banner', '-h', 'filter=xfade'], stdout=subprocess.PIPE,
                        universal_newlines=True).stdout
    if not re.search(r'^\s+%s\s+-?\d+' % re.escape(a.transicion), xf, re.M):
        die('Transición «%s» desconocida para este ffmpeg (prueba fadeblack, fade, smoothleft, circleopen)' % a.transicion)

    # ---- Entradas -----------------------------------------------------------------
    say('Entradas')
    clips_dir = a.clips or ('./youtube-out/clips' if not a.clips_sueltos else None)
    if clips_dir:
        clips_dir = os.path.abspath(clips_dir)
        if not os.path.isdir(clips_dir) and not a.clips_sueltos:
            die('No existe la carpeta de clips %s (graba con scripts/grabar-protocolos.sh o pasa --clips / clips sueltos)' % clips_dir)
    manifest = {'h': {}, 'v': {}}
    if clips_dir and os.path.isfile(os.path.join(clips_dir, 'manifiesto.json')):
        try:
            mj = json.loads(Path(clips_dir, 'manifiesto.json').read_text(encoding='utf-8'))
            for c in mj.get('clips', []):
                if c.get('error') or not c.get('clip'):
                    continue
                c['_path'] = os.path.join(clips_dir, c['clip'])
                manifest['v' if c.get('orientacion') == 'vertical' else 'h'][c['pagina']] = c
            info('manifiesto: %d clip(s) horizontales, %d verticales' % (len(manifest['h']), len(manifest['v'])))
        except (OSError, ValueError) as e:
            warn('manifiesto.json ilegible (%s): sigo sin él' % e)
    pool = []   # (stem, path)
    for c in a.clips_sueltos:
        if not os.path.isfile(c):
            die('No existe el clip %s' % c)
        pool.append((Path(c).stem, os.path.abspath(c)))
    if clips_dir and os.path.isdir(clips_dir):
        for f in sorted(os.listdir(clips_dir)):
            if f.lower().endswith(VIDEO_EXT) and not f.startswith('.'):
                pool.append((Path(f).stem, os.path.join(clips_dir, f)))
    vdir = os.path.join(clips_dir, 'vertical') if clips_dir else None
    vpool = {}
    if vdir and os.path.isdir(vdir):
        for f in os.listdir(vdir):
            if f.lower().endswith(VIDEO_EXT):
                vpool[Path(f).stem] = os.path.join(vdir, f)
    inputs_abs = set(p for _, p in pool) | set(vpool.values())

    g = parse_guion(a.guion) if a.guion else {'video': {}, 'secciones': []}
    gv = g['video']
    guion_dir = os.path.dirname(os.path.abspath(a.guion)) if a.guion else os.getcwd()

    def resolve(key, explicit):
        if explicit:
            for base in (guion_dir, clips_dir or '', os.getcwd()):
                p = explicit if os.path.isabs(explicit) else os.path.join(base, explicit)
                if os.path.isfile(p):
                    return Path(p).stem, os.path.abspath(p)
            die('guion: no encuentro el clip «%s»' % explicit)
        for stem, p in pool:
            if stem == key or key_of(stem) == key:
                return stem, p
        return None, None

    plan = []
    if g['secciones']:
        for s in g['secciones']:
            stem, p = resolve(s['clave'], s.get('clip'))
            if not p:
                warn('sección [%s] (línea %d): no hay clip para ella; la salto' % (s['clave'], s['linea']))
                continue
            plan.append((key_of(s['clave']) if s['clave'] not in DEPARTAMENTOS else s['clave'], stem, p, s))
    else:
        seen = set()
        ordered = pool if a.clips_sueltos else sorted(pool, key=lambda sp: order_key(key_of(sp[0])))
        if manifest['h'] and not a.clips_sueltos:
            mo = [m['pagina'] for m in manifest['h'].values()]
            ordered = sorted(pool, key=lambda sp: (mo.index(sp[0]) if sp[0] in mo else 99, order_key(key_of(sp[0]))))
        for stem, p in ordered:
            if p in seen:
                continue
            seen.add(p)
            plan.append((key_of(stem), stem, p, {}))
    if not plan:
        die('No hay clips que montar')

    secs = []
    for key, stem, p, s in plan:
        man = manifest['h'].get(stem, {})
        avail = ctx.probe.duration(p)
        desde = parse_seconds(s['desde'], '[%s] desde' % key) if s.get('desde') else float(man.get('inicio_util_s', 0) or 0)
        if desde >= avail - 1:
            warn('[%s] «desde» %.1f s supera el clip (%.1f s): empiezo en 0' % (key, desde, avail))
            desde = 0.0
        want = parse_seconds(s['duracion'], '[%s] duracion' % key) if s.get('duracion') else min(DUR, avail - desde)
        if not s.get('desde') and man.get('momento_clave_s') is not None:
            # Encuadre: que la primera acción del protocolo (momento clave) caiga ~2 s después
            # de empezar la sección, sin salirse del clip.
            nd = max(desde, min(float(man['momento_clave_s']) - 2.0, avail - want))
            if nd > desde + 0.05:
                desde = nd
        if want > avail - desde + 0.05:
            warn('[%s] pides %.1f s y el clip tiene %.1f s útiles: congelo el último fotograma' % (key, want, avail - desde))
        want = max(want, T + 1.0)
        dt, ds = default_titles(key, stem)
        titulo = s.get('titulo') or dt
        sub = s.get('subtitulo') if 'subtitulo' in s else ds
        prev_same = len([x for x in secs if x['clave'] == key])
        # Nombre único: un video de un solo departamento repite [03] varias veces (rótulos distintos).
        secs.append({'tipo': 'seccion', 'clave': key, 'nombre': key if not prev_same else '%s_%d' % (key, prev_same + 1),
                     'stem': stem, 'clip': p, 'desde': desde, 'dur': want, 'disponible': avail,
                     'titulo': titulo, 'subtitulo': sub, 'capitulo': clean_text(s.get('capitulo') or titulo),
                     'texto': s.get('texto', ''), 'short': (s.get('short', 'si').lower() not in ('no', 'false', '0')),
                     'audio': ctx.probe.has_audio(p), 'manifiesto': man, 'desde_guion': bool(s.get('desde')),
                     'vclip': vpool.get(stem), 'vman': manifest['v'].get(stem, {})})
        info('[%s] %s · desde %.2f s · %.2f s%s%s' % (key, os.path.basename(p), desde, want,
                                                     ' · con audio' if secs[-1]['audio'] else '',
                                                     ' · vertical ✔' if secs[-1]['vclip'] else ''))
    keys = [s['clave'] for s in secs]
    n_proto = len([k for k in keys if re.match(r'^0[1-7]$', k)])
    title = gv.get('titulo') or ('JOM Studio · %d protocolos en acción' % n_proto if n_proto > 1 else
                                 'JOM Studio · ' + secs[0]['titulo'] if len(secs) == 1 else 'JOM Studio en acción')
    subtitle = gv.get('subtitulo') if 'subtitulo' in gv else 'Gamificación · 3D · Arte IA · Automatización · Audio · Branding · QA'
    logo = a.logo or os.path.join(ctx.repo, 'assets', 'logo-white.png')
    if a.logo and not os.path.isfile(a.logo):
        die('No existe el logo %s' % a.logo)
    if not os.path.isfile(logo):
        warn('sin logo (no encuentro %s): rótulos solo con texto' % logo)
        logo = None
    elif not logo.lower().endswith(('.png', '.jpg', '.jpeg')):
        warn('el logo debe ser PNG/JPG (%s): lo omito' % os.path.basename(logo))
        logo = None
    for opt, path_ in (('--musica', a.musica), ('--voz', a.voz)):
        if path_ and not os.path.isfile(path_):
            die('No existe %s %s' % (opt, path_))
    if a.musica and not ctx.probe.has_audio(a.musica):
        die('--musica %s no tiene audio' % a.musica)
    if a.voz and not ctx.probe.has_audio(a.voz):
        die('--voz %s no tiene audio' % a.voz)

    # ---- Segmentos (intro + secciones + cierre) ----------------------------------------
    intro_d = parse_seconds(gv['intro_duracion'], 'intro_duracion') if gv.get('intro_duracion') else 4.0
    cierre_d = parse_seconds(gv['cierre_duracion'], 'cierre_duracion') if gv.get('cierre_duracion') else 6.0
    segs = []
    if not a.sin_intro:
        f = secs[0]
        segs.append({'tipo': 'intro', 'nombre': 'intro', 'clip': f['clip'], 'desde': f['desde'], 'dur': max(intro_d, T + 1),
                     'blur': True, 'card_in': 0.25, 'fade_in': 0.5, 'titulo': title})
    for s in secs:
        s['card_in'], s['slide'] = 0.6, 48
        s['card_out'] = max(1.5, min(s['dur'] - 1.4, 6.5))
        segs.append(s)
    if not a.sin_cierre:
        l = secs[-1]
        segs.append({'tipo': 'cierre', 'nombre': 'cierre', 'clip': l['clip'],
                     'desde': max(0.0, min(l['desde'] + l['dur'] - cierre_d, l['disponible'] - cierre_d)),
                     'dur': max(cierre_d, T + 1), 'blur': True, 'card_in': 0.3, 'fade_out': 0.9, 'titulo': 'Cierre'})
    C = cut_frac(a.transicion)
    for s in segs:
        s['frames'] = int(round(s['dur'] * FPS))
        s['real'] = s['frames'] / FPS
    align_cuts(segs, T, C)
    total_plan = build_timeline(segs, T, C)
    chs_plan, _ = chapters(segs, total_plan)

    if a.plan:
        say('Plan (sin renderizar)')
        for s in segs:
            info('%-8s %-28s %6.2f s  empieza en %s' % (s['tipo'], (s.get('titulo') or '')[:28], s['real'], fmt_ts(s['inicio'])))
        info('total previsto: %s · transición %s %.2f s' % (fmt_ts(total_plan), a.transicion, T))
        for c in chs_plan:
            info('capítulo %s %s' % (fmt_ts(c['seg'], ms=False), c['titulo']))
        return 0

    # ---- Carpeta de entrega (nueva) ------------------------------------------------------
    stamp = time.strftime('%Y%m%d-%H%M%S')
    if a.salida:
        out = os.path.abspath(a.salida)
    else:
        parent = os.path.dirname(clips_dir) if clips_dir and os.path.basename(clips_dir) == 'clips' else os.path.abspath('youtube-out')
        out = os.path.join(parent, 'video-' + stamp)
    base_out, k = out, 2
    while os.path.exists(out) and (not os.path.isdir(out) or os.listdir(out)):
        out = '%s-%d' % (base_out, k)
        k += 1
    if out != base_out:
        warn('%s ya existe y no está vacía: entrego en %s (no sobrescribo nada)' % (base_out, out))
    for p in inputs_abs | {a.musica and os.path.abspath(a.musica), a.voz and os.path.abspath(a.voz)}:
        if p and os.path.abspath(p).startswith(out + os.sep):
            die('La carpeta de entrega no puede contener entradas (%s)' % p)
    os.makedirs(out, exist_ok=True)
    ctx.work = tempfile.mkdtemp(prefix='jom-montaje-')
    info('entrega: %s' % out)
    info('intermedios: %s' % ctx.work)

    fonts = find_fonts(a.fuentes, ctx.repo)
    ctx.font_file = {}
    for role, (f, brand) in fonts.items():
        ext = os.path.splitext(f)[1].lower()
        shutil.copyfile(f, os.path.join(ctx.work, role + ext))
        ctx.font_file[role] = role + ext
        ok('fuente %s: %s%s' % (role, os.path.basename(f), '' if brand else ' (de sistema)'))
    whisper_exe, whisper_model = find_whisper(a.whisper_modelo) if a.voz else (None, None)

    # ---- Rótulos ----------------------------------------------------------------------
    say('Rótulos')
    cards = Cards(ctx)
    for s in segs:
        if s['tipo'] == 'intro':
            s['card'] = cards.add('intro', W, H, card_intro(title, subtitle, logo))
        elif s['tipo'] == 'cierre':
            s['card'] = cards.add('cierre', W, H, card_cierre(gv.get('cierre') or 'Suscríbete para ver el próximo protocolo',
                                                               gv.get('web') or gv.get('canal') or '', logo))
        else:
            s['card'] = cards.add('tercio_%s' % slug(s['nombre']), W, H, card_tercio(s['titulo'], s['subtitulo']))
    mini_text = gv.get('miniatura') or title
    mini_card = cards.add('miniatura', TW, TH, card_miniatura(mini_text, logo))
    short_secs = [s for s in secs if s['short']] if not a.sin_short else []
    short_title = gv.get('short_titulo') or title
    if short_secs:
        short_intro_card = cards.add('short_intro', SW, SH, card_short_intro(short_title, logo))
        for s in short_secs:
            s['vcard'] = cards.add('short_%s' % slug(s['nombre']), SW, SH,
                                   card_short_seccion(s['titulo'], s['subtitulo'], bool(s['vclip'])))
    cards.render()

    # ---- Segmentos ----------------------------------------------------------------------
    say('Segmentos (%d) · %s' % (len(segs), 'x264 ' + ctx.preset))
    for i, s in enumerate(segs):
        s['archivo'] = os.path.join(ctx.work, 'seg_%02d.mov' % i)
        n = render_segment(ctx, s, s['archivo'], W, H, 'seccion' if s['tipo'] == 'seccion' else 'tarjeta')
        s['frames_reales'] = n
        s['real'] = n / FPS
        ok('%s · %d fotogramas = %.3f s%s' % (s['nombre'], n, s['real'],
                                               ' (ajuste %+.2f s para cortar en segundo exacto)' % s['ajuste_s'] if s.get('ajuste_s') else ''))
        if n != s['frames']:
            warn('%s: esperaba %d fotogramas y salieron %d (los capítulos usan los reales)' % (s['nombre'], s['frames'], n))
    total = build_timeline(segs, T, C)

    # ---- Video largo -----------------------------------------------------------------------
    say('Video 1920×1080 · %s %.2f s · %s' % (a.transicion, T, fmt_ts(total)))
    cmd = [ctx.ffmpeg, '-hide_banner', '-nostdin', '-v', 'error', '-y']
    for s in segs:
        cmd += ['-i', s['archivo']]
    music_idx = voice_idx = None
    nxt = len(segs)
    if a.musica:
        cmd += ['-stream_loop', '-1', '-i', os.path.abspath(a.musica)]
        music_idx, nxt = nxt, nxt + 1
    if a.voz:
        cmd += ['-i', os.path.abspath(a.voz)]
        voice_idx, nxt = nxt, nxt + 1
    if len(segs) > 1:
        parts, vlab, alab = concat_graph(segs, T, a.transicion)
    else:
        parts, vlab, alab = [], '[0:v]', '[0:a]'
    parts = audio_mix(parts, alab, total, music_idx, voice_idx, voz_desde, bool(a.voz))
    parts.append('%sformat=yuv420p[vout]' % vlab)
    mezcla = os.path.join(ctx.work, 'mezcla.mov')
    cmd += ['-filter_complex', ';'.join(parts), '-map', '[vout]', '-map', '[aout]', '-t', '%.3f' % total]
    cmd += x264(ctx, 18) + ['-profile:v', 'high', '-g', '15', '-bf', '2', '-c:a', 'pcm_s24le', '-ar', '48000', mezcla]
    info('codificando (puede tardar unos minutos)…')
    run(cmd, what='ffmpeg (video largo)')
    video = os.path.join(out, 'video-youtube.mp4')
    meta = ['-metadata', 'title=' + title, '-metadata', 'comment=JOM Studio · montar-youtube.sh']
    ln = loudnorm_two_pass(ctx, mezcla, video, meta)
    real_total = ctx.probe.duration(video)
    ok('video-youtube.mp4 · %s · audio %s' % (fmt_ts(real_total), 'silencio' if ln['silencio'] else 'loudnorm ' + ln['tipo']))

    # ---- Cortes reales → capítulos -------------------------------------------------------------
    # Se mide en el MP4 final dónde cae cada transición; si alguna se separa del cálculo, manda
    # lo medido (así las marcas de la descripción coinciden con el video, no con el plan).
    say('Cortes reales y capítulos')
    medidos = measure_cuts(ctx, video, segs, T, a.transicion)
    if medidos is None:
        warn('no pude decodificar el video para medir los cortes: capítulos solo calculados')
        medidos = []
    for m in medidos:
        s = segs[m['k']]
        m['entre'] = '%s → %s' % (segs[m['k'] - 1]['nombre'], s['nombre'])
        m['previsto_s'] = round(s['inicio'], 3)
        if m['medido_s'] is not None and abs(m['medido_s'] - s['inicio']) > 0.25:
            warn('corte %s: previsto %.2f s, medido %.2f s → uso el medido' % (m['entre'], s['inicio'], m['medido_s']))
            s['inicio'] = m['medido_s']
    chs, ch_notes = chapters(segs, real_total)
    for nte in ch_notes:
        warn('capítulos: ' + nte)
    by_t = {round(segs[m['k']]['inicio'], 3): m for m in medidos}
    cortes = {'tolerancia_s': CUT_TOL, 'transiciones': medidos, 'capitulos': []}
    for c in chs:
        if c['t'] == 0:
            cortes['capitulos'].append({'publicado': fmt_ts(0, ms=False), 'titulo': c['titulo'], 'corte_s': 0.0,
                                        'error_s': 0.0, 'ok': True})
            continue
        m = by_t.get(round(c['t'], 3))
        real = m['medido_s'] if m and m['medido_s'] is not None else None
        err = abs(c['seg'] - real) if real is not None else None
        cortes['capitulos'].append({'publicado': fmt_ts(c['seg'], ms=False), 'titulo': c['titulo'], 'corte_s': real,
                                    'error_s': None if err is None else round(err, 3),
                                    'ok': err is not None and err <= CUT_TOL})
    for c in cortes['capitulos']:
        if c['corte_s'] is None:
            warn('capítulo %s %s: no pude medir su corte (%s)' % (c['publicado'], c['titulo'], 'indeterminado'))
        else:
            (ok if c['ok'] else warn)('capítulo %s %-34s corte real %7.3f s · error %.3f s' % (
                c['publicado'], c['titulo'][:34], c['corte_s'], c['error_s']))
    cortes['ok'] = all(c['ok'] for c in cortes['capitulos'])

    # ---- Subtítulos / miniatura ------------------------------------------------------------------
    say('Miniatura 1280×720')
    tsec = None
    want_key = None
    if gv.get('miniatura_de'):
        m = re.match(r'^\s*([^@]+?)\s*(?:@\s*([\d.,:]+))?\s*$', gv['miniatura_de'])
        if m:
            want_key, tsec = m.group(1).strip(), (parse_seconds(m.group(2), 'miniatura_de') if m.group(2) else None)
    pick = None
    for k in ([want_key] if want_key else []) + ['03', '01', '06', 'home']:
        pick = next((s for s in segs if s['tipo'] == 'seccion' and k in (s['clave'], s['nombre'])), None)
        if pick:
            break
    pick = pick or next(s for s in segs if s['tipo'] == 'seccion')
    if tsec is None:
        man = pick.get('manifiesto') or {}
        done = [x['t'] for x in man.get('acciones', []) if x.get('ok') and x['accion'].endswith('done')]
        clip_t = (done[0] + 0.8) if done else float(man.get('momento_clave_s', pick['desde'] + pick['real'] * 0.4)) + 1.5
        tsec = clip_t - pick['desde']
    tsec = min(max(tsec, T + 0.2), pick['real'] - T - 0.2)
    t_final = pick['offset'] + tsec
    miniatura = os.path.join(out, 'miniatura.png')
    run([ctx.ffmpeg, '-hide_banner', '-nostdin', '-v', 'error', '-n', '-ss', '%.3f' % t_final, '-i', video, '-i', mini_card,
         '-filter_complex', '[0:v]scale=%d:%d:flags=lanczos:in_color_matrix=bt709,format=gbrp[b];[b][1:v]overlay=format=rgb,'
         'format=rgb24' % (TW, TH), '-frames:v', '1', miniatura], what='ffmpeg (miniatura)')
    size_mb = os.path.getsize(miniatura) / 1e6
    ok('miniatura.png · fotograma de [%s] en %s · %.2f MB' % (pick['clave'], fmt_ts(t_final), size_mb))
    if size_mb > 2.0:
        jpg = os.path.join(out, 'miniatura.jpg')
        run([ctx.ffmpeg, '-hide_banner', '-nostdin', '-v', 'error', '-n', '-i', miniatura, '-q:v', '3', jpg], what='ffmpeg (miniatura jpg)')
        warn('la PNG pasa de 2 MB (límite de YouTube): sube miniatura.jpg (%.2f MB)' % (os.path.getsize(jpg) / 1e6))

    say('Subtítulos')
    srt_g = srt_from_guion(segs, real_total, title)
    srt_path = os.path.join(out, 'subtitulos.es.srt')
    sub_origen = 'guion'
    if a.voz and whisper_exe and whisper_model:
        wav = os.path.join(ctx.work, 'voz16k.wav')
        run([ctx.ffmpeg, '-hide_banner', '-nostdin', '-v', 'error', '-y', '-i', os.path.abspath(a.voz), '-ar', '16000',
             '-ac', '1', '-c:a', 'pcm_s16le', wav], what='ffmpeg (voz 16 kHz)')
        r = subprocess.run([whisper_exe, '-m', whisper_model, '-f', wav, '-l', 'es', '-osrt', '-of',
                            os.path.join(ctx.work, 'voz')], stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                           universal_newlines=True, errors='replace')
        wsrt = os.path.join(ctx.work, 'voz.srt')
        if r.returncode == 0 and os.path.isfile(wsrt) and Path(wsrt).read_text(encoding='utf-8', errors='replace').strip():
            Path(srt_path).write_text(shift_srt(Path(wsrt).read_text(encoding='utf-8', errors='replace'), voz_desde),
                                      encoding='utf-8')
            Path(out, 'subtitulos-guion.es.srt').write_text(srt_g, encoding='utf-8')
            sub_origen = 'whisper.cpp (%s)' % os.path.basename(whisper_model)
        else:
            warn('whisper.cpp falló (%s): uso el guion' % ((r.stderr or '').strip().splitlines()[-1:] or ['?'])[0])
    elif a.voz and whisper_exe:
        warn('whisper.cpp está, pero no hay modelo: descárgalo gratis (p. ej. curl -L -o ~/.cache/whisper.cpp/ggml-base.bin '
             'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin) o pasa --whisper-modelo')
    elif a.voz:
        info('sin whisper.cpp (brew install whisper-cpp): subtítulos desde el guion')
    if sub_origen == 'guion':
        Path(srt_path).write_text(srt_g, encoding='utf-8')
    ok('subtitulos.es.srt · %d bloque(s) · origen %s' % (len(re.findall(r'-->', Path(srt_path).read_text(encoding='utf-8'))), sub_origen))

    # ---- Short -------------------------------------------------------------------------------
    short = None
    ln_short = None
    short_segs = []
    if short_secs:
        say('Short 1080×1920 ≤ 60 s')
        Ts = min(0.4, T)
        intro_s = 2.5
        nsec = len(short_secs)
        while nsec and (SHORT_MAX - intro_s + nsec * Ts) / nsec < 3.0:
            nsec -= 1
        if nsec < len(short_secs):   # con 1 sección siempre cabe (55 s)
            warn('el Short solo admite %d sección(es) de ≥3 s: dejo fuera %s'
                 % (nsec, ', '.join(s['clave'] for s in short_secs[nsec:])))
            short_secs = short_secs[:nsec]
        per = (SHORT_MAX - intro_s + nsec * Ts) / nsec
        f0 = short_secs[0]
        short_segs.append({'tipo': 'intro', 'nombre': 'short_intro', 'clip': f0['vclip'] or f0['clip'],
                           'desde': f0['vman'].get('inicio_util_s', f0['desde']) if f0['vclip'] else f0['desde'],
                           'dur': intro_s, 'blur': True, 'fill': not f0['vclip'], 'card': short_intro_card,
                           'card_in': 0.15, 'fade_in': 0.3})
        for s in short_secs:
            vert = bool(s['vclip'])
            man = s['vman'] if vert else s['manifiesto']
            clip = s['vclip'] or s['clip']
            avail = ctx.probe.duration(clip)
            d = min(s['dur'], per)
            base = s['desde'] if (s['desde_guion'] and not vert) else float(man.get('inicio_util_s', s['desde'] if not vert else 0) or 0)
            key_t = float(man.get('momento_clave_s', base) or base)
            st = max(base, key_t - 1.0)
            if st + d > avail:
                st = max(base, avail - d)
            short_segs.append({'tipo': 'seccion', 'nombre': 'short_' + s['nombre'], 'clip': clip, 'desde': st, 'dur': d,
                               'fill': not vert, 'card': s['vcard'], 'card_in': 0.2, 'audio': s['audio'] and not vert,
                               'clave': s['clave']})
        short_segs[-1]['fade_out'] = 0.6
        for i, s in enumerate(short_segs):
            s['frames'] = int(round(s['dur'] * FPS))
            s['archivo'] = os.path.join(ctx.work, 'short_%02d.mov' % i)
            n = render_segment(ctx, s, s['archivo'], SW, SH, 'seccion' if s['tipo'] == 'seccion' else 'tarjeta')
            s['real'] = n / FPS
        stotal = build_timeline(short_segs, Ts, C)
        cmd = [ctx.ffmpeg, '-hide_banner', '-nostdin', '-v', 'error', '-y']
        for s in short_segs:
            cmd += ['-i', s['archivo']]
        mi = None
        if a.musica:
            cmd += ['-stream_loop', '-1', '-i', os.path.abspath(a.musica)]
            mi = len(short_segs)
        parts, vlab, alab = concat_graph(short_segs, Ts, a.transicion)
        parts = audio_mix(parts, alab, stotal, mi, None, 0, False)
        parts.append('%sformat=yuv420p[vout]' % vlab)
        smez = os.path.join(ctx.work, 'short_mezcla.mov')
        cmd += ['-filter_complex', ';'.join(parts), '-map', '[vout]', '-map', '[aout]', '-t', '%.3f' % stotal]
        cmd += x264(ctx, 18) + ['-profile:v', 'high', '-g', '15', '-bf', '2', '-c:a', 'pcm_s24le', '-ar', '48000', smez]
        run(cmd, what='ffmpeg (Short)')
        short = os.path.join(out, 'short-youtube.mp4')
        ln_short = loudnorm_two_pass(ctx, smez, short, ['-metadata', 'title=' + short_title + ' #Shorts'])
        sdur = ctx.probe.duration(short)
        if sdur > 60.0:
            die('El Short dura %.2f s (> 60 s)' % sdur)
        ok('short-youtube.mp4 · %.2f s · %d sección(es) · %s' % (sdur, len(short_secs), 'clips verticales' if all(s['vclip'] for s in short_secs)
                                                                 else 'horizontal con fondo desenfocado'))

    # ---- Metadatos -----------------------------------------------------------------------------
    say('Metadatos')
    tags = build_tags(gv.get('etiquetas'), keys)
    hashtags = gv.get('hashtags') or '#JOMStudio #DesarrolloWeb #Web3D'
    deps = [s['titulo'] for s in secs]
    desc = gv.get('descripcion') or (
        '%s\n\nRecorrido en vivo por %s de JOM Studio, grabado directamente en la web: cada protocolo funcionando '
        'tal y como lo ve un cliente.' % (subtitle or title, ', '.join(deps)))
    ch_block = '\n'.join('%s %s' % (fmt_ts(c['seg'], ms=False), c['titulo']) for c in chs)
    links = gv.get('enlaces') or gv.get('web') or ''
    full_desc = desc.strip() + '\n\nCAPÍTULOS\n' + ch_block + ('\n\n' + links.strip() if links else '') + '\n\n' + hashtags
    checks = {
        'titulo_caracteres': len(title), 'titulo_ok': len(title) <= 100,
        'descripcion_caracteres': len(full_desc), 'descripcion_ok': len(full_desc) <= 5000,
        'etiquetas_caracteres': sum(len(x) + (2 if ' ' in x else 0) for x in tags) + max(0, len(tags) - 1),
        'capitulos': len(chs), 'capitulos_en_corte_real': cortes['ok'],
        'capitulos_ok': len(chs) >= 3 and chs[0]['seg'] == 0 and all(
            (chs[i + 1]['seg'] if i + 1 < len(chs) else int(real_total)) - chs[i]['seg'] >= CHAPTER_MIN for i in range(len(chs))),
    }
    if len(title) > 100:
        warn('el título tiene %d caracteres (máximo 100 en YouTube)' % len(title))
    lines = ['# JOM Studio · metadatos para YouTube Studio (copiar y pegar)',
             '# Generado por montar-youtube.sh el %s' % time.strftime('%Y-%m-%d %H:%M'), '',
             '== TÍTULO (%d/100 caracteres) ==' % len(title), title, '',
             '== DESCRIPCIÓN (incluye los capítulos; %d/5000 caracteres) ==' % len(full_desc), full_desc, '',
             '== CAPÍTULOS (marcas calculadas de las duraciones reales; primer capítulo 00:00, cada uno ≥ 10 s) ==',
             ch_block, '',
             '== ETIQUETAS (pegar en «Etiquetas»; %d/500 caracteres) ==' % checks['etiquetas_caracteres'], ', '.join(tags), '',
             '== MINIATURA ==', 'miniatura.png (1280×720)' + (' · usa miniatura.jpg (≤2 MB)' if size_mb > 2 else ''), '',
             '== SUBTÍTULOS ==', 'subtitulos.es.srt → Subtítulos › Añadir idioma › Español › Subir archivo (con tiempos)', '']
    if short:
        lines += ['== SHORT ==', 'Archivo: short-youtube.mp4 (%.1f s, 1080×1920)' % sdur,
                  'Título: %s #Shorts' % short_title[:90],
                  'Descripción: %s\nVideo completo en el canal. %s #Shorts' % (subtitle or title, hashtags), '']
    Path(out, 'youtube-metadatos.txt').write_text('\n'.join(lines), encoding='utf-8')
    ok('youtube-metadatos.txt · %d capítulo(s) · %d etiqueta(s)' % (len(chs), len(tags)))
    for c in chs:
        info('%s  %s' % (fmt_ts(c['seg'], ms=False), c['titulo']))

    leeme = """JOM Studio · cómo subir este video (manual, gratis, sin API)

1. Abre https://studio.youtube.com → Crear → Subir videos → video-youtube.mp4
2. Título y descripción: copia los de youtube-metadatos.txt (la descripción ya trae los CAPÍTULOS).
3. Miniatura: «Subir miniatura» → miniatura.png (o miniatura.jpg si la PNG pasa de 2 MB).
4. Más opciones → Etiquetas: pega la línea de ETIQUETAS. Idioma del video: Español.
5. Subtítulos: Subtítulos → Añadir idioma → Español → Subir archivo → «Con sincronización» → subtitulos.es.srt
6. Visibilidad: Privado o No listado primero; revísalo en el móvil y luego Público.
7. Short: sube short-youtube.mp4 (vertical, ≤ 60 s) aparte con el título/descr. de la sección SHORT.

La subida por API (YouTube Data API) es opcional y requiere OAuth del CEO: no se hace sin su permiso
explícito ni sus credenciales.
"""
    Path(out, 'LEEME-subida.txt').write_text(leeme, encoding='utf-8')

    # ---- Verificación final + montaje.json --------------------------------------------------------
    say('Verificación')
    report = {'video': {}, 'short': {}}
    for name, path_, w_, h_ in (('video', video, W, H), ('short', short, SW, SH)):
        if not path_:
            continue
        j = ctx.probe.info(path_)
        vs = next(s for s in j['streams'] if s['codec_type'] == 'video')
        as_ = next((s for s in j['streams'] if s['codec_type'] == 'audio'), {})
        lu = ebur128(ctx, path_)
        report[name] = {'archivo': os.path.basename(path_), 'duracion_s': float(j['format']['duration']),
                        'video': '%s %s %sx%s %s' % (vs.get('codec_name'), vs.get('profile'), vs.get('width'), vs.get('height'), vs.get('pix_fmt')),
                        'audio': '%s %s Hz %s ch' % (as_.get('codec_name'), as_.get('sample_rate'), as_.get('channels')),
                        'loudness': lu}
        good = (vs.get('width'), vs.get('height')) == (w_, h_) and vs.get('codec_name') == 'h264' and vs.get('pix_fmt') == 'yuv420p'
        lufs_txt = 'silencio' if lu['I_LUFS'] is None or lu['I_LUFS'] < -70 else '%.1f LUFS / %.1f dBTP' % (lu['I_LUFS'], lu['true_peak_dBTP'] or 0)
        (ok if good else warn)('%s: %s · %s · %s · %.2f s' % (report[name]['archivo'], report[name]['video'], report[name]['audio'],
                                                           lufs_txt, report[name]['duracion_s']))
    with open(video, 'rb') as fh:
        head = fh.read(1 << 16)
    faststart = head.find(b'moov') != -1 and (head.find(b'mdat') == -1 or head.find(b'moov') < head.find(b'mdat'))
    (ok if faststart else warn)('faststart (moov al principio): %s' % ('sí' if faststart else 'NO'))

    montaje = {
        'herramienta': 'montar-youtube', 'version': 1, 'generado': time.strftime('%Y-%m-%dT%H:%M:%S'),
        'ffmpeg': ctx.ffmpeg, 'rotulos': 'drawtext' if ctx.drawtext else 'chromium',
        'fuentes': {k: v[0] for k, v in fonts.items()}, 'guion': a.guion and os.path.abspath(a.guion),
        'musica': a.musica and os.path.abspath(a.musica), 'voz': a.voz and os.path.abspath(a.voz),
        'transicion': {'tipo': a.transicion, 'duracion_s': T, 'corte_fraccion': C}, 'fps': FPS,
        'cortes_verificados': cortes,
        'segmentos': [{'tipo': s['tipo'], 'clave': s.get('clave'), 'titulo': s.get('titulo'), 'clip': s['clip'],
                       'desde_s': round(s['desde'], 3), 'fotogramas': s.get('frames_reales'), 'duracion_s': round(s['real'], 4),
                       'ajuste_s': s.get('ajuste_s', 0),
                       'xfade_offset_s': round(s['offset'], 4), 'inicio_s': round(s['inicio'], 4)} for s in segs],
        'duracion_calculada_s': round(total, 4), 'duracion_real_s': round(real_total, 4),
        'capitulos': [{'t_s': round(c['t'], 4), 'publicado': fmt_ts(c['seg'], ms=False), 'segundo': c['seg'],
                       'titulo': c['titulo']} for c in chs],
        'capitulos_notas': ch_notes, 'comprobaciones_youtube': checks, 'loudnorm_video': ln,
        'short': ({'segmentos': [{'clave': s.get('clave'), 'clip': s['clip'], 'desde_s': round(s['desde'], 3),
                                  'duracion_s': round(s['real'], 4), 'inicio_s': round(s['inicio'], 4)} for s in short_segs],
                   'transicion_s': min(0.4, T), 'loudnorm': ln_short} if short else None),
        'miniatura': {'seccion': pick['clave'], 't_video_s': round(t_final, 3), 'mb': round(size_mb, 3)},
        'subtitulos': sub_origen, 'verificacion': report, 'avisos': AVISOS,
    }
    Path(out, 'montaje.json').write_text(json.dumps(montaje, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if a.conservar_temporales:
        info('intermedios conservados en %s' % ctx.work)
    else:
        shutil.rmtree(ctx.work, ignore_errors=True)

    say('Entrega lista: %s' % out)
    for f in sorted(os.listdir(out)):
        info(f)
    nexts = []
    if os.path.isfile(os.path.join(ctx.repo, 'scripts', 'auditar_video.py')):
        nexts.append('auditar: python3 scripts/auditar_video.py (lee su --help) sobre %s' % video)
    if os.path.isfile(os.path.join(ctx.repo, 'scripts', 'pulir-video.sh')):
        nexts.append('pulir: scripts/pulir-video.sh (lee su --help); el pulido sale a otro archivo, nunca sobre este')
    nexts.append('subir a mano en YouTube Studio siguiendo LEEME-subida.txt')
    for x in nexts:
        info('siguiente → ' + x)
    if AVISOS:
        print('\n  %d aviso(s): revisa las líneas con ⚠' % len(AVISOS))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main(sys.argv[1:]))
    except KeyboardInterrupt:
        die('Cancelado', 130)
