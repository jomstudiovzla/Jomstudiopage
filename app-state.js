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
                case_study_desc: "A playable card prototype where water is the asset. The interaction layer is built with WebGL and Canvas. The public case shows the interface and the cards, not an unverified performance score.",
                case_stack_value: "WebGL",
                case_deliverable_value: "Playable",
                nodes_label: "Interaction layer",
                latency_label: "Card prototype",
                case_similar: "I want something similar",
                specs_link: "Explore Technical Specs",
                about_label: "CREATIVE LEADERSHIP",
                about_title: "Jesús Omar Martínez",
                about_desc: "Creative Director & Digital Developer behind JOM STUDIO. Fusing technical excellence (WebGL, Canvas, Chrome Extensions) with artistic direction and business strategy to craft complete, high-performance digital ecosystems.",
                brief_eyebrow: "Interactive Brief",
                brief_title: "Tell us what you want to build",
                brief_subtitle: "The brief is registered before WhatsApp opens. If you choose email, we write back to that address.",
                label_name: "Your Name / Company",
                label_email: "Email Address",
                label_brief: "What do you want to build?",
                label_channel: "Preferred Transmission Protocol",
                channel_wa_desc: "Opens after the brief is registered.",
                channel_mail_desc: "We reply to your email. No mail app needed.",
                btn_transmit: "Transmit Brief",
                form_status_name: "Enter a valid name or company.",
                form_status_email: "Enter a valid email.",
                form_status_brief: "Describe the project in 10 to 3000 characters.",
                form_status_loading: "Transmitting brief…",
                form_status_ok_wa: "Brief received. WhatsApp opens with the message. If it does not, use the link below.",
                form_status_ok_mail: "Brief received. We will reply to your email.",
                form_status_error: "We could not transmit the brief. Try again or write us on WhatsApp.",
                form_wa_fallback: "Write on WhatsApp",
                secure_line: "SECURE CONNECTION · HTTPS ENABLED",
                process_label: "HOW WE WORK",
                process_title: "Four steps, one delivery",
                process_1: "Diagnosis",
                process_1b: "We read the brief and confirm scope.",
                process_2: "Proposal",
                process_2b: "Package, deliverables, revisions and payment.",
                process_3: "Production",
                process_3b: "Build, visual direction and review rounds.",
                process_4: "Delivery",
                process_4b: "Handoff and the support defined in the package.",
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
                case_study_desc: "Prototipo jugable de cartas donde el agua es el activo. La capa de interacción está hecha con WebGL y Canvas. El caso público muestra la interfaz y las cartas, no una cifra de rendimiento sin medición.",
                case_stack_value: "WebGL",
                case_deliverable_value: "Jugable",
                nodes_label: "Capa de interacción",
                latency_label: "Prototipo de cartas",
                case_similar: "Quiero algo similar",
                specs_link: "Explorar Especificaciones",
                about_label: "LIDERAZGO CREATIVO",
                about_title: "Jesús Omar Martínez",
                about_desc: "Director Creativo y Desarrollador Digital detrás de JOM STUDIO. Fusionando la excelencia técnica (WebGL, Canvas, extensiones de Chrome) con la dirección artística y la estrategia de negocios para crear ecosistemas digitales completos y de alto rendimiento.",
                brief_eyebrow: "Brief Interactivo",
                brief_title: "Cuéntanos qué quieres construir",
                brief_subtitle: "El brief queda registrado antes de abrir WhatsApp. Si eliges correo, te escribimos a esa dirección.",
                label_name: "Tu Nombre / Empresa",
                label_email: "Correo de Contacto",
                label_brief: "¿Qué deseas construir?",
                label_channel: "Protocolo de Transmisión Preferido",
                channel_wa_desc: "Se abre después de registrar el brief.",
                channel_mail_desc: "Te respondemos a tu correo. No hace falta abrir una app de email.",
                btn_transmit: "Transmitir Brief",
                form_status_name: "Introduce un nombre o empresa válido.",
                form_status_email: "Introduce un correo válido.",
                form_status_brief: "Describe tu proyecto con entre 10 y 3000 caracteres.",
                form_status_loading: "Transmitiendo brief…",
                form_status_ok_wa: "Brief recibido. Se abre WhatsApp con el mensaje. Si no se abre, usa el enlace de abajo.",
                form_status_ok_mail: "Brief recibido. Te escribimos a tu correo.",
                form_status_error: "No pudimos transmitir el brief. Intenta de nuevo o escríbenos por WhatsApp.",
                form_wa_fallback: "Escribir por WhatsApp",
                secure_line: "CONEXIÓN SEGURA MEDIANTE HTTPS",
                process_label: "CÓMO TRABAJAMOS",
                process_title: "Cuatro pasos, una entrega",
                process_1: "Diagnóstico",
                process_1b: "Leemos el brief y confirmamos el alcance.",
                process_2: "Propuesta",
                process_2b: "Paquete, entregables, revisiones y pago.",
                process_3: "Producción",
                process_3b: "Construcción, dirección visual y rondas de revisión.",
                process_4: "Entrega",
                process_4b: "Handoff y el soporte definido en el paquete.",
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
                case_stack_value: "WebGL",
                case_deliverable_value: "Jouable",
                nodes_label: "Couche d'interaction",
                latency_label: "Prototype de cartes",
                case_similar: "Je veux quelque chose de similaire",
                specs_link: "Spécifications",
                about_label: "LEADERSHIP CRÉATIF",
                about_title: "Jesús Omar Martínez",
                about_desc: "Directeur Créatif & Développeur Digital derrière JOM STUDIO. Fusionner l'excellence technique (WebGL, Canvas, Extensions Chrome) avec la direction artistique et la stratégie commerciale pour créer des écosystèmes numériques complets et performants.",
                brief_eyebrow: "Brief Interactif",
                brief_title: "Dites-nous ce que vous voulez",
                brief_subtitle: "Le brief est enregistré avant d'ouvrir WhatsApp. Par e-mail, nous répondons à cette adresse.",
                label_name: "Votre Nom / Entreprise",
                label_email: "Adresse Email",
                label_brief: "Que voulez-vous construire ?",
                label_channel: "Protocole de Transmission",
                channel_wa_desc: "S'ouvre après l'enregistrement du brief.",
                channel_mail_desc: "Nous répondons à votre e-mail.",
                btn_transmit: "Transmettre le Brief",
                form_status_name: "Indiquez un nom ou une entreprise valide.",
                form_status_email: "Indiquez un e-mail valide.",
                form_status_brief: "Décrivez le projet en 10 à 3000 caractères.",
                form_status_loading: "Transmission du brief…",
                form_status_ok_wa: "Brief reçu. WhatsApp s'ouvre avec le message.",
                form_status_ok_mail: "Brief reçu. Nous répondons à votre e-mail.",
                form_status_error: "Envoi impossible. Réessayez ou écrivez-nous sur WhatsApp.",
                form_wa_fallback: "Écrire sur WhatsApp",
                secure_line: "CONNEXION SÉCURISÉE · HTTPS",
                process_label: "COMMENT NOUS TRAVAILLONS",
                process_title: "Quatre étapes, une livraison",
                process_1: "Diagnostic",
                process_1b: "Nous lisons le brief et confirmons le périmètre.",
                process_2: "Proposition",
                process_2b: "Pack, livrables, révisions et paiement.",
                process_3: "Production",
                process_3b: "Construction, direction visuelle et révisions.",
                process_4: "Livraison",
                process_4b: "Remise et le support défini dans le pack.",
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
                case_stack_value: "WebGL",
                case_deliverable_value: "Jogável",
                nodes_label: "Camada de interação",
                latency_label: "Protótipo de cartas",
                case_similar: "Quero algo parecido",
                specs_link: "Especificações",
                about_label: "LIDERANÇA CRIATIVA",
                about_title: "Jesús Omar Martínez",
                about_desc: "Diretor Criativo e Desenvolvedor Digital por trás do JOM STUDIO. Unindo a excelência técnica (WebGL, Canvas, Extensões Chrome) com direção artística e estratégia de negócios para criar ecossistemas digitais completos de alto desempenho.",
                brief_eyebrow: "Brief Interativo",
                brief_title: "O que você deseja construir",
                brief_subtitle: "O brief fica registrado antes de abrir o WhatsApp. No e-mail, respondemos nesse endereço.",
                label_name: "Seu Nome / Empresa",
                label_email: "Endereço de Email",
                label_brief: "O que construir?",
                label_channel: "Canal de Transmissão",
                channel_wa_desc: "Abre depois que o brief é registrado.",
                channel_mail_desc: "Respondemos no seu e-mail.",
                btn_transmit: "Transmitir Brief",
                form_status_name: "Informe um nome ou empresa válido.",
                form_status_email: "Informe um e-mail válido.",
                form_status_brief: "Descreva o projeto com 10 a 3000 caracteres.",
                form_status_loading: "Transmitindo brief…",
                form_status_ok_wa: "Brief recebido. O WhatsApp abre com a mensagem.",
                form_status_ok_mail: "Brief recebido. Respondemos no seu e-mail.",
                form_status_error: "Não foi possível enviar. Tente de novo ou escreva no WhatsApp.",
                form_wa_fallback: "Escrever no WhatsApp",
                secure_line: "CONEXÃO SEGURA · HTTPS",
                process_label: "COMO TRABALHAMOS",
                process_title: "Quatro passos, uma entrega",
                process_1: "Diagnóstico",
                process_1b: "Lemos o brief e confirmamos o escopo.",
                process_2: "Proposta",
                process_2b: "Pacote, entregáveis, revisões e pagamento.",
                process_3: "Produção",
                process_3b: "Construção, direção visual e rodadas de revisão.",
                process_4: "Entrega",
                process_4b: "Handoff e o suporte definido no pacote.",
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
                    { num: "018", name: "JOM Cemetery Engine", link: "/repository" },
                    { num: "001", name: "Crypto Water War", link: "/repository" },
                    { num: "004", name: "Futstreet", link: "/repository" },
                    { num: "006", name: "Western Poker", link: "/repository" },
                    { num: "012", name: "EduKids Galactic", link: "/repository" }
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
                    { num: "019", name: "Supermarket E-commerce RPA", link: "/repository" },
                    { num: "008", name: "Pino Espace Verts", link: "/repository" },
                    { num: "009", name: "Oliveros Estudio", link: "/repository" },
                    { num: "013", name: "ACACENTRO", link: "/repository" },
                    { num: "015", name: "Inmobiliaria Premium", link: "/repository" }
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
                    { num: "002", name: "Bon Dia", link: "/repository" },
                    { num: "016", name: "Entre Páginas", link: "/repository" }
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
                    { num: "017", name: "Chrome Extensions Suite", link: "/repository" },
                    { num: "019", name: "Supermarket RPA Pipeline", link: "/repository" },
                    { num: "003", name: "Polar Campaign", link: "/repository" },
                    { num: "007", name: "Jabones con Historia", link: "/repository" }
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
                    { num: "014", name: "BEATREGS", link: "/repository" },
                    { num: "016", name: "Entre Páginas", link: "/repository" }
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
                    { num: "005", name: "Pocket AI App", link: "/repository" },
                    { num: "010", name: "Alivia", link: "/repository" },
                    { num: "011", name: "Dawn Dielines", link: "/repository" }
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
                    { num: "001", name: "Crypto Water War", link: "/repository" },
                    { num: "005", name: "Pocket AI App", link: "/repository" },
                    { num: "014", name: "BEATREGS", link: "/repository" }
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
                priceLink.href = `/services#pkg-${buyId}`;
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

        function currentLang() {
            const actual = state.lang === 'auto' ? detectDeviceLang() : state.lang;
            return translations[actual] ? actual : 'en';
        }

        function t(key) {
            const pack = translations[currentLang()] || translations.en;
            return pack[key] || translations.en[key] || '';
        }

        function updateLanguage() {
            let actualLang = currentLang();
            document.documentElement.lang = actualLang;
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
                window.location.href = '/repository';
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

        function prefillService(serviceId, force) {
            const svc = servicesData.find((item) => item.id === serviceId);
            if (!svc) return;
            activeServiceIdx = servicesData.indexOf(svc);
            renderServices();
            const formBrief = document.getElementById('client-brief');
            if (!formBrief || (formBrief.value.trim() && !force)) return;
            const lang = currentLang();
            const title = (svc.title && (svc.title[lang] || svc.title.es || svc.title.en)) || serviceId;
            const templates = {
                es: `¡Hola JOM STUDIO! Quiero algo similar al protocolo "${title}" (${svc.code}).`,
                en: `Hello JOM STUDIO! I want something similar to the "${title}" (${svc.code}) protocol.`,
                fr: `Bonjour JOM STUDIO ! Je veux quelque chose de similaire au protocole « ${title} » (${svc.code}).`,
                pt: `Olá, JOM STUDIO! Quero algo parecido com o protocolo "${title}" (${svc.code}).`
            };
            formBrief.value = templates[lang] || templates.en;
        }

        // Initialize dynamic services view
        renderServices();

        const serviceQuery = new URLSearchParams(window.location.search).get('service');
        if (serviceQuery) {
            prefillService(serviceQuery, false);
            const briefTarget = document.getElementById('brief');
            if (briefTarget) {
                const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                briefTarget.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
            }
        }

        document.querySelectorAll('[data-similar]').forEach((link) => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                prefillService(link.getAttribute('data-similar'), true);
                if (window.JOM_EVENTS) JOM_EVENTS.track('click_similar');
                const briefTarget = document.getElementById('brief');
                if (briefTarget) {
                    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                    briefTarget.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
                }
                const clientName = document.getElementById('client-name');
                if (clientName) clientName.focus();
            });
        });

        function setFormStatus(message, type) {
            const statusMessage = document.getElementById('form-status');
            if (!statusMessage) return;
            statusMessage.textContent = message;
            statusMessage.dataset.status = type || 'info';
            statusMessage.hidden = false;
        }

        // El brief se registra en /api/submit antes de abrir WhatsApp. El canal email no abre mailto.
        const briefForm = document.getElementById('project-brief-form');
        if (briefForm) {
            briefForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('client-name').value.trim();
                const email = document.getElementById('client-email').value.trim();
                const briefText = document.getElementById('client-brief').value.trim();
                const channel = document.querySelector('input[name="comm-channel"]:checked').value;
                const submitBtn = document.getElementById('submit-brief-btn');
                const fallback = document.getElementById('form-wa-fallback');
                const fallbackLink = document.getElementById('form-wa-fallback-link');
                if (fallback) fallback.hidden = true;
                if (submitBtn) submitBtn.disabled = true;
                setFormStatus(t('form_status_loading'), 'loading');

                try {
                    if (!(window.JOM_COMMERCE && typeof JOM_COMMERCE.submitBrief === 'function')) {
                        setFormStatus(t('form_status_error'), 'error');
                        if (window.JOM_EVENTS) JOM_EVENTS.track('form_submit_error');
                        return;
                    }
                    const result = await JOM_COMMERCE.submitBrief({
                        name,
                        email,
                        briefText,
                        channel,
                        page: window.location.href
                    });
                    if (!result || !result.ok) {
                        const key = result && result.error && t('form_status_' + result.error);
                        setFormStatus(key || t('form_status_error'), 'error');
                        if (result && result.fallbackWa && fallbackLink && result.error === 'delivery') {
                            fallbackLink.href = result.fallbackWa;
                            if (fallback) fallback.hidden = false;
                        }
                        if (window.JOM_EVENTS) {
                            JOM_EVENTS.track(result && result.error === 'turnstile' ? 'turnstile_failed' : 'form_submit_error');
                        }
                        return;
                    }
                    if (result.spam) {
                        setFormStatus(t('form_status_ok_mail'), 'success');
                        briefForm.reset();
                        return;
                    }
                    setFormStatus(t(result.channel === 'wa' ? 'form_status_ok_wa' : 'form_status_ok_mail'), 'success');
                    briefForm.reset();
                    const waRadio = document.getElementById('channel-wa');
                    if (waRadio) waRadio.checked = true;
                    if (window.JOM_EVENTS) JOM_EVENTS.track('form_submit_success');
                } catch (_) {
                    setFormStatus(t('form_status_error'), 'error');
                    if (window.JOM_EVENTS) JOM_EVENTS.track('form_submit_error');
                } finally {
                    if (submitBtn) submitBtn.disabled = false;
                }
            });
        }

        // Custom Cursor Logic — se apaga si el sistema pide menos movimiento
        const cursorDot = document.getElementById('custom-cursor-dot');
        const cursorCircle = document.getElementById('custom-cursor-circle');
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion) {
            if (cursorDot) cursorDot.style.display = 'none';
            if (cursorCircle) cursorCircle.style.display = 'none';
        }
        
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
        if (!reduceMotion) requestAnimationFrame(animateCircle);

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
                    ordersList.innerHTML = '<div class="text-on-surface-variant text-sm font-label-mono uppercase text-center py-6">No orders yet — open /admin-ops</div>';
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
