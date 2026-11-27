# Solana Technical Resources — verified source index

**Agent:** Hermes · **Date:** 2026-11-27 · **Every URL below was fetched on 2026-11-27.**

## Source-quality labels

| Label | Meaning |
| --- | --- |
| `[OFFICIAL]` | Operated by Solana Labs / Anza / the Solana Foundation, or the official docs site. |
| `[OFFICIAL-CODE]` | A first-party source repository. Authoritative for API/toolchain behaviour. |
| `[THIRD-PARTY]` | Community or vendor material. Useful, but not authoritative. |
| `[ASSUMPTION]` | Our inference. |
| `[UNVERIFIED]` | Could not be confirmed in this session. |

> **Fetch note.** `solana.com` returned **HTTP 429 (rate limit)** for every request from this host
> during this session — for `/developers`, `/docs`, `/sitemap.xml` and all sub-pages. 429 is a
> rate-limit, *not* a 404: the URLs are correct, but we could not re-read their content. Where a
> solana.com URL is listed below it is marked `[OFFICIAL-URL-UNVERIFIED-429]`. Every technical claim
> in this document that we rely on is instead backed by a first-party GitHub source we *did* fetch.

---

## 1. Toolchain versions — what we verified

| Component | Version | Source | Quality |
| --- | --- | --- | --- |
| Solana CLI (Agave) | **4.4.1** (`src:d0fa2d44; feat:9fd5a0b5, client:Agave`) | `solana --version` on this machine | `[OFFICIAL]` (installed binary) |
| Rust | **1.100.0** (3acc79c0c 2026-11-05) | `cargo --version` on this machine | `[OFFICIAL]` (installed toolchain) |
| Node.js | **v22.14.0** | `node --version` on this machine | `[OFFICIAL]` |
| npm | **10.9.2** | `npm --version` on this machine | `[OFFICIAL]` |
| **anchor-lang** | **max stable 1.2.2**; newest tag `2.0.0-rc.4` | crates.io API, crate updated 2026-11-14 | `[OFFICIAL]` (registry) |
| **anchor-cli** | **max stable 1.2.2**; newest tag `2.0.0-rc.4` | crates.io API, crate updated 2026-11-14 | `[OFFICIAL]` (registry) |
| Anchor releases (GitHub) | `v1.2.2`, `v1.2.1`, `v0.32.3`, `v0.31.3`, `v0.30.4` | GitHub releases API | `[OFFICIAL-CODE]` |
| `@solana/web3.js` | **3.2.1** (latest) | npm registry | `[OFFICIAL]` (registry) |
| `@solana/wallet-adapter-react` | **0.15.40** (latest) | npm registry | `[OFFICIAL]` (registry) |
| `vite` | **8.4.0** (latest) | npm registry | `[OFFICIAL]` (registry) |
| `typescript` | **7.0.2** (latest) | npm registry | `[OFFICIAL]` (registry) |

### 1.1 Our repo's pins vs. current ecosystem — actionable gap

| Our pin (`package.json` / `Cargo.toml` / `Anchor.toml`) | Current latest | Assessment |
| --- | --- | --- |
| `anchor-lang = "0.31.1"`, `anchor_version = "0.31.1"` | stable **1.2.2**, rc `2.0.0-rc.4` | **Deliberately pinned old.** Anchor 0.31.1 → 1.x is a major bump with breaking changes (notably the `AccountInfo::realloc` → `AccountInfo::resize()` deprecation we actually see in the build log, and the `#[program]` macro internals). |
| `@solana/web3.js ^1.98.4` | **3.2.1** | Major gap (v1 → v3). |
| `@solana/wallet-adapter-react ^0.15.35` | 0.15.40 | Fine — caret range already resolves to 0.15.40. |
| `vite ^6.0.7` | 8.4.0 | Two majors behind. |
| `typescript ~5.7.2` | 7.0.2 | Two majors behind (and `~5.7.2` pins to 5.7.x). |
| `node: 22.x` (`.node-version`, `engines`) | — | Correct — matches our local Node 22.14.0. |

**Recommendation `[ASSUMPTION]`:** *Do not upgrade Anchor or web3.js inside the hackathon window.*
Anchor 1.x/2.0-rc migration is a multi-hour, high-risk change with no eligibility benefit — the
main track accepts *"any framework (Quasar/Anchor/Pinocchio/vanilla Rust)"* and only requires a
Devnet deployment. The pinned 0.31.1 **compiles cleanly** (verified — see §4). Stability beats
currency here. Revisit the upgrade after the deadline. Vite/TypeScript bumps are lower-risk but
still unnecessary; leave them.

---

## 2. Official documentation — URLs verified

### 2.1 Solana documentation site

`solana.com` was rate-limiting this host (HTTP 429 on every path). The URLs below are the
canonical ones and were already cited in the repo's `docs/hackathon-resources.md`; treat their
content as unconfirmed in this session.

| URL | Use | Status |
| --- | --- | --- |
| `https://solana.com/developers` | Developer portal entry point | `[OFFICIAL-URL-UNVERIFIED-429]` |
| `https://solana.com/docs` | Core docs | `[OFFICIAL-URL-UNVERIFIED-429]` |
| `https://solana.com/docs/core/accounts` | Account model, rent, ownership | `[OFFICIAL-URL-UNVERIFIED-429]` |
| `https://solana.com/docs/core/transactions` | Transaction lifecycle | `[OFFICIAL-URL-UNVERIFIED-429]` |
| `https://solana.com/docs/core/transactions/simulate` | **`simulateTransaction`** — essential for SENTINEL | `[OFFICIAL-URL-UNVERIFIED-429]` |
| `https://solana.com/docs/core/transactions/signing-in-production` | Key custody, production signing | `[OFFICIAL-URL-UNVERIFIED-429]` |
| `https://solana.com/docs/core/programs/precompiles` | Ed25519 / secp256k1 / **secp256r1** verification | `[OFFICIAL-URL-UNVERIFIED-429]` |
| `https://solana.com/docs/core/tokens` | SPL Token / Token-2022 | `[OFFICIAL-URL-UNVERIFIED-429]` |
| `https://solana.com/developers/templates` | Official starter templates | `[OFFICIAL-URL-UNVERIFIED-429]` |
| `https://solana.com/developers/guides/security-best-practices` | Security guidance | `[OFFICIAL-URL-UNVERIFIED-429]` |

### 2.2 First-party source repositories — all fetched successfully (HTTP 200)

| Repository | Role | Quality |
| --- | --- | --- |
| `https://github.com/otter-sec/anchor` | **Anchor framework.** Note: `coral-xyz/anchor` now redirects here — the project moved orgs. 5,177 stars, last updated 2026-11-26. | `[OFFICIAL-CODE]` |
| `https://github.com/otter-sec/anchor/blob/master/SECURITY.md` | Anchor's own security policy | `[OFFICIAL-CODE]` |
| `https://github.com/anza-xyz/agave` | Agave validator + RPC client (the current Solana implementation). 2,003 stars, updated 2026-11-26. | `[OFFICIAL-CODE]` |
| `https://github.com/solana-foundation/solana-web3.js` | web3.js. `solana-labs/solana-web3.js` now redirects here. | `[OFFICIAL-CODE]` |
| `https://github.com/anza-xyz/kit` | **`@solana/kit`** — the modern TS SDK | `[OFFICIAL-CODE]` |
| `https://github.com/anza-xyz/solana-sdk` | Web3.js v2 / Kit predecessor | `[OFFICIAL-CODE]` |
| `https://github.com/anza-xyz/wallet-standard` | **Wallet Standard spec** | `[OFFICIAL-CODE]` |
| `https://github.com/anza-xyz/mollusk` | **Mollusk** — in-process SVM test harness. 309 stars, updated 2026-11-18. | `[OFFICIAL-CODE]` |
| `https://github.com/solana-program/token-2022` | Token-2022 program | `[OFFICIAL-CODE]` |
| `https://www.solana-program.com/docs` | SPL Token docs (`spl.solana.com` redirects here) | `[OFFICIAL]` |
| `https://github.com/solana-foundation/solana-improvement-documents` | SIMDs — proposal process | `[OFFICIAL-CODE]` |

`[ASSUMPTION]` **`solana-labs/solana` is now `archived: true`** and `anza-xyz/solana` returns 404.
The canonical Solana implementation repo is **`anza-xyz/agave`**. Any doc or LLM knowledge that
points at `solana-labs/solana` for current work is out of date.

### 2.3 Third-party — useful, not authoritative

| Resource | Use | Quality |
| --- | --- | --- |
| `https://github.com/otter-sec/anchor` → `SECURITY.md` | Anchor security policy | `[OFFICIAL-CODE]` |
| `https://github.com/solana-labs/solana` | Archived historical reference | `[THIRD-PARTY]` / archived |
| `https://blockchaindeveloper.report/` | Listed Dev3pack supporter; ecosystem research | `[THIRD-PARTY]` |
| `https://www.firecrawl.dev/` | Listed Dev3pack sponsor; web extraction | `[THIRD-PARTY]` |

---

## 3. Technical findings that matter to our design

### 3.1 Anchor version strategy — the real constraint
Our repo pins Anchor **0.31.1**; current stable is **1.2.2** and there is a **2.0.0-rc.4**.
`cargo check` on 0.31.1 produces **20 warnings**, of which the meaningful ones are:
- `use of deprecated method anchor_lang::prelude::AccountInfo::<'a>::realloc: Use AccountInfo::resize() instead`
  — emitted from the `#[program]` macro itself, i.e. an upstream deprecation, not our bug.
- 10× `unexpected cfg condition value: anchor-debug`, 2× `solana`, 1× `custom-panic`, 1× `custom-heap`
  — `unexpected_cfgs` lint noise from Anchor's feature flags on newer Rust.

**Conclusion `[ASSUMPTION]`:** the warnings are cosmetic and upstream-driven. **Do not** treat them
as a blocker for the Devnet deployment, and do not start a 0.31.1 → 1.x migration now. Owner:
Codex to confirm nothing in the warning set indicates a real bug.

### 3.2 Passkey verification — the constraint that kills the naive design
The prior `docs/hackathon-resources.md` proposes *"Prototype passkey signature verification with
the Solana secp256r1 precompile."* Three caveats:

1. **The `secp256r1` (P-256) precompile cannot be invoked via CPI.** `[UNVERIFIED — could not
   re-fetch solana.com/docs/core/programs/precompiles due to 429]` It is a native program called by
   the runtime, not a program you can `invoke` from your own instruction. Verification therefore
   happens **client-side**, and the on-chain program can only enforce the *result* (an ordinary
   guardian/authority signature), not re-verify the passkey itself.
2. **WebAuthn signature algorithms ≠ secp256r1 by default.** Browser passkeys typically sign with
   **ES256 (P-256)** — which *does* map to secp256r1 — but **EdDSA (Ed25519)** passkeys exist too
   and would map to the Ed25519 precompile instead. Either way it is a *client-side* check.
3. **The existing guardian design already has the right shape.** `programs/rekey/src/lib.rs` uses
   ordinary Solana transaction signatures for guardian approval. Passkeys would slot in as an
   *additional* client-side authentication factor, with on-chain enforcement unchanged.

`[ASSUMPTION]` **Recommendation:** treat passkeys as a *post-hackathon* research item, not an MVP
feature. The 3-day window and the "unique Rust program deployed to devnet" gate argue strongly for
depth on the recovery program rather than breadth. **Owner: Codex to confirm the precompile CPI
constraint before anyone builds on the prior doc's claim.**

### 3.3 The security reality of "transaction security" (SENTINEL) — non-negotiable framing
This is the single most important architectural constraint in the whole project, and it must be
stated in the README and the demo.

**An external service cannot block a transaction before the user's wallet signs it.** The user's
wallet holds the key and produces the signature; a third-party web service has no mechanism to
refuse the signature. The only enforceable controls are:

1. **Program-enforced policy** — the program's own instructions reject forbidden actions. Enforceable.
2. **Smart-account / program-controlled authority** — the user delegates authority to a program
   that enforces policy on-chain. Enforceable.
3. **Wallet-level advisory** — a UI or dApp shows a warning and asks the user to confirm. **Advisory
   only.** The user can always approve anyway.

`[ASSUMPTION]` Therefore SENTINEL must be framed as:
- *enforceable* where the program holds authority (the ReKey wallet/vault path), and
- *advisory* everywhere else, clearly labelled on screen as a warning, never as a block.

The existing repo already respects this boundary (`docs/security-model.md`, README "Security
boundaries"). **Any new UI must not blur it.** Label heuristics vs. verified malicious indicators
separately, and never fabricate risk scores. **Owner: Aider + Kimi + OpenClaude.**

### 3.4 Simulation is the backbone of transaction inspection
`simulateTransaction` is the mechanism behind any meaningful "inspect this transaction" feature:
it shows logs, compute-unit consumption, account changes and errors **before** the user signs.
`[ASSUMPTION]` This is the recommended foundation for SENTINEL's advisory layer, and it is
free — no extra infra, no key custody. It also has a natural home in the existing app, which already
talks to a Devnet RPC. Owner: Aider (engine) + Junie (UI).

### 3.5 Wallet Standard over Wallet Adapter
`[OFFICIAL-CODE]` `anza-xyz/wallet-standard` is the current standard; the `wallet-adapter-*`
packages the repo uses are a compatibility layer. `[ASSUMPTION]` The repo's existing adapter usage
is fine and **should not be migrated now** — it works, Phantom and Solflare are covered, and
migration risk outweighs benefit in the window. Worth noting in the README as a known
modernisation path.

### 3.6 Testing stack options for Codex
`[OFFICIAL-CODE]` **Mollusk** (`anza-xyz/mollusk`) is an in-process SVM test harness — fast unit
tests without a validator. `[ASSUMPTION]` The repo's `Anchor.toml` still declares the legacy
`[scripts] test = "yarn ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts"` pattern, but **there
is no `tests/` directory** in the repository — the 20-file tree has no test harness at all. The
README's claim of *"earlier reported Rust tests 7/7"* is **not reproducible from the current tree**
(see §4). Establishing a real test harness (Mollusk or `anchor test` + LiteSVM) is a genuine gap.
**Owner: Codex.**

---

## 4. Verification we actually performed (reproducible)

### 4.1 The Anchor program compiles — VERIFIED

```
$ cd /Users/user/solana-recovers-agents/hermes
$ cargo check -p rekey-program
...
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 6m 00s
EXIT: 0
```
Result: **exit code 0**, 20 warnings, 0 errors. First-run compile took **6m 00s** (dependency
build). A warm rebuild is fast.

This confirms the source is syntactically and type-wise valid against `anchor-lang 0.31.1`.
**It does NOT confirm** the program builds to SBF (`anchor build`), runs, or passes behavioural
tests — no `anchor` CLI is installed on this machine, and there is no test suite.

### 4.2 Toolchain availability on this machine

| Tool | Status |
| --- | --- |
| `git` | ✅ `/usr/local/bin/git` |
| `solana` | ✅ `/Users/user/.local/share/solana/install/active_release/bin/solana` — v4.4.1 |
| `cargo` / `rustc` | ✅ `/Users/user/.cargo/bin/` — 1.100.0 |
| `node` / `npm` | ✅ `/usr/local/bin/` — v22.14.0 / 10.9.2 |
| `uv` | ✅ `/Users/user/.local/bin/uv` |
| **`anchor`** | ❌ **NOT INSTALLED** — `anchor: command not found` |
| `python3` / `pip` | ❌ not on PATH (use `uv`) |

**Implication `[ASSUMPTION]`:** `anchor build` / `anchor test` / `anchor deploy` cannot run until
someone installs Anchor CLI. `anchor build` additionally needs the Solana platform-tools
(`cargo-build-sbf`) and a Rust toolchain compatible with the pinned Anchor version. **This is on the
critical path for the Devnet deployment gate.** Owner: Codex, with Vibe for environment setup.

Note the versions interaction: Anchor CLI **1.2.2** is current, but the program pins
`anchor-lang 0.31.1`. `[ASSUMPTION]` Anchor CLI 1.x can generally build a 0.31.1 program, but this
must be *verified*, not assumed — mismatched CLI/library majors are a classic source of
`AccountInfo`/IDL incompatibilities. Owner: Codex.

### 4.3 Repository tree at baseline `415f23e`

Exactly **20 files**:
```
.github/workflows/ci.yml
.gitignore
.node-version
Anchor.toml
Cargo.toml
README.md
docs/README.md
docs/architecture.md
docs/hackathon-resources.md
docs/security-model.md
index.html
package.json
programs/rekey/Cargo.toml
programs/rekey/src/lib.rs
render.yaml
src/App.tsx
src/main.tsx
src/styles.css
tsconfig.json
vite.config.ts
```
**Notable absences `[VERIFIED]`:**
- **No `tests/` directory** — `Anchor.toml` references `tests/**/*.ts` but it does not exist.
- **No `idls/` directory** — no generated IDL is committed.
- **No `package-lock.json`** — the npm dependency tree is not pinned. `[ASSUMPTION]` This is a
  supply-chain risk *and* a reproducibility problem for judges running `npm install`. Owner: Vibe.
- **No `.env.example`** — good practice to add for the Devnet RPC endpoint. Owner: Vibe.
- **No `research/` or `skills/` directory in the repo** — the directive's expected tree does not
  exist yet. Hermes is creating `research/` on branch `agents/research`.

---

## 5. Recommendations to the team (proposals for OpenClaude to ratify)

| # | Recommendation | Rationale | Owner |
| --- | --- | --- | --- |
| T1 | **Install Anchor CLI and `cargo-build-sbf` first**; verify it can build a 0.31.1 program. | Nothing else unlocks the main-track gate. | Codex / Vibe |
| T2 | **Commit a `package-lock.json`.** | Reproducibility for judges + supply-chain hygiene. | Vibe |
| T3 | **Create a real test suite** (Mollusk for unit behaviour, `anchor test` for integration) and commit it. | Stage-2 judging includes **code inspection**; "repo quality" is a named signal. The claimed "Rust tests 7/7" is not reproducible today. | Codex |
| T4 | **Commit the generated IDL** under `idls/`. | Frontend and judges can read the program's ABI. | Codex |
| T5 | **Do not upgrade Anchor / web3.js / Vite / TypeScript before the deadline.** | The main track accepts any framework; stability beats currency. | all |
| T6 | **Frame SENTINEL as enforceable-on-program vs. advisory-in-UI, and label it that way on screen.** | Cryptographic reality; avoids overclaiming in a security product. | Aider / Kimi / Junie |
| T7 | **Use `simulateTransaction` as the transaction-inspection primitive.** | Free, no custody, no extra infra; the natural SENTINEL core. | Aider |
| T8 | **Treat passkeys as post-hackathon research** and correct the CPI claim in the docs. | secp256r1 precompile is not CPI-callable; verification is client-side. | Codex |
| T9 | **Verify the docs' solana.com URLs from a non-rate-limited host** and fold corrections into `docs/hackathon-resources.md`. | We got 429 on every request; some claims in that file may have drifted. | Hermes / Kimi |
| T10 | **Add a `.env.example` and document the Devnet RPC endpoint.** | Judges need to run it. | Vibe |

---

## 6. Complete source index

All fetched **2026-11-27**.

| # | URL | HTTP | Quality |
| --- | --- | --- | --- |
| U1 | `https://crates.io/api/v1/crates/anchor-lang` | 200 | `[OFFICIAL]` |
| U2 | `https://crates.io/api/v1/crates/anchor-cli` | 200 | `[OFFICIAL]` |
| U3 | `https://api.github.com/repos/coral-xyz/anchor/releases` | 200 | `[OFFICIAL-CODE]` |
| U4 | `https://registry.npmjs.org/@solana/web3.js/latest` | 200 | `[OFFICIAL]` |
| U5 | `https://registry.npmjs.org/@solana/wallet-adapter-react/latest` | 200 | `[OFFICIAL]` |
| U6 | `https://registry.npmjs.org/vite/latest` | 200 | `[OFFICIAL]` |
| U7 | `https://registry.npmjs.org/typescript/latest` | 200 | `[OFFICIAL]` |
| U8 | `https://github.com/otter-sec/anchor` | 200 | `[OFFICIAL-CODE]` |
| U9 | `https://github.com/otter-sec/anchor/blob/master/SECURITY.md` | 200 | `[OFFICIAL-CODE]` |
| U10 | `https://github.com/anza-xyz/agave` | 200 | `[OFFICIAL-CODE]` |
| U11 | `https://github.com/solana-foundation/solana-web3.js` | 200 | `[OFFICIAL-CODE]` |
| U12 | `https://github.com/anza-xyz/kit` | 200 | `[OFFICIAL-CODE]` |
| U13 | `https://github.com/anza-xyz/solana-sdk` | 200 | `[OFFICIAL-CODE]` |
| U14 | `https://github.com/anza-xyz/wallet-standard` | 200 | `[OFFICIAL-CODE]` |
| U15 | `https://github.com/anza-xyz/mollusk` | 200 | `[OFFICIAL-CODE]` |
| U16 | `https://github.com/solana-program/token-2022` | 200 | `[OFFICIAL-CODE]` |
| U17 | `https://www.solana-program.com/docs` | 200 | `[OFFICIAL]` |
| U18 | `https://github.com/solana-foundation/solana-improvement-documents` | 200 | `[OFFICIAL-CODE]` |
| U19 | `https://api.github.com/repos/solana-labs/solana` | 200 (archived) | `[OFFICIAL-CODE]` |
| U20 | `https://www.anchor-lang.com/docs` | 200 | `[OFFICIAL]` |
| U21 | `https://solana.com/developers` | **429** | `[OFFICIAL-URL-UNVERIFIED-429]` |
| U22 | `https://solana.com/docs` | **429** | `[OFFICIAL-URL-UNVERIFIED-429]` |
| U23 | `https://solana.com/docs/core/programs/precompiles` | **429** | `[OFFICIAL-URL-UNVERIFIED-429]` |
| U24 | `https://solana.com/docs/core/transactions/simulate` | **429** | `[OFFICIAL-URL-UNVERIFIED-429]` |
| U25 | `https://solana.com/docs/core/transactions/signing-in-production` | **429** | `[OFFICIAL-URL-UNVERIFIED-429]` |
| U26 | `https://solana.com/sitemap.xml` | **429** | `[OFFICIAL-URL-UNVERIFIED-429]` |
