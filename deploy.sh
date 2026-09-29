#!/usr/bin/env bash
# jomstudio.site vive en Cloudflare Pages, proyecto "jomstudio" (direct upload).
# Un git push actualiza GitHub y el proyecto git jomstudiopage.pages.dev.
# No actualiza el dominio. Este script no hace commit ni push.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "==> Publicar https://jomstudio.site"
echo "    Proyecto Cloudflare: jomstudio"
echo "    Este script no ejecuta git add, git commit ni git push."
echo ""

exec "$ROOT/deploy-cloudflare.sh" "$@"
