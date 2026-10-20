#!/usr/bin/env bash
# Graba la home y los 7 protocolos EN ACCIÓN en un Chromium real (Playwright
# recordVideo) para montar videos de YouTube con scripts/montar-youtube.sh.
# Cada página tiene su coreografía (michi con hover, arena con flechas, GENERAR
# hasta "done", botones COMPILAR/PIPELINE/TOCAR/ESCANEO, cursor sobre la moneda,
# scroll suave). No modifica nada de SRC.
#
# Uso (en tu Mac, dentro del clon de Jomstudiopage):
#   scripts/grabar-protocolos.sh                         # graba demos/light-concepts a 1920×1080
#   scripts/grabar-protocolos.sh --vertical              # además 1080×1920 (para Shorts)
#   scripts/grabar-protocolos.sh --solo home,01,03       # solo esas páginas
#   scripts/grabar-protocolos.sh "/ruta con espacios/light-concepts" --salida "$HOME/Movies/JOM YouTube"
#   scripts/grabar-protocolos.sh --solo 03 --repetir 3 --duracion 40   # video de un departamento
#   scripts/grabar-protocolos.sh --solo-preparar         # solo deja listo Playwright + Chromium
#
# Opciones: --vertical · --solo-vertical · --solo LISTA · --duracion S (14 s útiles
#           por página como mínimo) · --repetir N (ciclos de coreografía, 1) ·
#           --sin-cursor · --salida DIR (./youtube-out)
# Salida:   <salida>/clips/<pagina>.webm, <salida>/clips/vertical/<pagina>.webm y
#           <salida>/clips/manifiesto.json. Si ya había clips, se renombran a
#           clips-AAAAMMDD-HHMMSS (nunca se borran).
# La primera vez instala playwright@1.56.1 en ${TMPDIR}/jom-audit-node (el mismo que
# usa auditar-protocolos.sh) y su Chromium en la caché de Playwright: nada global ni
# dentro del repo. Necesita node ≥ 18 (brew install node) y python3.
# Variables: SRC, PORT (8089), JOM_AUDIT_PREFIX, JOM_PLAYWRIGHT (usar un Playwright ya instalado).
# Sale con 1 si alguna página no cargó, 2 si no pudo grabar.
{
# Todo va entre { … } con exit dentro: bash lo lee entero antes de ejecutar, así un git pull
# que cambie este archivo en plena grabación no lo desbarata.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd -P)"
PW_VERSION="1.56.1"
T="${TMPDIR:-/tmp}"; T="${T%/}"
PREFIX="${JOM_AUDIT_PREFIX:-$T/jom-audit-node}"
PORT="${PORT:-8089}"
OUT_DIR="$PWD/youtube-out"
EXTRA=()
SOLO_PREPARAR=""
SERVER_PID=""
LOGDIR=""

say()  { printf '\n==> %s\n' "$*"; }
die()  { printf '\n✖ %s\n' "$*" >&2; exit 2; }
warn() { printf '  ⚠ %s\n' "$*"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --vertical|--solo-vertical|--sin-cursor) EXTRA+=("$1") ;;
    --solo|--duracion|--repetir)
      [ $# -ge 2 ] || die "$1 necesita un valor"; EXTRA+=("$1=$2"); shift ;;
    --solo=*|--duracion=*|--repetir=*) EXTRA+=("$1") ;;
    --salida) [ $# -ge 2 ] || die "--salida necesita una carpeta"; OUT_DIR="$2"; shift ;;
    --salida=*) OUT_DIR="${1#--salida=}" ;;
    --solo-preparar) SOLO_PREPARAR=1 ;;
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
  [ -n "$LOGDIR" ] && rm -rf "$LOGDIR"
  return 0
}
trap cleanup EXIT
trap 'exit 130' INT TERM

preflight() {
  say "Comprobaciones"
  command -v node >/dev/null || die "Falta node (brew install node)"
  local major
  major="$(node -p 'process.versions.node.split(".")[0]')"
  [ "$major" -ge 18 ] || die "node $major es viejo; Playwright $PW_VERSION pide node ≥ 18 (brew upgrade node)"
  [ -n "$SOLO_PREPARAR" ] && return 0
  [ -d "$SRC" ] || die "No existe $SRC (pásalo como argumento o SRC=…)"
  SRC="$(cd "$SRC" && pwd -P)"
  [ -f "$SRC/concept_master_horizontal.html" ] || [ -f "$SRC/index.html" ] || warn "no hay home (concept_master_horizontal.html) en $SRC"
  command -v python3 >/dev/null || die "Falta python3 (xcode-select --install)"
  command -v curl >/dev/null || die "Falta curl"
  command -v ffprobe >/dev/null || warn "no hay ffprobe (brew install ffmpeg): el manifiesto usará la duración por reloj"
  mkdir -p "$OUT_DIR" || die "No puedo crear $OUT_DIR"
  OUT_DIR="$(cd "$OUT_DIR" && pwd -P)"
  LOGDIR="$(mktemp -d "$T/jom-grabar.XXXXXX")"
  echo "  · origen: $SRC"
  echo "  · salida: $OUT_DIR/clips"
}

# Comprueba que el Chromium de ese Playwright arranca (con los args de WebGL).
chromium_ok() {
  JOM_PW="$PW_DIR" node -e '
    const { chromium } = require(process.env.JOM_PW);
    chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] })
      .then((b) => b.close())
      .catch((e) => { console.error(String(e.message).split("\n")[0]); process.exit(1); });'
}

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
    if [ "$have" != "$PW_VERSION" ]; then
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
  python3 -I -m http.server "$PORT" --bind 127.0.0.1 --directory "$SRC" >"$LOGDIR/servidor.log" 2>&1 &
  SERVER_PID=$!
  i=0
  until curl -s -o /dev/null "http://127.0.0.1:$PORT/"; do
    kill -0 "$SERVER_PID" 2>/dev/null || { cat "$LOGDIR/servidor.log" >&2; die "El servidor se cerró"; }
    i=$((i + 1)); [ $i -lt 50 ] || die "El servidor no responde"
    sleep 0.2
  done
  echo "  ✔ http://127.0.0.1:$PORT → $SRC"
}

preflight
prepare_playwright
if [ -n "$SOLO_PREPARAR" ]; then say "Playwright listo en $PW_DIR"; exit 0; fi
serve
set +e
# ${EXTRA[@]+"${EXTRA[@]}"}: array vacío sin romper set -u en bash 3.2.
JOM_PLAYWRIGHT="$PW_DIR" node "$REPO/scripts/grabar-protocolos.mjs" \
  --src "$SRC" --base "http://127.0.0.1:$PORT" --out "$OUT_DIR" ${EXTRA[@]+"${EXTRA[@]}"}
rc=$?
set -e
case $rc in
  0) say "Clips listos en $OUT_DIR/clips" ;;
  1) say "Grabado, pero alguna página no cargó bien: revisa arriba y $OUT_DIR/clips/manifiesto.json" ;;
  *) say "La grabación no pudo completarse (código $rc)" ;;
esac
exit $rc
}
