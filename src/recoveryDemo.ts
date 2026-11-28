export type RecoveryDemoStatus = "idle" | "pending" | "threshold-met" | "cancelled";

export interface RecoveryDemoState {
  status: RecoveryDemoStatus;
  approvals: string[];
}

export type RecoveryDemoAction =
  | { type: "start" }
  | { type: "approve"; guardian: string }
  | { type: "cancel" };

export const initialRecoveryDemo: RecoveryDemoState = {
  status: "idle",
  approvals: [],
};

const REQUIRED_APPROVALS = 2;

export function recoveryDemoReducer(
  state: RecoveryDemoState,
  action: RecoveryDemoAction,
): RecoveryDemoState {
  switch (action.type) {
    case "start":
      return { status: "pending", approvals: [] };
    case "approve": {
      if (state.status !== "pending" || state.approvals.includes(action.guardian)) {
        return state;
      }

      const approvals = [...state.approvals, action.guardian];
      return {
        status: approvals.length >= REQUIRED_APPROVALS ? "threshold-met" : "pending",
        approvals,
      };
    }
    case "cancel":
      if (state.status !== "pending" && state.status !== "threshold-met") {
        return state;
      }
      return { status: "cancelled", approvals: [] };
  }
}