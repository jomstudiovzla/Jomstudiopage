---
name: jom-video-motion
description: Auditar, pulir y exportar los videos de JOM Studio con evidencia medida - personajes transparentes del Home (assets/video/video_*.webm/.webp), ciclos en loop (assets/personajes/*/caminar_animado.webp) y Reels/Shorts/TikTok 9:16. Cubre formato y cadencia, edición (negros, congelados, tirones, cortes, bandas, niveles, parpadeo), motion y loops sin costura, 60 fps, estabilizar, audio a −14 LUFS / −1 dBTP, recorte de fondo verde con alfa real y tipografía dentro de los márgenes seguros 9:16. Úsalo cuando el CEO diga «activa el skill de movimientos de video», «audita / revisa / pule este video», «quita el fondo verde», «haz el loop», «que no salte», «pásalo a 60 fps», «estabiliza», «normaliza el audio», «pon el rótulo», «exporta para la web / para redes», «revisa la tipografía del video», o cuando otro flujo (jom-estudio, jom-youtube, jom-web dpto. 03 Arte IA o 05 Audio UGC) vaya a entregar un .mp4/.mov/.webm/.webp. No sirve para modelos 3D (.glb) ni para montar un video de YouTube desde cero (eso es jom-youtube; sus salidas sí se auditan aquí).
---

# JOM Video Motion · auditar → pulir → exportar, con números

Todo es **local y gratis**: ffmpeg/ffprobe, el `python3` del Mac (3.9, solo biblioteca estándar) y herramientas
opcionales de Homebrew. Nada de APIs de IA ni servicios de pago (Higgsfield gasta créditos: solo si el CEO lo pide
explícitamente). Los originales **nunca** se tocan: todo lo nuevo sale a otra carpeta.

| Herramienta | Qué hace | Salida |
|---|---|---|
| `scripts/auditar_video.py` | mide formato, edición, motion/loop, audio, alfa y tipografía; PASS/WARN/FAIL por video | tabla, `--json`; exit 1 si hay FAIL, 2 si no pudo |
| `scripts/pulir-video.sh` | recetas no destructivas + presets de exportación; re-audita al final | `./video-pulido/<nombre>__web.webm` … |
| `scripts/alfa-sin-verde.sh` (cadena alfa) | quita la pantalla verde midiendo la clave; lo llama `pulir-video.sh` solo | `<OUT>/<nombre>.webm/.webp/.mov` |
| `scripts/verificar_alfa.py` (cadena alfa) | halo verde, fuga de clave, sujeto cortado, parpadeo de cobertura | tabla o `--json`; el auditor lo incorpora |
| `scripts/probar-video-motion.sh` | banco de pruebas: genera videos limpios y con defectos y comprueba toda la cadena | tabla antes → después |

`alfa-sin-verde.sh` y `verificar_alfa.py` son de otro flujo (cadena «alfa sin pantalla verde»): **se usan por su
interfaz, no se editan desde aquí**. Si no existen, el auditor y `pulir-video.sh` lo dicen y siguen sin ellos.

Referencias (léelas cuando toque, no de memoria):
- `references/umbrales.md` — cada umbral, su valor por perfil y por qué.
- `references/recetas-ffmpeg.md` — qué filtro hay detrás de cada bandera, recetas de motion a mano (boomerang,
  cámara lenta, push-in, motion blur, hold, fundido de alfa) y tabla «hallazgo → arreglo».
- `references/presets-exportacion.md` — web-alfa / social / poster, marcado `<video>` y comprobación del alfa.
- `references/tipografia-marca.md` — fuentes de marca (Sora + JetBrains Mono), rótulos y márgenes seguros 9:16.

## 0 · Preparar (una vez por sesión)

```bash
REPO="$HOME/Documents/Antigravity/JOM Studio/Portafolio"     # el clon de Jomstudiopage en el Mac
WEB="$REPO/demos/light-concepts"                              # la web nueva (solo en el Mac, sin commit)
cd "$REPO"
command -v ffmpeg ffprobe anim_dump webpmux tesseract          # webp y tesseract: brew install webp tesseract tesseract-lang
ffmpeg -hide_banner -filters  | grep -E " (vidstabdetect|minterpolate|drawtext|loudnorm) "
ffmpeg -hide_banner -encoders | grep -E "libvpx-vp9|libwebp_anim|libx264|hevc_videotoolbox"
# huella de los originales para demostrar al final que siguen intactos
find "$WEB/assets/video" "$WEB/assets/personajes" -type f -print0 | xargs -0 shasum -a 256 > "${TMPDIR:-/tmp}/jom-huella-videos.txt"
```
Si falta algo, **degrada y dilo**: sin `anim_dump` no hay análisis de píxeles del WebP; sin `tesseract`, la
tipografía queda «SKIP»; sin `vidstabdetect`, `--estabilizar` avisa y no estabiliza; sin `hevc_videotoolbox`
(fuera de macOS) no hay `.mov` HEVC alfa para Safari.

## Flujo obligatorio (no te saltes pasos; cada «funciona» sale de un comando ejecutado)

**1 · Auditar los originales**
```bash
python3 scripts/auditar_video.py "$WEB/assets/video" "$WEB/assets/personajes" --solo-problemas
python3 scripts/auditar_video.py "$WEB/assets/video" "$WEB/assets/personajes" --json > "${TMPDIR:-/tmp}/jom-videos-antes.json"
```
Perfil automático: `caminar_animado` / `loop` / `ciclo` en el nombre → `loop`; WebM, WebP o con alfa →
`web-personaje`; el resto → `social-vertical`. Fuérzalo con `--perfil` si el nombre engaña. Cada video con
problemas imprime su arreglo exacto (`→ arreglo: scripts/pulir-video.sh "…" --recortar-fin 2.033 …`).
Las PNG (`idle_transparent.png`) no son video: compruébalas con `python3 scripts/verificar_alfa.py <png>`.

**2 · Alfa sin verde (solo si el clip trae fondo)**
```bash
python3 scripts/auditar_video.py --detectar-verde "clip.mp4"          # {"verde": true, "votos": 3, …}
```
No hace falta llamarlo a mano: `pulir-video.sh` lo detecta y delega en `scripts/alfa-sin-verde.sh`
(`OUT=<temporal> alfa-sin-verde.sh <clip>`), que **mide** la clave y verifica el alfa. Para forzarlo:
`--recortar-verde`; para no hacerlo: `--ignorar-verde`. A mano: `OUT="$PWD/alfa-out" scripts/alfa-sin-verde.sh "clip.mp4"`.
Si `alfa-sin-verde.sh` no existe, `pulir-video.sh` avisa y **no** recorta (nunca un chromakey de umbral fijo).

**3 · Pulir**
```bash
scripts/pulir-video.sh "<video>" --auto -o video-pulido               # aplica lo que pide el auditor
scripts/pulir-video.sh "<video>" --auto --loop-sin-costura=0.3 --preset web-alfa,poster   # + lo tuyo (manda lo manual)
```
Orden fijo de las recetas: verde → recortes → desentrelazar → bandas → deduplicar/CFR → color → antiparpadeo →
quitar negros → estabilizar → 60 fps → loop → audio → texto (en la exportación). Banderas en `--help` y en
`references/recetas-ffmpeg.md`. Carpetas: `scripts/pulir-video.sh "$WEB/assets/video" --auto -o video-pulido`
(salta la propia carpeta de salida).

**4 · Re-auditar** — `pulir-video.sh` re-audita sus salidas al terminar (desactívalo solo con `--sin-auditar`).
A mano: `python3 scripts/auditar_video.py video-pulido --perfil <perfil>`. Repite 3→4 hasta **0 FAIL**. Cada
WARN que quede se justifica en el informe (p. ej. «en doses = estilo», «salto en el corte de --quitar-negros»).

**5 · Exportar presets** (en la misma llamada de pulir o en otra sobre el master: `--conservar-master`)
- Web: `--preset web-alfa,poster` → WebM VP9 yuva420p + WebP animado + HEVC alfa `.mov` (en el Mac) + póster.
- Redes: `--preset social` → MP4 H.264 1080×1920 yuv420p +faststart, AAC 48 kHz (−14 LUFS si `--normalizar-audio`).

**6 · Verificar alfa y tipografía**
```bash
W="video-pulido/<nombre>__web.webm"
ffmpeg -hide_banner -c:v libvpx-vp9 -i "$W" -frames:v 1 -f null - 2>&1 | grep -o "wrapped_avframe, [a-z0-9]*"   # → yuva420p
python3 scripts/verificar_alfa.py "$W" "video-pulido/<nombre>__web.webp" [--fuente "clip verde.mp4"] --json
python3 scripts/auditar_video.py video-pulido/<nombre>__social.mp4 --perfil social-vertical --ocr   # márgenes y tamaño de texto
```
Si el video va en una página: `scripts/auditar-tipografia.sh "$WEB"` y `scripts/auditar-protocolos.sh` (skill
jom-web). Al final, originales intactos: `shasum -a 256 -c "${TMPDIR:-/tmp}/jom-huella-videos.txt"` → todo `OK`.

**Sustituir en la web** solo con el «sí» del CEO: copia la salida aprobada con **otro nombre**
(`video_1_caminar_ida_y_vuelta.v2.webm`), cambia la referencia en el HTML y pasa la auditoría de jom-web. El
original se queda donde estaba.

## Umbrales clave (detalle y justificación en `references/umbrales.md`; cambia cualquiera con `--umbral k=v`)

| Área | FAIL si… | Por qué |
|---|---|---|
| Formato | social no 9:16, VFR > 5 % de intervalos, entrelazado, códec/pix_fmt fuera del perfil, < 20 fps | las plataformas recortan, duplican cuadros o muestran peine |
| Edición | negro en medio, congelado ≥ 1,5 s, ≥ 1 tirón/s, fotograma suelto (≤ 2 cuadros) entre cortes, bandas (social), > 5 % fuera de rango, parpadeo RMS ≥ 2,5 | son fallos de montaje visibles en el primer visionado |
| Motion | ≥ 2 saltos de movimiento; costura del loop > 2,5× un paso normal con SSIM < 0,99 (perfil loop) | el ojo detecta la vuelta del loop si cambia más que un paso |
| Audio (social) | fuera de −14 ± 3 LUFS, true peak > −1 dBTP, clipping | normalización de las plataformas y picos tras recomprimir en AAC |
| Alfa (web) | sin alfa, opaca, verde sin recortar, > 2 cuadros vacíos, `verificar_alfa.py` FALLA | caja negra/verde o personaje que desaparece en el Home |
| Tipografía (social) | palabra fuera de x 6–94 % / y 10–85 %, línea < 1,2 % del alto | UI de Reels/TikTok/Shorts encima; ilegible en móvil |

## NUNCA

- **Sobrescribir ni borrar originales** (`video_*.webm/.webp`, `caminar_animado.webp`, `idle_transparent.png`, `*.glb`).
  Ni `ffmpeg -y` sobre la entrada ni `mv` de una salida encima. `pulir-video.sh` escribe en otra carpeta y añade `-2`.
- **Chromakey/colorkey de umbral fijo sin medir** (`chromakey=0x00FF00:0.12:0.08`): un verde real nunca es 0x00FF00;
  medido en la cadena alfa, esa fórmula deja el 100 % del fondo de estudio opaco o el 15 % del verde IA, y el
  despill global agrisa la ropa verde. Usa `alfa-sin-verde.sh` (mide la clave en el borde) o nada.
- **Exportar VP9 con alfa sin `-auto-alt-ref 0`** (ni sin `-pix_fmt yuva420p`): los alt-ref no llevan alfa.
- **Leer un WebM con alfa sin `-c:v libvpx-vp9` antes de `-i`**: el decodificador nativo da `yuv420p` y parece que
  «no tiene alfa». Lo mismo al extraer pósters, medir o volver a codificar.
- Leer un WebP animado con ffmpeg (no lo decodifica) o sus cuadros a fps fijo ignorando las duraciones.
- Normalizar audio en una pasada o subir ganancia a pelo sobre un audio con clipping (bombea / distorsiona).
- Boomerang en un ciclo de **caminar** (los pies van hacia atrás); interpolar a 60 fps un ciclo dibujado sin
  mirar el póster (gelatina).
- Dar un video por bueno sin ejecutar el auditor, o inventar números. Si algo no se pudo medir, se dice «SKIP» y por qué.
- Publicar, subir o hacer commit de videos sin el «sí» del CEO. Editar `alfa-sin-verde.sh` o `verificar_alfa.py`.

## Cómo reportar

Informe corto, con lo medido (copia valores de la tabla o del `--json`, no los redondees a tu favor):

```
## Videos · <fecha>
| Video | Perfil | Antes | Después | Arreglo | Métrica clave antes → después |
|---|---|---|---|---|---|
| video_1_caminar_ida_y_vuelta.webm | web-personaje | ✖ FAIL | ✔ PASS | --loop-sin-costura | costura 3,7× → 1,1× · alfa 12,7 % |
Salidas: /ruta/absoluta/video-pulido/… (WebM, WebP, póster; .mov solo en el Mac)
Originales: intactos (shasum -c: 9/9 OK)
WARN aceptados: … (motivo)
Omitido: … (herramienta que faltaba)
Pendiente del CEO: «sí» para sustituir en la web
```
Adjunta las rutas de `jom-videos-antes.json` y del JSON después. Exit codes del auditor: 0 sin FAIL, 1 con FAIL,
2 error de uso o sin ffmpeg.

## Plan con jom-estado (si lo orquesta jom-estudio)

```bash
J="$HOME/.claude/jom/jom-estado.py"     # o "$REPO/scripts/jom-estado.py"
python3 "$J" iniciar "Videos del Home perfectos" --plan video-motion \
  --dod "auditar_video.py sin FAIL en las salidas; alfa yuva420p verificada con libvpx-vp9 y verificar_alfa.py; tipografía dentro del margen; originales intactos (shasum -c)" \
  --pasos "Preparar y huella de originales;Auditar originales (--json);Alfa sin verde si hay fondo;Pulir (--auto + recetas);Re-auditar hasta 0 FAIL;Exportar presets (web-alfa,poster / social);Verificar alfa y tipografía;Informe y «sí» del CEO para sustituir"
```

## Banco de pruebas (para comprobar la cadena tras cualquier cambio)

```bash
scripts/probar-video-motion.sh "${TMPDIR:-/tmp}/jom-prueba-video"     # completo (~18 min en el contenedor de pruebas)
SOLO_AUDITAR=1 scripts/probar-video-motion.sh                          # solo detección (~6 min)
```
Genera con ffmpeg 3 videos limpios (Reel con audio a −14 LUFS, personaje VP9 alfa, ciclo WebP) y 15 defectos a
propósito; exige PASS en los limpios, el FAIL esperado en cada defecto y PASS tras pulir; verifica el alfa del VP9
exportado con `-c:v libvpx-vp9`. Sale 1 si algo no es lo esperado. Resultado medido: ver «Evidencia» abajo.

## Evidencia (última ejecución del banco de pruebas)

Ejecutado el 19-10-2026 en el contenedor Linux (ffmpeg con libvidstab, tesseract, anim_dump/webpmux; sin
`hevc_videotoolbox`), con `PYTHON=python3.9` (misma versión que el Mac) y una carpeta con espacios:
**40 comprobaciones esperadas ✔, 0 ✖, exit 0, 18 min 22 s.**

| Caso | Chequeo | Antes | Después | Métrica antes → después | Veredicto final |
|---|---|---|---|---|---|
| 3 limpios (Reel, personaje VP9 alfa, ciclo WebP) | veredicto | PASS | — | — | PASS |
| negros | negro en medio | FAIL | PASS | tramos [0–0,5 s], [2,0–2,23 s] → ninguno | WARN (1 salto en el corte de `--quitar-negros`, es un corte) |
| congelado | congelado al final | FAIL | PASS | 2,97–5,0 s → ninguno | PASS |
| tirones | duplicados | FAIL | PASS | 4,83 tirones/s → 0 | PASS |
| vfr | cadencia | FAIL | PASS | 46,2 % intervalos irregulares → 0 % | WARN (1 salto heredado de un PTS irregular de la fuente en 4,63 s) |
| 16x9 | aspecto | FAIL | PASS | 1,7778 → 0,5626 | PASS |
| loop_salto | costura | FAIL | PASS | 3,67× un paso → 0,88× | PASS |
| audio | loudness / true peak / clipping | FAIL ×3 | PASS ×3 | −5,5 LUFS → −14,0 · TP 0,0 → −8,2 dBTP · pico +0,66 dBFS con 12,07 % de muestras a < 1 dB de 0 → −8,20 dBFS, 0 % | PASS |
| letterbox | bandas | FAIL | PASS | 240 px → 0 | PASS |
| entrelazado | entrelazado | FAIL | PASS | idet 100 % TFF → progresivo | PASS |
| parpadeo | parpadeo | FAIL | PASS | RMS 3,97 → 0,68 | PASS |
| niveles | niveles | FAIL | PASS | Y 0–210, negro aplastado 20,3 % → Y 5–248, 0 % | PASS |
| saltos | suavidad | FAIL | — | 2 saltos (sin receta: hay que regenerar los cuadros perdidos) | FAIL |
| verde | canal alfa | FAIL | PASS | fondo verde → alfa cobertura 12,7 % (vía alfa-sin-verde.sh) | PASS |
| texto | margen seguro / tamaño | FAIL / FAIL | — | 21 palabras fuera · línea 0,89 % del alto | FAIL (texto quemado: se rehace) |
| rótulo `--texto "JOM STUDIO"` | texto en pantalla → margen | PASS | PASS | 8 palabras OCR, todas dentro | PASS |
| personaje `--60fps` | fps / veredicto | 30 | 60 | costura 1,6× un paso (ciclo interpolado también en la vuelta) | PASS |
| VP9 alfa exportado | pix_fmt con `-c:v libvpx-vp9` | — | yuva420p | cobertura alfa 12,0 %; sin forzar el decodificador: yuv420p | — |
| WebP de respaldo · póster · `--estabilizar` con alfa | canal alfa / archivo / vidstab | — | PASS | alfa 12,0 % · PNG creado · 3 pasos ✔ | PASS |

No probado aquí (no existe en Linux): `.mov` HEVC alfa con `hevc_videotoolbox`; en el Mac se genera y se comprueba
con el mismo `--preset web-alfa`.
