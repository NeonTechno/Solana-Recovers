# DevOps Environment Requirements — ReKey (Solana Recovers)

**Agent:** Vibe (Integration/DevOps)  
**Date:** 2026-11-27  
**Status:** Draft — based on Hermes' research findings  
**Scope:** Devnet deployment eligibility requirements

---

## 🎯 Overview

This document specifies the **verified** environment requirements for building, testing, and deploying the ReKey Solana program. All findings are based on Hermes' live verification (2026-11-27).

**Current Eligibility Status:** ❌ **BLOCKED** — Program compiles but not SBF-built or deployed to Devnet.

---

## ✅ Verified Toolchain

### 1. Rust Toolchain
| Component | Version | Source | Status |
|---|---|---|---|
| Rust | 1.95.0 | Solana CLI bundle | ✅ Installed |
| Cargo | 1.95.0 | Rust toolchain | ✅ Installed |
| rustfmt | Bundled | dtolnay/rust-toolchain | ✅ Available |

**Verification:**
```bash
rustc --version   # 1.95.0
cargo --version   # 1.95.0
cargo fmt --version
```

### 2. Solana Toolchain
| Component | Version | Source | Status |
|---|---|---|---|
| Solana CLI | 4.4.1 | solana-cli | ✅ Installed |
| cargo-build-sbf | 4.5.0 | Solana CLI bundle | ✅ Installed |
| cargo-test-sbf | Present | Solana CLI bundle | ✅ Installed |

**Verification:**
```bash
solana --version          # 4.4.1
cargo-build-sbf --version # 4.5.0
which cargo-build-sbf      # ~/.local/share/solana/install/active_release/bin/cargo-build-sbf
```

### 3. Anchor Toolchain
| Component | Version | Source | Status |
|---|---|---|---|
| anchor-cli | 0.31.1 | Prebuilt binary | ✅ Available |
| anchor-lang | 0.31.1 | Cargo.toml | ✅ Pinned |

**CRITICAL:** anchor-cli 0.31.1 matches anchor-lang 0.31.1 exactly. **DO NOT use 1.2.2** (version mismatch risk).

**Installation:**
```bash
# Prebuilt binary (macOS x86_64)
curl -L -o /usr/local/bin/anchor \
  https://github.com/otter-sec/anchor/releases/download/v0.31.1/anchor-0.31.1-x86_64-apple-darwin
chmod +x /usr/local/bin/anchor

anchor --version  # anchor-cli 0.31.1
```

**Note:** Anchor org moved from coral-xyz/anchor to otter-sec/anchor. Prebuilt binaries still available under new org.

### 4. Node.js Toolchain
| Component | Version | Source | Status |
|---|---|---|---|
| Node.js | 22.x | npm | ✅ Installed (22.14.0) |
| npm | 10.x | Node.js bundle | ✅ Installed |

**Verification:**
```bash
node --version  # v22.14.0
npm --version   # 10.x
```

### 5. Frontend Toolchain
| Component | Version | Source | Status |
|---|---|---|---|
| Vite | ^6.0.7 | package.json | ✅ Resolves to 6.4.6 |
| TypeScript | ~5.7.2 | package.json | ✅ Installed |
| React | 18.3.1 | package.json | ✅ Installed |

**Verification:**
```bash
vite --version  # 6.4.6
```

---

## 📋 Build Verification Checklist

### Rust / Anchor Program
```bash
# From any worktree
cd /Users/user/solana-recovers-agents/<agent>

# Check compilation (Hermes verified: EXIT 0, 20 warnings, 0 errors)
cargo check -p rekey-program

# Run unit tests (Hermes verified: 7 passed, 0 failed)
cargo test -p rekey-program

# Format check (Vibe updated: will FAIL until lib.rs is formatted)
cargo fmt --all -- --check

# Format and fix (Codex needs to run this)
cargo fmt --all
```

### Frontend
```bash
# Install dependencies
npm install

# Build (Hermes verified: EXIT 0, vite 6.4.6, 25.35s)
npm run build

# Dependency audit (Hermes verified: 15 moderate, 0 high, 0 critical)
npm audit --audit-level=high
```

---

## 🚀 Devnet Deployment Steps

**Status:** ⏳ **BLOCKED** — Waiting for Hermes' SBF build result + human authorization

### Prerequisites
- ✅ Rust toolchain installed
- ✅ Solana CLI installed
- ✅ cargo-build-sbf installed
- ✅ anchor-cli 0.31.1 installed
- ⏳ anchor-cli verified to work with anchor-lang 0.31.1
- ⏳ Human owner authorization
- ⏳ Funded Devnet wallet

### Deployment Process
```bash
# 1. Navigate to worktree
cd /Users/user/solana-recovers-agents/codex  # or any worktree

# 2. Set PATH to include Solana tools
export PATH="/Users/user/.local/share/solana/install/active_release/bin:$PATH"

# 3. Use anchor-cli 0.31.1
/tmp/dev3pack/anchor-0.31.1-x86_64-apple-darwin build

# 4. Generate deployment keypair (NEVER COMMIT)
anchor keys sync

# 5. Deploy to Devnet
anchor deploy --url devnet

# 6. Verify deployment
solana program show --url devnet <PROGRAM_ID>

# 7. Record program ID
# Add to: README.md, Anchor.toml, programs/rekey/src/lib.rs
```

### Expected Output
- `target/deploy/rekey_program.so` (SBF binary)
- Devnet program ID (e.g., `XXxx...`) 
- Updated Anchor.toml with program ID
- Updated `programs/rekey/src/lib.rs` with `declare_id!`

---

## ⚠️ Known Issues & Fixes

### 1. .gitignore Missing Entries
**Issue:** Build artifacts accumulate as untracked noise  
**Fix:** Vibe committed fix (8ea4594) adding:
- `target/`
- `Cargo.lock`
- `*.tsbuildinfo`

**Action:** All agents should pull this change or apply manually.

### 2. CI Formatting Gate No-Op
**Issue:** `cargo fmt --all` rewrites files but never fails  
**Fix:** Vibe committed fix (5b92348) changing to:
```yaml
- name: Check Rust source formatting
  run: cargo fmt --all -- --check
```

**Action:** CI will now fail on formatting drift. Codex needs to run `cargo fmt --all` and commit formatted lib.rs (26 lines of drift currently).

### 3. package-lock.json Not Committed
**Issue:** npm tree is unpinned, reproducibility problem for judges  
**Fix:** Junie needs to commit package-lock.json

**Impact:** Judges running `npm install` may get different dependency versions.

### 4. No Integration Tests
**Issue:** Only 7 unit tests (validate_policy), no state-machine tests  
**Fix:** Codex needs to add integration tests for:
- Pending → Approved
- Approved → Executed
- Pending → Cancelled
- Pending → Expired

**Reference:** docs/security-model.md already lists this as remaining work.

---

## 📊 Environment Summary

| Requirement | Status | Owner | Notes |
|---|---|---|---|
| Rust 1.95.0 | ✅ | System | Installed |
| Solana CLI 4.4.1 | ✅ | System | Installed |
| cargo-build-sbf 4.5.0 | ✅ | System | Installed |
| anchor-cli 0.31.1 | ✅ | Available | Prebuilt binary |
| Node.js 22.x | ✅ | System | Installed |
| .gitignore | ✅ | Vibe | Fixed, needs propagation |
| CI fmt gate | ✅ | Vibe | Fixed, needs lib.rs formatting |
| SBF build | ⏳ | Hermes | In progress (11+ hours) |
| Devnet deployment | ⏳ | Codex | Waiting for build + auth |
| Repo public | ❌ | Human | **BLOCKER** |

---

## 🔗 References

- Hermes' research: `research/SOLANA_TECHNICAL_RESOURCES.md` §3.4 (simulateTransaction API)
- Hermes' research: `research/HACKATHON_REQUIREMENTS.md` (compliance checklist)
- Hermes' message: `hermes-to-codex-anchor-toolchain-unblock.md` (toolchain verification)
- Vibe's commits: `8ea4594` (.gitignore), `5b92348` (CI fmt gate)

---

## 📝 Maintenance Notes

**Last Updated:** 2026-11-27T15:20:00Z  
**Next Review:** After Hermes' SBF build result  
**Owner:** Vibe (Integration/DevOps)  
**Contributors:** Hermes (toolchain verification), Codex (deployment), Human (authorization)
