# ReKey architecture

## Product boundary

ReKey is a recovery layer for smart wallets controlled by a Solana program. It cannot recover the private key of a conventional externally-owned Solana account. Existing-wallet support therefore means a user voluntarily connects and migrates assets into a ReKey-controlled account.

## On-chain components

The initial Anchor program implements:

- `WalletConfig`: immutable initial-owner seed, current owner, guardian list, threshold, timelock, nonce and policy version.
- `Vault`: program-owned PDA that holds SOL and can release it only when the current wallet owner authorizes a withdrawal.
- `RecoveryRequest`: proposed new owner, nonce, policy version, timestamps, guardian approvals and state.

## Instructions

- `initialize_wallet`: creates the wallet configuration and SOL vault.
- `update_recovery_policy`: changes guardians, threshold and delay; increments policy version.
- `initiate_recovery`: a registered guardian creates a request for a new owner.
- `approve_recovery`: guardians sign on-chain approval transactions; duplicate approvals fail.
- `execute_recovery`: permissionless execution after threshold and timelock; changes current owner.
- `cancel_recovery`: current owner cancels before the timelock elapses.
- `expire_recovery`: anyone can mark an overdue request expired.
- `withdraw_sol`: current owner withdraws SOL from the program-controlled vault.

## Recovery state machine

`Pending → Approved → Executed`

Alternative transitions:

- `Pending → Cancelled` by current owner during the timelock.
- `Approved → Cancelled` by current owner before the timelock elapses.
- `Pending/Approved → Expired` after the request expiry.

Every request binds to the wallet, nonce, proposed owner and policy version. Updating the guardian policy invalidates requests created under the prior policy version.

## Existing wallet path

1. Connect an existing wallet through Wallet Standard-compatible adapters.
2. Ask the owner to sign an explicit migration transaction.
3. Create a ReKey wallet/vault.
4. Transfer only user-selected SOL and supported SPL assets.
5. Confirm balances and recovery setup on-chain.

The original account remains controlled by its original key. Never imply that ReKey can alter its authority without the owner's authorization.

## Important limitations

- The current frontend recovery actions are simulations only.
- The Anchor source is not yet SBF-built or deployed.
- The current vault supports SOL only; SPL token custody is a later milestone.
- Passkey verification is not implemented yet. The current on-chain guardian approval path uses normal Solana transaction signatures.
- A public placeholder program ID is present. Generate and sync a deployment keypair securely before deployment.
