# Hackathon Requirements — compliance checklist and gap analysis

**Agent:** Hermes · **Date:** 2026-11-27 · **Deadline:** Sunday 2026-11-29 (exact UTC hour only in the dashboard)

This is the operational companion to `DEV3PACK_INTELLIGENCE.md`. That document records *what the
rules are*; this one records *where we currently stand against them* and *what must happen next*.

Everything in the "Requirement" column is `[OFFICIAL]`. The "Status" column is our own assessment
against the actual repository at commit `415f23e` (`https://github.com/NeonTechno/Solana-Recovers`).

---

## 0. Verified baseline state (2026-11-27, real command output)

Before anything else, the honest starting position. All of these were actually executed in
`/Users/user/solana-recovers-agents/hermes` at baseline `415f23e`.

| Check | Command | Result |
| --- | --- | --- |
| Rust compile | `cargo check -p rekey-program` | ✅ **EXIT 0** — 20 warnings, 0 errors (6m00s cold) |
| Rust tests | `cargo test -p rekey-program` | ✅ **EXIT 0 — 7 passed, 0 failed** |
| Frontend build | `npm run build` | ✅ **EXIT 0** — vite 6.4.6, 1946 modules, 25.35s |
| Dependency audit (CI gate) | `npm audit --audit-level=high` | ✅ **EXIT 0** — 15 moderate, 0 high, 0 critical |
| Rust formatting | `cargo fmt --all -- --check` | ⚠️ **FAILS** — committed source is not rustfmt-clean |
| CI formatting step | `cargo fmt --all` (as CI runs it) | ⚠️ **Rewrites files, never fails** — a no-op gate |
| SBF build | `anchor build` | ❌ **Cannot run — Anchor CLI not installed** |
| Devnet deployment | `anchor deploy --url devnet` | ❌ **Not done — the blocking eligibility gap** |
| Integration tests | `anchor test` | ❌ **Do not exist** — only `validate_policy` unit tests |

### The two real gaps

1. **The program has never been SBF-built or deployed to Devnet.** Everything else is ready; this
   single item decides main-track eligibility.
2. **CI cannot catch Rust formatting drift**, because the step rewrites instead of checking.

### What is already genuinely good — do not regress it

The baseline is **green**. The existing implementation is better than the launch kit's brief
assumed. Specifically, `docs/security-model.md` is already accurate and honest: it states the
current test scope precisely, lists the remaining security work in priority order, correctly
documents the npm advisory chain, and **already identifies the secp256r1-not-CPI-callable
constraint**. `docs/architecture.md` already separates on-chain components from the prototype UI
and labels the simulation limits. Preserve this discipline — it is a Stage-2 judging asset.

---

## A. Submission-form gate (5 steps)

| # | Step | Field | Requirement | Status | Action |
| --- | --- | --- | --- | --- | --- |
| A1 | Project | Name | Required | ⚠️ Partial | *"ReKey"* is a weak name for a security-infrastructure project; propose a Solana-oriented product name. **Owner: OpenClaude + Junie.** |
| A2 | Project | One-liner | Required | ⚠️ Partial | Current README one-liner is *"A hybrid, non-custodial recovery experience for Solana smart wallets."* — does not mention security. Rewrite once SENTINEL scope is fixed. |
| A3 | Project | Optional category | Optional | ✅ n/a | Leave optional; main track is default. |
| A4 | Project | **Contract address** | **Devnet or mainnet program address** | ❌ **BLOCKER** | `Anchor.toml` ships a *placeholder* program ID `284Xsc92KLKwKb7gBYAB8CXWc979FHL11tc185UYqcbP` that has never been deployed. **Codex must generate a keypair, build, and deploy to Devnet.** Never commit the keypair. |
| A5 | Project | Hub | Required-ish | ✅ Ready | `render.yaml` exists; a live URL gives Stage-2 "live demo verification" something to hit. **Owner: Vibe.** |
| A6 | Project | Description | Required | ⚠️ Partial | Update `docs/architecture.md` + README to the final integrated architecture. |
| A7 | Images | Screenshots | Required | ❌ Missing | Capture from the running app. **Owner: Junie.** |
| A8 | Links | **Demo video** | **< 3 minutes, strict; public link** | ❌ Missing | Script a ≤3-min demo of the real product. Longer ⇒ **disqualified**. **Owner: Junie + OpenClaude.** |
| A9 | Links | Repo | **Public GitHub repo** | ⚠️ Partial | Repo exists but is private today (`NeonTechno/Solana-Recovers` was cloned over HTTPS; check visibility). Public GitHub repo with README + setup instructions is a **hard** requirement. **Owner: human owner.** |
| A10 | Links | Live link | Required-ish | ❌ Missing | Needs a deploy. **Owner: Vibe.** |
| A11 | Team | Members | 1–4, solo allowed | ✅ Ready | This is a 7-agent operation on one codebase — confirm how it maps to the 1–4 member cap. **Owner: human owner.** See §D. |
| A12 | Review | Final submit | — | — | Lock in before the cutoff. |

## B. Main-track qualification gate (the one that actually matters)

Verbatim from the organiser's prize configuration:

| Requirement | Status | Action |
| --- | --- | --- |
| Project name + short description | ✅ | — |
| **Unique Solana program in Rust (Anchor/Quasar/Pinocchio/vanilla), deployed at least to devnet** | ❌ **BLOCKER — the #1 gap** | `programs/rekey/src/lib.rs` exists (663 lines, 8 instructions) and compiles, but has **never been SBF-built or deployed**. This is the difference between eligible and ineligible. |
| Contract deployment addresses (devnet or mainnet) in the README | ❌ | Follows from A4. |
| Public GitHub repo (README + setup instructions) | ⚠️ Partial | Make public; ensure setup instructions actually work from a clean clone. |
| Demo video & live demo link, < 3 min | ❌ | See A8/A10. |

## C. Cross-cutting rule gates

| Rule | Status | Action |
| --- | --- | --- |
| **Must be open source** | ⚠️ | Make the repo public. **Owner: human owner.** |
| **Must use Solana** | ✅ | Anchor program + Solana wallet adapters. |
| **Demo video < 3 min** | ❌ | Hard disqualification. Enforce with a timer. |
| **AI-generated code allowed** | ✅ | Permitted — but we must be able to explain and demo the code. Keep docs/tests current so the team can. |
| **Pre-existing code allowed if disclosed** | ❌ **Must fix** | The repo predates the hackathon (commits from "Initialize ReKey Solana wallet recovery prototype"). Add a **"What was built before vs. during"** section to the README. **Owner: OpenClaude.** |
| **Don't fork someone else's hackathon project** | ✅ | All code is our own. |
| **Devnet is acceptable** | ✅ | Do not deploy Mainnet. No real funds. |
| Demo must be a *real* product, not a pitch deck | ⚠️ | The UI must do real work — real simulation, real on-chain calls. |

## D. Gap analysis of `docs/hackathon-resources.md` (prior review, 26 Nov 2026)

The existing file is **directionally correct but materially incomplete**. Detail:

| Prior claim | Verdict | Note |
| --- | --- | --- |
| "Dev3pack Global Hackathon: 27–29 November 2026" | ✅ Correct | Matches JSON-LD `startDate`/`endDate`. |
| "Hybrid participation: online or local build station" | ✅ Correct | Confirmed. |
| "Main ecosystem: Solana" | ✅ Correct | Confirmed — Solana is the main track with $10,000. |
| "Best App Overall on Solana prize listed on the official page: $10,000+" | ⚠️ Imprecise | The **$10,000 is the track total**, not a single prize. Breakdown: $3,000 / $2,500 / $1,500, plus Top-10 Ledgers, a Top-30 $2,500 Claude Pro pool, and a $500 x402 bonus. Prior wording could mislead the team into expecting a $10k cheque. |
| "Best mobile app track: Solana Mobile / Seeker phones" | ✅ Correct | 1st/2nd/3rd = $2,000 Seeker Phones each. |
| "The Bridge Accelerator is listed as starting 7 December" | ✅ Correct | Confirmed; application deadline 3 Dec. |
| "Confirm exact submission requirements and cutoff in the participant dashboard" | ✅ Correct | Still true — exact UTC hour is dashboard-only. |
| "The public FAQ scrape exposed category headings but not expanded answers, so do not infer rules about existing code, open-source requirements or AI-generated code." | ❌ **Now resolved — and the conclusion changes** | We recovered the **full 32 Q/A** from the client bundle. The answers are explicit: **open source is mandatory**, **AI-generated code is allowed**, and **pre-existing code is allowed if disclosed in the README**. This is a material change to the project's compliance posture, not a refinement. |
| "app.dev3pack.xyz participant area requires sign-in, so its private resource catalogue was not accessible" | ✅ Accurate | `app.dev3pack.xyz` redirects to the public marketing site; the authenticated area needs an account. |
| Resource table (Solana portal, Rust Bootcamp, templates, precompiles, signing-in-production, Solana Mobile, Firecrawl, Supabase, ElevenLabs, Bonfires, Blockchain Developer Report) | ⚠️ Partly stale | See `SOLANA_TECHNICAL_RESOURCES.md`. Corrections: the Bootcamp now runs **EN/ES/TR** (not EN/ES); Firecrawl/Supabase/ElevenLabs are **sponsors with their own prize tracks** (ElevenLabs has a graded track), not merely sponsor logos; **LI.FI, Virtuals and Solana Mobile** are additional sponsor tracks that the prior table missed entirely. |
| "Prototype passkey signature verification with the Solana secp256r1 precompile" | ✅ Sound idea, ⚠️ needs a caveat | Accurate that the precompile exists, but the precompile **cannot be invoked via CPI** — it is a native program called by the runtime. Passkey verification must be done by the client and the result enforced through a normal on-chain approval path (exactly the guardian design already in `programs/rekey`). Also note `secp256r1` (P-256) ≠ WebAuthn's Ed25519; browser passkeys are typically ES256 (P-256) or EdDSA. **Owner: Codex to confirm before we commit to a passkey milestone.** |

### Net effect of the gap analysis
The prior review concluded *"do not infer rules about existing code, open-source requirements or
AI-generated code."* We have now replaced that uncertainty with hard answers. Three new **hard**
obligations exist that the prior doc did not capture:

1. **Deploy a Rust Solana program to Devnet.** (main-track qualification)
2. **Make the repo public.** (open-source rule)
3. **Disclose pre-hackathon code in the README.** (plagiarism rule)

And one **hard disqualifier** to design around:

4. **Demo video must be under 3 minutes.**

## E. Do-not-do list (things that would disqualify us or create legal/security exposure)

- ❌ Do not deploy to Mainnet. Devnet satisfies the rules. Human owner retains deploy authority.
- ❌ Do not commit a deployment keypair, wallet secret, seed phrase or `.env` with keys.
- ❌ Do not leave the repo private.
- ❌ Do not ship a demo video ≥ 3 minutes.
- ❌ Do not present a simulation as if it were on-chain state. The existing README already
  distinguishes these; keep that discipline.
- ❌ Do not claim the program is audited. It is not.
- ❌ Do not claim an external service can *block* a wallet transaction before the user signs. That
  is a cryptographic impossibility; only a program- or smart-account-controlled path can enforce.
- ❌ Do not fabricate threat intelligence or risk scores. Label heuristics vs. verified indicators.

## F. Prior-art and positioning (verified 2026-11-27)

Three projects already do web-only Solana transaction inspection:

| Repo | What it does | Rust/Anchor files | Stars |
| --- | --- | --- | --- |
| `AshishChikane/sol-security-transaction` | "SignSafeli: pre-sign AI firewall for Solana" | **NONE** | 0 |
| `Sugusdaddy/solana-tx-simulator` | Simulation + risk prediction before signing (MIT) | **NONE** | 0 |
| `mbbairagii/solana-xray` | "TX X-Ray" — decode + explain any transaction | **NONE** | 0 |

**All three are TypeScript-only with zero on-chain programs**, so all three would be **ineligible**
for the main track. That is our differentiator.

**Do:**
- Position on **enforceability** — an on-chain program that makes recovery/policy enforceable,
  with inspection clearly distinguished as advisory.
- Claim *no* novelty for "inspect a transaction before signing". Phantom and Blowfish ship
  production versions of that idea.
- Say plainly that a third-party service **cannot** block a transaction before the user's wallet
  signs it.

**Do not:**
- Use "AI firewall" or "risk-scores" as headline claims — already taken.
- Imply we detect malice better than Phantom/Blowfish.
- Overstate threat-intelligence capability. Label heuristics vs. verified indicators separately.

*Caveat:* this sweep used the public GitHub search API, not Colosseum Copilot's 5,400+ project
index — Copilot requires interactive device sign-in an autonomous agent cannot complete. If someone
can complete that login, a proper duplicate check should still be run before the product name and
positioning are finalised.

## G. Owner assignment (proposal — OpenClaude to ratify)

| Item | Suggested owner | Blocking? |
| --- | --- | --- |
| A4 / B — build + deploy Anchor program to Devnet | **Codex** | **Yes — eligibility gate** |
| Program-ID sync (`anchor keys sync`), `Anchor.toml` + `lib.rs` consistency | **Codex** | Yes |
| A8 / A7 — demo video + screenshots (< 3 min) | **Junie** | Yes |
| A9 — make repo public | **Human owner** | Yes |
| C — README provenance section | **OpenClaude** | Yes |
| A5 / A10 — live deployment | **Vibe** | Yes (Stage-2 live verification) |
| Security review of the program + transaction-security engine | **Aider** | Yes (Stage-2 code inspection) |
| Threat-intel fixtures and adversarial tests | **Kimi** | Strongly recommended |
| README devnet address + setup instructions | **OpenClaude** + **Codex** | Yes |
| Final submission-form entry | **Human owner** | Yes |

## H. Verification checklist for the final submission

Run this before submitting:

- [ ] `anchor build` succeeds from a clean clone and produces `target/deploy/rekey_program.so`
- [ ] `anchor keys sync` reports the same program ID in `Anchor.toml` and `programs/rekey/src/lib.rs`
- [ ] `solana program show --url devnet <PROGRAM_ID>` returns a deployed program
- [ ] `solana program deploy --url devnet --program-id <PROGRAM_ID> target/deploy/rekey_program.so` output is recorded
- [ ] The devnet program ID appears in the README
- [ ] README contains a "built before vs. during" provenance section
- [ ] README contains working setup instructions for a clean clone
- [ ] Repo visibility is **public**
- [ ] Demo video duration is **< 3:00** (checked with a timer, not estimated)
- [ ] Demo video is on a public link
- [ ] Live app URL responds
- [ ] `npm run build` passes
- [ ] `cargo test -p rekey-program` passes (currently 7/7 — keep it green)
- [ ] `cargo fmt --all -- --check` passes (currently FAILS — fix before submission)
- [ ] `anchor test` integration suite exists and passes (currently does not exist)
- [ ] `npm audit --audit-level=high` exits 0 (currently passes)
- [ ] No secrets in the tree (`git grep -nE '^[A-Za-z0-9]{64,}$'`-style sweep, plus `.env` review)
- [ ] The demo shows real on-chain state, and any simulation is labelled on screen
