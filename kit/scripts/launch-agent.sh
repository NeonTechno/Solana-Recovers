#!/usr/bin/env bash
set -euo pipefail
KIT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENT="${1:-}"
case "$AGENT" in hermes|openclaude|junie|kimi|vibe) ;; *) echo "Usage: $0 <hermes|openclaude|junie|kimi|vibe>" >&2; exit 2;; esac
: "${AGENT_COORD:?Export AGENT_COORD=/path/to/solana-recovers-coordination}"
if [[ -f "$AGENT_COORD/paths.sh" ]]; then
  # shellcheck disable=SC1090
  source "$AGENT_COORD/paths.sh"
fi
CONFIG="${CLI_CONFIG:-$KIT/config/cli-commands.local.sh}"
[[ -f "$CONFIG" ]] || { echo "Copy config/cli-commands.example.sh to cli-commands.local.sh and configure it." >&2; exit 1; }
# shellcheck disable=SC1090
source "$CONFIG"
KEY="$(printf '%s' "$AGENT" | tr '[:lower:]' '[:upper:]')_LAUNCH"
CMD="${!KEY:-}"
[[ -n "$CMD" ]] || { echo "No command configured for $AGENT" >&2; exit 1; }
ROOT="${AGENT_WORKTREES_ROOT:-$(dirname "$AGENT_COORD")/solana-recovers-agents}"
REPO="$ROOT/$AGENT"; PROMPT="$KIT/prompts/$AGENT.md"
[[ -d "$REPO" && -f "$PROMPT" ]] || { echo "Worktree or prompt missing. Run setup first." >&2; exit 1; }
export AGENT_ID="$AGENT" AGENT_REPO="$REPO" AGENT_PROMPT="$PROMPT" AGENT_KIT="$KIT"
export AGENT_STATUS="$AGENT_COORD/status/$AGENT.json" AGENT_HANDOFF="$AGENT_COORD/handoffs/$AGENT.md"
CMD="${CMD//\{prompt\}/$PROMPT}"; CMD="${CMD//\{repo\}/$REPO}"; CMD="${CMD//\{coord\}/$AGENT_COORD}"
cd "$REPO"
echo "Agent=$AGENT Repo=$REPO Prompt=$PROMPT Coordination=$AGENT_COORD"
exec bash -lc "$CMD"
