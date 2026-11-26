# ReKey — Solana wallet recovery

**A hybrid, non-custodial recovery experience for Solana smart wallets.**

ReKey explores a safer recovery model combining device-bound passkeys, trusted guardians and Solana program-enforced authority changes.

> **Prototype status:** The current Render app has a live Devnet wallet-connection dashboard and a browser-only recovery-flow simulation. The Anchor program now contains the first on-chain milestone: wallet/vault initialization, guardian policy management, recovery requests, threshold approvals, owner cancellation, timelock enforcement, expiry and SOL withdrawals. It has not yet been compiled with the Solana SBF toolchain, deployed to Devnet, or independently audited. Do not use real funds.

## Current implementation

- Phantom and Solflare wallet connection on Solana Devnet
- Live Devnet SOL balance lookup and airdrop request
- Recovery and guardian experience prototype
- Anchor program source for the first smart-wallet/recovery flow
- Explicit simulation labels to distinguish UI state from on-chain state
- GitHub Actions checks for frontend build and Rust formatting/compilation

## Run the frontend

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
npm run preview
```

## Solana program

Requirements: Rust, Solana CLI and Anchor CLI 0.31.1.

```bash
anchor build
anchor test
```

The program ID in `Anchor.toml` and `programs/rekey/src/lib.rs` is a public placeholder. Generate a deployment keypair in your own secure environment and run `anchor keys sync` before deploying. Never commit the deployment keypair or wallet secret.

## Network

The frontend currently connects to **Solana Devnet**. The program has not been deployed. Do not use real funds.

## Documentation

- [Architecture](docs/architecture.md)
- [Security model](docs/security-model.md)
- [Dev3pack resource review](docs/hackathon-resources.md)

## Security boundaries

- Guardians authorize recovery; they do not receive spending authority.
- Recovery approvals are bound to a wallet, request nonce, destination owner and policy version.
- The owner can cancel during the timelock.
- The backend must never be an authority for wallet ownership changes.
- Conventional Solana keypairs cannot be recovered by this program. Existing users must voluntarily migrate assets into a ReKey-controlled account.

## Disclaimer

ReKey is experimental software. The program has not been audited and is not ready for mainnet or valuable assets.