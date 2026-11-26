# Dev3pack hackathon resource review

Reviewed on 26 November 2026 using the official Dev3pack hackathon site, its FAQ, its Solana Rust bootcamp page, and the linked Solana developer portal.

## Event context

- Dev3pack Global Hackathon: 27–29 November 2026.
- Hybrid participation: online or local build station.
- Main ecosystem: Solana.
- Best App Overall on Solana prize listed on the official page: $10,000+.
- Best mobile app track: Solana Mobile / Seeker phones.
- The Bridge Accelerator is listed as starting 7 December.

Confirm exact submission requirements and cutoff in the participant dashboard. The public FAQ scrape exposed category headings but not expanded answers, so do not infer rules about existing code, open-source requirements or AI-generated code.

## Resources and decisions

| Resource | Why it matters | ReKey use |
| --- | --- | --- |
| [Solana developer portal](https://solana.com/developers) | Official tutorials, docs, templates and developer bootcamp | Primary source for program and client implementation |
| [Solana Rust Bootcamp](https://www.dev3pack.xyz/programs/solana) | Dev3pack's free beginner Rust/Solana program covering accounts, PDAs, CPI and Anchor | Follow its account/PDA/Anchor progression; deploy to localnet/Devnet |
| [Solana developer bootcamp videos](https://solana.com/developers/docs/video-guides/2026-developer-bootcamp) | Official video curriculum | Reference for Solana program concepts |
| [Solana templates](https://solana.com/developers/templates) | Starter apps for Next.js, mobile and programs | Compare starter patterns before adding dependencies |
| [Solana Mobile](https://solanamobile.com/) | Mobile wallet and Seeker ecosystem | Potential later mobile wallet integration; not in MVP |
| [Firecrawl](https://www.firecrawl.dev/) | Hackathon sponsor; crawl/extract web content | Used to inspect official hackathon and resource pages; not required in runtime |
| [Supabase](https://supabase.com/) | Hackathon sponsor; hosted database/auth/storage | Optional later notification/indexing service; no custody or authorization |
| [ElevenLabs](https://elevenlabs.io/) | Hackathon sponsor; voice tools | Not relevant to the recovery security core; skip for MVP |
| [Bonfires](https://bonfires.ai/) | Hackathon supporter | Community/distribution resource, not a protocol dependency |
| [Blockchain Developer Report](https://blockchaindeveloper.report/) | Hackathon supporter | Ecosystem research only |

## Implementation priorities

1. Use official Solana docs and the Dev3pack Rust bootcamp curriculum for Anchor, PDAs, accounts and CPI.
2. Use wallet adapter standards for user-controlled wallet connection.
3. Prototype passkey signature verification with the Solana secp256r1 precompile; verify transaction composition constraints.
4. Keep recovery policy and ownership changes on-chain. Use Supabase only for optional notifications or off-chain activity indexing.
5. Defer Solana Mobile-specific packaging until the core Devnet recovery path works.

## Sources

- https://hack.dev3pack.xyz/
- https://hack.dev3pack.xyz/faq
- https://www.dev3pack.xyz/programs/solana
- https://solana.com/developers
- https://solana.com/developers/docs/video-guides/2026-developer-bootcamp
- https://solana.com/developers/templates
