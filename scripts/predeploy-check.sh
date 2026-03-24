#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_URL="http://localhost:4000"
SERVER_PID=""

cleanup() {
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "[1/5] Validando arquivos essenciais..."
required_files=(
  "index.html"
  "products.html"
  "product-details.html"
  "login.html"
  "script.js"
  "style.css"
  "api/index.js"
  "backend/server.js"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "$ROOT_DIR/$file" ]]; then
    echo "ERRO: arquivo obrigatorio ausente: $file"
    exit 1
  fi
done

echo "[2/5] Validando meta viewport nas paginas HTML..."
while IFS= read -r html_file; do
  if ! grep -q '<meta name="viewport"' "$html_file"; then
    echo "ERRO: viewport ausente em ${html_file#$ROOT_DIR/}"
    exit 1
  fi
done < <(find "$ROOT_DIR" -maxdepth 1 -name "*.html" | sort)

echo "[3/5] Validando fluxo de troca Entrar/Cadastrar..."
if ! grep -q 'data-switch-mode="signup"' "$ROOT_DIR/login.html"; then
  echo "ERRO: botao de cadastro rapido ausente em login.html"
  exit 1
fi
if ! grep -q 'querySelectorAll("\[data-switch-mode\]")' "$ROOT_DIR/script.js"; then
  echo "ERRO: listeners de troca de modo ausentes em script.js"
  exit 1
fi

echo "[4/5] Garantindo API local ativa..."
api_ready() {
  local response
  response="$(curl -sS -X POST "$API_URL/api/auth/captcha" -H "Content-Type: application/json" || true)"
  [[ "$response" == *"challengeId"* ]]
}

if ! api_ready; then
  (
    cd "$ROOT_DIR"
    node backend/server.js
  ) >/tmp/bunnybites-predeploy-api.log 2>&1 &
  SERVER_PID=$!

  for _ in {1..25}; do
    if api_ready; then
      break
    fi
    sleep 1
  done

  if ! api_ready; then
    echo "ERRO: API nao iniciou corretamente. Log: /tmp/bunnybites-predeploy-api.log"
    exit 1
  fi
fi

echo "[5/5] Executando smoke test de carrinho/wishlist..."
(
  cd "$ROOT_DIR"
  bash test-cart-wishlist.sh
)

echo "OK: checklist de predeploy concluido com sucesso."
