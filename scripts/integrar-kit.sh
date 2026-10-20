#!/usr/bin/env bash
# Integra kit/jom-arena.js (Protocolo 01) y kit/jom-workstation.js (Protocolo 03)
# en tu carpeta light-concepts. Idempotente: si ya están, no repite nada.
# Antes de tocar un HTML guarda una copia <archivo>.bak-kit.
#
#   scripts/integrar-kit.sh            # aplica y muestra el diff
#   DRY_RUN=1 scripts/integrar-kit.sh  # solo muestra qué cambiaría
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd -P)"
SRC="${SRC:-$REPO/demos/light-concepts}"
DRY_RUN="${DRY_RUN:-0}"
[ -d "$SRC" ] || { echo "✖ No existe $SRC (ajusta SRC=…)" >&2; exit 1; }

python3 - "$REPO" "$SRC" "$DRY_RUN" <<'PY'
import difflib, pathlib, shutil, sys

repo, src, dry = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]), sys.argv[3] == "1"
js_dir = src / "assets" / "js"

for name in ("jom-arena.js", "jom-workstation.js"):
    dst = js_dir / name
    new = (repo / "kit" / name).read_bytes()
    if dst.exists() and dst.read_bytes() == new:
        print(f"= {dst.relative_to(src)} ya al día")
        continue
    print(f"+ {dst.relative_to(src)}")
    if not dry:
        js_dir.mkdir(parents=True, exist_ok=True)
        dst.write_bytes(new)

def patch(page, script, host=None, marker=None):
    p = src / page
    if not p.exists():
        print(f"⚠ falta {page}; no se integra")
        return
    old = p.read_text(encoding="utf-8")
    txt = old
    tag = f'<script type="module" src="assets/js/{script}"></script>'
    if script not in txt:
        i = txt.lower().rfind("</body>")
        if i < 0:
            print(f"⚠ {page} no tiene </body>; añade a mano: {tag}")
            return
        txt = txt[:i] + f"  <!-- jom-kit -->\n  {tag}\n" + txt[i:]
    if host and marker not in txt:
        # Sin hueco marcado: el host va al final de <main> (o antes del script).
        block = f"  <!-- jom-kit: muévelo donde quieras la estación -->\n  {host}\n"
        j = txt.lower().rfind("</main>")
        if j < 0:
            j = txt.find("  <!-- jom-kit -->")
        if j < 0:
            j = txt.lower().rfind("</body>")
        txt = txt[:j] + block + txt[j:]
    if txt == old:
        print(f"= {page} ya integrado")
        return
    sys.stdout.writelines(difflib.unified_diff(old.splitlines(True), txt.splitlines(True), f"a/{page}", f"b/{page}", n=1))
    if not dry:
        shutil.copy2(p, p.with_name(p.name + ".bak-kit"))
        p.write_text(txt, encoding="utf-8")

# Protocolo 01: sin host explícito, la arena se superpone a #gameCanvas.
page01 = src / "page_01_gamificacion.html"
if page01.exists() and 'id="gameCanvas"' not in page01.read_text(encoding="utf-8") and "data-jom-arena" not in page01.read_text(encoding="utf-8"):
    patch("page_01_gamificacion.html", "jom-arena.js",
          '<div data-jom-arena data-model="assets/personajes/juego_3d.glb" style="height:min(70vh,520px)"></div>', "data-jom-arena")
else:
    patch("page_01_gamificacion.html", "jom-arena.js")
patch("page_03_arte_ia.html", "jom-workstation.js", "<div data-jom-workstation></div>", "data-jom-workstation")
print("(ensayo: no se escribió nada)" if dry else "✔ listo. Prueba: python3 -m http.server 8088 -d \"%s\"" % src)
PY
