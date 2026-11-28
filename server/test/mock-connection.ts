/**
 * A mock Solana connection.
 *
 * Builds real Anchor-compatible account buffers so the decoder and PDA logic
 * are exercised against genuine byte layouts, without touching the network.
 */

import { PublicKey } from "@solana/web3.js";
import type { Connection } from "@solana/web3.js";
import {
  PROGRAM_ID,
  deriveRecoveryRequestPda,
  deriveVaultPda,
  deriveWalletConfigPdaSync,
} from "../solana/read.ts";
import type { RecoveryStatus } from "../../shared/types.ts";

export const OWNER = new PublicKey("HaL4pxafw7Y7kD4UrBfBVPaK9Xr4E8KhWS8MYnVCfJsK");
export const NEW_OWNER = new PublicKey("CuNNoYhAJsGNKZzi7NbEZjVTR2T8GUZyNKMN8SUPzRhS");

const DISCRIMINATOR = Buffer.alloc(8, 7);

export function encodeWalletConfig(options: {
  initialOwner: PublicKey;
  owner: PublicKey;
  guardians: PublicKey[];
  threshold: number;
  delaySeconds: number;
  nextNonce: number;
  policyVersion: number;
  bump: number;
}): Buffer {
  const size =
    8 + 32 + 32 + 4 + 5 * 32 + 1 + 8 + 8 + 8 + 1;
  const buf = Buffer.alloc(size);
  let off = 0;
  DISCRIMINATOR.copy(buf, off);
  off += 8;
  options.initialOwner.toBuffer().copy(buf, off);
  off += 32;
  options.owner.toBuffer().copy(buf, off);
  off += 32;
  buf.writeUInt32LE(options.guardians.length, off);
  off += 4;
  for (const guardian of options.guardians) {
    guardian.toBuffer().copy(buf, off);
    off += 32;
  }
  buf.writeUInt8(options.threshold, off);
  off += 1;
  buf.writeBigInt64LE(BigInt(options.delaySeconds), off);
  off += 8;
  buf.writeBigUInt64LE(BigInt(options.nextNonce), off);
  off += 8;
  buf.writeBigUInt64LE(BigInt(options.policyVersion), off);
  off += 8;
  buf.writeUInt8(options.bump, off);
  return buf;
}

export function encodeRecoveryRequest(options: {
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
}): Buffer {
  const size = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 4 + 5 * 32 + 1 + 1;
  const buf = Buffer.alloc(size);
  let off = 0;
  DISCRIMINATOR.copy(buf, off);
  off += 8;
  options.walletConfig.toBuffer().copy(buf, off);
  off += 32;
  options.newOwner.toBuffer().copy(buf, off);
  off += 32;
  buf.writeBigUInt64LE(BigInt(options.nonce), off);
  off += 8;
  buf.writeBigUInt64LE(BigInt(options.policyVersion), off);
  off += 8;
  buf.writeBigInt64LE(BigInt(options.createdAt), off);
  off += 8;
  buf.writeBigInt64LE(BigInt(options.executeAfter), off);
  off += 8;
  buf.writeBigInt64LE(BigInt(options.expiresAt), off);
  off += 8;
  buf.writeUInt32LE(options.approvals.length, off);
  off += 4;
  for (const approval of options.approvals) {
    approval.toBuffer().copy(buf, off);
    off += 32;
  }
  const statuses: RecoveryStatus[] = [
    "Pending",
    "Approved",
    "Cancelled",
    "Executed",
    "Expired",
  ];
  buf.writeUInt8(statuses.indexOf(options.status), off);
  off += 1;
  buf.writeUInt8(options.bump, off);
  return buf;
}

export interface MockAccount {
  data: Buffer;
  owner: PublicKey;
  lamports: number;
  executable: boolean;
  rentEpoch: number;
}

export interface MockState {
  accounts: Map<string, MockAccount>;
  slot: number;
  /** when true, every RPC call rejects — used to test degradation */
  offline: boolean;
  signatures: Map<string, Array<{ signature: string; err: null; blockTime: number | null }>>;
  transactions: Map<string, unknown>;
}

export function createMockState(): MockState {
  return {
    accounts: new Map(),
    slot: 100,
    offline: false,
    signatures: new Map(),
    transactions: new Map(),
  };
}

export function installWallet(
  state: MockState,
  options: {
    initialOwner: PublicKey;
    owner?: PublicKey;
    guardians: PublicKey[];
    threshold: number;
    delaySeconds: number;
    nextNonce: number;
    policyVersion?: number;
    vaultLamports?: number;
  },
): { walletConfig: PublicKey; vault: PublicKey } {
  const [walletConfig] = deriveWalletConfigPdaSync(options.initialOwner);
  const [vault] = deriveVaultPda(walletConfig);

  state.accounts.set(walletConfig.toBase58(), {
    data: encodeWalletConfig({
      initialOwner: options.initialOwner,
      owner: options.owner ?? options.initialOwner,
      guardians: options.guardians,
      threshold: options.threshold,
      delaySeconds: options.delaySeconds,
      nextNonce: options.nextNonce,
      policyVersion: options.policyVersion ?? 1,
      bump: 255,
    }),
    owner: PROGRAM_ID,
    lamports: 2_000_000,
    executable: false,
    rentEpoch: 0,
  });

  state.accounts.set(vault.toBase58(), {
    data: Buffer.alloc(41),
    owner: PROGRAM_ID,
    lamports: options.vaultLamports ?? 5_000_000_000,
    executable: false,
    rentEpoch: 0,
  });

  return { walletConfig, vault };
}

export function installRequest(
  state: MockState,
  walletConfig: PublicKey,
  options: {
    nonce: number;
    newOwner?: PublicKey;
    policyVersion?: number;
    createdAt?: number;
    executeAfter?: number;
    expiresAt?: number;
    approvals?: PublicKey[];
    status?: RecoveryStatus;
  },
): PublicKey {
  const [pda] = deriveRecoveryRequestPda(walletConfig, options.nonce);
  const now = Math.floor(Date.now() / 1000);
  state.accounts.set(pda.toBase58(), {
    data: encodeRecoveryRequest({
      walletConfig,
      newOwner: options.newOwner ?? NEW_OWNER,
      nonce: options.nonce,
      policyVersion: options.policyVersion ?? 1,
      createdAt: options.createdAt ?? now,
      executeAfter: options.executeAfter ?? now + 3600,
      expiresAt: options.expiresAt ?? now + 3600 + 7 * 24 * 60 * 60,
      approvals: options.approvals ?? [],
      status: options.status ?? "Pending",
      bump: 254,
    }),
    owner: PROGRAM_ID,
    lamports: 2_000_000,
    executable: false,
    rentEpoch: 0,
  });
  return pda;
}

/** Builds a Connection-shaped object backed by the mock state. */
export function createMockConnection(state: MockState): Connection {
  const accountInfo = async (key: PublicKey) => {
    if (state.offline) throw new Error("RPC offline");
    return state.accounts.get(key.toBase58()) ?? null;
  };

  return {
    getAccountInfo: accountInfo,
    getBalance: async (key: PublicKey) => {
      if (state.offline) throw new Error("RPC offline");
      const account = state.accounts.get(key.toBase58());
      return account?.lamports ?? 0;
    },
    getSlot: async () => {
      if (state.offline) throw new Error("RPC offline");
      return state.slot;
    },
    getSignaturesForAddress: async (key: PublicKey, _opts?: unknown) => {
      if (state.offline) throw new Error("RPC offline");
      return state.signatures.get(key.toBase58()) ?? [];
    },
    getTransaction: async (signature: string) => {
      if (state.offline) throw new Error("RPC offline");
      return state.transactions.get(signature) ?? null;
    },
  } as unknown as Connection;
}
