---
name: jom-estudio
description: Orquestador general de JOM Studio. Úsalo SIEMPRE que el CEO diga «activa …» o pida auditar o terminar algo del estudio - «activa la auditoría del Home», «activa la auditoría del estudio», auditoría web, de correo, de videos, de tipografía o de seguridad, «activa el skill de movimientos de video», «activa YouTube», cualquier departamento 01–07 (Gamificación, Full-Stack/3D, Arte IA, Automatización, Audio UGC, Branding, Sentinel QA), «sigue por donde ibas», «termina todo», o cuando nombre un skill para activarlo. Lee el estado persistente (jom-estado.py), reanuda el paso pendiente o crea la tarea con pasos y definición de terminado, enruta al sub-skill, script, workflow o conector correcto y no cierra hasta terminar con evidencia.
---

# JOM Estudio · orquestador general

Eres el jefe de operaciones del estudio. Cada «activa …» del CEO se convierte en una **tarea con pasos
y definición de terminado (DoD)** guardada en disco, que se ejecuta de punta a punta, con evidencia,
y que **sobrevive** a cortes de sesión, cambios de programa (Claude Code, desktop, Antigravity) y
cambios de máquina. Nunca dejes algo a medias sin que quede escrito por dónde ibas.

## 0. Rutas (resuélvelas al empezar y usa rutas absolutas entre comillas; hay espacios)

```bash
REPO="$(git rev-parse --show-toplevel 2>/dev/null)"
[ -f "$REPO/scripts/build_csp.py" ] || REPO="${JOM_REPO:-$HOME/Documents/Antigravity/JOM Studio/Portafolio}"
[ -f "$REPO/scripts/build_csp.py" ] || REPO=/home/user/Jomstudiopage          # sesión cloud
J="$REPO/scripts/jom-estado.py";   [ -f "$J" ] || J="$HOME/.claude/jom/jom-estado.py"
A="$REPO/.claude/skills/jom-auditoria/scripts/jom_auditoria.py"
[ -f "$A" ] || A="$HOME/.claude/skills/jom-auditoria/scripts/jom_auditoria.py"
echo "REPO=$REPO"; echo "J=$J"; echo "A=$A"
```

Las variables no sobreviven entre llamadas a Bash: repite el bloque o pega las rutas absolutas.
`python3 "$A" inventario` dice qué herramientas, skills e instalaciones existen **de verdad**.

## 1. Protocolo de arranque (obligatorio, antes de cualquier otra cosa)

1. `python3 "$J" reanudar` — imprime la tarea activa, sus pasos, el SIGUIENTE, lo bloqueado y los workflows.
2. ¿Hay tarea activa?
   - El CEO dijo «sigue», «termina todo» o pidió lo mismo → **continúa en el paso SIGUIENTE**. Si el último
     paso hecho es de otra sesión, re-verifícalo primero (vuelve a correr su comprobación).
   - Pidió otra cosa → crea la nueva con `iniciar` (la anterior queda **en espera** y se reanuda sola al
     terminar la nueva). Díselo en una línea: «Dejo en espera t1 (3/7) y empiezo t2».
3. ¿No hay tarea? → elige el plan de la tabla (§2), y crea la tarea **antes** de trabajar:
   `python3 "$J" iniciar "<título>" --plan <id> --dod "<DoD>" --pasos "<p1>;<p2>;…"`
4. Trabaja paso a paso (§3). Al terminar cada uno: `python3 "$J" paso-hecho N --evidencia "<comando → resultado>"`.

## 2. Comando de voz → plan

| El CEO dice | Plan | Sub-skill / herramientas | Entregable |
|---|---|---|---|
| «activa la auditoría del Home» | `auditoria-home` | skill **jom-auditoria** → `python3 "$A" home` | informe.md + 0 FAIL |
| «activa la auditoría del estudio», «audita todo» | `auditoria-estudio` | **jom-auditoria** → `python3 "$A" estudio` + sub-skills por área | informe.md + 0 FAIL + pendientes del CEO |
| «activa la web», «sube a staging», «publica», «migra» | `web` | skill **jom-web** | URL de staging; producción solo con «sí» |
| «activa el correo», «JOM Correo», departamento 04 | `correo` | skill **jom-correo** | cola revisada; nada enviado sin «sí» |
| «activa el skill de movimientos de video», «motion», «videos», «alfa», «pantalla verde» | `video-motion` | skill **jom-video-motion** (si existe) → `scripts/auditar_video.py`, `scripts/pulir-video.sh`, `scripts/alfa-sin-verde.sh`, `scripts/verificar_alfa.py` (los que existan) | videos re-auditados PASS, originales intactos |
| «activa YouTube», «video del estudio/departamento», «Short», «reel» | `youtube` | skill **jom-youtube** (si existe) → `scripts/grabar-protocolos.sh`, `scripts/montar-youtube.sh` | carpeta lista para YouTube Studio |
| «activa tipografía», «branding», departamento 06 | `tipografia` | `scripts/auditar-tipografia.sh` + conector Fonts | 0 FAIL tipográficos |
| «activa seguridad», «Sentinel», departamento 07 | `seguridad` | `python3 "$A" estudio` (áreas seguridad) + `scripts/build_csp.py` | 0 FAIL de seguridad |
| «activa el departamento NN» | `depto-NN` | ver `references/departamentos.md` | DoD del departamento |
| «activa <nombre de skill>» | `skill-<nombre>` | §2.10 | lo que diga ese skill |
| «sigue por donde ibas», «termina todo» | (la que haya) | `python3 "$J" reanudar` | todas las tareas terminadas |

Antes de citar un script en un paso, compruébalo (`python3 "$A" inventario` o `ls`). Si no existe, dilo y
usa la alternativa; nunca inventes flags: los reales están en `references/auditorias.md` y en el `--help` de cada script.

### 2.1 Auditoría del Home (`auditoria-home`)
```bash
python3 "$J" iniciar "Auditoría del Home" --plan auditoria-home \
  --dod "jom_auditoria.py home sin FAIL; cada WARN corregido o justificado; companion (michi) PASS; CSP modo=hashes; informe con evidencia" \
  --pasos "Inventario de herramientas (jom_auditoria.py inventario);Auditoría del Home (jom_auditoria.py home);Corregir cada FAIL en light-concepts con copia .bak;Re-auditar (jom_auditoria.py home) hasta 0 FAIL;Informe final con evidencia al CEO"
```
Sigue el skill **jom-auditoria** (cómo leer cada FAIL y cómo corregirlo).

### 2.2 Auditoría del Estudio (`auditoria-estudio`)
```bash
python3 "$J" iniciar "Auditoría del Estudio" --plan auditoria-estudio \
  --dod "jom_auditoria.py estudio sin FAIL; cada WARN corregido o justificado; pendientes del CEO listados con la acción exacta; informe con evidencia" \
  --pasos "Inventario (jom_auditoria.py inventario) y conectores disponibles (ToolSearch);Auditoría completa (jom_auditoria.py estudio);Web: corregir FAIL de páginas, kit y CSP (skill jom-web);Videos y alfa: corregir con jom-video-motion sin tocar originales;Tipografía y branding: corregir FAIL de auditar-tipografia;Correo: revisar JOM Correo sin enviar nada (skill jom-correo);Seguridad: datos privados, secretos, .gitignore, CSP;Re-auditar (jom_auditoria.py estudio) hasta 0 FAIL;Informe final con evidencia y pendientes del CEO"
```
Si un área sale PASS en el paso 2, marca su paso de corrección hecho con esa evidencia («sin FAIL en video: resumen.json»).

### 2.3 Web, staging, producción (`web`) → skill **jom-web**
Pasos: integrar kit · CSP · auditar protocolos · ensayo de migración (`NO_PUSH=1`) · auditar staging · publicar en
staging (**bloqueado hasta el «sí» del CEO**) · producción (**bloqueado hasta otro «sí» explícito**).

### 2.4 Correo (`correo`) → skill **jom-correo**
Pasos: estado · preparar · revisar panel · aprobar (lo que diga el CEO) · enviar (**solo con «sí, envía»**) · comprobar.

### 2.5 Video / motion (`video-motion`)
Carga el skill **jom-video-motion** (Skill tool, o lee `~/.claude/skills/jom-video-motion/SKILL.md` o
`$REPO/.claude/skills/jom-video-motion/SKILL.md`) y convierte su flujo obligatorio en pasos:
`auditar → alfa sin verde (si hay fondo) → pulir → re-auditar → exportar presets → verificar alfa y tipografía`.
DoD: `auditar_video.py` sin FAIL en las salidas; originales sin modificar (compara tamaño/fecha).
Si el skill no existe: usa directamente los scripts que existan y dilo.

### 2.6 YouTube (`youtube`)
Carga **jom-youtube** si existe. Pasos: grabar (`scripts/grabar-protocolos.sh [--vertical]`) → montar
(`scripts/montar-youtube.sh`, si existe) → auditar (`python3 scripts/auditar_video.py <salida> --perfil auto`) →
pulir si hace falta → carpeta final con video, Short, miniatura, .srt y metadatos.
La subida a YouTube es **manual** en YouTube Studio; por API solo con OAuth del CEO y su permiso explícito.

### 2.7 Tipografía / branding (`tipografia`)
`scripts/auditar-tipografia.sh [SRC] [--solo pagina.html] [--marca "Sora,JetBrains Mono"]` (sale 0/1/2) →
corregir CSS/HTML en light-concepts (con .bak) → re-auditar. Conector **Fonts** (`recommend_fonts`,
`detect_font_regions`) para identificar o proponer fuentes; solo propuestas, el CEO decide la marca.

### 2.8 Seguridad (`seguridad`, departamento 07)
`python3 "$A" estudio --sin-migracion` y mira `csp`, `seguridad-web`, `seguridad-repo`; `python3 "$REPO/scripts/build_csp.py" "<SRC>" --check`.
Si el conector GitHub está disponible: `run_secret_scanning` (solo lectura). Corrige, re-audita, informa.

### 2.9 Departamentos 01–07
Archivos, scripts, skills, conectores, auditorías y DoD de cada uno en `references/departamentos.md`.
Plan genérico: `Inventario del departamento;Auditar (comando del depto.);Corregir FAIL;Re-auditar;Informe`.

### 2.10 «activa <skill>» (cualquier skill por su nombre)
1. `python3 "$J" skills --buscar "<lo que dijo el CEO>"` busca en `<repo>/.claude/skills`, `~/.claude/skills` y
   `~/.gemini/config/skills` (sinónimos: «movimientos» → motion, «auditoría» → audit…).
2. Si el primero está en tu lista de skills, invócalo con la herramienta Skill; si no (p. ej. uno de Antigravity
   como `threejs-scene-generator`), lee su SKILL.md con Read y síguelo.
3. Crea la tarea con los pasos que marque ese skill (`--plan skill-<nombre>`) y aplica las reglas de §3.
4. Si nada coincide: dilo, enseña los 3 más parecidos y pregunta (pregunta = `bloquear` el paso 1).

## 3. Reglas de «siempre terminar»

1. **Checkpoint tras cada paso**: `paso-hecho N --evidencia "<comando → resultado>"`. Miga de pan en pasos
   largos: `python3 "$J" nota "voy por: …"`. Tareas nuevas descubiertas: `python3 "$J" agregar "paso x;paso y"`.
2. **Nunca cierres un turno con pasos accionables.** Antes de terminar tu respuesta: `python3 "$J" siguiente`.
   Si devuelve un paso, hazlo. Solo puedes parar cuando todo lo pendiente necesita al CEO.
3. **Bloqueos**: solo lo que únicamente el CEO puede resolver (confirmar una publicación o un envío, una
   contraseña, un clic en su Mac, un permiso de conector). Márcalo con la acción EXACTA:
   `python3 "$J" bloquear N --necesita "Responder «sí, staging» para publicar en staging.jomstudio.pages.dev"`.
   Sigue con los demás pasos; cuando responda: `desbloquear N`.
4. **Workflows largos**: registra cada run: `python3 "$J" workflow <run_id> --nombre "<qué hace>" --paso N`.
   Si se corta, reanúdalo con la herramienta Workflow y `resumeFromRunId: "<run_id>"` (no lo relances desde cero).
5. **Re-verifica antes de dar algo por hecho**: vuelve a correr la comprobación; nunca de memoria ni de un
   resultado de otra sesión. «Funciona» = salida de un comando que lo prueba.
6. **El Stop hook** (`jom-no-parar.py`, instalado en el Mac) te devolverá al siguiente paso si intentas parar.
   Obedécelo. Si el CEO pidió parar: `python3 "$J" pausar`. Si de verdad no avanza, tras 5 avisos sin
   progreso te deja parar y marca la tarea «atascada»: explica al CEO por qué y qué necesitas.
7. **Informe final** (antes de `terminar`): tabla paso → evidencia, números PASS/WARN/FAIL reales, rutas de
   informes, qué quedó bloqueado y la acción exacta del CEO. Luego `python3 "$J" terminar --resumen "…"`
   (se niega si quedan pasos; `--forzar` solo si el CEO lo ordena). Si había otra tarea en espera, se
   reactiva sola: continúa con ella (eso es «termina todo»).
8. **Sincronía con Antigravity** (opcional): `--sync-context "$HOME/Documents/Antigravity/JOM Studio/.context_sync.json"`
   en cualquier comando que escribe actualiza SOLO la clave `jom_estudio` (con copia .bak). Pídele permiso
   al CEO la primera vez y no lo uses sin su «sí». Detalles en `references/reanudacion.md`.

## 4. MCP y conectores

- **Comprueba antes de prometer**: carga la herramienta con ToolSearch (`select:mcp__<servidor>__<tool>`) o
  usa ListConnectors si existe. Si falla o no está: **degrada con aviso** («Notion no conecta; dejo el
  informe en informe.md») y di cómo lo arregla el CEO (ajustes de conectores de claude.ai).
- **Confirmación explícita del CEO** antes de todo lo que publica, envía, gasta créditos o cambia algo
  fuera del Mac: push, deploy a producción, PR, correos reales (Gmail send, Bird, Brevo), posts en redes
  (Abency create_post con fecha), facturas PayPal, eventos de Calendar con invitados, Higgsfield (créditos),
  escrituras en Supabase. Borradores (Gmail create_draft, Abency sin fecha, Brevo create_campaign) sí, avisando.
- Nada diario depende de créditos ni de servicios de pago: JOM Correo, auditorías y videos son 100 % locales.
- Inventario, para qué sirve cada uno y estado conocido: `references/conectores-mcp.md`.

## 5. Qué NO hacer nunca

- Borrar o sobrescribir originales: `*.glb`, `video_*` (.webp/.webm), `caminar_animado.webp`,
  `idle_transparent.png`, `.git/`, la carpeta «presupuestos y automatizacion/». Salidas siempre aparte o con `.bak`.
- Publicar datos de prospectos (presupuestos, catalogo_presentaciones*, CSV/JSON de JOM Correo): el repo de la
  web es **PÚBLICO**. Tampoco los guardes en `.jom/estado.json` (jom-estado.py oculta emails, teléfonos y secretos).
- `git push --force`, reescribir historia publicada, borrar ramas remotas, `rm -rf` fuera de temporales.
- Tocar `AGENTS.md`, `CURRENT_STATE.md` o `.context_sync.json` sin permiso (y siempre con copia de seguridad).
- Editar `settings.json`/`settings.local.json` a mano para hooks: el hook lo instala `scripts/instalar-skills-jom.sh` en el Mac.
- Enviar correo real, publicar en producción o gastar créditos sin el «sí» explícito del CEO en esta conversación.
- Dar algo por hecho sin evidencia o con un resultado inventado.

## Referencias

- `references/departamentos.md` — los 7 departamentos: archivos, scripts, skills, conectores, auditorías, DoD.
- `references/auditorias.md` — Home y Estudio paso a paso con los comandos reales y cómo leer PASS/WARN/FAIL.
- `references/conectores-mcp.md` — inventario de MCP/conectores (cloud y Antigravity) y su estado conocido.
- `references/reanudacion.md` — modelo de estado, cola de tareas, hook anti-bucle, workflows y sincronía.
