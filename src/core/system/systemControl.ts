import fs from 'fs';
import path from 'path';
import { Logger, LogLevel } from './logger';

export type ResponseMode = 'ai_decides' | 'mention_only' | 'always_respond';

export interface SystemConfig {
  responseMode: ResponseMode;
  thinkingEnabled: boolean;
  thinkingInterval: number; // in seconds
  logLevel: LogLevel;
  logFileEnabled: boolean;
  logFilePath: string;
}

export class SystemControl {
  private config: SystemConfig;
  private readonly logger: Logger;
  private readonly CONFIG_FILE = path.resolve('./system_config.json');

  constructor(logger: Logger) {
    this.logger = logger;
    this.config = this.loadConfig();
    this.applyConfig();
  }

  public getConfig(): SystemConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<SystemConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
    this.applyConfig();
    this.logger.log('info', `Config updated: ${JSON.stringify(updates)}`);
  }

  public getResponseMode(): ResponseMode {
    return this.config.responseMode;
  }

  public setResponseMode(mode: ResponseMode): void {
    this.config.responseMode = mode;
    this.saveConfig();
    this.logger.log('info', `Response mode set to: ${mode}`);
  }

  public getLogger(): Logger {
    return this.logger;
  }

  public getStatus(): any {
    return {
      config: this.config,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: Date.now()
    };
  }

  public readSourceFile(filePath: string): string {
    // Security: only allow reading from src/ directory
    const srcDir = path.resolve('./src');
    const normalizedPath = path.normalize(filePath);
    
    // Prevent directory traversal
    if (normalizedPath.includes('..')) {
      throw new Error('Path traversal not allowed');
    }
    
    const requestedPath = path.join(srcDir, normalizedPath);

    // Double check it's still within src/
    if (!requestedPath.startsWith(srcDir)) {
      throw new Error('Access denied: Can only read files from src/ directory');
    }

    if (!fs.existsSync(requestedPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stats = fs.statSync(requestedPath);
    if (!stats.isFile()) {
      throw new Error(`Not a file: ${filePath}`);
    }

    return fs.readFileSync(requestedPath, 'utf-8');
  }

  public listFiles(directory: string): string[] {
    // Security: only allow listing from src/ directory
    const srcDir = path.resolve('./src');
    const normalizedPath = path.normalize(directory);
    
    // Prevent directory traversal
    if (normalizedPath.includes('..')) {
      throw new Error('Path traversal not allowed');
    }
    
    const requestedPath = path.join(srcDir, normalizedPath);

    // Double check it's still within src/
    if (!requestedPath.startsWith(srcDir)) {
      throw new Error('Access denied: Can only list files from src/ directory');
    }

    if (!fs.existsSync(requestedPath)) {
      throw new Error(`Directory not found: ${directory}`);
    }

    const stats = fs.statSync(requestedPath);
    if (!stats.isDirectory()) {
      throw new Error(`Not a directory: ${directory}`);
    }

    return fs.readdirSync(requestedPath);
  }

  private loadConfig(): SystemConfig {
    const defaultConfig: SystemConfig = {
      responseMode: 'ai_decides',
      thinkingEnabled: true,
      thinkingInterval: 60, // 1 minute
      logLevel: 'info',
      logFileEnabled: false,
      logFilePath: './logs.txt'
    };

    try {
      if (fs.existsSync(this.CONFIG_FILE)) {
        const data = fs.readFileSync(this.CONFIG_FILE, 'utf-8');
        const loaded = JSON.parse(data);
        return { ...defaultConfig, ...loaded };
      }
    } catch (error) {
      console.error('Failed to load config, using defaults:', error);
    }

    return defaultConfig;
  }

  private saveConfig(): void {
    try {
      fs.writeFileSync(this.CONFIG_FILE, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  private applyConfig(): void {
    this.logger.setLevel(this.config.logLevel);
    this.logger.enableFile(this.config.logFileEnabled, this.config.logFilePath);
  }
}
