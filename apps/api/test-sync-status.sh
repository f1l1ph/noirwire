#!/bin/bash
echo "Testing Solana Blockchain Sync Status..."
echo ""
curl -s http://localhost:3000/indexer/sync-status | python3 -m json.tool
echo ""
echo "✅ Test complete"
