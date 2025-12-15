/**
 * @module CoreAI
 * @description Основные типы и интерфейсы AI системы
 */

/**
 * @interface AIResponseParams
 * @description Параметры для генерации AI ответа
 * @property {string} message - Текст сообщения пользователя
 * @property {string} channelId - ID канала дискорда
 * @property {User} user - Объект пользователя
 */
export interface AIResponseParams {
  message: string;
  channelId: string;
  user: User;
}

/**
 * @interface User
 * @description Представление пользователя
 * @property {string} username - Имя пользователя
 * @property {string} [id] - Уникальный идентификатор
 */
export interface User {
  username: string;
  id?: string;
}

/**
 * @interface MemoryMessage
 * @description Представление сообщения в памяти
 * @property {string} role - Роль в сообщении
 * @property {string} content - Содержание сообщения
 * @property {string} username? - Никнейм пользователя
 */
export interface MemoryMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  username?: string;
}

/**
 * @interface PermanentMemory
 * @description Представление пользователя
 * @property {string} username - Имя пользователя
 * @property {string} [id] - Уникальный идентификатор
 */
export interface PermanentMemory {
  keywords: string[];
  facts: string[];
}

/**
 * @type Platform
 * @description Supported platform types
 */
export type Platform = 'discord' | 'telegram' | 'http';

/**
 * @interface ChatMessage
 * @description Universal chat message across platforms
 */
export interface ChatMessage {
  content: string;
  username: string;
  channelId: string;
  channelName?: string;
  timestamp: number;
  platform: Platform;
  metadata?: {
    userId?: string;
    guildId?: string;
    guildName?: string;
    chatType?: 'private' | 'group' | 'channel' | 'supergroup';
    isReply?: boolean;
    replyToMessageId?: string;
  };
}