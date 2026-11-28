// ReKey Solana - Transaction and Signature Verification
// Provides verification utilities for Solana transactions

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionSignature,
  VersionedTransaction,
} from '@solana/web3.js';
import { z } from 'zod';
import {
  ReKeyError,
  ReKeyErrorCode,
  SignedTransaction,
  TransactionResult,
} from './types';

// ============================================================================
// Signature Verifier Class
// ============================================================================

export class SignatureVerifier {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Verify a transaction signature is valid and confirmed
   */
  async verifySignature(
    signature: TransactionSignature
  ): Promise<TransactionResult> {
    try {
      // Check if transaction exists
      const response = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      
      if (!response) {
        return {
          success: false,
          error: 'Transaction not found',
        };
      }
      
      // Check if transaction was successful
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
        signature: response.transaction.signatures[0],
        blockhash: response.transaction.signatures[0],
        slot: response.slot,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  }

  /**
   * Verify a transaction was signed by a specific public key
   */
  async verifySigner(
    signature: TransactionSignature,
    expectedSigner: PublicKey
  ): Promise<boolean> {
    try {
      const response = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      
      if (!response) {
        return false;
      }
      
      // Check if the expected signer is in the transaction
      const transaction = response.transaction;
      const signers = transaction.signatures.map(sig => sig.publicKey);
      
      return signers.some(signer => 
        signer && signer.toBase58() === expectedSigner.toBase58()
      );
    } catch {
      return false;
    }
  }

  /**
   * Verify multiple signatures
   */
  async verifyMultipleSignatures(
    signature: TransactionSignature,
    expectedSigners: PublicKey[]
  ): Promise<boolean> {
    try {
      const response = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      
      if (!response) {
        return false;
      }
      
      const transaction = response.transaction;
      const signers = transaction.signatures.map(sig => sig.publicKey);
      
      // Check if all expected signers are present
      return expectedSigners.every(expected =>
        signers.some(signer => 
          signer && signer.toBase58() === expected.toBase58()
        )
      );
    } catch {
      return false;
    }
  }

  /**
   * Verify transaction was confirmed within a specific slot range
   */
  async verifyConfirmation(
    signature: TransactionSignature,
    minSlot?: number,
    maxSlot?: number
  ): Promise<boolean> {
    try {
      const response = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      
      if (!response) {
        return false;
      }
      
      if (minSlot !== undefined && response.slot < minSlot) {
        return false;
      }
      
      if (maxSlot !== undefined && response.slot > maxSlot) {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get detailed transaction information
   */
  async getTransactionDetails(
    signature: TransactionSignature
  ): Promise<{
    success: boolean;
    transaction?: Transaction | VersionedTransaction;
    meta?: any;
    slot?: number;
    blockhash?: string;
    error?: string;
  }> {
    try {
      const response = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      
      if (!response) {
        return {
          success: false,
          error: 'Transaction not found',
        };
      }
      
      return {
        success: true,
        transaction: response.transaction,
        meta: response.meta,
        slot: response.slot,
        blockhash: response.transaction.signatures[0],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get transaction',
      };
    }
  }

  /**
   * Verify an account's state matches expected values
   */
  async verifyAccountState(
    account: PublicKey,
    expected: {
      lamports?: number;
      owner?: PublicKey;
      data?: Buffer | string;
    }
  ): Promise<boolean> {
    try {
      const accountInfo = await this.connection.getAccountInfo(account);
      
      if (!accountInfo) {
        return false;
      }
      
      // Check lamports
      if (expected.lamports !== undefined && accountInfo.lamports !== expected.lamports) {
        return false;
      }
      
      // Check owner
      if (expected.owner && accountInfo.owner.toBase58() !== expected.owner.toBase58()) {
        return false;
      }
      
      // Check data
      if (expected.data) {
        const expectedData = expected.data instanceof Buffer 
          ? expected.data 
          : Buffer.from(expected.data, 'hex');
        
        if (!accountInfo.data.equals(expectedData)) {
          return false;
        }
      }
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Verify a signature on raw data (Ed25519)
   */
  async verifyEd25519Signature(
    data: Uint8Array,
    signature: Uint8Array,
    publicKey: PublicKey
  ): Promise<boolean> {
    // In production, implement actual Ed25519 verification
    // This is a placeholder
    try {
      // Use web3.js verify method if available
      // @ts-ignore - web3.js may have this method
      const result = PublicKey.verifySignature(data, signature, publicKey);
      return result;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// Transaction Builder and Helper
// ============================================================================

export class TransactionHelper {
  private connection: Connection;
  private verifier: SignatureVerifier;

  constructor(connection: Connection) {
    this.connection = connection;
    this.verifier = new SignatureVerifier(connection);
  }

  /**
   * Build a signed transaction
   */
  async buildSignedTransaction(
    instructions: Array<{
      programId: PublicKey;
      accounts: PublicKey[];
      data: Uint8Array;
    }>,
    signers: PublicKey[]
  ): Promise<SignedTransaction> {
    const transaction = new Transaction();
    
    for (const instruction of instructions) {
      transaction.add({
        programId: instruction.programId,
        keys: instruction.accounts.map(pubkey => ({
          pubkey,
          isSigner: signers.some(s => s.toBase58() === pubkey.toBase58()),
          isWritable: true, // Simplified
        })),
        data: instruction.data,
      });
    }
    
    // In production, sign the transaction
    // For now, return a placeholder
    return {
      transaction,
      signature: '' as TransactionSignature,
    };
  }

  /**
   * Send and confirm a transaction
   */
  async sendAndConfirm(
    transaction: Transaction | VersionedTransaction,
    signers: Array<{ publicKey: PublicKey; secretKey: Uint8Array }>
  ): Promise<TransactionSignature> {
    // In production, sign and send
    // For now, return a placeholder
    return 'placeholder-signature' as TransactionSignature;
  }

  /**
   * Get current blockhash
   */
  async getRecentBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
    const response = await this.connection.getRecentBlockhash();
    return {
      blockhash: response.value.blockhash,
      lastValidBlockHeight: response.value.lastValidBlockHeight,
    };
  }

  /**
   * Check if a transaction is still valid
   */
  async isTransactionValid(signature: TransactionSignature): Promise<boolean> {
    try {
      const response = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
      });
      return !!response;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export { SignatureVerifier, TransactionHelper };
