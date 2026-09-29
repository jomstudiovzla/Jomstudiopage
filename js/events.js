/* Eventos de conversión en el propio sitio. Sin nombre, correo ni mensaje. */
(function (global) {
  "use strict";
  var ALLOW = {
    view_home: 1,
    view_services: 1,
    view_project: 1,
    view_pricing: 1,
    view_order: 1,
    click_whatsapp: 1,
    click_instagram: 1,
    click_email: 1,
    click_launch_kit: 1,
    click_spark: 1,
    click_similar: 1,
    form_start: 1,
    form_submit_success: 1,
    form_submit_error: 1,
    turnstile_failed: 1,
    open_repository: 1,
    download_resource: 1
  };

  function track(name) {
    if (!ALLOW[name]) return;
    try {
      var log = JSON.parse(localStorage.getItem("jom_events") || "[]");
      if (!Array.isArray(log)) log = [];
      log.push({ e: name, p: location.pathname, t: Date.now() });
      if (log.length > 200) log = log.slice(log.length - 200);
      localStorage.setItem("jom_events", JSON.stringify(log));
    } catch (_) {}
    try {
      var body = JSON.stringify({ event: name, path: location.pathname });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/event", new Blob([body], { type: "application/json" }));
      } else {
        fetch("/api/event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body,
          keepalive: true
        }).catch(function () {});
      }
    } catch (_) {}
  }

  function pageView() {
    var path = (location.pathname || "/").replace(/\/+$/, "") || "/";
    var file = path.split("/").pop() || "";
    if (path === "/" || file === "" || file === "index.html") track("view_home");
    else if (file === "services" || file === "services.html") track("view_pricing");
    else if (file === "order" || file === "order.html") track("view_order");
    else if (file === "repository" || file === "repository.html") track("view_project");
  }

  function bind() {
    pageView();
    var services = document.getElementById("services");
    if (services && "IntersectionObserver" in global) {
      var seen = false;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !seen) {
            seen = true;
            track("view_services");
            io.disconnect();
          }
        });
      }, { threshold: 0.35 });
      io.observe(services);
    }
    document.addEventListener("click", function (ev) {
      var node = ev.target;
      var a = node && node.closest ? node.closest("a") : null;
      if (!a) return;
      var href = a.getAttribute("href") || "";
      if (href.indexOf("wa.me/") !== -1) track("click_whatsapp");
      else if (href.indexOf("instagram.com") !== -1) track("click_instagram");
      else if (href.indexOf("mailto:") === 0) track("click_email");
      else if (href.indexOf("product=launch") !== -1) track("click_launch_kit");
      else if (href.indexOf("product=spark") !== -1) track("click_spark");
      else if (href.indexOf("repository") !== -1) track("open_repository");
      else if (/\.pdf($|\?)/.test(href) || a.hasAttribute("download")) track("download_resource");
    });
    ["project-brief-form", "lead-form"].forEach(function (id) {
      var form = document.getElementById(id);
      if (!form) return;
      var once = function () {
        track("form_start");
        form.removeEventListener("focusin", once);
      };
      form.addEventListener("focusin", once);
    });
  }

  global.JOM_EVENTS = { track: track };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})(typeof window !== "undefined" ? window : globalThis);
