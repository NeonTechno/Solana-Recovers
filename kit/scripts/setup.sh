#!/usr/bin/env bash
set -euo pipefail
KIT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ $# -ge 1 ]] || { echo "Usage: $0 /path/to/repo [coordination-dir]" >&2; exit 2; }
REPO="$(cd "$1" && pwd)"
COORD="${2:-$(dirname "$REPO")/solana-recovers-coordination}"
ROOT="$(dirname "$REPO")/solana-recovers-agents"
git -C "$REPO" rev-parse --show-toplevel >/dev/null
[[ -z "$(git -C "$REPO" status --porcelain)" ]] || { echo "Base repo is dirty; commit/stash intentionally first. Nothing changed." >&2; exit 1; }
[[ ! -e "$COORD" ]] || { echo "Coordination directory exists; refusing overwrite: $COORD" >&2; exit 1; }
BASE="$(git -C "$REPO" rev-parse HEAD)"
mkdir -p "$COORD"/{status,handoffs,messages/inbox,messages/archive,tasks,reviews/security,reviews/integration,reviews/testing,skills,logs} "$ROOT"
for pair in "hermes:research" "openclaude:architecture" "junie:application" "kimi:threat-intelligence" "vibe:integration-devops"; do
  agent="${pair%%:*}"; branch="agents/${pair#*:}"; path="$ROOT/$agent"
  git -C "$REPO" show-ref --verify --quiet "refs/heads/$branch" && { echo "Branch exists: $branch" >&2; exit 1; }
  [[ ! -e "$path" ]] || { echo "Worktree path exists: $path" >&2; exit 1; }
done
for pair in "hermes:research" "openclaude:architecture" "junie:application" "kimi:threat-intelligence" "vibe:integration-devops"; do
  agent="${pair%%:*}"; branch="agents/${pair#*:}"
  git -C "$REPO" worktree add -b "$branch" "$ROOT/$agent" "$BASE"
done
cat > "$COORD/paths.sh" <<EOF
export AGENT_COORD=$(printf '%q' "$COORD")
export AGENT_WORKTREES_ROOT=$(printf '%q' "$ROOT")
EOF
cat > "$COORD/PROJECT_BRIEF.md" <<EOF
# Solana Recovers — Shared Project Brief
- Repository: $REPO
- Baseline commit: $BASE
- Worktrees: $ROOT
- Coordination: $COORD
- Initialized UTC: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

Build the strongest feasible Dev3pack × Solana hackathon project while preserving useful existing Solana Recovers work. Verify current repository state and live hackathon rules. SENTINEL (transaction inspection, simulation, risk analysis and policy controls) is a candidate direction, not an approved scope. Keep the project independent of the DRP chain. Do not claim features/tests/deployments without evidence. Use Devnet/test wallets. An external service cannot forcibly block arbitrary wallet transactions before signing; distinguish warnings from enforceable controls.
Prior context (must be re-verified): React/TypeScript frontend, Phantom/Solflare integration, Devnet interactions, guardian/recovery prototype, Anchor program; earlier reported Rust tests 7/7 and frontend build passed.
EOF
cat > "$COORD/AGENT_ROSTER.md" <<'EOF'
| Agent | Role | Branch |
|---|---|---|
| Hermes | Dev3pack research, official resources, skill inventory | agents/research |
| OpenClaude | Principal architect, initial integration lead | agents/architecture |
| Junie | Frontend / wallet application engineer | agents/application |
| Kimi | Threat intelligence / adversarial testing | agents/threat-intelligence |
| Vibe | Integration / DevOps engineer | agents/integration-devops |

Codex and Aider were removed from the CLI agent set by the human owner on 2026-11-27. Their
historical branches (agents/solana-protocol, agents/security-engine) and worktrees remain on disk
so no prior work is lost; their roles are covered by the remaining agents.
EOF
cat > "$COORD/OWNERSHIP.md" <<'EOF'
Hermes owns research reports. OpenClaude owns architecture, interface contracts and coordination. Codex owns assigned Anchor/Rust code. Aider owns security engine and security tests. Junie owns frontend/wallet UX. Kimi owns threat research and adversarial fixtures. Vibe owns API/integration/DevOps. All may read all worktrees. Do not edit another agent's owned code without approval. Human owner retains merge/deploy authority.
EOF
cat > "$COORD/ARCHITECTURE.md" <<'EOF'
# Pending initial audit
OpenClaude: audit current repo, verify hackathon rules, compare preserving recovery work vs SENTINEL, and publish focused architecture with trust assumptions, on-chain/off-chain boundaries, demo flow and limitations. No broad implementation before interface contracts.
EOF
cat > "$COORD/INTEGRATION_CONTRACTS.md" <<'EOF'
# Pending architecture
For each interface specify owner, consumers, schema/account contract, errors, auth assumptions, RPC assumptions, fixtures, acceptance criteria and compatibility. Implementation agents must acknowledge contracts before dependent work.
EOF
cat > "$COORD/DECISIONS.md" <<'EOF'
Append decisions with ID/date, context, options, decision, consequences, owner and evidence. Mark superseded decisions; never silently overwrite.
EOF
cat > "$COORD/BLOCKERS.md" <<'EOF'
Record blocker, owner, impact, evidence, next action and whether human input is required.
EOF
cat > "$COORD/HANDOFF_TEMPLATE.md" <<'EOF'
# Handoff
Agent / UTC time / recipient / task:
Worktree / branch / last commit:
Git state (staged, unstaged, untracked):
Objective and current state:
Completed work (exact paths):
Changes and rationale:
Tests/checks actually run (commands + outcomes):
Not run and why:
Exact ordered next steps:
Open questions / decisions / dependencies:
Risks and limitations:
Sources:
Usage warning / reason for handoff:
Inbox notification sent?
EOF
cat > "$COORD/skills/SKILL_REGISTRY.md" <<'EOF'
For every discovered skill record exact name/version, path/source/provenance, compatible CLI, purpose, permissions/side effects, security review and whether merely inspected or invoked. A skill found by one CLI is not automatically executable by another. Do not install/run untrusted skills without human approval.
EOF
cat > "$COORD/tasks/backlog.md" <<'EOF'
- [ ] Hermes verifies live Dev3pack requirements, deadlines, judging and resources.
- [ ] OpenClaude audits repository and publishes architecture/contracts.
- [ ] All agents inventory CLI-native skills.
- [ ] Agents acknowledge ownership/contracts.
- [ ] Implement prioritized demo scope, test and integrate.
EOF
: > "$COORD/tasks/in-progress.md"; : > "$COORD/tasks/completed.md"
echo "Initialized at $COORD from $BASE"
echo "Configure CLI commands, then launch agents. Worktrees: $ROOT"
