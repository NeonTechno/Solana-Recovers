# Cloud-first seven-agent orchestration

## Goal

Run the Solana Recovers / ReKey development swarm without requiring seven local CLI installations or a local repository clone. The GitHub repository is the shared source of truth. Cloud coding environments perform repository edits and tests; browser-based AI sessions provide research and independent reviews.

Repository: https://github.com/NeonTechno/Solana-Recovers  
Default branch: `main`  
Orchestrator: ChatGPT  
Execution model: cloud-first

## Important capability distinction

A browser chat product and a cloud coding agent are not interchangeable.

- A **cloud coding agent** must be explicitly granted repository access and must be able to create a branch, edit files, run commands, and open a PR.
- A **browser research/review session** can analyze prompts, documentation, diffs, and test reports, but cannot modify this repository unless its product provides an authorized GitHub integration.
- Do not assume that Hermes, Mistral Vibe, Aider, Junie, or Kimi automatically have GitHub write access. Verify the actual product and account capability before assigning code changes.
- GitHub's supported third-party coding-agent integrations and availability depend on account plan, repository settings, provider enablement, and preview status. Check current GitHub documentation and account settings before relying on them.

The seven role names are retained as the swarm's responsibility map. A provider can fill a role without being the identically named CLI. The role roster is not a claim that seven autonomous cloud workers are already connected.

## Roles

1. **Hermes — Research lead**  
   Verify Dev3pack requirements, judging criteria, submission requirements, Solana/Anchor documentation and ecosystem integrations. Produce source-linked findings; do not change code unless explicitly reassigned.

2. **OpenClaude — Principal architect**  
   Own architecture proposals, interfaces, acceptance criteria, dependency sequencing and integration review. Resolve overlapping ownership before implementation.

3. **Codex — Solana protocol engineer**  
   Own Rust/Anchor instructions, account constraints, state transitions, PDA design, and protocol tests. No deployment or program-ID changes without approval.

4. **Aider — Security engineer**  
   Own threat modeling, authorization review, dependency risk analysis, negative tests, and security regression coverage. Independent review is required for protocol-sensitive PRs.

5. **Junie — Application engineer**  
   Own React/TypeScript UI, wallet adapters, accessibility, transaction UX, and accurate simulation/on-chain status labeling.

6. **Kimi — Adversarial reviewer**  
   Independently challenge assumptions, construct abuse cases, inspect diffs and test gaps, and return prioritized findings. Reviewers should not silently edit the implementation branch.

7. **Vibe — Integration and DevOps engineer**  
   Own cloud CI, build reproducibility, RPC configuration, test automation, observability, and developer experience. Never place RPC secrets or deployment credentials in source code.

## Operating workflow

### 1. ChatGPT triage

ChatGPT acts as the user's coordinator:
- Read the issue, repository instructions, current code, and relevant CI results.
- Break work into independent, reviewable issues.
- Assign one primary role and one reviewer role to each issue.
- Identify files likely to conflict and sequence tasks.
- Keep a task ledger in GitHub Issues/Projects; do not rely on untracked chat-only state.

### 2. Dispatch

For code-changing tasks, dispatch only to a cloud coding agent with explicit repository access. Each task must use its own branch and produce a draft PR.

For research-only or review-only tasks, use the provider's browser interface and provide only the relevant public docs, issue description, and PR diff. Paste the findings back into the GitHub issue. Do not provide credentials.

### 3. Isolated execution

- One agent/task per branch.
- Do not have two agents write the same files concurrently.
- Keep task scope small enough for a single PR.
- Agents must not merge their own PRs.
- The architect/orchestrator resolves interface conflicts before integration.

### 4. Validation

The current repository CI workflow runs:
- Frontend: Node.js 22, `npm install`, `npm audit --audit-level=high`, `npm run build`.
- Program: stable Rust with rustfmt, `cargo fmt --all`, `cargo check --manifest-path programs/rekey/Cargo.toml`, and `cargo test --manifest-path programs/rekey/Cargo.toml`.

Important limitations:
- CI does not currently run `anchor build`, SBF compilation, local-validator integration tests, or Devnet end-to-end tests.
- The current Rust compilation and unit tests do not prove the program is deployable or secure.
- The README states that the Anchor program is not SBF-built, deployed, or independently audited.
- The current frontend includes a browser-only recovery simulation; do not report it as a live on-chain recovery flow.
- The current CI uses `npm install`; confirm lockfile strategy before changing it to `npm ci`.
- Inspect actual GitHub Actions runs and job logs when CI fails. Do not ask the user to copy logs if repository access is available.

Before a PR is eligible for human review:
1. Format check passes without modifying files.
2. Frontend build passes when frontend files change.
3. Rust compile and unit tests pass when program files change.
4. Dependency audit is reviewed when dependencies change.
5. Security reviewer has inspected authorization-sensitive changes.
6. PR describes tests not run and remaining deployment gates.

### 5. Integration and approval

ChatGPT summarizes the PR, verifies the CI run and review findings, requests fixes where necessary, and presents a concise approval recommendation to the user. Only the user merges to `main` and authorizes deployments.

## Safety and permissions

Recommended GitHub settings:
- Protect `main`; require pull requests.
- Require CI checks before merge.
- Require at least one human approval for protocol-sensitive changes.
- Disable force pushes and branch deletion on `main`.
- Keep cloud agents scoped to repository access and the minimum write permissions needed to open branches/PRs.
- Do not expose Actions secrets to untrusted pull-request code.
- Use GitHub's environment protection and required reviewers for any future deployment workflow.
- Keep Mainnet deployment workflows disabled until the program has passed the documented deployment gates and an independent audit.

No workflow in this bootstrap grants deployment authority or creates secrets.

## Credit and handoff protocol

Provider credit/usage limits are not universally exposed to GitHub or ChatGPT. Do not claim automatic credit monitoring unless a provider exposes a documented API or account signal.

Each agent should report status at task checkpoints and before stopping. If usage is low or a session is ending, it must:
1. Stop starting new work.
2. Save its work on its own branch.
3. Record exact files, commits, tests and failures in the issue.
4. List the next concrete action and unresolved risks.
5. Hand off to the next named role.

The orchestrator can detect stale issues/branches and request a handoff, but cannot guarantee visibility into private provider quotas.

## First recommended execution sequence

1. **Hermes:** verify the current Dev3pack challenge requirements and submission constraints using official sources.
2. **OpenClaude:** audit the repository and produce a milestone plan grounded in the current code.
3. **Codex + Aider:** jointly review the Anchor program's account constraints and state transitions; Codex proposes fixes, Aider independently challenges them.
4. **Junie:** audit the UI and wallet transaction flows, preserving simulation labels.
5. **Kimi:** conduct an independent threat-model and edge-case review of the proposed architecture.
6. **Vibe:** audit cloud CI gaps and propose reproducible Anchor/SBF and validator test jobs.
7. **OpenClaude:** reconcile findings into one implementation backlog; ChatGPT presents it for user approval.

Do not start broad parallel implementation until this audit and ownership map are complete.
