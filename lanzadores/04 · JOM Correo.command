#!/bin/bash
# Doble clic: abre el trabajo completo de JOM Correo (preparar → avisar → revisar → enviar).
# JOM Correo vive FUERA de este repo (es público): los prospectos nunca entran aquí.
source "$(dirname "$0")/_comun.sh"
for d in "$HOME/Documents/Antigravity/JOM Studio/presupuestos y automatizacion/lanzadores-mac" \
         "$HOME/Documents/Antigravity/JOM Studio/presupuestos y automatizacion/correo-automatico/lanzadores-mac"; do
  f="$d/JOM Correo · Trabajo completo.command"
  [ -f "$f" ] && exec bash "$f"
done
echo "✖ No encuentro JOM Correo. Descomprime jom-correo-automatico.tar.gz en
   «presupuestos y automatizacion/» y haz doble clic en «JOM Correo · Instalar»."
pausa_y_salir 1
