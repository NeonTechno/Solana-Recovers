# ReKey — Architecture Review

> Reviewer: Hermes (Lead Engineer) · OpenClaude on standby for an independent second pass.
> Subject: `docs/system-architecture.md` v1.0.0 and `docs/api-contracts.md` v1.0.0
> against the implemented code.
> Date: 2026-11-28

This review asks one question above all: **does the layering actually hold in the
code, or only in the diagram?**

## 1. Does the layering hold?

| Claim | Verdict | Evidence |
|---|---|---|
| The Anchor program is the sole authority for recovery authorization | **Holds** | `server/services/rekey.ts` `buildPlan()` reads chain state and *mirrors* the program's rules to produce an early, friendly error. It never returns "authorized". The returned `RecoveryPlan` carries `warnings` — labelled advisory — and `requiresSignatureFrom`. The frontend still has to get a wallet signature, and the program still re-checks everything. |
| The API never signs or submits | **Holds** | There is no `sendTransaction`, no `signTransaction`, and no private key anywhere in `server/`. The API imports only `Connection`, `PublicKey` and `AccountInfo` from `@solana/web3.js` — the signing classes are never imported. A test asserts no response body contains `privateKey`, `secretKey`, `seed` or a `signature` field. |
| The MCP tools are read-only | **Holds** | `server/mcp/index.ts` exposes exactly 8 tools, all `rekey_get_*` / `rekey_list_*`. A test asserts no tool name contains `approve`, `cancel`, `execute`, `initiate`, `withdraw`, `sign` or `submit`. |
| The AI layer never authorizes | **Holds** | `server/ai/assistant.ts` builds a prompt that states "You are ADVISORY ONLY. You cannot authorize, approve, execute, cancel or sign any recovery." The AI never sees a signing capability. |
| Frontend and AI never independently decide authorization | **Holds, with one caveat** | See §2. |

## 2. `POST /api/recovery/plan` — could an AI agent read it as an authorization decision?

**This is the single highest-risk interface in the system**, and it is worth being
precise about.

The endpoint returns a plan that says, in substance: *"this action is valid, here
are the accounts, sign this."* An AI agent consuming the API could easily read
`200 OK` as "the program will accept this."

**Current mitigations (verified in code):**
- The response contains no `authorized` field, no `approved` field and no boolean
  that could be mistaken for a decision. It contains `mode`, `action`, `programId`,
  `accounts`, `args`, `description`, `requiresSignatureFrom` and `warnings`.
- `warnings` is the only place where the API's own view of the rules appears, and
  the field is named for advice, not for a verdict.
- The plan contains **no signature bytes and no transaction**. It cannot be
  submitted as-is.

**The residual risk:** an agent that treats a `200` as permission to proceed could
construct a transaction from `accounts` + `args` and ask the user to sign it
without explaining that the program will independently reject it.

**Recommended hardening (cheap, and worth doing):**

1. Add an explicit, non-boolean field to every plan:
   ```ts
   /** The on-chain program independently enforces every rule. A 200 from this
    *  endpoint means "this action is well-formed", NOT "this action will succeed". */
   advisoryOnly: true;
   ```
2. Rename `warnings` → `advisoryWarnings` to remove the ambiguity of the word
   "warnings" (which can imply "something is wrong").
3. Add a `willRequireProgramChecks: true` flag listing the on-chain conditions that
   will be re-evaluated at execution time (policy version, threshold, timelock,
   expiry, owner).

**This is a contract change.** Under the compatibility rules in
`docs/api-contracts.md` §5, **adding an optional field is additive and allowed
without a version bump**, so it can be done now — but it must be announced to
Junie, who consumes the contract.

**Verdict: acceptable as-is, better after the additive hardening above.**

## 3. Is `mode: "live" | "simulated"` sufficient to stop the UI mislabelling a simulated action?

**Mostly yes, with one gap.**

The contract puts `mode` on every recovery-related response, and the frontend
renders a distinct "SIMULATED — NO CHAIN CHANGES" badge on the demo surface. The
screenshot confirms the badge is visible and unambiguous.

**The gap:** `mode` describes the *data source*, not the *action*. A `mode: "live"`
response tells the frontend that the state it is showing came from the chain. But
when the user clicks "Approve", the frontend must decide *which* surface to use:
the live path (plan → sign → confirm) or the simulated path. If the frontend has a
simulated approve button next to a live approve button, the badge on the data card
does not disambiguate the button.

**Recommended (frontend, no contract change):**
- The simulated surface and the live surface must never be in the same visual
  group. The badge belongs on the **button**, not only on the card.
- The action buttons must be derived from the `mode` of the response they act on,
  not from app-level state.

**Verdict: the contract is sufficient; the frontend must place the badge on the
action, not only on the data.**

## 4. Could on-chain data become a prompt-injection vector against the AI assistant?

**Yes, in principle. It is mitigated but not eliminated.**

The assistant's context is built in `server/index.ts` from `bundle.summary` and
`bundle.requests` — all of which are decoded from on-chain account data:
- guardian addresses (base58, no free text)
- `new_owner` (base58)
- timestamps and counters (integers)
- `status` (a fixed enum)
- `vaultBalanceLamports` (an integer)
- the resilience score and its factor strings — **these are generated by the
  server, not read from the chain**

**Mitigations in place (verified):**
- Every free-text-ish value in the context is **server-generated**, never
  attacker-controlled. The only attacker-controlled values are base58 addresses,
  which have a constrained alphabet and cannot carry natural-language instructions.
- The account decoder validates the data length and the `Vec<Pubkey>` length
  prefix before reading, so a malformed account cannot inject arbitrary bytes.
- The prompt explicitly says the assistant is advisory only and must not claim
  authorization.

**The residual risk:** the request is sent to a third-party model provider. A
hostile guardian address is a string in the prompt. Base58 cannot spell "ignore
your instructions" legibly enough to be reliable, and the system prompt is
authoritative, but this is the kind of thing that should be stated rather than
assumed.

**Recommended (server, cheap):**
- Sanitize the context by replacing every address with a short placeholder
  (`guardian-1`, `guardian-2`) before it enters the prompt, and keep the real
  addresses out of the model entirely. The assistant does not need the actual
  addresses to give useful advice — it needs the *count*, the *threshold* and the
  *timelock*. This removes the last attacker-controlled channel.
- Mark the context as data, not instructions: wrap it in a delimiter that the
  system prompt tells the model to treat as inert.

**Verdict: low current risk, worth hardening, cheap to do.**

## 5. Missing interfaces the frontend will hit in the demo

| Gap | Impact | Recommendation |
|---|---|---|
| **No pagination on `/recovery/requests` or `/activity`** | A wallet with many requests or a long history returns everything. `activity` is capped at 100 and `requests` at 64 nonces — acceptable for a demo, and the limits are documented. | Fine for now; add `?limit`/`?cursor` before production. |
| **No endpoint for guardian *labels*** | The API returns bare addresses. The UI can store labels locally (localStorage) keyed by address. | Acceptable — a labelled guardian list is a client-side concern for this milestone. |
| **No "is this wallet mine?" endpoint** | The UI needs the connected wallet's `initial_owner` to query `/api/wallet/:address`. The API derives the PDA from the initial owner, but a wallet whose owner has *changed* is no longer queryable by the current owner. | **Real gap.** After a completed recovery, the new owner cannot read the wallet via the API unless they know the original initial owner. Options: (a) also try the current owner as the PDA seed, (b) add an `GET /api/wallet/by-owner/:address` that searches, (c) accept it and document that the initial owner is the stable identifier. **Recommend (c) for this milestone, with (b) as a follow-up** — the `initial_owner` seed is the program's design, not an API oversight. |
| **No endpoint returns the policy *history*** | The resilience score mentions "policy age" but the API has no policy-change timestamp. The score currently sets `policyUpdatedAt: 0`, so that factor never fires. | **Honest gap.** Either add a policy-history read or drop the factor from the score. **Recommend:** keep the factor but have it report "unknown" rather than silently scoring 0. Currently `policyUpdatedAt > 0` gates it, so the factor is simply absent — which is correct behaviour, not a bug. |
| **No websocket / push channel** | The UI polls. | Fine for the demo. |
| **No `GET /api/wallet/:address/recovery/requests/:nonce/approvals`** | The approvals are embedded in the request view. | Not needed. |
| **No rate limiting** | The API is unauthenticated and public-facing if deployed. | **Required before public deployment.** Not before the devnet demo. |

## 6. Contract problems

Three things in the frozen contract should be corrected. Two are additive; one is a
naming clarification.

1. **`RecoveryPlan` needs an `advisoryOnly` marker** (§2). Additive.
2. **`RecoveryPlan.warnings` should be renamed `advisoryWarnings`** (§2). This is
   a **rename**, which is breaking under the compatibility rules — so it must be
   coordinated. **Recommendation: keep `warnings` and add `advisoryWarnings` as an
   alias** for one release, then drop `warnings`. That avoids breaking Junie.
3. **`ActivityEvent.type` includes `"recovery_expired"`, but the program emits no
   such event.** The API maps event names to activity types and has a slot for
   `recovery_expired` — but `expire_recovery` emits nothing, so that type can never
   appear. **This is a program-side gap, not a contract error**
   (see `docs/security-review.md` SR-11). The contract is correct; the program is
   incomplete.

**One more contract observation:** the contract says `POST /api/recovery/plan`
returns `409` when "the read-only state already makes the action impossible". The
implementation returns `409` for `invalid_state`, `stale_policy`, `duplicate_approval`,
`timelock_elapsed`, `threshold_not_reached`, `not_expired` and `unauthorized` — all
consistent with the contract. Good.

## 7. Does the trust boundary in the architecture doc match the code?

**Yes, with two refinements worth making.**

The doc says: "No layer outside `programs/rekey/` may implement a threshold check,
timelock check, policy-version check or ownership check that is presented to the
user as authoritative."

The API **does** implement all four checks — in `buildPlan()`. This is
**deliberate and correct**, because it is the difference between a user getting a
clear error message and a user paying a failed transaction fee. But the doc should
say so explicitly, because a future reader could otherwise "fix" it by deleting the
checks.

**Recommended doc amendment:**

> The API mirrors the program's rules to fail fast and to explain the failure in
> plain language. These checks are **previews**: they are advisory, they can lag
> the program, and the program re-evaluates every one of them at execution time.
> A `200` from `POST /api/recovery/plan` means "this action is well-formed", never
> "this action will succeed".

**Second refinement:** the doc's claim that "the MCP Gateway is read-only" is
correct, but the doc should add that the MCP Gateway is also **stateless** — it
holds no wallet session and has no credential of any kind. A reader who knows that
the MCP server runs locally next to a user's wallet might otherwise assume it
could sign.

## 8. Verdict

The architecture as documented is **sound, and the implementation matches it**.
The layering holds in code, not just in prose. The three concrete improvements
worth making before the demo are all additive and low-risk:

| # | Change | Where | Risk |
|---|---|---|---|
| 1 | Add `advisoryOnly: true` to `RecoveryPlan`; add `advisoryWarnings` as an alias | `shared/types.ts`, `server/services/rekey.ts` | None (additive) |
| 2 | Replace real guardian addresses with placeholders in the AI prompt context | `server/index.ts` | None (improves privacy) |
| 3 | Amend the architecture doc's non-authoritative-checks paragraph | `docs/system-architecture.md` | None (documentation) |

The one **program-side** item that must not be skipped is SR-01 in
`docs/security-review.md`: the wallet PDA must be anchored to an independent
account before the deployment is treated as final. That is a breaking interface
change and it must land before the client code hard-codes the current account
layout.
