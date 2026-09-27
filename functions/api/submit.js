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
    let fechaLocal = at;
    try {
      fechaLocal = new Date(at).toLocaleString("es-VE", { timeZone: "America/Caracas", dateStyle: "long", timeStyle: "short" });
    } catch (_) {}
    const row = (label, value) =>
      `<tr><td style="padding:15px 0;border-bottom:1px solid #1c1c1c;color:#7a7a7a;font-family:Arial,Helvetica,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;vertical-align:top;width:32%">${label}</td>` +
      `<td style="padding:15px 0;border-bottom:1px solid #1c1c1c;color:#f0f0f0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;vertical-align:top">${value}</td></tr>`;
    const html =
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050505;margin:0;padding:26px 12px"><tr><td align="center">` +
      `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#0e0e0e;border:1px solid #242424;border-radius:16px;overflow:hidden">` +
      `<tr><td align="center" style="background:#080808;padding:40px 24px 34px">` +
        `<img src="https://jomstudio.site/assets/email-logo.png" alt="JOM STUDIO" width="180" style="display:block;margin:0 auto;width:180px;max-width:180px;height:auto"/>` +
        `<div style="height:1px;width:50px;background:#C4A35A;margin:22px auto 0;font-size:0;line-height:1px">&nbsp;</div>` +
        `<div style="font-family:'Courier New',Courier,monospace;color:#2EC4B6;font-size:10px;letter-spacing:3px;margin-top:14px">ALQUIMIA DIGITAL</div>` +
      `</td></tr>` +
      `<tr><td style="padding:34px 38px 6px">` +
        `<div style="font-family:Georgia,'Times New Roman',serif;color:#ffffff;font-size:24px">Nuevo ${kind === "order" ? "pedido" : "lead"}</div>` +
        `<div style="font-family:Arial,Helvetica,sans-serif;color:#7a7a7a;font-size:12px;letter-spacing:.5px;margin-top:6px">Recibido desde jomstudio.site</div>` +
      `</td></tr>` +
      `<tr><td style="padding:16px 38px 8px">` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">` +
          row("Nombre", `<strong style="color:#ffffff">${esc(name)}</strong>`) +
          row("Email", `<a href="mailto:${esc(email)}" style="color:#2EC4B6;text-decoration:none">${esc(email)}</a>`) +
          (productId ? row("Paquete", esc(productId)) : "") +
          row("Mensaje", `<span style="white-space:pre-wrap">${esc(brief)}</span>`) +
          row("Canal", esc(channel)) +
          row("Fecha", esc(fechaLocal)) +
        `</table>` +
      `</td></tr>` +
      `<tr><td align="center" style="padding:32px 38px 40px">` +
        `<a href="mailto:${esc(email)}" style="display:inline-block;background:#C4A35A;color:#0a0a0a;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:1.5px;text-decoration:none;padding:15px 40px;border-radius:9px">RESPONDER AL CLIENTE</a>` +
      `</td></tr>` +
      `<tr><td align="center" style="background:#080808;padding:22px;border-top:1px solid #1c1c1c">` +
        `<div style="font-family:'Courier New',Courier,monospace;color:#555555;font-size:10px;letter-spacing:2px">JOM&nbsp;STUDIO&nbsp;&nbsp;·&nbsp;&nbsp;JOMSTUDIO.SITE</div>` +
      `</td></tr>` +
      `</table></td></tr></table>`;
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: env.RESEND_FROM || "JOM Studio <hola@jomstudio.site>",
          to: [env.LEAD_TO || "jomstudiovzla@gmail.com"],
          reply_to: email,
          subject,
          text,
          html,
        }),
      });
      if (r.ok) {
        email_result = { ok: true, status: r.status };
      } else {
        const detail = await r.text().catch(() => "");
        email_result = { ok: false, status: r.status, detail: detail.slice(0, 400) };
      }
    } catch (e) {
      email_result = { ok: false, error: String((e && e.message) || e) };
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
  // No devolver 5xx: Cloudflare intercepta los 5xx y reemplaza el cuerpo por su página de error.
  // El formulario usa la bandera `ok` del cuerpo, no el status HTTP.
  return json({ ok, email: email_result, webhook: webhook_result }, 200);
}

// Método no permitido para GET u otros
export async function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return json({ ok: false, error: "method_not_allowed" }, 405);
}
