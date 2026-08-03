/**
 * JOM STUDIO — Shared commerce i18n (UI strings + product localization)
 * Language key: localStorage `jom_lang` (en|es|fr|pt|auto) — same as index.html
 */
(function (global) {
  const SUPPORTED = ["en", "es", "fr", "pt"];

  const UI = {
    en: {
      page_title: "PRICING & PACKAGES | JOM STUDIO",
      nav_home: "Home",
      nav_dossier: "Dossier",
      nav_pricing: "Pricing",
      nav_buy: "Buy",
      eyebrow: "PROTOCOL // COMMERCE GRID",
      hero_title: "Packages priced in USDT",
      hero_sub:
        "Fixed rates. Preferred payment: Binance → USDT TRC20. Kickoff within 24h after hash verification.",
      tab_all: "All",
      tab_solo: "By category",
      tab_bundles: "Bundles",
      tab_compare: "Compare",
      section_solo: "By category",
      section_bundles: "Smart bundles (save vs buying separate)",
      section_compare: "Price comparison",
      compare_solo_sum: "If bought separate",
      compare_bundle: "Bundle price",
      compare_save: "You save",
      eta_label: "ETA",
      buy: "Buy",
      quote: "Send brief",
      includes: "Includes",
      from_categories: "Combines",
      how_title: "How payment works",
      how_1: "Pick a package and complete the brief",
      how_2: "Send USDT TRC20 to the wallet",
      how_3: "Paste the Tx Hash (Binance / Tronscan)",
      how_4: "WhatsApp confirmation + kickoff in 24h",
      start_200: "Start at $200 USDT",
      wa_commercial: "Commercial WhatsApp",
      wallet_warn:
        "⚠️ CONFIG: paste your USDT TRC20 wallet in js/config.js → crypto.address before live sales.",
      order_summary: "ORDER SUMMARY",
      order_step1: "01 · CLIENT DATA",
      order_step2: "02 · PAY USDT TRC20",
      order_name: "Name / Company",
      order_email: "Email",
      order_phone: "WhatsApp (optional)",
      order_brief: "Project brief",
      order_create: "Create order & show payment →",
      order_pay_hint: "Send exactly",
      order_network: "on network",
      order_copy: "Copy",
      order_verify: "Verify on-chain payment",
      order_wa: "Send via WhatsApp",
      order_hash: "Transaction Hash (TxID)",
      order_steps:
        "1) Binance → Withdraw → USDT → Network TRC20 / TRON\n2) Paste wallet + exact amount\n3) Copy TxID / Hash\n4) Paste below and verify",
      back_packages: "← Packages",
      cat_gamification: "Interactive Gamification",
      cat_web: "Web & Full-Stack",
      cat_ai: "AI Art & Direction",
      cat_automation: "Automation & Tools",
      cat_ugc: "UGC & Video",
      cat_branding: "Branding & UX/UI",
      cat_photo: "Photo Sessions",
      cat_bundles: "Bundles",
      badge_best: "BEST SELLER",
      badge_fast: "FAST",
      badge_save: "SAVE",
      badge_pro: "PRO",
      badge_quote: "QUOTE",
      badge_entry: "ENTRY",
      badge_premium: "PREMIUM",
      filter_hint: "Filter by type",
      empty: "No packages in this view.",
      success_title: "Order registered",
      success_sub: "Kickoff within 24h after USDT confirmation on Binance / wallet.",
      success_wa: "Confirm on WhatsApp",
      lang: "Language",
    },
    es: {
      page_title: "PRECIOS Y PAQUETES | JOM STUDIO",
      nav_home: "Inicio",
      nav_dossier: "Dossier",
      nav_pricing: "Precios",
      nav_buy: "Comprar",
      eyebrow: "PROTOCOLO // GRILLA COMERCIAL",
      hero_title: "Paquetes con cobro en USDT",
      hero_sub:
        "Precios fijos. Pago prioritario: Binance → USDT TRC20. Kickoff en menos de 24h tras verificar el hash.",
      tab_all: "Todo",
      tab_solo: "Por categoría",
      tab_bundles: "Combos",
      tab_compare: "Comparar",
      section_solo: "Por categoría",
      section_bundles: "Combos inteligentes (ahorro vs por separado)",
      section_compare: "Comparación de precios",
      compare_solo_sum: "Si compras por separado",
      compare_bundle: "Precio del combo",
      compare_save: "Ahorras",
      eta_label: "Plazo",
      buy: "Comprar",
      quote: "Enviar brief",
      includes: "Incluye",
      from_categories: "Une",
      how_title: "Cómo funciona el cobro",
      how_1: "Elige paquete y completa el brief",
      how_2: "Envía USDT TRC20 a la wallet",
      how_3: "Pega el Tx Hash (Binance / Tronscan)",
      how_4: "WhatsApp de confirmación + kickoff 24h",
      start_200: "Empezar por $200 USDT",
      wa_commercial: "WhatsApp comercial",
      wallet_warn:
        "⚠️ CONFIG: pega tu wallet USDT TRC20 en js/config.js → crypto.address antes de cobrar en vivo.",
      order_summary: "RESUMEN DE ORDEN",
      order_step1: "01 · DATOS DEL CLIENTE",
      order_step2: "02 · PAGO USDT TRC20",
      order_name: "Nombre / Empresa",
      order_email: "Email",
      order_phone: "WhatsApp (opcional)",
      order_brief: "Brief del proyecto",
      order_create: "Generar orden y ver pago →",
      order_pay_hint: "Envía exactamente",
      order_network: "por red",
      order_copy: "Copiar",
      order_verify: "Verificar pago on-chain",
      order_wa: "Enviar por WhatsApp",
      order_hash: "Hash de transacción (TxID)",
      order_steps:
        "1) Binance → Retirar → USDT → Red TRC20 / TRON\n2) Pega wallet + monto exacto\n3) Copia el TxID / Hash\n4) Pégalo abajo y verifica",
      back_packages: "← Paquetes",
      cat_gamification: "Gamificación Interactiva",
      cat_web: "Web y Full-Stack",
      cat_ai: "Arte IA y Dirección",
      cat_automation: "Automatización y Tools",
      cat_ugc: "UGC y Video",
      cat_branding: "Branding y UX/UI",
      cat_photo: "Sesiones de Foto",
      cat_bundles: "Combos",
      badge_best: "MÁS VENDIDO",
      badge_fast: "RÁPIDO",
      badge_save: "AHORRO",
      badge_pro: "PRO",
      badge_quote: "COTIZAR",
      badge_entry: "ENTRADA",
      badge_premium: "PREMIUM",
      filter_hint: "Filtrar por tipo",
      empty: "No hay paquetes en esta vista.",
      success_title: "Orden registrada",
      success_sub: "Kickoff en menos de 24h tras confirmar el USDT en Binance / wallet.",
      success_wa: "Confirmar por WhatsApp",
      lang: "Idioma",
    },
    fr: {
      page_title: "TARIFS & PACKS | JOM STUDIO",
      nav_home: "Accueil",
      nav_dossier: "Dossier",
      nav_pricing: "Tarifs",
      nav_buy: "Acheter",
      eyebrow: "PROTOCOLE // GRILLE COMMERCE",
      hero_title: "Packs payés en USDT",
      hero_sub:
        "Tarifs fixes. Paiement prioritaire : Binance → USDT TRC20. Kickoff sous 24h après vérification du hash.",
      tab_all: "Tout",
      tab_solo: "Par catégorie",
      tab_bundles: "Packs",
      tab_compare: "Comparer",
      section_solo: "Par catégorie",
      section_bundles: "Packs intelligents (économie vs à part)",
      section_compare: "Comparaison des prix",
      compare_solo_sum: "Si acheté séparément",
      compare_bundle: "Prix du pack",
      compare_save: "Vous économisez",
      eta_label: "Délai",
      buy: "Acheter",
      quote: "Envoyer un brief",
      includes: "Inclus",
      from_categories: "Combine",
      how_title: "Comment payer",
      how_1: "Choisissez un pack et remplissez le brief",
      how_2: "Envoyez USDT TRC20 au wallet",
      how_3: "Collez le Tx Hash (Binance / Tronscan)",
      how_4: "WhatsApp de confirmation + kickoff 24h",
      start_200: "Commencer à 200 USDT",
      wa_commercial: "WhatsApp commercial",
      wallet_warn:
        "⚠️ CONFIG : collez votre wallet USDT TRC20 dans js/config.js → crypto.address avant les ventes.",
      order_summary: "RÉSUMÉ DE COMMANDE",
      order_step1: "01 · DONNÉES CLIENT",
      order_step2: "02 · PAIEMENT USDT TRC20",
      order_name: "Nom / Entreprise",
      order_email: "Email",
      order_phone: "WhatsApp (optionnel)",
      order_brief: "Brief du projet",
      order_create: "Créer la commande et payer →",
      order_pay_hint: "Envoyez exactement",
      order_network: "sur le réseau",
      order_copy: "Copier",
      order_verify: "Vérifier le paiement on-chain",
      order_wa: "Envoyer via WhatsApp",
      order_hash: "Hash de transaction (TxID)",
      order_steps:
        "1) Binance → Retrait → USDT → Réseau TRC20 / TRON\n2) Collez wallet + montant exact\n3) Copiez le TxID / Hash\n4) Collez ci-dessous et vérifiez",
      back_packages: "← Packs",
      cat_gamification: "Gamification Interactive",
      cat_web: "Web & Full-Stack",
      cat_ai: "Art IA & Direction",
      cat_automation: "Automatisation & Outils",
      cat_ugc: "UGC & Vidéo",
      cat_branding: "Branding & UX/UI",
      cat_photo: "Séances Photo",
      cat_bundles: "Packs",
      badge_best: "BEST-SELLER",
      badge_fast: "RAPIDE",
      badge_save: "ÉCONOMIE",
      badge_pro: "PRO",
      badge_quote: "DEVIS",
      badge_entry: "ENTRÉE",
      badge_premium: "PREMIUM",
      filter_hint: "Filtrer par type",
      empty: "Aucun pack dans cette vue.",
      success_title: "Commande enregistrée",
      success_sub: "Kickoff sous 24h après confirmation USDT sur Binance / wallet.",
      success_wa: "Confirmer sur WhatsApp",
      lang: "Langue",
    },
    pt: {
      page_title: "PREÇOS E PACOTES | JOM STUDIO",
      nav_home: "Início",
      nav_dossier: "Dossiê",
      nav_pricing: "Preços",
      nav_buy: "Comprar",
      eyebrow: "PROTOCOLO // GRADE COMERCIAL",
      hero_title: "Pacotes com cobrança em USDT",
      hero_sub:
        "Preços fixos. Pagamento prioritário: Binance → USDT TRC20. Kickoff em menos de 24h após verificar o hash.",
      tab_all: "Tudo",
      tab_solo: "Por categoria",
      tab_bundles: "Combos",
      tab_compare: "Comparar",
      section_solo: "Por categoria",
      section_bundles: "Combos inteligentes (economia vs separado)",
      section_compare: "Comparação de preços",
      compare_solo_sum: "Se comprar separado",
      compare_bundle: "Preço do combo",
      compare_save: "Você economiza",
      eta_label: "Prazo",
      buy: "Comprar",
      quote: "Enviar brief",
      includes: "Inclui",
      from_categories: "Une",
      how_title: "Como funciona o pagamento",
      how_1: "Escolha o pacote e complete o brief",
      how_2: "Envie USDT TRC20 para a wallet",
      how_3: "Cole o Tx Hash (Binance / Tronscan)",
      how_4: "WhatsApp de confirmação + kickoff 24h",
      start_200: "Começar por $200 USDT",
      wa_commercial: "WhatsApp comercial",
      wallet_warn:
        "⚠️ CONFIG: cole sua wallet USDT TRC20 em js/config.js → crypto.address antes de cobrar ao vivo.",
      order_summary: "RESUMO DO PEDIDO",
      order_step1: "01 · DADOS DO CLIENTE",
      order_step2: "02 · PAGAMENTO USDT TRC20",
      order_name: "Nome / Empresa",
      order_email: "Email",
      order_phone: "WhatsApp (opcional)",
      order_brief: "Brief do projeto",
      order_create: "Gerar pedido e ver pagamento →",
      order_pay_hint: "Envie exatamente",
      order_network: "na rede",
      order_copy: "Copiar",
      order_verify: "Verificar pagamento on-chain",
      order_wa: "Enviar por WhatsApp",
      order_hash: "Hash da transação (TxID)",
      order_steps:
        "1) Binance → Sacar → USDT → Rede TRC20 / TRON\n2) Cole wallet + valor exato\n3) Copie o TxID / Hash\n4) Cole abaixo e verifique",
      back_packages: "← Pacotes",
      cat_gamification: "Gamificação Interativa",
      cat_web: "Web e Full-Stack",
      cat_ai: "Arte IA e Direção",
      cat_automation: "Automação e Tools",
      cat_ugc: "UGC e Vídeo",
      cat_branding: "Branding e UX/UI",
      cat_photo: "Sessões de Foto",
      cat_bundles: "Combos",
      badge_best: "MAIS VENDIDO",
      badge_fast: "RÁPIDO",
      badge_save: "ECONOMIA",
      badge_pro: "PRO",
      badge_quote: "ORÇAR",
      badge_entry: "ENTRADA",
      badge_premium: "PREMIUM",
      filter_hint: "Filtrar por tipo",
      empty: "Nenhum pacote nesta visão.",
      success_title: "Pedido registrado",
      success_sub: "Kickoff em menos de 24h após confirmar o USDT na Binance / wallet.",
      success_wa: "Confirmar no WhatsApp",
      lang: "Idioma",
    },
  };

  function detectDeviceLang() {
    const nav = (typeof navigator !== "undefined" && (navigator.language || navigator.userLanguage)) || "en";
    const code = String(nav).slice(0, 2).toLowerCase();
    return SUPPORTED.includes(code) ? code : "en";
  }

  function getStoredLangMode() {
    try {
      return localStorage.getItem("jom_lang") || "auto";
    } catch {
      return "auto";
    }
  }

  function setStoredLangMode(mode) {
    try {
      localStorage.setItem("jom_lang", mode);
    } catch (_) {}
    try {
      global.dispatchEvent(new CustomEvent("jom:lang", { detail: { mode, lang: resolveLang(mode) } }));
    } catch (_) {}
  }

  function resolveLang(mode) {
    const m = mode != null ? mode : getStoredLangMode();
    if (m === "auto") return detectDeviceLang();
    return SUPPORTED.includes(m) ? m : "en";
  }

  function t(key, lang) {
    const L = resolveLang(lang);
    return (UI[L] && UI[L][key]) || (UI.en && UI.en[key]) || key;
  }

  function pickI18n(obj, lang) {
    if (!obj) return {};
    if (typeof obj === "string") return obj;
    const L = resolveLang(lang);
    return obj[L] || obj.en || obj.es || Object.values(obj)[0] || {};
  }

  /**
   * Normalize product: supports legacy flat fields OR i18n map.
   */
  function localizeProduct(raw, lang) {
    if (!raw) return null;
    const L = resolveLang(lang);
    const block = raw.i18n ? pickI18n(raw.i18n, L) : null;
    const name = (block && block.name) || raw.name || raw.id;
    const badgeKey = raw.badgeKey;
    const badge =
      (block && block.badge) ||
      raw.badge ||
      (badgeKey ? t(badgeKey, L) : "");
    return {
      ...raw,
      lang: L,
      name,
      badge,
      headline: (block && block.headline) || raw.headline || "",
      description: (block && block.description) || raw.description || "",
      eta: (block && block.eta) || raw.eta || "",
      deliverables: (block && block.deliverables) || raw.deliverables || [],
      notIncluded: (block && block.notIncluded) || raw.notIncluded || [],
      combinesLabel: (block && block.combines) || raw.combines || [],
    };
  }

  function categoryLabel(catId, lang) {
    const map = {
      gamification: "cat_gamification",
      web: "cat_web",
      ai: "cat_ai",
      automation: "cat_automation",
      ugc: "cat_ugc",
      branding: "cat_branding",
      photo: "cat_photo",
      bundles: "cat_bundles",
    };
    return t(map[catId] || catId, lang);
  }

  global.JOM_I18N = {
    SUPPORTED,
    UI,
    detectDeviceLang,
    getStoredLangMode,
    setStoredLangMode,
    resolveLang,
    t,
    pickI18n,
    localizeProduct,
    categoryLabel,
  };
})(typeof window !== "undefined" ? window : globalThis);
