# Reanudación: no perder nunca por dónde ibas

## Piezas

| Pieza | Dónde | Qué hace |
|---|---|---|
| `jom-estado.py` | `<repo>/scripts/` y, instalado, `~/.claude/jom/` | estado persistente de tareas y pasos (cola), evidencias, bloqueos, workflows |
| `jom-no-parar.py` | `<repo>/scripts/hooks/` y, instalado, `~/.claude/jom/` | Stop hook: si quedan pasos accionables, devuelve a Claude al siguiente paso |
| `instalar-skills-jom.sh` | `<repo>/scripts/` | instala skills + estado + hook en el Mac (`--desinstalar` para quitarlo) |
| `.jom/estado.json` | `<raíz git>/.jom/` o `~/.jom/` | el estado (JSON); `.jom/.gitignore` ignora `*.lock`, `*.tmp`, `*.bak`, `no-parar.json` |

## Dónde se guarda el estado

1. `--archivo RUTA` o `JOM_ESTADO=RUTA` si se dan.
2. Si no: el `.jom/estado.json` más cercano subiendo desde la carpeta actual que tenga tareas vivas
   (incluye `~/.jom/estado.json`).
3. Si no hay ninguno: `<raíz git>/.jom/estado.json` (dentro de un repo) o `~/.jom/estado.json` (fuera).
   `--global` fuerza `~/.jom/estado.json`: úsalo para tareas que cruzan carpetas (p. ej. correo + web).

`reanudar` sin nada que retomar no crea archivos. Escrituras atómicas (tmp + `os.replace`) bajo `flock`
(`estado.lock`); `estado.json.bak` es espejo de la última versión válida: si el JSON se daña, se lee el `.bak` y el dañado queda como `estado.json.dañado-<fecha>`.

## Modelo

```
tareas: [ {id: t3, titulo, estado: activa|en-espera|pausada, plan, dod, pasos: [
            {n, texto, estado: pendiente|en-curso|hecho|bloqueado, evidencia[], notas[], necesita}],
           workflows: [{run_id, nombre, paso}], atascado?} ]
terminadas: [...últimas 30...]   historial: [...últimos 300 eventos...]
```

- **Cola**: `iniciar` pone la nueva delante y deja la anterior **en espera**; `--en-cola` la pone detrás.
  `terminar`/`cancelar` reactivan la siguiente en espera. «Termina todo» = repetir hasta que no quede ninguna.
- **Bloqueado** = solo el CEO puede resolverlo. Siempre con la acción exacta en `--necesita`.
- **Pausada** (`pausar`): el CEO pidió parar. El hook no empuja. `reanudar` la reactiva.
- **Privacidad**: el texto se limpia (emails → `[email]`, teléfonos → `[tel]`, tokens/contraseñas → `[secreto]`).
  `estado.json` puede versionarse para llevar el estado de la sesión cloud al Mac, pero el repo es PÚBLICO:
  revísalo antes de hacer commit y no metas datos de prospectos.

## Comandos

```bash
J="$HOME/.claude/jom/jom-estado.py"      # o <repo>/scripts/jom-estado.py
python3 "$J" reanudar                    # plan exacto para retomar (y reactiva lo pausado)
python3 "$J" iniciar "Auditoría del Home" --plan auditoria-home --dod "…" --pasos "a;b;c" [--en-cola]
python3 "$J" nota "voy por la página 03"            # miga de pan (marca el paso en curso)
python3 "$J" paso-hecho 2 --evidencia "jom_auditoria.py home → 7 PASS · 1 WARN · 0 FAIL"
python3 "$J" bloquear 5 --necesita "Responder «sí, staging» para publicar"
python3 "$J" desbloquear 5
python3 "$J" agregar "Corregir CSP de page_05"
python3 "$J" workflow wf_123abc --nombre "auditoría estudio" --paso 2
python3 "$J" siguiente                   # 0 = hay paso · 3 = nada accionable
python3 "$J" estado [--json] · historial [-n 50] · activar t2 · pausar · cancelar --motivo "…"
python3 "$J" terminar --resumen "…"      # se niega si quedan pasos (--forzar solo por orden del CEO)
python3 "$J" skills --buscar "movimientos de video"
```

## El Stop hook (`jom-no-parar.py`)

Claude Code lo llama al final de cada turno con un JSON por stdin (`cwd`, `session_id`, `stop_hook_active`, …).

| Situación | Respuesta |
|---|---|
| tarea viva (activa o en espera, no pausada) con un paso pendiente no bloqueado | `{"decision":"block","reason":"… Sigue AHORA con el paso N: … Al terminar: … paso-hecho N …"}` |
| todos los pasos hechos pero la tarea sin `terminar` | bloquea para el cierre (re-verificar, informe, `terminar`) |
| todo lo pendiente bloqueado por el CEO · pausada · sin tarea · > `JOM_NO_PARAR_HORAS` (24) sin moverse | no bloquea |
| 5 bloqueos seguidos sin progreso (`JOM_NO_PARAR_MAX`) | deja parar, marca la tarea `atascado` (lo ven `estado`/`reanudar`) y avisa con `systemMessage` |
| cualquier error propio o `JOM_NO_PARAR=0` | no bloquea, sale con 0 |

«Progreso» = cambia algún paso (estado, nº de evidencias o notas). `reanudar` pone el contador a cero.
No usa `stop_hook_active` para cortar a la primera porque el CEO quiere que siga hasta terminar: el freno es el
contador. Solo existe en Claude Code; en Antigravity el bloque `<!-- jom-estudio -->` de AGENTS.md pide el
mismo protocolo (reanudar al empezar, checkpoint tras cada paso).

Registro en `~/.claude/settings.json` (lo fusiona el instalador, sin tocar otros hooks):

```json
{"hooks": {"Stop": [
  {"matcher": "", "hooks": [{"type": "command", "command": "~/.claude/stop-hook-git-check.sh"}]},
  {"matcher": "", "hooks": [{"type": "command", "command": "python3 ~/.claude/jom/jom-no-parar.py", "timeout": 15}]}
]}}
```

Si el hook molesta: `python3 "$J" pausar` (temporal), `JOM_NO_PARAR=0` (sesión) o
`bash scripts/instalar-skills-jom.sh --desinstalar` (definitivo; deja copia `settings.json.bak-…`).

## Workflows de Claude Code

Registra cada run largo con `workflow <run_id>`. Si la sesión se corta, `reanudar` lo lista y lo retomas con la
herramienta Workflow pasando `resumeFromRunId: "<run_id>"`: continúa desde su diario, no desde cero.
Al acabar, verifica su resultado (no te fíes del resumen) y marca el paso con evidencia.

## Cambiar de programa o de máquina

- Mismo Mac, otro programa (terminal, app de escritorio, Antigravity): el estado está en disco; di «sigue por donde ibas».
- Sesión cloud → Mac: la web nueva solo existe en el Mac. Bloquea el paso con
  «Abrir Claude Code en ~/Documents/Antigravity/JOM Studio/Portafolio y decir "sigue por donde ibas"».
  Para llevar el estado: `--global` en el Mac o commit de `.jom/estado.json` revisado (sin datos privados).

## Sincronía con `.context_sync.json` (Antigravity ↔ terminal)

`--sync-context "$HOME/Documents/Antigravity/JOM Studio/.context_sync.json"` en un comando que escribe:
- solo añade/actualiza la clave `jom_estudio` (tarea, estado, progreso, siguiente, bloqueados, en cola);
- conserva todas las demás claves; copia previa en `.context_sync.json.bak`; respeta la sangría;
- no crea el archivo si no existe y no lo toca si no es JSON válido;
- **solo si el CEO lo confirmó** (pregúntale una vez y apúntalo con `nota`).
