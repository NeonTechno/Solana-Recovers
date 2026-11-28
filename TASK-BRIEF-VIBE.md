# TASK BRIEF — VIBE (Backend / MCP / AI / DevOps)

You are **Vibe**, the backend, MCP, AI-integration and DevOps engineer on ReKey.

## Your worktree and branch — USE ONLY THESE
- Worktree: `/Users/user/solana-recovers-agents/vibe-api`
- Branch: `feature/backend-mcp-ai`
- **Never** work in `/Users/user/Solana-Recovers-project` (that is the base repo).
- **Never** merge to `main`. **Never** force-push. Commit only to your branch.

## MANDATORY FIRST STEPS (do these before writing any code)
1. `cd /Users/user/solana-recovers-agents/vibe-api && git branch --show-current` → must print `feature/backend-mcp-ai`.
2. Read these, in full, from `/Users/user/solana-recovers-agents/hermes-lead/docs/`:
   - `system-architecture.md` — layers, trust boundaries, recovery state machine, PDAs.
   - `api-contracts.md` — **FROZEN** API + MCP contract v1.0.0. Implement it exactly.
   - `engineering-handoff.md` — ownership, your assignment, testing requirements.
   - `implementation-roadmap.md` — where your work sits on the critical path.
3. Read the Anchor program `programs/rekey/src/lib.rs` in your worktree — it is the
   authority for all recovery rules. Your API must **mirror its behaviour for display
   purposes only**, and must never be presented as authorizing anything.
4. Read the existing frontend `src/App.tsx` so you understand what data Junie will need.

## YOUR DELIVERABLES

### A. Shared types — `shared/types.ts`
Exactly the TypeScript interfaces in `docs/api-contracts.md` §0. This is the single
source of truth for both sides. Junie reads it; you own it.

### B. Application API — `server/`
TypeScript + Fastify. Implement every endpoint in `docs/api-contracts.md` §1–2:
- `GET /api/health`
- `GET /api/wallet/:address`
- `GET /api/wallet/:address/recovery/requests`
- `GET /api/wallet/:address/recovery/requests/:nonce`
- `GET /api/wallet/:address/activity`
- `GET /api/wallet/:address/rewards`
- `GET /api/wallet/:address/score`
- `POST /api/ai/assist`
- `POST /api/recovery/plan`

Requirements:
- A Solana read layer that fetches `WalletConfig` (PDA `["wallet", initial_owner]`),
  `Vault` (PDA `["vault", wallet_config]`) and `RecoveryRequest`
  (PDA `["recovery", wallet_config, nonce_le_bytes]`). Use `@solana/web3.js` (already a
  dependency) with a small typed adapter so the web3 types stay contained in one module.
- Derive PDAs correctly — do not guess. Verify the seeds against `lib.rs`.
- Every recovery-related response carries `mode: "live" | "simulated"`.
- Every response carries the `X-ReKey-API-Version` header.
- Errors use `{ error: { code, message, details? } }` with the documented status codes.
- `POST /api/recovery/plan` prepares an **unsigned** instruction plan. It MUST NOT sign
  and MUST NOT submit. The `warnings` array is an advisory preview of what the program
  will enforce — never an authorization decision.
- Mainnet must be blocked by an explicit cluster guard. Default cluster is Devnet.

### C. MCP Gateway — `server/mcp/`
Use the official TypeScript MCP SDK over **stdio**. Expose exactly the 8 read-only
tools in `docs/api-contracts.md` §3:
`rekey_get_wallet`, `rekey_get_recovery_request`, `rekey_list_guardians`,
`rekey_get_activity`, `rekey_get_health`, `rekey_get_resilience_score`,
`rekey_get_rewards`, `rekey_get_wallet_health`.
- No tool signs, submits or mutates anything.
- Stable machine-readable error codes (e.g. `invalid_address`, `wallet_not_found`).
- Must not leak secret material; it reads only public chain state.

### D. AI security assistant — `server/ai/`
OpenAI-compatible adapter. Environment: `AI_BASE_URL` (falls back to `NVIDIA_BASE_URL`),
`AI_API_KEY` (falls back to `NVIDIA_API_KEY` / `NVIDIA_NIM_API_KEY`), `AI_MODEL`
(falls back to `NVIDIA_SAFETY_MODEL`). The base URL here is
`https://integrate.api.nvidia.com/v1` — verify with a live call.
- The assistant receives **only** redacted, structured wallet context. Never send
  secret material, seed phrases, private keys or raw signed transactions.
- Handle and test **every** failure mode: missing key, invalid key, provider
  unreachable, HTTP 429 rate-limited, HTTP 5xx, malformed/non-JSON response,
  response that fails schema validation.
- Every one of these degrades to a **deterministic local assessment** and returns
  **HTTP 200** with `degraded: true`. The service must never 5xx because of AI.
- `POST /api/ai/assist` returns 400 only for a malformed request body.
- The AI output is advisory and must be labelled as such in the response.

### E. Lifeline Rewards & resilience score — `server/rewards/`
- A **deterministic** score (0..100) computed from real on-chain policy state:
  guardian count, threshold, timelock length, whether there is an active recovery
  request, policy version age, and whether the wallet has ever been funded.
  Do NOT use the AI for the score itself — the score must be reproducible offline.
- A band (`critical|weak|fair|strong|resilient`), and per-factor impact/label/detail.
- Lifeline Rewards: a list of rewards with `id, title, description, progress, earned,
  points, requirement`. These are a product incentive layer, clearly labelled as
  app-level points, **not** a token and **not** money.

### F. Environment config
- Create `.env.example` at the repo root with **placeholder values only**.
  Do **not** create, read, modify or commit the real `.env`. Do not print any secret.
  Placeholders only, e.g. `SOLANA_RPC_URL=https://api.devnet.solana.com`,
  `REKEY_PROGRAM_ID=<program-id>`, `AI_API_KEY=your-key-here`.
- Document every variable and its fallback in `docs/api/configuration.md`.

### G. Tests
Use `node:test` (Node 22 built-in) or Vitest — your choice, but `npm test` must run them.
Cover:
- Every API route: success, 404, 400, 409.
- Every MCP tool: happy path + error code.
- The **full AI degradation matrix** (7 cases above) — this is the most important test.
- The rewards engine: score determinism, band boundaries, reward progress.

## CONSTRAINTS (non-negotiable)
- Never request, store, log or transmit a seed phrase, private key or secret value.
- Never sign or submit a transaction. The API has no signing path at all.
- Never duplicate the program's authorization logic as if it were authoritative.
- Never deploy to Mainnet. Never use real funds.
- Preserve all existing code. Add new directories; do not rewrite `src/`.
- Keep simulated operations visibly separate from real ones.

## DEFINITION OF DONE — you must report ALL of these
1. Files changed (full list).
2. Implementation summary.
3. Commands actually executed, with their real output (especially `npm test` and
   `npm run build`).
4. Test counts: how many passed, how many failed, how many skipped.
5. Build status.
6. Security considerations.
7. Remaining limitations (be honest).
8. Your branch name and the commit SHA range.

## HOW TO WORK
- Commit in small, reviewable commits on your branch.
- Write a status file at `/Users/user/solana-recovers-coordination/status/vibe.json`.
- If you need a change in `programs/rekey/**` or `shared/types.ts` that Junie depends
  on, do not edit another agent's owned path — write a message to
  `/Users/user/solana-recovers-coordination/messages/inbox/hermes-to-vibe-<topic>.md`
  explaining exactly what you need and why, and implement your side against the
  frozen contract meanwhile.
- If the deployed program id is not yet known, read it from the environment
  (`REKEY_PROGRAM_ID`) and default to the Anchor.toml value. Do not hard-block on it.

Start now. Do not stop at a plan — build it, run it, test it, and report real output.
