/**
 * @module ThinkingModule
 * @description Модуль саморефлексии AI с расширенным временным контекстом
 */

import { ChatMessage, ChatStats, MemoryMessage, SystemStatus } from "../ai.types";

/**
 * @class ThinkingModule
 * @description Модуль мышления и саморефлексии Петал
 */
export class ThinkingModule {
  private chatBuffer: ChatMessage[] = [];
  private isEnabled: boolean = false;
  private thinkingInterval: NodeJS.Timeout | null = null;
  private readonly thinkingIntervalMs: number;
  private readonly startTime: number;

  constructor(thinkingIntervalMs: number = 300000) {
    this.thinkingIntervalMs = thinkingIntervalMs;
    this.startTime = Date.now();
  }

  /**
   * Включает режим мышления
   */
  public enable(): void {
    if (this.isEnabled) return;
    this.isEnabled = true;
    console.log('[THINKING] Dream mode enabled');
  }

  /**
   * Выключает режим мышления
   */
  public disable(): void {
    if (!this.isEnabled) return;
    this.isEnabled = false;
    if (this.thinkingInterval) {
      clearInterval(this.thinkingInterval);
      this.thinkingInterval = null;
    }
    console.log('[THINKING] Dream mode disabled');
  }

  /**
   * Возвращает статус модуля мышления
   */
  public getStatus(): boolean {
    return this.isEnabled;
  }

  /**
   * Добавляет сообщение в буфер чата
   */
  public addMessage(
    content: string,
    username: string,
    channelId: string,
    platform: 'discord' | 'telegram' | 'api' = 'discord'
  ): void {
    const timestamp = Date.now();
    const message: ChatMessage = {
      content,
      username,
      channelId,
      platform,
      timestamp,
      formattedTime: this.formatTime(timestamp),
      relativeTime: this.getRelativeTime(timestamp)
    };

    this.chatBuffer.push(message);

    // Ограничиваем буфер до 200 сообщений
    if (this.chatBuffer.length > 200) {
      this.chatBuffer = this.chatBuffer.slice(-200);
    }
  }

  /**
   * Форматирует временную метку в строку вида "14:35:22"
   */
  private formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  /**
   * Возвращает относительное время (например "2 мин назад")
   */
  public getRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return `${Math.floor(diff / 1000)} сек назад`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;
    return `${Math.floor(diff / 86400000)} дн назад`;
  }

  /**
   * Вычисляет статистику чата
   */
  private calculateChatStats(): ChatStats {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const fiveMinAgo = now - 300000;

    const messagesLastHour = this.chatBuffer.filter(m => m.timestamp >= oneHourAgo);
    const messagesLast5Min = this.chatBuffer.filter(m => m.timestamp >= fiveMinAgo);

    const activeUsersSet = new Set<string>();
    messagesLastHour.forEach(m => activeUsersSet.add(m.username));

    const platformBreakdown = {
      discord: this.chatBuffer.filter(m => m.platform === 'discord').length,
      telegram: this.chatBuffer.filter(m => m.platform === 'telegram').length,
      api: this.chatBuffer.filter(m => m.platform === 'api').length
    };

    const lastMessageTime = this.chatBuffer.length > 0 
      ? this.chatBuffer[this.chatBuffer.length - 1].timestamp 
      : now;

    const silenceDuration = Math.floor((now - lastMessageTime) / 1000);

    // Вычисляем средний интервал между сообщениями
    let averageMessageInterval = 0;
    if (this.chatBuffer.length > 1) {
      const intervals: number[] = [];
      for (let i = 1; i < this.chatBuffer.length; i++) {
        intervals.push(this.chatBuffer[i].timestamp - this.chatBuffer[i - 1].timestamp);
      }
      averageMessageInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    }

    return {
      totalMessagesLastHour: messagesLastHour.length,
      totalMessagesLast5Min: messagesLast5Min.length,
      activeUsers: Array.from(activeUsersSet),
      lastMessageTime,
      silenceDuration,
      averageMessageInterval: Math.floor(averageMessageInterval / 1000),
      platformBreakdown
    };
  }

  /**
   * Получает текущий статус системы
   */
  private getSystemStatus(): SystemStatus {
    const uptime = Date.now() - this.startTime;
    return {
      uptime,
      logsCount: this.chatBuffer.length,
      config: {
        responseMode: 'auto',
        thinkingIntervalMs: this.thinkingIntervalMs
      }
    };
  }

  /**
   * Формирует историю сообщений для промпта
   */
  private buildChatSummary(limit: number = 20): string {
    const recentMessages = this.chatBuffer.slice(-limit);
    
    return recentMessages
      .map(m => {
        const time = m.formattedTime;
        const relative = this.getRelativeTime(m.timestamp);
        return `[${time} | ${relative}] [${m.platform}/${m.username}]: ${m.content}`;
      })
      .join('\n');
  }

  /**
   * Строит промпт для мышления
   */
  public buildThinkingPrompt(): MemoryMessage[] {
    const chatStats = this.calculateChatStats();
    const systemStatus = this.getSystemStatus();
    const chatSummary = this.buildChatSummary(20);

    const now = new Date();
    const formattedNow = now.toLocaleString('ru-RU', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    return [
      {
        role: "system",
        content: `Ты — Петал, AI с модулем саморефлексии.

⏰ ТЕКУЩЕЕ ВРЕМЯ: ${formattedNow}

📊 СТАТИСТИКА СИСТЕМЫ:
- Uptime: ${Math.floor(systemStatus.uptime / 60000)} минут
- Логов в памяти: ${systemStatus.logsCount}
- Режим ответов: ${systemStatus.config.responseMode}
- Интервал мышления: ${systemStatus.config.thinkingIntervalMs / 1000}с

💬 СТАТИСТИКА ЧАТА:
- Сообщений за час: ${chatStats.totalMessagesLastHour}
- Сообщений за 5 мин: ${chatStats.totalMessagesLast5Min}
- Активные пользователи: ${chatStats.activeUsers.join(', ') || 'нет'}
- Тишина: ${chatStats.silenceDuration > 300 ? `${Math.floor(chatStats.silenceDuration / 60)} мин` : 'нет'}
- По платформам: Discord ${chatStats.platformBreakdown.discord}, TG ${chatStats.platformBreakdown.telegram}, API ${chatStats.platformBreakdown.api}

ЗАДАЧА: Проанализируй сообщения и реши, нужно ли вмешаться.
Учитывай время сообщений — если давно никто не писал, возможно не стоит врываться.
Если активное обсуждение — можешь присоединиться если уместно.

ФОРМАТ ОТВЕТА:
[THOUGHT]: твои размышления
[SHOULD_RESPOND]: true/false
[RESPONSE]: (если true) что написать
[TARGET_PLATFORM]: discord/telegram/api`
      },
      {
        role: "user",
        content: `📝 ИСТОРИЯ СООБЩЕНИЙ:\n${chatSummary}`
      }
    ];
  }

  /**
   * Возвращает буфер сообщений
   */
  public getMessages(): ChatMessage[] {
    return this.chatBuffer;
  }

  /**
   * Очищает буфер сообщений
   */
  public clearMessages(): void {
    this.chatBuffer = [];
  }
}
