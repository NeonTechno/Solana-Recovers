# Brand — ReKey

A non-custodial Solana wallet-recovery prototype with trusted-guardian workflows and program-enforced authority changes. Passkey/WebAuthn support is not implemented.

_Neon palette supersedes the earlier `brand-design` direction per decision D-007._

## Palette — Neon Guardian

_Decision D-007 (2026-11-28) supersedes the earlier Sand Club direction. The real ReKey diamond is the palette source._

**Vibe:** playful · protective · vivid

**Category:** non-custodial wallet recovery

Use a deep ink canvas with cool elevated surfaces. Neon accents are reserved for distinct surfaces and statuses; body copy and transaction details stay high-contrast and calm.

### Core tokens

| Role | Hex | Use |
|---|---|---|
| `bg-base` | `#0B0D16` | Main canvas |
| `bg-elevated` | `#131625` | Panels and cards |
| `bg-raised` | `#1B1F30` | Inputs, inset areas |
| `fg-base` | `#F3F4FC` | Primary text |
| `fg-muted` | `#A6ADC3` | Supporting text |
| `border` | `#2A2F45` | Surface boundaries |

### Logo-derived accents

| Token | Hex | Meaning |
|---|---|---|
| `accent-magenta` | `#FF3EC8` | Assistant / expressive highlights |
| `accent-purple` | `#A855F7` | Recovery / brand accent |
| `accent-blue` | `#3B82F6` | Activity / data |
| `accent-cyan` | `#22D3EE` | Read-only and connection |
| `accent-amber` | `#FBBF24` | Timelock / caution |
| `accent-lime` | `#A3E635` | Confirmed / positive |
| `accent-coral` | `#FB7185` | Destructive / attention |

### CSS token reference

This project uses Vite, React, and `src/styles.css`, not Tailwind or shadcn. Semantic colors are centralized in `src/brand.css`, imported from `src/main.tsx`. The product currently uses the dark theme only.

**Application theme:** near-black dark mode, consistent with the supplied logo.

```css
--bg: #0B0D16;
--panel: #131625;
--surface-raised: #1B1F30;
--line: #2A2F45;
--muted: #A6ADC3;
--foreground: #F3F4FC;
--accent-magenta: #FF3EC8;
--accent-purple: #A855F7;
--accent-blue: #3B82F6;
--accent-cyan: #22D3EE;
--accent-amber: #FBBF24;
--accent-lime: #A3E635;
--accent-coral: #FB7185;
```

### Contrast check

Primary text uses `#F3F4FC`; supporting text uses `#A6ADC3` on `#0B0D16` / `#131625`. Keep small text at AA contrast. Neon accents are not used as body copy; pair every color-coded state with a text label or icon.

| Pair | Target |
|---|---|
| `foreground` / `bg-base` | WCAG AA body copy |
| `muted` / `bg-base` | WCAG AA supporting copy |
| Accent icon / `bg-elevated` | At least 3:1 |
| Focus ring / adjacent surface | At least 3:1 |

## Typography — Space Grotesk + DM Sans + DM Mono

- **Display:** Space Grotesk
- **Body:** DM Sans
- **Mono for balances, addresses, and code:** DM Mono

The current stylesheet already loads these families. Keep the loading and fallback behavior in `src/styles.css`; this is not wired through `next/font` because the project is Vite, not Next.js.

### Type scale (recommended)

| Role | Size | Use |
|---|---:|---|
| Display | 36–48 px | One clear page-level statement |
| H1 | 28–32 px | Page title |
| H2 | 20 px | Section headings |
| H3 | 16 px | Panel titles |
| Body | 14–16 px | Main interface copy |
| Small / caption | 12 px minimum | Secondary labels and timestamps |
| Mono | Contextual | Wallet addresses, balances, IDs, and code |

## Gradients

Use the supplied logo as the only branded magenta-to-blue gradient image. Keep the app canvas nearly flat; use one subtle radial wash behind the dashboard header only.

```css
--gradient-bg: radial-gradient(ellipse at 82% 0%, rgb(91 49 143 / 10%), transparent 42%);
--gradient-accent: linear-gradient(115deg, #FF3EC8 0%, #A855F7 52%, #3B82F6 100%);
```

Use `--gradient-bg` only as a faint canvas wash. Use `--gradient-accent` for tiny decorative strokes or the logo glow, never behind body text, wallet details, or transaction-review content. Do not animate gradients or stack them.

## Tone and voice

### Words to use

Be direct, human, and measured. Name the state and the next step: recovery request, guardian approval, threshold, timelock, cancellation, Devnet, and simulated. Explain authority boundaries before asking for a wallet action.

### Words to avoid

Avoid hype, manufactured urgency, and unsupported guarantees: “safe,” “guaranteed,” “unhackable,” “instant recovery,” “luxury,” “exclusive,” and “unlock.” Do not imply conventional Solana keypairs can be recovered or that guardian approval gives spending authority.

### Voice example

> Two of three guardians approved. The 24-hour timelock has started. This prototype has not changed on-chain authority.

## Usage dos and don'ts

**Do:**

- Map semantic colors centrally in `src/brand.css`; avoid per-component color overrides.
- Keep spacing on a 4 px rhythm and preserve clear whitespace around trust-critical actions.
- Use DM Mono with tabular numerals for wallet addresses, balances, and changing counts.
- Show Devnet and simulation status wherever users could mistake a demo for on-chain execution.
- Pair semantic color with labels or icons; do not rely on color alone for success, warnings, or errors.
- Test the available dark theme, keyboard navigation, focus visibility, and mobile layouts.

**Don't:**

- Claim a transaction or recovery flow is safe based only on simulation.
- Present simulated guardian approval as an executed on-chain authority change.
- Put body copy on the accent gradient or use multiple gradients on one screen.
- Use green styling for errors or hide disabled actions without explanation.
- Use tiny text for status, addresses, or security disclaimers.

---

_Last updated: 2026-11-28. Palette: Neon Guardian (D-007) · Typography: Space Grotesk + DM Sans + DM Mono._