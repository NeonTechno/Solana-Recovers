// Generated TypeScript types for ReKey program
// This file should be generated from the Anchor IDL
// For now, it contains placeholder types

import { PublicKey } from '@solana/web3.js';

// ============================================================================
// Program IDL Type
// ============================================================================

export interface ReKeyProgram {
  version: string;
  name: string;
  instructions: any[];
  accounts: any[];
  events: any[];
  errors: any[];
}

// ============================================================================
// Program ID
// ============================================================================

export const ReKeyProgramIDL: ReKeyProgram = {
  version: '0.1.0',
  name: 'rekey_program',
  instructions: [
    {
      name: 'initializeWallet',
      docs: ['Initialize a new ReKey wallet'],
      discriminator: [0, 0, 0, 0, 0, 0, 0, 0],
      accounts: [
        { name: 'owner', isMut: true, isSigner: true },
        { name: 'walletConfig', isMut: true, isSigner: false },
        { name: 'vault', isMut: true, isSigner: false },
        { name: 'systemProgram', isMut: false, isSigner: false },
      ],
      args: [
        { name: 'guardians', type: { vec: 'pubkey' } },
        { name: 'threshold', type: 'u8' },
        { name: 'delaySeconds', type: 'i64' },
      ],
    },
    {
      name: 'updateRecoveryPolicy',
      docs: ['Update the recovery policy for a wallet'],
      discriminator: [1, 0, 0, 0, 0, 0, 0, 0],
      accounts: [
        { name: 'walletConfig', isMut: true, isSigner: false },
        { name: 'owner', isMut: false, isSigner: true },
      ],
      args: [
        { name: 'guardians', type: { vec: 'pubkey' } },
        { name: 'threshold', type: 'u8' },
        { name: 'delaySeconds', type: 'i64' },
      ],
    },
    {
      name: 'initiateRecovery',
      docs: ['Initiate a recovery request'],
      discriminator: [2, 0, 0, 0, 0, 0, 0, 0],
      accounts: [
        { name: 'walletConfig', isMut: true, isSigner: false },
        { name: 'recoveryRequest', isMut: true, isSigner: false },
        { name: 'initiator', isMut: true, isSigner: true },
        { name: 'systemProgram', isMut: false, isSigner: false },
      ],
      args: [
        { name: 'newOwner', type: 'pubkey' },
      ],
    },
    {
      name: 'approveRecovery',
      docs: ['Approve a recovery request'],
      discriminator: [3, 0, 0, 0, 0, 0, 0, 0],
      accounts: [
        { name: 'walletConfig', isMut: false, isSigner: false },
        { name: 'recoveryRequest', isMut: true, isSigner: false },
        { name: 'guardian', isMut: false, isSigner: true },
      ],
      args: [],
    },
    {
      name: 'executeRecovery',
      docs: ['Execute a recovery request'],
      discriminator: [4, 0, 0, 0, 0, 0, 0, 0],
      accounts: [
        { name: 'walletConfig', isMut: true, isSigner: false },
        { name: 'recoveryRequest', isMut: true, isSigner: false },
      ],
      args: [],
    },
    {
      name: 'cancelRecovery',
      docs: ['Cancel a recovery request'],
      discriminator: [5, 0, 0, 0, 0, 0, 0, 0],
      accounts: [
        { name: 'walletConfig', isMut: false, isSigner: false },
        { name: 'recoveryRequest', isMut: true, isSigner: false },
        { name: 'owner', isMut: false, isSigner: true },
      ],
      args: [],
    },
    {
      name: 'expireRecovery',
      docs: ['Mark a recovery request as expired'],
      discriminator: [6, 0, 0, 0, 0, 0, 0, 0],
      accounts: [
        { name: 'walletConfig', isMut: false, isSigner: false },
        { name: 'recoveryRequest', isMut: true, isSigner: false },
      ],
      args: [],
    },
    {
      name: 'withdrawSol',
      docs: ['Withdraw SOL from the vault'],
      discriminator: [7, 0, 0, 0, 0, 0, 0, 0],
      accounts: [
        { name: 'walletConfig', isMut: false, isSigner: false },
        { name: 'vault', isMut: true, isSigner: false },
        { name: 'owner', isMut: false, isSigner: true },
        { name: 'recipient', isMut: true, isSigner: false },
      ],
      args: [
        { name: 'amount', type: 'u64' },
      ],
    },
  ],
  accounts: [
    {
      name: 'walletConfig',
      discriminator: [0],
      fields: [
        { name: 'initialOwner', type: 'pubkey' },
        { name: 'owner', type: 'pubkey' },
        { name: 'guardians', type: { vec: 'pubkey' } },
        { name: 'threshold', type: 'u8' },
        { name: 'delaySeconds', type: 'i64' },
        { name: 'nextNonce', type: 'u64' },
        { name: 'policyVersion', type: 'u64' },
        { name: 'bump', type: 'u8' },
      ],
    },
    {
      name: 'vault',
      discriminator: [1],
      fields: [
        { name: 'walletConfig', type: 'pubkey' },
        { name: 'bump', type: 'u8' },
      ],
    },
    {
      name: 'recoveryRequest',
      discriminator: [2],
      fields: [
        { name: 'walletConfig', type: 'pubkey' },
        { name: 'newOwner', type: 'pubkey' },
        { name: 'nonce', type: 'u64' },
        { name: 'policyVersion', type: 'u64' },
        { name: 'createdAt', type: 'i64' },
        { name: 'executeAfter', type: 'i64' },
        { name: 'expiresAt', type: 'i64' },
        { name: 'approvals', type: { vec: 'pubkey' } },
        { name: 'status', type: { enum: ['pending', 'approved', 'cancelled', 'executed', 'expired'] } },
        { name: 'bump', type: 'u8' },
      ],
    },
  ],
  events: [
    {
      name: 'WalletInitialized',
      fields: [
        { name: 'wallet', type: 'pubkey' },
        { name: 'owner', type: 'pubkey' },
        { name: 'vault', type: 'pubkey' },
      ],
    },
    {
      name: 'RecoveryPolicyUpdated',
      fields: [
        { name: 'wallet', type: 'pubkey' },
        { name: 'policyVersion', type: 'u64' },
        { name: 'threshold', type: 'u8' },
        { name: 'guardianCount', type: 'u8' },
        { name: 'delaySeconds', type: 'i64' },
      ],
    },
    {
      name: 'RecoveryInitiated',
      fields: [
        { name: 'wallet', type: 'pubkey' },
        { name: 'request', type: 'pubkey' },
        { name: 'newOwner', type: 'pubkey' },
        { name: 'nonce', type: 'u64' },
        { name: 'executeAfter', type: 'i64' },
      ],
    },
    {
      name: 'GuardianApproved',
      fields: [
        { name: 'wallet', type: 'pubkey' },
        { name: 'request', type: 'pubkey' },
        { name: 'guardian', type: 'pubkey' },
        { name: 'approvalCount', type: 'u8' },
        { name: 'threshold', type: 'u8' },
      ],
    },
    {
      name: 'RecoveryCancelled',
      fields: [
        { name: 'wallet', type: 'pubkey' },
        { name: 'request', type: 'pubkey' },
        { name: 'cancelledBy', type: 'pubkey' },
      ],
    },
    {
      name: 'RecoveryExecuted',
      fields: [
        { name: 'wallet', type: 'pubkey' },
        { name: 'request', type: 'pubkey' },
        { name: 'previousOwner', type: 'pubkey' },
        { name: 'newOwner', type: 'pubkey' },
        { name: 'nonce', type: 'u64' },
      ],
    },
    {
      name: 'SolWithdrawn',
      fields: [
        { name: 'wallet', type: 'pubkey' },
        { name: 'recipient', type: 'pubkey' },
        { name: 'amount', type: 'u64' },
      ],
    },
  ],
  errors: [
    { code: 0, name: 'InvalidGuardianCount', msg: 'The recovery policy must contain between one and five guardians.' },
    { code: 1, name: 'InvalidThreshold', msg: 'The approval threshold must be between one and the guardian count.' },
    { code: 2, name: 'InvalidTimelock', msg: 'The timelock must be between 60 seconds and 30 days.' },
    { code: 3, name: 'OwnerCannotBeGuardian', msg: 'The wallet owner cannot be a guardian.' },
    { code: 4, name: 'DuplicateGuardian', msg: 'Guardian public keys must be unique.' },
    { code: 5, name: 'Unauthorized', msg: 'The caller is not authorized.' },
    { code: 6, name: 'UnauthorizedGuardian', msg: 'The caller is not a registered guardian.' },
    { code: 7, name: 'InvalidNewOwner', msg: 'The proposed owner public key is invalid.' },
    { code: 8, name: 'SameOwner', msg: 'The proposed owner is already the current owner.' },
    { code: 9, name: 'InvalidRecoveryState', msg: 'This recovery request is not in a state that allows this action.' },
    { code: 10, name: 'RecoveryExpired', msg: 'The recovery request has expired.' },
    { code: 11, name: 'RecoveryNotExpired', msg: 'The recovery request has not expired yet.' },
    { code: 12, name: 'DuplicateApproval', msg: 'This guardian has already approved the request.' },
    { code: 13, name: 'TooManyApprovals', msg: 'The approval list is full.' },
    { code: 14, name: 'ThresholdNotReached', msg: 'The guardian threshold has not been reached.' },
    { code: 15, name: 'TimelockActive', msg: 'The recovery timelock is still active.' },
    { code: 16, name: 'TimelockElapsed', msg: 'The recovery timelock has elapsed; cancellation is no longer available.' },
    { code: 17, name: 'StalePolicy', msg: 'The recovery request was created under an outdated guardian policy.' },
    { code: 18, name: 'InsufficientFunds', msg: 'The wallet vault does not have enough spendable SOL.' },
    { code: 19, name: 'InvalidAmount', msg: 'The transfer amount must be greater than zero.' },
    { code: 20, name: 'InvalidRecipient', msg: 'The recipient cannot be the vault itself.' },
    { code: 21, name: 'ArithmeticOverflow', msg: 'Arithmetic overflow.' },
  ],
};

export { ReKeyProgramIDL as IDL };
