#!/usr/bin/env bash
# Deploy JOM STUDIO commerce stack to GitHub Pages (jomstudiovzla/Jomstudiopage)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "==> Pre-flight checks"
if grep -q "REPLACE_WITH_YOUR_TRC20_USDT_ADDRESS" js/config.js; then
  echo "⚠️  WARNING: crypto.address still placeholder in js/config.js"
  echo "    Sales will show a config warning until you paste your Binance TRC20 USDT address."
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "No git remote. Add origin first."
  exit 1
fi

echo "==> Status"
git status -sb

echo ""
echo "This will commit ALL commerce changes and push to origin main."
read -r -p "Continue? [y/N] " ans
if [[ "${ans:-}" != "y" && "${ans:-}" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

git add -A
git commit -m "$(cat <<'EOF'
feat(commerce): USDT checkout, pricing, CRM ops, Tron verify

Wire Launch Kit funnel: services/order/success pages, local CRM,
TRC20 verification via TronGrid, WhatsApp/Formspree hooks, and
CTAs across home + repository.
EOF
)" || echo "(nothing new to commit)"

git push origin HEAD:main
echo "==> Pushed. GitHub Pages will refresh in 1–3 min."
echo "    https://jomstudiovzla.github.io/Jomstudiopage/"
echo "    https://jomstudiovzla.github.io/Jomstudiopage/services.html"
echo "    https://jomstudiovzla.github.io/Jomstudiopage/order.html?product=launch"
echo "    https://jomstudiovzla.github.io/Jomstudiopage/admin-ops.html"
