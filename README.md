# ReKey — Solana wallet recovery

**A hybrid, non-custodial recovery experience for Solana smart wallets.**

ReKey explores a safer recovery model combining device-bound passkeys, trusted guardians and Solana program-enforced authority changes.

> **Prototype status:** This repository currently contains a live Devnet wallet-connection dashboard and a browser-only recovery-flow simulation. The Anchor recovery program is not yet implemented or deployed. No recovery action in the current UI changes wallet authority or moves assets.

## Current implementation

- Phantom and Solflare wallet connection on Solana Devnet
- Live Devnet SOL balance lookup
- Devnet airdrop request
- Recovery and guardian experience prototype
- Explicit simulation labels to distinguish UI state from on-chain state

## Proposed protocol

1. A user creates or migrates assets into a program-controlled smart wallet.
2. The user registers a passkey and a guardian set.
3. A recovery request binds a new owner public key, nonce and expiry.
4. A configurable guardian threshold approves the exact request.
5. A timelock allows the current owner to cancel.
6. The Solana program validates the approvals and changes the wallet authority.

Guardians authorize recovery; they must never receive spending authority.

## Run locally

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

## Network

The frontend currently connects to **Solana Devnet**. Do not use real funds with this prototype.

## Hackathon resource choices

See [docs/hackathon-resources.md](docs/hackathon-resources.md) for the resources reviewed and how they map to this build.

## Architecture and security

- [Architecture](docs/architecture.md)
- [Security model](docs/security-model.md)

## Roadmap

- [ ] Anchor program: wallet config and PDA-controlled vault
- [ ] Guardian registration and threshold policy
- [ ] Recovery request, approval, cancellation and timelock
- [ ] WebAuthn passkey verification using Solana secp256r1 verification support
- [ ] Existing-wallet migration into ReKey smart wallets
- [ ] Devnet deployment and end-to-end integration tests
- [ ] Independent security review before mainnet use

## Disclaimer

ReKey is experimental software. The current prototype is not a wallet recovery service and must not be used to protect valuable assets.