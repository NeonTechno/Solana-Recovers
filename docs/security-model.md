# ReKey security model

## Non-negotiable invariants

1. Guardians cannot transfer or withdraw user assets.
2. The recovery destination public key is fixed before approvals are collected.
3. Every guardian signature is bound to the wallet, request nonce, proposed owner, policy version and expiry.
4. A request cannot execute before the timelock expires.
5. The current owner can cancel a pending request during the protection window.
6. Nonces are consumed exactly once.
7. Guardian-set changes require current-owner authorization and should have a policy-change delay.
8. No seed phrase or private key is collected by the frontend or backend.

## Threats and controls

| Threat | Planned control |
| --- | --- |
| Compromised single guardian | M-of-N approval threshold |
| Malicious recovery destination | Bind destination into every signed approval |
| Replay attack | Per-wallet monotonic nonce and expiry |
| Race between cancel and execute | Atomic on-chain state transition |
| Stale guardian approval | Policy version in signed message |
| Compromised frontend/backend | Program independently verifies authorization |
| Lost device | Independent guardians and separately enrolled passkey |
| Malicious program upgrade | Multisig upgrade authority and transparent upgrade policy |

## Passkeys

A WebAuthn response is not valid merely because the browser says authentication succeeded. The program integration must verify the challenge, origin/RP ID, authenticator data, signature, credential identity and replay protections. Evaluate Solana's secp256r1 signature verification precompile; it cannot be invoked through CPI, so transaction composition must be designed around that constraint.

## Deployment gates

- Unit and integration tests for all state transitions.
- Negative tests for unauthorized callers and malformed accounts.
- Fuzz tests for threshold, nonce and timing invariants.
- Local validator and Devnet end-to-end tests.
- Program upgrade authority reviewed before mainnet.
- Independent audit before real funds are supported.

The current UI is a prototype and does not implement these guarantees yet.