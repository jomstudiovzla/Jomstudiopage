---
name: jom-web
description: Flujo de la web nueva de JOM Studio (demos/light-concepts en el Mac → staging.jomstudio.pages.dev → jomstudio.site). Integrar el kit (jom-arena, jom-workstation), CSP por hashes, auditar el Home y los 7 protocolos, ensayo de migración, publicar en staging y producción solo con el «sí» del CEO. Úsalo cuando el CEO diga «activa la web», «sube a staging», «publica», «migra la web», «despliega», o trabaje en los departamentos 01, 02 o 03, la CSP, el kit o el companion del Home.
---

# JOM Web · integrar, auditar, migrar, publicar

La web nueva vive **solo en el Mac**: `~/Documents/Antigravity/JOM Studio/Portafolio/demos/light-concepts`
(sin commit). Todos los scripts aceptan `SRC=…` (o la ruta como argumento) y nunca modifican los originales
de `assets/` (GLB, videos). El repo es PÚBLICO: nada de «presupuestos y automatizacion/» ni catálogos de prospectos.

## Comandos reales (desde la raíz del repo)

| Paso | Comando | Resultado esperado |
|---|---|---|
| Ver qué cambiaría el kit | `DRY_RUN=1 scripts/integrar-kit.sh` | «= … ya al día» o el diff |
| Integrar el kit | `scripts/integrar-kit.sh` | copia `kit/*.js` a `assets/js/`, inserta los `<script>`; deja `<página>.bak-kit` |
| CSP | `python3 scripts/build_csp.py "<SRC>" --check` | `modo=hashes` (sin escribir `_headers`) |
| Auditar navegador | `scripts/auditar-protocolos.sh ["<SRC>"] [--solo page_03_arte_ia.html]` | sale 0 sin FAIL, 1 con FAIL, 2 si no pudo |
| Auditar tipografía | `scripts/auditar-tipografia.sh ["<SRC>"] [--solo …] [--marca "Sora,JetBrains Mono"]` | 0 / 1 / 2 |
| Auditoría completa | `python3 ~/.claude/skills/jom-auditoria/scripts/jom_auditoria.py estudio` | 0 FAIL |
| Ensayo de migración | `NO_PUSH=1 scripts/migrar-web-nueva.sh` | worktree en `${TMPDIR}/jom-staging-worktree`, sin tocar GitHub ni Cloudflare |
| Auditar lo que se publicaría | `scripts/auditar-protocolos.sh --staging` | 0 FAIL |
| **Staging** (publica) | `scripts/migrar-web-nueva.sh --cf-preview` | repo privado `jomstudio-legacy`, push de la rama, vista previa `https://staging.jomstudio.pages.dev` |
| Staging continuo | `scripts/migrar-web-nueva.sh --watch` | re-publica cada cambio (~15 s) hasta Ctrl+C |
| **Producción** (publica) | `./deploy-cloudflare.sh` | exige árbol limpio; sube lo versionado a `jomstudio` rama `main` → `https://jomstudio.site` |
| Todo en uno (si existe) | `scripts/jom-todo.sh [--solo-auditar] [--publicar]` — mira antes su `--help` | flujo completo con paradas ante FAIL |

Variables útiles: `SRC`, `WORK`, `BRANCH` (claude/sleepy-bell-kh6jlu), `GLB_MAX_MB` (10), `CF_PROJECT` (jomstudio),
`CF_PREVIEW_BRANCH` (staging), `OUT`, `PORT`, `JOM_PLAYWRIGHT` (Playwright ya instalado).
Lanzador de doble clic: «JOM Web · Todo.command» (`lanzadores-mac/`), que llama a `scripts/jom-todo.sh`.

## Plan (crea la tarea con jom-estado)

```bash
J="$HOME/.claude/jom/jom-estado.py"     # o <repo>/scripts/jom-estado.py
python3 "$J" iniciar "Web nueva a staging" --plan web \
  --dod "kit integrado; CSP modo=hashes; auditar-protocolos sin FAIL en light-concepts y en --staging; staging publicado solo con el «sí» del CEO; producción solo con otro «sí»" \
  --pasos "git pull --ff-only de claude/sleepy-bell-kh6jlu;Kit: DRY_RUN=1 scripts/integrar-kit.sh y aplicar;CSP: build_csp.py --check;Auditar: jom_auditoria.py estudio --sin-migracion;Corregir FAIL y re-auditar;Ensayo: NO_PUSH=1 scripts/migrar-web-nueva.sh;Auditar staging: auditar-protocolos.sh --staging;Publicar staging con «sí» (migrar-web-nueva.sh --cf-preview);Producción con otro «sí» (./deploy-cloudflare.sh)"
```

- Pasos 8 y 9: **bloquéalos** antes de llegar (`bloquear 8 --necesita "Responder «sí, staging»"`,
  `bloquear 9 --necesita "Responder «sí, producción» tras revisar staging"`). Si el CEO solo quiere staging,
  el 9 queda bloqueado y la tarea abierta: dilo en el informe.
- Antes de publicar, muestra el resumen del ensayo (páginas en 200, `modo=hashes`, ningún archivo > 25 MiB,
  nada privado) y la salida de `--staging`.
- Después de publicar: comprueba la URL (HTTP 200 y que sirve la web nueva) y pégalo como evidencia.

## Corregir lo típico

- `CSP: on*=` / `modo=unsafe-inline`: mueve `onclick=` y similares a `addEventListener` en un `.js` externo.
- `recursos` 404: rutas relativas (sin `../`), mayúsculas/minúsculas (Cloudflare distingue), archivo fuera de SRC.
- `función 01 (arena)` / `función 03 (estación)` / `kit`: `scripts/integrar-kit.sh` y revisa el host
  `data-jom-arena` / `data-jom-workstation`.
- `michi: *` (Home): el companion debe caminar, pararse en hover/focus, mostrar el hub y reanudar al salir.
- GLB > 25 MiB: la migración comprime la COPIA (meshopt + WebP); el original no se toca.

## Nunca

- `git push --force`, publicar en producción sin «sí», mover el dominio al proyecto git `jomstudiopage`
  (los secretos del formulario están en el proyecto `jomstudio`), publicar datos privados, borrar originales.
- Desde la nube: el MCP de GitHub no crea repos (403) y el de Cloudflare no despliega Pages: eso va en el Mac.
