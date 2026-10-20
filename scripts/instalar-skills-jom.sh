#!/usr/bin/env bash
# Instala el orquestador JOM Estudio en tu Mac para TODOS tus proyectos de Claude:
#   1. Copia los skills jom-* del repo (.claude/skills/jom-*) a ~/.claude/skills/
#      y, si existe Antigravity, también a ~/.gemini/config/skills/.
#   2. Copia scripts/jom-estado.py y scripts/hooks/jom-no-parar.py a ~/.claude/jom/.
#   3. Fusiona el Stop hook «no parar hasta terminar» en ~/.claude/settings.json
#      (con copia .bak; conserva tus hooks, incluido stop-hook-git-check.sh).
#   4. Te pregunta (s/N) si añade un bloque <!-- jom-estudio --> en
#      "~/Documents/Antigravity/JOM Studio/AGENTS.md" (con copia de seguridad).
# Idempotente: repetirlo no duplica nada. No toca .context_sync.json ni CURRENT_STATE.md.
#
# Uso (en tu Mac, dentro del clon de Jomstudiopage):
#   bash scripts/instalar-skills-jom.sh                 # instalar o actualizar
#   bash scripts/instalar-skills-jom.sh --desinstalar   # quitarlo todo (con copias)
#   Opciones: --agents-md | --sin-agents-md (responder sin preguntar) · --sin-hook
# Variables: CLAUDE_DIR (~/.claude), GEMINI_SKILLS (~/.gemini/config/skills),
#            JOM_STUDIO_DIR (~/Documents/Antigravity/JOM Studio), PYTHON (python3).
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd -P)"
CLAUDE_DIR="${CLAUDE_DIR:-$HOME/.claude}"
GEMINI_SKILLS="${GEMINI_SKILLS:-$HOME/.gemini/config/skills}"
JOM_STUDIO_DIR="${JOM_STUDIO_DIR:-$HOME/Documents/Antigravity/JOM Studio}"
PYTHON="${PYTHON:-python3}"
JOM_DIR="$CLAUDE_DIR/jom"
SETTINGS="$CLAUDE_DIR/settings.json"
STAMP="$(date +%Y%m%d-%H%M%S)"
MARCA=".jom-instalado"
MODO=instalar; AGENTS=preguntar; HOOK=1

say()  { printf '\n==> %s\n' "$*"; }
ok()   { printf '  ✔ %s\n' "$*"; }
warn() { printf '  ⚠ %s\n' "$*"; }
die()  { printf '\n✖ %s\n' "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --desinstalar) MODO=desinstalar ;;
    --agents-md) AGENTS=si ;;
    --sin-agents-md) AGENTS=no ;;
    --sin-hook) HOOK=0 ;;
    -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;;
    *) die "Opción desconocida: $1 (mira --help)" ;;
  esac
  shift
done

command -v "$PYTHON" >/dev/null 2>&1 || die "Falta python3 (xcode-select --install)"
# Antes de copiar nada: si settings.json existe y no es JSON válido, no se toca nada.
if [ "$HOOK" = 1 ] && [ -f "$SETTINGS" ]; then
  "$PYTHON" -c 'import json,sys; json.load(open(sys.argv[1], encoding="utf-8"))' "$SETTINGS" 2>/dev/null \
    || die "$SETTINGS no es JSON válido: no instalo nada. Corrígelo (o usa --sin-hook) y repite."
fi

# Comando del hook: con ~ (la expansión de ~ no se parte aunque tu HOME tenga espacios).
if [ "$CLAUDE_DIR" = "$HOME/.claude" ]; then
  HOOK_CMD='python3 ~/.claude/jom/jom-no-parar.py'
else
  HOOK_CMD="python3 $("$PYTHON" -c 'import shlex,sys; print(shlex.quote(sys.argv[1]))' "$JOM_DIR/jom-no-parar.py")"
fi

# ---------------------------------------------------------------- skills
copiar_skill() {  # copiar_skill <origen> <carpeta destino de skills>
  local src="${1%/}" base dest name
  base="$2"; name="$(basename "$src")"; dest="$base/$name"
  mkdir -p "$base"
  if [ -d "$dest" ] && [ ! -f "$dest/$MARCA" ]; then
    # No es nuestro: se guarda FUERA de la carpeta de skills (si no, se cargaría duplicado).
    mkdir -p "$JOM_DIR/respaldos/skills-$STAMP"
    mv "$dest" "$JOM_DIR/respaldos/skills-$STAMP/$name"
    warn "$dest ya existía y no lo instalé yo: lo moví a $JOM_DIR/respaldos/skills-$STAMP/$name"
  fi
  rm -rf "$dest.tmp-jom"
  cp -R "$src" "$dest.tmp-jom"
  printf 'instalado por scripts/instalar-skills-jom.sh\norigen: %s\nfecha: %s\n' "$src" "$STAMP" > "$dest.tmp-jom/$MARCA"
  find "$dest.tmp-jom" -type f \( -name '*.py' -o -name '*.sh' \) -exec chmod 755 {} \;
  rm -rf "$dest"
  mv "$dest.tmp-jom" "$dest"
  ok "$name → $dest"
}

instalar_skills() {
  say "Skills jom-* para Claude Code (globales)"
  local n=0 d
  for d in "$REPO"/.claude/skills/jom-*/; do
    [ -f "${d}SKILL.md" ] || continue
    copiar_skill "$d" "$CLAUDE_DIR/skills"; n=$((n + 1))
  done
  [ "$n" -gt 0 ] || die "No encuentro skills en $REPO/.claude/skills/jom-*/ (¿git pull de la rama?)"
  say "Antigravity (~/.gemini/config/skills)"
  if [ -d "$GEMINI_SKILLS" ]; then
    for d in "$REPO"/.claude/skills/jom-*/; do
      [ -f "${d}SKILL.md" ] && copiar_skill "$d" "$GEMINI_SKILLS"
    done
  else
    warn "no existe $GEMINI_SKILLS: Antigravity no detectado, se omite (el bloque de AGENTS.md también le sirve)"
  fi
}

quitar_skills() {
  local base d name
  for base in "$CLAUDE_DIR/skills" "$GEMINI_SKILLS"; do
    [ -d "$base" ] || continue
    for d in "$base"/jom-*/; do
      [ -d "$d" ] || continue
      d="${d%/}"; name="$(basename "$d")"
      if [ -f "$d/$MARCA" ]; then rm -rf "$d"; ok "quitado $d"
      else warn "$d no lo instaló este script: lo dejo"; fi
    done
  done
}

# ---------------------------------------------------------------- herramientas
instalar_herramientas() {
  say "Estado y hook en $JOM_DIR"
  [ -f "$REPO/scripts/jom-estado.py" ] || die "Falta $REPO/scripts/jom-estado.py"
  [ -f "$REPO/scripts/hooks/jom-no-parar.py" ] || die "Falta $REPO/scripts/hooks/jom-no-parar.py"
  mkdir -p "$JOM_DIR"
  cp "$REPO/scripts/jom-estado.py" "$JOM_DIR/jom-estado.py.tmp" && mv "$JOM_DIR/jom-estado.py.tmp" "$JOM_DIR/jom-estado.py"
  cp "$REPO/scripts/hooks/jom-no-parar.py" "$JOM_DIR/jom-no-parar.py.tmp" && mv "$JOM_DIR/jom-no-parar.py.tmp" "$JOM_DIR/jom-no-parar.py"
  chmod 755 "$JOM_DIR/jom-estado.py" "$JOM_DIR/jom-no-parar.py"
  ok "$("$PYTHON" "$JOM_DIR/jom-estado.py" --version)"
  # Prueba en una carpeta y un HOME vacíos: así no toca tus tareas ni su contador anti-bucle.
  local out vacio
  vacio="$(mktemp -d -t jomhookXXXXXX)"
  out="$(cd "$vacio" && printf '{"cwd":"%s","stop_hook_active":false}' "$vacio" | HOME="$vacio" "$PYTHON" "$JOM_DIR/jom-no-parar.py" 2>&1)" || true
  rm -rf "$vacio"
  ok "el hook responde (sin tarea viva no bloquea: salida «${out}»)"
}

# ---------------------------------------------------------------- settings.json
fusionar_settings() {  # fusionar_settings instalar|desinstalar
  "$PYTHON" - "$SETTINGS" "$HOOK_CMD" "$1" "$STAMP" <<'PY'
import json, os, shutil, sys
ruta, cmd, modo, stamp = sys.argv[1:5]
MARCA = "jom-no-parar.py"
if os.path.exists(ruta):
    try:
        with open(ruta, "r", encoding="utf-8") as f:
            cfg = json.load(f)
    except ValueError as e:
        print("✖ %s no es JSON válido (%s): no lo toco. Corrígelo y repite." % (ruta, e)); sys.exit(1)
    if not isinstance(cfg, dict):
        print("✖ %s no es un objeto JSON: no lo toco." % ruta); sys.exit(1)
else:
    if modo == "desinstalar":
        print("  · no hay %s" % ruta); sys.exit(0)
    cfg = {}
antes = json.dumps(cfg, sort_keys=True)
hooks = cfg.get("hooks")
if hooks is None:
    hooks = {}
if not isinstance(hooks, dict):
    print("✖ 'hooks' en %s no es un objeto: no lo toco." % ruta); sys.exit(1)
stop = hooks.get("Stop", [])
if not isinstance(stop, list):
    print("✖ 'hooks.Stop' en %s no es una lista: no lo toco." % ruta); sys.exit(1)

def es_nuestro(h):
    return isinstance(h, dict) and MARCA in str(h.get("command", ""))

if modo == "instalar":
    ya = False
    for g in stop:
        for h in (g.get("hooks") or []) if isinstance(g, dict) else []:
            if es_nuestro(h):
                if ya:
                    h["__borrar__"] = True  # duplicado de una instalación vieja
                else:
                    h.update({"type": "command", "command": cmd, "timeout": 15}); ya = True
    for g in stop:
        if isinstance(g, dict) and isinstance(g.get("hooks"), list):
            g["hooks"] = [h for h in g["hooks"] if not (isinstance(h, dict) and h.get("__borrar__"))]
    stop = [g for g in stop if not (isinstance(g, dict) and g.get("hooks") == [])]
    if not ya:
        stop.append({"matcher": "", "hooks": [{"type": "command", "command": cmd, "timeout": 15}]})
    hooks["Stop"] = stop
    cfg["hooks"] = hooks
else:
    nuevo = []
    for g in stop:
        if isinstance(g, dict) and isinstance(g.get("hooks"), list):
            resto = [h for h in g["hooks"] if not es_nuestro(h)]
            if len(resto) != len(g["hooks"]) and not resto:
                continue  # el grupo solo tenía nuestro hook
            g["hooks"] = resto
        nuevo.append(g)
    if nuevo:
        hooks["Stop"] = nuevo
    else:
        hooks.pop("Stop", None)
    if "hooks" in cfg:
        if hooks:
            cfg["hooks"] = hooks
        else:
            cfg.pop("hooks")
if json.dumps(cfg, sort_keys=True) == antes:
    print("  = %s ya estaba al día (sin cambios)" % ruta)
    sys.exit(0)
if os.path.exists(ruta):
    shutil.copy2(ruta, "%s.bak-%s" % (ruta, stamp))
    print("  · copia: %s.bak-%s" % (ruta, stamp))
os.makedirs(os.path.dirname(ruta), exist_ok=True)
tmp = ruta + ".jom.tmp"
with open(tmp, "w", encoding="utf-8") as f:
    json.dump(cfg, f, ensure_ascii=False, indent=2); f.write("\n")
os.replace(tmp, ruta)
otros = [h.get("command") for g in cfg.get("hooks", {}).get("Stop", []) if isinstance(g, dict)
         for h in (g.get("hooks") or []) if isinstance(h, dict) and not es_nuestro(h)]
print("  ✔ %s %s" % (ruta, "con el Stop hook de JOM" if modo == "instalar" else "sin el Stop hook de JOM"))
for o in otros:
    print("    · se conserva el Stop hook: %s" % o)
PY
}

# ---------------------------------------------------------------- AGENTS.md
bloque_agents() {
  cat <<'MD'
<!-- jom-estudio -->
## JOM Estudio · orquestador (lo añadió scripts/instalar-skills-jom.sh)
- Cuando el CEO diga «activa …» (auditoría del Home o del estudio, web, correo, videos/motion, YouTube,
  tipografía, seguridad, un departamento 01–07 o un skill por su nombre), «sigue por donde ibas» o
  «termina todo»: usa el skill `jom-estudio` (~/.claude/skills/jom-estudio o ~/.gemini/config/skills/jom-estudio).
- Arranque obligatorio: `python3 ~/.claude/jom/jom-estado.py reanudar` y sigue en el paso pendiente.
  Tras cada paso: `python3 ~/.claude/jom/jom-estado.py paso-hecho N --evidencia "…"`.
  Lo que solo el CEO puede resolver: `bloquear N --necesita "…"`. Nunca cierres con pasos pendientes.
- Confirmación explícita del CEO antes de publicar, desplegar a producción, enviar correos reales,
  publicar en redes o gastar créditos. Nada privado (prospectos) en la web pública. Sin push --force.
- No borrar ni sobrescribir .context_sync.json, CURRENT_STATE.md ni este archivo fuera de este bloque.
<!-- /jom-estudio -->
MD
}

agents_md() {  # agents_md instalar|desinstalar
  local f="$JOM_STUDIO_DIR/AGENTS.md" r=""
  say "AGENTS.md (Antigravity)"
  if [ ! -f "$f" ]; then warn "no existe $f: no lo creo"; return 0; fi
  case "$AGENTS" in
    si) r=s ;;
    no) r=n ;;
    *) if [ -t 0 ]; then
         if [ "$1" = instalar ]; then printf '  ¿Añado/actualizo el bloque <!-- jom-estudio --> en %s? (s/N): ' "$f"
         else printf '  ¿Quito el bloque <!-- jom-estudio --> de %s? (s/N): ' "$f"; fi
         read -r r || r=""
       fi ;;
  esac
  case "$r" in s|S|si|SI|sí|Sí) ;; *) echo "  · AGENTS.md sin cambios"; return 0 ;; esac
  bloque_agents > "$JOM_DIR/.bloque-agents.md.tmp"
  "$PYTHON" - "$f" "$JOM_DIR/.bloque-agents.md.tmp" "$1" "$STAMP" <<'PY'
import os, re, shutil, sys
ruta, bloque_ruta, modo, stamp = sys.argv[1:5]
with open(ruta, "r", encoding="utf-8") as f:
    texto = f.read()
with open(bloque_ruta, "r", encoding="utf-8") as f:
    bloque = f.read().rstrip("\n")
rx = re.compile(r"\n?<!-- jom-estudio -->.*?<!-- /jom-estudio -->\n?", re.S)
if modo == "instalar":
    if rx.search(texto):
        nuevo = rx.sub(lambda m: "\n" + bloque + "\n", texto, count=1)
    else:
        nuevo = texto.rstrip("\n") + "\n\n" + bloque + "\n"
else:
    nuevo = rx.sub("\n", texto, count=1).rstrip("\n") + "\n"
if nuevo == texto:
    print("  = AGENTS.md ya estaba al día"); sys.exit(0)
shutil.copy2(ruta, "%s.bak-jom-%s" % (ruta, stamp))
tmp = ruta + ".jom.tmp"
with open(tmp, "w", encoding="utf-8") as f:
    f.write(nuevo)
os.replace(tmp, ruta)
print("  ✔ %s (copia: %s.bak-jom-%s)" % (ruta, os.path.basename(ruta), stamp))
PY
  rm -f "$JOM_DIR/.bloque-agents.md.tmp"
}

# ---------------------------------------------------------------- principal
if [ "$MODO" = instalar ]; then
  instalar_skills
  instalar_herramientas
  if [ "$HOOK" = 1 ]; then say "Stop hook en $SETTINGS"; fusionar_settings instalar || die "No pude fusionar $SETTINGS"
  else warn "--sin-hook: no registro el Stop hook"; fi
  agents_md instalar
  say "Listo"
  echo "  · Abre una sesión NUEVA de Claude Code (los hooks se leen al arrancar; si te lo pide, apruébalo en /hooks)."
  echo "  · Di «activa la auditoría del Home» o «sigue por donde ibas»."
  echo "  · Estado: python3 ~/.claude/jom/jom-estado.py estado  ·  Parar el empuje: … pausar"
else
  say "Desinstalar JOM Estudio"
  quitar_skills
  if [ -d "$JOM_DIR" ]; then
    rm -f "$JOM_DIR/jom-estado.py" "$JOM_DIR/jom-no-parar.py"
    if rmdir "$JOM_DIR" 2>/dev/null; then ok "quitado $JOM_DIR"
    else warn "dejo $JOM_DIR/respaldos (copias de skills que había antes)"; fi
  fi
  say "Stop hook en $SETTINGS"; fusionar_settings desinstalar || die "No pude limpiar $SETTINGS"
  mkdir -p "$JOM_DIR"; agents_md desinstalar; rmdir "$JOM_DIR" 2>/dev/null || true
  say "Desinstalado"
  echo "  · Tus tareas (.jom/estado.json y ~/.jom/) no se borran: son tus datos."
fi
