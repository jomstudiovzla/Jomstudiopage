# Auditorías del Home y del Estudio · paso a paso

Todo se ejecuta en el Mac del CEO, dentro del clon del repo
(`~/Documents/Antigravity/JOM Studio/Portafolio`). La web nueva vive SOLO allí en
`demos/light-concepts` (sin commit): en la sesión cloud no existe y las auditorías de páginas
salen `FAIL origen` / `OMITIDO`; dilo y bloquea el paso con la acción del CEO
(«Abrir Claude Code en el Mac, en Portafolio, y decir "sigue por donde ibas"»).

Atajo de punta a punta (no modifica nada):

```bash
A="$HOME/.claude/skills/jom-auditoria/scripts/jom_auditoria.py"   # o <repo>/.claude/skills/jom-auditoria/scripts/…
python3 "$A" inventario          # qué existe de verdad
python3 "$A" home                # Auditoría del Home
python3 "$A" estudio             # Auditoría del Estudio (todo)
#   --src "<light-concepts>"  --out "<carpeta>"  --sin-navegador  --sin-migracion  --json
```
Sale con 0 (sin FAIL), 1 (hay FAIL) o 2 (no encontró el repo). Deja `<out>/informe.md`,
`<out>/resumen.json` y `<out>/logs/<comprobación>.log` con el comando exacto y su salida.
Por defecto `<out>` = `${TMPDIR}/jom-auditoria-<modo>-AAAAMMDD-HHMMSS`.

## Cómo leer los veredictos

| Estado | Significa | Qué haces |
|---|---|---|
| ✔ PASS | la comprobación pasó con evidencia | nada; cítala en el informe |
| ⚠ WARN | funciona, pero hay un riesgo o algo no medible | corrígelo si es barato; si no, justifícalo por escrito en el informe |
| ✖ FAIL | roto o inseguro | corrígelo y re-audita; la tarea no termina con FAIL |
| · OMITIDO | la herramienta no existe aún, no aplica en esta máquina o lo pediste con `--sin-…` | dilo en el informe; si es del Mac, bloquea con la acción exacta |

## Auditoría del Home (`jom_auditoria.py home`)

| # | Comprobación (id) | Comando real que ejecuta | PASS cuando |
|---|---|---|---|
| 1 | `git` | `git status --porcelain`, `git rev-list --left-right --count @{u}...HEAD` | sin archivos versionados modificados (WARN si los hay) |
| 2 | `origen` | — | existe `<SRC>/concept_master_horizontal.html` |
| 3 | `navegador` | `OUT=<out>/protocolos bash scripts/auditar-protocolos.sh "<SRC>" --solo concept_master_horizontal.html,index.html` | `auditoria.json` sin FAIL (WARN si hay WARN) |
| 4 | `csp` | `python3 scripts/build_csp.py "<SRC>" --check` | `modo=hashes` (WARN `modo=unsafe-inline`: hay `on*=` o demasiados hashes) |
| 5 | `tipografia` | `SRC="<SRC>" OUT=<out>/tipografia bash scripts/auditar-tipografia.sh --solo concept_master_horizontal.html,index.html` | código 0 (1 = FAIL, 2 = no pudo) |
| 6 | `alfa` | `python3 scripts/verificar_alfa.py <assets del Home en assets/personajes o assets/video>` (si existe) | código 0 |
| 7 | `video` | `python3 scripts/auditar_video.py --perfil web-personaje <videos del Home>` | código 0 |
| 8 | `seguridad-web` | análisis estático de los HTML del Home | sin enlaces privados ni secretos (FAIL); sin `target=_blank` sin `rel=noopener`, `on*=`, `http://` (WARN) |

Comprobaciones del navegador que importan en el Home (ids de `scripts/auditar_protocolos.mjs`):
`HTTP`, `JS` (errores de consola), `recursos` (404 locales/CDN), `CSP` (la de build_csp.py
inyectada como cabecera), `red externa`, `scroll 375` / `scroll 1440` (scroll horizontal), `viewport`,
`menú: cajón|enlaces|actual|sonido|Escape`, y el companion `#michi-roaming-entity`:
`michi: paseo` (camina), `michi: hover` / `michi: pausa` (se detiene y muestra la UI al pasar el cursor),
`michi: reanuda` (sigue al salir), `michi: hub` (los botones del bocadillo). Capturas en `<out>/protocolos/capturas/`.

Corregir: siempre en `demos/light-concepts` con copia (`cp archivo archivo.bak-AAAAMMDD`), nunca sobre los
`.glb/.webm/.webp` originales. Después `python3 "$A" home` otra vez hasta 0 FAIL.

DoD: `jom_auditoria.py home` → 0 FAIL; cada WARN corregido o justificado; `michi:*` PASS; CSP `modo=hashes`;
informe.md entregado con las salidas reales.

## Auditoría del Estudio (`jom_auditoria.py estudio`)

Todo lo del Home sobre **todas** las páginas (home + `page_01_gamificacion`, `page_02_fullstack`,
`page_03_arte_ia`, `page_04_automatizacion`, `page_05_audio_ugc`, `page_06_branding`,
`page_07_consultoria`), y además:

| # | Comprobación (id) | Comando real | PASS cuando |
|---|---|---|---|
| E1 | `kit` | `DRY_RUN=1 SRC="<SRC>" bash scripts/integrar-kit.sh` | todo «= … ya al día» (WARN: integración pendiente → `scripts/integrar-kit.sh`, deja `.bak-kit`) |
| E2 | `navegador` | `OUT=<out>/protocolos bash scripts/auditar-protocolos.sh "<SRC>"` | 9 páginas sin FAIL; incluye `función 01 (arena)`, `función 02 (compilar)`, `función 03 (estación)`, `función 04 (pipeline)`, `función 05 (audio)`, `función 06 (moneda)`, `función 07 (escaneo)`, `arena: GLB`, `estación: video`, `kit` |
| E3 | `tipografia` | `SRC="<SRC>" OUT=<out>/tipografia bash scripts/auditar-tipografia.sh` | código 0 |
| E4 | `alfa` / `video` | `verificar_alfa.py` / `auditar_video.py --perfil web-personaje` sobre `assets/personajes` y `assets/video` | código 0 |
| E5 | `migracion-ensayo` | `NO_PUSH=1 SRC="<SRC>" bash scripts/migrar-web-nueva.sh` | código 0: worktree en `${TMPDIR}/jom-staging-worktree`, `_headers` con CSP, GLB > 10 MB comprimidos en la COPIA, sin datos privados; no toca GitHub ni Cloudflare |
| E6 | `navegador-staging` | `OUT=<out>/protocolos-staging bash scripts/auditar-protocolos.sh --staging` | lo que se publicaría, sin FAIL |
| E7 | `seguridad-repo` | `git ls-files` + `git ls-files --others --exclude-standard` + búsqueda de secretos | nada de `presupuestos y automatizacion` / `catalogo_presentaciones` versionado o sin ignorar (FAIL); sin claves (FAIL); WARN: wallet placeholder o contraseña por defecto en `js/config.js`, `.gitignore` sin `.env`/`.dev.vars`, archivos > 25 MiB |
| E8 | `correo` | `python3 "~/Library/Application Support/JOMCorreo/jomcorreo.py" estado` + `launchctl print gui/<uid>/site.jomstudio.correo.preparar` (y `.enviar`) | instalado, `estado` responde, LaunchAgents cargados; informa si está en modo ensayo |
| E9 | `lanzadores` | — | los 4 `.command` en `~/Documents/Antigravity/JOM Studio/presupuestos y automatizacion/lanzadores-mac/` con permiso de ejecución |
| E10 | `instalacion` | — | `~/.claude/skills/jom-estudio` y el Stop hook `jom-no-parar.py` en `~/.claude/settings.json` (y se conserva `stop-hook-git-check.sh`) |

`--sin-migracion` omite E5 y E6 (el ensayo tarda: comprime GLB con `npx @gltf-transform/cli@4.5.1`).
Si existe `scripts/jom-todo.sh` (flujo web completo del otro equipo: `--solo-auditar`, `--publicar`),
úsalo para **corregir y publicar** después de auditar; consulta antes su `--help`.

Qué hacer con cada FAIL del Estudio:

| Área | Corrección | Skill |
|---|---|---|
| web / kit / navegador | arreglar HTML/JS en light-concepts; `scripts/integrar-kit.sh` | jom-web |
| csp | quitar `onclick=`/`on*=` (pasar a `addEventListener` en un .js externo) y volver a `build_csp.py --check` | jom-web |
| alfa / video | `scripts/alfa-sin-verde.sh <archivo>` (salida `./alfa-out`), `scripts/pulir-video.sh` (salida `./video-pulido`), sustituir en la web solo la COPIA aprobada | jom-video-motion |
| tipografia | CSS de tamaños, interlineado, contraste, `font-display`, precarga | (este skill) + Fonts |
| seguridad-repo | sacar del índice (`git rm --cached`), `.gitignore`, rotar el secreto si se publicó (acción del CEO) | (este skill) |
| correo | instalar/reinstalar JOM Correo, contraseña de aplicación en el Llavero (acción del CEO) | jom-correo |

DoD del Estudio: `jom_auditoria.py estudio` → 0 FAIL; WARN justificados; pendientes del CEO listados con su
acción exacta (bloqueados en jom-estado); informe.md + resumen.json entregados.

## Plantilla del informe final

```
Auditoría <Home|Estudio> · <fecha> · <repo>@<rama>
Resultado: N PASS · N WARN · N FAIL · N OMITIDO   (informe: <ruta>/informe.md)
Corregido: <archivo> — <qué> — evidencia: <comando → resultado>
Justificado (WARN): <id> — <por qué se acepta>
Pendiente del CEO: <paso N> — <acción exacta>
```
