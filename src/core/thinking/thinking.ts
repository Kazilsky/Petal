import { MemoryMessage, ChatMessage, Platform } from '../ai.types';
import { Logger } from '../system/logger';

export interface ThinkingContext {
  recentMessages: ChatMessage[];
  systemStatus: any;
}

export class ThinkingModule {
  private enabled: boolean = true;
  private interval: number = 60; // seconds
  private timer: NodeJS.Timeout | null = null;
  private chatBuffer: ChatMessage[] = [];
  private readonly MAX_BUFFER_SIZE = 100;
  private readonly logger: Logger;
  private thinkingCallback: ((context: ThinkingContext) => Promise<void>) | null = null;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  public start(): void {
    if (this.timer) {
      this.stop();
    }

    this.enabled = true;
    this.scheduleNextThinking();
    this.logger.log('info', `Thinking module started with ${this.interval}s interval`);
  }

  public stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.enabled = false;
    this.logger.log('info', 'Thinking module stopped');
  }

  public setEnabled(enabled: boolean): void {
    if (enabled && !this.enabled) {
      this.start();
    } else if (!enabled && this.enabled) {
      this.stop();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setInterval(seconds: number): void {
    // Validation: min 10 seconds, max 1 hour
    if (seconds < 10 || seconds > 3600) {
      throw new Error('Interval must be between 10 seconds and 1 hour (3600 seconds)');
    }

    this.interval = seconds;
    this.logger.log('info', `Thinking interval set to ${seconds}s`);

    // Restart if running
    if (this.enabled) {
      this.stop();
      this.start();
    }
  }

  public getInterval(): number {
    return this.interval;
  }

  public addMessage(message: ChatMessage): void {
    this.chatBuffer.push(message);

    // Limit buffer size
    if (this.chatBuffer.length > this.MAX_BUFFER_SIZE) {
      this.chatBuffer = this.chatBuffer.slice(-this.MAX_BUFFER_SIZE);
    }
  }

  public getRecentMessages(limit?: number, filter?: {
    platform?: Platform;
    channelId?: string;
    username?: string;
  }): ChatMessage[] {
    let messages = [...this.chatBuffer];

    // Apply filters
    if (filter) {
      if (filter.platform) {
        messages = messages.filter(msg => msg.platform === filter.platform);
      }
      if (filter.channelId) {
        messages = messages.filter(msg => msg.channelId === filter.channelId);
      }
      if (filter.username) {
        messages = messages.filter(msg => msg.username === filter.username);
      }
    }

    // Apply limit
    if (limit) {
      return messages.slice(-limit);
    }
    return messages;
  }

  public getChannels(): { platform: Platform; channelId: string; channelName?: string; messageCount: number }[] {
    const channelMap = new Map<string, { platform: Platform; channelId: string; channelName?: string; messageCount: number }>();

    for (const msg of this.chatBuffer) {
      const key = `${msg.platform}:${msg.channelId}`;
      const existing = channelMap.get(key);
      if (existing) {
        existing.messageCount++;
      } else {
        channelMap.set(key, {
          platform: msg.platform,
          channelId: msg.channelId,
          channelName: msg.channelName,
          messageCount: 1
        });
      }
    }

    return Array.from(channelMap.values());
  }

  public clearBuffer(): void {
    this.chatBuffer = [];
    this.logger.log('debug', 'Chat buffer cleared');
  }

  public setThinkingCallback(callback: (context: ThinkingContext) => Promise<void>): void {
    this.thinkingCallback = callback;
  }

  public getStatus(): any {
    return {
      enabled: this.enabled,
      interval: this.interval,
      bufferSize: this.chatBuffer.length,
      nextThinking: this.timer ? 'scheduled' : 'not scheduled'
    };
  }

  private scheduleNextThinking(): void {
    if (!this.enabled) return;

    this.timer = setTimeout(async () => {
      await this.performThinking();
      this.scheduleNextThinking();
    }, this.interval * 1000);
  }

  private async performThinking(): Promise<void> {
    try {
      this.logger.log('debug', 'Performing thinking cycle...');

      if (this.thinkingCallback) {
        const context: ThinkingContext = {
          recentMessages: this.getRecentMessages(20),
          systemStatus: {
            bufferSize: this.chatBuffer.length,
            timestamp: Date.now()
          }
        };

        await this.thinkingCallback(context);
      }

      this.logger.log('debug', 'Thinking cycle completed');
    } catch (error) {
      this.logger.log('error', `Thinking cycle error: ${error}`);
    }
  }
}
