#!/usr/bin/env bash
# Departamento 03 · Arte IA — quita la pantalla verde SIN halos verdes ni extremidades cortadas.
#
# Uso (en tu Mac; rutas con espacios entre comillas):
#   scripts/alfa-sin-verde.sh clip.mp4                       # → ./alfa-out/clip.webm (+ .webp, + .mov)
#   scripts/alfa-sin-verde.sh "Videos verdes/" foto.png      # carpetas (sin subcarpetas) e imágenes
#   KEY=0x19E62A scripts/alfa-sin-verde.sh clip.mov          # fuerza el color de la pantalla
#   OUT="$HOME/Desktop/recortes" scripts/alfa-sin-verde.sh *.mp4
#
# Salidas en OUT (por defecto ./alfa-out). La entrada nunca se sobrescribe.
#   video  → nombre.webm  VP9 + alfa (yuva420p): Chrome, Firefox, Edge
#            nombre.webp  WebP animado + alfa, loop infinito: respaldo universal
#            nombre.mov   HEVC + alfa (hvc1): Safari — solo si ffmpeg tiene hevc_videotoolbox
#   imagen → nombre.png (alfa) + nombre.webp
# Cada salida se comprueba con scripts/verificar_alfa.py --fuente <entrada> (VERIFICAR=0 lo omite).
# Idempotente: si la entrada y los parámetros no cambiaron, no rehace nada (FORZAR=1 rehace).
#
# Variables: OUT, KEY (0xRRGGBB), SIM_K (1.45), BLEND (0.03), CRF (30), WEBP_Q (75),
#            MOTOR_IMG (auto|isnet|clave), INSTALAR_REMBG (1), JOM_REMBG_HOME (~/.cache/jom-rembg),
#            FORZAR (0), VERIFICAR (1).
#
# POR QUÉ ASÍ — todo medido (scratchpad/alfa, video de prueba con verdad de terreno: verde de
# estudio con gradiente, viñeta, arrugas y ruido; y verde "de IA" casi puro; pelo de 0,4-0,9 px,
# chaqueta verde oscuro, pantalón oliva, vidrio al 45 %, vapor, sombra y rebote verde de 6 px):
#  · La fórmula chromakey=0x00FF00:0.12:0.08 + despill expand=0.5 falla en los dos verdes:
#      estudio → el 100 % del fondo queda opaco (caja gris); verde IA → queda el 15,5 % del fondo y
#      el 98,6 % de la sombra, y el despill GLOBAL agrisa la chaqueta verde (error 16,9 frente a 1,9).
#    Un verde real nunca es 0x00FF00 y chromakey pasa 0x00FF00 a YUV con BT.601 aunque el video
#    sea BT.709. → La clave se MIDE: mediana YUV del borde del primer fotograma, por el mismo camino
#    de conversión que usa el filtro (format=yuva444p) y entregada con yuv=1.
#  · similarity = SIM_K × p99,9 del ruido de ese borde. Barrido 1,0-2,0: meseta de mínimo error de
#    composición entre 1,3 y 1,6 (menos: queda fondo y sombra; más: se come pelo y chaqueta).
#    blend = 0,03 (meseta 0,02-0,04; con 0,10 se pierde 5-11 % de la chaqueta = "cortes").
#  · Despill SOLO en el borde: alfa < 250 dilatado R px (R = 4 a 540 px, escala con la resolución)
#    y suavizado; expand=0. Global, como la fórmula, cambia el color interior (11,2 frente a 2,2);
#    en el borde el halo verde visible baja de 2,6-4,0 % a 0,8-0,9 %. Con la máscara proporcional
#    al alfa (en vez de umbral) el vidrio semitransparente seguía verde (derrame 25 %).
#  · NO se erosiona ni se difumina el alfa: erosionar 1 px pierde 5-6 % de pantalón y chaqueta y el
#    75 % del pelo (= extremidades cortadas); difuminar 0,7 px deja más fondo; niveles: sin ganancia.
#  · CRF 30: de 20 a 38 el error de composición cambia < 0,03; 30 pesa 2,6× menos que 20.
#  · Imágenes: ISNet (rembg isnet-general-use) es el mejor en el verde de estudio (error 1,61 frente
#    a 3,26 de la clave) pero en el verde IA BORRÓ LAS PIERNAS (99,95 % del pantalón). Por eso:
#    alfa = máx(ISNet, clave) recortado al fondo seguro de la clave → 1,71 y 1,91: nunca corta.
#  · Video con ISNet por fotograma: parpadea (salto de cobertura 10,8 %, verdad 1,1 %) → solo clave.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd -P)"
OUT="${OUT:-./alfa-out}"
KEY="${KEY:-}"
SIM_K="${SIM_K:-1.45}"
BLEND="${BLEND:-0.03}"
CD_K="${CD_K:-3}"
CD_HI="${CD_HI:-0.8}"
CRF="${CRF:-30}"
WEBP_Q="${WEBP_Q:-75}"
MOTOR_IMG="${MOTOR_IMG:-auto}"
INSTALAR_REMBG="${INSTALAR_REMBG:-1}"
REMBG_HOME="${JOM_REMBG_HOME:-$HOME/.cache/jom-rembg}"
REMBG_PIN="rembg[cpu]==2.0.85"          # probado; necesita Python ≥ 3.11
FORZAR="${FORZAR:-0}"
VERIFICAR="${VERIFICAR:-1}"
VERSION=2                               # sube si cambia la cadena: invalida las firmas

say()  { printf '\n==> %s\n' "$*"; }
die()  { printf '\n✖ %s\n' "$*" >&2; exit 1; }
warn() { printf '  ⚠ %s\n' "$*"; }
ok()   { printf '  ✔ %s\n' "$*"; }

if [ $# -lt 1 ]; then
  sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
  exit 2
fi
case "$MOTOR_IMG" in auto|isnet|clave) ;; *) die "MOTOR_IMG debe ser auto, isnet o clave" ;; esac
case "$KEY" in ""|0x[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]) ;;
  *) die "KEY debe ser 0xRRGGBB (por ejemplo KEY=0x19E62A)" ;; esac
if ! command -v ffmpeg >/dev/null || ! command -v ffprobe >/dev/null; then die "Falta ffmpeg (brew install ffmpeg)"; fi
command -v python3 >/dev/null || die "Falta python3 (xcode-select --install)"

ENCODERS="$(ffmpeg -hide_banner -encoders 2>/dev/null | awk '{print $2}')"
tiene_enc() { printf '%s\n' "$ENCODERS" | grep -qx "$1"; }
tiene_enc libvpx-vp9 || die "Tu ffmpeg no trae libvpx-vp9 (brew reinstall ffmpeg)"
WEBP=0; tiene_enc libwebp_anim && WEBP=1
WEBP_IMG=0; tiene_enc libwebp && WEBP_IMG=1
HEVC=0; tiene_enc hevc_videotoolbox && HEVC=1
[ $WEBP = 1 ] || warn "ffmpeg sin libwebp_anim: no habrá .webp de respaldo (brew reinstall ffmpeg)"

T="${TMPDIR:-/tmp}"; T="${T%/}"
TMP="$(mktemp -d "$T/jom-alfa.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"
OUT_ABS="$(cd "$OUT" && pwd -P)"
mkdir -p "$OUT_ABS/.firmas"
FALLOS=0
ST=""; [ -t 2 ] && ST=1   # barra de progreso de ffmpeg solo en terminal (en un log son miles de \r)

ff() { ffmpeg -nostdin "$@"; }   # -nostdin: si no, ffmpeg se come la lista del bucle de carpetas
abs_path() { printf '%s/%s' "$(cd "$(dirname "$1")" && pwd -P)" "$(basename "$1")"; }
minus() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }
tipo_de() {
  case "$(minus "${1##*.}")" in
    mp4|mov|m4v|webm|mkv|avi|gif) echo video ;;
    png|jpg|jpeg|webp|tif|tiff|bmp) echo imagen ;;
    *) echo "" ;;
  esac
}
tam_mtime() { stat -c '%s %Y' "$1" 2>/dev/null || stat -f '%z %m' "$1"; }   # GNU | BSD (Mac)

# --- sondeo: W H PIXFMT CSPACE CRANGE FPS ------------------------------------------------
sondear() {
  W=""; H=""; PIXFMT=""; CSPACE=""; CRANGE=""; FPS=""
  local k v
  while IFS='=' read -r k v; do
    case "$k" in
      width) W="$v" ;; height) H="$v" ;; pix_fmt) PIXFMT="$v" ;;
      color_space) CSPACE="$v" ;; color_range) CRANGE="$v" ;; r_frame_rate) FPS="$v" ;;
    esac
  done < <(ffprobe -v error -select_streams v:0 -show_entries \
             stream=width,height,pix_fmt,color_space,color_range,r_frame_rate -of default=nw=1 "$1" 2>/dev/null)
  [ -n "$W" ] && [ -n "$H" ]
}

# --- clave: mediana YUV del borde (3 %) del 1.er fotograma + ruido p99,9 → similarity -------
# Mismo camino de conversión que el filtro (format=yuva444p): sin desajuste BT.601/BT.709.
medir_clave() {   # $1 = archivo  → KEYYUV SIM P999 KEYRGB PANT SAT FUERA RK CDLO CDHI
  local f="$1" raw="$TMP/k.yuv" rgb="$TMP/k.rgb" kraw="$TMP/kf.yuv" res
  ff -v error -y -i "$f" -frames:v 1 -vf format=yuva444p -f rawvideo -pix_fmt yuva444p "$raw"
  ff -v error -y -i "$f" -frames:v 1 -vf format=rgb24 -f rawvideo -pix_fmt rgb24 "$rgb"
  : > "$kraw"
  if [ -n "$KEY" ]; then   # clave forzada: a YUV con la matriz del video (o la de swscale si es RGB)
    local conv="format=yuva444p" m
    case "$PIXFMT" in
      rgb*|bgr*|gbr*|argb|abgr|pal8|gray*|ya8) ;;
      *) case "$CSPACE" in
           bt709) m=bt709 ;; smpte170m|bt470bg) m=bt601 ;; bt2020nc|bt2020c) m=bt2020 ;;
           *) if [ "$H" -ge 720 ]; then m=bt709; else m=bt601; fi ;;
         esac
         local rg=tv; case "$CRANGE$PIXFMT" in pc*|*yuvj*) rg=pc ;; esac
         conv="scale=out_color_matrix=$m:out_range=$rg,format=yuva444p" ;;
    esac
    ff -v error -y -f lavfi -i "color=c=$KEY:s=8x8" -frames:v 1 -vf "format=rgb24,$conv" \
      -f rawvideo -pix_fmt yuva444p "$kraw"
  fi
  res="$(python3 - "$W" "$H" "$raw" "$rgb" "$kraw" "$SIM_K" "$CD_K" "$CD_HI" "$KEY" <<'PY'
import math, sys
w, h = int(sys.argv[1]), int(sys.argv[2])
yuv, rgb, kf = (open(p, "rb").read() for p in sys.argv[3:6])
k, cdk, cdhi, keyhex = float(sys.argv[6]), float(sys.argv[7]), float(sys.argv[8]), sys.argv[9]
n = w * h
Y, U, V = yuv[:n], yuv[n:2 * n], yuv[2 * n:3 * n]
m = max(4, round(min(w, h) * 0.03))
idx = [y * w + x for y in list(range(m)) + list(range(h - m, h)) for x in range(w)]
idx += [y * w + x for y in range(m, h - m) for x in list(range(m)) + list(range(w - m, w))]
med = lambda v: sorted(v)[len(v) // 2]
ky, ku, kv = med([Y[i] for i in idx]), med([U[i] for i in idx]), med([V[i] for i in idx])
N = 255 * 2 ** 0.5                       # misma normalización que vf_chromakey.c
dl = [math.hypot(U[i] - ku, V[i] - kv) / N for i in idx]
dm = sorted(dl)[len(dl) // 2]
lim = max(0.03, 6 * dm)                  # fuera el sujeto si toca el borde
pi = [i for i, x in zip(idx, dl) if x <= lim]   # píxeles de pantalla del borde
dd = sorted(x for x in dl if x <= lim)
fuera = 100.0 * (len(idx) - len(pi)) / len(idx)
p999 = dd[int(0.999 * (len(dd) - 1))]
kc = [med([rgb[3 * i + c] for i in pi]) for c in range(3)]
sat = math.hypot(ku - 128, kv - 128) / N  # croma de la pantalla: ~0 = no es pantalla de color
if len(kf) >= 4 * 64:                     # KEY forzada: su YUV y su RGB (el ruido sigue siendo el medido)
    ky, ku, kv = kf[0], kf[64], kf[128]
    kc = [int(keyhex[j:j + 2], 16) for j in (2, 4, 6)]
sim = min(0.25, max(0.01, k * p999))
pant = "blue" if kc[2] > kc[1] else "green"
# Mate de diferencia de color normalizado: r = (P - máx(otros)) / P, P = canal de la pantalla.
# Una sombra o un degradado de la pantalla escalan R, G y B a la vez y r no cambia; un vidrio o un
# pelo mezclado con la pantalla bajan r. alfa = 1 - r/rK, con rampa [lo, hi]; lo = CD_K × p99,9 del
# ruido de ese alfa en el borde.
c, o1, o2 = (2, 0, 1) if pant == "blue" else (1, 0, 2)
rat = lambda p: max(0, p[c] - max(p[o1], p[o2])) / max(1, p[c])
rk = rat(kc) if len(kf) >= 4 * 64 else med([rat(rgb[3 * i:3 * i + 3]) for i in pi])
lo = hi = 0.0
if cdk > 0 and rk >= 0.15:                # pantalla poco saturada: el mate sería ruido → solo clave
    a = sorted(max(0.0, 1 - rat(rgb[3 * i:3 * i + 3]) / rk) for i in pi)
    lo = min(0.6, max(0.10, cdk * a[int(0.999 * (len(a) - 1))]))
    hi = max(lo + 0.1, cdhi)
print("0x%02X%02X%02X %.4f %.4f %d,%d,%d %s %.3f %.1f %.4f %s %s" % (ky, ku, kv, sim, p999, kc[0], kc[1], kc[2],
      pant, sat, fuera, rk, "%.4f" % lo if lo else "0", "%.4f" % hi if lo else "0"))
PY
)"
  # shellcheck disable=SC2086  # separar a propósito los 10 campos
  set -- $res
  KEYYUV="$1"; SIM="$2"; P999="$3"; KEYRGB="$4"; PANT="$5"; SAT="$6"; FUERA="$7"; RK="$8"; CDLO="$9"; CDHI="${10}"
  IFS=, read -r KR KG KB <<EOF_RGB
$KEYRGB
EOF_RGB
}

# --- cadena de filtros común -------------------------------------------------------------
# MATE: [0:v] → [ak] = alfa de la clave = máx(chromakey UV, mate de diferencia de color) y [col] =
# color en gbrap. El chromakey va sobre el YUV ORIGINAL (si pasa antes por RGB cambia la matriz y
# la clave medida deja de valer: medido, el vidrio pasaba de 0 a 52 y la sombra de 9 % a 32 %).
# Todo con filtros nativos (colorchannelmixer, extractplanes, blend, lut2): sin geq, rápido.
cadena() {   # → MATE y DESP (despill de borde); el color lo arma color_g
  local r=$(( (W < H ? W : H) / 135 )) dil="" i P mx1 mx2
  [ $r -lt 2 ] && r=2
  i=0; while [ $i -lt $r ]; do dil="${dil}dilation,"; i=$((i + 1)); done
  RAD=$r
  if [ "$PANT" = blue ]; then P=b; mx1="br=-1"; mx2="bg=-1"; else P=g; mx1="gr=-1"; mx2="gb=-1"; fi
  MATE="[0:v]split=2[k0][c0];[k0]format=yuva444p,chromakey=${KEYYUV}:${SIM}:${BLEND}:yuv=1,alphaextract[ack];"
  MATE="${MATE}[c0]format=gbrap"
  if [ "$CDLO" != 0 ]; then   # s = P - máx(otros) como mínimo de (P-a) y (P-b); r = s/P vía lut2
    MATE="${MATE},split=4[c1][c2][c3][col];[c1]colorchannelmixer=${mx1},extractplanes=${P}[d1];"
    MATE="${MATE}[c2]colorchannelmixer=${mx2},extractplanes=${P}[d2];[d1][d2]blend=all_mode=darken[sd];"
    MATE="${MATE}[c3]extractplanes=${P}[pp];"
    MATE="${MATE}[sd][pp]lut2=c0='clip(255*((1-x/max(y\\,1)/${RK})-${CDLO})/(${CDHI}-${CDLO})\\,0\\,255)'[acd];"
    MATE="${MATE}[ack][acd]blend=all_mode=lighten[ak]"
  else
    MATE="${MATE}[col];[ack]null[ak]"
  fi
  # Despill solo en el borde: máscara = alfa < 250, dilatada R px y suavizada (ver POR QUÉ).
  # format=gray explícito antes de lut: si no, ffmpeg puede negociar YUV de rango limitado
  # (16-235) y la condición val<250 sería cierta en todo el cuadro → despill global (medido).
  DESP="format=gbrap,split=3[c][d][m];[d]despill=type=${PANT}:mix=0.5:expand=0[ds];"
  DESP="${DESP}[m]alphaextract,format=gray,lut=y='if(lt(val\\,250)\\,255\\,0)',${dil}gblur=sigma=1,format=gbrap[mk];"
  DESP="${DESP}[c][ds][mk]maskedmerge=planes=7"
}

# Color: [col] + alfa $1 → desmezcla C = a·F + (1-a)·K (K = clave RGB medida) y despill de borde.
# Sin desmezclar, el vidrio y el pelo semitransparentes conservan el verde de detrás (medido).
# alfa ≤ 5 → color negro (invisible; el ruido verde de fondo costaba bits: −15 % de .webm).
# Divisor ≥ 64: con alfa < 25 % la desmezcla amplificaba el ruido ×10-40 (−8 % más de .webm);
# error de composición y halo sin cambio medible (±0,03).
# gbrap = planos G, B, R, A; shuffleplanes copia el alfa a los cuatro para que lut2 lo lea como y.
color_g() {
  local um="if(lte(y\\,5)\\,0\\,if(gte(y\\,250)\\,x\\,clip((x-(1-y/255)*K)*255/max(y\\,64)\\,0\\,255)))"
  printf '[col][%s]alphamerge,split[u1][u2];[u2]shuffleplanes=3:3:3:3[aa];[u1][aa]lut2=c0=%s:c1=%s:c2=%s:c3=x,%s' \
    "$1" "'${um//K/$KG}'" "'${um//K/$KB}'" "'${um//K/$KR}'" "$DESP"
}

informar_clave() {
  echo "  · clave YUV ${KEYYUV} (borde RGB ${KEYRGB}${KEY:+, forzada $KEY}) · ruido p99.9 ${P999}"
  echo "  · similarity ${SIM} (= ${SIM_K} × ruido) · blend ${BLEND} · despill ${PANT} en ${RAD} px de borde"
  if [ "$CDLO" != 0 ]; then
    echo "  · mate de diferencia de color: rK ${RK} · rampa ${CDLO}-${CDHI} (= ${CD_K} × ruido) · desmezcla K=${KEYRGB}"
  else
    echo "  · mate de diferencia de color desactivado (CD_K=0 o pantalla poco saturada) · desmezcla K=${KEYRGB}"
  fi
  python3 -c "import sys; sys.exit(0 if float(sys.argv[1]) < 0.06 else 1)" "$SAT" \
    && warn "el borde no parece una pantalla de color (croma ${SAT}); usa KEY=0xRRGGBB"
  python3 -c "import sys; sys.exit(0 if float(sys.argv[1]) > 10 else 1)" "$FUERA" \
    && warn "${FUERA} % del borde no es pantalla (¿el sujeto toca el borde?): revisa el resultado"
  return 0
}

# --- rembg (ISNet) en un venv propio --------------------------------------------------------
REMBG_PY=""; REMBG_PROBADO=0
preparar_rembg() {
  [ $REMBG_PROBADO = 1 ] && { [ -n "$REMBG_PY" ]; return; }
  REMBG_PROBADO=1
  local v="$REMBG_HOME/venv" py c
  if [ -x "$v/bin/python" ] && "$v/bin/python" -c 'import rembg' >/dev/null 2>&1; then
    REMBG_PY="$v/bin/python"; return 0
  fi
  [ "$INSTALAR_REMBG" = 1 ] || return 1
  for c in python3.13 python3.12 python3.11 /opt/homebrew/bin/python3 /usr/local/bin/python3 python3; do
    if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)' 2>/dev/null; then
      py="$(command -v "$c")"; break
    fi
  done
  if [ -z "${py:-}" ]; then
    warn "rembg necesita Python ≥ 3.11 (brew install python@3.12); sigo solo con la clave"
    return 1
  fi
  say "Instalando rembg + ISNet en $REMBG_HOME (una sola vez, ~600 MB + modelo 179 MB)"
  mkdir -p "$REMBG_HOME"
  if "$py" -m venv "$v" && "$v/bin/pip" install -q --disable-pip-version-check "$REMBG_PIN" \
       > "$REMBG_HOME/pip.log" 2>&1 < /dev/null && "$v/bin/python" -c 'import rembg' >/dev/null 2>&1; then
    REMBG_PY="$v/bin/python"; ok "rembg listo"; return 0
  fi
  warn "no pude instalar rembg (¿sin red?; mira $REMBG_HOME/pip.log); sigo solo con la clave"
  return 1
}

mascara_isnet() {   # $1 png normalizado → $2 máscara (gris)
  U2NET_HOME="$REMBG_HOME/models" "$REMBG_PY" - "$1" "$2" <<'PY'
import sys
from PIL import Image
from rembg import new_session, remove
s = new_session("isnet-general-use")
remove(Image.open(sys.argv[1]).convert("RGB"), session=s, only_mask=True).save(sys.argv[2])
PY
}

verificar() {   # $1 fuente, resto salidas
  [ "$VERIFICAR" = 1 ] || return 0
  local src="$1"; shift
  if python3 "$HERE/verificar_alfa.py" --fuente "$src" "$@" < /dev/null; then
    ok "verificación superada"
  else
    warn "la verificación encontró problemas (arriba). Ajusta SIM_K/BLEND o KEY y repite con FORZAR=1"
    FALLOS=$((FALLOS + 1))
  fi
}

# --- un archivo ------------------------------------------------------------------------------
procesar() {
  local in="$1" tipo ext base name src_abs firma fsig salidas o
  tipo="$(tipo_de "$in")"
  [ -n "$tipo" ] || { warn "omito (extensión no soportada): $in"; return 0; }
  src_abs="$(abs_path "$in")"
  ext="$(minus "${in##*.}")"; base="$(basename "$in")"; name="${base%.*}"
  # colisión de nombres con otra entrada ya procesada en OUT → nombre_ext
  if [ -f "$OUT_ABS/.firmas/$name.firma" ] && ! head -n 2 "$OUT_ABS/.firmas/$name.firma" | grep -qxF "$src_abs"; then
    name="${name}_${ext}"
  fi
  if [ "$tipo" = video ]; then salidas="webm"; [ $WEBP = 1 ] && salidas="$salidas webp"; [ $HEVC = 1 ] && salidas="$salidas mov"
  else salidas="png"; [ $WEBP_IMG = 1 ] && salidas="$salidas webp"; fi
  for o in $salidas; do    # nunca escribir encima de la entrada
    [ "$OUT_ABS/$name.$o" = "$src_abs" ] && name="${name}_alfa"
  done
  firma="$(printf 'v%s\n%s\n%s\nKEY=%s SIM_K=%s BLEND=%s CD_K=%s CD_HI=%s CRF=%s WEBP_Q=%s MOTOR_IMG=%s HEVC=%s WEBP=%s' \
    "$VERSION" "$src_abs" "$(tam_mtime "$in")" "$KEY" "$SIM_K" "$BLEND" "$CD_K" "$CD_HI" "$CRF" "$WEBP_Q" "$MOTOR_IMG" "$HEVC" "$WEBP")"
  fsig="$OUT_ABS/.firmas/$name.firma"
  say "$base → $OUT/$name.{${salidas// /,}}"
  if [ "$FORZAR" != 1 ] && [ -f "$fsig" ] && [ "$(cat "$fsig")" = "$firma" ]; then
    local prin=webm; [ "$tipo" = imagen ] && prin=png
    if [ -s "$OUT_ABS/$name.$prin" ]; then ok "al día (sin cambios; FORZAR=1 para rehacer)"; return 0; fi
  fi
  rm -f "$TMP"/out.* "$TMP"/src.png "$TMP"/mask.png
  if [ "$tipo" = video ]; then procesar_video "$in" || return 0
  else procesar_imagen "$in" || return 0; fi
  local hechas=()
  for o in $salidas; do
    if [ -s "$TMP/out.$o" ]; then
      mv -f "$TMP/out.$o" "$OUT_ABS/$name.$o"
      hechas+=("$OUT_ABS/$name.$o")
      printf '  · %6s kB  %s\n' "$(( $(wc -c < "$OUT_ABS/$name.$o") / 1024 ))" "$OUT/$name.$o"
    fi
  done
  [ ${#hechas[@]} -gt 0 ] || { warn "no se generó ninguna salida"; FALLOS=$((FALLOS + 1)); return 0; }
  printf '%s' "$firma" > "$fsig"
  if [ "$tipo" = video ]; then verificar "$in" "${hechas[@]}"
  else verificar "$TMP/src.png" "${hechas[@]}"; fi
}

procesar_video() {
  local in="$1" g
  sondear "$in" || { warn "ffprobe no puede leer $in"; FALLOS=$((FALLOS + 1)); return 1; }
  case "$PIXFMT" in *a*p*|rgba|bgra|argb|abgr|ya*) warn "la entrada ya trae alfa ($PIXFMT): se recalcula desde el color" ;; esac
  medir_clave "$in"; cadena; informar_clave
  g="${MATE};$(color_g ak)"
  if [ $WEBP = 1 ]; then g="${g},split=2[w1][w2]"; else g="${g}[w1]"; fi
  local args=(-map "[w1]" -an -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf "$CRF" -row-mt 1
              -auto-alt-ref 0 -deadline good -cpu-used 2 "$TMP/out.webm")
  [ $WEBP = 1 ] && args+=(-map "[w2]" -an -c:v libwebp_anim -pix_fmt yuva420p -lossless 0
                          -quality "$WEBP_Q" -compression_level 4 -loop 0 "$TMP/out.webp")
  if ! ff -hide_banner -loglevel error ${ST:+-stats} -y -i "$in" -filter_complex "$g" "${args[@]}"; then
    warn "ffmpeg falló con $in"; FALLOS=$((FALLOS + 1)); return 1
  fi
  if [ $HEVC = 1 ]; then   # Safari: HEVC con alfa (VideoToolbox). -q:v solo en Apple Silicon.
    local fr="${FPS%/*}" dv="${FPS#*/}" br
    case "$fr" in ''|*[!0-9]*) fr=30 ;; esac
    case "$dv" in ''|0|*[!0-9]*) dv=1 ;; esac
    br=$(( W * H * (fr / dv) / 10000 )); [ $br -lt 800 ] && br=800   # kbit/s ≈ W·H·fps/10
    local hv=(-filter_complex "${MATE};$(color_g ak),format=bgra[h]" -map "[h]" -an -c:v hevc_videotoolbox
              -allow_sw 1 -alpha_quality 0.9 -tag:v hvc1 -movflags +faststart)
    ff -hide_banner -loglevel error -y -i "$in" "${hv[@]}" -q:v 65 "$TMP/out.mov" 2>/dev/null \
      || ff -hide_banner -loglevel error -y -i "$in" "${hv[@]}" -b:v "${br}k" "$TMP/out.mov" \
      || { warn "hevc_videotoolbox falló: sin .mov para Safari"; rm -f "$TMP/out.mov"; }
  fi
  return 0
}

procesar_imagen() {
  local in="$1" motor="$MOTOR_IMG"
  # Normaliza a PNG: rembg y ffmpeg ven exactamente los mismos píxeles (orientación, perfil).
  ff -v error -y -i "$in" -frames:v 1 -vf format=rgb24 "$TMP/src.png" \
    || { warn "no puedo leer $in"; FALLOS=$((FALLOS + 1)); return 1; }
  sondear "$TMP/src.png"; medir_clave "$TMP/src.png"; cadena; informar_clave
  if [ "$motor" != clave ]; then
    if preparar_rembg && mascara_isnet "$TMP/src.png" "$TMP/mask.png" && [ -s "$TMP/mask.png" ]; then :
    else
      [ "$motor" = isnet ] && { warn "MOTOR_IMG=isnet pero rembg no está disponible"; FALLOS=$((FALLOS + 1)); return 1; }
      warn "sin ISNet: recorte solo con la clave (chromakey + despill)"; motor=clave
    fi
  fi
  local g
  case "$motor" in
    clave) g="${MATE};$(color_g ak)" ;;
    isnet) g="${MATE};[ak]nullsink;[1:v]format=gray[am];$(color_g am)" ;;
    auto)  # máx(ISNet, clave): ISNet no puede borrar lo que la clave ve claramente no-verde;
           # mín(…, fondo seguro de la clave dilatado 1 px): fuera lo que es color de pantalla.
      g="${MATE};[ak]split[a1][a3];[1:v]format=gray[a2];"
      g="${g}[a1][a2]blend=all_mode=lighten[u];[a3]lut=y='if(gt(val\\,0)\\,255\\,0)',dilation[km];"
      g="${g}[u][km]blend=all_mode=darken[am];$(color_g am)" ;;
  esac
  echo "  · motor: $motor"
  local ins=(-i "$TMP/src.png") outs=(-map "[p]" -frames:v 1 -pix_fmt rgba "$TMP/out.png")
  [ "$motor" != clave ] && ins+=(-i "$TMP/mask.png")
  if [ $WEBP_IMG = 1 ]; then
    g="${g},split=2[p][w]"
    outs+=(-map "[w]" -frames:v 1 -c:v libwebp -pix_fmt yuva420p -lossless 0 -quality 90 "$TMP/out.webp")
  else g="${g}[p]"; fi
  ff -v error -y "${ins[@]}" -filter_complex "$g" "${outs[@]}" \
    || { warn "ffmpeg falló con $in"; FALLOS=$((FALLOS + 1)); return 1; }
  return 0
}

# --- entradas: archivos y carpetas (sin recursión; se salta OUT) ---------------------------
for arg in "$@"; do
  if [ -d "$arg" ]; then
    d_abs="$(cd "$arg" && pwd -P)"
    [ "$d_abs" = "$OUT_ABS" ] && { warn "omito la carpeta de salida $arg"; continue; }
    n=0
    # La lista llega por el descriptor 3: nada de lo que se ejecuta dentro puede comérsela por stdin.
    while IFS= read -r -d '' f <&3; do
      [ -n "$(tipo_de "$f")" ] || continue
      procesar "$f"; n=$((n + 1))
    done 3< <(find "$d_abs" -maxdepth 1 -type f ! -name '.*' -print0)
    [ $n -gt 0 ] || warn "sin videos ni imágenes en $arg"
  elif [ -f "$arg" ]; then
    procesar "$arg"
  else
    warn "no existe: $arg"; FALLOS=$((FALLOS + 1))
  fi
done

if [ $FALLOS -gt 0 ]; then die "$FALLOS archivo(s) con problemas: revisa los avisos"; fi
say "Listo → $OUT_ABS"
