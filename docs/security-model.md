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

## Unit-test coverage

The current Rust unit tests cover valid 2-of-3 policy configuration, empty and duplicate guardian sets, owner/guardian collision, invalid thresholds and invalid timelock bounds. They do not yet test account constraints or transaction state transitions on a validator.

## Remaining security work

1. Add integration tests for every success and failure transition.
2. Fuzz guardian threshold, nonce and state transitions.
3. Review rent and lamport accounting for the program-owned vault.
4. Add SPL Token / Token-2022 vault support with PDA authority.
5. Add WebAuthn passkey signature verification and bind the full authenticator/challenge context.
6. Review account closure, rent reclamation and denial-of-service cases.
7. Review upgrade authority and migrate it to a multisig before mainnet.
8. Obtain an independent security audit before supporting valuable assets.

## Dependency audit note

The current npm dependency tree reports 15 moderate advisories in transitive dependencies including `stream-json` and `uuid`, reached through `@solana/web3.js` / wallet-adapter and Solflare packages. The npm audit gate currently fails on high severity and passes; npm reports no available fix for the identified moderate advisory chain. Reassess the wallet SDK stack before production use.

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