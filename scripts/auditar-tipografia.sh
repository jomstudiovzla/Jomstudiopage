#!/usr/bin/env bash
# Audita la tipografía de la home y los protocolos en un Chromium real (Playwright):
# fuentes declaradas → cargadas → realmente pintadas (detecta la fuente de reserva),
# familias y pesos, marca, tamaños, interlineado, longitud de línea, contraste WCAG AA,
# texto cortado, font-display, precarga e iconos Material que enseñan su nombre.
# Veredicto PASS/WARN/FAIL por página + tipografia.json. No modifica nada de SRC.
#
# Uso (en tu Mac, dentro del clon de Jomstudiopage):
#   scripts/auditar-tipografia.sh                       # audita demos/light-concepts
#   scripts/auditar-tipografia.sh "/ruta con espacios/light-concepts"
#   scripts/auditar-tipografia.sh --solo page_06_branding.html
#   scripts/auditar-tipografia.sh --marca "Sora,JetBrains Mono"   # por defecto: la del home
#
# Usa el mismo Playwright que scripts/auditar-protocolos.sh (playwright@1.56.1 en
# ${TMPDIR}/jom-audit-node; si ya está, no instala nada). Necesita node ≥ 18 y python3.
# Variables: SRC, PORT (8090; si está ocupado prueba los siguientes), OUT (carpeta del
#            informe), MUESTRA (nodos por ancho para CDP, 400), JOM_AUDIT_PREFIX,
#            JOM_PLAYWRIGHT (usar un Playwright ya instalado).
# Sale con 1 si alguna página da FAIL, 2 si no pudo auditar.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd -P)"
PW_VERSION="1.56.1"
T="${TMPDIR:-/tmp}"; T="${T%/}"
PREFIX="${JOM_AUDIT_PREFIX:-$T/jom-audit-node}"
PORT="${PORT:-8090}"
OUT="${OUT:-$T/jom-tipografia-$(date +%Y%m%d-%H%M%S)}"
MUESTRA="${MUESTRA:-400}"
SOLO=""
MARCA=""
SERVER_PID=""

say()  { printf '\n==> %s\n' "$*"; }
die()  { printf '\n✖ %s\n' "$*" >&2; exit 2; }
warn() { printf '  ⚠ %s\n' "$*"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --solo) [ $# -ge 2 ] || die "--solo necesita un archivo"; SOLO="$2"; shift ;;
    --solo=*) SOLO="${1#--solo=}" ;;
    --marca) [ $# -ge 2 ] || die "--marca necesita una lista: \"Sora,JetBrains Mono\""; MARCA="$2"; shift ;;
    --marca=*) MARCA="${1#--marca=}" ;;
    -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;;
    -*) die "Opción desconocida: $1" ;;
    *) SRC="$1" ;;
  esac
  shift
done
if [ -z "${SRC:-}" ]; then
  if [ -d "$REPO/demos/light-concepts" ]; then SRC="$REPO/demos/light-concepts"
  else SRC="$HOME/Documents/Antigravity/JOM Studio/Portafolio/demos/light-concepts"; fi
fi

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM

preflight() {
  say "Comprobaciones"
  [ -d "$SRC" ] || die "No existe $SRC (pásalo como argumento o SRC=…)"
  SRC="$(cd "$SRC" && pwd -P)"
  if [ ! -f "$SRC/concept_master_horizontal.html" ] && [ ! -f "$SRC/index.html" ]; then
    warn "no hay concept_master_horizontal.html ni index.html: sin home no hay marca de referencia (usa --marca)"
  fi
  command -v python3 >/dev/null || die "Falta python3 (xcode-select --install)"
  command -v node >/dev/null || die "Falta node (brew install node)"
  command -v curl >/dev/null || die "Falta curl"
  local major
  major="$(node -p 'process.versions.node.split(".")[0]')"
  [ "$major" -ge 18 ] || die "node $major es viejo; Playwright $PW_VERSION pide node ≥ 18 (brew upgrade node)"
  mkdir -p "$OUT"
  echo "  · origen: $SRC"
  echo "  · informe: $OUT"
}

chromium_ok() {
  JOM_PW="$PW_DIR" node -e '
    const { chromium } = require(process.env.JOM_PW);
    chromium.launch().then((b) => b.close())
      .catch((e) => { console.error(String(e.message).split("\n")[0]); process.exit(1); });'
}

# El mismo prefijo que auditar-protocolos.sh: si ya instaló Playwright, se reutiliza.
prepare_playwright() {
  say "Playwright $PW_VERSION"
  if [ -n "${JOM_PLAYWRIGHT:-}" ]; then
    PW_DIR="$JOM_PLAYWRIGHT"
    echo "  · uso JOM_PLAYWRIGHT=$PW_DIR"
  else
    PW_DIR="$PREFIX/node_modules/playwright"
    local have=""
    if [ -f "$PW_DIR/package.json" ]; then
      have="$(JOM_PW="$PW_DIR" node -p 'require(process.env.JOM_PW + "/package.json").version' 2>/dev/null || true)"
    fi
    if [ "$have" = "$PW_VERSION" ]; then
      echo "  · reutilizo $PREFIX"
    else
      command -v npm >/dev/null || die "Falta npm (brew install node)"
      echo "  · instalando playwright@$PW_VERSION en $PREFIX (solo la primera vez)"
      mkdir -p "$PREFIX"
      [ -f "$PREFIX/package.json" ] || printf '{ "name": "jom-audit-node", "private": true }\n' > "$PREFIX/package.json"
      npm install --prefix "$PREFIX" --no-audit --no-fund --loglevel=error "playwright@$PW_VERSION" >/dev/null \
        || die "npm no pudo instalar playwright@$PW_VERSION (¿sin red?)"
    fi
  fi
  [ -f "$PW_DIR/package.json" ] || die "No encuentro Playwright en $PW_DIR"
  if ! chromium_ok >/dev/null 2>&1; then
    echo "  · descargando Chromium para Playwright (una vez, ~150 MB)"
    node "$PW_DIR/cli.js" install chromium || die "No pude instalar Chromium (¿sin red?)"
    chromium_ok || die "Chromium no arranca"
  fi
  echo "  ✔ playwright $(JOM_PW="$PW_DIR" node -p 'require(process.env.JOM_PW + "/package.json").version') · Chromium listo"
}

# Libre = nadie acepta conexiones y se puede enlazar como hace http.server (SO_REUSEADDR).
port_free() {
  python3 -I -c 'import socket, sys
p = int(sys.argv[1])
c = socket.socket(); c.settimeout(0.3)
try:
    c.connect(("127.0.0.1", p)); sys.exit(1)
except OSError:
    pass
finally:
    c.close()
s = socket.socket(); s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(("127.0.0.1", p)); s.close()' "$1" 2>/dev/null
}

serve() {
  say "Servidor local"
  local p="$PORT" i=0
  until port_free "$p"; do
    i=$((i + 1)); [ $i -lt 30 ] || die "No hay puerto libre entre $PORT y $p"
    p=$((p + 1))
  done
  [ "$p" = "$PORT" ] || warn "el puerto $PORT está ocupado; uso $p"
  PORT="$p"
  # -I: sin el directorio actual en sys.path (un http.py ajeno no se cuela).
  python3 -I -m http.server "$PORT" --bind 127.0.0.1 --directory "$SRC" >"$OUT/servidor.log" 2>&1 &
  SERVER_PID=$!
  i=0
  # --noproxy: con http_proxy definido (redes de empresa) curl no debe ir al proxy para 127.0.0.1.
  until curl -s --noproxy '*' -o /dev/null "http://127.0.0.1:$PORT/"; do
    kill -0 "$SERVER_PID" 2>/dev/null || die "El servidor se cerró (mira $OUT/servidor.log)"
    i=$((i + 1)); [ $i -lt 50 ] || die "El servidor no responde (mira $OUT/servidor.log)"
    sleep 0.2
  done
  echo "  ✔ http://127.0.0.1:$PORT → $SRC"
}

preflight
prepare_playwright
serve
set +e
# "--solo=" y "--marca=" vacíos = todas las páginas / marca del home (bash 3.2 + set -u).
JOM_PLAYWRIGHT="$PW_DIR" node "$REPO/scripts/auditar_tipografia.mjs" \
  --src "$SRC" --base "http://127.0.0.1:$PORT" --out "$OUT" --muestra "$MUESTRA" "--solo=$SOLO" "--marca=$MARCA"
rc=$?
set -e
case $rc in
  0) say "Sin FAIL tipográficos" ;;
  1) say "Hay páginas en FAIL: corrige lo de arriba antes de publicar" ;;
  *) say "La auditoría no pudo completarse (código $rc)" ;;
esac
exit $rc
