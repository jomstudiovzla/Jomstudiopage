/**
 * JOM STUDIO — Local CRM (orders + briefs + events)
 * Survives refreshes via localStorage. Exportable as JSON.
 */
(function (global) {
  const cfg = () => global.JOM_CONFIG || {};
  const keys = () =>
    (cfg().admin && cfg().admin.storageKeys) || {
      orders: "jom_orders_v1",
      briefs: "jom_contact_briefs",
      events: "jom_ops_events_v1",
    };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function uid(prefix) {
    const t = Date.now().toString(36).toUpperCase();
    const r = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${prefix}-${t}-${r}`;
  }

  function logEvent(type, payload) {
    const k = keys().events;
    const events = read(k, []);
    events.unshift({
      id: uid("EVT"),
      type,
      payload,
      at: new Date().toISOString(),
    });
    write(k, events.slice(0, 500));
  }

  const CRM = {
    createOrder(data) {
      const order = {
        id: uid("ORD"),
        productId: data.productId,
        productName: data.productName,
        sku: data.sku || "",
        amount: Number(data.amount) || 0,
        network: data.network || "TRC20",
        currency: data.currency || "USDT",
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        brief: data.brief || "",
        txHash: data.txHash || "",
        status: data.status || "awaiting_payment", // awaiting_payment | paid_unverified | verified | in_progress | delivered | cancelled
        verifyResult: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: data.source || "order.html",
      };
      const list = read(keys().orders, []);
      list.unshift(order);
      write(keys().orders, list);
      logEvent("order_created", { id: order.id, productId: order.productId, amount: order.amount });
      return order;
    },

    updateOrder(id, patch) {
      const list = read(keys().orders, []);
      const idx = list.findIndex((o) => o.id === id);
      if (idx === -1) return null;
      list[idx] = { ...list[idx], ...patch, updatedAt: new Date().toISOString() };
      write(keys().orders, list);
      logEvent("order_updated", { id, patch });
      return list[idx];
    },

    getOrder(id) {
      return read(keys().orders, []).find((o) => o.id === id) || null;
    },

    listOrders() {
      return read(keys().orders, []);
    },

    saveBrief(brief) {
      const list = read(keys().briefs, []);
      const entry = {
        id: uid("BRF"),
        name: brief.name,
        email: brief.email,
        briefText: brief.briefText || brief.brief || "",
        channel: brief.channel || "wa",
        productId: brief.productId || null,
        timestamp: new Date().toLocaleString(),
        iso: new Date().toISOString(),
      };
      list.unshift(entry);
      write(keys().briefs, list);
      logEvent("brief_saved", { id: entry.id, channel: entry.channel });
      return entry;
    },

    listBriefs() {
      return read(keys().briefs, []);
    },

    listEvents() {
      return read(keys().events, []);
    },

    exportAll() {
      return {
        exportedAt: new Date().toISOString(),
        orders: CRM.listOrders(),
        briefs: CRM.listBriefs(),
        events: CRM.listEvents(),
      };
    },

    importAll(blob) {
      if (blob.orders) write(keys().orders, blob.orders);
      if (blob.briefs) write(keys().briefs, blob.briefs);
      if (blob.events) write(keys().events, blob.events);
      logEvent("crm_imported", { orders: (blob.orders || []).length });
    },

    clearAll(confirmWord) {
      if (confirmWord !== "PURGE") throw new Error("Type PURGE to clear");
      write(keys().orders, []);
      write(keys().events, []);
      logEvent("crm_purged", {});
    },
  };

  global.JOM_CRM = CRM;
})(typeof window !== "undefined" ? window : globalThis);
