import type { Connection, VersionedTransaction } from "@solana/web3.js";

const MAX_LOG_LINES = 200;
const MAX_LOG_LENGTH = 1_000;

export type SimulationSignalKind = "deterministic" | "heuristic";

export interface SimulationSignal {
  kind: SimulationSignalKind;
  code: "simulation-error" | "no-error-detected" | "logs-observed" | "cpi-observed";
  message: string;
}

export interface SimulationReview {
  disposition: "execution-error" | "no-error-detected";
  slot: number;
  signatureVerificationRequested: true;
  feeLamports: number | null;
  unitsConsumed: number | null;
  innerInstructionCount: number;
  logs: string[];
  logsTruncated: boolean;
  error: string | null;
  disclaimer: string;
  signals: SimulationSignal[];
}

type SimulationConnection = Pick<Connection, "simulateTransaction">;

export class UnsignedTransactionError extends Error {
  constructor() {
    super("A transaction with complete signatures is required for signature-verified simulation.");
    this.name = "UnsignedTransactionError";
  }
}

function hasCompleteSignatures(transaction: VersionedTransaction): boolean {
  return Array.isArray(transaction.signatures) && transaction.signatures.length > 0 && transaction.signatures.every(signature =>
    signature.length === 64 && signature.some(byte => byte !== 0),
  );
}

function stringifyError(error: unknown): string | null {
  if (error == null) return null;
  if (typeof error === "string") return error;

  try {
    return JSON.stringify(error) ?? "Unknown simulation error";
  } catch {
    return "Simulation returned an error that could not be serialized";
  }
}

function countInnerInstructions(innerInstructions: unknown): number {
  if (!Array.isArray(innerInstructions)) return 0;
  return innerInstructions.reduce((total, group) => {
    if (typeof group !== "object" || group === null || !("instructions" in group)) {
      return total;
    }
    const instructions = (group as { instructions?: unknown }).instructions;
    return total + (Array.isArray(instructions) ? instructions.length : 0);
  }, 0);
}

function boundLogs(logs: unknown): { logs: string[]; truncated: boolean } {
  if (!Array.isArray(logs)) return { logs: [], truncated: false };

  const strings = logs.filter((log): log is string => typeof log === "string");
  const bounded = strings.slice(0, MAX_LOG_LINES).map(log => log.slice(0, MAX_LOG_LENGTH));
  const truncated = strings.length > MAX_LOG_LINES || strings.some(log => log.length > MAX_LOG_LENGTH);
  return { logs: bounded, truncated };
}

export async function simulateSignedTransaction(
  connection: SimulationConnection,
  transaction: VersionedTransaction,
  minContextSlot?: number,
): Promise<SimulationReview> {
  if (!hasCompleteSignatures(transaction)) {
    throw new UnsignedTransactionError();
  }

  const options = {
    commitment: "confirmed" as const,
    innerInstructions: true,
    replaceRecentBlockhash: false,
    sigVerify: true,
    ...(minContextSlot === undefined ? {} : { minContextSlot }),
  };
  const response = await connection.simulateTransaction(transaction, options);
  const error = stringifyError(response.value.err);
  const innerInstructionCount = countInnerInstructions(response.value.innerInstructions);
  const { logs, truncated: logsTruncated } = boundLogs(response.value.logs);
  const feeLamports = "fee" in response.value && typeof response.value.fee === "number"
    ? response.value.fee
    : null;
  const signals: SimulationSignal[] = [];

  if (error !== null) {
    signals.push({
      kind: "deterministic",
      code: "simulation-error",
      message: `The RPC simulation returned an execution error: ${error}`,
    });
  } else {
    signals.push({
      kind: "deterministic",
      code: "no-error-detected",
      message: `No error detected in simulation at slot ${response.context.slot}.`,
    });
  }

  if (logs.length > 0) {
    signals.push({
      kind: "heuristic",
      code: "logs-observed",
      message: "Program logs are untrusted evidence; review them, but log text alone does not establish intent.",
    });
  }

  if (innerInstructionCount > 0) {
    signals.push({
      kind: "heuristic",
      code: "cpi-observed",
      message: `Simulation observed ${innerInstructionCount} inner instruction(s); this helper does not resolve their target programs. Their presence is not evidence of malicious behavior.`,
    });
  }

  return {
    disposition: error === null ? "no-error-detected" : "execution-error",
    slot: response.context.slot,
    signatureVerificationRequested: true,
    feeLamports,
    unitsConsumed: response.value.unitsConsumed ?? null,
    innerInstructionCount,
    logs,
    logsTruncated,
    error,
    disclaimer: `Simulation reflects RPC state at slot ${response.context.slot} and can differ later; a clean result is not a security guarantee.`,
    signals,
  };
}