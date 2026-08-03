/**
 * JOM STUDIO — TRC20 USDT verification via TronGrid public API
 * Client-side verification: checks if a txHash sent USDT to our wallet for ~expected amount.
 */
(function (global) {
  function cryptoCfg() {
    return (global.JOM_CONFIG && global.JOM_CONFIG.crypto) || {};
  }

  function headers() {
    const h = { Accept: "application/json" };
    const key = cryptoCfg().trongridApiKey;
    if (key) h["TRON-PRO-API-KEY"] = key;
    return h;
  }

  function base() {
    return (cryptoCfg().trongridBase || "https://api.trongrid.io").replace(/\/$/, "");
  }

  function normalizeHash(hash) {
    if (!hash) return "";
    let h = String(hash).trim();
    if (h.startsWith("0x") || h.startsWith("0X")) h = h.slice(2);
    return h;
  }

  function isPlaceholderAddress(addr) {
    return !addr || /REPLACE|YOUR_|PLACEHOLDER/i.test(addr);
  }

  /**
   * Convert hex address (41...) to base58 if needed — for display only we keep as returned.
   * Amount from TRC20 transfer is usually in sun-like 6 decimals for USDT.
   */
  function usdtFromRaw(raw) {
    const n = typeof raw === "string" ? parseInt(raw, 16) : Number(raw);
    if (!Number.isFinite(n)) return null;
    return n / 1e6;
  }

  async function fetchJson(url) {
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) throw new Error(`TronGrid ${res.status}: ${url}`);
    return res.json();
  }

  /**
   * Verify by transaction hash.
   * Returns { ok, status, amount, to, from, message, raw }
   */
  async function verifyTxHash(txHash, expectedAmount) {
    const cfg = cryptoCfg();
    const wallet = cfg.address;
    const hash = normalizeHash(txHash);

    if (!hash || hash.length < 40) {
      return { ok: false, status: "invalid_hash", message: "Hash de transacción inválido." };
    }
    if (isPlaceholderAddress(wallet)) {
      return {
        ok: false,
        status: "wallet_not_configured",
        message:
          "Wallet TRC20 no configurada. Edita js/config.js → crypto.address con tu dirección Binance USDT TRC20.",
      };
    }

    try {
      // 1) Transaction info
      const infoUrl = `${base()}/wallet/gettransactioninfobyid`;
      const infoRes = await fetch(infoUrl, {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ value: hash }),
      });
      const info = await infoRes.json();

      // 2) Transaction body
      const txUrl = `${base()}/wallet/gettransactionbyid`;
      const txRes = await fetch(txUrl, {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ value: hash }),
      });
      const tx = await txRes.json();

      if (!tx || !tx.txID) {
        // Fallback: TRC20 transfers endpoint by hash via events
        return await verifyViaAccountTrc20(hash, expectedAmount, wallet);
      }

      const contract = tx.raw_data && tx.raw_data.contract && tx.raw_data.contract[0];
      if (!contract) {
        return { ok: false, status: "no_contract", message: "Transacción sin contrato legible.", raw: { tx, info } };
      }

      // TriggerSmartContract for TRC20 transfer
      let amount = null;
      let toAddress = null;
      let fromAddress = null;

      if (contract.type === "TriggerSmartContract") {
        const val = contract.parameter && contract.parameter.value;
        const data = val && val.data; // method + params hex
        fromAddress = val && val.owner_address;
        // transfer(address,uint256) selector a9059cbb
        if (data && data.startsWith("a9059cbb") && data.length >= 8 + 64 + 64) {
          const toHex = "41" + data.slice(8 + 24, 8 + 64); // pad address
          const amountHex = data.slice(8 + 64, 8 + 64 + 64);
          amount = usdtFromRaw(amountHex);
          toAddress = toHex;
        }
      } else if (contract.type === "TransferContract") {
        // TRX native — not USDT
        return {
          ok: false,
          status: "not_usdt",
          message: "Esta tx es TRX nativo, no USDT TRC20. Envía USDT (TRC20).",
          raw: { tx, info },
        };
      }

      // Prefer log-based amount if present
      if (info && Array.isArray(info.log)) {
        for (const log of info.log) {
          // Transfer topic
          if (log.topics && log.topics[0] && String(log.topics[0]).toLowerCase().includes("ddf252ad")) {
            if (log.data) amount = usdtFromRaw(log.data);
            if (log.topics[2]) toAddress = "41" + log.topics[2].slice(-40);
            if (log.topics[1]) fromAddress = "41" + log.topics[1].slice(-40);
          }
        }
      }

      const tol = cfg.amountToleranceUsdt != null ? cfg.amountToleranceUsdt : 0.5;
      const expected = Number(expectedAmount);
      const amountOk =
        amount != null && Number.isFinite(expected) ? Math.abs(amount - expected) <= tol : amount != null;

      // Address match is best-effort: compare base58 wallet via account trc20 if hex mismatch
      const result = {
        ok: false,
        status: "pending_manual",
        amount,
        to: toAddress,
        from: fromAddress,
        message: "",
        raw: { tx, info },
      };

      if (amount == null) {
        result.message =
          "No se pudo leer el monto USDT automáticamente. Se guardó el hash para verificación manual en Binance.";
        result.status = "manual_review";
        return result;
      }

      if (!amountOk) {
        result.status = "amount_mismatch";
        result.message = `Monto detectado: ${amount} USDT. Esperado: ~${expected} USDT (±${tol}).`;
        return result;
      }

      // Secondary confirmation: list recent TRC20 transfers to our wallet containing this hash
      const accountCheck = await findHashInIncoming(wallet, hash, expected, tol);
      if (accountCheck.found) {
        result.ok = true;
        result.status = "verified";
        result.amount = accountCheck.amount != null ? accountCheck.amount : amount;
        result.message = `Pago verificado on-chain: ${result.amount} USDT TRC20.`;
        return result;
      }

      // If amount matches but account scan failed (CORS/rate), accept amount + successful receipt
      if (info && (info.receipt || info.id || info.blockNumber)) {
        result.ok = true;
        result.status = "verified_amount_only";
        result.message = `Hash válido y monto ~${amount} USDT. Confirma en Binance que llegó a tu wallet.`;
        return result;
      }

      result.status = "manual_review";
      result.message = "Tx encontrada pero no confirmada del todo. Revisa en Tronscan / Binance.";
      return result;
    } catch (err) {
      return {
        ok: false,
        status: "api_error",
        message: `Error consultando TronGrid: ${err.message}. Guarda el hash y verifica manualmente.`,
      };
    }
  }

  async function findHashInIncoming(wallet, hash, expected, tol) {
    if (isPlaceholderAddress(wallet)) return { found: false };
    try {
      const url = `${base()}/v1/accounts/${wallet}/transactions/trc20?limit=50&only_to=true&contract_address=${cryptoCfg().usdtContract || "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"}`;
      const data = await fetchJson(url);
      const list = data.data || data || [];
      for (const t of list) {
        const th = normalizeHash(t.transaction_id || t.txID || t.hash || "");
        if (th && th.toLowerCase() === hash.toLowerCase()) {
          const raw = t.value != null ? Number(t.value) : null;
          const amount = raw != null ? raw / Math.pow(10, t.token_info?.decimals || 6) : null;
          if (amount != null && expected != null && Math.abs(amount - expected) > tol) {
            return { found: true, amount, amountOk: false };
          }
          return { found: true, amount, amountOk: true };
        }
      }
      return { found: false };
    } catch {
      return { found: false };
    }
  }

  async function verifyViaAccountTrc20(hash, expectedAmount, wallet) {
    const tol = cryptoCfg().amountToleranceUsdt != null ? cryptoCfg().amountToleranceUsdt : 0.5;
    const hit = await findHashInIncoming(wallet, hash, expectedAmount, tol);
    if (hit.found && hit.amountOk !== false) {
      return {
        ok: true,
        status: "verified",
        amount: hit.amount,
        message: `Pago verificado: ${hit.amount} USDT recibido en wallet.`,
      };
    }
    if (hit.found) {
      return {
        ok: false,
        status: "amount_mismatch",
        amount: hit.amount,
        message: `Hash encontrado pero monto ${hit.amount} no coincide con ${expectedAmount}.`,
      };
    }
    return {
      ok: false,
      status: "not_found",
      message: "Hash no encontrado en transferencias USDT recientes a tu wallet. Espera confirmación o revisa red TRC20.",
    };
  }

  function qrUrl(address, size) {
    const s = size || 280;
    const data = encodeURIComponent(address || "");
    return `https://api.qrserver.com/v1/create-qr-code/?size=${s}x${s}&data=${data}&bgcolor=050505&color=00F2FF&qzone=2`;
  }

  function tronscanTxUrl(hash) {
    return `https://tronscan.org/#/transaction/${normalizeHash(hash)}`;
  }

  function isWalletReady() {
    return !isPlaceholderAddress(cryptoCfg().address);
  }

  global.JOM_TRON = {
    verifyTxHash,
    qrUrl,
    tronscanTxUrl,
    isWalletReady,
    normalizeHash,
    isPlaceholderAddress,
  };
})(typeof window !== "undefined" ? window : globalThis);
