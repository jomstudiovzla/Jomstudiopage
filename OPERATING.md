# JOM STUDIO — Sistema comercial operativo (USDT)

## Qué se construyó

Embudo completo de venta + cobro crypto + CRM local + verificación TRC20.

| URL | Función |
|-----|---------|
| `index.html` | Home + CTAs Launch Kit / Pricing + brief → CRM + WA |
| `services.html` | Catálogo de paquetes con precios USDT |
| `order.html?product=launch` | Checkout: orden + wallet + QR + hash + verify |
| `success.html?order=ORD-…` | Confirmación post-pago |
| `admin-ops.html` | Panel de órdenes / briefs / export JSON |
| `repository.html` | Dossier + barra de checkout fija |

### Paquetes (editables en `js/config.js`)

| ID | Nombre | Precio |
|----|--------|--------|
| `spark` | Micro Alchemy Spark | **200 USDT** |
| `launch` | Digital Alchemy Launch Kit | **300 USDT** |
| `engine` | Interactive Engine Build | **600 USDT** |
| `custom` | Strategic Custom | Quote → brief |

---

## Configuración obligatoria (antes de cobrar)

### 1. Wallet USDT TRC20

Archivo: `js/config.js` → `crypto.address`

1. Binance → Wallet → Deposit → **USDT** → Network **TRC20 / TRON**
2. Copia la dirección (empieza por `T`, 34 chars)
3. Pégala en `crypto.address` reemplazando el placeholder
4. Guarda y redeploy

El QR se genera solo con esa dirección (API qrserver).

### 2. WhatsApp / Email (ya conectados)

- WA: `584165159067` (site existente)
- Email: `jomstudiovzla@gmail.com`

### 3. Formspree (opcional — email automático)

1. Crea cuenta en https://formspree.io
2. Crea un form → copia endpoint `https://formspree.io/f/xxxxxxx`
3. Pégalo en `contact.formspreeEndpoint` en `js/config.js`

Sin Formspree el sistema sigue operando: **localStorage CRM + WhatsApp**.

### 4. Webhook (Make.com / n8n / Telegram bot)

`contact.notifyWebhook` = URL que reciba POST JSON en cada orden/brief.

### 5. Password Ops

`admin.password` en config (default `jom2026`) — **cámbialo**.

---

## Flujo del cliente

```
services.html  →  elige paquete
     ↓
order.html     →  datos + genera ORD-…
     ↓
paga USDT TRC20 en Binance a tu wallet
     ↓
pega Tx Hash  →  TronGrid verifica
     ↓
success.html  +  botón WhatsApp de confirmación
     ↓
tú ves la orden en admin-ops.html  →  status: verified / in_progress / delivered
```

## Flujo del operador (tú)

1. Abre `admin-ops.html` (password)
2. Cada orden nueva aparece con status
3. **Re-verify** si el hash llega tarde
4. Cambia status a `in_progress` → `delivered`
5. **Export JSON** backup diario

También: candado del Command Center en home muestra briefs + órdenes.

---

## Deploy a GitHub Pages

```bash
cd site   # este directorio es el clone de Jomstudiopage
# 1) Edita js/config.js (wallet + password)
chmod +x deploy.sh
./deploy.sh
```

O manual:

```bash
git add -A
git commit -m "feat: commerce USDT funnel"
git push origin main
```

Live en ~1–3 min:
- https://jomstudiovzla.github.io/Jomstudiopage/
- https://jomstudiovzla.github.io/Jomstudiopage/services.html
- https://jomstudiovzla.github.io/Jomstudiopage/order.html?product=launch

---

## Prueba local

```bash
cd site
python3 -m http.server 8080
# open http://localhost:8080/services.html
```

Nota: verificación TronGrid necesita red; CORS suele funcionar desde browser a api.trongrid.io.

---

## Archivos core

```
js/config.js     ← única fuente de verdad (precios, wallet, contactos)
js/crm.js        ← localStorage orders/briefs/events
js/tron.js       ← verify TxHash USDT TRC20
js/commerce.js   ← placeOrder, submitBrief, WA, Formspree
```

---

## Mensajes de venta listos

**WA cold:**
```
Hola — vi JOM STUDIO. Quiero el Launch Kit (300 USDT TRC20) para mi web. ¿Me pasas el checkout?
```

**Checkout link directo:**
```
https://jomstudiovzla.github.io/Jomstudiopage/order.html?product=launch
```

**Spark (entrada $200):**
```
https://jomstudiovzla.github.io/Jomstudiopage/order.html?product=spark
```
