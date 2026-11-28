# ReKey — System Architecture

> Owner: Hermes (Lead Engineer / Integration Manager)
> Status: Authoritative for the current build. Supersedes the placeholder in the coordination workspace.
> Last updated: 2026-11-28

## 1. Product boundary

ReKey is a **non-custodial social-recovery layer** for Solana wallets controlled by an
Anchor program. It never holds keys, never signs for a user, and never stores a seed
phrase.

The Anchor program in `programs/rekey/` is the **sole authority** for recovery
authorization. The frontend, the application API, the MCP Gateway and the AI assistant
are all *read-only advisors* over that authority — they may display state and propose
actions, but they never decide whether a recovery is authorized.

### Explicit non-goals
- Recovering the private key of a conventional externally-owned Solana account.
- Custodial or escrow custody of user funds.
- Silent, unattended, or server-side-signed transactions.
- Passkey/WebAuthn support (not implemented — do not claim it).

## 2. Component topology

```
┌──────────────────────────────────────────────────────────────────────┐
│ FRONTEND (Junie) — React + Vite + @solana/wallet-adapter            │
│   Dashboard · Recovery · Guardians · Activity · AI Assistant ·      │
│   MCP Connect · Lifeline Rewards                                     │
│   Wallet adapter owns all signing. Frontend never signs server-side. │
└───────────────┬──────────────────────────────────────────────────────┘
                │ HTTP/JSON (typed client)  +  direct web3.js RPC reads
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ APPLICATION API (Vibe) — Node + TypeScript + Fastify                 │
│  /api/wallet/*   /api/recovery/*   /api/guardians/*                  │
│  /api/activity/* /api/rewards/*   /api/ai/*                          │
│  · Solana RPC read layer (cluster-agnostic, Devnet default)          │
│  · AI provider adapter (OpenAI-compatible, NVIDIA NIM)               │
│  · Rewards verification engine                                      │
└──────┬───────────────────────────────┬──────────────────────────────┘
       │ stdio MCP                     │ OpenAI-compatible /v1/chat
       ▼                               ▼
┌────────────────────────┐   ┌──────────────────────────────────────────┐
│ MCP GATEWAY (Vibe)     │   │ AI SECURITY ASSISTANT (Vibe)             │
│  READ-ONLY tools only  │   │  advisory; never authorizes recovery      │
│  · rekey_get_wallet    │   │  · risk summary · guardian advice        │
│  · rekey_get_request   │   │  · resilience score explanation           │
│  · rekey_list_guardians│   │  graceful degradation when AI unavailable │
│  · rekey_get_health    │   └──────────────────────────────────────────┘
└────────────────────────┘
                │
                ▼ (read-only RPC; NO signing path)
┌──────────────────────────────────────────────────────────────────────┐
│ ON-CHAIN (Anchor) — programs/rekey — the authority                   │
│  WalletConfig · Vault · RecoveryRequest                             │
│  initialize_wallet · update_recovery_policy · initiate_recovery     │
│  approve_recovery · execute_recovery · cancel_recovery               │
│  expire_recovery · withdraw_sol                                     │
└──────────────────────────────────────────────────────────────────────┘
```

## 3. Layer responsibilities and trust boundaries

| Layer | May read | May write on-chain | May decide authorization? |
|---|---|---|---|
| Frontend | Everything on-chain; API responses | Only through an explicit user-signed wallet transaction | **No** |
| Application API | On-chain via RPC; its own DB | **Never** | **No** |
| MCP Gateway | On-chain via RPC; API read endpoints | **Never** | **No** |
| AI Assistant | On-chain via API/RPC; prompt context | **Never** | **No** |
| Anchor program | — | Yes | **Yes — sole authority** |

**Hard rule:** no layer outside `programs/rekey/` may implement a threshold check,
timelock check, policy-version check or ownership check that is presented to the user
as authoritative. Such a check is always an *advisory preview* of what the program
will do, and must be labelled as such.

## 4. Recovery state machine (program-owned)

```
                   guardian initiates
                          │
                          ▼
                     ┌─────────┐
                     │ Pending │
                     └─────────┘
                    ▲         │  (approvals >= threshold)
       owner cancels │         ▼
                    │     ┌─────────┐
                    └─────┤ Approved │──────┐
                          └─────────┘      │ execute (after timelock)
                                          ▼
                                     ┌──────────┐
                                     │ Executed │
                                     └──────────┘

  Pending/Approved ──(now > expires_at)──▶ Expired
```

Rules enforced by the program, mirrored here for documentation only:
- Guardian set: 1..5, unique, never contains the owner.
- Threshold: `1..guardians.len()`.
- Timelock: `60 .. 30 days`.
- Every request binds `wallet_config + nonce + new_owner + policy_version`.
- `update_recovery_policy` increments `policy_version`, invalidating older requests.
- Execution requires: policy version current, status `Approved`, approvals >= threshold,
  `now >= execute_after`, `now <= expires_at`.
- Cancellation is only available to the current owner and only while `now < execute_after`.
- `withdraw_sol` is only available to the current owner and preserves the vault rent floor.

## 5. PDAs and account derivation

| Account | Seeds | Notes |
|---|---|---|
| `WalletConfig` | `["wallet", initial_owner]` | `initial_owner` is immutable so the PDA is stable across recoveries. |
| `Vault` | `["vault", wallet_config]` | Program-owned; holds SOL. |
| `RecoveryRequest` | `["recovery", wallet_config, nonce_le_bytes]` | One request per nonce. |

The `RecoveryRequest` seeds use the nonce **as it is at the time of `initiate_recovery`**.
Because `next_nonce` is incremented inside the same instruction, the client must read
`next_nonce` from the wallet account and derive the PDA from the *current* value.

## 6. Simulated vs real operations

The distinction is a **product requirement**, not an implementation detail.

- Real: `initialize_wallet`, `update_recovery_policy`, `initiate_recovery`,
  `approve_recovery`, `execute_recovery`, `cancel_recovery`, `expire_recovery`,
  `withdraw_sol` — each requires a wallet signature from the acting party.
- Simulated: anything in the "Demo" surface. Simulated controls must be visually
  distinct (explicit "SIMULATED"/"DEMO" badge) and must never be presented as having
  changed chain state.
- Read-only (no signature): every MCP tool, every API GET, the AI assistant, the
  resilience score computation.

The API exposes a `mode` field of `live | simulated` on every recovery-related
response so the frontend can render the correct badge without inference.

## 7. AI integration

- Provider: OpenAI-compatible endpoint. In this environment: NVIDIA NIM at
  `https://integrate.api.nvidia.com/v1` (values supplied by `NVIDIA_BASE_URL` /
  `NVIDIA_NIM_API_BASE` + `NVIDIA_API_KEY` / `NVIDIA_NIM_API_KEY`).
- Model is configurable via `AI_MODEL`; a sensible default is required and must exist
  in `.env.example` with a placeholder value.
- The AI layer receives **only** redacted, structured wallet context. It never receives
  secret material, seed phrases, private keys or raw signed transactions.
- Failure modes handled explicitly: missing key, invalid key, provider unreachable,
  provider rate-limited (429), provider error (5xx), malformed response. Every one of
  these must degrade to a deterministic local fallback, never to a crash or a hang.
- The AI assistant is advisory. Its output must be labelled as AI-generated advice and
  must never be the sole basis for a state-changing action.

## 8. Environment variables

`.env` is never modified and never committed. `.env.example` carries placeholder
values only.

| Variable | Required | Purpose |
|---|---|---|
| `SOLANA_RPC_URL` | yes | Devnet RPC for the API/MCP layers. |
| `REKEY_PROGRAM_ID` | yes | Deployed Anchor program id. |
| `REKEY_ENV` | yes | `devnet` \| `localnet` \| `mainnet`. Mainnet must be blocked by default. |
| `AI_BASE_URL` | no | OpenAI-compatible base URL. Falls back to `NVIDIA_BASE_URL`. |
| `AI_API_KEY` | no | Falls back to `NVIDIA_API_KEY` / `NVIDIA_NIM_API_KEY`. |
| `AI_MODEL` | no | Model id. Falls back to `NVIDIA_SAFETY_MODEL`. |
| `PORT` | no | API port, default `8787`. |

## 9. Deployment

- Cluster: **Devnet only** for this milestone. Mainnet is blocked in code.
- The Anchor program must be SBF-built and deployed to satisfy hackathon eligibility.
- The frontend is a static Vite bundle; the API is a separate Node process.
