import { MemorySystem } from "../memory/memory";
import { PromptSystem } from "./prompts";
import { AIActionHandler } from "./actions";
import { ThinkingModule } from "../thinking/thinking";
import { Logger } from "../system/logger";
import { AIResponseParams, ChatMessage } from "../ai.types";
import { ollamaClient } from "./ollamaClient";

import "dotenv/config";

export class ApiNeiro {
  private readonly promptSystem: PromptSystem;
  private readonly actionHandler: AIActionHandler;
  private readonly memory: MemorySystem;
  private readonly thinking: ThinkingModule;
  private readonly logger: Logger;

  constructor() {
    this.memory = new MemorySystem();
    this.logger = new Logger();
    this.thinking = new ThinkingModule(this.logger);
    this.promptSystem = new PromptSystem(this.memory);
    this.actionHandler = new AIActionHandler(this.memory);
  }

  public getMemory(): MemorySystem {
    return this.memory;
  }

  public async generateResponse(params: AIResponseParams): Promise<string> {
    // Добавляем сообщение в буфер мыслительного модуля
    const timestamp = Date.now();
    const chatMessage: ChatMessage = {
      content: params.message,
      username: params.user.username,
      channelId: params.channelId,
      platform: params.platform || 'discord',
      timestamp: timestamp,
      formattedTime: new Date(timestamp).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      relativeTime: '0 сек назад'
    };
    this.thinking.addMessage(chatMessage);

    // 1. Строим сообщения (внутри promptSystem нужно убедиться, 
    // что вызывается memory.getContext(), чтобы подтянуть старые факты)
    const messages = this.promptSystem.buildMessages(
      params.message,
      params.channelId,
      params.user.username,
    );

    // 2. Получаем "грязный" ответ от AI (с тегами)
    const rawResponse = await this.queryAI(messages);

    // 3. Проверяем на [NO_RESPONSE] - если модель решила молчать
    if (this.shouldNotRespond(rawResponse)) {
      return '[NO_RESPONSE]';
    }

    // 4. Извлекаем важность (importance) и очищаем текст
    const { cleanResponse, importance } = this.extractImportance(rawResponse);

    // 5. Обновляем память с реальной оценкой важности
    this.memory.updateMemory(
      params.channelId,
      params.message,
      cleanResponse, // Сохраняем чистый текст без тега важности
      importance,    // Если > 0.65, улетит в перманентную память
      params.user.username,
    );

    // 6. Обрабатываем действия (actions) и возвращаем итог
    const finalResponse = await this.processResponse(cleanResponse);
    
    // 7. Если после обработки остался пустой ответ - считаем это молчанием
    if (finalResponse.trim() === '') {
      return '[NO_RESPONSE]';
    }
    
    return finalResponse;
  }

  /**
   * Проверяет, решила ли AI промолчать
   */
  private shouldNotRespond(text: string): boolean {
    const trimmed = text.trim();
    const normalized = trimmed.toLowerCase();
    return text.includes('[NO_RESPONSE]') || 
           text.includes('(NO_RESPONSE)') ||
           normalized === '[no_response]' ||
           normalized === '(no_response)' ||
           trimmed === '' || 
           trimmed === '(промолчать)' ||
           trimmed === '(молчание)';
  }

  /**
   * Парсит ответ на наличие тега [MEMORY:0.0-1.0]
   */
  private extractImportance(text: string): { cleanResponse: string; importance: number } {
    const importanceRegex = /\[MEMORY:(\d+(\.\d+)?)\]/;
    const match = text.match(importanceRegex);

    let importance = 0;
    let cleanResponse = text;

    if (match) {
      importance = parseFloat(match[1]);
      // Удаляем тег из текста, чтобы пользователь его не видел
      cleanResponse = text.replace(importanceRegex, "").trim();
    }

    // Защита от галлюцинаций (если число > 1)
    if (importance > 1) importance = 1;

    return { cleanResponse, importance };
  }

  private async queryAI(messages: any[]): Promise<string> {
    return ollamaClient.query(messages, 'main');
  }

  private async processResponse(response: string): Promise<string> {
    const actionRegex = /\[AI_ACTION:(\w+(?:\.\w+)?)\](.*?)\[\/AI_ACTION\]/gs;
    let processedResponse = response;

    // Используем matchAll и итерируемся
    const matches = Array.from(response.matchAll(actionRegex));

    for (const match of matches) {
      const actionName = match[1];
      const jsonString = match[2];

      try {
        // Используем безопасный парсинг
        const params = this.safeJsonParse(jsonString);

        const result = await this.actionHandler.execute(
          actionName,
          params,
        );

        // Полностью удаляем тег действия из ответа (без замены)
        processedResponse = processedResponse.replace(match[0], '');
      } catch (error) {
        console.error(`Action error [${actionName}]:`, error);
        // Удаляем тег даже при ошибке, чтобы не показывать пользователю
        processedResponse = processedResponse.replace(match[0], '');
      }
    }

    // Убираем лишние пробелы и переносы строк после удаления тегов
    processedResponse = processedResponse
      .replace(/\s{2,}/g, ' ') // Множественные пробелы в один
      .replace(/\n{3,}/g, '\n\n') // Множественные переносы строк
      .trim();

    return processedResponse;
  }

  /**
   * Умный парсер JSON, который чистит мусор от нейросети
   * Исправляет: {{...}}, {'key': 'val'}, переносы строк
   */
  private safeJsonParse(str: string): any {
    let cleanStr = str.trim();

    // 1. Поиск границ JSON объекта (находим первые { и последние })
    const firstBrace = cleanStr.indexOf('{');
    const lastBrace = cleanStr.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1) {
      cleanStr = cleanStr.substring(firstBrace, lastBrace + 1);
    }

    // 2. Исправление двойных скобок {{...}} -> {...}
    // Нейросети часто пишут так случайно
    while (cleanStr.startsWith('{{') && cleanStr.endsWith('}}')) {
      cleanStr = cleanStr.substring(1, cleanStr.length - 1);
    }

    try {
      return JSON.parse(cleanStr);
    } catch (e) {
      // 3. Если все еще ошибка, пробуем исправить одинарные кавычки
      try {
        // Заменяем 'key': ... на "key": ...
        // И 'value' на "value", стараясь не задеть апострофы внутри текста
        const fixed = cleanStr
          .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":')
          .replace(/:\s*'([^']*)'/g, ': "$1"');

        return JSON.parse(fixed);
      } catch (e2) {
        console.error("CRITICAL JSON PARSE FAIL:", cleanStr);
        return {};
      }
    }
  }

  /**
   * Возвращает модуль мышления
   */
  public getThinkingModule(): ThinkingModule {
    return this.thinking;
  }
}
