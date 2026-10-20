# Tipografía de marca y márgenes seguros 9:16

## Fuentes de la marca (descubiertas en el repo)

| Dónde | Qué dice |
|---|---|
| `index.html`, `services.html`, `repository.html`, `order.html`, `policies.html`, `recursos.html`, `success.html`, `admin-ops.html` | Google Fonts: `family=Sora:wght@100..800` y `family=JetBrains+Mono:wght@100..800` (+ Material Symbols para iconos) |
| `tailwind-config.js` / `repo-tailwind-config.js` | Sora para `body-md`, `body-lg`, `headline-md`, `headline-lg`, `headline-lg-mobile`, `display-lg`, `label-caps`; JetBrains Mono para `label-mono` y `label-code` |
| Escala de Tailwind | `display-lg` 84 px / 900 / −0,05 em · `headline-lg` 56 px / 800 / −0,03 em · `headline-md` 28 px / 600 · `body-lg` 18 px / 300 · `label-mono` 11 px / 500 / +0,15 em |
| `index.html :root` | `--color-bg #050505` · `--color-text #E0E0E0` · `--color-text-variant #9CA3AF` · `--theme-primary #00F2FF` |
| `style.css` | Inter / DM Sans con `#F4F1EC`, `#2EC4B6`, `#C4A35A`: **ninguna página lo carga** (restos antiguos); no es la marca |
| `kit/` | `jom-arena.js` y `jom-workstation.js` no fijan familia propia: heredan la de la página |

**Web nueva (`demos/light-concepts`, solo en el Mac):** no está en el repo, así que su tipografía se descubre al
vuelo y es configurable:
- `scripts/pulir-video.sh --fuentes` lista las familias que cargan los HTML de light-concepts (si la carpeta
  existe) y los `font-family` más usados, y dice dónde encuentra cada fuente instalada.
- `JOM_FUENTE_TITULAR=/ruta/Fuente-Bold.ttf` y `JOM_FUENTE_MONO=/ruta/Mono.ttf` fuerzan la fuente de los rótulos.
- Para la web en navegador: `scripts/auditar-tipografia.sh "<SRC>" --marca "Sora,JetBrains Mono"` (cambia la lista
  si light-concepts usa otra).

## Rótulos en video (`--texto`)

| Uso | Fuente | Peso | Color | Notas |
|---|---|---|---|---|
| Titular / gancho del Reel | Sora (`--fuente sora`) | Bold 700 o ExtraBold 800 (la web carga 100–800) | `E0E0E0` sobre oscuro (`--color-texto`), acento `00F2FF` solo en una palabra | Tracking de titular de marca: −0,03 em (drawtext no tiene tracking: escribe el rótulo corto) |
| Etiqueta técnica, código, contador | JetBrains Mono (`--fuente mono`) | Medium 500 | `9CA3AF` o `E0E0E0` | En mayúsculas, como `label-mono` |

`pulir-video.sh` busca la fuente en este orden: variable `JOM_FUENTE_*` → `assets/fonts`,
`demos/light-concepts/assets/fonts`, `demos/light-concepts/fonts` del repo → `~/Library/Fonts`, `/Library/Fonts`
→ carpetas de Linux. Si no la encuentra, para con un mensaje (no usa otra en silencio). Sora y JetBrains Mono son
OFL: se descargan gratis de fonts.google.com y se copian a `~/Library/Fonts`.

Tamaño automático: el menor de 4,5 % del alto (86 px en 1920) y lo que cabe en el ancho seguro con la línea más
larga. Avisa si queda por debajo de 2,6 % del alto (50 px): acorta el texto o pártelo en líneas (`$'línea 1\nlínea 2'`).
Sombra `black@0.45` y borde 2 px `black@0.30`: legible sobre fondos claros sin parecer «meme».

## Márgenes seguros 9:16 (1080×1920)

```
 ┌──────────────────────────────┐ 0
 │   barra superior / perfil    │
 ├──────────────────────────────┤ 192 px (10 %)
 │65 px                   65 px │
 │(6 %)   ZONA SEGURA     (6 %) │   x 65–1015 · y 192–1632
 │        texto y caras         │   (botones laterales a la derecha)
 │                              │
 ├──────────────────────────────┤ 1632 px (85 %)
 │ usuario, descripción, música │
 │       botones (15 %)         │
 └──────────────────────────────┘ 1920
```

- `--posicion arriba` coloca el rótulo a 10 % + 1,2 % del alto; `abajo`, con su base en 85 % − 1,2 %; `centro`,
  centrado. Nunca se sale de la zona segura.
- El auditor (`--ocr`, activo por defecto en `social-vertical`) marca FAIL si alguna palabra cae fuera de esa caja
  y si la línea más pequeña mide < 1,2 % del alto (WARN < 1,8 %). Videos no verticales: 5 % por lado.
- El texto **quemado** en un original no se puede mover: se rehace el rótulo sobre la versión limpia.

Necesita `tesseract` (`brew install tesseract tesseract-lang` para español; sin `spa` usa `eng`). Si no está,
el auditor lo dice («SKIP sin tesseract») y no inventa el resultado.
