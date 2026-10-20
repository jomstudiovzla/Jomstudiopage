#!/bin/bash
# Doble clic: audita home + 7 protocolos (HTTP, consola, 404, CSP, menú ☰ a 375 px,
# funciones) y la tipografía. No publica nada.
source "$(dirname "$0")/_comun.sh"
requiere node "brew install node"
rc=0
say "1/2 · Protocolos";  bash scripts/auditar-protocolos.sh "$SRC" || rc=1
say "2/2 · Tipografía";  bash scripts/auditar-tipografia.sh "$SRC" || rc=1
if [ $rc = 0 ]; then avisar "JOM · Auditoría" "Todo en verde"; echo "✔ Sin FAIL"
else avisar "JOM · Auditoría" "Hay FAIL: revisa el informe"; echo "✖ Hay FAIL (arriba el detalle)"; fi
pausa_y_salir $rc
