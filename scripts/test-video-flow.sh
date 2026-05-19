#!/bin/bash

# Script para testar upload e download de vídeo
# Uso: ./test-video-flow.sh <path-to-video-file> <token>

if [ $# -lt 2 ]; then
  echo "Uso: ./test-video-flow.sh <path-to-video> <token>"
  echo "Exemplo: ./test-video-flow.sh video.mp4 'eyJhbGc...'"
  exit 1
fi

VIDEO_FILE="$1"
TOKEN="$2"
API_URL="http://localhost:3001"

echo "🎬 Testando fluxo de vídeo..."
echo "📁 Arquivo: $VIDEO_FILE"
echo ""

# 1. Upload
echo "1️⃣ Upload do vídeo..."
UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/videos/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$VIDEO_FILE")

JOB_ID=$(echo $UPLOAD_RESPONSE | jq -r '.id')
STATUS=$(echo $UPLOAD_RESPONSE | jq -r '.status')

if [ "$JOB_ID" == "null" ] || [ -z "$JOB_ID" ]; then
  echo "❌ Erro no upload"
  echo $UPLOAD_RESPONSE
  exit 1
fi

echo "✅ Upload realizado!"
echo "   Job ID: $JOB_ID"
echo "   Status: $STATUS"
echo ""

# 2. Aguardar processamento
echo "2️⃣ Aguardando processamento (máximo 60 segundos)..."
COUNTER=0
while [ $COUNTER -lt 60 ]; do
  LIST_RESPONSE=$(curl -s -X GET "$API_URL/videos/jobs" \
    -H "Authorization: Bearer $TOKEN")
  
  JOB_STATUS=$(echo $LIST_RESPONSE | jq -r ".jobs[] | select(.id == \"$JOB_ID\") | .status")
  PROGRESS=$(echo $LIST_RESPONSE | jq -r ".jobs[] | select(.id == \"$JOB_ID\") | .progress")
  
  echo "   [$COUNTER/60] Status: $JOB_STATUS | Progress: $PROGRESS%"
  
  if [ "$JOB_STATUS" == "COMPLETED" ]; then
    echo "✅ Processamento concluído!"
    break
  fi
  
  if [ "$JOB_STATUS" == "FAILED" ]; then
    echo "❌ Erro no processamento"
    ERROR=$(echo $LIST_RESPONSE | jq -r ".jobs[] | select(.id == \"$JOB_ID\") | .error")
    echo "   Erro: $ERROR"
    exit 1
  fi
  
  sleep 1
  COUNTER=$((COUNTER + 1))
done

if [ "$JOB_STATUS" != "COMPLETED" ]; then
  echo "⏱️ Timeout - processamento ainda em progresso"
  exit 1
fi

# 3. Download
echo ""
echo "3️⃣ Fazendo download..."
OUTPUT_FILE="output_${JOB_ID}.zip"

curl -s -X GET "$API_URL/videos/download/$JOB_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -o "$OUTPUT_FILE"

if [ -f "$OUTPUT_FILE" ]; then
  FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
  echo "✅ Download concluído!"
  echo "   Arquivo: $OUTPUT_FILE ($FILE_SIZE)"
  echo ""
  
  # Descompactar para ver o conteúdo
  unzip -l "$OUTPUT_FILE" | head -15
else
  echo "❌ Erro ao fazer download"
  exit 1
fi
