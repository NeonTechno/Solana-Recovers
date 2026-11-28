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
| B1 | SBF build fails on macOS 11 — the Solana platform-tools `rustc_driver` needs a libc++ typeinfo symbol absent from macOS 11's `/usr/lib/libc++.1.dylib`. Verified for platform-tools v1.51, v1.56 **and** v1.57 — it is a host-OS libc++ ABI limitation, not a project defect. | Would block Devnet deployment and therefore hackathon main-track eligibility. | Hermes | **RESOLVED by workaround:** the SBF build now runs on `ubuntu-latest` in CI (`.github/workflows/build-program.yml`). CI run `46102913309` built the artifact successfully with every step green. |
| B2 | No GitHub API token available (only SSH push auth). | Cannot create PRs/issues through the API, and cannot download workflow artifacts (which require an authenticated request). | Hermes | **OPEN.** Branch pushes work, so all three agent branches are published. PR URLs can be constructed from the SSH push output. Device-flow script exists at `solana-recovers-coordination/scripts/gh_device_flow.py`; a device code was issued twice but not authorized within the expiry window. |
| B3 | The `logo/` directory was **untracked** in git. | The logo the brief requires was not in the repository. | Hermes | **RESOLVED** — committed on `agents/hermes-lead` with a correctly-named `logo/rekey-logo.jpg` copy and `.gitattributes` marking it binary. Junie copied the identical bytes to `public/rekey-logo.jpg` (SHA-256 verified). |
| B4 | The program's `Cargo.toml` declares only `crate-type = ["cdylib"]`. | Would block the SBF build if real. | Hermes | **NOT A DEFECT.** The crate-type is correct for a Solana program; the earlier "two crate types" message came from the *host* `cargo` picking up the workspace `lib` target, not from the SBF build. The CI SBF build succeeds. |
| B5 | The Devnet faucet now requires GitHub sign-in, and the public RPC faucet is closed (`410 The RPC faucet is closed on this cluster`). | The deploy wallet cannot be funded from this machine. | Hermes | **OPEN.** The deploy keypair exists (`~/.config/solana/rekey-program-keypair.json`, program id `CuNNoYhAJsGNKZzi7NbEZjVTR2T8GUZyNKMN8SUPzRhS`) but has 0 SOL. Needs either a GitHub-signed faucet request (which needs B2) or 2 SOL transferred in from an already-funded devnet account. |
| B6 | `solana-test-validator` dies with **SIGILL** on this host immediately after startup (it reaches "Faucet started" and "admin rpc service started", then aborts on an illegal instruction). The macOS 11 CPU does not support an instruction the Agave 4.4.1 validator requires. | A local validator cannot be used for on-chain integration testing on this machine. | Hermes | **OPEN.** The LiteSVM replacement was attempted and abandoned - see B7. |

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
| D-010 | 2026-11-28 | Approvals must land inside the owner's cancellation window (`now < execute_after`). | Found by OpenClaude. The grace period was granting approvals a right the owner had already lost. The two windows are now coextensive. | Hermes (after OpenClaude) |
| D-011 | 2026-11-28 | Only the newest recovery request may execute; a newer request supersedes older ones. | Found by both reviews. Without this, the last request executed silently decided the owner. | Hermes (after OpenClaude) |
| D-012 | 2026-11-28 | The API plan request separates `wallet` (lookup key) from `actor` (expected signer). | Found by OpenClaude. The single `address` field made guardian approval unbuildable and denied cancellation to a post-recovery owner. | Hermes (after OpenClaude) |
| D-013 | 2026-11-28 | The SBF build runs in GitHub Actions on ubuntu-latest, not on the local macOS 11 host. | The host's libc++ cannot load the Solana platform-tools `rustc_driver`. This is a host limitation, not a project defect. | Hermes |
| D-014 | 2026-11-28 | Every recovery plan carries `advisoryOnly: true`. | A 200 from the plan endpoint means the action is well-formed, never that the program will accept it. | Hermes (after OpenClaude) |

## 10. Security review reconciliation

Two independent reviews were produced against the same code:
- **Hermes (lead)** — `docs/security-review.md` on `agents/hermes-lead`.
- **OpenClaude (independent)** — `docs/security-review.md` and
  `docs/architecture-review.md` on `feature/security-architecture-review`.

They are complementary, not duplicates. The reconciliation:

| Finding | Reviewer | Status | Fix |
|---|---|---|---|
| Wallet PDA seed is circular (`wallet_config.initial_owner` validates itself) | Hermes | **Fixed** | `CancelRecovery` and `WithdrawSol` now prove the seed against the owner signer, and require both `initial_owner` and the current `owner` to match. |
| The approval window is 7 days longer than the cancellation window | OpenClaude | **Fixed** | `record_guardian_approval` now requires `now < request.execute_after`, so approvals land inside the owner's cancellation window. |
| Concurrent requests: the last one executed silently decides the owner | Both | **Fixed** | `execute_recovery_transition` now requires `request.nonce + 1 == wallet.next_nonce`; a newer request supersedes older ones. New error `SupersededRequest`. |
| `new_owner != wallet.owner` was only checked at initiation, never at execution | OpenClaude | **Fixed** | Re-checked in `execute_recovery_transition` immediately before the assignment. |
| `expire_recovery` emits no event | Both | **Fixed** | Added the `RecoveryExpired` event and emit it. |
| The server's program id did not match the program's `declare_id!` — every wallet read 404'd while `/api/health` said "ok" | OpenClaude | **Fixed** | The id now lives in one place; `/api/health` reports `programDeployed` and `ok` reflects RPC reachability. |
| The plan endpoint's single `address` field had two incompatible roles (lookup key vs signer), making guardian approval unbuildable | OpenClaude | **Fixed** | Split into `wallet` (lookup key) and `actor` (expected signer), plus a new `/resolve` endpoint. |
| The API presents its mirrored rule checks as HTTP 409 decisions, against the host clock rather than the chain clock | OpenClaude | **Accepted as advisory by design** | Every plan now carries `advisoryOnly: true` and `advisoryWarnings`. The checks are documented in `docs/architecture-review.md` as previews that the program re-evaluates. |
| A 60-second minimum timelock is not a usable recovery window | OpenClaude | **Accepted — correct division of responsibility** | The program enforces a floor; the resilience score penalises sub-day delays. The advisory layer is the right place for this judgement. |
| No integration tests for any account constraint | Both | **Open — release gate** | The full P0/P1/P2 list is in `docs/security-review.md` §7. Not yet written. |
| `RecoveryRequest` rent is locked forever (no close instruction) | OpenClaude | **Accepted — later milestone** | No vulnerability. |

**Net result of the program fixes:** 19 Rust unit tests pass (was 14). The five
new tests cover the approval window, superseded requests, owner-revert prevention
and the expiry boundary.

**Net result of the server fixes:** 56 server tests pass (was 53). The three new
tests cover the guardian-actor check, the resolve endpoint and the
`programDeployed` health signal.

| B7 | **LiteSVM 0.18.2 has an upstream dependency-graph type skew** that prevents a LiteSVM integration suite from compiling. | The program still has no *integration* tests - only unit tests of the pure helper functions. | Hermes | **OPEN, documented.** Root cause, fully diagnosed: `solana-address` is on the 2.x line while `solana-pubkey` is on the 4.x line, and although `solana-pubkey` re-exports `solana_address::Address`, the two crates are pulled in at *different versions* by different parents, so `AccountMeta::new` wants a `Pubkey` that is not the same type as LiteSVM's `Address`. Compounding it: `solana-keypair` 3.1.2 (pinned by litesvm) requires `solana-signature` 3.3.x, but the resolved graph selects 3.5.2, whose error type no longer accepts `five8`'s `DecodeError` (E0277). Every pin combination tried failed: `solana-signature =3.3.0` (conflicts with litesvm's `~3.5.2`), `solana-keypair 4.0.1` (wants signature `^3.6.0`), `solana-keypair 4.0.0` + `solana-transaction ~4.2.0` + `solana-instruction 3.5.1` (resolves, but the `Address`/`Pubkey` split remains). **This is upstream, not a ReKey defect.** The recommended fix is to run the integration suite in CI on `ubuntu-latest`, where the Solana toolchain is pinned and the version matrix is resolved by the platform rather than by hand. Until then the program has 19 unit tests and **no integration tests** - this is a hard release gate before real funds, as recorded in `docs/security-review.md` section 7. |

## 10. Communication protocol

- **All agent communication goes through GitHub** (issues/PRs) and the coordination
  inbox at `/Users/user/solana-recovers-coordination/messages/inbox/`.
- Status files: `/Users/user/solana-recovers-coordination/status/<agent>.json`.
- Task board: `/Users/user/solana-recovers-coordination/tasks/in-progress.md`.
- A message file must carry: sender, recipient, priority, finding, evidence
  (command + output, or URL + access date), requested action addressed to a named
  owner, and exact paths.

## 12. Definition of done

A task is not done because code was generated. Each deliverable requires:
files changed · implementation summary · commands actually executed · tests with real
results · build status · security considerations · remaining limitations ·
branch and PR link if created.
