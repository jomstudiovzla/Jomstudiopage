#!/usr/bin/env bash
# Pule videos de JOM Studio sin tocar nunca los originales (salida en ./video-pulido).
#
#   scripts/pulir-video.sh <video|carpeta>... [opciones]
#   scripts/pulir-video.sh "video_1.webm" --auto                 # aplica lo que pide el auditor
#   scripts/pulir-video.sh clip.mov --loop-sin-costura --preset web-alfa,poster
#   scripts/pulir-video.sh clip.mp4 --normalizar-audio --texto "JOM STUDIO" --preset social
#
# Edición y motion (se aplican siempre en este orden):
#   --recortar-verde | --ignorar-verde   fondo verde → delega en scripts/alfa-sin-verde.sh (auto por defecto)
#   --recortar-inicio T | --recortar-fin T   segundos (1.5) o cuadros (12f)
#   --quitar-negros         corta los tramos negros (blackdetect)
#   --desentrelazar         bwdif
#   --quitar-bandas         recorta letterbox/pillarbox (cropdetect)
#   --deduplicar            quita cuadros repetidos y re-interpola la cadencia (tirones)
#   --color                 niveles suaves a rango limitado (16–235) + etiquetas bt709
#   --antiparpadeo          deflicker
#   --estabilizar           vidstab en dos pasadas (conserva el alfa)
#   --60fps[=duplicar]      interpolación de movimiento (minterpolate mci) o duplicado simple
#   --loop-sin-costura[=S]  funde el final con el inicio (S segundos, 0.5 por defecto)
#   --normalizar-audio      loudnorm en dos pasadas a −14 LUFS / −1 dBTP (+ adeclip si hay clipping)
#   --sin-audio             quita el audio
#   --texto "…"             rótulo dentro del margen seguro 9:16, con:
#        --fuente sora|mono|ruta.ttf  --posicion arriba|centro|abajo  --tamano PX  --color-texto E0E0E0
#   --cfr                   (siempre activo) cadencia constante; si la fuente es VFR se interpola
# Exportación (--preset repetible o con comas; por defecto web-alfa si hay alfa, si no social):
#   web-alfa  WebM VP9 yuva420p (-auto-alt-ref 0 -row-mt 1) + WebP animado + HEVC alfa .mov (videotoolbox)
#   social    MP4 H.264 1080×1920 yuv420p +faststart, AAC 48 kHz  [--encuadre recortar|difuminar] [--fondo 050505]
#   poster    PNG + WebP del cuadro más representativo
# Otros:
#   -o, --salida DIR   carpeta de salida (por defecto ./video-pulido). Nunca sobrescribe: añade -2, -3…
#   --auto             añade las recetas que sugiere scripts/auditar_video.py --flags-pulido
#   --perfil P         perfil del auditor: auto | web-personaje | social-vertical | loop
#   --sin-auditar      no re-audita las salidas     --conservar-master   guarda el master FFV1 sin pérdida
#   --fuentes          tipografías de marca y dónde están instaladas
# Variables: JOM_FUENTE_TITULAR, JOM_FUENTE_MONO (ruta .ttf/.otf), PYTHON (python3 por defecto).
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd -P)"
AUDITOR="$REPO/scripts/auditar_video.py"
ALFA_SIN_VERDE="$REPO/scripts/alfa-sin-verde.sh"
PY="${PYTHON:-python3}"

say()  { printf '\n==> %s\n' "$*"; }
ok()   { printf '  ✔ %s\n' "$*"; }
warn() { printf '  ⚠ %s\n' "$*"; }
die()  { printf '\n✖ %s\n' "$*" >&2; exit 1; }
usage() { sed -n '2,36p' "$0" | sed 's/^# \{0,1\}//'; }

# ───────────────────────────── opciones ─────────────────────────────
defaults() {
  SALIDA="./video-pulido"; PRESETS=""; LOOP=0; LOOP_S="0.5"; FPS60=""; ESTAB=0; NORM_AUDIO=0; COLOR=0
  TEXTO=""; FUENTE="sora"; POSICION="abajo"; TAMANO=""; COLOR_TEXTO="E0E0E0"; REC_INI=""; REC_FIN=""
  QUITAR_NEGROS=0; DEDUP=0; DEINT=0; BANDAS=0; DEFLICK=0; SIN_AUDIO=0; ENCUADRE="recortar"; FONDO="050505"
  VERDE="auto"; AUDITAR=1; AUTO=0; PERFIL="auto"; CONSERVAR=0; FUENTES=0
}
ENTRADAS=()
valor() { [ -n "$2" ] && { printf '%s' "$2"; return; }; [ -n "${3:-}" ] || die "Falta el valor de $1"; printf '%s' "$3"; }
parse() {   # $1 = 1 recoge entradas; el resto, argumentos
  local recoger="$1" a v; shift
  while [ $# -gt 0 ]; do
    a="$1"; v=""
    case "$a" in --*=*) v="${a#*=}"; a="${a%%=*}" ;; esac
    case "$a" in
      -h|--help) usage; exit 0 ;;
      -o|--salida) SALIDA="$(valor "$a" "$v" "${2:-}")"; [ -n "$v" ] || shift ;;
      --preset) PRESETS="$PRESETS $(valor "$a" "$v" "${2:-}" | tr ',' ' ')"; [ -n "$v" ] || shift ;;
      --perfil) PERFIL="$(valor "$a" "$v" "${2:-}")"; [ -n "$v" ] || shift ;;
      --recortar-inicio) REC_INI="$(valor "$a" "$v" "${2:-}")"; [ -n "$v" ] || shift ;;
      --recortar-fin) REC_FIN="$(valor "$a" "$v" "${2:-}")"; [ -n "$v" ] || shift ;;
      --texto) TEXTO="$(valor "$a" "$v" "${2:-}")"; [ -n "$v" ] || shift ;;
      --fuente) FUENTE="$(valor "$a" "$v" "${2:-}")"; [ -n "$v" ] || shift ;;
      --posicion) POSICION="$(valor "$a" "$v" "${2:-}")"; [ -n "$v" ] || shift ;;
      --tamano) TAMANO="$(valor "$a" "$v" "${2:-}")"; [ -n "$v" ] || shift ;;
      --color-texto) COLOR_TEXTO="$(valor "$a" "$v" "${2:-}" | tr -d '#')"; [ -n "$v" ] || shift ;;
      --encuadre) ENCUADRE="$(valor "$a" "$v" "${2:-}")"; [ -n "$v" ] || shift ;;
      --fondo) FONDO="$(valor "$a" "$v" "${2:-}" | tr -d '#')"; [ -n "$v" ] || shift ;;
      --loop-sin-costura) LOOP=1; [ -z "$v" ] || LOOP_S="$v" ;;
      --60fps) FPS60="${v:-mci}" ;;
      --estabilizar) ESTAB=1 ;;
      --normalizar-audio) NORM_AUDIO=1 ;;
      --color) COLOR=1 ;;
      --quitar-negros) QUITAR_NEGROS=1 ;;
      --deduplicar) DEDUP=1 ;;
      --desentrelazar) DEINT=1 ;;
      --quitar-bandas) BANDAS=1 ;;
      --antiparpadeo) DEFLICK=1 ;;
      --sin-audio) SIN_AUDIO=1 ;;
      --recortar-verde) VERDE="forzar" ;;
      --ignorar-verde) VERDE="ignorar" ;;
      --cfr) : ;;
      --auto) AUTO=1 ;;
      --sin-auditar) AUDITAR=0 ;;
      --conservar-master) CONSERVAR=1 ;;
      --fuentes) FUENTES=1 ;;
      -*) die "Opción desconocida: $a (mira --help)" ;;
      *) [ "$recoger" = 1 ] && ENTRADAS+=("$a") ;;
    esac
    shift
  done
}

# ───────────────────────────── utilidades ─────────────────────────────
calc() { awk "BEGIN { printf \"%.6f\", $* }"; }
mayor() { awk "BEGIN { exit !($1 > $2) }"; }
absoluta() { (cd "$(dirname "$1")" && printf '%s/%s' "$(pwd -P)" "$(basename "$1")"); }
unico() {   # ruta libre: nunca se sobrescribe nada
  local p="$1" base ext n=2
  [ -e "$p" ] || { printf '%s' "$p"; return; }
  base="${p%.*}"; ext="${p##*.}"
  while [ -e "$base-$n.$ext" ]; do n=$((n + 1)); done
  printf '%s' "$base-$n.$ext"
}
segundos() {   # "1.5" o "12f" → segundos
  case "$1" in
    *f) calc "${1%f} / $S_FPS" ;;
    *[!0-9.]*|"") die "Tiempo no válido: $1 (usa segundos como 1.5 o cuadros como 12f)" ;;
    *) calc "$1" ;;
  esac
}
ff() { ffmpeg -nostdin -hide_banner -loglevel error "$@"; }
# sin grep -q: con pipefail, el SIGPIPE de ffmpeg daría un falso "no está"
tiene_encoder() { ffmpeg -hide_banner -encoders 2>/dev/null | grep " $1 " >/dev/null; }
tiene_filtro() { ffmpeg -hide_banner -filters 2>/dev/null | grep " $1 " >/dev/null; }

sondear() {   # variables S_* a partir de auditar_video.py --sondear
  local out k v
  out="$("$PY" "$AUDITOR" --sondear "$1")" || die "No puedo sondear $1"
  S_TIPO=""; S_ANCHO=0; S_ALTO=0; S_FPS=0; S_FPSR=0; S_DUR=0; S_ALFA=0; S_AUDIO=0; S_DEC=""; S_VFR=0; S_MATRIZ=""; S_REPS=""
  while IFS='=' read -r k v; do
    case "$k" in
      tipo) S_TIPO="$v" ;; ancho) S_ANCHO="$v" ;; alto) S_ALTO="$v" ;; fps_decl) S_FPS="$v" ;;
      fps_real) S_FPSR="$v" ;; duracion) S_DUR="$v" ;; alfa_posible) S_ALFA="$v" ;; audio) S_AUDIO="$v" ;;
      decodificador) S_DEC="$v" ;; vfr) S_VFR="$v" ;; matriz) S_MATRIZ="$v" ;; webp_reps) S_REPS="$v" ;;
    esac
  done <<EOF
$out
EOF
  [ "$S_TIPO" = video ] || [ "$S_TIPO" = webp ] || die "$1 no es un video legible ($S_TIPO)"
  # cadencia de trabajo: la declarada; si es absurda, la real
  if ! mayor "$S_FPS" 1 || mayor "$S_FPS" 240; then S_FPS="$S_FPSR"; fi
}

resolver_fuente() {   # sora | mono | ruta → ruta de un .ttf/.otf
  local f="$1" env pats d p hit
  case "$f" in
    sora|titular|"") env="${JOM_FUENTE_TITULAR:-}"; pats="Sora-Bold.ttf Sora*Bold*.[ot]tf Sora*ExtraBold*.[ot]tf Sora*.[ot]tf" ;;
    mono|jetbrains)  env="${JOM_FUENTE_MONO:-}"; pats="JetBrainsMono-Medium.ttf JetBrainsMono*Medium*.[ot]tf JetBrainsMono*.[ot]tf" ;;
    *) [ -f "$f" ] || die "No existe la fuente $f"; printf '%s' "$f"; return ;;
  esac
  if [ -n "$env" ]; then [ -f "$env" ] || die "JOM_FUENTE_* apunta a un archivo que no existe: $env"; printf '%s' "$env"; return; fi
  for p in $pats; do
    for d in "$REPO/assets/fonts" "$REPO/demos/light-concepts/assets/fonts" "$REPO/demos/light-concepts/fonts" \
             "$HOME/Library/Fonts" "/Library/Fonts" "$HOME/.local/share/fonts" "/usr/local/share/fonts" "/usr/share/fonts"; do
      [ -d "$d" ] || continue
      hit="$(find "$d" -iname "$p" -type f 2>/dev/null | head -1)"
      [ -n "$hit" ] && { printf '%s' "$hit"; return; }
    done
  done
  return 1
}

listar_fuentes() {
  local f lc="$REPO/demos/light-concepts"
  say "Tipografías de marca"
  echo "  · web actual (index.html):  $(grep -ohE 'family=[A-Za-z+]+' "$REPO/index.html" 2>/dev/null | sed 's/family=//; s/+/ /g' | sort -u | grep -v Material | tr '\n' ',' | sed 's/,$//; s/,/, /g')"
  if [ -d "$lc" ]; then
    echo "  · web nueva (light-concepts): $(grep -ohE 'family=[A-Za-z+]+' "$lc"/*.html 2>/dev/null | sed 's/family=//; s/+/ /g' | sort -u | grep -v Material | tr '\n' ',' | sed 's/,$//; s/,/, /g')"
    echo "    font-family usados: $(grep -ohE "font-family:[^;\"]+" "$lc"/*.html "$lc"/*.css 2>/dev/null | sed 's/font-family: *//' | sort | uniq -c | sort -rn | head -4 | awk '{$1=""; print}' | tr '\n' '|' | sed 's/|$//')"
  else
    warn "demos/light-concepts no está en este checkout (vive en tu Mac): fija su fuente con JOM_FUENTE_TITULAR=/ruta/fuente.ttf"
  fi
  for f in sora mono; do
    if p="$(resolver_fuente "$f")"; then ok "$f → $p"; else warn "$f no instalada: descárgala de fonts.google.com (OFL) y ponla en ~/Library/Fonts o assets/fonts"; fi
  done
}

# ───────────────────────────── etapas ─────────────────────────────
ALFA_PIX="yuv420p"

etapa() {   # $1 nombre, $2 grafo de video, $3 grafo de audio ("" = sin audio) → $T/<n>.mkv (master FFV1 sin pérdida)
  local n="$1" g="$2" out="$T/$1.mkv" args
  args=(-y)
  # shellcheck disable=SC2206
  [ -n "$M_DEC" ] && args+=($M_DEC)
  [ -n "$3" ] && g="$g;$3"
  args+=(-i "$MASTER" -filter_complex "$g" -map "[v]")
  [ -n "$3" ] && args+=(-map "[a]" -c:a pcm_s24le)
  args+=(-c:v ffv1 -level 3 -g 1 -slices 4 -pix_fmt "$ALFA_PIX" "$out")
  (cd "$T" && ff "${args[@]}") || die "Falló la etapa '$n'"
  [ "$MASTER" = "$SRC" ] || rm -f "$MASTER"
  MASTER="$out"; M_DEC=""
}

matriz_entrada() {   # sin etiqueta: HD se asume bt709 y SD bt601 (lo mismo que hacen los reproductores)
  case "$S_MATRIZ" in
    bt709|bt470bg|smpte170m|bt2020nc|bt2020c|smpte240m|fcc) printf '%s' "$S_MATRIZ" | sed 's/bt470bg/bt601/; s/smpte170m/bt601/; s/bt2020nc/bt2020/; s/bt2020c/bt2020/' ;;
    *) if [ "$S_ANCHO" -ge 1280 ] || [ "$S_ALTO" -ge 1280 ]; then printf bt709; else printf bt601; fi ;;
  esac
}

duracion_de() { ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$1"; }

detectar_negros() {   # tramos negros del master actual → expresión para select/aselect
  local log expr="" a b
  local pre="null"
  [ "$ALFA_PIX" = yuva420p ] && pre="format=yuva420p,split[f][b];[b]drawbox=x=0:y=0:w=iw:h=ih:color=0x7F7F7F@1:t=fill,format=yuv420p[g];[g][f]overlay"
  # shellcheck disable=SC2086
  log="$(ff -loglevel info $M_DEC -i "$MASTER" -filter_complex "[0:v]$pre,blackdetect=d=0:pix_th=0.10[o]" -map "[o]" -an -f null - 2>&1 || true)"
  while read -r a b; do
    [ -n "$a" ] || continue
    expr="${expr:+$expr+}gte(t,$a)*lt(t,$b)"
  done <<EOF
$(printf '%s\n' "$log" | sed -n 's/.*black_start:\([0-9.]*\) black_end:\([0-9.]*\).*/\1 \2/p')
EOF
  printf '%s' "$expr"
}

pasada_edicion() {
  local vf="" af="" rini rfin fin crop expr tt
  [ -n "$REC_INI" ] && rini="$(segundos "$REC_INI")" || rini=""
  [ -n "$REC_FIN" ] && rfin="$(segundos "$REC_FIN")" || rfin=""
  if [ -n "$rini" ] || [ -n "$rfin" ]; then
    fin="$(calc "$S_DUR - ${rfin:-0}")"
    tt="trim=start=${rini:-0}${rfin:+:end=$fin}"
    vf="$tt,setpts=PTS-STARTPTS,"; af="a$tt,asetpts=PTS-STARTPTS,"
    ok "recorte: inicio ${rini:-0}s · fin −${rfin:-0}s"
  fi
  if [ "$DEINT" = 1 ]; then vf="${vf}bwdif=mode=send_frame:parity=auto:deint=all,"; ok "desentrelazado (bwdif)"; fi
  if [ "$BANDAS" = 1 ] && [ "$ALFA_PIX" = yuva420p ]; then
    warn "--quitar-bandas no aplica a un video con alfa (lo transparente no son bandas)"
  elif [ "$BANDAS" = 1 ]; then
    crop="$(ff -loglevel info $M_DEC -i "$MASTER" -vf "${vf}cropdetect=limit=20:round=2:reset=0" -an -f null - 2>&1 \
            | sed -n 's/.*crop=\([0-9]*:[0-9]*:[0-9]*:[0-9]*\).*/\1/p' | tail -1)"
    if [ -n "$crop" ] && [ "$crop" != "$S_ANCHO:$S_ALTO:0:0" ]; then vf="${vf}crop=$crop,"; ok "bandas negras fuera: crop=$crop"
    else warn "--quitar-bandas: no hay bandas que quitar"; fi
  fi
  if [ "$DEDUP" = 1 ]; then
    # max=2: un tirón (1–2 duplicados) se quita; una pausa larga intencionada se conserva
    vf="${vf}mpdecimate=max=2,minterpolate=fps=$S_FPS:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,"
    ok "duplicados fuera y cadencia re-interpolada a $S_FPS fps"
  elif [ "$S_VFR" = 1 ]; then
    vf="${vf}minterpolate=fps=$S_FPS:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,"
    ok "fuente VFR → $S_FPS fps constantes interpolando movimiento"
  fi
  if [ "$COLOR" = 1 ]; then
    vf="${vf}scale=in_color_matrix=$(matriz_entrada),"
    if [ "$ALFA_PIX" = yuva420p ]; then vf="${vf}format=gbrap,"; else vf="${vf}format=gbrp,"; fi
    vf="${vf}colorlevels=romin=0.02:gomin=0.02:bomin=0.02:romax=0.98:gomax=0.98:bomax=0.98,scale=out_range=tv:out_color_matrix=bt709,"
    ok "niveles suaves a rango limitado + bt709"
  fi
  if [ "$DEFLICK" = 1 ]; then vf="${vf}deflicker=size=7:mode=pm,"; ok "antiparpadeo (deflicker)"; fi
  vf="${vf}fps=$S_FPS,format=$ALFA_PIX"
  if [ "$S_AUDIO" = 1 ] && [ "$SIN_AUDIO" = 0 ]; then
    etapa edicion "[0:v]${vf}[v]" "[0:a]${af}aresample=48000[a]"
  else
    [ "$S_AUDIO" = 1 ] && ok "audio fuera (--sin-audio)"
    etapa edicion "[0:v]${vf}[v]" ""
  fi
  if [ "$QUITAR_NEGROS" = 1 ]; then
    expr="$(detectar_negros)"
    if [ -n "$expr" ]; then
      ok "tramos negros fuera: $expr"
      if [ "$S_AUDIO" = 1 ] && [ "$SIN_AUDIO" = 0 ]; then
        etapa negros "[0:v]select='not($expr)',setpts=N/($S_FPS*TB),format=${ALFA_PIX}[v]" "[0:a]aselect='not($expr)',asetpts=N/SR/TB[a]"
      else
        etapa negros "[0:v]select='not($expr)',setpts=N/($S_FPS*TB),format=${ALFA_PIX}[v]" ""
      fi
    else warn "--quitar-negros: no hay tramos negros"; fi
  fi
}

con_audio() { [ "$S_AUDIO" = 1 ] && [ "$SIN_AUDIO" = 0 ]; }

pasada_estabilizar() {
  tiene_filtro vidstabdetect || { warn "este ffmpeg no trae libvidstab: no estabilizo (brew reinstall ffmpeg)"; return; }
  (cd "$T" && ff -y -i "$MASTER" -vf "vidstabdetect=shakiness=6:accuracy=15:result=transforms.trf" -f null -) \
    || die "vidstabdetect falló"
  local tr="vidstabtransform=input=transforms.trf:smoothing=30:optzoom=1:interpol=bicubic" gv
  if [ "$ALFA_PIX" = yuva420p ]; then   # la misma transformación al color y al alfa
    gv="[0:v]split[c][a];[a]alphaextract,${tr}[am];[c]$tr,unsharp=5:5:0.6:3:3:0.3[cm];[cm][am]alphamerge,format=yuva420p[v]"
  else
    gv="[0:v]$tr,unsharp=5:5:0.6:3:3:0.3,format=yuv420p[v]"
  fi
  if con_audio; then etapa estabilizar "$gv" "[0:a]anull[a]"; else etapa estabilizar "$gv" ""; fi
  ok "estabilizado (vidstab, 2 pasadas)"
}

pasada_60fps() {
  local gv d mi="minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1"
  if [ "$FPS60" = duplicar ]; then gv="[0:v]fps=60,format=${ALFA_PIX}[v]"
  elif [ "$LOOP" = 1 ] || [ "$PERFIL" = loop ] || [ "$PERFIL" = web-personaje ] || { [ "$PERFIL" = auto ] && [ "$S_ALFA" = 1 ]; }; then
    # Ciclo: se añaden los 3 primeros cuadros al final para interpolar también la vuelta (último → primero)
    # y se recorta a la duración original. Sin esto el último cuadro interpolado falta y la costura salta 2×.
    d="$(duracion_de "$MASTER")"
    gv="[0:v]split[m][p];[p]trim=end_frame=3,setpts=PTS-STARTPTS[p1];[m][p1]concat=n=2:v=1:a=0,$mi,trim=duration=$d,setpts=PTS-STARTPTS,format=${ALFA_PIX}[v]"
  else gv="[0:v]$mi,format=${ALFA_PIX}[v]"; fi
  if con_audio; then etapa fps60 "$gv" "[0:a]anull[a]"; else etapa fps60 "$gv" ""; fi
  S_FPS=60
  ok "60 fps ($FPS60)"
}

pasada_loop() {
  local d f off
  d="$(duracion_de "$MASTER")"; f="$LOOP_S"
  mayor "$d" "$(calc "2.5 * $f")" || die "El clip ($d s) es demasiado corto para fundir $f s (usa --loop-sin-costura=0.2)"
  off="$(calc "$d - 2 * $f")"
  local gv="[0:v]split[x][y];[x]trim=start=$f,setpts=PTS-STARTPTS[x1];[y]trim=end=$f,setpts=PTS-STARTPTS[y1];[x1][y1]xfade=transition=custom:expr='A*(P*P*(3-2*P))+B*(1-P*P*(3-2*P))':duration=$f:offset=$off,format=${ALFA_PIX}[v]"
  local ga="[0:a]asplit[p][q];[p]atrim=start=$f,asetpts=PTS-STARTPTS[p1];[q]atrim=end=$f,asetpts=PTS-STARTPTS[q1];[p1][q1]acrossfade=d=$f:c1=tri:c2=tri[a]"
  if con_audio; then etapa loop "$gv" "$ga"; else etapa loop "$gv" ""; fi
  # Fundido con curva suave (smoothstep): el lineal arranca y para de golpe y el auditor ve 5 «saltos»
  # en un ciclo con movimiento lineal (medido: 5 saltos → 0 en defecto_loop_salto.webm).
  ok "loop sin costura: el final funde con el inicio (${f}s, curva suave)"
}

pasada_audio() {
  con_audio || { warn "--normalizar-audio: no hay audio"; return; }
  local j pico pre="" mi mtp mlra mth off
  pico="$(ff -loglevel info -i "$MASTER" -map 0:a:0 -af astats -f null - 2>&1 | sed -n '/Overall/,$p' | sed -n 's/.*Peak level dB: *\(-*[0-9.]*\).*/\1/p' | head -1)"
  if [ -n "$pico" ] && mayor "$pico" -0.1; then pre="adeclip,"; ok "clipping detectado (pico ${pico} dBFS): adeclip antes de normalizar"; fi
  j="$(ff -loglevel info -i "$MASTER" -map 0:a:0 -af "${pre}loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')"
  mi="$(printf '%s' "$j" | sed -n 's/.*"input_i" : "\([^"]*\)".*/\1/p')"
  mtp="$(printf '%s' "$j" | sed -n 's/.*"input_tp" : "\([^"]*\)".*/\1/p')"
  mlra="$(printf '%s' "$j" | sed -n 's/.*"input_lra" : "\([^"]*\)".*/\1/p')"
  mth="$(printf '%s' "$j" | sed -n 's/.*"input_thresh" : "\([^"]*\)".*/\1/p')"
  off="$(printf '%s' "$j" | sed -n 's/.*"target_offset" : "\([^"]*\)".*/\1/p')"
  [ -n "$mi" ] && [ "$mi" != "-inf" ] || { warn "audio mudo: no se normaliza"; return; }
  # TP −1.5: margen para que, tras AAC, el true peak siga ≤ −1 dBTP
  etapa audio "[0:v]null[v]" "[0:a]${pre}loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$mi:measured_TP=$mtp:measured_LRA=$mlra:measured_thresh=$mth:offset=$off:linear=true,aresample=48000[a]"
  ok "loudness: medido $mi LUFS / $mtp dBTP → objetivo −14 LUFS / −1.5 dBTP"
}

# ───────────────────────────── texto y exportación ─────────────────────────────
filtro_texto() {   # $1 ancho, $2 alto del cuadro final → drawtext (vacío si no hay --texto)
  [ -n "$TEXTO" ] || return 0
  local w="$1" h="$2" n fs y ml=0.06 mt=0.10 mb=0.15 lsp align=""
  [ "$h" -gt "$w" ] || { ml=0.05; mt=0.05; mb=0.05; }
  n="$(awk '{ if (length($0) > m) m = length($0) } END { print (m ? m : 1) }' "$T/texto.txt")"
  if [ -n "$TAMANO" ]; then fs="$TAMANO"
  else fs="$(awk -v w="$w" -v h="$h" -v n="$n" -v ml="$ml" 'BEGIN { a = h * 0.045; b = w * (1 - 2 * ml) * 0.92 / (0.62 * n); printf "%d", (a < b ? a : b) }')"; fi
  if awk -v f="$fs" -v h="$h" 'BEGIN { exit !(f < h * 0.026) }'; then
    warn "el rótulo queda a ${fs}px (< 2,6 % del alto): acórtalo o pártelo en líneas"
  fi
  lsp="$(awk -v f="$fs" 'BEGIN { printf "%d", f * 0.18 }')"
  case "$POSICION" in
    arriba) y="h*$mt+h*0.012" ;;
    centro) y="(h-text_h)/2" ;;
    abajo)  y="h*(1-$mb)-text_h-h*0.012" ;;
    *) die "--posicion arriba|centro|abajo" ;;
  esac
  ffmpeg -hide_banner -h filter=drawtext 2>/dev/null | grep text_align >/dev/null && align=":text_align=C"
  printf "drawtext=fontfile=fuente.ttf:textfile=texto.txt:expansion=none:fontsize=%s:fontcolor=0x%s:line_spacing=%s%s:x=(w-text_w)/2:y=%s:shadowcolor=black@0.45:shadowx=0:shadowy=%s:borderw=2:bordercolor=black@0.30," \
    "$fs" "$COLOR_TEXTO" "$lsp" "$align" "$y" "$(awk -v h="$h" 'BEGIN { printf "%d", h / 480 + 1 }')"
}

aplanar() {   # alfa → sobre el color de fondo (las redes no tienen alfa)
  [ "$ALFA_PIX" = yuva420p ] || { printf 'null'; return; }
  printf 'split[fg][b];[b]drawbox=x=0:y=0:w=iw:h=ih:color=0x%s@1:t=fill,format=yuv420p[bg];[bg][fg]overlay=format=auto' "$FONDO"
}

exportar_social() {
  local out enc fps="$S_FPS" tx g aud
  out="$(unico "$SALIDA/${NOMBRE}__social.mp4")"
  if awk -v w="$S_ANCHO" -v h="$S_ALTO" 'BEGIN { r = w / h; exit !(r > 0.5525 && r < 0.5725) }'; then
    enc="scale=1080:1920:flags=lanczos"
  elif [ "$ENCUADRE" = difuminar ]; then
    enc="split[e1][e2];[e2]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=40:2,eq=brightness=-0.06[fd];[e1]scale=1080:1920:force_original_aspect_ratio=decrease:flags=lanczos[pp];[fd][pp]overlay=(W-w)/2:(H-h)/2"
    warn "no es 9:16: encuadre con fondo difuminado"
  else
    enc="scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920"
    warn "no es 9:16 ($S_ANCHO×$S_ALTO): recorte centrado a 1080×1920 (usa --encuadre difuminar para no perder bordes)"
  fi
  mayor "$fps" 60 && fps=60
  tx="$(filtro_texto 1080 1920)"
  g="[0:v]$(aplanar)[f0];[f0]${enc}[f1];[f1]${tx}fps=$fps,scale=in_color_matrix=$(matriz_entrada):out_color_matrix=bt709:out_range=tv,format=yuv420p[v]"
  aud=(-an)
  con_audio && aud=(-map 0:a:0 -c:a aac -b:a 192k -ar 48000 -ac 2)
  (cd "$T" && ff -n -i "$MASTER" -filter_complex "$g" -map "[v]" "${aud[@]}" \
     -c:v libx264 -preset slow -crf 18 -profile:v high -pix_fmt yuv420p -g "$(awk -v f="$fps" 'BEGIN{printf "%d", 2*f}')" \
     -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -movflags +faststart "$out") || die "Falló el preset social"
  ok "social → $out"; SALIDAS_SOCIAL+=("$out")
}

exportar_web() {
  [ "$ALFA_PIX" = yuva420p ] || { warn "web-alfa: la fuente no tiene alfa (usa --recortar-verde o un original transparente); lo omito"; return; }
  local webm webp mov tx g wfps="$S_FPS"
  webm="$(unico "$SALIDA/${NOMBRE}__web.webm")"; webp="$(unico "$SALIDA/${NOMBRE}__web.webp")"
  tx="$(filtro_texto "$S_ANCHO" "$S_ALTO")"
  g="[0:v]scale=trunc(iw/2)*2:trunc(ih/2)*2,${tx}format=yuva420p[v]"
  # -auto-alt-ref 0 es obligatorio: los alt-ref de VP9 no admiten alfa
  (cd "$T" && ff -n -i "$MASTER" -filter_complex "$g" -map "[v]" -an -c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0 \
     -row-mt 1 -b:v 0 -crf 30 -deadline good -cpu-used 2 -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
     -color_range tv "$webm") || die "Falló el WebM VP9 alfa"
  ok "web → $webm"; SALIDAS_WEB+=("$webm")
  mayor "$wfps" 30 && wfps=30
  (cd "$T" && ff -n -i "$MASTER" -filter_complex "[0:v]fps=$wfps,${tx}format=yuva420p[v]" -map "[v]" -an \
     -c:v libwebp_anim -quality 80 -compression_level 6 -loop 0 "$T/web.webp") || die "Falló el WebP animado"
  if command -v webpmux >/dev/null 2>&1; then
    webpmux -set bgcolor 0,0,0,0 "$T/web.webp" -o "$webp" >/dev/null 2>&1 || cp "$T/web.webp" "$webp"
  else cp "$T/web.webp" "$webp"; warn "sin webpmux: el WebP queda con fondo de lienzo opaco declarado"; fi
  ok "web (respaldo) → $webp"; SALIDAS_WEB+=("$webp")
  if tiene_encoder hevc_videotoolbox && ffmpeg -hide_banner -h encoder=hevc_videotoolbox 2>/dev/null | grep alpha_quality >/dev/null; then
    mov="$(unico "$SALIDA/${NOMBRE}__web-hevc.mov")"
    (cd "$T" && ff -n -i "$MASTER" -filter_complex "[0:v]scale=trunc(iw/2)*2:trunc(ih/2)*2,${tx}format=bgra[v]" -map "[v]" -an \
       -c:v hevc_videotoolbox -allow_sw 1 -alpha_quality 0.75 -b:v 3M -tag:v hvc1 "$mov") \
       && { ok "Safari (HEVC alfa) → $mov"; SALIDAS_WEB+=("$mov"); } || warn "hevc_videotoolbox falló: sin .mov para Safari"
  else
    warn "sin hevc_videotoolbox (solo en macOS): no genero el .mov HEVC alfa para Safari"
  fi
}

exportar_poster() {
  local png wp tx n pf="rgb24"
  png="$(unico "$SALIDA/${NOMBRE}__poster.png")"; wp="$(unico "$SALIDA/${NOMBRE}__poster.webp")"
  n="$(ffprobe -v error -count_packets -select_streams v:0 -show_entries stream=nb_read_packets -of default=nw=1:nk=1 "$MASTER")"
  [ "${n:-0}" -gt 300 ] && n=300
  [ "$ALFA_PIX" = yuva420p ] && pf="rgba"
  tx="$(filtro_texto "$S_ANCHO" "$S_ALTO")"
  (cd "$T" && ff -n -i "$MASTER" -vf "thumbnail=n=${n:-100},${tx}format=$pf" -frames:v 1 "$png") || die "Falló el póster"
  ff -n -i "$png" -c:v libwebp -quality 85 "$wp" || warn "no pude hacer el póster WebP"
  ok "póster → $png"
}

# ───────────────────────────── por archivo ─────────────────────────────
procesar() {
  local in="$1" flags p
  in="$(absoluta "$in")"
  NOMBRE="$(basename "$in")"; NOMBRE="${NOMBRE%.*}"
  say "$NOMBRE"
  defaults
  if [ "${#ARGS[@]}" -gt 0 ]; then parse 0 "${ARGS[@]}"; fi
  if [ "$AUTO" = 1 ]; then
    flags="$("$PY" "$AUDITOR" --flags-pulido --sin-ocr --perfil "$PERFIL" "$in" || true)"
    if [ -n "$flags" ]; then
      ok "recetas del auditor: $flags"
      # shellcheck disable=SC2086
      parse 0 $flags
      parse 0 "${ARGS[@]}"      # lo que pediste a mano manda sobre lo automático
    else ok "el auditor no pide recetas"; fi
  fi
  mkdir -p "$SALIDA"; SALIDA="$(cd "$SALIDA" && pwd -P)"
  T="$(mktemp -d "${TMPDIR:-/tmp}/jom-pulir.XXXXXX")"
  trap 'rm -rf "$T"' EXIT
  sondear "$in"
  SRC="$in"
  if [ "$S_TIPO" = webp ]; then
    command -v anim_dump >/dev/null 2>&1 || die "WebP animado: falta anim_dump (brew install webp)"
    mkdir "$T/webp" "$T/webp_cfr"; anim_dump -folder "$T/webp" -prefix f_ "$in" >/dev/null 2>&1 || die "anim_dump no pudo leer $in"
    # libwebp fusiona cuadros idénticos en uno más largo: se repite cada cuadro según su duración
    # (si no, el tiempo se comprime y aparece un tirón que el original no tiene)
    local reps i=0 k=0 r png
    IFS=, read -r -a reps <<< "$S_REPS"
    for png in "$T"/webp/f_*.png; do
      r="${reps[$i]:-1}"
      while [ "$r" -gt 0 ]; do ln -s "$png" "$T/webp_cfr/$(printf 's_%05d.png' "$k")"; k=$((k + 1)); r=$((r - 1)); done
      i=$((i + 1))
    done
    ff -y -framerate "$S_FPS" -i "$T/webp_cfr/s_%05d.png" -c:v ffv1 -level 3 -pix_fmt yuva420p "$T/fuente.mkv" || die "No pude reconstruir el WebP"
    SRC="$T/fuente.mkv"; S_DEC=""; S_ALFA=1; rm -rf "$T/webp" "$T/webp_cfr"
  fi
  if [ "$S_ALFA" != 1 ] && [ "$VERDE" != ignorar ]; then
    if [ "$VERDE" = forzar ] || "$PY" "$AUDITOR" --detectar-verde "$SRC" | grep '"verde": true' >/dev/null; then
      if [ -f "$ALFA_SIN_VERDE" ]; then
        say "Fondo verde → scripts/alfa-sin-verde.sh"
        # Su interfaz: OUT=<carpeta> alfa-sin-verde.sh <entrada> → <carpeta>/<nombre>.webm (+ .webp/.mov).
        # Se ejecuta dentro de $T: nada cae en tu carpeta actual. Mide la clave y verifica el alfa él mismo.
        local rc_av=0 sv
        mkdir -p "$T/alfa"
        (cd "$T/alfa" && OUT="$T/alfa" bash "$ALFA_SIN_VERDE" "$SRC" < /dev/null) || rc_av=$?
        sv="$(find "$T/alfa" -type f -name '*.webm' | head -1)"
        [ -n "$sv" ] && [ -s "$sv" ] || die "alfa-sin-verde.sh no dejó ningún .webm (exit $rc_av)"
        [ "$rc_av" = 0 ] || warn "alfa-sin-verde.sh salió con $rc_av (su verificación avisa arriba); sigo: la re-auditoría lo vuelve a medir"
        SRC="$sv"; p="$S_AUDIO"; sondear "$SRC"
        [ "$S_ALFA" = 1 ] || die "la salida de alfa-sin-verde.sh no trae canal alfa"
        [ "$S_AUDIO" = 1 ] || { [ "$p" = 1 ] && warn "alfa-sin-verde.sh devolvió el clip sin audio"; }
        ok "fondo verde recortado por la cadena alfa-sin-verde"
      else
        warn "fondo verde detectado, pero scripts/alfa-sin-verde.sh aún no existe: no recorto (nunca chromakey de umbral fijo sin medir)"
      fi
    fi
  fi
  if [ "$S_ALFA" = 1 ]; then ALFA_PIX=yuva420p; else ALFA_PIX=yuv420p; fi
  [ -z "$PRESETS" ] && { if [ "$ALFA_PIX" = yuva420p ]; then PRESETS="web-alfa"; else PRESETS="social"; fi; }
  MASTER="$SRC"; M_DEC="$S_DEC"
  if [ -n "$TEXTO" ]; then
    p="$(resolver_fuente "$FUENTE")" || die "No encuentro la fuente '$FUENTE' (mira --fuentes o fija JOM_FUENTE_TITULAR)"
    cp "$p" "$T/fuente.ttf"; printf '%s' "$TEXTO" > "$T/texto.txt"
    ok "rótulo: \"$TEXTO\" en $(basename "$p")"
  fi

  pasada_edicion
  S_DUR="$(duracion_de "$MASTER")"
  [ "$ESTAB" = 1 ] && pasada_estabilizar
  [ -n "$FPS60" ] && pasada_60fps
  [ "$LOOP" = 1 ] && pasada_loop
  [ "$NORM_AUDIO" = 1 ] && pasada_audio
  sondear "$MASTER"; [ "$ALFA_PIX" = yuva420p ] && S_ALFA=1
  if [ "$SIN_AUDIO" = 1 ]; then S_AUDIO=0; fi

  SALIDAS_SOCIAL=(); SALIDAS_WEB=()
  local unicos="" q
  for q in $PRESETS; do case " $unicos " in *" $q "*) ;; *) unicos="$unicos $q" ;; esac; done
  for p in $unicos; do
    case "$p" in
      social) exportar_social ;; web-alfa|web) exportar_web ;; poster) exportar_poster ;;
      *) die "Preset desconocido: $p (web-alfa | social | poster)" ;;
    esac
  done
  if [ "$CONSERVAR" = 1 ]; then p="$(unico "$SALIDA/${NOMBRE}__master.mkv")"; cp "$MASTER" "$p"; ok "master sin pérdida → $p"; fi

  if [ "$AUDITAR" = 1 ]; then
    local pw="web-personaje" rc=0
    { [ "$LOOP" = 1 ] || [ "$PERFIL" = loop ]; } && pw="loop"
    if [ "${#SALIDAS_SOCIAL[@]}" -gt 0 ]; then
      say "Re-auditoría (social-vertical)"; "$PY" "$AUDITOR" --perfil social-vertical "${SALIDAS_SOCIAL[@]}" || rc=$?
    fi
    if [ "${#SALIDAS_WEB[@]}" -gt 0 ]; then
      say "Re-auditoría ($pw)"; "$PY" "$AUDITOR" --perfil "$pw" "${SALIDAS_WEB[@]}" || rc=$?
    fi
    [ "$rc" = 0 ] || warn "la re-auditoría aún marca FAIL: revisa la tabla de arriba"
  fi
  rm -rf "$T"; trap - EXIT
}

# ───────────────────────────── principal ─────────────────────────────
defaults
ARGS=("$@")
parse 1 "$@"
command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1 || die "Falta ffmpeg (brew install ffmpeg)"
command -v "$PY" >/dev/null 2>&1 || die "Falta python3 (xcode-select --install)"
[ -f "$AUDITOR" ] || die "Falta $AUDITOR"
if [ "$FUENTES" = 1 ]; then listar_fuentes; [ "${#ENTRADAS[@]}" -gt 0 ] || exit 0; fi
[ "${#ENTRADAS[@]}" -gt 0 ] || { usage; exit 2; }

SAL0="$SALIDA"
for e in "${ENTRADAS[@]}"; do
  if [ -d "$e" ]; then
    mkdir -p "$SAL0"; sal_abs="$(cd "$SAL0" && pwd -P)"
    # la lista llega por el descriptor 3: ningún comando de dentro puede comérsela por stdin
    while IFS= read -r -d '' f <&3; do
      case "$f" in "$sal_abs"/*) continue ;; esac
      procesar "$f"
    done 3< <(find "$(cd "$e" && pwd -P)" -type f \( -iname '*.mp4' -o -iname '*.mov' -o -iname '*.m4v' -o -iname '*.webm' \
               -o -iname '*.mkv' -o -iname '*.gif' -o -iname '*.webp' \) ! -name '.*' -print0)
  elif [ -f "$e" ]; then
    procesar "$e"
  else
    die "No existe: $e"
  fi
done
say "Listo. Originales intactos; todo lo nuevo está en $(cd "$SAL0" && pwd -P)"
