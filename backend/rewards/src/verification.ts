// ReKey Lifeline Rewards - Verification System
// Manages verification requests and proofs

import crypto from 'crypto';
import {
  VerificationRequest,
  VerificationProof,
  RewardsError,
  RewardsErrorCode,
} from './types';

// ============================================================================
// Verification System Class
// ============================================================================

export class VerificationSystem {
  private requests: Map<string, VerificationRequest>;
  private proofs: Map<string, VerificationProof[]>;
  private nextRequestId: number = 0;

  constructor() {
    this.requests = new Map();
    this.proofs = new Map();
  }

  // ============================================================================
  // Verification Requests
  // ============================================================================

  /**
   * Submit a new verification request
   */
  async submitRequest(
    walletAddress: string,
    verificationType: 'guardian' | 'contribution' | 'identity',
    data: Record<string, any>
  ): Promise<VerificationRequest> {
    const request: VerificationRequest = {
      id: `verify-${++this.nextRequestId}`,
      walletAddress,
      type: verificationType,
      data,
      status: 'pending',
      submittedAt: Date.now(),
    };
    
    this.requests.set(request.id, request);
    
    return { ...request };
  }

  /**
   * Get a verification request by ID
   */
  async getRequest(requestId: string): Promise<VerificationRequest> {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new RewardsError(
        'NOT_FOUND',
        `Verification request '${requestId}' not found`
      );
    }
    return { ...request };
  }

  /**
   * Get all requests for a wallet
   */
  async getRequestsForWallet(walletAddress: string): Promise<VerificationRequest[]> {
    const allRequests = Array.from(this.requests.values());
    return allRequests.filter(r => r.walletAddress === walletAddress);
  }

  /**
   * Review and approve/reject a verification request
   */
  async reviewRequest(
    requestId: string,
    approved: boolean,
    reviewer: string,
    notes?: string
  ): Promise<VerificationRequest> {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new RewardsError(
        'NOT_FOUND',
        `Verification request '${requestId}' not found`
      );
    }
    
    if (request.status !== 'pending') {
      throw new RewardsError(
        'INVALID_OPERATION',
        `Request is already ${request.status}`
      );
    }
    
    request.status = approved ? 'approved' : 'rejected';
    request.reviewedAt = Date.now();
    request.reviewedBy = reviewer;
    request.notes = notes;
    
    // If approved, create proof
    if (approved) {
      const proof: VerificationProof = {
        id: `proof-${crypto.randomUUID()}`,
        walletAddress: request.walletAddress,
        verificationType: request.type,
        proofData: this.generateProofData(request),
        verifiedAt: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
      };
      
      if (!this.proofs.has(request.walletAddress)) {
        this.proofs.set(request.walletAddress, []);
      }
      this.proofs.get(request.walletAddress)!.push(proof);
    }
    
    return { ...request };
  }

  /**
   * Generate proof data for a verification
   */
  private generateProofData(request: VerificationRequest): string {
    // In production, generate a cryptographic proof
    // For demo, return a simple hash
    const data = {
      requestId: request.id,
      walletAddress: request.walletAddress,
      type: request.type,
      timestamp: Date.now(),
    };
    
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');
  }

  // ============================================================================
  // Verification Proofs
  // ============================================================================

  /**
   * Get verification proofs for a wallet
   */
  async getProofs(walletAddress: string): Promise<VerificationProof[]> {
    return this.proofs.get(walletAddress) || [];
  }

  /**
   * Get a specific proof
   */
  async getProof(proofId: string): Promise<VerificationProof | null> {
    for (const proofs of this.proofs.values()) {
      const proof = proofs.find(p => p.id === proofId);
      if (proof) return { ...proof };
    }
    return null;
  }

  /**
   * Check if a wallet has a valid proof for a verification type
   */
  async hasValidProof(
    walletAddress: string,
    verificationType: string
  ): Promise<boolean> {
    const proofs = this.proofs.get(walletAddress) || [];
    const now = Date.now();
    
    return proofs.some(p => 
      p.verificationType === verificationType &&
      (!p.expiresAt || p.expiresAt > now)
    );
  }

  // ============================================================================
  // Pending Requests
  // ============================================================================

  /**
   * Get all pending verification requests
   */
  async getPendingRequests(): Promise<VerificationRequest[]> {
    const allRequests = Array.from(this.requests.values());
    return allRequests.filter(r => r.status === 'pending');
  }

  /**
   * Get pending requests count
   */
  async getPendingCount(): Promise<number> {
    return Array.from(this.requests.values())
      .filter(r => r.status === 'pending')
      .length;
  }

  // ============================================================================
  // Data Export/Import
  // ============================================================================

  exportData(): {
    requests: Map<string, VerificationRequest>;
    proofs: Map<string, VerificationProof[]>;
  } {
    return {
      requests: this.requests,
      proofs: this.proofs,
    };
  }

  importData(data: {
    requests: Map<string, VerificationRequest>;
    proofs: Map<string, VerificationProof[]>;
  }): void {
    this.requests = new Map(data.requests);
    this.proofs = new Map(data.proofs);
    
    // Update next request ID
    for (const request of this.requests.values()) {
      const idNum = parseInt(request.id.replace('verify-', '') || '0');
      if (idNum >= this.nextRequestId) {
        this.nextRequestId = idNum + 1;
      }
    }
  }
}
