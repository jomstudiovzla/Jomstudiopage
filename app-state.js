// ═══ ANTI-CLICKJACKING FRAMEBUSTING ═══
if (window.top !== window.self) {
    try {
        window.top.location = window.self.location;
    } catch (_) {
        window.location = 'about:blank';
    }
}

        // State Management
        const state = {
            theme: 'alexandrite', // 'alexandrite' or 'gold'
            lang: 'en' // 'en' or 'es'
        };

        const translations = {
            en: {
                nav_projects: "Projects",
                nav_services: "Services",
                nav_about: "About",
                btn_build: "Let's Build",
                system_status: "SYSTEM STATUS: OPTIMIZED",
                hero_title: "DIGITAL ALCHEMY",
                hero_subtitle: "Where Technical Architecture Meets Artistic Direction.",
                btn_initiate: "Initiate Project",
                btn_dossier: "View Dossier",
                btn_buy_launch: "Launch Kit · 300 USDT",
                btn_pricing: "View all packages",
                btn_buy_spark: "Spark 200 USDT",
                nav_pricing: "Pricing",
                scroll_decrypt: "Scroll to Decrypt",
                services_title: "Operations & Services",
                service_from_price: "From",
                service_view_pricing: "See packages",
                services_subtitle: "A unified system of digital capabilities structured through proven deployment cases.",
                service_deliverables_head: "Deliverables & Scope",
                service_tech_head: "Technology Stack",
                service_nodes_head: "Associated Repository Nodes",
                service_btn_select: "Activate Protocol",
                deployment_label: "Selected Deployment",
                case_study_desc: "A decentralized resource management simulator where water is the primary asset. We built the entire interaction layer from the ground up, utilizing WebGL for real-time fluid dynamics and a custom blockchain bridge for instantaneous asset verification.",
                nodes_label: "Active Nodes",
                latency_label: "Sync Latency",
                specs_link: "Explore Technical Specs",
                about_label: "CREATIVE LEADERSHIP",
                about_title: "Jesús Omar Martínez",
                about_desc: "Creative Director & Digital Developer behind JOM STUDIO. Fusing technical excellence (WebGL, Canvas, Chrome Extensions) with artistic direction and business strategy to craft complete, high-performance digital ecosystems.",
                brief_eyebrow: "Interactive Brief",
                brief_title: "Tell us what you want to build",
                brief_subtitle: "Fulfill the requirements below. Your message will be formatted and sent directly to us via your preferred channel.",
                label_name: "Your Name / Company",
                label_email: "Email Address",
                label_brief: "What do you want to build?",
                label_channel: "Preferred Transmission Protocol",
                channel_wa_desc: "Send instantly as a structured message.",
                channel_mail_desc: "Send via default mail handler.",
                btn_transmit: "Transmit Brief",
                cta_title: "Ready to evolve?",
                cta_subtitle: "We are currently accepting new strategic partnerships. Let's build the future of software together.",
                btn_initiate_cta: "Initiate Project",
                footer_desc: "Engineering immersive digital realities through code and creativity.",
                status_online: "STATUS: ONLINE",
                social_label: "SOCIAL",
                studio_label: "STUDIO",
                contact: "Contact",
                terms: "Terms"
            },
            es: {
                nav_projects: "Proyectos",
                nav_services: "Servicios",
                nav_about: "Nosotros",
                btn_build: "Construyamos",
                system_status: "ESTADO DEL SISTEMA: OPTIMIZADO",
                hero_title: "ALQUIMIA DIGITAL",
                hero_subtitle: "Donde la arquitectura técnica se encuentra con la dirección artística.",
                btn_initiate: "Iniciar Proyecto",
                btn_dossier: "Ver Dossier",
                btn_buy_launch: "Launch Kit · 300 USDT",
                btn_pricing: "Ver todos los paquetes",
                btn_buy_spark: "Spark 200 USDT",
                nav_pricing: "Precios",
                scroll_decrypt: "Desplazar para Desencriptar",
                services_title: "Operaciones y Servicios",
                service_from_price: "Desde",
                service_view_pricing: "Ver paquetes",
                services_subtitle: "Un sistema unificado de capacidades digitales estructurado a través de casos de despliegue reales.",
                service_deliverables_head: "Entregables y Alcance",
                service_tech_head: "Stack Tecnológico",
                service_nodes_head: "Nodos del Repositorio Asociados",
                service_btn_select: "Activar Protocolo",
                deployment_label: "Despliegue Seleccionado",
                case_study_desc: "Simulador descentralizado de recursos donde el agua es el activo principal. Construimos toda la interacción desde cero usando WebGL para dinámicas de fluidos en tiempo real y una verificación instantánea.",
                nodes_label: "Nodos Activos",
                latency_label: "Latencia de Sinc",
                specs_link: "Explorar Especificaciones",
                about_label: "LIDERAZGO CREATIVO",
                about_title: "Jesús Omar Martínez",
                about_desc: "Director Creativo y Desarrollador Digital detrás de JOM STUDIO. Fusionando la excelencia técnica (WebGL, Canvas, extensiones de Chrome) con la dirección artística y la estrategia de negocios para crear ecosistemas digitales completos y de alto rendimiento.",
                brief_eyebrow: "Brief Interactivo",
                brief_title: "Cuéntanos qué quieres construir",
                brief_subtitle: "Completa los campos a continuación. Tu mensaje será estructurado y enviado directamente según el canal de tu preferencia.",
                label_name: "Tu Nombre / Empresa",
                label_email: "Correo de Contacto",
                label_brief: "¿Qué deseas construir?",
                label_channel: "Protocolo de Transmisión Preferido",
                channel_wa_desc: "Enviar al instante como mensaje estructurado.",
                channel_mail_desc: "Enviar vía tu manejador de correo.",
                btn_transmit: "Transmitir Brief",
                cta_title: "¿Listo para evolucionar?",
                cta_subtitle: "Aceptamos nuevas asociaciones estratégicas. Construyamos el futuro del software juntos.",
                btn_initiate_cta: "Iniciar Proyecto",
                footer_desc: "Ingeniería de realidades digitales inmersivas mediante código y creatividad.",
                status_online: "ESTADO: EN LÍNEA",
                social_label: "SOCIAL",
                studio_label: "ESTUDIO",
                contact: "Contacto",
                terms: "Términos"
            },
            fr: {
                nav_projects: "Projets",
                nav_services: "Services",
                nav_about: "À propos",
                btn_build: "Construisons",
                system_status: "ÉTAT DU SYSTÈME : OPTIMISÉ",
                hero_title: "ALCHIMIE NUMÉRIQUE",
                hero_subtitle: "Où l'architecture technique rencontre la direction artistique.",
                btn_initiate: "Initier le Projet",
                btn_dossier: "Voir le Dossier",
                btn_buy_launch: "Launch Kit · 300 USDT",
                btn_pricing: "Voir tous les packs",
                btn_buy_spark: "Spark 200 USDT",
                nav_pricing: "Tarifs",
                scroll_decrypt: "Faire défiler",
                services_title: "Opérations & Services",
                service_from_price: "À partir de",
                service_view_pricing: "Voir les packs",
                services_subtitle: "Un système unifié de capacités numériques structuré à travers des cas de déploiement éprouvés.",
                service_deliverables_head: "Livrables & Portée",
                service_tech_head: "Pile Technologique",
                service_nodes_head: "Nœuds de Dépôt",
                service_btn_select: "Activer le Protocole",
                deployment_label: "Déploiement Sélectionné",
                case_study_desc: "Un simulateur de gestion de ressources décentralisé où l'eau est le principal actif. Nous avons construit la couche d'interaction de A à Z en utilisant WebGL pour la dynamique des fluides en temps réel et un pont blockchain personnalisé pour une vérification instantanée des actifs.",
                nodes_label: "Nœuds Actifs",
                latency_label: "Latence de Sync",
                specs_link: "Spécifications",
                about_label: "LEADERSHIP CRÉATIF",
                about_title: "Jesús Omar Martínez",
                about_desc: "Directeur Créatif & Développeur Digital derrière JOM STUDIO. Fusionner l'excellence technique (WebGL, Canvas, Extensions Chrome) avec la direction artistique et la stratégie commerciale pour créer des écosystèmes numériques complets et performants.",
                brief_eyebrow: "Brief Interactif",
                brief_title: "Dites-nous ce que vous voulez",
                brief_subtitle: "Remplissez les conditions ci-dessous. Votre message sera formaté et envoyé directement via votre canal préféré.",
                label_name: "Votre Nom / Entreprise",
                label_email: "Adresse Email",
                label_brief: "Que voulez-vous construire ?",
                label_channel: "Protocole de Transmission",
                channel_wa_desc: "Message instantané.",
                channel_mail_desc: "Envoyer par e-mail.",
                btn_transmit: "Transmettre le Brief",
                cta_title: "Prêt à évoluer ?",
                cta_subtitle: "Nous acceptons actuellement de nouveaux partenariats stratégiques. Construisons ensemble l'avenir du logiciel.",
                btn_initiate_cta: "Initier le Projet",
                footer_desc: "Ingénierie de réalités numériques immersives par le code et la créativité.",
                status_online: "STATUT : EN LIGNE",
                social_label: "SOCIAL",
                studio_label: "STUDIO",
                contact: "Contact",
                terms: "Termes"
            },
            pt: {
                nav_projects: "Projetos",
                nav_services: "Serviços",
                nav_about: "Sobre nós",
                btn_build: "Vamos Construir",
                system_status: "STATUS DO SISTEMA: OTIMIZADO",
                hero_title: "ALQUIMIA DIGITAL",
                hero_subtitle: "Onde a Arquitetura Técnica Encontra a Direção Artística.",
                btn_initiate: "Iniciar Projeto",
                btn_dossier: "Ver Dossiê",
                btn_buy_launch: "Launch Kit · 300 USDT",
                btn_pricing: "Ver todos os pacotes",
                btn_buy_spark: "Spark 200 USDT",
                nav_pricing: "Preços",
                scroll_decrypt: "Role para baixo",
                services_title: "Operações & Serviços",
                service_from_price: "A partir de",
                service_view_pricing: "Ver pacotes",
                services_subtitle: "Um sistema unificado de capacidades digitais estruturado através de casos de implantação comprovados.",
                service_deliverables_head: "Entregáveis & Escopo",
                service_tech_head: "Stack Tecnológico",
                service_nodes_head: "Nós de Repositório",
                service_btn_select: "Ativar Protocolo",
                deployment_label: "Implantação Selecionada",
                case_study_desc: "Um simulador de gerenciamento de recursos descentralizado onde a água é o principal ativo. Construímos toda a camada de interação do zero, utilizando WebGL para dinâmica de fluidos em tempo real e uma ponte blockchain customizada.",
                nodes_label: "Nós Ativos",
                latency_label: "Latência de Sinc",
                specs_link: "Especificações",
                about_label: "LIDERANÇA CRIATIVA",
                about_title: "Jesús Omar Martínez",
                about_desc: "Diretor Criativo e Desenvolvedor Digital por trás do JOM STUDIO. Unindo a excelência técnica (WebGL, Canvas, Extensões Chrome) com direção artística e estratégia de negócios para criar ecossistemas digitais completos de alto desempenho.",
                brief_eyebrow: "Brief Interativo",
                brief_title: "O que você deseja construir",
                brief_subtitle: "Preencha os requisitos abaixo. Sua mensagem será formatada e enviada diretamente a nós pelo seu canal preferido.",
                label_name: "Seu Nome / Empresa",
                label_email: "Endereço de Email",
                label_brief: "O que construir?",
                label_channel: "Canal de Transmissão",
                channel_wa_desc: "Mensagem instantânea.",
                channel_mail_desc: "Enviar por e-mail.",
                btn_transmit: "Transmitir Brief",
                cta_title: "Pronto para evoluir?",
                cta_subtitle: "Atualmente estamos aceitando novas parcerias estratégicas. Vamos construir o futuro do software juntos.",
                btn_initiate_cta: "Iniciar Projeto",
                footer_desc: "Engenharia de realidades digitais imersivas através de código e criatividade.",
                status_online: "STATUS: ONLINE",
                social_label: "SOCIAL",
                studio_label: "ESTÚDIO",
                contact: "Contato",
                terms: "Termos"
            }
        };

        const servicesData = [
            {
                id: "gamification",
                icon: "sports_esports",
                code: "PROTOCOL_01",
                title: { 
                    en: "Interactive Gamification", 
                    es: "Gamificación Interactiva",
                    fr: "Gamification Interactive",
                    pt: "Gamificação Interativa"
                },
                desc: { 
                    en: "Building high-engagement interactive systems and custom canvas engines that convert user attention into immersive digital experiences.", 
                    es: "Construcción de sistemas interactivos de alto engagement y motores canvas personalizados para convertir la atención en experiencias inmersivas.",
                    fr: "Construction de systèmes interactifs à fort engagement et de moteurs canvas sur mesure pour convertir l'attention en expériences immersives.",
                    pt: "Construção de sistemas interativos de alto engajamento e motores canvas personalizados para converter a atenção em experiências imersivas."
                },
                deliverables: {
                    en: ["2D/3D Web Games", "Custom Canvas Physics", "Interactive Simulators", "WebGL Card Games"],
                    es: ["Juegos Web 2D/3D", "Físicas Canvas a Medida", "Simuladores Interactivos", "Juegos de Cartas WebGL"],
                    fr: ["Jeux Web 2D/3D", "Physique Canvas Personnalisée", "Simulateurs Interactifs", "Jeux de Cartes WebGL"],
                    pt: ["Jogos Web 2D/3D", "Física Canvas Personalizada", "Simuladores Interativos", "Jogos de Cartas WebGL"]
                },
                tech: ["Vanilla JS", "WebGL", "Three.js", "Phaser", "Canvas 2D"],
                cases: [
                    { num: "018", name: "JOM Cemetery Engine", link: "repository.html" },
                    { num: "001", name: "Crypto Water War", link: "repository.html" },
                    { num: "004", name: "Futstreet", link: "repository.html" },
                    { num: "006", name: "Western Poker", link: "repository.html" },
                    { num: "012", name: "EduKids Galactic", link: "repository.html" }
                ]
            },
            {
                id: "webdev",
                icon: "terminal",
                code: "PROTOCOL_02",
                title: { 
                    en: "Full-Stack Architectures", 
                    es: "Arquitecturas Full-Stack",
                    fr: "Architectures Full-Stack",
                    pt: "Arquiteturas Full-Stack"
                },
                desc: { 
                    en: "High-performance, secure, and SEO-optimized web systems tailored for digital businesses and premium interfaces.", 
                    es: "Sistemas web de alto rendimiento, seguros y optimizados para SEO, diseñados para negocios digitales e interfaces premium.",
                    fr: "Systèmes web haute performance, sécurisés et optimisés pour le référencement, conçus pour les entreprises numériques et les interfaces haut de gamme.",
                    pt: "Sistemas web de alto desempenho, seguros e otimizados para SEO, projetados para negócios digitais e interfaces premium."
                },
                deliverables: {
                    en: ["Next.js Custom Portals", "High-Speed E-commerce Storefronts", "Dynamic Booking Engines", "Interactive Landings"],
                    es: ["Portales Next.js a Medida", "Tiendas E-commerce Ultra-Rápidas", "Motores de Reserva Dinámicos", "Landings Interactivas"],
                    fr: ["Portails Next.js Sur Mesure", "Boutiques E-commerce Ultra-Rapides", "Moteurs de Réservation Dynamiques", "Pages de Destination Interactives"],
                    pt: ["Portais Next.js Sob Medida", "Lojas E-commerce Ultra-Rápidas", "Motores de Reserva Dinâmicos", "Landing Pages Interativas"]
                },
                tech: ["Next.js", "React", "Node.js", "PostgreSQL", "Firebase"],
                cases: [
                    { num: "019", name: "Supermarket E-commerce RPA", link: "repository.html" },
                    { num: "008", name: "Pino Espace Verts", link: "repository.html" },
                    { num: "009", name: "Oliveros Estudio", link: "repository.html" },
                    { num: "013", name: "ACACENTRO", link: "repository.html" },
                    { num: "015", name: "Inmobiliaria Premium", link: "repository.html" }
                ]
            },
            {
                id: "ai",
                icon: "neurology",
                code: "PROTOCOL_03",
                title: { 
                    en: "AI Art & Visual Direction", 
                    es: "Arte IA y Dirección Visual",
                    fr: "Art IA & Direction Visuelle",
                    pt: "Arte de IA & Direção Visual"
                },
                desc: { 
                    en: "Synthesizing cutting-edge generative AI models to accelerate production workflows and craft unique brand aesthetics.", 
                    es: "Sintetizando modelos de IA generativa de vanguardia para acelerar flujos de producción y diseñar estéticas de marca únicas.",
                    fr: "Synthèse de modèles d'IA générative de pointe pour accélérer les flux de production et concevoir des esthétiques de marque uniques.",
                    pt: "Sintetizando modelos de IA generativa de ponta para acelerar fluxos de produção e criar estéticas de marca únicas."
                },
                deliverables: {
                    en: ["Concept Art Generation", "Character Design & Casting", "Editorial Curation", "AI Workflow Automation"],
                    es: ["Generación de Arte Conceptual", "Diseño de Personajes", "Curaduría Editorial", "Automatización de Flujo IA"],
                    fr: ["Génération d'Art Conceptuel", "Conception de Personnages", "Curation Éditoriale", "Automatisation de Flux IA"],
                    pt: ["Geração de Arte Conceitual", "Design de Personagens", "Curadoria Editorial", "Automação de Fluxo de IA"]
                },
                tech: ["Midjourney", "Kling AI", "Stable Diffusion", "Prompt Engineering"],
                cases: [
                    { num: "002", name: "Bon Dia", link: "repository.html" },
                    { num: "016", name: "Entre Páginas", link: "repository.html" }
                ]
            },
            {
                id: "automation",
                icon: "settings_suggest",
                code: "PROTOCOL_04",
                title: { 
                    en: "Automation & Utilities", 
                    es: "Automatización y Utilidades",
                    fr: "Automatisation et Utilitaires",
                    pt: "Automação e Utilitários"
                },
                desc: { 
                    en: "Custom extension and scripting protocols to eliminate repetitive tasks and streamline operations.", 
                    es: "Protocolos de extensiones y scripting a medida para eliminar tareas repetitivas y optimizar operaciones comerciales.",
                    fr: "Protocoles d'extensions et de scripts personnalisés pour éliminer les tâches répétitives et rationaliser les opérations.",
                    pt: "Protocolos de extensões e scripts sob medida para eliminar tarefas repetitivas e otimizar operações comerciais."
                },
                deliverables: {
                    en: ["Google Chrome Extensions", "Custom Web Scrapers", "Image Processing Pipelines", "Shell Automations"],
                    es: ["Extensiones de Chrome", "Scrapers Web a Medida", "Procesadores de Imagen en Lote", "Automatizaciones de Consola"],
                    fr: ["Extensions Google Chrome", "Web Scrapers Sur Mesure", "Pipelines de Traitement d'Images", "Automatisations Shell"],
                    pt: ["Extensões do Chrome", "Web Scrapers Sob Medida", "Pipelines de Processamento de Imagens", "Automações de Shell"]
                },
                tech: ["Chrome APIs", "Python PIL", "Node.js", "Shell Scripting"],
                cases: [
                    { num: "017", name: "Chrome Extensions Suite", link: "repository.html" },
                    { num: "019", name: "Supermarket RPA Pipeline", link: "repository.html" },
                    { num: "003", name: "Polar Campaign", link: "repository.html" },
                    { num: "007", name: "Jabones con Historia", link: "repository.html" }
                ]
            },
            {
                id: "ugc",
                icon: "video_camera_back",
                code: "PROTOCOL_05",
                title: { 
                    en: "High-Retention Content (UGC)", 
                    es: "Contenido de Alta Retención (UGC)",
                    fr: "Contenu à Haute Rétention (UGC)",
                    pt: "Conteúdo de Alta Retenção (UGC)"
                },
                desc: { 
                    en: "Viral video production and rhythmic content strategies designed to capture and hold user attention in social environments.", 
                    es: "Producción de video viral y estrategias de contenido rítmicas diseñadas para capturar y retener la atención en redes sociales.",
                    fr: "Production de vidéos virales et stratégies de contenu rythmiques conçues pour capter et retenir l'attention sur les réseaux sociaux.",
                    pt: "Produção de vídeo viral e estratégias de conteúdo rítmicas projetadas para capturar e reter a atenção nas redes sociais."
                },
                deliverables: {
                    en: ["Short-form Video Production", "Rhythmic Audio Syncing", "Instagram Grid Strategy", "High-Retention Ad Loops"],
                    es: ["Producción de Videos Cortos", "Sincronización Rítmica de Audio", "Estrategia de Rejilla de IG", "Loops Publicitarios de Alta Retención"],
                    fr: ["Production de Vidéos Courtes", "Synchronisation Audio Rythmique", "Stratégie de Grille Instagram", "Boucles Publicitaires à Haute Rétention"],
                    pt: ["Produção de Vídeos Curtos", "Sincronização Rítmica de Áudio", "Estratégia de Grade do IG", "Loops Publicitários de Alta Retenção"]
                },
                tech: ["CapCut Pro", "UGC Video Loops", "Audio APIs", "Engagement Analytics"],
                cases: [
                    { num: "014", name: "BEATREGS", link: "repository.html" },
                    { num: "016", name: "Entre Páginas", link: "repository.html" }
                ]
            },
            {
                id: "branding",
                icon: "photo_size_select_small",
                code: "PROTOCOL_06",
                title: { 
                    en: "Branding & UX/UI Layout", 
                    es: "Branding y Maquetación UX/UI",
                    fr: "Branding et Mise en Page UX/UI",
                    pt: "Branding e Layout UX/UI"
                },
                desc: { 
                    en: "Designing precise graphic identities, structural packaging dielines, and clean wireframes for seamless digital-physical interfaces.", 
                    es: "Diseño de identidades gráficas precisas, troqueles estructurales para empaques y esquemas limpios para interfaces digitales y físicas.",
                    fr: "Conception d'identités graphiques précises, de gabarits d'emballage structurels et de wireframes épurés pour des interfaces numériques et physiques fluides.",
                    pt: "Design de identidades gráficas precisas, moldes estruturais para embalagens e wireframes limpos para interfaces digitais e físicas."
                },
                deliverables: {
                    en: ["Structural Packaging Dielines", "Brand Identity Manuals", "UX/UI High-Fidelity Mockups", "Vector Dieline Engineering"],
                    es: ["Troqueles de Empaque Estructurales", "Manuales de Identidad de Marca", "Prototipos UX/UI de Alta Fidelidad", "Ingeniería de Troquel Vectorial"],
                    fr: ["Gabarits d'Emballage Structurels", "Manuels d'Identité de Marque", "Maquettes UX/UI Haute Fidélité", "Ingénierie de Gabarit Vectoriel"],
                    pt: ["Moldes de Embalagem Estruturais", "Manuais de Identidade de Marca", "Protótipos UX/UI de Alta Fidelidade", "Engenharia de Molde Vetorial"]
                },
                tech: ["Figma", "Adobe Illustrator", "InDesign", "Vector Engineering"],
                cases: [
                    { num: "005", name: "Pocket AI App", link: "repository.html" },
                    { num: "010", name: "Alivia", link: "repository.html" },
                    { num: "011", name: "Dawn Dielines", link: "repository.html" }
                ]
            },
            {
                id: "consulting",
                icon: "insights",
                code: "PROTOCOL_07",
                title: { 
                    en: "Creative Tech Consulting", 
                    es: "Consultoría Tecnológica Creativa",
                    fr: "Conseil en Technologies Créatives",
                    pt: "Consultoria em Tecnologia Criativa"
                },
                desc: { 
                    en: "Guiding brands through digital transformation, custom tool mapping, and creative-technical strategy to maximize engagement and optimize workflows.", 
                    es: "Guiando a las marcas a través de la transformación digital, diseño de herramientas a medida y estrategia de tecnología creativa para optimizar flujos.",
                    fr: "Accompagner les marques dans la transformation numérique, la conception d'outils sur mesure et la stratégie technico-créative pour optimiser les flux.",
                    pt: "Guiando marcas através da transformação digital, mapeamento de ferramentas sob medida e estratégia técnico-criativa para otimizar fluxos."
                },
                deliverables: {
                    en: ["Digital Architecture Mapping", "UX/UI Auditing & Optimization", "AI Workflow Audits", "Creative Direction Dossiers"],
                    es: ["Planificación de Arquitectura Digital", "Auditoría y Optimización UX/UI", "Auditorías de Flujo IA", "Dossieres de Dirección Creativa"],
                    fr: ["Cartographie de l'Architecture Numérique", "Audit et Optimisation UX/UI", "Audits de Flux IA", "Dossiers de Direction Créative"],
                    pt: ["Mapeamento de Arquitetura Digital", "Auditoria e Otimização UX/UI", "Auditorias de Fluxo de IA", "Dossiês de Direção Criativa"]
                },
                tech: ["Figma", "GA4 Analytics", "Engagement Audits", "Tech Stacks Planning"],
                cases: [
                    { num: "001", name: "Crypto Water War", link: "repository.html" },
                    { num: "005", name: "Pocket AI App", link: "repository.html" },
                    { num: "014", name: "BEATREGS", link: "repository.html" }
                ]
            }
        ];

        let activeServiceIdx = 0;

        // Map home protocols → commerce category + entry product
        const servicePricingMap = {
            gamification: { category: 'gamification', productId: 'engine', from: 600 },
            webdev: { category: 'web', productId: 'spark', from: 200 },
            ai: { category: 'ai', productId: 'ai_visual', from: 200 },
            automation: { category: 'automation', productId: 'chrome_ext', from: 350 },
            ugc: { category: 'ugc', productId: 'ugc_pack', from: 280 },
            branding: { category: 'branding', productId: 'brand_identity', from: 250 },
            consulting: { category: 'web', productId: 'custom', from: 0 }
        };

        function renderServices() {
            let currentDisplayLang = state.lang === 'auto' ? detectDeviceLang() : state.lang;
            const tabsContainer = document.getElementById('services-tabs-container');
            const deliverablesList = document.getElementById('console-deliverables-list');
            const techList = document.getElementById('console-tech-list');
            const nodesList = document.getElementById('console-nodes-list');

            if (!tabsContainer) return;

            // Render Left Tabs
            tabsContainer.innerHTML = servicesData.map((service, idx) => {
                const isActive = idx === activeServiceIdx;
                const activeClasses = isActive 
                    ? 'border-primary-fixed bg-primary-fixed/20 text-primary-fixed font-bold shadow-premium'
                    : 'border-outline-variant/30 text-on-surface-variant hover:border-primary-fixed hover:text-on-surface bg-surface-container-low/90';
                
                return `
                    <button type="button" onclick="selectService(${idx})" class="w-full min-w-0 text-left p-3 sm:p-4 rounded-xl border flex items-center justify-between gap-2 transition-all duration-300 group ${activeClasses}">
                        <div class="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                            <span class="material-symbols-outlined text-lg sm:text-xl shrink-0 ${isActive ? 'text-primary-fixed animate-pulse' : 'text-on-surface-variant group-hover:text-primary-fixed'}">${service.icon}</span>
                            <div class="flex flex-col min-w-0">
                                <span class="font-label-mono text-[9px] text-outline tracking-wider uppercase">${service.code}</span>
                                <span class="font-headline-md text-[13px] sm:text-sm tracking-tight text-white break-words leading-snug">${service.title[currentDisplayLang] || service.title['en']}</span>
                            </div>
                        </div>
                        <span class="material-symbols-outlined text-[14px] sm:text-[16px] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? 'opacity-100 text-primary-fixed' : 'text-on-surface-variant'}">arrow_forward_ios</span>
                    </button>
                `;
            }).join('');

            // Render Right Details Console
            const current = servicesData[activeServiceIdx];
            document.getElementById('console-protocol-code').textContent = current.code;
            document.getElementById('console-protocol-title').textContent = current.title[currentDisplayLang] || current.title['en'];
            document.getElementById('console-protocol-desc').textContent = current.desc[currentDisplayLang] || current.desc['en'];

            // Render Deliverables
            deliverablesList.innerHTML = (current.deliverables[currentDisplayLang] || current.deliverables['en']).map(del => `
                <li class="flex items-center gap-3 text-on-surface-variant text-sm">
                    <span class="w-1.5 h-1.5 bg-primary-fixed rounded-full"></span>
                    <span>${del}</span>
                </li>
            `).join('');

            // Render Tech Tags
            techList.innerHTML = current.tech.map(tech => `
                <span class="font-label-mono text-[10px] text-on-surface-variant border border-outline-variant/30 px-2.5 py-1 bg-surface-container-low/10 rounded-lg">${tech}</span>
            `).join('');

            // Render Nodes
            nodesList.innerHTML = current.cases.map(c => `
                <a href="${c.link}" class="font-label-mono text-[10px] text-primary-fixed border border-primary-fixed/20 hover:border-primary-fixed hover:bg-primary-fixed/5 px-2.5 py-1 transition-all flex items-center gap-1.5 bg-primary-fixed/5">
                    <span class="w-1 h-1 bg-primary-fixed rounded-full animate-pulse"></span>
                    <span>CASE_${c.num}: ${c.name}</span>
                </a>
            `).join('');

            // Pricing chip for active protocol
            const priceLink = document.getElementById('console-pricing-link');
            const priceLabel = document.getElementById('console-price-label');
            const map = servicePricingMap[current.id];
            if (priceLink && priceLabel && map) {
                let from = map.from;
                let buyId = map.productId;
                if (window.JOM_COMMERCE) {
                    const list = JOM_COMMERCE.productsByCategory(map.category).filter(p => p.priceUsdt > 0);
                    if (list.length) {
                        list.sort((a, b) => a.priceUsdt - b.priceUsdt);
                        from = list[0].priceUsdt;
                        buyId = list[0].id;
                    }
                }
                const fromWord = (translations[currentDisplayLang] && translations[currentDisplayLang].service_from_price) || 'From';
                priceLabel.textContent = `${fromWord} ${from} USDT`;
                priceLink.href = `services.html#pkg-${buyId}`;
                priceLink.classList.remove('hidden');
            }
        }

        window.selectService = function(index) {
            activeServiceIdx = index;
            renderServices();
        };

        // Force Dark Theme
        document.documentElement.classList.add('dark');
        document.body.classList.remove('light-theme');

        // Language Toggle Logic
        const langLabel = document.getElementById('lang-label');
        const langMenuContainer = document.getElementById('lang-menu-container');
        const langOptions = document.querySelectorAll('.lang-option');

        function detectDeviceLang() {
            const nav = navigator.language || navigator.userLanguage || 'en';
            const code = nav.slice(0, 2).toLowerCase();
            return translations[code] ? code : 'en';
        }

        function updateLanguage() {
            let actualLang = state.lang === 'auto' ? detectDeviceLang() : state.lang;
            if (state.lang === 'auto') {
                langLabel.textContent = "AUTO";
            } else {
                langLabel.textContent = actualLang.toUpperCase();
            }
            
            document.querySelectorAll('[data-t]').forEach(el => {
                const key = el.getAttribute('data-t');
                if (translations[actualLang] && translations[actualLang][key]) {
                    el.innerHTML = translations[actualLang][key];
                    if (key === 'hero_title') {
                        const top = document.getElementById('hero-title-top');
                        if (top) top.innerHTML = translations[actualLang][key];
                    }
                }
            });
            renderServices();
        }

        langOptions.forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                const lang = opt.dataset.lang;
                state.lang = lang;
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
            state.lang = savedLang;
        } else {
            state.lang = 'auto';
        }
        updateLanguage();

        // Clock Utility
        function updateClock() {
            const now = new Date();
            const timeString = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
            document.getElementById('real-time').textContent = timeString;
        }
        setInterval(updateClock, 1000);
        updateClock();

        // Interactive Scroll Parallax and Logo Rotation
        window.addEventListener('scroll', () => {
            const scrollY = window.scrollY;
            
            // Fixed Background Watermark subtle interaction
            const bodyWatermark = document.getElementById('body-watermark-container');
            if (bodyWatermark) {
                const watermarkRotate = scrollY * 0.02;
                const watermarkScale = 1 + scrollY * 0.0001;
                bodyWatermark.style.transform = `scale(${watermarkScale}) rotate(${watermarkRotate}deg)`;
            }


        });

        // Scroll Observer
        const observerOptions = { threshold: 0.1 };
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('opacity-100', 'translate-y-0');
                    entry.target.classList.remove('opacity-0', 'translate-y-10');
                }
            });
        }, observerOptions);

        document.querySelectorAll('section').forEach(section => {
            section.classList.add('transition-all', 'duration-1000', 'opacity-0', 'translate-y-10');
            observer.observe(section);
        });

        // Event listener hooks
        document.querySelectorAll('[data-t="btn_build"], [data-t="btn_initiate"], [data-t="btn_initiate_cta"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                document.getElementById('brief').scrollIntoView({ behavior: 'smooth' });
            });
        });

        const dossierBtn = document.querySelector('[data-t="btn_dossier"]');
        if (dossierBtn) {
            dossierBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = 'repository.html';
            });
        }

        // Connect Service Console Select Button to Brief Form
        const consoleSelectBtn = document.getElementById('console-select-btn');
        if (consoleSelectBtn) {
            consoleSelectBtn.addEventListener('click', () => {
                const current = servicesData[activeServiceIdx];
                const formBrief = document.getElementById('client-brief');
                if (formBrief) {
                    const template = state.lang === 'en'
                        ? `Hello JOM STUDIO! 🚀 I am interested in your "${current.title.en}" (${current.code}) service protocol for my project.`
                        : `¡Hola JOM STUDIO! 🚀 Estoy interesado en el protocolo de servicio de "${current.title.es}" (${current.code}) para mi proyecto.`;
                    formBrief.value = template;
                    
                    // Focus name input to kickstart brief completion
                    const clientName = document.getElementById('client-name');
                    document.getElementById('brief').scrollIntoView({ behavior: 'smooth' });
                    setTimeout(() => {
                        if (clientName) clientName.focus();
                    }, 800);
                }
            });
        }

        // Initialize dynamic services view
        renderServices();

        // Interactive Brief Submission → CRM + WhatsApp/Email + optional Formspree
        const briefForm = document.getElementById('project-brief-form');
        if (briefForm) {
            briefForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('client-name').value.trim();
                const email = document.getElementById('client-email').value.trim();
                const briefText = document.getElementById('client-brief').value.trim();
                const channel = document.querySelector('input[name="comm-channel"]:checked').value;
                const submitBtn = document.getElementById('submit-brief-btn');
                if (submitBtn) submitBtn.disabled = true;

                try {
                    if (window.JOM_COMMERCE && typeof JOM_COMMERCE.submitBrief === 'function') {
                        await JOM_COMMERCE.submitBrief({ name, email, briefText, channel });
                    } else {
                        // Fallback legacy path
                        const briefsLog = JSON.parse(localStorage.getItem('jom_contact_briefs') || '[]');
                        briefsLog.push({ name, email, briefText, channel, timestamp: new Date().toLocaleString() });
                        localStorage.setItem('jom_contact_briefs', JSON.stringify(briefsLog));
                        if (channel === 'wa') {
                            const message = `¡Hola JOM STUDIO! 🚀%0A%0AMe gustaría cotizar un proyecto:%0A%0A*Nombre/Empresa:* ${encodeURIComponent(name)}%0A*Email:* ${encodeURIComponent(email)}%0A*Brief:* ${encodeURIComponent(briefText)}`;
                            window.open(`https://wa.me/584165159067?text=${message}`, '_blank');
                        } else {
                            const subject = encodeURIComponent(`Nuevo Proyecto JOM STUDIO - ${name}`);
                            const body = encodeURIComponent(`Hola JOM STUDIO,\n\nMe gustaría cotizar un proyecto:\n\nNombre/Empresa: ${name}\nEmail: ${email}\n\nBrief del Proyecto:\n${briefText}`);
                            window.open(`mailto:jomstudiovzla@gmail.com?subject=${subject}&body=${body}`, '_blank');
                        }
                    }
                } finally {
                    if (submitBtn) submitBtn.disabled = false;
                }
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

        // Analytics & Geolocation Logger
        function initAnalytics() {
            // Views counter
            let totalViews = parseInt(localStorage.getItem('jom_analytics_views') || '0');
            totalViews++;
            localStorage.setItem('jom_analytics_views', totalViews.toString());

            // Geolocation tracking
            fetch('https://ipapi.co/json/')
                .then(res => res.json())
                .then(data => {
                    if (data && data.country_name) {
                        const country = data.country_name;
                        const countries = JSON.parse(localStorage.getItem('jom_analytics_countries') || '{}');
                        countries[country] = (countries[country] || 0) + 1;
                        localStorage.setItem('jom_analytics_countries', JSON.stringify(countries));
                    }
                })
                .catch(() => {
                    // Fallback to offline/unknown local views
                    const country = 'Local Loopback';
                    const countries = JSON.parse(localStorage.getItem('jom_analytics_countries') || '{}');
                    countries[country] = (countries[country] || 0) + 1;
                    localStorage.setItem('jom_analytics_countries', JSON.stringify(countries));
                });
        }
        initAnalytics();

        // Admin Dashboard Console Logic
        window.openAdminModal = function(id) {
            const modal = document.getElementById(id);
            if (modal) {
                modal.classList.remove('hidden');
                modal.classList.add('flex');
                document.body.style.overflow = 'hidden';
            }
        };

        window.closeAdminModal = function(id) {
            const modal = document.getElementById(id);
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                document.body.style.overflow = '';
            }
        };

        window.submitAdminLogin = function() {
            const userId = document.getElementById('admin-id').value.trim();
            const userPass = document.getElementById('admin-pass').value.trim();
            const errorMsg = document.getElementById('admin-error-msg');

            if (userId === 'JOM' && userPass === 'Studio') {
                sessionStorage.setItem('jom_admin_logged', 'true');
                document.getElementById('admin-id').value = '';
                document.getElementById('admin-pass').value = '';
                if (errorMsg) errorMsg.classList.add('hidden');
                
                closeAdminModal('admin-login-modal');
                openAdminDashboard();
            } else {
                if (errorMsg) {
                    errorMsg.classList.remove('hidden');
                    errorMsg.style.color = '#EF4444';
                    setTimeout(() => errorMsg.style.color = '#F87171', 150);
                    setTimeout(() => errorMsg.style.color = '#EF4444', 300);
                }
            }
        };

        window.adminLogout = function() {
            sessionStorage.removeItem('jom_admin_logged');
            closeAdminModal('admin-dashboard-modal');
        };

        window.clearAnalyticsData = function() {
            if (confirm('Are you sure you want to clear all views and briefs log? This action cannot be undone.')) {
                localStorage.setItem('jom_analytics_views', '1');
                localStorage.setItem('jom_analytics_countries', '{}');
                localStorage.setItem('jom_contact_briefs', '[]');
                renderDashboardData();
            }
        };

        window.deleteBrief = function(index) {
            const briefs = JSON.parse(localStorage.getItem('jom_contact_briefs') || '[]');
            briefs.splice(index, 1);
            localStorage.setItem('jom_contact_briefs', JSON.stringify(briefs));
            renderDashboardData();
        };

        function renderDashboardData() {
            const totalViews = localStorage.getItem('jom_analytics_views') || '1';
            const countries = JSON.parse(localStorage.getItem('jom_analytics_countries') || '{}');
            const briefs = JSON.parse(localStorage.getItem('jom_contact_briefs') || '[]');

            // Set Total Views
            document.getElementById('analytics-total-views').textContent = totalViews;

            // Render Countries List
            const countriesList = document.getElementById('analytics-countries-list');
            if (countriesList) {
                const sortedCountries = Object.entries(countries).sort((a, b) => b[1] - a[1]);
                if (sortedCountries.length > 0) {
                    countriesList.innerHTML = sortedCountries.map(([country, count]) => {
                        const percent = Math.round((count / totalViews) * 100);
                        return `
                            <div class="space-y-1">
                                <div class="flex items-center justify-between text-xs font-label-mono text-white">
                                    <span>${country}</span>
                                    <span class="text-primary-fixed">${count} views (${percent}%)</span>
                                </div>
                                <div class="w-full bg-outline-variant/30 h-1 rounded overflow-hidden">
                                    <div class="bg-primary h-full transition-all duration-500" style="width: ${percent}%"></div>
                                </div>
                            </div>
                        `;
                    }).join('');
                } else {
                    countriesList.innerHTML = '<div class="text-on-surface-variant text-sm font-label-mono uppercase">No traffic data logged.</div>';
                }
            }

            // Render Briefs
            const briefsList = document.getElementById('analytics-briefs-list');
            if (briefsList) {
                if (briefs.length > 0) {
                    briefsList.innerHTML = briefs.map((brief, idx) => `
                        <div class="border border-outline-variant/20 p-4 rounded-xl bg-surface-container relative group transition-all hover:border-primary-fixed/50">
                            <button onclick="deleteBrief(${idx})" class="absolute top-4 right-4 text-red-500 hover:text-red-400 font-label-mono text-[10px] uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">Delete</button>
                            <div class="flex justify-between items-center mb-2">
                                <span class="font-headline-md text-sm text-white font-bold">${brief.name}</span>
                                <span class="font-label-mono text-[9px] text-outline uppercase">${brief.timestamp}</span>
                            </div>
                            <div class="text-xs text-on-surface-variant font-label-mono mb-2">Email: <a href="mailto:${brief.email}" class="text-primary-fixed hover:underline">${brief.email}</a> | Protocol: <span class="text-primary-fixed">${brief.channel.toUpperCase()}</span></div>
                            <p class="text-sm text-on-surface-variant font-body-md whitespace-pre-wrap leading-relaxed">${brief.briefText}</p>
                        </div>
                    `).reverse().join('');
                } else {
                    briefsList.innerHTML = '<div class="text-on-surface-variant text-sm font-label-mono uppercase text-center py-12">No client briefs logged.</div>';
                }
            }

            // Render commerce orders (from JOM_CRM)
            const ordersList = document.getElementById('analytics-orders-list');
            if (ordersList) {
                const orders = (window.JOM_CRM && JOM_CRM.listOrders) ? JOM_CRM.listOrders() : JSON.parse(localStorage.getItem('jom_orders_v1') || '[]');
                if (orders.length > 0) {
                    ordersList.innerHTML = orders.slice(0, 12).map((o) => `
                        <div class="border border-outline-variant/20 p-3 rounded-lg bg-surface-container">
                            <div class="flex justify-between gap-2 font-label-mono text-[10px]">
                                <span class="text-primary-fixed">${o.id}</span>
                                <span class="text-secondary uppercase">${o.status}</span>
                            </div>
                            <div class="text-sm text-white mt-1">${o.productName} · <span class="text-primary-fixed">${o.amount} USDT</span></div>
                            <div class="text-xs text-on-surface-variant">${o.name} · ${o.email}</div>
                            ${o.txHash ? `<div class="text-[10px] font-label-mono text-outline truncate mt-1">tx: ${o.txHash}</div>` : ''}
                        </div>
                    `).join('');
                } else {
                    ordersList.innerHTML = '<div class="text-on-surface-variant text-sm font-label-mono uppercase text-center py-6">No orders yet — open admin-ops.html</div>';
                }
            }
        }

        function openAdminDashboard() {
            openAdminModal('admin-dashboard-modal');
            renderDashboardData();
        }

        // Trigger Admin Authentication flow
        const triggerBtn = document.getElementById('admin-trigger');
        if (triggerBtn) {
            triggerBtn.addEventListener('click', () => {
                if (sessionStorage.getItem('jom_admin_logged') === 'true') {
                    openAdminDashboard();
                } else {
                    openAdminModal('admin-login-modal');
                }
            });
        }

        // Deep-linking query parameter check (?admin=true)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('admin') === 'true') {
            window.history.replaceState({}, document.title, window.location.pathname);
            if (sessionStorage.getItem('jom_admin_logged') === 'true') {
                openAdminDashboard();
            } else {
                openAdminModal('admin-login-modal');
            }
        }

// ═══ EVENT DELEGATION (REPLACES INLINE ONCLICK FOR STRICT CSP) ═══
document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.getAttribute('data-action');
    if (action === 'select-service') {
        const idx = parseInt(target.getAttribute('data-index'), 10);
        if (!isNaN(idx) && typeof selectService === 'function') selectService(idx);
    } else if (action === 'delete-brief') {
        const idx = parseInt(target.getAttribute('data-index'), 10);
        if (!isNaN(idx) && typeof deleteBrief === 'function') deleteBrief(idx);
    } else if (action === 'close-modal') {
        const modalId = target.getAttribute('data-modal');
        if (modalId && typeof closeAdminModal === 'function') closeAdminModal(modalId);
    } else if (action === 'submit-admin-login') {
        if (typeof submitAdminLogin === 'function') submitAdminLogin();
    } else if (action === 'clear-analytics') {
        if (typeof clearAnalyticsData === 'function') clearAnalyticsData();
    } else if (action === 'admin-logout') {
        if (typeof adminLogout === 'function') adminLogout();
    }
});

window.selectService = selectService;
window.deleteBrief = deleteBrief;
window.closeAdminModal = closeAdminModal;
window.submitAdminLogin = submitAdminLogin;
window.clearAnalyticsData = clearAnalyticsData;
window.adminLogout = adminLogout;
window.openAdminDashboard = openAdminDashboard;
