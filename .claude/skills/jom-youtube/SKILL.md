---
name: jom-youtube
description: Videos de YouTube de JOM Studio 100 % locales y gratis. Graba la home y los 7 protocolos en acción (Playwright), monta con ffmpeg (intro con logo, rótulo por departamento, transiciones, música y voz con ducking, −14 LUFS), audita, exporta y entrega una carpeta lista para subir a mano a YouTube Studio (video 16:9, Short 9:16, miniatura, subtítulos .srt y metadatos con capítulos exactos). Úsalo cuando el CEO diga «crea un video de YouTube», «video del estudio», «video del departamento 0X», «haz un Short», «reel», «activa YouTube», o pida miniatura, capítulos, subtítulos o metadatos para YouTube.
---

# JOM YouTube · grabar → montar → auditar → exportar → entregar

Todo corre en el Mac del CEO con herramientas gratis: Chromium de Playwright, ffmpeg y el `python3` del sistema
(3.9, solo biblioteca estándar). **Nada diario gasta créditos.** La entrega es una carpeta que el CEO sube a mano
en YouTube Studio; **la subida por API (YouTube Data API v3) es opcional y solo con OAuth del CEO y su permiso
explícito**: nunca pidas, guardes ni escribas credenciales en el repo (es PÚBLICO).

Reglas fijas:
- Nada se sobrescribe: si ya hay clips se mueven a `clips-AAAAMMDD-HHMMSS`; cada montaje sale en una carpeta nueva
  `video-AAAAMMDD-HHMMSS` (o `--salida` con sufijo `-2`, `-3`… si existe); el pulido sale aparte.
- La web nueva vive solo en el Mac (`~/Documents/Antigravity/JOM Studio/Portafolio/demos/light-concepts`). Graba
  con `--salida` fuera del repo (recomendado `"$HOME/Movies/JOM YouTube"`); `youtube-out/` y `video-pulido/` están
  en `.gitignore` por si acaso. Nunca hagas commit de clips ni de entregas.
- Publicar (subir a YouTube, programar en redes) requiere el «sí» explícito del CEO, siempre.
- Cada «funciona» sale de un comando ejecutado (ffprobe, ebur128, `montaje.json`): no inventes resultados.

## Comandos reales (desde la raíz del repo)

| Paso | Comando | Resultado esperado |
|---|---|---|
| 0 · Preparar (una vez) | `scripts/grabar-protocolos.sh --solo-preparar` | `✔ playwright 1.56.1 · Chromium listo` (instala en `${TMPDIR}/jom-audit-node`, nada global) |
| 1 · Grabar | `scripts/grabar-protocolos.sh --vertical --salida "$HOME/Movies/JOM YouTube"` | `clips/<pagina>.webm` 1920×1080, `clips/vertical/<pagina>.webm` 1080×1920 y `clips/manifiesto.json`; sale 0 (1 si alguna página no cargó, 2 si no pudo grabar) |
| 1b · Un departamento | `scripts/grabar-protocolos.sh --solo 03 --repetir 3 --duracion 36 --vertical --salida …` | un clip largo con la coreografía repetida (para ≥ 3 capítulos de ≥ 10 s) |
| 2 · Guion | copia `references/plantillas/guion-estudio.txt` (o `guion-departamento.txt`) y edítalo | formato en `references/guion-departamentos.md` |
| 2b · Ver el plan | `scripts/montar-youtube.sh --clips "<salida>/clips" --guion guion.txt --plan` | secciones, duración total y capítulos previstos, sin renderizar |
| 3 · Montar | `scripts/montar-youtube.sh --clips "<salida>/clips" --guion guion.txt --musica "tema.mp3" [--voz "voz.m4a" --voz-desde 4] [--fuentes "<carpeta Sora/JetBrains>"]` | carpeta `video-…` con todo; sale 0 si entregó, 2 si no pudo |
| 4a · Auditar el Short | `python3 scripts/auditar_video.py "<entrega>/short-youtube.mp4" --perfil social-vertical` | PASS/WARN (sale 1 con FAIL) |
| 4b · Auditar el 16:9 | `python3 scripts/auditar_video.py "<entrega>/video-youtube.mp4" --perfil social-vertical --umbral aspecto=16:9` | PASS/WARN; ver nota del perfil abajo |
| 4c · Pulir (si hay FAIL) | `scripts/pulir-video.sh "<entrega>/short-youtube.mp4" --auto -o "<entrega>/pulido"` | salida nueva en `pulido/`; re-audita sola |
| 5 · Entregar | abre `<entrega>/LEEME-subida.txt` y `youtube-metadatos.txt` | el CEO sube a mano en studio.youtube.com |

`auditar_video.py` y `pulir-video.sh` son de otro flujo (skill **jom-video-motion**): úsalos **si existen**
(`[ -f scripts/auditar_video.py ]`) y lee su `--help` si algo cambió. Notas comprobadas:
- `--perfil auto` elige `social-vertical` para cualquier MP4 → con el 16:9 daría FAIL de aspecto; por eso el 16:9 se
  audita con `--umbral aspecto=16:9`.
- `pulir-video.sh --preset social` reencuadra a **1080×1920**: sirve para el Short, no para el 16:9. Si el auditor
  marca FAIL en el 16:9, corrige **re-montando** (otros clips, `--duracion`, `--t-transicion`, más música) en vez de pulir.

Opciones de `grabar-protocolos.sh`: `--vertical` · `--solo-vertical` · `--solo home,01,03` · `--duracion S` (≥ 14 s
útiles por página) · `--repetir N` (1–10 ciclos de coreografía) · `--sin-cursor` · `--salida DIR` · `--solo-preparar`.
Variables: `SRC` (por defecto `<repo>/demos/light-concepts`), `PORT` (8089; si está ocupado usa el siguiente libre),
`JOM_PLAYWRIGHT` (Playwright ya instalado), `JOM_AUDIT_PREFIX`.

Opciones de `montar-youtube.sh`: `--clips DIR` · clips sueltos como argumentos (en ese orden) · `--guion F` ·
`--musica F` · `--voz F` · `--voz-desde S` · `--logo PNG` (por defecto `assets/logo-white.png`) · `--fuentes DIR` ·
`--salida DIR` · `--transicion fadeblack|fade|smoothleft|circleopen|…` · `--t-transicion S` (0.8) · `--duracion S`
(12 por sección) · `--sin-short` · `--sin-intro` · `--sin-cierre` · `--whisper-modelo F` · `--rapido` · `--plan` ·
`--conservar-temporales`. Variables: `JOM_FFMPEG`, `JOM_FUENTES`, `JOM_WHISPER_MODEL`, `JOM_PYTHON`.

## Qué graba cada protocolo (coreografía, tolerante a elementos ausentes)

| Página | Acción | Momento clave en el manifiesto |
|---|---|---|
| home (`concept_master_horizontal.html`) | deja caminar a `#michi-roaming-entity`, hover encima (se para y abre `.michi-action-hub`), cursor fuera | `companion: pasea` |
| 01 Gamificación | espera `jomArena`, enfoca la arena, ArrowRight → ArrowUp (salto) → ArrowLeft; mide `state.x` | `arena: ArrowRight` |
| 02 Full-Stack & 3D | pulsa COMPILAR (3 veces) | `botón COMPILAR` |
| 03 Arte IA | pulsa GENERAR y espera `phase === 'done'` | `estación: generar` / `estación: done` |
| 04 Automatización | pulsa PIPELINE | `botón PIPELINE` |
| 05 Audio UGC | pulsa TOCAR (2 veces) | `botón TOCAR` |
| 06 Branding | el cursor recorre la moneda (2 vueltas en 3 s) | `moneda: hover` |
| 07 Sentinel QA | pulsa ESCANEO | `botón ESCANEO` |
| todas | plano de situación de 1 s y scroll suave hasta abajo y de vuelta (si la página es más alta que la ventana) | — |

Si falta un elemento se anota `ok:false` en `acciones` y se sigue. Antes de montar, revisa el manifiesto:
`python3 -c 'import json,sys; [print(c["pagina"], [a["accion"] for a in c.get("acciones",[]) if not a["ok"]]) for c in json.load(open(sys.argv[1]))["clips"]]' "<salida>/clips/manifiesto.json"`.
El montaje usa `inicio_util_s` y `momento_clave_s` del manifiesto para encuadrar cada sección (la acción cae ~2 s
después del rótulo) y para elegir el fotograma de la miniatura (por defecto, 03 justo después de `done`).

## Qué entrega el montaje (carpeta nueva)

| Archivo | Formato | Comprobación |
|---|---|---|
| `video-youtube.mp4` | 1920×1080 H.264 High yuv420p bt709 30 fps +faststart · AAC 48 kHz · −14 LUFS / ≤ −1 dBTP | `ffprobe` + `ebur128` (el script lo imprime) |
| `short-youtube.mp4` | 1080×1920 ≤ 60 s (58 s máx.), clips verticales si existen; si no, horizontal sobre fondo desenfocado | duración < 60 |
| `miniatura.png` | 1280×720 con el título grande (si pasa de 2 MB, también `miniatura.jpg`) | tamaño ≤ 2 MB |
| `subtitulos.es.srt` | del guion (`texto:`); con `--voz` y whisper.cpp, de la voz (y el del guion como `subtitulos-guion.es.srt`) | bloques > 0 |
| `youtube-metadatos.txt` | título, descripción con CAPÍTULOS, etiquetas (≤ 500 car.), bloque del Short | ver `references/metadatos-youtube.md` |
| `LEEME-subida.txt` | pasos de subida manual en YouTube Studio | — |
| `montaje.json` | segmentos, offsets de xfade, loudnorm, `cortes_verificados`, `comprobaciones_youtube`, avisos | `cortes_verificados.ok == true` |

**Capítulos exactos:** el montaje ajusta cada sección (± medio segundo, en fotogramas) para que cada corte caiga en
un segundo entero, y después **mide en el MP4 final** dónde cae de verdad cada transición (fotograma más oscuro del
`fadeblack`, o el cruce de planos en otras transiciones). Si un corte medido se separa del calculado, manda el medido.
`montaje.json → cortes_verificados.capitulos[*].error_s` debe ser ≤ 0,5 s. Reglas de YouTube que se comprueban:
primer capítulo `00:00`, ≥ 3 capítulos, cada uno ≥ 10 s (si una sección es más corta se une con la vecina y se avisa).

## Plan con jom-estado (si existe)

```bash
J="$HOME/.claude/jom/jom-estado.py"; [ -f "$J" ] || J="scripts/jom-estado.py"
python3 "$J" iniciar "Video de YouTube del estudio" --plan youtube \
  --dod "clips sin ✖; montaje rc=0; 16:9 h264 yuv420p 1920x1080 AAC 48k; −14±1 LUFS y TP ≤ −1 dBTP; ≥3 capítulos con error ≤0,5 s; Short 1080x1920 ≤60 s; miniatura 1280x720 ≤2 MB; auditar_video sin FAIL; carpeta entregada; nada subido sin «sí»" \
  --pasos "Grabar (grabar-protocolos.sh --vertical);Revisar manifiesto;Guion (plantilla) y --plan;Montar (montar-youtube.sh);Verificar ffprobe/ebur128/cortes;Auditar (auditar_video.py) y pulir si FAIL;Entregar carpeta y LEEME al CEO"
```

## Verificación mínima (pega la salida real como evidencia)

```bash
E="<carpeta de entrega>"
ffprobe -v error -show_entries stream=codec_name,profile,width,height,pix_fmt,sample_rate:format=duration -of compact "$E/video-youtube.mp4"
ffmpeg -nostats -i "$E/video-youtube.mp4" -af ebur128=peak=true -f null - 2>&1 | sed -n '/Summary/,$p'
python3 -c 'import json,sys; m=json.load(open(sys.argv[1])); print(m["cortes_verificados"]["ok"], m["comprobaciones_youtube"])' "$E/montaje.json"
ffprobe -v error -show_entries stream=width,height:format=duration -of compact "$E/short-youtube.mp4" "$E/miniatura.png"
```

## Instalar en el Mac (gratis, una vez)

- `brew install node ffmpeg` (si tu ffmpeg no trae `drawtext`, los rótulos se pintan con el Chromium de Playwright;
  `brew install ffmpeg-full` lo trae). `python3` del sistema sirve.
- Fuentes de marca: Sora y JetBrains Mono (Google Fonts, licencia OFL) en `~/Library/Fonts` o una carpeta pasada con
  `--fuentes`. Si no están, usa una fuente del sistema y **avisa** (`⚠ no encuentro Sora…`).
- Opcional: `brew install whisper-cpp` + un modelo (`ggml-base.bin` en `~/.cache/whisper.cpp/`) para subtitular la voz.
- Música: solo la del CEO o libre de derechos (Biblioteca de audio de YouTube). Voz en off: grábala en QuickTime o
  con `say -v Paulina -o voz.aiff "…"` (voz del sistema, gratis).

## Conectores (comprueba con ToolSearch antes de prometer)

- **Canva**: miniatura alternativa con el kit de marca (`list-brand-kits`, `export-design`); `generate-*` y
  `remove-background` pueden gastar cuota → solo con «sí».
- **Fonts**: `recommend_fonts` / `detect_font_regions` para revisar la tipografía de la miniatura.
- **Abency**: borradores de publicación en redes con el Short (`create_post` sin `scheduled_at` = borrador);
  programar o publicar solo con «sí».
- **Higgsfield AI**: consume créditos → solo si el CEO lo pide explícitamente.
- La subida a YouTube no tiene conector aquí: es manual en YouTube Studio.

## Referencias

- `references/guion-departamentos.md` — formato del guion y estructura del video general y de cada departamento.
- `references/metadatos-youtube.md` — plantilla de título, descripción, capítulos y etiquetas, con los límites de YouTube.
- `references/miniatura-y-shorts.md` — guía de miniatura y de Shorts (zonas seguras, duración, gancho).
- `references/plantillas/` — guiones listos para copiar (`guion-estudio.txt`, `guion-departamento.txt`).

## Problemas frecuentes

| Mensaje | Solución |
|---|---|
| `No hay un ffmpeg utilizable` | `brew install ffmpeg` (o `ffmpeg-full`); `JOM_FFMPEG=/ruta/ffmpeg` para forzar uno |
| `este ffmpeg no trae drawtext` | normal con el ffmpeg mínimo: pinta los rótulos con Chromium (hace falta haber corrido `--solo-preparar`) |
| `el audio es silencio` | los clips grabados no traen sonido: añade `--musica` y/o `--voz` (sin audio no hay loudnorm) |
| `capítulos: solo N capítulo(s)` | YouTube necesita ≥ 3 de ≥ 10 s: más secciones o `duracion:` mayor |
| `corte …: previsto X, medido Y → uso el medido` | informativo: los capítulos ya usan el corte real |
| `el Short solo admite N sección(es)` | demasiadas secciones para 58 s: pon `short: no` en las menos importantes |
| una página `✖` al grabar | mira `errores_js` y `acciones` en el manifiesto; vuelve a grabar solo esa con `--solo NN` |
