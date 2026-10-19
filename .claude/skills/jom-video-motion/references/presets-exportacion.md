# Presets de exportación (`scripts/pulir-video.sh --preset …`)

`--preset` es repetible o va con comas (`--preset web-alfa,poster`). Sin `--preset`: `web-alfa` si la fuente
tiene alfa (o se le quitó el verde), `social` si no. Nombres de salida: `<nombre>__web.webm`, `__web.webp`,
`__web-hevc.mov`, `__social.mp4`, `__poster.png` / `.webp`, en `./video-pulido` (o `-o carpeta`). Si el
archivo ya existe, añade `-2`, `-3`… **Nunca sobrescribe.**

## `web-alfa` — personajes transparentes del Home

| Salida | Comando (lo que ejecuta el script) | Para |
|---|---|---|
| WebM VP9 + alfa | `-c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0 -row-mt 1 -b:v 0 -crf 30 -deadline good -cpu-used 2` + etiquetas bt709 rango tv | Chrome, Edge, Firefox |
| WebP animado | `-c:v libwebp_anim -quality 80 -compression_level 6 -loop 0` a ≤ 30 fps, luego `webpmux -set bgcolor 0,0,0,0` | respaldo universal (`<img>`) |
| HEVC + alfa `.mov` | `-c:v hevc_videotoolbox -allow_sw 1 -alpha_quality 0.75 -b:v 3M -tag:v hvc1` desde `bgra` | Safari (solo se genera en macOS: hevc_videotoolbox) |

Por qué así:
- `-auto-alt-ref 0` es **obligatorio**: los cuadros alt-ref de libvpx no llevan alfa y el WebM sale opaco o
  corrupto en algunos navegadores.
- `-row-mt 1`: codifica por filas en paralelo (mucho más rápido en el Mac, misma calidad).
- `-b:v 0 -crf 30`: calidad constante. La cadena alfa sin verde midió que de CRF 20 a 38 el error de composición
  cambia < 0,03 y CRF 30 pesa 2,6× menos que 20.
- `webpmux -set bgcolor 0,0,0,0`: algunos visores pintan el color de fondo del lienzo; transparente evita la caja.
- Sin audio: el autoplay de la web va muteado.

Comprobación (la hace el banco de pruebas y debes hacerla tú antes de entregar):
```bash
ffmpeg -hide_banner -c:v libvpx-vp9 -i out__web.webm -frames:v 1 -f null - 2>&1 | grep -o "wrapped_avframe, [a-z0-9]*"
# → yuva420p   (sin -c:v libvpx-vp9 sale yuv420p: por eso hay que forzarlo SIEMPRE al leer)
ffmpeg -v error -c:v libvpx-vp9 -i out__web.webm -vf "alphaextract,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" -f null - \
  | sed -n 's/.*YAVG=//p' | awk '{ s += $1; n++ } END { printf "cobertura alfa media %.1f %%\n", 100 * s / n / 255 }'
# → entre 1 y 99 %: hay transparencia real (100 % = opaco, 0 % = vacío)
python3 scripts/verificar_alfa.py out__web.webm out__web.webp [--fuente original_verde.mp4] --json
```

Marcado en la web (orden de fuentes; compruébalo siempre en Safari y en Chrome reales, porque un navegador puede
elegir una fuente que cree poder reproducir y pintarla sin alfa):
```html
<video autoplay muted loop playsinline preload="metadata" poster="assets/video/x__poster.webp" width="540" height="960">
  <source src="assets/video/x__web-hevc.mov" type='video/mp4; codecs="hvc1"'>
  <source src="assets/video/x__web.webm" type="video/webm">
</video>
<!-- respaldo sin <video>: <img src="assets/video/x__web.webp" alt="" width="540" height="960"> -->
```
Después de cambiar la web: auditoría de protocolos (`scripts/auditar-protocolos.sh`, comprobación
«estación: video») y CSP (`python3 scripts/build_csp.py "<SRC>" --check`) — skill **jom-web**.

## `social` — Reels / TikTok / Shorts

`libx264 -preset slow -crf 18 -profile:v high -pix_fmt yuv420p -g 2×fps`, **1080×1920**, ≤ 60 fps,
`-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv`, `-movflags +faststart`,
audio `aac 192k 48000 Hz estéreo`.
- Si la fuente no es 9:16: recorte centrado (`--encuadre recortar`, por defecto) o fondo difuminado del propio
  video (`--encuadre difuminar`) para no perder los bordes.
- Si la fuente tiene alfa: se aplana sobre `--fondo` (por defecto `050505`, el `--color-bg` del Home).
- CRF 18 porque la plataforma recomprime: cuanto mejor llegue, menos bloques tras su compresión.

## `poster` — imagen fija

`thumbnail=n=<hasta 300>` (cuadro más representativo, no el primero: el primero suele ser negro o de transición)
→ `__poster.png` (RGBA si hay alfa) y `__poster.webp` (calidad 85). Úsalo como `poster=` del `<video>` y como
miniatura.

## YouTube horizontal (16:9)

No hay preset propio: el montaje lo hace **jom-youtube** (`scripts/montar-youtube.sh`). Para auditar un 16:9:
`python3 scripts/auditar_video.py video.mp4 --perfil social-vertical --umbral aspecto=16:9`.
`--preset social` siempre reencuadra a 1080×1920: sirve para el Short, no para el 16:9.
