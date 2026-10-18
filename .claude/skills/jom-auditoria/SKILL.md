---
name: jom-auditoria
description: Auditoría ejecutable de punta a punta de JOM Studio. «Auditoría del Home» (concept_master_horizontal.html e index.html, companion michi, CSP, tipografía, alfa, seguridad) y «auditoría del estudio» (home + 7 protocolos, kit, CSP, tipografía, videos y alfa, ensayo de migración, staging, JOM Correo, lanzadores, seguridad del repo, git e instalación). Úsalo cuando el CEO diga «activa la auditoría del Home», «activa la auditoría del estudio», «audita la web», «revisa todo» o «verifica antes de publicar», o desde el orquestador jom-estudio. Corre jom_auditoria.py, corrige cada FAIL y re-audita hasta 0 FAIL con evidencia.
---

# JOM Auditoría · Home y Estudio

Ejecutor: `scripts/jom_auditoria.py` de este skill (solo stdlib, Python 3.9). **No modifica nada**: llama a los
scripts reales del repo por su interfaz y lo que aún no existe sale `OMITIDO` con el motivo.

```bash
A="$HOME/.claude/skills/jom-auditoria/scripts/jom_auditoria.py"
[ -f "$A" ] || A="$(git rev-parse --show-toplevel)/.claude/skills/jom-auditoria/scripts/jom_auditoria.py"
J="$HOME/.claude/jom/jom-estado.py"
[ -f "$J" ] || J="$(git rev-parse --show-toplevel)/scripts/jom-estado.py"
python3 "$A" inventario                      # qué existe de verdad
python3 "$A" home                            # Auditoría del Home
python3 "$A" estudio [--sin-migracion]       # Auditoría del Estudio
#  --repo R  --src "<light-concepts>"  --out "<carpeta>"  --sin-navegador  --json
```
Localiza el repo (`--repo`, `JOM_REPO`, el git actual, `~/Documents/Antigravity/JOM Studio/Portafolio`) y la web
(`--src`, `SRC`, `<repo>/demos/light-concepts`). Sale 0 sin FAIL, 1 con FAIL, 2 si no encuentra el repo.
Informe en `<out>/informe.md`, datos en `<out>/resumen.json`, un log por comprobación en `<out>/logs/`.
La primera vez la parte de navegador instala Playwright 1.56.1 en `${TMPDIR}/jom-audit-node` (necesita red y node ≥ 18).

## De punta a punta

1. **Tarea** (si no la creó ya jom-estudio): usa el `iniciar` de §2.1 (Home) o §2.2 (Estudio) del skill
   **jom-estudio**. Si hay una activa, `python3 "$J" reanudar` y sigue en su paso.
2. **Inventario**: `python3 "$A" inventario` → `paso-hecho 1 --evidencia "<lo que falta / lo que hay>"`.
3. **Auditar**: `python3 "$A" home` (o `estudio`). Copia la línea final «Evidencia para jom-estado» en
   `paso-hecho 2 --evidencia "…"`. Abre `informe.md` y los logs de cada FAIL.
4. **Corregir cada FAIL** (y lo barato de los WARN), uno a uno, apuntando con `python3 "$J" nota "…"`:
   - siempre en `demos/light-concepts` con copia previa (`cp f f.bak-AAAAMMDD`), nunca sobre GLB/videos originales;
   - por área: web/kit/CSP → skill **jom-web**; alfa/video → **jom-video-motion** (`alfa-sin-verde.sh`,
     `pulir-video.sh`, salidas aparte); tipografía → CSS; seguridad-repo → `.gitignore`/`git rm --cached`
     (rotar secretos expuestos = acción del CEO, bloquéala); correo → **jom-correo**;
   - lo que solo el CEO puede hacer (instalar en su Mac, contraseña, permiso): `bloquear N --necesita "…"`.
5. **Re-auditar** con el MISMO comando hasta 0 FAIL. Si una corrección no funciona, `agregar` un paso nuevo
   en vez de darla por hecha.
6. **Informe final** (plantilla en `jom-estudio/references/auditorias.md`) con números reales, archivos
   corregidos y su evidencia, WARN justificados y pendientes del CEO. Luego `terminar --resumen "…"`.

## Lectura rápida de resultados

| id | Si sale FAIL/WARN, mira |
|---|---|
| `git` | archivos versionados sin commit (WARN): ¿son cambios para publicar? No hagas commit sin que lo pida el CEO |
| `origen` | la web nueva solo existe en el Mac; en la nube es esperado (bloquea con la acción del CEO) |
| `kit` | integración pendiente → `scripts/integrar-kit.sh` |
| `navegador` / `navegador-staging` | `logs/navegador.log` y `protocolos/auditoria.json` (ids `HTTP`, `JS`, `recursos`, `CSP`, `menú: *`, `michi: *`, `función 0N (…)`), capturas en `protocolos/capturas/` |
| `csp` | `modo=unsafe-inline`: atributos `on*=` en el HTML o demasiados hashes |
| `tipografia` | `tipografia/` (fuente de reserva pintada, tamaños < 12 px en móvil, contraste AA) |
| `alfa` / `video` | logs de `verificar_alfa.py` / `auditar_video.py` (derrame verde, congelados, loop, loudness) |
| `seguridad-web` | enlaces a datos privados o secretos (FAIL); `_blank` sin `noopener`, `on*=`, `http://` (WARN) |
| `migracion-ensayo` | `logs/migracion-ensayo.log` (worktree, GLB, CSP, candado de datos privados) |
| `seguridad-repo` | datos privados versionados o sin ignorar, secretos, documentos de clientes en el repo público, `js/config.js` |
| `correo` / `lanzadores` | JOM Correo instalado, `estado`, LaunchAgents, `.command` con permiso de ejecución |
| `instalacion` | skills globales y Stop hook → `bash scripts/instalar-skills-jom.sh` |

DoD: el comando de auditoría da **0 FAIL**, cada WARN está corregido o justificado por escrito, los pendientes
del CEO están bloqueados con su acción exacta y el informe tiene las salidas reales (nada inventado).
