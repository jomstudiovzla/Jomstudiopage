#!/usr/bin/env bash
# Deploy JOM Studio → Cloudflare Pages (Direct Upload, sin GitHub).
# Requiere: tu login de Cloudflare (wrangler login) o CLOUDFLARE_API_TOKEN.
set -euo pipefail
cd "$(dirname "$0")"
PROJECT="${1:-jomstudio}"
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
git ls-files | grep -vE '^(scripts/|kit/|functions/|deploy[^/]*\.sh$|README\.md$|OPERATING\.md$|\.gitignore$)' \
  | tar cf - -T - | (cd "$STAGE/dist" && tar xf -)
cp -R functions "$STAGE/functions"
(cd "$STAGE" && npx --yes "$WRANGLER" pages deploy dist --project-name="$PROJECT" --branch=main --commit-dirty=true)
echo "==> Listo. Este upload es el que actualiza https://jomstudio.site"
echo "    El dominio ya está en el proyecto $PROJECT."
echo "    No lo muevas al proyecto git jomstudiopage: ahí no están los secretos del formulario."
