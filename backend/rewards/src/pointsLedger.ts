// ReKey Lifeline Rewards - Points Ledger
// Manages points earning, spending, and history

import {
  RewardsConfig,
  PointsEntry,
  PointsBalance,
  TransactionHistory,
  RewardsError,
  RewardsErrorCode,
} from './types';

// ============================================================================
// Points Ledger Class
// ============================================================================

export class PointsLedger {
  private config: RewardsConfig;
  private balances: Map<string, PointsBalance>;
  private history: Map<string, PointsEntry[]>;
  private nextEntryId: number = 0;

  constructor(config: RewardsConfig) {
    this.config = config;
    this.balances = new Map();
    this.history = new Map();
  }

  // ============================================================================
  // Points Operations
  // ============================================================================

  /**
   * Earn points (add to balance)
   */
  async earn(
    walletAddress: string,
    amount: number,
    source: string,
    transactionId?: string,
    description: string = ''
  ): Promise<PointsEntry> {
    if (amount <= 0) {
      throw new RewardsError(
        'INVALID_INPUT',
        'Earn amount must be positive'
      );
    }
    
    const entry = await this.createEntry(
      walletAddress,
      amount,
      'earn',
      source,
      transactionId,
      description
    );
    
    return entry;
  }

  /**
   * Spend points (deduct from balance)
   * Note: Points are non-transferable, so spend is limited
   */
  async spend(
    walletAddress: string,
    amount: number,
    purpose: string,
    transactionId?: string
  ): Promise<PointsEntry> {
    if (amount <= 0) {
      throw new RewardsError(
        'INVALID_INPUT',
        'Spend amount must be positive'
      );
    }
    
    const balance = await this.getBalance(walletAddress);
    if (balance.availablePoints < amount) {
      throw new RewardsError(
        'INSUFFICIENT_POINTS',
        `Insufficient points. Available: ${balance.availablePoints}, Required: ${amount}`
      );
    }
    
    const entry = await this.createEntry(
      walletAddress,
      -amount,
      'spend',
      purpose,
      transactionId
    );
    
    return entry;
  }

  /**
   * Create a points entry
   */
  async createEntry(
    walletAddress: string,
    amount: number,
    type: 'earn' | 'spend' | 'bonus' | 'penalty',
    source: string,
    transactionId?: string,
    description: string = ''
  ): Promise<PointsEntry> {
    const entry: PointsEntry = {
      id: `entry-${++this.nextEntryId}`,
      walletAddress,
      amount,
      type,
      source,
      timestamp: Date.now(),
      transactionId,
      description,
    };
    
    // Update balance
    await this.updateBalance(entry);
    
    // Store in history
    await this.addToHistory(entry);
    
    return entry;
  }

  /**
   * Update wallet balance based on entry
   */
  private async updateBalance(entry: PointsEntry): Promise<void> {
    let balance = this.balances.get(entry.walletAddress);
    
    if (!balance) {
      balance = {
        walletAddress: entry.walletAddress,
        totalPoints: 0,
        availablePoints: 0,
        lockedPoints: 0,
        lastUpdated: Date.now(),
      };
    }
    
    // Update totals
    balance.totalPoints += entry.amount;
    
    if (entry.amount > 0) {
      balance.availablePoints += entry.amount;
    } else {
      balance.availablePoints += entry.amount; // Subtract (amount is negative)
    }
    
    // Ensure no negative balances
    balance.availablePoints = Math.max(0, balance.availablePoints);
    
    // Enforce max points per wallet (anti-Sybil)
    balance.totalPoints = Math.min(
      balance.totalPoints,
      this.config.antiSybil.maxPointsPerWallet
    );
    
    balance.lastUpdated = Date.now();
    
    this.balances.set(entry.walletAddress, balance);
  }

  /**
   * Add entry to transaction history
   */
  private async addToHistory(entry: PointsEntry): Promise<void> {
    if (!this.history.has(entry.walletAddress)) {
      this.history.set(entry.walletAddress, []);
    }
    
    const entries = this.history.get(entry.walletAddress)!;
    entries.push(entry);
    
    // Keep history manageable (last 1000 entries)
    if (entries.length > 1000) {
      entries.shift();
    }
  }

  // ============================================================================
  // Query Methods
  // ============================================================================

  /**
   * Get points balance for a wallet
   */
  async getBalance(walletAddress: string): Promise<PointsBalance> {
    let balance = this.balances.get(walletAddress);
    
    if (!balance) {
      balance = {
        walletAddress,
        totalPoints: 0,
        availablePoints: 0,
        lockedPoints: 0,
        lastUpdated: Date.now(),
      };
      this.balances.set(walletAddress, balance);
    }
    
    return { ...balance };
  }

  /**
   * Get transaction history for a wallet
   */
  async getHistory(
    walletAddress: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<TransactionHistory> {
    const entries = this.history.get(walletAddress) || [];
    const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);
    const paginated = sorted.slice(offset, offset + limit);
    
    return {
      walletAddress,
      transactions: paginated,
      total: sorted.length,
      limit,
      offset,
    };
  }

  /**
   * Get recent transactions
   */
  async getRecentTransactions(
    walletAddress: string,
    count: number = 10
  ): Promise<PointsEntry[]> {
    const entries = this.history.get(walletAddress) || [];
    const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);
    return sorted.slice(0, count);
  }

  // ============================================================================
  // Data Export/Import
  // ============================================================================

  exportData(): {
    balances: Map<string, PointsBalance>;
    history: Map<string, PointsEntry[]>;
  } {
    return {
      balances: this.balances,
      history: this.history,
    };
  }

  importData(data: {
    balances: Map<string, PointsBalance>;
    history: Map<string, PointsEntry[]>;
  }): void {
    this.balances = new Map(data.balances);
    this.history = new Map(data.history);
    
    // Update next entry ID
    for (const entries of this.history.values()) {
      for (const entry of entries) {
        const idNum = parseInt(entry.id.replace('entry-', '') || '0');
        if (idNum >= this.nextEntryId) {
          this.nextEntryId = idNum + 1;
        }
      }
    }
  }
}
