---
name: jom-correo
description: Operar JOM Correo, los correos de prospección 100 % locales del Mac de JOM Studio (05:00 preparar, 08:00 enviar, seguimiento a las 72 h en el mismo hilo). Úsalo cuando el CEO diga «activa el correo», hable de JOM Correo, prospectos, la cola, aprobar o enviar correos, el panel, los lanzadores de doble clic, instalar JOM Correo o el departamento 04 Automatización. Estado, preparar, revisar, aprobar, enviar, pausar, instalar. Nunca envía correo real sin la confirmación explícita del CEO.
---

# JOM Correo · operación

Sistema local (sin créditos, sin SaaS): `/usr/bin/python3` (3.9 stdlib), `launchd`, SQLite, Llavero de macOS y
la cuenta del CEO por SMTP/IMAP. **Solo existe en el Mac.** En la sesión cloud: bloquea los pasos con
«Abrir Claude Code en el Mac y decir "sigue por donde ibas"».

## Rutas

| Qué | Dónde |
|---|---|
| Proyecto (fuente, privado) | `~/Documents/Antigravity/JOM Studio/presupuestos y automatizacion/correo-automatico/` |
| Instalado (programa + datos) | `~/Library/Application Support/JOMCorreo/` (`config.json`, base de datos, `outbox/`, `logs/`, `panel/panel.html`, `entrada/`) |
| CLI | `C="$HOME/Library/Application Support/JOMCorreo/jomcorreo.py"; python3 "$C" <comando>` (o el alias `jomcorreo`) |
| LaunchAgents | `~/Library/LaunchAgents/site.jomstudio.correo.preparar.plist` y `.enviar.plist` |
| Lanzadores de doble clic | `…/presupuestos y automatizacion/lanzadores-mac/`: «JOM Correo · Instalar», «· Trabajo completo», «· Enviar aprobados», «JOM Web · Todo» (.command) |
| Registros | `~/Library/Application Support/JOMCorreo/logs/` y, de los lanzadores, `~/Library/Logs/JOMCorreo/` |

Los datos de prospectos son **privados**: nunca al repo de la web (público), ni a `.jom/estado.json`, ni a
conectores de publicación. En las evidencias usa números («12 en cola»), nunca nombres ni correos.

## Comandos reales del CLI

```
init · importar ARCHIVO [--vista-previa] · preparar · enviar · revisar-respuestas · estado · ver ID
aprobar --todo | aprobar ID… · omitir ID… · panel [--abrir] · pausar · reanudar · baja EMAIL · reactivar EMAIL
resolver ID enviado|reintentar|cancelar · probar-smtp [--enviar-prueba] · clave [--comprobar|--borrar]
ensayo-dia [--dias N] [--fecha AAAA-MM-DD] [--aprobar-todo]          (todas aceptan --config RUTA)
```

## Planes (crea la tarea con jom-estado antes de empezar)

`J="$HOME/.claude/jom/jom-estado.py"` (o `<repo>/scripts/jom-estado.py`).

**Revisión del día** (plan `correo`):
```bash
python3 "$J" iniciar "JOM Correo · revisión del día" --plan correo \
  --dod "cola preparada y revisada; aprobado solo lo que dijo el CEO; envío real solo con su «sí»; estado final mostrado" \
  --pasos "Estado (jomcorreo estado);Preparar la cola (jomcorreo preparar);Revisar el panel (jomcorreo panel --abrir) y resumir al CEO;Aprobar lo que el CEO indique (jomcorreo aprobar …);Enviar aprobados SOLO con el «sí» del CEO (jomcorreo enviar);Estado final y registro"
```
1. `python3 "$C" estado` → resume: pendientes de aprobación (IDs), en cola, incidencias, **modo ensayo sí/no**, pausa.
2. `python3 "$C" preparar` (lo mismo que el turno de las 05:00; importa `entrada/`, revisa respuestas, redacta).
3. `python3 "$C" panel --abrir` y `python3 "$C" ver ID` para leer correos concretos. Resume al CEO sin datos personales.
4. Aprobar: **bloquea** el paso con `--necesita "Decir qué apruebo: «todo» o los números"`; cuando responda:
   `python3 "$C" aprobar --todo` o `aprobar 3 7 9`.
5. Enviar: **bloquea** con `--necesita "Responder «sí, envía» para enviar los aprobados ahora (si no, salen a las 08:00)"`.
   Con el «sí»: `python3 "$C" enviar`. Si `modo_ensayo` es `true`, solo escribe `.eml` en `outbox/AAAA-MM-DD/`: dilo.
6. `python3 "$C" estado` otra vez como evidencia final.

**Instalar o reinstalar** (plan `correo-instalar`):
`Instalar (bash instalar.sh en correo-automatico, o doble clic en «JOM Correo · Instalar.command»);Contraseña de aplicación en el Llavero (jomcorreo clave) — acción del CEO;Probar conexión (jomcorreo probar-smtp; --enviar-prueba solo con «sí»);Importar prospectos con --vista-previa y luego real;Ensayo de 4 días (jomcorreo ensayo-dia --dias 4 --aprobar-todo);Comprobar LaunchAgents (launchctl print gui/$(id -u)/site.jomstudio.correo.preparar)`
- `clave` pide la contraseña por teclado: es del CEO → bloquea el paso con esa acción exacta.
- Repite `bash instalar.sh` cada vez que cambien los `horarios` de `config.json`.

**Activar el envío real** (plan `correo-real`): solo si el CEO lo pide con esas palabras. Pasos: `probar-smtp --enviar-prueba`
(con «sí») → el CEO confirma que le llegó → cambiar `"modo_ensayo": true` por `false` en el `config.json` instalado
(copia `.bak` antes; muestra el diff) → `estado`. Para frenar en cualquier momento: `python3 "$C" pausar`.

## Lanzadores de doble clic

Hacen lo mismo sin Terminal y avisan en el Mac, por correo a sí mismo y por iMessage si se configuró
(`~/Library/Application Support/JOMCorreo/notificaciones.json`). La primera vez macOS los bloquea:
clic derecho → Abrir, o `xattr -dr com.apple.quarantine "<carpeta>"` y `chmod +x "<carpeta>"/*.command`.
«Trabajo completo» prepara, avisa, deja aprobar y pregunta antes de enviar; «Enviar aprobados» envía sin preguntar
(equivale al turno de las 08:00): no lo ejecutes tú sin el «sí».

## Reglas

- Nunca `enviar`, `probar-smtp --enviar-prueba`, ni pasar `modo_ensayo` a `false` sin el «sí» explícito del CEO en esta conversación.
- No edites a mano la base de datos; usa el CLI. No borres `outbox/`, `logs/` ni datos.
- Gmail MCP (si está) sirve para leer respuestas o crear borradores; JOM Correo envía por su cuenta en local.
- Si algo falla: `python3 "$C" estado`, últimos logs en `~/Library/Application Support/JOMCorreo/logs/`, y
  `resolver ID …` para envíos «inciertos». Informa con evidencia y bloquea lo que necesite al CEO.
