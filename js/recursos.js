// recursos.js — captura de leads del recurso "checklist" (auditoría express gratis).
// Envía a la Pages Function /api/submit (mismo origen → CSP connect-src 'self' OK).
(function () {
  "use strict";
  var form = document.getElementById("lead-form");
  if (!form) return;

  var msg = document.getElementById("lead-msg");
  var btn = document.getElementById("lead-submit");

  function show(text, ok) {
    if (!msg) return;
    msg.textContent = text;
    msg.classList.remove("hidden");
    msg.style.color = ok ? "#00F2FF" : "#ff6b6b";
  }

  function isEmail(v) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v); }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = (document.getElementById("lead-name").value || "").trim();
    var email = (document.getElementById("lead-email").value || "").trim();
    var url = (document.getElementById("lead-url").value || "").trim();
    var hp = (document.getElementById("company_website").value || "").trim();

    if (!name || !email) { show("Completa tu nombre y correo, por favor.", false); return; }
    if (!isEmail(email)) { show("Ese correo no parece válido. Revísalo.", false); return; }

    var brief = "Solicita auditoría express gratis (recurso: checklist 7 puntos)."
      + (url ? " Web: " + url : " (aún sin web)");

    if (btn) { btn.disabled = true; btn.textContent = "Enviando…"; }
    show("Enviando…", true);

    fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        kind: "lead",
        name: name,
        email: email,
        brief: brief,
        channel: "recurso-checklist",
        productId: "auditoria-express",
        company_website: hp,
      }),
    })
      .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); })
      .then(function (data) {
        if (data && data.ok) {
          form.reset();
          show("¡Listo! Recibí tus datos. Te escribo con tu revisión pronto. 🚀", true);
          if (btn) btn.textContent = "Enviado ✓";
        } else {
          if (btn) { btn.disabled = false; btn.textContent = "Quiero mi revisión gratis"; }
          show("No se pudo enviar. Escríbeme directo por WhatsApp o inténtalo de nuevo.", false);
        }
      })
      .catch(function () {
        if (btn) { btn.disabled = false; btn.textContent = "Quiero mi revisión gratis"; }
        show("Sin conexión con el servidor. Inténtalo de nuevo en un momento.", false);
      });
  });
})();
