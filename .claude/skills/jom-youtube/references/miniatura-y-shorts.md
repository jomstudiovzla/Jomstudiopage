# Miniatura y Shorts · guía

## Miniatura (`miniatura.png`, 1280×720)

Qué hace el montaje: toma un fotograma del propio video (por defecto 03 justo después de `done`; si no hay, 01, 06
o home; cámbialo con `miniatura_de: 01 @ 5` en el guion), le pone un degradado oscuro a la izquierda, una barra dorada,
el texto de `miniatura:` (o el título) en Sora grande en blanco y dorado, el logo arriba a la izquierda y
«JOM STUDIO» en JetBrains Mono abajo.

Reglas de diseño:
- **Texto de 2 a 5 palabras**, no el título entero: la miniatura completa el título, no lo repite
  (`miniatura: 7 protocolos | 1 estudio`). «|» parte la línea; la segunda línea sale en dorado.
- Legible a 168×94 px (tamaño en el móvil): compruébalo con
  `ffmpeg -i miniatura.png -vf scale=168:94 /tmp/mini-peq.png` y míralo.
- Contraste: texto blanco/dorado sobre el degradado `#0D0D0D`; nada de texto fino ni de 3 colores.
- La esquina inferior derecha la tapa la duración del video: no pongas nada importante ahí.
- Un único foco: el personaje, la moneda o el resultado de 03 en el lado derecho (el texto ocupa ~60 % izquierdo).
- Formato: PNG ≤ 2 MB (si pasa, el montaje deja `miniatura.jpg`). Sin emojis (la fuente de marca no los tiene; el
  script los quita y avisa).
- Alternativa con el kit de marca: Canva (`list-brand-kits`, diseño 1280×720, `export-design` PNG). Generar con IA
  (Canva `generate-*`, Higgsfield) gasta cuota o créditos: solo si el CEO lo pide.

## Short (`short-youtube.mp4`, 1080×1920, ≤ 60 s)

YouTube admite Shorts de hasta 3 min, pero el estudio los hace **≤ 60 s** (el montaje corta a 58 s): sirven igual
para Reels y TikTok y se ven completos. Estructura que monta solo:

| Tramo | Duración | Contenido |
|---|---|---|
| Gancho (tarjeta) | 2,5 s | `short_titulo` grande sobre el primer clip desenfocado |
| Secciones | (58 − 2,5 + n × 0,4) / n s cada una | cada departamento desde 1 s antes de su momento clave |
| Final | fundido 0,6 s | sin tarjeta de cierre (el Short se repite en bucle) |

Zonas seguras (las respetan los rótulos): nada importante en los **250 px de arriba** ni en los **~480 px de abajo**
(título, botones y descripción del reproductor), ni en la franja derecha de botones (~120 px). Los rótulos de sección
van hacia y = 1230 px con clips verticales y, con clips horizontales, encima del video centrado (y ≈ 360–450 px).

Recomendaciones:
- Graba con `--vertical`: el Short usa `clips/vertical/*.webm` (pantalla completa) en vez del horizontal con fondo
  desenfocado.
- Gancho en el primer segundo: una promesa concreta («7 protocolos en 1 minuto», «Así genera arte la IA en vivo»).
- Para un Short de un solo departamento, un guion con 3–4 secciones del mismo clip (`desde:` distintos) y el resto
  con `short: no`.
- Título con `#Shorts` (ya va en `youtube-metadatos.txt`); música del CEO o de la Biblioteca de audio de YouTube.
- Verificación: `ffprobe -v error -show_entries stream=width,height:format=duration -of compact short-youtube.mp4`
  → 1080×1920 y < 60 s; auditar con `python3 scripts/auditar_video.py short-youtube.mp4 --perfil social-vertical`.
