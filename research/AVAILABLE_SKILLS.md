# Available Skills — Hermes discovery report (CLI-native)

**Agent:** Hermes · **Date:** 2026-11-27 · **Scope:** every CLI environment present on this machine.

> **Critical caveat, read this first.** A skill discovered under one CLI's directory is **not
> automatically available to another CLI**. `~/.claude/skills/` is not read by Hermes. Hermes
> reaches skills through the Hermes skill loader (`~/.hermes/skills/`, plus
> `openclaw-imports/*` which are vendored copies). The table below therefore records, per skill,
> **which CLIs can actually invoke it** and **where its bytes live**.

> **Security note — telemetry.** The `superstack`-family skills (`submit-to-hackathon`,
> `review-and-iterate`, `virtual-solana-incubator`, `deploy-to-mainnet`, `debug-program`,
> `build-with-claude`, `scaffold-project`, `product-review`, `solana-beginner`,
> `frontend-design-guidelines`, `number-formatting`, `navigate-skills`, and more) all begin with a
> **mandatory preamble that phones home** to a `convexUrl` taken from `~/.superstack/config.json`
> and writes to `~/.superstack/telemetry.jsonl`, and they **interrupt the workflow to ask the user
> about telemetry**. Their *substantive* content is high quality and relevant. But:
> - The preamble is not optional in the skill as written.
> - It sends skill name, phase, platform and a timestamp off-host.
> - **Do not run these skills unattended** in an automated seven-agent run, and do not let the
> telemetry prompt block a deadline-critical task.
>
> **Recommendation to the team:** treat these skills as *documentation to read*, not as commands to
> auto-execute, until the human owner approves the telemetry behaviour. The Hermes-native
> alternatives listed in §4 have no telemetry preamble.

---

## 1. Skill roots discovered on this machine

| CLI | Root | Skills found | Readable by Hermes? |
| --- | --- | --- | --- |
| **Hermes** | `/Users/user/.hermes/skills` | **361** | ✅ Yes — this is the Hermes loader root |
| Claude Code | `/Users/user/.claude/skills` | 34 | ❌ No — read-only reference |
| Codex | `/Users/user/.codex/skills` | 38 | ❌ No — read-only reference |
| Agents (shared) | `/Users/user/.agents/skills` | 340 | ❌ No — read-only reference |
| jcode | `/Users/user/.jcode/skills` | 31 | ❌ No — read-only reference |
| Cursor | `/Users/user/.cursor/skills` | 1 | ❌ No — read-only reference |
| Aider | `/Users/user/.aider` | 0 (not a skills dir) | n/a |
| OpenClaw | `/Users/user/.openclaw/skills` | 0 (dir empty/absent) | n/a |

**Total distinct skills on disk:** ~700 (heavy overlap — see §2).

### 1.1 Provenance / duplication

Most skills are **byte-identical copies** across CLIs, verified by SHA-256 of `SKILL.md`:

| Skill | CLIs | SHA-256 (first 12) | Status |
| --- | --- | --- | --- |
| `solana-dev` | hermes, agents, jcode | `e22e188e5204` | Identical |
| `virtual-solana-incubator` | claude, codex, agents | `df70b64e9bbe` | Identical |
| `submit-to-hackathon` | claude, codex, agents | `b367d4110aca` | Identical |
| `review-and-iterate` | claude, codex, agents | `eb1c3eebfe7d` | Identical |
| `deploy-to-mainnet` | claude, codex, agents | `92e803d99fd9` | Identical |
| `debug-program` | claude, codex, agents | `7f891a4f325b` | Identical |
| `build-with-claude` | claude, codex, agents | `6690f527ddc1` | Identical |
| `scaffold-project` | claude, codex, agents | `faa6889603d3` | Identical |
| `product-review` | claude, codex, agents | `74ad74369573` | Identical |
| `solana-beginner` | claude, codex, agents | `ffc8356fa992` | Identical |
| `frontend-design-guidelines` | claude, codex, agents | `c1acb0e2bf3c` | Identical |
| `number-formatting` | claude, codex, agents | `f69aa1ed8952` | Identical |
| `navigate-skills` | claude, codex, agents | `3263e4c3c8f1` | Identical |
| `reverse-engineer-anything` | hermes, claude, agents | `3456aab99d48` | Identical |
| `webapp-testing` | hermes, agents, jcode | `51b7349e77ec` | Identical |
| `firecrawl-search` / `firecrawl-scrape` | hermes, agents, jcode | `113957c4c04e` / `472b810ca146` | Identical |
| `skill-creator` | hermes, agents, jcode | `d57b6e3a4453` | Identical |
| `skill-creator` | codex (`.system/`) | `da44c88f6b38` | **Divergent** — Codex has its own system copy |
| `colosseum-copilot` | codex (`4ba8492bc579`) vs agents (`5753b2993339`) | — | **Divergent** — the agents copy is 3× larger; prefer it |

**Interpretation:** there is a shared "superstack" Solana skill pack installed into three CLI roots
(`.claude`, `.codex`, `.agents`) plus a Hermes vendored copy under
`~/.hermes/skills/openclaw-imports/`. **Do not assume a skill is present for a given agent.**

---

## 2. Highly relevant skills — recommended assignments

### 2.1 Solana / Anchor / program engineering

| Skill | Where | Why it matters here | Status |
| --- | --- | --- | --- |
| **`solana-dev`** (v1.1.0, author *Solana Foundation*, MIT) | `~/.hermes/skills/openclaw-imports/solana-dev/` | The single most relevant skill. Covers Anchor + Pinocchio, wallet connection, transaction building/sending/confirmation UX, IDL codegen, LiteSVM/Mollusk/Surfpool testing, a security checklist, and a compatibility matrix. Includes explicit agent guardrails (never sign without approval; never store keys; simulate before sending; treat on-chain data as untrusted). | **Inspected (full SKILL.md + frontmatter read).** Has 10 linked reference files. |
| **`virtual-solana-incubator`** | `~/.claude/skills/` (also codex, agents) | Deep SVM/Rust/Anchor curriculum with a level-assessment step and real exercises; matches the Dev3pack Rust Bootcamp curriculum (accounts → PDAs → CPI → Anchor). Best fit for **Codex** to deepen program expertise and for onboarding any Rust-rusty teammate. | **Inspected** (frontmatter + headings + non-negotiables). Telemetry preamble — see caveat. |
| **`solana-beginner`** | `~/.claude/skills/` | Fundamentals. Useful for the frontend and DevOps agents, less for Codex. | Identified. |
| **`debug-program`** | `~/.claude/skills/` | Debugging failing Solana programs/transactions. Directly useful once Codex has the program building on Devnet. | Identified. |
| **`build-with-claude`** | `~/.claude/skills/` | Step-by-step Solana MVP build guidance. | Identified. |
| **`scaffold-project`** | `~/.claude/skills/` | Workspace setup patterns. | Identified. |
| **`navigate-skills`** | `~/.claude/skills/` | Meta-skill: browse all installed Solana skills/MCPs. Useful for agents that do not know what they have. | Identified. |

### 2.2 Security, auditing, adversarial testing

| Skill | Where | Why it matters here | Status |
| --- | --- | --- | --- |
| **`review-and-iterate`** | `~/.claude/skills/` | Solana-specific code review for quality/security/production readiness. Its stated non-negotiables are excellent and match our engineering bar: *"Every finding must include a specific fix suggestion with code"*, *"Security issues are always flagged as critical"*, *"Do not generate false positives to look thorough. If the code is clean, say so."* It also names the exact Solana OWASP-equivalent checklist: **missing signer checks, unchecked math, PDA confusion, rent drain, reinitialization attacks** — and points at `references/security-basics.md`. **Best fit for Aider.** | **Inspected** (non-negotiables + resources read). Telemetry preamble. |
| **`adversarial-testing`** | `~/.hermes/skills/adversarial-testing/` | Hermes-native, no telemetry. Methodology for *falsifying* hypotheses via adversarial instance generation rather than confirming evidence — explicitly *"Rather than seeking confirming evidence, this approach focuses on finding counterexamples."* **Perfect fit for Kimi** and for the "distinguish heuristics from verified indicators" requirement. | **Inspected** (frontmatter + methodology read). **No telemetry.** |
| **`security-architecture-review`** | `~/.hermes/skills/research/security-architecture-review/` | Independent architecture/security review of a novel system. **Best fit for OpenClaude** to review the SENTINEL architecture before it is ratified. | Identified. |
| **`safe-repository-fixes`** | `~/.hermes/skills/software-development/safe-repository-fixes/` | Workflow for auditing and fixing a repo without clobbering others' work. Directly matches our "never overwrite another agent's changes" constraint. | Identified. |
| **`systematic-debugging`** | `~/.hermes/skills/software-development/systematic-debugging/` | 4-phase root-cause debugging (understand before fixing). | Identified. |
| **`verified-solution-sets`** | `~/.hermes/skills/software-development/verified-solution-sets/` | Deliver a complete solution set to an external spec. | Identified. |
| **`reverse-engineer-anything`** | `~/.hermes/skills/`, `~/.claude/skills/`, `~/.agents/skills/` | Native/binary/Electron RE. Not needed for our Solana work. | Identified, low relevance. |
| **`colosseum-copilot`** | `~/.agents/skills/` (larger variant) | Searches **5,400+ Solana hackathon projects** for ideas and patterns. The Dev3pack FAQ itself recommends Colosseum Copilot for idea discovery. **Useful for Hermes/Octavian to sanity-check that our SENTINEL concept isn't a duplicate.** | Identified; divergent variants — prefer the `agents` copy (31 KB). |

### 2.3 Hackathon submission

| Skill | Where | Why it matters here | Status |
| --- | --- | --- | --- |
| **`submit-to-hackathon`** | `~/.claude/skills/` | Purpose-built for exactly our task. Its non-negotiables independently corroborate my Dev3pack findings: *"The submission must have a working demo link"*, *"Include clear setup instructions (judges will try to run it)"*, *"**Demo video script must be under 3 minutes**"*, *"Never fabricate deployment status"*. Its pre-flight checks map 1:1 onto my checklist: `solana program show <PROGRAM_ID> --url devnet`, `git remote -v`, README Quick Start. | **Inspected** in depth. Telemetry preamble. |
| `hackathon-submission` | `~/.hermes/skills/.archive/hackathon-submission/` | **Archived** — an older generic version. Do not use. | Identified, archived. |

### 2.4 Frontend / React / UX (Junie)

| Skill | Where | Why it matters | Status |
| --- | --- | --- | --- |
| `frontend-design-guidelines` | `~/.claude/skills/` (14 KB) | High-quality web interface design rules for building/reviewing UIs. | Identified. |
| `number-formatting` | `~/.claude/skills/` (13 KB) | **Solana-specific numeric formatting for crypto UIs** (lamports, SOL, token amounts, precision). Directly relevant to our balance/amount displays. | Identified. |
| `design-taste-frontend` | `~/.hermes/skills/`, `~/.agents/skills/` | Anti-slop frontend guidance. | Identified. |
| `vercel-react-best-practices` | `~/.hermes/skills/` (from Vercel) | React/Next perf. Relevant if we touch the React app. | Identified. |
| `webapp-testing` | `~/.hermes/skills/openclaw-imports/webapp-testing/` | Hermes-native, no telemetry. Drive/test the local web app. **Useful for verifying the demo flow.** | Identified. |

### 2.5 DevOps / API / deployment (Vibe)

| Skill | Where | Why it matters | Status |
| --- | --- | --- | --- |
| `deploy-to-mainnet` | `~/.claude/skills/` | Devnet→mainnet production checklist. **Use with care** — we are explicitly forbidden from mainnet deployment. Read it as a *checklist*, do not execute its mainnet steps. | Inspected (preamble). Telemetry preamble. |
| `safe-infrastructure-provisioning` | `~/.hermes/skills/` | Provision infra/runtimes safely. Relevant to the Render deploy + Devnet RPC. | Identified. |
| `vercel-deploy` | `~/.hermes/skills/` | Vercel deploy with env handling. Our repo uses **Render** (`render.yaml`), not Vercel — lower relevance. | Identified. |
| `firecrawl-search` / `firecrawl-scrape` | `~/.hermes/skills/openclaw-imports/` | Web search + scrape. **Firecrawl is a Dev3pack sponsor** and its MCP/local service was the mechanism the prior research pass used. Its local service was **down this session** (`localhost:3002` connection refused), which is why I used `curl` + a custom HTML extractor instead. | Identified. Local service **currently unavailable**. |

### 2.6 Research / multi-agent

| Skill | Where | Why it matters | Status |
| --- | --- | --- | --- |
| `multi-agent-research` | `~/.hermes/skills/` | Organising and conducting multi-agent research. **Best fit for Hermes itself** — and for the seven-agent coordination pattern. | Identified. |
| `session-history-archaeology` | `~/.hermes/skills/research/` | Reconstruct prior work from session history. Useful if we need to recover context from before this run. | Identified. |
| `research-paper-writing` | `~/.hermes/skills/` | Not needed. | Identified. |
| `skill-creator` | `~/.hermes/skills/openclaw-imports/` | Creating/updating skills. Relevant if we formalise a repeatable workflow. | Identified. |

---

## 3. Solidity→Rust traps and other domain warnings

`[ASSUMPTION]` The `virtual-solana-incubator` skill has an explicit **Track B: EVM Developer
(Knows Solidity)** curriculum, implying it exists because agents arriving from EVM land on
Solana-specific mistakes. For our repo, the equivalent traps are:

1. **PDA seeds must include the wallet identity and a nonce** — the repo already does this
   (`seeds = [b"recovery", wallet_config.key().as_ref(), &nonce.to_le_bytes()]`).
2. **`has_one` + explicit seed constraints together** — the repo uses both, correctly.
3. **The `init` + `seeds` + `bump` pattern** on `WalletConfig`, `Vault` and `RecoveryRequest`.
4. **Rent-exempt accounting on the vault** — `withdraw_sol` checks `amount.saturating_add(rent_floor)`
   against the vault balance. Correct. (This is exactly the "rent drain" item in the
   `review-and-iterate` checklist.)
5. **Arithmetic must be `checked_*`** — the repo uses `checked_add`/`checked_sub` and an
   `ArithmeticOverflow` error. Correct.

`[ASSUMPTION]` **Ask Aider to run the `review-and-iterate` Solana checklist against
`programs/rekey/src/lib.rs` explicitly.** Five of its named items (signer checks, unchecked math,
PDA confusion, rent drain, reinitialization) map onto exactly the code we have.

---

## 4. Hermes-native alternatives with **no telemetry preamble**

Preferred for unattended/automated use. All live under `~/.hermes/skills/` and are directly
loadable by Hermes (and therefore also by any agent that can read the filesystem).

| Skill | Path | Use for |
| --- | --- | --- |
| `solana-dev` | `~/.hermes/skills/openclaw-imports/solana-dev/` | Solana/Anchor engineering — **already inspected in this session** |
| `adversarial-testing` | `~/.hermes/skills/adversarial-testing/` | Kimi's falsification methodology |
| `security-architecture-review` | `~/.hermes/skills/research/security-architecture-review/` | OpenClaude's architecture review |
| `safe-repository-fixes` | `~/.hermes/skills/software-development/safe-repository-fixes/` | Safe multi-agent repo edits |
| `systematic-debugging` | `~/.hermes/skills/software-development/systematic-debugging/` | Root-cause debugging |
| `webapp-testing` | `~/.hermes/skills/openclaw-imports/webapp-testing/` | Verify the demo flow |
| `plan` | `~/.hermes/skills/software-development/plan/` | Write an actionable plan to `.hermes/` |
| `multi-agent-research` | `~/.hermes/skills/multi-agent-research/` | Multi-agent research coordination |

---

## 5. What is NOT available

Recorded so nobody wastes time hunting:

- **No dedicated "smart contract auditing" skill** beyond `review-and-iterate` +
  `security-architecture-review`. No Slither-equivalent for Rust, no formal-verification tool
  skill (the `review-and-iterate` doc references a `qedgen` skill for formal verification — **not
  present on this machine**).
- **No Anchor-specific build/deploy skill** for `anchor build` / `anchor keys sync` /
  `cargo-build-sbf` setup. `solana-dev` covers it conceptually but the **Anchor CLI is not
  installed** — see §6.
- **No Solana threat-intelligence / malware-indicator skill.** Kimi's adversarial work will have to
  build its own fixtures. `query-token-audit` is Binance-centric, not Solana — **not applicable**.
- **No Rust-specific testing skill** beyond what `solana-dev` says about LiteSVM/Mollusk/Surfpool.
  **Mollusk** (`anza-xyz/mollusk`) exists as a first-party crate but there is no local skill
  wrapping it.
- **No DevOps skill** that matches our actual Render blueprint (`render.yaml`); `vercel-deploy` is
  for the wrong platform.
- **No `.aider` skills directory**, and `~/.openclaw/skills/` is empty — OpenClaude will have
  fewer Solana-specific aids than Claude Code or Codex unless it reads them from the shared paths.

---

## 6. Environment gaps that block skill workflows

| Gap | Impact | Owner |
| --- | --- | --- |
| **`anchor` CLI not installed** | Blocks `anchor build`, `anchor test`, `anchor keys sync`, `anchor deploy` — i.e. the **Devnet deployment gate** | Codex / Vibe |
| **`cargo-build-sbf` (platform-tools) not verified** | Required for SBF build | Vibe |
| Firecrawl local service down (`localhost:3002` refused) | `firecrawl-*` skills unusable as-is; I used `curl` + a custom extractor instead | Vibe |
| `python3` / `pip` not on PATH (`uv` is available) | Affects any Python-based tooling | Vibe |
| No `tests/` directory in the repo | `Anchor.toml` references `tests/**/*.ts` but it does not exist; the README's "Rust tests 7/7" claim is **not reproducible** from this tree | Codex |

---

## 7. Summary recommendation to the team

1. **Codex** → read `~/.claude/skills/virtual-solana-incubator` (Anchor/Rust depth) and
   `~/.hermes/skills/openclaw-imports/solana-dev` (`references/programs/anchor.md`,
   `references/testing.md`, `references/security.md`, `references/compatibility-matrix.md`).
   **Install Anchor CLI first.**
2. **Aider** → apply the `review-and-iterate` Solana checklist to `programs/rekey/src/lib.rs`;
   read `~/.hermes/skills/research/security-architecture-review`.
3. **Kimi** → use `~/.hermes/skills/adversarial-testing` for falsification methodology.
4. **Junie** → `number-formatting` (Solana amounts) + `frontend-design-guidelines` +
   `webapp-testing` to verify the demo flow.
5. **Vibe** → `safe-infrastructure-provisioning`; install Anchor/platform-tools.
6. **OpenClaude** → `security-architecture-review` before ratifying the SENTINEL architecture.
7. **Hermes** → `multi-agent-research` for coordination; `colosseum-copilot` to check for
   duplicate prior art before we commit to a concept.
8. **Everyone** → do not auto-run the `superstack` telemetry skills unattended; and remember a
   skill found in one CLI's directory is **not** automatically invocable from another.
