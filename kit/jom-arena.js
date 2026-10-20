// JOM Studio · Protocolo 01 — arena jugable con el personaje 3D.
//
// Se monta sola en <div data-jom-arena data-model="assets/personajes/juego_3d.glb">.
// Si no hay host, se superpone al padre de #gameCanvas.
// Controles: ←/A, →/D caminar · ↑/W saltar · ↓/S agacharse/frenar · D-Pad táctil.
// Los GLB del estudio son mallas estáticas: toda la animación es procedural.

const STEP = 1 / 60;             // física a 60 Hz fijos, render interpolado
const MAX_FRAME = 0.25;          // evita la "espiral" tras cambiar de pestaña
const RUN_SPEED = 3.2;           // u/s
const ACCEL = 18, FRICTION = 14, CROUCH_FRICTION = 30;
const GRAVITY = -24, JUMP_V = 8.2;
const CHAR_HEIGHT = 1.6;
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
};

async function loadThree() {
  try {
    const [THREE, { GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
      import('three'),
      import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/libs/meshopt_decoder.module.js'),
    ]);
    return { THREE, GLTFLoader, MeshoptDecoder };
  } catch {
    // Sin importmap en la página: versión ESM fija desde jsDelivr.
    const [THREE, { GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
      import('https://cdn.jsdelivr.net/npm/three@0.160.0/+esm'),
      import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js/+esm'),
      import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/meshopt_decoder.module.js/+esm'),
    ]);
    return { THREE, GLTFLoader, MeshoptDecoder };
  }
}

const CSS = `
.jom-arena{position:relative;min-height:340px;outline:none;touch-action:none;user-select:none;-webkit-user-select:none}
.jom-arena canvas{display:block;width:100%;height:100%}
.jom-arena:focus-visible{box-shadow:0 0 0 2px #2EC4B6}
.jom-arena__hud{position:absolute;top:10px;left:12px;font:600 11px/1.2 ui-monospace,Menlo,monospace;letter-spacing:.08em;color:#2EC4B6;pointer-events:none}
.jom-arena__hint{position:absolute;inset:auto 0 14px;text-align:center;font:500 12px/1.3 system-ui,sans-serif;color:rgba(255,255,255,.75);pointer-events:none;transition:opacity .3s}
.jom-arena:focus .jom-arena__hint,.jom-arena.is-playing .jom-arena__hint{opacity:0}
.jom-dpad{position:absolute;right:14px;bottom:14px;display:none;grid-template:repeat(3,48px)/repeat(3,48px);gap:4px}
.jom-dpad button{border:1px solid rgba(46,196,182,.5);border-radius:12px;background:rgba(8,8,8,.45);color:#fff;font-size:18px;touch-action:none;-webkit-tap-highlight-color:transparent}
.jom-dpad button.is-down{background:rgba(46,196,182,.55)}
.jom-dpad [data-k=up]{grid-area:1/2}.jom-dpad [data-k=left]{grid-area:2/1}.jom-dpad [data-k=right]{grid-area:2/3}.jom-dpad [data-k=down]{grid-area:3/2}
@media (max-width:992px),(pointer:coarse){.jom-dpad{display:grid}}
.jom-arena--overlay{position:absolute;inset:0;min-height:0}
`;

function injectCss() {
  if (document.getElementById('jom-arena-css')) return;
  const s = document.createElement('style');
  s.id = 'jom-arena-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}

// Ángulo más corto entre a y b.
function lerpAngle(a, b, t) {
  const d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + d * t;
}

export async function mountArena(host, opts = {}) {
  injectCss();
  const { THREE, GLTFLoader, MeshoptDecoder } = await loadThree();
  const modelUrl = opts.model || host.dataset.model || 'assets/personajes/juego_3d.glb';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  host.classList.add('jom-arena');
  if (!host.hasAttribute('tabindex')) host.tabIndex = 0;
  host.setAttribute('role', 'application');
  host.setAttribute('aria-label', 'Arena jugable: usa las flechas o WASD para mover al personaje');

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const hud = Object.assign(document.createElement('div'), { className: 'jom-arena__hud', textContent: '— FPS' });
  const hint = Object.assign(document.createElement('div'), { className: 'jom-arena__hint', textContent: 'Haz clic y usa ← → ↑ ↓ o WASD' });
  host.append(hud, hint);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 1.6, 9);
  camera.lookAt(0, 1, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(3, 6, 4);
  scene.add(sun);

  // Sombra de contacto (sin shadow maps: barato y estable a 60 FPS).
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.45, 32),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  scene.add(shadow);

  // Personaje: pivot (posición/rotación) → body (squash, bob) → modelo.
  const pivot = new THREE.Group();
  const body = new THREE.Group();
  pivot.add(body);
  scene.add(pivot);
  let modelLoaded = false;
  try {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(modelUrl);
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const s = CHAR_HEIGHT / (size.y || 1);
    model.scale.setScalar(s);
    box.setFromObject(model);
    const c = box.getCenter(new THREE.Vector3());
    model.position.set(-c.x, -box.min.y, -c.z);   // pies en y=0, centrado
    body.add(model);
    modelLoaded = true;
  } catch (err) {
    console.warn('[jom-arena] no se pudo cargar', modelUrl, err);
    const fallback = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 0.9, 6, 16),
      new THREE.MeshStandardMaterial({ color: 0xc4a35a, roughness: 0.4, metalness: 0.3 }),
    );
    fallback.position.y = 0.8;
    body.add(fallback);
  }

  // Partículas de pisada: pool fijo, sin crear objetos por frame.
  const P = 64;
  const pPos = new Float32Array(P * 3), pVel = new Float32Array(P * 3), pLife = new Float32Array(P);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({ color: 0x2ec4b6, size: 0.07, transparent: true, opacity: 0.85, depthWrite: false });
  const points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false;
  scene.add(points);
  let pNext = 0;
  function emit(x, n) {
    if (reduced) return;
    for (let i = 0; i < n; i++) {
      const k = pNext++ % P;
      pPos[k * 3] = x + (Math.random() - 0.5) * 0.2; pPos[k * 3 + 1] = 0.03; pPos[k * 3 + 2] = (Math.random() - 0.5) * 0.3;
      pVel[k * 3] = (Math.random() - 0.5) * 1.2; pVel[k * 3 + 1] = 0.8 + Math.random() * 1.2; pVel[k * 3 + 2] = (Math.random() - 0.5) * 0.6;
      pLife[k] = 0.5;
    }
  }

  // Estado de simulación (prev para interpolar el render).
  const st = { x: 0, y: 0, vx: 0, vy: 0, facing: 0, crouch: 1, squash: 1, squashV: 0, onGround: true, stepPhase: 0, bounds: 4 };
  const prev = { x: 0, y: 0 };
  const keys = new Set();

  function step(dt) {
    prev.x = st.x; prev.y = st.y;
    const dir = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
    const crouching = keys.has('down') && st.onGround;

    if (dir && !crouching) {
      st.vx += dir * ACCEL * dt;
      st.vx = Math.max(-RUN_SPEED, Math.min(RUN_SPEED, st.vx));
      st.facing = dir * Math.PI / 2;               // → +π/2, ← −π/2
    } else {
      const f = (crouching ? CROUCH_FRICTION : FRICTION) * dt;
      st.vx = Math.abs(st.vx) <= f ? 0 : st.vx - Math.sign(st.vx) * f;
    }

    if (keys.has('up') && st.onGround) {
      st.vy = JUMP_V; st.onGround = false;
      st.squashV += 6;                             // estira al despegar
    }
    if (!st.onGround) st.vy += GRAVITY * dt;
    st.x += st.vx * dt;
    st.y += st.vy * dt;
    if (st.y <= 0 && !st.onGround) {               // aterrizaje
      st.y = 0; st.vy = 0; st.onGround = true;
      st.squashV -= 9;
      emit(st.x, 10);
    }
    if (Math.abs(st.x) > st.bounds) { st.x = Math.sign(st.x) * st.bounds; st.vx = 0; }

    // Muelle elástico del squash & stretch (vuelve a 1).
    st.squashV += (1 - st.squash) * 220 * dt;
    st.squashV *= Math.exp(-14 * dt);
    st.squash += st.squashV * dt;
    st.crouch += ((crouching ? 0.7 : 1) - st.crouch) * Math.min(1, 14 * dt);

    // Pisadas: una partícula por medio ciclo de paso.
    const speed = Math.abs(st.vx);
    if (st.onGround && speed > 0.3) {
      const before = Math.floor(st.stepPhase / Math.PI);
      st.stepPhase += speed * 4.2 * dt;
      if (Math.floor(st.stepPhase / Math.PI) !== before) emit(st.x, 3);
    }

    for (let k = 0; k < P; k++) {
      if (pLife[k] <= 0) { pPos[k * 3 + 1] = -99; continue; }
      pLife[k] -= dt;
      pVel[k * 3 + 1] -= 4 * dt;
      pPos[k * 3] += pVel[k * 3] * dt; pPos[k * 3 + 1] += pVel[k * 3 + 1] * dt; pPos[k * 3 + 2] += pVel[k * 3 + 2] * dt;
    }
  }

  function render(alpha, dt) {
    const x = prev.x + (st.x - prev.x) * alpha;
    const y = prev.y + (st.y - prev.y) * alpha;
    pivot.position.set(x, y, 0);
    pivot.rotation.y = lerpAngle(pivot.rotation.y, st.facing, Math.min(1, 12 * dt));
    const walking = st.onGround && Math.abs(st.vx) > 0.3 && !reduced;
    body.position.y = walking ? Math.abs(Math.sin(st.stepPhase)) * 0.06 : 0;
    body.rotation.z = walking ? Math.sin(st.stepPhase) * 0.05 : 0;
    const sy = st.squash * st.crouch;
    body.scale.set(1 / Math.sqrt(Math.max(sy, 0.4)), sy, 1 / Math.sqrt(Math.max(sy, 0.4)));
    shadow.position.x = x;
    shadow.scale.setScalar(Math.max(0.4, 1 - y * 0.25));
    shadow.material.opacity = 0.28 * Math.max(0.3, 1 - y * 0.3);
    pGeo.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
  }

  function resize() {
    const w = host.clientWidth || 640, h = host.clientHeight || 340;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z * camera.aspect;
    st.bounds = Math.max(1, halfW - 0.6);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  // Teclado: solo con la arena enfocada, para no secuestrar el scroll de la página.
  const onKey = (e) => {
    const k = KEYMAP[e.code];
    if (!k) return;
    e.preventDefault();
    if (e.type === 'keydown') { keys.add(k); host.classList.add('is-playing'); } else keys.delete(k);
  };
  host.addEventListener('keydown', onKey);
  host.addEventListener('keyup', onKey);
  host.addEventListener('pointerdown', () => host.focus({ preventScroll: true }));
  const clearKeys = () => keys.clear();
  host.addEventListener('blur', clearKeys);
  document.addEventListener('visibilitychange', clearKeys);

  // D-Pad táctil (pointer events + captura: el dedo puede salirse del botón).
  const pad = document.createElement('div');
  pad.className = 'jom-dpad';
  pad.innerHTML = [['up', '▲', 'Saltar'], ['left', '◀', 'Izquierda'], ['right', '▶', 'Derecha'], ['down', '▼', 'Agacharse']]
    .map(([k, g, l]) => `<button type="button" data-k="${k}" aria-label="${l}">${g}</button>`).join('');
  host.appendChild(pad);
  pad.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    e.preventDefault(); b.setPointerCapture(e.pointerId);
    keys.add(b.dataset.k); b.classList.add('is-down'); host.classList.add('is-playing');
  });
  const release = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    keys.delete(b.dataset.k); b.classList.remove('is-down');
  };
  pad.addEventListener('pointerup', release);
  pad.addEventListener('pointercancel', release);
  pad.addEventListener('contextmenu', (e) => e.preventDefault());

  // Bucle: paso fijo + acumulador; se detiene fuera de pantalla.
  let raf = 0, last = 0, acc = 0, visible = true;
  let fpsFrames = 0, fpsT = 0, fps = 0;
  function frame(t) {
    raf = requestAnimationFrame(frame);
    const now = t / 1000;
    const dt = Math.min(MAX_FRAME, last ? now - last : STEP);
    last = now;
    acc += dt;
    while (acc >= STEP) { step(STEP); acc -= STEP; }
    render(acc / STEP, dt);
    fpsFrames++; fpsT += dt;
    if (fpsT >= 1) { fps = Math.round(fpsFrames / fpsT); hud.textContent = `${fps} FPS`; fpsFrames = 0; fpsT = 0; }
  }
  const io = new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    if (visible && !raf) { last = 0; raf = requestAnimationFrame(frame); }
    if (!visible && raf) { cancelAnimationFrame(raf); raf = 0; }
  });
  io.observe(host);
  raf = requestAnimationFrame(frame);

  function destroy() {
    cancelAnimationFrame(raf); raf = 0;
    ro.disconnect(); io.disconnect();
    document.removeEventListener('visibilitychange', clearKeys);
    scene.traverse((o) => {
      o.geometry?.dispose();
      for (const m of [].concat(o.material || [])) {
        for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
        m.dispose();
      }
    });
    renderer.dispose();
    renderer.domElement.remove(); pad.remove(); hud.remove(); hint.remove();
  }
  addEventListener('pagehide', destroy, { once: true });

  const api = {
    get state() { return { ...st, rotationY: pivot.rotation.y, scaleY: body.scale.y, fps, modelLoaded, visible }; },
    keys, destroy,
  };
  host.jomArena = api;
  host.dispatchEvent(new CustomEvent('jom-arena:ready', { detail: api }));
  return api;
}

function autoMount() {
  let host = document.querySelector('[data-jom-arena]');
  if (!host) {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas?.parentElement) return;
    const parent = canvas.parentElement;
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    host = document.createElement('div');
    host.className = 'jom-arena--overlay';
    parent.appendChild(host);
  }
  mountArena(host).catch((e) => console.error('[jom-arena]', e));
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount, { once: true });
else autoMount();
