#!/usr/bin/env bash
# Migra jomstudio.site a la web nueva (home horizontal + 7 disciplinas).
#
#   1. Archiva la web vieja (rama main) en un repo PRIVADO: jomstudio-legacy.
#   2. Arma la rama en un git worktree APARTE (WORK). Tu carpeta del repo —donde
#      vive demos/light-concepts sin commit— no se modifica ni se borra nunca.
#   3. Regenera _headers (CSP con hashes), _redirects y sitemap.xml.
#   4. Comprime en la COPIA los GLB de más de GLB_MAX_MB (meshopt + WebP).
#      Los originales de tu Mac no se tocan nunca.
#   5. Hace push de la rama y, con --cf-preview, sube una vista previa
#      explícita a Cloudflare (proyecto jomstudio, rama "staging").
#      jomstudio.site (producción, rama main) NO cambia.
#
# Uso (en tu Mac, dentro del clon de Jomstudiopage):
#   scripts/migrar-web-nueva.sh                 # migración completa
#   scripts/migrar-web-nueva.sh --cf-preview    # + vista previa en Cloudflare
#   scripts/migrar-web-nueva.sh --watch         # + re-publica cada cambio
#   NO_PUSH=1 scripts/migrar-web-nueva.sh       # ensayo: no toca GitHub ni Cloudflare
#
# Variables: SRC (carpeta light-concepts), BRANCH, LEGACY_REPO, GLB_MAX_MB,
#            CF_PROJECT, CF_PREVIEW_BRANCH.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd -P)"     # tu checkout: solo se lee
WORK="${WORK:-${TMPDIR:-/tmp}/jom-staging-worktree}"
ROOT="$REPO"                                      # pasa a ser WORK en prepare_worktree
cd "$REPO"
if [ -z "${SRC:-}" ]; then
  if [ -d "$REPO/demos/light-concepts" ]; then SRC="$REPO/demos/light-concepts"
  else SRC="$HOME/Documents/Antigravity/JOM Studio/Portafolio/demos/light-concepts"; fi
fi
BRANCH="${BRANCH:-claude/sleepy-bell-kh6jlu}"
LEGACY_REPO="${LEGACY_REPO:-jomstudiovzla/jomstudio-legacy}"
NO_PUSH="${NO_PUSH:-0}"
WATCH=0; CF_PREVIEW=0
for arg in "$@"; do
  case "$arg" in
    --watch) WATCH=1 ;;
    --cf-preview) CF_PREVIEW=1 ;;
    *) printf 'Opción desconocida: %s\n' "$arg" >&2; exit 2 ;;
  esac
done
CF_MAX_BYTES=$((25 * 1024 * 1024))   # límite por archivo de Cloudflare Pages
GLB_MAX_MB="${GLB_MAX_MB:-10}"        # por encima se comprime la copia
GLTF_TRANSFORM="@gltf-transform/cli@4.5.1"
WRANGLER="wrangler@4.145.0"
CF_PROJECT="${CF_PROJECT:-jomstudio}"           # el que tiene los secretos del formulario
CF_PREVIEW_BRANCH="${CF_PREVIEW_BRANCH:-staging}"
# Datos privados (prospectos, presupuestos): nunca se publican ni se borran.
PRIVATE_PATTERN='presupuestos y automatizacion|presupuestos_y_automatizacion|catalogo_presentaciones'

# Se conservan en la web nueva: infraestructura de Cloudflare y el formulario.
KEEP="scripts kit functions .well-known _redirects robots.txt favicon.ico .gitignore 404.html deploy.sh deploy-cloudflare.sh"

say()  { printf '\n==> %s\n' "$*"; }
die()  { printf '\n✖ %s\n' "$*" >&2; exit 1; }
warn() { printf '  ⚠ %s\n' "$*"; }

preflight() {
  say "Comprobaciones"
  [ -f "$SRC/concept_master_horizontal.html" ] || die "No encuentro $SRC/concept_master_horizontal.html (ajusta SRC=…)"
  SRC="$(cd "$SRC" && pwd -P)"
  echo "  · origen: $SRC"
  echo "  · armado: $WORK (worktree aparte; tu carpeta no se toca)"
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

  # Pesos de los GLB (la copia se comprime más adelante si pasan de GLB_MAX_MB).
  find "$SRC" -name '*.glb' -not -path '*/_cuarentena/*' -exec ls -lh {} + 2>/dev/null \
    | awk '{printf "  · %-6s %s\n", $5, $NF}'

  # El centro de prospección enlazado desde la web quedaría público: se avisa.
  if grep -RIlE --include='*.html' --include='*.js' "$PRIVATE_PATTERN" "$SRC" >/dev/null 2>&1; then
    warn "estas páginas enlazan al centro de presupuestos/prospectos (no se publica; el enlace dará 404):"
    grep -RIlE --include='*.html' --include='*.js' "$PRIVATE_PATTERN" "$SRC" | sed 's/^/      /'
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

# Worktree desacoplado sobre la rama remota: funciona aunque tengas la rama
# abierta en tu carpeta, y nada de lo que se borra aquí existe fuera de WORK.
prepare_worktree() {
  say "Worktree de armado en $WORK"
  case "$WORK" in *jom-staging*) ;; *) die "WORK debe contener 'jom-staging' en la ruta (protección)";; esac
  if [ -e "$WORK" ]; then
    git -C "$REPO" worktree list --porcelain | grep -qxF "worktree $(cd "$WORK" && pwd -P)" \
      || die "$WORK existe y no es un worktree de este repo; no lo toco"
    git -C "$REPO" worktree remove --force "$WORK"
  fi
  local base
  if git -C "$REPO" fetch -q origin "$BRANCH" 2>/dev/null; then base=FETCH_HEAD; else base=HEAD; fi
  git -C "$REPO" worktree add -q --detach "$WORK" "$base"
  ROOT="$(cd "$WORK" && pwd -P)"
  cd "$ROOT"
  case "$SRC/" in "$ROOT"/*) die "SRC está dentro del worktree de armado";; esac
  [ -f scripts/build_csp.py ] || die "La rama $BRANCH no tiene scripts/; haz git pull de $BRANCH primero."
}

sync_site() {
  say "Copiar la web nueva desde $SRC"
  [ "$ROOT" != "$REPO" ] || die "Protección: nunca se limpia tu carpeta del repo, solo el worktree"
  # Quita la web vieja salvo la lista KEEP (sigue intacta en main y en el repo legacy).
  local f keep k
  for f in $(git ls-files | cut -d/ -f1 | sort -u); do
    keep=0; for k in $KEEP; do [ "$f" = "$k" ] && keep=1; done
    [ $keep = 0 ] && git rm -rq --cached "$f" && rm -rf "${ROOT:?}/$f"
  done
  (cd "$SRC" && tar cf - --exclude '.DS_Store' --exclude '_cuarentena' --exclude '.git' \
    --exclude 'node_modules' --exclude '*.3qd87sruqknyz.glb' \
    --exclude 'presupuestos y automatizacion' --exclude 'presupuestos_y_automatizacion' \
    --exclude 'catalogo_presentaciones*' --exclude '*.bak-kit' .) | (cd "$ROOT" && tar xf -)
  # Kit de protocolos (arena 01, estación 03): la versión de light-concepts manda.
  mkdir -p "$ROOT/assets/js"
  for f in "$ROOT"/kit/*.js; do
    [ -e "$f" ] || { warn "la rama no trae kit/ (haz git pull); sigo sin el kit"; break; }
    [ -e "$ROOT/assets/js/$(basename "$f")" ] || cp "$f" "$ROOT/assets/js/"
  done
  drop_unreferenced_duplicates
  optimize_glb
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

# Copias con timestamp (foto.jpg_20261016125342.jpg) que ninguna página usa.
drop_unreferenced_duplicates() {
  local f name n=0
  while IFS= read -r f; do
    name="$(basename "$f")"
    if ! grep -RqsF --include='*.html' --include='*.js' --include='*.css' "$name" "$ROOT"; then
      rm -f "$ROOT/$f"; n=$((n + 1))
    fi
  done < <(cd "$ROOT" && find . -type f -not -path './.git/*' | grep -E '\.(jpe?g|png|webp)_[0-9]{14}\.(jpe?g|png|webp)$' || true)
  [ $n -gt 0 ] && echo "  ✔ $n copias con timestamp sin uso, fuera de la publicación"
  return 0
}

# Comprime la COPIA de cada GLB grande. Mantiene meshopt (las páginas ya usan
# MeshoptDecoder) y pasa texturas a WebP; sin simplificar la malla.
optimize_glb() {
  local f bytes tmp before after
  while IFS= read -r f; do
    bytes="$(wc -c < "$ROOT/$f" | tr -d ' ')"
    [ "$bytes" -le $((GLB_MAX_MB * 1024 * 1024)) ] && continue
    tmp="$(mktemp -t glbXXXXXX).glb"
    before="$(du -h "$ROOT/$f" | cut -f1)"
    if npx --yes "$GLTF_TRANSFORM" optimize "$ROOT/$f" "$tmp" \
         --compress meshopt --texture-compress webp --texture-size 2048 --simplify false >/dev/null 2>&1 \
       && [ "$(wc -c < "$tmp" | tr -d ' ')" -lt "$bytes" ]; then
      mv "$tmp" "$ROOT/$f"; after="$(du -h "$ROOT/$f" | cut -f1)"
      echo "  ✔ GLB $f: $before → $after"
    else
      rm -f "$tmp"; warn "no pude comprimir $f ($before); se publica tal cual"
    fi
  done < <(cd "$ROOT" && find . -name '*.glb' -not -path './.git/*')
  local big
  big="$(cd "$ROOT" && find . -type f -not -path './.git/*' -size +"$((CF_MAX_BYTES / 1024))"k)"
  [ -z "$big" ] || die "Siguen pasando de 25 MiB (Cloudflare los rechaza): $big"
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

guard_private() {
  local leak
  leak="$(cd "$ROOT" && git ls-files --others --cached --exclude-standard | grep -iE "$PRIVATE_PATTERN" || true)"
  [ -z "$leak" ] || die "Datos privados dentro de la publicación, abortado: $leak"
}

publish() {
  guard_private
  git add -A
  if git diff --cached --quiet; then echo "  (sin cambios que publicar)"; return; fi
  git commit -qm "${1:-feat(web): publica la web nueva en staging}"
  if [ "$NO_PUSH" = 1 ]; then echo "  (NO_PUSH) commit local hecho, sin push"; return; fi
  local i
  local pushed=0
  for i in 2 4 8 16; do git push -q origin "HEAD:refs/heads/$BRANCH" && { pushed=1; break; }; sleep $i; done
  [ $pushed = 1 ] || die "No pude hacer push a $BRANCH (¿alguien empujó antes? haz git pull y repite)"
  local slug; slug="$(echo "$BRANCH" | tr '/_.' '---' | tr '[:upper:]' '[:lower:]' | cut -c1-28 | sed 's/-*$//')"
  say "Rama publicada en GitHub"
  echo "    Si Cloudflare tiene activos los despliegues de ramas del proyecto jomstudiopage:"
  echo "    https://$slug.jomstudiopage.pages.dev  (si no aparece, usa --cf-preview)"
  [ $CF_PREVIEW = 1 ] && cf_preview
  echo "    jomstudio.site sigue igual hasta que corras ./deploy-cloudflare.sh desde esta rama."
}

# Sube solo la web (sin scripts/, .git ni docs) como vista previa del proyecto
# de producción. --branch distinto de main = deployment de preview, no producción.
cf_preview() {
  [ "$CF_PREVIEW_BRANCH" != main ] || die "CF_PREVIEW_BRANCH no puede ser main (eso es producción)"
  if [ "$NO_PUSH" = 1 ]; then echo "  (NO_PUSH) se omitiría: wrangler pages deploy --branch=$CF_PREVIEW_BRANCH"; return; fi
  local stage; stage="$(mktemp -d -t jomcfXXXXXX)"
  mkdir -p "$stage/dist"
  (cd "$ROOT" && git ls-files | grep -vE '^(scripts/|kit/|functions/|deploy[^/]*\.sh$|README\.md$|OPERATING\.md$|\.gitignore$)' \
     | tar cf - -T -) | (cd "$stage/dist" && tar xf -)
  cp -R "$ROOT/functions" "$stage/functions"
  say "Vista previa en Cloudflare ($CF_PROJECT, rama $CF_PREVIEW_BRANCH)"
  (cd "$stage" && npx --yes "$WRANGLER" pages deploy dist --project-name="$CF_PROJECT" \
     --branch="$CF_PREVIEW_BRANCH" --commit-dirty=true)
  echo "    URL: https://$CF_PREVIEW_BRANCH.$CF_PROJECT.pages.dev"
  rm -rf "$stage"
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
    sync_site && write_meta && publish "fix(web): sincroniza cambios $(date '+%H:%M')" \
      || warn "esta ronda falló; sigo vigilando"
  done
}

preflight
archive_legacy
prepare_worktree
sync_site
write_meta
smoke_test
publish
echo "    Tu carpeta $REPO quedó igual. Para actualizarla: git pull origin $BRANCH"
[ $WATCH = 1 ] && watch_loop
exit 0
