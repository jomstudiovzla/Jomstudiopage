/* ═══════════════════════════════════════════════
   JOM STUDIO PORTFOLIO 2026 — Main JS
   Features: Canvas Logo BG, Sound Engine, Custom Cursor,
   Magnetic Buttons, Scroll Reveals, Counter Animation,
   Page Loader, Marquee pause on hover, Modal System
═══════════════════════════════════════════════ */

(function() {
'use strict';

/* ─────────────────────────────────────────────
   SOUND ENGINE (Web Audio API — no external files)
───────────────────────────────────────────── */
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function getAudioCtx() {
    if (!audioCtx) audioCtx = new AudioCtx();
    return audioCtx;
}

function playSound(type) {
    try {
        const ctx = getAudioCtx();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        if (type === 'click') {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, ctx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.1);
        } else if (type === 'hover') {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(660, ctx.currentTime);
            gainNode.gain.setValueAtTime(0.04, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.08);
        } else if (type === 'open') {
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(440, ctx.currentTime);
            oscillator.frequency.linearRampToValueAtTime(660, ctx.currentTime + 0.15);
            gainNode.gain.setValueAtTime(0.07, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.2);
        } else if (type === 'close') {
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(660, ctx.currentTime);
            oscillator.frequency.linearRampToValueAtTime(330, ctx.currentTime + 0.12);
            gainNode.gain.setValueAtTime(0.06, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.15);
        } else if (type === 'loader') {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(300, ctx.currentTime);
            oscillator.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.4);
            gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.45);
        }
    } catch(e) {
        // Audio not supported — continue silently
    }
}

/* ─────────────────────────────────────────────
   PAGE LOADER
───────────────────────────────────────────── */
const loader = document.getElementById('page-loader');
const loaderBar = document.getElementById('loader-bar');
const loaderPct = document.getElementById('loader-pct');

if (loader && loaderBar && loaderPct) {
    let progress = 0;
    const loaderInterval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
            progress = 100;
            clearInterval(loaderInterval);
            loaderBar.style.width = '100%';
            loaderPct.textContent = '100%';
            setTimeout(() => {
                playSound('loader');
                loader.classList.add('hidden');
                document.body.style.overflow = '';
                // Trigger hero reveal
                document.querySelectorAll('#hero .reveal-up').forEach((el, i) => {
                    setTimeout(() => el.classList.add('visible'), i * 120);
                });
            }, 400);
        }
        loaderBar.style.width = Math.min(progress, 100) + '%';
        loaderPct.textContent = Math.round(Math.min(progress, 100)) + '%';
    }, 60);

    // Block scroll during load
    document.body.style.overflow = 'hidden';
} else {
    // If no loader exists, ensure scroll is enabled and reveal hero elements immediately
    document.body.style.overflow = '';
    document.querySelectorAll('#hero .reveal-up').forEach((el) => {
        el.classList.add('visible');
    });
}

/* ─────────────────────────────────────────────
   HERO CANVAS — Three.js WebGL 3D Engine (Global Ecosystem)
───────────────────────────────────────────── */
/* ─────────────────────────────────────────────
   HERO CANVAS — Three.js WebGL 3D Engine (Global Ecosystem)
───────────────────────────────────────────── */
let canvas, renderer, scene, camera;
let gridHelper, logoGroup, innerMesh, outerMesh, logoPlane, logoBackLight, logoFrontLight;
let ringMesh1, ringMesh2, lensMesh, particlePoints;
let planeZ, raycaster, targetLensPos;
let particlePositions, initialPositions, particleGeo, particleMat;
const clock = new THREE.Clock();

// Camera Target Vectors
const cameraTargetPos = new THREE.Vector3(0, 0, 8);
const cameraTargetRot = new THREE.Euler(0, 0, 0);
const logoTargetPos = new THREE.Vector3(0, 0, 0);
let logoTargetScale = 1.0;
let gridTargetOpacity = 0.05;
const gridTargetPos = new THREE.Vector3(0, -8, 0);

// Interaction Vectors
const mouse = new THREE.Vector2(0, 0);
const targetMouse = new THREE.Vector2(0, 0);
let isMouseActive = false;
let gravityStrength = 0.0;

// Scroll section configurations (Section Targets)
const sectionTargets = [
    { // Hero
        camPos: new THREE.Vector3(0, 0, 8),
        camRot: new THREE.Euler(0, 0, 0),
        logoPos: new THREE.Vector3(0, 0, 0),
        logoScale: 1.0,
        gridOpacity: 0.05,
        gridPos: new THREE.Vector3(0, -8, 0)
    },
    { // Services
        camPos: new THREE.Vector3(-2.0, 0, 8.5),
        camRot: new THREE.Euler(0, -Math.PI * 0.08, 0),
        logoPos: new THREE.Vector3(-2.5, 0.5, 0),
        logoScale: 0.65,
        gridOpacity: 0.08,
        gridPos: new THREE.Vector3(0, -6, 0)
    },
    { // About
        camPos: new THREE.Vector3(2.0, -0.5, 8.2),
        camRot: new THREE.Euler(0, Math.PI * 0.08, 0),
        logoPos: new THREE.Vector3(2.6, -0.8, -1),
        logoScale: 0.60,
        gridOpacity: 0.04,
        gridPos: new THREE.Vector3(0, -7, 0)
    },
    { // Brief & Contact
        camPos: new THREE.Vector3(0, -3.8, 9.0),
        camRot: new THREE.Euler(-Math.PI * 0.1, 0, 0),
        logoPos: new THREE.Vector3(0, -1.5, 0),
        logoScale: 0.85,
        gridOpacity: 0.14,
        gridPos: new THREE.Vector3(0, -5, 0)
    }
];

function resizeCanvas() {
    if (!renderer || !camera) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

function animateCanvas() {
    if (!renderer) return;
    const elapsedTime = clock.getElapsedTime();

    // Mouse Lerp
    mouse.x += (targetMouse.x - mouse.x) * 0.06;
    mouse.y += (targetMouse.y - mouse.y) * 0.06;

    // Project cursor onto plane to locate the magnifier glass
    if (raycaster && camera && planeZ && lensMesh) {
        raycaster.setFromCamera(mouse, camera);
        const intersectPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(planeZ, intersectPoint);
        if (intersectPoint) {
            targetLensPos.copy(intersectPoint);
        }
        lensMesh.position.lerp(targetLensPos, 0.08);
        const targetScale = isMouseActive ? 1.0 : 0.0;
        lensMesh.scale.x += (targetScale - lensMesh.scale.x) * 0.08;
        lensMesh.scale.y += (targetScale - lensMesh.scale.y) * 0.08;
        lensMesh.scale.z += (targetScale - lensMesh.scale.z) * 0.08;
    }

    // Logo Autonomous rotation
    if (logoGroup) {
        logoGroup.rotation.y = elapsedTime * 0.12;
        logoGroup.rotation.x = Math.sin(elapsedTime * 0.2) * 0.08;
        logoGroup.rotation.y += mouse.x * 0.3;
        logoGroup.rotation.x -= mouse.y * 0.3;

        const finalLogoPos = new THREE.Vector3().copy(logoTargetPos);
        finalLogoPos.x += mouse.x * 0.4;
        finalLogoPos.y += mouse.y * 0.4;
        logoGroup.position.lerp(finalLogoPos, 0.05);

        if (!gsap.isTweening(logoGroup.scale)) {
            logoGroup.scale.x += (logoTargetScale - logoGroup.scale.x) * 0.05;
            logoGroup.scale.y += (logoTargetScale - logoGroup.scale.y) * 0.05;
            logoGroup.scale.z += (logoTargetScale - logoGroup.scale.z) * 0.05;
        }
    }

    if (ringMesh1) ringMesh1.rotation.z = -elapsedTime * 0.06;
    if (ringMesh2) ringMesh2.rotation.z = elapsedTime * 0.09;
    if (logoPlane) logoPlane.rotation.y = Math.sin(elapsedTime * 0.4) * 0.04;

    // Particles simulation
    if (particleGeo && initialPositions) {
        const posArr = particleGeo.attributes.position.array;
        const attractStrength = gravityStrength * 0.06;
        
        for (let i = 0; i < posArr.length; i += 3) {
            const px = initialPositions[i];
            const pz = initialPositions[i + 2];
            const theta = elapsedTime * 0.01 + (i * 0.001);
            const cosTheta = Math.cos(theta);
            const sinTheta = Math.sin(theta);
            
            const basePx = px * cosTheta - pz * sinTheta;
            const basePy = initialPositions[i + 1] + Math.sin(elapsedTime * 0.05 + i) * 0.5;
            const basePz = px * sinTheta + pz * cosTheta;
            
            posArr[i] += (basePx - posArr[i]) * 0.03;
            posArr[i + 1] += (basePy - posArr[i + 1]) * 0.03;
            posArr[i + 2] += (basePz - posArr[i + 2]) * 0.03;
            
            if (gravityStrength > 0 && isMouseActive && targetLensPos) {
                const dx = targetLensPos.x - posArr[i];
                const dy = targetLensPos.y - posArr[i + 1];
                const dz = targetLensPos.z - posArr[i + 2];
                const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                
                if (dist < 14) {
                    const force = ((14 - dist) / 14) * attractStrength;
                    posArr[i] += dx * force;
                    posArr[i + 1] += dy * force;
                    posArr[i + 2] += dz * force;
                }
            }
        }
        particleGeo.attributes.position.needsUpdate = true;
    }

    // Camera Lerp
    camera.position.lerp(cameraTargetPos, 0.05);
    camera.rotation.x += (cameraTargetRot.x - camera.rotation.x) * 0.05;
    camera.rotation.y += (cameraTargetRot.y - camera.rotation.y) * 0.05;

    // Grid properties
    if (gridHelper) {
        gridHelper.material.opacity += (gridTargetOpacity - gridHelper.material.opacity) * 0.05;
        gridHelper.position.lerp(gridTargetPos, 0.05);
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animateCanvas);
}

try {
    canvas = document.getElementById('hero-canvas');
    if (canvas) {
        // Create Three.js WebGL Renderer
        renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true,
            powerPreference: "default"
        });
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        scene = new THREE.Scene();

        // Camera Setup
        camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
        camera.position.set(0, 0, 8);

        // Lighting Setup
        const ambientLight = new THREE.AmbientLight(0x0a0a0a, 2.0);
        scene.add(ambientLight);

        const spotLight = new THREE.SpotLight(0x2EC4B6, 18, 30, Math.PI * 0.2, 0.5, 1);
        spotLight.position.set(-5, 8, 10);
        scene.add(spotLight);

        const pointLight = new THREE.PointLight(0xC4A35A, 14, 20);
        pointLight.position.set(5, -4, 6);
        scene.add(pointLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
        dirLight.position.set(0, 10, 0);
        scene.add(dirLight);

        // 3D Digital Grid
        gridHelper = new THREE.GridHelper(50, 40, 0x2EC4B6, 0x2EC4B6);
        gridHelper.position.y = -8;
        gridHelper.material.opacity = 0.05;
        gridHelper.material.transparent = true;
        scene.add(gridHelper);

        // Central Logo & Crystal Group
        logoGroup = new THREE.Group();
        scene.add(logoGroup);

        // 1. Inner Crystalline Icosahedron (Teal Glassmorphism)
        const innerGeo = new THREE.IcosahedronGeometry(1.6, 1);
        const innerMat = new THREE.MeshPhysicalMaterial({
            color: 0x2EC4B6,
            emissive: 0x051b1a,
            roughness: 0.05,
            metalness: 0.0,
            transmission: 0.98,
            ior: 1.5,
            thickness: 1.2,
            specularIntensity: 1.0,
            clearcoat: 1.0,
            clearcoatRoughness: 0.05,
            transparent: true,
            opacity: 0.45
        });
        const innerMesh = new THREE.Mesh(innerGeo, innerMat);
        logoGroup.add(innerMesh);

        // 2. Outer Wireframe Icosahedron (Gold)
        const outerGeo = new THREE.IcosahedronGeometry(1.63, 1);
        const outerMat = new THREE.MeshBasicMaterial({
            color: 0xC4A35A,
            wireframe: true,
            transparent: true,
            opacity: 0.35,
            blending: THREE.AdditiveBlending
        });
        const outerMesh = new THREE.Mesh(outerGeo, outerMat);
        logoGroup.add(outerMesh);

        // 3. Central Hologram Plane with logo_jom.png
        const textureLoader = new THREE.TextureLoader();
        const logoTexture = textureLoader.load('assets/logo_jom.png');
        const planeGeo = new THREE.PlaneGeometry(2.3, 2.3);
        const planeMat = new THREE.MeshBasicMaterial({
            map: logoTexture,
            transparent: true,
            opacity: 0.95,
            side: THREE.DoubleSide,
            blending: THREE.NormalBlending,
            depthWrite: true
        });
        logoPlane = new THREE.Mesh(planeGeo, planeMat);
        logoGroup.add(logoPlane);

        // Emissive Core Back-Light
        logoBackLight = new THREE.PointLight(0xffffff, 20, 6);
        logoBackLight.position.set(0, 0, -0.3);
        logoGroup.add(logoBackLight);

        // Emissive Core Front-Light
        logoFrontLight = new THREE.PointLight(0xffffff, 14, 5);
        logoFrontLight.position.set(0, 0, 0.4);
        logoGroup.add(logoFrontLight);

        // 4. Digital Alchemical Rings
        const ringGeo1 = new THREE.RingGeometry(2.3, 2.32, 64);
        const ringMat1 = new THREE.MeshBasicMaterial({
            color: 0xC4A35A,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending
        });
        ringMesh1 = new THREE.Mesh(ringGeo1, ringMat1);
        ringMesh1.rotation.x = Math.PI * 0.35;
        logoGroup.add(ringMesh1);

        const ringGeo2 = new THREE.RingGeometry(2.5, 2.52, 64);
        const ringMat2 = new THREE.MeshBasicMaterial({
            color: 0x2EC4B6,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.25,
            blending: THREE.AdditiveBlending
        });
        ringMesh2 = new THREE.Mesh(ringGeo2, ringMat2);
        ringMesh2.rotation.x = -Math.PI * 0.25;
        ringMesh2.rotation.y = Math.PI * 0.25;
        logoGroup.add(ringMesh2);

        // circular glass magnifier lens
        const lensGeo = new THREE.SphereGeometry(1.0, 32, 32);
        const lensMat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            roughness: 0.0,
            metalness: 0.0,
            transmission: 0.98,
            ior: 1.6,
            thickness: 0.8,
            clearcoat: 1.0,
            clearcoatRoughness: 0.0,
            transparent: true,
            opacity: 0.95,
            depthWrite: false
        });
        lensMesh = new THREE.Mesh(lensGeo, lensMat);
        scene.add(lensMesh);

        planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), -2);
        raycaster = new THREE.Raycaster();
        targetLensPos = new THREE.Vector3(0, 0, 0);

        // Particles System
        const particleCount = 2000;
        particleGeo = new THREE.BufferGeometry();
        particlePositions = new Float32Array(particleCount * 3);
        initialPositions = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount * 3; i += 3) {
            const px = (Math.random() - 0.5) * 45;
            const py = (Math.random() - 0.5) * 45;
            const pz = (Math.random() - 0.5) * 45 - 5;
            
            particlePositions[i] = px;
            particlePositions[i + 1] = py;
            particlePositions[i + 2] = pz;
            
            initialPositions[i] = px;
            initialPositions[i + 1] = py;
            initialPositions[i + 2] = pz;
        }
        particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

        particleMat = new THREE.PointsMaterial({
            size: 0.08,
            color: 0x2EC4B6,
            transparent: true,
            opacity: 0.45,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        particlePoints = new THREE.Points(particleGeo, particleMat);
        scene.add(particlePoints);

        // Initial triggers
        resizeCanvas();
        window.dispatchEvent(new Event('scroll'));
        animateCanvas();
    }
} catch (e) {
    console.warn("Three.js WebGL context creation failed or unsupported: ", e);
}

// Track mouse position globally
window.addEventListener('mousemove', (e) => {
    isMouseActive = true;
    if (renderer) {
        targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        targetMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    }
});
document.addEventListener('mouseenter', () => { isMouseActive = true; });
document.addEventListener('mouseleave', () => {
    isMouseActive = false;
    targetMouse.set(0, 0);
});

// Particle magnetism trigger on interactive hovers
document.addEventListener('mouseover', (e) => {
    if (!renderer) return;
    const target = e.target;
    if (target && (
        target.closest('a') || 
        target.closest('button') || 
        target.closest('.project-card') || 
        target.closest('.cv-box') || 
        target.closest('.photobook-item')
    )) {
        gravityStrength = 0.8;
    } else {
        gravityStrength = 0.0;
    }
});

// Click Interaction anywhere triggers click pulse
window.addEventListener('click', () => {
    if (!renderer || !logoGroup) return;
    gsap.fromTo(logoGroup.scale,
        { x: logoTargetScale * 1.25, y: logoTargetScale * 1.25, z: logoTargetScale * 1.25 },
        { x: logoTargetScale, y: logoTargetScale, z: logoTargetScale, duration: 1.2, ease: "elastic.out(1.0, 0.3)" }
    );
    const spot = scene.getObjectByProperty('type', 'SpotLight');
    const point = scene.getObjectByProperty('type', 'PointLight');
    if (spot) gsap.fromTo(spot, { intensity: 32 }, { intensity: 18, duration: 0.8, ease: "power2.out" });
    if (point) gsap.fromTo(point, { intensity: 28 }, { intensity: 14, duration: 0.8, ease: "power2.out" });
});

// Scroll interpolation mapping for multisections (aligned with actual DOM section positions)
window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    
    const heroSec = document.getElementById('hero');
    const servicesSec = document.getElementById('services');
    const aboutSec = document.getElementById('about');
    const briefSec = document.getElementById('brief');
    
    const heroTop = heroSec ? heroSec.offsetTop : 0;
    const servicesTop = servicesSec ? servicesSec.offsetTop : window.innerHeight;
    const aboutTop = aboutSec ? aboutSec.offsetTop : window.innerHeight * 2;
    const briefTop = briefSec ? briefSec.offsetTop : window.innerHeight * 3;
    
    let start, end, fraction;
    
    if (scrollY < servicesTop) {
        start = sectionTargets[0];
        end = sectionTargets[1];
        fraction = Math.min(Math.max((scrollY - heroTop) / ((servicesTop - heroTop) || 1), 0), 1);
    } else if (scrollY < aboutTop) {
        start = sectionTargets[1];
        end = sectionTargets[2];
        fraction = Math.min(Math.max((scrollY - servicesTop) / ((aboutTop - servicesTop) || 1), 0), 1);
    } else {
        start = sectionTargets[2];
        end = sectionTargets[3];
        fraction = Math.min(Math.max((scrollY - aboutTop) / ((briefTop - aboutTop) || 1), 0), 1);
    }
    
    cameraTargetPos.lerpVectors(start.camPos, end.camPos, fraction);
    cameraTargetRot.set(
        start.camRot.x + (end.camRot.x - start.camRot.x) * fraction,
        start.camRot.y + (end.camRot.y - start.camRot.y) * fraction,
        start.camRot.z + (end.camRot.z - start.camRot.z) * fraction
    );
    logoTargetPos.lerpVectors(start.logoPos, end.logoPos, fraction);
    logoTargetScale = start.logoScale + (end.logoScale - start.logoScale) * fraction;
    gridTargetOpacity = start.gridOpacity + (end.gridOpacity - start.gridOpacity) * fraction;
    gridTargetPos.lerpVectors(start.gridPos, end.gridPos, fraction);
});

// Unified smooth scroll handler for all internal anchor links (menu & clicks)
document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a[href^="#"]');
    if (anchor) {
        e.preventDefault();
        const targetId = anchor.getAttribute('href');
        if (targetId === '#') return;
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth' });
        }
    }
});

// Resize handler
window.addEventListener('resize', resizeCanvas);

/* ─────────────────────────────────────────────
   CUSTOM CURSOR (position via script.js backup — inline takes priority)
───────────────────────────────────────────── */
// NOTE: Cursor position is handled by the inline script via transform3d.
// The animateCursor below is the backup trailing circle only.


// Hover state class on body (body.cursor-hover) — handled by inline script.
// This section only applies the legacy .hovered class to individual cursor elements
// if the inline approach is unavailable.
const cursor = document.getElementById('custom-cursor-dot');
const follower = document.getElementById('custom-cursor-circle');

// Hover state on interactive elements
const hoverEls = document.querySelectorAll('a, button, .project-card, .cv-box, .photobook-item');
hoverEls.forEach(el => {
    el.addEventListener('mouseenter', () => {
        if (cursor) cursor.classList.add('hovered');
        if (follower) follower.classList.add('hovered');
    });
    el.addEventListener('mouseleave', () => {
        if (cursor) cursor.classList.remove('hovered');
        if (follower) follower.classList.remove('hovered');
    });
});

/* ─────────────────────────────────────────────
   MAGNETIC BUTTON EFFECT
───────────────────────────────────────────── */
document.querySelectorAll('.magnetic').forEach(el => {
    el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        el.style.transform = `translate(${dx * 0.25}px, ${dy * 0.25}px)`;
    });
    el.addEventListener('mouseleave', () => {
        el.style.transform = '';
    });
});

/* ─────────────────────────────────────────────
   SOUND ON INTERACTIONS
───────────────────────────────────────────── */
document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-sound]');
    if (el) playSound(el.dataset.sound);
});
document.querySelectorAll('.nav-link').forEach(el => {
    el.addEventListener('mouseenter', () => playSound('hover'));
});

/* ─────────────────────────────────────────────
   NAVIGATION — Scroll & Burger
───────────────────────────────────────────── */
const nav = document.getElementById('main-nav');
if (nav) {
    window.addEventListener('scroll', () => {
        nav.classList.toggle('scrolled', window.scrollY > 60);
    });
}

const burger = document.getElementById('nav-burger');
const mobileMenu = document.getElementById('mobile-menu');
if (burger && mobileMenu) {
    burger.addEventListener('click', () => {
        playSound('click');
        burger.classList.toggle('open');
        mobileMenu.classList.toggle('open');
        document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
    });
}
document.querySelectorAll('.mobile-link').forEach(link => {
    link.addEventListener('click', () => {
        if (burger) burger.classList.remove('open');
        if (mobileMenu) mobileMenu.classList.remove('open');
        document.body.style.overflow = '';
    });
});

/* ─────────────────────────────────────────────
   SCROLL REVEAL (IntersectionObserver)
───────────────────────────────────────────── */
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

document.querySelectorAll('.reveal-up').forEach(el => {
    // Skip hero — handled by loader
    if (!el.closest('#hero')) revealObserver.observe(el);
});

/* ─────────────────────────────────────────────
   COUNTER ANIMATION (Stats)
───────────────────────────────────────────── */
const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.querySelectorAll('.stat-num').forEach(el => {
            const target = parseInt(el.dataset.target);
            let current = 0;
            const step = Math.ceil(target / 40);
            const timer = setInterval(() => {
                current += step;
                if (current >= target) { current = target; clearInterval(timer); }
                el.textContent = current;
            }, 40);
        });
        counterObserver.unobserve(entry.target);
    });
}, { threshold: 0.5 });

const heroStats = document.querySelector('.hero-stats');
if (heroStats) counterObserver.observe(heroStats);

/* ─────────────────────────────────────────────
   MODAL SYSTEM
───────────────────────────────────────────── */
function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    playSound('open');
}
function closeModal(modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
    playSound('close');
}

// Open via modal-trigger
document.querySelectorAll('.modal-trigger').forEach(el => {
    el.addEventListener('click', () => {
        const id = el.getAttribute('data-target');
        if (id) openModal(id);
    });
});

// Close via close button
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.close-modal');
    if (btn) closeModal(btn.closest('.modal'));
});

// Close via backdrop
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) closeModal(e.target);
});

// Close via Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (lightbox && lightbox.classList.contains('active')) {
            closeLightbox();
        } else {
            document.querySelectorAll('.modal.active').forEach(closeModal);
        }
    }
    if (lightbox && lightbox.classList.contains('active')) {
        if (e.key === 'ArrowRight') lbNext();
        if (e.key === 'ArrowLeft') lbPrev();
    }
});

/* ─────────────────────────────────────────────
   LIGHTBOX ENGINE
───────────────────────────────────────────── */
const lightbox   = document.getElementById('lightbox');
const lbImg      = document.getElementById('lb-img');
const lbCur      = document.getElementById('lb-cur');
const lbTot      = document.getElementById('lb-tot');
const lbCaption  = document.getElementById('lb-caption');

let lbImages = [];   // [{src, title, desc}, ...]
let lbIndex  = 0;

function buildLbImages(gallery) {
    const items = gallery.querySelectorAll('.gallery-item img');
    return Array.from(items).map(img => ({
        src:   img.src,
        title: img.dataset.title || img.alt || '',
        desc:  img.dataset.desc  || ''
    }));
}

function openLightbox(images, startIndex) {
    lbImages = images;
    lbIndex  = startIndex;
    renderLb();
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
    playSound('open');
}

function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
    playSound('close');
    // Re-trigger img animation
    lbImg.style.opacity = '0';
    lbImg.style.transform = 'scale(0.92)';
}

function renderLb() {
    const item = lbImages[lbIndex];
    // Fade out → swap → fade in
    lbImg.style.opacity = '0';
    lbImg.style.transform = 'scale(0.95)';
    setTimeout(() => {
        lbImg.src = item.src;
        lbImg.alt = item.title;
        lbImg.style.opacity = '1';
        lbImg.style.transform = 'scale(1)';
    }, 160);
    lbCur.textContent = lbIndex + 1;
    lbTot.textContent = lbImages.length;
    lbCaption.innerHTML = item.title
        ? `<strong>${item.title}</strong>${item.desc}`
        : item.desc;
}

function lbNext() {
    lbIndex = (lbIndex + 1) % lbImages.length;
    renderLb();
    playSound('click');
}
function lbPrev() {
    lbIndex = (lbIndex - 1 + lbImages.length) % lbImages.length;
    renderLb();
    playSound('click');
}

// Click on gallery-item inside a modal → open lightbox
document.addEventListener('click', (e) => {
    const item = e.target.closest('.gallery-item');
    if (!item) return;
    const img = item.querySelector('img');
    if (!img) return;
    const gallery = item.closest('.modal-gallery');
    if (!gallery) return;
    const images = buildLbImages(gallery);
    const idx = Array.from(gallery.querySelectorAll('.gallery-item img')).indexOf(img);
    openLightbox(images, Math.max(0, idx));
});

// Lightbox controls
const lbCloseBtn = document.getElementById('lb-close');
const lbNextBtn = document.getElementById('lb-next');
const lbPrevBtn = document.getElementById('lb-prev');

if (lbCloseBtn) lbCloseBtn.addEventListener('click', closeLightbox);
if (lbNextBtn) lbNextBtn.addEventListener('click', lbNext);
if (lbPrevBtn) lbPrevBtn.addEventListener('click', lbPrev);

// Close on backdrop click (not image)
if (lightbox) {
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox || e.target.classList.contains('lightbox-img-wrap')) {
            closeLightbox();
        }
    });

    // Touch swipe support
    let lbTouchX = 0;
    lightbox.addEventListener('touchstart', (e) => { lbTouchX = e.touches[0].clientX; }, { passive: true });
    lightbox.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].clientX - lbTouchX;
        if (Math.abs(dx) > 50) { dx < 0 ? lbNext() : lbPrev(); }
    }, { passive: true });
}


/* ─────────────────────────────────────────────
   PARALLAX — Hero title on mouse move
───────────────────────────────────────────── */
document.addEventListener('mousemove', (e) => {
    const { innerWidth: W, innerHeight: H } = window;
    const x = (e.clientX / W - 0.5) * 2;
    const y = (e.clientY / H - 0.5) * 2;
    const title = document.querySelector('.hero-title');
    if (title) {
        title.style.transform = `translate(${x * 8}px, ${y * 4}px)`;
    }
});

/* ─────────────────────────────────────────────
   DYNAMIC PHOTOBOOK
───────────────────────────────────────────── */
const photobookData = [
    {
        id: "sesion-1",
        title: "Sesión I: Noche en La Guaira",
        desc: "Exploración nocturna de los callejones históricos de La Guaira, donde la arquitectura colonial venezolana cobra vida bajo las luces.",
        images: [
            { file: "WhatsApp Image 2026-04-17 at 17.01.22.jpeg", title: "El Callejón de las Escaleras", desc: "Perspectiva desde el interior del callejón colonial. Escaleras de piedra bañadas en luz azul que contrasta con los ocres de las paredes centenarias." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.25.jpeg", title: "Calle Bolívar — La Memoria de Piedra", desc: "Letrero histórico en pared ocre bajo luz nocturna. Las flores de buganvilia magenta caen sobre el borde, belleza en los rincones olvidados." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.27.jpeg", title: "Pasaje de las Palmas", desc: "Pasillo empedrado flanqueado por palmas y muros de ladrillo. Las guirnaldas de bombillos crean un techo de luz cálida bajo el cielo nocturno." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.29.jpeg", title: "Sendero Iluminado", desc: "Galería de arcos de ladrillo en perspectiva simétrica. Las luces colgantes se pierden en el punto de fuga como pequeños puntos dorados." }
        ]
    },
    {
        id: "sesion-2",
        title: "Sesión II: Calles de Luz y Sombra",
        desc: "Recorrido nocturno por el casco histórico, capturando la magia de los arcos iluminados, fachadas coloniales y la vida de sus habitantes.",
        images: [
            { file: "WhatsApp Image 2026-04-17 at 17.01.31.jpeg", title: "La Calle Viva", desc: "Callejón empedrado con arcos decorados por cientos de bombillos. El arco neón verde al fondo actúa como faro entre flores silvestres y columnas de piedra." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.32.jpeg", title: "La Ventana de los Siglos", desc: "Ventana enrejada en fachada de piedra colonial, iluminada en ámbar desde adentro. Ladrillo, piedra y barro narran siglos de historia en un solo encuadre." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.32 (1).jpeg", title: "Capas de Tiempo", desc: "Pared en ruinas donde conviven ladrillo antiguo, piedra rústica y enlucido descascarado. Un arco cegado sugiere aperturas que el tiempo fue sellando." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.32 (2).jpeg", title: "El Ojo de la Ruina", desc: "Túnel natural en roca arenisca enmarca una ventana colonial iluminada. La textura rugosa de la piedra domina el primer plano en tonos dorados." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.32 (3).jpeg", title: "Cueva de Memorias", desc: "Ángulo diferente del espacio rupestre. Las capas de sedimento forman un patrón casi orgánico alrededor de la ventana iluminada al fondo." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.32 (4).jpeg", title: "Balcón Colonial", desc: "Fachada amarilla vibrante con postigos de madera abiertos. Las palmas tropicales y la baranda generan capas que hablan de arquitectura viva y habitada." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.33.jpeg", title: "El Portal de la Medusa", desc: "Arco de medio punto blanco en contrapicado. Una escultura orgánica con forma de medusa cuelga iluminada desde abajo en atmósfera de galería de arte." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.33 (1).jpeg", title: "Red de Luces", desc: "Vista aérea del tejido de guirnaldas de bombillos sobre la calle. Arcos decorativos con neón verde crean profundidad teatral sobre el empedrado." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.34.jpeg", title: "Lluvia de Bombillos", desc: "Arcos iluminados curvados sobre la calle crean efecto de lluvia de luz. El faro azul en la esquina añade intensidad al fondo dorado." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.34 (1).jpeg", title: "Torre sobre Cielo Nublado", desc: "Edificio de varios pisos recortado contra cielo dramáticamente nublado. Composición minimalista en contrapicado que resalta la verticalidad arquitectónica." }
        ]
    },
    {
        id: "sesion-3",
        title: "Sesión III: Texturas & Arquitectura",
        desc: "Serie dedicada a detalles arquitectónicos, materiales históricos y encuadres abstractos que revelan la poesía visual oculta en el tiempo.",
        images: [
            { file: "WhatsApp Image 2026-04-17 at 17.01.35 (1).jpeg", title: "Horizonte Urbano", desc: "Edificio residencial en encuadre bajo. Las nubes densas contrastan con la fachada de concreto, creando atmósfera entre lo cotidiano y lo sublime." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.35 (2).jpeg", title: "Geometría Oculta", desc: "Muro colonial donde ladrillo, mampostería y enlucido crean patrones geométricos accidentales. La luz rasante revela profundidad en cada capa." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.35 (3).jpeg", title: "Relieves del Olvido", desc: "Superficie de piedra erosionada en macro. Los surcos y fracturas revelan una historia que ningún texto podría narrar con tanta sinceridad." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.35 (4).jpeg", title: "Entre Grietas", desc: "Textura coralina de pared antigua vista de cerca. El encuadre convierte el muro en un paisaje abstracto de montañas en miniatura color ámbar." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.35 (5).jpeg", title: "Paso del Tiempo", desc: "La transición entre estuque y piedra viva. Distintos materiales de construcción forman franjas casi pictóricas de color y textura." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.36.jpeg", title: "Arco de Piedra Viva", desc: "Arco de medio punto en ladrillo y piedra rústica visto desde el interior. La apertura central enmarca el exterior iluminado sobre la oscuridad." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.36 (1).jpeg", title: "Umbral Colonial", desc: "Umbral deteriorado mezclando mampostería, piedra y ladrillo — siglos de construcción superpuesta que hablan de continuidad y resistencia." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.36 (2).jpeg", title: "Luz en la Hendidura", desc: "Un rayo de luz penetra por una grieta angosta y toca el suelo empedrado. Simplicidad extrema que convierte un evento cotidiano en algo sagrado." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.36 (3).jpeg", title: "La Fachada que Respira", desc: "Muro de ladrillo expuesto con manchas de humedad que forman patrones orgánicos. Textura áspera y tonos tierra con inusitada belleza." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.36 (4).jpeg", title: "Código de Ladrillos", desc: "Vista perpendicular de muro de ladrillo antiguo. Cada pieza cuenta su historia de cocción, colocación y años de servicio estructural." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.37.jpeg", title: "Espejo de Agua", desc: "Superficie reflectante en el piso devuelve la imagen de los arcos iluminados. Simetría surreal que duplica la arquitectura histórica en el suelo." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.37 (1).jpeg", title: "Callejón en Plena Noche", desc: "Vista de conjunto del pasillo histórico con guirnaldas luminosas. Integración de plantas, arcos y personas en ambiente vibrante y cálido." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.37 (2).jpeg", title: "Detalles en Reposo", desc: "Elemento decorativo captado en quietud con fondo desenfocado. Composición íntima que transmite calma dentro del dinamismo urbano." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.37 (3).jpeg", title: "Sombras Paralelas", desc: "Sombras proyectadas sobre la pared por guirnaldas y estructuras del callejón. Líneas paralelas que crean un patrón gráfico sobre la percepción." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.37 (4).jpeg", title: "La Vuelta de los Arcos", desc: "Secuencia de arcos repetidos en profundidad crean ritmo visual hipnótico que guía la mirada hacia el punto de fuga iluminado." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.37 (5).jpeg", title: "Grano Grueso", desc: "Toma de alta sensibilidad con grano visible que convierte una escena nocturna en imagen cinematográfica, evocando el cine negro latinoamericano." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.38.jpeg", title: "Final de Calle", desc: "El extremo del callejón visto desde lejos. Densidad de luces y bullicio fundidos en masa de color dorado. La profundidad de campo comprime el espacio." },
            { file: "WhatsApp Image 2026-04-17 at 17.01.38 (1).jpeg", title: "Puerta de Madera Antigua", desc: "Puerta centenaria con cerrojo de hierro forjado. Sus capas de pintura descascarada y madera veteada guardan huellas de décadas de uso cotidiano." }
        ]
    },
    {
        id: "sesion-yo",
        title: "Sesión IV: Retrato & Ciudad",
        desc: "Serie de retratos urbanos de Jesus Omar Martinez — fotografía callejera, estilo editorial y exploraciones visuales entre la identidad personal y la ciudad como escenario.",
        images: [
            {
                file: "Yo/Jesus Formal.jpeg",
                title: "Ciudad en los Ojos",
                desc: "Retrato formal en blanco y negro con fondo negro absoluto. Jesus viste traje negro y camisa blanca; sus lentes circulares redondos reflejan el skyline de una ciudad. La composición minimalista irradia una elegancia oscura de editorial de moda."
            },
            {
                file: "Yo/jesus sueter.jpeg",
                title: "Skyline en la Noche",
                desc: "Retrato en blanco y negro de alta definición. La ciudad se refleja nuevamente en los lentes circulares, mientras el pelo rizado enmarca un gesto sereno. El pin de caballito de mar en el suéter negro añade un detalle de identidad personal."
            },
            {
                file: "Yo/Jesus.jpeg",
                title: "Paz & Frecuencias",
                desc: "Selfie cálida e íntima en interior con luz natural. Jesus hace la señal de paz mirando a cámara, con sus audífonos Beats alrededor del cuello y lentes cuadrados. La ventana verde al fondo da una ambiance de calma creativa."
            },
            {
                file: "Yo/foto1.png",
                title: "El Fotógrafo en la Calle",
                desc: "Jesus sostiene una Canon F-1 analógica apuntando directamente al lente. La calle bulliciosa de São Paulo al atardecer sirve de fondo: tráfico, neones y arquitectura clásica. Los auriculares al cuello refuerzan su identidad de creador multidisciplinar."
            },
            {
                file: "Yo/fotografiando2.png",
                title: "Pausa en el Movimiento",
                desc: "Vista de tres cuartos con la Canon F-1 en mano baja. El rostro tranquilo mira a cámara en medio del caos vehicular de la ciudad brasileña al atardecer. La luz dorada del ocaso baña su perfil creando un efecto cinematográfico."
            },
            {
                file: "Yo/fotografiando.png",
                title: "El Instante Decisivo",
                desc: "Jesus captura el momento exacto de disparar la Canon en una esquina de São Paulo. El ojo cerrado detrás del lente y la postura concentrada capturan la esencia misma de lo que significa ser fotógrafo en plena calle."
            },
            {
                file: "Yo/foto 2.png",
                title: "Jazz Club, Nueva Orleans",
                desc: "Retrato editorial de película en las calles históricas del Barrio Francés de Nueva Orleans. Traje negro, camisa blanca, collar de caracoles y lentes redondos con el skyline reflejado. Un tranvía vintage al fondo y el cartel de Jazz Club crean una atmósfera cinematográfica irrepetible."
            },
            {
                file: "Yo/foto vintage.png",
                title: "Hollywood Walk of Fame",
                desc: "Retrato analógico con grano de película en el Boulevard de la Fama. Jesus camina sobre las estrellas de Hollywood con traje negro entre carteles de neón vintage, autos clásicos y el frenesí de la ciudad. La luz ambarina del atardecer envuelve cada elemento."
            },
            {
                file: "Yo/quiero_que_la_202604171825 (1).png",
                title: "Distrito Neón",
                desc: "Retrato nocturno urbano con luces de neón azules, rojas y amarillas al fondo. El bokeh envuelve la escena en color mientras Jesus, de negro con su pin de caballito de mar, observa hacia arriba con serenidad. Una imagen que mezcla lo íntimo con lo urbano."
            }
        ]
    },
    {
        id: "sesion-5",
        title: "Sesión V: Retratos & Edición",
        desc: "Galería exclusiva de retratos seleccionados y editados de Jesús Omar Martínez. Capturas de alta definición, iluminación cuidada y atmósferas íntimas creadas en post-producción.",
        images: [
            {
                file: "Yo/yo_post_1.jpeg",
                title: "Conexión Digital",
                desc: "Retrato íntimo enfocado en la interacción del creador con sus herramientas y pantallas. La luz suave resalta el perfil sereno del artista en pleno flujo de ideas."
            },
            {
                file: "Yo/yo_post_2.jpeg",
                title: "Fondo y Enfoque",
                desc: "Juego de profundidades donde la textura y los colores del entorno urbano enmarcan la presencia decidida de Jesús. Composición audaz con gran carga expresiva."
            },
            {
                file: "Yo/yo_post_3.jpeg",
                title: "Retrato Editorial I",
                desc: "Primer plano de alta fidelidad. Los contrastes lumínicos destacan las facciones del creador en una atmósfera íntima y sumamente cuidada."
            },
            {
                file: "Yo/yo_post_4.jpeg",
                title: "Mirada Introspectiva",
                desc: "Toma de perfil que captura un instante reflexivo. El claroscuro esculpe el contorno del rostro con elegancia, transmitiendo paz creativa."
            },
            {
                file: "Yo/yo_post_5.jpeg",
                title: "Atmósfera Ámbar",
                desc: "Retrato bañado en tonalidades doradas que evocan el atardecer urbano. La calidez cromática envuelve la escena en una vibra nostálgica y reconfortante."
            },
            {
                file: "Yo/yo_post_6.jpeg",
                title: "Esencia Analógica",
                desc: "Retrato con grano sutil de película clásica. Jesús posa con naturalidad ante un entorno que respira autenticidad y amor por las artes clásicas."
            },
            {
                file: "Yo/yo_post_7.jpeg",
                title: "Luces Urbanas",
                desc: "Composición dinámica con la ciudad de noche como telón de fondo. Las luces de neón desenfocadas crean un efecto bokeh que realza el primer plano."
            },
            {
                file: "Yo/yo_post_8.jpeg",
                title: "Enfoque Creativo",
                desc: "Captura espontánea del fotógrafo en su hábitat. La postura y los detalles reflejan dedicación y una búsqueda constante de la belleza en la cotidianidad."
            },
            {
                file: "Yo/yo_post_9.jpeg",
                title: "Perfil del Creador",
                desc: "Fotografía que estudia la silueta del artista en contraluz. Una imagen poética y minimalista que resalta el misterio del proceso artístico."
            },
            {
                file: "Yo/yo_post_10.jpeg",
                title: "Mirada al Horizonte",
                desc: "Gesto sereno de cara al futuro. La iluminación lateral suave acentúa la expresión decidida e inspiradora de Jesús."
            },
            {
                file: "Yo/yo_post_11.jpeg",
                title: "Detalles del Alma",
                desc: "Toma artística en primerísimo primer plano. La nitidez y el juego de sombras revelan la profundidad de la mirada del fotógrafo."
            },
            {
                file: "Yo/yo_post_12.jpeg",
                title: "Expresión Urbana",
                desc: "Retrato que capta la complicidad entre el sujeto y el espacio urbano, logrando una armonía perfecta entre arquitectura y retrato humano."
            },
            {
                file: "Yo/yo_post_13.jpeg",
                title: "Luz de Estudio",
                desc: "Retrato captado bajo iluminación de estudio profesional. Las sombras suaves y los matices cromáticos esculpen una composición premium impecable."
            },
            {
                file: "Yo/yo_post_14.jpeg",
                title: "Frecuencia Silenciosa",
                desc: "Jesús retratado en su espacio de creación con auriculares. La escena transmite concentración total y el aislamiento necesario para pulir grandes ideas."
            },
            {
                file: "Yo/yo_post_15.jpeg",
                title: "Encuadre Cinematográfico",
                desc: "Fotografía con una relación de aspecto y colorización digna de un fotograma de cine independiente. Narra una historia en una sola mirada."
            },
            {
                file: "Yo/yo_post_16.jpeg",
                title: "Instante Dorado",
                desc: "Toma al aire libre con luz natural de hora dorada. Los rayos del sol destacan la calidez y espontaneidad del retrato."
            },
            {
                file: "Yo/yo_post_17.jpeg",
                title: "Estilo & Presencia",
                desc: "Retrato que resalta el estilo urbano y el cuidado de los detalles del artista. Una pieza de corte editorial con carácter y actitud."
            },
            {
                file: "Yo/yo_post_18.jpeg",
                title: "Geometría del Rostro",
                desc: "Juego de luces angulares que proyectan sombras definidas, aportando una dimensión tridimensional y dramática al retrato."
            },
            {
                file: "Yo/yo_post_19.jpeg",
                title: "Identidad & Textura",
                desc: "Retrato de gran formato con un enfoque meticuloso en las texturas de la piel y los detalles de vestuario, cerrando la sesión con máxima fidelidad."
            }
        ]
    }
];


const cardsContainer = document.getElementById('dynamic-photobook-cards');
const modalsContainer = document.getElementById('dynamic-modals-container');

if (cardsContainer && modalsContainer) {
    photobookData.forEach((session, index) => {
        // CARD
        const card = document.createElement('div');
        card.className = 'project-card reveal-up modal-trigger';
        card.style.setProperty('--d', `${index * 0.1 + 0.1}s`);
        card.setAttribute('data-target', `modal-${session.id}`);

        card.innerHTML = `
            <div class="project-thumb" style="background-image: url('assets/gallery/${session.images[0].file}');">
                <div class="project-thumb-overlay"></div>
                <span class="project-num">0${index + 4}</span>
            </div>
            <div class="project-card-info">
                <span class="tag">Sesión Fotográfica</span>
                <h3>${session.title}</h3>
                <p>${session.desc}</p>
                <div class="card-footer">
                    <span class="card-tech">${session.images.length} fotografías</span>
                    <span class="card-arrow">→</span>
                </div>
            </div>
        `;
        cardsContainer.appendChild(card);
        revealObserver.observe(card);

        // MODAL
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = `modal-${session.id}`;

        let galleryHTML = '';
        session.images.forEach(photo => {
            galleryHTML += `
                <div class="photobook-item">
                    <div class="photo-img">
                        <img src="assets/gallery/${photo.file}" alt="${photo.title}" loading="lazy">
                    </div>
                    <div class="photo-details">
                        <h5 class="photo-title">${photo.title}</h5>
                        <p class="photo-desc">${photo.desc}</p>
                    </div>
                </div>
            `;
        });

        modal.innerHTML = `
            <div class="modal-content">
                <button class="close-modal">&times;</button>
                <div class="modal-header">
                    <span class="tag">Sesión Fotográfica</span>
                    <h3>${session.title}</h3>
                    <p>${session.desc}</p>
                </div>
                <div class="modal-body">
                    <div class="photobook-grid">${galleryHTML}</div>
                </div>
            </div>
        `;
        modalsContainer.appendChild(modal);

        // Events for dynamic card/modal
        card.addEventListener('click', () => openModal(`modal-${session.id}`));
        modal.querySelector('.close-modal').addEventListener('click', () => closeModal(modal));
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });
    });

    // No-op (Cleaned up redundant cursor hover listeners)
}

// 3D Card Hover Tilt Effect (Inspired by Reel 3 UX) - Active globally
const tiltCards = document.querySelectorAll('.project-card, .cv-box, .photobook-item, .glass-card, .tilt-card');
tiltCards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        const px = x / (rect.width / 2);
        const py = y / (rect.height / 2);
        
        card.style.transform = `perspective(1000px) rotateY(${px * 8}deg) rotateX(${-py * 8}deg) scale3d(1.02, 1.02, 1.02)`;
        card.style.transition = 'transform 0.05s ease-out';
    });
    card.addEventListener('mouseleave', () => {
        card.style.transform = '';
        card.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
    });
});

// Circular Searchlight Text Mask Reveal (Inspired by Reel 2)
const heroTitleContainer = document.getElementById('hero-title-container');
if (heroTitleContainer) {
    window.addEventListener('mousemove', (e) => {
        const rect = heroTitleContainer.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        heroTitleContainer.style.setProperty('--mouse-x', `${mx}px`);
        heroTitleContainer.style.setProperty('--mouse-y', `${my}px`);
    });
}

})();
