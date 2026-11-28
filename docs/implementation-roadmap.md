# ReKey — Implementation Roadmap

> Owner: Hermes · Last updated: 2026-11-28
> The roadmap is a live artifact: checkboxes move as evidence lands.

## Phase 0 — Audit & coordination ✅ COMPLETE

- [x] Locate the real repository (the harness directory is not the project).
- [x] Fetch and inspect `origin/main` and every agent branch.
- [x] Read `README.md`, `docs/architecture.md`, `docs/security-model.md`, `brand.md`,
      the coordination workspace (brief, roster, ownership, decisions, blockers,
      task board, inbox) and every agent status file.
- [x] Inspect the Anchor program, frontend, CI workflow, package manifests.
- [x] Inspect GitHub issues, PRs (all states) and workflow runs.
- [x] Discover local skills; load `solana-dev` (Solana Foundation, MIT) and
      `multi-agent-repo-coordination`.
- [x] Identify the real logo: `logo/Solana Revives Logo` — 1280×1280 JPEG, a neon
      faceted diamond with a magenta→purple→blue gradient and glow on near-black.
- [x] Publish `docs/system-architecture.md`, `docs/api-contracts.md`,
      `docs/engineering-handoff.md`.
- [x] Create dedicated branches + worktrees for Vibe, Junie, OpenClaude, Hermes.

### Audit findings that shape the plan
1. The repo is a **prototype**: the frontend's recovery/guardian actions are
   **simulated**; the Anchor program is **not deployed**.
2. The program **compiles** (`cargo check` exit 0) and its **7 unit tests pass**, but
   **cannot be SBF-built on this macOS 11 host** — the platform-tools `rustc_driver`
   needs a libc++ typeinfo symbol that macOS 11 does not export. This blocks Devnet
   deployment, which is the hard hackathon eligibility gate.
3. `main` carries an **untracked `logo/`** — the brief's required asset is not in git.
4. No GitHub **API token** is present (SSH push auth only), so issue/PR creation needs
   the device flow.
5. AI endpoints **are** configured and reachable (NVIDIA NIM, OpenAI-compatible).
6. GitHub Actions CI **is green** on `main` (run `46090234057`, conclusion `success`).

## Phase 1 — Contracts ✅ COMPLETE

- [x] API contract v1.0.0 frozen (`docs/api-contracts.md`).
- [x] MCP tool schemas frozen (8 read-only tools, stdio transport).
- [x] Shared TypeScript types specified (`shared/types.ts`).
- [x] Architecture + trust boundaries published (`docs/system-architecture.md`).
- [x] Ownership, branches and integration dependencies published
      (`docs/engineering-handoff.md`).
- [x] `.env.example` policy defined — placeholders only, `.env` never touched.

## Phase 2 — On-chain authority & Devnet ⏳ IN PROGRESS

- [ ] Resolve the SBF build blocker (B1) and produce `program.so`.
- [ ] Fix the `crate-type` conflict if it blocks the build (B4).
- [ ] Commit the real logo into git (B3).
- [ ] Generate the deployment keypair, deploy to **Devnet**, record the program id.
- [ ] Run the full on-chain transaction path on Devnet: initialize → policy →
      initiate → approve → execute, plus the negative paths (duplicate approval,
      stale policy, early execute, expired request, unauthorized withdraw).
- [ ] Publish the deployed program id + Devnet transaction signatures as evidence.

## Phase 3 — Backend, MCP, AI (Vibe) ⏳ IN PROGRESS

- [ ] Application API on Fastify implementing the frozen contract.
- [ ] MCP Gateway (stdio, 8 read-only tools).
- [ ] AI security assistant with the full graceful-degradation matrix.
- [ ] Resilience score + Lifeline Rewards engine (deterministic).
- [ ] `.env.example` with placeholders only.
- [ ] Tests: API routes, MCP tools, AI fallback matrix, rewards engine.

## Phase 4 — Frontend & design (Junie) ⏳ IN PROGRESS

- [ ] Logo used throughout; no invented replacement.
- [ ] Colourful, distinctive direction: neon gradient from the logo, cartoon
      illustration elements, colourful cards, ASCII-inspired particle background,
      responsive mobile layouts.
- [ ] New surfaces: AI Security Assistant, MCP Connect, Lifeline Rewards.
- [ ] Typed API client over `shared/types.ts`.
- [ ] Live vs simulated visibly distinct.
- [ ] All state-changing actions: plan → sign → confirm.
- [ ] `npm run build` green; responsive at 375px and 1440px.

## Phase 5 — Independent review (OpenClaude) ⏳ QUEUED

- [ ] Concurrent recovery requests.
- [ ] Timelock semantics.
- [ ] Guardian threshold handling.
- [ ] Stale policy versions.
- [ ] Request expiry.
- [ ] Cancellation boundaries.
- [ ] Vault withdrawal authorization and rent preservation.
- [ ] Output: `docs/security-review.md`, `docs/architecture-review.md`.

## Phase 6 — Integration & verification ⏳ PENDING

- [ ] Review each agent's diff for overlapping modifications.
- [ ] Run the full gate locally and in CI: frontend build, server tests, program
      fmt/test/SBF build, `npm audit --audit-level=high`, `cargo audit`.
- [ ] Inspect GitHub Actions results and actual logs for any failure.
- [ ] End-to-end smoke against Devnet with the real deployed program id.
- [ ] Production demo build + written demo script.

## Phase 7 — Release report ⏳ PENDING

- [ ] Files changed, implementation summary, commands executed, real test results,
      build status, security considerations, remaining limitations.
- [ ] Branch + PR links for each agent branch.
- [ ] Explicit statement of what is live on Devnet vs simulated.

## Critical path

```
SBF build fix ──▶ Devnet deploy ──▶ program id ──▶ Vibe API reads real state
                                      │
                                      └────────────▶ Junie UI shows real state
                                                        │
                                                        └▶ Hermes integrates ─▶ demo
```

Junie is **not** blocked — contracts are frozen. Vibe is blocked only on the program id.
