    (function () {
      let langMode = JOM_I18N.getStoredLangMode();
      const params = new URLSearchParams(location.search);
      let productId = params.get("product") || JOM_CONFIG.defaultProductId || "launch";
      if (!(JOM_CONFIG.products && JOM_CONFIG.products[productId])) {
        location.replace("/services");
        return;
      }
      let currentOrder = null;
      let p = null;

      function L() { return JOM_I18N.resolveLang(langMode); }

      function applyI18nStatic() {
        const lang = L();
        document.documentElement.lang = lang;
        document.querySelectorAll("[data-i18n]").forEach((el) => {
          el.textContent = JOM_I18N.t(el.getAttribute("data-i18n"), lang);
        });
        document.getElementById("lang-label").textContent = langMode === "auto" ? "AUTO" : lang.toUpperCase();
        document.getElementById("order-steps").textContent = JOM_I18N.t("order_steps", lang);
      }

      function fillProduct() {
        p = JOM_COMMERCE.product(productId);
        if (!p || !(JOM_CONFIG.products && JOM_CONFIG.products[productId])) {
          location.replace("/services");
          return;
        }
        const quote = !Number(p.priceUsdt);
        const name = p.name && p.name !== "undefined" ? p.name : productId;
        const headline = p.headline && p.headline !== "undefined" ? p.headline : "";
        document.getElementById("p-name").textContent = name;
        document.getElementById("p-headline").textContent = headline;
        const priceEl = document.getElementById("p-price");
        const unitEl = document.getElementById("p-price-unit");
        if (quote) {
          priceEl.textContent = JOM_I18N.t("badge_quote", L());
          if (unitEl) unitEl.hidden = true;
        } else {
          priceEl.textContent = p.priceUsdt;
          if (unitEl) unitEl.hidden = false;
        }
        document.getElementById("p-network").textContent = p.network || "TRC20";
        document.getElementById("p-eta").textContent = (p.eta && p.eta !== "undefined") ? p.eta : "—";
        document.getElementById("p-deliverables").innerHTML = (p.deliverables || [])
          .filter((d) => d && d !== "undefined")
          .map((d) => `<li class="flex gap-2"><span class="text-cyan-400">✓</span><span>${d}</span></li>`)
          .join("");
        // Revisions note from policies
        const revEl = document.getElementById("rev-note");
        if (revEl && window.JOM_POLICIES) {
          const rounds = JOM_POLICIES.revisionsForPrice(p.priceUsdt);
          const extra = JOM_POLICIES.extraRevisionUsdt;
          const lang = L();
          revEl.textContent =
            lang === "es"
              ? `Revisiones incluidas: ${rounds} ronda(s). Extra: ${extra} USDT c/u. Idle 30 días = cierre.`
              : lang === "fr"
              ? `Révisions incluses : ${rounds}. Extra : ${extra} USDT. Idle 30 j. = clôture.`
              : lang === "pt"
              ? `Revisões incluídas: ${rounds}. Extra: ${extra} USDT. Idle 30 dias = fechamento.`
              : `Revisions included: ${rounds} round(s). Extra: ${extra} USDT each. Idle 30 days = close.`;
        }
        const polList = document.getElementById("order-policy-summary");
        if (polList && window.JOM_POLICIES) {
          polList.innerHTML = (JOM_POLICIES.summaryLines(L()) || [])
            .slice(0, 4)
            .map((s) => `<li>· ${s}</li>`)
            .join("");
        }
        const cmp = document.getElementById("p-bundle-compare");
        if (p.type === "bundle") {
          const sep = JOM_COMMERCE.separateSum(p);
          const save = JOM_COMMERCE.savings(p);
          cmp.classList.remove("hidden");
          cmp.innerHTML = `${JOM_I18N.t("compare_solo_sum", L())}: <s>${sep} USDT</s><br/>${JOM_I18N.t("compare_save", L())}: <strong>${save} USDT</strong>`;
        } else {
          cmp.classList.add("hidden");
        }
        const wallet = JOM_CONFIG.crypto.address;
        const warn = document.getElementById("wallet-warn");
        if (!JOM_TRON.isWalletReady()) {
          warn.classList.remove("hidden");
          warn.textContent = JOM_I18N.t("wallet_warn", L());
        } else {
          warn.classList.add("hidden");
        }
        document.getElementById("wallet-addr").textContent = wallet;
      }

      function refresh() {
        applyI18nStatic();
        fillProduct();
      }

      document.querySelectorAll(".lang-opt").forEach((btn) => {
        btn.addEventListener("click", () => {
          langMode = btn.dataset.lang;
          JOM_I18N.setStoredLangMode(langMode);
          refresh();
        });
      });
      window.addEventListener("storage", (e) => {
        if (e.key === "jom_lang") {
          langMode = e.newValue || "auto";
          refresh();
        }
      });

      const existingId = params.get("order");
      if (existingId) {
        const o = JOM_CRM.getOrder(existingId);
        if (o) {
          currentOrder = o;
          productId = o.productId || productId;
        }
      }

      refresh();

      if (currentOrder) {
        document.getElementById("name").value = currentOrder.name || "";
        document.getElementById("email").value = currentOrder.email || "";
        document.getElementById("brief").value = currentOrder.brief || "";
        if (Number(p && p.priceUsdt)) showPay(currentOrder);
      }

      document.getElementById("order-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const accept = document.getElementById("accept-policies");
        if (accept && !accept.checked) {
          accept.focus();
          alert(
            L() === "es"
              ? "Debes aceptar las políticas de trabajo para continuar."
              : "You must accept the work policies to continue."
          );
          return;
        }
        const btn = document.getElementById("btn-create");
        btn.disabled = true;
        try {
          currentOrder = await JOM_COMMERCE.placeOrder({
            productId: p.id,
            name: document.getElementById("name").value.trim(),
            email: document.getElementById("email").value.trim(),
            phone: document.getElementById("phone").value.trim(),
            brief: document.getElementById("brief").value.trim(),
            source: "order.html",
          });
          if (!Number(p.priceUsdt)) {
            location.href = JOM_COMMERCE.successUrl(currentOrder.id);
            return;
          }
          history.replaceState({}, "", `/order?product=${p.id}&order=${currentOrder.id}`);
          showPay(currentOrder);
        } catch (err) {
          alert(err.message || "Error");
        } finally {
          btn.disabled = false;
          applyI18nStatic();
        }
      });

      function showPay(order) {
        const wallet = JOM_CONFIG.crypto.address;
        document.getElementById("pay-panel").classList.remove("hidden");
        document.getElementById("order-id").textContent = order.id;
        document.getElementById("pay-amount").textContent = order.amount;
        document.getElementById("wallet-addr").textContent = wallet;
        document.getElementById("qr-img").src = JOM_TRON.isWalletReady()
          ? JOM_TRON.qrUrl(wallet, 280)
          : "assets/commerce/qr_300usdt.png";
        document.getElementById("pay-panel").scrollIntoView({ behavior: "smooth", block: "start" });
      }

      document.getElementById("btn-copy").addEventListener("click", async () => {
        const wallet = JOM_CONFIG.crypto.address;
        try {
          await navigator.clipboard.writeText(wallet);
          document.getElementById("btn-copy").textContent = "OK";
          setTimeout(() => applyI18nStatic(), 1200);
        } catch {
          prompt("Wallet:", wallet);
        }
      });

      document.getElementById("btn-verify").addEventListener("click", async () => {
        if (!currentOrder) return alert("Order first");
        const hash = document.getElementById("txHash").value.trim();
        if (!hash) return;
        const btn = document.getElementById("btn-verify");
        const msg = document.getElementById("verify-msg");
        btn.disabled = true;
        msg.classList.remove("hidden");
        msg.className = "text-sm mono p-3 rounded border border-white/20 text-gray-300";
        msg.textContent = "…";
        try {
          const { order, verify } = await JOM_COMMERCE.attachAndVerifyPayment(currentOrder.id, hash);
          currentOrder = order;
          if (verify.ok) {
            msg.className = "text-sm mono p-3 rounded border border-green-500/40 text-green-300";
            msg.innerHTML = `✓ ${verify.message}`;
            setTimeout(() => (location.href = JOM_COMMERCE.successUrl(order.id)), 1000);
          } else {
            msg.className = "text-sm mono p-3 rounded border border-amber-500/40 text-amber-200";
            msg.textContent = verify.message;
          }
        } catch (err) {
          msg.className = "text-sm mono p-3 rounded border border-red-500/40 text-red-300";
          msg.textContent = err.message;
        } finally {
          btn.disabled = false;
          applyI18nStatic();
        }
      });

      document.getElementById("btn-wa").addEventListener("click", () => {
        if (!currentOrder) return;
        const hash = document.getElementById("txHash").value.trim();
        if (hash) {
          JOM_CRM.updateOrder(currentOrder.id, { txHash: JOM_TRON.normalizeHash(hash), status: "paid_unverified" });
          currentOrder = JOM_CRM.getOrder(currentOrder.id);
        }
        JOM_COMMERCE.openClientPaidWhatsApp(currentOrder);
      });

      (function bindLangMenu() {
        const toggle = document.getElementById("lang-toggle");
        const menu = document.getElementById("lang-menu");
        if (!toggle || !menu) return;
        toggle.addEventListener("click", (e) => {
          e.stopPropagation();
          const open = menu.style.visibility === "visible";
          menu.style.opacity = open ? "" : "1";
          menu.style.visibility = open ? "" : "visible";
        });
        document.addEventListener("click", () => {
          menu.style.opacity = "";
          menu.style.visibility = "";
        });
      })();
    })();
  
