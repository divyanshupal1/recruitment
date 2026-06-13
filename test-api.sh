#!/bin/bash
# ============================================
# Recruitment Agent API — Test Script
# ============================================
# Usage: bash test-api.sh [sample.pdf]
# If no PDF/document is provided, file upload test is skipped.
# Supports PDF, DOC, DOCX, PNG, JPG files.

BASE_URL="${BASE_URL:-http://localhost:3000}"
DOC_FILE="${1:-}"

echo "============================================"
echo "  Recruitment Agent API Tests"
echo "  Server: $BASE_URL"
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
  -d '{"title": "Senior Frontend Developer Drive 2026"}')

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
curl -s "$BASE_URL/api/chats" | python3 -c "
import sys, json
data = json.load(sys.stdin)
chats = data.get('chats', [])
print(f'   Found {len(chats)} chat(s)')
for c in chats[:3]:
    print(f'   • {c[\"id\"][:8]}... | {c[\"title\"]} | {c[\"status\"]}')
if len(chats) > 3:
    print(f'   ... and {len(chats)-3} more')
"
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
curl -s "$BASE_URL/api/chats/$CHAT_ID/messages" | python3 -c "
import sys, json
data = json.load(sys.stdin)
msgs = data.get('messages', [])
print(f'   Found {len(msgs)} message(s)')
for m in msgs:
    print(f'   • [{m[\"role\"]}:{m[\"type\"]}] {m[\"content\"][:80]}')
"
echo ""

# ===========================================================
#  WITH DOCUMENT UPLOAD
# ===========================================================
if [ -n "$DOC_FILE" ] && [ -f "$DOC_FILE" ]; then

  # -------------------------------------------
  # 6. Upload Document
  # -------------------------------------------
  echo "📄 6. Upload Document"
  echo "   POST /api/chats/$CHAT_ID/files"
  echo "   File: $DOC_FILE"
  UPLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/chats/$CHAT_ID/files" \
    -F "file=@$DOC_FILE")

  # Show parsed summary
  echo "$UPLOAD_RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print('   Parse Warning:', data.get('parseWarning', 'None'))
print()
print(data.get('message', 'No summary'))
print()
pd = data.get('parsedData', {})
setup = pd.get('setupDetails', {})
pos = pd.get('positionDetails', {})
elig = pd.get('eligibilityCriteria', {})
iv = pd.get('interviewConfig', {})
print('   --- Extracted Fields ---')
if setup.get('positionTitle'): print(f'   Position Title: {setup[\"positionTitle\"]}')
if setup.get('candidateType'): print(f'   Candidate Type: {setup[\"candidateType\"]}')
if setup.get('driveTitle'): print(f'   Drive Title: {setup[\"driveTitle\"]}')
if setup.get('numberOfVacancies'): print(f'   Vacancies: {setup[\"numberOfVacancies\"]}')
if pos.get('employmentType'): print(f'   Employment: {pos[\"employmentType\"]}')
if pos.get('locationType'): print(f'   Location: {pos[\"locationType\"]}')
if pos.get('locationCities'): print(f'   Cities: {pos[\"locationCities\"]}')
if pos.get('salaryType'): print(f'   Salary Type: {pos[\"salaryType\"]}')
if pos.get('salaryFixed'): print(f'   Salary (Fixed): {pos[\"salaryFixed\"]}')
if pos.get('salaryMin'): print(f'   Salary Min: {pos[\"salaryMin\"]}')
if pos.get('salaryMax'): print(f'   Salary Max: {pos[\"salaryMax\"]}')
if pos.get('internshipDuration'): print(f'   Internship Duration: {pos[\"internshipDuration\"]}')
if pos.get('requiredSkills'): print(f'   Required Skills: {\", \".join(pos[\"requiredSkills\"][:6])}')
if pos.get('goodToHaveSkills'): print(f'   Good to Have: {\", \".join(pos[\"goodToHaveSkills\"][:6])}')
if elig.get('eligibleCourses'): print(f'   Eligible Courses: {\", \".join(elig[\"eligibleCourses\"])}')
if iv.get('numberOfRounds'): print(f'   Interview Rounds: {iv[\"numberOfRounds\"]}')
" 2>/dev/null
  echo ""

  # -------------------------------------------
  # 7. List Files
  # -------------------------------------------
  echo "📁 7. List Files"
  echo "   GET /api/chats/$CHAT_ID/files"
  curl -s "$BASE_URL/api/chats/$CHAT_ID/files" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for f in data.get('files', []):
    size_kb = f.get('fileSize', 0) / 1024
    print(f'   • {f[\"fileName\"]} ({size_kb:.1f} KB) — {f[\"mimeType\"]}')
"
  echo ""

  # -------------------------------------------
  # 8. Generate Drive Data (Round 1 — expect questions for missing fields)
  # -------------------------------------------
  echo "🤖 8. Generate Drive Data (Round 1 — expect questions for fields not in document)"
  echo "   POST /api/chats/$CHAT_ID/generate"
  GENERATE_R1=$(curl -s -X POST "$BASE_URL/api/chats/$CHAT_ID/generate" \
    -H "Content-Type: application/json" \
    -d '{"message": "Generate the recruitment drive from the uploaded document"}')

  echo "$GENERATE_R1" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'   Type: {data.get(\"type\")}')
print(f'   Summary: {data.get(\"summary\", \"\")[:200]}')
print()
qs = data.get('questions', [])
print(f'   Questions ({len(qs)}):')
for q in qs:
    req = '(required)' if q.get('required') else '(optional)'
    opts = ''
    if q.get('options'):
        vals = [o['value'] for o in q['options'][:5]]
        opts = f' → [{\" | \".join(vals)}]'
    sug = ''
    if q.get('suggestedOptions'):
        sug = f' 💡 suggestions: {q[\"suggestedOptions\"][:3]}'
    warn = f' ⚠️ {q[\"warning\"]}' if q.get('warning') else ''
    print(f'   • [{q[\"type\"]}] {q[\"field\"]} {req}{opts}{sug}{warn}')
    print(f'     \"{q[\"question\"]}\"')
"
  echo ""

  # -------------------------------------------
  # 9. Submit Answers (Round 1 answers — uses new field names)
  # -------------------------------------------
  echo "📝 9. Submit Answers (Round 1)"
  echo "   POST /api/chats/$CHAT_ID/generate (with answers)"
  ANSWERS_R1=$(curl -s -X POST "$BASE_URL/api/chats/$CHAT_ID/generate" \
    -H "Content-Type: application/json" \
    -d '{
      "answers": {
        "setupDetails.candidateType": "fresh_graduates",
        "setupDetails.numberOfVacancies": 10,
        "setupDetails.driveTitle": "Senior Frontend Developer Campus Drive 2026",
        "positionDetails.employmentType": "full_time",
        "positionDetails.locationType": ["onsite", "hybrid"],
        "positionDetails.locationCities": ["Bangalore", "Hyderabad"],
        "positionDetails.salaryType": "range",
        "positionDetails.salaryMin": "8 LPA",
        "positionDetails.salaryMax": "14 LPA",
        "eligibilityCriteria.eligibleCourses": ["B.Tech (CSE)", "B.Tech (ECE)", "M.Tech (CSE)", "MCA"],
        "eligibilityCriteria.academicCriteria.graduationMarks": 60
      }
    }')

  echo "$ANSWERS_R1" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'   Type: {data.get(\"type\")}')
print(f'   Summary: {data.get(\"summary\", data.get(\"message\", \"\"))[:200]}')
qs = data.get('questions', [])
if qs:
    print(f'   Remaining Questions ({len(qs)}):')
    for q in qs:
        print(f'   • [{q[\"type\"]}] {q[\"field\"]}: \"{q[\"question\"]}\"')
else:
    print('   ✅ No more questions — drive data complete!')
"
  echo ""

  # -------------------------------------------
  # 10. Submit Round 2 Answers (if more questions returned)
  # -------------------------------------------
  R1_TYPE=$(echo "$ANSWERS_R1" | python3 -c "import sys, json; print(json.load(sys.stdin).get('type',''))" 2>/dev/null)

  if [ "$R1_TYPE" = "questions" ]; then
    echo "📝 10. Submit Answers (Round 2 — remaining optional fields)"
    echo "   POST /api/chats/$CHAT_ID/generate (with answers)"
    ANSWERS_R2=$(curl -s -X POST "$BASE_URL/api/chats/$CHAT_ID/generate" \
      -H "Content-Type: application/json" \
      -d '{
        "answers": {
          "positionDetails.probationPeriod": "3 months",
          "positionDetails.bondPeriod": null,
          "positionDetails.bondAmount": null,
          "positionDetails.additionalDetails": "ESOPs after 1 year, health insurance for family, free lunch, annual learning budget of ₹50,000",
          "interviewConfig.numberOfRounds": 3
        }
      }')

    echo "$ANSWERS_R2" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'   Type: {data.get(\"type\")}')
print(f'   Summary: {data.get(\"summary\", data.get(\"message\", \"\"))[:200]}')
qs = data.get('questions', [])
if qs:
    print(f'   Remaining Questions ({len(qs)}):')
    for q in qs:
        print(f'   • [{q[\"type\"]}] {q[\"field\"]}: \"{q[\"question\"]}\"')
else:
    print('   ✅ No more questions — drive data complete!')
"
    echo ""
  fi

  # -------------------------------------------
  # 11. Get Final Drive Data
  # -------------------------------------------
  echo "📊 11. Get Final Drive Data"
  echo "   GET /api/chats/$CHAT_ID/drive-data"
  curl -s "$BASE_URL/api/chats/$CHAT_ID/drive-data" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'   Status: {data.get(\"status\")}')
dd = data.get('driveData', {})
setup = dd.get('setupDetails', {})
pos = dd.get('positionDetails', {})
elig = dd.get('eligibilityCriteria', {})
iv = dd.get('interviewConfig', {})
print()
print('   📋 Setup Details')
print(f'     Candidate Type: {setup.get(\"candidateType\")}')
print(f'     Position Title: {setup.get(\"positionTitle\")}')
print(f'     Drive Title:    {setup.get(\"driveTitle\")}')
print(f'     Vacancies:      {setup.get(\"numberOfVacancies\")}')
if setup.get('preferredYearOfGraduation'):
    print(f'     Grad Years:     {setup[\"preferredYearOfGraduation\"]}')
print()
print('   💼 Position Details')
print(f'     Employment:     {pos.get(\"employmentType\")}')
if pos.get('internshipDuration'):
    print(f'     Internship:     {pos[\"internshipDuration\"]}')
print(f'     Location:       {pos.get(\"locationType\")}')
if pos.get('locationCities'):
    print(f'     Cities:         {pos[\"locationCities\"]}')
print(f'     Salary Type:    {pos.get(\"salaryType\")}')
if pos.get('salaryFixed'):
    print(f'     Salary:         {pos[\"salaryFixed\"]}')
if pos.get('salaryMin'):
    print(f'     Salary Range:   {pos[\"salaryMin\"]} — {pos.get(\"salaryMax\")}')
if pos.get('salaryBreakdown'):
    print(f'     Breakdown:      {pos[\"salaryBreakdown\"]}')
if pos.get('probationPeriod'):
    print(f'     Probation:      {pos[\"probationPeriod\"]}')
if pos.get('requiredSkills'):
    print(f'     Required:       {\", \".join(pos[\"requiredSkills\"][:6])}')
if pos.get('goodToHaveSkills'):
    print(f'     Good to Have:   {\", \".join(pos[\"goodToHaveSkills\"][:6])}')
if pos.get('additionalDetails'):
    print(f'     Additional:     {pos[\"additionalDetails\"][:100]}')
print()
if elig:
    print('   🎓 Eligibility')
    if elig.get('eligibleCourses'):
        print(f'     Courses:        {\", \".join(elig[\"eligibleCourses\"][:6])}')
    ac = elig.get('academicCriteria', {})
    if ac:
        for k, v in ac.items():
            if v is not None:
                print(f'     {k}: {v}')
    print()
if iv:
    print('   🎯 Interview Config')
    print(f'     Rounds: {iv.get(\"numberOfRounds\")}')
    for r in (iv.get('rounds') or []):
        print(f'     Round {r.get(\"roundNumber\")}: {r.get(\"roundTitle\", r.get(\"roundType\", \"?\"))} ({r.get(\"venue\", \"?\")})')
"
  echo ""

# ===========================================================
#  WITHOUT DOCUMENT UPLOAD (questions-only flow)
# ===========================================================
else
  echo "⏭️  No document provided — testing questions-only flow"
  echo "   Re-run with: bash test-api.sh path/to/document.pdf"
  echo ""

  # -------------------------------------------
  # 6. Generate (no file — should ask core setup questions)
  # -------------------------------------------
  echo "🤖 6. Generate Drive Data (no files — expect setup questions)"
  echo "   POST /api/chats/$CHAT_ID/generate"
  GENERATE_R1=$(curl -s -X POST "$BASE_URL/api/chats/$CHAT_ID/generate" \
    -H "Content-Type: application/json" \
    -d '{"message": "Start a new recruitment drive"}')

  echo "$GENERATE_R1" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'   Type: {data.get(\"type\")}')
print(f'   Summary: {data.get(\"summary\", \"\")[:200]}')
print()
for q in data.get('questions', []):
    req = '(required)' if q.get('required') else '(optional)'
    opts = ''
    if q.get('options'):
        vals = [o['value'] for o in q['options'][:5]]
        opts = f' → [{\" | \".join(vals)}]'
    sug = ''
    if q.get('suggestedOptions'):
        sug = f' 💡 {q[\"suggestedOptions\"][:3]}'
    print(f'   • [{q[\"type\"]}] {q[\"field\"]} {req}{opts}{sug}')
    print(f'     \"{q[\"question\"]}\"')
"
  echo ""

  # -------------------------------------------
  # 7. Submit Setup Answers
  # -------------------------------------------
  echo "📝 7. Submit Setup Answers"
  echo "   POST /api/chats/$CHAT_ID/generate (with answers)"
  ANSWERS_R1=$(curl -s -X POST "$BASE_URL/api/chats/$CHAT_ID/generate" \
    -H "Content-Type: application/json" \
    -d '{
      "answers": {
        "setupDetails.candidateType": "fresh_graduates",
        "setupDetails.positionTitle": "Backend Engineer",
        "setupDetails.numberOfVacancies": 3,
        "setupDetails.driveTitle": "Backend Engineer Campus Drive 2026"
      }
    }')

  echo "$ANSWERS_R1" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'   Type: {data.get(\"type\")}')
print(f'   Summary: {data.get(\"summary\", data.get(\"message\", \"\"))[:200]}')
qs = data.get('questions', [])
if qs:
    print(f'   Next Questions ({len(qs)}):')
    for q in qs:
        print(f'   • [{q[\"type\"]}] {q[\"field\"]}: \"{q[\"question\"]}\"')
else:
    print('   ✅ Complete!')
"
  echo ""

  # -------------------------------------------
  # 8. Get Drive Data
  # -------------------------------------------
  echo "📊 8. Get Current Drive Data"
  echo "   GET /api/chats/$CHAT_ID/drive-data"
  curl -s "$BASE_URL/api/chats/$CHAT_ID/drive-data" | python3 -m json.tool
  echo ""
fi

echo "============================================"
echo "  ✅ All tests completed!"
echo "  Chat ID: $CHAT_ID"
echo "============================================"
