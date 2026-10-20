# Umbrales de `auditar_video.py` y por qué

Todos se pueden cambiar sin tocar código: `--umbral clave=valor` (repetible). `--perfiles` imprime los
valores vigentes de cada perfil. Los perfiles comparten la base `COMUN` y cambian lo que se indica.

| Perfil | Para qué | Diferencias clave |
|---|---|---|
| `web-personaje` | `assets/video/video_*.webm/.webp` del Home (personaje transparente) | alfa **obligatoria**, sin audio, sin OCR, 10–60 fps, ≤ 4 Mb/s y ≤ 8 MB, cortes = WARN |
| `loop` | `assets/personajes/*/caminar_animado.webp`, idles, todo lo que se repite | costura = **FAIL**, alfa opcional, 8–60 fps, 0,4–20 s |
| `social-vertical` | Reels / TikTok / Shorts | MP4 H.264/HEVC, yuv420p, 9:16 = FAIL si no, ≥ 720×1280 (ideal 1080×1920), VFR = FAIL, bandas = FAIL, audio −14 LUFS, OCR activado |
| `auto` (por defecto) | elige por nombre y contenido | `loop`/`ciclo`/`caminar_animado` en el nombre → loop; alfa, WebP o WebM → web-personaje; resto → social-vertical |

Para un 16:9 (YouTube horizontal): `--perfil social-vertical --umbral aspecto=16:9` (lo usa jom-youtube).

## Formato

| Clave | Valor | Por qué |
|---|---|---|
| `aspecto`, `aspecto_tol` | 9:16, 1 % | Las tres plataformas verticales recortan o meten bandas si no es 9:16; 1 % admite 1080×1918 por redondeo, no 1080×1350 (4:5). |
| `res_min` / `res_ideal` (social) | 720×1280 / 1080×1920 | Por debajo de 720 de ancho las plataformas lo marcan como baja calidad; 1080×1920 es lo que suben sin reescalar. Menos de 75 % del mínimo = FAIL. |
| `fps_min_fail` / `fps_min_warn` / `fps_max_warn` | 20 / 23,5 / 60,5 (personaje 10/15, loop 8/12) | < 24 fps en video real se ve a saltos; > 60 la web y las redes lo diezman. Los ciclos dibujados a 12 fps son estilo, por eso el loop baja. |
| `fps_decl_tol` | 2 % | Si el contenedor declara 30 y los paquetes llegan a 25, el reproductor duplica o salta cuadros. No se aplica a WebP (no declara fps: cada cuadro trae su duración). |
| `vfr_tol` | 5 % de intervalos irregulares | Se mide con los PTS de los paquetes (más fiable que `vfrdet` en WebM, cuya base es 1 ms). Un VFR de grabación de pantalla da 40–50 %; un CFR limpio da 0 %. En WebP, un cuadro fusionado por libwebp (duración múltiplo exacto) no cuenta como irregular. |
| `dur_min_warn` / `dur_max_warn` | 3 / 180 s (personaje 0,5/30, loop 0,4/20) | Reels/Shorts por debajo de 3 s no cuentan reproducción; un personaje de fondo de más de 30 s es peso inútil. |
| `mbps_max_warn`, `mb_max_warn` | 30 Mb/s social; 4 Mb/s y 8 MB web | 30 Mb/s supera lo que la plataforma conserva al recomprimir. En la web cada MB retrasa el LCP del Home. |
| `pixfmts` (social) | yuv420p | 4:2:2/4:4:4 o 10 bits no se reproducen en todos los móviles. |
| `faststart` (social) | moov antes de mdat | Sin él, el MP4 no arranca hasta descargarse entero. |
| `etiquetas_color` | bt709 en HD | Sin etiquetas cada navegador adivina la matriz: Safari y Chrome pintan gamma distinta. |
| entrelazado | `field_order` o idet con un orden de campo dominante ≥ 85 % y > 60 % de cuadros | En progresivo los falsos positivos de idet se reparten entre TFF y BFF; en entrelazado real domina uno (fixture: 100 %). |

## Edición

| Clave | Valor | Por qué |
|---|---|---|
| `negro_pix_th` | 0,10 | El valor por defecto de `blackdetect`; detección mínima de medio cuadro (`d = 0,5/fps`). Con alfa se compone antes sobre gris medio: lo transparente no es «negro». |
| negro al inicio | WARN < 1 s, FAIL ≥ 1 s | El primer cuadro es el póster y lo que se ve en autoplay. |
| `negro_final_max_s` | 1 s | Un fundido a negro corto es edición; más es cola muerta. |
| negro en medio | siempre FAIL | Es un corte negro accidental. |
| `congelado_warn_s` / `congelado_fail_s` | 0,5 / 1,5 s (`freezedetect n=-60dB d=0.4`) | Medio segundo fijo ya se nota en un personaje que debería respirar; 1,5 s parece un cuelgue. |
| `tirones_warn_s` / `tirones_fail_s` | 0,2 / 1 por segundo | Un tirón es un cuadro repetido (mpdecimate) **con movimiento antes y después** (YDIF vecino ≥ 4× el del cuadro). 25→30 fps por duplicado da ~5/s. Una animación «en doses» (todo duplicado, regular) se marca WARN, no FAIL: puede ser estilo. |
| `corte_umbral` | 0,35 de `scene_score` | Por encima de 0,3–0,4 es cambio de plano; por debajo, movimiento rápido. |
| `flash_max_fot` | 2 cuadros | Un plano de 1–2 cuadros entre cortes es un fotograma suelto del montaje. |
| `bandas_pct` | 1 % del lado (cropdetect `limit=20`) | Menos es ruido de borde del encoder. |
| `negro_puro_warn` / `blanco_puro_warn` | 30 % / 8 % de píxeles en Y ≤ 17 o Y ≥ 234 | Negros aplastados y blancos quemados pierden detalle; un fondo plano de diseño puede dispararlo (el aviso lo dice). |
| `fuera_rango_warn` / `fuera_rango_fail` | 1 % / 5 % (BRNG de signalstats) | En rango limitado, lo que cae fuera de 16–235 se recorta al reproducir. |
| `parpadeo_warn` / `parpadeo_fail` | RMS 1,0 / 2,5 niveles | Se mide la parte de alta frecuencia de YAVG (cada cuadro contra la media de sus vecinos): un fundido o una rampa dan 0; un latido cuadro a cuadro no. |

## Motion / loop

| Clave | Valor | Por qué |
|---|---|---|
| `salto_k`, `salto_min` | YDIF > 2× la mediana local (±6 cuadros) y > 0,3 | Un salto de movimiento aislado (cuadros perdidos o mal empalmados) duplica la diferencia habitual; el mínimo absoluto evita disparos en escenas casi quietas. |
| `saltos_warn` / `saltos_fail` | 1 / 2 | Un salto puede ser un golpe de acción; dos ya son un problema de montaje. |
| `costura_ratio`, `costura_ssim_ok` | (1 − SSIM último→primero) > 2,5 × (1 − SSIM de los pasos vecinos) y SSIM < 0,99 | Se compara la vuelta del loop con los pasos normales junto a la costura: si la vuelta cambia 2,5× más que un paso normal, el ojo ve el salto. SSIM ≥ 0,99 se acepta siempre. En `loop` es FAIL, en `web-personaje` WARN, en social INFO. |
| micro-pausa | SSIM costura ≥ 0,999 con pasos < 0,995 | El último cuadro repite el primero: una pausa por vuelta. Receta `--recortar-fin 1f`. |

## Audio (solo `social-vertical`; en web el audio sobra)

| Clave | Valor | Por qué |
|---|---|---|
| `lufs_obj` | −14 LUFS integrados (`ebur128`) | Es la referencia de normalización de YouTube y la práctica habitual en TikTok/Instagram: más alto, la plataforma lo baja y aplasta la dinámica; más bajo, suena flojo junto a otros videos. |
| `lufs_tol_warn` / `lufs_tol_fail` | ±1 / ±3 LU | ±1 LU es inaudible; ±3 ya se percibe al pasar de un video a otro. |
| `tp_max` | −1 dBTP | Recomendación AES/EBU para distribución con códecs con pérdida: AAC/Opus generan picos entre muestras al recomprimir. `pulir-video.sh` normaliza a −1,5 dBTP para que, tras AAC, siga ≤ −1. |
| clipping | pico > 0 dBFS, o > 1 % de muestras a menos de 1 dB de 0 dBFS, o pico ≥ −0,1 con techo plano | En AAC el recorte no deja «techo plano» sino una montaña de muestras pegadas a 0 dBFS (volumedetect). |
| `silencio_db` / `silencio_max_s` | −50 dB / 2 s | Un hueco de 2 s en mitad de un Reel parece un fallo de audio. |

## Tipografía (OCR con tesseract; por defecto solo en `social-vertical`)

| Clave | Valor | Por qué |
|---|---|---|
| `margen_lat` / `margen_sup` / `margen_inf` | 6 % / 10 % / 15 % (en 1080×1920: x 65–1015, y 192–1632 px) | Zona que no tapan los botones laterales, la barra superior ni el pie con usuario, texto y música de Reels/TikTok/Shorts. |
| `margen_generico` | 5 % | Videos no verticales. |
| `texto_min_warn` / `texto_min_fail` | 1,8 % / 1,2 % del alto (≈ 35 / 23 px en 1920) | Por debajo de ~35 px a 1920 la letra se lee mal en un móvil a distancia de brazo. |
| `ocr_conf`, `ocr_muestras` | 70 % / 4 cuadros | Por debajo de 70 % tesseract inventa palabras sobre texturas. Cada cuadro se lee en tres variantes (color, gris, umbral de brillo) y otra vez **con lo ya leído tapado**: con un titular grande, tesseract descarta la letra pequeña como ruido (medido: 22 px junto a 110 px → 0 palabras; tapando el titular → 3 de 3). |

## Alfa

| Comprobación | Regla |
|---|---|
| canal alfa | Se decodifica con `-c:v libvpx-vp9` si el WebM declara `alpha_mode=1` (el decodificador nativo lo descarta) y con anim_dump en WebP. Alfa 100 % opaca, ausente o fondo verde sin recortar = FAIL en `web-personaje`. |
| cuadros vacíos | > 2 cuadros 100 % transparentes = FAIL (el personaje desaparece). |
| bordes | alfa binaria (< 0,05 % de píxeles semitransparentes) = WARN: dentado sobre fondos claros. |
| `verificar_alfa.py` | Si existe, su veredicto (OK/FALLA/SIN VERIFICAR) entra tal cual: derrame verde ≤ 3 %, fuga de clave ≤ 1 %, sujeto perdido ≤ 1 %, salto de cobertura ≤ 5 % (umbrales suyos, calibrados en la cadena alfa sin verde). |
