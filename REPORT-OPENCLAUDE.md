# REPORT — OPENCLAUDE

**Role:** principal architect & independent security reviewer, ReKey
**Date:** 2026-11-28
**Worktree:** `/Users/user/solana-recovers-agents/openclaude-review`
**Branch:** `feature/security-architecture-review`
**Mandate:** read-only review — no program, server or frontend code was modified.

---

## 1. Files changed

Exactly three files, all review documents. Nothing else was touched.

| File | Status | Size | Lines |
|---|---|---|---|
| `docs/security-review.md` | added | 34,946 bytes | 562 |
| `docs/architecture-review.md` | added | 75,402 bytes | 568 |
| `REPORT-OPENCLAUDE.md` | added | this file | — |

**Deliberately not committed:** `TASK-BRIEF-OPENCLAUDE.md` remains **untracked** in the
working tree. It is the task specification, not a review artefact, and the brief
requires that the changed-file set be "exactly your 2-3 review documents". The lead
may want it committed separately as the brief-of-record.

**Read-only confirmation:** `programs/rekey/**`, `src/**` and `server/**` were not
modified. `git status` shows no changes to any file outside `docs/` and this report.

---

## 2. Findings — summary and count by severity

### 2.1 `docs/security-review.md` — Anchor program (`programs/rekey/src/lib.rs`)

| Severity | Count | IDs |
|---|---|---|
| Critical | 0 | — |
| High | 2 | SR-01, SR-02 |
| Medium | 4 | SR-03, SR-04, SR-05, SR-06 |
| Low | 2 | SR-07, SR-08 |
| Info | 3 | SR-09, SR-10, SR-11 |
| **Total** | **11** | |

**Verdict:** no Critical finding. No exploitable account-validation, signer-check,
PDA-collision, reinitialization or arithmetic defect. The authorization logic is
materially sound and several boundaries are exactly right (15 controls verified
correct, listed as C-1..C-15). Two findings are genuinely exploitable in the protocol
sense — **SR-01** (the approval window outlives the cancellation window, so a request
can reach threshold after the owner has lost the ability to cancel it) and **SR-02**
(unbounded concurrent requests with last-executed-wins ownership). **SR-10** (zero
integration coverage) is a hard release gate.

**Overall: NOT READY FOR MAINNET.** Fit for Devnet use once SR-01, SR-02, SR-08 and
SR-10 are addressed and the deployment keypair is rotated off the published
placeholder.

The document also records **12 items explicitly out of scope** (passkeys, SPL tokens,
mainnet, guardian-to-wallet indexing, multi-sig owners, program-side simulation, and
others) so the owner can see the boundary of what was actually reviewed.

### 2.2 `docs/architecture-review.md` — API / MCP / AI / contracts

| Severity | Count | IDs |
|---|---|---|
| Critical | 0 | — |
| High | 3 | AR-01, AR-02, AR-03 |
| Medium | 6 | AR-04, AR-05, AR-06, AR-07, AR-09, AR-10 |
| Low | 5 | AR-08, AR-11, AR-12, AR-13, AR-14 |
| Info | 1 | AR-15 |
| **Total** | **15** | |

**Verdict:** the read-only guarantee is **real, not aspirational** — verified by grep,
the server tree contains zero signing primitives, and the layering rule holds
structurally rather than by convention. The problems are contract-level, not
privilege-escalation-level: the server's program id does not match the program
(AR-01), the plan endpoint's `address` field serves two incompatible roles (AR-02),
the action enum omits three instructions the protocol supports (AR-03), the API
re-implements authorization and returns 409s that read as decisions (AR-04), the
`mode` discriminator is decorative (AR-05), and the AI layer accepts unvalidated
model output (AR-07).

**Overall: the architecture is correct in principle and unimplementable as frozen.**
The frozen contracts and the implemented server disagree in at least six load-bearing
places; two of them (AR-01, AR-02) make the product non-functional end-to-end.

### 2.3 Combined

| Severity | Security review | Architecture review | **Combined** |
|---|---|---|---|
| Critical | 0 | 0 | **0** |
| High | 2 | 3 | **5** |
| Medium | 4 | 6 | **10** |
| Low | 2 | 5 | **7** |
| Info | 3 | 1 | **4** |
| **Total** | **11** | **15** | **26** |

### 2.4 Top of the remediation list

**Before any Devnet end-to-end demo (Gate 1):**

1. **AR-01** — reconcile the program id. `vibe-api/server/solana/read.ts:13-15` and
   `vibe-api/server/config.ts:53-56` default to `CuNNoYhAJsGNKZzi7NbEZjVTR2T8GUZyNKMN8SUPzRhS`;
   `programs/rekey/src/lib.rs:3` declares `284Xsc92KLKwKb7gBYAB8CXWc979FHL11tc185UYqcbP`.
   Every wallet read currently 404s and `/api/health` reports green while the service
   is non-functional.
2. **AR-02** — split the plan endpoint's `address` into a wallet lookup key and a
   separate required-signer field. Guardians cannot currently approve or initiate,
   and cancel breaks after a completed recovery.
3. **AR-03** — extend the action enum with `initialize_wallet`,
   `update_recovery_policy` and `withdraw_sol`. The two most security-relevant owner
   operations have no plan path at all.
4. **SR-01** — make the approval window and the cancellation window coextensive.
5. **SR-02** — bound live requests per wallet or define a deterministic supersede rule.

**Before any external pilot (Gate 2):** AR-04 (stop adjudicating in the API; make the
409s explicitly advisory), AR-07 (delimit the prompt, post-validate the model's
output), AR-09 (authenticate and rate-limit the paid AI proxy; bound the RPC fan-out),
AR-05 (make `mode` real or delete it), AR-11 (add advisory markers to the plan
payload), AR-13 (call `assertMainnetBlocked` in the MCP gateway).

**Release gates (Gate 3):** SR-10 (build the integration-test harness — LiteSVM or
`solana-program-test`), SR-08 (rotate the program-id keypair), SR-09 (record and
multisig the upgrade authority), AR-06, AR-10, AR-12, AR-08, AR-14, AR-15.

Full prioritised tables with one-line fixes are in `security-review.md` §5 and
`architecture-review.md` §6.

---

## 3. Commands actually run

All commands were read-only. The sandbox resets the working directory between
invocations, so every command was issued with an absolute path or a `cd … && …`
prefix.

### 3.1 Program verification (executed, output observed)

```bash
cargo fmt --all -- --check
#   exit 0, no output — formatting is clean

cargo test --manifest-path programs/rekey/Cargo.toml
#   15 passed; 0 failed  (8m21s)
```

**One of the 15 is `test_id`, an Anchor macro-generated placeholder, not a
hand-written test.** I established this by compiling and running a minimal probe
crate containing only a `declare_id!` and a one-instruction `#[program]` module: it
also produced exactly one `test_id`. **The program therefore has 14 hand-written unit
tests**, matching the 14 `#[test]` attributes at `lib.rs:705, 711, 716, 722, 728, 734,
741, 760, 772, 794, 817, 835, 849, 858`. The probe crate was deleted. This matters
because the previously published `docs/security-review.html` states "15 tests", which
over-counts by one, and the implementation roadmap claims 7, which under-counts.

### 3.2 Grep / search (exact patterns, results quoted in the findings)

```bash
# MCP read-only guarantee — zero signing primitives server-side
grep -rnE "sendTransaction|sendRawTransaction|signTransaction|signAllTransactions|new Keypair|Keypair.fromSecretKey|requestAirdrop|SecretKey|privateKey|mnemonic|bip39|wallet.connect" vibe-api
#   → only src/App.tsx:103, :108, :276 (Devnet faucet) and
#     server/test/api.test.ts:331-332 (a negative test asserting no key material leaks)

grep -rn "@fastify/cors" . --include="*.ts" --include="*.tsx" --include="*.json"
#   → zero hits outside server/package-lock.json

grep -rn "accountDiscriminator" vibe-api --include="*.ts"    # → 1 hit (its own definition, read.ts:31)
grep -rn "isValidBase58"    vibe-api --include="*.ts"        # → 1 hit (its own definition, read.ts:192)
grep -rn "recovery_expired" vibe-api --include="*.ts"        # → 1 hit (shared/types.ts:75); never produced
grep -rn "buildPlan"        vibe-api/server/mcp              # → never called from dispatch
grep -rn "guardians"        vibe-api/server/index.ts         # → only guardianCount at :193
```

Note: an early zsh invocation failed with `(eval):1: no matches found:
--include=*.ts` because zsh expands bare globs. All patterns were re-run quoted
(`--include="*.ts"`) and piped through `grep -v node_modules`.

### 3.3 File reads

- `programs/rekey/src/lib.rs` — **all 868 lines, read in full and re-verified
  line-by-line**; every citation in both documents was re-derived from the file
  rather than from memory.
- `hermes-lead/docs/system-architecture.md` (175 lines),
  `hermes-lead/docs/api-contracts.md` (287 lines),
  `engineering-handoff.md`, `implementation-roadmap.md` — the frozen contracts.
- `vibe-api/shared/types.ts` (155 lines) — the shared type surface.
- `vibe-api/server/services/rekey.ts`, `server/mcp/index.ts`, `server/ai/assistant.ts`,
  `server/index.ts`, `server/config.ts`, `server/solana/read.ts`,
  `server/rewards/engine.ts` (285 lines), `server/test/mcp.test.ts` (278 lines) —
  re-read in full because `server/services/rekey.ts` had changed on disk between
  sessions, invalidating inherited line numbers. Every citation was re-derived from
  the current file.
- `openclaude-review/src/security/transactionSimulation.ts` (142 lines),
  `src/recoveryDemo.ts` (44 lines), `src/App.tsx` (relevant sections).
- `openclaude-review/docs/security-model.md`, `docs/architecture.md`,
  `docs/security-review.html` — to compare published claims against the code.
- `/Users/user/solana-recovers-coordination/` — `ARCHITECTURE.md`,
  `INTEGRATION_CONTRACTS.md`, `DECISIONS.md`, `BLOCKERS.md`.
- `/Users/user/.hermes/skills/openclaw-imports/solana-dev/references/security.md` —
  the Solana security reference, per the brief.

### 3.4 Git

```bash
git branch --show-current     # feature/security-architecture-review
git status --short
git log --oneline -3
git diff / git diff --cached
git add docs/security-review.md docs/architecture-review.md
git commit -m "docs: add independent Anchor security and architecture reviews"
```

### 3.5 Not run

- `anchor test` — no local validator and no deployed Devnet program were available.
  This absence is the basis of **SR-10** (zero integration coverage) and of the
  assessment that the API's plan paths have never been exercised against the program.
- No build, deploy, or RPC write. The review is read-only by mandate.
- The server test suite (`vibe-api/server/package.json` → `node --experimental-strip-types
  --test test/*.test.ts`) was **read but not executed**. The repository's root `npm test`
  runs only the frontend tests in `tests/*.test.js`.

---

## 4. Verified vs. inferred

### 4.1 VERIFIED — by reading the source or running a command

| Claim | How it was established |
|---|---|
| The Anchor program's authorization logic, boundary conditions and account constraints are as described in C-1..C-15. | `lib.rs` read in full, re-verified line-by-line; every cited line range re-read. |
| The program has **14** hand-written unit tests, not 15. | `cargo test` output, plus a compiled probe crate proving `test_id` is macro-generated. |
| The program compiles and its unit tests pass; formatting is clean. | `cargo test` → 15 passed / 0 failed; `cargo fmt --all -- --check` → exit 0. |
| **The MCP read-only guarantee holds.** Zero signing primitives in the server tree; all 8 tools in `TOOLS` are reads; `dispatch` never calls `buildPlan`; the Solana layer exposes only `getAccountInfo`/`getBalance`/`getSignaturesForAddress`/`getTransaction`. | Grep over the whole `vibe-api` tree with an explicit pattern, plus reading `server/mcp/index.ts` and `server/solana/read.ts` in full. |
| The program id in the server does not match `lib.rs:3`. | Both constants read directly and compared. |
| The action enum in the contract and the implementation omits `initialize_wallet`, `update_recovery_policy`, `withdraw_sol`. | `api-contracts.md:197`, `server/index.ts:255-266`, `server/services/rekey.ts:211-423` vs `lib.rs:14-47, :49-79, :183-212`. |
| No CORS plugin, no rate-limit plugin, no auth plugin in the server. | `@fastify/cors` → zero hits outside the lockfile; `server/package.json` dependencies read in full. |
| `RecoveryRequest` stores no `threshold`; `expire_recovery` emits no event. | `lib.rs:537-548` and `lib.rs:317-326` read directly. |
| The AI layer interpolates the user's question and the on-chain facts into the same message with no delimiter, and accepts any non-empty string as model output. | `server/ai/assistant.ts:87-111` and `:229-239` read directly. |

### 4.2 INFERRED — reasoning from the source, not observed at runtime

| Claim | Basis and why it is not "verified" |
|---|---|
| The API returns HTTP 409 in the situations the contract specifies for 409. | Read from the `RekeyError` status codes and the Fastify error handler. The server was **not executed**. |
| The API's threshold/timelock/policy checks are byte-for-byte equivalent to the on-chain logic. | Derived by comparing the two implementations by hand. They were not diffed by executing both. |
| A guardian cannot currently approve or initiate a recovery through the API. | Follows from the `actor`-vs-`address` conflation and the `requiresSignatureFrom` value it produces. Not observed end-to-end. |
| The `/api/ai/assist` endpoint is an unthrottled cost-amplification vector. | Derived from the absence of auth/rate-limit code and the paid upstream call. No traffic was generated. |
| The RPC fan-out is O(160) sequential calls. | Derived by reading the loop bounds and the absence of `Promise.all` in the current file. Not measured. |
| The `expires_at` / `execute_after` boundary behaviour at an exact slot boundary. | Reasoned from the source's inequalities. The individual boundaries *are* covered by unit tests (`:817`, `:835`), but no slot-boundary transaction was observed. |
| SR-02's concurrent-request race. | Derived from the absence of a "one live request" invariant, not from an observed race. No concurrency test was run. |
| The `#[derive(Accounts)]` macro-generated code behaves as documented. | Anchor 0.31.1's constraint semantics are relied upon as documented. Only an integration test can confirm them. |

---

## 5. Remaining limitations

1. **The API and MCP server were not executed.** Every finding about `server/` is
   derived from reading source and test files, not from observing runtime behaviour.
2. **No integration test against a live program.** The program was compiled and its
   unit tests run, but the `#[program]` instructions were never exercised against a
   validator. Account-constraint findings are read from the `#[derive(Accounts)]`
   definitions — strong evidence, but not the same as observing the runtime rejection.
3. **The IDL was not consulted.** Event decoding (AR-12), the borsh layouts of the
   event structs, and the authoritative program id were taken from `lib.rs` and
   `Anchor.toml`. **If an IDL exists and disagrees with `lib.rs`, the IDL wins.**
4. **Line numbers in `vibe-api/` are a snapshot.** `server/services/rekey.ts` changed
   on disk between sessions, invalidating inherited line numbers; every citation was
   re-derived from the current file. If it changes again, re-verify the citations —
   re-verify the *findings*, do not re-trust them.
5. **The frontend was reviewed only where it intersects the API contract.**
   `src/recoveryDemo.ts` models no timelock, expiry or policy-version at all, which
   is worth the frontend team's attention but is outside this document's scope.
6. **The `hermes-lead/docs/` contracts are treated as frozen and authoritative.**
   Where implementation and contract disagree, this review reports the disagreement
   and does not assume which side is wrong — except where the program is ground truth
   (AR-01, AR-05's `mode`, AR-11's `api-contracts.md:230`), because the program is
   the only layer that can be authoritative about authorization.
7. **Severity is judgement, not a measured risk score.** "High" = breaks the product's
   core function or produces a materially wrong security picture before release.
   "Medium" = degrades a stated guarantee or creates an exploitable weakness under
   plausible conditions. "Low" = a contract or hygiene defect a careful reader would
   catch. "Info" = no current impact.
8. **The upgrade authority, the deployed bytecode and the IDL could not be inspected.**
   The repository contains no `target/deploy` artifact, no `.json` IDL and no recorded
   authority address. SR-08 and SR-09 are therefore stated as release gates rather
   than as confirmed defects.
9. **Two of my own claims were corrected during the work, and the corrections are
   recorded in the documents rather than silently applied.** (a) An earlier draft of
   AR-03 claimed `RecoveryPlan` was missing from the shared types; reading
   `shared/types.ts:128-138` disproved it, and the published finding is narrowed to
   the action enum. (b) The severity table in `architecture-review.md` carried two
   transcription errors (Medium read 7 against a list of 6; Low read 4 against a list
   of 5); the table was corrected and the error is disclosed in the document.

---

## 6. Branch and commit SHA range

| Item | Value |
|---|---|
| Branch | `feature/security-architecture-review` |
| Base (`main`, also the merge-base) | `b7d6294365521d7922845af63b8a65b6aff4276f` |
| Commit 1 — review documents | `2d94a779a823498a5a71829aa1903d9f8f544c4f` |
| Commit 2 — this report | `3e29fd32397d468b3eddeab172f3878c226969e2` |
| Commit 3 — SHA-record amendment | the branch `HEAD`; its own SHA cannot be embedded in the file it amends without an infinite regress — read it with `git log --oneline main..HEAD` |
| **SHA range** | `b7d6294365521d7922845af63b8a65b6aff4276f..HEAD` on `feature/security-architecture-review` — 3 commits, all documentation, no code touched |

Commit 1 message: `docs: add independent Anchor security and architecture reviews`
(2 files, 1,130 insertions — `docs/security-review.md`, `docs/architecture-review.md`).

**`main` was not modified. Nothing was merged to `main`. Nothing was force-pushed.
The branch was not pushed to the remote** — publishing it is the lead's call, and the
brief authorises commits to this branch only.

---

## 7. Deliverables checklist

| Required by the brief | Where |
|---|---|
| A. `docs/security-review.md` — Anchor program review, 10 named areas | Delivered. §2 findings, §3 controls verified correct, §4 out of scope, §5 prioritised remediation, §6 verification, §7 limitations. |
| B. `docs/architecture-review.md` — layering, MCP read-only, plan risk, live/simulated, AI injection, missing interfaces, contract problems | Delivered. §3 layering, §4 MCP guarantee (verified), §5 findings AR-01..AR-15, §6 remediation gates, §7 verification, §8 limitations. |
| C. Out-of-scope list | `security-review.md` §4 — 12 numbered items (passkeys, SPL tokens, mainnet, guardian indexing, multi-sig owners, program-side simulation, and others). |
| DoD 1 — files changed | §1 above |
| DoD 2 — findings summary + count by severity | §2 above |
| DoD 3 — commands actually run | §3 above |
| DoD 4 — verified vs. inferred | §4 above |
| DoD 5 — remaining limitations | §5 above |
| DoD 6 — branch and commit SHA range | §6 above |
| Constraint — code read-only | Confirmed in §1. |
| Constraint — never merge to `main`, never force-push | Confirmed in §6. |
| Constraint — no secret values printed | No credentials, keys or secret values appear in any of the three documents. |
