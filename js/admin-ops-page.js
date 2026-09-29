    (function () {
      const gate = document.getElementById("gate");
      const app = document.getElementById("app");
      const pwKey = "jom_ops_auth";

      function unlock() {
        gate.classList.add("hidden");
        app.classList.remove("hidden");
        render();
      }

      if (sessionStorage.getItem(pwKey) === "1") unlock();

      document.getElementById("btn-login").onclick = () => {
        const expected = (JOM_CONFIG.admin && JOM_CONFIG.admin.password) || "jom2026";
        if (document.getElementById("pw").value === expected) {
          sessionStorage.setItem(pwKey, "1");
          unlock();
        } else {
          alert("ACCESS DENIED");
        }
      };

      document.getElementById("btn-refresh").onclick = render;
      document.getElementById("btn-export").onclick = () => {
        const blob = new Blob([JSON.stringify(JOM_CRM.exportAll(), null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `jom-crm-${Date.now()}.json`;
        a.click();
      };

      function statusClass(s) {
        if (s === "verified" || s === "delivered") return "ok";
        if (s === "cancelled") return "bad";
        return "warn";
      }

      function render() {
        const orders = JOM_CRM.listOrders();
        const briefs = JOM_CRM.listBriefs();
        document.getElementById("m-orders").textContent = orders.length;
        document.getElementById("m-briefs").textContent = briefs.length;
        document.getElementById("m-verified").textContent = orders.filter((o) => o.status === "verified").length;
        document.getElementById("m-usdt").textContent = orders
          .filter((o) => ["verified", "paid_unverified", "in_progress", "delivered"].includes(o.status))
          .reduce((s, o) => s + (Number(o.amount) || 0), 0);

        const tbody = document.getElementById("orders-body");
        tbody.innerHTML = orders.length
          ? orders
              .map((o) => {
                const tron = o.txHash ? `<a class="text-cyan-400 underline" target="_blank" rel="noopener noreferrer" href="${JOM_TRON.tronscanTxUrl(o.txHash)}">${(o.txHash || "").slice(0, 10)}…</a>` : "—";
                return `<tr>
                  <td class="mono text-[10px]">${o.id}</td>
                  <td>${o.productName}<div class="text-gray-500 text-[10px]">${o.createdAt}</div></td>
                  <td>${o.name}<div class="text-gray-500">${o.email}</div></td>
                  <td class="mono text-cyan-300">${o.amount}</td>
                  <td><span class="pill ${statusClass(o.status)}">${o.status}</span></td>
                  <td class="mono text-[10px]">${tron}</td>
                  <td class="space-y-1">
                    <select data-id="${o.id}" class="status-sel bg-black border border-white/20 rounded px-1 py-0.5">
                      ${["awaiting_payment","paid_unverified","verified","in_progress","delivered","cancelled"]
                        .map((s) => `<option value="${s}" ${s === o.status ? "selected" : ""}>${s}</option>`)
                        .join("")}
                    </select>
                    <button data-reverify="${o.id}" class="block border border-white/20 px-2 py-0.5 rounded reverify">Re-verify</button>
                    <button data-wa="${o.id}" class="block border border-green-500/40 text-green-400 px-2 py-0.5 rounded wa-btn">WA</button>
                  </td>
                </tr>`;
              })
              .join("")
          : `<tr><td colspan="7" class="text-gray-500">Sin órdenes aún.</td></tr>`;

        document.getElementById("briefs-body").innerHTML = briefs.length
          ? briefs
              .map(
                (b) => `<tr>
                <td class="mono text-[10px]">${b.timestamp || b.iso || ""}</td>
                <td>${b.name || ""}</td>
                <td class="text-cyan-200">${b.email || ""}</td>
                <td>${b.channel || ""}</td>
                <td class="max-w-xs truncate" title="${(b.briefText || "").replace(/"/g, "&quot;")}">${b.briefText || ""}</td>
              </tr>`
              )
              .join("")
          : `<tr><td colspan="5" class="text-gray-500">Sin briefs.</td></tr>`;

        document.querySelectorAll(".status-sel").forEach((sel) => {
          sel.onchange = () => {
            JOM_CRM.updateOrder(sel.dataset.id, { status: sel.value });
            render();
          };
        });
        document.querySelectorAll(".reverify").forEach((btn) => {
          btn.onclick = async () => {
            const o = JOM_CRM.getOrder(btn.dataset.reverify);
            if (!o || !o.txHash) return alert("Sin hash");
            btn.textContent = "...";
            const { verify } = await JOM_COMMERCE.attachAndVerifyPayment(o.id, o.txHash);
            alert(verify.message || verify.status);
            render();
          };
        });
        document.querySelectorAll(".wa-btn").forEach((btn) => {
          btn.onclick = () => {
            const o = JOM_CRM.getOrder(btn.dataset.wa);
            if (o) JOM_COMMERCE.openOrderWhatsApp(o);
          };
        });

        document.getElementById("wallet-show").textContent = JOM_CONFIG.crypto.address;
        document.getElementById("wallet-status").textContent = JOM_TRON.isWalletReady()
          ? "Wallet lista para recibir USDT TRC20."
          : "⚠️ Reemplaza crypto.address en js/config.js";
      }
    })();
  
