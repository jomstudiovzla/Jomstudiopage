#!/usr/bin/env bash
# Migra jomstudio.site a la web nueva (home horizontal + 7 disciplinas).
#
#   1. Archiva la web vieja (rama main) en un repo PRIVADO: jomstudio-legacy.
#   2. Crea/actualiza la rama de staging solo con la web nueva.
#   3. Regenera _headers (CSP con hashes), _redirects y sitemap.xml.
#   4. Hace push: Cloudflare Pages (proyecto git "jomstudiopage") publica la
#      vista previa de la rama. jomstudio.site NO cambia.
#
# Uso (en tu Mac, dentro del clon de Jomstudiopage):
#   scripts/migrar-web-nueva.sh            # migración completa
#   scripts/migrar-web-nueva.sh --watch    # además, re-publica cada cambio
#   NO_PUSH=1 scripts/migrar-web-nueva.sh  # ensayo: no toca GitHub
#
# Variables: SRC (carpeta light-concepts), BRANCH, LEGACY_REPO.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
SRC="${SRC:-$HOME/Documents/Antigravity/JOM Studio/Portafolio/demos/light-concepts}"
BRANCH="${BRANCH:-claude/sleepy-bell-kh6jlu}"
LEGACY_REPO="${LEGACY_REPO:-jomstudiovzla/jomstudio-legacy}"
NO_PUSH="${NO_PUSH:-0}"
WATCH=0
[ "${1:-}" = "--watch" ] && WATCH=1
CF_MAX_BYTES=$((25 * 1024 * 1024))   # límite por archivo de Cloudflare Pages

# Se conservan en la web nueva: infraestructura de Cloudflare y el formulario.
KEEP="scripts functions .well-known _redirects robots.txt favicon.ico .gitignore 404.html deploy.sh deploy-cloudflare.sh"

say()  { printf '\n==> %s\n' "$*"; }
die()  { printf '\n✖ %s\n' "$*" >&2; exit 1; }
warn() { printf '  ⚠ %s\n' "$*"; }

preflight() {
  say "Comprobaciones"
  [ -f "$SRC/concept_master_horizontal.html" ] || die "No encuentro $SRC/concept_master_horizontal.html (ajusta SRC=…)"
  [ -z "$(git status --porcelain)" ] || die "Hay cambios sin guardar en $ROOT. Haz commit o stash primero."
  command -v python3 >/dev/null || die "Falta python3 (xcode-select --install)"
  if [ "$NO_PUSH" != 1 ]; then command -v gh >/dev/null || die "Falta gh (brew install gh && gh auth login)"; fi

  local missing=0 p
  for p in 01_gamificacion 02_fullstack 03_arte_ia 04_automatizacion 05_audio_ugc 06_branding 07_consultoria; do
    [ -f "$SRC/page_$p.html" ] || { warn "falta page_$p.html"; missing=1; }
  done
  [ $missing = 0 ] && echo "  ✔ home + 7 disciplinas presentes"

  # Rutas que apuntan fuera de light-concepts o a tu disco: se romperían online.
  if grep -RIl --include='*.html' --include='*.js' -E 'file:///|/Users/' "$SRC" >/dev/null 2>&1; then
    warn "rutas absolutas de tu Mac (file:/// o /Users/) en:"
    grep -RIl --include='*.html' --include='*.js' -E 'file:///|/Users/' "$SRC" | sed 's/^/      /'
  fi
  if grep -RIoh --include='*.html' -E '(src|href)="\.\./[^"]+' "$SRC" 2>/dev/null | sort -u | head -20 | grep -q .; then
    warn "referencias a ../ (fuera de light-concepts); revisa que existan tras copiar:"
    grep -RIoh --include='*.html' -E '(src|href)="\.\./[^"]+' "$SRC" | sort -u | head -20 | sed 's/^/      /'
  fi

  # Archivos que Cloudflare Pages rechaza (>25 MiB).
  local big
  big="$(find "$SRC" -type f -size +"$((CF_MAX_BYTES / 1024))"k -not -path '*/_cuarentena/*' 2>/dev/null || true)"
  if [ -n "$big" ]; then
    warn "archivos >25 MiB (Cloudflare Pages no los acepta; comprímelos o súbelos a R2):"
    echo "$big" | while read -r f; do printf '      %s (%s)\n' "$f" "$(du -h "$f" | cut -f1)"; done
    die "Corrige los archivos grandes y vuelve a correr."
  fi
}

archive_legacy() {
  say "Archivar la web vieja en $LEGACY_REPO (privado)"
  git fetch origin main -q
  if [ "$NO_PUSH" = 1 ]; then echo "  (NO_PUSH) se omitiría: push de origin/main a $LEGACY_REPO"; return; fi
  gh repo view "$LEGACY_REPO" >/dev/null 2>&1 || \
    gh repo create "$LEGACY_REPO" --private --description "Web anterior de jomstudio.site (archivo)" >/dev/null
  [ "$(gh repo view "$LEGACY_REPO" --json visibility -q .visibility)" = PRIVATE ] || die "$LEGACY_REPO no es privado"
  git push -q "https://github.com/$LEGACY_REPO.git" origin/main:refs/heads/main
  git push -q "https://github.com/$LEGACY_REPO.git" "origin/main:refs/tags/web-anterior-$(date +%Y%m%d)" 2>/dev/null || true
  echo "  ✔ https://github.com/$LEGACY_REPO (main + tag web-anterior-$(date +%Y%m%d))"
}

prepare_branch() {
  say "Rama $BRANCH"
  # Desde HEAD (no desde origin/main) para no perder scripts/ a mitad de ejecución.
  if [ "$(git branch --show-current)" = "$BRANCH" ]; then :
  elif git show-ref -q "refs/heads/$BRANCH"; then git checkout -q "$BRANCH"
  elif git ls-remote -q --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
    git fetch -q origin "$BRANCH" && git checkout -q -b "$BRANCH" FETCH_HEAD
  else git checkout -q -b "$BRANCH"; fi
  [ -f scripts/build_csp.py ] || die "La rama $BRANCH no tiene scripts/; haz git pull de $BRANCH primero."
}

sync_site() {
  say "Copiar la web nueva desde $SRC"
  # Quita la web vieja salvo la lista KEEP (sigue intacta en main y en el repo legacy).
  local f keep k
  for f in $(git ls-files | cut -d/ -f1 | sort -u); do
    keep=0; for k in $KEEP; do [ "$f" = "$k" ] && keep=1; done
    [ $keep = 0 ] && git rm -rq --cached "$f" && rm -rf "$f"
  done
  (cd "$SRC" && tar cf - --exclude '.DS_Store' --exclude '_cuarentena' --exclude '.git' \
    --exclude 'node_modules' --exclude '*.3qd87sruqknyz.glb' .) | (cd "$ROOT" && tar xf -)
  cp "$ROOT/concept_master_horizontal.html" "$ROOT/index.html"
  # El 404 viene de la web vieja: que no apunte a sus assets ni a /repository.
  python3 - "$ROOT/404.html" <<'PY'
import pathlib, sys
p = pathlib.Path(sys.argv[1]); t = p.read_text(encoding="utf-8")
t = t.replace('type="image/png" href="/assets/favicon.png"', 'href="/favicon.ico"')
t = t.replace('<a href="/repository">Proyectos</a>', '<a href="/page_01_gamificacion">Protocolos</a>')
t = t.replace('<a href="/#brief">Iniciar un proyecto</a>', '')
t = t.replace("Vuelve al inicio o abre un proyecto desde el brief.", "Vuelve al inicio o abre uno de los 7 protocolos.")
p.write_text(t, encoding="utf-8")
PY
  find "$ROOT" -name '.DS_Store' -delete
  echo "  ✔ $(find "$ROOT" -type f -not -path '*/.git/*' | wc -l | tr -d ' ') archivos, $(du -sh --exclude=.git "$ROOT" 2>/dev/null | cut -f1 || du -sh "$ROOT" | cut -f1)"
}

write_meta() {
  say "Cabeceras, redirecciones y sitemap"
  python3 "$ROOT/scripts/build_csp.py" "$ROOT"
  cat > "$ROOT/_redirects" <<'EOF'
# Pages compara estas reglas por ruta, no por host.
# www → apex está en functions/_middleware.js (301).
/Jomstudiopage/*              /:splat                         301
# Rutas de la web anterior → home nuevo (evita 404 en enlaces viejos).
/services                     /                               301
/order                        /                               301
/success                      /                               301
/recursos                     /                               301
/repository                   /                               301
/admin-ops                    /                               301
/policies                     /                               301
EOF
  local today; today="$(date +%Y-%m-%d)"
  {
    echo '<?xml version="1.0" encoding="UTF-8"?>'
    echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    echo "  <url><loc>https://jomstudio.site/</loc><lastmod>$today</lastmod><priority>1.0</priority></url>"
    for f in "$ROOT"/page_0*.html; do
      [ -f "$f" ] || continue
      echo "  <url><loc>https://jomstudio.site/$(basename "$f" .html)</loc><lastmod>$today</lastmod><priority>0.8</priority></url>"
    done
    echo '</urlset>'
  } > "$ROOT/sitemap.xml"
  echo "  ✔ _headers, _redirects, sitemap.xml"
}

smoke_test() {
  say "Prueba local (puerto 8088)"
  python3 -m http.server 8088 --bind 127.0.0.1 -d "$ROOT" >/dev/null 2>&1 &
  local pid=$! ok=1 f code
  sleep 1
  for f in index.html concept_master_horizontal.html $(cd "$ROOT" && ls page_0*.html 2>/dev/null); do
    code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:8088/$f")"
    printf '  %s %s\n' "$code" "$f"; [ "$code" = 200 ] || ok=0
  done
  # Assets referenciados que no existen.
  local missing
  missing="$(cd "$ROOT" && grep -ohE '(src|href|data-src|poster)="[^"#?:]+\.(glb|webm|webp|png|jpg|jpeg|js|css|mp3|wav)"' ./*.html \
    | sed -E 's/^[a-z-]+="//; s/"$//' | sort -u | while read -r a; do [ -e "${a#/}" ] || echo "$a"; done)"
  [ -n "$missing" ] && { warn "assets referenciados que no existen:"; echo "$missing" | sed 's/^/      /'; ok=0; }
  kill $pid 2>/dev/null || true
  [ $ok = 1 ] && echo "  ✔ todo responde 200" || warn "revisa lo anterior antes de dar por buena la vista previa"
}

publish() {
  git add -A
  if git diff --cached --quiet; then echo "  (sin cambios que publicar)"; return; fi
  git commit -qm "${1:-feat(web): publica la web nueva en staging}"
  if [ "$NO_PUSH" = 1 ]; then echo "  (NO_PUSH) commit local hecho, sin push"; return; fi
  local i
  for i in 2 4 8 16; do git push -q -u origin "$BRANCH" && break; sleep $i; done
  local slug; slug="$(echo "$BRANCH" | tr '/_.' '---' | tr '[:upper:]' '[:lower:]' | cut -c1-28 | sed 's/-*$//')"
  say "Publicado. Vista previa (1–2 min): https://$slug.jomstudiopage.pages.dev"
  echo "    jomstudio.site sigue igual hasta que corras ./deploy-cloudflare.sh desde esta rama."
}

watch_loop() {
  say "Modo --watch: cada cambio en light-concepts se publica en staging (Ctrl+C para salir)"
  local last now
  last="$(find "$SRC" -type f -not -name '.DS_Store' -exec stat -f '%m %N' {} + 2>/dev/null | sort | shasum)"
  while sleep 10; do
    now="$(find "$SRC" -type f -not -name '.DS_Store' -exec stat -f '%m %N' {} + 2>/dev/null | sort | shasum)"
    [ "$now" = "$last" ] && continue
    sleep 5  # deja terminar de guardar
    last="$(find "$SRC" -type f -not -name '.DS_Store' -exec stat -f '%m %N' {} + 2>/dev/null | sort | shasum)"
    sync_site && write_meta && publish "fix(web): sincroniza cambios $(date '+%H:%M')"
  done
}

preflight
archive_legacy
prepare_branch
sync_site
write_meta
smoke_test
publish
[ $WATCH = 1 ] && watch_loop
exit 0
