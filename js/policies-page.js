    (function () {
      let langMode = JOM_I18N.getStoredLangMode();

      function L() {
        return JOM_I18N.resolveLang(langMode);
      }

      function render() {
        const lang = L();
        const B = JOM_POLICIES.tBlock(lang);
        const P = JOM_POLICIES.data;
        document.documentElement.lang = lang;
        document.title = B.page_title;
        document.getElementById("lang-label").textContent = langMode === "auto" ? "AUTO" : lang.toUpperCase();
        document.getElementById("nav-pol").textContent = B.nav_policies;
        document.getElementById("nav-pricing").textContent = JOM_I18N.t("nav_pricing", lang);
        document.getElementById("cta-buy").textContent = B.cta_buy;
        document.getElementById("version-line").textContent =
          B.updated + " " + P.version + " · " + P.effectiveFrom;
        document.getElementById("hero-title").textContent = B.hero_title;
        document.getElementById("hero-sub").textContent = B.hero_sub;
        document.getElementById("summary-title").textContent = B.summary_title;
        document.getElementById("summary-list").innerHTML = (B.summary_items || [])
          .map((s) => `<li class="flex gap-2"><span class="text-cyan-400">✓</span><span>${s}</span></li>`)
          .join("");
        document.getElementById("accept-note").textContent = B.accept_note;
        document.getElementById("back-pricing").textContent = B.back_pricing;

        const keys = [
          ["s1_title", "s1_body"],
          ["s2_title", "s2_body"],
          ["s3_title", "s3_body"],
          ["s4_title", "s4_body"],
          ["s5_title", "s5_body"],
          ["s6_title", "s6_body"],
          ["s7_title", "s7_body"],
        ];
        document.getElementById("sections").innerHTML = keys
          .map(([tk, bk]) => {
            const title = B[tk] || "";
            const items = B[bk] || [];
            return `<section class="policy glass rounded-xl p-4 sm:p-6">
              <h2>${title}</h2>
              <ul>${items.map((li) => `<li>${li}</li>`).join("")}</ul>
            </section>`;
          })
          .join("");
      }

      document.querySelectorAll(".lang-opt").forEach((btn) => {
        btn.addEventListener("click", () => {
          langMode = btn.dataset.lang;
          JOM_I18N.setStoredLangMode(langMode);
          render();
        });
      });
      window.addEventListener("storage", (e) => {
        if (e.key === "jom_lang") {
          langMode = e.newValue || "auto";
          render();
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

      render();
    })();
  
