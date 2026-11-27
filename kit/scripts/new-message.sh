#!/usr/bin/env bash
set -euo pipefail
: "${AGENT_COORD:?Export AGENT_COORD}"
FROM="${1:?Usage: new-message.sh from to priority subject}"; TO="${2:?}"; PRIORITY="${3:-normal}"; SUBJECT="${4:-Update}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"; OUT="$AGENT_COORD/messages/inbox/${FROM}-to-${TO}-${STAMP}.md"
cat > "$OUT" <<EOF
# Agent message
- From: $FROM
- To: $TO
- Priority: $PRIORITY
- Subject: $SUBJECT
- UTC: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

## Context

## Requested action

## Evidence / paths
EOF
echo "$OUT"
