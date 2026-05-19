#!/bin/bash

# Script para criar um primeiro usuário de teste
# Uso: ./create-test-user.sh

API_URL="http://localhost:3001"
EMAIL="test@example.com"
PASSWORD="test123456"
NAME="Test User"

echo "📝 Criando usuário de teste..."

RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\",
    \"name\": \"$NAME\"
  }")

TOKEN=$(echo $RESPONSE | jq -r '.access_token')
USER_ID=$(echo $RESPONSE | jq -r '.user.id')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Erro ao criar usuário"
  echo "Resposta: $RESPONSE"
  exit 1
fi

echo "✅ Usuário criado com sucesso!"
echo ""
echo "📋 Informações:"
echo "   Email: $EMAIL"
echo "   Password: $PASSWORD"
echo "   User ID: $USER_ID"
echo ""
echo "🔐 Token JWT (válido por 7 dias):"
echo "   $TOKEN"
echo ""
echo "💾 Salve essas informações para usar nos testes"
echo "   export TOKEN='$TOKEN'"
echo "   export EMAIL='$EMAIL'"
echo "   export USER_ID='$USER_ID'"
