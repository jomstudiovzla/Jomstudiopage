// Eventos de conversión sin datos personales. No envía correo.
// POST /api/event  { event, path }  → 204

const ALLOWED = new Set([
  "view_home",
  "view_services",
  "view_project",
  "view_pricing",
  "view_order",
  "click_whatsapp",
  "click_instagram",
  "click_email",
  "click_launch_kit",
  "click_spark",
  "click_similar",
  "form_start",
  "form_submit_success",
  "form_submit_error",
  "turnstile_failed",
  "open_repository",
  "download_resource",
]);

const ALLOWED_ORIGINS = new Set([
  "https://jomstudio.site",
  "https://www.jomstudio.site",
]);

const hits = new Map();

function originAllowed(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  } catch (_) {
    return false;
  }
}

function rateOk(ip) {
  const now = Date.now();
  const key = ip || "unknown";
  const recent = (hits.get(key) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (recent.length >= 120) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

export async function onRequestPost(context) {
  const { request } = context;
  if (!originAllowed(request.headers.get("Origin"))) {
    return new Response(null, { status: 403 });
  }
  const ip = request.headers.get("CF-Connecting-IP") || "";
  if (!rateOk(ip)) return new Response(null, { status: 429 });

  let data = {};
  try {
    const raw = await request.text();
    if (raw && raw.length <= 500) data = JSON.parse(raw);
  } catch (_) {
    data = {};
  }
  const event = String((data && data.event) || "").slice(0, 40);
  if (!ALLOWED.has(event)) return new Response(null, { status: 204 });
  return new Response(null, { status: 204 });
}

export async function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return new Response(null, { status: 405 });
}
