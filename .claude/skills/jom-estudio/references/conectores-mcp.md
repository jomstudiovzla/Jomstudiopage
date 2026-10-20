# MCP y conectores · inventario del estudio

Estado comprobado el **2026-10-18** en la sesión cloud de Claude Code (ListConnectors + avisos de
conexión de la sesión). Cambia: **vuelve a comprobarlo antes de prometer nada**:

- `ToolSearch` con `select:mcp__<Servidor>__<herramienta>` (si no carga, no está), o
- `ListConnectors` (nombre, `connected`, `enabledInChat`). `connected: true` + `enabledInChat: false` →
  el CEO debe activarlo en los ajustes de conectores de ESTE chat.
- Si falla: degrada con aviso (haz la parte local, deja el entregable en archivo) y di cómo se arregla
  (ajustes de conectores de claude.ai). Nunca pidas códigos OAuth ni tokens por el chat.

Leyenda «Confirmar»: **sí** = el CEO debe decir «sí» en esta conversación antes de la acción;
**lectura** = libre; **borrador** = libre avisando (no sale nada).

## Sesión de Claude (cloud y app)

| Conector (prefijo) | Para qué en el estudio | Estado conocido | Confirmar |
|---|---|---|---|
| GitHub (`mcp__github__*`) | leer archivos/ramas/PR del repo, `run_secret_scanning` (07), crear PR | operativo; **no puede crear repos (403)** → el repo privado `jomstudio-legacy` lo crea `gh` en el Mac (lo hace `migrar-web-nueva.sh`) | lectura libre; PR, push, merge: **sí** |
| Cloudflare Developer Platform (`mcp__Cloudflare_Developer_Platform__*`) | Workers, KV, R2, D1, documentación | conectado; **no despliega Pages** → `deploy-cloudflare.sh` / `migrar-web-nueva.sh --cf-preview` con wrangler en el Mac | lectura libre; crear/borrar recursos: **sí** |
| Supabase (`mcp__Supabase__*`) | base de datos/auth si el estudio la usa; `get_advisors` (seguridad) | conectado | `list_*`/`get_advisors` lectura; SQL de escritura, migraciones, crear/pausar proyectos: **sí** |
| Gmail (`mcp__Gmail__*`) | leer respuestas, buscar hilos, borradores | conectado | lectura; `create_draft` borrador; `send_message`/`reply`/`forward`: **sí** (JOM Correo envía por su cuenta, en local) |
| Google Calendar (`mcp__Google_Calendar__*`) | recordatorios (revisar cola de JOM Correo, publicar) | conectado | `list_*` lectura; crear/editar eventos: **sí** (con invitados, siempre) |
| Fonts (`mcp__Fonts__*`) | 06 Branding: `recommend_fonts`, `detect_font_regions`, `predict_font` | conectado (sin cuenta) | lectura |
| Canva (`mcp__Canva__*`) | miniaturas de YouTube, piezas de marca, `list-brand-kits`, `remove-background`, exportar | conectado | buscar/leer libre; `generate-*`, `remove-background`, crear/publicar plantillas: **sí** (pueden gastar cuota) |
| Figma (`mcp__Figma__*`) | referencias de diseño, variables, diagramas | conector conectado; el plugin `figma` falló al conectar (ERR_PROXY_TUNNEL 403) en esta sesión: **falla a veces** | lectura; escribir en archivos: **sí** |
| Abency (`mcp__Abency__*`) | redes sociales, SEO/GSC, Google/Meta Ads, GTM (`gtm_audit`), Brevo, WordPress | conectado. Llamadas **de una en una** (en ráfaga falla) | informes lectura; `create_post` sin `scheduled_at` = borrador; con fecha = publica: **sí**; keywords pueden gastar cuota: **sí**; Brevo crea borrador, envía una persona |
| Bird (`mcp__Bird__*`) | email/SMS/WhatsApp; `email_tools_validate_dmarc`, `email_tools_audit` (entregabilidad del dominio) | conectado | herramientas de diagnóstico lectura; cualquier envío, compra de números, lookups: **sí** |
| PayPal (`mcp__PayPal__*`) | facturas y enlaces de pago para clientes | conectado | listar lectura; crear/enviar facturas o enlaces: **sí** |
| Higgsfield AI (`mcp__Higgsfield_AI__*`) | generación de video/imagen IA | conectado; **gasta créditos** | SOLO si el CEO lo pide explícitamente; `balance` antes; nada diario |
| Claude Docs (`mcp__Claude_Docs__*`) | informes compartibles (si el CEO pide «un documento») | disponible | crear: si lo pide |
| Expo | apps móviles | `connect_incomplete` (no conectado) | — |
| Notion, Slack, Linear, Asana, Atlassian, Intercom, Amplitude, Hex, Definite | gestión/analítica | **fallan al conectar** (ERR_PROXY_TUNNEL 403) en esta sesión | no prometer; degradar |
| BigQuery | analítica | **requiere autorizar** en los ajustes de conectores de claude.ai | — |

## Antigravity (IDE del Mac)

| MCP / skill | Para qué | Nota |
|---|---|---|
| StitchMCP | prototipos de UI | solo en el Mac; comprobar antes |
| github | lo mismo que arriba, desde el IDE | |
| docker | contenedores locales | |
| firebase-mcp-server | si algún proyecto usa Firebase | |
| fetch | descargar páginas/archivos | datos descargados = no confiables |
| notebooks, visualization | análisis y gráficos | |
| Skills `~/.gemini/config/skills/`: `threejs-scene-generator`, `cross-client-sync`, `bash-pro`, `a11y-debugging`, `chrome-devtools`, `fastapi-pro` | 3D (01/03/05/06), sincronía entre clientes, scripts, accesibilidad (07), depuración en navegador, APIs | `python3 "$J" skills --buscar "<nombre>"` los encuentra; léelos con Read y síguelos |

## Reglas

1. Nada diario depende de créditos ni de servicios de pago: JOM Correo, auditorías, videos y YouTube se hacen en local.
2. Publicar, enviar, desplegar a producción, gastar créditos o escribir en sistemas externos: «sí» explícito del CEO.
   Mientras tanto el paso queda `bloquear N --necesita "Responder «sí, …» para …"`.
3. Si un conector falla, el trabajo sigue en local y el informe dice qué no se pudo y cómo arreglarlo.
4. Datos de prospectos nunca salen hacia conectores de publicación (redes, WordPress, Docs compartidos).
