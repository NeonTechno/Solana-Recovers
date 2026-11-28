/**
 * Deterministic resilience score + Lifeline Rewards engine.
 *
 * The score is computed purely from on-chain policy state so it is reproducible
 * offline and never depends on the AI provider. The AI may *explain* the score,
 * but it may not produce it.
 */

import type { LifelineReward, ResilienceScore, WalletPolicy } from "../../shared/types.ts";

export interface ScoreInput {
  policy: WalletPolicy;
  /** true when the wallet currently has a Pending or Approved recovery request */
  hasActiveRequest: boolean;
  /** true when the vault has ever held SOL */
  vaultEverFunded: boolean;
  /** unix seconds of the last policy change, 0 when unknown */
  policyUpdatedAt: number;
  /** current unix seconds */
  now: number;
}

export interface ScoreFactor {
  id: string;
  label: string;
  impact: number;
  detail: string;
}

const DAY = 24 * 60 * 60;

export function computeResilienceScore(input: ScoreInput): ResilienceScore {
  const { policy, hasActiveRequest, vaultEverFunded, policyUpdatedAt, now } = input;
  const factors: ScoreFactor[] = [];

  // --- Guardian breadth -------------------------------------------------
  const guardianCount = policy.guardians.length;
  if (guardianCount === 0) {
    factors.push({
      id: "guardians",
      label: "No guardians configured",
      impact: -1,
      detail: "Without a guardian, nobody can help recover this wallet.",
    });
  } else if (guardianCount === 1) {
    factors.push({
      id: "guardians",
      label: "Single guardian",
      impact: -0.6,
      detail: "One guardian is a single point of failure. Add more trusted guardians.",
    });
  } else if (guardianCount >= 4) {
    factors.push({
      id: "guardians",
      label: `${guardianCount} guardians`,
      impact: 1,
      detail: "A broad guardian set survives the loss of any single guardian.",
    });
  } else {
    factors.push({
      id: "guardians",
      label: `${guardianCount} guardians`,
      impact: 0.5,
      detail: "A workable guardian set. More guardians means more resilience.",
    });
  }

  // --- Threshold ratio --------------------------------------------------
  const threshold = policy.threshold;
  if (guardianCount > 0) {
    const ratio = threshold / guardianCount;
    if (ratio <= 0.34) {
      factors.push({
        id: "threshold",
        label: `Low threshold (${threshold} of ${guardianCount})`,
        impact: -0.4,
        detail:
          "A single guardian can complete a recovery. Consider requiring more approvals.",
      });
    } else if (ratio >= 0.67) {
      factors.push({
        id: "threshold",
        label: `Strong threshold (${threshold} of ${guardianCount})`,
        impact: 1,
        detail: "Multiple guardians must agree before the owner can change.",
      });
    } else {
      factors.push({
        id: "threshold",
        label: `Balanced threshold (${threshold} of ${guardianCount})`,
        impact: 0.5,
        detail: "A sensible balance between security and recoverability.",
      });
    }
  }

  // --- Timelock ---------------------------------------------------------
  const delayDays = policy.delaySeconds / DAY;
  if (policy.delaySeconds < DAY) {
    factors.push({
      id: "timelock",
      label: "Short timelock",
      impact: -0.5,
      detail:
        "A recovery can execute quickly. A longer delay gives you time to cancel a malicious request.",
    });
  } else if (delayDays >= 7) {
    factors.push({
      id: "timelock",
      label: `${Math.round(delayDays)}-day timelock`,
      impact: 1,
      detail: "A long timelock gives you ample time to react to an unwanted request.",
    });
  } else if (delayDays >= 2) {
    factors.push({
      id: "timelock",
      label: `${Math.round(delayDays)}-day timelock`,
      impact: 0.5,
      detail: "A reasonable window to notice and cancel an unwanted recovery.",
    });
  } else {
    factors.push({
      id: "timelock",
      label: "One-day timelock",
      impact: 0.2,
      detail: "A one-day window to react. Longer is safer.",
    });
  }

  // --- Active recovery request -----------------------------------------
  if (hasActiveRequest) {
    factors.push({
      id: "active_request",
      label: "Recovery request in progress",
      impact: -0.3,
      detail:
        "A recovery request is live. Review it carefully and cancel it if you did not expect it.",
    });
  } else {
    factors.push({
      id: "active_request",
      label: "No active recovery request",
      impact: 0.3,
      detail: "Nothing is currently trying to change the owner of this wallet.",
    });
  }

  // --- Policy freshness -------------------------------------------------
  if (policyUpdatedAt > 0) {
    const ageDays = (now - policyUpdatedAt) / DAY;
    if (ageDays > 365) {
      factors.push({
        id: "policy_age",
        label: "Policy not reviewed in over a year",
        impact: -0.2,
        detail: "Review your guardians and timelock — old guardian keys may be stale.",
      });
    } else {
      factors.push({
        id: "policy_age",
        label: "Policy recently reviewed",
        impact: 0.2,
        detail: "Your guardian policy has been reviewed recently.",
      });
    }
  }

  // --- Funding ----------------------------------------------------------
  if (vaultEverFunded) {
    factors.push({
      id: "funding",
      label: "Vault has been funded",
      impact: 0.1,
      detail: "The vault has held SOL, so the recovery path has been exercised.",
    });
  } else {
    factors.push({
      id: "funding",
      label: "Vault never funded",
      impact: -0.1,
      detail: "Move a small amount of SOL into the vault so the path is verifiable.",
    });
  }

  const raw = factors.reduce((sum, factor) => sum + factor.impact, 0);
  const max = Math.max(1, factors.length);
  const normalized = raw / max; // -1 .. 1
  const score = Math.max(0, Math.min(100, Math.round(50 + normalized * 50)));

  return {
    score,
    band: bandFor(score),
    factors,
    computedAt: input.now,
  };
}

export function bandFor(score: number): ResilienceScore["band"] {
  if (score >= 85) return "resilient";
  if (score >= 70) return "strong";
  if (score >= 50) return "fair";
  if (score >= 30) return "weak";
  return "critical";
}

export function computeLifelineRewards(
  input: ScoreInput,
  streakDays = 0,
): LifelineReward[] {
  const { policy, hasActiveRequest, vaultEverFunded } = input;
  const guardianCount = policy.guardians.length;
  const threshold = policy.threshold;

  const rewards: LifelineReward[] = [
    {
      id: "first-guardian",
      title: "First Guardian",
      description: "Add your first guardian so someone can help you recover access.",
      requirement: "Configure at least one guardian.",
      progress: guardianCount >= 1 ? 100 : 0,
      earned: guardianCount >= 1,
      points: 100,
    },
    {
      id: "guardian-circle",
      title: "Guardian Circle",
      description: "Build a guardian set that survives losing any single guardian.",
      requirement: "Configure three or more guardians.",
      progress: Math.min(100, Math.round((guardianCount / 3) * 100)),
      earned: guardianCount >= 3,
      points: 250,
    },
    {
      id: "two-of-three",
      title: "Two-Thirds Protection",
      description: "Require most of your guardians to agree before the owner changes.",
      requirement: "Set a threshold of two-thirds or more of your guardians.",
      progress:
        guardianCount === 0
          ? 0
          : Math.min(100, Math.round((threshold / guardianCount) * 150)),
      earned:
        guardianCount >= 3 && threshold / guardianCount >= 2 / 3,
      points: 300,
    },
    {
      id: "cooling-off",
      title: "Cooling-Off Period",
      description: "Give yourself time to cancel an unwanted recovery request.",
      requirement: "Set a recovery delay of seven days or more.",
      progress: Math.min(100, Math.round((policy.delaySeconds / (7 * DAY)) * 100)),
      earned: policy.delaySeconds >= 7 * DAY,
      points: 200,
    },
    {
      id: "funded-vault",
      title: "Proof of Life",
      description: "Fund the vault so you can verify the recovery path end to end.",
      requirement: "Hold SOL in the ReKey vault.",
      progress: vaultEverFunded ? 100 : 0,
      earned: vaultEverFunded,
      points: 150,
    },
    {
      id: "clear-signals",
      title: "Clear Signals",
      description: "Keep your recovery queue clean so a real request is easy to spot.",
      requirement: "Have no active recovery request.",
      progress: hasActiveRequest ? 0 : 100,
      earned: !hasActiveRequest,
      points: 100,
    },
    {
      id: "steady-hand",
      title: "Steady Hand",
      description: "Check in with ReKey regularly to keep your recovery plan current.",
      requirement: "Return for seven consecutive days.",
      progress: Math.min(100, Math.round((streakDays / 7) * 100)),
      earned: streakDays >= 7,
      points: 175,
    },
  ];

  return rewards;
}
