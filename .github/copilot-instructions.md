# Copilot and cloud coding agent instructions

Follow the repository-wide rules in `/AGENTS.md` (the seven-agent roster, security boundaries, project facts, branch protocol, and PR evidence requirements).

For every task:
- Read `README.md`, `docs/architecture.md`, and `docs/security-model.md` before changing product or protocol behavior.
- Work only on the assigned issue and isolated branch. Do not search the user's computer.
- Keep the change minimal and preserve existing behavior.
- Do not commit secrets or request wallet seed phrases/private keys.
- Do not deploy, merge, force-push, or change production settings.
- Run the narrowest relevant tests, then the repository CI-equivalent checks where possible.
- Report exact commands and real outcomes; explicitly state checks that could not be run.

For Solana program changes, review account constraints, signer/writable requirements, PDA seeds and bumps, ownership, rent/lamport accounting, integer overflow, replay protection, state transitions, and authorization. Never claim the program is production-ready based only on Rust unit tests or compilation.

For frontend changes, keep simulation state visibly distinct from confirmed on-chain state. Never display a simulated recovery as completed on-chain.
