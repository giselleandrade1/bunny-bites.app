#!/bin/bash

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API="http://localhost:4000"
JWT_TOKEN=""
CART_ITEM_ID=""
WISHLIST_ITEM_ID=""

echo -e "${YELLOW}=== TESTE DE PERSISTÊNCIA CART/WISHLIST ===${NC}\n"

# 1. GERAR CAPTCHA
echo -e "${YELLOW}1. Gerando CAPTCHA...${NC}"
CAPTCHA_RESPONSE=$(curl -s -X POST "$API/api/auth/captcha" \
  -H "Content-Type: application/json")
CAPTCHA_ID=$(echo "$CAPTCHA_RESPONSE" | grep -o '"challengeId":"[^"]*' | cut -d'"' -f4)
CAPTCHA_PROMPT=$(echo "$CAPTCHA_RESPONSE" | grep -o '"prompt":"[^"]*' | cut -d'"' -f4)
echo "Desafio: $CAPTCHA_PROMPT"
echo "Challenge ID: $CAPTCHA_ID"

# Extrair a resposta do desafio (ex: "Quanto e 3 + 5?" -> resposta é 8)
CAPTCHA_ANSWER=$(echo "$CAPTCHA_PROMPT" | sed 's/Quanto e \([0-9]*\) + \([0-9]*\)?.*/\1 + \2/' | bc)
echo -e "Resposta: ${CAPTCHA_ANSWER}\n"

# 2. REGISTRAR USUÁRIO
echo -e "${YELLOW}2. Registrando novo usuário...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "$API/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Teste Cart Wishlist\",
    \"email\": \"cart.test+$(date +%s)@example.com\",
    \"password\": \"Password123!\",
    \"captchaChallengeId\": \"$CAPTCHA_ID\",
    \"captchaAnswer\": \"$CAPTCHA_ANSWER\"
  }")

JWT_TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
if [ -z "$JWT_TOKEN" ]; then
  echo -e "${RED}Erro ao registrar usuário${NC}"
  echo "$REGISTER_RESPONSE"
  exit 1
fi
echo "JWT Token: ${JWT_TOKEN:0:20}..."
echo -e ""

# 3. ADICIONAR ITEM AO CARRINHO
echo -e "${YELLOW}3. Adicionando item ao carrinho...${NC}"
ADD_CART_RESPONSE=$(curl -s -X POST "$API/api/cart/add" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d "{
    \"productName\": \"Ovo Chocolate Classico\",
    \"productPrice\": 74.90,
    \"quantity\": 1
  }")
echo "$ADD_CART_RESPONSE"
echo -e ""

# 4. OBTER CARRINHO
echo -e "${YELLOW}4. Obtendo carrinho...${NC}"
CART_RESPONSE=$(curl -s -X GET "$API/api/cart" \
  -H "Authorization: Bearer $JWT_TOKEN")
echo "$CART_RESPONSE"
CART_ITEM_ID=$(echo "$CART_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
echo -e "ID do item no carrinho: $CART_ITEM_ID\n"

# 5. CHECKOUT E LIMPEZA DO CARRINHO
echo -e "${YELLOW}5. Finalizando checkout...${NC}"
CHECKOUT_RESPONSE=$(curl -s -X POST "$API/api/checkout" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "items": [
      {"id": "prod-1", "name": "Ovo Chocolate Classico", "price": 74.90, "quantity": 1}
    ]
  }')
echo "$CHECKOUT_RESPONSE"
echo -e ""

# 6. VALIDAR CARRINHO APÓS CHECKOUT
echo -e "${YELLOW}6. Validando carrinho após checkout...${NC}"
POST_CHECKOUT_CART=$(curl -s -X GET "$API/api/cart" \
  -H "Authorization: Bearer $JWT_TOKEN")
echo "$POST_CHECKOUT_CART"
echo -e ""

# 7. ADICIONAR ITEM À WISHLIST
echo -e "${YELLOW}7. Adicionando item à wishlist...${NC}"
ADD_WISHLIST_RESPONSE=$(curl -s -X POST "$API/api/wishlist/add" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d "{
    \"productName\": \"Ovo Trufado Avela\",
    \"productPrice\": 109.90
  }")
echo "$ADD_WISHLIST_RESPONSE"
echo -e ""

# 8. OBTER WISHLIST
echo -e "${YELLOW}8. Obtendo wishlist...${NC}"
WISHLIST_RESPONSE=$(curl -s -X GET "$API/api/wishlist" \
  -H "Authorization: Bearer $JWT_TOKEN")
echo "$WISHLIST_RESPONSE"
WISHLIST_ITEM_ID=$(echo "$WISHLIST_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
echo -e "ID do item na wishlist: $WISHLIST_ITEM_ID\n"

# 9. ADICIONAR ITEM AO CARRINHO PARA TESTE DE REMOÇÃO
echo -e "${YELLOW}9. Adicionando novo item ao carrinho para remoção...${NC}"
ADD_CART_REMOVE_FLOW=$(curl -s -X POST "$API/api/cart/add" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "productName": "Ovo Recheado de Brigadeiro",
    "productPrice": 99.90,
    "quantity": 1
  }')
echo "$ADD_CART_REMOVE_FLOW"
echo -e ""

CART_FOR_REMOVE=$(curl -s -X GET "$API/api/cart" -H "Authorization: Bearer $JWT_TOKEN")
CART_ITEM_ID=$(echo "$CART_FOR_REMOVE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

# 10. REMOVER ITEM DO CARRINHO
echo -e "${YELLOW}10. Removendo item do carrinho...${NC}"
if [ -n "$CART_ITEM_ID" ]; then
  REMOVE_CART=$(curl -s -X DELETE "$API/api/cart/remove/$CART_ITEM_ID" \
    -H "Authorization: Bearer $JWT_TOKEN")
  echo "$REMOVE_CART"
fi
echo -e ""

# 11. REMOVER ITEM DA WISHLIST
echo -e "${YELLOW}11. Removendo item da wishlist...${NC}"
if [ -n "$WISHLIST_ITEM_ID" ]; then
  REMOVE_WISHLIST=$(curl -s -X DELETE "$API/api/wishlist/remove/$WISHLIST_ITEM_ID" \
    -H "Authorization: Bearer $JWT_TOKEN")
  echo "$REMOVE_WISHLIST"
fi
echo -e ""

# 12. VALIDAR CARRINHO VAZIO
echo -e "${YELLOW}12. Validando carrinho após remoção...${NC}"
FINAL_CART=$(curl -s -X GET "$API/api/cart" \
  -H "Authorization: Bearer $JWT_TOKEN")
echo "$FINAL_CART"
echo -e ""

# 13. VALIDAR WISHLIST VAZIA
echo -e "${YELLOW}13. Validando wishlist após remoção...${NC}"
FINAL_WISHLIST=$(curl -s -X GET "$API/api/wishlist" \
  -H "Authorization: Bearer $JWT_TOKEN")
echo "$FINAL_WISHLIST"

echo -e "\n${GREEN}=== TESTES COMPLETADOS ===${NC}"
