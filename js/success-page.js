    (function () {
      const langMode = JOM_I18N.getStoredLangMode();
      const lang = JOM_I18N.resolveLang(langMode);
      document.documentElement.lang = lang;
      document.querySelectorAll("[data-i18n]").forEach((el) => {
        el.textContent = JOM_I18N.t(el.getAttribute("data-i18n"), lang);
      });
      const id = new URLSearchParams(location.search).get("order");
      const o = id && JOM_CRM.getOrder(id);
      if (!o) {
        document.getElementById("oid").textContent = "—";
        return;
      }
      document.getElementById("oid").textContent = o.id;
      // Re-localize product name if possible
      const p = o.productId ? JOM_COMMERCE.product(o.productId) : null;
      document.getElementById("pname").textContent = (p && p.name) || o.productName;
      const unit = document.getElementById("amt-unit");
      if (!Number(o.amount)) {
        document.getElementById("amt").textContent = JOM_I18N.t("badge_quote", lang);
        if (unit) unit.hidden = true;
      } else {
        document.getElementById("amt").textContent = o.amount;
      }
      document.getElementById("st").textContent = o.status;
      document.getElementById("hx").textContent = o.txHash || "—";
      document.getElementById("btn-wa").addEventListener("click", () => JOM_COMMERCE.openClientPaidWhatsApp(o));
    })();
  
