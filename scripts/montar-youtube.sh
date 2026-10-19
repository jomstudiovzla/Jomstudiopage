#!/usr/bin/env bash
# Monta un video de YouTube a partir de clips (los de grabar-protocolos.sh o
# cualquiera) y deja una carpeta NUEVA lista para subir a mano a YouTube Studio:
#   video-youtube.mp4    1920×1080 H.264 yuv420p +faststart · AAC 48 kHz · −14 LUFS / −1 dBTP
#   short-youtube.mp4    1080×1920 ≤ 60 s (clips verticales si existen; si no, horizontal
#                        sobre fondo desenfocado)
#   miniatura.png        1280×720 con el título grande
#   subtitulos.es.srt    del guion (o de la voz con whisper.cpp si está instalado)
#   youtube-metadatos.txt  título, descripción con CAPÍTULOS exactos, etiquetas, Short
#   LEEME-subida.txt, montaje.json (duraciones reales, offsets, loudness, avisos)
# Intro con título y logo, rótulo inferior por departamento (Sora / JetBrains Mono si
# están; si no, fuente del sistema con aviso), transiciones xfade, música del CEO con
# ducking bajo la voz en off. Nunca sobrescribe entradas ni entregas anteriores.
#
# Uso (en tu Mac, dentro del clon de Jomstudiopage):
#   scripts/montar-youtube.sh                                  # ./youtube-out/clips
#   scripts/montar-youtube.sh --clips youtube-out/clips --guion guion.txt --musica "tema.mp3"
#   scripts/montar-youtube.sh --voz "voz en off.m4a" --voz-desde 4 --fuentes "$HOME/Library/Fonts"
#   scripts/montar-youtube.sh clip1.mp4 clip2.mov --sin-short  # clips sueltos, en ese orden
#   scripts/montar-youtube.sh --plan --guion guion.txt         # solo enseña secciones y capítulos
#
# Opciones: --clips DIR · --guion F · --musica F · --voz F · --voz-desde S · --logo PNG ·
#           --fuentes DIR · --salida DIR · --transicion fadeblack|fade|smoothleft|… ·
#           --t-transicion S (0.8) · --duracion S (12 por sección) · --sin-short ·
#           --sin-intro · --sin-cierre · --whisper-modelo F · --rapido · --plan ·
#           --conservar-temporales
# Formato del guion: .claude/skills/jom-youtube/references/guion-departamentos.md
# Necesita ffmpeg con libx264 (gratis: brew install ffmpeg-full; si tu ffmpeg no trae
# drawtext, los rótulos se pintan con el Chromium de grabar-protocolos.sh) y python3 ≥ 3.9
# (el /usr/bin/python3 del Mac sirve). Variables: JOM_FFMPEG, JOM_FUENTES, JOM_WHISPER_MODEL,
# JOM_PYTHON. Sale con 0 si entregó, 2 si no pudo.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd -P)"
PY="${JOM_PYTHON:-python3}"

say()  { printf '\n==> %s\n' "$*"; }
die()  { printf '\n✖ %s\n' "$*" >&2; exit 2; }
warn() { printf '  ⚠ %s\n' "$*"; }

case "${1:-}" in
  -h|--help)
    awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"
    exit 0 ;;
esac

command -v "$PY" >/dev/null 2>&1 || die "Falta python3 (xcode-select --install)"
"$PY" -I -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' \
  || die "Hace falta python3 ≥ 3.9 (tienes $("$PY" -V 2>&1))"
if [ -z "${JOM_FFMPEG:-}" ] && ! command -v ffmpeg >/dev/null 2>&1 \
   && [ ! -x /opt/homebrew/opt/ffmpeg-full/bin/ffmpeg ] && [ ! -x /usr/local/opt/ffmpeg-full/bin/ffmpeg ]; then
  die "Falta ffmpeg. Gratis: brew install ffmpeg-full"
fi
[ -f "$REPO/scripts/montar_youtube.py" ] || die "Falta $REPO/scripts/montar_youtube.py"

# -I: sin el directorio actual en sys.path (un json.py ajeno no se cuela).
exec "$PY" -I "$REPO/scripts/montar_youtube.py" --repo "$REPO" "$@"
