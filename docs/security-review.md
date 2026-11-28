# ReKey Anchor Program — Independent Security Review

**Reviewer:** OPENCLAUDE (independent reviewer)
**Subject:** `programs/rekey/src/lib.rs` (Anchor 0.31.1, 868 lines, read in full)
**Date:** 2026-11-28
**Branch:** `feature/security-architecture-review`
**Program id:** `284Xsc92KLKwKb7gBYAB8CXWc979FHL11tc185UYqcbP` (`programs/rekey/src/lib.rs:3`)

> **Scope.** This document reviews the on-chain program only. The HTTP API, MCP
> gateway and AI layer are reviewed separately in
> [`architecture-review.md`](./architecture-review.md). Code was **read-only**
> for this review; every defect below is reported, not fixed.

---

## 1. Verdict

**No Critical finding. No exploitable account-validation, signer-check, PDA-collision,
reinitialization or arithmetic defect was identified.** The authorization logic is
materially sound and several of its boundaries are exactly right (Section 3).

Two findings are genuinely exploitable in the protocol sense (**SR-01**, **SR-02**) and
should be fixed before any Devnet end-to-end demo is treated as a security demo.
One finding is a hard release gate (**SR-10**: zero integration coverage).

**Overall: NOT READY FOR MAINNET.** Fit for Devnet use once SR-01, SR-02, SR-10 and
SR-08 are addressed and the deployment keypair is rotated off the published
placeholder.

| Severity | Count |
| --- | --- |
| Critical | 0 |
| High | 2 |
| Medium | 4 |
| Low | 2 |
| Info | 3 |
| **Total** | **11** |

---

## 2. Findings

Format: `ID | severity | file:line | what is wrong | scenario | fix`.

### SR-01 — High — `programs/rekey/src/lib.rs:262, 297-298, 311`

**What is wrong.** The window in which a guardian may approve a request
(`now <= request.expires_at`, `lib.rs:262`) is **seven days longer** than the window in
which the owner may cancel it (`now < request.execute_after`, `lib.rs:311`).
`execute_after = created_at + delay_seconds` (`lib.rs:96-98`) and
`expires_at = execute_after + REQUEST_GRACE_SECONDS` (`lib.rs:99-101`, with
`REQUEST_GRACE_SECONDS = 7 days` at `lib.rs:8`). The approval window therefore spans
`[created_at, execute_after + 7d]`, while the cancellation window spans only
`[created_at, execute_after)`. After `execute_after` the owner is locked out, but the
request can still be pushed to `Approved` and then executed.

**Scenario.** A 2-of-3 wallet with a 24-hour delay. Guardian A (malicious, or
compromised, or simply acting without the owner's knowledge) calls `initiate_recovery`
at `t = 0`. `execute_after = t + 24h`, `expires_at = t + 24h + 7d`. At
`t = 24h + 1 minute` the owner tries to cancel and is rejected with `TimelockElapsed`
(`lib.rs:311`) — the request is already unstoppable by cancellation. Guardian B
approves; `record_guardian_approval` accepts it because `now <= expires_at`
(`lib.rs:262`) and the status is still `Pending` (`lib.rs:258-261`), so the status flips
to `Approved` (`lib.rs:274-276`). The owner can no longer cancel
(`lib.rs:307-310` rejects non-Pending/non-Approved states — `Approved` is still
cancellable, but the timelock check at `lib.rs:311` blocks it). Anyone calls
`execute_recovery`: the policy version matches, the status is `Approved`, the
approval count meets the threshold, `now >= execute_after` and `now <= expires_at`
both hold, and `wallet.owner` is overwritten (`lib.rs:300-303`). The owner has lost
the wallet, and their only recourse is `update_recovery_policy` — which invalidates
the request only because it bumps `policy_version` (`lib.rs:66-69`) — an escape hatch
that is not documented anywhere in `docs/architecture.md` or `docs/security-model.md`.

**Note on severity.** This is not a bug in the sense of a coding mistake; the grace
period was presumably intended to let a *legitimate* approval land after a slow
guardian. The defect is that the grace period was granted to approvals **without
extending the owner's cancellation window to match**. The two windows should be
coextensive.

**Fix (recommended).** Require `now < request.execute_after` in
`record_guardian_approval` (`lib.rs:244-278`), i.e. collect the threshold inside the
cancellable window. If late approvals are genuinely wanted, then instead extend
`cancel_recovery_transition` to allow cancellation while `now <= request.expires_at`
**and** the status is `Pending` (cancellation must remain possible until the status
flips to `Approved`), and document the policy-update escape hatch. Do not ship both
windows as they are today.

### SR-02 — High — `programs/rekey/src/lib.rs:103-107, 109-119, 300-303`

**What is wrong.** There is no per-wallet invariant on the number of live recovery
requests, and no ordering rule between them. `initiate_recovery` creates a request
under a fresh nonce and increments `next_nonce` (`lib.rs:103-107`); it never checks
whether another non-terminal request already exists for this wallet. Consequently any
single registered guardian can create an unbounded number of concurrent `Pending`
requests, several of which can independently reach `Approved`, and
`execute_recovery_transition` overwrites `wallet.owner` unconditionally
(`lib.rs:300-303`) with **no check that this request is the newest or the only live
one**.

**Scenario.** Guardians A and B (2-of-3 threshold) are colluding, or A is malicious
and B is socially engineered into approving a request it did not notice.
`initiate_recovery` is called twice, producing request #0 (new owner X) and request #1
(new owner Y). Both reach `Approved`. After the timelock, an attacker executes
request #1 (owner becomes Y), then executes request #0 (owner becomes X). The final
owner is whichever request was executed **last**, and the intermediate owner Y has no
opportunity to react. The victim's `initial_owner` — the account the API and the
frontend key everything on — no longer matches `wallet.owner`, and the wallet's
recovery posture is now governed by a policy that the original owner set for a
different owner.

**Fix.** Enforce at most one non-terminal (`Pending` or `Approved`) request per wallet.
Two viable designs: (a) store the active request's nonce on `WalletConfig` and reject
`initiate_recovery` while it is set, clearing it on cancel/expire/execute; or (b) keep
the count but require at execution time that the executing request has the **highest**
nonce among live requests (`request.nonce == wallet.next_nonce - 1`), so that later
requests supersede earlier ones deterministically and the newest approved request is
the only executable one. Option (b) is a smaller change but does not by itself stop a
guardian from flooding the account with requests (see SR-05).

### SR-03 — Medium — `programs/rekey/src/lib.rs:176-181` (no `emit!`), `lib.rs:563-618`

**What is wrong.** Every other state-changing instruction emits an event
(`WalletInitialized` `:41`, `RecoveryPolicyUpdated` `:71`, `RecoveryInitiated` `:121`,
`GuardianApproved` `:138`, `RecoveryCancelled` `:168`, `RecoveryExecuted` `:154`,
`SolWithdrawn` `:206`). `expire_recovery` (`lib.rs:176-181`) is the only one that
mutates state — it sets `status = Expired` at `lib.rs:324` — and emits **nothing**.

**Scenario.** A request times out. The on-chain record shows `status = Expired` but no
event, so an indexer or a user-facing activity feed has no signal that an expiry
occurred. The `ActivityEvent` type in the frozen contract
(`docs/api-contracts.md:85`, mirrored in `shared/types.ts:75`) includes a
`"recovery_expired"` member, but that member can never be produced by the program and
has no mapping in the server (`server/services/rekey.ts:506-514`). The contract
therefore promises an event the program does not emit, and no layer can supply it.

**Fix.** Add a `RecoveryExpired` event (`lib.rs` `#[event]` block) carrying at least
`wallet`, `request` and `nonce`, and `emit!` it from `expire_recovery`. Add the
matching `RecoveryExpired → "recovery_expired"` mapping server-side.

### SR-04 — Medium — `programs/rekey/src/lib.rs:300-303`

**What is wrong.** `execute_recovery_transition` re-checks the policy version
(`:285-288`), the status (`:289-292`), the approval count (`:293-296`), the timelock
(`:297`) and the expiry (`:298`), but it does **not** re-check
`request.new_owner != wallet.owner`. That check exists only at initiation
(`lib.rs:93`). Because `wallet.owner` changes at `lib.rs:301`, the value that
`lib.rs:93` compared against is not the value the request will be compared against at
execution time.

**Scenario.** A request was created when the owner was O. The wallet was recovered
once (owner becomes N) by a different, legitimately-executed request. The old request
#0 is still `Approved` — nothing invalidates it, because its `policy_version` still
matches (a recovery does not bump the policy version). Executing it sets
`wallet.owner = request.new_owner = O`, silently reverting ownership to the previous
owner. This is reachable in combination with SR-02 and is exactly the "last-executed
wins" hazard, but it is also reachable on its own: `initiate_recovery` only rejects
`new_owner == wallet.owner` at creation time (`lib.rs:93`), and the program never
re-checks it at execution.

**Fix.** Add `require!(request.new_owner != wallet.owner, RecoveryError::SameOwner);`
to `execute_recovery_transition` immediately before `lib.rs:301`. Consider also
requiring that the request's `new_owner` was not the owner at any point since
initiation — which requires the program to bump `policy_version` on execution, or to
store the owner-at-creation in the request.

### SR-05 — Medium — `programs/rekey/src/lib.rs:81-129, 345-508` (no `close` instruction)

**What is wrong.** `RecoveryRequest` accounts are created with `init` and a payer
(`lib.rs:388-399`) and are **never closed**. There is no `close` instruction anywhere
in the program, and no instruction that returns the request account's lamports. Every
request therefore permanently locks the rent-exempt minimum for `RecoveryRequest::SPACE`
(= 278 bytes, `lib.rs:551`), paid for by the initiating guardian (`payer = initiator`,
`lib.rs:390`).

**Scenario.** A guardian (or a griefing attacker who has compromised one guardian
key) calls `initiate_recovery` in a loop. Each call locks ~0.00156 SOL of rent and
increments `wallet.next_nonce` (`lib.rs:104-107`) without bound. Because `next_nonce`
is the *only* discovery mechanism for requests — the server scans nonces `0..nextNonce`
(`server/services/rekey.ts:159-161`, capped at 64) — the wallet's request list becomes
enormous, the API becomes slow, and older requests fall outside the scan window and
become **invisible to the UI even though they are still on-chain and still executable**.
Combined with SR-02, the hidden requests are still `Approved` and still executable.

**Fix.** Add a `close_recovery_request` instruction that requires the request to be in
a terminal state (`Cancelled`, `Executed` or `Expired`) and is authorized by the
current owner, closing the account and returning its rent to the owner or the payer.
Alternatively, bound the number of live requests per wallet and reuse closed PDAs.

### SR-06 — Medium — `programs/rekey/src/lib.rs:6, 229-232`

**What is wrong.** `MIN_DELAY_SECONDS = 60` (`lib.rs:6`), enforced by
`validate_policy` at `lib.rs:229-232`, allows a one-minute cancellation window. A
60-second window is not a usable recovery window: no human can notice a request,
check their guardians, and submit a cancellation within 60 seconds. The program
permits a policy that is nominally "protected" but practically unrecoverable by the
owner.

**Scenario.** A wallet is configured with `delay_seconds = 60`. A guardian initiates a
recovery at `t = 0`; at `t = 60` it is executable and the owner has had one minute of
warning. From the outside, the wallet looks like it has a timelock (the UI's score
engine would even flag it as "Short timelock", `server/rewards/engine.ts:99-106`), but
the protection is nominal. Note that the roadmap's Phase 2 Devnet end-to-end path
("initialize → policy → initiate → approve → execute") will want a short delay, which
is safe only for a throwaway demo wallet.

**Fix.** Raise `MIN_DELAY_SECONDS` to a value that is meaningful for production use
(at least 24 hours) and gate short delays behind a separate, clearly-labelled
test-only code path — or simply require the demo wallet to use a large delay and let
the test harness manipulate `Clock`. Explicitly document any wallet with a delay
under one day as unsuitable for holding value.

### SR-07 — Low — `programs/rekey/src/lib.rs:185-188, 505-507`

**What is wrong.** `withdraw_sol`'s `recipient` is an `UncheckedAccount` with a
`/// CHECK:` justification (`lib.rs:505-507`), and the only constraint on it is
`recipient != vault` (`lib.rs:185-188`). It may therefore be any account — including
another wallet's vault, a program-owned account, or a governance account.

**Why this is low and not higher — verified.** I checked the three ways this could go
wrong: (a) **double borrow** — impossible, because the recipient cannot be the vault
(`lib.rs:186`); (b) **account corruption** — impossible, because the recipient is never
deserialized, only its lamport balance is moved (`lib.rs:191`, `lib.rs:195`,
`lib.rs:204`), and lamports live outside an account's data buffer; (c) **vault
depletion** — impossible, because the rent floor is enforced before any write
(`lib.rs:337`). The `/// CHECK:` comment is accurate and the `UncheckedAccount` usage
is correct. The residual risk is that a wallet owner can send their own vault's SOL to
an account they should not have chosen — but they are the owner, and they could have
sent it anywhere anyway.

**Fix (optional).** Restrict the recipient to system-owned accounts, or require
`recipient` to be a signer, or document that the recipient is unconstrained by
design. Do not change this without a reason; it is currently correct.

### SR-08 — Low — `programs/rekey/src/lib.rs:3`, `Anchor.toml:9`

**What is wrong.** `declare_id!` is a hardcoded, publicly published placeholder
(`lib.rs:3`), and `Anchor.toml:9` binds the same value to `[programs.localnet]`. The
program id **is** the upgrade authority's identity: whoever holds the corresponding
program keypair can upgrade the program and drain every vault in existence. The
program id is published in this repository, in `docs/api-contracts.md:142`, and in
this review.

**Scenario.** The deployment keypair for `284Xsc92KLKwKb7gBYAB8CXWc979FHL11tc185UYqcbP`
is generated from a well-known seed, or is committed somewhere, or is held by a
single person. That person upgrades the program to a version whose `withdraw_sol`
requires no owner, and every vault is drained in one transaction. This is the
classic Solana program-id compromise and it is entirely preventable.

**Fix.** Before any Devnet deployment: generate a fresh keypair in a secure
environment, **never commit it**, sync the new id into `lib.rs` (`declare_id!`),
`Anchor.toml` (all cluster sections), `docs/api-contracts.md:142` and the server's
program-id default (`server/solana/read.ts:13-15`, `server/config.ts:53-56` — see
AR-01 in the architecture review), and verify the deployed program's authority is
recorded in the repo and held by a multisig.

### SR-09 — Info — whole file (no upgradeability control present)

**What is wrong.** The upgrade authority is not represented anywhere in the source and
**cannot be verified from the source**. Anchor deploys an upgradeable BPF program by
default; the authority is set at deploy time and is not encoded in `lib.rs`. This is
already flagged in `docs/security-model.md:34,52` and in the prior
`docs/security-review.html` review, and it remains open.

**Fix.** Record the upgrade authority address in the repository (as a config value,
not a key), move it to a multisig, add a deployment gate that refuses to deploy to
mainnet while the authority is a single EOA, and add an operational check that alerts
when the on-chain authority differs from the recorded one.

### SR-10 — Info — `programs/rekey/src/lib.rs:668-868`

**What is wrong.** The test suite contains **14 hand-written unit tests** that exercise
only the private helper functions `validate_policy`, `record_guardian_approval`,
`execute_recovery_transition`, `cancel_recovery_transition`,
`expire_recovery_transition` and `calculate_withdrawal_balances`. There is **no
SVM/integration test** anywhere in the repository (`tests/` contains only three
JavaScript frontend tests: `formatSolAmount`, `recoveryDemo`, `transactionSimulation`).
Consequently **none** of the following are covered by an executable test:

- the `#[account(...)]` constraints — `seeds`/`bump` (`:372-373`, `:384-385`,
  `:408-409`, `:414-419`, `:430-431`, `:436-441`, `:450-451`, `:457-462`,
  `:472-473`, `:478-483`, `:492-493`, `:499-500`), `has_one = wallet_config`
  (`:420`, `:442`, `:463`, `:484`, `:501`), and the owner-equality constraints
  (`:374`, `:452`, `:494`);
- the `Signer` requirements on `owner` (`:348`, `:377`, `:466`, `:504`),
  `initiator` (`:401`) and `guardian` (`:423`);
- the `init` path and its payer semantics (`:349-355`, `:357-363`, `:388-398`);
- borsh serialization round-trips and the `SPACE` constants (`:523`, `:533`, `:551`);
- the fact that `execute_recovery` and `expire_recovery` are permissionless
  (`:427-445`, `:470-487`).

The helper-level tests are *good* tests of the helper-level logic — they found the
boundary conditions correctly, and they are the reason Section 3 can be as confident as
it is. They are simply not tests of the program.

**Fix — prioritized integration test list.** Use `solana-program-test` or
`anchor-client` (or LiteSVM) with a local validator.

- **P0 — the account constraints, which are the program's real trust boundary:**
  a non-owner calling `withdraw_sol` must be rejected by the `#[account]` constraint at
  `:494`; a non-guardian calling `approve_recovery` must fail; a non-guardian calling
  `initiate_recovery` must fail; a request PDA belonging to a *different* wallet must
  fail the `has_one` check at `:420`; an uninitialized wallet config PDA must fail the
  `seeds` check at `:372`.
- **P0 — the SR-01 window:** a request at `now = execute_after + 1` must be rejected by
  `approve_recovery` (after the fix) and must be cancellable by the owner (or must not
  be, by explicit decision).
- **P0 — the SR-02 scenario:** two concurrent requests, both approved, executed in
  reverse nonce order; assert the final owner is the one the fixed rule designates.
- **P1 —** `update_recovery_policy` invalidating an in-flight request end-to-end
  (approve and execute must both fail with `StalePolicy`); `recipient == vault`
  rejection; the exact rent-floor boundary (vault balance == floor, amount == 1 → must
  fail; amount == balance − floor → must succeed); `expire_recovery` on an already
  `Executed` or `Cancelled` request; a wallet whose `next_nonce` is non-zero deriving
  the right PDA.
- **P2 —** the full happy path initialize → policy → initiate → approve → execute,
  asserting `wallet.owner` changed and that the emitted events are all present; the
  SR-04 case (execute a request whose `new_owner` equals the current owner).

### SR-11 — Info — `programs/rekey/src/lib.rs:306-326` (recorded as *correct*)

**Not a defect. Recorded so that a future reviewer does not "fix" it.**
`cancel_recovery_transition` (`:306-315`) and `expire_recovery_transition`
(`:317-326`) deliberately do **not** check `policy_version`, unlike
`record_guardian_approval` (`:254-257`) and `execute_recovery_transition`
(`:285-288`). This asymmetry is **correct**: both cancel and expire are
safety-positive actions on a request that is already dead (cancelled or expired under
the old policy), and refusing them would leave a stale request wedged in a
non-terminal state forever, with its rent locked (see SR-05). Keep the asymmetry.

---

## 3. Controls verified correct

These were checked against the source, not assumed. Where a control is right, it is
stated plainly, per the review brief.

**C-1 — Timelock and expiry boundaries are exact, complementary and non-overlapping.**
Execute requires `now >= request.execute_after` (`:297`); cancel requires
`now < request.execute_after` (`:311`). These are exact complements: there is no
instant at which both are permitted and no instant at which neither is. `now ==
execute_after` is executable and not cancellable — correct, and confirmed by the test
`owner_cancellation_is_allowed_before_but_not_after_the_timelock` (`:817`).
Similarly, approve requires `now <= request.expires_at` (`:262`), execute requires
`now <= request.expires_at` (`:298`), and expire requires `now > request.expires_at`
(`:322`) — again exact complements, with no gap and no overlap. Critically,
**`expire_recovery` cannot kill an executable request**: at `now == expires_at` the
request is still executable (`:298`) and not yet expirable (`:322`). This is a
frequently-missed boundary and it is right here.

**C-2 — Threshold validation is complete.** `validate_policy` (`:215-242`) rejects an
empty guardian set, more than `MAX_GUARDIANS` (5) guardians (`:221-224`), a threshold
of zero, a threshold above the guardian count (`:225-228`), a delay outside
`[60, 30 days]` (`:229-232`), the owner as a guardian (`:235`), and duplicate
guardians (`:236-239`, via the `guardians[index + 1..].contains(guardian)` suffix scan,
which is O(n²) but bounded at n ≤ 5). All five cases have a dedicated unit test
(`:705`, `:711`, `:716`, `:722`, `:728`, `:734`).

**C-3 — The threshold a request is judged against is provably the threshold it was
created under.** This is worth stating explicitly because it looks like a gap and is
not. `RecoveryRequest` does **not** store a `threshold`; `execute_recovery_transition`
compares `request.approvals.len() >= wallet.threshold` (`:294`) against the wallet's
*current* threshold. That is safe because `update_recovery_policy` increments
`policy_version` (`:66-69`), `initiate_recovery` stamps the request with the current
`policy_version` (`:113`), and both approve (`:254-257`) and execute (`:285-288`)
require `request.policy_version == wallet.policy_version`. Therefore any change to the
threshold necessarily invalidates the request before the new threshold can be applied
to it. **The owner cannot lower the threshold to fast-track a pending request.** The
`wallet.threshold` read at `:294` is provably the threshold the request was judged
against. (The *display* of this value is a separate, client-side defect — see AR-06
in the architecture review.)

**C-4 — `TooManyApprovals` cannot overflow account space.** `MAX_GUARDIANS = 5`
(`:5`), `RecoveryRequest::SPACE` allocates exactly `4 + 5 * 32` bytes for the
`Vec<Pubkey>` (`:551`), and `record_guardian_approval` caps `approvals.len()` at
`MAX_GUARDIANS` (`:267-270`). Since only registered guardians can approve (`:250-253`)
and the guardian set is validated to be duplicate-free (`:236-239`), the vector can
never exceed 5 elements. The check at `:267-270` is unreachable defense-in-depth —
correct and harmless. Similarly, `approvals.len()` can never exceed `threshold`:
the status flips to `Approved` at `:274-276` and further approvals are rejected by
the status check at `:258-261`.

**C-5 — Stale-policy invalidation is enforced on both approve and execute**
(`:254-257`, `:285-288`), and `expires_at` is set once at creation (`:99-101`, `:116`)
and is mutated by no instruction.

**C-6 — No nonce or PDA collision is possible.** `init` (`:388-398`) requires the
account not to exist; `next_nonce` is strictly monotonic and incremented inside the
same instruction (`:103-107`); the PDA seed uses the **pre-increment** value
(`&wallet_config.next_nonce.to_le_bytes()` at `:395`, evaluated before the handler
runs, with `bump` found by Anchor); and `initiate_recovery` performs **no CPI**, so
there is no reentrancy surface. Solana also serializes transactions touching the same
account, and `wallet_config` is `mut` (`:383`).

**C-7 — Owner authority is enforced at the `#[account(...)]` constraint level, not
only inline.** `update_recovery_policy` (`:374`), `cancel_recovery` (`:452`) and
`withdraw_sol` (`:494`) each carry `constraint = wallet_config.owner == owner.key()`,
and `owner` is a `Signer<'info>` in all three (`:377`, `:466`, `:504`). A non-owner
cannot reach the handler body at all. Note the constraint compares against
`wallet_config.owner` — the **current** owner — so cancelling after a completed
recovery is impossible for the initial owner, which is correct.

**C-8 — The clock cannot be spoofed.** All five time-dependent paths use
`Clock::get()?.unix_timestamp` (`:95`, `:135`, `:151`, `:166`, `:178`), which is a
sysvar syscall, **not** a caller-supplied account. There is no `clock: Sysvar<'info,
Clock>` account in any `#[derive(Accounts)]` struct, so a caller cannot substitute a
forged clock account. This is the correct pattern and it is worth stating because the
"sysvar spoofing" class of bug is common in Solana programs.

**C-9 — Withdrawal arithmetic is fully checked and both balances are computed before
either is written.** `calculate_withdrawal_balances` (`:328-343`) uses `checked_sub`
for the vault (→ `InsufficientFunds` on underflow, `:334-336`), enforces
`vault_after >= rent_floor` (`:337`), and uses `checked_add` for the recipient
(→ `ArithmeticOverflow`, `:339-341`). The handler (`:194-204`) computes **both** new
balances via the helper and only then writes them (`:203-204`), so there is no
intermediate state in which the vault is debited but the recipient is not credited.
The rent floor uses `Vault::SPACE` (41 bytes, `:533`), matching the `init` allocation
(`:360`). There is a dedicated unit test at the exact saturating boundary (`:849`).

**C-10 — `recipient != vault` is sufficient.** `withdraw_sol` borrows both lamport
balances (`:194-195`); if `recipient` were the vault, the second borrow would fail —
but that is prevented explicitly at `:186`. The recipient is never deserialized, so a
program-owned account passed as the recipient cannot have its data corrupted
(lamports live outside the data buffer).

**C-11 — Every request is cryptographically bound to its wallet.** `has_one =
wallet_config` (`:420`, `:442`, `:463`, `:484`, `:501`) plus stored-bump `seeds`
constraints mean a request PDA from wallet A cannot be presented against wallet B.

**C-12 — All three `SPACE` constants match their borsh layouts exactly.**
`WalletConfig::SPACE = 8 + 32 + 32 + 4 + 5*32 + 1 + 8 + 8 + 8 + 1 = 262` (`:523`),
matching the struct at `:511-520`. `Vault::SPACE = 8 + 32 + 1 = 41` (`:533`),
matching `:527-530`. `RecoveryRequest::SPACE = 8 + 32 + 32 + 8*4 + 4 + 5*32 + 1 + 1
= 278` (`:551`), matching `:537-548`. No over-allocation, no under-allocation.

**C-13 — Permissionless execution and expiry are intentional and correct.**
`ExecuteRecovery` (`:427-445`) and `ExpireRecovery` (`:470-487`) have no `Signer`
account at all. This matches the documented state machine
(`docs/architecture.md:21,23`) and is the right design: a recovery that has met its
threshold and timelock should not be able to be blocked by an uncooperative party,
and an expired request should be reclaimable by anyone.

**C-14 — The program emits an event for every state change except expiry.** Seven
`emit!` calls cover initialization, policy update, initiation, approval, execution,
cancellation and withdrawal (`:41`, `:71`, `:121`, `:138`, `:154`, `:168`, `:206`).
The one omission is SR-03.

**C-15 — `checked_add` guards every arithmetic extension of a timestamp or counter.**
`execute_after` (`:96-98`), `expires_at` (`:99-101`), `next_nonce` (`:104-107`) and
`policy_version` (`:66-69`) all use `checked_add` with an explicit
`ArithmeticOverflow` error. No wrapping arithmetic exists in the program.

---

## 4. Explicitly out of scope

These are **not** findings. They are features the program does not implement. They are
listed so that no reader mistakes an absence for a defect, and so that their absence
is not treated as coverage.

1. **Passkey / WebAuthn verification — not implemented.** `docs/architecture.md:53-54`
   states this. The program has no passkey account, no passkey-registration
   instruction and no signature-verification path. The social-recovery guardian
   threshold is the *only* recovery mechanism in the program.
2. **SPL token support — not implemented.** The program moves native SOL only
   (`withdraw_sol`, `lib.rs:183-212`). There is no token account, no ATA, no
   `transfer_checked`, no Token-2022 handling (no transfer fees, no transfer hooks, no
   permanent delegate, no confidential transfers). The entire Token-2022 attack surface
   named in the solana-dev security checklist is therefore **not applicable** to this
   program as written.
3. **Mainnet deployment — blocked.** `assertMainnetBlocked`
   (`server/config.ts:72-78`) refuses to start with `cluster == "mainnet"` unless
   `REKEY_ALLOW_MAINNET=1`. The program itself carries no such guard (a program cannot
   refuse to exist), so the gate is enforced by the server process only — see AR-13
   in the architecture review for the fact that the MCP gateway does not apply it.
4. **Account closure / rent reclamation — not implemented.** See SR-05.
5. **Upgrade-authority management — not implemented.** See SR-08 and SR-09.
6. **Multi-sig or timelocked governance over the upgrade authority — not implemented.**
7. **Guardian replacement / key rotation.** Guardians can only be changed wholesale via
   `update_recovery_policy`, which invalidates all in-flight requests (`:66-69`).
   There is no incremental add/remove guardian instruction and no per-guardian
   metadata (labels, weights, expiry) on chain.
8. **Guardian-to-wallet discovery / indexing.** The program stores guardians only as a
   `Vec<Pubkey>` on `WalletConfig` (`:514`). There is no reverse index, so a guardian
   cannot enumerate the wallets they guard — see AR-10 in the architecture review.
9. **Off-chain guardian notifications.** Nothing in the program or the API notifies a
   guardian that a request exists.
10. **SPL / native fee-payer sponsorship, durable nonces, or transaction-level
    policies.** Out of scope for the current program.
11. **Multi-sig wallet as the owner.** The owner is a single `Pubkey` + `Signer`
    throughout. A `SPL Token Account` or a Squads multisig could hold the owner role,
    but the program neither supports nor needs to.
12. **Simulation / `simulateTransaction` gating inside the program.** The program's
    test suite contains no `solana-program-test` harness at all (SR-10).

---

## 5. Prioritized remediation list

Ordered by risk. Each item names the finding it closes.

| # | Action | Closes | Priority |
| --- | --- | --- | --- |
| 1 | Make the approval window and the cancellation window coextensive — either reject approvals at or after `execute_after`, or extend cancellation to cover the grace period. Document the resulting policy. | SR-01 | **Before any Devnet demo** |
| 2 | Enforce at most one live request per wallet, or a deterministic supersede rule (highest nonce wins). | SR-02 | **Before any Devnet demo** |
| 3 | Re-check `new_owner != wallet.owner` at execution time. | SR-04 | Before Devnet demo |
| 4 | Build the integration-test harness (LiteSVM / `solana-program-test`) and land the P0 cases in SR-10. | SR-10 | **Release gate** |
| 5 | Rotate the program id to a securely generated keypair; sync `lib.rs`, `Anchor.toml`, `docs/api-contracts.md` and the server's program-id default. | SR-08, AR-01 | **Release gate** |
| 6 | Add a `close_recovery_request` instruction (or bound live requests) so rent is reclaimable and `next_nonce` cannot grow without bound. | SR-05 | High |
| 7 | Emit a `RecoveryExpired` event and add the server-side mapping. | SR-03 | Medium |
| 8 | Raise `MIN_DELAY_SECONDS` to a production-meaningful value and label short-delay wallets as test-only. | SR-06 | Medium |
| 9 | Record the upgrade authority in the repo; move it to a multisig; add a mainnet deployment gate that checks it. | SR-09 | High (release gate) |
| 10 | Decide and document whether `withdraw_sol`'s recipient should be constrained. | SR-07 | Low — optional |

**Not on the list, deliberately:** adding a `policy_version` check to
`cancel_recovery` / `expire_recovery` (see SR-11 — this would be a regression).

---

## 6. Verification performed

Commands run in `/Users/user/solana-recovers-agents/openclaude-review`:

```
cargo fmt --all -- --check          # exit 0, no output — formatting is clean
cargo test --manifest-path programs/rekey/Cargo.toml
```

The test run reported **`15 passed; 0 failed`** in 8m21s. **One of those 15 is
`test_id`, an auto-generated placeholder emitted by Anchor's `#[program]` macro, not a
hand-written test.** I verified this by building a minimal Anchor crate containing
only a `declare_id!` and a one-instruction `#[program]` module: it also produced
exactly one test named `test_id`. **The program therefore has 14 hand-written unit
tests**, matching the 14 `#[test]` attributes at `lib.rs:705, 711, 716, 722, 728, 734,
741, 760, 772, 794, 817, 835, 849, 858`. (The prior published review in
`docs/security-review.html` claims 15 tests; that claim over-counts by one for this
reason. The implementation roadmap claims 7, which under-counts.)

All 14 tests pass. They test the helper functions, not the program (SR-10).

---

## 7. Limitations of this review

- **Static review only.** No instruction was executed against an SVM, no transaction
  was simulated, and no Devnet deployment was inspected. Every finding is derived
  from the source as read.
- **The upgrade authority, the deployed bytecode and the IDL could not be inspected.**
  The source repository contains no `target/deploy` artifact, no `.json` IDL and no
  recorded authority address. SR-08 and SR-09 are therefore stated as release gates
  rather than as confirmed defects.
- **The `#[derive(Accounts)]` macro-generated code was not read line by line.** Anchor
  0.31.1's constraint semantics are relied upon as documented (notably that
  `constraint = ...` runs before the handler and that `has_one` compares the stored
  key). The unit tests cannot confirm these; only an integration test can (SR-10).
- **`Clock::get()` behaviour at a slot boundary** (a transaction whose on-chain
  timestamp equals `execute_after` or `expires_at`) is reasoned from the source's
  inequalities rather than observed. The boundaries are, however, individually covered
  by unit tests (`:817`, `:835`).
- **No concurrency testing was performed.** SR-02's scenario is derived from the
  source's absence of an invariant, not from an observed race.
- **The prior `docs/security-review.html` was not relied upon.** Its claims were
  re-checked against the source; the "15 tests" claim did not survive.
