#!/bin/bash
# Doble clic: sirve la web nueva en http://localhost:8088 y abre el home.
source "$(dirname "$0")/_comun.sh"
[ -f "$SRC/concept_master_horizontal.html" ] || { echo "✖ No encuentro $SRC/concept_master_horizontal.html"; pausa_y_salir 1; }
PORT="${PORT:-8088}"
while /usr/sbin/lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do PORT=$((PORT + 1)); done
say "Web local en http://localhost:$PORT (cierra esta ventana para apagarla)"
( sleep 1; open "http://localhost:$PORT/concept_master_horizontal.html" ) &
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$SRC"
