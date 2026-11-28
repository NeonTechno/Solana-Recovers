// ReKey Lifeline Rewards - Main Entry Point
// Exports all rewards-related functionality

export * from './types';
export * from './rewardsEngine';
export * from './pointsLedger';
export * from './achievementManager';
export * from './resilienceCalculator';
export * from './antiSybil';
export * from './verification';

// Export the main engine factory
import { createRewardsEngine } from './rewardsEngine';
export default createRewardsEngine;
