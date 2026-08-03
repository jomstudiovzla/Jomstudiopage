/**
 * JOM STUDIO — Commerce & Ops Config (single source of truth)
 * Edit ONLY this file before deploy. Everything else reads from window.JOM_CONFIG.
 */
(function (global) {
  const CONFIG = {
    brand: {
      name: "JOM STUDIO",
      tagline: "DIGITAL ALCHEMY",
      siteUrl: "https://jomstudiovzla.github.io/Jomstudiopage",
      timezone: "America/Caracas",
    },

    contact: {
      whatsapp: "584165159067", // digits only, no +
      email: "jomstudiovzla@gmail.com",
      // Optional: Formspree endpoint after free signup → https://formspree.io
      // Leave empty to rely on WhatsApp + local CRM only.
      formspreeEndpoint: "",
      // Optional: Telegram bot notify (set via Cloudflare Worker / Make.com webhook)
      notifyWebhook: "",
    },

    /**
     * TRC20 USDT wallet (Binance withdraw to this address OR your TRON wallet).
     * CRITICAL: replace before first real sale.
     * Format: starts with T, 34 chars.
     */
    crypto: {
      network: "TRC20",
      asset: "USDT",
      // Binance / TRON USDT TRC20 deposit address (operator-provided)
      address: "TLnHhj8595k5Fg1jFvgB7Med7iCbGdmTMN",
      usdtContract: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      // TronGrid public API (no key needed for light traffic; optional key for higher limits)
      trongridBase: "https://api.trongrid.io",
      trongridApiKey: "",
      // Accept amounts within this tolerance (network fees / rounding)
      amountToleranceUsdt: 0.5,
      // How far back to scan for matching txs (hours)
      lookbackHours: 72,
      minConfirmations: 1,
    },

    products: {
      spark: {
        id: "spark",
        sku: "JOM-SPARK-200",
        name: "Micro Alchemy Spark",
        priceUsdt: 200,
        currency: "USDT",
        network: "TRC20",
        eta: "3–5 business days",
        badge: "FAST CASH",
        headline: "Landing de conversión + animaciones premium",
        description:
          "Una landing de una página con copy de venta, secciones de prueba social, CTA WhatsApp y animaciones GSAP. Lista para captar leads y cobrar.",
        deliverables: [
          "1 landing page responsive (HTML/CSS/JS)",
          "Hero + oferta + prueba + CTA",
          "Animaciones GSAP (entrada + scroll)",
          "Botón WhatsApp con mensaje prearmado",
          "Deploy en GitHub Pages o entrega ZIP",
          "1 ronda de revisiones",
        ],
        notIncluded: ["Dominio pago", "Copywriting de 10+ páginas", "Backend/CMS"],
      },
      launch: {
        id: "launch",
        sku: "JOM-LAUNCH-300",
        name: "Digital Alchemy Launch Kit",
        priceUsdt: 300,
        currency: "USDT",
        network: "TRC20",
        eta: "5–7 business days",
        badge: "BEST SELLER",
        headline: "Web interactiva 3D + cursor custom + GSAP",
        description:
          "Transforma tu web en una experiencia inmersiva: escena Three.js/WebGL ligera, cursor custom, animaciones GSAP y estética studio-grade.",
        deliverables: [
          "Integración Three.js o Canvas interactivo en hero",
          "Custom cursor desktop + fallback mobile",
          "Timeline GSAP (hero + secciones clave)",
          "UI dark premium alineada a tu marca",
          "Optimización performance (lazy assets)",
          "Deploy o entrega ZIP + README",
          "2 rondas de revisiones",
        ],
        notIncluded: ["E-commerce completo", "App móvil nativa", "SEO de 3 meses"],
      },
      engine: {
        id: "engine",
        sku: "JOM-ENGINE-600",
        name: "Interactive Engine Build",
        priceUsdt: 600,
        currency: "USDT",
        network: "TRC20",
        eta: "10–14 business days",
        badge: "HIGH TICKET",
        headline: "Mini-juego o motor interactivo a medida",
        description:
          "Sistema interactivo tipo portfolio de JOM (Canvas/WebGL/Unity WebGL): mecánicas, UI, y deploy web. Ideal para marcas que quieren retención real.",
        deliverables: [
          "Scope + GDD corto (1 página)",
          "Prototipo jugable web",
          "UI/UX del motor + feedback visual",
          "Build deployable (GitHub Pages / hosting)",
          "Documento de handoff técnico",
          "2 rondas de revisiones",
        ],
        notIncluded: ["Blockchain mainnet production", "Marketing ads budget", "Soporte 24/7 ilimitado"],
      },
      custom: {
        id: "custom",
        sku: "JOM-CUSTOM-QUOTE",
        name: "Strategic Custom Build",
        priceUsdt: 0,
        currency: "USDT",
        network: "TRC20",
        eta: "Según alcance",
        badge: "QUOTE",
        headline: "Proyecto a medida (full-stack, RPA, brand, UGC)",
        description:
          "Brief personalizado. Cotización en 24h vía WhatsApp tras recibir alcance, referencias y deadline.",
        deliverables: ["Discovery call / brief", "Propuesta con hitos y precio USDT", "Kickoff en 48h post-pago"],
        notIncluded: [],
      },
    },

    // Default product for direct /order.html links
    defaultProductId: "launch",

    admin: {
      // Same password pattern as existing command center if you sync it
      // Hashed lightly client-side is NOT security — this is friction only.
      // Change after first deploy.
      password: "jom2026",
      storageKeys: {
        orders: "jom_orders_v1",
        briefs: "jom_contact_briefs",
        events: "jom_ops_events_v1",
      },
    },

    messages: {
      orderWaTemplate: function (order) {
        return (
          `🚀 *NUEVO PEDIDO JOM STUDIO*%0A` +
          `────────────────%0A` +
          `*Orden:* ${order.id}%0A` +
          `*Producto:* ${order.productName}%0A` +
          `*Monto:* ${order.amount} USDT (${order.network})%0A` +
          `*Cliente:* ${encodeURIComponent(order.name)}%0A` +
          `*Email:* ${encodeURIComponent(order.email)}%0A` +
          `*Brief:* ${encodeURIComponent(order.brief || "—")}%0A` +
          `*Tx Hash:* ${order.txHash || "pendiente"}%0A` +
          `*Estado:* ${order.status}%0A` +
          `*Fecha:* ${encodeURIComponent(order.createdAt)}`
        );
      },
      clientPaidWa: function (order) {
        return (
          `Hola JOM STUDIO 👋%0A` +
          `Acabo de pagar el *${encodeURIComponent(order.productName)}* (%20${order.amount}%20USDT%20TRC20).%0A` +
          `Orden:%20${order.id}%0A` +
          `Hash:%20${order.txHash || "adjunto captura"}%0A` +
          `Email:%20${encodeURIComponent(order.email)}%0A` +
          `Listo para kickoff.`
        );
      },
    },
  };

  global.JOM_CONFIG = CONFIG;
})(typeof window !== "undefined" ? window : globalThis);
