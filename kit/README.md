# Solana Recovers — Seven-Agent Launch Kit

## Included
- Five isolated Git worktrees, one per CLI agent (Hermes, OpenClaude, Junie, Kimi, Vibe).
  Codex and Aider were removed from the CLI agent set on 2026-11-27; their branches and worktrees
  are retained on disk so no prior work is lost.
- Shared coordination workspace outside all worktrees.
- Seven role-specific prompts and skill-discovery instructions.
- Configurable CLI command adapters (CLI syntax varies by installed version).
- Checkpoint, handoff, launch and supervision scripts.

## Setup
Requirements: macOS/Linux, Bash, Git, Python 3.

    chmod +x scripts/*.sh
    ./scripts/setup.sh /absolute/path/to/Solana-Recovers

Optional coordination path:

    ./scripts/setup.sh /path/to/repo /path/to/coordination

The base repository must be clean. Setup refuses to overwrite existing branches or an existing coordination directory. It creates sibling worktrees under ../solana-recovers-agents. All agents start at the same HEAD.

## Configure CLI commands
Copy config/cli-commands.example.sh to config/cli-commands.local.sh and edit each command after checking the installed CLI's current help/docs.

Each command template supports {prompt}, {repo}, and {coord}. The launcher executes it with bash -lc from that agent's worktree. The defaults are command names only; they may start interactive sessions without consuming the prompt. Configure each CLI's actual prompt-input syntax yourself. Do not assume flags or stdin behavior across versions.

    cp config/cli-commands.example.sh config/cli-commands.local.sh
    export AGENT_COORD=/path/to/solana-recovers-coordination
    ./scripts/launch-agent.sh hermes

For mixed environments, launch interactive agents individually in separate terminal tabs/IDE terminals. Use launch-all.sh only for non-interactive CLI modes; it backgrounds all agents and writes logs/PIDs to the coordination workspace.

## Coordination and supervision
Agents must read PROJECT_BRIEF.md, AGENT_ROSTER.md, OWNERSHIP.md, ARCHITECTURE.md, INTEGRATION_CONTRACTS.md, DECISIONS.md and BLOCKERS.md before acting. They must inspect their worktree and inbox, discover their own skills, and update status/<agent>.json at startup and every 10 minutes. Ownership areas are guides, not walls: any agent may edit any file when it unblocks the team, provided it announces the change first and never discards another agent's work.

Run:

    ./scripts/supervise.sh

The supervisor flags missing/stale status, inspects worktree branches and dirty state, and reports whether all handoff files exist. It is advisory; it does not validate tests or merge code.

## Credit / context exhaustion protocol
At about 20% remaining usage, or immediately on a usage warning:
1. Stop accepting new work.
2. Preserve staged, unstaged and untracked files. Never reset/clean/discard.
3. Run scripts/checkpoint.sh <agent> (or update status manually).
4. Write handoffs/<agent>.md using HANDOFF_TEMPLATE.md, including exact next steps, changed files, branch, Git state, tests actually run and outcomes, blockers and risks.
5. Notify the successor and OpenClaude with a new file in messages/inbox/.
6. Mark status state=handoff.

Configure a documented pre-compaction/before-exit hook to call checkpoint.sh only if that CLI actually supports such a hook. The kit cannot read exact credit balances unless a CLI exposes a supported API/hook. Periodic checkpoints and stale-status alerts are the fallback. An abruptly killed process cannot be forced to write a final handoff.

Successor: read handoff and inbox; inspect real branch/diff/Git state; verify tests before continuing. A handoff is not a commit.

## Integration controls
No agent may push, force-push, merge to main, deploy Mainnet or alter production settings. OpenClaude coordinates integration; human owner authorizes merges/deployments. Before integration, inspect diffs, run formatting, tests, builds, CI-equivalent checks, dependency audits and security scans relevant to changed code. Integrate one branch at a time.

## Product/security boundaries
Prior reconnaissance described a React/TypeScript app, Phantom/Solflare support, Devnet interactions, a guardian/recovery prototype and an Anchor program. Verify all of this against current HEAD; do not treat it as guaranteed current state. SENTINEL is a candidate direction, not an approved scope until the repository and live hackathon rules are reviewed. An external service cannot forcibly block arbitrary wallet transactions before signing; distinguish advisory warnings from enforceable controls that require a wallet, smart-account or program-controlled path. Never put private keys, seed phrases or secrets in prompts/logs/reports. Use Devnet/test wallets.
