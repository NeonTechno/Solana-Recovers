# ReKey — API & MCP Contracts

> Owner: Hermes (contracts) · Implementer: Vibe · Consumer: Junie
> Version: 1.0.0 · Last updated: 2026-11-28
>
> **These schemas are frozen for this milestone.** Junie may code against them
> immediately; Vibe must implement them exactly. Any change requires a decision
> entry in `docs/engineering-handoff.md` and a message to both agents.

## 0. Shared conventions

- Base URL: `http://localhost:8787` (devnet default).
- Content type: `application/json; charset=utf-8`.
- All money amounts are **integer lamports** (`u64`) in field names ending `_lamports`.
- All timestamps are **integer unix seconds** (`i64`).
- All pubkeys are **base58 strings**.
- Every response that touches recovery carries `"mode": "live" | "simulated"`.
- Every error response: `{ "error": { "code": string, "message": string, "details"?: unknown } }`.
- HTTP status maps: `400` invalid request, `404` not found, `409` program-state conflict,
  `502` upstream (RPC/AI) failure, `503` provider unavailable/rate-limited.
- **The API never signs or submits a state-changing transaction.** It returns
  prepared instructions for the frontend to have the wallet sign, or a read-only view.

### Shared TypeScript types

These live in `shared/types.ts` (owned by Vibe) and are mirrored on the frontend.

```ts
export type Cluster = "devnet" | "localnet" | "mainnet";
export type Mode = "live" | "simulated";

export type RecoveryStatus =
  | "Pending" | "Approved" | "Cancelled" | "Executed" | "Expired";

export interface Guardian {
  address: string;
  label?: string;
  /** true when this guardian has approved the request in question */
  approved?: boolean;
}

export interface WalletPolicy {
  guardians: Guardian[];
  threshold: number;
  delaySeconds: number;
  policyVersion: number;
  nextNonce: number;
}

export interface WalletSummary {
  walletConfig: string;
  vault: string;
  initialOwner: string;
  owner: string;
  policy: WalletPolicy;
  vaultBalanceLamports: number;
  /** program id this data was read from */
  programId: string;
  cluster: Cluster;
  mode: Mode;
}

export interface RecoveryRequestView {
  request: string;
  walletConfig: string;
  newOwner: string;
  nonce: number;
  policyVersion: number;
  createdAt: number;
  executeAfter: number;
  expiresAt: number;
  approvals: string[];
  threshold: number;
  status: RecoveryStatus;
  /** seconds until execute_after; negative once elapsed */
  secondsUntilExecutable: number;
  mode: Mode;
}

export interface ActivityEvent {
  signature: string;
  type:
    | "wallet_initialized" | "policy_updated" | "recovery_initiated"
    | "guardian_approved" | "recovery_executed" | "recovery_cancelled"
    | "recovery_expired" | "sol_withdrawn";
  blockTime: number | null;
  description: string;
  /** raw program event fields, already decoded */
  data: Record<string, string | number>;
}

export interface ResilienceScore {
  /** 0..100 */
  score: number;
  band: "critical" | "weak" | "fair" | "strong" | "resilient";
  factors: Array<{
    id: string;
    label: string;
    /** -1 (hurts) .. +1 (helps) */
    impact: number;
    detail: string;
  }>;
  /** deterministic; no AI required */
  computedAt: number;
}

export interface LifelineReward {
  id: string;
  title: string;
  description: string;
  /** 0..100 progress toward the reward */
  progress: number;
  earned: boolean;
  /** points awarded when earned */
  points: number;
  /** what the user must do, in product terms */
  requirement: string;
}

export interface AiAssistantReply {
  reply: string;
  /** true when the deterministic local fallback produced this */
  degraded: boolean;
  /** the provider actually used, when not degraded */
  provider?: string;
  model?: string;
  /** data the assistant was allowed to see */
  contextUsed: string[];
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
```

### `GET /api/health`

```json
{
  "ok": true,
  "cluster": "devnet",
  "programId": "CuNNoYhAJsGNKZzi7NbEZjVTR2T8GUZyNKMN8SUPzRhS",
  "rpcReachable": true,
  "programDeployed": false,
  "ai": { "configured": true, "reachable": true, "model": "..." },
  "version": "1.0.0",
  "time": 1764300000
}
```

`ok` now reflects RPC reachability, and `programDeployed` reports whether the
program account exists and is executable on the target cluster. **Changed in
v1.0.1 (AR-01):** a health endpoint that cannot detect that it is talking to a
non-existent program is not a health endpoint — a wrong program id makes every
wallet read 404 while the health check still says "ok".

`ai.reachable` is `false` (never an error) when the provider is missing or down — the
service must still start and serve every non-AI route.

## 2. Application API — wallet & recovery

### `GET /api/wallet/:address`
Returns `WalletSummary`. `404` if the address has no `WalletConfig` PDA.
The `address` is the **initial owner** (the PDA seed), not the current owner.

### `GET /api/wallet/:address/recovery/requests`
Returns `{ "requests": RecoveryRequestView[] }`, newest nonce first.
Requests are discovered by scanning the wallet's known nonces and reading each
`["recovery", wallet_config, nonce_le_bytes]` PDA. Missing PDAs are skipped.

### `GET /api/wallet/:address/recovery/requests/:nonce`
Returns a single `RecoveryRequestView`. `404` if the PDA does not exist.

### `GET /api/wallet/:address/resolve?actor=<base58>`
Returns the role an address plays for a wallet. **Added in v1.0.1 (AR-02).**
```json
{
  "initialOwner": "<base58>",
  "currentOwner": "<base58>",
  "isInitialOwner": false,
  "isCurrentOwner": false,
  "isGuardian": true,
  "guardianIndex": 0
}
```

### `GET /api/wallet/:address/activity`
Returns `{ "events": ActivityEvent[] }`, newest first, max 100.
Decoded from program logs / account history for the wallet's PDAs.

### `GET /api/wallet/:address/rewards`
Returns `{ "score": ResilienceScore, "rewards": LifelineReward[], "streakDays": number }`.

### `GET /api/wallet/:address/score`
Returns a `ResilienceScore` only.

### `POST /api/ai/assist`
Request:
```json
{
  "address": "<base58>",
  "question": "Is my recovery setup safe?",
  "intent": "security_review" | "guardian_advice" | "recovery_help" | "freeform"
}
```
Response: `AiAssistantReply` (HTTP 200).

**Never** returns 5xx for an AI problem. If the provider is unavailable, the service
returns a deterministic local assessment with `degraded: true` and HTTP 200.
Only a malformed request body returns `400`.

### `POST /api/recovery/plan`
Request:
```json
{
  "wallet": "<base58>",
  "actor": "<base58>",
  "action": "initiate" | "approve" | "cancel" | "execute" | "expire",
  "newOwner"?: "<base58>",
  "nonce"?: 0
}
```

- **`wallet`** is the wallet **lookup key** — the *initial owner*, which is the
  `WalletConfig` PDA seed.
- **`actor`** is the public key **expected to sign**. It must be a registered
  guardian for `initiate` and `approve`, and the **current** owner for `cancel`.
- `address` is retained as a **deprecated alias** for `wallet` for one release.
- When `actor` is omitted it defaults to `wallet`, which preserves the original
  single-role behaviour for wallets that have never completed a recovery.

> **Changed in v1.0.1 (AR-02).** Previously the single `address` field had to
> serve both roles, which made guardian approval unbuildable through the API and
> denied cancellation to a current owner who was not the initial owner. This is
> an additive change plus a deprecation; `address` still works.

Use `GET /api/wallet/:address/resolve?actor=<base58>` to discover an address's role.
Response: a **prepared, unsigned instruction plan** for the frontend to sign:
```json
{
  "mode": "live",
  "action": "approve",
  "programId": "...",
  "accounts": { "walletConfig": "...", "recoveryRequest": "..." },
  "args": { "nonce": 0 },
  "description": "Guardian approves recovery request #0",
  "requiresSignatureFrom": "<guardian address>",
  "advisoryOnly": true,
  "warnings": ["The request is bound to policy version 1; the wallet policy is now version 2."],
  "advisoryWarnings": ["The request is bound to policy version 1; the wallet policy is now version 2."]
}
```

`advisoryOnly` is always `true`. **A 200 from this endpoint means the action is
well-formed, never that the program will accept it.** The on-chain program
independently re-evaluates every rule at execution time. `advisoryWarnings` is an
alias of `warnings`, added so the advisory nature is explicit in the field name.

This endpoint **does not sign and does not submit**. It only prepares. The frontend
hands it to the wallet adapter. The `warnings` array carries *advisory* preview of
what the program will enforce — it is never presented as authorization.

`400` for an unknown action or missing required argument. `409` when the read-only
state already makes the action impossible (e.g. request already `Executed`).

## 3. MCP Gateway

Transport: **stdio**. Implemented with the official TypeScript MCP SDK.
The server is read-only: it exposes no tool that signs, submits or mutates anything.

### Tool: `rekey_get_wallet`
- Input: `{ address: string }`
- Output: `WalletSummary` (minus `mode`, which is always `live` for MCP).
- Errors: invalid base58 → tool error `invalid_address`.

### Tool: `rekey_get_recovery_request`
- Input: `{ address: string, nonce: number }`
- Output: `RecoveryRequestView`.

### Tool: `rekey_list_guardians`
- Input: `{ address: string }`
- Output: `{ guardians: Guardian[], threshold: number, delaySeconds: number, policyVersion: number }`.

### Tool: `rekey_get_activity`
- Input: `{ address: string, limit?: number }` (default 50, max 100)
- Output: `{ events: ActivityEvent[] }`.

### Tool: `rekey_get_health`
- Input: `{}`
- Output: `{ ok, cluster, programId, rpcReachable, aiConfigured, version }`.

### Tool: `rekey_get_resilience_score`
- Input: `{ address: string }`
- Output: `ResilienceScore`.

### Tool: `rekey_get_rewards`
- Input: `{ address: string }`
- Output: `{ score, rewards, streakDays }`.

### Tool: `rekey_get_wallet_health`
- Input: `{ address: string }`
- Output: a combined, agent-friendly summary:
  `{ wallet, policy, activeRequest | null, score, recommendations: string[] }`.

### MCP guarantees
- No `rekey_*` tool performs a state change. Any future write tool requires a
  separate explicit approval flow and a decision record.
- The MCP server must not echo secret material. It reads only public chain state.
- Tool errors use a stable `code` so an agent can branch on them.

## 4. Frontend ↔ API integration rules

- The frontend uses one typed client module (`src/api/client.ts`, owned by Junie)
  generated against the types above.
- The frontend must show a **live** badge for data read from the API/chain and a
  distinct **SIMULATED** badge for the demo surface.
- Any action that changes chain state must go through `POST /api/recovery/plan` →
  wallet adapter sign → `connection.sendTransaction` → confirmation. The frontend
  must never assume a transaction succeeded before confirmation.
- The frontend must handle `502`/`503` from the API with a visible, non-blocking
  error state, and must not lose the user's current view.

## 5. Compatibility rules

- Additive changes (new optional field, new endpoint) are allowed without a version bump.
- Removing a field, renaming a field, changing an enum value, or changing a numeric
  type is a breaking change and requires `API_CONTRACT_VERSION` bump plus a note in
  `docs/engineering-handoff.md`.
- The API returns `X-ReKey-API-Version` on every response.
