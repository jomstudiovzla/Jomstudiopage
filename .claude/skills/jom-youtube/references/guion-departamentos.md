# Guion de video · formato y estructura por departamento

`scripts/montar-youtube.sh --guion guion.txt` lee un archivo de texto UTF-8 sencillo. Todo es opcional: sin guion
se monta home + 01…07 en orden con títulos por defecto y 12 s por sección.

## Formato

```text
# Comentario (línea que empieza por #)
titulo: JOM Studio · 7 protocolos en acción        ← título del video (≤ 100 caracteres)
subtitulo: Del juego 3D a la auditoría de seguridad
descripcion: Primera línea de la descripción.
  Las líneas con sangría continúan el valor anterior.
etiquetas: JOM Studio, portafolio, three.js        ← se suman a las del departamento (≤ 500 caracteres en total)
miniatura: 7 protocolos | 1 estudio                ← texto de la miniatura; «|» fuerza salto de línea
miniatura_de: 03 @ 6,5                             ← sección (03, o 03_2 / 03_3 si se repite) y segundo dentro de ella
short_titulo: 7 protocolos en 1 minuto
cierre: Suscríbete para ver el próximo protocolo
web: jomstudio.site                                ← va al cierre y a la descripción (o usa enlaces:)
hashtags: #JOMStudio #DesarrolloWeb #Web3D
intro_duracion: 4                                  ← s de la tarjeta de título (4 por defecto)
cierre_duracion: 6

[home]                       ← sección: home, 01…07, el nombre de un clip, o cualquiera con clip:
titulo: JOM Studio
subtitulo: El companion que vive en la web
duracion: 12                 ← 12 · 12,5 · 0:12 (por defecto --duracion, 12)
desde: 2,5                   ← segundo del clip donde empieza (por defecto: inicio útil del manifiesto,
                               y encuadra el momento clave ~2 s después del rótulo)
capitulo: Bienvenida         ← nombre del capítulo en la descripción (por defecto el título)
texto: Bienvenido a JOM Studio…   ← subtítulos (.srt) de la sección; también guía para la voz en off
short: no                    ← fuera del Short (por defecto entra)
clip: ../otros/mi-grabacion.mov   ← clip explícito (relativo al guion, a --clips o a la carpeta actual)

[01]
[02]                         ← una sección vacía usa los valores por defecto del departamento
```

Claves desconocidas se avisan y se ignoran. Las secciones sin clip se saltan con aviso. Títulos por defecto:

| Clave | Título | Subtítulo |
|---|---|---|
| `home` | JOM Studio | El estudio y su companion |
| `01` | 01 · Gamificación | Arena jugable con personaje 3D |
| `02` | 02 · Full-Stack & 3D | Shaders, CSP y arquitectura web |
| `03` | 03 · Arte IA | Concepto en tiempo real · alfa sin pantalla verde |
| `04` | 04 · Automatización | Pipelines y JOM Correo local |
| `05` | 05 · Audio UGC | Sonido interactivo para la web |
| `06` | 06 · Branding | Identidad, moneda y tipografía |
| `07` | 07 · Sentinel QA | Auditorías y seguridad |

Antes de renderizar: `scripts/montar-youtube.sh --clips … --guion guion.txt --plan` enseña secciones, duración y
capítulos previstos. Duración total ≈ intro + Σ secciones + cierre − (n.º de transiciones × 0,8 s).

## Video general del estudio (≈ 1:40)

Plantilla: `plantillas/guion-estudio.txt`. Grabación: `scripts/grabar-protocolos.sh --vertical`.

| Tramo | Duración | Qué se ve | Texto / voz (idea) |
|---|---|---|---|
| Intro (tarjeta) | 4 s | logo, título, subtítulo sobre el home desenfocado | gancho en una frase: «Siete protocolos, un estudio» |
| home | 12 s | el michi pasea, se para con el hover y abre su menú | quiénes somos y qué hace el companion |
| 01 Gamificación | 12 s | el personaje camina y salta con las flechas | «juegos web 3D que se sienten en la mano» |
| 02 Full-Stack & 3D | 12 s | COMPILAR SHADER en vivo | arquitectura, shaders, CSP por hashes |
| 03 Arte IA | 13 s | GENERAR → concepto listo (`done`) | concepto en vivo, alfa real sin pantalla verde |
| 04 Automatización | 12 s | EJECUTAR PIPELINE | procesos que trabajan solos (JOM Correo, local) |
| 05 Audio UGC | 12 s | TOCAR: pads con Web Audio | sonido interactivo para marcas y UGC |
| 06 Branding | 12 s | el cursor recorre la moneda | identidad, moneda y tipografía (Sora + JetBrains Mono) |
| 07 Sentinel QA | 12 s | EJECUTAR ESCANEO | auditorías, seguridad y accesibilidad antes de publicar |
| Cierre (tarjeta) | 6 s | «Gracias por ver», llamada a la acción, web | suscripción y contacto |

Capítulos que salen (ejemplo real de la prueba): `00:00 Intro · JOM Studio`, `00:15 01 · Gamificación`, … uno por
departamento. La intro (4 s) es demasiado corta para ser capítulo propio y se une con el home.

## Video de un departamento (≈ 0:45–1:30)

Plantilla: `plantillas/guion-departamento.txt`. Para tener ≥ 3 capítulos de ≥ 10 s hace falta un clip largo:

```bash
scripts/grabar-protocolos.sh --solo 03 --repetir 3 --duracion 36 --vertical --salida "$HOME/Movies/JOM YouTube/03"
```

Lee los tiempos de `acciones` en `clips/manifiesto.json` y pon cada sección con `desde:` en el ciclo que toca
(cada ciclo empieza con la acción `ciclo N/3`). Estructura recomendada (gancho → demo → detalle → resultado):

| Sección | Duración | Contenido |
|---|---|---|
| Intro (tarjeta) | 4 s | título del departamento + promesa concreta |
| `[03]` «El reto» | 10–12 s | plano de situación + primer ciclo (lo que el cliente pide) |
| `[03]` «En vivo» | 12–15 s | segundo ciclo: la acción principal completa |
| `[03]` «El resultado» | 10–12 s | tercer ciclo / resultado final y detalle |
| Cierre (tarjeta) | 6 s | CTA + web |

Guía por departamento (qué contar y qué acción enseñar):

| Dep. | Acción que vende | Ciclos útiles (`--repetir`) | Ideas de capítulos | Etiquetas propias (las añade solo) |
|---|---|---|---|---|
| home | el companion pasea, hover, menú | 2 | Bienvenida · El companion · Navegar el estudio | estudio creativo, desarrollo web |
| 01 | caminar, saltar, volver | 3 | La arena · Controles · Física y salto | gamificación, three.js, juego web 3D |
| 02 | COMPILAR SHADER ×3 | 2 | El shader · Compilar en vivo · Arquitectura segura | full stack, WebGL, shaders |
| 03 | GENERAR → `done` | 3 | El brief · Generación en vivo · Alfa sin pantalla verde | arte IA, inteligencia artificial, diseño generativo |
| 04 | EJECUTAR PIPELINE | 3 | El proceso manual · El pipeline · JOM Correo local | automatización, email marketing, productividad |
| 05 | TOCAR los pads | 3 | Los pads · Ritmo en vivo · Audio para marcas | audio interactivo, UGC, Web Audio |
| 06 | cursor sobre la moneda | 3 | La moneda · Tipografía de marca · Identidad | branding, identidad visual, tipografía |
| 07 | EJECUTAR ESCANEO | 3 | El escaneo · Hallazgos · Antes de publicar | QA, auditoría web, ciberseguridad |

Para 04 (JOM Correo) nunca enseñes correos reales, nombres ni direcciones de prospectos: usa la demo de la web o
datos de ejemplo. Para 07 no enseñes rutas privadas («presupuestos y automatizacion») ni secretos.

## Short (≤ 60 s)

Sale solo del mismo guion: tarjeta de 2,5 s con `short_titulo` + cada sección con `short` ≠ `no`, a partes iguales
hasta 58 s, empezando 1 s antes del momento clave de cada clip vertical (o del horizontal sobre fondo desenfocado
si no grabaste `--vertical`). Con más de ~15 secciones avisa y deja fuera las últimas. Guía en `miniatura-y-shorts.md`.

## Voz en off y subtítulos

- `texto:` de cada sección = subtítulos del guion (se reparten por la duración de la sección) y guion de locución.
- Grabar la voz: QuickTime (Archivo › Nueva grabación de audio) o `say -v Paulina -o voz.aiff "…"`.
- `--voz voz.m4a --voz-desde 4` la coloca a partir del segundo 4; la música baja sola (ducking) mientras hay voz.
- Con `brew install whisper-cpp` y un modelo, los `.srt` salen de la voz real (el del guion queda aparte).
