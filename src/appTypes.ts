export type AppTab =
  | "landing"
  | "overview"
  | "smart-wallet"
  | "setup"
  | "recovery"
  | "guardians"
  | "activity"
  | "assistant"
  | "mcp"
  | "rewards"
  | "settings";

export type WorkspaceTab = Exclude<AppTab, "landing">;