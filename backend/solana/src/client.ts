// ReKey Solana - Main Client
// Typed client for the ReKey Solana program

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  TransactionSignature,
} from '@solana/web3.js';
import { Program, AnchorProvider, web3 } from '@project-serum/anchor';
import { ReKeyProgram } from './generated/rekey_program';
import {
  ReKeyProgramConfig,
  WalletConfig,
  Vault,
  RecoveryRequest,
  RecoveryStatus,
  InitializeWalletParams,
  InitializeWalletResult,
  UpdateRecoveryPolicyParams,
  UpdateRecoveryPolicyResult,
  InitiateRecoveryParams,
  InitiateRecoveryResult,
  ApproveRecoveryParams,
  ApproveRecoveryResult,
  ExecuteRecoveryResult,
  CancelRecoveryResult,
  WithdrawSolParams,
  WithdrawSolResult,
  ReKeyEvent,
  ReKeyClient,
  ReKeyError,
  ReKeyErrorCode,
  PROGRAM_CONSTANTS,
} from './types';
import { SignatureVerifier } from './verification';

// ============================================================================
// ReKey Client Implementation
// ============================================================================

export class ReKeyClientImpl implements ReKeyClient {
  private connection: Connection;
  private program: Program<ReKeyProgram>;
  private wallet: Keypair;
  private config: ReKeyProgramConfig;
  private signatureVerifier: SignatureVerifier;
  private eventListeners: Set<(event: ReKeyEvent) => void>;

  constructor(
    connection: Connection,
    programId: PublicKey,
    wallet: Keypair,
    config: Partial<ReKeyProgramConfig> = {}
  ) {
    this.connection = connection;
    this.wallet = wallet;
    this.config = {
      programId: programId.toBase58(),
      rpcUrl: connection.rpcEndpoint,
      commitment: 'confirmed',
      maxRetries: 3,
      timeoutMs: 60000,
      ...config,
    };
    
    this.signatureVerifier = new SignatureVerifier();
    this.eventListeners = new Set();
    
    // Initialize Anchor program
    const provider = new AnchorProvider(
      connection,
      wallet,
      AnchorProvider.defaultOptions()
    );
    
    this.program = new Program(
      ReKeyProgram.IDL,
      programId,
      provider
    );
    
    // Start listening for events
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for program events
    this.program.addEventListener('WalletInitialized', (event) => {
      this.notifyListeners({
        type: 'wallet_initialized',
        data: {
          wallet: new PublicKey(event.wallet),
          owner: new PublicKey(event.owner),
          vault: new PublicKey(event.vault),
        },
      });
    });

    this.program.addEventListener('RecoveryPolicyUpdated', (event) => {
      this.notifyListeners({
        type: 'policy_updated',
        data: {
          wallet: new PublicKey(event.wallet),
          policyVersion: event.policyVersion.toNumber(),
          threshold: event.threshold,
          guardianCount: event.guardianCount,
          delaySeconds: event.delaySeconds.toNumber(),
        },
      });
    });

    this.program.addEventListener('RecoveryInitiated', (event) => {
      this.notifyListeners({
        type: 'recovery_initiated',
        data: {
          wallet: new PublicKey(event.wallet),
          request: new PublicKey(event.request),
          newOwner: new PublicKey(event.newOwner),
          nonce: event.nonce.toNumber(),
          executeAfter: event.executeAfter.toNumber(),
        },
      });
    });

    this.program.addEventListener('GuardianApproved', (event) => {
      this.notifyListeners({
        type: 'guardian_approved',
        data: {
          wallet: new PublicKey(event.wallet),
          request: new PublicKey(event.request),
          guardian: new PublicKey(event.guardian),
          approvalCount: event.approvalCount,
          threshold: event.threshold,
        },
      });
    });

    this.program.addEventListener('RecoveryCancelled', (event) => {
      this.notifyListeners({
        type: 'recovery_cancelled',
        data: {
          wallet: new PublicKey(event.wallet),
          request: new PublicKey(event.request),
          cancelledBy: new PublicKey(event.cancelledBy),
        },
      });
    });

    this.program.addEventListener('RecoveryExecuted', (event) => {
      this.notifyListeners({
        type: 'recovery_executed',
        data: {
          wallet: new PublicKey(event.wallet),
          request: new PublicKey(event.request),
          previousOwner: new PublicKey(event.previousOwner),
          newOwner: new PublicKey(event.newOwner),
          nonce: event.nonce.toNumber(),
        },
      });
    });

    this.program.addEventListener('SolWithdrawn', (event) => {
      this.notifyListeners({
        type: 'sol_withdrawn',
        data: {
          wallet: new PublicKey(event.wallet),
          recipient: new PublicKey(event.recipient),
          amount: event.amount.toNumber(),
        },
      });
    });
  }

  private notifyListeners(event: ReKeyEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in event listener:', error);
      }
    }
  }

  // ============================================================================
  // PDA Derivation
  // ============================================================================

  async findWalletConfigPDA(owner: PublicKey): Promise<PublicKey> {
    const [pda] = await web3.PublicKey.findProgramAddress(
      [Buffer.from('wallet'), owner.toBuffer()],
      this.program.programId
    );
    return pda;
  }

  async findVaultPDA(walletConfig: PublicKey): Promise<PublicKey> {
    const [pda] = await web3.PublicKey.findProgramAddress(
      [Buffer.from('vault'), walletConfig.toBuffer()],
      this.program.programId
    );
    return pda;
  }

  async findRecoveryRequestPDA(
    walletConfig: PublicKey,
    nonce: number
  ): Promise<PublicKey> {
    const nonceBuffer = Buffer.alloc(8);
    nonceBuffer.writeBigUInt64LE(BigInt(nonce));
    
    const [pda] = await web3.PublicKey.findProgramAddress(
      [Buffer.from('recovery'), walletConfig.toBuffer(), nonceBuffer],
      this.program.programId
    );
    return pda;
  }

  // ============================================================================
  // Initialize Wallet
  // ============================================================================

  async initializeWallet(
    params: InitializeWalletParams
  ): Promise<InitializeWalletResult> {
    try {
      const owner = this.wallet.publicKey;
      
      // Derive PDAs
      const walletConfigPDA = await this.findWalletConfigPDA(owner);
      const vaultPDA = await this.findVaultPDA(walletConfigPDA);
      
      // Convert guardians
      const guardianPubkeys = params.guardians.map(g => 
        g instanceof PublicKey ? g : new PublicKey(g)
      );
      
      // Create transaction
      const tx = new Transaction().add(
        this.program.instruction.initializeWallet(
          guardianPubkeys,
          params.threshold,
          params.delaySeconds,
          {
            accounts: {
              owner: owner,
              walletConfig: walletConfigPDA,
              vault: vaultPDA,
              systemProgram: SystemProgram.programId,
            },
          }
        )
      );
      
      // Send transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        tx,
        [this.wallet]
      );
      
      return {
        walletConfig: walletConfigPDA,
        vault: vaultPDA,
        transactionSignature: signature,
      };
    } catch (error) {
      throw this.handleError(error, 'initializeWallet');
    }
  }

  // ============================================================================
  // Update Recovery Policy
  // ============================================================================

  async updateRecoveryPolicy(
    params: UpdateRecoveryPolicyParams
  ): Promise<UpdateRecoveryPolicyResult> {
    try {
      const walletConfigPDA = await this.findWalletConfigPDA(this.wallet.publicKey);
      
      // Convert guardians
      const guardianPubkeys = params.guardians.map(g => 
        g instanceof PublicKey ? g : new PublicKey(g)
      );
      
      // Get current wallet config to verify owner
      const walletConfig = await this.getWalletConfig(walletConfigPDA);
      if (!walletConfig) {
        throw new ReKeyError(
          'ACCOUNT_NOT_FOUND',
          'Wallet configuration not found'
        );
      }
      
      if (walletConfig.owner.toBase58() !== this.wallet.publicKey.toBase58()) {
        throw new ReKeyError(
          'INVALID_OWNER',
          'Only the wallet owner can update the recovery policy'
        );
      }
      
      // Create transaction
      const tx = new Transaction().add(
        this.program.instruction.updateRecoveryPolicy(
          guardianPubkeys,
          params.threshold,
          params.delaySeconds,
          {
            accounts: {
              walletConfig: walletConfigPDA,
              owner: this.wallet.publicKey,
            },
          }
        )
      );
      
      // Send transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        tx,
        [this.wallet]
      );
      
      // Get updated policy version
      const updatedConfig = await this.getWalletConfig(walletConfigPDA);
      
      return {
        policyVersion: updatedConfig!.policyVersion,
        transactionSignature: signature,
      };
    } catch (error) {
      throw this.handleError(error, 'updateRecoveryPolicy');
    }
  }

  // ============================================================================
  // Initiate Recovery
  // ============================================================================

  async initiateRecovery(
    params: InitiateRecoveryParams
  ): Promise<InitiateRecoveryResult> {
    try {
      const newOwner = params.newOwner instanceof PublicKey 
        ? params.newOwner 
        : new PublicKey(params.newOwner);
      
      // Get wallet config
      const walletConfigPDA = await this.findWalletConfigPDA(newOwner);
      const walletConfig = await this.getWalletConfig(walletConfigPDA);
      
      if (!walletConfig) {
        throw new ReKeyError(
          'ACCOUNT_NOT_FOUND',
          'Wallet configuration not found'
        );
      }
      
      // Check if caller is a guardian
      const isGuardian = walletConfig.guardians.some(g => 
        g.toBase58() === this.wallet.publicKey.toBase58()
      );
      
      if (!isGuardian) {
        throw new ReKeyError(
          'UNAUTHORIZED',
          'Only guardians can initiate recovery'
        );
      }
      
      // Get next nonce
      const nextNonce = walletConfig.nextNonce;
      const recoveryRequestPDA = await this.findRecoveryRequestPDA(
        walletConfigPDA,
        nextNonce
      );
      
      // Create transaction
      const tx = new Transaction().add(
        this.program.instruction.initiateRecovery(newOwner, {
          accounts: {
            walletConfig: walletConfigPDA,
            recoveryRequest: recoveryRequestPDA,
            initiator: this.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          },
        })
      );
      
      // Send transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        tx,
        [this.wallet]
      );
      
      return {
        recoveryRequest: recoveryRequestPDA,
        nonce: nextNonce,
        executeAfter: Date.now() / 1000 + walletConfig.delaySeconds,
        transactionSignature: signature,
      };
    } catch (error) {
      throw this.handleError(error, 'initiateRecovery');
    }
  }

  // ============================================================================
  // Approve Recovery
  // ============================================================================

  async approveRecovery(
    params: ApproveRecoveryParams
  ): Promise<ApproveRecoveryResult> {
    try {
      const recoveryRequest = params.recoveryRequest instanceof PublicKey
        ? params.recoveryRequest
        : new PublicKey(params.recoveryRequest);
      
      // Get recovery request to find wallet config
      const recoveryRequestData = await this.getRecoveryRequestByPubkey(recoveryRequest);
      if (!recoveryRequestData) {
        throw new ReKeyError(
          'RECOVERY_NOT_FOUND',
          'Recovery request not found'
        );
      }
      
      const walletConfig = await this.getWalletConfig(recoveryRequestData.walletConfig);
      if (!walletConfig) {
        throw new ReKeyError(
          'ACCOUNT_NOT_FOUND',
          'Wallet configuration not found'
        );
      }
      
      // Check if caller is a guardian
      const isGuardian = walletConfig.guardians.some(g => 
        g.toBase58() === this.wallet.publicKey.toBase58()
      );
      
      if (!isGuardian) {
        throw new ReKeyError(
          'UNAUTHORIZED',
          'Only guardians can approve recovery'
        );
      }
      
      // Check if already approved
      const alreadyApproved = recoveryRequestData.approvals.some(a =>
        a.toBase58() === this.wallet.publicKey.toBase58()
      );
      
      if (alreadyApproved) {
        throw new ReKeyError(
          'DUPLICATE_APPROVAL',
          'Guardian has already approved this request'
        );
      }
      
      // Create transaction
      const tx = new Transaction().add(
        this.program.instruction.approveRecovery({
          accounts: {
            walletConfig: recoveryRequestData.walletConfig,
            recoveryRequest: recoveryRequest,
            guardian: this.wallet.publicKey,
          },
        })
      );
      
      // Send transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        tx,
        [this.wallet]
      );
      
      // Get updated request
      const updatedRequest = await this.getRecoveryRequestByPubkey(recoveryRequest);
      
      return {
        approvalCount: updatedRequest!.approvals.length,
        threshold: walletConfig.threshold,
        transactionSignature: signature,
      };
    } catch (error) {
      throw this.handleError(error, 'approveRecovery');
    }
  }

  // ============================================================================
  // Execute Recovery
  // ============================================================================

  async executeRecovery(
    recoveryRequest: PublicKey | string
  ): Promise<ExecuteRecoveryResult> {
    try {
      const requestPubkey = recoveryRequest instanceof PublicKey
        ? recoveryRequest
        : new PublicKey(recoveryRequest);
      
      // Get recovery request
      const request = await this.getRecoveryRequestByPubkey(requestPubkey);
      if (!request) {
        throw new ReKeyError(
          'RECOVERY_NOT_FOUND',
          'Recovery request not found'
        );
      }
      
      const walletConfig = await this.getWalletConfig(request.walletConfig);
      if (!walletConfig) {
        throw new ReKeyError(
          'ACCOUNT_NOT_FOUND',
          'Wallet configuration not found'
        );
      }
      
      // Check if recovery can be executed
      const now = Date.now() / 1000;
      if (request.status !== 'approved') {
        throw new ReKeyError(
          'INVALID_RECOVERY_STATE',
          `Recovery request is in ${request.status} state, not approved`
        );
      }
      
      if (now < request.executeAfter) {
        throw new ReKeyError(
          'TIMELOCK_ACTIVE',
          `Timelock is still active. Execute after: ${request.executeAfter}`
        );
      }
      
      if (now > request.expiresAt) {
        throw new ReKeyError(
          'RECOVERY_EXPIRED',
          `Recovery request expired at ${request.expiresAt}`
        );
      }
      
      // Check threshold
      if (request.approvals.length < walletConfig.threshold) {
        throw new ReKeyError(
          'THRESHOLD_NOT_MET',
          `Threshold not met: ${request.approvals.length} of ${walletConfig.threshold}`
        );
      }
      
      // Create transaction
      const tx = new Transaction().add(
        this.program.instruction.executeRecovery({
          accounts: {
            walletConfig: request.walletConfig,
            recoveryRequest: requestPubkey,
          },
        })
      );
      
      // Send transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        tx,
        [this.wallet]
      );
      
      // Get updated wallet config to get previous owner
      const updatedConfig = await this.getWalletConfig(request.walletConfig);
      
      return {
        previousOwner: walletConfig.owner,
        newOwner: updatedConfig!.owner,
        transactionSignature: signature,
      };
    } catch (error) {
      throw this.handleError(error, 'executeRecovery');
    }
  }

  // ============================================================================
  // Cancel Recovery
  // ============================================================================

  async cancelRecovery(
    recoveryRequest: PublicKey | string
  ): Promise<CancelRecoveryResult> {
    try {
      const requestPubkey = recoveryRequest instanceof PublicKey
        ? recoveryRequest
        : new PublicKey(recoveryRequest);
      
      // Get recovery request
      const request = await this.getRecoveryRequestByPubkey(requestPubkey);
      if (!request) {
        throw new ReKeyError(
          'RECOVERY_NOT_FOUND',
          'Recovery request not found'
        );
      }
      
      const walletConfig = await this.getWalletConfig(request.walletConfig);
      if (!walletConfig) {
        throw new ReKeyError(
          'ACCOUNT_NOT_FOUND',
          'Wallet configuration not found'
        );
      }
      
      // Check if caller is the owner
      if (walletConfig.owner.toBase58() !== this.wallet.publicKey.toBase58()) {
        throw new ReKeyError(
          'INVALID_OWNER',
          'Only the wallet owner can cancel recovery'
        );
      }
      
      // Check if timelock has elapsed
      const now = Date.now() / 1000;
      if (now >= request.executeAfter) {
        throw new ReKeyError(
          'TIMELOCK_ACTIVE',
          'Cannot cancel after timelock has elapsed'
        );
      }
      
      // Create transaction
      const tx = new Transaction().add(
        this.program.instruction.cancelRecovery({
          accounts: {
            walletConfig: request.walletConfig,
            recoveryRequest: requestPubkey,
            owner: this.wallet.publicKey,
          },
        })
      );
      
      // Send transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        tx,
        [this.wallet]
      );
      
      return {
        transactionSignature: signature,
      };
    } catch (error) {
      throw this.handleError(error, 'cancelRecovery');
    }
  }

  // ============================================================================
  // Withdraw SOL
  // ============================================================================

  async withdrawSol(params: WithdrawSolParams): Promise<WithdrawSolResult> {
    try {
      const recipient = params.recipient instanceof PublicKey
        ? params.recipient
        : new PublicKey(params.recipient);
      
      // Get wallet config
      const walletConfigPDA = await this.findWalletConfigPDA(this.wallet.publicKey);
      const walletConfig = await this.getWalletConfig(walletConfigPDA);
      
      if (!walletConfig) {
        throw new ReKeyError(
          'ACCOUNT_NOT_FOUND',
          'Wallet configuration not found'
        );
      }
      
      // Check if caller is owner
      if (walletConfig.owner.toBase58() !== this.wallet.publicKey.toBase58()) {
        throw new ReKeyError(
          'INVALID_OWNER',
          'Only the wallet owner can withdraw SOL'
        );
      }
      
      // Get vault
      const vaultPDA = await this.findVaultPDA(walletConfigPDA);
      
      // Create transaction
      const tx = new Transaction().add(
        this.program.instruction.withdrawSol(params.amount, {
          accounts: {
            walletConfig: walletConfigPDA,
            vault: vaultPDA,
            owner: this.wallet.publicKey,
            recipient: recipient,
          },
        })
      );
      
      // Send transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        tx,
        [this.wallet]
      );
      
      return {
        transactionSignature: signature,
      };
    } catch (error) {
      throw this.handleError(error, 'withdrawSol');
    }
  }

  // ============================================================================
  // Read-Only Methods
  // ============================================================================

  async getWalletConfig(walletConfig: PublicKey): Promise<WalletConfig | null> {
    try {
      const account = await this.program.account.walletConfig.fetchNullable(
        walletConfig
      );
      
      if (!account) {
        return null;
      }
      
      return {
        pubkey: walletConfig,
        initialOwner: new PublicKey(account.initialOwner),
        owner: new PublicKey(account.owner),
        guardians: account.guardians.map((g: any) => new PublicKey(g)),
        threshold: account.threshold,
        delaySeconds: account.delaySeconds.toNumber(),
        nextNonce: account.nextNonce.toNumber(),
        policyVersion: account.policyVersion.toNumber(),
        bump: account.bump,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('Account does not exist')) {
        return null;
      }
      throw this.handleError(error, 'getWalletConfig');
    }
  }

  async getVault(vault: PublicKey): Promise<Vault | null> {
    try {
      const account = await this.program.account.vault.fetchNullable(vault);
      
      if (!account) {
        return null;
      }
      
      return {
        pubkey: vault,
        walletConfig: new PublicKey(account.walletConfig),
        bump: account.bump,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('Account does not exist')) {
        return null;
      }
      throw this.handleError(error, 'getVault');
    }
  }

  async getRecoveryRequest(
    walletConfig: PublicKey,
    nonce: number
  ): Promise<RecoveryRequest | null> {
    try {
      const requestPDA = await this.findRecoveryRequestPDA(walletConfig, nonce);
      return await this.getRecoveryRequestByPubkey(requestPDA);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Account does not exist')) {
        return null;
      }
      throw this.handleError(error, 'getRecoveryRequest');
    }
  }

  async getRecoveryRequestByPubkey(
    request: PublicKey
  ): Promise<RecoveryRequest | null> {
    try {
      const account = await this.program.account.recoveryRequest.fetchNullable(
        request
      );
      
      if (!account) {
        return null;
      }
      
      return {
        pubkey: request,
        walletConfig: new PublicKey(account.walletConfig),
        newOwner: new PublicKey(account.newOwner),
        nonce: account.nonce.toNumber(),
        policyVersion: account.policyVersion.toNumber(),
        createdAt: account.createdAt.toNumber(),
        executeAfter: account.executeAfter.toNumber(),
        expiresAt: account.expiresAt.toNumber(),
        approvals: account.approvals.map((a: any) => new PublicKey(a)),
        status: account.status as RecoveryStatus,
        bump: account.bump,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('Account does not exist')) {
        return null;
      }
      throw this.handleError(error, 'getRecoveryRequestByPubkey');
    }
  }

  async getAllRecoveryRequests(
    walletConfig: PublicKey
  ): Promise<RecoveryRequest[]> {
    const requests: RecoveryRequest[] = [];
    const walletConfigAccount = await this.getWalletConfig(walletConfig);
    
    if (!walletConfigAccount) {
      return requests;
    }
    
    // Iterate through all possible nonces
    for (let nonce = 0; nonce < walletConfigAccount.nextNonce; nonce++) {
      const request = await this.getRecoveryRequest(walletConfig, nonce);
      if (request) {
        requests.push(request);
      }
    }
    
    return requests;
  }

  // ============================================================================
  // Event Listening
  // ============================================================================

  onEvent(callback: (event: ReKeyEvent) => void): () => void {
    this.eventListeners.add(callback);
    return () => this.eventListeners.delete(callback);
  }

  // ============================================================================
  // Verification
  // ============================================================================

  async verifyTransaction(
    signature: TransactionSignature
  ): Promise<{ success: boolean; error?: string; blockhash?: string; slot?: number }> {
    try {
      const response = await this.connection.getTransaction(signature, {
        commitment: this.config.commitment,
      });
      
      if (!response) {
        return {
          success: false,
          error: 'Transaction not found',
        };
      }
      
      // Check if transaction succeeded
      if (response.meta?.err) {
        return {
          success: false,
          error: JSON.stringify(response.meta.err),
          blockhash: response.transaction.signatures[0],
          slot: response.slot,
        };
      }
      
      return {
        success: true,
        blockhash: response.transaction.signatures[0],
        slot: response.slot,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async verifyAccountState(
    account: PublicKey,
    expected: any
  ): Promise<boolean> {
    try {
      const accountInfo = await this.connection.getAccountInfo(account);
      if (!accountInfo) {
        return false;
      }
      
      // In production, properly deserialize and compare
      // For demo, return true
      return true;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Health Check
  // ============================================================================

  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; message?: string }> {
    try {
      // Check connection
      const version = await this.connection.getVersion();
      
      // Check program
      const programInfo = await this.connection.getAccountInfo(
        this.program.programId
      );
      
      if (!programInfo) {
        return {
          status: 'unhealthy',
          message: 'ReKey program not found',
        };
      }
      
      return {
        status: 'healthy',
        message: `Connected to ${this.connection.rpcEndpoint}`,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Health check failed',
      };
    }
  }

  // ============================================================================
  // Error Handling
  // ============================================================================

  private handleError(error: unknown, method: string): ReKeyError {
    if (error instanceof ReKeyError) {
      return error;
    }
    
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('account does not exist')) {
        return new ReKeyError(
          'ACCOUNT_NOT_FOUND',
          error.message,
          undefined,
          error.stack
        );
      }
      
      if (message.includes('signature')) {
        return new ReKeyError(
          'INVALID_SIGNATURE',
          error.message,
          undefined,
          error.stack
        );
      }
      
      if (message.includes('insufficient funds')) {
        return new ReKeyError(
          'INSUFFICIENT_FUNDS',
          error.message,
          undefined,
          error.stack
        );
      }
      
      if (message.includes('timeout')) {
        return new ReKeyError(
          'TIMEOUT',
          error.message,
          undefined,
          error.stack
        );
      }
      
      return new ReKeyError(
        'INTERNAL_ERROR',
        error.message,
        { method, error: error.stack },
        error.stack
      );
    }
    
    return new ReKeyError(
      'INTERNAL_ERROR',
      String(error),
      { method }
    );
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  getProgramId(): PublicKey {
    return this.program.programId;
  }

  getConnection(): Connection {
    return this.connection;
  }

  getWallet(): Keypair {
    return this.wallet;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createReKeyClient(
  connection: Connection,
  programId: PublicKey,
  wallet: Keypair,
  config: Partial<ReKeyProgramConfig> = {}
): ReKeyClient {
  return new ReKeyClientImpl(connection, programId, wallet, config);
}
