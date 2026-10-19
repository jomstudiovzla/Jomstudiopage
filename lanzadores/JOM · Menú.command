#!/bin/bash
# Doble clic: menú con todas las automatizaciones locales de JOM Studio.
D="$(cd "$(dirname "$0")" && pwd -P)"
echo "
  JOM STUDIO · automatizaciones locales (sin créditos)
  1) Ver la web en local
  2) Auditar la web
  3) Fábrica de video
  4) JOM Correo
  5) Publicar (staging / producción con confirmación)
"
printf 'Elige 1-5: '; read -r n
case "$n" in
1) exec bash "$D/01 · Ver la web en local.command" ;;
2) exec bash "$D/02 · Auditar la web.command" ;;
3) exec bash "$D/03 · Fábrica de video.command" ;;
4) exec bash "$D/04 · JOM Correo.command" ;;
5) exec bash "$D/05 · Publicar (staging y producción).command" ;;
*) echo "Nada elegido." ;;
esac
