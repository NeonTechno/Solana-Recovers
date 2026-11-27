# ReKey security model

## Implemented in the first program milestone

- Guardian list limited to five entries.
- Configurable threshold between one and guardian count.
- Guardian public keys must be unique and cannot equal the owner.
- Recovery request binds to a proposed new owner, monotonic nonce and policy version.
- Duplicate guardian approvals are rejected.
- Recovery execution requires threshold approval, an elapsed timelock and an unexpired request.
- Current owner can cancel before the timelock elapses.
- Updating the guardian policy increments the policy version, invalidating older requests.
- Only the current owner can withdraw SOL from the vault.
- SOL withdrawals use checked balance calculations and preserve the rent-exempt reserve before either balance is updated.

## Unit-test coverage

The Rust unit tests cover valid and invalid policy configuration plus recovery transitions: registered and duplicate approvals, threshold behavior, stale policies, expiration, timelock boundaries, owner cancellation, one-time owner change, terminal-state rejection, and withdrawal balance arithmetic. These are native tests of private helpers; they do not exercise Anchor account constraints, transaction serialization, or execution in an SVM.

## Client transaction simulation

`src/security/transactionSimulation.ts` is an isolated advisory wrapper. It rejects unsigned transactions before RPC, sets `sigVerify: true`, requests confirmed simulation with inner instructions, records the observed slot, and bounds returned log text. An RPC execution error is marked deterministic; log presence and the inner-instruction count are heuristic context only. The wrapper does not classify an instruction as malicious, request post-simulation account data, sign, or submit a transaction. It is not integrated into the UI while the shared transaction-review contract remains pending.

Any future UI caller must obtain explicit user approval for wallet signing separately, show the full transaction summary, and present simulation output as slot-scoped advisory evidence—not a safety guarantee. On-chain logs and account data remain untrusted input.

## Remaining security work

1. Add SVM integration tests for account constraints and every success/failure instruction path.
2. Fuzz guardian threshold, nonce and state transitions.
3. Review rent and lamport accounting for the program-owned vault.
4. Add SPL Token / Token-2022 vault support with PDA authority.
5. Add WebAuthn passkey signature verification and bind the full authenticator/challenge context.
6. Review account closure, rent reclamation and denial-of-service cases.
7. Review upgrade authority and migrate it to a multisig before mainnet.
8. Obtain an independent security audit before supporting valuable assets.

## Dependency audit note

The latest `npm install --no-package-lock --ignore-scripts` reported 15 moderate advisories among 566 packages; it did not report high or critical findings in its summary. The earlier npm audit recorded in the shared project review also found no available fix for the moderate transitive advisory chain, including `stream-json` and `uuid`, reached through Solana wallet packages. No `package-lock.json` was generated in this worktree, so reproduce advisory details after the integration owner publishes the lockfile. Reassess the wallet SDK stack before production use.

## Threats and controls

| Threat | Control |
| --- | --- |
| Compromised single guardian | M-of-N approval threshold |
| Malicious recovery destination | Destination fixed in the request before approvals |
| Replay attack | Per-wallet monotonic nonce |
| Stale guardian approval | Policy version binding |
| Race between cancel and execute | Atomic on-chain state transition |
| Compromised frontend/backend | Program independently enforces authorization |
| Lost device | Independent guardians; passkeys planned |
| Malicious program upgrade | Multisig upgrade authority planned |

## Passkeys

A WebAuthn response is not valid merely because the browser says authentication succeeded. The program integration must verify the challenge, origin/RP ID, authenticator data, signature, credential identity and replay protections. Solana's secp256r1 precompile can verify passkey signatures natively but cannot be called via CPI; transaction composition must be designed around that constraint.

## Deployment gates

- Rust formatting and compilation.
- Anchor build using the Solana SBF toolchain.
- Local-validator integration tests.
- Negative tests for unauthorized callers and malformed accounts.
- Fuzz tests for threshold, nonce and timing invariants.
- Devnet end-to-end tests.
- Program upgrade authority reviewed before mainnet.
- Independent audit before real funds are supported.

The current UI is a prototype and does not implement the on-chain instructions yet.