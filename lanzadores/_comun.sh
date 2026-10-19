#!/bin/bash
# Base de los lanzadores de doble clic (.command). bash 3.2 de macOS, rutas con espacios.
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
SRC="${SRC:-$REPO/demos/light-concepts}"
LOG_DIR="${JOM_LOG_DIR:-$HOME/Library/Logs/JOMStudio}"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/$(basename "$0" .command | tr ' ·' '__')-$(date +%Y%m%d-%H%M%S).log"
cd "$REPO" || exit 1
exec > >(tee -a "$LOG") 2>&1

say()  { printf '\n==> %s\n' "$*"; }
warn() { printf '  ⚠ %s\n' "$*"; }
# Aviso en el Mac (texto por argv, nunca interpolado en AppleScript).
avisar() {
  [ -x /usr/bin/osascript ] || return 0
  /usr/bin/osascript -e 'on run argv
display notification (item 2 of argv) with title (item 1 of argv) sound name "Glass"
end run' "$1" "$2" >/dev/null 2>&1 || true
}
pausa_y_salir() {
  printf '\nRegistro: %s\n' "$LOG"
  if [ -t 0 ]; then printf 'Pulsa Enter para cerrar… '; read -r _; fi
  exit "${1:-0}"
}
requiere() { command -v "$1" >/dev/null 2>&1 || { printf '✖ Falta %s. Instálalo con: %s\n' "$1" "$2"; pausa_y_salir 1; }; }
