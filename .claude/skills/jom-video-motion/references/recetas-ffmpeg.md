# Recetas ffmpeg de edición y motion (JOM Studio)

Lo normal es **no** escribir ffmpeg a mano: `scripts/pulir-video.sh` aplica estas recetas en orden, sobre un
master FFV1 sin pérdida, y re-audita. Este archivo sirve para entender qué hace cada bandera, para casos que el
script no cubre y para diagnosticar. Todas las salidas van a archivos **nuevos**.

Reglas que valen para todas:
- WebM con alfa: `-c:v libvpx-vp9` **antes** de `-i` para leerlo (el decodificador nativo de VP9 descarta el alfa)
  y `-pix_fmt yuva420p -auto-alt-ref 0 -row-mt 1` para escribirlo.
- WebP animado: ffmpeg 6/7 no lo decodifica. Vuelca los cuadros con `anim_dump -folder dump -prefix f_ x.webp`
  (`brew install webp`) y respeta las duraciones: libwebp fusiona cuadros idénticos en uno más largo
  (`pulir-video.sh` y `auditar_video.py` los repiten según su duración; si lees `f_%04d.png` a fps fijo, el tiempo
  se comprime y aparece un tirón falso).
- Si hay alfa, trabaja en `yuva420p` (o `gbrap` para color) y separa/une con `alphaextract` / `alphamerge` cuando un
  filtro no la conserve.

## 1. Diagnóstico (lo que mide el auditor, por si quieres verlo suelto)

```bash
V="clip.mp4"
ffmpeg -hide_banner -i "$V" -vf "blackdetect=d=0.02:pix_th=0.10" -an -f null - 2>&1 | grep black_start   # negros
ffmpeg -hide_banner -i "$V" -vf "freezedetect=n=-60dB:d=0.4" -an -f null - 2>&1 | grep freeze_           # congelados
ffmpeg -hide_banner -i "$V" -vf "mpdecimate,showinfo" -an -f null - 2>&1 | grep -c "n:"                  # cuadros no repetidos
ffmpeg -hide_banner -i "$V" -vf "scdet=threshold=35" -an -f null - 2>&1 | grep lavfi.scd.time            # cortes
ffmpeg -hide_banner -i "$V" -vf "cropdetect=limit=20:round=2:reset=0" -an -f null - 2>&1 | tail -1       # bandas
ffmpeg -hide_banner -i "$V" -vf "idet" -an -f null - 2>&1 | grep "Multi frame"                           # entrelazado
ffmpeg -hide_banner -i "$V" -vf "vfrdet" -an -f null - 2>&1 | grep VFR                                   # cadencia
ffmpeg -hide_banner -i "$V" -vf "signalstats,metadata=print:key=lavfi.signalstats.YAVG" -an -f null - 2>&1 | grep YAVG | head
ffmpeg -hide_banner -i "$V" -map 0:a -af "ebur128=peak=true" -f null - 2>&1 | sed -n '/Summary/,$p'      # LUFS y true peak
# costura del loop: SSIM entre el último y el primer cuadro (WebM con alfa: -c:v libvpx-vp9 antes de cada -i;
# el auditor además compone sobre gris y lo compara con los pasos normales, que es lo que cuenta)
ffmpeg -v error -i "$V" -frames:v 1 -y primero.png
ffmpeg -v error -sseof -0.5 -i "$V" -update 1 -y ultimo.png
ffmpeg -hide_banner -i ultimo.png -i primero.png -lavfi "[0][1]ssim" -f null - 2>&1 | grep -o "All:[0-9.]*"
```

## 2. Edición (`pulir-video.sh` aplica estas en este orden)

| Bandera | Filtro | Notas |
|---|---|---|
| `--recortar-inicio T` / `--recortar-fin T` | `trim=start=…:end=…,setpts=PTS-STARTPTS` (+ `atrim`) | `T` en segundos (`1.5`) o cuadros (`12f`). El auditor da el valor exacto. |
| `--desentrelazar` | `bwdif=mode=send_frame:parity=auto:deint=all` | Mejor que yadif en movimiento; mantiene la cadencia. |
| `--quitar-bandas` | `cropdetect` → `crop=W:H:X:Y` | No aplica con alfa (lo transparente no son bandas). Para social, el preset reencuadra luego a 1080×1920. |
| `--deduplicar` | `mpdecimate=max=2,minterpolate=fps=F:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1` | `max=2`: quita tirones de 1–2 duplicados y conserva pausas intencionadas largas. |
| VFR (automático) | `minterpolate=fps=F:…` + `fps=F` | Siempre se sale a cadencia constante (`--cfr` es implícito). |
| `--color` | `scale=in_color_matrix=…,format=gbrp,colorlevels=romin=0.02:…:romax=0.98,scale=out_range=tv:out_color_matrix=bt709` | Suave: levanta 2 % los negros y baja 2 % los blancos, a rango limitado y bt709. Con alfa usa `gbrap`. |
| `--antiparpadeo` | `deflicker=size=7:mode=pm` | Para latidos de exposición; no arregla un parpadeo de alfa (eso es de la cadena alfa). |
| `--quitar-negros` | `blackdetect` → `select='not(…)'` + `aselect` | Corta los tramos negros en medio sin desincronizar el audio. |
| `--estabilizar` | `vidstabdetect=shakiness=6:accuracy=15` → `vidstabtransform=smoothing=30:optzoom=1:interpol=bicubic,unsharp=5:5:0.6:3:3:0.3` | Dos pasadas. Con alfa aplica la misma transformación al color y al alfa (`split` + `alphaextract` + `alphamerge`). Si `ffmpeg -filters` no lista `vidstabdetect`, avisa y no estabiliza (el ffmpeg de Homebrew lo trae). |
| `--60fps` | `minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1` | Interpolación por movimiento. `--60fps=duplicar` usa `fps=60` (sin artefactos, sin suavidad nueva). En personajes dibujados a 12–15 fps, la interpolación puede deformar extremidades: revisa el póster y, si se ve gelatina, usa `duplicar`. En ciclos (perfil `loop`/`web-personaje`, `--loop-sin-costura` o fuente con alfa) se añaden los 3 primeros cuadros al final, se interpola y se recorta a la duración original: así también se interpola la vuelta último → primero (medido en el personaje de prueba: costura 2,0× → 1,6× un paso, 239 → 240 cuadros). |
| `--loop-sin-costura[=S]` | `split` → `trim` → `xfade=transition=custom:expr='A*(P*P*(3-2*P))+B*(1-P*P*(3-2*P))':duration=S:offset=D-2S` (+ `acrossfade`) | El final se funde con el inicio con curva suave (smoothstep); el clip pierde `S` segundos. El fundido lineal (`transition=fade`) arranca y frena de golpe: en el fixture `defecto_loop_salto` dejaba 5 «saltos» de suavidad; smoothstep, 0. 0,5 s por defecto; usa 0,2 en clips de < 1,25 s. |
| `--normalizar-audio` | (`adeclip` si el pico > −0,1 dBFS) → `loudnorm=I=-14:TP=-1.5:LRA=11` en dos pasadas (`measured_*`, `linear=true`) | Dos pasadas = ganancia lineal, sin bombeo. TP −1,5 deja margen para AAC. |
| `--sin-audio` | `-an` | Para la web: autoplay va muteado, el audio es peso inútil. |
| `--texto "…"` | `drawtext=fontfile=…:textfile=…:expansion=none` | Ver `tipografia-marca.md`. `textfile` + `expansion=none`: comillas, `%` y `:` no rompen el filtro. |

## 3. Motion / acción (recetas a mano, probadas en el banco de pruebas)

Todas conservan el alfa (comprobado: decodificando con `-c:v libvpx-vp9` sale `yuva420p`).

```bash
VP9A="-c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0 -row-mt 1 -b:v 0 -crf 30"

# Boomerang (ida y vuelta perfecta): N = número de cuadros
N=$(ffprobe -v error -count_packets -select_streams v:0 -show_entries stream=nb_read_packets -of csv=p=0 in.webm)
ffmpeg -c:v libvpx-vp9 -i in.webm -filter_complex \
  "[0:v]format=yuva420p,split[a][b];[b]reverse,trim=start_frame=1:end_frame=$((N-1)),setpts=PTS-STARTPTS[r];[a][r]concat=n=2:v=1:a=0[v]" \
  -map "[v]" $VP9A out-boomerang.webm
# Medido: costura 3,7× → 1,2× un paso normal (FAIL → PASS en perfil loop).
# OJO: solo para movimientos simétricos (respirar, gesticular, flotar). En un ciclo de CAMINAR los pies irían
# hacia atrás («moonwalk»): para «ida y vuelta» el personaje tiene que girar (hflip en la vuelta) o usar el
# ciclo original.

# Cámara lenta 0,5× interpolada (acción) con audio a la misma velocidad
ffmpeg -i in.mp4 -filter_complex "[0:v]setpts=2*PTS,minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1[v];[0:a]atempo=0.5[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -crf 18 -pix_fmt yuv420p out-lento.mp4

# Push-in suave (zoom 1,00 → 1,08 con ease-in-out) para un Reel; F = cuadros totales − 1
ffmpeg -i in.mp4 -vf "scale=2160:3840:flags=lanczos,zoompan=z='1+0.08*(0.5-0.5*cos(PI*on/149))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30" \
  -c:v libx264 -crf 18 -pix_fmt yuv420p out-pushin.mp4
# Escalar ×2 antes de zoompan evita el temblor de subpíxel típico de zoompan.

# Desenfoque de movimiento ligero en una acción rápida (3 cuadros, pesos 1-2-1), con alfa
ffmpeg -c:v libvpx-vp9 -i in.webm -vf "format=yuva420p,tmix=frames=3:weights='1 2 1'" $VP9A out-blur.webm

# Pausa (hold) de 0,5 s al final — p. ej. para que el personaje «remate» un gesto
ffmpeg -c:v libvpx-vp9 -i in.webm -vf "format=yuva420p,tpad=stop_mode=clone:stop_duration=0.5" $VP9A out-hold.webm
# (el auditor lo verá como «congelado al final» ≥ 0,5 s: WARN esperado; documéntalo en el informe)

# Aparición: fundido del alfa en 0,3 s
ffmpeg -c:v libvpx-vp9 -i in.webm -vf "format=yuva420p,fade=t=in:st=0:d=0.3:alpha=1" $VP9A out-fadein.webm
```

## 4. Qué arreglo para qué hallazgo

| Hallazgo del auditor | Receta | Si no se puede arreglar |
|---|---|---|
| negro al inicio / al final | `--recortar-inicio` / `--recortar-fin` (valor exacto en la tabla) | — |
| negro en medio | `--quitar-negros` | — |
| congelado al inicio / final | `--recortar-inicio` / `--recortar-fin` | congelado en medio: re-exportar desde la fuente |
| duplicados/tirones | `--deduplicar` | «en doses» (WARN): decidir si es estilo |
| cadencia VFR / fps declarado≠real | automático (siempre CFR) | — |
| fps bajo | `--60fps` (o `=duplicar`) | — |
| aspecto / resolución / bitrate / faststart / pix_fmt | `--preset social` (redes) o `--preset web-alfa` (web) | — |
| bandas negras | `--quitar-bandas` | — |
| entrelazado | `--desentrelazar` | — |
| niveles / etiquetas de color / rango | `--color` | — |
| parpadeo | `--antiparpadeo` | parpadeo del alfa: rehacer con alfa-sin-verde |
| suavidad: saltos | — | cuadros perdidos en el render: re-exportar desde la fuente; no se inventan |
| costura del loop | `--loop-sin-costura` (o boomerang si es simétrico) | — |
| micro-pausa en la costura | `--recortar-fin 1f` | — |
| loudness / true peak / clipping | `--normalizar-audio` (incluye `adeclip`) | clipping muy fuerte: volver a la pista original |
| audio en video web | `--sin-audio` | — |
| fondo verde sin recortar | automático (delega en `alfa-sin-verde.sh`) o `--recortar-verde` | — |
| texto fuera del margen / pequeño | rehacer el rótulo con `--texto` sobre el limpio | el texto quemado en el original no se puede mover |
