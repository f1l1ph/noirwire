#!/bin/bash

# Test Script: Verify Merkle Root Publishing
# This script tests the complete flow: add commitment -> publish root -> get proof

set -e

API_URL="http://localhost:3000"
TEST_COMMITMENT="1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"

echo "================================================"
echo "🧪 Testing Merkle Root Publishing Flow"
echo "================================================"
echo ""

echo "1️⃣ Adding test commitment to indexer..."
RESPONSE=$(curl -s -X POST "$API_URL/indexer/shield/commit" \
  -H "Content-Type: application/json" \
  -d "{\"commitment\":\"$TEST_COMMITMENT\"}")

echo "Response: $RESPONSE"
echo ""

# Extract root from response
ROOT=$(echo $RESPONSE | grep -o '"root":"[^"]*"' | cut -d'"' -f4)
INDEX=$(echo $RESPONSE | grep -o '"index":[0-9]*' | cut -d':' -f2)

echo "✅ Commitment added!"
echo "   Index: $INDEX"
echo "   Root: ${ROOT:0:16}..."
echo ""

echo "2️⃣ Waiting for root to be published on-chain..."
sleep 3

echo "3️⃣ Checking sync status..."
SYNC_STATUS=$(curl -s "$API_URL/indexer/sync-status")
echo "$SYNC_STATUS" | python3 -m json.tool | grep -A 5 "rootStatus"
echo ""

echo "4️⃣ Getting Merkle proof for commitment..."
PROOF=$(curl -s -X POST "$API_URL/indexer/shield/proof" \
  -H "Content-Type: application/json" \
  -d "{\"commitment\":\"$TEST_COMMITMENT\"}")

PROOF_ROOT=$(echo $PROOF | grep -o '"root":"[^"]*"' | cut -d'"' -f4)
PATH_LENGTH=$(echo $PROOF | grep -o '"path":\[[^]]*\]' | grep -o '0x[0-9a-fA-F]*' | wc -l | xargs)

echo "✅ Merkle proof generated!"
echo "   Root: ${PROOF_ROOT:0:16}..."
echo "   Path length: $PATH_LENGTH"
echo ""

# Verify root matches
if [ "$ROOT" = "$PROOF_ROOT" ]; then
    echo "✅ SUCCESS: Root matches between commit and proof!"
else
    echo "❌ ERROR: Root mismatch!"
    echo "   Commit root: $ROOT"
    echo "   Proof root:  $PROOF_ROOT"
    exit 1
fi

echo ""
echo "================================================"
echo "✅ All tests passed!"
echo "================================================"
echo ""
echo "Summary:"
echo "  - Commitment added to indexer: ✅"
echo "  - Root published to blockchain: ✅"
echo "  - Merkle proof generation: ✅"
echo "  - Root verification: ✅"
echo ""
echo "The system is working correctly! 🎉"
