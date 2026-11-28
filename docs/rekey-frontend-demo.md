# ReKey frontend demo

## Run locally

```bash
npm install
npm run dev
```

The app starts on Solana Devnet. Use a dedicated test wallet; never enter a seed phrase or private key.

## Walkthrough

1. Open the landing page and use the wallet adapter to connect Phantom or Solflare on Devnet.
2. Visit **Smart wallet** to review the connected public address and live RPC balance. The ReKey smart wallet remains marked unavailable until its program is deployed.
3. Visit **Recovery setup** and step through the local policy preview. Threshold and delay selections are not saved or sent to Solana.
4. In **Recovery request**, enter a public address for the local demo and approve with two distinct sample guardians. The view labels the result as simulated; it does not sign, submit, start a timelock, or claim on-chain success.
5. Review **Guardians**, **Activity**, **Security guide**, **MCP connections**, and **Lifeline Rewards**. Empty, disconnected, and unverified states are explicit rather than populated with invented records.
6. Check responsive layouts at 375 px, 768 px, and 1280 px. Use keyboard navigation and `prefers-reduced-motion` to verify focus and motion behavior.

## Current integration limits

- The frontend is Devnet-only and reads wallet balances from Solana RPC.
- The ReKey program is not deployed; initialization and recovery remain unavailable on-chain.
- Vibe has not published the API/MCP contract, so assistant, MCP client, and verified reward data remain disconnected.
- No Phantom/Solflare signing or recovery transaction flow is claimed as tested by this UI preview.