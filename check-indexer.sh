#!/bin/bash

# NoirWire Debugging Helper Script
# Run this to quickly diagnose commitment/indexer issues

echo "🔍 NoirWire Indexer Diagnostic Tool"
echo "===================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if API is running
echo "1. Checking if API is running..."
if curl -s http://localhost:3000/indexer/status > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API is running${NC}"
else
    echo -e "${RED}❌ API is NOT running!${NC}"
    echo "   Start it with: cd apps/api && npm run dev"
    exit 1
fi

echo ""

# Get indexer status
echo "2. Checking indexer status..."
STATUS=$(curl -s http://localhost:3000/indexer/status)
echo "$STATUS" | jq '.'

SHIELD_COUNT=$(echo "$STATUS" | jq '.trees.shield.count')
echo ""
if [ "$SHIELD_COUNT" -eq 0 ]; then
    echo -e "${RED}❌ Shield tree is EMPTY (count: 0)${NC}"
    echo "   This means commitments are NOT being added after shield!"
    echo ""
    echo "   Action: Shield some SOL and watch the browser console for:"
    echo "   '🔥 ADDING COMMITMENT TO INDEXER'"
    echo ""
else
    echo -e "${GREEN}✅ Shield tree has $SHIELD_COUNT commitment(s)${NC}"
    echo ""
    echo "   Commitments in shield tree:"
    curl -s http://localhost:3000/indexer/shield/commitments | jq '.commitments'
fi

echo ""
echo "===================================="
echo "3. Next steps:"
echo ""
if [ "$SHIELD_COUNT" -eq 0 ]; then
    echo "   ${YELLOW}1. Shield 0.1 SOL${NC}"
    echo "   ${YELLOW}2. Watch browser console for success/failure${NC}"
    echo "   ${YELLOW}3. Run this script again to verify commitment was added${NC}"
else
    echo "   ${GREEN}1. Go to: http://localhost:3001/debug-indexer${NC}"
    echo "   ${GREEN}2. Click 'Load Notes' to get your commitment${NC}"
    echo "   ${GREEN}3. Test 'Get Merkle Proof' - should return 20 elements${NC}"
    echo "   ${GREEN}4. Try unshielding!${NC}"
fi

echo ""
