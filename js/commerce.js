/**
 * JOM STUDIO — Commerce engine: products, orders, notify, WA, Formspree
 */
(function (global) {
  function config() {
    return global.JOM_CONFIG || {};
  }

  function product(id) {
    const products = (config().products) || {};
    return products[id] || products[config().defaultProductId] || null;
  }

  function allProducts() {
    const p = config().products || {};
    return Object.keys(p).map((k) => p[k]);
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

  /**
   * Start order → CRM + optional remote notify
   */
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

    const status = verify.ok
      ? "verified"
      : verify.status === "manual_review" || verify.status === "verified_amount_only"
        ? "paid_unverified"
        : "paid_unverified";

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

  /**
   * Enhanced brief submit used by index.html
   */
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
    product,
    allProducts,
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
