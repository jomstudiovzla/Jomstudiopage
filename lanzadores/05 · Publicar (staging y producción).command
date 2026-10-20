#!/bin/bash
# Doble clic: integra el kit, ensaya la migración, y publica SOLO con tu confirmación:
#   1) staging.jomstudio.pages.dev  (escribe s)
#   2) jomstudio.site               (escribe PUBLICAR, después de revisar staging)
source "$(dirname "$0")/_comun.sh"
requiere npx "brew install node"
say "1/3 · Integrar kit y ensayo (no toca GitHub ni Cloudflare)"
bash scripts/integrar-kit.sh || pausa_y_salir 1
NO_PUSH=1 bash scripts/migrar-web-nueva.sh || pausa_y_salir 1
printf '\n¿Subo a STAGING (repo privado legacy + rama + staging.jomstudio.pages.dev)? (s/N): '; read -r s
[ "$s" = s ] || [ "$s" = S ] || pausa_y_salir 0
say "2/3 · Staging"
bash scripts/migrar-web-nueva.sh --cf-preview || pausa_y_salir 1
avisar "JOM · Staging" "Lista en staging.jomstudio.pages.dev"
printf '\nRevisa https://staging.jomstudio.pages.dev . Para PRODUCCIÓN escribe PUBLICAR (otra cosa = no): '; read -r p
[ "$p" = PUBLICAR ] || { echo "  Producción sin tocar."; pausa_y_salir 0; }
say "3/3 · Producción (jomstudio.site)"
W="${TMPDIR:-/tmp}/jom-staging-worktree"
( cd "$W" && bash deploy-cloudflare.sh ) || pausa_y_salir 1
avisar "JOM · Producción" "jomstudio.site actualizado"
pausa_y_salir 0
