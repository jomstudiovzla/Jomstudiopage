// ═══════════════════════════════════════════════════════════════════════════
// JOM STUDIO — Pages Function: recepción de leads/pedidos
// Ruta: POST /api/submit  (mismo origen que la web → CSP connect-src 'self' OK)
// Despliega SOLO con Cloudflare Pages (Git). Secretos como variables de entorno
// en el panel (Settings → Environment variables), NUNCA en el código:
//   RESEND_API_KEY      (obligatorio para email)   ej: re_xxx
//   RESEND_FROM         (from verificado en Resend) ej: "JOM Studio <hola@jomstudio.site>"
//   LEAD_TO             (destino)                   por defecto jomstudiovzla@gmail.com
//   N8N_WEBHOOK_URL     (opcional, CRM/automatización)
//   N8N_WEBHOOK_SECRET  (opcional, se envía como header X-JOM-Secret)
// ═══════════════════════════════════════════════════════════════════════════

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: JSON_HEADERS });

const isEmail = (s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
const clean = (v, max) => String(v == null ? "" : v).trim().slice(0, max);
const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));

export async function onRequestPost(context) {
  const { request, env } = context;

  // 1) Parseo defensivo
  let data;
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }

  // 2) Anti-spam: honeypot. Un bot rellena el campo oculto → aceptamos en silencio (200) y no notificamos.
  if (clean(data.company_website, 200)) return json({ ok: true, spam: true }, 200);

  // 3) Normalización + validación
  const name = clean(data.name, 200);
  const email = clean(data.email, 200);
  const brief = clean(data.brief != null ? data.brief : data.briefText, 5000);
  const channel = clean(data.channel, 20) || "web";
  const productId = clean(data.productId, 100);
  const kind = clean(data.kind, 20) || "brief";

  if (!name || !email || !brief) return json({ ok: false, error: "missing_fields" }, 400);
  if (!isEmail(email)) return json({ ok: false, error: "bad_email" }, 400);

  const at = new Date().toISOString();
  const meta = {
    ip: request.headers.get("CF-Connecting-IP") || "",
    ua: clean(request.headers.get("User-Agent"), 300),
    country: (request.cf && request.cf.country) || "",
  };
  const payload = { kind, brand: "JOM STUDIO", name, email, brief, channel, productId, at, meta };

  // 4) Email transaccional vía Resend (server-side; no expone la key al navegador)
  let email_result = { skipped: true };
  if (env.RESEND_API_KEY) {
    const subject = `Nuevo ${kind === "order" ? "PEDIDO" : "lead"} JOM STUDIO — ${name}`;
    const text =
      `Nuevo ${kind} desde jomstudio.site\n\n` +
      `Nombre/Empresa: ${name}\n` +
      `Email: ${email}\n` +
      (productId ? `Paquete: ${productId}\n` : "") +
      `Canal: ${channel}\n` +
      `Fecha: ${at}\n` +
      `País/IP: ${meta.country} / ${meta.ip}\n\n` +
      `Brief:\n${brief}\n`;
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: env.RESEND_FROM || "JOM Studio <onboarding@resend.dev>",
          to: [env.LEAD_TO || "jomstudiovzla@gmail.com"],
          reply_to: email,
          subject,
          text,
          html: `<pre style="font:14px/1.5 ui-monospace,monospace">${esc(text)}</pre>`,
        }),
      });
      email_result = { ok: r.ok, status: r.status };
    } catch (e) {
      email_result = { ok: false, error: String(e && e.message || e) };
    }
  }

  // 5) Webhook n8n (opcional) → CRM / automatización
  let webhook_result = { skipped: true };
  if (env.N8N_WEBHOOK_URL) {
    try {
      const headers = { "Content-Type": "application/json" };
      if (env.N8N_WEBHOOK_SECRET) headers["X-JOM-Secret"] = env.N8N_WEBHOOK_SECRET;
      const w = await fetch(env.N8N_WEBHOOK_URL, { method: "POST", headers, body: JSON.stringify(payload) });
      webhook_result = { ok: w.ok, status: w.status };
    } catch (e) {
      webhook_result = { ok: false, error: String(e && e.message || e) };
    }
  }

  // 6) Respuesta. ok=true si al menos un canal server-side confirmó, o si ninguno está configurado aún.
  const anyConfigured = !email_result.skipped || !webhook_result.skipped;
  const anyOk = email_result.ok || webhook_result.ok;
  const ok = anyConfigured ? !!anyOk : true;
  return json({ ok, email: email_result, webhook: webhook_result }, ok ? 200 : 502);
}

// Método no permitido para GET u otros
export async function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return json({ ok: false, error: "method_not_allowed" }, 405);
}
