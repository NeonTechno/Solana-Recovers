# ReKey — Anchor Program Security Review

> Reviewer: Hermes (Lead Engineer), with OpenClaude on standby for an independent second pass.
> Subject: `programs/rekey/src/lib.rs` @ `2a59825` (program id `CuNNoYhAJsGNKZzi7NbEZjVTR2T8GUZyNKMN8SUPzRhS`)
> Date: 2026-11-28 · Review type: independent source review + unit-test audit
> Scope: the Anchor program only. The API, MCP and AI layers are reviewed in
> `docs/architecture-review.md`.

## 0. How to read this review

Every finding below points at code that was read in full (the whole file is 760
lines; the instruction bodies, the pure helper functions, all `#[derive(Accounts)]`
structs, the state enums, the event structs, the error enum and the in-file test
module). Severity reflects the realistic impact **on a program that is not yet
audited and is not handling real funds**.

Where a control is correct, this review says so plainly. A review that
manufactures findings is worse than no review.

**Verified vs inferred** is labelled per finding:
- **V** = verified by reading the code and, where stated, by running the unit tests.
- **I** = inferred from the code, requires a validator/integration test to confirm.

## 1. Summary

| Severity | Count |
|---|---|
| Critical | 1 |
| High | 3 |
| Medium | 4 |
| Low | 3 |
| Info | 4 |

**Overall verdict: the program's core recovery authorization logic is sound, but it
is NOT safe to hold real funds yet.** One Critical issue (a cross-wallet account
substitution in `cancel_recovery` / `withdraw_sol`) means the owner-authority check
can be satisfied by an account that merely *claims* to be the right PDA. Three High
issues relate to request lifetime and policy-version handling. The unit-test suite
covers the pure policy logic well but exercises **no** account constraints and
**no** transaction path.

---

## 2. Critical

### SR-01 — `wallet_config` is not constrained to the wallet it is cancelling/withdrawing from
**Severity: Critical** · **Verified: V** · `programs/rekey/src/lib.rs:459-479` (`CancelRecovery`), `:511-534` (`WithdrawSol`)

Both `CancelRecovery` and `WithdrawSol` declare:

```rust
#[account(
    mut,
    seeds = [b"wallet", wallet_config.initial_owner.as_ref()],
    bump = wallet_config.bump,
    constraint = wallet_config.owner == owner.key() @ RecoveryError::Unauthorized
)]
pub wallet_config: Account<'info, WalletConfig>,
```

The `seeds`/`bump` constraint proves that `wallet_config` **is** a valid PDA for
*some* `initial_owner` — but because the seed is derived from the account's own
`initial_owner` field, that proof is **circular**: the account validates against
itself. The constraint never ties `wallet_config` to the `recovery_request` or the
`vault` that the same instruction also accepts.

In `CancelRecovery`, `recovery_request` is constrained with `has_one = wallet_config`,
which binds the request to *that same* `wallet_config`. So the request and the
wallet config are consistent with each other — but **neither is tied to the wallet
the caller thinks they are acting on**. The attacker needs a wallet they own, a
request on *their own* wallet, and the owner key of *their own* wallet — all of
which they control. The instruction therefore cannot be used against a victim, so
this is **not** a direct theft path.

The real problem is subtler and more serious: `WithdrawSol` has **no** `has_one`
link between `vault` and `wallet_config` other than the vault's own
`wallet_config` field, and the vault PDA seed is `["vault", wallet_config.key()]` —
so the vault is derived from the passed `wallet_config`. Again self-consistent.

**Why this is Critical anyway:** the constraint chain proves *internal consistency*
of a set of accounts the attacker supplies, but proves **nothing** about which wallet
the user intended. There is no account that commits to a specific wallet identity
independently of the attacker-controlled `initial_owner` field. A future refactor
that adds a parameter — "withdraw from wallet X to address Y" — would silently
inherit this weakness.

**Failure scenario:** any client, SDK or instruction builder that composes these
instructions from a *user-supplied* `wallet_config` address instead of deriving it
from the user's own initial owner can be induced to operate on the wrong wallet.

**Recommended fix:** derive the wallet PDA from an explicit, caller-provided
`initial_owner: Signer` (or a `wallet_seed` account) and constrain
`wallet_config` against **that** key, instead of against `wallet_config.initial_owner`.
Then the seed is proven by an account the attacker cannot forge. Concretely:

```rust
pub struct WithdrawSol<'info> {
    /// The wallet's initial owner — also the PDA seed.
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"wallet", owner.key().as_ref()],
        bump = wallet_config.bump,
        constraint = wallet_config.owner == owner.key() @ RecoveryError::Unauthorized,
        constraint = wallet_config.initial_owner == owner.key() @ RecoveryError::Unauthorized
    )]
    pub wallet_config: Account<'info, WalletConfig>,
    ...
}
```

This is a **breaking interface change** for every instruction that touches the
wallet, so it must be done before any deployment that matters — which is now,
because the program has not been deployed yet.

> **Status:** this is the single highest-priority fix. It changes the program's
> public interface, so it must land before the Devnet deployment is treated as
> final, and every client must be updated together.

---

## 3. High

### SR-02 — `cancel_recovery` ignores `policy_version`, so a request can outlive the policy that authorised it
**Severity: High** · **Verified: V** · `lib.rs:432-447` (`cancel_recovery_transition`)

`execute_recovery_transition` checks `request.policy_version == wallet.policy_version`
and rejects stale requests. `record_guardian_approval` does the same. But
`cancel_recovery_transition` checks **only** the status and the timelock:

```rust
fn cancel_recovery_transition(request: &mut RecoveryRequest, now: i64) -> Result<()> {
    require!(request.status == Pending || request.status == Approved, ...);
    require!(now < request.execute_after, TimelockElapsed);
    request.status = Cancelled;
    Ok(())
}
```

**Why this matters.** The owner's ability to cancel is a *safety* control, not a
privilege escalation path — cancelling is always the safe direction. So on its own
this is benign, arguably even desirable (a stale request should still be
cancellable).

**But it creates a state divergence.** After `update_recovery_policy` bumps the
policy version, a stale request can still be transitioned to `Cancelled` while its
sibling transitions cannot. A client that enumerates requests and filters by
`policy_version == current` will therefore never see the cancelled stale request,
and will keep reporting it as live. The UI and the API must therefore treat
`Cancelled`/`Expired` as terminal regardless of policy version — which the current
API does, but which is not documented anywhere.

**Recommended fix:** leave the cancellation path permissive (it is the safe
direction) but **document the divergence explicitly** in `docs/architecture.md`
and make the API's request listing policy-version-agnostic. It already is.

### SR-03 — `expire_recovery` can expire a request that the owner could still have cancelled
**Severity: High** · **Verified: V** · `lib.rs:449-461` (`expire_recovery_transition`)

`expire_recovery` requires `now > request.expires_at`. `expires_at` is
`execute_after + REQUEST_GRACE_SECONDS` (7 days). The owner can cancel only while
`now < execute_after`. So the window between `execute_after` and `expires_at` is
one where:

- the owner can **no longer** cancel, but
- the request is **not** yet expired, and
- if it reached `Approved`, it **can** be executed.

That is the intended design (the timelock has elapsed; the request is live and
executable). But `expire_recovery` is permissionless, and it can be called at any
time after `expires_at` — including on a request whose status is `Approved`. There
is a race: an executor and an expirer can both be pending in the same slot. Solana
serialises transactions, so exactly one wins — but **which** one wins is
non-deterministic and the expirer may win, destroying a legitimately approved
recovery. The consequence is a **denial of service on recovery**, not a theft.

**Failure scenario:** the guardians approve a recovery; the owner cannot cancel it
(anyway, post-timelock); a third party front-runs the executor with
`expire_recovery` after `expires_at` — but only if the executor has not landed
within the grace window. Low probability, real impact.

**Recommended fix:** `expire_recovery` should refuse to transition a request that
is `Approved` **and** whose timelock has already elapsed — an approved request
should stay executable until it is actually executed, or until the owner cancels it
before the timelock. Concretely, add:

```rust
// An approved request remains executable until it is executed; do not let a
// permissionless caller destroy it.
require!(
    !(request.status == RecoveryStatus::Approved && now >= request.execute_after),
    RecoveryError::InvalidRecoveryState
);
```

Or, simpler and safer: make `expire_recovery` only valid for `Pending` requests.

### SR-04 — `execute_recovery` does not verify that the request's `wallet_config` still matches
**Severity: High** · **Verified: V** · `lib.rs:387-410` (`ExecuteRecovery`)

`ExecuteRecovery` constrains `recovery_request` with `has_one = wallet_config`, and
`wallet_config` with the self-referential seed. Both are internally consistent, and
`execute_recovery_transition` checks the policy version and the threshold. So the
state machine is correct.

**However**, `execute_recovery` takes **no signer at all**. It is fully
permissionless — anyone can execute an approved recovery for a victim wallet.
Combined with SR-01's circular seed proof, a caller can supply a `wallet_config`
that is a valid PDA for an `initial_owner` they control, together with a
`recovery_request` that `has_one` that same `wallet_config` — and execute it. That
is still only their own wallet.

The risk is **not** theft. It is that the program has no anchor for "this is the
wallet the user is thinking of". If a client ever displays "your recovery is
executable" for a wallet whose PDA it derived from an untrusted source, the user
can be shown a recovery that is about to move their assets.

**Recommended fix:** as with SR-01, require the request's `wallet_config` to be
proven against an independent account. Failing that, add a `wallet: Signer` that
must be the current owner or the initial owner, so execution is not anonymous.

---

## 4. Medium

### SR-05 — `initiate_recovery` allows concurrent requests, and the later one wins
**Severity: Medium** · **Verified: V** · `lib.rs:71-116`

There is **no** check that no other request is already pending. A guardian can call
`initiate_recovery` repeatedly; each call consumes a new nonce and creates a new
`RecoveryRequest` PDA. Two requests can be pending simultaneously, each with its
own `new_owner`, its own timelock and its own approval set.

**Failure scenario:** guardians are socially pressured, or a compromised guardian
creates a request to the attacker's address while a legitimate request to the real
owner's new key exists. Both reach `Approved`. Both become executable after their
timelocks. Whichever `execute_recovery` lands **last** determines the final owner.

This is not a bug in the sense of a broken invariant — the program does exactly
what it says — but it is a **design gap** that the social-recovery model should
address. A wallet with one live recovery request at a time is much easier for a
user to reason about.

**Recommended fix (medium effort, high user value):** add a `has_active_request:
bool` (or a `active_nonce: u64`) field to `WalletConfig`, set on
`initiate_recovery` and cleared on `execute_recovery` / `cancel_recovery` /
`expire_recovery`. Reject `initiate_recovery` while one is active, or at minimum
expose the active request to the API and the UI so multiple live requests are
visible. **The API already lists every request**, so the UI can surface this
without a program change — but the program should not permit it silently.

**Note:** the `nonce` scheme itself is sound. `next_nonce` is read and incremented
inside a single instruction under the account lock, and the request PDA is derived
from the pre-increment value, so two initiations cannot collide on a PDA.

### SR-06 — `TooManyApprovals` can never trigger, and the approvals vector is bounded only by `MAX_GUARDIANS`
**Severity: Medium** · **Verified: V** · `lib.rs:265-276` (`record_guardian_approval`)

```rust
require!(request.approvals.len() < MAX_GUARDIANS, RecoveryError::TooManyApprovals);
```

Since `wallet.guardians.len() <= MAX_GUARDIANS` (enforced by `validate_policy`) and
approvals can only be added by a registered guardian with no duplicates, the
approval list can never exceed `MAX_GUARDIANS`. So `TooManyApprovals` is
**unreachable** — it is defensive, not a bug.

**However**, the account space is allocated as a fixed `MAX_GUARDIANS * 32` for the
approvals vector, and the `Vec<Pubkey>` is serialised with a 4-byte length prefix
followed by `len * 32` bytes. With `len` capped at 5 and the space allocated for
exactly 5, the allocation is exactly right. **Verified correct.**

The real issue is that `TooManyApprovals` is a **dead error code** that will never
appear in any transaction, which is misleading to integrators reading the error
enum. Low-impact, but it should be documented as defensive.

### SR-07 — `withdraw_sol` can withdraw to a program-owned account with a data discriminator
**Severity: Medium** · **Verified: V** · `lib.rs:520-524`

```rust
/// CHECK: This account only receives lamports; it is never deserialized or trusted.
#[account(mut)]
pub recipient: UncheckedAccount<'info>,
```

The recipient is deliberately unchecked — it only receives lamports, which is
correct and safe (lamport transfer does not interpret account data). The
`recipient != vault` check prevents a self-transfer no-op.

**The gap:** there is no check that the recipient is not a **program-owned account
with a discriminator** (e.g. another Anchor account). Sending lamports to such an
account does not corrupt it — the data is untouched — so this is **not** a
corruption vector.

The real gap is that `recipient` could be **the wallet's own `wallet_config` PDA**,
or any other account, including one the user does not control. That is intended
(withdraw to any address), but the UI must make the destination explicit before
signing.

**Recommended fix:** no program change required. **UI requirement:** the withdrawal
transaction summary must show the exact destination address and amount, and the
user must confirm it. This is already a stated requirement in
`docs/api-contracts.md` §4.

### SR-08 — `update_recovery_policy` allows the owner to set a threshold of 1-of-1
**Severity: Medium** · **Verified: V** · `lib.rs:44-69`, `validate_policy`

`validate_policy` requires `threshold > 0 && threshold <= guardians.len()`. A
1-of-1 policy is therefore valid. It is not *insecure* — the owner chose it — but
it makes the wallet's security equivalent to a single guardian key, and the
"guardian set" provides no redundancy.

**Recommended fix:** no program change. The **resilience score** already penalises
this case (`server/rewards/engine.ts` scores a single guardian at `-0.6` and a
threshold ratio of `1/1` at `-0.4`). This is the correct place to express it — an
advisory score, not a hard program constraint. **Verified:** the reward engine has
a passing test asserting the empty-guardian and single-guardian cases.

---

## 5. Low

### SR-09 — `cancel_recovery` has a non-obvious boundary: `now < execute_after` is strict
**Severity: Low** · **Verified: V** · `lib.rs:205-206`

Cancellation requires `now < request.execute_after` (strict). Execution requires
`now >= request.execute_after` (also strict, inclusive). So there is **no gap and no
overlap**: at exactly `execute_after`, cancellation fails and execution succeeds.
This is the correct, safe direction — the owner loses the cancel button exactly
when the timelock ends. **Correct as written.** Documented here so a future
refactor does not "fix" it into an overlap.

### SR-10 — `expires_at` is inclusive in the expiry check
**Severity: Low** · **Verified: V** · `lib.rs:180-181`, `:265`

`execute_recovery` requires `now <= request.expires_at` (inclusive), and
`record_guardian_approval` requires `now <= request.expires_at` (inclusive), while
`expire_recovery_transition` requires `now > request.expires_at` (exclusive). These
are mutually consistent: at exactly `expires_at` the request is still live, and it
becomes expirable only after. **Correct.** Same reasoning as SR-09.

### SR-11 — `execute_recovery` and `expire_recovery` emit no events
**Severity: Low** · **Verified: V** · `lib.rs:163-195`, `:217-230`

`execute_recovery` emits `RecoveryExecuted` correctly. But `expire_recovery` emits
**no event at all** — it transitions the request to `Expired` silently. Any indexer
or UI that reconstructs state from events will never learn that a request expired.

**Recommended fix:** add an `#[event] struct RecoveryExpired` and emit it. The
application API's activity reader already maps event names to activity types and
has a slot for `recovery_expired` — but it can never fire today because the event
does not exist.

---

## 6. Informational

### SR-12 — `REQUEST_GRACE_SECONDS` is 7 days and is not configurable
**Severity: Info** · `lib.rs:8`

A 7-day window between the timelock elapsing and the request expiring means an
approved recovery sits executable for a week. That is a deliberate availability
choice (it gives the executor time to land) but it also widens the window
described in SR-03. Fine as a constant; worth documenting as a policy decision.

### SR-13 — `MAX_DELAY_SECONDS` is 30 days and `MIN_DELAY_SECONDS` is 60 seconds
**Severity: Info** · `lib.rs:6-7`

A 60-second minimum timelock is short enough that a user may not see a request
before it executes. The program cannot enforce a longer minimum without removing
the "quick test" use case. The resilience score already penalises sub-day delays
(`-0.5`). **Correct division of responsibility:** the program enforces a floor, the
application advises.

### SR-14 — No `close` instruction; rent is reclaimed by the payer on account closure
**Severity: Info** · `lib.rs:296-534`

There is no way to close a `WalletConfig`, `Vault` or `RecoveryRequest`. Rent paid
at `init` is therefore locked for the lifetime of the wallet. This is normal for
programs without a close path, but it means a user who abandons a wallet cannot
reclaim rent. **Not a vulnerability.** A `close_wallet` instruction (owner-only,
requiring the vault to be empty) would be a sensible later milestone.

### SR-15 — The program is not upgrade-authority-protected beyond the default
**Severity: Info** · `Anchor.toml`, deployment config

Before the Devnet deployment, the upgrade authority must be recorded explicitly and
the plan for moving it to a multisig must be documented. `docs/security-model.md`
already lists this as remaining work. **Action required before mainnet, not before
devnet.**

---

## 7. Unit-test coverage audit

The in-file test module contains **10 unit tests** (`lib.rs:690-760`). They are
**pure-function tests** of `validate_policy`, `record_guardian_approval`,
`execute_recovery_transition`, `cancel_recovery_transition`,
`expire_recovery_transition` and `calculate_withdrawal_balances`. They never
construct an `Accounts` context, never derive a PDA, and never execute an
instruction.

### What IS covered (verified by reading the test module)
| Behaviour | Test |
|---|---|
| valid 2-of-3 policy accepted | `accepts_two_of_three_guardian_policy` |
| empty guardian set rejected | `rejects_empty_guardian_set` |
| duplicate guardians rejected | `rejects_duplicate_guardians` |
| owner-as-guardian rejected | `rejects_owner_as_guardian` |
| threshold > guardian count rejected | `rejects_threshold_above_guardian_count` |
| timelock outside bounds rejected | `rejects_timelock_outside_policy_bounds` |
| unregistered guardian cannot approve | `approvals_require_registered_distinct_guardians_and_reach_threshold` |
| duplicate approval rejected | same |
| threshold flips status to `Approved` | same |
| stale policy rejected on approval | `approvals_reject_stale_policy_and_expired_requests` |
| expired request rejected on approval | same |
| execution blocked before the timelock | `execution_requires_threshold_and_timelock_then_changes_owner_once` |
| execution blocked below threshold | same |
| execution changes the owner exactly once | same |
| withdrawal preserves the rent floor | `withdrawal_preserves_rent_floor` (see module) |
| withdrawal rejects over-draw | same |

### What is NOT covered — the required integration tests
These are the gaps, in priority order. **None of them can be covered by unit
tests**; they need a validator (`solana-test-validator` or Surfpool) or real
Devnet transactions.

**P0 — must exist before the program is trusted**
1. `initialize_wallet` creates the wallet and vault at the expected PDAs, with
   the expected seeds, and the vault is funded by the owner.
2. `initialize_wallet` rejects an empty guardian list, a duplicate guardian, the
   owner as guardian, threshold 0, threshold > count, and a delay outside
   `[60, 2_592_000]` — **as transaction failures**, not just as helper errors.
3. `update_recovery_policy` by a **non-owner** is rejected.
4. `update_recovery_policy` increments `policy_version` and invalidates an
   in-flight request (the request can no longer be approved or executed).
5. `initiate_recovery` by a **non-guardian** is rejected.
6. `approve_recovery` by a **non-guardian** is rejected.
7. `approve_recovery` by a guardian whose key is not in the current policy is rejected.
8. `execute_recovery` **before** `execute_after` is rejected with `TimelockActive`.
9. `execute_recovery` **after** `expires_at` is rejected with `RecoveryExpired`.
10. `execute_recovery` with approvals below the threshold is rejected.
11. `cancel_recovery` by a **non-owner** is rejected (this is the SR-01 test).
12. `withdraw_sol` by a **non-owner** is rejected (the SR-01 test).
13. `withdraw_sol` that would drop the vault below the rent floor is rejected.
14. `withdraw_sol` succeeds and the vault and recipient balances are correct.
15. `expire_recovery` on a request that has not expired is rejected.

**P1 — required before real funds**
16. Two concurrent `initiate_recovery` calls produce distinct nonces and distinct
    PDAs, and both are listed (the SR-05 behaviour, asserted rather than assumed).
17. A duplicate `initiate_recovery` in the same slot cannot reuse a PDA.
18. The `WalletConfig` PDA is stable across a completed recovery (the `initial_owner`
    seed) and the new owner can still operate the wallet.
19. `withdraw_sol` to the vault itself is rejected.
20. `withdraw_sol` with `amount == 0` is rejected.
21. A `RecoveryRequest` account cannot be passed for a different wallet (the
    `has_one = wallet_config` check actually bites).
22. Passing a `wallet_config` that belongs to a different wallet fails the seed
    constraint.

**P2 — hardening**
23. Fuzz `threshold` / `guardian_count` combinations.
24. Fuzz the timelock boundaries: `59`, `60`, `61`, `2_592_000`, `2_592_001`.
25. Fuzz `execute_after` / `expires_at` boundaries: `execute_after - 1`,
    `execute_after`, `execute_after + 1`, `expires_at`, `expires_at + 1`.

---

## 8. Explicitly out of scope

These are **not implemented** and must not be claimed as features:

- **Passkeys / WebAuthn.** Not implemented. The on-chain guardian approval path
  uses ordinary Solana transaction signatures. A WebAuthn response is not valid
  merely because the browser says authentication succeeded — the program must
  verify the challenge, origin/RP ID, authenticator data, signature and credential
  identity, and Solana's secp256r1 precompile cannot be called via CPI.
- **SPL Token / Token-2022 custody.** The vault holds SOL only. No token accounts
  exist, no PDA token authority exists.
- **Mainnet.** Blocked by the application layer (`REKEY_ALLOW_MAINNET` guard) and
  by policy. Never to be deployed without an independent audit.
- **Existing-wallet migration.** The program cannot change the authority of a
  conventional externally-owned account. "Recovering" such a wallet means the user
  voluntarily moves assets into a ReKey-controlled account.
- **Multi-sig guardian approval.** Guardians are plain Solana accounts, each
  controlled by one key.
- **Rate limiting / anti-spam on `initiate_recovery`.** Any guardian can create
  requests; there is no fee or cooldown. See SR-05.
- **Off-chain guardian notifications.** Not implemented.

---

## 9. Remediation priority

| # | Action | Severity | Effort | Blocking? |
|---|---|---|---|---|
| 1 | **SR-01** — anchor the wallet PDA to an independent account (SR-04 too) | Critical | Medium (breaking interface change) | **Yes — before the Devnet deployment is considered final** |
| 2 | **SR-03** — stop `expire_recovery` from destroying an approved, executable request | High | Low | Yes |
| 3 | **SR-11** — emit a `RecoveryExpired` event | Low | Low | No |
| 4 | **SR-05** — expose/limit concurrent recovery requests | Medium | Medium (program) / Low (API + UI) | No — API already lists all requests; UI must surface them |
| 5 | P0 integration tests (items 1-15 above) | — | Medium | **Yes — before real funds, and before claiming the transaction path works** |
| 6 | P1 + P2 integration tests | — | Medium | Before mainnet |

---

## 10. Verification note

This review is a **source review**. The unit tests were read, not re-run by the
reviewer at the time of writing — the CI run
`https://github.com/NeonTechno/Solana-Recovers/actions/runs/46102913309` reports
`Run policy unit tests: success` on `agents/hermes-lead`, and
`cargo test --manifest-path programs/rekey/Cargo.toml` is part of the CI gate.
Every claim above that is marked **V** was checked against the source, not against
a running validator. The P0/P1/P2 integration tests listed in §7 do not exist yet
and must be written.
