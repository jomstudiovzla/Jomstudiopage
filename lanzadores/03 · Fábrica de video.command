#!/bin/bash
# Doble clic: videos y Shorts 100 % locales (ffmpeg + Playwright + voz de macOS). Sin créditos.
# Salidas en _output/ del repo (ignorada por git). Nunca sobrescribe originales.
source "$(dirname "$0")/_comun.sh"
requiere ffmpeg "brew install ffmpeg"
OUTD="$REPO/_output"; mkdir -p "$OUTD"
echo "
  1) Video de YouTube 16:9 + Short 9:16 (graba los protocolos y monta)
  2) Quitar fondo verde → WebM con alfa + WebP (Safari)
  3) Pulir / exportar un video (web-alfa, redes, póster)
  4) Auditar los videos de la web (edición, loop, alfa)
  5) Video automático AHORA (elige departamento, escribe guion + hook, voz, graba, monta, audita)
  6) Programar el video automático cada semana (lunes 05:30)
  7) Ver hooks y títulos sugeridos para un departamento
"
printf 'Elige 1-7: '; read -r op
case "$op" in
1) requiere node "brew install node"
   printf '¿Departamentos? (Enter = todos; p. ej. home,01,03): '; read -r solo
   printf '¿Archivo de guion? (Enter = sin guion; arrastra el archivo aquí): '; read -r guion
   guion="${guion%\"}"; guion="${guion#\"}"; guion="$(printf '%s' "$guion" | sed "s/^'//;s/'\$//;s/\\\\ / /g")"
   if [ -z "$guion" ]; then
     guion="$OUTD/guion-$(date +%Y%m%d-%H%M).txt"
     python3 scripts/video_creativo.py guion --dpto "$( [ -n "$solo" ] && [ "${solo#*,}" = "$solo" ] && echo "$solo" || echo estudio)" --salida "$guion" --usar
   fi
   VOZ=()
   if [ -n "$guion" ] && [ -f "$guion" ] && [ -x /usr/bin/say ]; then
     printf '¿Voz en off con la voz del Mac? (s/N): '; read -r v
     if [ "$v" = s ] || [ "$v" = S ]; then
       VOZNOM="$(/usr/bin/say -v '?' | grep -E 'es_(ES|MX|VE|419|US)' | grep -Eio '^(Mónica|Monica|Paulina|Jorge|Juan|Diego)[^ ]*' | head -1)"
       grep -vE '^\s*(#|\[|---)' "$guion" > "$OUTD/voz.txt"
       /usr/bin/say ${VOZNOM:+-v "$VOZNOM"} -r 175 -f "$OUTD/voz.txt" -o "$OUTD/voz.aiff" && VOZ=(--voz "$OUTD/voz.aiff" --voz-desde 4)
       echo "  ✔ voz: ${VOZNOM:-predeterminada}"
     fi
   fi
   bash scripts/grabar-protocolos.sh "$SRC" --vertical ${solo:+--solo "$solo"} --salida "$OUTD/youtube" || pausa_y_salir 1
   bash scripts/montar-youtube.sh --clips "$OUTD/youtube/clips" ${guion:+--guion "$guion"} "${VOZ[@]}" --salida "$OUTD/videos/$(date +%Y%m%d-%H%M)" || pausa_y_salir 1
   avisar "JOM · Fábrica de video" "Video y Short listos para revisar"; open "$OUTD/videos" ;;
2) printf 'Arrastra aquí el video o carpeta con fondo verde y pulsa Enter: '; read -r ent
   ent="$(printf '%s' "$ent" | sed "s/^'//;s/'\$//;s/^\"//;s/\"\$//;s/\\\\ / /g")"
   OUT="$OUTD/alfa" bash scripts/alfa-sin-verde.sh "$ent" || pausa_y_salir 1
   avisar "JOM · Alfa" "Recorte listo"; open "$OUTD/alfa" ;;
3) printf 'Arrastra aquí el video y pulsa Enter: '; read -r ent
   ent="$(printf '%s' "$ent" | sed "s/^'//;s/'\$//;s/^\"//;s/\"\$//;s/\\\\ / /g")"
   printf 'Preset (web-alfa / social / poster) [social]: '; read -r pr
   bash scripts/pulir-video.sh --auto --preset "${pr:-social}" "$ent" || pausa_y_salir 1
   avisar "JOM · Pulido" "Video exportado" ;;
4) python3 scripts/auditar_video.py "$SRC/assets/video" --perfil web-personaje; rc=$?
   pausa_y_salir $rc ;;
5) printf '¿Departamento? (estudio, 01…07; Enter = el que toca): '; read -r dp
   DPTO="$dp" bash scripts/video-semanal.sh || pausa_y_salir 1 ;;
6) bash scripts/instalar-video-semanal.sh || pausa_y_salir 1 ;;
7) printf '¿Departamento? (estudio, 01…07): '; read -r dp
   python3 scripts/video_creativo.py hooks --dpto "${dp:-estudio}"; echo
   python3 scripts/video_creativo.py titulos --dpto "${dp:-estudio}" ;;
*) echo "Nada elegido." ;;
esac
pausa_y_salir 0
