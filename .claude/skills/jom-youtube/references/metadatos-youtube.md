# Metadatos de YouTube · plantilla y reglas

`montar-youtube.sh` escribe `youtube-metadatos.txt` en la entrega con estos bloques ya rellenos (copiar y pegar en
YouTube Studio). Esta plantilla sirve para revisarlo o para escribirlo a mano.

## Límites que comprueba el montaje (`montaje.json → comprobaciones_youtube`)

| Campo | Límite de YouTube | Qué hace el script |
|---|---|---|
| Título | ≤ 100 caracteres | avisa si se pasa (`titulo_ok`) |
| Descripción | ≤ 5000 caracteres | cuenta todo, capítulos incluidos (`descripcion_ok`) |
| Etiquetas | ≤ 500 caracteres en total (las que tienen espacios cuentan sus comillas) | recorta al llegar a 500 |
| Capítulos | primero `00:00`, ≥ 3, orden creciente, cada uno ≥ 10 s | une los cortos con el vecino y avisa (`capitulos_ok`) |
| Capítulos ↔ video | (nuestra regla) cada marca a ≤ 0,5 s del corte real | mide el MP4 final (`capitulos_en_corte_real`) |
| Miniatura | 1280×720, JPG/PNG, ≤ 2 MB | si la PNG pasa de 2 MB, añade `miniatura.jpg` |

## Plantilla

```text
== TÍTULO ==
<Gancho concreto> · JOM Studio                    ← la idea principal en las primeras ~60 letras

== DESCRIPCIÓN ==
<1.ª línea: qué va a ver y por qué importa (sale en la búsqueda, ~150 caracteres)>
<2.ª línea: qué hace JOM Studio / para quién>

<Párrafo opcional: detalle del protocolo, tecnologías, resultado>

CAPÍTULOS
00:00 Intro · <tema>
00:15 01 · Gamificación
00:27 02 · Full-Stack & 3D
…                                                 ← las marcas las calcula el montaje: no las escribas a mano

<web / contacto>                                  ← clave web: o enlaces: del guion

#JOMStudio #DesarrolloWeb #Web3D                  ← YouTube enseña los 3 primeros encima del título

== ETIQUETAS ==
<del guion>, <las del departamento>, JOM Studio, desarrollo web, diseño web, portafolio web, web interactiva

== SHORT ==
Título: <short_titulo> #Shorts
Descripción: <subtítulo> · Video completo en el canal. #JOMStudio … #Shorts
```

## Cómo se calculan los capítulos

1. Cada sección dura un número entero de fotogramas a 30 fps; las transiciones xfade (0,8 s) se solapan.
2. El montaje alarga o acorta cada sección como mucho medio segundo para que el **corte** de la transición siguiente
   caiga en un segundo entero (YouTube publica los capítulos en segundos enteros).
3. Tras codificar, mide el corte real en el MP4: con `fadeblack` es el fotograma más oscuro (≈ 0,2 × 0,8 s después de
   empezar la transición, por la fórmula de ffmpeg); con otras transiciones, el primer fotograma más parecido al plano
   nuevo que al anterior. Si difiere del cálculo, usa el medido.
4. Si la intro dura < 10 s se une al primer capítulo («Intro · JOM Studio»); el cierre solo es capítulo si dura ≥ 10 s.

`montaje.json` guarda todo: `segmentos[*].inicio_s`, `xfade_offset_s`, `capitulos[*]`, y en `cortes_verificados`
cada transición (`previsto_s`, `medido_s`, `metodo`) y cada capítulo publicado con su `error_s`.

## Etiquetas por departamento (las añade el montaje según las secciones)

| Dep. | Etiquetas |
|---|---|
| home | JOM Studio, estudio creativo, desarrollo web |
| 01 | gamificación, three.js, juego web 3D |
| 02 | full stack, WebGL, shaders |
| 03 | arte IA, inteligencia artificial, diseño generativo |
| 04 | automatización, email marketing, productividad |
| 05 | audio interactivo, UGC, Web Audio |
| 06 | branding, identidad visual, tipografía |
| 07 | QA, auditoría web, ciberseguridad |

## Ajustes en YouTube Studio (no los fija el archivo)

- Idioma del video y de los subtítulos: Español. Categoría: Ciencia y tecnología (o Gente y blogs).
- «¿Es contenido creado para niños?»: No. Contenido alterado o sintético: marca **Sí** solo si el video enseña
  imágenes realistas generadas por IA que puedan confundirse con reales (las demos de 03 son estilizadas).
- Visibilidad: primero Privado o No listado; revisar en el móvil; luego Público o Programar (siempre decisión del CEO).
- Pantalla final y tarjetas: se añaden en Studio sobre los últimos 5–20 s (el cierre dura 6 s; si quieres pantalla
  final completa, pon `cierre_duracion: 20` en el guion).
