/**
 * Solana read layer for ReKey.
 *
 * Contains every web3.js type so the rest of the server never imports web3.js
 * directly (keeps the boundary contained, per the architecture doc).
 *
 * This module is strictly READ-ONLY. It never signs and never submits.
 */

import { Connection, PublicKey } from "@solana/web3.js";
import type { Cluster, RecoveryStatus } from "../../shared/types.ts";

/**
 * The single source of truth for the program id.
 *
 * AR-01: the id used to be hardcoded in two places (here and config.ts), which
 * let the server and the program drift apart. It now lives here only, and
 * config.ts imports it.
 */
export const PROGRAM_ID_STRING =
  process.env.REKEY_PROGRAM_ID ?? "CuNNoYhAJsGNKZzi7NbEZjVTR2T8GUZyNKMN8SUPzRhS";

export const PROGRAM_ID = new PublicKey(PROGRAM_ID_STRING);

export const WALLET_SEED = "wallet";
export const VAULT_SEED = "vault";
export const RECOVERY_SEED = "recovery";

export const MAX_GUARDIANS = 5;
export const RECOVERY_STATUSES: RecoveryStatus[] = [
  "Pending",
  "Approved",
  "Cancelled",
  "Executed",
  "Expired",
];

/** Anchor account discriminators are the first 8 bytes of sha256("account:<Name>"). */
export async function accountDiscriminator(name: string): Promise<Buffer> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256")
    .update(`account:${name}`)
    .digest()
    .subarray(0, 8);
}

export function deriveWalletConfigPdaSync(initialOwner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(WALLET_SEED), initialOwner.toBuffer()],
    PROGRAM_ID,
  );
}

export function deriveVaultPda(walletConfig: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_SEED), walletConfig.toBuffer()],
    PROGRAM_ID,
  );
}

export function deriveRecoveryRequestPda(
  walletConfig: PublicKey,
  nonce: number,
): [PublicKey, number] {
  const nonceLe = Buffer.alloc(8);
  nonceLe.writeBigUInt64LE(BigInt(nonce));
  return PublicKey.findProgramAddressSync(
    [Buffer.from(RECOVERY_SEED), walletConfig.toBuffer(), nonceLe],
    PROGRAM_ID,
  );
}

export function resolveCluster(): Cluster {
  const raw = (process.env.REKEY_ENV ?? "devnet").toLowerCase();
  if (raw === "mainnet" || raw === "devnet" || raw === "localnet") return raw;
  return "devnet";
}

export function rpcUrl(): string {
  return (
    process.env.SOLANA_RPC_URL ??
    (resolveCluster() === "localnet"
      ? "http://127.0.0.1:8899"
      : "https://api.devnet.solana.com")
  );
}

export function createConnection(): Connection {
  return new Connection(rpcUrl(), "confirmed");
}

/** WalletConfig account layout (Anchor, little-endian). */
export interface DecodedWalletConfig {
  initialOwner: PublicKey;
  owner: PublicKey;
  guardians: PublicKey[];
  threshold: number;
  delaySeconds: number;
  nextNonce: number;
  policyVersion: number;
  bump: number;
}

/**
 * WalletConfig::SPACE = 8 + 32 + 32 + 4 + (MAX_GUARDIANS * 32) + 1 + 8 + 8 + 8 + 1
 * The Vec<Pubkey> is 4-byte length prefix + N * 32 bytes.
 */
export const WALLET_CONFIG_SPACE = 8 + 32 + 32 + 4 + MAX_GUARDIANS * 32 + 1 + 8 + 8 + 8 + 1;

/** RecoveryRequest::SPACE = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 4 + (MAX*32) + 1 + 1 */
export const RECOVERY_REQUEST_SPACE =
  8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 4 + MAX_GUARDIANS * 32 + 1 + 1;

export function decodeWalletConfig(data: Buffer): DecodedWalletConfig | null {
  if (data.length < 8 + 32 + 32 + 4) return null;
  let off = 8; // discriminator
  const initialOwner = new PublicKey(data.subarray(off, (off += 32)));
  const owner = new PublicKey(data.subarray(off, (off += 32)));
  const guardianLen = data.readUInt32LE(off);
  off += 4;
  const guardians: PublicKey[] = [];
  for (let i = 0; i < guardianLen; i++) {
    if (off + 32 > data.length) return null;
    guardians.push(new PublicKey(data.subarray(off, (off += 32))));
  }
  const threshold = data.readUInt8(off);
  off += 1;
  const delaySeconds = Number(data.readBigInt64LE(off));
  off += 8;
  const nextNonce = Number(data.readBigUInt64LE(off));
  off += 8;
  const policyVersion = Number(data.readBigUInt64LE(off));
  off += 8;
  const bump = data.readUInt8(off);
  return {
    initialOwner,
    owner,
    guardians,
    threshold,
    delaySeconds,
    nextNonce,
    policyVersion,
    bump,
  };
}

export interface DecodedRecoveryRequest {
  walletConfig: PublicKey;
  newOwner: PublicKey;
  nonce: number;
  policyVersion: number;
  createdAt: number;
  executeAfter: number;
  expiresAt: number;
  approvals: PublicKey[];
  status: RecoveryStatus;
  bump: number;
}

export function decodeRecoveryRequest(data: Buffer): DecodedRecoveryRequest | null {
  if (data.length < 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 4) return null;
  let off = 8;
  const walletConfig = new PublicKey(data.subarray(off, (off += 32)));
  const newOwner = new PublicKey(data.subarray(off, (off += 32)));
  const nonce = Number(data.readBigUInt64LE(off));
  off += 8;
  const policyVersion = Number(data.readBigUInt64LE(off));
  off += 8;
  const createdAt = Number(data.readBigInt64LE(off));
  off += 8;
  const executeAfter = Number(data.readBigInt64LE(off));
  off += 8;
  const expiresAt = Number(data.readBigInt64LE(off));
  off += 8;
  const approvalLen = data.readUInt32LE(off);
  off += 4;
  const approvals: PublicKey[] = [];
  for (let i = 0; i < approvalLen; i++) {
    if (off + 32 > data.length) return null;
    approvals.push(new PublicKey(data.subarray(off, (off += 32))));
  }
  const statusIndex = data.readUInt8(off);
  off += 1;
  const status = RECOVERY_STATUSES[statusIndex] ?? "Pending";
  const bump = data.readUInt8(off);
  return {
    walletConfig,
    newOwner,
    nonce,
    policyVersion,
    createdAt,
    executeAfter,
    expiresAt,
    approvals,
    status,
    bump,
  };
}

export function isValidBase58(value: string): boolean {
  if (!value || value.length < 32 || value.length > 44) return false;
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

export async function readWalletConfig(
  connection: Connection,
  initialOwner: PublicKey,
): Promise<DecodedWalletConfig | null> {
  const [pda] = deriveWalletConfigPdaSync(initialOwner);
  const info = await connection.getAccountInfo(pda, "confirmed");
  if (!info) return null;
  if (!info.owner.equals(PROGRAM_ID)) return null;
  return decodeWalletConfig(info.data);
}

export async function readRecoveryRequest(
  connection: Connection,
  walletConfig: PublicKey,
  nonce: number,
): Promise<DecodedRecoveryRequest | null> {
  const [pda] = deriveRecoveryRequestPda(walletConfig, nonce);
  const info = await connection.getAccountInfo(pda, "confirmed");
  if (!info) return null;
  if (!info.owner.equals(PROGRAM_ID)) return null;
  return decodeRecoveryRequest(info.data);
}
