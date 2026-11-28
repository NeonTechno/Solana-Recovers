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

### 2.1 Solana documentation — VERIFIED via the official docs source

`solana.com` returns **HTTP 429** to this host. The solution was to read the documentation
**source repository**, which is the same content that renders at `solana.com/docs`:
**`solana-foundation/solana-com`**, specifically `apps/docs/content/docs/en/**/*.mdx`
(523 English `.mdx` files).

| Correct doc path | Live URL | Local source file | Verified |
| --- | --- | --- | --- |
| Precompiles | `https://solana.com/docs/core/programs/precompiles` | `core/programs/precompiles.mdx` | ✅ fetched, HTTP 200, 10,326 B |
| **`simulateTransaction`** | `https://solana.com/docs/rpc/http/simulatetransaction` | `rpc/http/simulatetransaction.mdx` | ✅ fetched, HTTP 200, 36,275 B |
| Signing in production | `https://solana.com/docs/core/transactions/signing-in-production` | `core/transactions/signing-in-production.mdx` | ✅ fetched, HTTP 200, 4,091 B |
| Rent | `https://solana.com/docs/core/rent` | `core/rent.mdx` | ✅ fetched, HTTP 200, 5,082 B |
| Security tools | `https://solana.com/docs/tools/security` | `tools/security.mdx` | ✅ fetched, HTTP 200, 7,608 B |
| Accounts (runtime/structure/types) | `https://solana.com/docs/core/accounts` | `core/accounts/*.mdx` | ✅ path confirmed in the repo tree |
| Templates | `https://solana.com/templates` | `apps/templates/` | ✅ confirmed as a separate app in the repo |

> **URL CORRECTION — this is a real error in `docs/hackathon-resources.md`.** That file cites
> `https://solana.com/docs/core/transactions/simulate`. **The actual path is
> `/docs/rpc/http/simulatetransaction`.** There is no `/core/transactions/simulate` route — the
> path `core/transactions/` covers transaction *structure and lifecycle*, while RPC methods live
> under `/rpc/http/<methodname>`. **Aider/Junie: use the corrected path.** The same correction
> applies to any other RPC method we cite.

> **The `docs.solana.com` domain is NOT the docs.** `https://docs.solana.com/` returns HTTP 200 but
> is a stub page whose only action is a link back to `https://solana.com/docs` (which 429s us).
> Its own sub-paths (`/core/accounts`, `/core/transactions`, …) all return **404**. Do not use it
> as a documentation source.

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

### 3.2 Passkey verification — OFFICIALLY VERIFIED, and it constrains the design

The prior `docs/hackathon-resources.md` proposes *"Prototype passkey signature verification with
the Solana secp256r1 precompile."* I have now read the **official source** of that page
(`solana-foundation/solana-com` → `apps/docs/content/docs/en/core/programs/precompiles.mdx`).
Verbatim from the official doc:

> *"Precompiles (Ed25519, Secp256k1, Secp256r1) verify signatures as native code, bypassing the
> sBPF VM. They handle cryptographic operations where sBPF execution would be too slow.
> **Precompiles are not callable via CPI.**"*

So the prior doc's claim is **correct**, and the repo's own `docs/security-model.md` already states
it correctly too. The full constraint set:

| Fact | Source | Consequence for passkeys |
| --- | --- | --- |
| Precompiles are **not callable via CPI** | official precompiles doc, Summary block | A program **cannot** ask the runtime to verify a passkey signature. Verification is **client-side**; on-chain enforcement can only check the *result* (an ordinary guardian/authority signature). |
| `Secp256r1SigVerify1111111111111111111111111` verifies **up to 8** signatures per instruction | official doc | Batch size limit if used. |
| Public key must be a **33-byte compressed** key | official `Secp256r1SignatureOffsets` | WebAuthn ES256 public keys are already 33-byte compressed P-256 — **compatible**. |
| Signature must be a **64-byte compact** signature | official doc | WebAuthn ES256 signatures are DER-encoded (~70-72 bytes), **NOT** raw 64-byte `r||s`. A **conversion step is required**, and it must be done correctly. |
| **Low-S values are enforced** for all signatures | official doc | The DER→compact conversion **must also normalise to low-S**, or verification fails. A classic source of subtle bugs. |
| The precompile bypasses the sBPF VM | official doc | Cheaper/faster than doing it in-program — but unreachable via CPI from our program. |

`[ASSUMPTION]` **WebAuthn algorithm mapping.** Browser passkeys sign with **ES256 (ECDSA P-256 /
SHA-256)** by default — which maps cleanly to secp256r1 — but **EdDSA (Ed25519)** passkeys also
exist and would map to the Ed25519 precompile instead. Either way the check is client-side.

`[ASSUMPTION]` **Recommendation:** treat passkeys as a **post-hackathon** research item, not an MVP
feature. Reasons: the 3-day window; the "unique Rust program deployed to devnet" gate; the DER→raw
conversion + low-S normalisation complexity; and the fact that **the existing guardian design
already has the right shape** — `programs/rekey/src/lib.rs` uses ordinary Solana transaction
signatures for guardian approval, which is exactly how a client-verified passkey would be enforced
on-chain (passkey verifies the human; the guardian's Solana signature is the authority). The
repo's `docs/security-model.md` already reaches this conclusion correctly. **Owner: Codex —
no longer needs to "confirm the constraint"; it is confirmed. The open question is only whether
to schedule it.**

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

### 3.4 Simulation is the backbone of transaction inspection — OFFICIALLY VERIFIED

I read the official `simulateTransaction` doc source
(`rpc/http/simulatetransaction.mdx`, 36 KB). It is the mechanism behind any meaningful "inspect this
transaction" feature, and it is **free** — no extra infra, no key custody.

**Request parameters** (official): `encoding`, `commitment`, `replaceRecentBlockhash`,
`sigVerify`, `minContextSlot`, `innerInstructions`, `accounts`.

**Result fields** (official, from `result.value`):

| Field | Type | Why it matters for transaction inspection |
| --- | --- | --- |
| `err` | object/string/null | **Would the transaction fail?** The single most important signal. |
| `logs` | array/null | Program logs — reveals what the program actually does. |
| `accounts` | array/null | **Post-simulation account state** — shows balances/owners after execution. Requires `accounts.addresses` in the request. |
| `unitsConsumed` | u64/null | Compute cost — an outlier is a heuristic signal. |
| `innerInstructions` | array/null | **CPIs actually invoked** — reveals hidden downstream calls. Requires `innerInstructions: true`. |
| `returnData` | object/null | Return data from the last instruction. |
| `loadedAccountsDataSize` | u32/null | How much account data was touched. |
| `replacementBlockhash` | object/null | The blockhash used when `replaceRecentBlockhash` is enabled. |
| `fee` | u64/null | Fee the transaction would pay. |
| `context.slot` / `context.apiVersion` | u64/string | Slot and node version — useful for provenance. |

`[ASSUMPTION]` **This is the concrete API surface for SENTINEL's advisory layer**, and it maps
directly onto the risks worth inspecting:

| Signal | Field | Heuristic strength |
| --- | --- | --- |
| Transaction would fail | `err` | **Deterministic**, not a heuristic. |
| Program emitted unexpected logs | `logs` | Strong heuristic — e.g. a program that logs "admin" or "upgrade" unexpectedly. |
| Balance moved to an unknown account | `accounts` | Strong heuristic — compare account addresses against a known-safe set. |
| Unexpected CPI chain | `innerInstructions` | Strong heuristic — a dApp calling program X which CPIs to program Y is a real signal. |
| Compute unit outlier | `unitsConsumed` | Weak heuristic — only meaningful against a baseline for that program. |
| Fee anomaly | `fee` | Weak heuristic. |

`[ASSUMPTION]` **Critical correctness note for Aider/Kimi:** `simulateTransaction` reflects the
**current on-chain state** at a given slot. A transaction that simulates cleanly may still behave
differently later (account state changes, oracle price moves, other people's transactions landing
first). Therefore **a successful simulation is NOT a security guarantee** — it must be presented as
"no error detected in simulation at slot N", never as "this transaction is safe". The official
result object includes `context.slot` precisely so the caller can record which state was evaluated.

`[ASSUMPTION]` **`sigVerify: false`** is the default in the official Kit example. For a security
product, **`sigVerify: true` matters**: it makes the node verify signatures during simulation,
which catches a genuinely invalid signature instead of just simulating the instruction logic. Aider
should set this explicitly and record it.

Owner: **Aider** (engine) + **Junie** (UI) + **Kimi** (heuristic quality).

### 3.5 Wallet Standard over Wallet Adapter
`[OFFICIAL-CODE]` `anza-xyz/wallet-standard` is the current standard; the `wallet-adapter-*`
packages the repo uses are a compatibility layer. `[ASSUMPTION]` The repo's existing adapter usage
is fine and **should not be migrated now** — it works, Phantom and Solflare are covered, and
migration risk outweighs benefit in the window. Worth noting in the README as a known
modernisation path.

### 3.6 Testing stack options for Codex
`[OFFICIAL-CODE]` **Mollusk** (`anza-xyz/mollusk`) is an in-process SVM test harness — fast unit
tests without a validator. **CORRECTED (verified):** the repo's `Anchor.toml` declares the legacy
`[scripts] test = "yarn ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts"` pattern, but there is
no `tests/` directory — **the tests are inline** in `programs/rekey/src/lib.rs` in a
`#[cfg(test)] mod tests` block starting at line 620. There are **7 unit tests**, and they **pass**
(verified in §4). They cover `validate_policy` only: 2-of-3 acceptance, empty set, duplicate
guardians, owner-as-guardian, threshold > guardian count, and timelock bounds. There are **no**
integration or state-machine tests — exactly as `docs/security-model.md` states. Establishing
local-validator integration tests is a genuine gap. **Owner: Codex.**

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
- **No `tests/` directory** — `Anchor.toml` references `tests/**/*.ts` but the tests are **inline**
  in `programs/rekey/src/lib.rs` (`#[cfg(test)] mod tests`, line 620). 7 tests, all passing.
  The real gap is the **absence of integration/state-machine tests**, not the absence of tests.
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

## 5. Full verification log — commands actually run (2026-11-27)

Every result below is real output from this session, in `/Users/user/solana-recovers-agents/hermes`
(branch `agents/research`, baseline `415f23e`).

### 5.1 Rust program — compiles and tests pass

```
$ cargo check -p rekey-program
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 6m 00s
EXIT: 0
```
20 warnings, 0 errors. Warning breakdown: 10× `unexpected cfg condition value: anchor-debug`,
2× `solana`, 1× `custom-panic`, 1× `custom-heap`, 1× deprecated
`AccountInfo::<'a>::realloc` (emitted by the `#[program]` macro itself — upstream, not our code).

```
$ cargo test -p rekey-program
    Finished `test` profile [unoptimized + debuginfo] target(s) in 6m 50s
     Running unittests src/lib.rs (.../rekey_program-4bd333d3283da259)

running 7 tests
test test_id ... ok
test tests::accepts_two_of_three_guardian_policy ... ok
test tests::rejects_duplicate_guardians ... ok
test tests::rejects_empty_guardian_set ... ok
test tests::rejects_threshold_above_guardian_count ... ok
test tests::rejects_owner_as_guardian ... ok
test tests::rejects_timelock_outside_policy_bounds ... ok

test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
   Doc-tests rekey_program: 0 passed (none)
EXIT: 0
```
**The README's "Rust tests 7/7" claim is verified reproducible.** The tests are **inline** in
`programs/rekey/src/lib.rs` (`#[cfg(test)] mod tests`, line 620) — not in a `tests/` directory.

### 5.2 Frontend — builds clean

```
$ npm install
  40 packages are looking for funding
  15 moderate severity vulnerabilities

$ npm run build
> tsc -b && vite build
vite v6.4.6 building for production...
✓ 1946 modules transformed.
dist/index.html                            0.91 kB │ gzip:  0.43 kB
dist/assets/solana-wallets-DuSOMcHt.css    4.86 kB │ gzip:  1.36 kB
dist/assets/index-DSvuSqDC.css             17.96 kB │ gzip:  4.84 kB
dist/assets/index-DvAWv6fC.js              29.78 kB │ gzip:  7.64 kB
dist/assets/react-vendor-CMUqKMyQ.js      143.47 kB │ gzip: 45.95 kB
dist/assets/solana-wallets-RXG_GF9p.js    210.93 kB │ gzip: 65.61 kB
dist/assets/solana-web3-D6L5WlAS.js       273.93 kB │ gzip: 81.73 kB
✓ built in 25.35s
EXIT: 0
```

### 5.3 Dependency audit — CI gate passes, root cause identified

```
$ npm audit --audit-level=high        # the exact CI gate
EXIT: 0                             # PASSES
```
Full audit: **15 moderate, 0 high, 0 critical**, 615 dependencies (348 prod / 71 dev / 61 optional / 190 peer).

**All 15 trace to one root cause.** The chain is:

```
@solana/web3.js@1.99.0
  └─ jayson@4.3.0
       ├─ stream-json@1.9.1   -> 3 advisories
       └─ uuid@8.3.2
@solflare-wallet/sdk@1.4.2
  └─ uuid@9.0.1
```

| Advisory | Package | Range | CVSS | ID |
| --- | --- | --- | --- | --- |
| `pick/ignore/filter/replace` filters are O(depth²) on nested input — small crafted JSON blocks the event loop (DoS) | `stream-json` | ≤ 3.4.0 | 6.2 | GHSA-528h-pc64-c93x |
| JSONC parser and verifier re-scan the whole accumulated comment on every input chunk | `stream-json` | ≤ 3.5.0 | 6.2 | GHSA-hqr4-qq8f-hg3x |
| Prototype pollution — Assembler writes `this.current[this.key]` on plain objects | `stream-json` | < 3.6.0 | 5.1 | GHSA-mjw6-4jj6-33hc |
| Missing buffer bounds check in v3/v5/v6 when `buf` is provided | `uuid` | < 11.1.1 | 7.5 | GHSA-w5hq-g745-h8pq |

`npm audit` reports `fixAvailable: false` for the chain. The only offered fixes are
**semver-major downgrades** (`@solana/wallet-adapter-solflare` → 0.6.3), which would be worse.

`[ASSUMPTION]` **Risk assessment:** `jayson`/`stream-json`/`uuid` are **node-side** dependencies of
the web3.js RPC client. A browser dApp ships `web3.js` to the browser, but the vulnerable parsing
path is server-side. Exploitability from a static browser bundle is therefore low. This is still
**not a security audit** — Kimi/Aider should confirm. `docs/security-model.md` already documents
this correctly. **Do not force-upgrade web3.js v1→v3 mid-hackathon**: that is a breaking change with
no eligibility benefit.

### 5.4 CI formatting step is a no-op gate — NEW FINDING

`.github/workflows/ci.yml` runs:
```yaml
- name: Format Rust sources
  run: cargo fmt --all
```
`cargo fmt --all` **rewrites** files. It never exits non-zero on drift, so **CI cannot catch
formatting regressions**. Verified:

```
$ cargo fmt --all -- --check
Diff in programs/rekey/src/lib.rs:17:
-        validate_policy(&guardians, threshold, delay_seconds, ctx.accounts.owner.key())?;
+        validate_policy(
+            &guardians,
+            threshold,
+            delay_seconds,
+            ctx.accounts.owner.key(),
+        )?;
... (further diffs at :47 and :86)

$ cargo fmt --all && git diff --stat
 programs/rekey/src/lib.rs | 26 ++++++++++++++++++--------
 1 file changed, 18 insertions(+), 8 deletions(-)
```

The committed source is **not rustfmt-clean**. (My working tree was reverted immediately after
measuring this; `lib.rs` is byte-identical to the commit.)

**Recommendation:** change the CI step to `cargo fmt --all -- --check` and commit the
rustfmt-clean file. Low risk, real quality gain, and *"repo quality"* is an explicit Stage-2
judging signal. **Owner: Codex (program) + Vibe (CI).**

### 5.5 Prior-art check

Public GitHub search API, 2026-11-27. Colosseum Copilot — the tool the Dev3pack FAQ recommends —
requires interactive browser/device sign-in (`npx @colosseum-org/copilot-connect login --device`),
which an autonomous agent cannot complete, so the public API was used instead. **This is a weaker
sweep than Colosseum's 5,400+ project index.**

| Repo | Description | Created / Last push | Lang | Stars | Rust/Anchor files |
| --- | --- | --- | --- | --- | --- |
| `AshishChikane/sol-security-transaction` | "SignSafeli: pre-sign AI firewall for Solana. Simulates, risk-scores and explains every transaction before you sign." | 2026-04-15 / 2026-04-17 | TypeScript | 0 | **NONE** |
| `Sugusdaddy/solana-tx-simulator` | "Transaction simulation engine that predicts state changes, token transfers, and potential risks before signing — Similar to Blowfish/Phantom security features" | 2026-03-10 / 2026-03-10 | TypeScript (MIT) | 0 | **NONE** |
| `mbbairagii/solana-xray` | "Solana (TX) X-Ray is a transaction simulator and risk explainer that decodes any Solana transaction into plain language before you sign it." | 2026-02-23 / 2026-03-31 | TypeScript | 0 | **NONE** |

**The decisive differentiator: all three are web-only TypeScript projects with zero on-chain
programs.** I listed every file in each repo tree via the GitHub API; none contains a `.rs`,
`Anchor.toml` or `Cargo.toml`.

`[ASSUMPTION]` **Positioning consequence:** the concept "inspect a transaction before signing" is
**not** novel — three projects already do it, and the major wallets (Phantom, Blowfish) ship
production versions of it. Our defensible claim is the **combination**: an on-chain Rust/Anchor
program that makes recovery and policy **enforceable** (not merely advisory), with the
transaction-inspection layer clearly distinguished from it. All three prior-art projects would be
**ineligible for the Dev3pack main track** because they have no deployed Solana program. Avoid the
phrases "AI firewall" and "risk-scores" — they are already taken.

### 5.6 Environment gap affecting skills

The `firecrawl-search` / `firecrawl-scrape` skills could not be used: the local Firecrawl service
refused connections on `localhost:3002`. All Dev3pack pages were instead fetched with `curl` and
converted with a purpose-built dependency-free HTML→text extractor.

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
| U23 | `https://solana.com/sitemap.xml` | **429** | `[OFFICIAL-URL-UNVERIFIED-429]` |
| U27 | `https://api.github.com/repos/solana-foundation/solana-com/contents/apps/docs` | 200 | `[OFFICIAL-CODE]` — **the solana.com/docs source repo** |
| U28 | `.../solana-com/git/trees/HEAD?recursive=1` | 200 (13,105 paths) | `[OFFICIAL-CODE]` |
| U29 | `raw.../apps/docs/content/docs/en/core/programs/precompiles.mdx` | 200 | `[OFFICIAL]` — **precompiles content** |
| U30 | `raw.../apps/docs/content/docs/en/rpc/http/simulatetransaction.mdx` | 200 | `[OFFICIAL]` — **simulateTransaction content** |
| U31 | `raw.../apps/docs/content/docs/en/core/transactions/signing-in-production.mdx` | 200 | `[OFFICIAL]` |
| U32 | `raw.../apps/docs/content/docs/en/core/rent.mdx` | 200 | `[OFFICIAL]` |
| U33 | `raw.../apps/docs/content/docs/en/tools/security.mdx` | 200 | `[OFFICIAL]` |
| U34 | `https://docs.solana.com/` | 200 (stub) / 404 on all sub-paths | `[OFFICIAL]` — **not the docs; a redirect stub** |
