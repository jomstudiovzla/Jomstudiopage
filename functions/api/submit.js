// ═══════════════════════════════════════════════════════════════════════════
// JOM STUDIO — Pages Function: recepción de leads/pedidos
// Ruta: POST /api/submit  (mismo origen que la web → CSP connect-src 'self' OK)
// Secretos SOLO en el panel de Cloudflare (Settings → Environment variables):
//   RESEND_API_KEY       obligatorio para email
//   RESEND_FROM          from verificado, ej. JOM Studio <hola@jomstudio.site>
//   LEAD_TO              inbox que SÍ recibe. Hoy el dominio no tiene MX,
//                        así que el default sigue siendo jomstudiovzla@gmail.com.
//                        Cambia LEAD_TO a Jesus@jomstudio.site solo cuando
//                        Email Routing o un buzón real estén activos.
//   TURNSTILE_SECRET     opcional. Si existe, el token se verifica aquí.
//                        No hay sitekey en el frontend hasta que el CEO la cree.
//   N8N_WEBHOOK_URL      opcional
//   N8N_WEBHOOK_SECRET   opcional, header X-JOM-Secret
// ═══════════════════════════════════════════════════════════════════════════

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: JSON_HEADERS });

const ALLOWED_ORIGINS = new Set([
  "https://jomstudio.site",
  "https://www.jomstudio.site",
]);

const hits = new Map();

const isEmail = (s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) && s.length <= 254;
const clean = (v, max) =>
  String(v == null ? "" : v)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/<[^>]*>/g, "")
    .trim()
    .slice(0, max);
const esc = (s) => String(s).replace(/[<>&"']/g, (c) => ({
  "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;",
}[c]));

function originAllowed(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    if (url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) {
      return true;
    }
  } catch (_) {}
  return false;
}

function rateOk(ip) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const max = 8;
  const key = ip || "unknown";
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 4000) {
    const oldest = hits.keys().next().value;
    hits.delete(oldest);
  }
  return true;
}

function safePage(value) {
  const raw = clean(value, 300);
  if (!raw) return "https://jomstudio.site/";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return "https://jomstudio.site/";
    if (url.hostname !== "jomstudio.site" && url.hostname !== "www.jomstudio.site") {
      return "https://jomstudio.site/";
    }
    return url.origin + url.pathname + url.search;
  } catch (_) {
    return "https://jomstudio.site/";
  }
}

async function verifyTurnstile(secret, token, ip) {
  if (!secret) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip: ip || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    return !!(data && data.success);
  } catch (err) {
    console.error("turnstile_failed");
    return false;
  }
}

function brandHtml(title, rows, ctaHref, ctaLabel) {
  const row = (label, value) =>
    `<tr><td style="padding:15px 0;border-bottom:1px solid #1c1c1c;color:#7a7a7a;font-family:Arial,Helvetica,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;vertical-align:top;width:32%">${label}</td>` +
    `<td style="padding:15px 0;border-bottom:1px solid #1c1c1c;color:#f0f0f0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;vertical-align:top">${value}</td></tr>`;
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050505;margin:0;padding:26px 12px"><tr><td align="center">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#0e0e0e;border:1px solid #242424;border-radius:16px;overflow:hidden">` +
    `<tr><td align="center" style="background:#080808;padding:44px 24px 36px">` +
      `<div style="font-family:Arial,Helvetica,sans-serif;color:#ffffff;font-size:30px;font-weight:800;letter-spacing:2px">JOM</div>` +
      `<div style="font-family:Arial,Helvetica,sans-serif;color:#ffffff;font-size:13px;font-weight:400;letter-spacing:9px;margin-top:2px">STUDIO</div>` +
      `<div style="height:2px;width:44px;background:#C4A35A;margin:20px auto 0;font-size:0;line-height:2px;border-radius:2px">&nbsp;</div>` +
      `<div style="font-family:Arial,Helvetica,sans-serif;color:#C9A96A;font-size:11px;font-weight:700;letter-spacing:5px;margin-top:16px">ALQUIMIA&nbsp;DIGITAL</div>` +
    `</td></tr>` +
    `<tr><td style="padding:36px 38px 4px">` +
      `<div style="font-family:Georgia,'Times New Roman',serif;color:#ffffff;font-size:25px;font-weight:400">${esc(title)}</div>` +
    `</td></tr>` +
    `<tr><td style="padding:16px 38px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">` +
      rows.map(([label, value]) => row(esc(label), value)).join("") +
    `</table></td></tr>` +
    (ctaHref
      ? `<tr><td align="center" style="padding:32px 38px 40px"><a href="${ctaHref}" style="display:inline-block;background:#C4A35A;color:#0a0a0a;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:1.5px;text-decoration:none;padding:15px 40px;border-radius:9px">${esc(ctaLabel)}</a></td></tr>`
      : "") +
    `<tr><td align="center" style="background:#080808;padding:22px;border-top:1px solid #1c1c1c">` +
      `<div style="font-family:'Courier New',Courier,monospace;color:#555555;font-size:10px;letter-spacing:2px">JOM&nbsp;STUDIO&nbsp;&nbsp;·&nbsp;&nbsp;JOMSTUDIO.SITE</div>` +
    `</td></tr></table></td></tr></table>`
  );
}

async function sendMail(env, message) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });
  if (!res.ok) {
    console.error("resend_failed", res.status);
    return false;
  }
  return true;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = request.headers.get("Origin");
  if (!originAllowed(origin)) return json({ ok: false, error: "origin" }, 403);

  const ip = request.headers.get("CF-Connecting-IP") || "";
  if (!rateOk(ip)) return json({ ok: false, error: "rate_limited" }, 429);

  let raw = "";
  try {
    raw = await request.text();
  } catch (_) {
    return json({ ok: false, error: "bad_json" }, 400);
  }
  if (raw.length > 20000) return json({ ok: false, error: "too_large" }, 400);

  let data;
  try {
    data = JSON.parse(raw);
  } catch (_) {
    return json({ ok: false, error: "bad_json" }, 400);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return json({ ok: false, error: "bad_json" }, 400);
  }

  if (clean(data.company_website, 200)) return json({ ok: true, spam: true }, 200);

  const turnstileOk = await verifyTurnstile(
    env.TURNSTILE_SECRET,
    clean(data.turnstileToken || data["cf-turnstile-response"], 2048),
    ip
  );
  if (!turnstileOk) return json({ ok: false, error: "turnstile" }, 400);

  const name = clean(data.name, 100);
  const email = clean(data.email, 254);
  const brief = clean(data.brief != null ? data.brief : data.briefText || data.message, 3000);
  const channel = clean(data.channel, 40) || "web";
  const productId = clean(data.productId, 80);
  const kindRaw = clean(data.kind, 40) || "brief";
  const kind = /^[a-z0-9_-]+$/i.test(kindRaw) ? kindRaw : "brief";
  const page = safePage(data.page);

  if (!name || !email || !brief) return json({ ok: false, error: "missing_fields" }, 400);
  if (!isEmail(email)) return json({ ok: false, error: "bad_email" }, 400);
  if ((kind === "brief" || kind === "lead") && (name.length < 2 || brief.length < 10)) {
    return json({ ok: false, error: "missing_fields" }, 400);
  }

  const at = new Date().toISOString();
  let fechaLocal = at;
  try {
    fechaLocal = new Date(at).toLocaleString("es-VE", {
      timeZone: "America/Caracas",
      dateStyle: "long",
      timeStyle: "short",
    });
  } catch (_) {}

  const from = env.RESEND_FROM || "JOM Studio <hola@jomstudio.site>";
  const leadTo = env.LEAD_TO || "jomstudiovzla@gmail.com";
  const country = (request.cf && request.cf.country) || "";

  let emailOk = false;
  let emailSkipped = true;
  if (env.RESEND_API_KEY) {
    emailSkipped = false;
    const subject = (kind === "order" || kind === "order_placed")
      ? `Nuevo pedido web — ${name}`
      : `Nuevo brief web — ${name}`;
    const text =
      `Nuevo ${kind} desde jomstudio.site\n\n` +
      `Nombre / empresa: ${name}\n` +
      `Correo: ${email}\n` +
      (productId ? `Paquete: ${productId}\n` : "") +
      `Canal elegido: ${channel}\n` +
      `Fecha: ${fechaLocal}\n` +
      `Página de origen: ${page}\n` +
      `País / IP: ${country} / ${ip}\n\n` +
      `Mensaje:\n${brief}\n\n` +
      `Acción: responder por el canal elegido.\n`;
    const htmlRows = [
      ["Nombre", `<strong style="color:#ffffff">${esc(name)}</strong>`],
      ["Email", `<a href="mailto:${esc(email)}" style="color:#2EC4B6;text-decoration:none">${esc(email)}</a>`],
      ["Canal", esc(channel)],
      ["Fecha", esc(fechaLocal)],
      ["Página", `<a href="${esc(page)}" style="color:#2EC4B6;text-decoration:none">${esc(page)}</a>`],
      ["Mensaje", `<span style="white-space:pre-wrap">${esc(brief)}</span>`],
    ];
    if (productId) htmlRows.splice(3, 0, ["Paquete", esc(productId)]);
    const html = brandHtml(
      "Nuevo " + (kind === "order" || kind === "order_placed" ? "pedido" : "brief"),
      htmlRows.filter((row) => row[1]),
      `mailto:${esc(email)}`,
      "RESPONDER AL CLIENTE"
    );
    try {
      emailOk = await sendMail(env, {
        from,
        to: [leadTo],
        reply_to: email,
        subject,
        text,
        html,
      });
    } catch (_) {
      console.error("resend_failed", "network");
      emailOk = false;
    }

    if (emailOk && (kind === "brief" || kind === "lead" || kind === "order" || kind === "order_placed")) {
      const autoText =
        `Hola ${name},\n\n` +
        `Recibimos tu mensaje en jomstudio.site. Lo revisamos y te respondemos a este correo.\n` +
        `Si elegiste WhatsApp, puedes continuar la conversación por ese canal.\n\n` +
        `JOM STUDIO\nhttps://jomstudio.site\n`;
      const autoHtml = brandHtml("Brief recibido", [
        ["Hola", esc(name)],
        ["Estado", "Quedó registrado. Te respondemos a este correo."],
      ], "https://jomstudio.site/", "JOM STUDIO");
      try {
        const autoOk = await sendMail(env, {
          from,
          to: [email],
          reply_to: leadTo,
          subject: "Recibimos tu brief — JOM STUDIO",
          text: autoText,
          html: autoHtml,
        });
        if (!autoOk) console.error("autoresponse_failed");
      } catch (_) {
        console.error("autoresponse_failed");
      }
    }
  }

  let webhookOk = false;
  let webhookSkipped = true;
  if (env.N8N_WEBHOOK_URL) {
    webhookSkipped = false;
    try {
      const headers = { "Content-Type": "application/json" };
      if (env.N8N_WEBHOOK_SECRET) headers["X-JOM-Secret"] = env.N8N_WEBHOOK_SECRET;
      const payload = {
        kind, brand: "JOM STUDIO", name, email, brief, channel, productId, page, at,
      };
      const hook = await fetch(env.N8N_WEBHOOK_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      webhookOk = hook.ok;
      if (!hook.ok) console.error("webhook_failed", hook.status);
    } catch (_) {
      console.error("webhook_failed");
    }
  }

  const anyConfigured = !emailSkipped || !webhookSkipped;
  const ok = anyConfigured ? !!(emailOk || webhookOk) : true;
  return json({ ok, message: ok ? "received" : "delivery_failed" }, 200);
}

export async function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return json({ ok: false, error: "method_not_allowed" }, 405);
}
