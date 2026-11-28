// ReKey Solana - Main Entry Point
// Exports all Solana-related functionality

export * from './types';
export * from './client';
export * from './verification';

// Export the main client factory
import { createReKeyClient } from './client';
export default createReKeyClient;
