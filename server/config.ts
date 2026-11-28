/**
 * Environment configuration for the ReKey API.
 *
 * Never logs or returns secret values. Placeholders only in `.env.example`.
 */

import type { Cluster } from "../shared/types.ts";

export interface ServerConfig {
  cluster: Cluster;
  rpcUrl: string;
  programId: string;
  port: number;
  ai: {
    baseUrl: string;
    apiKey: string;
    model: string;
    configured: boolean;
  };
  version: string;
}

export const API_VERSION = "1.0.0";

function pick(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return undefined;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const rawCluster = (env.REKEY_ENV ?? "devnet").toLowerCase();
  const cluster: Cluster =
    rawCluster === "mainnet" || rawCluster === "localnet" ? rawCluster : "devnet";

  const defaultRpc =
    cluster === "localnet" ? "http://127.0.0.1:8899" : "https://api.devnet.solana.com";

  const baseUrl = pick(
    env.AI_BASE_URL,
    env.NVIDIA_BASE_URL,
    env.NVIDIA_NIM_API_BASE,
    "https://integrate.api.nvidia.com/v1",
  )!;

  const apiKey = pick(env.AI_API_KEY, env.NVIDIA_API_KEY, env.NVIDIA_NIM_API_KEY) ?? "";
  const model = pick(env.AI_MODEL, env.NVIDIA_SAFETY_MODEL, "mistralai/mistral-large-4-1t-a52b")!;

  return {
    cluster,
    rpcUrl: pick(env.SOLANA_RPC_URL, defaultRpc)!,
    programId: pick(
      env.REKEY_PROGRAM_ID,
      "CuNNoYhAJsGNKZzi7NbEZjVTR2T8GUZyNKMN8SUPzRhS",
    )!,
    port: Number(pick(env.PORT, "8787")),
    ai: {
      baseUrl,
      apiKey,
      model,
      configured: apiKey.length > 0,
    },
    version: API_VERSION,
  };
}

/**
 * Mainnet is blocked by default. The program has not been audited and the owner
 * explicitly forbade Mainnet deployment.
 */
export function assertMainnetBlocked(config: ServerConfig): void {
  if (config.cluster === "mainnet" && process.env.REKEY_ALLOW_MAINNET !== "1") {
    throw new Error(
      "Mainnet is disabled. Set REKEY_ALLOW_MAINNET=1 only with explicit owner approval.",
    );
  }
}
