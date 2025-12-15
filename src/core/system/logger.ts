import fs from 'fs';
import path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
}

export class Logger {
  private logs: LogEntry[] = [];
  private currentLevel: LogLevel = 'info';
  private fileEnabled: boolean = false;
  private filePath: string = './logs.txt';
  private readonly MAX_LOGS = 1000;

  private readonly levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    silent: 4
  };

  public setLevel(level: LogLevel): void {
    this.currentLevel = level;
    this.log('info', `Log level set to: ${level}`);
  }

  public getLevel(): LogLevel {
    return this.currentLevel;
  }

  public enableFile(enabled: boolean, filePath?: string): void {
    this.fileEnabled = enabled;
    if (filePath) {
      this.filePath = path.resolve(filePath);
    }
    this.log('info', `File logging ${enabled ? 'enabled' : 'disabled'}: ${this.filePath}`);
  }

  public log(level: LogLevel, message: string): void {
    if (this.levelPriority[level] < this.levelPriority[this.currentLevel]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message
    };

    this.logs.push(entry);

    // Limit memory usage
    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(-this.MAX_LOGS);
    }

    // Console output
    this.outputToConsole(entry);

    // File output
    if (this.fileEnabled) {
      this.outputToFile(entry);
    }
  }

  public getLogs(limit?: number, level?: LogLevel): LogEntry[] {
    let filtered = this.logs;

    if (level) {
      filtered = filtered.filter(log => log.level === level);
    }

    if (limit) {
      filtered = filtered.slice(-limit);
    }

    return filtered;
  }

  public clear(): void {
    this.logs = [];
    this.log('info', 'Logs cleared');
  }

  private outputToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}]`;

    switch (entry.level) {
      case 'error':
        console.error(`${prefix} ${entry.message}`);
        break;
      case 'warn':
        console.warn(`${prefix} ${entry.message}`);
        break;
      case 'debug':
        console.debug(`${prefix} ${entry.message}`);
        break;
      default:
        console.log(`${prefix} ${entry.message}`);
    }
  }

  private outputToFile(entry: LogEntry): void {
    try {
      const timestamp = new Date(entry.timestamp).toISOString();
      const line = `[${timestamp}] [${entry.level.toUpperCase()}] ${entry.message}\n`;
      fs.appendFileSync(this.filePath, line, 'utf-8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }
}
