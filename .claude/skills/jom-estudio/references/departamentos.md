# Departamentos de JOM Studio (protocolos 01–07 + Home)

Rutas relativas a la web nueva `demos/light-concepts/` (solo en el Mac) o al repo. «(si existe)» =
lo construye otro flujo; compruébalo con `python3 "$A" inventario` antes de usarlo.
Auditoría común de cualquier departamento:
`bash scripts/auditar-protocolos.sh "<SRC>" --solo <página>.html` (sale 0/1/2) y luego su DoD.

## Home · concept_master_horizontal.html
- Archivos: `concept_master_horizontal.html` (tras la migración pasa a ser `index.html`), companion
  `#michi-roaming-entity`, `assets/personajes/` (caminar_animado.webp, idle_transparent.png: originales intocables).
- Scripts: `jom_auditoria.py home`, `scripts/auditar-protocolos.sh --solo concept_master_horizontal.html,index.html`,
  `scripts/build_csp.py "<SRC>" --check`, `scripts/auditar-tipografia.sh --solo concept_master_horizontal.html`.
- Comprobaciones clave: `michi: paseo|hover|pausa|reanuda|hub`, `menú: *`, `scroll 375/1440`, `CSP`.
- Skills: jom-auditoria, jom-web. Conectores: Figma/Canva solo para referencias visuales.
- DoD: camina → se detiene en hover y muestra la UI → la oculta y sigue; oculto en modo 3D; 0 FAIL.

## 01 · Gamificación · page_01_gamificacion.html
- Archivos: `kit/jom-arena.js` (repo) → `assets/js/jom-arena.js` (lo copia `scripts/integrar-kit.sh`),
  `assets/personajes/juego_3d.glb` (malla estática con EXT_meshopt_compression, sin animaciones).
- Scripts: `DRY_RUN=1 scripts/integrar-kit.sh` → `scripts/integrar-kit.sh`; `scripts/auditar-protocolos.sh --solo page_01_gamificacion.html`.
- Comprobaciones: `función 01 (arena)`, `arena: GLB`, `kit`.
- Skills: jom-web; en Antigravity `threejs-scene-generator`. Conectores: ninguno necesario.
- DoD: flechas/WASD y D-Pad táctil mueven al personaje; FPS medido ≥ 55; 0 FAIL.

## 02 · Full-Stack & 3D · page_02_fullstack.html
- Archivos: `scripts/build_csp.py` (→ `_headers`), `scripts/migrar-web-nueva.sh`, `deploy-cloudflare.sh`,
  `functions/` (formulario: `_middleware.js`, `api/submit.js`, `api/event.js`), `_redirects`, `sitemap.xml`.
- Scripts: `python3 scripts/build_csp.py "<SRC>" --check`; `NO_PUSH=1 scripts/migrar-web-nueva.sh`;
  `scripts/migrar-web-nueva.sh --cf-preview` (staging, con «sí»); `./deploy-cloudflare.sh` (producción, con otro «sí»).
- Comprobaciones: `función 02 (compilar)`, `CSP`, `CSP: on*=`, `migracion-ensayo`, `navegador-staging`.
- Skills: jom-web; Antigravity `bash-pro`, `fastapi-pro`, `chrome-devtools`.
- Conectores: GitHub (leer, PR con confirmación; NO crea repos: 403 → `gh` en el Mac), Cloudflare Developer
  Platform (Workers/KV/R2/D1 y docs; NO despliega Pages → wrangler en el Mac), Supabase (si se usa; escrituras con «sí»).
- DoD: CSP `modo=hashes`; ensayo de migración sin errores; staging auditado sin FAIL.

## 03 · Arte IA · page_03_arte_ia.html
- Archivos: `kit/jom-workstation.js` → `assets/js/jom-workstation.js`; `assets/video/video_3_programando_codigo_logo.webm|.webp`,
  `assets/video/video_2_pensando_gesticulando_cafe.webm|.webp` (originales intocables).
- Scripts (si existen): `scripts/alfa-sin-verde.sh <entrada>` (salida `./alfa-out`), `python3 scripts/verificar_alfa.py <archivos>`,
  `python3 scripts/auditar_video.py <archivo|carpeta> --perfil web-personaje`, `scripts/pulir-video.sh` (salida `./video-pulido`).
- Comprobaciones: `función 03 (estación)`, `estación: video`, `alfa`, `video`.
- Skills: **jom-video-motion** (si existe), jom-web. Conectores: Higgsfield AI (gasta créditos: SOLO si el CEO lo
  pide; `balance` antes), Canva (`remove-background`, con confirmación), Figma.
- DoD: la estación reproduce y «GENERAR» llega a «done»; alfa sin verde verificado; originales intactos.

## 04 · Automatización · page_04_automatizacion.html + JOM Correo
- Web: terminal con logs y «⚙️ EJECUTAR PIPELINE» (sin llamadas reales a n8n desde la web pública).
- JOM Correo (100 % local): proyecto en `~/Documents/Antigravity/JOM Studio/presupuestos y automatizacion/correo-automatico`,
  instalado en `~/Library/Application Support/JOMCorreo` (05:00 preparar, 08:00 enviar, seguimiento 72 h);
  lanzadores `.command` en `…/presupuestos y automatizacion/lanzadores-mac/`.
- Comprobaciones: `función 04 (pipeline)`, `correo`, `lanzadores`.
- Skills: **jom-correo**. Conectores: Gmail (leer, borradores; enviar solo con «sí»), Google Calendar
  (recordatorios con confirmación), Bird (`email_tools_validate_dmarc` de solo lectura para la entregabilidad),
  Abency/Brevo (newsletters como borrador; el envío lo hace una persona).
- DoD: `jomcorreo estado` responde; cola revisada; nada enviado sin el «sí»; modo ensayo hasta que el CEO lo cambie.

## 05 · Audio UGC · page_05_audio_ugc.html
- Archivos: `assets/personajes/audio_3d.glb` (si existe), pads Kick/Snare/HiHat con Web Audio (sin samples externos).
- Comprobaciones: `función 05 (audio)`; para videos UGC: `auditar_video.py --perfil social-vertical` (−14 LUFS, TP ≤ −1 dBTP).
- Skills: jom-video-motion, jom-youtube (si existen). Conectores: Abency (redes: borradores; publicar con «sí»), Canva.
- DoD: pads y «TOCAR» suenan sincronizados; 0 FAIL.

## 06 · Branding · page_06_branding.html
- Marca: **Sora** y **JetBrains Mono** (Google Fonts en `index.html`) + Material Symbols Outlined (iconos).
- Scripts: `scripts/auditar-tipografia.sh "<SRC>" [--solo page_06_branding.html] [--marca "Sora,JetBrains Mono"]` (0/1/2).
- Comprobaciones: `función 06 (moneda)`, `tipografia`.
- Conectores: **Fonts** (`recommend_fonts`, `detect_font_regions`, `predict_font`), Canva (`list-brand-kits`), Figma (variables).
- DoD: fuentes de marca realmente pintadas (no la de reserva); contraste AA; 0 FAIL tipográficos.

## 07 · Sentinel QA · page_07_consultoria.html (auditorías y seguridad)
- Herramientas: `jom_auditoria.py home|estudio`, `scripts/auditar-protocolos.sh`, `scripts/build_csp.py --check`,
  `scripts/auditar-tipografia.sh`, `scripts/auditar_video.py`. Carpeta `~/Documents/Antigravity/JOM Studio/Security/`
  es del CEO: léela antes de usarla y no la modifiques sin permiso.
- Comprobaciones: `función 07 (escaneo)`, `csp`, `seguridad-web`, `seguridad-repo`, `red externa`.
- Conectores (solo lectura): GitHub `run_secret_scanning`, Supabase `get_advisors`, Bird `email_tools_validate_dmarc`/`email_tools_audit`,
  Abency `gtm_audit`, Cloudflare `search_cloudflare_documentation`. Antigravity: `a11y-debugging`, `chrome-devtools`.
- DoD: 0 FAIL de seguridad; nada privado publicado ni versionado; secretos rotados si alguno se expuso (acción del CEO).
