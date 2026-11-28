#!/usr/bin/env bash
set -euo pipefail
KIT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
: "${AGENT_COORD:?Export AGENT_COORD}"
mkdir -p "$AGENT_COORD/logs"
for a in hermes openclaude junie kimi vibe; do
  "$KIT/scripts/launch-agent.sh" "$a" >"$AGENT_COORD/logs/$a.log" 2>&1 &
  echo "$!" >"$AGENT_COORD/logs/$a.pid"
done
echo "Started all agents in background. Use only for non-interactive CLI modes; interactive CLIs need separate terminal tabs."
