/**
 * JOM STUDIO — Work policies (revisions, timelines, abandonment, restarts)
 * Rendered by policies.html; summary used on order/services.
 * Language via JOM_I18N / jom_lang
 */
(function (global) {
  const POLICIES = {
    version: "2026.08",
    effectiveFrom: "2026-08-01",

    /**
     * Default revision map by price band (overridden by product deliverables when stricter).
     */
    revisionBands: [
      { maxPrice: 250, rounds: 1 },
      { maxPrice: 500, rounds: 2 },
      { maxPrice: 9999, rounds: 2 },
    ],
    extraRevisionUsdt: 40,

    /** Business rules (numbers used in copy) */
    rules: {
      kickoffHoursAfterPayment: 24,
      clientFeedbackBusinessDays: 5,
      silenceApprovalBusinessDays: 7,
      idlePauseCalendarDays: 14,
      idleCloseCalendarDays: 30,
      freeBugfixCalendarDays: 14,
      sameScopeRestartWindowDays: 60,
      sameScopeRestartPercent: 50, // of package price if reopened within window after close
      preKickoffRefundPercent: 50,
      postKickoffRefundPercent: 0,
    },

    i18n: {
      en: {
        page_title: "WORK POLICIES | JOM STUDIO",
        nav_policies: "Policies",
        hero_title: "Work policies",
        hero_sub:
          "Clear rules for revisions, delivery times, pauses, restarts and refunds. By paying any package you accept these policies (v" +
          "2026.08).",
        updated: "Version",
        s1_title: "1. Revisions (modifications)",
        s1_body: [
          "A revision round = one consolidated batch of feedback on the current deliverable (not unlimited back-and-forth messages).",
          "Entry packages (≈ up to 250 USDT): 1 revision round included.",
          "Standard / Pro / Bundles (above 250 USDT): 2 revision rounds included, unless the package card says otherwise.",
          "Extra revision round: 40 USDT each (same scope). Paid before work continues.",
          "What counts as a revision: color/layout tweaks, copy fixes, minor section changes, asset swaps you provide.",
          "What is NOT a revision (new scope / new quote): new pages, new features, new brand system, new game mechanics, full redesign, or changing the brief after kickoff.",
        ],
        s2_title: "2. Timeline & client response",
        s2_body: [
          "Kickoff: within 24 hours after USDT payment is verified (hash confirmed).",
          "Estimated delivery (ETA) is on each package card and starts on kickoff day, not on payment day if assets are missing.",
          "You have 5 business days to send feedback after each draft delivery.",
          "If there is no feedback for 7 business days after we request review, that phase is considered approved and we move forward or close delivery.",
          "Business days = Mon–Fri, America/Caracas (GMT-4), excluding public holidays we announce.",
        ],
        s3_title: "3. Pause, abandonment & restart from zero",
        s3_body: [
          "Idle pause: if we receive no client response for 14 calendar days, the project is paused. ETA freezes.",
          "Idle close: if silence continues to 30 calendar days total without response, the project is closed as delivered/abandoned for ops purposes.",
          "Restart after close (same scope, within 60 days): 50% of the original package price to reopen the same brief/files.",
          "Restart after 60 days, or with a changed brief: treated as a new project (100% of current package price).",
          "If the client changes core goals mid-project (new product, new brand, new game type), we issue a new quote; previous work remains paid.",
        ],
        s4_title: "4. Delivery, bugs & support",
        s4_body: [
          "Delivery = share of final files, deploy link, or handoff ZIP + confirmation message on WhatsApp/email.",
          "True bugs (broken layout, dead links, feature we promised that fails): free fix within 14 calendar days after delivery.",
          "After 14 days, maintenance is billed (minimum 40 USDT or custom quote).",
          "Hosting, domains, third-party APIs, Binance, or client server outages are outside JOM STUDIO responsibility.",
        ],
        s5_title: "5. Client materials",
        s5_body: [
          "You must provide logos, texts, photos, access and references within 3 calendar days of kickoff.",
          "Missing materials pause the ETA until they arrive (pause does not consume idle-close timer for the first 7 days of waiting materials).",
          "Stock/AI assets we generate for the project are licensed for your commercial use on the delivered product; reselling raw packs as your own product requires written OK.",
        ],
        s6_title: "6. Payments & refunds (USDT TRC20)",
        s6_body: [
          "Payment is in USDT on TRC20 to the published wallet. Work starts only after verification.",
          "Cancel before kickoff (no production started): 50% refund of the package (network fees non-refundable).",
          "After kickoff or first draft: no refund. You keep delivered files to date.",
          "Wrong network / wrong asset / underpayment: client is responsible; we can wait for correct transfer before kickoff.",
        ],
        s7_title: "7. Communication",
        s7_body: [
          "Primary channel: WhatsApp commercial number on the site. Secondary: email jomstudiovzla@gmail.com.",
          "Decisions in writing (chat/email) override verbal notes.",
          "Abuse, spam or illegal use requests: we may cancel remaining work without refund of completed phases.",
        ],
        summary_title: "Quick summary",
        summary_items: [
          "Revisions: 1 (entry) or 2 (standard+) · extra round 40 USDT",
          "Feedback window: 5 business days · silence 7 days = approved",
          "Idle 14 days = pause · 30 days = close",
          "Reopen same scope ≤60 days: 50% · later or new brief: 100%",
          "Bugfix: 14 days free · Refund only 50% pre-kickoff",
        ],
        accept_note: "Paying a package on this site constitutes acceptance of these policies.",
        back_pricing: "← Back to pricing",
        cta_buy: "View packages",
      },
      es: {
        page_title: "POLÍTICAS DE TRABAJO | JOM STUDIO",
        nav_policies: "Políticas",
        hero_title: "Políticas de trabajo",
        hero_sub:
          "Reglas claras de revisiones, plazos, pausas, reinicios y reembolsos. Al pagar cualquier paquete aceptas estas políticas (v2026.08).",
        updated: "Versión",
        s1_title: "1. Revisiones (modificaciones)",
        s1_body: [
          "Una ronda de revisión = un lote consolidado de feedback sobre el entregable actual (no es chat ilimitado ida y vuelta).",
          "Paquetes de entrada (≈ hasta 250 USDT): 1 ronda de revisión incluida.",
          "Estándar / Pro / Combos (más de 250 USDT): 2 rondas incluidas, salvo que la ficha del paquete diga otra cosa.",
          "Ronda extra: 40 USDT c/u (mismo alcance). Se paga antes de continuar.",
          "Qué sí es revisión: ajustes de color/layout, textos, cambios menores de sección, reemplazo de assets que tú entregas.",
          "Qué NO es revisión (nuevo alcance / nueva cotización): páginas nuevas, features nuevas, identidad nueva, mecánicas de juego nuevas, rediseño total o cambiar el brief después del kickoff.",
        ],
        s2_title: "2. Plazos y respuesta del cliente",
        s2_body: [
          "Kickoff: en menos de 24 h tras verificar el pago USDT (hash confirmado).",
          "El ETA del paquete corre desde el día de kickoff, no desde el pago si faltan materiales.",
          "Tienes 5 días hábiles para enviar feedback después de cada entrega de borrador.",
          "Si no hay feedback en 7 días hábiles desde que pedimos revisión, esa fase se considera aprobada y avanzamos o cerramos entrega.",
          "Días hábiles = lun–vie, America/Caracas (GMT-4), salvo feriados que anunciemos.",
        ],
        s3_title: "3. Pausa, abandono y reinicio desde cero",
        s3_body: [
          "Pausa por inactividad: si no hay respuesta del cliente durante 14 días calendario, el proyecto se pausa. El ETA se congela.",
          "Cierre por inactividad: si el silencio llega a 30 días calendario sin respuesta, el proyecto se cierra (entregado/abandonado a efectos operativos).",
          "Reabrir tras cierre (mismo alcance, dentro de 60 días): 50% del precio original del paquete para reabrir el mismo brief/archivos.",
          "Reabrir después de 60 días, o con brief cambiado: se trata como proyecto nuevo (100% del precio actual del paquete).",
          "Si cambian objetivos centrales a mitad de camino (nuevo producto, nueva marca, nuevo tipo de juego), emitimos cotización nueva; el trabajo ya hecho permanece pagado.",
        ],
        s4_title: "4. Entrega, bugs y soporte",
        s4_body: [
          "Entrega = envío de archivos finales, link de deploy o ZIP de handoff + confirmación por WhatsApp/email.",
          "Bugs reales (layout roto, links muertos, feature prometida que falla): corrección gratis dentro de 14 días calendario post-entrega.",
          "Después de 14 días, el mantenimiento se cotiza (mínimo 40 USDT o quote custom).",
          "Hosting, dominios, APIs de terceros, Binance o caídas del servidor del cliente no son responsabilidad de JOM STUDIO.",
        ],
        s5_title: "5. Materiales del cliente",
        s5_body: [
          "Debes entregar logos, textos, fotos, accesos y referencias en máximo 3 días calendario desde el kickoff.",
          "Sin materiales se pausa el ETA hasta que lleguen (los primeros 7 días esperando materiales no cuentan para el cierre por idle de 30 días).",
          "Assets stock/IA que generamos para el proyecto: licencia de uso comercial en el entregable; revender packs crudos como producto propio requiere OK por escrito.",
        ],
        s6_title: "6. Pagos y reembolsos (USDT TRC20)",
        s6_body: [
          "Pago en USDT red TRC20 a la wallet publicada. El trabajo inicia solo tras verificación.",
          "Cancelación antes del kickoff (sin producción iniciada): reembolso 50% del paquete (fees de red no reembolsables).",
          "Después del kickoff o del primer borrador: sin reembolso. Conservas lo ya entregado.",
          "Red incorrecta / asset incorrecto / pago incompleto: responsabilidad del cliente; esperamos la transferencia correcta antes del kickoff.",
        ],
        s7_title: "7. Comunicación",
        s7_body: [
          "Canal principal: WhatsApp comercial del sitio. Secundario: jomstudiovzla@gmail.com.",
          "Lo escrito en chat/email prevalece sobre lo verbal.",
          "Abuso, spam o pedidos de uso ilegal: podemos cancelar el resto del trabajo sin reembolso de fases ya completadas.",
        ],
        summary_title: "Resumen rápido",
        summary_items: [
          "Revisiones: 1 (entrada) o 2 (estándar+) · extra 40 USDT",
          "Feedback: 5 días hábiles · silencio 7 días = aprobado",
          "Idle 14 días = pausa · 30 días = cierre",
          "Reabrir mismo alcance ≤60 días: 50% · después o brief nuevo: 100%",
          "Bugs: 14 días gratis · Reembolso solo 50% pre-kickoff",
        ],
        accept_note: "Pagar un paquete en este sitio implica aceptar estas políticas.",
        back_pricing: "← Volver a precios",
        cta_buy: "Ver paquetes",
      },
      fr: {
        page_title: "POLITIQUES DE TRAVAIL | JOM STUDIO",
        nav_policies: "Politiques",
        hero_title: "Politiques de travail",
        hero_sub:
          "Règles claires : révisions, délais, pauses, reprises et remboursements. En payant un pack vous acceptez ces politiques (v2026.08).",
        updated: "Version",
        s1_title: "1. Révisions (modifications)",
        s1_body: [
          "Une ronde de révision = un lot consolidé de feedback sur le livrable actuel (pas un chat illimité).",
          "Packs d'entrée (≈ jusqu'à 250 USDT) : 1 ronde incluse.",
          "Standard / Pro / Bundles (> 250 USDT) : 2 rondes incluses, sauf mention contraire.",
          "Ronde extra : 40 USDT chacune (même scope). Payée avant de continuer.",
          "Révision : couleurs/layout, textes, petits changements, swap d'assets fournis.",
          "Hors révision (nouveau devis) : nouvelles pages, features, identité, mécaniques de jeu, redesign total, brief changé après kickoff.",
        ],
        s2_title: "2. Délais & réponse client",
        s2_body: [
          "Kickoff : sous 24 h après vérification USDT.",
          "L'ETA court à partir du kickoff si les assets sont prêts.",
          "5 jours ouvrés pour le feedback après chaque brouillon.",
          "Sans feedback pendant 7 jours ouvrés après demande de review : phase approuvée.",
          "Jours ouvrés = lun–ven, America/Caracas (GMT-4).",
        ],
        s3_title: "3. Pause, abandon & reprise à zéro",
        s3_body: [
          "Pause : 14 jours calendaires sans réponse client.",
          "Clôture : 30 jours calendaires de silence au total.",
          "Reprise même scope ≤ 60 jours : 50% du prix du pack.",
          "Après 60 jours ou brief modifié : nouveau projet à 100%.",
          "Changement d'objectifs majeurs = nouveau devis ; travail déjà fait reste dû.",
        ],
        s4_title: "4. Livraison, bugs & support",
        s4_body: [
          "Livraison = fichiers finaux, lien deploy ou ZIP + message de confirmation.",
          "Bugs réels : correction gratuite 14 jours après livraison.",
          "Après 14 jours : maintenance facturée (min. 40 USDT).",
          "Hébergement, domaines, APIs tierces, Binance hors responsabilité JOM STUDIO.",
        ],
        s5_title: "5. Matériels client",
        s5_body: [
          "Logos, textes, photos, accès sous 3 jours calendaires après kickoff.",
          "Sans matériels, l'ETA est en pause.",
          "Assets IA/stock : usage commercial sur le livrable ; revente de packs bruts = OK écrit requis.",
        ],
        s6_title: "6. Paiements & remboursements (USDT TRC20)",
        s6_body: [
          "Paiement USDT TRC20. Travail après vérification uniquement.",
          "Annulation avant kickoff : remboursement 50% (frais réseau exclus).",
          "Après kickoff / premier draft : pas de remboursement.",
          "Mauvais réseau / asset / montant : responsabilité client.",
        ],
        s7_title: "7. Communication",
        s7_body: [
          "Canal principal : WhatsApp du site. Secondaire : jomstudiovzla@gmail.com.",
          "L'écrit prime sur l'oral.",
          "Abus ou demandes illégales : arrêt possible sans remboursement des phases terminées.",
        ],
        summary_title: "Résumé",
        summary_items: [
          "Révisions : 1 (entrée) ou 2 (standard+) · extra 40 USDT",
          "Feedback 5 j. · silence 7 j. = approuvé",
          "Idle 14 j. = pause · 30 j. = clôture",
          "Reprise ≤60 j. : 50% · sinon 100%",
          "Bugs 14 j. gratuits · Remboursement 50% pré-kickoff seulement",
        ],
        accept_note: "Payer un pack sur ce site vaut acceptation de ces politiques.",
        back_pricing: "← Retour tarifs",
        cta_buy: "Voir les packs",
      },
      pt: {
        page_title: "POLÍTICAS DE TRABALHO | JOM STUDIO",
        nav_policies: "Políticas",
        hero_title: "Políticas de trabalho",
        hero_sub:
          "Regras claras de revisões, prazos, pausas, reinícios e reembolsos. Ao pagar qualquer pacote você aceita estas políticas (v2026.08).",
        updated: "Versão",
        s1_title: "1. Revisões (modificações)",
        s1_body: [
          "Uma rodada de revisão = um lote consolidado de feedback sobre o entregável atual (não é chat ilimitado).",
          "Pacotes de entrada (≈ até 250 USDT): 1 rodada incluída.",
          "Padrão / Pro / Combos (acima de 250 USDT): 2 rodadas, salvo indicação na ficha.",
          "Rodada extra: 40 USDT cada (mesmo escopo). Paga antes de continuar.",
          "É revisão: cor/layout, textos, ajustes menores, troca de assets que você envia.",
          "Não é revisão (novo orçamento): páginas novas, features, identidade nova, mecânicas de jogo, redesign total ou mudar o brief após o kickoff.",
        ],
        s2_title: "2. Prazos e resposta do cliente",
        s2_body: [
          "Kickoff: em até 24 h após verificar o USDT.",
          "O ETA corre a partir do kickoff se os materiais estiverem ok.",
          "5 dias úteis para feedback após cada rascunho.",
          "Sem feedback por 7 dias úteis após pedido de review: fase aprovada.",
          "Dias úteis = seg–sex, America/Caracas (GMT-4).",
        ],
        s3_title: "3. Pausa, abandono e reinício do zero",
        s3_body: [
          "Pausa: 14 dias corridos sem resposta do cliente.",
          "Encerramento: 30 dias corridos de silêncio no total.",
          "Reabrir mesmo escopo ≤ 60 dias: 50% do preço do pacote.",
          "Após 60 dias ou brief alterado: projeto novo a 100%.",
          "Mudança de objetivos centrais = novo orçamento; trabalho já feito permanece pago.",
        ],
        s4_title: "4. Entrega, bugs e suporte",
        s4_body: [
          "Entrega = arquivos finais, link de deploy ou ZIP + confirmação.",
          "Bugs reais: correção grátis em 14 dias corridos após entrega.",
          "Depois de 14 dias: manutenção cobrada (mín. 40 USDT).",
          "Hosting, domínios, APIs de terceiros, Binance fora da responsabilidade da JOM STUDIO.",
        ],
        s5_title: "5. Materiais do cliente",
        s5_body: [
          "Logos, textos, fotos e acessos em até 3 dias corridos após o kickoff.",
          "Sem materiais, o ETA pausa.",
          "Assets IA/stock: uso comercial no entregável; revender packs brutos exige OK por escrito.",
        ],
        s6_title: "6. Pagamentos e reembolsos (USDT TRC20)",
        s6_body: [
          "Pagamento em USDT TRC20. Trabalho só após verificação.",
          "Cancelamento antes do kickoff: reembolso 50% (taxas de rede excluídas).",
          "Após kickoff ou primeiro draft: sem reembolso.",
          "Rede/asset/valor errado: responsabilidade do cliente.",
        ],
        s7_title: "7. Comunicação",
        s7_body: [
          "Canal principal: WhatsApp do site. Secundário: jomstudiovzla@gmail.com.",
          "O escrito prevalece sobre o verbal.",
          "Abuso ou pedidos ilegais: podemos parar o restante sem reembolso das fases concluídas.",
        ],
        summary_title: "Resumo rápido",
        summary_items: [
          "Revisões: 1 (entrada) ou 2 (padrão+) · extra 40 USDT",
          "Feedback 5 dias · silêncio 7 dias = aprovado",
          "Idle 14 dias = pausa · 30 dias = fechamento",
          "Reabrir ≤60 dias: 50% · depois: 100%",
          "Bugs 14 dias grátis · Reembolso só 50% pré-kickoff",
        ],
        accept_note: "Pagar um pacote neste site implica aceitar estas políticas.",
        back_pricing: "← Voltar aos preços",
        cta_buy: "Ver pacotes",
      },
    },
  };

  function lang() {
    if (global.JOM_I18N && global.JOM_I18N.resolveLang) return global.JOM_I18N.resolveLang();
    return "es";
  }

  function tBlock(L) {
    const code = L || lang();
    return POLICIES.i18n[code] || POLICIES.i18n.es || POLICIES.i18n.en;
  }

  function revisionsForPrice(price) {
    const n = Number(price) || 0;
    if (n <= 0) return 0;
    for (const b of POLICIES.revisionBands) {
      if (n <= b.maxPrice) return b.rounds;
    }
    return 2;
  }

  function summaryLines(L) {
    return tBlock(L).summary_items || [];
  }

  global.JOM_POLICIES = {
    data: POLICIES,
    tBlock,
    revisionsForPrice,
    summaryLines,
    extraRevisionUsdt: POLICIES.extraRevisionUsdt,
  };
})(typeof window !== "undefined" ? window : globalThis);
