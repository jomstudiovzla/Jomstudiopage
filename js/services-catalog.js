    (function () {
      let view = "all"; // all | solo | bundles | compare
      let langMode = JOM_I18N.getStoredLangMode();

      function L() { return JOM_I18N.resolveLang(langMode); }

      function applyStaticI18n() {
        const lang = L();
        document.documentElement.lang = lang;
        document.title = JOM_I18N.t("page_title", lang);
        document.querySelectorAll("[data-i18n]").forEach((el) => {
          const key = el.getAttribute("data-i18n");
          el.textContent = JOM_I18N.t(key, lang);
        });
        const label = document.getElementById("lang-label");
        label.textContent = langMode === "auto" ? "AUTO" : lang.toUpperCase();
        const wa = document.getElementById("wa-direct");
        wa.href = JOM_COMMERCE.waLink(
          lang === "es"
            ? "Hola JOM STUDIO — vi los paquetes en jomstudio.site/services y quiero cotizar / comprar."
            : lang === "fr"
            ? "Bonjour JOM STUDIO — j'ai vu les packs sur jomstudio.site/services et je souhaite un devis / achat."
            : lang === "pt"
            ? "Olá JOM STUDIO — vi os pacotes em jomstudio.site/services e quero orçar / comprar."
            : "Hi JOM STUDIO — I saw packages on jomstudio.site/services and want a quote / purchase."
        );
        const banner = document.getElementById("wallet-banner");
        if (window.JOM_TRON && !JOM_TRON.isWalletReady()) {
          banner.classList.remove("hidden");
          banner.textContent = JOM_I18N.t("wallet_warn", lang);
        } else {
          banner.classList.add("hidden");
        }
      }

      function categoryIds() {
        return JOM_CONFIG.categoryOrder || ["web", "gamification", "branding", "ai", "photo", "ugc", "automation"];
      }

      function renderTabs() {
        const lang = L();
        const tabs = [{ id: "all", label: JOM_I18N.t("tab_all", lang) }];
        categoryIds().forEach((id) => {
          tabs.push({ id: id, label: JOM_I18N.categoryLabel(id, lang) });
        });
        tabs.push({ id: "bundles", label: JOM_I18N.t("tab_bundles", lang) });
        tabs.push({ id: "compare", label: JOM_I18N.t("tab_compare", lang) });
        const host = document.getElementById("filter-tabs");
        host.innerHTML = tabs
          .map(
            (t) =>
              `<button type="button" role="tab" aria-selected="${view === t.id ? "true" : "false"}" data-view="${t.id}" class="mono text-[10px] uppercase tracking-wider px-3 py-2 border border-white/15 rounded ${
                view === t.id ? "tab-active" : "text-gray-400 hover:border-cyan-400/50"
              }">${t.label}</button>`
          )
          .join("");
        host.querySelectorAll("button").forEach((btn) => {
          btn.addEventListener("click", () => {
            view = btn.dataset.view;
            const hash = view === "all" ? "" : "#cat-" + view;
            history.replaceState(null, "", location.pathname + location.search + hash);
            renderTabs();
            renderCatalog();
          });
        });
      }

      function safe(v, fb) {
        if (v == null || v === "undefined" || v === "null") return fb || "";
        return String(v);
      }

      function cardHTML(raw) {
        const lang = L();
        // Force re-localize every render (avoids stale/undefined fields)
        const p = JOM_COMMERCE.product(raw.id) || JOM_COMMERCE.localize(raw) || raw;
        const name = safe(p.name, p.id || "Package");
        const headline = safe(p.headline, "");
        const badge = safe(p.badge, "");
        const eta = safe(p.eta, "—");
        const isQuote = !p.priceUsdt;
        const isBundle = p.type === "bundle";
        const sep = isBundle ? JOM_COMMERCE.separateSum(p) : 0;
        const save = isBundle ? JOM_COMMERCE.savings(p) : 0;
        const dels = (Array.isArray(p.deliverables) ? p.deliverables : []).slice(0, 5);
        const combines = (Array.isArray(p.combinesLabel) && p.combinesLabel.length
          ? p.combinesLabel
          : (p.combines || []).map((id) => {
              const part = JOM_COMMERCE.product(id);
              return part ? safe(part.name, id) : id;
            })
        ).filter(Boolean);

        return `
          <article class="glass rounded-xl p-5 flex flex-col gap-3 min-w-0 ${p.featured ? "featured" : ""}" id="pkg-${safe(p.id, "x")}">
            <div class="flex justify-between items-start gap-2">
              <span class="mono text-[9px] tracking-widest text-cyan-300 border border-cyan-400/30 px-2 py-0.5">${badge}</span>
              <span class="mono text-[9px] text-gray-500">${safe(p.sku, "")}</span>
            </div>
            <div class="min-w-0">
              <h3 class="text-base sm:text-lg font-bold uppercase tracking-tight leading-snug">${name}</h3>
              ${headline ? `<p class="text-sm text-gray-400 mt-1">${headline}</p>` : ""}
            </div>
            <div class="mono text-2xl sm:text-3xl font-bold text-cyan-300">
              ${isQuote ? JOM_I18N.t("badge_quote", lang) : safe(p.priceUsdt, "0") + ' <span class="text-sm text-gray-400">USDT</span>'}
            </div>
            ${
              isBundle && sep > 0
                ? `<div class="text-xs text-gray-500 mono">
                    <span class="line-through">${sep} USDT</span>
                    ${save > 0 ? ` · <span class="text-amber-300">${JOM_I18N.t("compare_save", lang)} ${save} USDT</span>` : ""}
                  </div>`
                : ""
            }
            <p class="mono text-[10px] text-gray-500">${JOM_I18N.t("eta_label", lang)}: ${eta} · ${safe(p.network, "TRC20")}</p>
            ${
              isBundle && combines.length
                ? `<p class="text-[11px] text-gray-400"><span class="text-amber-300 mono">${JOM_I18N.t("from_categories", lang)}:</span> ${combines.join(" + ")}</p>`
                : ""
            }
            <ul class="text-xs text-gray-300 space-y-1 flex-1">
              ${dels.map((d) => `<li class="flex gap-2"><span class="text-cyan-400 shrink-0">✓</span><span>${safe(d, "")}</span></li>`).join("")}
            </ul>
            <a href="${JOM_COMMERCE.orderUrl(p.id)}"
               class="${isQuote ? "btn-g" : "btn-p"} w-full text-center py-2.5 rounded">
              ${isQuote ? JOM_I18N.t("quote", lang) : JOM_I18N.t("buy", lang) + " · " + safe(p.priceUsdt, "0") + " USDT"}
            </a>
          </article>
        `;
      }

      function section(title, products) {
        if (!products.length) return "";
        return `
          <section class="min-w-0">
            <h2 class="text-lg sm:text-xl font-bold uppercase tracking-wide mb-4 text-secondary border-b border-white/10 pb-2">${title}</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              ${products.map(cardHTML).join("")}
            </div>
          </section>
        `;
      }

      function renderCompare() {
        const lang = L();
        const bundles = JOM_COMMERCE.bundleProducts();
        if (!bundles.length) return `<p class="text-gray-500">${JOM_I18N.t("empty", lang)}</p>`;
        return `
          <section>
            <h2 class="text-lg sm:text-xl font-bold uppercase tracking-wide mb-4 text-amber-400">${JOM_I18N.t("section_compare", lang)}</h2>
            <div class="overflow-x-auto glass rounded-xl">
              <table class="w-full text-left text-sm min-w-[520px]">
                <thead>
                  <tr class="mono text-[10px] text-cyan-300 uppercase tracking-wider border-b border-white/10">
                    <th class="p-3">${JOM_I18N.t("tab_bundles", lang)}</th>
                    <th class="p-3">${JOM_I18N.t("compare_solo_sum", lang)}</th>
                    <th class="p-3">${JOM_I18N.t("compare_bundle", lang)}</th>
                    <th class="p-3">${JOM_I18N.t("compare_save", lang)}</th>
                    <th class="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  ${bundles
                    .map((b) => {
                      const sep = JOM_COMMERCE.separateSum(b);
                      const save = JOM_COMMERCE.savings(b);
                      return `<tr class="border-b border-white/5 hover:bg-white/[0.02]">
                        <td class="p-3 font-semibold">${b.name}<div class="text-xs text-gray-500 font-normal">${b.headline}</div></td>
                        <td class="p-3 mono text-gray-400 line-through">${sep} USDT</td>
                        <td class="p-3 mono text-cyan-300 font-bold">${b.priceUsdt} USDT</td>
                        <td class="p-3 mono text-amber-300">${save > 0 ? "−" + save + " USDT" : "—"}</td>
                        <td class="p-3"><a class="btn-p px-3 py-1.5 rounded inline-block" href="${JOM_COMMERCE.orderUrl(b.id)}">${JOM_I18N.t("buy", lang)}</a></td>
                      </tr>`;
                    })
                    .join("")}
                </tbody>
              </table>
            </div>
          </section>
        `;
      }

      function productsInCategory(cat) {
        return JOM_COMMERCE.allProducts().filter((p) => p.category === cat && p.type !== "bundle");
      }

      function scrollPkg() {
        const hash = location.hash || "";
        if (!hash.startsWith("#pkg-")) return;
        const el = document.getElementById(hash.slice(1));
        if (el) el.scrollIntoView({ block: "start" });
      }

      function viewFromHash() {
        const hash = (location.hash || "").replace(/^#/, "");
        if (hash.startsWith("cat-")) {
          const id = hash.slice(4);
          if (categoryIds().includes(id) || id === "bundles" || id === "compare") return id;
        }
        if (hash.startsWith("pkg-")) {
          const raw = JOM_CONFIG.products && JOM_CONFIG.products[hash.slice(4)];
          if (!raw) return null;
          if (raw.type === "bundle") return "bundles";
          if (raw.category && categoryIds().includes(raw.category)) return raw.category;
        }
        return null;
      }

      function renderCatalog() {
        const lang = L();
        const root = document.getElementById("catalog-root");
        const order = categoryIds();

        if (view === "compare") {
          root.innerHTML = renderCompare();
          return;
        }

        let html = "";
        if (order.includes(view)) {
          html += section(JOM_I18N.categoryLabel(view, lang), productsInCategory(view));
        } else if (view === "bundles") {
          html += section(JOM_I18N.t("section_bundles", lang), JOM_COMMERCE.bundleProducts());
        } else {
          html += `<h2 class="text-lg sm:text-xl font-bold uppercase tracking-wide text-white">${JOM_I18N.t("section_solo", lang)}</h2>`;
          order.forEach((cat) => {
            const list = productsInCategory(cat);
            if (list.length) html += section(JOM_I18N.categoryLabel(cat, lang), list);
          });
          html += section(JOM_I18N.t("section_bundles", lang), JOM_COMMERCE.bundleProducts());
          html += renderCompare();
        }
        root.innerHTML = html || `<p class="text-gray-500">${JOM_I18N.t("empty", lang)}</p>`;
      }

      function renderPoliciesSummary() {
        const list = document.getElementById("policies-summary-list");
        if (!list || !window.JOM_POLICIES) return;
        const items = JOM_POLICIES.summaryLines(L()) || [];
        list.innerHTML = items
          .map((s) => `<li class="flex gap-2"><span class="text-cyan-400 shrink-0">✓</span><span>${s}</span></li>`)
          .join("");
      }

      function fullRender() {
        applyStaticI18n();
        renderTabs();
        renderCatalog();
        renderPoliciesSummary();
        requestAnimationFrame(scrollPkg);
      }

      document.querySelectorAll(".lang-opt").forEach((btn) => {
        btn.addEventListener("click", () => {
          langMode = btn.dataset.lang;
          JOM_I18N.setStoredLangMode(langMode);
          fullRender();
        });
      });

      window.addEventListener("jom:lang", () => {
        langMode = JOM_I18N.getStoredLangMode();
        fullRender();
      });
      window.addEventListener("storage", (e) => {
        if (e.key === "jom_lang") {
          langMode = e.newValue || "auto";
          fullRender();
        }
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

      const hashedView = viewFromHash();
      if (hashedView) view = hashedView;
      window.addEventListener("hashchange", () => {
        const next = viewFromHash() || "all";
        if (next !== view) {
          view = next;
          fullRender();
        } else {
          requestAnimationFrame(scrollPkg);
        }
      });

      fullRender();
    })();
  
