#!/usr/bin/env bash
# Fábrica semanal de video de JOM Studio (100 % local, sin créditos).
# Cada ejecución: elige el departamento que toca (rota estudio → 01 … 07), escribe
# guion + hook + título (scripts/video_creativo.py), pone voz con «say», graba los
# protocolos (grabar-protocolos.sh), monta video 16:9 + Short + miniatura + capítulos
# (montar-youtube.sh), lo audita y te avisa. NUNCA sube nada: lo revisas y lo subes tú.
#
#   scripts/video-semanal.sh                 # el departamento que toca
#   DPTO=03 scripts/video-semanal.sh         # uno concreto
#   scripts/instalar-video-semanal.sh        # programarlo (lunes 05:30 por defecto)
set -uo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd -P)"
cd "$REPO"
SRC="${SRC:-$REPO/demos/light-concepts}"
OUTD="${JOM_VIDEO_OUT:-$HOME/Documents/Antigravity/JOM Studio/videos-youtube}"
PY="${JOM_PYTHON:-python3}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

say_() { printf '\n==> %s\n' "$*"; }
avisar() {  # Mac + correo a ti mismo con la config de JOM Correo si está instalado
  [ -x /usr/bin/osascript ] && /usr/bin/osascript -e 'on run argv
display notification (item 2 of argv) with title (item 1 of argv) sound name "Glass"
end run' "$1" "$2" >/dev/null 2>&1
  local app="$HOME/Library/Application Support/JOMCorreo"
  [ -f "$app/nucleo/avisos.py" ] && "$PY" - "$app" "$1" "$2" "${3:-}" <<'PY' 2>/dev/null
import sys; sys.path.insert(0, sys.argv[1])
import os
from nucleo import avisos, config, credenciales
cfg = config.cargar(os.path.join(sys.argv[1], "config.json"))
if True:
    avisos.OSA = "/no/repetir"  # la notificación del Mac ya se mostró arriba
    avisos.avisar(cfg, credenciales.backend(cfg).obtener, "[Video] " + sys.argv[2], sys.argv[3], sys.argv[4])
PY
  return 0
}

[ -f "$SRC/concept_master_horizontal.html" ] || { avisar "Video semanal" "No encuentro la web en $SRC"; exit 1; }
command -v ffmpeg >/dev/null || { avisar "Video semanal" "Falta ffmpeg (brew install ffmpeg)"; exit 1; }

DPTO="${DPTO:-$("$PY" scripts/video_creativo.py siguiente --usar)}"
FECHA="$(date +%Y%m%d-%H%M)"
DEST="$OUTD/$FECHA-$DPTO"
TRAB="$DEST/trabajo"
mkdir -p "$TRAB"
say_ "Departamento $DPTO → $DEST"

"$PY" scripts/video_creativo.py guion --dpto "$DPTO" --salida "$DEST/guion.txt" --usar || exit 1
"$PY" scripts/video_creativo.py hooks --dpto "$DPTO" --n 6 > "$DEST/hooks-alternativos.txt"
"$PY" scripts/video_creativo.py titulos --dpto "$DPTO" --n 6 > "$DEST/titulos-alternativos.txt"

VOZ=()
if [ -x /usr/bin/say ]; then
  VOZNOM="$(/usr/bin/say -v '?' 2>/dev/null | grep -E 'es_(ES|MX|VE|419|US)' | grep -Eio '^(Mónica|Monica|Paulina|Jorge|Juan|Diego)[^ ]*' | head -1)"
  sed -n 's/^texto: //p' "$DEST/guion.txt" > "$TRAB/voz.txt"
  /usr/bin/say ${VOZNOM:+-v "$VOZNOM"} -r 175 -f "$TRAB/voz.txt" -o "$TRAB/voz.aiff" && VOZ=(--voz "$TRAB/voz.aiff" --voz-desde 4)
fi

SOLO="$DPTO"; [ "$DPTO" = estudio ] && SOLO=""
REP=1; [ "$DPTO" != estudio ] && REP=3
bash scripts/grabar-protocolos.sh "$SRC" --vertical ${SOLO:+--solo "home,$SOLO"} --repetir "$REP" --salida "$TRAB/grabacion" \
  || { avisar "Video semanal" "Falló la grabación de $DPTO"; exit 1; }
MUS=()
for m in "$OUTD/musica/"*.mp3 "$OUTD/musica/"*.m4a; do [ -f "$m" ] && { MUS=(--musica "$m"); break; }; done
bash scripts/montar-youtube.sh --clips "$TRAB/grabacion/clips" --guion "$DEST/guion.txt" "${VOZ[@]}" "${MUS[@]}" --salida "$DEST/entrega" \
  || { avisar "Video semanal" "Falló el montaje de $DPTO"; exit 1; }

say_ "Auditoría"
"$PY" scripts/auditar_video.py "$DEST/entrega/short-youtube.mp4" --perfil social-vertical > "$DEST/auditoria.txt" 2>&1
RES="$(grep -E '^Resumen' "$DEST/auditoria.txt" | tail -1)"
rm -rf "$TRAB/grabacion/clips/vertical" 2>/dev/null
avisar "Video listo para revisar" "Dpto $DPTO · ${RES:-auditoría hecha}" "$DEST/entrega"
[ -x /usr/bin/open ] && /usr/bin/open "$DEST/entrega" 2>/dev/null
echo "✔ $DEST/entrega  ($RES)"
