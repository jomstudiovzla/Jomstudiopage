/**
 * JOM STUDIO — Commerce engine: products, orders, notify, WA, Formspree
 * Depends on: config.js, crm.js, i18n-commerce.js (optional but recommended), tron.js (for checkout)
 */
(function (global) {
  function config() {
    return global.JOM_CONFIG || {};
  }

  function lang() {
    if (global.JOM_I18N && typeof global.JOM_I18N.resolveLang === "function") {
      return global.JOM_I18N.resolveLang();
    }
    try {
      const m = localStorage.getItem("jom_lang") || "auto";
      if (m !== "auto") return m;
    } catch (_) {}
    const code = (typeof navigator !== "undefined" && (navigator.language || "").slice(0, 2)) || "en";
    return ["en", "es", "fr", "pt"].includes(code) ? code : "en";
  }

  /**
   * Always produce a UI-safe product (name/headline never undefined).
   * Works even if i18n-commerce.js failed to load.
   */
  function localize(raw, L) {
    if (!raw) return null;
    if (global.JOM_I18N && typeof global.JOM_I18N.localizeProduct === "function") {
      const loc = global.JOM_I18N.localizeProduct(raw, L || lang());
      if (loc && loc.name && loc.name !== "undefined") return loc;
    }
    // Fallback: read i18n map directly
    const code = L || lang() || "en";
    const block =
      (raw.i18n && (raw.i18n[code] || raw.i18n.en || raw.i18n.es)) || {};
    const name = block.name || raw.name || raw.id || "Package";
    return {
      ...raw,
      name: name === "undefined" ? raw.id || "Package" : name,
      badge: block.badge || raw.badge || "",
      headline: block.headline || raw.headline || "",
      description: block.description || raw.description || "",
      eta: block.eta || raw.eta || "",
      deliverables: block.deliverables || raw.deliverables || [],
      notIncluded: block.notIncluded || raw.notIncluded || [],
      combinesLabel: block.combines || [],
      lang: code,
    };
  }

  function product(id, L) {
    const products = config().products || {};
    const raw = products[id] || products[config().defaultProductId] || null;
    return localize(raw, L);
  }

  function allProducts(L) {
    const p = config().products || {};
    return Object.keys(p)
      .map((k) => localize(p[k], L))
      .filter((item) => item && item.id);
  }

  function productsByCategory(category, L) {
    return allProducts(L).filter((p) => p.category === category && p.id !== "custom");
  }

  function soloProducts(L) {
    return allProducts(L).filter((p) => p.type !== "bundle" && p.id !== "custom");
  }

  function bundleProducts(L) {
    return allProducts(L).filter((p) => p.type === "bundle");
  }

  function separateSum(productOrId, L) {
    const p = typeof productOrId === "string" ? product(productOrId, L) : productOrId;
    if (!p || !Array.isArray(p.combines) || !p.combines.length) return p ? p.priceUsdt || 0 : 0;
    const catalog = config().products || {};
    return p.combines.reduce((sum, id) => {
      const part = catalog[id];
      return sum + (part && part.priceUsdt ? Number(part.priceUsdt) : 0);
    }, 0);
  }

  function savings(productOrId, L) {
    const p = typeof productOrId === "string" ? product(productOrId, L) : productOrId;
    if (!p || p.type !== "bundle") return 0;
    const sep = separateSum(p, L);
    return Math.max(0, sep - (Number(p.priceUsdt) || 0));
  }

  function waLink(textEncodedOrPlain, alreadyEncoded) {
    const phone = (config().contact && config().contact.whatsapp) || "584165159067";
    const text = alreadyEncoded ? textEncodedOrPlain : encodeURIComponent(textEncodedOrPlain);
    return `https://wa.me/${phone}?text=${text}`;
  }

  function mailLink(subject, body) {
    const email = (config().contact && config().contact.email) || "jomstudiovzla@gmail.com";
    return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  async function postFormspree(payload) {
    const endpoint = config().contact && config().contact.formspreeEndpoint;
    if (!endpoint) return { skipped: true };
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return { ok: res.ok, status: res.status };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async function postNotifyWebhook(payload) {
    const url = config().contact && config().contact.notifyWebhook;
    if (!url) return { skipped: true };
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return { ok: res.ok, status: res.status };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async function notifyAll(kind, data) {
    const payload = {
      kind,
      brand: (config().brand && config().brand.name) || "JOM STUDIO",
      ...data,
      at: new Date().toISOString(),
    };
    const [fs, wh] = await Promise.all([postFormspree(payload), postNotifyWebhook(payload)]);
    return { formspree: fs, webhook: wh };
  }

  async function placeOrder(form) {
    const p = product(form.productId);
    if (!p) throw new Error("Producto inválido");

    const order = global.JOM_CRM.createOrder({
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      amount: p.priceUsdt,
      network: p.network,
      currency: p.currency,
      name: form.name,
      email: form.email,
      phone: form.phone || "",
      brief: form.brief || "",
      txHash: form.txHash || "",
      status: form.txHash ? "paid_unverified" : "awaiting_payment",
      source: form.source || "order.html",
    });

    await notifyAll("order_placed", {
      orderId: order.id,
      product: order.productName,
      amount: order.amount,
      email: order.email,
      name: order.name,
      brief: order.brief,
      txHash: order.txHash,
    });

    return order;
  }

  async function attachAndVerifyPayment(orderId, txHash) {
    const order = global.JOM_CRM.getOrder(orderId);
    if (!order) throw new Error("Orden no encontrada");

    const hash = global.JOM_TRON.normalizeHash(txHash);
    global.JOM_CRM.updateOrder(orderId, { txHash: hash, status: "paid_unverified" });

    let verify = { ok: false, status: "skipped", message: "Sin verificación" };
    if (order.amount > 0) {
      verify = await global.JOM_TRON.verifyTxHash(hash, order.amount);
    }

    const status = verify.ok ? "verified" : "paid_unverified";

    const updated = global.JOM_CRM.updateOrder(orderId, {
      txHash: hash,
      status,
      verifyResult: verify,
    });

    await notifyAll("payment_submitted", {
      orderId,
      txHash: hash,
      verifyStatus: verify.status,
      amount: order.amount,
      email: order.email,
    });

    return { order: updated, verify };
  }

  function openOrderWhatsApp(order) {
    const tpl =
      (config().messages && config().messages.orderWaTemplate && config().messages.orderWaTemplate(order)) ||
      encodeURIComponent(`Pedido ${order.id} — ${order.productName} — ${order.amount} USDT`);
    window.open(waLink(tpl, true), "_blank");
  }

  function openClientPaidWhatsApp(order) {
    const tpl =
      (config().messages && config().messages.clientPaidWa && config().messages.clientPaidWa(order)) ||
      encodeURIComponent(`Pagué ${order.productName}`);
    window.open(waLink(tpl, true), "_blank");
  }

  function orderUrl(productId) {
    const id = productId || config().defaultProductId || "launch";
    return `order.html?product=${encodeURIComponent(id)}`;
  }

  function successUrl(orderId) {
    return `success.html?order=${encodeURIComponent(orderId)}`;
  }

  async function submitBrief({ name, email, briefText, channel, productId }) {
    const entry = global.JOM_CRM.saveBrief({ name, email, briefText, channel, productId });
    await notifyAll("brief", { name, email, brief: briefText, channel, productId });

    if (channel === "wa") {
      const message =
        `¡Hola JOM STUDIO! 🚀%0A%0A` +
        `Me gustaría cotizar un proyecto:%0A%0A` +
        `*Nombre/Empresa:* ${encodeURIComponent(name)}%0A` +
        `*Email:* ${encodeURIComponent(email)}%0A` +
        `*Brief:* ${encodeURIComponent(briefText)}%0A` +
        (productId ? `*Paquete:* ${encodeURIComponent(productId)}%0A` : "") +
        `*ID lead:* ${entry.id}`;
      window.open(waLink(message, true), "_blank");
    } else {
      window.open(
        mailLink(
          `Nuevo Proyecto JOM STUDIO - ${name}`,
          `Hola JOM STUDIO,\n\nMe gustaría cotizar un proyecto:\n\nNombre: ${name}\nEmail: ${email}\nLead: ${entry.id}\n\nBrief:\n${briefText}`
        ),
        "_blank"
      );
    }
    return entry;
  }

  global.JOM_COMMERCE = {
    lang,
    localize,
    product,
    allProducts,
    productsByCategory,
    soloProducts,
    bundleProducts,
    separateSum,
    savings,
    placeOrder,
    attachAndVerifyPayment,
    openOrderWhatsApp,
    openClientPaidWhatsApp,
    orderUrl,
    successUrl,
    submitBrief,
    waLink,
    mailLink,
    notifyAll,
  };
})(typeof window !== "undefined" ? window : globalThis);
