#!/usr/bin/env bash
# Deploy JOM Studio → Cloudflare Pages (Direct Upload, sin GitHub).
# Requiere: tu login de Cloudflare (wrangler login) o CLOUDFLARE_API_TOKEN.
set -euo pipefail
cd "$(dirname "$0")"
PROJECT="${1:-jomstudio}"
echo "==> Pre-flight: buscar placeholders sin rellenar"
grep -q "REPLACE_WITH_YOUR_TRC20_USDT_ADDRESS" js/config.js && \
  echo "⚠️  Falta tu dirección USDT TRC20 en js/config.js" || true
echo "==> (1) Crear proyecto Pages (solo la 1ra vez):"
echo "     npx wrangler pages project create $PROJECT --production-branch main"
echo "==> (2) Desplegar el sitio:"
npx wrangler pages deploy . --project-name="$PROJECT"
echo "==> Listo. Este upload es el que actualiza https://jomstudio.site"
echo "    El dominio ya está en el proyecto $PROJECT."
echo "    No lo muevas al proyecto git jomstudiopage: ahí no están los secretos del formulario."
