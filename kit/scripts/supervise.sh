#!/usr/bin/env bash
set -euo pipefail
KIT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
: "${AGENT_COORD:?Export AGENT_COORD}"
python3 "$KIT/scripts/supervisor.py" "$AGENT_COORD" "${AGENT_WORKTREES_ROOT:-$(dirname "$AGENT_COORD")/solana-recovers-agents}"
