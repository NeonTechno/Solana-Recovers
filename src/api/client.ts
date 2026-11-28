import type {
  ActivityEvent,
  AiAssistantReply,
  ApiErrorBody,
  ApiHealth,
  AssistantIntent,
  RecoveryAction,
  RecoveryPlan,
  RecoveryRequestView,
  RewardsResponse,
  WalletSummary,
} from "./types";

export const API_BASE_URL = "http://localhost:8787";
const API_TIMEOUT_MS = 15_000;

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  const timeoutSignal = AbortSignal.timeout(API_TIMEOUT_MS);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json; charset=utf-8" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiRequestError(
      timeoutSignal.aborted
        ? "The ReKey API request timed out. Check the service and try again."
        : "The ReKey API could not be reached. Check that it is running and try again.",
      0,
      timeoutSignal.aborted ? "timeout" : "network_error",
    );
  }

  if (!response.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = await response.json() as ApiErrorBody;
    } catch {
      // Some proxies return an empty body for upstream failures.
    }
    throw new ApiRequestError(
      body?.error?.message ?? `The ReKey API returned HTTP ${response.status}. Try again shortly.`,
      response.status,
      body?.error?.code ?? "http_error",
    );
  }

  try {
    return await response.json() as T;
  } catch {
    throw new ApiRequestError("The ReKey API returned an unreadable response. Try again.", response.status, "invalid_response");
  }
}

const walletPath = (address: string) => `/api/wallet/${encodeURIComponent(address)}`;

export function getHealth(signal?: AbortSignal): Promise<ApiHealth> {
  return requestJson<ApiHealth>("/api/health", { signal });
}

export function getWalletSummary(address: string, signal?: AbortSignal): Promise<WalletSummary> {
  return requestJson<WalletSummary>(walletPath(address), { signal });
}

export async function getActivity(address: string, signal?: AbortSignal): Promise<ActivityEvent[]> {
  const result = await requestJson<{ events: ActivityEvent[] }>(`${walletPath(address)}/activity`, { signal });
  return result.events;
}

export async function getRecoveryRequests(address: string, signal?: AbortSignal): Promise<RecoveryRequestView[]> {
  const result = await requestJson<{ requests: RecoveryRequestView[] }>(`${walletPath(address)}/recovery/requests`, { signal });
  return result.requests;
}

export function getRewards(address: string, signal?: AbortSignal): Promise<RewardsResponse> {
  return requestJson<RewardsResponse>(`${walletPath(address)}/rewards`, { signal });
}

export function askAssistant(
  address: string,
  question: string,
  intent: AssistantIntent,
  signal?: AbortSignal,
): Promise<AiAssistantReply> {
  return requestJson<AiAssistantReply>("/api/ai/assist", {
    method: "POST",
    body: JSON.stringify({ address, question, intent }),
    signal,
  });
}

export function createRecoveryPlan(
  address: string,
  action: RecoveryAction,
  options: { newOwner?: string; nonce?: number } = {},
): Promise<RecoveryPlan> {
  return requestJson<RecoveryPlan>("/api/recovery/plan", {
    method: "POST",
    body: JSON.stringify({ address, action, ...options }),
  });
}