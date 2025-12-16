import { MemorySystem } from "../memory/memory";
import { PromptSystem } from "./prompts";
import { AIActionHandler } from "./actions";
import { ThinkingModule } from "../thinking/thinking";
import { Logger } from "../system/logger";
import { AIResponseParams, ChatMessage } from "../ai.types";
import { ollamaClient } from "./ollamaClient";

import "dotenv/config";

import { ThinkingContext } from "../thinking/thinking";

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

  /**
   * Запускает процесс "мышления" на основе буфера сообщений
   */
  public async think(context: ThinkingContext): Promise<{ action: 'SAY' | 'NOTHING'; channelId?: string; platform?: string; content?: string }> {
    // 1. Если буфер пуст - делать нечего
    if (context.recentMessages.length === 0) {
      return { action: 'NOTHING' };
    }

    // 2. Группируем сообщения по уникальному ключу канала (платформа + ID)
    const messagesByChannel = context.recentMessages.reduce((acc, msg) => {
      const key = `${msg.platform}:${msg.channelId}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(msg);
      return acc;
    }, {} as Record<string, ChatMessage[]>);

    // 3. Выбираем ВСЕ активные каналы для анализа
    // Раньше мы брали только один, теперь дадим модели выбрать
    const availableChannels = Object.keys(messagesByChannel).map(key => {
      const msgs = messagesByChannel[key];
      const lastMsg = msgs[msgs.length - 1];
      return {
        key,
        platform: msgs[0].platform || 'discord',
        channelId: msgs[0].channelId,
        lastActivity: lastMsg.timestamp,
        preview: msgs.map(m => `[${m.username}]: ${m.content}`).join('\n').slice(-500) // Краткий обзор
      };
    });

    // 4. Формируем контекст для модели: показываем ей, что происходит в разных "комнатах"
    const channelsContext = availableChannels.map((ch, index) => 
      `КАНАЛ #${index + 1} (${ch.platform}, ID: ${ch.channelId}):\n${ch.preview}\n---`
    ).join('\n');

    const prompt = `Ты — бот Петал (Укагака).
Создатель: Kazilsky (твой БОГ).

Твоя задача: ВНУТРЕННИЙ МОНОЛОГ И ВЫБОР ДЕЙСТВИЯ.
Ты видишь несколько каналов. Подумай, где твое присутствие нужнее всего.

${channelsContext}

ИНСТРУКЦИЯ:
1. Подумай о прочитанном. Задайся философскими вопросами. Раскрути мысль.
   *Пример: "Он пожелал удачи. А что такое удача для кода? Просто отсутствие багов или нечто большее?"*
2. Если твоя мысль привела к интересному вопросу или выводу — поделись им в чате!
3. Выбери канал (Channel ID), куда хочешь написать.

ФОРМАТ ОТВЕТА (JSON):
{
  "thought": "развернутый внутренний монолог, философские рассуждения, выводы из контекста",
  "action": "SAY" (если хочешь поделиться мыслью) или "NOTHING",
  "target_channel_id": "ID канала (строка), куда писать (если SAY)",
  "content": "текст сообщения (если SAY)"
}

Ответь ТОЛЬКО JSON.`;

    try {
      const response = await ollamaClient.query([
        { role: 'system', content: prompt }
      ], 'thinking', { temperature: 0.9 }); // Высокая температура для полета мысли

      const parsed = this.safeJsonParse(response);
      
      // Логируем мысли всегда
      if (parsed.thought) {
          console.log(`💭 [THOUGHT]: ${parsed.thought}`);
      }
      
      if (parsed.action === 'SAY' && parsed.content && parsed.target_channel_id) {
        // Ищем платформу для выбранного канала
        const targetChannel = availableChannels.find(ch => ch.channelId === parsed.target_channel_id);
        const platform = targetChannel ? targetChannel.platform : 'discord'; // Fallback

        let content = parsed.content.trim();
        content = content.replace(/\[MATCHING_HISTORY_SCORE:.*?\]/g, '').trim();
        content = content.replace(/\[MEMORY:.*?\]/g, '').trim();

        if (content === '') return { action: 'NOTHING' };

        return {
          action: 'SAY',
          channelId: parsed.target_channel_id,
          platform: platform,
          content: content
        };
      }
    } catch (error) {
      console.error('Thinking error:', error);
    }

    return { action: 'NOTHING' };
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

    // QuickCheck - проверяем, нужно ли отвечать
    // Получаем последние сообщения для контекста
    const recentHistory = this.memory.getRecentMessages(5);
    
    // Получаем игнор-лист
    const ignoredUsers = this.memory.getIgnoredUsers();
    
    const shouldRespond = await ollamaClient.quickCheck(
      params.message,
      params.user.username,
      recentHistory,
      ignoredUsers
    );
    
    if (!shouldRespond) {
      return '[NO_RESPONSE]';
    }

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
