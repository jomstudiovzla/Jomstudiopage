// ═══ ANTI-CLICKJACKING FRAMEBUSTING ═══
if (window.top !== window.self) {
    try {
        window.top.location = window.self.location;
    } catch (_) {
        window.location = 'about:blank';
    }
}

        // State Management
        let currentLang = 'en';

        // Force Dark Theme
        document.documentElement.classList.add('dark');


        // Language Toggle Logic
        const langLabel = document.getElementById('lang-label');
        const langMenuContainer = document.getElementById('lang-menu-container');
        const langOptions = document.querySelectorAll('.lang-option');

        function detectDeviceLang() {
            const nav = navigator.language || navigator.userLanguage || 'en';
            const code = nav.slice(0, 2).toLowerCase();
            return ['en','es','fr','pt'].includes(code) ? code : 'en';
        }

        function updateLanguage() {
            let actualLang = currentLang === 'auto' ? detectDeviceLang() : currentLang;
            if (currentLang === 'auto') {
                langLabel.textContent = "AUTO";
            } else {
                langLabel.textContent = actualLang.toUpperCase();
            }
            
            document.querySelectorAll('[data-en]').forEach(el => {
                if(el.hasAttribute(`data-${actualLang}`)) {
                    el.textContent = el.getAttribute(`data-${actualLang}`);
                } else {
                    el.textContent = el.getAttribute('data-en');
                }
            });
        }

        langOptions.forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                const lang = opt.dataset.lang;
                currentLang = lang;
                localStorage.setItem('jom_lang', lang);
                updateLanguage();
                
                // Hide dropdown
                const dropdown = langMenuContainer.querySelector('div.absolute');
                if(dropdown) {
                    dropdown.classList.remove('opacity-100', 'visible');
                    dropdown.classList.add('opacity-0', 'invisible');
                }
            });
        });

        const langToggleBtn = document.getElementById('lang-toggle');
        langToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = langMenuContainer.querySelector('div.absolute');
            if(dropdown.classList.contains('opacity-0')) {
                dropdown.classList.remove('opacity-0', 'invisible');
                dropdown.classList.add('opacity-100', 'visible');
            } else {
                dropdown.classList.remove('opacity-100', 'visible');
                dropdown.classList.add('opacity-0', 'invisible');
            }
        });
        
        document.addEventListener('click', () => {
            const dropdown = langMenuContainer?.querySelector('div.absolute');
            if(dropdown && dropdown.classList.contains('opacity-100')) {
                dropdown.classList.remove('opacity-100', 'visible');
                dropdown.classList.add('opacity-0', 'invisible');
            }
        });

        // Load saved language
        const savedLang = localStorage.getItem('jom_lang');
        if (savedLang) {
            currentLang = savedLang;
        } else {
            currentLang = 'auto';
        }
        updateLanguage();

        // Auto-detect browser language
        const userLang = navigator.language || navigator.userLanguage;
        if (userLang.startsWith('es')) {
            currentLang = 'es';
            updateLanguage();
        }

        // Clock Utility
        function updateClock() {
            const now = new Date();
            const timeString = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
            document.getElementById('real-time').textContent = timeString;
        }
        setInterval(updateClock, 1000);
        updateClock();

        // Slideshow Logic for Entre Páginas
        let currentSlide = 0;
        const totalSlides = 6;
        const slidesContainer = document.getElementById('entre-paginas-slides');
        
        function updateSlideshow() {
            if (!slidesContainer) return;
            slidesContainer.style.transform = `translateX(-${currentSlide * 100}%)`;
            // Update dots
            const dots = slidesContainer.nextElementSibling.querySelectorAll('span');
            dots.forEach((dot, idx) => {
                if (idx === currentSlide) {
                    dot.classList.add('bg-white', 'scale-110');
                    dot.classList.remove('bg-white/40');
                } else {
                    dot.classList.remove('bg-white', 'scale-110');
                    dot.classList.add('bg-white/40');
                }
            });
        }
        
        window.setSlide = function(index) {
            currentSlide = index;
            updateSlideshow();
        };
        
        window.prevSlide = function(e) {
            if (e) e.stopPropagation();
            currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
            updateSlideshow();
        };
        
        window.nextSlide = function(e) {
            if (e) e.stopPropagation();
            currentSlide = (currentSlide + 1) % totalSlides;
            updateSlideshow();
        };
        
        // Auto slide
        let slideInterval = setInterval(() => {
            currentSlide = (currentSlide + 1) % totalSlides;
            updateSlideshow();
        }, 4000);
        
        // Pause auto slide on hover/interaction
        const slideshowContainer = document.getElementById('entre-paginas-slides')?.parentElement;
        if (slideshowContainer) {
            slideshowContainer.addEventListener('mouseenter', () => clearInterval(slideInterval));
            slideshowContainer.addEventListener('mouseleave', () => {
                slideInterval = setInterval(() => {
                    currentSlide = (currentSlide + 1) % totalSlides;
                    updateSlideshow();
                }, 4000);
            });
        }
        
        // Initial call to set active dot
        updateSlideshow();

        // Interactive Scroll Parallax for Background Watermark
        window.addEventListener('scroll', () => {
            const scrollY = window.scrollY;
            const bodyWatermark = document.getElementById('body-watermark-container');
            if (bodyWatermark) {
                const watermarkRotate = scrollY * 0.02;
                const watermarkScale = 1 + scrollY * 0.0001;
                bodyWatermark.style.transform = `scale(${watermarkScale}) rotate(${watermarkRotate}deg)`;
            }
        });

        // Admin Redirect Logic
        const adminTrigger = document.getElementById('admin-trigger');
        if (adminTrigger) {
            adminTrigger.addEventListener('click', () => {
                window.location.href = '/?admin=true';
            });
        }

        // Custom Cursor Logic
        const cursorDot = document.getElementById('custom-cursor-dot');
        const cursorCircle = document.getElementById('custom-cursor-circle');
        
        let mouseX = 0;
        let mouseY = 0;
        let circleX = 0;
        let circleY = 0;
        let isCursorActive = false;

        window.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            
            if (!isCursorActive) {
                isCursorActive = true;
                if (cursorDot) cursorDot.style.opacity = '1';
                if (cursorCircle) cursorCircle.style.opacity = '1';
            }
            
            // Instantly move the dot using transform
            if (cursorDot) {
                cursorDot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
            }
        });

        document.addEventListener('mouseleave', () => {
            if (cursorDot) cursorDot.style.opacity = '0';
            if (cursorCircle) cursorCircle.style.opacity = '0';
            isCursorActive = false;
        });

        // Smooth trailing circle movement (lerp)
        function animateCircle() {
            const lerpSpeed = 0.15;
            circleX += (mouseX - circleX) * lerpSpeed;
            circleY += (mouseY - circleY) * lerpSpeed;

            if (cursorCircle) {
                cursorCircle.style.transform = `translate3d(${circleX}px, ${circleY}px, 0) translate(-50%, -50%)`;
            }

            requestAnimationFrame(animateCircle);
        }
        requestAnimationFrame(animateCircle);

        // Hover Effect on Interactive Elements
        const hoverables = 'a, button, input, textarea, [onclick], .glass-card, #services-tabs-container button';
        
        document.body.addEventListener('mouseover', (e) => {
            if (e.target.closest(hoverables)) {
                document.body.classList.add('cursor-hover');
            }
        });

        document.body.addEventListener('mouseout', (e) => {
            if (e.target.closest(hoverables)) {
                document.body.classList.remove('cursor-hover');
            }
        });
        // =========================================================
        // 3D TILT EFFECT — All .glass-card elements
        // =========================================================
        document.querySelectorAll('.glass-card').forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;
                const px = x / (rect.width / 2);
                const py = y / (rect.height / 2);
                card.style.transform = `perspective(1200px) rotateY(${px * 9}deg) rotateX(${-py * 9}deg) scale3d(1.02, 1.02, 1.02) translateY(-4px)`;
                card.style.transition = 'transform 0.05s ease-out';
                // Dynamic glow follow
                const glowX = (px + 1) / 2 * 100;
                const glowY = (py + 1) / 2 * 100;
                card.style.background = `radial-gradient(circle at ${glowX}% ${glowY}%, rgba(0,242,255,0.07), rgba(10,10,10,0.6) 60%)`;
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = '';
                card.style.background = '';
                card.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), background 0.5s ease';
            });
        });

        // =========================================================
        // REPOSITORY 3D BACKGROUND — Three.js Particle Field
        // =========================================================
        (function initRepoCanvas() {
            try {
                const canvas = document.getElementById('repo-canvas');
                if (!canvas || typeof THREE === 'undefined') return;

                const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
                renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
                renderer.setSize(window.innerWidth, window.innerHeight, false);

                const scene = new THREE.Scene();
                const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
                camera.position.set(0, 0, 30);

                // Particle System
                const count = 1800;
                const geo = new THREE.BufferGeometry();
                const positions = new Float32Array(count * 3);
                const initial = new Float32Array(count * 3);
                for (let i = 0; i < count * 3; i += 3) {
                    const x = (Math.random() - 0.5) * 80;
                    const y = (Math.random() - 0.5) * 80;
                    const z = (Math.random() - 0.5) * 60 - 10;
                    positions[i] = initial[i] = x;
                    positions[i+1] = initial[i+1] = y;
                    positions[i+2] = initial[i+2] = z;
                }
                geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                const mat = new THREE.PointsMaterial({
                    size: 0.12,
                    color: 0x2EC4B6,
                    transparent: true,
                    opacity: 0.4,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                });
                const points = new THREE.Points(geo, mat);
                scene.add(points);

                // Grid
                const grid = new THREE.GridHelper(120, 50, 0x2EC4B6, 0x2EC4B6);
                grid.position.y = -20;
                grid.material.opacity = 0.04;
                grid.material.transparent = true;
                scene.add(grid);

                // Mouse parallax
                let mx = 0, my = 0;
                window.addEventListener('mousemove', (e) => {
                    mx = (e.clientX / window.innerWidth - 0.5) * 2;
                    my = -(e.clientY / window.innerHeight - 0.5) * 2;
                });

                // Resize
                window.addEventListener('resize', () => {
                    renderer.setSize(window.innerWidth, window.innerHeight, false);
                    camera.aspect = window.innerWidth / window.innerHeight;
                    camera.updateProjectionMatrix();
                });

                const clock = new THREE.Clock();
                function animate() {
                    const t = clock.getElapsedTime();
                    const pos = geo.attributes.position.array;
                    for (let i = 0; i < pos.length; i += 3) {
                        const theta = t * 0.008 + i * 0.0008;
                        pos[i] = initial[i] * Math.cos(theta) - initial[i+2] * Math.sin(theta);
                        pos[i+1] = initial[i+1] + Math.sin(t * 0.04 + i) * 0.3;
                        pos[i+2] = initial[i] * Math.sin(theta) + initial[i+2] * Math.cos(theta);
                    }
                    geo.attributes.position.needsUpdate = true;

                    // Camera gentle parallax from mouse
                    camera.position.x += (mx * 2 - camera.position.x) * 0.03;
                    camera.position.y += (my * 1 - camera.position.y) * 0.03;

                    // Scroll camera drift
                    const scrollFrac = window.scrollY / (document.body.scrollHeight - window.innerHeight || 1);
                    camera.position.z = 30 - scrollFrac * 8;
                    grid.material.opacity = 0.04 + scrollFrac * 0.08;

                    renderer.render(scene, camera);
                    requestAnimationFrame(animate);
                }
                animate();
            } catch(e) {
                console.warn('Repository canvas WebGL failed:', e);
            }
        })();

// ═══ EVENT DELEGATION (REPLACES INLINE ONCLICK FOR STRICT CSP) ═══
document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.getAttribute('data-action');
    if (action === 'set-slide') {
        const slide = parseInt(target.getAttribute('data-slide'), 10);
        if (!isNaN(slide) && typeof setSlide === 'function') setSlide(slide);
    } else if (action === 'prev-slide') {
        if (typeof prevSlide === 'function') prevSlide(e);
    } else if (action === 'next-slide') {
        if (typeof nextSlide === 'function') nextSlide(e);
    }
});

window.setSlide = setSlide;
window.prevSlide = prevSlide;
window.nextSlide = nextSlide;
