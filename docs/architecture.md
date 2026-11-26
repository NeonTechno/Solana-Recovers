# ReKey architecture

## Product boundary

ReKey is a recovery layer for smart wallets controlled by a Solana program. It cannot recover the private key of a conventional externally-owned Solana account. Existing-wallet support therefore means a user voluntarily connects and migrates assets into a ReKey-controlled account.

## Proposed trust boundaries

- **Owner:** controls routine wallet actions and can update recovery policy while authorized.
- **Passkey:** authenticates the user; it is not a guardian and is not a server-side password reset.
- **Guardians:** sign a specific recovery authorization; they cannot spend from the wallet.
- **Recovery program:** validates authorization, nonce, expiry, threshold, delay and cancellation.
- **Application backend:** optional notification and indexing only; never an authority to change ownership.

## On-chain account model (planned)

- `WalletConfig`: current owner, wallet/vault references, policy version and bump.
- `GuardianSet`: guardian public keys, threshold and policy version.
- `RecoveryRequest`: proposed new owner, request nonce, approval bitmap/count, created slot/time, expiry and state.
- `PasskeyRegistry`: registered passkey credential public keys and metadata.
- `Vault`: PDA-controlled SOL/SPL token custody.

Account seeds and serialized layouts must be finalized alongside the Anchor implementation. Do not treat these names as deployed account types.

## Recovery state machine

`Idle → Pending → Approved → Executable → Executed`

Alternative transitions:

- `Pending → Cancelled` by the current owner.
- `Pending → Expired` after the configured expiry.
- `Approved → Cancelled` only if policy explicitly allows owner cancellation during the timelock.

Every approval must bind to the same wallet, request nonce, new owner, policy version and expiry. Duplicate or replayed approvals must fail.

## Existing wallet path

1. Connect an existing wallet through Wallet Standard-compatible adapters.
2. Ask the owner to sign an explicit migration transaction.
3. Create a ReKey wallet/vault.
4. Transfer only user-selected SOL and supported SPL assets.
5. Confirm balances and recovery setup on-chain.

The original account remains controlled by its original key. Never imply that ReKey can alter its authority without the owner's authorization.

## Frontend status

The current React/Vite frontend connects Phantom or Solflare on Devnet and reads SOL balances. Guardian and recovery actions are UI simulations only. They do not submit program instructions.