#!/bin/bash
# ============================================
# Recruitment Agent API — Test Script
# ============================================
# Usage: bash test-api.sh [sample.pdf]
# If no PDF is provided, file upload test is skipped.

BASE_URL="http://localhost:3000"
PDF_FILE="${1:-}"

echo "============================================"
echo "  Recruitment Agent API Tests"
echo "============================================"
echo ""

# -------------------------------------------
# 1. Health Check
# -------------------------------------------
echo "🔍 1. Health Check"
echo "   GET /"
curl -s "$BASE_URL/" | python3 -m json.tool
echo ""

# -------------------------------------------
# 2. Create Chat
# -------------------------------------------
echo "🆕 2. Create Chat"
echo "   POST /api/chats"
CHAT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/chats" \
  -H "Content-Type: application/json" \
  -d '{"title": "Software Engineer Drive 2026"}')

echo "$CHAT_RESPONSE" | python3 -m json.tool

# Extract chatId
CHAT_ID=$(echo "$CHAT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['chat']['id'])" 2>/dev/null)

if [ -z "$CHAT_ID" ]; then
  echo "❌ Failed to create chat. Is the server running? Is Firestore provisioned?"
  exit 1
fi

echo "   ✅ Chat ID: $CHAT_ID"
echo ""

# -------------------------------------------
# 3. List Chats
# -------------------------------------------
echo "📋 3. List Chats"
echo "   GET /api/chats"
curl -s "$BASE_URL/api/chats" | python3 -m json.tool
echo ""

# -------------------------------------------
# 4. Get Chat Details
# -------------------------------------------
echo "🔎 4. Get Chat Details"
echo "   GET /api/chats/$CHAT_ID"
curl -s "$BASE_URL/api/chats/$CHAT_ID" | python3 -m json.tool
echo ""

# -------------------------------------------
# 5. Get Messages
# -------------------------------------------
echo "💬 5. Get Chat Messages"
echo "   GET /api/chats/$CHAT_ID/messages"
curl -s "$BASE_URL/api/chats/$CHAT_ID/messages" | python3 -m json.tool
echo ""

# -------------------------------------------
# 6. Upload File (if PDF provided)
# -------------------------------------------
if [ -n "$PDF_FILE" ] && [ -f "$PDF_FILE" ]; then
  echo "📄 6. Upload JD File"
  echo "   POST /api/chats/$CHAT_ID/files"
  echo "   File: $PDF_FILE"
  UPLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/chats/$CHAT_ID/files" \
    -F "file=@$PDF_FILE")
  echo "$UPLOAD_RESPONSE" | python3 -m json.tool
  echo ""

  # -------------------------------------------
  # 7. List Files
  # -------------------------------------------
  echo "📁 7. List Files"
  echo "   GET /api/chats/$CHAT_ID/files"
  curl -s "$BASE_URL/api/chats/$CHAT_ID/files" | python3 -m json.tool
  echo ""

  # -------------------------------------------
  # 8. Generate Drive Data (should return questions)
  # -------------------------------------------
  echo "🤖 8. Generate Drive Data (initial — expect questions)"
  echo "   POST /api/chats/$CHAT_ID/generate"
  GENERATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/chats/$CHAT_ID/generate" \
    -H "Content-Type: application/json" \
    -d '{"message": "Generate the recruitment drive from uploaded JD"}')
  echo "$GENERATE_RESPONSE" | python3 -m json.tool
  echo ""

  # -------------------------------------------
  # 9. Submit Answers (example)
  # -------------------------------------------
  echo "📝 9. Submit Answers"
  echo "   POST /api/chats/$CHAT_ID/generate (with answers)"
  ANSWERS_RESPONSE=$(curl -s -X POST "$BASE_URL/api/chats/$CHAT_ID/generate" \
    -H "Content-Type: application/json" \
    -d '{
      "answers": {
        "setupDetails.candidateType": "freshers",
        "setupDetails.numberOfVacancies": 10,
        "positionDetails.employmentType": "full_time",
        "positionDetails.locationType": "hybrid",
        "positionDetails.locationDetails": "Bangalore, India",
        "positionDetails.salaryPackage": "8-12 LPA",
        "eligibilityCriteria.eligibleCourses": ["B.Tech", "M.Tech", "MCA"]
      }
    }')
  echo "$ANSWERS_RESPONSE" | python3 -m json.tool
  echo ""

  # -------------------------------------------
  # 10. Get Current Drive Data
  # -------------------------------------------
  echo "📊 10. Get Current Drive Data"
  echo "   GET /api/chats/$CHAT_ID/drive-data"
  curl -s "$BASE_URL/api/chats/$CHAT_ID/drive-data" | python3 -m json.tool
  echo ""

else
  echo "⏭️  6-10. Skipped file upload & generation tests (no PDF provided)"
  echo "   Re-run with: bash test-api.sh path/to/jd.pdf"
  echo ""

  # -------------------------------------------
  # Generate without file (should ask for everything)
  # -------------------------------------------
  echo "🤖 6. Generate Drive Data (no files — expect many questions)"
  echo "   POST /api/chats/$CHAT_ID/generate"
  curl -s -X POST "$BASE_URL/api/chats/$CHAT_ID/generate" \
    -H "Content-Type: application/json" \
    -d '{"message": "Create a new recruitment drive"}' | python3 -m json.tool
  echo ""
fi

echo "============================================"
echo "  ✅ All tests completed!"
echo "  Chat ID: $CHAT_ID"
echo "============================================"
