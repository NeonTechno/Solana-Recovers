# ReKey — Engineering Handoff

> Owner: Hermes (Lead Engineer / Integration Manager)
> Last updated: 2026-11-28 · This file is the single source of truth for
> ownership, branch state, interface status and blockers.

## 1. Current mission

Build one coherent, polished, full-stack ReKey application:
Solana smart-wallet recovery + guardian social recovery + an MCP Gateway for AI-agent
integration + AI-powered wallet security assistance + Lifeline Rewards & wallet
resilience scoring + a colourful, distinctive, responsive interface.

## 2. Repository & workspace map

| Path | Role |
|---|---|
| `/Users/user/Solana-Recovers-project` | Base repo (origin: `git@github.com:NeonTechno/Solana-Recovers.git`) |
| `/Users/user/solana-recovers-agents/vibe-api` | **Vibe** — backend / MCP / AI |
| `/Users/user/solana-recovers-agents/junie-ui` | **Junie** — frontend / design system |
| `/Users/user/solana-recovers-agents/openclaude-review` | **OpenClaude** — architecture + security review |
| `/Users/user/solana-recovers-agents/hermes-lead` | **Hermes** — lead, integration, this repo |
| `/Users/user/solana-recovers-coordination` | Legacy coordination workspace (superseded by this file for contracts) |

Legacy worktrees (`vibe`, `junie`, `openclaude`, `hermes`, `codex`, `aider`, `kimi`)
still exist with their historical branches and are **preserved, not deleted**.

## 3. Agent ownership and branches

| Agent | Branch | Worktree | Owns (exclusive) |
|---|---|---|---|
| **Hermes** (lead) | `agents/hermes-lead` | `.../hermes-lead` | `docs/system-architecture.md`, `docs/api-contracts.md`, `docs/implementation-roadmap.md`, `docs/engineering-handoff.md`, `programs/rekey/**`, `shared/types.ts`, integration & merges |
| **Vibe** (backend) | `feature/backend-mcp-ai` | `.../vibe-api` | `server/**` (API, MCP, AI, rewards), `shared/**`, `.env.example`, `docs/api/**` |
| **Junie** (frontend) | `feature/frontend-rekey-ui` | `.../junie-ui` | `src/**` (except `src/api/client.ts` needs `shared/types.ts`), `public/**` |
| **OpenClaude** (review) | `feature/security-architecture-review` | `.../openclaude-review` | `docs/security-review.md`, `docs/architecture-review.md` — **read-only on code** |

### File-ownership rules (hard)
1. **Never** edit another agent's owned path without first writing a message to
   `messages/inbox/` saying exactly what and why. First mover announces; the other adapts.
2. **Never** discard another agent's work. No `reset --hard`, no `checkout --` over
   another agent's changes, no deleting files you did not create.
3. Branch isolation holds even though file ownership is relaxed: commit only to your
   own branch. Never push to or force-push another agent's branch.
4. The human owner retains merge and deploy authority. **No agent merges to `main`.**

### Shared-path protocol
`shared/types.ts` is owned by Vibe (it is emitted from the server package) and
**read-only** for Junie. If Junie needs a type change, Junie requests it in the
inbox and Vibe publishes it; Junie does not hand-edit the file. `programs/rekey/**` is
owned by Hermes only. If Vibe or Junie need a program change, they file it in the
inbox with the exact instruction and rationale, and Hermes implements it.

## 4. Frozen interfaces

- `docs/api-contracts.md` v1.0.0 — API endpoints, JSON shapes, TypeScript types,
  MCP tool schemas. **Frozen.** Junie codes against it now; Vibe implements it exactly.
- `docs/system-architecture.md` v1.0.0 — layers, trust boundaries, state machine, PDAs.
- `shared/types.ts` — the single TypeScript source of truth for both sides.

**Compatibility:** additive changes are allowed silently. Anything that removes or
renames a field, changes an enum value, or changes a numeric type is breaking and
requires a decision record here plus a note to both agents.

## 5. Agent roster — current assignments

### Vibe — backend, MCP, AI, DevOps
**Branch** `feature/backend-mcp-ai` · **Worktree** `/Users/user/solana-recovers-agents/vibe-api`

Deliver:
1. `server/` — TypeScript + Fastify application API implementing every endpoint in
   `docs/api-contracts.md` §1–2.
2. `server/mcp/` — MCP Gateway over stdio exposing the 8 read-only tools in
   `docs/api-contracts.md` §3.
3. `server/ai/` — OpenAI-compatible AI adapter with explicit graceful degradation
   (missing / invalid / unreachable / 429 / 5xx / malformed → deterministic local
   fallback, HTTP 200, `degraded: true`).
4. `server/rewards/` — deterministic resilience score + Lifeline Rewards engine.
5. `shared/types.ts` — the shared TypeScript types.
6. `.env.example` — placeholder values only; **never** modify `.env`.
7. Tests for the API, the MCP tools, the AI fallback matrix and the rewards engine.

Acceptance: the API starts with **no** AI credentials configured and still serves every
non-AI route; `npm test` passes; a real Devnet wallet can be read through
`GET /api/wallet/:address`.

### Junie — frontend, design system, wallet UX
**Branch** `feature/frontend-rekey-ui` · **Worktree** `/Users/user/solana-recovers-agents/junie-ui`

Deliver:
1. ReKey dashboard with: Overview, Recovery, Guardians, Activity, **AI Security
   Assistant**, **MCP Connect**, **Lifeline Rewards** — matching the contract in
   `docs/api-contracts.md`.
2. The real ReKey logo from `logo/` used throughout. **Do not invent a replacement.**
3. Colourful, distinctive visual direction: cartoon/illustration feel, colourful cards,
   ASCII-inspired particle backgrounds, responsive mobile layouts.
4. Typed API client at `src/api/client.ts` built on `shared/types.ts`.
5. Live vs simulated surfaces **visibly distinct**.
6. All state-changing actions routed through `POST /api/recovery/plan` → wallet
   signature → confirmation. No silent signing, ever.
7. Preserve the working existing UI (sidebar, wallet connect, Devnet balance, activity
   view) rather than rewriting it.

Acceptance: `npm run build` passes; typecheck clean; the app runs against the Vibe API
and degrades gracefully when the API is down; responsive at 375px and 1440px.

### OpenClaude — architecture + security review (standby)
**Branch** `feature/security-architecture-review` · **Worktree** `/Users/user/solana-recovers-agents/openclaude-review`

Deliver an independent review of the Anchor program and the proposed architecture,
focused on: concurrent recovery requests, timelock semantics, guardian threshold
handling, stale policy versions, request expiry, cancellation boundaries, vault
withdrawal authorization and rent preservation. **Code is read-only for this agent.**
Output: `docs/security-review.md` and `docs/architecture-review.md`.

## 6. Integration dependencies (critical path)

```
Hermes: contracts + Anchor program + Devnet deploy
   │
   ├──▶ Vibe: server + MCP + AI + rewards  ── needs programId + RPC
   │
   └──▶ Junie: frontend UI                 ── needs contracts (frozen) + API
                                                    │
                            Hermes integrates ◀─────┘
```

Junie is **not** blocked: the contracts are frozen. Vibe is blocked only on the
deployed program id, which Hermes is working on now.

## 7. Testing requirements

Every agent must run and record real output for:
- Frontend: `npm run build` (typecheck + bundle), plus any test script added.
- Backend: `npm test` — API routes, MCP tools, AI fallback matrix, rewards engine.
- Program: `cargo fmt --all -- --check`, `cargo test --manifest-path programs/rekey/Cargo.toml`,
  `cargo build-sbf` (SBF artifact), and a real Devnet transaction path.
- Security: `npm audit --audit-level=high` on both frontend and server; `cargo audit`
  if available.

Claims must include the command and its actual exit status. "Tests pass" without
output is not evidence.

## 8. Open blockers

| ID | Blocker | Impact | Owner | Status |
|---|---|---|---|---|
| B1 | SBF build fails on macOS 11 — the Solana platform-tools `rustc_driver` needs a libc++ typeinfo symbol absent from macOS 11's `/usr/lib/libc++.1.dylib`. Affects platform-tools v1.56 **and** v1.57. | **Blocks Devnet deployment** and therefore hackathon main-track eligibility. | Hermes | Workaround in progress (`--arch v0 --tools-version v1.51`) |
| B2 | No GitHub API token available (only SSH push auth). Branch pushes work; issue/PR creation needs a token. | Cannot publish issues/PRs from CI tooling. | Hermes | Device flow script exists at `solana-recovers-coordination/scripts/gh_device_flow.py` |
| B3 | Existing `main` contains a `logo/` directory that is **untracked** in git. | The logo the brief requires is not yet in the repository. | Hermes | Will commit on `agents/hermes-lead` |
| B4 | The program's `Cargo.toml` declares only `crate-type = ["cdylib"]`, but the SBF toolchain reports the crate has two crate types. | May block SBF build independent of B1. | Hermes | Verify once B1 workaround runs |

## 9. Decisions

| ID | Date | Decision | Rationale | Owner |
|---|---|---|---|---|
| D-001 | 2026-11-28 | The Anchor program is the sole authority for recovery authorization. Frontend, API, MCP and AI may only preview what the program will do, never decide it. | Prevents authorization drift and keeps the security boundary auditable in one place. | Hermes |
| D-002 | 2026-11-28 | The application API and MCP Gateway are strictly read-only. They never sign or submit transactions. | Removes an entire class of custodial risk; every state change stays in the user's wallet. | Hermes |
| D-003 | 2026-11-28 | MCP transport is stdio with 8 read-only tools. | An AI agent must be able to inspect a wallet's recovery posture without being able to change it. | Hermes |
| D-004 | 2026-11-28 | `POST /api/recovery/plan` returns a prepared, unsigned instruction plan; the frontend signs via the wallet adapter. | The API prepares; only the wallet authorizes. Preserves the non-custodial guarantee end-to-end. | Hermes |
| D-005 | 2026-11-28 | AI failures degrade to a deterministic local assessment with HTTP 200 and `degraded: true`; the service never 5xxs on an AI problem. | The AI assistant is advisory and must never take the product down. | Hermes |
| D-006 | 2026-11-28 | Every recovery-related response carries `mode: "live" \| "simulated"`. | Makes the live/simulated boundary machine-readable so the UI cannot mislabel it. | Hermes |
| D-007 | 2026-11-28 | The existing `brand.md` "Sand Club" warm palette is **replaced** by a neon magenta→purple→blue direction derived from the actual ReKey logo. | The brief asks for a colourful, distinctive app; the shipped logo is a neon diamond. The warm sand palette conflicts with the logo and the brief. | Hermes |
| D-008 | 2026-11-28 | The legacy coordination workspace is superseded by `docs/engineering-handoff.md` + `docs/api-contracts.md` as the contract source of truth, but is preserved on disk. | The legacy files were placeholders ("Pending initial audit"); the new ones are concrete and versioned. Nothing is deleted. | Hermes |
| D-009 | 2026-11-28 | Devnet only. Mainnet is blocked in code by an explicit cluster guard. | Explicit instruction from the owner; also correct for a pre-audit program. | Hermes |

## 10. Communication protocol

- **All agent communication goes through GitHub** (issues/PRs) and the coordination
  inbox at `/Users/user/solana-recovers-coordination/messages/inbox/`.
- Status files: `/Users/user/solana-recovers-coordination/status/<agent>.json`.
- Task board: `/Users/user/solana-recovers-coordination/tasks/in-progress.md`.
- A message file must carry: sender, recipient, priority, finding, evidence
  (command + output, or URL + access date), requested action addressed to a named
  owner, and exact paths.

## 11. Definition of done

A task is not done because code was generated. Each deliverable requires:
files changed · implementation summary · commands actually executed · tests with real
results · build status · security considerations · remaining limitations ·
branch and PR link if created.
