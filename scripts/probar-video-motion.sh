#!/usr/bin/env bash
# Banco de pruebas de la cadena de video (skill jom-video-motion).
#
#   1. Genera con ffmpeg videos LIMPIOS y otros con defectos a propósito.
#   2. Comprueba que scripts/auditar_video.py marca cada defecto y deja PASS a los limpios.
#   3. Pule los defectuosos con scripts/pulir-video.sh, re-audita y muestra antes/después.
#   4. Verifica que el WebM VP9 exportado conserva el alfa (decodificando con -c:v libvpx-vp9).
#
# Uso:  scripts/probar-video-motion.sh [carpeta]      # por defecto, una carpeta temporal
#       SOLO_AUDITAR=1 scripts/probar-video-motion.sh # sin pulir (más rápido)
# Sale con 1 si algún resultado no es el esperado. No toca nada del repo.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd -P)"
AUD="$REPO/scripts/auditar_video.py"
PUL="$REPO/scripts/pulir-video.sh"
PY="${PYTHON:-python3}"
export PYTHONDONTWRITEBYTECODE=1
DIR="${1:-$(mktemp -d "${TMPDIR:-/tmp}/jom-prueba-video.XXXXXX")}"
FX="$DIR/fixtures"; OUT="$DIR/pulido"; JS="$DIR/json"
mkdir -p "$FX" "$OUT" "$JS"
SOLO_AUDITAR="${SOLO_AUDITAR:-0}"

say()  { printf '\n==> %s\n' "$*"; }
ok()   { printf '  ✔ %s\n' "$*"; }
warn() { printf '  ⚠ %s\n' "$*"; }
die()  { printf '\n✖ %s\n' "$*" >&2; exit 1; }
F() { ffmpeg -nostdin -hide_banner -loglevel error -y "$@"; }
TAGS="-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv"
X264="-c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p -movflags +faststart"
VP9A="-c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0 -row-mt 1 -b:v 0 -crf 30 -deadline good -cpu-used 4"

# Escena: degradado que gira + "personaje" dorado con movimiento periódico (período = duración).
escena() {  # W H D FPS → grafo lavfi con salida [v]
  local w="$1" h="$2" d="$3" r="$4"
  printf "gradients=s=%sx%s:r=%s:d=%s:speed=0.006:c0=0x101418:c1=0x1d3b3a:c2=0x2EC4B6:nb_colors=3:x0=0:y0=0:x1=%s:y1=%s[bg];color=c=0xC4A35A:s=%sx%s:r=%s:d=%s[p];[bg][p]overlay=x='(W-w)/2+W*0.25*sin(2*PI*t/%s)':y='(H-h)/2+H*0.04*sin(4*PI*t/%s)':shortest=1" \
    "$w" "$h" "$r" "$d" "$w" "$h" "$((w * 3 / 10))" "$((h * 4 / 10))" "$r" "$d" "$d" "$d"
}
# Personaje transparente con bordes suaves; MOV=sin → loop perfecto, MOV=lineal → la costura salta.
personaje() {  # W H D FPS MOV → grafo con salida [v] (yuva420p)
  local w="$1" h="$2" d="$3" r="$4" x
  if [ "$5" = lineal ]; then x="40+(W-w-80)*t/$d"; else x="(W-w)/2+W*0.22*sin(2*PI*t/$d)"; fi
  printf "color=c=black@0:s=%sx%s:r=%s:d=%s,format=yuva420p[bg];color=c=0xC4A35A:s=%sx%s:r=%s:d=%s,format=yuva420p,pad=iw+40:ih+40:20:20:color=black@0,boxblur=lr=0:cr=0:ar=6:ap=2[p];[bg][p]overlay=x='%s':y='(H-h)/2+H*0.03*sin(4*PI*t/%s)':format=auto,format=yuva420p" \
    "$w" "$h" "$r" "$d" "$((w * 3 / 10))" "$((h * 4 / 10))" "$r" "$d" "$x" "$d"
}
fuente_test() {
  local f
  for f in "${JOM_FUENTE_TITULAR:-}" "$HOME/Library/Fonts/Sora-Bold.ttf" "/System/Library/Fonts/Supplemental/Arial Bold.ttf" \
           "/System/Library/Fonts/Supplemental/Arial.ttf" /usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf; do
    [ -n "$f" ] && [ -f "$f" ] && { printf '%s' "$f"; return; }
  done
  return 1
}
audio_14() {  # D → genera $FX/tono.wav a −14 LUFS (mide y corrige la ganancia)
  local d="$1" i g
  F -f lavfi -i "sine=f=220:sample_rate=48000:d=$d" -f lavfi -i "sine=f=330:sample_rate=48000:d=$d" \
    -filter_complex "[0][1]amix=inputs=2,aformat=channel_layouts=stereo" "$FX/tono0.wav"
  i="$(ffmpeg -nostdin -hide_banner -i "$FX/tono0.wav" -af ebur128 -f null - 2>&1 | sed -n 's/^ *I: *\(-*[0-9.]*\) LUFS.*/\1/p' | tail -1)"
  g="$(awk -v i="$i" 'BEGIN { printf "%.2f", -14 - i }')"
  F -i "$FX/tono0.wav" -af "volume=${g}dB" "$FX/tono.wav"
}

generar() {
  say "Generando fixtures en $FX"
  local esc fnt
  audio_14 5
  esc="$(escena 1080 1920 5 30)"
  F -i "$FX/tono.wav" -filter_complex "$esc[v]" -map "[v]" -map 0:a $X264 $TAGS -c:a aac -b:a 192k -ar 48000 -shortest "$FX/limpio_social.mp4"
  F -filter_complex "$(personaje 540 960 4 30 sin)[v]" -map "[v]" $VP9A $TAGS "$FX/limpio_personaje.webm"
  F -filter_complex "$(personaje 360 640 2 24 sin)[v]" -map "[v]" -c:v libwebp_anim -quality 85 -loop 0 "$FX/limpio_ciclo_loop.webp"
  command -v webpmux >/dev/null 2>&1 && webpmux -set bgcolor 0,0,0,0 "$FX/limpio_ciclo_loop.webp" -o "$FX/limpio_ciclo_loop.webp" >/dev/null 2>&1 || true
  esc="$(escena 720 1280 5 30)"
  F -filter_complex "$esc,drawbox=enable='lt(t,0.5)+between(t,2.0,2.2)':c=black:t=fill[v]" -map "[v]" $X264 $TAGS "$FX/defecto_negros.mp4"
  F -filter_complex "$(escena 720 1280 3 30),tpad=stop_mode=clone:stop_duration=2[v]" -map "[v]" $X264 $TAGS "$FX/defecto_congelado.mp4"
  F -filter_complex "$(escena 720 1280 5 25),fps=30[v]" -map "[v]" $X264 $TAGS "$FX/defecto_tirones.mp4"
  F -filter_complex "$(escena 720 1280 4 30),setpts='if(lt(N,60),N/30,2+(N-60)/15)/TB'[v]" -map "[v]" -fps_mode passthrough $X264 $TAGS "$FX/defecto_vfr.mp4"
  F -filter_complex "$(escena 1280 720 4 30)[v]" -map "[v]" $X264 $TAGS "$FX/defecto_16x9.mp4"
  F -filter_complex "$(personaje 540 960 3 30 lineal)[v]" -map "[v]" $VP9A $TAGS "$FX/defecto_loop_salto.webm"
  F -filter_complex "$(escena 720 1280 5 30)[v]" -f lavfi -i "aevalsrc='clip(1.6*sin(2*PI*220*t)*(0.22+0.78*gt(mod(t,1),0.8)),-1,1)|clip(1.6*sin(2*PI*220*t)*(0.22+0.78*gt(mod(t,1),0.8)),-1,1)':s=48000:d=5" \
    -map "[v]" -map 0:a $X264 $TAGS -c:a aac -b:a 192k "$FX/defecto_audio.mp4"
  F -filter_complex "$(escena 1080 1440 4 30),pad=1080:1920:0:240:black[v]" -map "[v]" $X264 $TAGS "$FX/defecto_letterbox.mp4"
  F -filter_complex "$(escena 720 1280 4 50),interlace=scan=tff[v]" -map "[v]" -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p \
    -flags +ildct+ilme -x264-params tff=1 $TAGS "$FX/defecto_entrelazado.mp4"
  F -filter_complex "$(escena 720 1280 4 30),eq=brightness='0.025*mod(n,2)':eval=frame[v]" -map "[v]" $X264 $TAGS "$FX/defecto_parpadeo.mp4"
  F -filter_complex "$(escena 720 1280 4 30),eq=contrast=2.2:brightness=0.05[v]" -map "[v]" $X264 $TAGS "$FX/defecto_niveles.mp4"
  F -filter_complex "$(escena 720 1280 5 30),select='not(between(n,40,45)+between(n,95,100))',setpts=N/30/TB[v]" -map "[v]" $X264 $TAGS "$FX/defecto_saltos.mp4"
  F -filter_complex "color=c=0x00B140:s=720x1280:r=30:d=3[g];color=c=0xC4A35A:s=220x520:r=30:d=3[p];[g][p]overlay=x='(W-w)/2+120*sin(2*PI*t/3)':y=(H-h)/2[v]" \
    -map "[v]" $X264 $TAGS "$FX/defecto_verde.mp4"
  if fnt="$(fuente_test)" && ffmpeg -hide_banner -filters 2>/dev/null | grep " drawtext " >/dev/null; then
    cp "$fnt" "$FX/fuente.ttf"
    (cd "$FX" && F -i limpio_social.mp4 -vf "drawtext=fontfile=fuente.ttf:text='OFERTA HOY':fontsize=110:fontcolor=white:x=24:y=36,drawtext=fontfile=fuente.ttf:text='letra chica ilegible':fontsize=22:fontcolor=white:x=340:y=1000" \
       $X264 $TAGS -c:a copy defecto_texto.mp4)
  else
    warn "sin fuente o sin drawtext: omito el fixture de tipografía"
  fi
  ok "$(find "$FX" -type f \( -name '*.mp4' -o -name '*.webm' -o -name '*.webp' \) | wc -l | tr -d ' ') fixtures"
}

# ───────────── consultas al JSON del auditor ─────────────
consulta() {  # $1 json, $2 "veredicto" | "nivel:<id>" | "metrica:<a.b>"
  "$PY" - "$1" "$2" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1]))["archivos"][0]
q = sys.argv[2]
orden = {"FAIL": 3, "WARN": 2, "PASS": 1, "INFO": 1, "SKIP": 0}
if q == "veredicto":
    print(d["veredicto"])
elif q.startswith("nivel:"):
    cid = q[6:]
    nv = [c["nivel"] for c in d["checks"] if c["id"].startswith(cid)]
    print(max(nv, key=lambda n: orden[n]) if nv else "NONE")
else:
    v = d["metricas"]
    for k in q[8:].split("."):
        v = v.get(k) if isinstance(v, dict) else None
    print("-" if v is None else v)
EOF
}
auditar_json() {  # $1 archivo $2 perfil $3 json [extra…]
  local f="$1" p="$2" j="$3"; shift 3
  "$PY" "$AUD" --json --perfil "$p" "$@" "$f" > "$j" || true
  [ -s "$j" ] || die "el auditor no devolvió JSON para $f"
}

FILAS=""; MAL=0
fila() { FILAS="$FILAS$(printf '%-22s %-20s %-6s %-14s → %-6s %-14s %s' "$@")
"; }
esperar() {  # caso check esperado obtenido
  if [ "$3" = "$4" ] || { [ "$3" = "WARN+" ] && { [ "$4" = WARN ] || [ "$4" = FAIL ]; }; }; then ok "$1 · $2: $4 (esperado $3)"
  else printf '  ✖ %s · %s: %s (esperado %s)\n' "$1" "$2" "$4" "$3"; MAL=$((MAL + 1)); fi
}

caso() {  # nombre fixture perfil check[|check_después] esperado metrica[|metrica_después] [-- flags de pulir…]
  local n="$1" fx="$FX/$2" p="$3" chk="${4%%|*}" chk_d="${4##*|}" esp="$5" met="${6%%|*}" met_d="${6##*|}" j a am d dm v sal extra=""
  shift 6
  [ -f "$fx" ] || { warn "$n: falta $fx"; return; }
  case "$chk" in margen*|tamaño*|texto*) extra="--ocr" ;; esac
  j="$JS/$n.antes.json"; auditar_json "$fx" "$p" "$j" $extra
  a="$(consulta "$j" "nivel:$chk")"; am="$(consulta "$j" "metrica:$met")"
  esperar "$n" "$chk" "$esp" "$a"
  [ "${1:-}" = "--" ] || { fila "$n" "$chk" "$a" "$am" "-" "-" "(sin pulir: $(consulta "$j" veredicto))"; return; }
  shift
  if [ "$SOLO_AUDITAR" = 1 ]; then fila "$n" "$chk" "$a" "$am" "-" "-" "(SOLO_AUDITAR)"; return; fi
  rm -rf "${OUT:?}/$n"
  "$PUL" "$@" --sin-auditar -o "$OUT/$n" "$fx" > "$JS/$n.pulir.log" 2>&1 || { tail -5 "$JS/$n.pulir.log"; die "pulir-video.sh falló en $n"; }
  sal="$(find "$OUT/$n" -type f \( -name '*__social.mp4' -o -name '*__web.webm' \) | head -1)"
  [ -n "$sal" ] || die "$n: pulir-video.sh no dejó salida (log: $JS/$n.pulir.log)"
  j="$JS/$n.despues.json"; auditar_json "$sal" "$p" "$j" $extra
  d="$(consulta "$j" "nivel:$chk_d")"; dm="$(consulta "$j" "metrica:$met_d")"; v="$(consulta "$j" veredicto)"
  esperar "$n (pulido)" "$chk_d" "PASS" "$d"
  fila "$n" "$chk" "$a" "$am" "$d" "$dm" "final $v · $(basename "$sal")"
}

command -v ffmpeg >/dev/null 2>&1 || die "Falta ffmpeg"
generar
[ "${SOLO_GENERAR:-0}" = 1 ] && exit 0

say "Limpios: deben dar PASS"
for f in limpio_social.mp4:social-vertical limpio_personaje.webm:web-personaje limpio_ciclo_loop.webp:loop; do
  j="$JS/${f%%:*}.json"; o=""; [ "${f%%:*}" = limpio_social.mp4 ] && o="--ocr"
  auditar_json "$FX/${f%%:*}" "${f##*:}" "$j" $o
  v="$(consulta "$j" veredicto)"; esperar "${f%%:*}" "veredicto" PASS "$v"
  fila "${f%%:*}" "veredicto" "$v" "-" "-" "-" "perfil ${f##*:}"
done

say "Defectos: cada uno marcado y, si tiene receta, pulido"
caso negros        defecto_negros.mp4        social-vertical "negro en medio|fotogramas negros" FAIL  negros -- --auto
caso congelado     defecto_congelado.mp4     social-vertical "congelado al final|congelados" FAIL  congelados -- --auto
caso tirones       defecto_tirones.mp4       social-vertical "duplicados"         FAIL  tirones_por_s -- --auto
caso vfr           defecto_vfr.mp4           social-vertical "cadencia"           FAIL  vfr_irregular -- --auto
caso 16x9          defecto_16x9.mp4          social-vertical "aspecto"            FAIL  aspecto -- --auto
caso loop_salto    defecto_loop_salto.webm   loop            "costura"            FAIL  costura_ratio -- --auto --perfil loop
caso audio_lufs    defecto_audio.mp4         social-vertical "loudness"           FAIL  audio.lufs -- --auto
caso audio_tp      defecto_audio.mp4         social-vertical "true peak"          FAIL  audio.true_peak -- --normalizar-audio
caso audio_clip    defecto_audio.mp4         social-vertical "clipping"           FAIL  audio.pico_db -- --normalizar-audio
caso letterbox     defecto_letterbox.mp4     social-vertical "bandas"             FAIL  bandas_px.arriba -- --auto
caso entrelazado   defecto_entrelazado.mp4   social-vertical "entrelazado"        FAIL  entrelazado_idet -- --auto
caso parpadeo      defecto_parpadeo.mp4      social-vertical "parpadeo"           FAIL  parpadeo_rms -- --auto
caso niveles       defecto_niveles.mp4       social-vertical "niveles"            WARN+ blanco_puro -- --auto
caso saltos        defecto_saltos.mp4        social-vertical "suavidad"           FAIL  saltos
caso verde         defecto_verde.mp4         web-personaje   "canal alfa"         FAIL  "fondo_verde|alfa_cobertura_media" -- --auto --perfil web-personaje
if [ -f "$FX/defecto_texto.mp4" ]; then
  caso texto_margen defecto_texto.mp4        social-vertical "margen seguro"      FAIL  ocr_palabras
  caso texto_tamano defecto_texto.mp4        social-vertical "tamaño de texto"    FAIL  texto_alto_min_pct
  if [ "$SOLO_AUDITAR" != 1 ] && fnt="$(fuente_test)"; then
    caso texto_rotulo limpio_social.mp4      social-vertical "texto en pantalla|margen seguro" PASS  ocr_palabras -- --texto "JOM STUDIO" --fuente "$fnt"
  fi
fi

if [ "$SOLO_AUDITAR" != 1 ]; then
  say "Recetas de motion sobre el personaje transparente"
  rm -rf "$OUT/personaje"
  "$PUL" --60fps --preset web-alfa,poster --sin-auditar -o "$OUT/personaje" "$FX/limpio_personaje.webm" > "$JS/personaje.log" 2>&1 \
    || { tail -5 "$JS/personaje.log"; die "pulir-video.sh --60fps falló"; }
  w="$(find "$OUT/personaje" -name '*__web.webm' | head -1)"
  auditar_json "$w" web-personaje "$JS/personaje.json"
  esperar "personaje 60fps" "veredicto" PASS "$(consulta "$JS/personaje.json" veredicto)"
  esperar "personaje 60fps" "fps" "60.0" "$(consulta "$JS/personaje.json" metrica:fps_declarado)"
  fila "personaje --60fps" "fps" "PASS" "30.0" "PASS" "$(consulta "$JS/personaje.json" metrica:fps_declarado)" "final $(consulta "$JS/personaje.json" veredicto)"
  say "El VP9 exportado conserva el alfa (decodificando con -c:v libvpx-vp9)"
  pf="$(ffmpeg -nostdin -hide_banner -c:v libvpx-vp9 -i "$w" -frames:v 1 -f null - 2>&1 | sed -n 's/.*Video: wrapped_avframe, \([a-z0-9]*\).*/\1/p' | head -1)"
  cob="$(ffmpeg -nostdin -v error -c:v libvpx-vp9 -i "$w" -vf "alphaextract,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" -f null - \
         | sed -n 's/.*YAVG=//p' | awk '{ s += $1; n++ } END { printf "%.1f", 100 * s / n / 255 }')"
  sin="$(ffmpeg -nostdin -hide_banner -i "$w" -frames:v 1 -f null - 2>&1 | sed -n 's/.*Video: wrapped_avframe, \([a-z0-9]*\).*/\1/p' | head -1)"
  esperar "VP9 alfa" "pix_fmt con libvpx-vp9" "yuva420p" "$pf"
  if awk -v c="$cob" 'BEGIN { exit !(c > 1 && c < 99) }'; then ok "cobertura alfa media $cob % (transparente fuera del personaje)"
  else printf '  ✖ cobertura alfa %s %%\n' "$cob"; MAL=$((MAL + 1)); fi
  ok "sin -c:v libvpx-vp9 el decodificador nativo entrega $sin (por eso hay que forzarlo)"
  fila "VP9 alfa" "pix_fmt" "-" "-" "$pf" "alfa ${cob}%" "nativo: $sin"
  wp="$(find "$OUT/personaje" -name '*__web.webp' | head -1)"
  if [ -n "$wp" ]; then
    auditar_json "$wp" web-personaje "$JS/personaje_webp.json"
    esperar "WebP respaldo" "canal alfa" PASS "$(consulta "$JS/personaje_webp.json" 'nivel:canal alfa')"
    fila "WebP respaldo" "canal alfa" "-" "-" "$(consulta "$JS/personaje_webp.json" 'nivel:canal alfa')" \
      "alfa $(consulta "$JS/personaje_webp.json" metrica:alfa_cobertura_media)" "final $(consulta "$JS/personaje_webp.json" veredicto)"
  fi
  [ -n "$(find "$OUT/personaje" -name '*__poster.png' | head -1)" ] && ok "póster PNG generado" || { printf '  ✖ sin póster\n'; MAL=$((MAL + 1)); }
  rm -rf "$OUT/estab"
  "$PUL" --estabilizar --preset web-alfa --sin-auditar -o "$OUT/estab" "$FX/limpio_personaje.webm" > "$JS/estab.log" 2>&1 \
    && ok "--estabilizar con alfa: $(grep -c '✔' "$JS/estab.log") pasos ✔ ($(grep -o 'sin libvidstab' "$JS/estab.log" || echo 'vidstab presente'))" \
    || { printf '  ✖ --estabilizar falló\n'; MAL=$((MAL + 1)); }
fi

say "Resumen (antes → después)"
printf '%-22s %-20s %-6s %-14s   %-6s %-14s %s\n' "caso" "chequeo" "antes" "métrica" "desp." "métrica" "nota"
printf '%s' "$FILAS"
echo
if [ "$MAL" = 0 ]; then ok "todo como se esperaba · fixtures y salidas en $DIR"; else die "$MAL resultados inesperados · revisa $DIR"; fi
