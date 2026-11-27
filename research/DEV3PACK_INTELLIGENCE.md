# Dev3pack Intelligence — verified live rules for the Solana Recovers team

**Agent:** Hermes (research / hackathon intelligence)
**Compiled:** 2026-11-27 (UTC)
**Access date for every URL below:** 2026-11-27
**Source-quality convention used throughout:**

| Label | Meaning |
| --- | --- |
| `[OFFICIAL]` | Published by the Dev3pack / Solana organisation itself on a first-party domain. |
| `[OFFICIAL-CODE]` | First-party source code repository (the organisation's own GitHub org). |
| `[THIRD-PARTY]` | Not operated by the organiser; used for ecosystem context only. |
| `[ASSUMPTION]` | Our inference. Not stated by the organiser. Never present as fact. |
| `[UNVERIFIED]` | We could not confirm it from a first-party source in this session. |

> **Method note.** `app.dev3pack.xyz` redirects to `www.dev3pack.xyz`. The hackathon site at
> `hack.dev3pack.xyz` is a Next.js app that renders most rule content client-side. The complete
> FAQ (32 entries) and the complete sponsor/prize configuration were therefore read out of the
> served JavaScript chunks, not from the server-rendered HTML shell. The chunks are first-party
> build output served from the organiser's own domain, so this is a first-party source, but it is
> *compiled* content rather than the raw page text.

---

## 1. TL;DR — the six facts that decide our scope

1. **The main track requires a deployed Rust Solana program.** `[OFFICIAL]` *"Must be a unique
   Solana program written in Rust using any framework (Quasar/Anchor/Pinocchio/vanilla Rust) and
   deployed at least to devnet."* Our repo already has an Anchor program
   (`programs/rekey/src/lib.rs`) but it has **never been SBF-built or deployed**. This is the
   single biggest eligibility gap in the project.
2. **Open source is mandatory.** `[OFFICIAL]` *"Does my project have to be open source? → Yes, it
   is mandatory."*
3. **The demo video must be under 3 minutes.** `[OFFICIAL]` *"Under 3 minutes — strict. Videos
   longer than 3 minutes are disqualified from prize eligibility."*
4. **AI-generated code and tools are explicitly allowed.** `[OFFICIAL]` *"Yes — use whatever helps
   you ship faster. What matters is that the project is yours, you understand it, and you can demo
   and explain it."* This multi-agent workflow is compliant **provided we can explain and demo it**.
5. **Pre-existing code is allowed if disclosed.** `[OFFICIAL]` *"Pre-existing code from your own
   Solana projects is allowed; be transparent in the README about what was built before vs.
   during."* Our repo predates the hackathon, so we **must** add a provenance section to the README.
6. **Devnet is sufficient.** `[OFFICIAL]` *"Mainnet or devnet? → Either works — both mainnet and
   devnet smart contract/program addresses are accepted."* Nobody needs to risk real funds.

---

## 2. Event facts

| Field | Value | Source |
| --- | --- | --- |
| Name | Dev3pack Global Hackathon | `[OFFICIAL]` `hack.dev3pack.xyz` |
| Dates | **27–29 November 2026** (3 days) | `[OFFICIAL]` JSON-LD `startDate`/`endDate` + page body |
| Format | Hybrid — fully online or at a local build station | `[OFFICIAL]` `eventAttendanceMode: MixedEventAttendanceMode` |
| Cost | Free (`Offer price: 0`, `isAccessibleForFree: true`) | `[OFFICIAL]` JSON-LD |
| Audience | University / student builders. `typicalAgeRange: 18-` | `[OFFICIAL]` JSON-LD |
| Build stations | 40+ worldwide (Buenos Aires, Santa Cruz, Lima, Cuenca, Caracas, Cartago, San Juan, Tegucigalpa, São Paulo, Lagos, Enugu, Uyo, Lomé, Nairobi, Addis Ababa, Lusaka, Cairo, Kampala, Johannesburg, Shanghai, Mumbai, Bangkok, Haripur, Jakarta, Taipei, Tokyo, Paris, Çanakkale, Bursa, Belgrade, Kyiv) | `[OFFICIAL]` |
| Pre-event | Solana Rust Bootcamp, **2–27 Nov**, EN/ES/TR | `[OFFICIAL]` |
| Post-event | The Bridge accelerator, **from 7 Dec** | `[OFFICIAL]` |
| Exact UTC session times | **Only visible in the participant dashboard after acceptance** | `[OFFICIAL]` |

### Prior-edition scale (context only, not a target)
`[OFFICIAL]` May 2026 edition: 4,000+ applications, 1,700+ universities, 380+ projects, 89
countries, 40+ build stations, 1 accelerator.

---

## 3. Eligibility, teams and rules

All `[OFFICIAL]`, from `hack.dev3pack.xyz/faq`:

| Question | Answer |
| --- | --- |
| Can I hack solo? | Yes. Solo is fully allowed; same prizes and perks. |
| Max team size | **4 members.** Solo (1) is the minimum. |
| How to form a team | Create a team at `hack.dev3pack.xyz/dashboard/teams`; join by 6-character code; or browse the Participants Directory. |
| Can I switch teams? | Yes, but you must leave your current team first. |
| Must the project use Solana? | Yes for prize/accelerator eligibility. Non-Solana chains are **disqualified for prizes**. |
| Must it be open source? | **Yes, mandatory.** |
| Can I start before the hackathon? | Yes, provided the project is Solana-related. Prior code and research are encouraged. |
| AI-generated code allowed? | Yes. You must understand it and be able to demo and explain it. |
| Plagiarism / reusing code | Open-source libraries and templates are fine. Forking someone else's hackathon project and submitting it as yours is disqualified. Pre-existing code from your own Solana projects is allowed **if disclosed in the README**. |
| Behaviour | Respectful and inclusive. Harassment/discrimination/toxicity → removal from the hackathon and future Dev3pack programs. |

---

## 4. Submission requirements

`[OFFICIAL]` The submission form has **5 steps**:

1. **Project** — name, one-liner, optional category, contract address, hub, description.
2. **Images.**
3. **Links & video** — demo video, repo, live link.
4. **Team** — confirm team members.
5. **Review & submit.**

| Requirement | Detail | Source |
| --- | --- | --- |
| Deadline | **Hard deadline Sunday 29 Nov 2026.** Exact UTC hours confirmed in the dashboard. After the deadline submissions lock and judging begins. | `[OFFICIAL]` |
| Editing | Allowed right up to the cutoff; locked after. | `[OFFICIAL]` |
| Demo video | **Under 3 minutes, strict.** Longer ⇒ disqualified from prize eligibility. Must show the product working — *"a real demo, not a pitch deck."* Host on YouTube, Loom or any public link. Any language. | `[OFFICIAL]` |
| Repo | Public GitHub repo with README + setup instructions. | `[OFFICIAL]` (main track qualification) |
| Contract address | Devnet or mainnet program address must appear in the README. | `[OFFICIAL]` |
| Network | **Either mainnet or devnet is accepted.** | `[OFFICIAL]` |

---

## 5. Judging

`[OFFICIAL]` **Two stages, Product + Technical rubrics.**

- **Stage 1** — all submissions scored, filtered to the **top 100**.
- **Stage 2** — top 100 get deeper review: **code inspection**, founder–market fit, and **live demo
  verification**.

Key signals named by the organiser:

1. Eligibility compliance
2. Product clarity
3. Real-world impact
4. Demo quality
5. Deployment
6. Repo quality
7. **Solana / SDK depth**

`[ASSUMPTION]` For a security-infrastructure project, signals 1, 5, 6 and 7 are the levers we
control directly. Signal 7 ("Solana/SDK depth") is where a real on-chain program beats a web-only
app — another reason the Anchor deployment is the top priority. Signal 4 means a **real, working
demo on a real cluster** is worth more than a polished pitch.

---

## 6. Tracks and prizes (complete)

Prize configuration read from the organiser's own client bundle. Sponsor list: **Solana, LI.FI,
Virtuals, Solana Mobile, ElevenLabs.**

### 6.1 Main track — Best App Overall on Solana — $10,000 `[OFFICIAL]`

| Place | Prize |
| --- | --- |
| 1st | **$3,000** |
| 2nd | **$2,500** |
| 3rd | **$1,500** |
| Top 10 | 1 Ledger hardware wallet per team member |
| Top 30 | Share a **$2,500** pool for a free month of Claude Pro |
| Bonus | **$500** for best use of **x402 on Solana** |

> Description: *"Create an open-source project on Solana that reimagines how people interact,
> transact, or collaborate in the digital world."*

**Qualification requirements (verbatim):**
- Project name and a short description
- **Must be a unique Solana program written in Rust using any framework (Quasar/Anchor/Pinocchio/
  vanilla Rust) and deployed at least to devnet**
- Contract deployment addresses (devnet or mainnet) mentioned in the README
- Public GitHub repo (README + setup instructions)
- Demo video & live demo link (keep the video under 3 mins)

### 6.2 Partner tracks

| Sponsor | Track | Prize |
| --- | --- | --- |
| LI.FI | Best Cross-Chain Solana UX powered by LI.FI | $500 / $300 / $200 |
| Virtuals | Best AI Agent into Physical World | $500 |
| Solana Mobile | Best Mobile App Built on Solana Mobile | Seeker Phones ×$2,000 (1st/2nd/3rd) |
| ElevenLabs | Best ElevenLabs Integration | 3 months Scale tier ($1,980/member) |
| Colosseum | Colosseum Accelerator (not a judged track) | $250,000 + up to $2M seed funding, open to all participants, `arena.colosseum.org?ref=shedev` |
| Local | Regional tracks | $500 in selected countries |

**Partner-track qualification requirements:**

- **LI.FI** — must use LI.FI for a *real* quote, route, swap, bridge or agent-assisted transaction
  flow, not cosmetic. Solana must be a core part of the user journey. Accepted integration paths:
  LI.FI Widget, SDK, REST API, MCP Server / agent tooling.
- **Virtuals** — *"Demo video, live demo link with the robot."* Requires real robotics. Out of scope.
- **Solana Mobile** — Android app producing a functional APK, Solana Mobile Stack + Mobile Wallet
  Adapter, **designed for mobile from the ground up (no direct ports or PWA wrappers)**, meaningful
  network interaction, submitted to `publish.solanamobile.com`, contract addresses, public repo,
  demo video. Out of scope for our three-day window.
- **ElevenLabs** — must state which integration path is used (Generate Speech, Transcribe Speech,
  Compose Music, Sound Effects, Dub Audio, Create Voices, Deploy Agents). Requires contract
  deployment addresses in the README.

### 6.3 Builder perks (not prizes) `[OFFICIAL]`
Noah AI credits; Cursor Pro (1 year, $240) in select countries; $30 v0 credits; Top-30 Claude Pro
pool. Claimed at `hack.dev3pack.xyz/member/perks` using the hackathon-registered email.

### 6.4 Strategic read `[ASSUMPTION]`
`[ASSUMPTION]` **We should compete in the main track and ignore the partner tracks.** Rationale:
the main track carries the cash and the Ledger/Claude Pro hardware, and its only hard technical
gates (Rust program, devnet deploy, open source) are the things our repo already partially has.
Entering the Solana Mobile track would require a from-scratch Android app — not achievable in the
window. Entering the LI.FI or ElevenLabs tracks would add a vendor dependency that weakens the
security story. The x402 bonus is worth noting as an optional stretch goal.

---

## 7. The Bridge accelerator `[OFFICIAL]`

`bridge.dev3pack.xyz` — 8-week programme, **apply by 3 Dec**, 0% equity, 100% free. 4-week
Founder School (founder–market fit, GTM, startup ops, pitch/demo day) then 4-week accelerator.
Intended as the path into the next Colosseum round. Top hackathon teams are invited — no separate
prize application needed.

---

## 8. Solana Rust Bootcamp `[OFFICIAL]`

`www.dev3pack.xyz/programs/solana` — free, online, beginner, **2–27 Nov**, **12 live 1-hour
sessions Tue–Thu**, three language tracks (EN/ES/TR).

| Week | Dates | Topic |
| --- | --- | --- |
| 1 | 3–5 Nov | Rust for Solana — ownership, types, Cargo |
| 2 | 10–12 Nov | Solana deep dive — accounts, PDAs, CPI, tokens |
| 3 | 17–19 Nov | Anchor — build, test, real program |
| 4 | 24–26 Nov | Hackathon preparation — product ideation, building tips |

Outcome: set up a Solana/Rust environment, read accounts/transactions/the programming model, write
a first on-chain program, **test and deploy to localnet or devnet**, show up ready to build.

**Certification:** Solana Rust certification for participants with ≥40% homework completed **and a
Solana program deployed**. No capstone. Instructors listed: Deepesh, Fabian Sanchez, Santiago
Villarreal.

`[ASSUMPTION]` Week 3 (Anchor) and Week 4 (hackathon prep) are the two sessions most directly
relevant to our build plan. The certification's "program deployed" requirement mirrors the main
track's devnet requirement — worth mentioning in the submission.

---

## 9. How to get started — organiser-recommended tooling `[OFFICIAL]`

The FAQ's own answer: explore ideas at `ideas.sendai.fun`, `superteam.fun/build/ideas`,
`superteam.fun/build/past-hackathon-winners` or **Colosseum Copilot**; write a clear prompt
(user, problem, core flow, Solana/partner integrations); paste into `trynoah.ai` (Noah AI) to
generate a full-stack Solana app.

Mentor fallback: **SoleneGPT** at `solenegpt.bonfires.ai`.

`[ASSUMPTION]` Noah AI is a code *generator*; our project already exists and has a real Anchor
program, so generating a fresh app would be strictly worse and would collide with the
"pre-existing code" disclosure requirement. We use these as research/idea sources only.

---

## 10. What we could NOT verify

Stated plainly so nobody builds on an assumption:

- `[UNVERIFIED]` **Exact UTC submission hour.** The organiser publishes only "Sunday 29 Nov 2026";
  the precise cutoff lives in the authenticated dashboard calendar. Requires an accepted account.
- `[UNVERIFIED]` **Full rubric criteria and weights.** Only the signal names and the two-stage
  structure are published. The rubric document itself is behind sign-in.
- `[UNVERIFIED]` **The participant resource catalogue.** `app.dev3pack.xyz` redirects to the public
  marketing site; the authenticated resource area requires sign-in.
- `[UNVERIFIED]` **Whether a partner-track entry can be added after submission**, and the
  eligibility/verification mechanics for partner tracks (judges "check qualification
  requirements", but the process is not documented).
- `[UNVERIFIED]` **The `$500` local-track list.** Country selection is client-side and gated by the
  participant's country; we did not enumerate every country's track.
- `[UNVERIFIED]` **Concrete submission-form field validation rules** (length caps, image
  dimensions, video hosting allow-list beyond "YouTube, Loom, or any public link").
- `[UNVERIFIED]` **Whether the existing public program ID `284Xsc92KLKwKb7gBYAB8CXWc979FHL11tc185UYqcbP`
  has ever been deployed anywhere.** The repo declares it as a placeholder. Treat it as unusable
  until we generate and sync our own keypair.
- `[UNVERIFIED]` **solana.com documentation URLs could not be fetched in this session** — the host
  returned HTTP 429 (rate limit) for every request, not 404. The URLs themselves are almost
  certainly correct, but we could not re-read their content. See `SOLANA_TECHNICAL_RESOURCES.md`
  for the first-party GitHub sources we did verify.

---

## 11. Recommended scope consequences (proposals, not decisions)

`[ASSUMPTION]` These are proposals for OpenClaude to ratify, not unilateral architecture decisions.

| # | Proposal | Driver |
| --- | --- | --- |
| P1 | **Get `programs/rekey` SBF-built and deployed to Devnet.** Everything else is secondary. | Main-track qualification is literally *"deployed at least to devnet"* |
| P2 | **Keep the Anchor recovery program as the centrepiece**; layer SENTINEL transaction-security features on top as program instructions (or a second program) rather than replacing it. | Preserves existing work *and* satisfies "unique Solana program" |
| P3 | **Add a provenance section to the README** stating what existed before 27 Nov 2026 and what was built during the hackathon. | Plagiarism FAQ explicitly requires this disclosure |
| P4 | **Put the devnet program ID + exact setup commands in the README** as the first technical section. | Submission requirement + judging signal "repo quality" |
| P5 | **Script a ≤3-minute demo**: connect wallet → show a simulated/advisory transaction risk finding → execute an on-chain guardian-approved recovery → show the on-chain account. | Hard disqualification at >3 min; "real demo, not a pitch deck" |
| P6 | **Ship a real live link** (the repo already has `render.yaml`) so Stage-2 live demo verification works. | Judging signal "deployment"; Stage 2 verifies live demos |
| P7 | **Write the security model honestly** — label heuristics vs verified indicators; never claim an external service can block a wallet transaction pre-signature. | Judging signal "product clarity" + our own engineering-quality bar |
| P8 | **Do not chase the x402 $500 bonus** unless the core is done and tested. | Bonus is discretionary; core gates are not |


---

## 12. Source index

All accessed **2026-11-27**.

| # | URL | What was read | Quality |
| --- | --- | --- | --- |
| S1 | `https://hack.dev3pack.xyz/` | Page body + JSON-LD `Event` and `FAQPage` | `[OFFICIAL]` |
| S2 | `https://hack.dev3pack.xyz/faq` | Page shell; full answer set came from S3 | `[OFFICIAL]` |
| S3 | `https://hack.dev3pack.xyz/_next/static/chunks/0thwfx_~hqd~4.js` | The complete 32-entry FAQ dataset across 9 categories | `[OFFICIAL]` (first-party build output) |
| S4 | `https://hack.dev3pack.xyz/_next/static/chunks/0r.x1-.ctxvg-.js` | Homepage FAQ block (6 Q/A) — used to cross-check S3 | `[OFFICIAL]` |
| S5 | `https://hack.dev3pack.xyz/_next/static/chunks/0uji41ge505lc.js` | Full sponsor list, all tracks, places, prize amounts, qualification requirements, local-track and Colosseum config | `[OFFICIAL]` (first-party build output) |
| S6 | `https://hack.dev3pack.xyz/prizes` | Page shell; content confirmed against S5 | `[OFFICIAL]` |
| S7 | `https://www.dev3pack.xyz/programs/solana` | Rust Bootcamp curriculum, schedule, FAQ, certification | `[OFFICIAL]` |
| S8 | `https://bridge.dev3pack.xyz/` | The Bridge programme, benefits, 8-week structure, deadline | `[OFFICIAL]` |
| S9 | `https://www.dev3pack.xyz/` | Public marketing site (app.dev3pack.xyz redirects here) | `[OFFICIAL]` |
| S10 | `https://api.github.com/repos/coral-xyz/anchor/releases` | Anchor release tags (redirects to `otter-sec/anchor`) | `[OFFICIAL-CODE]` |
| S11 | `https://crates.io/api/v1/crates/anchor-lang`, `.../anchor-cli` | Current published versions | `[OFFICIAL]` (crates.io registry) |

Cross-reference for our own repo's prior review: `docs/hackathon-resources.md` (reviewed 26 Nov 2026
by a previous pass) — see `HACKATHON_REQUIREMENTS.md` §"Gap analysis" for what it got right and
what it missed.

---

## 13. Prior-art check — three existing projects, and what it means for our positioning

The Dev3pack FAQ recommends **Colosseum Copilot** for idea discovery and prior art. That tool
requires interactive browser/device sign-in (`npx @colosseum-org/copilot-connect login --device`),
which an autonomous agent cannot complete, so I used the unauthenticated public GitHub search API
instead. **This is a narrower sweep than Colosseum's 5,400+ project index** — see the caveat.

All three matches are **web-only TypeScript projects with zero on-chain programs**:

| Repo | Description | Created / last push | Stars | Rust/Anchor files |
| --- | --- | --- | --- | --- |
| `AshishChikane/sol-security-transaction` | "SignSafeli: pre-sign AI firewall for Solana. Simulates, risk-scores and explains every transaction before you sign." | 2026-04-15 / 2026-04-17 | 0 | **NONE** |
| `Sugusdaddy/solana-tx-simulator` | "Transaction simulation engine that predicts state changes, token transfers, and potential risks before signing — Similar to Blowfish/Phantom security features" (MIT) | 2026-03-10 / 2026-03-10 | 0 | **NONE** |
| `mbbairagii/solana-xray` | "Solana (TX) X-Ray is a transaction simulator and risk explainer that decodes any Solana transaction into plain language before you sign it." | 2026-02-23 / 2026-03-31 | 0 | **NONE** |

Verified by listing every file in each repo tree via the GitHub API: **no `.rs`, no `Anchor.toml`,
no `Cargo.toml` in any of them.**

### What this changes

1. **The concept is not novel.** "Inspect a transaction before the user signs" exists in three
   open-source projects *and* in production inside Phantom and Blowfish. A judge will know this.
   Claiming novelty here is a credibility risk, not a strategy.
2. **But all three are ineligible for the main track**, because the main track requires a deployed
   Rust Solana program. We would be doing the part they skipped.
3. **The defensible claim is the combination:** an on-chain program that makes recovery and policy
   **enforceable**, plus a clearly-distinguished **advisory** inspection layer. The on-chain side is
   the differentiator, not the inspection side.

### Positioning rules this implies

| Do | Do not |
| --- | --- |
| Lead with **enforceability** — program-controlled authority, guardian threshold, timelock | Lead with "AI firewall" or "risk-scores" — already taken |
| Say plainly that a third-party service **cannot** block a transaction before the wallet signs | Imply we detect malice better than Phantom/Blowfish |
| Distinguish enforceable (program) vs advisory (UI/service) **on screen and in the README** | Use "block"/"prevent" for anything advisory |
| Position on recovery, program integrity and smart-account authorization | Fabricate threat-intelligence claims or risk scores |

*Caveat:* GitHub search is not the Colosseum index. If anyone can complete the Colosseum Copilot
device login, a proper duplicate check should still be run before the product name and positioning
are finalised. **Owner: OpenClaude + whoever can complete the sign-in.**
