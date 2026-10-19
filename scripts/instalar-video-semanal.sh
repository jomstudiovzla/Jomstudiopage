#!/usr/bin/env bash
# Programa la fábrica semanal de video con launchd (sin créditos, en tu Mac).
#   scripts/instalar-video-semanal.sh                 # lunes 05:30
#   DIA=3 HORA=6 MIN=0 scripts/instalar-video-semanal.sh   # miércoles 06:00 (DIA: 1=lun … 7=dom)
#   scripts/instalar-video-semanal.sh --desinstalar
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd -P)"
ETQ="site.jomstudio.video.semanal"
PL="$HOME/Library/LaunchAgents/$ETQ.plist"
UIDN="$(id -u)"
launchctl bootout "gui/$UIDN/$ETQ" >/dev/null 2>&1 || launchctl unload "$PL" >/dev/null 2>&1 || true
if [ "${1:-}" = "--desinstalar" ]; then rm -f "$PL"; echo "✔ Video semanal desinstalado."; exit 0; fi
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs/JOMStudio"
DIA="${DIA:-1}"; HORA="${HORA:-5}"; MIN="${MIN:-30}"
/usr/bin/python3 - "$PL" "$ETQ" "$REPO" "$DIA" "$HORA" "$MIN" "$HOME" <<'PY'
import plistlib, sys
pl, etq, repo, dia, hora, minuto, home = sys.argv[1:]
d = {"Label": etq,
     "ProgramArguments": ["/usr/bin/caffeinate", "-i", "/bin/bash", repo + "/scripts/video-semanal.sh"],
     "WorkingDirectory": repo,
     "StartCalendarInterval": {"Weekday": int(dia) % 7, "Hour": int(hora), "Minute": int(minuto)},
     "StandardOutPath": home + "/Library/Logs/JOMStudio/video-semanal.log",
     "StandardErrorPath": home + "/Library/Logs/JOMStudio/video-semanal.err.log",
     "EnvironmentVariables": {"PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"}}
with open(pl, "wb") as f:
    plistlib.dump(d, f)
PY
plutil -lint "$PL" >/dev/null
launchctl bootstrap "gui/$UIDN" "$PL" 2>/dev/null || launchctl load -w "$PL"
echo "✔ Programado: cada semana (día $DIA) a las $(printf '%02d:%02d' "$HORA" "$MIN"). Registro: ~/Library/Logs/JOMStudio/video-semanal.log"
echo "  Probar ahora: launchctl kickstart gui/$UIDN/$ETQ"
