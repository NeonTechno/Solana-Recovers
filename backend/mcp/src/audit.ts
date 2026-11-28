// ReKey MCP Server - Audit Logging
// Provides comprehensive audit logging for security and compliance

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { AuditLogEntry, AuditLogFilter, AuditLogger } from './types';

// ============================================================================
// Configuration
// ============================================================================

export interface AuditConfig {
  logPath: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableConsole: boolean;
  maxFileSize: number; // bytes
  maxFiles: number;
  includeIpAddress: boolean;
}

const DEFAULT_AUDIT_CONFIG: AuditConfig = {
  logPath: process.env.AUDIT_LOG_PATH || './logs/audit.log',
  logLevel: (process.env.AUDIT_LOG_LEVEL as any) || 'info',
  enableConsole: process.env.AUDIT_CONSOLE !== 'false',
  maxFileSize: 10 * 1024 * 1024, // 10 MB
  maxFiles: 5,
  includeIpAddress: true,
};

// ============================================================================
// File-based Audit Logger
// ============================================================================

export class FileAuditLogger implements AuditLogger {
  private config: AuditConfig;
  private queue: AuditLogEntry[] = [];
  private isWriting: boolean = false;

  constructor(config: Partial<AuditConfig> = {}) {
    this.config = { ...DEFAULT_AUDIT_CONFIG, ...config };
    
    // Ensure log directory exists
    this.ensureDirectory();
    
    // Start processing queue
    this.processQueue();
  }

  private ensureDirectory(): void {
    const dir = path.dirname(this.config.logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private async processQueue(): Promise<void> {
    if (this.queue.length === 0 || this.isWriting) {
      return;
    }

    this.isWriting = true;
    const entry = this.queue.shift()!;

    try {
      await this.writeEntry(entry);
    } catch (error) {
      // Log to console if file writing fails
      if (this.config.enableConsole) {
        console.error('Failed to write audit log:', error);
      }
    } finally {
      this.isWriting = false;
      // Process next entry
      setImmediate(() => this.processQueue());
    }
  }

  private async writeEntry(entry: AuditLogEntry): Promise<void> {
    const logLine = this.formatEntry(entry);
    
    // Check if we need to rotate logs
    await this.checkRotation();
    
    // Append to file
    await fs.promises.appendFile(this.config.logPath, logLine + '\n', 'utf-8');
    
    // Also log to console if enabled
    if (this.config.enableConsole && this.shouldLogToConsole(entry.level)) {
      const consoleMethod = this.getConsoleMethod(entry.level);
      consoleMethod(logLine);
    }
  }

  private shouldLogToConsole(level: 'info' | 'warn' | 'error'): boolean {
    const levels: Record<'info' | 'warn' | 'error', number> = {
      info: 0,
      warn: 1,
      error: 2,
    };
    const configLevels: Record<'debug' | 'info' | 'warn' | 'error', number> = {
      debug: -1,
      info: 0,
      warn: 1,
      error: 2,
    };

    return levels[level] >= configLevels[this.config.logLevel];
  }

  private getConsoleMethod(level: 'info' | 'warn' | 'error'): (...args: any[]) => void {
    switch (level) {
      case 'info': return console.log;
      case 'warn': return console.warn;
      case 'error': return console.error;
      default: return console.log;
    }
  }

  private formatEntry(entry: AuditLogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const level = entry.level.toUpperCase().padEnd(7);
    const action = entry.action.padEnd(30);
    const tool = entry.tool.padEnd(20);
    
    const userId = entry.userId ? `user=${entry.userId}` : '';
    const wallet = entry.walletAddress ? `wallet=${entry.walletAddress}` : '';
    const requestId = entry.requestId ? `req=${entry.requestId}` : '';
    const session = `session=${entry.sessionId}`;
    
    const contextParts = [userId, wallet, requestId, session].filter(Boolean);
    const context = contextParts.length > 0 ? ` [${contextParts.join(' ')}]` : '';
    
    const input = entry.input ? ` in=${JSON.stringify(entry.input).slice(0, 100)}` : '';
    const output = entry.output ? ` out=${JSON.stringify(entry.output).slice(0, 100)}` : '';
    const error = entry.error ? ` err=${entry.error.slice(0, 100)}` : '';
    
    return `${timestamp} ${level} ${action} ${tool}${context}${input}${output}${error}`;
  }

  private async checkRotation(): Promise<void> {
    try {
      if (!fs.existsSync(this.config.logPath)) {
        return;
      }

      const stats = await fs.promises.stat(this.config.logPath);
      
      if (stats.size >= this.config.maxFileSize) {
        await this.rotateLogs();
      }
    } catch {
      // Ignore rotation errors
    }
  }

  private async rotateLogs(): Promise<void> {
    const logPath = this.config.logPath;
    const baseName = path.basename(logPath, '.log');
    const dir = path.dirname(logPath);
    
    // Find all rotated logs
    const files = await fs.promises.readdir(dir);
    const rotatedLogs = files
      .filter(f => f.startsWith(baseName + '.') && f.endsWith('.log'))
      .sort((a, b) => {
        // Extract number from filename
        const numA = parseInt(a.match(/\.(\d+)\.log$/)?.[1] || '0');
        const numB = parseInt(b.match(/\.(\d+)\.log$/)?.[1] || '0');
        return numA - numB;
      });
    
    // If we have too many rotated logs, delete the oldest
    while (rotatedLogs.length >= this.config.maxFiles) {
      const oldest = rotatedLogs.shift()!;
      await fs.promises.unlink(path.join(dir, oldest));
    }
    
    // Rename current log to rotated
    const newName = `${baseName}.${Date.now()}.log`;
    await fs.promises.rename(
      logPath,
      path.join(dir, newName)
    );
  }

  /**
   * Log an audit entry
   */
  async log(entry: AuditLogEntry): Promise<void> {
    // Add default values
    const completeEntry: AuditLogEntry = {
      id: entry.id || crypto.randomUUID(),
      timestamp: entry.timestamp || Date.now(),
      level: entry.level || 'info',
      action: entry.action,
      tool: entry.tool,
      userId: entry.userId,
      walletAddress: entry.walletAddress,
      requestId: entry.requestId,
      input: entry.input,
      output: entry.output,
      error: entry.error,
      ipAddress: entry.ipAddress,
      sessionId: entry.sessionId || crypto.randomUUID(),
    };

    // Add to queue
    this.queue.push(completeEntry);
    
    // Process queue
    this.processQueue();
  }

  /**
   * Query audit logs
   */
  async query(filter: AuditLogFilter): Promise<AuditLogEntry[]> {
    const entries: AuditLogEntry[] = [];
    
    try {
      if (!fs.existsSync(this.config.logPath)) {
        return entries;
      }

      const content = await fs.promises.readFile(this.config.logPath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      
      for (const line of lines) {
        const entry = this.parseLogLine(line);
        if (entry && this.matchesFilter(entry, filter)) {
          entries.push(entry);
        }
      }
    } catch {
      // Return empty array if we can't read logs
    }

    // Sort by timestamp descending
    return entries.sort((a, b) => b.timestamp - a.timestamp);
  }

  private parseLogLine(line: string): AuditLogEntry | null {
    // Parse the log line format
    const match = line.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s*\[?([^\]]*)\]?\s*(.*)$/);
    
    if (!match) {
      return null;
    }

    const [, timestampStr, level, action, tool, contextStr, rest] = match;
    
    // Parse timestamp
    let timestamp: number;
    try {
      timestamp = new Date(timestampStr).getTime();
    } catch {
      return null;
    }

    // Parse context
    const context: Record<string, string> = {};
    if (contextStr) {
      for (const part of contextStr.split(' ')) {
        const [key, value] = part.split('=');
        if (key && value) {
          context[key] = value;
        }
      }
    }

    // Extract input/output/error from rest
    const parts: Record<string, string> = {};
    for (const segment of rest.split(' ')) {
      if (segment.startsWith('in=')) {
        parts.in = segment.substring(3);
      } else if (segment.startsWith('out=')) {
        parts.out = segment.substring(4);
      } else if (segment.startsWith('err=')) {
        parts.err = segment.substring(4);
      }
    }

    // Try to parse input/output
    let input: any = undefined;
    let output: any = undefined;
    let error: string | undefined = undefined;

    try {
      if (parts.in) {
        input = JSON.parse(parts.in);
      }
      if (parts.out) {
        output = JSON.parse(parts.out);
      }
      error = parts.err;
    } catch {
      // Keep as strings if parsing fails
    }

    return {
      id: crypto.randomUUID(), // We don't store the original ID
      timestamp,
      level: level as 'info' | 'warn' | 'error',
      action,
      tool,
      userId: context.user,
      walletAddress: context.wallet,
      requestId: context.req,
      input,
      output,
      error,
      ipAddress: context.ip,
      sessionId: context.session || crypto.randomUUID(),
    };
  }

  private matchesFilter(entry: AuditLogEntry, filter: AuditLogFilter): boolean {
    if (filter.startTime && entry.timestamp < filter.startTime) {
      return false;
    }
    if (filter.endTime && entry.timestamp > filter.endTime) {
      return false;
    }
    if (filter.level && entry.level !== filter.level) {
      return false;
    }
    if (filter.action && entry.action !== filter.action) {
      return false;
    }
    if (filter.tool && entry.tool !== filter.tool) {
      return false;
    }
    if (filter.userId && entry.userId !== filter.userId) {
      return false;
    }
    if (filter.walletAddress && entry.walletAddress !== filter.walletAddress) {
      return false;
    }

    return true;
  }
}

// ============================================================================
// Console-only Audit Logger (for development)
// ============================================================================

export class ConsoleAuditLogger implements AuditLogger {
  private config: Omit<AuditConfig, 'logPath' | 'maxFileSize' | 'maxFiles'>;

  constructor(config: Partial<AuditConfig> = {}) {
    this.config = {
      logLevel: 'info',
      enableConsole: true,
      includeIpAddress: true,
      ...config,
    };
  }

  async log(entry: AuditLogEntry): Promise<void> {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    const logLine = this.formatEntry(entry);
    const consoleMethod = this.getConsoleMethod(entry.level);
    consoleMethod(logLine);
  }

  private shouldLog(level: 'info' | 'warn' | 'error'): boolean {
    const levels: Record<'info' | 'warn' | 'error', number> = {
      info: 0,
      warn: 1,
      error: 2,
    };
    const configLevels: Record<'debug' | 'info' | 'warn' | 'error', number> = {
      debug: -1,
      info: 0,
      warn: 1,
      error: 2,
    };

    return levels[level] >= configLevels[this.config.logLevel];
  }

  private getConsoleMethod(level: 'info' | 'warn' | 'error'): (...args: any[]) => void {
    switch (level) {
      case 'info': return console.log;
      case 'warn': return console.warn;
      case 'error': return console.error;
      default: return console.log;
    }
  }

  private formatEntry(entry: AuditLogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const level = entry.level.toUpperCase().padEnd(7);
    const action = entry.action.padEnd(30);
    const tool = entry.tool.padEnd(20);
    
    const userId = entry.userId ? `user=${entry.userId}` : '';
    const wallet = entry.walletAddress ? `wallet=${entry.walletAddress}` : '';
    const requestId = entry.requestId ? `req=${entry.requestId}` : '';
    const session = `session=${entry.sessionId}`;
    
    const contextParts = [userId, wallet, requestId, session].filter(Boolean);
    const context = contextParts.length > 0 ? ` [${contextParts.join(' ')}]` : '';
    
    const input = entry.input ? ` in=${JSON.stringify(entry.input).slice(0, 100)}` : '';
    const output = entry.output ? ` out=${JSON.stringify(entry.output).slice(0, 100)}` : '';
    const error = entry.error ? ` err=${entry.error.slice(0, 100)}` : '';
    
    return `[AUDIT] ${timestamp} ${level} ${action} ${tool}${context}${input}${output}${error}`;
  }

  async query(filter: AuditLogFilter): Promise<AuditLogEntry[]> {
    // Console logger doesn't support querying
    return [];
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createAuditLogger(config: Partial<AuditConfig> = {}): AuditLogger {
  // Use console logger in development
  if (process.env.NODE_ENV === 'development' && !config.logPath) {
    return new ConsoleAuditLogger(config);
  }

  return new FileAuditLogger(config);
}
