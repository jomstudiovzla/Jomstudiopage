#!/usr/bin/env bash
# Deploy JOM Studio → Cloudflare Pages (Direct Upload, sin GitHub).
# Requiere: tu login de Cloudflare (wrangler login) o CLOUDFLARE_API_TOKEN.
set -euo pipefail
cd "$(dirname "$0")"
PROJECT="${1:-jomstudio}"
# JOM_RAMA=staging → staging.jomstudio.pages.dev (ensayo); sin ella, producción (jomstudio.site).
RAMA="${JOM_RAMA:-main}"
WRANGLER="wrangler@4.145.0"
echo "==> Pre-flight: buscar placeholders sin rellenar"
[ -f js/config.js ] && grep -q "REPLACE_WITH_YOUR_TRC20_USDT_ADDRESS" js/config.js && \
  echo "⚠️  Falta tu dirección USDT TRC20 en js/config.js" || true
[ -z "$(git status --porcelain)" ] || { echo "✖ Hay cambios sin commit; se publica solo lo versionado." >&2; exit 1; }
echo "==> (1) Crear proyecto Pages (solo la 1ra vez):"
echo "     npx $WRANGLER pages project create $PROJECT --production-branch main"
echo "==> (2) Desplegar el sitio (solo archivos versionados, sin scripts/ ni docs):"
STAGE="$(mktemp -d -t jomcfXXXXXX)"
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/dist"
# core.quotepath=off: nombres reales (sin las comillas que git pone a «lanzadores/JOM · …»); fuera todo lo interno.
git -c core.quotepath=off ls-files \
  | grep -vE '^(scripts/|kit/|lanzadores/|functions/|\.claude/|\.github/|Prompt/|deploy[^/]*\.sh$|README\.md$|OPERATING\.md$|AGENTS\.md$|CURRENT_STATE\.md$|\.gitignore$|\.context_sync\.json$)|\.(docx|command)$' \
  | tar cf - -T - | (cd "$STAGE/dist" && tar xf -)
# Presentaciones de clientes: nunca en git (repo público). Se suben desde presentaciones/ (ignorada)
# solo si cada una lleva su meta de verificación y ningún correo ajeno a JOM Studio.
if [ -d presentaciones ]; then
  n=0
  for d in presentaciones/*/; do
    slug="$(basename "$d")"
    printf '%s' "$slug" | grep -qE '^[a-z0-9-]+$' || { echo "✖ slug inválido: $slug" >&2; exit 1; }
    grep -q "name=\"jom-presentacion\" content=\"$slug;verificada\"" "$d/index.html" 2>/dev/null \
      || { echo "✖ $slug sin verificar (falta la meta jom-presentacion)" >&2; exit 1; }
    if grep -rhoE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' "$d" | grep -viqE '^jomstudiovzla@gmail\.com$|@jomstudio\.site$'; then
      echo "✖ $slug contiene un correo que no es de JOM Studio" >&2; exit 1
    fi
    n=$((n+1))
  done
  mkdir -p "$STAGE/dist/presentaciones"
  cp -R presentaciones/. "$STAGE/dist/presentaciones/"
  echo "==> $n presentaciones verificadas incluidas"
fi
cp -R functions "$STAGE/functions"
(cd "$STAGE" && npx --yes "$WRANGLER" pages deploy dist --project-name="$PROJECT" --branch="$RAMA" --commit-dirty=true)
echo "==> Listo. Este upload es el que actualiza https://jomstudio.site"
echo "    El dominio ya está en el proyecto $PROJECT."
echo "    No lo muevas al proyecto git jomstudiopage: ahí no están los secretos del formulario."
